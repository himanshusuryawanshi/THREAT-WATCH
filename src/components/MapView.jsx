/**
 * MapView — Mapbox globe container.
 *
 * Renders the dark globe (mapbox://styles/mapbox/dark-v11) with:
 *  - EventDots layer    (UCDP conflict events — BLUEPRINT Rule 1)
 *  - ThermalAnomalyLayer (NASA FIRMS — BLUEPRINT Rule 2)
 *  - LayerToggle panel  (top-right, glassmorphism)
 *  - InfoPanel          (right side, appears on dot click)
 *  - StrikeArcs         (when strikeArcs layer enabled)
 *
 * Sidebar transition: sidebar is an absolute overlay so the map container
 * never resizes → no Mapbox WebGL black flash. Mapbox zoom control position
 * is driven by CSS var --sidebar-offset updated in App.jsx.
 */
import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import useStore from '../store/useStore'
import EventDots           from './Map/EventDots'
import ThermalAnomalyLayer from './Map/ThermalAnomalyLayer'
import ChoroplethLayer     from './Map/ChoroplethLayer'
import RefugeeFlowArcs     from './Map/RefugeeFlowArcs'
import LayerToggle         from './Map/LayerToggle'
import InfoPanel           from './Panels/InfoPanel'
import StrikeArcs          from './StrikeArcs'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const DARK_STYLE      = 'mapbox://styles/mapbox/dark-v11'
const SIDEBAR_W       = 360   // must match App.jsx
const TRANSITION      = 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
const GLOBE_SPIN_MS   = 5000  // spin for 5 seconds on load, then stop

