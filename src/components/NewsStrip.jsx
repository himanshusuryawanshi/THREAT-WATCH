import { useState, useEffect } from 'react'

const API     = 'http://localhost:3001/api'
const REFRESH = 15 * 60 * 1000   // 15 min — matches GDELT poll interval

// Fallback shown while articles load or if API is down
const FALLBACK = [
  'ThreatWatch — global conflict intelligence platform · UCDP verified events · NASA FIRMS satellite data',
  'Loading latest conflict intelligence from GDELT · UCDP · NASA FIRMS...',
]

export default function NewsStrip() {
  const [headlines, setHeadlines] = useState(FALLBACK)
  const [paused,    setPaused]    = useState(false)

  useEffect(() => {
    async function fetchHeadlines() {
      try {
        const res  = await fetch(`${API}/context/breaking?limit=20`)
        const data = await res.json()
        const articles = data.articles || []
        if (articles.length > 0) {
          // Format: "SOURCE: Title" — truncated to keep strip readable
          setHeadlines(articles.map(a => {
            const src  = a.source_name ? `${a.source_name.toUpperCase()}: ` : ''
            const tone = a.tone != null
              ? (a.tone < -3 ? ' ⚠' : a.tone > 3 ? ' ↑' : '')
              : ''
            return `${src}${a.title}${tone}`
          }))
        }
      } catch {
        // Keep fallback on network error
      }
    }

    fetchHeadlines()
    const timer = setInterval(fetchHeadlines, REFRESH)
    return () => clearInterval(timer)
  }, [])

  const text = headlines.join('   ·   ')

  return (
    <div
      className="flex items-center gap-2 h-6 bg-[#04060a] border-b border-border px-3 flex-shrink-0 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span className="text-[10px] font-bold tracking-widest text-threat border border-threat/40 px-1.5 py-0.5 rounded-sm flex-shrink-0">
        BREAKING
      </span>

      <div className="flex-1 overflow-hidden">
        <div
          className="whitespace-nowrap text-[12px] text-muted inline-block"
          style={{
            animation:          'scroll-news 120s linear infinite',
            animationPlayState: paused ? 'paused' : 'running',
          }}
        >
          {text}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{text}
        </div>
      </div>

      <span className="text-[10px] text-muted flex-shrink-0 border border-border2 px-1.5 py-0.5 rounded hidden sm:block">
        HOVER TO PAUSE
      </span>
    </div>
  )
}
