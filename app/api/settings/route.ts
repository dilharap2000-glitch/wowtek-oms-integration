import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { DEFAULT_PLATFORMS, DEFAULT_GATEWAYS } from '@/lib/db';

export const dynamic = 'force-dynamic';

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
          apiConfig: settings.apiConfig || null,
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

    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        const updatePayload: any = { updatedAt: new Date().toISOString() };
        if (platforms) updatePayload.platforms = platforms;
        if (gateways) updatePayload.gateways = gateways;
        if (apiConfig) updatePayload.apiConfig = apiConfig;

        await mongoConn.db.collection('settings').updateOne(
          { id: 'app_settings' },
          { $set: updatePayload },
          { upsert: true }
        );
      }
    } catch (err: any) {
      console.warn('[Settings API POST] MongoDB write error:', err.message);
    }

    return NextResponse.json({ success: true, ...body });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
