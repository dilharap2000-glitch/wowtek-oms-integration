import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WOWTEK Pro - Order Management System & POS Automation',
  description:
    'Centralized Order Management & Business Automation System for Sri Lankan retail and e-commerce with multi-channel integration, Trans Express logistics, barcode GRN, and warranty tracking.',
};

export const viewport: Viewport = {
  themeColor: '#0F766E',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

const themeInitScript = `
(function() {
  try {
    var saved = localStorage.getItem('wowtek_theme') || localStorage.getItem('wowtek-theme');
    var theme = saved === 'midnight-emerald' ? 'midnight-emerald' : 'warm-daylight';
    var root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (theme === 'midnight-emerald') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="warm-daylight" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased min-h-screen selection:bg-[var(--accent-primary)]/20">
        {children}
      </body>
    </html>
  );
}
