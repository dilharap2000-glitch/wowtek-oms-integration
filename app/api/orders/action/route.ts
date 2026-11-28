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

// Prevent duplicate concurrent Uber API requests for the same order + action
const inFlightOrderActions = new Set<string>();

function extractUberUuidFromRecord(doc: Record<string, any> | null | undefined): string {
  if (!doc) return '';
  const candidates = [
    doc.uberOrderId,
    doc.uber_order_id,
    doc.rawPayload?.meta?.resource_id,
    doc.rawPayload?.order?.id,
    typeof doc.orderId === 'string' && doc.orderId.length >= 20 ? doc.orderId : '',
    typeof doc.order_id === 'string' && doc.order_id.length >= 20 ? doc.order_id : '',
    typeof doc.id === 'string' && doc.id.length >= 20 && !doc.id.startsWith('ord-') ? doc.id : '',
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) {
      return c.trim();
    }
  }
  return '';
}

export async function POST(req: NextRequest) {
  let lockKey = '';
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
        { ok: false, success: false, synced: false, error: 'Order ID is required.' },
        { status: 400 }
      );
    }

    const action = ACTION_MAP[rawAction];
    if (!action) {
      return NextResponse.json(
        { ok: false, success: false, synced: false, error: `Invalid action: ${rawAction || body?.action}` },
        { status: 400 }
      );
    }

    const order_id = String(rawOrderId).replace(/^#/, '').trim();
    const cleanInputId = order_id.replace(/^UBER-/i, '');
    const validObjectId = ObjectId.isValid(order_id) ? new ObjectId(order_id) : null;
    const isSandbox = isUberSandboxMode();

    // 1. Validate order & resolve the original Uber Eats order_id UUID
    let uberOrderUuid = '';
    let matchedDoc: Record<string, any> | null = null;
    let mongoConn: Awaited<ReturnType<typeof connectToMongoDB>> = null;

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
      matchedDoc = existingLocal as Record<string, any>;
      uberOrderUuid = extractUberUuidFromRecord(existingLocal as Record<string, any>);
    }

    try {
      mongoConn = await connectToMongoDB();
      if (mongoConn) {
        const lookupQuery: Record<string, unknown> = {
          $or: [
            ...(validObjectId ? [{ _id: validObjectId }] : []),
            { id: order_id },
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
          if (!matchedDoc) matchedDoc = doc;
          const resolved = extractUberUuidFromRecord(doc);
          if (resolved) {
            uberOrderUuid = resolved;
            matchedDoc = doc;
            break;
          }
        }
      }
    } catch (lookupErr) {
      console.warn('[Uber Action Order Lookup Notice]:', lookupErr);
    }

    // Fallback to raw order_id only if it looks like an external Uber order ID (not local ord-ubr- wrapper)
    if (!uberOrderUuid && order_id && !order_id.startsWith('ord-ubr-')) {
      uberOrderUuid = order_id;
    }

    const channelStr = String(
      matchedDoc?.channel || matchedDoc?.source || matchedDoc?.provider || ''
    ).toLowerCase();
    if (channelStr && !channelStr.includes('uber')) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          synced: false,
          error: `Order belongs to channel "${channelStr}", not Uber Eats.`,
        },
        { status: 400 }
      );
    }

    if (!uberOrderUuid) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          synced: false,
          error: 'Original Uber Eats order_id UUID was not found for this order.',
        },
        { status: 400 }
      );
    }

    const previousStatus = String(
      matchedDoc?.uberStatus || matchedDoc?.status || matchedDoc?.orderStatus || 'PENDING_ACCEPTANCE'
    );
    const prevUpper = previousStatus.toUpperCase();
    const alreadySyncedAccepted =
      action === 'ACCEPT' &&
      (matchedDoc?.uberSynced === true || matchedDoc?.lastUberSync?.synced === true) &&
      (prevUpper === 'ACCEPTED' || prevUpper === 'READY_FOR_PICKUP' || prevUpper === 'READY');

    // 2. Prevent duplicate acceptance requests if already accepted & synced with Uber
    if (alreadySyncedAccepted) {
      return NextResponse.json({
        ok: true,
        success: true,
        synced: true,
        uberSynced: true,
        alreadyAccepted: true,
        orderId: rawOrderId,
        uberOrderId: uberOrderUuid,
        action,
        status: previousStatus,
        nextStatus: previousStatus,
        message: 'Order was already accepted and synced with Uber Eats.',
      });
    }

    // 3. Prevent duplicate concurrent requests for the same order + action
    lockKey = `${uberOrderUuid}:${action}`;
    if (inFlightOrderActions.has(lockKey)) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          synced: false,
          duplicate: true,
          error: `An ${action} request for Uber Eats order ${uberOrderUuid} is already in progress.`,
        },
        { status: 409 }
      );
    }
    inFlightOrderActions.add(lockKey);

    // 4. Send the official Uber Eats API request and strictly verify response (HTTP 204 / 2xx)
    let uberResult: Awaited<ReturnType<typeof executeUberOrderAction>>;
    try {
      uberResult = await executeUberOrderAction({
        orderId: uberOrderUuid,
        action,
        reason: reasonCode,
        isSandbox,
      });
    } catch (uberErr: unknown) {
      const errorMsg =
        uberErr instanceof Error ? uberErr.message : 'Failed to communicate with Uber Eats API.';
      console.error('[Uber Action Execution Exception]:', {
        action,
        orderId: uberOrderUuid,
        storeId,
        error: errorMsg,
      });

      return NextResponse.json(
        {
          ok: false,
          success: false,
          synced: false,
          uberSynced: false,
          orderId: rawOrderId,
          uberOrderId: uberOrderUuid,
          action,
          status: previousStatus,
          preservedStatus: previousStatus,
          uberStatusCode: 502,
          error: errorMsg,
          uberError: errorMsg,
        },
        { status: 502 }
      );
    }

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
      synced: uberResult.ok,
      action,
      statusCode: uberResult.status ?? null,
      apiHost: uberResult.env ?? uberResult.url ?? null,
      error: uberResult.ok ? null : uberResult.error ?? `Uber API rejected request (${uberResult.status})`,
      at: new Date(),
    };

    // 5. If Uber rejected the request, preserve existing status and return the real error
    if (!uberResult.ok) {
      const httpStatus =
        typeof uberResult.status === 'number' && uberResult.status >= 400 && uberResult.status < 600
          ? uberResult.status
          : 502;
      const detailedError =
        uberResult.error || `Uber Eats API rejected ${action} (HTTP ${uberResult.status})`;

      console.error('[Uber Eats Order Action Failed — Status Preserved]:', {
        action,
        orderId: rawOrderId,
        uberOrderId: uberOrderUuid,
        storeId,
        preservedStatus: previousStatus,
        uberStatus: uberResult.status,
        uberUrl: uberResult.url,
        uberError: detailedError,
        uberResponse: uberResult.uberResponse,
      });

      if (mongoConn) {
        try {
          await mongoConn.db
            .collection('orders')
            .updateMany(orderMatchFilter, { $set: { lastUberSync } })
            .catch(() => {});
          await mongoConn.db
            .collection('oms_orders')
            .updateMany(orderMatchFilter, { $set: { lastUberSync } })
            .catch(() => {});
        } catch {
          // Ignore diagnostic write error
        }
      }

      return NextResponse.json(
        {
          ok: false,
          success: false,
          synced: false,
          uberSynced: false,
          orderId: rawOrderId,
          uberOrderId: uberOrderUuid,
          action,
          status: previousStatus,
          preservedStatus: previousStatus,
          uberStatus: uberResult.status,
          uberStatusCode: uberResult.status,
          uberApiHost: uberResult.url || uberResult.env || null,
          error: detailedError,
          uberError: detailedError,
          uberResponse: uberResult.uberResponse,
        },
        { status: httpStatus }
      );
    }

    // 6. Uber confirmed (HTTP 204 / 2xx) -> NOW update serverStore, MongoDB, and broadcast via SSE
    const now = new Date().toISOString();
    const nextStatus: OrderStatus = NEXT_STATUS_MAP[action];

    try {
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
        (existing as any).uberSynced = true;
        (existing as any).lastUberSync = lastUberSync;
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
          uberSynced: true,
        } as any);
      }

      if (!mongoConn) {
        mongoConn = await connectToMongoDB();
      }
      if (mongoConn) {
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
                  uberSynced: true,
                  lastUberSync,
                  updatedAt: now,
                }
              : {
                  status: nextStatus,
                  uberStatus: nextStatus,
                  orderStatus: nextStatus,
                  uberSynced: true,
                  uberOrderId: uberOrderUuid,
                  lastUberSync,
                  updatedAt: now,
                  ...(colName === 'oms_orders' ? { updated_at: new Date() } : {}),
                },
          });
        }
      }

      broadcastLiveUpdate({
        type: 'order_status_updated',
        orderId: order_id,
        uber_order_id: uberOrderUuid,
        status: nextStatus,
        synced: true,
        timestamp: now,
      });
    } catch (syncErr: unknown) {
      console.error(
        '[Order Action MongoDB Persist Error]:',
        syncErr instanceof Error ? syncErr.message : syncErr
      );
      return NextResponse.json(
        {
          ok: false,
          success: false,
          synced: true,
          uberSynced: true,
          orderId: rawOrderId,
          uberOrderId: uberOrderUuid,
          action,
          error: 'Uber Eats accepted the order, but failed to persist status to MongoDB.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      success: true,
      synced: true,
      uberSynced: true,
      note: `Synced with Uber (${uberResult.env || 'Uber Eats'})`,
      orderId: rawOrderId,
      uberOrderId: uberOrderUuid,
      action,
      status: nextStatus,
      nextStatus,
      uberStatus: uberResult.status,
      uberStatusCode: uberResult.status,
      uberApiHost: uberResult.env || uberResult.url || null,
      uberError: null,
      uberResponse: uberResult.uberResponse,
      message: `Order ${action.toLowerCase()} confirmed by Uber Eats (HTTP ${uberResult.status})`,
    });
  } catch (err: unknown) {
    console.error('[/api/orders/action Error]:', err);
    return NextResponse.json(
      {
        ok: false,
        success: false,
        synced: false,
        error: err instanceof Error ? err.message : 'Internal Server Error',
      },
      { status: 500 }
    );
  } finally {
    if (lockKey) {
      inFlightOrderActions.delete(lockKey);
    }
  }
}
