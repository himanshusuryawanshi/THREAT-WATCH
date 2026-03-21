import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Header      from './components/Header'
import NewsStrip   from './components/NewsStrip'
import Sidebar     from './components/Sidebar'
import MapView     from './components/MapView'
import RightPanel  from './components/RightPanel'
import Timeline    from './components/Timeline'
import StatusBar   from './components/StatusBar'
import CountryPage from './pages/CountryPage'
import ComparePage from './pages/ComparePage'
import ActorPage   from './pages/ActorPage'
import useStore    from './store/useStore'

function Dashboard({ mapRef, setMapRef }) {
  return (
    <div className="flex flex-col h-screen bg-dark overflow-hidden">
      <Header />
      <NewsStrip />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar mapRef={mapRef} />
        <MapView onMapReady={setMapRef} />
        <RightPanel />
      </div>
      <Timeline />
      <StatusBar />
    </div>
  )
}

export default function App() {
  const [mapRef, setMapRef]    = useState(null)
  const resetFilters           = useStore(s => s.resetFilters)
  const clearSelectedEvent     = useStore(s => s.clearSelectedEvent)
  const setActiveType          = useStore(s => s.setActiveType)

  useEffect(() => {
    function handleKey(e) {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      const { resetFilters, clearSelectedEvent, setActiveType } = useStore.getState()

      if (e.key === 'Escape') { clearSelectedEvent(); return }

      switch (e.key.toLowerCase()) {
        case 'r': resetFilters(); break
        case 'f': if (mapRef) mapRef.flyTo([20, 10], 2); break
        case '1': setActiveType('all'); break
        case '2': setActiveType('Battles'); break
        case '3': setActiveType('Explosions/Remote violence'); break
        case '4': setActiveType('Protests'); break
        case '5': setActiveType('Violence against civilians'); break
        case '6': setActiveType('Riots'); break
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [mapRef])

  return (
    <Routes>
      <Route path="/" element={<Dashboard mapRef={mapRef} setMapRef={setMapRef} />} />
      <Route path="/country/:name" element={<CountryPage />} />
      <Route path="/compare" element={<ComparePage />} />
      <Route path="/actor/:name" element={<ActorPage />} />
    </Routes>
  )
}