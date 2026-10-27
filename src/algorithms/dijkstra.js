/**
 * dijkstra.js
 * Graph algorithms for SAHARA emergency routing system.
 * v2 — Uses real OSM road geometry. Geometry-following routes, road snapping.
 * v3 — B0–B3 road impact levels, three routing modes.
 */

// ── Road Impact Level constants ──
export const ROAD_LEVELS = {
  B0: { label: 'B0 — Clear', color: '#22c55e', allowed: ['shortest', 'shortestSafest', 'safest'], description: 'Clear, safe road' },
  B1: { label: 'B1 — Slight Waterlogging', color: '#eab308', allowed: ['shortest', 'shortestSafest'], description: 'Slight waterlogging, passable' },
  B2: { label: 'B2 — Heavy Waterlogging', color: '#f97316', allowed: ['shortest'], description: 'Heavy waterlogging, passable by large vehicles' },
  B3: { label: 'B3 — Impassable', color: '#ef4444', allowed: [], description: 'Impassable: deep water, fallen trees, landslide, or blockage' },
};

// Helper: returns true if edge with given level is allowed under routeMode
export function isLevelAllowed(level, routeMode) {
  const lvl = ROAD_LEVELS[level];
  if (!lvl) return true; // unclassified = B0 by default
  return lvl.allowed.includes(routeMode);
}

class MinPriorityQueue {
  constructor() { this.heap = []; }
  push(item) { this.heap.push(item); this._up(this.heap.length - 1); }
  pop() {
    if (!this.heap.length) return null;
    const min = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length) { this.heap[0] = last; this._down(0); }
    return min;
  }
  isEmpty() { return !this.heap.length; }
  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.heap[p].cost <= this.heap[i].cost) break;
      [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]]; i = p;
    }
  }
  _down(i) {
    const n = this.heap.length;
    while (true) {
      let s = i, l = 2*i+1, r = 2*i+2;
      if (l < n && this.heap[l].cost < this.heap[s].cost) s = l;
      if (r < n && this.heap[r].cost < this.heap[s].cost) s = r;
      if (s === i) break;
      [this.heap[s], this.heap[i]] = [this.heap[i], this.heap[s]]; i = s;
    }
  }
}

export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/**
 * Build adjacency list with B-level road classification filter.
 * roadLevels: Map of "from->to" | "to->from" => 'B0'|'B1'|'B2'|'B3'
 * routeMode: 'shortest' | 'shortestSafest' | 'safest'
 */
export function buildAdjacencyListWithLevels(edges, blockedEdges = new Set(), roadLevels = {}, routeMode = 'shortest', nodesMap = null) {
  const adj = {};
  for (const edge of edges) {
    const fwd = `${edge.from}->${edge.to}`;
    const rev = `${edge.to}->${edge.from}`;
    // Determine the effective level (use whichever direction key is stored)
    const level = roadLevels[fwd] || roadLevels[rev] || 'B0';
    // B3 is always impassable; check mode restrictions
    if (!isLevelAllowed(level, routeMode)) continue;
    // Skip blocked edges
    const tt = edge.travelTime || Math.ceil(edge.distance / 8.3);
    const base = { distance: edge.distance, road: edge.road, travelTime: tt, vehicleRestriction: edge.vehicleRestriction || null, geometry: edge.geometry || null, level };
    if (!blockedEdges.has(fwd)) {
      if (!adj[edge.from]) adj[edge.from] = [];
      adj[edge.from].push({ to: edge.to, ...base });
    }
    if (edge.twoWay && !blockedEdges.has(rev)) {
      if (!adj[edge.to]) adj[edge.to] = [];
      adj[edge.to].push({ to: edge.from, ...base, geometry: base.geometry ? [...base.geometry].reverse() : null });
    }
  }
  return adj;
}

