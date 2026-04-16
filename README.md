<p align="center">
  <img src="https://img.shields.io/badge/STATUS-ACTIVE_DEVELOPMENT-red?style=for-the-badge" />
  <img src="https://img.shields.io/badge/EVENTS-368K+-critical?style=for-the-badge" />
  <img src="https://img.shields.io/badge/DATA_SOURCES-12-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/COVERAGE-1989--2026-blueviolet?style=for-the-badge" />
</p>

<h1 align="center">⚡ THREATWATCH</h1>

<h3 align="center">Global Conflict Intelligence Platform</h3>

<p align="center">
  <em>A Bloomberg Terminal for geopolitical risk — real-time conflict monitoring, satellite verification, humanitarian intelligence, and AI-driven early warning, all on a single interactive globe.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_18-61DAFB?style=flat&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/PostgreSQL_+_PostGIS-4169E1?style=flat&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/Mapbox_GL-000000?style=flat&logo=mapbox&logoColor=white" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white" />
  <img src="https://img.shields.io/badge/Claude_AI-5A32D1?style=flat" />
</p>

---

## What is ThreatWatch?

ThreatWatch aggregates **12 verified data sources** into a single intelligence dashboard where analysts, journalists, NGOs, corporate security teams, and insurers can monitor armed conflicts, humanitarian crises, and geopolitical instability worldwide.

**Every dot on the map is a human-verified conflict event.** We don't plot scraped news article coordinates or auto-coded data — we use UCDP (Uppsala Conflict Data Program), the gold standard in conflict research, where human researchers verify every single event down to village-level precision. This is what makes ThreatWatch trustworthy.

On top of verified events, we layer **satellite-detected thermal anomalies** (NASA FIRMS), **real-time media intelligence** (GDELT), **humanitarian data** (UN OCHA ReliefWeb + UNHCR), and **AI-powered analysis** (Claude) to create a platform that answers three questions:

1. **What is happening?** → Verified conflict events + satellite fire detection
2. **Why does it matter?** → Humanitarian impact + displacement flows + media sentiment
3. **What happens next?** → AI early warning + risk scoring + pattern matching

---

## Data Sources

Every source is verified for commercial use.

| Source | Role | License | Update Frequency |
|--------|------|---------|-----------------|
| **UCDP** | Primary map layer — every dot and strike arc | CC BY 4.0 | Monthly (Candidate) |
| **NASA FIRMS** | Satellite thermal anomaly verification layer | Free & Open (NASA) | Every 3 hours |
| **GDELT** | Media intelligence — breaking news, tone, early warning signals | Unrestricted commercial use | Every 15 minutes |
| **ReliefWeb** (UN OCHA) | Humanitarian reports + crisis figures | Free | Real-time |
| **UNHCR** | Refugee & displacement statistics | Public API | Weekly |
| **Wikidata / Wikipedia** | Actor profiles, historical events, relationship graphs | CC BY-SA | Continuous |
| **Natural Earth** | Country boundaries, choropleth, disputed territories | Public Domain | Static |
| **WorldPop** | Population density for civilian exposure calculations | CC BY 4.0 | Annual |
| **OpenSanctions** | Sanctions & politically exposed persons | Commercial license | Daily |
| **World Bank** | Economic stress indicators (GDP, inflation, unemployment) | CC BY 4.0 | Monthly |
| **OpenSky Network** | Military flight pattern tracking *(planned)* | Research/Partnership | Real-time |
| **AIS Stream** | Maritime vessel tracking *(planned)* | Free WebSocket API | Real-time |

### Data at a Glance

