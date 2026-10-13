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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-pickme-signature, x-pickme-branch-id, x-merchant-id, x-store-id',
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
    const signature = req.headers.get('x-pickme-signature');
    const signingKey = process.env.PICKME_WEBHOOK_SIGNING_KEY || 'wowtek_live_pickme_webhook_secure_key_2026_x';

    // Verify HMAC Signature if provided by PickMe
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

    // 1. Multi-Store Branch Resolution for PickMe
    const { searchParams } = new URL(req.url);
    const queryBranchId = searchParams.get('branch_id') || searchParams.get('branch') || searchParams.get('store_id');
    const headerBranchId =
      req.headers.get('x-pickme-branch-id') ||
      req.headers.get('x-branch-id') ||
      req.headers.get('x-merchant-id') ||
      req.headers.get('x-store-id');

    const externalStoreId = queryBranchId || headerBranchId || body.branch_id || body.merchant_id || body.store_id || body.branchId;
    const storeName = body.store_name || body.branch_name || body.location_name;

    let configuredStores: StoreMapping[] = [];
    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        const storeDocs = await mongoConn.db.collection('store_mappings').find({ platform: 'pickme' }).toArray();
        if (storeDocs && storeDocs.length > 0) {
          configuredStores = storeDocs.map(({ _id, ...rest }) => rest as StoreMapping);
        }
      }
    } catch {}

    if (configuredStores.length === 0) {
      configuredStores = DEFAULT_STORE_MAPPINGS.filter((s) => s.platform === 'pickme');
    }

    const { matchedStore, matchReason } = findMatchingStore(
      'pickme',
      {
        externalStoreId,
        branchId: body.branch_id || body.branchId,
        merchantId: body.merchant_id || body.merchantId,
        storeName,
        branchName: body.branch_name,
        rawPayload: body,
      },
      configuredStores
    );

    // 2. Extract PickMe Order Details
    const pickmeOrderId = body.order_id || body.orderId || body.id || Math.floor(10000 + Math.random() * 90000);
    const invoiceNumber = `WT-PKM-${pickmeOrderId}`;
    const customer = body.customer || {};
    const customerName = customer.name || body.customer_name || 'PickMe Customer';
    const customerPhone = customer.phone || body.customer_phone || '+94 77 111 2233';
    const deliveryAddress = body.delivery_address || body.dropoff_address || `${matchedStore.branchName} Delivery Zone`;
    const city = matchedStore.city || 'Colombo 04';

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

    const rawItems = Array.isArray(body.items) ? body.items : Array.isArray(body.line_items) ? body.line_items : [];
    let hasUnregisteredItems = false;
    let unregisteredItemsCount = 0;
    let verifiedCogs = 0;

    const items: OrderItem[] = rawItems.map((it: any) => {
      const sku = (it.sku || it.item_code || '').trim() || `WT-PKM-${it.id || 'ITEM'}`;
      const name = (it.name || it.item_name || 'PickMe Product').trim();
      const quantity = parseInt(it.quantity) || 1;
      const unitPrice = parseFloat(it.price || it.unit_price || 0);

      // Smart fuzzy matching with filler word stripping
      const matchRes = findBestProductMatch(
        {
          externalName: name,
          externalSku: sku,
          channel: 'pickme',
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
      const fallbackTotal = parseFloat(body.total || body.amount || 0);
      items.push({
        sku: 'WT-PKM-DIRECT',
        barcode: '4790000000000',
        name: body.item_name || 'PickMe Food & Market Item',
        quantity: 1,
        unitPrice: fallbackTotal,
        costPrice: 0,
        isRegistered: false,
      });
    }

    const grossTotal = parseFloat(body.total || body.gross_total || items.reduce((s, i) => s + i.unitPrice * i.quantity, 0));
    const platformFeePercent = typeof matchedStore.commissionFeePercent === 'number' ? matchedStore.commissionFeePercent : 20.0;
    const platformFeeAmount = Math.round((grossTotal * platformFeePercent) / 100);
    const gatewayFeePercent = 0.0; // PickMe settles directly to merchant account
    const gatewayFeeAmount = 0;
    const courierFee = 0; // PickMe rider fulfills delivery

    // Accurate COGS and Net Operating Profit
    const profitStatus = hasUnregisteredItems ? 'Pending / Inventory Not Found' : 'Calculated';
    const netProfit = hasUnregisteredItems
      ? 0
      : Math.max(0, grossTotal - verifiedCogs - platformFeeAmount - gatewayFeeAmount - courierFee);

    const orderStatus: OrderStatus = hasUnregisteredItems ? 'Pending' : 'Processing';

    // 4. Construct Multi-Store Tagged Order
    const newOrder: Order = {
      id: `ord-pkm-${pickmeOrderId}-${Date.now().toString().slice(-4)}`,
      invoiceNumber,
      channel: 'pickme',
      channelName: `PickMe Market (${matchedStore.branchName})`,
      storeId: matchedStore.id,
      storeName: matchedStore.externalStoreName,
      branchName: matchedStore.branchName,
      externalStoreId: matchedStore.externalStoreId,
      paymentGateway: 'cash_cod',
      paymentGatewayName: 'PickMe In-App Settlement',
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
      notes: `PickMe Live Order #${pickmeOrderId} tagged to branch: [${matchedStore.branchName}] (${matchedStore.externalStoreId}). Fee: ${platformFeePercent}%. ${matchReason}`,
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
      console.warn('[PickMe Webhook] MongoDB update error:', err?.message);
    }

    saveServerOrder(newOrder);

    // 6. Record Audit Event
    const webhookEvent: WebhookEvent = {
      id: `evt-pkm-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      source: 'pickme',
      event: body.event || 'order.created',
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
        message: `PickMe webhook received and processed successfully for branch [${matchedStore.branchName}].`,
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
      { success: false, error: err.message || 'PickMe webhook processing error' },
      { status: 400, headers: corsHeaders }
    );
  }
}

export async function GET() {
  const stores = await getStoreMappings();
  const pickmeStores = stores.filter((s) => s.platform === 'pickme');

  return NextResponse.json({
    service: 'WOWTEK Pro PickMe Webhook Listener',
    status: 'online',
    platform: 'pickme',
    defaultCommission: '20%',
    configuredBranches: pickmeStores.map((s) => ({
      id: s.id,
      branchName: s.branchName,
      externalStoreId: s.externalStoreId,
      commissionFeePercent: s.commissionFeePercent,
      webhookUrl: `/api/webhooks/pickme?branch_id=${s.externalStoreId}`,
    })),
    instructions: {
      endpoint: '/api/webhooks/pickme',
      queryParam: '?branch_id=<EXTERNAL_STORE_ID>',
      header: 'x-pickme-branch-id: <EXTERNAL_STORE_ID>',
    },
  });
}
