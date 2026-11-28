import crypto from 'node:crypto';
import type { OrderStatus } from '@/types';
import { connectToMongoDB } from '@/lib/mongodb';

export type UberEnvironment = 'sandbox' | 'production';
export type UberOrderAction = 'ACCEPT' | 'READY' | 'CANCEL';

type CachedToken = {
  env: UberEnvironment;
  token: string;
  baseUrl: string;
  tokenUrl: string;
  scope: string;
  credentialsFingerprint: string;
  expiresAt: number;
};

const cachedTokensByKey = new Map<string, CachedToken>();

const DUMMY_CREDENTIAL_VALUES = new Set([
  'YOUR_UBER_ACCESS_TOKEN',
  'YOUR_UBER_SANDBOX_ACCESS_TOKEN',
  'YOUR_UBER_EATS_ACCESS_TOKEN',
  'YOUR_UBER_CLIENT_ID',
  'YOUR_UBER_CLIENT_SECRET',
  'uber_client_id_lk_881920',
  'ubr_sec_9941a87b003',
]);

function isUsableToken(token?: string | null): token is string {
  if (!token) return false;
  const trimmed = token.trim();
  if (!trimmed) return false;
  if (DUMMY_CREDENTIAL_VALUES.has(trimmed)) return false;
  if (DUMMY_CREDENTIAL_VALUES.has(trimmed.toUpperCase())) return false;
  if (trimmed.toLowerCase().startsWith('your_uber_')) return false;
  return true;
}

function normalizeHostUrl(raw?: string | null): string {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/\/v\d+\/eats\/?$/i, '')
    .replace(/\/+$/, '');
}

function isSandboxHost(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('sandbox-api.uber.com') ||
    lower.includes('test-api.uber.com') ||
    lower.includes('sandbox-login.uber.com') ||
    lower.includes('sandbox')
  );
}

function isProductionHost(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    (lower.includes('api.uber.com') && !isSandboxHost(lower)) ||
    lower.includes('auth.uber.com') ||
    lower.includes('login.uber.com')
  );
}

function hashCredentialsFingerprint(
  env: UberEnvironment,
  tokenUrl: string,
  baseUrl: string,
  clientId: string,
  clientSecret: string
): string {
  return crypto
    .createHash('sha256')
    .update(`${env}|${tokenUrl}|${baseUrl}|${clientId}|${clientSecret}`)
    .digest('hex')
    .slice(0, 24);
}

function getExplicitEnvMode(): UberEnvironment | null {
  const envMode = (process.env.UBER_ENV || '').trim().toLowerCase();
  if (!envMode) return null;
  if (envMode.includes('sandbox') || envMode.includes('test')) return 'sandbox';
  if (envMode.includes('prod') || envMode.includes('live')) return 'production';
  return null;
}

function hasSandboxSpecificEnvCreds(): boolean {
  const sbId = process.env.UBER_SANDBOX_CLIENT_ID;
  const sbSecret = process.env.UBER_SANDBOX_CLIENT_SECRET;
  const sbToken = process.env.UBER_SANDBOX_ACCESS_TOKEN;
  return Boolean((isUsableToken(sbId) && isUsableToken(sbSecret)) || isUsableToken(sbToken));
}

function hasProdSpecificEnvCreds(): boolean {
  const prodId = process.env.UBER_PROD_CLIENT_ID;
  const prodSecret = process.env.UBER_PROD_CLIENT_SECRET;
  const prodToken = process.env.UBER_PROD_TOKEN;
  return Boolean((isUsableToken(prodId) && isUsableToken(prodSecret)) || isUsableToken(prodToken));
}

export function resolveUberEnvironment(explicitSandbox?: boolean): UberEnvironment {
  if (explicitSandbox !== undefined) {
    return explicitSandbox ? 'sandbox' : 'production';
  }

  const explicitEnv = getExplicitEnvMode();
  if (explicitEnv) {
    return explicitEnv;
  }

  const hasProdCreds = hasProdSpecificEnvCreds();
  const hasSandboxCreds = hasSandboxSpecificEnvCreds();

  if (hasProdCreds && !hasSandboxCreds) return 'production';
  if (hasSandboxCreds && !hasProdCreds) return 'sandbox';

  const baseHint = (process.env.UBER_BASE_URL || process.env.UBER_API_BASE_URL || '').trim();
  if (baseHint && isSandboxHost(baseHint)) {
    return 'sandbox';
  }

  return 'production';
}

