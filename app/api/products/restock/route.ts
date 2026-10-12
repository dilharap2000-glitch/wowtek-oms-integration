import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { Product } from '@/types';
import { resolvePendingBacklogOrders } from '@/lib/inventoryBacklog';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sku, addedStore = 0, addedWarehouse = 0, costPrice, grnBatch, supplier } = body;

    if (!sku) {
      return NextResponse.json({ success: false, error: 'Product sku is required' }, { status: 400 });
    }

    const storeQty = parseInt(addedStore) || 0;
    const warehouseQty = parseInt(addedWarehouse) || 0;

    if (storeQty <= 0 && warehouseQty <= 0) {
      return NextResponse.json(
        { success: false, error: 'Must specify positive stock quantity to add' },
        { status: 400 }
      );
    }

    const mongoConn = await connectToMongoDB();
    if (!mongoConn) {
      return NextResponse.json({ success: false, error: 'Database connection offline' }, { status: 503 });
    }

    // Find existing product in MongoDB
    const existingDoc = await mongoConn.db.collection('products').findOne({ sku });
    if (!existingDoc) {
      return NextResponse.json(
        { success: false, error: `Product with SKU "${sku}" not found in inventory` },
        { status: 404 }
      );
    }

    const { _id, ...existingProduct } = existingDoc as any;

    // Apply restock increments
    const newStoreStock = (existingProduct.stockStore || 0) + storeQty;
    const newWarehouseStock = (existingProduct.stockWarehouse || 0) + warehouseQty;
    const newCostPrice =
      typeof costPrice === 'number' && costPrice > 0
        ? costPrice
        : existingProduct.costPrice || 0;

    const updatedProduct: Product = {
      ...existingProduct,
      stockStore: newStoreStock,
      stockWarehouse: newWarehouseStock,
      costPrice: newCostPrice,
      grnBatch: grnBatch ? grnBatch.trim() : existingProduct.grnBatch,
      supplier: supplier ? supplier.trim() : existingProduct.supplier,
    };

    // Save preliminary stock to MongoDB
    await mongoConn.db.collection('products').updateOne(
      { sku },
      {
        $set: {
          stockStore: newStoreStock,
          stockWarehouse: newWarehouseStock,
          costPrice: newCostPrice,
          grnBatch: updatedProduct.grnBatch,
          supplier: updatedProduct.supplier,
        },
      }
    );

    // AUTO-DEDUCTION FOR PENDING/BACKLOG INVOICES ON RESTOCK:
    // Check if there are any pending/unprocessed orders in the system waiting for this specific SKU.
    // Automatically deduct required stock from the newly added inventory and move to active with verified profits!
    const resolution = await resolvePendingBacklogOrders(updatedProduct, { mongoClient: mongoConn });

    return NextResponse.json({
      success: true,
      product: resolution.product,
      resolvedOrders: resolution.resolvedOrders,
      totalUnitsDeducted: resolution.totalUnitsDeducted,
      message: resolution.message,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
