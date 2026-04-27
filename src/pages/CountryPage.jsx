/**
 * CountryPage — Country Intelligence deep-dive.
 *
 * Route: /country/:name
 *
 * Sections (scrollable):
 *   Header → Quick Stats → Country Map → Event Timeline →
 *   Latest News + Humanitarian Situation → Top Actors → Recent Events
 *
 * All data fetched from real backend APIs (no derived-from-store fallbacks).
 * Every section gracefully handles empty/error data.
 */
import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState, useCallback } from 'react'
import useStore from '../store/useStore'
import Chart from 'chart.js/auto'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  CIRCLE_COLOR_EXPRESSION,
  CIRCLE_RADIUS_BY_FATALITIES,
  EVENT_TYPE_COLORS,
  isMapPlottable,
} from '../store/visualizationRules'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const API = 'http://localhost:3001'

// ── Country centroids — fall back to fitBounds if not listed ─────────────────
const CENTROIDS = {
  'Ukraine':           { center: [32,   49],   zoom: 5.5 },
  'Russia':            { center: [60,   60],   zoom: 3   },
  'Sudan':             { center: [30,   15],   zoom: 5   },
  'South Sudan':       { center: [31,    7],   zoom: 5   },
  'Myanmar':           { center: [96,   19],   zoom: 5   },
  'Syria':             { center: [38,   35],   zoom: 6   },
  'Afghanistan':       { center: [67,   33],   zoom: 5   },
  'Ethiopia':          { center: [40,    9],   zoom: 5   },
  'Somalia':           { center: [46,    5],   zoom: 5   },
  'Yemen':             { center: [48,   15],   zoom: 6   },
  'Iraq':              { center: [44,   33],   zoom: 6   },
  'Mali':              { center: [ -2,  17],   zoom: 5   },
  'Nigeria':           { center: [  8,  10],   zoom: 5   },
  'Democratic Republic of Congo': { center: [24, -2], zoom: 4 },
  'Libya':             { center: [17,   27],   zoom: 5   },
  'Pakistan':          { center: [69,   30],   zoom: 5   },
  'India':             { center: [78,   22],   zoom: 4   },
  'Israel':            { center: [34.8, 31.5], zoom: 7.5 },
  'Palestine':         { center: [35.2, 31.8], zoom: 8   },
  'Colombia':          { center: [-74,   4],   zoom: 5   },
  'Mexico':            { center: [-100, 23],   zoom: 4   },
  'Cameroon':          { center: [12,    6],   zoom: 5   },
  'Central African Republic': { center: [20, 6], zoom: 5 },
  'Mozambique':        { center: [35,  -18],   zoom: 5   },
  'Haiti':             { center: [-72,  19],   zoom: 7   },
  'Iran':              { center: [53,   33],   zoom: 5   },
  'Turkey':            { center: [35,   39],   zoom: 5   },
  'Philippines':       { center: [121,  13],   zoom: 5   },
  'Burkina Faso':      { center: [ -2,  12],   zoom: 5   },
  'Niger':             { center: [  9,  17],   zoom: 5   },
  'Chad':              { center: [18,   15],   zoom: 5   },
  'Zambia':            { center: [27,  -14],   zoom: 5   },
  'Zimbabwe':          { center: [29,  -20],   zoom: 6   },
  'Venezuela':         { center: [-66,   8],   zoom: 5   },
  'Indonesia':         { center: [115,  -5],   zoom: 4   },
}

function getCentroid(country) {
  return CENTROIDS[country] || null
}

function getStatus(count30d) {
  if (count30d > 100) return { label: 'Active Conflict Zone',  color: '#ef4444' }
  if (count30d > 20)  return { label: 'Elevated Tensions',     color: '#f97316' }
  if (count30d > 0)   return { label: 'Monitoring',            color: '#fbbf24' }
  return                     { label: 'Low Activity',           color: '#6b7280' }
}

function relTime(d) {
  if (!d) return ''
  const h = Math.floor((Date.now() - new Date(d)) / 3_600_000)
  if (h < 1)  return 'just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function fmtNum(n) {
  if (!n && n !== 0) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString()
}

// Aggregate daily trend to weekly buckets for the chart
function toWeekly(trend = []) {
  const weeks = {}
  trend.forEach(({ date, events }) => {
    const d   = new Date(date)
    const mon = new Date(d)
    mon.setDate(d.getDate() - d.getDay() + 1)   // Monday of week
    const key = mon.toISOString().substring(0, 10)
    weeks[key] = (weeks[key] || 0) + (parseInt(events) || 0)
  })
  const keys = Object.keys(weeks).sort()
  return { labels: keys, data: keys.map(k => weeks[k]) }
}

