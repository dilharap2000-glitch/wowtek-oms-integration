import crypto from 'node:crypto';
import type { OrderStatus } from '@/types';
import { connectToMongoDB } from '@/lib/mongodb';

export type UberEnvironment = 'sandbox' | 'production';
export type UberOrderAction = 'ACCEPT' | 'READY' | 'CANCEL';
export type UberAuthSourceMode = 'auto' | 'mongo' | 'env';

const DEFAULT_TEST_STORE_ID = 'ba8761b9-5679-4bcd-845d-8b0baacf9e5d';

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
  'custom_oauth_client_9941',
]);

export function isUsableUberValue(token?: string | null): token is string {
  if (!token) return false;
  const trimmed = token.trim();
  if (!trimmed) return false;
  if (/^[•*]+$/.test(trimmed)) return false;
  if (DUMMY_CREDENTIAL_VALUES.has(trimmed)) return false;
  if (DUMMY_CREDENTIAL_VALUES.has(trimmed.toUpperCase())) return false;
  if (trimmed.toLowerCase().startsWith('your_uber_')) return false;
  return true;
}

const isUsableToken = isUsableUberValue;

export function maskUberClientId(clientId?: string | null): string | undefined {
  if (!clientId) return undefined;
  const trimmed = clientId.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= 8) return '****';
  return `${trimmed.slice(0, 4)}****${trimmed.slice(-4)}`;
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

function parseUberEnvString(raw: unknown): UberEnvironment | null {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  if (s.includes('sandbox') || s.includes('test')) return 'sandbox';
  if (s.includes('prod') || s.includes('live')) return 'production';
  return null;
}

function normalizeAuthSourceMode(raw: unknown): UberAuthSourceMode {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'mongo' || s === 'db' || s === 'ui') return 'mongo';
  if (s === 'env' || s === 'vercel') return 'env';
  return 'auto';
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

  const envStoreHint = (
    process.env.UBER_STORE_ID ||
    process.env.UBER_SANDBOX_STORE_ID ||
    DEFAULT_TEST_STORE_ID
  ).trim();
  if (envStoreHint === DEFAULT_TEST_STORE_ID) {
    return 'sandbox';
  }

  return 'sandbox';
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

type CredentialSource = 'env_sandbox' | 'env_prod' | 'env_generic' | 'mongo' | 'static_token' | 'none';

function matchGenericEnvPair(): {
  clientId?: string;
  clientSecret?: string;
  credentialPair?: string;
  partialWarning?: string;
} {
  const pairDefs: Array<[string, string]> = [
    ['UBER_CLIENT_ID', 'UBER_CLIENT_SECRET'],
    ['ClientID', 'ClientSecret'],
    ['OAuth_ClientID', 'OAuth_ClientSecret'],
  ];

  let firstPartialWarning: string | undefined;

  for (const [idKey, secretKey] of pairDefs) {
    const rawId = process.env[idKey]?.trim();
    const rawSecret = process.env[secretKey]?.trim();
    const hasId = isUsableToken(rawId);
    const hasSecret = isUsableToken(rawSecret);

    if (hasId && hasSecret) {
      return {
        clientId: rawId,
        clientSecret: rawSecret,
        credentialPair: `${idKey} + ${secretKey}`,
      };
    }

    if (hasId !== hasSecret && !firstPartialWarning) {
      firstPartialWarning = hasId
        ? `${idKey} is set without a matching ${secretKey}.`
        : `${secretKey} is set without a matching ${idKey}.`;
    }
  }

  return firstPartialWarning ? { partialWarning: firstPartialWarning } : {};
}

