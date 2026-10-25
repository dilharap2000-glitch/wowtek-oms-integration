'use client';

import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Package,
  Barcode,
  Hash,
  FileText,
  Clock,
  User,
  Phone,
  RefreshCw,
  Printer,
  Download,
  AlertCircle,
  Eye,
  Check,
  X,
  Layers,
  Building2,
  Calendar,
} from 'lucide-react';
import { Product, Order, SupplierRmaClaim, ProductSerialItem } from '@/types';
import { updateProductSerialStatus } from '@/lib/db';

interface EnrichedSerialRecord {
  serialNumber: string;
  imei?: string;
  sku: string;
  productName: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  status: 'Available' | 'In-Stock' | 'Sold' | 'RMA_Defective' | 'RMA_Replaced' | 'Missing' | string;
  batchRef?: string;
  supplier?: string;
  addedAt?: string;
  soldAt?: string;
  invoiceNumber?: string;
  customerName?: string;
  customerPhone?: string;
  rmaRef?: string;
  discrepancyReason?: string;
  reportedMissingAt?: string;
  source?: string;
  productId: string;
  physicallyVerified?: boolean;
}

interface InventoryAuditViewProps {
  products: Product[];
  orders?: Order[];
  rmaClaims?: SupplierRmaClaim[];
  onRefreshProducts?: () => void;
}

