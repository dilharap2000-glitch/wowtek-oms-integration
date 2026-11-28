import { ObjectId } from 'mongodb';
import {
  getServerStore,
  saveServerOrder,
  saveServerWebhookEvent,
  broadcastLiveUpdate,
} from '@/lib/serverStore';
import { connectToMongoDB } from '@/lib/mongodb';
import {
  acceptUberEatsOrder,
  executeUberOrderAction,
  resolveUberConfigurationAsync,
  type UberOrderAction,
  type UberOrderActionResult,
} from '@/lib/uberClient';
import { resolveOrderChannel } from '@/lib/orderFilters';
import type { OrderStatus } from '@/types';

const ACTION_MAP: Record<string, UberOrderAction> = {
  ACCEPT: 'ACCEPT',
  ACCEPTED: 'ACCEPT',
  READY: 'READY',
  FOOD_READY: 'READY',
  READY_FOR_PICKUP: 'READY',
  CANCEL: 'CANCEL',
  DENY: 'CANCEL',
  CANCELLED: 'CANCEL',
};

const NEXT_STATUS_MAP: Record<UberOrderAction, OrderStatus> = {
  ACCEPT: 'ACCEPTED',
  READY: 'READY_FOR_PICKUP',
  CANCEL: 'CANCELLED',
};

// Prevent duplicate concurrent Uber API requests for the same order + action
const inFlightOrderActions = new Set<string>();

function extractUberUuidFromRecord(doc: Record<string, any> | null | undefined): string {
  if (!doc) return '';
  const candidates = [
    doc.uberOrderId,
    doc.uber_order_id,
    doc.rawPayload?.meta?.resource_id,
    doc.rawPayload?.order?.id,
    typeof doc.orderId === 'string' && doc.orderId.length >= 20 ? doc.orderId : '',
    typeof doc.order_id === 'string' && doc.order_id.length >= 20 ? doc.order_id : '',
    typeof doc.id === 'string' && doc.id.length >= 20 && !doc.id.startsWith('ord-') ? doc.id : '',
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) {
      return c.trim();
    }
  }
  return '';
}

export interface ProcessUberActionResponse {
  httpStatus: number;
  body: {
    ok: boolean;
    success: boolean;
    synced: boolean;
    uberSynced: boolean;
    alreadyAccepted?: boolean;
    duplicate?: boolean;
    orderId?: string;
    uberOrderId?: string;
    action?: UberOrderAction;
    status?: string;
    nextStatus?: string;
    preservedStatus?: string;
    uberStatus?: number | string;
    uberStatusCode?: number | string;
    uberApiHost?: string | null;
    uberError?: string | null;
    uberResponse?: unknown;
    mongoPersisted?: boolean;
    matchedCount?: number;
    modifiedCount?: number;
    note?: string;
    error?: string;
    message?: string;
  };
}

