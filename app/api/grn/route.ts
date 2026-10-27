import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sku = searchParams.get('sku')?.trim();
    const productId = searchParams.get('productId')?.trim();
    const batch = searchParams.get('batch')?.trim();
    const date = searchParams.get('date')?.trim();

    const { db } = await connectToDatabase();

    // 1. Locate product if sku or productId provided
    let productMatch: any = null;
    if (sku || productId) {
      productMatch = await db.collection<any>('products').findOne({
        $or: [
          ...(sku ? [{ sku: sku }, { skuCode: sku }, { barcode: sku }] : []),
          ...(productId ? [{ id: productId }] : []),
        ],
      });
    }

    // 2. Query grns history
    const grnQuery: Record<string, any> = {};
    if (sku) {
      grnQuery.$or = [{ sku: sku }, { skuCode: sku }];
    }
    if (batch && batch !== 'all') {
      grnQuery.batchRef = batch;
    }
    if (date && date !== 'all') {
      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      grnQuery.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    const grnRecords = await db
      .collection('grns')
      .find(grnQuery)
      .sort({ createdAt: -1 })
      .toArray();

    // 3. Aggregate unique batches and add dates
    const batchesMap = new Map<string, { batchRef: string; date?: string; count: number; supplier?: string }>();
    const datesMap = new Map<string, { date: string; count: number }>();

    for (const record of grnRecords) {
      const bRef = (record as any).batchRef || 'GRN-OCT';
      const rDate = (record as any).createdAt ? new Date((record as any).createdAt).toISOString().slice(0, 10) : '';
      const existingB = batchesMap.get(bRef) || { batchRef: bRef, date: rDate, count: 0, supplier: (record as any).supplier };
      existingB.count += Number((record as any).qtyAdded || 1);
      batchesMap.set(bRef, existingB);

      if (rDate) {
        const existingD = datesMap.get(rDate) || { date: rDate, count: 0 };
        existingD.count += Number((record as any).qtyAdded || 1);
        datesMap.set(rDate, existingD);
      }
    }

    // Also parse from product activeSerials if present
    let filteredSerials: any[] = [];
    if (productMatch && Array.isArray(productMatch.activeSerials)) {
      for (const item of productMatch.activeSerials) {
        const itemBatch = item.batchRef || item.grnBatch || productMatch.grnBatch || 'GRN-OCT';
        const rawDate = item.addedAt || item.addedDate || item.receivedAt || productMatch.lastRestockedAt || productMatch.createdAt;
        const itemDate = rawDate ? (typeof rawDate === 'string' ? rawDate.slice(0, 10) : new Date(rawDate).toISOString().slice(0, 10)) : '';

        if (!batchesMap.has(itemBatch)) {
          batchesMap.set(itemBatch, { batchRef: itemBatch, date: itemDate, count: 1, supplier: item.supplier });
        } else if (grnRecords.length === 0) {
          batchesMap.get(itemBatch)!.count++;
        }

        if (itemDate) {
          if (!datesMap.has(itemDate)) {
            datesMap.set(itemDate, { date: itemDate, count: 1 });
          } else if (grnRecords.length === 0) {
            datesMap.get(itemDate)!.count++;
          }
        }

        // Apply filters
        let matches = true;
        if (batch && batch !== 'all' && itemBatch.toLowerCase() !== batch.toLowerCase()) {
          matches = false;
        }
        if (date && date !== 'all' && itemDate !== date) {
          matches = false;
        }
        if (matches) {
          filteredSerials.push(item);
        }
      }
    }

    return NextResponse.json({
      success: true,
      batches: Array.from(batchesMap.values()),
      dates: Array.from(datesMap.values()),
      grnRecords: grnRecords.map(({ _id, ...rest }) => rest),
      serials: filteredSerials,
      totalSerialsCount: productMatch?.activeSerials?.length || 0,
      matchedSerialsCount: filteredSerials.length,
    });
  } catch (error: any) {
    console.error('[GRN GET Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      sku: rawSku,
      category,
      productTitle,
      costPrice,
      sellingPrice,
      restockQty,
      warrantyMonths,
      supplier,
      batchRef,
      serialNumbersInput,
    } = body;

    const sku = String(rawSku || body.skuCode || body.barcode || '').trim();
    if (!sku) {
      return NextResponse.json({ success: false, error: 'SKU is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const qty = Number(restockQty || 1);

    // 1. Serials parsing and strict uniqueness enforcement
    let serialsArray: string[] = [];
    if (Array.isArray(body.serials)) {
      serialsArray = body.serials.map((s: string) => String(s).trim()).filter(Boolean);
    } else if (serialNumbersInput && typeof serialNumbersInput === 'string' && serialNumbersInput.trim() !== '') {
      serialsArray = serialNumbersInput.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean);
    }

    // A. Detect duplicates within the newly submitted batch
    const seenBatchSerials = new Set<string>();
    for (const sn of serialsArray) {
      const lower = sn.toLowerCase();
      if (seenBatchSerials.has(lower)) {
        return NextResponse.json(
          {
            success: false,
            error: `Duplicate tracking number in GRN batch: '${sn}'. No two items can share the same Serial / IMEI.`,
          },
          { status: 400 }
        );
      }
      seenBatchSerials.add(lower);
    }

    // B. Check against database: Prevent duplicate active/in-stock serials across inventory
    if (serialsArray.length > 0) {
      const existingConflict = await db.collection<any>('products').findOne({
        'activeSerials': {
          $elemMatch: {
            serialNumber: { $in: serialsArray },
            status: { $in: ['Available', 'In-Stock'] },
          },
        },
      });

      if (existingConflict) {
        const conflictUnit = (existingConflict.activeSerials || []).find(
          (u: any) =>
            serialsArray.some((s) => s.toLowerCase() === (u.serialNumber || '').toLowerCase()) &&
            ['Available', 'In-Stock'].includes(u.status)
        );
        return NextResponse.json(
          {
            success: false,
            error: `Serial / IMEI '${conflictUnit?.serialNumber || 'entered'}' is already registered and active in store stock under '${existingConflict.name || existingConflict.sku}'. Duplicate serial numbers are strictly prohibited.`,
          },
          { status: 400 }
        );
      }
    }

    const processedUnits = [];
    for (let i = 0; i < qty; i++) {
      const assignedSerial =
        serialsArray[i] || `AUTO-${sku}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      processedUnits.push({
        serialNumber: assignedSerial,
        isAutoGenerated: !serialsArray[i],
        batchRef: batchRef || 'BATCH-GEN',
        costPrice: Number(costPrice || 0),
        sellingPrice: Number(sellingPrice || 0),
        status: 'Available',
        source: 'GRN Inward',
        supplier: supplier || 'Direct Supplier',
        addedDate: new Date(),
        addedAt: new Date().toISOString(),
      });
    }

    // 2. Product update in MongoDB without modifying or touching existing product name
    const existingProduct = await db.collection<any>('products').findOne({
      $or: [
        { sku: sku },
        { skuCode: sku },
        ...(body.id ? [{ id: body.id }] : []),
        ...(body.productId ? [{ id: body.productId }] : []),
        ...(body.barcode ? [{ barcode: body.barcode }] : []),
      ],
    });

    const targetTitle = productTitle || body.name || (existingProduct ? (existingProduct.name || existingProduct.title) : `Product ${sku}`);
    const targetCost = Number(costPrice || 0);
    const targetSelling = Number(sellingPrice || 0);
    const targetWarranty = Number(warrantyMonths || 0);
    const targetSupplier = supplier || 'Direct Supplier';
    const isSerialized = Boolean(body.isSerialized || serialsArray.length > 0);

    const validNewSerials = processedUnits.map((u) => u.serialNumber);

    // Build update set: Strictly DO NOT include 'name', 'title', or 'product_name' to prevent accidental overwrite!
    const updateSet: Record<string, any> = {
      updatedAt: new Date().toISOString(),
      lastRestockedAt: new Date(),
    };

    if (targetCost > 0) updateSet.costPrice = targetCost;
    if (targetSelling > 0) updateSet.sellingPrice = targetSelling;
    if (targetWarranty > 0) {
      updateSet.warrantyMonths = targetWarranty;
      updateSet.warrantyPeriodMonths = targetWarranty;
    }
    if (supplier) updateSet.supplier = targetSupplier;
    if (batchRef) {
      updateSet.grnBatch = batchRef;
      updateSet.lastBatchRef = batchRef;
    }
    if (isSerialized) updateSet.isSerialized = true;

    // $setOnInsert ONLY sets product name if this is a completely new product being inserted for the first time
    const setOnInsertFields: Record<string, any> = {
      id: body.id || body.productId || `prod-${Date.now()}`,
      sku: sku,
      skuCode: sku,
      name: targetTitle,
      title: targetTitle,
      product_name: targetTitle,
      category: category || 'Mobile Accessories',
      barcode: body.barcode || `BC-${sku}`,
      stockWarehouse: 0,
      createdAt: new Date().toISOString(),
      costPrice: targetCost,
      sellingPrice: targetSelling,
      supplier: targetSupplier,
      warrantyMonths: targetWarranty || 12,
      warrantyPeriodMonths: targetWarranty || 12,
      isSerialized: isSerialized,
    };

    await db.collection('products').updateOne(
      { $or: [{ sku: sku }, { skuCode: sku }] },
      {
        $set: updateSet,
        $setOnInsert: setOnInsertFields,
        $inc: {
          storeStock: qty,
          stockStore: qty,
          stockQuantity: qty,
        },
        $push: {
          activeSerials: { $each: processedUnits },
          serialNumbers: { $each: validNewSerials },
        } as any,
      },
      { upsert: true }
    );

    // 3. Expenses වලට Cost එක එකතු කිරීම
    const totalCost = Number(costPrice || 0) * qty;
    await db.collection('expenses').insertOne({
      category: 'Inventory Restock',
      description: `GRN Restock for SKU: ${sku} (Qty: ${qty})`,
      amount: totalCost,
      supplier: supplier || 'Direct Supplier',
      batchRef: batchRef || 'BATCH-GEN',
      createdAt: new Date(),
    });

    // 4. 🚀 AUTO-SETTLE PENDING ORDERS (FIFO පදනමින් අලුත් බඩු වලින් Orders සෙට් කිරීම)
    const pendingOrders = await db.collection('orders').find({
      status: 'Pending Stock',
      'items.sku': sku,
    }).sort({ createdAt: 1 }).toArray();

    for (const order of pendingOrders) {
      const updatedProduct = await db.collection<any>('products').findOne({ $or: [{ sku: sku }, { skuCode: sku }] });
      const freshAvailableUnits = (updatedProduct?.activeSerials || []).filter((s: any) => s.status === 'In-Stock');

      const targetItem = (order.items || []).find((i: any) => i.sku === sku);
      const neededQty = Number(targetItem?.qty || targetItem?.quantity || 1);

      if (freshAvailableUnits.length >= neededQty) {
        const allocatedUnits = freshAvailableUnits.slice(0, neededQty);
        const unitIdsToUpdate = allocatedUnits.map((u: any) => u.serialNumber);

        // Serial status එක 'Sold' කර storeStock එක අඩු කිරීම
        await db.collection('products').updateOne(
          { _id: updatedProduct._id, 'activeSerials.serialNumber': { $in: unitIdsToUpdate } },
          {
            $inc: { storeStock: -neededQty, stockQuantity: -neededQty },
            $set: { 'activeSerials.$[elem].status': 'Sold' },
          },
          { arrayFilters: [{ 'elem.serialNumber': { $in: unitIdsToUpdate } }] } as any
        );

        // Order එක Completed කිරීම
        const cPrice = Number(allocatedUnits[0]?.costPrice || updatedProduct.costPrice || 0);
        const uPrice = Number(targetItem.sellingPrice || updatedProduct.sellingPrice || 0);
        const itemProfit = uPrice - cPrice;

        await db.collection('orders').updateOne(
          { _id: order._id },
          {
            $set: {
              status: 'Completed',
              netProfit: itemProfit * neededQty,
              'items.$[elem].allocatedSerials': unitIdsToUpdate,
              'items.$[elem].status': 'Allocated & Sold',
              settledAt: new Date(),
            },
          },
          { arrayFilters: [{ 'elem.sku': sku }] } as any
        );
      }
    }

    const updatedProduct = await db.collection<any>('products').findOne({
      $or: [{ sku: sku }, { skuCode: sku }],
    });

    return NextResponse.json({
      success: true,
      product: updatedProduct,
      message: `GRN saved successfully! Stock and unique serials updated without modifying product name. Pending orders checked & auto-settled.`,
    });
  } catch (error: any) {
    console.error('GRN Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
