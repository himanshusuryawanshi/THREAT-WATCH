import axios from 'axios'
import { getCache, setCache } from '../cache/memory.js'

const CACHE_TTL = 900 // 15 minutes

export async function fetchGDELT({ limit = 250 } = {}) {
  const cacheKey = `gdelt_${limit}`
  const cached   = getCache(cacheKey)
  if (cached) {
    console.log('[gdelt] cache hit')
    return cached
  }

  console.log('[gdelt] cache miss — fetching...')

  // GDELT GKG API — last 15 minutes of conflict events
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=conflict%20OR%20attack%20OR%20explosion%20OR%20protest&mode=artlist&maxrecords=${limit}&format=json&timespan=15min`

  try {
    const res    = await axios.get(url, { timeout: 10000 })
    const items  = res.data.articles || []
    const events = items.map(normalizeGDELT).filter(e => e.lat && e.lng)

    setCache(cacheKey, events, CACHE_TTL)
    console.log(`[gdelt] fetched ${events.length} events, cached for 15min`)
    return events
  } catch (err) {
    console.error('[gdelt] fetch failed:', err.message)
    return []
  }
}

function normalizeGDELT(item) {
  return {
    id:       `gdelt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    date:     item.seendate?.slice(0, 10) || new Date().toISOString().split('T')[0],
    type:     'Explosions/Remote violence',
    country:  item.sourcecountry || 'Unknown',
    location: item.title?.slice(0, 40) || 'Unknown',
    lat:      parseFloat(item.socialimage) || null,
    lng:      null,
    actor:    item.domain || 'Unknown',
    fatal:    0,
    notes:    item.title || '',
    source:   'GDELT',
    url:      item.url || '',
  }
}