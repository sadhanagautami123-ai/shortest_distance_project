/**
 * campusData.js
 *
 * NIT Kurukshetra campus graph data for SAHARA.
 * Coordinates from real OpenStreetMap data.
 *
 * v2 — Road routing now uses OSM_ROAD_NODES / OSM_ROAD_EDGES from roadNetwork.js.
 * Each POI has a `roadNodeId` pointing to the nearest real OSM road node.
 * DISCLAIMER: Relief camps, vehicles, and incidents are SIMULATED for demonstration.
 */

export { OSM_ROAD_NODES, OSM_ROAD_EDGES } from './roadNetwork.js';

// NIT Kurukshetra center coordinates
export const CAMPUS_CENTER = [29.9490, 76.8180];
export const CAMPUS_BOUNDS = [
  [29.9420, 76.8090], // Southwest
  [29.9560, 76.8270]  // Northeast
];
export const DEFAULT_ZOOM = 16;
export const MIN_ZOOM = 15;
export const MAX_ZOOM = 19;

// ── NODE TYPES ──
// intersection: Road intersection/junction
// turning_point: Road corner where direction changes
// gate: Campus entrance/exit (emergency vehicle entry points)
// building: Campus building
// hostel: Student hostel
// hospital: Medical facility
// emergency_service: Fire station, police, etc.
// shelter: Evacuation shelter
// evacuation_exit: Designated evacuation exit point

