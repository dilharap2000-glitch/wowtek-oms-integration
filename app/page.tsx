'use client';

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Barcode,
  Truck,
  ShieldCheck,
  DollarSign,
  Settings,
  ChevronRight,
  Menu,
  X,
  CreditCard,
  Camera,
  KeyRound,
  Building2,
  MessageSquare,
  Users,
  Sun,
  Moon,
} from 'lucide-react';

import {
  Order,
  Product,
  TransExpressWaybill,
  WarrantyRecord,
  ExpenseItem,
  ApiIntegrationConfig,
  PlatformConfig,
  PaymentGatewayConfig,
  DatabaseHealthStatus,
  Supplier,
  SupplierRmaClaim,
  WebhookEvent,
  ProductAlias,
  StoreMapping,
} from '@/types';

import { SAMPLE_PRODUCTS } from '@/lib/sampleProducts';

import {
  getOrders,
  saveOrder,
  updateOrder,
  deleteOrder,
  processOrderReturn,
  getProducts,
  saveProduct,
  updateProduct,
  deleteProduct,
  restockProduct,
  getProductAliases,
  saveProductAlias,
  deleteProductAlias,
  getStoreMappings,
  saveStoreMapping,
  deleteStoreMapping,
  getWaybills,
  saveWaybill,
  updateWaybill,
  deleteWaybill,
  getWarranties,
  saveWarranty,
  updateWarranty,
  deleteWarranty,
  getExpenses,
  saveExpense,
  deleteExpense,
  getApiConfig,
  saveApiConfig,
  getPlatforms,
  savePlatforms,
  getPaymentGateways,
  savePaymentGateways,
  getSuppliers,
  saveSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierRmaClaims,
  saveSupplierRmaClaim,
  updateSupplierRmaClaim,
  deleteSupplierRmaClaim,
  getWebhookEvents,
  saveWebhookEvent,
  clearWebhookEvents,
  checkDatabaseHealth,
} from '@/lib/db';
import { acceptUberEatsOrderAction } from '@/app/actions/ubereats';

import { DashboardTab } from '@/src/components/DashboardTab';
import { PosTab } from '@/src/components/PosTab';
import { ProductsTab } from '@/src/components/ProductsTab';
import { WaybillsTab } from '@/src/components/WaybillsTab';
import { WarrantyTab } from '@/src/components/WarrantyTab';
import { ExpensesTab } from '@/src/components/ExpensesTab';
import { SettingsTab } from '@/src/components/SettingsTab';
import { IntegrationsTab } from '@/src/components/IntegrationsTab';
import { SuppliersTab } from '@/src/components/SuppliersTab';
import { SMSMarketingTab } from '@/src/components/SMSMarketingTab';
import { CreditCustomersTab } from '@/src/components/CreditCustomersTab';
import {
  ThemeSwitcher,
  applyThemeMode,
  readStoredTheme,
  type ThemeMode,
} from '@/src/components/ThemeSwitcher';

