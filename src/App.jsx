import { useState } from 'react'
import Header     from './components/Header'
import NewsStrip  from './components/NewsStrip'
import Sidebar    from './components/Sidebar'
import MapView    from './components/MapView'
import RightPanel from './components/RightPanel'
import Timeline   from './components/Timeline'
import StatusBar  from './components/StatusBar'

export default function App() {
  const [mapRef, setMapRef] = useState(null)

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