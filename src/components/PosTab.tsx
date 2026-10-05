import React, { useState } from 'react';
import {
  ShoppingCart,
  Camera,
  Barcode,
  Plus,
  Minus,
  Trash2,
  Printer,
  RotateCcw,
  Edit,
  Search,
  CheckCircle2,
  X,
  CreditCard,
  Tag,
  DollarSign,
  TrendingUp,
  FileText,
  Package,
} from 'lucide-react';
import {
  Order,
  OrderItem,
  Product,
  PlatformConfig,
  PaymentGatewayConfig,
} from '@/types';
import { BarcodeScannerModal } from './BarcodeScannerModal';

interface PosTabProps {
  products: Product[];
  orders: Order[];
  platforms: PlatformConfig[];
  gateways: PaymentGatewayConfig[];
  onCreateOrder: (order: Order) => void;
  onUpdateOrder: (id: string, updates: Partial<Order>) => void;
  onDeleteOrder: (id: string) => void;
  onProcessReturn: (orderId: string, itemSkus?: string[], reason?: string) => void;
  onAddProduct?: (product: Product) => void;
  onLoadSampleProducts?: () => void;
}

export const PosTab: React.FC<PosTabProps> = ({
  products,
  orders,
  platforms,
  gateways,
  onCreateOrder,
  onUpdateOrder,
  onDeleteOrder,
  onProcessReturn,
  onAddProduct,
  onLoadSampleProducts,
}) => {
  // POS Cart State
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [selectedPlatformCode, setSelectedPlatformCode] = useState<string>('pos');
  const [selectedGatewayCode, setSelectedGatewayCode] = useState<string>('cash_cod');
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('+94 77 ');
  const [customerCity, setCustomerCity] = useState('Colombo 04');
  const [courierFee, setCourierFee] = useState<number>(0);

  // Modals & Scanner state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Order | null>(null);
  const [returnModalOrder, setReturnModalOrder] = useState<Order | null>(null);
  const [returnReason, setReturnReason] = useState('Customer Return & Restock');
  const [editModalOrder, setEditModalOrder] = useState<Order | null>(null);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'terminal' | 'invoices'>('terminal');

  // Active configurations
  const activePlatform = platforms.find((p) => p.code === selectedPlatformCode) || platforms[0] || {
    id: 'p1',
    name: 'POS In-store',
    code: 'pos',
    feePercent: 0,
    isCustom: false,
    active: true,
  };

  const activeGateway = gateways.find((g) => g.code === selectedGatewayCode) || gateways[0] || {
    id: 'g1',
    name: 'Cash / COD',
    code: 'cash_cod',
    feePercent: 0,
    isCustom: false,
    active: true,
  };

  // Cart calculations
  const grossTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalCostOfGoods = cart.reduce((sum, item) => sum + item.costPrice * item.quantity, 0);

  const platformFeeAmount = Math.round((grossTotal * activePlatform.feePercent) / 100);
  const gatewayFeeAmount = Math.round((grossTotal * activeGateway.feePercent) / 100);
  const netProfit = grossTotal - platformFeeAmount - gatewayFeeAmount - courierFee - totalCostOfGoods;

  // Add product to cart by barcode or SKU
  const handleAddProductToCart = (prod: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.sku === prod.sku);
      if (existing) {
        return prev.map((item) =>
          item.sku === prod.sku ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          sku: prod.sku,
          barcode: prod.barcode,
          name: prod.name,
          quantity: 1,
          unitPrice: prod.sellingPrice,
          costPrice: prod.costPrice,
        },
      ];
    });
  };

  // Scanned Barcode Handler (Continuous Cart Addition)
  const handleBarcodeScanned = (barcode: string) => {
    const clean = barcode.trim();
    const foundProduct = products.find(
      (p) =>
        (p.barcode && p.barcode.trim().toLowerCase() === clean.toLowerCase()) ||
        (p.sku && p.sku.trim().toLowerCase() === clean.toLowerCase())
    );
    if (foundProduct) {
      handleAddProductToCart(foundProduct);
      return true;
    }
    return false;
  };

  // Add custom uncataloged item directly to cart on the fly
  const handleAddCustomItem = (item: {
    sku: string;
    barcode: string;
    name: string;
    sellingPrice: number;
    costPrice?: number;
    saveToInventory?: boolean;
  }) => {
    // 1. Add to POS cart
    setCart((prev) => {
      const existing = prev.find(
        (i) => i.sku === item.sku || (item.barcode && i.barcode === item.barcode)
      );
      if (existing) {
        return prev.map((i) =>
          i.sku === item.sku ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          sku: item.sku,
          barcode: item.barcode,
          name: item.name,
          quantity: 1,
          unitPrice: item.sellingPrice,
          costPrice: item.costPrice || Math.round(item.sellingPrice * 0.7),
        },
      ];
    });

    // 2. If user requested to save to Inventory, persist as a new Product
    if (item.saveToInventory && onAddProduct) {
      const newProd: Product = {
        id: `prod-${Date.now().toString().slice(-4)}`,
        sku: item.sku,
        barcode: item.barcode,
        name: item.name,
        category: 'Scanned Items',
        costPrice: item.costPrice || Math.round(item.sellingPrice * 0.7),
        sellingPrice: item.sellingPrice,
        stockWarehouse: 10,
        stockStore: 5,
        stockReserved: 1,
        grnBatch: `GRN-${new Date().getFullYear()}-POS`,
        supplier: 'Direct Scanner Entry',
        warrantyPeriodMonths: 12,
      };
      onAddProduct(newProd);
    }
  };

  const handleUpdateQuantity = (sku: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.sku === sku) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as OrderItem[]
    );
  };

  const handleRemoveFromCart = (sku: string) => {
    setCart((prev) => prev.filter((item) => item.sku !== sku));
  };

  // Complete POS Checkout
  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      alert('Cart is empty. Please scan or select products.');
      return;
    }

    const invoiceNum = `INV-${activePlatform.code.toUpperCase().slice(0, 3)}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    const newOrder: Order = {
      id: `ord-${Date.now().toString().slice(-4)}`,
      invoiceNumber: invoiceNum,
      channel: activePlatform.code,
      channelName: activePlatform.name,
      paymentGateway: activeGateway.code,
      paymentGatewayName: activeGateway.name,
      customerName,
      customerPhone,
      deliveryAddress: 'Walk-in / In-Store Checkout',
      city: customerCity,
      items: [...cart],
      grossTotal,
      platformFeePercent: activePlatform.feePercent,
      platformFeeAmount,
      gatewayFeePercent: activeGateway.feePercent,
      gatewayFeeAmount,
      courierFee,
      costOfGoods: totalCostOfGoods,
      netProfit,
      status: 'Completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      waybillGenerated: false,
      isPosSale: true,
      notes: `POS sale processed via ${activeGateway.name} (${activeGateway.feePercent}% fee).`,
    };

    onCreateOrder(newOrder);

    // Auto-dispatch Order Confirmation SMS via SMSlenz
    if (customerPhone && customerPhone.trim().length >= 9) {
      try {
        fetch('/api/sms/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact: customerPhone,
            message: `WOWTEK PRO: Invoice ${invoiceNum} confirmed. Total: Rs. ${grossTotal.toLocaleString()}. Payment: ${activeGateway.name}. Thank you for your purchase!`,
            triggerType: 'order_confirmed',
            referenceId: invoiceNum,
          }),
        }).catch(() => {});
      } catch {
        // Safe fallback
      }
    }

    setSelectedInvoiceForPrint(newOrder);
    setCart([]);
    setCustomerName('Walk-in Customer');
    setCustomerPhone('+94 77 ');
  };

  // Confirm Return & Stock Restoration
  const handleConfirmReturn = () => {
    if (!returnModalOrder) return;
    onProcessReturn(returnModalOrder.id, undefined, returnReason);
    setReturnModalOrder(null);
  };

  // Filter products for catalog search
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.barcode.includes(productSearch)
  );

  // Filter orders for Invoices view
  const filteredOrders = orders.filter(
    (o) =>
      o.invoiceNumber.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
      o.customerName.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
      o.channelName.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
      o.paymentGatewayName.toLowerCase().includes(orderSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Sub navigation: Terminal vs Invoices Management */}
      <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('terminal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'terminal'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            POS Terminal & Invoicing
          </button>
          <button
            onClick={() => setActiveSubTab('invoices')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'invoices'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <span>Invoice History & Returns</span>
            <span className="px-1.5 py-0.5 rounded-full bg-neutral-800 text-[10px] text-neutral-300 font-mono">
              {orders.length}
            </span>
          </button>
        </div>

        {activeSubTab === 'terminal' && (
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors shadow-sm"
          >
            <Camera className="w-4 h-4" />
            <span>Open Phone Barcode Scanner</span>
          </button>
        )}
      </div>

      {/* POS TERMINAL VIEW */}
      {activeSubTab === 'terminal' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Product Catalog & Fast Quick-Add (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Search and Category Filter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search products by SKU, name, or scan barcode..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                />
              </div>
              <button
                onClick={() => setIsScannerOpen(true)}
                className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 rounded-xl text-xs font-medium flex items-center gap-1.5"
                title="Scan Barcode with Camera"
              >
                <Barcode className="w-4 h-4 text-purple-400" />
                <span>Camera Scan</span>
              </button>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[640px] overflow-y-auto pr-1">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full py-16 px-4 text-center bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col items-center justify-center gap-2">
                  <Package className="w-10 h-10 text-neutral-600 mb-1" />
                  <h4 className="text-sm font-semibold text-white">No Products in Inventory</h4>
                  <p className="text-xs text-neutral-400 max-w-sm">
                    Your store inventory is empty. Add products in the Products & Barcode GRN tab or scan barcodes to begin invoicing.
                  </p>
                </div>
              ) :
                filteredProducts.map((prod) => {
                const profitMargin =
                  prod.sellingPrice > 0
                    ? Math.round(((prod.sellingPrice - prod.costPrice) / prod.sellingPrice) * 100)
                    : 0;

                return (
                  <div
                    key={prod.id}
                    onClick={() => handleAddProductToCart(prod)}
                    className="p-3 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-purple-500/60 rounded-xl cursor-pointer transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-mono font-semibold text-purple-400">
                          {prod.sku}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-950 font-mono text-neutral-300">
                          {prod.stockStore} in store
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-white mt-1 line-clamp-2 group-hover:text-purple-300 transition-colors">
                        {prod.name}
                      </h4>
                    </div>

                    <div className="mt-3 pt-2 border-t border-neutral-800/80">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-white">
                          Rs. {prod.sellingPrice.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                          +{profitMargin}%
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-neutral-500 mt-0.5 truncate">
                        Barcode: {prod.barcode}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Active POS Cart & Dynamic Checkout (5 cols) */}
          <div className="lg:col-span-5 bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-semibold text-white">POS Checkout Cart</h3>
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-xs text-neutral-400 hover:text-red-400 transition-colors"
                  >
                    Clear Cart
                  </button>
                )}
              </div>

              {/* Cart Items List */}
              <div className="my-3 space-y-2 max-h-56 overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <div className="py-12 text-center text-neutral-500 text-xs">
                    Cart is currently empty.
                    <br />
                    Click products from catalog or scan a barcode to add.
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.sku}
                      className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800/90 flex items-center justify-between text-xs"
                    >
                      <div className="max-w-[170px]">
                        <div className="font-medium text-white line-clamp-1">{item.name}</div>
                        <div className="text-[10px] font-mono text-neutral-400">
                          Rs. {item.unitPrice.toLocaleString()} each
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.sku, -1)}
                            className="p-1 text-neutral-400 hover:text-white rounded"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center font-mono font-semibold text-white text-xs">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.sku, 1)}
                            className="p-1 text-neutral-400 hover:text-white rounded"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="font-mono font-bold text-white text-xs w-20 text-right">
                          Rs. {(item.unitPrice * item.quantity).toLocaleString()}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(item.sku)}
                          className="p-1 text-neutral-500 hover:text-red-400 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Dynamic Channel & Payment Gateway Selectors */}
              <div className="space-y-3 pt-3 border-t border-neutral-800 text-xs">
                {/* Platform Selector */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-neutral-300 font-medium">Sales Channel / Platform</span>
                    <span className="text-[11px] font-mono text-purple-400">
                      Fee: {activePlatform.feePercent}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {platforms.map((plt) => (
                      <button
                        key={plt.code}
                        type="button"
                        onClick={() => setSelectedPlatformCode(plt.code)}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          selectedPlatformCode === plt.code
                            ? 'border-purple-500 bg-purple-500/10 text-white'
                            : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700'
                        }`}
                      >
                        <div className="font-semibold text-[11px] truncate">{plt.name}</div>
                        <div className="text-[10px] font-mono opacity-80">{plt.feePercent}% Platform Fee</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Gateway Selector with Dynamic Fees */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-neutral-300 font-medium">Payment Gateway</span>
                    <span className="text-[11px] font-mono text-purple-400">
                      Fee: {activeGateway.feePercent}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {gateways.map((gw) => (
                      <button
                        key={gw.code}
                        type="button"
                        onClick={() => setSelectedGatewayCode(gw.code)}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          selectedGatewayCode === gw.code
                            ? 'border-purple-500 bg-purple-500/10 text-white'
                            : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700'
                        }`}
                      >
                        <div className="font-semibold text-[11px] truncate">{gw.name}</div>
                        <div className="text-[10px] font-mono opacity-80">{gw.feePercent}% Gateway Fee</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customer Info */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] text-neutral-400 mb-0.5">Customer Name</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-sans text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-400 mb-0.5">Mobile Phone (Sri Lanka)</label>
                    <input
                      type="text"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Summary & Checkout Button */}
            <div className="pt-3 border-t border-neutral-800 space-y-2 text-xs">
              <div className="space-y-1 font-mono">
                <div className="flex justify-between text-neutral-400">
                  <span>Gross Total:</span>
                  <span className="text-white">Rs. {grossTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                {platformFeeAmount > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>Platform Fee ({activePlatform.feePercent}%):</span>
                    <span>-Rs. {platformFeeAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {gatewayFeeAmount > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>Payment Fee ({activeGateway.feePercent}%):</span>
                    <span>-Rs. {gatewayFeeAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between text-neutral-400">
                  <span>Cost of Goods (COGS):</span>
                  <span>-Rs. {totalCostOfGoods.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-semibold pt-1 border-t border-neutral-800">
                  <span>Net Estimated Profit:</span>
                  <span>Rs. {netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCheckout}
                disabled={cart.length === 0}
                className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-xs shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Complete POS Sale & Print Invoice (Rs. {grossTotal.toLocaleString()})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INVOICES & RETURNS MANAGEMENT VIEW */}
      {activeSubTab === 'invoices' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                placeholder="Search invoice #, customer name, gateway..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="text-xs text-neutral-400 flex items-center gap-3">
              <span>
                Total Invoiced: <strong className="text-white font-mono">{orders.length}</strong>
              </span>
              <span>·</span>
              <span>
                Returns Processed:{' '}
                <strong className="text-amber-400 font-mono">
                  {orders.filter((o) => o.status === 'Returned' || o.status === 'Partially Returned').length}
                </strong>
              </span>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-950/60 text-neutral-400">
                    <th className="py-3 px-4 font-medium">Invoice No & Date</th>
                    <th className="py-3 px-4 font-medium">Customer Details</th>
                    <th className="py-3 px-4 font-medium">Channel & Gateway Fee</th>
                    <th className="py-3 px-4 font-medium">Items Invoiced</th>
                    <th className="py-3 px-4 font-medium text-right">Gross Total</th>
                    <th className="py-3 px-4 font-medium text-right">Net Profit</th>
                    <th className="py-3 px-4 font-medium text-center">Status</th>
                    <th className="py-3 px-4 font-medium text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/80">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                          <ShoppingCart className="w-10 h-10 text-neutral-600 mb-1" />
                          <p className="font-semibold text-white text-sm">No Invoices Found</p>
                          <p className="text-xs text-neutral-400">
                            No sales invoices have been created yet. Process an order through the POS terminal to generate your first invoice.
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveSubTab('terminal')}
                            className="mt-2 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition-colors"
                          >
                            Open POS Terminal
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) :
                    filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-neutral-850/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-mono font-semibold text-white">{order.invoiceNumber}</div>
                          <div className="text-[10px] text-neutral-400 font-mono">
                            {new Date(order.createdAt).toLocaleDateString('en-GB')}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-medium text-white">{order.customerName}</div>
                          <div className="text-neutral-400 font-mono text-[11px]">{order.customerPhone}</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="text-neutral-200">{order.channelName}</div>
                          <div className="text-[11px] text-purple-300 font-mono">
                            {order.paymentGatewayName} ({order.gatewayFeePercent}%)
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {order.items.map((it, idx) => (
                            <div key={idx} className="text-neutral-300 text-[11px]">
                              <span className="font-semibold text-white">{it.quantity}x</span> {it.name}
                              {it.returned && (
                                <span className="ml-1 text-[10px] text-amber-400 font-mono">[Returned]</span>
                              )}
                            </div>
                          ))}
                        </td>

                        <td className="py-3 px-4 text-right font-mono tabular-nums text-white font-medium">
                          Rs. {order.grossTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>

                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-400">
                          Rs. {order.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${
                              order.status === 'Completed' || order.status === 'Delivered'
                                ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800'
                                : order.status === 'Returned'
                                ? 'bg-red-950/70 text-red-400 border-red-800'
                                : order.status === 'Partially Returned'
                                ? 'bg-amber-950/70 text-amber-300 border-amber-800'
                                : 'bg-purple-950/70 text-purple-300 border-purple-800'
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View / Print Invoice */}
                            <button
                              onClick={() => setSelectedInvoiceForPrint(order)}
                              className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors"
                              title="Print Thermal Receipt / Tax Invoice"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            {/* Process Return & Restock */}
                            {order.status !== 'Returned' && (
                              <button
                                onClick={() => setReturnModalOrder(order)}
                                className="p-1.5 text-amber-400 hover:text-amber-300 rounded hover:bg-neutral-800 transition-colors"
                                title="Process Customer Return & Restore Stock"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Edit Invoice */}
                            <button
                              onClick={() => setEditModalOrder(order)}
                              className="p-1.5 text-purple-400 hover:text-purple-300 rounded hover:bg-neutral-800 transition-colors"
                              title="Edit Invoice Details"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Invoice */}
                            <button
                              onClick={() => {
                                if (confirm(`Delete invoice ${order.invoiceNumber}?`)) {
                                  onDeleteOrder(order.id);
                                }
                              }}
                              className="p-1.5 text-neutral-500 hover:text-red-400 rounded hover:bg-neutral-800 transition-colors"
                              title="Delete Invoice"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Camera Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
        onAddCustomItem={handleAddCustomItem}
        products={products}
        title="POS Camera Barcode Scanner"
        description="Scan any product barcode or SKU to continuously add to cart"
        cartItemCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
        onLoadSampleProducts={onLoadSampleProducts}
      />

      {/* Return & Stock Restoration Modal */}
      {returnModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">
                  Process Return & Restore Stock
                </h3>
              </div>
              <button
                onClick={() => setReturnModalOrder(null)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-1">
                <div className="flex justify-between font-mono">
                  <span className="text-neutral-400">Invoice:</span>
                  <span className="text-white font-semibold">{returnModalOrder.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Customer:</span>
                  <span className="text-white">{returnModalOrder.customerName}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-neutral-400">Gross Total Refunded:</span>
                  <span className="text-amber-400 font-bold">
                    Rs. {returnModalOrder.grossTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Items Returning to Store Stock:
                </label>
                <div className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg space-y-1.5">
                  {returnModalOrder.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[11px]">
                      <span className="text-white">
                        {it.quantity}x {it.name}
                      </span>
                      <span className="font-mono text-emerald-400 font-medium">
                        +{it.quantity} stock will be restored
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Reason for Return</label>
                <input
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. Customer change of mind / unopened seal"
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
              </div>

              <div className="p-3 bg-amber-950/40 border border-amber-800/40 rounded-lg text-[11px] text-amber-300">
                Notice: Confirming this return will automatically increment store inventory stock for all returned items and adjust business net profit calculations.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReturnModalOrder(null)}
                  className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white bg-neutral-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReturn}
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg shadow-sm"
                >
                  Confirm Return & Restore Stock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Invoice Modal */}
      {editModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950">
              <h3 className="text-sm font-semibold text-white">
                Edit Invoice - {editModalOrder.invoiceNumber}
              </h3>
              <button
                onClick={() => setEditModalOrder(null)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateOrder(editModalOrder.id, {
                  customerName: editModalOrder.customerName,
                  customerPhone: editModalOrder.customerPhone,
                  city: editModalOrder.city,
                  notes: editModalOrder.notes,
                });
                setEditModalOrder(null);
              }}
              className="p-5 space-y-3 text-xs"
            >
              <div>
                <label className="block text-neutral-300 font-medium mb-1">Customer Name</label>
                <input
                  type="text"
                  value={editModalOrder.customerName}
                  onChange={(e) =>
                    setEditModalOrder({ ...editModalOrder, customerName: e.target.value })
                  }
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Customer Phone</label>
                <input
                  type="text"
                  value={editModalOrder.customerPhone}
                  onChange={(e) =>
                    setEditModalOrder({ ...editModalOrder, customerPhone: e.target.value })
                  }
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">City / Region</label>
                <input
                  type="text"
                  value={editModalOrder.city}
                  onChange={(e) => setEditModalOrder({ ...editModalOrder, city: e.target.value })}
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Invoice Notes</label>
                <textarea
                  rows={2}
                  value={editModalOrder.notes || ''}
                  onChange={(e) => setEditModalOrder({ ...editModalOrder, notes: e.target.value })}
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalOrder(null)}
                  className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white bg-neutral-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Thermal Receipt / Invoice Modal */}
      {selectedInvoiceForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">
                  Official POS Receipt & Tax Invoice
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print 80mm Receipt</span>
                </button>
                <button
                  onClick={() => setSelectedInvoiceForPrint(null)}
                  className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Thermal Slip Simulation */}
            <div className="p-6 bg-neutral-950 flex justify-center">
              <div className="w-full max-w-xs bg-white text-black p-4 rounded border border-neutral-300 font-mono text-xs space-y-3">
                <div className="text-center pb-2 border-b border-dashed border-black">
                  <div className="font-bold text-base tracking-wider">WOWTEK PRO</div>
                  <div className="text-[10px] text-neutral-700">SRI LANKA E-COMMERCE & RETAIL</div>
                  <div className="text-[9px] text-neutral-600">No. 182, Galle Road, Colombo 04</div>
                  <div className="text-[9px] text-neutral-600">VAT: 10488921-7000 · Tel: 011 258 9000</div>
                </div>

                <div className="text-[10px] space-y-0.5">
                  <div className="flex justify-between">
                    <span>INVOICE:</span>
                    <span className="font-bold">{selectedInvoiceForPrint.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>DATE:</span>
                    <span>{new Date(selectedInvoiceForPrint.createdAt).toLocaleDateString('en-GB')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CUSTOMER:</span>
                    <span className="font-bold">{selectedInvoiceForPrint.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GATEWAY:</span>
                    <span>{selectedInvoiceForPrint.paymentGatewayName}</span>
                  </div>
                </div>

                <div className="border-t border-b border-dashed border-black py-2 space-y-1.5">
                  {selectedInvoiceForPrint.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-start text-[11px]">
                      <div>
                        <div>{it.name}</div>
                        <div className="text-[9px] text-neutral-600">
                          {it.quantity} x Rs. {it.unitPrice.toLocaleString()}
                        </div>
                      </div>
                      <div className="font-bold">
                        Rs. {(it.unitPrice * it.quantity).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-1 text-right text-[11px]">
                  <div className="flex justify-between font-bold text-sm pt-1 border-t border-black">
                    <span>TOTAL PAYABLE:</span>
                    <span>Rs. {selectedInvoiceForPrint.grossTotal.toLocaleString()}</span>
                  </div>
                  <div className="text-[9px] text-neutral-600 flex justify-between">
                    <span>Payment Gateway Fee:</span>
                    <span>{selectedInvoiceForPrint.gatewayFeePercent}% applied</span>
                  </div>
                </div>

                <div className="text-center text-[9px] text-neutral-600 pt-2 border-t border-dashed border-black space-y-1">
                  <div>*** THANK YOU FOR YOUR PURCHASE ***</div>
                  <div>Eligible for manufacturer warranty. Retain invoice for claims.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
