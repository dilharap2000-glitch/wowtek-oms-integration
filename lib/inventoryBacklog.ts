import { Order, Product, ProductAlias } from '@/types';
import { connectToMongoDB } from '@/lib/mongodb';
import { findBestProductMatch, DEFAULT_PRODUCT_ALIASES } from '@/lib/productMatching';
import { broadcastLiveUpdate, getServerStore, saveServerOrder } from '@/lib/serverStore';

export interface BacklogResolutionResult {
  success: boolean;
  product: Product;
  resolvedOrders: Order[];
  totalUnitsDeducted: number;
  message: string;
}

/**
 * AUTO-DEDUCTION ENGINE FOR PENDING/BACKLOG INVOICES ON RESTOCK
 *
 * Whenever a user adds stock (GRN Inward Receipt) or updates product inventory:
 * 1. Checks if there are any pending/backlog orders waiting for this specific SKU / product.
 * 2. Automatically deducts the required stock from the newly added inventory for those pending orders.
 * 3. Automatically clears "Inventory Not Found" warning on those invoices, calculates accurate COGS
 *    and Net Operating Profit based on the cost price, and moves them to fully processed/active status.
 * 4. Ensures real-time UI updates on Sales & Analytics dashboard.
 */
export async function resolvePendingBacklogOrders(
  product: Product,
  options?: {
    aliases?: ProductAlias[];
    mongoClient?: any;
    allOrders?: Order[];
  }
): Promise<BacklogResolutionResult> {
  if (!product || !product.sku) {
    return {
      success: false,
      product,
      resolvedOrders: [],
      totalUnitsDeducted: 0,
      message: 'Invalid product provided for backlog resolution',
    };
  }

  let mongoConn = options?.mongoClient;
  if (!mongoConn) {
    try {
      mongoConn = await connectToMongoDB();
    } catch {
      // Offline fallback
    }
  }

  // Load aliases if not provided
  let aliases = options?.aliases;
  if (!aliases || aliases.length === 0) {
    if (mongoConn) {
      try {
        const aliasDocs = await mongoConn.db.collection('product_aliases').find({}).toArray();
        aliases = aliasDocs.map(({ _id, ...rest }: any) => rest as ProductAlias);
      } catch {}
    }
  }
  if (!aliases || aliases.length === 0) {
    aliases = DEFAULT_PRODUCT_ALIASES;
  }

  // Fetch candidate pending / backlog orders
  let pendingOrders: Order[] = [];
  if (mongoConn) {
    try {
      const docs = await mongoConn.db
        .collection('orders')
        .find({
          $or: [
            { hasUnregisteredItems: true },
            { profitStatus: 'Pending / Inventory Not Found' },
            { status: 'Pending' },
          ],
        })
        .toArray();
      pendingOrders = docs.map(({ _id, ...rest }: any) => rest as Order);
    } catch (e) {
      console.warn('[Backlog] Mongo query error:', e);
    }
  }

  // Also include candidate orders from serverStore
  const store = getServerStore();
  if (store && Array.isArray(store.orders)) {
    const storePending = store.orders.filter(
      (o) =>
        o.hasUnregisteredItems === true ||
        o.profitStatus === 'Pending / Inventory Not Found' ||
        o.status === 'Pending'
    );
    for (const sOrder of storePending) {
      if (!pendingOrders.some((p) => p.id === sOrder.id || p.invoiceNumber === sOrder.invoiceNumber)) {
        pendingOrders.push(sOrder);
      }
    }
  }

  if (Array.isArray(options?.allOrders)) {
    const optPending = options.allOrders.filter(
      (o) =>
        o.hasUnregisteredItems === true ||
        o.profitStatus === 'Pending / Inventory Not Found' ||
        o.status === 'Pending'
    );
    for (const optOrder of optPending) {
      if (!pendingOrders.some((p) => p.id === optOrder.id || p.invoiceNumber === optOrder.invoiceNumber)) {
        pendingOrders.push(optOrder);
      }
    }
  }

  if (pendingOrders.length === 0) {
    return {
      success: true,
      product,
      resolvedOrders: [],
      totalUnitsDeducted: 0,
      message: `No pending backlog orders waiting for SKU ${product.sku}.`,
    };
  }

  let currentStoreStock = typeof product.stockStore === 'number' ? product.stockStore : 0;
  let currentWarehouseStock = typeof product.stockWarehouse === 'number' ? product.stockWarehouse : 0;
  let totalDeductedUnits = 0;
  const resolvedOrders: Order[] = [];

  for (const order of pendingOrders) {
    // Check if this order contains items matching this restocked product
    if (!Array.isArray(order.items) || order.items.length === 0) continue;

    let orderModified = false;

    for (const item of order.items) {
      // Skip already registered item if it already has valid costPrice
      if (item.isRegistered && item.costPrice > 0) continue;

      const match = findBestProductMatch(
        {
          externalName: item.name,
          externalSku: item.sku,
          externalBarcode: item.barcode,
          channel: order.channel,
        },
        [product],
        aliases
      );

      const isMatch =
        match.matchedProduct !== null ||
        (item.sku && item.sku.toUpperCase() === product.sku.toUpperCase()) ||
        (item.name && item.name.toLowerCase().trim() === product.name.toLowerCase().trim());

      if (isMatch) {
        const requiredQty = item.quantity || 1;
        const totalAvailableStock = currentStoreStock + currentWarehouseStock;

        if (totalAvailableStock >= requiredQty) {
          // Deduct from stockStore first, then stockWarehouse
          if (currentStoreStock >= requiredQty) {
            currentStoreStock -= requiredQty;
          } else {
            const remainder = requiredQty - currentStoreStock;
            currentStoreStock = 0;
            currentWarehouseStock = Math.max(0, currentWarehouseStock - remainder);
          }

          totalDeductedUnits += requiredQty;

          // Update line item with verified SKU & Cost Price
          item.sku = product.sku;
          item.barcode = product.barcode || item.barcode;
          item.costPrice = product.costPrice || 0;
          item.isRegistered = true;
          orderModified = true;
        }
      }
    }

    if (orderModified) {
      // Re-evaluate entire order status
      const hasRemainingUnregistered = order.items.some((i) => !i.isRegistered || i.costPrice <= 0);

      const verifiedCogs = order.items.reduce(
        (sum, i) => sum + (i.costPrice || 0) * (i.quantity || 1),
        0
      );
      const verifiedGross = order.grossTotal || order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      const platformFee = order.platformFeeAmount || 0;
      const gatewayFee = order.gatewayFeeAmount || 0;
      const courierFee = order.courierFee || 0;

      order.costOfGoods = verifiedCogs;

      if (!hasRemainingUnregistered) {
        order.hasUnregisteredItems = false;
        order.unregisteredItemsCount = 0;
        order.profitStatus = 'Calculated';
        order.netProfit = Math.max(0, verifiedGross - verifiedCogs - platformFee - gatewayFee - courierFee);

        // Move to fully processed/active status
        if (order.status === 'Pending') {
          order.status = 'Processing';
        }

        const autoLog = `[Auto-Restocked] Stock auto-deducted from GRN for ${product.name} (SKU: ${product.sku}). Real Net Profit verified: Rs. ${order.netProfit.toLocaleString()}.`;
        order.notes = [order.notes, autoLog].filter(Boolean).join(' | ');
      } else {
        const unregCount = order.items.filter((i) => !i.isRegistered || i.costPrice <= 0).length;
        order.hasUnregisteredItems = true;
        order.unregisteredItemsCount = unregCount;
        order.profitStatus = 'Pending / Inventory Not Found';
        order.netProfit = 0;
      }

      order.updatedAt = new Date().toISOString();
      resolvedOrders.push(order);

      // Persist order update to in-memory server store
      saveServerOrder(order);

      // Persist order update to MongoDB
      if (mongoConn) {
        try {
          await mongoConn.db.collection('orders').updateOne(
            { $or: [{ id: order.id }, { invoiceNumber: order.invoiceNumber }] },
            {
              $set: {
                items: order.items,
                costOfGoods: order.costOfGoods,
                netProfit: order.netProfit,
                profitStatus: order.profitStatus,
                hasUnregisteredItems: order.hasUnregisteredItems,
                unregisteredItemsCount: order.unregisteredItemsCount,
                status: order.status,
                notes: order.notes,
                updatedAt: order.updatedAt,
              },
            }
          );
        } catch (e) {
          console.warn('[Backlog] Mongo order update error:', e);
        }
      }

      // Broadcast real-time update
      try {
        broadcastLiveUpdate({
          type: 'order_saved',
          order,
          timestamp: order.updatedAt,
        });
      } catch {}
    }
  }

  // Update product stock with deducted amounts
  const updatedProduct: Product = {
    ...product,
    stockStore: currentStoreStock,
    stockWarehouse: currentWarehouseStock,
  };

  if (mongoConn && totalDeductedUnits > 0) {
    try {
      await mongoConn.db.collection('products').updateOne(
        { sku: product.sku },
        {
          $set: {
            stockStore: currentStoreStock,
            stockWarehouse: currentWarehouseStock,
          },
        }
      );
    } catch (e) {
      console.warn('[Backlog] Mongo product stock update error:', e);
    }
  }

  const message =
    resolvedOrders.length > 0
      ? `Auto-deducted ${totalDeductedUnits} unit(s) across ${resolvedOrders.length} pending backlog order(s) for SKU ${product.sku}. Moved to active with verified profits!`
      : `Restock saved for ${product.sku}. No pending backlog orders waiting.`;

  return {
    success: true,
    product: updatedProduct,
    resolvedOrders,
    totalUnitsDeducted: totalDeductedUnits,
    message,
  };
}
