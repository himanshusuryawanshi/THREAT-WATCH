import axios    from 'axios'
import pool     from '../db/pool.js'
import { pipeline } from 'stream/promises'
import { createWriteStream, createReadStream, unlinkSync } from 'fs'
import { createInterface } from 'readline'
import { promisify } from 'util'
import { exec }  from 'child_process'

const execAsync = promisify(exec)

// ── GDELT ISO country code → full country name ───────────────────────────────
const ISO_TO_COUNTRY = {
  'AF': 'Afghanistan',   'AL': 'Albania',        'DZ': 'Algeria',
  'AO': 'Angola',        'AR': 'Argentina',      'AM': 'Armenia',
  'AU': 'Australia',     'AZ': 'Azerbaijan',     'BH': 'Bahrain',
  'BD': 'Bangladesh',    'BY': 'Belarus',        'BZ': 'Belize',
  'BJ': 'Benin',         'BO': 'Bolivia',        'BA': 'Bosnia',
  'BW': 'Botswana',      'BR': 'Brazil',         'BF': 'Burkina Faso',
  'BI': 'Burundi',       'KH': 'Cambodia',       'CM': 'Cameroon',
  'CA': 'Canada',        'CF': 'CAR',            'TD': 'Chad',
  'CL': 'Chile',         'CN': 'China',          'CO': 'Colombia',
  'CG': 'Congo',         'ZR': 'DR Congo',       'CR': 'Costa Rica',
  'HR': 'Croatia',       'CU': 'Cuba',           'CY': 'Cyprus',
  'CZ': 'Czech Republic','DK': 'Denmark',        'DJ': 'Djibouti',
  'DO': 'Dominican Republic', 'EC': 'Ecuador',   'EG': 'Egypt',
  'SV': 'El Salvador',   'GQ': 'Eq. Guinea',     'ER': 'Eritrea',
  'ET': 'Ethiopia',      'FI': 'Finland',        'FR': 'France',
  'GA': 'Gabon',         'GM': 'Gambia',         'GE': 'Georgia',
  'DE': 'Germany',       'GH': 'Ghana',          'GR': 'Greece',
  'GT': 'Guatemala',     'GN': 'Guinea',         'GW': 'Guinea-Bissau',
  'GY': 'Guyana',        'HT': 'Haiti',          'HN': 'Honduras',
  'HU': 'Hungary',       'IN': 'India',          'ID': 'Indonesia',
  'IR': 'Iran',          'IQ': 'Iraq',           'IE': 'Ireland',
  'IS': 'Israel',        'IT': 'Italy',          'JM': 'Jamaica',
  'JP': 'Japan',         'JO': 'Jordan',         'KZ': 'Kazakhstan',
  'KE': 'Kenya',         'KP': 'North Korea',    'KR': 'South Korea',
  'KW': 'Kuwait',        'KG': 'Kyrgyzstan',     'LA': 'Laos',
  'LB': 'Lebanon',       'LR': 'Liberia',        'LY': 'Libya',
  'MK': 'North Macedonia','MG': 'Madagascar',    'MW': 'Malawi',
  'MY': 'Malaysia',      'ML': 'Mali',           'MR': 'Mauritania',
  'MX': 'Mexico',        'MD': 'Moldova',        'MA': 'Morocco',
  'MZ': 'Mozambique',    'MM': 'Myanmar',        'NA': 'Namibia',
  'NP': 'Nepal',         'NL': 'Netherlands',    'NZ': 'New Zealand',
  'NI': 'Nigeria',       'NO': 'Norway',         'PK': 'Pakistan',
  'PA': 'Panama',        'PG': 'Papua New Guinea','PY': 'Paraguay',
  'PE': 'Peru',          'PH': 'Philippines',    'PL': 'Poland',
  'PT': 'Portugal',      'QA': 'Qatar',          'RO': 'Romania',
  'RS': 'Russia',        'RW': 'Rwanda',         'SA': 'Saudi Arabia',
  'SN': 'Senegal',       'SL': 'Sierra Leone',   'SO': 'Somalia',
  'ZA': 'South Africa',  'SS': 'South Sudan',    'ES': 'Spain',
  'LK': 'Sri Lanka',     'SD': 'Sudan',          'SE': 'Sweden',
  'SY': 'Syria',         'TW': 'Taiwan',         'TJ': 'Tajikistan',
  'TZ': 'Tanzania',      'TH': 'Thailand',       'TL': 'Timor-Leste',
  'TG': 'Togo',          'TT': 'Trinidad',       'TN': 'Tunisia',
  'TR': 'Turkey',        'TM': 'Turkmenistan',   'UG': 'Uganda',
  'UK': 'Ukraine',       'AE': 'UAE',            'GB': 'United Kingdom',
  'US': 'United States', 'UY': 'Uruguay',        'UZ': 'Uzbekistan',
  'VE': 'Venezuela',     'VN': 'Vietnam',        'YE': 'Yemen',
  'ZM': 'Zambia',        'ZW': 'Zimbabwe',
  // GDELT-specific codes
  'SU': 'Sudan',         'SF': 'South Africa',   'IV': 'Ivory Coast',
  'LE': 'Lebanon',       'MO': 'Morocco',        'WI': 'West Bank',
  'GZ': 'Palestine',     'VM': 'Vietnam',        'YM': 'Yemen',
  'GM': 'Gambia',        'EI': 'Ireland',        'UP': 'Ukraine',
}

