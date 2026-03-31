import { create } from 'zustand'
import EVENTS from '../data/events'

const useStore = create((set, get) => ({
  events:         EVENTS,
  filteredEvents: EVENTS.filter(ev => ev.type === 'Battles'),
  selectedEvent:  null,
  loading:        false,
  error:          null,

  activeType:  'Battles',
  dateFrom:    '2025-01-01',
  dateTo:      '2025-11-30',
  minFatal:    0,
  search:      '',
  dataSource:  'demo',

  loadLiveEvents: async (source = 'acled') => {
    set({ loading: true, error: null })
    try {
      const res  = await fetch(`http://localhost:3001/api/events?source=${source}&limit=3000`)
      const data = await res.json()
      if (data.status === 200) {
        set({
          events:     data.events,
          loading:    false,
          dateFrom:   '2025-01-01',
          dateTo:     '2025-11-30',
          activeType: 'Battles',
          minFatal:   0,
          search:     '',
          dataSource: source,
        })
        get().applyFilters()
        console.log(`[store] loaded ${data.events.length} live events`)
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      console.error('[store] live load failed:', err.message)
      set({ loading: false, error: err.message })
    }
  },

  setSelectedEvent:   (event) => set({ selectedEvent: event }),
  clearSelectedEvent: ()      => set({ selectedEvent: null }),
  setDataSource:      (src)   => set({ dataSource: src }),

  setActiveType: (type) => {
    set({ activeType: type })
    get().applyFilters()
  },

  setDateRange: (from, to) => {
    set({ dateFrom: from, dateTo: to })
    get().applyFilters()
  },

  setMinFatal: (val) => {
    set({ minFatal: val })
    get().applyFilters()
  },

  setSearch: (q) => set({ search: q }),

  applyFilters: () => {
    const { events, activeType, dateFrom, dateTo, minFatal, search } = get()
    const type  = activeType || 'all'
    const from  = dateFrom   || '2025-01-01'
    const to    = dateTo     || '2025-11-30'
    const fatal = minFatal   || 0
    const q     = (search    || '').toLowerCase()

    const filtered = events.filter(ev => {
      if (type !== 'all' && ev.type !== type)           return false
      if (new Date(ev.date) < new Date(from))           return false
      if (new Date(ev.date) > new Date(to))             return false
      if ((parseInt(ev.fatal) || 0) < fatal)            return false
      if (q &&
        !( ev.country  || '').toLowerCase().includes(q) &&
        !( ev.location || '').toLowerCase().includes(q) &&
        !( ev.actor    || '').toLowerCase().includes(q) &&
        !( ev.type     || '').toLowerCase().includes(q)) return false
      return true
    })

    set({ filteredEvents: filtered })
  },

  resetFilters: () => {
    set({
      activeType: 'Battles',
      dateFrom:   '2025-01-01',
      dateTo:     '2025-11-30',
      minFatal:   0,
      search:     '',
    })
    set({ filteredEvents: get().events })
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

export default useStore