export type ResolvedOrderChannel =
  | 'ubereats'
  | 'pickme'
  | 'woocommerce'
  | 'pos'
  | 'unknown';

function classifyChannelToken(raw: unknown): ResolvedOrderChannel | null {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return null;

  // Explicit Uber Eats platform tokens only (never match generic "order" or customer names)
  if (
    s === 'uber' ||
    s === 'ubereats' ||
    s === 'uber eats' ||
    s === 'uber_eats' ||
    s === 'uber-eats' ||
    /\buber\s*[-_]?\s*eats\b/i.test(s)
  ) {
    return 'ubereats';
  }

  // Explicit POS / in-store / walk-in tokens
  if (
    s === 'pos' ||
    s === 'in-store' ||
    s === 'instore' ||
    s === 'walk-in' ||
    s === 'walkin' ||
    s === 'cashier' ||
    /\bin[-\s]?store\s+pos\b/i.test(s) ||
    /\bpos\s+retail\b/i.test(s)
  ) {
    return 'pos';
  }

  if (/\bpickme\b/i.test(s)) {
    return 'pickme';
  }

  if (/\bwoo(?:commerce)?\b/i.test(s) || s === 'website' || s === 'website / pos') {
    return s.includes('pos') && !s.includes('website') ? 'pos' : 'woocommerce';
  }

  if (s === 'stream' || s === 'manual_sync') {
    return 'unknown';
  }

  return null;
}

function hasValidUberUuid(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower === 'null' || lower === 'undefined' || lower === 'n/a' || lower === 'none' || lower === '-') {
    return false;
  }
  return true;
}

export function resolveOrderChannel(item: any): ResolvedOrderChannel {
  if (!item || typeof item !== 'object') return 'unknown';

  // In-store POS checkout records are never live Uber Eats API orders
  if (item.isPosSale === true) {
    return 'pos';
  }

  // Check primary authoritative channel fields in precedence order
  const primaryFields = [item.channel, item.orderSource, item.source, item.provider];
  for (const field of primaryFields) {
    const matched = classifyChannelToken(field);
    if (matched) return matched;
  }

  // Only inspect channelName when primary fields did not classify the order
  const fromChannelName = classifyChannelToken(item.channelName);
  if (fromChannelName) return fromChannelName;

  // Fallback to explicit Uber Eats order UUIDs / invoice prefixes
  if (hasValidUberUuid(item.uberOrderId) || hasValidUberUuid(item.uber_order_id)) {
    return 'ubereats';
  }

  const idHints = [item.invoiceNumber, item.display_id, item.id];
  for (const hint of idHints) {
    const s = String(hint || '').trim();
    if (/^UBER-/i.test(s) || /^ord-ubr-/i.test(s) || /^WT-UBR-/i.test(s)) {
      return 'ubereats';
    }
    if (/^INV-POS-/i.test(s)) {
      return 'pos';
    }
    if (/^WT-WC-/i.test(s) || /^ord-wc-/i.test(s)) {
      return 'woocommerce';
    }
    if (/^PKM-/i.test(s) || /^ord-pkm-/i.test(s)) {
      return 'pickme';
    }
  }

  return 'unknown';
}

export const isUberItem = (item: any): boolean => resolveOrderChannel(item) === 'ubereats';

export const isPosItem = (item: any): boolean => resolveOrderChannel(item) === 'pos';

export const isPickMeItem = (item: any): boolean => resolveOrderChannel(item) === 'pickme';

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
      const trimmed = String(cand).trim();
      const upper = trimmed.toUpperCase().replace(/[\s-]+/g, '_');
      if (
        (upper === 'POS' || upper === 'POS_CREATED' || upper === 'ORDER_CREATED') &&
        isUberItem(item)
      ) {
        return 'PENDING_ACCEPTANCE';
      }
      return trimmed;
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

export const isWooItem = (item: any): boolean => resolveOrderChannel(item) === 'woocommerce';

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
