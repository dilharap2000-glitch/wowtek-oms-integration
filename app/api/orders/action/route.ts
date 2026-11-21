import { NextRequest, NextResponse } from 'next/server';
import { getServerStore, saveServerOrder, broadcastLiveUpdate } from '@/lib/serverStore';
import { connectToMongoDB } from '@/lib/mongodb';
import {
  clearUberAccessTokenCache,
  getUberAccessToken,
  getUberBaseUrl,
  isUberSandboxMode,
} from '@/lib/uberToken';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action;
    const rawOrderId = body.order_id || body.orderId;
    const storeId = body.storeId;
    const cancellationReason = body.cancellation_reason;

    if (!action || !rawOrderId) {
      return NextResponse.json(
        { success: false, error: 'action සහ order_id අනිවාර්යයි' },
        { status: 400 }
      );
    }

    const order_id = String(rawOrderId).trim();
    const cleanInputId = order_id.replace(/^UBER-/i, '');

    // 1. Environment & Token හරියට ගන්න (Sandbox vs Production + OAuth auto-refresh)
    const isSandbox = isUberSandboxMode();
    const baseUrl = getUberBaseUrl(isSandbox);
    let accessToken = await getUberAccessToken(isSandbox);

    if (!accessToken) {
      console.error('[Uber Action] Missing access token or OAuth credentials');
      return NextResponse.json(
        {
          success: false,
          error: 'Uber OAuth credentials (Client ID/Secret) හෝ Access Token සෙට් කර නැත',
        },
        { status: 500 }
      );
    }

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

    // 2. Action එකට අදාළ Uber Endpoint Path එක තෝරන්න
    let uberPath = '';
    let payload: Record<string, unknown> = {};

    if (action === 'accept') {
      uberPath = `/v1/eats/orders/${uberOrderUuid}/accept_pos_order`;
      payload = { reason: 'Accepted via WOWTEK OMS' };
    } else if (action === 'ready') {
      uberPath = `/v1/eats/orders/${uberOrderUuid}/restaurant_delivery_status`;
      payload = { status: 'READY_FOR_PICKUP' };
    } else if (action === 'cancel') {
      uberPath = `/v1/eats/orders/${uberOrderUuid}/cancel`;
      payload = {
        reason: cancellationReason || {
          code: 'OTHER',
          explanation: 'Cancelled via WOWTEK OMS',
        },
      };
    } else {
      return NextResponse.json(
        { success: false, error: `Unsupported action: ${action}` },
        { status: 400 }
      );
    }

    // 3. Uber Eats API එකට ඇත්තම Call එක යවන්න (401 නම් cache clear කර එක් වරක් retry කරන්න)
    const callUberAction = async (token: string): Promise<Response> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      try {
        return await fetch(`${baseUrl}${uberPath}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
    };

    let uberRes = await callUberAction(accessToken);
    if (uberRes.status === 401) {
      clearUberAccessTokenCache(isSandbox);
      const refreshedToken = await getUberAccessToken(isSandbox);
      if (refreshedToken && refreshedToken !== accessToken) {
        accessToken = refreshedToken;
        uberRes = await callUberAction(accessToken);
      }
    }

    const rawText = await uberRes.text();
    let uberData: unknown = rawText;
    try {
      uberData = rawText ? JSON.parse(rawText) : null;
    } catch {
      // plain text response
    }

    console.log('[Uber Action Result]', {
      action,
      order_id: uberOrderUuid,
      storeId,
      url: `${baseUrl}${uberPath}`,
      uberStatus: uberRes.status,
      uberData,
    });

    // Uber API එකෙන් 200 / 204 නොඑනවා නම් error එක return කරන්න (false "success: true" නොයවන්න)
    if (!uberRes.ok) {
      return NextResponse.json(
        {
          success: false,
          uberStatus: uberRes.status,
          error: 'Uber API rejected the action',
          uberResponse: uberData,
        },
        { status: uberRes.status }
      );
    }

    // 4. Uber API සාර්ථක වුණාට පස්සේ DB / OMS state update කරන්න
    const now = new Date().toISOString();
    const nextStatus =
      action === 'accept'
        ? 'Processing'
        : action === 'ready'
        ? 'READY_FOR_PICKUP'
        : 'Cancelled';

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
      success: true,
      message: `Order successfully ${action}ed`,
      status: nextStatus,
      uberStatus: uberRes.status,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[Uber Action Timeout]');
      return NextResponse.json(
        { success: false, error: 'Uber API request timed out. Please try again.' },
        { status: 504 }
      );
    }
    console.error('[Uber Action Fatal Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal Server Error',
      },
      { status: 500 }
    );
  }
}
