/**
 * ThermalAnomalyLayer — NASA FIRMS thermal anomalies on the Mapbox globe.
 *
 * BLUEPRINT Rule 2: FIRMS is the SECOND independent map layer.
 * DISTINCT from UCDP dots: orange glowing circles vs solid colored UCDP dots.
 *
 * Fetches /api/fires?conflict_only=true&days=7
 * Sizes scale with FRP (Fire Radiative Power) — intensity indicator.
 * Pulsing animation gives the "satellite thermal" look.
 */
import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import useStore from '../../store/useStore'

const API_BASE  = 'http://localhost:3001'
const SOURCE_ID = 'firms-fires'
const LAYER_GLOW = 'firms-glow'
const LAYER_CORE = 'firms-core'

export default function ThermalAnomalyLayer({ map, ready, styleVersion = 0 }) {
  const layers   = useStore(s => s.layers)
  const popupRef = useRef(null)
  const rafRef   = useRef(null)
  const [fires, setFires] = useState([])
  const mountedRef = useRef(true)

  // ── Fetch FIRMS fires on mount ──────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true
    fetch(`${API_BASE}/api/fires?conflict_only=true&days=7`)
      .then(r => r.json())
      .then(({ fires: data }) => {
        if (!mountedRef.current) return
        setFires(data || [])
        console.log(`[ThermalAnomalyLayer] loaded ${(data || []).length} thermal anomalies`)
      })
      .catch(err => console.warn('[ThermalAnomalyLayer] fetch failed:', err.message))

    return () => { mountedRef.current = false }
  }, [])

  // ── Add Mapbox layers when map/fires are ready ──────────────────────────
  useEffect(() => {
    if (!map || !ready || !fires.length) return

    const geojson = buildGeoJSON(fires)
    addLayers(map, geojson)
    startPulse(map, rafRef)

    return () => {
      stopPulse(rafRef)
      removeLayers(map, popupRef)
    }
  }, [map, ready, fires, styleVersion])

  // ── Toggle visibility ───────────────────────────────────────────────────
  useEffect(() => {
    if (!map || !ready) return
    const visibility = layers.thermalAnomalies ? 'visible' : 'none'
    safeSetVisibility(map, LAYER_GLOW, visibility)
    safeSetVisibility(map, LAYER_CORE, visibility)

    if (layers.thermalAnomalies) {
      startPulse(map, rafRef)
    } else {
      stopPulse(rafRef)
    }
  }, [map, ready, layers.thermalAnomalies, styleVersion])

  // ── Click + hover handlers ──────────────────────────────────────────────
  useEffect(() => {
    if (!map || !ready || !fires.length) return

    function onMouseEnter(e) {
      map.getCanvas().style.cursor = 'pointer'
      const p = e.features[0].properties

      if (popupRef.current) { popupRef.current.remove(); popupRef.current = null }
      popupRef.current = new mapboxgl.Popup({
        closeButton:  false,
        closeOnClick: false,
        offset:       12,
        className:    'tw-popup',
      })
        .setLngLat(e.features[0].geometry.coordinates.slice())
        .setHTML(`
          <div style="min-width:190px;font-family:'JetBrains Mono',monospace">
            <div style="color:#ff8c00;font-size:9px;letter-spacing:2px;margin-bottom:4px">
              THERMAL ANOMALY · NASA FIRMS
            </div>
            <div style="color:#fff;font-size:12px;font-family:'DM Sans',sans-serif;font-weight:600;margin-bottom:6px">
              ${p.inConflictZone ? 'Active Conflict Zone' : 'Non-Conflict Zone'}
            </div>
            <div style="color:#9ca3af;font-size:10px;margin-bottom:2px">
              Acquired: ${p.acq_date || 'Recent'}
            </div>
            <div style="color:#ff8c00;font-size:10px;margin-bottom:2px;font-weight:bold">
              FRP: ${p.frp ? parseFloat(p.frp).toFixed(1) + ' MW' : 'N/A'}
            </div>
            <div style="color:#6b7280;font-size:9px;margin-bottom:2px">
              Confidence: ${(p.confidence || '').toUpperCase() || 'N/A'}
            </div>
            ${p.satellite ? `<div style="color:#6b7280;font-size:8px;margin-top:4px;letter-spacing:1px">${p.satellite}</div>` : ''}
            ${p.nearestEvent ? `
              <div style="margin-top:6px;padding-top:6px;border-top:0.5px solid #1e2d3d;color:#9ca3af;font-size:8px">
                Linked UCDP event nearby
              </div>
            ` : ''}
          </div>
        `)
        .addTo(map)
    }

    function onMouseLeave() {
      map.getCanvas().style.cursor = ''
      if (popupRef.current) { popupRef.current.remove(); popupRef.current = null }
    }

    if (map.getLayer(LAYER_CORE)) {
      map.on('mouseenter', LAYER_CORE, onMouseEnter)
      map.on('mouseleave', LAYER_CORE, onMouseLeave)
    }

    return () => {
      if (!map || !map.getLayer) return
      map.off('mouseenter', LAYER_CORE, onMouseEnter)
      map.off('mouseleave', LAYER_CORE, onMouseLeave)
    }
  }, [map, ready, fires, styleVersion])

  return null
}

