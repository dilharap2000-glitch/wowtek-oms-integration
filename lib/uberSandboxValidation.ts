import { NextRequest, NextResponse } from 'next/server';
import {
  getUberAccessTokenAttempt,
  getUberCredentialState,
  resolveUberConfigurationAsync,
  resolveUberEnvironment,
} from '@/lib/uberToken';

const DEFAULT_STORE_ID = (
  process.env.UBER_STORE_ID ||
  process.env.UBER_SANDBOX_STORE_ID ||
  'ba8761b9-5679-4bcd-845d-8b0baacf9e5d'
).trim();

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
  const resolved = await resolveUberConfigurationAsync();
  const activeState = await getUberCredentialState();
  const defaultStoreId = resolved.storeId || DEFAULT_STORE_ID;

  return NextResponse.json({
    environment: resolved.baseUrl,
    activeRuntimeEnvironment: resolved.env,
    activeBaseUrl: activeState.baseUrl,
    tokenUrl: activeState.tokenUrl,
    tokenConfigured: activeState.hasCredentials,
    secretConfigured: activeState.secretConfigured,
    authSourceMode: activeState.authSourceMode,
    credentialSource: activeState.credentialSource,
    credentialPair: activeState.credentialPair,
    clientIdPreview: activeState.clientIdPreview,
    partialWarning: activeState.partialWarning,
    envOverridesMongo: activeState.envOverridesMongo,
    conflictWarning: activeState.conflictWarning,
    defaultStoreIdConfigured: Boolean(defaultStoreId),
    defaultStoreId: defaultStoreId || undefined,
    ...(resolved.env !== 'sandbox'
      ? {
          runtimeWarning:
            'Runtime is currently resolving to PRODUCTION for order actions; switch Environment to Sandbox if using the Test Store.',
        }
      : {}),
  });
}

