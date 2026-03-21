import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Chart from 'chart.js/auto'
import { useEffect, useRef } from 'react'
import EVENTS from '../data/events'
import { getEventColor } from '../utils/constants'

const COUNTRIES = [...new Set(EVENTS.map(e => e.country))].sort()

function CountryStats({ country }) {
  const chartRef = useRef(null)
  const chartInst = useRef(null)

  const events = EVENTS.filter(e => e.country === country)
  const fatal  = events.reduce((s, e) => s + (parseInt(e.fatal) || 0), 0)
  const actors = {}
  events.forEach(e => { actors[e.actor] = (actors[e.actor] || 0) + 1 })
  const topActor = Object.entries(actors).sort((a, b) => b[1] - a[1])[0]
  const riskScore = Math.min(99, Math.round(events.length * 0.4 + fatal * 0.3))
  const riskColor = riskScore > 70 ? '#ff2a2a' : riskScore > 50 ? '#f97316' : '#fbbf24'

  const typeCounts = {}
  events.forEach(e => { typeCounts[e.type] = (typeCounts[e.type] || 0) + 1 })

  useEffect(() => {
    if (!chartRef.current) return
    if (chartInst.current) chartInst.current.destroy()

    const monthly = {}
    events.forEach(e => {
      const month = e.date.substring(0, 7)
      monthly[month] = (monthly[month] || 0) + (parseInt(e.fatal) || 0)
    })
    const labels = Object.keys(monthly).sort()
    const data   = labels.map(l => monthly[l])

    chartInst.current = new Chart(chartRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: riskColor,
          backgroundColor: riskColor + '22',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: riskColor,
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
  }, [country])

  if (!country) return (
    <div className="flex-1 flex items-center justify-center text-muted text-sm">
      Select a country
    </div>
  )

  return (
    <div className="flex-1 flex flex-col gap-4 p-5 overflow-y-auto">

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-panel2 rounded p-3 text-center border border-border">
          <div className="text-xl font-bold text-threat">{events.length}</div>
          <div className="text-[8px] text-muted tracking-widest">EVENTS</div>
        </div>
        <div className="bg-panel2 rounded p-3 text-center border border-border">
          <div className="text-xl font-bold text-orange-400">{fatal}</div>
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

export default function ComparePage() {
  const navigate = useNavigate()
  const [countryA, setCountryA] = useState('Ukraine')
  const [countryB, setCountryB] = useState('Sudan')

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
        <div className="text-[10px] text-muted ml-auto">
          Select two countries to compare conflict data
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
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="text-[10px] text-blue-400 font-bold tracking-widest">COUNTRY A</div>
          </div>
          <CountryStats country={countryA} />
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
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <CountryStats country={countryB} />
        </div>

      </div>
    </div>
  )
}