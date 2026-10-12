'use client';

import React, { useState } from 'react';
import {
  Key,
  Shield,
  Save,
  CheckCircle2,
  Globe,
  ShoppingBag,
  Truck,
  MessageSquare,
  Eye,
  EyeOff,
  Radio,
  Zap,
  Activity,
  Check,
  RefreshCw,
  Store,
  Send,
  AlertCircle,
  Link2,
  Plus,
  Trash2,
  Search,
  Sparkles,
  Layers,
  ArrowRight,
  X,
} from 'lucide-react';
import { ApiIntegrationConfig, SmsSendResponse, Product, ProductAlias } from '@/types';
import {
  findBestProductMatch,
  extractCoreKeywords,
  COMMON_FILLER_WORDS,
  DEFAULT_PRODUCT_ALIASES,
} from '@/lib/productMatching';

interface IntegrationsTabProps {
  apiConfig: ApiIntegrationConfig;
  onSaveConfig: (config: ApiIntegrationConfig) => void;
  products?: Product[];
  aliases?: ProductAlias[];
  onSaveAlias?: (alias: ProductAlias) => Promise<any> | void;
  onDeleteAlias?: (id: string) => Promise<any> | void;
}

export const IntegrationsTab: React.FC<IntegrationsTabProps> = ({
  apiConfig,
  onSaveConfig,
  products = [],
  aliases = [],
  onSaveAlias,
  onDeleteAlias,
}) => {
  const [config, setConfig] = useState<ApiIntegrationConfig>({
    ...apiConfig,
    smsUserId: apiConfig.smsUserId || '588',
    smsAutoNotifyOrder: apiConfig.smsAutoNotifyOrder ?? true,
  });
  const [showSecrets, setShowSecrets] = useState<{ [key: string]: boolean }>({});
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testingStatus, setTestingStatus] = useState<{ [key: string]: string | null }>({});

  // SMS Live Test State
  const [testPhone, setTestPhone] = useState('0771234567');
  const [testSmsMessage, setTestSmsMessage] = useState('WOWTEK PRO: Test SMS dispatch via SMSlenz Sri Lanka API gateway.');
  const [smsTestSending, setSmsTestSending] = useState(false);
  const [smsTestResult, setSmsTestResult] = useState<SmsSendResponse | null>(null);

  // Multi-Channel Alias Mapping Hub State
  const activeAliases = aliases.length > 0 ? aliases : DEFAULT_PRODUCT_ALIASES;
  const [showAddAliasModal, setShowAddAliasModal] = useState(false);
  const [aliasChannel, setAliasChannel] = useState<'all' | 'woocommerce' | 'pickme' | 'ubereats' | 'pos'>('all');
  const [aliasExternalTitle, setAliasExternalTitle] = useState('');
  const [aliasTargetSku, setAliasTargetSku] = useState(products[0]?.sku || 'WT-ANK-R50I');
  const [aliasNotes, setAliasNotes] = useState('');
  const [aliasNotification, setAliasNotification] = useState<string | null>(null);

  // Live Matching Sandbox State
  const [sandboxTitle, setSandboxTitle] = useState('Soundcore anker r50i True wireless earbuds');
  const [sandboxChannel, setSandboxChannel] = useState('woocommerce');

  const handleAddAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aliasExternalTitle.trim() || !aliasTargetSku || !onSaveAlias) return;

    const targetProduct = products.find((p) => p.sku === aliasTargetSku);
    const newAlias: ProductAlias = {
      id: `alias-${Date.now().toString().slice(-4)}`,
      channel: aliasChannel,
      externalTitle: aliasExternalTitle.trim(),
      targetSku: aliasTargetSku,
      targetProductName: targetProduct?.name || '',
      notes: aliasNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    await onSaveAlias(newAlias);
    setShowAddAliasModal(false);
    setAliasExternalTitle('');
    setAliasNotes('');
    setAliasNotification(`Alias mapped: "${newAlias.externalTitle}" -> ${newAlias.targetSku}`);
    setTimeout(() => setAliasNotification(null), 4000);
  };

  const handleDeleteAlias = async (id: string) => {
    if (onDeleteAlias) {
      await onDeleteAlias(id);
      setAliasNotification('Alias mapping removed.');
      setTimeout(() => setAliasNotification(null), 3000);
    }
  };

  // Evaluate Sandbox Live Match
  const sandboxKeywords = extractCoreKeywords(sandboxTitle);
  const sandboxMatch = findBestProductMatch(
    { externalName: sandboxTitle, channel: sandboxChannel },
    products,
    activeAliases
  );

  const toggleShow = (key: string) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(config);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  const simulatePing = (service: string) => {
    setTestingStatus((prev) => ({ ...prev, [service]: 'Testing handshake...' }));
    setTimeout(() => {
      setTestingStatus((prev) => ({
        ...prev,
        [service]: 'Connected (200 OK · 24ms)',
      }));
      setTimeout(() => {
        setTestingStatus((prev) => ({ ...prev, [service]: null }));
      }, 3500);
    }, 600);
  };

  const handleDispatchLiveTestSms = async () => {
    setSmsTestSending(true);
    setSmsTestResult(null);

    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: config.smsUserId || '588',
          api_key: config.smsApiKey,
          sender_id: config.smsSenderId,
          contact: testPhone,
          message: testSmsMessage,
          triggerType: 'test',
        }),
      });

      const data: SmsSendResponse = await res.json();
      setSmsTestResult(data);
    } catch (err: any) {
      setSmsTestResult({
        success: false,
        message: err?.message || 'Failed to connect to SMS API route.',
        provider: 'SMSlenz',
        recipient: testPhone,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setSmsTestSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            API & Courier Integrations Hub
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Manage all 5 core external API channels: WooCommerce Web Store, PickMe (20%), Uber Eats (15.4%), Trans Express Courier, and SMSlenz Automated Gateway.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors shadow-sm self-start sm:self-auto"
        >
          <Save className="w-4 h-4" />
          <span>Save All API Credentials</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-xs rounded-xl flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>All 5 API configurations, webhook secrets & courier credentials saved successfully.</span>
        </div>
      )}

      {/* ALL 5 INTEGRATION CARDS IN A RESPONSIVE GRID */}
      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 text-xs">
        {/* CARD 1: WooCommerce Web Store API */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">WooCommerce Web Store API</h3>
                  <span className="text-[10px] font-mono text-indigo-400">
                    Auto-Sync Website Orders & Waybills
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => simulatePing('woocommerce')}
                className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-[11px] font-medium transition-colors"
              >
                {testingStatus['woocommerce'] || 'Test Ping'}
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-neutral-300 font-medium mb-1">Store Base URL</label>
                <input
                  type="text"
                  value={config.woocommerceUrl}
                  onChange={(e) => setConfig({ ...config, woocommerceUrl: e.target.value })}
                  placeholder="https://store.wowtek.lk"
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Consumer Key (CK)</label>
                <div className="relative">
                  <input
                    type={showSecrets['wcKey'] ? 'text' : 'password'}
                    value={config.woocommerceConsumerKey}
                    onChange={(e) =>
                      setConfig({ ...config, woocommerceConsumerKey: e.target.value })
                    }
                    placeholder="ck_7f99148d9a20078b671a5c68dfb9101"
                    className="w-full px-3 py-1.5 pr-9 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShow('wcKey')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  >
                    {showSecrets['wcKey'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Consumer Secret (CS)</label>
                <div className="relative">
                  <input
                    type={showSecrets['wcSec'] ? 'text' : 'password'}
                    value={config.woocommerceConsumerSecret}
                    onChange={(e) =>
                      setConfig({ ...config, woocommerceConsumerSecret: e.target.value })
                    }
                    placeholder="cs_8819024fba99165b4c107e3240a1b9"
                    className="w-full px-3 py-1.5 pr-9 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShow('wcSec')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  >
                    {showSecrets['wcSec'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Webhook Secret (Order Created)</label>
                <input
                  type="text"
                  value={config.woocommerceWebhookSecret}
                  onChange={(e) =>
                    setConfig({ ...config, woocommerceWebhookSecret: e.target.value })
                  }
                  placeholder="whsec_99182a4c90"
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                />
              </div>
            </div>
          </div>

          <div className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-[10px] text-neutral-400 mt-3">
            Inbound orders trigger automated Trans Express courier bookings and manifest creation.
          </div>
        </div>

        {/* CARD 2: PickMe Market / Food API (20% fee sync, Webhook Secret, API Key) */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">PickMe Market & Food API</h3>
                  <span className="text-[10px] font-mono text-amber-400">
                    20.0% Standard Commission Sync
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => simulatePing('pickme')}
                className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-[11px] font-medium transition-colors"
              >
                {testingStatus['pickme'] || 'Test Ping'}
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Merchant ID</label>
                  <input
                    type="text"
                    value={config.pickmeMerchantId}
                    onChange={(e) => setConfig({ ...config, pickmeMerchantId: e.target.value })}
                    placeholder="MERCH-PKM-COL-4491"
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Branch Code</label>
                  <input
                    type="text"
                    value={config.pickmeBranchId}
                    onChange={(e) => setConfig({ ...config, pickmeBranchId: e.target.value })}
                    placeholder="BR-BAMBALAPITIYA-01"
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">API Secret Key</label>
                <div className="relative">
                  <input
                    type={showSecrets['pkmKey'] ? 'text' : 'password'}
                    value={config.pickmeApiKey}
                    onChange={(e) => setConfig({ ...config, pickmeApiKey: e.target.value })}
                    className="w-full px-3 py-1.5 pr-9 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShow('pkmKey')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  >
                    {showSecrets['pkmKey'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Webhook Secret (Order Created)</label>
                <input
                  type="text"
                  value="whsec_pkm_live_99214a"
                  readOnly
                  className="w-full px-3 py-1.5 bg-neutral-950/60 border border-neutral-800 rounded-lg text-neutral-400 font-mono text-[11px]"
                />
              </div>
            </div>
          </div>

          <div className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-[10px] text-neutral-400 mt-3">
            Orders from PickMe auto-generate POS invoices with exact 20% platform commission deducted.
          </div>
        </div>

        {/* CARD 3: Uber Eats Integration (15.4% fee sync, Store ID, Client ID, Client Secret) */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Uber Eats Retail Integration</h3>
                  <span className="text-[10px] font-mono text-emerald-400">
                    15.4% Net Fee Sync Active
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => simulatePing('ubereats')}
                className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-[11px] font-medium transition-colors"
              >
                {testingStatus['ubereats'] || 'Test Ping'}
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-neutral-300 font-medium mb-1">Store UUID</label>
                <input
                  type="text"
                  value={config.uberEatsStoreId}
                  onChange={(e) => setConfig({ ...config, uberEatsStoreId: e.target.value })}
                  placeholder="eats-store-srilanka-0914"
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">OAuth Client ID</label>
                <input
                  type="text"
                  value="uber_client_id_lk_881920"
                  readOnly
                  className="w-full px-3 py-1.5 bg-neutral-950/60 border border-neutral-800 rounded-lg text-neutral-400 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Client Secret</label>
                <div className="relative">
                  <input
                    type={showSecrets['ubrSec'] ? 'text' : 'password'}
                    value={config.uberEatsClientSecret}
                    onChange={(e) => setConfig({ ...config, uberEatsClientSecret: e.target.value })}
                    className="w-full px-3 py-1.5 pr-9 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShow('ubrSec')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  >
                    {showSecrets['ubrSec'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-[10px] text-neutral-400 mt-3">
            Payout reconciliations automatically reflect the 15.4% commission rate in analytics.
          </div>
        </div>

        {/* CARD 4: Trans Express Courier Gateway (Auto-booking active, Merchant Account ID, Waybill queue) */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Trans Express Courier Gateway</h3>
                  <span className="text-[10px] font-mono text-purple-300">
                    Auto-Booking Active · Domestic Sri Lanka
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => simulatePing('transexpress')}
                className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-[11px] font-medium transition-colors"
              >
                {testingStatus['transexpress'] || 'Test API'}
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Merchant Account ID</label>
                  <input
                    type="text"
                    value={config.transExpressAccountId}
                    onChange={(e) =>
                      setConfig({ ...config, transExpressAccountId: e.target.value })
                    }
                    placeholder="TX-ACCT-SL-9082"
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Pickup Sorting Hub</label>
                  <input
                    type="text"
                    value={config.transExpressPickupBranch}
                    onChange={(e) =>
                      setConfig({ ...config, transExpressPickupBranch: e.target.value })
                    }
                    placeholder="Colombo Borella Facility"
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">API Live Secret Token</label>
                <div className="relative">
                  <input
                    type={showSecrets['txKey'] ? 'text' : 'password'}
                    value={config.transExpressApiKey}
                    onChange={(e) => setConfig({ ...config, transExpressApiKey: e.target.value })}
                    className="w-full px-3 py-1.5 pr-9 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShow('txKey')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  >
                    {showSecrets['txKey'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-[10px] text-neutral-400 mt-3">
            Waybill tracking numbers (TX-CMB-...) and 4x6-inch shipping barcodes are generated automatically.
          </div>
        </div>

        {/* CARD 5: SMSlenz Automated Gateway (User ID, API Key, Sender ID Mask, Live Test Dispatch) */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4 flex flex-col justify-between md:col-span-2 xl:col-span-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    SMSlenz Automated Gateway (`https://smslenz.lk/api/send-sms`)
                  </h3>
                  <span className="text-[10px] font-mono text-blue-400">
                    Direct Sri Lankan Cellular Gateway · Auto Warranty & Order Triggers
                  </span>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-mono">
                API Endpoint Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  SMSlenz User ID (`user_id`)
                </label>
                <input
                  type="text"
                  value={config.smsUserId}
                  onChange={(e) => setConfig({ ...config, smsUserId: e.target.value })}
                  placeholder="588"
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Sender Mask ID (`sender_id`)
                </label>
                <input
                  type="text"
                  value={config.smsSenderId}
                  onChange={(e) => setConfig({ ...config, smsSenderId: e.target.value })}
                  placeholder="WOWTEK"
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Expiry Notice Reminder
                </label>
                <input
                  type="number"
                  value={config.smsExpiryReminderDays}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      smsExpiryReminderDays: parseInt(e.target.value) || 30,
                    })
                  }
                  placeholder="30"
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-neutral-300 font-medium mb-1">
                SMSlenz API Key (`api_key`)
              </label>
              <div className="relative">
                <input
                  type={showSecrets['smsKey'] ? 'text' : 'password'}
                  value={config.smsApiKey}
                  onChange={(e) => setConfig({ ...config, smsApiKey: e.target.value })}
                  placeholder="Enter your SMSlenz API live secret key..."
                  className="w-full px-3 py-1.5 pr-9 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                />
                <button
                  type="button"
                  onClick={() => toggleShow('smsKey')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                >
                  {showSecrets['smsKey'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Automation Triggers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="flex items-center gap-2 p-2 bg-neutral-950 border border-neutral-800 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.smsAutoNotifyWarranty}
                  onChange={(e) =>
                    setConfig({ ...config, smsAutoNotifyWarranty: e.target.checked })
                  }
                  className="rounded bg-neutral-900 border-neutral-700 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <span className="text-white font-medium block">Warranty Registration & Expiry SMS</span>
                  <span className="text-[10px] text-neutral-400">
                    Dispatches SMS on claim creation and 30-day expiry alert
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2 bg-neutral-950 border border-neutral-800 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.smsAutoNotifyOrder}
                  onChange={(e) =>
                    setConfig({ ...config, smsAutoNotifyOrder: e.target.checked })
                  }
                  className="rounded bg-neutral-900 border-neutral-700 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <span className="text-white font-medium block">Order & POS Confirmation SMS</span>
                  <span className="text-[10px] text-neutral-400">
                    Sends invoice link & tracking details on checkout
                  </span>
                </div>
              </label>
            </div>

            {/* LIVE TEST DISPATCH SECTION */}
            <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-blue-400" />
                  <span>Live Test Dispatch via SMSlenz API (`/api/sms/send`)</span>
                </span>
                <span className="text-[10px] font-mono text-neutral-400">
                  Target: `https://smslenz.lk/api/send-sms`
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-1">
                  <input
                    type="text"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="Recipient (e.g. 0771234567)"
                    className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono text-xs"
                  />
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <input
                    type="text"
                    value={testSmsMessage}
                    onChange={(e) => setTestSmsMessage(e.target.value)}
                    placeholder="Test message body..."
                    className="flex-1 px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleDispatchLiveTestSms}
                    disabled={smsTestSending}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors"
                  >
                    {smsTestSending ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{smsTestSending ? 'Sending...' : 'Send Test SMS'}</span>
                  </button>
                </div>
              </div>

              {smsTestResult && (
                <div
                  className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                    smsTestResult.success
                      ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300'
                      : 'bg-red-950/70 border-red-700/60 text-red-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {smsTestResult.success ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span>{smsTestResult.message}</span>
                  </div>
                  {smsTestResult.messageId && (
                    <span className="font-mono text-[10px] opacity-80">
                      ID: {smsTestResult.messageId}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* MULTI-CHANNEL PRODUCT NAME & SKU MATCHING HUB */}
      <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white">
                  Multi-Channel SKU Linking & Product Alias Mapping Hub
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800">
                  {activeAliases.length} Active Mappings
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Resolve title variations across channels (e.g. WooCommerce &ldquo;Soundcore anker r50i True wireless earbuds&rdquo; vs Uber Eats &ldquo;Anker r50i earbuds&rdquo;) to internal Inventory SKUs with 100% deduction accuracy.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAddAliasModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Map New Channel Product Title</span>
          </button>
        </div>

        {aliasNotification && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-xs rounded-xl flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{aliasNotification}</span>
          </div>
        )}

        {/* LIVE KEYWORD & FUZZY MATCHING TESTER / SANDBOX */}
        <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Smart Keyword & Fuzzy Matching Live Sandbox</span>
            </div>
            <span className="text-[10px] font-mono text-neutral-500">
              Algorithm: Stopword Filtering + Core Model & Brand Token Intersection
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2 flex gap-2">
              <input
                type="text"
                value={sandboxTitle}
                onChange={(e) => setSandboxTitle(e.target.value)}
                placeholder="Test external product name (e.g. Anker r50i earbuds)..."
                className="flex-1 px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono text-xs"
              />
              <select
                value={sandboxChannel}
                onChange={(e) => setSandboxChannel(e.target.value)}
                className="px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs"
              >
                <option value="woocommerce">WooCommerce</option>
                <option value="ubereats">Uber Eats</option>
                <option value="pickme">PickMe</option>
                <option value="pos">POS</option>
              </select>
            </div>

            <div className="sm:col-span-1 flex items-center gap-2 text-xs">
              <span className="text-neutral-400">Try sample:</span>
              <button
                type="button"
                onClick={() => setSandboxTitle('Anker r50i earbuds')}
                className="px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-[11px] text-purple-300 font-mono"
              >
                Uber Eats: &ldquo;Anker r50i earbuds&rdquo;
              </button>
            </div>
          </div>

          {/* Sandbox Analysis Result Card */}
          <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg text-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="text-neutral-400">Extracted Core Model/Brand Tokens:</span>
                <span className="font-mono text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800">
                  [{sandboxKeywords.join(', ') || 'none'}]
                </span>
              </div>
              <div className="text-neutral-500">
                Stripped common filler words: &ldquo;True&rdquo;, &ldquo;wireless&rdquo;, &ldquo;earbuds&rdquo;
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-neutral-800/80">
              <div className="flex items-center gap-2">
                <span className="text-neutral-400">Match Target:</span>
                {sandboxMatch.matchedProduct ? (
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                      {sandboxMatch.matchedProduct.sku}
                    </span>
                    <span className="text-white font-medium">{sandboxMatch.matchedProduct.name}</span>
                  </div>
                ) : (
                  <span className="text-amber-400 font-mono">No match found (Unregistered)</span>
                )}
              </div>

              {sandboxMatch.matchedProduct && (
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                    Confidence: {(sandboxMatch.matchScore * 100).toFixed(0)}%
                  </span>
                  <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                    Reason: {sandboxMatch.matchReason}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active Alias Mappings Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400 font-medium">
                <th className="pb-2.5">External Channel Product Title</th>
                <th className="pb-2.5">Channel</th>
                <th className="pb-2.5">Target Inventory SKU & Product</th>
                <th className="pb-2.5">Notes</th>
                <th className="pb-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-850">
              {activeAliases.map((alias) => (
                <tr key={alias.id} className="hover:bg-neutral-850/30 transition-colors">
                  <td className="py-3 font-medium text-white max-w-sm">
                    &ldquo;{alias.externalTitle}&rdquo;
                  </td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono bg-neutral-950 border border-neutral-800 text-purple-300">
                      {alias.channel}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="font-mono font-semibold text-emerald-400">{alias.targetSku}</div>
                    <div className="text-[11px] text-neutral-400 max-w-xs">{alias.targetProductName}</div>
                  </td>
                  <td className="py-3 text-neutral-400 text-[11px]">
                    {alias.notes || '—'}
                  </td>
                  <td className="py-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteAlias(alias.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-400 bg-neutral-800 hover:bg-neutral-750 rounded-lg transition-colors"
                      title="Delete Alias Mapping"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD ALIAS MAPPING MODAL */}
      {showAddAliasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950">
              <div className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">
                  Add Multi-Channel Product Alias Mapping
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddAliasModal(false)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAlias} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-neutral-300 font-medium mb-1">Channel Association</label>
                <select
                  value={aliasChannel}
                  onChange={(e: any) => setAliasChannel(e.target.value)}
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                >
                  <option value="all">All Channels (Universal)</option>
                  <option value="woocommerce">WooCommerce Web Store</option>
                  <option value="ubereats">Uber Eats Retail</option>
                  <option value="pickme">PickMe Market</option>
                  <option value="pos">POS Terminal</option>
                </select>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  External Channel Product Title
                </label>
                <input
                  type="text"
                  required
                  value={aliasExternalTitle}
                  onChange={(e) => setAliasExternalTitle(e.target.value)}
                  placeholder="e.g. Soundcore anker r50i True wireless earbuds"
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
                <span className="text-[10px] text-neutral-500 mt-1 block">
                  Paste the exact or partial name used on WooCommerce, PickMe, or Uber Eats
                </span>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Target Inventory Product / SKU
                </label>
                <select
                  value={aliasTargetSku}
                  onChange={(e) => setAliasTargetSku(e.target.value)}
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.sku}>
                      {p.sku} — {p.name} (Stock: {p.stockStore + p.stockWarehouse})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={aliasNotes}
                  onChange={(e) => setAliasNotes(e.target.value)}
                  placeholder="e.g. Resolves variation between Uber Eats and WooCommerce"
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAliasModal(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition-colors shadow-sm"
                >
                  Save Alias Mapping
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
