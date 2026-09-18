import {
  PATCH_SIZE_M,
  ELEV_NX,
  ELEV_NZ,
  chunkCenter,
  patchBBox,
  resampleElevation,
  makeElevationPatch,
} from "./patch.js";
import { presenceAt } from "./ranges.js";
import { CONFIG } from "../config.js";

export class AtlasError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

async function fetchText(url, ms = 14000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new AtlasError("http", `${res.status} ${url}`);
    return await res.text();
  } catch (err) {
    if (err instanceof AtlasError) throw err;
    if (err?.name === "AbortError") {
      throw new AtlasError("timeout", "The bathymetry service did not answer in time.");
    }
    throw err;
  } finally {
    clearTimeout(t);
  }
}

export function gebcoMapUrl(west, south, east, north, width, height) {
  const w = Math.max(64, Math.min(1400, width | 0));
  const h = Math.max(64, Math.min(900, height | 0));
  const bbox = `${south},${west},${north},${east}`;
  // Flat hypsometric tint, not the hillshaded rainbow chart. We restyle it.
  return `/gebco/mapserv?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=GEBCO_LATEST_2&STYLES=default&CRS=EPSG:4326&BBOX=${bbox}&WIDTH=${w}&HEIGHT=${h}&FORMAT=image/png&TRANSPARENT=FALSE`;
}

function parseEsriAscii(text) {
  const lines = text.replace(/\r/g, "").split("\n");
  const meta = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }
    const parts = line.split(/\s+/);
    const key = parts[0].toLowerCase();
    if (
      key === "ncols" ||
      key === "nrows" ||
      key === "xllcorner" ||
      key === "yllcorner" ||
      key === "xllcenter" ||
      key === "yllcenter" ||
      key === "cellsize" ||
      key === "nodata_value"
    ) {
      meta[key] = Number(parts[1]);
      i++;
      continue;
    }
    break;
  }
  const ncols = meta.ncols | 0;
  const nrows = meta.nrows | 0;
  if (ncols < 2 || nrows < 2) throw new AtlasError("bathy", "GMRT grid too small");
  const nodata = Number.isFinite(meta.nodata_value) ? meta.nodata_value : -9999;
  const values = [];
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const nums = line.split(/\s+/);
    for (const s of nums) {
      if (!s) continue;
      const v = Number(s);
      values.push(v === nodata || !Number.isFinite(v) ? 0 : v);
    }
  }
  if (values.length < ncols * nrows) throw new AtlasError("bathy", "GMRT grid truncated");
  // ESRI ASCII rows are north to south. Our local +Z is north, iz=0 is south.
  const elev = new Float32Array(ncols * nrows);
  for (let r = 0; r < nrows; r++) {
    const srcY = r;
    const dstZ = nrows - 1 - r;
    for (let c = 0; c < ncols; c++) {
      elev[dstZ * ncols + c] = values[srcY * ncols + c];
    }
  }
  const cell = meta.cellsize || 1;
  const xll = Number.isFinite(meta.xllcorner)
    ? meta.xllcorner
    : (meta.xllcenter ?? 0) - cell / 2;
  const yll = Number.isFinite(meta.yllcorner)
    ? meta.yllcorner
    : (meta.yllcenter ?? 0) - cell / 2;
  return {
    nx: ncols,
    nz: nrows,
    elevation: elev,
    west: xll,
    south: yll,
    east: xll + ncols * cell,
    north: yll + nrows * cell,
  };
}

/** `high` is ~100 m — enough for a 1 km cell resampled to 80². `max` is slower on GMRT. */
export async function fetchElevationGrid(west, south, east, north, resolution = "high") {
  const pad = resolution === "max" ? 0.002 : 0;
  const q =
    `/gmrt/services/GridServer?west=${west - pad}&east=${east + pad}` +
    `&south=${south - pad}&north=${north + pad}&format=esriascii&resolution=${resolution}`;
  const text = await fetchText(q, resolution === "max" ? 16000 : 10000);
  if (text[0] === "<" || /html/i.test(text.slice(0, 80))) {
    throw new AtlasError("bathy", "GMRT returned HTML");
  }
  if (text.length > 9e6) throw new AtlasError("bathy", "GMRT grid too large");
  return parseEsriAscii(text);
}

