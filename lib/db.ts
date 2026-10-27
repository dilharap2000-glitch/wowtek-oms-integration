import {
  Order,
  Product,
  ProductAlias,
  StoreMapping,
  TransExpressWaybill,
  WarrantyRecord,
  ExpenseItem,
  ApiIntegrationConfig,
  DatabaseHealthStatus,
  PlatformConfig,
  PaymentGatewayConfig,
  Supplier,
  SupplierRmaClaim,
  WebhookEvent,
} from '@/types';
import { findBestProductMatch, DEFAULT_PRODUCT_ALIASES } from '@/lib/productMatching';
import { DEFAULT_STORE_MAPPINGS } from '@/lib/storeMappings';

// ---------------------------------------------------------------------------
// Default Configurations for Dynamic Platform & Payment Gateway Fees
// ---------------------------------------------------------------------------
export const DEFAULT_PLATFORMS: PlatformConfig[] = [
  { id: 'plt-pickme', name: 'PickMe Market / Food', code: 'pickme', feePercent: 20, isCustom: false, active: true },
  { id: 'plt-uber', name: 'Uber Eats Retail', code: 'ubereats', feePercent: 15.4, isCustom: false, active: true },
  { id: 'plt-woo', name: 'WooCommerce Website', code: 'woocommerce', feePercent: 0, isCustom: false, active: true },
  { id: 'plt-pos', name: 'In-Store POS Retail', code: 'pos', feePercent: 0, isCustom: false, active: true },
];

export const DEFAULT_GATEWAYS: PaymentGatewayConfig[] = [
  { id: 'gw-cash', name: 'Cash on Delivery (COD) / Cash', code: 'cash_cod', feePercent: 0, isCustom: false, active: true },
  { id: 'gw-credit', name: 'Credit Customer (Pay Later)', code: 'credit', feePercent: 0, isCustom: false, active: true },
  { id: 'gw-payzy', name: 'Payzy BNPL / Pay', code: 'payzy', feePercent: 12, isCustom: false, active: true },
  { id: 'gw-koko', name: 'Koko Pay (3x Installments)', code: 'koko', feePercent: 12, isCustom: false, active: true },
  { id: 'gw-mintpay', name: 'Mintpay (Pay in 3)', code: 'mintpay', feePercent: 12, isCustom: false, active: true },
  { id: 'gw-card', name: 'Card / Online Bank Gateway', code: 'card_online', feePercent: 3, isCustom: false, active: true },
];

export const DEFAULT_SUPPLIERS: Supplier[] = [];

export const DEFAULT_RMA_CLAIMS: SupplierRmaClaim[] = [];

const INITIAL_API_CONFIG: ApiIntegrationConfig = {
  woocommerceUrl: 'https://store.wowtek.lk',
  woocommerceConsumerKey: 'ck_7f99148d9a20078b671a5c68dfb9101',
  woocommerceConsumerSecret: 'cs_8819024fba99165b4c107e3240a1b9',
  woocommerceWebhookSecret: 'whsec_99182a4c90',
  pickmeMerchantId: 'MERCH-PKM-COL-4491',
  pickmeApiKey: 'pkm_live_9a87d091fb726c11a',
  pickmeBranchId: 'BR-BAMBALAPITIYA-01',
  uberEatsStoreId: 'eats-store-srilanka-0914',
  uberEatsClientSecret: 'ubr_sec_9941a87b003',
  transExpressAccountId: 'TX-ACCT-SL-9082',
  transExpressApiKey: 'tx_live_e9914bca88172c',
  transExpressPickupBranch: 'Colombo Main Sorting Facility (Borella)',
  smsGatewayProvider: 'SMSlenz',
  smsUserId: '588',
  smsApiKey: 'smslenz_live_token_77192',
  smsSenderId: 'WOWTEK',
  smsAutoNotifyWarranty: true,
  smsAutoNotifyOrder: true,
  smsExpiryReminderDays: 30,
};

export const DEFAULT_WEBHOOK_EVENTS: WebhookEvent[] = [];

interface MockDatabaseState {
  orders: Order[];
  products: Product[];
  waybills: TransExpressWaybill[];
  warranties: WarrantyRecord[];
  expenses: ExpenseItem[];
  apiConfig: ApiIntegrationConfig;
  platforms: PlatformConfig[];
  gateways: PaymentGatewayConfig[];
  suppliers: Supplier[];
  rmaClaims: SupplierRmaClaim[];
  webhookEvents: WebhookEvent[];
  aliases: ProductAlias[];
  stores: StoreMapping[];
}

const STORAGE_KEY = 'wowtek_pos_v2_store';

