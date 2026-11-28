import { NextRequest, NextResponse } from 'next/server';
import { processUberOrderAction } from '@/lib/uberOrderActionService';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await processUberOrderAction({
      orderId: body?.orderId || body?.order_id,
      action: body?.action,
      storeId: body?.storeId,
      reason: body?.cancellation_reason ?? body?.reason,
    });

    return NextResponse.json(result.body, { status: result.httpStatus });
  } catch (err: unknown) {
    console.error('[/api/orders/action Error]:', err);
    return NextResponse.json(
      {
        ok: false,
        success: false,
        synced: false,
        error: err instanceof Error ? err.message : 'Internal Server Error',
      },
      { status: 500 }
    );
  }
}
