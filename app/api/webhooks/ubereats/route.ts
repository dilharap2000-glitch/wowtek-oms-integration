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
    
    broadcastLiveUpdate(body?.type ? body : { type: 'webhook_ubereats_event', data: body, timestamp: now });

    const orderId = body.order_id || body.meta?.resource_id || body.id || 'N/A';
    const storeId = body.store_id || body.meta?.user_id || 'uber-store';

    const evt: WebhookEvent = {
      id: `evt-uber-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      source: 'ubereats',
      event: body.event_type || body.event || 'orders.notification',
      orderId: orderId,
      invoiceNumber: orderId !== 'N/A' ? `UBER-${orderId.slice(-6)}` : 'N/A',
      storeId: storeId,
      storeName: body.store_name || 'Uber Eats Store',
      branchName: 'Central Hub',
      amount: parseFloat(body.order?.current_order_state?.total_price?.amount || body.amount || 0) / 100 || 0,
      status: 'success',
      orderStatus: 'PENDING_ACCEPTANCE', // Action Buttons පෙන්නන්න මේ status එක set කරනවා
      rawPayload: body,
      receivedAt: now,
    };

    saveServerWebhookEvent(evt);

    // If order details exist, sync to OMS orders so it displays in Recent Orders
    if (orderId && orderId !== 'N/A') {
      const grossTotal = evt.amount > 0 ? evt.amount : parseFloat(body.total || body.amount || 0);
      const feeAmount = Math.round((grossTotal * 15.4) / 100);
      const rawItems = Array.isArray(body.items) ? body.items : [];
      const items: OrderItem[] = rawItems.length > 0
        ? rawItems.map((it: any) => ({
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
              unitPrice: grossTotal,
              costPrice: 0,
              isRegistered: false,
            },
          ];

      const newOrder: Order = {
        id: `ord-ubr-${orderId}`,
        invoiceNumber: evt.invoiceNumber !== 'N/A' ? evt.invoiceNumber : (body.invoiceNumber || `UBER-${String(orderId).slice(-6)}`),
        channel: 'ubereats',
        channelName: `Uber Eats Retail (${evt.storeName})`,
        storeId: storeId,
        storeName: evt.storeName,
        branchName: evt.branchName,
        externalStoreId: storeId,
        paymentGateway: 'card_online',
        paymentGatewayName: 'Uber In-App Payment',
        customerName: body.customer_name || body.customer?.name || 'Uber Customer',
        customerPhone: body.customer_phone || body.customer?.phone || '+94 77 123 4567',
        deliveryAddress: body.delivery_address || 'Delivery Address',
        city: 'Colombo',
        items,
        grossTotal,
        platformFeePercent: 15.4,
        platformFeeAmount: feeAmount,
        gatewayFeePercent: 0,
        gatewayFeeAmount: 0,
        courierFee: 0,
        costOfGoods: 0,
        netProfit: Math.max(0, grossTotal - feeAmount),
        profitStatus: 'Calculated',
        hasUnregisteredItems: false,
        unregisteredItemsCount: 0,
        status: (body.status === 'Processing' || body.status === 'Completed' || body.status === 'Cancelled') ? body.status : 'PENDING_ACCEPTANCE',
        createdAt: now,
        updatedAt: now,
        waybillGenerated: false,
        notes: `Uber Eats Webhook processed: ${body.event_type || body.event || 'orders.notification'}`,
      };

      saveServerOrder(newOrder);
      broadcastLiveUpdate({ type: 'new_order_webhook', order: newOrder, event: evt, timestamp: now });

      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        await mongoConn.db.collection('orders').updateOne(
          { $or: [{ id: newOrder.id }, { invoiceNumber: newOrder.invoiceNumber }] },
          { $set: newOrder },
          { upsert: true }
        );
      }
    }

    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      await mongoConn.db.collection('webhook_events').updateOne(
        { id: evt.id },
        { $set: evt },
        { upsert: true }
      );
    }
  } catch (err: any) {
    console.warn('[UberEats Webhook Background Task Warn]:', err?.message);
  }
}

export async function POST(req: NextRequest | Request) {
  try {
    const body = await req.json();

    const immediateResponse = NextResponse.json({ status: 'success' }, { status: 200 });

    processBackgroundTasks(body).catch((err) => console.error('Background Task Error:', err));

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
