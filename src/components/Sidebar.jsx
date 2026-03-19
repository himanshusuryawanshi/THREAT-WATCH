import useStore from '../store/useStore'
import { EVENT_TYPES, getEventColor } from '../utils/constants'

export default function Sidebar({ mapRef }) {
  const {
    filteredEvents, activeType, setActiveType,
    dateFrom, dateTo, setDateRange,
    minFatal, setMinFatal,
    search, setSearch,
    resetFilters, setSelectedEvent,
  } = useStore()

  const counts = { all: filteredEvents.length }
  Object.keys(EVENT_TYPES).forEach(t => {
    counts[t] = filteredEvents.filter(e => e.type === t).length
  })

  const recent = [...filteredEvents]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 50)

  function flyTo(ev) {
    setSelectedEvent(ev)
    if (mapRef) mapRef.flyTo([ev.lat, ev.lng], 6, { duration: 1.2 })
  }

  return (
    <div className="w-[220px] flex-shrink-0 bg-panel border-r border-border flex flex-col overflow-hidden">

      {/* Search */}
      <div className="p-2.5 border-b border-border">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-panel2 border border-border2 text-[#c9d1d9] font-mono text-[10px] px-2.5 py-1.5 rounded focus:outline-none focus:border-threat placeholder-muted"
        />
      </div>

      {/* Date range */}
      <div className="p-2.5 border-b border-border">
        <div className="text-[8px] tracking-[2.5px] text-muted mb-2">DATE RANGE</div>
        <div className="flex flex-col gap-1.5">
          <input type="date" value={dateFrom}
            onChange={e => setDateRange(e.target.value, dateTo)}
            className="bg-panel2 border border-border2 text-[#c9d1d9] font-mono text-[10px] px-2 py-1 rounded focus:outline-none focus:border-blue-400"
          />
          <input type="date" value={dateTo}
            onChange={e => setDateRange(dateFrom, e.target.value)}
            className="bg-panel2 border border-border2 text-[#c9d1d9] font-mono text-[10px] px-2 py-1 rounded focus:outline-none focus:border-blue-400"
          />
        </div>
      </div>

      {/* Event type filters */}
      <div className="p-2.5 border-b border-border">
        <div className="text-[8px] tracking-[2.5px] text-muted mb-2">EVENT TYPE</div>
        <div className="flex flex-col gap-1">
          <FilterBtn label="All Events" count={counts.all} color="#ffffff"
            active={activeType === 'all'} onClick={() => setActiveType('all')} />
          {Object.entries(EVENT_TYPES).map(([type, { color, label }]) => (
            <FilterBtn key={type} label={label} count={counts[type] || 0}
              color={color} active={activeType === type}
              onClick={() => setActiveType(type)} />
          ))}
        </div>
      </div>

      {/* Fatality slider */}
      <div className="p-2.5 border-b border-border">
        <div className="flex justify-between items-center mb-1.5">
          <div className="text-[8px] tracking-[2.5px] text-muted">MIN FATALITIES</div>
          <div className="text-[10px] text-threat font-bold">{minFatal === 50 ? '50+' : minFatal}</div>
        </div>
        <input type="range" min="0" max="50" step="1" value={minFatal}
          onChange={e => setMinFatal(parseInt(e.target.value))}
          className="w-full accent-threat"
        />
        <div className="flex justify-between text-[8px] text-muted mt-0.5">
          <span>0</span><span>25</span><span>50+</span>
        </div>
      </div>

      {/* Reset */}
      <div className="p-2.5 border-b border-border">
        <button onClick={resetFilters}
          className="w-full py-1.5 bg-transparent border border-border2 text-muted font-mono text-[9px] tracking-widest rounded hover:border-threat hover:text-threat transition-all">
          RESET ALL FILTERS
        </button>
      </div>

      {/* Ticker header */}
      <div className="px-2.5 pt-2.5 pb-1">
        <div className="text-[8px] tracking-[2.5px] text-muted">RECENT EVENTS</div>
      </div>

      {/* Ticker */}
      <div className="flex-1 overflow-y-auto">
        {recent.length === 0 && (
          <div className="text-center text-muted text-[10px] py-6">No events match filters</div>
        )}
        {recent.map((ev, i) => (
          <div key={ev.id}
            onClick={() => flyTo(ev)}
            className={`px-2.5 py-2 border-b border-border/50 cursor-pointer hover:bg-white/[0.02] transition-colors animate-slide-in
              ${i < 3 ? 'border-l-2 border-l-threat bg-threat/5' : ''}`}
          >
            <div className="text-[8px] tracking-wide mb-0.5" style={{ color: getEventColor(ev.type) }}>
              {ev.type}
            </div>
            <div className="text-[11px] text-white mb-1">{ev.location}, {ev.country}</div>
            <div className="flex justify-between text-[9px] text-muted">
              <span>{ev.actor.substring(0, 18)}</span>
              {ev.fatal > 0
                ? <span className="text-threat">💀 {ev.fatal}</span>
                : <span>0 fatal</span>
              }
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}

function FilterBtn({ label, count, color, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-2 py-1.5 rounded border text-[10px] font-mono text-left w-full transition-all
        ${active
          ? 'border-threat bg-threat/10 text-white'
          : 'border-border2 text-[#9ca3af] hover:border-threat/50'
        }`}
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="flex-1">{label}</span>
      <span className="text-muted text-[9px]">{count}</span>
    </button>
  )
}