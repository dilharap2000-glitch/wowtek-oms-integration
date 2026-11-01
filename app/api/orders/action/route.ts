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

    // Uber Eats Developer API Endpoints (Sandbox/Production)
    // action එක 'accept' නම් හෝ 'cancel' නම් අදාළ endpoint එක තෝරා ගැනීම
    const UBER_API_BASE = process.env.UBER_API_BASE_URL || 'https://api.uber.com/v1/eats';
    let endpoint = '';
    let bodyPayload: any = null;

    if (action === 'accept') {
      endpoint = `${UBER_API_BASE}/stores/${storeId || 'default'}/orders/${orderId}/accept`;
    } else if (action === 'cancel') {
      endpoint = `${UBER_API_BASE}/stores/${storeId || 'default'}/orders/${orderId}/cancel`;
      bodyPayload = { reason: 'Accepted via WOWTEK OMS Dashboard' };
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Uber API Access Token එක ලබා ගැනීම (환경변වල් වලින් හෝ database එකෙන්)
    const accessToken = process.env.UBER_EATS_ACCESS_TOKEN;

    if (accessToken) {
      const uberResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: bodyPayload ? JSON.stringify(bodyPayload) : undefined,
      });

      if (!uberResponse.ok) {
        const errorText = await uberResponse.text();
        return NextResponse.json({ error: `Uber API Error: ${errorText}` }, { status: uberResponse.status });
      }
    }

    // Update local OMS order status so dashboard reflects changes instantly
    try {
      const serverStore = getServerStore();
      const existing = serverStore.orders.find(
        (o) => o.id === orderId || o.invoiceNumber === orderId || o.id.includes(orderId)
      );
      if (existing) {
        existing.status = action === 'accept' ? 'Processing' : 'Cancelled';
        existing.updatedAt = new Date().toISOString();
        saveServerOrder(existing);
        broadcastLiveUpdate({
          type: 'order_status_updated',
          orderId: existing.id,
          status: existing.status,
          timestamp: existing.updatedAt,
        });
      }

      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        await mongoConn.db.collection('orders').updateOne(
          { $or: [{ id: orderId }, { invoiceNumber: orderId }] },
          { $set: { status: action === 'accept' ? 'Processing' : 'Cancelled', updatedAt: new Date().toISOString() } }
        );
      }
    } catch (dbErr: any) {
      console.warn('[Order Action] OMS Local State Sync Notice:', dbErr?.message);
    }

    return NextResponse.json({ success: true, message: `Order successfully ${action}ed` });
  } catch (error: any) {
    console.error('Order Action Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