// Graph nodes — POIs on NIT Kurukshetra campus with `roadNodeId` pointing
// to the nearest real OSM road node for routing purposes.
export const NODES = {
  // ═══ Main gates & entrances ═══
  mainGate:       { id: 'mainGate',       name: 'Main Gate',                lat: 29.9459, lng: 76.8178, type: 'gate',              roadNodeId: 'rn62'  },
  backGate:       { id: 'backGate',       name: 'Back Gate',                lat: 29.9525, lng: 76.8175, type: 'gate',              roadNodeId: 'rn76'  },
  sideGate:       { id: 'sideGate',       name: 'Side Gate (East)',         lat: 29.9488, lng: 76.8248, type: 'gate',              roadNodeId: 'rn159' },
  westGate:       { id: 'westGate',       name: 'West Gate',                lat: 29.9480, lng: 76.8100, type: 'gate',              roadNodeId: 'rn105' },

  // ═══ Key intersections ═══
  mainChowk:      { id: 'mainChowk',      name: 'Main Chowk',              lat: 29.9472, lng: 76.8180, type: 'intersection',     roadNodeId: 'rn101' },
  libraryChowk:   { id: 'libraryChowk',   name: 'Library Chowk',           lat: 29.9488, lng: 76.8175, type: 'intersection',     roadNodeId: 'rn125' },
  hostelChowk:    { id: 'hostelChowk',     name: 'Hostel Area Chowk',       lat: 29.9500, lng: 76.8140, type: 'intersection',     roadNodeId: 'rn81'  },
  sportChowk:     { id: 'sportChowk',      name: 'Sports Complex Chowk',    lat: 29.9510, lng: 76.8195, type: 'intersection',     roadNodeId: 'rn236' },
  canteenJn:      { id: 'canteenJn',       name: 'Canteen Junction',        lat: 29.9482, lng: 76.8200, type: 'intersection',     roadNodeId: 'rn74'  },
  workshopJn:     { id: 'workshopJn',      name: 'Workshop Junction',       lat: 29.9468, lng: 76.8210, type: 'intersection',     roadNodeId: 'rn101' },
  eastRoad:       { id: 'eastRoad',        name: 'East Road Junction',      lat: 29.9495, lng: 76.8230, type: 'intersection',     roadNodeId: 'rn148' },
  northJn:        { id: 'northJn',         name: 'North Junction',          lat: 29.9518, lng: 76.8170, type: 'intersection',     roadNodeId: 'rn117' },
  centralJn:      { id: 'centralJn',       name: 'Central Junction',        lat: 29.9492, lng: 76.8195, type: 'intersection',     roadNodeId: 'rn235' },
  southEastJn:    { id: 'southEastJn',     name: 'South-East Junction',     lat: 29.9465, lng: 76.8230, type: 'intersection',     roadNodeId: 'rn254' },
  northWestJn:    { id: 'northWestJn',     name: 'North-West Junction',     lat: 29.9515, lng: 76.8135, type: 'intersection',     roadNodeId: 'rn32'  },
  southWestJn:    { id: 'southWestJn',     name: 'South-West Junction',     lat: 29.9465, lng: 76.8120, type: 'intersection',     roadNodeId: 'rn28'  },
  academicJn:     { id: 'academicJn',      name: 'Academic Junction',       lat: 29.9490, lng: 76.8210, type: 'intersection',     roadNodeId: 'rn74'  },

  // ═══ Buildings / landmarks ═══
  adminBlock:     { id: 'adminBlock',      name: 'Admin Block',             lat: 29.9478, lng: 76.8185, type: 'building',         roadNodeId: 'rn235' },
  library:        { id: 'library',         name: 'Central Library',         lat: 29.9490, lng: 76.8168, type: 'building',         roadNodeId: 'rn10'  },
  lectureHall:    { id: 'lectureHall',     name: 'Lecture Hall Complex',    lat: 29.9485, lng: 76.8210, type: 'building',         roadNodeId: 'rn74'  },
  cseBlock:       { id: 'cseBlock',        name: 'CSE Department',          lat: 29.9498, lng: 76.8215, type: 'building',         roadNodeId: 'rn148' },
  eceBlock:       { id: 'eceBlock',        name: 'ECE Department',          lat: 29.9502, lng: 76.8205, type: 'building',         roadNodeId: 'rn236' },
  mechBlock:      { id: 'mechBlock',       name: 'Mechanical Dept',         lat: 29.9470, lng: 76.8220, type: 'building',         roadNodeId: 'rn254' },
  sportsComplex:  { id: 'sportsComplex',   name: 'Sports Complex',          lat: 29.9515, lng: 76.8200, type: 'building',         roadNodeId: 'rn147' },

  // ═══ Hostels ═══
  hostelA:        { id: 'hostelA',         name: 'Boys Hostel A',           lat: 29.9505, lng: 76.8130, type: 'hostel',           roadNodeId: 'rn32'  },
  hostelB:        { id: 'hostelB',         name: 'Boys Hostel B',           lat: 29.9508, lng: 76.8150, type: 'hostel',           roadNodeId: 'rn249' },
  girlsHostel:    { id: 'girlsHostel',     name: 'Girls Hostel',            lat: 29.9495, lng: 76.8120, type: 'hostel',           roadNodeId: 'rn28'  },

  // ═══ Emergency Facilities ═══
  campusHospital: { id: 'campusHospital',  name: 'Campus Health Center',    lat: 29.9484, lng: 76.8155, type: 'hospital',         roadNodeId: 'rn10'  },
  fireStation:    { id: 'fireStation',     name: 'Fire Safety Station',     lat: 29.9462, lng: 76.8170, type: 'emergency_service', roadNodeId: 'rn87'  },
  securityOffice: { id: 'securityOffice',  name: 'Security Office',         lat: 29.9460, lng: 76.8185, type: 'emergency_service', roadNodeId: 'rn62'  },

  // ═══ Evacuation Exits ═══
  evacExit1:      { id: 'evacExit1',       name: 'Evacuation Exit North',   lat: 29.9530, lng: 76.8170, type: 'evacuation_exit',  roadNodeId: 'rn117' },
  evacExit2:      { id: 'evacExit2',       name: 'Evacuation Exit South',   lat: 29.9445, lng: 76.8175, type: 'evacuation_exit',  roadNodeId: 'rn254' },
};

