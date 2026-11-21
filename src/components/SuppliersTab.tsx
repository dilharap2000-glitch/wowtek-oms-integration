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
    <div className="space-y-6 text-[var(--text-primary)]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Suppliers & Purchasing
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/80">
              {suppliers.length} Vendors
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Directory of equipment distributors, credit terms, and direct inventory procurement links.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Supplier</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm">
          <div className="flex items-center justify-between text-[var(--text-secondary)] mb-2">
            <span className="text-xs font-medium">Total Registered</span>
            <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)] font-mono">{totalSuppliers}</div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1">Direct equipment vendors</div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm">
          <div className="flex items-center justify-between text-[var(--text-secondary)] mb-2">
            <span className="text-xs font-medium">Credit Accounts</span>
            <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
            {activeCreditSuppliers}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1">14-60 days credit terms</div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm">
          <div className="flex items-center justify-between text-[var(--text-secondary)] mb-2">
            <span className="text-xs font-medium">Supplied Stock Items</span>
            <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)] font-mono">{totalLinkedProducts}</div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1">SKUs in catalog linked</div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm">
          <div className="flex items-center justify-between text-[var(--text-secondary)] mb-2">
            <span className="text-xs font-medium">Active Supplier RMAs</span>
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">
            {activeRmaWithSuppliers}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1">Units sent for warranty</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search suppliers, brands, contacts..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:outline-none focus:border-[var(--accent-primary)]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <span className="text-xs text-[var(--text-secondary)] whitespace-nowrap">Terms:</span>
          <select
            value={termsFilter}
            onChange={(e) => setTermsFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
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
              className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40 transition-all flex flex-col justify-between space-y-4 group shadow-sm"
            >
              <div>
                {/* Header Info */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">
                      {sup.name}
                    </h3>
                    <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5 mt-0.5">
                      <span>{sup.contactPerson}</span>
                      {sup.active ? (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      ) : (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)]" />
                      )}
                    </div>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 whitespace-nowrap">
                    {sup.paymentTerms}
                  </span>
                </div>

                {/* Brands/Categories */}
                <div className="mb-3">
                  <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-[var(--text-secondary)]" />
                    <span>Brands & Product Categories</span>
                  </div>
                  <p className="text-xs text-[var(--text-primary)] leading-relaxed line-clamp-2">
                    {sup.categories}
                  </p>
                </div>

                {/* Contact Data */}
                <div className="space-y-1.5 text-xs text-[var(--text-secondary)] bg-[var(--bg-subtle)] p-3 rounded-xl border border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2 truncate">
                    <Phone className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                    <a
                      href={`tel:${sup.phone}`}
                      className="hover:text-purple-600 dark:hover:text-purple-300 transition-colors font-mono text-[var(--text-primary)]"
                    >
                      {sup.phone}
                    </a>
                  </div>

                  <div className="flex items-center gap-2 truncate">
                    <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <a
                      href={`mailto:${sup.email}`}
                      className="hover:text-blue-600 dark:hover:text-blue-300 transition-colors truncate"
                    >
                      {sup.email}
                    </a>
                  </div>

                  {sup.address && (
                    <div className="flex items-start gap-2 text-[11px] text-[var(--text-secondary)] pt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{sup.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Meta & Actions */}
              <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
                <div className="flex items-center gap-3 text-[11px] text-[var(--text-secondary)] font-mono">
                  <span className="flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>{linkedProds.length} SKUs</span>
                  </span>

                  {activeClaims.length > 0 ? (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>{activeClaims.length} RMA Pending</span>
                    </span>
                  ) : (
                    <span className="text-[var(--text-secondary)]">0 Active RMA</span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedSupplierDetail(sup)}
                    className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] rounded-lg transition-colors"
                    title="View Linked Inventory & RMAs"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenEdit(sup)}
                    className="p-1.5 text-[var(--text-secondary)] hover:text-purple-600 dark:hover:text-purple-300 hover:bg-[var(--bg-subtle)] rounded-lg transition-colors"
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
                    className="p-1.5 text-[var(--text-secondary)] hover:text-red-500 dark:hover:text-red-400 hover:bg-[var(--bg-subtle)] rounded-lg transition-colors"
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
          <div className="col-span-full p-12 text-center rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3 shadow-sm">
            <Building2 className="w-10 h-10 text-[var(--text-secondary)]/50 mx-auto" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">No suppliers found</h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    {editingSupplier ? 'Edit Supplier Profile' : 'Add New Supplier Profile'}
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Register vendor details for stock linking and warranty returns
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingSupplier(null);
                }}
                className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--border-subtle)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="col-span-full">
                  <label className="block text-xs text-[var(--text-secondary)] font-medium mb-1">
                    Supplier / Company Name <span className="text-purple-600 dark:text-purple-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Chama Computers (Pvt) Ltd"
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:outline-none focus:border-[var(--accent-primary)]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-[var(--text-secondary)] font-medium mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Nuwan Jayasinghe"
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[var(--text-secondary)] font-medium mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +94 11 258 4400"
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] font-mono placeholder:text-[var(--text-secondary)]/70 focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[var(--text-secondary)] font-medium mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. warranty@supplier.lk"
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[var(--text-secondary)] font-medium mb-1">
                    Payment Terms
                  </label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  >
                    {COMMON_PAYMENT_TERMS.map((term) => (
                      <option key={term} value={term}>
                        {term}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-full">
                  <label className="block text-xs text-[var(--text-secondary)] font-medium mb-1">
                    Office / Service Center Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. 142 Galle Road, Bambalapitiya, Colombo 04"
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>

                <div className="col-span-full">
                  <label className="block text-xs text-[var(--text-secondary)] font-medium mb-1">
                    Provided Brands & Categories
                  </label>
                  <input
                    type="text"
                    value={categories}
                    onChange={(e) => setCategories(e.target.value)}
                    placeholder="e.g. Kingston, ASUS, Storage & SSDs, Motherboards"
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>

                <div className="col-span-full">
                  <label className="block text-xs text-[var(--text-secondary)] font-medium mb-1">
                    Procurement Notes / Return Policy
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. 7-day turnaround for RMA replacements. RMA point of contact: Nuwan."
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingSupplier(null);
                  }}
                  className="px-4 py-2 bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    {selectedSupplierDetail.name}
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Contact: {selectedSupplierDetail.contactPerson} · {selectedSupplierDetail.phone}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSupplierDetail(null)}
                className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--border-subtle)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs">
              {/* Profile Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                  <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-0.5">
                    Payment Terms
                  </div>
                  <div className="font-semibold text-purple-600 dark:text-purple-300 font-mono">
                    {selectedSupplierDetail.paymentTerms}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                  <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-0.5">
                    Phone Contact
                  </div>
                  <a
                    href={`tel:${selectedSupplierDetail.phone}`}
                    className="font-semibold text-[var(--text-primary)] font-mono hover:text-purple-600 dark:hover:text-purple-300"
                  >
                    {selectedSupplierDetail.phone}
                  </a>
                </div>

                <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-0.5">
                    Email
                  </div>
                  <a
                    href={`mailto:${selectedSupplierDetail.email}`}
                    className="font-semibold text-[var(--text-primary)] truncate block hover:text-blue-600 dark:hover:text-blue-300"
                  >
                    {selectedSupplierDetail.email}
                  </a>
                </div>
              </div>

              {/* Brands */}
              <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider block mb-1">
                  Product Specialization
                </span>
                <span className="text-[var(--text-primary)]">{selectedSupplierDetail.categories}</span>
                {selectedSupplierDetail.notes && (
                  <p className="text-[11px] text-[var(--text-secondary)] mt-2 pt-2 border-t border-[var(--border-subtle)]">
                    {selectedSupplierDetail.notes}
                  </p>
                )}
              </div>

              {/* Linked Inventory Products */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>Linked Stock Products</span>
                  </h4>
                  {onNavigateTab && (
                    <button
                      onClick={() => {
                        setSelectedSupplierDetail(null);
                        onNavigateTab('products');
                      }}
                      className="text-[11px] text-purple-600 dark:text-purple-400 hover:text-purple-500 flex items-center gap-1"
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
                  <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden divide-y divide-[var(--border-subtle)]">
                    {safeProducts
                      .filter(
                        (p) =>
                          p?.supplierId === selectedSupplierDetail.id ||
                          (p?.supplier || '').toLowerCase().trim() ===
                            selectedSupplierDetail.name.toLowerCase().trim()
                      )
                      .map((p, idx) => (
                        <div
                          key={`${p.id || p.sku || 'sup-prod'}-${idx}`}
                          className="p-2.5 bg-[var(--bg-subtle)] flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-medium text-[var(--text-primary)]">{p.name}</div>
                            <div className="text-[10px] text-[var(--text-secondary)] font-mono">
                              SKU: {p.sku} · Barcode: {p.barcode}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-purple-600 dark:text-purple-300">
                              Rs. {Number(p.costPrice || 0).toLocaleString()}
                            </div>
                            <div className="text-[10px] text-[var(--text-secondary)]">
                              Stock: {Number(p.stockStore || 0) + Number(p.stockWarehouse || 0)} units
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="p-4 text-center rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs">
                    No inventory products currently tagged with this supplier.
                  </div>
                )}
              </div>

              {/* Active Supplier RMA Claims */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Warranty Return Claims (RMA)</span>
                  </h4>
                  {onNavigateTab && (
                    <button
                      onClick={() => {
                        setSelectedSupplierDetail(null);
                        onNavigateTab('warranty');
                      }}
                      className="text-[11px] text-purple-600 dark:text-purple-400 hover:text-purple-500 flex items-center gap-1"
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
                  <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden divide-y divide-[var(--border-subtle)]">
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
                          className="p-2.5 bg-[var(--bg-subtle)] flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-medium text-[var(--text-primary)] flex items-center gap-2">
                              <span>{claim.productName}</span>
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                                {claim.rmaNumber}
                              </span>
                            </div>
                            <div className="text-[10px] text-[var(--text-secondary)] font-mono">
                              S/N: {claim.serialNumber} · Sent: {claim.dateSent}
                            </div>
                          </div>

                          <div className="text-right">
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                                claim.status === 'Repaired'
                                  ? 'bg-[var(--badge-ready-bg)] text-[var(--badge-ready-text)] border border-teal-200 dark:border-emerald-800'
                                  : claim.status === 'Replaced'
                                  ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                  : claim.status === 'Pending with Supplier'
                                  ? 'bg-[var(--badge-pending-bg)] text-[var(--badge-pending-text)] border border-amber-200 dark:border-amber-800'
                                  : 'bg-rose-50 dark:bg-red-950 text-rose-700 dark:text-red-300 border border-rose-200 dark:border-red-800'
                              }`}
                            >
                              {claim.status}
                            </span>
                            <div className="text-[10px] text-[var(--text-secondary)] mt-1">
                              Due: {claim.expectedReturnDate}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="p-4 text-center rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs">
                    No active or past RMA claims with this vendor.
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex justify-end">
              <button
                onClick={() => setSelectedSupplierDetail(null)}
                className="px-4 py-1.5 bg-[var(--bg-surface)] hover:bg-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl text-xs font-semibold transition-colors"
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
