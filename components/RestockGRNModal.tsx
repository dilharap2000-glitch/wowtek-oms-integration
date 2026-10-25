'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  PackageCheck,
  AlertCircle,
  Truck,
  Coins,
  Hash,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

export interface SupplierOption {
  id?: string;
  name: string;
  paymentTerm?: string;
  paymentTerms?: string;
}

export interface RestockGRNModalProps {
  product: {
    _id?: string;
    id?: string;
    sku?: string;
    skuCode?: string;
    barcode?: string;
    name?: string;
    title?: string;
    costPrice?: number;
    sellingPrice?: number;
    storeStock?: number;
    stockStore?: number;
    stockQuantity?: number;
    supplier?: string;
    category?: string;
  } | null;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: (updatedProduct: any) => void;
  suppliers?: Array<SupplierOption | { name: string }>;
  autoReload?: boolean;
}

const DEFAULT_SUPPLIERS: SupplierOption[] = [
  { name: 'WOWTEK Direct Import', paymentTerm: 'Prepaid 100%' },
  { name: 'Singer Digital Sri Lanka', paymentTerm: 'Net 30 Days' },
  { name: 'Chama Computers Colombo', paymentTerm: 'Cash on Delivery' },
  { name: 'Redington Distribution', paymentTerm: 'Net 15 Days' },
  { name: 'Abans Logistics', paymentTerm: 'Prepaid' },
];