export function initMockDb(): MockDatabaseState {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          orders: Array.isArray(parsed.orders) ? parsed.orders : [],
          products: Array.isArray(parsed.products) ? parsed.products : [],
          waybills: Array.isArray(parsed.waybills) ? parsed.waybills : [],
          warranties: Array.isArray(parsed.warranties) ? parsed.warranties : [],
          expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
          apiConfig: parsed.apiConfig ? { ...INITIAL_API_CONFIG, ...parsed.apiConfig } : { ...INITIAL_API_CONFIG },
          platforms: Array.isArray(parsed.platforms) ? parsed.platforms : [...DEFAULT_PLATFORMS],
          gateways: Array.isArray(parsed.gateways) ? parsed.gateways : [...DEFAULT_GATEWAYS],
          suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : [],
          rmaClaims: Array.isArray(parsed.rmaClaims) ? parsed.rmaClaims : [],
          webhookEvents: Array.isArray(parsed.webhookEvents) ? parsed.webhookEvents : [],
          aliases: Array.isArray(parsed.aliases) ? parsed.aliases : [...DEFAULT_PRODUCT_ALIASES],
          stores: Array.isArray(parsed.stores) ? parsed.stores : [...DEFAULT_STORE_MAPPINGS],
        };
      }
    } catch {}
  }

  const g = globalThis as any;
  if (!g._wowtekMockDb) {
    g._wowtekMockDb = {
      orders: [],
      products: [],
      waybills: [],
      warranties: [],
      expenses: [],
      apiConfig: { ...INITIAL_API_CONFIG },
      platforms: [...DEFAULT_PLATFORMS],
      gateways: [...DEFAULT_GATEWAYS],
      suppliers: [],
      rmaClaims: [],
      webhookEvents: [],
      aliases: [...DEFAULT_PRODUCT_ALIASES],
      stores: [...DEFAULT_STORE_MAPPINGS],
    };
  }
  return g._wowtekMockDb;
}

function persistMockDb() {
  if (typeof window !== 'undefined' && window.localStorage && (globalThis as any)._wowtekMockDb) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify((globalThis as any)._wowtekMockDb));
    } catch {}
  }
}

// ---------------------------------------------------------------------------
// Health check: Fetches from server-only /api/health/database route
// ---------------------------------------------------------------------------
export async function checkDatabaseHealth(): Promise<DatabaseHealthStatus> {
  const startTime = Date.now();
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/health/database', { cache: 'no-store' });
      if (res.ok) {
        return await res.json();
      }
    } catch {}
  }

  const mockDb = initMockDb();
  return {
    status: 'fallback',
    latencyMs: Math.max(1, Date.now() - startTime),
    database: 'Mock DB Fallback (Offline)',
    message: 'Operating in safe fallback mode.',
    timestamp: new Date().toISOString(),
    recordCounts: {
      orders: mockDb.orders.length,
      products: mockDb.products.length,
      waybills: mockDb.waybills.length,
      warranties: mockDb.warranties.length,
      expenses: mockDb.expenses.length,
      suppliers: mockDb.suppliers?.length || 0,
      rmaClaims: mockDb.rmaClaims?.length || 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Platforms & Payment Gateways
// ---------------------------------------------------------------------------
export async function getPlatforms(): Promise<PlatformConfig[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/settings', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.platforms) && data.platforms.length > 0) {
          const mock = initMockDb();
          mock.platforms = data.platforms;
          persistMockDb();
          return data.platforms;
        }
      }
    } catch {}
  }
  return initMockDb().platforms;
}

export async function savePlatforms(platforms: PlatformConfig[]): Promise<PlatformConfig[]> {
  const mock = initMockDb();
  mock.platforms = platforms;
  persistMockDb();

  if (typeof window !== 'undefined') {
    try {
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms }),
      }).catch(() => {});
    } catch {}
  }
  return platforms;
}

export async function getPaymentGateways(): Promise<PaymentGatewayConfig[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/settings', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.gateways) && data.gateways.length > 0) {
          const mock = initMockDb();
          mock.gateways = data.gateways;
          persistMockDb();
          return data.gateways;
        }
      }
    } catch {}
  }
  return initMockDb().gateways;
}

export async function savePaymentGateways(gateways: PaymentGatewayConfig[]): Promise<PaymentGatewayConfig[]> {
  const mock = initMockDb();
  mock.gateways = gateways;
  persistMockDb();

  if (typeof window !== 'undefined') {
    try {
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateways }),
      }).catch(() => {});
    } catch {}
  }
  return gateways;
}

// ---------------------------------------------------------------------------
// Orders CRUD (Direct to /api/orders)
// ---------------------------------------------------------------------------
export async function getOrders(): Promise<Order[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/orders', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.orders)) {
          const mock = initMockDb();
          mock.orders = data.orders;
          persistMockDb();
          return data.orders;
        }
      }
    } catch {}
  }
  return initMockDb().orders;
}