export function buildAdjacencyList(edges, blockedEdges = new Set(), disasterZone = null, nodesMap = null) {
  const adj = {};
  for (const edge of edges) {
    const fwd = `${edge.from}->${edge.to}`;
    const rev = `${edge.to}->${edge.from}`;
    let inDanger = false;
    if (disasterZone && nodesMap) {
      const fn = nodesMap[edge.from], tn = nodesMap[edge.to];
      if (fn && tn) {
        if (haversineDistance(fn.lat, fn.lng, disasterZone.lat, disasterZone.lng) < disasterZone.radius ||
            haversineDistance(tn.lat, tn.lng, disasterZone.lat, disasterZone.lng) < disasterZone.radius)
          inDanger = true;
      }
    }
    const tt = edge.travelTime || Math.ceil(edge.distance / 8.3);
    const base = { distance: edge.distance, road: edge.road, travelTime: tt, vehicleRestriction: edge.vehicleRestriction || null, geometry: edge.geometry || null };
    if (!blockedEdges.has(fwd) && !inDanger) {
      if (!adj[edge.from]) adj[edge.from] = [];
      adj[edge.from].push({ to: edge.to, ...base });
    }
    if (edge.twoWay && !blockedEdges.has(rev) && !inDanger) {
      if (!adj[edge.to]) adj[edge.to] = [];
      adj[edge.to].push({ to: edge.from, ...base, geometry: base.geometry ? [...base.geometry].reverse() : null });
    }
  }
  return adj;
}

function _reconstruct(prev, prevRoad, prevDist, prevTime, prevGeom, start, end, totalDist, totalTime) {
  const path = [], roads = [], edgeDetails = [], geometrySegments = [];
  let cur = end;
  while (cur !== start) {
    path.unshift(cur);
    if (prevRoad[cur]) {
      roads.unshift(prevRoad[cur]);
      edgeDetails.unshift({ road: prevRoad[cur], distance: prevDist[cur]||0, travelTime: prevTime[cur]||0 });
      if (prevGeom[cur]) geometrySegments.unshift(prevGeom[cur]);
    }
    cur = prev[cur];
    if (cur === undefined) return null;
  }
  path.unshift(start);
  return { path, distance: Math.round(totalDist), travelTime: totalTime||Math.ceil(totalDist/8.3), roads: [...new Set(roads)], edgeDetails, geometrySegments };
}

export function dijkstra(adjacencyList, startNode, endNode, options = {}) {
  const { useTime = false, vehicleType = null } = options;
  if (startNode === endNode) return { path: [startNode], distance: 0, travelTime: 0, roads: [], geometrySegments: [] };
  const dist = {}, time = {}, prev = {}, prevRoad = {}, prevDist = {}, prevTime = {}, prevGeom = {};
  const visited = new Set();
  const pq = new MinPriorityQueue();
  dist[startNode] = 0; time[startNode] = 0;
  pq.push({ node: startNode, cost: 0 });
  while (!pq.isEmpty()) {
    const { node, cost } = pq.pop();
    if (visited.has(node)) continue;
    visited.add(node);
    if (node === endNode) return _reconstruct(prev, prevRoad, prevDist, prevTime, prevGeom, startNode, endNode, dist[endNode], time[endNode]);
    for (const { to, distance, road, travelTime, vehicleRestriction, geometry } of (adjacencyList[node]||[])) {
      if (visited.has(to)) continue;
      if (vehicleType && vehicleRestriction && vehicleRestriction !== vehicleType) continue;
      const ec = useTime ? travelTime : distance;
      const nc = cost + ec;
      const cm = useTime ? time : dist;
      if (cm[to] === undefined || nc < cm[to]) {
        dist[to] = (dist[node]||0) + distance; time[to] = (time[node]||0) + travelTime;
        cm[to] = nc; prev[to] = node; prevRoad[to] = road; prevDist[to] = distance; prevTime[to] = travelTime; prevGeom[to] = geometry;
        pq.push({ node: to, cost: nc });
      }
    }
  }
  return null;
}

