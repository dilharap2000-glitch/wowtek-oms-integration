import type { OrderStatus } from '@/types';
import { connectToMongoDB } from '@/lib/mongodb';

type CachedToken = {
  token: string;
  baseUrl: string;
  tokenUrl: string;
  expiresAt: number;
};

const cachedTokens: {
  sandbox: CachedToken | null;
  production: CachedToken | null;
} = {
  sandbox: null,
  production: null,
};

export type UberOrderAction = 'ACCEPT' | 'READY' | 'CANCEL';

const DUMMY_CREDENTIAL_VALUES = new Set([
  'YOUR_UBER_ACCESS_TOKEN',
  'uber_client_id_lk_881920',
  'ubr_sec_9941a87b003',
]);

function isUsableToken(token?: string | null): token is string {
  if (!token) return false;
  const trimmed = token.trim();
  if (!trimmed) return false;
  if (DUMMY_CREDENTIAL_VALUES.has(trimmed)) return false;
  if (trimmed.toLowerCase().startsWith('your_uber_')) return false;
  return true;
}

export function isUberSandboxMode(): boolean {
  const envMode = (process.env.UBER_ENV || '').trim().toLowerCase();
  if (envMode.includes('sandbox') || envMode.includes('test')) return true;
  if (envMode.includes('prod')) return false;
  return Boolean(
    isUsableToken(process.env.UBER_SANDBOX_ACCESS_TOKEN) ||
      isUsableToken(process.env.UBER_SANDBOX_CLIENT_ID) ||
      process.env.UBER_SANDBOX_BASE_URL?.trim()
  );
}

export function getUberBaseUrl(isSandbox: boolean): string {
  return isSandbox
    ? process.env.UBER_SANDBOX_BASE_URL || 'https://test-api.uber.com'
    : process.env.UBER_PROD_BASE_URL || process.env.UBER_BASE_URL || 'https://api.uber.com';
}

export function clearUberAccessTokenCache(isSandbox?: boolean): void {
  if (isSandbox === true) {
    cachedTokens.sandbox = null;
  } else if (isSandbox === false) {
    cachedTokens.production = null;
  } else {
    cachedTokens.sandbox = null;
    cachedTokens.production = null;
  }
}

function getUberClientCredentialsFromEnv(isSandbox: boolean): {
  clientId?: string;
  clientSecret?: string;
} {
  const clientId = (
    isSandbox
      ? process.env.UBER_SANDBOX_CLIENT_ID ||
        process.env.UBER_CLIENT_ID ||
        process.env.ClientID ||
        process.env.OAuth_ClientID
      : process.env.UBER_PROD_CLIENT_ID ||
        process.env.UBER_CLIENT_ID ||
        process.env.ClientID ||
        process.env.OAuth_ClientID
  )?.trim();

  const clientSecret = (
    isSandbox
      ? process.env.UBER_SANDBOX_CLIENT_SECRET ||
        process.env.UBER_CLIENT_SECRET ||
        process.env.ClientSecret ||
        process.env.OAuth_ClientSecret
      : process.env.UBER_PROD_CLIENT_SECRET ||
        process.env.UBER_CLIENT_SECRET ||
        process.env.ClientSecret ||
        process.env.OAuth_ClientSecret
  )?.trim();

  return {
    clientId: isUsableToken(clientId) ? clientId : undefined,
    clientSecret: isUsableToken(clientSecret) ? clientSecret : undefined,
  };
}

