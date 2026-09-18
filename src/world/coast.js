/**
 * Distance-to-coast field from Natural Earth land polygons.
 *
 * Coastal taxa fade with kilometres from shore. Pelagic taxa skip this.
 * The field is optional: until land is loaded, `coastKmAt` returns null
 * and `coastWeight` is 1 — presence does not empty a cell for lack of a map.
 */

import { topoPolygons } from "./topo.js";

const SOUTH = -85;
const NORTH = 85;
const COLS = 1440;
const ROWS = 680;
const INF = 1e9;

let field = null;

export function hasCoastField() {
  return !!field;
}

export function setCoastPolygons(polygons, opts) {
  field = buildCoastField(polygons, opts);
  return field;
}

export async function warmCoast(url = "/world/land-50m.json") {
  if (field) return field;
  const topo = await fetch(url).then((r) => r.json());
  return setCoastPolygons(topoPolygons(topo, "land"));
}

function stampVertices(land, cols, rows, south, north, rings) {
  for (const ring of rings || []) {
    if (!ring) continue;
    for (let n = 0; n < ring.length; n++) {
      const lon = wrapLon(ring[n][0]);
      const lat = ring[n][1];
      const i = Math.round(((lon + 180) / 360) * cols);
      const j = Math.max(0, Math.min(rows - 1, Math.round(((north - lat) / (north - south)) * rows)));
      for (let dj = -1; dj <= 1; dj++) {
        const y = j + dj;
        if (y < 0 || y >= rows) continue;
        for (let di = -1; di <= 1; di++) {
          const x = ((i + di) % cols + cols) % cols;
          land[y * cols + x] = 1;
        }
      }
    }
  }
}

export function coastKmAt(lat, lon) {
  if (!field) return null;
  const { cols, rows, south, north, km } = field;
  const x = ((wrapLon(lon) + 180) / 360) * cols - 0.5;
  const y = ((north - lat) / (north - south)) * rows - 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const tx = x - x0;
  const ty = y - y0;
  const a = sample(km, cols, rows, x0, y0);
  const b = sample(km, cols, rows, x1, y0);
  const c = sample(km, cols, rows, x0, y1);
  const d = sample(km, cols, rows, x1, y1);
  return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
}

export function coastWeight(km, maxKm) {
  if (maxKm == null || maxKm <= 0) return 1;
  if (km == null || !Number.isFinite(km)) return 1;
  const inner = maxKm * 0.32;
  if (km <= inner) return 1;
  if (km >= maxKm) return 0;
  return (maxKm - km) / (maxKm - inner);
}

export function buildCoastField(polygons, opts = {}) {
  const cols = opts.cols ?? COLS;
  const rows = opts.rows ?? ROWS;
  const south = opts.south ?? SOUTH;
  const north = opts.north ?? NORTH;
  const land = new Uint8Array(cols * rows);
  for (const poly of polygons || []) {
    if (!poly?.length) continue;
    fillRings(land, cols, rows, south, north, poly, 1, "set");
    stampVertices(land, cols, rows, south, north, poly);
  }
  const km = distanceKm(land, cols, rows, south, north);
  return { cols, rows, south, north, km };
}

/**
 * Raster rings onto a typed array. `max` keeps the larger value;
 * `set` writes `value` (land fill). Even-odd, dateline-safe.
 */
export function fillRings(grid, cols, rows, south, north, rings, value, mode = "max") {
  if (!rings?.length) return;
  const hitsByRow = new Array(rows);
  for (let j = 0; j < rows; j++) hitsByRow[j] = [];
  for (const ring of rings) {
    if (!ring || ring.length < 3) continue;
    addRingHits(hitsByRow, cols, rows, south, north, ring);
  }
  for (let j = 0; j < rows; j++) {
    const hits = hitsByRow[j];
    if (hits.length < 2) continue;
    hits.sort((a, b) => a - b);
    const row = j * cols;
    for (let k = 0; k + 1 < hits.length; k += 2) {
      const a = Math.max(0, Math.min(cols, Math.round(hits[k])));
      const b = Math.max(0, Math.min(cols, Math.round(hits[k + 1])));
      if (b <= a) continue;
      if (mode === "set") grid.fill(value, row + a, row + b);
      else {
        for (let x = a; x < b; x++) {
          if (value > grid[row + x]) grid[row + x] = value;
        }
      }
    }
  }
}

