import { NextRequest, NextResponse } from 'next/server';
import { processUberOrderAction } from '@/lib/uberOrderActionService';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body?.action;
    const order_id = body?.order_id || body?.orderId;

    if (!order_id || !action) {
      return NextResponse.json({ error: 'Missing order_id or action' }, { status: 400 });
    }

    const result = await processUberOrderAction({
      orderId: order_id,
      action,
      storeId: body?.storeId || body?.store_id,
      reason: body?.cancellation_reason ?? body?.reason,
    });

    return NextResponse.json(result.body, { status: result.httpStatus });
  } catch (error: unknown) {
    console.error('Action Handler Exception:', error);
    return NextResponse.json(
      {
        ok: false,
        success: false,
        synced: false,
        error: error instanceof Error ? error.message : 'Internal Server Error',
      },
      { status: 500 }
    );
  }
}
