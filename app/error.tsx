'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-[var(--bg-app)] text-[var(--text-primary)]">
      <h2 className="text-xl font-bold">Something went wrong</h2>
      <p className="text-[var(--text-secondary)] mt-2 text-sm">{error.message || 'An unexpected error occurred'}</p>
      <button
        onClick={() => reset()}
        className="mt-4 px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
      >
        Try again
      </button>
    </div>
  );
}
