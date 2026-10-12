import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { getServerStore, saveServerOrder, deleteServerOrder } from '@/lib/serverStore';
import { Order, Product, ProductAlias } from '@/types';
import { findBestProductMatch, DEFAULT_PRODUCT_ALIASES } from '@/lib/productMatching';

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
        let hasUnregistered = false;
        let unregCount = 0;
        let verifiedCogs = 0;

        const [prodDocs, aliasDocs] = await Promise.all([
          mongoConn.db.collection('products').find({}).toArray().catch(() => []),
          mongoConn.db.collection('product_aliases').find({}).toArray().catch(() => []),
        ]);

        const catalog: Product[] = prodDocs.map(({ _id, ...rest }: any) => rest as Product);
        const aliases: ProductAlias[] = [
          ...DEFAULT_PRODUCT_ALIASES,
          ...aliasDocs.map(({ _id, ...rest }: any) => rest as ProductAlias),
        ];

        if (Array.isArray(order.items)) {
          for (const item of order.items) {
            const matchRes = findBestProductMatch(
              {
                externalName: item.name,
                externalSku: item.sku,
                externalBarcode: item.barcode,
                channel: order.channel,
              },
              catalog,
              aliases
            );

            const matchedProduct = matchRes.matchedProduct;
            const availableStock = matchedProduct
              ? (matchedProduct.stockStore || 0) + (matchedProduct.stockWarehouse || 0)
              : 0;

            if (matchedProduct && availableStock >= (item.quantity || 1)) {
              // Deduct stock from stockStore first, then stockWarehouse
              const reqQty = item.quantity || 1;
              let deductStore = 0;
              let deductWarehouse = 0;

              if ((matchedProduct.stockStore || 0) >= reqQty) {
                deductStore = reqQty;
                matchedProduct.stockStore -= reqQty;
              } else {
                deductStore = matchedProduct.stockStore || 0;
                deductWarehouse = reqQty - deductStore;
                matchedProduct.stockStore = 0;
                matchedProduct.stockWarehouse = Math.max(0, (matchedProduct.stockWarehouse || 0) - deductWarehouse);
              }

              await mongoConn.db.collection('products').updateOne(
                { sku: matchedProduct.sku },
                {
                  $inc: {
                    stockStore: -deductStore,
                    stockWarehouse: -deductWarehouse,
                  },
                }
              );

              const realCost =
                typeof matchedProduct.costPrice === 'number' && matchedProduct.costPrice > 0
                  ? matchedProduct.costPrice
                  : 0;

              item.sku = matchedProduct.sku;
              item.barcode = matchedProduct.barcode || item.barcode;
              item.costPrice = realCost;
              item.isRegistered = realCost > 0;
              verifiedCogs += realCost * reqQty;

              if (realCost <= 0) {
                hasUnregistered = true;
                unregCount++;
              }
            } else {
              // Item is missing or out of stock! Keep in backlog queue
              hasUnregistered = true;
              unregCount++;
              item.costPrice = 0;
              item.isRegistered = false;
              if (matchedProduct) {
                item.sku = matchedProduct.sku;
              }
              console.warn(
                `[Orders API POST] Backlog queued: ${item.sku || 'UNREGISTERED'} ("${item.name}") is out of stock (available: ${availableStock}). Awaiting GRN restock.`
              );
            }
          }
        }

        // Set verified financial state
        order.costOfGoods = verifiedCogs;
        if (hasUnregistered) {
          order.hasUnregisteredItems = true;
          order.unregisteredItemsCount = unregCount;
          order.profitStatus = 'Pending / Inventory Not Found';
          order.netProfit = 0; // Prevent fake profit display
          if (!order.status || order.status === 'Processing' || order.status === 'Completed') {
            order.status = 'Pending';
          }
          const backlogNote = '[Backlog Queue] Awaiting inward GRN restock for out-of-stock items.';
          if (!order.notes?.includes('[Backlog Queue]')) {
            order.notes = [order.notes, backlogNote].filter(Boolean).join(' | ');
          }
        } else {
          order.hasUnregisteredItems = false;
          order.unregisteredItemsCount = 0;
          order.profitStatus = 'Calculated';
          const totalFees = (order.platformFeeAmount || 0) + (order.gatewayFeeAmount || 0) + (order.courierFee || 0);
          order.netProfit = Math.max(0, order.grossTotal - verifiedCogs - totalFees);
        }

        await mongoConn.db.collection('orders').updateOne(
          { $or: [{ id: order.id }, { invoiceNumber: order.invoiceNumber }] },
          { $set: order },
          { upsert: true }
        );

        savedToMongo = true;
      } else {
        // Fallback store handling if Mongo is offline
        const hasUnregistered = !order.items || order.items.some((it) => !it.costPrice || it.costPrice <= 0);
        if (hasUnregistered) {
          order.hasUnregisteredItems = true;
          order.profitStatus = 'Pending / Inventory Not Found';
          order.netProfit = 0;
        }
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
