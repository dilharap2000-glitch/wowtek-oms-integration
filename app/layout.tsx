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
      <body className="bg-neutral-950 text-neutral-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
