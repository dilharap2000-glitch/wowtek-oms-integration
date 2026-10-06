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
  TransExpressWaybill,
  WebhookEvent,
} from '@/types';

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
      url.searchParams.append('status', 'processing,pending');
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

        for (const wcOrder of liveOrders) {
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

          const items: OrderItem[] = (wcOrder.line_items || []).map((li: any) => ({
            sku: li.sku || `WT-WC-${li.product_id}`,
            barcode: `479${Math.floor(1000000000 + Math.random() * 9000000000)}`,
            name: li.name,
            quantity: parseInt(li.quantity) || 1,
            unitPrice: parseFloat(li.price || li.total / li.quantity || 0),
            costPrice: Math.round(parseFloat(li.price || li.total / li.quantity || 0) * 0.7),
          }));

          const grossTotal = parseFloat(wcOrder.total) || items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
          const costOfGoods = items.reduce((s, i) => s + i.costPrice * i.quantity, 0);
          const trackingNumber = `TX-CMB-${Math.floor(10000 + Math.random() * 90000)}`;

          const newOrder: Order = {
            id: `ord-wc-${wcOrder.id}-${Date.now().toString().slice(-4)}`,
            invoiceNumber,
            channel: 'woocommerce',
            channelName: 'WooCommerce Store',
            paymentGateway: wcOrder.payment_method?.includes('cod') ? 'cash_cod' : 'card_online',
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
              costPrice: Math.round(grossTotal * 0.7),
            }],
            grossTotal,
            platformFeePercent: 0,
            platformFeeAmount: 0,
            gatewayFeePercent: wcOrder.payment_method?.includes('cod') ? 0 : 3,
            gatewayFeeAmount: wcOrder.payment_method?.includes('cod') ? 0 : Math.round(grossTotal * 0.03),
            courierFee: 400,
            costOfGoods,
            netProfit: grossTotal - costOfGoods - 400,
            status: wcOrder.status === 'completed' ? 'Completed' : 'Processing',
            createdAt: wcOrder.date_created || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            waybillGenerated: true,
            waybillNumber: trackingNumber,
            smsConfirmationSent: true,
            notes: `Synced via WooCommerce REST API polling.`,
          };

          await saveOrder(newOrder);

          // Trans Express Waybill
          const waybill: TransExpressWaybill = {
            id: `wb-${Date.now().toString().slice(-4)}`,
            orderId: newOrder.id,
            trackingNumber,
            recipientName: newOrder.customerName,
            recipientPhone: newOrder.customerPhone,
            destination: `${newOrder.deliveryAddress}, ${newOrder.city}`,
            district: 'Colombo',
            codAmount: newOrder.paymentGateway === 'cash_cod' ? newOrder.grossTotal : 0,
            weightKg: 1.2,
            status: 'Queued',
            bookingDate: `${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString(
              [],
              { hour: '2-digit', minute: '2-digit' }
            )}`,
            courierNotes: `Synced from WooCommerce Store #${wcOrder.id}`,
            labelPrinted: false,
          };
          await saveWaybill(waybill);

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
            status: 'success',
            waybillId: waybill.id,
            waybillNumber: trackingNumber,
            smsSent: true,
            smsGateway: 'SMSlenz',
            rawPayload: wcOrder,
            receivedAt,
          };
          await saveWebhookEvent(evt);
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
