import { NextResponse } from 'next/server';
import { connectToMongoDB, getMongoDbName } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  const envKeys = Object.keys(process.env).filter((k) =>
    /uber|client|secret|store|mongo/i.test(k)
  );

  let databaseName: string | null = null;
  let collections: string[] = [];
  const sampleSettingsKeys: Array<{ collection: string; keys: string[]; apiConfigKeys?: string[] }> = [];
  let dbError: string | null = null;

  if (process.env.MONGODB_URI) {
    try {
      const conn = await connectToMongoDB(1);
      if (conn) {
        const db = conn.db;
        databaseName = db.databaseName || getMongoDbName();
        const cols = await db.listCollections().toArray();
        collections = cols.map((c) => c.name);

        for (const name of collections) {
          if (/setting|config|integrat|uber|store/i.test(name)) {
            const doc = await db.collection(name).findOne({});
            if (doc) {
              const apiConfig =
                doc.apiConfig && typeof doc.apiConfig === 'object'
                  ? Object.keys(doc.apiConfig as Record<string, unknown>)
                  : undefined;
              sampleSettingsKeys.push({
                collection: name,
                keys: Object.keys(doc),
                ...(apiConfig ? { apiConfigKeys: apiConfig } : {}),
              });
            }
          }
        }
      } else {
        dbError = 'MongoDB connection unavailable';
      }
    } catch (err: unknown) {
      dbError = err instanceof Error ? err.message : 'Failed to inspect MongoDB collections';
    }
  }

  return NextResponse.json({
    envKeys,
    databaseName,
    collections,
    sampleSettingsKeys,
    ...(dbError ? { dbError } : {}),
  });
}
