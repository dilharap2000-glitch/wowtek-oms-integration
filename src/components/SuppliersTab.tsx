'use client';

import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Package,
  ShieldAlert,
  Edit,
  Trash2,
  X,
  ExternalLink,
  Tag,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { Supplier, Product, SupplierRmaClaim } from '@/types';

interface SuppliersTabProps {
  suppliers: Supplier[];
  products: Product[];
  rmaClaims: SupplierRmaClaim[];
  onAddSupplier: (supplier: Supplier) => void;
  onUpdateSupplier: (id: string, updates: Partial<Supplier>) => void;
  onDeleteSupplier: (id: string) => void;
  onNavigateTab?: (tab: string) => void;
}

const COMMON_PAYMENT_TERMS = [
  'Net 30 Days',
  'Net 60 Days',
  'Credit 14 Days',
  'Cash on Delivery',
  'Advance 50%',
  '100% Advance Payment',
  'Consignment Basis',
];

export const SuppliersTab: React.FC<SuppliersTabProps> = ({
  suppliers,
  products,
  rmaClaims,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  onNavigateTab,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [termsFilter, setTermsFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplierDetail, setSelectedSupplierDetail] = useState<Supplier | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [categories, setCategories] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 30 Days');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);

  // Open Edit Modal
  const handleOpenEdit = (sup: Supplier) => {
    setEditingSupplier(sup);
    setName(sup.name);
    setContactPerson(sup.contactPerson);
    setPhone(sup.phone);
    setEmail(sup.email);
    setAddress(sup.address);
    setCategories(sup.categories);
    setPaymentTerms(sup.paymentTerms);
    setNotes(sup.notes || '');
    setActive(sup.active);
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setName('');
    setContactPerson('');
    setPhone('+94 ');
    setEmail('');
    setAddress('');
    setCategories('');
    setPaymentTerms('Net 30 Days');
    setNotes('');
    setActive(true);
    setShowAddModal(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingSupplier) {
      onUpdateSupplier(editingSupplier.id, {
        name: name.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        categories: categories.trim(),
        paymentTerms,
        notes: notes.trim(),
        active,
      });
      setEditingSupplier(null);
    } else {
      const newSup: Supplier = {
        id: `sup-${Date.now().toString().slice(-4)}`,
        name: name.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        categories: categories.trim() || 'Computer Components, Peripherals',
        paymentTerms: paymentTerms || 'Net 30 Days',
        notes: notes.trim(),
        active: true,
        createdAt: new Date().toISOString(),
      };
      onAddSupplier(newSup);
      setShowAddModal(false);
    }
  };

  // Safe array bindings
  const safeSuppliers = suppliers || [];
  const safeProducts = products || [];
  const safeRmaClaims = rmaClaims || [];

  // Metrics
  const totalSuppliers = safeSuppliers.length;
  const activeCreditSuppliers = safeSuppliers.filter(
    (s) => (s?.paymentTerms || '').toLowerCase().includes('net') || (s?.paymentTerms || '').toLowerCase().includes('credit')
  ).length;
  const totalLinkedProducts = safeProducts.filter(
    (p) => safeSuppliers.some((s) => (s?.name || '').toLowerCase() === (p?.supplier || '').toLowerCase() || s?.id === p?.supplierId)
  ).length;
  const activeRmaWithSuppliers = safeRmaClaims.filter((r) => r?.status === 'Pending with Supplier').length;

  // Filtered List
  const filteredSuppliers = safeSuppliers.filter((sup) => {
    if (!sup) return false;
    const query = (searchQuery || '').toLowerCase();
    const matchesSearch =
      (sup.name || '').toLowerCase().includes(query) ||
      (sup.contactPerson || '').toLowerCase().includes(query) ||
      (sup.categories || '').toLowerCase().includes(query) ||
      (sup.phone || '').includes(query) ||
      (sup.email || '').toLowerCase().includes(query);

    const matchesTerms =
      termsFilter === 'all' ||
      (sup.paymentTerms || '').toLowerCase().includes(termsFilter.toLowerCase());

    return matchesSearch && matchesTerms;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-400" />
              Suppliers & Purchasing
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-purple-950 text-purple-300 border border-purple-800/80">
              {suppliers.length} Vendors
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Directory of equipment distributors, credit terms, and direct inventory procurement links.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Supplier</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium">Total Registered</span>
            <Building2 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{totalSuppliers}</div>
          <div className="text-[11px] text-neutral-400 mt-1">Direct equipment vendors</div>
        </div>

        <div className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium">Credit Accounts</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {activeCreditSuppliers}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">14-60 days credit terms</div>
        </div>

        <div className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium">Supplied Stock Items</span>
            <Package className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{totalLinkedProducts}</div>
          <div className="text-[11px] text-neutral-400 mt-1">SKUs in catalog linked</div>
        </div>

        <div className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium">Active Supplier RMAs</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">
            {activeRmaWithSuppliers}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">Units sent for warranty</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search suppliers, brands, contacts..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <span className="text-xs text-neutral-400 whitespace-nowrap">Terms:</span>
          <select
            value={termsFilter}
            onChange={(e) => setTermsFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Payment Terms</option>
            <option value="net">Net 30 / 60 Days</option>
            <option value="credit">Credit 14 Days</option>
            <option value="cash">Cash on Delivery</option>
            <option value="advance">Advance Payment</option>
          </select>
        </div>
      </div>

      {/* Suppliers Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(filteredSuppliers || []).map((sup) => {
          // Count linked inventory products
          const linkedProds = (safeProducts || []).filter(
            (p) =>
              p?.supplierId === sup.id ||
              (p?.supplier || '').toLowerCase().trim() === (sup?.name || '').toLowerCase().trim()
          );
          // Count linked RMA claims
          const linkedClaims = (safeRmaClaims || []).filter(
            (r) =>
              r?.supplierId === sup.id ||
              (r?.supplierName || '').toLowerCase().trim() === (sup?.name || '').toLowerCase().trim()
          );
          const activeClaims = linkedClaims.filter((c) => c.status === 'Pending with Supplier');

          return (
            <div
              key={sup.id}
              className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-all flex flex-col justify-between space-y-4 group"
            >
              <div>
                {/* Header Info */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate group-hover:text-purple-300 transition-colors">
                      {sup.name}
                    </h3>
                    <div className="text-xs text-neutral-400 flex items-center gap-1.5 mt-0.5">
                      <span>{sup.contactPerson}</span>
                      {sup.active ? (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      ) : (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-neutral-500" />
                      )}
                    </div>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-950/80 text-purple-300 border border-purple-800/60 whitespace-nowrap">
                    {sup.paymentTerms}
                  </span>
                </div>

                {/* Brands/Categories */}
                <div className="mb-3">
                  <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-neutral-400" />
                    <span>Brands & Product Categories</span>
                  </div>
                  <p className="text-xs text-neutral-300 leading-relaxed line-clamp-2">
                    {sup.categories}
                  </p>
                </div>

                {/* Contact Data */}
                <div className="space-y-1.5 text-xs text-neutral-400 bg-neutral-950/70 p-3 rounded-xl border border-neutral-800/60">
                  <div className="flex items-center gap-2 truncate">
                    <Phone className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                    <a
                      href={`tel:${sup.phone}`}
                      className="hover:text-purple-300 transition-colors font-mono"
                    >
                      {sup.phone}
                    </a>
                  </div>

                  <div className="flex items-center gap-2 truncate">
                    <Mail className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                    <a
                      href={`mailto:${sup.email}`}
                      className="hover:text-blue-300 transition-colors truncate"
                    >
                      {sup.email}
                    </a>
                  </div>

                  {sup.address && (
                    <div className="flex items-start gap-2 text-[11px] text-neutral-400 pt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{sup.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Meta & Actions */}
              <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between">
                <div className="flex items-center gap-3 text-[11px] text-neutral-400 font-mono">
                  <span className="flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-purple-400" />
                    <span>{linkedProds.length} SKUs</span>
                  </span>

                  {activeClaims.length > 0 ? (
                    <span className="flex items-center gap-1 text-amber-400 font-semibold">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>{activeClaims.length} RMA Pending</span>
                    </span>
                  ) : (
                    <span className="text-neutral-500">0 Active RMA</span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedSupplierDetail(sup)}
                    className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                    title="View Linked Inventory & RMAs"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenEdit(sup)}
                    className="p-1.5 text-neutral-400 hover:text-purple-300 hover:bg-neutral-800 rounded-lg transition-colors"
                    title="Edit Profile"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete supplier "${sup.name}"?`)) {
                        onDeleteSupplier(sup.id);
                      }
                    }}
                    className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors"
                    title="Delete Supplier"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredSuppliers.length === 0 && (
          <div className="col-span-full p-12 text-center rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3">
            <Building2 className="w-10 h-10 text-neutral-600 mx-auto" />
            <h3 className="text-sm font-semibold text-white">No suppliers found</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              No suppliers matched your search query. Add a new supplier profile or clear filters.
            </p>
            <button
              onClick={handleOpenAdd}
              className="mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold"
            >
              Add First Supplier
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit Supplier Modal */}
      {(showAddModal || editingSupplier) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {editingSupplier ? 'Edit Supplier Profile' : 'Add New Supplier Profile'}
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Register vendor details for stock linking and warranty returns
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingSupplier(null);
                }}
                className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="col-span-full">
                  <label className="block text-xs text-neutral-300 font-medium mb-1">
                    Supplier / Company Name <span className="text-purple-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Chama Computers (Pvt) Ltd"
                    className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-300 font-medium mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Nuwan Jayasinghe"
                    className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-300 font-medium mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +94 11 258 4400"
                    className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-white font-mono placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-300 font-medium mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. warranty@supplier.lk"
                    className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-300 font-medium mb-1">
                    Payment Terms
                  </label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  >
                    {COMMON_PAYMENT_TERMS.map((term) => (
                      <option key={term} value={term}>
                        {term}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-full">
                  <label className="block text-xs text-neutral-300 font-medium mb-1">
                    Office / Service Center Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. 142 Galle Road, Bambalapitiya, Colombo 04"
                    className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="col-span-full">
                  <label className="block text-xs text-neutral-300 font-medium mb-1">
                    Provided Brands & Categories
                  </label>
                  <input
                    type="text"
                    value={categories}
                    onChange={(e) => setCategories(e.target.value)}
                    placeholder="e.g. Kingston, ASUS, Storage & SSDs, Motherboards"
                    className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="col-span-full">
                  <label className="block text-xs text-neutral-300 font-medium mb-1">
                    Procurement Notes / Return Policy
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. 7-day turnaround for RMA replacements. RMA point of contact: Nuwan."
                    className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingSupplier(null);
                  }}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow-md transition-colors"
                >
                  {editingSupplier ? 'Save Changes' : 'Create Supplier Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Details & Linked Stock / Claims Drawer */}
      {selectedSupplierDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-4 border-b border-neutral-800 bg-neutral-950 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {selectedSupplierDetail.name}
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Contact: {selectedSupplierDetail.contactPerson} · {selectedSupplierDetail.phone}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSupplierDetail(null)}
                className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs">
              {/* Profile Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                  <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-0.5">
                    Payment Terms
                  </div>
                  <div className="font-semibold text-purple-300 font-mono">
                    {selectedSupplierDetail.paymentTerms}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                  <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-0.5">
                    Phone Contact
                  </div>
                  <a
                    href={`tel:${selectedSupplierDetail.phone}`}
                    className="font-semibold text-white font-mono hover:text-purple-300"
                  >
                    {selectedSupplierDetail.phone}
                  </a>
                </div>

                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-0.5">
                    Email
                  </div>
                  <a
                    href={`mailto:${selectedSupplierDetail.email}`}
                    className="font-semibold text-white truncate block hover:text-blue-300"
                  >
                    {selectedSupplierDetail.email}
                  </a>
                </div>
              </div>

              {/* Brands */}
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-1">
                  Product Specialization
                </span>
                <span className="text-neutral-200">{selectedSupplierDetail.categories}</span>
                {selectedSupplierDetail.notes && (
                  <p className="text-[11px] text-neutral-400 mt-2 pt-2 border-t border-neutral-800/80">
                    {selectedSupplierDetail.notes}
                  </p>
                )}
              </div>

              {/* Linked Inventory Products */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-white flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-purple-400" />
                    <span>Linked Stock Products</span>
                  </h4>
                  {onNavigateTab && (
                    <button
                      onClick={() => {
                        setSelectedSupplierDetail(null);
                        onNavigateTab('products');
                      }}
                      className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1"
                    >
                      <span>View in Inventory</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {safeProducts.filter(
                  (p) =>
                    p?.supplierId === selectedSupplierDetail.id ||
                    (p?.supplier || '').toLowerCase().trim() ===
                      selectedSupplierDetail.name.toLowerCase().trim()
                ).length > 0 ? (
                  <div className="border border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-800/80">
                    {safeProducts
                      .filter(
                        (p) =>
                          p?.supplierId === selectedSupplierDetail.id ||
                          (p?.supplier || '').toLowerCase().trim() ===
                            selectedSupplierDetail.name.toLowerCase().trim()
                      )
                      .map((p) => (
                        <div
                          key={p.id}
                          className="p-2.5 bg-neutral-950 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-medium text-white">{p.name}</div>
                            <div className="text-[10px] text-neutral-400 font-mono">
                              SKU: {p.sku} · Barcode: {p.barcode}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-purple-300">
                              Rs. {p.costPrice.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-neutral-400">
                              Stock: {p.stockStore + p.stockWarehouse} units
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="p-4 text-center rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-400 text-xs">
                    No inventory products currently tagged with this supplier.
                  </div>
                )}
              </div>

              {/* Active Supplier RMA Claims */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-white flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    <span>Warranty Return Claims (RMA)</span>
                  </h4>
                  {onNavigateTab && (
                    <button
                      onClick={() => {
                        setSelectedSupplierDetail(null);
                        onNavigateTab('warranty');
                      }}
                      className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1"
                    >
                      <span>Open Warranty RMA</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {safeRmaClaims.filter(
                  (r) =>
                    r?.supplierId === selectedSupplierDetail.id ||
                    (r?.supplierName || '').toLowerCase().trim() ===
                      selectedSupplierDetail.name.toLowerCase().trim()
                ).length > 0 ? (
                  <div className="border border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-800/80">
                    {safeRmaClaims
                      .filter(
                        (r) =>
                          r?.supplierId === selectedSupplierDetail.id ||
                          (r?.supplierName || '').toLowerCase().trim() ===
                            selectedSupplierDetail.name.toLowerCase().trim()
                      )
                      .map((claim) => (
                        <div
                          key={claim.id}
                          className="p-2.5 bg-neutral-950 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-medium text-white flex items-center gap-2">
                              <span>{claim.productName}</span>
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
                                {claim.rmaNumber}
                              </span>
                            </div>
                            <div className="text-[10px] text-neutral-400 font-mono">
                              S/N: {claim.serialNumber} · Sent: {claim.dateSent}
                            </div>
                          </div>

                          <div className="text-right">
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                                claim.status === 'Repaired'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : claim.status === 'Replaced'
                                  ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                  : claim.status === 'Pending with Supplier'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                  : 'bg-red-950 text-red-300 border border-red-800'
                              }`}
                            >
                              {claim.status}
                            </span>
                            <div className="text-[10px] text-neutral-400 mt-1">
                              Due: {claim.expectedReturnDate}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="p-4 text-center rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-400 text-xs">
                    No active or past RMA claims with this vendor.
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 border-t border-neutral-800 bg-neutral-950 flex justify-end">
              <button
                onClick={() => setSelectedSupplierDetail(null)}
                className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
