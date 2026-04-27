/**
 * StrikesPanel — Strike monitor sidebar mode.
 *
 * Shown when layers.strikeArcs is enabled.
 * Filters UCDP strike events (explosions/battles with strike subtypes).
 * Extracted from legacy Sidebar.jsx.
 */
import { useState, useRef, useEffect } from 'react'
import useStore from '../../store/useStore'

function today()    { return new Date().toISOString().split('T')[0] }
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

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

export default function StrikesPanel() {
  const allEvents = useStore(s => s.events)

  const [selectedCountry, setSelectedCountry] = useState('all')
  const [countryInput,    setCountryInput]    = useState('')
  const [suggestions,     setSuggestions]     = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [minFatalStr,     setMinFatalStr]     = useState(0)
  const [strikeType,      setStrikeType]      = useState('all')
  const [strikeTypeOpen,  setStrikeTypeOpen]  = useState(false)
  const [localDateFrom,   setLocalDateFrom]   = useState(daysAgo(90))
  const [localDateTo,     setLocalDateTo]     = useState(today())

  const strikeTypeRef = useRef(null)
  const countryRef    = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (strikeTypeRef.current && !strikeTypeRef.current.contains(e.target)) setStrikeTypeOpen(false)
      if (countryRef.current    && !countryRef.current.contains(e.target))    setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const allStrikes = allEvents.filter(ev => {
    if (ev.type !== 'explosion' && ev.type !== 'battle') return false
    const sub = (ev.subtype || '').toLowerCase()
    return STRIKE_SUBTYPES.some(s => sub.includes(s.split('/')[0]))
  })

  function matchesCountry(ev, country) {
    if (country === 'all') return true
    const actorMatch   = (ev.actor1  || '').toLowerCase().includes(country.toLowerCase())
    const countryMatch = (ev.country || '').toLowerCase() === country.toLowerCase()
    return actorMatch || countryMatch
  }

  const previewStrikes = allStrikes.filter(ev => {
    if (new Date(ev.date) < new Date(localDateFrom)) return false
    if (new Date(ev.date) > new Date(localDateTo))   return false
    if (!matchesCountry(ev, selectedCountry))              return false
    if ((parseInt(ev.fatalities) || 0) < minFatalStr)     return false
    if (strikeType !== 'all') {
      const sub = (ev.subtype || '').toLowerCase()
      if (!sub.includes(strikeType)) return false
    }
    return true
  })

  const totalFatal = previewStrikes.reduce((s, e) => s + (parseInt(e.fatalities) || 0), 0)

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
    if (!val.trim()) {
      setSuggestions([]); setShowSuggestions(false); setSelectedCountry('all'); return
    }
    setSuggestions(allCountries.filter(c => c.toLowerCase().startsWith(val.toLowerCase())).slice(0, 6))
    setShowSuggestions(true)
  }

  function handleSelectCountry(country) {
    setSelectedCountry(country); setCountryInput(country)
    setSuggestions([]); setShowSuggestions(false)
  }

  function handleApply() {
    const filtered = allStrikes.filter(ev => {
      if (new Date(ev.date) < new Date(localDateFrom)) return false
      if (new Date(ev.date) > new Date(localDateTo))   return false
      if (!matchesCountry(ev, selectedCountry))              return false
      if ((parseInt(ev.fatalities) || 0) < minFatalStr)     return false
      if (strikeType !== 'all') {
        const sub = (ev.subtype || '').toLowerCase()
        if (!sub.includes(strikeType)) return false
      }
      return true
    })
    useStore.setState({ filteredEvents: filtered })
  }

  function handleReset() {
    setSelectedCountry('all'); setCountryInput('')
    setMinFatalStr(0); setStrikeType('all')
    setLocalDateFrom(daysAgo(90)); setLocalDateTo(today())
    useStore.getState().applyFilters()
  }

  const activeStrikeLabel = STRIKE_TYPE_OPTIONS.find(t => t.id === strikeType)?.label || 'All Strikes'

  const s = {
    container: {
      width: 360, height: '100%',
      background: '#0d1117',
      borderRight: '0.5px solid #1f2937',
      overflowY: 'auto',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'DM Sans', sans-serif",
    },
    sectionHdr: {
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 9, letterSpacing: '2px', color: '#4b5563',
      textTransform: 'uppercase', marginBottom: 8,
    },
    input: {
      background: '#111827', border: '0.5px solid #1f2937',
      color: '#c9d1d9', fontFamily: "'JetBrains Mono', monospace",
      fontSize: 10, padding: '6px 8px', borderRadius: 4,
      outline: 'none', width: '100%', boxSizing: 'border-box',
    },
    section: { padding: '12px 16px', borderBottom: '0.5px solid #1f2937' },
  }

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={{ ...s.section, background: 'rgba(239,68,68,0.05)' }}>
        <div style={{ ...s.sectionHdr, color: '#ef4444' }}>Strike Monitor</div>
        <div style={{ fontSize: 10, color: '#6b7280' }}>Missile · Drone · Artillery</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '0.5px solid #1f2937' }}>
        <div style={{ padding: '12px', textAlign: 'center', borderRight: '0.5px solid #1f2937' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: '#ef4444' }}>
            {previewStrikes.length}
          </div>
          <div style={{ ...s.sectionHdr, marginBottom: 0, marginTop: 2 }}>STRIKES</div>
        </div>
        <div style={{ padding: '12px', textAlign: 'center' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: '#f97316' }}>
            {totalFatal}
          </div>
          <div style={{ ...s.sectionHdr, marginBottom: 0, marginTop: 2 }}>KILLED</div>
        </div>
      </div>

      {/* Top country */}
      {topCountry && (
        <div style={s.section}>
          <div style={s.sectionHdr}>{selectedCountry === 'all' ? 'Most Hit Country' : 'Filtered By'}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#e2e8f0', fontSize: 13 }}>{topCountry[0]}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#ef4444', fontWeight: 700 }}>
              {topCountry[1]} strikes
            </span>
          </div>
        </div>
      )}

      {/* Date range */}
      <div style={s.section}>
        <div style={s.sectionHdr}>Date Range</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input type="date" value={localDateFrom} onChange={e => setLocalDateFrom(e.target.value)} style={s.input} />
          <input type="date" value={localDateTo}   onChange={e => setLocalDateTo(e.target.value)}   style={s.input} />
        </div>
      </div>

      {/* Country search */}
      <div style={s.section} ref={countryRef}>
        <div style={s.sectionHdr}>Target / Origin Country</div>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text" value={countryInput}
              onChange={e => handleCountryInput(e.target.value)}
              onFocus={() => countryInput && setShowSuggestions(true)}
              placeholder="Type country..."
              style={{ ...s.input, flex: 1 }}
            />
            {countryInput && (
              <button onClick={() => { setSelectedCountry('all'); setCountryInput(''); setSuggestions([]); setShowSuggestions(false) }}
                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 14 }}>✕</button>
            )}
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 2,
              background: '#0d1117', border: '0.5px solid #1f2937', borderRadius: 4,
              zIndex: 600, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            }}>
              {suggestions.map(c => (
                <button key={c} onClick={() => handleSelectCountry(c)}
                  style={{
                    width: '100%', padding: '7px 10px',
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                    textAlign: 'left', background: 'none', border: 'none',
                    color: '#9ca3af', cursor: 'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Strike type */}
      <div style={s.section} ref={strikeTypeRef}>
        <div style={s.sectionHdr}>Strike Type</div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setStrikeTypeOpen(o => !o)}
            style={{
              ...s.input, display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', cursor: 'pointer',
            }}>
            <span style={{ color: '#e2e8f0' }}>{activeStrikeLabel}</span>
            <span style={{ color: '#6b7280' }}>{strikeTypeOpen ? '▲' : '▼'}</span>
          </button>
          {strikeTypeOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 2,
              background: '#0d1117', border: '0.5px solid #1f2937', borderRadius: 4,
              zIndex: 600, overflow: 'hidden',
            }}>
              {STRIKE_TYPE_OPTIONS.map(t => (
                <button key={t.id} onClick={() => { setStrikeType(t.id); setStrikeTypeOpen(false) }}
                  style={{
                    width: '100%', padding: '7px 10px',
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                    textAlign: 'left', background: strikeType === t.id ? 'rgba(239,68,68,0.08)' : 'none',
                    border: 'none', color: strikeType === t.id ? '#ef4444' : '#9ca3af', cursor: 'pointer',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Apply + Reset */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={handleApply}
          style={{
            padding: '8px', background: 'rgba(239,68,68,0.1)',
            border: '0.5px solid rgba(239,68,68,0.4)',
            color: '#ef4444', fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9, letterSpacing: '2px', borderRadius: 4, cursor: 'pointer',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.18)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
        >
          APPLY FILTERS
        </button>
        <button onClick={handleReset}
          style={{
            padding: '8px', background: 'none',
            border: '0.5px solid #1f2937',
            color: '#6b7280', fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9, letterSpacing: '2px', borderRadius: 4, cursor: 'pointer',
          }}>
          RESET
        </button>
      </div>
    </div>
  )
}
