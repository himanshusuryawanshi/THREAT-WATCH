import { create } from 'zustand'
import EVENTS from '../data/events'

const useStore = create((set, get) => ({
  events:         EVENTS,
  filteredEvents: EVENTS,
  selectedEvent:  null,

  activeType:  'all',
  dateFrom:    '2025-01-01',
  dateTo:      '2025-03-20',
  minFatal:    0,
  search:      '',
  dataSource:  'demo',

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
    const q = search.toLowerCase()
    const filtered = events.filter(ev => {
      if (activeType !== 'all' && ev.type !== activeType)     return false
      if (new Date(ev.date) < new Date(dateFrom))             return false
      if (new Date(ev.date) > new Date(dateTo))               return false
      if ((parseInt(ev.fatal) || 0) < minFatal)               return false
      if (q &&
        !ev.country.toLowerCase().includes(q) &&
        !ev.location.toLowerCase().includes(q) &&
        !ev.actor.toLowerCase().includes(q) &&
        !ev.type.toLowerCase().includes(q))                   return false
      return true
    })
    set({ filteredEvents: filtered })
  },

  resetFilters: () => {
    set({
      activeType: 'all',
      dateFrom:   '2025-01-01',
      dateTo:     '2025-03-20',
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