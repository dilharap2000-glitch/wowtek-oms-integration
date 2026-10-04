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
} from 'lucide-react';
import { Product } from '@/types';
import { BarcodeScannerModal } from './BarcodeScannerModal';

interface ProductsTabProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
  onUpdateProduct?: (id: string, updates: Partial<Product>) => void;
  onDeleteProduct?: (id: string) => void;
}

export const ProductsTab: React.FC<ProductsTabProps> = ({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductForBarcode, setSelectedProductForBarcode] = useState<Product | null>(null);
  const [barcodePrintCount, setBarcodePrintCount] = useState(12);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // New product form
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Computer Components');
  const [costPrice, setCostPrice] = useState(15000);
  const [sellingPrice, setSellingPrice] = useState(21000);
  const [stockWarehouse, setStockWarehouse] = useState(20);
  const [stockStore, setStockStore] = useState(5);
  const [supplier, setSupplier] = useState('');
  const [grnBatch, setGrnBatch] = useState('GRN-2026-OCT-020');
  const [warrantyMonths, setWarrantyMonths] = useState(24);

  // Inventory Valuation Metrics
  const totalCostValue = products.reduce(
    (sum, p) => sum + (p.stockWarehouse + p.stockStore) * p.costPrice,
    0
  );
  const totalRetailValue = products.reduce(
    (sum, p) => sum + (p.stockWarehouse + p.stockStore) * p.sellingPrice,
    0
  );
  const potentialProfit = totalRetailValue - totalCostValue;
  const overallMarginPercent =
    totalRetailValue > 0 ? ((potentialProfit / totalRetailValue) * 100).toFixed(1) : '0';

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery)
  );

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const newProd: Product = {
      id: `prod-${Date.now().toString().slice(-4)}`,
      sku: sku.toUpperCase() || `WT-${Date.now().toString().slice(-5)}`,
      barcode: `479${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      name,
      category,
      costPrice,
      sellingPrice,
      stockWarehouse,
      stockStore,
      stockReserved: 0,
      grnBatch,
      supplier: supplier || 'WOWTEK Direct Import',
      warrantyPeriodMonths: warrantyMonths,
    };

    onAddProduct(newProd);
    setShowAddModal(false);
    setSku('');
    setName('');
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
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-neutral-200 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg transition-colors shadow-sm"
          >
            <Camera className="w-4 h-4 text-purple-400" />
            <span>Scan Barcode</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
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
            {products.length}{' '}
            <span className="text-xs font-sans font-normal text-neutral-400">SKUs</span>
          </div>
          <div className="text-[11px] text-neutral-400 mt-2">
            {products.reduce((s, p) => s + p.stockStore + p.stockWarehouse, 0)} total units on hand
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between p-3 rounded-xl bg-neutral-900 border border-neutral-800">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search SKU, name, category, barcode..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
          />
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
                <th className="py-3 px-4 font-medium">Product Details</th>
                <th className="py-3 px-4 font-medium text-right">Cost Price</th>
                <th className="py-3 px-4 font-medium text-right">Selling Price</th>
                <th className="py-3 px-4 font-medium w-48">Profit Margin Bar</th>
                <th className="py-3 px-4 font-medium text-center">Stock (Whse / Store)</th>
                <th className="py-3 px-4 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/80">
              {filteredProducts.map((p) => {
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

                return (
                  <tr key={p.id} className="hover:bg-neutral-850/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono font-semibold text-purple-300">{p.sku}</div>
                      <div className="text-[11px] font-mono text-neutral-400 mt-0.5">{p.barcode}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-white max-w-xs">{p.name}</div>
                      <div className="text-[11px] text-neutral-400">{p.category}</div>
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
              })}
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
                onClick={() => setShowAddModal(false)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
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
                    required
                    value={costPrice}
                    onChange={(e) => setCostPrice(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Selling Price (LKR)</label>
                  <input
                    type="number"
                    required
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Warehouse Stock</label>
                  <input
                    type="number"
                    value={stockWarehouse}
                    onChange={(e) => setStockWarehouse(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Store Front Stock</label>
                  <input
                    type="number"
                    value={stockStore}
                    onChange={(e) => setStockStore(parseInt(e.target.value) || 0)}
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
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Warranty (Months)</label>
                  <input
                    type="number"
                    value={warrantyMonths}
                    onChange={(e) => setWarrantyMonths(parseInt(e.target.value) || 12)}
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Supplier / Distributor</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="e.g. Singer Digital / Chama Computers"
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white bg-neutral-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg shadow-sm"
                >
                  Confirm GRN Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
