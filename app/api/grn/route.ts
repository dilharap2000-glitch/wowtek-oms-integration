import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { Product } from '@/types';
import { resolvePendingBacklogOrders } from '@/lib/inventoryBacklog';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sku,
      skuCode,
      barcode,
      productId,
      id,
      restockQty,
      qtyAdded,
      costPrice,
      supplier,
      batchRef,
      grnBatch,
    } = body;

    const qty = Number(restockQty ?? qtyAdded ?? 0);
    const unitCost = Number(costPrice ?? 0);
    const effectiveBatch =
      batchRef ||
      grnBatch ||
      `GRN-${new Date().toISOString().slice(0, 10)}-${Math.floor(100 + Math.random() * 900)}`;

    if (!sku && !skuCode && !barcode && !productId && !id) {
      return NextResponse.json(
        { success: false, message: 'At least one identifier (sku, skuCode, barcode, or productId) is required' },
        { status: 400 }
      );
    }

    if (qty <= 0) {
      return NextResponse.json(
        { success: false, message: 'Must specify positive restockQty to add' },
        { status: 400 }
      );
    }

    const { db, client } = await connectToDatabase();

    // 1. Build resilient $or query handling String and Number types across sku, skuCode, barcode, and _id/id
    const orConditions: any[] = [];

    const rawId = productId || id;
    if (rawId) {
      if (typeof rawId === 'string' && /^[0-9a-fA-F]{24}$/.test(rawId)) {
        orConditions.push({ _id: new ObjectId(rawId) });
      }
      orConditions.push({ id: rawId }, { id: String(rawId) });
    }

    const targetSku = sku || skuCode;
    if (targetSku) {
      const strSku = String(targetSku).trim();
      orConditions.push(
        { sku: strSku },
        { sku: strSku.toUpperCase() },
        { sku: strSku.toLowerCase() },
        { skuCode: strSku },
        { skuCode: strSku.toUpperCase() },
        { skuCode: strSku.toLowerCase() }
      );
      if (!isNaN(Number(strSku))) {
        orConditions.push({ sku: Number(strSku) }, { skuCode: Number(strSku) });
      }
    }

    if (barcode) {
      const strBarcode = String(barcode).trim();
      orConditions.push({ barcode: strBarcode });
      if (!isNaN(Number(strBarcode))) {
        orConditions.push({ barcode: Number(strBarcode) });
      }
    }

    const query = orConditions.length > 0 ? { $or: orConditions } : { sku: String(targetSku || '') };

    // 2. Increment storeStock (+Add) - completely removed warehouse split
    const updateResult = await db.collection('products').updateOne(
      query,
      {
        $inc: {
          storeStock: Number(qty),
          stockStore: Number(qty),
        },
        $set: {
          costPrice: unitCost,
          supplier: supplier || 'WOWTEK Direct Import',
          lastRestockedAt: new Date(),
          lastBatchRef: effectiveBatch,
          grnBatch: effectiveBatch,
          updatedAt: new Date().toISOString(),
        },
      }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { success: false, message: 'Product not found with given SKU/Barcode/ID' },
        { status: 404 }
      );
    }

    // 3. Save GRN Inward Receipt history to 'grns' collection
    await db.collection('grns').insertOne({
      sku: targetSku || '',
      skuCode: targetSku || '',
      barcode: barcode || '',
      productId: rawId || null,
      qtyAdded: Number(qty),
      costPrice: unitCost,
      supplier: supplier || 'WOWTEK Direct Import',
      batchRef: effectiveBatch,
      createdAt: new Date(),
    });

    // 4. Fetch the updated product document to trigger backlog auto-deduction
    const updatedDoc = await db.collection('products').findOne(query);
    let resolvedProduct: Product | null = null;
    let resolvedOrders: any[] = [];
    let totalUnitsDeducted = 0;

    if (updatedDoc) {
      const { _id, ...cleanProduct } = updatedDoc as any;
      const targetProduct: Product = {
        ...cleanProduct,
        storeStock: Number(cleanProduct.storeStock ?? cleanProduct.stockStore ?? 0),
        stockStore: Number(cleanProduct.storeStock ?? cleanProduct.stockStore ?? 0),
        costPrice: Number(cleanProduct.costPrice ?? unitCost),
      };

      const resolution = await resolvePendingBacklogOrders(targetProduct, {
        mongoClient: { client, db },
      });

      resolvedProduct = resolution.product;
      resolvedOrders = resolution.resolvedOrders;
      totalUnitsDeducted = resolution.totalUnitsDeducted;
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Store stock updated successfully!',
        product: resolvedProduct || updatedDoc,
        resolvedOrders,
        totalUnitsDeducted,
        batchRef: effectiveBatch,
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
