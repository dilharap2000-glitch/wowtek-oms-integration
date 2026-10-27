import { NextRequest, NextResponse } from 'next/server';
import { getServerStore, saveServerOrder, saveServerWebhookEvent, broadcastLiveUpdate } from '@/lib/serverStore';
import { getStoreMappings } from '@/lib/db';
import { WebhookEvent, Order } from '@/types';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-uber-signature, x-uber-store-id, x-store-id, x-location-id',
};

export async function handleOptions() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

/**
 * 1. Store Management & Activation Endpoints
 * GET /v1/eats/stores, /v1/delivery/stores, or /v1/delivery/store/{id}, /v1/eats/stores/{id}/pos_data
 */
export async function handleV1Get(request: NextRequest | Request) {
  try {
    const url = new URL(request.url);
    const storeMappings = await getStoreMappings().catch(() => []);
    const deliveryStores = storeMappings
      .filter((s) => s.platform === 'ubereats' || s.platform === 'pickme')
      .map((s) => ({
        store_id: s.externalStoreId || s.id,
        name: s.externalStoreName,
        branch_name: s.branchName,
        platform: s.platform,
        status: 'active',
        pos_integration: {
          status: 'active',
          version: '1.0.0',
          provider: 'WOWTEK-POS',
        },
      }));

    if (url.pathname.includes('/pos_data')) {
      return NextResponse.json(
        {
          status: 'success',
          message: 'Stores retrieved successfully',
          pos_data: {
            status: 'active',
            provider: 'WOWTEK-OMS',
            version: '2.0.0',
            capabilities: ['orders', 'menus', 'inventory', 'status_sync'],
          },
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        status: 'success',
        message: 'Stores retrieved successfully',
        stores: deliveryStores.length > 0 ? deliveryStores : [
          {
            store_id: 'eats-store-srilanka-0914',
            name: 'WOWTEK Colombo Central Hub',
            branch_name: 'Colombo 03 (Flagship)',
            platform: 'ubereats',
            status: 'active',
          },
        ],
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch {
    return NextResponse.json(
      { status: 'success', message: 'Stores retrieved successfully' },
      { status: 200, headers: CORS_HEADERS }
    );
  }
}

/**
 * Handles Webhooks, Order Actions, and Store Activations
 * POST /v1/eats/stores/{id}/pos_data (Activate Integration)
 * POST /v1/eats/orders/{id}/accept
 * POST /v1/eats/orders/{id}/accept_pos_order
 * POST /v1/eats/orders/{id}/cancel
 * POST /v1/eats/orders/{id}/deny
 * POST /v1/eats/orders/{id}/ready
 * POST Webhook Event Notifications (store.provisioned, store.deprovisioned, orders.notification, etc.)
 */
export async function handleV1Post(request: NextRequest | Request) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const url = new URL(request.url);
  const pathname = url.pathname;
  const now = new Date().toISOString();

  // Extract orderId if present in path: /orders/{orderId}/accept, etc.
  const orderIdMatch = pathname.match(/\/orders\/([^/]+)/);
  const pathOrderId = orderIdMatch ? orderIdMatch[1] : null;
  const targetOrderId = pathOrderId || body.order_id || body.id || body.resource_id;

  // Handle Webhooks & Store Activation
  if (pathname.includes('/pos_data')) {
    // POST /v1/eats/stores/{id}/pos_data (Activate Integration)
    const storeIdMatch = pathname.match(/\/stores\/([^/]+)/);
    const storeId = storeIdMatch ? storeIdMatch[1] : body.store_id || 'unknown';

    // Log webhook activation event
    const evt: WebhookEvent = {
      id: `evt-pos-act-${Date.now()}`,
      source: 'ubereats',
      event: 'store.provisioned',
      orderId: 'N/A',
      invoiceNumber: 'N/A',
      storeId,
      storeName: body.store_name || 'Uber Eats Store',
      branchName: body.branch_name || 'Primary Hub',
      amount: 0,
      status: 'success',
      orderStatus: 'Completed',
      rawPayload: { action: 'activate_pos_data', storeId, body },
      receivedAt: now,
    };
    saveServerWebhookEvent(evt);
    broadcastLiveUpdate({ type: 'webhook_event', event: evt, timestamp: now });

    return NextResponse.json(
      { status: 'active', message: 'Integration activated successfully' },
      { status: 200, headers: CORS_HEADERS }
    );
  }

  // Handle Order Actions: Accept, Cancel, Deny, Ready
  if (pathname.includes('/accept') || pathname.includes('/accept_pos_order')) {
    if (targetOrderId) {
      updateOrderStatus(targetOrderId, 'Processing', 'Accepted via POS / Delivery Integration');
    }
    return NextResponse.json({ status: 'accepted' }, { status: 200, headers: CORS_HEADERS });
  }

  if (pathname.includes('/cancel') || pathname.includes('/deny')) {
    if (targetOrderId) {
      updateOrderStatus(targetOrderId, 'Cancelled', body.reason || 'Cancelled/Denied via Delivery Integration');
    }
    return NextResponse.json({ status: 'processed' }, { status: 200, headers: CORS_HEADERS });
  }

  if (pathname.includes('/ready')) {
    if (targetOrderId) {
      updateOrderStatus(targetOrderId, 'Ready', 'Order marked ready for delivery pickup');
    }
    return NextResponse.json({ status: 'ready' }, { status: 200, headers: CORS_HEADERS });
  }

  // Webhook Event Notifications (store.provisioned, store.deprovisioned, orders.notification, etc.)
  const eventType = body.event_type || body.event || 'orders.notification';
  const evt: WebhookEvent = {
    id: `evt-del-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    source: pathname.includes('pickme') ? 'pickme' : 'ubereats',
    event: eventType,
    orderId: targetOrderId || 'N/A',
    invoiceNumber: targetOrderId ? `WT-${targetOrderId}` : 'N/A',
    storeId: body.store_id || 'store-primary',
    storeName: body.store_name || 'Delivery Hub',
    branchName: body.branch_name || 'Main Branch',
    amount: parseFloat(body.total || body.amount || 0),
    status: 'success',
    orderStatus: 'Pending',
    rawPayload: body,
    receivedAt: now,
  };
  saveServerWebhookEvent(evt);
  broadcastLiveUpdate({ type: 'webhook_event', event: evt, timestamp: now });

  return NextResponse.json({ received: true }, { status: 200, headers: CORS_HEADERS });
}

/**
 * PATCH /v1/eats/stores/{id}/pos_data
 */
export async function handleV1Patch(request: NextRequest | Request) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const url = new URL(request.url);
  const now = new Date().toISOString();

  const evt: WebhookEvent = {
    id: `evt-pos-patch-${Date.now()}`,
    source: 'ubereats',
    event: 'store.pos_data_updated',
    orderId: 'N/A',
    invoiceNumber: 'N/A',
    storeId: 'store-config',
    storeName: 'Uber Eats Store',
    branchName: 'Main Branch',
    amount: 0,
    status: 'success',
    orderStatus: 'Completed',
    rawPayload: { path: url.pathname, body },
    receivedAt: now,
  };
  saveServerWebhookEvent(evt);
  broadcastLiveUpdate({ type: 'webhook_event', event: evt, timestamp: now });

  return NextResponse.json({ status: 'updated' }, { status: 200, headers: CORS_HEADERS });
}

/**
 * DELETE /v1/eats/stores/{id}/pos_data (Store deprovisioning)
 */
export async function handleV1Delete(request: NextRequest | Request) {
  const url = new URL(request.url);
  const now = new Date().toISOString();

  const evt: WebhookEvent = {
    id: `evt-pos-del-${Date.now()}`,
    source: 'ubereats',
    event: 'store.deprovisioned',
    orderId: 'N/A',
    invoiceNumber: 'N/A',
    storeId: 'store-deprovision',
    storeName: 'Uber Eats Store',
    branchName: 'Main Branch',
    amount: 0,
    status: 'success',
    orderStatus: 'Cancelled',
    rawPayload: { path: url.pathname },
    receivedAt: now,
  };
  saveServerWebhookEvent(evt);
  broadcastLiveUpdate({ type: 'webhook_event', event: evt, timestamp: now });

  return NextResponse.json({ status: 'deprovisioned' }, { status: 200, headers: CORS_HEADERS });
}

/**
 * PUT /v2/eats/stores/{id}/menus (Upload Menu)
 */
export async function handleV2Put(request: NextRequest | Request) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const url = new URL(request.url);
  const now = new Date().toISOString();

  const evt: WebhookEvent = {
    id: `evt-menu-${Date.now()}`,
    source: 'ubereats',
    event: 'menu.uploaded',
    orderId: 'N/A',
    invoiceNumber: 'N/A',
    storeId: 'menu-sync',
    storeName: 'Uber Eats Store',
    branchName: 'Main Branch',
    amount: 0,
    status: 'success',
    orderStatus: 'Completed',
    rawPayload: { path: url.pathname, itemCount: Array.isArray(body?.items) ? body.items.length : 0 },
    receivedAt: now,
  };
  saveServerWebhookEvent(evt);
  broadcastLiveUpdate({ type: 'webhook_event', event: evt, timestamp: now });

  return NextResponse.json({ status: 'menu_updated' }, { status: 200, headers: CORS_HEADERS });
}

/**
 * GET for v2 endpoints (e.g. menus verification)
 */
export async function handleV2Get(request: NextRequest | Request) {
  return NextResponse.json(
    { status: 'success', message: 'V2 resource retrieved successfully' },
    { status: 200, headers: CORS_HEADERS }
  );
}

function updateOrderStatus(orderId: string, status: any, note: string) {
  try {
    const serverStore = getServerStore();
    const existing = serverStore.orders.find(
      (o) =>
        o.id === orderId ||
        o.invoiceNumber === orderId ||
        o.invoiceNumber === `WT-UBR-${orderId}` ||
        o.id.includes(orderId)
    );

    if (existing) {
      existing.status = status;
      existing.updatedAt = new Date().toISOString();
      if (note) {
        existing.notes = existing.notes ? `${existing.notes} | ${note}` : note;
      }
      saveServerOrder(existing);
      broadcastLiveUpdate({
        type: 'order_status_updated',
        orderId: existing.id,
        status,
        timestamp: existing.updatedAt,
      });
    }
  } catch (err) {
    console.warn('[Delivery Handler] Error updating order status:', err);
  }
}
