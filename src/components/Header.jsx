import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'

// ── Date Range Picker ─────────────────────────────────────────────────────────
const PRESETS = [
  { key: '7d',  label: '7D'  },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: '1y',  label: '1Y'  },
]

function DateRangePicker() {
  const timeframe      = useStore(s => s.timeframe)
  const customFrom     = useStore(s => s.customFrom)
  const customTo       = useStore(s => s.customTo)
  const setTimeframe   = useStore(s => s.setTimeframe)
  const setCustomRange = useStore(s => s.setCustomRange)

  const [showCustom, setShowCustom] = useState(false)
  const [from, setFrom]             = useState(customFrom || '')
  const [to,   setTo]               = useState(customTo   || '')

  function applyCustom() {
    if (from && to && from <= to) {
      setCustomRange(from, to)
      setShowCustom(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, position: 'relative' }}>
      {/* Label */}
      <span style={{
        fontFamily:    "'JetBrains Mono', monospace",
        fontSize:       7,
        letterSpacing: '1.5px',
        color:         '#4b5563',
        marginRight:   2,
        whiteSpace:    'nowrap',
      }}>
        RANGE
      </span>

      {/* Preset buttons */}
      {PRESETS.map(({ key, label }) => {
        const active = timeframe === key
        return (
          <button
            key={key}
            onClick={() => { setTimeframe(key); setShowCustom(false) }}
            style={{
              padding:       '3px 7px',
              borderRadius:   3,
              fontSize:       8,
              fontWeight:     700,
              letterSpacing:  1,
              fontFamily:     "'JetBrains Mono', monospace",
              cursor:         'pointer',
              transition:     'all 0.12s',
              background:     active ? 'rgba(239,68,68,0.15)' : 'transparent',
              border:         active ? '0.5px solid rgba(239,68,68,0.5)' : '0.5px solid rgba(255,255,255,0.08)',
              color:          active ? '#ef4444' : '#6b7280',
            }}
          >
            {label}
          </button>
        )
      })}

      {/* Custom button */}
      <button
        onClick={() => setShowCustom(v => !v)}
        style={{
          padding:       '3px 7px',
          borderRadius:   3,
          fontSize:       8,
          fontWeight:     700,
          letterSpacing:  1,
          fontFamily:     "'JetBrains Mono', monospace",
          cursor:         'pointer',
          transition:     'all 0.12s',
          background:     timeframe === 'custom' ? 'rgba(59,130,246,0.15)' : 'transparent',
          border:         timeframe === 'custom' ? '0.5px solid rgba(59,130,246,0.5)' : '0.5px solid rgba(255,255,255,0.08)',
          color:          timeframe === 'custom' ? '#3b82f6' : '#6b7280',
        }}
      >
        {timeframe === 'custom' && customFrom
          ? `${customFrom.slice(2)} – ${(customTo||'').slice(2)}`
          : 'CUSTOM'}
      </button>

      {/* Custom date popover */}
      {showCustom && (
        <div style={{
          position:     'absolute',
          top:          '110%',
          left:         0,
          zIndex:       1000,
          background:   '#06090e',
          border:       '0.5px solid #1e2d3d',
          borderRadius:  6,
          padding:      '10px 12px',
          display:      'flex',
          alignItems:   'center',
          gap:           8,
          boxShadow:    '0 8px 32px rgba(0,0,0,0.6)',
          whiteSpace:   'nowrap',
        }}>
          <style>{`
            .tw-date-input {
              background: #0d1117 !important;
              border: 0.5px solid #1e2d3d !important;
              border-radius: 3px !important;
              color: #c9d1d9 !important;
              font-family: 'JetBrains Mono', monospace !important;
              font-size: 9px !important;
              padding: 3px 6px !important;
              outline: none !important;
              color-scheme: dark;
            }
            .tw-date-input:focus { border-color: #ef4444 !important; }
          `}</style>
          <span style={{ fontSize: 8, color: '#4b5563', fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>FROM</span>
          <input
            type="date"
            className="tw-date-input"
            value={from}
            max={to || undefined}
            onChange={e => setFrom(e.target.value)}
          />
          <span style={{ fontSize: 8, color: '#4b5563', fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>TO</span>
          <input
            type="date"
            className="tw-date-input"
            value={to}
            min={from || undefined}
            onChange={e => setTo(e.target.value)}
          />
          <button
            onClick={applyCustom}
            disabled={!from || !to || from > to}
            style={{
              padding:      '3px 10px',
              borderRadius:  3,
              fontSize:      8,
              fontWeight:    700,
              letterSpacing: 1,
              fontFamily:    "'JetBrains Mono', monospace",
              cursor:        (!from || !to || from > to) ? 'not-allowed' : 'pointer',
              background:    (!from || !to || from > to) ? 'transparent' : 'rgba(239,68,68,0.15)',
              border:        '0.5px solid rgba(239,68,68,0.4)',
              color:         (!from || !to || from > to) ? '#374151' : '#ef4444',
              transition:    'all 0.12s',
            }}
          >
            APPLY
          </button>
          <button
            onClick={() => setShowCustom(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#4b5563',
              cursor: 'pointer',
              fontSize: 10,
              padding: '2px 4px',
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

const API_BASE = 'http://localhost:3001'

// Actual UCDP event type values stored in the DB (snake_case from normalization.js)
const EVENT_TYPES = [
  'battle',
  'violence_against_civilians',
]

const EVENT_TYPE_COLORS = {
  'battle':                    '#ef4444',
  'violence_against_civilians':'#fbbf24',
}

const EVENT_TYPE_LABELS = {
  'battle':                    'Battles',
  'violence_against_civilians':'Violence Against Civilians',
}

export default function Header() {
  const getStats = useStore(s => s.getStats)
  const stats    = getStats()
  const navigate = useNavigate()
  const inputRef = useRef(null)

  const [suggestions,   setSuggestions]   = useState({ countries: [], types: [] })
  const [showDrop,      setShowDrop]      = useState(false)
  const [alertSummary,  setAlertSummary]  = useState(null)
  const [allCountries,  setAllCountries]  = useState([])

  useEffect(() => {
    // Pre-fetch full country list from the DB (all 129 conflict countries)
    fetch(`${API_BASE}/api/geo/choropleth`)
      .then(r => r.json())
      .then(d => {
        const list = (d.countries || [])
          .map(c => c.country)
          .filter(Boolean)
          .sort()
        setAllCountries(list)
      })
      .catch(() => {})

    fetch(`${API_BASE}/api/alerts`)
      .then(r => r.json())
      .then(d => setAlertSummary(d.summary || null))
      .catch(() => {})
  }, [])

  function buildSuggestions(val) {
    if (!val) {
      setSuggestions({ countries: [], types: [] })
      setShowDrop(false)
      return
    }

    const q = val.toLowerCase()

    const countryMatches = allCountries
      .filter(c => c.toLowerCase().startsWith(q))
      .slice(0, 6)

    // Match against both the raw type key and its display label
    const typeMatches = EVENT_TYPES
      .filter(t =>
        t.toLowerCase().includes(q) ||
        EVENT_TYPE_LABELS[t].toLowerCase().includes(q)
      )

    const hasResults = countryMatches.length > 0 || typeMatches.length > 0
    setSuggestions({ countries: countryMatches, types: typeMatches })
    setShowDrop(hasResults)
  }

  function handleChange(e) {
    // Read value immediately — never defer or pass e to async code
    const val = e.target.value

    if (!val) {
      setSuggestions({ countries: [], types: [] })
      setShowDrop(false)
      useStore.setState({ search: '' })
      useStore.getState().applyFilters()
      return
    }

    buildSuggestions(val)
  }

  function goToCountry(country) {
    setSuggestions({ countries: [], types: [] })
    setShowDrop(false)
    if (inputRef.current) inputRef.current.value = ''
    useStore.setState({ search: '' })
    useStore.getState().applyFilters()
    navigate(`/country/${encodeURIComponent(country)}`)
  }

  function filterByType(type) {
    setSuggestions({ countries: [], types: [] })
    setShowDrop(false)
    if (inputRef.current) inputRef.current.value = ''
    useStore.getState().setActiveType(type)
  }

  function handleKeyDown(e) {
    // Read value immediately at top
    const val = e.target.value

    if (e.key === 'Enter' && val.trim()) {
      const q         = val.trim()

      const exactMatch  = allCountries.find(c => c.toLowerCase() === q.toLowerCase())
      const startsMatch = allCountries.find(c => c.toLowerCase().startsWith(q.toLowerCase()))

      if (exactMatch || startsMatch) {
        goToCountry(exactMatch || startsMatch)
        return
      }

      const typeMatch = EVENT_TYPES.find(t => t.toLowerCase().includes(q.toLowerCase()))
      if (typeMatch) {
        filterByType(typeMatch)
        return
      }

      // Fallback keyword filter
      setSuggestions({ countries: [], types: [] })
      setShowDrop(false)
      useStore.setState({ search: q })
      useStore.getState().applyFilters()
    }

    if (e.key === 'Escape') {
      if (inputRef.current) inputRef.current.value = ''
      setSuggestions({ countries: [], types: [] })
      setShowDrop(false)
      useStore.setState({ search: '' })
      useStore.getState().applyFilters()
    }
  }

  const hasCountries = suggestions.countries.length > 0
  const hasTypes     = suggestions.types.length > 0

  return (
    <header className="flex items-center gap-3 px-4 h-12 bg-[#06090e] border-b border-border flex-shrink-0 z-[700]" style={{ position: 'relative' }}>

      {/* Logo */}
      <div className="flex items-center gap-2 min-w-[140px]">
        <div className="w-5 h-5 rounded-full border border-threat flex items-center justify-center animate-pulse-ring">
          <div className="w-2 h-2 rounded-full bg-threat" />
        </div>
        <span className="font-oswald text-lg font-semibold tracking-[3px] text-white">
          THREAT<span className="text-threat">WATCH</span>
        </span>
      </div>

      {/* Search + dropdown */}
      <div className="relative flex-1 max-w-[220px]">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search country, event type..."
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setShowDrop(false), 150)}
          onFocus={() => {
            const val = inputRef.current?.value
            if (val) buildSuggestions(val)
          }}
          className="w-full bg-panel2 border border-border2 text-[#c9d1d9] font-mono text-[11px] px-3 py-1.5 rounded focus:outline-none focus:border-threat placeholder-muted"
        />

        {/* Suggestions dropdown */}
        {showDrop && (hasCountries || hasTypes) && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#06090e] border border-border2 rounded overflow-hidden z-[999] shadow-xl">

            {/* Countries */}
            {hasCountries && (
              <>
                <div className="px-3 pt-2 pb-1 text-[8px] tracking-[2px] text-muted">
                  COUNTRIES
                </div>
                {suggestions.countries.map(country => (
                  <button
                    key={country}
                    onMouseDown={() => goToCountry(country)}
                    className="w-full text-left px-3 py-1.5 text-[11px] font-mono text-[#c9d1d9] hover:bg-threat/10 hover:text-white flex items-center justify-between group transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[9px]">🌍</span>
                      <span>{country}</span>
                    </div>
                    <span className="text-[9px] text-muted group-hover:text-threat tracking-widest transition-colors">
                      VIEW →
                    </span>
                  </button>
                ))}
              </>
            )}

            {/* Divider */}
            {hasCountries && hasTypes && (
              <div className="border-t border-border2/50 mx-2 my-1" />
            )}

            {/* Event types */}
            {hasTypes && (
              <>
                <div className="px-3 pt-2 pb-1 text-[8px] tracking-[2px] text-muted">
                  EVENT TYPES
                </div>
                {suggestions.types.map(type => {
                  const color = EVENT_TYPE_COLORS[type] || '#6b7280'
                  const short = EVENT_TYPE_LABELS[type] || type
                  return (
                    <button
                      key={type}
                      onMouseDown={() => filterByType(type)}
                      className="w-full text-left px-3 py-1.5 text-[11px] font-mono text-[#c9d1d9] hover:bg-white/[0.04] hover:text-white flex items-center justify-between group transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span>{short}</span>
                      </div>
                      <span className="text-[9px] text-muted group-hover:text-white tracking-widest transition-colors">
                        FILTER →
                      </span>
                    </button>
                  )
                })}
              </>
            )}

            <div className="h-1.5" />
          </div>
        )}
      </div>

      {/* Date range picker */}
      <DateRangePicker />

      {/* Threat meter */}
      <div className="bg-threat/10 border border-threat/30 rounded px-3 py-1 text-center">
        <div className="text-threat text-base font-bold leading-none">
          {alertSummary
            ? alertSummary.critical > 0 ? 'HIGH'
              : alertSummary.elevated > 0 ? 'MED'
              : 'LOW'
            : '—'}
        </div>
        <div className="text-[8px] tracking-widest text-muted">THREAT LEVEL</div>
      </div>

      {/* Stats */}
      <Stat value={stats.total}      label="EVENTS"     color="text-threat"     />
      <Stat value={stats.fatalities} label="FATALITIES" color="text-orange-400" />
      <Stat value={stats.countries}  label="COUNTRIES"  color="text-yellow-400" />

      {/* Alert count */}
      <div className="text-center px-1">
        <div className="text-purple-400 text-base font-bold">
          {alertSummary ? (alertSummary.critical || 0) + (alertSummary.elevated || 0) : '—'}
        </div>
        <div className="text-[8px] tracking-widest text-muted">ACTIVE ALERTS</div>
      </div>

      {/* Nav links */}
      <div className="flex items-center gap-1 ml-auto">
        <NavLink href="/" label="DASHBOARD" />
        <NavLink href="/compare" label="COMPARE" />
      </div>

      {/* Live badge */}
      <div className="flex items-center gap-1.5 text-green-400 text-[10px] tracking-widest">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-blink" />
        LIVE
      </div>

    </header>
  )
}

function Stat({ value, label, color }) {
  return (
    <div className="text-center px-1">
      <div className={`text-base font-bold ${color}`}>{value.toLocaleString()}</div>
      <div className="text-[8px] tracking-widest text-muted">{label}</div>
    </div>
  )
}

function NavLink({ href, label }) {
  const active = window.location.pathname === href
  return (
    <a
      href={href}
      className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-widest border font-mono transition-all no-underline
        ${active
          ? 'bg-threat/15 border-threat/50 text-threat'
          : 'bg-transparent border-border2 text-muted hover:border-threat/50 hover:text-[#c9d1d9]'
        }`}
    >
      {label}
    </a>
  )
}