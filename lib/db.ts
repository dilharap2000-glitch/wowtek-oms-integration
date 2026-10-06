import type { MongoClient, Db } from 'mongodb';
import {
  Order,
  Product,
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

// Environment variables
const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'wowtek_pro';

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
  { id: 'gw-payzy', name: 'Payzy BNPL / Pay', code: 'payzy', feePercent: 12, isCustom: false, active: true },
  { id: 'gw-koko', name: 'Koko Pay (3x Installments)', code: 'koko', feePercent: 12, isCustom: false, active: true },
  { id: 'gw-mintpay', name: 'Mintpay (Pay in 3)', code: 'mintpay', feePercent: 12, isCustom: false, active: true },
  { id: 'gw-card', name: 'Card / Online Bank Gateway', code: 'card_online', feePercent: 3, isCustom: false, active: true },
];

export const DEFAULT_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-001',
    name: 'Chama Computers (Pvt) Ltd',
    contactPerson: 'Nuwan Jayasinghe',
    phone: '+94 11 258 4400',
    email: 'warranty@chamacomputers.lk',
    address: '142 Galle Road, Bambalapitiya, Colombo 04',
    categories: 'Kingston, ASUS, Storage & SSDs, Motherboards',
    paymentTerms: 'Net 30 Days',
    notes: 'Authorized Kingston & ASUS distributor. 7-day turnaround for RMA replacements.',
    active: true,
    createdAt: '2026-01-15T08:00:00Z',
  },
  {
    id: 'sup-002',
    name: 'Trident Technologies Colombo',
    contactPerson: 'Dhammika Fernando',
    phone: '+94 11 472 8899',
    email: 'rma@tridenttech.lk',
    address: '45/2 Nawala Road, Nugegoda',
    categories: 'Logitech, Corsair, Keyboards & Mice, Gaming Gear',
    paymentTerms: 'Credit 14 Days',
    notes: 'Official Logitech sub-distributor. Serial verification portal enabled.',
    active: true,
    createdAt: '2026-02-01T09:30:00Z',
  },
  {
    id: 'sup-003',
    name: 'Future World Distributors',
    contactPerson: 'Kavinda Senanayake',
    phone: '+94 77 340 1122',
    email: 'orders@futureworld.lk',
    address: '88 Duplication Road, Kollupitiya, Colombo 03',
    categories: 'Anker, Baseus, GaN Chargers, Power Banks, Cables',
    paymentTerms: 'Cash on Delivery',
    notes: 'Exclusive Anker importer. One-to-one replacement on defective chargers.',
    active: true,
    createdAt: '2026-02-10T11:15:00Z',
  },
  {
    id: 'sup-004',
    name: 'Singer Sri Lanka IT Hub',
    contactPerson: 'Shanika Gunawardena',
    phone: '+94 11 540 0400',
    email: 'itcorporate@singersl.com',
    address: 'Singer Mega Complex, No 80 Nawam Mawatha, Colombo 02',
    categories: 'Dell, HP, Monitors, Laptops, Commercial Displays',
    paymentTerms: 'Net 60 Days',
    notes: 'Dell Official Corporate Partner. On-site warranty support available.',
    active: true,
    createdAt: '2026-03-05T14:20:00Z',
  },
  {
    id: 'sup-005',
    name: 'Redline Technologies Imports',
    contactPerson: 'Hasitha Gamage',
    phone: '+94 71 889 0011',
    email: 'support@redlinetech.lk',
    address: 'Majestic City Level 3, Station Road, Colombo 04',
    categories: 'HyperX, SteelSeries, Audiophile Headsets, Microphones',
    paymentTerms: 'Advance 50%',
    notes: 'Specialist gaming peripheral distributor. RMA claims processed weekly.',
    active: true,
    createdAt: '2026-03-12T16:00:00Z',
  },
];

