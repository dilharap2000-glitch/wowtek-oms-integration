import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { phones } = await req.json();
    const { db } = await connectToDatabase();

    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      return NextResponse.json({ success: false, error: "මකා දැමීමට පාරිභෝගිකයින් තෝරා නැත." }, { status: 400 });
    }

    await db.collection('customers').deleteMany({
      phone: { $in: phones },
    });

    return NextResponse.json({ success: true, message: "Selected customers deleted successfully!" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
