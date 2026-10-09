'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-neutral-950 text-white">
      <h2 className="text-xl font-bold">Something went wrong</h2>
      <p className="text-neutral-400 mt-2 text-sm">{error.message || 'An unexpected error occurred'}</p>
      <button
        onClick={() => reset()}
        className="mt-4 px-4 py-2 bg-purple-600 rounded-lg text-xs font-semibold hover:bg-purple-500 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
