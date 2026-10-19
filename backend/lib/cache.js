// Redis caching layer with automatic in-memory fallback (Phase 2 feature).
// If REDIS_HOST/REDIS_URL is not configured or Redis is down, a TTL Map is used.
let redisClient = null;
let useRedis = false;
const memory = new Map();

async function initCache() {
  const url = process.env.REDIS_URL || (process.env.REDIS_HOST ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}` : null);
  if (!url) {
    console.warn('[cache] Redis not configured — using in-memory cache');
    return;
  }
  try {
    const redis = require('redis');
    redisClient = redis.createClient({ url, socket: { reconnectStrategy: () => false } });
    redisClient.on('error', () => {});
    await redisClient.connect();
    useRedis = true;
    console.log('[cache] Redis connected at', url);
  } catch (err) {
    useRedis = false;
    console.warn('[cache] Redis unavailable — using in-memory cache:', err.message);
  }
}

function cacheMode() {
  return useRedis ? 'redis' : 'memory';
}

async function cacheGet(key) {
  if (useRedis) {
    try {
      const raw = await redisClient.get(key);
      return raw ? JSON.parse(raw) : null;
    } catch { /* fall through */ }
  }
  const hit = memory.get(key);
  if (!hit) return null;
  if (hit.exp < Date.now()) { memory.delete(key); return null; }
  return hit.val;
}

async function cacheSet(key, val, ttlSec = 60) {
  if (useRedis) {
    try {
      await redisClient.set(key, JSON.stringify(val), { EX: ttlSec });
      return;
    } catch { /* fall through */ }
  }
  memory.set(key, { val, exp: Date.now() + ttlSec * 1000 });
}

// Express middleware: cache successful GET responses per URL.
function cacheMiddleware(prefix, ttlSec = 60) {
  return async (req, res, next) => {
    if (req.method !== 'GET') return next();
    const key = `${prefix}:${req.originalUrl}`;
    const hit = await cacheGet(key);
    if (hit) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(hit);
    }
    const origJson = res.json.bind(res);
    res.json = (body) => { cacheSet(key, body, ttlSec); res.setHeader('X-Cache', 'MISS'); return origJson(body); };
    next();
  };
}

module.exports = { initCache, cacheMode, cacheGet, cacheSet, cacheMiddleware };
