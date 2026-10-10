'use client';

import React, { useState } from 'react';
import {
  Printer,
  Download,
  X,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  Package,
  Receipt,
  CheckCircle,
} from 'lucide-react';
import { Order, Product } from '@/types';

interface A4WarrantyInvoiceModalProps {
  order: Order | null;
  onClose: () => void;
  products?: Product[];
}

export const A4WarrantyInvoiceModal: React.FC<A4WarrantyInvoiceModalProps> = ({
  order,
  onClose,
  products = [],
}) => {
  const [format, setFormat] = useState<'a4' | 'thermal'>('a4');
  const [downloading, setDownloading] = useState(false);

  if (!order) return null;

  const orderDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-GB');

  const orderTime = order.createdAt
    ? new Date(order.createdAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const subtotal = (order.items || []).reduce(
    (sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 1),
    0
  );

  // Helper to resolve warranty duration for each item
  const getItemWarranty = (sku: string, name: string): string => {
    const matched = products.find(
      (p) =>
        p.sku?.toLowerCase() === sku?.toLowerCase() ||
        p.name?.toLowerCase() === name?.toLowerCase()
    );
    if (matched?.warrantyPeriodMonths) {
      return `${matched.warrantyPeriodMonths} Months`;
    }
    const lower = name.toLowerCase();
    if (lower.includes('ssd') || lower.includes('monitor') || lower.includes('display')) {
      return '36 Months';
    }
    if (lower.includes('keyboard') || lower.includes('charger') || lower.includes('ram')) {
      return '24 Months';
    }
    if (lower.includes('mouse') || lower.includes('headset') || lower.includes('cable')) {
      return '12 Months';
    }
    return '12 Months';
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadHtml = () => {
    setDownloading(true);
    try {
      const printableElement = document.getElementById('wowtek-invoice-content');
      if (!printableElement) return;

      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>WOWTEK Invoice - ${order.invoiceNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm 12mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 20px; background: #fff; color: #111; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #e5e7eb; padding: 8px 10px; }
    th { background: #f9fafb; font-weight: 600; text-align: left; }
    .text-right { text-align: right; }
    .font-mono { font-family: ui-monospace, Menlo, monospace; }
  </style>
</head>
<body>
  ${printableElement.innerHTML}
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `WOWTEK-Invoice-${order.invoiceNumber}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error downloading invoice:', e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
      {/* Container Dialog */}
      <div className="relative w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[96vh]">
        {/* Modal Toolbar (Hidden on Print) */}
        <div className="no-print flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-neutral-800 bg-neutral-950 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600/10 text-purple-400 rounded-xl border border-purple-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  Official Warranty Invoice
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  {order.invoiceNumber}
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Print-ready official document with full warranty terms & customer signatures
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Format toggle: A4 vs 80mm */}
            <div className="hidden sm:flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFormat('a4')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  format === 'a4'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                A4 Official Sheet
              </button>
              <button
                type="button"
                onClick={() => setFormat('thermal')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  format === 'thermal'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                80mm Thermal Slip
              </button>
            </div>

            {/* Print / Download Invoice Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 active:scale-95 rounded-lg transition-all shadow-md shadow-purple-900/30"
              title="Print directly or save as PDF via browser print"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Download Invoice</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadHtml}
              disabled={downloading}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-300 bg-neutral-800 hover:bg-neutral-700 active:scale-95 rounded-lg border border-neutral-700 transition-all"
              title="Download standalone HTML file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>HTML</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors ml-1"
              aria-label="Close invoice"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Document Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-950 flex justify-center items-start">
          {format === 'a4' ? (
            /* =========================================================================
             * A4 OFFICIAL WARRANTY INVOICE (CLEAN PRINTABLE VIEW)
             * Exact shop header: WOWTEK / 0779673004 / T-9 Pipe Road, Udumulla, Mulleriyawa
             * ========================================================================= */
            <div
              id="wowtek-invoice-content"
              className="a4-invoice-printable w-full max-w-[210mm] bg-white text-neutral-900 rounded-lg sm:rounded-xl shadow-2xl p-6 sm:p-10 font-sans border border-neutral-200"
              style={{ minHeight: '297mm' }}
            >
              {/* 1. SHOP HEADER & INVOICE IDENTIFIER */}
              <div className="border-b-2 border-purple-600 pb-5 mb-5">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  {/* Left: Official Shop Brand & Contact Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-950">
                        WOWTEK
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-purple-100 text-purple-800 border border-purple-200">
                        Official Store
                      </span>
                    </div>

                    <div className="mt-2 space-y-1 text-xs text-neutral-600">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                        <span className="font-medium text-neutral-800">
                          T-9 Pipe Road, Udumulla, Mulleriyawa
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                        <span>Hotline: </span>
                        <strong className="text-neutral-900 font-mono font-bold tracking-wider">
                          0779673004
                        </strong>
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        Computer Components · Peripherals · Tech Gadgets & Warranty Support
                      </div>
                    </div>
                  </div>

                  {/* Right: Invoice Meta & Badges */}
                  <div className="text-left sm:text-right flex-shrink-0 bg-neutral-50 sm:bg-transparent p-3 sm:p-0 rounded-lg border sm:border-0 border-neutral-200 w-full sm:w-auto">
                    <div className="text-xs font-bold uppercase tracking-wider text-purple-700">
                      Warranty Tax Invoice
                    </div>
                    <div className="text-lg sm:text-xl font-extrabold font-mono text-neutral-900 mt-0.5">
                      {order.invoiceNumber}
                    </div>

                    <div className="mt-2 text-xs space-y-0.5 text-neutral-600 font-mono">
                      <div>
                        Date: <strong className="text-neutral-800">{orderDate}</strong>
                        {orderTime ? ` (${orderTime})` : ''}
                      </div>
                      <div>
                        Payment: <strong className="text-neutral-800">{order.paymentGatewayName}</strong>
                      </div>
                      <div>
                        Channel: <strong className="text-neutral-800">{order.channelName}</strong>
                      </div>
                      {order.transExpressTrackingNumber && (
                        <div className="text-purple-700 font-bold">
                          Trans Express: {order.transExpressTrackingNumber}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. BILLED TO & ORDER SUMMARY */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-xs">
                {/* Billed To Customer Box */}
                <div className="bg-neutral-50 rounded-lg p-3.5 border border-neutral-200">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5 flex items-center gap-1.5">
                    <span>Billed To / Customer Details</span>
                  </div>
                  <div className="font-bold text-sm text-neutral-900 mb-1">
                    {order.customerName || 'Valued Customer'}
                  </div>
                  <div className="text-neutral-700 flex items-center gap-1 font-mono">
                    <Phone className="w-3 h-3 text-neutral-400" />
                    <span>{order.customerPhone || 'N/A'}</span>
                  </div>
                  <div className="text-neutral-600 mt-1 flex items-start gap-1">
                    <MapPin className="w-3 h-3 text-neutral-400 mt-0.5 flex-shrink-0" />
                    <span>
                      {order.deliveryAddress || 'Direct Store Pickup'}
                      {order.city ? `, ${order.city}` : ''}
                    </span>
                  </div>
                </div>

                {/* Dispatch & Reference Details */}
                <div className="bg-neutral-50 rounded-lg p-3.5 border border-neutral-200">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5 flex items-center gap-1.5">
                    <Package className="w-3 h-3 text-purple-600" />
                    <span>Order Reference & Dispatch Status</span>
                  </div>
                  <div className="space-y-1 text-neutral-700">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Order ID:</span>
                      <span className="font-mono font-medium text-neutral-800">{order.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Order Status:</span>
                      <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                        {order.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Payment Gateway:</span>
                      <span className="font-mono text-neutral-800">{order.paymentGatewayName}</span>
                    </div>
                    {order.notes && (
                      <div className="text-[10px] text-neutral-500 italic pt-0.5 truncate">
                        Note: {order.notes}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. ITEM DESCRIPTION TABLE */}
              <div className="mb-6 overflow-hidden rounded-lg border border-neutral-200">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-neutral-100 text-neutral-700 font-semibold border-b border-neutral-200">
                      <th className="py-2.5 px-3 text-center w-8">#</th>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-3">SKU / Code</th>
                      <th className="py-2.5 px-3 text-center">Warranty</th>
                      <th className="py-2.5 px-3 text-center w-12">Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 text-neutral-800">
                    {order.items && order.items.length > 0 ? (
                      order.items.map((item, idx) => {
                        const warrantyDuration = getItemWarranty(item.sku, item.name);
                        return (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50'}>
                            <td className="py-2.5 px-3 text-center font-mono text-neutral-500">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-neutral-900">
                              <div>{item.name}</div>
                              {item.barcode && (
                                <div className="text-[10px] font-mono text-neutral-400">
                                  Barcode: {item.barcode}
                                </div>
                              )}
                              {item.returned && (
                                <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] bg-red-100 text-red-700 font-bold">
                                  [Returned Item]
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-neutral-600 text-[11px]">
                              {item.sku}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold font-mono bg-purple-50 text-purple-700 border border-purple-200">
                                {warrantyDuration}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold">
                              {item.quantity}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-neutral-700">
                              Rs. {Number(item.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-neutral-900">
                              Rs. {Number(item.unitPrice * item.quantity).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-4 text-center text-neutral-400 italic">
                          No items listed on this invoice
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 4. TOTALS & SUMMARY SECTION */}
              <div className="flex justify-end mb-6">
                <div className="w-full sm:w-72 bg-neutral-50 border border-neutral-200 rounded-lg p-3.5 space-y-1.5 text-xs">
                  <div className="flex justify-between text-neutral-600">
                    <span>Subtotal:</span>
                    <span className="font-mono tabular-nums font-medium">
                      Rs. {subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {order.courierFee > 0 && (
                    <div className="flex justify-between text-neutral-600">
                      <span>Delivery / Courier Fee:</span>
                      <span className="font-mono tabular-nums">
                        Rs. {order.courierFee.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  {order.gatewayFeePercent > 0 && (
                    <div className="flex justify-between text-neutral-600">
                      <span>Payment Gateway Fee ({order.gatewayFeePercent}%):</span>
                      <span className="font-mono tabular-nums">
                        Rs. {(order.gatewayFeeAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  <div className="border-t-2 border-neutral-900 pt-2 flex justify-between items-center text-sm">
                    <span className="font-bold text-neutral-950 uppercase tracking-tight">
                      Grand Total:
                    </span>
                    <span className="font-extrabold font-mono text-base text-purple-700 tabular-nums">
                      Rs. {Number(order.grossTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. WARRANTY TERMS & CONDITIONS BOX (EXACT REQUIREMENTS) */}
              <div className="mb-6 bg-purple-50/60 border-2 border-purple-200 rounded-lg p-4 text-xs text-neutral-800">
                <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-purple-200 text-purple-900 font-bold uppercase tracking-wider text-[11px]">
                  <ShieldCheck className="w-4 h-4 text-purple-700" />
                  <span>WARRANTY TERMS & CONDITIONS</span>
                </div>

                <div className="space-y-2 text-[11px] leading-relaxed text-neutral-700">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-purple-700 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-neutral-900">Warranty Validity: </strong>
                      Warranty is valid only for manufacturing defects within the specified period.
                    </span>
                  </div>

                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="text-neutral-900">Warranty Void Notice: </strong>
                      Warranty will NOT apply / will be void under:
                      <ul className="list-disc pl-5 mt-1 space-y-0.5 text-neutral-800 font-medium">
                        <li>Physical damage (accidental drops, impacts, cracks, broken pins/ports)</li>
                        <li>Water damage (liquid spillage, corrosion, humidity exposure)</li>
                        <li>High voltage fluctuations (power surges, lightning strikes, burnt ICs)</li>
                        <li>Unauthorized tampering or repairs (broken warranty seals, third-party repairs)</li>
                      </ul>
                    </div>
                  </div>

                  <div className="text-[10px] text-neutral-500 pt-1 border-t border-purple-100">
                    * Please retain this original invoice copy for all warranty replacements and RMA claims. All serial numbers are logged into the WOWTEK verification portal.
                  </div>
                </div>
              </div>

              {/* 6. SIGNATURES & OFFICIAL STAMP */}
              <div className="border-t border-neutral-300 pt-6 mt-8">
                <div className="grid grid-cols-2 gap-8 text-xs">
                  {/* Customer Signature */}
                  <div className="text-center">
                    <div className="h-12 border-b border-dashed border-neutral-400 mb-2 flex items-end justify-center">
                      <span className="text-[10px] text-neutral-400 font-mono italic">
                        Customer Signature
                      </span>
                    </div>
                    <div className="font-semibold text-neutral-800">Customer Signature & Acceptance</div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      Received all items in brand-new working condition
                    </div>
                  </div>

                  {/* Authorized By WOWTEK */}
                  <div className="text-center">
                    <div className="h-12 border-b border-dashed border-neutral-400 mb-2 flex items-end justify-center relative">
                      {/* Stamp simulation */}
                      <div className="absolute -top-3 transform rotate-3 border-2 border-purple-700 text-purple-700 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest opacity-80 pointer-events-none">
                        WOWTEK · VERIFIED
                      </div>
                      <span className="text-[10px] text-neutral-400 font-mono italic">
                        Authorized Stamp
                      </span>
                    </div>
                    <div className="font-semibold text-neutral-800">
                      Authorized By (WOWTEK)
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      T-9 Pipe Road, Udumulla, Mulleriyawa · 0779673004
                    </div>
                  </div>
                </div>
              </div>

              {/* 7. FOOTER */}
              <div className="text-center text-[10px] text-neutral-400 mt-8 pt-3 border-t border-neutral-100 font-mono">
                WOWTEK OMS · Official Warranty Document · Hotline: 0779673004 · Generated: {new Date().toISOString()}
              </div>
            </div>
          ) : (
            /* =========================================================================
             * 80mm THERMAL SLIP VIEW (OPTIONAL ALTERNATIVE)
             * ========================================================================= */
            <div
              id="wowtek-thermal-content"
              className="w-full max-w-xs bg-white text-black p-4 rounded border border-neutral-300 font-mono text-xs space-y-3"
            >
              <div className="text-center pb-2 border-b border-dashed border-black">
                <div className="font-bold text-base tracking-wider">WOWTEK</div>
                <div className="text-[10px] text-neutral-800 font-sans font-semibold">
                  T-9 Pipe Road, Udumulla, Mulleriyawa
                </div>
                <div className="text-[10px] text-neutral-800 font-bold">
                  Hotline: 0779673004
                </div>
                <div className="text-[9px] text-neutral-600">OFFICIAL SALES & WARRANTY SLIP</div>
              </div>

              <div className="text-[10px] space-y-0.5">
                <div className="flex justify-between">
                  <span>INVOICE:</span>
                  <span className="font-bold">{order.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>DATE:</span>
                  <span>{orderDate} {orderTime}</span>
                </div>
                <div className="flex justify-between">
                  <span>CUSTOMER:</span>
                  <span className="font-bold">{order.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span>HOTLINE:</span>
                  <span>{order.customerPhone}</span>
                </div>
                <div className="flex justify-between">
                  <span>PAYMENT:</span>
                  <span>{order.paymentGatewayName}</span>
                </div>
              </div>

              <div className="border-t border-b border-dashed border-black py-2 space-y-1.5">
                {(order.items || []).map((it, idx) => (
                  <div key={idx} className="flex justify-between items-start text-[11px]">
                    <div>
                      <div>{it.name}</div>
                      <div className="text-[9px] text-neutral-600">
                        {it.quantity} x Rs. {Number(it.unitPrice).toLocaleString()}
                      </div>
                      <div className="text-[8px] text-purple-700">
                        Warranty: {getItemWarranty(it.sku, it.name)}
                      </div>
                    </div>
                    <div className="font-bold">
                      Rs. {Number(it.unitPrice * it.quantity).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-right text-[11px]">
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-black">
                  <span>TOTAL PAYABLE:</span>
                  <span>Rs. {Number(order.grossTotal).toLocaleString()}</span>
                </div>
              </div>

              {/* Compact Warranty Notice */}
              <div className="text-left text-[9px] text-neutral-700 pt-2 border-t border-dashed border-black space-y-1">
                <div className="font-bold uppercase text-[9px] text-black">
                  Warranty Notice:
                </div>
                <div>• Valid for manufacturing defects only within period.</div>
                <div>• Void under: Physical, water, voltage damage & tampering.</div>
                <div className="text-center pt-2 text-black font-bold">
                  *** THANK YOU FOR YOUR PURCHASE ***
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
