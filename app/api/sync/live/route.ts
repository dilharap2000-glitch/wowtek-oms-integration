import { NextRequest, NextResponse } from 'next/server';
import { getServerStore, saveServerOrder, clearServerWebhookEvents } from '@/lib/serverStore';
import { connectToMongoDB, isMongoConfigured } from '@/lib/mongodb';
import { Order, TransExpressWaybill, WebhookEvent, StoreMapping, Product } from '@/types';
import { DEFAULT_STORE_MAPPINGS } from '@/lib/storeMappings';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store',
};

/**
 * GET /api/sync/live
 * Fast live synchronization endpoint used by client-side dashboard polling.
 * Connects directly to MongoDB Atlas as primary source of truth,
 * and avoids returning stale process-local orders when Atlas is configured but unavailable.
 */
export async function GET() {
  const store = getServerStore();
  const mongoConfigured = isMongoConfigured();
  let atlasConnected = false;
  let mongoDbName = '';
  let atlasOrders: Order[] = [];
  let atlasWaybills: TransExpressWaybill[] = [];
  let atlasEvents: WebhookEvent[] = [];
  let atlasStores: StoreMapping[] = [];
  let atlasProducts: Product[] = [];

  try {
    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      atlasConnected = true;
      mongoDbName = mongoConn.db.databaseName;

      // Query live collections directly from MongoDB Atlas
      const [orderDocs, waybillDocs, eventDocs, storeDocs, productDocs] = await Promise.all([
        mongoConn.db
          .collection('orders')
          .find({})
          .sort({ createdAt: -1, _id: -1 })
          .limit(100)
          .toArray(),
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
          .sort({ receivedAt: -1, _id: -1 })
          .limit(50)
          .toArray()
          .catch(() => []),
        mongoConn.db
          .collection('store_mappings')
          .find({})
          .toArray()
          .catch(() => []),
        mongoConn.db
          .collection('products')
          .find({})
          .toArray()
          .catch(() => []),
      ]);

      atlasOrders = orderDocs.map(({ _id, ...rest }) => ({
        ...rest,
        _id: _id.toString(),
        id: (rest as Partial<Order>).id || _id.toString(),
      })) as unknown as Order[];
      atlasWaybills = waybillDocs.map(({ _id, ...rest }) => ({
        ...rest,
        id: (rest as Partial<TransExpressWaybill>).id || _id.toString(),
      })) as TransExpressWaybill[];
      atlasEvents = eventDocs.map(({ _id, ...rest }) => ({
        ...rest,
        _id: _id.toString(),
        id: (rest as Partial<WebhookEvent>).id || _id.toString(),
      })) as unknown as WebhookEvent[];
      if (storeDocs && storeDocs.length > 0) {
        atlasStores = storeDocs.map(({ _id, ...rest }) => ({
          ...rest,
          id: (rest as Partial<StoreMapping>).id || _id.toString(),
        })) as StoreMapping[];
      }
      if (productDocs && productDocs.length > 0) {
        atlasProducts = productDocs.map(({ _id, ...rest }) => ({
          ...rest,
          id: (rest as Partial<Product>).id || _id.toString(),
        })) as Product[];
      }
    }
  } catch (err) {
    console.error('[Sync Live GET Error]:', err);
    atlasConnected = false;
  }

  // If MongoDB Atlas is configured but unavailable, do NOT return stale process-local memory pretending to be synced
  const shouldUseLocalFallback = !atlasConnected && !mongoConfigured;
  const finalOrders = atlasConnected ? atlasOrders : shouldUseLocalFallback ? store.orders : null;
  const finalWaybills = atlasConnected ? atlasWaybills : shouldUseLocalFallback ? store.waybills : null;
  const finalEvents = atlasConnected ? atlasEvents : shouldUseLocalFallback ? store.webhookEvents : null;
  const finalStores = atlasStores.length > 0 ? atlasStores : DEFAULT_STORE_MAPPINGS;

  return NextResponse.json(
    {
      success: atlasConnected || shouldUseLocalFallback,
      dbStatus: atlasConnected ? 'connected' : mongoConfigured ? 'offline' : 'fallback',
      databaseEngine: atlasConnected
        ? 'MongoDB Atlas Connected (Live)'
        : mongoConfigured
        ? 'MongoDB Atlas Temporarily Unavailable'
        : 'Mock DB Fallback (Offline)',
      databaseName: mongoDbName || (atlasConnected ? 'wowtek_pro' : 'in-memory'),
      orders: finalOrders,
      waybills: finalWaybills,
      webhookEvents: finalEvents,
      stores: finalStores,
      products: atlasProducts,
      lastUpdated: store.lastUpdated,
      listenerActive: true,
      timestamp: new Date().toISOString(),
    },
    {
      status: !atlasConnected && mongoConfigured ? 503 : 200,
      headers: NO_CACHE_HEADERS,
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
