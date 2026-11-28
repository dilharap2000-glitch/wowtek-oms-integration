import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { broadcastLiveUpdate, saveServerWebhookEvent, saveServerOrder } from '@/lib/serverStore';
import { connectToMongoDB } from '@/lib/mongodb';
import { resolveUberConfigurationAsync } from '@/lib/uberToken';
import { WebhookEvent, Order, OrderItem } from '@/types';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-uber-signature, x-uber-store-id, x-store-id, x-location-id',
    },
  });
}

async function verifyOptionalUberSignature(
  rawBody: string,
  signatureHeader: string | null
): Promise<boolean | null> {
  if (!signatureHeader) return null;
  try {
    const cfg = await resolveUberConfigurationAsync();
    const secret = cfg.clientSecret || process.env.UBER_WEBHOOK_SECRET || '';
    if (!secret) return null;
    const expectedHex = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    const cleanIncoming = signatureHeader.trim().toLowerCase();
    const a = Buffer.from(cleanIncoming);
    const b = Buffer.from(expectedHex.toLowerCase());
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return null;
  }
}

async function saveUberWebhookEvent(payload: any, signatureVerified: boolean | null = null) {
  try {
    const now = new Date().toISOString();

    // Handle Uber Eats Financial Settlement Report Event
    if (payload?.event_type === 'eats.report.success') {
      const { report_type, report_metadata } = payload;
      broadcastLiveUpdate({
        type: 'ubereats_report_processed',
        reportType: report_type,
        workflowId: report_metadata?.workflow_id,
        timestamp: now,
      });
      return;
    }

    const orderData = payload?.order || payload || {};
    const fullOrderId = String(
      payload?.meta?.resource_id ||
        payload?.order?.id ||
        payload?.order_id ||
        payload?.event_id ||
        payload?.id ||
        ''
    ).trim();

    const rawDisplay = String(
      payload?.order?.display_id ||
        payload?.display_id ||
        (fullOrderId ? fullOrderId.slice(-5).toUpperCase() : '')
    )
      .replace(/^#/, '')
      .trim()
      .toUpperCase();

    const shortDisplayId = rawDisplay.replace(/^UBER-/i, '') || `UBR${Date.now().toString().slice(-5)}`;
    const displayId = `UBER-${shortDisplayId}`;
    const eventType = String(
      payload?.event_type || payload?.event || 'orders.notification'
    ).trim();
    const eventLower = eventType.toLowerCase();

    const storeId = String(
      payload?.meta?.user_id ||
        payload?.order?.store?.id ||
        payload?.store_id ||
        orderData?.store_id ||
        'ba8761b9-5679-4bcd-845d-8b0baacf9e5d'
    ).trim();

    const rawIncomingStatus = String(
      payload?.order?.current_state ||
        payload?.meta?.status ||
        orderData?.status ||
        orderData?.state ||
        payload?.current_order_state?.status ||
        ''
    ).trim();

    const normalizedIncoming = rawIncomingStatus
      .toUpperCase()
      .replace(/[\s-]+/g, '_');

    const isFailureWebhook = eventLower.includes('failure');
    const isReleaseWebhook = eventLower.includes('release');
    const isEditWebhook =
      eventLower.includes('edit') ||
      eventLower.includes('scheduled.notification') ||
      Boolean(payload?.order?.cart || payload?.current_order_state);
    const isCancelledWebhook =
      eventLower.includes('cancel') ||
      normalizedIncoming.includes('CANCEL') ||
      normalizedIncoming.includes('DENI') ||
      normalizedIncoming.includes('DENY');

    const isPendingWebhook =
      !normalizedIncoming ||
      normalizedIncoming === 'POS' ||
      normalizedIncoming === 'POS_CREATED' ||
      normalizedIncoming === 'ORDER_CREATED' ||
      normalizedIncoming === 'CREATED' ||
      normalizedIncoming === 'NEW' ||
      normalizedIncoming === 'OFFERED' ||
      normalizedIncoming === 'PENDING' ||
      normalizedIncoming === 'PENDING_ACCEPTANCE' ||
      normalizedIncoming === 'AWAITING_ACCEPTANCE' ||
      normalizedIncoming === 'WAITING_ACCEPTANCE' ||
      normalizedIncoming === 'UNACCEPTED' ||
      normalizedIncoming.includes('PENDING');

    const resolvedStatus = isFailureWebhook
      ? 'FAILED'
      : isCancelledWebhook
      ? 'CANCELLED'
      : isReleaseWebhook && !normalizedIncoming
      ? 'ACCEPTED'
      : isPendingWebhook
      ? 'PENDING_ACCEPTANCE'
      : normalizedIncoming;

    const resolvedUberStatus = resolvedStatus;

    const rawCents = payload?.order?.payment?.charges?.total?.amount;
    const rawFallbackTotal =
      orderData?.total ??
      payload?.total ??
      payload?.current_order_state?.total_price?.amount ??
      0;
    const amount =
      rawCents !== undefined && rawCents !== null
        ? Number(rawCents) / 100 || 0
        : typeof rawFallbackTotal === 'number'
        ? rawFallbackTotal > 1000
          ? rawFallbackTotal / 100
          : rawFallbackTotal
        : parseFloat(String(rawFallbackTotal)) || 0;

    const customerName = String(
      payload?.order?.eater?.first_name ||
        payload?.customer_name ||
        payload?.customer?.name ||
        orderData?.customer?.name ||
        'Uber Customer · Colombo'
    ).trim();

    const customerPhone = String(
      payload?.order?.eater?.phone ||
        payload?.customer_phone ||
        payload?.customer?.phone ||
        orderData?.customer?.phone ||
        '+94 77 123 4567'
    ).trim();

    const items =
      orderData?.items ||
      orderData?.carts ||
      orderData?.cart?.items ||
      payload?.current_order_state?.items ||
      [];

    const orderItems: OrderItem[] =
      Array.isArray(items) && items.length > 0
        ? items.map((it: any) => ({
            sku: it.sku || `WT-UBR-${it.id || 'ITEM'}`,
            barcode: it.barcode || '4790000000000',
            name: it.name || it.title || 'Uber Eats Item',
            quantity: parseInt(String(it.quantity), 10) || 1,
            unitPrice: parseFloat(String(it.price || it.unit_price || 0)) || 0,
            costPrice: parseFloat(String(it.costPrice || 0)) || 0,
            isRegistered: true,
          }))
        : [
            {
              sku: 'WT-UBR-ITEM',
              barcode: '4790000000000',
              name: payload?.item_name || 'Uber Eats Retail Order',
              quantity: 1,
              unitPrice: amount,
              costPrice: 0,
              isRegistered: false,
            },
          ];

    const feeAmount = Math.round((amount * 15.4) / 100);
    const effectiveOrderId = fullOrderId || shortDisplayId;

    const evt: WebhookEvent = {
      id: `evt-uber-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      source: 'ubereats',
      event: eventType,
      orderId: effectiveOrderId,
      invoiceNumber: displayId,
      storeId,
      storeName: payload?.order?.store?.name || payload?.store_name || 'Uber Eats Store',
      branchName: 'Central Hub',
      amount,
      status: eventType.includes('failure') ? 'failed' : 'success',
      orderStatus: resolvedStatus,
      customerName,
      customerPhone,
      rawPayload: payload,
      receivedAt: now,
    };

    const newOrder: Order = {
      id: `ord-ubr-${shortDisplayId}`,
      invoiceNumber: displayId,
      channel: 'ubereats',
      channelName: `Uber Eats Retail (${payload?.order?.store?.name || payload?.store_name || 'Central Hub'})`,
      storeId,
      storeName: payload?.order?.store?.name || payload?.store_name || 'Uber Eats Store',
      branchName: 'Central Hub',
      externalStoreId: storeId,
      paymentGateway: 'card_online',
      paymentGatewayName: 'Uber In-App Payment',
      customerName,
      customerPhone,
      deliveryAddress: payload?.delivery_address || orderData?.delivery_address || 'Delivery Address',
      city: 'Colombo',
      items: orderItems,
      grossTotal: amount,
      platformFeePercent: 15.4,
      platformFeeAmount: feeAmount,
      gatewayFeePercent: 0,
      gatewayFeeAmount: 0,
      courierFee: 0,
      costOfGoods: 0,
      netProfit: Math.max(0, amount - feeAmount),
      profitStatus: 'Calculated',
      hasUnregisteredItems: false,
      unregisteredItemsCount: 0,
      status: resolvedStatus as Order['status'],
      createdAt: now,
      updatedAt: now,
      waybillGenerated: false,
      notes: `Uber Eats Live Order: ${displayId}`,
    };

    const extraOrderFields = {
      channel: 'ubereats',
      source: 'ubereats',
      provider: 'ubereats',
      eventType,
      orderId: effectiveOrderId,
      uberOrderId: fullOrderId || null,
      uber_order_id: fullOrderId || null,
      orderNumber: shortDisplayId,
      displayId: shortDisplayId,
      display_id: displayId,
      formatted_display_id: displayId,
      short_display_id: shortDisplayId,
      clean_order_id: shortDisplayId,
      uberStatus: resolvedUberStatus,
      orderStatus: resolvedStatus,
      amount,
      rawPayload: payload,
    };

    saveServerWebhookEvent(evt);
    saveServerOrder({ ...newOrder, ...extraOrderFields } as Order);

    broadcastLiveUpdate({
      type: 'webhook_ubereats_event',
      data: {
        orderId: effectiveOrderId,
        uber_order_id: fullOrderId || null,
        display_id: displayId,
        storeId,
        status: resolvedStatus,
        uberStatus: resolvedUberStatus,
        items,
        amount,
        invoiceNumber: displayId,
        rawPayload: payload,
      },
      timestamp: now,
    });
    broadcastLiveUpdate({
      type: 'new_order_webhook',
      order: { ...newOrder, ...extraOrderFields },
      event: evt,
      timestamp: now,
    });

    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      const db = mongoConn.db;
      const nowDate = new Date();

      await db.collection('webhook_events').updateOne(
        { $or: [{ orderId: effectiveOrderId }, { invoiceNumber: displayId }] },
        { $set: { ...evt, ...extraOrderFields } },
        { upsert: true }
      );

      const omsFilter = fullOrderId
        ? { $or: [{ uberOrderId: fullOrderId }, { uber_order_id: fullOrderId }, { orderId: fullOrderId }] }
        : { invoiceNumber: displayId };
      const existingOms = await db.collection('oms_orders').findOne(omsFilter).catch(() => null);
      const existingOmsUpper = String(
        existingOms?.uberStatus || existingOms?.orderStatus || existingOms?.status || ''
      )
        .trim()
        .toUpperCase();
      const omsProgressed =
        existingOmsUpper === 'ACCEPTED' ||
        existingOmsUpper === 'READY_FOR_PICKUP' ||
        existingOmsUpper === 'READY' ||
        existingOmsUpper === 'COMPLETED' ||
        existingOmsUpper === 'CANCELLED';
      const preserveOmsStatus =
        omsProgressed &&
        !isFailureWebhook &&
        !isCancelledWebhook &&
        resolvedStatus === 'PENDING_ACCEPTANCE';

      const omsDoc = {
        ...extraOrderFields,
        state: orderData?.state || (preserveOmsStatus ? existingOmsUpper : resolvedStatus),
        status: preserveOmsStatus ? existingOms?.status || existingOmsUpper : resolvedStatus,
        ...(preserveOmsStatus
          ? {
              uberStatus: existingOms?.uberStatus || existingOmsUpper,
              orderStatus: existingOms?.orderStatus || existingOmsUpper,
            }
          : {}),
        carts: orderData?.carts || (orderData?.cart ? [orderData.cart] : items),
        items: orderItems,
        invoiceNumber: displayId,
        storeId,
        customerName,
        customerPhone,
        deliveryAddress: newOrder.deliveryAddress,
        updated_at: nowDate,
        updatedAt: now,
      };

      await db.collection('oms_orders').updateOne(
        omsFilter,
        {
          $set: omsDoc,
          $setOnInsert: {
            created_at: nowDate,
            createdAt: now,
          },
        },
        { upsert: true }
      );

      const collections = await db.listCollections().toArray().catch(() => []);
      const targetColName =
        collections.find((c) => /uber.*order|order/i.test(c.name))?.name || 'orders';

      const fullOrderDoc = {
        ...newOrder,
        ...extraOrderFields,
        ...(signatureVerified !== null ? { uberSignatureVerified: signatureVerified } : {}),
        ...(isReleaseWebhook ? { fastReleaseTriggeredAt: now } : {}),
        ...(isEditWebhook ? { lastWebhookEditedAt: now } : {}),
        updatedAt: now,
      };
      const { createdAt: docCreatedAt, ...docWithoutCreatedAt } = fullOrderDoc;

      const upsertTarget = async (colName: string) => {
        if (fullOrderId) {
          const matchFilter = {
            $or: [
              { uberOrderId: fullOrderId },
              { uber_order_id: fullOrderId },
              { orderId: fullOrderId },
              { invoiceNumber: displayId },
            ],
          };
          const existingDoc = await db.collection(colName).findOne(matchFilter).catch(() => null);
          const existingUpper = String(
            existingDoc?.uberStatus || existingDoc?.orderStatus || existingDoc?.status || ''
          )
            .trim()
            .toUpperCase();
          const alreadyProgressed =
            existingUpper === 'ACCEPTED' ||
            existingUpper === 'READY_FOR_PICKUP' ||
            existingUpper === 'READY' ||
            existingUpper === 'COMPLETED' ||
            existingUpper === 'CANCELLED';

          // Never let a duplicate notification, release, or live edit regress an accepted/ready order back to PENDING_ACCEPTANCE
          const shouldPreserveStatus =
            alreadyProgressed &&
            !isFailureWebhook &&
            !isCancelledWebhook &&
            resolvedStatus === 'PENDING_ACCEPTANCE';

          const setFields: Record<string, any> = {
            ...docWithoutCreatedAt,
            orderId: fullOrderId,
            uberOrderId: fullOrderId,
          };

          if (shouldPreserveStatus && existingDoc) {
            setFields.status = existingDoc.status || existingUpper;
            setFields.uberStatus = existingDoc.uberStatus || existingUpper;
            setFields.orderStatus = existingDoc.orderStatus || existingUpper;
          }

          await db.collection(colName).updateOne(
            matchFilter,
            {
              $set: setFields,
              $setOnInsert: { createdAt: docCreatedAt || now },
            },
            { upsert: true }
          );
        } else {
          await db.collection(colName).insertOne({
            ...fullOrderDoc,
            createdAt: docCreatedAt || now,
          });
        }
      };

      await upsertTarget(targetColName);
      if (targetColName !== 'orders') {
        await upsertTarget('orders');
      }
    }
  } catch (err) {
    console.error('Webhook DB save error:', err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get('x-uber-signature');
    const signatureVerified = await verifyOptionalUberSignature(rawBody, signatureHeader);

    let payload: any = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      payload = { raw: rawBody };
    }

    await saveUberWebhookEvent(payload, signatureVerified);

    // Uber webhook validation requires 200 OK
    return NextResponse.json(
      { ok: true, received: true, ...(signatureVerified !== null ? { signatureVerified } : {}) },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('Uber webhook handler error:', err);
    return NextResponse.json({ ok: true, received: true }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: 'ubereats-webhook',
      status: 'online',
      platform: 'ubereats',
      endpoint: '/api/webhooks/ubereats',
    },
    { status: 200 }
  );
}
