import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { Product } from '@/types';
import { resolvePendingBacklogOrders } from '@/lib/inventoryBacklog';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sku = searchParams.get('sku')?.trim();
    const batch = searchParams.get('batch')?.trim();
    const date = searchParams.get('date')?.trim();

    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      let query: any = {};
      if (sku) {
        query.$or = [{ sku }, { skuCode: sku }, { barcode: sku }, { id: sku }];
      }
      if (batch && batch !== 'all') {
        const batchConditions = [
          { grnBatch: batch },
          { lastBatchRef: batch },
          { 'activeSerials.batchRef': batch },
        ];
        if (query.$or) {
          query.$and = [{ $or: query.$or }, { $or: batchConditions }];
          delete query.$or;
        } else {
          query.$or = batchConditions;
        }
      }

      const products = await mongoConn.db.collection('products').find(query).toArray();
      let clean = products.map(({ _id, ...rest }) => rest as Product);

      // If batch or date is specified, filter activeSerials for precision
      if ((batch && batch !== 'all') || (date && date !== 'all')) {
        clean = clean.map((p) => {
          if (!Array.isArray(p.activeSerials)) return p;
          const filteredSerials = p.activeSerials.filter((s: any) => {
            let match = true;
            if (batch && batch !== 'all') {
              const bRef = s.batchRef || (s as any).grnBatch || p.grnBatch || '';
              if (bRef.toLowerCase() !== batch.toLowerCase()) match = false;
            }
            if (date && date !== 'all') {
              const itemDate = s.addedAt || (s as any).addedDate || p.createdAt || '';
              const dateStr = typeof itemDate === 'string' ? itemDate : new Date(itemDate).toISOString();
              if (!dateStr.startsWith(date)) match = false;
            }
            return match;
          });
          return {
            ...p,
            activeSerials: filteredSerials,
          };
        });
      }

      return NextResponse.json({ success: true, products: clean, source: 'mongodb' });
    }
  } catch (err: any) {
    console.warn('[Products API GET] MongoDB read error:', err.message);
  }

  return NextResponse.json({ success: true, products: [], source: 'fallback' });
}

export async function POST(req: NextRequest) {
  try {
    const product: Product = await req.json();
    if (!product || !product.sku) {
      return NextResponse.json({ success: false, error: 'Invalid product payload' }, { status: 400 });
    }

    let resolvedProduct = product;
    let resolvedOrdersCount = 0;

    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        const effectiveStoreStock = Number(product.storeStock ?? product.stockStore ?? product.stockQuantity ?? 0);
        product.storeStock = effectiveStoreStock;
        product.stockStore = effectiveStoreStock;
        product.stockWarehouse = 0;

        await mongoConn.db.collection('products').updateOne(
          { $or: [{ sku: product.sku }, { id: product.id }] },
          { $set: product },
          { upsert: true }
        );

        // AUTO-DEDUCTION FOR PENDING/BACKLOG INVOICES ON NEW GRN RESTOCK
        if (effectiveStoreStock > 0 && product.costPrice > 0) {
          const backlogRes = await resolvePendingBacklogOrders(product, { mongoClient: mongoConn });
          resolvedProduct = backlogRes.product;
          resolvedOrdersCount = backlogRes.resolvedOrders.length;
        }
      }
    } catch (err: any) {
      console.warn('[Products API POST] MongoDB write error:', err.message);
    }

    return NextResponse.json({
      success: true,
      product: resolvedProduct,
      backlogResolvedCount: resolvedOrdersCount,
    });
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

    let resolvedCount = 0;

    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        await mongoConn.db.collection('products').updateOne(
          { $or: [{ id }, { sku: id }] },
          { $set: updates }
        );

        // Fetch updated product to verify stock and resolve backlog
        const updatedDoc = await mongoConn.db.collection('products').findOne({
          $or: [{ id }, { sku: id }],
        });

        if (updatedDoc) {
          const { _id, ...cleanProd } = updatedDoc as any;
          const storeCount = Number(cleanProd.storeStock ?? cleanProd.stockStore ?? cleanProd.stockQuantity ?? 0);
          if (storeCount > 0 && cleanProd.costPrice > 0) {
            cleanProd.storeStock = storeCount;
            cleanProd.stockStore = storeCount;
            cleanProd.stockWarehouse = 0;
            const backlogRes = await resolvePendingBacklogOrders(cleanProd, { mongoClient: mongoConn });
            resolvedCount = backlogRes.resolvedOrders.length;
          }
        }
      }
    } catch (err: any) {
      console.warn('[Products API PUT] MongoDB update error:', err.message);
    }

    return NextResponse.json({ success: true, backlogResolvedCount: resolvedCount });
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
        await mongoConn.db.collection('products').deleteOne({
          $or: [{ id }, { sku: id }],
        });
      }
    } catch (err: any) {
      console.warn('[Products API DELETE] MongoDB delete error:', err.message);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
