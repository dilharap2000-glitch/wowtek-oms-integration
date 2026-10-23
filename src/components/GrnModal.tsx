'use client';

import React, { useState } from 'react';

export default function GrnModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('Mobile Accessories');
  const [productTitle, setProductTitle] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [storeStockQuantity, setStoreStockQuantity] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState('');
  const [supplier, setSupplier] = useState('max buy (100% Advance Payment)');
  const [serialNumbersInput, setSerialNumbersInput] = useState(''); // Serial numbers input state එක
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/grn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku,
          category,
          productTitle,
          costPrice: Number(costPrice),
          sellingPrice: Number(sellingPrice),
          restockQty: Number(storeStockQuantity),
          warrantyMonths: Number(warrantyMonths || 12),
          supplier,
          serialNumbersInput, // Backend එකට serials යැවීම
          batchRef: `GRN-${new Date().toISOString().slice(0, 10)}-${Math.floor(100 + Math.random() * 900)}`,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setFeedback({ type: 'success', message: data.message });
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else {
        setFeedback({ type: 'error', message: data.error || data.message || 'Failed to record GRN' });
      }
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message || 'Something went wrong!' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-xl p-6 text-white relative shadow-2xl">
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl"
        >
          ✕
        </button>

        <h2 className="text-xl font-bold text-red-500 mb-1">Add New Product & GRN Inward (Store Only)</h2>
        <p className="text-xs text-gray-400 mb-6">Store Front Stock Inward · Warehouse removed · Auto-deducts pending orders</p>

        {feedback && (
          <div
            className={`mb-4 p-3 rounded-lg text-xs font-medium ${
              feedback.type === 'success'
                ? 'bg-emerald-950/80 border border-emerald-700 text-emerald-200'
                : 'bg-rose-950/80 border border-rose-700 text-rose-200'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-300 mb-1">SKU Code</label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:outline-none focus:border-red-500"
                placeholder="WT-56DQK4"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:outline-none focus:border-red-500"
              >
                <option value="Mobile Accessories">Mobile Accessories</option>
                <option value="Electronics">Electronics</option>
                <option value="Audio">Audio</option>
                <option value="Peripherals">Peripherals</option>
                <option value="Cables & Chargers">Cables & Chargers</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-300 mb-1">Product Title</label>
            <input
              type="text"
              value={productTitle}
              onChange={(e) => setProductTitle(e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:outline-none focus:border-red-500"
              placeholder="e.g. Anker R50i Earbuds"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-300 mb-1">Cost Price (LKR)</label>
              <input
                type="number"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                required
                min="0"
                step="any"
                className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:outline-none focus:border-red-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-300 mb-1">Selling Price (LKR)</label>
              <input
                type="number"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                required
                min="0"
                step="any"
                className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:outline-none focus:border-red-500"
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-300 mb-1">Store Stock Quantity</label>
              <input
                type="number"
                value={storeStockQuantity}
                onChange={(e) => setStoreStockQuantity(e.target.value)}
                required
                min="1"
                step="1"
                className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:outline-none focus:border-red-500"
                placeholder="10"
              />
              <p className="text-[10px] text-gray-500 mt-0.5">Direct store shelf inventory (Warehouse removed)</p>
            </div>
            <div>
              <label className="block text-xs text-gray-300 mb-1">Warranty (Months)</label>
              <input
                type="number"
                value={warrantyMonths}
                onChange={(e) => setWarrantyMonths(e.target.value)}
                min="0"
                step="1"
                className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:outline-none focus:border-red-500"
                placeholder="12"
              />
              <p className="text-[10px] text-gray-500 mt-0.5">Official WOWTEK warranty period</p>
            </div>
          </div>

          {/* 🌟 මෙන්න අලුතින් එකතු කළ Serial Numbers Input එක */}
          <div>
            <label className="block text-xs text-gray-300 mb-1">Serial Numbers (Optional - Comma separated)</label>
            <textarea
              rows={2}
              placeholder="Leave blank to auto-generate barcodes, or enter serials separated by comma (e.g. SN1001, SN1002)"
              value={serialNumbersInput}
              onChange={(e) => setSerialNumbersInput(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-sm focus:outline-none focus:border-red-500 resize-none font-mono"
            />
            <p className="text-[10px] text-purple-400 mt-0.5">ප්රමාණයට අදාළව Serials දෙන්න. නැත්නම් සිස්ටම් එකෙන් Auto Barcodes හැදේ.</p>
          </div>

          <div>
            <label className="block text-xs text-gray-300 mb-1">Primary Supplier</label>
            <select
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:outline-none focus:border-red-500"
            >
              <option value="max buy (100% Advance Payment)">max buy (100% Advance Payment)</option>
              <option value="Direct Supplier">Direct Supplier</option>
              <option value="Singer Digital Sri Lanka">Singer Digital Sri Lanka</option>
              <option value="Chama Computers Colombo">Chama Computers Colombo</option>
              <option value="Redline Technologies">Redline Technologies</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:opacity-90 rounded text-sm font-bold text-white shadow-lg cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Confirm GRN Receipt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
