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

function isUsableToken(token?: string | null): token is string {
  if (!token) return false;
  const trimmed = token.trim();
  if (!trimmed) return false;
  if (trimmed === 'YOUR_UBER_ACCESS_TOKEN') return false;
  if (trimmed.startsWith('your_uber_')) return false;
  return true;
}

export function isUberSandboxMode(): boolean {
  const envMode = process.env.UBER_ENV?.trim().toLowerCase();
  if (envMode === 'sandbox') return true;
  if (envMode === 'production' || envMode === 'prod') return false;
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

export function hasUberCredentialsConfigured(isSandbox: boolean): boolean {
  const clientId = isSandbox
    ? process.env.UBER_SANDBOX_CLIENT_ID || process.env.UBER_CLIENT_ID
    : process.env.UBER_PROD_CLIENT_ID || process.env.UBER_CLIENT_ID;
  const clientSecret = isSandbox
    ? process.env.UBER_SANDBOX_CLIENT_SECRET || process.env.UBER_CLIENT_SECRET
    : process.env.UBER_PROD_CLIENT_SECRET || process.env.UBER_CLIENT_SECRET;

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

export async function getUberAccessToken(isSandbox: boolean): Promise<string | null> {
  const cacheKey = isSandbox ? 'sandbox' : 'production';
  const existing = cachedTokens[cacheKey];

  // 1. Cache එකේ valid token එකක් තියෙනවා නම් (expiry එකට තත්පර 60කට වඩා තියෙනවා නම්) ඒක දෙන්න
  if (existing && Date.now() < existing.expiresAt - 60_000) {
    return existing.token;
  }

  // 2. Client ID + Client Secret වලින් OAuth token එක auto fetch කරන්න
  const clientId = isSandbox
    ? process.env.UBER_SANDBOX_CLIENT_ID || process.env.UBER_CLIENT_ID
    : process.env.UBER_PROD_CLIENT_ID || process.env.UBER_CLIENT_ID;

  const clientSecret = isSandbox
    ? process.env.UBER_SANDBOX_CLIENT_SECRET || process.env.UBER_CLIENT_SECRET
    : process.env.UBER_PROD_CLIENT_SECRET || process.env.UBER_CLIENT_SECRET;

  const scope = process.env.UBER_OAUTH_SCOPE || 'eats.order eats.store.orders.read';

  if (clientId && clientSecret) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        scope,
      });

      const res = await fetch('https://login.uber.com/oauth/v2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal: controller.signal,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          const expiresInSec = Number(data.expires_in) || 2592000; // default ~30 days
          cachedTokens[cacheKey] = {
            token: data.access_token,
            expiresAt: Date.now() + expiresInSec * 1000,
          };
          return cachedTokens[cacheKey]!.token;
        }
      } else {
        const errText = await res.text();
        console.error('[Uber OAuth Refresh Failed]:', res.status, errText);
      }
    } catch (oauthErr) {
      console.error('[Uber OAuth Fetch Error]:', oauthErr);
    } finally {
      clearTimeout(timeoutId);
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
