import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { WarrantyRecord } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      const warranties = await mongoConn.db
        .collection('warranties')
        .find({})
        .sort({ registrationDate: -1 })
        .toArray();
      const clean = warranties.map(({ _id, ...rest }) => rest as WarrantyRecord);
      return NextResponse.json({ success: true, warranties: clean });
    }
  } catch (err: any) {
    console.warn('[Warranties API GET] MongoDB read error:', err.message);
  }

  return NextResponse.json({ success: true, warranties: [] });
}

export async function POST(req: NextRequest) {
  try {
    const warranty: WarrantyRecord = await req.json();
    if (!warranty || !warranty.id) {
      return NextResponse.json({ success: false, error: 'Invalid warranty payload' }, { status: 400 });
    }

    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        await mongoConn.db.collection('warranties').updateOne(
          { id: warranty.id },
          { $set: warranty },
          { upsert: true }
        );
      }
    } catch (err: any) {
      console.warn('[Warranties API POST] MongoDB write error:', err.message);
    }

    return NextResponse.json({ success: true, warranty });
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
        await mongoConn.db.collection('warranties').updateOne(
          { id },
          { $set: updates }
        );
      }
    } catch (err: any) {
      console.warn('[Warranties API PUT] MongoDB update error:', err.message);
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
        await mongoConn.db.collection('warranties').deleteOne({ id });
      }
    } catch (err: any) {
      console.warn('[Warranties API DELETE] MongoDB delete error:', err.message);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
