/**
 * Coarse range polygons until AquaMaps/OBIS slot into the atlas.
 *
 * Every species whose hull covers the cell is present. Overlap is real
 * habitat, not a bug: Humboldt can hold anchoveta and sardine; the North
 * Sea can hold herring, mackerel, sharks, and cod in one patch.
 * Predators still need prey in the cell (trophic gate), not a lat split.
 */

import { emptyPresence, SCHOOL_IDS, SPECIES, VEHICLE_IDS, speciesLabel } from "./fauna.js";

const HERRING_HULL = [
  [-76, 41],
  [-76, 62],
  [-44, 70],
  [-24, 76],
  [8, 78],
  [30, 72],
  [30, 54],
  [22, 53],
  [12, 50],
  [2, 48],
  [-8, 43],
  [-20, 42],
  [-50, 40],
  [-70, 41],
];

const CAPELIN_HULLS = [
  [
    [-170, 52],
    [-155, 66],
    [-80, 76],
    [-20, 80],
    [40, 78],
    [58, 70],
    [44, 64],
    [20, 68],
    [-8, 64],
    [-44, 56],
    [-64, 52],
    [-72, 56],
    [-168, 54],
  ],
];

const MENHADEN_HULLS = [
  [
    [-97, 18],
    [-97, 30],
    [-88, 31],
    [-84, 30],
    [-81, 25],
    [-80, 32],
    [-76, 35],
    [-74, 41],
    [-70, 42],
    [-67, 41],
    [-70, 36],
    [-76, 31],
    [-81, 24],
    [-89, 21],
  ],
];

const SARDINE_HULLS = [
  [
    [-126, 24],
    [-126, 48],
    [-116, 48],
    [-110, 32],
    [-110, 22],
    [-116, 22],
  ],
  [
    [-84, 4],
    [-84, -46],
    [-70, -46],
    [-70, 4],
  ],
  [
    [128, 28],
    [128, 46],
    [150, 46],
    [150, 28],
  ],
  [
    [8, -16],
    [8, -36],
    [20, -36],
    [20, -16],
  ],
  [
    [18, -30],
    [18, -38],
    [32, -38],
    [32, -30],
  ],
  [
    [110, -32],
    [110, -44],
    [180, -44],
    [180, -32],
  ],
  [
    [-180, -32],
    [-180, -44],
    [-170, -44],
    [-170, -32],
  ],
];

const PILCHARD_HULLS = [
  [
    [-18, 14],
    [-18, 48],
    [-8, 51],
    [2, 50],
    [12, 44],
    [36, 42],
    [36, 30],
    [12, 31],
    [0, 35],
    [-10, 28],
    [-17, 16],
  ],
];

const ANCHOVY_HULLS = [
  [
    [-84, 6],
    [-84, -42],
    [-70, -42],
    [-70, 6],
  ],
  [
    [-126, 24],
    [-126, 50],
    [-116, 50],
    [-112, 28],
    [-116, 24],
  ],
  [
    [118, 28],
    [118, 46],
    [148, 46],
    [148, 28],
  ],
  [
    [-10, 34],
    [-8, 48],
    [8, 46],
    [42, 46],
    [42, 40],
    [28, 36],
    [10, 35],
    [-5, 35],
  ],
];

const SARDINELLA_HULLS = [
  [
    [-62, 22],
    [-90, 22],
    [-98, 18],
    [-90, 8],
    [-60, -4],
    [-40, -8],
    [-8, -4],
    [12, 6],
    [8, 18],
    [-16, 16],
    [-18, 12],
    [-60, 8],
  ],
  [
    [-10, -8],
    [-10, 10],
    [14, 10],
    [14, -8],
  ],
  [
    [38, 24],
    [38, -8],
    [78, -18],
    [110, -12],
    [130, 8],
    [120, 22],
    [78, 24],
  ],
];

const MACKEREL_HULLS = [
  [
    [-76, 35],
    [-76, 62],
    [-44, 68],
    [-8, 72],
    [20, 70],
    [30, 58],
    [20, 42],
    [8, 36],
    [-8, 36],
    [-20, 38],
    [-50, 38],
  ],
  [
    [-126, 22],
    [-126, 46],
    [-110, 46],
    [-110, 22],
  ],
  [
    [128, 26],
    [128, 46],
    [150, 46],
    [150, 26],
  ],
  [
    [-84, 0],
    [-84, -42],
    [-70, -42],
    [-70, 0],
  ],
];