export async function saveOrder(order: Order): Promise<Order> {
  const mock = initMockDb();

  // STRICT INVENTORY VALIDATION & COST CHECK:
  // Validate items against product catalog
  let hasUnregistered = false;
  let unregCount = 0;
  let verifiedCogs = 0;

  if (Array.isArray(order.items)) {
    order.items.forEach((item) => {
      // SMART PRODUCT NAME & SKU MATCHING:
      // Priority 1: SKU Linking, Priority 2: Barcode, Priority 3: Alias Mapping, Priority 4: Exact Title, Priority 5: Keyword & Fuzzy Matching
      const matchRes = findBestProductMatch(
        {
          externalName: item.name,
          externalSku: item.sku,
          externalBarcode: item.barcode,
          channel: order.channel,
        },
        mock.products,
        mock.aliases
      );

      const prod = matchRes.matchedProduct;
      const availableStock = prod ? (prod.stockStore || 0) + (prod.stockWarehouse || 0) : 0;

      if (prod && availableStock >= item.quantity) {
        // Lock specific serial as Sold if product is serialized
        if (Array.isArray(prod.activeSerials)) {
          const reqSerial = (item.serialNumber || '').trim().toLowerCase();
          const targetUnit = reqSerial
            ? prod.activeSerials.find((u: any) => ((typeof u === 'string' ? u : u.serialNumber) || '').toLowerCase() === reqSerial)
            : prod.activeSerials.find((u: any) => typeof u === 'object' && (u.status === 'Available' || u.status === 'In-Stock'));

          if (targetUnit && typeof targetUnit === 'object') {
            targetUnit.status = 'Sold';
            targetUnit.orderId = order.id;
            targetUnit.invoiceNumber = order.invoiceNumber;
            targetUnit.soldAt = new Date().toISOString();
            targetUnit.customerName = order.customerName;
            targetUnit.customerPhone = order.customerPhone;
            item.serialNumber = targetUnit.serialNumber;
          }
        }
        if (Array.isArray(prod.serialNumbers) && item.serialNumber) {
          prod.serialNumbers = prod.serialNumbers.filter(
            (s) => s.toLowerCase() !== item.serialNumber!.toLowerCase()
          );
        }

        // Deduct stock only when product actually exists and has sufficient stock
        if (prod.stockStore >= item.quantity) {
          prod.stockStore -= item.quantity;
        } else {
          const remaining = item.quantity - prod.stockStore;
          prod.stockStore = 0;
          prod.stockWarehouse = Math.max(0, prod.stockWarehouse - remaining);
        }

        const realCost =
          typeof prod.costPrice === 'number' && prod.costPrice > 0
            ? prod.costPrice
            : (typeof item.costPrice === 'number' && item.costPrice > 0 ? item.costPrice : 0);

        item.sku = prod.sku;
        item.barcode = prod.barcode || item.barcode;
        item.costPrice = realCost;
        item.isRegistered = realCost > 0;
        verifiedCogs += realCost * item.quantity;

        if (realCost <= 0) {
          hasUnregistered = true;
          unregCount++;
        }
      } else {
        // Item missing from inventory or OUT OF STOCK: do NOT deduct stock and queue in backlog!
        hasUnregistered = true;
        unregCount++;
        item.costPrice = 0;
        item.isRegistered = false;
        if (prod) {
          item.sku = prod.sku;
        }
      }
    });
  }

  order.costOfGoods = verifiedCogs;
  if (hasUnregistered) {
    order.hasUnregisteredItems = true;
    order.unregisteredItemsCount = unregCount;
    order.profitStatus = 'Pending / Inventory Not Found';
    order.netProfit = 0; // Prevent fake profit display
    if (!order.status || order.status === 'Processing' || order.status === 'Completed') {
      order.status = 'Pending';
    }
  } else {
    order.hasUnregisteredItems = false;
    order.unregisteredItemsCount = 0;
    const courierFee = typeof order.courierFee === 'number' && order.courierFee > 0 ? order.courierFee : (order.shippingCost || 350);
    const totalFees = (order.platformFeeAmount || 0) + (order.gatewayFeeAmount || 0) + courierFee;
    order.netProfit = Math.max(0, Math.round(order.grossTotal - verifiedCogs - totalFees));
  }

  const existingIdx = mock.orders.findIndex(
    (o) => o.id === order.id || o.invoiceNumber === order.invoiceNumber
  );
  if (existingIdx !== -1) {
    mock.orders[existingIdx] = {
      ...mock.orders[existingIdx],
      ...order,
      updatedAt: new Date().toISOString(),
    };
  } else {
    mock.orders.unshift(order);
  }

  persistMockDb();

  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });
    } catch {}
  }
  return order;
}

export async function updateOrder(id: string, updates: Partial<Order>): Promise<Order | null> {
  const mock = initMockDb();
  const index = mock.orders.findIndex((o: Order) => o.id === id);
  if (index !== -1) {
    mock.orders[index] = { ...mock.orders[index], ...updates, updatedAt: new Date().toISOString() };
    persistMockDb();
  }

  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, updates }),
      });
    } catch {}
  }
  return index !== -1 ? mock.orders[index] : null;
}

