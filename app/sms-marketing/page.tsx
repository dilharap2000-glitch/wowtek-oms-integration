'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Trash2,
  UserPlus,
  Users,
  Search,
  X,
} from 'lucide-react';
import { formatSriLankanPhone, handleLivePhoneInput, isValidSriLankanPhone } from '@/lib/phoneUtils';
import { parseCsvMatrix, SAMPLE_CUSTOMER_CSV } from '@/lib/customerCsv';
import { ThemeSwitcher } from '@/src/components/ThemeSwitcher';

interface CustomerRecord {
  _id?: string;
  name?: string;
  phone: string;
  source?: string;
}

interface MappedCsvRow {
  rowNumber: number;
  name: string;
  rawPhone: string;
  formattedPhone: string;
  isValid: boolean;
  isDuplicate: boolean;
  reason?: string;
}

const NAME_HEADER_HINTS = ['name', 'customername', 'fullname', 'customer', 'clientname', 'firstname'];
const PHONE_HEADER_HINTS = [
  'phone',
  'phonenumber',
  'mobile',
  'mobilenumber',
  'tel',
  'telephone',
  'contact',
  'contactnumber',
  'whatsapp',
];

function normalizeHeaderKey(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, '');
}

export default function SmsMarketingPage() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

  // Manual Customer Form States
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Search Filter State
  const [searchQuery, setSearchQuery] = useState('');

  // Inline Banner & Delete Confirmation States (iframe-safe, no window.alert/confirm)
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Bulk CSV Import States
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvMatrix, setCsvMatrix] = useState<string[][]>([]);
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [nameColumnIdx, setNameColumnIdx] = useState<number>(-1);
  const [phoneColumnIdx, setPhoneColumnIdx] = useState<number>(0);
  const [importing, setImporting] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  // Fetch Customers
  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      if (data.success) setCustomers(data.customers || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Filtered Customers by Name or Phone Number (supports local 07X and +947X queries)
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers;

    const cleanDigits = q.replace(/[\s\-()+]/g, '');
    const intlDigits = cleanDigits.startsWith('0') && cleanDigits.length > 1
      ? `94${cleanDigits.slice(1)}`
      : cleanDigits;

    return customers.filter((c) => {
      const nameMatch = (c.name || '').toLowerCase().includes(q);
      const rawPhone = (c.phone || '').toLowerCase();
      const phoneDigits = rawPhone.replace(/[\s\-()+]/g, '');
      const phoneMatch =
        rawPhone.includes(q) ||
        (cleanDigits.length > 0 &&
          (phoneDigits.includes(cleanDigits) || phoneDigits.includes(intlDigits)));
      return nameMatch || phoneMatch;
    });
  }, [customers, searchQuery]);

  const allFilteredSelected =
    filteredCustomers.length > 0 &&
    filteredCustomers.every((c) => selectedCustomers.includes(c.phone));

  // Checkbox Selection Logic
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const visiblePhones = filteredCustomers.map((c) => c.phone);
    if (e.target.checked) {
      setSelectedCustomers((prev) => Array.from(new Set([...prev, ...visiblePhones])));
    } else {
      const visibleSet = new Set(visiblePhones);
      setSelectedCustomers((prev) => {
        const next = prev.filter((p) => !visibleSet.has(p));
        if (next.length === 0) setConfirmingDelete(false);
        return next;
      });
    }
  };

  const handleToggleSelect = (phone: string) => {
    setConfirmingDelete(false);
    if (selectedCustomers.includes(phone)) {
      setSelectedCustomers(selectedCustomers.filter((p) => p !== phone));
    } else {
      setSelectedCustomers([...selectedCustomers, phone]);
    }
  };

  // Live Phone Input Change Handler (Auto +94 on typing "0" or spaces/hyphens cleanup)
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = handleLivePhoneInput(e.target.value);
    setManualPhone(formatted);
    if (phoneError) setPhoneError(null);
  };

  const handlePhoneBlur = () => {
    if (manualPhone.trim()) {
      const formatted = formatSriLankanPhone(manualPhone);
      setManualPhone(formatted);
      if (!isValidSriLankanPhone(formatted)) {
        setPhoneError('වලංගු ශ්‍රී ලාංකික දුරකථන අංකයක් ඇතුළත් කරන්න (e.g. 0715330724 හෝ +94715330724)');
      } else {
        setPhoneError(null);
      }
    }
  };

  // Manual Customer Add Handler
  const handleAddManualCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPhone.trim()) {
      setPhoneError('දුරකථන අංකයක් ඇතුළත් කරන්න!');
      return;
    }

    const formattedPhone = formatSriLankanPhone(manualPhone);
    if (!isValidSriLankanPhone(formattedPhone)) {
      setPhoneError('කරුණාකර වලංගු ශ්‍රී ලාංකික අංකයක් (e.g. 0715330724 හෝ +94715330724) ඇතුළත් කරන්න.');
      return;
    }

    setPhoneError(null);
    setStatusBanner(null);
    setLoading(true);
    try {
      const res = await fetch('/api/customers/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: manualName.trim(), phone: formattedPhone, source: 'Manual Add' }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusBanner({
          type: 'success',
          message: `Customer successfully added with phone: ${data.phone || formattedPhone}`,
        });
        setManualName('');
        setManualPhone('');
        fetchCustomers();
      } else {
        setPhoneError(data.error || 'Failed to add customer');
      }
    } catch (err: unknown) {
      console.error(err);
      setPhoneError(err instanceof Error ? err.message : 'Error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Delete Selected Customers Handler
  const handleDeleteSelected = async () => {
    if (selectedCustomers.length === 0) return;

    setDeleting(true);
    setStatusBanner(null);
    try {
      const res = await fetch('/api/customers/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phones: selectedCustomers }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusBanner({
          type: 'success',
          message: `Removed ${selectedCustomers.length} selected customer(s).`,
        });
        setSelectedCustomers([]);
        setConfirmingDelete(false);
        fetchCustomers();
      } else {
        setStatusBanner({ type: 'error', message: data.error || 'Failed to delete selected customers.' });
      }
    } catch (err: unknown) {
      console.error(err);
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error deleting customers.',
      });
    } finally {
      setDeleting(false);
    }
  };

  // CSV File Upload & Header Auto-Detection
  const handleCsvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvError(null);
    setStatusBanner(null);

    try {
      const text = await file.text();
      const matrix = parseCsvMatrix(text);

      if (matrix.length === 0) {
        setCsvError('The selected CSV file is empty.');
        setCsvMatrix([]);
        setCsvFileName(file.name);
        return;
      }

      const firstRow = matrix[0];
      const normalizedHeaders = firstRow.map(normalizeHeaderKey);
      const detectedName = normalizedHeaders.findIndex((h) => NAME_HEADER_HINTS.includes(h));
      const detectedPhone = normalizedHeaders.findIndex((h) => PHONE_HEADER_HINTS.includes(h));
      const looksLikeHeader = detectedName !== -1 || detectedPhone !== -1;

      setHasHeaderRow(looksLikeHeader);

      if (looksLikeHeader) {
        setNameColumnIdx(detectedName);
        if (detectedPhone !== -1) {
          setPhoneColumnIdx(detectedPhone);
        } else {
          setPhoneColumnIdx(firstRow.length > 1 ? (detectedName === 0 ? 1 : 0) : 0);
        }
      } else {
        // Positional defaults for headerless CSVs
        if (firstRow.length === 1) {
          setNameColumnIdx(-1);
          setPhoneColumnIdx(0);
        } else {
          setNameColumnIdx(0);
          setPhoneColumnIdx(1);
        }
      }

      setCsvMatrix(matrix);
      setCsvFileName(file.name);
    } catch (err: unknown) {
      setCsvError(err instanceof Error ? err.message : 'Failed to parse CSV file.');
    }
  };

  const resetCsvImport = () => {
    setCsvFileName(null);
    setCsvMatrix([]);
    setCsvError(null);
    setNameColumnIdx(-1);
    setPhoneColumnIdx(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadSampleCsv = () => {
    const blob = new Blob([SAMPLE_CUSTOMER_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample-customers.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Column options derived from CSV matrix width
  const columnOptions = useMemo(() => {
    if (csvMatrix.length === 0) return [];
    const maxCols = Math.max(...csvMatrix.map((row) => row.length));
    const headerRow = csvMatrix[0] || [];
    return Array.from({ length: maxCols }, (_, idx) => ({
      index: idx,
      label: hasHeaderRow && headerRow[idx] ? `${headerRow[idx]} (Column ${idx + 1})` : `Column ${idx + 1}`,
    }));
  }, [csvMatrix, hasHeaderRow]);

  // Validation layer mapping selected columns -> name & phone, filtering invalid Sri Lankan numbers
  const parsedValidation = useMemo(() => {
    if (csvMatrix.length === 0) {
      return {
        allRows: [] as MappedCsvRow[],
        validRows: [] as MappedCsvRow[],
        invalidRows: [] as MappedCsvRow[],
        duplicateRows: [] as MappedCsvRow[],
      };
    }

    const dataRows = hasHeaderRow ? csvMatrix.slice(1) : csvMatrix;
    const seenPhones = new Set<string>();
    const allRows: MappedCsvRow[] = [];

    dataRows.forEach((cols, idx) => {
      const rowNumber = hasHeaderRow ? idx + 2 : idx + 1;
      const rawName = nameColumnIdx >= 0 ? (cols[nameColumnIdx] || '').trim() : '';
      const rawPhone = phoneColumnIdx >= 0 ? (cols[phoneColumnIdx] || '').trim() : '';

      if (!rawName && !rawPhone) return;

      if (!rawPhone) {
        allRows.push({
          rowNumber,
          name: rawName || 'CSV Customer',
          rawPhone: '',
          formattedPhone: '',
          isValid: false,
          isDuplicate: false,
          reason: 'Missing phone number',
        });
        return;
      }

      const formattedPhone = formatSriLankanPhone(rawPhone);
      if (!isValidSriLankanPhone(formattedPhone)) {
        allRows.push({
          rowNumber,
          name: rawName || 'CSV Customer',
          rawPhone,
          formattedPhone,
          isValid: false,
          isDuplicate: false,
          reason: 'Invalid Sri Lankan phone number (expected 07XXXXXXXX or +947XXXXXXXX)',
        });
        return;
      }

      const isDuplicate = seenPhones.has(formattedPhone);
      if (!isDuplicate) {
        seenPhones.add(formattedPhone);
      }

      allRows.push({
        rowNumber,
        name: rawName || 'CSV Customer',
        rawPhone,
        formattedPhone,
        isValid: !isDuplicate,
        isDuplicate,
        reason: isDuplicate ? `Duplicate in CSV (${formattedPhone})` : undefined,
      });
    });

    return {
      allRows,
      validRows: allRows.filter((r) => r.isValid),
      invalidRows: allRows.filter((r) => !r.isValid && !r.isDuplicate),
      duplicateRows: allRows.filter((r) => r.isDuplicate),
    };
  }, [csvMatrix, hasHeaderRow, nameColumnIdx, phoneColumnIdx]);

  // Execute Bulk Import for validated Sri Lankan numbers only
  const handleBulkImportSubmit = async () => {
    if (parsedValidation.validRows.length === 0) {
      setCsvError('No valid Sri Lankan phone numbers available to import.');
      return;
    }

    setImporting(true);
    setCsvError(null);
    setStatusBanner(null);

    try {
      const payloadCustomers = parsedValidation.validRows.map((row) => ({
        name: row.name,
        phone: row.formattedPhone,
        source: 'CSV Import',
      }));

      const res = await fetch('/api/customers/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customers: payloadCustomers,
          defaultSource: 'CSV Import',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setCsvError(data.error || 'Bulk import failed.');
        return;
      }

      const filteredCount = parsedValidation.invalidRows.length + parsedValidation.duplicateRows.length;
      setStatusBanner({
        type: 'success',
        message: `${data.message || `Imported ${data.importedCount} customer(s).`}${
          filteredCount > 0 ? ` (${filteredCount} invalid/duplicate row(s) filtered out before import)` : ''
        }`,
      });
      resetCsvImport();
      await fetchCustomers();
    } catch (err: unknown) {
      setCsvError(err instanceof Error ? err.message : 'Bulk import request failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-6 text-[var(--text-primary)] bg-[var(--bg-app)] min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-purple-600 dark:text-purple-400">SMS Marketing &amp; Customer Database</h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Manage customers manually or bulk import CSV lists with Sri Lankan (+94) validation.
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <ThemeSwitcher />
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3 py-2 rounded-lg shadow-sm">
              <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Total Contacts:</span>
              <span className="font-bold text-[var(--text-primary)]">{customers.length}</span>
            </div>
          </div>
        </div>

        {statusBanner && (
          <div
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm ${
              statusBanner.type === 'success'
                ? 'bg-[var(--badge-ready-bg)] border-teal-200 dark:border-emerald-700/60 text-[var(--badge-ready-text)]'
                : 'bg-rose-50 dark:bg-red-950/50 border-rose-200 dark:border-red-700/60 text-rose-700 dark:text-red-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {statusBanner.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-red-400 shrink-0" />
              )}
              <span>{statusBanner.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              aria-label="Dismiss message"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Manual Customer Add Form */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 rounded-xl shadow-sm">
            <h2 className="text-lg font-semibold mb-3 text-pink-600 dark:text-pink-400 flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              <span>Add Manual Customer / Phone</span>
            </h2>
            <form onSubmit={handleAddManualCustomer} className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Customer Name</label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g. Nimal Perera"
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded p-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs text-[var(--text-secondary)]">Phone Number *</label>
                  <span className="text-[10px] text-pink-600 dark:text-pink-400 font-mono">Format: +947XXXXXXXX</span>
                </div>
                <input
                  type="text"
                  value={manualPhone}
                  onChange={handlePhoneChange}
                  onBlur={handlePhoneBlur}
                  placeholder="0715330724 (auto-converts to +94715330724)"
                  required
                  className={`w-full bg-[var(--bg-app)] border ${
                    phoneError ? 'border-red-500' : 'border-[var(--border-subtle)]'
                  } rounded p-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 font-mono focus:outline-none focus:border-[var(--accent-primary)]`}
                />
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                  Numbers starting with <span className="text-pink-600 dark:text-pink-300 font-mono">0</span> automatically convert to{' '}
                  <span className="text-emerald-600 dark:text-green-400 font-mono">+94</span>.
                </p>
                {phoneError && <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-medium">{phoneError}</p>}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded font-bold text-sm hover:opacity-90 disabled:opacity-50 cursor-pointer transition shadow-sm"
              >
                {loading ? 'Adding...' : 'Save Customer'}
              </button>
            </form>
          </div>

          {/* Right: Saved Customers List with Selection & Delete */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 rounded-xl flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                <h2 className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                  Saved Customers ({searchQuery.trim() ? `${filteredCustomers.length} / ${customers.length}` : customers.length})
                </h2>
                {selectedCustomers.length > 0 && !confirmingDelete && (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Selected ({selectedCustomers.length})</span>
                  </button>
                )}
                {selectedCustomers.length > 0 && confirmingDelete && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDeleteSelected}
                      disabled={deleting}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition cursor-pointer disabled:opacity-50"
                    >
                      {deleting ? 'Deleting...' : `Confirm Delete (${selectedCustomers.length})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className="px-2.5 py-1 bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] rounded text-xs text-[var(--text-primary)] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Search Bar */}
              <div className="relative mb-3">
                <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search customers by name or phone number..."
                  aria-label="Search customers by name or phone number"
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg pl-9 pr-9 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:outline-none focus:border-[var(--accent-primary)] transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-0.5 rounded cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Select All Checkbox */}
              <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={allFilteredSelected}
                    disabled={filteredCustomers.length === 0}
                    className="rounded border-[var(--border-subtle)] accent-purple-600 cursor-pointer disabled:opacity-50"
                  />
                  <span>Select All{searchQuery.trim() ? ` (${filteredCustomers.length})` : ''}</span>
                </label>
                {searchQuery.trim() && (
                  <span>
                    Showing {filteredCustomers.length} of {customers.length}
                  </span>
                )}
              </div>

              {/* Customer List */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {customers.length === 0 ? (
                  <div className="p-6 text-center text-[var(--text-secondary)] text-sm">
                    No customers found. Add your first customer using the form or bulk CSV import below.
                  </div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="p-6 text-center text-[var(--text-secondary)] text-sm space-y-2">
                    <p>No customers match &ldquo;{searchQuery.trim()}&rdquo;.</p>
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  filteredCustomers.map((c, idx) => (
                    <div
                      key={c._id || c.phone || idx}
                      className="flex items-center justify-between bg-[var(--bg-app)] p-2.5 rounded border border-[var(--border-subtle)] text-sm hover:bg-[var(--bg-subtle)] transition"
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={selectedCustomers.includes(c.phone)}
                          onChange={() => handleToggleSelect(c.phone)}
                          className="rounded border-[var(--border-subtle)] accent-purple-600 cursor-pointer"
                        />
                        <div>
                          <p className="font-semibold text-[var(--text-primary)]">{c.name || 'Walk-in Customer'}</p>
                          <p className="text-xs text-[var(--text-secondary)] font-mono">{c.phone}</p>
                        </div>
                      </div>
                      <span className="text-[10px] bg-[var(--bg-subtle)] px-2 py-0.5 rounded text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                        {c.source || 'POS'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bulk CSV Import Section */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 rounded-xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                <span>Bulk Import Customers (CSV)</span>
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Upload a CSV file, map columns to <span className="text-[var(--text-primary)] font-mono">name</span> and{' '}
                <span className="text-[var(--text-primary)] font-mono">phone</span>, and automatically filter out invalid Sri Lankan numbers.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadSampleCsv}
                className="px-3 py-1.5 bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-lg text-xs font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Sample CSV</span>
              </button>
              {csvFileName && (
                <button
                  type="button"
                  onClick={resetCsvImport}
                  className="px-3 py-1.5 bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-lg text-xs font-medium text-[var(--text-primary)] inline-flex items-center gap-1 cursor-pointer transition"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* File Input */}
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-subtle)] hover:border-pink-500/70 bg-[var(--bg-app)] rounded-xl p-6 cursor-pointer transition">
            <Upload className="w-7 h-7 text-pink-600 dark:text-pink-400 mb-2" />
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {csvFileName ? `Selected file: ${csvFileName}` : 'Choose a CSV file to upload'}
            </span>
            <span className="text-xs text-[var(--text-secondary)] mt-1">
              Supports formats like 0715330724, +94715330724, 94771234567, or 011 234 5678
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvFileUpload}
              className="hidden"
            />
          </label>

          {csvError && (
            <div className="flex items-center gap-2 bg-rose-50 dark:bg-red-950/50 border border-rose-200 dark:border-red-700/60 text-rose-700 dark:text-red-200 text-xs px-3 py-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-red-400 shrink-0" />
              <span>{csvError}</span>
            </div>
          )}

          {csvMatrix.length > 0 && (
            <div className="space-y-4">
              {/* Column Mapping Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[var(--bg-app)] border border-[var(--border-subtle)] p-4 rounded-xl">
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">Map Name Column</label>
                  <select
                    value={nameColumnIdx}
                    onChange={(e) => setNameColumnIdx(Number(e.target.value))}
                    className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded p-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  >
                    <option value={-1}>None (Default: CSV Customer)</option>
                    {columnOptions.map((col) => (
                      <option key={col.index} value={col.index}>
                        {col.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">Map Phone Column *</label>
                  <select
                    value={phoneColumnIdx}
                    onChange={(e) => setPhoneColumnIdx(Number(e.target.value))}
                    className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded p-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  >
                    {columnOptions.map((col) => (
                      <option key={col.index} value={col.index}>
                        {col.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-xs text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded p-2 w-full cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasHeaderRow}
                      onChange={(e) => setHasHeaderRow(e.target.checked)}
                      className="rounded border-[var(--border-subtle)] accent-purple-600 cursor-pointer"
                    />
                    <span>First row contains headers</span>
                  </label>
                </div>
              </div>

              {/* Validation Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg p-3">
                  <p className="text-[11px] text-[var(--text-secondary)]">Total Parsed Rows</p>
                  <p className="text-lg font-bold text-[var(--text-primary)]">{parsedValidation.allRows.length}</p>
                </div>
                <div className="bg-[var(--badge-ready-bg)] border border-teal-200 dark:border-emerald-800/60 rounded-lg p-3">
                  <p className="text-[11px] text-[var(--badge-ready-text)]">Valid Sri Lankan Numbers</p>
                  <p className="text-lg font-bold text-[var(--badge-ready-text)]">{parsedValidation.validRows.length}</p>
                </div>
                <div className="bg-rose-50 dark:bg-red-950/30 border border-rose-200 dark:border-red-800/60 rounded-lg p-3">
                  <p className="text-[11px] text-rose-700 dark:text-red-300">Invalid (Filtered Out)</p>
                  <p className="text-lg font-bold text-rose-600 dark:text-red-400">{parsedValidation.invalidRows.length}</p>
                </div>
                <div className="bg-[var(--badge-pending-bg)] border border-amber-200 dark:border-amber-800/60 rounded-lg p-3">
                  <p className="text-[11px] text-[var(--badge-pending-text)]">Duplicates (Skipped)</p>
                  <p className="text-lg font-bold text-[var(--badge-pending-text)]">{parsedValidation.duplicateRows.length}</p>
                </div>
              </div>

              {/* Validation Preview Table */}
              {parsedValidation.allRows.length > 0 && (
                <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden">
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--bg-subtle)] text-[var(--text-secondary)] sticky top-0">
                        <tr>
                          <th className="px-3 py-2 font-medium">Row</th>
                          <th className="px-3 py-2 font-medium">Mapped Name</th>
                          <th className="px-3 py-2 font-medium">Raw Phone</th>
                          <th className="px-3 py-2 font-medium">Normalized (+94)</th>
                          <th className="px-3 py-2 font-medium">Validation Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--bg-surface)]">
                        {parsedValidation.allRows.map((row) => (
                          <tr
                            key={`${row.rowNumber}-${row.rawPhone}`}
                            className={row.isValid ? '' : 'bg-rose-50 dark:bg-red-950/20 text-[var(--text-secondary)]'}
                          >
                            <td className="px-3 py-2 font-mono text-[var(--text-secondary)]">#{row.rowNumber}</td>
                            <td className="px-3 py-2 text-[var(--text-primary)]">{row.name}</td>
                            <td className="px-3 py-2 font-mono">{row.rawPhone || '—'}</td>
                            <td className="px-3 py-2 font-mono text-emerald-700 dark:text-emerald-300">
                              {row.isValid ? row.formattedPhone : '—'}
                            </td>
                            <td className="px-3 py-2">
                              {row.isValid ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Valid
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-red-400">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  {row.reason}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                <p className="text-xs text-[var(--text-secondary)]">
                  Only the <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{parsedValidation.validRows.length}</span>{' '}
                  validated Sri Lankan customer record(s) will be imported.
                </p>
                <button
                  type="button"
                  onClick={handleBulkImportSubmit}
                  disabled={parsedValidation.validRows.length === 0 || importing}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-40 cursor-pointer transition shadow-sm inline-flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>
                    {importing
                      ? 'Importing Customers...'
                      : `Import ${parsedValidation.validRows.length} Valid Customer${
                          parsedValidation.validRows.length === 1 ? '' : 's'
                        }`}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

