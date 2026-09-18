/** Wikipedia / IUCN / Cypron occupancy rasters (360×170, 2-bit packed).
 *  Generated payloads live in wikiRangeData.js. Rebuild with
 *  `python3 scripts/build_wiki_range.py` after adding a map to scripts/wiki_ranges.json.
 */

import { WIKI_META, WIKI_PACKED } from "./wikiRangeData.js";

const COLS = 360;
const ROWS = 170;
export const SOUTH = -85.0;
export const NORTH = 85.0;
const POSSIBLE = 0.5;
const EXTANT = 1;

const cache = new Map();

function decode(id) {
  let codes = cache.get(id);
  if (codes) return codes;
  const packed = WIKI_PACKED[id];
  if (!packed) return null;
  const bin = Uint8Array.from(atob(packed), (c) => c.charCodeAt(0));
  codes = new Uint8Array(COLS * ROWS);
  for (let k = 0; k < codes.length; k++) {
    codes[k] = (bin[k >> 2] >> ((k & 3) << 1)) & 3;
  }
  cache.set(id, codes);
  return codes;
}

export const WIKI_IDS = Object.keys(WIKI_PACKED);

export function wikiMeta(id) {
  return WIKI_META[id] || null;
}

export function wikiCode(id, lat, lon) {
  const g = decode(id);
  if (!g) return 0;
  let x = lon;
  while (x < -180) x += 360;
  while (x > 180) x -= 360;
  const i = Math.max(0, Math.min(COLS - 1, Math.floor(((x + 180) / 360) * COLS)));
  const j = Math.max(0, Math.min(ROWS - 1, Math.floor(((NORTH - lat) / (NORTH - SOUTH)) * ROWS)));
  return g[j * COLS + i];
}

export function wikiOccupancy(id, lat, lon) {
  const c = wikiCode(id, lat, lon);
  if (c >= 2) return EXTANT;
  if (c === 1) return POSSIBLE;
  return 0;
}

export function stampWikiRaster(id, grid, cols, rows, south, north) {
  const src = decode(id);
  if (!src || !grid) return;
  const meta = WIKI_META[id] || {};
  const scale = meta.mode === "base" ? (meta.occupancy ?? 1) : 1;
  const gate = meta.mode === "gate";
  const clip = meta.mode === "replace" || meta.mode === "base" || gate;
  for (let j = 0; j < rows; j++) {
    const lat = north - ((j + 0.5) / rows) * (north - south);
    const sj = Math.max(0, Math.min(ROWS - 1, Math.floor(((NORTH - lat) / (NORTH - SOUTH)) * ROWS)));
    for (let i = 0; i < cols; i++) {
      const lon = -180 + ((i + 0.5) / cols) * 360;
      const si = Math.max(0, Math.min(COLS - 1, Math.floor(((lon + 180) / 360) * COLS)));
      const c = src[sj * COLS + si];
      const w = (c >= 2 ? EXTANT : c === 1 ? POSSIBLE : 0) * scale;
      const idx = j * cols + i;
      if (clip && w <= 0.05) grid[idx] = 0;
      else if (!gate && w > grid[idx]) grid[idx] = w;
    }
  }
}

export function applyWikiPresence(p, lat, lon) {
  for (const id of WIKI_IDS) {
    const r = wikiOccupancy(id, lat, lon);
    const meta = WIKI_META[id] || {};
    if (meta.mode === "gate") {
      if (r <= 0.05) p[id] = 0;
      continue;
    }
    const scale = meta.mode === "base" ? (meta.occupancy ?? 1) : 1;
    if (r > 0.05) p[id] = Math.max(p[id] ?? 0, r * scale);
    else p[id] = 0;
  }
}
