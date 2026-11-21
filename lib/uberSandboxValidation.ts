import { NextRequest, NextResponse } from 'next/server';
import {
  getUberAccessToken,
  getUberBaseUrl,
  hasUberCredentialsConfigured,
} from '@/lib/uberToken';

export type UberSandboxTestResult = {
  feature: string;
  method: string;
  path: string;
  status: number | string;
  ok: boolean;
  response?: unknown;
  error?: string;
};

export async function getUberSandboxStatus() {
  const baseUrl = getUberBaseUrl(true);
  const defaultStoreId = process.env.UBER_SANDBOX_STORE_ID || '';

  return NextResponse.json({
    environment: baseUrl,
    tokenConfigured: hasUberCredentialsConfigured(true),
    defaultStoreIdConfigured: Boolean(defaultStoreId),
    defaultStoreId: defaultStoreId || undefined,
  });
}

export async function runUberSandboxValidation(req: NextRequest) {
  const baseUrl = getUberBaseUrl(true);
  const accessToken = await getUberAccessToken(true);

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Uber Sandbox OAuth credentials හෝ access token එක සෙට් කර නැත.' },
      { status: 400 }
    );
  }

  let body: {
    store_id?: string;
    order_id?: string;
    integration_id?: string;
    run_cancel?: boolean;
  } = {};

  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const storeId = body.store_id?.trim() || process.env.UBER_SANDBOX_STORE_ID || '';
  const orderId = body.order_id?.trim() || '';
  const integrationId = body.integration_id?.trim() || storeId;
  const runCancel = Boolean(body.run_cancel);

  const headers: HeadersInit = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const results: UberSandboxTestResult[] = [];

  async function callUber(
    feature: string,
    method: string,
    path: string,
    payload?: unknown
  ) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: payload !== undefined ? JSON.stringify(payload) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const text = await res.text();
      let parsed: unknown = text;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        // plain text response
      }

      results.push({
        feature,
        method,
        path,
        status: res.status,
        ok: res.ok,
        response: parsed,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      results.push({
        feature,
        method,
        path,
        status: err instanceof Error && err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR',
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // 1. Store & Integration Endpoints (store_id අවශ්‍යයි)
  if (storeId) {
    await callUber('Retrieve Store Status', 'GET', `/v1/eats/stores/${storeId}`);

    await callUber('Set Store Status', 'POST', `/v1/eats/store/${storeId}/status`, {
      status: 'ONLINE',
    });

    await callUber('Update Prep Time', 'POST', `/v1/eats/store/${storeId}/prep-time`, {
      default_prep_time: 15,
    });

    if (integrationId) {
      await callUber('Update Integration Details', 'POST', `/v1/eats/stores/${storeId}/pos_data`, {
        pos_data: {
          integration_enabled: true,
        },
      });

      await callUber('Activate Integration', 'POST', `/v1/eats/stores/${storeId}/pos_data/activate`, {
        integration_id: integrationId,
      });
    }
  } else {
    results.push({
      feature: 'Store & Integration Endpoints',
      method: 'SKIPPED',
      path: '/v1/eats/stores/...',
      status: 'MISSING_STORE_ID',
      ok: false,
      error: 'store_id ලබා දී නැත.',
    });
  }

  // 2. Order Endpoints (order_id / UUID අවශ්‍යයි)
  if (orderId) {
    await callUber('Get Order Details', 'GET', `/v2/eats/order/${orderId}`);

    await callUber('Accept Order', 'POST', `/v1/eats/orders/${orderId}/accept_pos_order`, {
      reason: 'Accepted via WOWTEK OMS validation test',
    });

    await callUber('Update Delivery Partner Count (DMC)', 'POST', `/v1/eats/orders/${orderId}/restaurant_delivery_status`, {
      status: 'EN_ROUTE_TO_DROPOFF',
    });

    await callUber('Mark Order Ready', 'POST', `/v1/eats/orders/${orderId}/restaurant_delivery_status`, {
      status: 'READY_FOR_PICKUP',
    });

    // Cancel / Deny test order එකක් මත පමණක් run කරන්න (live/active order එකක් නම් cancel වෙයි)
    if (runCancel) {
      await callUber('Cancel Order', 'POST', `/v1/eats/orders/${orderId}/cancel`, {
        reason: {
          code: 'OTHER',
          explanation: 'Validation test cancellation',
        },
      });
    }
  } else {
    results.push({
      feature: 'Order Endpoints',
      method: 'SKIPPED',
      path: '/v1/eats/orders/...',
      status: 'MISSING_ORDER_ID',
      ok: false,
      error: 'Sandbox order UUID (order_id) ලබා දී නැත.',
    });
  }

  return NextResponse.json({
    environment: baseUrl,
    tested_at: new Date().toISOString(),
    results,
  });
}
