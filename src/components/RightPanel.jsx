import { useEffect, useRef } from 'react'
import useStore from '../store/useStore'
import { getEventColor, EVENT_TYPES } from '../utils/constants'

export default function RightPanel() {
  const filteredEvents     = useStore(s => s.filteredEvents)
  const selectedEvent      = useStore(s => s.selectedEvent)
  const clearSelectedEvent = useStore(s => s.clearSelectedEvent)
  const setSelectedEvent   = useStore(s => s.setSelectedEvent)

  const recent = [...filteredEvents]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 100)

  // Risk ranking
  const scores = {}
  filteredEvents.forEach(e => {
    if (!scores[e.country]) scores[e.country] = { events: 0, fatal: 0 }
    scores[e.country].events++
    scores[e.country].fatal += (parseInt(e.fatal) || 0)
  })
  const ranked = Object.entries(scores)
    .map(([c, s]) => ({ country: c, score: Math.min(99, Math.round(s.events * 0.4 + s.fatal * 0.3)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  return (
    <div className="w-[230px] flex-shrink-0 bg-panel border-l border-border flex flex-col overflow-hidden relative">

      {/* Detail panel overlay */}
      {selectedEvent && (
        <div
          className="absolute inset-0 bg-panel z-20 flex flex-col overflow-y-auto animate-slide-in"
          tabIndex={-1}
          ref={el => el?.focus()}
          onKeyDown={e => {
            if (e.key === 'Escape') { e.stopPropagation(); clearSelectedEvent() }
          }}
        >
          <DetailPanel event={selectedEvent} onClose={clearSelectedEvent} />
        </div>
      )}

      {/* Risk ranking */}
      <div className="p-2.5 border-b border-border flex-shrink-0">
        <div className="text-[10px] tracking-[2.5px] text-muted mb-2">RISK RANKING</div>
        {ranked.map((r, i) => {
          const col = r.score > 70 ? '#ff2a2a' : r.score > 50 ? '#f97316' : '#fbbf24'
          return (
            <div
              key={r.country}
              className="flex items-center gap-2 py-1.5 border-b border-border/60 cursor-pointer hover:bg-white/[0.02] transition-colors"
              onClick={() => window.location.href = `/country/${encodeURIComponent(r.country)}`}
            >
              <span className="text-[9px] text-muted w-3">{i + 1}</span>
              <span className="text-[11px] text-[#e5e7eb] flex-1 hover:text-blue-400 transition-colors">
                {r.country}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: col + '22', color: col }}>
                {r.score}
              </span>
            </div>
          )
        })}
      </div>

      {/* Recent events ticker */}
      <div className="px-2.5 pt-2.5 pb-1 flex-shrink-0">
        <div className="text-[10px] tracking-[2.5px] text-muted">RECENT EVENTS</div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {recent.length === 0 && (
          <div className="text-center text-muted text-[10px] py-6">
            No events match filters
          </div>
        )}
        {recent.map((ev, i) => (
            <div
                key={ev.id}
                className={`px-2.5 py-2 border-b border-border/50 cursor-pointer hover:bg-white/[0.02] transition-colors
                ${i < 3 ? 'border-l-2 border-l-threat bg-threat/5' : ''}`}
                onClick={() => setSelectedEvent(ev)}
            >
                <div className="flex items-center justify-between mb-0.5">
                <div
                    className="text-[8px] tracking-wide"
                    style={{ color: getEventColor(ev.type) }}
                >
                    {ev.type.replace('/Remote violence', '').replace(' against civilians', '')}
                </div>
                <div className="text-[8px] text-muted font-mono">{ev.date}</div>
                </div>
                <div className="text-[11px] text-white mb-1 hover:text-blue-400 transition-colors">
                {ev.location}, {ev.country}
                </div>
                <div className="flex justify-between text-[9px] text-muted">
                <span
                    className="hover:text-blue-400 transition-colors cursor-pointer truncate max-w-[120px]"
                    onClick={e => { e.stopPropagation(); window.location.href = `/actor/${encodeURIComponent(ev.actor)}` }}
                >
                    {(ev.actor || '').substring(0, 20)}
                </span>
                {ev.fatal > 0
                    ? <span className="text-threat flex-shrink-0">💀 {ev.fatal}</span>
                    : <span className="flex-shrink-0">0 fatal</span>
                }
                </div>
            </div>
        ))}
      </div>

    </div>
  )
}

function DetailPanel({ event, onClose }) {
  const color     = getEventColor(event.type)
  const intensity = Math.min(100, (event.fatal / 35) * 100)
  const intColor  = event.fatal > 20 ? '#ff2a2a' : event.fatal > 5 ? '#f97316' : '#fbbf24'

  return (
    <div className="flex flex-col gap-3 p-3 h-full">

      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold tracking-widest px-2 py-0.5 rounded"
          style={{ background: color + '22', color, border: `0.5px solid ${color}55` }}>
          {event.type.toUpperCase()}
        </span>
        <button onClick={onClose}
          className="text-[10px] text-muted border border-border2 px-2 py-0.5 rounded hover:border-threat hover:text-threat transition-all font-mono">
          ✕ CLOSE
        </button>
      </div>

      <div>
        <div className="font-oswald text-lg text-white tracking-wide leading-tight">
          {event.location}
        </div>
        <div className="text-[11px] text-muted">{event.country}</div>
      </div>

      <div className="flex flex-col gap-0">
        <div className="flex justify-between py-1.5 border-b border-border/40 text-[10px]">
          <span className="text-muted tracking-widest">DATE</span>
          <span className="text-[#c9d1d9]">{event.date}</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-border/40 text-[10px]">
          <span className="text-muted tracking-widest">ACTOR</span>
          <span
            className="text-blue-400 cursor-pointer hover:text-white transition-colors text-right max-w-[130px]"
            onClick={() => window.location.href = `/actor/${encodeURIComponent(event.actor)}`}
          >
            {event.actor}
          </span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-border/40 text-[10px]">
          <span className="text-muted tracking-widest">COUNTRY</span>
          <span
            className="text-blue-400 cursor-pointer hover:text-white transition-colors"
            onClick={() => window.location.href = `/country/${encodeURIComponent(event.country)}`}
          >
            {event.country}
          </span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-border/40 text-[10px]">
          <span className="text-muted tracking-widest">FATALITIES</span>
          <span style={{ color: event.fatal > 0 ? '#ff2a2a' : '#c9d1d9' }}>
            {event.fatal > 0 ? `${event.fatal} confirmed` : '0 (non-lethal)'}
          </span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-border/40 text-[10px]">
          <span className="text-muted tracking-widest">TYPE</span>
          <span className="text-[#c9d1d9]">{event.type}</span>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[8px] text-muted mb-1">
          <span>INTENSITY</span>
          <span style={{ color: intColor }}>{Math.round(intensity)}%</span>
        </div>
        <div className="h-1.5 bg-border2 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${intensity}%`, background: intColor }} />
        </div>
      </div>

      <div>
        <div className="text-[8px] tracking-widest text-muted mb-1">NOTES</div>
        <div className="text-[10px] text-[#9ca3af] leading-relaxed p-2 bg-panel2 rounded border border-border/40">
          {event.notes}
        </div>
      </div>

      {event.mentions && (
        <div className="text-center p-3 bg-blue-400/5 border border-blue-400/20 rounded">
          <div className="text-[#38bdf8] text-2xl font-bold leading-none mb-1">
            {event.mentions.toLocaleString()}
          </div>
          <div className="text-[8px] text-muted tracking-widest">MEDIA MENTIONS</div>
        </div>
      )}

      <div className="mt-auto text-[9px] text-muted text-center border-t border-border/40 pt-2">
        {new Date(event.date).toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        })}
      </div>

    </div>
  )
}