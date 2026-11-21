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
  ShieldCheck,
} from 'lucide-react';
import { Product, Supplier, Order } from '@/types';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { BarcodeModal } from '@/components/BarcodeModal';
import { AddProductGRNForm, RestockGRNForm } from '@/components/GRNForms';
import { InventoryAuditView } from './InventoryAuditView';

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
    supplier?: string,
    productId?: string
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'catalog' | 'audit'>('catalog');

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

  // Inventory Valuation Metrics (Standardized to Store Stock exclusively)
  const totalCostValue = safeProducts.reduce(
    (sum, p) => sum + (p?.storeStock ?? p?.stockStore ?? p?.stockQuantity ?? 0) * (p?.costPrice || 0),
    0
  );
  const totalRetailValue = safeProducts.reduce(
    (sum, p) => sum + (p?.storeStock ?? p?.stockStore ?? p?.stockQuantity ?? 0) * (p?.sellingPrice || 0),
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

  const handleAddProductFromGRNForm = (formData: any) => {
    const matchedSup = suppliers.find((s) => s.name === formData.supplier);
    const serialsList: string[] = Array.isArray(formData.serials)
      ? formData.serials
      : (formData.serialNumbersInput
          ? formData.serialNumbersInput.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean)
          : []);

    const grnBatchRef = `GRN-${new Date().getFullYear()}-OCT-${Math.floor(100 + Math.random() * 900)}`;

    const activeSerials = serialsList.map((sn) => ({
      serialNumber: sn,
      status: 'Available',
      addedAt: new Date().toISOString(),
      source: 'GRN Inward',
      batchRef: grnBatchRef,
      supplier: formData.supplier || matchedSup?.name || 'WOWTEK Direct Import',
      costPrice: Number(formData.costPrice) || 0,
      sellingPrice: Number(formData.sellingPrice) || 0,
    }));

    const finalStockQty = serialsList.length > 0 ? serialsList.length : (Number(formData.stockQuantity) || 1);

    const newProd: Product = {
      id: `prod-${Date.now().toString().slice(-4)}`,
      sku: (formData.skuCode || `WT-${Date.now().toString().slice(-5)}`).toUpperCase().trim(),
      barcode: `479${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      name: (formData.productTitle || '').trim(),
      category: formData.category || 'Electronics',
      costPrice: Number(formData.costPrice) || 0,
      sellingPrice: Number(formData.sellingPrice) || 0,
      stockWarehouse: 0,
      stockStore: finalStockQty,
      storeStock: finalStockQty,
      stockQuantity: finalStockQty,
      stockReserved: 0,
      grnBatch: grnBatchRef,
      supplier: formData.supplier || matchedSup?.name || 'WOWTEK Direct Import',
      supplierId: matchedSup?.id,
      warrantyPeriodMonths: Number(formData.warrantyMonths) || 12,
      isSerialized: formData.isSerialized ?? (serialsList.length > 0),
      activeSerials: activeSerials,
      serialNumbers: serialsList,
    };

    onAddProduct(newProd);
    setShowAddModal(false);
    setRestockToast(
      `Product ${newProd.sku} (${newProd.name}) added to Store Front! GRN logged with ${serialsList.length} unique serial(s).`
    );
    setTimeout(() => setRestockToast(null), 7000);
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
    <div className="space-y-6 text-[var(--text-primary)]">
      {restockToast && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/90 border border-emerald-200 dark:border-emerald-600/70 text-emerald-800 dark:text-emerald-200 rounded-xl flex items-center justify-between text-xs shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span className="font-medium">{restockToast}</span>
          </div>
          <button
            onClick={() => setRestockToast(null)}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub Navigation: Catalog Valuation vs Inventory Audit & Missing Stock Tracker */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 p-1 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-xl">
          <button
            type="button"
            onClick={() => setActiveSubTab('catalog')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'catalog'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm border border-purple-400/30'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
            }`}
          >
            <Warehouse className="w-3.5 h-3.5" />
            <span>Product Catalog &amp; Valuation</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('audit')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'audit'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm border border-purple-400/30'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Inventory Audit &amp; Missing Stock Tracker</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'audit' ? (
        <InventoryAuditView products={products} orders={orders} />
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
            Inventory Valuation & Product Profit Margins
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Cost valuation vs retail valuation, stock breakdown, and real-time profit margin progress bars.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {products.length === 0 && onLoadSampleProducts && (
            <button
              onClick={() => onLoadSampleProducts()}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 rounded-lg transition-colors shadow-sm"
              title="Load 5 real stock products with standard barcodes"
            >
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Add Test Sample Products</span>
            </button>
          )}
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-lg transition-colors shadow-sm"
          >
            <Camera className="w-4 h-4 text-purple-600 dark:text-purple-400" />
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
        <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)] mb-1 flex items-center justify-between">
            <span>Total Cost Valuation</span>
            <Warehouse className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[var(--text-primary)]">
            Rs. {totalCostValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-2">
            Base landed purchase cost of held inventory
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)] mb-1 flex items-center justify-between">
            <span>Total Retail Valuation</span>
            <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            Rs. {totalRetailValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-2">
            Market selling value of all store & warehouse stock
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)] mb-1 flex items-center justify-between">
            <span>Unrealized Gross Margin</span>
            <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-purple-700 dark:text-purple-300">
            Rs. {potentialProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-2">
            Weighted portfolio margin: <strong className="text-[var(--text-primary)] font-mono">{overallMarginPercent}%</strong>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)] mb-1 flex items-center justify-between">
            <span>Active SKUs & Units</span>
            <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[var(--text-primary)]">
            {(safeProducts || []).length}{' '}
            <span className="text-xs font-sans font-normal text-[var(--text-secondary)]">SKUs</span>
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-2">
            {(safeProducts || []).reduce((s, p) => s + (p?.stockStore || 0) + (p?.stockWarehouse || 0), 0)} total units on hand
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm">
        <div className="flex items-center gap-2.5 w-full md:w-auto flex-1">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search SKU, name, category, barcode, supplier..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:outline-none focus:border-purple-500"
            />
          </div>

          {(safeSuppliers || []).length > 0 && (
            <div className="flex items-center gap-1.5">
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-purple-500"
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

        <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
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
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                <th className="py-3 px-4 font-medium">SKU / Barcode</th>
                <th className="py-3 px-4 font-medium">Product Details & Primary Supplier</th>
                <th className="py-3 px-4 font-medium text-right">Cost Price</th>
                <th className="py-3 px-4 font-medium text-right">Selling Price</th>
                <th className="py-3 px-4 font-medium w-48">Profit Margin Bar</th>
                <th className="py-3 px-4 font-medium text-center">Store Stock</th>
                <th className="py-3 px-4 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <Package className="w-10 h-10 text-[var(--text-secondary)] mb-1" />
                      <p className="font-semibold text-[var(--text-primary)] text-sm">No Products Found</p>
                      <p className="text-xs text-[var(--text-secondary)]">
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
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] text-purple-700 dark:text-purple-300 border border-[var(--border-subtle)] rounded-lg text-xs font-semibold transition-colors"
                          >
                            <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
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
                  <tr key={p.id} className="hover:bg-[var(--bg-subtle)]/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono font-semibold text-purple-700 dark:text-purple-300">{p.sku}</div>
                      <div className="text-[11px] font-mono text-[var(--text-secondary)] mt-0.5">{p.barcode}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-[var(--text-primary)] max-w-xs">{p.name}</div>
                      <div className="text-[11px] text-[var(--text-secondary)]">{p.category}</div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-purple-700 dark:text-purple-300 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                          <span className="truncate max-w-[170px]">{p.supplier || 'WOWTEK Direct Import'}</span>
                        </span>
                        {waitingOrders.length > 0 && (
                          <button
                            onClick={() => handleOpenRestock(p)}
                            className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[var(--badge-pending-bg)] text-[var(--badge-pending-text)] hover:brightness-95 border border-amber-200 dark:border-amber-500/40 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                            title={`Click to Inward Restock: ${waitingOrders.length} backlog order(s) waiting for ${waitingUnits} unit(s). Inward stock will auto-deduct and verify net profits.`}
                          >
                            <AlertTriangle className="w-3 h-3" />
                            <span>{waitingOrders.length} Backlog Waiting ({waitingUnits} pcs)</span>
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                      Rs. {Number(p.costPrice || 0).toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[var(--text-primary)]">
                      Rs. {Number(p.sellingPrice || 0).toLocaleString()}
                    </td>

                    {/* PROFIT MARGIN PROGRESS BAR */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="font-bold text-[var(--text-primary)]">+{marginPercent}%</span>
                          <span className="text-[var(--text-secondary)]">Rs. {marginAmount.toLocaleString()}</span>
                        </div>
                        <div className="w-full h-2 bg-[var(--bg-subtle)] rounded-full overflow-hidden border border-[var(--border-subtle)]">
                          <div
                            className={`h-full ${barColor} rounded-full transition-all duration-300`}
                            style={{ width: `${Math.min(100, Math.max(0, marginPercent))}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center font-mono">
                        <span className="px-2.5 py-1 rounded-lg bg-pink-50 dark:bg-pink-950/60 border border-pink-200 dark:border-pink-800 text-pink-700 dark:text-pink-300 font-bold text-xs">
                          {p.storeStock ?? p.stockStore ?? p.stockQuantity ?? 0} pcs
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {onRestockProduct && (
                          <button
                            onClick={() => handleOpenRestock(p)}
                            className="p-1.5 bg-[var(--badge-ready-bg)] border border-teal-200 dark:border-emerald-800/80 text-[var(--badge-ready-text)] hover:brightness-95 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-medium"
                            title="Inward Restock (GRN Receipt) & Auto-Deduct Backlog"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span className="hidden xl:inline">GRN</span>
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedProductForBarcode(p)}
                          className="p-1.5 bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)] rounded-lg transition-colors"
                          title="Generate & Print Thermal Barcodes"
                        >
                          <Barcode className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        </button>

                        <button
                          onClick={() => setEditingProduct(p)}
                          className="p-1.5 bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors"
                          title="Edit Product"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        {onDeleteProduct && (
                          <button
                            onClick={() => {
                              if (confirm(`Delete product ${p.name}?`)) {
                                onDeleteProduct(p.id);
                              }
                            }}
                            className="p-1.5 bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-red-500 dark:hover:text-red-400 rounded-lg transition-colors"
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
        </>
      )}

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
        <BarcodeModal
          product={selectedProductForBarcode}
          onClose={() => setSelectedProductForBarcode(null)}
        />
      )}

      {/* Edit Product Modal */}
      {editingProduct && onUpdateProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Edit Product - {editingProduct.sku}</h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--border-subtle)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditProduct} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block text-[var(--text-secondary)] font-medium mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--text-secondary)] font-medium mb-1">Cost Price (LKR)</label>
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
                    className="w-full px-3 py-1.5 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-[var(--text-secondary)] font-medium mb-1">Selling Price (LKR)</label>
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
                    className="w-full px-3 py-1.5 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-pink-600 dark:text-pink-400 font-medium mb-1">Store Front Stock</label>
                <input
                  type="number"
                  min="0"
                  value={editingProduct.storeStock ?? editingProduct.stockStore ?? 0}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 0;
                    setEditingProduct({
                      ...editingProduct,
                      storeStock: val,
                      stockStore: val,
                      stockWarehouse: 0,
                    });
                  }}
                  className="w-full px-3 py-1.5 bg-[var(--bg-app)] border border-pink-400/60 dark:border-pink-700/60 rounded-lg text-[var(--text-primary)] font-mono focus:border-pink-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[var(--text-secondary)] font-medium mb-1">Primary Supplier</label>
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
                    className="w-full px-3 py-1.5 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
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
                    className="w-full px-3 py-1.5 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] rounded-lg transition-colors"
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

      {/* Add Product Modal (Store Only GRN Form) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl">
            <AddProductGRNForm
              suppliers={safeSuppliers.map((s) => ({
                name: s.name,
                paymentTerm: s.paymentTerms,
                paymentTerms: s.paymentTerms,
              }))}
              onsubmit={handleAddProductFromGRNForm}
              onCancel={handleCloseAddModal}
            />
          </div>
        </div>
      )}

      {/* INWARD GRN RESTOCK MODAL (Store Only + Backlog Auto-Deduction) */}
      {restockProductTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl">
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

              return (
                <RestockGRNForm
                  product={{
                    id: (restockProductTarget as any)._id || restockProductTarget.id,
                    _id: (restockProductTarget as any)._id || restockProductTarget.id,
                    sku: restockProductTarget.sku,
                    skuCode: (restockProductTarget as any).skuCode || restockProductTarget.sku,
                    barcode: restockProductTarget.barcode,
                    title: restockProductTarget.name,
                    name: restockProductTarget.name,
                    costPrice: restockProductTarget.costPrice,
                    currentStoreStock:
                      restockProductTarget.storeStock ??
                      restockProductTarget.stockStore ??
                      restockProductTarget.stockQuantity ??
                      0,
                    storeStock:
                      restockProductTarget.storeStock ??
                      restockProductTarget.stockStore ??
                      restockProductTarget.stockQuantity ??
                      0,
                    supplier: restockProductTarget.supplier,
                  }}
                  suppliers={safeSuppliers.map((s) => ({
                    name: s.name,
                    paymentTerm: s.paymentTerms,
                    paymentTerms: s.paymentTerms,
                  }))}
                  pendingWaitingCount={targetWaiting.length}
                  pendingNeededUnits={targetNeededUnits}
                  onRestock={async (data) => {
                    if (!onRestockProduct) return;
                    setRestockSubmitting(true);
                    try {
                      const res = await onRestockProduct(
                        data.sku,
                        data.restockQty,
                        0, // Store Stock only (Warehouse removed as requested)
                        data.costPrice,
                        data.batchRef,
                        data.supplier,
                        data.id || data.productId || (restockProductTarget as any)._id || restockProductTarget.id
                      );
                      setRestockProductTarget(null);
                      const unitsDeducted = res?.totalUnitsDeducted || 0;
                      const resolvedCount = res?.resolvedOrders?.length || 0;
                      const customMsg =
                        resolvedCount > 0
                          ? `Auto-deducted ${unitsDeducted} units for ${resolvedCount} backlog order(s) on restock of ${data.sku}! Net Operating Profits verified and orders moved to active.`
                          : `Inward GRN Restock saved for ${data.sku}. Store Stock updated: +${data.restockQty} units.`;
                      setRestockToast(res?.message || customMsg);
                      setTimeout(() => setRestockToast(null), 7000);
                    } catch (err: any) {
                      console.error('Restock error:', err);
                    } finally {
                      setRestockSubmitting(false);
                    }
                  }}
                  onCancel={() => setRestockProductTarget(null)}
                />
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
