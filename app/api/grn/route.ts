import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('GRN Incoming Body:', body); // Terminal එකේ බලන්න Incoming Data මොනවාද කියලා

    const { sku, restockQty, costPrice, supplier, batchRef, productId } = body;
    const { db } = await connectToDatabase();

    const cleanSku = String(sku || body.skuCode || body.barcode || '').trim();

    // 1. කලින්ම Product එක DB එකේ තියෙනවාද කියලා Search කරලා Log කරමු
    const orConditions: any[] = [
      { sku: cleanSku },
      { skuCode: cleanSku },
      { barcode: cleanSku },
      { sku: Number(cleanSku) || -1 }
    ];

    if (productId && typeof productId === 'string' && /^[0-9a-fA-F]{24}$/.test(productId)) {
      orConditions.unshift({ _id: new ObjectId(productId) });
    }

    const existingProduct = await db.collection('products').findOne({
      $or: orConditions
    });

    console.log('Matched Product in DB:', existingProduct);

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, message: `Product ${cleanSku} not found in database` }, 
        { status: 404 }
      );
    }

    // 2. Product එක හමු වුණා නම් Store Stock එක Update කිරීම
    await db.collection('products').updateOne(
      { _id: existingProduct._id },
      {
        $inc: { 
          storeStock: Number(restockQty),
          stockStore: Number(restockQty)
        },
        $set: {
          costPrice: Number(costPrice),
          supplier: supplier,
          lastRestockedAt: new Date(),
          lastBatchRef: batchRef
        }
      }
    );

    // (Optional) GRN Inward Receipt history to 'grns' collection
    try {
      await db.collection('grns').insertOne({
        sku: cleanSku,
        qtyAdded: Number(restockQty),
        costPrice: Number(costPrice),
        supplier,
        batchRef,
        createdAt: new Date()
      });
    } catch (logErr) {
      console.warn('Could not insert to grns collection:', logErr);
    }

    const updatedProduct = await db.collection('products').findOne({ _id: existingProduct._id });

    return NextResponse.json({ 
      success: true, 
      message: 'Store stock updated successfully!',
      product: updatedProduct || existingProduct
    }, { status: 200 });

  } catch (error) {
    console.error('GRN Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
