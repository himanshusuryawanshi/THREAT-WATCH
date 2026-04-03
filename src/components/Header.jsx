import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'

const EVENT_TYPES = [
  'Battles',
  'Explosions/Remote violence',
  'Violence against civilians',
  'Protests',
  'Riots',
  'Strategic developments',
]

const EVENT_TYPE_COLORS = {
  'Battles':                    '#ff2a2a',
  'Explosions/Remote violence': '#f97316',
  'Violence against civilians': '#fbbf24',
  'Protests':                   '#38bdf8',
  'Riots':                      '#a855f7',
  'Strategic developments':     '#6b7280',
}

export default function Header() {
  const getStats = useStore(s => s.getStats)
  const stats    = getStats()
  const navigate = useNavigate()
  const inputRef = useRef(null)

  const [suggestions, setSuggestions] = useState({ countries: [], types: [] })
  const [showDrop,    setShowDrop]    = useState(false)

  function getCountries() {
    const events = useStore.getState().events
    return [...new Set(events.map(e => e.country).filter(Boolean))].sort()
  }

  function buildSuggestions(val) {
    // Read the raw value — no trim so partial words like 'Ind' work fully
    if (!val) {
      setSuggestions({ countries: [], types: [] })
      setShowDrop(false)
      return
    }

    const q = val.toLowerCase()

    const countryMatches = getCountries()
      .filter(c => c.toLowerCase().startsWith(q))
      .slice(0, 5)

    const typeMatches = EVENT_TYPES
      .filter(t => t.toLowerCase().includes(q))
      .slice(0, 3)

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
      const countries = getCountries()

      const exactMatch  = countries.find(c => c.toLowerCase() === q.toLowerCase())
      const startsMatch = countries.find(c => c.toLowerCase().startsWith(q.toLowerCase()))

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
    <header className="flex items-center gap-3 px-4 h-12 bg-[#06090e] border-b border-border flex-shrink-0 z-50">

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
                  const short = type
                    .replace('/Remote violence', '')
                    .replace(' against civilians', '')
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

      {/* Threat meter */}
      <div className="bg-threat/10 border border-threat/30 rounded px-3 py-1 text-center">
        <div className="text-threat text-base font-bold leading-none">7.2</div>
        <div className="text-[8px] tracking-widest text-muted">THREAT LEVEL</div>
      </div>

      {/* Stats */}
      <Stat value={stats.total}      label="EVENTS"     color="text-threat"     />
      <Stat value={stats.fatalities} label="FATALITIES" color="text-orange-400" />
      <Stat value={stats.countries}  label="COUNTRIES"  color="text-yellow-400" />

      {/* Trend */}
      <div className="text-center px-1">
        <div className="text-purple-400 text-base font-bold">+12%</div>
        <div className="text-[8px] tracking-widest text-muted">VS LAST WK</div>
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