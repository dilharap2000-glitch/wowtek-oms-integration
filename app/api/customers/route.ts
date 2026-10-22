import { NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      const customers = await mongoConn.db
        .collection('customers')
        .find({})
        .sort({ lastOrderDate: -1 })
        .toArray();

      const cleanCustomers = customers.map(({ _id, ...rest }) => ({
        id: String(_id),
        ...rest,
      }));

      return NextResponse.json({
        success: true,
        customers: cleanCustomers,
        total: cleanCustomers.length,
        source: 'mongodb',
      });
    }
  } catch (err: any) {
    console.warn('[Customers API GET] Error:', err.message);
  }

  return NextResponse.json({
    success: true,
    customers: [],
    total: 0,
    source: 'empty',
  });
}
