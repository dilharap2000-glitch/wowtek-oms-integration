'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Code,
  FileText,
  MoreHorizontal,
  Printer,
  RotateCcw,
  X,
} from 'lucide-react';

export type OrderActionType = 'ACCEPT' | 'READY' | 'CANCEL';

interface OrderActionCellProps {
  orderId: string;
  status: string;
  loading?: boolean;
  isUberOrder?: boolean;
  readyLabel?: string;
  onAction?: (orderId: string, action: OrderActionType, reason?: string) => Promise<void> | void;
  onViewJson?: () => void;
  onPrintLabel?: () => void;
  onPrintInvoice?: () => void;
  onReturnOrder?: () => Promise<void> | void;
  returning?: boolean;
}

export function OrderActionCell({
  orderId,
  status,
  loading = false,
  isUberOrder = true,
  readyLabel = 'Ready',
  onAction,
  onViewJson,
  onPrintLabel,
  onPrintInvoice,
  onReturnOrder,
  returning = false,
}: OrderActionCellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingReturn, setConfirmingReturn] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const normalized = String(status || '').toUpperCase();
  const isPending =
    normalized === 'PENDING_ACCEPTANCE' ||
    normalized === 'CREATED' ||
    normalized === 'PENDING' ||
    normalized === 'NEW' ||
    normalized.includes('PENDING');
  const isProcessing =
    normalized === 'ACCEPTED' ||
    normalized === 'PROCESSING' ||
    normalized.includes('PROCESSING') ||
    normalized.includes('PREPARING') ||
    normalized.includes('ACCEPTED');
  const isReady = normalized === 'READY_FOR_PICKUP' || normalized === 'READY';
  const isCancelled = normalized === 'CANCELLED' || normalized === 'CANCEL' || normalized.includes('CANCEL');
  const isDone =
    isReady ||
    isCancelled ||
    normalized.includes('RETURN') ||
    normalized.includes('COMPLETE') ||
    normalized.includes('DELIVERED');

  useEffect(() => {
    if (!menuOpen) {
      setConfirmingReturn(false);
      return;
    }
    const handleOutsideClick = (e: Event) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [menuOpen]);

  const canCancel = isUberOrder && Boolean(onAction) && (isPending || isProcessing || (!isDone && normalized === ''));
  const hasDropdownItems = Boolean(onPrintLabel || onPrintInvoice || onViewJson || onReturnOrder || canCancel);

  return (
    <div ref={containerRef} className="relative flex items-center justify-end gap-2 touch-manipulation">
      {/* 1. Primary Status Action or Completion Badge */}
      {isUberOrder && onAction && isPending ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAction(orderId, 'ACCEPT');
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 active:scale-95 dark:bg-emerald-600 dark:hover:bg-emerald-500 px-3 py-1.5 min-h-[34px] text-xs font-semibold text-white shadow-sm transition cursor-pointer touch-manipulation select-none whitespace-nowrap"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Accept</span>
        </button>
      ) : isUberOrder && onAction && isProcessing ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAction(orderId, 'READY');
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-95 px-3 py-1.5 min-h-[34px] text-xs font-semibold text-white shadow-sm transition cursor-pointer touch-manipulation select-none whitespace-nowrap"
        >
          <Check className="w-3.5 h-3.5" />
          <span>{readyLabel}</span>
        </button>
      ) : isUberOrder && isReady ? (
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 whitespace-nowrap">
          ✓ Ready for Pickup
        </span>
      ) : isUberOrder && isCancelled ? (
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 whitespace-nowrap">
          Cancelled
        </span>
      ) : null}

      {/* 2. Secondary Actions & Cancel -> Clean Dropdown */}
      {hasDropdownItems && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen((prev) => !prev);
          }}
          className="inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 min-h-[34px] min-w-[34px] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition cursor-pointer touch-manipulation select-none"
          title="More actions"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      )}

      {menuOpen && (
        <div
          className="absolute right-0 top-10 z-50 w-44 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5 text-left shadow-xl"
        >
          {onPrintLabel && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen(false);
                onPrintLabel();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer touch-manipulation"
            >
              <Printer className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
              <span>4x6 Label</span>
            </button>
          )}

          {onPrintInvoice && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen(false);
                onPrintInvoice();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer touch-manipulation"
            >
              <FileText className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0" />
              <span>A4 Invoice</span>
            </button>
          )}

          {onViewJson && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen(false);
                onViewJson();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer touch-manipulation"
            >
              <Code className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
              <span>View JSON</span>
            </button>
          )}

          {onReturnOrder && (
            confirmingReturn ? (
              <div className="mt-1 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-1.5 space-y-1">
                <div className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 px-1">
                  Confirm Return &amp; Restock?
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={returning}
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      await onReturnOrder();
                      setMenuOpen(false);
                      setConfirmingReturn(false);
                    }}
                    className="flex-1 rounded px-2 py-1 text-[11px] font-semibold bg-amber-600 hover:bg-amber-500 text-white cursor-pointer disabled:opacity-50 touch-manipulation"
                  >
                    {returning ? '...' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirmingReturn(false);
                    }}
                    className="rounded px-2 py-1 text-[11px] font-medium bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] cursor-pointer touch-manipulation"
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setConfirmingReturn(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors cursor-pointer touch-manipulation"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span>Return Order</span>
              </button>
            )
          )}

          {canCancel && onAction && (
            <>
              {(onPrintLabel || onPrintInvoice || onViewJson || onReturnOrder) && (
                <div className="my-1 border-t border-[var(--border-subtle)]" />
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuOpen(false);
                  onAction(orderId, 'CANCEL', 'POS_NOT_READY');
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 transition-colors cursor-pointer touch-manipulation"
              >
                <X className="w-3.5 h-3.5 shrink-0" />
                <span>Cancel Order</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