```
368,177  verified conflict events (UCDP GED + Candidate)
  9,766  satellite thermal anomalies (NASA FIRMS)
    134  news articles with sentiment (GDELT)
    299  tone analytics records
     35  years of coverage (1989 — February 2026)
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND · React 18 + Vite                  │
│                                                                 │
│   3D Globe (Mapbox GL)  ·  Sidebar  ·  Country Pages  ·  ...   │
│                          Zustand Store                          │
└──────────────────────────────┬──────────────────────────────────┘
                               │ REST API
┌──────────────────────────────┴──────────────────────────────────┐
│                  BACKEND · Node.js + Express                    │
│                                                                 │
│   Ingestion Services    │   API Routes    │   Cron Jobs         │
│   ├─ UCDP              │   /api/events   │   GDELT: 15min      │
│   ├─ NASA FIRMS         │   /api/fires    │   FIRMS: 3hr        │
│   ├─ GDELT             │   /api/conflicts│   UCDP: daily       │
│   ├─ ReliefWeb         │   /api/context  │   ReliefWeb: 6hr    │
│   ├─ UNHCR             │   /api/risk     │   UNHCR: weekly     │
│   └─ Claude AI         │   /api/alerts   │   Risk scorer: daily│
│                                                                 │
│               Redis Cache + LRU + Cache Middleware               │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────────┐
│              PostgreSQL 16 + PostGIS 3.4                        │
│                                                                 │
│   events · conflicts · articles · humanitarian · displacement   │
│   actors · thermal_anomalies · tone_analytics · risk_scores     │
│   sanctions · alerts · geo_boundaries · watchlists              │
│                                                                 │
│   + 5 Materialized Views for fast aggregation queries           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Design Rule

> **UCDP on the map. GDELT off the map. Always.**

GDELT geolocates by extracting place names from article text and mapping them to city centroids — thousands of events pointing to the exact center of "Baghdad" or "Kyiv." Plotting this data creates false precision. UCDP data is human-verified with village-level coordinates. Every dot on our map is real.

| Layer | Source | Visualization |
|-------|--------|--------------|
| Conflict events | UCDP | Red dots, sized by fatalities |
| Strike arcs | UCDP (precision ≤ 2) | Animated arcs, origin → impact |
| Thermal anomalies | NASA FIRMS | Orange pulsing dots (satellite-detected) |
| Choropleth | UCDP + Natural Earth | Country fill by conflict intensity |
| Refugee flows | UNHCR | Cyan arcs, origin → asylum country |
| Civilian exposure | WorldPop | Semi-transparent radius rings |
| **Breaking news** | **GDELT** | **Sidebar only — never on map** |
| **Tone analytics** | **GDELT** | **Charts only — never on map** |
| **Early warning** | **GDELT** | **Alerts only — never on map** |

---

## Features

### Currently Implemented

- **Interactive 3D Globe** — Dark-themed Mapbox globe with 368k+ verified conflict events
- **Multi-source data pipeline** — UCDP, NASA FIRMS, GDELT, ReliefWeb, UNHCR ingestion with automated cron polling
- **Full REST API** — Events, fires, conflicts, context, tone, displacement, risk, alerts, geo endpoints
- **Redis + Materialized Views caching** — Sub-5ms response times on cached queries
- **UCDP event dots** — Colored by type, sized by fatalities, clickable with full details
- **NASA FIRMS layer** — Satellite-detected thermal anomalies in conflict zones
- **Breaking news** — Real-time GDELT article feed
- **Threat level computation** — Dynamic escalation scoring from event trends

### Roadmap

- [ ] **Country Intelligence Pages** — Deep-dive with stats, timeline, humanitarian data, news
- [ ] **Conflict Intelligence Pages** — Multi-source timeline, AI context, lifecycle staging
- [ ] **Strike arc animations** — Animated origin-to-impact arcs for verified attacks
- [ ] **Choropleth layer** — Countries colored by conflict intensity
- [ ] **AI Morning Briefing** — Claude-generated daily intelligence summary
- [ ] **Early Warning System** — Multi-signal convergence detection (tone + volume + FIRMS + events + displacement)
- [ ] **Risk Scoring Engine** — Composite 0-100 country risk score from 8 weighted components
- [ ] **Actor Intelligence** — Profiles, relationship graphs, sanctions status, sentiment tracking
- [ ] **Historical Explorer** — 35 years of conflict data with timeline playback (WW2, Cold War, post-1989)
- [ ] **Pattern Matching** — "What Happened Last Time?" using UCDP's 35-year dataset
- [ ] **Custom Watchlists & Alerts** — User-defined triggers with email/push notifications
- [ ] **Exportable Reports** — One-click PDF/DOCX country risk assessments and actor dossiers

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Zustand, Chart.js, Mapbox GL JS |
| Backend | Node.js 20+, Express 4, node-cron, axios |
| Database | PostgreSQL 16, PostGIS 3.4 |
| Cache | Redis, ioredis, lru-cache |
| AI | Anthropic Claude API (claude-sonnet-4) |
| Maps | Mapbox GL JS (globe projection, dark theme) |

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 16 with PostGIS extension
- Redis
- Mapbox access token
- UCDP API token (request from ucdp@pcr.uu.se)
- NASA FIRMS MAP_KEY (register at firms.modaps.eosdis.nasa.gov)

### Installation

```bash
# Clone
git clone https://github.com/himanshusuryawanshi/THREAT-WATCH.git
cd THREAT-WATCH

