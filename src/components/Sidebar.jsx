import { useState, useRef, useEffect } from 'react'
import useStore from '../store/useStore'
import { EVENT_TYPES, getEventColor } from '../utils/constants'
import Chart from 'chart.js/auto'

export default function Sidebar({ mapRef, layer }) {
  const {
    filteredEvents, activeType, setActiveType,
    dateFrom, dateTo, setDateRange,
    minFatal, setMinFatal,
    resetFilters, setSelectedEvent,
  } = useStore()

  const [typeOpen, setTypeOpen] = useState(false)
  const typeRef = useRef(null)

  const counts = { all: filteredEvents.length }
  Object.keys(EVENT_TYPES).forEach(t => {
    counts[t] = filteredEvents.filter(e => e.type === t).length
  })

  useEffect(() => {
    function handleClick(e) {
      if (typeRef.current && !typeRef.current.contains(e.target)) {
        setTypeOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const activeLabel = activeType === 'all'
    ? 'All Events'
    : EVENT_TYPES[activeType]?.label || activeType

  const activeColor = activeType === 'all'
    ? '#ffffff'
    : EVENT_TYPES[activeType]?.color || '#ffffff'

  if (layer === 'strikes') {
    return <StrikesPanel />
  }

  return (
    <div className="w-[220px] flex-shrink-0 bg-panel border-r border-border flex flex-col overflow-y-auto">

      {/* Date range */}
      <div className="p-2.5 border-b border-border flex-shrink-0">
        <div className="text-[10px] tracking-[2.5px] text-muted mb-2">DATE RANGE</div>
        <div className="flex flex-col gap-1.5">
          <input type="date" value={dateFrom || '2025-01-01'}
            onChange={e => setDateRange(e.target.value, dateTo || '2025-11-30')}
            className="bg-panel2 border border-border2 text-[#c9d1d9] font-mono text-[10px] px-2 py-1 rounded focus:outline-none focus:border-blue-400"
          />
          <input type="date" value={dateTo || '2025-11-30'}
            onChange={e => setDateRange(dateFrom || '2025-01-01', e.target.value)}
            className="bg-panel2 border border-border2 text-[#c9d1d9] font-mono text-[10px] px-2 py-1 rounded focus:outline-none focus:border-blue-400"
          />
        </div>
      </div>

      {/* Event type dropdown */}
      <div className="p-2.5 border-b border-border flex-shrink-0" ref={typeRef}>
        <div className="text-[10px] tracking-[2.5px] text-muted mb-2">EVENT TYPE</div>
        <div className="relative">
          <button
            onClick={() => setTypeOpen(o => !o)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded border border-border2 bg-panel2 text-[10px] font-mono text-left hover:border-threat/50 transition-all"
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: activeColor }} />
            <span className="flex-1 text-white">{activeLabel}</span>
            <span className="text-muted">{counts[activeType === 'all' ? 'all' : activeType] || 0}</span>
            <span className="text-muted ml-1">{typeOpen ? '▲' : '▼'}</span>
          </button>
          {typeOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d1117] border border-border2 rounded z-[600] overflow-hidden shadow-xl">
              <button
                onClick={() => { setActiveType('all'); setTypeOpen(false) }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-[10px] font-mono text-left hover:bg-white/5 transition-colors
                  ${activeType === 'all' ? 'bg-threat/10 text-white' : 'text-muted'}`}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0 bg-white" />
                <span className="flex-1">All Events</span>
                <span className="text-muted">{counts.all}</span>
              </button>
              {Object.entries(EVENT_TYPES).map(([type, { color, label }]) => (
                <button
                  key={type}
                  onClick={() => { setActiveType(type); setTypeOpen(false) }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-[10px] font-mono text-left hover:bg-white/5 transition-colors
                    ${activeType === type ? 'bg-threat/10 text-white' : 'text-muted'}`}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="flex-1">{label}</span>
                  <span className="text-muted">{counts[type] || 0}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fatality slider
      <div className="p-2.5 border-b border-border flex-shrink-0">
        <div className="flex justify-between items-center mb-1.5">
          <div className="text-[8px] tracking-[2.5px] text-muted">MIN FATALITIES</div>
          <div className="text-[10px] text-threat font-bold">
            {(minFatal || 0) === 50 ? '50+' : (minFatal || 0)}
          </div>
        </div>
        <input type="range" min="0" max="50" step="1" value={minFatal || 0}
          onChange={e => setMinFatal(parseInt(e.target.value))}
          className="w-full accent-threat"
        />
        <div className="flex justify-between text-[8px] text-muted mt-0.5">
          <span>0</span><span>25</span><span>50+</span>
        </div>
      </div> */}

      {/* Reset */}
      <div className="p-2.5 border-b border-border flex-shrink-0">
        <button onClick={resetFilters}
          className="w-full py-1.5 bg-transparent border border-border2 text-muted font-mono text-[9px] tracking-widest rounded hover:border-threat hover:text-threat transition-all">
          RESET ALL FILTERS
        </button>
      </div>

      {/* Top countries */}
      <div className="p-2.5 border-b border-border flex-shrink-0">
        <div className="text-[10px] tracking-[2.5px] text-muted mb-2">TOP COUNTRIES</div>
        <TopCountriesBar events={filteredEvents} />
      </div>

      {/* Event breakdown */}
      <div className="p-2.5 flex-shrink-0">
        <div className="text-[10px] tracking-[2.5px] text-muted mb-2">EVENT BREAKDOWN</div>
        <EventBreakdown events={filteredEvents} />
      </div>

    </div>
  )
}

// ── TOP COUNTRIES BAR ─────────────────────────────────────────
function TopCountriesBar({ events }) {
  const counts = {}
  events.forEach(e => { counts[e.country] = (counts[e.country] || 0) + 1 })
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const max = top[0]?.[1] || 1

  if (top.length === 0) return (
    <div className="text-[9px] text-muted">No data</div>
  )

  return (
    <div className="flex flex-col gap-2">
      {top.map(([country, count]) => {
        const pct   = Math.round((count / max) * 100)
        const color = pct > 80 ? '#ff2a2a' : pct > 50 ? '#f97316' : '#38bdf8'
        return (
          <div key={country}
            className="cursor-pointer group"
            onClick={() => window.location.href = `/country/${encodeURIComponent(country)}`}
          >
            <div className="flex justify-between text-[9px] mb-1">
              <span className="text-muted group-hover:text-white transition-colors">{country}</span>
              <span style={{ color }} className="font-bold">{count}</span>
            </div>
            <div className="h-1.5 bg-border2 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── EVENT BREAKDOWN ───────────────────────────────────────────
function EventBreakdown({ events }) {
  const chartRef  = useRef(null)
  const chartInst = useRef(null)

  const types      = Object.keys(EVENT_TYPES)
  const typeCounts = types.map(t => events.filter(e => e.type === t).length)
  const total      = events.length || 1

  useEffect(() => {
    if (!chartRef.current) return
    if (chartInst.current) chartInst.current.destroy()

    chartInst.current = new Chart(chartRef.current, {
      type: 'doughnut',
      data: {
        labels: types.map(t => t.replace('/Remote violence', '').replace(' against civilians', '')),
        datasets: [{
          data:            typeCounts,
          backgroundColor: types.map(t => EVENT_TYPES[t].color),
          borderWidth:     0,
          hoverOffset:     4,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        cutout:              '45%',
        plugins: { legend: { display: false } },
      },
    })

    return () => chartInst.current?.destroy()
  }, [events])

  return (
    <div className="flex items-center gap-3">
      <div style={{ width: 80, height: 80, position: 'relative', flexShrink: 0 }}>
        <canvas ref={chartRef} />
      </div>
      <div className="flex flex-col gap-1">
        {Object.entries(EVENT_TYPES).map(([t, { color, label }]) => {
          const count = events.filter(e => e.type === t).length
          const pct   = Math.round((count / total) * 100)
          return (
            <div key={t} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
              <span className="text-[9px] text-[#9ca3af]">
                {label.substring(0, 9)} {pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── STRIKES CONTROL PANEL ─────────────────────────────────────
function StrikesPanel() {
  const allEvents = useStore(s => s.events)

  const [selectedCountry, setSelectedCountry] = useState('all')
  const [countryInput,    setCountryInput]    = useState('')
  const [suggestions,     setSuggestions]     = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [minFatalStr,     setMinFatalStr]     = useState(0)
  const [strikeType,      setStrikeType]      = useState('all')
  const [strikeTypeOpen,  setStrikeTypeOpen]  = useState(false)
  const [localDateFrom,   setLocalDateFrom]   = useState('2025-01-01')
  const [localDateTo,     setLocalDateTo]     = useState('2025-11-30')

  const strikeTypeRef = useRef(null)
  const countryRef    = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (strikeTypeRef.current && !strikeTypeRef.current.contains(e.target)) {
        setStrikeTypeOpen(false)
      }
      if (countryRef.current && !countryRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const STRIKE_SUBTYPES = [
    'air/drone strike',
    'shelling/artillery/missile attack',
    'remote explosive/landmine/ied',
  ]

  const STRIKE_TYPE_OPTIONS = [
    { id: 'all',       label: 'All Strikes'          },
    { id: 'drone',     label: 'Drone / Air'          },
    { id: 'shelling',  label: 'Shelling / Artillery' },
    { id: 'explosive', label: 'IED / Explosive'      },
  ]

  const allStrikes = allEvents.filter(ev => {
    if (ev.type !== 'Explosions/Remote violence') return false
    const sub = (ev.subtype || '').toLowerCase()
    return STRIKE_SUBTYPES.some(s => sub.includes(s.split('/')[0]))
  })

  function matchesCountry(ev, country) {
    if (country === 'all') return true
    const actorMatch   = (ev.actor   || '').toLowerCase().includes(country.toLowerCase())
    const countryMatch = (ev.country || '').toLowerCase() === country.toLowerCase()
    return actorMatch || countryMatch
  }

  const previewStrikes = allStrikes.filter(ev => {
    if (new Date(ev.date) < new Date(localDateFrom)) return false
    if (new Date(ev.date) > new Date(localDateTo))   return false
    if (!matchesCountry(ev, selectedCountry))        return false
    if ((parseInt(ev.fatal) || 0) < minFatalStr)     return false
    if (strikeType !== 'all') {
      const sub = (ev.subtype || '').toLowerCase()
      if (!sub.includes(strikeType)) return false
    }
    return true
  })

  const totalStrikes = previewStrikes.length
  const totalFatal   = previewStrikes.reduce((s, e) => s + (parseInt(e.fatal) || 0), 0)

  const countryCounts = previewStrikes.reduce((acc, e) => {
    acc[e.country] = (acc[e.country] || 0) + 1
    return acc
  }, {})
  const topCountry = Object.entries(countryCounts).sort((a, b) => b[1] - a[1])[0]

  const targetCountries = [...new Set(allStrikes.map(e => e.country))]
  const actorCountries  = [
    'Israel', 'Russia', 'Ukraine', 'Yemen', 'Myanmar',
    'Sudan', 'Pakistan', 'Afghanistan', 'Iran', 'Saudi Arabia',
  ]
  const allCountries = [...new Set([...targetCountries, ...actorCountries])].sort()

  function handleCountryInput(val) {
    setCountryInput(val)
    if (val.trim().length === 0) {
      setSuggestions([])
      setShowSuggestions(false)
      setSelectedCountry('all')
      return
    }
    const filtered = allCountries.filter(c =>
      c.toLowerCase().startsWith(val.toLowerCase())
    )
    setSuggestions(filtered.slice(0, 6))
    setShowSuggestions(true)
  }

  function handleSelectCountry(country) {
    setSelectedCountry(country)
    setCountryInput(country)
    setSuggestions([])
    setShowSuggestions(false)
  }

  function handleClearCountry() {
    setSelectedCountry('all')
    setCountryInput('')
    setSuggestions([])
    setShowSuggestions(false)
  }

  function handleApply() {
    const filtered = allStrikes.filter(ev => {
      if (new Date(ev.date) < new Date(localDateFrom)) return false
      if (new Date(ev.date) > new Date(localDateTo))   return false
      if (!matchesCountry(ev, selectedCountry))        return false
      if ((parseInt(ev.fatal) || 0) < minFatalStr)     return false
      if (strikeType !== 'all') {
        const sub = (ev.subtype || '').toLowerCase()
        if (!sub.includes(strikeType)) return false
      }
      return true
    })
    useStore.setState({ filteredEvents: filtered })
  }

  function handleReset() {
    setSelectedCountry('all')
    setCountryInput('')
    setMinFatalStr(0)
    setStrikeType('all')
    setLocalDateFrom('2025-01-01')
    setLocalDateTo('2025-11-30')
    useStore.getState().applyFilters()
  }

  const activeStrikeLabel = STRIKE_TYPE_OPTIONS.find(t => t.id === strikeType)?.label || 'All Strikes'

  return (
    <div
      className="w-[220px] flex-shrink-0 bg-panel border-r border-border overflow-y-auto"
      style={{ height: '100%' }}
    >
      {/* Header */}
      <div className="p-3 border-b border-border bg-threat/5">
        <div className="text-[8px] tracking-[2.5px] text-threat mb-1">STRIKE MONITOR</div>
        <div className="text-[10px] text-muted">Missile · Drone · Artillery</div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 border-b border-border">
        <div className="p-3 border-r border-border text-center">
          <div className="text-lg font-bold text-threat">{totalStrikes}</div>
          <div className="text-[8px] text-muted tracking-widest">STRIKES</div>
        </div>
        <div className="p-3 text-center">
          <div className="text-lg font-bold text-orange-400">{totalFatal}</div>
          <div className="text-[8px] text-muted tracking-widest">KILLED</div>
        </div>
      </div>

      {/* Top country */}
      {topCountry && (
        <div className="p-3 border-b border-border">
          <div className="text-[8px] text-muted tracking-widest mb-1">
            {selectedCountry === 'all' ? 'MOST HIT COUNTRY' : 'FILTERED BY'}
          </div>
          <div className="flex items-center justify-between">
            <div className="text-[12px] text-white">{topCountry[0]}</div>
            <div className="text-[10px] text-threat font-bold">{topCountry[1]} strikes</div>
          </div>
        </div>
      )}

      {/* Date range */}
      <div className="p-2.5 border-b border-border">
        <div className="text-[10px] tracking-[2.5px] text-muted mb-2">DATE RANGE</div>
        <div className="flex flex-col gap-1.5">
          <input type="date" value={localDateFrom}
            onChange={e => setLocalDateFrom(e.target.value)}
            className="bg-panel2 border border-border2 text-[#c9d1d9] font-mono text-[10px] px-2 py-1 rounded focus:outline-none focus:border-threat"
          />
          <input type="date" value={localDateTo}
            onChange={e => setLocalDateTo(e.target.value)}
            className="bg-panel2 border border-border2 text-[#c9d1d9] font-mono text-[10px] px-2 py-1 rounded focus:outline-none focus:border-threat"
          />
        </div>
      </div>

      {/* Country search */}
      <div className="p-2.5 border-b border-border" ref={countryRef}>
        <div className="text-[10px] tracking-[2.5px] text-muted mb-2">TARGET OR ORIGIN COUNTRY</div>
        <div className="relative">
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={countryInput}
              onChange={e => handleCountryInput(e.target.value)}
              onFocus={() => countryInput && setShowSuggestions(true)}
              placeholder="Type country name..."
              className="flex-1 bg-panel2 border border-border2 text-[#c9d1d9] font-mono text-[10px] px-2 py-1.5 rounded focus:outline-none focus:border-threat placeholder-muted"
            />
            {countryInput && (
              <button onClick={handleClearCountry}
                className="text-muted hover:text-white text-[12px] px-1">✕</button>
            )}
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d1117] border border-border2 rounded z-[600] overflow-hidden shadow-xl">
              {suggestions.map(c => (
                <button key={c} onClick={() => handleSelectCountry(c)}
                  className="w-full px-2 py-1.5 text-[10px] font-mono text-left text-muted hover:bg-white/5 hover:text-white transition-colors">
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedCountry !== 'all' && (
          <div className="mt-1.5 flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-threat flex-shrink-0" />
            <div className="text-[9px] text-threat font-mono">Filtering: {selectedCountry}</div>
          </div>
        )}
      </div>

      {/* Strike type dropdown */}
      <div className="p-2.5 border-b border-border" ref={strikeTypeRef}>
        <div className="text-[10px] tracking-[2.5px] text-muted mb-2">STRIKE TYPE</div>
        <div className="relative">
          <button
            onClick={() => setStrikeTypeOpen(o => !o)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded border border-border2 bg-panel2 text-[10px] font-mono text-left hover:border-threat/50 transition-all"
          >
            <span className="flex-1 text-white">{activeStrikeLabel}</span>
            <span className="text-muted">{strikeTypeOpen ? '▲' : '▼'}</span>
          </button>
          {strikeTypeOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d1117] border border-border2 rounded z-[600] overflow-hidden shadow-xl">
              {STRIKE_TYPE_OPTIONS.map(t => (
                <button key={t.id}
                  onClick={() => { setStrikeType(t.id); setStrikeTypeOpen(false) }}
                  className={`w-full px-2 py-1.5 text-[10px] font-mono text-left hover:bg-white/5 transition-colors
                    ${strikeType === t.id ? 'bg-threat/10 text-white' : 'text-muted'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Min fatalities
      <div className="p-2.5 border-b border-border">
        <div className="flex justify-between mb-1.5">
          <div className="text-[8px] tracking-[2.5px] text-muted">MIN FATALITIES</div>
          <div className="text-[10px] text-threat font-bold">{minFatalStr}</div>
        </div>
        <input type="range" min="0" max="50" step="1" value={minFatalStr}
          onChange={e => setMinFatalStr(parseInt(e.target.value))}
          className="w-full accent-threat"
        />
      </div> */}

      {/* Apply + Reset */}
      <div className="p-2.5 flex flex-col gap-2">
        <button onClick={handleApply}
          className="w-full py-1.5 bg-threat/15 border border-threat/50 text-threat font-mono text-[9px] tracking-widest rounded hover:bg-threat/25 transition-all">
          APPLY FILTERS
        </button>
        <button onClick={handleReset}
          className="w-full py-1.5 bg-transparent border border-border2 text-muted font-mono text-[9px] tracking-widest rounded hover:border-threat hover:text-threat transition-all">
          RESET
        </button>
      </div>

    </div>
  )
}

function FilterBtn({ label, count, color, active, onClick, dataType }) {
  return (
    <button
      onClick={onClick}
      data-type={dataType}
      className={`flex items-center gap-2 px-2 py-1.5 rounded border text-[10px] font-mono text-left w-full transition-all
        ${active
          ? 'border-threat bg-threat/10 text-white'
          : 'border-border2 text-[#9ca3af] hover:border-threat/50'
        }`}
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="flex-1">{label}</span>
      <span className="text-muted text-[9px]">{count}</span>
    </button>
  )
}