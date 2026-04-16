/**
 * Visualization rules for ThreatWatch map layers.
 *
 * Single source of truth for:
 * - Event type → color / radius / opacity
 * - Data source display metadata
 * - Map plottability rules (BLUEPRINT Part 6 Rule 1)
 * - Geo precision display cutoffs
 */

// ── Event type color palette ──────────────────────────────────────────────────
// Keys match normalized UCDP type strings from normalization.js
export const EVENT_TYPE_COLORS = {
  battle:                    '#ef4444',   // red-500
  explosion:                 '#f97316',   // orange-500
  violence_against_civilians:'#dc2626',   // red-600
  protest:                   '#3b82f6',   // blue-500
  riot:                      '#8b5cf6',   // violet-500
  strategic_development:     '#6b7280',   // gray-500
}

// Fallback color for unknown / unmapped types
export const DEFAULT_COLOR = '#ffffff'

// ── Per-type circle radius (Mapbox expression values) ────────────────────────
export const EVENT_TYPE_RADIUS = {
  battle:                    7,
  explosion:                 6,
  violence_against_civilians:5,
  protest:                   4,
  riot:                      4,
  strategic_development:     4,
}

export const DEFAULT_RADIUS = 5

// ── Per-type opacity ──────────────────────────────────────────────────────────
export const EVENT_TYPE_OPACITY = {
  battle:                    0.85,
  explosion:                 0.8,
  violence_against_civilians:0.75,
  protest:                   0.65,
  riot:                      0.65,
  strategic_development:     0.5,
}

export const DEFAULT_OPACITY = 0.7

// ── Map plottability guard ────────────────────────────────────────────────────
// BLUEPRINT Rule 1: ONLY UCDP data is plotted as individual map dots/arcs.
// GDELT is intelligence-layer only (breaking news, tone analysis, sidebar).
// Both UCDP GED (verified) and UCDP_CANDIDATE (monthly releases) are plottable.
export function isMapPlottable(event) {
  const src = (event?.source || '').toUpperCase()
  return src === 'UCDP' || src === 'UCDP_CANDIDATE'
}

// ── Data source display metadata ──────────────────────────────────────────────
// Documents which feed populates which feature — enforces BLUEPRINT data routing
export const DATA_SOURCE_MAP = {
  UCDP: {
    label:       'UCDP GED',
    description: 'Uppsala Conflict Data Program — Georeferenced Event Dataset (verified, annual)',
    mapRole:     'Conflict event dots + strike arcs',
    color:       '#ef4444',
    badge:       'UCDP',
  },
  UCDP_CANDIDATE: {
    label:       'UCDP Candidate',
    description: 'Uppsala Conflict Data Program — Monthly candidate releases (2025–present)',
    mapRole:     'Conflict event dots + strike arcs (same rendering as UCDP)',
    color:       '#f87171',   // slightly lighter red to distinguish if needed
    badge:       'CANDIDATE',
  },
  FIRMS: {
    label:       'NASA FIRMS',
    description: 'Fire Information for Resource Management System — VIIRS SNPP NRT',
    mapRole:     'Thermal anomaly layer — orange pulsing dots, independent satellite verification',
    color:       '#ff8c00',
    badge:       'FIRMS',
  },
  GDELT: {
    label:       'GDELT',
    description: 'Global Database of Events, Language and Tone — intelligence engine only',
    mapRole:     'NO MAP ROLE — breaking news sidebar, tone analytics, early warning signals only',
    color:       '#3b82f6',
    badge:       'GDELT',
  },
}

// ── Geo precision display rules ───────────────────────────────────────────────
// UCDP geo precision: 1 = exact location, 2 = nearby, 3 = centroid
// Strike arcs only for precision ≤ 2 (exact / nearby locations)
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
// Used as the `paint['circle-color']` value in map.addLayer() calls.
export const CIRCLE_COLOR_EXPRESSION = [
  'match',
  ['get', 'type'],
  'battle',                     EVENT_TYPE_COLORS.battle,
  'explosion',                  EVENT_TYPE_COLORS.explosion,
  'violence_against_civilians', EVENT_TYPE_COLORS.violence_against_civilians,
  'protest',                    EVENT_TYPE_COLORS.protest,
  'riot',                       EVENT_TYPE_COLORS.riot,
  'strategic_development',      EVENT_TYPE_COLORS.strategic_development,
  DEFAULT_COLOR,  // fallback
]

// ── Mapbox paint expression: circle-radius interpolated by fatalities ─────────
// Blueprint spec: 0→3px, 1→5px, 50→12px, 500→20px
export const CIRCLE_RADIUS_BY_FATALITIES = [
  'interpolate', ['linear'], ['get', 'fatalities'],
  0,   3,
  1,   5,
  50,  12,
  500, 20,
]