const SPRAT_HULLS = [
  [
    [-12, 48],
    [-8, 62],
    [12, 66],
    [30, 60],
    [28, 52],
    [12, 50],
    [0, 48],
  ],
];

const SANDLANCE_HULLS = [
  [
    [-76, 36],
    [-70, 52],
    [-44, 62],
    [-8, 66],
    [18, 62],
    [22, 50],
    [8, 42],
    [-20, 38],
    [-60, 36],
  ],
  [
    [-170, 48],
    [-155, 62],
    [-140, 58],
    [-122, 50],
    [-122, 36],
    [-128, 34],
    [-160, 42],
  ],
  [
    [128, 36],
    [128, 52],
    [150, 50],
    [148, 36],
  ],
];

const POLARCOD_HULLS = [
  [
    [-180, 66],
    [-180, 84],
    [180, 84],
    [180, 66],
  ],
];

const SILVERFISH_HULLS = [
  [
    [-180, -80],
    [-180, -54],
    [0, -54],
    [0, -80],
  ],
  [
    [0, -80],
    [0, -54],
    [180, -54],
    [180, -80],
  ],
];

const SAURY_HULLS = [
  [
    [140, 30],
    [140, 48],
    [180, 50],
    [180, 32],
  ],
  [
    [-180, 32],
    [-180, 50],
    [-122, 48],
    [-122, 30],
  ],
];

const MARKETSQUID_HULLS = [
  [
    [-126, 26],
    [-126, 46],
    [-116, 46],
    [-116, 26],
  ],
  [
    [-12, 36],
    [-8, 58],
    [12, 58],
    [20, 44],
    [8, 36],
  ],
  [
    [128, 30],
    [128, 44],
    [146, 44],
    [146, 30],
  ],
  [
    [-6, 30],
    [8, 44],
    [36, 42],
    [36, 32],
    [10, 30],
  ],
];

const GREATWHITE_HULLS = [
  [
    [-126, 24],
    [-126, 42],
    [-116, 42],
    [-116, 24],
  ],
  [
    [-76, 32],
    [-76, 46],
    [-64, 46],
    [-64, 32],
  ],
  [
    [-78, -28],
    [-78, -42],
    [-70, -42],
    [-70, -28],
  ],
  [
    [110, -28],
    [110, -40],
    [154, -40],
    [154, -28],
  ],
  [
    [128, 30],
    [128, 42],
    [146, 42],
    [146, 30],
  ],
  [
    [-10, 30],
    [-8, 44],
    [16, 44],
    [16, 32],
  ],
  [
    [14, -28],
    [14, -36],
    [28, -36],
    [28, -28],
  ],
];

const HUMPBACK_HULLS = [
  [
    [-170, 50],
    [-140, 62],
    [-120, 50],
    [-122, 36],
    [-150, 36],
  ],
  [
    [-76, 36],
    [-70, 52],
    [-44, 64],
    [-8, 70],
    [20, 68],
    [24, 52],
    [8, 42],
    [-20, 38],
  ],
  [
    [-84, -2],
    [-84, -48],
    [-70, -48],
    [-70, -2],
  ],
  [
    [140, -16],
    [140, -64],
    [180, -64],
    [180, -16],
  ],
  [
    [-180, -16],
    [-180, -64],
    [-160, -64],
    [-160, -16],
  ],
  [
    [-180, -52],
    [-180, -70],
    [0, -70],
    [0, -52],
  ],
  [
    [0, -52],
    [0, -70],
    [180, -70],
    [180, -52],
  ],
  [
    [18, -30],
    [18, -42],
    [32, -42],
    [32, -30],
  ],
];

const HUMBOLDT_HULLS = [
  [
    [-120, 32],
    [-120, -42],
    [-70, -42],
    [-70, 32],
  ],
];

