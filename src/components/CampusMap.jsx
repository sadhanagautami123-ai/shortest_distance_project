import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  MapContainer, TileLayer, Marker, Popup,
  Polyline, Circle, CircleMarker, useMap, useMapEvents
} from 'react-leaflet';
import L from 'leaflet';
import {
  NODES, EDGES, CAMPUS_CENTER, CAMPUS_BOUNDS,
  DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM, CONTROL_CENTER,
  SHELTERS, OSM_ROAD_NODES, OSM_ROAD_EDGES,
} from '../data/campusData.js';
import { ROAD_LEVELS } from '../algorithms/dijkstra.js';

// -- Fix Leaflet default icon path issue in Vite --
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// -- Disaster type definitions --
export const DISASTER_TYPES = {
  flood:       { label: 'Flood',         icon: '🌊', color: '#3b82f6', suggestedLevel: 'B3', description: 'Deep water flooding road' },
  waterlogging:{ label: 'Waterlogging',  icon: '💧', color: '#0ea5e9', suggestedLevel: 'B2', description: 'Waterlogged, passable by large vehicles' },
  landslide:   { label: 'Landslide',     icon: '⛰️', color: '#92400e', suggestedLevel: 'B3', description: 'Landslide blocking road' },
  fallen_tree: { label: 'Fallen Tree',   icon: '🌲', color: '#15803d', suggestedLevel: 'B3', description: 'Fallen tree blocking road' },
  pothole:     { label: 'Severe Pothole',icon: '🕳️', color: '#f59e0b', suggestedLevel: 'B2', description: 'Severe potholes, slow passage' },
  blockage:    { label: 'Road Blockage', icon: '🚧', color: '#ef4444', suggestedLevel: 'B3', description: 'Complete road blockage' },
};

// -- Custom icon factory --
function createDivIcon(content, className, size = [30, 30], bgColor) {
  const bg = bgColor ? `background:${bgColor};` : '';
  return L.divIcon({
    html: `<div class="custom-marker ${className}" style="width:${size[0]}px;height:${size[1]}px;${bg}">${content}</div>`,
    className: '',
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1] / 2],
    popupAnchor: [0, -size[1] / 2],
  });
}

// -- Restrict map bounds --
function MapBoundsEnforcer() {
  const map = useMap();
  const bounds = L.latLngBounds(CAMPUS_BOUNDS);
  map.setMaxBounds(bounds.pad(0.3));
  map.options.maxBoundsViscosity = 0.9;
  return null;
}

