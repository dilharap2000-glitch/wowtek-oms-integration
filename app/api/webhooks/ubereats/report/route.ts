import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.event_type === 'eats.report.success') {
      const { report_type, report_metadata } = body;
      
      if (Array.isArray(report_metadata?.sections)) {
        for (const section of report_metadata.sections) {
          if (section?.download_url) {
            try {
              const csvResponse = await fetch(section.download_url);
              const csvText = await csvResponse.text();

              // Pass database connection to update existing records instead of duplicating
              await reconcileFinancialsFromCsv(csvText);
            } catch (err: any) {
              console.error('Section download / reconcile error:', err?.message);
            }
          }
        }
      }
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error('Report Reconciliation Error:', error);
    return new NextResponse(null, { status: 500 });
  }
}

async function reconcileFinancialsFromCsv(csvText: string) {
  try {
    const { db } = await connectToDatabase();
    const lines = csvText.split('\n');

    // Loop through CSV rows (Skip header)
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const columns = lines[i].split(',');
      
      // Extract required fields from Uber CSV
      const uberOrderId = columns[0]?.trim();     // Order Identifier
      const actualCommission = parseFloat(columns[5]) || 0; // Uber Commission/Fee
      const adsFee = parseFloat(columns[6]) || 0;           // Marketing/Ads Fee

      if (uberOrderId) {
        // Upsert/Update logic: Update exact fees without creating duplicate records
        await db.collection('oms_orders').updateOne(
          {
            $or: [
              { external_order_id: uberOrderId },
              { orderId: uberOrderId },
              { id: uberOrderId },
              { invoiceNumber: uberOrderId },
            ]
          },
          {
            $set: {
              external_order_id: uberOrderId,
              uber_actual_commission: actualCommission,
              uber_ads_fee: adsFee,
              is_reconciled: true,
              updated_at: new Date()
            }
          },
          { upsert: true }
        );

        // Also update matching order in main orders collection for dashboard consistency
        await db.collection('orders').updateOne(
          {
            $or: [
              { id: uberOrderId },
              { invoiceNumber: uberOrderId },
              { 'externalStoreId': uberOrderId }
            ]
          },
          {
            $set: {
              platformFeeAmount: actualCommission > 0 ? actualCommission : undefined,
              isReconciled: true,
              reconciledAt: new Date().toISOString()
            }
          }
        );
      }
    }
  } catch (dbErr: any) {
    console.warn('[Reconciliation DB Notice]:', dbErr?.message);
  }
}