export async function deleteOrder(id: string): Promise<boolean> {
  const mock = initMockDb();
  const initialLength = mock.orders.length;
  mock.orders = mock.orders.filter((o: Order) => o.id !== id);
  persistMockDb();

  if (typeof window !== 'undefined') {
    try {
      await fetch(`/api/orders?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {}
  }
  return mock.orders.length < initialLength;
}

export async function processOrderReturn(
  orderId: string,
  returnedSkus: string[],
  reason: string
): Promise<{ success: boolean; order?: Order; restoredItems: string[] }> {
  const mock = initMockDb();
  const order = mock.orders.find((o) => o.id === orderId);
  if (!order) return { success: false, restoredItems: [] };

  const restoredItems: string[] = [];

  order.items.forEach((item) => {
    if (returnedSkus.includes(item.sku) && !item.returned) {
      item.returned = true;
      item.returnedQty = item.quantity;
      restoredItems.push(`${item.name} (${item.quantity} qty)`);

      const prod = mock.products.find(
        (p) => p.sku === item.sku || p.skuCode === item.sku || p.barcode === item.sku
      );
      if (prod) {
        prod.storeStock = Number(prod.storeStock ?? prod.stockQuantity ?? 0) + item.quantity;
        prod.stockQuantity = prod.storeStock;
        delete (prod as any).stockStore;
        delete (prod as any).warehouseStock;
      }
    }
  });

  const allItemsReturned = order.items.every((it) => it.returned);
  order.status = allItemsReturned ? 'Returned' : 'Partially Returned';
  order.returnedAt = new Date().toISOString();
  order.returnReason = reason || 'Customer requested return & refund';
  order.updatedAt = new Date().toISOString();

  if (allItemsReturned) {
    order.netProfit = 0;
  }
  persistMockDb();

  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/orders/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, returnedSkus, reason }),
      });
    } catch {}
  }

  return { success: true, order, restoredItems };
}

// ---------------------------------------------------------------------------
// Product Inventory (Direct to /api/products)
// ---------------------------------------------------------------------------

function resolveMockBacklog(product: Product, mock: MockDatabaseState): Order[] {
  let storeStock = Number(product.storeStock ?? product.stockStore ?? product.stockQuantity ?? 0);
  const resolved: Order[] = [];

  mock.orders.forEach((order) => {
    if (
      !order.hasUnregisteredItems &&
      order.profitStatus !== 'Pending / Inventory Not Found' &&
      order.status !== 'Pending'
    ) {
      return;
    }

    let modified = false;
    if (Array.isArray(order.items)) {
      order.items.forEach((item) => {
        if (item.isRegistered && item.costPrice > 0) return;

        const matchRes = findBestProductMatch(
          {
            externalName: item.name,
            externalSku: item.sku,
            externalBarcode: item.barcode,
            channel: order.channel,
          },
          [product],
          mock.aliases
        );

        if (matchRes.matchedProduct || (item.sku && item.sku.toUpperCase() === product.sku.toUpperCase())) {
          const reqQty = item.quantity || 1;
          if (storeStock >= reqQty) {
            storeStock -= reqQty;
            item.sku = product.sku;
            item.barcode = product.barcode || item.barcode;
            item.costPrice = product.costPrice || 0;
            item.isRegistered = true;
            modified = true;
          }
        }
      });
    }

    if (modified) {
      const allRegistered = order.items.every((it) => it.isRegistered && it.costPrice > 0);
      const verifiedCogs = order.items.reduce((s, it) => s + (it.costPrice || 0) * (it.quantity || 1), 0);
      order.costOfGoods = verifiedCogs;

      if (allRegistered) {
        order.hasUnregisteredItems = false;
        order.unregisteredItemsCount = 0;
        order.profitStatus = 'Calculated';
        const fees = (order.platformFeeAmount || 0) + (order.gatewayFeeAmount || 0) + (order.courierFee || 0);
        order.netProfit = Math.max(0, order.grossTotal - verifiedCogs - fees);
        if (order.status === 'Pending') {
          order.status = 'Processing';
        }
        order.notes = [
          order.notes,
          `[Auto-Restocked] Stock auto-deducted for ${product.name} (SKU: ${product.sku}). Real Net Profit verified: Rs. ${order.netProfit.toLocaleString()}.`,
        ]
          .filter(Boolean)
          .join(' | ');
      } else {
        const unregCount = order.items.filter((it) => !it.isRegistered || it.costPrice <= 0).length;
        order.hasUnregisteredItems = true;
        order.unregisteredItemsCount = unregCount;
        order.profitStatus = 'Pending / Inventory Not Found';
        order.netProfit = 0;
      }
      order.updatedAt = new Date().toISOString();
      resolved.push(order);
    }
  });

  product.storeStock = storeStock;
  product.stockStore = storeStock;
  product.stockWarehouse = 0;
  return resolved;
}

export async function getProducts(): Promise<Product[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/products', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.products)) {
          const mock = initMockDb();
          mock.products = data.products;
          persistMockDb();
          return data.products;
        }
      }
    } catch {}
  }
  return initMockDb().products;
}

export async function saveProduct(product: Product): Promise<Product> {
  const mock = initMockDb();
  const existingIdx = mock.products.findIndex((p) => p.sku === product.sku);
  if (existingIdx !== -1) {
    mock.products[existingIdx] = product;
  } else {
    mock.products.unshift(product);
  }

  // AUTO-DEDUCTION FOR PENDING/BACKLOG INVOICES ON NEW GRN / RESTOCK
  if ((product.stockStore > 0 || product.stockWarehouse > 0) && product.costPrice > 0) {
    resolveMockBacklog(product, mock);
  }

  persistMockDb();

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.product) return data.product;
      }
    } catch {}
  }
  return product;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product | null> {
  const mock = initMockDb();
  const index = mock.products.findIndex((p) => p.id === id || p.sku === id);
  if (index !== -1) {
    mock.products[index] = { ...mock.products[index], ...updates };
    if ((mock.products[index].stockStore > 0 || mock.products[index].stockWarehouse > 0) && mock.products[index].costPrice > 0) {
      resolveMockBacklog(mock.products[index], mock);
    }
    persistMockDb();
  }

  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, updates }),
      });
    } catch {}
  }
  return index !== -1 ? mock.products[index] : null;
}

export async function deleteProduct(id: string): Promise<boolean> {
  const mock = initMockDb();
  const prevLen = mock.products.length;
  mock.products = mock.products.filter((p) => p.id !== id && p.sku !== id);
  persistMockDb();

  if (typeof window !== 'undefined') {
    try {
      await fetch(`/api/products?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {}
  }
  return mock.products.length < prevLen;
}

export async function restockProduct(
  sku: string,
  addedStore: number,
  addedWarehouse: number,
  costPrice?: number,
  grnBatch?: string,
  supplier?: string,
  productId?: string
): Promise<{ success: boolean; product?: Product; resolvedOrders?: Order[]; message?: string }> {
  const mock = initMockDb();
  const clean = String(sku || '').trim().toLowerCase();
  const cleanId = String(productId || '').trim();

  let prod = mock.products.find(
    (p) =>
      (cleanId && p.id === cleanId) ||
      (p.sku && p.sku.trim().toLowerCase() === clean) ||
      (p.skuCode && p.skuCode.trim().toLowerCase() === clean) ||
      (p.barcode && p.barcode.trim().toLowerCase() === clean) ||
      (p.id && p.id.trim().toLowerCase() === clean) ||
      String(p.sku) === String(sku) ||
      String(p.skuCode) === String(sku) ||
      String(p.barcode) === String(sku)
  );

  const storeIncrement = Number(addedStore || 0);
  let resolvedOrders: Order[] = [];

  if (prod) {
    prod.storeStock = (prod.storeStock ?? prod.stockStore ?? prod.stockQuantity ?? 0) + storeIncrement;
    prod.stockStore = prod.storeStock;
    prod.stockQuantity = prod.storeStock;
    prod.stockWarehouse = 0;
    if (typeof costPrice === 'number' && costPrice > 0) {
      prod.costPrice = costPrice;
    }
    if (grnBatch) prod.grnBatch = grnBatch;
    if (supplier) prod.supplier = supplier;

    resolvedOrders = resolveMockBacklog(prod, mock);
    persistMockDb();
  }

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/grn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: prod?.id || cleanId || undefined,
          productId: prod?.id || cleanId || undefined,
          sku: prod?.sku || sku,
          skuCode: prod?.skuCode || prod?.sku || sku,
          productTitle: prod?.name || prod?.title,
          barcode: prod?.barcode,
          restockQty: storeIncrement,
          addedStore: storeIncrement,
          costPrice,
          batchRef: grnBatch,
          supplier,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.product) {
          const idx = mock.products.findIndex((p) => p.sku === data.product.sku || p.id === data.product.id);
          if (idx !== -1) {
            const preservedName = mock.products[idx].name || mock.products[idx].title;
            mock.products[idx] = {
              ...mock.products[idx],
              ...data.product,
              name: preservedName || data.product.name,
              title: preservedName || data.product.title,
            };
          } else {
            mock.products.unshift(data.product);
          }
          persistMockDb();
        }
        return {
          success: true,
          product: data.product || prod,
          resolvedOrders: data.resolvedOrders,
          message: data.message,
        };
      } else if (!prod) {
        return {
          success: false,
          message: data.message || `Product ${sku} not found in database`,
        };
      }
    } catch (e: any) {
      if (!prod) {
        return { success: false, message: e.message || `Failed to connect to restock API` };
      }
    }
  }

  if (!prod) {
    return { success: false, message: `Product ${sku} not found` };
  }

  return {
    success: true,
    product: prod,
    resolvedOrders,
    message: `Restocked ${sku}. ${resolvedOrders.length} backlog order(s) auto-deducted and resolved!`,
  };
}

