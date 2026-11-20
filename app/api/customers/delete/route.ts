import { NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { deleteServerCustomers } from '@/lib/serverStore';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { phones } = await req.json();

    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      return NextResponse.json({ success: false, error: "මකා දැමීමට පාරිභෝගිකයින් තෝරා නැත." }, { status: 400 });
    }

    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      await mongoConn.db.collection('customers').deleteMany({
        phone: { $in: phones },
      });
    }

    deleteServerCustomers(phones);

    return NextResponse.json({ success: true, message: "Selected customers deleted successfully!" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