// Graph edges — roads connecting nodes with detailed metadata
// Each edge now includes: distance, estimated travel time, road name, direction support, vehicle restrictions
export const EDGES = [
  // ── Main Gate approach ──
  { from: 'mainGate',      to: 'securityOffice',    distance: 30,   road: 'Gate Security Road',    twoWay: true,  travelTime: 4,   vehicleRestriction: null },
  { from: 'mainGate',      to: 'mainRdBend1',       distance: 60,   road: 'Main Road',             twoWay: true,  travelTime: 7,   vehicleRestriction: null },
  { from: 'mainRdBend1',   to: 'mainRdBend2',       distance: 50,   road: 'Main Road',             twoWay: true,  travelTime: 6,   vehicleRestriction: null },
  { from: 'mainRdBend2',   to: 'mainChowk',         distance: 55,   road: 'Main Road',             twoWay: true,  travelTime: 7,   vehicleRestriction: null },
  { from: 'mainGate',      to: 'evacExit2',         distance: 170,  road: 'South Evacuation Rd',   twoWay: true,  travelTime: 20,  vehicleRestriction: null },
  { from: 'mainGate',      to: 'campusPerimeter2',  distance: 130,  road: 'South Perimeter',       twoWay: true,  travelTime: 16,  vehicleRestriction: null },

  // ── Main Chowk connections ──
  { from: 'mainChowk',     to: 'adminBlock',        distance: 90,   road: 'Admin Road',            twoWay: true,  travelTime: 11,  vehicleRestriction: null },
  { from: 'mainChowk',     to: 'fireStation',       distance: 75,   road: 'Fire Station Road',     twoWay: true,  travelTime: 9,   vehicleRestriction: null },
  { from: 'mainChowk',     to: 'southLoopBend',     distance: 50,   road: 'South Loop',            twoWay: true,  travelTime: 6,   vehicleRestriction: null },
  { from: 'southLoopBend', to: 'workshopJn',        distance: 60,   road: 'South Loop',            twoWay: true,  travelTime: 7,   vehicleRestriction: null },
  { from: 'mainChowk',     to: 'campusPerimeter1',  distance: 100,  road: 'South Perimeter',       twoWay: true,  travelTime: 12,  vehicleRestriction: null },

  // ── Admin area ──
  { from: 'adminBlock',    to: 'libraryChowk',      distance: 120,  road: 'Library Lane',          twoWay: true,  travelTime: 14,  vehicleRestriction: null },
  { from: 'adminBlock',    to: 'campusHospital',    distance: 100,  road: 'Hospital Access Rd',    twoWay: true,  travelTime: 12,  vehicleRestriction: null },

  // ── Library area ──
  { from: 'libraryChowk',  to: 'library',           distance: 40,   road: 'Library Access',        twoWay: true,  travelTime: 5,   vehicleRestriction: null },
  { from: 'libraryChowk',  to: 'centralJn',         distance: 80,   road: 'Central Road',          twoWay: true,  travelTime: 10,  vehicleRestriction: null },
  { from: 'libraryChowk',  to: 'campusHospital',    distance: 65,   road: 'Hospital Lane',         twoWay: true,  travelTime: 8,   vehicleRestriction: null },
  { from: 'libraryChowk',  to: 'hostelRdCorner1',   distance: 60,   road: 'Hostel Road',           twoWay: true,  travelTime: 7,   vehicleRestriction: null },

  // ── Hostel Road (with corners) ──
  { from: 'hostelRdCorner1', to: 'hostelRdCorner2', distance: 50,   road: 'Hostel Road',           twoWay: true,  travelTime: 6,   vehicleRestriction: null },
  { from: 'hostelRdCorner2', to: 'hostelChowk',     distance: 40,   road: 'Hostel Road',           twoWay: true,  travelTime: 5,   vehicleRestriction: null },

  // ── Central area ──
  { from: 'centralJn',     to: 'canteenJn',         distance: 70,   road: 'Canteen Road',          twoWay: true,  travelTime: 8,   vehicleRestriction: null },
  { from: 'centralJn',     to: 'cseBlock',          distance: 90,   road: 'CSE Lane',              twoWay: true,  travelTime: 11,  vehicleRestriction: null },
  { from: 'centralJn',     to: 'eastRdCorner1',     distance: 60,   road: 'East Campus Road',      twoWay: true,  travelTime: 7,   vehicleRestriction: null },
  { from: 'centralJn',     to: 'academicJn',        distance: 50,   road: 'Academic Link',         twoWay: true,  travelTime: 6,   vehicleRestriction: null },
  { from: 'centralJn',     to: 'sportChowk',        distance: 90,   road: 'Sport Central Link',    twoWay: true,  travelTime: 11,  vehicleRestriction: null },
  { from: 'centralJn',     to: 'northJn',           distance: 100,  road: 'Central North Road',    twoWay: true,  travelTime: 12,  vehicleRestriction: null },

  // ── Academic area ──
  { from: 'academicJn',    to: 'lectureHall',       distance: 40,   road: 'Academic Road',         twoWay: true,  travelTime: 5,   vehicleRestriction: null },
  { from: 'academicJn',    to: 'canteenJn',         distance: 45,   road: 'Academic Road',         twoWay: true,  travelTime: 5,   vehicleRestriction: null },
  { from: 'canteenJn',     to: 'lectureHall',       distance: 60,   road: 'Academic Lane',         twoWay: true,  travelTime: 7,   vehicleRestriction: null },
  { from: 'canteenJn',     to: 'workshopJn',        distance: 100,  road: 'Workshop Road',         twoWay: true,  travelTime: 12,  vehicleRestriction: null },

  // ── Workshop & SE area ──
  { from: 'workshopJn',    to: 'southEastJn',       distance: 80,   road: 'SE Connector',          twoWay: true,  travelTime: 10,  vehicleRestriction: null },
  { from: 'workshopJn',    to: 'mechBlock',         distance: 50,   road: 'Mech Road',             twoWay: true,  travelTime: 6,   vehicleRestriction: null },
  { from: 'southEastJn',   to: 'mechBlock',         distance: 40,   road: 'Mech Access',           twoWay: true,  travelTime: 5,   vehicleRestriction: null },
  { from: 'southEastJn',   to: 'seRdCorner',        distance: 30,   road: 'SE Gate Road',          twoWay: true,  travelTime: 4,   vehicleRestriction: null },
  { from: 'seRdCorner',    to: 'sideGate',          distance: 90,   road: 'SE Gate Road',          twoWay: true,  travelTime: 11,  vehicleRestriction: null },
  { from: 'campusPerimeter1', to: 'southEastJn',    distance: 85,   road: 'South Perimeter East',  twoWay: true,  travelTime: 10,  vehicleRestriction: null },

  // ── East Road (with corners) ──
  { from: 'eastRdCorner1', to: 'eastRoad',          distance: 50,   road: 'East Campus Road',      twoWay: true,  travelTime: 6,   vehicleRestriction: null },
  { from: 'eastRoad',      to: 'eastRdCorner2',     distance: 40,   road: 'East Campus Road',      twoWay: true,  travelTime: 5,   vehicleRestriction: null },
  { from: 'eastRdCorner2', to: 'sideGate',          distance: 50,   road: 'Side Gate Road',        twoWay: true,  travelTime: 6,   vehicleRestriction: null },
  { from: 'eastRoad',      to: 'cseBlock',          distance: 70,   road: 'East Dept Road',        twoWay: true,  travelTime: 8,   vehicleRestriction: null },

  // ── CSE / ECE / Sports area ──
  { from: 'cseBlock',      to: 'eceBlock',          distance: 50,   road: 'Dept Connector',        twoWay: true,  travelTime: 6,   vehicleRestriction: null },
  { from: 'eceBlock',      to: 'sportChowk',        distance: 80,   road: 'Sports Road',           twoWay: true,  travelTime: 10,  vehicleRestriction: null },
  { from: 'eceBlock',      to: 'sportRdCorner',     distance: 45,   road: 'Sports Road',           twoWay: true,  travelTime: 5,   vehicleRestriction: null },
  { from: 'sportRdCorner', to: 'sportsComplex',     distance: 40,   road: 'Stadium Access',        twoWay: true,  travelTime: 5,   vehicleRestriction: null },
  { from: 'sportChowk',    to: 'sportsComplex',     distance: 50,   road: 'Stadium Lane',          twoWay: true,  travelTime: 6,   vehicleRestriction: null },
  { from: 'sportChowk',    to: 'northRdBend1',      distance: 45,   road: 'North Road',            twoWay: true,  travelTime: 5,   vehicleRestriction: null },
  { from: 'northRdBend1',  to: 'northJn',           distance: 55,   road: 'North Road',            twoWay: true,  travelTime: 7,   vehicleRestriction: null },
  { from: 'lectureHall',   to: 'cseBlock',          distance: 80,   road: 'Academic Road',         twoWay: true,  travelTime: 10,  vehicleRestriction: null },

  // ── North area ──
  { from: 'northJn',       to: 'backGateApproach',  distance: 45,   road: 'Back Gate Road',        twoWay: true,  travelTime: 5,   vehicleRestriction: null },
  { from: 'backGateApproach', to: 'backGate',       distance: 45,   road: 'Back Gate Road',        twoWay: true,  travelTime: 5,   vehicleRestriction: null },
  { from: 'northJn',       to: 'northWestJn',       distance: 80,   road: 'North Connector',       twoWay: true,  travelTime: 10,  vehicleRestriction: null },
  { from: 'backGate',      to: 'evacExit1',         distance: 60,   road: 'North Evacuation Rd',   twoWay: true,  travelTime: 7,   vehicleRestriction: null },

  // ── Hostel area ──
  { from: 'hostelChowk',   to: 'hostelB',           distance: 60,   road: 'Hostel B Lane',         twoWay: true,  travelTime: 7,   vehicleRestriction: null },
  { from: 'hostelB',       to: 'hostelA',           distance: 70,   road: 'Hostel Internal',       twoWay: true,  travelTime: 8,   vehicleRestriction: null },
  { from: 'hostelChowk',   to: 'girlsHostel',      distance: 80,   road: 'GH Road',               twoWay: true,  travelTime: 10,  vehicleRestriction: null },
  { from: 'hostelChowk',   to: 'northWestJn',      distance: 70,   road: 'North Hostel Road',     twoWay: true,  travelTime: 8,   vehicleRestriction: null },
  { from: 'northWestJn',   to: 'northJn',           distance: 80,   road: 'North Hostel Road',     twoWay: true,  travelTime: 10,  vehicleRestriction: null },

  // ── West area (new) ──
  { from: 'girlsHostel',   to: 'westRdCorner1',    distance: 55,   road: 'West Campus Road',      twoWay: true,  travelTime: 7,   vehicleRestriction: null },
  { from: 'westRdCorner1', to: 'westRdCorner2',    distance: 50,   road: 'West Campus Road',      twoWay: true,  travelTime: 6,   vehicleRestriction: null },
  { from: 'westRdCorner2', to: 'westGate',         distance: 40,   road: 'West Gate Road',        twoWay: true,  travelTime: 5,   vehicleRestriction: null },
  { from: 'westRdCorner2', to: 'southWestJn',      distance: 50,   road: 'SW Connector',          twoWay: true,  travelTime: 6,   vehicleRestriction: null },
  { from: 'southWestJn',   to: 'campusPerimeter2', distance: 65,   road: 'South Perimeter',       twoWay: true,  travelTime: 8,   vehicleRestriction: null },
  { from: 'campusPerimeter2', to: 'mainGate',      distance: 70,   road: 'South Perimeter',       twoWay: true,  travelTime: 8,   vehicleRestriction: null },
  { from: 'westGate',      to: 'westRdCorner1',    distance: 40,   road: 'West Gate Access',      twoWay: true,  travelTime: 5,   vehicleRestriction: null },
  { from: 'hostelA',       to: 'northWestJn',      distance: 60,   road: 'Hostel A Road',         twoWay: true,  travelTime: 7,   vehicleRestriction: null },

  // ── Hospital connections ──
  { from: 'campusHospital', to: 'hostelRdCorner1', distance: 45,   road: 'Hospital Service Rd',   twoWay: true,  travelTime: 5,   vehicleRestriction: null },
  { from: 'campusHospital', to: 'mainChowk',       distance: 110,  road: 'Hospital Main Rd',      twoWay: true,  travelTime: 13,  vehicleRestriction: null },
  { from: 'fireStation',   to: 'securityOffice',   distance: 40,   road: 'Emergency Services Rd', twoWay: true,  travelTime: 5,   vehicleRestriction: null },
  { from: 'fireStation',   to: 'campusPerimeter2', distance: 80,   road: 'Fire Route South',      twoWay: true,  travelTime: 10,  vehicleRestriction: null },
];

