/**
 * Redis Cache Layer — Blueprint Part 4, Rules 11-14
 *
 * THREE GUARANTEES:
 *  1. Cache miss → falls through to DB transparently (rule 14)
 *  2. Redis down → app still works, all errors are warnings (rule 14)
 *  3. After every ingest cycle, stale keys are flushed (rule 12)
 */

import Redis  from 'ioredis'
import dotenv from 'dotenv'
dotenv.config({ path: '../.env' })

// ── Redis client ──────────────────────────────────────────────────────────────
// lazyConnect = true  → don't crash on startup if Redis is briefly unavailable
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect:       true,
  enableReadyCheck:  false,
  maxRetriesPerRequest: 1,
  retryStrategy: (times) => {
    if (times > 3) return null   // stop retrying after 3 attempts
    return Math.min(times * 200, 1000)
  },
})

redis.on('error',   err  => console.warn('[cache] Redis error (falling back to DB):', err.message))
redis.on('connect', ()   => console.log('[cache] Redis connected'))

// ── Cache middleware ──────────────────────────────────────────────────────────
// keyFn: string or (req) => string
// ttlSeconds: how long to cache the response
//
// Usage:
//   router.get('/foo', cacheMiddleware(req => `foo:${req.query.id}`, 300), handler)
//
export function cacheMiddleware(keyFn, ttlSeconds) {
  return async (req, res, next) => {
    const key = typeof keyFn === 'function' ? keyFn(req) : keyFn
    try {
      const cached = await redis.get(key)
      if (cached) {
        return res.json(JSON.parse(cached))
      }
    } catch {
      // Redis down or timeout — fall through to DB, no crash
    }

    // Intercept res.json to cache the response before sending it
    const originalJson = res.json.bind(res)
    res.json = (data) => {
      // Fire-and-forget — never let cache write block the response
      redis.setex(key, ttlSeconds, JSON.stringify(data)).catch(() => {})
      return originalJson(data)
    }
    next()
  }
}

// ── Pattern flush ─────────────────────────────────────────────────────────────
// Deletes all keys matching a glob pattern (e.g. 'events:*')
export async function flushPattern(pattern) {
  try {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) await redis.del(...keys)
  } catch (err) {
    console.warn('[cache] flush error:', err.message)
  }
}

// ── Per-ingest invalidation functions ─────────────────────────────────────────
// Called at the end of each ingest cycle. Flushes stale keys AND refreshes
// materialized views so the next DB query is fresh.

export async function onUcdpIngest(db) {
  await Promise.all([
    flushPattern('events:*'),
    flushPattern('arcs:*'),
    flushPattern('conflicts:*'),
    flushPattern('choropleth:*'),
    flushPattern('risk:*'),
    flushPattern('stats:*'),
  ])
  // Refresh materialized views CONCURRENTLY — reads never blocked during refresh
  try {
    await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_country_stats')
    await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_choropleth')
    await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_event_breakdown')
    await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_countries')
    console.log('[cache] materialized views refreshed after UCDP ingest')
  } catch (err) {
    console.warn('[cache] materialized view refresh failed:', err.message)
  }
}

export async function onFirmsIngest(db) {
  await flushPattern('fires:*')
  try {
    await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_firms_conflict_summary')
    console.log('[cache] mv_firms_conflict_summary refreshed after FIRMS ingest')
  } catch (err) {
    console.warn('[cache] FIRMS view refresh failed:', err.message)
  }
}

export async function onGdeltIngest() {
  await Promise.all([
    flushPattern('breaking:*'),
    flushPattern('tone:*'),
    flushPattern('articles:*'),
  ])
}

export async function onReliefwebIngest() {
  await Promise.all([
    flushPattern('humanitarian:*'),
    flushPattern('context:*'),
  ])
}

export async function onUnhcrIngest() {
  await flushPattern('displacement:*')
}

export { redis }