export default function WowtekProApp() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('warm-daylight');

  useEffect(() => {
    const initial = readStoredTheme();
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
    document.documentElement.classList.toggle('dark', initial === 'midnight-emerald');

    const handleThemeEvent = (event: Event) => {
      const next = (event as CustomEvent<ThemeMode>).detail;
      if (next === 'warm-daylight' || next === 'midnight-emerald') {
        setTheme(next);
      }
    };

    window.addEventListener('wowtek-theme-change', handleThemeEvent);
    return () => window.removeEventListener('wowtek-theme-change', handleThemeEvent);
  }, []);

  const handleSetTheme = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    applyThemeMode(nextTheme);
  };

  // Core Data States
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [waybills, setWaybills] = useState<TransExpressWaybill[]>([]);
  const [warranties, setWarranties] = useState<WarrantyRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [platforms, setPlatforms] = useState<PlatformConfig[]>([]);
  const [gateways, setGateways] = useState<PaymentGatewayConfig[]>([]);
  const [apiConfig, setApiConfig] = useState<ApiIntegrationConfig | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [rmaClaims, setRmaClaims] = useState<SupplierRmaClaim[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [aliases, setAliases] = useState<ProductAlias[]>([]);
  const [stores, setStores] = useState<StoreMapping[]>([]);
  const optimisticStatusMapRef = React.useRef<
    Record<string, { status: Order['status']; setAt: number }>
  >({});
  const syncSeqRef = React.useRef(0);
  const latestAppliedSyncSeqRef = React.useRef(0);
  const isSyncingRef = React.useRef(false);
  const rateLimitUntilRef = React.useRef(0);

  const [dbHealth, setDbHealth] = useState<{
    status: 'connected' | 'fallback';
    latencyMs: number;
    database: string;
  }>({
    status: 'connected',
    latencyMs: 8,
    database: 'MongoDB Atlas Connected (Live)',
  });

  // Load initial data through safe accessors
  useEffect(() => {
    async function initData() {
      try {
        const [
          loadedOrders,
          loadedProducts,
          loadedWaybills,
          loadedWarranties,
          loadedExpenses,
          loadedPlatforms,
          loadedGateways,
          loadedConfig,
          loadedSuppliers,
          loadedRmaClaims,
          loadedEvents,
          loadedAliases,
          loadedStores,
          health,
        ] = await Promise.all([
          getOrders(),
          getProducts(),
          getWaybills(),
          getWarranties(),
          getExpenses(),
          getPlatforms(),
          getPaymentGateways(),
          getApiConfig(),
          getSuppliers(),
          getSupplierRmaClaims(),
          getWebhookEvents(),
          getProductAliases(),
          getStoreMappings(),
          checkDatabaseHealth(),
        ]);

        setOrders(Array.isArray(loadedOrders) ? loadedOrders : []);
        setProducts(Array.isArray(loadedProducts) ? loadedProducts : []);
        setWaybills(Array.isArray(loadedWaybills) ? loadedWaybills : []);
        setWarranties(Array.isArray(loadedWarranties) ? loadedWarranties : []);
        setExpenses(Array.isArray(loadedExpenses) ? loadedExpenses : []);
        setPlatforms(Array.isArray(loadedPlatforms) ? loadedPlatforms : []);
        setGateways(Array.isArray(loadedGateways) ? loadedGateways : []);
        setApiConfig(loadedConfig);
        setSuppliers(Array.isArray(loadedSuppliers) ? loadedSuppliers : []);
        setRmaClaims(Array.isArray(loadedRmaClaims) ? loadedRmaClaims : []);
        setWebhookEvents(Array.isArray(loadedEvents) ? loadedEvents : []);
        setAliases(Array.isArray(loadedAliases) ? loadedAliases : []);
        setStores(Array.isArray(loadedStores) ? loadedStores : []);
        setDbHealth({
          status: health.status === 'connected' ? 'connected' : 'fallback',
          latencyMs: health.latencyMs || 8,
          database:
            health.status === 'connected'
              ? 'MongoDB Atlas Connected (Live)'
              : 'Mock DB Fallback (Offline)',
        });
      } catch {
        // Safe fallback guaranteed
      }

      // Initial fast live server sync
      const reqSeq = ++syncSeqRef.current;
      try {
        const liveRes = await fetch('/api/sync/live', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
        });
        const contentType = liveRes.headers.get('content-type') || '';
        if (liveRes.ok && contentType.includes('application/json')) {
          const liveData = await liveRes.json();
          if (reqSeq >= latestAppliedSyncSeqRef.current) {
            latestAppliedSyncSeqRef.current = reqSeq;
            if (Array.isArray(liveData.orders)) {
              setOrders(liveData.orders);
            }
            if (Array.isArray(liveData.waybills)) {
              setWaybills(liveData.waybills);
            }
            if (Array.isArray(liveData.webhookEvents)) {
              setWebhookEvents(liveData.webhookEvents);
            }
            if (Array.isArray(liveData.stores)) {
              setStores(liveData.stores);
            }
            if (liveData.dbStatus) {
              setDbHealth({
                status: liveData.dbStatus === 'connected' ? 'connected' : 'fallback',
                latencyMs: 12,
                database:
                  liveData.databaseEngine ||
                  (liveData.dbStatus === 'connected'
                    ? 'MongoDB Atlas Connected (Live)'
                    : 'Mock DB Fallback (Offline)'),
              });
            }
          }
        }
      } catch {
        // Fallback
      }
    }

    initData();
  }, []);

  // Real-time Server-Sent Events (SSE) listener for instant zero-latency webhook dispatch
  useEffect(() => {
    let eventSource: EventSource | null = null;

    try {
      if (typeof window !== 'undefined' && 'EventSource' in window) {
        eventSource = new EventSource('/api/webhooks/stream');

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'new_order_webhook' || data.type === 'order_saved') {
              if (data.order) {
                setOrders((prev) => [
                  data.order,
                  ...prev.filter(
                    (o) => o.id !== data.order.id && o.invoiceNumber !== data.order.invoiceNumber
                  ),
                ]);
              }
              if (data.waybill) {
                setWaybills((prev) => [
                  data.waybill,
                  ...prev.filter(
                    (w) => w.id !== data.waybill.id && w.trackingNumber !== data.waybill.trackingNumber
                  ),
                ]);
              }
              if (data.event) {
                setWebhookEvents((prev) => [
                  data.event,
                  ...prev.filter((e) => e.id !== data.event.id),
                ]);
              }
            } else if (
              data.type === 'webhook_event_saved' ||
              data.type === 'webhook_ping' ||
              data.type === 'webhook_error' ||
              data.type === 'webhook_skipped'
            ) {
              if (data.event) {
                setWebhookEvents((prev) => [
                  data.event,
                  ...prev.filter((e) => e.id !== data.event.id),
                ]);
              }
            } else if (data.type === 'waybill_saved' && data.waybill) {
              setWaybills((prev) => [
                data.waybill,
                ...prev.filter(
                  (w) => w.id !== data.waybill.id && w.trackingNumber !== data.waybill.trackingNumber
                ),
              ]);
            } else if (data.type === 'events_cleared') {
              if (Array.isArray(data.webhookEvents)) {
                setWebhookEvents(data.webhookEvents);
              }
            } else if (data.type === 'order_status_updated' && data.status) {
              const targetIds = [data.orderId, data.uber_order_id]
                .filter(Boolean)
                .map((v: unknown) => String(v).replace(/^#/, '').trim().toLowerCase());
              const nextStatus = data.status as Order['status'];
              if (targetIds.length > 0) {
                const nowMs = Date.now();
                latestAppliedSyncSeqRef.current = ++syncSeqRef.current;
                for (const k of targetIds) {
                  optimisticStatusMapRef.current[k] = { status: nextStatus, setAt: nowMs };
                }
                const matchesIds = (item: any) => {
                  const vals = [
                    item?.id,
                    item?.orderId,
                    item?.order_id,
                    item?.uberOrderId,
                    item?.uber_order_id,
                    item?.orderNumber,
                    item?.invoiceNumber,
                    item?.display_id,
                  ]
                    .filter(Boolean)
                    .map((v: unknown) => String(v).replace(/^#/, '').trim().toLowerCase());
                  return vals.some((v: string) => targetIds.includes(v));
                };
                setOrders((prev) =>
                  prev.map((o) =>
                    matchesIds(o)
                      ? ({
                          ...o,
                          status: nextStatus,
                          uberStatus: nextStatus,
                          orderStatus: nextStatus,
                        } as Order)
                      : o
                  )
                );
                setWebhookEvents((prev) =>
                  prev.map((ev) =>
                    matchesIds(ev)
                      ? ({ ...ev, orderStatus: nextStatus, uberStatus: nextStatus } as WebhookEvent)
                      : ev
                  )
                );
              }
            }
          } catch {
            // Ignore non-json
          }
        };
      }
    } catch {
      // EventSource fallback to polling
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  const applyStatusOverrides = React.useCallback(
    <T extends Record<string, any>>(list: T[], isEvent = false): T[] => {
      const map = optimisticStatusMapRef.current;
      if (!map || Object.keys(map).length === 0) return list;

      const now = Date.now();
      for (const [k, entry] of Object.entries(map)) {
        if (!entry || now - entry.setAt > 4000) {
          delete map[k];
        }
      }
      if (Object.keys(map).length === 0) return list;

      return list.map((item) => {
        const vals = [
          item?.id,
          item?._id,
          item?.orderId,
          item?.order_id,
          item?.uberOrderId,
          item?.uber_order_id,
          item?.orderNumber,
          item?.invoiceNumber,
          item?.invoiceRef,
          item?.reference,
          item?.display_id,
          item?.eventId,
        ];
        const serverStatus = String(
          isEvent ? item?.uberStatus || item?.orderStatus || '' : item?.uberStatus || item?.status || ''
        )
          .trim()
          .toUpperCase();
        const serverUpdatedMs = item?.updatedAt ? Date.parse(String(item.updatedAt)) : NaN;

        for (const v of vals) {
          const norm = String(v || '').replace(/^#/, '').trim().toLowerCase();
          if (!norm) continue;
          const stripped = norm.replace(/^uber-/i, '');
          const matchedKey = map[norm] ? norm : map[stripped] ? stripped : '';
          const entry = matchedKey ? map[matchedKey] : undefined;
          if (!entry) continue;

          // If server already reflects the same status or has a newer updatedAt, clear override
          if (
            serverStatus === String(entry.status).trim().toUpperCase() ||
            (!Number.isNaN(serverUpdatedMs) && serverUpdatedMs > entry.setAt + 250)
          ) {
            delete map[matchedKey];
            return item;
          }

          return isEvent
            ? ({ ...item, orderStatus: entry.status, uberStatus: entry.status } as T)
            : ({ ...item, status: entry.status, uberStatus: entry.status, orderStatus: entry.status } as T);
        }
        return item;
      });
    },
    []
  );

  const syncServerData = React.useCallback(
    async (force = false) => {
      if (!force && typeof document !== 'undefined' && document.hidden) return;
      if (!force && Date.now() < rateLimitUntilRef.current) return;
      if (!force && isSyncingRef.current) return;

      isSyncingRef.current = true;
      const reqSeq = ++syncSeqRef.current;

      try {
        const start = Date.now();
        const res = await fetch('/api/sync/live', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
        });
        if (res.status === 429) {
          rateLimitUntilRef.current = Date.now() + 30_000;
          return;
        }
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          const latency = Date.now() - start;

          if (data.dbStatus) {
            setDbHealth({
              status: data.dbStatus === 'connected' ? 'connected' : 'fallback',
              latencyMs: latency,
              database:
                data.databaseEngine ||
                (data.dbStatus === 'connected'
                  ? 'MongoDB Atlas Connected (Live)'
                  : 'Mock DB Fallback (Offline)'),
            });
          }

          if (!res.ok) return;

          // Drop stale out-of-order responses that finished after a newer request/action
          if (reqSeq < latestAppliedSyncSeqRef.current) return;
          latestAppliedSyncSeqRef.current = reqSeq;

          if (Array.isArray(data.orders)) {
            setOrders(applyStatusOverrides(data.orders, false));
          }

          if (Array.isArray(data.products) && data.products.length > 0) {
            setProducts(data.products);
          }

          if (Array.isArray(data.stores) && data.stores.length > 0) {
            setStores(data.stores);
          }

          if (Array.isArray(data.waybills)) {
            setWaybills(data.waybills);
          }

          if (Array.isArray(data.webhookEvents)) {
            setWebhookEvents(applyStatusOverrides(data.webhookEvents, true));
          }
        }
      } catch {
        // Keep current state
      } finally {
        isSyncingRef.current = false;
      }
    },
    [applyStatusOverrides]
  );

  // Authoritative MongoDB-backed live polling every 3s + immediate sync on tab focus/resume
  useEffect(() => {
    const intervalId = setInterval(() => {
      void syncServerData(false);
    }, 3000);

    const handleResumeSync = () => {
      if (typeof document === 'undefined' || !document.hidden) {
        void syncServerData(true);
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleResumeSync);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleResumeSync);
      window.addEventListener('online', handleResumeSync);
    }

    return () => {
      clearInterval(intervalId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleResumeSync);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleResumeSync);
        window.removeEventListener('online', handleResumeSync);
      }
    };
  }, [syncServerData]);

  // Handlers for Orders & POS Invoicing
  const handleCreateOrder = async (newOrder: Order) => {
    setOrders((prev) => [newOrder, ...prev]);
    await saveOrder(newOrder);

    // Refresh products to reflect stock decrement
    const updatedProducts = await getProducts();
    setProducts(updatedProducts);

  };

  const handleUpdateOrder = async (id: string, updates: Partial<Order>) => {
    const updated = await updateOrder(id, updates);
    if (updated) {
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)));
    }
  };

  const handleDeleteOrder = async (id: string) => {
    await deleteOrder(id);
    setOrders((prev) => prev.filter((o) => o.id !== id));
  };

  // Process Return & Automatically Restore Stock
  const handleProcessReturn = async (orderId: string, itemSkus?: string[], reason?: string) => {
    const result = await processOrderReturn(orderId, itemSkus, reason);
    if (result.success && result.order) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? result.order! : o)));
      // Refresh products to reflect restored stock
      const refreshedProds = await getProducts();
      setProducts(refreshedProds);
    }
  };

  // Handlers for Products & Auto-Restock Backlog
  const handleAddProduct = async (product: Product) => {
    setProducts((prev) => [product, ...prev]);
    await saveProduct(product);
    // Refresh products and orders to reflect auto-deductions from backlog
    const [refreshedProds, refreshedOrders] = await Promise.all([getProducts(), getOrders()]);
    setProducts(refreshedProds);
    setOrders(refreshedOrders);
  };

  const handleUpdateProduct = async (id: string, updates: Partial<Product>) => {
    const updated = await updateProduct(id, updates);
    if (updated) {
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    }
    const [refreshedProds, refreshedOrders] = await Promise.all([getProducts(), getOrders()]);
    setProducts(refreshedProds);
    setOrders(refreshedOrders);
  };

  const handleRestockProduct = async (
    sku: string,
    addedStore: number,
    addedWarehouse: number,
    costPrice?: number,
    grnBatch?: string,
    supplier?: string,
    productId?: string
  ) => {
    const res = await restockProduct(sku, addedStore, addedWarehouse, costPrice, grnBatch, supplier, productId);
    if (res?.resolvedOrders && res.resolvedOrders.length > 0) {
      const resolvedMap = new Map(res.resolvedOrders.map((o) => [o.id, o]));
      setOrders((prev) => prev.map((o) => resolvedMap.get(o.id) || o));
    }
    if (res?.product) {
      setProducts((prev) =>
        prev.map((p) =>
          p.sku === res.product!.sku || p.id === res.product!.id ? { ...p, ...res.product! } : p
        )
      );
    }
    const [refreshedProds, refreshedOrders] = await Promise.all([getProducts(), getOrders()]);
    if (Array.isArray(refreshedProds) && refreshedProds.length > 0) {
      setProducts(refreshedProds);
    }
    if (Array.isArray(refreshedOrders)) {
      setOrders(refreshedOrders);
    }
    return res;
  };

  // Handlers for Multi-Channel Product Aliases
  const handleSaveAlias = async (alias: ProductAlias) => {
    await saveProductAlias(alias);
    const refreshed = await getProductAliases();
    setAliases(refreshed);
  };

  const handleDeleteAlias = async (id: string) => {
    await deleteProductAlias(id);
    const refreshed = await getProductAliases();
    setAliases(refreshed);
  };

  // Handlers for Multi-Store Branch Mappings (Uber Eats & PickMe)
  const handleSaveStore = async (store: StoreMapping) => {
    await saveStoreMapping(store);
    const refreshed = await getStoreMappings();
    setStores(refreshed);
  };

  const handleDeleteStore = async (id: string) => {
    await deleteStoreMapping(id);
    const refreshed = await getStoreMappings();
    setStores(refreshed);
  };

  const handleDeleteProduct = async (id: string) => {
    await deleteProduct(id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleLoadSampleProducts = async () => {
    for (const p of SAMPLE_PRODUCTS) {
      await saveProduct(p);
    }
    const refreshed = await getProducts();
    setProducts(refreshed);
  };

  // Handlers for Logistics & Waybills
  const handleUpdateWaybillStatus = async (
    id: string,
    status: TransExpressWaybill['status']
  ) => {
    setWaybills((prev) => prev.map((w) => (w.id === id ? { ...w, status } : w)));
    await updateWaybill(id, { status });
  };

  const handleMarkLabelPrinted = async (id: string) => {
    setWaybills((prev) => prev.map((w) => (w.id === id ? { ...w, labelPrinted: true } : w)));
    await updateWaybill(id, { labelPrinted: true });
  };

  const handleDeleteWaybill = async (id: string) => {
    await deleteWaybill(id);
    setWaybills((prev) => prev.filter((w) => w.id !== id && w.trackingNumber !== id));
  };

  // Handlers for Warranty & SMS
  const handleAddWarranty = async (record: WarrantyRecord) => {
    setWarranties((prev) => [record, ...prev]);
    await saveWarranty(record);
  };

  const handleUpdateWarranty = async (id: string, updates: Partial<WarrantyRecord>) => {
    const updated = await updateWarranty(id, updates);
    if (updated) {
      setWarranties((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates } : w)));
    }
  };

  const handleDeleteWarranty = async (id: string) => {
    await deleteWarranty(id);
    setWarranties((prev) => prev.filter((w) => w.id !== id));
  };

  const handleDispatchSms = (id: string, gateway: 'SMSlenz' | 'Dialog' | 'Mobitel') => {
    const timeStr = `${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString(
      [],
      { hour: '2-digit', minute: '2-digit' }
    )}`;
    setWarranties((prev) =>
      prev.map((w) =>
        w.id === id
          ? { ...w, smsStatus: 'Sent', smsGateway: gateway, lastSmsDate: timeStr }
          : w
      )
    );
  };

  // Handlers for Suppliers & Purchasing
  const handleAddSupplier = async (supplier: Supplier) => {
    setSuppliers((prev) => [supplier, ...prev]);
    await saveSupplier(supplier);
  };

  const handleUpdateSupplier = async (id: string, updates: Partial<Supplier>) => {
    const updated = await updateSupplier(id, updates);
    if (updated) {
      setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    await deleteSupplier(id);
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
  };

  // Handlers for Supplier RMA Claims
  const handleAddRmaClaim = async (claim: SupplierRmaClaim) => {
    setRmaClaims((prev) => [claim, ...prev]);
    await saveSupplierRmaClaim(claim);
  };

  const handleUpdateRmaClaim = async (id: string, updates: Partial<SupplierRmaClaim>) => {
    const updated = await updateSupplierRmaClaim(id, updates);
    if (updated?.claim) {
      setRmaClaims((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
    }
    if (updated?.replacedProduct) {
      const rep = updated.replacedProduct;
      setProducts((prev) => {
        const idx = prev.findIndex((p) => p.sku === rep.sku || p.id === rep.id);
        if (idx !== -1) {
          const copy = [...prev];
          copy[idx] = rep;
          return copy;
        }
        return [rep, ...prev];
      });
    }
    try {
      const refreshedProds = await getProducts();
      if (Array.isArray(refreshedProds) && refreshedProds.length > 0) {
        setProducts(refreshedProds);
      }
      const refreshedWarranties = await getWarranties();
      if (Array.isArray(refreshedWarranties) && refreshedWarranties.length > 0) {
        setWarranties(refreshedWarranties);
      }
    } catch {
      // Safe fallback
    }
  };

  const handleDeleteRmaClaim = async (id: string) => {
    await deleteSupplierRmaClaim(id);
    setRmaClaims((prev) => prev.filter((r) => r.id !== id));
  };

  // Expenses
  const handleAddExpense = async (expense: ExpenseItem) => {
    setExpenses((prev) => [expense, ...prev]);
    await saveExpense(expense);
  };

  const handleDeleteExpense = async (id: string) => {
    await deleteExpense(id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  // Settings: Dynamic Platform & Gateway Fees
  const handleSavePlatforms = async (newPlatforms: PlatformConfig[]) => {
    setPlatforms(newPlatforms);
    await savePlatforms(newPlatforms);
  };

  const handleSaveGateways = async (newGateways: PaymentGatewayConfig[]) => {
    setGateways(newGateways);
    await savePaymentGateways(newGateways);
  };

  const handleSaveApiConfig = async (newConfig: ApiIntegrationConfig) => {
    const saved = await saveApiConfig(newConfig);
    setApiConfig(saved);
  };

  // Webhook Live Testing & Event Handlers
  const handleTriggerTestOrder = async (status: 'processing' | 'pending' = 'processing') => {
    try {
      const res = await fetch('/api/orders/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulate: true, status }),
      });
      if (res.ok) {
        const liveRes = await fetch('/api/sync/live', { cache: 'no-store' });
        if (liveRes.ok) {
          const liveData = await liveRes.json();
          if (Array.isArray(liveData.orders)) {
            setOrders(liveData.orders);
          }
          if (Array.isArray(liveData.waybills)) {
            setWaybills(liveData.waybills);
          }
          if (Array.isArray(liveData.webhookEvents)) {
            setWebhookEvents(liveData.webhookEvents);
          }
        }
      }
    } catch {
      // Graceful fallback
    }
  };

  const handleRefreshWebhookEvents = async () => {
    try {
      const liveRes = await fetch('/api/sync/live', { cache: 'no-store' });
      if (liveRes.ok) {
        const liveData = await liveRes.json();
        if (Array.isArray(liveData.orders)) {
          setOrders(liveData.orders);
        }
        if (Array.isArray(liveData.waybills)) {
          setWaybills(liveData.waybills);
        }
        if (Array.isArray(liveData.webhookEvents)) {
          setWebhookEvents(liveData.webhookEvents);
        }
      }
    } catch {
      // Graceful fallback
    }
  };

  const handleSyncOrderStatus = (rawOrder: any, nextStatus: Order['status']) => {
    const normalizeId = (val: unknown): string =>
      String(val || '')
        .replace(/^#/, '')
        .trim()
        .toLowerCase();

    const extractKeys = (item: any): string[] => {
      const rawVals = [
        item?.id,
        item?._id,
        item?.orderId,
        item?.order_id,
        item?.uberOrderId,
        item?.uber_order_id,
        item?.orderNumber,
        item?.invoiceNumber,
        item?.invoiceRef,
        item?.reference,
        item?.display_id,
        item?.eventId,
      ];
      const keys: string[] = [];
      for (const val of rawVals) {
        const norm = normalizeId(val);
        if (!norm) continue;
        keys.push(norm);
        const strippedUber = norm.replace(/^uber-/i, '');
        if (strippedUber && strippedUber !== norm) keys.push(strippedUber);
      }
      return keys;
    };

    const targetKeys = extractKeys(rawOrder);
    if (targetKeys.length === 0) return;

    const nowMs = Date.now();
    latestAppliedSyncSeqRef.current = ++syncSeqRef.current;
    for (const k of targetKeys) {
      optimisticStatusMapRef.current[k] = { status: nextStatus, setAt: nowMs };
    }

    const matchesTarget = (item: any) => {
      if (item === rawOrder) return true;
      const itemKeys = extractKeys(item);
      return itemKeys.some((k) => targetKeys.includes(k));
    };

    setOrders((prev) =>
      prev.map((item) =>
        matchesTarget(item)
          ? ({
              ...item,
              status: nextStatus,
              uberStatus: nextStatus,
              orderStatus: nextStatus,
            } as Order)
          : item
      )
    );

    setWebhookEvents((prev) =>
      prev.map((item) =>
        matchesTarget(item)
          ? ({
              ...item,
              orderStatus: nextStatus,
              uberStatus: nextStatus,
            } as WebhookEvent)
          : item
      )
    );
  };

  const handleAcceptUberEatsOrder = async (rawOrder: any, reason?: string) => {
    const targetOrderId = String(
      rawOrder?.uber_order_id ||
        rawOrder?.uberOrderId ||
        rawOrder?.orderId ||
        rawOrder?.order_id ||
        rawOrder?.eventId ||
        rawOrder?.orderNumber ||
        rawOrder?.invoiceNumber ||
        rawOrder?.id ||
        rawOrder?._id ||
        ''
    )
      .replace(/^#/, '')
      .trim();

    if (!targetOrderId) {
      return {
        ok: false,
        synced: false,
        uberStatusCode: 400,
        error: 'Valid Uber Eats Order ID not found for this order.',
      };
    }

    const result = await acceptUberEatsOrderAction({
      orderId: targetOrderId,
      storeId: rawOrder?.storeId || rawOrder?.externalStoreId,
      reason,
    });

    if (result.ok && result.synced && (result.uberStatusCode === 204 || result.uberStatus === 204)) {
      handleSyncOrderStatus(rawOrder, (result.status || 'ACCEPTED') as Order['status']);
      void syncServerData(true);
    }

    return result;
  };

  const handleClearWebhookEvents = async () => {
    try {
      await fetch('/api/sync/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_events' }),
      });
      const liveRes = await fetch('/api/sync/live', { cache: 'no-store' });
      if (liveRes.ok) {
        const liveData = await liveRes.json();
        if (Array.isArray(liveData.webhookEvents)) {
          setWebhookEvents(liveData.webhookEvents);
        }
      }
    } catch {
      // Graceful fallback
    }
  };

  // Count active credit customers with balance due
  const creditUnsettledCount = orders.filter((o) => {
    const isCredit =
      o.isCreditSale ||
      o.paymentGateway === 'credit' ||
      (o.balanceDue !== undefined && o.balanceDue > 0);
    const gross = Number(o.grossTotal || 0);
    const paid = Number(o.advancePaid || 0);
    const bal = o.balanceDue !== undefined ? Number(o.balanceDue) : Math.max(0, gross - paid);
    return isCredit && bal > 0;
  }).length;

  // Nav menu
  const navItems = [
    { id: 'dashboard', label: 'Sales & Analytics', icon: LayoutDashboard },
    {
      id: 'pos',
      label: 'POS & Invoices',
      icon: ShoppingCart,
      badge: orders.length,
    },
    {
      id: 'credit',
      label: 'Credit Customers (AR)',
      icon: Users,
      badge: creditUnsettledCount || undefined,
    },
    { id: 'products', label: 'Inventory & Valuation', icon: Barcode },
    {
      id: 'suppliers',
      label: 'Suppliers & Purchasing',
      icon: Building2,
      badge: suppliers.length || undefined,
    },
    {
      id: 'waybills',
      label: 'Trans Express Logistics',
      icon: Truck,
      badge: waybills.filter((w) => w.status === 'Queued').length || undefined,
    },
    {
      id: 'warranty',
      label: 'Warranty & RMA Claims',
      icon: ShieldCheck,
      badge: rmaClaims.filter((r) => r.status === 'Pending with Supplier').length || undefined,
    },
    { id: 'expenses', label: 'Financials Ledger', icon: DollarSign },
    { id: 'sms', label: 'SMS Marketing & CRM', icon: MessageSquare },
    { id: 'integrations', label: 'API & Courier Integrations', icon: KeyRound },
    { id: 'settings', label: 'Dynamic Fee Engine', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col antialiased transition-colors duration-200 selection:bg-[var(--accent-primary)]/20">
      {/* Top Bar Contract: 3 zones */}
      <header className="h-16 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur-xl sticky top-0 z-40 px-4 lg:px-8 flex items-center justify-between shadow-sm">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] lg:hidden transition-colors"
            aria-label="Toggle navigation"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Brand / Logo Section */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-primary)] text-white font-bold flex items-center justify-center shadow-sm">
              W
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-wide text-[var(--text-primary)] leading-tight whitespace-nowrap shrink-0">
                WOWTEK
              </h1>
              <p className="text-[11px] text-[var(--text-secondary)] font-medium">Order Management System</p>
            </div>
          </div>
        </div>

        {/* Zone 2: Navigation Breadcrumb */}
        <div className="hidden md:flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span>Enterprise</span>
          <ChevronRight className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          <span className="font-semibold capitalize bg-[var(--bg-subtle)] text-[var(--accent-primary)] px-2.5 py-0.5 rounded-md border border-[var(--border-subtle)] whitespace-nowrap">
            {navItems.find((n) => n.id === activeTab)?.label}
          </span>
        </div>

        {/* Zone 3: Theme Switcher, Database & Hub Info */}
        <div className="flex items-center gap-3">
          <ThemeSwitcher />

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                dbHealth.status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="font-mono text-[var(--text-primary)] text-[11px] whitespace-nowrap">
              {dbHealth.status === 'connected'
                ? 'MongoDB Atlas Connected (Live)'
                : 'Mock DB Fallback (Offline)'}
            </span>
          </div>

          <div className="text-right hidden sm:block shrink-0">
            <div className="text-xs font-semibold text-[var(--text-primary)] whitespace-nowrap">Colombo Hub</div>
            <div className="text-[10px] text-[var(--text-secondary)] font-mono">LKR Sri Lanka</div>
          </div>
        </div>
      </header>

      {/* Main Layout Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Nav */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] transition-transform duration-200 lg:static lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } flex flex-col justify-between`}
        >
          <div>
            {/* Brand / Logo Section in Sidebar (Mobile View) */}
            <div className="flex items-center space-x-3 px-6 py-5 border-b border-[var(--border-subtle)] lg:hidden">
              <div className="w-9 h-9 rounded-xl bg-[var(--accent-primary)] text-white font-bold flex items-center justify-center shadow-sm">
                W
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-wide text-[var(--text-primary)]">WOWTEK</h1>
                <p className="text-xs text-[var(--text-secondary)]">Order Management System</p>
              </div>
            </div>

            <div className="p-4 space-y-1">
              <div className="px-3 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Management Modules
              </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[var(--text-secondary)]'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-semibold shrink-0 ${
                        isActive
                          ? 'bg-white/20 text-white border border-white/30'
                          : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
            </div>
          </div>

          {/* Theme Switcher & Quick Rates Banner */}
          <div className="p-4 pt-0 space-y-3">
            <div className="p-1 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => handleSetTheme('warm-daylight')}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap cursor-pointer ${
                  theme === 'warm-daylight'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm border border-[var(--border-subtle)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Daylight</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetTheme('midnight-emerald')}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap cursor-pointer ${
                  theme === 'midnight-emerald'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm border border-[var(--border-subtle)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Midnight</span>
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs space-y-1">
              <div className="flex items-center justify-between text-[var(--text-secondary)] text-[10px]">
                <span className="font-semibold text-[var(--text-primary)]">ACTIVE FEE RATES</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </div>
              <div className="text-[11px] text-[var(--text-primary)] font-mono">
                PickMe: {platforms.find((p) => p.code === 'pickme')?.feePercent ?? 20}% · Uber: {platforms.find((p) => p.code === 'ubereats')?.feePercent ?? 15.4}%
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] font-mono">
                Payzy/Koko/Mintpay: 12% · Cash: 0%
              </div>
            </div>
          </div>
        </aside>

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[var(--bg-app)] transition-colors duration-200">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'dashboard' && (
              <DashboardTab
                orders={orders}
                waybills={waybills}
                products={products}
                warranties={warranties}
                expenses={expenses}
                webhookEvents={webhookEvents}
                dbStatus={dbHealth}
                stores={stores}
                onNavigateTab={(tab) => setActiveTab(tab)}
                onRefreshWebhookEvents={handleRefreshWebhookEvents}
                onClearWebhookEvents={handleClearWebhookEvents}
                onTriggerTestOrder={handleTriggerTestOrder}
                onRestockProduct={handleRestockProduct}
                onOrderStatusSync={handleSyncOrderStatus}
                onAcceptUberEatsOrder={handleAcceptUberEatsOrder}
                onRefreshLiveSync={() => syncServerData(true)}
              />
            )}

            {activeTab === 'pos' && (
              <PosTab
                products={products}
                orders={orders}
                platforms={platforms}
                gateways={gateways}
                onCreateOrder={handleCreateOrder}
                onUpdateOrder={handleUpdateOrder}
                onDeleteOrder={handleDeleteOrder}
                onProcessReturn={handleProcessReturn}
                onAddProduct={handleAddProduct}
                onLoadSampleProducts={handleLoadSampleProducts}
              />
            )}

            {activeTab === 'credit' && (
              <CreditCustomersTab
                orders={orders}
                onUpdateOrder={handleUpdateOrder}
                onNavigateTab={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === 'products' && (
              <ProductsTab
                products={products}
                orders={orders}
                suppliers={suppliers}
                onAddProduct={handleAddProduct}
                onUpdateProduct={handleUpdateProduct}
                onDeleteProduct={handleDeleteProduct}
                onLoadSampleProducts={handleLoadSampleProducts}
                onRestockProduct={handleRestockProduct}
              />
            )}

            {activeTab === 'suppliers' && (
              <SuppliersTab
                suppliers={suppliers}
                products={products}
                rmaClaims={rmaClaims}
                onAddSupplier={handleAddSupplier}
                onUpdateSupplier={handleUpdateSupplier}
                onDeleteSupplier={handleDeleteSupplier}
                onNavigateTab={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === 'waybills' && (
              <WaybillsTab
                waybills={waybills}
                orders={orders}
                products={products}
                webhookEvents={webhookEvents}
                onUpdateWaybillStatus={handleUpdateWaybillStatus}
                onMarkLabelPrinted={handleMarkLabelPrinted}
                onRefreshWebhookEvents={handleRefreshWebhookEvents}
                onClearWebhookEvents={handleClearWebhookEvents}
                onTriggerTestOrder={handleTriggerTestOrder}
                onDeleteWaybill={handleDeleteWaybill}
                onOrderStatusSync={handleSyncOrderStatus}
              />
            )}

            {activeTab === 'warranty' && (
              <WarrantyTab
                warranties={warranties}
                products={products}
                suppliers={suppliers}
                rmaClaims={rmaClaims}
                onAddWarranty={handleAddWarranty}
                onUpdateWarranty={handleUpdateWarranty}
                onDispatchSms={handleDispatchSms}
                onAddRmaClaim={handleAddRmaClaim}
                onUpdateRmaClaim={handleUpdateRmaClaim}
                onDeleteRmaClaim={handleDeleteRmaClaim}
              />
            )}

            {activeTab === 'expenses' && (
              <ExpensesTab expenses={expenses} orders={orders} onAddExpense={handleAddExpense} />
            )}

            {activeTab === 'sms' && (
              <SMSMarketingTab />
            )}

            {activeTab === 'integrations' && apiConfig && (
              <IntegrationsTab
                apiConfig={apiConfig}
                onSaveConfig={handleSaveApiConfig}
                products={products}
                aliases={aliases}
                stores={stores}
                onSaveAlias={handleSaveAlias}
                onDeleteAlias={handleDeleteAlias}
                onSaveStore={handleSaveStore}
                onDeleteStore={handleDeleteStore}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsTab
                platforms={platforms}
                gateways={gateways}
                onSavePlatforms={handleSavePlatforms}
                onSaveGateways={handleSaveGateways}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
