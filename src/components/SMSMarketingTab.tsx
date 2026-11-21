'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageSquare,
  Users,
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  UserPlus,
  Trash2,
  Upload,
  Download,
  FileSpreadsheet,
  X,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Tag,
  History,
  CheckCheck,
  RotateCcw,
} from 'lucide-react';
import type { SmsCampaignLog, SmsDeliveryStatus } from '@/lib/serverStore';
import { formatSriLankanPhone, handleLivePhoneInput, isValidSriLankanPhone } from '@/lib/phoneUtils';
import {
  parseCustomerCsv,
  CustomerCsvParseSummary,
  SAMPLE_CUSTOMER_CSV,
} from '@/lib/customerCsv';
import {
  SMS_TEMPLATE_VARIABLES,
  SMS_SUGGESTED_TEMPLATES,
  resolveSmsVariables,
  extractSmsTemplateTokens,
  formatSriLankaSmsDate,
} from '@/lib/smsTemplates';

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

  // Bulk CSV Import States
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkCsvFileName, setBulkCsvFileName] = useState<string>('');
  const [bulkCsvRawText, setBulkCsvRawText] = useState<string>('');
  const [bulkDefaultSource, setBulkDefaultSource] = useState<string>('CSV Import');
  const [bulkPreviewFilter, setBulkPreviewFilter] = useState<'all' | 'valid' | 'invalid'>('all');
  const [bulkParseSummary, setBulkParseSummary] = useState<CustomerCsvParseSummary | null>(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkImportError, setBulkImportError] = useState<string | null>(null);
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);
  const csvFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const messageTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [previewRecipientIdx, setPreviewRecipientIdx] = useState(0);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [varTriggerRange, setVarTriggerRange] = useState<{ start: number; end: number; query: string } | null>(null);
  const [varMenuOpen, setVarMenuOpen] = useState(false);
  const [varHighlightIdx, setVarHighlightIdx] = useState(0);

  // Sent SMS History States
  const [smsHistory, setSmsHistory] = useState<SmsCampaignLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'ALL' | SmsDeliveryStatus>('ALL');
  const [historySearch, setHistorySearch] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

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

  // Fetch Sent SMS History
  const fetchSmsHistory = React.useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch('/api/sms/history');
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load sent SMS history');
      }
      setSmsHistory(Array.isArray(data.logs) ? data.logs : []);
    } catch (err: any) {
      console.error('Error loading SMS history:', err);
      setHistoryError(err?.message || 'Unable to load sent SMS history');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
    fetchSmsHistory();
  }, [fetchCustomers, fetchSmsHistory]);

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
        setConfirmingDelete(false);
        fetchCustomers();
      } else {
        setNotification({ type: 'error', message: 'Error: ' + data.error });
      }
    } catch (err: any) {
      console.error(err);
      setNotification({ type: 'error', message: err?.message || 'Error deleting customers' });
    }
  };

  // Bulk Import CSV Handlers
  const processCsvFile = async (file: File) => {
    setBulkImportError(null);
    if (!file.name.toLowerCase().endsWith('.csv') && file.type && !file.type.includes('csv') && !file.type.includes('text')) {
      setBulkImportError('Please upload a valid .csv file.');
      return;
    }

    try {
      const text = await file.text();
      setBulkCsvFileName(file.name);
      setBulkCsvRawText(text);
      const summary = parseCustomerCsv(text, bulkDefaultSource.trim() || 'CSV Import');
      setBulkParseSummary(summary);
      setBulkPreviewFilter('all');
      if (summary.totalRows === 0) {
        setBulkImportError('The uploaded CSV file has no data rows.');
      }
    } catch (err: any) {
      setBulkImportError(err?.message || 'Failed to read CSV file.');
    }
  };

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processCsvFile(file);
    }
  };

  const handleBulkDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingCsv(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processCsvFile(file);
    }
  };

  const handleBulkSourceChange = (value: string) => {
    setBulkDefaultSource(value);
    if (bulkCsvRawText) {
      setBulkParseSummary(parseCustomerCsv(bulkCsvRawText, value.trim() || 'CSV Import'));
    }
  };

  const handleDownloadSampleCsv = () => {
    const blob = new Blob([SAMPLE_CUSTOMER_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'wowtek-customers-template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleResetBulkImport = () => {
    setBulkCsvFileName('');
    setBulkCsvRawText('');
    setBulkParseSummary(null);
    setBulkImportError(null);
    setBulkPreviewFilter('all');
    if (csvFileInputRef.current) {
      csvFileInputRef.current.value = '';
    }
  };

  const handleConfirmBulkImport = async () => {
    if (!bulkParseSummary || bulkParseSummary.validRows.length === 0) {
      setBulkImportError('No valid Sri Lankan phone numbers available to import.');
      return;
    }

    setBulkImporting(true);
    setBulkImportError(null);

    try {
      const res = await fetch('/api/customers/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customers: bulkParseSummary.validRows.map((row) => ({
            name: row.name,
            phone: row.formattedPhone,
            source: row.source || bulkDefaultSource.trim() || 'CSV Import',
          })),
          defaultSource: bulkDefaultSource.trim() || 'CSV Import',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setBulkImportError(data.error || 'Failed to import customers.');
        return;
      }

      const skippedTotal = bulkParseSummary.invalidRows.length + bulkParseSummary.duplicateRows.length;
      setNotification({
        type: 'success',
        message: `${data.message}${skippedTotal > 0 ? ` (${skippedTotal} invalid/duplicate row(s) skipped)` : ''}`,
      });
      setShowBulkImportModal(false);
      handleResetBulkImport();
      fetchCustomers();
    } catch (err: any) {
      setBulkImportError(err?.message || 'Network error while importing CSV customers.');
    } finally {
      setBulkImporting(false);
    }
  };

  // Target recipients resolved for both live preview and personalized API dispatch
  const targetRecipients = useMemo(() => {
    if (campaignType === 'single') {
      if (!selectedPhone) return [];
      const match = customers.find((c) => c.phone === selectedPhone);
      return [
        {
          name: match?.name || 'Valued Customer',
          phone: selectedPhone,
          source: match?.source || 'WOWTEK',
        },
      ];
    }
    if (campaignType === 'selected') {
      return selectedCustomers.map((p) => {
        const match = customers.find((c) => c.phone === p);
        return {
          name: match?.name || 'Valued Customer',
          phone: p,
          source: match?.source || 'WOWTEK',
        };
      });
    }
    return customers.map((c) => ({
      name: c.name || 'Valued Customer',
      phone: c.phone,
      source: c.source || 'WOWTEK',
    }));
  }, [campaignType, selectedPhone, selectedCustomers, customers]);

  const activePreviewRecipient = useMemo(() => {
    if (targetRecipients.length === 0) {
      return {
        name: 'Kasun Perera',
        phone: '+94771234567',
        source: 'POS',
      };
    }
    const safeIdx = previewRecipientIdx % targetRecipients.length;
    return targetRecipients[safeIdx];
  }, [targetRecipients, previewRecipientIdx]);

  const resolvedPreviewMessage = useMemo(
    () => resolveSmsVariables(message, activePreviewRecipient),
    [message, activePreviewRecipient]
  );

  const usedTemplateTokens = useMemo(() => extractSmsTemplateTokens(message), [message]);

  // Dynamic suggestion list filtered by {{query when typing inside the composer
  const filteredVariableSuggestions = useMemo(() => {
    const q = (varTriggerRange?.query || '').trim().toLowerCase();
    if (!q) return SMS_TEMPLATE_VARIABLES;
    return SMS_TEMPLATE_VARIABLES.filter(
      (v) =>
        v.key.toLowerCase().includes(q) ||
        v.label.toLowerCase().includes(q) ||
        v.token.toLowerCase().includes(q)
    );
  }, [varTriggerRange]);

  const getVariableLiveValue = (key: string): string => {
    const rawName = String(activePreviewRecipient.name || '').trim();
    const resolvedName =
      rawName && rawName.toLowerCase() !== 'walk-in customer' ? rawName : 'Valued Customer';
    if (key === 'name') return resolvedName;
    if (key === 'first_name') {
      return rawName && rawName.toLowerCase() !== 'walk-in customer' ? rawName.split(/\s+/)[0] : 'Customer';
    }
    if (key === 'date') return formatSriLankaSmsDate();
    if (key === 'phone') return activePreviewRecipient.phone || '+94771234567';
    if (key === 'source') return activePreviewRecipient.source || 'WOWTEK';
    return '';
  };

  // Detect `{{query` immediately before cursor to open inline variable autocomplete
  const detectVariableTrigger = (text: string, cursorPos: number) => {
    const uptoCursor = text.slice(0, cursorPos);
    const match = uptoCursor.match(/\{\{([a-zA-Z0-9_]*)$/);
    if (match && match.index !== undefined) {
      setVarTriggerRange({
        start: match.index,
        end: cursorPos,
        query: match[1] || '',
      });
      setVarMenuOpen(true);
      setVarHighlightIdx(0);
    } else {
      setVarTriggerRange(null);
      setVarMenuOpen(false);
    }
  };

  // Insert template variable at cursor (or replace active `{{...` trigger)
  const handleInsertVariable = (token: string, replaceTrigger = false) => {
    const textarea = messageTextareaRef.current;
    if (!textarea) {
      setMessage((prev) => (prev ? `${prev}${prev.endsWith(' ') ? '' : ' '}${token}` : token));
      setVarTriggerRange(null);
      setVarMenuOpen(false);
      return;
    }

    const start =
      replaceTrigger && varTriggerRange
        ? varTriggerRange.start
        : (textarea.selectionStart ?? message.length);
    const end =
      replaceTrigger && varTriggerRange
        ? varTriggerRange.end
        : (textarea.selectionEnd ?? message.length);

    const before = message.slice(0, start);
    const after = message.slice(end);
    const nextValue = `${before}${token}${after}`;
    setMessage(nextValue);
    setVarTriggerRange(null);
    setVarMenuOpen(false);

    requestAnimationFrame(() => {
      if (messageTextareaRef.current) {
        messageTextareaRef.current.focus();
        const cursorPos = start + token.length;
        messageTextareaRef.current.setSelectionRange(cursorPos, cursorPos);
      }
    });
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    const cursor = e.target.selectionStart ?? nextVal.length;
    setMessage(nextVal);
    detectVariableTrigger(nextVal, cursor);
  };

  const handleMessageKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!varMenuOpen || filteredVariableSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setVarHighlightIdx((prev) => (prev + 1) % filteredVariableSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setVarHighlightIdx((prev) =>
        prev === 0 ? filteredVariableSuggestions.length - 1 : prev - 1
      );
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const chosen =
        filteredVariableSuggestions[varHighlightIdx] || filteredVariableSuggestions[0];
      if (chosen) {
        handleInsertVariable(chosen.token, Boolean(varTriggerRange));
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setVarMenuOpen(false);
      setVarTriggerRange(null);
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
          type: campaignType,
          recipients:
            campaignType === 'single'
              ? targetRecipients[0] || { phone: selectedPhone }
              : campaignType === 'selected'
              ? targetRecipients
              : null,
          message: message.trim(),
        }),
      });

      const data = await res.json();
      if (data.campaignLog) {
        const newLog = data.campaignLog as SmsCampaignLog;
        setSmsHistory((prev) => [newLog, ...prev.filter((item) => item.id !== newLog.id)]);
      }
      if (data.success) {
        const count =
          data.recipientsCount ??
          (campaignType === 'single'
            ? 1
            : campaignType === 'selected'
            ? selectedCustomers.length
            : customers.length);
        const samplePreview = data.dispatchedPreviews?.[0]?.renderedMessage;
        setNotification({
          type: 'success',
          message: `SMS Sent Successfully! Personalized & dispatched to ${count} recipient(s).${
            samplePreview ? ` Sample: "${samplePreview}"` : ''
          }`,
        });
        setMessage('');
      } else {
        setNotification({ type: 'error', message: 'Error: ' + (data.message || 'Failed to dispatch SMS') });
      }
      fetchSmsHistory();
    } catch (error: any) {
      console.error(error);
      setNotification({ type: 'error', message: 'Network error sending SMS: ' + (error?.message || 'Check connection') });
    } finally {
      setLoading(false);
    }
  };

  const formatHistoryTimestamp = (iso: string): string => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso || '-';
      return d.toLocaleString('en-GB', {
        timeZone: 'Asia/Colombo',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return iso || '-';
    }
  };

  const historyStatusCounts = useMemo(() => {
    return {
      total: smsHistory.length,
      sent: smsHistory.filter((l) => l.status === 'Sent').length,
      delivered: smsHistory.filter((l) => l.status === 'Delivered').length,
      failed: smsHistory.filter((l) => l.status === 'Failed').length,
    };
  }, [smsHistory]);

  const filteredSmsHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return smsHistory.filter((log) => {
      if (historyStatusFilter !== 'ALL' && log.status !== historyStatusFilter) {
        return false;
      }
      if (!q) return true;
      const recipientMatch = Array.isArray(log.recipients)
        ? log.recipients.some(
            (r) =>
              r.name?.toLowerCase().includes(q) ||
              r.phone?.toLowerCase().includes(q) ||
              r.renderedMessage?.toLowerCase().includes(q)
          )
        : false;
      return (
        log.messageTemplate?.toLowerCase().includes(q) ||
        log.previewMessage?.toLowerCase().includes(q) ||
        log.campaignType?.toLowerCase().includes(q) ||
        log.senderId?.toLowerCase().includes(q) ||
        recipientMatch
      );
    });
  }, [smsHistory, historyStatusFilter, historySearch]);

  const handleReuseHistoryTemplate = (templateText: string) => {
    setMessage(templateText);
    setVarMenuOpen(false);
    setVarTriggerRange(null);
    requestAnimationFrame(() => {
      messageTextareaRef.current?.focus();
      messageTextareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone?.includes(searchQuery) ||
      c.source?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 text-[var(--text-primary)]">
      {/* Header & CRM Overview Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[var(--border-subtle)] gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-purple-500/15 text-[var(--accent-primary)] dark:text-purple-300 border border-teal-200 dark:border-purple-500/30 shadow-sm">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-wide flex items-center gap-2">
                <span>SMS Marketing &amp; Customer CRM</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--badge-ready-bg)] text-[var(--badge-ready-text)] border border-emerald-500/20">
                  SMSlenz Gateway Active
                </span>
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Targeted SMS campaigns, de-duplicated Sri Lankan contact directory, and automated promotional broadcasts.
              </p>
            </div>
          </div>
        </div>

        {/* Quick KPI Counters & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-mono">
            <Users className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span className="text-[var(--text-secondary)]">Total Contacts:</span>
            <span className="text-[var(--text-primary)] font-bold">{customers.length}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setBulkImportError(null);
              setShowBulkImportModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-xs text-white font-semibold transition cursor-pointer shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Bulk Import CSV</span>
          </button>
          <button
            type="button"
            onClick={fetchCustomers}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] transition cursor-pointer shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {notification && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs animate-fadeIn shadow-sm ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-500/40 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs px-2 py-0.5 rounded cursor-pointer"
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
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Send className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Dispatch Promotional SMS</span>
              </h2>
              <span className="text-[10px] bg-teal-50 dark:bg-purple-500/15 text-[var(--accent-primary)] dark:text-purple-300 border border-teal-200 dark:border-purple-500/30 px-2 py-0.5 rounded-full font-mono font-semibold">
                Sender: WOWTEK
              </span>
            </div>

            <form onSubmit={handleSendSMS} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[var(--text-primary)] font-semibold mb-1.5">Audience Target</label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-subtle)] text-[11px]">
                  <button
                    type="button"
                    onClick={() => setCampaignType('single')}
                    className={`py-1.5 px-2 rounded-lg font-medium transition cursor-pointer text-center truncate ${
                      campaignType === 'single'
                        ? 'bg-[var(--accent-primary)] text-white font-bold shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Single
                  </button>
                  <button
                    type="button"
                    onClick={() => setCampaignType('selected')}
                    className={`py-1.5 px-2 rounded-lg font-medium transition cursor-pointer text-center truncate ${
                      campaignType === 'selected'
                        ? 'bg-[var(--accent-primary)] text-white font-bold shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Selected ({selectedCustomers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCampaignType('bulk')}
                    className={`py-1.5 px-2 rounded-lg font-medium transition cursor-pointer text-center truncate ${
                      campaignType === 'bulk'
                        ? 'bg-[var(--accent-primary)] text-white font-bold shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    All ({customers.length})
                  </button>
                </div>
              </div>

              {campaignType === 'single' && (
                <div>
                  <label className="block text-[var(--text-secondary)] font-medium mb-1">Select Target Recipient</label>
                  <select
                    value={selectedPhone}
                    onChange={(e) => setSelectedPhone(e.target.value)}
                    className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] font-mono"
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
                <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-purple-950/30 border border-teal-200 dark:border-purple-500/30 text-[11px] text-teal-800 dark:text-purple-200 flex items-center justify-between">
                  <span>
                    <strong>{selectedCustomers.length}</strong> contacts checked in customer list.
                  </span>
                  {selectedCustomers.length === 0 && (
                    <span className="text-[var(--badge-pending-text)] text-[10px]">Select via checkboxes</span>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-[var(--text-primary)] font-semibold">Message Content</label>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)] font-mono tabular-nums">
                    <span>{resolvedPreviewMessage.length} chars</span>
                    <span aria-hidden="true">·</span>
                    <span>{Math.max(1, Math.ceil(resolvedPreviewMessage.length / 160))} SMS</span>
                  </div>
                </div>

                {/* Textarea with anchored inline {{ variable suggestion popover */}
                <div className="relative">
                  <textarea
                    ref={messageTextareaRef}
                    rows={4}
                    value={message}
                    onChange={handleMessageChange}
                    onKeyDown={handleMessageKeyDown}
                    onClick={(e) =>
                      detectVariableTrigger(
                        e.currentTarget.value,
                        e.currentTarget.selectionStart ?? e.currentTarget.value.length
                      )
                    }
                    placeholder="Write your message here — type {{ to insert customer variables like {{first_name}} or {{date}}..."
                    className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl p-3 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:outline-none focus:border-[var(--accent-primary)] text-xs resize-none leading-relaxed"
                    required
                  />

                  {varMenuOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[11px] text-[var(--text-secondary)]">
                        <span className="font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                          <span>Personalization Variables</span>
                        </span>
                        <span className="font-mono text-[10px]">↑↓ Navigate · Enter to insert · Esc</span>
                      </div>
                      {filteredVariableSuggestions.length === 0 ? (
                        <div className="px-3 py-2.5 text-xs text-[var(--text-secondary)]">
                          No matching variable for &ldquo;{varTriggerRange?.query}&rdquo;
                        </div>
                      ) : (
                        <div className="divide-y divide-[var(--border-subtle)] max-h-52 overflow-y-auto">
                          {filteredVariableSuggestions.map((v, idx) => {
                            const isHighlighted = idx === varHighlightIdx;
                            return (
                              <button
                                key={v.key}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleInsertVariable(v.token, Boolean(varTriggerRange));
                                }}
                                onMouseEnter={() => setVarHighlightIdx(idx)}
                                className={`w-full px-3 py-2 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                                  isHighlighted
                                    ? 'bg-teal-50 dark:bg-emerald-500/15 text-[var(--text-primary)]'
                                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="font-mono text-[11px] text-[var(--accent-primary)] font-semibold shrink-0">
                                    {v.token}
                                  </span>
                                  <span className="text-xs text-[var(--text-primary)] truncate">{v.label}</span>
                                </div>
                                <span className="text-[11px] font-mono tabular-nums text-[var(--text-secondary)] truncate max-w-[140px]">
                                  {getVariableLiveValue(v.key)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Clean single-line variable quick-insert toolbar (unboxed, zero pills) */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-[11px]">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[var(--text-secondary)]">
                    <button
                      type="button"
                      onClick={() => {
                        setVarTriggerRange(null);
                        setVarMenuOpen((prev) => !prev);
                        setVarHighlightIdx(0);
                      }}
                      className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Tag className="w-3 h-3" />
                      <span>Variables:</span>
                    </button>
                    {SMS_TEMPLATE_VARIABLES.map((v) => {
                      const isActive = usedTemplateTokens.includes(v.token.toLowerCase());
                      return (
                        <button
                          key={v.key}
                          type="button"
                          onClick={() => handleInsertVariable(v.token, false)}
                          title={`${v.label}: ${v.description}`}
                          className={`font-mono cursor-pointer transition-colors ${
                            isActive
                              ? 'text-[var(--accent-primary)] underline underline-offset-4 font-semibold'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {v.token}
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-[var(--text-secondary)] font-mono whitespace-nowrap">
                    Type {'{{'} for menu
                  </span>
                </div>
              </div>

              {/* Hairline-Separated Live Personalized Preview */}
              {message.trim().length > 0 && (
                <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 text-[var(--text-primary)] font-medium">
                      <Eye className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      <span>
                        Preview{targetRecipients.length === 0 ? ' (Sample)' : ''}
                      </span>
                      <span aria-hidden="true" className="text-[var(--text-secondary)]">·</span>
                      <span className="text-[var(--text-secondary)] font-mono truncate max-w-[165px]">
                        {activePreviewRecipient.name} · {activePreviewRecipient.phone}
                      </span>
                    </div>

                    {targetRecipients.length > 1 && (
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] font-mono tabular-nums text-[var(--text-secondary)] mr-1">
                          {(previewRecipientIdx % targetRecipients.length) + 1}/{targetRecipients.length}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewRecipientIdx((prev) =>
                              prev === 0 ? targetRecipients.length - 1 : prev - 1
                            )
                          }
                          className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer transition-colors"
                          aria-label="Previous recipient preview"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewRecipientIdx((prev) => (prev + 1) % targetRecipients.length)
                          }
                          className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer transition-colors"
                          aria-label="Next recipient preview"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                    {resolvedPreviewMessage}
                  </p>
                </div>
              )}

              {/* Hairline-Separated Suggested Templates List */}
              <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-primary)] font-semibold">Suggested Templates</span>
                  <span className="text-[var(--text-secondary)]">Click to apply</span>
                </div>
                <div className="divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-xl overflow-hidden bg-[var(--bg-app)]">
                  {SMS_SUGGESTED_TEMPLATES.map((tpl) => {
                    const isSelectedTemplate = message.trim() === tpl.body.trim();
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => {
                          setMessage(tpl.body);
                          setVarMenuOpen(false);
                          setVarTriggerRange(null);
                        }}
                        className={`w-full px-3 py-2 text-left transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                          isSelectedTemplate
                            ? 'bg-teal-50 dark:bg-emerald-500/15 text-[var(--text-primary)]'
                            : 'hover:bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold text-[var(--text-primary)]">
                            {tpl.title}
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
                            {resolveSmsVariables(tpl.body, activePreviewRecipient)}
                          </div>
                        </div>
                        <span className="text-[10px] font-medium text-[var(--accent-primary)] shrink-0">
                          {isSelectedTemplate ? 'Applied' : 'Use'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || (campaignType === 'bulk' && customers.length === 0)}
                className="w-full py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-40 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer text-xs active:scale-[0.99] mt-2"
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
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                <span>Add Walk-In / Phone Contact</span>
              </h2>
              <span className="text-[10px] bg-pink-50 dark:bg-pink-500/15 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-500/30 px-2 py-0.5 rounded-full font-mono">
                Direct Sync
              </span>
            </div>

            <form onSubmit={handleAddManualCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--text-secondary)] font-medium mb-1">Customer Full Name</label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g. Kasun Chamara"
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[var(--text-secondary)] font-medium">Sri Lankan Phone Number *</label>
                  <span className="text-[10px] text-pink-600 dark:text-pink-400 font-mono">Auto +94</span>
                </div>
                <input
                  type="text"
                  value={manualPhone}
                  onChange={handlePhoneChange}
                  onBlur={handlePhoneBlur}
                  placeholder="0715330724 (auto-converts to +94715330724)"
                  required
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 font-mono focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
              <button
                type="submit"
                disabled={manualLoading}
                className="w-full py-2.5 bg-[var(--bg-subtle)] hover:opacity-90 text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                {manualLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Contact...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
                    <span>Save to Customer Directory</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setBulkImportError(null);
                  setShowBulkImportModal(true);
                }}
                className="w-full py-2 bg-[var(--badge-ready-bg)] hover:opacity-90 text-[var(--badge-ready-text)] border border-emerald-500/20 rounded-xl font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-2"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Bulk Import Customers via CSV</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Saved Customers Directory & Management (7 cols) */}
        <div className="lg:col-span-7 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-[var(--accent-primary)]" />
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                Saved Contacts Directory ({customers.length})
              </h2>
              {selectedCustomers.length > 0 && (
                <span className="text-[10px] bg-teal-50 dark:bg-purple-500/20 text-[var(--accent-primary)] dark:text-purple-300 border border-teal-200 dark:border-purple-500/40 px-2 py-0.5 rounded-full font-mono font-bold">
                  {selectedCustomers.length} selected
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setBulkImportError(null);
                  setShowBulkImportModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--badge-ready-bg)] hover:bg-[var(--accent-primary)] text-[var(--badge-ready-text)] hover:text-white border border-emerald-500/30 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Bulk Import</span>
              </button>

              {selectedCustomers.length > 0 && !confirmingDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 dark:bg-rose-600/20 hover:bg-rose-600 text-rose-700 dark:text-rose-300 hover:text-white border border-rose-300 dark:border-rose-500/40 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete ({selectedCustomers.length})</span>
                </button>
              )}
              {selectedCustomers.length > 0 && confirmingDelete && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Confirm ({selectedCustomers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="px-2.5 py-1.5 bg-[var(--bg-subtle)] hover:opacity-80 text-[var(--text-primary)] rounded-xl text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}

              <div className="relative w-48 sm:w-52">
                <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
            </div>
          </div>

          {/* Select All Row */}
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
            <label className="flex items-center gap-2.5 cursor-pointer font-medium">
              <input
                type="checkbox"
                onChange={handleSelectAll}
                checked={customers.length > 0 && selectedCustomers.length === customers.length}
                className="w-4 h-4 rounded border-[var(--border-subtle)] accent-[var(--accent-primary)] cursor-pointer"
              />
              <span className="text-[var(--text-primary)] text-xs">Select All ({customers.length})</span>
            </label>
            <span className="text-[11px] text-[var(--text-secondary)] font-mono">
              Use checkboxes to batch-select for targeted broadcast
            </span>
          </div>

          {/* Customer List Table */}
          <div className="overflow-x-auto max-h-[580px] overflow-y-auto rounded-xl border border-[var(--border-subtle)]">
            <table className="w-full text-left text-xs text-[var(--text-primary)]">
              <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] sticky top-0 text-[var(--text-secondary)] text-[10px] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Phone Number</th>
                  <th className="py-3 px-3">Source Channel</th>
                  <th className="py-3 px-3 text-center">Orders</th>
                  <th className="py-3 px-3 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-[var(--text-secondary)] text-xs">
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
                        className={`hover:bg-[var(--bg-subtle)]/60 transition-colors ${
                          isChecked ? 'bg-teal-50/70 dark:bg-purple-950/20' : ''
                        }`}
                      >
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSelect(c.phone)}
                            className="w-4 h-4 rounded border-[var(--border-subtle)] accent-[var(--accent-primary)] cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3 font-semibold text-[var(--text-primary)]">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-teal-50 dark:bg-purple-600/25 text-[var(--accent-primary)] dark:text-purple-300 flex items-center justify-center font-bold text-[11px] border border-teal-200 dark:border-purple-500/30">
                              {(c.name || 'C').charAt(0).toUpperCase()}
                            </div>
                            <span>{c.name || 'Walk-in Customer'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-[var(--accent-primary)] font-semibold text-xs">
                          {c.phone}
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[10px] bg-[var(--bg-subtle)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-full text-[var(--text-secondary)] font-mono">
                            {c.source || 'POS'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-pink-600 dark:text-pink-400">
                          {c.totalOrders ?? 1}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPhone(c.phone);
                              setCampaignType('single');
                            }}
                            className="text-xs text-[var(--accent-primary)] hover:text-white bg-teal-50 dark:bg-purple-600/20 hover:bg-[var(--accent-primary)] px-2.5 py-1 rounded-lg border border-teal-200 dark:border-purple-500/30 transition-all font-semibold cursor-pointer shadow-sm"
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

      {/* SENT SMS HISTORY & CAMPAIGN DELIVERY LOG */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <History className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Sent SMS History</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)] font-mono tabular-nums">
              <span>{historyStatusCounts.total} Campaigns</span>
              <span aria-hidden="true">·</span>
              <span className="text-indigo-600 dark:text-indigo-300">{historyStatusCounts.sent} Sent</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-700 dark:text-emerald-400">{historyStatusCounts.delivered} Delivered</span>
              <span aria-hidden="true">·</span>
              <span className="text-rose-700 dark:text-rose-400">{historyStatusCounts.failed} Failed</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Segmented Filter */}
            <div className="flex items-center gap-1 p-1 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-subtle)] text-[11px]">
              {(['ALL', 'Sent', 'Delivered', 'Failed'] as const).map((statusOption) => (
                <button
                  key={statusOption}
                  type="button"
                  onClick={() => setHistoryStatusFilter(statusOption)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    historyStatusFilter === statusOption
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {statusOption === 'ALL' ? 'All' : statusOption}
                </button>
              ))}
            </div>

            {/* History Search */}
            <div className="relative w-52 sm:w-60">
              <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search message or phone..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>

            <button
              type="button"
              onClick={fetchSmsHistory}
              disabled={historyLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-subtle)] hover:opacity-85 border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[var(--accent-primary)] ${historyLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {historyError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-500/40 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{historyError}</span>
            </div>
            <button
              type="button"
              onClick={fetchSmsHistory}
              className="px-3 py-1 rounded-lg bg-rose-600 text-white font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {historyLoading && smsHistory.length === 0 ? (
          <div className="space-y-2 py-2" aria-label="Loading sent SMS history">
            {[0, 1, 2].map((skeletonIdx) => (
              <div
                key={skeletonIdx}
                className="h-11 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] animate-pulse"
              />
            ))}
          </div>
        ) : filteredSmsHistory.length === 0 ? (
          <div className="py-12 px-4 text-center border border-[var(--border-subtle)] rounded-xl bg-[var(--bg-app)] space-y-3">
            <p className="text-xs text-[var(--text-secondary)]">
              {smsHistory.length === 0
                ? 'No SMS campaigns have been dispatched yet. Sent, Delivered, and Failed campaign logs will appear here with timestamps.'
                : 'No campaign logs match the selected status filter or search query.'}
            </p>
            <div>
              {smsHistory.length === 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    messageTextareaRef.current?.focus();
                    messageTextareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className="px-4 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Compose First Campaign
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setHistoryStatusFilter('ALL');
                    setHistorySearch('');
                  }}
                  className="px-4 py-2 rounded-xl bg-[var(--bg-subtle)] hover:opacity-80 text-[var(--text-primary)] text-xs font-medium transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[460px] overflow-y-auto rounded-xl border border-[var(--border-subtle)]">
            <table className="w-full text-left text-xs text-[var(--text-primary)]">
              <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] sticky top-0 text-[var(--text-secondary)] text-[11px] font-semibold">
                <tr>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Timestamp</th>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Campaign</th>
                  <th className="py-2.5 px-3.5">Message</th>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Delivery Status</th>
                  <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filteredSmsHistory.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const campaignLabel =
                    log.campaignType === 'bulk'
                      ? 'Bulk Broadcast'
                      : log.campaignType === 'selected'
                      ? 'Selected Batch'
                      : 'Single Recipient';

                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="hover:bg-[var(--bg-subtle)]/60 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-3.5 font-mono tabular-nums text-[var(--text-secondary)] whitespace-nowrap">
                          {formatHistoryTimestamp(log.timestamp)}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="text-[var(--text-primary)] font-medium">{campaignLabel}</div>
                          <div className="text-[11px] text-[var(--text-secondary)] font-mono tabular-nums mt-0.5">
                            {log.recipientsCount} {log.recipientsCount === 1 ? 'recipient' : 'recipients'} · {log.senderId}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 max-w-md">
                          <div className="text-[var(--text-primary)] truncate">{log.previewMessage || log.messageTemplate}</div>
                          {log.messageTemplate && log.messageTemplate !== log.previewMessage && (
                            <div className="text-[11px] text-[var(--text-secondary)] font-mono truncate mt-0.5">
                              Template: {log.messageTemplate}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 font-medium">
                            {log.status === 'Delivered' ? (
                              <>
                                <CheckCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span className="text-emerald-700 dark:text-emerald-400">Delivered</span>
                              </>
                            ) : log.status === 'Failed' ? (
                              <>
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                                <span className="text-rose-700 dark:text-rose-400">Failed</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                <span className="text-indigo-700 dark:text-indigo-300">Sent</span>
                              </>
                            )}
                          </div>
                          {log.recipientsCount > 1 && (
                            <div className="text-[10px] font-mono tabular-nums text-[var(--text-secondary)] mt-0.5">
                              {log.deliveredCount > 0 ? `${log.deliveredCount} delivered` : `${log.sentCount} sent`}
                              {log.failedCount > 0 ? ` · ${log.failedCount} failed` : ''}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          <div
                            className="inline-flex items-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleReuseHistoryTemplate(log.messageTemplate || log.previewMessage)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-subtle)] hover:opacity-85 text-[var(--text-primary)] text-[11px] font-medium transition-colors cursor-pointer"
                              title="Load this message into composer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reuse</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--bg-app)] hover:bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-[11px] transition-colors cursor-pointer"
                              aria-expanded={isExpanded}
                            >
                              <span>{isExpanded ? 'Hide' : 'Details'}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-[var(--bg-app)]">
                          <td colSpan={5} className="px-4 py-3.5 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[var(--border-subtle)] text-[11px]">
                              <div className="text-[var(--text-secondary)]">
                                <span className="mr-1.5">Template:</span>
                                <span className="text-[var(--text-primary)]">{log.messageTemplate}</span>
                              </div>
                              <span className="font-mono tabular-nums text-[var(--text-secondary)] shrink-0">
                                ID: {log.id}
                              </span>
                            </div>

                            {Array.isArray(log.recipients) && log.recipients.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-[11px] text-[var(--text-primary)]">
                                  <thead className="text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">
                                    <tr>
                                      <th className="py-1.5 pr-3 font-medium">Recipient</th>
                                      <th className="py-1.5 px-3 font-medium">Phone</th>
                                      <th className="py-1.5 px-3 font-medium">Status</th>
                                      <th className="py-1.5 pl-3 font-medium">Personalized Message</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[var(--border-subtle)]">
                                    {log.recipients.map((rec, recIdx) => (
                                      <tr key={`${log.id}-${rec.phone}-${recIdx}`}>
                                        <td className="py-2 pr-3 font-medium text-[var(--text-primary)] whitespace-nowrap">
                                          {rec.name || 'Valued Customer'}
                                        </td>
                                        <td className="py-2 px-3 font-mono tabular-nums text-[var(--accent-primary)] whitespace-nowrap">
                                          {rec.phone}
                                        </td>
                                        <td className="py-2 px-3 whitespace-nowrap">
                                          <span
                                            className={`inline-flex items-center gap-1 font-medium ${
                                              rec.status === 'Delivered'
                                                ? 'text-emerald-700 dark:text-emerald-400'
                                                : rec.status === 'Failed'
                                                ? 'text-rose-700 dark:text-rose-400'
                                                : 'text-indigo-700 dark:text-indigo-300'
                                            }`}
                                          >
                                            {rec.status === 'Delivered' ? (
                                              <CheckCheck className="w-3 h-3" />
                                            ) : rec.status === 'Failed' ? (
                                              <AlertCircle className="w-3 h-3" />
                                            ) : (
                                              <CheckCircle2 className="w-3 h-3" />
                                            )}
                                            <span>{rec.status}</span>
                                          </span>
                                        </td>
                                        <td className="py-2 pl-3 text-[var(--text-secondary)]">
                                          <div>{rec.renderedMessage}</div>
                                          {rec.gatewayMessage && rec.status === 'Failed' && (
                                            <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5">
                                              {rec.gatewayMessage}
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-[11px] text-[var(--text-secondary)]">
                                No individual recipient records captured for this entry.
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* BULK CSV IMPORT MODAL WITH SRI LANKAN PHONE VALIDATION */}
      {showBulkImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-4xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">Bulk Import Customers (CSV)</h3>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    Upload a CSV with <span className="font-mono text-[var(--text-primary)]">name, phone, source</span> columns. Validates &amp; normalizes Sri Lankan numbers (e.g. <span className="font-mono text-emerald-700 dark:text-emerald-300">0771234567</span> → <span className="font-mono text-emerald-700 dark:text-emerald-300">+94771234567</span>).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkImportModal(false)}
                className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition cursor-pointer"
                aria-label="Close bulk import modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Top Controls: Dropzone + Sample Download + Source Tag */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingCsv(true);
                  }}
                  onDragLeave={() => setIsDraggingCsv(false)}
                  onDrop={handleBulkDrop}
                  onClick={() => csvFileInputRef.current?.click()}
                  className={`md:col-span-8 p-5 rounded-xl border-2 border-dashed transition cursor-pointer flex flex-col items-center justify-center text-center gap-2 ${
                    isDraggingCsv
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-app)] hover:border-emerald-500/60 hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  <input
                    ref={csvFileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleBulkFileChange}
                    className="hidden"
                  />
                  <Upload className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  {bulkCsvFileName ? (
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-[var(--text-primary)]">{bulkCsvFileName}</p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400">Click or drop another CSV file to replace</p>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-[var(--text-primary)]">
                        Drop your customer CSV file here, or <span className="text-[var(--accent-primary)] underline">browse</span>
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Accepts 07XXXXXXXX, +947XXXXXXXX, 947XXXXXXXX, 00947XXXXXXXX, or Sri Lankan fixed-line numbers
                      </p>
                    </div>
                  )}
                </div>

                <div className="md:col-span-4 flex flex-col justify-between gap-3 p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs">
                  <div>
                    <label className="block text-[var(--text-primary)] font-semibold mb-1.5">Default Source Tag</label>
                    <input
                      type="text"
                      value={bulkDefaultSource}
                      onChange={(e) => handleBulkSourceChange(e.target.value)}
                      placeholder="CSV Import"
                      className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadSampleCsv}
                    className="w-full py-2 px-3 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Download Sample CSV</span>
                  </button>
                </div>
              </div>

              {bulkImportError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-500/40 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>{bulkImportError}</span>
                </div>
              )}

              {/* Validation Summary & Preview Table */}
              {bulkParseSummary && bulkParseSummary.totalRows > 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                      <span className="text-[var(--text-secondary)] block text-[11px]">Total Parsed Rows</span>
                      <span className="text-lg font-bold font-mono text-[var(--text-primary)]">{bulkParseSummary.totalRows}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30">
                      <span className="text-emerald-800 dark:text-emerald-300 block text-[11px]">Valid Sri Lankan</span>
                      <span className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400">{bulkParseSummary.validRows.length}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30">
                      <span className="text-rose-800 dark:text-rose-300 block text-[11px]">Invalid Phone Format</span>
                      <span className="text-lg font-bold font-mono text-rose-700 dark:text-rose-400">{bulkParseSummary.invalidRows.length}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/30">
                      <span className="text-amber-800 dark:text-amber-300 block text-[11px]">Duplicates in CSV</span>
                      <span className="text-lg font-bold font-mono text-amber-700 dark:text-amber-400">{bulkParseSummary.duplicateRows.length}</span>
                    </div>
                  </div>

                  {/* Preview Filter Tabs */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setBulkPreviewFilter('all')}
                        className={`px-3 py-1 rounded-lg font-medium cursor-pointer transition ${
                          bulkPreviewFilter === 'all'
                            ? 'bg-purple-600 text-white'
                            : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        All ({bulkParseSummary.totalRows})
                      </button>
                      <button
                        type="button"
                        onClick={() => setBulkPreviewFilter('valid')}
                        className={`px-3 py-1 rounded-lg font-medium cursor-pointer transition ${
                          bulkPreviewFilter === 'valid'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        Valid ({bulkParseSummary.validRows.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setBulkPreviewFilter('invalid')}
                        className={`px-3 py-1 rounded-lg font-medium cursor-pointer transition ${
                          bulkPreviewFilter === 'invalid'
                            ? 'bg-rose-600 text-white'
                            : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        Rejected ({bulkParseSummary.invalidRows.length + bulkParseSummary.duplicateRows.length})
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleResetBulkImport}
                      className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline cursor-pointer"
                    >
                      Clear File
                    </button>
                  </div>

                  {/* Preview Table */}
                  <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-xl border border-[var(--border-subtle)]">
                    <table className="w-full text-left text-xs text-[var(--text-primary)]">
                      <thead className="bg-[var(--bg-subtle)] text-[var(--text-secondary)] text-[10px] uppercase font-mono sticky top-0 border-b border-[var(--border-subtle)]">
                        <tr>
                          <th className="py-2.5 px-3">Row</th>
                          <th className="py-2.5 px-3">Customer Name</th>
                          <th className="py-2.5 px-3">Raw Phone</th>
                          <th className="py-2.5 px-3">Normalized (+94)</th>
                          <th className="py-2.5 px-3">Source</th>
                          <th className="py-2.5 px-3">Validation Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {bulkParseSummary.rows
                          .filter((row) => {
                            if (bulkPreviewFilter === 'valid') return row.isValid;
                            if (bulkPreviewFilter === 'invalid') return !row.isValid;
                            return true;
                          })
                          .slice(0, 200)
                          .map((row) => (
                            <tr
                              key={`${row.rowNumber}-${row.rawPhone}`}
                              className={row.isValid ? 'hover:bg-[var(--bg-subtle)]/50' : 'bg-rose-50/60 dark:bg-rose-950/15'}
                            >
                              <td className="py-2 px-3 font-mono text-[var(--text-secondary)]">#{row.rowNumber}</td>
                              <td className="py-2 px-3 font-medium text-[var(--text-primary)]">{row.name}</td>
                              <td className="py-2 px-3 font-mono text-[var(--text-secondary)]">{row.rawPhone || '-'}</td>
                              <td className="py-2 px-3 font-mono text-purple-700 dark:text-purple-300 font-semibold">
                                {row.isValid ? row.formattedPhone : '-'}
                              </td>
                              <td className="py-2 px-3 text-[var(--text-secondary)]">{row.source}</td>
                              <td className="py-2 px-3">
                                {row.isValid ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/70 text-[10px] font-mono">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Valid SL
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-700/70 text-[10px] font-mono">
                                    <AlertCircle className="w-3 h-3" />
                                    {row.error}
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
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
              <span className="text-[11px] text-[var(--text-secondary)]">
                Existing contacts matching the same <span className="font-mono text-[var(--text-primary)]">+94</span> number will be updated cleanly without duplicates.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkImportModal(false)}
                  className="px-4 py-2 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={bulkImporting || !bulkParseSummary || bulkParseSummary.validRows.length === 0}
                  onClick={handleConfirmBulkImport}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-lg"
                >
                  {bulkImporting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Importing Customers...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        Import {bulkParseSummary ? bulkParseSummary.validRows.length : 0} Valid Customer(s)
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
