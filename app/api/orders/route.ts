import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getServerStore, saveServerOrder, deleteServerOrder } from '@/lib/serverStore';
import { Order, Product, ProductAlias } from '@/types';
import { findBestProductMatch, DEFAULT_PRODUCT_ALIASES } from '@/lib/productMatching';
import { SAMPLE_PRODUCTS } from '@/lib/sampleProducts';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      const orders = await mongoConn.db
        .collection('orders')
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
      const cleanOrders = orders.map(({ _id, ...rest }) => rest as Order);
      return NextResponse.json({ success: true, orders: cleanOrders, source: 'mongodb' });
    }
  } catch (err: any) {
    console.warn('[Orders API GET] MongoDB read error:', err.message);
  }

  const store = getServerStore();
  return NextResponse.json({ success: true, orders: store.orders, source: 'serverStore' });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Handle return action directly
    if (body.action === 'return') {
      const { orderId, returnedSkus, reason } = body;
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        const queryConditions: any[] = [
          { id: String(orderId) },
          { orderId: String(orderId) },
          { invoiceNumber: String(orderId) },
          { _id: String(orderId) },
        ];
        if (ObjectId.isValid(String(orderId)) && String(orderId).length === 24) {
          try {
            queryConditions.unshift({ _id: new ObjectId(String(orderId)) });
          } catch {}
        }

        const orderDoc = await mongoConn.db.collection('orders').findOne({
          $or: queryConditions,
        });

        if (orderDoc) {
          const { _id, ...orderData } = orderDoc;
          const order = orderData as unknown as Order;
          const restoredItems: string[] = [];

          const targetSkus = Array.isArray(returnedSkus) && returnedSkus.length > 0 ? returnedSkus : [];

          order.items = (order.items || []).map((item: any) => {
            const shouldReturn = targetSkus.length === 0 || targetSkus.includes(item.sku) || targetSkus.includes(item.skuCode);
            if (shouldReturn && !item.returned) {
              restoredItems.push(`${item.name} (${item.quantity} qty)`);
              return {
                ...item,
                returned: true,
                returnedQty: item.quantity,
              };
            }
            return item;
          });

          const allItemsReturned = order.items.every((it: any) => it.returned);
          order.status = allItemsReturned ? 'Returned' : 'Partially Returned';
          order.returnedAt = new Date().toISOString();
          order.returnReason = reason || 'Customer requested return & refund';
          order.updatedAt = new Date().toISOString();

          if (allItemsReturned) {
            order.netProfit = 0;
          }

          // Restore inventory stock in MongoDB Atlas
          const itemsToRestore = targetSkus.length > 0
            ? order.items.filter((i: any) => targetSkus.includes(i.sku) || targetSkus.includes(i.skuCode))
            : order.items;

          for (const rawItem of itemsToRestore) {
            const item = rawItem as any;
            const sku = item.sku || item.skuCode || item.barcode || item.code;
            if (sku) {
              await mongoConn.db.collection('products').updateOne(
                { $or: [{ sku }, { skuCode: sku }, { barcode: sku }, { code: sku }] },
                {
                  $inc: { storeStock: Number(item.quantity || 1), stockQuantity: Number(item.quantity || 1) },
                  $unset: { warehouseStock: '', stockWarehouse: '', stockStore: '' },
                }
              );
            }
          }

          await mongoConn.db.collection('orders').updateOne(
            { _id: orderDoc._id },
            { $set: { ...order, status: 'Returned', netProfit: 0, returnedAt: new Date() } }
          );

          saveServerOrder(order);

          return NextResponse.json({
            success: true,
            message: 'Item successfully returned, added back to store stock, and profit reversed!',
            order,
            restoredItems,
          });
        }
      }
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return NextResponse.json({ success: false, message: 'Order must contain at least one item' }, { status: 400 });
    }

    const paymentGateway = body.paymentGateway || body.paymentMethod || 'Cash';
    const shippingCost = Number(body.shippingCost !== undefined ? body.shippingCost : (body.courierFee !== undefined ? body.courierFee : 350));
    const customerDetails = body.customerDetails || {
      name: body.customerName || 'Walk-in Customer',
      phone: body.customerPhone || '',
      address: body.shippingAddress || body.customerAddress || '',
    };

    let totalNetProfit = 0;
    let totalBasePrice = 0;
    let totalPaymentFee = 0;
    const processedItems: any[] = [];
    const orderId = String(body.orderId || body.id || body.invoiceNumber || `INV-${Math.floor(1000 + Math.random() * 9000)}`);

    let savedToMongo = false;
    const mongoConn = await connectToMongoDB();

    if (mongoConn) {
      const db = mongoConn.db;

      for (const item of items) {
        const searchId = String(item.sku || item.skuCode || item.barcode || item.code || item.id || '').trim();
        const qtyToBuy = Number(item.qty || item.quantity || 1);

        // 1. Flexible Product Lookup in Database
        let isObjectId = false;
        try {
          isObjectId = ObjectId.isValid(searchId) && searchId.length === 24;
        } catch {
          isObjectId = false;
        }

        const orQuery: any[] = [
          { sku: searchId },
          { skuCode: searchId },
          { barcode: searchId },
          { code: searchId },
          { _id: searchId },
        ];
        if (isObjectId) {
          orQuery.unshift({ _id: new ObjectId(searchId) });
        }
        if (item.name) {
          orQuery.push({ name: item.name });
        }

        const product = await db.collection<any>('products').findOne({
          $or: orQuery,
        });

        if (!product) {
          return NextResponse.json({
            success: false,
            message: `Inventory Not Found for SKU: ${searchId || item.name || 'Unknown'}`,
          }, { status: 400 });
        }

        // 2. Base Item Price & Gateway Fee Percentage
        const unitPrice = Number(item.sellingPrice || item.unitPrice || item.price || product.sellingPrice || 0);
        const costPrice = Number(product.costPrice || item.costPrice || 0);

        // Platform / Gateway Fee Percentage (Payzy, Koko, Mintpay => 12%, Card => 3%, Cash => 0%)
        let feePercentage = 0;
        const gwLower = String(paymentGateway).toLowerCase();
        if (
          ['Payzy BNPL', 'Koko', 'Mintpay'].includes(paymentGateway) ||
          gwLower.includes('payzy') ||
          gwLower.includes('koko') ||
          gwLower.includes('mintpay') ||
          gwLower.includes('bnpl')
        ) {
          feePercentage = 0.12;
        } else if (
          paymentGateway === 'Card / Online Bank Gateway' ||
          paymentGateway === 'Card' ||
          gwLower.includes('card') ||
          gwLower.includes('bank')
        ) {
          feePercentage = 0.03;
        }

        // 3. Customer Surcharge: Payment Fee is added to item total
        const baseItemTotal = unitPrice * qtyToBuy;
        const paymentFeeAmount = Math.round(baseItemTotal * feePercentage);
        totalPaymentFee += paymentFeeAmount;
        totalBasePrice += baseItemTotal;

        // 4. Net Profit: Customer pays the gateway fee surcharge, so Net Profit is:
        // Base Selling Price - Cost Price (COGS)
        const itemProfit = unitPrice - costPrice;
        totalNetProfit += itemProfit * qtyToBuy;

        // 5. Atomic Store Stock Decrement
        await db.collection('products').updateOne(
          { _id: product._id },
          {
            $inc: {
              storeStock: -qtyToBuy,
              stockQuantity: -qtyToBuy,
            },
            $unset: { warehouseStock: '', stockWarehouse: '', stockStore: '' },
          }
        );

        processedItems.push({
          ...item,
          name: item.name || product.name,
          sku: product.sku || searchId,
          barcode: product.barcode || item.barcode,
          costPrice,
          unitPrice,
          sellingPrice: unitPrice,
          paymentFee: paymentFeeAmount,
          profit: itemProfit,
          quantity: qtyToBuy,
          qty: qtyToBuy,
          isRegistered: costPrice > 0,
        });
      }

      // 6. Save Order with 'Completed' Status
      const finalGrossTotal = body.grossTotal || (totalBasePrice + totalPaymentFee + Number(shippingCost || 0));

      const newOrder = {
        ...body,
        id: orderId,
        orderId,
        invoiceNumber: orderId,
        items: processedItems,
        paymentGateway,
        paymentMethod: paymentGateway,
        shippingCost: Number(shippingCost || 0),
        courierFee: Number(shippingCost || 0),
        customerDetails,
        customerName: customerDetails?.name || body.customerName || 'Walk-in Customer',
        customerPhone: customerDetails?.phone || body.customerPhone || '',
        shippingAddress: customerDetails?.address || body.shippingAddress || '',
        baseItemPrice: totalBasePrice,
        paymentFee: totalPaymentFee,
        grossTotal: finalGrossTotal,
        costOfGoods: processedItems.reduce((acc, it) => acc + (it.costPrice * (it.quantity || 1)), 0),
        netProfit: Math.round(totalNetProfit),
        status: 'Completed', // Direct Completed status
        profitStatus: 'Calculated',
        hasUnregisteredItems: processedItems.some((it) => it.costPrice <= 0),
        unregisteredItemsCount: processedItems.filter((it) => it.costPrice <= 0).length,
        channel: body.channel || 'POS',
        createdAt: body.createdAt ? new Date(body.createdAt) : new Date(),
        updatedAt: new Date().toISOString(),
      };

      await db.collection('orders').updateOne(
        { $or: [{ orderId: newOrder.orderId }, { id: newOrder.id }, { invoiceNumber: newOrder.invoiceNumber }] },
        { $set: newOrder },
        { upsert: true }
      );

      saveServerOrder(newOrder as any);
      savedToMongo = true;

      return NextResponse.json({
        success: true,
        message: 'Order completed, stock deducted, and profit calculated successfully!',
        orderId: newOrder.orderId,
        order: newOrder,
        savedToMongo,
      });
    }

    // Local / ServerStore Fallback if MongoDB is offline
    totalNetProfit = 0;
    totalBasePrice = 0;
    totalPaymentFee = 0;
    processedItems.length = 0;

    for (const item of items) {
      const searchId = String(item.sku || item.skuCode || item.barcode || item.code || item.id || '').trim().toLowerCase();
      const qtyToBuy = Number(item.qty || item.quantity || 1);

      const product = SAMPLE_PRODUCTS.find(
        (p) =>
          p.sku.toLowerCase() === searchId ||
          (p.barcode && p.barcode.toLowerCase() === searchId) ||
          p.id.toLowerCase() === searchId ||
          (item.name && p.name.toLowerCase() === item.name.toLowerCase())
      );

      const unitPrice = Number(item.sellingPrice || item.unitPrice || item.price || product?.sellingPrice || 0);
      const costPrice = Number(product?.costPrice || item.costPrice || 0);

      let feePercentage = 0;
      const gwLower = String(paymentGateway).toLowerCase();
      if (
        ['Payzy BNPL', 'Koko', 'Mintpay'].includes(paymentGateway) ||
        gwLower.includes('payzy') ||
        gwLower.includes('koko') ||
        gwLower.includes('mintpay') ||
        gwLower.includes('bnpl')
      ) {
        feePercentage = 0.12;
      } else if (
        paymentGateway === 'Card / Online Bank Gateway' ||
        paymentGateway === 'Card' ||
        gwLower.includes('card') ||
        gwLower.includes('bank')
      ) {
        feePercentage = 0.03;
      }

      // Customer Surcharge: Payment Fee is added to item total
      const baseItemTotal = unitPrice * qtyToBuy;
      const paymentFeeAmount = Math.round(baseItemTotal * feePercentage);
      totalPaymentFee += paymentFeeAmount;
      totalBasePrice += baseItemTotal;

      // Net profit = Base Selling Price - Cost Price (COGS)
      const itemProfit = unitPrice - costPrice;
      totalNetProfit += itemProfit * qtyToBuy;

      if (product) {
        product.storeStock = Math.max(0, (product.storeStock ?? product.stockQuantity ?? 0) - qtyToBuy);
        product.stockQuantity = product.storeStock;
      }

      processedItems.push({
        ...item,
        name: item.name || product?.name || searchId,
        sku: product?.sku || searchId,
        barcode: product?.barcode || item.barcode,
        costPrice,
        unitPrice,
        sellingPrice: unitPrice,
        paymentFee: paymentFeeAmount,
        profit: itemProfit,
        quantity: qtyToBuy,
        qty: qtyToBuy,
        isRegistered: costPrice > 0,
      });
    }

    const finalGrossTotal = body.grossTotal || (totalBasePrice + totalPaymentFee + Number(shippingCost || 0));

    const fallbackOrder = {
      ...body,
      id: orderId,
      orderId,
      invoiceNumber: orderId,
      items: processedItems,
      paymentGateway,
      paymentMethod: paymentGateway,
      shippingCost: Number(shippingCost || 0),
      courierFee: Number(shippingCost || 0),
      customerDetails,
      customerName: customerDetails?.name || body.customerName || 'Walk-in Customer',
      customerPhone: customerDetails?.phone || body.customerPhone || '',
      shippingAddress: customerDetails?.address || body.shippingAddress || '',
      baseItemPrice: totalBasePrice,
      paymentFee: totalPaymentFee,
      grossTotal: finalGrossTotal,
      costOfGoods: processedItems.reduce((acc, it) => acc + (it.costPrice * (it.quantity || 1)), 0),
      netProfit: Math.round(totalNetProfit),
      status: 'Completed',
      profitStatus: 'Calculated',
      channel: body.channel || 'POS',
      createdAt: body.createdAt ? new Date(body.createdAt) : new Date(),
      updatedAt: new Date().toISOString(),
    };

    saveServerOrder(fallbackOrder as any);

    return NextResponse.json({
      success: true,
      message: 'Order completed, stock deducted, and profit calculated successfully!',
      orderId: fallbackOrder.orderId,
      order: fallbackOrder,
      savedToMongo: false,
    });
  } catch (error: any) {
    console.error('Checkout Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, updates } = body;
    if (!id || !updates) {
      return NextResponse.json({ success: false, error: 'id and updates are required' }, { status: 400 });
    }

    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        await mongoConn.db.collection('orders').updateOne(
          { id },
          { $set: { ...updates, updatedAt: new Date().toISOString() } }
        );
      }
    } catch (err: any) {
      console.warn('[Orders API PUT] MongoDB update error:', err.message);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        await mongoConn.db.collection('orders').deleteOne({
          $or: [{ id }, { invoiceNumber: id }],
        });
      }
    } catch (err: any) {
      console.warn('[Orders API DELETE] MongoDB delete error:', err.message);
    }

    deleteServerOrder(id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