// ── CAMEO event code → human readable type ───────────────────────────────────
const CAMEO_TYPE = {
  '1':  'Verbal cooperation',     '2':  'Material cooperation',
  '3':  'Verbal conflict',        '4':  'Material conflict',
  '10': 'Demand',                 '11': 'Disapprove',
  '12': 'Reject',                 '13': 'Threaten',
  '14': 'Protest',                '15': 'Exhibit force posture',
  '16': 'Reduce relations',       '17': 'Coerce',
  '18': 'Assault',                '19': 'Fight',
  '20': 'Use unconventional mass violence',
}

// QuadClass → our event type schema
const QUAD_TYPE = {
  '1': 'Strategic developments',
  '2': 'Strategic developments',
  '3': 'Protests',
  '4': 'Battles',
}

// CAMEO root codes that indicate strikes/explosions
const STRIKE_CODES = new Set(['18', '19', '20'])

// ── Column indices in GDELT 2.0 export CSV (verified) ───────────────────────
const COL = {
  ID:              0,
  DAY:             1,
  ACTOR1_NAME:     6,
  ACTOR2_NAME:     16,
  EVENT_CODE:      26,
  EVENT_ROOT:      28,
  QUAD_CLASS:      29,
  GOLDSTEIN:       30,
  NUM_MENTIONS:    31,
  AVG_TONE:        34,
  ACTOR1_GEO_TYPE: 35,   // precision of actor1 location
  ACTOR1_LAT:      40,
  ACTOR1_LNG:      41,
  ACTION_GEO_TYPE: 51,   // ← KEY: 1=country, 2=state, 3=city, 4=exact point
  ACTION_GEO:      52,
  ACTION_COUNTRY:  53,   // ISO 2-letter code
  ACTION_LAT:      56,
  ACTION_LNG:      57,
  SOURCE_URL:      60,
}