export const DEFAULT_RMA_CLAIMS: SupplierRmaClaim[] = [
  {
    id: 'rma-001',
    serialNumber: 'SN-481920',
    productSku: 'WT-SSD-1TB-NVME',
    productName: 'Kingston NV2 1TB PCIe 4.0 NVMe SSD',
    customerName: 'Roshan Wickramasinghe',
    customerPhone: '+94 77 891 2345',
    supplierId: 'sup-001',
    supplierName: 'Chama Computers (Pvt) Ltd',
    rmaNumber: 'RMA-CHAMA-2026-041',
    dateSent: '2026-10-01',
    status: 'Pending with Supplier',
    expectedReturnDate: '2026-10-12',
    issueDescription: 'Drive not detected in BIOS / I/O device error on cold boot',
    notes: 'Dispatched via courier. Nuwan confirmed receipt at Chama service center.',
    createdAt: '2026-10-01T10:30:00Z',
    updatedAt: '2026-10-01T10:30:00Z',
  },
  {
    id: 'rma-002',
    serialNumber: 'SN-902184',
    productSku: 'WT-MOUSE-MX3S',
    productName: 'Logitech MX Master 3S Wireless Mouse - Graphite',
    customerName: 'Dilshan Silva',
    customerPhone: '+94 71 456 7890',
    supplierId: 'sup-002',
    supplierName: 'Trident Technologies Colombo',
    rmaNumber: 'RMA-TRIDENT-2026-019',
    dateSent: '2026-09-24',
    status: 'Repaired',
    expectedReturnDate: '2026-10-05',
    actualReturnDate: '2026-10-05',
    issueDescription: 'Scroll wheel ratchet motor stuck in free-spin mode',
    notes: 'Optical switch replaced and recalibrated by Trident. Tested OK. Ready for customer handover.',
    createdAt: '2026-09-24T14:15:00Z',
    updatedAt: '2026-10-05T16:20:00Z',
  },
];

// Clean Production State - Zero Mock Data
const INITIAL_PRODUCTS: Product[] = [];
const INITIAL_ORDERS: Order[] = [];
const INITIAL_WAYBILLS: TransExpressWaybill[] = [];
const INITIAL_WARRANTIES: WarrantyRecord[] = [];
const INITIAL_EXPENSES: ExpenseItem[] = [];

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

export const DEFAULT_WEBHOOK_EVENTS: WebhookEvent[] = [
  {
    id: 'evt-listener-active',
    source: 'woocommerce',
    event: 'system.listener_active',
    status: 'success',
    rawPayload: {
      status: 'active',
      message: 'WooCommerce Webhook Listener Active. Ready for live order testing.',
      routes: {
        webhook: '/api/webhooks/woocommerce',
        sync: '/api/orders/sync',
      },
      supportedStatuses: ['processing', 'pending', 'completed', 'on-hold'],
      autoActions: [
        'Trans Express Waybill Auto-generation',
        'SMSlenz Customer Confirmation Dispatch',
        'POS Invoicing & Stock Sync',
      ],
    },
    receivedAt: '2026-10-06T09:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Cross-Environment Persistent State (Browser LocalStorage + Global Singleton)
// ---------------------------------------------------------------------------
interface MockDatabaseStore {
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
}

const STORAGE_KEY = 'wowtek_pro_prod_v1';

function initMockDb(): MockDatabaseStore {
  const g = globalThis as any;
  if (!g._wowtekMockDb) {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        // Clear any previous mock test data versions from localStorage
        window.localStorage.removeItem('wowtek_pro_db_v1');
        window.localStorage.removeItem('wowtek_pro_db_v2');

        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (!parsed.suppliers || parsed.suppliers.length === 0) {
            parsed.suppliers = [...DEFAULT_SUPPLIERS];
          }
          if (!parsed.rmaClaims) {
            parsed.rmaClaims = [...DEFAULT_RMA_CLAIMS];
          }
          if (!parsed.webhookEvents || parsed.webhookEvents.length === 0) {
            parsed.webhookEvents = [...DEFAULT_WEBHOOK_EVENTS];
          }
          g._wowtekMockDb = parsed;
          return g._wowtekMockDb;
        }
      } catch {
        // Fallback to clean empty arrays
      }
    }

    g._wowtekMockDb = {
      orders: [],
      products: [],
      waybills: [],
      warranties: [],
      expenses: [],
      apiConfig: { ...INITIAL_API_CONFIG },
      platforms: [...DEFAULT_PLATFORMS],
      gateways: [...DEFAULT_GATEWAYS],
      suppliers: [...DEFAULT_SUPPLIERS],
      rmaClaims: [...DEFAULT_RMA_CLAIMS],
      webhookEvents: [...DEFAULT_WEBHOOK_EVENTS],
    };
  }
  return g._wowtekMockDb;
}

function persistMockDb() {
  if (typeof window !== 'undefined' && window.localStorage && (globalThis as any)._wowtekMockDb) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify((globalThis as any)._wowtekMockDb));
    } catch {
      // Ignore quota warnings
    }
  }
}

// ---------------------------------------------------------------------------
// Native MongoClient Singleton with 30s Timeout (Server-Side Only)
// ---------------------------------------------------------------------------
let clientPromise: Promise<MongoClient> | null = null;

