import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCw, Barcode, Volume2, Sparkles, Check, AlertCircle } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Product } from '@/types';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  products: Product[];
  title?: string;
  description?: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  products,
  title = 'Mobile Camera Barcode Scanner',
  description = 'Point camera at product barcode or choose a quick test code',
}) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'wowtek-qr-reader';

  // Play a crisp beep tone using Web Audio API
  const playScanBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch {
      // Audio not permitted or supported
    }
  };

  const handleSuccessfulScan = (decodedText: string) => {
    playScanBeep();
    setLastScanned(decodedText);
    onScan(decodedText);
  };

  // Helper to safely stop scanner without throwing "Cannot stop, scanner is not running or paused."
  const safeStopAndClear = async (scanner: Html5Qrcode | null) => {
    if (!scanner) return;
    try {
      // Check if scanner is actually running before calling stop
      const isScanning =
        (scanner as any).isScanning ||
        ((scanner as any).getState && (scanner as any).getState() === 2);

      if (isScanning) {
        await scanner.stop().catch(() => {});
      }
    } catch {
      // Gracefully suppress any "Cannot stop, scanner is not running or paused"
    }

    try {
      scanner.clear();
    } catch {
      // Suppress any clear DOM errors
    }
  };

  // Start and cleanup Html5Qrcode camera lifecycle
  useEffect(() => {
    if (!isOpen) {
      if (scannerRef.current) {
        const instance = scannerRef.current;
        scannerRef.current = null;
        safeStopAndClear(instance);
      }
      setCameraActive(false);
      return;
    }

    let isMounted = true;
    let localScanner: Html5Qrcode | null = null;

    async function startCamera() {
      setCameraError(null);
      try {
        const container = document.getElementById(scannerContainerId);
        if (!container || !isMounted) return;

        const scanner = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.UPC_A,
          ],
          verbose: false,
        });

        localScanner = scanner;
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: { width: 280, height: 160 },
          },
          (decodedText) => {
            if (isMounted) {
              handleSuccessfulScan(decodedText);
            }
          },
          () => {
            // Non-critical scan failure
          }
        );

        if (isMounted) {
          setCameraActive(true);
        } else {
          // If unmounted while start was completing, immediately stop
          safeStopAndClear(scanner);
        }
      } catch (err: any) {
        if (isMounted) {
          setCameraError(
            err?.message || 'Camera permission denied or camera device not found in this environment.'
          );
          setCameraActive(false);
        }
      }
    }

    const timer = setTimeout(() => {
      if (isMounted) {
        startCamera();
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      const toClean = scannerRef.current || localScanner;
      scannerRef.current = null;
      if (toClean) {
        safeStopAndClear(toClean);
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
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
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Container */}
        <div className="p-4 flex flex-col items-center justify-center bg-neutral-950">
          <div className="relative w-full max-w-sm h-64 bg-black rounded-xl overflow-hidden border border-neutral-800 flex items-center justify-center">
            {/* Target DOM container for Html5Qrcode */}
            <div id={scannerContainerId} className="w-full h-full" />

            {/* Simulated Laser Reticle Overlay */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-64 h-36 border-2 border-dashed border-purple-500/60 rounded-lg relative flex items-center justify-center">
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent shadow-[0_0_12px_#a855f7] animate-pulse" />
                <span className="absolute bottom-1 text-[10px] font-mono text-purple-300/80 bg-neutral-950/80 px-2 py-0.5 rounded">
                  Align Barcode Inside Frame
                </span>
              </div>
            </div>

            {/* Error or Fallback Message */}
            {cameraError && (
              <div className="absolute inset-0 bg-neutral-950/90 p-4 flex flex-col items-center justify-center text-center space-y-2 z-10">
                <AlertCircle className="w-8 h-8 text-amber-400" />
                <div className="text-xs text-neutral-200 font-medium">Camera Feed Standby</div>
                <p className="text-[11px] text-neutral-400 max-w-xs">
                  {cameraError}
                </p>
                <div className="text-[11px] text-purple-400 pt-1 font-mono">
                  Use the quick-scan sample barcodes below or enter manual code.
                </div>
              </div>
            )}
          </div>

          {/* Last Scanned Feedback */}
          {lastScanned && (
            <div className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-xs font-mono flex items-center gap-2">
              <Check className="w-3.5 h-3.5" />
              <span>Scanned Code: {lastScanned}</span>
            </div>
          )}
        </div>

        {/* Manual Barcode Entry */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-900/60 space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manualCode.trim()) {
                handleSuccessfulScan(manualCode.trim());
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
                placeholder="Type barcode or SKU..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono placeholder-neutral-500 focus:outline-none focus:border-purple-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors whitespace-nowrap"
            >
              Add Item
            </button>
          </form>

          {/* Quick Test Barcode Buttons */}
          <div>
            <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Quick-Simulate Barcode Scan (From Catalog):</span>
              <Volume2 className="w-3 h-3 text-purple-400" />
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
              {products.slice(0, 6).map((prod) => (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => handleSuccessfulScan(prod.barcode)}
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
        </div>
      </div>
    </div>
  );
};
