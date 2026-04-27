/**
 * HumanitarianImpact — Global conflict impact stats with count-up animation.
 *
 * Sources:
 *  - /api/events/stats          → total events + total documented fatalities
 *  - /api/conflicts             → active conflicts count
 *  - /api/context/humanitarian  → ReliefWeb displaced/affected figures
 */
import { useEffect, useState, useRef } from 'react'

const API_BASE = 'http://localhost:3001'

// ── Count-up hook ─────────────────────────────────────────────────────────────
function useCountUp(target, duration = 1400) {
  const [count, setCount] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!target) return
    const startTime = performance.now()

    function step(now) {
      const elapsed  = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased    = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(target * eased))
      if (progress < 1) rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])

  return count
}

function fmt(n) {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString()
}

export default function HumanitarianImpact() {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/events/stats`).then(r => r.json()),
      fetch(`${API_BASE}/api/conflicts?limit=1`).then(r => r.json()),
      fetch(`${API_BASE}/api/context/humanitarian`).then(r => r.json()).catch(() => ({})),
      fetch(`${API_BASE}/api/displacement/global`).then(r => r.json()).catch(() => ({})),
    ])
      .then(([evStats, conflictsData, humanitarian, displacement]) => {
        setStats({
          events:     evStats.event_count     || 0,
          fatalities: evStats.fatalities      || 0,
          conflicts:  conflictsData.total     || 0,
          // UNHCR figures take priority; fall back to ReliefWeb displacement
          total_forcibly_displaced: displacement.total_forcibly_displaced || humanitarian.total_displaced || 0,
          total_refugees:           displacement.total_refugees           || 0,
          total_idps:               displacement.total_idps               || 0,
          reports:                  humanitarian.total_reports            || 0,
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const animEvents      = useCountUp(stats?.events     || 0)
  const animFatalities  = useCountUp(stats?.fatalities || 0)
  const animConflicts   = useCountUp(stats?.conflicts  || 0)
  const animDisplaced   = useCountUp(stats?.total_forcibly_displaced || 0)
  const animRefugees    = useCountUp(stats?.total_refugees           || 0)
  const animIDPs        = useCountUp(stats?.total_idps               || 0)
  const animReports     = useCountUp(stats?.reports    || 0)

  const rows = [
    {
      label: 'Documented Fatalities',
      value: fmt(animFatalities),
      color: '#ef4444',
      sub:   'UCDP verified · 1989–2026',
    },
    {
      label: 'Events on Record',
      value: fmt(animEvents),
      color: '#f97316',
      sub:   'Battles, explosions, violence',
    },
    {
      label: 'Active Conflicts',
      value: animConflicts,
      color: '#fbbf24',
      sub:   'Tracked conflict theatres',
    },
    // UNHCR real figures — shown when displacement data is loaded
    ...(stats?.total_forcibly_displaced > 0 ? [{
      label: 'Forcibly Displaced',
      value: fmt(animDisplaced),
      color: '#00d4ff',
      sub:   'UNHCR 2024 · refugees + IDPs',
    }] : []),
    ...(stats?.total_refugees > 0 ? [{
      label: 'Refugees & Asylum-Seekers',
      value: fmt(animRefugees),
      color: '#60a5fa',
      sub:   'UNHCR 2024 · cross-border',
    }] : []),
    ...(stats?.total_idps > 0 ? [{
      label: 'Internally Displaced',
      value: fmt(animIDPs),
      color: '#818cf8',
      sub:   'UNHCR 2024 · IDPs',
    }] : []),
    ...(stats?.reports > 0 ? [{
      label: 'Humanitarian Reports',
      value: fmt(animReports),
      color: '#a78bfa',
      sub:   'UN/NGO situation reports',
    }] : []),
  ]

  return (
    <div style={{ padding: '14px 16px' }}>
      <SectionHeader>Humanitarian Impact</SectionHeader>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              height: 40, background: '#111827', borderRadius: 6,
              opacity: 1 - i * 0.2,
            }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(({ label, value, color, sub }) => (
            <div key={label} style={{
              padding:      '10px 12px',
              background:   'rgba(255,255,255,0.02)',
              border:       '0.5px solid #1f2937',
              borderRadius:  6,
              borderLeft:   `2px solid ${color}`,
            }}>
              <div style={{
                display:        'flex',
                justifyContent: 'space-between',
                alignItems:     'baseline',
                marginBottom:   3,
              }}>
                <span style={{
                  fontSize:   10,
                  color:      '#9ca3af',
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {label}
                </span>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize:   16,
                  fontWeight: 700,
                  color,
                  lineHeight: 1,
                }}>
                  {value}
                </span>
              </div>
              <div style={{
                fontSize:      8,
                color:         '#4b5563',
                fontFamily:    "'JetBrains Mono', monospace",
                letterSpacing: '0.8px',
              }}>
                {sub}
              </div>
            </div>
          ))}

          {/* Attribution */}
          <div style={{
            fontSize:      8,
            color:         '#374151',
            fontFamily:    "'JetBrains Mono', monospace",
            letterSpacing: '1px',
            textAlign:     'right',
          }}>
            UCDP · UNHCR · ReliefWeb
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
