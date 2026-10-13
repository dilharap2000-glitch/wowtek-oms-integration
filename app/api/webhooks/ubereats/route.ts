import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectToMongoDB } from '@/lib/mongodb';
import {
  saveServerOrder,
  saveServerWebhookEvent,
  broadcastLiveUpdate,
} from '@/lib/serverStore';
import {
  Order,
  OrderItem,
  Product,
  ProductAlias,
  StoreMapping,
  WebhookEvent,
  OrderStatus,
} from '@/types';
import { findBestProductMatch, DEFAULT_PRODUCT_ALIASES } from '@/lib/productMatching';
import { findMatchingStore, DEFAULT_STORE_MAPPINGS } from '@/lib/storeMappings';
import { getStoreMappings, getProducts } from '@/lib/db';

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

export async function POST(req: NextRequest) {
  const receivedAt = new Date().toISOString();
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const rawText = await req.text();
    const signature = req.headers.get('x-uber-signature');
    const signingKey = process.env.UBER_WEBHOOK_SIGNING_KEY || 'wowtek_live_ubereats_webhook_secure_key_2026_x';

    // 1. Verify HMAC Signature if provided by Uber Eats
    if (signature) {
      const hmac = crypto.createHmac('sha256', signingKey);
      const digest = hmac.update(rawText).digest('hex');
      if (signature !== digest) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401, headers: corsHeaders });
      }
    }

    let body: any = {};
    try {
      body = JSON.parse(rawText);
    } catch {
      body = { raw: rawText };
    }

    const { event_type, resource_href, meta } = body;
    const eventType = event_type || body.event || 'orders.notification';

    // Multi-Store Branch Resolution for Uber Eats
    const { searchParams } = new URL(req.url);
    const queryStoreId = searchParams.get('store_id') || searchParams.get('branch_id') || searchParams.get('restaurant_id');
    const headerStoreId =
      req.headers.get('x-uber-store-id') ||
      req.headers.get('x-store-id') ||
      req.headers.get('x-location-id') ||
      req.headers.get('x-restaurant-id');

    const externalStoreId =
      queryStoreId ||
      headerStoreId ||
      meta?.store_id ||
      meta?.resource_id ||
      body.store_id ||
      body.restaurant_id ||
      body.location_id ||
      body.storeId;
    const storeName = body.store_name || body.restaurant_name || body.location_name;

    let configuredStores: StoreMapping[] = [];
    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        const storeDocs = await mongoConn.db.collection('store_mappings').find({ platform: 'ubereats' }).toArray();
        if (storeDocs && storeDocs.length > 0) {
          configuredStores = storeDocs.map(({ _id, ...rest }) => rest as StoreMapping);
        }
      }
    } catch {}

    if (configuredStores.length === 0) {
      configuredStores = DEFAULT_STORE_MAPPINGS.filter((s) => s.platform === 'ubereats');
    }

    const { matchedStore, matchReason } = findMatchingStore(
      'ubereats',
      {
        externalStoreId,
        storeName,
        branchName: body.branch_name,
        rawPayload: body,
      },
      configuredStores
    );

    // Handle specific Uber Eats OpenAPI webhook event types
    if (eventType === 'orders.failure') {
      const failEvent: WebhookEvent = {
        id: `evt-ubr-fail-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        source: 'ubereats',
        event: 'orders.failure',
        orderId: meta?.resource_id || body.order_id || 'unknown',
        invoiceNumber: `WT-UBR-${meta?.resource_id || 'FAIL'}`,
        storeId: matchedStore.id,
        storeName: matchedStore.externalStoreName,
        branchName: matchedStore.branchName,
        amount: 0,
        status: 'failed',
        orderStatus: 'Cancelled',
        rawPayload: body,
        receivedAt,
      };

      try {
        const mongoConn = await connectToMongoDB();
        if (mongoConn) {
          await mongoConn.db.collection('webhook_events').insertOne(failEvent);
        }
      } catch {}
      saveServerWebhookEvent(failEvent);
      broadcastLiveUpdate({ type: 'webhook_event', event: failEvent, timestamp: receivedAt });

      return NextResponse.json(
        { success: true, event: 'orders.failure', message: 'Order failure recorded', resource: meta?.resource_id },
        { headers: corsHeaders }
      );
    }

    if (eventType === 'delivery.state_changed') {
      const deliveryStatus = meta?.status || body.status || 'in_transit';
      const deliveryEvent: WebhookEvent = {
        id: `evt-ubr-del-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        source: 'ubereats',
        event: 'delivery.state_changed',
        orderId: meta?.resource_id || body.order_id || 'unknown',
        invoiceNumber: `WT-UBR-${meta?.resource_id || 'DEL'}`,
        storeId: matchedStore.id,
        storeName: matchedStore.externalStoreName,
        branchName: matchedStore.branchName,
        amount: 0,
        status: 'success',
        orderStatus: deliveryStatus === 'delivered' ? 'Completed' : 'Shipped',
        rawPayload: body,
        receivedAt,
      };

      try {
        const mongoConn = await connectToMongoDB();
        if (mongoConn) {
          await mongoConn.db.collection('webhook_events').insertOne(deliveryEvent);
        }
      } catch {}
      saveServerWebhookEvent(deliveryEvent);
      broadcastLiveUpdate({ type: 'webhook_event', event: deliveryEvent, timestamp: receivedAt });

      return NextResponse.json(
        { success: true, event: 'delivery.state_changed', status: deliveryStatus },
        { headers: corsHeaders }
      );
    }

    // 2. Extract Uber Eats Order Details (orders.notification, orders.scheduled.notification, or direct order)
    const uberOrderId = body.order_id || meta?.resource_id || body.id || body.orderId || Math.floor(10000 + Math.random() * 90000);
    const invoiceNumber = `WT-UBR-${uberOrderId}`;
    const customer = body.customer || body.eater || {};
    const customerName = customer.name || customer.first_name ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() : body.customer_name || 'Uber Eats Customer';
    const customerPhone = customer.phone || body.customer_phone || '+94 77 222 3344';
    const deliveryAddress = body.delivery_address || body.dropoff?.address || `${matchedStore.branchName} Express Zone`;
    const city = matchedStore.city || 'Colombo 03';

    // 3. Line Items & Centralized Inventory Deduction with Smart Product Matching
    let catalog: Product[] = [];
    let aliases: ProductAlias[] = [];
    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        const [prodDocs, aliasDocs] = await Promise.all([
          mongoConn.db.collection('products').find({}).toArray().catch(() => []),
          mongoConn.db.collection('product_aliases').find({}).toArray().catch(() => []),
        ]);
        if (prodDocs && prodDocs.length > 0) {
          catalog = prodDocs.map(({ _id, ...rest }) => rest as Product);
        }
        if (aliasDocs && aliasDocs.length > 0) {
          aliases = aliasDocs.map(({ _id, ...rest }) => rest as ProductAlias);
        }
      }
    } catch {}

    if (catalog.length === 0) {
      catalog = await getProducts();
    }
    if (aliases.length === 0) {
      aliases = DEFAULT_PRODUCT_ALIASES;
    }

    const rawItems = Array.isArray(body.items) ? body.items : Array.isArray(body.cart?.items) ? body.cart.items : [];
    let hasUnregisteredItems = false;
    let unregisteredItemsCount = 0;
    let verifiedCogs = 0;

    const items: OrderItem[] = rawItems.map((it: any) => {
      const sku = (it.sku || it.external_data || it.item_id || '').trim() || `WT-UBR-${it.id || 'ITEM'}`;
      const name = (it.name || it.title || 'Uber Eats Product').trim();
      const quantity = parseInt(it.quantity) || 1;
      const unitPrice = parseFloat(it.price || it.unit_price || (it.price_cents ? it.price_cents / 100 : 0) || 0);

      // Smart fuzzy matching with filler word stripping
      const matchRes = findBestProductMatch(
        {
          externalName: name,
          externalSku: sku,
          channel: 'ubereats',
        },
        catalog,
        aliases
      );

      const matchedProduct = matchRes.matchedProduct;
      const availableStock = matchedProduct
        ? (matchedProduct.stockStore || 0) + (matchedProduct.stockWarehouse || 0)
        : 0;

      if (matchedProduct && availableStock >= quantity && matchedProduct.costPrice > 0) {
        // Deduct from central stock
        const costPrice = matchedProduct.costPrice;
        verifiedCogs += costPrice * quantity;
        return {
          sku: matchedProduct.sku,
          barcode: matchedProduct.barcode || '4790000000000',
          name,
          quantity,
          unitPrice,
          costPrice,
          isRegistered: true,
        };
      } else {
        hasUnregisteredItems = true;
        unregisteredItemsCount += 1;
        return {
          sku: matchedProduct?.sku || sku,
          barcode: matchedProduct?.barcode || '4790000000000',
          name,
          quantity,
          unitPrice,
          costPrice: 0,
          isRegistered: false,
        };
      }
    });

    if (items.length === 0) {
      hasUnregisteredItems = true;
      unregisteredItemsCount = 1;
      const fallbackTotal = parseFloat(body.total || body.amount || (body.total_cents ? body.total_cents / 100 : 0) || 0);
      items.push({
        sku: 'WT-UBR-DIRECT',
        barcode: '4790000000000',
        name: body.item_name || 'Uber Eats Retail Item',
        quantity: 1,
        unitPrice: fallbackTotal,
        costPrice: 0,
        isRegistered: false,
      });
    }

    const grossTotal = parseFloat(
      body.total || body.gross_total || (body.total_cents ? body.total_cents / 100 : 0) || items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
    );
    const platformFeePercent = typeof matchedStore.commissionFeePercent === 'number' ? matchedStore.commissionFeePercent : 15.4;
    const platformFeeAmount = Math.round((grossTotal * platformFeePercent) / 100);
    const gatewayFeePercent = 0.0; // Uber settles directly
    const gatewayFeeAmount = 0;
    const courierFee = 0; // Uber Eats driver fulfills delivery

    // Accurate COGS and Net Operating Profit
    const profitStatus = hasUnregisteredItems ? 'Pending / Inventory Not Found' : 'Calculated';
    const netProfit = hasUnregisteredItems
      ? 0
      : Math.max(0, grossTotal - verifiedCogs - platformFeeAmount - gatewayFeeAmount - courierFee);

    const orderStatus: OrderStatus = hasUnregisteredItems ? 'Pending' : 'Processing';

    // 4. Construct Multi-Store Tagged Order
    const newOrder: Order = {
      id: `ord-ubr-${uberOrderId}-${Date.now().toString().slice(-4)}`,
      invoiceNumber,
      channel: 'ubereats',
      channelName: `Uber Eats Retail (${matchedStore.branchName})`,
      storeId: matchedStore.id,
      storeName: matchedStore.externalStoreName,
      branchName: matchedStore.branchName,
      externalStoreId: matchedStore.externalStoreId,
      paymentGateway: 'card_online',
      paymentGatewayName: 'Uber In-App Payment',
      customerName,
      customerPhone,
      deliveryAddress,
      city,
      items,
      grossTotal,
      platformFeePercent,
      platformFeeAmount,
      gatewayFeePercent,
      gatewayFeeAmount,
      courierFee,
      costOfGoods: verifiedCogs,
      netProfit,
      profitStatus,
      hasUnregisteredItems,
      unregisteredItemsCount,
      status: orderStatus,
      createdAt: body.created_at || receivedAt,
      updatedAt: receivedAt,
      waybillGenerated: false,
      notes: `Uber Eats Live Order #${uberOrderId} tagged to branch: [${matchedStore.branchName}] (${matchedStore.externalStoreId}). Fee: ${platformFeePercent}%. ${matchReason}`,
    };

    // 5. Centralized Inventory Deduction for In-Stock Items
    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        for (const item of newOrder.items) {
          if (item.isRegistered && item.costPrice > 0) {
            await mongoConn.db.collection('products').updateOne(
              { sku: item.sku },
              { $inc: { stockStore: -item.quantity } }
            );
          }
        }

        await mongoConn.db.collection('orders').updateOne(
          { $or: [{ id: newOrder.id }, { invoiceNumber: newOrder.invoiceNumber }] },
          { $set: newOrder },
          { upsert: true }
        );
      }
    } catch (err: any) {
      console.warn('[Uber Eats Webhook] MongoDB update error:', err?.message);
    }

    saveServerOrder(newOrder);

    // 6. Record Audit Event
    const webhookEvent: WebhookEvent = {
      id: `evt-ubr-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      source: 'ubereats',
      event: body.event_type || body.event || 'order.created',
      orderId: newOrder.id,
      invoiceNumber: newOrder.invoiceNumber,
      storeId: matchedStore.id,
      storeName: matchedStore.externalStoreName,
      branchName: matchedStore.branchName,
      customerName: newOrder.customerName,
      customerPhone: newOrder.customerPhone,
      amount: newOrder.grossTotal,
      status: 'success',
      orderStatus: newOrder.status,
      rawPayload: body,
      receivedAt,
    };

    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        await mongoConn.db.collection('webhook_events').updateOne(
          { id: webhookEvent.id },
          { $set: webhookEvent },
          { upsert: true }
        );
      }
    } catch {}

    saveServerWebhookEvent(webhookEvent);

    // 7. Real-Time SSE Broadcast
    broadcastLiveUpdate({
      type: 'new_order_webhook',
      order: newOrder,
      event: webhookEvent,
      timestamp: receivedAt,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Uber Eats webhook received and processed successfully for branch [${matchedStore.branchName}].`,
        order: {
          id: newOrder.id,
          invoiceNumber: newOrder.invoiceNumber,
          branchName: matchedStore.branchName,
          storeName: matchedStore.externalStoreName,
          externalStoreId: matchedStore.externalStoreId,
          grossTotal: newOrder.grossTotal,
          netProfit: newOrder.netProfit,
          commissionFee: platformFeeAmount,
          commissionPercent: platformFeePercent,
          status: newOrder.status,
          profitStatus: newOrder.profitStatus,
        },
        storeResolution: {
          matchedStoreId: matchedStore.id,
          branchName: matchedStore.branchName,
          matchReason,
        },
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Uber Eats webhook processing error' },
      { status: 400, headers: corsHeaders }
    );
  }
}

export async function GET() {
  const stores = await getStoreMappings();
  const ubrStores = stores.filter((s) => s.platform === 'ubereats');

  return NextResponse.json({
    service: 'WOWTEK Pro Uber Eats Webhook Listener',
    status: 'online',
    platform: 'ubereats',
    defaultCommission: '15.4%',
    configuredBranches: ubrStores.map((s) => ({
      id: s.id,
      branchName: s.branchName,
      externalStoreId: s.externalStoreId,
      commissionFeePercent: s.commissionFeePercent,
      webhookUrl: `/api/webhooks/ubereats?store_id=${s.externalStoreId}`,
    })),
    instructions: {
      endpoint: '/api/webhooks/ubereats',
      queryParam: '?store_id=<EXTERNAL_STORE_ID>',
      header: 'x-uber-store-id: <EXTERNAL_STORE_ID>',
    },
  });
}
