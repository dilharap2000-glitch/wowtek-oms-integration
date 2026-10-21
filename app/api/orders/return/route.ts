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

    // 1. අදාළ Order එක හෝ Invoice එක හොයාගැනීම (ObjectId, string _id, orderId, id, හෝ invoiceNumber මගින්)
    const orConditions: any[] = [
      { orderId: String(orderId) },
      { id: String(orderId) },
      { invoiceNumber: String(orderId) },
      { _id: String(orderId) },
    ];

    if (ObjectId.isValid(String(orderId)) && String(orderId).length === 24) {
      try {
        orConditions.unshift({ _id: new ObjectId(String(orderId)) });
      } catch {
        // Safe fallback if not valid BSON ObjectId
      }
    }

    const order = await db.collection('orders').findOne({
      $or: orConditions,
    });

    if (!order) {
      return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
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
