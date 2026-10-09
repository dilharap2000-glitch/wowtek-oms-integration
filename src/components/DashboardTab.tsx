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
} from 'lucide-react';
import { Order, TransExpressWaybill, WarrantyRecord, ExpenseItem, WebhookEvent } from '@/types';
import { WebhookAuditLogSection } from './WebhookAuditLogSection';

interface DashboardTabProps {
  orders: Order[];
  waybills: TransExpressWaybill[];
  warranties: WarrantyRecord[];
  expenses: ExpenseItem[];
  webhookEvents?: WebhookEvent[];
  dbStatus: { status: 'connected' | 'fallback'; latencyMs: number; database: string };
  onNavigateTab: (tab: string) => void;
  onRefreshWebhookEvents?: () => void;
  onClearWebhookEvents?: () => void;
  onTriggerTestOrder?: () => Promise<void>;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  orders,
  waybills,
  warranties,
  expenses,
  webhookEvents = [],
  dbStatus,
  onNavigateTab,
  onRefreshWebhookEvents,
  onClearWebhookEvents,
  onTriggerTestOrder,
}) => {
  // Defensive array bindings
  const safeOrders = orders || [];
  const safeWaybills = waybills || [];
  const safeWarranties = warranties || [];
  const safeExpenses = expenses || [];
  const safeWebhookEvents = webhookEvents || [];

  // Financial computations
  const totalGrossRevenue = safeOrders
    .filter((o) => o && o.status !== 'Returned')
    .reduce((sum, o) => sum + (o?.grossTotal || 0), 0);

  const totalNetProfit = safeOrders.reduce((sum, o) => sum + (o?.netProfit || 0), 0);
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
          <div className="flex items-center justify-between mt-3 text-xs text-neutral-400 pt-2 border-t border-neutral-800/80">
            <span>After COGS & Dynamic Fees</span>
            <span className="text-neutral-300 font-mono">
              {((totalNetProfit / (totalGrossRevenue || 1)) * 100).toFixed(1)}% margin
            </span>
          </div>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-850">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-neutral-400">
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
                      <td className="py-3 font-mono font-medium text-white">{order.invoiceNumber}</td>
                      <td className="py-3">
                        <div className="text-white font-medium">{order.channelName}</div>
                        <div className="text-[10px] text-purple-300 font-mono">
                          {order.paymentGatewayName} ({order.gatewayFeePercent}%)
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
                      <td className="py-3 text-right font-mono tabular-nums text-emerald-400 font-semibold">
                        Rs. {order.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
    </div>
  );
};
