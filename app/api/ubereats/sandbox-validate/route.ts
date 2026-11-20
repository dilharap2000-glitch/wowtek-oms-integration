import { NextRequest } from 'next/server';
import { getUberSandboxStatus, runUberSandboxValidation } from '@/lib/uberSandboxValidation';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET() {
  return getUberSandboxStatus();
}

export async function POST(req: NextRequest) {
  return runUberSandboxValidation(req);
}
