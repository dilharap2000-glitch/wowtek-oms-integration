import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import {
  getUberAccessTokenWithMeta,
  resolveUberConfigurationAsync,
} from '@/lib/uberToken';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { reportType, storeUuids, startDate, endDate } = await req.json();

    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const formattedEnd = endDate || today.toISOString().split('T')[0];
    const formattedStart = startDate || thirtyDaysAgo.toISOString().split('T')[0];

    const resolved = await resolveUberConfigurationAsync();
    const tokenMeta = await getUberAccessTokenWithMeta(resolved.env === 'sandbox');
    const fallbackStore = resolved.storeId || 'ba8761b9-5679-4bcd-845d-8b0baacf9e5d';
    const targetStores =
      Array.isArray(storeUuids) && storeUuids.length > 0 ? storeUuids : [fallbackStore];

    // Valid report types: PAYMENT_DETAILS_REPORT, FINANCE_SUMMARY_REPORT, etc.
    if (tokenMeta?.token) {
      const response = await fetch(`${tokenMeta.baseUrl}/v1/eats/report`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenMeta.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          report_type: reportType || 'PAYMENT_DETAILS_REPORT',
          store_uuids: targetStores,
          start_date: formattedStart,
          end_date: formattedEnd,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return NextResponse.json(
          { error: data.message || 'Failed to request report from Uber Eats' },
          { status: response.status }
        );
      }

      try {
        const mongoConn = await connectToMongoDB();
        if (mongoConn) {
          await mongoConn.db.collection('financial_reports').insertOne({
            workflowId: data.workflow_id,
            reportType: reportType || 'PAYMENT_DETAILS_REPORT',
            storeUuids: targetStores,
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

    return NextResponse.json(
      {
        success: false,
        error:
          resolved.partialWarning ||
          `Uber Eats ${resolved.env} OAuth credentials are not configured.`,
      },
      { status: 401 }
    );

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
