import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sku, serialNumber, newStatus, reason } = body;

    if (!serialNumber || !newStatus) {
      return NextResponse.json({ success: false, error: 'serialNumber and newStatus are required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const query: any = {
      'activeSerials.serialNumber': { $regex: new RegExp(`^${serialNumber.trim()}$`, 'i') },
    };
    if (sku) {
      query.$or = [{ sku }, { skuCode: sku }, { barcode: sku }];
    }

    const product = await db.collection<any>('products').findOne(query);
    if (!product) {
      return NextResponse.json({ success: false, error: 'Product or Serial Number not found' }, { status: 404 });
    }

    const existingUnit = (product.activeSerials || []).find(
      (u: any) => (u.serialNumber || '').toLowerCase() === serialNumber.trim().toLowerCase()
    );
    const prevStatus = existingUnit?.status;

    let stockInc = 0;
    if (newStatus === 'Missing' && (prevStatus === 'Available' || prevStatus === 'In-Stock')) {
      stockInc = -1;
    } else if (newStatus === 'Available' && prevStatus === 'Missing') {
      stockInc = 1;
    }

    const updateDoc: any = {
      $set: {
        'activeSerials.$[elem].status': newStatus,
        'activeSerials.$[elem].updatedAt': new Date().toISOString(),
      },
    };

    if (newStatus === 'Missing') {
      updateDoc.$set['activeSerials.$[elem].discrepancyReason'] = reason || 'Flagged missing during physical count audit';
      updateDoc.$set['activeSerials.$[elem].reportedMissingAt'] = new Date().toISOString();
    } else if (newStatus === 'Available') {
      updateDoc.$unset = {
        'activeSerials.$[elem].discrepancyReason': '',
        'activeSerials.$[elem].reportedMissingAt': '',
      };
    }

    if (stockInc !== 0) {
      updateDoc.$inc = { storeStock: stockInc, stockQuantity: stockInc };
    }

    await db.collection('products').updateOne(
      { _id: product._id },
      updateDoc,
      { arrayFilters: [{ 'elem.serialNumber': { $regex: new RegExp(`^${serialNumber.trim()}$`, 'i') } }] }
    );

    return NextResponse.json({
      success: true,
      message: `Serial ${serialNumber} status updated to ${newStatus}${stockInc !== 0 ? ` (Store Stock: ${stockInc > 0 ? '+1' : '-1'})` : ''}`,
    });
  } catch (error: any) {
    console.error('[Inventory Audit API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
