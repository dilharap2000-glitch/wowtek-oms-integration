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

    // Uber API Token එක ලබා ගැනීම (OAuth 2.0 token management)
    const accessToken = process.env.UBER_EATS_ACCESS_TOKEN || process.env.UBER_ACCESS_TOKEN;

    if (accessToken && accessToken !== 'YOUR_UBER_ACCESS_TOKEN') {
      if (action === 'accept') {
        // OpenAPI spec එකේ ඇති පරිදි Accept Endpoint එකට Call කිරීම
        const uberResponse = await fetch(`https://api.uber.com/v1/delivery/order/${orderId}/accept`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accepted_by: 'WOWTEK OMS Admin',
            external_reference_id: orderId,
          }),
        });

        if (!uberResponse.ok) {
          const errText = await uberResponse.text();
          console.error('Uber Accept Error:', errText);
          return NextResponse.json({ error: 'Failed to accept order on Uber Eats' }, { status: 500 });
        }
      } else if (action === 'cancel') {
        // Cancel Endpoint එකට Call කිරීම (openapi spec: /v1/delivery/order/{order_id}/cancel)
        const uberResponse = await fetch(`https://api.uber.com/v1/delivery/order/${orderId}/cancel`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cancellation_reason: {
              type: 'RESTAURANT_TOO_BUSY',
              info: 'Cancelled via WOWTEK OMS',
            },
          }),
        });

        if (!uberResponse.ok) {
          const errText = await uberResponse.text();
          console.error('Uber Cancel Error:', errText);
          return NextResponse.json({ error: 'Failed to cancel order on Uber Eats' }, { status: 500 });
        }
      }
    }

    // Update local OMS order state & broadcast SSE for immediate UI responsiveness
    const now = new Date().toISOString();
    const newStatus = action === 'accept' ? 'Processing' : 'Cancelled';

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
      console.warn('[Uber Order Action Local Sync]:', syncErr?.message);
    }

    return NextResponse.json({
      success: true,
      message: `Order ${orderId} ${action}ed successfully on Uber Eats`,
    });
  } catch (error: any) {
    console.error('Order Action Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
