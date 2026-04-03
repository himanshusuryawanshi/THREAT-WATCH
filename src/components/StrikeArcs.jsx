import { useEffect, useRef, useState } from 'react'
import useStore from '../store/useStore'

const STRIKE_SUBTYPES = [
  'air/drone strike',
  'shelling/artillery/missile attack',
  'remote explosive/landmine/ied',
  'guided missile',
  'drone strike',
  'airstrike',
  'missile attack',
  'rocket attack',
  'mortar attack',
  'artillery',
  'bombing',
]

const TRAVEL_MS  = 3000
const IMPACT_MS  = 1200
const FLY_MS     = 1200

export default function StrikeArcs({ map }) {
  const canvasRef       = useRef(null)
  const animRef         = useRef(null)
  const arcsRef         = useRef([])
  const currentIndexRef = useRef(0)
  const eventStartRef   = useRef(Date.now())
  const pausedRef       = useRef(false)
  const flyingRef       = useRef(false)
  const hoveredEventRef = useRef(null)
  const sizeRef         = useRef({ w: 0, h: 0 })
  const lockedEventRef  = useRef(null)

  const allEvents        = useStore(s => s.events)
  const filteredEvents   = useStore(s => s.filteredEvents)
  const setSelectedEvent = useStore(s => s.setSelectedEvent)

  const [currentEvent, setCurrentEvent] = useState(null)
  const [dateRange,    setDateRange]    = useState({ firstDate: 0, lastDate: 0, total: 0 })
  const [lockedEvent,  setLockedEvent]  = useState(null)

  useEffect(() => {
    lockedEventRef.current = lockedEvent
  }, [lockedEvent])

  // ── WATCH selectedEvent — when cleared (close button), unlock ──
  useEffect(() => {
    const unsub = useStore.subscribe(
      s => s.selectedEvent,
      (val) => {
        if (!val) {
          setLockedEvent(null)
          lockedEventRef.current = null
          pausedRef.current      = false
          eventStartRef.current  = Date.now()
        }
      }
    )
    return unsub
  }, [])

  // ── BUILD ARCS ───────────────────────────────────────────────
  // Use filteredEvents if the sidebar has applied a filter (e.g. by country),
  // otherwise fall back to all events so nothing is empty on first load.
  useEffect(() => {
    if (!map) return

    // filteredEvents may be Battles-filtered on the main layer.
    // Only use it if it actually contains some Explosions events,
    // otherwise fall back to allEvents.
    const hasExplosions = filteredEvents.some(e => e.type === 'Explosions/Remote violence')
    const strikePool    = hasExplosions ? filteredEvents : allEvents

    const strikes = strikePool.filter(ev => {
      if (ev.type !== 'Explosions/Remote violence') return false
      const subtype      = (ev.subtype || '').toLowerCase()
      const isProjectile = STRIKE_SUBTYPES.some(s => subtype.includes(s))
      if (!isProjectile) return false
      if (!ev.originLat || !ev.originLng) return false
      const dist = Math.abs(ev.originLat - ev.lat) + Math.abs(ev.originLng - ev.lng)
      if (dist < 0.1) return false
      return true
    })

    if (strikes.length === 0) {
      arcsRef.current = []
      currentIndexRef.current = 0
      setDateRange({ firstDate: 0, lastDate: 0, total: 0 })
      setCurrentEvent(null)
      return
    }

    const sorted    = [...strikes].sort((a, b) => new Date(a.date) - new Date(b.date))
    const firstDate = new Date(sorted[0].date).getTime()
    const lastDate  = new Date(sorted[sorted.length - 1].date).getTime()

    arcsRef.current         = sorted
    currentIndexRef.current = 0
    eventStartRef.current   = Date.now()
    pausedRef.current       = false
    flyingRef.current       = false
    hoveredEventRef.current = null

    setDateRange({ firstDate, lastDate, total: sorted.length })
    setCurrentEvent(sorted[0])
    zoomToEvent(sorted[0])

  }, [map, allEvents, filteredEvents])

  // ── RESIZE OBSERVER ──────────────────────────────────────────
  useEffect(() => {
    if (!map) return
    const container = map.getContainer()

    const ro = new ResizeObserver(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const w = container.offsetWidth
      const h = container.offsetHeight
      if (w !== sizeRef.current.w || h !== sizeRef.current.h) {
        canvas.width    = w
        canvas.height   = h
        sizeRef.current = { w, h }
      }
    })

    ro.observe(container)
    return () => ro.disconnect()
  }, [map])

  // ── START ANIMATION ──────────────────────────────────────────
  useEffect(() => {
    if (!map) return

    const container = map.getContainer()
    const canvas    = canvasRef.current
    if (canvas) {
      canvas.width    = container.offsetWidth
      canvas.height   = container.offsetHeight
      sizeRef.current = { w: canvas.width, h: canvas.height }
    }

    eventStartRef.current = Date.now()

    const onMove = () => draw(arcsRef.current, Date.now() - eventStartRef.current)
    map.on('move', onMove)

    startAnimation()
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      map.off('move', onMove)
    }
  }, [map])

  // ── ZOOM HELPER ──────────────────────────────────────────────
  function zoomToEvent(ev) {
    if (!ev || !map) return
    const originLng = parseFloat(ev.originLng)
    const originLat = parseFloat(ev.originLat)
    const targetLng = parseFloat(ev.lng)
    const targetLat = parseFloat(ev.lat)
    if (isNaN(originLng) || isNaN(originLat) || isNaN(targetLng) || isNaN(targetLat)) return

    flyingRef.current     = true
    pausedRef.current     = true
    eventStartRef.current = Date.now()

    map.fitBounds(
      [
        [Math.min(originLng, targetLng), Math.min(originLat, targetLat)],
        [Math.max(originLng, targetLng), Math.max(originLat, targetLat)],
      ],
      { padding: 120, duration: FLY_MS, maxZoom: 8 }
    )

    const onMoveEnd = () => {
      map.off('moveend', onMoveEnd)
      flyingRef.current     = false
      pausedRef.current     = false
      eventStartRef.current = Date.now()
    }
    map.on('moveend', onMoveEnd)
  }

  function startAnimation() {
    if (animRef.current) cancelAnimationFrame(animRef.current)

    function animate() {
      const arcs = arcsRef.current

      if (arcs.length > 0 && !pausedRef.current && !flyingRef.current) {
        const elapsed    = Date.now() - eventStartRef.current
        const totalEvent = TRAVEL_MS + IMPACT_MS + 200

        if (elapsed > totalEvent) {
          if (lockedEventRef.current) {
            eventStartRef.current = Date.now()
          } else {
            const nextIndex         = (currentIndexRef.current + 1) % arcs.length
            currentIndexRef.current = nextIndex
            const nextEv            = arcs[nextIndex]
            if (!hoveredEventRef.current) setCurrentEvent(nextEv)
            zoomToEvent(nextEv)
          }
        }
      }

      draw(arcsRef.current, Date.now() - eventStartRef.current)
      animRef.current = requestAnimationFrame(animate)
    }

    animRef.current = requestAnimationFrame(animate)
  }

  function latLngToPixel(lat, lng) {
    const point = map.project([lng, lat])
    return { x: point.x, y: point.y }
  }

  function getArcPoint(p1, p2, t) {
    const midX = (p1.x + p2.x) / 2
    const midY = (p1.y + p2.y) / 2
    const dist  = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
    const cpY   = midY - dist * 0.4
    const x = (1 - t) ** 2 * p1.x + 2 * (1 - t) * t * midX + t ** 2 * p2.x
    const y = (1 - t) ** 2 * p1.y + 2 * (1 - t) * t * cpY  + t ** 2 * p2.y
    return { x, y }
  }

  function drawSingleArc(ctx, ev, elapsed, color = '#ff2a2a') {
    if (!ev.originLat || !ev.originLng || !ev.lat || !ev.lng) return

    const origin         = latLngToPixel(ev.originLat, ev.originLng)
    const target         = latLngToPixel(ev.lat, ev.lng)
    const travelProgress = Math.min(1, elapsed / TRAVEL_MS)
    const impactProgress = Math.max(0, (elapsed - TRAVEL_MS) / IMPACT_MS)

    // Dashed trail
    ctx.beginPath()
    ctx.strokeStyle = color + '44'
    ctx.lineWidth   = 1
    ctx.setLineDash([3, 4])
    for (let i = 0; i <= 50; i++) {
      const pt = getArcPoint(origin, target, i / 50)
      i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)
    }
    ctx.stroke()
    ctx.setLineDash([])

    if (travelProgress < 1) {
      const pos = getArcPoint(origin, target, travelProgress)

      ctx.beginPath()
      ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2)
      ctx.fillStyle = color + '22'
      ctx.fill()

      ctx.beginPath()
      ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = color + '55'
      ctx.fill()

      ctx.beginPath()
      ctx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()

      for (let i = 1; i <= 8; i++) {
        const tailT  = Math.max(0, travelProgress - i * 0.02)
        const tailPt = getArcPoint(origin, target, tailT)
        const a      = Math.floor((1 - i / 8) * 220).toString(16).padStart(2, '0')
        ctx.beginPath()
        ctx.arc(tailPt.x, tailPt.y, Math.max(0.5, 2.5 - i * 0.3), 0, Math.PI * 2)
        ctx.fillStyle = color + a
        ctx.fill()
      }

      ctx.beginPath()
      ctx.arc(origin.x, origin.y, 4, 0, Math.PI * 2)
      ctx.fillStyle = color + '44'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(origin.x, origin.y, 2, 0, Math.PI * 2)
      ctx.fillStyle = color + '88'
      ctx.fill()

    } else if (impactProgress < 1) {
      const r  = impactProgress * 25
      const r2 = impactProgress * 12
      const a  = Math.floor((1 - impactProgress) * 255).toString(16).padStart(2, '0')

      ctx.beginPath()
      ctx.arc(target.x, target.y, r, 0, Math.PI * 2)
      ctx.strokeStyle = '#ff4400' + a
      ctx.lineWidth   = 2.5
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(target.x, target.y, r2, 0, Math.PI * 2)
      ctx.strokeStyle = '#ffaa00' + a
      ctx.lineWidth   = 1.5
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(target.x, target.y, 4, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff' + a
      ctx.fill()

      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2
        const spark = r * 0.7
        const sx    = target.x + Math.cos(angle) * spark
        const sy    = target.y + Math.sin(angle) * spark
        ctx.beginPath()
        ctx.arc(sx, sy, 1.5, 0, Math.PI * 2)
        ctx.fillStyle = '#ffcc00' + a
        ctx.fill()
      }
    } else {
      ctx.beginPath()
      ctx.arc(target.x, target.y, 3, 0, Math.PI * 2)
      ctx.fillStyle = color + '66'
      ctx.fill()
    }
  }

  function draw(arcs, elapsed) {
    const canvas = canvasRef.current
    if (!canvas || !map) return

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (arcs.length === 0 || flyingRef.current) return

    const ev = arcs[currentIndexRef.current]
    if (ev) drawSingleArc(ctx, ev, elapsed, '#ff2a2a')
  }

  function handleHoverEvent(ev) {
    if (lockedEventRef.current) return
    hoveredEventRef.current = ev
    setSelectedEvent(ev)
    setCurrentEvent(ev)
  }

  function handleLeaveEvent() {
    if (lockedEventRef.current) return
    hoveredEventRef.current = null
    const current = arcsRef.current[currentIndexRef.current]
    if (current) setCurrentEvent(current)
  }

  function handlePanelClick(ev) {
    setLockedEvent(ev)
    lockedEventRef.current = ev
    setSelectedEvent(ev)
    zoomToEvent(ev)
  }

  function handleNavigate(dir) {
    const arcs = arcsRef.current
    if (!arcs.length) return
    setLockedEvent(null)
    lockedEventRef.current  = null
    const next = (currentIndexRef.current + dir + arcs.length) % arcs.length
    currentIndexRef.current = next
    const ev = arcs[next]
    setCurrentEvent(ev)
    zoomToEvent(ev)
  }

  if (!map) return null

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 400 }}
      />
      <InfoPanel
        currentEvent={currentEvent}
        arcs={arcsRef.current}
        currentIndex={currentIndexRef.current}
        dateRange={dateRange}
        onHoverEvent={handleHoverEvent}
        onLeaveEvent={handleLeaveEvent}
        onNavigate={handleNavigate}
        onPanelClick={handlePanelClick}
        lockedEvent={lockedEvent}
      />
    </>
  )
}