export function pointInPolygon(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const hit = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function inAny(lon, lat, hulls) {
  for (let i = 0; i < hulls.length; i++) {
    if (pointInPolygon(lon, lat, hulls[i])) return true;
  }
  return false;
}

function wrapLon(lon) {
  let x = lon;
  while (x < -180) x += 360;
  while (x > 180) x -= 360;
  return x;
}

const RANGES = [
  { id: "herring", hulls: [HERRING_HULL] },
  { id: "capelin", hulls: CAPELIN_HULLS },
  { id: "menhaden", hulls: MENHADEN_HULLS },
  { id: "sardine", hulls: SARDINE_HULLS },
  { id: "pilchard", hulls: PILCHARD_HULLS },
  { id: "anchovy", hulls: ANCHOVY_HULLS },
  { id: "sardinella", hulls: SARDINELLA_HULLS },
  { id: "mackerel", hulls: MACKEREL_HULLS },
  { id: "sprat", hulls: SPRAT_HULLS },
  { id: "sandlance", hulls: SANDLANCE_HULLS },
  { id: "polarcod", hulls: POLARCOD_HULLS },
  { id: "silverfish", hulls: SILVERFISH_HULLS },
  { id: "saury", hulls: SAURY_HULLS },
  { id: "marketsquid", hulls: MARKETSQUID_HULLS },
  { id: "greatwhite", hulls: GREATWHITE_HULLS },
  { id: "humpback", hulls: HUMPBACK_HULLS },
  { id: "humboldtsquid", hulls: HUMBOLDT_HULLS },
];

function schoolPreyCount(p) {
  let n = 0;
  for (const id of SCHOOL_IDS) if (p[id] > 0.05) n += 1;
  return n;
}

function preySatisfied(spec, p) {
  const prey = spec?.prey;
  if (!prey || !prey.length) return true;
  if (prey.includes("bloom")) return true;
  if (prey.includes("school")) return schoolPreyCount(p) > 0;
  for (const id of prey) if ((p[id] ?? 0) > 0.05) return true;
  return false;
}

export function herringSuitability(lat, lon) {
  return pointInPolygon(wrapLon(lon), lat, HERRING_HULL) ? 1 : 0;
}

export function presenceAt(lat, lon) {
  const p = emptyPresence();
  const x = wrapLon(lon);
  for (const spec of RANGES) {
    if (inAny(x, lat, spec.hulls)) p[spec.id] = 1;
  }
  if (Math.abs(lat) < 32.5) p.flyingfish = 1;

  const prey = schoolPreyCount(p);
  if (prey && lat < 58 && lat > -48) p.shark = 1;
  if (prey && Math.abs(lat) < 40) p.tuna = 1;
  if ((p.herring || p.capelin) && lat > 42 && lat < 78 && lon > -76 && lon < 52) {
    p.cod = 1;
  }
  if (prey && Math.abs(lat) < 28) p.tigershark = 1;
  if (prey && Math.abs(lat) < 32) p.hammerhead = 1;
  if (Math.abs(lat) < 30) p.whaleshark = 1;
  if (Math.abs(lat) > 32) p.minke = 1;
  if (Math.abs(lat) < 55) p.spermwhale = 1;
  if (prey) p.orca = 1;
  if (prey && Math.abs(lat) < 32) p.mahi = 1;
  if (prey && Math.abs(lat) < 28) p.barracuda = 1;
  if (prey && Math.abs(lat) < 32) p.yellowfin = 1;
  if (prey && Math.abs(lat) >= 24 && Math.abs(lat) <= 60) p.bluefin = 1;
  if (prey && Math.abs(lat) < 32) p.sailfish = 1;

  for (const id of VEHICLE_IDS) {
    if ((p[id] ?? 0) <= 0.05) continue;
    if (!preySatisfied(SPECIES[id], p)) p[id] = 0;
  }
  return p;
}

export function faunaIdsPresent(lat, lon) {
  const p = presenceAt(lat, lon);
  const ids = [];
  for (const id of Object.keys(p)) {
    if (p[id] > 0.05) ids.push(id);
  }
  return ids;
}

export function presentLabel(presence) {
  const who = [];
  for (const id of Object.keys(presence || {})) {
    if ((presence[id] ?? 0) > 0.05) who.push(speciesLabel(id));
  }
  return who.length ? who.join(", ") : "no implemented fauna";
}