// ---------------------------------------------------------------------------
// Product Alias & Channel SKU Mappings (Direct to /api/aliases)
// ---------------------------------------------------------------------------
export async function getProductAliases(): Promise<ProductAlias[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/aliases', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.aliases)) {
          const mock = initMockDb();
          mock.aliases = data.aliases;
          persistMockDb();
          return data.aliases;
        }
      }
    } catch {}
  }
  return initMockDb().aliases;
}

export async function saveProductAlias(alias: ProductAlias): Promise<ProductAlias> {
  const mock = initMockDb();
  const existingIdx = mock.aliases.findIndex(
    (a) =>
      a.id === alias.id ||
      (a.externalTitle.toLowerCase() === alias.externalTitle.toLowerCase() && a.channel === alias.channel)
  );
  if (existingIdx !== -1) {
    mock.aliases[existingIdx] = alias;
  } else {
    mock.aliases.unshift(alias);
  }
  persistMockDb();

  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alias),
      });
    } catch {}
  }
  return alias;
}

export async function deleteProductAlias(id: string): Promise<boolean> {
  const mock = initMockDb();
  const prevLen = mock.aliases.length;
  mock.aliases = mock.aliases.filter((a) => a.id !== id);
  persistMockDb();

  if (typeof window !== 'undefined') {
    try {
      await fetch(`/api/aliases?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {}
  }
  return mock.aliases.length < prevLen;
}

// ---------------------------------------------------------------------------
// Multi-Store Branch Mappings for Uber Eats & PickMe (Direct to /api/stores)
// ---------------------------------------------------------------------------
export async function getStoreMappings(): Promise<StoreMapping[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/stores', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.stores) && data.stores.length > 0) {
          const mock = initMockDb();
          mock.stores = data.stores;
          persistMockDb();
          return data.stores;
        }
      }
    } catch {}
  }
  return initMockDb().stores;
}

export async function saveStoreMapping(store: StoreMapping): Promise<StoreMapping> {
  const mock = initMockDb();
  const existingIdx = mock.stores.findIndex(
    (s) =>
      s.id === store.id ||
      (s.externalStoreId.toLowerCase() === store.externalStoreId.toLowerCase() && s.platform === store.platform)
  );
  if (existingIdx !== -1) {
    mock.stores[existingIdx] = { ...mock.stores[existingIdx], ...store, updatedAt: new Date().toISOString() };
  } else {
    mock.stores.unshift(store);
  }
  persistMockDb();

  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(store),
      });
    } catch {}
  }
  return store;
}

export async function deleteStoreMapping(id: string): Promise<boolean> {
  const mock = initMockDb();
  const prevLen = mock.stores.length;
  mock.stores = mock.stores.filter((s) => s.id !== id);
  persistMockDb();

  if (typeof window !== 'undefined') {
    try {
      await fetch(`/api/stores?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {}
  }
  return mock.stores.length < prevLen;
}

// ---------------------------------------------------------------------------
// Waybills (Direct to /api/waybills)
// ---------------------------------------------------------------------------
export async function getWaybills(): Promise<TransExpressWaybill[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/waybills', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.waybills)) {
          const mock = initMockDb();
          mock.waybills = data.waybills;
          persistMockDb();
          return data.waybills;
        }
      }
    } catch {}
  }
  return initMockDb().waybills;
}

