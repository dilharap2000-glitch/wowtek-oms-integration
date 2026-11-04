import { NextRequest, NextResponse } from 'next/server';
import { getServerStore, saveServerOrder, broadcastLiveUpdate } from '@/lib/serverStore';
import { connectToMongoDB } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { orderId, action, storeId } = await req.json();

    if (!orderId || !action) {
      return NextResponse.json({ error: 'Missing orderId or action' }, { status: 400 });
    }

    // Uber API Base URL from OpenAPI specs
    const baseUrl = 'https://api.uber.com';
    let endpoint = '';
    let payload: any = {};

    // Map actions to OpenAPI endpoints
    switch (action) {
      case 'accept':
        endpoint = `/v1/delivery/order/${orderId}/accept`;
        payload = {
          accepted_by: 'WOWTEK OMS Admin',
          external_reference_id: orderId,
        };
        break;
      case 'cancel':
        endpoint = `/v1/delivery/order/${orderId}/cancel`;
        payload = {
          cancellation_reason: {
            type: 'RESTAURANT_TOO_BUSY',
            info: 'Cancelled via WOWTEK OMS',
          },
        };
        break;
      case 'ready':
        endpoint = `/v1/delivery/order/${orderId}/ready`;
        payload = {};
        break;
      default:
        return NextResponse.json({ error: 'Invalid action type' }, { status: 400 });
    }

    // Call Uber Eats API
    const accessToken = process.env.UBER_ACCESS_TOKEN || process.env.UBER_EATS_ACCESS_TOKEN;
    if (accessToken && accessToken !== 'YOUR_UBER_ACCESS_TOKEN') {
      const uberResponse = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!uberResponse.ok && uberResponse.status !== 204) {
        const errText = await uberResponse.text();
        console.error(`Uber API Error (${action}):`, errText);
        return NextResponse.json({ error: `Failed to ${action} order on Uber Eats: ${errText}` }, { status: 500 });
      }
    }

    // Update local OMS order state & broadcast live update
    const now = new Date().toISOString();
    const newStatus = action === 'accept' ? 'Processing' : action === 'ready' ? 'Ready for Pickup' : 'Cancelled';

    try {
      const serverStore = getServerStore();
      const existing = serverStore.orders.find(
        (o) => o.id === orderId || o.invoiceNumber === orderId || o.id.includes(orderId) || (o as any).orderId === orderId
      );
      if (existing) {
        existing.status = newStatus;
        existing.updatedAt = now;
        saveServerOrder(existing);
      }

      broadcastLiveUpdate({
        type: 'order_status_updated',
        orderId: orderId,
        status: newStatus,
        timestamp: now,
      });

      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        await mongoConn.db.collection('orders').updateOne(
          { $or: [{ id: orderId }, { invoiceNumber: orderId }, { orderId: orderId }] },
          { $set: { status: newStatus, updatedAt: now } }
        );

        await mongoConn.db.collection('oms_orders').updateOne(
          { orderId: orderId },
          { $set: { status: newStatus, updatedAt: now } }
        );

        await mongoConn.db.collection('webhook_events').updateOne(
          { orderId: orderId },
          { $set: { orderStatus: newStatus } }
        );
      }
    } catch (syncErr: any) {
      console.warn('[Order Action Local Sync Notice]:', syncErr?.message);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Order ${orderId} successfully ${action}ed on Uber Eats` 
    });

  } catch (error: any) {
    console.error('OMS Order Action Exception:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
