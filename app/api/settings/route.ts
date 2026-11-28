import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { DEFAULT_PLATFORMS, DEFAULT_GATEWAYS } from '@/lib/db';
import {
  clearUberAccessTokenCache,
  getUberCredentialState,
  isUsableUberValue,
} from '@/lib/uberToken';

export const dynamic = 'force-dynamic';

function isValidSecretValue(val: unknown): val is string {
  return typeof val === 'string' && isUsableUberValue(val);
}

function cleanClientId(val: unknown): string {
  if (typeof val !== 'string') return '';
  const trimmed = val.trim();
  return isUsableUberValue(trimmed) ? trimmed : '';
}

function redactApiConfigForClient(apiConfig: Record<string, any> | null | undefined) {
  if (!apiConfig || typeof apiConfig !== 'object') return null;
  const hasSecret =
    isValidSecretValue(apiConfig.uberEatsClientSecret) ||
    isValidSecretValue(apiConfig.oauthClientSecret) ||
    isValidSecretValue(apiConfig.clientSecret);

  const {
    uberEatsClientSecret: _s1,
    oauthClientSecret: _s2,
    clientSecret: _s3,
    uberEatsAccessToken: _t1,
    uberAccessToken: _t2,
    ...safeConfig
  } = apiConfig;

  const cleanedClientId =
    cleanClientId(safeConfig.uberEatsClientId) || cleanClientId(safeConfig.oauthClientId);

  return {
    ...safeConfig,
    uberEatsClientId: cleanedClientId,
    oauthClientId: cleanedClientId,
    uberEatsClientSecret: '',
    uberEatsClientSecretConfigured: hasSecret,
    uberEnv:
      safeConfig.uberEnv === 'production' || safeConfig.uberEnv === 'sandbox'
        ? safeConfig.uberEnv
        : 'sandbox',
    uberAuthSource:
      safeConfig.uberAuthSource === 'mongo' || safeConfig.uberAuthSource === 'env'
        ? safeConfig.uberAuthSource
        : 'auto',
  };
}

export async function GET() {
  try {
    const mongoConn = await connectToMongoDB();
    const uberStatus = await getUberCredentialState().catch(() => null);
    if (mongoConn) {
      const settings = await mongoConn.db.collection('settings').findOne({ id: 'app_settings' });
      if (settings) {
        return NextResponse.json({
          success: true,
          platforms: settings.platforms || DEFAULT_PLATFORMS,
          gateways: settings.gateways || DEFAULT_GATEWAYS,
          apiConfig: redactApiConfigForClient(settings.apiConfig),
          uberStatus,
        });
      }
    }
    return NextResponse.json({
      success: true,
      platforms: DEFAULT_PLATFORMS,
      gateways: DEFAULT_GATEWAYS,
      apiConfig: null,
      uberStatus,
    });
  } catch (err: any) {
    console.warn('[Settings API GET] MongoDB read error:', err.message);
  }

  return NextResponse.json({
    success: true,
    platforms: DEFAULT_PLATFORMS,
    gateways: DEFAULT_GATEWAYS,
    apiConfig: null,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { platforms, gateways, apiConfig } = body;
    let safeResponseConfig = apiConfig ? redactApiConfigForClient(apiConfig) : undefined;

    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        const updatePayload: any = { updatedAt: new Date().toISOString() };
        if (platforms) updatePayload.platforms = platforms;
        if (gateways) updatePayload.gateways = gateways;

        if (apiConfig && typeof apiConfig === 'object') {
          const existingDoc = await mongoConn.db
            .collection('settings')
            .findOne({ id: 'app_settings' });
          const existingApiConfig = (existingDoc?.apiConfig || {}) as Record<string, any>;

          const {
            uberEatsClientSecret: incomingSecret,
            uberEatsClientSecretConfigured: _ignoredFlag,
            ...restIncoming
          } = apiConfig as Record<string, any>;

          const mergedConfig: Record<string, any> = {
            ...existingApiConfig,
            ...restIncoming,
          };

          const rawIncomingClientId =
            restIncoming.uberEatsClientId ?? restIncoming.oauthClientId;
          if (typeof rawIncomingClientId === 'string') {
            const cleaned = cleanClientId(rawIncomingClientId);
            mergedConfig.uberEatsClientId = cleaned;
            mergedConfig.oauthClientId = cleaned;
          } else {
            const existingCleaned =
              cleanClientId(existingApiConfig.uberEatsClientId) ||
              cleanClientId(existingApiConfig.oauthClientId);
            mergedConfig.uberEatsClientId = existingCleaned;
            mergedConfig.oauthClientId = existingCleaned;
          }

          if (typeof restIncoming.uberEatsStoreId === 'string') {
            mergedConfig.uberEatsStoreId = restIncoming.uberEatsStoreId.trim();
          }

          mergedConfig.uberEnv =
            restIncoming.uberEnv === 'production' || restIncoming.uberEnv === 'sandbox'
              ? restIncoming.uberEnv
              : existingApiConfig.uberEnv === 'production'
              ? 'production'
              : 'sandbox';

          mergedConfig.uberAuthSource =
            restIncoming.uberAuthSource === 'mongo' ||
            restIncoming.uberAuthSource === 'env' ||
            restIncoming.uberAuthSource === 'auto'
              ? restIncoming.uberAuthSource
              : existingApiConfig.uberAuthSource || 'auto';

          if (isValidSecretValue(incomingSecret)) {
            mergedConfig.uberEatsClientSecret = incomingSecret.trim();
          } else if (isValidSecretValue(existingApiConfig.uberEatsClientSecret)) {
            mergedConfig.uberEatsClientSecret = existingApiConfig.uberEatsClientSecret;
          } else {
            delete mergedConfig.uberEatsClientSecret;
          }

          updatePayload.apiConfig = mergedConfig;
          safeResponseConfig = redactApiConfigForClient(mergedConfig);
        }

        await mongoConn.db.collection('settings').updateOne(
          { id: 'app_settings' },
          { $set: updatePayload },
          { upsert: true }
        );
        if (apiConfig) {
          clearUberAccessTokenCache();
        }
      }
    } catch (err: any) {
      console.warn('[Settings API POST] MongoDB write error:', err.message);
    }

    const uberStatus = await getUberCredentialState().catch(() => null);

    return NextResponse.json({
      success: true,
      ...(platforms ? { platforms } : {}),
      ...(gateways ? { gateways } : {}),
      ...(safeResponseConfig ? { apiConfig: safeResponseConfig } : {}),
      uberStatus,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