// ── Build GeoJSON ─────────────────────────────────────────────────────────────
function buildGeoJSON(fires) {
  return {
    type: 'FeatureCollection',
    features: fires
      .filter(f => f.lat && f.lng && !isNaN(f.lat) && !isNaN(f.lng))
      .map(f => ({
        type: 'Feature',
        geometry: {
          type:        'Point',
          coordinates: [parseFloat(f.lng), parseFloat(f.lat)],
        },
        properties: {
          id:             f.id,
          frp:            parseFloat(f.frp)  || 0,
          confidence:     f.confidence       || 'nominal',
          satellite:      f.satellite        || f.acq_time || '',
          acq_date:       f.acq_date         || '',
          inConflictZone: f.in_conflict_zone || f.inConflictZone || false,
          nearestEvent:   f.nearest_event_id || null,
        },
      })),
  }
}

// ── Add Mapbox source + layers ────────────────────────────────────────────────
function addLayers(map, geojson) {
  removeLayers(map, { current: null })

  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: 'geojson', data: geojson })
  } else {
    map.getSource(SOURCE_ID).setData(geojson)
  }

  // Glow ring — pulsed via requestAnimationFrame
  if (!map.getLayer(LAYER_GLOW)) {
    map.addLayer({
      id:     LAYER_GLOW,
      type:   'circle',
      source: SOURCE_ID,
      paint: {
        'circle-radius':  8,
        'circle-color':   '#ff8c00',
        'circle-opacity': 0.4,
        'circle-blur':    0.8,
      },
    })
  }

  // Core dot — orange, FRP-scaled, glowing
  if (!map.getLayer(LAYER_CORE)) {
    map.addLayer({
      id:     LAYER_CORE,
      type:   'circle',
      source: SOURCE_ID,
      paint: {
        // Blueprint spec: FRP 0→3px, 100→8px, 1000→15px
        'circle-radius': [
          'interpolate', ['linear'], ['get', 'frp'],
          0,    3,
          100,  8,
          1000, 15,
        ],
        'circle-color':        '#ff8c00',
        'circle-opacity':      0.6,
        'circle-blur':         0.4,
        'circle-stroke-width': 1,
        'circle-stroke-color': 'rgba(255,140,0,0.4)',
      },
    })
  }
}

// ── RAF pulse animation for glow ring ─────────────────────────────────────────
function startPulse(map, rafRef) {
  if (rafRef.current) return   // already running

  let pulseStart = null
  let cancelled  = false

  function animate(timestamp) {
    if (cancelled) return
    if (!pulseStart) pulseStart = timestamp

    // 2-second cycle: expand radius 6→22px, fade opacity 0.45→0
    const t = ((timestamp - pulseStart) % 2000) / 2000
    const r = 6 + t * 16
    const o = 0.45 * (1 - t)

    try {
      if (map.getLayer(LAYER_GLOW)) {
        map.setPaintProperty(LAYER_GLOW, 'circle-radius',  r)
        map.setPaintProperty(LAYER_GLOW, 'circle-opacity', o)
        map.triggerRepaint()
      }
    } catch (_) { return }

    rafRef.current = requestAnimationFrame(animate)
  }

  rafRef.current = requestAnimationFrame(animate)

  // Expose cancel via object so stopPulse can access it
  rafRef._cancel = () => { cancelled = true }
}

function stopPulse(rafRef) {
  if (rafRef._cancel) { rafRef._cancel(); rafRef._cancel = null }
  if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
}

// ── Clean up ──────────────────────────────────────────────────────────────────
function removeLayers(map, popupRef) {
  if (!map || !map.getLayer) return
  if (popupRef?.current) { popupRef.current.remove(); popupRef.current = null }
  for (const id of [LAYER_GLOW, LAYER_CORE]) {
    try { if (map.getLayer(id))   map.removeLayer(id)   } catch (_) {}
  }
  try { if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID) } catch (_) {}
}

function safeSetVisibility(map, layerId, visibility) {
  try {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visibility)
    }
  } catch (_) {}
}