// ── Parse one GDELT CSV row ──────────────────────────────────────────────────
function parseRow(cols) {
  // ── Fix 1: Filter by ActionGeo_Type — skip country-centroid events ─────────
  const geoType = parseInt(cols[COL.ACTION_GEO_TYPE]) || 0
  if (geoType < 2) return null   // 1 = country centroid = too imprecise

  const lat = parseFloat(cols[COL.ACTION_LAT])
  const lng = parseFloat(cols[COL.ACTION_LNG])
  if (isNaN(lat) || isNaN(lng)) return null

  const dayStr = cols[COL.DAY] || ''
  const date   = dayStr.length === 8
    ? `${dayStr.slice(0,4)}-${dayStr.slice(4,6)}-${dayStr.slice(6,8)}`
    : null
  if (!date) return null

  const quadClass = cols[COL.QUAD_CLASS] || '1'
  const rootCode  = cols[COL.EVENT_ROOT] || '1'

  // Only include conflict events (QuadClass 3 or 4)
  if (quadClass !== '3' && quadClass !== '4') return null

  const isStrike = STRIKE_CODES.has(rootCode)
  const type     = isStrike ? 'Explosions/Remote violence' : (QUAD_TYPE[quadClass] || 'Strategic developments')
  const subtype  = isStrike ? 'Explosions/Remote violence' : (CAMEO_TYPE[rootCode] || 'Unknown')

  // ── Fix 2: ISO → full country name ────────────────────────────────────────
  const isoCode  = cols[COL.ACTION_COUNTRY] || ''
  const country  = ISO_TO_COUNTRY[isoCode] || isoCode   // fallback to ISO if unknown

  // ── Fix 3: Use ActionGeo full name for location, not actor geo ────────────
  const location = cols[COL.ACTION_GEO] || ''

  const actor     = cols[COL.ACTOR1_NAME] || ''
  const actor2    = cols[COL.ACTOR2_NAME] || ''
  const sourceUrl = cols[COL.SOURCE_URL]  || ''
  const goldstein = parseFloat(cols[COL.GOLDSTEIN]) || 0

  // Actor1 origin — only use if actor1 has a precise location (type 3 or 4)
  const actor1GeoType = parseInt(cols[COL.ACTOR1_GEO_TYPE]) || 0
  const originLat = actor1GeoType >= 3 ? parseFloat(cols[COL.ACTOR1_LAT]) : null
  const originLng = actor1GeoType >= 3 ? parseFloat(cols[COL.ACTOR1_LNG]) : null

  return {
    id:        `GDELT_${cols[COL.ID]}`,
    date,
    type,
    subtype,
    country,
    location:  location.split(',')[0]?.trim() || location,
    lat,
    lng,
    originLat: originLat && !isNaN(originLat) ? originLat : null,
    originLng: originLng && !isNaN(originLng) ? originLng : null,
    actor:     actor.substring(0, 200),
    actor2:    actor2.substring(0, 200) || null,
    fatal:     0,
    notes:     sourceUrl,
    source:    'GDELT',
    disorder:  goldstein < -5 ? 'High conflict' : goldstein < 0 ? 'Conflict' : 'Low conflict',
  }
}

// ── Download and parse a single GDELT CSV.zip ────────────────────────────────
async function fetchGDELTFile(url) {
  const filename = url.split('/').pop().replace('.zip', '')  // e.g. 20260403000000.export.CSV
  const tmpDir   = `/tmp/gdelt_${filename}`
  const tmpZip   = `${tmpDir}.zip`

  try {
    const res = await axios.get(url, { responseType: 'stream', timeout: 30000 })
    await pipeline(res.data, createWriteStream(tmpZip))

    await execAsync(`mkdir -p ${tmpDir} && unzip -o ${tmpZip} -d ${tmpDir}/`)

    const tmpCsv = `${tmpDir}/${filename}`

    const events = []
    const rl = createInterface({ input: createReadStream(tmpCsv), crlfDelay: Infinity })
    for await (const line of rl) {
      const cols = line.split('\t')
      if (cols.length < 58) continue
      const ev = parseRow(cols)
      if (ev) events.push(ev)
    }

    return events
  } finally {
    try { unlinkSync(tmpZip) } catch {}
    try { await execAsync(`rm -rf ${tmpDir}`) } catch {}
  }
}

// ── Get the latest GDELT file URL ────────────────────────────────────────────
async function getLatestFileUrl() {
  const res  = await axios.get('http://data.gdeltproject.org/gdeltv2/lastupdate.txt', { timeout: 10000 })
  const line = res.data.split('\n')[0]
  return line.split(' ')[2]?.trim()
}

// ── Get all 15-min file URLs for a given day ─────────────────────────────────
export function getGDELTUrls(dateStr) {
  const urls = []
  for (let hour = 0; hour < 24; hour++) {
    for (const min of ['00', '15', '30', '45']) {
      const hh = String(hour).padStart(2, '0')
      urls.push(`http://data.gdeltproject.org/gdeltv2/${dateStr}${hh}${min}00.export.CSV.zip`)
    }
  }
  return urls
}