async function getCredentialsFromMongo(): Promise<{
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
}> {
  if (!process.env.MONGODB_URI) return {};

  try {
    const conn = await connectToMongoDB(1);
    if (!conn) return {};
    const { db } = conn;

    const appSettingsDoc = await db.collection('settings').findOne({ id: 'app_settings' });
    const apiConfig = (appSettingsDoc?.apiConfig || {}) as Record<string, unknown>;

    const uberDoc =
      (await db.collection('settings').findOne({ type: 'uber' })) ||
      (await db.collection('settings').findOne({ key: 'uber_eats' })) ||
      (await db.collection('uber_settings').findOne({}));

    const pickString = (...candidates: unknown[]): string | undefined => {
      for (const value of candidates) {
        if (typeof value === 'string' && isUsableToken(value)) {
          return value.trim();
        }
      }
      return undefined;
    };

    const clientId = pickString(
      uberDoc?.clientId,
      uberDoc?.ClientID,
      uberDoc?.OAuth_ClientID,
      uberDoc?.oauthClientId,
      uberDoc?.uberEatsClientId,
      apiConfig.uberEatsClientId,
      apiConfig.oauthClientId,
      apiConfig.OAuth_ClientID,
      apiConfig.ClientID,
      apiConfig.clientId
    );

    const clientSecret = pickString(
      uberDoc?.clientSecret,
      uberDoc?.ClientSecret,
      uberDoc?.OAuth_ClientSecret,
      uberDoc?.oauthClientSecret,
      uberDoc?.uberEatsClientSecret,
      apiConfig.uberEatsClientSecret,
      apiConfig.oauthClientSecret,
      apiConfig.OAuth_ClientSecret,
      apiConfig.ClientSecret,
      apiConfig.clientSecret
    );

    const accessToken = pickString(
      uberDoc?.accessToken,
      uberDoc?.access_token,
      apiConfig.uberEatsAccessToken,
      apiConfig.uberAccessToken
    );

    return { clientId, clientSecret, accessToken };
  } catch (err) {
    console.warn('[Uber Mongo Credentials Fallback Notice]:', err);
    return {};
  }
}

export function hasUberCredentialsConfigured(isSandbox: boolean): boolean {
  const { clientId, clientSecret } = getUberClientCredentialsFromEnv(isSandbox);
  if (clientId && clientSecret) return true;

  const staticToken = isSandbox
    ? process.env.UBER_SANDBOX_ACCESS_TOKEN ||
      process.env.UBER_ACCESS_TOKEN ||
      process.env.UBER_EATS_ACCESS_TOKEN
    : process.env.UBER_PROD_TOKEN ||
      process.env.UBER_ACCESS_TOKEN ||
      process.env.UBER_EATS_ACCESS_TOKEN;

  return isUsableToken(staticToken);
}

