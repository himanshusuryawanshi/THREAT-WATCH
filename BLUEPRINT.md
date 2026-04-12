# THREATWATCH — THE COMPLETE BLUEPRINT

> **This document is the single source of truth for building ThreatWatch.**
> Claude Code: Read this ENTIRE document before writing any code. Follow phases in order.

---

## PART 1: WHAT IS THREATWATCH

ThreatWatch is a **global intelligence platform** — not just a conflict map. It's what Bloomberg Terminal is to finance, but for geopolitical risk. A single pane of glass where intelligence analysts, corporate security teams, insurers, journalists, NGOs, and governments understand what's happening in the world, why it's happening, and what's going to happen next.

The product has three layers:
1. **Monitor** — Real-time awareness of global conflicts, crises, and instability
2. **Analyze** — Deep intelligence on conflicts, actors, and patterns
3. **Predict** — AI-driven forecasting, early warning, and risk scoring

---

## PART 2: DATA SOURCES — COMMERCIAL LICENSE VERIFICATION

Every data source below has been verified for commercial use.

### TIER 1 — CORE EVENT DATA (What happened, where, when)

#### 1. UCDP (Uppsala Conflict Data Program)
- **License:** CC BY 4.0 — commercial use allowed with citation
- **What it is:** The gold standard for conflict event data. Human researchers verify every event. Village-level precision geocoding.
- **Coverage:** 1989–present, updated monthly (Candidate) and annually (GED)
- **API:** `https://ucdpapi.pcr.uu.se/api/`
- **ROLE IN THREATWATCH:** The ONLY event data source plotted on the map. Every dot, every strike arc is UCDP data. This is what makes us trustworthy — every point on our map is verified by human researchers.
- **What we extract:**
  - Georeferenced events with village-level coordinates
  - Actor pairs (side_a vs side_b) with full names
  - Fatality estimates (best/low/high)
  - Conflict classifications (state-based, non-state, one-sided violence)
  - Dyad relationships between actors
  - Historical conflict data back to 1989

#### 2. NASA FIRMS (Fire Information for Resource Management System)
- **License:** Free and open — NASA supports full and open sharing of data
- **What it is:** Near real-time satellite detection of fires and thermal anomalies worldwide. Bellingcat and OSINT analysts use this to monitor war zones — satellite-detected fires in conflict areas often indicate shelling, airstrikes, or scorched earth campaigns.
- **Coverage:** Global, updated within 3 hours of satellite overpass
- **API:** `https://firms.modaps.eosdis.nasa.gov/api/`
- **ROLE IN THREATWATCH:** A SECOND independent map layer that verifies/supplements UCDP data. When UCDP hasn't coded an event yet but FIRMS shows a massive thermal anomaly in a conflict zone, that's early signal. This is satellite truth — not news articles, not human coders, but actual infrared radiation from space.
- **What we extract:**
  - Active fire/thermal anomaly locations with lat/lng (375m resolution for VIIRS)
  - Fire Radiative Power (FRP) — intensity indicator
  - Confidence levels
  - Satellite source and acquisition time
- **Smart filtering:** Not all fires are conflict — filter by cross-referencing with known conflict zones from UCDP. A thermal anomaly in a Ukrainian frontline village is almost certainly shelling. A thermal anomaly in the Amazon is probably a wildfire. Context matters.

### TIER 2 — INTELLIGENCE LAYER (Why it's happening, who's involved)

#### 3. GDELT (Global Database of Events, Language, and Tone)
- **License:** Unlimited and unrestricted use for any academic, commercial, or governmental use without fee
- **What it is:** Monitors every news article in 100+ languages worldwide, every 15 minutes. Extracts people, organizations, themes, emotions, and tone.
- **Coverage:** 1979–present, updates every 15 minutes
- **API:** DOC API, GEO API, Event Database 2.0, Global Knowledge Graph
- **ROLE IN THREATWATCH:** NOT a map data source (coordinates are city centroids = useless for mapping). GDELT is our **intelligence brain** — the analytical engine that powers:
  - **Breaking News Feed** — Real article headlines, links, sources. Not plotted on map, shown in sidebar/panels.
  - **Early Warning System** — Tone shifts precede violence by 48-72 hours. Track sentiment per country/actor/region.
  - **Narrative Tracker** — How is Russia covering event X vs BBC vs Al Jazeera? Source country divergence = propaganda signal.
  - **Actor Pulse** — Real-time tracking of mention frequency + tone for any person/group. Mention spike = something incoming.
  - **Volume Anomaly Detection** — 10x normal article volume about a region = something is happening before events are coded.
  - **Media Landscape** — Which sources cover which regions. Identify information deserts where no one is reporting.
