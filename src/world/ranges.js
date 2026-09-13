/**
 * Coarse range polygons until AquaMaps/OBIS slot into the atlas.
 *
 * Every species whose hull covers the cell is present. Overlap is real
 * habitat, not a bug: Humboldt can hold anchoveta and sardine; the North
 * Sea can hold herring, mackerel, sharks, and cod in one patch.
 * Predators still need prey in the cell (trophic gate), not a lat split.
 */

import { emptyPresence, SCHOOL_IDS } from "./fauna.js";

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
];

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

  let prey = 0;
  for (const id of SCHOOL_IDS) if (p[id] > 0.05) prey += 1;
  if (prey && Math.abs(lat) < 62) p.shark = 1;
  if (prey && Math.abs(lat) < 40) p.tuna = 1;
  if ((p.herring || p.capelin) && lat > 42 && lat < 78 && lon > -76 && lon < 52) {
    p.cod = 1;
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
  const names = {
    herring: "herring",
    capelin: "capelin",
    menhaden: "menhaden",
    sardine: "sardine",
    pilchard: "pilchard",
    anchovy: "anchovy",
    sardinella: "sardinella",
    mackerel: "mackerel",
    flyingfish: "flying fish",
    shark: "shark",
    tuna: "tuna",
    cod: "cod",
  };
  const who = [];
  for (const id of Object.keys(presence || {})) {
    if ((presence[id] ?? 0) > 0.05) who.push(names[id] || id);
  }
  return who.length ? who.join(", ") : "no implemented fauna";
}
