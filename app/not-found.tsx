import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-[var(--bg-app)] text-[var(--text-primary)]">
      <h2 className="text-xl font-bold">404 - Page Not Found</h2>
      <p className="text-[var(--text-secondary)] mt-2 text-sm">The requested page could not be found.</p>
      <Link href="/" className="mt-4 px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-semibold transition-colors">
        Return to Dashboard
      </Link>
    </div>
  );
}
