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
export const SOURCES = {
  gdelt: 'gdelt',
}

const useStore = create((set, get) => ({
  events:         [],
  filteredEvents: [],
  selectedEvent:  null,
  loading:        true,
  error:          null,

  activeType:  'all',
  dateFrom:    daysAgo(7),
  dateTo:      today(),
  minFatal:    0,
  search:      '',
  dataSource:  'gdelt',

  // ── Load events from Postgres ─────────────────────────────────────────────
  loadLiveEvents: async (source = 'gdelt') => {
    set({ loading: true, error: null, dataSource: source })
    try {
      const params = new URLSearchParams({ from: daysAgo(7), to: today() })
      const res    = await fetch(`${API}?${params}`)
      const data   = await res.json()
      if (data.status === 200) {
        set({
          events:     data.events,
          loading:    false,
          activeType: 'all',
          dateFrom:   daysAgo(7),
          dateTo:     today(),
          minFatal:   0,
          search:     '',
        })
        get().applyFilters()
        console.log(`[store] loaded ${data.events.length} events`)
      } else {
        throw new Error(data.error)
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
      if (data.status === 200) {
        set({ events: data.events, filteredEvents: data.events, loading: false })
      } else {
        throw new Error(data.error)
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

      const evDate = ev.date.substring(0, 10)
      if (dateFrom && evDate < dateFrom)         return false
      if (dateTo   && evDate > dateTo)           return false
      if ((parseInt(ev.fatal) || 0) < fatal)     return false

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
      dateFrom:   daysAgo(7),
      dateTo:     today(),
      minFatal:   0,
      search:     '',
    })
    get().applyFilters()
  },

  getStats: () => {
    const { filteredEvents } = get()
    return {
      total:      filteredEvents.length,
      fatalities: filteredEvents.reduce((s, e) => s + (parseInt(e.fatal) || 0), 0),
      countries:  new Set(filteredEvents.map(e => e.country)).size,
    }
  },
}))

// Auto-load on app start
useStore.getState().loadLiveEvents('gdelt')

export default useStore