export default function MapView({ onMapReady, sidebarOpen }) {
  const mapRef      = useRef(null)
  const mapInstance = useRef(null)
  const spinRafRef  = useRef(null)
  const [ready, setReady] = useState(false)
  const [styleVersion, setStyleVersion] = useState(0)

  const layers             = useStore(s => s.layers)
  const clearSelectedEvent = useStore(s => s.clearSelectedEvent)

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapInstance.current) return

    const map = new mapboxgl.Map({
      container:  mapRef.current,
      style:      DARK_STYLE,
      center:     [30, 15],   // Africa/Middle East — most conflicts visible on load
      zoom:       2.5,
      minZoom:    1.5,
      maxZoom:    18,
      projection: 'globe',
      antialias:  true,
    })

    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      'top-left'
    )

    map.on('style.load', () => {
      applyFog(map)
      setReady(true)
      startGlobeSpin(map, spinRafRef)
    })

    // Click on empty map area → clear selected event
    map.on('click', e => {
      if (!e.defaultPrevented) clearSelectedEvent()
    })

    mapInstance.current = map
    onMapReady(map)

    return () => {
      stopGlobeSpin(spinRafRef)
      map.remove()
      mapInstance.current = null
      setReady(false)
    }
  }, [])

  // ── Sidebar transition — requestAnimationFrame resize loop ────────────────
  // Sidebar is absolute so map never truly resizes, but this loop ensures
  // Mapbox reports correct canvas size if anything forces a layout shift.
  useEffect(() => {
    const map = mapInstance.current
    if (!map) return
    let frames = 0
    const id = setInterval(() => {
      map.resize()
      if (++frames > 6) clearInterval(id)   // ~150ms of RAF at 60fps
    }, 25)
    return () => clearInterval(id)
  }, [sidebarOpen])

  const ctrlLeft = sidebarOpen ? SIDEBAR_W + 10 : 10

  return (
    <div style={{
      flex:     1,
      position: 'relative',
      overflow: 'hidden',
      width:    '100%',
      height:   '100%',
      '--sidebar-offset': `${ctrlLeft}px`,
    }}>

      {/* ── Global popup + mapbox control styles ──────────────── */}
      <style>{`
        .tw-popup .mapboxgl-popup-content {
          background: rgba(6, 9, 14, 0.96);
          border: 0.5px solid #1e2d3d;
          border-radius: 8px;
          padding: 10px 12px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.7);
        }
        .tw-popup .mapboxgl-popup-tip {
          border-top-color: rgba(6,9,14,0.96);
          border-bottom-color: rgba(6,9,14,0.96);
        }

        /* Mapbox zoom control follows sidebar */
        .mapboxgl-ctrl-top-left {
          left: var(--sidebar-offset, 10px) !important;
          transition: ${TRANSITION};
        }

        /* Dark-themed mapbox controls */
        .mapboxgl-ctrl-group {
          background: rgba(10,10,26,0.92) !important;
          border: 0.5px solid rgba(255,255,255,0.08) !important;
          border-radius: 6px !important;
          backdrop-filter: blur(8px);
        }
        .mapboxgl-ctrl-group button {
          background: transparent !important;
        }
        .mapboxgl-ctrl-icon {
          filter: invert(1) opacity(0.5);
        }
        .mapboxgl-ctrl-attrib { display: none; }
        .mapboxgl-ctrl-logo   { display: none; }
      `}</style>

      {/* ── Map canvas ────────────────────────────────────────── */}
      <div
        ref={mapRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* ── Map data layers — ORDER MATTERS (bottom to top) ─────── */}
      {ready && mapInstance.current && (
        <>
          {/* Choropleth first — renders below all dot layers */}
          <ChoroplethLayer
            map={mapInstance.current}
            ready={ready}
            styleVersion={styleVersion}
          />
          <EventDots
            map={mapInstance.current}
            ready={ready}
            styleVersion={styleVersion}
          />
          <ThermalAnomalyLayer
            map={mapInstance.current}
            ready={ready}
            styleVersion={styleVersion}
          />
          {/* Refugee flows above thermal, below strikes */}
          <RefugeeFlowArcs
            map={mapInstance.current}
            ready={ready}
            styleVersion={styleVersion}
          />
          {layers.strikeArcs && (
            <StrikeArcs map={mapInstance.current} />
          )}
        </>
      )}

      {/* ── Layer toggle (top-right) ───────────────────────────── */}
      <LayerToggle />

      {/* ── InfoPanel (right, appears on UCDP dot click) ─────── */}
      <InfoPanel />

      {/* ── Map style toggle ──────────────────────────────────── */}
      <MapStyleToggle map={mapInstance.current} onStyleChange={() => setStyleVersion(v => v + 1)} />

      {/* ── Legend ────────────────────────────────────────────── */}
      <Legend layers={layers} />

    </div>
  )
}

// ── Apply atmosphere / fog to globe ──────────────────────────────────────────
function applyFog(map) {
  map.setFog({
    color:            'rgb(4,9,20)',
    'high-color':     'rgb(10,20,40)',
    'horizon-blend':  0.02,
    'space-color':    'rgb(2,4,10)',
    'star-intensity': 0.6,
  })
}

// ── Slow globe spin on initial load → stops after GLOBE_SPIN_MS ───────────────
function startGlobeSpin(map, rafRef) {
  const startTime = performance.now()
  let lastTs = null

  function spin(ts) {
    const elapsed = ts - startTime
    if (elapsed >= GLOBE_SPIN_MS) return   // done spinning

    const dt = lastTs ? ts - lastTs : 16
    lastTs = ts

    const center = map.getCenter()
    center.lng += dt * 0.012   // ~0.72°/second — slow and cinematic
    map.setCenter(center)

    rafRef.current = requestAnimationFrame(spin)
  }

  rafRef.current = requestAnimationFrame(spin)
}

function stopGlobeSpin(rafRef) {
  if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
}

