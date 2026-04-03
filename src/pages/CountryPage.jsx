import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import Chart from 'chart.js/auto'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { getEventColor } from '../utils/constants'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const API = 'http://localhost:3001/api/events'

export default function CountryPage() {
  const { name }    = useParams()
  const navigate    = useNavigate()
  const mapRef      = useRef(null)
  const mapInstance = useRef(null)
  const chartRef    = useRef(null)
  const chartInst   = useRef(null)

  const country = decodeURIComponent(name)

  const [events,  setEvents]  = useState([])
  const [loading, setLoading] = useState(true)

  // ── Fetch all-time data for this country from Postgres ───────────────────
  useEffect(() => {
    setLoading(true)
    fetch(`${API}?country=${encodeURIComponent(country)}`)
      .then(r => r.json())
      .then(data => {
        if (data.status === 200) setEvents(data.events)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [country])

  // ── Stats ────────────────────────────────────────────────────────────────
  const total      = events.length
  const fatal      = events.reduce((s, e) => s + (parseInt(e.fatal) || 0), 0)
  const riskScore  = Math.min(99, Math.round(total * 0.4 + fatal * 0.3))
  const riskColor  = riskScore > 70 ? '#ff2a2a' : riskScore > 50 ? '#f97316' : '#fbbf24'
  const typeCounts = {}
  const actorCounts = {}
  events.forEach(e => {
    typeCounts[e.type]   = (typeCounts[e.type]   || 0) + 1
    actorCounts[e.actor] = (actorCounts[e.actor] || 0) + 1
  })
  const topActors = Object.entries(actorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // ── Init Mapbox ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    const map = new mapboxgl.Map({
      container:  mapRef.current,
      style:      'mapbox://styles/mapbox/dark-v11',
      center:     [0, 20],
      zoom:       2,
      projection: 'globe',
      antialias:  true,
    })

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left')

    map.on('style.load', () => {
      map.setFog({
        color:           'rgb(4,9,20)',
        'high-color':    'rgb(10,20,40)',
        'horizon-blend': 0.02,
        'space-color':   'rgb(2,4,10)',
        'star-intensity': 0.6,
      })
    })

    mapInstance.current = map
    return () => { map.remove(); mapInstance.current = null }
  }, [])

  // ── Render events on map when data loads ─────────────────────────────────
  useEffect(() => {
    const map = mapInstance.current
    if (!map || events.length === 0) return

    const tryRender = () => {
      if (!map.isStyleLoaded()) { setTimeout(tryRender, 100); return }

      // Cleanup old layers
      ['country-glow', 'country-markers'].forEach(id => {
        if (map.getLayer(id))   map.removeLayer(id)
      })
      if (map.getSource('country-events')) map.removeSource('country-events')

      const validEvents = events.filter(e => e.lat && e.lng && !isNaN(e.lat) && !isNaN(e.lng))

      const geojson = {
        type: 'FeatureCollection',
        features: validEvents.map(e => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
          properties: {
            color:  getEventColor(e.type),
            radius: Math.max(4, Math.min(18, 4 + (e.fatal || 0) * 0.3)),
            type:   e.type,
            location: e.location,
            actor:  e.actor || '',
            date:   e.date,
            fatal:  e.fatal || 0,
            notes:  e.notes || '',
          },
        })),
      }

      map.addSource('country-events', { type: 'geojson', data: geojson })

      map.addLayer({
        id: 'country-glow', type: 'circle', source: 'country-events',
        paint: {
          'circle-radius':  ['*', ['get', 'radius'], 2.2],
          'circle-color':   ['get', 'color'],
          'circle-opacity': 0.15,
          'circle-blur':    1.2,
        },
      })

      map.addLayer({
        id: 'country-markers', type: 'circle', source: 'country-events',
        paint: {
          'circle-radius':         ['get', 'radius'],
          'circle-color':          ['get', 'color'],
          'circle-opacity':        0.8,
          'circle-stroke-width':   1.5,
          'circle-stroke-color':   ['get', 'color'],
          'circle-stroke-opacity': 0.9,
        },
      })

      // Popup on hover
      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12 })

      map.on('mouseenter', 'country-markers', e => {
        map.getCanvas().style.cursor = 'pointer'
        const p = e.features[0].properties
        popup.setLngLat(e.features[0].geometry.coordinates)
          .setHTML(`
            <div style="min-width:180px;font-family:'Share Tech Mono',monospace">
              <div style="color:${p.color};font-size:9px;letter-spacing:2px;margin-bottom:4px">${p.type.toUpperCase()}</div>
              <div style="color:#fff;font-size:13px;font-family:'Oswald',sans-serif;margin-bottom:6px">${p.location}</div>
              <div style="color:#6b7280;font-size:10px;margin-bottom:2px">📅 ${p.date?.substring(0,10)}</div>
              <div style="color:#6b7280;font-size:10px;margin-bottom:2px">👥 ${(p.actor||'').substring(0,30)}</div>
              <div style="color:#ff2a2a;font-size:10px">💀 ${p.fatal} fatalities</div>
              ${p.notes ? `<div style="color:#6b7280;font-size:9px;margin-top:4px;max-width:200px">${p.notes.substring(0,80)}...</div>` : ''}
            </div>
          `)
          .addTo(map)
      })
      map.on('mouseleave', 'country-markers', () => {
        map.getCanvas().style.cursor = ''
        popup.remove()
      })

      // Fit map to events
      if (validEvents.length > 0) {
        const lngs = validEvents.map(e => e.lng)
        const lats = validEvents.map(e => e.lat)
        map.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 60, maxZoom: 8, duration: 1200 }
        )
      }
    }

    tryRender()
  }, [events])

  // ── Fatality chart ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current || events.length === 0) return
    if (chartInst.current) chartInst.current.destroy()

    const monthly = {}
    events.forEach(e => {
      const month = e.date?.substring(0, 7)
      if (month) monthly[month] = (monthly[month] || 0) + (parseInt(e.fatal) || 0)
    })
    const labels = Object.keys(monthly).sort()
    const data   = labels.map(l => monthly[l])

    chartInst.current = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ data, backgroundColor: '#ff2a2a66', borderColor: '#ff2a2a', borderWidth: 1, borderRadius: 2 }],
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
  }, [events])

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
          RISK {riskScore}
        </div>
        <div className="bg-threat/10 border border-threat/30 px-3 py-1 rounded text-[10px] text-threat font-mono">
          {loading ? '...' : `${total.toLocaleString()} EVENTS`}
        </div>
        <div className="bg-orange-400/10 border border-orange-400/30 px-3 py-1 rounded text-[10px] text-orange-400 font-mono">
          {fatal.toLocaleString()} FATALITIES
        </div>
        <div className="ml-auto text-[9px] text-muted font-mono">ALL TIME DATA</div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-dark/80">
              <div className="text-threat font-mono text-sm animate-pulse">LOADING {country.toUpperCase()}...</div>
            </div>
          )}
          {!loading && events.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-muted font-mono text-sm">No events found for {country}</div>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="w-[280px] flex-shrink-0 bg-panel border-l border-border flex flex-col overflow-y-auto">

          {/* Fatality chart */}
          <div className="p-4 border-b border-border">
            <div className="text-[8px] tracking-[2.5px] text-muted mb-3">FATALITIES BY MONTH</div>
            <div style={{ height: 100, position: 'relative' }}>
              <canvas ref={chartRef} />
            </div>
          </div>

          {/* Event breakdown */}
          <div className="p-4 border-b border-border">
            <div className="text-[8px] tracking-[2.5px] text-muted mb-3">EVENT BREAKDOWN</div>
            <div className="flex flex-col gap-2">
              {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                const color = getEventColor(type)
                const pct   = Math.round((count / total) * 100)
                return (
                  <div key={type}>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-[#9ca3af]">{type.replace('/Remote violence','').replace(' against civilians','')}</span>
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
          <div className="p-4 border-b border-border">
            <div className="text-[8px] tracking-[2.5px] text-muted mb-3">TOP ACTORS</div>
            <div className="flex flex-col gap-1">
              {topActors.map(([actor, count], i) => (
                <div key={actor}
                  className="flex items-center gap-2 py-1.5 border-b border-border/40 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => navigate(`/actor/${encodeURIComponent(actor)}`)}>
                  <span className="text-[9px] text-muted w-4">{i + 1}</span>
                  <span className="text-[11px] text-blue-400 hover:text-white transition-colors flex-1 leading-tight">{actor}</span>
                  <span className="text-[10px] text-threat font-bold">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent events list */}
          <div className="p-4">
            <div className="text-[8px] tracking-[2.5px] text-muted mb-3">
              RECENT EVENTS ({Math.min(events.length, 50)} of {total})
            </div>
            {[...events]
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .slice(0, 50)
              .map(ev => {
                const color = getEventColor(ev.type)
                return (
                  <div key={ev.id} className="p-2 bg-panel2 rounded border border-border/40 mb-2">
                    <div className="text-[8px] mb-1" style={{ color }}>{ev.type}</div>
                    <div className="text-[11px] text-white mb-1">{ev.location}</div>
                    <div className="flex justify-between text-[9px] mb-1">
                      <span className="text-muted">{ev.date?.substring(0, 10)}</span>
                      {ev.fatal > 0 && <span className="text-threat">💀 {ev.fatal}</span>}
                    </div>
                    <div
                      className="text-[10px] text-blue-400 cursor-pointer hover:text-white transition-colors mb-1"
                      onClick={() => navigate(`/actor/${encodeURIComponent(ev.actor)}`)}>
                      → {ev.actor}
                    </div>
                    {ev.notes && (
                      <div className="text-[9px] text-muted leading-relaxed">
                        {ev.notes.substring(0, 120)}
                      </div>
                    )}
                  </div>
                )
              })}
          </div>

        </div>
      </div>

      {/* Mapbox popup styles */}
      <style>{`
        .mapboxgl-popup-content {
          background: #06090e !important;
          border: 0.5px solid #1e2d3d !important;
          border-radius: 6px !important;
          padding: 10px 12px !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.6) !important;
        }
        .mapboxgl-popup-tip { border-top-color: #06090e !important; }
        .mapboxgl-ctrl-group { background: #06090e !important; border: 0.5px solid #1e2d3d !important; }
        .mapboxgl-ctrl-group button { background: transparent !important; }
        .mapboxgl-ctrl-icon { filter: invert(1) opacity(0.5); }
        .mapboxgl-ctrl-attrib { display: none; }
      `}</style>
    </div>
  )
}