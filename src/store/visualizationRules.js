/**
 * Visualization rules for ThreatWatch map layers.
 *
 * Single source of truth for:
 * - Event type → color / radius / opacity
 * - Data source display metadata
 * - Geo precision display cutoffs
 */

// ── Event type color palette ──────────────────────────────────────────────────
export const EVENT_TYPE_COLORS = {
  battle:                    '#ff2a2a',   // red
  explosion:                 '#f97316',   // orange
  'violence against civilians': '#fbbf24', // yellow
  protest:                   '#38bdf8',   // sky blue
  riot:                      '#a855f7',   // purple
  'strategic development':   '#6b7280',   // gray
}

// Fallback color for unknown types
export const DEFAULT_COLOR = '#ffffff'

// ── Per-type circle radius (Mapbox expression values) ────────────────────────
export const EVENT_TYPE_RADIUS = {
  battle:                    7,
  explosion:                 6,
  'violence against civilians': 5,
  protest:                   4,
  riot:                      4,
  'strategic development':   4,
}

export const DEFAULT_RADIUS = 5

// ── Per-type opacity ──────────────────────────────────────────────────────────
export const EVENT_TYPE_OPACITY = {
  battle:                    0.85,
  explosion:                 0.8,
  'violence against civilians': 0.75,
  protest:                   0.65,
  riot:                      0.65,
  'strategic development':   0.5,
}

export const DEFAULT_OPACITY = 0.7

// ── Data source display metadata ──────────────────────────────────────────────
export const DATA_SOURCE_MAP = {
  UCDP: {
    label:       'UCDP GED',
    description: 'Uppsala Conflict Data Program — Georeferenced Event Dataset',
    color:       '#ff2a2a',
    badge:       'UCDP',
  },
  FIRMS: {
    label:       'NASA FIRMS',
    description: 'Fire Information for Resource Management System — VIIRS SNPP',
    color:       '#f97316',
    badge:       'FIRMS',
  },
  GDELT: {
    label:       'GDELT',
    description: 'Global Database of Events, Language and Tone — Articles only',
    color:       '#38bdf8',
    badge:       'GDELT',
  },
}

// ── Geo precision display rules ───────────────────────────────────────────────
// UCDP geo precision: 1 = exact location, 2 = nearby, 3 = centroid
// Only show strike arcs for precision 1-2 (exact/nearby)
export const STRIKE_ARC_MAX_PRECISION = 2

// ── Helper: get full visualization config for an event ───────────────────────
export function getEventVisualization(event) {
  const type    = (event.type || '').toLowerCase()
  const color   = EVENT_TYPE_COLORS[type]   || DEFAULT_COLOR
  const radius  = EVENT_TYPE_RADIUS[type]   || DEFAULT_RADIUS
  const opacity = EVENT_TYPE_OPACITY[type]  || DEFAULT_OPACITY

  return { color, radius, opacity }
}

// ── Mapbox paint expression: circle-color by event type ──────────────────────
// Used as the paint property value in addLayer calls.
export const CIRCLE_COLOR_EXPRESSION = [
  'match',
  ['get', 'type'],
  'battle',                    EVENT_TYPE_COLORS.battle,
  'explosion',                 EVENT_TYPE_COLORS.explosion,
  'violence against civilians', EVENT_TYPE_COLORS['violence against civilians'],
  'protest',                   EVENT_TYPE_COLORS.protest,
  'riot',                      EVENT_TYPE_COLORS.riot,
  'strategic development',     EVENT_TYPE_COLORS['strategic development'],
  DEFAULT_COLOR,
]

// ── Mapbox paint expression: circle-radius by event type ─────────────────────
export const CIRCLE_RADIUS_EXPRESSION = [
  'match',
  ['get', 'type'],
  'battle',     EVENT_TYPE_RADIUS.battle,
  'explosion',  EVENT_TYPE_RADIUS.explosion,
  DEFAULT_RADIUS,
]
