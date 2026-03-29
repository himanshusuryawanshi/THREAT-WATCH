import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import Chart from 'chart.js/auto'
import L from 'leaflet'
import useStore from '../store/useStore'
import { getEventColor, getMarkerRadius } from '../utils/constants'

export default function CountryPage() {
  const { name }     = useParams()
  const navigate     = useNavigate()
  const mapRef       = useRef(null)
  const mapInstance  = useRef(null)
  const chartRef     = useRef(null)
  const chartInst    = useRef(null)

  const country = decodeURIComponent(name)
  const allEvents = useStore(s => s.events)
  const events    = allEvents.filter(e => e.country.toLowerCase() === country.toLowerCase())
  const total   = events.length
  const fatal   = events.reduce((s, e) => s + (parseInt(e.fatal) || 0), 0)
  const actors  = {}
  events.forEach(e => { actors[e.actor] = (actors[e.actor] || 0) + 1 })
  const topActors = Object.entries(actors).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const typeCounts = {}
  events.forEach(e => { typeCounts[e.type] = (typeCounts[e.type] || 0) + 1 })

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return
    const map = L.map(mapRef.current, {
    zoomControl: true,
    attributionControl: false,
    minZoom: 2,
    maxZoom: 12,
    })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, subdomains: 'abcd',
    }).addTo(map)

    if (events.length > 0) {
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
            <div style="color:#fff;font-size:13px;font-family:'Oswald',sans-serif">${ev.location}</div>
            <div style="color:#6b7280;font-size:10px">📅 ${ev.date}</div>
            <div style="color:#6b7280;font-size:10px">👥 ${ev.actor}</div>
            <div style="color:#ff2a2a;font-size:10px">💀 ${ev.fatal} fatalities</div>
        </div>
        `).addTo(map)
        bounds.push([ev.lat, ev.lng])
      })
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 })
    } else {
      map.setView([20, 10], 2)
    }

    mapInstance.current = map
    return () => { map.remove(); mapInstance.current = null }
  }, [country])

  // Fatality chart
  useEffect(() => {
    if (!chartRef.current) return
    if (chartInst.current) chartInst.current.destroy()

    // Group by month
    const monthly = {}
    events.forEach(e => {
      const month = e.date.substring(0, 7)
      monthly[month] = (monthly[month] || 0) + (parseInt(e.fatal) || 0)
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
  }, [country])

  const riskScore = Math.min(99, Math.round(total * 0.4 + fatal * 0.3))
  const riskColor = riskScore > 70 ? '#ff2a2a' : riskScore > 50 ? '#f97316' : '#fbbf24'

  return (
    <div className="h-screen bg-dark flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-3 bg-[#06090e] border-b border-border flex-shrink-0">
        <button onClick={() => navigate('/')}
          className="text-[10px] text-muted border border-border2 px-3 py-1.5 rounded font-mono hover:border-threat hover:text-threat transition-all">
          ← BACK
        </button>
        <div className="font-oswald text-2xl font-semibold tracking-widest text-white">
          {country.toUpperCase()}
        </div>
        <div className="px-3 py-1 rounded text-[10px] font-bold tracking-widest"
          style={{ background: riskColor + '22', color: riskColor, border: `0.5px solid ${riskColor}55` }}>
          RISK SCORE {riskScore}
        </div>
        <div className="bg-threat/10 border border-threat/30 px-3 py-1 rounded text-[10px] text-threat font-mono">
          {total} EVENTS
        </div>
        <div className="bg-orange-400/10 border border-orange-400/30 px-3 py-1 rounded text-[10px] text-orange-400 font-mono">
          {fatal} FATALITIES
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full" />
          {events.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-muted text-sm">No events found for {country}</div>
            </div>
          )}
        </div>

        {/* Right info panel */}
        <div className="w-[280px] flex-shrink-0 bg-panel border-l border-border flex flex-col overflow-y-auto">

          {/* Fatality chart */}
          <div className="p-4 border-b border-border">
            <div className="text-[8px] tracking-[2.5px] text-muted mb-3">FATALITIES BY MONTH</div>
            <div style={{ height: 100, position: 'relative' }}>
              <canvas ref={chartRef} />
            </div>
          </div>

          {/* Event type breakdown */}
          <div className="p-4 border-b border-border">
            <div className="text-[8px] tracking-[2.5px] text-muted mb-3">EVENT BREAKDOWN</div>
            <div className="flex flex-col gap-2">
              {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                const color = getEventColor(type)
                const pct   = Math.round((count / total) * 100)
                return (
                  <div key={type}>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-[#9ca3af]">{type.replace('/Remote violence', '').replace(' against civilians', '')}</span>
                      <span style={{ color }}>{count}</span>
                    </div>
                    <div className="h-1.5 bg-border2 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top actors */}
          <div className="flex flex-col gap-2">
            {topActors.map(([actor, count], i) => (
                <div
                key={actor}
                className="flex items-center gap-2 py-1.5 border-b border-border/40 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => window.location.href = `/actor/${encodeURIComponent(actor)}`}
                >
                <span className="text-[9px] text-muted w-4">{i + 1}</span>
                <span className="text-[11px] text-blue-400 hover:text-white transition-colors flex-1 leading-tight">
                    {actor}
                </span>
                <span className="text-[10px] text-threat font-bold">{count}</span>
                </div>
            ))}
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
                    onClick={() => window.location.href = `/actor/${encodeURIComponent(ev.actor)}`}
                    >
                    → {ev.actor}
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