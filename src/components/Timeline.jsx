import { useEffect, useRef, useState } from 'react'
import useStore from '../store/useStore'
import EVENTS from '../data/events'

const START      = new Date('2025-01-01')
const END        = new Date('2025-03-20')
const TOTAL_MS   = END - START
const TOTAL_DAYS = Math.ceil(TOTAL_MS / 86400000)
const PLAY_WIN   = 0.08 // playhead window size = ~1 week

export default function Timeline() {
  const canvasRef    = useRef(null)
  const dragRef      = useRef(null)
  const selRef       = useRef({ start: 0, end: 1 })       // user window
  const playheadRef  = useRef(0)                           // playhead position (0..1)
  const playRef      = useRef(null)
  const [label,    setLabel]   = useState('Jan 1 – Mar 20, 2025')
  const [playing,  setPlaying] = useState(false)
  const setDateRange = useStore(s => s.setDateRange)

  // Build daily bins
  const bins = new Array(TOTAL_DAYS).fill(0)
  EVENTS.forEach(ev => {
    const d = Math.floor((new Date(ev.date) - START) / 86400000)
    if (d >= 0 && d < TOTAL_DAYS) bins[d]++
  })
  const maxBin = Math.max(...bins, 1)

  useEffect(() => {
    draw(selRef.current, null)
    const obs = new ResizeObserver(() => draw(selRef.current, playRef._head))
    if (canvasRef.current) obs.observe(canvasRef.current)
    return () => obs.disconnect()
  }, [])

  // ── DRAW ────────────────────────────────────────────────────────────────
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

    // Draw bars
    bins.forEach((count, i) => {
      const x      = (i / TOTAL_DAYS) * W
      const h      = (count / maxBin) * (H - 6)
      const pos    = i / TOTAL_DAYS
      const inSel  = pos >= sel.start && pos <= sel.end

      // If playhead active, highlight only playhead zone
      let inPlay = false
      if (playhead !== null) {
        inPlay = pos >= playhead && pos <= playhead + PLAY_WIN
      }

      ctx.fillStyle   = inPlay ? '#ffffff'
                      : inSel  ? '#a855f7'
                      : '#1e3a4a'
      ctx.globalAlpha = inPlay ? 0.9
                      : inSel  ? 0.6
                      : 0.3
      ctx.fillRect(x, H - h, barW, h)
    })
    ctx.globalAlpha = 1

    // User selection shading
    const sx = sel.start * W
    const ex = sel.end   * W
    ctx.fillStyle = 'rgba(168,85,247,0.07)'
    ctx.fillRect(sx, 0, ex - sx, H)

    // User selection border
    ctx.strokeStyle = 'rgba(168,85,247,0.6)'
    ctx.lineWidth   = 1
    ctx.strokeRect(sx, 0, ex - sx, H)

    // Left handle
    ctx.fillStyle = '#a855f7'
    ctx.beginPath()
    ctx.roundRect(sx - 3, 0, 6, H, 2)
    ctx.fill()

    // Right handle
    ctx.beginPath()
    ctx.roundRect(ex - 3, 0, 6, H, 2)
    ctx.fill()

    // Playhead slider (moving window)
    if (playhead !== null) {
      const px = playhead * W
      const pw = PLAY_WIN  * W

      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.fillRect(px, 0, pw, H)

      // Playhead left line
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth   = 2
      ctx.beginPath()
      ctx.moveTo(px, 0)
      ctx.lineTo(px, H)
      ctx.stroke()

      // Playhead right line
      ctx.beginPath()
      ctx.moveTo(px + pw, 0)
      ctx.lineTo(px + pw, H)
      ctx.stroke()

      // Top label on playhead
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.font      = '8px Share Tech Mono, monospace'
      const dateStr = toDateStr(playhead)
      ctx.fillText(dateStr, Math.min(px + 3, W - 70), 9)
    }

    // Month labels
    ctx.fillStyle = '#4b5563'
    ctx.font      = '9px Share Tech Mono, monospace'
    ;['Jan', 'Feb', 'Mar'].forEach((m, i) => {
      ctx.fillText(m, (i / 2.4) * W + 4, H - 2)
    })
  }

  // ── HELPERS ─────────────────────────────────────────────────────────────
  function toDateStr(ratio) {
    return new Date(START.getTime() + ratio * TOTAL_MS)
      .toISOString().split('T')[0]
  }

  function makeLabel(s) {
    const fmt = r => new Date(START.getTime() + r * TOTAL_MS)
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${fmt(s.start)} – ${fmt(s.end)}, 2025`
  }

  function getX(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  }

  function commitWindow(s) {
    setDateRange(toDateStr(s.start), toDateStr(s.end))
    setLabel(makeLabel(s))
  }

  // ── MOUSE ───────────────────────────────────────────────────────────────
  function onMouseDown(e) {
    if (playing) return
    const x    = getX(e)
    const s    = selRef.current
    const near = 0.025

    if (Math.abs(x - s.start) < near) {
      dragRef.current = { type: 'start' }
    } else if (Math.abs(x - s.end) < near) {
      dragRef.current = { type: 'end' }
    } else if (x > s.start && x < s.end) {
      dragRef.current = { type: 'move', ox: x, os: { ...s } }
    } else {
      // Draw brand new window
      dragRef.current = { type: 'draw', anchor: x }
      const next = { start: x, end: x }
      selRef.current = next
      draw(next, null)
    }
  }

  function onMouseMove(e) {
    if (!dragRef.current || playing) return
    const x = getX(e)
    const d = dragRef.current
    const s = selRef.current
    let next = { ...s }

    if (d.type === 'start') {
      next.start = Math.min(x, s.end - 0.02)
    } else if (d.type === 'end') {
      next.end = Math.max(x, s.start + 0.02)
    } else if (d.type === 'move') {
      const dx = x - d.ox
      const w  = d.os.end - d.os.start
      next.start = Math.max(0, Math.min(1 - w, d.os.start + dx))
      next.end   = next.start + w
    } else if (d.type === 'draw') {
      if (x >= d.anchor) {
        next.start = d.anchor
        next.end   = Math.min(1, x)
      } else {
        next.start = Math.max(0, x)
        next.end   = d.anchor
      }
      if (next.end - next.start < 0.02) next.end = next.start + 0.02
    }

    selRef.current = next
    draw(next, null)
  }

  function onMouseUp() {
    if (!dragRef.current) return
    dragRef.current = null
    commitWindow(selRef.current)
  }

  // ── PLAY ────────────────────────────────────────────────────────────────
  function togglePlay() {
    if (playing) {
      clearInterval(playRef.current)
      playheadRef.current = 0
      setPlaying(false)
      draw(selRef.current, null)
      commitWindow(selRef.current)
      return
    }

    const sel = selRef.current
    // Playhead starts at left edge of user window
    playheadRef.current = sel.start
    playRef._head       = sel.start
    setPlaying(true)

    let tick = 0
    const speed = (sel.end - sel.start) / 100 // cross window in 100 ticks

    playRef.current = setInterval(() => {
      const ph  = playheadRef.current
      const sel = selRef.current

      // Stop when playhead reaches right edge of window
      if (ph + PLAY_WIN >= sel.end) {
        clearInterval(playRef.current)
        playheadRef.current = 0
        setPlaying(false)
        draw(sel, null)
        commitWindow(sel)
        return
      }

      const nextPh = ph + speed
      playheadRef.current = nextPh
      playRef._head       = nextPh

      // Always draw canvas
      draw(sel, nextPh)

      tick++
      // Update map every 4 ticks so it doesn't flood
      if (tick % 4 === 0) {
        const playEnd = Math.min(sel.end, nextPh + PLAY_WIN)
        setDateRange(toDateStr(nextPh), toDateStr(playEnd))
        setLabel(makeLabel({ start: nextPh, end: playEnd }))
      }
    }, 80)
  }

  function resetAll() {
    clearInterval(playRef.current)
    playheadRef.current = 0
    setPlaying(false)
    const full = { start: 0, end: 1 }
    selRef.current = full
    draw(full, null)
    commitWindow(full)
  }

  useEffect(() => () => clearInterval(playRef.current), [])

  return (
    <div className="h-[72px] bg-[#06090e] border-t border-border px-3 py-2 flex-shrink-0">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[8px] tracking-[2.5px] text-muted">TIMELINE</span>

        <span className="text-[9px] text-purple-400 bg-purple-400/10 border border-purple-400/30 px-2 py-0.5 rounded min-w-[168px] text-center">
          {label}
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