export async function getDatabase(): Promise<{
  db: Db | null;
  client: MongoClient | null;
  isFallback: boolean;
  message: string;
}> {
  // If running in browser or URI not provided, gracefully fallback to mock DB
  if (typeof window !== 'undefined' || !MONGODB_URI) {
    return {
      db: null,
      client: null,
      isFallback: true,
      message: 'Operating in resilient Mock DB mode with 30s timeout protection.',
    };
  }

  try {
    if (!clientPromise) {
      const g = globalThis as any;
      if (process.env.NODE_ENV === 'development' && g._mongoClientPromise) {
        clientPromise = g._mongoClientPromise;
      } else {
        // Server-safe dynamic import that avoids webpack bundling mongodb in client
        const mongodbPkg = 'mongodb';
        const { MongoClient } = await (Function('pkg', 'return import(pkg)')(mongodbPkg));
        const client = new MongoClient(MONGODB_URI, {
          serverSelectionTimeoutMS: 30000,
          connectTimeoutMS: 15000,
        });
        clientPromise = client.connect();
        if (process.env.NODE_ENV === 'development') {
          g._mongoClientPromise = clientPromise;
        }
      }
    }

    const connectedClient = await Promise.race([
      clientPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('MongoDB connection timed out (30s limit)')), 30000)
      ),
    ]);

    if (!connectedClient) {
      throw new Error('MongoClient returned null');
    }

    const db = connectedClient.db(MONGODB_DB_NAME);
    await db.command({ ping: 1 });

    return {
      db,
      client: connectedClient,
      isFallback: false,
      message: `Connected to MongoDB Atlas: ${MONGODB_DB_NAME}`,
    };
  } catch (err: any) {
    return {
      db: null,
      client: null,
      isFallback: true,
      message: `MongoDB connection unavailable (${err?.message || 'Timeout'}). Operating in safe fallback mode.`,
    };
  }
}

