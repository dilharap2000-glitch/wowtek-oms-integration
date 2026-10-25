import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { SupplierRmaClaim } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      const claims = await mongoConn.db.collection('rma_claims').find({}).toArray();
      const clean = claims.map(({ _id, ...rest }) => rest as SupplierRmaClaim);
      return NextResponse.json({ success: true, rmaClaims: clean });
    }
  } catch (err: any) {
    console.warn('[RMA API GET] MongoDB read error:', err.message);
  }

  return NextResponse.json({ success: true, rmaClaims: [] });
}

export async function POST(req: NextRequest) {
  try {
    const claim: SupplierRmaClaim = await req.json();
    if (!claim || !claim.id) {
      return NextResponse.json({ success: false, error: 'Invalid RMA claim payload' }, { status: 400 });
    }

    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        await mongoConn.db.collection('rma_claims').updateOne(
          { id: claim.id },
          { $set: claim },
          { upsert: true }
        );
      }
    } catch (err: any) {
      console.warn('[RMA API POST] MongoDB write error:', err.message);
    }

    return NextResponse.json({ success: true, claim });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, updates } = body;
    if (!id || !updates) {
      return NextResponse.json({ success: false, error: 'id and updates are required' }, { status: 400 });
    }

    let replacedProductDoc: any = null;
    let syncedSerial = '';

    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        // Fetch existing claim first to access productSku and supplier info
        const existingClaim = await mongoConn.db.collection('rma_claims').findOne({ id });
        const mergedClaim = { ...existingClaim, ...updates, updatedAt: new Date().toISOString() };

        await mongoConn.db.collection('rma_claims').updateOne(
          { id },
          { $set: mergedClaim }
        );

        // AUTOMATED REPLACEMENT INVENTORY SYNC:
        // When status is 'Replaced' and replacementSerial is provided
        const isReplaced = mergedClaim.status === 'Replaced';
        const replacementSerial = (mergedClaim.replacementSerial || '').trim();

        if (isReplaced && replacementSerial) {
          syncedSerial = replacementSerial;
          const targetSku = mergedClaim.productSku;
          const targetName = mergedClaim.productName;

          // Find product in database
          let prodDoc = await mongoConn.db.collection('products').findOne({
            $or: [
              { sku: targetSku },
              { skuCode: targetSku },
              { name: targetName },
              { barcode: targetSku },
            ],
          });

          if (prodDoc) {
            const curStore = Number(prodDoc.storeStock ?? prodDoc.stockStore ?? prodDoc.stockQuantity ?? 0);
            const newStore = curStore + 1;

            const activeSerials = Array.isArray(prodDoc.activeSerials) ? [...prodDoc.activeSerials] : [];
            const existsInActive = activeSerials.some(
              (s: any) => (typeof s === 'string' ? s : s.serialNumber).trim().toLowerCase() === replacementSerial.toLowerCase()
            );

            if (!existsInActive) {
              activeSerials.push({
                serialNumber: replacementSerial,
                status: 'Available',
                addedAt: new Date().toISOString(),
                rmaRef: mergedClaim.rmaNumber,
                supplier: mergedClaim.supplierName,
                source: 'Supplier RMA Replacement',
                originalDefectiveSerial: mergedClaim.serialNumber,
              });
            }

            const serialNumbers = Array.isArray(prodDoc.serialNumbers) ? [...prodDoc.serialNumbers] : [];
            if (!serialNumbers.some((s: string) => s.trim().toLowerCase() === replacementSerial.toLowerCase())) {
              serialNumbers.push(replacementSerial);
            }

            const updateFields = {
              storeStock: newStore,
              stockStore: newStore,
              stockQuantity: newStore,
              stockWarehouse: 0,
              activeSerials,
              serialNumbers,
              lastRestockedAt: new Date().toISOString(),
              lastBatchRef: mergedClaim.rmaNumber,
              updatedAt: new Date().toISOString(),
            };

            await mongoConn.db.collection('products').updateOne(
              { _id: prodDoc._id },
              { $set: updateFields }
            );

            const { _id, ...cleanUpdated } = { ...prodDoc, ...updateFields };
            replacedProductDoc = cleanUpdated;
          } else {
            // If product was not in database, create it so it's instantly available and scannable
            const newProd = {
              id: `prod-rma-${Date.now().toString().slice(-6)}`,
              sku: targetSku || `WT-RMA-${Date.now().toString().slice(-4)}`,
              name: targetName || 'Warranty Replacement Item',
              barcode: replacementSerial,
              category: 'Warranty Replacement',
              costPrice: 0,
              sellingPrice: 0,
              storeStock: 1,
              stockStore: 1,
              stockQuantity: 1,
              stockWarehouse: 0,
              supplier: mergedClaim.supplierName || 'Supplier RMA',
              grnBatch: `RMA-${mergedClaim.rmaNumber || 'REPL'}`,
              activeSerials: [
                {
                  serialNumber: replacementSerial,
                  status: 'Available',
                  addedAt: new Date().toISOString(),
                  rmaRef: mergedClaim.rmaNumber,
                  supplier: mergedClaim.supplierName,
                  source: 'Supplier RMA Replacement',
                  originalDefectiveSerial: mergedClaim.serialNumber,
                },
              ],
              serialNumbers: [replacementSerial],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            await mongoConn.db.collection('products').insertOne(newProd);
            const { _id, ...cleanNew } = newProd as any;
            replacedProductDoc = cleanNew;
          }

          // Also update linked warranty if present
          if (mergedClaim.warrantyId) {
            await mongoConn.db.collection('warranties').updateOne(
              { id: mergedClaim.warrantyId },
              {
                $set: {
                  status: 'Active',
                  notes: `Unit replaced with S/N ${replacementSerial} (RMA: ${mergedClaim.rmaNumber})`,
                  replacementSerial: replacementSerial,
                  updatedAt: new Date().toISOString(),
                },
              }
            );
          }
        }
      }
    } catch (err: any) {
      console.warn('[RMA API PUT] MongoDB update error:', err.message);
    }

    return NextResponse.json({
      success: true,
      replacedProduct: replacedProductDoc,
      replacementSerial: syncedSerial,
      message: syncedSerial
        ? `RMA claim updated & Replacement unit S/N "${syncedSerial}" automatically synced into active inventory!`
        : 'RMA claim updated successfully',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        await mongoConn.db.collection('rma_claims').deleteOne({ id });
      }
    } catch (err: any) {
      console.warn('[RMA API DELETE] MongoDB delete error:', err.message);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