export function aStarSearch(adjacencyList, startNode, endNode, nodesMap, options = {}) {
  const { vehicleType = null } = options;
  if (startNode === endNode) return { path: [startNode], distance: 0, travelTime: 0, roads: [], geometrySegments: [] };
  const endCoords = nodesMap[endNode];
  if (!endCoords) return null;
  const gScore = {}, tScore = {}, prev = {}, prevRoad = {}, prevDist = {}, prevTime = {}, prevGeom = {};
  const visited = new Set();
  const pq = new MinPriorityQueue();
  gScore[startNode] = 0; tScore[startNode] = 0;
  const h0 = haversineDistance((nodesMap[startNode]||{}).lat||0, (nodesMap[startNode]||{}).lng||0, endCoords.lat, endCoords.lng);
  pq.push({ node: startNode, cost: h0 });
  while (!pq.isEmpty()) {
    const { node } = pq.pop();
    if (visited.has(node)) continue;
    visited.add(node);
    if (node === endNode) return _reconstruct(prev, prevRoad, prevDist, prevTime, prevGeom, startNode, endNode, gScore[endNode], tScore[endNode]);
    for (const { to, distance, road, travelTime, vehicleRestriction, geometry } of (adjacencyList[node]||[])) {
      if (visited.has(to)) continue;
      if (vehicleType && vehicleRestriction && vehicleRestriction !== vehicleType) continue;
      const tg = gScore[node] + distance;
      if (gScore[to] === undefined || tg < gScore[to]) {
        gScore[to] = tg; tScore[to] = (tScore[node]||0) + travelTime;
        prev[to] = node; prevRoad[to] = road; prevDist[to] = distance; prevTime[to] = travelTime; prevGeom[to] = geometry;
        const nc = nodesMap[to];
        const h = nc ? haversineDistance(nc.lat, nc.lng, endCoords.lat, endCoords.lng) : 0;
        pq.push({ node: to, cost: tg + h });
      }
    }
  }
  return null;
}

function projectOnSegment(pLat, pLng, aLat, aLng, bLat, bLng) {
  const dx = bLng - aLng, dy = bLat - aLat;
  const lenSq = dx*dx + dy*dy;
  if (lenSq === 0) return { lat: aLat, lng: aLng, t: 0 };
  let t = ((pLng - aLng)*dx + (pLat - aLat)*dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { lat: aLat + t*dy, lng: aLng + t*dx, t };
}

export function findNearestRoadSegment(lat, lng, edges, nodesMap) {
  let best = null, bestDist = Infinity;
  for (const edge of edges) {
    const fn = nodesMap[edge.from], tn = nodesMap[edge.to];
    if (!fn || !tn) continue;
    const pts = (edge.geometry && edge.geometry.length >= 2) ? edge.geometry : [[fn.lat, fn.lng], [tn.lat, tn.lng]];
    for (let i = 0; i < pts.length - 1; i++) {
      const proj = projectOnSegment(lat, lng, pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1]);
      const d = haversineDistance(lat, lng, proj.lat, proj.lng);
      if (d < bestDist) { bestDist = d; best = { nodeFrom: edge.from, nodeTo: edge.to, snapLat: proj.lat, snapLng: proj.lng, distToSnap: d, edge, segmentIndex: i, t: proj.t }; }
    }
  }
  return best;
}

export function findNearestNode(lat, lng, nodesMap) {
  let nearestId = null, minDist = Infinity;
  for (const [id, node] of Object.entries(nodesMap)) {
    const d = haversineDistance(lat, lng, node.lat, node.lng);
    if (d < minDist) { minDist = d; nearestId = id; }
  }
  return nearestId;
}

export function snapToRoadNetwork(lat, lng, edges, nodesMap) {
  const snap = findNearestRoadSegment(lat, lng, edges, nodesMap);
  if (!snap) return findNearestNode(lat, lng, nodesMap);
  const fn = nodesMap[snap.nodeFrom], tn = nodesMap[snap.nodeTo];
  const dFrom = fn ? haversineDistance(lat, lng, fn.lat, fn.lng) : Infinity;
  const dTo   = tn ? haversineDistance(lat, lng, tn.lat, tn.lng) : Infinity;
  return dFrom <= dTo ? snap.nodeFrom : snap.nodeTo;
}

export function pathToGeometryCoordinates(routeResult, nodesMap) {
  if (!routeResult || !routeResult.path) return [];
  if (routeResult.geometrySegments && routeResult.geometrySegments.length > 0) {
    const coords = [];
    for (let i = 0; i < routeResult.geometrySegments.length; i++) {
      const seg = routeResult.geometrySegments[i];
      if (!seg) continue;
      const start = (i === 0) ? 0 : 1;
      for (let j = start; j < seg.length; j++) coords.push([seg[j][0], seg[j][1]]);
    }
    if (coords.length > 0) return coords;
  }
  return pathToCoordinates(routeResult.path, nodesMap);
}

export function pathToCoordinates(pathNodeIds, nodesMap) {
  return pathNodeIds.filter(id => nodesMap[id]).map(id => [nodesMap[id].lat, nodesMap[id].lng]);
}

