import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { Supplier } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      const suppliers = await mongoConn.db.collection('suppliers').find({}).toArray();
      const clean = suppliers.map(({ _id, ...rest }) => rest as Supplier);
      return NextResponse.json({ success: true, suppliers: clean });
    }
  } catch (err: any) {
    console.warn('[Suppliers API GET] MongoDB read error:', err.message);
  }

  return NextResponse.json({ success: true, suppliers: [] });
}

export async function POST(req: NextRequest) {
  try {
    const supplier: Supplier = await req.json();
    if (!supplier || !supplier.id) {
      return NextResponse.json({ success: false, error: 'Invalid supplier payload' }, { status: 400 });
    }

    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        await mongoConn.db.collection('suppliers').updateOne(
          { id: supplier.id },
          { $set: supplier },
          { upsert: true }
        );
      }
    } catch (err: any) {
      console.warn('[Suppliers API POST] MongoDB write error:', err.message);
    }

    return NextResponse.json({ success: true, supplier });
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
        await mongoConn.db.collection('suppliers').updateOne(
          { id },
          { $set: updates }
        );
      }
    } catch (err: any) {
      console.warn('[Suppliers API PUT] MongoDB update error:', err.message);
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
        await mongoConn.db.collection('suppliers').deleteOne({ id });
      }
    } catch (err: any) {
      console.warn('[Suppliers API DELETE] MongoDB delete error:', err.message);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
