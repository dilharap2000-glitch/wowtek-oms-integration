import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { StoreMapping } from '@/types';
import { DEFAULT_STORE_MAPPINGS } from '@/lib/storeMappings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      const stores = await mongoConn.db.collection('store_mappings').find({}).toArray();
      if (stores && stores.length > 0) {
        const clean = stores.map(({ _id, ...rest }) => rest as StoreMapping);
        return NextResponse.json({ success: true, stores: clean, source: 'mongodb' });
      } else {
        // Seed default store mappings into MongoDB Atlas
        await mongoConn.db.collection('store_mappings').insertMany(DEFAULT_STORE_MAPPINGS as any[]);
        return NextResponse.json({ success: true, stores: DEFAULT_STORE_MAPPINGS, source: 'seeded' });
      }
    }
  } catch (err: any) {
    console.warn('[Stores API GET] MongoDB read error:', err.message);
  }

  return NextResponse.json({ success: true, stores: DEFAULT_STORE_MAPPINGS, source: 'fallback' });
}

export async function POST(req: NextRequest) {
  try {
    const store: StoreMapping = await req.json();
    if (!store || !store.externalStoreId || !store.branchName) {
      return NextResponse.json(
        { success: false, error: 'externalStoreId and branchName are required' },
        { status: 400 }
      );
    }

    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        await mongoConn.db.collection('store_mappings').updateOne(
          { id: store.id },
          { $set: { ...store, updatedAt: new Date().toISOString() } },
          { upsert: true }
        );
      }
    } catch (err: any) {
      console.warn('[Stores API POST] MongoDB write error:', err.message);
    }

    return NextResponse.json({ success: true, store });
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
        await mongoConn.db.collection('store_mappings').updateOne(
          { id },
          { $set: { ...updates, updatedAt: new Date().toISOString() } }
        );
      }
    } catch (err: any) {
      console.warn('[Stores API PUT] MongoDB write error:', err.message);
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
      return NextResponse.json({ success: false, error: 'id parameter is required' }, { status: 400 });
    }

    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        await mongoConn.db.collection('store_mappings').deleteOne({ id });
      }
    } catch (err: any) {
      console.warn('[Stores API DELETE] MongoDB write error:', err.message);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
