/**
 * BreakingNews — Scrollable GDELT article cards.
 *
 * Fetches /api/context/breaking?limit=8.
 * Auto-refreshes every 5 minutes.
 * Click → opens source URL in new tab.
 * Fade-in animation on load/refresh.
 */
import { useEffect, useState, useRef } from 'react'

const API_BASE      = 'http://localhost:3001'
const REFRESH_MS    = 5 * 60 * 1000   // 5 minutes

function relTime(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const m    = Math.floor(diff / 60_000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function BreakingNews() {
  const [articles, setArticles] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [fadeIn,   setFadeIn]   = useState(false)
  const timerRef = useRef(null)

  function load() {
    fetch(`${API_BASE}/api/context/breaking?limit=8`)
      .then(r => r.json())
      .then(({ articles: data = [] }) => {
        setArticles(data)
        setLoading(false)
        setFadeIn(false)
        // Trigger fade-in on next tick
        requestAnimationFrame(() => setFadeIn(true))
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    load()
    timerRef.current = setInterval(load, REFRESH_MS)
    return () => clearInterval(timerRef.current)
  }, [])

  return (
    <div style={{ padding: '14px 16px' }}>
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        marginBottom:   12,
      }}>
        <SectionHeader>Intelligence Feed</SectionHeader>
        <span style={{
          fontFamily:    "'JetBrains Mono', monospace",
          fontSize:       7,
          letterSpacing: '1px',
          color:         '#374151',
          marginTop:     -10,
        }}>
          GDELT · refreshes 5m
        </span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              height: 58, background: '#0f1520', borderRadius: 6,
              opacity: 1 - i * 0.2,
            }} />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div style={{
          color:      '#374151',
          fontSize:   10,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          No articles available
        </div>
      ) : (
        <div
          style={{
            display:   'flex',
            flexDirection: 'column',
            gap:       6,
            opacity:   fadeIn ? 1 : 0,
            transform: fadeIn ? 'translateY(0)' : 'translateY(4px)',
            transition:'opacity 0.35s ease, transform 0.35s ease',
          }}
        >
          {articles.map((a, idx) => (
            <ArticleCard key={a.id || idx} article={a} />
          ))}
        </div>
      )}

      <style>{`
        .tw-article-card:hover {
          background: rgba(255,255,255,0.04) !important;
          border-color: rgba(255,255,255,0.1) !important;
        }
      `}</style>
    </div>
  )
}

function ArticleCard({ article }) {
  const { title, source_name, published_at, tone, url } = article

  // Tone-based accent: negative tone = red tinge, neutral = blue
  const toneVal    = parseFloat(tone) || 0
  const accentColor = toneVal < -2 ? '#ef4444' : toneVal < 0 ? '#f97316' : '#3b82f6'

  function open() {
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className="tw-article-card"
      onClick={open}
      style={{
        padding:      '9px 10px',
        background:   'rgba(255,255,255,0.02)',
        border:       '0.5px solid #1f2937',
        borderLeft:   `2px solid ${accentColor}`,
        borderRadius:  5,
        cursor:       url ? 'pointer' : 'default',
        transition:   'background 0.15s, border-color 0.15s',
      }}
    >
      {/* Source + time */}
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        marginBottom:   4,
      }}>
        <span style={{
          fontFamily:    "'JetBrains Mono', monospace",
          fontSize:       8,
          letterSpacing: '1.5px',
          color:         accentColor,
          textTransform: 'uppercase',
          fontWeight:    700,
        }}>
          {source_name || 'GDELT'}
        </span>
        <span style={{
          fontSize:   8,
          color:      '#374151',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {relTime(published_at)}
        </span>
      </div>

      {/* Headline */}
      <div style={{
        fontSize:   11,
        color:      '#c9d1d9',
        fontFamily: "'DM Sans', sans-serif",
        lineHeight: 1.45,
        display:    '-webkit-box',
        WebkitLineClamp:   2,
        WebkitBoxOrient:   'vertical',
        overflow:   'hidden',
      }}>
        {title || '(No title)'}
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
    }}>
      {children}
    </div>
  )
}
