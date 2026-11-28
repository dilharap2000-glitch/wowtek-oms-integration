import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { DEFAULT_PLATFORMS, DEFAULT_GATEWAYS } from '@/lib/db';
import { clearUberAccessTokenCache } from '@/lib/uberToken';

export const dynamic = 'force-dynamic';

const DUMMY_UBER_VALUES = new Set([
  'uber_client_id_lk_881920',
  'ubr_sec_9941a87b003',
  'YOUR_UBER_CLIENT_SECRET',
  'YOUR_UBER_CLIENT_ID',
]);

function isValidSecretValue(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (/^[•*]+$/.test(trimmed)) return false;
  if (DUMMY_UBER_VALUES.has(trimmed)) return false;
  return true;
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

  return {
    ...safeConfig,
    uberEatsClientSecret: '',
    uberEatsClientSecretConfigured: hasSecret,
  };
}

export async function GET() {
  try {
    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      const settings = await mongoConn.db.collection('settings').findOne({ id: 'app_settings' });
      if (settings) {
        return NextResponse.json({
          success: true,
          platforms: settings.platforms || DEFAULT_PLATFORMS,
          gateways: settings.gateways || DEFAULT_GATEWAYS,
          apiConfig: redactApiConfigForClient(settings.apiConfig),
        });
      }
    }
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

          if (typeof restIncoming.uberEatsClientId === 'string') {
            mergedConfig.uberEatsClientId = restIncoming.uberEatsClientId.trim();
            mergedConfig.oauthClientId = restIncoming.uberEatsClientId.trim();
          }
          if (typeof restIncoming.uberEatsStoreId === 'string') {
            mergedConfig.uberEatsStoreId = restIncoming.uberEatsStoreId.trim();
          }

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

    return NextResponse.json({
      success: true,
      ...(platforms ? { platforms } : {}),
      ...(gateways ? { gateways } : {}),
      ...(safeResponseConfig ? { apiConfig: safeResponseConfig } : {}),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
