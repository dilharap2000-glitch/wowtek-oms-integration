'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  X,
  RefreshCw,
  Barcode,
  Volume2,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ZapOff,
  Plus,
  ShoppingCart,
  Check,
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Product } from '@/types';

export interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => boolean | void;
  products: Product[];
  title?: string;
  description?: string;
  singleScanMode?: boolean;
  cartItemCount?: number;
}

interface ScanFeedback {
  type: 'success' | 'error';
  title: string;
  message: string;
  code: string;
  timestamp: number;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  products,
  title = 'POS Camera Barcode Scanner',
  description = 'Point camera at product barcode to continuously add items to cart',
  singleScanMode = false,
  cartItemCount = 0,
}) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [continuousMode, setContinuousMode] = useState(!singleScanMode);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);
  const isStartingRef = useRef(false);
  const activeTrackRef = useRef<MediaStreamTrack | null>(null);
  const scanThrottleRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>('');
  const scannerContainerId = 'wowtek-barcode-scanner-viewport';

  // -------------------------------------------------------------------------
  // Web Audio API: Success and Error Beeps
  // -------------------------------------------------------------------------
  const playScanBeep = useCallback(() => {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const ctx = new AudioCtxClass();

      // Pleasant high-register retail barcode chime (2400Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(2400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // AudioContext unavailable or permission not yet granted
    }
  }, []);

  const playErrorBeep = useCallback(() => {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const ctx = new AudioCtxClass();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(220, ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.22);
    } catch {
      // Ignore audio error
    }
  }, []);

  // -------------------------------------------------------------------------
  // Product Lookup & Scan Dispatcher with 2-Second Throttle
  // -------------------------------------------------------------------------
  const processBarcode = useCallback(
    (rawCode: string, isManual = false) => {
      const code = rawCode.trim();
      if (!code) return;

      const now = Date.now();
      // Throttle double-scanning the exact same code within 2 seconds
      if (!isManual && code === lastScannedCodeRef.current && now - scanThrottleRef.current < 2000) {
        return;
      }
      // Minimum 600ms grace period between any consecutive scans
      if (!isManual && now - scanThrottleRef.current < 600) {
        return;
      }

      scanThrottleRef.current = now;
      lastScannedCodeRef.current = code;

      // Exact search against products array (matching barcode or sku)
      const foundProduct = products.find(
        (p) =>
          (p.barcode && p.barcode.trim().toLowerCase() === code.toLowerCase()) ||
          (p.sku && p.sku.trim().toLowerCase() === code.toLowerCase())
      );

      if (foundProduct) {
        playScanBeep();
        setFeedback({
          type: 'success',
          title: foundProduct.name,
          message: `Added to cart · Rs. ${foundProduct.sellingPrice.toLocaleString()}`,
          code: foundProduct.barcode || foundProduct.sku,
          timestamp: now,
        });

        // Trigger parent cart addition
        onScan(foundProduct.barcode || code);

        if (singleScanMode || !continuousMode) {
          setTimeout(() => {
            onClose();
          }, 650);
        }
      } else {
        playErrorBeep();
        setFeedback({
          type: 'error',
          title: `Item with Barcode [${code}] not found in Inventory`,
          message:
            products.length === 0
              ? 'Catalog has 0 products. Add products in Products & Barcode GRN tab.'
              : 'Verify barcode number or register new SKU in inventory.',
          code,
          timestamp: now,
        });

        // Still pass to parent in case parent handles ad-hoc items
        onScan(code);
      }
    },
    [products, onScan, onClose, singleScanMode, continuousMode, playScanBeep, playErrorBeep]
  );

  // -------------------------------------------------------------------------
  // Safe Stop and Clear Scanner
  // -------------------------------------------------------------------------
  const safeStopScanner = useCallback(async () => {
    isStartingRef.current = false;
    const instance = scannerRef.current;
    if (!instance) return;

    scannerRef.current = null;
    activeTrackRef.current = null;
    setTorchOn(false);
    setTorchSupported(false);

    try {
      if (isScanningRef.current) {
        isScanningRef.current = false;
        await instance.stop().catch(() => {});
      }
    } catch {
      // Ignore stop errors
    }

    try {
      instance.clear();
    } catch {
      // Ignore clear errors
    }
  }, []);

  // -------------------------------------------------------------------------
  // Toggle Torch / Flashlight
  // -------------------------------------------------------------------------
  const handleToggleTorch = async () => {
    if (!activeTrackRef.current) return;
    try {
      const nextState = !torchOn;
      await (activeTrackRef.current as any).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch (err) {
      console.warn('Torch toggle failed', err);
    }
  };

  // -------------------------------------------------------------------------
  // Start Camera Feed & Html5Qrcode Scanner Engine
  // -------------------------------------------------------------------------
  const startCameraEngine = useCallback(
    async (cameraId?: string) => {
      await safeStopScanner();

      const container = document.getElementById(scannerContainerId);
      if (!container) return;

      setCameraError(null);
      isStartingRef.current = true;

      try {
        // Enumerate video devices to find high-resolution back cameras
        let cameras: Array<{ id: string; label: string }> = [];
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            cameras = devices.map((d) => ({ id: d.id, label: d.label || 'Camera' }));
            setAvailableCameras(cameras);
          }
        } catch {
          // Camera query not permitted yet
        }

        // Determine camera target
        let targetCamera: any = { facingMode: 'environment' };
        if (cameraId) {
          targetCamera = { deviceId: { exact: cameraId } };
        } else if (cameras.length > 0) {
          // Prefer back/rear camera if labeled
          const rearCam = cameras.find(
            (c) =>
              c.label.toLowerCase().includes('back') ||
              c.label.toLowerCase().includes('rear') ||
              c.label.toLowerCase().includes('environment')
          );
          if (rearCam) {
            targetCamera = { deviceId: { exact: rearCam.id } };
            setSelectedCameraId(rearCam.id);
          }
        }

        // Configure Html5Qrcode with all standard retail 1D + 2D formats
        const scanner = new Html5Qrcode(scannerContainerId, {
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
            useBarCodeDetectorIfSupported: true, // Native C++ BarcodeDetector API for 60fps hardware decoding
          },
        });

        scannerRef.current = scanner;

        // Optimal scanning configuration (fps: 20, qrbox: { width: 250, height: 150 })
        const config = {
          fps: 20,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.777778, // 16:9 widescreen
          videoConstraints: {
            facingMode: { ideal: 'environment' },
            focusMode: { ideal: 'continuous' } as any,
            width: { min: 640, ideal: 1280, max: 1920 },
            height: { min: 480, ideal: 720, max: 1080 },
          } as MediaTrackConstraints,
        };

        await scanner.start(
          targetCamera,
          config,
          (decodedText) => {
            processBarcode(decodedText, false);
          },
          () => {
            // Non-critical scan miss per frame
          }
        );

        if (!isStartingRef.current) {
          // If aborted while starting
          await safeStopScanner();
          return;
        }

        isScanningRef.current = true;
        isStartingRef.current = false;
        setCameraActive(true);

        // Check torch capabilities on the active video track
        try {
          const stream = (scanner as any).localMediaStream as MediaStream | undefined;
          const track = stream?.getVideoTracks?.()[0];
          if (track) {
            activeTrackRef.current = track;
            const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
            if (capabilities && 'torch' in capabilities) {
              setTorchSupported(true);
            }
          }
        } catch {
          // Torch inspection error ignored
        }
      } catch (err: any) {
        isStartingRef.current = false;
        isScanningRef.current = false;
        setCameraActive(false);
        setCameraError(
          err?.message ||
            'Camera permission denied or camera feed unavailable. You can use manual barcode entry or select quick-test codes below.'
        );
      }
    },
    [processBarcode, safeStopScanner]
  );

  // -------------------------------------------------------------------------
  // Lifecycle Management: Start on open, stop cleanly on close
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) {
      safeStopScanner();
      setCameraActive(false);
      setFeedback(null);
      return;
    }

    const timer = setTimeout(() => {
      startCameraEngine(selectedCameraId || undefined);
    }, 200);

    return () => {
      clearTimeout(timer);
      safeStopScanner();
    };
  }, [isOpen, selectedCameraId, startCameraEngine, safeStopScanner]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              <p className="text-[11px] text-neutral-400">{description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Torch Toggle Button */}
            {torchSupported && cameraActive && (
              <button
                type="button"
                onClick={handleToggleTorch}
                className={`p-1.5 rounded-lg border text-xs transition-colors ${
                  torchOn
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                }`}
                title={torchOn ? 'Turn Off Flashlight' : 'Turn On Flashlight'}
              >
                {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}

            {/* Switch Camera if multiple available */}
            {availableCameras.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const currentIndex = availableCameras.findIndex((c) => c.id === selectedCameraId);
                  const nextCam = availableCameras[(currentIndex + 1) % availableCameras.length];
                  if (nextCam) {
                    setSelectedCameraId(nextCam.id);
                  }
                }}
                className="p-1.5 bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white rounded-lg transition-colors"
                title="Switch Camera Sensor"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewfinder Section */}
        <div className="p-4 flex flex-col items-center justify-center bg-neutral-950 space-y-3">
          <div className="relative w-full max-w-sm h-64 bg-black rounded-xl overflow-hidden border border-neutral-800 flex items-center justify-center">
            {/* Target DOM container for Html5Qrcode */}
            <div id={scannerContainerId} className="w-full h-full flex items-center justify-center" />

            {/* Simulated Laser Reticle (250x150 Box) */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-[250px] h-[150px] border-2 border-dashed border-purple-500/70 rounded-lg relative flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.25)]">
                {/* 4 Corner Accents */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-purple-400" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-purple-400" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-purple-400" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-purple-400" />

                {/* Sweeping Laser Line */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_10px_#ef4444] animate-pulse" />

                <span className="absolute bottom-1.5 text-[10px] font-mono text-purple-200 bg-neutral-950/85 px-2 py-0.5 rounded border border-purple-500/30">
                  Align Barcode Inside Box (250×150)
                </span>
              </div>
            </div>

            {/* Error or Standby Message */}
            {cameraError && (
              <div className="absolute inset-0 bg-neutral-950/95 p-4 flex flex-col items-center justify-center text-center space-y-2 z-10">
                <AlertTriangle className="w-8 h-8 text-amber-400" />
                <div className="text-xs text-neutral-200 font-semibold">Camera Feed Standby</div>
                <p className="text-[11px] text-neutral-400 max-w-xs">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => startCameraEngine(selectedCameraId || undefined)}
                  className="mt-1 px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-medium"
                >
                  Retry Camera
                </button>
              </div>
            )}
          </div>

          {/* Feedback Toast Notification */}
          {feedback && (
            <div
              className={`w-full max-w-sm p-3 rounded-xl border text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
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

          {/* Scanner Controls / Continuous Toggle */}
          <div className="w-full max-w-sm flex items-center justify-between text-xs pt-1 px-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-neutral-300">
              <input
                type="checkbox"
                checked={continuousMode}
                onChange={(e) => setContinuousMode(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-neutral-700 bg-neutral-900 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-[11px]">Continuous Multi-Item Scanning</span>
            </label>

            {cartItemCount > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-purple-400">
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>{cartItemCount} in cart</span>
              </div>
            )}
          </div>
        </div>

        {/* Manual Barcode Entry Fallback */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-900/60 space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manualCode.trim()) {
                processBarcode(manualCode.trim(), true);
                setManualCode('');
              }
            }}
            className="flex gap-2"
          >
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

          {/* Quick Test Barcode Buttons (if products exist) */}
          {products.length > 0 ? (
            <div>
              <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Quick-Simulate Barcode Scan (From Catalog):</span>
                <Volume2 className="w-3 h-3 text-purple-400" />
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-28 overflow-y-auto pr-1">
                {products.slice(0, 6).map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => processBarcode(prod.barcode, true)}
                    className="p-2 text-left bg-neutral-950 hover:bg-purple-950/40 border border-neutral-800 hover:border-purple-500/50 rounded-lg transition-all text-xs"
                  >
                    <div className="font-mono text-[11px] text-purple-300 font-medium truncate">
                      {prod.barcode}
                    </div>
                    <div className="text-[11px] text-neutral-300 truncate mt-0.5">{prod.name}</div>
                    <div className="text-[10px] text-neutral-500 font-mono">
                      Rs. {prod.sellingPrice.toLocaleString()} · {prod.stockStore} in store
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-400 flex items-center gap-2">
              <Barcode className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <span>
                Store catalog is currently empty. You can type any barcode or SKU above to test.
              </span>
            </div>
          )}

          {/* Close / Done Action */}
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
