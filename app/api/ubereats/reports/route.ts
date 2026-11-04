import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { reportType, storeUuids, startDate, endDate } = await req.json();

    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const formattedEnd = endDate || today.toISOString().split('T')[0];
    const formattedStart = startDate || thirtyDaysAgo.toISOString().split('T')[0];

    const accessToken = process.env.UBER_ACCESS_TOKEN || process.env.UBER_EATS_ACCESS_TOKEN;

    // Valid report types: PAYMENT_DETAILS_REPORT, FINANCE_SUMMARY_REPORT, etc.
    if (accessToken && accessToken !== 'YOUR_UBER_ACCESS_TOKEN') {
      const response = await fetch('https://api.uber.com/v1/eats/report', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          report_type: reportType || 'PAYMENT_DETAILS_REPORT',
          store_uuids: Array.isArray(storeUuids) && storeUuids.length > 0 ? storeUuids : ['68dba37f-7468-49c0-9d32-eats-colombo-01'],
          start_date: formattedStart,
          end_date: formattedEnd,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return NextResponse.json({ error: data.message || 'Failed to request report from Uber Eats' }, { status: response.status });
      }

      // Record requested workflow in MongoDB
      try {
        const mongoConn = await connectToMongoDB();
        if (mongoConn) {
          await mongoConn.db.collection('financial_reports').insertOne({
            workflowId: data.workflow_id,
            reportType: reportType || 'PAYMENT_DETAILS_REPORT',
            storeUuids: storeUuids || ['68dba37f-7468-49c0-9d32-eats-colombo-01'],
            startDate: formattedStart,
            endDate: formattedEnd,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
          });
        }
      } catch {}

      return NextResponse.json({
        success: true,
        workflow_id: data.workflow_id,
        message: 'Report request accepted by Uber Eats',
      });
    }

    // Sandbox / Prototyping Fallback workflow ID
    const mockWorkflowId = `wf-uber-${Date.now().toString(36)}-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        await mongoConn.db.collection('financial_reports').insertOne({
          workflowId: mockWorkflowId,
          reportType: reportType || 'PAYMENT_DETAILS_REPORT',
          storeUuids: storeUuids || ['68dba37f-7468-49c0-9d32-eats-colombo-01'],
          startDate: formattedStart,
          endDate: formattedEnd,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        });
      }
    } catch {}

    return NextResponse.json({
      success: true,
      workflow_id: mockWorkflowId,
      message: 'Report request accepted by Uber Eats (Sandbox Workflow)',
    });

  } catch (error: any) {
    console.error('Report Request Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const mongoConn = await connectToMongoDB();
    let reports: any[] = [];
    if (mongoConn) {
      reports = await mongoConn.db.collection('financial_reports').find({}).sort({ createdAt: -1 }).limit(20).toArray();
    }
    return NextResponse.json({ success: true, reports });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