# Install dependencies
npm install

# Set up PostgreSQL + PostGIS
createdb threatwatch
psql threatwatch -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Run migrations
chmod +x db/migrate.sh
./db/migrate.sh

# Configure environment
cp .env.example .env
# Edit .env with your API keys and database credentials

# Start backend
node server/index.js

# Start frontend (separate terminal)
npm run dev
```

### Environment Variables

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/threatwatch
REDIS_URL=redis://localhost:6379
UCDP_API_TOKEN=your-ucdp-token
VITE_MAPBOX_ACCESS_TOKEN=your-mapbox-token
ANTHROPIC_API_KEY=sk-ant-...
RELIEFWEB_APPNAME=threatwatch
```

---

## Project Structure

```
THREAT-WATCH/
├── db/                        # SQL migrations (14 tables + materialized views)
├── server/
│   ├── index.js               # Express app entry point
│   ├── db.js                  # PostgreSQL connection pool
│   ├── cache.js               # Redis + cache middleware
│   ├── services/              # Data ingestion services
│   │   ├── ucdpService.js     # UCDP GED + Candidate events
│   │   ├── firmsService.js    # NASA FIRMS thermal anomalies
│   │   ├── gdeltService.js    # GDELT articles + tone (NOT map events)
│   │   ├── reliefwebService.js
│   │   ├── unhcrService.js
│   │   ├── classifierService.js  # Claude AI conflict detection
│   │   └── normalization.js   # Event type mapping
│   ├── routes/                # REST API endpoints
│   └── cron/                  # Scheduled polling jobs
├── src/                       # React frontend
│   ├── components/
│   │   ├── Map/               # Globe, layers, toggles
│   │   ├── Sidebar/           # Stats, charts, news, alerts
│   │   ├── Pages/             # Country, Conflict, Actor pages
│   │   └── Panels/            # InfoPanel, ArticlePanel
│   └── store/                 # Zustand state + visualization rules
└── BLUEPRINT.md               # Complete implementation specification
```

---

## Data Attribution

ThreatWatch relies on the work of world-class research institutions and organizations:

- **Uppsala Conflict Data Program (UCDP)** — Department of Peace and Conflict Research, Uppsala University. Licensed under CC BY 4.0. Citation: Davies, S., Pettersson, T., Sollenberg, M., & Öberg, M. (2025). *Organized violence 1989–2024*. Journal of Peace Research, 62(4).
- **NASA FIRMS** — Land, Atmosphere Near real-time Capability for EOS (LANCE), NASA Earth Science Data and Information System (ESDIS).
- **GDELT Project** — Supported by Google Jigsaw. Available for unlimited commercial use.
- **ReliefWeb** — United Nations Office for the Coordination of Humanitarian Affairs (UN OCHA).
- **UNHCR** — The UN Refugee Agency. Refugee Data Finder.
- **Natural Earth** — Public domain. Supported by NACIS.
- **WorldPop** — University of Southampton. Licensed under CC BY 4.0.

---

## Who Is This For?

| Audience | Use Case |
|----------|----------|
| **Intelligence Analysts** | Real-time situational awareness, conflict tracking, early warning |
| **Corporate Security** | Travel risk assessment, supply chain threat monitoring |
| **Insurance & Reinsurance** | Geopolitical risk modeling, exposure calculation |
| **Journalists** | Source verification, conflict research, story discovery |
| **Humanitarian Organizations** | Crisis monitoring, displacement tracking, aid planning |
| **Academic Researchers** | Conflict pattern analysis, historical data exploration |
| **Government & Defense** | Open-source intelligence, policy analysis |

---

## Contributing

ThreatWatch is in active development. Contributions are welcome.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Read `BLUEPRINT.md` for the complete technical specification
4. Submit a Pull Request

---

## License

This project is under active development. License details will be updated prior to public release.

---

<p align="center">
  <strong>Built by <a href="https://github.com/himanshusuryawanshi">Himanshu Suryawanshi</a></strong><br>
  IIT Delhi ·
</p>

<p align="center">
  <em>"The goal is not to predict the future — it's to see the present clearly enough that the future becomes obvious."</em>
</p>