// -- Unified map click handler --
function MapClickHandler({ onMapClick, activeMode }) {
  useMapEvents({
    click(e) {
      if (activeMode && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// -- Cursor style controller --
function CursorController({ activeMode }) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    container.style.cursor = activeMode ? 'crosshair' : '';
  }, [map, activeMode]);
  return null;
}

// -- Node color based on type --
function getNodeStyle(nodeType) {
  switch (nodeType) {
    case 'intersection':      return { color: '#3b82f6', fillColor: '#3b82f6', radius: 6, label: 'Intersection' };
    case 'turning_point':     return { color: '#f97316', fillColor: '#f97316', radius: 4, label: 'Turning Point' };
    case 'gate':              return { color: '#22c55e', fillColor: '#22c55e', radius: 7, label: 'Gate/Entry' };
    case 'hospital':          return { color: '#ef4444', fillColor: '#ef4444', radius: 7, label: 'Hospital' };
    case 'emergency_service': return { color: '#ef4444', fillColor: '#f97316', radius: 6, label: 'Emergency Service' };
    case 'shelter':           return { color: '#a855f7', fillColor: '#a855f7', radius: 6, label: 'Shelter' };
    case 'evacuation_exit':   return { color: '#22c55e', fillColor: '#10b981', radius: 7, label: 'Evacuation Exit' };
    case 'building':          return { color: '#64748b', fillColor: '#475569', radius: 5, label: 'Building' };
    case 'hostel':            return { color: '#8b5cf6', fillColor: '#7c3aed', radius: 5, label: 'Hostel' };
    default:                  return { color: '#94a3b8', fillColor: '#94a3b8', radius: 4, label: nodeType };
  }
}

// -- Road level color --
function getEdgeLevelColor(level) {
  switch (level) {
    case 'B3': return '#ef4444';
    case 'B2': return '#f97316';
    case 'B1': return '#eab308';
    case 'B0':
    default:   return 'rgba(56,189,248,0.45)';
  }
}
function getEdgeLevelColorSolid(level) {
  switch (level) {
    case 'B3': return '#ef4444';
    case 'B2': return '#f97316';
    case 'B1': return '#eab308';
    case 'B0':
    default:   return '#38bdf8';
  }
}

function CampusMap({
  activeIncident,
  blockedEdges,
  camps,
  selectedCampId,
  vehicles,
  routeResult,
  evacuationRoutes,
  disasterZone,
  showNodes,
  showEdges,
  showOsmNodes,
  showOsmEdges,
  showEmergencyRoute,
  showEvacuationRoutes,
  showDisasterZone,
  showShelters,
  shelters,
  osmNodesMap,
  osmEdges,
  debugMode,
  // B-level props
  roadLevels = {},
  onSetEdgeLevel,
  // Location selection
  customStart,
  customEnd,
  locationSelectMode,
  onMapClick,
  customRouteResult,
  routeMode,
  // User-placed disasters
  userDisasters = [],
  onAddUserDisaster,
  onUpdateUserDisaster,
  onDeleteUserDisaster,
  disasterPlaceMode,
  disasterPlaceType,
  // Road segment selection mode
  roadSelectMode,
  selectedRoadEdge,
  onSelectRoadEdge,
  onClearRoadSelection,
}) {
  const roadNodes = osmNodesMap || OSM_ROAD_NODES;
  const roadEdges = osmEdges || OSM_ROAD_EDGES;

  // Active map click mode (combines location pick + disaster placement)
  const activeMode = locationSelectMode || disasterPlaceMode || null;

  // Handle unified map click
  const handleUnifiedMapClick = useCallback((lat, lng) => {
    if (locationSelectMode && onMapClick) {
      onMapClick(lat, lng);
    } else if (disasterPlaceMode && onAddUserDisaster) {
      onAddUserDisaster(lat, lng, disasterPlaceType);
    }
  }, [locationSelectMode, disasterPlaceMode, onMapClick, onAddUserDisaster, disasterPlaceType]);

  // -- Build OSM road edge display data (with B-level coloring) --
  const osmEdgeLines = useMemo(() => {
    return roadEdges.map((edge, idx) => {
      const fn = roadNodes[edge.from], tn = roadNodes[edge.to];
      if (!fn || !tn) return null;

      const fwd = `${edge.from}->${edge.to}`;
      const rev = `${edge.to}->${edge.from}`;
      const isBlocked = blockedEdges.has(fwd) || blockedEdges.has(rev);
      const level = roadLevels[fwd] || roadLevels[rev] || 'B0';

      // Real OSM geometry — always use it
      const positions = (edge.geometry && edge.geometry.length >= 2)
        ? edge.geometry
        : [[fn.lat, fn.lng], [tn.lat, tn.lng]];

      // isSelected = currently highlighted in road-select mode
      const isSelected = selectedRoadEdge &&
        ((selectedRoadEdge.from === edge.from && selectedRoadEdge.to === edge.to) ||
         (selectedRoadEdge.from === edge.to && selectedRoadEdge.to === edge.from));

      // Color: selected road gets a bright pulsing color
      const color = isSelected
        ? '#fff'
        : getEdgeLevelColor(level);

      const weight = isSelected ? 8 : (level !== 'B0' || isBlocked) ? 5 : 3;
      const dashArray = isSelected ? null : (level === 'B3' || isBlocked) ? '8,6' : null;
      const opacity = isSelected ? 1 : (level !== 'B0' || isBlocked) ? 0.88 : 0.6;

      return {
        positions, color, weight, dashArray, opacity,
        isBlocked, isSelected, level,
        road: edge.road,
        distance: edge.distance, travelTime: edge.travelTime,
        from: edge.from, to: edge.to, idx,
        fn, tn,
      };
    }).filter(Boolean);
  }, [blockedEdges, roadEdges, roadNodes, roadLevels, selectedRoadEdge]);

  const controlCenterIcon = useMemo(() => createDivIcon('🏛️', 'control-center', [36, 36]), []);
  const visibleShelters = shelters || SHELTERS;

  return (
    <>
      <MapContainer
        center={CAMPUS_CENTER}
        zoom={DEFAULT_ZOOM}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
        attributionControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapBoundsEnforcer />
        <MapClickHandler onMapClick={handleUnifiedMapClick} activeMode={activeMode} />
        <CursorController activeMode={activeMode} />

        {/* ── OSM Road Edges colored by B-level ── */}
        {showEdges !== false && osmEdgeLines.map((line) => (
          <React.Fragment key={`edge-${line.idx}`}>
            {/* Glow layer for classified/selected roads */}
            {(line.level !== 'B0' || line.isSelected) && (
              <Polyline
                positions={line.positions}
                color={getEdgeLevelColorSolid(line.level)}
                weight={line.isSelected ? 18 : 12}
                opacity={line.isSelected ? 0.25 : 0.18}
                interactive={false}
              />
            )}
            {/* Main road polyline */}
            <Polyline
              positions={line.positions}
              color={line.color}
              weight={line.weight}
              dashArray={line.dashArray}
              opacity={line.opacity}
              eventHandlers={{
                click: (e) => {
                  e.originalEvent.stopPropagation();
                  if (onSelectRoadEdge) {
                    onSelectRoadEdge({ from: line.from, to: line.to, level: line.level, road: line.road, distance: line.distance, positions: line.positions });
                  }
                },
                mouseover: (e) => { e.target.setStyle({ opacity: 1, weight: Math.max(line.weight, 6) }); },
                mouseout:  (e) => { e.target.setStyle({ opacity: line.opacity, weight: line.weight }); },
              }}
            >
              <Popup>
                <div className="popup-title">
                  {line.level === 'B3' ? '🚫' : line.level === 'B2' ? '🟠' : line.level === 'B1' ? '🟡' : '🟢'} {line.road}
                </div>
                <div className="popup-detail" style={{ color: ROAD_LEVELS[line.level]?.color || '#38bdf8', fontWeight: 700, marginBottom: 4 }}>
                  {ROAD_LEVELS[line.level]?.label || 'B0 — Clear'}: {ROAD_LEVELS[line.level]?.description || 'Clear, safe road'}
                </div>
                <div className="popup-detail">Distance: {line.distance}m · ~{line.travelTime}s</div>
                {/* Quick level buttons right in popup */}
                {onSetEdgeLevel && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Set Condition:</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {['B0', 'B1', 'B2', 'B3'].map(lvl => (
                        <button
                          key={lvl}
                          onClick={(e) => { e.stopPropagation(); onSetEdgeLevel(line.from, line.to, lvl); }}
                          style={{
                            padding: '3px 9px', borderRadius: 5, fontSize: 11, fontWeight: 800,
                            background: line.level === lvl ? ROAD_LEVELS[lvl].color : 'rgba(255,255,255,0.08)',
                            color: line.level === lvl ? '#fff' : ROAD_LEVELS[lvl].color,
                            border: `2px solid ${ROAD_LEVELS[lvl].color}`,
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >{lvl}</button>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: '#637aa9', marginTop: 5 }}>
                      {ROAD_LEVELS[line.level]?.description || 'Clear, safe road'}
                    </div>
                  </div>
                )}
                <div style={{ fontSize: 10, color: '#475569', marginTop: 5 }}>
                  Segment: {line.from} → {line.to}
                </div>
              </Popup>
            </Polyline>
          </React.Fragment>
        ))}

        {/* ── Selected Road Endpoints (visual anchor dots) ── */}
        {selectedRoadEdge && (() => {
          const line = osmEdgeLines.find(l => l.from === selectedRoadEdge.from && l.to === selectedRoadEdge.to);
          if (!line || line.positions.length < 2) return null;
          const start = line.positions[0];
          const end = line.positions[line.positions.length - 1];
          return (
            <>
              <CircleMarker center={start} radius={7}
                pathOptions={{ color: '#fff', fillColor: getEdgeLevelColorSolid(selectedRoadEdge.level), fillOpacity: 1, weight: 2 }} />
              <CircleMarker center={end} radius={7}
                pathOptions={{ color: '#fff', fillColor: getEdgeLevelColorSolid(selectedRoadEdge.level), fillOpacity: 1, weight: 2 }} />
            </>
          );
        })()}

        {/* ── Debug: OSM road nodes ── */}
        {(showOsmNodes || debugMode) && Object.values(roadNodes).map((node) => (
          <CircleMarker
            key={`osm-node-${node.id}`}
            center={[node.lat, node.lng]}
            radius={node.type === 'intersection' ? 5 : 3}
            pathOptions={{
              color: node.type === 'intersection' ? '#f97316' : '#94a3b8',
              fillColor: node.type === 'intersection' ? '#f97316' : '#64748b',
              fillOpacity: 0.8, weight: 1,
            }}
          >
            <Popup>
              <div className="popup-title">OSM Road Node</div>
              <div className="popup-detail">ID: <code>{node.id}</code><br />
                Type: <span style={{ color: '#f97316', fontWeight: 600 }}>{node.type}</span><br />
                {node.lat.toFixed(5)}, {node.lng.toFixed(5)}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* ── Disaster Zone overlay (from simulated incidents) ── */}
        {showDisasterZone !== false && disasterZone && (
          <>
            <Circle center={[disasterZone.lat, disasterZone.lng]} radius={disasterZone.radius * 1.3}
              pathOptions={{ color: 'transparent', fillColor: '#ef4444', fillOpacity: 0.05, weight: 0 }} />
            <Circle center={[disasterZone.lat, disasterZone.lng]} radius={disasterZone.radius}
              pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.18, weight: 2, dashArray: '10,6' }} />
            <Circle center={[disasterZone.lat, disasterZone.lng]} radius={disasterZone.radius * 0.4}
              pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.35, weight: 1 }} />
          </>
        )}

        {/* ── User-Placed Disaster Markers ── */}
        {userDisasters.map((disaster) => {
          const dtype = DISASTER_TYPES[disaster.type] || DISASTER_TYPES.blockage;
          const icon = createDivIcon(
            dtype.icon,
            `disaster-marker disaster-${disaster.type}`,
            [36, 36],
            dtype.color + 'dd'
          );
          return (
            <Marker key={disaster.id} position={[disaster.lat, disaster.lng]} icon={icon}>
              <Popup>
                <div className="popup-title" style={{ color: dtype.color }}>
                  {dtype.icon} {dtype.label}
                </div>
                <div className="popup-detail" style={{ marginBottom: 6 }}>
                  {disaster.note || dtype.description}<br />
                  <span style={{ fontSize: 10, color: '#637aa9' }}>
                    {disaster.lat.toFixed(5)}, {disaster.lng.toFixed(5)}<br />
                    Added: {disaster.timestamp}
                  </span>
                </div>
                {/* Road association display */}
                {disaster.affectedEdge && (
                  <div style={{ fontSize: 11, marginBottom: 6, padding: '4px 8px', background: 'rgba(239,68,68,0.1)', borderRadius: 5, color: '#fca5a5' }}>
                    Road: <strong>{disaster.affectedEdge.road}</strong> → Condition: <strong style={{ color: ROAD_LEVELS[disaster.affectedEdge.level]?.color }}>{disaster.affectedEdge.level}</strong>
                  </div>
                )}
                {/* Suggested road condition */}
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 3 }}>Suggested condition: <strong style={{ color: ROAD_LEVELS[dtype.suggestedLevel]?.color }}>{dtype.suggestedLevel}</strong></div>
                  {/* Change type buttons */}
                  <div style={{ fontSize: 10, color: '#637aa9', marginBottom: 4 }}>Change type:</div>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
                    {Object.entries(DISASTER_TYPES).map(([key, dt]) => (
                      <button key={key}
                        onClick={() => onUpdateUserDisaster && onUpdateUserDisaster(disaster.id, { type: key })}
                        style={{
                          padding: '2px 6px', borderRadius: 4, fontSize: 10,
                          background: disaster.type === key ? dt.color : 'rgba(255,255,255,0.07)',
                          color: disaster.type === key ? '#fff' : '#94a3b8',
                          border: `1px solid ${dt.color}40`,
                          cursor: 'pointer',
                        }}
                      >{dt.icon} {dt.label}</button>
                    ))}
                  </div>
                </div>
                {/* Edit note */}
                <div style={{ marginBottom: 6 }}>
                  <input
                    placeholder="Add note..."
                    defaultValue={disaster.note || ''}
                    onBlur={(e) => onUpdateUserDisaster && onUpdateUserDisaster(disaster.id, { note: e.target.value })}
                    style={{
                      width: '100%', padding: '4px 8px', borderRadius: 5, fontSize: 11,
                      background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(99,122,169,0.3)',
                      color: '#f0f4fc', outline: 'none',
                    }}
                  />
                </div>
                {/* Delete */}
                <button
                  onClick={() => onDeleteUserDisaster && onDeleteUserDisaster(disaster.id)}
                  style={{
                    width: '100%', padding: '4px 0', borderRadius: 5, fontSize: 11, fontWeight: 700,
                    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444',
                    cursor: 'pointer',
                  }}
                >🗑️ Delete Marker</button>
              </Popup>
            </Marker>
          );
        })}

        {/* ── Evacuation routes ── */}
        {showEvacuationRoutes !== false && evacuationRoutes && evacuationRoutes.map((er, idx) => {
          if (!er.route || !er.route.path) return null;
          let coordinates;
          if (er.route.geometrySegments && er.route.geometrySegments.length > 0) {
            coordinates = [];
            for (let i = 0; i < er.route.geometrySegments.length; i++) {
              const seg = er.route.geometrySegments[i];
              if (!seg) continue;
              const start = i === 0 ? 0 : 1;
              for (let j = start; j < seg.length; j++) coordinates.push([seg[j][0], seg[j][1]]);
            }
          }
          if (!coordinates || coordinates.length === 0)
            coordinates = er.route.path.filter(id => roadNodes[id]).map(id => [roadNodes[id].lat, roadNodes[id].lng]);
          if (coordinates.length < 2) return null;
          return (
            <React.Fragment key={`evac-${idx}`}>
              <Polyline positions={coordinates} color="#22c55e" weight={14} opacity={0.12} interactive={false} />
              <Polyline positions={coordinates} color="#22c55e" weight={4} opacity={0.85} dashArray="12,8">
                <Popup>
                  <div className="popup-title">🟢 Evacuation Route</div>
                  <div className="popup-detail">
                    From: {er.zone?.name || 'Unknown'}<br />To: {er.shelter?.name || 'Unknown'}<br />
                    Distance: {er.route.distance}m · People: {er.assignedPopulation}
                  </div>
                </Popup>
              </Polyline>
            </React.Fragment>
          );
        })}

        {/* ── Emergency route (blue) ── */}
        {showEmergencyRoute !== false && routeResult && !routeResult.error && routeResult.coordinates && (
          <>
            <Polyline positions={routeResult.coordinates} color="#3b82f6" weight={14} opacity={0.15} interactive={false} />
            <Polyline positions={routeResult.coordinates} color="#3b82f6" weight={5} opacity={0.9}>
              <Popup>
                <div className="popup-title">🔵 Emergency Vehicle Route</div>
                <div className="popup-detail">
                  Distance: {routeResult.distance}m · ETA: {routeResult.travelTime} min<br />
                  Via: {routeResult.roads?.join(' → ')}
                </div>
              </Popup>
            </Polyline>
            {routeResult.coordinates.length > 1 && (
              <Marker position={routeResult.coordinates[0]} icon={createDivIcon('A', 'route-start custom-loc-start', [26, 26])}>
                <Popup><div className="popup-title">Route Start</div></Popup>
              </Marker>
            )}
            {routeResult.coordinates.length > 1 && (
              <Marker position={routeResult.coordinates[routeResult.coordinates.length - 1]} icon={createDivIcon('B', 'route-end custom-loc-end', [26, 26])}>
                <Popup><div className="popup-title">Route Destination</div></Popup>
              </Marker>
            )}
          </>
        )}

        {/* ── Custom B-level route (purple) ── */}
        {customRouteResult && !customRouteResult.error && customRouteResult.coordinates && (
          <>
            <Polyline positions={customRouteResult.coordinates} color="#a855f7" weight={16} opacity={0.13} interactive={false} />
            <Polyline positions={customRouteResult.coordinates} color="#a855f7" weight={5} opacity={0.95}
              dashArray={customRouteResult.mode === 'safest' ? '2,8' : customRouteResult.mode === 'shortestSafest' ? '10,5' : null}>
              <Popup>
                <div className="popup-title" style={{ color: '#a855f7' }}>
                  {customRouteResult.mode === 'shortest' ? '🛣️ Shortest' : customRouteResult.mode === 'shortestSafest' ? '🛡️ Shortest & Safest' : '✅ Safest'} Route
                </div>
                <div className="popup-detail">
                  Distance: {customRouteResult.distance}m · ETA: {customRouteResult.travelTime} min
                </div>
                <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
                  {customRouteResult.levelCounts?.B0 > 0 && <span style={{ color: '#22c55e', fontSize: 11 }}>B0×{customRouteResult.levelCounts.B0}</span>}
                  {customRouteResult.levelCounts?.B1 > 0 && <span style={{ color: '#eab308', fontSize: 11 }}>B1×{customRouteResult.levelCounts.B1}</span>}
                  {customRouteResult.levelCounts?.B2 > 0 && <span style={{ color: '#f97316', fontSize: 11 }}>B2×{customRouteResult.levelCounts.B2}</span>}
                </div>
              </Popup>
            </Polyline>
          </>
        )}

        {/* ── Custom Start marker ── */}
        {customStart && (
          <Marker position={[customStart.lat, customStart.lng]}
            icon={createDivIcon('S', 'route-start custom-loc-start', [28, 28])}>
            <Popup>
              <div className="popup-title" style={{ color: '#3b82f6' }}>Start Location</div>
              <div className="popup-detail">{customStart.label}</div>
            </Popup>
          </Marker>
        )}

        {/* ── Custom End marker ── */}
        {customEnd && (
          <Marker position={[customEnd.lat, customEnd.lng]}
            icon={createDivIcon('E', 'route-end custom-loc-end', [28, 28])}>
            <Popup>
              <div className="popup-title" style={{ color: '#22c55e' }}>Destination</div>
              <div className="popup-detail">{customEnd.label}</div>
            </Popup>
          </Marker>
        )}

        {/* ── Emergency Control Center ── */}
        <Marker position={[CONTROL_CENTER.lat, CONTROL_CENTER.lng]} icon={controlCenterIcon}>
          <Popup>
            <div className="popup-title">🏛️ {CONTROL_CENTER.name}</div>
            <div className="popup-subtitle">NIT Kurukshetra Admin Block</div>
            <div className="popup-detail">Central command for all emergency operations</div>
          </Popup>
        </Marker>

        {/* ── Relief Camps ── */}
        {camps.map(camp => {
          const isFull = camp.occupancy >= camp.capacity;
          const isSelected = selectedCampId === camp.id;
          const icon = createDivIcon('⛺', `camp ${isFull ? 'full' : ''}`, isSelected ? [36, 36] : [30, 30]);
          return (
            <Marker key={camp.id} position={[camp.lat, camp.lng]} icon={icon}>
              <Popup>
                <div className="popup-title">⛺ {camp.name}</div>
                <div className="popup-subtitle">{isFull ? '🔴 At Full Capacity' : '🟢 Accepting Evacuees'}</div>
                <div className="popup-detail">
                  Capacity: {camp.occupancy}/{camp.capacity}<br />
                  Available: {camp.capacity - camp.occupancy} spots<br />
                  Supplies: {camp.supplies.join(', ')}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* ── Evacuation Shelters ── */}
        {showShelters !== false && visibleShelters.map(shelter => {
          const isFull = shelter.currentOccupancy >= shelter.capacity;
          const icon = createDivIcon(
            shelter.type === 'medical' ? '🏥' : shelter.type === 'evacuation_point' ? '🚪' : '🟣',
            `shelter ${isFull ? 'full' : ''} ${shelter.type}`, [28, 28]
          );
          return (
            <Marker key={shelter.id} position={[shelter.lat, shelter.lng]} icon={icon}>
              <Popup>
                <div className="popup-title">{shelter.type === 'medical' ? '🏥' : '🟣'} {shelter.name}</div>
                <div className="popup-subtitle">{isFull ? '🔴 Full' : `🟢 ${shelter.capacity - shelter.currentOccupancy} spots available`}</div>
                <div className="popup-detail">
                  Type: {shelter.type.replace('_', ' ')}<br />
                  Capacity: {shelter.currentOccupancy}/{shelter.capacity}<br />
                  Facilities: {shelter.facilities.join(', ')}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* ── Rescue Vehicles ── */}
        {vehicles.map(vehicle => {
          const node = NODES[vehicle.nodeId];
          if (!node) return null;
          const emoji = vehicle.type === 'ambulance' ? '🚑' : vehicle.type === 'fire_truck' ? '🚒' : vehicle.type === 'rescue_van' ? '🚐' : '🚛';
          const icon = createDivIcon(emoji, `vehicle ${vehicle.status}`, [28, 28]);
          return (
            <Marker key={vehicle.id} position={[node.lat, node.lng]} icon={icon}>
              <Popup>
                <div className="popup-title">{vehicle.name}</div>
                <div className="popup-subtitle">Status: <strong style={{ color: vehicle.status === 'available' ? '#22c55e' : vehicle.status === 'enroute' ? '#f59e0b' : '#ef4444' }}>
                  {vehicle.status === 'enroute' ? 'En Route' : vehicle.status.toUpperCase()}</strong>
                </div>
                <div className="popup-detail">Type: {vehicle.type.replace('_', ' ')} · Speed: {vehicle.speed} km/h</div>
              </Popup>
            </Marker>
          );
        })}

        {/* ── Active Incident marker ── */}
        {activeIncident && (
          <>
            <Circle center={[activeIncident.location.lat, activeIncident.location.lng]} radius={activeIncident.radius || 80}
              pathOptions={{ color: activeIncident.color, fillColor: activeIncident.color, fillOpacity: 0.15, weight: 2, dashArray: '6,4' }} />
            <Marker position={[activeIncident.location.lat, activeIncident.location.lng]}
              icon={createDivIcon(activeIncident.icon, 'incident', [34, 34])}>
              <Popup>
                <div className="popup-title">{activeIncident.icon} {activeIncident.label} Incident</div>
                <div className="popup-subtitle">Reported at {activeIncident.timestamp}</div>
                <div className="popup-detail">{activeIncident.description}</div>
                {activeIncident.affectedPopulation > 0 && (
                  <div className="popup-detail" style={{ color: '#ef4444', fontWeight: 600 }}>
                    ~{activeIncident.affectedPopulation} people potentially affected
                  </div>
                )}
              </Popup>
            </Marker>
          </>
        )}

        {/* ── Emergency Facilities ── */}
        {Object.values(NODES).filter(n => n.type === 'hospital').map(node => (
          <Marker key={`hosp-${node.id}`} position={[node.lat, node.lng]}
            icon={createDivIcon('🏥', 'hospital-marker', [30, 30])}>
            <Popup>
              <div className="popup-title">🏥 {node.name}</div>
              <div className="popup-detail">Emergency Medical Facility</div>
            </Popup>
          </Marker>
        ))}
        {Object.values(NODES).filter(n => n.type === 'emergency_service').map(node => {
          const isFire = node.name.toLowerCase().includes('fire');
          return (
            <Marker key={`emrg-${node.id}`} position={[node.lat, node.lng]}
              icon={createDivIcon(isFire ? '🚒' : '🛡️', 'emergency-marker', [28, 28])}>
              <Popup>
                <div className="popup-title">{isFire ? '🚒' : '🛡️'} {node.name}</div>
                <div className="popup-detail">Emergency Service Station</div>
              </Popup>
            </Marker>
          );
        })}

        {/* ── POI node dots (debug) ── */}
        {showNodes !== false && Object.values(NODES).map(node => {
          const style = getNodeStyle(node.type);
          return (
            <CircleMarker key={node.id} center={[node.lat, node.lng]} radius={style.radius}
              pathOptions={{ color: style.color, fillColor: style.fillColor, fillOpacity: 0.7, weight: 1.5, opacity: 0.9 }}>
              <Popup>
                <div className="popup-title">{node.name}</div>
                <div className="popup-detail">
                  ID: <code>{node.id}</code><br />
                  Type: <span style={{ color: style.color, fontWeight: 600 }}>{style.label}</span><br />
                  Road: <code>{node.roadNodeId || 'N/A'}</code>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* ── Active mode banner (overlaid on map) ── */}
      {(locationSelectMode || disasterPlaceMode) && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1200, color: '#fff', padding: '9px 22px', borderRadius: '22px',
          fontWeight: 700, fontSize: '13px', pointerEvents: 'none',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          background: locationSelectMode === 'start'
            ? 'rgba(59,130,246,0.97)'
            : locationSelectMode === 'end'
            ? 'rgba(34,197,94,0.97)'
            : `${DISASTER_TYPES[disasterPlaceType]?.color || '#ef4444'}ee`,
          backdropFilter: 'blur(8px)',
          letterSpacing: '0.02em',
        }}>
          {locationSelectMode === 'start' && '📍 Click map to place START point'}
          {locationSelectMode === 'end' && '🏁 Click map to place DESTINATION'}
          {disasterPlaceMode && `${DISASTER_TYPES[disasterPlaceType]?.icon || '⚠️'} Click map to place ${DISASTER_TYPES[disasterPlaceType]?.label || 'Disaster'} marker`}
        </div>
      )}

      {/* ── Map Legend ── */}
      <div className="map-legend">
        <h4>Map Legend</h4>
        <div className="legend-section">
          <div className="legend-section-title">Road Conditions</div>
          {Object.entries(ROAD_LEVELS).map(([key, val]) => (
            <div key={key} className="legend-item">
              <span className="legend-line" style={{ background: val.color, height: 4, borderRadius: 2 }}></span>
              <span><strong style={{ color: val.color }}>{key}</strong> — {val.description.split(',')[0]}</span>
            </div>
          ))}
        </div>
        <div className="legend-section">
          <div className="legend-section-title">Routes</div>
          <div className="legend-item"><span className="legend-line" style={{ background: '#3b82f6' }}></span><span>Emergency Route</span></div>
          <div className="legend-item"><span className="legend-line" style={{ background: '#a855f7' }}></span><span>Custom Route</span></div>
          <div className="legend-item"><span className="legend-line" style={{ background: '#22c55e' }}></span><span>Evacuation Route</span></div>
        </div>
        <div className="legend-section">
          <div className="legend-section-title">Disasters</div>
          {Object.entries(DISASTER_TYPES).slice(0, 4).map(([key, dt]) => (
            <div key={key} className="legend-item">
              <span className="legend-emoji" style={{ fontSize: 13 }}>{dt.icon}</span>
              <span>{dt.label}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '10px', color: '#637aa9', marginTop: 6, lineHeight: 1.5 }}>
          Click any road to classify B0–B3<br />
          Use panel to place disaster markers
        </div>
      </div>
    </>
  );
}

export default CampusMap;
