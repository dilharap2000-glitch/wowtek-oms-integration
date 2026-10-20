import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('[GRN API] Incoming Request Body:', body);

    const {
      id,
      productId,
      sku,
      skuCode,
      barcode,
      restockQty,
      costPrice,
      supplier,
      batchRef,
    } = body;

    // 1. Clean and trim the identifier
    const rawId = id || productId;
    const rawSku = sku || skuCode || barcode;
    const searchIdentifier = String(rawId || rawSku || '').trim();

    if (!searchIdentifier) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing product identifier. Please provide an id, productId, or sku.',
        },
        { status: 400 }
      );
    }

    const targetQty = Number(restockQty);
    if (isNaN(targetQty) || targetQty <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid restock quantity. Must be a positive number.',
        },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // 2. Check if searchIdentifier is a valid MongoDB ObjectId
    let isObjectId = false;
    let objectIdInstance: ObjectId | null = null;
    try {
      if (
        typeof searchIdentifier === 'string' &&
        /^[0-9a-fA-F]{24}$/.test(searchIdentifier) &&
        ObjectId.isValid(searchIdentifier)
      ) {
        objectIdInstance = new ObjectId(searchIdentifier);
        isObjectId = true;
      }
    } catch {
      isObjectId = false;
      objectIdInstance = null;
    }

    // 3. Build flexible MongoDB search query using $or
    const orConditions: any[] = [
      { sku: searchIdentifier },
      { skuCode: searchIdentifier },
      { barcode: searchIdentifier },
      { _id: searchIdentifier },
      { id: searchIdentifier },
    ];

    if (isObjectId && objectIdInstance) {
      orConditions.unshift({ _id: objectIdInstance });
    }

    // If both explicit SKU and ID are provided, include both in $or
    const cleanSku = String(sku || skuCode || '').trim();
    if (cleanSku && cleanSku !== searchIdentifier) {
      orConditions.push(
        { sku: cleanSku },
        { skuCode: cleanSku },
        { sku: cleanSku.toUpperCase() },
        { sku: cleanSku.toLowerCase() }
      );
      if (!isNaN(Number(cleanSku))) {
        orConditions.push({ sku: Number(cleanSku) }, { skuCode: Number(cleanSku) });
      }
    }

    const cleanId = String(id || productId || '').trim();
    if (cleanId && cleanId !== searchIdentifier) {
      if (/^[0-9a-fA-F]{24}$/.test(cleanId) && ObjectId.isValid(cleanId)) {
        try {
          orConditions.unshift({ _id: new ObjectId(cleanId) });
        } catch {}
      }
      orConditions.push({ _id: cleanId }, { id: cleanId });
    }

    if (barcode && String(barcode).trim() !== searchIdentifier) {
      orConditions.push({ barcode: String(barcode).trim() });
    }

    const searchQuery = { $or: orConditions };
    console.log('[GRN API] Executing Query:', JSON.stringify(searchQuery));

    // Check if product exists before updating
    const existingProduct = await db.collection('products').findOne(searchQuery);
    console.log('[GRN API] Matched Product:', existingProduct ? existingProduct.sku || existingProduct._id : 'None');

    if (!existingProduct) {
      return NextResponse.json(
        {
          success: false,
          message: `Product not found with identifier: "${searchIdentifier}". Please verify the SKU or ID exists in your database.`,
        },
        { status: 404 }
      );
    }

    const unitCost = Number(costPrice) >= 0 ? Number(costPrice) : Number(existingProduct.costPrice || 0);
    const assignedSupplier = supplier || existingProduct.supplier || 'WOWTEK Direct Import';
    const effectiveBatch = batchRef || `GRN-${Date.now()}`;

    // 4. Update MongoDB document: increment storeStock & stockQuantity, set restock metadata
    const updateResult = await db.collection('products').updateOne(
      { _id: existingProduct._id },
      {
        $inc: {
          storeStock: targetQty,
          stockStore: targetQty,
          stockQuantity: targetQty,
        },
        $set: {
          costPrice: unitCost,
          supplier: assignedSupplier,
          lastRestockedAt: new Date(),
          lastBatchRef: effectiveBatch,
          updatedAt: new Date().toISOString(),
        },
      }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Failed to update product ${searchIdentifier}. Matched count is 0.`,
        },
        { status: 404 }
      );
    }

    // 5. Insert historical GRN audit log
    try {
      await db.collection('grns').insertOne({
        productId: existingProduct._id,
        sku: existingProduct.sku || cleanSku || searchIdentifier,
        skuCode: existingProduct.skuCode || cleanSku || searchIdentifier,
        qtyAdded: targetQty,
        costPrice: unitCost,
        supplier: assignedSupplier,
        batchRef: effectiveBatch,
        createdAt: new Date(),
      });
    } catch (auditErr) {
      console.warn('[GRN API] Audit log insertion skipped:', auditErr);
    }

    // Fetch the updated document to send back to client
    const updatedProduct = await db.collection('products').findOne({ _id: existingProduct._id });

    return NextResponse.json(
      {
        success: true,
        message: 'Store stock updated successfully!',
        product: updatedProduct,
        storeStock: updatedProduct?.storeStock ?? updatedProduct?.stockQuantity,
        batchRef: effectiveBatch,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[GRN API] Unhandled Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal Server Error',
        message: error.message || 'Failed to process GRN Restock on server.',
      },
      { status: 500 }
    );
  }
}
