'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  X,
  Barcode,
  Volume2,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ShoppingCart,
  RotateCcw,
  Sparkles,
  Focus,
  Check,
} from 'lucide-react';
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
  Html5QrcodeScannerState,
} from 'html5-qrcode';
import { Product } from '@/types';

export interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => boolean | void;
  onAddCustomItem?: (item: {
    sku: string;
    barcode: string;
    name: string;
    sellingPrice: number;
    costPrice?: number;
    saveToInventory?: boolean;
  }) => void;
  products: Product[];
  title?: string;
  description?: string;
  singleScanMode?: boolean;
  cartItemCount?: number;
  onLoadSampleProducts?: () => void;
}

interface ScanFeedback {
  type: 'success' | 'alert' | 'error';
  title: string;
  message: string;
  code: string;
  timestamp: number;
}

interface UnknownBarcodePrompt {
  code: string;
  name: string;
  price: number;
  costPrice: number;
  saveToInventory: boolean;
}

interface FocusRingCoord {
  x: number;
  y: number;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  onAddCustomItem,
  products,
  title = 'POS Camera Barcode Scanner',
  description = 'Point camera at product barcode for instant continuous scanning',
  singleScanMode = false,
  cartItemCount = 0,
  onLoadSampleProducts,
}) => {
  // State
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  // Continuous scanning enabled by default
  const [continuousMode, setContinuousMode] = useState(true);
  const [unknownItemPrompt, setUnknownItemPrompt] = useState<UnknownBarcodePrompt | null>(null);
  const [focusRing, setFocusRing] = useState<FocusRingCoord | null>(null);

  // References
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const lastScannedCodeRef = useRef<string>('');
  const lastScanTimestampRef = useRef<number>(0);
  const containerId = 'pos-html5-qrcode-viewport';

  // -------------------------------------------------------------------------
  // Web Audio API: High-Pitched Instant Success Beep & Alert Tones
  // -------------------------------------------------------------------------
  const playScanSuccessBeep = useCallback(() => {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const ctx = new AudioCtxClass();

      // Sharp, instant 2400Hz chime (instant zero-latency playback)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(2400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      // Audio autoplay policy fallback
    }
  }, []);

  const playAlertTone = useCallback(() => {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const ctx = new AudioCtxClass();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(320, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.22);
    } catch {
      // Ignore
    }
  }, []);

  // -------------------------------------------------------------------------
  // Process Decoded Barcode (Lookup or Fallback Prompt)
  // -------------------------------------------------------------------------
  const handleDecodedBarcode = useCallback(
    (rawCode: string, isManual = false) => {
      const code = rawCode.trim();
      if (!code) return;

      const now = Date.now();

      // Debounce duplicate reads of the exact same barcode within 1000ms
      if (!isManual && code === lastScannedCodeRef.current && now - lastScanTimestampRef.current < 1000) {
        return;
      }
      // Debounce rapid sequential reads of distinct codes to 400ms
      if (!isManual && now - lastScanTimestampRef.current < 400) {
        return;
      }

      lastScanTimestampRef.current = now;
      lastScannedCodeRef.current = code;

      // Show detected code immediately in manual input box
      setManualCode(code);

      // Trigger 1.2s visual green flash feedback
      setIsFlashing(true);
      setTimeout(() => {
        if (isMountedRef.current) setIsFlashing(false);
      }, 1200);

      // Search product catalog
      const foundProduct = products.find(
        (p) =>
          (p.barcode && p.barcode.trim().toLowerCase() === code.toLowerCase()) ||
          (p.sku && p.sku.trim().toLowerCase() === code.toLowerCase())
      );

      if (foundProduct) {
        // MATCH FOUND: Add immediately & play high-pitch beep
        playScanSuccessBeep();
        setFeedback({
          type: 'success',
          title: foundProduct.name,
          message: `Added to cart · Rs. ${foundProduct.sellingPrice.toLocaleString()}`,
          code: foundProduct.barcode || foundProduct.sku,
          timestamp: now,
        });

        onScan(foundProduct.barcode || code);

        if (singleScanMode || !continuousMode) {
          setTimeout(() => {
            if (isMountedRef.current) onClose();
          }, 600);
        }
      } else {
        // MATCH NOT FOUND (Catalog Empty or Unregistered SKU)
        playAlertTone();
        setFeedback({
          type: 'alert',
          title: `Item not found in stock: [${code}]`,
          message: `Prompting quick-add custom item to cart...`,
          code,
          timestamp: now,
        });

        // Trigger on-the-fly custom item prompt modal
        setUnknownItemPrompt({
          code,
          name: `Custom Scanned Item (${code.slice(-6)})`,
          price: 1500,
          costPrice: 1050,
          saveToInventory: true,
        });
      }
    },
    [products, onScan, onClose, singleScanMode, continuousMode, playScanSuccessBeep, playAlertTone]
  );

  // -------------------------------------------------------------------------
  // Stop Scanner Safely
  // -------------------------------------------------------------------------
  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        const state = html5QrCodeRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Error clearing Html5Qrcode instance', err);
      }
      html5QrCodeRef.current = null;
    }
    setCameraActive(false);
    setCameraLoading(false);
  }, []);

  // -------------------------------------------------------------------------
  // Manual Re-Focus Trigger: Applies autofocus constraints without lag
  // -------------------------------------------------------------------------
  const triggerRefocus = useCallback(async (coord?: { x: number; y: number }) => {
    if (coord) {
      setFocusRing(coord);
      setTimeout(() => setFocusRing(null), 800);
    } else {
      setFocusRing({ x: 180, y: 120 });
      setTimeout(() => setFocusRing(null), 800);
    }

    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.applyVideoConstraints({
          // @ts-ignore
          advanced: [{ focusMode: 'continuous' }],
        });
      } catch {
        // Direct media track fallback
        try {
          const videoEl = document.querySelector(`#${containerId} video`) as HTMLVideoElement;
          const stream = videoEl?.srcObject as MediaStream;
          const track = stream?.getVideoTracks?.()[0];
          if (track && track.applyConstraints) {
            await (track as any).applyConstraints({
              advanced: [{ focusMode: 'continuous' }],
            });
          }
        } catch {}
      }
    }
  }, [containerId]);

  const handleTapVideo = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    triggerRefocus({ x, y });
  };

  // -------------------------------------------------------------------------
  // Initialize Lightweight Html5Qrcode (1280x720, 100ms interval, no canvas overhead)
  // -------------------------------------------------------------------------
  const initScanner = useCallback(async () => {
    await stopScanner();
    setCameraError(null);
    setCameraLoading(true);

    try {
      const containerEl = document.getElementById(containerId);
      if (!containerEl) {
        setCameraLoading(false);
        return;
      }

      // Initialize standard lightweight Html5Qrcode with hardware BarcodeDetector if available
      const html5QrCode = new Html5Qrcode(containerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      });

      html5QrCodeRef.current = html5QrCode;

      // Standard 720p constraints: lightweight for iOS Safari and mobile browser threads
      const cameraConfig = {
        facingMode: 'environment',
      };

      const qrConfig = {
        fps: 10, // Lightweight 100ms scan interval (prevents iOS thread stalling)
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => ({
          width: Math.floor(viewfinderWidth * 0.85),
          height: Math.min(Math.floor(viewfinderHeight * 0.65), Math.floor(viewfinderWidth * 0.55)),
        }),
        videoConstraints: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      await html5QrCode.start(
        cameraConfig,
        qrConfig,
        (decodedText: string) => {
          handleDecodedBarcode(decodedText);
        },
        () => {
          // Standard frame skipped when no barcode in view
        }
      );

      if (isMountedRef.current) {
        setCameraActive(true);
        setCameraLoading(false);
      }
    } catch (err: any) {
      console.warn('Camera initialization error', err);
      if (isMountedRef.current) {
        setCameraLoading(false);
        setCameraActive(false);
        setCameraError(
          err?.message ||
            'Camera permission denied or camera device unavailable. You can use manual entry or tap Restart Camera.'
        );
      }
    }
  }, [containerId, handleDecodedBarcode, stopScanner]);

  // Lifecycle
  useEffect(() => {
    isMountedRef.current = true;

    if (!isOpen) {
      stopScanner();
      setFeedback(null);
      setUnknownItemPrompt(null);
      return;
    }

    const timer = setTimeout(() => {
      initScanner();
    }, 120);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen, initScanner, stopScanner]);

  // Submit Unknown Scanned Item to POS Cart
  const handleConfirmAddUnknownItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unknownItemPrompt) return;

    const { code, name, price, costPrice, saveToInventory } = unknownItemPrompt;

    if (onAddCustomItem) {
      onAddCustomItem({
        sku: `WT-SCAN-${code.slice(-6)}`,
        barcode: code,
        name: name.trim() || `Custom Scanned Item (${code})`,
        sellingPrice: Math.max(1, price),
        costPrice: Math.max(0, costPrice),
        saveToInventory,
      });
    } else {
      onScan(code);
    }

    playScanSuccessBeep();
    setFeedback({
      type: 'success',
      title: name,
      message: `Added to cart as custom item · Rs. ${price.toLocaleString()}`,
      code,
      timestamp: Date.now(),
    });

    setUnknownItemPrompt(null);

    if (singleScanMode || !continuousMode) {
      setTimeout(() => {
        if (isMountedRef.current) onClose();
      }, 500);
    }
  };

  // Manual code submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleDecodedBarcode(manualCode.trim(), true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-white">{title}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/80 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-400" />
                  Direct Video Stream · 720p 100ms
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">{description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Restart Camera */}
            <button
              type="button"
              onClick={() => initScanner()}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
              title="Restart Camera"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewfinder Viewport with Explicit Re-focus Action */}
        <div className="p-4 flex flex-col items-center justify-center bg-neutral-950 space-y-3">
          {/* Top Bar with Explicit Re-Focus Button */}
          <div className="w-full flex items-center justify-between text-xs px-1 text-neutral-400">
            <button
              type="button"
              onClick={() => triggerRefocus()}
              className="flex items-center gap-1.5 text-[11px] text-purple-300 hover:text-purple-200 bg-purple-950/60 hover:bg-purple-900/60 px-2.5 py-1 rounded-lg border border-purple-800/60 transition-colors"
            >
              <Focus className="w-3.5 h-3.5 text-purple-400" />
              <span>Tap Video to Re-Focus</span>
            </button>

            <span className="text-[10px] font-mono text-neutral-500">
              EAN·13 / 128 / 39 / UPC / EAN·8
            </span>
          </div>

          {/* Video Container (No heavy canvas filters, direct video element) */}
          <div
            onClick={handleTapVideo}
            className={`relative w-full h-72 sm:h-80 bg-black rounded-xl overflow-hidden border cursor-crosshair transition-all duration-300 flex items-center justify-center select-none ${
              isFlashing
                ? 'border-emerald-400 ring-4 ring-emerald-500/50 shadow-[0_0_35px_#10b981]'
                : 'border-neutral-800'
            }`}
          >
            {/* Native HTML5-QRCode Viewport */}
            <div
              id={containerId}
              className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover [&_video]:rounded-xl"
            />

            {/* Tap-to-Refocus Animated Ring */}
            {focusRing && (
              <div
                style={{
                  left: focusRing.x - 24,
                  top: focusRing.y - 24,
                }}
                className="absolute w-12 h-12 border-2 border-amber-400 rounded-full animate-ping pointer-events-none z-20 shadow-[0_0_15px_#f59e0b]"
              />
            )}

            {/* Camera Loading Overlay */}
            {cameraLoading && (
              <div className="absolute inset-0 bg-neutral-950/90 flex flex-col items-center justify-center text-center space-y-2 z-20">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-neutral-300">Connecting video stream...</span>
              </div>
            )}

            {/* Error or Standby Overlay with Restart Camera Action */}
            {cameraError && (
              <div className="absolute inset-0 bg-neutral-950/95 p-4 flex flex-col items-center justify-center text-center space-y-2.5 z-20">
                <AlertTriangle className="w-8 h-8 text-amber-400" />
                <div className="text-xs text-neutral-200 font-semibold">Camera Feed Standby</div>
                <p className="text-[11px] text-neutral-400 max-w-xs">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => initScanner()}
                  className="mt-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restart Camera</span>
                </button>
              </div>
            )}
          </div>

          {/* Feedback Toast Notification */}
          {feedback && !unknownItemPrompt && (
            <div
              className={`w-full p-3 rounded-xl border text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/90 border-emerald-700/80 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                  : 'bg-amber-950/90 border-amber-700/80 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="font-semibold text-white truncate">{feedback.title}</div>
                  <div className="text-[11px] opacity-90 truncate">{feedback.message}</div>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/60 border border-white/10 text-white flex-shrink-0">
                {feedback.code}
              </span>
            </div>
          )}

          {/* Continuous Scanning & Cart Status */}
          <div className="w-full flex items-center justify-between text-xs pt-1 px-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-neutral-300">
              <input
                type="checkbox"
                checked={continuousMode}
                onChange={(e) => setContinuousMode(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-neutral-700 bg-neutral-900 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-[11px]">Continuous Auto-Scanning (100ms Interval)</span>
            </label>

            {cartItemCount > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-purple-400">
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>{cartItemCount} in cart</span>
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------------- */}
        {/* UNKNOWN BARCODE PROMPT (AUTO-CREATE ITEM ON THE FLY)                */}
        {/* ------------------------------------------------------------------- */}
        {unknownItemPrompt && (
          <div className="p-4 bg-amber-950/40 border-t border-b border-amber-800/80">
            <form onSubmit={handleConfirmAddUnknownItem} className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <div className="text-xs font-semibold text-white">
                    Uncataloged Barcode: <span className="font-mono text-amber-300">{unknownItemPrompt.code}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUnknownItemPrompt(null)}
                  className="text-neutral-400 hover:text-white text-xs"
                >
                  ✕ Dismiss
                </button>
              </div>

              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                Item not found in stock. Quick-add this SKU to POS Cart as &apos;Custom Scanned Item&apos;?
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] text-neutral-400 mb-0.5">Item Name</label>
                  <input
                    type="text"
                    value={unknownItemPrompt.name}
                    onChange={(e) =>
                      setUnknownItemPrompt({ ...unknownItemPrompt, name: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-neutral-950 border border-neutral-700 rounded text-white text-xs focus:outline-none focus:border-amber-400"
                    placeholder="e.g. Scanned USB Cable"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-neutral-400 mb-0.5">Selling Price (Rs.)</label>
                  <input
                    type="number"
                    min="1"
                    value={unknownItemPrompt.price}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setUnknownItemPrompt({
                        ...unknownItemPrompt,
                        price: val,
                        costPrice: Math.round(val * 0.7),
                      });
                    }}
                    className="w-full px-2.5 py-1.5 bg-neutral-950 border border-neutral-700 rounded text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-1.5 text-[11px] text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={unknownItemPrompt.saveToInventory}
                    onChange={(e) =>
                      setUnknownItemPrompt({
                        ...unknownItemPrompt,
                        saveToInventory: e.target.checked,
                      })
                    }
                    className="w-3.5 h-3.5 rounded border-neutral-700 bg-neutral-950 text-amber-500 focus:ring-amber-400"
                  />
                  <span>Save to Inventory catalog as new SKU</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setUnknownItemPrompt(null)}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded text-xs shadow-md transition-colors"
                  >
                    Add to Cart Now →
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Manual Barcode Entry Fallback (Always Responsive) */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-900/60 space-y-3">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Barcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Type barcode or SKU and press Enter..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono placeholder-neutral-500 focus:outline-none focus:border-purple-500"
              />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Item</span>
            </button>
          </form>

          {/* Quick Test Barcode Buttons / Load Test Sample Products Button */}
          {products.length > 0 ? (
            <div>
              <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Quick-Simulate Barcode Scan (From Stock):</span>
                <Volume2 className="w-3 h-3 text-purple-400" />
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-24 overflow-y-auto pr-1">
                {products.slice(0, 6).map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleDecodedBarcode(prod.barcode, true)}
                    className="p-1.5 text-left bg-neutral-950 hover:bg-purple-950/40 border border-neutral-800 hover:border-purple-500/50 rounded-lg transition-all text-xs"
                  >
                    <div className="font-mono text-[11px] text-purple-300 font-medium truncate">
                      {prod.barcode}
                    </div>
                    <div className="text-[10px] text-neutral-300 truncate">{prod.name}</div>
                    <div className="text-[10px] text-neutral-500 font-mono">
                      Rs. {prod.sellingPrice.toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Barcode className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <span>Catalog currently empty. Scan any item to trigger Quick-Add fallback!</span>
              </div>
              {onLoadSampleProducts && (
                <button
                  type="button"
                  onClick={() => onLoadSampleProducts()}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-semibold whitespace-nowrap shadow-sm flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Load 5 Test Products</span>
                </button>
              )}
            </div>
          )}

          {/* Close Action */}
          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
            >
              Done Scanning
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
