import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

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

    const { db } = await connectToDatabase();

    const cleanOrderId = String(orderId).trim();
    const numId = Number(cleanOrderId);

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

    const returnedSkus: string[] = Array.isArray(body.returnedSkus) && body.returnedSkus.length > 0
      ? body.returnedSkus
      : [];

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

    await db.collection('orders').updateOne(
      { _id: order._id },
      {
        $set: {
          status: 'Returned',
          netProfit: 0, // Return වූ පසු ලාභය ඉවත් වේ
          returnedAt: new Date(),
          returnReason: body.reason || 'Customer requested return & refund',
          items: updatedItems,
          updatedAt: new Date().toISOString(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Item successfully returned, added back to store stock, and profit reversed!',
      orderId: order._id,
    });
  } catch (error: any) {
    console.error('Return Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
