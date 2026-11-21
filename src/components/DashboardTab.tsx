'use client';

import React from 'react';
import {
  TrendingUp,
  Package,
  Truck,
  ShieldCheck,
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  ArrowUpRight,
  Database,
  Building2,
  Clock,
  RotateCcw,
  FileText,
  Printer,
  PlusCircle,
  CheckCircle2,
  X,
  RefreshCw,
} from 'lucide-react';
import { Order, Product, TransExpressWaybill, WarrantyRecord, ExpenseItem, WebhookEvent, StoreMapping } from '@/types';
import { WebhookAuditLogSection } from './WebhookAuditLogSection';
import { A4WarrantyInvoiceModal } from './A4WarrantyInvoiceModal';
import { ThermalWaybillModal } from './ThermalWaybillModal';
import { RestockGRNForm } from '@/components/GRNForms';

interface DashboardTabProps {
  orders: Order[];
  waybills: TransExpressWaybill[];
  products?: Product[];
  warranties: WarrantyRecord[];
  expenses: ExpenseItem[];
  webhookEvents?: WebhookEvent[];
  dbStatus: { status: 'connected' | 'fallback'; latencyMs: number; database: string };
  stores?: StoreMapping[];
  onNavigateTab: (tab: string) => void;
  onRefreshWebhookEvents?: () => void;
  onClearWebhookEvents?: () => void;
  onTriggerTestOrder?: () => Promise<void>;
  onRestockProduct?: (
    sku: string,
    addedStore: number,
    addedWarehouse: number,
    costPrice?: number,
    grnBatch?: string,
    supplier?: string
  ) => Promise<any>;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  orders,
  waybills,
  products = [],
  warranties,
  expenses,
  webhookEvents = [],
  dbStatus,
  stores = [],
  onNavigateTab,
  onRefreshWebhookEvents,
  onClearWebhookEvents,
  onTriggerTestOrder,
  onRestockProduct,
}) => {
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = React.useState<Order | null>(null);
  const [selectedOrderForThermalPrint, setSelectedOrderForThermalPrint] = React.useState<Order | null>(null);
  const [selectedUberOrder, setSelectedUberOrder] = React.useState<Order | null>(null);

  // Quick Restock state from backlog
  const [quickRestockItem, setQuickRestockItem] = React.useState<{
    sku: string;
    name: string;
    suggestedCost: number;
  } | null>(null);
  const [restockStoreQty, setRestockStoreQty] = React.useState(10);
  const [restockWarehouseQty, setRestockWarehouseQty] = React.useState(0);
  const [restockCostPrice, setRestockCostPrice] = React.useState<number | ''>(4200);
  const [restockBatch, setRestockBatch] = React.useState(`GRN-${new Date().getFullYear()}-RESTOCK`);
  const [restockSupplier, setRestockSupplier] = React.useState('WOWTEK Direct Import');
  const [restockLoading, setRestockLoading] = React.useState(false);
  const [restockSuccessMsg, setRestockSuccessMsg] = React.useState<string | null>(null);

  const [orderActionLoading, setOrderActionLoading] = React.useState<string | null>(null);
  const [orderActionToast, setOrderActionToast] = React.useState<{ message: string; isError: boolean } | null>(null);
  const [confirmingReturnOrderId, setConfirmingReturnOrderId] = React.useState<string | null>(null);

  // Auto-refresh orders polling (15-second interval with rate-limit backoff)
  const [liveOrders, setLiveOrders] = React.useState<Order[]>(orders || []);
  const isFetchingOrdersRef = React.useRef(false);
  const rateLimitUntilRef = React.useRef(0);

  const fetchOrders = React.useCallback(async (force = false) => {
    if (typeof document !== 'undefined' && document.hidden && !force) return;
    if (!force && Date.now() < rateLimitUntilRef.current) return;
    if (isFetchingOrdersRef.current) return;

    isFetchingOrdersRef.current = true;
    try {
      const res = await fetch('/api/orders', { cache: 'no-store' }); // ඔයාගේ orders ගන්න API එක
      if (res.status === 429) {
        rateLimitUntilRef.current = Date.now() + 30_000;
        return;
      }

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        const rawText = await res.text().catch(() => '');
        if (rawText.toLowerCase().includes('rate exceeded')) {
          rateLimitUntilRef.current = Date.now() + 30_000;
          return;
        }
        console.warn(`Orders fetch returned non-JSON (${res.status}):`, rawText.slice(0, 120));
        return;
      }

      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.orders || []);
      if (Array.isArray(list) && list.length > 0) {
        setLiveOrders(list);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      isFetchingOrdersRef.current = false;
    }
  }, []);

  React.useEffect(() => {
    const interval = setInterval(() => {
      void fetchOrders(false);
    }, 15000);

    return () => clearInterval(interval);
  }, [fetchOrders]);

  React.useEffect(() => {
    setLiveOrders(orders || []);
  }, [orders]);

  type UberOrderActionTarget = {
    uber_order_id?: string;
    orderId?: string;
    id?: string;
    display_id?: string;
    storeId?: string;
    externalStoreId?: string;
  };

  const getUberTargetOrderId = (order?: UberOrderActionTarget | null): string =>
    String(order?.uber_order_id || order?.orderId || order?.id || '').trim();

  // ඕනෑම තැනක (Table හෝ Card) Accept / Ready / Cancel සඳහා එකම function එක
  const handleOrderAction = async (
    action: 'accept' | 'ready' | 'cancel',
    order: UberOrderActionTarget
  ) => {
    // අනිවාර්යයෙන්ම දිග UUID එක ගන්න (display_id නොවේ)
    const targetOrderId = getUberTargetOrderId(order);

    if (!targetOrderId) {
      console.error('Missing uber_order_id for order:', order);
      setOrderActionToast({
        message: 'මෙම order එකට valid Uber Order UUID එකක් නැත.',
        isError: true,
      });
      setTimeout(() => setOrderActionToast(null), 5000);
      return;
    }

    setOrderActionLoading(`${targetOrderId}-${action}`);
    try {
      const res = await fetch('/api/orders/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          order_id: targetOrderId,
          storeId: order.storeId || order.externalStoreId,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        const nextStatus =
          data.status ||
          (action === 'accept' ? 'Processing' : action === 'ready' ? 'READY_FOR_PICKUP' : 'Cancelled');
        setLiveOrders((prev) =>
          (prev || []).map((o) => {
            const anyO = o as any;
            const matches =
              o.id === targetOrderId ||
              anyO.orderId === targetOrderId ||
              anyO.uber_order_id === targetOrderId;
            return matches ? { ...o, status: nextStatus } : o;
          })
        );

        console.log(`Action [${action}] success for ${targetOrderId}:`, data);
        setOrderActionToast({
          message: data.message || `Order successfully ${action}ed!`,
          isError: false,
        });
        setTimeout(() => setOrderActionToast(null), 4000);
        if (typeof window !== 'undefined') {
          await fetchOrders(true); // අලුත් status ("Processing" / "Ready" / "Cancelled") එක වහාම ගන්න
        }
        return;
      }

      console.error(`Action [${action}] failed:`, res.status, data);
      setOrderActionToast({
        message: `Failed (${res.status}): ${data.error || 'Action failed'}`,
        isError: true,
      });
      setTimeout(() => setOrderActionToast(null), 5000);
    } catch (err) {
      console.error('Network/Client error on action:', err);
      setOrderActionToast({
        message: 'Server එකට connect වීමට නොහැකි විය.',
        isError: true,
      });
      setTimeout(() => setOrderActionToast(null), 5000);
    } finally {
      setOrderActionLoading(null);
    }
  };

  const handleReturnOrder = async (orderId: string) => {
    setOrderActionLoading(`${orderId}-return`);
    try {
      const res = await fetch('/api/orders/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setConfirmingReturnOrderId(null);
        setOrderActionToast({
          message: 'Return successful and store stock updated!',
          isError: false,
        });
        setTimeout(() => setOrderActionToast(null), 5000);
        await fetchOrders(true);
      } else {
        setOrderActionToast({
          message: `Error: ${data.message || data.error || 'Failed to process return'}`,
          isError: true,
        });
        setTimeout(() => setOrderActionToast(null), 5000);
      }
    } catch (err: unknown) {
      setOrderActionToast({
        message: `Error: ${err instanceof Error ? err.message : 'Network error'}`,
        isError: true,
      });
      setTimeout(() => setOrderActionToast(null), 5000);
    } finally {
      setOrderActionLoading(null);
    }
  };

  // Defensive array bindings
  const safeOrders = (liveOrders && liveOrders.length > 0 ? liveOrders : orders) || [];
  const safeWaybills = waybills || [];
  const safeWarranties = warranties || [];
  const safeExpenses = expenses || [];
  const safeWebhookEvents = webhookEvents || [];

  // Financial computations (PREVENT FAKE PROFIT DISPLAY)
  const totalGrossRevenue = safeOrders
    .filter((o) => o && o.status !== 'Returned')
    .reduce((sum, o) => sum + (o?.grossTotal || 0), 0);

  // Strictly compute Net Profit from verified orders only
  const verifiedProfitOrders = safeOrders.filter(
    (o) => o && o.status !== 'Returned' && !o.hasUnregisteredItems && o.profitStatus !== 'Pending / Inventory Not Found'
  );
  const totalNetProfit = verifiedProfitOrders.reduce((sum, o) => sum + (o?.netProfit || 0), 0);

  const pendingProfitOrdersCount = safeOrders.filter(
    (o) => o && (o.hasUnregisteredItems || o.profitStatus === 'Pending / Inventory Not Found')
  ).length;

  const pendingBacklogOrders = safeOrders.filter(
    (o) =>
      o &&
      (o.hasUnregisteredItems === true ||
        o.profitStatus === 'Pending / Inventory Not Found' ||
        o.status === 'Pending')
  );

  const handleOpenQuickRestock = (item: { sku: string; name: string; suggestedCost: number }) => {
    setQuickRestockItem(item);
    setRestockStoreQty(10);
    setRestockWarehouseQty(5);
    setRestockCostPrice(item.suggestedCost > 0 ? item.suggestedCost : 4200);
    setRestockBatch(`GRN-${new Date().getFullYear()}-OCT-${Math.floor(100 + Math.random() * 900)}`);
  };

  const handleExecuteRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickRestockItem || !onRestockProduct) return;
    setRestockLoading(true);
    try {
      const res = await onRestockProduct(
        quickRestockItem.sku,
        restockStoreQty,
        restockWarehouseQty,
        typeof restockCostPrice === 'number' ? restockCostPrice : 0,
        restockBatch,
        restockSupplier
      );
      setQuickRestockItem(null);
      setRestockSuccessMsg(
        res?.message ||
          `GRN Restock processed for ${quickRestockItem.sku}! Pending orders auto-deducted and moved to active with verified profits.`
      );
      setTimeout(() => setRestockSuccessMsg(null), 6000);
    } catch (err: any) {
      console.error('Restock error:', err);
    } finally {
      setRestockLoading(false);
    }
  };

  const totalExpenses = safeExpenses.reduce((sum, e) => sum + (e?.amount || 0), 0);
  const totalCommissionsDeducted = safeOrders.reduce(
    (sum, o) => sum + (o?.platformFeeAmount || 0) + (o?.gatewayFeeAmount || 0),
    0
  );

  // Channel breakdown
  const wcOrders = safeOrders.filter((o) => o?.channel === 'woocommerce');
  const pkmOrders = safeOrders.filter((o) => o?.channel === 'pickme');
  const ubrOrders = safeOrders.filter((o) => o?.channel === 'ubereats');
  const posOrders = safeOrders.filter((o) => o?.channel === 'pos' || o?.isPosSale);

  const pendingWaybills = safeWaybills.filter((w) => w?.status === 'Queued' || w?.status === 'Manifested');
  const activeWarranties = safeWarranties.filter((w) => w?.status === 'Active');
  const expiringWarranties = safeWarranties.filter((w) => w?.status === 'Expiring Soon');
  const returnedOrders = safeOrders.filter((o) => o?.status === 'Returned' || o?.status === 'Partially Returned');

  return (
    <div className="space-y-6">
      {/* DB Connectivity & System Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm relative overflow-hidden">
        <div className="flex items-center gap-3 relative">
          <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-primary)]">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-[var(--text-primary)]">Database Engine:</span>
              <span
                className={`text-[11px] px-2.5 py-0.5 rounded-full font-mono font-semibold flex items-center gap-1.5 border border-[var(--border-subtle)] ${
                  dbStatus.status === 'connected'
                    ? 'bg-[var(--badge-ready-bg)] text-[var(--badge-ready-text)]'
                    : 'bg-[var(--badge-pending-bg)] text-[var(--badge-pending-text)]'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${dbStatus.status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                {dbStatus.status === 'connected'
                  ? 'MongoDB Atlas Connected (Live)'
                  : 'Mock DB Fallback (Offline)'}
              </span>
              <span className="text-xs text-[var(--text-secondary)] font-mono">
                {dbStatus.latencyMs}ms latency
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {dbStatus.status === 'connected'
                ? 'MongoDB Atlas live connection established with connection pooling. Real orders and webhooks persisted directly.'
                : 'Offline resilient fallback active. Real WooCommerce orders prioritized.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 relative">
          <button
            onClick={() => onNavigateTab('pos')}
            className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer active:scale-95 whitespace-nowrap"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Open POS Terminal</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Revenue */}
        <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm transition-colors duration-200 hover:border-[var(--accent-primary)]">
          <div className="flex items-center justify-between text-[var(--text-secondary)] text-xs font-medium uppercase tracking-wider mb-2">
            <span>Gross Revenue</span>
            <div className="p-1.5 rounded-xl bg-[var(--bg-subtle)] text-[var(--accent-primary)] border border-[var(--border-subtle)]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[var(--text-primary)]">
            Rs. {totalGrossRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-[var(--text-secondary)] pt-2.5 border-t border-[var(--border-subtle)]">
            <span>{orders.length} total orders / invoices</span>
            <span className="text-[var(--accent-primary)] flex items-center font-semibold">
              +19.2% <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>

        {/* Net Profit */}
        <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm transition-colors duration-200 hover:border-[var(--accent-primary)]">
          <div className="flex items-center justify-between text-[var(--text-secondary)] text-xs font-medium uppercase tracking-wider mb-2">
            <span>Net Operating Profit</span>
            <div className="p-1.5 rounded-xl bg-[var(--badge-ready-bg)] text-[var(--badge-ready-text)] border border-[var(--border-subtle)]">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
            Rs. {totalNetProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          {pendingProfitOrdersCount > 0 ? (
            <div className="mt-2.5 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px]">
              <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1 font-mono">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                <span>{pendingProfitOrdersCount} pending valuation</span>
              </span>
              <span className="text-[var(--text-secondary)] font-mono text-[10px]">Real records only</span>
            </div>
          ) : (
            <div className="flex items-center justify-between mt-3 text-xs text-[var(--text-secondary)] pt-2.5 border-t border-[var(--border-subtle)]">
              <span>After Verified COGS</span>
              <span className="text-[var(--text-primary)] font-mono font-semibold">
                {((totalNetProfit / (totalGrossRevenue || 1)) * 100).toFixed(1)}% margin
              </span>
            </div>
          )}
        </div>

        {/* Courier Queue */}
        <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm transition-colors duration-200 hover:border-[var(--accent-primary)]">
          <div className="flex items-center justify-between text-[var(--text-secondary)] text-xs font-medium uppercase tracking-wider mb-2">
            <span>Trans Express Queue</span>
            <div className="p-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[var(--text-primary)]">
            {pendingWaybills.length}{' '}
            <span className="text-xs font-sans font-normal text-[var(--text-secondary)]">pending</span>
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-[var(--text-secondary)] pt-2.5 border-t border-[var(--border-subtle)]">
            <span>{waybills.length} total shipments</span>
            <button
              onClick={() => onNavigateTab('waybills')}
              className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] transition-colors font-medium cursor-pointer"
            >
              View Queue →
            </button>
          </div>
        </div>

        {/* Warranty & Returns */}
        <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm transition-colors duration-200 hover:border-[var(--accent-primary)]">
          <div className="flex items-center justify-between text-[var(--text-secondary)] text-xs font-medium uppercase tracking-wider mb-2">
            <span>Warranties & Returns</span>
            <div className="p-1.5 rounded-xl bg-[var(--bg-subtle)] text-[var(--accent-primary)] border border-[var(--border-subtle)]">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[var(--text-primary)]">
            {activeWarranties.length}
            {returnedOrders.length > 0 && (
              <span className="ml-2 text-xs font-sans font-normal text-amber-700 dark:text-amber-400">
                ({returnedOrders.length} returns)
              </span>
            )}
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-[var(--text-secondary)] pt-2.5 border-t border-[var(--border-subtle)]">
            <span>SMSlenz automated</span>
            <button
              onClick={() => onNavigateTab('warranty')}
              className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] transition-colors font-medium cursor-pointer"
            >
              Manage →
            </button>
          </div>
        </div>
      </div>

      {/* RESTOCK SUCCESS TOAST BANNER */}
      {restockSuccessMsg && (
        <div className="p-3.5 bg-[var(--badge-ready-bg)] border border-[var(--border-subtle)] text-[var(--badge-ready-text)] rounded-2xl flex items-center justify-between text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">{restockSuccessMsg}</span>
          </div>
          <button
            onClick={() => setRestockSuccessMsg(null)}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* PENDING INVENTORY BACKLOG QUEUE (AUTO-DEDUCTION ENGINE) */}
      {pendingBacklogOrders.length > 0 && (
        <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-amber-300 dark:border-amber-500/30 shadow-sm space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--badge-pending-bg)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--badge-pending-text)]">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Pending / Inventory Not Found Backlog Queue
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[var(--badge-pending-bg)] text-[var(--badge-pending-text)]">
                    {pendingBacklogOrders.length} Backlog Orders
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Orders holding unregistered items or out-of-stock SKUs. When a new GRN / restock occurs, stock will be automatically deducted, warnings cleared, and verified Net Profit updated instantly.
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('products')}
              className="self-start sm:self-auto text-xs text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] font-medium cursor-pointer"
            >
              Open Inventory & GRN →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-subtle)] text-[var(--text-secondary)] uppercase font-mono text-[10px] tracking-wider border-b border-[var(--border-subtle)]">
                <tr>
                  <th className="py-3 px-3.5">Invoice No</th>
                  <th className="py-3 px-3.5">Channel</th>
                  <th className="py-3 px-3.5">Customer</th>
                  <th className="py-3 px-3.5">Backlog Items Waiting for Stock</th>
                  <th className="py-3 px-3.5 text-right">Gross Total</th>
                  <th className="py-3 px-3.5 text-center">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] font-sans">
                {pendingBacklogOrders.map((order) => {
                  const unregItems = (order.items || []).filter(
                    (it) => !it.isRegistered || it.costPrice <= 0
                  );
                  const displayItems = unregItems.length > 0 ? unregItems : order.items || [];

                  return (
                    <tr key={order.id} className="hover:bg-[var(--bg-subtle)]/60 transition-colors">
                      <td className="py-3 px-3.5 font-mono text-[var(--accent-primary)] font-semibold">
                        {order.invoiceNumber}
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="px-2 py-0.5 rounded-md text-[10px] uppercase font-mono bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]">
                          {order.channel}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-[var(--text-primary)]">
                        <div className="font-medium">{order.customerName}</div>
                        <div className="text-[10px] text-[var(--text-secondary)] font-mono">{order.customerPhone}</div>
                      </td>
                      <td className="py-3 px-3.5 space-y-1">
                        {displayItems.map((it, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[var(--badge-pending-text)] font-semibold text-[11px]">
                              {it.sku || 'UNREGISTERED'}
                            </span>
                            <span className="text-[var(--text-secondary)] text-[11px]">
                              &ldquo;{it.name}&rdquo; ({it.quantity} qty)
                            </span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[var(--badge-pending-bg)] text-[var(--badge-pending-text)]">
                              Awaiting GRN
                            </span>
                          </div>
                        ))}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono tabular-nums text-[var(--text-primary)] font-medium">
                        Rs. {(order.grossTotal || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        {displayItems[0] && (
                          <button
                            onClick={() =>
                              handleOpenQuickRestock({
                                sku: displayItems[0].sku || 'WT-RESTOCK',
                                name: displayItems[0].name,
                                suggestedCost: displayItems[0].costPrice || 0,
                              })
                            }
                            className="px-3 py-1 bg-[var(--badge-pending-bg)] hover:opacity-90 border border-amber-400/40 text-[var(--badge-pending-text)] rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                            title="Add stock via Inward GRN to automatically resolve this backlog order"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span>Inward Restock</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Channel Performance & Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Multi-Channel Distribution */}
        <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Dynamic Channel Fees</h3>
              <button
                onClick={() => onNavigateTab('settings')}
                className="text-xs text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] cursor-pointer"
              >
                Edit Fees →
              </button>
            </div>

            <div className="space-y-3">
              {/* POS In-Store */}
              <div className="p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span className="font-medium text-[var(--text-primary)]">In-Store POS Retail</span>
                  </div>
                  <span className="text-[var(--text-secondary)] font-mono">{posOrders.length} sales</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-secondary)]">0% Platform Fee</span>
                  <span className="text-[var(--text-primary)] font-mono tabular-nums font-medium">
                    Rs. {(posOrders || []).reduce((s, o) => s + (o?.grossTotal || 0), 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* PickMe (20%) */}
              <div className="p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span className="font-medium text-[var(--text-primary)]">PickMe Market (20%)</span>
                    {stores.filter((s) => s.platform === 'pickme').length > 0 && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[var(--badge-pending-bg)] text-[var(--badge-pending-text)]">
                        {stores.filter((s) => s.platform === 'pickme' && s.isActive !== false).length} Branches
                      </span>
                    )}
                  </div>
                  <span className="text-[var(--text-secondary)] font-mono">{(pkmOrders || []).length} orders</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-secondary)]">
                    Comm: -Rs. {(pkmOrders || []).reduce((s, o) => s + (o?.platformFeeAmount || 0), 0).toLocaleString()}
                  </span>
                  <span className="text-[var(--text-primary)] font-mono tabular-nums font-medium">
                    Rs. {(pkmOrders || []).reduce((s, o) => s + (o?.grossTotal || 0), 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Uber Eats (15.4%) */}
              <div className="p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="font-medium text-[var(--text-primary)]">Uber Eats Retail (15.4%)</span>
                    {stores.filter((s) => s.platform === 'ubereats').length > 0 && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[var(--badge-ready-bg)] text-[var(--badge-ready-text)]">
                        {stores.filter((s) => s.platform === 'ubereats' && s.isActive !== false).length} Branches
                      </span>
                    )}
                  </div>
                  <span className="text-[var(--text-secondary)] font-mono">{(ubrOrders || []).length} orders</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-secondary)]">
                    Comm: -Rs. {(ubrOrders || []).reduce((s, o) => s + (o?.platformFeeAmount || 0), 0).toLocaleString()}
                  </span>
                  <span className="text-[var(--text-primary)] font-mono tabular-nums font-medium">
                    Rs. {(ubrOrders || []).reduce((s, o) => s + (o?.grossTotal || 0), 0).toLocaleString()}
                  </span>
                </div>

                {/* Live Pending Uber Eats Action Items */}
                {ubrOrders.filter((o) => o?.status === 'Pending' || o?.status === 'PENDING' || o?.status === 'PENDING_ACCEPTANCE' || o?.status === 'Processing' || o?.status === 'ACCEPTED').slice(0, 4).map((order, idx) => {
                  const uberOrder = order as any;
                  const uberOriginalUuid = getUberTargetOrderId(uberOrder);
                  const displayOrderCode = uberOrder.display_id
                    ? String(uberOrder.display_id).replace(/^UBER-/i, '').toUpperCase()
                    : String(uberOrder.order_number || uberOrder.short_display_id || order.invoiceNumber || '')
                        .replace(/^UBER-/i, '')
                        .toUpperCase();

                  return (
                    <div
                      key={`${order.id || uberOriginalUuid || 'ubr'}-${idx}`}
                      className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 shadow-sm order-card"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                            {order.branchName ? `Uber Eats (${order.branchName})` : 'Uber Eats Retail (Central Hub)'}
                          </h3>
                          <span className="font-mono text-[11px] font-bold text-[var(--accent-primary)]">
                            #{displayOrderCode}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                              order.status === 'Processing' || order.status === 'ACCEPTED'
                                ? 'bg-[var(--badge-ready-bg)] text-[var(--badge-ready-text)]'
                                : 'bg-[var(--badge-pending-bg)] text-[var(--badge-pending-text)]'
                            }`}
                          >
                            {order.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[var(--text-secondary)] truncate">
                          {order.customerName} • {order.city || order.branchName || 'Colombo'} •{' '}
                          <span className="font-mono font-semibold text-[var(--text-primary)]">
                            Rs. {Number(order.grossTotal || 0).toLocaleString()}
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {order.status === 'PENDING_ACCEPTANCE' || order.status === 'Pending' || order.status === 'PENDING' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOrderAction('accept', uberOrder)}
                              disabled={orderActionLoading === `${uberOriginalUuid}-accept`}
                              className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] px-3 py-1.5 text-xs font-semibold text-white transition cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{orderActionLoading === `${uberOriginalUuid}-accept` ? '...' : 'Accept'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOrderAction('cancel', uberOrder)}
                              disabled={orderActionLoading === `${uberOriginalUuid}-cancel`}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/25 cursor-pointer disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>{orderActionLoading === `${uberOriginalUuid}-cancel` ? '...' : 'Cancel'}</span>
                            </button>
                          </>
                        ) : order.status === 'Processing' || order.status === 'ACCEPTED' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOrderAction('ready', uberOrder)}
                              disabled={orderActionLoading === `${uberOriginalUuid}-ready`}
                              className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] px-3 py-1.5 text-xs font-semibold text-white transition cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{orderActionLoading === `${uberOriginalUuid}-ready` ? '...' : 'Ready'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOrderAction('cancel', uberOrder)}
                              disabled={orderActionLoading === `${uberOriginalUuid}-cancel`}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/25 cursor-pointer disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>{orderActionLoading === `${uberOriginalUuid}-cancel` ? '...' : 'Cancel'}</span>
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setSelectedOrderForThermalPrint(order)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] transition hover:opacity-90 cursor-pointer"
                          title="Print 4x6 Thermal Label"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>4x6 Label</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* WooCommerce */}
              <div className="p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    <span className="font-medium text-[var(--text-primary)]">WooCommerce Website</span>
                  </div>
                  <span className="text-[var(--text-secondary)] font-mono">{(wcOrders || []).length} orders</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-secondary)]">Trans Express Auto-Linked</span>
                  <span className="text-[var(--text-primary)] font-mono tabular-nums font-medium">
                    Rs. {(wcOrders || []).reduce((s, o) => s + (o?.grossTotal || 0), 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] flex justify-between">
            <span>Total Fees & Gateway Costs:</span>
            <span className="text-amber-700 dark:text-amber-400 font-mono tabular-nums font-medium">
              -Rs. {totalCommissionsDeducted.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Live Invoices Table */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Recent Transactions & Invoices</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Multi-channel aggregation with automated platform & payment gateway fees
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('pos')}
              className="text-xs text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] font-medium cursor-pointer"
            >
              Open Invoices & Returns →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] text-[var(--text-secondary)] uppercase font-mono text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-3.5">Invoice No</th>
                  <th className="py-3 px-3.5">Channel & Gateway</th>
                  <th className="py-3 px-3.5">Customer</th>
                  <th className="py-3 px-3.5 text-center">Status</th>
                  <th className="py-3 px-3.5 text-right">Net Profit</th>
                  <th className="py-3 px-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] font-sans text-[var(--text-primary)]">
                {safeOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[var(--text-secondary)]">
                      <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                        <ShoppingCart className="w-8 h-8 text-[var(--text-secondary)] opacity-60" />
                        <p className="font-semibold text-[var(--text-primary)] text-xs">No Recent Invoices or Orders</p>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          Create sales orders in the POS terminal or connect external store webhooks to populate real-time analytics.
                        </p>
                        <button
                          onClick={() => onNavigateTab('pos')}
                          className="mt-1 px-3.5 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                        >
                          Open POS Terminal
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  (safeOrders || []).slice(0, 5).map((order, idx) => (
                    <tr key={`${order.id || order.invoiceNumber || 'ord'}-${idx}`} className="hover:bg-[var(--bg-subtle)]/50 transition-colors duration-150">
                      <td className="py-3 px-3.5 font-mono font-medium text-[var(--text-primary)]">
                        <div className="font-bold text-[var(--accent-primary)]">
                          {order.channel === 'ubereats'
                            ? String(
                                (order as any).display_id ||
                                  (order as any).order_number ||
                                  (order as any).short_display_id ||
                                  order.invoiceNumber ||
                                  ''
                              )
                                .replace(/^UBER-/i, '')
                                .toUpperCase()
                            : order.invoiceNumber}
                        </div>
                        {order.waybillNumber ? (
                          <div className="text-[10px] text-cyan-700 dark:text-cyan-400 font-mono flex items-center gap-1 mt-0.5">
                            <Truck className="w-2.5 h-2.5" />
                            <span>TX: {order.waybillNumber}</span>
                          </div>
                        ) : order.waybillError ? (
                          <div
                            className="text-[10px] text-rose-700 dark:text-rose-400 font-mono flex items-center gap-1 mt-0.5 truncate max-w-[120px]"
                            title={order.waybillError}
                          >
                            <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />
                            <span className="truncate">Courier Error</span>
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[var(--text-primary)] font-medium">{order.channelName}</span>
                          {order.branchName && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                              📍 {order.branchName}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)] font-mono mt-0.5">
                          <span className="text-[var(--accent-primary)]">
                            {order.paymentGatewayName} ({order.gatewayFeePercent}%)
                          </span>
                          {order.externalStoreId && (
                            <span className="text-[var(--text-secondary)]">
                              · {order.externalStoreId}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="text-[var(--text-primary)] font-medium">{order.customerName}</div>
                        <div className="text-[var(--text-secondary)] text-[11px]">{order.city}</div>
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                            order.status === 'Completed' || order.status === 'Delivered' || order.status === 'READY_FOR_PICKUP' || order.status === 'Ready for Pickup'
                              ? 'bg-[var(--badge-ready-bg)] text-[var(--badge-ready-text)]'
                              : order.status === 'Returned' || order.status === 'Cancelled'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
                              : 'bg-[var(--badge-pending-bg)] text-[var(--badge-pending-text)]'
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono tabular-nums font-semibold">
                        {order.profitStatus === 'Pending / Inventory Not Found' || order.hasUnregisteredItems ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--badge-pending-bg)] text-[var(--badge-pending-text)] whitespace-nowrap">
                            Pending Valuation
                          </span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-400">
                            Rs. {Number(order.netProfit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Uber Eats Real-Time API Accept / Ready / Cancel Controls */}
                          {order.channel === 'ubereats' && (
                            <div className="flex items-center gap-1">
                              {order.status === 'PENDING_ACCEPTANCE' || order.status === 'Pending' || order.status === 'PENDING' ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOrderAction('accept', order as any)}
                                    disabled={orderActionLoading === `${getUberTargetOrderId(order as any)}-accept`}
                                    className="px-2.5 py-1 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg transition-all inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer shadow-sm disabled:opacity-50"
                                    title="Accept Uber Eats Order"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>{orderActionLoading === `${getUberTargetOrderId(order as any)}-accept` ? '...' : 'Accept'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOrderAction('cancel', order as any)}
                                    disabled={orderActionLoading === `${getUberTargetOrderId(order as any)}-cancel`}
                                    className="px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/25 transition-all inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                                    title="Cancel Uber Eats Order"
                                  >
                                    <X className="w-3 h-3" />
                                    <span>{orderActionLoading === `${getUberTargetOrderId(order as any)}-cancel` ? '...' : 'Cancel'}</span>
                                  </button>
                                </>
                              ) : order.status === 'Processing' || order.status === 'ACCEPTED' ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOrderAction('ready', order as any)}
                                    disabled={orderActionLoading === `${getUberTargetOrderId(order as any)}-ready`}
                                    className="px-2.5 py-1 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg transition-all inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer shadow-sm disabled:opacity-50"
                                    title="Mark Ready on Uber Eats"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>{orderActionLoading === `${getUberTargetOrderId(order as any)}-ready` ? '...' : 'Ready'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOrderAction('cancel', order as any)}
                                    disabled={orderActionLoading === `${getUberTargetOrderId(order as any)}-cancel`}
                                    className="px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/25 transition-all inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                                    title="Cancel Uber Eats Order"
                                  >
                                    <X className="w-3 h-3" />
                                    <span>{orderActionLoading === `${getUberTargetOrderId(order as any)}-cancel` ? '...' : 'Cancel'}</span>
                                  </button>
                                </>
                              ) : null}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedOrderForInvoice(order)}
                            className="px-2.5 py-1 text-[var(--text-primary)] bg-[var(--bg-subtle)] hover:opacity-90 border border-[var(--border-subtle)] rounded-lg transition-all inline-flex items-center gap-1 text-[11px] font-medium cursor-pointer"
                            title="View & Print A4 Warranty Invoice"
                          >
                            <FileText className="w-3 h-3" />
                            <span>A4</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedOrderForThermalPrint(order)}
                            className="px-2.5 py-1 text-[var(--text-primary)] bg-[var(--bg-subtle)] hover:opacity-90 border border-[var(--border-subtle)] rounded-lg transition-all inline-flex items-center gap-1 text-[11px] font-medium cursor-pointer"
                            title="Print 100mm x 150mm Daraz-Style 4x6 Thermal Shipping Waybill"
                          >
                            <Printer className="w-3 h-3" />
                            <span>4x6 Label</span>
                          </button>

                          {order.status !== 'Returned' && (() => {
                            const idToPass = String((order as any)._id || order.id || order.invoiceNumber);
                            const isConfirming = confirmingReturnOrderId === idToPass;
                            const isReturning = orderActionLoading === `${idToPass}-return`;
                            return isConfirming ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleReturnOrder(idToPass)}
                                  disabled={isReturning}
                                  className="px-2 py-1 text-white bg-amber-600 hover:bg-amber-500 rounded-lg text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                                >
                                  {isReturning ? '...' : 'Confirm'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmingReturnOrderId(null)}
                                  className="px-2 py-1 text-[var(--text-primary)] bg-[var(--bg-subtle)] hover:opacity-80 rounded-lg text-[11px] cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmingReturnOrderId(idToPass)}
                                className="px-2.5 py-1 text-[var(--badge-pending-text)] hover:text-white bg-[var(--badge-pending-bg)] hover:bg-amber-600 border border-[var(--border-subtle)] rounded-lg transition-all inline-flex items-center gap-1 text-[11px] font-medium cursor-pointer"
                                title="Process Customer Return & Restore Stock"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Return</span>
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Live WooCommerce Webhook Audit Stream */}
      <WebhookAuditLogSection
        events={webhookEvents}
        onRefreshEvents={onRefreshWebhookEvents}
        onClearEvents={onClearWebhookEvents}
        onTriggerTestOrder={onTriggerTestOrder}
        title="Live WooCommerce Webhook Events & Transaction Stream"
        subtitle="Actively listening for live orders placed on the store. Auto-executes Trans Express waybills and SMSlenz confirmations."
        onNavigateTab={onNavigateTab}
      />

      {/* A4 Warranty Invoice Modal */}
      {selectedOrderForInvoice && (
        <A4WarrantyInvoiceModal
          order={selectedOrderForInvoice}
          onClose={() => setSelectedOrderForInvoice(null)}
          products={products}
        />
      )}

      {/* 4x6 Daraz-Style Thermal Shipping Waybill Modal */}
      {selectedOrderForThermalPrint && (
        <ThermalWaybillModal
          order={selectedOrderForThermalPrint}
          orders={orders}
          waybills={waybills}
          products={products}
          onClose={() => setSelectedOrderForThermalPrint(null)}
        />
      )}

      {/* Uber Eats Order Action Modal */}
      {selectedUberOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Uber Eats Order Dispatcher</h3>
              </div>
              <button
                onClick={() => setSelectedUberOrder(null)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 rounded-lg hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5 text-xs text-[var(--text-primary)]">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Order ID:</span>
                <span className="font-mono font-bold text-[var(--accent-primary)]">
                  {selectedUberOrder.channel === 'ubereats'
                    ? String(
                        (selectedUberOrder as any).display_id ||
                          (selectedUberOrder as any).order_number ||
                          (selectedUberOrder as any).short_display_id ||
                          selectedUberOrder.invoiceNumber ||
                          selectedUberOrder.id ||
                          ''
                      )
                        .replace(/^UBER-/i, '')
                        .toUpperCase()
                    : (selectedUberOrder.invoiceNumber || selectedUberOrder.id)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Customer:</span>
                <span className="font-medium text-[var(--text-primary)]">{selectedUberOrder.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Branch Location:</span>
                <span className="font-medium text-[var(--text-primary)]">📍 {selectedUberOrder.branchName || 'Colombo Main'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Current Status:</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--badge-pending-bg)] text-[var(--badge-pending-text)]">
                  {selectedUberOrder.status}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[var(--border-subtle)]">
                <span className="text-[var(--text-secondary)]">Gross Total:</span>
                <span className="font-mono font-bold text-[var(--text-primary)] text-sm">
                  Rs. {selectedUberOrder.grossTotal?.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Action Button Group */}
            <div className="flex gap-2 mt-4">
              {selectedUberOrder.status === 'PENDING_ACCEPTANCE' || selectedUberOrder.status === 'Pending' || selectedUberOrder.status === 'PENDING' ? (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleOrderAction('accept', selectedUberOrder as any);
                      setSelectedUberOrder(null);
                    }}
                    className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white px-3.5 py-2 rounded-lg font-semibold flex-1 cursor-pointer transition-colors text-xs inline-flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Accept</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleOrderAction('cancel', selectedUberOrder as any);
                      setSelectedUberOrder(null);
                    }}
                    className="rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/25 px-3.5 py-2 font-semibold flex-1 cursor-pointer transition-colors text-xs inline-flex items-center justify-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                </>
              ) : selectedUberOrder.status === 'Processing' || selectedUberOrder.status === 'ACCEPTED' ? (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleOrderAction('ready', selectedUberOrder as any);
                      setSelectedUberOrder(null);
                    }}
                    className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white px-3.5 py-2 rounded-lg font-semibold flex-1 cursor-pointer transition-colors text-xs inline-flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Ready</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleOrderAction('cancel', selectedUberOrder as any);
                      setSelectedUberOrder(null);
                    }}
                    className="rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/25 px-3.5 py-2 font-semibold flex-1 cursor-pointer transition-colors text-xs inline-flex items-center justify-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
      {/* QUICK INWARD RESTOCK MODAL (BACKLOG AUTO-DEDUCTION) */}
      {quickRestockItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-xl">
            {(() => {
              const targetWaiting = safeOrders.filter(
                (o) =>
                  (o.hasUnregisteredItems ||
                    o.profitStatus === 'Pending / Inventory Not Found' ||
                    o.status === 'Pending') &&
                  (o.items || []).some(
                    (it) =>
                      (it.sku && it.sku.toUpperCase() === quickRestockItem.sku.toUpperCase()) ||
                      (it.name && it.name.toLowerCase().includes(quickRestockItem.name.toLowerCase())) ||
                      (quickRestockItem.name && quickRestockItem.name.toLowerCase().includes(it.name.toLowerCase()))
                  )
              );
              const targetNeededUnits = targetWaiting.reduce((sum, o) => {
                const match = (o.items || []).filter(
                  (it) =>
                    (!it.isRegistered || it.costPrice <= 0 || o.hasUnregisteredItems || o.status === 'Pending') &&
                    ((it.sku && it.sku.toUpperCase() === quickRestockItem.sku.toUpperCase()) ||
                      (it.name && it.name.toLowerCase().includes(quickRestockItem.name.toLowerCase())) ||
                      (quickRestockItem.name && quickRestockItem.name.toLowerCase().includes(it.name.toLowerCase())))
                );
                return sum + match.reduce((s, it) => s + (it.quantity || 1), 0);
              }, 0);

              const currentProd = products.find((p) => p.sku.toUpperCase() === quickRestockItem.sku.toUpperCase());
              const currentStoreHeld = currentProd?.storeStock ?? currentProd?.stockStore ?? currentProd?.stockQuantity ?? 0;

              return (
                <RestockGRNForm
                  product={{
                    sku: quickRestockItem.sku,
                    title: quickRestockItem.name,
                    name: quickRestockItem.name,
                    costPrice: quickRestockItem.suggestedCost,
                    currentStoreStock: currentStoreHeld,
                  }}
                  suppliers={[
                    { name: 'WOWTEK Direct Import' },
                    { name: 'Singer Digital Sri Lanka' },
                    { name: 'Chama Computers Colombo' },
                  ]}
                  pendingWaitingCount={targetWaiting.length}
                  pendingNeededUnits={targetNeededUnits}
                  onRestock={async (data) => {
                    if (!onRestockProduct) return;
                    setRestockLoading(true);
                    try {
                      const res = await onRestockProduct(
                        data.sku,
                        data.restockQty,
                        0, // Store stock only
                        data.costPrice,
                        data.batchRef,
                        data.supplier
                      );
                      setQuickRestockItem(null);
                      setRestockSuccessMsg(
                        res?.message ||
                          `GRN Restock processed for ${data.sku}! Pending backlog orders auto-deducted and moved to active with verified profits.`
                      );
                      setTimeout(() => setRestockSuccessMsg(null), 6000);
                    } catch (err: any) {
                      console.error('Restock error:', err);
                    } finally {
                      setRestockLoading(false);
                    }
                  }}
                  onCancel={() => setQuickRestockItem(null)}
                />
              );
            })()}
          </div>
        </div>
      )}

      {/* Order Action Feedback Toast */}
      {orderActionToast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-2xl flex items-center gap-2 border ${
            orderActionToast.isError
              ? 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-700/60'
              : 'bg-[var(--badge-ready-bg)] text-[var(--badge-ready-text)] border-[var(--border-subtle)]'
          }`}
        >
          {orderActionToast.isError ? (
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          <span>{orderActionToast.message}</span>
        </div>
      )}
    </div>
  );
};
