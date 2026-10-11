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
  const items =
    resolvedOrder?.items && resolvedOrder.items.length > 0
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

  // Generate Code 128 Bars for crisp scannable thermal barcode
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
      const itemsRowsHtml = items
        .map(
          (it, idx) => `
                <tr>
                    <td>${idx + 1}</td>
                    <td>
                        ${it.name}<br>
                        ${it.sku ? `<span style="font-size: 7pt; color: #444;">SKU: ${it.sku}</span>` : ''}
                    </td>
                    <td style="text-align: center;">${it.quantity}x</td>
                    <td style="text-align: right;">Rs. ${Number(it.unitPrice).toLocaleString()}</td>
                </tr>`
        )
        .join('');

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
        line-height: 1.25;
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
    .barcode-svg-wrap {
        display: flex;
        justify-content: center;
        margin: 2px 0;
    }
    .barcode-number {
        font-size: 9pt;
        font-weight: bold;
        font-family: 'Courier New', monospace;
        margin-top: 1px;
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
    .items-table td {
        font-size: 8pt;
        padding: 3px 2px;
        border-bottom: 1px dashed #ccc;
        vertical-align: top;
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
        <div style="text-align: center; margin: 3px 0;">
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
                        ${destinationCity && destinationCity !== deliveryAddress ? `<div>${destinationCity}</div>` : ''}
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
                    <th style="width: 10%;">#</th>
                    <th style="width: 60%;">Description / SKU</th>
                    <th style="width: 12%; text-align: center;">Qty</th>
                    <th style="width: 18%; text-align: right;">Price</th>
                </tr>
            </thead>
            <tbody>
                ${itemsRowsHtml}
            </tbody>
        </table>
    </div>

    <table class="meta-grid">
        <tr>
            <td>
                Order ID
                <span class="meta-val">${orderId}</span>
            </td>
            <td>
                Order Date
                <span class="meta-val">${bookingDateStr}</span>
            </td>
            <td>
                Courier
                <span class="meta-val">TRANS EXPRESS</span>
            </td>
            <td>
                Weight
                <span class="meta-val">${packageWeight} KG</span>
            </td>
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
            width: 100% !important;
            max-width: 100mm !important;
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
                  Trans Express
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
              className="w-full bg-white text-black border-2 border-black p-[6px] font-sans selection:bg-neutral-200 selection:text-black shadow-2xl rounded-xs flex flex-col justify-between"
              style={{
                fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                color: '#000000',
                backgroundColor: '#ffffff',
                fontSize: '9pt',
                lineHeight: 1.2,
                boxSizing: 'border-box',
              }}
            >
              {/* Header Table */}
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  borderBottom: '2px solid #000',
                  paddingBottom: '4px',
                  marginBottom: '6px',
                }}
              >
                <tbody>
                  <tr>
                    <td style={{ verticalAlign: 'top', padding: 0 }}>
                      <div
                        style={{
                          fontSize: '16pt',
                          fontWeight: 'bold',
                          color: '#000',
                          margin: 0,
                          letterSpacing: '0.5px',
                        }}
                      >
                        WOWTEK
                      </div>
                      <div
                        style={{
                          fontSize: '7.5pt',
                          color: '#000',
                          margin: '2px 0 0 0',
                          lineHeight: 1.25,
                        }}
                      >
                        T/9 Pubudugama, Udumulla, Mulleriyawa<br />
                        HOTLINE: 077 967 3004<br />
                        COURIER: TRANS EXPRESS SRI LANKA
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Barcode Section */}
              <div
                style={{
                  textAlign: 'center',
                  margin: '4px 0',
                  padding: '4px',
                  border: '1px solid #000',
                }}
              >
                <div
                  style={{
                    fontSize: '7pt',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    marginBottom: '2px',
                  }}
                >
                  Standard Domestic Air Waybill Barcode
                </div>
                <div style={{ textAlign: 'center', margin: '2px 0' }}>
                  <svg
                    viewBox={`0 0 ${barcodeData.totalWidth} 40`}
                    style={{ width: '92%', height: '36px', display: 'inline-block' }}
                    preserveAspectRatio="none"
                  >
                    {barcodeData.rects.map((r, idx) => (
                      <rect key={idx} x={r.x} y={0} width={r.width} height={40} fill="#000000" />
                    ))}
                  </svg>
                </div>
                <div
                  style={{
                    fontSize: '9pt',
                    fontWeight: 'bold',
                    fontFamily: "'Courier New', monospace",
                    marginTop: '1px',
                  }}
                >
                  * {trackingNumber} *
                </div>
              </div>

              {/* Deliver To / Return To Info Grid */}
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  marginBottom: '6px',
                }}
              >
                <tbody>
                  <tr>
                    <td style={{ width: '50%', verticalAlign: 'top', padding: '2px' }}>
                      <div
                        style={{
                          border: '1px solid #000',
                          padding: '5px',
                          minHeight: '65px',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '7pt',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            borderBottom: '1px solid #000',
                            paddingBottom: '2px',
                            marginBottom: '3px',
                          }}
                        >
                          Deliver To (Recipient)
                        </div>
                        <div style={{ fontSize: '8.5pt' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '9.5pt' }}>
                            {recipientName}
                          </div>
                          <div>{deliveryAddress}</div>
                          {destinationCity && destinationCity !== deliveryAddress && (
                            <div style={{ fontSize: '8pt', color: '#333' }}>{destinationCity}</div>
                          )}
                          <div style={{ fontWeight: 'bold', marginTop: '2px' }}>
                            TEL: {recipientPhone}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ width: '50%', verticalAlign: 'top', padding: '2px' }}>
                      <div
                        style={{
                          border: '1px solid #000',
                          padding: '5px',
                          minHeight: '65px',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '7pt',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            borderBottom: '1px solid #000',
                            paddingBottom: '2px',
                            marginBottom: '3px',
                          }}
                        >
                          Return To (Sender)
                        </div>
                        <div style={{ fontSize: '8.5pt' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '9.5pt' }}>
                            WOWTEK
                          </div>
                          <div>T/9 Pubudugama, Udumulla, Mulleriyawa</div>
                          <div style={{ fontWeight: 'bold', marginTop: '2px' }}>
                            TEL: 077 967 3004
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Parcel Contents / Product Manifest (Without Warranty Column) */}
              <div
                style={{
                  border: '1px solid #000',
                  padding: '4px',
                  marginBottom: '6px',
                }}
              >
                <div
                  style={{
                    fontSize: '7pt',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    borderBottom: '1px solid #000',
                    paddingBottom: '2px',
                    marginBottom: '4px',
                  }}
                >
                  Parcel Contents / Product Manifest
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th
                        style={{
                          fontSize: '7pt',
                          borderBottom: '1px solid #000',
                          textAlign: 'left',
                          padding: '2px',
                          textTransform: 'uppercase',
                          width: '10%',
                        }}
                      >
                        #
                      </th>
                      <th
                        style={{
                          fontSize: '7pt',
                          borderBottom: '1px solid #000',
                          textAlign: 'left',
                          padding: '2px',
                          textTransform: 'uppercase',
                          width: '60%',
                        }}
                      >
                        Description / SKU
                      </th>
                      <th
                        style={{
                          fontSize: '7pt',
                          borderBottom: '1px solid #000',
                          textAlign: 'center',
                          padding: '2px',
                          textTransform: 'uppercase',
                          width: '12%',
                        }}
                      >
                        Qty
                      </th>
                      <th
                        style={{
                          fontSize: '7pt',
                          borderBottom: '1px solid #000',
                          textAlign: 'right',
                          padding: '2px',
                          textTransform: 'uppercase',
                          width: '18%',
                        }}
                      >
                        Price
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.slice(0, 4).map((it, idx) => (
                      <tr key={idx}>
                        <td
                          style={{
                            fontSize: '8pt',
                            padding: '3px 2px',
                            borderBottom: '1px dashed #ccc',
                            verticalAlign: 'top',
                            fontFamily: 'monospace',
                          }}
                        >
                          {idx + 1}
                        </td>
                        <td
                          style={{
                            fontSize: '8pt',
                            padding: '3px 2px',
                            borderBottom: '1px dashed #ccc',
                            verticalAlign: 'top',
                          }}
                        >
                          <div style={{ fontWeight: 'bold' }}>{it.name}</div>
                          {it.sku && (
                            <span style={{ fontSize: '7pt', color: '#444' }}>
                              SKU: {it.sku}
                            </span>
                          )}
                        </td>
                        <td
                          style={{
                            fontSize: '8pt',
                            padding: '3px 2px',
                            borderBottom: '1px dashed #ccc',
                            verticalAlign: 'top',
                            textAlign: 'center',
                            fontWeight: 'bold',
                          }}
                        >
                          {it.quantity}x
                        </td>
                        <td
                          style={{
                            fontSize: '8pt',
                            padding: '3px 2px',
                            borderBottom: '1px dashed #ccc',
                            verticalAlign: 'top',
                            textAlign: 'right',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Rs. {Number(it.unitPrice).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {items.length > 4 && (
                      <tr>
                        <td
                          colSpan={4}
                          style={{
                            fontSize: '7pt',
                            padding: '3px 2px',
                            textAlign: 'center',
                            backgroundColor: '#f5f5f5',
                            fontWeight: 'bold',
                          }}
                        >
                          + {items.length - 4} additional items inside parcel
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Meta Grid: Order ID, Order Date, Courier, Weight */}
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  marginBottom: '6px',
                }}
              >
                <tbody>
                  <tr>
                    <td
                      style={{
                        width: '25%',
                        border: '1px solid #000',
                        padding: '4px 2px',
                        textAlign: 'center',
                        fontSize: '7.5pt',
                      }}
                    >
                      Order ID
                      <span
                        style={{
                          fontWeight: 'bold',
                          fontSize: '8.5pt',
                          display: 'block',
                          marginTop: '1px',
                          fontFamily: 'monospace',
                        }}
                      >
                        {orderId}
                      </span>
                    </td>
                    <td
                      style={{
                        width: '25%',
                        border: '1px solid #000',
                        padding: '4px 2px',
                        textAlign: 'center',
                        fontSize: '7.5pt',
                      }}
                    >
                      Order Date
                      <span
                        style={{
                          fontWeight: 'bold',
                          fontSize: '8.5pt',
                          display: 'block',
                          marginTop: '1px',
                        }}
                      >
                        {bookingDateStr}
                      </span>
                    </td>
                    <td
                      style={{
                        width: '25%',
                        border: '1px solid #000',
                        padding: '4px 2px',
                        textAlign: 'center',
                        fontSize: '7.5pt',
                      }}
                    >
                      Courier
                      <span
                        style={{
                          fontWeight: 'bold',
                          fontSize: '8.5pt',
                          display: 'block',
                          marginTop: '1px',
                        }}
                      >
                        TRANS EXPRESS
                      </span>
                    </td>
                    <td
                      style={{
                        width: '25%',
                        border: '1px solid #000',
                        padding: '4px 2px',
                        textAlign: 'center',
                        fontSize: '7.5pt',
                      }}
                    >
                      Weight
                      <span
                        style={{
                          fontWeight: 'bold',
                          fontSize: '8.5pt',
                          display: 'block',
                          marginTop: '1px',
                        }}
                      >
                        {packageWeight} KG
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* COD Banner */}
              <div
                style={{
                  border: '2px solid #000',
                  backgroundColor: '#000',
                  color: '#fff',
                  textAlign: 'center',
                  padding: '6px',
                  marginTop: '4px',
                }}
              >
                <div
                  style={{
                    fontSize: '7.5pt',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {isCod && codAmount > 0
                    ? 'CASH ON DELIVERY (COD)'
                    : 'PREPAID SHIPMENT · DO NOT COLLECT CASH'}
                </div>
                <div
                  style={{
                    fontSize: '14pt',
                    fontWeight: 'bold',
                    margin: '2px 0',
                    fontFamily: 'monospace',
                  }}
                >
                  Rs.{' '}
                  {Number(codAmount).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div
                  style={{
                    fontSize: '6.5pt',
                    letterSpacing: '0.5px',
                  }}
                >
                  {isCod && codAmount > 0
                    ? 'COLLECT FULL CASH BEFORE HANDING OVER PARCEL'
                    : 'PAYMENT CONFIRMED VIA GATEWAY · DIRECT HANDOVER'}
                </div>
              </div>

              {/* Footer Strip */}
              <div
                style={{
                  textAlign: 'center',
                  fontSize: '6pt',
                  fontWeight: 'bold',
                  marginTop: '4px',
                  letterSpacing: '0.5px',
                }}
              >
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