export function isUberSandboxMode(): boolean {
  return resolveUberEnvironment() === 'sandbox';
}

export function getUberBaseUrl(isSandbox: boolean): string {
  if (isSandbox) {
    const candidate = normalizeHostUrl(process.env.UBER_SANDBOX_BASE_URL);
    if (candidate && isSandboxHost(candidate)) {
      return candidate;
    }
    return 'https://test-api.uber.com';
  }

  const prodCandidate = normalizeHostUrl(
    process.env.UBER_PROD_BASE_URL ||
      process.env.UBER_BASE_URL ||
      process.env.UBER_API_BASE_URL
  );
  if (prodCandidate && isProductionHost(prodCandidate)) {
    return prodCandidate;
  }
  return 'https://api.uber.com';
}

export function getUberTokenUrl(isSandbox: boolean): string {
  if (isSandbox) {
    const customSandboxTokenUrl = (process.env.UBER_SANDBOX_TOKEN_URL || '').trim();
    if (customSandboxTokenUrl && isSandboxHost(customSandboxTokenUrl)) {
      return customSandboxTokenUrl;
    }
    return 'https://sandbox-login.uber.com/oauth/v2/token';
  }

  const customProdTokenUrl = (process.env.UBER_PROD_TOKEN_URL || '').trim();
  if (customProdTokenUrl && isProductionHost(customProdTokenUrl)) {
    return customProdTokenUrl;
  }
  return 'https://auth.uber.com/oauth/v2/token';
}

export function clearUberAccessTokenCache(isSandbox?: boolean): void {
  if (isSandbox === undefined) {
    cachedTokensByKey.clear();
    return;
  }
  const targetEnv: UberEnvironment = isSandbox ? 'sandbox' : 'production';
  for (const [key, entry] of cachedTokensByKey.entries()) {
    if (entry.env === targetEnv) {
      cachedTokensByKey.delete(key);
    }
  }
}

function getUberClientCredentialsFromEnv(isSandbox: boolean): {
  clientId?: string;
  clientSecret?: string;
  source?: 'env_sandbox' | 'env_prod' | 'env_generic';
} {
  const explicitEnv = getExplicitEnvMode();

  if (isSandbox) {
    const sbId = process.env.UBER_SANDBOX_CLIENT_ID?.trim();
    const sbSecret = process.env.UBER_SANDBOX_CLIENT_SECRET?.trim();
    if (isUsableToken(sbId) && isUsableToken(sbSecret)) {
      return { clientId: sbId, clientSecret: sbSecret, source: 'env_sandbox' };
    }

    // Only reuse generic UBER_CLIENT_ID / UBER_CLIENT_SECRET in sandbox when production isn't explicitly forced
    if (explicitEnv !== 'production' && !hasProdSpecificEnvCreds()) {
      const genericId = (
        process.env.UBER_CLIENT_ID ||
        process.env.ClientID ||
        process.env.OAuth_ClientID
      )?.trim();
      const genericSecret = (
        process.env.UBER_CLIENT_SECRET ||
        process.env.ClientSecret ||
        process.env.OAuth_ClientSecret
      )?.trim();
      if (isUsableToken(genericId) && isUsableToken(genericSecret)) {
        return { clientId: genericId, clientSecret: genericSecret, source: 'env_generic' };
      }
    }

    return {};
  }

  const prodId = process.env.UBER_PROD_CLIENT_ID?.trim();
  const prodSecret = process.env.UBER_PROD_CLIENT_SECRET?.trim();
  if (isUsableToken(prodId) && isUsableToken(prodSecret)) {
    return { clientId: prodId, clientSecret: prodSecret, source: 'env_prod' };
  }

  // Only reuse generic UBER_CLIENT_ID / UBER_CLIENT_SECRET in production when sandbox isn't explicitly active
  if (explicitEnv !== 'sandbox' && !hasSandboxSpecificEnvCreds()) {
    const genericId = (
      process.env.UBER_CLIENT_ID ||
      process.env.ClientID ||
      process.env.OAuth_ClientID
    )?.trim();
    const genericSecret = (
      process.env.UBER_CLIENT_SECRET ||
      process.env.ClientSecret ||
      process.env.OAuth_ClientSecret
    )?.trim();
    if (isUsableToken(genericId) && isUsableToken(genericSecret)) {
      return { clientId: genericId, clientSecret: genericSecret, source: 'env_generic' };
    }
  }

  return {};
}

