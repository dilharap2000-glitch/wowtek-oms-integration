'use client';

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Barcode,
  Truck,
  ShieldCheck,
  DollarSign,
  Settings,
  ChevronRight,
  Menu,
  X,
  CreditCard,
  Camera,
  KeyRound,
} from 'lucide-react';

import {
  Order,
  Product,
  TransExpressWaybill,
  WarrantyRecord,
  ExpenseItem,
  ApiIntegrationConfig,
  PlatformConfig,
  PaymentGatewayConfig,
  DatabaseHealthStatus,
} from '@/types';

import {
  getOrders,
  saveOrder,
  updateOrder,
  deleteOrder,
  processOrderReturn,
  getProducts,
  saveProduct,
  updateProduct,
  deleteProduct,
  getWaybills,
  saveWaybill,
  updateWaybill,
  getWarranties,
  saveWarranty,
  getExpenses,
  saveExpense,
  getApiConfig,
  saveApiConfig,
  getPlatforms,
  savePlatforms,
  getPaymentGateways,
  savePaymentGateways,
  checkDatabaseHealth,
} from '@/lib/db';

import { DashboardTab } from '@/src/components/DashboardTab';
import { PosTab } from '@/src/components/PosTab';
import { ProductsTab } from '@/src/components/ProductsTab';
import { WaybillsTab } from '@/src/components/WaybillsTab';
import { WarrantyTab } from '@/src/components/WarrantyTab';
import { ExpensesTab } from '@/src/components/ExpensesTab';
import { SettingsTab } from '@/src/components/SettingsTab';
import { IntegrationsTab } from '@/src/components/IntegrationsTab';