// Demo relief camps (SIMULATED) — nodeId refs NODES; roadNodeId refs OSM road graph
export const RELIEF_CAMPS = [
  {
    id: 'camp1',
    name: 'Sports Ground Camp',
    nodeId: 'sportsComplex',
    roadNodeId: 'rn147',
    lat: 29.9515,
    lng: 76.8200,
    capacity: 200,
    occupancy: 45,
    supplies: ['Water', 'Food', 'First Aid', 'Blankets'],
    status: 'active'
  },
  {
    id: 'camp2',
    name: 'Library Ground Camp',
    nodeId: 'library',
    roadNodeId: 'rn10',
    lat: 29.9490,
    lng: 76.8168,
    capacity: 150,
    occupancy: 20,
    supplies: ['Water', 'Food', 'Medical Kit'],
    status: 'active'
  },
  {
    id: 'camp3',
    name: 'Main Gate Camp',
    nodeId: 'mainGate',
    roadNodeId: 'rn62',
    lat: 29.9459,
    lng: 76.8178,
    capacity: 100,
    occupancy: 80,
    supplies: ['Water', 'Food'],
    status: 'active'
  },
  {
    id: 'camp4',
    name: 'Hostel Area Camp',
    nodeId: 'hostelChowk',
    roadNodeId: 'rn81',
    lat: 29.9500,
    lng: 76.8140,
    capacity: 180,
    occupancy: 30,
    supplies: ['Water', 'Food', 'Blankets', 'Medicine'],
    status: 'active'
  }
];

