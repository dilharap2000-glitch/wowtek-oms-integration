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
    phone: '+94 11 258 7744',
    email: 'warranty@chamacomputers.lk',
    address: 'No 112 Unity Plaza, Galle Road, Colombo 04',
    categories: 'Kingston, ASUS, Corsair, RAM, SSDs, Motherboards',
    paymentTerms: 'Credit 30 Days',
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
}

const STORAGE_KEY = 'wowtek_pos_v2_store';

export function initMockDb(): MockDatabaseState {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          orders: Array.isArray(parsed.orders) ? parsed.orders : INITIAL_ORDERS,
          products: Array.isArray(parsed.products) ? parsed.products : INITIAL_PRODUCTS,
          waybills: Array.isArray(parsed.waybills) ? parsed.waybills : INITIAL_WAYBILLS,
          warranties: Array.isArray(parsed.warranties) ? parsed.warranties : INITIAL_WARRANTIES,
          expenses: Array.isArray(parsed.expenses) ? parsed.expenses : INITIAL_EXPENSES,
          apiConfig: parsed.apiConfig ? { ...INITIAL_API_CONFIG, ...parsed.apiConfig } : { ...INITIAL_API_CONFIG },
          platforms: Array.isArray(parsed.platforms) ? parsed.platforms : [...DEFAULT_PLATFORMS],
          gateways: Array.isArray(parsed.gateways) ? parsed.gateways : [...DEFAULT_GATEWAYS],
          suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : [...DEFAULT_SUPPLIERS],
          rmaClaims: Array.isArray(parsed.rmaClaims) ? parsed.rmaClaims : [...DEFAULT_RMA_CLAIMS],
          webhookEvents: Array.isArray(parsed.webhookEvents) ? parsed.webhookEvents : [...DEFAULT_WEBHOOK_EVENTS],
        };
      }
    } catch {
      // Ignore parse error
    }
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
// Client Database Health Check (Fetches from server-only /api/health/database)
// ---------------------------------------------------------------------------
export async function checkDatabaseHealth(): Promise<DatabaseHealthStatus> {
  const startTime = Date.now();
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/health/database', { cache: 'no-store' });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fall through to offline fallback
    }
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
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/sync/live', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.orders) && data.orders.length > 0) {
          return data.orders;
        }
      }
    } catch {}
  } else {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getServerStore } = require('./serverStore');
      const store = getServerStore();
      if (store.orders && store.orders.length > 0) {
        return store.orders;
      }
    } catch {}
  }
  return initMockDb().orders;
}

export async function saveOrder(order: Order): Promise<Order> {
  if (typeof window !== 'undefined') {
    try {
      fetch('/api/sync/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_client_order', order }),
      }).catch(() => {});
    } catch {}
  } else {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { saveServerOrder } = require('./serverStore');
      saveServerOrder(order);
    } catch {}
  }

  const mock = initMockDb();
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

  // Deduct stock from store
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

      const prod = mock.products.find((p) => p.sku === item.sku);
      if (prod) {
        prod.stockStore += item.quantity;
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
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/sync/live', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.waybills) && data.waybills.length > 0) {
          return data.waybills;
        }
      }
    } catch {}
  } else {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getServerStore } = require('./serverStore');
      const store = getServerStore();
      if (store.waybills && store.waybills.length > 0) {
        return store.waybills;
      }
    } catch {}
  }
  return initMockDb().waybills;
}

export async function saveWaybill(waybill: TransExpressWaybill): Promise<TransExpressWaybill> {
  if (typeof window === 'undefined') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { saveServerWaybill } = require('./serverStore');
      saveServerWaybill(waybill);
    } catch {}
  }

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
  return waybill;
}

export async function updateWaybill(id: string, updates: Partial<TransExpressWaybill>): Promise<TransExpressWaybill | null> {
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

export async function updateWarranty(id: string, updates: Partial<WarrantyRecord>): Promise<WarrantyRecord | null> {
  const mock = initMockDb();
  const index = mock.warranties.findIndex((w: WarrantyRecord) => w.id === id);
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
  return config;
}

export async function getSuppliers(): Promise<Supplier[]> {
  return initMockDb().suppliers;
}

export async function saveSupplier(supplier: Supplier): Promise<Supplier> {
  const mock = initMockDb();
  mock.suppliers.unshift(supplier);
  persistMockDb();
  return supplier;
}

export async function updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier | null> {
  const mock = initMockDb();
  const index = mock.suppliers.findIndex((s: Supplier) => s.id === id);
  if (index !== -1) {
    mock.suppliers[index] = { ...mock.suppliers[index], ...updates };
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

export async function getSupplierRmaClaims(): Promise<SupplierRmaClaim[]> {
  return initMockDb().rmaClaims;
}

export async function saveSupplierRmaClaim(claim: SupplierRmaClaim): Promise<SupplierRmaClaim> {
  const mock = initMockDb();
  mock.rmaClaims.unshift(claim);
  persistMockDb();
  return claim;
}

export async function updateSupplierRmaClaim(id: string, updates: Partial<SupplierRmaClaim>): Promise<SupplierRmaClaim | null> {
  const mock = initMockDb();
  const index = mock.rmaClaims.findIndex((r: SupplierRmaClaim) => r.id === id);
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
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/webhooks/events', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.events) && data.events.length > 0) {
          return data.events;
        }
      }
    } catch {}
  } else {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getServerStore } = require('./serverStore');
      const store = getServerStore();
      if (store.webhookEvents && store.webhookEvents.length > 0) {
        return store.webhookEvents;
      }
    } catch {}
  }
  return initMockDb().webhookEvents;
}

export async function saveWebhookEvent(event: WebhookEvent): Promise<WebhookEvent> {
  if (typeof window === 'undefined') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { saveServerWebhookEvent } = require('./serverStore');
      saveServerWebhookEvent(event);
    } catch {}
  }

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
  } else {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { clearServerWebhookEvents } = require('./serverStore');
      clearServerWebhookEvents();
    } catch {}
  }

  const mock = initMockDb();
  mock.webhookEvents = [...DEFAULT_WEBHOOK_EVENTS];
  persistMockDb();
  return true;
}
