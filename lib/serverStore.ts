import fs from 'fs';
import path from 'path';
import { Order, TransExpressWaybill, WebhookEvent } from '@/types';
import { DEFAULT_WEBHOOK_EVENTS } from './db';

interface ServerStoreData {
  orders: Order[];
  waybills: TransExpressWaybill[];
  webhookEvents: WebhookEvent[];
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
            orders: data.orders || [],
            waybills: data.waybills || [],
            webhookEvents: Array.isArray(data.webhookEvents) && data.webhookEvents.length > 0
              ? data.webhookEvents
              : [...DEFAULT_WEBHOOK_EVENTS],
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
    webhookEvents: [...DEFAULT_WEBHOOK_EVENTS],
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

export function clearServerWebhookEvents(): boolean {
  const store = getServerStore();
  store.webhookEvents = [
    {
      id: `evt-reset-${Date.now()}`,
      source: 'woocommerce',
      event: 'system.listener_active',
      status: 'success',
      rawPayload: {
        status: 'active',
        message: 'Webhook events reset. Live listener actively awaiting incoming WooCommerce orders.',
        secret: 'WOWTEK-WC-Webhook-2026-9X7Kl42',
        autoPipeline: 'Trans Express TE-XXXX waybill + SMSlenz SMS',
      },
      receivedAt: new Date().toISOString(),
    },
  ];

  store.lastUpdated = new Date().toISOString();
  writeToDisk(store);

  broadcastLiveUpdate({
    type: 'events_cleared',
    webhookEvents: store.webhookEvents,
    timestamp: store.lastUpdated,
  });

  return true;
}
