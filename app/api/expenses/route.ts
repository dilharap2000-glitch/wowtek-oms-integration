import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { ExpenseItem } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      const expenses = await mongoConn.db
        .collection('expenses')
        .find({})
        .sort({ date: -1 })
        .toArray();
      const clean = expenses.map(({ _id, ...rest }) => rest as ExpenseItem);
      return NextResponse.json({ success: true, expenses: clean });
    }
  } catch (err: any) {
    console.warn('[Expenses API GET] MongoDB read error:', err.message);
  }

  return NextResponse.json({ success: true, expenses: [] });
}

export async function POST(req: NextRequest) {
  try {
    const expense: ExpenseItem = await req.json();
    if (!expense || !expense.id) {
      return NextResponse.json({ success: false, error: 'Invalid expense payload' }, { status: 400 });
    }

    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        await mongoConn.db.collection('expenses').updateOne(
          { id: expense.id },
          { $set: expense },
          { upsert: true }
        );
      }
    } catch (err: any) {
      console.warn('[Expenses API POST] MongoDB write error:', err.message);
    }

    return NextResponse.json({ success: true, expense });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    try {
      const mongoConn = await connectToMongoDB();
      if (mongoConn) {
        await mongoConn.db.collection('expenses').deleteOne({ id });
      }
    } catch (err: any) {
      console.warn('[Expenses API DELETE] MongoDB delete error:', err.message);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
