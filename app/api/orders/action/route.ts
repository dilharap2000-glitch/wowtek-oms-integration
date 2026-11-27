import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import {
  getServerStore,
  saveServerOrder,
  saveServerWebhookEvent,
  broadcastLiveUpdate,
} from '@/lib/serverStore';
import { connectToMongoDB } from '@/lib/mongodb';
import {
  executeUberOrderAction,
  isUberSandboxMode,
  type UberOrderAction,
} from '@/lib/uberClient';
import type { OrderStatus } from '@/types';

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

const NEXT_STATUS_MAP: Record<UberOrderAction, OrderStatus> = {
  ACCEPT: 'ACCEPTED',
  READY: 'READY_FOR_PICKUP',
  CANCEL: 'CANCELLED',
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

    const order_id = String(rawOrderId).replace(/^#/, '').trim();
    const cleanInputId = order_id.replace(/^UBER-/i, '');
    const validObjectId = ObjectId.isValid(order_id) ? new ObjectId(order_id) : null;

    const isSandbox = isUberSandboxMode();

    // Resolve Uber Order UUID if a short ID, displayId, or Mongo _id was passed
    let uberOrderUuid = order_id;
    let mongoConn: Awaited<ReturnType<typeof connectToMongoDB>> = null;
    try {
      const serverStore = getServerStore();
      const existingLocal = serverStore.orders.find((o) => {
        const anyO = o as any;
        return (
          o.id === order_id ||
          anyO.orderId === order_id ||
          anyO.uberOrderId === order_id ||
          anyO.uber_order_id === order_id ||
          anyO.orderNumber === order_id ||
          anyO.displayId === order_id ||
          o.invoiceNumber === order_id ||
          o.invoiceNumber === `UBER-${cleanInputId}` ||
          anyO.display_id === order_id ||
          anyO.display_id === `UBER-${cleanInputId}`
        );
      });
      if (existingLocal) {
        const anyLocal = existingLocal as any;
        const localUuid =
          anyLocal.uberOrderId ||
          anyLocal.uber_order_id ||
          (typeof anyLocal.orderId === 'string' && anyLocal.orderId.length >= 20
            ? anyLocal.orderId
            : '');
        if (localUuid) {
          uberOrderUuid = String(localUuid).trim();
        }
      }

      if (uberOrderUuid === order_id || uberOrderUuid.length < 20) {
        mongoConn = await connectToMongoDB();
        if (mongoConn) {
          const lookupQuery: Record<string, unknown> = {
            $or: [
              ...(validObjectId ? [{ _id: validObjectId }] : []),
              { uberOrderId: order_id },
              { uber_order_id: order_id },
              { orderId: order_id },
              { orderId: cleanInputId },
              { order_id: order_id },
              { orderNumber: order_id },
              { orderNumber: `#${order_id}` },
              { displayId: order_id },
              { displayId: cleanInputId.toUpperCase() },
              { display_id: cleanInputId.toUpperCase() },
              { display_id: `UBER-${cleanInputId.toUpperCase()}` },
              { display_id: order_id },
              { short_display_id: cleanInputId.toUpperCase() },
              { invoiceNumber: order_id },
              { invoiceNumber: `UBER-${cleanInputId.toUpperCase()}` },
            ],
          };

          const existingCols = await mongoConn.db.listCollections().toArray().catch(() => []);
          const colNames = Array.from(
            new Set([
              'oms_orders',
              'orders',
              'webhook_events',
              ...existingCols
                .map((c) => c.name)
                .filter((n) => /order|event|webhook/i.test(n)),
            ])
          );

          for (const colName of colNames) {
            const doc = await mongoConn.db
              .collection(colName)
              .findOne(lookupQuery)
              .catch(() => null);
            if (!doc) continue;
            const fullUuid = String(
              doc.uberOrderId ||
                doc.uber_order_id ||
                (typeof doc.orderId === 'string' && doc.orderId.length >= 20 ? doc.orderId : '') ||
                ''
            ).trim();
            if (fullUuid) {
              uberOrderUuid = fullUuid;
              break;
            }
          }
        }
      }
    } catch (lookupErr) {
      console.warn('[Uber Action UUID Lookup Notice]:', lookupErr);
    }

    // Attempt live Uber Eats sync (gracefully fall back to local OMS update if Uber verification is pending)
    let synced = false;
    let note = 'Updated locally (Uber verification pending)';
    let uberStatusCode: number | string = 'PENDING_LOCAL';
    let uberApiHost: string | null = null;
    let uberResponse: unknown = null;
    let uberError: string | null = null;

    try {
      const uberResult = await executeUberOrderAction({
        orderId: uberOrderUuid,
        action,
        reason: reasonCode,
        isSandbox,
      });

      uberStatusCode = uberResult.status;
      uberApiHost = uberResult.env || null;
      uberResponse = uberResult.uberResponse;

      if (uberResult.ok) {
        synced = true;
        note = `Synced with Uber (${uberResult.env || 'Uber Eats'})`;
      } else {
        uberError = uberResult.error || `Uber API returned status ${uberResult.status}`;
        console.warn('[Uber Action Local Fallback]:', {
          action,
          order_id: uberOrderUuid,
          storeId,
          uberStatus: uberResult.status,
          uberError,
        });
      }
    } catch (uberErr: unknown) {
      uberError = uberErr instanceof Error ? uberErr.message : 'Uber sync unavailable';
      console.warn('[Uber Action Local Fallback Notice]:', uberError);
    }

    // Update local OMS state + MongoDB + SSE live subscribers
    const now = new Date().toISOString();
    const nextStatus: OrderStatus = NEXT_STATUS_MAP[action];

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
          anyO.order_id === order_id ||
          anyO.orderNumber === order_id ||
          anyO.displayId === order_id ||
          anyO.uberOrderId === order_id ||
          anyO.uberOrderId === uberOrderUuid ||
          anyO.uber_order_id === order_id ||
          anyO.uber_order_id === cleanInputId ||
          anyO.uber_order_id === uberOrderUuid
        );
      });
      for (const existing of matchedOrders) {
        existing.status = nextStatus;
        (existing as any).uberStatus = nextStatus;
        (existing as any).orderStatus = nextStatus;
        existing.updatedAt = now;
        saveServerOrder(existing);
      }

      const matchedEvents = (serverStore.webhookEvents || []).filter((ev) => {
        const anyEv = ev as any;
        return (
          ev.id === order_id ||
          ev.orderId === order_id ||
          ev.orderId === cleanInputId ||
          ev.orderId === uberOrderUuid ||
          ev.invoiceNumber === order_id ||
          anyEv.eventId === order_id ||
          anyEv.order_id === order_id ||
          anyEv.orderNumber === order_id ||
          anyEv.displayId === order_id ||
          anyEv.uberOrderId === order_id ||
          anyEv.uberOrderId === uberOrderUuid ||
          anyEv.uber_order_id === order_id ||
          anyEv.uber_order_id === cleanInputId ||
          anyEv.uber_order_id === uberOrderUuid
        );
      });
      for (const existingEvt of matchedEvents) {
        saveServerWebhookEvent({
          ...existingEvt,
          orderStatus: nextStatus,
          ...(synced !== undefined ? ({ uberSynced: synced } as any) : {}),
        });
      }

      broadcastLiveUpdate({
        type: 'order_status_updated',
        orderId: order_id,
        uber_order_id: uberOrderUuid,
        status: nextStatus,
        synced,
        timestamp: now,
      });

      if (!mongoConn) {
        mongoConn = await connectToMongoDB();
      }
      if (mongoConn) {
        const candidates = Array.from(
          new Set(
            [
              order_id,
              `#${order_id}`,
              cleanInputId,
              cleanInputId.toUpperCase(),
              `UBER-${cleanInputId.toUpperCase()}`,
              uberOrderUuid,
            ].filter(Boolean)
          )
        );

        const orderMatchFilter = {
          $or: [
            ...(validObjectId ? [{ _id: validObjectId }] : []),
            { id: { $in: candidates } },
            { orderId: { $in: candidates } },
            { order_id: { $in: candidates } },
            { external_order_id: { $in: candidates } },
            { uberOrderId: { $in: candidates } },
            { uber_order_id: { $in: candidates } },
            { orderNumber: { $in: candidates } },
            { displayId: { $in: candidates } },
            { display_id: { $in: candidates } },
            { invoiceNumber: { $in: candidates } },
          ],
        };

        const lastUberSync = {
          synced,
          statusCode: uberStatusCode ?? null,
          apiHost: uberApiHost ?? null,
          error: uberError ?? null,
          at: new Date(),
        };

        const existingCols = await mongoConn.db.listCollections().toArray().catch(() => []);
        const targetColNames = Array.from(
          new Set([
            'orders',
            'oms_orders',
            'webhook_events',
            ...existingCols
              .map((c) => c.name)
              .filter((n) => /order|event|webhook/i.test(n)),
          ])
        );

        for (const colName of targetColNames) {
          const isWebhookLogCol = /event|webhook/i.test(colName) && !/order/i.test(colName);
          await mongoConn.db.collection(colName).updateMany(orderMatchFilter, {
            $set: isWebhookLogCol
              ? {
                  orderStatus: nextStatus,
                  uberStatus: nextStatus,
                  uberSynced: synced,
                  lastUberSync,
                  updatedAt: now,
                }
              : {
                  status: nextStatus,
                  uberStatus: nextStatus,
                  orderStatus: nextStatus,
                  uberSynced: synced,
                  lastUberSync,
                  updatedAt: now,
                  ...(colName === 'oms_orders' ? { updated_at: new Date() } : {}),
                },
          });
        }
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
      synced,
      uberSynced: synced,
      note,
      orderId: rawOrderId,
      uberOrderId: uberOrderUuid,
      action,
      status: nextStatus,
      nextStatus,
      uberStatus: uberStatusCode,
      uberStatusCode,
      uberApiHost,
      uberError,
      uberResponse,
      message: synced
        ? `Synced with Uber (${uberApiHost || 'Uber Eats'})`
        : `OMS updated to ${nextStatus} — Uber API returned ${uberStatusCode}: ${uberError || note}`,
    });
  } catch (err: unknown) {
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
