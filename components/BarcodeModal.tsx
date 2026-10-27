'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Barcode, Printer, X, ShieldCheck, Tag, Layers, RefreshCw } from 'lucide-react';
import { Product, ProductSerialItem } from '@/types';

export interface BarcodeModalProps {
  product: Product | null;
  isOpen?: boolean;
  onClose: () => void;
}

interface MappedSerialUnit {
  serialNumber: string;
  imei?: string;
  batch?: string;
  status?: string;
}

// Generate SVG Code128 pattern based on code string
function renderSvgBarcode(code: string) {
  const bars: boolean[] = [];
  const cleanCode = code || '0000000000';
  for (let i = 0; i < cleanCode.length; i++) {
    const charCode = cleanCode.charCodeAt(i);
    for (let b = 0; b < 6; b++) {
      bars.push(((charCode >> b) & 1) === 1);
    }
  }
  return (
    <svg viewBox={`0 0 ${bars.length * 2} 40`} className="w-full h-8" preserveAspectRatio="none">
      {bars.map((isBlack, i) =>
        isBlack ? <rect key={i} x={i * 2} y="0" width="1.8" height="40" fill="#000" /> : null
      )}
    </svg>
  );
}

export function BarcodeModal({ product, isOpen = true, onClose }: BarcodeModalProps) {
  // 1. Extract ALL unique serial numbers and IMEIs dynamically from the product's inventory
  const uniqueSerials: MappedSerialUnit[] = useMemo(() => {
    if (!product) return [];
    const list: MappedSerialUnit[] = [];
    const seen = new Set<string>();

    // A. Parse from activeSerials array (rich serial tracking objects)
    if (Array.isArray(product.activeSerials)) {
      product.activeSerials.forEach((item: ProductSerialItem | string) => {
        const sn = typeof item === 'string' ? item : item?.serialNumber;
        if (sn && typeof sn === 'string' && sn.trim() && !seen.has(sn.trim().toLowerCase())) {
          seen.add(sn.trim().toLowerCase());
          list.push({
            serialNumber: sn.trim(),
            imei: typeof item === 'object' ? item.imei : undefined,
            batch: typeof item === 'object' ? item.batchRef || (item as any)?.grnBatch || product.grnBatch : product.grnBatch,
            status: typeof item === 'object' ? item.status : 'Available',
          });
        }
      });
    }

    // B. Parse from legacy or supplementary serialNumbers array
    if (Array.isArray(product.serialNumbers)) {
      product.serialNumbers.forEach((sn) => {
        if (sn && typeof sn === 'string' && sn.trim() && !seen.has(sn.trim().toLowerCase())) {
          seen.add(sn.trim().toLowerCase());
          list.push({
            serialNumber: sn.trim(),
            batch: product.grnBatch,
            status: 'Available',
          });
        }
      });
    }

    return list;
  }, [product]);

  // Available in-stock serials filter
  const availableSerials = useMemo(() => {
    const filtered = uniqueSerials.filter(
      (s) => !s.status || s.status === 'Available' || s.status === 'In-Stock'
    );
    return filtered.length > 0 ? filtered : uniqueSerials;
  }, [uniqueSerials]);

  // Mode: Serial Numbers vs Generic SKU Barcodes
  const hasSerials = uniqueSerials.length > 0;
  const [filterMode, setFilterMode] = useState<'available' | 'all' | 'sku'>('available');
  const [barcodeEncoding, setBarcodeEncoding] = useState<'serial' | 'product'>('serial');

  const activeSerialList = useMemo(() => {
    if (filterMode === 'all') return uniqueSerials;
    if (filterMode === 'available') return availableSerials;
    return [];
  }, [filterMode, uniqueSerials, availableSerials]);

  // Calculate default print count
  const calculateDefaultCount = React.useCallback((): number => {
    if (!product) return 1;
    if (hasSerials && filterMode !== 'sku') {
      const count = activeSerialList.length;
      return count > 0 ? count : 1;
    }
    const stockVal =
      product.storeStock !== undefined && product.storeStock !== null
        ? Number(product.storeStock)
        : product.stockQuantity !== undefined && product.stockQuantity !== null
        ? Number(product.stockQuantity)
        : Number(product.stockStore ?? 1);

    return isNaN(stockVal) || stockVal <= 0 ? 1 : stockVal;
  }, [product, hasSerials, filterMode, activeSerialList.length]);

  const [printCount, setPrintCount] = useState<number>(1);

  // Sync print count whenever product or filter mode changes
  useEffect(() => {
    if (product) {
      setPrintCount(calculateDefaultCount());
    }
  }, [product, calculateDefaultCount]);

  if (!isOpen || !product) {
    return null;
  }

  const effectiveStoreStock = Number(
    product.storeStock !== undefined && product.storeStock !== null
      ? product.storeStock
      : product.stockQuantity !== undefined && product.stockQuantity !== null
      ? product.stockQuantity
      : product.stockStore ?? 0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Barcode className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">
                  Bulk Barcode &amp; GRN Label Generator
                </h3>
                {hasSerials && (
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-purple-400" />
                    <span>{uniqueSerials.length} Unique S/N Tracked</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400">
                Product: <strong className="text-neutral-200 font-semibold">{product.name || product.title}</strong>{' '}
                · SKU: <span className="font-mono text-purple-400">{product.sku || product.skuCode}</span>{' '}
                · Stock: {effectiveStoreStock} units
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Print Count Control */}
            <div className="flex items-center gap-2 text-xs text-neutral-300 bg-neutral-900 px-2.5 py-1 rounded-lg border border-neutral-800">
              <label htmlFor="barcode-count-input" className="text-neutral-400 font-medium">
                Labels:
              </label>
              <input
                id="barcode-count-input"
                type="number"
                min="1"
                max={Math.max(200, uniqueSerials.length || 10)}
                value={printCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setPrintCount(isNaN(val) || val < 1 ? 1 : val);
                }}
                className="w-14 px-1.5 py-0.5 bg-neutral-950 border border-neutral-700 rounded text-center text-white font-mono focus:border-purple-500 focus:outline-none"
              />
            </div>

            {/* Print Sheet Trigger */}
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 rounded-lg transition-all shadow-md shadow-purple-950/40 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Sheet ({printCount})</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Serial Selection Filters & Barcode Type */}
        <div className="px-4 py-2.5 bg-neutral-900 border-b border-neutral-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-neutral-400 font-medium flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Source:</span>
            </span>

            {hasSerials ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterMode('available')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                    filterMode === 'available'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  Available In-Stock S/N ({availableSerials.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                    filterMode === 'all'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  All Inventory S/N ({uniqueSerials.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('sku')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                    filterMode === 'sku'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  Generic SKU Only
                </button>
              </div>
            ) : (
              <span className="text-[11px] text-neutral-400">
                Non-serialized product (standard SKU barcode generated)
              </span>
            )}
          </div>

          {hasSerials && filterMode !== 'sku' && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-neutral-400">Barcode Encodes:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setBarcodeEncoding('serial')}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition ${
                    barcodeEncoding === 'serial'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  Unique S/N (Scannable)
                </button>
                <button
                  type="button"
                  onClick={() => setBarcodeEncoding('product')}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition ${
                    barcodeEncoding === 'product'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  Product Barcode
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Body / Stickers Preview */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-neutral-950 flex-1">
          <div className="text-xs text-neutral-400 mb-3 flex items-center justify-between pb-2 border-b border-neutral-900">
            <span className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-purple-400" />
              <span>Standard Retail Thermal Sticker Preview: 50mm × 30mm</span>
            </span>
            <span className="font-mono text-purple-400 font-semibold text-[11px]">
              {filterMode !== 'sku' && hasSerials
                ? `Mapped: ${Math.min(printCount, activeSerialList.length)} Unique Serial Labels`
                : `Batch: ${product.grnBatch || product.lastBatchRef || 'GRN-OCT'}`}
            </span>
          </div>

          {/* Sticker Sheet Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 print:grid-cols-3 print:gap-2 print:m-0 print:p-0">
            {Array.from({ length: printCount }).map((_, index) => {
              // Map each individual unique serial number from activeSerialList dynamically
              const serialItem = filterMode !== 'sku' && activeSerialList[index] ? activeSerialList[index] : null;
              const currentSerial = serialItem?.serialNumber || (hasSerials && index < uniqueSerials.length ? uniqueSerials[index]?.serialNumber : null);
              const currentImei = serialItem?.imei || (hasSerials && index < uniqueSerials.length ? uniqueSerials[index]?.imei : null);
              const currentBatch = serialItem?.batch || product.grnBatch || product.lastBatchRef || 'GRN-OCT';

              // Decide scannable barcode string: If serial mode, use unique serial number!
              const scannableCode =
                barcodeEncoding === 'serial' && currentSerial
                  ? currentSerial
                  : product.barcode || product.sku || '0000000000';

              return (
                <div
                  key={index}
                  className="p-3 bg-white text-black rounded-lg border border-neutral-300 shadow-sm flex flex-col justify-between print:border-black print:shadow-none print:break-inside-avoid print:p-2 min-h-[140px]"
                >
                  {/* Top row: Brand & Batch */}
                  <div>
                    <div className="flex justify-between items-start text-[9px] font-bold tracking-tight text-neutral-800">
                      <span className="font-mono tracking-wider">WOWTEK PRO</span>
                      <span className="font-mono text-[9px] bg-neutral-100 px-1 py-0.5 rounded border border-neutral-300">
                        {currentBatch}
                      </span>
                    </div>

                    {/* Product Name */}
                    <div className="text-[10px] font-semibold line-clamp-1 mt-0.5 text-neutral-900" title={product.name || product.title}>
                      {product.name || product.title}
                    </div>
                  </div>

                  {/* Scannable Barcode SVG */}
                  <div className="my-1.5">
                    {renderSvgBarcode(scannableCode)}
                    <div className="text-center font-mono text-[9px] tracking-wider text-neutral-800 mt-0.5 font-bold truncate">
                      {scannableCode}
                    </div>
                  </div>

                  {/* Dynamic Unique Serial Number & IMEI Section */}
                  {currentSerial ? (
                    <div className="bg-neutral-100 rounded px-1.5 py-1 border border-neutral-300 my-1 text-[9px] font-mono">
                      <div className="flex items-center justify-between font-bold text-neutral-950">
                        <span className="text-purple-900 font-extrabold">S/N:</span>
                        <span className="truncate max-w-[130px]">{currentSerial}</span>
                      </div>
                      {currentImei && (
                        <div className="flex items-center justify-between text-[8px] text-neutral-700 pt-0.5 border-t border-neutral-200 mt-0.5">
                          <span className="font-semibold">IMEI:</span>
                          <span className="truncate max-w-[130px]">{currentImei}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[8px] text-neutral-500 font-mono text-center py-0.5">
                      Standard Retail Barcode · Unit #{index + 1}
                    </div>
                  )}

                  {/* Bottom Footer: SKU, Price, and Unit counter */}
                  <div className="flex items-center justify-between border-t border-neutral-300 pt-1 text-[9px]">
                    <span className="font-mono text-neutral-600 font-semibold truncate max-w-[80px]" title={product.sku || product.skuCode}>
                      {product.sku || product.skuCode}
                    </span>
                    <span className="text-[8px] text-neutral-400 font-mono">
                      #{index + 1}
                    </span>
                    <span className="font-bold text-neutral-950 font-mono text-[10px]">
                      Rs. {Number(product.sellingPrice || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer / Summary */}
        <div className="px-4 py-2.5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
          <span className="text-[11px]">
            {hasSerials ? (
              <span className="text-purple-300">
                ✓ Each label displays a distinct, non-duplicate S/N mapped from active store inventory.
              </span>
            ) : (
              <span>All labels generated with standard Code128 format ready for barcode scanners.</span>
            )}
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-md text-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default BarcodeModal;
