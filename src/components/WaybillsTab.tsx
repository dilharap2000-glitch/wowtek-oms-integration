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
  Trash2,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { Order, Product, TransExpressWaybill, WebhookEvent } from '@/types';
import { WebhookAuditLogSection } from './WebhookAuditLogSection';
import { A4WarrantyInvoiceModal } from './A4WarrantyInvoiceModal';
import { ThermalWaybillModal } from './ThermalWaybillModal';

interface WaybillsTabProps {
  waybills: TransExpressWaybill[];
  orders?: Order[];
  products?: Product[];
  webhookEvents?: WebhookEvent[];
  onUpdateWaybillStatus: (id: string, status: TransExpressWaybill['status']) => void;
  onMarkLabelPrinted: (id: string) => void;
  onRefreshWebhookEvents?: () => void;
  onClearWebhookEvents?: () => void;
  onTriggerTestOrder?: () => Promise<void>;
  onDeleteWaybill?: (id: string) => void;
}

export const WaybillsTab: React.FC<WaybillsTabProps> = ({
  waybills,
  orders = [],
  products = [],
  webhookEvents = [],
  onUpdateWaybillStatus,
  onMarkLabelPrinted,
  onRefreshWebhookEvents,
  onClearWebhookEvents,
  onTriggerTestOrder,
  onDeleteWaybill,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<Order | null>(null);
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
    <div className="space-y-6 text-[var(--text-primary)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Trans Express Logistics Queue</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Automated courier waybill generation, Single Auto API uploads, district routing, and cash-on-delivery (COD) tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-purple-500/30 text-xs text-[var(--text-secondary)] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-mono text-[11px] text-purple-600 dark:text-purple-300">Single Auto API: Ready</span>
          </div>
        </div>
      </div>

      {/* Real-time Logistics Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-[var(--text-secondary)] text-xs">
            <span>Total Waybills</span>
            <Package className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-xl font-bold text-[var(--text-primary)] font-mono">{safeWaybills.length}</div>
          <div className="text-[10px] text-[var(--text-secondary)]">All registered courier parcels</div>
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs">
            <span>Queued for Pickup</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-300 font-mono">{queuedCount}</div>
          <div className="text-[10px] text-[var(--text-secondary)]">Awaiting hub manifest / rider</div>
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-xs">
            <span>In Transit</span>
            <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-xl font-bold text-blue-600 dark:text-blue-300 font-mono">{inTransitCount}</div>
          <div className="text-[10px] text-[var(--text-secondary)]">Linehaul or Out for Delivery</div>
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs">
            <span>COD Collectible</span>
            <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-300 font-mono truncate">
            Rs. {totalCodCollection.toLocaleString()}
          </div>
          <div className="text-[10px] text-[var(--text-secondary)]">Cash collection across riders</div>
        </div>
      </div>

      {/* Courier Dispatch Exceptions Banner (if courier API rejected waybills) */}
      {orders && orders.filter((o) => Boolean(o.waybillError)).length > 0 && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-red-950/40 border border-rose-200 dark:border-red-800/60 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-red-300">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-red-400 flex-shrink-0" />
            <span>Courier Dispatch Exceptions ({orders.filter((o) => Boolean(o.waybillError)).length})</span>
            <span className="text-[10px] font-normal text-rose-600/80 dark:text-red-300/80">· Real Trans Express API rejections</span>
          </div>
          <div className="space-y-1.5">
            {orders
              .filter((o) => Boolean(o.waybillError))
              .map((ord) => (
                <div
                  key={ord.id}
                  className="text-xs bg-[var(--bg-surface)] p-3 rounded-lg border border-rose-200 dark:border-red-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 font-mono flex-wrap">
                      <span className="font-bold text-[var(--text-primary)]">{ord.invoiceNumber}</span>
                      <span className="text-[var(--text-secondary)]">({ord.customerName})</span>
                      <span className="text-[var(--text-secondary)]">· {ord.deliveryAddress}, {ord.city}</span>
                    </div>
                    <div className="text-[11px] text-rose-700 dark:text-red-300 font-mono flex items-center gap-1.5">
                      <span className="font-semibold text-rose-600 dark:text-red-400">Rejected by Courier:</span>
                      <span>{ord.waybillError}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--badge-pending-bg)] text-[var(--badge-pending-text)] border border-amber-200 dark:border-amber-800">
                      Order: {ord.status}
                    </span>
                    <button
                      onClick={() => setSelectedOrderForInvoice(ord)}
                      className="px-2.5 py-1 text-purple-700 dark:text-purple-300 hover:text-white bg-purple-50 dark:bg-purple-600/20 hover:bg-purple-600 border border-purple-200 dark:border-purple-500/30 rounded text-[11px] font-medium transition-all"
                    >
                      View Order
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto">
          {['all', 'Queued', 'Manifested', 'Dispatched', 'Out for Delivery', 'Delivered'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
              }`}
            >
              {st === 'all' ? 'All Shipments' : st}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracking no, customer, district..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:outline-none focus:border-[var(--accent-primary)]"
          />
        </div>
      </div>

      {/* Waybills Table */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                <th className="py-3 px-4 font-medium">Tracking Number</th>
                <th className="py-3 px-4 font-medium">Recipient & Phone</th>
                <th className="py-3 px-4 font-medium">Destination / District</th>
                <th className="py-3 px-4 font-medium text-right">COD Amount</th>
                <th className="py-3 px-4 font-medium text-center">Weight</th>
                <th className="py-3 px-4 font-medium">Status Pipeline</th>
                <th className="py-3 px-4 font-medium text-center">Shipping Label</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredWaybills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <Truck className="w-10 h-10 text-[var(--text-secondary)]/50 mb-1" />
                      <p className="font-semibold text-[var(--text-primary)] text-sm">No Waybills in Courier Queue</p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Inbound e-commerce orders and store courier bookings will appear here automatically for Trans Express barcode waybill generation.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                (filteredWaybills || []).map((wb) => (
                  <tr key={wb.id} className="hover:bg-[var(--bg-subtle)]/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-purple-600 dark:text-purple-400">{wb.trackingNumber}</span>
                        {wb.courierNotes?.includes('Trans Express Live Gateway Verified') && (
                          <span className="px-1.5 py-0.5 rounded bg-[var(--badge-ready-bg)] text-[var(--badge-ready-text)] border border-teal-200 dark:border-emerald-500/20 text-[9px] font-mono font-medium">
                            API Verified
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{wb.bookingDate}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-[var(--text-primary)]">{wb.recipientName}</div>
                      <div className="font-mono text-[var(--text-secondary)] text-[11px]">{wb.recipientPhone}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-[var(--text-primary)]">{wb.destination}</div>
                      <div className="text-[11px] text-purple-600 dark:text-purple-300 font-medium">
                        District: {wb.district}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {wb.codAmount > 0 ? (
                        <span className="font-semibold text-[var(--text-primary)]">
                          Rs. {wb.codAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-[var(--text-secondary)]">Paid Online (Rs. 0)</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center font-mono text-[var(--text-secondary)]">
                      {wb.weightKg} kg
                    </td>

                    <td className="py-3 px-4">
                      <select
                        value={wb.status}
                        onChange={(e) =>
                          onUpdateWaybillStatus(wb.id, e.target.value as TransExpressWaybill['status'])
                        }
                        className="bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded px-2 py-1 text-[11px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
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
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handlePrintLabel(wb)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            wb.labelPrinted
                              ? 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--border-subtle)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                              : 'bg-purple-600 text-white hover:bg-purple-500 shadow-sm'
                          }`}
                          title="Print 100mm x 150mm Daraz-style 4x6 Thermal Label"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>{wb.labelPrinted ? 'Reprint 4x6' : 'Print 4x6 Label'}</span>
                        </button>

                        <button
                          onClick={() => {
                            const matchedOrder = orders.find(
                              (o) =>
                                o.id === wb.orderId ||
                                o.invoiceNumber === wb.orderId ||
                                o.transExpressTrackingNumber === wb.trackingNumber ||
                                o.waybillNumber === wb.trackingNumber
                            );
                            if (matchedOrder) {
                              setSelectedOrderForInvoice(matchedOrder);
                            } else {
                                const matchedProd = products.find(
                                  (p) =>
                                    (wb.courierNotes && p.name.toLowerCase().includes(wb.courierNotes.toLowerCase())) ||
                                    p.barcode === wb.trackingNumber
                                );
                                const validCost = matchedProd && matchedProd.costPrice > 0 ? matchedProd.costPrice : 0;
                                const isRegistered = Boolean(matchedProd && matchedProd.costPrice > 0);

                                setSelectedOrderForInvoice({
                                  id: wb.orderId || wb.id,
                                  invoiceNumber: `WT-WC-${wb.id.slice(-5)}`,
                                  channel: 'woocommerce',
                                  channelName: 'WooCommerce Store',
                                  paymentGateway: wb.codAmount > 0 ? 'cash_cod' : 'card_online',
                                  paymentGatewayName: wb.codAmount > 0 ? 'Cash on Delivery (COD)' : 'Prepaid / Online Card',
                                  customerName: wb.recipientName,
                                  customerPhone: wb.recipientPhone,
                                  deliveryAddress: wb.destination,
                                  city: wb.district,
                                  items: [
                                    {
                                      sku: matchedProd?.sku || 'WT-WC-PKG',
                                      barcode: wb.trackingNumber,
                                      name: wb.courierNotes || 'E-Commerce Package Order',
                                      quantity: 1,
                                      unitPrice: wb.codAmount || 0,
                                      costPrice: validCost,
                                      isRegistered,
                                    },
                                  ],
                                  grossTotal: wb.codAmount || 0,
                                  platformFeePercent: 0,
                                  platformFeeAmount: 0,
                                  gatewayFeePercent: 0,
                                  gatewayFeeAmount: 0,
                                  courierFee: 450,
                                  costOfGoods: validCost,
                                  netProfit: isRegistered ? Math.max(0, (wb.codAmount || 0) - validCost - 450) : 0,
                                  profitStatus: isRegistered ? 'Calculated' : 'Pending / Inventory Not Found',
                                  hasUnregisteredItems: !isRegistered,
                                  status: 'Processing',
                                  createdAt: new Date().toISOString(),
                                  updatedAt: new Date().toISOString(),
                                  waybillGenerated: true,
                                  waybillNumber: wb.trackingNumber,
                                  transExpressTrackingNumber: wb.trackingNumber,
                                });
                            }
                          }}
                          className="px-2 py-1.5 rounded-lg text-purple-700 dark:text-purple-300 hover:text-white bg-purple-50 dark:bg-purple-600/20 hover:bg-purple-600 border border-purple-200 dark:border-purple-500/30 transition-colors flex items-center gap-1 text-xs font-medium"
                          title="View & Print A4 Warranty Invoice"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span className="hidden xl:inline">A4 Invoice</span>
                        </button>

                        {onDeleteWaybill && (
                          <button
                            onClick={() => onDeleteWaybill(wb.id)}
                            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete Waybill permanently"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dedicated Daraz-Style 100mm x 150mm (4x6) Thermal Waybill Modal */}
      {selectedWaybillForPrint && (
        <ThermalWaybillModal
          waybill={selectedWaybillForPrint}
          orders={orders}
          products={products}
          onClose={() => setSelectedWaybillForPrint(null)}
          onMarkPrinted={(id) => onMarkLabelPrinted(id)}
        />
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
      {/* A4 Warranty Invoice Modal */}
      {selectedOrderForInvoice && (
        <A4WarrantyInvoiceModal
          order={selectedOrderForInvoice}
          onClose={() => setSelectedOrderForInvoice(null)}
        />
      )}
    </div>
  );
};