// ── Styles shared across sections ─────────────────────────────────────────────
const S = {
  card: {
    background:   'rgba(255,255,255,0.02)',
    border:       '0.5px solid #1f2937',
    borderRadius:  8,
    padding:      '16px 20px',
    marginBottom: 16,
  },
  sectionHdr: {
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:       9,
    letterSpacing: '2px',
    color:         '#4b5563',
    textTransform: 'uppercase',
    marginBottom:  14,
  },
  page: {
    height:      '100%',
    overflowY:   'auto',
    overflowX:   'hidden',
    background:  '#0a0a1a',
    color:       '#e2e8f0',
    fontFamily:  "'DM Sans', sans-serif",
    paddingBottom: 40,
  },
}

// ─────────────────────────────────────────────────────────────────────────────
export default function CountryPage() {
  const { name } = useParams()
  const navigate = useNavigate()
  const country  = decodeURIComponent(name || '')

  // ── Global timeframe from store ────────────────────────────────────────────
  const globalTimeframe  = useStore(s => s.timeframe)
  const globalCustomFrom = useStore(s => s.customFrom)
  const globalCustomTo   = useStore(s => s.customTo)

  // ── Data state ──────────────────────────────────────────────────────────────
  const [events,         setEvents]         = useState([])
  const [stats30d,       setStats30d]       = useState(null)
  const [firesCount,     setFiresCount]     = useState(null)
  const [context,        setContext]        = useState(null)
  const [timeframeStats, setTimeframeStats] = useState(null)
  const [displacement,   setDisplacement]   = useState(null)
  // Local chart timeframe — initialized from global, can be overridden per-page
  const [timeframe,      setTimeframe]      = useState(globalTimeframe === 'custom' ? '30d' : (globalTimeframe || '30d'))
  const [loading,        setLoading]        = useState(true)
  const [tfLoading,      setTfLoading]      = useState(false)

  // Build a fetch URL with the active timeframe params
  function tfParams(tf) {
    if (tf === 'custom' && globalCustomFrom && globalCustomTo)
      return `from=${globalCustomFrom}&to=${globalCustomTo}`
    return `timeframe=${tf || '30d'}`
  }

  // ── Fetch all data in parallel on mount (or when country / global tf changes)
  useEffect(() => {
    if (!country) return
    setLoading(true)

    // Use global timeframe for stats; always fetch all events for map dots
    const statsTf = tfParams(globalTimeframe)

    Promise.all([
      fetch(`${API}/api/events?country=${encodeURIComponent(country)}&source=ucdp&limit=2000&${statsTf}`)
        .then(r => r.json()).then(d => d.events || []).catch(() => []),

      fetch(`${API}/api/events/stats?country=${encodeURIComponent(country)}&${statsTf}`)
        .then(r => r.json()).catch(() => null),

      fetch(`${API}/api/fires/stats`)
        .then(r => r.json()).catch(() => null),

      fetch(`${API}/api/context/country/${encodeURIComponent(country)}`)
        .then(r => r.json()).catch(() => null),

      // Timeline: use local timeframe selector
      fetch(`${API}/api/events/stats?country=${encodeURIComponent(country)}&${tfParams(timeframe)}`)
        .then(r => r.json()).catch(() => null),

      // UNHCR displacement data for this country
      fetch(`${API}/api/displacement/country/${encodeURIComponent(country)}`)
        .then(r => r.json()).catch(() => null),
    ]).then(([evts, st, fires, ctx, tfSt, disp]) => {
      setEvents(evts)
      setStats30d(st)
      setFiresCount(fires?.by_country?.find(
        r => r.country?.toLowerCase() === country.toLowerCase()
      )?.fire_count ?? null)
      setContext(ctx)
      setTimeframeStats(tfSt)
      setDisplacement(disp)
      setLoading(false)
    })
  }, [country, globalTimeframe, globalCustomFrom, globalCustomTo])

  // ── Re-fetch chart stats when local timeframe button clicked ───────────────
  useEffect(() => {
    if (loading) return
    setTfLoading(true)
    fetch(`${API}/api/events/stats?country=${encodeURIComponent(country)}&${tfParams(timeframe)}`)
      .then(r => r.json())
      .then(d => { setTimeframeStats(d); setTfLoading(false) })
      .catch(() => setTfLoading(false))
  }, [timeframe])

  // ── Derived stats ──────────────────────────────────────────────────────────
  const events30d   = stats30d?.event_count   || 0
  const fatal30d    = stats30d?.fatalities    || 0
  const displaced   = context?.crisis_figures?.people_displaced || null
  const status      = getStatus(events30d)

  // Actor counts from events array
  const actorCounts = {}
  events.forEach(e => { if (e.actor1) actorCounts[e.actor1] = (actorCounts[e.actor1] || 0) + 1 })
  const topActors = Object.entries(actorCounts).sort((a, b) => b[1] - a[1]).slice(0, 6)

  return (
    <div style={S.page}>
      {/* ── Global keyframes ─────────────────────────────────────────────── */}
      <style>{`
        @keyframes sk-shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
        .tw-cp-popup .mapboxgl-popup-content {
          background: rgba(6,9,14,0.97) !important;
          border: 0.5px solid #1e2d3d !important;
          border-radius: 8px !important;
          padding: 10px 12px !important;
          box-shadow: 0 4px 24px rgba(0,0,0,0.7) !important;
        }
        .tw-cp-popup .mapboxgl-popup-tip {
          border-top-color: rgba(6,9,14,0.97) !important;
          border-bottom-color: rgba(6,9,14,0.97) !important;
        }
        .mapboxgl-ctrl-group {
          background: rgba(10,10,26,0.92) !important;
          border: 0.5px solid rgba(255,255,255,0.08) !important;
          border-radius: 6px !important;
        }
        .mapboxgl-ctrl-group button { background: transparent !important; }
        .mapboxgl-ctrl-icon { filter: invert(1) opacity(0.5); }
        .mapboxgl-ctrl-attrib, .mapboxgl-ctrl-logo { display: none; }
        .news-card:hover { background: rgba(255,255,255,0.04) !important; border-color: rgba(255,255,255,0.1) !important; }
        .actor-row:hover { background: rgba(255,255,255,0.03) !important; }
        .ev-row:hover    { background: rgba(255,255,255,0.03) !important; }
      `}</style>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{
        position:   'sticky',
        top:        0,
        zIndex:     900,
        background: 'rgba(10,10,26,0.97)',
        backdropFilter: 'blur(12px)',
        borderBottom: '0.5px solid #1f2937',
        padding:    '14px 28px',
        display:    'flex',
        alignItems: 'center',
        gap:        16,
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background:   'none',
            border:       '0.5px solid #1f2937',
            color:        '#6b7280',
            cursor:       'pointer',
            padding:      '6px 12px',
            borderRadius:  5,
            fontFamily:   "'JetBrains Mono', monospace",
            fontSize:      9,
            letterSpacing: '1.5px',
            transition:   'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#1f2937'; e.currentTarget.style.color = '#6b7280' }}
        >
          ← GLOBE
        </button>

        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily:    "'JetBrains Mono', monospace",
            fontSize:       26,
            fontWeight:    700,
            color:         '#ffffff',
            letterSpacing: '3px',
            lineHeight:    1,
          }}>
            {country.toUpperCase()}
          </div>
          <div style={{
            fontSize:   11,
            color:      status.color,
            marginTop:   4,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            {status.label}
          </div>
        </div>

        <div style={{
          padding:       '5px 12px',
          background:    `${status.color}18`,
          border:        `0.5px solid ${status.color}50`,
          borderRadius:   5,
          fontFamily:    "'JetBrains Mono', monospace",
          fontSize:       8,
          letterSpacing: '2px',
          color:         status.color,
        }}>
          {loading ? 'LOADING...' : `${fmtNum(stats30d?.event_count || 0)} EVENTS · 30D`}
        </div>
      </div>

      {/* ── PAGE BODY ──────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 28px' }}>

        {/* ── QUICK STATS ROW ─────────────────────────────────────────────── */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap:                  12,
          marginBottom:         16,
        }}>
          <StatCard label="Events (30d)"       value={fmtNum(events30d)}  color="#ffffff" loading={loading} />
          <StatCard label="Fatalities (30d)"   value={fmtNum(fatal30d)}   color="#ef4444" loading={loading} />
          <StatCard label="Satellite Fires (7d)" value={firesCount !== null ? fmtNum(firesCount) : '—'} color="#ff8c00" loading={loading} />
          <StatCard label="Displaced"          value={displaced ? fmtNum(displaced) : '—'} color="#3b82f6" loading={loading} sub={displaced ? 'UNHCR est.' : 'No data'} />
        </div>

        {/* ── COUNTRY MAP ─────────────────────────────────────────────────── */}
        <div style={{ ...S.card, padding: 0, overflow: 'hidden', height: '45vh', minHeight: 320 }}>
          <CountryMap country={country} events={events} loading={loading} />
        </div>

        {/* ── TIMELINE ─────────────────────────────────────────────────────── */}
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={S.sectionHdr}>Event Timeline</div>
            <TimeframePicker value={timeframe} onChange={setTimeframe} />
          </div>
          <EventTimeline trend={timeframeStats?.trend || []} loading={loading || tfLoading} />
        </div>

        {/* ── NEWS + HUMANITARIAN (2-col grid) ─────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 0 }}>
          <div style={S.card}>
            <div style={S.sectionHdr}>Intelligence Feed</div>
            <LatestNews articles={context?.gdelt_articles || []} loading={loading} />
          </div>
          <div style={S.card}>
            <div style={S.sectionHdr}>Humanitarian Situation</div>
            <HumanitarianSection context={context} loading={loading} />
          </div>
        </div>

        {/* ── DISPLACEMENT (UNHCR) ─────────────────────────────────────────── */}
        {(displacement?.refugees_originated > 0 || displacement?.refugees_hosted > 0 || displacement?.idps > 0) && (
          <div style={{ ...S.card, marginTop: 16 }}>
            <div style={S.sectionHdr}>Displacement (UNHCR 2024)</div>
            <DisplacementSection displacement={displacement} navigate={navigate} />
          </div>
        )}

        {/* ── TOP ACTORS + RECENT EVENTS (2-col grid) ──────────────────────── */}
        {topActors.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginTop: 16 }}>
            <div style={S.card}>
              <div style={S.sectionHdr}>Top Actors</div>
              <TopActors actors={topActors} navigate={navigate} />
            </div>
            <div style={S.card}>
              <div style={S.sectionHdr}>Recent Events</div>
              <RecentEvents events={events} />
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, loading, sub }) {
  return (
    <div style={{
      background:   'rgba(255,255,255,0.02)',
      border:       '0.5px solid #1f2937',
      borderRadius:  8,
      padding:      '16px 18px',
      borderTop:    `2px solid ${color}`,
    }}>
      {loading ? (
        <>
          <Skeleton height={28} width="60%" style={{ marginBottom: 8 }} />
          <Skeleton height={10} width="80%" />
        </>
      ) : (
        <>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize:   24,
            fontWeight: 700,
            color,
            lineHeight:  1,
            marginBottom: 6,
          }}>
            {value}
          </div>
          <div style={{
            fontSize:      9,
            color:         '#6b7280',
            fontFamily:    "'JetBrains Mono', monospace",
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
          }}>
            {label}
          </div>
          {sub && (
            <div style={{ fontSize: 8, color: '#374151', marginTop: 3, fontFamily: "'JetBrains Mono', monospace" }}>
              {sub}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COUNTRY MAP
// ─────────────────────────────────────────────────────────────────────────────
function CountryMap({ country, events, loading }) {
  const mapRef      = useRef(null)
  const mapInstance = useRef(null)
  const popupRef    = useRef(null)

  // Init Mapbox
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    const centroid = getCentroid(country)
    const map = new mapboxgl.Map({
      container:  mapRef.current,
      style:      'mapbox://styles/mapbox/dark-v11',
      center:     centroid?.center || [0, 20],
      zoom:       centroid?.zoom   || 2,
      projection: 'mercator',
      antialias:  true,
    })

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left')

    map.on('style.load', () => {
      map.setFog({
        color:            'rgb(4,9,20)',
        'high-color':     'rgb(10,20,40)',
        'horizon-blend':  0.02,
        'space-color':    'rgb(2,4,10)',
        'star-intensity': 0.5,
      })
    })

    mapInstance.current = map
    return () => {
      if (popupRef.current) popupRef.current.remove()
      map.remove()
      mapInstance.current = null
    }
  }, [country])

  // Render events once map + events are ready
  useEffect(() => {
    const map = mapInstance.current
    if (!map || events.length === 0) return

    const tryRender = () => {
      if (!map.isStyleLoaded()) { setTimeout(tryRender, 80); return }

      // Clean up old layers
      ['cp-glow', 'cp-dots'].forEach(id => { try { if (map.getLayer(id)) map.removeLayer(id) } catch (_) {} })
      try { if (map.getSource('cp-events')) map.removeSource('cp-events') } catch (_) {}
      if (popupRef.current) { popupRef.current.remove(); popupRef.current = null }

      const valid = events.filter(e => e.lat && e.lng && !isNaN(e.lat) && !isNaN(e.lng) && isMapPlottable(e))

      const geojson = {
        type: 'FeatureCollection',
        features: valid.map(e => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [parseFloat(e.lng), parseFloat(e.lat)] },
          properties: {
            id:         e.id,
            type:       e.type       || 'unknown',
            location:   e.location   || e.country || '',
            actor1:     e.actor1     || '',
            actor2:     e.actor2     || '',
            date:       e.date       || '',
            fatalities: parseInt(e.fatalities) || 0,
            source:     e.source     || 'UCDP',
          },
        })),
      }

      map.addSource('cp-events', { type: 'geojson', data: geojson })

      map.addLayer({
        id: 'cp-glow', type: 'circle', source: 'cp-events',
        paint: {
          'circle-radius':  ['interpolate', ['linear'], ['get', 'fatalities'], 0, 6, 1, 9, 50, 18, 500, 28],
          'circle-color':   CIRCLE_COLOR_EXPRESSION,
          'circle-opacity': 0.12,
          'circle-blur':    1.5,
        },
      })

      map.addLayer({
        id: 'cp-dots', type: 'circle', source: 'cp-events',
        paint: {
          'circle-radius':       CIRCLE_RADIUS_BY_FATALITIES,
          'circle-color':        CIRCLE_COLOR_EXPRESSION,
          'circle-opacity':      0.85,
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(255,255,255,0.25)',
        },
      })

      // Hover popup
      map.on('mouseenter', 'cp-dots', e => {
        map.getCanvas().style.cursor = 'pointer'
        const p     = e.features[0].properties
        const color = EVENT_TYPE_COLORS[p.type] || '#ffffff'
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({
          closeButton:  false,
          closeOnClick: false,
          offset:       12,
          className:    'tw-cp-popup',
        })
          .setLngLat(e.features[0].geometry.coordinates.slice())
          .setHTML(`
            <div style="min-width:180px;font-family:'JetBrains Mono',monospace">
              <div style="color:${color};font-size:8px;letter-spacing:2px;margin-bottom:4px;text-transform:uppercase">
                ${(p.type||'').replace(/_/g,' ')}
              </div>
              <div style="color:#fff;font-size:12px;font-family:'DM Sans',sans-serif;font-weight:600;margin-bottom:5px">
                ${p.location}
              </div>
              <div style="color:#9ca3af;font-size:9px;margin-bottom:2px">${(p.date||'').substring(0,10)}</div>
              <div style="color:#ef4444;font-size:9px;font-weight:700">
                ${p.fatalities > 0 ? `${p.fatalities} fatalities` : 'No fatalities reported'}
              </div>
              ${p.actor1 ? `<div style="color:#6b7280;font-size:8px;margin-top:4px">${p.actor1.substring(0,40)}</div>` : ''}
            </div>
          `)
          .addTo(map)
      })
      map.on('mouseleave', 'cp-dots', () => {
        map.getCanvas().style.cursor = ''
        if (popupRef.current) { popupRef.current.remove(); popupRef.current = null }
      })

      // Auto-fit if no hardcoded centroid
      if (!getCentroid(country) && valid.length > 0) {
        const lngs = valid.map(e => parseFloat(e.lng))
        const lats = valid.map(e => parseFloat(e.lat))
        map.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 60, maxZoom: 8, duration: 1000 }
        )
      }
    }

    tryRender()
  }, [events, country])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      {loading && events.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(10,10,26,0.85)',
        }}>
          <div style={{
            fontFamily:    "'JetBrains Mono', monospace",
            fontSize:       11,
            color:         '#4b5563',
            letterSpacing: '2px',
          }}>
            LOADING MAP DATA...
          </div>
        </div>
      )}
      {!loading && events.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ color: '#4b5563', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
            No event data for {country}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT TIMELINE
// ─────────────────────────────────────────────────────────────────────────────
function EventTimeline({ trend, loading }) {
  const chartRef  = useRef(null)
  const chartInst = useRef(null)

  useEffect(() => {
    if (!chartRef.current) return
    if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null }
    if (!trend.length) return

    const { labels, data } = toWeekly(trend)

    chartInst.current = new Chart(chartRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor:     '#ef4444',
          borderWidth:     1.5,
          pointRadius:     0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: '#ef4444',
          tension:         0.3,
          fill:            true,
          backgroundColor: (ctx) => {
            const chart = ctx.chart
            const { top, bottom } = chart.chartArea || {}
            if (!top) return 'rgba(239,68,68,0.08)'
            const grad = chart.ctx.createLinearGradient(0, top, 0, bottom)
            grad.addColorStop(0,   'rgba(239,68,68,0.18)')
            grad.addColorStop(1,   'rgba(239,68,68,0)')
            return grad
          },
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        interaction:         { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(13,17,23,0.95)',
            borderColor:     '#1f2937',
            borderWidth:     1,
            titleColor:      '#6b7280',
            bodyColor:       '#e2e8f0',
            padding:         10,
            titleFont:       { family: "'JetBrains Mono', monospace", size: 9 },
            bodyFont:        { family: "'JetBrains Mono', monospace", size: 11 },
            callbacks: {
              title: ctx => `Week of ${ctx[0].label}`,
              label: ctx => `  ${ctx.raw} events`,
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color:    '#4b5563',
              font:     { family: "'JetBrains Mono', monospace", size: 8 },
              maxTicksLimit: 12,
            },
            grid:  { color: 'rgba(31,41,55,0.5)' },
            border:{ color: '#1f2937' },
          },
          y: {
            ticks: {
              color:    '#4b5563',
              font:     { family: "'JetBrains Mono', monospace", size: 8 },
              maxTicksLimit: 6,
            },
            grid:  { color: 'rgba(31,41,55,0.5)' },
            border:{ color: '#1f2937' },
            beginAtZero: true,
          },
        },
      },
    })

    return () => chartInst.current?.destroy()
  }, [trend])

  if (loading) {
    return (
      <div style={{ height: 200 }}>
        <Skeleton height="100%" />
      </div>
    )
  }

  if (!trend.length) {
    return (
      <div style={{
        height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#4b5563', fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
      }}>
        No trend data available
      </div>
    )
  }

  return <div style={{ height: 200 }}><canvas ref={chartRef} /></div>
}

