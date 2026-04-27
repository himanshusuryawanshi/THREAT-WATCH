/**
 * SatelliteFires — NASA FIRMS thermal anomalies summary.
 *
 * Fetches /api/fires/stats?timeframe=7d.
 * Compact section: total in conflict zones + top 3 countries.
 */
import { useEffect, useState } from 'react'

const API_BASE = 'http://localhost:3001'

export default function SatelliteFires() {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/api/fires/stats?timeframe=7d`)
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: '14px 16px' }}>
      <SectionHeader>Satellite Fires · 7d</SectionHeader>

      {loading ? (
        <div style={{ color: '#4b5563', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
          Loading...
        </div>
      ) : !stats || stats.total === 0 ? (
        <div style={{ color: '#374151', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
          No FIRMS data — check FIRMS_API_KEY
        </div>
      ) : (
        <div>
          {/* Main count line */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{
              fontSize:  16,
              filter:    'drop-shadow(0 0 6px #ff8c00)',
              lineHeight: 1,
            }}>
              🔥
            </span>
            <div>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize:   15,
                fontWeight: 700,
                color:      '#ff8c00',
              }}>
                {(stats.conflict_zone ?? stats.total ?? 0).toLocaleString()}
              </span>
              <span style={{
                fontSize:   10,
                color:      '#6b7280',
                fontFamily: "'DM Sans', sans-serif",
                marginLeft: 6,
              }}>
                thermal anomalies in conflict zones
              </span>
            </div>
          </div>

          {/* Secondary stats */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
            {stats.total != null && (
              <Stat label="Total detected" value={stats.total.toLocaleString()} />
            )}
            {stats.max_frp != null && (
              <Stat label="Peak FRP" value={`${parseFloat(stats.max_frp).toFixed(0)} MW`} />
            )}
          </div>

          {/* Top 3 countries */}
          {stats.by_country?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{
                fontSize:      8,
                color:         '#374151',
                fontFamily:    "'JetBrains Mono', monospace",
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                marginBottom:  4,
              }}>
                Top zones
              </div>
              {stats.by_country.slice(0, 3).map(r => (
                <div key={r.country} style={{
                  display:        'flex',
                  justifyContent: 'space-between',
                  alignItems:     'center',
                }}>
                  <span style={{
                    fontSize:   10,
                    color:      '#9ca3af',
                    fontFamily: "'DM Sans', sans-serif",
                    maxWidth:   200,
                    overflow:   'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {r.country}
                  </span>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize:   10,
                    color:      '#ff8c00',
                    fontWeight: 700,
                  }}>
                    {r.fire_count}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Attribution */}
          <div style={{
            marginTop:     8,
            fontSize:       8,
            color:         '#374151',
            fontFamily:    "'JetBrains Mono', monospace",
            letterSpacing: '0.8px',
          }}>
            NASA FIRMS · VIIRS SNPP NRT
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{
        fontSize:      7,
        color:         '#374151',
        fontFamily:    "'JetBrains Mono', monospace",
        letterSpacing: '1px',
        textTransform: 'uppercase',
        marginBottom:  2,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize:   12,
        color:      '#9ca3af',
        fontWeight: 600,
      }}>
        {value}
      </div>
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
