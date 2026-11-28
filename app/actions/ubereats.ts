'use server';

import { processUberOrderAction, type ProcessUberActionResponse } from '@/lib/uberOrderActionService';

export async function acceptUberEatsOrderAction(params: {
  orderId: string;
  storeId?: string;
  reason?: string;
}): Promise<ProcessUberActionResponse['body']> {
  const result = await processUberOrderAction({
    orderId: params.orderId,
    action: 'ACCEPT',
    storeId: params.storeId,
    reason: params.reason,
  });

  return result.body;
}
