import { NextRequest, NextResponse } from 'next/server';
import { broadcastLiveUpdate, saveServerWebhookEvent, saveServerOrder } from '@/lib/serverStore';
import { connectToMongoDB } from '@/lib/mongodb';
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

    // 1. Extract details from Uber Eats Payload (handling different schema formats)
    const rawOrderId = body.order_id || body.meta?.resource_id || body.id || `UBER-${Date.now()}`;
    const uberOriginalUuid = String(rawOrderId); // Raw UUID for Uber API calls (e.g. "c7e05234-04ca-4460-...")
    const shortHash = String(uberOriginalUuid).slice(-6);
    const displayId = `UBER-${shortHash}`; // Human-friendly display ID for UI (e.g. "UBER-9bc264")

    const orderId = uberOriginalUuid;
    const storeId = body.store_id || body.meta?.user_id || 'uber-store';
    const currentStatus = body.status || body.current_order_state?.status || 'PENDING';
    
    // Extracting item details & totals
    const items = body.items || body.current_order_state?.items || [];
    const rawTotal = body.total || body.current_order_state?.total_price?.amount || 0;
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

      // Create or update dedicated OMS Order and Invoice record
      const orderDocument = {
        uber_order_id: uberOriginalUuid, // මෙන්න මේක තමයි Uber API එකට යන්න ඕන (e.g. "c7e05234-04ca-4460-...")
        display_id: displayId,            // මේක තමයි ඔයාගේ UI එකේ පේන නම (e.g. "UBER-9bc264")
        items: orderItems,
        status: currentStatus || 'NEW',
        orderId: uberOriginalUuid,
        invoiceNumber: displayId,
        storeId,
        source: 'ubereats',
        amount,
        customerName: body.customer_name || body.customer?.name || 'Uber Customer',
        customerPhone: body.customer_phone || body.customer?.phone || '+94 77 123 4567',
        deliveryAddress: body.delivery_address || 'Delivery Address',
        rawPayload: body,
        updatedAt: now,
      };

      await mongoConn.db.collection('oms_orders').updateOne(
        { uber_order_id: uberOriginalUuid },
        {
          $set: orderDocument,
          $setOnInsert: {
            createdAt: now,
          }
        },
        { upsert: true }
      );

      // Also upsert in main orders collection
      await mongoConn.db.collection('orders').updateOne(
        { $or: [{ id: newOrder.id }, { invoiceNumber: newOrder.invoiceNumber }, { uber_order_id: uberOriginalUuid }] },
        { $set: { ...newOrder, uber_order_id: uberOriginalUuid, display_id: displayId } },
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
