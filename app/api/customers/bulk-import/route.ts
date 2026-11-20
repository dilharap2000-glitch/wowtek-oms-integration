import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { formatSriLankanPhone, isValidSriLankanPhone } from '@/lib/phoneUtils';
import { parseCustomerCsv } from '@/lib/customerCsv';
import { upsertServerCustomers } from '@/lib/serverStore';

export const dynamic = 'force-dynamic';

type IncomingCustomerRow = {
  name?: string;
  phone?: string;
  source?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const defaultSource =
      typeof body?.defaultSource === 'string' && body.defaultSource.trim()
        ? body.defaultSource.trim()
        : 'CSV Import';

    const validRecords: Array<{ name: string; phone: string; source: string }> = [];
    const invalidRecords: Array<{ row: number; name?: string; phone: string; reason: string }> = [];
    const duplicatePhones: string[] = [];
    const seenPhones = new Set<string>();

    if (typeof body?.csvText === 'string' && body.csvText.trim()) {
      const parsed = parseCustomerCsv(body.csvText, defaultSource);
      for (const row of parsed.rows) {
        if (row.isValid) {
          validRecords.push({
            name: row.name,
            phone: row.formattedPhone,
            source: row.source || defaultSource,
          });
        } else if (row.isDuplicateInFile) {
          duplicatePhones.push(row.formattedPhone);
        } else {
          invalidRecords.push({
            row: row.rowNumber,
            name: row.name,
            phone: row.rawPhone,
            reason: row.error || 'Invalid Sri Lankan phone number format',
          });
        }
      }
    } else if (Array.isArray(body?.customers)) {
      (body.customers as IncomingCustomerRow[]).forEach((item, index) => {
        const rawPhone = String(item?.phone ?? '').trim();
        const name = String(item?.name ?? '').trim() || 'CSV Customer';
        const source = String(item?.source ?? '').trim() || defaultSource;

        if (!rawPhone) {
          invalidRecords.push({
            row: index + 1,
            name,
            phone: rawPhone,
            reason: 'Missing phone number',
          });
          return;
        }

        const formattedPhone = formatSriLankanPhone(rawPhone);
        if (!isValidSriLankanPhone(formattedPhone)) {
          invalidRecords.push({
            row: index + 1,
            name,
            phone: rawPhone,
            reason: 'Invalid Sri Lankan phone number format (expected 07XXXXXXXX or +947XXXXXXXX)',
          });
          return;
        }

        if (seenPhones.has(formattedPhone)) {
          duplicatePhones.push(formattedPhone);
          return;
        }

        seenPhones.add(formattedPhone);
        validRecords.push({ name, phone: formattedPhone, source });
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Provide either csvText or a customers array.' },
        { status: 400 }
      );
    }

    if (validRecords.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid Sri Lankan customer phone numbers found to import.',
          invalidCount: invalidRecords.length,
          duplicateCount: duplicatePhones.length,
          invalidRecords: invalidRecords.slice(0, 25),
        },
        { status: 400 }
      );
    }

    // Try MongoDB Atlas bulkWrite first; fall back to serverStore if offline
    const mongoConn = await connectToMongoDB();
    if (mongoConn) {
      const now = new Date();
      const operations = validRecords.map((rec) => ({
        updateOne: {
          filter: { phone: rec.phone },
          update: {
            $set: {
              name: rec.name,
              source: rec.source,
              updatedAt: now,
            },
            $setOnInsert: {
              createdAt: now,
              lastOrderDate: now,
              totalOrders: 0,
            },
          },
          upsert: true,
        },
      }));

      const bulkRes = await mongoConn.db.collection('customers').bulkWrite(operations, { ordered: false });
      const insertedCount = bulkRes.upsertedCount || 0;
      const updatedCount = bulkRes.modifiedCount || 0;

      // Mirror into local serverStore cache for fast sync
      upsertServerCustomers(validRecords);

      return NextResponse.json({
        success: true,
        source: 'mongodb',
        importedCount: validRecords.length,
        insertedCount,
        updatedCount,
        invalidCount: invalidRecords.length,
        duplicateCount: duplicatePhones.length,
        invalidRecords: invalidRecords.slice(0, 25),
        message: `Successfully imported ${validRecords.length} customer(s) (${insertedCount} new, ${updatedCount} updated).`,
      });
    }

    // Fallback persistence via serverStore
    const storeResult = upsertServerCustomers(validRecords);
    return NextResponse.json({
      success: true,
      source: 'serverStore',
      importedCount: validRecords.length,
      insertedCount: storeResult.inserted,
      updatedCount: storeResult.updated,
      invalidCount: invalidRecords.length,
      duplicateCount: duplicatePhones.length,
      invalidRecords: invalidRecords.slice(0, 25),
      message: `Successfully imported ${validRecords.length} customer(s) (${storeResult.inserted} new, ${storeResult.updated} updated).`,
    });
  } catch (error: any) {
    console.error('[Customer Bulk Import Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Bulk import failed' },
      { status: 500 }
    );
  }
}