function InfoPanel({
  currentEvent, arcs, currentIndex,
  dateRange, onHoverEvent, onLeaveEvent,
  onNavigate, onPanelClick, lockedEvent,
}) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 300)
    return () => clearInterval(id)
  }, [])

  if (!dateRange.firstDate || arcs.length === 0) return null

  const ev       = currentEvent || arcs[0]
  const progress = arcs.length > 0 ? (currentIndex + 1) / arcs.length : 0

  return (
    <div className="absolute bottom-8 right-3 z-[500] w-[270px]">
      <div className="bg-[#06090ef0] border border-threat/30 rounded overflow-hidden">

        {/* Date header */}
        <div className="px-3 py-2 border-b border-border/40 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-threat animate-blink flex-shrink-0" />
          <div className="text-[11px] text-threat font-bold font-mono flex-1">
            {ev ? new Date(ev.date).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric'
            }) : '—'}
          </div>
          <div className="text-[9px] text-muted font-mono">
            {currentIndex + 1} / {arcs.length}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-border2">
          <div
            className="h-full bg-threat"
            style={{ width: `${progress * 100}%`, transition: 'width 0.3s linear' }}
          />
        </div>

        {/* Event details */}
        {ev && (
          <div
            className={`px-3 py-2.5 border-b border-border/40 cursor-pointer transition-colors
              ${lockedEvent ? 'bg-threat/10' : 'hover:bg-threat/5'}`}
            onMouseEnter={() => onHoverEvent(ev)}
            onMouseLeave={onLeaveEvent}
            onClick={() => onPanelClick(ev)}
          >
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-threat flex-shrink-0 mt-1" />
              <div className="flex-1">
                <div className="text-[11px] text-white font-mono font-medium leading-tight">
                  {ev.location}, {ev.country}
                  {ev.fatal > 0 && (
                    <span className="text-threat ml-1.5">· {ev.fatal} killed</span>
                  )}
                </div>
                <div className="text-[9px] text-muted font-mono mt-0.5">
                  {(ev.subtype || ev.type || '').replace('/Remote violence', '')}
                </div>
                <div className="text-[9px] text-blue-400 font-mono mt-0.5 truncate">
                  {(ev.actor || '').substring(0, 35)}
                </div>
                {ev.notes && (
                  <div className="text-[8px] text-muted font-mono mt-1 leading-relaxed"
                    style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {ev.notes.substring(0, 100)}
                  </div>
                )}
              </div>
            </div>
            <div className="text-[8px] text-muted mt-1.5 text-right">
              {lockedEvent
                ? '🔒 Locked · use ‹ › to advance'
                : 'Click to lock & zoom · hover to pause'}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-3 py-1.5 flex justify-between items-center">
          <div className="text-[8px] text-muted font-mono">
            {dateRange.total} TOTAL STRIKES
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onNavigate(-1)}
              className="w-5 h-5 flex items-center justify-center border border-border2 text-muted hover:border-threat hover:text-threat rounded text-[10px] transition-all font-mono"
            >
              ‹
            </button>
            <button
              onClick={() => onNavigate(1)}
              className="w-5 h-5 flex items-center justify-center border border-border2 text-muted hover:border-threat hover:text-threat rounded text-[10px] transition-all font-mono"
            >
              ›
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}