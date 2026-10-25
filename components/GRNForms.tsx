'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  X,
  CheckCircle2,
  Barcode,
  Hash,
  Plus,
  Trash2,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

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

// 1. Add New Product & GRN Inward with Strict Serial & IMEI Tracking
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
    category: 'Electronics',
    productTitle: '',
    costPrice: 0,
    sellingPrice: 0,
    stockQuantity: 1,
    warrantyMonths: 12,
    supplier: defaultSuppliers[0]?.name || 'WOWTEK Direct Import',
  });

  const [isSerialized, setIsSerialized] = useState<boolean>(true);
  const [scannedSerials, setScannedSerials] = useState<string[]>([]);
  const [currentSerialInput, setCurrentSerialInput] = useState<string>('');
  const [serialError, setSerialError] = useState<string | null>(null);

  // Add individual serial or bulk comma/newline separated
  const handleAddSerial = (rawText?: string) => {
    const textToAdd = (rawText !== undefined ? rawText : currentSerialInput).trim();
    if (!textToAdd) return;

    setSerialError(null);
    const candidateSerials = textToAdd
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const newSerialsList = [...scannedSerials];
    const duplicates: string[] = [];

    for (const cand of candidateSerials) {
      if (newSerialsList.some((s) => s.toLowerCase() === cand.toLowerCase())) {
        duplicates.push(cand);
      } else {
        newSerialsList.push(cand);
      }
    }

    if (duplicates.length > 0) {
      setSerialError(`Duplicate serial(s) prevented: ${duplicates.join(', ')}. Each unit must have a unique tracking number.`);
    }

    setScannedSerials(newSerialsList);
    setCurrentSerialInput('');

    // If more serials scanned than initial quantity, bump up quantity to match!
    if (newSerialsList.length > formData.stockQuantity) {
      setFormData((prev) => ({ ...prev, stockQuantity: newSerialsList.length }));
    }
  };

  const handleRemoveSerial = (indexToRemove: number) => {
    setScannedSerials((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    setSerialError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSerialError(null);

    const targetQty = Number(formData.stockQuantity) || 0;
    if (targetQty <= 0) {
      setSerialError('Please enter a valid store stock quantity of 1 or more.');
      return;
    }

    // Strict Serial Enforcement
    if (isSerialized) {
      if (scannedSerials.length === 0) {
        setSerialError(
          `Unique Serial Number / IMEI Required: You must scan or enter ${targetQty} unique serial number(s) for this serialized item before completing GRN.`
        );
        return;
      }
      if (scannedSerials.length !== targetQty) {
        setSerialError(
          `Serial Quantity Mismatch: Quantity entered is ${targetQty}, but you scanned ${scannedSerials.length} serials. Please scan exactly ${targetQty} unique serial numbers or update the quantity.`
        );
        return;
      }

      // Check duplicate within array
      const set = new Set(scannedSerials.map((s) => s.toLowerCase()));
      if (set.size !== scannedSerials.length) {
        setSerialError('Duplicate serials detected within batch. Each physical item must have a unique tracking number.');
        return;
      }
    }

    const payload = {
      ...formData,
      isSerialized,
      serials: scannedSerials,
      serialNumbersInput: scannedSerials.join(', '),
    };

    const handler = onsubmit || onSubmit;
    if (handler) {
      handler(payload);
    }
  };

  const remainingNeeded = Math.max(0, formData.stockQuantity - scannedSerials.length);

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-900 text-white p-6 rounded-2xl max-w-xl mx-auto space-y-4 border border-slate-800 shadow-2xl relative"
    >
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-300">
              Add New Product &amp; GRN Inward
            </h2>
            <span className="text-[10px] font-mono font-bold bg-purple-500/15 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">
              Store Shelf
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Strict Serial &amp; IMEI Tracking · Anti-duplicate verification · Direct store stock
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-slate-300">SKU Code</label>
          <input
            type="text"
            value={formData.skuCode}
            onChange={(e) => setFormData({ ...formData, skuCode: e.target.value.toUpperCase() })}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-2.5 mt-1 text-white font-mono uppercase focus:border-purple-500 focus:outline-none text-xs"
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-300">Category</label>
          <select
            value={formData.category}
            onChange={(e) => {
              const cat = e.target.value;
              setFormData({ ...formData, category: cat });
              // Automatically turn on serialization for electronics and parts
              if (['Electronics', 'Audio & Gadgets', 'Computer Parts', 'Computer Components', 'Peripherals'].includes(cat)) {
                setIsSerialized(true);
              }
            }}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-2.5 mt-1 text-white focus:border-purple-500 focus:outline-none text-xs"
          >
            <option value="Electronics">Electronics</option>
            <option value="Audio & Gadgets">Audio & Gadgets</option>
            <option value="Computer Parts">Computer Parts</option>
            <option value="Computer Components">Computer Components</option>
            <option value="Peripherals">Peripherals</option>
            <option value="Mobile Accessories">Mobile Accessories</option>
            <option value="Networking & Storage">Networking & Storage</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-300">Product Title</label>
        <input
          type="text"
          placeholder="e.g. Baseus Metal Gleam 8-in-1 USB-C Hub"
          value={formData.productTitle}
          onChange={(e) => setFormData({ ...formData, productTitle: e.target.value })}
          className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-2.5 mt-1 text-white focus:border-purple-500 focus:outline-none text-xs"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-slate-300">Cost Price (LKR COGS)</label>
          <input
            type="number"
            min="0"
            value={formData.costPrice || ''}
            onChange={(e) =>
              setFormData({ ...formData, costPrice: Math.max(0, Number(e.target.value) || 0) })
            }
            placeholder="0"
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-2.5 mt-1 text-white font-mono focus:border-purple-500 focus:outline-none text-xs"
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-300">Selling Price (LKR Retail)</label>
          <input
            type="number"
            min="0"
            value={formData.sellingPrice || ''}
            onChange={(e) =>
              setFormData({ ...formData, sellingPrice: Math.max(0, Number(e.target.value) || 0) })
            }
            placeholder="0"
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-2.5 mt-1 text-white font-mono focus:border-purple-500 focus:outline-none text-xs"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-purple-300">Store Stock Quantity</label>
          <input
            type="number"
            min="1"
            value={formData.stockQuantity || ''}
            onChange={(e) => {
              const val = Math.max(1, Number(e.target.value) || 1);
              setFormData({ ...formData, stockQuantity: val });
            }}
            placeholder="1"
            className="w-full bg-slate-950 border border-purple-500/50 rounded-xl p-2.5 mt-1 text-white font-mono focus:border-purple-400 focus:outline-none text-xs"
            required
          />
          <p className="text-[10px] text-slate-400 mt-1">Units added directly to store shelf</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-300">Warranty (Months)</label>
          <input
            type="number"
            min="0"
            value={formData.warrantyMonths || ''}
            onChange={(e) =>
              setFormData({ ...formData, warrantyMonths: Math.max(0, Number(e.target.value) || 0) })
            }
            placeholder="12"
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-2.5 mt-1 text-white font-mono focus:border-purple-500 focus:outline-none text-xs"
          />
          <p className="text-[10px] text-slate-400 mt-1">Official WOWTEK warranty period</p>
        </div>
      </div>

      {/* STRICT SERIAL & IMEI TRACKING SECTION */}
      <div className="p-4 rounded-xl bg-slate-950/80 border border-purple-500/30 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Strict Serial Number &amp; IMEI Enforcement
            </span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={isSerialized}
              onChange={(e) => setIsSerialized(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
            />
            <span className="text-slate-300 text-[11px]">Require Unique S/N per unit</span>
          </label>
        </div>

        {isSerialized ? (
          <div className="space-y-2.5">
            <p className="text-[11px] text-slate-400">
              Each unit requires a unique Serial Number / IMEI. Scan with USB/Bluetooth scanner or enter below (Press Enter or comma to add).
            </p>

            {/* Quick Barcode / Serial Scan Input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Barcode className="w-4 h-4 text-purple-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={currentSerialInput}
                  onChange={(e) => setCurrentSerialInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSerial();
                    } else if (e.key === ',') {
                      e.preventDefault();
                      handleAddSerial();
                    }
                  }}
                  placeholder="Scan S/N barcode or type IMEI & press Enter..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-purple-500/40 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-purple-400"
                />
              </div>
              <button
                type="button"
                onClick={() => handleAddSerial()}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            {/* Status counter pill */}
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">
                Scanned: <strong className="text-white">{scannedSerials.length}</strong> / {formData.stockQuantity} required
              </span>
              {remainingNeeded === 0 ? (
                <span className="text-emerald-300 flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" /> All Units Tracked
                </span>
              ) : (
                <span className="text-amber-300 flex items-center gap-1 text-[11px] font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  <AlertCircle className="w-3.5 h-3.5" /> {remainingNeeded} more S/N needed
                </span>
              )}
            </div>

            {/* Scanned Serials Chips List */}
            {scannedSerials.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-slate-900 rounded-xl border border-slate-800">
                {scannedSerials.map((sn, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-purple-500/15 text-purple-200 border border-purple-500/30"
                  >
                    <Hash className="w-3 h-3 text-purple-400" />
                    <span>{sn}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSerial(idx)}
                      className="text-slate-400 hover:text-rose-400 ml-0.5 cursor-pointer"
                      title="Remove serial"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 italic">
            Serialized tracking disabled. Items will be counted as bulk units. (Recommended only for generic cables or stickers).
          </p>
        )}

        {serialError && (
          <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-2 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{serialError}</span>
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-300">Primary Supplier</label>
        <select
          value={formData.supplier}
          onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
          className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-2.5 mt-1 text-white focus:border-purple-500 focus:outline-none text-xs"
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
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl transition-colors text-xs cursor-pointer"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="flex-1 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-white font-bold py-2.5 rounded-xl hover:opacity-95 transition-opacity text-xs shadow-md shadow-purple-950/50 cursor-pointer"
        >
          Confirm GRN Receipt &amp; Register Serials
        </button>
      </div>
    </form>
  );
}

export interface RestockGRNFormProps {
  product: any;
  suppliers?: Array<SupplierOption | { name: string }>;
  onRestock: (data: {
    id?: string;
    productId?: string;
    sku: string;
    skuCode?: string;
    barcode?: string;
    restockQty: number;
    costPrice: number;
    supplier: string;
    batchRef: string;
    serials?: string[];
    serialNumbersInput?: string;
    isSerialized?: boolean;
  }) => void;
  onCancel?: () => void;
  pendingWaitingCount?: number;
  pendingNeededUnits?: number;
}

// 2. Inward GRN Restock Form with Unique S/N Tracking
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

  const [restockQty, setRestockQty] = useState<number>(5);
  const [costPrice, setCostPrice] = useState<number>(product?.costPrice || 0);
  const [selectedSupplier, setSelectedSupplier] = useState<string>(
    product?.supplier || defaultSuppliers[0]?.name || 'WOWTEK Direct Import'
  );

  const [isSerialized, setIsSerialized] = useState<boolean>(
    Boolean(product?.isSerialized || (Array.isArray(product?.activeSerials) && product?.activeSerials.length > 0))
  );
  const [scannedSerials, setScannedSerials] = useState<string[]>([]);
  const [currentSerialInput, setCurrentSerialInput] = useState<string>('');
  const [serialError, setSerialError] = useState<string | null>(null);

  const handleAddSerial = (rawText?: string) => {
    const textToAdd = (rawText !== undefined ? rawText : currentSerialInput).trim();
    if (!textToAdd) return;

    setSerialError(null);
    const candidateSerials = textToAdd
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const newSerialsList = [...scannedSerials];
    const duplicates: string[] = [];

    // Also check against existing serials already on this product!
    const existingProductSerials = Array.isArray(product?.activeSerials)
      ? product.activeSerials.map((s: any) => (typeof s === 'string' ? s : s?.serialNumber).toLowerCase())
      : [];

    for (const cand of candidateSerials) {
      const lower = cand.toLowerCase();
      if (newSerialsList.some((s) => s.toLowerCase() === lower)) {
        duplicates.push(cand);
      } else if (existingProductSerials.includes(lower)) {
        duplicates.push(`${cand} (Already in active stock)`);
      } else {
        newSerialsList.push(cand);
      }
    }

    if (duplicates.length > 0) {
      setSerialError(`Duplicate serial(s) prevented: ${duplicates.join(', ')}.`);
    }

    setScannedSerials(newSerialsList);
    setCurrentSerialInput('');

    if (newSerialsList.length > restockQty) {
      setRestockQty(newSerialsList.length);
    }
  };

  const handleRemoveSerial = (idx: number) => {
    setScannedSerials((prev) => prev.filter((_, i) => i !== idx));
    setSerialError(null);
  };

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSerialError(null);

    const qty = Number(restockQty) || 0;
    if (qty <= 0) {
      setSerialError('Please enter a restock quantity of 1 or more.');
      return;
    }

    if (isSerialized) {
      if (scannedSerials.length === 0) {
        setSerialError(`Please scan or enter ${qty} unique serial numbers for this restock.`);
        return;
      }
      if (scannedSerials.length !== qty) {
        setSerialError(
          `Restock Quantity (${qty}) does not match scanned serials (${scannedSerials.length}). Please scan exactly ${qty} serials or adjust quantity.`
        );
        return;
      }
    }

    onRestock({
      id: product?._id || product?.id,
      productId: product?._id || product?.id,
      sku: product?.sku || product?.skuCode || '',
      skuCode: product?.skuCode || product?.sku || '',
      barcode: product?.barcode,
      restockQty: qty,
      costPrice: Number(costPrice) || 0,
      supplier: selectedSupplier,
      batchRef: `GRN-${Date.now()}`,
      serials: scannedSerials,
      serialNumbersInput: scannedSerials.join(', '),
      isSerialized,
    });
  };

  const currentStoreHeld =
    product?.storeStock ??
    product?.currentStoreStock ??
    product?.stockStore ??
    product?.stockQuantity ??
    0;

  const remainingNeeded = Math.max(0, restockQty - scannedSerials.length);

  return (
    <form
      onSubmit={handleRestockSubmit}
      className="bg-slate-900 text-white p-6 rounded-2xl max-w-xl mx-auto space-y-4 border border-slate-800 shadow-2xl relative"
    >
      <div className="flex justify-between items-center border-b border-slate-800/80 pb-3">
        <div>
          <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
            <span>Inward GRN Restock &amp; Serial Verification</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Store shelf inventory increment · Auto-deducts pending backlog orders
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
        <p>
          <strong className="text-white">Product:</strong>{' '}
          {product?.title || product?.productTitle || product?.name || 'Item'}
        </p>
        <p>
          <strong className="text-white">SKU:</strong> {product?.sku || product?.skuCode}{' '}
          <span className="text-slate-600">|</span>{' '}
          <span className="text-emerald-400 font-semibold">Current Store Stock: {currentStoreHeld}</span>
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
          <label className="text-xs font-semibold text-emerald-400">Store Restock Quantity</label>
          <input
            type="number"
            min="1"
            value={restockQty}
            onChange={(e) => {
              const val = Math.max(1, Number(e.target.value) || 1);
              setRestockQty(val);
            }}
            className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl p-2.5 mt-1 text-white font-mono focus:border-emerald-400 focus:outline-none text-xs"
            required
          />
          <p className="text-[10px] text-slate-400 mt-1">Increments storeStock directly</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-300">Landed Cost Price (COGS)</label>
          <input
            type="number"
            min="0"
            value={costPrice}
            onChange={(e) => setCostPrice(Number(e.target.value))}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-2.5 mt-1 text-white font-mono focus:border-emerald-500 focus:outline-none text-xs"
            required
          />
          <p className="text-[10px] text-slate-400 mt-1">Used for verified profit calculation</p>
        </div>
      </div>

      {/* STRICT SERIAL SCANNING FOR RESTOCK */}
      <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-500/30 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Scan Restock Serial Numbers &amp; IMEIs
            </span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={isSerialized}
              onChange={(e) => setIsSerialized(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
            />
            <span className="text-slate-300 text-[11px]">Serialized Unit</span>
          </label>
        </div>

        {isSerialized ? (
          <div className="space-y-2.5">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Barcode className="w-4 h-4 text-emerald-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={currentSerialInput}
                  onChange={(e) => setCurrentSerialInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      handleAddSerial();
                    }
                  }}
                  placeholder="Scan serial barcode or type S/N & press Enter..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-emerald-500/40 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
                />
              </div>
              <button
                type="button"
                onClick={() => handleAddSerial()}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">
                Scanned: <strong className="text-white">{scannedSerials.length}</strong> / {restockQty} units
              </span>
              {remainingNeeded === 0 ? (
                <span className="text-emerald-300 flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ready to restock
                </span>
              ) : (
                <span className="text-amber-300 flex items-center gap-1 text-[11px] font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  <AlertCircle className="w-3.5 h-3.5" /> {remainingNeeded} serial(s) remaining
                </span>
              )}
            </div>

            {scannedSerials.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-900 rounded-xl border border-slate-800">
                {scannedSerials.map((sn, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-200 border border-emerald-500/30"
                  >
                    <Hash className="w-3 h-3 text-emerald-400" />
                    <span>{sn}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSerial(idx)}
                      className="text-slate-400 hover:text-rose-400 ml-0.5 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 italic">
            Non-serialized item. Stock count will be added in bulk without individual tracking.
          </p>
        )}

        {serialError && (
          <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{serialError}</span>
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-300">Supplier / Source</label>
        <select
          value={selectedSupplier}
          onChange={(e) => setSelectedSupplier(e.target.value)}
          className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-2.5 mt-1 text-white focus:border-emerald-500 focus:outline-none text-xs"
        >
          {defaultSuppliers.map((sup, idx) => (
            <option key={idx} value={sup.name}>
              {sup.name}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-purple-950/40 border border-purple-800/80 p-3 rounded-xl text-xs text-purple-300">
        ⚡ <strong>Auto-Deduction Engine:</strong> Any pending orders waiting for {product?.sku || 'this SKU'} will automatically have stock deducted, accurate COGS and Net Operating Profit computed, and be moved to active status!
      </div>

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl transition-colors text-xs cursor-pointer"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white font-bold py-2.5 rounded-xl transition-all text-xs shadow-md shadow-emerald-950/50 cursor-pointer"
        >
          Confirm Inward GRN Restock
        </button>
      </div>
    </form>
  );
}
