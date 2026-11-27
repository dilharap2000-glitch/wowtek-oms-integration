import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getServerStore, saveServerOrder, broadcastLiveUpdate } from '@/lib/serverStore';
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

    const order_id = String(rawOrderId).trim();
    const cleanInputId = order_id.replace(/^UBER-/i, '');
    const validObjectId = ObjectId.isValid(order_id) ? new ObjectId(order_id) : null;

    const isSandbox = isUberSandboxMode();

    // Resolve Uber Order UUID if a short ID or Mongo _id was passed
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
              ...(validObjectId ? [{ _id: validObjectId }] : []),
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

    // Attempt live Uber Eats sync (gracefully fall back to local OMS update if Uber verification is pending)
    let synced = false;
    let note = 'Updated locally (Uber verification pending)';
    let uberStatus: number | string = 'PENDING_LOCAL';
    let uberResponse: unknown = null;
    let uberError: string | undefined;

    try {
      const uberResult = await executeUberOrderAction({
        orderId: uberOrderUuid,
        action,
        reason: reasonCode,
        isSandbox,
      });

      uberStatus = uberResult.status;
      uberResponse = uberResult.uberResponse;

      if (uberResult.ok) {
        synced = true;
        note = 'Synced with Uber Eats';
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
        synced,
        timestamp: now,
      });

      if (!mongoConn) {
        mongoConn = await connectToMongoDB();
      }
      if (mongoConn) {
        const orderMatchFilter = {
          $or: [
            ...(validObjectId ? [{ _id: validObjectId }] : []),
            { id: order_id },
            { id: cleanInputId },
            { id: uberOrderUuid },
            { invoiceNumber: order_id },
            { invoiceNumber: `UBER-${cleanInputId}` },
            { orderId: order_id },
            { orderId: cleanInputId },
            { orderId: uberOrderUuid },
            { order_id: order_id },
            { order_id: cleanInputId },
            { order_id: uberOrderUuid },
            { external_order_id: order_id },
            { uberOrderId: order_id },
            { uberOrderId: uberOrderUuid },
            { uber_order_id: order_id },
            { uber_order_id: cleanInputId },
            { uber_order_id: uberOrderUuid },
            { display_id: order_id },
            { display_id: `UBER-${cleanInputId}` },
          ],
        };

        await mongoConn.db.collection('orders').updateMany(orderMatchFilter, {
          $set: { status: nextStatus, uberStatus: nextStatus, updatedAt: now, uberSynced: synced },
        });

        await mongoConn.db.collection('oms_orders').updateMany(orderMatchFilter, {
          $set: {
            status: nextStatus,
            uberStatus: nextStatus,
            uberSynced: synced,
            updated_at: new Date(),
            updatedAt: now,
          },
        });

        await mongoConn.db.collection('webhook_events').updateMany(orderMatchFilter, {
          $set: { orderStatus: nextStatus, uberStatus: nextStatus, uberSynced: synced },
        });

        // Update any additional order/event collections dynamically without overwriting webhook delivery status
        const existingCols = await mongoConn.db.listCollections().toArray();
        for (const col of existingCols) {
          if (
            !(/order/i.test(col.name)) ||
            col.name === 'orders' ||
            col.name === 'oms_orders'
          ) {
            continue;
          }
          await mongoConn.db.collection(col.name).updateMany(orderMatchFilter, {
            $set: {
              status: nextStatus,
              uberStatus: nextStatus,
              uberSynced: synced,
              updatedAt: now,
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

    const actionVerb = action === 'CANCEL' ? 'cancelled' : `${action.toLowerCase()}ed`;
    return NextResponse.json({
      ok: true,
      success: true,
      synced,
      uberSynced: synced,
      note,
      orderId: uberOrderUuid,
      action,
      message: synced
        ? `Order ${actionVerb} & synced with Uber Eats`
        : `Order ${actionVerb} locally (Uber verification pending)`,
      status: nextStatus,
      nextStatus,
      uberStatus,
      uberResponse,
      ...(uberError ? { uberError } : {}),
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
