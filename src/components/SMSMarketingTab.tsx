'use client';

import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Users,
  Send,
  Phone,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Search,
  UserPlus,
  Trash2,
  CheckSquare,
  Square,
} from 'lucide-react';
import { formatSriLankanPhone, handleLivePhoneInput, isValidSriLankanPhone } from '@/lib/phoneUtils';

export function SMSMarketingTab() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [selectedPhone, setSelectedPhone] = useState('');
  const [message, setMessage] = useState('');
  const [campaignType, setCampaignType] = useState('single'); // 'single', 'selected', or 'bulk'
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Manual Customer Form States
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  // Fetch Customers
  const fetchCustomers = React.useCallback(async () => {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      if (data.success && Array.isArray(data.customers)) {
        setCustomers(data.customers);
        if (data.customers.length > 0 && !selectedPhone) {
          setSelectedPhone(data.customers[0].phone);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [selectedPhone]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Checkbox Selection Logic
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedCustomers(customers.map((c) => c.phone));
    } else {
      setSelectedCustomers([]);
    }
  };

  const handleToggleSelect = (phone: string) => {
    if (selectedCustomers.includes(phone)) {
      setSelectedCustomers(selectedCustomers.filter((p) => p !== phone));
    } else {
      setSelectedCustomers([...selectedCustomers, phone]);
    }
  };

  // Live Phone Input Handler (Auto +94 when typing "0", cleans up spaces & hyphens)
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = handleLivePhoneInput(e.target.value);
    setManualPhone(formatted);
  };

  const handlePhoneBlur = () => {
    if (manualPhone.trim()) {
      const formatted = formatSriLankanPhone(manualPhone);
      setManualPhone(formatted);
      if (!isValidSriLankanPhone(formatted)) {
        setNotification({
          type: 'error',
          message: 'වලංගු ශ්‍රී ලාංකික දුරකථන අංකයක් ඇතුළත් කරන්න (e.g. 0715330724 හෝ +94715330724)',
        });
      }
    }
  };

  // Manual Customer Add Handler
  const handleAddManualCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPhone.trim()) {
      setNotification({ type: 'error', message: 'දුරකථන අංකයක් ඇතුළත් කරන්න!' });
      return;
    }

    const formattedPhone = formatSriLankanPhone(manualPhone);
    if (!isValidSriLankanPhone(formattedPhone)) {
      setNotification({
        type: 'error',
        message: 'කරුණාකර වලංගු ශ්‍රී ලාංකික අංකයක් ඇතුළත් කරන්න (e.g. 0715330724 හෝ +94715330724)',
      });
      return;
    }

    setManualLoading(true);
    setNotification(null);

    try {
      const res = await fetch('/api/customers/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: manualName.trim(), phone: formattedPhone, source: 'Manual Add' }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: 'success', message: `Customer added successfully with phone ${data.phone || formattedPhone}!` });
        setManualName('');
        setManualPhone('');
        fetchCustomers();
      } else {
        setNotification({ type: 'error', message: 'Error: ' + data.error });
      }
    } catch (err: any) {
      console.error(err);
      setNotification({ type: 'error', message: err?.message || 'Failed to add customer' });
    } finally {
      setManualLoading(false);
    }
  };

  // Delete Selected Customers Handler
  const handleDeleteSelected = async () => {
    if (selectedCustomers.length === 0) {
      setNotification({ type: 'error', message: 'කරුණාකර මකා දැමීමට පාරිභෝගිකයින් තෝරන්න (Select කරන්න).' });
      return;
    }
    if (!confirm(`තෝරාගත් පාරිභෝගිකයින් ${selectedCustomers.length} දෙනා ඉවත් කිරීමට අවශ්‍යමද?`)) return;

    try {
      const res = await fetch('/api/customers/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phones: selectedCustomers }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: 'success', message: 'තෝරාගත් පාරිභෝගිකයින් සාර්ථකව මකා දමන ලදී!' });
        setSelectedCustomers([]);
        fetchCustomers();
      } else {
        setNotification({ type: 'error', message: 'Error: ' + data.error });
      }
    } catch (err: any) {
      console.error(err);
      setNotification({ type: 'error', message: err?.message || 'Error deleting customers' });
    }
  };

  const handleSendSMS = async (e: React.FormEvent) => {
    e.preventDefault();

    if (campaignType === 'single' && !selectedPhone) {
      setNotification({ type: 'error', message: 'Please select a customer phone number.' });
      return;
    }

    if (campaignType === 'selected' && selectedCustomers.length === 0) {
      setNotification({ type: 'error', message: 'Please check at least one customer from the list.' });
      return;
    }

    if (!message.trim()) {
      setNotification({ type: 'error', message: 'Please enter your promotion or offer message.' });
      return;
    }

    setLoading(true);
    setNotification(null);

    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: campaignType === 'selected' ? 'bulk' : campaignType,
          recipients:
            campaignType === 'single'
              ? { phone: selectedPhone }
              : campaignType === 'selected'
              ? selectedCustomers.map((p) => ({ phone: p }))
              : null,
          message: message.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        const count =
          campaignType === 'single'
            ? 1
            : campaignType === 'selected'
            ? selectedCustomers.length
            : customers.length;
        setNotification({
          type: 'success',
          message: `SMS Sent Successfully! Dispatched to ${count} recipient(s).`,
        });
        setMessage('');
      } else {
        setNotification({ type: 'error', message: 'Error: ' + (data.message || 'Failed to dispatch SMS') });
      }
    } catch (error: any) {
      console.error(error);
      setNotification({ type: 'error', message: 'Network error sending SMS: ' + (error?.message || 'Check connection') });
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone?.includes(searchQuery) ||
      c.source?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 text-slate-100">
      {/* Header & CRM Overview Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800/80 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-purple-600/20 via-indigo-600/20 to-pink-500/20 text-purple-300 border border-purple-500/30 shadow-inner">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
                <span>SMS Marketing &amp; Customer CRM</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  SMSlenz Gateway Active
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Targeted SMS campaigns, de-duplicated Sri Lankan contact directory, and automated promotional broadcasts.
              </p>
            </div>
          </div>
        </div>

        {/* Quick KPI Counters & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800/80 text-xs font-mono">
            <Users className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-slate-400">Total Contacts:</span>
            <span className="text-white font-bold">{customers.length}</span>
          </div>
          <button
            onClick={fetchCustomers}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-white transition cursor-pointer shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {notification && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs backdrop-blur-md animate-fadeIn shadow-lg ${
            notification.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Balanced 2-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: SMS Campaign Composer & Quick Add Contact (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* SMS Campaign Composer Card */}
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-xl shadow-purple-950/10 backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-purple-400" />
                <span>Dispatch Promotional SMS</span>
              </h2>
              <span className="text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-mono font-semibold">
                Sender: WOWTEK
              </span>
            </div>

            <form onSubmit={handleSendSMS} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Audience Target</label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800/80 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setCampaignType('single')}
                    className={`py-1.5 px-2 rounded-lg font-medium transition cursor-pointer text-center truncate ${
                      campaignType === 'single'
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Single
                  </button>
                  <button
                    type="button"
                    onClick={() => setCampaignType('selected')}
                    className={`py-1.5 px-2 rounded-lg font-medium transition cursor-pointer text-center truncate ${
                      campaignType === 'selected'
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Selected ({selectedCustomers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCampaignType('bulk')}
                    className={`py-1.5 px-2 rounded-lg font-medium transition cursor-pointer text-center truncate ${
                      campaignType === 'bulk'
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({customers.length})
                  </button>
                </div>
              </div>

              {campaignType === 'single' && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Select Target Recipient</label>
                  <select
                    value={selectedPhone}
                    onChange={(e) => setSelectedPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono shadow-inner"
                  >
                    <option value="">-- Choose Customer from Directory --</option>
                    {customers.map((c, i) => (
                      <option key={i} value={c.phone}>
                        {c.name || 'Customer'} ({c.phone}) - {c.source || 'POS'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {campaignType === 'selected' && (
                <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/30 text-[11px] text-purple-200 flex items-center justify-between">
                  <span>
                    <strong>{selectedCustomers.length}</strong> contacts checked in customer list.
                  </span>
                  {selectedCustomers.length === 0 && (
                    <span className="text-amber-400 text-[10px]">Select via checkboxes</span>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-300 font-semibold">Promotion Message Content</label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {message.length} chars · {Math.max(1, Math.ceil(message.length / 160))} SMS segment(s)
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. WOWTEK: 15% OFF on all gaming accessories this weekend! Visit wowtek.lk or show this SMS at checkout."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 text-xs resize-none shadow-inner leading-relaxed"
                  required
                />
              </div>

              {/* Sri Lankan SMS Template Presets */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  Quick Sri Lankan Presets:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setMessage('WOWTEK Promo: 10% OFF on all gaming accessories this week! Show this SMS at billing in Colombo store.')
                    }
                    className="text-[10px] bg-slate-800/80 hover:bg-slate-750 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700/80 transition cursor-pointer"
                  >
                    + 10% Promo
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setMessage('WOWTEK VIP: Exclusive 15% discount coupon: VIP15 at checkout on store.wowtek.lk.')
                    }
                    className="text-[10px] bg-slate-800/80 hover:bg-slate-750 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700/80 transition cursor-pointer"
                  >
                    + VIP Coupon
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setMessage('WOWTEK Alert: Your item order is packed and dispatched via Trans Express Courier. Tracking will follow.')
                    }
                    className="text-[10px] bg-slate-800/80 hover:bg-slate-750 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700/80 transition cursor-pointer"
                  >
                    + Dispatch Notice
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || (campaignType === 'bulk' && customers.length === 0)}
                className="w-full py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:brightness-110 disabled:opacity-40 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-950/50 border border-purple-400/30 cursor-pointer text-xs active:scale-[0.99] mt-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Dispatching via Gateway...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>
                      {campaignType === 'bulk'
                        ? `Broadcast to All (${customers.length} Contacts)`
                        : campaignType === 'selected'
                        ? `Dispatch to ${selectedCustomers.length} Selected`
                        : 'Dispatch SMS to Customer'}
                    </span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Quick Add Manual Contact Card */}
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-xl shadow-purple-950/10 backdrop-blur-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-pink-400" />
                <span>Add Walk-In / Phone Contact</span>
              </h2>
              <span className="text-[10px] bg-pink-500/15 text-pink-300 border border-pink-500/30 px-2 py-0.5 rounded-full font-mono">
                Direct Sync
              </span>
            </div>

            <form onSubmit={handleAddManualCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Customer Full Name</label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g. Kasun Chamara"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-pink-500 shadow-inner"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-slate-300 font-medium">Sri Lankan Phone Number *</label>
                  <span className="text-[10px] text-pink-400 font-mono">Auto +94</span>
                </div>
                <input
                  type="text"
                  value={manualPhone}
                  onChange={handlePhoneChange}
                  onBlur={handlePhoneBlur}
                  placeholder="0715330724 (auto-converts to +94715330724)"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-pink-500 shadow-inner"
                />
              </div>
              <button
                type="submit"
                disabled={manualLoading}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 text-pink-300 border border-pink-500/30 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                {manualLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Contact...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Save to Customer Directory</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Saved Customers Directory & Management (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-xl shadow-purple-950/10 backdrop-blur-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-bold text-white">
                Saved Contacts Directory ({customers.length})
              </h2>
              {selectedCustomers.length > 0 && (
                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full font-mono font-bold">
                  {selectedCustomers.length} selected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedCustomers.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-1 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete ({selectedCustomers.length})</span>
                </button>
              )}

              <div className="relative w-52">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Select All Row */}
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80 text-xs text-slate-300">
            <label className="flex items-center gap-2.5 cursor-pointer font-medium">
              <input
                type="checkbox"
                onChange={handleSelectAll}
                checked={customers.length > 0 && selectedCustomers.length === customers.length}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 accent-purple-600 cursor-pointer"
              />
              <span className="text-white text-xs">Select All ({customers.length})</span>
            </label>
            <span className="text-[11px] text-slate-400 font-mono">
              Use checkboxes to batch-select for targeted broadcast
            </span>
          </div>

          {/* Customer List Table */}
          <div className="overflow-x-auto max-h-[580px] overflow-y-auto rounded-xl border border-slate-800/80">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-950/90 sticky top-0 text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Phone Number</th>
                  <th className="py-3 px-3">Source Channel</th>
                  <th className="py-3 px-3 text-center">Orders</th>
                  <th className="py-3 px-3 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-500 text-xs">
                      {customers.length === 0
                        ? 'No contacts in CRM database yet. Add manual contacts or place orders via POS / Website.'
                        : 'No matching customers found for your search query.'}
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((c, idx) => {
                    const isChecked = selectedCustomers.includes(c.phone);
                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-slate-850/60 transition-colors ${
                          isChecked ? 'bg-purple-950/20' : ''
                        }`}
                      >
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSelect(c.phone)}
                            className="w-4 h-4 rounded bg-slate-800 border-slate-700 accent-purple-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3 font-semibold text-white">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-600/30 to-indigo-600/30 text-purple-300 flex items-center justify-center font-bold text-[11px] border border-purple-500/30">
                              {(c.name || 'C').charAt(0).toUpperCase()}
                            </div>
                            <span>{c.name || 'Walk-in Customer'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-purple-300 font-semibold text-xs">
                          {c.phone}
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[10px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full text-slate-300 font-mono">
                            {c.source || 'POS'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-pink-400">
                          {c.totalOrders ?? 1}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPhone(c.phone);
                              setCampaignType('single');
                            }}
                            className="text-xs text-purple-300 hover:text-white bg-purple-600/20 hover:bg-purple-600 px-2.5 py-1 rounded-lg border border-purple-500/30 transition-all font-semibold cursor-pointer shadow-sm"
                          >
                            Send SMS
                          </button>
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
    </div>
  );
}
