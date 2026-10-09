import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-neutral-950 text-white">
      <h2 className="text-xl font-bold">404 - Page Not Found</h2>
      <p className="text-neutral-400 mt-2 text-sm">The requested page could not be found.</p>
      <Link href="/" className="mt-4 px-4 py-2 bg-purple-600 rounded-lg text-xs font-semibold hover:bg-purple-500 transition-colors">
        Return to Dashboard
      </Link>
    </div>
  );
}
