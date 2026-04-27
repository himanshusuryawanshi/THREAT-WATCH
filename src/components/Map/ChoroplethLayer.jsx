/**
 * ChoroplethLayer — Country intensity fill on the globe.
 *
 * Fetches /api/geo/choropleth?timeframe=30d → event counts per country.
 * Uses Mapbox built-in country-boundaries-v1 tileset for polygons.
 * Color: navy (#1a1a2e, 0 events) → purple (#6b1d5e) → red (#e94560, many).
 * Inserted below event-dot layers using a known dark-v11 before-layer.
 *
 * Only renders when layers.choropleth is true.
 * Click → navigate to /country/{name}.
 */
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import mapboxgl from 'mapbox-gl'
import useStore from '../../store/useStore'

const API_BASE    = 'http://localhost:3001'
const MB_SOURCE   = 'tw-country-boundaries'
const SRC_LAYER   = 'country_boundaries'
const FILL_ID     = 'tw-choropleth-fill'
const STROKE_ID   = 'tw-choropleth-stroke'

// ── Color interpolation ───────────────────────────────────────────────────────
function hexToRgb(h) {
  return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]
}
function lerp(a, b, t) {
  const [ar,ag,ab] = hexToRgb(a), [br,bg,bb] = hexToRgb(b)
  const r = Math.round(ar+(br-ar)*t), g = Math.round(ag+(bg-ag)*t), bl = Math.round(ab+(bb-ab)*t)
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${bl.toString(16).padStart(2,'0')}`
}

function colorForCount(count, max) {
  if (!count || count === 0 || !max) return '#111827'
  const t = Math.pow(Math.min(count / max, 1), 0.4)  // power curve so small counts still show
  if (t < 0.15) return lerp('#111827', '#2d1b4e', t / 0.15)
  if (t < 0.35) return lerp('#2d1b4e', '#6b1d5e', (t - 0.15) / 0.20)
  if (t < 0.60) return lerp('#6b1d5e', '#c0264e', (t - 0.35) / 0.25)
  if (t < 0.80) return lerp('#c0264e', '#e94560', (t - 0.60) / 0.20)
  return               lerp('#e94560', '#ff6b6b', (t - 0.80) / 0.20)
}

// Country name → ISO 3166-1 alpha-3 mapping (covers all major conflict countries in UCDP)
const COUNTRY_TO_ISO3 = {
  'Afghanistan': 'AFG', 'Albania': 'ALB', 'Algeria': 'DZA', 'Angola': 'AGO',
  'Armenia': 'ARM', 'Azerbaijan': 'AZE', 'Bahrain': 'BHR', 'Bangladesh': 'BGD',
  'Belarus': 'BLR', 'Bolivia': 'BOL', 'Bosnia and Herzegovina': 'BIH',
  'Brazil': 'BRA', 'Burkina Faso': 'BFA', 'Burundi': 'BDI', 'Cambodia': 'KHM',
  'Cameroon': 'CMR', 'Central African Republic': 'CAF', 'Chad': 'TCD',
  'Chile': 'CHL', 'China': 'CHN', 'Colombia': 'COL', 'Congo': 'COG',
  'Côte d\'Ivoire': 'CIV', "Cote d'Ivoire": 'CIV', 'Croatia': 'HRV',
  'Cuba': 'CUB', 'Democratic Republic of the Congo': 'COD', 'DR Congo': 'COD',
  'DRC': 'COD', 'Djibouti': 'DJI', 'Dominican Republic': 'DOM', 'Ecuador': 'ECU',
  'Egypt': 'EGY', 'El Salvador': 'SLV', 'Eritrea': 'ERI', 'Ethiopia': 'ETH',
  'France': 'FRA', 'Gabon': 'GAB', 'Georgia': 'GEO', 'Ghana': 'GHA',
  'Greece': 'GRC', 'Guatemala': 'GTM', 'Guinea': 'GIN', 'Guinea-Bissau': 'GNB',
  'Haiti': 'HTI', 'Honduras': 'HND', 'India': 'IND', 'Indonesia': 'IDN',
  'Iran': 'IRN', 'Iraq': 'IRQ', 'Israel': 'ISR', 'Jamaica': 'JAM',
  'Jordan': 'JOR', 'Kazakhstan': 'KAZ', 'Kenya': 'KEN', 'Kosovo': 'XKX',
  'Kuwait': 'KWT', 'Kyrgyzstan': 'KGZ', 'Laos': 'LAO', 'Lebanon': 'LBN',
  'Liberia': 'LBR', 'Libya': 'LBY', 'Madagascar': 'MDG', 'Malawi': 'MWI',
  'Malaysia': 'MYS', 'Mali': 'MLI', 'Mauritania': 'MRT', 'Mexico': 'MEX',
  'Moldova': 'MDA', 'Morocco': 'MAR', 'Mozambique': 'MOZ', 'Myanmar': 'MMR',
  'Namibia': 'NAM', 'Nepal': 'NPL', 'Nicaragua': 'NIC', 'Niger': 'NER',
  'Nigeria': 'NGA', 'North Korea': 'PRK', 'Pakistan': 'PAK',
  'Palestinian Territories': 'PSE', 'Palestine': 'PSE', 'Gaza': 'PSE',
  'Panama': 'PAN', 'Papua New Guinea': 'PNG', 'Paraguay': 'PRY', 'Peru': 'PER',
  'Philippines': 'PHL', 'Russia': 'RUS', 'Rwanda': 'RWA',
  'Saudi Arabia': 'SAU', 'Senegal': 'SEN', 'Serbia': 'SRB',
  'Sierra Leone': 'SLE', 'Somalia': 'SOM', 'South Africa': 'ZAF',
  'South Korea': 'KOR', 'South Sudan': 'SSD', 'Spain': 'ESP', 'Sri Lanka': 'LKA',
  'Sudan': 'SDN', 'Syria': 'SYR', 'Tajikistan': 'TJK', 'Tanzania': 'TZA',
  'Thailand': 'THA', 'Timor-Leste': 'TLS', 'Togo': 'TGO', 'Trinidad and Tobago': 'TTO',
  'Tunisia': 'TUN', 'Turkey': 'TUR', 'Türkiye': 'TUR', 'Turkmenistan': 'TKM',
  'Uganda': 'UGA', 'Ukraine': 'UKR', 'United States': 'USA',
  'United States of America': 'USA', 'Uzbekistan': 'UZB', 'Venezuela': 'VEN',
  'Vietnam': 'VNM', 'Yemen': 'YEM', 'Zambia': 'ZMB', 'Zimbabwe': 'ZWE',
}

// Build Mapbox `match` expression for fill-color by ISO-3 code
function buildMatchExpr(countries, max) {
  const expr = ['match', ['get', 'iso_3166_1_alpha_3']]
  countries.forEach(c => {
    const iso = COUNTRY_TO_ISO3[c.country]
    if (iso) {
      expr.push(iso, colorForCount(c.event_count, max))
    }
  })
  expr.push('#111827')  // fallback
  return expr
}

// ── Add source + fill/stroke layers to the map ────────────────────────────────
function addMapLayers(map, countries, choroplethVisible) {
  if (!map.isStyleLoaded()) return false

  const max       = Math.max(...countries.map(c => c.event_count || 0), 1)
  const matchExpr = buildMatchExpr(countries, max)

  if (!map.getSource(MB_SOURCE)) {
    map.addSource(MB_SOURCE, {
      type:      'vector',
      url:       'mapbox://mapbox.country-boundaries-v1',
      promoteId: { [SRC_LAYER]: 'iso_3166_1_alpha_3' },
    })
  }

  const beforeLayer = map.getLayer('country-label') ? 'country-label' : undefined

  if (!map.getLayer(FILL_ID)) {
    map.addLayer({
      id:     FILL_ID,
      type:   'fill',
      source: MB_SOURCE,
      'source-layer': SRC_LAYER,
      paint: {
        'fill-color':   matchExpr,
        'fill-opacity': [
          'case', ['boolean', ['feature-state', 'hover'], false], 0.45, 0.22,
        ],
      },
      layout: { visibility: choroplethVisible ? 'visible' : 'none' },
    }, beforeLayer)
  }

  if (!map.getLayer(STROKE_ID)) {
    map.addLayer({
      id:     STROKE_ID,
      type:   'line',
      source: MB_SOURCE,
      'source-layer': SRC_LAYER,
      paint: {
        'line-color': 'rgba(255,255,255,0.07)',
        'line-width': 0.5,
      },
      layout: { visibility: choroplethVisible ? 'visible' : 'none' },
    }, beforeLayer)
  }

  return true
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ChoroplethLayer({ map, ready, styleVersion = 0 }) {
  const layers     = useStore(s => s.layers)
  const timeframe  = useStore(s => s.timeframe)
  const customFrom = useStore(s => s.customFrom)
  const customTo   = useStore(s => s.customTo)
  const navigate   = useNavigate()
  const popupRef   = useRef(null)
  const dataRef    = useRef([])
  const addedRef   = useRef(false)

  // ── Add layers on mount, after style change, or after timeframe change ───
  useEffect(() => {
    if (!map || !ready) return

    // Clean up any stale layers from the previous style / timeframe
    try { if (map.getLayer(FILL_ID))    map.removeLayer(FILL_ID)   } catch (_) {}
    try { if (map.getLayer(STROKE_ID))  map.removeLayer(STROKE_ID) } catch (_) {}
    try { if (map.getSource(MB_SOURCE)) map.removeSource(MB_SOURCE) } catch (_) {}
    addedRef.current = false
    dataRef.current  = []   // clear cache so new timeframe fetches fresh data

    const applyData = (countries) => {
      if (!countries.length) return
      dataRef.current = countries
      const ok = addMapLayers(map, countries, layers.choropleth)
      if (!ok) return
      addedRef.current = true

      // ── Hover ───────────────────────────────────────────────────────────
      let hoveredId = null

      function onMouseMove(e) {
        if (!e.features?.length) return
        const feat  = e.features[0]
        const isoA3 = feat.properties?.iso_3166_1_alpha_3

        if (hoveredId !== null && hoveredId !== isoA3) {
          map.setFeatureState({ source: MB_SOURCE, sourceLayer: SRC_LAYER, id: hoveredId }, { hover: false })
        }
        hoveredId = isoA3
        if (isoA3) {
          map.setFeatureState({ source: MB_SOURCE, sourceLayer: SRC_LAYER, id: isoA3 }, { hover: true })
        }

        map.getCanvas().style.cursor = 'pointer'
        const nameEn = feat.properties?.name_en || ''
        const cd   = dataRef.current.find(c =>
          COUNTRY_TO_ISO3[c.country] === isoA3 ||
          c.country === nameEn
        )
        const name = cd?.country || nameEn || isoA3 || '—'

        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({
          closeButton: false, closeOnClick: false, offset: 6, className: 'tw-popup',
        })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family:'DM Sans',sans-serif;min-width:130px">
              <div style="color:#fff;font-size:13px;font-weight:600;margin-bottom:4px">${name}</div>
              ${cd
                ? `<div style="color:#ef4444;font-size:10px;font-family:'JetBrains Mono',monospace">
                     ${cd.event_count.toLocaleString()} events · 30d
                   </div>
                   <div style="color:#9ca3af;font-size:9px;font-family:'JetBrains Mono',monospace">
                     ${(cd.fatalities||0).toLocaleString()} fatalities
                   </div>`
                : `<div style="color:#4b5563;font-size:9px;font-family:'JetBrains Mono',monospace">
                     No UCDP events on record
                   </div>`
              }
            </div>
          `)
          .addTo(map)
      }

      function onMouseLeave() {
        if (hoveredId !== null) {
          map.setFeatureState({ source: MB_SOURCE, sourceLayer: SRC_LAYER, id: hoveredId }, { hover: false })
          hoveredId = null
        }
        map.getCanvas().style.cursor = ''
        if (popupRef.current) { popupRef.current.remove(); popupRef.current = null }
      }

      function onClick(e) {
        if (!e.features?.length) return
        e.preventDefault()
        const isoA3  = e.features[0].properties?.iso_3166_1_alpha_3
        const nameEn = e.features[0].properties?.name_en || ''
        const cd     = dataRef.current.find(c =>
          COUNTRY_TO_ISO3[c.country] === isoA3 || c.country === nameEn
        )
        const name   = cd?.country || nameEn
        if (name) navigate(`/country/${encodeURIComponent(name)}`)
      }

      map.on('mousemove', FILL_ID, onMouseMove)
      map.on('mouseleave', FILL_ID, onMouseLeave)
      map.on('click',     FILL_ID, onClick)
    }

    // Build choropleth URL with active timeframe
    const params = new URLSearchParams()
    if (timeframe === 'custom' && customFrom && customTo) {
      params.set('from', customFrom)
      params.set('to',   customTo)
    } else {
      params.set('timeframe', timeframe || '30d')
    }

    fetch(`${API_BASE}/api/geo/choropleth?${params}`)
      .then(r => r.json())
      .then(({ countries = [] }) => applyData(countries))
      .catch(err => console.warn('[ChoroplethLayer] fetch failed:', err.message))

    return () => {
      if (popupRef.current) { popupRef.current.remove(); popupRef.current = null }
      try { if (map.getLayer(FILL_ID))    map.removeLayer(FILL_ID)   } catch (_) {}
      try { if (map.getLayer(STROKE_ID))  map.removeLayer(STROKE_ID) } catch (_) {}
      try { if (map.getSource(MB_SOURCE)) map.removeSource(MB_SOURCE) } catch (_) {}
      addedRef.current = false
    }
  }, [map, ready, styleVersion, timeframe, customFrom, customTo])

  // ── Toggle visibility ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!map || !ready || !addedRef.current) return
    const vis = layers.choropleth ? 'visible' : 'none'
    try { if (map.getLayer(FILL_ID))   map.setLayoutProperty(FILL_ID,   'visibility', vis) } catch (_) {}
    try { if (map.getLayer(STROKE_ID)) map.setLayoutProperty(STROKE_ID, 'visibility', vis) } catch (_) {}
    if (!layers.choropleth && popupRef.current) { popupRef.current.remove(); popupRef.current = null }
  }, [map, ready, layers.choropleth])

  return null
}
