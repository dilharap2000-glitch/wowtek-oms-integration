import { NextRequest } from 'next/server';
import {
  handleV2Put,
  handleV2Get,
  handleOptions,
} from '@/lib/deliveryApiHandlers';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  return handleV2Get(request);
}

export async function PUT(request: NextRequest) {
  // PUT /v2/eats/stores/{id}/menus (Upload Menu)
  return handleV2Put(request);
}