export function RestockGRNModal({
  product,
  isOpen = true,
  onClose,
  onSuccess,
  suppliers = [],
  autoReload = true,
}: RestockGRNModalProps) {
  const supplierList = suppliers.length > 0 ? suppliers : DEFAULT_SUPPLIERS;

  const [restockQty, setRestockQty] = useState<number>(10);
  const [costPrice, setCostPrice] = useState<number>(product?.costPrice || 0);
  const [selectedSupplier, setSelectedSupplier] = useState<string>(
    product?.supplier || supplierList[0]?.name || 'WOWTEK Direct Import'
  );
  const [batchRef, setBatchRef] = useState<string>(`GRN-${Date.now()}`);
  const [serialNumbersInput, setSerialNumbersInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Synchronize initial state when product changes
  useEffect(() => {
    if (product) {
      setCostPrice(Number(product.costPrice) || 0);
      setSelectedSupplier(product.supplier || supplierList[0]?.name || 'WOWTEK Direct Import');
      setBatchRef(`GRN-${Date.now()}`);
      setSerialNumbersInput('');
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [product, supplierList]);

  if (!isOpen || !product) {
    return null;
  }

  const currentStoreStock = Number(
    product.storeStock ??
    product.stockStore ??
    product.stockQuantity ??
    0
  );

  const productDisplayName = product.name || product.title || 'Selected Product';
  const productSku = product.sku || product.skuCode || 'N/A';

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const qtyToAdd = Number(restockQty);
    if (isNaN(qtyToAdd) || qtyToAdd <= 0) {
      setErrorMessage('Please enter a valid restock quantity greater than 0.');
      setLoading(false);
      return;
    }

    if (serialNumbersInput.trim()) {
      const serials = serialNumbersInput.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
      const seen = new Set<string>();
      for (const s of serials) {
        const lower = s.toLowerCase();
        if (seen.has(lower)) {
          setErrorMessage(`Duplicate serial number '${s}' entered. Each unit must have a unique tracking number.`);
          setLoading(false);
          return;
        }
        seen.add(lower);
      }
    }

    try {
      // Pass both id and sku in the JSON payload
      const payload = {
        id: product._id || product.id,
        productId: product._id || product.id,
        sku: product.sku || product.skuCode,
        skuCode: product.skuCode || product.sku,
        barcode: product.barcode,
        restockQty: qtyToAdd,
        costPrice: Number(costPrice) || 0,
        sellingPrice: Number(product.sellingPrice) || 0,
        supplier: selectedSupplier,
        batchRef: batchRef || `GRN-${Date.now()}`,
        serialNumbersInput: serialNumbersInput.trim(),
      };

      console.log('[RestockGRNModal] Submitting GRN payload to /api/grn:', payload);

      const res = await fetch('/api/grn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to update store stock on server');
      }

      const newStock = Number(
        data.product?.storeStock ??
        data.product?.stockQuantity ??
        currentStoreStock + qtyToAdd
      );

      setSuccessMessage(
        `Successfully restocked +${qtyToAdd} units! New store stock: ${newStock} pcs.`
      );

      if (onSuccess) {
        onSuccess(data.product);
      }

      // Refresh window after brief feedback so the UI reflects the new stock immediately
      setTimeout(() => {
        if (autoReload && typeof window !== 'undefined') {
          window.location.reload();
        } else {
          onClose();
        }
      }, 700);
    } catch (err: any) {
      console.error('[RestockGRNModal] Error during restock:', err);
      setErrorMessage(err.message || 'An unexpected error occurred while processing GRN restock.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Inward GRN Restock
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                  Store Front Only
                </span>
              </h3>
              <p className="text-xs text-neutral-400">
                Direct storeStock increment · Warehouse removed
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleRestock} className="p-5 space-y-4 bg-neutral-900 text-white">
          {/* Target Product Summary Box */}
          <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs space-y-1.5">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-neutral-400">Product:</span>
                <h4 className="text-sm font-semibold text-white mt-0.5">{productDisplayName}</h4>
              </div>
              <div className="text-right">
                <span className="text-neutral-400">Current Store Stock:</span>
                <p className="text-sm font-mono font-bold text-pink-400">{currentStoreStock} pcs</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1 border-t border-neutral-800/80 text-[11px] text-neutral-400 font-mono">
              <span>SKU: <strong className="text-neutral-200">{productSku}</strong></span>
              {product.barcode && (
                <span>Barcode: <strong className="text-neutral-200">{product.barcode}</strong></span>
              )}
              {product._id && (
                <span className="truncate max-w-[140px]" title={String(product._id)}>
                  ID: <strong className="text-neutral-300">{String(product._id)}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-red-950/60 border border-red-600/80 rounded-xl text-xs text-red-200 flex items-start gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-300">Restock Failed</p>
                <p className="mt-0.5 text-red-200/90">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="p-3 bg-green-950/60 border border-green-600/80 rounded-xl text-xs text-green-200 flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3.5">
            {/* Restock Quantity */}
            <div>
              <label className="block text-xs font-semibold text-pink-400 mb-1">
                Store Restock Qty *
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={restockQty}
                onChange={(e) => setRestockQty(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-neutral-950 border border-pink-500/60 rounded-lg p-2.5 text-sm text-white font-mono focus:border-pink-400 focus:outline-none"
                placeholder="10"
                required
              />
              <p className="text-[10px] text-neutral-500 mt-1">Directly adds to storeStock</p>
            </div>

            {/* Landed Cost Price */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Landed Cost (LKR) *
              </label>
              <div className="relative">
                <Coins className="w-4 h-4 absolute left-2.5 top-3 text-neutral-500" />
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={costPrice}
                  onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg pl-8 pr-2.5 py-2.5 text-sm text-white font-mono focus:border-green-500 focus:outline-none"
                  placeholder="0.00"
                  required
                />
              </div>
              <p className="text-[10px] text-neutral-500 mt-1">Unit COGS for profit calculation</p>
            </div>
          </div>

          {/* Dynamic Supplier Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Supplier / Inward Source (Changeable)
            </label>
            <div className="relative">
              <Truck className="w-4 h-4 absolute left-2.5 top-3 text-neutral-500" />
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg pl-8 pr-3 py-2.5 text-sm text-white focus:border-green-500 focus:outline-none"
              >
                {supplierList.map((sup, idx) => (
                  <option key={idx} value={sup.name}>
                    {sup.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Batch Reference */}
          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1">
              GRN Batch Reference
            </label>
            <div className="relative">
              <Hash className="w-4 h-4 absolute left-2.5 top-3 text-neutral-500" />
              <input
                type="text"
                value={batchRef}
                onChange={(e) => setBatchRef(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-8 pr-3 py-2 text-xs text-neutral-300 font-mono focus:border-purple-500 focus:outline-none"
                placeholder="GRN-YYYYMMDD-001"
              />
            </div>
          </div>

          {/* Serial Numbers (Optional) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-neutral-300">
                Serial Numbers (Optional, Comma-Separated)
              </label>
              <span className="text-[10px] text-neutral-500">Auto barcodes if blank</span>
            </div>
            <input
              type="text"
              value={serialNumbersInput}
              onChange={(e) => setSerialNumbersInput(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-xs text-white font-mono placeholder-neutral-600 focus:border-green-500 focus:outline-none"
              placeholder="SN1001, SN1002, SN1003..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2.5 pt-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold py-2.5 rounded-lg transition-colors text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2.5 rounded-lg transition-colors text-xs shadow-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating Stock...</span>
                </>
              ) : (
                <>
                  <PackageCheck className="w-4 h-4" />
                  <span>Confirm Inward GRN (+{restockQty})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RestockGRNModal;