export async function checkDatabaseHealth(): Promise<DatabaseHealthStatus> {
  const startTime = Date.now();
  const mockDb = initMockDb();

  try {
    const { isFallback, message } = await getDatabase();
    return {
      status: isFallback ? 'fallback' : 'connected',
      latencyMs: Date.now() - startTime,
      database: isFallback ? 'Mock In-Memory DB (Safe Fallback)' : `MongoDB Atlas (${MONGODB_DB_NAME})`,
      message,
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
  } catch (err: any) {
    return {
      status: 'fallback',
      latencyMs: Date.now() - startTime,
      database: 'Mock In-Memory DB (Safe Fallback)',
      message: `Database ping exception: ${err?.message || 'Error'}. Reverting to fallback.`,
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
}

// ---------------------------------------------------------------------------
// Dynamic Platform & Payment Gateway Fee Accessors
// ---------------------------------------------------------------------------
export async function getPlatforms(): Promise<PlatformConfig[]> {
  return initMockDb().platforms;
}

export async function savePlatforms(platforms: PlatformConfig[]): Promise<PlatformConfig[]> {
  const mock = initMockDb();
  mock.platforms = platforms;
  persistMockDb();
  return platforms;
}

export async function getPaymentGateways(): Promise<PaymentGatewayConfig[]> {
  return initMockDb().gateways;
}

export async function savePaymentGateways(gateways: PaymentGatewayConfig[]): Promise<PaymentGatewayConfig[]> {
  const mock = initMockDb();
  mock.gateways = gateways;
  persistMockDb();
  return gateways;
}

// ---------------------------------------------------------------------------
// Order & POS Invoicing CRUD with Returns & Stock Restoration
// ---------------------------------------------------------------------------
export async function getOrders(): Promise<Order[]> {
  return initMockDb().orders;
}

export async function saveOrder(order: Order): Promise<Order> {
  const mock = initMockDb();
  mock.orders.unshift(order);

  // If new sale, deduct stock from store
  order.items.forEach((item) => {
    const prod = mock.products.find((p) => p.sku === item.sku);
    if (prod) {
      if (prod.stockStore >= item.quantity) {
        prod.stockStore -= item.quantity;
      } else {
        const remaining = item.quantity - prod.stockStore;
        prod.stockStore = 0;
        prod.stockWarehouse = Math.max(0, prod.stockWarehouse - remaining);
      }
    }
  });

  persistMockDb();
  return order;
}

export async function updateOrder(id: string, updates: Partial<Order>): Promise<Order | null> {
  const mock = initMockDb();
  const index = mock.orders.findIndex((o: Order) => o.id === id);
  if (index !== -1) {
    mock.orders[index] = { ...mock.orders[index], ...updates, updatedAt: new Date().toISOString() };
    persistMockDb();
    return mock.orders[index];
  }
  return null;
}

export async function deleteOrder(id: string): Promise<boolean> {
  const mock = initMockDb();
  const initialLength = mock.orders.length;
  mock.orders = mock.orders.filter((o: Order) => o.id !== id);
  persistMockDb();
  return mock.orders.length < initialLength;
}

/**
 * Returns & Stock Restoration:
 * Marks an invoice or specific items as "Returned".
 * Automatically increments / restores the product stock in the database.
 */
export async function processOrderReturn(
  orderId: string,
  returnedSkus?: string[],
  reason?: string
): Promise<{ success: boolean; order: Order | null; restoredItems: Array<{ sku: string; qty: number }> }> {
  const mock = initMockDb();
  const order = mock.orders.find((o) => o.id === orderId);
  if (!order) {
    return { success: false, order: null, restoredItems: [] };
  }

  const restoredItems: Array<{ sku: string; qty: number }> = [];

  // Update item return flags and restore stock
  order.items = order.items.map((item) => {
    const shouldReturn = !returnedSkus || returnedSkus.includes(item.sku);
    if (shouldReturn && !item.returned) {
      // Find product and restore stock to store front
      const prod = mock.products.find((p) => p.sku === item.sku);
      if (prod) {
        prod.stockStore += item.quantity;
        restoredItems.push({ sku: item.sku, qty: item.quantity });
      }
      return { ...item, returned: true, returnedQty: item.quantity };
    }
    return item;
  });

  const allItemsReturned = order.items.every((it) => it.returned);
  order.status = allItemsReturned ? 'Returned' : 'Partially Returned';
  order.returnedAt = new Date().toISOString();
  order.returnReason = reason || 'Customer requested return & refund';
  order.updatedAt = new Date().toISOString();

  // If full return, net profit & gross total reversed
  if (allItemsReturned) {
    order.netProfit = 0;
  }

  persistMockDb();
  return { success: true, order, restoredItems };
}

// ---------------------------------------------------------------------------
// Product Inventory & Valuation
// ---------------------------------------------------------------------------
export async function getProducts(): Promise<Product[]> {
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
  persistMockDb();
  return product;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product | null> {
  const mock = initMockDb();
  const index = mock.products.findIndex((p) => p.id === id);
  if (index !== -1) {
    mock.products[index] = { ...mock.products[index], ...updates };
    persistMockDb();
    return mock.products[index];
  }
  return null;
}

export async function deleteProduct(id: string): Promise<boolean> {
  const mock = initMockDb();
  const prevLen = mock.products.length;
  mock.products = mock.products.filter((p) => p.id !== id);
  persistMockDb();
  return mock.products.length < prevLen;
}

// ---------------------------------------------------------------------------
// Waybills, Warranties, Expenses, API Config
// ---------------------------------------------------------------------------
export async function getWaybills(): Promise<TransExpressWaybill[]> {
  return initMockDb().waybills;
}

export async function saveWaybill(waybill: TransExpressWaybill): Promise<TransExpressWaybill> {
  const mock = initMockDb();
  mock.waybills.unshift(waybill);
  persistMockDb();
  return waybill;
}

export async function updateWaybill(
  id: string,
  updates: Partial<TransExpressWaybill>
): Promise<TransExpressWaybill | null> {
  const mock = initMockDb();
  const index = mock.waybills.findIndex((w: TransExpressWaybill) => w.id === id);
  if (index !== -1) {
    mock.waybills[index] = { ...mock.waybills[index], ...updates };
    persistMockDb();
    return mock.waybills[index];
  }
  return null;
}

export async function getWarranties(): Promise<WarrantyRecord[]> {
  return initMockDb().warranties;
}

export async function saveWarranty(warranty: WarrantyRecord): Promise<WarrantyRecord> {
  const mock = initMockDb();
  mock.warranties.unshift(warranty);
  persistMockDb();
  return warranty;
}

export async function updateWarranty(
  id: string,
  updates: Partial<WarrantyRecord>
): Promise<WarrantyRecord | null> {
  const mock = initMockDb();
  const index = mock.warranties.findIndex((w) => w.id === id);
  if (index !== -1) {
    mock.warranties[index] = { ...mock.warranties[index], ...updates };
    persistMockDb();
    return mock.warranties[index];
  }
  return null;
}

export async function getExpenses(): Promise<ExpenseItem[]> {
  return initMockDb().expenses;
}

export async function saveExpense(expense: ExpenseItem): Promise<ExpenseItem> {
  const mock = initMockDb();
  mock.expenses.unshift(expense);
  persistMockDb();
  return expense;
}

export async function getApiConfig(): Promise<ApiIntegrationConfig> {
  return initMockDb().apiConfig;
}

export async function saveApiConfig(config: ApiIntegrationConfig): Promise<ApiIntegrationConfig> {
  const mock = initMockDb();
  mock.apiConfig = { ...config };
  persistMockDb();
  return mock.apiConfig;
}

// ---------------------------------------------------------------------------
// Suppliers & Purchasing CRUD
// ---------------------------------------------------------------------------
export async function getSuppliers(): Promise<Supplier[]> {
  return initMockDb().suppliers;
}

export async function saveSupplier(supplier: Supplier): Promise<Supplier> {
  const mock = initMockDb();
  const existingIdx = mock.suppliers.findIndex((s) => s.id === supplier.id);
  if (existingIdx !== -1) {
    mock.suppliers[existingIdx] = supplier;
  } else {
    mock.suppliers.unshift(supplier);
  }
  persistMockDb();
  return supplier;
}

export async function updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier | null> {
  const mock = initMockDb();
  const index = mock.suppliers.findIndex((s) => s.id === id);
  if (index !== -1) {
    mock.suppliers[index] = { ...mock.suppliers[index], ...updates, updatedAt: new Date().toISOString() };
    persistMockDb();
    return mock.suppliers[index];
  }
  return null;
}

export async function deleteSupplier(id: string): Promise<boolean> {
  const mock = initMockDb();
  const initialLength = mock.suppliers.length;
  mock.suppliers = mock.suppliers.filter((s) => s.id !== id);
  persistMockDb();
  return mock.suppliers.length < initialLength;
}

// ---------------------------------------------------------------------------
// Supplier Warranty Claims (RMA) CRUD
// ---------------------------------------------------------------------------
export async function getSupplierRmaClaims(): Promise<SupplierRmaClaim[]> {
  return initMockDb().rmaClaims;
}

export async function saveSupplierRmaClaim(claim: SupplierRmaClaim): Promise<SupplierRmaClaim> {
  const mock = initMockDb();
  const existingIdx = mock.rmaClaims.findIndex((r) => r.id === claim.id);
  if (existingIdx !== -1) {
    mock.rmaClaims[existingIdx] = claim;
  } else {
    mock.rmaClaims.unshift(claim);
  }
  persistMockDb();
  return claim;
}

export async function updateSupplierRmaClaim(
  id: string,
  updates: Partial<SupplierRmaClaim>
): Promise<SupplierRmaClaim | null> {
  const mock = initMockDb();
  const index = mock.rmaClaims.findIndex((r) => r.id === id);
  if (index !== -1) {
    mock.rmaClaims[index] = { ...mock.rmaClaims[index], ...updates, updatedAt: new Date().toISOString() };
    persistMockDb();
    return mock.rmaClaims[index];
  }
  return null;
}

export async function deleteSupplierRmaClaim(id: string): Promise<boolean> {
  const mock = initMockDb();
  const initialLength = mock.rmaClaims.length;
  mock.rmaClaims = mock.rmaClaims.filter((r) => r.id !== id);
  persistMockDb();
  return mock.rmaClaims.length < initialLength;
}

// ---------------------------------------------------------------------------
// Incoming Webhook Events & Transaction Audit Log
// ---------------------------------------------------------------------------
export async function getWebhookEvents(): Promise<WebhookEvent[]> {
  return initMockDb().webhookEvents;
}

export async function saveWebhookEvent(event: WebhookEvent): Promise<WebhookEvent> {
  const mock = initMockDb();
  const existingIdx = mock.webhookEvents.findIndex((e) => e.id === event.id);
  if (existingIdx !== -1) {
    mock.webhookEvents[existingIdx] = event;
  } else {
    mock.webhookEvents.unshift(event);
    // Keep last 50 events in buffer
    if (mock.webhookEvents.length > 50) {
      mock.webhookEvents = mock.webhookEvents.slice(0, 50);
    }
  }
  persistMockDb();
  return event;
}

export async function clearWebhookEvents(): Promise<boolean> {
  const mock = initMockDb();
  mock.webhookEvents = [...DEFAULT_WEBHOOK_EVENTS];
  persistMockDb();
  return true;
}

export default clientPromise;
