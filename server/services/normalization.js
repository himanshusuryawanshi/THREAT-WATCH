export const EVENT_TYPES = {
  BATTLE:                     'battle',
  EXPLOSION:                  'explosion',
  VIOLENCE_AGAINST_CIVILIANS: 'violence_against_civilians',
  PROTEST:                    'protest',
  RIOT:                       'riot',
  STRATEGIC_DEVELOPMENT:      'strategic_development',
}

// GDELT CAMEO root codes → ThreatWatch types
export const CAMEO_TO_TYPE = {
  '18': EVENT_TYPES.VIOLENCE_AGAINST_CIVILIANS,  // ASSAULT
  '19': EVENT_TYPES.BATTLE,                       // FIGHT
  '20': EVENT_TYPES.BATTLE,                       // MASS VIOLENCE
  '14': EVENT_TYPES.PROTEST,                      // PROTEST
  '145': EVENT_TYPES.RIOT,                        // PROTEST WITH INTERVENTION
  '17': EVENT_TYPES.STRATEGIC_DEVELOPMENT,        // COERCE
  '15': EVENT_TYPES.STRATEGIC_DEVELOPMENT,        // EXHIBIT FORCE
  '13': EVENT_TYPES.STRATEGIC_DEVELOPMENT,        // THREATEN
}

// UCDP type_of_violence → ThreatWatch types
export const UCDP_TYPE_MAP = {
  1: EVENT_TYPES.BATTLE,                        // State-based conflict
  2: EVENT_TYPES.BATTLE,                        // Non-state conflict
  3: EVENT_TYPES.VIOLENCE_AGAINST_CIVILIANS,    // One-sided violence
}

/**
 * Normalize a raw GDELT event row (named fields from CSV headers).
 * @param {object} raw - object with GDELT column names as keys
 * @returns {object} normalized event matching the events table schema
 */
export function normalizeGdeltEvent(raw) {
  const cameoRoot = String(raw.EventRootCode || raw.EventCode || '').substring(0, 2)
  return {
    id:            `GDELT_${raw.GLOBALEVENTID}`,
    source:        'GDELT',
    source_id:     String(raw.GLOBALEVENTID),
    date: raw.SQLDATE
      ? `${raw.SQLDATE.substring(0,4)}-${raw.SQLDATE.substring(4,6)}-${raw.SQLDATE.substring(6,8)}`
      : null,
    type:          CAMEO_TO_TYPE[cameoRoot] || EVENT_TYPES.STRATEGIC_DEVELOPMENT,
    subtype:       raw.EventCode || null,
    country:       raw.ActionGeo_CountryCode || raw.Actor1CountryCode || 'Unknown',
    admin1:        raw.ActionGeo_ADM1Code || null,
    location:      raw.ActionGeo_FullName || null,
    lat:           parseFloat(raw.ActionGeo_Lat)  || null,
    lng:           parseFloat(raw.ActionGeo_Long) || null,
    origin_lat:    null,   // GDELT has no origin concept
    origin_lng:    null,
    geo_precision: 3,      // always 3 for GDELT (centroid/admin center)
    actor1:        raw.Actor1Name || null,
    actor2:        raw.Actor2Name || null,
    fatalities:    0,      // GDELT doesn't track fatalities
    notes:         raw.SOURCEURL || null,
    url:           raw.SOURCEURL || null,
    tone:          parseFloat(raw.AvgTone)        || null,
    goldstein:     parseFloat(raw.GoldsteinScale) || null,
  }
}

/**
 * Normalize a raw UCDP GED event JSON object.
 * @param {object} raw - UCDP API response event object
 * @returns {object} normalized event matching the events table schema
 */
export function normalizeUcdpEvent(raw) {
  return {
    id:             `UCDP_${raw.id}`,
    source:         'UCDP',
    source_id:      String(raw.id),
    date:           raw.date_start || `${raw.year}-01-01`,
    type:           UCDP_TYPE_MAP[raw.type_of_violence] || EVENT_TYPES.BATTLE,
    subtype:        raw.dyad_name || null,
    country:        raw.country || 'Unknown',
    admin1:         raw.adm_1 || null,
    location:       raw.where_description || null,
    lat:            parseFloat(raw.latitude)  || null,
    lng:            parseFloat(raw.longitude) || null,
    origin_lat:     null,
    origin_lng:     null,
    geo_precision:  mapUcdpPrecision(raw.where_prec),
    actor1:         raw.side_a || null,
    actor2:         raw.side_b || null,
    fatalities:     parseInt(raw.best)  || 0,
    fatalities_low: parseInt(raw.low)   || null,
    fatalities_high:parseInt(raw.high)  || null,
    notes:          raw.source_article || null,
    url:            null,
    tone:           null,
    goldstein:      null,
  }
}

/**
 * Map UCDP where_prec value to our geo_precision scale.
 * UCDP: 1=exact, 2=nearby, 3=ADM2, 4=ADM1, 5=country, 6=imprecise
 */
export function mapUcdpPrecision(ucdpPrec) {
  if (ucdpPrec <= 2) return 1  // precise enough for strike arcs
  if (ucdpPrec <= 4) return 2  // admin-level
  return 4                      // country centroid level
}
