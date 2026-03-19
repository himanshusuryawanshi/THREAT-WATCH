import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import useStore from '../store/useStore'
import { getEventColor, getMarkerRadius } from '../utils/constants'

export default function MapView({ onMapReady }) {
  const mapRef       = useRef(null)
  const mapInstance  = useRef(null)
  const markersRef   = useRef([])
  const [layer, setLayer] = useState('markers')

  const filteredEvents  = useStore(s => s.filteredEvents)
  const setSelectedEvent = useStore(s => s.setSelectedEvent)
  const clearSelectedEvent = useStore(s => s.clearSelectedEvent)

  // Init map once
  useEffect(() => {
    if (mapInstance.current) return
    const map = L.map(mapRef.current, {
      center: [20, 10], zoom: 2,
      zoomControl: true, attributionControl: true,
    })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CartoDB', maxZoom: 19, subdomains: 'abcd',
    }).addTo(map)
    map.on('click', () => clearSelectedEvent())
    mapInstance.current = map
    onMapReady(map)
  }, [])

  // Re-render markers when filteredEvents changes
  useEffect(() => {
    const map = mapInstance.current
    if (!map) return

    // Remove old markers
    markersRef.current.forEach(m => map.removeLayer(m))
    markersRef.current = []

    filteredEvents.forEach(ev => {
      const color  = getEventColor(ev.type)
      const radius = getMarkerRadius(ev.fatal)

      const circle = L.circleMarker([ev.lat, ev.lng], {
        radius, fillColor: color, color, weight: 1.5,
        opacity: 0.9, fillOpacity: 0.5,
      })

      circle.bindPopup(`
        <div style="min-width:180px">
          <div style="color:${color};font-size:9px;letter-spacing:2px;margin-bottom:4px">
            ${ev.type.toUpperCase()}
          </div>
          <div style="color:#fff;font-size:13px;font-family:'Oswald',sans-serif;margin-bottom:6px">
            ${ev.location}, ${ev.country}
          </div>
          <div style="color:#6b7280;font-size:10px;margin-bottom:2px">📅 ${ev.date}</div>
          <div style="color:#6b7280;font-size:10px;margin-bottom:2px">👥 ${ev.actor}</div>
          <div style="color:#ff2a2a;font-size:10px">💀 ${ev.fatal} fatalities</div>
        </div>
      `)

      circle.on('click', e => {
        e.originalEvent.stopPropagation()
        setSelectedEvent(ev)
      })

      circle.addTo(map)
      markersRef.current.push(circle)

      // Pulse ring for recent events (within 5 days)
      const days = (Date.now() - new Date(ev.date)) / 86400000
      if (days < 5) {
        const pulse = L.circleMarker([ev.lat, ev.lng], {
          radius: radius + 6, fillColor: 'transparent',
          color, weight: 0.8, opacity: 0.3, fillOpacity: 0,
        }).addTo(map)
        markersRef.current.push(pulse)
      }
    })
  }, [filteredEvents])

  return (
    <div className="flex-1 relative overflow-hidden">
      <div ref={mapRef} className="w-full h-full z-10" />

      {/* Escalation badge */}
      <div className="absolute top-2.5 left-2.5 z-[500]">
        <div className="bg-threat/10 border border-threat/60 rounded px-2.5 py-1.5">
          <div className="text-[8px] text-threat font-bold tracking-widest">ESCALATING</div>
          <div className="text-[11px] text-white">Sudan +340% this week</div>
        </div>
      </div>

      {/* Layer toggle */}
      <div className="absolute top-2.5 right-2.5 z-[500] flex gap-1">
        {['markers', 'cluster'].map(l => (
          <button key={l} onClick={() => setLayer(l)}
            className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-widest border font-mono transition-all
              ${layer === l
                ? 'bg-threat/15 border-threat/50 text-threat'
                : 'bg-[#06090e]/90 border-border2 text-muted hover:text-[#c9d1d9]'
              }`}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="absolute bottom-2.5 left-2.5 z-[500]">
        <div className="bg-[#06090e]/90 border border-border2 rounded px-2.5 py-2">
          <div className="text-[8px] tracking-widest text-muted mb-2">LEGEND</div>
          {[
            ['Battles',                  '#ff2a2a'],
            ['Explosions',               '#f97316'],
            ['Civilian Violence',        '#fbbf24'],
            ['Protests',                 '#38bdf8'],
            ['Riots',                    '#a855f7'],
          ].map(([label, color]) => (
            <div key={label} className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-[9px] text-muted">{label}</span>
            </div>
          ))}
          <div className="text-[8px] text-muted mt-1.5 border-t border-border pt-1.5">
            Size = fatality count
          </div>
        </div>
      </div>
    </div>
  )
}