function TimeframePicker({ value, onChange }) {
  const opts = [
    { id: '30d', label: '30D' },
    { id: '90d', label: '90D' },
    { id: '1y',  label: '1Y'  },
  ]
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {opts.map(o => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          style={{
            padding:        '4px 10px',
            borderRadius:    4,
            fontFamily:     "'JetBrains Mono', monospace",
            fontSize:        8,
            letterSpacing:  '1.5px',
            cursor:         'pointer',
            transition:     'all 0.15s',
            background:     value === o.id ? 'rgba(239,68,68,0.12)' : 'transparent',
            border:         value === o.id ? '0.5px solid rgba(239,68,68,0.4)' : '0.5px solid #1f2937',
            color:          value === o.id ? '#ef4444' : '#6b7280',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LATEST NEWS
// ─────────────────────────────────────────────────────────────────────────────
function LatestNews({ articles, loading }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[0,1,2,3].map(i => <Skeleton key={i} height={56} style={{ opacity: 1 - i * 0.2 }} />)}
      </div>
    )
  }

  if (!articles.length) {
    return (
      <div style={{ color: '#374151', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
        No articles found for this country
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {articles.map((a, i) => {
        const tone  = parseFloat(a.tone) || 0
        const color = tone < -3 ? '#ef4444' : tone > 3 ? '#22c55e' : '#3b82f6'
        return (
          <div
            key={a.id || i}
            className="news-card"
            onClick={() => a.url && window.open(a.url, '_blank', 'noopener,noreferrer')}
            style={{
              padding:      '9px 10px',
              background:   'rgba(255,255,255,0.02)',
              border:       '0.5px solid #1f2937',
              borderLeft:   `2px solid ${color}`,
              borderRadius:  5,
              cursor:       a.url ? 'pointer' : 'default',
              transition:   'background 0.15s, border-color 0.15s',
            }}
          >
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4,
            }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 7,
                letterSpacing: '1.5px', color, textTransform: 'uppercase', fontWeight: 700,
              }}>
                {a.source_name || 'GDELT'}
              </span>
              <span style={{ fontSize: 8, color: '#374151', fontFamily: "'JetBrains Mono', monospace" }}>
                {relTime(a.published_at)}
              </span>
            </div>
            <div style={{
              fontSize: 11, color: '#c9d1d9', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.45,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {a.title || '(No title)'}
            </div>
          </div>
        )
      })}
      <div style={{ fontSize: 8, color: '#374151', fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
        Source: GDELT · articles mentioning {''}{/* country injected by backend */}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HUMANITARIAN SITUATION
// ─────────────────────────────────────────────────────────────────────────────
function HumanitarianSection({ context, loading }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[0,1].map(i => <Skeleton key={i} height={72} style={{ opacity: 1 - i * 0.4 }} />)}
      </div>
    )
  }

  const reports   = context?.reliefweb_reports || []
  const figures   = context?.crisis_figures    || {}
  const conflicts = context?.active_conflicts  || []

  const hasData = reports.length > 0 || figures.people_affected > 0 || figures.people_displaced > 0

  return (
    <div>
      {/* Crisis figures */}
      {(figures.people_affected > 0 || figures.people_displaced > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {figures.people_affected > 0 && (
            <CrisisNum label="People Affected" value={fmtNum(figures.people_affected)} color="#f97316" />
          )}
          {figures.people_displaced > 0 && (
            <CrisisNum label="Displaced" value={fmtNum(figures.people_displaced)} color="#3b82f6" />
          )}
        </div>
      )}

      {/* Active conflicts */}
      {conflicts.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 8, color: '#4b5563', fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6,
          }}>
            Active Conflicts
          </div>
          {conflicts.map(c => (
            <div key={c.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '5px 0', borderBottom: '0.5px solid #1f2937',
            }}>
              <span style={{ fontSize: 11, color: '#c9d1d9', fontFamily: "'DM Sans', sans-serif" }}>
                {c.title}
              </span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                color: c.status === 'confirmed' ? '#ef4444' : '#6b7280',
              }}>
                {c.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ReliefWeb reports */}
      {reports.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reports.slice(0, 3).map((r, i) => (
            <div key={r.id || i}
              onClick={() => r.url && window.open(r.url, '_blank', 'noopener,noreferrer')}
              style={{
                padding:      '9px 10px',
                background:   'rgba(255,255,255,0.02)',
                border:       '0.5px solid #1f2937',
                borderLeft:   '2px solid #3b82f6',
                borderRadius:  5,
                cursor:       r.url ? 'pointer' : 'default',
              }}
            >
              <div style={{
                fontSize: 8, color: '#3b82f6', fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: '1.5px', marginBottom: 4,
              }}>
                RELIEFWEB · {relTime(r.published_at)}
              </div>
              <div style={{
                fontSize: 11, color: '#c9d1d9', fontFamily: "'DM Sans', sans-serif",
                lineHeight: 1.4, marginBottom: r.summary ? 5 : 0,
              }}>
                {r.title}
              </div>
              {r.summary && (
                <div style={{
                  fontSize: 10, color: '#6b7280', fontFamily: "'DM Sans', sans-serif",
                  lineHeight: 1.5, display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {r.summary.substring(0, 200)}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : !hasData ? (
        <div style={{ color: '#374151', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
          No humanitarian reports available for this country
        </div>
      ) : null}
    </div>
  )
}

function CrisisNum({ label, value, color }) {
  return (
    <div style={{
      padding:      '10px 12px',
      background:   'rgba(255,255,255,0.02)',
      border:       '0.5px solid #1f2937',
      borderTop:    `2px solid ${color}`,
      borderRadius:  6,
    }}>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 18,
        fontWeight: 700, color, marginBottom: 4, lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 8, color: '#4b5563', fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: '1px', textTransform: 'uppercase',
      }}>
        {label}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TOP ACTORS
// ─────────────────────────────────────────────────────────────────────────────
function TopActors({ actors, navigate }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {actors.map(([actor, count], i) => (
        <div
          key={actor}
          className="actor-row"
          onClick={() => navigate(`/actor/${encodeURIComponent(actor)}`)}
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:           10,
            padding:      '8px 6px',
            borderBottom: '0.5px solid #1f2937',
            cursor:       'pointer',
            transition:   'background 0.12s',
            borderRadius:  4,
          }}
        >
          <span style={{
            fontFamily:    "'JetBrains Mono', monospace",
            fontSize:       10,
            color:         '#374151',
            width:          16,
            flexShrink:     0,
          }}>
            {i + 1}
          </span>
          <span style={{
            flex:       1,
            fontSize:   11,
            color:      '#93c5fd',
            fontFamily: "'DM Sans', sans-serif",
            lineHeight: 1.3,
          }}>
            {actor}
          </span>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize:   10,
            color:      '#ef4444',
            fontWeight: 700,
            flexShrink: 0,
          }}>
            {count}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RECENT EVENTS
// ─────────────────────────────────────────────────────────────────────────────
function RecentEvents({ events }) {
  const sorted = [...events]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 12)

  if (!sorted.length) return (
    <div style={{ color: '#374151', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
      No events loaded
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 380, overflowY: 'auto' }}>
      {sorted.map(ev => {
        const color = EVENT_TYPE_COLORS[ev.type] || '#6b7280'
        return (
          <div
            key={ev.id}
            className="ev-row"
            style={{
              padding:      '8px 10px',
              background:   'rgba(255,255,255,0.02)',
              border:       '0.5px solid #1f2937',
              borderLeft:   `2px solid ${color}`,
              borderRadius:  5,
              transition:   'background 0.12s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{
                fontFamily:    "'JetBrains Mono', monospace",
                fontSize:       8,
                color,
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}>
                {(ev.type || '').replace(/_/g, ' ')}
              </span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: '#4b5563',
              }}>
                {(ev.date || '').substring(0, 10)}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#e2e8f0', fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>
              {ev.location || ev.country}
            </div>
            {ev.fatalities > 0 && (
              <div style={{
                fontSize: 9, color: '#ef4444', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
              }}>
                {ev.fatalities} fatalities
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPLACEMENT SECTION (UNHCR)
// ─────────────────────────────────────────────────────────────────────────────
function DisplacementSection({ displacement, navigate }) {
  if (!displacement) return null
  const { refugees_originated, refugees_hosted, idps, top_asylum_countries, top_origin_countries } = displacement

  function fmtD(n) {
    const v = parseInt(n) || 0
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
    return v.toLocaleString()
  }

  return (
    <div>
      {/* Stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        {refugees_originated > 0 && (
          <div style={{ padding: '10px 12px', background: 'rgba(0,212,255,0.04)', border: '0.5px solid #1f2937', borderTop: '2px solid #00d4ff', borderRadius: 6 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: '#00d4ff', lineHeight: 1, marginBottom: 4 }}>
              {fmtD(refugees_originated)}
            </div>
            <div style={{ fontSize: 8, color: '#4b5563', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', textTransform: 'uppercase' }}>
              Refugees Originated
            </div>
          </div>
        )}
        {refugees_hosted > 0 && (
          <div style={{ padding: '10px 12px', background: 'rgba(96,165,250,0.04)', border: '0.5px solid #1f2937', borderTop: '2px solid #60a5fa', borderRadius: 6 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: '#60a5fa', lineHeight: 1, marginBottom: 4 }}>
              {fmtD(refugees_hosted)}
            </div>
            <div style={{ fontSize: 8, color: '#4b5563', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', textTransform: 'uppercase' }}>
              Refugees Hosted
            </div>
          </div>
        )}
        {idps > 0 && (
          <div style={{ padding: '10px 12px', background: 'rgba(129,140,248,0.04)', border: '0.5px solid #1f2937', borderTop: '2px solid #818cf8', borderRadius: 6 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: '#818cf8', lineHeight: 1, marginBottom: 4 }}>
              {fmtD(idps)}
            </div>
            <div style={{ fontSize: 8, color: '#4b5563', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', textTransform: 'uppercase' }}>
              Internally Displaced
            </div>
          </div>
        )}
      </div>

      {/* Top destinations (where people flee to) */}
      {top_asylum_countries?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 8, color: '#4b5563', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>
            Top Destinations ↗
          </div>
          {top_asylum_countries.slice(0, 5).map((r, i) => {
            const pct = refugees_originated > 0 ? Math.round((r.refugees / refugees_originated) * 100) : 0
            return (
              <div key={r.country || i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 8, color: '#4b5563', fontFamily: "'JetBrains Mono', monospace", width: 12 }}>{i + 1}</span>
                <span
                  onClick={() => navigate(`/country/${encodeURIComponent(r.country)}`)}
                  style={{ flex: 1, fontSize: 11, color: '#00d4ff', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                >
                  {r.country}
                </span>
                <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#00d4ff', fontWeight: 700 }}>
                  {fmtD(r.refugees)}
                </span>
                <div style={{ width: 60, height: 3, background: '#1f2937', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max(pct, 2)}%`, background: '#00d4ff', borderRadius: 2 }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Top origins (who this country hosts) */}
      {top_origin_countries?.length > 0 && (
        <div>
          <div style={{ fontSize: 8, color: '#4b5563', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>
            Refugees Hosted From ↙
          </div>
          {top_origin_countries.slice(0, 5).map((r, i) => {
            const pct = refugees_hosted > 0 ? Math.round((r.refugees / refugees_hosted) * 100) : 0
            return (
              <div key={r.country || i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 8, color: '#4b5563', fontFamily: "'JetBrains Mono', monospace", width: 12 }}>{i + 1}</span>
                <span
                  onClick={() => navigate(`/country/${encodeURIComponent(r.country)}`)}
                  style={{ flex: 1, fontSize: 11, color: '#60a5fa', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                >
                  {r.country}
                </span>
                <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#60a5fa', fontWeight: 700 }}>
                  {fmtD(r.refugees)}
                </span>
                <div style={{ width: 60, height: 3, background: '#1f2937', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max(pct, 2)}%`, background: '#60a5fa', borderRadius: 2 }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ fontSize: 7, color: '#374151', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', marginTop: 10 }}>
        SOURCE: UNHCR POPULATION STATISTICS 2024
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────
function Skeleton({ height = 16, width = '100%', style = {} }) {
  return (
    <div style={{
      height,
      width,
      background:         'linear-gradient(90deg, #111827 0%, #1f2937 50%, #111827 100%)',
      backgroundSize:     '200% 100%',
      animation:          'sk-shimmer 1.5s ease-in-out infinite',
      borderRadius:        4,
      flexShrink:          0,
      ...style,
    }} />
  )
}
