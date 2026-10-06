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
  ZoomIn,
  Sparkle,
  Zap,
  ZapOff,
} from 'lucide-react';
import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  BinaryBitmap,
  GlobalHistogramBinarizer,
  RGBLuminanceSource,
} from '@zxing/library';
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
  engine?: string;
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

// ---------------------------------------------------------------------------
// Fast Otsu Binarization Thresholding: Maximizes inter-class variance
// ---------------------------------------------------------------------------
function calculateOtsuThreshold(gray: Uint8Array, totalPixels: number): number {
  const hist = new Int32Array(256);
  for (let i = 0; i < totalPixels; i++) {
    hist[gray[i]]++;
  }

  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * hist[i];
  }

  let sumB = 0;
  let wB = 0;
  let varMax = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = totalPixels - wB;
    if (wF === 0) break;

    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) * (mB - mF);

    if (varBetween > varMax) {
      varMax = varBetween;
      threshold = t;
    }
  }

  return threshold;
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
  const [continuousMode, setContinuousMode] = useState(!singleScanMode);
  // 2x Digital Macro Zoom enabled by default for small barcodes
  const [macroZoomEnabled, setMacroZoomEnabled] = useState(true);
  const [unknownItemPrompt, setUnknownItemPrompt] = useState<UnknownBarcodePrompt | null>(null);
  const [focusRing, setFocusRing] = useState<FocusRingCoord | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const activeTrackRef = useRef<MediaStreamTrack | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const lastScannedCodeRef = useRef<string>('');
  const lastScanTimestampRef = useRef<number>(0);
  const zxingReaderRef = useRef<MultiFormatReader | null>(null);
  const nativeDetectorRef = useRef<any>(null);

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
  // Initialize Decoders with Format Focus (EAN-13, EAN-8, Code-128, etc.)
  // -------------------------------------------------------------------------
  const initDecoders = useCallback(() => {
    // 1. ZXing Engine configured specifically for 1D retail barcodes
    const hints = new Map<DecodeHintType, any>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.CODE_128,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_39,
      BarcodeFormat.QR_CODE,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new MultiFormatReader();
    reader.setHints(hints);
    zxingReaderRef.current = reader;

    // 2. Native Hardware BarcodeDetector (if available on browser)
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        nativeDetectorRef.current = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e', 'code_39', 'qr_code'],
        });
      } catch {
        nativeDetectorRef.current = null;
      }
    }
  }, []);

  // -------------------------------------------------------------------------
  // Process Decoded Barcode (Lookup or Fallback Prompt)
  // Requirement 2: Auto-dismisses/updates open modal on new direct input
  // -------------------------------------------------------------------------
  const handleDecodedBarcode = useCallback(
    (rawCode: string, isManual = false, engineName = '2x Macro Engine') => {
      const code = rawCode.trim();
      if (!code) return;

      const now = Date.now();

      // Debounce duplicate reads of the exact same barcode within 900ms
      if (!isManual && code === lastScannedCodeRef.current && now - lastScanTimestampRef.current < 900) {
        return;
      }
      // Debounce rapid sequential reads of distinct codes to 350ms
      if (!isManual && now - lastScanTimestampRef.current < 350) {
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
        // MATCH FOUND:
        // Requirement 2: Auto-dismiss uncataloged prompt if one was open!
        setUnknownItemPrompt(null);

        playScanSuccessBeep();
        setFeedback({
          type: 'success',
          title: foundProduct.name,
          message: `Added to cart · Rs. ${foundProduct.sellingPrice.toLocaleString()}`,
          code: foundProduct.barcode || foundProduct.sku,
          engine: engineName,
          timestamp: now,
        });

        onScan(foundProduct.barcode || code);

        if (singleScanMode || !continuousMode) {
          setTimeout(() => {
            if (isMountedRef.current) onClose();
          }, 600);
        }
      } else {
        // MATCH NOT FOUND (Uncataloged Barcode):
        playAlertTone();
        setFeedback({
          type: 'alert',
          title: `Item not found in stock: [${code}]`,
          message: `Prompting quick-add custom item to cart...`,
          code,
          engine: engineName,
          timestamp: now,
        });

        // Requirement 2: Instantly update / auto-refresh the open modal with the new code
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
  // 2x Digital Macro Crop + Dynamic Otsu Binarization Loop
  // -------------------------------------------------------------------------
  const processFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.paused || video.ended) {
      return;
    }

    const vWidth = video.videoWidth;
    const vHeight = video.videoHeight;
    if (vWidth <= 0 || vHeight <= 0) return;

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    const canvas = offscreenCanvasRef.current;

    // Requirement 1: Digital Crop & Macro Zoom (2x digital scale on center frame buffer)
    // Center 50% width and height is extracted so user can hold phone 15-20cm away where focus is sharp
    const scaleFactor = macroZoomEnabled ? 0.5 : 0.85;
    const cropW = Math.floor(vWidth * scaleFactor);
    const cropH = Math.floor(Math.min(vHeight * scaleFactor, cropW * 0.6));
    const cropX = Math.floor((vWidth - cropW) / 2);
    const cropY = Math.floor((vHeight - cropH) / 2);

    if (canvas.width !== cropW || canvas.height !== cropH) {
      canvas.width = cropW;
      canvas.height = cropH;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Draw sharp center pixels to offscreen canvas
    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    // 1. Try Hardware GPU BarcodeDetector first on the sharp macro crop
    if (nativeDetectorRef.current) {
      try {
        const barcodes = await nativeDetectorRef.current.detect(canvas);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          handleDecodedBarcode(barcodes[0].rawValue, false, 'Native GPU Macro');
          return;
        }
      } catch {
        // Fallback to ZXing Otsu
      }
    }

    // 2. Requirement 3: Dynamic Otsu Contrast Thresholding for Small/Low-Contrast Prints
    if (zxingReaderRef.current) {
      try {
        const imgData = ctx.getImageData(0, 0, cropW, cropH);
        const data = imgData.data;
        const total = cropW * cropH;
        const gray = new Uint8Array(total);

        // Fast integer grayscale extraction
        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
          gray[j] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
        }

        // Calculate Otsu threshold in ~2ms
        const threshold = calculateOtsuThreshold(gray, total);

        // Apply binary sharpening: bars become crisp solid black, background becomes pure white
        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
          const val = gray[j] < threshold ? 0 : 255;
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        }

        // Feed sharpened binary buffer into ZXing GlobalHistogramBinarizer
        const luminanceSource = new RGBLuminanceSource(data, cropW, cropH);
        const binaryBitmap = new BinaryBitmap(new GlobalHistogramBinarizer(luminanceSource));
        const result = zxingReaderRef.current.decode(binaryBitmap);

        if (result && result.getText()) {
          const formatName = result.getBarcodeFormat
            ? BarcodeFormat[result.getBarcodeFormat()]
            : 'Otsu-Sharp';
          handleDecodedBarcode(result.getText(), false, `2x Macro ${formatName}`);
        }
      } catch {
        // NotFoundException is normal when no barcode is in view
      }
    }
  }, [handleDecodedBarcode, macroZoomEnabled]);

  // -------------------------------------------------------------------------
  // Non-Blocking High-FPS Scan Loop (80ms lightweight interval)
  // -------------------------------------------------------------------------
  const startScanLoop = useCallback(() => {
    const scanLoop = (timestamp: number) => {
      if (!isScanningRef.current) return;

      if (
        !isProcessingRef.current &&
        timestamp - lastScanTimestampRef.current >= 80
      ) {
        lastScanTimestampRef.current = timestamp;
        isProcessingRef.current = true;

        processFrame()
          .catch(() => {})
          .finally(() => {
            isProcessingRef.current = false;
          });
      }

      animationFrameRef.current = requestAnimationFrame(scanLoop);
    };

    animationFrameRef.current = requestAnimationFrame(scanLoop);
  }, [processFrame]);

  // -------------------------------------------------------------------------
  // Stop Scanner Safely
  // -------------------------------------------------------------------------
  const stopScanner = useCallback(() => {
    isScanningRef.current = false;
    isProcessingRef.current = false;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      mediaStreamRef.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch {}
    }

    activeTrackRef.current = null;
    setCameraActive(false);
    setCameraLoading(false);
    setTorchOn(false);
    setTorchSupported(false);
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

    const track = activeTrackRef.current as any;
    if (!track) return;

    try {
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      if (capabilities && capabilities.focusMode) {
        await track
          .applyConstraints({
            advanced: [{ focusMode: 'continuous' }],
          })
          .catch(() => {});
      }
    } catch {
      // Re-focus unsupported on sensor
    }
  }, []);

  const handleTapVideo = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    triggerRefocus({ x, y });
  };

  // Toggle Flashlight
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
  // Initialize Camera Stream (Standard 720p, Continuous Focus)
  // -------------------------------------------------------------------------
  const startScanner = useCallback(async () => {
    stopScanner();
    setCameraError(null);
    setCameraLoading(true);

    try {
      initDecoders();

      // Standard 720p stream constraint (lightweight, zero freeze on mobile)
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          // @ts-ignore
          focusMode: 'continuous',
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      if (track) {
        activeTrackRef.current = track;

        // Check capabilities for continuous focus and torch
        try {
          const capabilities = track.getCapabilities ? (track.getCapabilities() as any) : {};
          if (capabilities && 'torch' in capabilities) {
            setTorchSupported(true);
          }
          if (capabilities && capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
            await (track as any)
              .applyConstraints({
                advanced: [{ focusMode: 'continuous' }],
              })
              .catch(() => {});
          }
        } catch {}
      }

      const videoElement = videoRef.current;
      if (!videoElement) {
        setCameraLoading(false);
        return;
      }

      videoElement.srcObject = stream;
      await videoElement.play().catch(() => {});

      isScanningRef.current = true;
      setCameraActive(true);
      setCameraLoading(false);

      // Start non-blocking requestAnimationFrame loop
      startScanLoop();
    } catch (err: any) {
      console.warn('Camera initialization error', err);
      stopScanner();
      setCameraError(
        err?.message ||
          'Camera permission denied or camera device unavailable. You can use manual entry or tap Restart Camera.'
      );
    }
  }, [initDecoders, startScanLoop, stopScanner]);

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
      startScanner();
    }, 120);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen, startScanner, stopScanner]);

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
      engine: 'Manual Custom Item',
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
      handleDecodedBarcode(manualCode.trim(), true, 'Manual Keypad');
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
                  {macroZoomEnabled ? '2x Macro Zoom · Otsu Sharp' : '1x Wide · Otsu Sharp'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">{description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Flashlight Button */}
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

            {/* Restart Camera */}
            <button
              type="button"
              onClick={() => startScanner()}
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

        {/* Viewfinder Viewport with Macro Zoom & Re-Focus Controls */}
        <div className="p-4 flex flex-col items-center justify-center bg-neutral-950 space-y-3">
          {/* Top Bar with Macro Zoom Toggle & Explicit Re-Focus Button */}
          <div className="w-full flex items-center justify-between text-xs px-1 text-neutral-400">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => triggerRefocus()}
                className="flex items-center gap-1.5 text-[11px] text-purple-300 hover:text-purple-200 bg-purple-950/60 hover:bg-purple-900/60 px-2.5 py-1 rounded-lg border border-purple-800/60 transition-colors"
              >
                <Focus className="w-3.5 h-3.5 text-purple-400" />
                <span>Tap to Re-Focus</span>
              </button>

              {/* Requirement 1: Macro Zoom Toggle (2x Digital Scale) */}
              <button
                type="button"
                onClick={() => setMacroZoomEnabled(!macroZoomEnabled)}
                className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                  macroZoomEnabled
                    ? 'bg-amber-950/70 border-amber-600/70 text-amber-300 font-medium'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
                title="Hold phone 15-20cm away where lens focuses sharply while 2x Macro zooms center"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span>{macroZoomEnabled ? '2x Macro Zoom (Active)' : '1x Wide'}</span>
              </button>
            </div>

            <span className="text-[10px] font-mono text-neutral-500">
              EAN·13 / 8 / 128 / UPC
            </span>
          </div>

          {/* Video Container with Tap-to-Refocus */}
          <div
            onClick={handleTapVideo}
            className={`relative w-full h-72 sm:h-80 bg-black rounded-xl overflow-hidden border cursor-crosshair transition-all duration-300 flex items-center justify-center select-none ${
              isFlashing
                ? 'border-emerald-400 ring-4 ring-emerald-500/50 shadow-[0_0_35px_#10b981]'
                : 'border-neutral-800'
            }`}
          >
            {/* Native Video Element */}
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className={`w-full h-full object-cover rounded-xl transition-transform duration-300 ${
                macroZoomEnabled ? 'scale-125' : 'scale-100'
              }`}
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

            {/* Viewfinder Overlay with Macro Sweet-Spot Framing */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-3">
              <div
                className={`w-[82%] max-w-[420px] h-[170px] sm:h-[195px] border-2 border-dashed rounded-xl relative flex items-center justify-center transition-all duration-300 ${
                  isFlashing
                    ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_25px_#10b981]'
                    : 'border-purple-500/80 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                }`}
              >
                {/* 4 Corner Accents */}
                <div
                  className={`absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 ${
                    isFlashing ? 'border-emerald-300' : 'border-purple-400'
                  }`}
                />
                <div
                  className={`absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 ${
                    isFlashing ? 'border-emerald-300' : 'border-purple-400'
                  }`}
                />
                <div
                  className={`absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 ${
                    isFlashing ? 'border-emerald-300' : 'border-purple-400'
                  }`}
                />
                <div
                  className={`absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 ${
                    isFlashing ? 'border-emerald-300' : 'border-purple-400'
                  }`}
                />

                {/* Laser Sweep Guide */}
                <div
                  className={`w-full h-0.5 animate-pulse shadow-md ${
                    isFlashing
                      ? 'bg-emerald-400 shadow-emerald-400'
                      : 'bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-red-500'
                  }`}
                />

                {/* Dynamic Status Tag */}
                {isFlashing ? (
                  <span className="absolute bottom-2 text-[10px] font-mono font-bold text-emerald-200 bg-emerald-950/90 px-3 py-0.5 rounded border border-emerald-500 flex items-center gap-1.5 shadow-lg">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    BARCODE DECODED
                  </span>
                ) : (
                  <span className="absolute bottom-2 text-[10px] font-mono text-neutral-200 bg-black/80 px-2.5 py-0.5 rounded border border-white/20 flex items-center gap-1">
                    <Sparkle className="w-3 h-3 text-amber-400" />
                    {macroZoomEnabled
                      ? 'Hold 15-20cm away · 2x Macro Sharp'
                      : 'Standard View · Tap to Re-Focus'}
                  </span>
                )}
              </div>
            </div>

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
                  onClick={() => startScanner()}
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
              <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/60 border border-white/10 text-white">
                  {feedback.code}
                </span>
                {feedback.engine && (
                  <span className="text-[9px] font-mono text-neutral-400">{feedback.engine}</span>
                )}
              </div>
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
              <span className="text-[11px]">Continuous Scanning (Non-Blocking)</span>
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
        {/* UNKNOWN BARCODE PROMPT (AUTO-UPDATE ON NEW SCANNED CODES)           */}
        {/* Requirement 2: Never blocks scanning; updates on new input          */}
        {/* ------------------------------------------------------------------- */}
        {unknownItemPrompt && (
          <div className="p-4 bg-amber-950/40 border-t border-b border-amber-800/80 animate-in fade-in duration-150">
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
                Item not in stock. Quick-add this SKU to POS Cart? (Scanner is still live: scanning another code updates this immediately)
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
                    onClick={() => handleDecodedBarcode(prod.barcode, true, 'Catalog Click')}
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
