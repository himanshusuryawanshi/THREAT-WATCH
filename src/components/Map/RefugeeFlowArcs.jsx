/**
 * RefugeeFlowArcs — UNHCR refugee flow arcs on the Mapbox globe.
 *
 * BLUEPRINT: Refugee Flow Arcs layer — animated flow lines showing
 * displacement: origin country → asylum country.
 * Color: cyan (#00d4ff), width proportional to log(refugees), opacity 0.5.
 * Distinct from strike arcs (cyan vs red, no animation required).
 *
 * Fetches /api/displacement/flows (top 50 bilateral flows).
 * Only visible when layers.refugeeFlows is true (default false).
 */
import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import useStore from '../../store/useStore'

const SOURCE_ID     = 'refugee-flows'
const LAYER_LINES   = 'refugee-flow-lines'
const LAYER_ARROWS  = 'refugee-flow-arrows'
const API_BASE      = 'http://localhost:3001'

// Build a great-circle arc via interpolated midpoint
function buildArc(originLng, originLat, asylumLng, asylumLat, steps = 32) {
  const coords = []
  for (let i = 0; i <= steps; i++) {
    const t   = i / steps
    const lng = originLng + (asylumLng - originLng) * t
    const lat = originLat + (asylumLat - originLat) * t
    // Add a vertical curve by bowing upward
    const bow = Math.sin(Math.PI * t) * 12   // 12° peak bow
    coords.push([lng, lat + bow])
  }
  return coords
}

function buildGeoJSON(flows) {
  const maxRef = Math.max(...flows.map(f => f.refugees), 1)
  return {
    type: 'FeatureCollection',
    features: flows
      .filter(f => f.origin_lng && f.origin_lat && f.asylum_lng && f.asylum_lat)
      .map(f => {
        const coords = buildArc(
          f.origin_lng, f.origin_lat,
          f.asylum_lng, f.asylum_lat
        )
        // Log scale width: 1–4px
        const logScale = Math.log10(Math.max(f.refugees, 1)) / Math.log10(maxRef)
        const lineWidth = 1 + logScale * 3

        return {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: {
            country_origin:  f.country_origin,
            country_asylum:  f.country_asylum,
            refugees:        f.refugees,
            line_width:      Math.max(0.5, lineWidth),
          },
        }
      }),
  }
}

function addLayers(map, geojson) {
  removeLayers(map)

  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: 'geojson', data: geojson })
  } else {
    map.getSource(SOURCE_ID).setData(geojson)
  }

  if (!map.getLayer(LAYER_LINES)) {
    map.addLayer({
      id:     LAYER_LINES,
      type:   'line',
      source: SOURCE_ID,
      layout: {
        'line-join': 'round',
        'line-cap':  'round',
      },
      paint: {
        'line-color':   '#00d4ff',
        'line-width':   ['get', 'line_width'],
        'line-opacity': 0.5,
        'line-blur':    0.5,
      },
    })
  }
}

function removeLayers(map) {
  if (!map || !map.getLayer) return
  try { if (map.getLayer(LAYER_ARROWS)) map.removeLayer(LAYER_ARROWS) } catch (_) {}
  try { if (map.getLayer(LAYER_LINES))  map.removeLayer(LAYER_LINES)  } catch (_) {}
  try { if (map.getSource(SOURCE_ID))   map.removeSource(SOURCE_ID)   } catch (_) {}
}

function safeSetVisibility(map, layerId, visibility) {
  try {
    if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', visibility)
  } catch (_) {}
}

export default function RefugeeFlowArcs({ map, ready, styleVersion = 0 }) {
  const layers  = useStore(s => s.layers)
  const popupRef = useRef(null)
  const [flows, setFlows] = useState([])

  // Fetch top 50 bilateral flows once
  useEffect(() => {
    fetch(`${API_BASE}/api/displacement/flows?limit=50`)
      .then(r => r.json())
      .then(data => Array.isArray(data) ? setFlows(data) : null)
      .catch(() => null)
  }, [])

  // Add/remove layers when map/flows/style changes
  useEffect(() => {
    if (!map || !ready || !flows.length) return
    const geojson = buildGeoJSON(flows)
    addLayers(map, geojson)
    return () => removeLayers(map)
  }, [map, ready, flows, styleVersion])

  // Toggle visibility
  useEffect(() => {
    if (!map || !ready) return
    const vis = layers.refugeeFlows ? 'visible' : 'none'
    safeSetVisibility(map, LAYER_LINES, vis)
  }, [map, ready, layers.refugeeFlows, styleVersion])

  // Hover tooltip
  useEffect(() => {
    if (!map || !ready || !flows.length) return

    function onEnter(e) {
      map.getCanvas().style.cursor = 'pointer'
      const p = e.features[0].properties
      const formatted = parseInt(p.refugees).toLocaleString()
      if (popupRef.current) { popupRef.current.remove(); popupRef.current = null }
      popupRef.current = new mapboxgl.Popup({
        closeButton: false, closeOnClick: false, offset: 10, className: 'tw-popup',
      })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="min-width:180px;font-family:'JetBrains Mono',monospace">
            <div style="color:#00d4ff;font-size:9px;letter-spacing:2px;margin-bottom:4px">REFUGEE FLOW</div>
            <div style="color:#fff;font-size:12px;font-family:'DM Sans',sans-serif;font-weight:600;margin-bottom:4px">
              ${p.country_origin} → ${p.country_asylum}
            </div>
            <div style="color:#60a5fa;font-size:11px;font-weight:bold">${formatted} refugees</div>
            <div style="color:#4b5563;font-size:8px;margin-top:4px;letter-spacing:1px">UNHCR 2024</div>
          </div>
        `)
        .addTo(map)
    }

    function onLeave() {
      map.getCanvas().style.cursor = ''
      if (popupRef.current) { popupRef.current.remove(); popupRef.current = null }
    }

    if (map.getLayer(LAYER_LINES)) {
      map.on('mouseenter', LAYER_LINES, onEnter)
      map.on('mouseleave', LAYER_LINES, onLeave)
    }

    return () => {
      if (!map || !map.getLayer) return
      map.off('mouseenter', LAYER_LINES, onEnter)
      map.off('mouseleave', LAYER_LINES, onLeave)
      if (popupRef.current) { popupRef.current.remove(); popupRef.current = null }
    }
  }, [map, ready, flows, styleVersion])

  return null
}
