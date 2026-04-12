import { create } from 'zustand'

const API = 'http://localhost:3001/api/events'

// ── Dynamic date helpers — never hardcoded ───────────────────────────────────
function today()    { return new Date().toISOString().split('T')[0] }
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

// ── Sources registry ─────────────────────────────────────────────────────────
// UCDP is the ONLY source for map events. GDELT is intelligence-layer only.
export const SOURCES = {
  ucdp: 'ucdp',
}

const useStore = create((set, get) => ({
  events:         [],
  filteredEvents: [],
  selectedEvent:  null,
  loading:        true,
  error:          null,

  activeType:  'all',
  dateFrom:    null,
  dateTo:      null,
  minFatal:    0,
  search:      '',
  dataSource:  'ucdp',

  // Layer visibility toggles
  layers: {
    events:  true,
    fires:   false,
    arcs:    true,
  },
  toggleLayer: (name) => set(s => ({
    layers: { ...s.layers, [name]: !s.layers[name] }
  })),

  // Intelligence data (fetched separately from events)
  breakingNews:       [],
  conflicts:          [],
  humanitarianStats:  null,
  escalationLevels:   { critical: 0, elevated: 0, watch: 0 },
  alerts:             [],

  // ── Load events from Postgres ─────────────────────────────────────────────
  loadLiveEvents: async (source = 'ucdp') => {
    set({ loading: true, error: null, dataSource: source })
    try {
      // No date range passed — server returns ORDER BY date DESC LIMIT 500
      // Supports historical UCDP data (1989-2018) without filtering it out
      const params = new URLSearchParams({ source, limit: 500 })
      const res    = await fetch(`${API}?${params}`)
      const data   = await res.json()
      if (data.status !== undefined || data.events) {
        const events = data.events || []
        set({
          events:     events,
          loading:    false,
          activeType: 'all',
          dateFrom:   null,
          dateTo:     null,
          minFatal:   0,
          search:     '',
        })
        get().applyFilters()
        console.log(`[store] loaded ${events.length} events`)
      } else {
        throw new Error(data.error || 'API error')
      }
    } catch (err) {
      console.error('[store] load failed:', err.message)
      set({ loading: false, error: err.message })
    }
  },

  // ── Filtered fetch — pushes filters to Postgres ───────────────────────────
  loadFiltered: async ({ country, type, dateFrom, dateTo } = {}) => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams()
      if (country)                params.set('country', country)
      if (type && type !== 'all') params.set('type',    type)
      if (dateFrom)               params.set('from',    dateFrom)
      if (dateTo)                 params.set('to',      dateTo)

      const res  = await fetch(`${API}?${params}`)
      const data = await res.json()
      if (data.events) {
        set({ events: data.events, filteredEvents: data.events, loading: false })
      } else {
        throw new Error(data.error || 'API error')
      }
    } catch (err) {
      console.error('[store] filtered load failed:', err.message)
      set({ loading: false, error: err.message })
    }
  },

  setSelectedEvent:   (event) => set({ selectedEvent: event }),
  clearSelectedEvent: ()      => set({ selectedEvent: null }),

  setActiveType: (type) => { set({ activeType: type }); get().applyFilters() },
  setDateRange:  (from, to) => { set({ dateFrom: from, dateTo: to }); get().applyFilters() },
  setMinFatal:   (val) => { set({ minFatal: val }); get().applyFilters() },
  setSearch:     (q)   => { set({ search: q });    get().applyFilters() },

  applyFilters: () => {
    const { events, activeType, dateFrom, dateTo, minFatal, search } = get()
    const type  = activeType || 'all'
    const fatal = minFatal   || 0
    const q     = (search    || '').toLowerCase().trim()

    const filtered = events.filter(ev => {
      if (type !== 'all' && ev.type !== type)   return false

      if (dateFrom || dateTo) {
        const evDate = ev.date.substring(0, 10)
        if (dateFrom && evDate < dateFrom)       return false
        if (dateTo   && evDate > dateTo)         return false
      }
      if ((parseInt(ev.fatalities) || 0) < fatal) return false

      if (q) {
        const countryMatch  = (ev.country  || '').toLowerCase().startsWith(q)
        const locationMatch = (ev.location || '').toLowerCase().includes(q)
        if (!countryMatch && !locationMatch) return false
      }

      return true
    })

    set({ filteredEvents: filtered })
  },

  resetFilters: () => {
    set({
      activeType: 'all',
      dateFrom:   null,
      dateTo:     null,
      minFatal:   0,
      search:     '',
    })
    get().applyFilters()
  },

  getStats: () => {
    const { filteredEvents } = get()
    return {
      total:      filteredEvents.length,
      fatalities: filteredEvents.reduce((s, e) => s + (parseInt(e.fatalities) || 0), 0),
      countries:  new Set(filteredEvents.map(e => e.country)).size,
    }
  },
}))

// Auto-load on app start — UCDP events only
useStore.getState().loadLiveEvents('ucdp')

export default useStore