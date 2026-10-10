import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { getServerStore, saveServerOrder, deleteServerOrder } from '@/lib/serverStore';
import { Order } from '@/types';

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
        const orderDoc = await mongoConn.db.collection('orders').findOne({ id: orderId });
        if (orderDoc) {
          const { _id, ...orderData } = orderDoc;
          const order = orderData as unknown as Order;
          const restoredItems: string[] = [];

          order.items.forEach((item: any) => {
            if (returnedSkus.includes(item.sku) && !item.returned) {
              item.returned = true;
              item.returnedQty = item.quantity;
              restoredItems.push(`${item.name} (${item.quantity} qty)`);
            }
          });

          const allItemsReturned = order.items.every((it: any) => it.returned);
          order.status = allItemsReturned ? 'Returned' : 'Partially Returned';
          order.returnedAt = new Date().toISOString();
          order.returnReason = reason || 'Customer requested return';
          order.updatedAt = new Date().toISOString();

          if (allItemsReturned) {
            order.netProfit = 0;
          }

          // Restore inventory stock in MongoDB Atlas
          for (const sku of returnedSkus) {
            const matchedItem = order.items.find((i: any) => i.sku === sku);
            if (matchedItem) {
              await mongoConn.db.collection('products').updateOne(
                { sku },
                { $inc: { stockStore: matchedItem.quantity } }
              );
            }
          }

          await mongoConn.db.collection('orders').updateOne(
            { id: orderId },
            { $set: order }
          );

          saveServerOrder(order);

          return NextResponse.json({ success: true, order, restoredItems });
        }
      }
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const order: Order = body;
    if (!order || !order.id) {
      return NextResponse.json({ success: false, error: 'Invalid order payload' }, { status: 400 });
    }

    let savedToMongo = false;
    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        await mongoConn.db.collection('orders').updateOne(
          { $or: [{ id: order.id }, { invoiceNumber: order.invoiceNumber }] },
          { $set: order },
          { upsert: true }
        );

        // Deduct inventory stock directly in MongoDB Atlas
        if (Array.isArray(order.items)) {
          for (const item of order.items) {
            await mongoConn.db.collection('products').updateOne(
              { sku: item.sku },
              { $inc: { stockStore: -item.quantity } }
            );
          }
        }

        savedToMongo = true;
      }
    } catch (err: any) {
      console.warn('[Orders API POST] MongoDB write error:', err.message);
    }

    saveServerOrder(order);

    return NextResponse.json({ success: true, order, savedToMongo });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
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
