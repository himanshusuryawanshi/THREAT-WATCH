export const EVENT_TYPES = {
  battle:                     { color: '#ff2a2a', label: 'Battles' },
  explosion:                  { color: '#f97316', label: 'Explosions' },
  violence_against_civilians: { color: '#fbbf24', label: 'Civilian Violence' },
  protest:                    { color: '#38bdf8', label: 'Protests' },
  riot:                       { color: '#a855f7', label: 'Riots' },
  strategic_development:      { color: '#22c55e', label: 'Strategic Dev' },
}

export const getEventColor = (type) =>
  EVENT_TYPES[type]?.color ?? '#6b7280'

export const getMarkerRadius = (fatalities) =>
  Math.max(6, Math.min(28, 6 + (parseInt(fatalities) || 0) * 1.1))

// Fallback headlines shown while GDELT DOC API articles load
export const NEWS_HEADLINES = [
  'Global conflict monitoring active — GDELT data streaming live',
  'Loading latest conflict events from GDELT Event Database 2.0...',
]