import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Header from './components/Header.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import CampusMap from './components/CampusMap.jsx';
import ToastContainer from './components/ToastContainer.jsx';
import {
  NODES, EDGES, RELIEF_CAMPS, RESCUE_VEHICLES,
  DISASTER_SCENARIOS, CONTROL_CENTER, SHELTERS,
  POPULATION_ZONES, OSM_ROAD_NODES, OSM_ROAD_EDGES,
  buildCombinedNodesMap,
} from './data/campusData.js';
import {
  buildAdjacencyList, buildAdjacencyListWithLevels,
  dijkstra, aStarSearch,
  pathToCoordinates, pathToGeometryCoordinates,
  estimateTravelTime, findNearestCamp, findNearestShelter,
  calculateEvacuationRoutes, identifyAffectedArea,
  findNearestNode, snapToRoadNetwork,
  validateGraphConnectivity, haversineDistance,
  ROAD_LEVELS,
} from './algorithms/dijkstra.js';

function App() {
  // -- State --
  const [blockedEdges, setBlockedEdges] = useState(new Set());
  const [activeIncident, setActiveIncident] = useState(null);
  const [camps, setCamps] = useState(RELIEF_CAMPS.map(c => ({ ...c })));
  const [vehicles, setVehicles] = useState(RESCUE_VEHICLES.map(v => ({ ...v })));
  const [selectedCampId, setSelectedCampId] = useState(null);
  const [routeResult, setRouteResult] = useState(null);
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  // -- Enhanced feature state --
  const [evacuationResult, setEvacuationResult] = useState(null);
  const [disasterZone, setDisasterZone] = useState(null);
  const [shelters, setShelters] = useState(SHELTERS.map(s => ({ ...s })));
  const [debugMode, setDebugMode] = useState(false);
  const [layerToggles, setLayerToggles] = useState({
    showNodes: false,
    showEdges: true,
    showOsmNodes: false,
    showOsmEdges: false,
    showEmergencyRoute: true,
    showEvacuationRoutes: true,
    showDisasterZone: true,
    showShelters: true,
  });

  // -- B0-B3 Road Impact Levels --
  // roadLevels: { "rn10->rn125": "B2", "rn125->rn10": "B2", ... }
  const [roadLevels, setRoadLevels] = useState({});

  // -- Routing Mode --
  // 'shortest' | 'shortestSafest' | 'safest'
  const [routeMode, setRouteMode] = useState('shortest');

  // -- User-Selected Locations for B-level routing --
  const [customStart, setCustomStart] = useState(null);
  const [customEnd, setCustomEnd] = useState(null);
  const [locationSelectMode, setLocationSelectMode] = useState(null); // 'start' | 'end' | null
  const [customRouteResult, setCustomRouteResult] = useState(null);

  // -- User-Placed Disasters --
  const [userDisasters, setUserDisasters] = useState([]);
  const disasterIdRef = useRef(0);

  // -- Road Segment Selection --
  const [selectedRoadEdge, setSelectedRoadEdge] = useState(null);

  // -- Disaster Placement Mode --
  const [disasterPlaceMode, setDisasterPlaceMode] = useState(false);
  const [disasterPlaceType, setDisasterPlaceType] = useState('flood');


  // -- OSM Road Network (real geometry) --
  const osmNodesMap = useMemo(() => OSM_ROAD_NODES, []);
  const combinedNodesMap = useMemo(() => buildCombinedNodesMap(osmNodesMap), [osmNodesMap]);

  // -- Toast helper --
  const addToast = useCallback((message, type = 'info') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  // -- Build OSM road graph (primary routing graph) --
  const adjacencyList = useMemo(() => {
    return buildAdjacencyList(OSM_ROAD_EDGES, blockedEdges);
  }, [blockedEdges]);

  // -- Evacuation graph (excludes disaster zone edges) --
  const evacuationAdjacencyList = useMemo(() => {
    if (!disasterZone) return adjacencyList;
    return buildAdjacencyList(OSM_ROAD_EDGES, blockedEdges, disasterZone, osmNodesMap);
  }, [blockedEdges, disasterZone, adjacencyList, osmNodesMap]);

  // -- B-level filtered adjacency list (for custom routing) --
  const bLevelAdjacencyList = useMemo(() => {
    return buildAdjacencyListWithLevels(OSM_ROAD_EDGES, blockedEdges, roadLevels, routeMode, osmNodesMap);
  }, [blockedEdges, roadLevels, routeMode, osmNodesMap]);

  // -- Validate graph connectivity --
  const graphStats = useMemo(() => {
    return validateGraphConnectivity(adjacencyList, osmNodesMap);
  }, [adjacencyList, osmNodesMap]);


  // -- Simulate disaster --
  const simulateDisaster = useCallback((type) => {
    const scenario = DISASTER_SCENARIOS[type];
    if (!scenario) return;

    if (activeIncident?.type === type) {
      setActiveIncident(null);
      setDisasterZone(null);
      setEvacuationResult(null);
      setBlockedEdges(prev => {
        const next = new Set(prev);
        for (const edge of scenario.blockedEdges) {
          next.delete(`${edge.from}->${edge.to}`);
          next.delete(`${edge.to}->${edge.from}`);
        }
        return next;
      });
      setRouteResult(null);
      addToast(`${scenario.label} incident cleared`, 'success');
      return;
    }

    const affected = identifyAffectedArea(
      scenario.defaultLocation, scenario.radius || 100, osmNodesMap, POPULATION_ZONES
    );
    const zone = { lat: scenario.defaultLocation.lat, lng: scenario.defaultLocation.lng, radius: scenario.radius || 100, type: scenario.type, severity: scenario.severity || 'medium' };
    setDisasterZone(zone);
    setActiveIncident({
      type: scenario.type, label: scenario.label, icon: scenario.icon, color: scenario.color,
      description: scenario.description, location: scenario.defaultLocation,
      affectedNodes: scenario.affectedNodes, timestamp: new Date().toLocaleTimeString(),
      radius: scenario.radius || 100, severity: scenario.severity || 'medium',
      affectedPopulation: affected.totalPopulation, affectedZones: affected.affectedZones,
    });

    setBlockedEdges(prev => {
      const next = new Set(prev);
      for (const blockedPoi of scenario.blockedEdges) {
        const fromNode = NODES[blockedPoi.from];
        const toNode = NODES[blockedPoi.to];
        if (!fromNode || !toNode) continue;
        const fromRoadId = fromNode.roadNodeId;
        const toRoadId = toNode.roadNodeId;
        if (!fromRoadId || !toRoadId) continue;
        next.add(`${fromRoadId}->${toRoadId}`);
        next.add(`${toRoadId}->${fromRoadId}`);
      }
      return next;
    });

    setRouteResult(null);
    setEvacuationResult(null);
    setSelectedCampId(null);
    addToast(`Warning: ${scenario.label} detected: ${scenario.description}`, 'danger');
    if (affected.totalPopulation > 0) addToast(`~${affected.totalPopulation} people in affected area`, 'warning');
  }, [activeIncident, addToast, osmNodesMap]);


  // -- Toggle road block (on OSM road graph) --
  const toggleRoadBlock = useCallback((from, to) => {
    const fwd = `${from}->${to}`, rev = `${to}->${from}`;
    setBlockedEdges(prev => {
      const next = new Set(prev);
      if (next.has(fwd)) { next.delete(fwd); next.delete(rev); addToast('Road reopened', 'success'); }
      else { next.add(fwd); next.add(rev); addToast('Road blocked', 'warning'); }
      return next;
    });
    setRouteResult(null);
    setEvacuationResult(null);
  }, [addToast]);

  // -- Set Road Impact Level for an edge --
  const setEdgeLevel = useCallback((from, to, level) => {
    const fwd = `${from}->${to}`;
    const rev = `${to}->${from}`;
    setRoadLevels(prev => {
      const next = { ...prev };
      if (level === 'B0') {
        delete next[fwd];
        delete next[rev];
      } else {
        next[fwd] = level;
        next[rev] = level;
      }
      return next;
    });
    // B3 also blocks for existing routing system
    if (level === 'B3') {
      setBlockedEdges(prev => { const next = new Set(prev); next.add(fwd); next.add(rev); return next; });
    } else {
      setBlockedEdges(prev => { const next = new Set(prev); next.delete(fwd); next.delete(rev); return next; });
    }
    const levelInfo = ROAD_LEVELS[level];
    addToast(`Road: ${levelInfo?.label || level} - ${levelInfo?.description || ''}`, level === 'B3' ? 'danger' : level === 'B2' ? 'warning' : 'success');
    setCustomRouteResult(null);
  }, [addToast]);


  // -- User Disaster handlers --
  const addUserDisaster = useCallback((lat, lng, type = 'flood') => {
    const id = 'ud-' + (++disasterIdRef.current);
    const dtype = { flood: 'B3', waterlogging: 'B2', landslide: 'B3', fallen_tree: 'B3', pothole: 'B2', blockage: 'B3' };
    const newDisaster = {
      id, lat, lng, type,
      note: '',
      timestamp: new Date().toLocaleTimeString(),
      affectedEdge: null,
    };
    setUserDisasters(prev => [...prev, newDisaster]);
    setDisasterPlaceMode(false);
    addToast('Disaster marker placed. Click it to edit or assign to a road.', 'warning');
  }, [addToast]);

  const updateUserDisaster = useCallback((id, updates) => {
    setUserDisasters(prev => {
      const updated = prev.map(d => d.id === id ? { ...d, ...updates } : d);
      // If the type is changing and the disaster has an associated road, auto-apply the suggested level
      if (updates.type) {
        const changed = updated.find(d => d.id === id);
        if (changed?.affectedEdge) {
          const suggestedLevels = { flood: 'B3', waterlogging: 'B2', landslide: 'B3', fallen_tree: 'B3', pothole: 'B2', blockage: 'B3' };
          const newLevel = suggestedLevels[updates.type] || 'B3';
          // Schedule outside this render via setTimeout to avoid nested-setState warning
          setTimeout(() => setEdgeLevel(changed.affectedEdge.from, changed.affectedEdge.to, newLevel), 0);
        }
      }
      return updated;
    });
  }, [setEdgeLevel]);

  const deleteUserDisaster = useCallback((id) => {
    setUserDisasters(prev => prev.filter(d => d.id !== id));
    addToast('Disaster marker removed.', 'info');
  }, [addToast]);

  // -- Road Segment Selection --
  const selectRoadEdge = useCallback((edgeData) => {
    setSelectedRoadEdge(edgeData);
  }, []);

  const clearRoadSelection = useCallback(() => {
    setSelectedRoadEdge(null);
  }, []);

  // -- Associate selected road to a disaster / apply level from sidebar --
  const applyLevelToSelectedRoad = useCallback((level) => {
    if (!selectedRoadEdge) { addToast('No road segment selected. Click a road first.', 'warning'); return; }
    setEdgeLevel(selectedRoadEdge.from, selectedRoadEdge.to, level);
    setSelectedRoadEdge(prev => prev ? { ...prev, level } : null);
    addToast('Road condition saved.', 'success');
  }, [selectedRoadEdge, addToast]);

  // -- Handle map click for location selection --
  const handleMapClick = useCallback((lat, lng) => {
    if (!locationSelectMode) return;
    const nodeId = snapToRoadNetwork(lat, lng, OSM_ROAD_EDGES, osmNodesMap);
    const node = osmNodesMap[nodeId];
    if (!node) return;
    const loc = { lat: node.lat, lng: node.lng, nodeId, label: `${node.lat.toFixed(4)}, ${node.lng.toFixed(4)}` };
    if (locationSelectMode === 'start') {
      setCustomStart(loc);
      addToast('Start location set. Now pick destination.', 'info');
    } else {
      setCustomEnd(loc);
      addToast('Destination set. Click Calculate Route.', 'info');
    }
    setLocationSelectMode(null);
    setCustomRouteResult(null);
  }, [locationSelectMode, osmNodesMap, addToast]);

  // -- Calculate B-level custom route --
  const calculateCustomRoute = useCallback(() => {
    if (!customStart || !customEnd) {
      addToast('Please select both a start and destination location.', 'warning');
      return;
    }
    const { nodeId: startId } = customStart;
    const { nodeId: endId } = customEnd;
    if (!osmNodesMap[startId] || !osmNodesMap[endId]) { addToast('Selected nodes not found in road network.', 'danger'); return; }
    if (startId === endId) { addToast('Start and destination are the same.', 'warning'); return; }

    const route = aStarSearch(bLevelAdjacencyList, startId, endId, osmNodesMap);
    const modeLabels = { shortest: 'Shortest Path', shortestSafest: 'Shortest & Safest', safest: 'Safest Path' };
    if (!route) {
      setCustomRouteResult({
        error: true,
        message: `No route in "${modeLabels[routeMode]}" mode. Roads may be too restricted. Try a different mode or reclassify roads.`,
      });
      addToast(`No ${modeLabels[routeMode]} route found.`, 'danger');
      return;
    }

    const coordinates = pathToGeometryCoordinates(route, osmNodesMap);
    const travelTime = estimateTravelTime(route.distance);
    const levelCounts = { B0: 0, B1: 0, B2: 0 };
    for (let i = 0; i < route.path.length - 1; i++) {
      const fwd = `${route.path[i]}->${route.path[i + 1]}`;
      const rev = `${route.path[i + 1]}->${route.path[i]}`;
      const lv = roadLevels[fwd] || roadLevels[rev] || 'B0';
      if (levelCounts[lv] !== undefined) levelCounts[lv]++;
    }
    setCustomRouteResult({ error: false, path: route.path, coordinates, distance: route.distance, travelTime, roads: route.roads, fromLabel: customStart.label, toLabel: customEnd.label, mode: routeMode, levelCounts });
    addToast(`${modeLabels[routeMode]}: ${route.distance}m, ETA ${travelTime} min`, 'success');
  }, [customStart, customEnd, bLevelAdjacencyList, osmNodesMap, routeMode, roadLevels, addToast]);

  // -- Auto-recalculate when mode/levels change --
  useEffect(() => {
    if (customStart && customEnd) {
      const s = customStart.nodeId, e = customEnd.nodeId;
      if (osmNodesMap[s] && osmNodesMap[e] && s !== e) {
        const route = aStarSearch(bLevelAdjacencyList, s, e, osmNodesMap);
        if (route) {
          const coordinates = pathToGeometryCoordinates(route, osmNodesMap);
          setCustomRouteResult(prev => prev ? { ...prev, error: false, path: route.path, coordinates, distance: route.distance, travelTime: estimateTravelTime(route.distance), roads: route.roads, mode: routeMode } : null);
        } else if (customRouteResult && !customRouteResult.error) {
          setCustomRouteResult(prev => prev ? { ...prev, error: true, message: 'Route no longer available with current levels.' } : null);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bLevelAdjacencyList, routeMode]);


  // -- Calculate emergency vehicle route (A* on OSM road graph) --
  const calculateEmergencyRoute = useCallback((startNodeId, destNodeId) => {
    let startRoadNode = startNodeId;
    if (!startRoadNode) {
      const availVehicle = vehicles.find(v => v.status === 'available');
      if (availVehicle) {
        startRoadNode = availVehicle.roadNodeId || snapToRoadNetwork(
          NODES[availVehicle.nodeId]?.lat || 0, NODES[availVehicle.nodeId]?.lng || 0,
          OSM_ROAD_EDGES, osmNodesMap
        );
      } else {
        addToast('No available vehicle selected.', 'warning'); return;
      }
    }

    if (NODES[startRoadNode]) startRoadNode = NODES[startRoadNode].roadNodeId || startRoadNode;

    let endRoadNode = destNodeId;
    if (!endRoadNode) {
      if (activeIncident) {
        endRoadNode = snapToRoadNetwork(
          activeIncident.location.lat, activeIncident.location.lng,
          OSM_ROAD_EDGES, osmNodesMap
        );
      } else { addToast('No destination selected.', 'warning'); return; }
    }
    if (NODES[endRoadNode]) endRoadNode = NODES[endRoadNode].roadNodeId || endRoadNode;

    if (!osmNodesMap[startRoadNode]) { addToast(`Start node not found in road network.`, 'danger'); return; }
    if (!osmNodesMap[endRoadNode]) { addToast(`Destination not found in road network.`, 'danger'); return; }

    const route = aStarSearch(adjacencyList, startRoadNode, endRoadNode, osmNodesMap);
    if (!route) {
      setRouteResult({ error: true, message: 'No route found along roads. All paths may be blocked.' });
      addToast('No route found! All road paths may be blocked.', 'danger'); return;
    }

    const coordinates = pathToGeometryCoordinates(route, osmNodesMap);
    const travelTime = estimateTravelTime(route.distance);
    const startName = NODES[startNodeId]?.name || osmNodesMap[startRoadNode]?.id || startRoadNode;
    const endName = NODES[destNodeId]?.name || osmNodesMap[endRoadNode]?.id || endRoadNode;

    setRouteResult({
      error: false, path: route.path, coordinates, distance: route.distance,
      travelTime, roads: route.roads, fromNode: startRoadNode, toNode: endRoadNode,
      toNodeName: endName, fromNodeName: startName,
    });
    addToast(`Route: ${route.distance}m via ${route.roads.length} road(s) - ETA ${travelTime} min`, 'success');
  }, [adjacencyList, activeIncident, vehicles, osmNodesMap, addToast]);


  // -- Calculate route to camp (uses OSM road graph + roadNodeId) --
  const calculateRoute = useCallback((destinationCampId) => {
    if (!activeIncident) { addToast('No active incident. Simulate a disaster first.', 'warning'); return; }

    const incidentRoadNodeId = snapToRoadNetwork(
      activeIncident.location.lat, activeIncident.location.lng, OSM_ROAD_EDGES, osmNodesMap
    );

    let targetCamp, route;
    if (destinationCampId) {
      targetCamp = camps.find(c => c.id === destinationCampId);
      if (!targetCamp) { addToast('Camp not found', 'danger'); return; }
      if (targetCamp.occupancy >= targetCamp.capacity) {
        addToast(`${targetCamp.name} is at full capacity! Finding alternative...`, 'warning');
        const result = findNearestCamp(adjacencyList, incidentRoadNodeId,
          camps.map(c => ({ ...c, nodeId: c.roadNodeId || c.nodeId })));
        if (!result) { setRouteResult({ error: true, message: 'No route to any camp!' }); addToast('No route to any camp!', 'danger'); return; }
        targetCamp = result.camp;
        route = result.route;
        setSelectedCampId(targetCamp.id);
        addToast(`Rerouted to ${targetCamp.name}`, 'info');
      } else {
        const campRoadNodeId = targetCamp.roadNodeId || targetCamp.nodeId;
        route = aStarSearch(adjacencyList, incidentRoadNodeId, campRoadNodeId, osmNodesMap);
      }
    } else {
      const result = findNearestCamp(adjacencyList, incidentRoadNodeId,
        camps.map(c => ({ ...c, nodeId: c.roadNodeId || c.nodeId })));
      if (!result) { setRouteResult({ error: true, message: 'No route to any camp!' }); addToast('No route to any camp!', 'danger'); return; }
      targetCamp = result.camp;
      route = result.route;
      setSelectedCampId(targetCamp.id);
    }

    if (!route) { setRouteResult({ error: true, message: 'No route found! All paths are blocked.' }); addToast('No route found!', 'danger'); return; }

    const coordinates = pathToGeometryCoordinates(route, osmNodesMap);
    const travelTime = estimateTravelTime(route.distance);
    setRouteResult({ error: false, path: route.path, coordinates, distance: route.distance, travelTime, roads: route.roads, fromNode: incidentRoadNodeId, toCamp: targetCamp });
    addToast(`Route: ${route.distance}m via ${route.roads.length} road(s) - ETA ${travelTime} min`, 'success');
  }, [activeIncident, camps, adjacencyList, osmNodesMap, addToast]);


  // -- Plan Evacuation Routes (OSM road graph + roadNodeId) --
  const planEvacuation = useCallback(() => {
    if (!activeIncident) { addToast('No active incident. Simulate a disaster first.', 'warning'); return; }
    const affectedZones = activeIncident.affectedZones || [];
    if (affectedZones.length === 0) { addToast('No affected population zones identified.', 'warning'); return; }

    const zonesForEvac = affectedZones.map(z => ({
      nodeId: (NODES[z.centerNodeId]?.roadNodeId) || z.centerNodeId,
      name: z.name,
      population: z.affectedPopulation,
    })).filter(z => osmNodesMap[z.nodeId]);

    if (zonesForEvac.length === 0) { addToast('No zones mapped to road network.', 'warning'); return; }

    const sheltersForEvac = shelters.map(s => ({ ...s, nodeId: s.roadNodeId || s.nodeId }));

    const results = calculateEvacuationRoutes(evacuationAdjacencyList, zonesForEvac, sheltersForEvac, osmNodesMap);
    setEvacuationResult(results);

    const shelterUpdates = {};
    for (const r of results) {
      if (r.shelter && r.assignedPopulation > 0) shelterUpdates[r.shelter.id] = (shelterUpdates[r.shelter.id] || 0) + r.assignedPopulation;
    }
    setShelters(prev => prev.map(s => ({ ...s, currentOccupancy: s.currentOccupancy + (shelterUpdates[s.id] || 0) })));

    const totalEvacuated = results.reduce((sum, r) => sum + (r.assignedPopulation || 0), 0);
    const routeCount = results.filter(r => r.route).length;
    addToast(`Evacuation planned: ${totalEvacuated} people via ${routeCount} routes`, 'success');
    if (results.some(r => r.error)) {
      const unassigned = results.filter(r => r.error).reduce((sum, r) => sum + (r.unassigned || 0), 0);
      addToast(`${unassigned} people could not be assigned to shelters`, 'warning');
    }
  }, [activeIncident, evacuationAdjacencyList, shelters, osmNodesMap, addToast]);


  // -- Select camp --
  const selectCamp = useCallback((campId) => {
    setSelectedCampId(campId);
    calculateRoute(campId);
  }, [calculateRoute]);

  // -- Assign vehicle --
  const assignVehicle = useCallback((vehicleId) => {
    if (!activeIncident || !routeResult || routeResult.error) {
      addToast('Calculate a route first before assigning a vehicle.', 'warning');
      return;
    }

    setVehicles(prev => prev.map(v => {
      if (v.id === vehicleId) {
        return { ...v, status: 'enroute', assignedTo: routeResult.toCamp?.name || routeResult.toNodeName };
      }
      return v;
    }));

    if (routeResult.toCamp) {
      setCamps(prev => prev.map(c => {
        if (c.id === routeResult.toCamp.id) {
          return { ...c, occupancy: Math.min(c.occupancy + 15, c.capacity) };
        }
        return c;
      }));
    }

    addToast(`Vehicle dispatched to ${routeResult.toCamp?.name || routeResult.toNodeName || 'destination'}`, 'success');

    setTimeout(() => {
      setVehicles(prev => prev.map(v => {
        if (v.id === vehicleId) {
          return { ...v, status: 'busy', assignedTo: null };
        }
        return v;
      }));
    }, 8000);

    setTimeout(() => {
      setVehicles(prev => prev.map(v => {
        if (v.id === vehicleId) {
          return { ...v, status: 'available', assignedTo: null };
        }
        return v;
      }));
      addToast(`Vehicle returned and is now available`, 'info');
    }, 15000);
  }, [activeIncident, routeResult, addToast]);

  // -- Toggle map layer --
  const toggleLayer = useCallback((key) => {
    setLayerToggles(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // -- Toggle debug mode --
  const toggleDebugMode = useCallback(() => {
    setDebugMode(prev => !prev);
    setLayerToggles(prev => ({
      ...prev,
      showOsmNodes: !debugMode,
      showOsmEdges: !debugMode,
    }));
  }, [debugMode]);


  // -- Reset all --
  const resetAll = useCallback(() => {
    setBlockedEdges(new Set());
    setActiveIncident(null);
    setCamps(RELIEF_CAMPS.map(c => ({ ...c })));
    setVehicles(RESCUE_VEHICLES.map(v => ({ ...v })));
    setShelters(SHELTERS.map(s => ({ ...s })));
    setSelectedCampId(null);
    setRouteResult(null);
    setEvacuationResult(null);
    setDisasterZone(null);
    setDebugMode(false);
    setRoadLevels({});
    setRouteMode('shortest');
    setCustomStart(null);
    setCustomEnd(null);
    setLocationSelectMode(null);
    setCustomRouteResult(null);
    setUserDisasters([]);
    setSelectedRoadEdge(null);
    setDisasterPlaceMode(false);
    setDisasterPlaceType('flood');
    setLayerToggles({
      showNodes: false,
      showEdges: true,
      showOsmNodes: false,
      showOsmEdges: false,
      showEmergencyRoute: true,
      showEvacuationRoutes: true,
      showDisasterZone: true,
      showShelters: true,
    });
    addToast('System reset to initial state', 'info');
  }, [addToast]);


  // -- Computed values for status cards --
  const blockedRoadCount = useMemo(() => {
    return Math.floor(blockedEdges.size / 2);
  }, [blockedEdges]);

  const availableVehicles = useMemo(() => {
    return vehicles.filter(v => v.status === 'available').length;
  }, [vehicles]);

  const totalCampCapacity = useMemo(() => {
    return camps.reduce((sum, c) => sum + (c.capacity - c.occupancy), 0);
  }, [camps]);

  return (
    <>
      <Header />
      <div className="app-layout">
        <ControlPanel
          activeIncident={activeIncident}
          simulateDisaster={simulateDisaster}
          blockedEdges={blockedEdges}
          toggleRoadBlock={toggleRoadBlock}
          camps={camps}
          selectedCampId={selectedCampId}
          selectCamp={selectCamp}
          vehicles={vehicles}
          assignVehicle={assignVehicle}
          routeResult={routeResult}
          calculateRoute={calculateRoute}
          resetAll={resetAll}
          blockedRoadCount={blockedRoadCount}
          availableVehicles={availableVehicles}
          totalCampCapacity={totalCampCapacity}
          onCalculateEmergencyRoute={calculateEmergencyRoute}
          onPlanEvacuation={planEvacuation}
          evacuationResult={evacuationResult}
          disasterZone={disasterZone}
          shelters={shelters}
          layerToggles={layerToggles}
          onToggleLayer={toggleLayer}
          graphStats={graphStats}
          osmEdgeCount={OSM_ROAD_EDGES.length}
          osmNodeCount={Object.keys(osmNodesMap).length}
          debugMode={debugMode}
          onToggleDebugMode={toggleDebugMode}
          roadLevels={roadLevels}
          routeMode={routeMode}
          onSetRouteMode={setRouteMode}
          customStart={customStart}
          customEnd={customEnd}
          locationSelectMode={locationSelectMode}
          onSetLocationSelectMode={setLocationSelectMode}
          onCalculateCustomRoute={calculateCustomRoute}
          customRouteResult={customRouteResult}
          onClearCustomRoute={() => { setCustomRouteResult(null); setCustomStart(null); setCustomEnd(null); setLocationSelectMode(null); }}
          osmNodesMap={osmNodesMap}
          osmEdges={OSM_ROAD_EDGES}
          onSetCustomStart={setCustomStart}
          onSetCustomEnd={setCustomEnd}
          userDisasters={userDisasters}
          onAddUserDisaster={addUserDisaster}
          onUpdateUserDisaster={updateUserDisaster}
          onDeleteUserDisaster={deleteUserDisaster}
          disasterPlaceMode={disasterPlaceMode}
          disasterPlaceType={disasterPlaceType}
          onSetDisasterPlaceMode={setDisasterPlaceMode}
          onSetDisasterPlaceType={setDisasterPlaceType}
          selectedRoadEdge={selectedRoadEdge}
          onApplyLevelToSelectedRoad={applyLevelToSelectedRoad}
          onClearRoadSelection={clearRoadSelection}
        />
        <div className="map-container">
          <CampusMap
            activeIncident={activeIncident}
            blockedEdges={blockedEdges}
            camps={camps}
            selectedCampId={selectedCampId}
            vehicles={vehicles}
            routeResult={routeResult}
            evacuationRoutes={evacuationResult}
            disasterZone={disasterZone}
            showNodes={layerToggles.showNodes}
            showEdges={layerToggles.showEdges}
            showOsmNodes={layerToggles.showOsmNodes}
            showOsmEdges={layerToggles.showOsmEdges}
            showEmergencyRoute={layerToggles.showEmergencyRoute}
            showEvacuationRoutes={layerToggles.showEvacuationRoutes}
            showDisasterZone={layerToggles.showDisasterZone}
            showShelters={layerToggles.showShelters}
            shelters={shelters}
            osmNodesMap={osmNodesMap}
            osmEdges={OSM_ROAD_EDGES}
            debugMode={debugMode}
            roadLevels={roadLevels}
            onSetEdgeLevel={setEdgeLevel}
            customStart={customStart}
            customEnd={customEnd}
            locationSelectMode={locationSelectMode}
            onMapClick={handleMapClick}
            customRouteResult={customRouteResult}
            routeMode={routeMode}
            userDisasters={userDisasters}
            onAddUserDisaster={addUserDisaster}
            onUpdateUserDisaster={updateUserDisaster}
            onDeleteUserDisaster={deleteUserDisaster}
            disasterPlaceMode={disasterPlaceMode}
            disasterPlaceType={disasterPlaceType}
            selectedRoadEdge={selectedRoadEdge}
            onSelectRoadEdge={selectRoadEdge}
            onClearRoadSelection={clearRoadSelection}
          />
        </div>
      </div>
      <ToastContainer toasts={toasts} />
    </>
  );
}

export default App;
