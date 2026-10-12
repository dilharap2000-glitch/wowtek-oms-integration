import { NextRequest, NextResponse } from 'next/server';
import {
  getOrders,
  saveOrder,
  saveWaybill,
  getApiConfig,
  saveWebhookEvent,
  getProducts,
} from '@/lib/db';
import {
  Order,
  OrderItem,
  Product,
  ProductAlias,
  TransExpressWaybill,
  WebhookEvent,
} from '@/types';
import { findBestProductMatch } from '@/lib/productMatching';
import { connectToMongoDB } from '@/lib/mongodb';
import {
  saveServerOrder,
  saveServerWaybill,
  saveServerWebhookEvent,
} from '@/lib/serverStore';

export const dynamic = 'force-dynamic';

/**
 * Normalizes Sri Lankan phone numbers
 */
function normalizeContact(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('94') && cleaned.length === 11) {
    return '0' + cleaned.substring(2);
  }
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return cleaned;
  }
  return cleaned;
}

/**
 * GET /api/orders/sync
 * Polls the connected WooCommerce store for recent processing/pending orders
 */
export async function GET(req: NextRequest) {
  const config = await getApiConfig();
  const existingOrders = await getOrders();
  const catalog = await getProducts();
  const receivedAt = new Date().toISOString();

  // If WooCommerce credentials are configured, attempt REST API fetch
  if (
    config.woocommerceUrl &&
    config.woocommerceConsumerKey &&
    config.woocommerceConsumerSecret
  ) {
    try {
      const baseUrl = config.woocommerceUrl.replace(/\/+$/, '');
      const url = new URL(`${baseUrl}/wp-json/wc/v3/orders`);
      url.searchParams.append('status', 'processing');
      url.searchParams.append('per_page', '10');

      // Basic Auth Header
      const credentials = Buffer.from(
        `${config.woocommerceConsumerKey}:${config.woocommerceConsumerSecret}`
      ).toString('base64');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const upstreamRes = await fetch(url.toString(), {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (upstreamRes.ok) {
        const liveOrders = await upstreamRes.json();
        const newlyImported: any[] = [];

        let catalog: Product[] = await getProducts();
        let aliases: ProductAlias[] = [];
        try {
          const mongoConn = await connectToMongoDB();
          if (mongoConn) {
            const [mongoProducts, mongoAliases] = await Promise.all([
              mongoConn.db.collection('products').find({}).toArray().catch(() => []),
              mongoConn.db.collection('product_aliases').find({}).toArray().catch(() => []),
            ]);
            if (mongoProducts && mongoProducts.length > 0) {
              catalog = mongoProducts.map(({ _id, ...rest }) => rest as Product);
            }
            if (mongoAliases && mongoAliases.length > 0) {
              aliases = mongoAliases.map(({ _id, ...rest }) => rest as ProductAlias);
            }
          }
        } catch (e) {
          console.warn('[Sync] MongoDB catalog fetch error:', e);
        }

        for (const wcOrder of liveOrders) {
          // STRICT FILTER: Accept ONLY confirmed 'processing' status orders.
          // Ignore any pending payment ('pending', 'on-hold') or cancelled orders.
          const wcStatus = (wcOrder.status || '').toLowerCase().trim();
          if (wcStatus !== 'processing') {
            continue;
          }

          const invoiceNumber = `WT-WC-${wcOrder.id}`;
          // Check if already in system
          if (existingOrders.some((o) => o.invoiceNumber === invoiceNumber)) {
            continue;
          }

          // Process and import
          const billing = wcOrder.billing || {};
          const shipping = wcOrder.shipping || {};
          const customerName = `${billing.first_name || shipping.first_name || 'Customer'} ${
            billing.last_name || shipping.last_name || ''
          }`.trim();
          const customerPhone = billing.phone || shipping.phone || '+94 77 123 4567';
          const deliveryAddress = shipping.address_1 || billing.address_1 || 'Colombo, Sri Lanka';
          const city = shipping.city || billing.city || 'Colombo';

          let hasUnregisteredItems = false;
          let unregisteredItemsCount = 0;

          const items: OrderItem[] = (wcOrder.line_items || []).map((li: any) => {
            const sku = (li.sku || '').trim() || `WT-WC-${li.product_id}`;
            const name = (li.name || 'WooCommerce Product').trim();
            const quantity = parseInt(li.quantity) || 1;
            const unitPrice = parseFloat(li.price || (li.total ? li.total / quantity : 0) || 0);

            // SMART PRODUCT NAME & SKU MATCHING ALGORITHM:
            const matchResult = findBestProductMatch(
              {
                externalName: name,
                externalSku: sku,
                channel: 'woocommerce',
              },
              catalog,
              aliases
            );

            const matched = matchResult.matchedProduct;

            // STRICT INVENTORY VALIDATION & COST CHECK:
            const isRegistered = Boolean(matched && typeof matched.costPrice === 'number' && matched.costPrice > 0);
            const costPrice = isRegistered ? (matched!.costPrice || 0) : 0;

            if (!isRegistered) {
              hasUnregisteredItems = true;
              unregisteredItemsCount += 1;
            }

            return {
              sku: matched?.sku || sku,
              barcode: matched?.barcode || `479${Math.floor(1000000000 + Math.random() * 9000000000)}`,
              name,
              quantity,
              unitPrice,
              costPrice,
              isRegistered,
            };
          });

          if (items.length === 0) {
            hasUnregisteredItems = true;
            unregisteredItemsCount += 1;
          }

          const grossTotal = parseFloat(wcOrder.total) || items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
          const costOfGoods = items.reduce((s, i) => s + (i.costPrice || 0) * i.quantity, 0);

          // Trans Express Single Auto Live API Call
          const transExpressClientToken = (
            process.env.TRANS_EXPRESS_CLIENT_TOKEN ||
            process.env.TRANS_EXPRESS_API_KEY ||
            config.transExpressApiKey ||
            ''
          ).trim();

          const isCod = wcOrder.payment_method?.includes('cod');
          const orderDescription = (wcOrder.line_items || []).map((li: any) => `${li.name} (x${li.quantity})`).join(', ') || 'WooCommerce Order';

          const transExpressPayload = {
            order_no: String(wcOrder.id),
            customer_name: customerName,
            address: `${deliveryAddress}, ${city}`.trim(),
            description: orderDescription,
            phone_no: customerPhone,
            phone_no2: '',
            cod: isCod ? grossTotal : 0,
            city_id: Number(shipping.city_id || billing.city_id || 864),
            note: wcOrder.customer_note || 'WOWTEK Polled Order',
          };

          let realWaybill: TransExpressWaybill | null = null;
          let realTrackingNumber: string | null = null;
          let realWaybillId: string | null = null;
          let transExpressError: string | null = null;
          let transExpressApiResponse: any = null;

          try {
            console.log('[Orders Sync API] Live Trans Express Call for order:', wcOrder.id);
            const teController = new AbortController();
            const teTimeoutId = setTimeout(() => teController.abort(), 8000);

            const teRes = await fetch('https://portal.transexpress.lk/api/orders/upload/single-auto', {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                Authorization: `Bearer ${transExpressClientToken}`,
              },
              body: JSON.stringify(transExpressPayload),
              signal: teController.signal,
            });

            clearTimeout(teTimeoutId);
            const teText = await teRes.text();
            console.log(`[Orders Sync API] Trans Express Response HTTP ${teRes.status}:`, teText);

            try {
              transExpressApiResponse = JSON.parse(teText);
            } catch {
              transExpressApiResponse = { rawBody: teText };
            }

            if (teRes.ok) {
              const resData = transExpressApiResponse?.data || transExpressApiResponse;
              const returnedTracking =
                resData?.tracking_number ||
                resData?.tracking_no ||
                resData?.waybill_number ||
                resData?.waybill_no ||
                resData?.barcode ||
                transExpressApiResponse?.tracking_number ||
                transExpressApiResponse?.tracking_no;

              if (returnedTracking) {
                realTrackingNumber = String(returnedTracking);
                realWaybillId = String(resData?.waybill_id || resData?.id || `wb-${realTrackingNumber}`);
                realWaybill = {
                  id: realWaybillId,
                  orderId: `ord-wc-${wcOrder.id}`,
                  trackingNumber: realTrackingNumber,
                  recipientName: customerName,
                  recipientPhone: customerPhone,
                  destination: `${deliveryAddress}, ${city}`,
                  district: 'Colombo',
                  codAmount: isCod ? grossTotal : 0,
                  weightKg: 1.2,
                  status: 'Queued',
                  bookingDate: `${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString(
                    [],
                    { hour: '2-digit', minute: '2-digit' }
                  )}`,
                  courierNotes: `Synced from WooCommerce Store #${wcOrder.id}. Live Trans Express (${realTrackingNumber})`,
                  labelPrinted: false,
                };
              } else {
                transExpressError = `Trans Express HTTP ${teRes.status}: Missing tracking number`;
              }
            } else {
              transExpressError = `Trans Express HTTP ${teRes.status}: ${teText.slice(0, 200)}`;
            }
          } catch (teErr: any) {
            transExpressError = `Trans Express Error: ${teErr?.message || 'Connection failed'}`;
          }

          const newOrder: Order = {
            id: `ord-wc-${wcOrder.id}-${Date.now().toString().slice(-4)}`,
            invoiceNumber,
            channel: 'woocommerce',
            channelName: 'WooCommerce Store',
            paymentGateway: isCod ? 'cash_cod' : 'card_online',
            paymentGatewayName: wcOrder.payment_method_title || 'Online Payment',
            customerName,
            customerPhone,
            deliveryAddress,
            city,
            items: items.length > 0 ? items : [{
              sku: 'WT-PROD',
              barcode: '4790000000000',
              name: 'Imported Item',
              quantity: 1,
              unitPrice: grossTotal,
              costPrice: 0,
              isRegistered: false,
            }],
            grossTotal,
            platformFeePercent: 0,
            platformFeeAmount: 0,
            gatewayFeePercent: isCod ? 0 : 3,
            gatewayFeeAmount: isCod ? 0 : Math.round(grossTotal * 0.03),
            courierFee: 400,
            costOfGoods,
            netProfit: hasUnregisteredItems ? 0 : Math.max(0, grossTotal - costOfGoods - 400 - (isCod ? 0 : Math.round(grossTotal * 0.03))),
            profitStatus: hasUnregisteredItems ? 'Pending / Inventory Not Found' : 'Calculated',
            hasUnregisteredItems,
            unregisteredItemsCount,
            status: wcOrder.status === 'completed' ? 'Completed' : 'Processing',
            createdAt: wcOrder.date_created || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            waybillGenerated: Boolean(realWaybill),
            waybillNumber: realTrackingNumber || undefined,
            waybillId: realWaybillId || undefined,
            transExpressTrackingNumber: realTrackingNumber || undefined,
            waybillError: transExpressError || undefined,
            smsConfirmationSent: true,
            notes: `Synced via WooCommerce REST API polling.${transExpressError ? ` [Courier: ${transExpressError}]` : ''}`,
          };

          // Audit Log Event
          const evt: WebhookEvent = {
            id: `evt-poll-${Date.now()}-${wcOrder.id}`,
            source: 'manual_sync',
            event: 'order.polled_from_api',
            orderId: newOrder.id,
            invoiceNumber: newOrder.invoiceNumber,
            customerName: newOrder.customerName,
            customerPhone: newOrder.customerPhone,
            amount: newOrder.grossTotal,
            status: realWaybill ? 'success' : 'failed',
            waybillId: realWaybill?.id,
            waybillNumber: realTrackingNumber || undefined,
            waybillError: transExpressError || undefined,
            transExpressResponse: transExpressApiResponse,
            smsSent: true,
            smsGateway: 'SMSlenz',
            rawPayload: wcOrder,
            receivedAt,
          };

          try {
            const mongoConn = await connectToMongoDB();
            if (mongoConn) {
              const mongoOps: Promise<any>[] = [
                mongoConn.db.collection('orders').updateOne(
                  { $or: [{ id: newOrder.id }, { invoiceNumber: newOrder.invoiceNumber }] },
                  { $set: newOrder },
                  { upsert: true }
                ),
                mongoConn.db.collection('webhook_events').updateOne(
                  { id: evt.id },
                  { $set: evt },
                  { upsert: true }
                ),
              ];

              if (realWaybill) {
                mongoOps.push(
                  mongoConn.db.collection('waybills').updateOne(
                    { $or: [{ id: realWaybill.id }, { trackingNumber: realWaybill.trackingNumber }] },
                    { $set: realWaybill },
                    { upsert: true }
                  )
                );
              }

              await Promise.all(mongoOps);

              // REAL-TIME STOCK DEDUCTION:
              // Ensure stock is only deducted from MongoDB inventory when the product actually exists and matches the order item.
              if (Array.isArray(newOrder.items)) {
                for (const item of newOrder.items) {
                  if (!item.sku) continue;
                  const existingProduct = await mongoConn.db.collection('products').findOne({
                    $or: [
                      { sku: item.sku },
                      ...(item.barcode ? [{ barcode: item.barcode }] : []),
                      { name: item.name },
                    ],
                  });

                  if (existingProduct) {
                    await mongoConn.db.collection('products').updateOne(
                      { _id: existingProduct._id },
                      { $inc: { stockStore: -item.quantity } }
                    );
                    console.log(`[Sync] Deducted stock for registered product: ${existingProduct.sku} (${existingProduct.name})`);
                  } else {
                    console.warn(`[Sync] Skipped stock deduction: Item "${item.sku} - ${item.name}" is not registered in MongoDB inventory.`);
                  }
                }
              }
            }
          } catch (err: any) {
            console.warn('[Orders Sync API] MongoDB write error:', err?.message);
          }

          saveServerOrder(newOrder);
          saveServerWebhookEvent(evt);
          await saveOrder(newOrder);
          await saveWebhookEvent(evt);

          if (realWaybill) {
            saveServerWaybill(realWaybill);
            await saveWaybill(realWaybill);
          }

          newlyImported.push(newOrder);
        }

        return NextResponse.json({
          success: true,
          message: `Polled WooCommerce store successfully. ${newlyImported.length} new orders imported.`,
          importedCount: newlyImported.length,
          orders: newlyImported,
        });
      }
    } catch (err: any) {
      // Continue to fallback status report
    }
  }

  return NextResponse.json({
    success: true,
    message: 'WooCommerce sync polling endpoint active.',
    storeUrl: config.woocommerceUrl || 'https://store.wowtek.lk',
    status: 'polling_ready',
    activeOrderCount: existingOrders.filter((o) => o.channel === 'woocommerce').length,
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /api/orders/sync
 * Manually trigger order synchronization or simulate a live incoming test order
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || 'simulate_test_order';
    const receivedAt = new Date().toISOString();

    if (action === 'simulate_test_order' || body.simulate === true) {
      const testOrderId = Math.floor(10000 + Math.random() * 90000);
      const testPhone = body.customerPhone || '0778912345';
      const customerName = body.customerName || 'Kasun Wickramasinghe';
      const totalAmount = body.total || 22800;

      const testPayload = {
        id: testOrderId,
        status: body.status || 'processing',
        total: totalAmount.toString(),
        currency: 'LKR',
        date_created: receivedAt,
        payment_method: body.paymentMethod || 'cod',
        payment_method_title: body.paymentMethod === 'card' ? 'Online Card Payment' : 'Cash on Delivery (COD)',
        billing: {
          first_name: customerName.split(' ')[0],
          last_name: customerName.split(' ')[1] || 'Perera',
          phone: testPhone,
          email: 'kasun.test@wowtek.lk',
          address_1: 'No. 142 Galle Road, Bambalapitiya',
          city: 'Colombo 04',
          country: 'LK',
        },
        shipping: {
          first_name: customerName.split(' ')[0],
          last_name: customerName.split(' ')[1] || 'Perera',
          address_1: 'No. 142 Galle Road, Bambalapitiya',
          city: 'Colombo 04',
          country: 'LK',
        },
        line_items: [
          {
            id: 881,
            product_id: 104,
            name: body.productName || 'Kingston NV2 1TB PCIe 4.0 NVMe SSD',
            sku: body.sku || 'WT-SSD-1TB-NVME',
            quantity: 1,
            price: totalAmount.toString(),
            total: totalAmount.toString(),
          },
        ],
      };

      // Forward directly into internal WooCommerce webhook listener
      const webhookRes = await fetch(`${req.nextUrl.origin}/api/webhooks/woocommerce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wc-webhook-topic': 'order.created',
          'x-wc-webhook-source': 'woocommerce-live-test',
        },
        body: JSON.stringify(testPayload),
      });

      const webhookData = await webhookRes.json();
      return NextResponse.json(webhookData);
    }

    return NextResponse.json({ success: true, message: 'Sync request received.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
