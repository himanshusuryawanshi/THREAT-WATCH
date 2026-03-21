import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet.heat'
import 'leaflet.markercluster'
import useStore from '../store/useStore'
import { getEventColor, getMarkerRadius } from '../utils/constants'

export default function MapView({ onMapReady }) {
  const mapRef          = useRef(null)
  const mapInstance     = useRef(null)
  const markersRef      = useRef([])
  const heatLayerRef    = useRef(null)
  const [layer, setLayer] = useState('markers')

  const filteredEvents     = useStore(s => s.filteredEvents)
  const setSelectedEvent   = useStore(s => s.setSelectedEvent)
  const clearSelectedEvent = useStore(s => s.clearSelectedEvent)

  useEffect(() => {
    if (mapInstance.current) return
    const map = L.map(mapRef.current, {
      center: [20, 10], zoom: 2,
      zoomControl: true, attributionControl: true,
    })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CartoDB', maxZoom: 19, subdomains: 'abcd',
    }).addTo(map)
    map.on('click', () => clearSelectedEvent())
    mapInstance.current = map
    onMapReady(map)
  }, [])

  useEffect(() => {
    const map = mapInstance.current
    if (!map) return
    renderLayer(map, filteredEvents, layer)
  }, [filteredEvents, layer])

  function createPopup(ev, color) {
    return `
      <div style="min-width:180px">
        <div style="color:${color};font-size:9px;letter-spacing:2px;margin-bottom:4px">
          ${ev.type.toUpperCase()}
        </div>
        <div style="color:#fff;font-size:13px;font-family:'Oswald',sans-serif;margin-bottom:6px">
          ${ev.location}, ${ev.country}
        </div>
        <div style="color:#6b7280;font-size:10px;margin-bottom:2px">📅 ${ev.date}</div>
        <div style="color:#6b7280;font-size:10px;margin-bottom:2px">👥 ${ev.actor}</div>
        <div style="color:#ff2a2a;font-size:10px">💀 ${ev.fatal} fatalities</div>
      </div>
    `
  }

  async function highlightCountry(map, countryName) {
  // Remove existing highlight
    if (map._countryHighlight) {
        map.removeLayer(map._countryHighlight)
        map._countryHighlight = null
    }

    if (!countryName) return

    try {
        const res = await fetch(
        'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson'
        )
        const data = await res.json()

        const feature = data.features.find(f =>
        f.properties.ADMIN.toLowerCase() === countryName.toLowerCase() ||
        f.properties.ISO_A3.toLowerCase() === countryName.toLowerCase()
        )

        if (!feature) return

        const layer = L.geoJSON(feature, {
        style: {
            color: '#38bdf8',
            weight: 2,
            opacity: 0.8,
            fillColor: '#38bdf8',
            fillOpacity: 0.08,
            dashArray: '4 4',
        },
        }).addTo(map)

        map._countryHighlight = layer
    } catch (e) {
        console.log('Could not load country boundary')
    }
    }

  function renderLayer(map, events, mode) {
    // Clear markers
    markersRef.current.forEach(m => map.removeLayer(m))
    markersRef.current = []

    // Clear heatmap
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current)
      heatLayerRef.current = null
    }

    // ── HEATMAP ──────────────────────────────────────────────
    if (mode === 'heatmap') {
      const points = events.map(ev => [
        ev.lat,
        ev.lng,
        Math.min(1, (parseInt(ev.fatal) || 0) / 30 + 0.2),
      ])
      heatLayerRef.current = L.heatLayer(points, {
        radius: 35, blur: 25, maxZoom: 8, max: 1.0,
        gradient: {
          0.0: '#0ea5e9', 0.3: '#a855f7',
          0.6: '#f97316', 0.8: '#ff2a2a', 1.0: '#ffffff',
        },
      }).addTo(map)
      return
    }

    // ── CLUSTER ───────────────────────────────────────────────
    if (mode === 'cluster') {
      const clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 60,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount()
          const size  = count > 20 ? 46 : count > 10 ? 38 : 30
          const color = count > 20 ? '#ff2a2a' : count > 10 ? '#f97316' : '#fbbf24'
          return L.divIcon({
            html: `<div style="
              width:${size}px;height:${size}px;border-radius:50%;
              background:${color}22;border:2px solid ${color};
              display:flex;align-items:center;justify-content:center;
              color:${color};font-size:11px;font-weight:bold;
              font-family:'Share Tech Mono',monospace;
              box-shadow:0 0 10px ${color}44;
            ">${count}</div>`,
            className: '',
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          })
        },
      })

      events.forEach(ev => {
        const color  = getEventColor(ev.type)
        const radius = getMarkerRadius(ev.fatal)
        const marker = L.circleMarker([ev.lat, ev.lng], {
          radius, fillColor: color, color,
          weight: 1.5, opacity: 0.9, fillOpacity: 0.5,
        })
        marker.bindPopup(createPopup(ev, color))
        marker.on('click', e => {
          e.originalEvent.stopPropagation()
          setSelectedEvent(ev)
        })
        clusterGroup.addLayer(marker)
      })

      clusterGroup.addTo(map)
      markersRef.current.push(clusterGroup)
      return
    }

    // ── MARKERS (default) ────────────────────────────────────
    events.forEach(ev => {
      const color  = getEventColor(ev.type)
      const radius = getMarkerRadius(ev.fatal)

      const circle = L.circleMarker([ev.lat, ev.lng], {
        radius, fillColor: color, color,
        weight: 1.5, opacity: 0.9, fillOpacity: 0.5,
      })
      circle.bindPopup(createPopup(ev, color))
      circle.on('click', e => {
        e.originalEvent.stopPropagation()
        setSelectedEvent(ev)
      })
      circle.addTo(map)
      markersRef.current.push(circle)

      // Pulse ring for recent events
      const days = (Date.now() - new Date(ev.date)) / 86400000
      if (days < 5) {
        const pulse = L.circleMarker([ev.lat, ev.lng], {
          radius: radius + 6, fillColor: 'transparent',
          color, weight: 0.8, opacity: 0.3, fillOpacity: 0,
        }).addTo(map)
        markersRef.current.push(pulse)
      }
    })
  }

  return (
    <div className="flex-1 relative overflow-hidden">
      <div ref={mapRef} className="w-full h-full z-10" />

      {/* Escalation badge */}
      <div className="absolute top-2.5 left-16 z-[500]">
        <div className="bg-threat/10 border border-threat/60 rounded px-2.5 py-1.5">
          <div className="text-[8px] text-threat font-bold tracking-widest">ESCALATING</div>
          <div className="text-[11px] text-white">Sudan +340% this week</div>
        </div>
      </div>

      {/* Layer toggle */}
      <div className="absolute top-2.5 right-2.5 z-[500] flex gap-1">
        {[
          { id: 'markers', label: 'MARKERS' },
          { id: 'heatmap', label: 'HEATMAP' },
          { id: 'cluster', label: 'CLUSTER' },
        ].map(l => (
          <button key={l.id} onClick={() => setLayer(l.id)}
            className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-widest border font-mono transition-all
              ${layer === l.id
                ? 'bg-threat/15 border-threat/50 text-threat'
                : 'bg-[#06090e]/90 border-border2 text-muted hover:text-[#c9d1d9]'
              }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Heatmap legend */}
      {layer === 'heatmap' && (
        <div className="absolute bottom-10 right-2.5 z-[500]">
          <div className="bg-[#06090e]/90 border border-border2 rounded px-3 py-2">
            <div className="text-[8px] tracking-widest text-muted mb-2">INTENSITY</div>
            <div className="w-24 h-2 rounded-full" style={{
              background: 'linear-gradient(to right, #0ea5e9, #a855f7, #f97316, #ff2a2a, #fff)'
            }} />
            <div className="flex justify-between text-[8px] text-muted mt-1">
              <span>Low</span><span>High</span>
            </div>
          </div>
        </div>
      )}

      {/* Markers legend */}
      {layer === 'markers' && (
        <div className="absolute bottom-2.5 left-2.5 z-[500]">
          <div className="bg-[#06090e]/90 border border-border2 rounded px-2.5 py-2">
            <div className="text-[8px] tracking-widest text-muted mb-2">LEGEND</div>
            {[
              ['Battles',          '#ff2a2a'],
              ['Explosions',       '#f97316'],
              ['Civilian Violence','#fbbf24'],
              ['Protests',         '#38bdf8'],
              ['Riots',            '#a855f7'],
            ].map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-[9px] text-muted">{label}</span>
              </div>
            ))}
            <div className="text-[8px] text-muted mt-1.5 border-t border-border pt-1.5">
              Size = fatality count
            </div>
          </div>
        </div>
      )}

      {/* Cluster legend */}
      {layer === 'cluster' && (
        <div className="absolute bottom-2.5 left-2.5 z-[500]">
          <div className="bg-[#06090e]/90 border border-border2 rounded px-2.5 py-2">
            <div className="text-[8px] tracking-widest text-muted mb-2">CLUSTERS</div>
            {[
              ['1–10 events',  '#fbbf24'],
              ['11–20 events', '#f97316'],
              ['20+ events',   '#ff2a2a'],
            ].map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-[9px] text-muted">{label}</span>
              </div>
            ))}
            <div className="text-[8px] text-muted mt-1.5 border-t border-border pt-1.5">
              Click cluster to zoom in
            </div>
          </div>
        </div>
      )}
    </div>
  )
}