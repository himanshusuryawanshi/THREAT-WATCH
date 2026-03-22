import axios from 'axios'
import { getToken } from '../auth/token.js'
import { getCache, setCache } from '../cache/memory.js'

const CACHE_TTL        = 86400
const ACLED_END_DATE   = '2025-11-30'
const ACLED_START_DATE = '2025-01-01'
const PAGE_SIZE        = 500
const MAX_PAGES        = 6

const ACTOR_ORIGINS = {
  'military forces of russia':     { lat: 55.755, lng: 37.617 },
  'russian':                       { lat: 55.755, lng: 37.617 },
  'israeli':                       { lat: 31.046, lng: 34.851 },
  'israel':                        { lat: 31.046, lng: 34.851 },
  'idf':                           { lat: 31.046, lng: 34.851 },
  'houthi':                        { lat: 15.369, lng: 44.191 },
  'ttp':                           { lat: 33.720, lng: 73.060 },
  'al-shabaab':                    { lat: 2.046,  lng: 45.341 },
  'al shabaab':                    { lat: 2.046,  lng: 45.341 },
  'rsf':                           { lat: 15.552, lng: 32.532 },
  'rapid support':                 { lat: 15.552, lng: 32.532 },
  'jnim':                          { lat: 17.570, lng: -3.996 },
  'hamas':                         { lat: 31.344, lng: 34.306 },
  'islamic state':                 { lat: 33.315, lng: 44.366 },
  'isis':                          { lat: 33.315, lng: 44.366 },
  'wagner':                        { lat: 55.755, lng: 37.617 },
  'taliban':                       { lat: 34.525, lng: 69.178 },
  "people's defense force":        { lat: 16.866, lng: 96.195 },
  'myanmar':                       { lat: 16.866, lng: 96.195 },
  'junta':                         { lat: 16.866, lng: 96.195 },
  'iscap':                         { lat: -13.00, lng: 40.000 },
  'boko haram':                    { lat: 11.849, lng: 13.097 },
  'hezbollah':                     { lat: 33.854, lng: 35.862 },
  'pmc':                           { lat: 55.755, lng: 37.617 },
}

const COUNTRY_CAPITALS = {
  'Ukraine':       { lat: 50.450, lng: 30.523 },
  'Sudan':         { lat: 15.552, lng: 32.532 },
  'Myanmar':       { lat: 16.866, lng: 96.195 },
  'Gaza':          { lat: 31.505, lng: 34.466 },
  'Somalia':       { lat: 2.046,  lng: 45.341 },
  'Ethiopia':      { lat: 9.025,  lng: 38.747 },
  'Mali':          { lat: 12.650, lng: -8.000 },
  'Burkina Faso':  { lat: 12.364, lng: -1.533 },
  'Nigeria':       { lat: 9.082,  lng: 8.675  },
  'Afghanistan':   { lat: 34.525, lng: 69.178 },
  'Yemen':         { lat: 15.369, lng: 44.191 },
  'Syria':         { lat: 33.510, lng: 36.292 },
  'Iraq':          { lat: 33.315, lng: 44.366 },
  'Pakistan':      { lat: 33.720, lng: 73.060 },
  'DR Congo':      { lat: -4.322, lng: 15.322 },
  'Mozambique':    { lat: -25.966,lng: 32.573 },
  'Haiti':         { lat: 18.542, lng: -72.338},
  'Libya':         { lat: 32.902, lng: 13.180 },
  'CAR':           { lat: 4.361,  lng: 18.555 },
  'Cameroon':      { lat: 3.848,  lng: 11.502 },
  'West Bank':     { lat: 31.952, lng: 35.233 },
}

function getActorOrigin(actor, country) {
  if (!actor) return null
  const a = actor.toLowerCase()

  // Check known actors
  const key = Object.keys(ACTOR_ORIGINS).find(k => a.includes(k))
  if (key) return ACTOR_ORIGINS[key]

  // Fall back to country capital
  if (country && COUNTRY_CAPITALS[country]) return COUNTRY_CAPITALS[country]

  return null
}

export async function fetchACLED({ limit = 3000 } = {}) {
  const cacheKey = `acled_global`
  const cached   = getCache(cacheKey)
  if (cached) {
    console.log('[acled] cache hit —', cached.length, 'events')
    return cached
  }

  console.log('[acled] fetching from API...')
  const token     = await getToken()
  const allEvents = []

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await axios.get('https://acleddata.com/api/acled/read', {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        _format:          'json',
        event_date:       `${ACLED_START_DATE}|${ACLED_END_DATE}`,
        event_date_where: 'BETWEEN',
        limit:            PAGE_SIZE,
        page,
      },
    })

    const batch = res.data.data || []
    console.log(`[acled] page ${page} — ${batch.length} events`)
    for (const event of batch) allEvents.push(event)
    if (batch.length < PAGE_SIZE) break
  }

  console.log('[acled] total before normalize:', allEvents.length)
  const events = allEvents.slice(0, limit).map(normalizeACLED)
  setCache(cacheKey, events, CACHE_TTL)
  console.log(`[acled] total ${events.length} events cached for 24h`)
  return events
}

function normalizeACLED(e) {
  const origin = getActorOrigin(e.actor1, e.country)
  const lat    = parseFloat(e.latitude)
  const lng    = parseFloat(e.longitude)

  return {
    id:        e.event_id_cnty,
    date:      e.event_date,
    type:      mapEventType(e.event_type),
    subtype:   e.sub_event_type,
    country:   e.country,
    location:  e.location || e.admin1,
    lat,
    lng,
    originLat: origin ? origin.lat : lat,
    originLng: origin ? origin.lng : lng,
    actor:     e.actor1,
    actor2:    e.actor2 || null,
    fatal:     parseInt(e.fatalities) || 0,
    notes:     e.notes || '',
    source:    'ACLED',
    disorder:  e.disorder_type || '',
  }
}

function mapEventType(type) {
  const map = {
    'Battles':                    'Battles',
    'Explosions/Remote violence': 'Explosions/Remote violence',
    'Violence against civilians': 'Violence against civilians',
    'Protests':                   'Protests',
    'Riots':                      'Riots',
    'Strategic developments':     'Strategic developments',
  }
  return map[type] || type
}