async function runSingleFeatureValidation(body: {
  feature: string;
  storeId?: string;
  store_id?: string;
  orderId?: string;
  order_id?: string;
  host?: string;
  integrator_store_id?: string;
  default_prep_time?: number;
  environment?: 'sandbox' | 'production';
}) {
  const resolved = await resolveUberConfigurationAsync(
    body.environment ? { explicitEnv: body.environment } : undefined
  );
  const feature = String(body.feature || 'store_status').trim();
  const storeId = String(body.storeId || body.store_id || resolved.storeId || DEFAULT_STORE_ID).trim();
  const orderId = String(body.orderId || body.order_id || '').trim();
  const requestedHost = String(body.host || '').trim().replace(/\/+$/, '');

  const isTestPing = feature === 'test_ping';
  const targetEnv = body.environment ? resolveUberEnvironment(body.environment === 'sandbox') : resolved.env;
  const targetSandbox = targetEnv === 'sandbox';

  const host = targetSandbox
    ? requestedHost && /sandbox|test-api/i.test(requestedHost)
      ? requestedHost
      : resolved.baseUrl
    : resolved.baseUrl;

  const auth = await getUberAccessTokenAttempt(targetSandbox, {
    forceRefresh: isTestPing,
  });
  if (!auth.ok || !auth.token) {
    const errStatus = auth.status || 401;
    return NextResponse.json(
      {
        ok: false,
        status: errStatus,
        oauthOk: false,
        error: 'Failed to get Uber OAuth token',
        reason: auth.error,
        environment: auth.env || targetEnv,
        tokenUrl: auth.tokenUrl,
        baseUrl: auth.baseUrl,
        hasCredentials: auth.hasCredentials,
        credentialSource: auth.credentialSource,
        credentialPair: auth.credentialPair,
        clientIdPreview: auth.clientIdPreview,
        envOverridesMongo: auth.envOverridesMongo,
        conflictWarning: auth.conflictWarning,
        details: auth.details,
      },
      { status: errStatus }
    );
  }

  let endpoint = '';
  let method = 'GET';
  let payload: unknown = undefined;

  if (feature === 'store_status' || feature === 'test_ping') {
    endpoint = `${host}/v1/eats/store/${encodeURIComponent(storeId)}/status`;
    method = 'GET';
  } else if (feature === 'stores_list') {
    endpoint = `${host}/v1/eats/stores`;
    method = 'GET';
  } else if (feature === 'set_store_online') {
    endpoint = `${host}/v1/eats/store/${encodeURIComponent(storeId)}/status`;
    method = 'POST';
    payload = { status: 'ONLINE' };
  } else if (feature === 'set_store_paused') {
    endpoint = `${host}/v1/eats/store/${encodeURIComponent(storeId)}/status`;
    method = 'POST';
    payload = { status: 'PAUSED' };
  } else if (feature === 'update_prep_time') {
    endpoint = `${host}/v1/eats/store/${encodeURIComponent(storeId)}/prep-time`;
    method = 'POST';
    payload = { default_prep_time: Number(body.default_prep_time) || 15 };
  } else if (feature === 'activate_integration') {
    endpoint = `${host}/v1/eats/stores/${encodeURIComponent(storeId)}/pos_data`;
    method = 'POST';
    payload = {
      store_id: storeId,
      integrator_store_id: body.integrator_store_id || 'WOWTEK-CENTRAL-HUB',
      is_order_manager_enabled: true,
      is_menu_manager_enabled: false,
    };
  } else if (feature === 'update_integration') {
    endpoint = `${host}/v1/eats/stores/${encodeURIComponent(storeId)}/pos_data`;
    method = 'PATCH';
    payload = {
      integrator_store_id: body.integrator_store_id || 'WOWTEK-CENTRAL-HUB',
      is_order_manager_enabled: true,
    };
  } else if (feature === 'remove_integration') {
    endpoint = `${host}/v1/eats/stores/${encodeURIComponent(storeId)}/pos_data`;
    method = 'DELETE';
  } else if (feature === 'get_order') {
    if (!orderId) {
      return NextResponse.json(
        { ok: false, error: 'orderId is required for get_order' },
        { status: 400 }
      );
    }
    endpoint = `${host}/v2/eats/order/${encodeURIComponent(orderId)}`;
    method = 'GET';
  } else {
    return NextResponse.json(
      { ok: false, error: `Unknown feature: ${feature}` },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: payload !== undefined ? JSON.stringify(payload) : undefined,
      cache: 'no-store',
      signal: controller.signal,
    });

    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    return NextResponse.json({
      ok: res.ok,
      oauthOk: true,
      status: res.status,
      feature,
      environment: auth.env || targetEnv,
      storeId,
      endpoint,
      tokenUrl: auth.tokenUrl,
      credentialSource: auth.credentialSource,
      credentialPair: auth.credentialPair,
      clientIdPreview: auth.clientIdPreview,
      envOverridesMongo: auth.envOverridesMongo,
      conflictWarning: auth.conflictWarning,
      data,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, oauthOk: true, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function runUberSandboxValidation(req: NextRequest) {
  let body: {
    feature?: string;
    storeId?: string;
    store_id?: string;
    orderId?: string;
    order_id?: string;
    integration_id?: string;
    integrator_store_id?: string;
    host?: string;
    run_cancel?: boolean;
    run_deprovision?: boolean;
    environment?: 'sandbox' | 'production';
  } = {};

  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (body.feature) {
    return runSingleFeatureValidation({
      feature: body.feature,
      storeId: body.storeId,
      store_id: body.store_id,
      orderId: body.orderId,
      order_id: body.order_id,
      host: body.host,
      integrator_store_id: body.integrator_store_id,
      environment: body.environment,
    });
  }

  const resolved = await resolveUberConfigurationAsync(
    body.environment ? { explicitEnv: body.environment } : undefined
  );
  const targetSandbox = resolved.env === 'sandbox';
  const baseUrl = (body.host || resolved.baseUrl).trim().replace(/\/+$/, '');
  const auth = await getUberAccessTokenAttempt(targetSandbox);

  if (!auth.ok || !auth.token) {
    return NextResponse.json(
      {
        error: auth.error || 'Uber OAuth credentials are not configured cleanly.',
        status: auth.status || 401,
        environment: auth.env || resolved.env,
        tokenUrl: auth.tokenUrl,
        credentialSource: auth.credentialSource,
        conflictWarning: auth.conflictWarning,
      },
      { status: auth.status || 400 }
    );
  }

  const storeId = (body.store_id || body.storeId || resolved.storeId || DEFAULT_STORE_ID).trim();
  const orderId = (body.order_id || body.orderId || '').trim();
  const integratorStoreId = (
    body.integrator_store_id ||
    body.integration_id ||
    'WOWTEK-CENTRAL-HUB'
  ).trim();
  const runCancel = Boolean(body.run_cancel);
  const runDeprovision = Boolean(body.run_deprovision);

  const headers: HeadersInit = {
    Authorization: `Bearer ${auth.token}`,
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

  // 1. Store & Integration Endpoints
  if (storeId) {
    await callUber(
      'Retrieve Store Status',
      'GET',
      `/v1/eats/store/${encodeURIComponent(storeId)}/status`
    );

    await callUber('Set Store Status', 'POST', `/v1/eats/store/${encodeURIComponent(storeId)}/status`, {
      status: 'ONLINE',
    });

    await callUber(
      'Update Prep Time',
      'POST',
      `/v1/eats/store/${encodeURIComponent(storeId)}/prep-time`,
      {
        default_prep_time: 15,
      }
    );

    await callUber(
      'Activate Integration',
      'POST',
      `/v1/eats/stores/${encodeURIComponent(storeId)}/pos_data`,
      {
        store_id: storeId,
        integrator_store_id: integratorStoreId,
        is_order_manager_enabled: true,
        is_menu_manager_enabled: false,
      }
    );

    await callUber(
      'Update Integration Details',
      'PATCH',
      `/v1/eats/stores/${encodeURIComponent(storeId)}/pos_data`,
      {
        integrator_store_id: integratorStoreId,
        is_order_manager_enabled: true,
      }
    );

    if (runDeprovision) {
      await callUber(
        'Remove Integration',
        'DELETE',
        `/v1/eats/stores/${encodeURIComponent(storeId)}/pos_data`
      );
    }
  } else {
    results.push({
      feature: 'Store & Integration Endpoints',
      method: 'SKIPPED',
      path: '/v1/eats/stores/...',
      status: 'MISSING_STORE_ID',
      ok: false,
      error: 'Store UUID is required.',
    });
  }

  // 2. Order Endpoints (requires active Sandbox order_id UUID)
  if (orderId) {
    await callUber('Get Order Details', 'GET', `/v2/eats/order/${encodeURIComponent(orderId)}`);

    await callUber(
      'Accept Order',
      'POST',
      `/v1/eats/orders/${encodeURIComponent(orderId)}/accept_pos_order`,
      {
        reason: 'POS_ACCEPTED',
      }
    );

    await callUber(
      'Mark Order Ready',
      'POST',
      `/v1/delivery/order/${encodeURIComponent(orderId)}/ready`,
      {}
    );

    if (runCancel) {
      await callUber('Deny / Cancel Order', 'POST', `/v1/eats/orders/${encodeURIComponent(orderId)}/deny_pos_order`, {
        reason: {
          code: 'POS_NOT_READY',
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
      error: 'Sandbox order UUID (order_id) was not provided.',
    });
  }

  return NextResponse.json({
    environment: `${resolved.env} (${baseUrl})`,
    tokenUrl: auth.tokenUrl,
    credentialSource: auth.credentialSource,
    clientIdPreview: auth.clientIdPreview,
    tested_at: new Date().toISOString(),
    results,
  });
}