export default function WowtekProApp() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Core Data States
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [waybills, setWaybills] = useState<TransExpressWaybill[]>([]);
  const [warranties, setWarranties] = useState<WarrantyRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [platforms, setPlatforms] = useState<PlatformConfig[]>([]);
  const [gateways, setGateways] = useState<PaymentGatewayConfig[]>([]);
  const [apiConfig, setApiConfig] = useState<ApiIntegrationConfig | null>(null);

  const [dbHealth, setDbHealth] = useState<{
    status: 'connected' | 'fallback';
    latencyMs: number;
    database: string;
  }>({
    status: 'fallback',
    latencyMs: 12,
    database: 'Mock In-Memory DB (Safe Fallback)',
  });

  // Load initial data through safe fallback accessors
  useEffect(() => {
    async function initData() {
      try {
        const [
          loadedOrders,
          loadedProducts,
          loadedWaybills,
          loadedWarranties,
          loadedExpenses,
          loadedPlatforms,
          loadedGateways,
          loadedConfig,
          health,
        ] = await Promise.all([
          getOrders(),
          getProducts(),
          getWaybills(),
          getWarranties(),
          getExpenses(),
          getPlatforms(),
          getPaymentGateways(),
          getApiConfig(),
          checkDatabaseHealth(),
        ]);

        setOrders(loadedOrders);
        setProducts(loadedProducts);
        setWaybills(loadedWaybills);
        setWarranties(loadedWarranties);
        setExpenses(loadedExpenses);
        setPlatforms(loadedPlatforms);
        setGateways(loadedGateways);
        setApiConfig(loadedConfig);
        setDbHealth({
          status: health.status,
          latencyMs: health.latencyMs,
          database: health.database,
        });
      } catch {
        // Safe fallback guaranteed
      }
    }

    initData();
  }, []);

  // Handlers for Orders & POS Invoicing
  const handleCreateOrder = async (newOrder: Order) => {
    setOrders((prev) => [newOrder, ...prev]);
    await saveOrder(newOrder);

    // Refresh products to reflect stock decrement
    const updatedProducts = await getProducts();
    setProducts(updatedProducts);

    // Auto-create Trans Express Waybill if website order
    if (newOrder.channel === 'woocommerce') {
      const trackingNumber = `TX-CMB-${Math.floor(10000 + Math.random() * 90000)}`;
      const newWaybill: TransExpressWaybill = {
        id: `wb-${Date.now().toString().slice(-4)}`,
        orderId: newOrder.id,
        trackingNumber,
        recipientName: newOrder.customerName,
        recipientPhone: newOrder.customerPhone,
        destination: `${newOrder.deliveryAddress}, ${newOrder.city}`,
        district: 'Colombo',
        codAmount: newOrder.paymentGateway === 'cash_cod' ? newOrder.grossTotal : 0,
        weightKg: 1.2,
        status: 'Queued',
        bookingDate: `${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString(
          [],
          { hour: '2-digit', minute: '2-digit' }
        )}`,
        courierNotes: `Auto-manifested from WooCommerce. ${newOrder.paymentGatewayName}`,
        labelPrinted: false,
      };

      setWaybills((prev) => [newWaybill, ...prev]);
      await saveWaybill(newWaybill);
    }
  };

  const handleUpdateOrder = async (id: string, updates: Partial<Order>) => {
    const updated = await updateOrder(id, updates);
    if (updated) {
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)));
    }
  };

  const handleDeleteOrder = async (id: string) => {
    await deleteOrder(id);
    setOrders((prev) => prev.filter((o) => o.id !== id));
  };

  // Process Return & Automatically Restore Stock
  const handleProcessReturn = async (orderId: string, itemSkus?: string[], reason?: string) => {
    const result = await processOrderReturn(orderId, itemSkus, reason);
    if (result.success && result.order) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? result.order! : o)));
      // Refresh products to reflect restored stock
      const refreshedProds = await getProducts();
      setProducts(refreshedProds);
    }
  };

  // Handlers for Products
  const handleAddProduct = async (product: Product) => {
    setProducts((prev) => [product, ...prev]);
    await saveProduct(product);
  };

  const handleUpdateProduct = async (id: string, updates: Partial<Product>) => {
    const updated = await updateProduct(id, updates);
    if (updated) {
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    }
  };

  const handleDeleteProduct = async (id: string) => {
    await deleteProduct(id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  // Handlers for Logistics & Waybills
  const handleUpdateWaybillStatus = async (
    id: string,
    status: TransExpressWaybill['status']
  ) => {
    setWaybills((prev) => prev.map((w) => (w.id === id ? { ...w, status } : w)));
    await updateWaybill(id, { status });
  };

  const handleMarkLabelPrinted = async (id: string) => {
    setWaybills((prev) => prev.map((w) => (w.id === id ? { ...w, labelPrinted: true } : w)));
    await updateWaybill(id, { labelPrinted: true });
  };

  // Handlers for Warranty & SMS
  const handleAddWarranty = async (record: WarrantyRecord) => {
    setWarranties((prev) => [record, ...prev]);
    await saveWarranty(record);
  };

  const handleDispatchSms = (id: string, gateway: 'SMSlenz' | 'Dialog' | 'Mobitel') => {
    const timeStr = `${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString(
      [],
      { hour: '2-digit', minute: '2-digit' }
    )}`;
    setWarranties((prev) =>
      prev.map((w) =>
        w.id === id
          ? { ...w, smsStatus: 'Sent', smsGateway: gateway, lastSmsDate: timeStr }
          : w
      )
    );
  };

  // Expenses
  const handleAddExpense = async (expense: ExpenseItem) => {
    setExpenses((prev) => [expense, ...prev]);
    await saveExpense(expense);
  };

  // Settings: Dynamic Platform & Gateway Fees
  const handleSavePlatforms = async (newPlatforms: PlatformConfig[]) => {
    setPlatforms(newPlatforms);
    await savePlatforms(newPlatforms);
  };

  const handleSaveGateways = async (newGateways: PaymentGatewayConfig[]) => {
    setGateways(newGateways);
    await savePaymentGateways(newGateways);
  };

  const handleSaveApiConfig = async (newConfig: ApiIntegrationConfig) => {
    setApiConfig(newConfig);
    await saveApiConfig(newConfig);
  };

  // Nav menu
  const navItems = [
    { id: 'dashboard', label: 'Sales & Analytics', icon: LayoutDashboard },
    {
      id: 'pos',
      label: 'POS & Invoices',
      icon: ShoppingCart,
      badge: orders.length,
    },
    { id: 'products', label: 'Inventory & Valuation', icon: Barcode },
    {
      id: 'waybills',
      label: 'Trans Express Logistics',
      icon: Truck,
      badge: waybills.filter((w) => w.status === 'Queued').length || undefined,
    },
    { id: 'warranty', label: 'Warranty & SMSlenz', icon: ShieldCheck },
    { id: 'expenses', label: 'Financials Ledger', icon: DollarSign },
    { id: 'integrations', label: 'API & Courier Integrations', icon: KeyRound },
    { id: 'settings', label: 'Dynamic Fee Engine', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col antialiased">
      {/* Top Bar Contract: 3 zones */}
      <header className="h-16 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 flex items-center justify-between">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 lg:hidden"
            aria-label="Toggle navigation"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-700 to-indigo-500 flex items-center justify-center font-bold text-white shadow-md shadow-purple-900/40">
              W
            </span>
            <span className="text-base font-bold tracking-tight text-white">WOWTEK Pro</span>
          </div>

          <span className="hidden sm:inline-block text-neutral-700">|</span>
          <span className="hidden sm:inline-block text-xs text-neutral-400 font-mono">
            Order Management & POS Automation
          </span>
        </div>

        {/* Zone 2: Navigation Breadcrumb */}
        <div className="hidden md:flex items-center gap-2 text-xs text-neutral-400">
          <span>Enterprise</span>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-600" />
          <span className="text-white font-medium capitalize">
            {navItems.find((n) => n.id === activeTab)?.label}
          </span>
        </div>

        {/* Zone 3: Database & Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                dbHealth.status === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span className="font-mono text-neutral-300">
              {dbHealth.status === 'connected' ? 'Atlas Connected' : 'Mock DB Fallback'}
            </span>
          </div>

          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-white">Colombo Hub</div>
            <div className="text-[10px] text-neutral-400 font-mono">LKR Sri Lanka</div>
          </div>
        </div>
      </header>

      {/* Main Layout Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Nav */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 bg-neutral-950 border-r border-neutral-800 p-4 transition-transform duration-200 lg:static lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } flex flex-col justify-between`}
        >
          <div className="space-y-1">
            <div className="px-3 py-2 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
              Management Modules
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                        isActive ? 'bg-purple-700 text-white' : 'bg-neutral-800 text-neutral-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Rates Banner */}
          <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-xs space-y-1">
            <div className="flex items-center justify-between text-neutral-400 text-[10px]">
              <span className="font-semibold text-neutral-300">ACTIVE FEE RATES</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
            <div className="text-[11px] text-neutral-300 font-mono">
              PickMe: {platforms.find((p) => p.code === 'pickme')?.feePercent ?? 20}% · Uber: {platforms.find((p) => p.code === 'ubereats')?.feePercent ?? 15.4}%
            </div>
            <div className="text-[10px] text-neutral-400 font-mono">
              Payzy/Koko/Mintpay: 12% · Cash: 0%
            </div>
          </div>
        </aside>

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'dashboard' && (
              <DashboardTab
                orders={orders}
                waybills={waybills}
                warranties={warranties}
                expenses={expenses}
                dbStatus={dbHealth}
                onNavigateTab={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === 'pos' && (
              <PosTab
                products={products}
                orders={orders}
                platforms={platforms}
                gateways={gateways}
                onCreateOrder={handleCreateOrder}
                onUpdateOrder={handleUpdateOrder}
                onDeleteOrder={handleDeleteOrder}
                onProcessReturn={handleProcessReturn}
              />
            )}

            {activeTab === 'products' && (
              <ProductsTab
                products={products}
                onAddProduct={handleAddProduct}
                onUpdateProduct={handleUpdateProduct}
                onDeleteProduct={handleDeleteProduct}
              />
            )}

            {activeTab === 'waybills' && (
              <WaybillsTab
                waybills={waybills}
                onUpdateWaybillStatus={handleUpdateWaybillStatus}
                onMarkLabelPrinted={handleMarkLabelPrinted}
              />
            )}

            {activeTab === 'warranty' && (
              <WarrantyTab
                warranties={warranties}
                products={products}
                onAddWarranty={handleAddWarranty}
                onDispatchSms={handleDispatchSms}
              />
            )}

            {activeTab === 'expenses' && (
              <ExpensesTab expenses={expenses} orders={orders} onAddExpense={handleAddExpense} />
            )}

            {activeTab === 'integrations' && apiConfig && (
              <IntegrationsTab apiConfig={apiConfig} onSaveConfig={handleSaveApiConfig} />
            )}

            {activeTab === 'settings' && (
              <SettingsTab
                platforms={platforms}
                gateways={gateways}
                onSavePlatforms={handleSavePlatforms}
                onSaveGateways={handleSaveGateways}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
