import { NextRequest, NextResponse } from 'next/server';
import { getServerStore, saveServerOrder, broadcastLiveUpdate } from '@/lib/serverStore';
import { connectToMongoDB } from '@/lib/mongodb';

export const maxDuration = 30; // Max 30 seconds
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action;
    const order_id = body.order_id || body.orderId;
    const cancellation_reason = body.cancellation_reason;

    if (!order_id || !action) {
      return NextResponse.json({ error: 'Missing order_id or action' }, { status: 400 });
    }

    let rawInputId = String(order_id).trim();
    if (rawInputId.startsWith('UBER-')) {
      rawInputId = rawInputId.replace('UBER-', '');
    }
    let cleanInputId = rawInputId;
    if (rawInputId.toLowerCase().startsWith('c') && rawInputId.length > 5) {
      cleanInputId = rawInputId.substring(1);
    }

    let uberOriginalId = cleanInputId;
    try {
      const serverStore = getServerStore();
      const existing = serverStore.orders.find(
        (o) => o.id === order_id || o.id === cleanInputId || o.invoiceNumber === order_id || o.invoiceNumber === `UBER-${cleanInputId}` || (o as any).display_id === `UBER-${cleanInputId}` || (o as any).uber_order_id === cleanInputId
      );
      if (existing && (existing as any).uber_order_id) {
        uberOriginalId = (existing as any).uber_order_id;
      } else {
        const mongoConn = await connectToMongoDB();
        if (mongoConn) {
          const doc = await mongoConn.db.collection('oms_orders').findOne({
            $or: [
              { uber_order_id: cleanInputId },
              { uber_order_id: rawInputId },
              { uber_order_id: order_id },
              { display_id: `UBER-${cleanInputId}` },
              { display_id: order_id },
              { orderId: cleanInputId },
              { orderId: order_id },
            ]
          });
          if (doc?.uber_order_id) {
            uberOriginalId = doc.uber_order_id;
          }
        }
      }
    } catch {}

    let endpoint = '';
    let payload: any = {};

    // Map actions to Uber API Endpoints using raw uberOriginalId
    switch (action) {
      case 'accept':
        endpoint = `/v1/delivery/order/${uberOriginalId}/accept`;
        break;
      case 'ready':
        endpoint = `/v1/delivery/order/${uberOriginalId}/ready`;
        break;
      case 'cancel':
        endpoint = `/v1/delivery/order/${uberOriginalId}/cancel`;
        payload = {
          cancellation_reason: cancellation_reason || {
            type: 'RESTAURANT_TOO_BUSY',
            info: 'Cancelled via WOWTEK OMS',
          },
        };
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const baseUrl = process.env.UBER_BASE_URL || 'https://api.uber.com';
    const accessToken = process.env.UBER_ACCESS_TOKEN || process.env.UBER_EATS_ACCESS_TOKEN;

    // Only dispatch to live Uber API if token is configured
    if (accessToken && accessToken !== 'YOUR_UBER_ACCESS_TOKEN') {
      // Setup AbortController to timeout after 8 seconds if Uber doesn't respond
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const uberResponse = await fetch(`${baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!uberResponse.ok && uberResponse.status !== 204) {
          const errorText = await uberResponse.text();
          console.error(`Uber API Error [${action}]:`, errorText);
          return NextResponse.json({ error: `Uber API failed: ${errorText}` }, { status: uberResponse.status });
        }
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          console.error('Uber API Request Timed Out');
          return NextResponse.json({ error: 'Uber API request timed out. Please try again.' }, { status: 504 });
        }
        throw fetchErr;
      }
    }

    // Sync state locally in OMS & broadcast live update
    const now = new Date().toISOString();
    const newStatus = action === 'accept' ? 'Processing' : action === 'ready' ? 'Ready for Pickup' : 'Cancelled';

    try {
      const serverStore = getServerStore();
      const existing = serverStore.orders.find(
        (o) => o.id === order_id || o.invoiceNumber === order_id || o.id.includes(order_id) || (o as any).orderId === order_id
      );
      if (existing) {
        existing.status = newStatus;
        existing.updatedAt = now;
        saveServerOrder(existing);
      }

      broadcastLiveUpdate({
        type: 'order_status_updated',
        orderId: order_id,
        status: newStatus,
        timestamp: now,
      });

      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        await mongoConn.db.collection('orders').updateOne(
          { $or: [{ id: order_id }, { invoiceNumber: order_id }, { invoiceNumber: `UBER-${cleanInputId}` }, { orderId: order_id }, { orderId: cleanInputId }] },
          { $set: { status: newStatus, updatedAt: now } }
        );

        await mongoConn.db.collection('oms_orders').updateOne(
          { $or: [{ orderId: order_id }, { orderId: cleanInputId }, { external_order_id: order_id }, { uber_order_id: uberOriginalId }, { uber_order_id: cleanInputId }, { display_id: order_id }, { display_id: `UBER-${cleanInputId}` }] },
          { $set: { status: newStatus, updated_at: new Date() } }
        );

        await mongoConn.db.collection('webhook_events').updateOne(
          { $or: [{ orderId: order_id }, { orderId: cleanInputId }, { invoiceNumber: order_id }] },
          { $set: { orderStatus: newStatus } }
        );
      }
    } catch (syncErr: any) {
      console.warn('[Order Action OMS State Sync Notice]:', syncErr?.message);
    }

    return NextResponse.json({ success: true, message: `Order successfully ${action}ed` });

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('Uber API Request Timed Out');
      return NextResponse.json({ error: 'Uber API request timed out. Please try again.' }, { status: 504 });
    }
    console.error('Action Handler Exception:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