// ── Map style toggle (DARK / SATELLITE) ──────────────────────────────────────
function MapStyleToggle({ map, onStyleChange }) {
  const [style, setStyle] = useState('dark')

  const STYLES = {
    dark:      'mapbox://styles/mapbox/dark-v11',
    satellite: 'mapbox://styles/mapbox/standard-satellite',
  }

  function switchStyle(id) {
    if (!map || style === id) return
    setStyle(id)
    map.setStyle(STYLES[id])
    map.once('style.load', () => {
      if (id === 'dark') applyFog(map)
      // Increment styleVersion so all layer components re-add their sources/layers
      onStyleChange?.()
    })
  }

  return (
    <div style={{
      position: 'absolute',
      top:      170,   /* below the 4-button LayerToggle panel (~156px tall from top:10) */
      right:    10,
      zIndex:   600,
      display:  'flex',
      gap:      4,
    }}>
      {[
        { id: 'dark',      label: 'DARK'      },
        { id: 'satellite', label: 'SAT'       },
      ].map(s => (
        <button
          key={s.id}
          onClick={() => switchStyle(s.id)}
          style={{
            padding:        '4px 8px',
            borderRadius:   4,
            fontSize:       8,
            fontWeight:     700,
            letterSpacing:  2,
            fontFamily:     "'JetBrains Mono', monospace",
            cursor:         'pointer',
            transition:     'all 0.15s',
            background:     style === s.id ? 'rgba(59,130,246,0.15)' : 'rgba(10,10,26,0.85)',
            border:         style === s.id ? '0.5px solid rgba(59,130,246,0.5)' : '0.5px solid rgba(255,255,255,0.08)',
            color:          style === s.id ? '#3b82f6' : '#6b7280',
            backdropFilter: 'blur(8px)',
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}

// ── Legend (shown per active layer) ──────────────────────────────────────────
function Legend({ layers }) {
  const EVENT_LEGEND = [
    { label: 'Battle',                  color: '#ef4444' },
    { label: 'Explosion',               color: '#f97316' },
    { label: 'Civilian Violence',       color: '#dc2626' },
    { label: 'Protest',                 color: '#3b82f6' },
    { label: 'Riot',                    color: '#8b5cf6' },
    { label: 'Strategic Development',   color: '#6b7280' },
  ]

  const FIRE_LEGEND = [
    { label: 'Thermal anomaly (FRP-scaled)', color: '#ff8c00' },
  ]

  if (!layers.eventDots && !layers.thermalAnomalies) return null

  return (
    <div style={{
      position:        'absolute',
      bottom:          24,
      right:           10,
      zIndex:          500,
      background:      'rgba(10,10,26,0.88)',
      backdropFilter:  'blur(10px)',
      border:          '0.5px solid rgba(255,255,255,0.07)',
      borderRadius:    8,
      padding:         '10px 12px',
      minWidth:        170,
    }}>
      {layers.eventDots && (
        <div style={{ marginBottom: layers.thermalAnomalies ? 10 : 0 }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 7, letterSpacing: 2,
            color: '#6b7280', marginBottom: 6, textTransform: 'uppercase',
          }}>
            Conflict Events
          </div>
          {EVENT_LEGEND.map(({ label, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: color, flexShrink: 0,
                boxShadow: `0 0 4px ${color}60`,
              }} />
              <span style={{ fontSize: 9, color: '#9ca3af', fontFamily: "'DM Sans', sans-serif" }}>
                {label}
              </span>
            </div>
          ))}
          <div style={{ fontSize: 7, color: '#4b5563', fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
            Size = fatalities
          </div>
        </div>
      )}

      {layers.thermalAnomalies && (
        <div>
          {layers.eventDots && (
            <div style={{ height: 0.5, background: 'rgba(255,255,255,0.06)', margin: '8px 0' }} />
          )}
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 7, letterSpacing: 2,
            color: '#6b7280', marginBottom: 6, textTransform: 'uppercase',
          }}>
            Satellite Fires
          </div>
          {FIRE_LEGEND.map(({ label, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: color, flexShrink: 0,
                boxShadow: `0 0 6px ${color}80`,
              }} />
              <span style={{ fontSize: 9, color: '#9ca3af', fontFamily: "'DM Sans', sans-serif" }}>
                {label}
              </span>
            </div>
          ))}
          <div style={{ fontSize: 7, color: '#4b5563', fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
            NASA FIRMS · VIIRS NRT
          </div>
        </div>
      )}
    </div>
  )
}