export function estimateTravelTime(distanceMeters, speedKmh = 30) {
  return Math.ceil(distanceMeters / ((speedKmh * 1000) / 3600) / 60);
}

export function findNearestCamp(adjacencyList, fromNode, camps) {
  let best = null, bestDist = Infinity;
  for (const camp of camps) {
    if (camp.occupancy >= camp.capacity || camp.status !== 'active') continue;
    const route = dijkstra(adjacencyList, fromNode, camp.nodeId);
    if (route && route.distance < bestDist) { bestDist = route.distance; best = { camp, route }; }
  }
  return best;
}

export function findNearestShelter(adjacencyList, fromNode, shelters, nodesMap) {
  let best = null, bestDist = Infinity;
  for (const shelter of shelters) {
    if (shelter.currentOccupancy >= shelter.capacity) continue;
    const route = aStarSearch(adjacencyList, fromNode, shelter.nodeId, nodesMap);
    if (route && route.distance < bestDist) { bestDist = route.distance; best = { shelter, route }; }
  }
  return best;
}

export function calculateEvacuationRoutes(adjacencyList, affectedZones, shelters, nodesMap) {
  const results = [];
  const shelterCap = shelters.map(s => ({ ...s, remaining: s.capacity - s.currentOccupancy }));
  const sortedZones = [...affectedZones].sort((a, b) => b.population - a.population);
  for (const zone of sortedZones) {
    if (zone.population <= 0) continue;
    let remaining = zone.population;
    const routes = [];
    for (const shelter of shelterCap) {
      if (shelter.remaining <= 0) continue;
      const route = aStarSearch(adjacencyList, zone.nodeId, shelter.nodeId, nodesMap);
      if (route) routes.push({ shelter, route });
    }
    routes.sort((a, b) => a.route.distance - b.route.distance);
    for (const { shelter, route } of routes) {
      if (remaining <= 0) break;
      if (shelter.remaining <= 0) continue;
      const assigned = Math.min(remaining, shelter.remaining);
      shelter.remaining -= assigned; remaining -= assigned;
      results.push({ zone: { ...zone }, shelter: { id: shelter.id, name: shelter.name, nodeId: shelter.nodeId }, route, assignedPopulation: assigned });
    }
    if (remaining > 0) results.push({ zone: { ...zone }, shelter: null, route: null, assignedPopulation: 0, unassigned: remaining, error: 'No route or capacity available' });
  }
  return results;
}

export function identifyAffectedArea(disasterLocation, radius, nodesMap, populationZones) {
  const affectedNodes = [], affectedZones = [];
  let totalPopulation = 0;
  for (const [id, node] of Object.entries(nodesMap)) {
    const d = haversineDistance(node.lat, node.lng, disasterLocation.lat, disasterLocation.lng);
    if (d <= radius) affectedNodes.push({ ...node, distanceFromCenter: Math.round(d) });
  }
  for (const zone of populationZones) {
    const d = haversineDistance(zone.lat, zone.lng, disasterLocation.lat, disasterLocation.lng);
    if (d <= radius * 1.5) {
      const pct = d <= radius ? 1.0 : Math.max(0, 1 - (d - radius) / radius);
      const pop = Math.ceil(zone.population * pct);
      affectedZones.push({ ...zone, affectedPopulation: pop, distanceFromCenter: Math.round(d) });
      totalPopulation += pop;
    }
  }
  return { affectedNodes, affectedZones, totalPopulation };
}

export function validateGraphConnectivity(adjacencyList, nodesMap) {
  const allNodes = Object.keys(nodesMap);
  const visited = new Set();
  let components = 0;
  const isolatedNodes = [];
  for (const node of allNodes) {
    if (visited.has(node)) continue;
    const neighbors = adjacencyList[node];
    if (!neighbors || !neighbors.length) { isolatedNodes.push(node); visited.add(node); continue; }
    components++;
    const queue = [node]; visited.add(node);
    while (queue.length) {
      const cur = queue.shift();
      for (const { to } of (adjacencyList[cur]||[])) { if (!visited.has(to)) { visited.add(to); queue.push(to); } }
    }
  }
  return { connected: components <= 1 && isolatedNodes.length === 0, components, isolatedNodes, totalNodes: allNodes.length, connectedNodes: allNodes.length - isolatedNodes.length };
}
