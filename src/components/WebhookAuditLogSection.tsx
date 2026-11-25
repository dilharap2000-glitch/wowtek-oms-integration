'use client';

import React, { useState } from 'react';
import {
  Activity,
  Globe,
  Radio,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Code,
  Copy,
  Check,
  Truck,
  MessageSquare,
  RefreshCw,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  Play,
  Zap,
  Key,
} from 'lucide-react';
import { WebhookEvent } from '@/types';
import { OrderActionCell, type OrderActionType } from './OrderActionCell';

interface WebhookAuditLogSectionProps {
  events: WebhookEvent[];
  onRefreshEvents?: () => void;
  onClearEvents?: () => void;
  onTriggerTestOrder?: (status?: 'processing' | 'pending') => Promise<void>;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  onNavigateTab?: (tab: string) => void;
}

export const WebhookAuditLogSection: React.FC<WebhookAuditLogSectionProps> = ({
  events,
  onRefreshEvents,
  onClearEvents,
  onTriggerTestOrder,
  title = 'Incoming Webhook Events & Transaction Audit Log',
  subtitle = 'Strict Filter Active: Only orders in \'processing\' status are accepted. Pending and on-hold orders are safely skipped.',
  compact = false,
  onNavigateTab,
}) => {
  const [selectedEventForPayload, setSelectedEventForPayload] = useState<WebhookEvent | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [orderActionFeedback, setOrderActionFeedback] = useState<{ message: string; isError: boolean } | null>(null);
  const [orderActionLoadingId, setOrderActionLoadingId] = useState<string | null>(null);

  // ඕනෑම තැනක (Table හෝ Card) Accept / Ready / Cancel සඳහා එකම function එක
  const handleOrderAction = async (
    action: 'accept' | 'ready' | 'cancel' | 'ACCEPT' | 'READY' | 'CANCEL',
    order: {
      uber_order_id?: string;
      orderId?: string;
      id?: string;
      display_id?: string;
      storeId?: string;
      externalStoreId?: string;
    },
    reason?: string
  ) => {
    // අනිවාර්යයෙන්ම දිග UUID එක ගන්න (display_id නොවේ)
    const targetOrderId = String(
      order?.uber_order_id ||
      order?.orderId ||
      order?.id ||
      ''
    ).trim();
    const normalizedAction = action.toUpperCase() as 'ACCEPT' | 'READY' | 'CANCEL';

    if (!targetOrderId) {
      console.error('Missing uber_order_id for order:', order);
      setOrderActionFeedback({
        message: 'මෙම order එකට valid Uber Order UUID එකක් නැත.',
        isError: true,
      });
      setTimeout(() => setOrderActionFeedback(null), 5000);
      return;
    }

    setOrderActionLoadingId(targetOrderId);
    try {
      const res = await fetch('/api/orders/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: targetOrderId,
          action: normalizedAction,
          reason,
          storeId: order.storeId || order.externalStoreId,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !(data.ok ?? data.success)) {
        console.error(`Action [${normalizedAction}] failed:`, res.status, data);
        setOrderActionFeedback({
          message: `Failed (${res.status}): ${data.error || 'Action failed'}`,
          isError: true,
        });
        setTimeout(() => setOrderActionFeedback(null), 5000);
        return;
      }

      const nextStatus = data.nextStatus || data.status;
      console.log('Updated order:', data.orderId || targetOrderId, '->', nextStatus);
      setOrderActionFeedback({
        message:
          data.message ||
          `Order successfully ${normalizedAction === 'CANCEL' ? 'cancelled' : `${normalizedAction.toLowerCase()}ed`}!`,
        isError: false,
      });
      setTimeout(() => setOrderActionFeedback(null), 4000);
      if (onRefreshEvents) await onRefreshEvents();
    } catch (err) {
      console.error('Network/Client error on action:', err);
      setOrderActionFeedback({
        message: 'Server එකට connect වීමට නොහැකි විය.',
        isError: true,
      });
      setTimeout(() => setOrderActionFeedback(null), 5000);
    } finally {
      setOrderActionLoadingId(null);
    }
  };

  const handleCopyPayload = (payload: any) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const handleCopyWebhookUrl = () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/woocommerce` : '/api/webhooks/woocommerce';
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText('WOWTEK-WC-Webhook-2026-9X7Kl42');
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleRunTestOrder = async (status: 'processing' | 'pending' = 'processing') => {
    if (!onTriggerTestOrder) return;
    setIsSimulating(true);
    try {
      await onTriggerTestOrder(status);
    } finally {
      setIsSimulating(false);
    }
  };

  const safeEvents = events || [];

  const filteredEvents = safeEvents.filter((e) => {
    if (!e) return false;
    if (filterStatus === 'all') return true;
    if (filterStatus === 'processing' || filterStatus === 'success') return e.status === 'success';
    if (filterStatus === 'skipped') return e.status === 'skipped';
    if (filterStatus === 'failed') return e.status === 'failed';
    return true;
  });

  const skippedCount = safeEvents.filter((e) => e?.status === 'skipped').length;
  const processedCount = safeEvents.filter((e) => e?.status === 'success').length;

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden shadow-sm">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
              <Globe className="w-4 h-4 text-[var(--accent-primary)]" />
              {title}
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[var(--badge-ready-bg)] text-[var(--badge-ready-text)]">
              Live Listener Active
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
              Strict Policy: &apos;processing&apos; Only
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">{subtitle}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopyWebhookUrl}
            className="px-3 py-1.5 bg-[var(--bg-surface)] hover:opacity-90 border border-[var(--border-subtle)] rounded-xl text-xs font-mono text-[var(--text-primary)] transition-all flex items-center gap-1.5 cursor-pointer"
            title="Copy Public WooCommerce Webhook URL"
          >
            {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[var(--accent-primary)]" />}
            <span>{copiedUrl ? 'Copied URL!' : '/api/webhooks/woocommerce'}</span>
          </button>

          <button
            onClick={handleCopySecret}
            className="px-3 py-1.5 bg-[var(--bg-surface)] hover:opacity-90 border border-[var(--border-subtle)] rounded-xl text-xs font-mono text-[var(--text-primary)] transition-all flex items-center gap-1.5 cursor-pointer"
            title="Secret: WOWTEK-WC-Webhook-2026-9X7Kl42"
          >
            {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Key className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
            <span>{copiedSecret ? 'Secret Copied!' : 'Secret: WOWTEK-WC-...'}</span>
          </button>

          {onTriggerTestOrder && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleRunTestOrder('processing')}
                disabled={isSimulating}
                className="px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                title="Test order with status 'processing' (triggers TE waybill + SMS)"
              >
                {isSimulating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                <span>Test &apos;Processing&apos; Order</span>
              </button>

              <button
                onClick={() => handleRunTestOrder('pending')}
                disabled={isSimulating}
                className="px-3 py-1.5 bg-[var(--badge-pending-bg)] hover:opacity-90 disabled:opacity-50 text-[var(--badge-pending-text)] border border-[var(--border-subtle)] rounded-xl text-xs font-medium shadow-sm flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                title="Test order with status 'pending' (verifies strict skip filter)"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Test &apos;Pending&apos; (Skip)</span>
              </button>
            </div>
          )}

          {onRefreshEvents && (
            <button
              onClick={onRefreshEvents}
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] rounded-xl transition-colors cursor-pointer"
              title="Refresh Audit Stream"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {onClearEvents && events.length > 0 && (
            <button
              onClick={onClearEvents}
              className="p-2 text-[var(--text-secondary)] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-[var(--bg-surface)] rounded-xl transition-colors cursor-pointer"
              title="Reset Audit Log"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-2.5 bg-[var(--bg-app)] border-b border-[var(--border-subtle)] flex items-center gap-2 overflow-x-auto text-xs">
        <span className="text-[var(--text-secondary)] font-medium">Filter Audit Feed:</span>
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            filterStatus === 'all'
              ? 'bg-[var(--accent-primary)] text-white shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
          }`}
        >
          All Events ({safeEvents.length})
        </button>
        <button
          onClick={() => setFilterStatus('processing')}
          className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
            filterStatus === 'processing'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
          }`}
        >
          <CheckCircle2 className="w-3 h-3" />
          <span>Processed ({processedCount})</span>
        </button>
        <button
          onClick={() => setFilterStatus('skipped')}
          className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
            filterStatus === 'skipped'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
          }`}
        >
          <AlertTriangle className="w-3 h-3" />
          <span>Skipped / Pending Payment ({skippedCount})</span>
        </button>
      </div>

      {/* Events Table / Feed */}
      <div className="overflow-x-auto lg:overflow-visible">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] uppercase font-mono text-[10px] tracking-wider">
              <th className="py-2.5 px-4">Timestamp & Event</th>
              <th className="py-2.5 px-4">Order / Invoice Ref</th>
              <th className="py-2.5 px-4">Customer Details</th>
              <th className="py-2.5 px-4 text-right">Order Amount</th>
              <th className="py-2.5 px-4 text-center">Trans Express Waybill</th>
              <th className="py-2.5 px-4 text-center">SMSlenz Confirmation</th>
              <th className="py-2.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)] font-sans text-[var(--text-primary)]">
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[var(--text-secondary)]">
                  <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                    <Radio className="w-8 h-8 text-[var(--text-secondary)] opacity-60 animate-pulse" />
                    <p className="font-semibold text-[var(--text-primary)] text-xs">Waiting for Incoming WooCommerce Orders...</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Strict Filter Active: Orders are only ingested when payment is confirmed and status is &apos;processing&apos;. Pending and on-hold orders are safely skipped.
                    </p>
                    {onTriggerTestOrder && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => handleRunTestOrder('processing')}
                          className="px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Test &apos;Processing&apos; Order</span>
                        </button>
                        <button
                          onClick={() => handleRunTestOrder('pending')}
                          className="px-3 py-1.5 bg-[var(--badge-pending-bg)] text-[var(--badge-pending-text)] border border-[var(--border-subtle)] rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Test &apos;Pending&apos; Skip</span>
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              (filteredEvents || []).slice(0, compact ? 6 : 25).map((evt) => {
                const item = evt;
                const isSuccess = evt.status === 'success';
                const isSkipped = evt.status === 'skipped';
                const timeStr = new Date(evt.receivedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });
                const dateStr = new Date(evt.receivedAt).toLocaleDateString('en-GB');

                return (
                  <tr key={evt.id} className="hover:bg-[var(--bg-subtle)]/50 transition-colors">
                    {/* Timestamp & Source */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-primary)]">
                        <Clock className="w-3 h-3 text-[var(--text-secondary)]" />
                        <span>{timeStr}</span>
                        <span className="text-[var(--text-secondary)] text-[10px]">({dateStr})</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                            evt.source === 'woocommerce'
                              ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800'
                              : evt.source === 'pickme'
                              ? 'bg-[var(--badge-pending-bg)] text-[var(--badge-pending-text)] border-[var(--border-subtle)]'
                              : evt.source === 'ubereats'
                              ? 'bg-[var(--badge-ready-bg)] text-[var(--badge-ready-text)] border-[var(--border-subtle)]'
                              : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                          }`}
                        >
                          {evt.source}
                        </span>
                        {evt.branchName && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border-subtle)]">
                            📍 {evt.branchName}
                          </span>
                        )}
                        <span className="text-[10px] text-[var(--text-secondary)] font-mono truncate max-w-[120px]">
                          {evt.event}
                        </span>
                      </div>
                    </td>

                    {/* Order Reference */}
                    <td className="py-3 px-4">
                      {evt.invoiceNumber ? (
                        <div className="font-mono font-bold text-[var(--text-primary)] flex items-center gap-1">
                          <span>
                            {evt.source === 'ubereats'
                              ? String((evt as any).display_id || (evt as any).order_number || evt.invoiceNumber || '')
                                  .replace(/^UBER-/i, '')
                                  .toUpperCase()
                              : evt.invoiceNumber}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[var(--text-secondary)] font-mono text-[11px]">{evt.id}</span>
                      )}
                      <div className="mt-1">
                        {isSkipped ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-[var(--badge-pending-bg)] text-[var(--badge-pending-text)]">
                            <AlertTriangle className="w-3 h-3" />
                            Skipped (Pending Payment)
                          </span>
                        ) : isSuccess ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-[var(--badge-ready-bg)] text-[var(--badge-ready-text)]">
                            <CheckCircle2 className="w-3 h-3" />
                            Processed (Payment Confirmed)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800">
                            <AlertTriangle className="w-3 h-3" />
                            Failed / Parse Error
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Customer Info */}
                    <td className="py-3 px-4">
                      {evt.customerName ? (
                        <div>
                          <div className="font-medium text-[var(--text-primary)]">{evt.customerName}</div>
                          <div className="text-[var(--text-secondary)] font-mono text-[11px]">{evt.customerPhone}</div>
                        </div>
                      ) : (
                        <span className="text-[var(--text-secondary)] italic">Listener Ping / System Handshake</span>
                      )}
                    </td>

                    {/* Order Amount */}
                    <td className="py-3 px-4 text-right">
                      {evt.amount !== undefined ? (
                        <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                          Rs. {evt.amount.toLocaleString()}
                        </div>
                      ) : (
                        <span className="text-[var(--text-secondary)] font-mono">-</span>
                      )}
                    </td>

                    {/* Trans Express Waybill Status */}
                    <td className="py-3 px-4 text-center">
                      {evt.waybillNumber ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="px-2 py-0.5 rounded bg-[var(--badge-ready-bg)] text-[var(--badge-ready-text)] font-mono text-[10px] flex items-center gap-1">
                            <Truck className="w-3 h-3" />
                            <span>{evt.waybillNumber}</span>
                          </span>
                          <span className="text-[9px] text-[var(--badge-ready-text)] mt-0.5 font-mono">Live API Waybill</span>
                        </div>
                      ) : evt.waybillError ? (
                        <div className="inline-flex flex-col items-center max-w-[150px]">
                          <span
                            className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200 dark:bg-red-950/80 dark:border-red-800 dark:text-red-300 font-mono text-[10px] flex items-center gap-1"
                            title={evt.waybillError}
                          >
                            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                            <span>Courier Rejected</span>
                          </span>
                          <span
                            className="text-[9px] text-rose-700 dark:text-red-400 mt-0.5 font-mono truncate max-w-[140px] text-center"
                            title={evt.waybillError}
                          >
                            {evt.waybillError}
                          </span>
                        </div>
                      ) : isSkipped ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="px-2 py-0.5 rounded bg-[var(--badge-pending-bg)] text-[var(--badge-pending-text)] font-mono text-[10px]">
                            No Waybill
                          </span>
                          <span className="text-[9px] text-[var(--text-secondary)] mt-0.5 font-mono">Awaiting Payment</span>
                        </div>
                      ) : isSuccess && !evt.orderId ? (
                        <span className="text-[10px] text-[var(--text-secondary)] font-mono">N/A (Ping)</span>
                      ) : (
                        <span className="text-[10px] text-[var(--badge-pending-text)] font-mono">Queued</span>
                      )}
                    </td>

                    {/* SMSlenz Confirmation Status */}
                    <td className="py-3 px-4 text-center">
                      {evt.smsSent ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="px-2 py-0.5 rounded bg-[var(--badge-ready-bg)] text-[var(--badge-ready-text)] font-mono text-[10px] flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            <span>Dispatched</span>
                          </span>
                          <span className="text-[9px] text-[var(--text-secondary)] mt-0.5 font-mono">
                            {evt.smsMessageId || 'SMSlenz Gateway'}
                          </span>
                        </div>
                      ) : isSkipped ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="px-2 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-mono text-[10px]">
                            Skipped
                          </span>
                          <span className="text-[9px] text-[var(--text-secondary)] mt-0.5 font-mono">Unpaid Order</span>
                        </div>
                      ) : evt.customerPhone ? (
                        <span className="text-[10px] text-[var(--text-secondary)] font-mono">Pending</span>
                      ) : (
                        <span className="text-[10px] text-[var(--text-secondary)] font-mono">-</span>
                      )}
                    </td>

                    {/* Action Column */}
                    <td className="py-3 px-4 text-right">
                      {(() => {
                        const targetId = String(
                          (item as any).uber_order_id ||
                            (item as any).orderId ||
                            item.id ||
                            ''
                        ).trim();
                        const uberStatus = String(
                          item.orderStatus || (item as any).state || (item.source === 'ubereats' ? 'PENDING_ACCEPTANCE' : '')
                        );
                        return (
                          <OrderActionCell
                            orderId={targetId || evt.id}
                            status={uberStatus}
                            loading={Boolean(targetId && orderActionLoadingId === targetId)}
                            isUberOrder={item.source === 'ubereats'}
                            onAction={(_, actionType: OrderActionType, reason) =>
                              handleOrderAction(
                                actionType.toLowerCase() as 'accept' | 'ready' | 'cancel',
                                item as any,
                                reason
                              )
                            }
                            onViewJson={() => setSelectedEventForPayload(evt)}
                          />
                        );
                      })()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Raw Payload Modal */}
      {selectedEventForPayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-[var(--accent-primary)]" />
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                  Raw WooCommerce Webhook Payload: {selectedEventForPayload.invoiceNumber || selectedEventForPayload.id}
                </h4>
              </div>
              <button
                onClick={() => setSelectedEventForPayload(null)}
                className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-[var(--bg-app)] border-b border-[var(--border-subtle)] text-xs flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3 font-mono text-[11px] text-[var(--text-secondary)]">
                <span>Source: <strong className="text-[var(--accent-primary)]">{selectedEventForPayload.source}</strong></span>
                <span>·</span>
                <span>Event: <strong className="text-[var(--text-primary)]">{selectedEventForPayload.event}</strong></span>
                <span>·</span>
                <span>Received: {new Date(selectedEventForPayload.receivedAt).toLocaleString()}</span>
              </div>

              <button
                onClick={() => handleCopyPayload(selectedEventForPayload.rawPayload)}
                className="px-2.5 py-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedPayload ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPayload ? 'Copied JSON!' : 'Copy Raw Payload'}</span>
              </button>
            </div>

            {selectedEventForPayload.waybillError && (
              <div className="px-4 py-2.5 bg-rose-50 dark:bg-red-950/70 border-b border-rose-200 dark:border-red-900/80 flex items-start gap-2.5 text-xs text-rose-800 dark:text-red-200">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Trans Express Courier Gateway Rejection:</div>
                  <div className="font-mono text-[11px] mt-0.5">{selectedEventForPayload.waybillError}</div>
                  {selectedEventForPayload.transExpressResponse && (
                    <div className="mt-1 text-[10px] opacity-80 font-mono">
                      API Response: {typeof selectedEventForPayload.transExpressResponse === 'object' ? JSON.stringify(selectedEventForPayload.transExpressResponse) : String(selectedEventForPayload.transExpressResponse)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedEventForPayload.status === 'skipped' && (
              <div className="px-4 py-2 bg-[var(--badge-pending-bg)] border-b border-[var(--border-subtle)] flex items-center gap-2 text-xs text-[var(--badge-pending-text)]">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {selectedEventForPayload.skipReason || 'Order skipped: Payment Pending (strict filter requires "processing" status).'}
                </span>
              </div>
            )}

            <div className="p-4 overflow-y-auto flex-1 font-mono text-xs bg-[var(--bg-app)]">
              <pre className="text-[var(--accent-primary)] whitespace-pre-wrap leading-relaxed select-text">
                {JSON.stringify(selectedEventForPayload.rawPayload, null, 2)}
              </pre>
            </div>

            <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] flex justify-end">
              <button
                onClick={() => setSelectedEventForPayload(null)}
                className="px-4 py-1.5 bg-[var(--bg-subtle)] hover:opacity-90 border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Feedback Toast */}
      {orderActionFeedback && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-2xl flex items-center gap-2 border ${
            orderActionFeedback.isError
              ? 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-700/60'
              : 'bg-[var(--badge-ready-bg)] text-[var(--badge-ready-text)] border-[var(--border-subtle)]'
          }`}
        >
          {orderActionFeedback.isError ? (
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          <span>{orderActionFeedback.message}</span>
        </div>
      )}
    </div>
  );
};
