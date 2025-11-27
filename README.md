# SkyTracker PRO ✈️  
Real-Time Flight Tracking with AWS, Data Engineering & Interactive Visualizations

SkyTracker PRO is a full-stack **Next.js** application that lets users track any commercial flight in real time using its flight number. 

The app brings together:

- **AWS cloud hosting** (Amplify, CloudFront)  
- **Data engineering & API orchestration** across multiple aviation and weather providers  
- **Basic ETA / delay prediction logic** (rule-based, ML-ready design)  
- **Interactive front-end visualizations** using maps, timelines, and progress indicators  

It’s designed to feel like a simplified, human-friendly version of FlightRadar24 that family and friends can use to quickly answer:  
> “Where is this flight right now, and when should I leave home to pick someone up?”

---

## ✨ Features

**Real-time Flight Tracking**

- Search by flight number (IATA code) and fetch:
  - Live status (scheduled, boarding, in-flight, landed, delayed, etc.)
  - Airline, aircraft type, route, flight distance
  - Departure/arrival airports, terminals, gates

**Smart Time & ETA Experience**

- Displays **local times at each airport** plus **your local time**
- “Arrives at 08:46 AM (DOH local • 12:46 AM your time)”
- **“When should I leave home?” helper**  
  - Suggests a leave time based on departure time and configurable buffer (e.g. arrive 90 minutes early)
- Simple **early/on-time/late** indicator based on scheduled vs actual timing

**Map & Visualization Layer**

- World map with:
  - Animated aircraft icon moving along the route  
  - **Green segment** for distance already flown  
  - **Red segment** for remaining distance to destination  
  - Highlighted origin & destination markers with airport labels
- Smooth camera / route animations when loading a new flight
- Clean, modern UI card layout for flight details, weather, and telemetry

**Data Engineering / API Integration**

- Aggregates data from multiple external APIs:
  - **AviationStack** – flight metadata & schedule
  - **AeroDataBox (RapidAPI)** – route & aircraft information
  - **OpenWeather** – weather at departure & arrival airports
- Server-side Next.js API routes handle:
  - Validation & normalization of responses
  - Joining different payloads into a single **FlightDetails** object
  - Error handling for missing flights / rate limits / missing coordinates

**User-Experience Enhancements**

- Recent flights chips (e.g. `EK201 • CX829 • JL59`) for quick re-tracking
- Boarding status labels:
  - *Not boarding yet*, *Boarding soon*, *Boarding now*, *Final call*, *Departed*
- “Share Flight” button that generates a share-friendly summary string

---

## 🧱 Architecture

**Frontend**

- **Next.js App Router** (`app/` directory)
- TypeScript + modern React components
- Responsive layout with a left details panel and right map panel
- Reusable UI components for:
  - Status badges
  - Progress / distance cards
  - Timezone clarity strip
  - Weather summary widgets

**Backend / Data Layer**

- Next.js **API routes** (server components) act as a thin back-end:
  - `/api/search-flight` – resolve flight number to flight record
  - `/api/flight-details` – merge metadata + weather + timing
  - `/api/flight-location` – fetch latest coordinates (if available)
- Basic **rule-based arrival estimate**:
  - Uses scheduled vs current times and progress to estimate “Arriving at …”
  - Designed so it can later be swapped out with an ML model (ETA regression)

**Cloud & Deployment (AWS)**

- Hosted on **AWS Amplify Hosting**
  - Connects directly to the GitHub repo
  - Builds the Next.js app and deploys via a global CDN (CloudFront under the hood)
- Environment variables are managed securely in Amplify:
  - API keys for AviationStack, AeroDataBox, OpenWeather, MapBox/Leaflet tiles, etc.
- CI/CD: every commit to `main` triggers a new build & deployment

---

## 🧠 ML-Ready Design (Future Work)

While the current ETA / delay calculation is **rule-based**, the architecture is structured so you can plug in a model later:

- You could log historical flight segments (distance, speed, delays) to a data store (e.g. S3 + Athena or a SQL DB).
- Train a **regression model** to predict arrival delay given:
  - Departure delay, route length, live position, ground speed, winds, etc.
- Expose that model via a separate microservice (FastAPI / Lambda) and call it from the Next.js API route.

For now, the app behaves like a **lightweight analytics layer** on top of the live APIs.

---

## 🛠 Tech Stack

- **Frontend**
  - Next.js (App Router) + React + TypeScript
  - Leaflet / map tiles (Carto / Stadia Maps)
  - Modern responsive UI with custom components

- **Backend / Data**
  - Next.js API routes
  - REST integrations:
    - AviationStack
    - AeroDataBox (RapidAPI)
    - OpenWeather

- **Cloud / DevOps**
  - AWS Amplify Hosting (build & deploy)
  - GitHub repository for version control
  - Environment variables & secrets managed in Amplify

---

## 🚀 Getting Started (Local Development)

1. **Clone the repository**

   ```bash
   git clone https://github.com/<your-username>/Flight-Tracker.git
   cd Flight-Tracker
