import { NextRequest, NextResponse } from 'next/server';
import { getUberSandboxStatus, runUberSandboxValidation } from '@/lib/uberSandboxValidation';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function applyCors(res: NextResponse): NextResponse {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  const res = await getUberSandboxStatus();
  return applyCors(res);
}

export async function POST(req: NextRequest) {
  const res = await runUberSandboxValidation(req);
  return applyCors(res);
}
