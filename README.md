# SAHARA — Disaster Management & Emergency Route Optimization System

**Team ID:** HMT 5911  
**Problem Statement ID:** SIH26206  
**Theme:** Disaster Management  
**Target Area:** NIT Kurukshetra Campus, Haryana, India

---

## 🎯 Overview

SAHARA is a web-based disaster management dashboard designed for emergency responders operating within the NIT Kurukshetra campus. It provides:

- **Interactive campus map** (OpenStreetMap + Leaflet)
- **Disaster simulation** (Flood, Fire, Earthquake, Road Blockage)
- **Dynamic road closures** with real-time route recalculation
- **Dijkstra's shortest-path algorithm** for emergency route optimization
- **Relief camp management** with capacity tracking
- **Rescue vehicle dispatch** with status management

> ⚠️ **Disclaimer:** All incident data, relief camps, vehicles, and routes are **simulated** for demonstration purposes. This is not a live emergency system.

---

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

```bash
# Clone or navigate to the project directory
cd iotproject

# Install dependencies
npm install

# Start the development server
npm run dev
```

The application will open at `http://localhost:5173`.

---

## 🗺️ Features

### 1. Interactive NIT Kurukshetra Campus Map

- OpenStreetMap tiles centered on NIT Kurukshetra
- Map bounds restricted to the campus area
- Graph nodes at key intersections, buildings, hostels, and gates
- Visual road network with real-time blockage indicators

### 2. Disaster Simulation

Click any disaster button to simulate:

| Disaster     | Emoji | Affected Area       |
|-------------|-------|---------------------|
| Flood       | 🌊    | Hostel Area         |
| Fire        | 🔥    | Academic Zone       |
| Earthquake  | 🏚️   | Admin Block Area    |
| Road Blockage | 🚧  | Central Junction    |

Each scenario automatically blocks associated roads and shows the incident on the map.

### 3. Dynamic Road Management

- View all campus roads with current status (Open / Blocked)
- Toggle any road between open and blocked
- Blocked roads appear in **red dashed lines** on the map
- Roads blocked by disaster scenarios are automatically managed

### 4. Route Optimization (Dijkstra's Algorithm)

- **Algorithm:** Dijkstra's shortest path with MinHeap priority queue
- **Graph:** Campus intersections as nodes, roads as weighted edges
- **Features:**
  - Automatically avoids blocked roads
  - Finds nearest available relief camp
  - Reroutes if selected camp is full
  - Shows distance (meters) and estimated travel time
  - Displays route on map in **green**
  - Warning when no route is available

### 5. Relief Camp Management

- 4 simulated relief camps across campus
- Real-time capacity tracking with visual bars
- Full camps automatically excluded from routing
- Click a camp to calculate a route to it

### 6. Rescue Vehicle Management

- 5 simulated vehicles (ambulances, fire trucks, rescue vans)
- Status tracking: Available → En Route → Busy → Available
- Dispatch vehicles to incidents after route calculation
- Automatic status cycling for demonstration

---

## 🏗️ Technology Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Framework  | React 18 + Vite 5                 |
| Map        | Leaflet + React-Leaflet           |
| Tiles      | OpenStreetMap (free, no API key)   |
| Algorithm  | Dijkstra's (JavaScript, modular)  |
| Styling    | Custom CSS (dark navy theme)      |

No paid map API keys (Mapbox, Google Maps) are required.

---

## 📁 Project Structure

```
iotproject/
├── index.html                   # HTML entry point
├── package.json                 # Dependencies
├── vite.config.js               # Vite configuration
├── public/
│   └── favicon.svg              # App icon
├── src/
│   ├── main.jsx                 # React entry
│   ├── App.jsx                  # Main app with state management
│   ├── index.css                # Global design system
│   ├── algorithms/
│   │   └── dijkstra.js          # Dijkstra's algorithm + helpers
│   ├── components/
│   │   ├── Header.jsx           # App header
│   │   ├── ControlPanel.jsx     # Sidebar with all controls
│   │   ├── CampusMap.jsx        # Interactive Leaflet map
│   │   └── ToastContainer.jsx   # Notification toasts
│   └── data/
│       └── campusData.js        # Campus graph, camps, vehicles
└── README.md
```

---

## 🧮 Algorithm Details

### Dijkstra's Shortest Path

- **Data Structure:** MinHeap-based priority queue (O(E log V))
- **Graph:** Adjacency list with weighted edges
- **Edge Properties:** distance (meters), road name, blockage status
- **Path Reconstruction:** Backtracking from destination to source
- **Dynamic Updates:** Graph rebuilds when edges are blocked/unblocked
- **Nearest Camp Search:** Runs Dijkstra to all available camps, picks minimum distance

```
Time Complexity: O((V + E) log V)
Space Complexity: O(V + E)
```

---

## 📋 Demo Walkthrough

1. **Open the application** — See the NIT Kurukshetra campus map
2. **Click "Flood"** — Observe hostel area roads become blocked (red)
3. **Click "Calculate Optimal Route"** — Green route appears on map
4. **Click "Block" on another road** — Route recalculates automatically
5. **Select a different relief camp** — New route computed
6. **Click "Dispatch" on a vehicle** — Vehicle status changes
7. **Try blocking all roads** — "No Route Available" warning appears
8. **Click "Reset System"** — Everything returns to initial state

---

## 📄 License

This project was developed for Smart India Hackathon 2026 (SIH26206).

**Team HMT 5911** — NIT Kurukshetra