// ── Evacuation Shelters ── roadNodeId = nearest OSM road node for routing
export const SHELTERS = [
  {
    id: 'shelter1',
    name: 'Sports Complex Shelter',
    nodeId: 'sportsComplex',
    roadNodeId: 'rn147',
    lat: 29.9515,
    lng: 76.8200,
    capacity: 500,
    currentOccupancy: 0,
    type: 'primary',
    facilities: ['Medical', 'Food', 'Water', 'Toilets', 'Power Backup'],
  },
  {
    id: 'shelter2',
    name: 'Library Auditorium Shelter',
    nodeId: 'library',
    roadNodeId: 'rn10',
    lat: 29.9490,
    lng: 76.8168,
    capacity: 300,
    currentOccupancy: 0,
    type: 'secondary',
    facilities: ['Water', 'Food', 'First Aid'],
  },
  {
    id: 'shelter3',
    name: 'Main Gate Assembly Point',
    nodeId: 'mainGate',
    roadNodeId: 'rn62',
    lat: 29.9459,
    lng: 76.8178,
    capacity: 200,
    currentOccupancy: 0,
    type: 'assembly',
    facilities: ['Water', 'First Aid'],
  },
  {
    id: 'shelter4',
    name: 'West Gate Assembly Point',
    nodeId: 'westGate',
    roadNodeId: 'rn105',
    lat: 29.9480,
    lng: 76.8100,
    capacity: 150,
    currentOccupancy: 0,
    type: 'assembly',
    facilities: ['Water'],
  },
  {
    id: 'shelter5',
    name: 'Campus Hospital Shelter',
    nodeId: 'campusHospital',
    roadNodeId: 'rn10',
    lat: 29.9484,
    lng: 76.8155,
    capacity: 100,
    currentOccupancy: 0,
    type: 'medical',
    facilities: ['Medical', 'ICU', 'Ambulance', 'Pharmacy'],
  },
  {
    id: 'shelter6',
    name: 'North Evacuation Point',
    nodeId: 'evacExit1',
    roadNodeId: 'rn117',
    lat: 29.9530,
    lng: 76.8170,
    capacity: 250,
    currentOccupancy: 0,
    type: 'evacuation_point',
    facilities: ['Transport', 'Water', 'First Aid'],
  },
];

