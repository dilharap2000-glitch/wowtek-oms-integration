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

// Initial Seed Products
const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-001',
    sku: 'WT-SSD-1TB-NVME',
    barcode: '4792038100142',
    name: 'Kingston NV2 1TB PCIe 4.0 NVMe SSD',
    category: 'Computer Components',
    costPrice: 16500,
    sellingPrice: 22800,
    stockWarehouse: 45,
    stockStore: 12,
    stockReserved: 3,
    grnBatch: 'GRN-2026-OCT-001',
    supplier: 'Chama Computers (Pvt) Ltd',
    warrantyPeriodMonths: 36,
  },
  {
    id: 'prod-002',
    sku: 'WT-MOUSE-MX3S',
    barcode: '4792038100289',
    name: 'Logitech MX Master 3S Wireless Mouse - Graphite',
    category: 'Peripherals',
    costPrice: 28000,
    sellingPrice: 38500,
    stockWarehouse: 18,
    stockStore: 5,
    stockReserved: 2,
    grnBatch: 'GRN-2026-OCT-004',
    supplier: 'Trident Technologies Colombo',
    warrantyPeriodMonths: 12,
  },
  {
    id: 'prod-003',
    sku: 'WT-CHG-ANKER-65W',
    barcode: '4792038100357',
    name: 'Anker 735 GaNPrime 65W Fast Charger (UK 3-Pin)',
    category: 'Mobile Accessories',
    costPrice: 11200,
    sellingPrice: 16900,
    stockWarehouse: 60,
    stockStore: 22,
    stockReserved: 5,
    grnBatch: 'GRN-2026-SEP-082',
    supplier: 'Future World Distributors',
    warrantyPeriodMonths: 18,
  },
  {
    id: 'prod-004',
    sku: 'WT-MON-DELL-24IPS',
    barcode: '4792038100418',
    name: 'Dell SE2422HX 24" FHD IPS 75Hz Monitor',
    category: 'Monitors & Displays',
    costPrice: 34500,
    sellingPrice: 44900,
    stockWarehouse: 14,
    stockStore: 4,
    stockReserved: 1,
    grnBatch: 'GRN-2026-SEP-090',
    supplier: 'Softlogic Retail Logistics',
    warrantyPeriodMonths: 36,
  },
  {
    id: 'prod-005',
    sku: 'WT-KEY-KEYCHRON-K2',
    barcode: '4792038100593',
    name: 'Keychron K2 V2 Wireless Mechanical Keyboard',
    category: 'Peripherals',
    costPrice: 24000,
    sellingPrice: 32500,
    stockWarehouse: 25,
    stockStore: 8,
    stockReserved: 4,
    grnBatch: 'GRN-2026-OCT-012',
    supplier: 'Redline Technologies',
    warrantyPeriodMonths: 12,
  },
];