// ── Upsert batch into Postgres ────────────────────────────────────────────────
async function upsertBatch(events) {
  if (!events.length) return 0
  const client = await pool.connect()
  let inserted = 0

  try {
    await client.query('BEGIN')
    for (const e of events) {
      await client.query(`
        INSERT INTO events (
          id, date, type, subtype, country, location,
          lat, lng, origin_lat, origin_lng, geom,
          actor, actor2, fatal, notes, source, disorder
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7::double precision, $8::double precision,
          $9::double precision, $10::double precision,
          CASE WHEN $7 IS NOT NULL AND $8 IS NOT NULL
            THEN ST_SetSRID(ST_MakePoint($8::double precision, $7::double precision), 4326)
            ELSE NULL
          END,
          $11, $12, $13::integer, $14, $15, $16
        )
        ON CONFLICT (id) DO NOTHING
      `, [
        e.id, e.date, e.type, e.subtype, e.country, e.location,
        e.lat, e.lng, e.originLat, e.originLng,
        e.actor, e.actor2, e.fatal, e.notes, e.source, e.disorder,
      ])
      inserted++
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
  return inserted
}

// ── Ingest the latest 15-min file ────────────────────────────────────────────
export async function ingestLatestGDELT() {
  console.log('[gdelt] fetching latest file...')
  const url      = await getLatestFileUrl()
  console.log('[gdelt] url:', url)
  const events   = await fetchGDELTFile(url)
  const inserted = await upsertBatch(events)
  console.log(`[gdelt] ingested ${inserted} conflict events from latest file`)
  return inserted
}

// ── Backfill a full day ──────────────────────────────────────────────────────
export async function ingestDay(dateStr) {
  const urls  = getGDELTUrls(dateStr)
  let   total = 0

  for (const url of urls) {
    try {
      const events   = await fetchGDELTFile(url)
      const inserted = await upsertBatch(events)
      total += inserted
      process.stdout.write('.')
    } catch {
      process.stdout.write('x')
    }
  }

  console.log(`\n[gdelt] ${dateStr} — ${total} events ingested`)
  return total
}

// ── Query events from Postgres with filters ──────────────────────────────────
export async function queryEvents({ country, type, dateFrom, dateTo } = {}) {
  const conditions = []
  const params     = []
  let   idx        = 1

  if (country) {
    conditions.push(`country = $${idx++}`)
    params.push(country)
    // No date cap for country queries — show all time
  } else {
    // Global — default last 7 days if no dateFrom given
    if (dateFrom) {
      conditions.push(`date >= $${idx++}`)
      params.push(dateFrom)
    } else {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      conditions.push(`date >= $${idx++}`)
      params.push(d.toISOString().split('T')[0])
    }
  }

  if (type)   { conditions.push(`type = $${idx++}`);  params.push(type) }
  if (dateTo) { conditions.push(`date <= $${idx++}`); params.push(dateTo) }

  const where = `WHERE ${conditions.join(' AND ')}`

  const result = await pool.query(`
    SELECT
      id, date, type, subtype, country, location,
      lat, lng, origin_lat AS "originLat", origin_lng AS "originLng",
      actor, actor2, fatal, notes, source, disorder
    FROM events
    ${where}
    ORDER BY date DESC
  `, params)

  return result.rows
}

// ── Query events within radius (PostGIS) ─────────────────────────────────────
export async function queryEventsNear({ lat, lng, radiusKm = 500, limit = 500 } = {}) {
  const result = await pool.query(`
    SELECT
      id, date, type, subtype, country, location,
      lat, lng, origin_lat AS "originLat", origin_lng AS "originLng",
      actor, fatal, notes,
      ST_Distance(geom::geography, ST_MakePoint($2, $1)::geography) / 1000 AS distance_km
    FROM events
    WHERE ST_DWithin(
      geom::geography,
      ST_MakePoint($2, $1)::geography,
      $3 * 1000
    )
    ORDER BY date DESC
    LIMIT $4
  `, [lat, lng, radiusKm, limit])

  return result.rows
}