function parseHycomCsv(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l && !l.startsWith("#") && !l.startsWith("Validation"));
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((s) => s.trim().replace(/^\[|\]$/g, "").toLowerCase());
  const iu = header.findIndex((h) => h.startsWith("water_u") || h === "u");
  const iv = header.findIndex((h) => h.startsWith("water_v") || h === "v");
  const ilat = header.findIndex((h) => h.includes("lat"));
  const ilon = header.findIndex((h) => h.includes("lon"));
  if (iu < 0 || iv < 0) return [];
  const pts = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const u = Number(cols[iu]);
    const v = Number(cols[iv]);
    if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
    pts.push({
      lat: ilat >= 0 ? Number(cols[ilat]) : 0,
      lon: ilon >= 0 ? Number(cols[ilon]) : 0,
      u,
      v,
    });
  }
  return pts;
}

function lon360(lon) {
  let x = lon;
  while (x < 0) x += 360;
  while (x >= 360) x -= 360;
  return x;
}

function hycomTimes() {
  const times = [];
  const d = new Date();
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(Math.floor(d.getUTCHours() / 3) * 3);
  for (let i = 0; i < 4; i++) {
    times.push(new Date(d.getTime() - i * 3 * 3600 * 1000).toISOString().replace(/\.\d+Z$/, "Z"));
  }
  return times;
}

function hycomPointUrl(lat, lon, time) {
  return (
    `/hycom/thredds/ncss/grid/FMRC_ESPC-D-V02_uv3z/FMRC_ESPC-D-V02_uv3z_best.ncd` +
    `?var=water_u&var=water_v&latitude=${lat}&longitude=${lon360(lon)}` +
    `&time=${encodeURIComponent(time)}&vertCoord=0&accept=csv`
  );
}

export async function fetchCurrentPoint(lat, lon) {
  for (const time of hycomTimes()) {
    try {
      const text = await fetchText(hycomPointUrl(lat, lon, time), 8000);
      const pts = parseHycomCsv(text);
      if (!pts.length) continue;
      let su = 0;
      let sv = 0;
      for (const p of pts) {
        su += p.u;
        sv += p.v;
      }
      return { u: su / pts.length, v: sv / pts.length, ok: true };
    } catch {
      continue;
    }
  }
  return { u: 0, v: 0, ok: false };
}

export async function fetchCurrentField(west, south, east, north) {
  const times = hycomTimes();
  const nx = 5;
  const ny = 4;
  const spanLon = ((east - west + 540) % 360) - 180;
  const pts = [];
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const lat = south + ((iy + 0.5) / ny) * (north - south);
      const lon = west + ((ix + 0.5) / nx) * (spanLon <= 0 ? east - west + (east < west ? 360 : 0) : east - west);
      pts.push({ lat, lon: ((lon + 540) % 360) - 180 });
    }
  }
  const time = times[0];
  const settled = await Promise.all(
    pts.map(async (p) => {
      try {
        const text = await fetchText(hycomPointUrl(p.lat, p.lon, time), 7000);
        const got = parseHycomCsv(text);
        if (!got.length) return null;
        return { lat: p.lat, lon: p.lon, u: got[0].u, v: got[0].v };
      } catch {
        return null;
      }
    })
  );
  return settled.filter(Boolean);
}

export async function loadPatchById(id) {
  const { lat, lon } = chunkCenter(id);
  const bbox = patchBBox(lat, lon, PATCH_SIZE_M);
  const [elevPack, current] = await Promise.all([
    fetchElevationGrid(bbox.west, bbox.south, bbox.east, bbox.north),
    fetchCurrentPoint(lat, lon),
  ]);
  const elevation = resampleElevation(elevPack.elevation, elevPack.nx, elevPack.nz, ELEV_NX, ELEV_NZ);
  const patch = makeElevationPatch(id, lat, lon, elevation, ELEV_NX, ELEV_NZ, {
    current: { u: current.u, v: current.v },
    note: current.ok ? "" : "HYCOM current unavailable; local tide/eddies only.",
  });
  if (patch.centerY >= -0.4 || patch.wetFrac < 0.18) {
    throw new AtlasError("land", "That cell is mostly land.");
  }
  patch.presence = presenceAt(lat, lon, {
    floorY: patch.floorY,
    dayOfYear: CONFIG.time?.dayIndex ?? 180,
  });
  return patch;
}