function getStaticFallbackTokenFromEnv(isSandbox: boolean): string | undefined {
  const explicitEnv = getExplicitEnvMode();

  if (isSandbox) {
    const sbToken = process.env.UBER_SANDBOX_ACCESS_TOKEN?.trim();
    if (isUsableToken(sbToken)) return sbToken;

    if (explicitEnv === 'sandbox' && !hasProdSpecificEnvCreds()) {
      const generic = (
        process.env.UBER_ACCESS_TOKEN || process.env.UBER_EATS_ACCESS_TOKEN
      )?.trim();
      if (isUsableToken(generic)) return generic;
    }
    return undefined;
  }

  const prodToken = process.env.UBER_PROD_TOKEN?.trim();
  if (isUsableToken(prodToken)) return prodToken;

  if (explicitEnv !== 'sandbox' && !hasSandboxSpecificEnvCreds()) {
    const generic = (
      process.env.UBER_ACCESS_TOKEN || process.env.UBER_EATS_ACCESS_TOKEN
    )?.trim();
    if (isUsableToken(generic)) return generic;
  }
  return undefined;
}

async function getCredentialsFromMongo(targetEnv: UberEnvironment): Promise<{
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

    // Respect explicit environment marker on DB config if present so Sandbox/Prod creds never mix
    const dbEnvRaw = String(uberDoc?.env || uberDoc?.environment || apiConfig.uberEnv || '')
      .trim()
      .toLowerCase();
    if (dbEnvRaw) {
      const dbIsSandbox = dbEnvRaw.includes('sandbox') || dbEnvRaw.includes('test');
      const dbIsProd = dbEnvRaw.includes('prod') || dbEnvRaw.includes('live');
      if ((targetEnv === 'sandbox' && dbIsProd) || (targetEnv === 'production' && dbIsSandbox)) {
        return {};
      }
    }

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

    // Only return a complete clientId+clientSecret pair from Mongo so partial values don't mix
    if (clientId && clientSecret) {
      return { clientId, clientSecret, accessToken };
    }
    return { accessToken };
  } catch (err) {
    console.warn('[Uber Mongo Credentials Fallback Notice]:', err);
    return {};
  }
}

export function hasUberCredentialsConfigured(isSandbox: boolean): boolean {
  const { clientId, clientSecret } = getUberClientCredentialsFromEnv(isSandbox);
  if (clientId && clientSecret) return true;
  return Boolean(getStaticFallbackTokenFromEnv(isSandbox));
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
  env: UberEnvironment;
  token?: string;
  baseUrl?: string;
  tokenUrl?: string;
  fromCache?: boolean;
  status?: number;
  error?: string;
  details?: unknown;
  hasCredentials?: boolean;
};

function getTokenUrlCandidatesForEnv(targetSandbox: boolean): string[] {
  const primary = getUberTokenUrl(targetSandbox);
  if (targetSandbox) {
    // Strictly Sandbox OAuth only — never auth.uber.com or login.uber.com
    return Array.from(new Set([primary, 'https://sandbox-login.uber.com/oauth/v2/token']));
  }
  // Strictly Production OAuth only — never sandbox-login.uber.com
  return Array.from(new Set([primary, 'https://auth.uber.com/oauth/v2/token']));
}

