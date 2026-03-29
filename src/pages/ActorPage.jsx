import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import Chart from 'chart.js/auto'
import useStore from '../store/useStore'
import { getEventColor, getMarkerRadius } from '../utils/constants'

export default function ActorPage() {
  const { name }    = useParams()
  const navigate    = useNavigate()
  const mapRef      = useRef(null)
  const mapInstance = useRef(null)
  const chartRef    = useRef(null)
  const chartInst   = useRef(null)

  const actor  = decodeURIComponent(name)
  const allEvents = useStore(s => s.events)
  const events    = allEvents.filter(e => (e.actor || '').toLowerCase().includes(actor.toLowerCase()))
  const fatal  = events.reduce((s, e) => s + (parseInt(e.fatal) || 0), 0)

  const countries = {}
  events.forEach(e => { countries[e.country] = (countries[e.country] || 0) + 1 })
  const topCountries = Object.entries(countries).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const typeCounts = {}
  events.forEach(e => { typeCounts[e.type] = (typeCounts[e.type] || 0) + 1 })

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return
    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, subdomains: 'abcd',
    }).addTo(map)

    const bounds = []
    events.forEach(ev => {
      const color  = getEventColor(ev.type)
      const radius = getMarkerRadius(ev.fatal)
      L.circleMarker([ev.lat, ev.lng], {
        radius, fillColor: color, color,
        weight: 1.5, opacity: 0.9, fillOpacity: 0.6,
      }).bindPopup(`
        <div>
          <div style="color:${color};font-size:9px;letter-spacing:2px">${ev.type.toUpperCase()}</div>
          <div style="color:#fff;font-size:13px;font-family:'Oswald',sans-serif">${ev.location}, ${ev.country}</div>
          <div style="color:#6b7280;font-size:10px">💀 ${ev.fatal} fatalities</div>
        </div>
      `).addTo(map)
      bounds.push([ev.lat, ev.lng])
    })

    if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40] })
    else map.setView([20, 10], 2)

    mapInstance.current = map
    return () => { map.remove(); mapInstance.current = null }
  }, [actor])

  useEffect(() => {
    if (!chartRef.current) return
    if (chartInst.current) chartInst.current.destroy()

    const monthly = {}
    events.forEach(e => {
      const m = e.date.substring(0, 7)
      monthly[m] = (monthly[m] || 0) + 1
    })
    const labels = Object.keys(monthly).sort()
    const data   = labels.map(l => monthly[l])

    chartInst.current = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: '#ff2a2a88',
          borderColor: '#ff2a2a',
          borderWidth: 1,
          borderRadius: 2,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#6b7280', font: { size: 9 } }, grid: { color: '#1a2030' } },
          y: { ticks: { color: '#6b7280', font: { size: 9 } }, grid: { color: '#1a2030' } },
        },
      },
    })
    return () => chartInst.current?.destroy()
  }, [actor])

  return (
    <div className="h-screen bg-dark flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-3 bg-[#06090e] border-b border-border flex-shrink-0">
        <button onClick={() => navigate('/')}
          className="text-[10px] text-muted border border-border2 px-3 py-1.5 rounded font-mono hover:border-threat hover:text-threat transition-all">
          ← BACK
        </button>
        <div className="font-oswald text-xl font-semibold tracking-widest text-white">
          {actor.toUpperCase()}
        </div>
        <div className="bg-threat/10 border border-threat/30 px-3 py-1 rounded text-[10px] text-threat font-mono">
          {events.length} EVENTS
        </div>
        <div className="bg-orange-400/10 border border-orange-400/30 px-3 py-1 rounded text-[10px] text-orange-400 font-mono">
          {fatal} FATALITIES
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full" />
          {events.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-muted text-sm">
              No events found for {actor}
            </div>
          )}
        </div>

        {/* Info panel */}
        <div className="w-[280px] flex-shrink-0 bg-panel border-l border-border flex flex-col overflow-y-auto">

          {/* Activity chart */}
          <div className="p-4 border-b border-border">
            <div className="text-[8px] tracking-[2.5px] text-muted mb-3">ACTIVITY OVER TIME</div>
            <div style={{ height: 90, position: 'relative' }}>
              <canvas ref={chartRef} />
            </div>
          </div>

          {/* Top countries */}
          <div className="p-4 border-b border-border">
            <div className="text-[8px] tracking-[2.5px] text-muted mb-3">ACTIVE REGIONS</div>
            {topCountries.map(([country, count], i) => (
                <div
                    key={country}
                    className="flex items-center gap-2 py-1.5 border-b border-border/40 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => window.location.href = `/country/${encodeURIComponent(country)}`}
                >
                    <span className="text-[9px] text-muted w-4">{i + 1}</span>
                    <span className="text-[11px] text-blue-400 hover:text-white transition-colors flex-1">
                    {country}
                    </span>
                    <span className="text-[10px] text-threat font-bold">{count}</span>
                </div>
                ))}
          </div>

          {/* Event types */}
          <div className="p-4 border-b border-border">
            <div className="text-[8px] tracking-[2.5px] text-muted mb-3">TACTICS USED</div>
            {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
              const color = getEventColor(type)
              const pct   = Math.round((count / events.length) * 100)
              return (
                <div key={type} className="mb-2">
                  <div className="flex justify-between text-[9px] mb-1">
                    <span className="text-muted">{type.replace('/Remote violence', '').replace(' against civilians', '')}</span>
                    <span style={{ color }}>{count}</span>
                  </div>
                  <div className="h-1 bg-border2 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* All events */}
            <div className="p-4">
            <div className="text-[8px] tracking-[2.5px] text-muted mb-3">ALL EVENTS</div>
            {[...events].sort((a, b) => new Date(b.date) - new Date(a.date)).map(ev => {
                const color = getEventColor(ev.type)
                return (
                <div key={ev.id} className="p-2 bg-panel2 rounded border border-border/40 mb-2">
                    <div className="text-[8px] mb-1" style={{ color }}>{ev.type}</div>
                    <div className="text-[11px] text-white mb-1">{ev.location}</div>
                    <div className="flex justify-between text-[9px] mb-1">
                    <span className="text-muted">{ev.date}</span>
                    {ev.fatal > 0 && <span className="text-threat">💀 {ev.fatal}</span>}
                    </div>
                    <div
                    className="text-[10px] text-blue-400 cursor-pointer hover:text-white transition-colors mb-1"
                    onClick={() => window.location.href = `/country/${encodeURIComponent(ev.country)}`}
                    >
                    → {ev.country}
                    </div>
                    <div className="text-[9px] text-muted leading-relaxed">{ev.notes}</div>
                </div>
                )
            })}
            </div>

        </div>
      </div>
    </div>
  )
}