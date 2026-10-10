import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { getServerStore, saveServerWaybill, deleteServerWaybill } from '@/lib/serverStore';
import { TransExpressWaybill } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      const waybills = await mongoConn.db
        .collection('waybills')
        .find({})
        .sort({ bookingDate: -1 })
        .toArray();
      const clean = waybills.map(({ _id, ...rest }) => rest as TransExpressWaybill);
      return NextResponse.json({ success: true, waybills: clean });
    }
  } catch (err: any) {
    console.warn('[Waybills API GET] MongoDB read error:', err.message);
  }

  const store = getServerStore();
  return NextResponse.json({ success: true, waybills: store.waybills });
}

export async function POST(req: NextRequest) {
  try {
    const waybill: TransExpressWaybill = await req.json();
    if (!waybill || !waybill.id) {
      return NextResponse.json({ success: false, error: 'Invalid waybill payload' }, { status: 400 });
    }

    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        await mongoConn.db.collection('waybills').updateOne(
          { $or: [{ id: waybill.id }, { trackingNumber: waybill.trackingNumber }] },
          { $set: waybill },
          { upsert: true }
        );
      }
    } catch (err: any) {
      console.warn('[Waybills API POST] MongoDB write error:', err.message);
    }

    saveServerWaybill(waybill);

    return NextResponse.json({ success: true, waybill });
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
        await mongoConn.db.collection('waybills').updateOne(
          { $or: [{ id }, { trackingNumber: id }] },
          { $set: updates }
        );
      }
    } catch (err: any) {
      console.warn('[Waybills API PUT] MongoDB update error:', err.message);
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
        await mongoConn.db.collection('waybills').deleteOne({
          $or: [{ id }, { trackingNumber: id }],
        });
      }
    } catch (err: any) {
      console.warn('[Waybills API DELETE] MongoDB delete error:', err.message);
    }

    deleteServerWaybill(id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
