'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export type ThemeMode = 'warm-daylight' | 'midnight-emerald';

const THEME_STORAGE_KEY = 'wowtek_theme';
const LEGACY_THEME_STORAGE_KEY = 'wowtek-theme';
const THEME_CHANGE_EVENT = 'wowtek-theme-change';

export function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'warm-daylight';
  try {
    const saved =
      localStorage.getItem(THEME_STORAGE_KEY) ||
      localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
    return saved === 'midnight-emerald' ? 'midnight-emerald' : 'warm-daylight';
  } catch {
    return 'warm-daylight';
  }
}

export function applyThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
    localStorage.setItem(LEGACY_THEME_STORAGE_KEY, mode);
  } catch {
    // Ignore storage failures
  }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.classList.toggle('dark', mode === 'midnight-emerald');
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<ThemeMode>(THEME_CHANGE_EVENT, { detail: mode }));
  }
}

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeMode>('warm-daylight');

  useEffect(() => {
    const initial = readStoredTheme();
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
    document.documentElement.classList.toggle('dark', initial === 'midnight-emerald');

    const handleSync = (event: Event) => {
      const next = (event as CustomEvent<ThemeMode>).detail;
      if (next === 'warm-daylight' || next === 'midnight-emerald') {
        setTheme(next);
      }
    };

    window.addEventListener(THEME_CHANGE_EVENT, handleSync);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, handleSync);
  }, []);

  const toggleTheme = () => {
    const next: ThemeMode = theme === 'warm-daylight' ? 'midnight-emerald' : 'warm-daylight';
    setTheme(next);
    applyThemeMode(next);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] shadow-sm transition hover:bg-[var(--bg-subtle)] cursor-pointer whitespace-nowrap"
      title="Switch UI Theme"
    >
      {theme === 'warm-daylight' ? (
        <>
          <Sun className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Warm Daylight</span>
        </>
      ) : (
        <>
          <Moon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Midnight Emerald</span>
        </>
      )}
    </button>
  );
}
