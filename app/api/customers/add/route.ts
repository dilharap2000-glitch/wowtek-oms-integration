import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { name, phone, source } = await req.json();
    const { db } = await connectToDatabase();

    if (!phone) {
      return NextResponse.json({ success: false, error: "ෆෝන් අංකය අත්‍යවශ්‍ය වේ." }, { status: 400 });
    }

    await db.collection('customers').updateOne(
      { phone: phone.trim() },
      { 
        $set: { 
          name: name || 'Manual Customer', 
          source: source || 'Manual Add',
          updatedAt: new Date() 
        },
        $setOnInsert: { createdAt: new Date(), totalOrders: 0 }
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true, message: "Customer added successfully!" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
