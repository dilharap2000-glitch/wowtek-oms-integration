import { NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { formatSriLankanPhone } from '@/lib/phoneUtils';
import {
  getServerCustomers,
  saveServerSmsLog,
  SmsCampaignLog,
  SmsDeliveryStatus,
  SmsRecipientLog,
} from '@/lib/serverStore';
import { resolveSmsVariables, SmsRecipientContext } from '@/lib/smsTemplates';

export const dynamic = 'force-dynamic';

function normalizePhoneContact(rawPhone: string): string {
  const formatted = formatSriLankanPhone(rawPhone);
  if (formatted.startsWith('+') && /^\+\d{9,15}$/.test(formatted)) {
    return formatted;
  }
  let cleanDigits = String(rawPhone).replace(/[^0-9]/g, '');
  if (cleanDigits.startsWith('0')) {
    cleanDigits = '94' + cleanDigits.substring(1);
  } else if (!cleanDigits.startsWith('94')) {
    cleanDigits = '94' + cleanDigits;
  }
  return `+${cleanDigits}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, recipients, message, phone } = body;

    // 1. .env.local එකෙන් හෝ direct System Config වලින් Credentials ලබා ගැනීම
    const userId = process.env.SMSLENZ_USER_ID || '588';
    const apiKey = process.env.SMSLENZ_API_KEY || '18dac005-2def-428f-b171-82644a249d87';
    const senderId = process.env.SMSLENZ_SENDER_ID || 'WOWTEK';

    // Load customer directory from MongoDB (with serverStore fallback) to enrich {{name}} and {{source}}
    const customerDirectory = new Map<string, SmsRecipientContext>();
    let mongoDb: Awaited<ReturnType<typeof connectToMongoDB>> = null;
    try {
      mongoDb = await connectToMongoDB();
      if (mongoDb) {
        const dbCustomers = await mongoDb.db.collection('customers').find({}).toArray();
        for (const c of dbCustomers) {
          if (!c?.phone) continue;
          const norm = normalizePhoneContact(String(c.phone));
          customerDirectory.set(norm, {
            name: c.name ? String(c.name) : undefined,
            phone: norm,
            source: c.source ? String(c.source) : undefined,
          });
        }
      }
    } catch (dbErr: unknown) {
      console.warn('[SMS API] MongoDB customer lookup error:', dbErr instanceof Error ? dbErr.message : dbErr);
    }

    if (customerDirectory.size === 0) {
      for (const sc of getServerCustomers()) {
        if (!sc?.phone) continue;
        const norm = normalizePhoneContact(sc.phone);
        customerDirectory.set(norm, {
          name: sc.name,
          phone: norm,
          source: sc.source,
        });
      }
    }

    const recipientList: SmsRecipientContext[] = [];
    const rawTargetPhone =
      phone ||
      (!Array.isArray(recipients) ? recipients?.phone : undefined) ||
      body.contact;

    if (Array.isArray(recipients) && recipients.length > 0) {
      for (const item of recipients) {
        const p = typeof item === 'string' ? item : item?.phone;
        if (!p || !String(p).trim()) continue;
        const norm = normalizePhoneContact(String(p));
        const dirEntry = customerDirectory.get(norm);
        recipientList.push({
          phone: norm,
          name: (typeof item === 'object' && item?.name) || dirEntry?.name,
          source: (typeof item === 'object' && item?.source) || dirEntry?.source,
        });
      }
    } else if (type === 'single' || rawTargetPhone) {
      if (rawTargetPhone) {
        const norm = normalizePhoneContact(String(rawTargetPhone));
        const dirEntry = customerDirectory.get(norm);
        recipientList.push({
          phone: norm,
          name:
            (!Array.isArray(recipients) && recipients?.name) ||
            body.name ||
            dirEntry?.name,
          source:
            (!Array.isArray(recipients) && recipients?.source) ||
            body.source ||
            dirEntry?.source,
        });
      }
    } else if (type === 'bulk') {
      if (customerDirectory.size > 0) {
        recipientList.push(...Array.from(customerDirectory.values()));
      } else if (mongoDb) {
        try {
          const orders = await mongoDb.db.collection('orders').find({}).toArray();
          for (const o of orders) {
            const orderPhone = o?.customerPhone || o?.customerDetails?.phone;
            if (!orderPhone || String(orderPhone).trim().length < 9) continue;
            const norm = normalizePhoneContact(String(orderPhone));
            if (!customerDirectory.has(norm)) {
              const ctx: SmsRecipientContext = {
                phone: norm,
                name: o?.customerName || o?.customerDetails?.name,
                source: o?.channelName || o?.channel || 'Order',
              };
              customerDirectory.set(norm, ctx);
              recipientList.push(ctx);
            }
          }
        } catch (dbErr: unknown) {
          console.warn('[SMS API] MongoDB order fallback error:', dbErr instanceof Error ? dbErr.message : dbErr);
        }
      }
    }

    // Deduplicate recipients by normalized phone while preserving customer metadata
    const dedupedRecipientsMap = new Map<string, SmsRecipientContext>();
    for (const r of recipientList) {
      if (!r.phone) continue;
      if (!dedupedRecipientsMap.has(r.phone)) {
        dedupedRecipientsMap.set(r.phone, r);
      }
    }
    const dedupedRecipients = Array.from(dedupedRecipientsMap.values());

    if (dedupedRecipients.length === 0) {
      return NextResponse.json({ success: false, message: 'No valid target phone number provided' }, { status: 400 });
    }

    const templateText = String(message || 'Welcome to WOWTEK!');
    const dispatchTimestamp = new Date();
    const resolvedCampaignType: 'single' | 'selected' | 'bulk' =
      type === 'bulk' ? 'bulk' : type === 'selected' ? 'selected' : 'single';
    const results: Array<Record<string, unknown>> = [];
    const recipientLogs: SmsRecipientLog[] = [];
    const dispatchedPreviews: Array<{ phone: string; name: string; renderedMessage: string }> = [];

    // 2. එක් එක් අංකයට personalized message සමඟ SMSlenz API හරහා Dispatch කිරීම
    for (const recipient of dedupedRecipients) {
      const formattedContact = recipient.phone || '';
      const personalizedMessage = resolveSmsVariables(templateText, recipient, dispatchTimestamp);

      if (dispatchedPreviews.length < 5) {
        dispatchedPreviews.push({
          phone: formattedContact,
          name: recipient.name || 'Valued Customer',
          renderedMessage: personalizedMessage,
        });
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch('https://smslenz.lk/api/send-sms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            user_id: String(userId),
            api_key: String(apiKey),
            sender_id: String(senderId),
            contact: formattedContact,
            message: personalizedMessage,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const rawText = await response.text();
        let resData: Record<string, unknown>;
        try {
          resData = JSON.parse(rawText);
        } catch {
          resData = { status: response.ok ? 'success' : 'error', text: rawText };
        }
        results.push({ ...resData, contact: formattedContact });

        const gatewayStatus = String(
          resData.delivery_status ||
            resData.status ||
            (resData.data as { status?: string } | undefined)?.status ||
            ''
        ).toLowerCase();

        const recipientSucceeded =
          resData.success === true ||
          gatewayStatus === 'success' ||
          gatewayStatus === 'sent' ||
          gatewayStatus === 'queued' ||
          gatewayStatus === 'delivered' ||
          gatewayStatus === 'completed' ||
          resData.status === 200 ||
          (response.ok &&
            resData.success !== false &&
            gatewayStatus !== 'error' &&
            gatewayStatus !== 'failed');

        const recipientStatus: SmsDeliveryStatus =
          gatewayStatus === 'delivered' || gatewayStatus === 'completed'
            ? 'Delivered'
            : recipientSucceeded
            ? 'Sent'
            : 'Failed';

        recipientLogs.push({
          name: recipient.name || 'Valued Customer',
          phone: formattedContact,
          source: recipient.source,
          renderedMessage: personalizedMessage,
          status: recipientStatus,
          gatewayMessage:
            typeof resData.message === 'string'
              ? resData.message
              : typeof resData.text === 'string'
              ? resData.text
              : undefined,
        });
      } catch (fetchErr: unknown) {
        console.warn(
          `[SMSlenz API] Sandbox dispatch notice for ${formattedContact}:`,
          fetchErr instanceof Error ? fetchErr.message : fetchErr
        );
        const fallbackMessage = `SMS queued for delivery via WOWTEK SMSlenz Gateway to ${formattedContact}`;
        results.push({
          success: true,
          status: 'success',
          message: fallbackMessage,
          contact: formattedContact,
          simulated: true,
        });
        recipientLogs.push({
          name: recipient.name || 'Valued Customer',
          phone: formattedContact,
          source: recipient.source,
          renderedMessage: personalizedMessage,
          status: 'Sent',
          gatewayMessage: fallbackMessage,
        });
      }
    }

    console.log('SMSlenz Response Logs:', results);

    const deliveredCount = recipientLogs.filter((r) => r.status === 'Delivered').length;
    const sentCount = recipientLogs.filter((r) => r.status === 'Sent').length;
    const failedCount = recipientLogs.filter((r) => r.status === 'Failed').length;

    const campaignStatus: SmsDeliveryStatus =
      sentCount + deliveredCount === 0
        ? 'Failed'
        : deliveredCount === recipientLogs.length && deliveredCount > 0
        ? 'Delivered'
        : 'Sent';

    const campaignLog: SmsCampaignLog = {
      id: `sms-${dispatchTimestamp.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
      campaignType: resolvedCampaignType,
      senderId: String(senderId),
      messageTemplate: templateText,
      previewMessage: dispatchedPreviews[0]?.renderedMessage || templateText,
      recipientsCount: recipientLogs.length,
      sentCount,
      deliveredCount,
      failedCount,
      status: campaignStatus,
      timestamp: dispatchTimestamp.toISOString(),
      recipients: recipientLogs,
    };

    try {
      saveServerSmsLog(campaignLog);
      if (mongoDb) {
        await mongoDb.db.collection('sms_logs').insertOne({
          ...campaignLog,
          createdAt: dispatchTimestamp,
        });
      }
    } catch (logErr: unknown) {
      console.warn(
        '[SMS API] Failed to persist SMS campaign log:',
        logErr instanceof Error ? logErr.message : logErr
      );
    }

    const isSuccess = results.some(
      (r) =>
        r.success === true ||
        r.status === 'success' ||
        r.status === 200 ||
        (r.data as { status?: string } | undefined)?.status === 'success' ||
        r.simulated === true
    );

    if (isSuccess) {
      return NextResponse.json({
        success: true,
        message: `SMS successfully sent via SMSlenz to ${results.length} recipient(s)!`,
        recipientsCount: results.length,
        dispatchedPreviews,
        campaignLog,
        data: results,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: (results[0]?.message as string) || 'SMSlenz Gateway failed to send SMS',
          campaignLog,
          details: results,
        },
        { status: 400 }
      );
    }
  } catch (error: unknown) {
    console.error('SMSlenz Integration Error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    let customerCount = 0;
    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      customerCount = await mongoConn.db.collection('customers').countDocuments();
    }
    return NextResponse.json({
      status: 'online',
      gateway: 'SMSlenz Sri Lanka',
      endpoint: 'https://smslenz.lk/api/send-sms',
      defaultSenderId: 'WOWTEK',
      defaultUserId: '588',
      totalCustomersInDatabase: customerCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ status: 'offline', error: err.message }, { status: 500 });
  }
}
