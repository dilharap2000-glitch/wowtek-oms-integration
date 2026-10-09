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
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 overflow-hidden shadow-lg">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-neutral-800 bg-neutral-950/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="absolute w-4 h-4 rounded-full bg-emerald-400/30 animate-ping"></span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Globe className="w-4 h-4 text-purple-400" />
              {title}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
              Live Listener Active
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-purple-950 text-purple-300 border border-purple-800">
              Strict Policy: &apos;processing&apos; Only
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">{subtitle}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Copy Webhook URL button */}
          <button
            onClick={handleCopyWebhookUrl}
            className="px-2.5 py-1.5 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-300 hover:text-white transition-colors flex items-center gap-1.5"
            title="Copy Public WooCommerce Webhook URL"
          >
            {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-purple-400" />}
            <span>{copiedUrl ? 'Copied URL!' : '/api/webhooks/woocommerce'}</span>
          </button>

          {/* Copy Secret Key button */}
          <button
            onClick={handleCopySecret}
            className="px-2.5 py-1.5 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-300 hover:text-white transition-colors flex items-center gap-1.5"
            title="Secret: WOWTEK-WC-Webhook-2026-9X7Kl42"
          >
            {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Key className="w-3.5 h-3.5 text-amber-400" />}
            <span>{copiedSecret ? 'Secret Copied!' : 'Secret: WOWTEK-WC-...'}</span>
          </button>

          {/* Simulate Live Order Buttons */}
          {onTriggerTestOrder && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleRunTestOrder('processing')}
                disabled={isSimulating}
                className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-colors"
                title="Test order with status 'processing' (triggers TE waybill + SMS)"
              >
                {isSimulating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                )}
                <span>Test &apos;Processing&apos; Order</span>
              </button>

              <button
                onClick={() => handleRunTestOrder('pending')}
                disabled={isSimulating}
                className="px-2.5 py-1.5 bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-amber-300 border border-amber-900/60 rounded-lg text-xs font-medium shadow-sm flex items-center gap-1.5 transition-colors"
                title="Test order with status 'pending' (verifies strict skip filter)"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Test &apos;Pending&apos; (Skip)</span>
              </button>
            </div>
          )}

          {onRefreshEvents && (
            <button
              onClick={onRefreshEvents}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
              title="Refresh Audit Stream"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {onClearEvents && events.length > 0 && (
            <button
              onClick={onClearEvents}
              className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors"
              title="Reset Audit Log"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-2 bg-neutral-950/40 border-b border-neutral-800 flex items-center gap-2 overflow-x-auto text-xs">
        <span className="text-neutral-500 font-medium">Filter Audit Feed:</span>
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
            filterStatus === 'all'
              ? 'bg-purple-600 text-white font-medium'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          All Events ({safeEvents.length})
        </button>
        <button
          onClick={() => setFilterStatus('processing')}
          className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${
            filterStatus === 'processing'
              ? 'bg-emerald-600 text-white font-medium'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span>Processed ({processedCount})</span>
        </button>
        <button
          onClick={() => setFilterStatus('skipped')}
          className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${
            filterStatus === 'skipped'
              ? 'bg-amber-600 text-white font-medium'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          <span>Skipped / Pending Payment ({skippedCount})</span>
        </button>
      </div>

      {/* Events Table / Feed */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-950/40 text-neutral-400 font-medium text-[11px]">
              <th className="py-2.5 px-4">Timestamp & Event</th>
              <th className="py-2.5 px-4">Order / Invoice Ref</th>
              <th className="py-2.5 px-4">Customer Details</th>
              <th className="py-2.5 px-4 text-right">Order Amount</th>
              <th className="py-2.5 px-4 text-center">Trans Express Waybill</th>
              <th className="py-2.5 px-4 text-center">SMSlenz Confirmation</th>
              <th className="py-2.5 px-4 text-center">Raw Payload</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60 font-sans">
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-neutral-400">
                  <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                    <Radio className="w-8 h-8 text-neutral-600 animate-pulse" />
                    <p className="font-semibold text-white text-xs">Waiting for Incoming WooCommerce Orders...</p>
                    <p className="text-[11px] text-neutral-400">
                      Strict Filter Active: Orders are only ingested when payment is confirmed and status is &apos;processing&apos;. Pending and on-hold orders are safely skipped.
                    </p>
                    {onTriggerTestOrder && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => handleRunTestOrder('processing')}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Test &apos;Processing&apos; Order</span>
                        </button>
                        <button
                          onClick={() => handleRunTestOrder('pending')}
                          className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-amber-800/80 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          <span>Test &apos;Pending&apos; Skip</span>
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              (filteredEvents || []).slice(0, compact ? 6 : 25).map((evt) => {
                const isSuccess = evt.status === 'success';
                const isSkipped = evt.status === 'skipped';
                const timeStr = new Date(evt.receivedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });
                const dateStr = new Date(evt.receivedAt).toLocaleDateString('en-GB');

                return (
                  <tr key={evt.id} className="hover:bg-neutral-850/50 transition-colors">
                    {/* Timestamp & Source */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-white">
                        <Clock className="w-3 h-3 text-neutral-500" />
                        <span>{timeStr}</span>
                        <span className="text-neutral-500 text-[10px]">({dateStr})</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                            evt.source === 'woocommerce'
                              ? 'bg-purple-950/70 text-purple-300 border-purple-800'
                              : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                          }`}
                        >
                          {evt.source}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono truncate max-w-[120px]">
                          {evt.event}
                        </span>
                      </div>
                    </td>

                    {/* Order Reference */}
                    <td className="py-3 px-4">
                      {evt.invoiceNumber ? (
                        <div className="font-mono font-bold text-white flex items-center gap-1">
                          <span>{evt.invoiceNumber}</span>
                        </div>
                      ) : (
                        <span className="text-neutral-500 font-mono text-[11px]">{evt.id}</span>
                      )}
                      <div className="mt-1">
                        {isSkipped ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-amber-950/80 text-amber-300 border border-amber-800">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            Skipped (Pending Payment)
                          </span>
                        ) : isSuccess ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Processed (Payment Confirmed)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-red-950/80 text-red-300 border border-red-800">
                            <AlertTriangle className="w-3 h-3 text-red-400" />
                            Failed / Parse Error
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Customer Info */}
                    <td className="py-3 px-4">
                      {evt.customerName ? (
                        <div>
                          <div className="font-medium text-white">{evt.customerName}</div>
                          <div className="text-neutral-400 font-mono text-[11px]">{evt.customerPhone}</div>
                        </div>
                      ) : (
                        <span className="text-neutral-500 italic">Listener Ping / System Handshake</span>
                      )}
                    </td>

                    {/* Order Amount */}
                    <td className="py-3 px-4 text-right">
                      {evt.amount !== undefined ? (
                        <div className="font-mono font-bold text-emerald-400 tabular-nums">
                          Rs. {evt.amount.toLocaleString()}
                        </div>
                      ) : (
                        <span className="text-neutral-500 font-mono">-</span>
                      )}
                    </td>

                    {/* Trans Express Waybill Status */}
                    <td className="py-3 px-4 text-center">
                      {evt.waybillNumber ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300 font-mono text-[10px] flex items-center gap-1">
                            <Truck className="w-3 h-3 text-emerald-400" />
                            <span>{evt.waybillNumber}</span>
                          </span>
                          <span className="text-[9px] text-neutral-400 mt-0.5 font-mono">Auto Manifested</span>
                        </div>
                      ) : isSkipped ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-amber-400/90 font-mono text-[10px]">
                            No Waybill
                          </span>
                          <span className="text-[9px] text-neutral-500 mt-0.5 font-mono">Awaiting Payment</span>
                        </div>
                      ) : isSuccess && !evt.orderId ? (
                        <span className="text-[10px] text-neutral-500 font-mono">N/A (Ping)</span>
                      ) : (
                        <span className="text-[10px] text-amber-400 font-mono">Queued</span>
                      )}
                    </td>

                    {/* SMSlenz Confirmation Status */}
                    <td className="py-3 px-4 text-center">
                      {evt.smsSent ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="px-2 py-0.5 rounded bg-purple-950/80 border border-purple-800 text-purple-300 font-mono text-[10px] flex items-center gap-1">
                            <MessageSquare className="w-3 h-3 text-purple-400" />
                            <span>Dispatched</span>
                          </span>
                          <span className="text-[9px] text-neutral-400 mt-0.5 font-mono">
                            {evt.smsMessageId || 'SMSlenz Gateway'}
                          </span>
                        </div>
                      ) : isSkipped ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-500 font-mono text-[10px]">
                            Skipped
                          </span>
                          <span className="text-[9px] text-neutral-600 mt-0.5 font-mono">Unpaid Order</span>
                        </div>
                      ) : evt.customerPhone ? (
                        <span className="text-[10px] text-neutral-500 font-mono">Pending</span>
                      ) : (
                        <span className="text-[10px] text-neutral-500 font-mono">-</span>
                      )}
                    </td>

                    {/* Raw Payload View Button */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedEventForPayload(evt)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-lg text-[11px] font-mono transition-colors"
                        title="Inspect Raw WooCommerce JSON Payload"
                      >
                        <Code className="w-3 h-3 text-purple-400" />
                        <span>View JSON</span>
                      </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-neutral-800 bg-neutral-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-semibold text-white">
                  Raw WooCommerce Webhook Payload: {selectedEventForPayload.invoiceNumber || selectedEventForPayload.id}
                </h4>
              </div>
              <button
                onClick={() => setSelectedEventForPayload(null)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-neutral-950/80 border-b border-neutral-800 text-xs flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3 font-mono text-[11px] text-neutral-300">
                <span>Source: <strong className="text-purple-300">{selectedEventForPayload.source}</strong></span>
                <span>·</span>
                <span>Event: <strong className="text-white">{selectedEventForPayload.event}</strong></span>
                <span>·</span>
                <span>Received: {new Date(selectedEventForPayload.receivedAt).toLocaleString()}</span>
              </div>

              <button
                onClick={() => handleCopyPayload(selectedEventForPayload.rawPayload)}
                className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                {copiedPayload ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPayload ? 'Copied JSON!' : 'Copy Raw Payload'}</span>
              </button>
            </div>

            {selectedEventForPayload.status === 'skipped' && (
              <div className="px-4 py-2 bg-amber-950/60 border-b border-amber-900/60 flex items-center gap-2 text-xs text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  {selectedEventForPayload.skipReason || 'Order skipped: Payment Pending (strict filter requires "processing" status).'}
                </span>
              </div>
            )}

            <div className="p-4 overflow-y-auto flex-1 font-mono text-xs bg-neutral-950">
              <pre className="text-emerald-400 whitespace-pre-wrap leading-relaxed select-text">
                {JSON.stringify(selectedEventForPayload.rawPayload, null, 2)}
              </pre>
            </div>

            <div className="p-3 border-t border-neutral-800 bg-neutral-950 flex justify-end">
              <button
                onClick={() => setSelectedEventForPayload(null)}
                className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
