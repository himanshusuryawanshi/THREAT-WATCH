/**
 * useTimeframe — reads the global date range from the store and returns
 * ready-to-use URL param strings for API calls.
 *
 * Usage:
 *   const { tfQuery, tfLabel, timeframe } = useTimeframe()
 *   fetch(`/api/events/stats?${tfQuery}`)
 *
 * tfQuery — appended to any fetch URL, e.g. "timeframe=30d" or "from=2024-01-01&to=2024-12-31"
 * tfLabel — human-readable label, e.g. "Last 30 days" or "Jan 1 – Dec 31, 2024"
 * deps    — array of store values to put in useEffect dep arrays: [timeframe, customFrom, customTo]
 */
import useStore from '../store/useStore'

const LABELS = {
  '7d':  'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '1y':  'Last year',
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function useTimeframe() {
  const timeframe  = useStore(s => s.timeframe)
  const customFrom = useStore(s => s.customFrom)
  const customTo   = useStore(s => s.customTo)

  let tfQuery, tfLabel

  if (timeframe === 'custom' && customFrom && customTo) {
    tfQuery = `from=${customFrom}&to=${customTo}`
    tfLabel = `${fmtDate(customFrom)} – ${fmtDate(customTo)}`
  } else {
    tfQuery = `timeframe=${timeframe || '30d'}`
    tfLabel = LABELS[timeframe] || 'Last 30 days'
  }

  return { tfQuery, tfLabel, timeframe, customFrom, customTo }
}
