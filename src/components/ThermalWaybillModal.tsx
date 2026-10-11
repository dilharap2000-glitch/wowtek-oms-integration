'use client';

import React, { useState, useEffect } from 'react';
import {
  Printer,
  Download,
  X,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Package,
  Truck,
  ShieldCheck,
} from 'lucide-react';
import { Order, Product, TransExpressWaybill } from '@/types';
import { generateCode128Bars } from '@/lib/barcode128';
import { getDestinationPortCode } from '@/lib/districtPortCode';

interface ThermalWaybillModalProps {
  order?: Order | null;
  waybill?: TransExpressWaybill | null;
  orders?: Order[];
  waybills?: TransExpressWaybill[];
  products?: Product[];
  onClose: () => void;
  onMarkPrinted?: (id: string) => void;
}

export const ThermalWaybillModal: React.FC<ThermalWaybillModalProps> = ({
  order: initialOrder,
  waybill: initialWaybill,
  orders = [],
  waybills = [],
  products = [],
  onClose,
  onMarkPrinted,
}) => {
  const [copied, setCopied] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<'fit' | '100%'>('fit');
  const [downloading, setDownloading] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Resolve matching Order & Waybill
  const resolvedWaybill: TransExpressWaybill | null =
    initialWaybill ||
    (initialOrder
      ? waybills.find(
          (w) =>
            w.orderId === initialOrder.id ||
            w.orderId === initialOrder.invoiceNumber ||
            w.trackingNumber === initialOrder.waybillNumber ||
            w.trackingNumber === initialOrder.transExpressTrackingNumber
        ) || null
      : null);

  const resolvedOrder: Order | null =
    initialOrder ||
    (initialWaybill
      ? orders.find(
          (o) =>
            o.id === initialWaybill.orderId ||
            o.invoiceNumber === initialWaybill.orderId ||
            o.waybillNumber === initialWaybill.trackingNumber ||
            o.transExpressTrackingNumber === initialWaybill.trackingNumber
        ) || null
      : null);

  // Tracking / Waybill Number
  const trackingNumber =
    resolvedWaybill?.trackingNumber ||
    resolvedOrder?.waybillNumber ||
    resolvedOrder?.transExpressTrackingNumber ||
    (resolvedOrder
      ? `TE-${resolvedOrder.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '')}`
      : 'TE-00000000');

  // Recipient details
  const recipientName =
    resolvedOrder?.customerName || resolvedWaybill?.recipientName || 'Valued Customer';
  const recipientPhone =
    resolvedOrder?.customerPhone || resolvedWaybill?.recipientPhone || '077 000 0000';
  const deliveryAddress =
    resolvedOrder?.deliveryAddress || resolvedWaybill?.destination || 'Colombo, Sri Lanka';
  const destinationCity =
    resolvedOrder?.city || resolvedWaybill?.district || resolvedWaybill?.destination || 'Colombo';
  const destinationDistrict =
    resolvedWaybill?.district || resolvedOrder?.city || 'Colombo';

  // Port sorting code (e.g., CMB, GPH, KDY)
  const portCode = getDestinationPortCode(destinationDistrict || destinationCity);

  // COD calculation
  const isCod =
    resolvedWaybill !== null
      ? resolvedWaybill.codAmount > 0
      : resolvedOrder
      ? resolvedOrder.paymentGateway === 'cash_cod' ||
        resolvedOrder.paymentGatewayName?.toLowerCase().includes('cod') ||
        resolvedOrder.paymentGatewayName?.toLowerCase().includes('cash')
      : false;

  const codAmount = resolvedWaybill
    ? resolvedWaybill.codAmount
    : isCod && resolvedOrder
    ? resolvedOrder.grossTotal
    : 0;

  // Order ID & Booking Date
  const orderId = resolvedOrder?.invoiceNumber || resolvedWaybill?.orderId || `ORD-${trackingNumber}`;
  const bookingDateStr = resolvedOrder?.createdAt
    ? new Date(resolvedOrder.createdAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : resolvedWaybill?.bookingDate ||
      new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
  const bookingTimeStr = resolvedOrder?.createdAt
    ? new Date(resolvedOrder.createdAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });

  // Package weight
  const packageWeight = resolvedWaybill?.weightKg || 1.0;

  // Items list
  const items = resolvedOrder?.items && resolvedOrder.items.length > 0
    ? resolvedOrder.items
    : [
        {
          sku: 'WT-PKG-01',
          barcode: trackingNumber,
          name: resolvedWaybill?.courierNotes || 'E-Commerce Computer Hardware Parcel',
          quantity: 1,
          unitPrice: codAmount || 0,
          costPrice: 0,
        },
      ];

  // Helper to resolve warranty duration
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
    if (lower.includes('mouse') || lower.includes('headset') || lower.includes('cable') || lower.includes('pad')) {
      return '12 Months';
    }
    return '12 Months';
  };

  // Generate Code 128 Bars for barcode
  const barcodeData = generateCode128Bars(trackingNumber, 1.8);

  const handlePrint = () => {
    document.body.classList.add('printing-thermal');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-thermal');
    }, 1000);

    if (resolvedWaybill?.id && onMarkPrinted) {
      onMarkPrinted(resolvedWaybill.id);
    }
  };

  const handleCopyTracking = () => {
    navigator.clipboard.writeText(trackingNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadHtml = () => {
    setDownloading(true);
    try {
      const labelElement = document.getElementById('thermal-waybill-label-print-area');
      if (!labelElement) return;

      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>WOWTEK Thermal Waybill - ${trackingNumber}</title>
  <style>
    @page {
      size: 100mm 150mm;
      margin: 0;
    }
    html, body {
      width: 100mm;
      height: 150mm;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .label-wrapper {
      width: 100mm;
      height: 150mm;
      max-height: 150mm;
      box-sizing: border-box;
      padding: 3.5mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border: 2px solid #000000;
      background: #ffffff;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #000000; padding: 2px 4px; font-size: 8.5px; }
    th { background: #000000; color: #ffffff; font-weight: bold; }
    .inv-box { background: #000000; color: #ffffff; }
    .border-b-thick { border-bottom: 2px solid #000000; }
    .border-t-thick { border-top: 2px solid #000000; }
    .border-thick { border: 2px solid #000000; }
  </style>
</head>
<body>
  ${labelElement.outerHTML}
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `WOWTEK-Waybill-${trackingNumber}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export waybill HTML:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      {/* Dynamic Print CSS Injection for 100mm x 150mm Direct Thermal */}
      <style>{`
        @media print {
          @page {
            size: 100mm 150mm !important;
            margin: 0 !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: 100mm !important;
            height: 150mm !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          #thermal-waybill-label-print-area,
          #thermal-waybill-label-print-area * {
            visibility: visible !important;
          }
          #thermal-waybill-label-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100mm !important;
            height: 150mm !important;
            max-height: 150mm !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 3mm !important;
            border: 2px solid #000000 !important;
            background: #ffffff !important;
            color: #000000 !important;
            overflow: hidden !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[96vh]">
        {/* Top Modal Controls Header */}
        <div className="flex flex-wrap items-center justify-between p-3.5 sm:p-4 border-b border-neutral-800 bg-neutral-950 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
              <Printer className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-wide">
                  4x6 Thermal Shipping Waybill
                </h3>
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-mono font-semibold">
                  100mm × 150mm
                </span>
                <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 text-[10px] font-mono">
                  Daraz Standard
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5 font-mono">
                Tracking: <span className="text-white font-bold">{trackingNumber}</span> · Trans Express
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom / Scale Toggle */}
            <button
              onClick={() => setZoomLevel((prev) => (prev === 'fit' ? '100%' : 'fit'))}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 text-xs font-medium transition-colors flex items-center gap-1"
              title="Toggle Scale"
            >
              {zoomLevel === 'fit' ? (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">100% Scale</span>
                </>
              ) : (
                <>
                  <ZoomOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Fit Window</span>
                </>
              )}
            </button>

            {/* Copy Tracking */}
            <button
              onClick={handleCopyTracking}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 text-xs font-medium transition-colors flex items-center gap-1"
              title="Copy Tracking Number"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy TE#'}</span>
            </button>

            {/* Download HTML */}
            <button
              onClick={handleDownloadHtml}
              disabled={downloading}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 text-xs font-medium transition-colors flex items-center gap-1"
              title="Download 4x6 Label HTML"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">HTML</span>
            </button>

            {/* Print Primary Button */}
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-lg shadow-purple-600/30"
            >
              <Printer className="w-4 h-4" />
              <span>Print 4x6 Label</span>
            </button>

            {/* Close Modal */}
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 bg-neutral-950 overflow-y-auto flex justify-center items-start flex-1 min-h-[460px]">
          {/* Label Card Container with Realistic Thermal Paper Styling */}
          <div
            className={`transition-all duration-200 ${
              zoomLevel === '100%'
                ? 'w-[100mm] min-w-[100mm] max-w-[100mm]'
                : 'w-full max-w-[420px]'
            }`}
          >
            {/* Pure Monochrome 100mm x 150mm Thermal Waybill Layout */}
            <div
              id="thermal-waybill-label-print-area"
              className="w-full bg-white text-black border-2 border-black p-3 font-sans selection:bg-neutral-200 selection:text-black shadow-2xl rounded-sm flex flex-col justify-between"
              style={{
                aspectRatio: '100 / 150',
                minHeight: '148mm',
                maxHeight: '150mm',
                boxSizing: 'border-box',
              }}
            >
              {/* =========================================================================
               * 1. TOP HEADER: WOWTEK Merchant Details & Destination Port Code
               * ========================================================================= */}
              <div className="border-b-2 border-black pb-1.5">
                <div className="flex items-start justify-between gap-2">
                  {/* Left: Merchant Title & Courier Brand */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-lg tracking-tight leading-none">WOWTEK</span>
                      <span className="text-[9px] font-black tracking-widest px-1 py-0.5 bg-black text-white rounded-xs">
                        LOGISTICS
                      </span>
                    </div>
                    <div className="text-[8.5px] font-bold text-neutral-800 mt-0.5 leading-tight">
                      T/9 Pubudugama, Udumulla, Mulleriyawa
                    </div>
                    <div className="text-[8.5px] font-black text-neutral-900 leading-tight">
                      HOTLINE: 077 967 3004
                    </div>
                    <div className="text-[8px] font-bold tracking-wider text-neutral-700 mt-0.5 uppercase">
                      COURIER: TRANS EXPRESS SRI LANKA
                    </div>
                  </div>

                  {/* Right: Destination Port Code Badge (CMB, GPH, KDY etc) */}
                  <div className="flex flex-col items-end">
                    <div className="bg-black text-white px-3 py-1 text-center border border-black shadow-xs">
                      <div className="text-[7.5px] font-black tracking-wider uppercase leading-none">PORT / HUB</div>
                      <div className="text-xl font-black font-mono tracking-wider leading-none mt-0.5">
                        {portCode}
                      </div>
                    </div>
                    <div className="text-[8px] font-black uppercase tracking-tight text-neutral-900 mt-0.5 text-right font-mono">
                      {destinationDistrict.substring(0, 12).toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>

              {/* =========================================================================
               * 2. BARCODE AREA: Centered Tracking / Waybill Barcode + String
               * ========================================================================= */}
              <div className="text-center py-1.5 border-b-2 border-black flex flex-col items-center justify-center">
                <div className="text-[8px] font-black tracking-widest uppercase mb-0.5 text-neutral-900">
                  STANDARD DOMESTIC AIR WAYBILL BARCODE
                </div>

                {/* SVG Code 128 Barcode Generator */}
                <div className="w-full flex justify-center overflow-hidden py-0.5">
                  <svg
                    viewBox={`0 0 ${barcodeData.totalWidth} 44`}
                    className="w-full max-w-[92%] h-10 object-contain"
                    preserveAspectRatio="none"
                  >
                    {barcodeData.rects.map((r, idx) => (
                      <rect key={idx} x={r.x} y={0} width={r.width} height={44} fill="#000000" />
                    ))}
                  </svg>
                </div>

                {/* Human-readable Barcode String */}
                <div className="font-mono text-sm font-black tracking-widest mt-0.5 text-black">
                  * {trackingNumber} *
                </div>
              </div>

              {/* =========================================================================
               * 3. RECIPIENT & SENDER BOXES (Grid Split)
               * ========================================================================= */}
              <div className="grid grid-cols-2 divide-x-2 divide-black border-b-2 border-black text-[9px] leading-tight">
                {/* Recipient Box */}
                <div className="pr-1.5 py-1 space-y-0.5">
                  <div className="text-[7.5px] font-black uppercase tracking-wider bg-black text-white px-1 py-0.5 inline-block">
                    DELIVER TO (RECIPIENT)
                  </div>
                  <div className="font-black text-xs text-black leading-tight pt-0.5">
                    {recipientName}
                  </div>
                  <div className="text-[8.5px] font-bold text-neutral-900 leading-snug line-clamp-3">
                    {deliveryAddress}
                  </div>
                  <div className="text-[9px] font-black text-neutral-900 pt-0.5">
                    {destinationCity} · <span className="uppercase">{destinationDistrict}</span>
                  </div>
                  <div className="text-[10.5px] font-black font-mono mt-0.5 text-black border-t border-black/40 pt-0.5">
                    TEL: {recipientPhone}
                  </div>
                </div>

                {/* Sender Box */}
                <div className="pl-1.5 py-1 space-y-0.5 flex flex-col justify-between">
                  <div>
                    <div className="text-[7.5px] font-black uppercase tracking-wider border border-black px-1 py-0.5 inline-block text-black">
                      RETURN TO (SENDER)
                    </div>
                    <div className="font-black text-[10px] text-black leading-tight pt-0.5">
                      WOWTEK (PVT) LTD
                    </div>
                    <div className="text-[8px] font-semibold text-neutral-900 leading-tight">
                      T/9 Pubudugama, Udumulla, Mulleriyawa, Colombo
                    </div>
                    <div className="text-[9px] font-bold font-mono text-black mt-0.5">
                      TEL: 077 967 3004
                    </div>
                  </div>
                  <div className="text-[7px] font-bold text-neutral-700 uppercase border-t border-dashed border-black pt-0.5">
                    RMA & Warranty Hub Registered
                  </div>
                </div>
              </div>

              {/* =========================================================================
               * 4. ORDER ITEM TABLE: Ordered Products, Qty, Price & Warranty
               * ========================================================================= */}
              <div className="py-1 border-b-2 border-black flex-1 min-h-[70px]">
                <div className="flex items-center justify-between pb-0.5">
                  <span className="text-[7.5px] font-black uppercase tracking-wider text-black">
                    PARCEL CONTENTS / PRODUCT MANIFEST
                  </span>
                  <span className="text-[7.5px] font-mono font-bold text-neutral-800">
                    ITEMS: {items.reduce((s, it) => s + (it.quantity || 1), 0)}
                  </span>
                </div>

                <table className="w-full text-left border-collapse border border-black">
                  <thead>
                    <tr className="bg-black text-white text-[7.5px]">
                      <th className="p-0.5 text-center w-5 border border-black font-black">#</th>
                      <th className="p-0.5 border border-black font-black">DESCRIPTION / SKU</th>
                      <th className="p-0.5 text-center w-8 border border-black font-black">QTY</th>
                      <th className="p-0.5 text-right w-16 border border-black font-black">PRICE</th>
                      <th className="p-0.5 text-center w-16 border border-black font-black">WARRANTY</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-[8px]">
                    {items.slice(0, 4).map((it, idx) => (
                      <tr key={idx} className="align-middle">
                        <td className="p-0.5 text-center font-mono font-bold border border-black">
                          {idx + 1}
                        </td>
                        <td className="p-0.5 font-bold border border-black leading-tight">
                          <div className="line-clamp-1">{it.name}</div>
                          {it.sku && (
                            <div className="text-[6.5px] font-mono font-normal text-neutral-800">
                              SKU: {it.sku}
                            </div>
                          )}
                        </td>
                        <td className="p-0.5 text-center font-mono font-black border border-black">
                          {it.quantity}x
                        </td>
                        <td className="p-0.5 text-right font-mono font-bold border border-black whitespace-nowrap">
                          Rs. {Number(it.unitPrice).toLocaleString()}
                        </td>
                        <td className="p-0.5 text-center font-mono font-black border border-black whitespace-nowrap">
                          {getItemWarranty(it.sku, it.name)}
                        </td>
                      </tr>
                    ))}
                    {items.length > 4 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-0.5 text-center font-mono font-bold text-[7.5px] border border-black bg-neutral-100"
                        >
                          + {items.length - 4} additional items packed inside parcel
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* =========================================================================
               * 5. META DATA BAR: Order ID, Date, Courier & Weight
               * ========================================================================= */}
              <div className="grid grid-cols-4 divide-x divide-black border-b-2 border-black py-1 text-[7.5px] font-mono text-center">
                <div className="px-1">
                  <div className="font-bold text-neutral-600 uppercase">ORDER ID</div>
                  <div className="font-black text-[8.5px] text-black truncate">{orderId}</div>
                </div>
                <div className="px-1">
                  <div className="font-bold text-neutral-600 uppercase">ORDER DATE</div>
                  <div className="font-black text-[8px] text-black whitespace-nowrap">{bookingDateStr}</div>
                </div>
                <div className="px-1">
                  <div className="font-bold text-neutral-600 uppercase">COURIER</div>
                  <div className="font-black text-[8.5px] text-black">TRANS EXPRESS</div>
                </div>
                <div className="px-1">
                  <div className="font-bold text-neutral-600 uppercase">WEIGHT</div>
                  <div className="font-black text-[8.5px] text-black">{packageWeight} KG</div>
                </div>
              </div>

              {/* =========================================================================
               * 6. COD BOX: Prominent Black Inverted Box (Large Bold Text)
               * ========================================================================= */}
              <div className="py-1">
                {isCod && codAmount > 0 ? (
                  <div className="bg-black text-white p-2 border-2 border-black text-center space-y-0.5">
                    <div className="text-[8.5px] font-black uppercase tracking-widest">
                      CASH ON DELIVERY (COD) · COLLECT CASH
                    </div>
                    <div className="text-xl sm:text-2xl font-black font-mono tracking-tight leading-none py-0.5">
                      Rs. {Number(codAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[7.5px] font-black uppercase tracking-wider text-neutral-200">
                      *** RIDER: COLLECT FULL CASH BEFORE HANDING OVER PARCEL ***
                    </div>
                  </div>
                ) : (
                  <div className="bg-black text-white p-2 border-2 border-black text-center space-y-0.5">
                    <div className="text-[8.5px] font-black uppercase tracking-widest">
                      PREPAID SHIPMENT · DO NOT COLLECT CASH
                    </div>
                    <div className="text-lg sm:text-xl font-black font-mono tracking-tight leading-none py-0.5">
                      COD: Rs. 0.00 (PAID ONLINE)
                    </div>
                    <div className="text-[7.5px] font-black uppercase tracking-wider text-neutral-200">
                      *** PAYMENT CONFIRMED VIA GATEWAY · DIRECT HANDOVER ***
                    </div>
                  </div>
                )}
              </div>

              {/* =========================================================================
               * 7. COMPLIANCE & FOOTER
               * ========================================================================= */}
              <div className="border-t-2 border-black pt-1 mt-0.5 flex items-center justify-between text-[7px] font-mono text-neutral-800">
                <div className="font-bold uppercase">
                  FRAGILE · ELECTRONIC PARTS TESTED · HANDLE WITH CARE
                </div>
                <div className="font-bold">
                  WOWTEK OMS · 100x150MM THERMAL
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions Bar */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-950 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-neutral-400 text-[11px]">
            <Truck className="w-3.5 h-3.5 text-purple-400" />
            <span>Formatted for standard 100mm × 150mm direct thermal printers (Xprinter, Gprinter, Zebra).</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-800 text-xs font-medium transition-colors"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-lg shadow-purple-600/30"
            >
              <Printer className="w-4 h-4" />
              <span>Print Thermal Label (100×150mm)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
