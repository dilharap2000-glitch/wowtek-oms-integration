import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { getServerStore, clearServerWebhookEvents } from '@/lib/serverStore';
import { DEFAULT_WEBHOOK_EVENTS } from '@/lib/db';
import { WebhookEvent } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/webhooks/events
 * Returns the latest incoming webhook transaction audit log directly from MongoDB Atlas
 */
export async function GET() {
  try {
    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      const events = await mongoConn.db
        .collection('webhook_events')
        .find({})
        .sort({ receivedAt: -1 })
        .limit(100)
        .toArray();
      if (events.length > 0) {
        const clean = events.map(({ _id, ...rest }) => rest as WebhookEvent);
        return NextResponse.json({ success: true, count: clean.length, events: clean });
      }
    }
  } catch (err: any) {
    console.warn('[Webhook Events API GET] MongoDB read error:', err.message);
  }

  const store = getServerStore();
  const finalEvents = store.webhookEvents.length > 0 ? store.webhookEvents : DEFAULT_WEBHOOK_EVENTS;
  return NextResponse.json({
    success: true,
    count: finalEvents.length,
    events: finalEvents,
  });
}

/**
 * DELETE /api/webhooks/events
 * Clears or resets the audit log in MongoDB Atlas
 */
export async function DELETE() {
  try {
    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      await mongoConn.db.collection('webhook_events').deleteMany({});
    }
  } catch (err: any) {
    console.warn('[Webhook Events API DELETE] MongoDB delete error:', err.message);
  }

  clearServerWebhookEvents();

  return NextResponse.json({
    success: true,
    message: 'Webhook audit events reset to baseline.',
    events: DEFAULT_WEBHOOK_EVENTS,
  });
}
