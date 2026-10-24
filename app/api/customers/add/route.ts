import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { formatSriLankanPhone, isValidSriLankanPhone } from '@/lib/phoneUtils';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { name, phone, source } = await req.json();
    const { db } = await connectToDatabase();

    if (!phone || !String(phone).trim()) {
      return NextResponse.json({ success: false, error: "දුරකථන අංකය ඇතුළත් කිරීම අත්‍යවශ්‍ය වේ." }, { status: 400 });
    }

    // Clean spaces, hyphens, and ensure uniform +94 formatting (e.g. 0715330724 -> +94715330724)
    const formattedPhone = formatSriLankanPhone(String(phone));

    // Validate Sri Lankan phone number format (+94 followed by 9 digits)
    if (!isValidSriLankanPhone(formattedPhone)) {
      return NextResponse.json({
        success: false,
        error: `වලංගු දුරකථන අංකයක් ඇතුළත් කරන්න (e.g. 0715330724 හෝ +94715330724). ඔබ ඇතුළත් කළ අංකය: ${phone}`
      }, { status: 400 });
    }

    // Upsert customer with uniformly formatted +94 phone number
    await db.collection('customers').updateOne(
      { phone: formattedPhone },
      { 
        $set: { 
          name: name ? String(name).trim() : 'Manual Customer', 
          source: source || 'Manual Add',
          updatedAt: new Date() 
        },
        $setOnInsert: { createdAt: new Date(), totalOrders: 0 }
      },
      { upsert: true }
    );

    return NextResponse.json({ 
      success: true, 
      message: "Customer added successfully!",
      phone: formattedPhone 
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

