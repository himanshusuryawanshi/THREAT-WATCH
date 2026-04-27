/**
 * EscalationBadge — Conflict threat level summary.
 *
 * Fetches /api/conflicts, bins by escalation_score.
 * Falls back to event_count bucketing if no scores present.
 * CRITICAL badge pulses red. This is the first thing users see.
 */
import { useEffect, useState } from 'react'
import useTimeframe from '../../hooks/useTimeframe'

const API_BASE = 'http://localhost:3001'

const LEVELS = [
  { key: 'critical', label: 'CRITICAL', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',  pulse: true  },
  { key: 'elevated', label: 'ELEVATED', color: '#f97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.25)', pulse: false },
  { key: 'watch',    label: 'WATCH',    color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)',  pulse: false },
]

export default function EscalationBadge() {
  const [levels,  setLevels]  = useState({ critical: 0, elevated: 0, watch: 0, stable: 0 })
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const { tfQuery }           = useTimeframe()

  useEffect(() => {
    fetch(`${API_BASE}/api/conflicts?limit=200&${tfQuery}`)
      .then(r => r.json())
      .then(({ conflicts = [], total: t = 0 }) => {
        const hasScores = conflicts.some(c => c.escalation_score != null && c.escalation_score > 0)
        let critical = 0, elevated = 0, watch = 0, stable = 0

        conflicts.forEach(c => {
          if (hasScores) {
            const s = parseFloat(c.escalation_score) || 0
            if      (s > 0.7) critical++
            else if (s > 0.3) elevated++
            else if (s > 0.1) watch++
            else              stable++
          } else {
            // Fallback: bucket by event_count
            const n = parseInt(c.event_count) || 0
            if      (n > 100) critical++
            else if (n > 50)  elevated++
            else if (n > 20)  watch++
            else              stable++
          }
        })

        setLevels({ critical, elevated, watch, stable })
        setTotal(t || conflicts.length)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [tfQuery])

  return (
    <div style={{ padding: '14px 16px' }}>
      {/* Section header */}
      <div style={{
        fontFamily:    "'JetBrains Mono', monospace",
        fontSize:       9,
        letterSpacing: '2px',
        color:         '#4b5563',
        textTransform: 'uppercase',
        marginBottom:  10,
      }}>
        Conflict Threat Status
      </div>

      {loading ? (
        <div style={{ color: '#4b5563', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
          Loading...
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {LEVELS.map(({ key, label, color, bg, border, pulse }) => (
              <Badge
                key={key}
                label={label}
                count={levels[key]}
                color={color}
                bg={bg}
                border={border}
                pulse={pulse && levels[key] > 0}
              />
            ))}
          </div>

          {/* Conflict count footer */}
          <div style={{
            marginTop:     10,
            fontSize:       9,
            color:         '#4b5563',
            fontFamily:    "'JetBrains Mono', monospace",
            letterSpacing: '1px',
          }}>
            {total} active conflicts tracked
          </div>
        </>
      )}

      <style>{`
        @keyframes badge-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          70%  { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
      `}</style>
    </div>
  )
}

function Badge({ label, count, color, bg, border, pulse }) {
  return (
    <div style={{
      display:         'flex',
      alignItems:      'center',
      gap:             6,
      padding:         '5px 9px',
      background:      bg,
      border:          `0.5px solid ${border}`,
      borderRadius:    5,
      animation:       pulse ? 'badge-pulse 1.8s ease-out infinite' : 'none',
    }}>
      <span style={{
        width:        6,
        height:       6,
        borderRadius: '50%',
        background:   color,
        flexShrink:   0,
        boxShadow:    pulse ? `0 0 6px ${color}` : 'none',
      }} />
      <span style={{
        fontFamily:    "'JetBrains Mono', monospace",
        fontSize:       8,
        letterSpacing: '1.5px',
        color,
        fontWeight:    700,
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize:    11,
        color,
        fontWeight:  700,
        marginLeft:  2,
      }}>
        {count}
      </span>
    </div>
  )
}
