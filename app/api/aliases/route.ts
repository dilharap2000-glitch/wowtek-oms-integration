import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { DEFAULT_PRODUCT_ALIASES } from '@/lib/productMatching';
import { ProductAlias } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      const docs = await mongoConn.db.collection('product_aliases').find({}).toArray();
      if (docs && docs.length > 0) {
        const clean = docs.map(({ _id, ...rest }) => rest as ProductAlias);
        return NextResponse.json({ success: true, aliases: clean, source: 'mongodb' });
      }
    }
  } catch (err: any) {
    console.warn('[Aliases API GET] Mongo error:', err.message);
  }

  return NextResponse.json({
    success: true,
    aliases: DEFAULT_PRODUCT_ALIASES,
    source: 'defaults',
  });
}

export async function POST(req: NextRequest) {
  try {
    const body: Partial<ProductAlias> = await req.json();
    if (!body || !body.externalTitle || !body.targetSku) {
      return NextResponse.json(
        { success: false, error: 'externalTitle and targetSku are required' },
        { status: 400 }
      );
    }

    const alias: ProductAlias = {
      id: body.id || `alias-${Date.now().toString().slice(-4)}`,
      channel: body.channel || 'all',
      externalTitle: body.externalTitle.trim(),
      targetSku: body.targetSku.trim().toUpperCase(),
      targetProductName: body.targetProductName?.trim() || '',
      notes: body.notes?.trim() || '',
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        await mongoConn.db.collection('product_aliases').updateOne(
          { $or: [{ id: alias.id }, { externalTitle: alias.externalTitle, channel: alias.channel }] },
          { $set: alias },
          { upsert: true }
        );
      }
    } catch (err: any) {
      console.warn('[Aliases API POST] Mongo write error:', err.message);
    }

    return NextResponse.json({ success: true, alias });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'id parameter is required' }, { status: 400 });
    }

    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        await mongoConn.db.collection('product_aliases').deleteOne({ id });
      }
    } catch (err: any) {
      console.warn('[Aliases API DELETE] Mongo error:', err.message);
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