async function getTokenForSpecificEnv(
  targetSandbox: boolean,
  options?: { forceRefresh?: boolean; requiredScope?: string }
): Promise<EnvTokenResult> {
  const targetEnv: UberEnvironment = targetSandbox ? 'sandbox' : 'production';
  const baseUrl = getUberBaseUrl(targetSandbox);
  const primaryTokenUrl = getUberTokenUrl(targetSandbox);
  const reqScope = options?.requiredScope?.trim();

  const envCreds = getUberClientCredentialsFromEnv(targetSandbox);
  let clientId = envCreds.clientId;
  let clientSecret = envCreds.clientSecret;
  let mongoAccessToken: string | undefined;

  if (!clientId || !clientSecret) {
    const fromDb = await getCredentialsFromMongo(targetEnv);
    if (!clientId && !clientSecret && fromDb.clientId && fromDb.clientSecret) {
      clientId = fromDb.clientId;
      clientSecret = fromDb.clientSecret;
    }
    mongoAccessToken = fromDb.accessToken;
  }

  if (clientId && clientSecret) {
    const credFingerprint = hashCredentialsFingerprint(
      targetEnv,
      primaryTokenUrl,
      baseUrl,
      clientId,
      clientSecret
    );
    const cacheKey = `${targetEnv}:${credFingerprint}`;

    // Invalidate any stale token cached for this environment with different credentials/endpoints
    for (const [k, entry] of cachedTokensByKey.entries()) {
      if (entry.env === targetEnv && k !== cacheKey) {
        cachedTokensByKey.delete(k);
      }
    }

    const existing = cachedTokensByKey.get(cacheKey);
    if (
      !options?.forceRefresh &&
      existing &&
      existing.env === targetEnv &&
      existing.baseUrl === baseUrl &&
      existing.credentialsFingerprint === credFingerprint &&
      Date.now() < existing.expiresAt - 60_000 &&
      (!reqScope || existing.scope.split(/\s+/).includes(reqScope))
    ) {
      return {
        ok: true,
        env: targetEnv,
        token: existing.token,
        baseUrl: existing.baseUrl,
        tokenUrl: existing.tokenUrl,
        fromCache: true,
      };
    }

    const configuredScope = process.env.UBER_OAUTH_SCOPE?.trim();
    const scopeCandidates = reqScope
      ? Array.from(
          new Set(
            [
              reqScope,
              configuredScope && configuredScope.includes(reqScope) ? configuredScope : '',
              'eats.order eats.store.orders.read',
            ].filter(Boolean)
          )
        )
      : configuredScope
      ? [configuredScope, 'eats.order', '']
      : [
          'eats.order eats.store eats.store.orders.read eats.store.orders.write eats.store.status.write eats.pos_provisioning',
          'eats.order',
          '',
        ];

    const tokenUrls = getTokenUrlCandidatesForEnv(targetSandbox);
    let lastOAuthStatus = 401;
    let lastOAuthError = '';
    let lastOAuthDetails: unknown = undefined;

    for (const tokenUrl of tokenUrls) {
      for (let i = 0; i < scopeCandidates.length; i++) {
        const scope = scopeCandidates[i];
        try {
          const oauthResult = await fetchOAuthToken(tokenUrl, clientId, clientSecret, scope);

          if (oauthResult.ok && oauthResult.accessToken) {
            cachedTokensByKey.set(cacheKey, {
              env: targetEnv,
              token: oauthResult.accessToken,
              baseUrl,
              tokenUrl,
              scope,
              credentialsFingerprint: credFingerprint,
              expiresAt: Date.now() + (oauthResult.expiresIn || 2592000) * 1000,
            });
            return {
              ok: true,
              env: targetEnv,
              token: oauthResult.accessToken,
              baseUrl,
              tokenUrl,
              fromCache: false,
            };
          }

          lastOAuthStatus = oauthResult.status || 401;
          lastOAuthDetails = oauthResult.parsed || { raw: oauthResult.rawText };
          const rawOAuthErr =
            oauthResult.parsed?.error_description ||
            oauthResult.parsed?.error ||
            oauthResult.rawText ||
            `OAuth failed (${lastOAuthStatus})`;

          const isEnvMismatch =
            lastOAuthStatus === 401 &&
            /environment\s+is\s+mismatched|mismatched\s+with\s+the\s+oauth\s+server/i.test(
              String(rawOAuthErr)
            );

          lastOAuthError = isEnvMismatch
            ? `${rawOAuthErr} (OMS runtime is configured for ${targetEnv.toUpperCase()} via ${tokenUrl}; ensure UBER_ENV and Client ID/Secret belong to the ${targetEnv} Uber app).`
            : String(rawOAuthErr);

          console.error('[Uber OAuth Token Rejection]:', {
            env: targetEnv,
            tokenUrl,
            baseUrl,
            status: lastOAuthStatus,
            scope: scope || '(default)',
            error: lastOAuthError,
          });

          if (isEnvMismatch) {
            clearUberAccessTokenCache(targetSandbox);
            return {
              ok: false,
              env: targetEnv,
              status: 401,
              tokenUrl,
              baseUrl,
              error: lastOAuthError,
              details: lastOAuthDetails,
              hasCredentials: true,
            };
          }

          if (
            (oauthResult.status === 400 || oauthResult.status === 401 || oauthResult.status === 403) &&
            i < scopeCandidates.length - 1
          ) {
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

    // If OAuth credentials were explicitly configured for this environment and failed,
    // never silently mask an auth/environment failure with an arbitrary static token unless it is env-specific
    const envSpecificStatic = targetSandbox
      ? process.env.UBER_SANDBOX_ACCESS_TOKEN?.trim()
      : process.env.UBER_PROD_TOKEN?.trim();

    if (isUsableToken(envSpecificStatic)) {
      return {
        ok: true,
        env: targetEnv,
        token: envSpecificStatic,
        baseUrl,
        tokenUrl: 'env_specific_static_token',
        fromCache: false,
      };
    }

    return {
      ok: false,
      env: targetEnv,
      status: lastOAuthStatus,
      tokenUrl: primaryTokenUrl,
      baseUrl,
      error: lastOAuthError,
      details: lastOAuthDetails,
      hasCredentials: true,
    };
  }

  const fallbackToken = getStaticFallbackTokenFromEnv(targetSandbox) || mongoAccessToken;
  if (isUsableToken(fallbackToken)) {
    return {
      ok: true,
      env: targetEnv,
      token: fallbackToken.trim(),
      baseUrl,
      tokenUrl: 'env_or_db_static_token',
      fromCache: false,
    };
  }

  const missingVars = targetSandbox
    ? 'UBER_SANDBOX_CLIENT_ID / UBER_SANDBOX_CLIENT_SECRET (or UBER_CLIENT_ID / UBER_CLIENT_SECRET with UBER_ENV=sandbox)'
    : 'UBER_PROD_CLIENT_ID / UBER_PROD_CLIENT_SECRET (or UBER_CLIENT_ID / UBER_CLIENT_SECRET with UBER_ENV=production)';

  return {
    ok: false,
    env: targetEnv,
    status: 401,
    tokenUrl: primaryTokenUrl,
    baseUrl,
    error: `Missing Uber ${targetEnv} Client ID / Client Secret (${missingVars}).`,
    hasCredentials: false,
  };
}

export interface UberTokenAttempt {
  ok: boolean;
  env?: UberEnvironment;
  token?: string;
  tokenUrl?: string;
  baseUrl?: string;
  status?: number;
  error?: string;
  details?: unknown;
  hasCredentials: boolean;
}

export async function getUberAccessTokenAttempt(
  isSandbox = isUberSandboxMode()
): Promise<UberTokenAttempt> {
  const targetSandbox = resolveUberEnvironment(isSandbox) === 'sandbox';
  const res = await getTokenForSpecificEnv(targetSandbox);
  if (res.ok && res.token) {
    return {
      ok: true,
      env: res.env,
      token: res.token,
      tokenUrl: res.tokenUrl || getUberTokenUrl(targetSandbox),
      baseUrl: res.baseUrl || getUberBaseUrl(targetSandbox),
      hasCredentials: true,
    };
  }
  return {
    ok: false,
    env: res.env,
    status: res.status || 401,
    tokenUrl: res.tokenUrl || getUberTokenUrl(targetSandbox),
    baseUrl: res.baseUrl || getUberBaseUrl(targetSandbox),
    error:
      res.error ||
      `Missing Uber ${targetSandbox ? 'sandbox' : 'production'} credentials.`,
    details: res.details,
    hasCredentials: Boolean(res.hasCredentials),
  };
}

export async function getUberAccessTokenWithMeta(
  isSandbox = isUberSandboxMode()
): Promise<{ token: string; tokenUrl: string; baseUrl: string; env: UberEnvironment } | null> {
  const attempt = await getUberAccessTokenAttempt(isSandbox);
  return attempt.ok && attempt.token
    ? {
        token: attempt.token,
        tokenUrl: attempt.tokenUrl || getUberTokenUrl(isSandbox),
        baseUrl: attempt.baseUrl || getUberBaseUrl(isSandbox),
        env: attempt.env || (isSandbox ? 'sandbox' : 'production'),
      }
    : null;
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
  const targetEnv = resolveUberEnvironment(params.isSandbox);
  const targetSandbox = targetEnv === 'sandbox';
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

  // Obtain OAuth token strictly for the single resolved environment (never mix Sandbox <-> Production)
  const initialTokenRes = await getTokenForSpecificEnv(targetSandbox, {
    requiredScope: 'eats.order',
  });

  if (!initialTokenRes.ok || !initialTokenRes.token || !initialTokenRes.baseUrl) {
    if (!initialTokenRes.hasCredentials) {
      throw new Error(
        initialTokenRes.error ||
          `Missing Uber ${targetEnv} Client ID / Client Secret in environment variables.`
      );
    }
    return {
      ok: false,
      status: initialTokenRes.status || 401,
      url: initialTokenRes.tokenUrl || getUberTokenUrl(targetSandbox),
      env: targetEnv,
      error:
        initialTokenRes.error ||
        `Uber ${targetEnv} OAuth authentication failed (check credentials and eats.order scope).`,
      uberResponse: initialTokenRes.details,
    };
  }

  let currentToken = initialTokenRes.token;
  const currentBaseUrl = initialTokenRes.baseUrl;

  // Only target hosts belonging to the same environment as the OAuth token
  const candidateHosts = targetSandbox
    ? Array.from(
        new Set(
          [currentBaseUrl, 'https://test-api.uber.com', 'https://sandbox-api.uber.com'].filter(
            (h) => isSandboxHost(h)
          )
        )
      )
    : Array.from(
        new Set(
          [currentBaseUrl, 'https://api.uber.com'].filter((h) => isProductionHost(h))
        )
      );

  let lastFailure: {
    status: number;
    url: string;
    error: string;
    uberResponse: unknown;
  } | null = null;

  for (const host of candidateHosts) {
    let { res: response, endpointUrl: url } = await invokeUberEndpoint(currentToken, host);

    // Cached token expired or rotated -> invalidate cache and re-authenticate within the SAME environment once
    if (response.status === 401 && initialTokenRes.fromCache) {
      clearUberAccessTokenCache(targetSandbox);
      const refreshed = await getTokenForSpecificEnv(targetSandbox, {
        forceRefresh: true,
        requiredScope: 'eats.order',
      });
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

    if (response.status === 204 || response.ok) {
      return {
        ok: true,
        status: response.status,
        url,
        env: `${targetEnv} (${host})`,
        nextStatus,
        uberResponse: data,
      };
    }

    const rawErr =
      data?.message ||
      data?.error_description ||
      data?.error ||
      (typeof data?.raw === 'string' && data.raw) ||
      `Uber API rejected request (HTTP ${response.status})`;

    const isEnvMismatch =
      response.status === 401 &&
      /environment\s+is\s+mismatched|mismatched\s+with\s+the\s+oauth\s+server/i.test(String(rawErr));

    lastFailure = {
      status: response.status,
      url,
      error: isEnvMismatch
        ? `${rawErr} (Token from ${initialTokenRes.tokenUrl} sent to ${host} in ${targetEnv} mode).`
        : String(rawErr),
      uberResponse: data,
    };

    console.error('[Uber API Order Action Rejected]:', {
      env: targetEnv,
      tokenUrl: initialTokenRes.tokenUrl,
      action: params.action,
      orderId: params.orderId,
      url,
      status: response.status,
      error: lastFailure.error,
      uberResponse: data,
    });

    if (response.status === 401) {
      clearUberAccessTokenCache(targetSandbox);
      break;
    }

    // Stop immediately on definitive order/permission rejections; only try alternate same-env host on 404
    if (response.status !== 404) {
      break;
    }
  }

  return {
    ok: false,
    status: lastFailure?.status || 401,
    url: lastFailure?.url || '',
    env: targetEnv,
    error: lastFailure?.error || 'Invalid OAuth 2.0 credentials provided.',
    uberResponse: lastFailure?.uberResponse,
  };
}

export interface UberOrderActionResult {
  ok: boolean;
  status: number;
  url: string;
  env?: string;
  nextStatus?: OrderStatus;
  error?: string;
  uberResponse?: unknown;
}

/**
 * Authenticates with Uber Eats OAuth 2.0 (eats.order scope),
 * sends POST /v1/eats/orders/{order_id}/accept_pos_order,
 * and returns the verified result (HTTP 204 = accepted on Uber Eats).
 */
export async function acceptUberEatsOrder(
  orderId: string,
  options?: { reason?: string; isSandbox?: boolean }
): Promise<UberOrderActionResult> {
  const cleanOrderId = String(orderId || '').trim();
  if (!cleanOrderId) {
    return {
      ok: false,
      status: 400,
      url: '',
      error: 'Uber Eats orderId is required.',
    };
  }

  const result = await executeUberOrderAction({
    orderId: cleanOrderId,
    action: 'ACCEPT',
    reason: options?.reason || 'POS_ACCEPTED',
    isSandbox: options?.isSandbox,
  });

  if (result.status !== 204) {
    return {
      ...result,
      ok: false,
      error:
        result.error ||
        `Uber Eats returned HTTP ${result.status} (expected HTTP 204 No Content)`,
    };
  }

  return result;
}

