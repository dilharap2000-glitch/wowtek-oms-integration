import { NextRequest, NextResponse } from 'next/server';
import { broadcastLiveUpdate, saveServerWebhookEvent, subscribeToLiveUpdates } from '@/lib/serverStore';
import { connectToMongoDB } from '@/lib/mongodb';
import { WebhookEvent } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * Hintergrundverarbeitung für Stream-Events:
 * Führt MongoDB-Updates und Live-Broadcasting im Hintergrund aus.
 */
async function processBackgroundTasks(body: any) {
  try {
    const now = new Date().toISOString();

    // 1. Live SSE Broadcast across connected dashboards
    broadcastLiveUpdate(body?.type ? body : { type: 'webhook_stream_event', data: body, timestamp: now });

    // 2. Persist to MongoDB webhook events if applicable
    const evt: WebhookEvent = {
      id: `evt-stream-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      source: body.source || (body.channel === 'ubereats' ? 'ubereats' : 'stream'),
      event: body.event || body.event_type || 'stream.message',
      orderId: body.order_id || body.id || 'N/A',
      invoiceNumber: body.invoiceNumber || (body.order_id ? `WT-${body.order_id}` : 'N/A'),
      storeId: body.store_id || 'stream-hub',
      storeName: body.store_name || 'Live Webhook Stream',
      branchName: body.branch_name || 'Central Hub',
      amount: parseFloat(body.total || body.amount || 0),
      status: 'success',
      orderStatus: body.status || 'Completed',
      rawPayload: body,
      receivedAt: now,
    };

    saveServerWebhookEvent(evt);

    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      await mongoConn.db.collection('webhook_events').updateOne(
        { id: evt.id },
        { $set: evt },
        { upsert: true }
      );
    }
  } catch (err: any) {
    console.warn('[Webhook Stream Background Task Warn]:', err?.message);
  }
}

/**
 * POST /api/webhooks/stream
 * Sendet sofort eine 200 OK Antwort an Uber/Stream, um Vercel-Timeouts zu verhindern.
 */
export async function POST(req: NextRequest | Request) {
  try {
    const body = await req.json();

    // 1. Sofortige 200 OK Antwort zurückgeben
    const immediateResponse = NextResponse.json({ status: 'success' }, { status: 200 });

    // 2. Hintergrundprozesse starten, ohne auf deren Beendigung zu warten
    processBackgroundTasks(body).catch((err) => console.error('Background Task Error:', err));

    return immediateResponse;
  } catch (error) {
    console.error('Webhook Stream Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * GET /api/webhooks/stream
 * Server-Sent Events (SSE) live push stream.
 * Automatically broadcasts incoming WooCommerce webhooks, orders, waybills, and events
 * to all open dashboards in real-time with zero polling latency.
 */
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`)
      );

      // Subscribe to real-time events from serverStore
      unsubscribe = subscribeToLiveUpdates((payload) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          // Stream might be closed
        }
      });

      // Keepalive heartbeat every 15s to prevent proxy timeouts
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 15000);

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
