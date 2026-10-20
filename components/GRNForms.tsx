'use client';

import React, { useState } from 'react';
import { AlertTriangle, X, CheckCircle2 } from 'lucide-react';

export interface SupplierOption {
  id?: string;
  name: string;
  paymentTerm?: string;
  paymentTerms?: string;
}

export interface AddProductGRNFormProps {
  suppliers?: Array<SupplierOption | { name: string; paymentTerm?: string; paymentTerms?: string }>;
  onsubmit?: (data: any) => void;
  onSubmit?: (data: any) => void;
  onCancel?: () => void;
}

// 1. අලුත් Product එකක් සහ මුල් GRN එක දමන Form එක (Add New Supplier & Product Inward)
export function AddProductGRNForm({
  suppliers = [],
  onsubmit,
  onSubmit,
  onCancel,
}: AddProductGRNFormProps) {
  const defaultSuppliers: SupplierOption[] =
    suppliers.length > 0
      ? suppliers
      : [
          { name: 'WOWTEK Direct Import', paymentTerm: 'Prepaid 100%' },
          { name: 'Singer Digital Sri Lanka', paymentTerm: 'Net 30 Days' },
          { name: 'Chama Computers Colombo', paymentTerm: 'Cash on Delivery' },
        ];

  const [formData, setFormData] = useState({
    skuCode: `WT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    category: 'Mobile Accessories',
    productTitle: '',
    costPrice: 0,
    sellingPrice: 0,
    stockQuantity: 0, // Warehouse අයින් කර Store Stock පමණි
    warrantyMonths: 0,
    supplier: defaultSuppliers[0]?.name || 'WOWTEK Direct Import',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const handler = onsubmit || onSubmit;
    if (handler) {
      handler(formData);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-900 text-white p-6 rounded-xl max-w-xl mx-auto space-y-4 border border-gray-800 shadow-2xl relative"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-pink-500">
            Add New Product &amp; GRN Inward (Store Only)
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Store Front Stock Inward · Warehouse removed · Auto-deducts pending orders
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-gray-400">SKU Code</label>
          <input
            type="text"
            value={formData.skuCode}
            onChange={(e) => setFormData({ ...formData, skuCode: e.target.value.toUpperCase() })}
            className="w-full bg-gray-800 border border-gray-700 rounded p-2 mt-1 text-white font-mono uppercase focus:border-pink-500 focus:outline-none"
            required
          />
        </div>
        <div>
          <label className="text-sm text-gray-400">Category</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded p-2 mt-1 text-white focus:border-pink-500 focus:outline-none"
          >
            <option value="Mobile Accessories">Mobile Accessories</option>
            <option value="Audio & Gadgets">Audio & Gadgets</option>
            <option value="Computer Parts">Computer Parts</option>
            <option value="Computer Components">Computer Components</option>
            <option value="Peripherals">Peripherals</option>
            <option value="Networking & Storage">Networking & Storage</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-sm text-gray-400">Product Title</label>
        <input
          type="text"
          placeholder="e.g. Anker R50i Earbuds"
          value={formData.productTitle}
          onChange={(e) => setFormData({ ...formData, productTitle: e.target.value })}
          className="w-full bg-gray-800 border border-gray-700 rounded p-2 mt-1 text-white focus:border-pink-500 focus:outline-none"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-gray-400">Cost Price (LKR)</label>
          <input
            type="number"
            min="0"
            value={formData.costPrice || ''}
            onChange={(e) =>
              setFormData({ ...formData, costPrice: Math.max(0, Number(e.target.value) || 0) })
            }
            placeholder="0"
            className="w-full bg-gray-800 border border-gray-700 rounded p-2 mt-1 text-white font-mono focus:border-pink-500 focus:outline-none"
            required
          />
        </div>
        <div>
          <label className="text-sm text-gray-400">Selling Price (LKR)</label>
          <input
            type="number"
            min="0"
            value={formData.sellingPrice || ''}
            onChange={(e) =>
              setFormData({ ...formData, sellingPrice: Math.max(0, Number(e.target.value) || 0) })
            }
            placeholder="0"
            className="w-full bg-gray-800 border border-gray-700 rounded p-2 mt-1 text-white font-mono focus:border-pink-500 focus:outline-none"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-pink-400 font-semibold">Store Stock Quantity</label>
          <input
            type="number"
            min="0"
            value={formData.stockQuantity || ''}
            onChange={(e) =>
              setFormData({ ...formData, stockQuantity: Math.max(0, Number(e.target.value) || 0) })
            }
            placeholder="0"
            className="w-full bg-gray-800 border border-pink-600 rounded p-2 mt-1 text-white font-mono focus:border-pink-400 focus:outline-none"
            required
          />
          <p className="text-[11px] text-gray-500 mt-1">Direct store shelf inventory (Warehouse removed)</p>
        </div>
        <div>
          <label className="text-sm text-gray-400">Warranty (Months)</label>
          <input
            type="number"
            min="0"
            value={formData.warrantyMonths || ''}
            onChange={(e) =>
              setFormData({ ...formData, warrantyMonths: Math.max(0, Number(e.target.value) || 0) })
            }
            placeholder="0"
            className="w-full bg-gray-800 border border-gray-700 rounded p-2 mt-1 text-white font-mono focus:border-pink-500 focus:outline-none"
          />
          <p className="text-[11px] text-gray-500 mt-1">Official WOWTEK warranty period</p>
        </div>
      </div>

      <div>
        <label className="text-sm text-gray-400">Primary Supplier</label>
        <select
          value={formData.supplier}
          onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
          className="w-full bg-gray-800 border border-gray-700 rounded p-2 mt-1 text-white focus:border-pink-500 focus:outline-none"
        >
          {defaultSuppliers.map((sup, idx) => (
            <option key={idx} value={sup.name}>
              {sup.name} {sup.paymentTerm || sup.paymentTerms ? `(${sup.paymentTerm || sup.paymentTerms})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="flex-1 bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold py-2.5 rounded-lg hover:opacity-90 transition-opacity text-sm shadow-md"
        >
          Confirm GRN Receipt
        </button>
      </div>
    </form>
  );
}

export interface RestockGRNFormProps {
  product: any;
  suppliers?: Array<SupplierOption | { name: string }>;
  onRestock: (data: {
    sku: string;
    skuCode?: string;
    barcode?: string;
    productId?: string;
    restockQty: number;
    costPrice: number;
    supplier: string;
    batchRef: string;
  }) => void;
  onCancel?: () => void;
  pendingWaitingCount?: number;
  pendingNeededUnits?: number;
}

// 2. දැනට තියෙන Product එකක් Restock කරන Form එක (Inward GRN Restock & Auto-Deduction)
export function RestockGRNForm({
  product,
  suppliers = [],
  onRestock,
  onCancel,
  pendingWaitingCount = 0,
  pendingNeededUnits = 0,
}: RestockGRNFormProps) {
  const defaultSuppliers =
    suppliers.length > 0
      ? suppliers
      : [
          { name: 'WOWTEK Direct Import' },
          { name: 'Singer Digital Sri Lanka' },
          { name: 'Chama Computers Colombo' },
        ];

  const [restockQty, setRestockQty] = useState<number>(10);
  const [costPrice, setCostPrice] = useState<number>(product?.costPrice || 0);
  const [selectedSupplier, setSelectedSupplier] = useState<string>(
    product?.supplier || defaultSuppliers[0]?.name || 'WOWTEK Direct Import'
  );

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRestock({
      sku: product?.sku || product?.skuCode || '',
      skuCode: product?.skuCode || product?.sku || '',
      barcode: product?.barcode,
      productId: product?.id || product?._id,
      restockQty: Number(restockQty) || 0,
      costPrice: Number(costPrice) || 0,
      supplier: selectedSupplier,
      batchRef: `GRN-${new Date().toISOString().slice(0, 10)}-${Math.floor(100 + Math.random() * 900)}`,
    });
  };

  const currentStoreHeld =
    product?.storeStock ??
    product?.currentStoreStock ??
    product?.stockStore ??
    product?.stockQuantity ??
    0;

  return (
    <form
      onSubmit={handleRestockSubmit}
      className="bg-gray-900 text-white p-6 rounded-xl max-w-xl mx-auto space-y-4 border border-gray-800 shadow-2xl relative"
    >
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-green-400">
            Inward GRN Restock &amp; Backlog Auto-Deduction
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Store stock increment exclusively · Warehouse removed
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="bg-gray-800 p-3 rounded-lg text-sm text-gray-300">
        <p>
          <strong className="text-white">Restocking Product:</strong>{' '}
          {product?.title || product?.productTitle || product?.name || 'Item'}
        </p>
        <p className="mt-1">
          <strong className="text-white">SKU:</strong> {product?.sku || product?.skuCode}{' '}
          <span className="text-gray-500">|</span>{' '}
          <span className="text-pink-400">Current Store Held: {currentStoreHeld}</span>
        </p>
      </div>

      {pendingWaitingCount > 0 && (
        <div className="p-3 bg-amber-950/70 border border-amber-600/70 rounded-xl text-xs text-amber-200 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              {pendingWaitingCount} Pending Backlog Order(s) Waiting ({pendingNeededUnits} pcs needed)
            </span>
          </div>
          <p className="text-[11px] text-amber-300/80">
            Upon confirming GRN, required stock will be auto-deducted, warnings cleared, and verified Net Operating Profit calculated in real time.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-pink-400 font-semibold">Store Restock Quantity</label>
          <input
            type="number"
            min="1"
            value={restockQty}
            onChange={(e) => setRestockQty(Number(e.target.value))}
            className="w-full bg-gray-800 border border-pink-600 rounded p-2 mt-1 text-white font-mono focus:border-pink-400 focus:outline-none"
            required
          />
          <p className="text-[11px] text-gray-500 mt-1">Increments storeStock directly</p>
        </div>
        <div>
          <label className="text-sm text-gray-400">Landed Cost Price (COGS)</label>
          <input
            type="number"
            min="0"
            value={costPrice}
            onChange={(e) => setCostPrice(Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded p-2 mt-1 text-white font-mono focus:border-green-500 focus:outline-none"
            required
          />
          <p className="text-[11px] text-gray-500 mt-1">Used for verified profit calculation</p>
        </div>
      </div>

      <div>
        <label className="text-sm text-gray-400">Supplier / Inward Source (Changeable)</label>
        <select
          value={selectedSupplier}
          onChange={(e) => setSelectedSupplier(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded p-2 mt-1 text-white focus:border-green-500 focus:outline-none"
        >
          {defaultSuppliers.map((sup, idx) => (
            <option key={idx} value={sup.name}>
              {sup.name}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-purple-950/40 border border-purple-800 p-3 rounded text-xs text-purple-300">
        ⚡ <strong>Auto-Deduction Engine:</strong> Any pending orders waiting for {product?.sku || 'this SKU'} will automatically have stock deducted, accurate COGS and Net Operating Profit computed, and be moved to active status!
      </div>

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2.5 rounded-lg transition-colors text-sm shadow-md"
        >
          Confirm Inward GRN Restock
        </button>
      </div>
    </form>
  );
}
