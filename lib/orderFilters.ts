export const isUberItem = (item: any): boolean => {
  if (!item || typeof item !== 'object') return false;
  if (
    /uber/i.test(
      String(item?.channel || item?.channelName || item?.source || item?.provider || '')
    )
  ) {
    return true;
  }
  if (item?.uberOrderId || item?.uber_order_id) return true;
  const idHint = String(item?.invoiceNumber || item?.display_id || item?.id || '');
  return /^UBER-/i.test(idHint) || /^ord-ubr-/i.test(idHint);
};

export type UberOrderWorkflowStage =
  | 'PENDING'
  | 'ACCEPTED'
  | 'READY'
  | 'CANCELLED'
  | 'COMPLETED';

function isMeaningfulOrderStatus(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  const str = String(val).trim();
  if (!str) return false;
  const lower = str.toLowerCase();
  // Exclude webhook delivery log states or HTTP codes accidentally stored in status fields
  if (lower === 'success' || lower === 'ok' || /^\d{3}$/.test(lower)) return false;
  return true;
}

export function getRawUberOrderStatus(item: any): string {
  if (!item || typeof item !== 'object') return '';
  const candidates = [item.uberStatus, item.orderStatus, item.status, item.state];
  for (const cand of candidates) {
    if (isMeaningfulOrderStatus(cand)) {
      return String(cand).trim();
    }
  }
  return '';
}

export function normalizeUberOrderStage(
  rawStatus: unknown,
  isUber = true
): UberOrderWorkflowStage {
  const s = String(rawStatus || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

  if (
    s.includes('CANCEL') ||
    s.includes('DENI') ||
    s.includes('DENY') ||
    s.includes('REJECT') ||
    s.includes('FAIL') ||
    s.includes('EXPIRED')
  ) {
    return 'CANCELLED';
  }

  if (
    s.includes('COMPLETE') ||
    s.includes('DELIVER') ||
    s.includes('RETURN') ||
    s === 'FINISHED' ||
    s === 'PICKED_UP' ||
    s === 'HANDED_OFF'
  ) {
    return 'COMPLETED';
  }

  if (
    s === 'READY' ||
    s === 'READY_FOR_PICKUP' ||
    s === 'FOOD_READY' ||
    s === 'READY_FOR_DELIVERY' ||
    s.includes('READY_FOR_PICKUP')
  ) {
    return 'READY';
  }

  if (
    s === 'ACCEPTED' ||
    s === 'POS_ACCEPTED' ||
    s === 'PROCESSING' ||
    s === 'PREPARING' ||
    s === 'IN_PROGRESS' ||
    s === 'CONFIRMED' ||
    s === 'IN_KITCHEN' ||
    s.includes('ACCEPTED') ||
    s.includes('PREPARING') ||
    s.includes('PROCESSING')
  ) {
    return 'ACCEPTED';
  }

  if (
    s === '' ||
    s === 'PENDING_ACCEPTANCE' ||
    s === 'PENDING' ||
    s === 'CREATED' ||
    s === 'NEW' ||
    s === 'POS' ||
    s === 'POS_CREATED' ||
    s === 'ORDER_CREATED' ||
    s === 'OFFERED' ||
    s === 'UNACCEPTED' ||
    s === 'AWAITING_ACCEPTANCE' ||
    s === 'WAITING_ACCEPTANCE' ||
    s === 'SUCCESS' ||
    s.includes('PENDING') ||
    s.includes('AWAITING') ||
    s.includes('WAITING') ||
    s.includes('UNACCEPTED')
  ) {
    return 'PENDING';
  }

  return isUber ? 'PENDING' : 'COMPLETED';
}

export const isWooItem = (item: any): boolean =>
  /woo/i.test(
    String(item?.channel || item?.channelName || item?.source || item?.provider || '')
  );

export const isPingRow = (item: any): boolean => {
  const text = String(
    item?.description ||
      item?.customerDetails ||
      item?.customerName ||
      item?.note ||
      item?.notes ||
      item?.event ||
      ''
  );
  const amount = Number(item?.amount ?? item?.grossTotal ?? item?.total ?? 0);
  const hasPingKeyword = /listener ping|system handshake|handshake|webhook\.ping/i.test(text);
  const hasAnonymousPing =
    !item?.customerName &&
    !item?.invoiceNumber &&
    !item?.orderId &&
    /ping/i.test(String(item?.id || item?.event || ''));
  return (hasPingKeyword || hasAnonymousPing) && amount === 0;
};
