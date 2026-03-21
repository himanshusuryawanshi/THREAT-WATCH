const ACTOR_ORIGINS = {
  'Russian Armed Forces':       { lat: 55.755, lng: 37.617 },
  'Russian Forces':             { lat: 55.755, lng: 37.617 },
  'Israeli Forces':             { lat: 31.046, lng: 34.851 },
  'IDF':                        { lat: 31.046, lng: 34.851 },
  'Houthi forces':              { lat: 15.369, lng: 44.191 },
  'Houthis':                    { lat: 15.369, lng: 44.191 },
  'TTP':                        { lat: 33.720, lng: 73.060 },
  'Al-Shabaab':                 { lat: 2.046,  lng: 45.341 },
  'RSF':                        { lat: 15.552, lng: 32.532 },
  'Rapid Support Forces':       { lat: 15.552, lng: 32.532 },
  'JNIM':                       { lat: 17.570, lng: -3.996 },
  'Hamas':                      { lat: 31.344, lng: 34.306 },
  'Islamic State':              { lat: 33.315, lng: 44.366 },
  'ISIS':                       { lat: 33.315, lng: 44.366 },
  'M23':                        { lat: -1.679, lng: 29.221 },
  'Wagner Group':               { lat: 55.755, lng: 37.617 },
  'Taliban':                    { lat: 34.525, lng: 69.178 },
  'MNDAA':                      { lat: 23.500, lng: 97.800 },
  'ISCAP':                      { lat: -13.00, lng: 40.000 },
  'Ambazonian separatists':     { lat: 5.959,  lng: 10.146 },
  'Fano militia':               { lat: 11.593, lng: 37.851 },
  'Viv Ansanm coalition':       { lat: 18.542, lng: -72.338 },
  'SDF':                        { lat: 36.202, lng: 37.161 },
  'Palestinian armed groups':   { lat: 31.344, lng: 34.306 },
  'Junta forces':               { lat: 16.866, lng: 96.195 },
}

export function getActorOrigin(actorName) {
  if (!actorName) return null
  // Exact match first
  if (ACTOR_ORIGINS[actorName]) return ACTOR_ORIGINS[actorName]
  // Partial match
  const key = Object.keys(ACTOR_ORIGINS).find(k =>
    actorName.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(actorName.toLowerCase())
  )
  return key ? ACTOR_ORIGINS[key] : null
}

export default ACTOR_ORIGINS