'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Barcode,
  Printer,
  X,
  ShieldCheck,
  Tag,
  Layers,
  Calendar,
  Package,
  RotateCcw,
  AlertCircle,
  Filter,
} from 'lucide-react';
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
  addedAt?: string;
  addedDate?: string; // YYYY-MM-DD
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
  // 1. Extract ALL unique serial numbers and IMEIs dynamically with batch & add-date tracking
  const uniqueSerials: MappedSerialUnit[] = useMemo(() => {
    if (!product) return [];
    const list: MappedSerialUnit[] = [];
    const seen = new Set<string>();

    const defaultBatch = product.grnBatch || product.lastBatchRef || 'GRN-OCT';
    const fallbackDateStr = product.createdAt || product.lastRestockedAt
      ? (typeof product.createdAt === 'string' ? product.createdAt : new Date(product.createdAt || product.lastRestockedAt!).toISOString())
      : new Date().toISOString();

    // A. Parse from activeSerials array (rich serial tracking objects)
    if (Array.isArray(product.activeSerials)) {
      product.activeSerials.forEach((item: ProductSerialItem | string) => {
        const sn = typeof item === 'string' ? item : item?.serialNumber;
        if (sn && typeof sn === 'string' && sn.trim() && !seen.has(sn.trim().toLowerCase())) {
          seen.add(sn.trim().toLowerCase());

          const batch =
            typeof item === 'object'
              ? item.batchRef || (item as any)?.grnBatch || defaultBatch
              : defaultBatch;

          const rawDate =
            typeof item === 'object'
              ? item.addedAt || (item as any)?.addedDate || (item as any)?.receivedAt || fallbackDateStr
              : fallbackDateStr;

          const dateStr = rawDate
            ? (typeof rawDate === 'string' ? rawDate : new Date(rawDate).toISOString())
            : fallbackDateStr;

          list.push({
            serialNumber: sn.trim(),
            imei: typeof item === 'object' ? item.imei : undefined,
            batch: batch || 'GRN-OCT',
            status: typeof item === 'object' ? item.status : 'Available',
            addedAt: dateStr,
            addedDate: dateStr.slice(0, 10),
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
            batch: defaultBatch,
            status: 'Available',
            addedAt: fallbackDateStr,
            addedDate: fallbackDateStr.slice(0, 10),
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

  const hasSerials = uniqueSerials.length > 0;

  // Filter States: Mode, Encoding, Batch filter, Date filter
  const [filterMode, setFilterMode] = useState<'available' | 'all' | 'sku'>('available');
  const [barcodeEncoding, setBarcodeEncoding] = useState<'serial' | 'product'>('serial');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('all');

  // Remote GRN batches and dates fetched from backend query
  const [remoteBatches, setRemoteBatches] = useState<Array<{ batchRef: string; date?: string; count: number }>>([]);
  const [remoteDates, setRemoteDates] = useState<Array<{ date: string; count: number }>>([]);

  // Fetch product's GRN history from backend if available
  useEffect(() => {
    if (!product?.sku && !product?.id) return;
    let isMounted = true;
    const fetchGrnDetails = async () => {
      try {
        const params = new URLSearchParams();
        if (product.sku) params.set('sku', product.sku);
        if (product.id) params.set('productId', product.id);

        const res = await fetch(`/api/grn?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && isMounted) {
            if (Array.isArray(data.batches)) setRemoteBatches(data.batches);
            if (Array.isArray(data.dates)) setRemoteDates(data.dates);
          }
        }
      } catch (err) {
        console.warn('[BarcodeModal] GRN query warning:', err);
      }
    };
    fetchGrnDetails();
    return () => {
      isMounted = false;
    };
  }, [product?.sku, product?.id]);

  // Aggregate distinct GRN batches
  const availableBatches = useMemo(() => {
    const map = new Map<string, { batch: string; count: number; date?: string }>();

    // From local unique serials
    uniqueSerials.forEach((s) => {
      const b = s.batch || product?.grnBatch || product?.lastBatchRef || 'GRN-OCT';
      const existing = map.get(b) || { batch: b, count: 0, date: s.addedDate };
      existing.count++;
      if (!existing.date && s.addedDate) existing.date = s.addedDate;
      map.set(b, existing);
    });

    // From product level batch if not present
    if (map.size === 0 && (product?.grnBatch || product?.lastBatchRef)) {
      const b = product.grnBatch || product.lastBatchRef || 'GRN-OCT';
      map.set(b, {
        batch: b,
        count: Number(product.storeStock ?? product.stockStore ?? 1),
        date: product.createdAt ? product.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
      });
    }

    // Merge remote batches from backend
    remoteBatches.forEach((rb) => {
      if (!map.has(rb.batchRef)) {
        map.set(rb.batchRef, { batch: rb.batchRef, count: rb.count, date: rb.date });
      }
    });

    return Array.from(map.values());
  }, [uniqueSerials, product, remoteBatches]);

  // Aggregate distinct Product Add / GRN Dates
  const availableDates = useMemo(() => {
    const map = new Map<string, { date: string; count: number }>();

    uniqueSerials.forEach((s) => {
      const d = s.addedDate || new Date().toISOString().slice(0, 10);
      const existing = map.get(d) || { date: d, count: 0 };
      existing.count++;
      map.set(d, existing);
    });

    if (map.size === 0 && product) {
      const d = product.createdAt ? product.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
      map.set(d, { date: d, count: Number(product.storeStock ?? product.stockStore ?? 1) });
    }

    remoteDates.forEach((rd) => {
      if (rd.date && !map.has(rd.date)) {
        map.set(rd.date, { date: rd.date, count: rd.count });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [uniqueSerials, product, remoteDates]);

  // Active Serial List: strictly filtered by source mode, selected Batch, and selected Date!
  const activeSerialList = useMemo(() => {
    let list = uniqueSerials;
    if (filterMode === 'available') {
      list = availableSerials;
    } else if (filterMode === 'sku') {
      return [];
    }

    // Filter by selected Batch
    if (selectedBatch !== 'all') {
      const targetBatch = selectedBatch.toLowerCase().trim();
      list = list.filter((s) => (s.batch || '').toLowerCase().trim() === targetBatch);
    }

    // Filter by selected Date
    if (selectedDate !== 'all') {
      list = list.filter((s) => (s.addedDate || '').slice(0, 10) === selectedDate);
    }

    return list;
  }, [filterMode, uniqueSerials, availableSerials, selectedBatch, selectedDate]);

  // Calculate default print count based on active batch/date filter
  const calculateDefaultCount = useCallback((): number => {
    if (!product) return 1;

    // Serialized mode: default to the exact count of filtered serials
    if (hasSerials && filterMode !== 'sku') {
      const count = activeSerialList.length;
      return count > 0 ? count : (selectedBatch !== 'all' || selectedDate !== 'all' ? 0 : 1);
    }

    // Non-serialized or Generic SKU mode with batch filter
    if (selectedBatch !== 'all') {
      const matchedBatch = availableBatches.find(
        (b) => b.batch.toLowerCase().trim() === selectedBatch.toLowerCase().trim()
      );
      if (matchedBatch) return Math.max(1, matchedBatch.count);
    }

    // Non-serialized with date filter
    if (selectedDate !== 'all') {
      const matchedDate = availableDates.find((d) => d.date === selectedDate);
      if (matchedDate) return Math.max(1, matchedDate.count);
    }

    const stockVal =
      product.storeStock !== undefined && product.storeStock !== null
        ? Number(product.storeStock)
        : product.stockQuantity !== undefined && product.stockQuantity !== null
        ? Number(product.stockQuantity)
        : Number(product.stockStore ?? 1);

    return isNaN(stockVal) || stockVal <= 0 ? 1 : stockVal;
  }, [product, hasSerials, filterMode, activeSerialList.length, selectedBatch, selectedDate, availableBatches, availableDates]);

  const [printCount, setPrintCount] = useState<number>(1);

  // Sync print count whenever product, filter mode, selected batch, or date changes
  useEffect(() => {
    if (product) {
      setPrintCount(calculateDefaultCount());
    }
  }, [product, selectedBatch, selectedDate, filterMode, calculateDefaultCount]);

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

  const isFiltered = selectedBatch !== 'all' || selectedDate !== 'all';

  const resetBatchDateFilters = () => {
    setSelectedBatch('all');
    setSelectedDate('all');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-5xl bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[94vh]">
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
                    <span>{uniqueSerials.length} Unique S/N</span>
                  </span>
                )}
                {isFiltered && (
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                    <Filter className="w-2.5 h-2.5 text-indigo-400" />
                    <span>Filtered Batch/Date</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400">
                Product: <strong className="text-neutral-200 font-semibold">{product.name || product.title}</strong>{' '}
                · SKU: <span className="font-mono text-purple-400">{product.sku || product.skuCode}</span>{' '}
                · Total Stock: {effectiveStoreStock} units
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
                min="0"
                max={Math.max(200, uniqueSerials.length || 10)}
                value={printCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setPrintCount(isNaN(val) || val < 0 ? 0 : val);
                }}
                className="w-14 px-1.5 py-0.5 bg-neutral-950 border border-neutral-700 rounded text-center text-white font-mono focus:border-purple-500 focus:outline-none"
              />
            </div>

            {/* Print Sheet Trigger */}
            <button
              onClick={() => window.print()}
              disabled={printCount <= 0}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white rounded-lg transition-all shadow-md shadow-purple-950/40 cursor-pointer ${
                printCount > 0
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              }`}
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

        {/* Primary Filter Bar: Batch Selector & Date Filter */}
        <div className="px-4 py-2.5 bg-neutral-900 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* 1. GRN Batch Selector Dropdown */}
            <div className="flex items-center gap-1.5 bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-800">
              <Package className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <label htmlFor="batch-selector-dropdown" className="text-neutral-400 text-[11px] font-medium shrink-0">
                Batch:
              </label>
              <select
                id="batch-selector-dropdown"
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="bg-transparent text-white text-[11px] font-medium focus:outline-none cursor-pointer pr-1"
              >
                <option value="all" className="bg-neutral-900 text-white">
                  All Batches ({availableBatches.length > 0 ? availableBatches.reduce((a, b) => a + b.count, 0) : effectiveStoreStock} units)
                </option>
                {availableBatches.map((b) => (
                  <option key={b.batch} value={b.batch} className="bg-neutral-900 text-white">
                    {b.batch} ({b.count} units{b.date ? ` · ${b.date}` : ''})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Product Add Date / GRN Date Filter Dropdown */}
            <div className="flex items-center gap-1.5 bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-800">
              <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <label htmlFor="date-filter-dropdown" className="text-neutral-400 text-[11px] font-medium shrink-0">
                Add Date:
              </label>
              <select
                id="date-filter-dropdown"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-white text-[11px] font-medium focus:outline-none cursor-pointer pr-1"
              >
                <option value="all" className="bg-neutral-900 text-white">
                  All Dates ({availableDates.length > 0 ? availableDates.reduce((a, d) => a + d.count, 0) : effectiveStoreStock} units)
                </option>
                {availableDates.map((d) => (
                  <option key={d.date} value={d.date} className="bg-neutral-900 text-white">
                    {d.date} ({d.count} units)
                  </option>
                ))}
              </select>

              {/* Quick calendar picker input */}
              <input
                type="date"
                value={selectedDate !== 'all' ? selectedDate : ''}
                onChange={(e) => {
                  if (e.target.value) setSelectedDate(e.target.value);
                }}
                className="bg-neutral-900 text-neutral-300 text-[10px] px-1 py-0.5 rounded border border-neutral-700 focus:outline-none cursor-pointer"
                title="Select specific date from calendar"
              />
            </div>

            {/* Clear / Reset Filter Button */}
            {isFiltered && (
              <button
                type="button"
                onClick={resetBatchDateFilters}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-amber-300 bg-amber-950/60 hover:bg-amber-900/80 border border-amber-800/80 rounded-lg transition cursor-pointer"
                title="Reset Batch & Date filters"
              >
                <RotateCcw className="w-3 h-3 text-amber-400" />
                <span>Show All</span>
              </button>
            )}
          </div>

          {/* Barcode Encoding Toggle (Serial vs Product Barcode) */}
          {hasSerials && filterMode !== 'sku' && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-neutral-400">Barcode Encodes:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setBarcodeEncoding('serial')}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition cursor-pointer ${
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
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition cursor-pointer ${
                    barcodeEncoding === 'product'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  Product SKU Barcode
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Secondary Toolbar: Serial Status Mode Selection */}
        <div className="px-4 py-2 bg-neutral-950/80 border-b border-neutral-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-neutral-400 font-medium flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Status Filter:</span>
            </span>

            {hasSerials ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterMode('available')}
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer ${
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
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                    filterMode === 'all'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  All Registered S/N ({uniqueSerials.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('sku')}
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer ${
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

          <div className="text-[11px] font-mono text-neutral-400 flex items-center gap-2">
            {isFiltered ? (
              <span className="text-purple-300 bg-purple-950/60 border border-purple-800/80 px-2 py-0.5 rounded font-semibold">
                Mapped: {activeSerialList.length} item(s) for selected batch/date
              </span>
            ) : (
              <span className="text-neutral-400">
                Displaying all batches ({availableBatches.length} batch groups)
              </span>
            )}
          </div>
        </div>

        {/* Modal Body / Stickers Preview */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-neutral-950 flex-1">
          <div className="text-xs text-neutral-400 mb-3 flex items-center justify-between pb-2 border-b border-neutral-900">
            <span className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-purple-400" />
              <span>Standard Retail Thermal Sticker Preview: 50mm × 30mm</span>
            </span>
            <span className="font-mono text-purple-400 font-semibold text-[11px]">
              {selectedBatch !== 'all' ? `Batch: ${selectedBatch}` : `All Batches`}
              {selectedDate !== 'all' ? ` · Date: ${selectedDate}` : ''}
              {filterMode !== 'sku' && hasSerials ? ` · ${activeSerialList.length} Unique S/N Available` : ''}
            </span>
          </div>

          {/* Empty State when no items match the chosen batch/date filter */}
          {hasSerials && filterMode !== 'sku' && activeSerialList.length === 0 ? (
            <div className="p-8 my-6 text-center bg-neutral-900/60 rounded-xl border border-neutral-800 max-w-md mx-auto">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-white">No Matching Serial Numbers</p>
              <p className="text-xs text-neutral-400 mt-1">
                {selectedBatch !== 'all' && `Batch "${selectedBatch}" `}
                {selectedDate !== 'all' && `Date "${selectedDate}" `}
                has no {filterMode === 'available' ? 'available in-stock' : 'registered'} serials.
              </p>
              <button
                type="button"
                onClick={resetBatchDateFilters}
                className="mt-3 px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to All Batches &amp; Dates</span>
              </button>
            </div>
          ) : (
            /* Sticker Sheet Grid */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 print:grid-cols-3 print:gap-2 print:m-0 print:p-0">
              {Array.from({ length: printCount }).map((_, index) => {
                // Map each unique serial number strictly from the active filtered list
                const serialItem =
                  filterMode !== 'sku' && activeSerialList[index]
                    ? activeSerialList[index]
                    : null;

                const currentSerial =
                  serialItem?.serialNumber ||
                  (hasSerials && !isFiltered && index < uniqueSerials.length
                    ? uniqueSerials[index]?.serialNumber
                    : null);

                const currentImei =
                  serialItem?.imei ||
                  (hasSerials && !isFiltered && index < uniqueSerials.length
                    ? uniqueSerials[index]?.imei
                    : null);

                const currentBatch =
                  serialItem?.batch ||
                  (selectedBatch !== 'all'
                    ? selectedBatch
                    : product.grnBatch || product.lastBatchRef || 'GRN-OCT');

                const currentDate =
                  serialItem?.addedDate ||
                  (selectedDate !== 'all'
                    ? selectedDate
                    : product.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10));

                // Decide scannable barcode string: If serial mode, encode the unique serial number!
                const scannableCode =
                  barcodeEncoding === 'serial' && currentSerial
                    ? currentSerial
                    : product.barcode || product.sku || '0000000000';

                return (
                  <div
                    key={index}
                    className="p-3 bg-white text-black rounded-lg border border-neutral-300 shadow-sm flex flex-col justify-between print:border-black print:shadow-none print:break-inside-avoid print:p-2 min-h-[140px]"
                  >
                    {/* Top row: Brand & Batch & Add Date */}
                    <div>
                      <div className="flex justify-between items-start text-[9px] font-bold tracking-tight text-neutral-800">
                        <span className="font-mono tracking-wider">WOWTEK PRO</span>
                        <div className="flex items-center gap-1">
                          {currentDate && (
                            <span className="font-mono text-[8px] text-neutral-600 bg-neutral-100 px-1 py-0.5 rounded border border-neutral-200">
                              {currentDate}
                            </span>
                          )}
                          <span className="font-mono text-[9px] bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-300 font-bold text-neutral-900">
                            {currentBatch}
                          </span>
                        </div>
                      </div>

                      {/* Product Name */}
                      <div
                        className="text-[10px] font-semibold line-clamp-1 mt-0.5 text-neutral-900"
                        title={product.name || product.title}
                      >
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
                      <span
                        className="font-mono text-neutral-600 font-semibold truncate max-w-[80px]"
                        title={product.sku || product.skuCode}
                      >
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
          )}
        </div>

        {/* Modal Footer / Summary */}
        <div className="px-4 py-2.5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
          <span className="text-[11px]">
            {isFiltered ? (
              <span className="text-purple-300">
                ✓ Filtered by {selectedBatch !== 'all' ? `Batch: ${selectedBatch}` : ''}
                {selectedBatch !== 'all' && selectedDate !== 'all' ? ' & ' : ''}
                {selectedDate !== 'all' ? `Add Date: ${selectedDate}` : ''}. Only shipment units mapped.
              </span>
            ) : hasSerials ? (
              <span className="text-purple-300">
                ✓ Each label displays a distinct, non-duplicate S/N mapped from active store inventory.
              </span>
            ) : (
              <span>All labels generated with standard Code128 format ready for barcode scanners.</span>
            )}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-md text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default BarcodeModal;
