/**
 * GDELT Intelligence Service
 *
 * GDELT's ROLE (Blueprint Part 3 + Part 6 Rule #3):
 *   - Breaking news feed          → articles table
 *   - Tone/sentiment analytics    → tone_analytics table
 *   - Volume anomaly detection    → tone_analytics.article_count vs baseline
 *   - Narrative tracking          → source_countries JSONB per entity
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  GDELT events are NEVER plotted on the map as markers.
 *  GDELT feeds intelligence panels ONLY — breaking news, tone charts,
 *  volume anomaly detection. UCDP is the ONLY map event source.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * RATE LIMIT: GDELT DOC API allows 1 req/5s. We poll every 15 min so this
 * is never an issue in normal operation. Retry logic handles transient 429s.
 */

import axios    from 'axios'
import { onGdeltIngest } from '../cache.js'
import { pipeline } from 'stream/promises'
import { createWriteStream, createReadStream, unlinkSync } from 'fs'
import { createInterface } from 'readline'
import { promisify } from 'util'
import { exec } from 'child_process'
import pool     from '../db.js'

const execAsync = promisify(exec)

const GDELT_DOC  = 'https://api.gdeltproject.org/api/v2/doc/doc'
const TIMEOUT    = 30000   // 30s — API can be slow under load
const MAX_RETRY  = 2
const CSV_INGEST_INTERVAL_MS = 60 * 60 * 1000   // once per hour max

let lastCsvIngestAt = 0   // epoch ms of last successful CSV tone ingest

// ── GDELT Event DB 2.0 CSV column indices ─────────────────────────────────────
// Only the columns we care about for tone analytics (no event data extracted)
const COL = {
  ID:             0,
  DAY:            1,
  GOLDSTEIN:      30,
  AVG_TONE:       34,
  ACTION_COUNTRY: 53,
  SOURCE_COUNTRY: 51,    // ActionGeo_CountryCode (2-letter)
  SOURCE_URL:     60,
}

// GDELT 2-letter ISO → full country name for analytics labelling
const ISO_TO_COUNTRY = {
  'AF':'Afghanistan','DZ':'Algeria','AO':'Angola','AM':'Armenia','AZ':'Azerbaijan',
  'BJ':'Benin','BO':'Bolivia','BA':'Bosnia','BR':'Brazil','BF':'Burkina Faso',
  'BI':'Burundi','KH':'Cambodia','CM':'Cameroon','CF':'CAR','TD':'Chad',
  'CN':'China','CO':'Colombia','CG':'Congo','ZR':'DR Congo','EG':'Egypt',
  'ER':'Eritrea','ET':'Ethiopia','GE':'Georgia','GH':'Ghana','GT':'Guatemala',
  'GN':'Guinea','HT':'Haiti','HN':'Honduras','IN':'India','ID':'Indonesia',
  'IR':'Iran','IQ':'Iraq','IS':'Israel','JO':'Jordan','KZ':'Kazakhstan',
  'KE':'Kenya','KP':'North Korea','KW':'Kuwait','KG':'Kyrgyzstan','LB':'Lebanon',
  'LR':'Liberia','LY':'Libya','ML':'Mali','MR':'Mauritania','MX':'Mexico',
  'MA':'Morocco','MZ':'Mozambique','MM':'Myanmar','NP':'Nepal','NI':'Nigeria',
  'PK':'Pakistan','PH':'Philippines','RW':'Rwanda','SA':'Saudi Arabia',
  'SN':'Senegal','SL':'Sierra Leone','SO':'Somalia','ZA':'South Africa',
  'SS':'South Sudan','LK':'Sri Lanka','SD':'Sudan','SY':'Syria','TJ':'Tajikistan',
  'TH':'Thailand','TG':'Togo','TN':'Tunisia','TR':'Turkey','TM':'Turkmenistan',
  'UG':'Uganda','AE':'UAE','GB':'United Kingdom','US':'United States',
  'UZ':'Uzbekistan','VE':'Venezuela','VN':'Vietnam','YE':'Yemen','ZW':'Zimbabwe',
  'ZM':'Zambia',
  // GDELT-specific codes
  'UK':'Ukraine','UP':'Ukraine','SU':'Sudan','IV':'Ivory Coast','GZ':'Palestine',
  'WI':'West Bank','LE':'Lebanon','MO':'Morocco','VM':'Vietnam','YM':'Yemen',
}

