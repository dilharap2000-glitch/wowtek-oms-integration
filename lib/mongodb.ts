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
 * Optimized Serverless MongoDB Client Options:
 * - connectTimeoutMS: 10000 (10 seconds connection establishment limit)
 * - socketTimeoutMS: 45000 (45 seconds operational socket limit for serverless queries)
 * - serverSelectionTimeoutMS: 10000 (Strict 10s ceiling prevents the default 30s connection timeout during DNS / cluster election)
 * - maxPoolSize: 10, minPoolSize: 1 (Proper connection pooling for Next.js Serverless routes)
 * - maxIdleTimeMS: 30000 (Recycles idle sockets after 30s)
 * - retryWrites: true, retryReads: true (Automatic retry on transient network hiccups)
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
 * Connects to MongoDB Atlas using connection pooling optimized for Next.js Serverless.
 * Caches the client promise globally across serverless function re-invocations without
 * premature 2-3 second fallbacks.
 */
export async function connectToMongoDB(): Promise<CachedConnection | null> {
  const uri = getMongoUri();
  const dbName = getMongoDbName();

  if (!uri || typeof window !== 'undefined') {
    return null;
  }

  // Fast-path: return cached connection if active
  if (global._mongoCachedConnection) {
    return global._mongoCachedConnection;
  }

  try {
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri, MONGO_CLIENT_OPTIONS);
      global._mongoClientPromise = client.connect().catch((err) => {
        // Reset cached promise so next request retries cleanly instead of keeping rejected promise
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
    global._mongoClientPromise = undefined;
    global._mongoCachedConnection = undefined;
    throw err;
  }
}

/**
 * Shared MongoClient singleton promise export for Next.js
 */
export function getMongoClientPromise(): Promise<MongoClient> | null {
  const uri = getMongoUri();
  if (!uri || typeof window !== 'undefined') return null;

  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, MONGO_CLIENT_OPTIONS);
    global._mongoClientPromise = client.connect().catch((err) => {
      global._mongoClientPromise = undefined;
      global._mongoCachedConnection = undefined;
      throw err;
    });
  }
  return global._mongoClientPromise;
}

export default getMongoClientPromise();
