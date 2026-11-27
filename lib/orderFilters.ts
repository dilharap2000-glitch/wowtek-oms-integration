export const isUberItem = (item: any): boolean =>
  /uber/i.test(
    String(item?.channel || item?.channelName || item?.source || item?.provider || '')
  );

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
