/**
 * InfoPanel — Glassmorphism event detail panel.
 *
 * Appears on the right side of the map when a UCDP event dot is clicked.
 * Reads selectedEvent from Zustand store. Clears on X button.
 *
 * Design: dark cyberpunk war room — #1a1a2e base, backdrop-blur glassmorphism.
 */
import useStore from '../../store/useStore'
import { EVENT_TYPE_COLORS, DEFAULT_COLOR } from '../../store/visualizationRules'

// Human-readable labels for normalized UCDP type keys
const TYPE_LABELS = {
  battle:                    'Battle',
  explosion:                 'Explosion / Remote Violence',
  violence_against_civilians:'Violence Against Civilians',
  protest:                   'Protest',
  riot:                      'Riot',
  strategic_development:     'Strategic Development',
}

const SOURCE_LABELS = {
  UCDP:           'UCDP GED — Verified',
  UCDP_CANDIDATE: 'UCDP Candidate — Monthly Release',
}

export default function InfoPanel() {
  const selectedEvent   = useStore(s => s.selectedEvent)
  const clearSelectedEvent = useStore(s => s.clearSelectedEvent)

  if (!selectedEvent) return null

  const {
    date, location, country,
    actor1, actor2,
    fatalities, fatalities_low, fatalities_high,
    type, subtype, source, notes, url,
  } = selectedEvent

  const typeKey   = (type || '').toLowerCase().replace(/ /g, '_')
  const dotColor  = EVENT_TYPE_COLORS[typeKey] || DEFAULT_COLOR
  const typeLabel = TYPE_LABELS[typeKey]        || type || 'Unknown'
  const srcLabel  = SOURCE_LABELS[source]       || source || 'UCDP'

  // Format date for display
  const displayDate = date ? new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  }) : '—'

  // Fatality display: show range if available
  const fatalStr = (() => {
    const best = parseInt(fatalities) || 0
    const low  = parseInt(fatalities_low)  || 0
    const high = parseInt(fatalities_high) || 0
    if (high > 0 && (low !== best || high !== best)) {
      return `${best} (${low}–${high})`
    }
    return String(best)
  })()

  return (
    <div style={{
      position:        'absolute',
      top:             80,
      right:           16,
      zIndex:          700,
      width:           300,
      background:      'rgba(26, 26, 46, 0.88)',
      backdropFilter:  'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border:          '0.5px solid rgba(255,255,255,0.08)',
      borderRadius:    10,
      boxShadow:       '0 8px 32px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.04)',
      overflow:        'hidden',
      fontFamily:      "'DM Sans', sans-serif",
    }}>

      {/* ── Header bar ────────────────────────────────────────── */}
      <div style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        padding:         '10px 12px 8px',
        borderBottom:    '0.5px solid rgba(255,255,255,0.06)',
        background:      'rgba(255,255,255,0.03)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: dotColor,
            boxShadow:  `0 0 8px ${dotColor}`,
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily:    "'JetBrains Mono', monospace",
            fontSize:      9,
            letterSpacing: 2,
            color:         dotColor,
            textTransform: 'uppercase',
          }}>
            {typeLabel}
          </span>
        </div>
        <button
          onClick={clearSelectedEvent}
          style={{
            background:   'none',
            border:       'none',
            color:        '#6b7280',
            cursor:       'pointer',
            fontSize:     16,
            lineHeight:   1,
            padding:      '0 2px',
            transition:   'color 0.15s',
          }}
          onMouseEnter={e => e.target.style.color = '#fff'}
          onMouseLeave={e => e.target.style.color = '#6b7280'}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* ── Body ──────────────────────────────────────────────── */}
      <div style={{ padding: '12px 14px' }}>

        {/* Location */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, lineHeight: 1.3, marginBottom: 2 }}>
            {location || country || '—'}
          </div>
          {location && country && location !== country && (
            <div style={{ color: '#9ca3af', fontSize: 11 }}>{country}</div>
          )}
        </div>

        {/* Date */}
        <Row label="Date" value={displayDate} mono />

        {/* Fatalities */}
        <Row
          label="Fatalities"
          value={fatalStr}
          valueStyle={{ color: parseInt(fatalities) > 0 ? '#ef4444' : '#9ca3af', fontWeight: 700 }}
          mono
        />

        {/* Actors */}
        {(actor1 || actor2) && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ color: '#6b7280', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>
              Parties
            </div>
            {actor1 && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                <span style={{
                  flexShrink: 0, marginTop: 2,
                  fontSize: 9, color: '#ef4444',
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: 1,
                }}>A1</span>
                <span style={{ color: '#e2e8f0', fontSize: 11, lineHeight: 1.4 }}>{actor1}</span>
              </div>
            )}
            {actor2 && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{
                  flexShrink: 0, marginTop: 2,
                  fontSize: 9, color: '#6b7280',
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: 1,
                }}>A2</span>
                <span style={{ color: '#9ca3af', fontSize: 11, lineHeight: 1.4 }}>{actor2}</span>
              </div>
            )}
          </div>
        )}

        {/* Subtype */}
        {subtype && (
          <Row label="Subtype" value={subtype} />
        )}

        {/* Notes */}
        {notes && notes.length > 10 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ color: '#6b7280', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>
              Notes
            </div>
            <div style={{
              color:       '#9ca3af',
              fontSize:    10,
              lineHeight:  1.5,
              maxHeight:   72,
              overflow:    'hidden',
              display:     '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
            }}>
              {notes}
            </div>
          </div>
        )}

        {/* Source badge + optional URL */}
        <div style={{
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'space-between',
          marginTop:    12,
          paddingTop:   10,
          borderTop:    '0.5px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{
            fontFamily:    "'JetBrains Mono', monospace",
            fontSize:      8,
            letterSpacing: 1.5,
            color:         source === 'UCDP_CANDIDATE' ? '#f59e0b' : '#3b82f6',
            background:    source === 'UCDP_CANDIDATE' ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.12)',
            padding:       '2px 6px',
            borderRadius:  3,
          }}>
            {srcLabel}
          </span>

          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize:  9,
                color:     '#6b7280',
                textDecoration: 'none',
                fontFamily: "'JetBrains Mono', monospace",
              }}
              onMouseEnter={e => e.target.style.color = '#3b82f6'}
              onMouseLeave={e => e.target.style.color = '#6b7280'}
            >
              Source ↗
            </a>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Helper row component ──────────────────────────────────────────────────────
function Row({ label, value, mono = false, valueStyle = {} }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
      <span style={{ color: '#6b7280', fontSize: 10, flexShrink: 0, paddingTop: 1 }}>
        {label}
      </span>
      <span style={{
        fontFamily: mono ? "'JetBrains Mono', monospace" : "'DM Sans', sans-serif",
        fontSize:   11,
        color:      '#e2e8f0',
        textAlign:  'right',
        maxWidth:   180,
        ...valueStyle,
      }}>
        {value ?? '—'}
      </span>
    </div>
  )
}
