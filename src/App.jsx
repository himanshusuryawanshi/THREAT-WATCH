import { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
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
  const [layer,       setLayer]       = useState('markers')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex flex-col h-screen bg-dark overflow-hidden">
      <Header />
      <NewsStrip />
      <div className="flex flex-1 overflow-hidden relative">

        {/* Sidebar toggle button */}
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-[600] bg-panel border border-border2 border-l-0 rounded-r px-1 py-3 text-muted hover:text-white hover:border-threat/50 transition-all"
          style={{ left: sidebarOpen ? '220px' : '0px', transition: 'left 0.2s ease' }}
        >
          <div className="text-[10px] font-mono">{sidebarOpen ? '<<' : '>>'}</div>
        </button>

        {/* Sidebar */}
        <div
          style={{
            width:     sidebarOpen ? '220px' : '0px',
            overflow:  'hidden',
            transition: 'width 0.2s ease',
            flexShrink: 0,
          }}
        >
          <Sidebar mapRef={mapRef} layer={layer} />
        </div>

        <MapView onMapReady={setMapRef} layer={layer} setLayer={setLayer} />
        <RightPanel />
      </div>
      <Timeline />
      <StatusBar />
    </div>
  )
}

export default function App() {
  const [mapRef, setMapRef] = useState(null)
  const location            = useLocation()

  // Restore live data when navigating back to dashboard
  useEffect(() => {
    if (location.pathname === '/') {
      const { dataSource, events, loadLiveEvents } = useStore.getState()
      if (dataSource !== 'demo' && events.length <= 35) {
        loadLiveEvents(dataSource)
      }
    }
  }, [location.pathname])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e) {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      const { resetFilters, clearSelectedEvent, setActiveType } = useStore.getState()

      if (e.key === '/') {
        e.preventDefault()
        document.querySelector('header input')?.focus()
        return
      }
      if (e.key === 'Escape') { clearSelectedEvent(); return }

      switch (e.key.toLowerCase()) {
        case 'r': resetFilters(); break
        case 'f': if (mapRef) mapRef.flyTo([20, 10], 2); break
        case '1': setActiveType('all'); break
        case '2': setActiveType('Battles'); break
        case '3': setActiveType('Explosions/Remote violence'); break
        case '4': setActiveType('Violence against civilians'); break
        case '5': setActiveType('Protests'); break
        case '6': setActiveType('Riots'); break
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [mapRef])

  return (
    <Routes>
      <Route path="/"             element={<Dashboard mapRef={mapRef} setMapRef={setMapRef} />} />
      <Route path="/country/:name" element={<CountryPage />} />
      <Route path="/compare"       element={<ComparePage />} />
      <Route path="/actor/:name"   element={<ActorPage />} />
    </Routes>
  )
}