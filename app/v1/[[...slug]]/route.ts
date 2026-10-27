import { NextRequest, NextResponse } from 'next/server';
import {
  handleV1Get,
  handleV1Post,
  handleV1Patch,
  handleV1Delete,
  handleOptions,
} from '@/lib/deliveryApiHandlers';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

// 1. Store Management & Activation Endpoints
export async function GET(request: NextRequest) {
  // GET /v1/eats/stores, /v1/delivery/stores, or /v1/delivery/store/{id}, /v1/eats/stores/{id}/pos_data
  return handleV1Get(request);
}

export async function POST(request: NextRequest) {
  return handleV1Post(request);
}

export async function PATCH(request: NextRequest) {
  // PATCH /v1/eats/stores/{id}/pos_data
  return handleV1Patch(request);
}

export async function DELETE(request: NextRequest) {
  // DELETE /v1/eats/stores/{id}/pos_data (Store deprovisioning)
  return handleV1Delete(request);
}
