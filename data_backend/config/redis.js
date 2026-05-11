import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

let connection = null;

export function getRedisConnection() {
  if (!connection) {
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      retryStrategy(times) {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 200, 2000);
      },
    });

    connection.on('error', (err) => {
      console.error('⚠️  Redis connection error:', err.message);
    });

    connection.on('connect', () => {
      console.log('✅ Connected to Redis');
    });
  }
  return connection;
}

// Cache helper functions
export async function cacheGet(key) {
  try {
    const conn = getRedisConnection();
    const data = await conn.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key, value, ttlSeconds = 3600) {
  try {
    const conn = getRedisConnection();
    await conn.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // Cache failures are non-critical
  }
}

export async function cacheDel(key) {
  try {
    const conn = getRedisConnection();
    await conn.del(key);
  } catch {
    // Non-critical
  }
}
