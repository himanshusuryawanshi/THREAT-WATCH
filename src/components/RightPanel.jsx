import { useEffect, useRef } from 'react'
import Chart from 'chart.js/auto'
import useStore from '../store/useStore'
import { EVENT_TYPES, getEventColor } from '../utils/constants'

export default function RightPanel() {
  const filteredEvents   = useStore(s => s.filteredEvents)
  const selectedEvent    = useStore(s => s.selectedEvent)
  const clearSelectedEvent = useStore(s => s.clearSelectedEvent)

  const countryRef  = useRef(null)
  const typeRef     = useRef(null)
  const countryChart = useRef(null)
  const typeChart    = useRef(null)

  useEffect(() => {
    // Country chart
    if (countryChart.current) countryChart.current.destroy()
    const countryCounts = {}
    filteredEvents.forEach(e => { countryCounts[e.country] = (countryCounts[e.country] || 0) + 1 })
    const top = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 6)
    const max = top[0]?.[1] || 1

    countryChart.current = new Chart(countryRef.current, {
      type: 'bar',
      data: {
        labels: top.map(([c]) => c),
        datasets: [{
          data: top.map(([, v]) => v),
          backgroundColor: top.map(([, v]) =>
            v / max > 0.8 ? '#ff2a2a' : v / max > 0.5 ? '#f97316' : '#1e3a4a'
          ),
          borderRadius: 2, barThickness: 8,
        }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#6b7280', font: { size: 9 } }, grid: { color: '#1a2030' } },
          y: { ticks: { color: '#9ca3af', font: { size: 9 } }, grid: { display: false } },
        },
      },
    })

    // Type donut
    if (typeChart.current) typeChart.current.destroy()
    const types  = Object.keys(EVENT_TYPES)
    const counts = types.map(t => filteredEvents.filter(e => e.type === t).length)

    typeChart.current = new Chart(typeRef.current, {
      type: 'doughnut',
      data: {
        labels: types.map(t => t.replace('/Remote violence', '').replace(' against civilians', '')),
        datasets: [{
          data: counts,
          backgroundColor: types.map(t => EVENT_TYPES[t].color),
          borderWidth: 0, hoverOffset: 4,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: { legend: { display: false } },
      },
    })

    return () => {
      countryChart.current?.destroy()
      typeChart.current?.destroy()
    }
  }, [filteredEvents])

  // Risk ranking
  const scores = {}
  filteredEvents.forEach(e => {
    if (!scores[e.country]) scores[e.country] = { events: 0, fatal: 0 }
    scores[e.country].events++
    scores[e.country].fatal += (parseInt(e.fatal) || 0)
  })
  const ranked = Object.entries(scores)
    .map(([c, s]) => ({ country: c, score: Math.min(99, Math.round(s.events * 0.4 + s.fatal * 0.3)) }))
    .sort((a, b) => b.score - a.score).slice(0, 5)

  return (
    <div className="w-[230px] flex-shrink-0 bg-panel border-l border-border flex flex-col overflow-hidden relative">

      {/* Detail panel overlay */}
      {selectedEvent && (
        <DetailPanel event={selectedEvent} onClose={clearSelectedEvent} />
      )}

      {/* Top countries */}
      <div className="p-2.5 border-b border-border flex-shrink-0">
        <div className="text-[8px] tracking-[2.5px] text-muted mb-2">TOP COUNTRIES</div>
        <div style={{ height: 120, position: 'relative' }}>
          <canvas ref={countryRef} />
        </div>
      </div>

      {/* Event types donut */}
      <div className="p-2.5 border-b border-border flex-shrink-0">
        <div className="text-[8px] tracking-[2.5px] text-muted mb-2">EVENT TYPES</div>
        <div className="flex items-center gap-3">
          <div style={{ width: 80, height: 80, position: 'relative', flexShrink: 0 }}>
            <canvas ref={typeRef} />
          </div>
          <div className="flex flex-col gap-1">
            {Object.entries(EVENT_TYPES).map(([t, { color, label }]) => {
              const count = filteredEvents.filter(e => e.type === t).length
              const pct   = filteredEvents.length ? Math.round(count / filteredEvents.length * 100) : 0
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
      </div>

      {/* Risk ranking */}
      <div className="p-2.5 flex-1 overflow-y-auto">
        <div className="text-[8px] tracking-[2.5px] text-muted mb-2">RISK RANKING</div>
        {ranked.map((r, i) => {
          const col = r.score > 70 ? '#ff2a2a' : r.score > 50 ? '#f97316' : '#fbbf24'
          return (
            <div key={r.country} className="flex items-center gap-2 py-1.5 border-b border-border/60">
              <span className="text-[9px] text-muted w-3">{i + 1}</span>
              <span className="text-[11px] text-[#e5e7eb] flex-1">{r.country}</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-[9px]"
                style={{ background: col + '22', color: col }}>
                {r.score}
              </span>
            </div>
          )
        })}
      </div>

    </div>
  )
}

function DetailPanel({ event, onClose }) {
  const color = getEventColor(event.type)
  const intensity = Math.min(100, (event.fatal / 35) * 100)

  return (
    <div className="absolute inset-0 bg-panel z-10 overflow-y-auto p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold tracking-widest px-2 py-0.5 rounded"
          style={{ background: color + '22', color, border: `0.5px solid ${color}55` }}>
          {event.type.toUpperCase()}
        </span>
        <button onClick={onClose}
          className="text-[10px] text-muted border border-border2 px-2 py-0.5 rounded hover:border-threat hover:text-threat transition-all font-mono">
          ✕ CLOSE
        </button>
      </div>

      <div className="font-oswald text-lg text-white tracking-wide leading-tight">
        {event.location}, {event.country}
      </div>

      {[
        ['DATE',       event.date],
        ['ACTOR',      event.actor],
        ['FATALITIES', event.fatal > 0 ? `${event.fatal} confirmed` : '0 (non-lethal)'],
      ].map(([k, v]) => (
        <div key={k} className="flex justify-between py-1 border-b border-border/50 text-[10px]">
          <span className="text-muted tracking-widest">{k}</span>
          <span className="text-[#c9d1d9] text-right max-w-[130px]"
            style={k === 'FATALITIES' && event.fatal > 0 ? { color: '#ff2a2a' } : {}}>
            {v}
          </span>
        </div>
      ))}

      {/* Intensity bar */}
      <div>
        <div className="text-[8px] text-muted tracking-widest mb-1">INTENSITY</div>
        <div className="h-1 bg-border2 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all"
            style={{
              width: `${intensity}%`,
              background: event.fatal > 20 ? '#ff2a2a' : event.fatal > 5 ? '#f97316' : '#fbbf24'
            }}
          />
        </div>
      </div>

      {/* Notes */}
      <div className="text-[10px] text-muted leading-relaxed p-2 bg-panel2 rounded">
        {event.notes}
      </div>

      {/* Media mentions */}
      {event.mentions && (
        <div className="text-center p-2 bg-blue-400/5 border border-blue-400/20 rounded">
          <div className="text-[#38bdf8] text-xl font-bold">{event.mentions.toLocaleString()}</div>
          <div className="text-[8px] text-muted tracking-widest">MEDIA MENTIONS</div>
        </div>
      )}
    </div>
  )
}