export async function saveWaybill(waybill: TransExpressWaybill): Promise<TransExpressWaybill> {
  const mock = initMockDb();
  const existingIdx = mock.waybills.findIndex(
    (w: TransExpressWaybill) => w.id === waybill.id || w.trackingNumber === waybill.trackingNumber
  );
  if (existingIdx !== -1) {
    mock.waybills[existingIdx] = { ...mock.waybills[existingIdx], ...waybill };
  } else {
    mock.waybills.unshift(waybill);
  }
  persistMockDb();

  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/waybills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(waybill),
      });
    } catch {}
  }
  return waybill;
}

export async function updateWaybill(id: string, updates: Partial<TransExpressWaybill>): Promise<TransExpressWaybill | null> {
  const mock = initMockDb();
  const index = mock.waybills.findIndex((w: TransExpressWaybill) => w.id === id);
  if (index !== -1) {
    mock.waybills[index] = { ...mock.waybills[index], ...updates };
    persistMockDb();
  }

  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/waybills', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, updates }),
      });
    } catch {}
  }
  return index !== -1 ? mock.waybills[index] : null;
}

export async function deleteWaybill(id: string): Promise<boolean> {
  const mock = initMockDb();
  const initialLength = mock.waybills.length;
  mock.waybills = mock.waybills.filter((w: TransExpressWaybill) => w.id !== id && w.trackingNumber !== id);
  persistMockDb();

  if (typeof window !== 'undefined') {
    try {
      await fetch(`/api/waybills?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {}
  }
  return mock.waybills.length < initialLength;
}

// ---------------------------------------------------------------------------
// Warranties (Direct to /api/warranties)
// ---------------------------------------------------------------------------
export async function getWarranties(): Promise<WarrantyRecord[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/warranties', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.warranties)) {
          const mock = initMockDb();
          mock.warranties = data.warranties;
          persistMockDb();
          return data.warranties;
        }
      }
    } catch {}
  }
  return initMockDb().warranties;
}

export async function saveWarranty(warranty: WarrantyRecord): Promise<WarrantyRecord> {
  const mock = initMockDb();
  mock.warranties.unshift(warranty);
  persistMockDb();

  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/warranties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(warranty),
      });
    } catch {}
  }
  return warranty;
}

export async function updateWarranty(id: string, updates: Partial<WarrantyRecord>): Promise<WarrantyRecord | null> {
  const mock = initMockDb();
  const index = mock.warranties.findIndex((w: WarrantyRecord) => w.id === id);
  if (index !== -1) {
    mock.warranties[index] = { ...mock.warranties[index], ...updates };
    persistMockDb();
  }

  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/warranties', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, updates }),
      });
    } catch {}
  }
  return index !== -1 ? mock.warranties[index] : null;
}

export async function deleteWarranty(id: string): Promise<boolean> {
  const mock = initMockDb();
  const initialLength = mock.warranties.length;
  mock.warranties = mock.warranties.filter((w) => w.id !== id);
  persistMockDb();

  if (typeof window !== 'undefined') {
    try {
      await fetch(`/api/warranties?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {}
  }
  return mock.warranties.length < initialLength;
}

// ---------------------------------------------------------------------------
// Expenses (Direct to /api/expenses)
// ---------------------------------------------------------------------------
export async function getExpenses(): Promise<ExpenseItem[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/expenses', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.expenses)) {
          const mock = initMockDb();
          mock.expenses = data.expenses;
          persistMockDb();
          return data.expenses;
        }
      }
    } catch {}
  }
  return initMockDb().expenses;
}

export async function saveExpense(expense: ExpenseItem): Promise<ExpenseItem> {
  const mock = initMockDb();
  mock.expenses.unshift(expense);
  persistMockDb();

  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expense),
      });
    } catch {}
  }
  return expense;
}