export async function processUberOrderAction(params: {
  orderId?: unknown;
  action?: unknown;
  storeId?: unknown;
  reason?: unknown;
}): Promise<ProcessUberActionResponse> {
  let lockKey = '';
  try {
    const rawAction = String(params.action || '').trim().toUpperCase();
    const rawOrderId = params.orderId ? String(params.orderId) : '';
    const storeId = params.storeId ? String(params.storeId) : undefined;
    const rawReason = params.reason;
    const reasonCode =
      typeof rawReason === 'string'
        ? rawReason.trim()
        : rawReason && typeof rawReason === 'object' && 'code' in rawReason
        ? String((rawReason as { code?: unknown }).code || '').trim()
        : undefined;

    if (!rawOrderId) {
      return {
        httpStatus: 400,
        body: { ok: false, success: false, synced: false, uberSynced: false, error: 'Order ID is required.' },
      };
    }

    const action = ACTION_MAP[rawAction];
    if (!action) {
      return {
        httpStatus: 400,
        body: {
          ok: false,
          success: false,
          synced: false,
          uberSynced: false,
          error: `Invalid action: ${rawAction || String(params.action || '')}`,
        },
      };
    }

    const order_id = rawOrderId.replace(/^#/, '').trim();
    const cleanInputId = order_id.replace(/^UBER-/i, '');
    const validObjectId = ObjectId.isValid(order_id) ? new ObjectId(order_id) : null;
    const resolvedUberConfig = await resolveUberConfigurationAsync();
    const isSandbox = resolvedUberConfig.env === 'sandbox';

    // 1. Validate order & resolve the original Uber Eats order_id UUID (MongoDB primary `orders` collection first)
    let uberOrderUuid = '';
    let matchedDoc: Record<string, any> | null = null;
    let primaryOrderDoc: Record<string, any> | null = null;
    let mongoConn: Awaited<ReturnType<typeof connectToMongoDB>> = null;
    let mongoConnectionStatus: 'connected' | 'unavailable' | 'error' = 'unavailable';

    const lookupCandidates = Array.from(
      new Set(
        [
          order_id,
          `#${order_id}`,
          cleanInputId,
          cleanInputId.toUpperCase(),
          `UBER-${cleanInputId.toUpperCase()}`,
        ].filter(Boolean)
      )
    );

    const buildLookupQuery = (extraCandidates: string[] = []): Record<string, unknown> => {
      const allCandidates = Array.from(new Set([...lookupCandidates, ...extraCandidates].filter(Boolean)));
      return {
        $or: [
          ...(validObjectId ? [{ _id: validObjectId }] : []),
          { id: { $in: allCandidates } },
          { uberOrderId: { $in: allCandidates } },
          { uber_order_id: { $in: allCandidates } },
          { orderId: { $in: allCandidates } },
          { order_id: { $in: allCandidates } },
          { external_order_id: { $in: allCandidates } },
          { orderNumber: { $in: allCandidates } },
          { displayId: { $in: allCandidates } },
          { display_id: { $in: allCandidates } },
          { short_display_id: { $in: allCandidates } },
          { invoiceNumber: { $in: allCandidates } },
        ],
      };
    };

    try {
      mongoConn = await connectToMongoDB();
      if (mongoConn) {
        mongoConnectionStatus = 'connected';
        const initialQuery = buildLookupQuery();

        // Always prioritize the primary `orders` collection first
        primaryOrderDoc = await mongoConn.db
          .collection('orders')
          .findOne(initialQuery)
          .catch(() => null);

        if (primaryOrderDoc) {
          matchedDoc = primaryOrderDoc;
          uberOrderUuid = extractUberUuidFromRecord(primaryOrderDoc);
        }

        // Check secondary collections only if primary order or Uber UUID was not yet resolved
        if (!matchedDoc || !uberOrderUuid) {
          for (const colName of ['oms_orders', 'webhook_events']) {
            const doc = await mongoConn.db
              .collection(colName)
              .findOne(initialQuery)
              .catch(() => null);
            if (!doc) continue;
            if (!matchedDoc) matchedDoc = doc;
            if (!uberOrderUuid) {
              const resolved = extractUberUuidFromRecord(doc);
              if (resolved) {
                uberOrderUuid = resolved;
              }
            }
            if (matchedDoc && uberOrderUuid) break;
          }
        }
      }
    } catch (lookupErr) {
      mongoConnectionStatus = 'error';
      console.warn('[Uber Action Order Lookup Error]:', lookupErr);
    }

    const serverStore = getServerStore();
    if (!matchedDoc || !uberOrderUuid) {
      const existingLocal = serverStore.orders.find((o) => {
        const anyO = o as any;
        return (
          o.id === order_id ||
          anyO.orderId === order_id ||
          anyO.uberOrderId === order_id ||
          anyO.uber_order_id === order_id ||
          anyO.orderNumber === order_id ||
          anyO.displayId === order_id ||
          o.invoiceNumber === order_id ||
          o.invoiceNumber === `UBER-${cleanInputId}` ||
          anyO.display_id === order_id ||
          anyO.display_id === `UBER-${cleanInputId}`
        );
      });

      if (existingLocal) {
        if (!matchedDoc) matchedDoc = existingLocal as Record<string, any>;
        if (!uberOrderUuid) {
          uberOrderUuid = extractUberUuidFromRecord(existingLocal as Record<string, any>);
        }
      }
    }

    if (!uberOrderUuid && order_id && !order_id.startsWith('ord-ubr-')) {
      uberOrderUuid = order_id;
    }

    const resolvedInternalOrderId = String(
      primaryOrderDoc?.id ||
        primaryOrderDoc?._id ||
        matchedDoc?.id ||
        matchedDoc?._id ||
        order_id
    );

    console.info('[Uber Eats Order Action Incoming]:', {
      action,
      rawOrderId,
      resolvedInternalOrderId,
      uberOrderUuid,
      primaryOrderFound: Boolean(primaryOrderDoc),
      primaryMongoId: primaryOrderDoc?._id ? String(primaryOrderDoc._id) : null,
      mongoConnectionStatus,
      isSandbox,
    });

    const resolvedChannel = matchedDoc ? resolveOrderChannel(matchedDoc) : 'unknown';
    const rawChannelLabel = String(
      matchedDoc?.channel ||
        matchedDoc?.orderSource ||
        matchedDoc?.source ||
        matchedDoc?.provider ||
        (matchedDoc?.isPosSale ? 'pos' : '')
    ).trim();
    if (
      matchedDoc?.isPosSale === true ||
      (resolvedChannel !== 'unknown' && resolvedChannel !== 'ubereats') ||
      (rawChannelLabel && !/uber/i.test(rawChannelLabel))
    ) {
      return {
        httpStatus: 400,
        body: {
          ok: false,
          success: false,
          synced: false,
          uberSynced: false,
          error: `Order belongs to channel "${rawChannelLabel || resolvedChannel}", not Uber Eats.`,
        },
      };
    }

    if (!uberOrderUuid) {
      return {
        httpStatus: 400,
        body: {
          ok: false,
          success: false,
          synced: false,
          uberSynced: false,
          error: 'Original Uber Eats order_id UUID was not found for this order.',
        },
      };
    }

    const previousStatus = String(
      matchedDoc?.uberStatus || matchedDoc?.status || matchedDoc?.orderStatus || 'PENDING_ACCEPTANCE'
    );
    const prevUpper = previousStatus.toUpperCase();
    const alreadySyncedAccepted =
      action === 'ACCEPT' &&
      (matchedDoc?.uberSynced === true || matchedDoc?.lastUberSync?.synced === true) &&
      (prevUpper === 'ACCEPTED' || prevUpper === 'READY_FOR_PICKUP' || prevUpper === 'READY');

    // 2. Prevent duplicate acceptance requests if already accepted & synced with Uber
    if (alreadySyncedAccepted) {
      return {
        httpStatus: 200,
        body: {
          ok: true,
          success: true,
          synced: true,
          uberSynced: true,
          alreadyAccepted: true,
          orderId: rawOrderId,
          uberOrderId: uberOrderUuid,
          action,
          status: previousStatus,
          nextStatus: previousStatus,
          uberStatus: 204,
          uberStatusCode: 204,
          message: 'Order was already accepted and synced with Uber Eats.',
        },
      };
    }

    // 3. Prevent duplicate concurrent requests for the same order + action
    lockKey = `${uberOrderUuid}:${action}`;
    if (inFlightOrderActions.has(lockKey)) {
      return {
        httpStatus: 409,
        body: {
          ok: false,
          success: false,
          synced: false,
          uberSynced: false,
          duplicate: true,
          error: `An ${action} request for Uber Eats order ${uberOrderUuid} is already in progress.`,
        },
      };
    }
    inFlightOrderActions.add(lockKey);

    // 4. Send the official Uber Eats API request and strictly verify response (HTTP 204 for ACCEPT)
    let uberResult: UberOrderActionResult;
    try {
      uberResult =
        action === 'ACCEPT'
          ? await acceptUberEatsOrder(uberOrderUuid, {
              reason: reasonCode,
              isSandbox,
            })
          : await executeUberOrderAction({
              orderId: uberOrderUuid,
              action,
              reason: reasonCode,
              isSandbox,
              currentStatus: previousStatus,
            });
    } catch (uberErr: unknown) {
      const errorMsg =
        uberErr instanceof Error ? uberErr.message : 'Failed to communicate with Uber Eats API.';
      console.error('[Uber Action Execution Exception]:', {
        action,
        orderId: uberOrderUuid,
        storeId,
        error: errorMsg,
      });

      return {
        httpStatus: 502,
        body: {
          ok: false,
          success: false,
          synced: false,
          uberSynced: false,
          orderId: rawOrderId,
          uberOrderId: uberOrderUuid,
          action,
          status: previousStatus,
          preservedStatus: previousStatus,
          uberStatus: 502,
          uberStatusCode: 502,
          error: errorMsg,
          uberError: errorMsg,
        },
      };
    }

    const candidates = Array.from(
      new Set(
        [
          order_id,
          `#${order_id}`,
          cleanInputId,
          cleanInputId.toUpperCase(),
          `UBER-${cleanInputId.toUpperCase()}`,
          uberOrderUuid,
          resolvedInternalOrderId,
        ].filter(Boolean)
      )
    );

    const orderMatchFilter = {
      $or: [
        ...(validObjectId ? [{ _id: validObjectId }] : []),
        { id: { $in: candidates } },
        { orderId: { $in: candidates } },
        { order_id: { $in: candidates } },
        { external_order_id: { $in: candidates } },
        { uberOrderId: { $in: candidates } },
        { uber_order_id: { $in: candidates } },
        { orderNumber: { $in: candidates } },
        { displayId: { $in: candidates } },
        { display_id: { $in: candidates } },
        { short_display_id: { $in: candidates } },
        { invoiceNumber: { $in: candidates } },
      ],
    };

    const acceptNon204 = action === 'ACCEPT' && uberResult.status !== 204;
    const confirmedSuccess = uberResult.ok && !acceptNon204;

    const lastUberSync = {
      synced: confirmedSuccess,
      action,
      statusCode: uberResult.status ?? null,
      apiHost: uberResult.env ?? uberResult.url ?? null,
      error: confirmedSuccess
        ? null
        : uberResult.error ?? `Uber API rejected request (HTTP ${uberResult.status})`,
      at: new Date(),
    };

    // 5. If Uber rejected or returned non-204 for ACCEPT, preserve existing status and return the real error
    if (!confirmedSuccess) {
      const httpStatus =
        typeof uberResult.status === 'number' && uberResult.status >= 400 && uberResult.status < 600
          ? uberResult.status
          : 502;
      const detailedError =
        uberResult.error ||
        `Uber Eats API returned HTTP ${uberResult.status}${action === 'ACCEPT' ? ' (expected HTTP 204 No Content)' : ''}`;

      console.error('[Uber Eats Order Action Failed — Status Preserved]:', {
        action,
        rawOrderId,
        resolvedInternalOrderId,
        uberOrderId: uberOrderUuid,
        storeId,
        preservedStatus: previousStatus,
        uberStatus: uberResult.status,
        uberUrl: uberResult.url,
        mongoConnected: Boolean(mongoConn),
        uberError: detailedError,
        uberResponse: uberResult.uberResponse,
      });

      if (mongoConn) {
        try {
          if (primaryOrderDoc?._id) {
            await mongoConn.db
              .collection('orders')
              .updateOne({ _id: primaryOrderDoc._id }, { $set: { lastUberSync } })
              .catch(() => {});
          } else {
            await mongoConn.db
              .collection('orders')
              .updateOne(orderMatchFilter, { $set: { lastUberSync } })
              .catch(() => {});
          }
          await mongoConn.db
            .collection('oms_orders')
            .updateMany(orderMatchFilter, { $set: { lastUberSync } })
            .catch(() => {});
        } catch {
          // Ignore diagnostic write error
        }
      }

      return {
        httpStatus,
        body: {
          ok: false,
          success: false,
          synced: false,
          uberSynced: false,
          mongoPersisted: false,
          orderId: rawOrderId,
          uberOrderId: uberOrderUuid,
          action,
          status: previousStatus,
          preservedStatus: previousStatus,
          uberStatus: uberResult.status,
          uberStatusCode: uberResult.status,
          uberApiHost: uberResult.url || uberResult.env || null,
          error: detailedError,
          uberError: detailedError,
          uberResponse: uberResult.uberResponse,
        },
      };
    }

    // 6. Uber confirmed -> Persist strictly to MongoDB Atlas primary `orders` collection first
    const now = new Date().toISOString();
    const nextStatus: OrderStatus = NEXT_STATUS_MAP[action];
    let matchedCount = 0;
    let modifiedCount = 0;
    let finalPersistedStatus: string = nextStatus;

    try {
      if (!mongoConn) {
        mongoConn = await connectToMongoDB();
      }

      if (!mongoConn) {
        const mongoErrMsg =
          'Uber Eats confirmed the order action, but MongoDB Atlas is unavailable. Refusing to report cross-device sync success.';
        console.error('[Uber Eats MongoDB Sync Error — Database Unavailable]:', {
          action,
          rawOrderId,
          resolvedInternalOrderId,
          uberOrderId: uberOrderUuid,
          uberStatusCode: uberResult.status,
          mongoConnected: false,
          matchedCount: 0,
          modifiedCount: 0,
          finalStatus: previousStatus,
          error: mongoErrMsg,
        });

        return {
          httpStatus: 500,
          body: {
            ok: false,
            success: false,
            synced: false,
            uberSynced: true,
            mongoPersisted: false,
            matchedCount: 0,
            modifiedCount: 0,
            orderId: rawOrderId,
            uberOrderId: uberOrderUuid,
            action,
            status: previousStatus,
            preservedStatus: previousStatus,
            uberStatus: uberResult.status,
            uberStatusCode: uberResult.status,
            uberApiHost: uberResult.env || uberResult.url || null,
            error: mongoErrMsg,
          },
        };
      }

      const ordersCollection = mongoConn.db.collection('orders');
      if (!primaryOrderDoc) {
        primaryOrderDoc = await ordersCollection.findOne(orderMatchFilter);
      }

      const primaryUpdateFilter: Record<string, unknown> = primaryOrderDoc?._id
        ? { _id: primaryOrderDoc._id }
        : orderMatchFilter;

      const primarySetFields = {
        status: nextStatus,
        uberStatus: nextStatus,
        orderStatus: nextStatus,
        uberSynced: true,
        uberOrderId: uberOrderUuid,
        uber_order_id: uberOrderUuid,
        lastUberSync,
        updatedAt: now,
      };

      let primaryUpdateResult = await ordersCollection.updateOne(primaryUpdateFilter, {
        $set: primarySetFields,
      });

      matchedCount = primaryUpdateResult.matchedCount ?? 0;
      modifiedCount = primaryUpdateResult.modifiedCount ?? 0;

      // If order was visible via oms_orders/webhook_events only and missing from `orders`, materialize once cleanly
      if (matchedCount === 0 && matchedDoc) {
        const { _id: _omitId, ...seedFields } = matchedDoc;
        const shortCode = String(
          matchedDoc.short_display_id ||
            matchedDoc.orderNumber ||
            matchedDoc.display_id ||
            uberOrderUuid.slice(-5)
        )
          .replace(/^#/, '')
          .replace(/^UBER-/i, '')
          .toUpperCase();
        const seededId = matchedDoc.id && !String(matchedDoc.id).startsWith('evt-')
          ? String(matchedDoc.id)
          : `ord-ubr-${shortCode}`;
        const seededInvoice = String(matchedDoc.invoiceNumber || `UBER-${shortCode}`);

        const upsertRes = await ordersCollection.updateOne(
          {
            $or: [
              { uberOrderId: uberOrderUuid },
              { uber_order_id: uberOrderUuid },
              { orderId: uberOrderUuid },
              { id: seededId },
            ],
          },
          {
            $set: {
              ...seedFields,
              id: seededId,
              invoiceNumber: seededInvoice,
              channel: 'ubereats',
              ...primarySetFields,
            },
            $setOnInsert: {
              createdAt: matchedDoc.createdAt || matchedDoc.receivedAt || now,
            },
          },
          { upsert: true }
        );
        matchedCount = (upsertRes.matchedCount ?? 0) + (upsertRes.upsertedCount ?? 0);
        modifiedCount = (upsertRes.modifiedCount ?? 0) + (upsertRes.upsertedCount ?? 0);
      }

      if (matchedCount === 0) {
        const notFoundMsg = `Uber Eats confirmed ${action} (HTTP ${uberResult.status}), but primary order record was not found or updated in MongoDB 'orders' collection.`;
        console.error('[Uber Eats MongoDB Sync Error — Primary Order Not Matched]:', {
          action,
          rawOrderId,
          resolvedInternalOrderId,
          uberOrderId: uberOrderUuid,
          uberStatusCode: uberResult.status,
          mongoConnected: true,
          matchedCount,
          modifiedCount,
          finalStatus: previousStatus,
          error: notFoundMsg,
        });

        return {
          httpStatus: 500,
          body: {
            ok: false,
            success: false,
            synced: false,
            uberSynced: true,
            mongoPersisted: false,
            matchedCount,
            modifiedCount,
            orderId: rawOrderId,
            uberOrderId: uberOrderUuid,
            action,
            status: previousStatus,
            preservedStatus: previousStatus,
            uberStatus: uberResult.status,
            uberStatusCode: uberResult.status,
            uberApiHost: uberResult.env || uberResult.url || null,
            error: notFoundMsg,
          },
        };
      }

      const verifiedDoc = await ordersCollection
        .findOne(primaryUpdateFilter, { projection: { status: 1, uberStatus: 1, orderStatus: 1 } })
        .catch(() => null);
      if (verifiedDoc) {
        finalPersistedStatus = String(
          verifiedDoc.uberStatus || verifiedDoc.status || verifiedDoc.orderStatus || nextStatus
        );
      }

      // Sync secondary collections cleanly without creating duplicate records
      const secondarySyncTasks: Promise<unknown>[] = [
        mongoConn.db.collection('oms_orders').updateMany(orderMatchFilter, {
          $set: {
            status: nextStatus,
            uberStatus: nextStatus,
            orderStatus: nextStatus,
            uberSynced: true,
            uberOrderId: uberOrderUuid,
            uber_order_id: uberOrderUuid,
            lastUberSync,
            updatedAt: now,
            updated_at: new Date(),
          },
        }),
        mongoConn.db.collection('webhook_events').updateMany(orderMatchFilter, {
          $set: {
            orderStatus: nextStatus,
            uberStatus: nextStatus,
            uberSynced: true,
            uberOrderId: uberOrderUuid,
            lastUberSync,
            updatedAt: now,
          },
        }),
      ];
      await Promise.allSettled(secondarySyncTasks);

      // Update process-local cache and emit SSE only after MongoDB Atlas persistence succeeds
      const matchedOrders = serverStore.orders.filter((o) => {
        const anyO = o as any;
        return (
          o.id === order_id ||
          o.id === cleanInputId ||
          o.id === uberOrderUuid ||
          o.invoiceNumber === order_id ||
          o.invoiceNumber === `UBER-${cleanInputId}` ||
          anyO.orderId === order_id ||
          anyO.orderId === cleanInputId ||
          anyO.orderId === uberOrderUuid ||
          anyO.order_id === order_id ||
          anyO.orderNumber === order_id ||
          anyO.displayId === order_id ||
          anyO.uberOrderId === order_id ||
          anyO.uberOrderId === uberOrderUuid ||
          anyO.uber_order_id === order_id ||
          anyO.uber_order_id === cleanInputId ||
          anyO.uber_order_id === uberOrderUuid
        );
      });
      for (const existing of matchedOrders) {
        existing.status = nextStatus;
        (existing as any).uberStatus = nextStatus;
        (existing as any).orderStatus = nextStatus;
        (existing as any).uberSynced = true;
        (existing as any).lastUberSync = lastUberSync;
        existing.updatedAt = now;
        saveServerOrder(existing);
      }

      const matchedEvents = (serverStore.webhookEvents || []).filter((ev) => {
        const anyEv = ev as any;
        return (
          ev.id === order_id ||
          ev.orderId === order_id ||
          ev.orderId === cleanInputId ||
          ev.orderId === uberOrderUuid ||
          ev.invoiceNumber === order_id ||
          anyEv.eventId === order_id ||
          anyEv.order_id === order_id ||
          anyEv.orderNumber === order_id ||
          anyEv.displayId === order_id ||
          anyEv.uberOrderId === order_id ||
          anyEv.uberOrderId === uberOrderUuid ||
          anyEv.uber_order_id === order_id ||
          anyEv.uber_order_id === cleanInputId ||
          anyEv.uber_order_id === uberOrderUuid
        );
      });
      for (const existingEvt of matchedEvents) {
        saveServerWebhookEvent({
          ...existingEvt,
          orderStatus: nextStatus,
          uberSynced: true,
        } as any);
      }

      broadcastLiveUpdate({
        type: 'order_status_updated',
        orderId: resolvedInternalOrderId,
        uber_order_id: uberOrderUuid,
        status: nextStatus,
        synced: true,
        timestamp: now,
      });

      console.info('[Uber Eats Order Action Synced]:', {
        action,
        rawOrderId,
        resolvedInternalOrderId,
        primaryMongoId: primaryOrderDoc?._id ? String(primaryOrderDoc._id) : null,
        uberOrderId: uberOrderUuid,
        uberStatusCode: uberResult.status,
        mongoConnected: true,
        matchedCount,
        modifiedCount,
        finalStatus: finalPersistedStatus,
      });
    } catch (syncErr: unknown) {
      const errMsg = syncErr instanceof Error ? syncErr.message : String(syncErr);
      console.error('[Uber Eats MongoDB Persist Error]:', {
        action,
        rawOrderId,
        resolvedInternalOrderId,
        uberOrderId: uberOrderUuid,
        uberStatusCode: uberResult.status,
        mongoConnected: Boolean(mongoConn),
        matchedCount,
        modifiedCount,
        finalStatus: previousStatus,
        error: errMsg,
      });
      return {
        httpStatus: 500,
        body: {
          ok: false,
          success: false,
          synced: false,
          uberSynced: true,
          mongoPersisted: false,
          matchedCount,
          modifiedCount,
          orderId: rawOrderId,
          uberOrderId: uberOrderUuid,
          action,
          status: previousStatus,
          preservedStatus: previousStatus,
          uberStatus: uberResult.status,
          uberStatusCode: uberResult.status,
          error: `Uber Eats confirmed the order, but MongoDB synchronization failed: ${errMsg}`,
        },
      };
    }

    return {
      httpStatus: 200,
      body: {
        ok: true,
        success: true,
        synced: true,
        uberSynced: true,
        mongoPersisted: true,
        matchedCount,
        modifiedCount,
        note: `Synced with Uber (${uberResult.env || 'Uber Eats'}) & persisted to MongoDB`,
        orderId: rawOrderId,
        uberOrderId: uberOrderUuid,
        action,
        status: finalPersistedStatus,
        nextStatus: finalPersistedStatus,
        uberStatus: uberResult.status,
        uberStatusCode: uberResult.status,
        uberApiHost: uberResult.env || uberResult.url || null,
        uberError: null,
        uberResponse: uberResult.uberResponse,
        message: `Order ${action.toLowerCase()} confirmed by Uber Eats (HTTP ${uberResult.status})`,
      },
    };
  } finally {
    if (lockKey) {
      inFlightOrderActions.delete(lockKey);
    }
  }
}
