import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { broadcastLiveUpdate } from '@/lib/serverStore';

export const dynamic = 'force-dynamic';

// Helper function to parse CSV and extract required financial data
async function processReportCsv(csvText: string, reportType: string, workflowId?: string) {
  try {
    const rows = csvText.split('\n').filter((r) => r.trim().length > 0);
    console.log(`Processing ${reportType}, total rows: ${rows.length}`);

    if (rows.length <= 1) return;

    // Parse header row
    const headers = rows[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));
    
    // Identify financial columns
    const orderIdIdx = headers.findIndex((h) => h.includes('order') || h.includes('id') || h.includes('workflow'));
    const grossSalesIdx = headers.findIndex((h) => h.includes('gross') || h.includes('sales') || h.includes('total') || h.includes('price'));
    const commissionIdx = headers.findIndex((h) => h.includes('fee') || h.includes('commission') || h.includes('service'));
    const adsIdx = headers.findIndex((h) => h.includes('ad') || h.includes('marketing') || h.includes('promo'));
    const netPayoutIdx = headers.findIndex((h) => h.includes('net') || h.includes('payout') || h.includes('earnings'));

    let totalGross = 0;
    let totalCommission = 0;
    let totalAds = 0;
    let totalNet = 0;
    const lineRecords: any[] = [];

    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i].split(',').map((c) => c.trim().replace(/"/g, ''));
      if (cols.length < 2) continue;

      const orderRef = orderIdIdx >= 0 ? cols[orderIdIdx] : `ROW-${i}`;
      const gross = parseFloat(grossSalesIdx >= 0 ? cols[grossSalesIdx] : '0') || 0;
      const comm = parseFloat(commissionIdx >= 0 ? cols[commissionIdx] : '0') || Math.round(gross * 0.154);
      const ads = parseFloat(adsIdx >= 0 ? cols[adsIdx] : '0') || 0;
      const net = parseFloat(netPayoutIdx >= 0 ? cols[netPayoutIdx] : '0') || Math.max(0, gross - comm - ads);

      totalGross += gross;
      totalCommission += comm;
      totalAds += ads;
      totalNet += net;

      lineRecords.push({
        row: i,
        orderRef,
        gross,
        commission: comm,
        ads,
        net,
      });
    }

    // Save directly to MongoDB under expenses/profit collections
    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      const settlementRecord = {
        workflowId: workflowId || `settle-${Date.now()}`,
        reportType,
        totalRows: rows.length - 1,
        totalGross,
        totalCommission,
        totalAds,
        totalNet,
        processedAt: new Date().toISOString(),
        status: 'COMPLETED',
        lineRecords: lineRecords.slice(0, 50),
      };

      await mongoConn.db.collection('financial_settlements').insertOne(settlementRecord);

      // Record Uber Eats Commission and Ads in expenses collection
      if (totalCommission > 0) {
        await mongoConn.db.collection('expenses').insertOne({
          id: `exp-ubr-comm-${Date.now()}`,
          title: `Uber Eats Commission Fee (${reportType})`,
          category: 'Platform Commission',
          channel: 'ubereats',
          amount: totalCommission,
          date: new Date().toISOString().split('T')[0],
          notes: `Settlement via workflow ${workflowId || 'auto'}. Net Payout: Rs. ${totalNet.toLocaleString()}`,
          createdAt: new Date().toISOString(),
        });
      }

      if (totalAds > 0) {
        await mongoConn.db.collection('expenses').insertOne({
          id: `exp-ubr-ads-${Date.now()}`,
          title: `Uber Eats Marketing & Ad Spends (${reportType})`,
          category: 'Marketing / Advertising',
          channel: 'ubereats',
          amount: totalAds,
          date: new Date().toISOString().split('T')[0],
          notes: `Uber Eats Ads fee from settlement report`,
          createdAt: new Date().toISOString(),
        });
      }

      // Update financial_reports workflow status
      if (workflowId) {
        await mongoConn.db.collection('financial_reports').updateOne(
          { workflowId },
          { $set: { status: 'COMPLETED', completedAt: new Date().toISOString(), totalNet, totalCommission } }
        );
      }
    }

    // Broadcast SSE update to frontend
    broadcastLiveUpdate({
      type: 'ubereats_report_processed',
      reportType,
      workflowId,
      totalNet,
      totalCommission,
      totalAds,
      timestamp: new Date().toISOString(),
    });

  } catch (err: any) {
    console.error('processReportCsv Exception:', err?.message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.event_type === 'eats.report.success') {
      const { report_type, report_metadata } = body;
      
      // Loop through sections (CSV files)
      if (Array.isArray(report_metadata?.sections)) {
        for (const section of report_metadata.sections) {
          const downloadUrl = section.download_url;
          if (downloadUrl) {
            try {
              // Fetch and process the CSV report data
              const csvResponse = await fetch(downloadUrl);
              const csvText = await csvResponse.text();

              // Process CSV lines and filter out commissions, ads, and net earnings
              processReportCsv(csvText, report_type, report_metadata.workflow_id);
            } catch (dlErr: any) {
              console.error('Failed to download report section:', dlErr?.message);
            }
          }
        }
      }
    }

    // Must return HTTP 200 to acknowledge Uber webhook receipt
    return new NextResponse(null, { status: 200 });

  } catch (error) {
    console.error('Webhook Error:', error);
    return new NextResponse(null, { status: 500 });
  }
}
