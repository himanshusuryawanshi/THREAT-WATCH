import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Chart from 'chart.js/auto'
import { getEventColor } from '../utils/constants'
import useTimeframe from '../hooks/useTimeframe'

const API = 'http://localhost:3001/api'

// ── Per-country stats panel — fetches its own data ────────────────────────────
function CountryStats({ country, accentColor, tfQuery }) {
  const chartRef  = useRef(null)
  const chartInst = useRef(null)

  const [events,  setEvents]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!country) return
    setLoading(true)
    const params = new URLSearchParams({ country, source: 'ucdp', limit: 5000 })
    fetch(`${API}/events?${params}&${tfQuery}`)
      .then(r => r.json())
      .then(data => { if (data.events) setEvents(data.events) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [country, tfQuery])

  const fatal     = events.reduce((s, e) => s + (parseInt(e.fatalities) || 0), 0)
  const riskScore = Math.min(99, Math.round(events.length * 0.4 + fatal * 0.3))
  const riskColor = riskScore > 70 ? '#ff2a2a' : riskScore > 50 ? '#f97316' : '#fbbf24'

  const actors = {}
  events.forEach(e => { actors[e.actor1] = (actors[e.actor1] || 0) + 1 })
  const topActor = Object.entries(actors).sort((a, b) => b[1] - a[1])[0]

  const typeCounts = {}
  events.forEach(e => { typeCounts[e.type] = (typeCounts[e.type] || 0) + 1 })

  useEffect(() => {
    if (!chartRef.current || events.length === 0) return
    if (chartInst.current) chartInst.current.destroy()

    const monthly = {}
    events.forEach(e => {
      const month = e.date?.substring(0, 7)
      if (month) monthly[month] = (monthly[month] || 0) + (parseInt(e.fatalities) || 0)
    })
    const labels = Object.keys(monthly).sort()
    const data   = labels.map(l => monthly[l])

    chartInst.current = new Chart(chartRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor:          accentColor,
          backgroundColor:      accentColor + '22',
          fill:                 true,
          tension:              0.4,
          pointRadius:          2,
          pointBackgroundColor: accentColor,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#6b7280', font: { size: 8 } }, grid: { color: '#1a2030' } },
          y: { ticks: { color: '#6b7280', font: { size: 8 } }, grid: { color: '#1a2030' } },
        },
      },
    })
    return () => chartInst.current?.destroy()
  }, [events, accentColor])

  if (!country) return (
    <div className="flex-1 flex items-center justify-center text-muted text-sm">
      Select a country
    </div>
  )

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-muted font-mono text-sm animate-pulse">LOADING {country.toUpperCase()}...</div>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col gap-4 p-5 overflow-y-auto">

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-panel2 rounded p-3 text-center border border-border">
          <div className="text-xl font-bold text-threat">{events.length.toLocaleString()}</div>
          <div className="text-[8px] text-muted tracking-widest">EVENTS</div>
        </div>
        <div className="bg-panel2 rounded p-3 text-center border border-border">
          <div className="text-xl font-bold text-orange-400">{fatal.toLocaleString()}</div>
          <div className="text-[8px] text-muted tracking-widest">FATALITIES</div>
        </div>
        <div className="bg-panel2 rounded p-3 text-center border border-border">
          <div className="text-xl font-bold" style={{ color: riskColor }}>{riskScore}</div>
          <div className="text-[8px] text-muted tracking-widest">RISK SCORE</div>
        </div>
      </div>

      {/* Fatality trend */}
      <div className="bg-panel2 rounded p-4 border border-border">
        <div className="text-[8px] tracking-[2.5px] text-muted mb-3">FATALITY TREND</div>
        <div style={{ height: 100, position: 'relative' }}>
          <canvas ref={chartRef} />
        </div>
      </div>

      {/* Top actor */}
      {topActor && (
        <div className="bg-panel2 rounded p-4 border border-border">
          <div className="text-[8px] tracking-[2.5px] text-muted mb-2">TOP ACTOR</div>
          <div className="text-[13px] text-white">{topActor[0]}</div>
          <div className="text-[10px] text-muted">{topActor[1]} events</div>
        </div>
      )}

      {/* Event types */}
      <div className="bg-panel2 rounded p-4 border border-border">
        <div className="text-[8px] tracking-[2.5px] text-muted mb-3">EVENT TYPES</div>
        {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
          const color = getEventColor(type)
          const pct   = Math.round((count / events.length) * 100)
          return (
            <div key={type} className="mb-2">
              <div className="flex justify-between text-[9px] mb-1">
                <span className="text-muted">{type.replace('/Remote violence', '').replace(' against civilians', '')}</span>
                <span style={{ color }}>{pct}%</span>
              </div>
              <div className="h-1 bg-border2 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}

// ── Main compare page ─────────────────────────────────────────────────────────
export default function ComparePage() {
  const navigate = useNavigate()
  const { tfQuery, tfLabel } = useTimeframe()

  const [countries, setCountries] = useState([])
  const [countryA,  setCountryA]  = useState('Ukraine')
  const [countryB,  setCountryB]  = useState('Sudan')

  // Fetch country list from stats API — scoped to selected timeframe
  useEffect(() => {
    fetch(`${API}/events/stats?${tfQuery}`)
      .then(r => r.json())
      .then(data => {
        const list = (data.by_country || []).map(r => r.country).filter(Boolean).sort()
        if (list.length > 0) {
          setCountries(list)
          setCountryA(list[0])
          setCountryB(list[1] || list[0])
        }
      })
      .catch(() => {
        // Fallback to known conflict countries
        const fallback = [
          'Afghanistan','DR Congo (Zaire)','Ethiopia','India','Iraq',
          'Mali','Myanmar','Nigeria','Pakistan','Somalia',
          'Sudan','Syria','Ukraine','Yemen',
        ]
        setCountries(fallback)
      })
  }, [tfQuery])

  return (
    <div className="h-screen bg-dark flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-3 bg-[#06090e] border-b border-border flex-shrink-0">
        <button onClick={() => navigate('/')}
          className="text-[10px] text-muted border border-border2 px-3 py-1.5 rounded font-mono hover:border-threat hover:text-threat transition-all">
          ← BACK
        </button>
        <div className="font-oswald text-xl font-semibold tracking-widest text-white">
          COUNTRY COMPARE
        </div>
        <div className="text-[10px] text-muted ml-auto font-mono">
          {tfLabel.toUpperCase()} · UCDP
        </div>
      </div>

      {/* Compare columns */}
      <div className="flex flex-1 overflow-hidden">

        {/* Country A */}
        <div className="flex-1 flex flex-col border-r border-border overflow-hidden">
          <div className="p-3 bg-[#06090e] border-b border-border flex items-center gap-3">
            <select
              value={countryA}
              onChange={e => setCountryA(e.target.value)}
              className="flex-1 bg-panel2 border border-border2 text-white font-mono text-[11px] px-3 py-1.5 rounded focus:outline-none focus:border-blue-400"
            >
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="text-[10px] text-blue-400 font-bold tracking-widest">COUNTRY A</div>
          </div>
          <CountryStats country={countryA} accentColor="#38bdf8" tfQuery={tfQuery} />
        </div>

        {/* VS divider */}
        <div className="flex items-center justify-center w-12 bg-[#06090e] flex-shrink-0">
          <div className="font-oswald text-lg text-muted tracking-widest" style={{ writingMode: 'vertical-rl' }}>
            VS
          </div>
        </div>

        {/* Country B */}
        <div className="flex-1 flex flex-col border-l border-border overflow-hidden">
          <div className="p-3 bg-[#06090e] border-b border-border flex items-center gap-3">
            <div className="text-[10px] text-orange-400 font-bold tracking-widest">COUNTRY B</div>
            <select
              value={countryB}
              onChange={e => setCountryB(e.target.value)}
              className="flex-1 bg-panel2 border border-border2 text-white font-mono text-[11px] px-3 py-1.5 rounded focus:outline-none focus:border-orange-400"
            >
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <CountryStats country={countryB} accentColor="#f97316" tfQuery={tfQuery} />
        </div>

      </div>
    </div>
  )
}
