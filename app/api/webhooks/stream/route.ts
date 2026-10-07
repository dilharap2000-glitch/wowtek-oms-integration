import { NextRequest } from 'next/server';
import { subscribeToLiveUpdates } from '@/lib/serverStore';

export const dynamic = 'force-dynamic';

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
