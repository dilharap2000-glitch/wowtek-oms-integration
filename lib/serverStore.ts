import fs from 'fs';
import path from 'path';
import { Order, TransExpressWaybill, WebhookEvent } from '@/types';

export interface ServerCustomer {
  id: string;
  name: string;
  phone: string;
  source: string;
  totalOrders: number;
  lastOrderDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface ServerStoreData {
  orders: Order[];
  waybills: TransExpressWaybill[];
  webhookEvents: WebhookEvent[];
  customers: ServerCustomer[];
  lastUpdated: string;
}

// In-memory cache singleton across hot-reloads
const g = globalThis as any;

type LiveListener = (payload: any) => void;
if (!g._liveSseListeners) {
  g._liveSseListeners = new Set<LiveListener>();
}

export function subscribeToLiveUpdates(listener: LiveListener): () => void {
  g._liveSseListeners.add(listener);
  return () => {
    g._liveSseListeners.delete(listener);
  };
}

export function broadcastLiveUpdate(payload: any) {
  if (g._liveSseListeners) {
    for (const listener of g._liveSseListeners) {
      try {
        listener(payload);
      } catch {
        // Ignore subscriber delivery issues
      }
    }
  }
}

function getStoreFilePath(): string {
  try {
    const dataDir = path.join(process.cwd(), '.data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, 'wowtek_live_store.json');
  } catch {
    return path.join('/tmp', 'wowtek_live_store.json');
  }
}

function readFromDisk(): ServerStoreData {
  const primaryPath = getStoreFilePath();
  const fallbackPath = path.join('/tmp', 'wowtek_live_store.json');

  for (const filePath of [primaryPath, fallbackPath]) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        if (data && Array.isArray(data.orders)) {
          return {
            orders: Array.isArray(data.orders) ? data.orders : [],
            waybills: Array.isArray(data.waybills) ? data.waybills : [],
            webhookEvents: Array.isArray(data.webhookEvents) ? data.webhookEvents : [],
            customers: Array.isArray(data.customers) ? data.customers : [],
            lastUpdated: data.lastUpdated || new Date().toISOString(),
          };
        }
      }
    } catch {
      // Continue to next path
    }
  }

  return {
    orders: [],
    waybills: [],
    webhookEvents: [],
    customers: [],
    lastUpdated: new Date().toISOString(),
  };
}

function writeToDisk(data: ServerStoreData) {
  const pathsToWrite = [getStoreFilePath(), path.join('/tmp', 'wowtek_live_store.json')];
  for (const filePath of pathsToWrite) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Ignore write errors in read-only environments
    }
  }
}

export function getServerStore(): ServerStoreData {
  if (!g._wowtekServerStore) {
    g._wowtekServerStore = readFromDisk();
  }
  return g._wowtekServerStore;
}

export function saveServerOrder(order: Order): Order {
  const store = getServerStore();
  const existingIdx = store.orders.findIndex(
    (o) => o.id === order.id || o.invoiceNumber === order.invoiceNumber
  );

  if (existingIdx !== -1) {
    store.orders[existingIdx] = {
      ...store.orders[existingIdx],
      ...order,
      updatedAt: new Date().toISOString(),
    };
  } else {
    // Real incoming orders take top priority at the beginning of the list
    store.orders.unshift(order);
  }

  store.lastUpdated = new Date().toISOString();
  writeToDisk(store);

  broadcastLiveUpdate({
    type: 'order_saved',
    order,
    timestamp: store.lastUpdated,
  });

  return order;
}

export function saveServerWaybill(waybill: TransExpressWaybill): TransExpressWaybill {
  const store = getServerStore();
  const existingIdx = store.waybills.findIndex(
    (w) => w.id === waybill.id || w.trackingNumber === waybill.trackingNumber
  );

  if (existingIdx !== -1) {
    store.waybills[existingIdx] = { ...store.waybills[existingIdx], ...waybill };
  } else {
    store.waybills.unshift(waybill);
  }

  store.lastUpdated = new Date().toISOString();
  writeToDisk(store);

  broadcastLiveUpdate({
    type: 'waybill_saved',
    waybill,
    timestamp: store.lastUpdated,
  });

  return waybill;
}

