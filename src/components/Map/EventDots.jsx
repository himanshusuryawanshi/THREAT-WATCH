/**
 * EventDots — UCDP conflict event circles on the Mapbox globe.
 *
 * BLUEPRINT Rule 1: ONLY UCDP data (source = 'UCDP' or 'UCDP_CANDIDATE')
 * is plotted as individual dots on the map. Both are treated identically.
 *
 * Fetches /api/events?limit=2000 which returns both UCDP + UCDP_CANDIDATE.
 * Circle size scales with fatalities. Color maps to event type.
 * Click → sets selectedEvent in store (InfoPanel reads it).
 * Hover → pointer cursor + mapbox tooltip.
 */
import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import useStore from '../../store/useStore'
import {
  CIRCLE_COLOR_EXPRESSION,
  CIRCLE_RADIUS_BY_FATALITIES,
  EVENT_TYPE_COLORS,
  DEFAULT_COLOR,
  isMapPlottable,
} from '../../store/visualizationRules'

const API_BASE = 'http://localhost:3001'
const SOURCE_ID = 'ucdp-events'
const LAYER_GLOW = 'ucdp-events-glow'
const LAYER_DOTS = 'ucdp-events-dots'

export default function EventDots({ map, ready }) {
  const setSelectedEvent = useStore(s => s.setSelectedEvent)
  const layers           = useStore(s => s.layers)
  const popupRef         = useRef(null)
  const [events, setEvents] = useState([])
  const mountedRef       = useRef(true)

  // ── Fetch UCDP events on mount ──────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true
    fetch(`${API_BASE}/api/events?limit=2000`)
      .then(r => r.json())
      .then(({ events: data }) => {
        if (!mountedRef.current) return
        // Both UCDP and UCDP_CANDIDATE are plottable — filter out anything else
        const plottable = (data || []).filter(isMapPlottable)
        setEvents(plottable)
        console.log(`[EventDots] loaded ${plottable.length} plottable events`)
      })
      .catch(err => console.error('[EventDots] fetch failed:', err.message))

    return () => { mountedRef.current = false }
  }, [])

  // ── Add/remove Mapbox layers when map, events, or ready state change ────
  useEffect(() => {
    if (!map || !ready || !events.length) return

    const geojson = buildGeoJSON(events)
    addLayers(map, geojson)

    return () => removeLayers(map, popupRef)
  }, [map, ready, events])

  // ── Toggle visibility from store ────────────────────────────────────────
  useEffect(() => {
    if (!map || !ready) return
    const visibility = layers.eventDots ? 'visible' : 'none'
    safeSetVisibility(map, LAYER_GLOW, visibility)
    safeSetVisibility(map, LAYER_DOTS, visibility)
  }, [map, ready, layers.eventDots])

  // ── Wire up Mapbox event handlers ───────────────────────────────────────
  useEffect(() => {
    if (!map || !ready || !events.length) return

    function onMouseEnter(e) {
      map.getCanvas().style.cursor = 'pointer'
      const props = e.features[0].properties

      // Resolve color for tooltip accent
      const color = EVENT_TYPE_COLORS[props.type] || DEFAULT_COLOR

      if (popupRef.current) { popupRef.current.remove(); popupRef.current = null }
      popupRef.current = new mapboxgl.Popup({
        closeButton:  false,
        closeOnClick: false,
        offset:       14,
        className:    'tw-popup',
      })
        .setLngLat(e.features[0].geometry.coordinates.slice())
        .setHTML(`
          <div style="min-width:190px;font-family:'JetBrains Mono',monospace">
            <div style="color:${color};font-size:9px;letter-spacing:2px;margin-bottom:4px;text-transform:uppercase">
              ${(props.type || 'unknown').replace(/_/g,' ')}
            </div>
            <div style="color:#fff;font-size:12px;font-family:'DM Sans',sans-serif;font-weight:600;margin-bottom:6px">
              ${props.country}
            </div>
            <div style="color:#9ca3af;font-size:10px;margin-bottom:2px">${props.date?.substring(0,10) || ''}</div>
            <div style="color:#ef4444;font-size:10px;font-weight:bold">
              ${props.fatalities > 0 ? `${props.fatalities} fatalities` : 'No fatalities reported'}
            </div>
            <div style="color:#6b7280;font-size:8px;margin-top:4px;letter-spacing:1px">
              ${props.source}
            </div>
          </div>
        `)
        .addTo(map)
    }

    function onMouseLeave() {
      map.getCanvas().style.cursor = ''
      if (popupRef.current) { popupRef.current.remove(); popupRef.current = null }
    }

    function onClick(e) {
      e.preventDefault()
      const props = e.features[0].properties
      // Find the full event object so InfoPanel gets all fields
      const full = events.find(ev => String(ev.id) === String(props.id)) || props
      setSelectedEvent({
        id:              full.id,
        source:          full.source,
        type:            full.type,
        subtype:         full.subtype,
        date:            full.date,
        country:         full.country,
        location:        full.location,
        actor1:          full.actor1,
        actor2:          full.actor2,
        fatalities:      full.fatalities,
        fatalities_low:  full.fatalities_low,
        fatalities_high: full.fatalities_high,
        notes:           full.notes,
        url:             full.url,
        lat:             full.lat,
        lng:             full.lng,
      })
    }

    if (map.getLayer(LAYER_DOTS)) {
      map.on('mouseenter', LAYER_DOTS, onMouseEnter)
      map.on('mouseleave', LAYER_DOTS, onMouseLeave)
      map.on('click',      LAYER_DOTS, onClick)
    }

    return () => {
      if (!map || !map.getLayer) return
      map.off('mouseenter', LAYER_DOTS, onMouseEnter)
      map.off('mouseleave', LAYER_DOTS, onMouseLeave)
      map.off('click',      LAYER_DOTS, onClick)
    }
  }, [map, ready, events])

  // Nothing rendered — this is a pure Mapbox layer controller
  return null
}

