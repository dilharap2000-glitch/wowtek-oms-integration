import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { getServerSmsLogs, SmsCampaignLog, SmsDeliveryStatus } from '@/lib/serverStore';

export const dynamic = 'force-dynamic';

function normalizeStatus(raw: unknown): SmsDeliveryStatus {
  const val = String(raw || '').trim().toLowerCase();
  if (val === 'delivered' || val === 'completed') return 'Delivered';
  if (val === 'failed' || val === 'error' || val === 'undelivered') return 'Failed';
  return 'Sent';
}

function normalizeCampaignLog(raw: Record<string, unknown>, fallbackId?: string): SmsCampaignLog {
  const rawType = String(raw.campaignType || 'single').toLowerCase();
  const campaignType: 'single' | 'selected' | 'bulk' =
    rawType === 'bulk' ? 'bulk' : rawType === 'selected' ? 'selected' : 'single';

  const recipients = Array.isArray(raw.recipients)
    ? raw.recipients.map((r: Record<string, unknown>) => ({
        name: String(r?.name || 'Valued Customer'),
        phone: String(r?.phone || ''),
        source: r?.source ? String(r.source) : undefined,
        renderedMessage: String(r?.renderedMessage || ''),
        status: normalizeStatus(r?.status),
        gatewayMessage: r?.gatewayMessage ? String(r.gatewayMessage) : undefined,
      }))
    : [];

  const deliveredCount =
    typeof raw.deliveredCount === 'number'
      ? raw.deliveredCount
      : recipients.filter((r) => r.status === 'Delivered').length;
  const failedCount =
    typeof raw.failedCount === 'number'
      ? raw.failedCount
      : recipients.filter((r) => r.status === 'Failed').length;
  const sentCount =
    typeof raw.sentCount === 'number'
      ? raw.sentCount
      : recipients.filter((r) => r.status === 'Sent').length;

  return {
    id: String(raw.id || fallbackId || `sms-${Date.now()}`),
    campaignType,
    senderId: String(raw.senderId || 'WOWTEK'),
    messageTemplate: String(raw.messageTemplate || raw.message || ''),
    previewMessage: String(raw.previewMessage || raw.messageTemplate || raw.message || ''),
    recipientsCount: Number(raw.recipientsCount ?? recipients.length ?? 0),
    sentCount,
    deliveredCount,
    failedCount,
    status: normalizeStatus(raw.status),
    timestamp: raw.timestamp
      ? new Date(String(raw.timestamp)).toISOString()
      : raw.createdAt
      ? new Date(String(raw.createdAt)).toISOString()
      : new Date().toISOString(),
    recipients,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');
    const limitParam = Number(searchParams.get('limit') || 100);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 250) : 100;

    const mergedMap = new Map<string, SmsCampaignLog>();

    // Seed with local server store logs first
    for (const localLog of getServerSmsLogs()) {
      const normalized = normalizeCampaignLog(localLog as unknown as Record<string, unknown>, localLog.id);
      mergedMap.set(normalized.id, normalized);
    }

    // Fetch persistent logs from MongoDB Atlas
    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        const docs = await mongoConn.db
          .collection('sms_logs')
          .find({})
          .sort({ timestamp: -1, createdAt: -1 })
          .limit(limit)
          .toArray();

        for (const doc of docs) {
          const { _id, ...rest } = doc;
          const normalized = normalizeCampaignLog(rest as Record<string, unknown>, _id?.toString());
          mergedMap.set(normalized.id, normalized);
        }
      }
    } catch (dbErr: unknown) {
      console.warn(
        '[SMS History API] MongoDB read fallback:',
        dbErr instanceof Error ? dbErr.message : dbErr
      );
    }

    let logs = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    if (statusFilter && statusFilter !== 'ALL') {
      const targetStatus = normalizeStatus(statusFilter);
      logs = logs.filter((l) => l.status === targetStatus);
    }

    return NextResponse.json({
      success: true,
      logs: logs.slice(0, limit),
      total: logs.length,
    });
  } catch (error: unknown) {
    console.error('[SMS History API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        logs: [],
        error: error instanceof Error ? error.message : 'Failed to load SMS history',
      },
      { status: 500 }
    );
  }
}
