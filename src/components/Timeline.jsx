import { useEffect, useRef, useState } from 'react'
import useStore from '../store/useStore'

const PLAY_WIN = 0.08   // playhead window width as fraction of total range

export default function Timeline() {
  const events    = useStore(s => s.events)
  const setDateRange = useStore(s => s.setDateRange)

  const canvasRef   = useRef(null)
  const dragRef     = useRef(null)
  const selRef      = useRef({ start: 0, end: 1 })
  const playheadRef = useRef(0)
  const playRef     = useRef(null)

  const [label,   setLabel]   = useState('')
  const [playing, setPlaying] = useState(false)

  // ── Compute dynamic date range from live events ──────────────────────────
  const { START, END, TOTAL_MS, TOTAL_DAYS, bins, maxBin } = (() => {
    const now   = new Date()
    // Default window: last 90 days ending today
    const end   = new Date(now)
    const start = new Date(now)
    start.setDate(start.getDate() - 90)

    // If we have events, expand/clamp to their range
    if (events.length > 0) {
      const dates = events.map(e => new Date(e.date)).filter(d => !isNaN(d))
      if (dates.length) {
        const minDate = new Date(Math.min(...dates))
        const maxDate = new Date(Math.max(...dates))
        start.setTime(Math.min(start.getTime(), minDate.getTime()))
        end.setTime(Math.max(end.getTime(), maxDate.getTime()))
      }
    }

    const totalMs   = end - start
    const totalDays = Math.max(1, Math.ceil(totalMs / 86400000))
    const binsArr   = new Array(totalDays).fill(0)

    events.forEach(ev => {
      const d = Math.floor((new Date(ev.date) - start) / 86400000)
      if (d >= 0 && d < totalDays) binsArr[d]++
    })

    return {
      START:      start,
      END:        end,
      TOTAL_MS:   totalMs,
      TOTAL_DAYS: totalDays,
      bins:       binsArr,
      maxBin:     Math.max(...binsArr, 1),
    }
  })()

  // ── Date helpers ─────────────────────────────────────────────────────────
  function toDateStr(ratio) {
    return new Date(START.getTime() + ratio * TOTAL_MS)
      .toISOString().split('T')[0]
  }

  function makeLabel(s) {
    const fmt = r => new Date(START.getTime() + r * TOTAL_MS)
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${fmt(s.start)} – ${fmt(s.end)}`
  }

  // ── Canvas draw ──────────────────────────────────────────────────────────
  function draw(sel, playhead = null) {
    const canvas = canvasRef.current
    if (!canvas) return
    const W = canvas.offsetWidth
    const H = canvas.offsetHeight
    if (!W || !H) return
    canvas.width  = W * devicePixelRatio
    canvas.height = H * devicePixelRatio
    const ctx = canvas.getContext('2d')
    ctx.scale(devicePixelRatio, devicePixelRatio)
    ctx.clearRect(0, 0, W, H)

    const barW = Math.max(1, W / TOTAL_DAYS - 0.3)

    bins.forEach((count, i) => {
      const x     = (i / TOTAL_DAYS) * W
      const h     = (count / maxBin) * (H - 6)
      const pos   = i / TOTAL_DAYS
      const inSel = pos >= sel.start && pos <= sel.end
      const inPlay = playhead !== null && pos >= playhead && pos <= playhead + PLAY_WIN

      ctx.fillStyle   = inPlay ? '#ffffff' : inSel ? '#a855f7' : '#1e3a4a'
      ctx.globalAlpha = inPlay ? 0.9       : inSel ? 0.6       : 0.3
      ctx.fillRect(x, H - h, barW, h)
    })
    ctx.globalAlpha = 1

    // Selection overlay
    const sx = sel.start * W
    const ex = sel.end   * W
    ctx.fillStyle   = 'rgba(168,85,247,0.07)'
    ctx.fillRect(sx, 0, ex - sx, H)
    ctx.strokeStyle = 'rgba(168,85,247,0.6)'
    ctx.lineWidth   = 1
    ctx.strokeRect(sx, 0, ex - sx, H)

    // Handles
    ctx.fillStyle = '#a855f7'
    ctx.beginPath(); ctx.roundRect(sx - 3, 0, 6, H, 2); ctx.fill()
    ctx.beginPath(); ctx.roundRect(ex - 3, 0, 6, H, 2); ctx.fill()

    // Playhead
    if (playhead !== null) {
      const px = playhead * W
      const pw = PLAY_WIN * W
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.fillRect(px, 0, pw, H)
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth   = 2
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(px + pw, 0); ctx.lineTo(px + pw, H); ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.font      = '8px Share Tech Mono, monospace'
      ctx.fillText(toDateStr(playhead), Math.min(px + 3, W - 70), 9)
    }

    // Month labels — compute evenly spaced from actual date range
    ctx.fillStyle = '#4b5563'
    ctx.font      = '9px Share Tech Mono, monospace'
    const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'short' })
    const tickCount = Math.min(6, Math.floor(TOTAL_DAYS / 14))
    for (let t = 0; t <= tickCount; t++) {
      const ratio = t / tickCount
      const d     = new Date(START.getTime() + ratio * TOTAL_MS)
      ctx.fillText(monthFmt.format(d), ratio * W + 2, H - 2)
    }
  }

  // ── Mouse helpers ────────────────────────────────────────────────────────
  function getX(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  }

  function commitWindow(s) {
    setDateRange(toDateStr(s.start), toDateStr(s.end))
    setLabel(makeLabel(s))
  }

  function onMouseDown(e) {
    if (playing) return
    const x = getX(e); const s = selRef.current; const near = 0.025
    if      (Math.abs(x - s.start) < near)  dragRef.current = { type: 'start' }
    else if (Math.abs(x - s.end)   < near)  dragRef.current = { type: 'end' }
    else if (x > s.start && x < s.end)      dragRef.current = { type: 'move', ox: x, os: { ...s } }
    else {
      dragRef.current = { type: 'draw', anchor: x }
      const next = { start: x, end: x }; selRef.current = next; draw(next, null)
    }
  }

  function onMouseMove(e) {
    if (!dragRef.current || playing) return
    const x = getX(e); const d = dragRef.current; const s = selRef.current
    let next = { ...s }
    if      (d.type === 'start') next.start = Math.min(x, s.end - 0.02)
    else if (d.type === 'end')   next.end   = Math.max(x, s.start + 0.02)
    else if (d.type === 'move') {
      const dx = x - d.ox; const w = d.os.end - d.os.start
      next.start = Math.max(0, Math.min(1 - w, d.os.start + dx))
      next.end   = next.start + w
    } else if (d.type === 'draw') {
      if (x >= d.anchor) { next.start = d.anchor; next.end = Math.min(1, x) }
      else               { next.start = Math.max(0, x); next.end = d.anchor }
      if (next.end - next.start < 0.02) next.end = next.start + 0.02
    }
    selRef.current = next; draw(next, null)
  }

  function onMouseUp() {
    if (!dragRef.current) return
    dragRef.current = null; commitWindow(selRef.current)
  }

  // ── Play ─────────────────────────────────────────────────────────────────
  function togglePlay() {
    if (playing) {
      clearInterval(playRef.current)
      playheadRef.current = 0; setPlaying(false)
      draw(selRef.current, null); commitWindow(selRef.current)
      return
    }
    const sel = selRef.current
    playheadRef.current = sel.start; playRef._head = sel.start; setPlaying(true)
    const speed = (sel.end - sel.start) / 100
    let tick = 0
    playRef.current = setInterval(() => {
      const ph = playheadRef.current; const s = selRef.current
      if (ph + PLAY_WIN >= s.end) {
        clearInterval(playRef.current); playheadRef.current = 0
        setPlaying(false); draw(s, null); commitWindow(s); return
      }
      const nextPh = ph + speed
      playheadRef.current = nextPh; playRef._head = nextPh; draw(s, nextPh)
      if (++tick % 4 === 0) {
        const playEnd = Math.min(s.end, nextPh + PLAY_WIN)
        setDateRange(toDateStr(nextPh), toDateStr(playEnd))
        setLabel(makeLabel({ start: nextPh, end: playEnd }))
      }
    }, 80)
  }

  function resetAll() {
    clearInterval(playRef.current); playheadRef.current = 0; setPlaying(false)
    const full = { start: 0, end: 1 }; selRef.current = full
    draw(full, null); commitWindow(full)
  }

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setLabel(makeLabel(selRef.current))
    draw(selRef.current, null)
    const obs = new ResizeObserver(() => draw(selRef.current, playRef._head || null))
    if (canvasRef.current) obs.observe(canvasRef.current)
    return () => obs.disconnect()
  }, [events, TOTAL_DAYS])   // redraw when live events change

  useEffect(() => () => clearInterval(playRef.current), [])

  return (
    <div className="h-[72px] bg-[#06090e] border-t border-border px-3 py-2 flex-shrink-0">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[8px] tracking-[2.5px] text-muted">TIMELINE</span>

        <span className="text-[9px] text-purple-400 bg-purple-400/10 border border-purple-400/30 px-2 py-0.5 rounded min-w-[200px] text-center">
          {label || makeLabel(selRef.current)}
        </span>

        <button onClick={togglePlay}
          className={`ml-auto px-3 py-0.5 rounded text-[9px] font-bold tracking-widest border font-mono transition-all
            ${playing
              ? 'bg-threat/15 border-threat/50 text-threat'
              : 'bg-purple-500/15 border-purple-500/40 text-purple-400 hover:bg-purple-500/25'
            }`}
        >
          {playing ? '⏸ PAUSE' : '▶ PLAY'}
        </button>

        <button onClick={resetAll}
          className="px-2 py-0.5 rounded text-[9px] border border-border2 text-muted font-mono hover:border-threat hover:text-threat transition-all">
          RESET
        </button>

        <span className="text-[8px] text-muted hidden lg:block">
          {playing ? 'Playhead sliding through window' : 'Draw window · drag handles · press play'}
        </span>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full cursor-crosshair"
        style={{ height: 34, display: 'block' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      />
    </div>
  )
}
