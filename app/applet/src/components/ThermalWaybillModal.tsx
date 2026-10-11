'use client';

import React, { useState, useEffect } from 'react';
import {
  Printer,
  Download,
  X,
  Copy,
  Check,
  Maximize2,
  ZoomOut,
  Truck,
} from 'lucide-react';
import { Order, Product, TransExpressWaybill } from '@/types';
import { generateCode128Bars } from '@/lib/barcode128';

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
      : 'TE-6798');

  // Recipient details
  const recipientName =
    resolvedOrder?.customerName || resolvedWaybill?.recipientName || 'Valued Customer';
  const recipientPhone =
    resolvedOrder?.customerPhone || resolvedWaybill?.recipientPhone || '077 000 0000';
  const deliveryAddress =
    resolvedOrder?.deliveryAddress || resolvedWaybill?.destination || 'Colombo, Sri Lanka';
  const destinationCity =
    resolvedOrder?.city || resolvedWaybill?.district || resolvedWaybill?.destination || '';

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
      const itemsRowsHtml = items.map((it, idx) => `
        <tr>
          <td style="font-size: 8pt; padding: 3px 2px; border-bottom: 1px dashed #ccc; text-align: center;">${idx + 1}</td>
          <td style="font-size: 8pt; padding: 3px 2px; border-bottom: 1px dashed #ccc;">
            <strong>${it.name}</strong><br>
            ${it.sku ? `<span style="font-size: 7pt; color: #444;">SKU: ${it.sku}</span>` : ''}
          </td>
          <td style="font-size: 8pt; padding: 3px 2px; border-bottom: 1px dashed #ccc; text-align: center; font-weight: bold;">${it.quantity}x</td>
          <td style="font-size: 8pt; padding: 3px 2px; border-bottom: 1px dashed #ccc; text-align: right; font-weight: bold;">Rs. ${Number(it.unitPrice).toLocaleString()}</td>
        </tr>
      `).join('');

      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>WOWTEK Thermal Waybill - ${trackingNumber}</title>
