import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import useStore from '../store/useStore'
import { getEventColor } from '../utils/constants'
import StrikeArcs from './StrikeArcs'

const API_BASE = 'http://localhost:3001'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const SIDEBAR_W   = 220   // must match App.jsx
const TRANSITION  = 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)'

export default function MapView({ onMapReady, layer, setLayer, sidebarOpen }) {
  const mapRef        = useRef(null)
  const mapInstance   = useRef(null)
  const popupRef      = useRef(null)
  const fireCancelRef = useRef(null)

  const [mapStyle,  setMapStyle]  = useState('dark')
  const [ready,     setReady]     = useState(false)
  const [firesData, setFiresData] = useState([])

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

  // ── FETCH FIRMS FIRES WHEN FIRES LAYER ACTIVE ────────────────
  useEffect(() => {
    if (layer !== 'fires' || !ready) return
    fetch(`${API_BASE}/api/fires?conflict_only=true&days=7&limit=2000`)
      .then(r => r.json())
      .then(({ fires }) => setFiresData(fires || []))
      .catch(() => setFiresData([]))
  }, [layer, ready])

  // ── RENDER WHEN READY, EVENTS, LAYER, OR FIRES CHANGE ────────
  useEffect(() => {
    const map = mapInstance.current
    if (!map || !ready) return
    // Cancel any running fires animation
    if (fireCancelRef.current) { fireCancelRef.current(); fireCancelRef.current = null }
    renderLayer(map, filteredEvents, layer, firesData)
  }, [filteredEvents, layer, ready, firesData])

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
      'heatmap-layer',
      'cluster-glow', 'cluster-circles', 'cluster-count',
      'unclustered-point', 'unclustered-glow',
      'fires-pulse', 'fires-core',
    ]
    const sources = ['events-data', 'events-heat', 'events-cluster', 'fires-data']

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
            id:         e.id,
            type:       e.type,
            fatalities: e.fatalities || 0,
            country:    e.country,
            location:   e.location,
            actor1:     e.actor1 || '',
            date:       e.date,
            notes:      e.notes || '',
            color:      getEventColor(e.type),
            radius:     Math.max(4, Math.min(20, 4 + (e.fatalities || 0) * 0.35)),
          },
        })),
    }
  }

  // ── RENDER LAYER ─────────────────────────────────────────────
  function renderLayer(map, events, mode, fires) {
    cleanupLayers(map)
    if (mode === 'strikes') return
    if (mode === 'heatmap') { renderHeatmap(map, events); return }
    if (mode === 'cluster') { renderCluster(map, events); return }
    if (mode === 'fires')   { renderFires(map, fires);   return }
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
        id:         props.id,
        type:       props.type,
        fatalities: props.fatalities,
        country:    props.country,
        location:   props.location,
        actor1:     props.actor1,
        date:       props.date,
        notes:      props.notes,
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
            <div style="color:#6b7280;font-size:10px;margin-bottom:2px">👥 ${(props.actor1||'').substring(0,30)}</div>
            <div style="color:#ff2a2a;font-size:10px">💀 ${props.fatalities} fatalities</div>
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

  // ── FIRES (NASA FIRMS) ───────────────────────────────────────
  function renderFires(map, fires) {
    if (!fires || !fires.length) {
      // Show placeholder text in console — no crashes
      console.log('[fires] no fire data — FIRMS_API_KEY may not be set')
      return
    }

    const geojson = {
      type: 'FeatureCollection',
      features: fires
        .filter(f => f.lat && f.lng)
        .map(f => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [f.lng, f.lat] },
          properties: {
            id:             f.id,
            frp:            f.frp || 0,
            confidence:     f.confidence || 'nominal',
            inConflictZone: f.inConflictZone,
            acq_date:       f.acq_date,
            // radius scales with Fire Radiative Power: min 4, max 18
            radius: Math.max(4, Math.min(18, 4 + (f.frp || 0) * 0.1)),
          },
        })),
    }

    map.addSource('fires-data', { type: 'geojson', data: geojson })

    // Outer pulse ring — animated below
    map.addLayer({
      id:     'fires-pulse',
      type:   'circle',
      source: 'fires-data',
      paint: {
        'circle-radius':  8,
        'circle-color':   '#f97316',
        'circle-opacity': 0.4,
        'circle-blur':    0.6,
      },
    })

    // Core dot — solid orange, size by FRP
    map.addLayer({
      id:     'fires-core',
      type:   'circle',
      source: 'fires-data',
      paint: {
        'circle-radius':         ['get', 'radius'],
        'circle-color':          [
          'match', ['get', 'confidence'],
          'high',    '#ef4444',   // bright red for high confidence
          'nominal', '#f97316',   // orange
                     '#fb923c',   // lighter orange for low
        ],
        'circle-opacity':        0.85,
        'circle-stroke-width':   1,
        'circle-stroke-color':   '#fff',
        'circle-stroke-opacity': 0.25,
      },
    })

    // Popup on hover
    map.on('mouseenter', 'fires-core', e => {
      map.getCanvas().style.cursor = 'pointer'
      const p = e.features[0].properties
      if (popupRef.current) popupRef.current.remove()
      popupRef.current = new mapboxgl.Popup({
        closeButton: false, closeOnClick: false, offset: 12, className: 'tw-popup',
      })
        .setLngLat(e.features[0].geometry.coordinates)
        .setHTML(`
          <div style="min-width:170px;font-family:'Share Tech Mono',monospace">
            <div style="color:#f97316;font-size:9px;letter-spacing:2px;margin-bottom:4px">THERMAL ANOMALY</div>
            <div style="color:#fff;font-size:12px;font-family:'Oswald',sans-serif;margin-bottom:6px">
              ${p.inConflictZone ? '🔴 In Conflict Zone' : '🟡 Non-Conflict Zone'}
            </div>
            <div style="color:#6b7280;font-size:10px;margin-bottom:2px">🛰️ ${p.acq_date || 'Recent'}</div>
            <div style="color:#f97316;font-size:10px;margin-bottom:2px">
              FRP: ${p.frp ? p.frp.toFixed(1) + ' MW' : 'N/A'}
            </div>
            <div style="color:#6b7280;font-size:9px">Confidence: ${(p.confidence||'').toUpperCase()}</div>
          </div>
        `)
        .addTo(map)
    })
    map.on('mouseleave', 'fires-core', () => {
      map.getCanvas().style.cursor = ''
      if (popupRef.current) { popupRef.current.remove(); popupRef.current = null }
    })

    // Pulse animation — expand + fade the outer ring every 2s
    let pulseStart = null
    let rafId      = null
    let cancelled  = false
    function animate(timestamp) {
      if (cancelled || !map.getLayer('fires-pulse')) return
      if (!pulseStart) pulseStart = timestamp
      const t = ((timestamp - pulseStart) % 2000) / 2000   // 0..1 cycle
      const r = 6 + t * 18
      const o = 0.5 * (1 - t)
      try {
        map.setPaintProperty('fires-pulse', 'circle-radius',  r)
        map.setPaintProperty('fires-pulse', 'circle-opacity', o)
        map.triggerRepaint()
      } catch { return }
      rafId = requestAnimationFrame(animate)
    }
    rafId = requestAnimationFrame(animate)
    fireCancelRef.current = () => { cancelled = true; if (rafId) cancelAnimationFrame(rafId) }
  }

  // ── HEATMAP ──────────────────────────────────────────────────
  function renderHeatmap(map, events) {
    map.addSource('events-heat', { type: 'geojson', data: buildGeoJSON(events) })
    map.addLayer({
      id:     'heatmap-layer',
      type:   'heatmap',
      source: 'events-heat',
      paint: {
        'heatmap-weight':    ['interpolate', ['linear'], ['get', 'fatalities'], 0, 0.2, 50, 1],
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
      clusterProperties: {
        totalFatalities: ['+', ['get', 'fatalities']],
      },
    })

    // ── Cluster glow ───────────────────────────────────────────
    map.addLayer({
      id:     'cluster-glow',
      type:   'circle',
      source: 'events-cluster',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step', ['get', 'point_count'],
          '#fbbf24', 10, '#f97316', 50, '#ff2a2a',
        ],
        'circle-radius': [
          'step', ['get', 'point_count'],
          28, 10, 38, 50, 52, 200, 66,
        ],
        'circle-opacity': 0.12,
        'circle-blur':    1.5,
      },
    })

    // ── Cluster circles ────────────────────────────────────────
    map.addLayer({
      id:     'cluster-circles',
      type:   'circle',
      source: 'events-cluster',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step', ['get', 'point_count'],
          '#fbbf24',       // yellow  < 10
          10,  '#f97316',  // orange  10–49
          50,  '#ff2a2a',  // red     50+
        ],
        'circle-radius': [
          'step', ['get', 'point_count'],
          18, 10, 26, 50, 36, 200, 46,
        ],
        'circle-opacity':      0.88,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#ffffff18',
      },
    })

    // ── Count label ────────────────────────────────────────────
    map.addLayer({
      id:     'cluster-count',
      type:   'symbol',
      source: 'events-cluster',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font':  ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size':  12,
      },
      paint: { 'text-color': '#ffffff' },
    })

    // ── Unclustered glow ───────────────────────────────────────
    map.addLayer({
      id:     'unclustered-glow',
      type:   'circle',
      source: 'events-cluster',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius':  ['*', ['get', 'radius'], 1.8],
        'circle-color':   ['get', 'color'],
        'circle-opacity': 0.15,
        'circle-blur':    1,
      },
    })

    // ── Unclustered points — color-coded by event type ─────────
    map.addLayer({
      id:     'unclustered-point',
      type:   'circle',
      source: 'events-cluster',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius':         ['get', 'radius'],
        'circle-color':          ['get', 'color'],
        'circle-opacity':        0.8,
        'circle-stroke-width':   1.5,
        'circle-stroke-color':   ['get', 'color'],
        'circle-stroke-opacity': 0.7,
      },
    })

    // ── Click cluster → zoom in ────────────────────────────────
    map.on('click', 'cluster-circles', e => {
      const f = map.queryRenderedFeatures(e.point, { layers: ['cluster-circles'] })
      map.getSource('events-cluster').getClusterExpansionZoom(
        f[0].properties.cluster_id, (err, zoom) => {
          if (!err) map.easeTo({ center: f[0].geometry.coordinates, zoom: zoom + 0.5, duration: 500 })
        }
      )
    })

    // ── Hover cluster → popup with aggregate stats ─────────────
    map.on('mouseenter', 'cluster-circles', e => {
      map.getCanvas().style.cursor = 'pointer'
      const p     = e.features[0].properties
      const count = p.point_count
      const fatal = p.totalFatalities || 0
      const color = count >= 50 ? '#ff2a2a' : count >= 10 ? '#f97316' : '#fbbf24'

      if (popupRef.current) popupRef.current.remove()
      popupRef.current = new mapboxgl.Popup({
        closeButton: false, closeOnClick: false, offset: 14, className: 'tw-popup',
      })
        .setLngLat(e.features[0].geometry.coordinates)
        .setHTML(`
          <div style="font-family:'Share Tech Mono',monospace;min-width:150px">
            <div style="color:${color};font-size:9px;letter-spacing:2px;margin-bottom:4px">CLUSTER</div>
            <div style="color:#fff;font-size:18px;font-family:'Oswald',sans-serif;font-weight:600;margin-bottom:2px">
              ${count.toLocaleString()} events
            </div>
            <div style="color:#ff2a2a;font-size:10px;margin-top:4px">💀 ${fatal.toLocaleString()} fatalities</div>
            <div style="color:#6b7280;font-size:9px;margin-top:6px">Click to expand</div>
          </div>
        `)
        .addTo(map)
    })
    map.on('mouseleave', 'cluster-circles', () => {
      map.getCanvas().style.cursor = ''
      if (popupRef.current) { popupRef.current.remove(); popupRef.current = null }
    })

    // ── Hover unclustered point → same popup as markers ────────
    map.on('mouseenter', 'unclustered-point', e => {
      map.getCanvas().style.cursor = 'pointer'
      const props = e.features[0].properties
      const color = props.color

      setSelectedEvent({
        id:         props.id,
        type:       props.type,
        fatalities: props.fatalities,
        country:    props.country,
        location:   props.location,
        actor1:     props.actor1,
        date:       props.date,
        notes:      props.notes,
      })

      if (popupRef.current) popupRef.current.remove()
      popupRef.current = new mapboxgl.Popup({
        closeButton: false, closeOnClick: false, offset: 14, className: 'tw-popup',
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
            <div style="color:#6b7280;font-size:10px;margin-bottom:2px">👥 ${(props.actor1||'').substring(0,30)}</div>
            <div style="color:#ff2a2a;font-size:10px">💀 ${props.fatalities} fatalities</div>
          </div>
        `)
        .addTo(map)
    })
    map.on('mouseleave', 'unclustered-point', () => {
      map.getCanvas().style.cursor = ''
      if (popupRef.current) { popupRef.current.remove(); popupRef.current = null }
    })
    map.on('click', 'unclustered-point', e => {
      e.preventDefault()
      window.location.href = `/country/${encodeURIComponent(e.features[0].properties.country)}`
    })
  }

  const ctrlLeft = sidebarOpen ? SIDEBAR_W + 10 : 10

  return (
    <div
      style={{ flex: 1, position: 'relative', overflow: 'hidden', width: '100%', height: '100%',
               '--sidebar-offset': `${ctrlLeft}px` }}
    >

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

      {/* Escalation badge — populated by API in Phase 2 */}

      {/* ── Layer toggle (top-right) ──────────────────────────── */}
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 500, display: 'flex', gap: 4 }}>
        {[
          { id: 'markers', label: 'MARKERS' },
          { id: 'heatmap', label: 'HEATMAP' },
          { id: 'cluster', label: 'CLUSTER' },
          { id: 'fires',   label: 'FIRES'   },
          { id: 'strikes', label: 'STRIKES' },
        ].map(l => (
          <button key={l.id} onClick={() => setLayer(l.id)}
            className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-widest border font-mono transition-all
              ${layer === l.id && l.id === 'fires'
                ? 'bg-orange-500/15 border-orange-500/50 text-orange-400'
                : layer === l.id
                  ? 'bg-threat/15 border-threat/50 text-threat'
                  : 'bg-[#06090e]/90 border-border2 text-muted hover:text-[#c9d1d9]'}`}>
            {l.label}
          </button>
        ))}
      </div>

      {/* ── Map style toggle ──────────────────────────────────── */}
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

      {/* ── Cluster legend ───────────────────────────────────── */}
      {layer === 'cluster' && (
        <div style={{ position: 'absolute', bottom: 10, right: 30, zIndex: 500 }}>
          <div className="bg-[#06090e]/90 border border-border2 rounded px-2.5 py-2">
            <div className="text-[8px] tracking-widest text-muted mb-2">CLUSTER SIZE</div>
            {[
              ['1–9 events',   '#fbbf24'],
              ['10–49 events', '#f97316'],
              ['50+ events',   '#ff2a2a'],
            ].map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ background: color }}/>
                <span className="text-[9px] text-muted">{label}</span>
              </div>
            ))}
            <div className="text-[8px] text-muted mt-2 pt-2 border-t border-border2">
              Click cluster to expand
            </div>
          </div>
        </div>
      )}

      {/* ── Fires legend ────────────────────────────────────── */}
      {layer === 'fires' && (
        <div style={{ position: 'absolute', bottom: 10, right: 30, zIndex: 500 }}>
          <div className="bg-[#06090e]/90 border border-border2 rounded px-2.5 py-2">
            <div className="text-[8px] tracking-widest text-muted mb-2">THERMAL ANOMALIES</div>
            {[
              ['High confidence', '#ef4444'],
              ['Nominal confidence', '#f97316'],
              ['Low confidence', '#fb923c'],
            ].map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ background: color }}/>
                <span className="text-[9px] text-muted">{label}</span>
              </div>
            ))}
            <div className="text-[8px] text-muted mt-2 pt-2 border-t border-border2">
              NASA FIRMS · VIIRS SNPP NRT
            </div>
          </div>
        </div>
      )}

      {/* ── Strike arcs ──────────────────────────────────────── */}
      {layer === 'strikes' && <StrikeArcs map={mapInstance.current} />}

    </div>
  )
}