// ── Population Zones (for evacuation estimation) ──
export const POPULATION_ZONES = [
  { id: 'pz1', name: 'Boys Hostel Area',     centerNodeId: 'hostelA',     population: 800,  lat: 29.9505, lng: 76.8130 },
  { id: 'pz2', name: 'Boys Hostel B Area',   centerNodeId: 'hostelB',     population: 600,  lat: 29.9508, lng: 76.8150 },
  { id: 'pz3', name: 'Girls Hostel Area',    centerNodeId: 'girlsHostel', population: 500,  lat: 29.9495, lng: 76.8120 },
  { id: 'pz4', name: 'Academic Area',        centerNodeId: 'lectureHall', population: 1200, lat: 29.9485, lng: 76.8210 },
  { id: 'pz5', name: 'CSE/ECE Area',         centerNodeId: 'cseBlock',    population: 400,  lat: 29.9498, lng: 76.8215 },
  { id: 'pz6', name: 'Admin Area',           centerNodeId: 'adminBlock',  population: 200,  lat: 29.9478, lng: 76.8185 },
  { id: 'pz7', name: 'Sports Area',          centerNodeId: 'sportsComplex', population: 300, lat: 29.9515, lng: 76.8200 },
  { id: 'pz8', name: 'Workshop Area',        centerNodeId: 'workshopJn',  population: 150,  lat: 29.9468, lng: 76.8210 },
];

