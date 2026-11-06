import { NextRequest, NextResponse } from 'next/server';
import { broadcastLiveUpdate, saveServerWebhookEvent, saveServerOrder } from '@/lib/serverStore';
import clientPromise, { connectToMongoDB } from '@/lib/mongodb';
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

async function processBackgroundTasks(body: any) {
  try {
    const now = new Date().toISOString();
    
    // Handle Uber Eats Financial Settlement Report Event
    if (body.event_type === 'eats.report.success') {
      const { report_type, report_metadata } = body;
      broadcastLiveUpdate({
        type: 'ubereats_report_processed',
        reportType: report_type,
        workflowId: report_metadata?.workflow_id,
        timestamp: now,
      });
      return;
    }

    // 1. Extract details from Uber Eats Payload (handling both nested body.order and flat schemas)
    const orderData = body.order || body;
    const rawOrderId = orderData.id || body.order_id || body.meta?.resource_id || body.id || `UBER-${Date.now()}`;
    const rawUberId = String(rawOrderId).trim();

    // uberUuid: දිග UUID එක (API actions සඳහා, e.g. "c7e05234-04ca-4460-...")
    const uberUuid = rawUberId;

    // shortDisplayId: කෙටි අංකය (උදා: 06289 හෝ 95CF3 - UI එකේ පෙන්වීමට)
    // මෙතැනදී .toUpperCase() දාලා හරියටම Capital කරගන්නවා
    let shortDisplayId = orderData.display_id ? String(orderData.display_id).trim().toUpperCase() : '';
    if (!shortDisplayId) {
      if (rawUberId.toLowerCase().startsWith('c') && rawUberId.length > 5) {
        shortDisplayId = rawUberId.substring(1).toUpperCase(); // 'c' එක ඉවත් කර Capital කරයි
      } else if (rawUberId.length > 8) {
        shortDisplayId = rawUberId.slice(-5).toUpperCase();
      } else {
        shortDisplayId = rawUberId.toUpperCase();
      }
    }
    if (shortDisplayId.startsWith('UBER-')) {
      shortDisplayId = shortDisplayId.replace('UBER-', '');
    }

    const cleanOrderId = shortDisplayId;
    const uberOriginalUuid = uberUuid; // API actions සඳහා යොදාගන්නා exact UUID එක
    const displayId = `UBER-${shortDisplayId}`; // ඩෑෂ්බෝඩ් එකේ පෙන්වීමට "UBER-95CF3"

    const orderId = cleanOrderId;
    const storeId = body.store_id || orderData.store_id || body.meta?.user_id || 'uber-store';
    const currentStatus = orderData.status || orderData.state || body.current_order_state?.status || 'PENDING';
    
    // Extracting item details & totals
    const items = orderData.items || orderData.carts || orderData.cart?.items || body.current_order_state?.items || [];
    const rawTotal = orderData.total || body.total || body.current_order_state?.total_price?.amount || 0;
    const amount = typeof rawTotal === 'number' ? (rawTotal > 1000 ? rawTotal / 100 : rawTotal) : parseFloat(rawTotal) || 0;
    
    const invoiceNumber = displayId;

    // 2. Broadcast live update to OMS frontend
    broadcastLiveUpdate({
      type: 'webhook_ubereats_event',
      data: {
        orderId: uberOriginalUuid,
        uber_order_id: uberOriginalUuid,
        display_id: displayId,
        storeId,
        status: currentStatus,
        items,
        amount,
        invoiceNumber: displayId,
        rawPayload: body
      },
      timestamp: now
    });

    // 3. Construct WebhookEvent record for OMS state management
    const evt: WebhookEvent = {
      id: `evt-uber-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      source: 'ubereats',
      event: body.event_type || body.event || 'orders.notification',
      orderId: orderId,
      invoiceNumber: invoiceNumber,
      storeId: storeId,
      storeName: body.store_name || 'Uber Eats Store',
      branchName: 'Central Hub',
      amount: amount,
      status: 'success',
      orderStatus: currentStatus,
      rawPayload: body,
      receivedAt: now,
    };

    saveServerWebhookEvent(evt);

    // Also construct OMS Order so it populates Recent Orders list
    const orderItems: OrderItem[] = Array.isArray(items) && items.length > 0
      ? items.map((it: any) => ({
          sku: it.sku || `WT-UBR-${it.id || 'ITEM'}`,
          barcode: it.barcode || '4790000000000',
          name: it.name || it.title || 'Uber Eats Item',
          quantity: parseInt(it.quantity) || 1,
          unitPrice: parseFloat(it.price || it.unit_price || 0),
          costPrice: parseFloat(it.costPrice || 0),
          isRegistered: true,
        }))
      : [
          {
            sku: 'WT-UBR-ITEM',
            barcode: '4790000000000',
            name: body.item_name || 'Uber Eats Retail Order',
            quantity: 1,
            unitPrice: amount,
            costPrice: 0,
            isRegistered: false,
          },
        ];

    const feeAmount = Math.round((amount * 15.4) / 100);
    const newOrder: Order = {
      id: `ord-ubr-${orderId}`,
      invoiceNumber: invoiceNumber,
      channel: 'ubereats',
      channelName: `Uber Eats Retail (${body.store_name || 'Central Hub'})`,
      storeId: storeId,
      storeName: body.store_name || 'Uber Eats Store',
      branchName: 'Central Hub',
      externalStoreId: storeId,
      paymentGateway: 'card_online',
      paymentGatewayName: 'Uber In-App Payment',
      customerName: body.customer_name || body.customer?.name || 'Uber Customer',
      customerPhone: body.customer_phone || body.customer?.phone || '+94 77 123 4567',
      deliveryAddress: body.delivery_address || 'Delivery Address',
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
      status: (currentStatus === 'Processing' || currentStatus === 'Completed' || currentStatus === 'Cancelled') ? currentStatus : 'PENDING_ACCEPTANCE',
      createdAt: now,
      updatedAt: now,
      waybillGenerated: false,
      notes: `Uber Eats Live Order: ${invoiceNumber}`,
    };

    saveServerOrder(newOrder);
    broadcastLiveUpdate({ type: 'new_order_webhook', order: newOrder, event: evt, timestamp: now });

    // 4. Save/Update Order & Invoice in MongoDB for bi-directional sync
    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      // Save or update webhook audit feed
      await mongoConn.db.collection('webhook_events').updateOne(
        { orderId: orderId },
        { $set: evt },
        { upsert: true }
      );

      // MongoDB එකේ upsert කිරීම (ඩේටා ඩබල් වෙන එක වළක්වයි)
      const orderDocument = {
        uber_order_id: uberUuid, // දිග UUID එක (API actions සඳහා)
        display_id: shortDisplayId || (uberUuid ? uberUuid.slice(-5).toUpperCase() : ''), // දැන් ඩේටාබේස් එකේ "95CF3" වගේ Capital විදිහට සේව් වෙයි
        formatted_display_id: displayId, // "UBER-95CF3"
        short_display_id: shortDisplayId,
        clean_order_id: cleanOrderId,
        state: orderData.state || currentStatus,
        status: orderData.status || currentStatus,
        carts: orderData.carts || (orderData.cart ? [orderData.cart] : items),
        items: orderItems,
        orderId: cleanOrderId,
        invoiceNumber: displayId,
        storeId,
        source: 'ubereats',
        amount,
        customerName: body.customer_name || body.customer?.name || orderData.customer?.name || 'Uber Customer',
        customerPhone: body.customer_phone || body.customer?.phone || orderData.customer?.phone || '+94 77 123 4567',
        deliveryAddress: body.delivery_address || orderData.delivery_address || 'Delivery Address',
        rawPayload: body,
        updated_at: new Date(),
        updatedAt: now,
      };

      await mongoConn.db.collection('oms_orders').updateOne(
        { $or: [{ uber_order_id: uberUuid }, { uber_order_id: cleanOrderId }, { orderId: cleanOrderId }] },
        {
          $set: orderDocument,
          $setOnInsert: {
            created_at: new Date(),
            createdAt: now,
          }
        },
        { upsert: true }
      );

      // Also upsert in main orders collection
      await mongoConn.db.collection('orders').updateOne(
        { $or: [{ id: newOrder.id }, { invoiceNumber: newOrder.invoiceNumber }, { uber_order_id: uberUuid }, { uber_order_id: cleanOrderId }] },
        { $set: { ...newOrder, uber_order_id: uberUuid, display_id: displayId } },
        { upsert: true }
      );
    }
  } catch (err: any) {
    console.error('[UberEats Background Processing Error]:', err?.message);
  }
}

export async function POST(req: NextRequest | Request) {
  try {
    const body = await req.json();

    // Instantly respond 200 OK to prevent Vercel Timeout
    const immediateResponse = NextResponse.json({ status: 'success', received: true }, { status: 200 });

    // Handle heavy database operations & broadcasting asynchronously in background
    processBackgroundTasks(body).catch((err) => console.error('Background Task Execution Error:', err));

    return immediateResponse;
  } catch (error) {
    console.error('UberEats Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'WOWTEK Pro Uber Eats Webhook Listener',
    status: 'online',
    platform: 'ubereats',
    endpoint: '/api/webhooks/ubereats',
  });
}