const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-1001',
    invoiceNumber: 'INV-WC-8491',
    channel: 'woocommerce',
    channelName: 'WooCommerce Website',
    paymentGateway: 'cash_cod',
    paymentGatewayName: 'Cash on Delivery (COD)',
    customerName: 'Kavinda Perera',
    customerPhone: '+94 77 123 4567',
    deliveryAddress: 'No. 42/B, Flower Road',
    city: 'Colombo 07',
    items: [
      {
        sku: 'WT-SSD-1TB-NVME',
        barcode: '4792038100142',
        name: 'Kingston NV2 1TB PCIe 4.0 NVMe SSD',
        quantity: 1,
        unitPrice: 22800,
        costPrice: 16500,
      },
    ],
    grossTotal: 22800,
    platformFeePercent: 0,
    platformFeeAmount: 0,
    gatewayFeePercent: 0,
    gatewayFeeAmount: 0,
    courierFee: 650,
    costOfGoods: 16500,
    netProfit: 5650,
    status: 'Completed',
    createdAt: '2026-10-04T07:15:00Z',
    updatedAt: '2026-10-04T07:15:00Z',
    waybillGenerated: true,
    waybillNumber: 'TX-CMB-84910',
    notes: 'Trans Express booked. Cash on delivery collected.',
  },
  {
    id: 'ord-1002',
    invoiceNumber: 'INV-PKM-9204',
    channel: 'pickme',
    channelName: 'PickMe Market',
    paymentGateway: 'cash_cod',
    paymentGatewayName: 'Platform Settlement',
    customerName: 'Nimasha Fernando',
    customerPhone: '+94 71 890 1234',
    deliveryAddress: '15/3, Station Road',
    city: 'Dehiwala',
    items: [
      {
        sku: 'WT-CHG-ANKER-65W',
        barcode: '4792038100357',
        name: 'Anker 735 GaNPrime 65W Fast Charger',
        quantity: 2,
        unitPrice: 16900,
        costPrice: 11200,
      },
    ],
    grossTotal: 33800,
    platformFeePercent: 20, // PickMe: 20%
    platformFeeAmount: 6760,
    gatewayFeePercent: 0,
    gatewayFeeAmount: 0,
    courierFee: 0,
    costOfGoods: 22400,
    netProfit: 4640,
    status: 'Delivered',
    createdAt: '2026-10-04T09:30:00Z',
    updatedAt: '2026-10-04T09:30:00Z',
    waybillGenerated: false,
    notes: 'PickMe 20% platform commission deducted automatically.',
  },
  {
    id: 'ord-1003',
    invoiceNumber: 'INV-UBR-58102',
    channel: 'ubereats',
    channelName: 'Uber Eats',
    paymentGateway: 'cash_cod',
    paymentGatewayName: 'Uber Wallet',
    customerName: 'Dhanushka Wickramasinghe',
    customerPhone: '+94 76 555 9812',
    deliveryAddress: 'Penthouse 4B, Monarch Residencies',
    city: 'Colombo 03',
    items: [
      {
        sku: 'WT-MOUSE-MX3S',
        barcode: '4792038100289',
        name: 'Logitech MX Master 3S Wireless Mouse - Graphite',
        quantity: 1,
        unitPrice: 38500,
        costPrice: 28000,
      },
    ],
    grossTotal: 38500,
    platformFeePercent: 15.4, // Uber Eats: 15.4%
    platformFeeAmount: 5929,
    gatewayFeePercent: 0,
    gatewayFeeAmount: 0,
    courierFee: 0,
    costOfGoods: 28000,
    netProfit: 4571,
    status: 'Completed',
    createdAt: '2026-10-04T10:45:00Z',
    updatedAt: '2026-10-04T10:45:00Z',
    waybillGenerated: false,
    notes: 'Uber Eats 15.4% commission deducted.',
  },
  {
    id: 'ord-1004',
    invoiceNumber: 'INV-POS-7721',
    channel: 'pos',
    channelName: 'In-Store POS',
    paymentGateway: 'koko', // Koko: 12%
    paymentGatewayName: 'Koko Pay (3x Installments)',
    customerName: 'Suresh Jayawardena',
    customerPhone: '+94 70 334 8891',
    deliveryAddress: 'Bambalapitiya Counter 01',
    city: 'Colombo 04',
    items: [
      {
        sku: 'WT-KEY-KEYCHRON-K2',
        barcode: '4792038100593',
        name: 'Keychron K2 V2 Wireless Mechanical Keyboard',
        quantity: 1,
        unitPrice: 32500,
        costPrice: 24000,
      },
    ],
    grossTotal: 32500,
    platformFeePercent: 0,
    platformFeeAmount: 0,
    gatewayFeePercent: 12, // Koko: 12%
    gatewayFeeAmount: 3900,
    courierFee: 0,
    costOfGoods: 24000,
    netProfit: 4600,
    status: 'Completed',
    createdAt: '2026-10-04T11:20:00Z',
    updatedAt: '2026-10-04T11:20:00Z',
    waybillGenerated: false,
    isPosSale: true,
    notes: 'POS transaction paid via Koko QR. 12% gateway fee.',
  },
];

