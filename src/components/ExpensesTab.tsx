import React, { useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  PieChart,
  Plus,
  Search,
  Filter,
  ArrowDownRight,
  ArrowUpRight,
  Layers,
  X,
  CreditCard,
  Building,
} from 'lucide-react';
import { ExpenseItem, ExpenseCategory, Order } from '@/lib/types';

interface ExpensesTabProps {
  expenses: ExpenseItem[];
  orders: Order[];
  onAddExpense: (expense: ExpenseItem) => void;
}

export const ExpensesTab: React.FC<ExpensesTabProps> = ({ expenses, orders, onAddExpense }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // New expense form state
  const [category, setCategory] = useState<ExpenseCategory>('Operational');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(25000);
  const [channel, setChannel] = useState<'General' | 'WooCommerce' | 'PickMe' | 'Uber Eats'>('General');
  const [reference, setReference] = useState('');

  // Safe array bindings
  const safeOrders = orders || [];
  const safeExpenses = expenses || [];

  // Financial calculations
  const totalGrossRevenue = safeOrders.reduce((sum, o) => sum + (o?.grossTotal || 0), 0);
  const totalCogs = safeOrders.reduce((sum, o) => sum + (o?.costOfGoods || 0), 0);
  const totalCommissions = safeOrders.reduce(
    (sum, o) => sum + (o?.platformFeeAmount || 0) + (o?.gatewayFeeAmount || 0),
    0
  );
  const totalCourierFees = safeOrders.reduce((sum, o) => sum + (o?.courierFee || 0), 0);
  const totalExpenses = safeExpenses.reduce((sum, e) => sum + (e?.amount || 0), 0);

  // Net Business Operating Profit
  const netBusinessProfit = totalGrossRevenue - totalCogs - totalCommissions - totalCourierFees - totalExpenses;

  // Channel breakdown
  const wcGross = safeOrders.filter((o) => o?.channel === 'woocommerce').reduce((s, o) => s + (o?.grossTotal || 0), 0);
  const pkmGross = safeOrders.filter((o) => o?.channel === 'pickme').reduce((s, o) => s + (o?.grossTotal || 0), 0);
  const ubrGross = safeOrders.filter((o) => o?.channel === 'ubereats').reduce((s, o) => s + (o?.grossTotal || 0), 0);

  const filteredExpenses = safeExpenses.filter((e) => {
    if (!e) return false;
    const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
    const matchesSearch =
      (e.description || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (e.reference || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (e.category || '').toLowerCase().includes((searchQuery || '').toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const newExp: ExpenseItem = {
      id: `exp-${Date.now().toString().slice(-4)}`,
      category,
      description,
      amount,
      date: new Date().toISOString().split('T')[0],
      channel,
      reference: reference || `EXP-${Math.floor(1000 + Math.random() * 9000)}`,
    };

    onAddExpense(newExp);
    setShowAddModal(false);
    setDescription('');
    setReference('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Financials & Expense Ledger</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Gross Revenue vs Net Operating Profit, channel commissions, and detailed expense categorization.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Log New Expense</span>
        </button>
      </div>

      {/* Financial Analytics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-2">
            Gross Invoiced Revenue
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white">
            Rs. {totalGrossRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-neutral-400 mt-2">
            All 3 channels (WooCommerce, PickMe, Uber)
          </div>
        </div>

        <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-2">
            Cost of Goods (COGS)
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-neutral-300">
            Rs. {totalCogs.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-neutral-400 mt-2">Direct stock import unit cost</div>
        </div>

        <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-2">
            Operating & Ledger Expenses
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-400">
            Rs. {totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-neutral-400 mt-2">{expenses.length} logged ledger entries</div>
        </div>

        <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-2">
            Net Business Balance
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
            Rs. {netBusinessProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-neutral-400 mt-2">After all commissions & logged costs</div>
        </div>
      </div>

      {/* Channel Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-white">WooCommerce Website</span>
            <span className="font-mono text-purple-400">0% Comm</span>
          </div>
          <div className="text-lg font-bold font-mono text-white">
            Rs. {wcGross.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-neutral-400 mt-1">Direct payment gateway & Trans Express COD</div>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-white">PickMe Market / Food</span>
            <span className="font-mono text-amber-400">-12% Comm</span>
          </div>
          <div className="text-lg font-bold font-mono text-white">
            Rs. {pkmGross.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-neutral-400 mt-1">Automated 12% deduction per linehaul invoice</div>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-white">Uber Eats Retail</span>
            <span className="font-mono text-amber-400">-12% Comm</span>
          </div>
          <div className="text-lg font-bold font-mono text-white">
            Rs. {ubrGross.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-neutral-400 mt-1">Weekly merchant settlement directly reconciled</div>
        </div>
      </div>

      {/* Expense Filter & Table */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between p-3 rounded-xl bg-neutral-900 border border-neutral-800">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto">
          {['all', 'Stock Purchases', 'Operational', 'Logistics', 'Platform Fees', 'Staff & Utility'].map(
            (c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  categoryFilter === c
                    ? 'bg-purple-600 text-white'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                }`}
              >
                {c === 'all' ? 'All Categories' : c}
              </button>
            )
          )}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search description, reference..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Expense Table */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-950/60 text-neutral-400">
                <th className="py-3 px-4 font-medium">Date & Reference</th>
                <th className="py-3 px-4 font-medium">Category</th>
                <th className="py-3 px-4 font-medium">Description</th>
                <th className="py-3 px-4 font-medium">Channel Allocation</th>
                <th className="py-3 px-4 font-medium text-right">Amount (LKR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/80">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <DollarSign className="w-10 h-10 text-neutral-600 mb-1" />
                      <p className="font-semibold text-white text-sm">No Ledger Expenses Logged</p>
                      <p className="text-xs text-neutral-400">
                        Track inventory imports, utility bills, courier costs, and operational payouts to maintain accurate business ledger balances.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowAddModal(true)}
                        className="mt-2 flex items-center gap-2 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Log First Expense</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                (filteredExpenses || []).map((exp) => (
                  <tr key={exp.id} className="hover:bg-neutral-850/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono text-white font-medium">{exp.reference}</div>
                      <div className="text-[11px] text-neutral-400">{exp.date}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="text-purple-300 font-medium">{exp.category}</span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-white">{exp.description}</div>
                    </td>

                    <td className="py-3 px-4 text-neutral-300">
                      {exp.channel}
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-white">
                      Rs. {exp.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950">
              <h3 className="text-sm font-semibold text-white">Log Operational / Stock Expense</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Expense Category</label>
                  <select
                    value={category}
                    onChange={(e: any) => setCategory(e.target.value)}
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                  >
                    <option value="Stock Purchases">Stock Purchases</option>
                    <option value="Operational">Operational</option>
                    <option value="Logistics">Logistics</option>
                    <option value="Platform Fees">Platform Fees</option>
                    <option value="Staff & Utility">Staff & Utility</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Channel Association</label>
                  <select
                    value={channel}
                    onChange={(e: any) => setChannel(e.target.value)}
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                  >
                    <option value="General">General / All</option>
                    <option value="WooCommerce">WooCommerce Website</option>
                    <option value="PickMe">PickMe Market</option>
                    <option value="Uber Eats">Uber Eats</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Description</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Courier plastic flyers & thermal label rolls"
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Amount (LKR)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Reference / Voucher No</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. INV-2026-9901"
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
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
                  Save to Financial Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
