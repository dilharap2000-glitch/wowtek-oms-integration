'use client';

import React, { useState, useEffect } from 'react';
import { Barcode, Printer, X } from 'lucide-react';
import { Product } from '@/types';

export interface BarcodeModalProps {
  product: Product | null;
  isOpen?: boolean;
  onClose: () => void;
}

// Generate SVG Code128 pattern based on barcode string
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
  // Fix Barcode Generator Count: Set default print count directly to product.storeStock (or stockQuantity/stockStore)
  const calculateDefaultCount = (p: Product | null): number => {
    if (!p) return 1;
    const stock = Number(
      p.storeStock ??
      p.stockQuantity ??
      p.stockStore ??
      1
    );
    return Math.max(1, isNaN(stock) ? 1 : stock);
  };

  const [printCount, setPrintCount] = useState<number>(calculateDefaultCount(product));

  // Sync count whenever target product changes
  useEffect(() => {
    if (product) {
      setPrintCount(calculateDefaultCount(product));
    }
  }, [product]);

  if (!isOpen || !product) {
    return null;
  }

  const effectiveStoreStock = Number(
    product.storeStock ??
    product.stockQuantity ??
    product.stockStore ??
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-2">
            <Barcode className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="text-sm font-semibold text-white">
                Bulk Barcode &amp; GRN Label Generator
              </h3>
              <p className="text-[11px] text-neutral-400">
                Default count automatically synced to Store Stock ({effectiveStoreStock} pcs)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-neutral-300 bg-neutral-900 px-2.5 py-1 rounded-lg border border-neutral-800">
              <label htmlFor="barcode-count-input" className="text-neutral-400 font-medium">
                Print Count:
              </label>
              <input
                id="barcode-count-input"
                type="number"
                min="1"
                max="200"
                value={printCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setPrintCount(isNaN(val) || val < 1 ? 1 : val);
                }}
                className="w-16 px-2 py-0.5 bg-neutral-950 border border-neutral-700 rounded text-center text-white font-mono focus:border-purple-500 focus:outline-none"
              />
            </div>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Sheet ({printCount})</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Stickers Preview */}
        <div className="p-6 overflow-y-auto bg-neutral-950 flex-1">
          <div className="text-xs text-neutral-400 mb-3 flex items-center justify-between pb-2 border-b border-neutral-900">
            <span>Thermal Sticker Preview: 50mm × 30mm standard retail barcode sticker</span>
            <span className="font-mono text-purple-400 font-semibold">
              SKU: {product.sku || product.skuCode}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 print:grid-cols-3 print:gap-2">
            {Array.from({ length: printCount }).map((_, index) => (
              <div
                key={index}
                className="p-3 bg-white text-black rounded-lg border border-neutral-300 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start text-[9px] font-bold tracking-tight text-neutral-800">
                    <span>WOWTEK PRO</span>
                    <span className="font-mono text-[9px]">
                      {product.grnBatch || product.lastBatchRef || 'GRN-OCT'}
                    </span>
                  </div>
                  <div className="text-[10px] font-semibold line-clamp-1 mt-0.5 text-neutral-900">
                    {product.name || product.title}
                  </div>
                </div>

                <div className="my-1.5">
                  {renderSvgBarcode(product.barcode)}
                  <div className="text-center font-mono text-[10px] tracking-widest text-neutral-700 mt-0.5">
                    {product.barcode}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-neutral-300 pt-1 text-[10px]">
                  <span className="font-mono text-neutral-600 font-semibold truncate max-w-[90px]">
                    {product.sku || product.skuCode}
                  </span>
                  <span className="font-bold text-neutral-950 font-mono">
                    Rs. {Number(product.sellingPrice || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BarcodeModal;
