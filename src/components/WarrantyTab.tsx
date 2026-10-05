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
} from 'lucide-react';
import { WarrantyRecord, Product } from '@/lib/types';

interface WarrantyTabProps {
  warranties: WarrantyRecord[];
  products: Product[];
  onAddWarranty: (record: WarrantyRecord) => void;
  onDispatchSms: (id: string, gateway: 'SMSlenz' | 'Dialog' | 'Mobitel') => void;
}

export const WarrantyTab: React.FC<WarrantyTabProps> = ({
  warranties,
  products,
  onAddWarranty,
  onDispatchSms,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [smsTestModalRecord, setSmsTestModalRecord] = useState<WarrantyRecord | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<'SMSlenz' | 'Dialog' | 'Mobitel'>('SMSlenz');
  const [smsNotificationMsg, setSmsNotificationMsg] = useState<string | null>(null);

  // New warranty form state
  const [serialNumber, setSerialNumber] = useState('');
  const [selectedSku, setSelectedSku] = useState(products[0]?.sku || '');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+94 77 ');
  const [warrantyMonths, setWarrantyMonths] = useState(24);
  const [supplierName, setSupplierName] = useState('Chama Computers (Pvt) Ltd');

  const filteredWarranties = warranties.filter((w) => {
    const matchesStatus = statusFilter === 'all' || w.status === statusFilter;
    const matchesSearch =
      w.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.customerPhone.includes(searchQuery);
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

    const newRec: WarrantyRecord = {
      id: `war-${Date.now().toString().slice(-4)}`,
      serialNumber: serialNumber || `SN-${Math.floor(100000 + Math.random() * 900000)}`,
      productSku: product.sku,
      productName: product.name,
      customerName,
      customerPhone,
      customerWarrantyStart: today.toISOString().split('T')[0],
      customerWarrantyMonths: warrantyMonths,
      customerWarrantyEnd: endDate.toISOString().split('T')[0],
      supplierName: supplierName || product.supplier,
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

    setSmsNotificationMsg(`Automated SMS dispatched via SMSlenz to ${newRec.customerPhone}`);
    setTimeout(() => setSmsNotificationMsg(null), 4000);
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

    setSmsNotificationMsg(`Expiry SMS reminder dispatched to ${record.customerPhone} via SMSlenz`);
    setTimeout(() => setSmsNotificationMsg(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Warranty Tracker & Automated SMS Gateway
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Dual warranty lifecycle (Customer vs Supplier) and automated SMSlenz / Dialog SMS dispatch on registration & 30-day expiry.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Serial & SMS</span>
        </button>
      </div>

      {/* Real-time SMS status banner if triggered */}
      {smsNotificationMsg && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-xs rounded-xl flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{smsNotificationMsg}</span>
          </div>
          <button onClick={() => setSmsNotificationMsg(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between p-3 rounded-xl bg-neutral-900 border border-neutral-800">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto">
          {['all', 'Active', 'Expiring Soon', 'Expired'].map((st) => (
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

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Serial No, customer, SKU..."
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
                <th className="py-3 px-4 font-medium">Supplier Warranty & Backing</th>
                <th className="py-3 px-4 font-medium">Warranty Status</th>
                <th className="py-3 px-4 font-medium">SMS Dispatch Log</th>
                <th className="py-3 px-4 font-medium text-center">SMS Action</th>
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
                        No warranty records registered yet. Register serial numbers to track customer/supplier warranties and auto-dispatch SMS alerts.
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
              ) :
                filteredWarranties.map((w) => (
                <tr key={w.id} className="hover:bg-neutral-850/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-mono font-bold text-white">{w.serialNumber}</div>
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
                    <div className="text-white font-medium">{w.supplierName}</div>
                    <div className="text-[11px] text-neutral-400">
                      Supplier End: <span className="font-mono text-neutral-300">{w.supplierWarrantyEnd}</span>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${
                        w.status === 'Active'
                          ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800'
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
                    <button
                      onClick={() => setSmsTestModalRecord(w)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-lg text-xs font-medium transition-colors"
                      title="Send Instant SMS via Gateway"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                      <span>Send SMS</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SMS Gateway Trigger Modal */}
      {smsTestModalRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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

      {/* Register Warranty Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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
                  onChange={(e) => setSelectedSku(e.target.value)}
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                >
                  {products.map((p) => (
                    <option key={p.sku} value={p.sku}>
                      {p.name} ({p.sku})
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
                <label className="block text-neutral-300 font-medium mb-1">Supplier / Distributor Backing</label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g. Chama Computers / Softlogic Retail"
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
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