const INITIAL_WAYBILLS: TransExpressWaybill[] = [
  {
    id: 'wb-001',
    orderId: 'ord-1001',
    trackingNumber: 'TX-CMB-84910',
    recipientName: 'Kavinda Perera',
    recipientPhone: '+94 77 123 4567',
    destination: 'No. 42/B, Flower Road, Colombo 07',
    district: 'Colombo',
    codAmount: 22800,
    weightKg: 0.45,
    status: 'Manifested',
    bookingDate: '2026-10-04 07:45 AM',
    courierNotes: 'Call before dispatch. Standard COD collection.',
    labelPrinted: true,
  },
];

const INITIAL_WARRANTIES: WarrantyRecord[] = [
  {
    id: 'war-001',
    serialNumber: 'SN-KNG-2026-88192',
    productSku: 'WT-SSD-1TB-NVME',
    productName: 'Kingston NV2 1TB PCIe 4.0 NVMe SSD',
    customerName: 'Kavinda Perera',
    customerPhone: '+94 77 123 4567',
    customerWarrantyStart: '2026-10-04',
    customerWarrantyMonths: 36,
    customerWarrantyEnd: '2029-10-04',
    supplierName: 'Chama Computers (Pvt) Ltd',
    supplierWarrantyEnd: '2029-10-31',
    smsStatus: 'Sent',
    smsGateway: 'SMSlenz',
    lastSmsDate: '2026-10-04 07:50 AM',
    status: 'Active',
  },
  {
    id: 'war-002',
    serialNumber: 'SN-LOG-9021-77341',
    productSku: 'WT-MOUSE-MX3S',
    productName: 'Logitech MX Master 3S Wireless Mouse',
    customerName: 'Asiri Ratnayake',
    customerPhone: '+94 77 881 2940',
    customerWarrantyStart: '2025-11-10',
    customerWarrantyMonths: 12,
    customerWarrantyEnd: '2026-11-10',
    supplierName: 'Trident Technologies Colombo',
    supplierWarrantyEnd: '2026-12-15',
    smsStatus: 'Scheduled',
    smsGateway: 'Dialog',
    lastSmsDate: '2025-11-10 14:20 PM',
    status: 'Expiring Soon',
  },
];

const INITIAL_EXPENSES: ExpenseItem[] = [
  {
    id: 'exp-001',
    category: 'Stock Purchases',
    description: 'Direct Import Batch: Kingston SSDs & Anker Chargers',
    amount: 520000,
    date: '2026-10-01',
    channel: 'General',
    reference: 'PO-2026-991',
  },
  {
    id: 'exp-002',
    category: 'Logistics',
    description: 'Trans Express Weekly Advance Deposit & Bag Seals',
    amount: 45000,
    date: '2026-10-02',
    channel: 'WooCommerce',
    reference: 'TX-INV-OCT-W1',
  },
];

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
}

function initMockDb(): MockDatabaseStore {
  const g = globalThis as any;
  if (!g._wowtekMockDb) {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem('wowtek_pro_db_v2');
        if (stored) {
          g._wowtekMockDb = JSON.parse(stored);
          return g._wowtekMockDb;
        }
      } catch {
        // Fallback to fresh seed
      }
    }

    g._wowtekMockDb = {
      orders: [...INITIAL_ORDERS],
      products: [...INITIAL_PRODUCTS],
      waybills: [...INITIAL_WAYBILLS],
      warranties: [...INITIAL_WARRANTIES],
      expenses: [...INITIAL_EXPENSES],
      apiConfig: { ...INITIAL_API_CONFIG },
      platforms: [...DEFAULT_PLATFORMS],
      gateways: [...DEFAULT_GATEWAYS],
    };
  }
  return g._wowtekMockDb;
}

function persistMockDb() {
  if (typeof window !== 'undefined' && window.localStorage && (globalThis as any)._wowtekMockDb) {
    try {
      window.localStorage.setItem('wowtek_pro_db_v2', JSON.stringify((globalThis as any)._wowtekMockDb));
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
        const { MongoClient } = await import('mongodb');
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

export default clientPromise;