- **What we extract:**
  - Article metadata: title, URL, source name, source country, language, publish date
  - Tone/sentiment score per article (-100 to +100)
  - Goldstein scale (-10 to +10, conflict to cooperation)
  - GKG themes, persons, organizations mentioned
  - Article volume over time per query
  - Source country distribution (who's reporting on what)

#### 4. ReliefWeb (UN OCHA)
- **License:** Free, no fees. Content from humanitarian partners.
- **What it is:** The United Nations' humanitarian information platform. Curated reports from UNHCR, OCHA, UNICEF, WFP, and 4000+ sources going back to the 1980s.
- **API:** `https://api.reliefweb.int/v2/`
- **ROLE IN THREATWATCH:** The **human cost layer**. Raw event counts mean nothing to decision-makers. "342 events in Sudan" → so what? "8.2M displaced, 25M in need, acute food insecurity" → that drives action.
  - **Crisis Situation Reports** — Latest UN assessments per country
  - **Humanitarian Figures** — People affected, displaced, in need
  - **Disaster Tracking** — Natural disasters compounding conflicts
  - **Conflict Context Summaries** — Expert-written background for each crisis
- **What we extract:**
  - Reports filtered by "Armed Conflict" theme
  - Country, source org, summary text, publication date
  - Crisis figures: people affected, people displaced, people in need
  - Active disaster listings with status

#### 5. UNHCR Refugee Statistics API
- **License:** Public API, free to use
- **What it is:** Official UN refugee data — 70+ years of displacement statistics covering refugees, asylum-seekers, IDPs, and stateless persons.
- **API:** `https://api.unhcr.org/population/v1/`
- **ROLE IN THREATWATCH:** The **displacement intelligence layer**. When a conflict escalates, refugee flows are the human signal. Track where people are fleeing from and to.
  - **Refugee Flow Maps** — Origin → destination flow arcs showing displacement patterns
  - **Country Displacement Profiles** — Total refugees hosted, total refugees originated
  - **Historical Displacement Trends** — How displacement has changed over time per conflict
  - **Asylum Claim Tracking** — Where people are seeking protection
- **What we extract:**
  - Population figures by country of origin and asylum
  - Year-over-year changes in displacement
  - Demographics of displaced populations
  - Solutions data (repatriation, resettlement numbers)

#### 6. OpenSanctions
- **License:** Free for non-commercial. Commercial license required for business use (~€2000/year starting). Worth it.
- **What it is:** Consolidated database of sanctioned entities, politically exposed persons (PEPs), and persons of interest from 328 global sources.
- **API:** `https://api.opensanctions.org/`
- **ROLE IN THREATWATCH:** The **who's who of bad actors** layer. When a user clicks on an actor or entity, show if they're sanctioned, by whom, and why. This alone is worth $500/month to compliance teams.
  - **Sanctions Checker** — Is this actor/entity/vessel sanctioned?
  - **Sanctions Regime Mapping** — Which countries have sanctioned which entities
  - **PEP Tracking** — Politically exposed persons connected to conflicts
  - **Cross-Reference** — Link UCDP actors to sanctions lists automatically
- **What we extract:**
  - Entity name, aliases, nationality
  - Sanctioning authority (UN, EU, OFAC, etc.)
  - Sanction type (asset freeze, travel ban, arms embargo)
  - Associated entities and relationships

### TIER 3 — GEOSPATIAL & DEMOGRAPHIC CONTEXT

#### 7. Natural Earth
- **License:** Public domain — zero restrictions, no attribution required
- **What it is:** The cartographer's gold standard for country boundaries, coastlines, and admin divisions.
- **ROLE IN THREATWATCH:**
  - **Choropleth Base Layer** — Color countries by conflict intensity, risk score, displacement
  - **Disputed Territory Mapping** — Kashmir, Crimea, Western Sahara, etc. with de facto boundaries
  - **Admin-1 Boundaries** — State/province level for subnational analysis
  - **Populated Places** — City points with population data

#### 8. WorldPop
- **License:** CC BY 4.0 — commercial use allowed
- **What it is:** High-resolution population density grids derived from satellite imagery and census data.
- **ROLE IN THREATWATCH:** The **civilian impact calculator**. Not just "where is the conflict" but "how many people are affected."
  - **Civilian Exposure Radius** — "3.2M people within 50km of active fighting"
  - **Impact Scoring** — Weight conflicts by population density
  - **Displacement Estimation** — Cross-reference conflict zones with population
  - **Humanitarian Planning** — Estimate affected populations for aid planning

#### 9. Wikidata + Wikipedia
- **License:** CC BY-SA — commercial use allowed with share-alike
- **What it is:** Structured knowledge graph (Wikidata) + encyclopedic content (Wikipedia) covering every notable person, organization, event, and place.
- **ROLE IN THREATWATCH:**
  - **Actor Profiles** — Biographical summaries, photos, life timelines
  - **Relationship Graphs** — Who allies with whom, commands whom, opposes whom
  - **Historical Events** — WW2 battles, Cold War proxy wars, decolonization — all geocoded
  - **Context Engine** — Click any actor and instantly understand their history and connections

### TIER 4 — SIGNAL INTELLIGENCE (Multi-source corroboration)

#### 10. OpenSky Network
- **License:** Free for research and non-commercial. Commercial requires partnership discussion.
- **What it is:** Global ADS-B flight tracking from community-operated receivers.
- **API:** `https://opensky-network.org/api/`
- **ROLE IN THREATWATCH (Future):** Military flight pattern anomalies. A sudden spike in military tanker/transport flights over a region = logistics buildup. This is a premium signal layer.
- **Note:** Start with free tier for development. Negotiate commercial terms at scale.

#### 11. AIS Ship Tracking (aisstream.io)
- **License:** Free WebSocket API for vessel tracking
- **What it is:** Real-time ship position data via Automatic Identification System.
- **API:** WebSocket at `wss://stream.aisstream.io/v0/stream`
- **ROLE IN THREATWATCH (Future):** Maritime security intelligence. Track naval movements near conflict zones, monitor shipping route disruptions (Strait of Hormuz, Red Sea, South China Sea), detect dark ships (vessels turning off AIS in suspicious areas).

#### 12. World Bank Open Data
- **License:** CC BY 4.0 — commercial use allowed
- **What it is:** Economic indicators for every country — GDP, inflation, unemployment, fragility metrics.
- **API:** `https://api.worldbank.org/v2/`
- **ROLE IN THREATWATCH:** Economic stress indicators correlate with conflict onset. Rising food prices + youth unemployment + declining GDP = instability risk. This feeds the risk scoring model.

---

## PART 3: WHAT TO SHOW — EVERY FEATURE

### A. THE GLOBE (Main View)

The centerpiece. A dark 3D Mapbox globe that tells you the state of the world at a glance.

**Map Layers (togglable):**

| Layer | Data Source | What It Shows |
|-------|-----------|---------------|
| **Conflict Events** | UCDP | Precise dots at village-level locations. Size = fatalities. Color = event type. ONLY source plotted as individual events. |
| **Strike Arcs** | UCDP | Animated arcs between origin→destination for verified events with geo_precision ≤ 2. Sequential chronological playback. |
| **Thermal Anomalies** | NASA FIRMS | Satellite-detected fires/heat in conflict zones. Pulsing orange dots. Independent verification layer — this is what the satellite actually saw. |
| **Conflict Intensity Choropleth** | UCDP + Natural Earth | Countries colored by event density/fatalities. Darker red = more intense. |
| **Refugee Flow Arcs** | UNHCR | Animated flow lines showing displacement: origin country → asylum country. Width = number of people. |
| **Civilian Exposure Rings** | WorldPop + UCDP | Semi-transparent radius circles around active conflict clusters showing estimated population within 25/50/100km. |
| **Disputed Territories** | Natural Earth | Hatched/dashed boundaries for disputed areas (Kashmir, Crimea, etc.) |
| **Sanctions Overlay** | OpenSanctions | Countries with active sanctions regimes highlighted with a subtle border glow |

**Map Interactions:**
- Click UCDP dot → InfoPanel with event details, actor names, fatalities, source
- Click FIRMS dot → Satellite panel showing thermal anomaly data, cross-reference with nearest UCDP events
- Click country → Navigate to Country Intelligence Page
- Click refugee flow arc → Show displacement details (origin, destination, numbers, trend)
- Hover country → Quick stats tooltip (events this month, fatalities, risk score)

### B. SIDEBAR (Always visible alongside map)

```
┌─────────────────────────────────────┐
│ ⚡ GLOBAL THREAT STATUS             │
│                                     │
│ ┌─ Threat Level ──────────────────┐ │
│ │ 🔴 CRITICAL  3 conflicts        │ │  ← Computed from escalation_score
│ │ 🟠 ELEVATED  7 conflicts        │ │
│ │ 🟡 WATCH     12 conflicts       │ │
│ │ 🟢 STABLE    rest of world      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ Layer Controls ────────────────┐ │
│ │ [Events] [Fires] [Flows]        │ │
│ │ [Choropleth] [Exposure]         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ Top Active Conflicts ──────────┐ │
│ │ 1. Sudan         ████████ 412   │ │  ← UCDP event counts
│ │ 2. Ukraine       ███████ 356    │ │
│ │ 3. Myanmar       ██████ 287     │ │
│ │ 4. Gaza          █████ 234      │ │
│ │ 5. DRC           ████ 198       │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ Event Breakdown ───────────────┐ │
│ │ [Donut chart by event type]     │ │  ← UCDP normalized types
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ Human Cost ────────────────────┐ │  ← ReliefWeb + UNHCR
│ │ 🧑‍🤝‍🧑 126.4M forcibly displaced  │ │
│ │ 🏚️ 68.3M refugees              │ │
│ │ ⚠️  43 active crises            │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ Satellite Fires (24h) ────────┐ │  ← NASA FIRMS
│ │ 🔥 142 anomalies in conflict    │ │
│ │    zones detected               │ │
│ │ Top: Ukraine (47), Sudan (38)   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ Early Warning ─────────────────┐ │  ← GDELT tone analysis
│ │ ⚠️ Ethiopia: tone dropped -34%  │ │
│ │ ⚠️ Niger: volume spike +400%   │ │
│ │ ✅ Colombia: tone improving     │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ Breaking News ─────────────────┐ │  ← GDELT DOC API
│ │ • Reuters: Ceasefire talks...   │ │
│ │ • Al Jazeera: Escalation in...  │ │
│ │ • BBC: UN warns of...           │ │
│ │         [auto-scrolling ticker] │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### C. AI MORNING BRIEFING (Premium Feature)

Claude AI generates a personalized daily intelligence summary.

**Input to Claude:**
- Last 24h events from UCDP + FIRMS
- GDELT tone trends per active conflict
- New ReliefWeb situation reports
- User's watchlist (countries, actors, regions they care about)

**Output:**
```
THREATWATCH DAILY BRIEFING — April 5, 2026

OVERNIGHT SUMMARY:
• Escalation detected in 2 regions: Eastern DRC (12 new events, +60% from 
  last week) and Northern Myanmar (8 events, new front opened in Kachin State)
• De-escalation signal: Sudan ceasefire talks showing positive GDELT tone 
  shift (+18% over 48 hours)
• New conflict candidate detected: Niger/Burkina Faso border region 
  (confidence: 0.78)

YOUR WATCHLIST:
🔴 Ukraine: 47 thermal anomalies detected overnight. 23 UCDP events coded 
   in Zaporizhzhia region. Media tone: -4.2 (deteriorating).
🟡 Syria: 3 events in Idlib. ReliefWeb reports new displacement wave 
   affecting estimated 40,000 people.
🟢 Ethiopia: Relative calm. 1 event in Tigray. GDELT tone improving +12%.

EMERGING RISKS:
• Pakistan: GDELT volume anomaly — 6x normal coverage of Balochistan 
  region. No UCDP events yet but monitoring recommended.

SATELLITE INTELLIGENCE:
• 4 high-intensity thermal anomalies detected in previously quiet areas 
  of eastern Ukraine (FRP > 500MW). Consistent with artillery strikes.
```

### D. COUNTRY INTELLIGENCE PAGE

Full deep-dive for any country. This is where ThreatWatch becomes indispensable.

```
┌─────────────────────────────────────────────────────────────┐
│ 🇺🇦 UKRAINE                          Risk Score: 94/100    │
│ Status: CRITICAL CONFLICT              [Add to Watchlist]  │
│                                                             │
│ ┌─ Quick Stats ───────────────────────────────────────────┐ │
│ │ Events (30d): 342    │ Fatalities (30d): 1,204         │ │ ← UCDP
│ │ Trend: ↑ +12%        │ FIRMS fires (7d): 187           │ │ ← FIRMS
│ │ Displaced: 3.7M IDPs │ Refugees abroad: 6.2M           │ │ ← UNHCR
│ │ Civilians exposed: 8.4M within 50km of fighting        │ │ ← WorldPop
│ │ Sanctions: 14 regimes active against Russia             │ │ ← OpenSanctions
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Intelligence Map ──────────────────────────────────────┐ │
│ │ [Mapbox zoomed to country]                              │ │
│ │  • UCDP event dots (colored by type)                    │ │
│ │  • NASA FIRMS thermal anomalies (orange pulses)         │ │
│ │  • Civilian exposure rings (translucent circles)        │ │
│ │  • Strike arcs (animated, UCDP high-precision only)     │ │
│ │  [Layer toggles: Events | Fires | Exposure | Arcs]     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Conflict Timeline ─────────────────────────────────────┐ │
│ │ [Interactive Chart.js timeline]                         │ │
│ │ Line 1: UCDP events over time                          │ │
│ │ Line 2: FIRMS thermal anomalies over time               │ │
│ │ Line 3: GDELT media tone over time                      │ │
│ │ [Play button for chronological replay on map]          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Media Sentiment ───────────────────────────────────────┐ │ ← GDELT
│ │ [Tone trend chart: global media sentiment]              │ │
│ │ [Breakdown by source country: US vs RU vs CN coverage]  │ │
│ │ [Volume chart: article count over time]                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Humanitarian Situation ────────────────────────────────┐ │ ← ReliefWeb
│ │ Latest UN OCHA Situation Report (March 2026):           │ │
│ │ "14.6M people in need of humanitarian assistance..."    │ │
│ │                                                         │ │
│ │ People in Need: 14.6M  │  IDPs: 3.7M                  │ │
│ │ Food Insecure: 6.1M    │  Children affected: 4.2M     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Displacement Flows ────────────────────────────────────┐ │ ← UNHCR
│ │ [Sankey/flow diagram: Ukraine → Poland (1.6M)]         │ │
│ │ [Ukraine → Germany (1.1M)]                             │ │
│ │ [Ukraine → Czech Republic (0.5M)]                      │ │
│ │ [Year-over-year change chart]                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Key Actors ────────────────────────────────────────────┐ │ ← UCDP+Wiki
│ │ [Cards with photos: Zelenskyy, Putin, Wagner, etc.]    │ │
│ │ [Sanctioned badge on sanctioned actors]                │ │ ← OpenSanctions
│ │ [Click → Actor Intelligence Page]                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Risk Indicators ───────────────────────────────────────┐ │ ← World Bank
│ │ GDP Growth: -29.1%  │  Inflation: 26.6%                │ │
│ │ Unemployment: 24.5% │  Fragility Index: 78/120         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Latest Coverage ───────────────────────────────────────┐ │ ← GDELT articles
│ │ [Article cards with source logo, headline, tone bar]   │ │
│ │ [Filter by source country, language, date]             │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### E. CONFLICT INTELLIGENCE PAGE

Deep-dive into a specific conflict (e.g., "Russia-Ukraine War").

All the above PLUS:
- **Conflict Lifecycle Stage** — Tension → Escalation → Peak → De-escalation → Frozen (classified by Claude AI using UCDP trends + GDELT tone)
- **"What Happened Last Time?"** — Pattern match this conflict against UCDP's 35 years of data. "The closest historical parallel is the Yugoslav Wars (1991-2001): similar actor count, escalation trajectory, and international involvement pattern."
- **Sanctions Impact** — All active sanctions regimes related to this conflict (OpenSanctions)
- **Satellite Verification** — FIRMS thermal anomaly timeline overlaid with UCDP events to show how satellite data corroborates/precedes ground reports
- **Multi-Source Timeline** — Unified chronological view: UCDP events + FIRMS fires + GDELT tone shifts + ReliefWeb reports + UNHCR displacement spikes, all on one timeline

### F. ACTOR INTELLIGENCE PAGE (Phase 3)

```
┌─────────────────────────────────────────────────────────────┐
│ VOLODYMYR ZELENSKYY                                         │
│ President of Ukraine                     [Watchlist ☆]      │
│                                                             │
│ ┌─ Profile ───────────────────────────────────────────────┐ │ ← Wikipedia
│ │ [Photo]  Born: 25 Jan 1978, Kryvyi Rih, Ukraine        │ │
│ │          Wikipedia summary...                           │ │
│ │          🏛️ NOT SANCTIONED                              │ │ ← OpenSanctions
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Life Timeline ─────────────────────────────────────────┐ │ ← Wikidata
│ │ 1978────2015────2019────2022────2025────present         │ │
│ │ born    show    elected invasion NATO bid               │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Event Participation Map ───────────────────────────────┐ │ ← UCDP
│ │ [Map dots: all events involving this actor]             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Relationship Graph ────────────────────────────────────┐ │ ← Wikidata+UCDP
│ │ [D3 force-directed: allies, enemies, organizations]    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Global Media Perception ───────────────────────────────┐ │ ← GDELT
│ │ [Sentiment line chart over time]                        │ │
│ │ [Mention frequency chart]                               │ │
│ │ [Breakdown: Western vs Russian vs Chinese media tone]   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Sanctions & Legal Status ──────────────────────────────┐ │ ← OpenSanctions
│ │ Not personally sanctioned.                              │ │
│ │ Associated sanctioned entities: [list]                  │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### G. EARLY WARNING SYSTEM (The Billion-Dollar Feature)

This is what makes ThreatWatch worth more than any competitor. No one else combines these signals:

**Signal Sources:**
1. **GDELT Tone Shift** — Media sentiment about a region drops sharply → 48-72 hour warning before violence
2. **GDELT Volume Anomaly** — Article count about a region spikes 5x+ → something is happening
3. **NASA FIRMS Anomaly** — Thermal anomalies appear in previously quiet conflict zones → possible shelling/burning
4. **UCDP Event Acceleration** — Week-over-week event count increasing → escalation
5. **UNHCR Displacement Spike** — Sudden refugee flow increase → people are fleeing before international media notices
6. **GDELT Narrative Divergence** — State media tone diverges sharply from international media → propaganda campaign preceding action
7. **World Bank Stress Indicators** — Food price spike + unemployment rise → conditions for instability

**Alert Types:**
- 🔴 **CRITICAL** — Multiple signals converging (3+ signal types in same region within 24 hours)
- 🟠 **ELEVATED** — 2 signal types or single strong signal (tone drop > 30%)
- 🟡 **WATCH** — Single weak signal, monitoring recommended
- 📧 **Custom Alerts** — Users define watchlist → email/push when thresholds hit

### H. RISK SCORING ENGINE

Every country gets a dynamic **ThreatWatch Risk Score (0-100)** computed from:

| Component | Weight | Source | What It Measures |
|-----------|--------|--------|-----------------|
| Conflict Intensity | 25% | UCDP | Events per capita, fatality rate, trend |
| Escalation Trajectory | 20% | UCDP + GDELT | Week-over-week change in events + tone |
| Humanitarian Crisis Severity | 15% | ReliefWeb + UNHCR | People displaced, in need, food insecure |
| Satellite Indicators | 10% | NASA FIRMS | Thermal anomalies in non-wildfire zones |
| Media Attention Anomaly | 10% | GDELT | Volume vs baseline, tone vs baseline |
| Economic Stress | 10% | World Bank | GDP decline, inflation, unemployment |
| Sanctions Pressure | 5% | OpenSanctions | Number/severity of active sanctions |
| Historical Pattern | 5% | UCDP historical | Conflict recurrence probability |

**Output per country:** Score 0-100, trend arrow, risk level (Critical/Elevated/Watch/Stable), top contributing factors.

**Who pays for this:** Insurance companies, corporate security, supply chain managers, investors.

### I. HISTORICAL EXPLORER (Phase 2)

Toggle from "Live Monitor" to "Historical Explorer" to explore past conflicts.

- **WW2 Battle Map** — Every major battle plotted chronologically with play-through timeline (Wikidata)
- **Cold War Proxy Conflicts** — Mapped with participant data and outcome (UCDP + Wikidata)
- **Decolonization Timeline** — Independence movements and conflicts mapped globally
- **Full UCDP History (1989-present)** — 35 years of every coded armed conflict event
- **"What Happened Last Time?"** — Pattern matching current conflicts against historical ones

### J. COMPARE VIEW

Side-by-side comparison of 2-3 conflicts:
- Event count timelines overlaid
- Fatality trends compared
- Displacement numbers compared (UNHCR)
- Media sentiment compared (GDELT)
- Humanitarian severity compared (ReliefWeb)
- Risk score comparison
- Lifecycle stage comparison

### K. CUSTOM WATCHLISTS & ALERTS

Users define:
- Countries to watch
- Actors to track
- Regions (custom bounding boxes on map)
- Shipping routes (Red Sea, Strait of Hormuz, Taiwan Strait)
- Threshold triggers (e.g., "alert me if Sudan events increase >20% week-over-week")

Delivery: In-app notifications, email digests (daily/weekly), push notifications (mobile)

### L. EXPORTABLE REPORTS

One-click PDF/DOCX reports for:
- Country Risk Assessment
- Conflict Situation Report
- Actor Dossier
- Regional Threat Analysis
- Custom watchlist summary

These are what intelligence analysts email to their bosses. Make them beautiful and branded.

---

## PART 4: TECHNICAL ARCHITECTURE

Same as previous blueprint (database schema, API routes, etc.) but with these additions:

### New Database Tables

```sql
-- NASA FIRMS thermal anomalies
CREATE TABLE IF NOT EXISTS thermal_anomalies (
  id              SERIAL PRIMARY KEY,
  latitude        DOUBLE PRECISION NOT NULL,
  longitude       DOUBLE PRECISION NOT NULL,
  geom            GEOMETRY(Point, 4326),
  brightness      DOUBLE PRECISION,
  frp             DOUBLE PRECISION,          -- Fire Radiative Power (MW)
  confidence      TEXT,                       -- 'low', 'nominal', 'high'
  satellite       TEXT,                       -- 'VIIRS', 'MODIS'
  acq_date        DATE NOT NULL,
  acq_time        TEXT,
  daynight         TEXT,                      -- 'D' or 'N'
  in_conflict_zone BOOLEAN DEFAULT FALSE,     -- cross-referenced with UCDP
  nearest_event_id TEXT REFERENCES events(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_thermal_geom ON thermal_anomalies USING GIST(geom);
CREATE INDEX idx_thermal_date ON thermal_anomalies(acq_date DESC);
CREATE INDEX idx_thermal_conflict ON thermal_anomalies(in_conflict_zone);

-- UNHCR displacement data
CREATE TABLE IF NOT EXISTS displacement (
  id              SERIAL PRIMARY KEY,
  year            INTEGER NOT NULL,
  country_origin  TEXT NOT NULL,
  country_asylum  TEXT NOT NULL,
  refugees        INTEGER DEFAULT 0,
  asylum_seekers  INTEGER DEFAULT 0,
  idps            INTEGER DEFAULT 0,
  stateless       INTEGER DEFAULT 0,
  returned        INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, country_origin, country_asylum)
);
CREATE INDEX idx_displacement_origin ON displacement(country_origin);
CREATE INDEX idx_displacement_asylum ON displacement(country_asylum);
CREATE INDEX idx_displacement_year ON displacement(year DESC);

-- GDELT intelligence (articles + tone analytics, NOT map events)
-- Articles table already defined in previous schema

-- Tone analytics (aggregated from GDELT, stored for fast access)
CREATE TABLE IF NOT EXISTS tone_analytics (
  id              SERIAL PRIMARY KEY,
  entity          TEXT NOT NULL,              -- country name, actor name, or conflict_id
  entity_type     TEXT NOT NULL,              -- 'country', 'actor', 'conflict'
  date            DATE NOT NULL,
  avg_tone        DOUBLE PRECISION,
  article_count   INTEGER DEFAULT 0,
  tone_std_dev    DOUBLE PRECISION,
  source_countries JSONB,                     -- { "US": -3.2, "RU": 1.4, "CN": -0.8 }
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity, entity_type, date)
);
CREATE INDEX idx_tone_entity ON tone_analytics(entity, entity_type);
CREATE INDEX idx_tone_date ON tone_analytics(date DESC);

-- Sanctions data (from OpenSanctions)
CREATE TABLE IF NOT EXISTS sanctions (
  id              TEXT PRIMARY KEY,           -- OpenSanctions entity ID
  name            TEXT NOT NULL,
  entity_type     TEXT,                       -- 'person', 'organization', 'vessel'
  aliases         TEXT[],
  nationality     TEXT,
  sanction_authorities TEXT[],                -- ['OFAC', 'EU', 'UN']
  sanction_types  TEXT[],                     -- ['asset_freeze', 'travel_ban']
  topics          TEXT[],                     -- ['terrorism', 'human_rights']
  first_seen      DATE,
  last_seen       DATE,
  properties      JSONB,
  actor_id        TEXT REFERENCES actors(id), -- link to our actors table
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sanctions_name ON sanctions USING GIN(to_tsvector('english', name));
CREATE INDEX idx_sanctions_actor ON sanctions(actor_id);

-- Risk scores (computed daily)
CREATE TABLE IF NOT EXISTS risk_scores (
  id              SERIAL PRIMARY KEY,
  country         TEXT NOT NULL,
  iso_a3          TEXT,
  date            DATE NOT NULL,
  overall_score   DOUBLE PRECISION NOT NULL,  -- 0-100
  conflict_intensity DOUBLE PRECISION,
  escalation_trajectory DOUBLE PRECISION,
  humanitarian_severity DOUBLE PRECISION,
  satellite_indicators DOUBLE PRECISION,
  media_anomaly   DOUBLE PRECISION,
  economic_stress DOUBLE PRECISION,
  sanctions_pressure DOUBLE PRECISION,
  historical_pattern DOUBLE PRECISION,
  risk_level      TEXT,                       -- 'critical', 'elevated', 'watch', 'stable'
  contributing_factors JSONB,                 -- top 3 factors driving the score
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(country, date)
);
CREATE INDEX idx_risk_country ON risk_scores(country);
CREATE INDEX idx_risk_date ON risk_scores(date DESC);
CREATE INDEX idx_risk_level ON risk_scores(risk_level);

-- Early warning alerts
CREATE TABLE IF NOT EXISTS alerts (
  id              SERIAL PRIMARY KEY,
  alert_type      TEXT NOT NULL,              -- 'tone_shift', 'volume_spike', 'firms_anomaly', 'event_acceleration', 'displacement_spike', 'convergence'
  severity        TEXT NOT NULL,              -- 'critical', 'elevated', 'watch'
  country         TEXT,
  conflict_id     TEXT REFERENCES conflicts(id),
  title           TEXT NOT NULL,
  description     TEXT,
  signal_data     JSONB,                      -- raw signal values that triggered the alert
  resolved        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);
CREATE INDEX idx_alerts_resolved ON alerts(resolved);

-- User watchlists
CREATE TABLE IF NOT EXISTS watchlists (
  id              SERIAL PRIMARY KEY,
  user_id         TEXT NOT NULL,              -- future: auth system
  entity_type     TEXT NOT NULL,              -- 'country', 'actor', 'conflict', 'region'
  entity_id       TEXT NOT NULL,              -- country name, actor ID, conflict ID, or bbox
  alert_threshold JSONB,                      -- custom thresholds per metric
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### New Backend Services

```
server/services/
├── normalization.js          # Shared type mapping (exists)
├── gdeltService.js           # GDELT intelligence (exists — NOT for map, for analysis)
├── ucdpService.js            # UCDP events (exists — THE map data source)
├── reliefwebService.js       # ReliefWeb humanitarian (exists)
├── wikidataService.js         # Wikidata/Wikipedia (exists)
├── geoLoader.js              # Natural Earth (exists)
├── classifierService.js      # Claude AI (exists)
├── firmsService.js           # NEW — NASA FIRMS thermal anomaly ingestion
├── unhcrService.js           # NEW — UNHCR refugee/displacement data
├── sanctionsService.js       # NEW — OpenSanctions entity data
├── worldBankService.js       # NEW — Economic indicators
├── toneAnalyticsService.js   # NEW — GDELT tone aggregation and anomaly detection
├── riskScoringService.js     # NEW — Composite risk score computation
├── earlyWarningService.js    # NEW — Multi-signal alert generation
└── briefingService.js        # NEW — Claude AI daily briefing generation

server/
├── cache.js                  # Redis client + cacheMiddleware + invalidation functions
├── lruCache.js               # In-memory LRU for bbox queries, geo boundaries, actor lookups
```

### New API Routes

```
# Thermal anomalies
GET /api/fires?bbox=&days=7&conflict_only=true
GET /api/fires/stats?country=Ukraine&timeframe=30d

# Displacement
GET /api/displacement/country/:name
GET /api/displacement/flows?origin=Syria&year=2025
GET /api/displacement/trends?country=Ukraine

# Sanctions
GET /api/sanctions/search?q=Putin
GET /api/sanctions/entity/:id
GET /api/sanctions/country/:name

# Risk scores
GET /api/risk/scores?sort=overall_score&limit=20
GET /api/risk/scores/:country
GET /api/risk/scores/:country/history?timeframe=1y

# Early warning
GET /api/alerts?severity=critical&resolved=false
GET /api/alerts/country/:name

# Briefing
GET /api/briefing/daily?watchlist=user123

# Tone analytics
GET /api/tone/:entity?type=country&timeframe=90d
GET /api/tone/:entity/sources  # breakdown by source country
```

### New Cron Jobs

```
server/cron/
├── gdeltPoller.js            # Every 15 minutes — articles + tone
├── ucdpPoller.js             # Daily — events
├── reliefwebPoller.js        # Every 6 hours — humanitarian reports
├── firmsPoller.js            # NEW — Every 3 hours — thermal anomalies
├── unhcrPoller.js            # NEW — Weekly — displacement data
├── sanctionsPoller.js        # NEW — Daily — sanctions updates
├── worldBankPoller.js        # NEW — Monthly — economic indicators
├── toneAggregator.js         # NEW — Daily — aggregate GDELT tone per entity
├── riskScorer.js             # NEW — Daily — compute risk scores for all countries
├── earlyWarningRunner.js     # NEW — Every 15 min — check all signal thresholds
├── briefingGenerator.js      # NEW — Daily 6AM — generate morning briefings
└── classifierRunner.js       # After each UCDP/GDELT ingest
```

### Caching Layer — Redis + Materialized Views + LRU

**Why:** Without caching, every globe load, sidebar refresh, and page navigation hits PostgreSQL directly. At 100 concurrent users × 10 page loads each = 1000 DB queries/minute. With caching, that drops to ~10 DB queries/minute (99% cache hit rate).

**Dependencies:**
```bash
npm install ioredis
# Redis server must be running locally or via Docker:
docker run -d --name redis -p 6379:6379 redis:alpine
```

**Add to `.env`:**
```env
REDIS_URL=redis://localhost:6379
```

**Three levels of cache:**

#### Level 1: Redis (server-side, shared across all requests)

**File: `server/cache.js`**
```javascript
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redis.on('error', (err) => console.warn('Redis error (falling back to DB):', err.message));

// Cache middleware for Express routes
function cacheMiddleware(keyFn, ttlSeconds) {
  return async (req, res, next) => {
    const key = typeof keyFn === 'function' ? keyFn(req) : keyFn;
    try {
      const cached = await redis.get(key);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    } catch (err) {
      // Redis down — fall through to DB
    }
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      redis.setex(key, ttlSeconds, JSON.stringify(data)).catch(() => {});
      return originalJson(data);
    };
    next();
  };
}

// Flush keys by pattern after data ingest
async function flushPattern(pattern) {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  } catch (err) {
    console.warn('Redis flush error:', err.message);
  }
}

// Called after each ingest — flush relevant caches + refresh materialized views
async function onUcdpIngest(db) {
  await flushPattern('events:*');
  await flushPattern('arcs:*');
  await flushPattern('conflicts:*');
  await flushPattern('choropleth:*');
  await flushPattern('risk:*');
  await flushPattern('stats:*');
  await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_country_stats');
  await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_choropleth');
  await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_event_breakdown');
  await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_countries');
}

async function onFirmsIngest() {
  await flushPattern('fires:*');
}

async function onGdeltIngest() {
  await flushPattern('breaking:*');
  await flushPattern('tone:*');
  await flushPattern('articles:*');
}

async function onReliefwebIngest() {
  await flushPattern('humanitarian:*');
  await flushPattern('context:*');
}

async function onUnhcrIngest() {
  await flushPattern('displacement:*');
}

module.exports = { redis, cacheMiddleware, flushPattern, 
  onUcdpIngest, onFirmsIngest, onGdeltIngest, onReliefwebIngest, onUnhcrIngest };
```

**TTL strategy per endpoint:**

| Endpoint | Redis Key Pattern | TTL | Reason |
|----------|------------------|-----|--------|
| `GET /api/events` | `events:{country}:{type}:{hash}` | 5 min | Events change with UCDP daily ingest |
| `GET /api/events/stats` | `stats:{country}:{timeframe}` | 5 min | Aggregations are expensive |
| `GET /api/events/arcs` | `arcs:{conflict}:{timeframe}` | 10 min | Arcs rarely change mid-day |
| `GET /api/fires` | `fires:{bbox}:{days}` | 15 min | Matches FIRMS poll frequency |
| `GET /api/context/breaking` | `breaking:latest` | 5 min | Fresh news matters |
| `GET /api/conflicts` | `conflicts:{status}:{sort}` | 10 min | Changes after classifier runs |
| `GET /api/tone/:entity` | `tone:{entity}:{timeframe}` | 30 min | Tone aggregates update daily |
| `GET /api/risk/scores` | `risk:scores:{sort}` | 1 hour | Scores computed daily |
| `GET /api/geo/choropleth` | `choropleth:{metric}:{timeframe}` | 1 hour | Heavy spatial join, slow-changing |
| `GET /api/displacement/flows` | `displacement:{origin}:{year}` | 6 hours | UNHCR updates weekly |
| `GET /api/briefing/daily` | `briefing:today` | 24 hours | Generated once daily |
| `GET /api/geo/boundaries` | `boundaries:{level}` | 24 hours | Static data, rarely changes |

**Usage in routes:**
```javascript
const { cacheMiddleware } = require('../cache');

// Example: cache event stats for 5 minutes, key varies by query
router.get('/events/stats',
  cacheMiddleware(
    req => `stats:${req.query.country || 'global'}:${req.query.timeframe || '30d'}`,
    300
  ),
  async (req, res) => {
    // Only hits DB on cache miss
    const result = await db.query('SELECT * FROM mv_country_stats ...');
    res.json(result.rows);
  }
);

// Example: choropleth cached 1 hour, reads from materialized view
router.get('/geo/choropleth',
  cacheMiddleware(
    req => `choropleth:${req.query.metric || 'events'}:${req.query.timeframe || '30d'}`,
    3600
  ),
  async (req, res) => {
    const result = await db.query('SELECT * FROM mv_choropleth');
    res.json(result.rows);
  }
);
```

**Cache invalidation — called at end of each ingest service:**
```javascript
// In gdeltService.js, at end of ingestLatestArticles():
const { onGdeltIngest } = require('../cache');
await onGdeltIngest();

// In ucdpService.js, at end of ingest:
const { onUcdpIngest } = require('../cache');
await onUcdpIngest(db);

// In firmsService.js:
const { onFirmsIngest } = require('../cache');
await onFirmsIngest();

// Same pattern for reliefwebService, unhcrService
```

#### Level 2: PostgreSQL Materialized Views (for expensive aggregations)

Add these to a new migration file `db/009_materialized_views.sql`:

```sql
-- Country stats — used by sidebar, country pages, risk scoring
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_country_stats AS
SELECT
  country,
  COUNT(*) as total_events,
  SUM(fatalities) as total_fatalities,
  COUNT(*) FILTER (WHERE date >= NOW() - INTERVAL '7 days') as events_7d,
  COUNT(*) FILTER (WHERE date >= NOW() - INTERVAL '30 days') as events_30d,
  SUM(fatalities) FILTER (WHERE date >= NOW() - INTERVAL '30 days') as fatalities_30d,
  COUNT(*) FILTER (WHERE date >= NOW() - INTERVAL '90 days') as events_90d,
  MAX(date) as last_event_date
FROM events
WHERE source = 'UCDP'
GROUP BY country;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_country_stats ON mv_country_stats(country);

-- Choropleth — prejoined with geo_boundaries for instant map rendering
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_choropleth AS
SELECT
  g.iso_a3, g.name, g.geom, g.centroid_lat, g.centroid_lng,
  COALESCE(cs.events_30d, 0) as event_count,
  COALESCE(cs.fatalities_30d, 0) as fatalities,
  COALESCE(cs.total_events, 0) as total_events
FROM geo_boundaries g
LEFT JOIN mv_country_stats cs ON LOWER(g.name) = LOWER(cs.country)
WHERE g.admin_level = 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_choropleth ON mv_choropleth(iso_a3);

-- Event type breakdown — sidebar donut chart
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_event_breakdown AS
SELECT
  type,
  COUNT(*) as count,
  SUM(fatalities) as fatalities
FROM events
WHERE source = 'UCDP' AND date >= NOW() - INTERVAL '30 days'
GROUP BY type;

-- Top countries — sidebar bar chart
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_countries AS
SELECT
  country,
  COUNT(*) as events,
  SUM(fatalities) as fatalities,
  MAX(date) as last_event
FROM events
WHERE source = 'UCDP' AND date >= NOW() - INTERVAL '30 days'
GROUP BY country
ORDER BY events DESC
LIMIT 20;

-- FIRMS conflict zone summary — sidebar satellite section
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_firms_conflict_summary AS
SELECT
  e.country,
  COUNT(ta.id) as fire_count,
  AVG(ta.frp) as avg_frp,
  MAX(ta.acq_date) as latest_fire
FROM thermal_anomalies ta
JOIN events e ON ta.nearest_event_id = e.id
WHERE ta.in_conflict_zone = TRUE
  AND ta.acq_date >= NOW() - INTERVAL '7 days'
GROUP BY e.country
ORDER BY fire_count DESC;

-- Refresh all materialized views (call after each UCDP ingest)
-- Use CONCURRENTLY so reads aren't blocked during refresh
-- NOTE: CONCURRENTLY requires a UNIQUE INDEX on the materialized view
```

**When to refresh:**
```
After UCDP ingest    → REFRESH mv_country_stats, mv_choropleth, mv_event_breakdown, mv_top_countries
After FIRMS ingest    → REFRESH mv_firms_conflict_summary
Daily (5 AM)          → REFRESH ALL materialized views
```

#### Level 3: In-Memory LRU Cache (per-process, for ultra-hot paths)

```javascript
// server/lruCache.js
const LRU = require('lru-cache');

// Geo boundaries never change — cache forever until server restarts
const geoBoundariesCache = new LRU({ max: 1, ttl: 1000 * 60 * 60 * 24 }); // 24 hours

// Actor lookups — frequently repeated
const actorCache = new LRU({ max: 500, ttl: 1000 * 60 * 30 }); // 30 min

// Bounding box event queries — users pan/zoom the map rapidly
const bboxCache = new LRU({ max: 200, ttl: 1000 * 60 * 2 }); // 2 min

module.exports = { geoBoundariesCache, actorCache, bboxCache };
```

**Add `lru-cache` to dependencies:**
```bash
npm install lru-cache
```

#### Performance Impact Summary

| Scenario | Without Cache | With Cache |
|----------|--------------|------------|
| Globe load (events query) | ~200ms, hits DB | <1ms from Redis (after first load) |
| Sidebar stats | 4 aggregate queries, ~150ms each | Single materialized view, ~5ms |
| Choropleth render | Join 250 polygons × 400k events, ~2s | Pre-joined materialized view, ~10ms |
| Breaking news | Full articles table scan | Redis, <1ms |
| 100 concurrent users | ~1000 DB queries/min | ~10 DB queries/min |
| Map pan/zoom (bbox) | New spatial query each time | LRU cache, <1ms for repeated areas |

#### File Structure Addition

```
server/
├── cache.js              # Redis client + middleware + invalidation functions
├── lruCache.js           # In-memory LRU for ultra-hot paths
```

---

## PART 5: IMPLEMENTATION PHASES

### Phase 1: Core Platform (Weeks 1-4)
**Goal:** Real-time conflict monitor with verified UCDP events + FIRMS satellite layer

- Database setup (all tables + materialized views)
- Redis cache setup + cache middleware
- UCDP ingestion + API routes + map dots + strike arcs (UCDP ONLY)
- NASA FIRMS ingestion + thermal anomaly map layer
- GDELT ingestion (articles + tone ONLY, NOT map events)
- Sidebar: threat levels, top conflicts, event breakdown, breaking news from GDELT
- Fix all hardcoded data
- All API routes use cacheMiddleware with appropriate TTLs
- Materialized views refresh after each ingest

### Phase 2: Intelligence Layer (Weeks 5-8)
**Goal:** Country pages, humanitarian context, displacement data, tone analytics

- ReliefWeb ingestion + humanitarian panels
- UNHCR ingestion + refugee flow arcs on map + displacement panels
- Country Intelligence Page (full rewrite with all data sources)
- Choropleth layer (Natural Earth + UCDP aggregation)
- WorldPop civilian exposure calculations
- GDELT tone analytics + media sentiment charts
- Conflict Intelligence Page

### Phase 3: Prediction & Risk (Weeks 9-12)
**Goal:** Early warning system, risk scoring, AI briefings

- Risk scoring engine (all 8 components)
- Early warning system (multi-signal convergence detection)
- Claude AI conflict classifier + lifecycle staging
- AI Morning Briefing generator
- Alert system (in-app notifications)
- World Bank economic indicator integration

### Phase 4: People & History (Weeks 13-16)
**Goal:** Actor intelligence, relationship graphs, historical explorer

- Wikidata/Wikipedia actor ingestion
- OpenSanctions integration + sanctions overlay
- Actor Intelligence Page (bio, timeline, relationships, sentiment)
- Historical Explorer (WW2, Cold War, full UCDP 1989-present)
- Compare View
- Exportable PDF/DOCX reports

### Phase 5: Scale & Premium (Weeks 17-20)
**Goal:** Custom watchlists, alerts, API access, monetization

- Custom watchlists + alert thresholds
- Email/push notification delivery
- OpenSky/AIS maritime+aviation layers (premium)
- Public API for developers
- Embeddable widgets for newsrooms
- Mobile app (React Native)

---

## PART 6: CRITICAL RULES

1. **UCDP is the ONLY event data source plotted as individual dots/arcs on the map.** GDELT goes nowhere near the map as event markers.
2. **NASA FIRMS is the SECOND map layer** — independent satellite verification. Thermal anomalies are plotted with different styling (orange pulsing dots vs red UCDP dots).
3. **GDELT is the intelligence/analysis engine** — breaking news, tone trends, volume anomalies, narrative tracking. It feeds sidebar panels, charts, and AI analysis. Never map markers.
4. **ReliefWeb + UNHCR are the human cost layer** — numbers that make decision-makers care.
5. **OpenSanctions connects conflict actors to financial/legal accountability.**
6. **World Bank provides the economic stress context** — conditions that breed instability.
7. **WorldPop turns map dots into "X million people affected"** — the number that drives funding.
8. **Claude AI ties it all together** — conflict classification, lifecycle staging, morning briefings, pattern matching.
9. **Every data source has been verified for commercial use.** OpenSanctions requires a commercial license (~€2000/yr) — budget for it.
10. **Zustand: ALL filter fields must be explicitly initialized** or applyFilters silently breaks.
11. **Every API route must use `cacheMiddleware`** with appropriate TTL. No endpoint should hit PostgreSQL directly on every request.
12. **Every ingest service must call its cache invalidation function** (`onUcdpIngest`, `onFirmsIngest`, `onGdeltIngest`, etc.) at the end of each ingest cycle to flush stale data.
13. **Use materialized views for aggregations** — sidebar stats, choropleth, top countries, event breakdown. NEVER run live `GROUP BY` queries against the full events table on API requests. Query `mv_country_stats`, `mv_choropleth`, etc. instead.
14. **Redis is graceful-fail** — if Redis is down, the app must still work by falling through to the database. Never crash on Redis errors.
15. **Materialized views refresh CONCURRENTLY** — use `REFRESH MATERIALIZED VIEW CONCURRENTLY` so read queries aren't blocked during refresh. This requires a `UNIQUE INDEX` on each materialized view.