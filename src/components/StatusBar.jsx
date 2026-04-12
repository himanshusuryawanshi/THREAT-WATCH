import useStore from '../store/useStore'

export default function StatusBar() {
  const filteredEvents = useStore(s => s.filteredEvents)
  const events         = useStore(s => s.events)
  const dataSource     = useStore(s => s.dataSource)

  // Derive date range from loaded events
  function getDataRange() {
    if (!events.length) return null
    const dates = events.map(e => e.date?.substring(0, 10)).filter(Boolean).sort()
    return { from: dates[0], to: dates[dates.length - 1] }
  }
  const range = getDataRange()

  function exportCSV() {
    const rows = [
      ['Date', 'Type', 'Country', 'Location', 'Actor', 'Fatalities'].join(','),
      ...filteredEvents.map(e =>
        [e.date, e.type, e.country, e.location, e.actor1, e.fatalities].join(',')
      ),
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'threatwatch_events.csv'
    a.click()
  }

  function shareView() {
    navigator.clipboard.writeText(window.location.href)
      .then(() => alert('URL copied to clipboard!'))
  }

  const total = filteredEvents.length || 1
  const typeCounts = {}
  filteredEvents.forEach(e => { typeCounts[e.type] = (typeCounts[e.type] || 0) + 1 })
  const regions = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count], i) => ({
      label: type.replace('_', ' ').replace('violence against civilians', 'civ.violence').substring(0, 10),
      pct:   `${Math.round((count / total) * 100)}%`,
      color: ['#ff2a2a', '#f97316', '#38bdf8', '#a855f7', '#fbbf24'][i],
    }))

  return (
    <div className="h-[22px] bg-[#04060a] border-t border-border flex items-center px-3 gap-3 flex-shrink-0 text-[9px]">
      <span className="text-muted font-mono">
        {new Date().toUTCString().replace(' GMT', 'Z')}
      </span>

      {/* Source badges */}
      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-widest bg-red-500/10 border border-red-500/30 text-red-400">
        UCDP GED
      </span>
      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-widest bg-orange-500/10 border border-orange-500/30 text-orange-400">
        NASA FIRMS
      </span>
      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-widest bg-sky-500/10 border border-sky-500/30 text-sky-400">
        GDELT
      </span>

      {range && (
        <span className="text-yellow-600 font-mono text-[8px]">
          {range.from} → {range.to}
        </span>
      )}

      <span className="text-muted">
        {filteredEvents.length} / {events.length} events
      </span>
      <div className="flex gap-1 ml-auto">
        {regions.map(r => (
          <span key={r.label} className="px-1.5 py-0.5 rounded text-[8px]"
            style={{ background: r.color + '20', color: r.color }}>
            {r.label} {r.pct}
          </span>
        ))}
      </div>
      <div className="flex gap-2 text-blue-400">
        <span className="cursor-pointer hover:text-white transition-colors" onClick={exportCSV}>
          Export CSV
        </span>
        <span className="cursor-pointer hover:text-white transition-colors" onClick={shareView}>
          Share View
        </span>
      </div>
    </div>
  )
}