// Demo rescue vehicles (SIMULATED) — roadNodeId for road-network routing
export const RESCUE_VEHICLES = [
  { id: 'v1', name: 'Ambulance Alpha',    type: 'ambulance',  nodeId: 'mainGate',     roadNodeId: 'rn62',  status: 'available', speed: 40 },
  { id: 'v2', name: 'Fire Truck Bravo',   type: 'fire_truck', nodeId: 'fireStation',  roadNodeId: 'rn87',  status: 'available', speed: 30 },
  { id: 'v3', name: 'Rescue Van Charlie', type: 'rescue_van', nodeId: 'hostelChowk',  roadNodeId: 'rn81',  status: 'available', speed: 35 },
  { id: 'v4', name: 'Ambulance Delta',    type: 'ambulance',  nodeId: 'sportChowk',   roadNodeId: 'rn236', status: 'available', speed: 40 },
  { id: 'v5', name: 'Utility Truck Echo', type: 'utility',    nodeId: 'backGate',     roadNodeId: 'rn76',  status: 'available', speed: 25 },
];

// Disaster scenario templates
export const DISASTER_SCENARIOS = {
  flood: {
    type: 'flood',
    label: 'Flood',
    icon: '🌊',
    color: '#3b82f6',
    description: 'Heavy rainfall causing waterlogging in low-lying campus areas',
    affectedNodes: ['hostelA', 'hostelB', 'girlsHostel'],
    blockedEdges: [
      { from: 'hostelChowk', to: 'hostelB' },
      { from: 'hostelChowk', to: 'girlsHostel' },
    ],
    defaultLocation: { lat: 29.9505, lng: 76.8140 },
    radius: 120,
    severity: 'high',
  },
  fire: {
    type: 'fire',
    label: 'Fire',
    icon: '🔥',
    color: '#ef4444',
    description: 'Fire outbreak in the academic area',
    affectedNodes: ['lectureHall', 'cseBlock'],
    blockedEdges: [
      { from: 'canteenJn', to: 'lectureHall' },
      { from: 'lectureHall', to: 'cseBlock' },
    ],
    defaultLocation: { lat: 29.9485, lng: 76.8210 },
    radius: 100,
    severity: 'critical',
  },
  earthquake: {
    type: 'earthquake',
    label: 'Earthquake',
    icon: '🏚️',
    color: '#f59e0b',
    description: 'Seismic activity causing structural damage near admin area',
    affectedNodes: ['adminBlock', 'mainChowk'],
    blockedEdges: [
      { from: 'mainChowk', to: 'adminBlock' },
      { from: 'southLoopBend', to: 'workshopJn' },
    ],
    defaultLocation: { lat: 29.9475, lng: 76.8185 },
    radius: 150,
    severity: 'high',
  },
  roadBlock: {
    type: 'roadBlock',
    label: 'Road Blockage',
    icon: '🚧',
    color: '#a855f7',
    description: 'Debris or vehicle blocking campus road',
    affectedNodes: ['centralJn'],
    blockedEdges: [
      { from: 'centralJn', to: 'canteenJn' },
    ],
    defaultLocation: { lat: 29.9492, lng: 76.8195 },
    radius: 50,
    severity: 'medium',
  },
};

// Emergency Control Center
export const CONTROL_CENTER = {
  name: 'Emergency Control Center',
  nodeId: 'adminBlock',
  roadNodeId: 'rn235',
  lat: 29.9478,
  lng: 76.8185,
};

/**
 * Build a combined nodes map merging OSM road nodes with campus POI nodes.
 * Used by routing functions: OSM road nodes are the primary routing graph,
 * campus POIs are included with their position for reference.
 */
export function buildCombinedNodesMap(osmRoadNodes) {
  // Start with all OSM road nodes
  const combined = { ...osmRoadNodes };
  // Add POI nodes (for heuristic calculations)
  for (const [id, node] of Object.entries(NODES)) {
    combined[id] = node;
  }
  return combined;
}
