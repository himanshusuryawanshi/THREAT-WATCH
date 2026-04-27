/**
 * TopCountries — Horizontal bar chart of top 8 conflict countries.
 *
 * Fetches /api/events/stats → by_country (from mv_top_countries MV).
 * CSS-only bars — no Chart.js dependency. Click → /country/:name.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useTimeframe from '../../hooks/useTimeframe'

const API_BASE = 'http://localhost:3001'

export default function TopCountries() {
  const [countries, setCountries] = useState([])
  const [loading,   setLoading]   = useState(true)
  const navigate = useNavigate()
  const { tfQuery, tfLabel } = useTimeframe()

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE}/api/events/stats?${tfQuery}`)
      .then(r => r.json())
      .then(data => {
        const list = (data.by_country || []).slice(0, 8)
        setCountries(list)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [tfQuery])

  const max = countries[0]?.count || 1

  return (
    <div style={{ padding: '14px 16px' }}>
      <SectionHeader>Top Countries · {tfLabel}</SectionHeader>

      {loading ? (
        <Skeleton />
      ) : countries.length === 0 ? (
        <div style={{ color: '#4b5563', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
          No data
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {countries.map(({ country, count, fatalities }) => {
            const pct   = Math.round((count / max) * 100)
            const color = pct > 80 ? '#ef4444' : pct > 55 ? '#f97316' : '#e94560'

            return (
              <div
                key={country}
                onClick={() => navigate(`/country/${encodeURIComponent(country)}`)}
                style={{ cursor: 'pointer' }}
                title={`${fatalities?.toLocaleString() || 0} fatalities`}
              >
                <div style={{
                  display:        'flex',
                  justifyContent: 'space-between',
                  alignItems:     'baseline',
                  marginBottom:   4,
                }}>
                  <span style={{
                    fontSize:  11,
                    color:     '#d1d5db',
                    fontFamily: "'DM Sans', sans-serif",
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
                  onMouseLeave={e => e.currentTarget.style.color = '#d1d5db'}
                  >
                    {country}
                  </span>
                  <span style={{
                    fontFamily:    "'JetBrains Mono', monospace",
                    fontSize:       10,
                    color,
                    fontWeight:    700,
                  }}>
                    {count.toLocaleString()}
                  </span>
                </div>
                <div style={{
                  height:       3,
                  background:   '#1f2937',
                  borderRadius: 2,
                  overflow:     'hidden',
                }}>
                  <div style={{
                    height:     '100%',
                    width:      `${pct}%`,
                    background: `linear-gradient(90deg, #e94560, ${color})`,
                    borderRadius: 2,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            )
          })}
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

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ opacity: 1 - i * 0.15 }}>
          <div style={{
            height: 10, width: `${70 - i * 8}%`,
            background: '#1f2937', borderRadius: 2, marginBottom: 4,
          }} />
          <div style={{
            height: 3, width: '100%',
            background: '#1f2937', borderRadius: 2,
          }} />
        </div>
      ))}
    </div>
  )
}
