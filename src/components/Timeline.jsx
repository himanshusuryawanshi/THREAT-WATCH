import { useEffect, useRef, useState } from 'react'
import useStore from '../store/useStore'
import EVENTS from '../data/events'

const START = new Date('2025-01-01')
const END   = new Date('2025-03-20')
const TOTAL = END - START

export default function Timeline() {
  const canvasRef = useRef(null)
  const setDateRange = useStore(s => s.setDateRange)
  const [sel, setSel]       = useState({ start: 0, end: 1 })
  const [drag, setDrag]     = useState(null)
  const [playing, setPlaying] = useState(false)
  const playRef = useRef(null)
  const selRef  = useRef(sel)
  selRef.current = sel

  // Build daily bins
  const totalDays = Math.ceil(TOTAL / 86400000)
  const bins = new Array(totalDays).fill(0)
  EVENTS.forEach(ev => {
    const d = Math.floor((new Date(ev.date) - START) / 86400000)
    if (d >= 0 && d < totalDays) bins[d]++
  })
  const maxBin = Math.max(...bins, 1)

  useEffect(() => { draw() }, [sel])

  function draw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const W = canvas.offsetWidth
    const H = canvas.offsetHeight
    canvas.width  = W * window.devicePixelRatio
    canvas.height = H * window.devicePixelRatio
    const ctx = canvas.getContext('2d')
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    ctx.clearRect(0, 0, W, H)

    // Bins
    bins.forEach((count, i) => {
      const x = (i / totalDays) * W
      const w = Math.max(1, W / totalDays - 0.5)
      const h = (count / maxBin) * (H - 6)
      const inSel = i / totalDays >= sel.start && i / totalDays <= sel.end
      ctx.fillStyle = inSel ? '#a855f7' : '#1e3a4a'
      ctx.fillRect(x, H - h, w, h)
    })

    // Selection overlay
    ctx.fillStyle = 'rgba(168,85,247,0.1)'
    ctx.fillRect(sel.start * W, 0, (sel.end - sel.start) * W, H)
    ctx.strokeStyle = 'rgba(168,85,247,0.6)'
    ctx.lineWidth = 1
    ctx.strokeRect(sel.start * W, 0, (sel.end - sel.start) * W, H)

    // Month labels
    ctx.fillStyle = '#4b5563'
    ctx.font = '9px Share Tech Mono, monospace'
    ;['Jan', 'Feb', 'Mar'].forEach((m, i) => {
      ctx.fillText(m, (i / 2.4) * W + 4, 10)
    })
  }

  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  }

  function onMouseDown(e) {
    const x = getPos(e)
    const near = 0.015
    if (Math.abs(x - sel.start) < near)      setDrag({ type: 'start' })
    else if (Math.abs(x - sel.end) < near)   setDrag({ type: 'end' })
    else if (x > sel.start && x < sel.end)   setDrag({ type: 'both', ox: x, os: { ...sel } })
    else { setSel({ start: x, end: x }); setDrag({ type: 'end' }) }
  }

  function onMouseMove(e) {
    if (!drag) return
    const x = getPos(e)
    setSel(prev => {
      let next = { ...prev }
      if (drag.type === 'start')      next.start = Math.min(x, prev.end - 0.01)
      else if (drag.type === 'end')   next.end   = Math.max(x, prev.start + 0.01)
      else if (drag.type === 'both') {
        const dx = x - drag.ox
        const w  = drag.os.end - drag.os.start
        next.start = Math.max(0, Math.min(1 - w, drag.os.start + dx))
        next.end   = next.start + w
      }
      applyRange(next)
      return next
    })
  }

  function applyRange(s) {
    const from = new Date(START.getTime() + s.start * TOTAL).toISOString().split('T')[0]
    const to   = new Date(START.getTime() + s.end   * TOTAL).toISOString().split('T')[0]
    setDateRange(from, to)
  }

  function rangeLabel() {
    const fmt = d => new Date(START.getTime() + d * TOTAL)
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${fmt(sel.start)} – ${fmt(sel.end)}, 2025`
  }

  function togglePlay() {
    if (playing) {
      clearInterval(playRef.current)
      setPlaying(false)
    } else {
      setPlaying(true)
      setSel({ start: 0, end: 0.08 })
      playRef.current = setInterval(() => {
        setSel(prev => {
          const next = { start: prev.start + 0.008, end: prev.end + 0.008 }
          if (next.end >= 1) { clearInterval(playRef.current); setPlaying(false); return { start: 0, end: 1 } }
          applyRange(next)
          return next
        })
      }, 100)
    }
  }

  useEffect(() => () => clearInterval(playRef.current), [])

  return (
    <div className="h-[68px] bg-[#06090e] border-t border-border px-3 py-1.5 flex-shrink-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[8px] tracking-[2.5px] text-muted">TIMELINE</span>
        <span className="text-[9px] text-purple-400 bg-purple-400/10 border border-purple-400/30 px-1.5 py-0.5 rounded">
          {rangeLabel()}
        </span>
        <button onClick={togglePlay}
          className={`ml-auto px-2.5 py-0.5 rounded text-[9px] font-bold tracking-widest border font-mono transition-all
            ${playing
              ? 'bg-threat/15 border-threat/40 text-threat'
              : 'bg-purple-400/15 border-purple-400/40 text-purple-400 hover:bg-purple-400/25'
            }`}
        >
          {playing ? '⏸ PAUSE' : '▶ PLAY'}
        </button>
        <span className="text-[8px] text-muted hidden sm:block">Drag to filter · Click to jump</span>
      </div>
      <canvas
        ref={canvasRef}
        className="w-full cursor-crosshair"
        style={{ height: 32 }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={() => setDrag(null)}
        onMouseLeave={() => setDrag(null)}
      />
    </div>
  )
}