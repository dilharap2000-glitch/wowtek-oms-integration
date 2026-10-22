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
  ShoppingBag,
  Clock,
  Search,
} from 'lucide-react';

export function SMSMarketingTab() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedPhone, setSelectedPhone] = useState('');
  const [message, setMessage] = useState('');
  const [campaignType, setCampaignType] = useState('single'); // 'single' හෝ 'bulk'
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // කස්ටමර්ස්ලගේ ලැයිස්තුව fetch කරගැනීම
  const fetchCustomers = React.useCallback(() => {
    fetch('/api/customers')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.customers)) {
          setCustomers(data.customers);
          if (data.customers.length > 0) {
            setSelectedPhone((prev) => prev || data.customers[0].phone);
          }
        }
      })
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSendSMS = async (e: React.FormEvent) => {
    e.preventDefault();

    if (campaignType === 'single' && !selectedPhone) {
      setNotification({ type: 'error', message: 'Please select a customer phone number.' });
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
          type: campaignType,
          recipients: campaignType === 'single' ? { phone: selectedPhone } : null,
          message: message.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setNotification({
          type: 'success',
          message: `SMS Sent Successfully! Dispatched to ${data.recipientsCount || (campaignType === 'single' ? 1 : customers.length)} recipient(s).`,
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
    <div className="p-4 md:p-8 text-white min-h-screen bg-gray-950">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-gray-800 mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <MessageSquare className="w-5 h-5" />
            </span>
            SMS Marketing & Customer Database
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            De-duplicated Sri Lanka customer contacts with instant single and bulk promotional SMS broadcast.
          </p>
        </div>

        <button
          onClick={fetchCustomers}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition self-start"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Contacts
        </button>
      </div>

      {notification && (
        <div
          className={`mb-6 p-4 rounded-xl border flex items-center justify-between gap-3 text-sm animate-in fade-in slide-in-from-top-2 duration-200 ${
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SMS Sending Form */}
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
                <Send className="w-4 h-4 text-purple-400" />
                Send Promotional SMS / Offers
              </h2>
              <span className="text-xs bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2.5 py-0.5 rounded-full font-mono">
                Sender: WOWTEK
              </span>
            </div>

            <form onSubmit={handleSendSMS} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Campaign Type</label>
                <select
                  value={campaignType}
                  onChange={(e) => setCampaignType(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="single">Single Customer (Direct SMS)</option>
                  <option value="bulk">Bulk SMS (All Saved Customers in Database)</option>
                </select>
              </div>

              {campaignType === 'single' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Select Customer Phone</label>
                  <select
                    value={selectedPhone}
                    onChange={(e) => setSelectedPhone(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers.map((c, i) => (
                      <option key={i} value={c.phone}>
                        {c.name} ({c.phone}) - {c.source || 'POS'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {campaignType === 'bulk' && (
                <div className="p-3 bg-purple-950/40 border border-purple-800/40 rounded-lg text-xs text-purple-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 shrink-0 text-purple-400" />
                  <span>
                    Bulk campaign will broadcast directly to all <strong>{customers.length}</strong> unique, duplicate-free phone numbers in your database.
                  </span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm text-gray-400">Offer Message</label>
                  <span className="text-xs text-gray-500 font-mono">{message.length} chars</span>
                </div>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your special discount offer or message here... (e.g., WOWTEK: Flash Sale! 15% OFF on all Gaming Accessories this weekend only. Visit wowtek.lk)"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm resize-none"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setMessage('WOWTEK Promo: Get 10% OFF on all PC components & accessories this week! Show this SMS at billing.')
                  }
                  className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1 rounded border border-gray-700 transition"
                >
                  + Promo Template
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setMessage('WOWTEK: Thank you for your continued loyalty! Special VIP discount coupon: VIP15 at wowtek.lk.')
                  }
                  className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1 rounded border border-gray-700 transition"
                >
                  + VIP Template
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || (campaignType === 'bulk' && customers.length === 0)}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium p-3 rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Sending SMS Campaign...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send SMS Campaign
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
            <span>Gateway: Notify.lk / SMSlenz Sri Lanka</span>
            <span>Sender ID: WOWTEK</span>
          </div>
        </div>

        {/* Saved Customers List (Duplicate Free Phone Book) */}
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
              <Users className="w-4 h-4 text-purple-400" />
              Saved Customers ({customers.length})
            </h2>
            <div className="relative w-44">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search phone or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[460px] overflow-y-auto rounded-lg border border-gray-800">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="border-b border-gray-800 bg-gray-800/60 sticky top-0 text-gray-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Source</th>
                  <th className="p-3 text-center">Orders</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500 text-sm">
                      {customers.length === 0
                        ? 'No customers in database yet. New customers are automatically saved without duplicates when orders are placed via POS, Website, or Delivery apps.'
                        : 'No matching customers found for search query.'}
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((cust, idx) => (
                    <tr
                      key={idx}
                      onClick={() => {
                        setSelectedPhone(cust.phone);
                        setCampaignType('single');
                      }}
                      className="border-b border-gray-800/50 hover:bg-gray-800/40 cursor-pointer transition"
                    >
                      <td className="p-3">
                        <div className="font-medium text-white">{cust.name}</div>
                        {cust.lastOrderDate && (
                          <div className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(cust.lastOrderDate).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-purple-400 font-mono text-xs">{cust.phone}</td>
                      <td className="p-3">
                        <span className="text-[11px] uppercase bg-gray-800 border border-gray-700/60 px-2 py-0.5 rounded text-gray-300 font-medium">
                          {cust.source || 'POS'}
                        </span>
                      </td>
                      <td className="p-3 text-center font-semibold text-white">
                        <span className="bg-purple-950/70 text-purple-300 border border-purple-800/40 px-2 py-0.5 rounded-full text-xs">
                          {cust.totalOrders || 1}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-800/60 text-xs text-gray-500 flex items-center justify-between">
            <span>Duplicate prevention active via phone uniqueness</span>
            <span>Click any customer to select for Direct SMS</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SMSMarketingTab;
