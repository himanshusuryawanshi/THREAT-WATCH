/**
 * Sidebar — Command center status panel (360px).
 *
 * Sections (top to bottom):
 *   EscalationBadge → TopCountries → EventBreakdown →
 *   HumanitarianImpact → SatelliteFires → EarlyWarning → BreakingNews
 *
 * Switches to StrikesPanel when layers.strikeArcs is active.
 *
 * Design: dark cyberpunk war room — #0d1117 bg, #1f2937 borders,
 * JetBrains Mono for data, DM Sans for body text.
 */
import useStore from '../store/useStore'
import EscalationBadge   from './Sidebar/EscalationBadge'
import TopCountries      from './Sidebar/TopCountries'
import EventBreakdown    from './Sidebar/EventBreakdown'
import HumanitarianImpact from './Sidebar/HumanitarianImpact'
import EarlyWarning      from './Sidebar/EarlyWarning'
import SatelliteFires    from './Sidebar/SatelliteFires'
import BreakingNews      from './Sidebar/BreakingNews'
import StrikesPanel      from './Sidebar/StrikesPanel'

export default function Sidebar() {
  const layers = useStore(s => s.layers)

  // Strike arc mode → show strike monitor panel instead
  if (layers?.strikeArcs) {
    return <StrikesPanel />
  }

  return (
    <div style={{
      width:        360,
      height:       '100%',
      background:   '#0d1117',
      borderRight:  '0.5px solid #1f2937',
      overflowY:    'auto',
      overflowX:    'hidden',
      display:      'flex',
      flexDirection:'column',
      fontFamily:   "'DM Sans', sans-serif",
      // Custom scrollbar
      scrollbarWidth:  'thin',
      scrollbarColor: '#1f2937 transparent',
    }}>

      <EscalationBadge />
      <Divider />
      <TopCountries />
      <Divider />
      <EventBreakdown />
      <Divider />
      <HumanitarianImpact />
      <Divider />
      <SatelliteFires />
      <Divider />
      <EarlyWarning />
      <Divider />
      <BreakingNews />

      {/* Bottom spacer */}
      <div style={{ flexShrink: 0, height: 16 }} />

      {/* ── Data Attribution Footer ────────────────────────────── */}
      <div style={{
        flexShrink:    0,
        borderTop:     '0.5px solid #1f2937',
        padding:       '10px 16px',
        display:       'flex',
        flexWrap:      'wrap',
        gap:            4,
        alignItems:    'center',
      }}>
        <span style={{
          fontFamily:    "'JetBrains Mono', monospace",
          fontSize:       7,
          color:         '#374151',
          letterSpacing: '0.8px',
          marginRight:    4,
        }}>
          DATA:
        </span>
        {[
          { label: 'UCDP (CC BY 4.0)', url: 'https://ucdp.uu.se' },
          { label: 'NASA FIRMS',        url: 'https://firms.modaps.eosdis.nasa.gov' },
          { label: 'GDELT',             url: 'https://gdeltproject.org' },
          { label: 'ReliefWeb',         url: 'https://reliefweb.int' },
          { label: 'UNHCR',             url: 'https://www.unhcr.org' },
        ].map(({ label, url }, i, arr) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily:    "'JetBrains Mono', monospace",
                fontSize:       7,
                color:         '#4b5563',
                textDecoration:'none',
                letterSpacing: '0.5px',
                transition:    'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#9ca3af'}
              onMouseLeave={e => e.currentTarget.style.color = '#4b5563'}
            >
              {label}
            </a>
            {i < arr.length - 1 && (
              <span style={{ color: '#1f2937', fontSize: 7 }}>·</span>
            )}
          </span>
        ))}
      </div>

      <style>{`
        /* Webkit scrollbar — dark themed */
        .tw-sidebar::-webkit-scrollbar        { width: 3px }
        .tw-sidebar::-webkit-scrollbar-track  { background: transparent }
        .tw-sidebar::-webkit-scrollbar-thumb  { background: #1f2937; border-radius: 2px }
      `}</style>
    </div>
  )
}

function Divider() {
  return (
    <div style={{
      height:     '0.5px',
      background: '#1f2937',
      flexShrink:  0,
    }} />
  )
}