// ── Build GeoJSON FeatureCollection from events array ────────────────────────
function buildGeoJSON(events) {
  return {
    type: 'FeatureCollection',
    features: events
      .filter(e => e.lat && e.lng && !isNaN(e.lat) && !isNaN(e.lng))
      .map(e => ({
        type: 'Feature',
        geometry: {
          type:        'Point',
          coordinates: [parseFloat(e.lng), parseFloat(e.lat)],
        },
        properties: {
          id:              e.id,
          source:          e.source,
          type:            e.type  || 'unknown',
          date:            e.date,
          country:         e.country  || '',
          location:        e.location || '',
          actor1:          e.actor1   || '',
          actor2:          e.actor2   || '',
          fatalities:      parseInt(e.fatalities)      || 0,
          fatalities_low:  parseInt(e.fatalities_low)  || 0,
          fatalities_high: parseInt(e.fatalities_high) || 0,
          notes:           e.notes    || '',
        },
      })),
  }
}

// ── Add Mapbox source + layers ────────────────────────────────────────────────
function addLayers(map, geojson) {
  // Remove previous if exists (e.g. after style change)
  removeLayers(map, { current: null })

  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: 'geojson', data: geojson })
  } else {
    map.getSource(SOURCE_ID).setData(geojson)
  }

  // Glow layer — soft outer ring
  if (!map.getLayer(LAYER_GLOW)) {
    map.addLayer({
      id:     LAYER_GLOW,
      type:   'circle',
      source: SOURCE_ID,
      paint: {
        'circle-radius':  ['interpolate', ['linear'], ['get', 'fatalities'], 0, 6, 1, 9, 50, 18, 500, 28],
        'circle-color':   CIRCLE_COLOR_EXPRESSION,
        'circle-opacity': 0.15,
        'circle-blur':    1.2,
      },
    })
  }

  // Core dot layer
  if (!map.getLayer(LAYER_DOTS)) {
    map.addLayer({
      id:     LAYER_DOTS,
      type:   'circle',
      source: SOURCE_ID,
      paint: {
        'circle-radius':       CIRCLE_RADIUS_BY_FATALITIES,
        'circle-color':        CIRCLE_COLOR_EXPRESSION,
        'circle-opacity':      0.8,
        'circle-stroke-width': 1,
        'circle-stroke-color': 'rgba(255,255,255,0.3)',
      },
    })
  }
}

// ── Clean up Mapbox layers + sources ─────────────────────────────────────────
function removeLayers(map, popupRef) {
  if (!map || !map.getLayer) return
  if (popupRef?.current) { popupRef.current.remove(); popupRef.current = null }
  for (const id of [LAYER_GLOW, LAYER_DOTS]) {
    try { if (map.getLayer(id))   map.removeLayer(id)   } catch (_) {}
  }
  try { if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID) } catch (_) {}
}

// ── Safe visibility toggle ────────────────────────────────────────────────────
function safeSetVisibility(map, layerId, visibility) {
  try {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visibility)
    }
  } catch (_) {}
}
