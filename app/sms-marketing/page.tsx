'use client';

import React, { useState, useEffect } from 'react';

export default function SmsMarketingPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

  // Manual Customer Form States
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch Customers
  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers'); // ඔයාගේ customers fetch කරන api එක
      const data = await res.json();
      if (data.success) setCustomers(data.customers || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

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
    if (!manualPhone) {
      alert('ෆෝන් අංකයක් ඇතුළත් කරන්න!');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/customers/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: manualName, phone: manualPhone, source: 'Manual Add' }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Customer successfully added!');
        setManualName('');
        setManualPhone('');
        fetchCustomers();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Delete Selected Customers Handler
  const handleDeleteSelected = async () => {
    if (selectedCustomers.length === 0) {
      alert('කරුණාකර මකා දැමීමට පාරිභෝගිකයින් තෝරන්න (Select කරන්න).');
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
        alert('තෝරාගත් පාරිභෝගිකයින් සාර්ථකව මකා දමන ලදී!');
        setSelectedCustomers([]);
        fetchCustomers();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 text-white bg-gray-950 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-purple-400">SMS Marketing &amp; Customer Database</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Manual Customer Add Form */}
        <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl shadow-xl">
          <h2 className="text-lg font-semibold mb-3 text-pink-400">Add Manual Customer / Phone</h2>
          <form onSubmit={handleAddManualCustomer} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Customer Name</label>
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="e.g. Nimal Perera"
                className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Phone Number</label>
              <input
                type="text"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                placeholder="e.g. +94771234567"
                required
                className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:outline-none focus:border-pink-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded font-bold text-sm hover:opacity-90 disabled:opacity-50 cursor-pointer transition shadow-md"
            >
              {loading ? 'Adding...' : 'Save Customer'}
            </button>
          </form>
        </div>

        {/* Right: Saved Customers List with Selection & Delete */}
        <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold text-purple-400">Saved Customers ({customers.length})</h2>
              {selectedCustomers.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-bold transition cursor-pointer"
                >
                  Delete Selected ({selectedCustomers.length})
                </button>
              )}
            </div>

            {/* Select All Checkbox */}
            <div className="flex items-center space-x-2 mb-2 pb-2 border-b border-gray-800 text-xs text-gray-400">
              <input
                type="checkbox"
                onChange={handleSelectAll}
                checked={customers.length > 0 && selectedCustomers.length === customers.length}
                className="rounded bg-gray-800 border-gray-700 accent-purple-600 cursor-pointer"
              />
              <span>Select All</span>
            </div>

            {/* Customer List */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {customers.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-sm">
                  No customers found. Add your first customer using the form.
                </div>
              ) : (
                customers.map((c, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-gray-800/60 p-2.5 rounded border border-gray-700/50 text-sm hover:bg-gray-800 transition"
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedCustomers.includes(c.phone)}
                        onChange={() => handleToggleSelect(c.phone)}
                        className="rounded bg-gray-800 border-gray-700 accent-purple-600 cursor-pointer"
                      />
                      <div>
                        <p className="font-semibold text-white">{c.name || 'Walk-in Customer'}</p>
                        <p className="text-xs text-gray-400 font-mono">{c.phone}</p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-gray-700 px-2 py-0.5 rounded text-gray-300">
                      {c.source || 'POS'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
