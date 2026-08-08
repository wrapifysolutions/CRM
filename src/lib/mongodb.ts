import mongoose from "mongoose";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  uri: string | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
  uri: null,
};

global.mongooseCache = cached;

function getMongoUri() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error(
      "MONGODB_URI is missing. Add it to .env.local and restart npm run dev."
    );
  }
  return uri;
}

/**
 * Shared Mongo connection with pool settings for concurrent users.
 * Reuses one connection promise across the Node process.
 */
export async function connectMongo() {
  const uri = getMongoUri();

  if (cached.uri && cached.uri !== uri) {
    cached.conn = null;
    cached.promise = null;
  }

  if (cached.conn) {
    if (cached.conn.connection.readyState === 1) return cached.conn;
    cached.conn = null;
    cached.promise = null;
  }

  if (!cached.promise) {
    cached.uri = uri;
    cached.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
        maxPoolSize: Number(process.env.MONGO_MAX_POOL ?? 50),
        minPoolSize: Number(process.env.MONGO_MIN_POOL ?? 2),
        maxIdleTimeMS: 30_000,
        serverSelectionTimeoutMS: 8_000,
        socketTimeoutMS: 30_000,
      })
      .then((m) => m)
      .catch((err) => {
        cached.promise = null;
        const msg = err instanceof Error ? err.message : String(err);
        if (/bad auth|authentication failed/i.test(msg)) {
          throw new Error(
            "MongoDB authentication failed. Update MONGODB_URI username/password in .env.local (Atlas → Database Access → Edit user → set new password), then restart npm run dev."
          );
        }
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