<style>
  @page {
    size: 100mm 150mm;
    margin: 4mm;
    background-color: #ffffff;
  }
  *, *::before, *::after {
    box-sizing: border-box;
  }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #000000;
    background-color: #ffffff;
    margin: 0;
    padding: 0;
    font-size: 9pt;
    line-height: 1.2;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .label-container {
    border: 2px solid #000;
    padding: 6px;
    background: #fff;
    width: 100%;
    max-width: 100mm;
    margin: 0 auto;
    box-sizing: border-box;
  }
  .header-table {
    width: 100%;
    border-collapse: collapse;
    border-bottom: 2px solid #000;
    padding-bottom: 4px;
    margin-bottom: 6px;
  }
  .header-table td {
    vertical-align: top;
    padding: 0;
  }
  .brand-title {
    font-size: 16pt;
    font-weight: bold;
    color: #000;
    margin: 0;
    letter-spacing: 0.5px;
  }
  .brand-sub {
    font-size: 7.5pt;
    color: #000;
    margin: 2px 0 0 0;
    line-height: 1.3;
  }
  .barcode-section {
    text-align: center;
    margin: 4px 0;
    padding: 4px;
    border: 1px solid #000;
  }
  .barcode-title {
    font-size: 7pt;
    font-weight: bold;
    text-transform: uppercase;
    margin-bottom: 2px;
  }
  .barcode-number {
    font-size: 9pt;
    font-weight: bold;
    font-family: 'Courier New', monospace;
    margin-top: 2px;
  }
  .info-grid {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 6px;
  }
  .info-grid td {
    width: 50%;
    vertical-align: top;
    padding: 2px;
  }
  .card {
    border: 1px solid #000;
    padding: 5px;
    min-height: 65px;
  }
  .card-title {
    font-size: 7pt;
    font-weight: bold;
    text-transform: uppercase;
    border-bottom: 1px solid #000;
    padding-bottom: 2px;
    margin-bottom: 3px;
  }
  .card-content {
    font-size: 8.5pt;
  }
  .name-highlight {
    font-weight: bold;
    font-size: 9.5pt;
  }
  .products-section {
    border: 1px solid #000;
    padding: 4px;
    margin-bottom: 6px;
  }
  .section-heading {
    font-size: 7pt;
    font-weight: bold;
    text-transform: uppercase;
    border-bottom: 1px solid #000;
    padding-bottom: 2px;
    margin-bottom: 4px;
  }
  .items-table {
    width: 100%;
    border-collapse: collapse;
  }
  .items-table th {
    font-size: 7pt;
    border-bottom: 1px solid #000;
    text-align: left;
    padding: 2px;
    text-transform: uppercase;
  }
  .meta-grid {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 6px;
  }
  .meta-grid td {
    width: 25%;
    border: 1px solid #000;
    padding: 4px 2px;
    text-align: center;
    font-size: 7.5pt;
  }
  .meta-val {
    font-weight: bold;
    font-size: 8.5pt;
    display: block;
    margin-top: 1px;
    font-family: monospace;
  }
  .cod-banner {
    border: 2px solid #000;
    background-color: #000;
    color: #fff;
    text-align: center;
    padding: 6px;
    margin-top: 4px;
  }
  .cod-title {
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .cod-amount {
    font-size: 14pt;
    font-weight: bold;
    font-family: monospace;
    margin: 2px 0;
  }
  .cod-sub {
    font-size: 6.5pt;
    letter-spacing: 0.5px;
  }
  .footer-strip {
    text-align: center;
    font-size: 6pt;
    font-weight: bold;
    margin-top: 4px;
    letter-spacing: 0.5px;
  }
</style>
</head>
<body>

<div class="label-container">
    <table class="header-table">
        <tr>
            <td>
                <div class="brand-title">WOWTEK</div>
                <div class="brand-sub">
                    T/9 Pubudugama, Udumulla, Mulleriyawa<br>
                    HOTLINE: 077 967 3004<br>
                    COURIER: TRANS EXPRESS SRI LANKA
                </div>
            </td>
        </tr>
    </table>

    <div class="barcode-section">
        <div class="barcode-title">Standard Domestic Air Waybill Barcode</div>
        <div style="text-align: center; margin: 4px 0;">
          <svg viewBox="0 0 ${barcodeData.totalWidth} 40" style="width: 90%; height: 38px; display: inline-block;" preserveAspectRatio="none">
            ${barcodeData.rects.map((r) => `<rect x="${r.x}" y="0" width="${r.width}" height="40" fill="#000000" />`).join('')}
          </svg>
        </div>
        <div class="barcode-number">* ${trackingNumber} *</div>
    </div>

    <table class="info-grid">
        <tr>
            <td>
                <div class="card">
                    <div class="card-title">Deliver To (Recipient)</div>
                    <div class="card-content">
                        <div class="name-highlight">${recipientName}</div>
                        <div>${deliveryAddress}</div>
                        ${destinationCity ? `<div>${destinationCity}</div>` : ''}
                        <div style="font-weight: bold; margin-top: 2px;">TEL: ${recipientPhone}</div>
                    </div>
                </div>
            </td>
            <td>
                <div class="card">
                    <div class="card-title">Return To (Sender)</div>
                    <div class="card-content">
                        <div class="name-highlight">WOWTEK</div>
                        <div>T/9 Pubudugama, Udumulla, Mulleriyawa</div>
                        <div style="font-weight: bold; margin-top: 2px;">TEL: 077 967 3004</div>
                    </div>
                </div>
            </td>
        </tr>
    </table>

    <div class="products-section">
        <div class="section-heading">Parcel Contents / Product Manifest</div>
        <table class="items-table">
            <thead>
                <tr>
                    <th style="width: 10%; text-align: center;">#</th>
                    <th style="width: 58%;">Description / SKU</th>
                    <th style="width: 12%; text-align: center;">Qty</th>
                    <th style="width: 20%; text-align: right;">Price</th>
                </tr>
            </thead>
            <tbody>
                ${itemsRowsHtml}
            </tbody>
        </table>
    </div>

    <table class="meta-grid">
        <tr>
            <td>ORDER ID<span class="meta-val">${orderId}</span></td>
            <td>ORDER DATE<span class="meta-val">${bookingDateStr}</span></td>
            <td>COURIER<span class="meta-val">TRANS EXPRESS</span></td>
            <td>WEIGHT<span class="meta-val">${packageWeight} KG</span></td>
        </tr>
    </table>

    <div class="cod-banner">
        <div class="cod-title">${isCod && codAmount > 0 ? 'CASH ON DELIVERY (COD)' : 'PREPAID SHIPMENT · DO NOT COLLECT CASH'}</div>
        <div class="cod-amount">Rs. ${Number(codAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div class="cod-sub">${isCod && codAmount > 0 ? 'COLLECT FULL CASH BEFORE HANDING OVER PARCEL' : 'PAYMENT CONFIRMED VIA GATEWAY · DIRECT HANDOVER'}</div>
    </div>

    <div class="footer-strip">
        FRAGILE • ELECTRONIC PARTS TESTED • HANDLE WITH CARE
    </div>
</div>

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
            margin: 4mm !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: 100mm !important;
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
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
            width: 100% !important;
            max-width: 100mm !important;
            box-sizing: border-box !important;
            margin: 0 auto !important;
            padding: 6px !important;
            border: 2px solid #000000 !important;
            background: #ffffff !important;
            color: #000000 !important;
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
              className="w-full bg-white text-black border-2 border-black p-2 font-sans selection:bg-neutral-200 selection:text-black shadow-2xl rounded-sm flex flex-col justify-between"
              style={{
                fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                lineHeight: 1.2,
                boxSizing: 'border-box',
              }}
            >
              {/* 1. TOP HEADER: WOWTEK Merchant Details */}
              <div className="border-b-2 border-black pb-1 mb-1.5">
                <div className="font-bold text-[16pt] text-black tracking-wide leading-tight">
                  WOWTEK
                </div>
                <div className="text-[7.5pt] text-black mt-0.5 leading-tight">
                  T/9 Pubudugama, Udumulla, Mulleriyawa<br />
                  HOTLINE: 077 967 3004<br />
                  COURIER: TRANS EXPRESS SRI LANKA
                </div>
              </div>

              {/* 2. BARCODE AREA: Centered Tracking / Waybill Barcode + String */}
              <div className="text-center my-1 p-1 border border-black">
                <div className="text-[7pt] font-bold uppercase tracking-wide mb-1 text-black">
                  Standard Domestic Air Waybill Barcode
                </div>

                {/* SVG Code 128 Barcode Generator */}
                <div className="w-full flex justify-center overflow-hidden py-0.5">
                  <svg
                    viewBox={`0 0 ${barcodeData.totalWidth} 40`}
                    className="w-full max-w-[92%] h-10 object-contain"
                    preserveAspectRatio="none"
                  >
                    {barcodeData.rects.map((r, idx) => (
                      <rect key={idx} x={r.x} y={0} width={r.width} height={40} fill="#000000" />
                    ))}
                  </svg>
                </div>

                {/* Human-readable Barcode String */}
                <div className="font-mono text-[9pt] font-bold tracking-widest mt-0.5 text-black">
                  * {trackingNumber} *
                </div>
              </div>

              {/* 3. RECIPIENT & SENDER BOXES (Grid Split) */}
              <div className="grid grid-cols-2 gap-1.5 my-1">
                {/* Deliver To (Recipient) */}
                <div className="border border-black p-1.5 min-h-[65px] flex flex-col justify-between">
                  <div>
                    <div className="text-[7pt] font-bold uppercase border-b border-black pb-0.5 mb-1 text-black">
                      Deliver To (Recipient)
                    </div>
                    <div className="font-bold text-[9.5pt] leading-tight text-black">
                      {recipientName}
                    </div>
                    <div className="text-[8.5pt] leading-snug mt-0.5 text-black">
                      {deliveryAddress}
                    </div>
                    {destinationCity && (
                      <div className="text-[8pt] text-neutral-800 mt-0.5">
                        {destinationCity}
                      </div>
                    )}
                  </div>
                  <div className="font-bold text-[8.5pt] mt-1 border-t border-dotted border-black/40 pt-0.5">
                    TEL: {recipientPhone}
                  </div>
                </div>

                {/* Return To (Sender) */}
                <div className="border border-black p-1.5 min-h-[65px] flex flex-col justify-between">
                  <div>
                    <div className="text-[7pt] font-bold uppercase border-b border-black pb-0.5 mb-1 text-black">
                      Return To (Sender)
                    </div>
                    <div className="font-bold text-[9.5pt] leading-tight text-black">
                      WOWTEK
                    </div>
                    <div className="text-[8.5pt] leading-snug mt-0.5 text-black">
                      T/9 Pubudugama, Udumulla, Mulleriyawa
                    </div>
                  </div>
                  <div className="font-bold text-[8.5pt] mt-1 border-t border-dotted border-black/40 pt-0.5">
                    TEL: 077 967 3004
                  </div>
                </div>
              </div>

              {/* 4. PARCEL CONTENTS / PRODUCT MANIFEST (No Warranty Column) */}
              <div className="border border-black p-1 my-1">
                <div className="text-[7pt] font-bold uppercase border-b border-black pb-0.5 mb-1 text-black">
                  Parcel Contents / Product Manifest
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-[7pt] border-b border-black text-center p-0.5 uppercase font-bold w-[10%]">
                        #
                      </th>
                      <th className="text-[7pt] border-b border-black text-left p-0.5 uppercase font-bold w-[58%]">
                        Description / SKU
                      </th>
                      <th className="text-[7pt] border-b border-black text-center p-0.5 uppercase font-bold w-[12%]">
                        Qty
                      </th>
                      <th className="text-[7pt] border-b border-black text-right p-0.5 uppercase font-bold w-[20%]">
                        Price
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.slice(0, 5).map((it, idx) => (
                      <tr key={idx} className="border-b border-dashed border-neutral-300">
                        <td className="text-[8pt] p-1 text-center font-mono align-top">
                          {idx + 1}
                        </td>
                        <td className="text-[8pt] p-1 align-top">
                          <div className="font-bold leading-tight line-clamp-2">{it.name}</div>
                          {it.sku && (
                            <div className="text-[7pt] text-neutral-600 font-mono">
                              SKU: {it.sku}
                            </div>
                          )}
                        </td>
                        <td className="text-[8pt] p-1 text-center font-bold font-mono align-top">
                          {it.quantity}x
                        </td>
                        <td className="text-[8pt] p-1 text-right font-bold font-mono align-top whitespace-nowrap">
                          Rs. {Number(it.unitPrice).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {items.length > 5 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="text-[7pt] p-1 text-center font-mono font-bold bg-neutral-100"
                        >
                          + {items.length - 5} additional items inside parcel
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 5. META GRID: Order ID, Date, Courier, Weight */}
              <div className="grid grid-cols-4 my-1 border border-black divide-x divide-black text-center">
                <div className="p-1">
                  <div className="text-[7pt] text-black uppercase">ORDER ID</div>
                  <span className="font-bold text-[8.5pt] block mt-0.5 font-mono truncate text-black">
                    {orderId}
                  </span>
                </div>
                <div className="p-1">
                  <div className="text-[7pt] text-black uppercase">ORDER DATE</div>
                  <span className="font-bold text-[8pt] block mt-0.5 whitespace-nowrap text-black">
                    {bookingDateStr}
                  </span>
                </div>
                <div className="p-1">
                  <div className="text-[7pt] text-black uppercase">COURIER</div>
                  <span className="font-bold text-[8.5pt] block mt-0.5 text-black">
                    TRANS EXPRESS
                  </span>
                </div>
                <div className="p-1">
                  <div className="text-[7pt] text-black uppercase">WEIGHT</div>
                  <span className="font-bold text-[8.5pt] block mt-0.5 font-mono text-black">
                    {packageWeight} KG
                  </span>
                </div>
              </div>

              {/* 6. COD BANNER: Bold Prominent Inverted Box */}
              <div className="border-2 border-black bg-black text-white text-center p-1.5 mt-1">
                <div className="text-[7.5pt] uppercase tracking-wider font-semibold">
                  {isCod && codAmount > 0
                    ? 'CASH ON DELIVERY (COD)'
                    : 'PREPAID SHIPMENT · DO NOT COLLECT CASH'}
                </div>
                <div className="text-[14pt] font-black font-mono my-0.5 leading-tight">
                  Rs. {Number(codAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[6.5pt] tracking-wider text-neutral-200 uppercase font-medium">
                  {isCod && codAmount > 0
                    ? 'COLLECT FULL CASH BEFORE HANDING OVER PARCEL'
                    : 'PAYMENT CONFIRMED VIA GATEWAY · DIRECT HANDOVER'}
                </div>
              </div>

              {/* 7. FOOTER STRIP */}
              <div className="text-center text-[6pt] font-bold tracking-wider mt-1.5 pt-1 border-t border-black text-black uppercase">
                FRAGILE • ELECTRONIC PARTS TESTED • HANDLE WITH CARE
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
