'use client';

import React, { useState } from 'react';
import {
  Settings,
  Percent,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  CreditCard,
  Building,
  DollarSign,
  TrendingUp,
  Calculator,
} from 'lucide-react';
import { PlatformConfig, PaymentGatewayConfig } from '@/types';

interface SettingsTabProps {
  platforms: PlatformConfig[];
  gateways: PaymentGatewayConfig[];
  onSavePlatforms: (platforms: PlatformConfig[]) => void;
  onSaveGateways: (gateways: PaymentGatewayConfig[]) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  platforms = [],
  gateways = [],
  onSavePlatforms,
  onSaveGateways,
}) => {
  const [localPlatforms, setLocalPlatforms] = useState<PlatformConfig[]>([...(platforms || [])]);
  const [localGateways, setLocalGateways] = useState<PaymentGatewayConfig[]>([...(gateways || [])]);

  React.useEffect(() => {
    setLocalPlatforms([...(platforms || [])]);
  }, [platforms]);

  React.useEffect(() => {
    setLocalGateways([...(gateways || [])]);
  }, [gateways]);

  const [newPlatformName, setNewPlatformName] = useState('');
  const [newPlatformFee, setNewPlatformFee] = useState<number>(10);

  const [newGatewayName, setNewGatewayName] = useState('');
  const [newGatewayFee, setNewGatewayFee] = useState<number>(5);

  const [savedNotification, setSavedNotification] = useState<string | null>(null);

  // Live Formula Simulator
  const [simSellingPrice, setSimSellingPrice] = useState<number>(25000);
  const [simCostPrice, setSimCostPrice] = useState<number>(18000);
  const [simPlatformId, setSimPlatformId] = useState<string>(localPlatforms[0]?.id || '');
  const [simGatewayId, setSimGatewayId] = useState<string>(localGateways[0]?.id || '');

  const notifySaved = (msg: string) => {
    setSavedNotification(msg);
    setTimeout(() => setSavedNotification(null), 3500);
  };

  // Update platform fee
  const handleUpdatePlatformFee = (id: string, feePercent: number) => {
    const updated = localPlatforms.map((p) =>
      p.id === id ? { ...p, feePercent: Math.max(0, feePercent) } : p
    );
    setLocalPlatforms(updated);
    onSavePlatforms(updated);
    notifySaved('Platform fee percentage updated.');
  };

  // Add custom platform
  const handleAddCustomPlatform = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlatformName.trim()) return;

    const code = newPlatformName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newPlat: PlatformConfig = {
      id: `plt-custom-${Date.now().toString().slice(-4)}`,
      name: newPlatformName.trim(),
      code,
      feePercent: newPlatformFee,
      isCustom: true,
      active: true,
    };

    const updated = [...localPlatforms, newPlat];
    setLocalPlatforms(updated);
    onSavePlatforms(updated);
    setNewPlatformName('');
    notifySaved(`Added ${newPlat.name} with ${newPlatformFee}% commission.`);
  };

  // Delete custom platform
  const handleDeletePlatform = (id: string) => {
    const updated = localPlatforms.filter((p) => p.id !== id);
    setLocalPlatforms(updated);
    onSavePlatforms(updated);
    notifySaved('Platform removed.');
  };

  // Update gateway fee
  const handleUpdateGatewayFee = (id: string, feePercent: number) => {
    const updated = localGateways.map((g) =>
      g.id === id ? { ...g, feePercent: Math.max(0, feePercent) } : g
    );
    setLocalGateways(updated);
    onSaveGateways(updated);
    notifySaved('Payment gateway fee percentage updated.');
  };

  // Add custom gateway
  const handleAddCustomGateway = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGatewayName.trim()) return;

    const code = newGatewayName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newGw: PaymentGatewayConfig = {
      id: `gw-custom-${Date.now().toString().slice(-4)}`,
      name: newGatewayName.trim(),
      code,
      feePercent: newGatewayFee,
      isCustom: true,
      active: true,
    };

    const updated = [...localGateways, newGw];
    setLocalGateways(updated);
    onSaveGateways(updated);
    setNewGatewayName('');
    notifySaved(`Added ${newGw.name} with ${newGatewayFee}% fee.`);
  };

  // Delete custom gateway
  const handleDeleteGateway = (id: string) => {
    const updated = localGateways.filter((g) => g.id !== id);
    setLocalGateways(updated);
    onSaveGateways(updated);
    notifySaved('Payment gateway removed.');
  };

  // Calculate simulated profit based on exact formula:
  // Net Profit = Total Selling Price - Cost Price - (Total Selling Price * (Platform Fee % + Gateway Fee %))
  const selectedSimPlatform = localPlatforms.find((p) => p.id === simPlatformId) || localPlatforms[0];
  const selectedSimGateway = localGateways.find((g) => g.id === simGatewayId) || localGateways[0];

  const simPlatformPct = selectedSimPlatform ? selectedSimPlatform.feePercent : 0;
  const simGatewayPct = selectedSimGateway ? selectedSimGateway.feePercent : 0;
  const combinedFeePct = simPlatformPct + simGatewayPct;
  const totalFeeDeduction = (simSellingPrice * combinedFeePct) / 100;
  const calculatedNetProfit = simSellingPrice - simCostPrice - totalFeeDeduction;
  const calculatedProfitMargin =
    simSellingPrice > 0 ? ((calculatedNetProfit / simSellingPrice) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Dynamic Platform & Payment Gateway Fee Engine
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Configure dynamic platform commissions (PickMe: 20%, Uber Eats: 15.4%), payment gateway fees (Payzy: 12%, Koko: 12%, Mintpay: 12%, Cash: 0%), and test real-time profit calculations.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-300">
          <Percent className="w-4 h-4 text-purple-400" />
          <span>Real-Time Formula Synchronization</span>
        </div>
      </div>

      {savedNotification && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-xs rounded-xl flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{savedNotification}</span>
        </div>
      )}

      {/* FORMULA ARCHITECTURE BANNER */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-neutral-900 to-neutral-950 border border-purple-800/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
              System Core Net Profit Formula
            </div>
            <div className="text-sm font-mono font-bold text-white mt-1">
              Net Profit = Total Selling Price - Cost Price - (Total Selling Price × (Platform Fee % + Gateway Fee %))
            </div>
          </div>
          <span className="text-[11px] px-2.5 py-1 rounded bg-purple-900/50 text-purple-200 border border-purple-700/50 font-mono">
            Auto-Evaluated
          </span>
        </div>
      </div>

      {/* TWO COLUMN GRID: PLATFORM COMMISSIONS & PAYMENT GATEWAY FEES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Platform Fees (PickMe 20%, Uber Eats 15.4%, etc.) */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Platform Commission Rates</h3>
            </div>
            <span className="text-[10px] font-mono text-neutral-400">
              PickMe: 20% · Uber: 15.4%
            </span>
          </div>

          <div className="space-y-3">
            {(localPlatforms || []).map((plt) => (
              <div
                key={plt.id}
                className="p-3 bg-neutral-950 border border-neutral-800/80 rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-white flex items-center gap-2">
                    <span>{plt.name}</span>
                    {plt.isCustom && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800 font-mono">
                        Custom
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500 mt-0.5">
                    Platform Code: {plt.code}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={plt.feePercent}
                      onChange={(e) =>
                        handleUpdatePlatformFee(plt.id, parseFloat(e.target.value) || 0)
                      }
                      className="w-16 px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-center text-white font-mono font-bold text-xs focus:outline-none focus:border-purple-500"
                    />
                    <span className="font-mono text-purple-400 font-bold">%</span>
                  </div>

                  {plt.isCustom && (
                    <button
                      onClick={() => handleDeletePlatform(plt.id)}
                      className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors"
                      title="Delete custom platform"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add Custom Platform Form */}
          <form
            onSubmit={handleAddCustomPlatform}
            className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-xl space-y-2 text-xs"
          >
            <div className="text-[11px] font-semibold text-neutral-300">
              + Add New Sales Platform / Channel
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={newPlatformName}
                onChange={(e) => setNewPlatformName(e.target.value)}
                placeholder="e.g. Daraz Mall"
                className="flex-1 px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-white text-xs"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={newPlatformFee}
                  onChange={(e) => setNewPlatformFee(parseFloat(e.target.value) || 0)}
                  placeholder="Fee %"
                  className="w-16 px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-white font-mono text-xs text-center"
                />
                <span className="font-mono text-neutral-400">%</span>
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-xs"
              >
                Add
              </button>
            </div>
          </form>
        </div>

        {/* Payment Gateway Fees (Cash 0%, Payzy 12%, Koko 12%, Mintpay 12%, etc.) */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-white">Payment Gateway Fee Schedule</h3>
            </div>
            <span className="text-[10px] font-mono text-neutral-400">
              Payzy, Koko, Mintpay: 12%
            </span>
          </div>

          <div className="space-y-3">
            {(localGateways || []).map((gw) => (
              <div
                key={gw.id}
                className="p-3 bg-neutral-950 border border-neutral-800/80 rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-white flex items-center gap-2">
                    <span>{gw.name}</span>
                    {gw.isCustom && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800 font-mono">
                        Custom
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500 mt-0.5">
                    Gateway Code: {gw.code}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={gw.feePercent}
                      onChange={(e) =>
                        handleUpdateGatewayFee(gw.id, parseFloat(e.target.value) || 0)
                      }
                      className="w-16 px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-center text-white font-mono font-bold text-xs focus:outline-none focus:border-purple-500"
                    />
                    <span className="font-mono text-purple-400 font-bold">%</span>
                  </div>

                  {gw.isCustom && (
                    <button
                      onClick={() => handleDeleteGateway(gw.id)}
                      className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors"
                      title="Delete custom gateway"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add Custom Payment Gateway Form */}
          <form
            onSubmit={handleAddCustomGateway}
            className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-xl space-y-2 text-xs"
          >
            <div className="text-[11px] font-semibold text-neutral-300">
              + Add New Payment Gateway / Wallet
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={newGatewayName}
                onChange={(e) => setNewGatewayName(e.target.value)}
                placeholder="e.g. Genie / FriMi / WebXPay"
                className="flex-1 px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-white text-xs"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={newGatewayFee}
                  onChange={(e) => setNewGatewayFee(parseFloat(e.target.value) || 0)}
                  placeholder="Fee %"
                  className="w-16 px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-white font-mono text-xs text-center"
                />
                <span className="font-mono text-neutral-400">%</span>
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-xs"
              >
                Add
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* INTERACTIVE PROFIT / LOSS CALCULATOR DEMO */}
      <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-white">
              Interactive Net Profit Simulator & Fee Verifier
            </h3>
          </div>
          <span className="text-[11px] text-neutral-400">
            Tests the exact formula in real-time
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block text-neutral-400 mb-1">Total Selling Price (LKR)</label>
            <input
              type="number"
              value={simSellingPrice}
              onChange={(e) => setSimSellingPrice(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-neutral-400 mb-1">Cost Price (LKR)</label>
            <input
              type="number"
              value={simCostPrice}
              onChange={(e) => setSimCostPrice(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-neutral-400 mb-1">Platform Commission</label>
            <select
              value={simPlatformId}
              onChange={(e) => setSimPlatformId(e.target.value)}
              className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
            >
              {(localPlatforms || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.feePercent}%)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-neutral-400 mb-1">Payment Gateway</label>
            <select
              value={simGatewayId}
              onChange={(e) => setSimGatewayId(e.target.value)}
              className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
            >
              {(localGateways || []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.feePercent}%)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Calculation Result */}
        <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div>
            <div className="text-[10px] text-neutral-400 uppercase">Total Fee Deduction</div>
            <div className="text-base font-bold text-amber-400 mt-0.5">
              -Rs. {totalFeeDeduction.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">
              Combined: {combinedFeePct}% ({simPlatformPct}% + {simGatewayPct}%)
            </div>
          </div>

          <div>
            <div className="text-[10px] text-neutral-400 uppercase">Gross Product Margin</div>
            <div className="text-base font-bold text-neutral-200 mt-0.5">
              Rs. {(simSellingPrice - simCostPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">Selling Price - Cost Price</div>
          </div>

          <div>
            <div className="text-[10px] text-neutral-400 uppercase">Calculated Net Profit</div>
            <div className="text-base font-bold text-emerald-400 mt-0.5">
              Rs. {calculatedNetProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-emerald-300 mt-0.5">
              Net Margin: {calculatedProfitMargin}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
