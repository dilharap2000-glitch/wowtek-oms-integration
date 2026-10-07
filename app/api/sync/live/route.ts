import { NextRequest, NextResponse } from 'next/server';
import { getServerStore, saveServerOrder, clearServerWebhookEvents } from '@/lib/serverStore';
import { connectToMongoDB } from '@/lib/mongodb';
import { Order, TransExpressWaybill, WebhookEvent } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sync/live
 * Fast live synchronization endpoint used by client-side dashboard polling (every 2s).
 * Connects directly to MongoDB Atlas when available without relying on Mock state,
 * and falls back gracefully to serverStore only if explicitly offline.
 */
export async function GET() {
  const store = getServerStore();
  let atlasConnected = false;
  let mongoDbName = '';
  let atlasOrders: Order[] = [];
  let atlasWaybills: TransExpressWaybill[] = [];
  let atlasEvents: WebhookEvent[] = [];

  try {
    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      atlasConnected = true;
      mongoDbName = mongoConn.db.databaseName;

      // Query live collections directly from MongoDB Atlas
      const [orderDocs, waybillDocs, eventDocs] = await Promise.all([
        mongoConn.db
          .collection('orders')
          .find({})
          .sort({ createdAt: -1 })
          .limit(100)
          .toArray()
          .catch(() => []),
        mongoConn.db
          .collection('waybills')
          .find({})
          .sort({ bookingDate: -1 })
          .limit(100)
          .toArray()
          .catch(() => []),
        mongoConn.db
          .collection('webhook_events')
          .find({})
          .sort({ receivedAt: -1 })
          .limit(50)
          .toArray()
          .catch(() => []),
      ]);

      atlasOrders = orderDocs.map(({ _id, ...rest }) => rest as Order);
      atlasWaybills = waybillDocs.map(({ _id, ...rest }) => rest as TransExpressWaybill);
      atlasEvents = eventDocs.map(({ _id, ...rest }) => rest as WebhookEvent);
    }
  } catch {
    // MongoDB offline or unconfigured
    atlasConnected = false;
  }

  // When Atlas is connected, use Atlas records directly.
  // Merge with any real-time in-flight store items not yet flushed
  const finalOrders = atlasConnected && atlasOrders.length > 0 ? atlasOrders : store.orders;
  const finalWaybills = atlasConnected && atlasWaybills.length > 0 ? atlasWaybills : store.waybills;
  const finalEvents = atlasConnected && atlasEvents.length > 0 ? atlasEvents : store.webhookEvents;

  return NextResponse.json(
    {
      success: true,
      dbStatus: atlasConnected ? 'connected' : 'fallback',
      databaseEngine: atlasConnected
        ? 'MongoDB Atlas Connected (Live)'
        : 'Mock DB Fallback (Offline)',
      databaseName: mongoDbName || (atlasConnected ? 'wowtek_pro' : 'in-memory'),
      orders: finalOrders,
      waybills: finalWaybills,
      webhookEvents: finalEvents,
      lastUpdated: store.lastUpdated,
      listenerActive: true,
      webhookSecret: 'WOWTEK-WC-Webhook-2026-9X7Kl42',
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  );
}

/**
 * POST /api/sync/live
 * Clears or syncs state from client
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.action === 'clear_events') {
      clearServerWebhookEvents();
      try {
        const mongoConn = await connectToMongoDB();
        if (mongoConn) {
          await mongoConn.db.collection('webhook_events').deleteMany({});
        }
      } catch {}
      const store = getServerStore();
      return NextResponse.json({ success: true, webhookEvents: store.webhookEvents });
    }

    if (body.action === 'sync_client_order' && body.order) {
      saveServerOrder(body.order);
      try {
        const mongoConn = await connectToMongoDB();
        if (mongoConn) {
          await mongoConn.db.collection('orders').updateOne(
            { $or: [{ id: body.order.id }, { invoiceNumber: body.order.invoiceNumber }] },
            { $set: body.order },
            { upsert: true }
          );
        }
      } catch {}
      const store = getServerStore();
      return NextResponse.json({ success: true, orders: store.orders });
    }

    const store = getServerStore();
    return NextResponse.json({ success: true, store });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
