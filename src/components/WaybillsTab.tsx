'use client';

import React, { useState } from 'react';
import {
  Truck,
  Printer,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck,
  X,
  MapPin,
  Phone,
  Barcode,
  Package,
  DollarSign,
  Zap,
} from 'lucide-react';
import { TransExpressWaybill, WebhookEvent } from '@/types';
import { WebhookAuditLogSection } from './WebhookAuditLogSection';

interface WaybillsTabProps {
  waybills: TransExpressWaybill[];
  webhookEvents?: WebhookEvent[];
  onUpdateWaybillStatus: (id: string, status: TransExpressWaybill['status']) => void;
  onMarkLabelPrinted: (id: string) => void;
  onRefreshWebhookEvents?: () => void;
  onClearWebhookEvents?: () => void;
  onTriggerTestOrder?: () => Promise<void>;
}

export const WaybillsTab: React.FC<WaybillsTabProps> = ({
  waybills,
  webhookEvents = [],
  onUpdateWaybillStatus,
  onMarkLabelPrinted,
  onRefreshWebhookEvents,
  onClearWebhookEvents,
  onTriggerTestOrder,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWaybillForPrint, setSelectedWaybillForPrint] = useState<TransExpressWaybill | null>(
    null
  );
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const safeWaybills = waybills || [];

  const queuedCount = safeWaybills.filter((w) => w?.status === 'Queued').length;
  const inTransitCount = safeWaybills.filter(
    (w) => w?.status === 'Manifested' || w?.status === 'Dispatched' || w?.status === 'Out for Delivery'
  ).length;
  const deliveredCount = safeWaybills.filter((w) => w?.status === 'Delivered').length;
  const totalCodCollection = safeWaybills.reduce((sum, w) => sum + (Number(w?.codAmount) || 0), 0);

  const filteredWaybills = safeWaybills.filter((wb) => {
    if (!wb) return false;
    const matchesStatus = statusFilter === 'all' || wb.status === statusFilter;
    const matchesSearch =
      (wb.trackingNumber || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (wb.recipientName || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (wb.destination || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (wb.district || '').toLowerCase().includes((searchQuery || '').toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handlePrintLabel = (wb: TransExpressWaybill) => {
    setSelectedWaybillForPrint(wb);
    onMarkLabelPrinted(wb.id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Trans Express Logistics Queue</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Automated courier waybill generation, Single Auto API uploads, district routing, and cash-on-delivery (COD) tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-purple-500/30 text-xs text-neutral-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-mono text-[11px] text-purple-300">Single Auto API: Ready</span>
          </div>
        </div>
      </div>

      {/* Real-time Logistics Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span>Total Waybills</span>
            <Package className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">{safeWaybills.length}</div>
          <div className="text-[10px] text-neutral-400">All registered courier parcels</div>
        </div>

        <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1">
          <div className="flex items-center justify-between text-amber-400 text-xs">
            <span>Queued for Pickup</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-300 font-mono">{queuedCount}</div>
          <div className="text-[10px] text-neutral-400">Awaiting hub manifest / rider</div>
        </div>

        <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1">
          <div className="flex items-center justify-between text-blue-400 text-xs">
            <span>In Transit</span>
            <Truck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold text-blue-300 font-mono">{inTransitCount}</div>
          <div className="text-[10px] text-neutral-400">Linehaul or Out for Delivery</div>
        </div>

        <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1">
          <div className="flex items-center justify-between text-emerald-400 text-xs">
            <span>COD Collectible</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-emerald-300 font-mono truncate">
            Rs. {totalCodCollection.toLocaleString()}
          </div>
          <div className="text-[10px] text-neutral-400">Cash collection across riders</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between p-3 rounded-xl bg-neutral-900 border border-neutral-800">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto">
          {['all', 'Queued', 'Manifested', 'Dispatched', 'Out for Delivery', 'Delivered'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-purple-600 text-white'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
              }`}
            >
              {st === 'all' ? 'All Shipments' : st}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracking no, customer, district..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Waybills Table */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-950/60 text-neutral-400">
                <th className="py-3 px-4 font-medium">Tracking Number</th>
                <th className="py-3 px-4 font-medium">Recipient & Phone</th>
                <th className="py-3 px-4 font-medium">Destination / District</th>
                <th className="py-3 px-4 font-medium text-right">COD Amount</th>
                <th className="py-3 px-4 font-medium text-center">Weight</th>
                <th className="py-3 px-4 font-medium">Status Pipeline</th>
                <th className="py-3 px-4 font-medium text-center">Shipping Label</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/80">
              {filteredWaybills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <Truck className="w-10 h-10 text-neutral-600 mb-1" />
                      <p className="font-semibold text-white text-sm">No Waybills in Courier Queue</p>
                      <p className="text-xs text-neutral-400">
                        Inbound e-commerce orders and store courier bookings will appear here automatically for Trans Express barcode waybill generation.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                (filteredWaybills || []).map((wb) => (
                  <tr key={wb.id} className="hover:bg-neutral-850/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-purple-400">{wb.trackingNumber}</span>
                        {wb.courierNotes?.includes('Trans Express Live Gateway Verified') && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono font-medium">
                            API Verified
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">{wb.bookingDate}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-white">{wb.recipientName}</div>
                      <div className="font-mono text-neutral-400 text-[11px]">{wb.recipientPhone}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-neutral-200">{wb.destination}</div>
                      <div className="text-[11px] text-purple-300 font-medium">
                        District: {wb.district}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {wb.codAmount > 0 ? (
                        <span className="font-semibold text-white">
                          Rs. {wb.codAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-neutral-400">Paid Online (Rs. 0)</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center font-mono text-neutral-300">
                      {wb.weightKg} kg
                    </td>

                    <td className="py-3 px-4">
                      <select
                        value={wb.status}
                        onChange={(e) =>
                          onUpdateWaybillStatus(wb.id, e.target.value as TransExpressWaybill['status'])
                        }
                        className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="Queued">Queued (Pending Manifest)</option>
                        <option value="Manifested">Manifested (Hub Scanned)</option>
                        <option value="Dispatched">Dispatched (Linehaul)</option>
                        <option value="Out for Delivery">Out for Delivery (Rider)</option>
                        <option value="Delivered">Delivered & Closed</option>
                        <option value="Returned">Returned / RTS</option>
                      </select>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handlePrintLabel(wb)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          wb.labelPrinted
                            ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                            : 'bg-purple-600 text-white hover:bg-purple-500'
                        }`}
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>{wb.labelPrinted ? 'Reprint Label' : 'Print Label'}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print-Ready Trans Express Shipping Label Modal */}
      {selectedWaybillForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">Trans Express Official Air Waybill</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print 4x6 Label</span>
                </button>
                <button
                  onClick={() => setSelectedWaybillForPrint(null)}
                  className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Authentic 4x6 Shipping Label */}
            <div className="p-6 bg-neutral-950 flex justify-center">
              <div className="w-full max-w-md bg-white text-black p-4 rounded border-2 border-black font-sans space-y-3">
                {/* Header */}
                <div className="flex justify-between items-center pb-2 border-b-2 border-black">
                  <div>
                    <div className="text-lg font-black tracking-tighter">TRANS EXPRESS</div>
                    <div className="text-[10px] font-bold text-neutral-700">DOMESTIC LOGISTICS SRI LANKA</div>
                  </div>
                  <div className="text-right">
                    <span className="border-2 border-black px-2 py-0.5 text-xs font-black">
                      {selectedWaybillForPrint.district.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Routing & Barcode */}
                <div className="text-center py-1">
                  <div className="font-mono text-sm font-black tracking-widest">
                    {selectedWaybillForPrint.trackingNumber}
                  </div>
                  <div className="flex justify-center my-1">
                    <svg viewBox="0 0 200 40" className="w-56 h-10">
                      {Array.from({ length: 50 }).map((_, i) => (
                        <rect
                          key={i}
                          x={i * 4}
                          y={0}
                          width={i % 3 === 0 ? 3 : 1.5}
                          height={40}
                          fill="#000"
                        />
                      ))}
                    </svg>
                  </div>
                </div>

                {/* Recipient Details */}
                <div className="border-t-2 border-b-2 border-black py-2 space-y-1 text-xs">
                  <div className="text-[10px] uppercase font-bold text-neutral-600">DELIVER TO (CONSIGNEE):</div>
                  <div className="font-bold text-sm">{selectedWaybillForPrint.recipientName}</div>
                  <div className="font-medium text-neutral-800 leading-tight">
                    {selectedWaybillForPrint.destination}
                  </div>
                  <div className="font-bold text-sm font-mono mt-1">
                    TEL: {selectedWaybillForPrint.recipientPhone}
                  </div>
                </div>

                {/* COD & Weight Box */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 border border-black text-center">
                    <div className="text-[9px] uppercase font-bold">CASH ON DELIVERY (COD)</div>
                    <div className="text-base font-black font-mono">
                      {selectedWaybillForPrint.codAmount > 0
                        ? `Rs. ${selectedWaybillForPrint.codAmount.toLocaleString()}`
                        : 'ZERO COD (PAID)'}
                    </div>
                  </div>
                  <div className="p-2 border border-black text-center">
                    <div className="text-[9px] uppercase font-bold">PARCEL WEIGHT</div>
                    <div className="text-base font-black font-mono">
                      {selectedWaybillForPrint.weightKg} KG
                    </div>
                  </div>
                </div>

                {/* Sender & Instructions */}
                <div className="text-[10px] pt-1 text-neutral-800 space-y-0.5 border-t border-neutral-300">
                  <div>
                    <strong>Shipper:</strong> WOWTEK Pro Hub, Colombo 04 (+94 11 258 9000)
                  </div>
                  <div>
                    <strong>Courier Notes:</strong> {selectedWaybillForPrint.courierNotes}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live WooCommerce Webhook Audit Log & Logistics Dispatch Stream */}
      <WebhookAuditLogSection
        events={webhookEvents}
        onRefreshEvents={onRefreshWebhookEvents}
        onClearEvents={onClearWebhookEvents}
        onTriggerTestOrder={onTriggerTestOrder}
        title="Live WooCommerce Webhook Events & Logistics Stream"
        subtitle="Real-time incoming orders from connected WooCommerce store with automatic Trans Express Waybill generation (TE-XXXX)."
      />
    </div>
  );
};
