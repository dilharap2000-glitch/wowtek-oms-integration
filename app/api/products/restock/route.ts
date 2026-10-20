import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, connectToMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { Product } from '@/types';
import { resolvePendingBacklogOrders } from '@/lib/inventoryBacklog';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sku,
      productId,
      restockQty,
      addedStore,
      costPrice,
      supplier,
      batchRef,
      grnBatch,
    } = body;

    const qtyToAdd = Number(restockQty ?? addedStore ?? 0);
    const effectiveCost = Number(costPrice ?? 0);
    const effectiveBatch = batchRef || grnBatch || `GRN-${new Date().toISOString().slice(0, 10)}-${Math.floor(100 + Math.random() * 900)}`;

    if (!sku && !productId) {
      return NextResponse.json(
        { success: false, message: 'SKU or productId is required' },
        { status: 400 }
      );
    }

    if (qtyToAdd <= 0) {
      return NextResponse.json(
        { success: false, message: 'Must specify positive restock quantity to add' },
        { status: 400 }
      );
    }

    const { db, client } = await connectToDatabase();

    // Build query for product (by ObjectId, string id, or SKU)
    let query: any = {};
    if (productId) {
      if (typeof productId === 'string' && /^[0-9a-fA-F]{24}$/.test(productId)) {
        query = { _id: new ObjectId(productId) };
      } else {
        query = { $or: [{ id: productId }, { sku: productId }] };
      }
    } else {
      query = { sku: sku.trim() };
    }

    // 1. Stock Increment (+Add) - Store Stock only (Warehouse removed) and Price/Supplier update
    const updateResult = await db.collection('products').updateOne(
      query,
      {
        $inc: {
          storeStock: Number(qtyToAdd),
          stockStore: Number(qtyToAdd),
        },
        $set: {
          costPrice: effectiveCost,
          supplier: supplier || 'WOWTEK Direct Import',
          grnBatch: effectiveBatch,
          lastBatchRef: effectiveBatch,
          lastRestockedAt: new Date(),
          updatedAt: new Date().toISOString(),
        },
      }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { success: false, message: 'Product not found with given SKU/ID' },
        { status: 404 }
      );
    }

    // 2. Save GRN Inward History to 'grns' collection
    await db.collection('grns').insertOne({
      sku: sku || query.sku || '',
      productId: productId || null,
      qtyAdded: Number(qtyToAdd),
      costPrice: effectiveCost,
      supplier: supplier || 'WOWTEK Direct Import',
      batchRef: effectiveBatch,
      createdAt: new Date(),
    });

    // 3. Fetch the updated product document
    const updatedDoc = await db.collection('products').findOne(query);
    if (!updatedDoc) {
      return NextResponse.json({
        success: true,
        message: 'Store stock updated successfully!',
      });
    }

    const { _id, ...cleanProduct } = updatedDoc as any;
    const targetProduct: Product = {
      ...cleanProduct,
      stockStore: Number(cleanProduct.stockStore ?? cleanProduct.storeStock ?? 0),
      stockWarehouse: Number(cleanProduct.stockWarehouse ?? 0),
      costPrice: Number(cleanProduct.costPrice ?? effectiveCost),
    };

    // 4. AUTO-DEDUCTION FOR PENDING/BACKLOG INVOICES ON RESTOCK:
    // Check if there are any pending/unprocessed orders waiting for this SKU.
    // Deduct stock, clear 'Inventory Not Found' warning, compute exact Net Operating Profit, and move to active status!
    const resolution = await resolvePendingBacklogOrders(targetProduct, {
      mongoClient: { client, db },
    });

    return NextResponse.json(
      {
        success: true,
        message: resolution.resolvedOrders.length > 0
          ? `Store stock updated successfully! Auto-deducted ${resolution.totalUnitsDeducted} units for ${resolution.resolvedOrders.length} pending backlog order(s).`
          : 'Store stock updated successfully!',
        product: resolution.product,
        resolvedOrders: resolution.resolvedOrders,
        totalUnitsDeducted: resolution.totalUnitsDeducted,
        resolutionMessage: resolution.message,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('GRN Processing Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
