'use client';

import { useMemo, useState } from 'react';
import { OrderActionCell, type OrderActionType } from './OrderActionCell';

export interface CleanOrder {
  id: string;
  orderNumber: string;
  channel: 'Uber Eats' | 'PickMe' | 'WooCommerce' | 'POS';
  customerName: string;
  itemsSummary: string;
  amount: number;
  status: 'PENDING_ACCEPTANCE' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
  timeLabel: string;
}

interface CleanOrdersTableProps {
  orders: CleanOrder[];
  loadingId?: string | null;
  onAction: (order: CleanOrder, action: OrderActionType, reason?: string) => Promise<void> | void;
  onPrintLabel?: (order: CleanOrder) => void;
  onPrintInvoice?: (order: CleanOrder) => void;
  onViewJson?: (order: CleanOrder) => void;
}

type FilterTab = 'ALL' | 'NEW' | 'PREPARING' | 'READY' | 'DONE';

export function CleanOrdersTable({
  orders,
  loadingId,
  onAction,
  onPrintLabel,
  onPrintInvoice,
  onViewJson,
}: CleanOrdersTableProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const matchesTab =
        activeTab === 'ALL' ||
        (activeTab === 'NEW' && o.status === 'PENDING_ACCEPTANCE') ||
        (activeTab === 'PREPARING' && o.status === 'PREPARING') ||
        (activeTab === 'READY' && o.status === 'READY') ||
        (activeTab === 'DONE' && (o.status === 'COMPLETED' || o.status === 'CANCELLED'));

      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.channel.toLowerCase().includes(q) ||
        o.itemsSummary.toLowerCase().includes(q);

      return matchesTab && matchesSearch;
    });
  }, [orders, activeTab, search]);

  const counts = useMemo(
    () => ({
      all: orders.length,
      newCount: orders.filter((o) => o.status === 'PENDING_ACCEPTANCE').length,
      preparing: orders.filter((o) => o.status === 'PREPARING').length,
      ready: orders.filter((o) => o.status === 'READY').length,
    }),
    [orders]
  );

  const handleRowAction = async (
    order: CleanOrder,
    index: number,
    action: OrderActionType,
    reason?: string
  ) => {
    const rowKey = order.id || `${order.orderNumber}-${index}`;
    await onAction({ ...order, id: rowKey }, action, reason);
  };

  const renderStatusBadge = (status: CleanOrder['status']) => {
    switch (status) {
      case 'PENDING_ACCEPTANCE':
        return (
          <span className="inline-flex items-center rounded-full bg-[var(--badge-pending-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--badge-pending-text)]">
            New
          </span>
        );
      case 'PREPARING':
        return (
          <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-500/20 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:text-blue-300">
            Preparing
          </span>
        );
      case 'READY':
        return (
          <span className="inline-flex items-center rounded-full bg-[var(--badge-ready-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--badge-ready-text)]">
            Ready
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            Completed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-[var(--bg-subtle)] px-2.5 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">
            Cancelled
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-app)] p-4">
      {/* Top Tabs + Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: 'ALL', label: `All Orders (${counts.all})` },
            { key: 'NEW', label: `New (${counts.newCount})` },
            { key: 'PREPARING', label: `Preparing (${counts.preparing})` },
            { key: 'READY', label: `Ready (${counts.ready})` },
            { key: 'DONE', label: 'Completed / Cancelled' },
          ].map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as FilterTab)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  active
                    ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                    : 'border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order #, customer, item..."
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:border-[var(--accent-primary)] focus:outline-none sm:w-64"
        />
      </div>

      {/* Clean Orders Table */}
      <div className="overflow-visible rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              <th className="px-4 py-3">Order &amp; Channel</th>
              <th className="px-4 py-3">Customer &amp; Items</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-xs text-[var(--text-secondary)]">
                  Orders හමු වුණේ නැහැ.
                </td>
              </tr>
            ) : (
              filtered.map((order, index) => {
                const rowKey = order.id || `${order.orderNumber}-${index}`;
                const isBusy = Boolean(loadingId && (loadingId === rowKey || loadingId === order.id));
                return (
                  <tr key={rowKey} className="transition hover:bg-[var(--bg-subtle)]/50">
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--text-primary)]">#{order.orderNumber}</span>
                        <span className="rounded-md bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                          {order.channel}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{order.timeLabel}</div>
                    </td>

                    <td className="px-4 py-3.5 align-middle">
                      <div className="text-xs font-semibold text-[var(--text-primary)]">{order.customerName}</div>
                      <div className="line-clamp-1 text-xs text-[var(--text-secondary)]">{order.itemsSummary}</div>
                    </td>

                    <td className="px-4 py-3.5 align-middle">{renderStatusBadge(order.status)}</td>

                    <td className="px-4 py-3.5 text-right align-middle font-mono font-semibold text-[var(--text-primary)]">
                      Rs. {order.amount.toLocaleString()}
                    </td>

                    <td className="px-4 py-3.5 text-right align-middle">
                      <OrderActionCell
                        orderId={rowKey}
                        status={order.status}
                        loading={isBusy}
                        isUberOrder={order.channel === 'Uber Eats'}
                        readyLabel="Mark Ready"
                        onAction={(_, action, reason) => handleRowAction(order, index, action, reason)}
                        onPrintLabel={onPrintLabel ? () => onPrintLabel(order) : undefined}
                        onPrintInvoice={onPrintInvoice ? () => onPrintInvoice(order) : undefined}
                        onViewJson={onViewJson ? () => onViewJson(order) : undefined}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
