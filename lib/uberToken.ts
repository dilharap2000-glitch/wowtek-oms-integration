import type { OrderStatus } from '@/types';

type CachedToken = {
  token: string;
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

function isUsableToken(token?: string | null): token is string {
  if (!token) return false;
  const trimmed = token.trim();
  if (!trimmed) return false;
  if (trimmed === 'YOUR_UBER_ACCESS_TOKEN') return false;
  if (trimmed.startsWith('your_uber_')) return false;
  return true;
}

export function isUberSandboxMode(): boolean {
  const envMode = (process.env.UBER_ENV || '').trim().toLowerCase();
  if (envMode.includes('sandbox') || envMode.includes('test')) return true;
  if (envMode.includes('prod')) return false;
  return !(
    isUsableToken(process.env.UBER_PROD_TOKEN) ||
    Boolean(process.env.UBER_PROD_CLIENT_ID && process.env.UBER_PROD_CLIENT_SECRET)
  );
}

export function getUberBaseUrl(isSandbox: boolean): string {
  return isSandbox
    ? process.env.UBER_SANDBOX_BASE_URL || 'https://sandbox-api.uber.com'
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

function getUberClientCredentials(isSandbox: boolean): {
  clientId?: string;
  clientSecret?: string;
} {
  const clientId = (
    isSandbox
      ? process.env.UBER_SANDBOX_CLIENT_ID || process.env.UBER_CLIENT_ID || process.env.ClientID
      : process.env.UBER_PROD_CLIENT_ID || process.env.UBER_CLIENT_ID || process.env.ClientID
  )?.trim();

  const clientSecret = (
    isSandbox
      ? process.env.UBER_SANDBOX_CLIENT_SECRET || process.env.UBER_CLIENT_SECRET || process.env.ClientSecret
      : process.env.UBER_PROD_CLIENT_SECRET || process.env.UBER_CLIENT_SECRET || process.env.ClientSecret
  )?.trim();

  return {
    clientId: isUsableToken(clientId) ? clientId : undefined,
    clientSecret: isUsableToken(clientSecret) ? clientSecret : undefined,
  };
}

export function hasUberCredentialsConfigured(isSandbox: boolean): boolean {
  const { clientId, clientSecret } = getUberClientCredentials(isSandbox);
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
  clientId: string,
  clientSecret: string,
  scope: string
): Promise<{ ok: boolean; status: number; accessToken?: string; expiresIn?: number; rawText: string; parsed: any }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope,
    });

    const res = await fetch('https://login.uber.com/oauth/v2/token', {
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

export async function getUberAccessToken(isSandbox = isUberSandboxMode()): Promise<string | null> {
  const cacheKey = isSandbox ? 'sandbox' : 'production';
  const existing = cachedTokens[cacheKey];

  // 1. Cache එකේ valid token එකක් තියෙනවා නම් (expiry එකට තත්පර 60කට වඩා තියෙනවා නම්) ඒක දෙන්න
  if (existing && Date.now() < existing.expiresAt - 60_000) {
    return existing.token;
  }

  // 2. Client ID + Client Secret වලින් OAuth token එක auto fetch කරන්න
  const { clientId, clientSecret } = getUberClientCredentials(isSandbox);
  const configuredScope = process.env.UBER_OAUTH_SCOPE?.trim();
  const primaryScope = configuredScope || 'eats.order eats.store.orders.read eats.pos_provisioning';

  if (clientId && clientSecret) {
    try {
      let oauthResult = await fetchOAuthToken(clientId, clientSecret, primaryScope);

      // If default scope includes eats.pos_provisioning and the Uber app hasn't enabled it, fall back cleanly
      if (
        !oauthResult.ok &&
        !configuredScope &&
        oauthResult.status === 400 &&
        oauthResult.rawText.toLowerCase().includes('invalid_scope')
      ) {
        oauthResult = await fetchOAuthToken(clientId, clientSecret, 'eats.order eats.store.orders.read');
      }

      if (oauthResult.ok && oauthResult.accessToken) {
        cachedTokens[cacheKey] = {
          token: oauthResult.accessToken,
          expiresAt: Date.now() + (oauthResult.expiresIn || 2592000) * 1000,
        };
        return cachedTokens[cacheKey]!.token;
      }

      console.error(
        '[Uber OAuth Refresh Failed]:',
        oauthResult.status,
        oauthResult.parsed?.error_description || oauthResult.parsed?.error || oauthResult.rawText
      );
    } catch (oauthErr) {
      console.error('[Uber OAuth Fetch Error]:', oauthErr);
    }
  }

  // 3. Fallback: Environment variable එකේ තියෙන static token එක
  const fallbackToken = isSandbox
    ? process.env.UBER_SANDBOX_ACCESS_TOKEN ||
      process.env.UBER_ACCESS_TOKEN ||
      process.env.UBER_EATS_ACCESS_TOKEN
    : process.env.UBER_PROD_TOKEN ||
      process.env.UBER_ACCESS_TOKEN ||
      process.env.UBER_EATS_ACCESS_TOKEN;

  return isUsableToken(fallbackToken) ? fallbackToken.trim() : null;
}

export async function executeUberOrderAction(params: {
  orderId: string;
  action: UberOrderAction;
  reason?: string;
  isSandbox?: boolean;
}) {
  const isSandbox = params.isSandbox ?? isUberSandboxMode();
  const baseUrl = getUberBaseUrl(isSandbox);
  const cleanOrderId = encodeURIComponent(params.orderId.trim());

  let token = await getUberAccessToken(isSandbox);
  if (!token) {
    throw new Error(
      'Uber OAuth credentials (UBER_CLIENT_ID / UBER_CLIENT_SECRET හෝ ClientID / ClientSecret) හෝ Access Token සෙට් කර නැත'
    );
  }

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

  const url = `${baseUrl}${path}`;

  const invokeUberEndpoint = async (authToken: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      return await fetch(url, {
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
    } finally {
      clearTimeout(timeoutId);
    }
  };

  let response = await invokeUberEndpoint(token);

  // Token expire වෙලා 401 ආවොත් cache clear කරලා එක පාරක් retry කරන්න
  if (response.status === 401) {
    clearUberAccessTokenCache(isSandbox);
    const refreshedToken = await getUberAccessToken(isSandbox);
    if (refreshedToken && refreshedToken !== token) {
      token = refreshedToken;
      response = await invokeUberEndpoint(token);
    }
  }

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearUberAccessTokenCache(isSandbox);
    }
    return {
      ok: false,
      status: response.status,
      url,
      error: data?.message || data?.error || `Uber API error (${response.status})`,
      uberResponse: data,
    };
  }

  return {
    ok: true,
    status: response.status,
    url,
    nextStatus,
    uberResponse: data,
  };
}
