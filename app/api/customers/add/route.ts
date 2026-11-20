import { NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { formatSriLankanPhone, isValidSriLankanPhone } from '@/lib/phoneUtils';
import { upsertServerCustomers } from '@/lib/serverStore';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { name, phone, source } = await req.json();

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

    const customerName = name ? String(name).trim() : 'Manual Customer';
    const customerSource = source || 'Manual Add';

    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      await mongoConn.db.collection('customers').updateOne(
        { phone: formattedPhone },
        { 
          $set: { 
            name: customerName, 
            source: customerSource,
            updatedAt: new Date() 
          },
          $setOnInsert: { createdAt: new Date(), lastOrderDate: new Date(), totalOrders: 0 }
        },
        { upsert: true }
      );
    }

    upsertServerCustomers([{ name: customerName, phone: formattedPhone, source: customerSource }]);

    return NextResponse.json({ 
      success: true, 
      message: "Customer added successfully!",
      phone: formattedPhone 
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

