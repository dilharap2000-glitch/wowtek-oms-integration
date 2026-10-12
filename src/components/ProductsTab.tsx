'use client';

import React, { useState } from 'react';
import {
  Barcode,
  Printer,
  Plus,
  Search,
  Layers,
  CheckCircle2,
  X,
  Tag,
  Warehouse,
  TrendingUp,
  DollarSign,
  Camera,
  Trash2,
  Edit,
  Package,
  Sparkles,
  Building2,
  PlusCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Product, Supplier, Order } from '@/types';
import { BarcodeScannerModal } from './BarcodeScannerModal';

interface ProductsTabProps {
  products: Product[];
  orders?: Order[];
  suppliers?: Supplier[];
  onAddProduct: (product: Product) => void;
  onUpdateProduct?: (id: string, updates: Partial<Product>) => void;
  onDeleteProduct?: (id: string) => void;
  onLoadSampleProducts?: () => void;
  onRestockProduct?: (
    sku: string,
    addedStore: number,
    addedWarehouse: number,
    costPrice?: number,
    grnBatch?: string,
    supplier?: string
  ) => Promise<any>;
}

export const ProductsTab: React.FC<ProductsTabProps> = ({
  products,
  orders = [],
  suppliers = [],
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onLoadSampleProducts,
  onRestockProduct,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [selectedProductForBarcode, setSelectedProductForBarcode] = useState<Product | null>(null);
  const [barcodePrintCount, setBarcodePrintCount] = useState(12);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Inward Restock (GRN) Modal State
  const [restockProductTarget, setRestockProductTarget] = useState<Product | null>(null);
  const [inwardStoreQty, setInwardStoreQty] = useState(10);
  const [inwardWarehouseQty, setInwardWarehouseQty] = useState(5);
  const [inwardCostPrice, setInwardCostPrice] = useState<number | ''>('');
  const [inwardBatch, setInwardBatch] = useState('');
  const [inwardSupplier, setInwardSupplier] = useState('');
  const [restockSubmitting, setRestockSubmitting] = useState(false);
  const [restockToast, setRestockToast] = useState<string | null>(null);

  const handleOpenRestock = (p: Product) => {
    setRestockProductTarget(p);
    const relatedOrders = (orders || []).filter(
      (o) =>
        (o.hasUnregisteredItems ||
          o.profitStatus === 'Pending / Inventory Not Found' ||
          o.status === 'Pending') &&
        (o.items || []).some(
          (it) =>
            (it.sku && it.sku.toUpperCase() === p.sku.toUpperCase()) ||
            (it.name && it.name.toLowerCase().includes(p.name.toLowerCase())) ||
            (p.name && p.name.toLowerCase().includes(it.name.toLowerCase()))
        )
    );
    const neededQty = relatedOrders.reduce((sum, o) => {
      const match = (o.items || []).filter(
        (it) =>
          (it.sku && it.sku.toUpperCase() === p.sku.toUpperCase()) ||
          (it.name && it.name.toLowerCase().includes(p.name.toLowerCase())) ||
          (p.name && p.name.toLowerCase().includes(it.name.toLowerCase()))
      );
      return sum + match.reduce((s, it) => s + (it.quantity || 1), 0);
    }, 0);

    setInwardStoreQty(Math.max(10, neededQty + 5));
    setInwardWarehouseQty(5);
    setInwardCostPrice(p.costPrice || 0);
    setInwardBatch(`GRN-${new Date().getFullYear()}-OCT-${Math.floor(100 + Math.random() * 900)}`);
    setInwardSupplier(p.supplier || 'WOWTEK Direct Import');
  };

  const handleExecuteInwardRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockProductTarget || !onRestockProduct) return;
    setRestockSubmitting(true);
    try {
      const res = await onRestockProduct(
        restockProductTarget.sku,
        inwardStoreQty,
        inwardWarehouseQty,
        typeof inwardCostPrice === 'number' ? inwardCostPrice : 0,
        inwardBatch,
        inwardSupplier
      );
      setRestockProductTarget(null);
      const unitsDeducted = res?.totalUnitsDeducted || 0;
      const resolvedCount = res?.resolvedOrders?.length || 0;
      const customMsg =
        resolvedCount > 0
          ? `Auto-deducted ${unitsDeducted} units for ${resolvedCount} backlog order(s) on restock of ${restockProductTarget.sku}! Net Operating Profits verified and orders moved to active.`
          : `Inward GRN Restock saved for ${restockProductTarget.sku}. Stock updated: +${inwardStoreQty + inwardWarehouseQty} units.`;
      setRestockToast(res?.message || customMsg);
      setTimeout(() => setRestockToast(null), 7000);
    } catch (err: any) {
      console.error('Restock error:', err);
    } finally {
      setRestockSubmitting(false);
    }
  };

  // New product form (clean default values, reset on open/close/submit)
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Computer Components');
  const [costPrice, setCostPrice] = useState<number | ''>('');
  const [sellingPrice, setSellingPrice] = useState<number | ''>('');
  const [stockWarehouse, setStockWarehouse] = useState<number | ''>('');
  const [stockStore, setStockStore] = useState<number | ''>('');
  const [supplier, setSupplier] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [grnBatch, setGrnBatch] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState<number | ''>('');

  const resetForm = () => {
    setSku('');
    setName('');
    setCategory('Computer Components');
    setCostPrice('');
    setSellingPrice('');
    setStockWarehouse('');
    setStockStore('');
    setSupplier('');
    setSupplierId('');
    setGrnBatch('');
    setWarrantyMonths('');
  };

  const handleOpenAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    resetForm();
    setShowAddModal(false);
  };

  // Safe array bindings
  const safeProducts = products || [];
  const safeSuppliers = suppliers || [];

  // Inventory Valuation Metrics
  const totalCostValue = safeProducts.reduce(
    (sum, p) => sum + ((p?.stockWarehouse || 0) + (p?.stockStore || 0)) * (p?.costPrice || 0),
    0
  );
  const totalRetailValue = safeProducts.reduce(
    (sum, p) => sum + ((p?.stockWarehouse || 0) + (p?.stockStore || 0)) * (p?.sellingPrice || 0),
    0
  );
  const potentialProfit = totalRetailValue - totalCostValue;
  const overallMarginPercent =
    totalRetailValue > 0 ? ((potentialProfit / totalRetailValue) * 100).toFixed(1) : '0';

  const filteredProducts = safeProducts.filter((p) => {
    if (!p) return false;
    const matchesSearch =
      (p.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (p.sku || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (p.category || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (p.barcode || '').includes(searchQuery || '') ||
      (p.supplier && p.supplier.toLowerCase().includes((searchQuery || '').toLowerCase()));

    const matchesSupplier =
      supplierFilter === 'all' ||
      (p.supplier || '').toLowerCase().trim() === (supplierFilter || '').toLowerCase().trim() ||
      p.supplierId === supplierFilter;

    return matchesSearch && matchesSupplier;
  });

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const matchedSup = suppliers.find((s) => s.name === supplier);
    const newProd: Product = {
      id: `prod-${Date.now().toString().slice(-4)}`,
      sku: sku.toUpperCase() || `WT-${Date.now().toString().slice(-5)}`,
      barcode: `479${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      name: name.trim(),
      category,
      costPrice: typeof costPrice === 'number' ? costPrice : 0,
      sellingPrice: typeof sellingPrice === 'number' ? sellingPrice : 0,
      stockWarehouse: typeof stockWarehouse === 'number' ? stockWarehouse : 0,
      stockStore: typeof stockStore === 'number' ? stockStore : 0,
      stockReserved: 0,
      grnBatch: grnBatch.trim() || `GRN-${new Date().getFullYear()}`,
      supplier: supplier || matchedSup?.name || 'WOWTEK Direct Import',
      supplierId: supplierId || matchedSup?.id,
      warrantyPeriodMonths: typeof warrantyMonths === 'number' ? warrantyMonths : 0,
    };

    onAddProduct(newProd);
    handleCloseAddModal();
  };

  const handleSaveEditProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !onUpdateProduct) return;
    onUpdateProduct(editingProduct.id, editingProduct);
    setEditingProduct(null);
  };

  // Generate SVG Code128 pattern based on barcode string
  const renderSvgBarcode = (code: string) => {
    const bars: boolean[] = [];
    for (let i = 0; i < code.length; i++) {
      const num = parseInt(code[i]) || 3;
      for (let j = 0; j < 4; j++) {
        bars.push((num + j) % 2 === 0);
      }
    }
    const fullBars = [...bars, true, false, true, true, false, ...bars];

    return (
      <div className="flex items-center justify-center bg-white p-2 rounded">
        <svg viewBox="0 0 200 48" className="w-full h-12">
          {fullBars.map((filled, idx) => (
            <rect
              key={idx}
              x={idx * 2.2}
              y={0}
              width={filled ? 1.8 : 0}
              height={48}
              fill="#000000"
            />
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {restockToast && (
        <div className="p-3.5 bg-emerald-950/90 border border-emerald-600/70 text-emerald-200 rounded-xl flex items-center justify-between text-xs shadow-lg animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="font-medium">{restockToast}</span>
          </div>
          <button
            onClick={() => setRestockToast(null)}
            className="text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Inventory Valuation & Product Profit Margins
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Cost valuation vs retail valuation, stock breakdown, and real-time profit margin progress bars.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {products.length === 0 && onLoadSampleProducts && (
            <button
              onClick={() => onLoadSampleProducts()}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-purple-300 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800 rounded-lg transition-colors shadow-sm"
              title="Load 5 real stock products with standard barcodes"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Add Test Sample Products</span>
            </button>
          )}
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-neutral-200 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg transition-colors shadow-sm"
          >
            <Camera className="w-4 h-4 text-purple-400" />
            <span>Scan Barcode</span>
          </button>
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New GRN Product</span>
          </button>
        </div>
      </div>

      {/* INVENTORY VALUATION KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-1 flex items-center justify-between">
            <span>Total Cost Valuation</span>
            <Warehouse className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white">
            Rs. {totalCostValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-neutral-400 mt-2">
            Base landed purchase cost of held inventory
          </div>
        </div>

        <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-1 flex items-center justify-between">
            <span>Total Retail Valuation</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
            Rs. {totalRetailValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-neutral-400 mt-2">
            Market selling value of all store & warehouse stock
          </div>
        </div>

        <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-1 flex items-center justify-between">
            <span>Unrealized Gross Margin</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-purple-300">
            Rs. {potentialProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-neutral-400 mt-2">
            Weighted portfolio margin: <strong className="text-white font-mono">{overallMarginPercent}%</strong>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-1 flex items-center justify-between">
            <span>Active SKUs & Units</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white">
            {(safeProducts || []).length}{' '}
            <span className="text-xs font-sans font-normal text-neutral-400">SKUs</span>
          </div>
          <div className="text-[11px] text-neutral-400 mt-2">
            {(safeProducts || []).reduce((s, p) => s + (p?.stockStore || 0) + (p?.stockWarehouse || 0), 0)} total units on hand
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between p-3 rounded-xl bg-neutral-900 border border-neutral-800">
        <div className="flex items-center gap-2.5 w-full md:w-auto flex-1">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search SKU, name, category, barcode, supplier..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {(safeSuppliers || []).length > 0 && (
            <div className="flex items-center gap-1.5">
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="all">All Suppliers ({(safeSuppliers || []).length})</option>
                {(safeSuppliers || []).map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-neutral-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span>&gt;30% Margin</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
            <span>20-30% Margin</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span>&lt;20% Margin</span>
          </span>
        </div>
      </div>

      {/* Products Table with Profit Margin Bars */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-950/60 text-neutral-400">
                <th className="py-3 px-4 font-medium">SKU / Barcode</th>
                <th className="py-3 px-4 font-medium">Product Details & Primary Supplier</th>
                <th className="py-3 px-4 font-medium text-right">Cost Price</th>
                <th className="py-3 px-4 font-medium text-right">Selling Price</th>
                <th className="py-3 px-4 font-medium w-48">Profit Margin Bar</th>
                <th className="py-3 px-4 font-medium text-center">Stock (Whse / Store)</th>
                <th className="py-3 px-4 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/80">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <Package className="w-10 h-10 text-neutral-600 mb-1" />
                      <p className="font-semibold text-white text-sm">No Products Found</p>
                      <p className="text-xs text-neutral-400">
                        No items matched your search query or supplier filter. Record your first product GRN batch to calculate valuation.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={handleOpenAddModal}
                          className="flex items-center gap-2 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add New Product</span>
                        </button>
                        {onLoadSampleProducts && (
                          <button
                            type="button"
                            onClick={() => onLoadSampleProducts()}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-purple-300 border border-neutral-700 rounded-lg text-xs font-semibold transition-colors"
                          >
                            <Sparkles className="w-4 h-4 text-purple-400" />
                            <span>Add Test Sample Products</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                (filteredProducts || []).map((p) => {
                const marginPercent =
                  p.sellingPrice > 0
                    ? Math.round(((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100)
                    : 0;
                const marginAmount = p.sellingPrice - p.costPrice;

                // Color code logic
                const barColor =
                  marginPercent >= 30
                    ? 'bg-emerald-500'
                    : marginPercent >= 20
                    ? 'bg-purple-500'
                    : 'bg-amber-500';

                const waitingOrders = (orders || []).filter(
                  (o) =>
                    (o.hasUnregisteredItems ||
                      o.profitStatus === 'Pending / Inventory Not Found' ||
                      o.status === 'Pending') &&
                    (o.items || []).some(
                      (it) =>
                        (it.sku && it.sku.toUpperCase() === p.sku.toUpperCase()) ||
                        (it.name && it.name.toLowerCase().includes(p.name.toLowerCase())) ||
                        (p.name && p.name.toLowerCase().includes(it.name.toLowerCase()))
                    )
                );

                const waitingUnits = waitingOrders.reduce((sum, o) => {
                  const match = (o.items || []).filter(
                    (it) =>
                      (!it.isRegistered || it.costPrice <= 0 || o.hasUnregisteredItems || o.status === 'Pending') &&
                      ((it.sku && it.sku.toUpperCase() === p.sku.toUpperCase()) ||
                        (it.name && it.name.toLowerCase().includes(p.name.toLowerCase())) ||
                        (p.name && p.name.toLowerCase().includes(it.name.toLowerCase())))
                  );
                  return sum + match.reduce((s, it) => s + (it.quantity || 1), 0);
                }, 0);

                return (
                  <tr key={p.id} className="hover:bg-neutral-850/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono font-semibold text-purple-300">{p.sku}</div>
                      <div className="text-[11px] font-mono text-neutral-400 mt-0.5">{p.barcode}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-white max-w-xs">{p.name}</div>
                      <div className="text-[11px] text-neutral-400">{p.category}</div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-neutral-950 border border-neutral-800 text-purple-300 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-purple-400" />
                          <span className="truncate max-w-[170px]">{p.supplier || 'WOWTEK Direct Import'}</span>
                        </span>
                        {waitingOrders.length > 0 && (
                          <button
                            onClick={() => handleOpenRestock(p)}
                            className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                            title={`Click to Inward Restock: ${waitingOrders.length} backlog order(s) waiting for ${waitingUnits} unit(s). Inward stock will auto-deduct and verify net profits.`}
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            <span>{waitingOrders.length} Backlog Waiting ({waitingUnits} pcs)</span>
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums text-neutral-400">
                      Rs. {p.costPrice.toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-white">
                      Rs. {p.sellingPrice.toLocaleString()}
                    </td>

                    {/* PROFIT MARGIN PROGRESS BAR */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="font-bold text-white">+{marginPercent}%</span>
                          <span className="text-neutral-400">Rs. {marginAmount.toLocaleString()}</span>
                        </div>
                        <div className="w-full h-2 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                          <div
                            className={`h-full ${barColor} rounded-full transition-all duration-300`}
                            style={{ width: `${Math.min(100, Math.max(0, marginPercent))}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1.5 text-center font-mono">
                        <span className="px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-neutral-300">
                          W: <strong className="text-white">{p.stockWarehouse}</strong>
                        </span>
                        <span className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800 text-purple-300">
                          S: <strong className="text-white">{p.stockStore}</strong>
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {onRestockProduct && (
                          <button
                            onClick={() => handleOpenRestock(p)}
                            className="p-1.5 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-800/80 text-emerald-300 hover:text-white rounded-lg transition-colors flex items-center gap-1 text-[11px] font-medium"
                            title="Inward Restock (GRN Receipt) & Auto-Deduct Backlog"
                          >
                            <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="hidden xl:inline">GRN</span>
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedProductForBarcode(p)}
                          className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg transition-colors"
                          title="Generate & Print Thermal Barcodes"
                        >
                          <Barcode className="w-3.5 h-3.5 text-purple-400" />
                        </button>

                        <button
                          onClick={() => setEditingProduct(p)}
                          className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg transition-colors"
                          title="Edit Product"
                        >
                          <Edit className="w-3.5 h-3.5 text-neutral-400" />
                        </button>

                        {onDeleteProduct && (
                          <button
                            onClick={() => {
                              if (confirm(`Delete product ${p.name}?`)) {
                                onDeleteProduct(p.id);
                              }
                            }}
                            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-red-400 rounded-lg transition-colors"
                            title="Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(code) => {
          setSearchQuery(code);
          setIsScannerOpen(false);
        }}
        products={products}
        title="Find Product by Barcode"
        description="Scan any barcode to highlight and filter the product in your inventory"
        singleScanMode={true}
      />

      {/* Barcode Print Modal */}
      {selectedProductForBarcode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950">
              <div className="flex items-center gap-2">
                <Barcode className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">
                  Bulk Barcode & GRN Label Generator
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-xs text-neutral-400">
                  <span>Count:</span>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={barcodePrintCount}
                    onChange={(e) => setBarcodePrintCount(parseInt(e.target.value) || 1)}
                    className="w-14 px-1.5 py-0.5 bg-neutral-950 border border-neutral-700 rounded text-center text-white font-mono"
                  />
                </div>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Sheet</span>
                </button>
                <button
                  onClick={() => setSelectedProductForBarcode(null)}
                  className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[75vh] overflow-y-auto bg-neutral-950">
              <div className="text-xs text-neutral-400 mb-3 flex items-center justify-between">
                <span>Thermal Sticker Preview: 50mm × 30mm standard retail barcode sticker</span>
                <span className="font-mono text-purple-400">
                  {selectedProductForBarcode.sku}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Array.from({ length: barcodePrintCount }).map((_, index) => (
                  <div
                    key={index}
                    className="p-3 bg-white text-black rounded-lg border border-neutral-300 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start text-[9px] font-bold tracking-tight text-neutral-800">
                        <span>WOWTEK PRO</span>
                        <span className="font-mono">{selectedProductForBarcode.grnBatch}</span>
                      </div>
                      <div className="text-[10px] font-semibold line-clamp-1 mt-0.5 text-neutral-900">
                        {selectedProductForBarcode.name}
                      </div>
                    </div>

                    <div className="my-1.5">
                      {renderSvgBarcode(selectedProductForBarcode.barcode)}
                      <div className="text-center font-mono text-[10px] tracking-widest text-neutral-700 mt-0.5">
                        {selectedProductForBarcode.barcode}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-neutral-300 pt-1 text-[10px]">
                      <span className="font-mono text-neutral-600 font-semibold">
                        {selectedProductForBarcode.sku}
                      </span>
                      <span className="font-bold text-neutral-950 font-mono">
                        Rs. {selectedProductForBarcode.sellingPrice.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && onUpdateProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950">
              <h3 className="text-sm font-semibold text-white">Edit Product - {editingProduct.sku}</h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditProduct} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block text-neutral-300 font-medium mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Cost Price (LKR)</label>
                  <input
                    type="number"
                    required
                    value={editingProduct.costPrice}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        costPrice: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Selling Price (LKR)</label>
                  <input
                    type="number"
                    required
                    value={editingProduct.sellingPrice}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        sellingPrice: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Warehouse Stock</label>
                  <input
                    type="number"
                    value={editingProduct.stockWarehouse}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        stockWarehouse: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Store Front Stock</label>
                  <input
                    type="number"
                    value={editingProduct.stockStore}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        stockStore: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Primary Supplier</label>
                {suppliers.length > 0 ? (
                  <select
                    value={editingProduct.supplier || ''}
                    onChange={(e) => {
                      const sel = suppliers.find((s) => s.name === e.target.value);
                      setEditingProduct({
                        ...editingProduct,
                        supplier: e.target.value,
                        supplierId: sel?.id,
                      });
                    }}
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                  >
                    <option value="WOWTEK Direct Import">WOWTEK Direct Import</option>
                    {(safeSuppliers || []).map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.paymentTerms})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={editingProduct.supplier || ''}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        supplier: e.target.value,
                      })
                    }
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                  />
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white bg-neutral-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950">
              <h3 className="text-sm font-semibold text-white">GRN Product Inward Receipt</h3>
              <button
                type="button"
                onClick={handleCloseAddModal}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddProduct} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">SKU Code</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="WT-GPU-RTX4060"
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                  >
                    <option value="Computer Components">Computer Components</option>
                    <option value="Peripherals">Peripherals</option>
                    <option value="Mobile Accessories">Mobile Accessories</option>
                    <option value="Monitors & Displays">Monitors & Displays</option>
                    <option value="Networking & Storage">Networking & Storage</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. ASUS TUF Gaming GeForce RTX 4060 8GB"
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Cost Price (LKR)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="0"
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Selling Price (LKR)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="0"
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Warehouse Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={stockWarehouse}
                    onChange={(e) => setStockWarehouse(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="0"
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Store Front Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={stockStore}
                    onChange={(e) => setStockStore(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="0"
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">GRN Batch Number</label>
                  <input
                    type="text"
                    value={grnBatch}
                    onChange={(e) => setGrnBatch(e.target.value)}
                    placeholder="e.g. GRN-2026-OCT-021"
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Warranty (Months)</label>
                  <input
                    type="number"
                    min="0"
                    value={warrantyMonths}
                    onChange={(e) => setWarrantyMonths(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="0"
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Primary Supplier / Distributor</label>
                {suppliers.length > 0 ? (
                  <select
                    value={supplier}
                    onChange={(e) => {
                      setSupplier(e.target.value);
                      const sel = suppliers.find((s) => s.name === e.target.value);
                      setSupplierId(sel?.id || '');
                    }}
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                  >
                    <option value="">Select Supplier (Optional)...</option>
                    <option value="WOWTEK Direct Import">WOWTEK Direct Import</option>
                    {(safeSuppliers || []).map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.paymentTerms})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="e.g. Singer Digital / Chama Computers"
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                  />
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white bg-neutral-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg shadow-sm transition-colors"
                >
                  Confirm GRN Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INWARD GRN RESTOCK MODAL */}
      {restockProductTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Inward GRN Restock & Backlog Auto-Deduction
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Add new inward stock batch and resolve any pending invoices
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRestockProductTarget(null)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteInwardRestock} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-1">
                <div className="text-[11px] text-neutral-400">Restocking Product:</div>
                <div className="font-semibold text-white text-sm">{restockProductTarget.name}</div>
                <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-neutral-900">
                  <span className="text-purple-300">SKU: {restockProductTarget.sku}</span>
                  <span className="text-neutral-400">
                    Current Held: W:{restockProductTarget.stockWarehouse} · S:{restockProductTarget.stockStore}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">
                    Store Stock (Inward Qty)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={inwardStoreQty}
                    onChange={(e) => setInwardStoreQty(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-medium mb-1">
                    Warehouse Stock (Inward Qty)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={inwardWarehouseQty}
                    onChange={(e) => setInwardWarehouseQty(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">
                    Landed Cost Price (COGS)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={inwardCostPrice}
                    onChange={(e) => setInwardCostPrice(parseInt(e.target.value) || '')}
                    placeholder="e.g. 4200"
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-medium mb-1">GRN Batch Ref</label>
                  <input
                    type="text"
                    required
                    value={inwardBatch}
                    onChange={(e) => setInwardBatch(e.target.value)}
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Supplier / Inward Source</label>
                <input
                  type="text"
                  value={inwardSupplier}
                  onChange={(e) => setInwardSupplier(e.target.value)}
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
              </div>

              {(() => {
                const targetWaiting = (orders || []).filter(
                  (o) =>
                    (o.hasUnregisteredItems ||
                      o.profitStatus === 'Pending / Inventory Not Found' ||
                      o.status === 'Pending') &&
                    (o.items || []).some(
                      (it) =>
                        (it.sku && it.sku.toUpperCase() === restockProductTarget.sku.toUpperCase()) ||
                        (it.name && it.name.toLowerCase().includes(restockProductTarget.name.toLowerCase())) ||
                        (restockProductTarget.name && restockProductTarget.name.toLowerCase().includes(it.name.toLowerCase()))
                    )
                );
                const targetNeededUnits = targetWaiting.reduce((sum, o) => {
                  const match = (o.items || []).filter(
                    (it) =>
                      (!it.isRegistered || it.costPrice <= 0 || o.hasUnregisteredItems || o.status === 'Pending') &&
                      ((it.sku && it.sku.toUpperCase() === restockProductTarget.sku.toUpperCase()) ||
                        (it.name && it.name.toLowerCase().includes(restockProductTarget.name.toLowerCase())) ||
                        (restockProductTarget.name && restockProductTarget.name.toLowerCase().includes(it.name.toLowerCase())))
                  );
                  return sum + match.reduce((s, it) => s + (it.quantity || 1), 0);
                }, 0);

                if (targetWaiting.length > 0) {
                  return (
                    <div className="p-3 bg-amber-950/70 border border-amber-600/70 rounded-xl text-[11px] text-amber-200 space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span>{targetWaiting.length} Pending Backlog Order(s) Waiting ({targetNeededUnits} pcs needed)</span>
                      </div>
                      <div className="text-[10px] text-amber-300/80">
                        Upon confirming GRN, required stock will be immediately deducted, warnings cleared, and verified Net Operating Profits computed.
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="p-3 bg-purple-950/40 border border-purple-800/40 rounded-xl text-[11px] text-purple-300">
                ⚡ <strong>Auto-Deduction Engine:</strong> Any pending orders waiting for SKU <strong>{restockProductTarget.sku}</strong> will automatically have stock deducted, accurate COGS and Net Operating Profit computed, and be moved to active status!
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockProductTarget(null)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={restockSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  {restockSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Confirm Inward GRN Restock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
