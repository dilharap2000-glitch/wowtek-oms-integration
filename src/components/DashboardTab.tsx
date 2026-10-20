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
import { RestockGRNForm } from './ProductGRNForms';

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

  // Defensive array bindings
  const safeOrders = orders || [];
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
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-neutral-900 border border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Database Engine:</span>
              <span
                className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${
                  dbStatus.status === 'connected'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-amber-950 text-amber-300 border border-amber-800'
                }`}
              >
                {dbStatus.status === 'connected'
                  ? 'MongoDB Atlas Connected (Live)'
                  : 'Mock DB Fallback (Offline)'}
              </span>
              <span className="text-xs text-neutral-400 font-mono">
                {dbStatus.latencyMs}ms latency
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              {dbStatus.status === 'connected'
                ? 'MongoDB Atlas live connection established with connection pooling. Real orders and webhooks persisted directly.'
                : 'Offline resilient fallback active. Real WooCommerce orders prioritized.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateTab('pos')}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Open POS Terminal</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Revenue */}
        <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Gross Revenue</span>
            <DollarSign className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white">
            Rs. {totalGrossRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-neutral-400 pt-2 border-t border-neutral-800/80">
            <span>{orders.length} total orders / invoices</span>
            <span className="text-emerald-400 flex items-center">
              +19.2% <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>

        {/* Net Profit */}
        <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Net Operating Profit</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
            Rs. {totalNetProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          {pendingProfitOrdersCount > 0 ? (
            <div className="mt-2 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[11px]">
              <span className="text-amber-400 flex items-center gap-1 font-mono">
                <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                <span>{pendingProfitOrdersCount} pending valuation</span>
              </span>
              <span className="text-neutral-500 font-mono text-[10px]">Real records only</span>
            </div>
          ) : (
            <div className="flex items-center justify-between mt-3 text-xs text-neutral-400 pt-2 border-t border-neutral-800/80">
              <span>After Verified COGS</span>
              <span className="text-neutral-300 font-mono">
                {((totalNetProfit / (totalGrossRevenue || 1)) * 100).toFixed(1)}% margin
              </span>
            </div>
          )}
        </div>

        {/* Courier Queue */}
        <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Trans Express Queue</span>
            <Truck className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white">
            {pendingWaybills.length}{' '}
            <span className="text-xs font-sans font-normal text-neutral-400">pending</span>
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-neutral-400 pt-2 border-t border-neutral-800/80">
            <span>{waybills.length} total shipments</span>
            <button
              onClick={() => onNavigateTab('waybills')}
              className="text-purple-400 hover:text-purple-300 transition-colors font-medium"
            >
              View Queue →
            </button>
          </div>
        </div>

        {/* Warranty & Returns */}
        <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Warranties & Returns</span>
            <ShieldCheck className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white">
            {activeWarranties.length}
            {returnedOrders.length > 0 && (
              <span className="ml-2 text-xs font-sans font-normal text-amber-400">
                ({returnedOrders.length} returns)
              </span>
            )}
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-neutral-400 pt-2 border-t border-neutral-800/80">
            <span>SMSlenz automated</span>
            <button
              onClick={() => onNavigateTab('warranty')}
              className="text-purple-400 hover:text-purple-300 transition-colors font-medium"
            >
              Manage →
            </button>
          </div>
        </div>
      </div>

      {/* RESTOCK SUCCESS TOAST BANNER */}
      {restockSuccessMsg && (
        <div className="p-3.5 bg-emerald-950/90 border border-emerald-600/70 text-emerald-200 rounded-xl flex items-center justify-between text-xs shadow-lg animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="font-medium">{restockSuccessMsg}</span>
          </div>
          <button
            onClick={() => setRestockSuccessMsg(null)}
            className="text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* PENDING INVENTORY BACKLOG QUEUE (AUTO-DEDUCTION ENGINE) */}
      {pendingBacklogOrders.length > 0 && (
        <div className="p-5 rounded-xl bg-neutral-900 border border-amber-800/60 shadow-md space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">
                    Pending / Inventory Not Found Backlog Queue
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {pendingBacklogOrders.length} Backlog Orders
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Orders holding unregistered items or out-of-stock SKUs. When a new GRN / restock occurs, stock will be automatically deducted, warnings cleared, and verified Net Profit updated instantly.
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('products')}
              className="self-start sm:self-auto text-xs text-purple-400 hover:text-purple-300 font-medium"
            >
              Open Inventory & GRN →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-400 font-medium">
                  <th className="pb-2">Invoice No</th>
                  <th className="pb-2">Channel</th>
                  <th className="pb-2">Customer</th>
                  <th className="pb-2">Backlog Items Waiting for Stock</th>
                  <th className="pb-2 text-right">Gross Total</th>
                  <th className="pb-2 text-center">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {pendingBacklogOrders.map((order) => {
                  const unregItems = (order.items || []).filter(
                    (it) => !it.isRegistered || it.costPrice <= 0
                  );
                  const displayItems = unregItems.length > 0 ? unregItems : order.items || [];

                  return (
                    <tr key={order.id} className="hover:bg-neutral-850/30 transition-colors">
                      <td className="py-2.5 font-mono text-purple-300 font-semibold">
                        {order.invoiceNumber}
                      </td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono bg-neutral-950 border border-neutral-800 text-neutral-300">
                          {order.channel}
                        </span>
                      </td>
                      <td className="py-2.5 text-neutral-300">
                        <div>{order.customerName}</div>
                        <div className="text-[10px] text-neutral-500 font-mono">{order.customerPhone}</div>
                      </td>
                      <td className="py-2.5 space-y-1">
                        {displayItems.map((it, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-amber-300 font-medium text-[11px]">
                              {it.sku || 'UNREGISTERED'}
                            </span>
                            <span className="text-neutral-400 text-[11px]">
                              &ldquo;{it.name}&rdquo; ({it.quantity} qty)
                            </span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-400 border border-amber-800">
                              Awaiting GRN
                            </span>
                          </div>
                        ))}
                      </td>
                      <td className="py-2.5 text-right font-mono text-white font-medium">
                        Rs. {(order.grossTotal || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 text-center">
                        {displayItems[0] && (
                          <button
                            onClick={() =>
                              handleOpenQuickRestock({
                                sku: displayItems[0].sku || 'WT-RESTOCK',
                                name: displayItems[0].name,
                                suggestedCost: displayItems[0].costPrice || 0,
                              })
                            }
                            className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 hover:text-white rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 transition-colors"
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
        <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Dynamic Channel Fees</h3>
              <button
                onClick={() => onNavigateTab('settings')}
                className="text-xs text-purple-400 hover:text-purple-300"
              >
                Edit Fees →
              </button>
            </div>

            <div className="space-y-3">
              {/* POS In-Store */}
              <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800">
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span className="font-medium text-white">In-Store POS Retail</span>
                  </div>
                  <span className="text-neutral-400 font-mono">{posOrders.length} sales</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">0% Platform Fee</span>
                  <span className="text-white font-mono font-medium">
                    Rs. {(posOrders || []).reduce((s, o) => s + (o?.grossTotal || 0), 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* PickMe (20%) */}
              <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800">
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span className="font-medium text-white">PickMe Market (20%)</span>
                    {stores.filter((s) => s.platform === 'pickme').length > 0 && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-800">
                        {stores.filter((s) => s.platform === 'pickme' && s.isActive !== false).length} Branches
                      </span>
                    )}
                  </div>
                  <span className="text-neutral-400 font-mono">{(pkmOrders || []).length} orders</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">
                    Comm: -Rs. {(pkmOrders || []).reduce((s, o) => s + (o?.platformFeeAmount || 0), 0).toLocaleString()}
                  </span>
                  <span className="text-white font-mono font-medium">
                    Rs. {(pkmOrders || []).reduce((s, o) => s + (o?.grossTotal || 0), 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Uber Eats (15.4%) */}
              <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800">
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="font-medium text-white">Uber Eats Retail (15.4%)</span>
                    {stores.filter((s) => s.platform === 'ubereats').length > 0 && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                        {stores.filter((s) => s.platform === 'ubereats' && s.isActive !== false).length} Branches
                      </span>
                    )}
                  </div>
                  <span className="text-neutral-400 font-mono">{(ubrOrders || []).length} orders</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">
                    Comm: -Rs. {(ubrOrders || []).reduce((s, o) => s + (o?.platformFeeAmount || 0), 0).toLocaleString()}
                  </span>
                  <span className="text-white font-mono font-medium">
                    Rs. {(ubrOrders || []).reduce((s, o) => s + (o?.grossTotal || 0), 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* WooCommerce */}
              <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800">
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    <span className="font-medium text-white">WooCommerce Website</span>
                  </div>
                  <span className="text-neutral-400 font-mono">{(wcOrders || []).length} orders</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Trans Express Auto-Linked</span>
                  <span className="text-white font-mono font-medium">
                    Rs. {(wcOrders || []).reduce((s, o) => s + (o?.grossTotal || 0), 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-800 text-xs text-neutral-400 flex justify-between">
            <span>Total Fees & Gateway Costs:</span>
            <span className="text-amber-400 font-mono font-medium">
              -Rs. {totalCommissionsDeducted.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Live Invoices Table */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Recent Transactions & Invoices</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Multi-channel aggregation with automated platform & payment gateway fees
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('pos')}
              className="text-xs text-purple-400 hover:text-purple-300 font-medium"
            >
              Open Invoices & Returns →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-400">
                  <th className="pb-2.5 font-medium">Invoice No</th>
                  <th className="pb-2.5 font-medium">Channel & Gateway</th>
                  <th className="pb-2.5 font-medium">Customer</th>
                  <th className="pb-2.5 font-medium">Status</th>
                  <th className="pb-2.5 font-medium text-right">Net Profit</th>
                  <th className="pb-2.5 font-medium text-center">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-850">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-neutral-400">
                      <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                        <ShoppingCart className="w-8 h-8 text-neutral-600" />
                        <p className="font-semibold text-white text-xs">No Recent Invoices or Orders</p>
                        <p className="text-[11px] text-neutral-400">
                          Create sales orders in the POS terminal or connect external store webhooks to populate real-time analytics.
                        </p>
                        <button
                          onClick={() => onNavigateTab('pos')}
                          className="mt-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition-colors"
                        >
                          Open POS Terminal
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  (safeOrders || []).slice(0, 5).map((order) => (
                    <tr key={order.id} className="hover:bg-neutral-850/50 transition-colors">
                      <td className="py-3 font-mono font-medium text-white">
                        <div>{order.invoiceNumber}</div>
                        {order.waybillNumber ? (
                          <div className="text-[10px] text-cyan-400 font-mono flex items-center gap-1 mt-0.5">
                            <Truck className="w-2.5 h-2.5" />
                            <span>TX: {order.waybillNumber}</span>
                          </div>
                        ) : order.waybillError ? (
                          <div
                            className="text-[10px] text-red-400 font-mono flex items-center gap-1 mt-0.5 truncate max-w-[120px]"
                            title={order.waybillError}
                          >
                            <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />
                            <span className="truncate">Courier Error</span>
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-white font-medium">{order.channelName}</span>
                          {order.branchName && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-950/70 border border-purple-800 text-purple-300">
                              📍 {order.branchName}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono">
                          <span className="text-purple-300">
                            {order.paymentGatewayName} ({order.gatewayFeePercent}%)
                          </span>
                          {order.externalStoreId && (
                            <span className="text-neutral-500">
                              · {order.externalStoreId}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="text-white font-medium">{order.customerName}</div>
                        <div className="text-neutral-400 text-[11px]">{order.city}</div>
                      </td>
                      <td className="py-3">
                        <span
                          className={`text-[11px] font-medium ${
                            order.status === 'Completed' || order.status === 'Delivered'
                              ? 'text-emerald-400'
                              : order.status === 'Returned'
                              ? 'text-red-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 text-right font-mono tabular-nums font-semibold">
                        {order.profitStatus === 'Pending / Inventory Not Found' || order.hasUnregisteredItems ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                            Pending / Inventory Not Found
                          </span>
                        ) : (
                          <span className="text-emerald-400">
                            Rs. {order.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedOrderForInvoice(order)}
                            className="px-2 py-1 text-purple-300 hover:text-white bg-purple-600/20 hover:bg-purple-600 border border-purple-500/30 rounded-md transition-all inline-flex items-center gap-1 text-[11px] font-medium"
                            title="View & Print A4 Warranty Invoice"
                          >
                            <FileText className="w-3 h-3" />
                            <span>A4</span>
                          </button>

                          <button
                            onClick={() => setSelectedOrderForThermalPrint(order)}
                            className="px-2 py-1 text-emerald-300 hover:text-white bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/30 rounded-md transition-all inline-flex items-center gap-1 text-[11px] font-medium"
                            title="Print 100mm x 150mm Daraz-Style 4x6 Thermal Shipping Waybill"
                          >
                            <Printer className="w-3 h-3" />
                            <span>4x6 Label</span>
                          </button>
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
      {/* QUICK INWARD RESTOCK MODAL (BACKLOG AUTO-DEDUCTION) */}
      {quickRestockItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
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

              const currentStoreHeld =
                products.find((p) => p.sku.toUpperCase() === quickRestockItem.sku.toUpperCase())?.stockStore || 0;

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
    </div>
  );
};
