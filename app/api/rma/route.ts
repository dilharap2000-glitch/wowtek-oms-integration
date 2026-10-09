import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { DEFAULT_RMA_CLAIMS } from '@/lib/db';
import { SupplierRmaClaim } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      let claims = await mongoConn.db.collection('rma_claims').find({}).toArray();
      if (claims.length === 0) {
        await mongoConn.db.collection('rma_claims').insertMany(DEFAULT_RMA_CLAIMS);
        claims = await mongoConn.db.collection('rma_claims').find({}).toArray();
      }
      const clean = claims.map(({ _id, ...rest }) => rest as SupplierRmaClaim);
      return NextResponse.json({ success: true, rmaClaims: clean });
    }
  } catch (err: any) {
    console.warn('[RMA API GET] MongoDB read error:', err.message);
  }

  return NextResponse.json({ success: true, rmaClaims: DEFAULT_RMA_CLAIMS });
}

export async function POST(req: NextRequest) {
  try {
    const claim: SupplierRmaClaim = await req.json();
    if (!claim || !claim.id) {
      return NextResponse.json({ success: false, error: 'Invalid RMA claim payload' }, { status: 400 });
    }

    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        await mongoConn.db.collection('rma_claims').updateOne(
          { id: claim.id },
          { $set: claim },
          { upsert: true }
        );
      }
    } catch (err: any) {
      console.warn('[RMA API POST] MongoDB write error:', err.message);
    }

    return NextResponse.json({ success: true, claim });
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
        await mongoConn.db.collection('rma_claims').updateOne(
          { id },
          { $set: { ...updates, updatedAt: new Date().toISOString() } }
        );
      }
    } catch (err: any) {
      console.warn('[RMA API PUT] MongoDB update error:', err.message);
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
        await mongoConn.db.collection('rma_claims').deleteOne({ id });
      }
    } catch (err: any) {
      console.warn('[RMA API DELETE] MongoDB delete error:', err.message);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
