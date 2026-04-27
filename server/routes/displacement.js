/**
 * Displacement routes — UNHCR refugee/IDP data
 *
 * GET /api/displacement/global     — global totals
 * GET /api/displacement/country/:name  — per-country stats
 * GET /api/displacement/flows      — bilateral flows for arc rendering
 *
 * All cached 6 hours (UNHCR data updates weekly).
 */
import express from 'express'
import pool    from '../db.js'
import { cacheMiddleware } from '../cache.js'

const router = express.Router()

// ── GET /api/displacement/global ──────────────────────────────────────────────
// Returns total global refugee, IDP, and asylum-seeker figures
router.get('/global',
  cacheMiddleware('displacement:global', 21600),
  async (req, res) => {
  try {
    const year = parseInt(req.query.year) || 2024

    // Pull from the __GLOBAL__ aggregate row first (fast path)
    const globalRow = await pool.query(`
      SELECT refugees, asylum_seekers, idps, stateless
      FROM displacement
      WHERE year = $1 AND country_origin = '__GLOBAL__'
      LIMIT 1
    `, [year])

    let total_refugees, total_idps, total_asylum_seekers, total_stateless

    if (globalRow.rows.length) {
      const g = globalRow.rows[0]
      total_refugees       = parseInt(g.refugees)       || 0
      total_idps           = parseInt(g.idps)           || 0
      total_asylum_seekers = parseInt(g.asylum_seekers) || 0
      total_stateless      = parseInt(g.stateless)      || 0
    } else {
      // Fallback: sum bilateral rows
      const { rows: [agg] } = await pool.query(`
        SELECT
          COALESCE(SUM(refugees),       0) AS refugees,
          COALESCE(SUM(asylum_seekers), 0) AS asylum_seekers,
          COALESCE(SUM(idps),           0) AS idps,
          COALESCE(SUM(stateless),      0) AS stateless
        FROM displacement
        WHERE year = $1
          AND country_origin != '__GLOBAL__'
          AND country_asylum != '__TOTAL__'
      `, [year])
      total_refugees       = parseInt(agg.refugees)       || 0
      total_idps           = parseInt(agg.idps)           || 0
      total_asylum_seekers = parseInt(agg.asylum_seekers) || 0
      total_stateless      = parseInt(agg.stateless)      || 0
    }

    // Top origin countries by refugee total
    const { rows: top_origins } = await pool.query(`
      SELECT country_origin AS country, iso_origin AS iso, refugees
      FROM displacement
      WHERE year = $1
        AND country_asylum = '__TOTAL__'
        AND country_origin NOT IN ('__GLOBAL__', '__TOTAL__')
        AND refugees > 0
      ORDER BY refugees DESC
      LIMIT 10
    `, [year])

    // Top hosting countries by refugees received
    const { rows: top_hosts } = await pool.query(`
      SELECT country_asylum AS country, iso_asylum AS iso, SUM(refugees) AS refugees
      FROM displacement
      WHERE year = $1
        AND country_origin NOT IN ('__GLOBAL__', '__TOTAL__')
        AND country_asylum NOT IN ('__GLOBAL__', '__TOTAL__')
        AND refugees > 0
      GROUP BY country_asylum, iso_asylum
      ORDER BY refugees DESC
      LIMIT 10
    `, [year])

    res.json({
      year,
      total_refugees:       total_refugees,
      total_idps:           total_idps,
      total_asylum_seekers: total_asylum_seekers,
      total_stateless:      total_stateless,
      total_forcibly_displaced: total_refugees + total_idps + total_asylum_seekers,
      top_origins: top_origins.map(r => ({
        country:  r.country,
        iso:      r.iso,
        refugees: parseInt(r.refugees),
      })),
      top_hosts: top_hosts.map(r => ({
        country:  r.country,
        iso:      r.iso,
        refugees: parseInt(r.refugees),
      })),
    })
  } catch (err) {
    console.error('[displacement/global] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/displacement/country/:name ───────────────────────────────────────
// Returns stats for a specific country (as origin and as asylum)
router.get('/country/:name',
  cacheMiddleware(req => `displacement:country:${req.params.name.toLowerCase()}`, 21600),
  async (req, res) => {
  try {
    const rawName = decodeURIComponent(req.params.name)
    const year    = parseInt(req.query.year) || 2024

    // Resolve common name aliases (Turkey→Türkiye, etc.)
    const NAME_ALIASES = {
      'turkey':       'Türkiye',
      'türkiye':      'Türkiye',
      'russia':       'Russian Federation',
      'iran':         'Iran (Islamic Rep. of)',
      'south korea':  'Rep. of Korea',
      'north korea':  "Dem. People's Rep. of Korea",
      'usa':          'United States of America',
      'united states':'United States of America',
      'uk':           'United Kingdom of Great Britain and Northern Ireland',
      'great britain':'United Kingdom of Great Britain and Northern Ireland',
      'drc':          'Dem. Rep. of the Congo',
      'dr congo':     'Dem. Rep. of the Congo',
      'dr congo (zaire)': 'Dem. Rep. of the Congo',
      'venezuela':    'Venezuela (Bolivarian Republic of)',
      'syria':        'Syrian Arab Rep.',
      'myanmar (burma)': 'Myanmar',
      'myanmar':      'Myanmar',
      'central african republic': 'Central African Rep.',
    }
    const country = NAME_ALIASES[rawName.toLowerCase()] || rawName

    // What this country sends (originated refugees)
    const { rows: [asOrigin] } = await pool.query(`
      SELECT
        COALESCE(SUM(refugees),       0) AS refugees_originated,
        COALESCE(SUM(asylum_seekers), 0) AS asylum_seekers_from,
        COALESCE(SUM(idps),           0) AS idps_internal
      FROM displacement
      WHERE year = $1
        AND (country_origin ILIKE $2 OR country_origin ILIKE $3)
        AND country_asylum NOT IN ('__TOTAL__', '__GLOBAL__')
    `, [year, country, rawName])

    // What this country hosts
    const { rows: [asHost] } = await pool.query(`
      SELECT
        COALESCE(SUM(refugees),       0) AS refugees_hosted,
        COALESCE(SUM(asylum_seekers), 0) AS asylum_seekers_hosted
      FROM displacement
      WHERE year = $1
        AND (country_asylum ILIKE $2 OR country_asylum ILIKE $3)
        AND country_origin NOT IN ('__GLOBAL__', '__TOTAL__')
    `, [year, country, rawName])

    // Top destinations for people fleeing this country
    const { rows: top_asylum } = await pool.query(`
      SELECT country_asylum AS country, iso_asylum AS iso, refugees
      FROM displacement
      WHERE year = $1
        AND (country_origin ILIKE $2 OR country_origin ILIKE $3)
        AND country_asylum NOT IN ('__TOTAL__', '__GLOBAL__')
        AND refugees > 0
      ORDER BY refugees DESC
      LIMIT 10
    `, [year, country, rawName])

    // Top origins of people hosted in this country
    const { rows: top_origins } = await pool.query(`
      SELECT country_origin AS country, iso_origin AS iso, refugees
      FROM displacement
      WHERE year = $1
        AND (country_asylum ILIKE $2 OR country_asylum ILIKE $3)
        AND country_origin NOT IN ('__GLOBAL__', '__TOTAL__')
        AND refugees > 0
      ORDER BY refugees DESC
      LIMIT 10
    `, [year, country, rawName])

    // IDP total (from __TOTAL__ row)
    const { rows: [idpRow] } = await pool.query(`
      SELECT idps
      FROM displacement
      WHERE year = $1
        AND (country_origin ILIKE $2 OR country_origin ILIKE $3)
        AND country_asylum = '__TOTAL__'
    `, [year, country, rawName])

    res.json({
      country,
      year,
      refugees_originated: parseInt(asOrigin?.refugees_originated)  || 0,
      asylum_seekers_from: parseInt(asOrigin?.asylum_seekers_from)   || 0,
      idps:                parseInt(idpRow?.idps)                    || parseInt(asOrigin?.idps_internal) || 0,
      refugees_hosted:     parseInt(asHost?.refugees_hosted)         || 0,
      asylum_seekers_hosted: parseInt(asHost?.asylum_seekers_hosted) || 0,
      top_asylum_countries: top_asylum.map(r => ({
        country:  r.country,
        iso:      r.iso,
        refugees: parseInt(r.refugees),
      })),
      top_origin_countries: top_origins.map(r => ({
        country:  r.country,
        iso:      r.iso,
        refugees: parseInt(r.refugees),
      })),
    })
  } catch (err) {
    console.error('[displacement/country] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/displacement/flows ───────────────────────────────────────────────
// Returns bilateral flows for refugee arc rendering on map.
// Requires origin country centroids (hardcoded — geo_boundaries not yet loaded).
router.get('/flows',
  cacheMiddleware(
    req => `displacement:flows:${req.query.origin || 'top'}:${req.query.year || '2024'}`,
    21600
  ),
  async (req, res) => {
  try {
    const year   = parseInt(req.query.year) || 2024
    const limit  = Math.min(parseInt(req.query.limit) || 50, 200)
    const origin = req.query.origin  // optional filter by origin country name

    let rows
    if (origin) {
      const { rows: r } = await pool.query(`
        SELECT
          country_origin, country_asylum,
          iso_origin, iso_asylum,
          refugees, asylum_seekers, year
        FROM displacement
        WHERE year = $1
          AND country_origin ILIKE $2
          AND country_asylum NOT IN ('__TOTAL__', '__GLOBAL__')
          AND refugees > 0
        ORDER BY refugees DESC
        LIMIT $3
      `, [year, origin, limit])
      rows = r
    } else {
      // Top flows globally
      const { rows: r } = await pool.query(`
        SELECT
          country_origin, country_asylum,
          iso_origin, iso_asylum,
          refugees, asylum_seekers, year
        FROM displacement
        WHERE year = $1
          AND country_origin NOT IN ('__GLOBAL__', '__TOTAL__')
          AND country_asylum NOT IN ('__GLOBAL__', '__TOTAL__')
          AND refugees > 100
        ORDER BY refugees DESC
        LIMIT $2
      `, [year, limit])
      rows = r
    }

    // Enrich with centroids from the hardcoded lookup
    const enriched = rows.map(r => {
      const origCent = CENTROIDS[r.iso_origin]  || CENTROIDS_BY_NAME[r.country_origin]
      const asylCent = CENTROIDS[r.iso_asylum]  || CENTROIDS_BY_NAME[r.country_asylum]
      if (!origCent || !asylCent) return null
      return {
        country_origin:  r.country_origin,
        country_asylum:  r.country_asylum,
        iso_origin:      r.iso_origin,
        iso_asylum:      r.iso_asylum,
        refugees:        parseInt(r.refugees),
        asylum_seekers:  parseInt(r.asylum_seekers),
        year:            r.year,
        origin_lng:      origCent[0],
        origin_lat:      origCent[1],
        asylum_lng:      asylCent[0],
        asylum_lat:      asylCent[1],
      }
    }).filter(Boolean)

    res.json(enriched)
  } catch (err) {
    console.error('[displacement/flows] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Country centroids (ISO3 → [lng, lat]) ────────────────────────────────────
// Major countries needed for refugee flow arc rendering
const CENTROIDS = {
  // Origin countries
  SYR: [38.9968,  35.0],     // Syria
  UKR: [31.1656,  48.3],     // Ukraine
  AFG: [67.7100,  33.9],     // Afghanistan
  VEN: [-66.5897, 8.00],     // Venezuela
  SSD: [31.3070,   7.86],    // South Sudan
  MMR: [95.9560,  21.9],     // Myanmar
  COD: [23.6565,  -2.87],    // DRC
  SDN: [30.2176,  12.86],    // Sudan
  SOM: [46.1996,   5.15],    // Somalia
  ETH: [40.4897,   9.14],    // Ethiopia
  NGA: [8.6753,   9.08],     // Nigeria
  ERI: [39.7823,  15.18],    // Eritrea
  IRQ: [43.6793,  33.22],    // Iraq
  CAF: [20.9394,   6.61],    // Central African Republic
  MLI: [-2.0000,  17.57],    // Mali
  YEM: [48.5164,  15.55],    // Yemen
  PAK: [69.3451,  30.38],    // Pakistan
  COL: [-74.2973,  4.57],    // Colombia
  HTI: [-72.2852,  18.97],   // Haiti
  BDI: [29.9189,  -3.37],    // Burundi
  // Asylum countries
  TUR: [35.2433,  38.96],    // Turkey
  DEU: [10.4515,  51.16],    // Germany
  UGA: [32.2903,   1.37],    // Uganda
  IRN: [53.6880,  32.42],    // Iran
  RUS: [105.3188, 61.52],    // Russia
  POL: [19.1451,  51.92],    // Poland
  USA: [-95.7129, 37.09],    // United States
  KEN: [37.9062,  -0.02],    // Kenya
  LBN: [35.8623,  33.85],    // Lebanon
  CHN: [104.195,  35.86],    // China
  BRA: [-51.9253, -14.2],    // Brazil
  JOR: [36.2384,  30.59],    // Jordan
  FRA: [2.2137,   46.23],    // France
  GBR: [-3.4360,  55.38],    // UK
  SWE: [18.6435,  60.13],    // Sweden
  CAN: [-96.8165, 56.13],    // Canada
  EGY: [30.8025,  26.82],    // Egypt
  BGD: [90.3563,  23.68],    // Bangladesh
  TCD: [18.7322,  15.45],    // Chad
  KAZ: [66.9237,  48.02],    // Kazakhstan
  ECU: [-78.1834,  -1.83],   // Ecuador
  MYS: [109.698,   4.21],    // Malaysia
  IND: [78.9629,  20.59],    // India
  THA: [100.993,  15.87],    // Thailand
  DNK: [9.5018,   56.26],    // Denmark
  AUT: [14.5501,  47.52],    // Austria
  NGA: [8.6753,    9.08],    // Nigeria (also asylum)
}

// Fallback lookup by country name
const CENTROIDS_BY_NAME = {
  'Syrian Arab Rep.':          CENTROIDS.SYR,
  'Ukraine':                   CENTROIDS.UKR,
  'Afghanistan':               CENTROIDS.AFG,
  'Venezuela (Bolivarian Republic of)': CENTROIDS.VEN,
  'South Sudan':               CENTROIDS.SSD,
  'Myanmar':                   CENTROIDS.MMR,
  'Dem. Rep. of the Congo':    CENTROIDS.COD,
  'Sudan':                     CENTROIDS.SDN,
  'Somalia':                   CENTROIDS.SOM,
  'Ethiopia':                  CENTROIDS.ETH,
  'Nigeria':                   CENTROIDS.NGA,
  'Eritrea':                   CENTROIDS.ERI,
  'Iraq':                      CENTROIDS.IRQ,
  'Central African Rep.':      CENTROIDS.CAF,
  'Mali':                      CENTROIDS.MLI,
  'Yemen':                     CENTROIDS.YEM,
  'Türkiye':                   CENTROIDS.TUR,
  'Turkey':                    CENTROIDS.TUR,
  'Germany':                   CENTROIDS.DEU,
  'Uganda':                    CENTROIDS.UGA,
  'Iran (Islamic Rep. of)':    CENTROIDS.IRN,
  'Russian Federation':        CENTROIDS.RUS,
  'Poland':                    CENTROIDS.POL,
  'United States of America':  CENTROIDS.USA,
  'Kenya':                     CENTROIDS.KEN,
  'Lebanon':                   CENTROIDS.LBN,
  'Jordan':                    CENTROIDS.JOR,
  'France':                    CENTROIDS.FRA,
  'United Kingdom of Great Britain and Northern Ireland': CENTROIDS.GBR,
  'Sweden':                    CENTROIDS.SWE,
  'Canada':                    CENTROIDS.CAN,
  'Egypt':                     CENTROIDS.EGY,
  'Bangladesh':                CENTROIDS.BGD,
  'Chad':                      CENTROIDS.TCD,
  'Colombia':                  CENTROIDS.COL,
  'Brazil':                    CENTROIDS.BRA,
  'Pakistan':                  CENTROIDS.PAK,
  'Ecuador':                   CENTROIDS.ECU,
  'Malaysia':                  CENTROIDS.MYS,
  'India':                     CENTROIDS.IND,
  'Thailand':                  CENTROIDS.THA,
  'Denmark':                   CENTROIDS.DNK,
  'Austria':                   CENTROIDS.AUT,
}

export default router