// ── Retry wrapper — handles 429 / transient failures ─────────────────────────
async function gdeltGet(url) {
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      const res = await axios.get(url, { timeout: TIMEOUT })
      // Some GDELT 429s arrive as HTTP 200 with a plain-text body
      if (typeof res.data === 'string' && res.data.includes('limit requests')) {
        if (attempt < MAX_RETRY) {
          const wait = 6000 * (attempt + 1)
          console.warn(`[gdelt] rate limited — retrying in ${wait / 1000}s`)
          await new Promise(r => setTimeout(r, wait))
          continue
        }
        throw new Error('GDELT rate limit exceeded')
      }
      return res
    } catch (err) {
      const is429 = err.response?.status === 429 ||
                    err.message?.includes('429') ||
                    err.message?.includes('rate limit')
      if (is429 && attempt < MAX_RETRY) {
        const wait = 6000 * (attempt + 1)
        console.warn(`[gdelt] rate limited — retrying in ${wait / 1000}s`)
        await new Promise(r => setTimeout(r, wait))
        continue
      }
      throw err
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PART 1: ARTICLES — Breaking news feed
// ─────────────────────────────────────────────────────────────────────────────

export async function ingestArticles({ query = '(conflict OR attack OR protest OR airstrike) sourcelang:english', limit = 75 } = {}) {
  try {
    const url = `${GDELT_DOC}?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=${limit}&format=json`
    const res   = await gdeltGet(url)
    const items = res.data?.articles || []

    if (!items.length) {
      console.warn('[gdelt] DOC API returned 0 articles')
      return 0
    }

    const client = await pool.connect()
    let count = 0
    try {
      await client.query('BEGIN')
      for (const a of items) {
        if (!a.url || !a.title) continue
        if (a.language && a.language !== 'English') continue
        const publishedAt = a.seendate
          ? new Date(a.seendate.replace(/(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3'))
          : null
        await client.query(`
          INSERT INTO articles (gdelt_url, title, source_name, source_country, language, published_at, tone)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (gdelt_url) DO NOTHING
        `, [
          a.url,
          a.title,
          a.domain        || null,
          a.sourcecountry || null,
          a.language      || 'en',
          publishedAt,
          parseFloat(a.tone) || null,
        ])
        count++
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
    return count
  } catch (err) {
    console.warn('[gdelt] article fetch failed:', err.message)
    return 0
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PART 2: TONE ANALYTICS — Country-level sentiment from GDELT Event DB 2.0 CSV
//
//  We download the GDELT Event Database 2.0 update file (same lastupdate.txt
//  feed used previously) but ONLY extract AVG_TONE + GOLDSTEIN + country.
//  We do NOT insert any events into the events table. The CSV is a tone signal
//  source only — this feeds early warning ("Ethiopia: tone dropped -34%").
// ─────────────────────────────────────────────────────────────────────────────

async function getLatestGDELTFileUrl() {
  const res  = await axios.get('http://data.gdeltproject.org/gdeltv2/lastupdate.txt', { timeout: 10000 })
  const line = res.data.split('\n')[0]
  return line.split(' ')[2]?.trim()
}

// Parse CSV for tone data only — returns { country → [tone values] }
async function extractCountryToneFromCSV(url) {
  const filename = url.split('/').pop().replace('.zip', '')
  const tmpDir   = `/tmp/gdelt_tone_${Date.now()}`
  const tmpZip   = `${tmpDir}.zip`

  const countryTones = {}   // { 'Ukraine': [{ tone, goldstein }] }

  try {
    const res = await axios.get(url, { responseType: 'stream', timeout: 30000 })
    await pipeline(res.data, createWriteStream(tmpZip))
    await execAsync(`mkdir -p ${tmpDir} && unzip -o ${tmpZip} -d ${tmpDir}/`)

    const rl = createInterface({
      input: createReadStream(`${tmpDir}/${filename}`),
      crlfDelay: Infinity,
    })

    for await (const line of rl) {
      const cols = line.split('\t')
      if (cols.length < 58) continue

      const dayStr    = cols[COL.DAY] || ''
      if (dayStr.length !== 8) continue

      const isoCode   = cols[COL.ACTION_COUNTRY] || ''
      const country   = ISO_TO_COUNTRY[isoCode]
      if (!country) continue    // skip rows we can't map to a known conflict country

      const tone      = parseFloat(cols[COL.AVG_TONE])
      const goldstein = parseFloat(cols[COL.GOLDSTEIN])
      if (isNaN(tone)) continue

      const date = `${dayStr.substring(0,4)}-${dayStr.substring(4,6)}-${dayStr.substring(6,8)}`

      if (!countryTones[country]) countryTones[country] = {}
      if (!countryTones[country][date]) countryTones[country][date] = []
      countryTones[country][date].push({ tone, goldstein: isNaN(goldstein) ? null : goldstein })
    }
  } finally {
    try { unlinkSync(tmpZip) } catch {}
    try { await execAsync(`rm -rf ${tmpDir}`) } catch {}
  }

  return countryTones
}

// Compute avg, std_dev, count from an array of tone values
function aggregateTones(toneArray) {
  const tones = toneArray.map(t => t.tone).filter(t => t !== null)
  if (!tones.length) return null

  const avg    = tones.reduce((s, t) => s + t, 0) / tones.length
  const stdDev = tones.length > 1
    ? Math.sqrt(tones.reduce((s, t) => s + Math.pow(t - avg, 2), 0) / (tones.length - 1))
    : 0

  return { avg_tone: avg, tone_std_dev: stdDev, article_count: tones.length }
}

// Upsert aggregated tone rows into tone_analytics
async function upsertToneAnalytics(rows) {
  if (!rows.length) return 0
  const client = await pool.connect()
  let upserted = 0
  try {
    await client.query('BEGIN')
    for (const r of rows) {
      await client.query(`
        INSERT INTO tone_analytics
          (entity, entity_type, date, avg_tone, article_count, tone_std_dev, source_countries)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (entity, entity_type, date) DO UPDATE
          SET avg_tone      = (tone_analytics.avg_tone * tone_analytics.article_count
                               + EXCLUDED.avg_tone * EXCLUDED.article_count)
                              / NULLIF(tone_analytics.article_count + EXCLUDED.article_count, 0),
              article_count = tone_analytics.article_count + EXCLUDED.article_count,
              tone_std_dev  = EXCLUDED.tone_std_dev
      `, [r.entity, r.entity_type, r.date, r.avg_tone, r.article_count, r.tone_std_dev, r.source_countries])
      upserted++
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
  return upserted
}

// ── Aggregate tone from GDELT Event DB 2.0 CSV (called by ingestLatestGDELT) ──
export async function ingestToneFromCSV() {
  try {
    console.log('[gdelt-tone] fetching latest GDELT file for tone extraction...')
    const url = await getLatestGDELTFileUrl()
    if (!url) throw new Error('could not get GDELT lastupdate URL')

    const countryTones = await extractCountryToneFromCSV(url)
    const countries    = Object.keys(countryTones)
    if (!countries.length) return 0

    const rows = []
    for (const country of countries) {
      for (const [date, toneArray] of Object.entries(countryTones[country])) {
        const agg = aggregateTones(toneArray)
        if (!agg) continue
        rows.push({
          entity:          country,
          entity_type:     'country',
          date,
          avg_tone:        Math.round(agg.avg_tone * 1000) / 1000,
          article_count:   agg.article_count,
          tone_std_dev:    Math.round(agg.tone_std_dev * 1000) / 1000,
          source_countries: null,
        })
      }
    }

    const upserted = await upsertToneAnalytics(rows)
    console.log(`[gdelt-tone] ${upserted} country/date tone rows upserted (${countries.length} countries)`)
    return upserted
  } catch (err) {
    console.warn('[gdelt-tone] CSV tone ingest failed:', err.message)
    return 0
  }
}

// ── Aggregate tone from articles already in DB (lightweight, always runs) ─────
// This gives us tone per source_country per day from our articles table.
export async function aggregateToneFromArticles() {
  try {
    const result = await pool.query(`
      SELECT
        source_country                              AS entity,
        DATE_TRUNC('day', published_at)::DATE       AS date,
        AVG(tone)                                   AS avg_tone,
        COUNT(*)                                    AS article_count,
        STDDEV(tone)                                AS tone_std_dev
      FROM articles
      WHERE tone IS NOT NULL
        AND published_at IS NOT NULL
        AND source_country IS NOT NULL
        AND published_at >= NOW() - INTERVAL '7 days'
      GROUP BY source_country, DATE_TRUNC('day', published_at)
      HAVING COUNT(*) >= 2
    `)

    if (!result.rows.length) return 0

    const rows = result.rows.map(r => ({
      entity:          r.entity,
      entity_type:     'country',    // source_country = reporting country
      date:            r.date,
      avg_tone:        parseFloat(r.avg_tone),
      article_count:   parseInt(r.article_count),
      tone_std_dev:    parseFloat(r.tone_std_dev) || 0,
      source_countries: null,
    }))

    return await upsertToneAnalytics(rows)
  } catch (err) {
    console.warn('[gdelt-tone] article aggregation failed:', err.message)
    return 0
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PART 3: PUBLIC QUERY HELPERS (used by routes)
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchToneTimeseries(entity, { days = 30 } = {}) {
  try {
    const q   = encodeURIComponent(`${entity} (conflict OR war OR attack)`)
    const url = `${GDELT_DOC}?query=${q}&mode=TimelineSourceCountry&format=json&timespan=${days}d`
    const res = await gdeltGet(url)
    return res.data?.timeline || []
  } catch (err) {
    console.warn(`[gdelt] tone timeseries failed for ${entity}:`, err.message)
    return []
  }
}

export async function fetchSourceBreakdown(entity, { days = 7 } = {}) {
  try {
    const url = `${GDELT_DOC}?query=${encodeURIComponent(entity)}&mode=SourceCountry&format=json&timespan=${days}d`
    const res = await gdeltGet(url)
    return res.data?.sourcecountry || []
  } catch (err) {
    console.warn(`[gdelt] source breakdown failed for ${entity}:`, err.message)
    return []
  }
}

export async function getBreakingNews({ limit = 20 } = {}) {
  const result = await pool.query(`
    SELECT id, title, source_name, source_country, language,
           published_at, tone, gdelt_url AS url
    FROM articles
    WHERE title IS NOT NULL
    ORDER BY published_at DESC NULLS LAST, created_at DESC
    LIMIT $1
  `, [Math.min(limit, 100)])
  return result.rows
}

// ── Tone analytics queries ─────────────────────────────────────────────────
export async function getToneHistory(entity, { days = 30, entityType = 'country' } = {}) {
  const result = await pool.query(`
    SELECT date, avg_tone, article_count, tone_std_dev, source_countries
    FROM tone_analytics
    WHERE entity = $1 AND entity_type = $2
      AND date >= NOW() - ($3 || ' days')::INTERVAL
    ORDER BY date
  `, [entity, entityType, days])
  return result.rows
}

export async function getEarlyWarningSignals({ days = 3, threshold = 0.2 } = {}) {
  // Countries where recent avg_tone has dropped significantly vs 14-day baseline
  const result = await pool.query(`
    WITH baseline AS (
      SELECT entity,
             AVG(avg_tone)  AS base_tone,
             AVG(article_count) AS base_volume
      FROM tone_analytics
      WHERE entity_type = 'country'
        AND date BETWEEN NOW() - INTERVAL '17 days' AND NOW() - INTERVAL '3 days'
      GROUP BY entity
    ),
    recent AS (
      SELECT entity,
             AVG(avg_tone)        AS recent_tone,
             SUM(article_count)   AS recent_volume,
             AVG(article_count)   AS avg_recent_volume
      FROM tone_analytics
      WHERE entity_type = 'country'
        AND date >= NOW() - ($1 || ' days')::INTERVAL
      GROUP BY entity
    )
    SELECT
      r.entity,
      b.base_tone,
      r.recent_tone,
      ROUND(((r.recent_tone - b.base_tone) / NULLIF(ABS(b.base_tone), 0))::NUMERIC, 3) AS tone_change_pct,
      r.recent_volume,
      b.base_volume,
      ROUND((r.avg_recent_volume / NULLIF(b.base_volume, 0))::NUMERIC, 2) AS volume_ratio
    FROM recent r
    JOIN baseline b USING (entity)
    WHERE ABS((r.recent_tone - b.base_tone) / NULLIF(ABS(b.base_tone), 0.001)) >= $2
       OR (r.avg_recent_volume / NULLIF(b.base_volume, 0.001)) >= 3
    ORDER BY ABS((r.recent_tone - b.base_tone) / NULLIF(ABS(b.base_tone), 0.001)) DESC
    LIMIT 10
  `, [days, threshold])
  return result.rows
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN EXPORT — called by gdeltPoller every 15 minutes
// ─────────────────────────────────────────────────────────────────────────────

export async function ingestLatestGDELT() {
  // Run article ingestion and lightweight DB-level tone aggregation in parallel
  const [articles, toneRows] = await Promise.all([
    ingestArticles(),
    aggregateToneFromArticles(),
  ])

  // Tone from CSV: runs in background, throttled to once per hour
  // (large file download — no need to re-parse every 15-min cycle)
  const now = Date.now()
  if (now - lastCsvIngestAt >= CSV_INGEST_INTERVAL_MS) {
    lastCsvIngestAt = now
    ingestToneFromCSV().catch(err =>
      console.warn('[gdelt-tone] CSV background ingest failed:', err.message)
    )
  }

  // Flush stale article/tone caches (rule 12)
  onGdeltIngest().catch(err =>
    console.warn('[gdelt] cache invalidation failed:', err.message)
  )

  console.log(`[gdelt] ingest complete: ${articles} articles, ${toneRows} tone rows`)
  return { articles, toneRows }
}
