import { useEffect, useRef } from 'react'
import useStore from '../store/useStore'
import { getEventColor } from '../utils/constants'

export default function StrikeArcs({ map }) {
  const canvasRef    = useRef(null)
  const animRef      = useRef(null)
  const arcsRef      = useRef([])
  const filteredEvents = useStore(s => s.filteredEvents)

  // Only show events that have different origin from target
  const strikeEvents = filteredEvents.filter(ev =>
    ev.originLat && ev.originLng &&
    (Math.abs(ev.originLat - ev.lat) > 0.5 || Math.abs(ev.originLng - ev.lng) > 0.5)
  )

  useEffect(() => {
    if (!map || !canvasRef.current) return

    // Initialize arcs with animation state
    arcsRef.current = strikeEvents.map(ev => ({
      ev,
      progress: Math.random(), // stagger start times
      speed: 0.003 + Math.random() * 0.002,
      trail: [],
    }))

    startAnimation()
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [map, filteredEvents])

  function startAnimation() {
    if (animRef.current) cancelAnimationFrame(animRef.current)

    function animate() {
      draw()
      // Advance each arc
      arcsRef.current.forEach(arc => {
        arc.progress += arc.speed
        if (arc.progress > 1.3) arc.progress = 0 // reset
      })
      animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)
  }

  function latLngToPixel(lat, lng) {
    const point = map.latLngToContainerPoint([lat, lng])
    return { x: point.x, y: point.y }
  }

  function getArcPoint(p1, p2, t) {
    // Quadratic bezier — control point elevated above midpoint
    const midX = (p1.x + p2.x) / 2
    const midY = (p1.y + p2.y) / 2
    const dist  = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
    const cpX   = midX
    const cpY   = midY - dist * 0.4 // arc height

    const x = (1 - t) ** 2 * p1.x + 2 * (1 - t) * t * cpX + t ** 2 * p2.x
    const y = (1 - t) ** 2 * p1.y + 2 * (1 - t) * t * cpY + t ** 2 * p2.y
    return { x, y }
  }

  function draw() {
    const canvas = canvasRef.current
    if (!canvas || !map) return

    const container = map.getContainer()
    canvas.width  = container.offsetWidth
    canvas.height = container.offsetHeight

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    arcsRef.current.forEach(({ ev, progress }) => {
      if (!ev.originLat) return
      const color  = getEventColor(ev.type)
      const origin = latLngToPixel(ev.originLat, ev.originLng)
      const target = latLngToPixel(ev.lat, ev.lng)
      const t      = Math.min(1, progress)

      // Draw arc trail
      ctx.beginPath()
      ctx.strokeStyle = color + '44'
      ctx.lineWidth   = 1
      ctx.setLineDash([4, 4])
      for (let i = 0; i <= 50; i++) {
        const pt = getArcPoint(origin, target, i / 50)
        i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)
      }
      ctx.stroke()
      ctx.setLineDash([])

      if (progress <= 1) {
        // Draw moving missile dot
        const pos = getArcPoint(origin, target, t)

        // Glow effect
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2)
        ctx.fillStyle = color + '33'
        ctx.fill()

        // Core dot
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()

        // Draw tail
        for (let i = 1; i <= 8; i++) {
          const tailT  = Math.max(0, t - i * 0.015)
          const tailPt = getArcPoint(origin, target, tailT)
          ctx.beginPath()
          ctx.arc(tailPt.x, tailPt.y, 3 - i * 0.3, 0, Math.PI * 2)
          ctx.fillStyle = color + Math.floor((1 - i / 8) * 255).toString(16).padStart(2, '0')
          ctx.fill()
        }
      }

      if (progress > 1 && progress < 1.3) {
        // Impact pulse at target
        const impactRadius = (progress - 1) * 40
        const impactAlpha  = Math.max(0, 1 - (progress - 1) / 0.3)

        ctx.beginPath()
        ctx.arc(target.x, target.y, impactRadius, 0, Math.PI * 2)
        ctx.strokeStyle = color + Math.floor(impactAlpha * 255).toString(16).padStart(2, '0')
        ctx.lineWidth   = 2
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(target.x, target.y, impactRadius * 0.5, 0, Math.PI * 2)
        ctx.strokeStyle = '#ffffff' + Math.floor(impactAlpha * 100).toString(16).padStart(2, '0')
        ctx.lineWidth   = 1
        ctx.stroke()
      }

      // Origin dot
      ctx.beginPath()
      ctx.arc(origin.x, origin.y, 3, 0, Math.PI * 2)
      ctx.fillStyle = color + '88'
      ctx.fill()
    })
  }

  if (!map) return null

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 400 }}
    />
  )
}