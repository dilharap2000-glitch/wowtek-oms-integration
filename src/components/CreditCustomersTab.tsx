'use client';

import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Clock,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Phone,
  Calendar,
  Send,
  Plus,
  ArrowRight,
  FileText,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Receipt,
  Printer,
  History,
  X,
  Building,
  RefreshCw,
} from 'lucide-react';
import { Order, CreditPaymentRecord, CreditCustomerSummary } from '@/types';
import { recordCreditPayment } from '@/lib/db';
import { formatSriLankanPhone } from '@/lib/phoneUtils';
import { A4WarrantyInvoiceModal } from './A4WarrantyInvoiceModal';

interface CreditCustomersTabProps {
  orders: Order[];
  onUpdateOrder?: (id: string, updates: Partial<Order>) => void;
  onNavigateTab?: (tab: string) => void;
}

export const CreditCustomersTab: React.FC<CreditCustomersTabProps> = ({
  orders,
  onUpdateOrder,
  onNavigateTab,
}) => {
  const [viewMode, setViewMode] = useState<'customers' | 'invoices'>('customers');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'overdue' | 'settled'>('open');
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Order | null>(null);
  const [selectedInvoiceForHistory, setSelectedInvoiceForHistory] = useState<Order | null>(null);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Order | null>(null);
  const [expandedCustomerKey, setExpandedCustomerKey] = useState<string | null>(null);

  // Settlement Form State
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentReceiptNumber, setPaymentReceiptNumber] = useState<string>('');
  const [sendSmsReceipt, setSendSmsReceipt] = useState<boolean>(true);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Quick SMS reminder loading state
  const [sendingSmsOrderIds, setSendingSmsOrderIds] = useState<Record<string, boolean>>({});

  // Filter all credit orders (orders marked as credit or having advance/balanceDue tracked)
  const allCreditOrders = useMemo(() => {
    return (orders || []).filter((o) => {
      const isCredit =
        o.isCreditSale === true ||
        o.paymentGateway === 'credit' ||
        (o.paymentGatewayName && o.paymentGatewayName.toLowerCase().includes('credit')) ||
        (o.balanceDue !== undefined && o.balanceDue > 0) ||
        (o.advancePaid !== undefined && o.advancePaid < o.grossTotal);
      return isCredit;
    });
  }, [orders]);

  // Group credit orders by customer phone/name
  const customerSummaries = useMemo(() => {
    const map = new Map<string, CreditCustomerSummary>();

    allCreditOrders.forEach((order) => {
      const phoneKey = order.customerPhone?.trim() || order.customerName?.trim() || 'Unknown';
      const gross = Number(order.grossTotal || 0);
      const paid = Number(order.advancePaid || 0);
      const balance =
        order.balanceDue !== undefined
          ? Number(order.balanceDue)
          : Math.max(0, gross - paid);

      const isOverdue =
        balance > 0 &&
        !!order.creditDueDate &&
        new Date(order.creditDueDate).setHours(23, 59, 59, 999) < Date.now();

      if (!map.has(phoneKey)) {
        map.set(phoneKey, {
          customerName: order.customerName || 'Valued Customer',
          customerPhone: order.customerPhone || '',
          totalOrders: 0,
          totalCreditAmount: 0,
          totalPaidAmount: 0,
          totalBalanceDue: 0,
          earliestDueDate: order.creditDueDate,
          latestDueDate: order.creditDueDate,
          isOverdue: false,
          orders: [],
        });
      }

      const summary = map.get(phoneKey)!;
      summary.totalOrders += 1;
      summary.totalCreditAmount += gross;
      summary.totalPaidAmount += paid;
      summary.totalBalanceDue += balance;
      summary.orders.push(order);

      if (isOverdue) {
        summary.isOverdue = true;
      }

      if (order.creditDueDate) {
        if (!summary.earliestDueDate || new Date(order.creditDueDate) < new Date(summary.earliestDueDate)) {
          summary.earliestDueDate = order.creditDueDate;
        }
        if (!summary.latestDueDate || new Date(order.creditDueDate) > new Date(summary.latestDueDate)) {
          summary.latestDueDate = order.creditDueDate;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      // Sort: overdue first, then highest balance due
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return b.totalBalanceDue - a.totalBalanceDue;
    });
  }, [allCreditOrders]);

  // Overall KPI metrics
  const kpis = useMemo(() => {
    let totalCreditInvoiced = 0;
    let totalPaid = 0;
    let totalBalanceDue = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    let activeCustomerCount = 0;

    customerSummaries.forEach((cust) => {
      if (cust.totalBalanceDue > 0) {
        activeCustomerCount++;
      }
    });

    allCreditOrders.forEach((o) => {
      const gross = Number(o.grossTotal || 0);
      const paid = Number(o.advancePaid || 0);
      const balance =
        o.balanceDue !== undefined ? Number(o.balanceDue) : Math.max(0, gross - paid);

      totalCreditInvoiced += gross;
      totalPaid += paid;
      totalBalanceDue += balance;

      const isOverdue =
        balance > 0 &&
        !!o.creditDueDate &&
        new Date(o.creditDueDate).setHours(23, 59, 59, 999) < Date.now();

      if (isOverdue) {
        overdueCount++;
        overdueAmount += balance;
      }
    });

    return {
      totalCreditInvoiced,
      totalPaid,
      totalBalanceDue,
      overdueCount,
      overdueAmount,
      activeCustomerCount,
    };
  }, [allCreditOrders, customerSummaries]);

  // Filtered Customers
  const filteredCustomers = useMemo(() => {
    return customerSummaries.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.customerName.toLowerCase().includes(q) ||
        c.customerPhone.includes(q) ||
        c.orders.some((o) => o.invoiceNumber?.toLowerCase().includes(q));

      if (!matchSearch) return false;

      if (statusFilter === 'open') return c.totalBalanceDue > 0;
      if (statusFilter === 'overdue') return c.isOverdue && c.totalBalanceDue > 0;
      if (statusFilter === 'settled') return c.totalBalanceDue <= 0;
      return true;
    });
  }, [customerSummaries, searchQuery, statusFilter]);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return allCreditOrders.filter((o) => {
      const gross = Number(o.grossTotal || 0);
      const paid = Number(o.advancePaid || 0);
      const balance =
        o.balanceDue !== undefined ? Number(o.balanceDue) : Math.max(0, gross - paid);
      const isOverdue =
        balance > 0 &&
        !!o.creditDueDate &&
        new Date(o.creditDueDate).setHours(23, 59, 59, 999) < Date.now();

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        o.invoiceNumber?.toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q) ||
        o.customerPhone?.includes(q);

      if (!matchSearch) return false;

      if (statusFilter === 'open') return balance > 0;
      if (statusFilter === 'overdue') return isOverdue;
      if (statusFilter === 'settled') return balance <= 0 || o.creditSettled;
      return true;
    });
  }, [allCreditOrders, searchQuery, statusFilter]);

  // Handler to open Payment Modal
  const handleOpenPaymentModal = (order: Order) => {
    const gross = Number(order.grossTotal || 0);
    const paid = Number(order.advancePaid || 0);
    const balance =
      order.balanceDue !== undefined ? Number(order.balanceDue) : Math.max(0, gross - paid);

    setSelectedInvoiceForPayment(order);
    setPaymentAmount(balance);
    setPaymentMethod('Cash');
    setPaymentNotes('');
    setPaymentReceiptNumber(`RCP-${Math.floor(100000 + Math.random() * 900000)}`);
    setSendSmsReceipt(true);
  };

  // Submit Payment Settlement
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment) return;

    if (paymentAmount <= 0) {
      alert('Please enter a valid payment amount greater than Rs. 0');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const res = await recordCreditPayment(
        selectedInvoiceForPayment.id,
        paymentAmount,
        paymentMethod,
        paymentNotes,
        paymentReceiptNumber,
        'POS Cashier'
      );

      if (res.success && res.order) {
        if (onUpdateOrder) {
          onUpdateOrder(selectedInvoiceForPayment.id, res.order);
        }
        setToastMessage({
          type: 'success',
          text: `Payment of Rs. ${paymentAmount.toLocaleString()} recorded for ${res.order.invoiceNumber}. Remaining: Rs. ${Number(res.order.balanceDue || 0).toLocaleString()}`,
        });
        setSelectedInvoiceForPayment(null);
      } else {
        alert(res.error || 'Failed to record payment');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSubmittingPayment(false);
      setTimeout(() => setToastMessage(null), 6000);
    }
  };

  // Quick SMS reminder trigger
  const handleSendSmsReminder = async (order: Order) => {
    const cleanPhone = order.customerPhone ? formatSriLankanPhone(order.customerPhone) : '';
    if (!cleanPhone || cleanPhone.length < 9) {
      alert('Customer mobile number is missing or invalid.');
      return;
    }

    const gross = Number(order.grossTotal || 0);
    const paid = Number(order.advancePaid || 0);
    const balance =
      order.balanceDue !== undefined ? Number(order.balanceDue) : Math.max(0, gross - paid);

    if (balance <= 0) {
      alert('This invoice has already been fully settled!');
      return;
    }

    const isOverdue =
      !!order.creditDueDate &&
      new Date(order.creditDueDate).setHours(23, 59, 59, 999) < Date.now();

    const formattedDate = order.creditDueDate
      ? new Date(order.creditDueDate).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : 'the agreed date';

    const smsMessage = isOverdue
      ? `WOWTEK URGENT REMINDER: Dear ${order.customerName || 'Customer'}, your credit balance of Rs. ${balance.toLocaleString()} for Invoice ${order.invoiceNumber} was DUE on ${formattedDate} and is now OVERDUE. Please arrange immediate settlement. Helpline: 0779673004.`
      : `WOWTEK REMINDER: Dear ${order.customerName || 'Customer'}, friendly reminder that your balance of Rs. ${balance.toLocaleString()} for Invoice ${order.invoiceNumber} is due on ${formattedDate}. Thank you for choosing WOWTEK! Helpline: 0779673004.`;

    setSendingSmsOrderIds((prev) => ({ ...prev, [order.id]: true }));

    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact: cleanPhone,
          message: smsMessage,
          triggerType: isOverdue ? 'credit_reminder_overdue' : 'credit_reminder',
          referenceId: order.invoiceNumber,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setToastMessage({
          type: 'success',
          text: `SMS Reminder sent to ${cleanPhone} for Invoice ${order.invoiceNumber}`,
        });
      } else {
        alert(`SMS failed: ${data.message || data.error || 'Gateway issue'}`);
      }
    } catch (err: any) {
      alert(`Error sending SMS: ${err.message}`);
    } finally {
      setSendingSmsOrderIds((prev) => ({ ...prev, [order.id]: false }));
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-xl animate-fadeIn ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500 text-rose-200'
          }`}
        >
          <span>{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-neutral-400 hover:text-white ml-3 underline text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-lg">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Credit Customers &amp; Accounts Receivable</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                  ණය පාරිභෝගික කළමනාකරණය
                </span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Track credit balances, initial advances, installment settlements, and automated SMS reminders.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('pos')}
              className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-750 text-white rounded-xl text-xs font-medium border border-neutral-700 transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-purple-400" />
              <span>New POS Sale</span>
            </button>
          )}
        </div>
      </div>

      {/* Financial KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-4 bg-neutral-900 border border-amber-500/30 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-medium text-neutral-400">Total Outstanding Due</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-xl font-bold font-mono text-amber-400">
              Rs. {kpis.totalBalanceDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">
              Unsettled accounts receivable
            </div>
          </div>
        </div>

        <div className="p-4 bg-neutral-900 border border-rose-500/30 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-medium text-rose-300">Overdue Balances</span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-xl font-bold font-mono text-rose-400">
              Rs. {kpis.overdueAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-rose-300/80 mt-0.5 font-medium">
              {kpis.overdueCount} invoice{kpis.overdueCount !== 1 ? 's' : ''} past due date
            </div>
          </div>
        </div>

        <div className="p-4 bg-neutral-900 border border-emerald-500/20 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-medium text-neutral-400">Total Settled / Collected</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400">
              Rs. {kpis.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">
              Advances &amp; installment receipts
            </div>
          </div>
        </div>

        <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-medium text-neutral-400">Total Credit Invoiced</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-xl font-bold font-mono text-white">
              Rs. {kpis.totalCreditInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">
              {allCreditOrders.length} total credit invoice{allCreditOrders.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-sm col-span-2 lg:col-span-1">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-medium text-neutral-400">Active Debtors</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-xl font-bold font-mono text-blue-400">
              {kpis.activeCustomerCount}
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">
              Clients with unpaid balance
            </div>
          </div>
        </div>
      </div>

      {/* View Mode & Filter Controls */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-neutral-900 border border-neutral-800 p-3.5 rounded-2xl">
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex rounded-xl bg-neutral-950 p-1 border border-neutral-800 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('customers')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                viewMode === 'customers'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>By Customer ({customerSummaries.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('invoices')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                viewMode === 'invoices'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>By Invoice ({allCreditOrders.length})</span>
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs">
            {(['open', 'overdue', 'all', 'settled'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`px-2.5 py-1 rounded-lg capitalize transition text-[11px] font-medium ${
                  statusFilter === filter
                    ? 'bg-neutral-800 text-white font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {filter === 'open'
                  ? 'Pending Due'
                  : filter === 'overdue'
                  ? 'Overdue'
                  : filter === 'settled'
                  ? 'Settled'
                  : 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name, phone, invoice #..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 font-sans"
          />
        </div>
      </div>

      {/* VIEW: BY CUSTOMER PROFILE */}
      {viewMode === 'customers' && (
        <div className="space-y-3">
          {filteredCustomers.length === 0 ? (
            <div className="py-16 text-center bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col items-center justify-center p-6">
              <Users className="w-10 h-10 text-neutral-600 mb-2" />
              <h4 className="text-sm font-semibold text-white">No Credit Customers Found</h4>
              <p className="text-xs text-neutral-400 max-w-md mt-1">
                {statusFilter === 'overdue'
                  ? 'Great news! No customers currently have overdue credit balances.'
                  : 'No customer matches your search criteria or no credit sales have been recorded yet.'}
              </p>
            </div>
          ) : (
            filteredCustomers.map((cust) => {
              const customerKey = cust.customerPhone || cust.customerName;
              const isExpanded = expandedCustomerKey === customerKey;

              return (
                <div
                  key={customerKey}
                  className={`bg-neutral-900 border rounded-2xl transition-all shadow-md ${
                    cust.isOverdue
                      ? 'border-rose-500/40 hover:border-rose-500/60'
                      : cust.totalBalanceDue > 0
                      ? 'border-amber-500/30 hover:border-amber-500/50'
                      : 'border-neutral-800'
                  }`}
                >
                  {/* Customer Summary Bar */}
                  <div className="p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2.5 rounded-xl font-bold font-mono text-sm shrink-0 ${
                          cust.isOverdue
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : cust.totalBalanceDue > 0
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {cust.customerName.slice(0, 2).toUpperCase()}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-white">{cust.customerName}</h3>
                          {cust.isOverdue && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                              OVERDUE
                            </span>
                          )}
                          {cust.totalBalanceDue <= 0 && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              SETTLED
                            </span>
                          )}
                          <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-950 text-neutral-400 font-mono">
                            {cust.totalOrders} Credit Invoice{cust.totalOrders !== 1 ? 's' : ''}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-neutral-400 font-mono">
                          {cust.customerPhone && (
                            <span className="flex items-center gap-1 text-purple-400">
                              <Phone className="w-3 h-3" />
                              {cust.customerPhone}
                            </span>
                          )}
                          {cust.earliestDueDate && (
                            <span className="flex items-center gap-1 text-neutral-300">
                              <Calendar className="w-3 h-3 text-neutral-400" />
                              Due:{' '}
                              {new Date(cust.earliestDueDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Financial Figures & Action Buttons */}
                    <div className="flex flex-wrap items-center justify-between lg:justify-end gap-4 w-full lg:w-auto pt-3 lg:pt-0 border-t lg:border-t-0 border-neutral-800">
                      <div className="flex items-center gap-4 text-xs font-mono">
                        <div className="text-left lg:text-right">
                          <div className="text-[10px] text-neutral-400 uppercase">Total Invoiced</div>
                          <div className="text-neutral-300 font-semibold">
                            Rs. {cust.totalCreditAmount.toLocaleString()}
                          </div>
                        </div>

                        <div className="text-left lg:text-right">
                          <div className="text-[10px] text-neutral-400 uppercase">Paid / Advances</div>
                          <div className="text-emerald-400 font-semibold">
                            Rs. {cust.totalPaidAmount.toLocaleString()}
                          </div>
                        </div>

                        <div className="text-left lg:text-right bg-neutral-950 px-3 py-1.5 rounded-xl border border-neutral-800">
                          <div className="text-[10px] text-neutral-400 uppercase">Balance Due</div>
                          <div
                            className={`text-sm font-bold ${
                              cust.isOverdue
                                ? 'text-rose-400'
                                : cust.totalBalanceDue > 0
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            Rs. {cust.totalBalanceDue.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {cust.totalBalanceDue > 0 && cust.orders[0] && (
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentModal(cust.orders[0])}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-900/30 cursor-pointer"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Record Payment</span>
                          </button>
                        )}

                        {cust.totalBalanceDue > 0 && cust.orders[0] && (
                          <button
                            type="button"
                            onClick={() => handleSendSmsReminder(cust.orders[0])}
                            disabled={sendingSmsOrderIds[cust.orders[0].id]}
                            className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700 rounded-xl text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                            title="Send SMS Payment Reminder"
                          >
                            <Send className="w-3.5 h-3.5 text-purple-400" />
                            <span className="hidden sm:inline">SMS</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedCustomerKey(isExpanded ? null : customerKey)
                          }
                          className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
                          title={isExpanded ? 'Collapse invoices' : 'View customer invoices'}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Breakdown: Invoices for this customer */}
                  {isExpanded && (
                    <div className="border-t border-neutral-800 p-4 bg-neutral-950/60 rounded-b-2xl space-y-2.5">
                      <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
                        Credit Invoices &amp; Payment History ({cust.orders.length})
                      </div>

                      <div className="space-y-2">
                        {cust.orders.map((ord) => {
                          const oGross = Number(ord.grossTotal || 0);
                          const oPaid = Number(ord.advancePaid || 0);
                          const oBalance =
                            ord.balanceDue !== undefined ? Number(ord.balanceDue) : Math.max(0, oGross - oPaid);
                          const oOverdue =
                            oBalance > 0 &&
                            !!ord.creditDueDate &&
                            new Date(ord.creditDueDate).setHours(23, 59, 59, 999) < Date.now();

                          return (
                            <div
                              key={ord.id}
                              className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-purple-400">
                                    {ord.invoiceNumber}
                                  </span>
                                  <span className="text-[10px] text-neutral-500">
                                    {new Date(ord.createdAt).toLocaleDateString('en-GB')}
                                  </span>
                                  {oOverdue && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                      Overdue
                                    </span>
                                  )}
                                  {oBalance <= 0 && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                      Fully Settled
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-neutral-400">
                                  Due Date:{' '}
                                  <strong className="text-neutral-300 font-mono">
                                    {ord.creditDueDate
                                      ? new Date(ord.creditDueDate).toLocaleDateString('en-GB')
                                      : 'Not set'}
                                  </strong>
                                  {ord.notes && <span className="ml-2 italic text-neutral-500">({ord.notes})</span>}
                                </div>
                              </div>

                              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                                <div className="font-mono text-right">
                                  <div className="text-[10px] text-neutral-500">
                                    Inv: Rs. {oGross.toLocaleString()} | Paid: Rs. {oPaid.toLocaleString()}
                                  </div>
                                  <div
                                    className={`font-bold ${
                                      oOverdue
                                        ? 'text-rose-400'
                                        : oBalance > 0
                                        ? 'text-amber-400'
                                        : 'text-emerald-400'
                                    }`}
                                  >
                                    Due: Rs. {oBalance.toLocaleString()}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {oBalance > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenPaymentModal(ord)}
                                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition"
                                    >
                                      Settle
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setSelectedInvoiceForHistory(ord)}
                                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                                    title="View Payment Installment History"
                                  >
                                    <History className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedInvoiceForPrint(ord)}
                                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                                    title="View / Print Invoice"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW: BY INVOICE TABLE */}
      {viewMode === 'invoices' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950 border-b border-neutral-800 text-neutral-400 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-3.5">Invoice #</th>
                  <th className="py-3 px-3.5">Date</th>
                  <th className="py-3 px-3.5">Customer</th>
                  <th className="py-3 px-3.5 text-right">Gross Total</th>
                  <th className="py-3 px-3.5 text-right">Paid / Advance</th>
                  <th className="py-3 px-3.5 text-right">Balance Due</th>
                  <th className="py-3 px-3.5">Settlement Due</th>
                  <th className="py-3 px-3.5 text-center">Status</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-sans text-neutral-300">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-neutral-500">
                      No credit invoices found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => {
                    const gross = Number(inv.grossTotal || 0);
                    const paid = Number(inv.advancePaid || 0);
                    const balance =
                      inv.balanceDue !== undefined ? Number(inv.balanceDue) : Math.max(0, gross - paid);
                    const isOverdue =
                      balance > 0 &&
                      !!inv.creditDueDate &&
                      new Date(inv.creditDueDate).setHours(23, 59, 59, 999) < Date.now();

                    return (
                      <tr
                        key={inv.id}
                        className={`hover:bg-neutral-850 transition-colors ${
                          isOverdue ? 'bg-rose-950/15' : ''
                        }`}
                      >
                        <td className="py-3 px-3.5 font-mono font-bold text-purple-400">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-3 px-3.5 font-mono text-neutral-400 text-[11px]">
                          {new Date(inv.createdAt).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="font-semibold text-white">{inv.customerName || 'Customer'}</div>
                          <div className="text-[10px] font-mono text-neutral-400">{inv.customerPhone}</div>
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-medium text-white">
                          Rs. {gross.toLocaleString()}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-emerald-400">
                          Rs. {paid.toLocaleString()}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold">
                          <span
                            className={
                              isOverdue
                                ? 'text-rose-400'
                                : balance > 0
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }
                          >
                            Rs. {balance.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 font-mono text-[11px]">
                          {inv.creditDueDate ? (
                            <span
                              className={
                                isOverdue ? 'text-rose-300 font-semibold flex items-center gap-1' : 'text-neutral-300'
                              }
                            >
                              {isOverdue && <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />}
                              {new Date(inv.creditDueDate).toLocaleDateString('en-GB')}
                            </span>
                          ) : (
                            <span className="text-neutral-500">Not specified</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          {balance <= 0 || inv.creditSettled ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Settled
                            </span>
                          ) : isOverdue ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                              Overdue
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Active Due
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {balance > 0 && (
                              <button
                                type="button"
                                onClick={() => handleOpenPaymentModal(inv)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                                title="Record payment installment"
                              >
                                <CreditCard className="w-3 h-3" />
                                <span>Pay</span>
                              </button>
                            )}

                            {balance > 0 && (
                              <button
                                type="button"
                                onClick={() => handleSendSmsReminder(inv)}
                                disabled={sendingSmsOrderIds[inv.id]}
                                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition"
                                title="Send SMS Payment Reminder"
                              >
                                <Send className="w-3.5 h-3.5 text-purple-400" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setSelectedInvoiceForHistory(inv)}
                              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition"
                              title="Payment History"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedInvoiceForPrint(inv)}
                              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition"
                              title="Print Invoice"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
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
      )}

      {/* RECORD PAYMENT / SETTLEMENT MODAL */}
      {selectedInvoiceForPayment && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Record Credit Settlement / Payment</h3>
                  <p className="text-[11px] text-neutral-400">
                    Invoice: <span className="font-mono text-purple-400">{selectedInvoiceForPayment.invoiceNumber}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoiceForPayment(null)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Invoice & Debtor Summary Box */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-neutral-400">
                <span>Customer:</span>
                <span className="font-semibold text-white">
                  {selectedInvoiceForPayment.customerName} ({selectedInvoiceForPayment.customerPhone})
                </span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Total Invoice Amount:</span>
                <span className="font-mono text-white">
                  Rs. {Number(selectedInvoiceForPayment.grossTotal || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Already Paid to Date:</span>
                <span className="font-mono text-emerald-400">
                  Rs. {Number(selectedInvoiceForPayment.advancePaid || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-neutral-300 font-bold pt-1 border-t border-neutral-800">
                <span>Current Outstanding Due:</span>
                <span className="font-mono text-amber-400 text-sm">
                  Rs.{' '}
                  {(
                    selectedInvoiceForPayment.balanceDue !== undefined
                      ? Number(selectedInvoiceForPayment.balanceDue)
                      : Math.max(0, Number(selectedInvoiceForPayment.grossTotal || 0) - Number(selectedInvoiceForPayment.advancePaid || 0))
                  ).toLocaleString()}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmitPayment} className="space-y-3.5 text-xs">
              {/* Payment Amount */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-neutral-300 font-semibold">Payment Amount (Rs.) *</label>
                  <button
                    type="button"
                    onClick={() => {
                      const bal =
                        selectedInvoiceForPayment.balanceDue !== undefined
                          ? Number(selectedInvoiceForPayment.balanceDue)
                          : Math.max(0, Number(selectedInvoiceForPayment.grossTotal || 0) - Number(selectedInvoiceForPayment.advancePaid || 0));
                      setPaymentAmount(bal);
                    }}
                    className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                  >
                    Set Full Balance
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-neutral-400 font-mono text-xs">Rs.</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={paymentAmount || ''}
                    onChange={(e) => setPaymentAmount(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full pl-10 pr-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                    placeholder="Enter payment amount"
                    required
                  />
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">Payment Method *</label>
                <div className="grid grid-cols-4 gap-2">
                  {['Cash', 'Bank Transfer', 'Card', 'Cheque'].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 px-2 rounded-xl border text-center transition font-semibold text-xs ${
                        paymentMethod === method
                          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200'
                          : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Receipt Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-neutral-400 text-[11px] mb-1">Receipt / Voucher #</label>
                  <input
                    type="text"
                    value={paymentReceiptNumber}
                    onChange={(e) => setPaymentReceiptNumber(e.target.value)}
                    placeholder="RCP-123456"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-neutral-600"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 text-[11px] mb-1">Payment Notes / Reference</label>
                  <input
                    type="text"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="e.g. Paid in cash at store counter"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-neutral-600"
                  />
                </div>
              </div>

              {/* SMS Receipt Checkbox */}
              <div className="flex items-center gap-2 p-3 bg-neutral-950 border border-neutral-800 rounded-xl">
                <input
                  type="checkbox"
                  id="sendSmsCheck"
                  checked={sendSmsReceipt}
                  onChange={(e) => setSendSmsReceipt(e.target.checked)}
                  className="rounded border-neutral-700 text-purple-600 focus:ring-purple-500 w-4 h-4"
                />
                <label htmlFor="sendSmsCheck" className="text-xs text-neutral-300 cursor-pointer">
                  Send automated SMS payment receipt to customer ({selectedInvoiceForPayment.customerPhone || 'phone'})
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceForPayment(null)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-xl transition text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl transition text-xs font-bold shadow-lg shadow-emerald-900/30 flex items-center gap-1.5"
                >
                  {isSubmittingPayment ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirm &amp; Record Payment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAYMENT HISTORY MODAL */}
      {selectedInvoiceForHistory && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Payment Installments History</h3>
                  <p className="text-[11px] text-neutral-400">
                    Invoice: <span className="font-mono text-purple-400">{selectedInvoiceForHistory.invoiceNumber}</span> · Customer: {selectedInvoiceForHistory.customerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoiceForHistory(null)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Installments Table */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {!selectedInvoiceForHistory.creditPaymentHistory || selectedInvoiceForHistory.creditPaymentHistory.length === 0 ? (
                <div className="py-8 text-center text-neutral-500 text-xs">
                  {Number(selectedInvoiceForHistory.advancePaid || 0) > 0 ? (
                    <div>
                      Initial Advance Paid at Checkout: <strong className="text-emerald-400 font-mono">Rs. {Number(selectedInvoiceForHistory.advancePaid).toLocaleString()}</strong>
                      <p className="text-[10px] text-neutral-400 mt-1">No subsequent installment records found.</p>
                    </div>
                  ) : (
                    'No payment installments have been logged for this credit sale yet.'
                  )}
                </div>
              ) : (
                selectedInvoiceForHistory.creditPaymentHistory.map((rec, i) => (
                  <div
                    key={rec.id || i}
                    className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex justify-between items-center text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">Rs. {rec.amount.toLocaleString()}</span>
                        <span className="px-1.5 py-0.2 rounded bg-neutral-900 text-neutral-300 font-mono text-[10px] border border-neutral-800">
                          {rec.paymentMethod}
                        </span>
                        {rec.receiptNumber && (
                          <span className="text-[10px] text-neutral-400 font-mono">
                            Ref: {rec.receiptNumber}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">
                        {new Date(rec.date).toLocaleString('en-GB')}
                        {rec.notes && <span className="text-neutral-500 italic ml-1.5">({rec.notes})</span>}
                      </div>
                    </div>
                    <span className="text-[10px] text-neutral-500 font-mono">{rec.recordedBy || 'POS'}</span>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setSelectedInvoiceForHistory(null)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INVOICE PREVIEW / PRINT MODAL */}
      {selectedInvoiceForPrint && (
        <A4WarrantyInvoiceModal
          order={selectedInvoiceForPrint}
          onClose={() => setSelectedInvoiceForPrint(null)}
        />
      )}
    </div>
  );
};