function addRingHits(hitsByRow, cols, rows, south, north, ring) {
  const n = ring.length;
  for (let i = 0, k = n - 1; i < n; k = i++) {
    let lon0 = wrapLon(ring[k][0]);
    let lon1 = wrapLon(ring[i][0]);
    const lat0 = ring[k][1];
    const lat1 = ring[i][1];
    if (Math.abs(lon1 - lon0) > 180) {
      const dir = lon0 > 0 ? 180 : -180;
      const lon1w = lon1 + (lon1 > 0 ? -360 : 360);
      const t = (dir - lon0) / (lon1w - lon0 + 1e-12);
      const latM = lat0 + t * (lat1 - lat0);
      addEdgeHits(hitsByRow, cols, rows, south, north, lon0, lat0, dir, latM);
      addEdgeHits(hitsByRow, cols, rows, south, north, -dir, latM, lon1, lat1);
    } else {
      addEdgeHits(hitsByRow, cols, rows, south, north, lon0, lat0, lon1, lat1);
    }
  }
}

function addEdgeHits(hitsByRow, cols, rows, south, north, lon0, lat0, lon1, lat1) {
  const y0 = ((north - lat0) / (north - south)) * rows;
  const y1 = ((north - lat1) / (north - south)) * rows;
  if (y0 === y1) return;
  const x0 = ((lon0 + 180) / 360) * cols;
  const x1 = ((lon1 + 180) / 360) * cols;
  const j0 = Math.max(0, Math.min(rows - 1, Math.floor(Math.min(y0, y1))));
  const j1 = Math.max(0, Math.min(rows - 1, Math.floor(Math.max(y0, y1))));
  for (let j = j0; j <= j1; j++) {
    const y = j + 0.5;
    if ((y0 > y) === (y1 > y)) continue;
    const t = (y - y0) / (y1 - y0);
    const x = x0 + t * (x1 - x0);
    if (x < 0 || x > cols) continue;
    hitsByRow[j].push(x);
  }
}

function distanceKm(land, cols, rows, south, north) {
  const dist = new Float32Array(cols * rows);
  const dy = ((north - south) / rows) * 111.32;
  for (let j = 0; j < rows; j++) {
    const lat = north - ((j + 0.5) / rows) * (north - south);
    const dx = Math.max(12, Math.cos((lat * Math.PI) / 180) * (360 / cols) * 111.32);
    const row = j * cols;
    for (let i = 0; i < cols; i++) {
      dist[row + i] = land[row + i] ? 0 : INF;
    }
    chamferRow(dist, cols, rows, j, dx, dy, 1);
  }
  for (let j = rows - 1; j >= 0; j--) {
    const lat = north - ((j + 0.5) / rows) * (north - south);
    const dx = Math.max(12, Math.cos((lat * Math.PI) / 180) * (360 / cols) * 111.32);
    const dyb = dy;
    chamferRow(dist, cols, rows, j, dx, dyb, -1);
  }
  for (let k = 0; k < dist.length; k++) {
    if (dist[k] >= INF) dist[k] = 4000;
  }
  return dist;
}

function chamferRow(dist, cols, rows, j, dx, dy, dir) {
  const row = j * cols;
  const start = dir > 0 ? 0 : cols - 1;
  const end = dir > 0 ? cols : -1;
  const step = dir > 0 ? 1 : -1;
  const jn = j - dir;
  const hasN = jn >= 0 && jn < rows;
  const nrow = hasN ? jn * cols : 0;
  for (let i = start; i !== end; i += step) {
    let d = dist[row + i];
    if (d === 0) continue;
    const il = i - step;
    if (il >= 0 && il < cols) d = Math.min(d, dist[row + il] + dx);
    if (hasN) {
      d = Math.min(d, dist[nrow + i] + dy);
      if (il >= 0 && il < cols) d = Math.min(d, dist[nrow + il] + Math.hypot(dx, dy));
      const ir = i + step;
      if (ir >= 0 && ir < cols) d = Math.min(d, dist[nrow + ir] + Math.hypot(dx, dy));
    }
    dist[row + i] = d;
  }
}

function sample(km, cols, rows, i, j) {
  const x = ((i % cols) + cols) % cols;
  const y = Math.max(0, Math.min(rows - 1, j));
  return km[y * cols + x];
}

function wrapLon(lon) {
  let x = lon;
  while (x < -180) x += 360;
  while (x > 180) x -= 360;
  return x;
}
