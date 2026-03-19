import useStore from '../store/useStore'

export default function StatusBar() {
  const filteredEvents = useStore(s => s.filteredEvents)
  const dataSource     = useStore(s => s.dataSource)

  function exportCSV() {
    const rows = [
      ['Date', 'Type', 'Country', 'Location', 'Actor', 'Fatalities'].join(','),
      ...filteredEvents.map(e =>
        [e.date, e.type, e.country, e.location, e.actor, e.fatal].join(',')
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

  const regions = [
    { label: 'Africa',    pct: '38%', color: '#ff2a2a' },
    { label: 'Mid.East',  pct: '22%', color: '#f97316' },
    { label: 'Europe',    pct: '18%', color: '#38bdf8' },
    { label: 'Asia',      pct: '15%', color: '#a855f7' },
    { label: 'Americas',  pct: '7%',  color: '#fbbf24' },
  ]

  return (
    <div className="h-[22px] bg-[#04060a] border-t border-border flex items-center px-3 gap-3 flex-shrink-0 text-[9px]">
      <span className="text-muted">
        {dataSource.toUpperCase()} · {new Date().toUTCString().replace(' GMT', 'Z')}
      </span>
      <span className="text-muted">
        {filteredEvents.length} events in view
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