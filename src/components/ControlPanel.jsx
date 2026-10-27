import React, { useState } from 'react';
import { EDGES, NODES, DISASTER_SCENARIOS, SHELTERS } from '../data/campusData.js';
import { ROAD_LEVELS } from '../algorithms/dijkstra.js';
import { DISASTER_TYPES } from './CampusMap.jsx';

const VEHICLE_ICONS = {
  ambulance: '🚑',
  fire_truck: '🚒',
  rescue_van: '🚐',
  utility: '🚛',
};

// Get human-readable node list for dropdowns
const NODE_OPTIONS = Object.entries(NODES)
  .filter(([, n]) => ['intersection', 'gate', 'building', 'hospital', 'emergency_service'].includes(n.type))
  .map(([id, n]) => ({ id, name: n.name, type: n.type }));

const ROUTE_MODES = [
  {
    key: 'shortest',
    label: 'Shortest Path',
    icon: '🛣️',
    desc: 'Uses B0, B1, B2 roads. Minimises total distance.',
    color: '#3b82f6',
  },
  {
    key: 'shortestSafest',
    label: 'Shortest & Safest',
    icon: '🛡️',
    desc: 'Uses B0 and B1 only. Avoids B2 and B3.',
    color: '#eab308',
  },
  {
    key: 'safest',
    label: 'Safest Path',
    icon: '✅',
    desc: 'Uses B0 roads only. Maximum safety.',
    color: '#22c55e',
  },
];

