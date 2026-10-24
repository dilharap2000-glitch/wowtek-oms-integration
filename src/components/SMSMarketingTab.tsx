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

  // Manual Customer Add Handler
  const handleAddManualCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPhone.trim()) {
      setNotification({ type: 'error', message: 'ෆෝන් අංකයක් ඇතුළත් කරන්න!' });
      return;
    }
    setManualLoading(true);
    setNotification(null);

    try {
      const res = await fetch('/api/customers/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: manualName.trim(), phone: manualPhone.trim(), source: 'Manual Add' }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: 'success', message: 'Customer successfully added!' });
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
    <div className="p-4 md:p-8 text-white min-h-screen bg-gray-950 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-gray-800 gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <MessageSquare className="w-5 h-5" />
            </span>
            SMS Marketing &amp; Customer Database
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage contacts, add manual numbers, and broadcast promotional campaigns with SMSlenz.
          </p>
        </div>

        <button
          onClick={fetchCustomers}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition self-start cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Contacts
        </button>
      </div>

      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm animate-fadeIn ${
            notification.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/60 border-rose-800 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-black/20"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top 2 Columns: Add Manual Customer & Send Promotional SMS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Manual Customer Add Form */}
        <div className="bg-gray-900 border border-gray-800 p-5 rounded-xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-pink-400 flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Add Manual Customer / Phone
              </h2>
              <span className="text-[10px] bg-pink-500/10 text-pink-300 border border-pink-500/20 px-2 py-0.5 rounded-full font-mono">
                Direct Upsert
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Add walk-in or phone-order customer numbers into the de-duplicated marketing database.
            </p>

            <form onSubmit={handleAddManualCustomer} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g. Nimal Perera"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-pink-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Phone Number *</label>
                <input
                  type="text"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  placeholder="e.g. 0771234567 or +94771234567"
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-sm text-white font-mono focus:outline-none focus:border-pink-500"
                />
              </div>
              <button
                type="submit"
                disabled={manualLoading}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-bold text-sm text-white hover:opacity-90 disabled:opacity-50 transition cursor-pointer shadow-md mt-2 flex items-center justify-center gap-2"
              >
                {manualLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Save Customer
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right: SMS Campaign Dispatch Form */}
        <div className="bg-gray-900 border border-gray-800 p-5 rounded-xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-purple-400 flex items-center gap-2">
                <Send className="w-4 h-4" />
                Send Promotional SMS / Offers
              </h2>
              <span className="text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded-full font-mono">
                Sender: WOWTEK
              </span>
            </div>

            <form onSubmit={handleSendSMS} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Campaign Mode</label>
                <select
                  value={campaignType}
                  onChange={(e) => setCampaignType(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="single">Single Customer (Select below)</option>
                  <option value="selected">
                    Selected Customers ({selectedCustomers.length} checked in table)
                  </option>
                  <option value="bulk">Bulk SMS (All {customers.length} Customers in DB)</option>
                </select>
              </div>

              {campaignType === 'single' && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Select Customer</label>
                  <select
                    value={selectedPhone}
                    onChange={(e) => setSelectedPhone(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers.map((c, i) => (
                      <option key={i} value={c.phone}>
                        {c.name || 'Customer'} ({c.phone}) - {c.source || 'POS'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-gray-400">Offer Message</label>
                  <span className="text-[10px] text-gray-500 font-mono">{message.length} chars</span>
                </div>
                <textarea
                  rows={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. WOWTEK: 15% OFF on all accessories this weekend! Visit wowtek.lk"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-xs resize-none"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setMessage('WOWTEK Promo: 10% OFF on all gaming accessories this week! Show this SMS at billing.')
                  }
                  className="text-[11px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-0.5 rounded border border-gray-700 transition"
                >
                  + Promo
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setMessage('WOWTEK VIP: Exclusive 15% discount coupon: VIP15 at checkout on store.wowtek.lk.')
                  }
                  className="text-[11px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-0.5 rounded border border-gray-700 transition"
                >
                  + VIP
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || (campaignType === 'bulk' && customers.length === 0)}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold p-2.5 rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30 cursor-pointer text-sm"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Sending SMS...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Dispatch Campaign
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Bottom Full-Width Table: Saved Customers List with Checkbox Selection & Bulk Delete */}
      <div className="bg-gray-900 border border-gray-800 p-5 rounded-xl shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              Saved Customers ({customers.length})
            </h2>
            {selectedCustomers.length > 0 && (
              <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full font-mono">
                {selectedCustomers.length} selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {selectedCustomers.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected ({selectedCustomers.length})
              </button>
            )}

            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search phone or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-2 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Select All Row */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-800/80 rounded-t-lg border-b border-gray-700/60 text-xs text-gray-300">
          <label className="flex items-center gap-2 cursor-pointer font-medium">
            <input
              type="checkbox"
              onChange={handleSelectAll}
              checked={customers.length > 0 && selectedCustomers.length === customers.length}
              className="rounded bg-gray-900 border-gray-700 accent-purple-600 cursor-pointer"
            />
            <span>Select All Customers ({customers.length})</span>
          </label>
          <span className="text-[11px] text-gray-400">
            Click checkbox to select customers for bulk operations
          </span>
        </div>

        {/* Customer List Table */}
        <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-b-lg border border-gray-800">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="border-b border-gray-800 bg-gray-850 sticky top-0 text-gray-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="p-3 w-10 text-center">#</th>
                <th className="p-3">Customer Name</th>
                <th className="p-3">Phone Number</th>
                <th className="p-3">Source Channel</th>
                <th className="p-3 text-center">Total Orders</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/40">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500 text-sm">
                    {customers.length === 0
                      ? 'No customers in database yet. Add manual customers above or place orders via POS / Website.'
                      : 'No matching customers found for search query.'}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c, idx) => {
                  const isChecked = selectedCustomers.includes(c.phone);
                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-gray-850/80 transition ${
                        isChecked ? 'bg-purple-950/20' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelect(c.phone)}
                          className="rounded bg-gray-800 border-gray-700 accent-purple-600 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-semibold text-white">
                        {c.name || 'Walk-in Customer'}
                      </td>
                      <td className="p-3 font-mono text-purple-300 text-xs">
                        {c.phone}
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] bg-gray-800 border border-gray-700 px-2 py-0.5 rounded text-gray-300">
                          {c.source || 'POS'}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-pink-400">
                        {c.totalOrders ?? 1}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPhone(c.phone);
                            setCampaignType('single');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="text-xs text-purple-400 hover:text-purple-300 hover:underline cursor-pointer"
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
  );
}
