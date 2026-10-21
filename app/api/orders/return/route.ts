import { NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getServerStore, saveServerOrder } from '@/lib/serverStore';
import { SAMPLE_PRODUCTS } from '@/lib/sampleProducts';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const orderId = body.orderId || body.id;

    if (!orderId) {
      return NextResponse.json(
        { success: false, message: 'Order ID is required' },
        { status: 400 }
      );
    }

    const cleanOrderId = String(orderId).trim();
    const numId = Number(cleanOrderId);
    const returnedSkus: string[] = Array.isArray(body.returnedSkus) && body.returnedSkus.length > 0
      ? body.returnedSkus
      : [];

    const mongoConn = await connectToMongoDB();

    if (mongoConn) {
      const db = mongoConn.db;

      // 1. අදාළ Order එක හෝ Invoice එක හොයාගැනීම (ObjectId, string _id, orderId, id, හෝ invoiceNumber මගින්)
      const orConditions: any[] = [
        { orderId: cleanOrderId },
        { id: cleanOrderId },
        { invoiceNumber: cleanOrderId },
        { _id: cleanOrderId },
      ];

      if (!isNaN(numId) && numId > 0) {
        orConditions.push(
          { orderId: numId },
          { id: numId },
          { wooOrderId: numId },
          { wcOrderId: numId }
        );
      }

      if (ObjectId.isValid(cleanOrderId) && cleanOrderId.length === 24) {
        try {
          orConditions.unshift({ _id: new ObjectId(cleanOrderId) });
        } catch {
          // Safe fallback if not valid BSON ObjectId
        }
      }

      let order = await db.collection('orders').findOne({
        $or: orConditions,
      });

      if (!order) {
        // Fallback regex match for cases where SKU/invoice/order suffix was provided
        const safeEscaped = cleanOrderId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        order = await db.collection('orders').findOne({
          $or: [
            { invoiceNumber: { $regex: safeEscaped, $options: 'i' } },
            { id: { $regex: safeEscaped, $options: 'i' } },
          ],
        });
      }

      if (!order) {
        return NextResponse.json(
          { success: false, message: `Order not found with identifier: ${cleanOrderId}` },
          { status: 404 }
        );
      }

      if (order.status === 'Returned') {
        return NextResponse.json(
          { success: false, message: 'Order is already marked as returned' },
          { status: 400 }
        );
      }

      const itemsToProcess = order.items && Array.isArray(order.items) && order.items.length > 0
        ? order.items
        : [order];

      // 2. Order එකේ තියෙන Items එක් එක් Product එකේ storeStock එකට ආපසු එකතු කිරීම
      for (const item of itemsToProcess) {
        const sku = item.sku || item.skuCode || item.code || item.barcode;
        if (!sku) continue;

        // If specific returnedSkus were provided, only restore those
        if (returnedSkus.length > 0 && !returnedSkus.includes(sku) && !returnedSkus.includes(item.skuCode)) {
          continue;
        }

        const qty = Number(item.qty || item.quantity || 1) || 1;

        // Product එකේ storeStock එක වැඩි කිරීම සහ backlog adjust කිරීම
        await db.collection('products').updateOne(
          {
            $or: [
              { sku: sku },
              { skuCode: sku },
              { barcode: sku },
              { code: sku },
              { itemCode: sku },
            ],
          },
          {
            $inc: { storeStock: qty, stockQuantity: qty },
            $unset: { warehouseStock: '', stockWarehouse: '', stockStore: '' },
          }
        );
      }

      // 3. Order Status එක 'Returned' ලෙස update කිරීම සහ Profit එක 0 හෝ Negative කර හැරීම
      const updatedItems = Array.isArray(order.items)
        ? order.items.map((it: any) => ({
            ...it,
            returned: returnedSkus.length === 0 || returnedSkus.includes(it.sku) || returnedSkus.includes(it.skuCode),
            returnedQty: it.quantity || it.qty || 1,
          }))
        : order.items;

      const updatedOrderDoc = {
        ...order,
        status: 'Returned',
        netProfit: 0, // Return වූ පසු ලාභය ඉවත් වේ
        returnedAt: new Date(),
        returnReason: body.reason || 'Customer requested return & refund',
        items: updatedItems,
        updatedAt: new Date().toISOString(),
      };

      await db.collection('orders').updateOne(
        { _id: order._id },
        {
          $set: {
            status: 'Returned',
            netProfit: 0,
            returnedAt: new Date(),
            returnReason: body.reason || 'Customer requested return & refund',
            items: updatedItems,
            updatedAt: new Date().toISOString(),
          },
        }
      );

      saveServerOrder(updatedOrderDoc as any);

      return NextResponse.json({
        success: true,
        message: 'Item successfully returned, added back to store stock, and profit reversed!',
        orderId: order._id || cleanOrderId,
      });
    }

    // ServerStore Fallback if MongoDB is offline
    const store = getServerStore();
    const orderIndex = store.orders.findIndex(
      (o: any) =>
        o.id === cleanOrderId ||
        o.orderId === cleanOrderId ||
        o.invoiceNumber === cleanOrderId ||
        (o.wooOrderId && String(o.wooOrderId) === cleanOrderId)
    );

    if (orderIndex === -1) {
      return NextResponse.json(
        { success: false, message: `Order not found with identifier: ${cleanOrderId}` },
        { status: 404 }
      );
    }

    const localOrder = store.orders[orderIndex];
    if (localOrder.status === 'Returned') {
      return NextResponse.json(
        { success: false, message: 'Order is already marked as returned' },
        { status: 400 }
      );
    }

    // Restore store stock in local store
    for (const rawItem of (localOrder.items || [])) {
      const item = rawItem as any;
      const sku = String(item.sku || item.skuCode || item.code || item.barcode || '').toLowerCase();
      if (!sku) continue;
      if (returnedSkus.length > 0 && !returnedSkus.includes(item.sku) && !returnedSkus.includes(item.skuCode)) {
        continue;
      }
      const qty = Number(item.qty || item.quantity || 1) || 1;
      const prod = SAMPLE_PRODUCTS.find(
        (p) =>
          p.sku.toLowerCase() === sku ||
          (p.barcode && p.barcode.toLowerCase() === sku) ||
          p.id.toLowerCase() === sku
      );
      if (prod) {
        prod.storeStock = (prod.storeStock ?? prod.stockQuantity ?? 0) + qty;
        prod.stockQuantity = prod.storeStock;
      }
    }

    localOrder.status = 'Returned';
    localOrder.netProfit = 0;
    localOrder.returnedAt = new Date().toISOString();
    localOrder.returnReason = body.reason || 'Customer requested return & refund';
    localOrder.updatedAt = new Date().toISOString();
    saveServerOrder(localOrder);

    return NextResponse.json({
      success: true,
      message: 'Item successfully returned, added back to store stock, and profit reversed!',
      orderId: localOrder.id || cleanOrderId,
    });
  } catch (error: any) {
    console.error('Return Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      message: error.message || 'Return processing failed',
    }, { status: 500 });
  }
}
