import { useState, useEffect } from 'react'
import MOCK_EVENTS from '../data/events'

const API_URL = 'http://localhost:3001/api/events'

export default function useEvents(source = 'demo') {
  const [events,  setEvents]  = useState(MOCK_EVENTS)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (source === 'demo') {
      setEvents(MOCK_EVENTS)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    fetch(`${API_URL}?source=${source}&limit=3000`)
      .then(r => r.json())
      .then(data => {
        if (data.status === 200) {
          setEvents(data.events)
          console.log(`[useEvents] loaded ${data.events.length} events from ${source}`)
        } else {
          throw new Error(data.error || 'API error')
        }
      })
      .catch(err => {
        console.error('[useEvents] failed:', err.message)
        setError(err.message)
        setEvents(MOCK_EVENTS) // fallback to mock
      })
      .finally(() => setLoading(false))
  }, [source])

  return { events, loading, error }
}