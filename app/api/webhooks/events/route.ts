import { NextRequest, NextResponse } from 'next/server';
import { getWebhookEvents, clearWebhookEvents, saveWebhookEvent } from '@/lib/db';
import { WebhookEvent } from '@/types';

/**
 * GET /api/webhooks/events
 * Returns the latest incoming webhook transaction audit log
 */
export async function GET() {
  const events = await getWebhookEvents();
  return NextResponse.json({
    success: true,
    count: events.length,
    events,
  });
}

/**
 * DELETE /api/webhooks/events
 * Clears or resets the audit log
 */
export async function DELETE() {
  await clearWebhookEvents();
  const resetEvents = await getWebhookEvents();
  return NextResponse.json({
    success: true,
    message: 'Webhook audit events reset to baseline.',
    events: resetEvents,
  });
}
