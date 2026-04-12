/**
 * In-Memory LRU Cache — Level 3 cache for ultra-hot paths.
 * Blueprint Part 4: "per-process, for ultra-hot paths"
 *
 * Lives in each server process (not shared across workers).
 * Falls back to Redis → DB if key is not in LRU.
 *
 * Three caches:
 *  - geoBoundariesCache  : Natural Earth GeoJSON — static, rarely changes
 *  - actorCache          : Actor lookups — frequently repeated
 *  - bboxCache           : Bounding-box event queries — user pans/zooms the map rapidly
 */

import { LRUCache } from 'lru-cache'

// Geo boundaries — essentially static data, cache for 24 hours
export const geoBoundariesCache = new LRUCache({
  max: 1,
  ttl: 1000 * 60 * 60 * 24,   // 24 hours
})

// Actor lookups — up to 500 actors, 30-minute TTL
export const actorCache = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 30,         // 30 minutes
})

// Bbox event queries — users pan/zoom the map rapidly, 200 cached tiles, 2-min TTL
export const bboxCache = new LRUCache({
  max: 200,
  ttl: 1000 * 60 * 2,          // 2 minutes
})
