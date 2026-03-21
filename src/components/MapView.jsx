import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet.heat'
import 'leaflet.markercluster'
import useStore from '../store/useStore'
import { getEventColor, getMarkerRadius } from '../utils/constants'
import StrikeArcs from './StrikeArcs'

export default function MapView({ onMapReady }) {
  const mapRef       = useRef(null)
  const mapInstance  = useRef(null)
  const markersRef   = useRef([])
  const heatLayerRef = useRef(null)
  const tilesRef     = useRef([])

  const [layer,    setLayer]    = useState('markers')
  const [mapStyle, setMapStyle] = useState('dark')

  const filteredEvents     = useStore(s => s.filteredEvents)
  const setSelectedEvent   = useStore(s => s.setSelectedEvent)
  const clearSelectedEvent = useStore(s => s.clearSelectedEvent)

  // ── INIT MAP ────────────────────────────────────────────────
  useEffect(() => {
    if (mapInstance.current) return
    const map = L.map(mapRef.current, {
    center: [20, 10],
    zoom: 2,
    zoomControl: true,
    attributionControl: true,
    minZoom: 2,
    worldCopyJump: true,
    })
    applyTiles('dark', map)
    map.on('click', () => clearSelectedEvent())
    mapInstance.current = map
    onMapReady(map)
  }, [])

    const prevEventsRef = useRef([])
    const prevLayerRef  = useRef('')

    useEffect(() => {
    const map = mapInstance.current
    if (!map) return

    const eventsChanged = JSON.stringify(filteredEvents.map(e => e.id)) !==
                            JSON.stringify(prevEventsRef.current.map(e => e.id))
    const layerChanged  = layer !== prevLayerRef.current

    if (!eventsChanged && !layerChanged) return

    prevEventsRef.current = filteredEvents
    prevLayerRef.current  = layer

    renderLayer(map, filteredEvents, layer)
    }, [filteredEvents, layer])

  // ── RE-RENDER MARKERS WHEN EVENTS OR LAYER CHANGES ──────────
  useEffect(() => {
    const map = mapInstance.current
    if (!map) return
    renderLayer(map, filteredEvents, layer)
  }, [filteredEvents, layer])

  // ── TILE SWITCHER ────────────────────────────────────────────
  function applyTiles(style, map) {
    tilesRef.current.forEach(t => map.removeLayer(t))
    tilesRef.current = []

    if (style === 'satellite') {
      const base = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: '© Esri', maxZoom: 19, opacity: 0.9, zIndex: 1 }
      ).addTo(map)
      const labels = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
        { attribution: '© CartoDB', maxZoom: 19, subdomains: 'abcd', opacity: 0.9, zIndex: 2 }
      ).addTo(map)
      tilesRef.current = [base, labels]
    } else {
      const base = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { attribution: '© CartoDB', maxZoom: 19, subdomains: 'abcd', zIndex: 1 }
      ).addTo(map)
      tilesRef.current = [base]
    }
  }

  // ── POPUP HTML ───────────────────────────────────────────────
  function createPopupHtml(ev, color) {
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
        <div style="color:#ff2a2a;font-size:10px;margin-bottom:4px">💀 ${ev.fatal} fatalities</div>
        <div style="color:#38bdf8;font-size:9px;cursor:pointer"
          onclick="window.location.href='/country/${encodeURIComponent(ev.country)}'">
          → View ${ev.country} page
        </div>
      </div>
    `
  }

  // ── RENDER LAYER ─────────────────────────────────────────────
  function renderLayer(map, events, mode) {
    markersRef.current.forEach(m => map.removeLayer(m))
    markersRef.current = []
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current)
      heatLayerRef.current = null
    }

    if (mode === 'strikes') return

    // HEATMAP
    if (mode === 'heatmap') {
      const points = events.map(ev => [
        ev.lat, ev.lng,
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

    // CLUSTER
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
        marker.bindPopup(createPopupHtml(ev, color), { autoPan: false })

        let hoverTimeout
        marker.on('mouseover', e => {
          e.originalEvent.stopPropagation()
          clearTimeout(hoverTimeout)
          setSelectedEvent(ev)
          marker.openPopup()
        })
        marker.on('mouseout', () => {
          hoverTimeout = setTimeout(() => marker.closePopup(), 400)
        })
        marker.on('click', () => {
          window.location.href = `/country/${encodeURIComponent(ev.country)}`
        })

        clusterGroup.addLayer(marker)
      })
      clusterGroup.addTo(map)
      markersRef.current.push(clusterGroup)
      return
    }

    // MARKERS (default)
    events.forEach(ev => {
      const color  = getEventColor(ev.type)
      const radius = getMarkerRadius(ev.fatal)
      const circle = L.circleMarker([ev.lat, ev.lng], {
        radius, fillColor: color, color,
        weight: 1.5, opacity: 0.9, fillOpacity: 0.5,
        bubblingMouseEvents: false,
        })
      circle.bindPopup(createPopupHtml(ev, color), { autoPan: false })

      let hoverTimeout
      circle.on('mouseover', e => {
        e.originalEvent.stopPropagation()
        clearTimeout(hoverTimeout)
        setSelectedEvent(ev)
        circle.openPopup()
      })
      circle.on('mouseout', () => {
        hoverTimeout = setTimeout(() => circle.closePopup(), 400)
      })
      circle.on('click', () => {
        window.location.href = `/country/${encodeURIComponent(ev.country)}`
      })

      // Keep popup open when mouse enters popup
      circle.on('popupopen', () => {
        const popupEl = circle.getPopup()?.getElement()
        if (!popupEl) return
        popupEl.addEventListener('mouseenter', () => clearTimeout(hoverTimeout))
        popupEl.addEventListener('mouseleave', () => {
          hoverTimeout = setTimeout(() => circle.closePopup(), 400)
        })
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
          { id: 'strikes', label: 'STRIKES' },
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

      {/* Strike arcs overlay */}
      {layer === 'strikes' && (
        <StrikeArcs map={mapInstance.current} />
      )}

      {/* Map style toggle */}
      <div className="absolute top-10 right-2.5 z-[500] flex gap-1">
        {[
          { id: 'dark',      label: 'DARK'      },
          { id: 'satellite', label: 'SATELLITE' },
        ].map(s => (
          <button key={s.id} onClick={() => setMapStyle(s.id)}
            className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-widest border font-mono transition-all
              ${mapStyle === s.id
                ? 'bg-blue-400/15 border-blue-400/50 text-blue-400'
                : 'bg-[#06090e]/90 border-border2 text-muted hover:text-[#c9d1d9]'
              }`}
          >
            {s.label}
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
              ['Battles',           '#ff2a2a'],
              ['Explosions',        '#f97316'],
              ['Civilian Violence', '#fbbf24'],
              ['Protests',          '#38bdf8'],
              ['Riots',             '#a855f7'],
            ].map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-[9px] text-muted">{label}</span>
              </div>
            ))}
            <div className="text-[8px] text-muted mt-1.5 border-t border-border pt-1.5">
              Hover for details · Click for country page
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