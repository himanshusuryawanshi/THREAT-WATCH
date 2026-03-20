# ThreatWatch 🌍

A real-time global conflict monitoring dashboard built with React, Leaflet, and Chart.js. Visualizes attack events, protests, explosions, and civil unrest across the world using live and historical data.

## Live Demo
> Coming soon — GCP deployment in progress

## Features

### Map Views
- Interactive world map with attack markers colored by event type
- Heatmap mode — density visualization of global conflict intensity  
- Cluster mode — grouped markers with event counts, zoom to expand
- Marker size proportional to fatality count
- Pulse rings on events from last 5 days

### Filtering & Search
- Filter by event type — Battles, Explosions, Civilian Violence, Protests, Riots
- Date range picker with custom start and end dates
- Minimum fatality slider
- Full-text search by country, actor, location, or event type
- Reset all filters in one click

### Analytics Panel
- Top countries bar chart — updates dynamically with filters
- Event type donut chart with live percentages
- Country risk ranking with conflict scores
- Event detail panel with notes, intensity bar, and media mentions count

### Timeline
- Interactive brush to select a custom date range
- Draw your own window by clicking and dragging on the canvas
- Play animation that slides through events chronologically
- Map updates in real time as you drag the handles

### Other
- Breaking news strip with auto-scroll, hover to pause
- Keyboard shortcuts — R to reset, Esc to close, F for world view, 1 to 6 for filters
- Export filtered events as CSV
- Share current view URL

## Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Framework  | React 18 + Vite                   |
| Styling    | Tailwind CSS dark theme           |
| Map        | Leaflet.js + React-Leaflet        |
| Heatmap    | Leaflet.heat                      |
| Clustering | Leaflet.MarkerCluster             |
| State      | Zustand                           |
| Charts     | Chart.js                          |
| Timeline   | HTML5 Canvas                      |
| Routing    | React Router DOM                  |

## Data Sources

| Source    | Type                    | Update Frequency |
|-----------|-------------------------|------------------|
| ACLED     | Verified conflict events| Weekly           |
| GDELT     | Real-time news events   | Every 15 minutes |
| Mock data | Demo and development    | Static           |

## Getting Started

### Prerequisites
- Node.js 20 or higher
- npm

## Keyboard Shortcuts

| Key | Action                  |
|-----|-------------------------|
| R   | Reset all filters       |
| Esc | Close detail panel      |
| F   | Fly to world view       |
| 1   | Show all events         |
| 2   | Battles only            |
| 3   | Explosions only         |
| 4   | Protests only           |
| 5   | Civilian violence only  |
| 6   | Riots only              |

## Project Structure

src/
├── components/
│   ├── Header.jsx        top bar with stats and source toggle
│   ├── NewsStrip.jsx     scrolling breaking news strip
│   ├── Sidebar.jsx       filters and event ticker list
│   ├── MapView.jsx       Leaflet map with markers, heatmap, cluster
│   ├── RightPanel.jsx    charts, risk ranking, detail panel
│   ├── Timeline.jsx      interactive date brush with play
│   └── StatusBar.jsx     bottom info and export bar
├── store/
│   └── useStore.js       Zustand global state and filters
├── data/
│   └── events.js         35 realistic mock conflict events
└── utils/
└── constants.js      event type colors and news headlines

## Roadmap

- [ ] Country drill-down page /country/:name
- [ ] Country comparison page /compare
- [ ] Actor profile page /actor/:name
- [ ] Historical timeline page /timeline using UCDP data
- [ ] GDELT BigQuery live data integration
- [ ] ACLED API live data connection
- [ ] Email alerts for country or region
- [ ] Embeddable map widget for other websites
- [ ] Public API with rate limiting
- [ ] Docker and docker-compose setup
- [ ] GCP Cloud Run production deployment
- [ ] Custom domain and SSL certificate

## License
MIT