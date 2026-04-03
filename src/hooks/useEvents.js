import { useState, useEffect } from 'react'

const API_URL = 'http://localhost:3001/api/events'

export default function useEvents({
  source   = 'acled',
  limit    = 5000,
  country  = null,
  type     = null,
  dateFrom = null,
  dateTo   = null,
} = {}) {
  const [events,  setEvents]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    // Build query string from active filters
    const params = new URLSearchParams({ source, limit })
    if (country)  params.set('country', country)
    if (type)     params.set('type',    type)
    if (dateFrom) params.set('from',    dateFrom)
    if (dateTo)   params.set('to',      dateTo)

    fetch(`${API_URL}?${params}`)
      .then(r => r.json())
      .then(data => {
        if (data.status === 200) {
          setEvents(data.events)
          console.log(`[useEvents] loaded ${data.events.length} events`)
        } else {
          throw new Error(data.error || 'API error')
        }
      })
      .catch(err => {
        console.error('[useEvents] failed:', err.message)
        setError(err.message)
        setEvents([])
      })
      .finally(() => setLoading(false))

  }, [source, limit, country, type, dateFrom, dateTo])

  return { events, loading, error }
}