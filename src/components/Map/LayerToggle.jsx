/**
 * LayerToggle — Floating glassmorphism panel (top-right of map).
 *
 * Toggles visibility of map layers via Zustand store.
 * Active buttons glow with accent color box-shadow.
 * Compact design — doesn't obstruct the globe.
 */
import useStore from '../../store/useStore'

const TOGGLE_BUTTONS = [
  {
    key:    'eventDots',
    label:  'Conflict Events',
    icon:   '●',
    color:  '#ef4444',
    glow:   'rgba(239,68,68,0.35)',
  },
  {
    key:    'thermalAnomalies',
    label:  'Satellite Fires',
    icon:   '◉',
    color:  '#ff8c00',
    glow:   'rgba(255,140,0,0.35)',
  },
]

export default function LayerToggle() {
  const layers      = useStore(s => s.layers)
  const toggleLayer = useStore(s => s.toggleLayer)

  return (
    <div style={{
      position:        'absolute',
      top:             10,
      right:           10,
      zIndex:          600,
      display:         'flex',
      flexDirection:   'column',
      gap:             6,
      pointerEvents:   'all',
    }}>
      {TOGGLE_BUTTONS.map(({ key, label, icon, color, glow }) => {
        const active = layers[key]
        return (
          <button
            key={key}
            onClick={() => toggleLayer(key)}
            title={`Toggle ${label}`}
            style={{
              display:        'flex',
              alignItems:     'center',
              gap:            7,
              padding:        '6px 11px',
              background:     active
                ? `rgba(${hexToRgb(color)}, 0.12)`
                : 'rgba(10, 10, 26, 0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border:         `0.5px solid ${active ? color + '60' : 'rgba(255,255,255,0.08)'}`,
              borderRadius:   6,
              cursor:         'pointer',
              transition:     'all 0.18s ease',
              boxShadow:      active
                ? `0 0 12px ${glow}, inset 0 0 6px ${glow}`
                : '0 2px 8px rgba(0,0,0,0.4)',
              minWidth:       140,
              textAlign:      'left',
            }}
          >
            {/* Status dot / icon */}
            <span style={{
              fontSize:   10,
              color:      active ? color : '#4b5563',
              flexShrink: 0,
              lineHeight: 1,
              filter:     active ? `drop-shadow(0 0 3px ${color})` : 'none',
              transition: 'all 0.18s ease',
            }}>
              {icon}
            </span>

            {/* Label */}
            <span style={{
              fontFamily:    "'JetBrains Mono', monospace",
              fontSize:      9,
              letterSpacing: 1.2,
              color:         active ? '#ffffff' : '#6b7280',
              textTransform: 'uppercase',
              fontWeight:    active ? 600 : 400,
              transition:    'color 0.18s ease',
              whiteSpace:    'nowrap',
            }}>
              {label}
            </span>

            {/* Active indicator pill */}
            <span style={{
              marginLeft:  'auto',
              paddingLeft: 6,
              fontSize:    7,
              letterSpacing: 1,
              color:       active ? color : '#374151',
              fontFamily:  "'JetBrains Mono', monospace",
              fontWeight:  700,
              transition:  'color 0.18s ease',
            }}>
              {active ? 'ON' : 'OFF'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Hex → "r,g,b" for rgba() strings ─────────────────────────────────────────
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}
