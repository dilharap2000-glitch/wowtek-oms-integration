import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WOWTEK Pro - Order Management System & POS Automation',
  description:
    'Centralized Order Management & Business Automation System for Sri Lankan retail and e-commerce with multi-channel integration, Trans Express logistics, barcode GRN, and warranty tracking.',
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen selection:bg-purple-500/30 selection:text-purple-200">
        {children}
      </body>
    </html>
  );
}
