export const EVENT_TYPES = {
  'Battles':                    { color: '#ff2a2a', label: 'Battles' },
  'Explosions/Remote violence': { color: '#f97316', label: 'Explosions' },
  'Violence against civilians': { color: '#fbbf24', label: 'Civilian Violence' },
  'Protests':                   { color: '#38bdf8', label: 'Protests' },
  'Riots':                      { color: '#a855f7', label: 'Riots' },
}

export const getEventColor = (type) =>
  EVENT_TYPES[type]?.color ?? '#22c55e'

export const getMarkerRadius = (fatalities) =>
  Math.max(6, Math.min(28, 6 + (parseInt(fatalities) || 0) * 1.1))

export const NEWS_HEADLINES = [
  'Clashes intensify in Khartoum as RSF advances on civilian neighborhoods',
  '3 new explosion events recorded in northern Gaza in last 6 hours',
  'Serbia student protests enter 4th consecutive week — 200,000 in Belgrade',
  'Houthi drone strike targets Red Sea shipping vessel — crew evacuated',
  'Myanmar junta airstrikes on Sagaing region displace 40,000 civilians',
  'Al-Shabaab attack on Mogadishu checkpoint repelled by Somali forces',
  'Global conflict intensity index rises 12% vs last week — GDELT',
  'Pakistan TTP suicide bombing kills 19 near Peshawar police station',
  'DR Congo M23 advances on Goma — UN warns of humanitarian catastrophe',
  'Ukraine frontline: Heavy artillery exchange reported near Donetsk',
]