function getUberClientCredentialsFromEnv(isSandbox: boolean): {
  clientId?: string;
  clientSecret?: string;
  source?: 'env_sandbox' | 'env_prod' | 'env_generic';
  credentialPair?: string;
  partialWarning?: string;
} {
  const explicitEnv = getExplicitEnvMode();

  if (isSandbox) {
    const sbId = process.env.UBER_SANDBOX_CLIENT_ID?.trim();
    const sbSecret = process.env.UBER_SANDBOX_CLIENT_SECRET?.trim();
    const hasSbId = isUsableToken(sbId);
    const hasSbSecret = isUsableToken(sbSecret);

    if (hasSbId && hasSbSecret) {
      return {
        clientId: sbId,
        clientSecret: sbSecret,
        source: 'env_sandbox',
        credentialPair: 'UBER_SANDBOX_CLIENT_ID + UBER_SANDBOX_CLIENT_SECRET',
      };
    }
    if (hasSbId !== hasSbSecret) {
      return {
        partialWarning: hasSbId
          ? 'UBER_SANDBOX_CLIENT_ID is set, but UBER_SANDBOX_CLIENT_SECRET is missing.'
          : 'UBER_SANDBOX_CLIENT_SECRET is set, but UBER_SANDBOX_CLIENT_ID is missing.',
      };
    }

    // Only reuse generic env pairs in sandbox when production isn't explicitly forced
    if (explicitEnv !== 'production' && !hasProdSpecificEnvCreds()) {
      const generic = matchGenericEnvPair();
      if (generic.clientId && generic.clientSecret) {
        return {
          clientId: generic.clientId,
          clientSecret: generic.clientSecret,
          source: 'env_generic',
          credentialPair: generic.credentialPair,
        };
      }
      if (generic.partialWarning) {
        return { partialWarning: generic.partialWarning };
      }
    }

    return {};
  }

  const prodId = process.env.UBER_PROD_CLIENT_ID?.trim();
  const prodSecret = process.env.UBER_PROD_CLIENT_SECRET?.trim();
  const hasProdId = isUsableToken(prodId);
  const hasProdSecret = isUsableToken(prodSecret);

  if (hasProdId && hasProdSecret) {
    return {
      clientId: prodId,
      clientSecret: prodSecret,
      source: 'env_prod',
      credentialPair: 'UBER_PROD_CLIENT_ID + UBER_PROD_CLIENT_SECRET',
    };
  }
  if (hasProdId !== hasProdSecret) {
    return {
      partialWarning: hasProdId
        ? 'UBER_PROD_CLIENT_ID is set, but UBER_PROD_CLIENT_SECRET is missing.'
        : 'UBER_PROD_CLIENT_SECRET is set, but UBER_PROD_CLIENT_ID is missing.',
    };
  }

  // Only reuse generic env pairs in production when sandbox isn't explicitly active
  if (explicitEnv !== 'sandbox' && !hasSandboxSpecificEnvCreds()) {
    const generic = matchGenericEnvPair();
    if (generic.clientId && generic.clientSecret) {
      return {
        clientId: generic.clientId,
        clientSecret: generic.clientSecret,
        source: 'env_generic',
        credentialPair: generic.credentialPair,
      };
    }
    if (generic.partialWarning) {
      return { partialWarning: generic.partialWarning };
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

type MongoUberSettingsSnapshot = {
  envHint: UberEnvironment | null;
  authSource: UberAuthSourceMode;
  storeId?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  partialWarning?: string;
};

async function loadMongoUberSettings(targetEnv?: UberEnvironment): Promise<MongoUberSettingsSnapshot> {
  if (!process.env.MONGODB_URI) {
    return { envHint: null, authSource: 'auto' };
  }

  try {
    const conn = await connectToMongoDB(1);
    if (!conn) return { envHint: null, authSource: 'auto' };
    const { db } = conn;

    const appSettingsDoc = await db.collection('settings').findOne({ id: 'app_settings' });
    const apiConfig = (appSettingsDoc?.apiConfig || {}) as Record<string, unknown>;

    const uberDoc =
      (await db.collection('settings').findOne({ type: 'uber' })) ||
      (await db.collection('settings').findOne({ key: 'uber_eats' })) ||
      (await db.collection('uber_settings').findOne({}));

    const envHint = parseUberEnvString(
      uberDoc?.env || uberDoc?.environment || apiConfig.uberEnv
    );
    const authSource = normalizeAuthSourceMode(
      uberDoc?.authSource || apiConfig.uberAuthSource
    );

    const pickString = (...candidates: unknown[]): string | undefined => {
      for (const value of candidates) {
        if (typeof value === 'string' && isUsableToken(value)) {
          return value.trim();
        }
      }
      return undefined;
    };

    const storeId = pickString(
      uberDoc?.storeId,
      uberDoc?.store_id,
      apiConfig.uberEatsStoreId
    );

    // Prevent mixing sandbox/production Mongo credentials when targetEnv is explicitly opposite
    if (targetEnv && envHint && envHint !== targetEnv) {
      return { envHint, authSource, storeId };
    }

    const uberDocId = pickString(
      uberDoc?.clientId,
      uberDoc?.ClientID,
      uberDoc?.OAuth_ClientID,
      uberDoc?.oauthClientId,
      uberDoc?.uberEatsClientId
    );
    const uberDocSecret = pickString(
      uberDoc?.clientSecret,
      uberDoc?.ClientSecret,
      uberDoc?.OAuth_ClientSecret,
      uberDoc?.oauthClientSecret,
      uberDoc?.uberEatsClientSecret
    );

    const apiCfgId = pickString(
      apiConfig.uberEatsClientId,
      apiConfig.oauthClientId,
      apiConfig.OAuth_ClientID,
      apiConfig.ClientID,
      apiConfig.clientId
    );
    const apiCfgSecret = pickString(
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

    // Pair clientId + clientSecret strictly within the same document/section
    if (uberDocId && uberDocSecret) {
      return {
        envHint,
        authSource,
        storeId,
        clientId: uberDocId,
        clientSecret: uberDocSecret,
        accessToken,
      };
    }
    if (apiCfgId && apiCfgSecret) {
      return {
        envHint,
        authSource,
        storeId,
        clientId: apiCfgId,
        clientSecret: apiCfgSecret,
        accessToken,
      };
    }

    let partialWarning: string | undefined;
    if (apiCfgId && !apiCfgSecret) {
      partialWarning =
        'Integration UI has an OAuth Client ID saved in MongoDB, but no Client Secret is saved yet.';
    } else if (!apiCfgId && apiCfgSecret) {
      partialWarning =
        'Integration UI has a Client Secret saved in MongoDB, but the OAuth Client ID is missing.';
    }

    return { envHint, authSource, storeId, accessToken, partialWarning };
  } catch (err) {
    console.warn('[Uber Mongo Credentials Fallback Notice]:', err);
    return { envHint: null, authSource: 'auto' };
  }
}

export interface UberCredentialState {
  env: UberEnvironment;
  authSourceMode: UberAuthSourceMode;
  baseUrl: string;
  tokenUrl: string;
  storeId: string;
  hasCredentials: boolean;
  credentialSource: CredentialSource;
  credentialPair?: string;
  clientIdPreview?: string;
  secretConfigured: boolean;
  partialWarning?: string;
  envOverridesMongo?: boolean;
  conflictWarning?: string;
}

export interface ResolvedUberConfiguration extends UberCredentialState {
  clientId?: string;
  clientSecret?: string;
  staticToken?: string;
}

export async function resolveUberConfigurationAsync(options?: {
  explicitSandbox?: boolean;
  explicitEnv?: UberEnvironment;
  authSourceOverride?: UberAuthSourceMode;
}): Promise<ResolvedUberConfiguration> {
  const initialDb = await loadMongoUberSettings();
  const authSourceMode = options?.authSourceOverride ?? initialDb.authSource;
  const explicitEnvVar = getExplicitEnvMode();

  let targetEnv: UberEnvironment;
  if (options?.explicitSandbox !== undefined) {
    targetEnv = options.explicitSandbox ? 'sandbox' : 'production';
  } else if (options?.explicitEnv) {
    targetEnv = options.explicitEnv;
  } else if (authSourceMode === 'mongo') {
    targetEnv =
      initialDb.envHint ||
      (initialDb.storeId && initialDb.storeId !== DEFAULT_TEST_STORE_ID ? 'production' : null) ||
      explicitEnvVar ||
      resolveUberEnvironment();
  } else if (authSourceMode === 'env') {
    targetEnv = explicitEnvVar || resolveUberEnvironment();
  } else {
    // Auto mode: honor explicit UBER_ENV, else UI-configured uberEnv, else env cred hints, else Test Store UUID -> sandbox
    const effectiveStoreHint =
      initialDb.storeId ||
      process.env.UBER_SANDBOX_STORE_ID ||
      process.env.UBER_STORE_ID ||
      DEFAULT_TEST_STORE_ID;
    targetEnv =
      explicitEnvVar ||
      initialDb.envHint ||
      (hasProdSpecificEnvCreds() && !hasSandboxSpecificEnvCreds()
        ? 'production'
        : hasSandboxSpecificEnvCreds() && !hasProdSpecificEnvCreds()
        ? 'sandbox'
        : effectiveStoreHint === DEFAULT_TEST_STORE_ID
        ? 'sandbox'
        : resolveUberEnvironment());
  }

  const targetSandbox = targetEnv === 'sandbox';
  const baseUrl = getUberBaseUrl(targetSandbox);
  const tokenUrl = getUberTokenUrl(targetSandbox);
  const storeId = (
    initialDb.storeId ||
    (targetSandbox
      ? process.env.UBER_SANDBOX_STORE_ID || process.env.UBER_STORE_ID
      : process.env.UBER_STORE_ID || process.env.UBER_SANDBOX_STORE_ID) ||
    DEFAULT_TEST_STORE_ID
  ).trim();

  const fromDb =
    initialDb.envHint && initialDb.envHint !== targetEnv
      ? await loadMongoUberSettings(targetEnv)
      : initialDb;

  const envCreds = getUberClientCredentialsFromEnv(targetSandbox);
  const hasMongoPair = Boolean(fromDb.clientId && fromDb.clientSecret);
  const hasEnvSpecificPair = Boolean(
    envCreds.clientId &&
      envCreds.clientSecret &&
      (envCreds.source === 'env_sandbox' || envCreds.source === 'env_prod')
  );
  const hasEnvGenericPair = Boolean(
    envCreds.clientId && envCreds.clientSecret && envCreds.source === 'env_generic'
  );

  const envConflictNote =
    explicitEnvVar && initialDb.envHint && explicitEnvVar !== initialDb.envHint
      ? `Vercel UBER_ENV=${explicitEnvVar} differs from Integration UI environment (${initialDb.envHint}); active mode resolved to ${targetEnv}.`
      : undefined;

  // Determine active credential pair strictly without ever cross-mixing ID and Secret across sources
  if (authSourceMode === 'mongo') {
    if (hasMongoPair) {
      const conflictWarning =
        hasEnvSpecificPair || hasEnvGenericPair
          ? `Using Integration UI (MongoDB) credentials for ${targetEnv.toUpperCase()} (${envCreds.credentialPair || envCreds.source} on Vercel is ignored while source is set to Integration UI).`
          : envConflictNote;
      return {
        env: targetEnv,
        authSourceMode,
        baseUrl,
        tokenUrl,
        storeId,
        hasCredentials: true,
        credentialSource: 'mongo',
        credentialPair: 'mongo:app_settings.apiConfig',
        clientIdPreview: maskUberClientId(fromDb.clientId),
        secretConfigured: true,
        clientId: fromDb.clientId,
        clientSecret: fromDb.clientSecret,
        envOverridesMongo: false,
        conflictWarning,
      };
    }

    return {
      env: targetEnv,
      authSourceMode,
      baseUrl,
      tokenUrl,
      storeId,
      hasCredentials: false,
      credentialSource: 'none',
      secretConfigured: false,
      partialWarning:
        fromDb.partialWarning ||
        `Credential source is set to Integration UI (MongoDB), but no complete ${targetEnv} Client ID + Client Secret pair is saved in MongoDB.`,
      conflictWarning: envConflictNote,
    };
  }

  if (authSourceMode === 'env') {
    if (envCreds.clientId && envCreds.clientSecret) {
      const source = envCreds.source || 'env_generic';
      const conflictWarning = [
        hasMongoPair
          ? `Using Vercel env (${envCreds.credentialPair || source}) while Integration UI credentials in MongoDB are ignored.`
          : '',
        envConflictNote || '',
      ]
        .filter(Boolean)
        .join(' ');
      return {
        env: targetEnv,
        authSourceMode,
        baseUrl,
        tokenUrl,
        storeId,
        hasCredentials: true,
        credentialSource: source,
        credentialPair: envCreds.credentialPair,
        clientIdPreview: maskUberClientId(envCreds.clientId),
        secretConfigured: true,
        clientId: envCreds.clientId,
        clientSecret: envCreds.clientSecret,
        ...(hasMongoPair ? { envOverridesMongo: true } : {}),
        ...(conflictWarning ? { conflictWarning } : {}),
      };
    }

    const envStatic = getStaticFallbackTokenFromEnv(targetSandbox);
    if (isUsableToken(envStatic)) {
      return {
        env: targetEnv,
        authSourceMode,
        baseUrl,
        tokenUrl,
        storeId,
        hasCredentials: true,
        credentialSource: 'static_token',
        secretConfigured: true,
        staticToken: envStatic,
        conflictWarning: envConflictNote,
      };
    }

    return {
      env: targetEnv,
      authSourceMode,
      baseUrl,
      tokenUrl,
      storeId,
      hasCredentials: false,
      credentialSource: 'none',
      secretConfigured: false,
      partialWarning:
        envCreds.partialWarning ||
        `Credential source is set to Vercel Environment Variables, but no valid ${targetEnv} Client ID + Client Secret pair was found in process.env.`,
      conflictWarning: envConflictNote,
    };
  }

  // AUTO mode precedence:
  // 1) Explicit env-specific vars (UBER_SANDBOX_* / UBER_PROD_*)
  // 2) Integration UI / MongoDB pair (prevents stale env_generic from shadowing user-entered rotated secret!)
  // 3) Generic Vercel env pair (UBER_CLIENT_ID+SECRET / ClientID+ClientSecret / OAuth_ClientID+Secret)
  // 4) Static fallback token
  if (hasEnvSpecificPair && envCreds.clientId && envCreds.clientSecret) {
    const source = envCreds.source!;
    const conflictWarning = [
      hasMongoPair
        ? `Vercel ${envCreds.credentialPair || source} overrides Integration UI credentials in MongoDB. Set Credential Source to "Integration UI (MongoDB)" if rotating secret only in UI.`
        : '',
      envConflictNote || '',
    ]
      .filter(Boolean)
      .join(' ');

    return {
      env: targetEnv,
      authSourceMode,
      baseUrl,
      tokenUrl,
      storeId,
      hasCredentials: true,
      credentialSource: source,
      credentialPair: envCreds.credentialPair,
      clientIdPreview: maskUberClientId(envCreds.clientId),
      secretConfigured: true,
      clientId: envCreds.clientId,
      clientSecret: envCreds.clientSecret,
      ...(hasMongoPair ? { envOverridesMongo: true } : {}),
      ...(conflictWarning ? { conflictWarning } : {}),
    };
  }

  if (hasMongoPair && fromDb.clientId && fromDb.clientSecret) {
    const conflictWarning = [
      hasEnvGenericPair
        ? `Using Integration UI (MongoDB) credentials over generic Vercel env (${envCreds.credentialPair}). Remove or update ${envCreds.credentialPair} on Vercel to eliminate ambiguity.`
        : '',
      envConflictNote || '',
    ]
      .filter(Boolean)
      .join(' ');

    return {
      env: targetEnv,
      authSourceMode,
      baseUrl,
      tokenUrl,
      storeId,
      hasCredentials: true,
      credentialSource: 'mongo',
      credentialPair: 'mongo:app_settings.apiConfig',
      clientIdPreview: maskUberClientId(fromDb.clientId),
      secretConfigured: true,
      clientId: fromDb.clientId,
      clientSecret: fromDb.clientSecret,
      envOverridesMongo: false,
      ...(conflictWarning ? { conflictWarning } : {}),
    };
  }

  if (envCreds.clientId && envCreds.clientSecret) {
    const source = envCreds.source || 'env_generic';
    const partialUiNote = fromDb.partialWarning
      ? `${fromDb.partialWarning} Falling back to ${envCreds.credentialPair || source}.`
      : undefined;
    return {
      env: targetEnv,
      authSourceMode,
      baseUrl,
      tokenUrl,
      storeId,
      hasCredentials: true,
      credentialSource: source,
      credentialPair: envCreds.credentialPair,
      clientIdPreview: maskUberClientId(envCreds.clientId),
      secretConfigured: true,
      clientId: envCreds.clientId,
      clientSecret: envCreds.clientSecret,
      partialWarning: partialUiNote,
      ...(envConflictNote ? { conflictWarning: envConflictNote } : {}),
    };
  }

  const staticToken = getStaticFallbackTokenFromEnv(targetSandbox) || fromDb.accessToken;
  if (isUsableToken(staticToken)) {
    return {
      env: targetEnv,
      authSourceMode,
      baseUrl,
      tokenUrl,
      storeId,
      hasCredentials: true,
      credentialSource: 'static_token',
      secretConfigured: true,
      staticToken,
      partialWarning: envCreds.partialWarning || fromDb.partialWarning,
      ...(envConflictNote ? { conflictWarning: envConflictNote } : {}),
    };
  }

  return {
    env: targetEnv,
    authSourceMode,
    baseUrl,
    tokenUrl,
    storeId,
    hasCredentials: false,
    credentialSource: 'none',
    secretConfigured: false,
    partialWarning: envCreds.partialWarning || fromDb.partialWarning,
    ...(envConflictNote ? { conflictWarning: envConflictNote } : {}),
  };
}

export async function getUberCredentialState(
  isSandbox?: boolean
): Promise<UberCredentialState> {
  const resolved = await resolveUberConfigurationAsync(
    isSandbox !== undefined ? { explicitSandbox: isSandbox } : undefined
  );
  return {
    env: resolved.env,
    authSourceMode: resolved.authSourceMode,
    baseUrl: resolved.baseUrl,
    tokenUrl: resolved.tokenUrl,
    storeId: resolved.storeId,
    hasCredentials: resolved.hasCredentials,
    credentialSource: resolved.credentialSource,
    credentialPair: resolved.credentialPair,
    clientIdPreview: resolved.clientIdPreview,
    secretConfigured: resolved.secretConfigured,
    partialWarning: resolved.partialWarning,
    envOverridesMongo: resolved.envOverridesMongo,
    conflictWarning: resolved.conflictWarning,
  };
}

export function hasUberCredentialsConfigured(isSandbox: boolean): boolean {
  const { clientId, clientSecret } = getUberClientCredentialsFromEnv(isSandbox);
  if (clientId && clientSecret) return true;
  return Boolean(getStaticFallbackTokenFromEnv(isSandbox));
}

export async function hasUberCredentialsConfiguredAsync(isSandbox?: boolean): Promise<boolean> {
  const state = await getUberCredentialState(isSandbox);
  return state.hasCredentials;
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
  storeId?: string;
  fromCache?: boolean;
  status?: number;
  error?: string;
  details?: unknown;
  hasCredentials?: boolean;
  credentialSource?: CredentialSource;
  credentialPair?: string;
  clientIdPreview?: string;
  envOverridesMongo?: boolean;
  conflictWarning?: string;
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
  explicitSandbox?: boolean,
  options?: { forceRefresh?: boolean; requiredScope?: string }
): Promise<EnvTokenResult> {
  const cfg = await resolveUberConfigurationAsync(
    explicitSandbox !== undefined ? { explicitSandbox } : undefined
  );
  const targetEnv = cfg.env;
  const targetSandbox = targetEnv === 'sandbox';
  const baseUrl = cfg.baseUrl;
  const primaryTokenUrl = cfg.tokenUrl;
  const reqScope = options?.requiredScope?.trim();

  const clientId = cfg.clientId;
  const clientSecret = cfg.clientSecret;
  const credentialSource = cfg.credentialSource;
  const credentialPair = cfg.credentialPair;
  const envOverridesMongo = Boolean(cfg.envOverridesMongo);
  const conflictWarning = cfg.conflictWarning;

  if ((!clientId || !clientSecret) && cfg.partialWarning && !cfg.staticToken) {
    clearUberAccessTokenCache(targetSandbox);
    console.info('[Uber OAuth Credential Source]:', {
      env: targetEnv,
      authSourceMode: cfg.authSourceMode,
      activeSource: credentialSource,
      clientIdConfigured: Boolean(clientId),
      clientSecretConfigured: Boolean(clientSecret),
      partialWarning: cfg.partialWarning,
      tokenUrl: primaryTokenUrl,
      baseUrl,
    });
    return {
      ok: false,
      env: targetEnv,
      status: 401,
      tokenUrl: primaryTokenUrl,
      baseUrl,
      storeId: cfg.storeId,
      error: cfg.partialWarning,
      hasCredentials: false,
      credentialSource: 'none',
      conflictWarning,
    };
  }

  if (clientId && clientSecret) {
    const clientIdPreview = cfg.clientIdPreview || maskUberClientId(clientId);
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
    const cacheHit = Boolean(
      !options?.forceRefresh &&
        existing &&
        existing.env === targetEnv &&
        existing.baseUrl === baseUrl &&
        existing.credentialsFingerprint === credFingerprint &&
        Date.now() < existing.expiresAt - 60_000 &&
        (!reqScope || existing.scope.split(/\s+/).includes(reqScope))
    );

    console.info('[Uber OAuth Credential Source]:', {
      env: targetEnv,
      authSourceMode: cfg.authSourceMode,
      activeSource: credentialSource,
      credentialPair: credentialPair || null,
      clientIdConfigured: true,
      clientSecretConfigured: true,
      envOverridesMongo,
      tokenUrl: primaryTokenUrl,
      baseUrl,
      cacheHit,
    });

    if (cacheHit && existing) {
      return {
        ok: true,
        env: targetEnv,
        token: existing.token,
        baseUrl: existing.baseUrl,
        tokenUrl: existing.tokenUrl,
        storeId: cfg.storeId,
        fromCache: true,
        credentialSource,
        credentialPair,
        clientIdPreview,
        envOverridesMongo,
        conflictWarning,
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
              credentialSource,
              credentialPair,
              clientIdPreview,
              envOverridesMongo,
              conflictWarning,
            };
          }

          lastOAuthStatus = oauthResult.status || 401;
          lastOAuthDetails = oauthResult.parsed || { raw: oauthResult.rawText };
          const rawOAuthErr =
            oauthResult.parsed?.error_description ||
            oauthResult.parsed?.error ||
            oauthResult.rawText ||
            `OAuth failed (${lastOAuthStatus})`;

          const rawErrStr = String(rawOAuthErr);
          const isEnvMismatch =
            lastOAuthStatus === 401 &&
            /environment\s+is\s+mismatched|mismatched\s+with\s+the\s+oauth\s+server/i.test(rawErrStr);
          const isSecretMismatch =
            /client[\s_]*secret\s*mismatch|invalid_client|unauthorized_client/i.test(rawErrStr) ||
            (lastOAuthStatus === 403 && /accessdenied|access_denied/i.test(rawErrStr));

          const pairInfo = credentialPair ? `${credentialSource} (${credentialPair})` : credentialSource;
          lastOAuthError = isEnvMismatch
            ? `${rawErrStr} (OMS runtime is configured for ${targetEnv.toUpperCase()} via ${tokenUrl}; ensure UBER_ENV and Client ID/Secret belong to the ${targetEnv} Uber app).`
            : isSecretMismatch
            ? `${rawErrStr} (Client ID ${clientIdPreview || ''} from ${pairInfo} failed authentication at ${tokenUrl}; verify that the matching ${targetEnv.toUpperCase()} Client Secret is configured cleanly without production/test mix-ups).`
            : rawErrStr;

          console.error('[Uber OAuth Token Rejection]:', {
            env: targetEnv,
            tokenUrl,
            baseUrl,
            credentialSource,
            credentialPair: credentialPair || null,
            envOverridesMongo,
            status: lastOAuthStatus,
            scope: scope || '(default)',
            isEnvMismatch,
            isSecretMismatch,
          });

          if (isEnvMismatch || isSecretMismatch) {
            clearUberAccessTokenCache(targetSandbox);
            return {
              ok: false,
              env: targetEnv,
              status: lastOAuthStatus,
              tokenUrl,
              baseUrl,
              error: lastOAuthError,
              details: lastOAuthDetails,
              hasCredentials: true,
              credentialSource,
              credentialPair,
              clientIdPreview,
              envOverridesMongo,
              conflictWarning,
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

    // Do not mask explicit 401/403 credential/environment rejections with a static token
    if (lastOAuthStatus !== 401 && lastOAuthStatus !== 403) {
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
          credentialSource: 'static_token',
          clientIdPreview,
        };
      }
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
      credentialSource,
      credentialPair,
      clientIdPreview,
      envOverridesMongo,
      conflictWarning,
    };
  }

  const fallbackToken = cfg.staticToken;
  if (isUsableToken(fallbackToken)) {
    console.info('[Uber OAuth Credential Source]:', {
      env: targetEnv,
      authSourceMode: cfg.authSourceMode,
      activeSource: 'static_token',
      clientIdConfigured: false,
      clientSecretConfigured: false,
      staticTokenConfigured: true,
      tokenUrl: primaryTokenUrl,
      baseUrl,
    });
    return {
      ok: true,
      env: targetEnv,
      token: fallbackToken.trim(),
      baseUrl,
      tokenUrl: 'env_or_db_static_token',
      fromCache: false,
      credentialSource: 'static_token',
      storeId: cfg.storeId,
    };
  }

  const missingVars = targetSandbox
    ? 'Integration UI (MongoDB) or UBER_SANDBOX_CLIENT_ID / UBER_SANDBOX_CLIENT_SECRET'
    : 'Integration UI (MongoDB) or UBER_PROD_CLIENT_ID / UBER_PROD_CLIENT_SECRET';

  console.info('[Uber OAuth Credential Source]:', {
    env: targetEnv,
    authSourceMode: cfg.authSourceMode,
    activeSource: 'none',
    clientIdConfigured: false,
    clientSecretConfigured: false,
    envOverridesMongo: false,
    tokenUrl: primaryTokenUrl,
    baseUrl,
  });

  return {
    ok: false,
    env: targetEnv,
    status: 401,
    tokenUrl: primaryTokenUrl,
    baseUrl,
    storeId: cfg.storeId,
    error: `Missing Uber ${targetEnv} Client ID / Client Secret (${missingVars}).`,
    hasCredentials: false,
    credentialSource: 'none',
    conflictWarning,
  };
}

export interface UberTokenAttempt {
  ok: boolean;
  env?: UberEnvironment;
  token?: string;
  tokenUrl?: string;
  baseUrl?: string;
  storeId?: string;
  status?: number;
  error?: string;
  details?: unknown;
  hasCredentials: boolean;
  credentialSource?: CredentialSource;
  credentialPair?: string;
  clientIdPreview?: string;
  envOverridesMongo?: boolean;
  conflictWarning?: string;
}

export async function getUberAccessTokenAttempt(
  isSandbox?: boolean,
  options?: { forceRefresh?: boolean; requiredScope?: string }
): Promise<UberTokenAttempt> {
  const res = await getTokenForSpecificEnv(isSandbox, options);
  const resolvedSandbox = res.env === 'sandbox';
  if (res.ok && res.token) {
    return {
      ok: true,
      env: res.env,
      token: res.token,
      tokenUrl: res.tokenUrl || getUberTokenUrl(resolvedSandbox),
      baseUrl: res.baseUrl || getUberBaseUrl(resolvedSandbox),
      storeId: res.storeId,
      hasCredentials: true,
      credentialSource: res.credentialSource,
      credentialPair: res.credentialPair,
      clientIdPreview: res.clientIdPreview,
      envOverridesMongo: res.envOverridesMongo,
      conflictWarning: res.conflictWarning,
    };
  }
  return {
    ok: false,
    env: res.env,
    status: res.status || 401,
    tokenUrl: res.tokenUrl || getUberTokenUrl(resolvedSandbox),
    baseUrl: res.baseUrl || getUberBaseUrl(resolvedSandbox),
    storeId: res.storeId,
    error:
      res.error ||
      `Missing Uber ${resolvedSandbox ? 'sandbox' : 'production'} credentials.`,
    details: res.details,
    hasCredentials: Boolean(res.hasCredentials),
    credentialSource: res.credentialSource,
    credentialPair: res.credentialPair,
    clientIdPreview: res.clientIdPreview,
    envOverridesMongo: res.envOverridesMongo,
    conflictWarning: res.conflictWarning,
  };
}

export async function getUberAccessTokenWithMeta(
  isSandbox?: boolean,
  options?: { forceRefresh?: boolean; requiredScope?: string }
): Promise<{
  token: string;
  tokenUrl: string;
  baseUrl: string;
  env: UberEnvironment;
  storeId?: string;
  credentialSource?: CredentialSource;
  clientIdPreview?: string;
} | null> {
  const attempt = await getUberAccessTokenAttempt(isSandbox, options);
  const env = attempt.env || 'sandbox';
  const targetSandbox = env === 'sandbox';
  return attempt.ok && attempt.token
    ? {
        token: attempt.token,
        tokenUrl: attempt.tokenUrl || getUberTokenUrl(targetSandbox),
        baseUrl: attempt.baseUrl || getUberBaseUrl(targetSandbox),
        env,
        storeId: attempt.storeId,
        credentialSource: attempt.credentialSource,
        clientIdPreview: attempt.clientIdPreview,
      }
    : null;
}

export async function getUberAccessToken(isSandbox?: boolean): Promise<string | null> {
  const meta = await getUberAccessTokenWithMeta(isSandbox);
  return meta?.token || null;
}

export async function executeUberOrderAction(params: {
  orderId: string;
  action: UberOrderAction;
  reason?: string;
  isSandbox?: boolean;
  currentStatus?: string;
}) {
  const resolvedCfg = await resolveUberConfigurationAsync(
    params.isSandbox !== undefined ? { explicitSandbox: params.isSandbox } : undefined
  );
  const targetEnv = resolvedCfg.env;
  const targetSandbox = targetEnv === 'sandbox';
  const cleanOrderId = encodeURIComponent(params.orderId.trim());
  const curStatusUpper = String(params.currentStatus || '').trim().toUpperCase();
  const isAlreadyAcceptedOrder =
    curStatusUpper.includes('ACCEPT') ||
    curStatusUpper.includes('PREPAR') ||
    curStatusUpper.includes('PROCESS') ||
    curStatusUpper === 'IN_KITCHEN';

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
      if (isAlreadyAcceptedOrder) {
        path = `/v1/eats/orders/${cleanOrderId}/cancel`;
        payload = {
          reason: params.reason || 'OTHER',
          cancelling_party: 'MERCHANT',
          details: 'Order cancelled from WOW TEK OMS',
        };
      } else {
        path = `/v1/eats/orders/${cleanOrderId}/deny_pos_order`;
        payload = {
          reason: {
            code: params.reason || 'POS_NOT_READY',
            explanation: 'Order cancelled from WOW TEK OMS',
          },
        };
      }
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

    // Cached token expired or revoked -> invalidate cache and re-authenticate within the SAME environment once
    if ((response.status === 401 || response.status === 403) && initialTokenRes.fromCache) {
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

