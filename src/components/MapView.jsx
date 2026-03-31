import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import useStore from '../store/useStore'
import { getEventColor } from '../utils/constants'
import StrikeArcs from './StrikeArcs'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const SIDEBAR_W   = 220   // must match App.jsx
const TRANSITION  = 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)'

export default function MapView({ onMapReady, layer, setLayer, sidebarOpen }) {
  const mapRef      = useRef(null)
  const mapInstance = useRef(null)
  const popupRef    = useRef(null)

  const [mapStyle, setMapStyle] = useState('dark')
  const [ready,    setReady]    = useState(false)

  const filteredEvents     = useStore(s => s.filteredEvents)
  const setSelectedEvent   = useStore(s => s.setSelectedEvent)
  const clearSelectedEvent = useStore(s => s.clearSelectedEvent)

  const STYLES = {
    dark:      'mapbox://styles/mapbox/dark-v11',
    satellite: 'mapbox://styles/mapbox/standard-satellite',
  }

  // ── INIT MAP ─────────────────────────────────────────────────
  useEffect(() => {
    if (mapInstance.current) return

    const map = new mapboxgl.Map({
      container:  mapRef.current,
      style:      STYLES.dark,
      center:     [10, 20],
      zoom:       2,
      minZoom:    1.5,
      maxZoom:    18,
      projection: 'globe',
      antialias:  true,
    })

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left')

    map.on('style.load', () => {
      setFog(map)
      setReady(true)
    })

    map.on('click', e => {
      if (!e.defaultPrevented) clearSelectedEvent()
    })

    mapInstance.current = map
    onMapReady(map)

    return () => {
      map.remove()
      mapInstance.current = null
    }
  }, [])

  // ── SWITCH STYLE ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstance.current
    if (!map) return
    setReady(false)
    map.setStyle(STYLES[mapStyle])
    map.once('style.load', () => {
      if (mapStyle === 'dark') setFog(map)
      setReady(true)
    })
  }, [mapStyle])

  // ── RENDER WHEN READY, EVENTS, OR LAYER CHANGES ──────────────
  useEffect(() => {
    const map = mapInstance.current
    if (!map || !ready) return
    renderLayer(map, filteredEvents, layer)
  }, [filteredEvents, layer, ready])

  function setFog(map) {
    map.setFog({
      color:            'rgb(4,9,20)',
      'high-color':     'rgb(10,20,40)',
      'horizon-blend':  0.02,
      'space-color':    'rgb(2,4,10)',
      'star-intensity': 0.6,
    })
  }

  // ── CLEANUP LAYERS ───────────────────────────────────────────
  function cleanupLayers(map) {
    if (popupRef.current) { popupRef.current.remove(); popupRef.current = null }

    const layers = [
      'markers-layer', 'markers-glow', 'pulse-layer',
      'heatmap-layer', 'cluster-circles', 'cluster-count',
      'unclustered-point',
    ]
    const sources = ['events-data', 'events-heat', 'events-cluster']

    layers.forEach(id  => { try { if (map.getLayer(id))   map.removeLayer(id)   } catch(e) {} })
    sources.forEach(id => { try { if (map.getSource(id)) map.removeSource(id)  } catch(e) {} })
  }

  // ── BUILD GEOJSON ────────────────────────────────────────────
  function buildGeoJSON(events) {
    return {
      type: 'FeatureCollection',
      features: events
        .filter(e => e.lat && e.lng && !isNaN(e.lat) && !isNaN(e.lng))
        .map(e => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
          properties: {
            id:       e.id,
            type:     e.type,
            fatal:    e.fatal || 0,
            country:  e.country,
            location: e.location,
            actor:    e.actor || '',
            date:     e.date,
            notes:    e.notes || '',
            color:    getEventColor(e.type),
            radius:   Math.max(4, Math.min(20, 4 + (e.fatal || 0) * 0.35)),
          },
        })),
    }
  }

  // ── RENDER LAYER ─────────────────────────────────────────────
  function renderLayer(map, events, mode) {
    cleanupLayers(map)
    if (mode === 'strikes') return
    if (mode === 'heatmap') { renderHeatmap(map, events); return }
    if (mode === 'cluster') { renderCluster(map, events); return }
    renderMarkers(map, events)
  }

  // ── MARKERS ──────────────────────────────────────────────────
  function renderMarkers(map, events) {
    const geojson = buildGeoJSON(events)

    map.addSource('events-data', { type: 'geojson', data: geojson })

    map.addLayer({
      id:     'markers-glow',
      type:   'circle',
      source: 'events-data',
      paint: {
        'circle-radius':  ['*', ['get', 'radius'], 1.8],
        'circle-color':   ['get', 'color'],
        'circle-opacity': 0.2,
        'circle-blur':    1,
      },
    })

    map.addLayer({
      id:     'markers-layer',
      type:   'circle',
      source: 'events-data',
      paint: {
        'circle-radius':         ['get', 'radius'],
        'circle-color':          ['get', 'color'],
        'circle-opacity':        0.75,
        'circle-stroke-width':   1.5,
        'circle-stroke-color':   ['get', 'color'],
        'circle-stroke-opacity': 0.9,
      },
    })

    map.on('mouseenter', 'markers-layer', e => {
      map.getCanvas().style.cursor = 'pointer'
      const props = e.features[0].properties
      const color = props.color

      setSelectedEvent({
        id:       props.id,
        type:     props.type,
        fatal:    props.fatal,
        country:  props.country,
        location: props.location,
        actor:    props.actor,
        date:     props.date,
        notes:    props.notes,
      })

      if (popupRef.current) popupRef.current.remove()
      popupRef.current = new mapboxgl.Popup({
        closeButton:  false,
        closeOnClick: false,
        offset:       14,
        className:    'tw-popup',
      })
        .setLngLat(e.features[0].geometry.coordinates)
        .setHTML(`
          <div style="min-width:180px;font-family:'Share Tech Mono',monospace">
            <div style="color:${color};font-size:9px;letter-spacing:2px;margin-bottom:4px">
              ${props.type.toUpperCase()}
            </div>
            <div style="color:#fff;font-size:13px;font-family:'Oswald',sans-serif;margin-bottom:6px">
              ${props.location}, ${props.country}
            </div>
            <div style="color:#6b7280;font-size:10px;margin-bottom:2px">📅 ${props.date}</div>
            <div style="color:#6b7280;font-size:10px;margin-bottom:2px">👥 ${(props.actor||'').substring(0,30)}</div>
            <div style="color:#ff2a2a;font-size:10px">💀 ${props.fatal} fatalities</div>
          </div>
        `)
        .addTo(map)
    })

    map.on('mouseleave', 'markers-layer', () => {
      map.getCanvas().style.cursor = ''
      if (popupRef.current) { popupRef.current.remove(); popupRef.current = null }
    })

    map.on('click', 'markers-layer', e => {
      e.preventDefault()
      window.location.href = `/country/${encodeURIComponent(e.features[0].properties.country)}`
    })
  }

  // ── HEATMAP ──────────────────────────────────────────────────
  function renderHeatmap(map, events) {
    map.addSource('events-heat', { type: 'geojson', data: buildGeoJSON(events) })
    map.addLayer({
      id:     'heatmap-layer',
      type:   'heatmap',
      source: 'events-heat',
      paint: {
        'heatmap-weight':    ['interpolate', ['linear'], ['get', 'fatal'], 0, 0.2, 50, 1],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0,   'rgba(0,0,0,0)',
          0.2, 'rgba(14,165,233,0.8)',
          0.4, 'rgba(168,85,247,0.8)',
          0.6, 'rgba(249,115,22,0.9)',
          0.8, 'rgba(255,42,42,0.9)',
          1,   'rgba(255,255,255,1)',
        ],
        'heatmap-radius':  ['interpolate', ['linear'], ['zoom'], 0, 20, 9, 40],
        'heatmap-opacity': 0.85,
      },
    })
  }

  // ── CLUSTER ──────────────────────────────────────────────────
  function renderCluster(map, events) {
    map.addSource('events-cluster', {
      type:           'geojson',
      data:           buildGeoJSON(events),
      cluster:        true,
      clusterMaxZoom: 10,
      clusterRadius:  50,
    })
    map.addLayer({
      id:     'cluster-circles',
      type:   'circle',
      source: 'events-cluster',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color':        ['step', ['get', 'point_count'], '#fbbf24', 10, '#f97316', 20, '#ff2a2a'],
        'circle-radius':       ['step', ['get', 'point_count'], 18, 10, 24, 20, 30],
        'circle-opacity':      0.85,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#ffffff22',
      },
    })
    map.addLayer({
      id:     'cluster-count',
      type:   'symbol',
      source: 'events-cluster',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font':  ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size':  11,
      },
      paint: { 'text-color': '#ffffff' },
    })
    map.addLayer({
      id:     'unclustered-point',
      type:   'circle',
      source: 'events-cluster',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color':        '#ff2a2a',
        'circle-radius':       5,
        'circle-opacity':      0.8,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ff2a2a44',
      },
    })
    map.on('click', 'cluster-circles', e => {
      const f = map.queryRenderedFeatures(e.point, { layers: ['cluster-circles'] })
      map.getSource('events-cluster').getClusterExpansionZoom(
        f[0].properties.cluster_id, (err, zoom) => {
          if (!err) map.easeTo({ center: f[0].geometry.coordinates, zoom })
        }
      )
    })
  }

  // ── Derived positions ────────────────────────────────────────
  // 10px is Mapbox's default ctrl margin; we add SIDEBAR_W on top when open
  const ctrlLeft    = sidebarOpen ? SIDEBAR_W + 10 : 10   // zoom +/- control
  const badgeLeft   = ctrlLeft + 48                        // escalating badge (38px = ctrl width + gap)

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', width: '100%', height: '100%' }}>

      {/* ── Styles ────────────────────────────────────────────── */}
      <style>{`
        .tw-popup .mapboxgl-popup-content {
          background: #06090e;
          border: 0.5px solid #1e2d3d;
          border-radius: 6px;
          padding: 10px 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.6);
        }
        .tw-popup .mapboxgl-popup-tip { border-top-color:#06090e; border-bottom-color:#06090e; }

        /* Zoom control — driven by CSS variable set in App.jsx */
        .mapboxgl-ctrl-top-left {
          left: var(--sidebar-offset, 10px) !important;
          transition: ${TRANSITION};
        }

        .mapboxgl-ctrl-group { background:#06090e !important; border:0.5px solid #1e2d3d !important; border-radius:6px !important; }
        .mapboxgl-ctrl-group button { background:transparent !important; }
        .mapboxgl-ctrl-icon { filter:invert(1) opacity(0.5); }
        .mapboxgl-ctrl-attrib { display:none; }
      `}</style>

      {/* Map container */}
      <div ref={mapRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* ── Escalating badge — slides with sidebar ────────────── */}
      <div style={{
        position:   'absolute',
        top:        10,
        left:       badgeLeft,
        zIndex:     500,
        transition: TRANSITION,
      }}>
        <div className="bg-threat/10 border border-threat/60 rounded px-2.5 py-1.5">
          <div className="text-[10px] text-threat font-bold tracking-widest">ESCALATING</div>
          <div className="text-[13px] text-white">Sudan +340% this week</div>
        </div>
      </div>

      {/* ── Layer toggle (top-right) ──────────────────────────── */}
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 500, display: 'flex', gap: 4 }}>
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
                : 'bg-[#06090e]/90 border-border2 text-muted hover:text-[#c9d1d9]'}`}>
            {l.label}
          </button>
        ))}
      </div>

      {/* ── Map style toggle (below layer toggle) ────────────── */}
      <div style={{ position: 'absolute', top: 40, right: 10, zIndex: 500, display: 'flex', gap: 4 }}>
        {[
          { id: 'dark',      label: 'DARK'      },
          { id: 'satellite', label: 'SATELLITE' },
        ].map(s => (
          <button key={s.id} onClick={() => setMapStyle(s.id)}
            className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-widest border font-mono transition-all
              ${mapStyle === s.id
                ? 'bg-blue-400/15 border-blue-400/50 text-blue-400'
                : 'bg-[#06090e]/90 border-border2 text-muted hover:text-[#c9d1d9]'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Heatmap legend ───────────────────────────────────── */}
      {layer === 'heatmap' && (
        <div style={{ position: 'absolute', bottom: 40, right: 10, zIndex: 500 }}>
          <div className="bg-[#06090e]/90 border border-border2 rounded px-3 py-2">
            <div className="text-[8px] tracking-widest text-muted mb-2">INTENSITY</div>
            <div className="w-24 h-2 rounded-full" style={{
              background: 'linear-gradient(to right,#0ea5e9,#a855f7,#f97316,#ff2a2a,#fff)',
            }}/>
            <div className="flex justify-between text-[8px] text-muted mt-1">
              <span>Low</span><span>High</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Markers legend ───────────────────────────────────── */}
      {layer === 'markers' && (
        <div style={{ position: 'absolute', bottom: 10, right: 30, zIndex: 500 }}>
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
                <span className="w-2 h-2 rounded-full" style={{ background: color }}/>
                <span className="text-[9px] text-muted">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Strike arcs ──────────────────────────────────────── */}
      {layer === 'strikes' && <StrikeArcs map={mapInstance.current} />}

    </div>
  )
}