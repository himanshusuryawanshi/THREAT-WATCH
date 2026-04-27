/**
 * EventBreakdown — Donut chart of event type distribution.
 *
 * Fetches /api/events/stats → by_type object + event_count total.
 * Uses EVENT_TYPE_COLORS from visualizationRules for each segment.
 * Center label shows total count.
 */
import { useEffect, useRef, useState } from 'react'
import Chart from 'chart.js/auto'
import { EVENT_TYPE_COLORS } from '../../store/visualizationRules'
import useTimeframe from '../../hooks/useTimeframe'

const API_BASE = 'http://localhost:3001'

// Human-readable labels for known types — unknown types fall back to title-case
const TYPE_LABELS = {
  battle:                     'Battle',
  violence_against_civilians: 'Civilian Violence',
  explosion:                  'Explosion',
  protest:                    'Protest',
  riot:                       'Riot',
  strategic_development:      'Strategic Dev.',
}

function labelFor(type) {
  return TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function EventBreakdown() {
  const [byType,  setByType]  = useState({})
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const chartRef  = useRef(null)
  const chartInst = useRef(null)
  const { tfQuery, tfLabel }  = useTimeframe()

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE}/api/events/stats?${tfQuery}`)
      .then(r => r.json())
      .then(data => {
        setByType(data.by_type || {})
        setTotal(data.event_count || 0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [tfQuery])

  // Only show types that have actual data, sorted by count descending
  const activeTypes = Object.entries(byType)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type)

  useEffect(() => {
    if (loading || !chartRef.current || !activeTypes.length) return
    if (chartInst.current) chartInst.current.destroy()

    const counts = activeTypes.map(t => byType[t] || 0)
    const colors = activeTypes.map(t => EVENT_TYPE_COLORS[t] || '#374151')

    chartInst.current = new Chart(chartRef.current, {
      type: 'doughnut',
      data: {
        labels: activeTypes,
        datasets: [{
          data:            counts,
          backgroundColor: colors,
          borderWidth:     0,
          hoverOffset:     4,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        cutout:              '62%',
        animation:           { duration: 600 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.raw.toLocaleString()} events`,
              title: ctx => labelFor(ctx[0].label),
            },
            backgroundColor: 'rgba(13,17,23,0.95)',
            borderColor:     '#1f2937',
            borderWidth:     1,
            titleColor:      '#e2e8f0',
            bodyColor:       '#9ca3af',
            padding:         8,
          },
        },
      },
    })

    return () => chartInst.current?.destroy()
  }, [byType, loading])

  const grandTotal = total || activeTypes.reduce((s, t) => s + (byType[t] || 0), 0)

  return (
    <div style={{ padding: '14px 16px' }}>
      <SectionHeader>Event Breakdown · {tfLabel}</SectionHeader>

      {loading ? (
        <div style={{
          width: 100, height: 100,
          borderRadius: '50%',
          background: 'conic-gradient(#1f2937 0%, #0d1117 100%)',
          margin: '0 auto',
        }} />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Donut with centered total */}
          <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
            <canvas ref={chartRef} />
            <div style={{
              position:  'absolute',
              inset:     0,
              display:   'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize:   13,
                fontWeight: 700,
                color:      '#e2e8f0',
                lineHeight: 1,
              }}>
                {grandTotal >= 1000
                  ? `${(grandTotal / 1000).toFixed(0)}K`
                  : grandTotal.toLocaleString()}
              </span>
              <span style={{
                fontFamily:    "'JetBrains Mono', monospace",
                fontSize:       7,
                letterSpacing: '1px',
                color:         '#4b5563',
                marginTop:     3,
              }}>
                EVENTS
              </span>
            </div>
          </div>

          {/* Legend */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {activeTypes.map(t => {
              const count = byType[t] || 0
              const pct   = grandTotal > 0 ? Math.round((count / grandTotal) * 100) : 0
              return (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: EVENT_TYPE_COLORS[t] || '#374151',
                    flexShrink: 0,
                  }} />
                  <span style={{
                    flex:       1,
                    fontSize:   9,
                    color:      '#9ca3af',
                    fontFamily: "'DM Sans', sans-serif",
                    whiteSpace: 'nowrap',
                    overflow:   'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {labelFor(t)}
                  </span>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize:   9,
                    color:      '#6b7280',
                    marginLeft: 4,
                    flexShrink: 0,
                  }}>
                    {pct}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function SectionHeader({ children }) {
  return (
    <div style={{
      fontFamily:    "'JetBrains Mono', monospace",
      fontSize:       9,
      letterSpacing: '2px',
      color:         '#4b5563',
      textTransform: 'uppercase',
      marginBottom:  12,
    }}>
      {children}
    </div>
  )
}
