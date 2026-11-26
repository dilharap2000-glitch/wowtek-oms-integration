import { NextRequest, NextResponse } from 'next/server';
import { getServerStore, saveServerOrder, broadcastLiveUpdate } from '@/lib/serverStore';
import { connectToMongoDB } from '@/lib/mongodb';
import {
  executeUberOrderAction,
  isUberSandboxMode,
  type UberOrderAction,
} from '@/lib/uberClient';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const ACTION_MAP: Record<string, UberOrderAction> = {
  ACCEPT: 'ACCEPT',
  ACCEPTED: 'ACCEPT',
  READY: 'READY',
  FOOD_READY: 'READY',
  READY_FOR_PICKUP: 'READY',
  CANCEL: 'CANCEL',
  DENY: 'CANCEL',
  CANCELLED: 'CANCEL',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawAction = String(body?.action || '').trim().toUpperCase();
    const rawOrderId = body?.orderId || body?.order_id;
    const storeId = body?.storeId;
    const rawReason = body?.cancellation_reason ?? body?.reason;
    const reasonCode =
      typeof rawReason === 'string'
        ? rawReason.trim()
        : rawReason && typeof rawReason === 'object' && 'code' in rawReason
        ? String((rawReason as { code?: unknown }).code || '').trim()
        : undefined;

    if (!rawOrderId) {
      return NextResponse.json(
        { ok: false, success: false, error: 'orderId අවශ්යයි' },
        { status: 400 }
      );
    }

    const action = ACTION_MAP[rawAction];
    if (!action) {
      return NextResponse.json(
        { ok: false, success: false, error: `Invalid action: ${rawAction || body?.action}` },
        { status: 400 }
      );
    }

    const order_id = String(rawOrderId).trim();
    const cleanInputId = order_id.replace(/^UBER-/i, '');

    const isSandbox = isUberSandboxMode();

    // Resolve Uber Order UUID if a short ID was passed (never mutate an already-valid UUID)
    let uberOrderUuid = order_id;
    let mongoConn: Awaited<ReturnType<typeof connectToMongoDB>> = null;
    try {
      const serverStore = getServerStore();
      const existingLocal = serverStore.orders.find((o) => {
        const anyO = o as any;
        return (
          o.id === order_id ||
          anyO.orderId === order_id ||
          anyO.uber_order_id === order_id ||
          o.invoiceNumber === order_id ||
          o.invoiceNumber === `UBER-${cleanInputId}` ||
          anyO.display_id === order_id ||
          anyO.display_id === `UBER-${cleanInputId}`
        );
      });
      if (existingLocal && (existingLocal as any).uber_order_id) {
        uberOrderUuid = String((existingLocal as any).uber_order_id).trim();
      } else {
        mongoConn = await connectToMongoDB();
        if (mongoConn) {
          const doc = await mongoConn.db.collection('oms_orders').findOne({
            $or: [
              { uber_order_id: order_id },
              { orderId: order_id },
              { orderId: cleanInputId },
              { display_id: cleanInputId.toUpperCase() },
              { display_id: `UBER-${cleanInputId.toUpperCase()}` },
              { display_id: order_id },
              { short_display_id: cleanInputId.toUpperCase() },
            ],
          });
          if (doc?.uber_order_id) {
            uberOrderUuid = String(doc.uber_order_id).trim();
          }
        }
      }
    } catch (lookupErr) {
      console.warn('[Uber Action UUID Lookup Notice]:', lookupErr);
    }

    // Execute Uber Eats POS API call with OAuth + 401 retry
    const uberResult = await executeUberOrderAction({
      orderId: uberOrderUuid,
      action,
      reason: reasonCode,
      isSandbox,
    });

    console.log('[Uber Action Result]', {
      action,
      order_id: uberOrderUuid,
      storeId,
      url: uberResult.url,
      uberStatus: uberResult.status,
      uberData: uberResult.uberResponse,
    });

    // Uber API එකෙන් 200 / 204 නොඑනවා නම් error එක return කරන්න (false "success: true" නොයවන්න)
    if (!uberResult.ok) {
      const errorStatus =
        uberResult.status >= 400 && uberResult.status < 600 ? uberResult.status : 502;
      return NextResponse.json(
        {
          ok: false,
          success: false,
          uberStatus: uberResult.status,
          error: uberResult.error || 'Uber API rejected the action',
          details: uberResult.uberResponse,
          uberResponse: uberResult.uberResponse,
        },
        { status: errorStatus }
      );
    }

    // 4. Uber API සාර්ථක වුණාට පස්සේ DB / OMS state update කරන්න
    const now = new Date().toISOString();
    const nextStatus =
      uberResult.nextStatus ||
      (action === 'ACCEPT' ? 'ACCEPTED' : action === 'READY' ? 'READY_FOR_PICKUP' : 'CANCELLED');
    const uberStatus = uberResult.status;

    try {
      const serverStore = getServerStore();
      const matchedOrders = serverStore.orders.filter((o) => {
        const anyO = o as any;
        return (
          o.id === order_id ||
          o.id === cleanInputId ||
          o.id === uberOrderUuid ||
          o.invoiceNumber === order_id ||
          o.invoiceNumber === `UBER-${cleanInputId}` ||
          anyO.orderId === order_id ||
          anyO.orderId === cleanInputId ||
          anyO.orderId === uberOrderUuid ||
          anyO.uber_order_id === order_id ||
          anyO.uber_order_id === cleanInputId ||
          anyO.uber_order_id === uberOrderUuid
        );
      });
      for (const existing of matchedOrders) {
        existing.status = nextStatus;
        existing.updatedAt = now;
        saveServerOrder(existing);
      }

      broadcastLiveUpdate({
        type: 'order_status_updated',
        orderId: order_id,
        uber_order_id: uberOrderUuid,
        status: nextStatus,
        timestamp: now,
      });

      if (!mongoConn) {
        mongoConn = await connectToMongoDB();
      }
      if (mongoConn) {
        await mongoConn.db.collection('orders').updateMany(
          {
            $or: [
              { id: order_id },
              { id: cleanInputId },
              { id: uberOrderUuid },
              { invoiceNumber: order_id },
              { invoiceNumber: `UBER-${cleanInputId}` },
              { orderId: order_id },
              { orderId: cleanInputId },
              { orderId: uberOrderUuid },
              { uber_order_id: order_id },
              { uber_order_id: cleanInputId },
              { uber_order_id: uberOrderUuid },
            ],
          },
          { $set: { status: nextStatus, updatedAt: now } }
        );

        await mongoConn.db.collection('oms_orders').updateMany(
          {
            $or: [
              { orderId: order_id },
              { orderId: cleanInputId },
              { orderId: uberOrderUuid },
              { external_order_id: order_id },
              { uber_order_id: order_id },
              { uber_order_id: uberOrderUuid },
              { uber_order_id: cleanInputId },
              { display_id: order_id },
              { display_id: `UBER-${cleanInputId}` },
            ],
          },
          { $set: { status: nextStatus, updated_at: new Date(), updatedAt: now } }
        );

        await mongoConn.db.collection('webhook_events').updateMany(
          {
            $or: [
              { orderId: order_id },
              { orderId: cleanInputId },
              { orderId: uberOrderUuid },
              { uber_order_id: order_id },
              { uber_order_id: uberOrderUuid },
              { invoiceNumber: order_id },
            ],
          },
          { $set: { orderStatus: nextStatus } }
        );
      }
    } catch (syncErr: unknown) {
      console.warn(
        '[Order Action OMS State Sync Notice]:',
        syncErr instanceof Error ? syncErr.message : syncErr
      );
    }

    return NextResponse.json({
      ok: true,
      success: true,
      orderId: uberOrderUuid,
      action,
      message: `Order successfully ${action === 'CANCEL' ? 'cancelled' : `${action.toLowerCase()}ed`}`,
      status: nextStatus,
      nextStatus,
      uberStatus,
      uberResponse: uberResult.uberResponse,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[Uber Action Timeout]');
      return NextResponse.json(
        { ok: false, success: false, error: 'Uber API request timed out. Please try again.' },
        { status: 504 }
      );
    }
    console.error('[/api/orders/action Error]:', err);
    return NextResponse.json(
      {
        ok: false,
        success: false,
        error: err instanceof Error ? err.message : 'Internal Server Error',
      },
      { status: 500 }
    );
  }
}