export function saveServerWebhookEvent(event: WebhookEvent): WebhookEvent {
  const store = getServerStore();
  const existingIdx = store.webhookEvents.findIndex((e) => e.id === event.id);

  if (existingIdx !== -1) {
    store.webhookEvents[existingIdx] = event;
  } else {
    store.webhookEvents.unshift(event);
    if (store.webhookEvents.length > 100) {
      store.webhookEvents = store.webhookEvents.slice(0, 100);
    }
  }

  store.lastUpdated = new Date().toISOString();
  writeToDisk(store);

  broadcastLiveUpdate({
    type: 'webhook_event_saved',
    event,
    timestamp: store.lastUpdated,
  });

  return event;
}

export function deleteServerOrder(id: string): boolean {
  const store = getServerStore();
  const prevLen = store.orders.length;
  store.orders = store.orders.filter((o) => o.id !== id && o.invoiceNumber !== id);
  store.lastUpdated = new Date().toISOString();
  writeToDisk(store);

  broadcastLiveUpdate({
    type: 'order_deleted',
    orderId: id,
    timestamp: store.lastUpdated,
  });

  return store.orders.length < prevLen;
}

export function deleteServerWaybill(id: string): boolean {
  const store = getServerStore();
  const prevLen = store.waybills.length;
  store.waybills = store.waybills.filter((w) => w.id !== id && w.trackingNumber !== id);
  store.lastUpdated = new Date().toISOString();
  writeToDisk(store);

  broadcastLiveUpdate({
    type: 'waybill_deleted',
    waybillId: id,
    timestamp: store.lastUpdated,
  });

  return store.waybills.length < prevLen;
}

export function clearServerWebhookEvents(): boolean {
  const store = getServerStore();
  store.webhookEvents = [];
  store.lastUpdated = new Date().toISOString();
  writeToDisk(store);

  broadcastLiveUpdate({
    type: 'events_cleared',
    webhookEvents: [],
    timestamp: store.lastUpdated,
  });

  return true;
}

export function getServerCustomers(): ServerCustomer[] {
  const store = getServerStore();
  if (!Array.isArray(store.customers)) {
    store.customers = [];
  }
  return store.customers;
}

export function upsertServerCustomers(
  records: Array<{ name: string; phone: string; source?: string }>
): { inserted: number; updated: number; total: number } {
  const store = getServerStore();
  if (!Array.isArray(store.customers)) {
    store.customers = [];
  }

  const now = new Date().toISOString();
  let inserted = 0;
  let updated = 0;

  for (const rec of records) {
    const existingIdx = store.customers.findIndex((c) => c.phone === rec.phone);
    if (existingIdx !== -1) {
      store.customers[existingIdx] = {
        ...store.customers[existingIdx],
        name: rec.name || store.customers[existingIdx].name,
        source: rec.source || store.customers[existingIdx].source,
        updatedAt: now,
      };
      updated++;
    } else {
      store.customers.unshift({
        id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: rec.name || 'Manual Customer',
        phone: rec.phone,
        source: rec.source || 'CSV Import',
        totalOrders: 0,
        lastOrderDate: now,
        createdAt: now,
        updatedAt: now,
      });
      inserted++;
    }
  }

  store.lastUpdated = now;
  writeToDisk(store);

  return { inserted, updated, total: store.customers.length };
}

export function deleteServerCustomers(phones: string[]): number {
  const store = getServerStore();
  if (!Array.isArray(store.customers)) {
    store.customers = [];
    return 0;
  }

  const prevLen = store.customers.length;
  store.customers = store.customers.filter((c) => !phones.includes(c.phone));
  store.lastUpdated = new Date().toISOString();
  writeToDisk(store);

  return prevLen - store.customers.length;
}