export const InventoryAuditView: React.FC<InventoryAuditViewProps> = ({
  products,
  orders = [],
  rmaClaims = [],
  onRefreshProducts,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [auditScannerActive, setAuditScannerActive] = useState<boolean>(false);
  const [auditScanInput, setAuditScanInput] = useState<string>('');
  const [verifiedSerials, setVerifiedSerials] = useState<Set<string>>(new Set());
  const [feedbackToast, setFeedbackToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Missing Modal State
  const [missingModalItem, setMissingModalItem] = useState<EnrichedSerialRecord | null>(null);
  const [missingReason, setMissingReason] = useState<string>('Physical count shortage during weekly shelf audit');
  const [isSubmittingAudit, setIsSubmittingAudit] = useState(false);

  // Aggregate all tracked serial numbers across all products
  const allSerialRecords = useMemo(() => {
    const list: EnrichedSerialRecord[] = [];

    // Map of RMA claims by serial
    const rmaMap = new Map<string, SupplierRmaClaim>();
    (rmaClaims || []).forEach((r) => {
      if (r.serialNumber) rmaMap.set(r.serialNumber.toLowerCase().trim(), r);
      if (r.replacementSerial) rmaMap.set(r.replacementSerial.toLowerCase().trim(), r);
    });

    // Map of orders by serial
    const orderItemMap = new Map<string, { order: Order; item: any }>();
    (orders || []).forEach((o) => {
      (o.items || []).forEach((it) => {
        if (it.serialNumber) {
          orderItemMap.set(it.serialNumber.toLowerCase().trim(), { order: o, item: it });
        }
        if (Array.isArray(it.allocatedSerials)) {
          it.allocatedSerials.forEach((sn: string) => {
            orderItemMap.set(sn.toLowerCase().trim(), { order: o, item: it });
          });
        }
      });
    });

    products.forEach((prod) => {
      const seenProdSerials = new Set<string>();

      // 1. Process activeSerials array
      if (Array.isArray(prod.activeSerials)) {
        prod.activeSerials.forEach((item: any) => {
          const sn = typeof item === 'string' ? item : item.serialNumber;
          if (!sn) return;
          const lowerSn = sn.toLowerCase().trim();
          seenProdSerials.add(lowerSn);

          const rma = rmaMap.get(lowerSn);
          const orderMatch = orderItemMap.get(lowerSn);

          let finalStatus = typeof item === 'object' ? item.status || 'Available' : 'Available';
          if (finalStatus === 'In-Stock') finalStatus = 'Available';

          // If linked order exists and wasn't marked sold
          if (orderMatch && finalStatus === 'Available') {
            finalStatus = 'Sold';
          }
          if (rma && (finalStatus === 'Available' || finalStatus === 'Sold')) {
            finalStatus = rma.status === 'Replaced' ? 'RMA_Replaced' : 'RMA_Defective';
          }

          list.push({
            serialNumber: sn,
            imei: typeof item === 'object' ? item.imei : undefined,
            sku: prod.sku,
            productName: prod.name,
            category: prod.category,
            costPrice: prod.costPrice,
            sellingPrice: prod.sellingPrice,
            status: finalStatus,
            batchRef: typeof item === 'object' ? item.batchRef || prod.grnBatch : prod.grnBatch,
            supplier: typeof item === 'object' ? item.supplier || prod.supplier : prod.supplier,
            addedAt: typeof item === 'object' ? item.addedAt || item.addedDate : undefined,
            soldAt: typeof item === 'object' ? item.soldAt : orderMatch?.order.createdAt,
            invoiceNumber: typeof item === 'object' ? item.invoiceNumber : orderMatch?.order.invoiceNumber,
            customerName: typeof item === 'object' ? item.customerName : orderMatch?.order.customerName,
            customerPhone: typeof item === 'object' ? item.customerPhone : orderMatch?.order.customerPhone,
            rmaRef: rma?.rmaNumber || (typeof item === 'object' ? item.rmaRef : undefined),
            discrepancyReason: typeof item === 'object' ? item.discrepancyReason : undefined,
            reportedMissingAt: typeof item === 'object' ? item.reportedMissingAt : undefined,
            source: typeof item === 'object' ? item.source : 'GRN Inward',
            productId: prod.id,
            physicallyVerified: verifiedSerials.has(lowerSn),
          });
        });
      }

      // 2. Process serialNumbers string array (avoiding duplicates)
      if (Array.isArray(prod.serialNumbers)) {
        prod.serialNumbers.forEach((sn) => {
          if (!sn) return;
          const lowerSn = sn.toLowerCase().trim();
          if (seenProdSerials.has(lowerSn)) return;
          seenProdSerials.add(lowerSn);

          const rma = rmaMap.get(lowerSn);
          const orderMatch = orderItemMap.get(lowerSn);

          list.push({
            serialNumber: sn,
            sku: prod.sku,
            productName: prod.name,
            category: prod.category,
            costPrice: prod.costPrice,
            sellingPrice: prod.sellingPrice,
            status: orderMatch ? 'Sold' : (rma ? 'RMA_Defective' : 'Available'),
            batchRef: prod.grnBatch,
            supplier: prod.supplier,
            invoiceNumber: orderMatch?.order.invoiceNumber,
            customerName: orderMatch?.order.customerName,
            customerPhone: orderMatch?.order.customerPhone,
            rmaRef: rma?.rmaNumber,
            source: 'GRN Inward',
            productId: prod.id,
            physicallyVerified: verifiedSerials.has(lowerSn),
          });
        });
      }
    });

    return list;
  }, [products, orders, rmaClaims, verifiedSerials]);

  // Counts & Audit KPIs
  const totalCount = allSerialRecords.length;
  const inStockCount = allSerialRecords.filter((r) => r.status === 'Available' || r.status === 'In-Stock').length;
  const soldCount = allSerialRecords.filter((r) => r.status === 'Sold').length;
  const rmaCount = allSerialRecords.filter((r) => r.status === 'RMA_Defective' || r.status === 'RMA_Replaced').length;
  const missingCount = allSerialRecords.filter((r) => r.status === 'Missing').length;
  const verifiedCount = verifiedSerials.size;

  // Filtered List
  const filteredRecords = useMemo(() => {
    return allSerialRecords.filter((item) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.serialNumber.toLowerCase().includes(q) ||
        (item.imei && item.imei.toLowerCase().includes(q)) ||
        item.sku.toLowerCase().includes(q) ||
        item.productName.toLowerCase().includes(q) ||
        (item.invoiceNumber && item.invoiceNumber.toLowerCase().includes(q)) ||
        (item.customerName && item.customerName.toLowerCase().includes(q)) ||
        (item.customerPhone && item.customerPhone.includes(q)) ||
        (item.rmaRef && item.rmaRef.toLowerCase().includes(q)) ||
        (item.batchRef && item.batchRef.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'Available' && (item.status === 'Available' || item.status === 'In-Stock')) ||
        item.status === statusFilter;

      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [allSerialRecords, searchQuery, statusFilter, categoryFilter]);

  // Handle Scanning in Physical Count Audit Mode
  const handleAuditScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = auditScanInput.trim();
    if (!clean) return;

    const matched = allSerialRecords.find(
      (r) => r.serialNumber.toLowerCase() === clean.toLowerCase() || (r.imei && r.imei.toLowerCase() === clean.toLowerCase())
    );

    if (matched) {
      setVerifiedSerials((prev) => new Set(prev).add(matched.serialNumber.toLowerCase()));
      setFeedbackToast({
        type: 'success',
        message: `Verified Unit S/N ${matched.serialNumber} (${matched.productName})! Matched in active inventory.`,
      });
    } else {
      setFeedbackToast({
        type: 'error',
        message: `Unregistered Serial '${clean}' scanned! Not found in active inventory database.`,
      });
    }
    setAuditScanInput('');
  };

  // Flag missing discrepancy
  const handleConfirmMarkMissing = async () => {
    if (!missingModalItem) return;
    setIsSubmittingAudit(true);
    try {
      const res = await updateProductSerialStatus(
        missingModalItem.sku,
        missingModalItem.serialNumber,
        'Missing',
        missingReason
      );

      setFeedbackToast({
        type: 'success',
        message: `Serial S/N ${missingModalItem.serialNumber} flagged as Missing! Store stock decremented by -1 to protect POS checkout.`,
      });
      setMissingModalItem(null);
      if (onRefreshProducts) onRefreshProducts();
    } catch (err: any) {
      setFeedbackToast({
        type: 'error',
        message: err.message || 'Failed to update serial status',
      });
    } finally {
      setIsSubmittingAudit(false);
    }
  };

  // Restore found serial to stock
  const handleRestoreToStock = async (rec: EnrichedSerialRecord) => {
    setIsSubmittingAudit(true);
    try {
      await updateProductSerialStatus(rec.sku, rec.serialNumber, 'Available');
      setFeedbackToast({
        type: 'success',
        message: `Serial S/N ${rec.serialNumber} restored to Active Stock! Store stock incremented by +1 and ready for POS scan.`,
      });
      if (onRefreshProducts) onRefreshProducts();
    } catch (err: any) {
      setFeedbackToast({
        type: 'error',
        message: err.message || 'Failed to restore serial status',
      });
    } finally {
      setIsSubmittingAudit(false);
    }
  };

  const handlePrintAuditSheet = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedbackToast && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between shadow-xl animate-fadeIn backdrop-blur-md ${
            feedbackToast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="font-medium">{feedbackToast.message}</span>
          </div>
          <button
            onClick={() => setFeedbackToast(null)}
            className="text-slate-400 hover:text-white ml-2 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Audit View Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Inventory Audit &amp; Missing Stock Tracker
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
              Unique Serial / IMEI Tracking
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time reconciliation of active warehouse shelf units vs sold customer invoices vs supplier RMA replacements.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setAuditScannerActive(!auditScannerActive)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl border flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
              auditScannerActive
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-emerald-950/40'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
          >
            <Barcode className="w-4 h-4 text-emerald-400" />
            <span>{auditScannerActive ? 'Live Audit Mode (Active)' : 'Start Physical Count Audit'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrintAuditSheet}
            className="px-3.5 py-2 text-xs font-semibold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-purple-400" />
            <span>Print Audit Sheet</span>
          </button>
        </div>
      </div>

      {/* KPI CARDS: Real-time Serial Discrepancy Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-md">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Total Serials</span>
            <Layers className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">{totalCount}</div>
          <p className="text-[10px] text-slate-400 mt-1">Tracked electronic units</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-emerald-500/30 backdrop-blur-md">
          <div className="text-[11px] font-medium uppercase tracking-wider text-emerald-400 mb-1 flex items-center justify-between">
            <span>In-Stock / Shelf</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-300">{inStockCount}</div>
          <p className="text-[10px] text-emerald-400/80 mt-1">Ready for POS checkout</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-indigo-500/30 backdrop-blur-md">
          <div className="text-[11px] font-medium uppercase tracking-wider text-indigo-400 mb-1 flex items-center justify-between">
            <span>Sold (Locked)</span>
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-300">{soldCount}</div>
          <p className="text-[10px] text-indigo-400/80 mt-1">Bound to customer invoices</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-purple-500/30 backdrop-blur-md">
          <div className="text-[11px] font-medium uppercase tracking-wider text-purple-400 mb-1 flex items-center justify-between">
            <span>Supplier RMA</span>
            <Clock className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-300">{rmaCount}</div>
          <p className="text-[10px] text-purple-400/80 mt-1">Vendor inspection/replaced</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-rose-500/40 backdrop-blur-md">
          <div className="text-[11px] font-medium uppercase tracking-wider text-rose-400 mb-1 flex items-center justify-between">
            <span>Missing / Shortage</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-300">{missingCount}</div>
          <p className="text-[10px] text-rose-400/80 mt-1">
            {missingCount > 0 ? 'Discrepancy flagged!' : 'Zero discrepancies'}
          </p>
        </div>
      </div>

      {/* Physical Count Scanner Bar (When Active) */}
      {auditScannerActive && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 shadow-xl shadow-emerald-950/20 backdrop-blur-md space-y-2.5 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Live Handheld Physical Audit Scanner
              </span>
              <span className="text-[11px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                {verifiedCount} of {inStockCount} Shelf Units Verified
              </span>
            </div>
            {verifiedCount > 0 && (
              <button
                type="button"
                onClick={() => setVerifiedSerials(new Set())}
                className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
              >
                Reset Verification Count
              </button>
            )}
          </div>

          <form onSubmit={handleAuditScanSubmit} className="flex gap-2">
            <input
              type="text"
              autoFocus
              value={auditScanInput}
              onChange={(e) => setAuditScanInput(e.target.value)}
              placeholder="Scan physical unit barcode or type Serial / IMEI & press Enter..."
              className="flex-1 px-4 py-2 bg-slate-950 border border-emerald-500/50 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-400 shadow-inner"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-colors"
            >
              Verify Unit
            </button>
          </form>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Serial, IMEI, SKU, Product Name, or Invoice #..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Tracking Statuses</option>
            <option value="Available">Available in Store Shelf ({inStockCount})</option>
            <option value="Sold">Sold / Customer Invoiced ({soldCount})</option>
            <option value="RMA_Defective">Supplier RMA Defective</option>
            <option value="RMA_Replaced">Supplier RMA Replaced</option>
            <option value="Missing">Flagged Missing / Shortage ({missingCount})</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Categories</option>
            <option value="Electronics">Electronics</option>
            <option value="Audio & Gadgets">Audio &amp; Gadgets</option>
            <option value="Computer Parts">Computer Parts</option>
            <option value="Computer Components">Computer Components</option>
            <option value="Peripherals">Peripherals</option>
            <option value="Mobile Accessories">Mobile Accessories</option>
          </select>

          {missingCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'Missing' ? 'all' : 'Missing')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                statusFilter === 'Missing'
                  ? 'bg-rose-500 text-white border-rose-400'
                  : 'bg-rose-950/60 text-rose-300 border-rose-500/40 hover:bg-rose-900/60'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Show {missingCount} Missing Units</span>
            </button>
          )}
        </div>
      </div>

      {/* TRACKING AUDIT DATA TABLE */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/70 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Serial Number / IMEI</th>
                <th className="py-3 px-4">Product &amp; SKU</th>
                <th className="py-3 px-4">Tracking Status</th>
                <th className="py-3 px-4">GRN Batch / Supplier</th>
                <th className="py-3 px-4">Customer / Invoice / RMA</th>
                <th className="py-3 px-4 text-right">Audit Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    No tracked serial units found matching your search and filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((item, idx) => {
                  const isAvailable = item.status === 'Available' || item.status === 'In-Stock';
                  const isSold = item.status === 'Sold';
                  const isMissing = item.status === 'Missing';
                  const isRma = item.status === 'RMA_Defective' || item.status === 'RMA_Replaced';

                  return (
                    <tr
                      key={`${item.sku}-${item.serialNumber}-${idx}`}
                      className={`hover:bg-slate-850/50 transition-colors ${
                        item.physicallyVerified ? 'bg-emerald-950/15' : ''
                      }`}
                    >
                      {/* S/N / IMEI */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white tracking-wide">
                            {item.serialNumber}
                          </span>
                          {item.physicallyVerified && (
                            <span
                              className="p-0.5 rounded-full bg-emerald-500/20 text-emerald-400"
                              title="Physically verified on shelf during audit"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                        {item.imei && (
                          <div className="text-[10px] text-slate-400 font-mono">IMEI: {item.imei}</div>
                        )}
                        {item.source && (
                          <span className="text-[9px] text-slate-400">Source: {item.source}</span>
                        )}
                      </td>

                      {/* Product Name & SKU */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white truncate max-w-xs">{item.productName}</div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                          <span className="bg-purple-500/10 text-purple-300 px-1.5 py-0.2 rounded border border-purple-500/20">
                            {item.sku}
                          </span>
                          <span>{item.category}</span>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4">
                        {isAvailable && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Active Store Stock
                          </span>
                        )}
                        {isSold && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                            <Check className="w-3 h-3 text-indigo-400" />
                            Sold &amp; Invoiced
                          </span>
                        )}
                        {isMissing && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                            <AlertTriangle className="w-3 h-3 text-rose-400" />
                            Missing / Lost
                          </span>
                        )}
                        {isRma && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            <Clock className="w-3 h-3 text-purple-400" />
                            {item.status === 'RMA_Replaced' ? 'RMA Replaced' : 'Supplier RMA'}
                          </span>
                        )}

                        {item.discrepancyReason && (
                          <div className="text-[10px] text-rose-300 mt-1 max-w-xs italic">
                            &quot;{item.discrepancyReason}&quot;
                          </div>
                        )}
                      </td>

                      {/* GRN Batch & Supplier */}
                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-300 text-[11px]">{item.batchRef || 'GRN-DIRECT'}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-500" />
                          <span>{item.supplier || 'WOWTEK Direct Import'}</span>
                        </div>
                      </td>

                      {/* Customer / Invoice / RMA link */}
                      <td className="py-3 px-4">
                        {isSold ? (
                          <div className="space-y-0.5">
                            <div className="font-mono font-semibold text-indigo-300">
                              {item.invoiceNumber || 'INV-POS-CASH'}
                            </div>
                            <div className="text-[11px] text-white flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400" />
                              <span>{item.customerName || 'Cash Customer'}</span>
                            </div>
                            {item.customerPhone && (
                              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-500" />
                                <span>{item.customerPhone}</span>
                              </div>
                            )}
                          </div>
                        ) : isRma ? (
                          <div className="space-y-0.5">
                            <div className="font-mono text-purple-300 font-semibold">{item.rmaRef || 'RMA-TICKET'}</div>
                            <div className="text-[10px] text-slate-400">Supplier inspection</div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">Unallocated (In Store)</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        {isAvailable && (
                          <button
                            type="button"
                            onClick={() => {
                              setMissingModalItem(item);
                              setMissingReason('Physical count shortage during weekly shelf audit');
                            }}
                            className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/40 rounded-lg text-[11px] transition-colors cursor-pointer"
                            title="Flag unit as missing"
                          >
                            Mark Missing
                          </button>
                        )}
                        {isMissing && (
                          <button
                            type="button"
                            onClick={() => handleRestoreToStock(item)}
                            className="px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 rounded-lg text-[11px] transition-colors cursor-pointer font-semibold"
                            title="Restore unit to active stock"
                          >
                            Found / Restore Stock
                          </button>
                        )}
                        {isSold && (
                          <span className="text-[11px] text-indigo-400 font-mono">Invoice Linked</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Flag Missing / Stock Discrepancy */}
      {missingModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-semibold text-white">Report Missing Stock Discrepancy</h3>
              </div>
              <button
                onClick={() => setMissingModalItem(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="font-semibold text-white">{missingModalItem.productName}</div>
                <div className="text-slate-400 font-mono">
                  SKU: {missingModalItem.sku} · S/N: <span className="text-white font-bold">{missingModalItem.serialNumber}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs">
                <strong>Inventory Safety Notice:</strong> Marking this serial as Missing will automatically decrement active Store Stock by 1 unit so cashiers cannot accidentally sell an unlocated item at checkout.
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Discrepancy / Audit Shortage Reason
                </label>
                <textarea
                  rows={3}
                  value={missingReason}
                  onChange={(e) => setMissingReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500"
                  placeholder="e.g. Unit could not be found during shelf count audit..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setMissingModalItem(null)}
                  className="px-4 py-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingAudit}
                  onClick={handleConfirmMarkMissing}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold cursor-pointer transition-colors shadow-md shadow-rose-950/50"
                >
                  {isSubmittingAudit ? 'Updating...' : 'Confirm Flag as Missing'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
