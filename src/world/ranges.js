/**
 * Coarse range polygons until AquaMaps/OBIS slot into the atlas.
 * Atlantic herring (Clupea harengus): North Atlantic, North Sea, Baltic, Iceland.
 * The current shark guild eats herring, so shark presence tracks herring.
 */

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

export function herringSuitability(lat, lon) {
  return pointInPolygon(lon, lat, HERRING_HULL) ? 1 : 0;
}

export function presenceAt(lat, lon) {
  const herring = herringSuitability(lat, lon);
  return { herring, shark: herring };
}

export function faunaIdsPresent(lat, lon) {
  const p = presenceAt(lat, lon);
  const ids = [];
  if (p.herring > 0.05) ids.push("herring");
  if (p.shark > 0.05) ids.push("shark");
  return ids;
}
