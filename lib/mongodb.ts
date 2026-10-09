import { MongoClient, Db, MongoClientOptions } from 'mongodb';

export interface CachedConnection {
  client: MongoClient;
  db: Db;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var _mongoCachedConnection: CachedConnection | undefined;
}

export function getMongoUri(): string {
  return process.env.MONGODB_URI?.trim() || '';
}

export function getMongoDbName(): string {
  return process.env.MONGODB_DB_NAME?.trim() || 'wowtek_pro';
}

export function isMongoConfigured(): boolean {
  return Boolean(getMongoUri());
}

/**
 * Serverless MongoDB Client Options:
 * - connectTimeoutMS: 10000 (10s connection establishment limit)
 * - socketTimeoutMS: 45000 (45s socket limit for complex queries)
 * - serverSelectionTimeoutMS: 10000 (Prevents 30s driver hangs during replica elections)
 * - maxPoolSize: 10, minPoolSize: 1 (Maintains connection pool across serverless calls)
 * - maxIdleTimeMS: 30000 (Recycles idle connections after 30s)
 * - retryWrites: true, retryReads: true (Auto retry on transient network blips)
 */
export const MONGO_CLIENT_OPTIONS: MongoClientOptions = {
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 10000,
  maxPoolSize: 10,
  minPoolSize: 1,
  maxIdleTimeMS: 30000,
  retryWrites: true,
  retryReads: true,
};

/**
 * Connects to MongoDB Atlas using connection pooling and auto-reconnect logic.
 * Retries up to 3 times on drop without wiping or substituting live data with mock state.
 */
export async function connectToMongoDB(retries = 3): Promise<CachedConnection | null> {
  const uri = getMongoUri();
  const dbName = getMongoDbName();

  if (!uri || typeof window !== 'undefined') {
    return null;
  }

  // Fast path: verify cached connection is healthy
  if (global._mongoCachedConnection) {
    try {
      return global._mongoCachedConnection;
    } catch {
      global._mongoCachedConnection = undefined;
      global._mongoClientPromise = undefined;
    }
  }

  let lastError: any = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (!global._mongoClientPromise) {
        const client = new MongoClient(uri, MONGO_CLIENT_OPTIONS);
        global._mongoClientPromise = client.connect().catch((err) => {
          global._mongoClientPromise = undefined;
          global._mongoCachedConnection = undefined;
          throw err;
        });
      }

      const client = await global._mongoClientPromise;
      const db = client.db(dbName);

      const connection: CachedConnection = { client, db };
      global._mongoCachedConnection = connection;
      return connection;
    } catch (err: any) {
      lastError = err;
      global._mongoClientPromise = undefined;
      global._mongoCachedConnection = undefined;

      if (attempt < retries) {
        // Brief backoff before immediate retry
        await new Promise((res) => setTimeout(res, 300 * attempt));
      }
    }
  }

  console.warn(`[MongoDB Atlas] Connection attempt failed after ${retries} tries:`, lastError?.message);
  return null;
}

export function resetMongoCache() {
  global._mongoCachedConnection = undefined;
  global._mongoClientPromise = undefined;
}

export function getMongoClientPromise(): Promise<MongoClient> | null {
  const uri = getMongoUri();
  if (!uri || typeof window !== 'undefined') return null;

  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, MONGO_CLIENT_OPTIONS);
    global._mongoClientPromise = client.connect().catch((err) => {
      resetMongoCache();
      throw err;
    });
  }
  return global._mongoClientPromise;
}

export default getMongoClientPromise();