export async function deleteExpense(id: string): Promise<boolean> {
  const mock = initMockDb();
  const initialLength = mock.expenses.length;
  mock.expenses = mock.expenses.filter((e) => e.id !== id);
  persistMockDb();

  if (typeof window !== 'undefined') {
    try {
      await fetch(`/api/expenses?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {}
  }
  return mock.expenses.length < initialLength;
}

// ---------------------------------------------------------------------------
// API Integrations Config
// ---------------------------------------------------------------------------
export async function getApiConfig(): Promise<ApiIntegrationConfig> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/settings', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.apiConfig) {
          const mock = initMockDb();
          mock.apiConfig = { ...INITIAL_API_CONFIG, ...data.apiConfig };
          persistMockDb();
          return mock.apiConfig;
        }
      }
    } catch {}
  }
  return initMockDb().apiConfig;
}

export async function saveApiConfig(config: ApiIntegrationConfig): Promise<ApiIntegrationConfig> {
  const mock = initMockDb();
  mock.apiConfig = { ...config };
  persistMockDb();

  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiConfig: config }),
      });
    } catch {}
  }
  return config;
}

// ---------------------------------------------------------------------------
// Suppliers (Direct to /api/suppliers)
// ---------------------------------------------------------------------------
export async function getSuppliers(): Promise<Supplier[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/suppliers', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.suppliers)) {
          const mock = initMockDb();
          mock.suppliers = data.suppliers;
          persistMockDb();
          return data.suppliers;
        }
      }
    } catch {}
  }
  return initMockDb().suppliers;
}

export async function saveSupplier(supplier: Supplier): Promise<Supplier> {
  const mock = initMockDb();
  mock.suppliers.unshift(supplier);
  persistMockDb();

  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplier),
      });
    } catch {}
  }
  return supplier;
}

export async function updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier | null> {
  const mock = initMockDb();
  const index = mock.suppliers.findIndex((s: Supplier) => s.id === id);
  if (index !== -1) {
    mock.suppliers[index] = { ...mock.suppliers[index], ...updates };
    persistMockDb();
  }

  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/suppliers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, updates }),
      });
    } catch {}
  }
  return index !== -1 ? mock.suppliers[index] : null;
}

export async function deleteSupplier(id: string): Promise<boolean> {
  const mock = initMockDb();
  const initialLength = mock.suppliers.length;
  mock.suppliers = mock.suppliers.filter((s) => s.id !== id);
  persistMockDb();

  if (typeof window !== 'undefined') {
    try {
      await fetch(`/api/suppliers?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {}
  }
  return mock.suppliers.length < initialLength;
}

// ---------------------------------------------------------------------------
// Supplier RMA Claims (Direct to /api/rma)
// ---------------------------------------------------------------------------
export async function getSupplierRmaClaims(): Promise<SupplierRmaClaim[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/rma', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.rmaClaims)) {
          const mock = initMockDb();
          mock.rmaClaims = data.rmaClaims;
          persistMockDb();
          return data.rmaClaims;
        }
      }
    } catch {}
  }
  return initMockDb().rmaClaims;
}

export async function saveSupplierRmaClaim(claim: SupplierRmaClaim): Promise<SupplierRmaClaim> {
  const mock = initMockDb();
  mock.rmaClaims.unshift(claim);
  persistMockDb();

  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/rma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(claim),
      });
    } catch {}
  }
  return claim;
}

export async function updateSupplierRmaClaim(
  id: string,
  updates: Partial<SupplierRmaClaim>
): Promise<{ claim: SupplierRmaClaim | null; replacedProduct?: Product }> {
  const mock = initMockDb();
  const index = mock.rmaClaims.findIndex((r: SupplierRmaClaim) => r.id === id);
  let updatedClaim: SupplierRmaClaim | null = null;
  let syncedProduct: Product | undefined = undefined;

  if (index !== -1) {
    mock.rmaClaims[index] = { ...mock.rmaClaims[index], ...updates, updatedAt: new Date().toISOString() };
    updatedClaim = mock.rmaClaims[index];

    // AUTOMATED REPLACEMENT INVENTORY SYNC IN LOCAL MOCK DB
    if (updatedClaim.status === 'Replaced' && updatedClaim.replacementSerial) {
      const repSerial = updatedClaim.replacementSerial.trim();
      const targetSku = updatedClaim.productSku;
      const targetName = updatedClaim.productName;

      let prod = mock.products.find(
        (p) =>
          (targetSku && p.sku && p.sku.toLowerCase() === targetSku.toLowerCase()) ||
          (targetName && p.name && p.name.toLowerCase() === targetName.toLowerCase())
      );

      if (prod) {
        const curStore = Number(prod.storeStock ?? prod.stockStore ?? prod.stockQuantity ?? 0);
        prod.storeStock = curStore + 1;
        prod.stockStore = curStore + 1;
        prod.stockQuantity = curStore + 1;
        prod.stockWarehouse = 0;

        const activeSerials = Array.isArray(prod.activeSerials) ? [...prod.activeSerials] : [];
        if (!activeSerials.some((s: any) => (typeof s === 'string' ? s : s.serialNumber).toLowerCase() === repSerial.toLowerCase())) {
          activeSerials.push({
            serialNumber: repSerial,
            status: 'Available',
            addedAt: new Date().toISOString(),
            rmaRef: updatedClaim.rmaNumber,
            supplier: updatedClaim.supplierName,
            source: 'Supplier RMA Replacement',
            originalDefectiveSerial: updatedClaim.serialNumber,
          });
        }
        prod.activeSerials = activeSerials;

        const serialNums = Array.isArray(prod.serialNumbers) ? [...prod.serialNumbers] : [];
        if (!serialNums.some((s: string) => s.toLowerCase() === repSerial.toLowerCase())) {
          serialNums.push(repSerial);
        }
        prod.serialNumbers = serialNums;
        prod.lastRestockedAt = new Date().toISOString();
        prod.lastBatchRef = updatedClaim.rmaNumber;
        syncedProduct = prod;
      } else {
        const newProd: Product = {
          id: `prod-rma-${Date.now().toString().slice(-4)}`,
          sku: targetSku || `WT-RMA-${Date.now().toString().slice(-4)}`,
          name: targetName || 'Warranty Replacement Item',
          barcode: repSerial,
          category: 'Warranty Replacement',
          costPrice: 0,
          sellingPrice: 0,
          storeStock: 1,
          stockStore: 1,
          stockQuantity: 1,
          stockWarehouse: 0,
          supplier: updatedClaim.supplierName || 'Supplier RMA',
          grnBatch: `RMA-${updatedClaim.rmaNumber || 'REPL'}`,
          activeSerials: [
            {
              serialNumber: repSerial,
              status: 'Available',
              addedAt: new Date().toISOString(),
              rmaRef: updatedClaim.rmaNumber,
              supplier: updatedClaim.supplierName,
              source: 'Supplier RMA Replacement',
              originalDefectiveSerial: updatedClaim.serialNumber,
            },
          ],
          serialNumbers: [repSerial],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        mock.products.unshift(newProd);
        syncedProduct = newProd;
      }
    }
    persistMockDb();
  }

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/rma', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, updates }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.replacedProduct) {
          syncedProduct = data.replacedProduct;
          const pIdx = mock.products.findIndex((p) => p.sku === data.replacedProduct.sku || p.id === data.replacedProduct.id);
          if (pIdx !== -1) {
            mock.products[pIdx] = data.replacedProduct;
          } else {
            mock.products.unshift(data.replacedProduct);
          }
          persistMockDb();
        }
      }
    } catch {}
  }
  return { claim: updatedClaim, replacedProduct: syncedProduct };
}

