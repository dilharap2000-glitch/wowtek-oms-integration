'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  MessageSquare,
  Send,
  Search,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle2,
  X,
  Phone,
  Calendar,
  Truck,
  Building2,
  Layers,
  ArrowRight,
  Edit,
  Trash2,
  ExternalLink,
  Check,
  AlertCircle,
  Tag,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { WarrantyRecord, Product, Supplier, SupplierRmaClaim, SupplierRmaStatus } from '@/types';

interface WarrantyTabProps {
  warranties: WarrantyRecord[];
  products: Product[];
  suppliers?: Supplier[];
  rmaClaims?: SupplierRmaClaim[];
  onAddWarranty: (record: WarrantyRecord) => void;
  onUpdateWarranty?: (id: string, updates: Partial<WarrantyRecord>) => void;
  onDispatchSms: (id: string, gateway: 'SMSlenz' | 'Dialog' | 'Mobitel') => void;
  onAddRmaClaim?: (claim: SupplierRmaClaim) => void;
  onUpdateRmaClaim?: (id: string, updates: Partial<SupplierRmaClaim>) => void;
  onDeleteRmaClaim?: (id: string) => void;
}

export const WarrantyTab: React.FC<WarrantyTabProps> = ({
  warranties,
  products,
  suppliers = [],
  rmaClaims = [],
  onAddWarranty,
  onUpdateWarranty,
  onDispatchSms,
  onAddRmaClaim,
  onUpdateRmaClaim,
  onDeleteRmaClaim,
}) => {
  // Active Sub-Tab
  const [activeSubTab, setActiveSubTab] = useState<'customer' | 'rma'>('customer');

  // Customer Warranty Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [smsTestModalRecord, setSmsTestModalRecord] = useState<WarrantyRecord | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<'SMSlenz' | 'Dialog' | 'Mobitel'>('SMSlenz');
  const [notificationMsg, setNotificationMsg] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  // New Customer Warranty Form State
  const [serialNumber, setSerialNumber] = useState('');
  const [selectedSku, setSelectedSku] = useState(products[0]?.sku || '');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+94 77 ');
  const [warrantyMonths, setWarrantyMonths] = useState(24);
  const [supplierName, setSupplierName] = useState(suppliers[0]?.name || 'Chama Computers (Pvt) Ltd');

  // Supplier RMA Return Tracker States
  const [rmaSearchQuery, setRmaSearchQuery] = useState('');
  const [rmaStatusFilter, setRmaStatusFilter] = useState<string>('all');
  const [rmaSupplierFilter, setRmaSupplierFilter] = useState<string>('all');
  const [showRmaModal, setShowRmaModal] = useState(false);
  const [selectedWarrantyForRma, setSelectedWarrantyForRma] = useState<WarrantyRecord | null>(null);
  const [editingRmaClaim, setEditingRmaClaim] = useState<SupplierRmaClaim | null>(null);
  const [viewingRmaClaim, setViewingRmaClaim] = useState<SupplierRmaClaim | null>(null);

  // RMA Form Inputs
  const [rmaSupplierId, setRmaSupplierId] = useState(suppliers[0]?.id || '');
  const [rmaSupplierName, setRmaSupplierName] = useState(suppliers[0]?.name || 'Chama Computers (Pvt) Ltd');
  const [rmaNumber, setRmaNumber] = useState('');
  const [rmaDateSent, setRmaDateSent] = useState(new Date().toISOString().split('T')[0]);
  const [rmaStatus, setRmaStatus] = useState<SupplierRmaStatus>('Pending with Supplier');
  const [rmaExpectedReturnDate, setRmaExpectedReturnDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [rmaSerial, setRmaSerial] = useState('');
  const [rmaProductSku, setRmaProductSku] = useState('');
  const [rmaProductName, setRmaProductName] = useState('');
  const [rmaCustomerName, setRmaCustomerName] = useState('');
  const [rmaCustomerPhone, setRmaCustomerPhone] = useState('');
  const [rmaIssueDesc, setRmaIssueDesc] = useState('');
  const [rmaNotes, setRmaNotes] = useState('');
  const [rmaReplacementSerial, setRmaReplacementSerial] = useState('');
  const [rmaActualReturnDate, setRmaActualReturnDate] = useState('');

  // Auto notification clear helper
  const showNotification = (text: string, type: 'success' | 'info' = 'success') => {
    setNotificationMsg({ text, type });
    setTimeout(() => setNotificationMsg(null), 4500);
  };

  // Helper to generate a realistic RMA Reference Number
  const generateRmaNumber = (supName: string) => {
    const prefix = supName
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 4) || 'SUP';
    const num = Math.floor(100 + Math.random() * 900);
    return `RMA-${prefix}-2026-${num}`;
  };

  // Safe array bindings
  const safeWarranties = warranties || [];
  const safeProducts = products || [];
  const safeSuppliers = suppliers || [];
  const safeRmaClaims = rmaClaims || [];

  // ---------------------------------------------------------------------------
  // Customer Warranty Registration & SMS
  // ---------------------------------------------------------------------------
  const filteredWarranties = safeWarranties.filter((w) => {
    if (!w) return false;
    const matchesStatus = statusFilter === 'all' || w.status === statusFilter;
    const matchesSearch =
      (w.serialNumber || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (w.customerName || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (w.productName || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (w.customerPhone || '').includes(searchQuery || '') ||
      (w.supplierName || '').toLowerCase().includes((searchQuery || '').toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleRegisterWarranty = (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find((p) => p.sku === selectedSku) || products[0];
    const today = new Date();
    const endDate = new Date(today);
    endDate.setMonth(today.getMonth() + warrantyMonths);

    const supEndDate = new Date(endDate);
    supEndDate.setMonth(endDate.getMonth() + 1); // Supplier warranty usually +1 month buffer

    const matchedSupplier = suppliers.find((s) => s.name === supplierName);

    const newRec: WarrantyRecord = {
      id: `war-${Date.now().toString().slice(-4)}`,
      serialNumber: serialNumber || `SN-${Math.floor(100000 + Math.random() * 900000)}`,
      productSku: product?.sku || selectedSku || 'WT-CUSTOM',
      productName: product?.name || 'Computer Component',
      customerName,
      customerPhone,
      customerWarrantyStart: today.toISOString().split('T')[0],
      customerWarrantyMonths: warrantyMonths,
      customerWarrantyEnd: endDate.toISOString().split('T')[0],
      supplierName: supplierName || matchedSupplier?.name || product?.supplier || 'Authorized Supplier',
      supplierWarrantyEnd: supEndDate.toISOString().split('T')[0],
      smsStatus: 'Sent',
      smsGateway: selectedGateway,
      lastSmsDate: `${today.toLocaleDateString('en-GB')} ${today.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      status: 'Active',
    };

    onAddWarranty(newRec);
    setShowAddModal(false);
    setSerialNumber('');
    setCustomerName('');

    // Trigger SMSlenz Automated SMS API Dispatch
    try {
      fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact: newRec.customerPhone,
          message: `WOWTEK PRO: Warranty registered for ${newRec.productName} (S/N: ${newRec.serialNumber}). Valid until ${newRec.customerWarrantyEnd}. Customer Care: 011 258 9000.`,
          triggerType: 'warranty_registered',
          referenceId: newRec.serialNumber,
        }),
      }).catch(() => {});
    } catch {
      // Graceful fallback
    }

    showNotification(`Warranty registered & automated SMS dispatched to ${newRec.customerPhone}`);
  };

  const handleManualSmsDispatch = (record: WarrantyRecord) => {
    onDispatchSms(record.id, selectedGateway);
    setSmsTestModalRecord(null);

    // Trigger SMSlenz Automated 30-Day Expiry Reminder
    try {
      fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact: record.customerPhone,
          message: `WOWTEK PRO Reminder: Your warranty for ${record.productName} (S/N: ${record.serialNumber}) expires on ${record.customerWarrantyEnd}. Contact support for renewal/service.`,
          triggerType: 'warranty_expiry',
          referenceId: record.serialNumber,
        }),
      }).catch(() => {});
    } catch {
      // Graceful fallback
    }

    showNotification(`Expiry SMS reminder dispatched to ${record.customerPhone} via ${selectedGateway}`);
  };

  // ---------------------------------------------------------------------------
  // Supplier RMA Return Actions
  // ---------------------------------------------------------------------------

  // Open "Send to Supplier for Warranty/Repair" modal pre-filled with customer warranty item
  const handleOpenSendToSupplier = (w: WarrantyRecord) => {
    setSelectedWarrantyForRma(w);

    // Find best supplier match
    const matchingSupplier =
      suppliers.find((s) => s.name.toLowerCase().trim() === w.supplierName?.toLowerCase().trim()) ||
      suppliers[0];

    const supId = matchingSupplier?.id || (suppliers[0]?.id ?? 'sup-001');
    const supName = matchingSupplier?.name || w.supplierName || 'Authorized Distributor';

    setRmaSupplierId(supId);
    setRmaSupplierName(supName);
    setRmaNumber(generateRmaNumber(supName));
    setRmaDateSent(new Date().toISOString().split('T')[0]);
    setRmaStatus('Pending with Supplier');

    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + 14);
    setRmaExpectedReturnDate(expectedDate.toISOString().split('T')[0]);

    setRmaSerial(w.serialNumber);
    setRmaProductSku(w.productSku);
    setRmaProductName(w.productName);
    setRmaCustomerName(w.customerName);
    setRmaCustomerPhone(w.customerPhone);
    setRmaIssueDesc('');
    setRmaNotes(`Customer warranty serial ${w.serialNumber}. Sent for warranty inspection/repair.`);
    setRmaReplacementSerial('');
    setRmaActualReturnDate('');

    setShowRmaModal(true);
  };

  // Open "New Supplier RMA Claim" modal (standalone)
  const handleOpenNewRma = () => {
    setSelectedWarrantyForRma(null);
    const initialSup = suppliers[0];
    const supId = initialSup?.id || 'sup-001';
    const supName = initialSup?.name || 'Chama Computers (Pvt) Ltd';

    setRmaSupplierId(supId);
    setRmaSupplierName(supName);
    setRmaNumber(generateRmaNumber(supName));
    setRmaDateSent(new Date().toISOString().split('T')[0]);
    setRmaStatus('Pending with Supplier');

    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + 14);
    setRmaExpectedReturnDate(expectedDate.toISOString().split('T')[0]);

    setRmaSerial('');
    setRmaProductSku(products[0]?.sku || 'WT-PROD-001');
    setRmaProductName(products[0]?.name || 'Select Product');
    setRmaCustomerName('');
    setRmaCustomerPhone('+94 77 ');
    setRmaIssueDesc('');
    setRmaNotes('');
    setRmaReplacementSerial('');
    setRmaActualReturnDate('');

    setShowRmaModal(true);
  };

  // Submit RMA Claim
  const handleSubmitRmaClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddRmaClaim) return;

    const newClaim: SupplierRmaClaim = {
      id: `rma-${Date.now().toString().slice(-4)}`,
      warrantyId: selectedWarrantyForRma?.id,
      serialNumber: rmaSerial.trim(),
      productSku: rmaProductSku.trim(),
      productName: rmaProductName.trim(),
      customerName: rmaCustomerName.trim(),
      customerPhone: rmaCustomerPhone.trim(),
      supplierId: rmaSupplierId,
      supplierName: rmaSupplierName,
      rmaNumber: rmaNumber.trim(),
      dateSent: rmaDateSent,
      status: rmaStatus,
      expectedReturnDate: rmaExpectedReturnDate,
      issueDescription: rmaIssueDesc.trim(),
      notes: rmaNotes.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onAddRmaClaim(newClaim);

    // If linked to a customer warranty record, update its status to 'Claim In Progress'
    if (selectedWarrantyForRma && onUpdateWarranty) {
      onUpdateWarranty(selectedWarrantyForRma.id, {
        status: 'Claim In Progress',
      });
    }

    setShowRmaModal(false);
    showNotification(
      `Item S/N ${newClaim.serialNumber} marked as "Sent to Supplier"! RMA Ref: ${newClaim.rmaNumber}`
    );
    setActiveSubTab('rma');
  };

  // Open Edit Status Modal for existing claim
  const handleOpenEditRmaStatus = (claim: SupplierRmaClaim) => {
    setEditingRmaClaim(claim);
    setRmaStatus(claim.status);
    setRmaReplacementSerial(claim.replacementSerial || '');
    setRmaActualReturnDate(claim.actualReturnDate || new Date().toISOString().split('T')[0]);
    setRmaNotes(claim.notes || '');
  };

  // Save Status Update
  const handleSaveRmaStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRmaClaim || !onUpdateRmaClaim) return;

    const updates: Partial<SupplierRmaClaim> = {
      status: rmaStatus,
      notes: rmaNotes.trim(),
      updatedAt: new Date().toISOString(),
    };

    if (rmaStatus === 'Replaced') {
      updates.replacementSerial = rmaReplacementSerial.trim();
    }
    if (rmaStatus === 'Repaired' || rmaStatus === 'Replaced' || rmaStatus === 'Rejected/Returned') {
      updates.actualReturnDate = rmaActualReturnDate || new Date().toISOString().split('T')[0];
    }

    onUpdateRmaClaim(editingRmaClaim.id, updates);
    setEditingRmaClaim(null);
    showNotification(`RMA ${editingRmaClaim.rmaNumber} status updated to "${rmaStatus}"`);
  };

  // ---------------------------------------------------------------------------
  // RMA Metrics & Filtering
  // ---------------------------------------------------------------------------
  const todayStr = new Date().toISOString().split('T')[0];
  const totalRma = safeRmaClaims.length;
  const pendingRmaCount = safeRmaClaims.filter((r) => r?.status === 'Pending with Supplier').length;
  const repairedRmaCount = safeRmaClaims.filter((r) => r?.status === 'Repaired').length;
  const replacedRmaCount = safeRmaClaims.filter((r) => r?.status === 'Replaced').length;
  const rejectedRmaCount = safeRmaClaims.filter((r) => r?.status === 'Rejected/Returned').length;
  const overdueRmaCount = safeRmaClaims.filter(
    (r) => r?.status === 'Pending with Supplier' && r.expectedReturnDate && r.expectedReturnDate < todayStr
  ).length;

  const filteredRmaClaims = safeRmaClaims.filter((claim) => {
    if (!claim) return false;
    const query = (rmaSearchQuery || '').toLowerCase();
    const matchesSearch =
      (claim.rmaNumber || '').toLowerCase().includes(query) ||
      (claim.serialNumber || '').toLowerCase().includes(query) ||
      (claim.productName || '').toLowerCase().includes(query) ||
      (claim.productSku || '').toLowerCase().includes(query) ||
      (claim.supplierName || '').toLowerCase().includes(query) ||
      (claim.customerName || '').toLowerCase().includes(query) ||
      (claim.customerPhone || '').includes(query);

    let matchesStatus = true;
    if (rmaStatusFilter === 'Overdue') {
      matchesStatus =
        claim.status === 'Pending with Supplier' &&
        Boolean(claim.expectedReturnDate && claim.expectedReturnDate < todayStr);
    } else if (rmaStatusFilter !== 'all') {
      matchesStatus = claim.status === rmaStatusFilter;
    }

    const matchesSupplier =
      rmaSupplierFilter === 'all' ||
      claim.supplierId === rmaSupplierFilter ||
      (claim.supplierName || '').toLowerCase() === (rmaSupplierFilter || '').toLowerCase();

    return matchesSearch && matchesStatus && matchesSupplier;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-400" />
              Warranty Management & Supplier RMA
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-purple-950 text-purple-300 border border-purple-800/80">
              Dual Lifecycle
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            End-to-end customer warranty certificates, automated SMSlenz gateways, and distributor RMA return tracker.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {activeSubTab === 'customer' ? (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Register New Serial & SMS</span>
            </button>
          ) : (
            <button
              onClick={handleOpenNewRma}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-colors shadow-sm"
            >
              <Truck className="w-4 h-4" />
              <span>New Supplier RMA Claim</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-neutral-900 border border-neutral-800 w-full sm:w-fit">
        <button
          onClick={() => setActiveSubTab('customer')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'customer'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Customer Warranties & SMS Alerts</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeSubTab === 'customer' ? 'bg-purple-700 text-white' : 'bg-neutral-800 text-neutral-400'
            }`}
          >
            {warranties.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('rma')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'rma'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Supplier Warranty Claims (RMA)</span>
          {pendingRmaCount > 0 ? (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-amber-500 text-neutral-950 font-bold">
              {pendingRmaCount} Active
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-neutral-800 text-neutral-400">
              {rmaClaims.length}
            </span>
          )}
        </button>
      </div>

      {/* Real-time Notification Banner */}
      {notificationMsg && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-xs rounded-xl flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{notificationMsg.text}</span>
          </div>
          <button onClick={() => setNotificationMsg(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 1: CUSTOMER WARRANTIES & SMS GATEWAY                             */}
      {/* ========================================================================= */}
      {activeSubTab === 'customer' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between p-3 rounded-xl bg-neutral-900 border border-neutral-800">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto">
              {['all', 'Active', 'Claim In Progress', 'Expiring Soon', 'Expired'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-purple-600 text-white'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                  }`}
                >
                  {st === 'all' ? 'All Warranties' : st}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Serial No, customer, SKU, distributor..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Warranties Table */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-950/60 text-neutral-400">
                    <th className="py-3 px-4 font-medium">Serial No & Item</th>
                    <th className="py-3 px-4 font-medium">Customer Details</th>
                    <th className="py-3 px-4 font-medium">Customer Warranty</th>
                    <th className="py-3 px-4 font-medium">Supplier & Distributor</th>
                    <th className="py-3 px-4 font-medium">Warranty Status</th>
                    <th className="py-3 px-4 font-medium">SMS Dispatch Log</th>
                    <th className="py-3 px-4 font-medium text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/80">
                  {filteredWarranties.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                          <ShieldCheck className="w-10 h-10 text-neutral-600 mb-1" />
                          <p className="font-semibold text-white text-sm">No Active Warranties</p>
                          <p className="text-xs text-neutral-400">
                            No warranty records match your filter. Register serial numbers to track customer/supplier warranties and auto-dispatch SMS alerts.
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowAddModal(true)}
                            className="mt-2 flex items-center gap-2 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Register First Serial</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredWarranties.map((w) => (
                      <tr key={w.id} className="hover:bg-neutral-850/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-white flex items-center gap-1.5">
                            <span>{w.serialNumber}</span>
                          </div>
                          <div className="text-[11px] text-neutral-300 mt-0.5 line-clamp-1">{w.productName}</div>
                          <div className="text-[10px] font-mono text-purple-400">{w.productSku}</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-medium text-white">{w.customerName}</div>
                          <div className="text-neutral-400 font-mono text-[11px]">{w.customerPhone}</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="text-neutral-200">
                            Duration: <strong className="text-white">{w.customerWarrantyMonths} Months</strong>
                          </div>
                          <div className="text-[11px] text-neutral-400">
                            Expires: <span className="font-mono text-white">{w.customerWarrantyEnd}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="text-white font-medium flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-purple-400 flex-shrink-0" />
                            <span className="truncate max-w-[150px]">{w.supplierName}</span>
                          </div>
                          <div className="text-[11px] text-neutral-400 mt-0.5">
                            Supplier End: <span className="font-mono text-neutral-300">{w.supplierWarrantyEnd}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${
                              w.status === 'Active'
                                ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800'
                                : w.status === 'Claim In Progress'
                                ? 'bg-purple-950/70 text-purple-300 border-purple-800'
                                : w.status === 'Expiring Soon'
                                ? 'bg-amber-950/70 text-amber-300 border-amber-800'
                                : 'bg-red-950/70 text-red-400 border-red-800'
                            }`}
                          >
                            {w.status}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-neutral-300">
                            <span className="font-mono font-semibold text-purple-300">{w.smsGateway}</span>
                            <span>·</span>
                            <span className="text-[11px]">{w.smsStatus}</span>
                          </div>
                          <div className="text-[10px] text-neutral-400 mt-0.5 font-mono">
                            {w.lastSmsDate || 'Auto trigger set'}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* MARK AS SENT TO SUPPLIER (RMA) BUTTON */}
                            <button
                              onClick={() => handleOpenSendToSupplier(w)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-purple-950/60 hover:bg-purple-900/80 border border-purple-700/60 text-purple-200 hover:text-white rounded-lg text-xs font-semibold transition-colors"
                              title="Send Item to Supplier for Warranty / Repair (RMA)"
                            >
                              <Truck className="w-3.5 h-3.5 text-purple-400" />
                              <span className="hidden xl:inline">Send to Supplier</span>
                              <span className="xl:hidden">RMA</span>
                            </button>

                            {/* SMS Gateway Trigger Button */}
                            <button
                              onClick={() => setSmsTestModalRecord(w)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-lg text-xs font-medium transition-colors"
                              title="Send Instant SMS via Gateway"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                              <span className="hidden lg:inline">SMS</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: SUPPLIER WARRANTY CLAIMS (RMA RETURN TRACKER)                  */}
      {/* ========================================================================= */}
      {activeSubTab === 'rma' && (
        <div className="space-y-5">
          {/* RMA Summary Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="p-4 rounded-xl bg-neutral-900/90 border border-neutral-800">
              <div className="flex items-center justify-between text-neutral-400 mb-1">
                <span className="text-[11px] font-medium">Pending with Supplier</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-400 font-mono">{pendingRmaCount}</div>
              <div className="text-[10px] text-neutral-400 mt-0.5">Currently at vendor service</div>
            </div>

            <div className="p-4 rounded-xl bg-neutral-900/90 border border-neutral-800">
              <div className="flex items-center justify-between text-neutral-400 mb-1">
                <span className="text-[11px] font-medium">Repaired & Tested</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 font-mono">{repairedRmaCount}</div>
              <div className="text-[10px] text-neutral-400 mt-0.5">Ready for customer delivery</div>
            </div>

            <div className="p-4 rounded-xl bg-neutral-900/90 border border-neutral-800">
              <div className="flex items-center justify-between text-neutral-400 mb-1">
                <span className="text-[11px] font-medium">Replaced Units</span>
                <RefreshCw className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-blue-400 font-mono">{replacedRmaCount}</div>
              <div className="text-[10px] text-neutral-400 mt-0.5">Brand new unit received</div>
            </div>

            <div className="p-4 rounded-xl bg-neutral-900/90 border border-neutral-800">
              <div className="flex items-center justify-between text-neutral-400 mb-1">
                <span className="text-[11px] font-medium">Rejected / Returned</span>
                <AlertCircle className="w-4 h-4 text-red-400" />
              </div>
              <div className="text-2xl font-bold text-red-400 font-mono">{rejectedRmaCount}</div>
              <div className="text-[10px] text-neutral-400 mt-0.5">Warranty void / customer abuse</div>
            </div>

            <div className="p-4 rounded-xl bg-neutral-900/90 border border-neutral-800 col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between text-neutral-400 mb-1">
                <span className="text-[11px] font-medium">Overdue Returns</span>
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </div>
              <div className={`text-2xl font-bold font-mono ${overdueRmaCount > 0 ? 'text-red-400' : 'text-neutral-400'}`}>
                {overdueRmaCount}
              </div>
              <div className="text-[10px] text-neutral-400 mt-0.5">Exceeded expected ETA</div>
            </div>
          </div>

          {/* Filter & Search Toolbar */}
          <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto">
              {['all', 'Pending with Supplier', 'Repaired', 'Replaced', 'Rejected/Returned', 'Overdue'].map((st) => (
                <button
                  key={st}
                  onClick={() => setRmaStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    rmaStatusFilter === st
                      ? 'bg-purple-600 text-white'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                  }`}
                >
                  {st === 'all' ? 'All RMA Claims' : st}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={rmaSupplierFilter}
                onChange={(e) => setRmaSupplierFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="all">All Suppliers ({suppliers.length})</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={rmaSearchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search RMA No, S/N, supplier..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Dashboard Table: Items Currently with Suppliers */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-950/60 text-neutral-400">
                    <th className="py-3 px-4 font-medium">RMA Ref & Date Sent</th>
                    <th className="py-3 px-4 font-medium">Defective Item & S/N</th>
                    <th className="py-3 px-4 font-medium">Selected Supplier</th>
                    <th className="py-3 px-4 font-medium">Customer Details</th>
                    <th className="py-3 px-4 font-medium">Current Status</th>
                    <th className="py-3 px-4 font-medium">Expected Return Date</th>
                    <th className="py-3 px-4 font-medium text-center">Manage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/80">
                  {filteredRmaClaims.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                          <Truck className="w-10 h-10 text-neutral-600 mb-1" />
                          <p className="font-semibold text-white text-sm">No Supplier RMA Claims</p>
                          <p className="text-xs text-neutral-400">
                            No items currently recorded as sent to suppliers for warranty/repair. Mark items from the customer warranty list or log a new claim.
                          </p>
                          <button
                            type="button"
                            onClick={handleOpenNewRma}
                            className="mt-2 flex items-center gap-2 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Log Supplier RMA Claim</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRmaClaims.map((claim) => {
                      // Determine overdue status
                      const isPending = claim.status === 'Pending with Supplier';
                      const isOverdue =
                        isPending && claim.expectedReturnDate && claim.expectedReturnDate < todayStr;
                      const isToday =
                        isPending && claim.expectedReturnDate && claim.expectedReturnDate === todayStr;

                      return (
                        <tr key={claim.id} className="hover:bg-neutral-850/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-purple-300">{claim.rmaNumber}</div>
                            <div className="text-[11px] text-neutral-400 mt-0.5 flex items-center gap-1 font-mono">
                              <Calendar className="w-3 h-3 text-neutral-500" />
                              <span>Sent: {claim.dateSent}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-medium text-white max-w-xs truncate">{claim.productName}</div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono">
                              <span className="text-neutral-400">S/N: <strong className="text-white">{claim.serialNumber}</strong></span>
                              <span className="text-purple-400">[{claim.productSku}]</span>
                            </div>
                            {claim.issueDescription && (
                              <div className="text-[10px] text-neutral-400 mt-1 line-clamp-1 italic">
                                &quot;{claim.issueDescription}&quot;
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-medium text-white flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                              <span className="truncate max-w-[170px]">{claim.supplierName}</span>
                            </div>
                            {claim.replacementSerial && (
                              <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                                Replaced S/N: {claim.replacementSerial}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-medium text-white">{claim.customerName || 'In-store Customer'}</div>
                            <div className="text-neutral-400 font-mono text-[11px]">{claim.customerPhone || 'N/A'}</div>
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                                claim.status === 'Pending with Supplier'
                                  ? 'bg-amber-950/70 text-amber-300 border-amber-800'
                                  : claim.status === 'Repaired'
                                  ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800'
                                  : claim.status === 'Replaced'
                                  ? 'bg-blue-950/70 text-blue-400 border-blue-800'
                                  : 'bg-red-950/70 text-red-400 border-red-800'
                              }`}
                            >
                              {claim.status}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-mono text-white text-[11px]">
                              {claim.expectedReturnDate || 'Not specified'}
                            </div>
                            {isOverdue && (
                              <div className="flex items-center gap-1 text-[10px] text-red-400 font-semibold mt-0.5">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Overdue SLA</span>
                              </div>
                            )}
                            {isToday && (
                              <div className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold mt-0.5">
                                <Clock className="w-3 h-3" />
                                <span>Due Today</span>
                              </div>
                            )}
                            {claim.status !== 'Pending with Supplier' && claim.actualReturnDate && (
                              <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                                Returned: {claim.actualReturnDate}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditRmaStatus(claim)}
                                className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                                title="Update Status / Record Replacement"
                              >
                                <Edit className="w-3 h-3 text-purple-400" />
                                <span>Update</span>
                              </button>

                              <button
                                onClick={() => setViewingRmaClaim(claim)}
                                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                                title="View Claim Sheet"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>

                              {onDeleteRmaClaim && (
                                <button
                                  onClick={() => {
                                    if (confirm(`Delete RMA record ${claim.rmaNumber}?`)) {
                                      onDeleteRmaClaim(claim.id);
                                    }
                                  }}
                                  className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors"
                                  title="Delete RMA Claim"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: SEND TO SUPPLIER FOR WARRANTY / REPAIR                           */}
      {/* ========================================================================= */}
      {showRmaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {selectedWarrantyForRma
                      ? 'Mark Item as Sent to Supplier for Warranty/Repair'
                      : 'Create Supplier Warranty Claim (RMA)'}
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Dispatch defective device to distributor & log tracking RMA reference
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRmaModal(false)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRmaClaim} className="p-5 space-y-3.5 text-xs max-h-[80vh] overflow-y-auto">
              {/* Supplier Selection */}
              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Selected Supplier (from Supplier Directory) <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={rmaSupplierId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    setRmaSupplierId(selectedId);
                    const matched = suppliers.find((s) => s.id === selectedId);
                    if (matched) {
                      setRmaSupplierName(matched.name);
                      setRmaNumber(generateRmaNumber(matched.name));
                    }
                  }}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.contactPerson} · {s.paymentTerms})
                    </option>
                  ))}
                </select>
                {suppliers.find((s) => s.id === rmaSupplierId) && (
                  <div className="text-[11px] text-neutral-400 mt-1 flex items-center gap-2">
                    <span>Contact: {suppliers.find((s) => s.id === rmaSupplierId)?.contactPerson}</span>
                    <span>·</span>
                    <span>Phone: {suppliers.find((s) => s.id === rmaSupplierId)?.phone}</span>
                  </div>
                )}
              </div>

              {/* RMA Number & Date Sent */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-neutral-300 font-medium">
                      RMA Reference / Invoice No <span className="text-red-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setRmaNumber(generateRmaNumber(rmaSupplierName))}
                      className="text-[10px] text-purple-400 hover:text-purple-300"
                    >
                      Regenerate
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={rmaNumber}
                    onChange={(e) => setRmaNumber(e.target.value)}
                    placeholder="e.g. RMA-CHAMA-2026-088"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">
                    Date Sent to Supplier <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={rmaDateSent}
                    onChange={(e) => setRmaDateSent(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              {/* Status & Expected Return Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">
                    Current Status <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={rmaStatus}
                    onChange={(e) => setRmaStatus(e.target.value as SupplierRmaStatus)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                  >
                    <option value="Pending with Supplier">Pending with Supplier</option>
                    <option value="Repaired">Repaired</option>
                    <option value="Replaced">Replaced</option>
                    <option value="Rejected/Returned">Rejected/Returned</option>
                  </select>
                </div>
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">
                    Expected Return Date & ETA <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={rmaExpectedReturnDate}
                    onChange={(e) => setRmaExpectedReturnDate(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              {/* Serial & Product Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">
                    Item Serial Number (S/N) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={rmaSerial}
                    onChange={(e) => setRmaSerial(e.target.value)}
                    placeholder="e.g. SN-KNG-99182"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Product SKU</label>
                  <input
                    type="text"
                    required
                    value={rmaProductSku}
                    onChange={(e) => setRmaProductSku(e.target.value)}
                    placeholder="e.g. WT-SSD-1TB-NVME"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={rmaProductName}
                  onChange={(e) => setRmaProductName(e.target.value)}
                  placeholder="e.g. Kingston NV2 1TB PCIe 4.0 NVMe SSD"
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
              </div>

              {/* Customer Details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Customer Full Name</label>
                  <input
                    type="text"
                    required
                    value={rmaCustomerName}
                    onChange={(e) => setRmaCustomerName(e.target.value)}
                    placeholder="e.g. Roshan Wickramasinghe"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Customer Phone</label>
                  <input
                    type="text"
                    required
                    value={rmaCustomerPhone}
                    onChange={(e) => setRmaCustomerPhone(e.target.value)}
                    placeholder="+94 77 123 4567"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              {/* Defect Description */}
              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Issue Description / Defect Complaint
                </label>
                <textarea
                  rows={2}
                  value={rmaIssueDesc}
                  onChange={(e) => setRmaIssueDesc(e.target.value)}
                  placeholder="e.g. Device not powering on / erratic clicks / bad sectors detected in crystaldiskinfo"
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
              </div>

              {/* Service & Courier Notes */}
              <div>
                <label className="block text-neutral-300 font-medium mb-1">Expected Return Date & Notes</label>
                <textarea
                  rows={2}
                  value={rmaNotes}
                  onChange={(e) => setRmaNotes(e.target.value)}
                  placeholder="e.g. Sent via Trans Express tracking TX-99214. Supplier technician Nuwan notified."
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowRmaModal(false)}
                  className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white bg-neutral-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg shadow-sm"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Confirm Dispatch & Save RMA</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: UPDATE RMA STATUS MODAL                                          */}
      {/* ========================================================================= */}
      {editingRmaClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950">
              <div>
                <h3 className="text-sm font-semibold text-white">Update RMA Status: {editingRmaClaim.rmaNumber}</h3>
                <p className="text-[11px] text-neutral-400 font-mono">
                  {editingRmaClaim.productName} (S/N: {editingRmaClaim.serialNumber})
                </p>
              </div>
              <button
                onClick={() => setEditingRmaClaim(null)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRmaStatus} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-neutral-300 font-medium mb-1">Current Claim Status</label>
                <select
                  value={rmaStatus}
                  onChange={(e) => setRmaStatus(e.target.value as SupplierRmaStatus)}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                >
                  <option value="Pending with Supplier">Pending with Supplier</option>
                  <option value="Repaired">Repaired</option>
                  <option value="Replaced">Replaced</option>
                  <option value="Rejected/Returned">Rejected/Returned</option>
                </select>
              </div>

              {rmaStatus === 'Replaced' && (
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">
                    New Replacement Unit Serial Number (S/N)
                  </label>
                  <input
                    type="text"
                    required
                    value={rmaReplacementSerial}
                    onChange={(e) => setRmaReplacementSerial(e.target.value)}
                    placeholder="e.g. SN-REPL-2026-90412"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
              )}

              {rmaStatus !== 'Pending with Supplier' && (
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">
                    Actual Date Received from Supplier
                  </label>
                  <input
                    type="date"
                    value={rmaActualReturnDate}
                    onChange={(e) => setRmaActualReturnDate(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Supplier Resolution Notes & Inspection Result
                </label>
                <textarea
                  rows={3}
                  value={rmaNotes}
                  onChange={(e) => setRmaNotes(e.target.value)}
                  placeholder="e.g. Main IC component replaced, burned capacitors serviced by Nuwan. Unit passed stress test."
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setEditingRmaClaim(null)}
                  className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white bg-neutral-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg shadow-sm"
                >
                  Save Status Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: VIEW RMA CLAIM SHEET DETAILS                                     */}
      {/* ========================================================================= */}
      {viewingRmaClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">
                  RMA Claim Sheet: {viewingRmaClaim.rmaNumber}
                </h3>
              </div>
              <button
                onClick={() => setViewingRmaClaim(null)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                <div>
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Status</span>
                  <div className="font-semibold text-white mt-0.5">{viewingRmaClaim.status}</div>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Date Sent</span>
                  <div className="font-mono text-white mt-0.5">{viewingRmaClaim.dateSent}</div>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Expected Return Date</span>
                  <div className="font-mono text-purple-300 mt-0.5">{viewingRmaClaim.expectedReturnDate}</div>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Actual Return Date</span>
                  <div className="font-mono text-neutral-300 mt-0.5">
                    {viewingRmaClaim.actualReturnDate || 'Pending'}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-1">Equipment Details</h4>
                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-1">
                  <div className="font-medium text-white">{viewingRmaClaim.productName}</div>
                  <div className="text-neutral-400 font-mono">
                    SKU: {viewingRmaClaim.productSku} · S/N: {viewingRmaClaim.serialNumber}
                  </div>
                  {viewingRmaClaim.replacementSerial && (
                    <div className="text-emerald-400 font-mono text-[11px] pt-1">
                      Replacement Unit S/N: {viewingRmaClaim.replacementSerial}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-1">Supplier / Vendor Partner</h4>
                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-1">
                  <div className="font-medium text-white flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-purple-400" />
                    <span>{viewingRmaClaim.supplierName}</span>
                  </div>
                  <div className="text-neutral-400 text-[11px]">
                    Direct distributor RMA ticket: {viewingRmaClaim.rmaNumber}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-1">Customer</h4>
                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-0.5">
                  <div className="text-white font-medium">{viewingRmaClaim.customerName}</div>
                  <div className="text-neutral-400 font-mono">{viewingRmaClaim.customerPhone}</div>
                </div>
              </div>

              {viewingRmaClaim.issueDescription && (
                <div>
                  <h4 className="font-semibold text-white mb-1">Reported Defect</h4>
                  <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 text-neutral-300 italic">
                    &quot;{viewingRmaClaim.issueDescription}&quot;
                  </div>
                </div>
              )}

              {viewingRmaClaim.notes && (
                <div>
                  <h4 className="font-semibold text-white mb-1">Tracking Notes</h4>
                  <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 text-neutral-300">
                    {viewingRmaClaim.notes}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setViewingRmaClaim(null)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg"
                >
                  Close Sheet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: SMS GATEWAY TRIGGER MODAL                                        */}
      {/* ========================================================================= */}
      {smsTestModalRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">Automated SMS Dispatch</h3>
              </div>
              <button
                onClick={() => setSmsTestModalRecord(null)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-neutral-300 font-medium mb-1.5">Select SMS Gateway</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['SMSlenz', 'Dialog', 'Mobitel'] as const).map((gw) => (
                    <button
                      key={gw}
                      type="button"
                      onClick={() => setSelectedGateway(gw)}
                      className={`p-2 rounded-lg border text-center font-medium transition-all ${
                        selectedGateway === gw
                          ? 'border-purple-500 bg-purple-500/10 text-white'
                          : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      {gw}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Recipient Mobile</label>
                <div className="p-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono">
                  {smsTestModalRecord.customerPhone} ({smsTestModalRecord.customerName})
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Message Payload Preview</label>
                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-300 font-mono text-[11px] leading-relaxed">
                  WOWTEK PRO: Dear {smsTestModalRecord.customerName}, your warranty for {smsTestModalRecord.productName} (S/N: {smsTestModalRecord.serialNumber}) is registered until {smsTestModalRecord.customerWarrantyEnd}. Helpline: 0112589000.
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSmsTestModalRecord(null)}
                  className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white bg-neutral-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleManualSmsDispatch(smsTestModalRecord)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Dispatch SMS via {selectedGateway}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: REGISTER NEW CUSTOMER WARRANTY MODAL                             */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950">
              <h3 className="text-sm font-semibold text-white">Register Serial Warranty & Auto SMS</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterWarranty} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Device Serial Number</label>
                  <input
                    type="text"
                    required
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="e.g. SN-KNG-2026-99120"
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Customer Period (Months)</label>
                  <input
                    type="number"
                    min="1"
                    value={warrantyMonths}
                    onChange={(e) => setWarrantyMonths(parseInt(e.target.value) || 12)}
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Select Product</label>
                <select
                  value={selectedSku}
                  onChange={(e) => {
                    setSelectedSku(e.target.value);
                    const sel = products.find((p) => p.sku === e.target.value);
                    if (sel?.supplier) {
                      setSupplierName(sel.supplier);
                    }
                  }}
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                >
                  {products.map((p) => (
                    <option key={p.sku} value={p.sku}>
                      {p.name} ({p.sku}) {p.supplier ? `· ${p.supplier}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Customer Full Name</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Kasun Chamara"
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Mobile (SMS Dispatch)</label>
                  <input
                    type="text"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+94 77 123 4567"
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Supplier / Distributor Backing
                </label>
                {suppliers.length > 0 ? (
                  <select
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.contactPerson})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="e.g. Chama Computers / Singer IT"
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                  />
                )}
              </div>

              <div className="p-3 bg-neutral-950/70 border border-neutral-800 rounded-lg text-neutral-400">
                <div className="text-[11px] text-purple-400">
                  Instant registration SMS will automatically be dispatched via {selectedGateway} upon saving.
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
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
                  Register & Trigger SMS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
