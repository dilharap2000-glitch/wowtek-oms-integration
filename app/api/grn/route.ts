import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('GRN Incoming Body:', body);

    // Frontend එකෙන් එන්න පුළුවන් id, productId, හෝ sku කියන හැම එකක්ම ගන්නවා
    const { id, productId, sku, restockQty, costPrice, supplier, batchRef } = body;

    const { db } = await connectToDatabase();

    const searchIdentifier = String(id || productId || sku || body.skuCode || body.barcode || '').trim();

    if (!searchIdentifier) {
      return NextResponse.json(
        { success: false, message: 'No SKU or Product ID provided' },
        { status: 400 }
      );
    }

    // 1. searchIdentifier එක valid MongoDB ObjectId එකක්ද කියලා බලනවා
    let isObjectId = false;
    try {
      isObjectId = ObjectId.isValid(searchIdentifier) && new ObjectId(searchIdentifier).toString() === searchIdentifier;
    } catch {
      isObjectId = false;
    }

    // 2. ID එකෙන්, SKU එකෙන්, skuCode එකෙන්, barcode එකෙන් කියන ඕනෑම එකකින් match වෙන query එකක් සදනවා
    const orConditions: any[] = [
      { sku: searchIdentifier },
      { skuCode: searchIdentifier },
      { barcode: searchIdentifier },
      ...(isObjectId ? [{ _id: new ObjectId(searchIdentifier) }] : []),
      { _id: searchIdentifier },
      { id: searchIdentifier }
    ];

    const explicitSku = String(sku || body.skuCode || '').trim();
    if (explicitSku && explicitSku !== searchIdentifier) {
      orConditions.push({ sku: explicitSku }, { skuCode: explicitSku });
    }

    const explicitId = String(id || productId || '').trim();
    if (explicitId && explicitId !== searchIdentifier) {
      if (ObjectId.isValid(explicitId)) {
        try {
          orConditions.push({ _id: new ObjectId(explicitId) });
        } catch {}
      }
      orConditions.push({ _id: explicitId }, { id: explicitId });
    }

    const searchQuery: any = { $or: orConditions };

    const targetQty = Number(restockQty) || 0;

    // 3. Database එකේ Update එක සිදු කිරීම (Warehouse අයින් කර Store Stock පමණක් update වේ)
    const updateResult = await db.collection('products').updateOne(
      searchQuery,
      {
        $inc: { 
          storeStock: targetQty,
          stockStore: targetQty,
          // DB එකේ පැරණි field නම stock/quantity ලෙස තිබුණත් එයද sync කිරීමට:
          stockQuantity: targetQty 
        },
        $set: {
          costPrice: Number(costPrice) || 0,
          supplier: supplier,
          lastRestockedAt: new Date(),
          lastBatchRef: batchRef
        }
      }
    );

    // Matching Product එකක් නැතිනම් error නොදී flexible එකක් return කරනවා
    if (updateResult.matchedCount === 0) {
      console.warn(`[GRN API] Product ${searchIdentifier} not found with query:`, JSON.stringify(searchQuery));
      return NextResponse.json(
        { success: false, message: `Product ${searchIdentifier} not found` }, 
        { status: 404 }
      );
    }

    // (Optional) GRN History එක සේව් කර තබා ගැනීම
    try {
      await db.collection('grns').insertOne({
        identifier: searchIdentifier,
        sku: explicitSku || searchIdentifier,
        qtyAdded: targetQty,
        costPrice: Number(costPrice) || 0,
        supplier,
        batchRef,
        createdAt: new Date()
      });
    } catch (logErr) {
      console.warn('Could not insert to grns collection:', logErr);
    }

    // Fetch updated product to return for reactive state updates
    const updatedProduct = await db.collection('products').findOne(searchQuery);

    return NextResponse.json({ 
      success: true, 
      message: 'Store stock updated successfully!',
      product: updatedProduct
    }, { status: 200 });

  } catch (error: any) {
    console.error('GRN Processing Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