async function fetchOAuthToken(
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
  scope: string
): Promise<{
  ok: boolean;
  status: number;
  accessToken?: string;
  expiresIn?: number;
  rawText: string;
  parsed: any;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      ...(scope ? { scope } : {}),
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      cache: 'no-store',
      signal: controller.signal,
    });

    const rawText = await res.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }

    return {
      ok: res.ok && Boolean(parsed?.access_token),
      status: res.status,
      accessToken: parsed?.access_token,
      expiresIn: Number(parsed?.expires_in) || 2592000,
      rawText,
      parsed,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

type EnvTokenResult = {
  ok: boolean;
  token?: string;
  baseUrl?: string;
  tokenUrl?: string;
  fromCache?: boolean;
  status?: number;
  error?: string;
  details?: unknown;
  hasCredentials?: boolean;
};

async function getTokenForSpecificEnv(
  targetSandbox: boolean,
  options?: { forceRefresh?: boolean }
): Promise<EnvTokenResult> {
  const cacheKey = targetSandbox ? 'sandbox' : 'production';
  const baseUrl = getUberBaseUrl(targetSandbox);
  const existing = cachedTokens[cacheKey];

  if (!options?.forceRefresh && existing && Date.now() < existing.expiresAt - 60_000) {
    return {
      ok: true,
      token: existing.token,
      baseUrl: existing.baseUrl,
      tokenUrl: existing.tokenUrl,
      fromCache: true,
    };
  }

  const envCreds = getUberClientCredentialsFromEnv(targetSandbox);
  let clientId = envCreds.clientId;
  let clientSecret = envCreds.clientSecret;
  let mongoAccessToken: string | undefined;

  if (!clientId || !clientSecret) {
    const fromDb = await getCredentialsFromMongo();
    clientId = clientId || fromDb.clientId;
    clientSecret = clientSecret || fromDb.clientSecret;
    mongoAccessToken = fromDb.accessToken;
  }

  const configuredScope = process.env.UBER_OAUTH_SCOPE?.trim();
  const scopeCandidates = configuredScope
    ? [configuredScope, 'eats.order', '']
    : [
        'eats.order eats.store eats.store.orders.read eats.store.orders.write eats.store.status.write eats.pos_provisioning',
        'eats.order',
        '',
      ];

  const tokenUrls = targetSandbox
    ? [
        'https://auth.uber.com/oauth/v2/token',
        'https://sandbox-login.uber.com/oauth/v2/token',
        'https://login.uber.com/oauth/v2/token',
      ]
    : [
        'https://auth.uber.com/oauth/v2/token',
        'https://login.uber.com/oauth/v2/token',
      ];

  let lastOAuthStatus = 401;
  let lastOAuthError = '';
  let lastOAuthDetails: unknown = undefined;

  if (clientId && clientSecret) {
    for (const tokenUrl of tokenUrls) {
      for (let i = 0; i < scopeCandidates.length; i++) {
        const scope = scopeCandidates[i];
        try {
          const oauthResult = await fetchOAuthToken(tokenUrl, clientId, clientSecret, scope);

          if (oauthResult.ok && oauthResult.accessToken) {
            cachedTokens[cacheKey] = {
              token: oauthResult.accessToken,
              baseUrl,
              tokenUrl,
              expiresAt: Date.now() + (oauthResult.expiresIn || 2592000) * 1000,
            };
            return {
              ok: true,
              token: cachedTokens[cacheKey]!.token,
              baseUrl,
              tokenUrl,
              fromCache: false,
            };
          }

          lastOAuthStatus = oauthResult.status || 401;
          lastOAuthDetails = oauthResult.parsed || { raw: oauthResult.rawText };
          lastOAuthError =
            oauthResult.parsed?.error_description ||
            oauthResult.parsed?.error ||
            oauthResult.rawText ||
            `OAuth failed (${lastOAuthStatus})`;

          const isInvalidScope =
            oauthResult.status === 400 &&
            oauthResult.rawText.toLowerCase().includes('invalid_scope');
          if (isInvalidScope && i < scopeCandidates.length - 1) {
            continue;
          }
          if (oauthResult.status === 400 && i < scopeCandidates.length - 1) {
            continue;
          }
          break;
        } catch (oauthErr) {
          lastOAuthStatus = 502;
          lastOAuthError =
            oauthErr instanceof Error
              ? `Uber OAuth Fetch Error: ${oauthErr.message}`
              : 'Uber OAuth Fetch Error';
          break;
        }
      }
    }
  }

  const fallbackToken = targetSandbox
    ? process.env.UBER_SANDBOX_ACCESS_TOKEN ||
      process.env.UBER_ACCESS_TOKEN ||
      process.env.UBER_EATS_ACCESS_TOKEN ||
      mongoAccessToken
    : process.env.UBER_PROD_TOKEN ||
      process.env.UBER_ACCESS_TOKEN ||
      process.env.UBER_EATS_ACCESS_TOKEN ||
      mongoAccessToken;

  if (isUsableToken(fallbackToken)) {
    return {
      ok: true,
      token: fallbackToken.trim(),
      baseUrl,
      tokenUrl: 'env_or_db_static_token',
      fromCache: false,
    };
  }

  return {
    ok: false,
    status: lastOAuthStatus,
    error:
      lastOAuthError ||
      'Missing Uber Client ID / Client Secret in environment variables (UBER_CLIENT_ID / UBER_CLIENT_SECRET) and MongoDB settings',
    details: lastOAuthDetails,
    hasCredentials: Boolean(clientId && clientSecret),
  };
}

export async function getUberAccessTokenWithMeta(
  isSandbox = isUberSandboxMode()
): Promise<{ token: string; tokenUrl: string; baseUrl: string } | null> {
  const order = isSandbox ? [true, false] : [false, true];
  for (const targetSandbox of order) {
    const res = await getTokenForSpecificEnv(targetSandbox);
    if (res.ok && res.token) {
      return {
        token: res.token,
        tokenUrl: res.tokenUrl || 'https://auth.uber.com/oauth/v2/token',
        baseUrl: res.baseUrl || getUberBaseUrl(targetSandbox),
      };
    }
  }
  return null;
}

export async function getUberAccessToken(isSandbox = isUberSandboxMode()): Promise<string | null> {
  const meta = await getUberAccessTokenWithMeta(isSandbox);
  return meta?.token || null;
}

export async function executeUberOrderAction(params: {
  orderId: string;
  action: UberOrderAction;
  reason?: string;
  isSandbox?: boolean;
}) {
  const isSandbox = params.isSandbox ?? isUberSandboxMode();
  const cleanOrderId = encodeURIComponent(params.orderId.trim());

  let path = '';
  let payload: Record<string, unknown> = {};
  let nextStatus: OrderStatus = 'ACCEPTED';

  switch (params.action) {
    case 'ACCEPT':
      path = `/v1/eats/orders/${cleanOrderId}/accept_pos_order`;
      payload = {
        reason: params.reason || 'POS_ACCEPTED',
      };
      nextStatus = 'ACCEPTED';
      break;

    case 'READY':
      path = `/v1/eats/orders/${cleanOrderId}/restaurant_order_ready`;
      payload = {};
      nextStatus = 'READY_FOR_PICKUP';
      break;

    case 'CANCEL':
      path = `/v1/eats/orders/${cleanOrderId}/deny_pos_order`;
      payload = {
        reason: {
          code: params.reason || 'POS_NOT_READY',
          explanation: 'Order cancelled from WOW TEK OMS',
        },
      };
      nextStatus = 'CANCELLED';
      break;
  }

  const invokeUberEndpoint = async (authToken: string, apiBase: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const endpointUrl = `${apiBase}${path}`;
    try {
      const res = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
        signal: controller.signal,
      });
      return { res, endpointUrl };
    } finally {
      clearTimeout(timeoutId);
    }
  };

  // Try sandbox first when in sandbox mode (or default auto-detect), and fall back to the other environment on 401
  const envMode = (process.env.UBER_ENV || '').trim().toLowerCase();
  const envOrder: boolean[] =
    params.isSandbox !== undefined
      ? [params.isSandbox, !params.isSandbox]
      : envMode.includes('prod')
      ? [false, true]
      : [true, false];

  let anyCredentialsConfigured = false;
  let lastFailure: {
    status: number;
    url: string;
    error: string;
    uberResponse: unknown;
  } | null = null;

  for (const targetSandbox of envOrder) {
    const initialTokenRes = await getTokenForSpecificEnv(targetSandbox);
    if (!initialTokenRes.ok || !initialTokenRes.token || !initialTokenRes.baseUrl) {
      if (initialTokenRes.hasCredentials) anyCredentialsConfigured = true;
      lastFailure = {
        status: initialTokenRes.status || 401,
        url: targetSandbox
          ? 'https://sandbox-login.uber.com/oauth/v2/token'
          : 'https://login.uber.com/oauth/v2/token',
        error: initialTokenRes.error || 'Invalid OAuth 2.0 credentials provided.',
        uberResponse: initialTokenRes.details,
      };
      continue;
    }

    let currentToken = initialTokenRes.token;
    const currentBaseUrl = initialTokenRes.baseUrl;
    anyCredentialsConfigured = true;

    const candidateHosts = Array.from(
      new Set([
        currentBaseUrl,
        'https://test-api.uber.com',
        'https://api.uber.com',
        'https://sandbox-api.uber.com',
      ])
    );

    let stopEnvLoop = false;
    for (const host of candidateHosts) {
      let { res: response, endpointUrl: url } = await invokeUberEndpoint(currentToken, host);

      // Cached token expired -> clear cache and retry this host once
      if (response.status === 401 && initialTokenRes.fromCache) {
        clearUberAccessTokenCache(targetSandbox);
        const refreshed = await getTokenForSpecificEnv(targetSandbox, { forceRefresh: true });
        if (refreshed.ok && refreshed.token) {
          currentToken = refreshed.token;
          const retried = await invokeUberEndpoint(currentToken, host);
          response = retried.res;
          url = retried.endpointUrl;
        }
      }

      const text = await response.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (response.ok) {
        return {
          ok: true,
          status: response.status,
          url,
          env: host,
          nextStatus,
          uberResponse: data,
        };
      }

      lastFailure = {
        status: response.status,
        url,
        error: data?.message || data?.error || `Uber API error (${response.status})`,
        uberResponse: data,
      };

      // Non-401 means auth succeeded and the Uber endpoint itself responded (e.g. 400 / 404 / 409)
      if (response.status !== 401) {
        stopEnvLoop = true;
        break;
      }
    }

    if (stopEnvLoop) {
      break;
    }
    clearUberAccessTokenCache(targetSandbox);
  }

  if (!anyCredentialsConfigured) {
    throw new Error(
      'Missing Uber Client ID / Client Secret in environment variables (UBER_CLIENT_ID / UBER_CLIENT_SECRET) and MongoDB settings'
    );
  }

  return {
    ok: false,
    status: lastFailure?.status || 401,
    url: lastFailure?.url || '',
    error: lastFailure?.error || 'Invalid OAuth 2.0 credentials provided.',
    uberResponse: lastFailure?.uberResponse,
  };
}
