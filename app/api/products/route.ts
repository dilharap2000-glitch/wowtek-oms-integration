import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { SAMPLE_PRODUCTS } from '@/lib/sampleProducts';
import { Product } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      let products = await mongoConn.db.collection('products').find({}).toArray();

      // Seed initial catalog if collection is completely fresh
      if (products.length === 0) {
        await mongoConn.db.collection('products').insertMany(SAMPLE_PRODUCTS);
        products = await mongoConn.db.collection('products').find({}).toArray();
      }

      const clean = products.map(({ _id, ...rest }) => rest as Product);
      return NextResponse.json({ success: true, products: clean, source: 'mongodb' });
    }
  } catch (err: any) {
    console.warn('[Products API GET] MongoDB read error:', err.message);
  }

  return NextResponse.json({ success: true, products: SAMPLE_PRODUCTS, source: 'fallback' });
}

export async function POST(req: NextRequest) {
  try {
    const product: Product = await req.json();
    if (!product || !product.sku) {
      return NextResponse.json({ success: false, error: 'Invalid product payload' }, { status: 400 });
    }

    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        await mongoConn.db.collection('products').updateOne(
          { sku: product.sku },
          { $set: product },
          { upsert: true }
        );
      }
    } catch (err: any) {
      console.warn('[Products API POST] MongoDB write error:', err.message);
    }

    return NextResponse.json({ success: true, product });
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

    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        await mongoConn.db.collection('products').updateOne(
          { $or: [{ id }, { sku: id }] },
          { $set: updates }
        );
      }
    } catch (err: any) {
      console.warn('[Products API PUT] MongoDB update error:', err.message);
    }

    return NextResponse.json({ success: true });
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
