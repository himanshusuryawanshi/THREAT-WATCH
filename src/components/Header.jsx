import useStore from '../store/useStore'

export default function Header() {
  const getStats    = useStore(s => s.getStats)
  const dataSource  = useStore(s => s.dataSource)
  const setDataSource = useStore(s => s.setDataSource)
  const stats = getStats()

  const sources = ['gdelt', 'acled', 'demo']

  return (
    <header className="flex items-center gap-3 px-4 h-12 bg-[#06090e] border-b border-border flex-shrink-0 z-50">

      {/* Logo */}
      <div className="flex items-center gap-2 min-w-[140px]">
        <div className="w-5 h-5 rounded-full border border-threat flex items-center justify-center animate-pulse-ring">
          <div className="w-2 h-2 rounded-full bg-threat" />
        </div>
        <span className="font-oswald text-lg font-semibold tracking-[3px] text-white">
          THREAT<span className="text-threat">WATCH</span>
        </span>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search country, actor, event..."
        onChange={e => useStore.getState().setSearch(e.target.value)}
        className="flex-1 max-w-[220px] bg-panel2 border border-border2 text-[#c9d1d9] font-mono text-[11px] px-3 py-1.5 rounded focus:outline-none focus:border-threat placeholder-muted"
      />

      {/* Threat meter */}
      <div className="bg-threat/10 border border-threat/30 rounded px-3 py-1 text-center">
        <div className="text-threat text-base font-bold leading-none">7.2</div>
        <div className="text-[8px] tracking-widest text-muted">THREAT LEVEL</div>
      </div>

      {/* Stats */}
      <Stat value={stats.total}      label="EVENTS"      color="text-threat"   />
      <Stat value={stats.fatalities} label="FATALITIES"  color="text-orange-400" />
      <Stat value={stats.countries}  label="COUNTRIES"   color="text-yellow-400" />

      {/* Trend */}
      <div className="text-center px-1">
        <div className="text-purple-400 text-base font-bold">+12%</div>
        <div className="text-[8px] tracking-widest text-muted">VS LAST WK</div>
      </div>

      {/* Source toggle */}
      <div className="flex gap-1 ml-1">
        {sources.map(src => (
          <button
            key={src}
            onClick={() => setDataSource(src)}
            className={`px-2 py-1 rounded text-[9px] font-bold tracking-widest border font-mono transition-all
              ${dataSource === src
                ? 'bg-green-500/15 border-green-500/50 text-green-400'
                : 'bg-transparent border-border2 text-muted hover:text-[#c9d1d9]'
              }`}
          >
            {src.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Live badge */}
      <div className="flex items-center gap-1.5 text-green-400 text-[10px] tracking-widest ml-auto">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-blink" />
        LIVE
      </div>

    </header>
  )
}

function Stat({ value, label, color }) {
  return (
    <div className="text-center px-1">
      <div className={`text-base font-bold ${color}`}>{value.toLocaleString()}</div>
      <div className="text-[8px] tracking-widest text-muted">{label}</div>
    </div>
  )
}