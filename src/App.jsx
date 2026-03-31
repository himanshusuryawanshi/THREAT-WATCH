import { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Header      from './components/Header'
import NewsStrip   from './components/NewsStrip'
import Sidebar     from './components/SideBar'
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

  function toggleSidebar() {
    setSidebarOpen(o => !o)
    // Call resize every frame during the 250ms transition
    const start = Date.now()
    const duration = 260
    function tick() {
      mapRef?.resize()
      if (Date.now() - start < duration) {
        requestAnimationFrame(tick)
      }
    }
    requestAnimationFrame(tick)
  }

  return (
    <div className="flex flex-col h-screen bg-dark overflow-hidden">
      <Header />
      <NewsStrip />
      <div className="flex flex-1 overflow-hidden relative" style={{ minHeight: 0 }}>

        {/* Sidebar — smooth width transition */}
        <div style={{
          width:      sidebarOpen ? '220px' : '0px',
          flexShrink: 0,
          overflow:   'hidden',
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <div style={{ width: '220px', height: '100%' }}>
            <Sidebar mapRef={mapRef} layer={layer} />
          </div>
        </div>

        {/* Toggle button — slides with sidebar */}
        <button
          onClick={toggleSidebar}
          style={{
            position:   'absolute',
            left:       sidebarOpen ? '220px' : '0px',
            top:        '50%',
            transform:  'translateY(-50%)',
            zIndex:     600,
            width:      '14px',
            height:     '44px',
            transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            background: '#06090e',
            border:     '0.5px solid #1e2d3d',
            borderLeft: sidebarOpen ? '0.5px solid #1e2d3d' : 'none',
            borderRadius: '0 4px 4px 0',
            cursor:     'pointer',
            display:    'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          className="hover:border-threat/50 group"
        >
          <span style={{
            fontSize:   '10px',
            color:      '#6b7280',
            transition: 'color 0.15s',
            lineHeight: 1,
          }}
            className="group-hover:text-white"
          >
            {sidebarOpen ? '‹' : '›'}
          </span>
        </button>

        {/* Map — takes remaining space, smooth resize */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
          <MapView onMapReady={setMapRef} layer={layer} setLayer={setLayer} />
        </div>

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