export async function deleteSupplierRmaClaim(id: string): Promise<boolean> {
  const mock = initMockDb();
  const initialLength = mock.rmaClaims.length;
  mock.rmaClaims = mock.rmaClaims.filter((r) => r.id !== id);
  persistMockDb();

  if (typeof window !== 'undefined') {
    try {
      await fetch(`/api/rma?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {}
  }
  return mock.rmaClaims.length < initialLength;
}

// ---------------------------------------------------------------------------
// Incoming Webhook Events & Transaction Audit Log (Direct to /api/webhooks/events)
// ---------------------------------------------------------------------------
export async function getWebhookEvents(): Promise<WebhookEvent[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/webhooks/events', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.events)) {
          const mock = initMockDb();
          mock.webhookEvents = data.events;
          persistMockDb();
          return data.events;
        }
      }
    } catch {}
  }
  return initMockDb().webhookEvents;
}

export async function saveWebhookEvent(event: WebhookEvent): Promise<WebhookEvent> {
  const mock = initMockDb();
  const existingIdx = mock.webhookEvents.findIndex((e) => e.id === event.id);
  if (existingIdx !== -1) {
    mock.webhookEvents[existingIdx] = event;
  } else {
    mock.webhookEvents.unshift(event);
    if (mock.webhookEvents.length > 50) {
      mock.webhookEvents = mock.webhookEvents.slice(0, 50);
    }
  }
  persistMockDb();
  return event;
}

export async function clearWebhookEvents(): Promise<boolean> {
  if (typeof window !== 'undefined') {
    try {
      fetch('/api/webhooks/events', { method: 'DELETE' }).catch(() => {});
    } catch {}
  }
  const mock = initMockDb();
  mock.webhookEvents = [];
  persistMockDb();
  return true;
}

export async function recordCreditPayment(
  orderId: string,
  amount: number,
  paymentMethod: string = 'Cash',
  notes: string = '',
  receiptNumber: string = '',
  recordedBy: string = 'POS Cashier'
): Promise<{ success: boolean; order?: Order; error?: string }> {
  try {
    const res = await fetch('/api/orders/credit-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        amount,
        paymentMethod,
        notes,
        receiptNumber,
        recordedBy,
      }),
    });
    const data = await res.json();
    if (data.success && data.order) {
      const mock = initMockDb();
      const index = mock.orders.findIndex((o: Order) => o.id === orderId || o.invoiceNumber === orderId);
      if (index !== -1) {
        mock.orders[index] = data.order;
        persistMockDb();
      }
      return { success: true, order: data.order };
    }
    return { success: false, error: data.error || 'Failed to record payment' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateProductSerialStatus(
  skuOrId: string,
  serialNumber: string,
  newStatus: string,
  reason?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const mock = initMockDb();
  const prod = mock.products.find((p) => p.sku === skuOrId || p.id === skuOrId);
  let changed = false;

  if (prod && Array.isArray(prod.activeSerials)) {
    const unit = prod.activeSerials.find(
      (s: any) => ((typeof s === 'string' ? s : s.serialNumber) || '').toLowerCase() === serialNumber.trim().toLowerCase()
    );
    if (unit && typeof unit === 'object') {
      const prevStatus = unit.status;
      unit.status = newStatus;
      if (newStatus === 'Missing') {
        unit.discrepancyReason = reason || 'Reported missing during inventory audit';
        unit.reportedMissingAt = new Date().toISOString();
        if (prevStatus === 'Available' || prevStatus === 'In-Stock') {
          prod.stockStore = Math.max(0, (prod.stockStore || prod.storeStock || 1) - 1);
          prod.storeStock = prod.stockStore;
          prod.stockQuantity = prod.stockStore;
        }
      } else if (newStatus === 'Available' || newStatus === 'In-Stock') {
        unit.discrepancyReason = undefined;
        unit.reportedMissingAt = undefined;
        if (prevStatus === 'Missing') {
          prod.stockStore = (prod.stockStore || prod.storeStock || 0) + 1;
          prod.storeStock = prod.stockStore;
          prod.stockQuantity = prod.stockStore;
        }
      }
      persistMockDb();
      changed = true;
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/inventory/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: skuOrId, serialNumber, newStatus, reason }),
      });
      const data = await res.json();
      if (data.success) {
        return { success: true, message: data.message };
      }
    } catch {}
  }

  return { success: changed, message: `Serial ${serialNumber} status set to ${newStatus}` };
}

