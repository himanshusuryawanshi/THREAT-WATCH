/**
 * EarlyWarning — Live alert feed from /api/alerts.
 *
 * Shows up to 5 unresolved alerts ordered by severity.
 * Severity icons: critical → 🔴, elevated → 🟠, watch → 🟡
 * Click navigates to /country/:name.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = 'http://localhost:3001'

const SEVERITY_CONFIG = {
  critical: { dot: '#ef4444', label: 'CRITICAL', ring: 'rgba(239,68,68,0.15)' },
  elevated: { dot: '#f97316', label: 'ELEVATED', ring: 'rgba(249,115,22,0.10)' },
  watch:    { dot: '#fbbf24', label: 'WATCH',    ring: 'rgba(251,191,36,0.08)' },
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (d > 0)  return `${d}d ago`
  if (h > 0)  return `${h}h ago`
  const m = Math.floor(diff / 60_000)
  return `${m}m ago`
}

export default function EarlyWarning() {
  const [alerts,  setAlerts]  = useState([])
  const [summary, setSummary] = useState({ critical: 0, elevated: 0, watch: 0 })
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetch(`${API_BASE}/api/alerts?resolved=false&limit=5`)
      .then(r => r.json())
      .then(data => {
        setAlerts(data.alerts   || [])
        setSummary(data.summary || { critical: 0, elevated: 0, watch: 0 })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const totalActive = summary.critical + summary.elevated + summary.watch

  return (
    <div style={{ padding: '14px 16px' }}>
      {/* Header row */}
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        marginBottom:   12,
      }}>
        <SectionHeader>Early Warning</SectionHeader>

        {/* Badge counts */}
        {!loading && totalActive > 0 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {summary.critical > 0 && (
              <Badge color="#ef4444" count={summary.critical} />
            )}
            {summary.elevated > 0 && (
              <Badge color="#f97316" count={summary.elevated} />
            )}
            {summary.watch > 0 && (
              <Badge color="#fbbf24" count={summary.watch} />
            )}
          </div>
        )}
      </div>

      {loading ? (
        <Skeleton />
      ) : alerts.length === 0 ? (
        <div style={{
          color:      '#4b5563',
          fontSize:   10,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          No active alerts
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {alerts.map(alert => {
            const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.watch

            return (
              <div
                key={alert.id}
                onClick={() => alert.country && navigate(`/country/${encodeURIComponent(alert.country)}`)}
                style={{
                  padding:      '8px 10px',
                  background:   cfg.ring,
                  border:       `0.5px solid ${cfg.dot}33`,
                  borderLeft:   `2px solid ${cfg.dot}`,
                  borderRadius:  4,
                  cursor:        alert.country ? 'pointer' : 'default',
                  transition:   'background 0.15s',
                }}
                onMouseEnter={e => {
                  if (alert.country) e.currentTarget.style.background = `${cfg.ring.replace(')', ', 0.9)').replace('rgba', 'rgba')}`
                  e.currentTarget.style.borderColor = cfg.dot + '66'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background  = cfg.ring
                  e.currentTarget.style.borderColor  = cfg.dot + '33'
                }}
              >
                {/* Top row: severity badge + country */}
                <div style={{
                  display:        'flex',
                  justifyContent: 'space-between',
                  alignItems:     'center',
                  marginBottom:   3,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {/* Pulsing dot for critical */}
                    <div style={{
                      width:        5,
                      height:       5,
                      borderRadius: '50%',
                      background:   cfg.dot,
                      flexShrink:   0,
                      animation:    alert.severity === 'critical'
                        ? 'pulse-ring 2s infinite'
                        : undefined,
                    }} />
                    <span style={{
                      fontFamily:    "'JetBrains Mono', monospace",
                      fontSize:       8,
                      color:          cfg.dot,
                      letterSpacing: '1px',
                      fontWeight:    700,
                    }}>
                      {cfg.label}
                    </span>
                  </div>
                  <span style={{
                    fontFamily:    "'JetBrains Mono', monospace",
                    fontSize:       8,
                    color:         '#4b5563',
                    letterSpacing: '0.5px',
                  }}>
                    {timeAgo(alert.created_at)}
                  </span>
                </div>

                {/* Alert title */}
                <div style={{
                  fontSize:   10,
                  color:      '#d1d5db',
                  fontFamily: "'DM Sans', sans-serif",
                  lineHeight: 1.35,
                  marginBottom: alert.country ? 3 : 0,
                }}>
                  {alert.title}
                </div>

                {/* Country tag */}
                {alert.country && (
                  <div style={{
                    fontSize:      8,
                    color:         '#6b7280',
                    fontFamily:    "'JetBrains Mono', monospace",
                    letterSpacing: '0.5px',
                    marginTop:     2,
                  }}>
                    {alert.country.toUpperCase()}
                  </div>
                )}
              </div>
            )
          })}

          {totalActive > 5 && (
            <div style={{
              textAlign:     'center',
              fontSize:       8,
              color:         '#4b5563',
              fontFamily:    "'JetBrains Mono', monospace",
              letterSpacing: '1px',
              paddingTop:    4,
            }}>
              +{totalActive - 5} MORE ALERTS
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Badge({ color, count }) {
  return (
    <div style={{
      background:    `${color}22`,
      border:        `0.5px solid ${color}55`,
      borderRadius:   3,
      padding:       '1px 5px',
      fontFamily:    "'JetBrains Mono', monospace",
      fontSize:       8,
      color,
      fontWeight:    700,
    }}>
      {count}
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
    }}>
      {children}
    </div>
  )
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{
          height:       46,
          background:   '#111827',
          borderRadius:  4,
          borderLeft:   '2px solid #1f2937',
          opacity:       1 - i * 0.25,
        }} />
      ))}
    </div>
  )
}