function ControlPanel({
  activeIncident,
  simulateDisaster,
  blockedEdges,
  toggleRoadBlock,
  camps,
  selectedCampId,
  selectCamp,
  vehicles,
  assignVehicle,
  routeResult,
  calculateRoute,
  resetAll,
  blockedRoadCount,
  availableVehicles,
  totalCampCapacity,
  onCalculateEmergencyRoute,
  onPlanEvacuation,
  evacuationResult,
  disasterZone,
  onSetDisasterZone,
  shelters,
  layerToggles,
  onToggleLayer,
  graphStats,
  osmNodeCount,
  osmEdgeCount,
  debugMode,
  onToggleDebugMode,
  // B-level routing props
  roadLevels = {},
  routeMode,
  onSetRouteMode,
  customStart,
  customEnd,
  locationSelectMode,
  onSetLocationSelectMode,
  onCalculateCustomRoute,
  customRouteResult,
  onClearCustomRoute,
  osmNodesMap,
  osmEdges,
  onSetCustomStart,
  onSetCustomEnd,
  userDisasters = [],
  onAddUserDisaster,
  onUpdateUserDisaster,
  onDeleteUserDisaster,
  disasterPlaceMode,
  disasterPlaceType,
  onSetDisasterPlaceMode,
  onSetDisasterPlaceType,
  selectedRoadEdge,
  onApplyLevelToSelectedRoad,
  onClearRoadSelection,
}) {
  const [emergencyStart, setEmergencyStart] = useState('');
  const [emergencyDest, setEmergencyDest] = useState('');
  const [activeSection, setActiveSection] = useState('routing');

  const toggleSection = (section) => {
    setActiveSection(prev => prev === section ? null : section);
  };

  // Count classified roads
  const classifiedCount = Object.keys(roadLevels).filter(k => !k.includes('->')).length +
    Object.keys(roadLevels).filter(k => k.includes('->')).length / 2;
  const levelCounts = { B0: 0, B1: 0, B2: 0, B3: 0 };
  const seen = new Set();
  for (const [key, lvl] of Object.entries(roadLevels)) {
    const canonical = key.split('->').sort().join('->');
    if (!seen.has(canonical)) { seen.add(canonical); levelCounts[lvl] = (levelCounts[lvl] || 0) + 1; }
  }

  const modeInfo = ROUTE_MODES.find(m => m.key === routeMode) || ROUTE_MODES[0];

  return (
    <aside className="control-panel">
      {/* -- Status Cards -- */}
      <div className="status-grid animate-slide-up">
        <div className="status-card danger">
          <div className="status-icon">🚨</div>
          <div className="status-value">{activeIncident ? 1 : 0}</div>
          <div className="status-label">Incidents</div>
        </div>
        <div className="status-card warning">
          <div className="status-icon">🚧</div>
          <div className="status-value">{blockedRoadCount}</div>
          <div className="status-label">Roads Blocked</div>
        </div>
        <div className="status-card success">
          <div className="status-icon">🚑</div>
          <div className="status-value">{availableVehicles}</div>
          <div className="status-label">Vehicles Ready</div>
        </div>
        <div className="status-card info">
          <div className="status-icon">⛺</div>
          <div className="status-value">{totalCampCapacity}</div>
          <div className="status-label">Camp Spots</div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* == NEW: B-level Route Planning Section == */}
      {/* ================================================================ */}
      <div className="card animate-slide-up" style={{ border: '1px solid rgba(168,85,247,0.35)', background: 'linear-gradient(135deg, rgba(168,85,247,0.08) 0%, rgba(99,102,241,0.05) 100%)' }}>
        <div className="card-header" onClick={() => toggleSection('routing')} style={{ cursor: 'pointer' }}>
          <span className="card-title">
            <span className="icon">🗺️</span>
            Route Planning
          </span>
          <span className="section-toggle">{activeSection === 'routing' ? '▼' : '▶'}</span>
        </div>
        {activeSection === 'routing' && (
          <>
            {/* Routing Mode Selector */}
            <div style={{ marginBottom: 12 }}>
              <div className="field-label" style={{ marginBottom: 6 }}>Routing Mode</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ROUTE_MODES.map(mode => (
                  <button
                    key={mode.key}
                    className={`route-mode-btn ${routeMode === mode.key ? 'active' : ''}`}
                    style={{
                      '--mode-color': mode.color,
                      borderColor: routeMode === mode.key ? mode.color : 'rgba(99,122,169,0.2)',
                      background: routeMode === mode.key ? `rgba(${mode.color === '#3b82f6' ? '59,130,246' : mode.color === '#eab308' ? '234,179,8' : '34,197,94'},0.15)` : 'rgba(255,255,255,0.03)',
                    }}
                    onClick={() => onSetRouteMode && onSetRouteMode(mode.key)}
                    id={`route-mode-${mode.key}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{mode.icon}</span>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: routeMode === mode.key ? mode.color : 'var(--text-primary)' }}>{mode.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.3 }}>{mode.desc}</div>
                      </div>
                    </div>
                    {routeMode === mode.key && (
                      <span style={{ marginLeft: 'auto', color: mode.color, fontSize: 14 }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Location Selection */}
            <div style={{ marginBottom: 10 }}>
              <div className="field-label" style={{ marginBottom: 6 }}>Locations</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Start */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <div style={{
                    flex: 1, padding: '7px 10px', borderRadius: 8,
                    background: customStart ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${customStart ? '#3b82f6' : 'rgba(99,122,169,0.2)'}`,
                    fontSize: 11, color: customStart ? '#93c5fd' : 'var(--text-muted)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {customStart ? `📍 ${customStart.label}` : 'No start selected'}
                  </div>
                  <button
                    className={`btn-icon-sm ${locationSelectMode === 'start' ? 'active-select' : ''}`}
                    onClick={() => onSetLocationSelectMode && onSetLocationSelectMode(locationSelectMode === 'start' ? null : 'start')}
                    title="Click map to set start"
                    id="pick-start-btn"
                    style={{
                      background: locationSelectMode === 'start' ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.1)',
                      border: '1px solid #3b82f6', color: '#3b82f6',
                      borderRadius: 8, padding: '6px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {locationSelectMode === 'start' ? '⏳' : '📍'} Pick
                  </button>
                </div>

                {/* Destination */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <div style={{
                    flex: 1, padding: '7px 10px', borderRadius: 8,
                    background: customEnd ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${customEnd ? '#22c55e' : 'rgba(99,122,169,0.2)'}`,
                    fontSize: 11, color: customEnd ? '#86efac' : 'var(--text-muted)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {customEnd ? `🏁 ${customEnd.label}` : 'No destination selected'}
                  </div>
                  <button
                    className={`btn-icon-sm ${locationSelectMode === 'end' ? 'active-select' : ''}`}
                    onClick={() => onSetLocationSelectMode && onSetLocationSelectMode(locationSelectMode === 'end' ? null : 'end')}
                    title="Click map to set destination"
                    id="pick-end-btn"
                    style={{
                      background: locationSelectMode === 'end' ? 'rgba(34,197,94,0.3)' : 'rgba(34,197,94,0.1)',
                      border: '1px solid #22c55e', color: '#22c55e',
                      borderRadius: 8, padding: '6px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {locationSelectMode === 'end' ? '⏳' : '🏁'} Pick
                  </button>
                </div>
              </div>
              {locationSelectMode && (
                <div style={{ marginTop: 6, fontSize: 11, color: '#a855f7', fontWeight: 600, textAlign: 'center' }}>
                  Click anywhere on the map to set your {locationSelectMode === 'start' ? 'start' : 'destination'}
                </div>
              )}
            </div>

            {/* Calculate Button */}
            <button
              className="btn btn-primary btn-block"
              onClick={() => onCalculateCustomRoute && onCalculateCustomRoute()}
              disabled={!customStart || !customEnd}
              id="calculate-custom-route-btn"
              style={{ background: `linear-gradient(135deg, #7c3aed, #a855f7)`, border: 'none', marginBottom: 6 }}
            >
              <span style={{ marginRight: 6 }}>{modeInfo.icon}</span>
              Calculate {modeInfo.label}
            </button>

            {customStart && (
              <button
                className="btn btn-block"
                onClick={() => onClearCustomRoute && onClearCustomRoute()}
                id="clear-custom-route-btn"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 11, padding: '5px 10px' }}
              >
                Clear Locations & Route
              </button>
            )}

            {/* Custom Route Result */}
            {customRouteResult && !customRouteResult.error && (
              <div className="route-info animate-slide-up" style={{ marginTop: 10, borderColor: 'rgba(168,85,247,0.35)' }}>
                <div className="route-title" style={{ color: '#a855f7' }}>
                  {modeInfo.icon} {ROUTE_MODES.find(m => m.key === customRouteResult.mode)?.label || 'Route'} Found
                </div>
                <div className="route-stats">
                  <div className="route-stat">
                    <div className="stat-value">{customRouteResult.distance}m</div>
                    <div className="stat-label">Distance</div>
                  </div>
                  <div className="route-stat">
                    <div className="stat-value">{customRouteResult.travelTime} min</div>
                    <div className="stat-label">Est. Time</div>
                  </div>
                </div>
                {/* Level composition */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {customRouteResult.levelCounts?.B0 > 0 && (
                    <span className="road-level-badge b0">{customRouteResult.levelCounts.B0} B0 segments</span>
                  )}
                  {customRouteResult.levelCounts?.B1 > 0 && (
                    <span className="road-level-badge b1">{customRouteResult.levelCounts.B1} B1 segments</span>
                  )}
                  {customRouteResult.levelCounts?.B2 > 0 && (
                    <span className="road-level-badge b2">{customRouteResult.levelCounts.B2} B2 segments</span>
                  )}
                </div>
                <div className="route-roads" style={{ marginTop: 6 }}>
                  {customRouteResult.roads?.slice(0, 5).map((road, i) => (
                    <span key={i} className="route-road-tag">{road}</span>
                  ))}
                  {customRouteResult.roads?.length > 5 && <span className="route-road-tag">+{customRouteResult.roads.length - 5} more</span>}
                </div>
              </div>
            )}

            {customRouteResult?.error && (
              <div className="no-route-warning animate-slide-up" style={{ marginTop: 10 }}>
                <div className="warning-icon">⛔</div>
                <div className="warning-text">No Route Available</div>
                <div className="warning-hint">{customRouteResult.message}</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ================================================================ */}
      {/* == NEW: Road Impact Levels Section == */}
      {/* ================================================================ */}
      <div className="card animate-slide-up">
        <div className="card-header" onClick={() => toggleSection('levels')} style={{ cursor: 'pointer' }}>
          <span className="card-title">
            <span className="icon">🚦</span>
            Road Impact Levels
          </span>
          <span className="section-toggle">{activeSection === 'levels' ? '▼' : '▶'}</span>
        </div>
        {activeSection === 'levels' && (
          <>
            {/* Level legend */}
            <div style={{ marginBottom: 10 }}>
              {Object.entries(ROAD_LEVELS).map(([key, val]) => (
                <div key={key} className="road-level-legend-row">
                  <div className="road-level-dot" style={{ background: val.color }}></div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, color: val.color, fontSize: 12 }}>{key}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 6 }}>{val.description}</span>
                  </div>
                  <span className="road-level-count" style={{ color: val.color }}>
                    {levelCounts[key] || 0}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 10px', background: 'rgba(56,189,248,0.05)', borderRadius: 8, border: '1px solid rgba(56,189,248,0.12)' }}>
              <strong style={{ color: 'var(--text-accent)' }}>How to classify:</strong><br />
              Click any road segment on the map, then pick a level (B0–B3) in the popup.
            </div>
            {Object.keys(roadLevels).length > 0 && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{Math.ceil(Object.keys(roadLevels).filter(k => k.includes('->')).length / 2)}</strong> road segment(s) classified
              </div>
            )}
          </>
        )}
      </div>

      {/* ================================================================ */}
      {/* == Road Condition Editor (selected road segment) == */}
      {/* ================================================================ */}
      <div className="card animate-slide-up" style={{ border: '1px solid rgba(56,189,248,0.25)', background: 'linear-gradient(135deg,rgba(56,189,248,0.06) 0%,rgba(14,165,233,0.03) 100%)' }}>
        <div className="card-header" onClick={() => toggleSection('roadcond')} style={{ cursor: 'pointer' }}>
          <span className="card-title">
            <span className="icon">🛤️</span>
            Road Condition Editor
          </span>
          <span className="section-toggle">{activeSection === 'roadcond' ? '▼' : '▶'}</span>
        </div>
        {activeSection === 'roadcond' && (
          <>
            {/* Instructions when nothing selected */}
            {!selectedRoadEdge && (
              <div style={{ padding: '10px 12px', background: 'rgba(56,189,248,0.06)', borderRadius: 8, border: '1px dashed rgba(56,189,248,0.25)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                <strong style={{ color: '#38bdf8' }}>Click any road</strong> on the map to select it, then set its B0–B3 condition here or directly in the popup.
              </div>
            )}

            {/* Selected road details */}
            {selectedRoadEdge && (
              <div className="selected-road-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {selectedRoadEdge.level === 'B3' ? '🚫' : selectedRoadEdge.level === 'B2' ? '🟠' : selectedRoadEdge.level === 'B1' ? '🟡' : '🟢'} {selectedRoadEdge.road}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {selectedRoadEdge.distance}m segment · Current:{' '}
                      <strong style={{ color: ROAD_LEVELS[selectedRoadEdge.level]?.color || '#38bdf8' }}>
                        {selectedRoadEdge.level}
                      </strong>
                    </div>
                  </div>
                  <button
                    onClick={() => onClearRoadSelection && onClearRoadSelection()}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16, padding: '0 2px', lineHeight: 1 }}
                    title="Deselect road"
                  >✕</button>
                </div>

                {/* Current level description */}
                <div style={{ padding: '6px 10px', borderRadius: 6, marginBottom: 10, background: `${ROAD_LEVELS[selectedRoadEdge.level]?.color || '#38bdf8'}18`, border: `1px solid ${ROAD_LEVELS[selectedRoadEdge.level]?.color || '#38bdf8'}40` }}>
                  <span style={{ fontSize: 11, color: ROAD_LEVELS[selectedRoadEdge.level]?.color || '#38bdf8' }}>
                    {ROAD_LEVELS[selectedRoadEdge.level]?.description || 'Clear, safe road'}
                  </span>
                </div>

                {/* B-level buttons */}
                <div className="field-label" style={{ marginBottom: 6 }}>Set Road Condition:</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {Object.entries(ROAD_LEVELS).map(([lvl, info]) => (
                    <button
                      key={lvl}
                      id={`road-level-btn-${lvl}`}
                      onClick={() => onApplyLevelToSelectedRoad && onApplyLevelToSelectedRoad(lvl)}
                      style={{
                        padding: '8px 6px', borderRadius: 7, fontSize: 11, fontWeight: 800,
                        background: selectedRoadEdge.level === lvl ? info.color : `${info.color}15`,
                        color: selectedRoadEdge.level === lvl ? '#fff' : info.color,
                        border: `2px solid ${selectedRoadEdge.level === lvl ? info.color : info.color + '50'}`,
                        cursor: 'pointer', transition: 'all 0.18s ease',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                      }}
                    >
                      <span style={{ fontSize: 15 }}>
                        {lvl === 'B0' ? '🟢' : lvl === 'B1' ? '🟡' : lvl === 'B2' ? '🟠' : '🚫'}
                      </span>
                      <span>{lvl}</span>
                      <span style={{ fontSize: 9, fontWeight: 400, opacity: 0.8 }}>{info.description.split(',')[0]}</span>
                    </button>
                  ))}
                </div>

                {/* Associate with a user disaster */}
                {userDisasters.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div className="field-label" style={{ marginBottom: 4 }}>Link disaster marker:</div>
                    <select
                      className="select"
                      style={{ fontSize: 11 }}
                      defaultValue=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const disaster = userDisasters.find(d => d.id === e.target.value);
                        if (disaster && onUpdateUserDisaster) {
                          onUpdateUserDisaster(disaster.id, {
                            affectedEdge: {
                              from: selectedRoadEdge.from,
                              to: selectedRoadEdge.to,
                              road: selectedRoadEdge.road,
                              level: selectedRoadEdge.level,
                            }
                          });
                        }
                        e.target.value = '';
                      }}
                    >
                      <option value="">Link to disaster marker...</option>
                      {userDisasters.map(d => {
                        const dt = DISASTER_TYPES[d.type] || {};
                        return <option key={d.id} value={d.id}>{dt.icon} {dt.label} @ {d.lat.toFixed(4)}, {d.lng.toFixed(4)}</option>;
                      })}
                    </select>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ================================================================ */}
      {/* == User-Placed Disaster Markers == */}
      {/* ================================================================ */}
      <div className="card animate-slide-up" style={{ border: '1px solid rgba(239,68,68,0.25)', background: 'linear-gradient(135deg,rgba(239,68,68,0.07) 0%,rgba(245,158,11,0.04) 100%)' }}>
        <div className="card-header" onClick={() => toggleSection('userDisasters')} style={{ cursor: 'pointer' }}>
          <span className="card-title">
            <span className="icon">📍</span>
            Place Disaster Markers
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {userDisasters.length > 0 && (
              <span style={{ background: '#ef4444', color: '#fff', borderRadius: '50%', fontSize: 10, fontWeight: 800, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {userDisasters.length}
              </span>
            )}
            <span className="section-toggle">{activeSection === 'userDisasters' ? '▼' : '▶'}</span>
          </div>
        </div>
        {activeSection === 'userDisasters' && (
          <>
            {/* Disaster type selector */}
            <div style={{ marginBottom: 10 }}>
              <div className="field-label" style={{ marginBottom: 6 }}>Disaster Type</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                {Object.entries(DISASTER_TYPES).map(([key, dt]) => (
                  <button
                    key={key}
                    id={`disaster-type-${key}`}
                    onClick={() => onSetDisasterPlaceType && onSetDisasterPlaceType(key)}
                    style={{
                      padding: '7px 5px', borderRadius: 7, fontSize: 10, fontWeight: 700,
                      background: disasterPlaceType === key ? `${dt.color}25` : 'rgba(255,255,255,0.03)',
                      color: disasterPlaceType === key ? dt.color : 'var(--text-muted)',
                      border: `1.5px solid ${disasterPlaceType === key ? dt.color : 'rgba(99,122,169,0.2)'}`,
                      cursor: 'pointer', transition: 'all 0.15s',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{dt.icon}</span>
                    <span style={{ textAlign: 'center', lineHeight: 1.2 }}>{dt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Suggested level info */}
            {disasterPlaceType && DISASTER_TYPES[disasterPlaceType] && (
              <div style={{ padding: '6px 10px', borderRadius: 6, marginBottom: 10, fontSize: 11, background: `${DISASTER_TYPES[disasterPlaceType].color}15`, border: `1px solid ${DISASTER_TYPES[disasterPlaceType].color}40` }}>
                <span style={{ color: DISASTER_TYPES[disasterPlaceType].color }}>
                  Suggested road condition: <strong>{DISASTER_TYPES[disasterPlaceType].suggestedLevel}</strong>
                </span>
                <br />
                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{DISASTER_TYPES[disasterPlaceType].description}</span>
              </div>
            )}

            {/* Place button */}
            <button
              id="place-disaster-btn"
              className={`btn btn-block ${disasterPlaceMode ? 'btn-danger' : ''}`}
              onClick={() => onSetDisasterPlaceMode && onSetDisasterPlaceMode(!disasterPlaceMode)}
              style={{
                marginBottom: 10,
                background: disasterPlaceMode
                  ? 'rgba(239,68,68,0.25)'
                  : `linear-gradient(135deg, ${DISASTER_TYPES[disasterPlaceType]?.color || '#ef4444'}cc, ${DISASTER_TYPES[disasterPlaceType]?.color || '#ef4444'})`,
                border: disasterPlaceMode ? '1.5px solid #ef4444' : 'none',
                color: '#fff',
                fontWeight: 700,
                animation: disasterPlaceMode ? 'pickPulse 1.4s infinite' : 'none',
              }}
            >
              {disasterPlaceMode
                ? `⏳ Click map to place ${DISASTER_TYPES[disasterPlaceType]?.label}…`
                : `${DISASTER_TYPES[disasterPlaceType]?.icon || '📍'} Place ${DISASTER_TYPES[disasterPlaceType]?.label || 'Marker'}`}
            </button>

            {/* List of placed disasters */}
            {userDisasters.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                No disaster markers placed yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {userDisasters.map(disaster => {
                  const dt = DISASTER_TYPES[disaster.type] || {};
                  return (
                    <div key={disaster.id} className="disaster-marker-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{dt.icon}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 11, color: dt.color || '#f87171', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {dt.label}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            {disaster.lat.toFixed(4)}, {disaster.lng.toFixed(4)}
                          </div>
                          {disaster.affectedEdge && (
                            <div style={{ fontSize: 10, color: ROAD_LEVELS[disaster.affectedEdge.level]?.color || '#f87171' }}>
                              Road: {disaster.affectedEdge.road} → {disaster.affectedEdge.level}
                            </div>
                          )}
                          {disaster.note && (
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                              {disaster.note}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                        {/* Quick apply suggested level to selected road */}
                        {selectedRoadEdge && (
                          <button
                            title={`Apply ${dt.suggestedLevel} to selected road`}
                            onClick={() => {
                              if (onApplyLevelToSelectedRoad) onApplyLevelToSelectedRoad(dt.suggestedLevel);
                              if (onUpdateUserDisaster) onUpdateUserDisaster(disaster.id, {
                                affectedEdge: { from: selectedRoadEdge.from, to: selectedRoadEdge.to, road: selectedRoadEdge.road, level: dt.suggestedLevel }
                              });
                            }}
                            style={{
                              padding: '3px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                              background: `${ROAD_LEVELS[dt.suggestedLevel]?.color}20`,
                              color: ROAD_LEVELS[dt.suggestedLevel]?.color,
                              border: `1px solid ${ROAD_LEVELS[dt.suggestedLevel]?.color}50`,
                            }}
                          >Apply {dt.suggestedLevel}</button>
                        )}
                        <button
                          onClick={() => onDeleteUserDisaster && onDeleteUserDisaster(disaster.id)}
                          style={{ padding: '3px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, cursor: 'pointer', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                        >🗑️</button>
                      </div>
                    </div>
                  );
                })}

                {/* Clear all */}
                <button
                  onClick={() => userDisasters.forEach(d => onDeleteUserDisaster && onDeleteUserDisaster(d.id))}
                  style={{ marginTop: 4, padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                >Clear All Markers</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* -- Graph Network Stats -- */}
      {graphStats && (
        <div className="card animate-slide-up graph-stats-card">
          <div className="card-header" onClick={() => toggleSection('graph')} style={{ cursor: 'pointer' }}>
            <span className="card-title">
              <span className="icon">📊</span>
              Road Network
            </span>
            <span className="section-toggle">{activeSection === 'graph' ? '▼' : '▶'}</span>
          </div>
          {activeSection === 'graph' && (
            <div className="graph-stats">
              <div className="stat-row">
                <span className="stat-key">🗺️ OSM Road Nodes</span>
                <span className="stat-val" style={{ color: '#38bdf8', fontWeight: 700 }}>{osmNodeCount || graphStats.totalNodes}</span>
              </div>
              <div className="stat-row">
                <span className="stat-key">🛣️ OSM Road Edges</span>
                <span className="stat-val" style={{ color: '#38bdf8', fontWeight: 700 }}>{osmEdgeCount || '—'}</span>
              </div>
              <div className="stat-row">
                <span className="stat-key">Graph Connected</span>
                <span className="stat-val" style={{ color: graphStats.connected ? '#22c55e' : '#ef4444' }}>
                  {graphStats.connected ? '✅ Yes' : `⚠️ ${graphStats.components} parts`}
                </span>
              </div>
              <div className="stat-row">
                <span className="stat-key">Blocked Roads</span>
                <span className="stat-val" style={{ color: blockedRoadCount > 0 ? '#ef4444' : '#22c55e' }}>
                  {blockedRoadCount}
                </span>
              </div>
              {/* Debug Mode Toggle */}
              <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(56,189,248,0.15)' }}>
                <button
                  onClick={onToggleDebugMode}
                  style={{
                    width: '100%', padding: '6px 10px', borderRadius: '6px',
                    border: `1px solid ${debugMode ? '#f97316' : 'rgba(56,189,248,0.25)'}`,
                    background: debugMode ? 'rgba(249,115,22,0.15)' : 'rgba(56,189,248,0.08)',
                    color: debugMode ? '#f97316' : '#94a3b8',
                    fontSize: '11px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span>{debugMode ? '🔴' : '🔵'}</span>
                  <span>{debugMode ? 'Debug ON — OSM nodes visible' : 'Debug Mode OFF'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* -- Disaster Simulation -- */}
      <div className="card animate-slide-up">
        <div className="card-header" onClick={() => toggleSection('disaster')} style={{ cursor: 'pointer' }}>
          <span className="card-title">
            <span className="icon">⚡</span>
            Simulate Disaster
          </span>
          <span className="section-toggle">{activeSection === 'disaster' ? '▼' : '▶'}</span>
        </div>
        {activeSection === 'disaster' && (
          <div className="disaster-buttons">
            {Object.entries(DISASTER_SCENARIOS).map(([key, scenario]) => (
              <button
                key={key}
                className={`disaster-btn ${activeIncident?.type === key ? 'active' : ''}`}
                onClick={() => simulateDisaster(key)}
                id={`disaster-btn-${key}`}
              >
                <span className="disaster-icon">{scenario.icon}</span>
                {scenario.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* -- Active Incident -- */}
      {activeIncident && (
        <div className="card animate-slide-up">
          <div className="card-header">
            <span className="card-title">
              <span className="icon">📋</span>
              Active Incident
            </span>
          </div>
          <div className={`incident-panel active`}>
            <div className="incident-info">
              <div className="info-row">
                <span className="info-label">Type</span>
                <span className="info-value">{activeIncident.icon} {activeIncident.label}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Time</span>
                <span className="info-value">{activeIncident.timestamp}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Severity</span>
                <span className="info-value" style={{
                  color: activeIncident.severity === 'critical' ? '#ef4444' :
                    activeIncident.severity === 'high' ? '#f59e0b' : '#3b82f6'
                }}>
                  {(activeIncident.severity || 'medium').toUpperCase()}
                </span>
              </div>
              {activeIncident.affectedPopulation > 0 && (
                <div className="info-row">
                  <span className="info-label">Affected</span>
                  <span className="info-value" style={{ color: '#ef4444' }}>
                    ~{activeIncident.affectedPopulation} people
                  </span>
                </div>
              )}
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {activeIncident.description}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* -- Emergency Vehicle Routing -- */}
      <div className="card animate-slide-up">
        <div className="card-header" onClick={() => toggleSection('emergency')} style={{ cursor: 'pointer' }}>
          <span className="card-title">
            <span className="icon">🚑</span>
            Emergency Vehicle Routing
          </span>
          <span className="section-toggle">{activeSection === 'emergency' ? '▼' : '▶'}</span>
        </div>
        {activeSection === 'emergency' && (
          <>
            <div style={{ marginBottom: '8px' }}>
              <label className="field-label">Starting Location</label>
              <select
                className="select"
                value={emergencyStart}
                onChange={e => setEmergencyStart(e.target.value)}
                id="emergency-start-select"
              >
                <option value="">Select start point...</option>
                {NODE_OPTIONS.map(n => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.type.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label className="field-label">Destination / Disaster Location</label>
              <select
                className="select"
                value={emergencyDest}
                onChange={e => setEmergencyDest(e.target.value)}
                id="emergency-dest-select"
              >
                <option value="">
                  {activeIncident ? `Auto — Incident Location` : 'Select destination...'}
                </option>
                {NODE_OPTIONS.map(n => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.type.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>

            <button
              className="btn btn-primary btn-block"
              onClick={() => {
                if (onCalculateEmergencyRoute) {
                  onCalculateEmergencyRoute(emergencyStart || null, emergencyDest || null);
                }
              }}
              disabled={!emergencyStart && !activeIncident}
              id="find-emergency-route-btn"
            >
              🔍 Find Emergency Route
            </button>

            {/* Route result */}
            {routeResult && !routeResult.error && (
              <div className="route-info animate-slide-up" style={{ marginTop: '12px' }}>
                <div className="route-title">✅ Route Found</div>
                <div className="route-stats">
                  <div className="route-stat">
                    <div className="stat-value">{routeResult.distance}m</div>
                    <div className="stat-label">Distance</div>
                  </div>
                  <div className="route-stat">
                    <div className="stat-value">{routeResult.travelTime} min</div>
                    <div className="stat-label">Est. Time</div>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  To: <strong style={{ color: 'var(--text-primary)' }}>{routeResult.toCamp?.name || routeResult.toNodeName || 'Destination'}</strong>
                </div>
                <div className="route-roads">
                  {routeResult.roads.map((road, i) => (
                    <span key={i} className="route-road-tag">{road}</span>
                  ))}
                </div>
              </div>
            )}

            {routeResult?.error && (
              <div className="no-route-warning animate-slide-up" style={{ marginTop: '12px' }}>
                <div className="warning-icon">⛔</div>
                <div className="warning-text">No Route Available</div>
                <div className="warning-hint">{routeResult.message || 'All paths are blocked or destination is unreachable.'}</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* -- Evacuation Planning -- */}
      <div className="card animate-slide-up">
        <div className="card-header" onClick={() => toggleSection('evacuation')} style={{ cursor: 'pointer' }}>
          <span className="card-title">
            <span className="icon">🏃</span>
            Evacuation Planning
          </span>
          <span className="section-toggle">{activeSection === 'evacuation' ? '▼' : '▶'}</span>
        </div>
        {activeSection === 'evacuation' && (
          <>
            <button
              className="btn btn-success btn-block"
              onClick={() => onPlanEvacuation && onPlanEvacuation()}
              disabled={!activeIncident}
              id="plan-evacuation-btn"
            >
              🏃 Plan Evacuation Routes
            </button>

            {!activeIncident && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'center' }}>
                Simulate a disaster first to plan evacuation
              </div>
            )}

            {/* Evacuation Results */}
            {evacuationResult && evacuationResult.length > 0 && (
              <div className="evacuation-results animate-slide-up" style={{ marginTop: '12px' }}>
                <div className="evac-header">
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#22c55e' }}>
                    🟢 {evacuationResult.filter(r => r.route).length} Evacuation Routes
                  </span>
                </div>

                {evacuationResult.map((er, idx) => (
                  <div key={idx} className={`evac-item ${er.error ? 'error' : ''}`}>
                    <div className="evac-from">
                      <span className="evac-label">From:</span> {er.zone?.name || 'Unknown'}
                      <span className="evac-pop">({er.assignedPopulation || er.unassigned || 0} people)</span>
                    </div>
                    {er.shelter && (
                      <div className="evac-to">
                        <span className="evac-label">To:</span> {er.shelter.name}
                      </div>
                    )}
                    {er.route && (
                      <div className="evac-dist">
                        {er.route.distance}m · ~{er.route.travelTime}s
                      </div>
                    )}
                    {er.error && (
                      <div className="evac-error">⚠️ {er.error}</div>
                    )}
                  </div>
                ))}

                <div className="evac-summary">
                  <div className="info-row">
                    <span className="info-label">Total Evacuees</span>
                    <span className="info-value">
                      {evacuationResult.reduce((sum, r) => sum + (r.assignedPopulation || 0), 0)}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Shelters Used</span>
                    <span className="info-value">
                      {new Set(evacuationResult.filter(r => r.shelter).map(r => r.shelter.id)).size}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* -- Route Optimization (legacy — auto route to camps) -- */}
      <div className="card animate-slide-up">
        <div className="card-header" onClick={() => toggleSection('routeopt')} style={{ cursor: 'pointer' }}>
          <span className="card-title">
            <span className="icon">🗺️</span>
            Route to Camp
          </span>
          <span className="section-toggle">{activeSection === 'routeopt' ? '▼' : '▶'}</span>
        </div>
        {activeSection === 'routeopt' && (
          <>
            <div style={{ marginBottom: '10px' }}>
              <select
                className="select"
                value={selectedCampId || ''}
                onChange={e => selectCamp(e.target.value || null)}
                id="camp-selector"
              >
                <option value="">Auto — Nearest Camp</option>
                {camps.map(camp => (
                  <option key={camp.id} value={camp.id} disabled={camp.occupancy >= camp.capacity}>
                    {camp.name} {camp.occupancy >= camp.capacity ? '(FULL)' : `(${camp.capacity - camp.occupancy} spots)`}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="btn btn-primary btn-block"
              onClick={() => calculateRoute(selectedCampId)}
              disabled={!activeIncident}
              id="calculate-route-btn"
            >
              🔍 Calculate Optimal Route
            </button>
          </>
        )}
      </div>

      {/* -- Road Blockage Management -- */}
      <div className="card animate-slide-up">
        <div className="card-header" onClick={() => toggleSection('roads')} style={{ cursor: 'pointer' }}>
          <span className="card-title">
            <span className="icon">🚧</span>
            Road Management
          </span>
          <span className="section-toggle">{activeSection === 'roads' ? '▼' : '▶'}</span>
        </div>
        {activeSection === 'roads' && (
          <div className="road-list">
            {EDGES.filter((e, i, arr) => {
              return arr.findIndex(x => x.road === e.road) === i;
            }).map((edge, idx) => {
              const isBlocked = blockedEdges.has(`${edge.from}->${edge.to}`);
              return (
                <div key={idx} className={`road-item ${isBlocked ? 'blocked' : ''}`}>
                  <span className="road-name">{edge.road}</span>
                  <span className={`road-status ${isBlocked ? 'closed' : 'open'}`}>
                    {isBlocked ? 'Blocked' : 'Open'}
                  </span>
                  <button
                    className={`road-toggle-btn ${isBlocked ? 'unblock' : ''}`}
                    onClick={() => toggleRoadBlock(edge.from, edge.to)}
                    id={`road-toggle-${idx}`}
                  >
                    {isBlocked ? 'Reopen' : 'Block'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* -- Shelter Management -- */}
      <div className="card animate-slide-up">
        <div className="card-header" onClick={() => toggleSection('shelters')} style={{ cursor: 'pointer' }}>
          <span className="card-title">
            <span className="icon">🟣</span>
            Evacuation Shelters
          </span>
          <span className="section-toggle">{activeSection === 'shelters' ? '▼' : '▶'}</span>
        </div>
        {activeSection === 'shelters' && (
          <div className="shelter-list">
            {(shelters || SHELTERS).map(shelter => {
              const percent = (shelter.currentOccupancy / shelter.capacity) * 100;
              const isFull = shelter.currentOccupancy >= shelter.capacity;
              const fillClass = percent > 80 ? 'high' : percent > 50 ? 'medium' : 'low';

              return (
                <div key={shelter.id} className={`shelter-item ${isFull ? 'full' : ''}`}>
                  <div className="shelter-header">
                    <span className="shelter-name">
                      {shelter.type === 'medical' ? '🏥' : '🟣'} {shelter.name}
                    </span>
                    <span className={`camp-badge ${isFull ? 'full' : 'active'}`}>
                      {shelter.type.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="camp-capacity-bar">
                    <div
                      className={`camp-capacity-fill ${fillClass}`}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>
                  <div className="camp-stats">
                    <span>{shelter.currentOccupancy} / {shelter.capacity}</span>
                    <span>{shelter.capacity - shelter.currentOccupancy} available</span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {shelter.facilities.join(' · ')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* -- Relief Camp Management -- */}
      <div className="card animate-slide-up">
        <div className="card-header" onClick={() => toggleSection('camps')} style={{ cursor: 'pointer' }}>
          <span className="card-title">
            <span className="icon">⛺</span>
            Relief Camps
          </span>
          <span className="section-toggle">{activeSection === 'camps' ? '▼' : '▶'}</span>
        </div>
        {activeSection === 'camps' && (
          <div className="camp-list">
            {camps.map(camp => {
              const percent = (camp.occupancy / camp.capacity) * 100;
              const isFull = camp.occupancy >= camp.capacity;
              const fillClass = percent > 80 ? 'high' : percent > 50 ? 'medium' : 'low';
              const isSelected = selectedCampId === camp.id;

              return (
                <div
                  key={camp.id}
                  className={`camp-item ${isFull ? 'full' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => !isFull && selectCamp(camp.id)}
                  style={{ cursor: isFull ? 'not-allowed' : 'pointer' }}
                  id={`camp-${camp.id}`}
                >
                  <div className="camp-header">
                    <span className="camp-name">⛺ {camp.name}</span>
                    <span className={`camp-badge ${isFull ? 'full' : 'active'}`}>
                      {isFull ? 'FULL' : 'Active'}
                    </span>
                  </div>
                  <div className="camp-capacity-bar">
                    <div
                      className={`camp-capacity-fill ${fillClass}`}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>
                  <div className="camp-stats">
                    <span>{camp.occupancy} / {camp.capacity}</span>
                    <span>{camp.capacity - camp.occupancy} available</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* -- Rescue Vehicle Management -- */}
      <div className="card animate-slide-up">
        <div className="card-header" onClick={() => toggleSection('vehicles')} style={{ cursor: 'pointer' }}>
          <span className="card-title">
            <span className="icon">🚑</span>
            Rescue Vehicles
          </span>
          <span className="section-toggle">{activeSection === 'vehicles' ? '▼' : '▶'}</span>
        </div>
        {activeSection === 'vehicles' && (
          <div className="vehicle-list">
            {vehicles.map(vehicle => (
              <div key={vehicle.id} className="vehicle-item" id={`vehicle-${vehicle.id}`}>
                <span className="vehicle-icon">
                  {VEHICLE_ICONS[vehicle.type] || '🚗'}
                </span>
                <div className="vehicle-info">
                  <div className="vehicle-name">{vehicle.name}</div>
                  <div className="vehicle-type">
                    {vehicle.type.replace('_', ' ')} · {vehicle.speed} km/h
                  </div>
                </div>
                <span className={`vehicle-status ${vehicle.status}`}>
                  {vehicle.status === 'enroute' ? 'En Route' : vehicle.status}
                </span>
                {vehicle.status === 'available' && (
                  <button
                    className="assign-btn"
                    onClick={() => assignVehicle(vehicle.id)}
                    disabled={!routeResult || routeResult.error}
                    id={`assign-vehicle-${vehicle.id}`}
                  >
                    Dispatch
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* -- Map Layer Toggles -- */}
      <div className="card animate-slide-up">
        <div className="card-header" onClick={() => toggleSection('layers')} style={{ cursor: 'pointer' }}>
          <span className="card-title">
            <span className="icon">🗂️</span>
            Map Layers
          </span>
          <span className="section-toggle">{activeSection === 'layers' ? '▼' : '▶'}</span>
        </div>
        {activeSection === 'layers' && (
          <div className="layer-toggles">
            {[
              { key: 'showNodes', label: 'Road Nodes', icon: '🔵' },
              { key: 'showEdges', label: 'Road Connections', icon: '🔗' },
              { key: 'showEmergencyRoute', label: 'Emergency Route', icon: '🔵' },
              { key: 'showEvacuationRoutes', label: 'Evacuation Routes', icon: '🟢' },
              { key: 'showDisasterZone', label: 'Disaster Zone', icon: '🔴' },
              { key: 'showShelters', label: 'Shelters', icon: '🟣' },
            ].map(toggle => (
              <label key={toggle.key} className="layer-toggle">
                <input
                  type="checkbox"
                  checked={layerToggles?.[toggle.key] !== false}
                  onChange={() => onToggleLayer && onToggleLayer(toggle.key)}
                  id={`toggle-${toggle.key}`}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-icon">{toggle.icon}</span>
                <span className="toggle-label">{toggle.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* -- Actions -- */}
      <button
        className="btn btn-danger btn-block"
        onClick={resetAll}
        id="reset-all-btn"
        style={{ marginTop: 'auto' }}
      >
        🔄 Reset System
      </button>

      {/* -- Disclaimer -- */}
      <div className="disclaimer">
        ⚠️ All data is <strong>simulated</strong> for demonstration purposes only.
        This is not a live emergency system.
      </div>
    </aside>
  );
}

export default ControlPanel;
