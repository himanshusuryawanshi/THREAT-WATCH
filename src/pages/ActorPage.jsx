import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import Chart from 'chart.js/auto'
import { getEventColor, getMarkerRadius } from '../utils/constants'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const API = 'http://localhost:3001/api/events'

export default function ActorPage() {
  const { name }    = useParams()
  const navigate    = useNavigate()
  const mapRef      = useRef(null)
  const mapInstance = useRef(null)
  const chartRef    = useRef(null)
  const chartInst   = useRef(null)

  const actor = decodeURIComponent(name)

  const [events,  setEvents]  = useState([])
  const [loading, setLoading] = useState(true)

  // ── Fetch all events for this actor from Postgres ─────────────────────────
  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ actor, source: 'ucdp', limit: 5000 })
    fetch(`${API}?${params}`)
      .then(r => r.json())
      .then(data => { if (data.events) setEvents(data.events) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [actor])

  // ── Derived stats ─────────────────────────────────────────────────────────
  const fatal = events.reduce((s, e) => s + (parseInt(e.fatalities) || 0), 0)

  const countries = {}
  events.forEach(e => { countries[e.country] = (countries[e.country] || 0) + 1 })
  const topCountries = Object.entries(countries).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const typeCounts = {}
  events.forEach(e => { typeCounts[e.type] = (typeCounts[e.type] || 0) + 1 })

  // ── Init Mapbox ───────────────────────────────────────────────────────────
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

  // ── Render events on map when data loads ──────────────────────────────────
  useEffect(() => {
    const map = mapInstance.current
    if (!map || events.length === 0) return

    const tryRender = () => {
      if (!map.isStyleLoaded()) { setTimeout(tryRender, 100); return }

      ;['actor-glow', 'actor-markers'].forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id)
      })
      if (map.getSource('actor-events')) map.removeSource('actor-events')

      const valid = events.filter(e => e.lat && e.lng && !isNaN(e.lat) && !isNaN(e.lng))

      map.addSource('actor-events', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: valid.map(e => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [parseFloat(e.lng), parseFloat(e.lat)] },
            properties: {
              color:      getEventColor(e.type),
              radius:     Math.max(4, Math.min(16, 4 + (parseInt(e.fatalities) || 0) * 0.3)),
              type:       e.type,
              location:   e.location,
              actor1:     e.actor1 || '',
              date:       e.date,
              fatalities: e.fatalities || 0,
              notes:      e.notes || '',
            },
          })),
        },
      })

      map.addLayer({
        id: 'actor-glow', type: 'circle', source: 'actor-events',
        paint: {
          'circle-radius':  ['*', ['get', 'radius'], 2.2],
          'circle-color':   ['get', 'color'],
          'circle-opacity': 0.12,
          'circle-blur':    1.2,
        },
      })

      map.addLayer({
        id: 'actor-markers', type: 'circle', source: 'actor-events',
        paint: {
          'circle-radius':         ['get', 'radius'],
          'circle-color':          ['get', 'color'],
          'circle-opacity':        0.8,
          'circle-stroke-width':   1.5,
          'circle-stroke-color':   ['get', 'color'],
          'circle-stroke-opacity': 0.9,
        },
      })

      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12 })

      map.on('mouseenter', 'actor-markers', e => {
        map.getCanvas().style.cursor = 'pointer'
        const p = e.features[0].properties
        popup.setLngLat(e.features[0].geometry.coordinates)
          .setHTML(`
            <div style="min-width:180px;font-family:'Share Tech Mono',monospace">
              <div style="color:${p.color};font-size:9px;letter-spacing:2px;margin-bottom:4px">${p.type.toUpperCase()}</div>
              <div style="color:#fff;font-size:13px;font-family:'Oswald',sans-serif;margin-bottom:6px">${p.location}</div>
              <div style="color:#6b7280;font-size:10px;margin-bottom:2px">📅 ${p.date?.substring(0,10)}</div>
              <div style="color:#ff2a2a;font-size:10px">💀 ${p.fatalities} fatalities</div>
              ${p.notes ? `<div style="color:#6b7280;font-size:9px;margin-top:4px">${p.notes.substring(0,80)}...</div>` : ''}
            </div>
          `)
          .addTo(map)
      })
      map.on('mouseleave', 'actor-markers', () => {
        map.getCanvas().style.cursor = ''
        popup.remove()
      })

      if (valid.length > 0) {
        const lngs = valid.map(e => parseFloat(e.lng))
        const lats  = valid.map(e => parseFloat(e.lat))
        map.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 60, maxZoom: 8, duration: 1200 }
        )
      }
    }

    tryRender()
  }, [events])

  // ── Activity chart ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current || events.length === 0) return
    if (chartInst.current) chartInst.current.destroy()

    const monthly = {}
    events.forEach(e => {
      const m = e.date?.substring(0, 7)
      if (m) monthly[m] = (monthly[m] || 0) + 1
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
          borderColor:     '#ff2a2a',
          borderWidth:     1,
          borderRadius:    2,
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
  }, [events])

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
          {loading ? '...' : `${events.length.toLocaleString()} EVENTS`}
        </div>
        <div className="bg-orange-400/10 border border-orange-400/30 px-3 py-1 rounded text-[10px] text-orange-400 font-mono">
          {fatal.toLocaleString()} FATALITIES
        </div>
        <div className="ml-auto text-[9px] text-muted font-mono">ALL TIME DATA · UCDP</div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-dark/80">
              <div className="text-threat font-mono text-sm animate-pulse">LOADING {actor.toUpperCase()}...</div>
            </div>
          )}
          {!loading && events.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-muted font-mono text-sm">No events found for {actor}</div>
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
              <div key={country}
                className="flex items-center gap-2 py-1.5 border-b border-border/40 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => navigate(`/country/${encodeURIComponent(country)}`)}>
                <span className="text-[9px] text-muted w-4">{i + 1}</span>
                <span className="text-[11px] text-blue-400 hover:text-white transition-colors flex-1">{country}</span>
                <span className="text-[10px] text-threat font-bold">{count}</span>
              </div>
            ))}
          </div>

          {/* Tactics */}
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
            <div className="text-[8px] tracking-[2.5px] text-muted mb-3">
              ALL EVENTS ({Math.min(events.length, 100)} of {events.length})
            </div>
            {[...events].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 100).map(ev => {
              const color = getEventColor(ev.type)
              return (
                <div key={ev.id} className="p-2 bg-panel2 rounded border border-border/40 mb-2">
                  <div className="text-[8px] mb-1" style={{ color }}>{ev.type}</div>
                  <div className="text-[11px] text-white mb-1">{ev.location}</div>
                  <div className="flex justify-between text-[9px] mb-1">
                    <span className="text-muted">{ev.date?.substring(0, 10)}</span>
                    {ev.fatalities > 0 && <span className="text-threat">💀 {ev.fatalities}</span>}
                  </div>
                  <div className="text-[10px] text-blue-400 cursor-pointer hover:text-white transition-colors mb-1"
                    onClick={() => navigate(`/country/${encodeURIComponent(ev.country)}`)}>
                    → {ev.country}
                  </div>
                  {ev.notes && (
                    <div className="text-[9px] text-muted leading-relaxed">{ev.notes.substring(0, 120)}</div>
                  )}
                </div>
              )
            })}
          </div>

        </div>
      </div>

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
