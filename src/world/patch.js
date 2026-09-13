import { CONFIG, bindCellFauna, bindColumnHabitat } from "../config.js";
import { emptyPresence, fullPresence, SPECIES } from "./fauna.js";

export const PATCH_SIZE_M = 1000;
export const LAB_SIZE_M = 10000;
export const ELEV_NX = 80;
export const ELEV_NZ = 80;

const ORIGIN_SHIFT = 20037508.342789244;

/** Central North Sea herring water, ~60 m. */
export const HOME_LAT = 56.0;
export const HOME_LON = 3.2;

let active = null;

export function getActivePatch() {
  return active;
}

export function setActivePatch(patch) {
  active = patch;
  return patch;
}

export function metersPerDegLat() {
  return 111320;
}

export function metersPerDegLon(lat) {
  return 111320 * Math.max(0.08, Math.cos((lat * Math.PI) / 180));
}

export function lonLatToMeters(lon, lat) {
  const x = (lon * ORIGIN_SHIFT) / 180;
  let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
  y = (y * ORIGIN_SHIFT) / 180;
  return { x, y };
}

export function metersToLonLat(x, y) {
  const lon = (x / ORIGIN_SHIFT) * 180;
  let lat = (y / ORIGIN_SHIFT) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return { lon, lat };
}

export function chunkIdFromLatLon(lat, lon) {
  const m = lonLatToMeters(lon, lat);
  const ix = Math.floor(m.x / PATCH_SIZE_M);
  const iz = Math.floor(m.y / PATCH_SIZE_M);
  return { ix, iz, key: `${ix}:${iz}` };
}

export function chunkCenter(id) {
  const x = (id.ix + 0.5) * PATCH_SIZE_M;
  const y = (id.iz + 0.5) * PATCH_SIZE_M;
  const geo = metersToLonLat(x, y);
  return { lat: geo.lat, lon: geo.lon };
}

export function patchBBox(lat, lon, sizeM = PATCH_SIZE_M) {
  const dLat = sizeM / metersPerDegLat() / 2;
  const dLon = sizeM / metersPerDegLon(lat) / 2;
  return {
    west: lon - dLon,
    east: lon + dLon,
    south: lat - dLat,
    north: lat + dLat,
  };
}

export function localToGeo(patch, x, z) {
  return {
    lat: patch.originLat + z / metersPerDegLat(),
    lon: patch.originLon + x / metersPerDegLon(patch.originLat),
  };
}

export function geoToLocal(patch, lat, lon) {
  return {
    x: (lon - patch.originLon) * metersPerDegLon(patch.originLat),
    z: (lat - patch.originLat) * metersPerDegLat(),
  };
}

export function samplePatchElevation(patch, x, z) {
  const nx = patch.nx;
  const nz = patch.nz;
  const elev = patch.elevation;
  if (!elev || !nx || !nz) return CONFIG.floorY;
  const fx = (x - patch.minX) / patch.cellX;
  const fz = (z - patch.minZ) / patch.cellZ;
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const tx = fx - x0;
  const tz = fz - z0;
  const v00 = _at(elev, nx, nz, x0, z0);
  const v10 = _at(elev, nx, nz, x0 + 1, z0);
  const v01 = _at(elev, nx, nz, x0, z0 + 1);
  const v11 = _at(elev, nx, nz, x0 + 1, z0 + 1);
  return v00 * (1 - tx) * (1 - tz) + v10 * tx * (1 - tz) + v01 * (1 - tx) * tz + v11 * tx * tz;
}

function _at(elev, nx, nz, ix, iz) {
  const x = ix < 0 ? 0 : ix >= nx ? nx - 1 : ix;
  const z = iz < 0 ? 0 : iz >= nz ? nz - 1 : iz;
  return elev[z * nx + x];
}

export function resampleElevation(src, srcNx, srcNz, dstNx, dstNz) {
  const out = new Float32Array(dstNx * dstNz);
  for (let iz = 0; iz < dstNz; iz++) {
    for (let ix = 0; ix < dstNx; ix++) {
      const fx = ((ix + 0.5) / dstNx) * srcNx - 0.5;
      const fz = ((iz + 0.5) / dstNz) * srcNz - 0.5;
      const x0 = Math.floor(fx);
      const z0 = Math.floor(fz);
      const tx = fx - x0;
      const tz = fz - z0;
      const v00 = _at(src, srcNx, srcNz, x0, z0);
      const v10 = _at(src, srcNx, srcNz, x0 + 1, z0);
      const v01 = _at(src, srcNx, srcNz, x0, z0 + 1);
      const v11 = _at(src, srcNx, srcNz, x0 + 1, z0 + 1);
      out[iz * dstNx + ix] =
        v00 * (1 - tx) * (1 - tz) + v10 * tx * (1 - tz) + v01 * (1 - tx) * tz + v11 * tx * tz;
    }
  }
  return out;
}

export function makeElevationPatch(id, originLat, originLon, elevation, nx, nz, extra = {}) {
  const size = extra.sizeM || PATCH_SIZE_M;
  const half = size / 2;
  const wet = new Uint8Array(nx * nz);
  let minY = Infinity;
  let maxY = -Infinity;
  let sumWet = 0;
  let nWet = 0;
  let centerY = elevation[((nz / 2) | 0) * nx + ((nx / 2) | 0)];
  for (let i = 0; i < elevation.length; i++) {
    const y = elevation[i];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (y < -1.5) {
      wet[i] = 1;
      sumWet += y;
      nWet++;
    }
  }
  const floorY = nWet ? minY : Math.min(-8, minY);
  const meanWet = nWet ? sumWet / nWet : floorY;
  const shelfY = Math.min(-6, meanWet * 0.4 + floorY * 0.6);
  const thermoY = Math.max(floorY + 8, Math.min(-18, -32));
  const preferredDepth = Math.max(floorY + 8, -38);
  const landFrac = 1 - nWet / Math.max(1, elevation.length);
  const hasLand = maxY > -0.4 && landFrac > 0.02;
  return {
    id,
    key: id.key,
    originLat,
    originLon,
    sizeM: size,
    nx,
    nz,
    minX: -half,
    minZ: -half,
    cellX: size / nx,
    cellZ: size / nz,
    elevation,
    wet,
    floorY,
    shelfY,
    thermoY,
    preferredDepth,
    centerY,
    landFrac,
    wetFrac: nWet / Math.max(1, elevation.length),
    hasLand,
    synthetic: extra.synthetic ?? false,
    lab: !!extra.lab,
    boot: !!extra.boot,
    statics: extra.statics ?? false,
    current: extra.current || { u: 0, v: 0 },
    presence: extra.presence || emptyPresence(),
    note: extra.note || "",
    name: extra.name || formatPlaceName(originLat, originLon),
    region: extra.region || formatLatLon(originLat, originLon),
  };
}

export function makeSyntheticPatch() {
  const id = chunkIdFromLatLon(HOME_LAT, HOME_LON);
  return {
    id,
    key: id.key,
    originLat: HOME_LAT,
    originLon: HOME_LON,
    sizeM: Math.max(STOCK.halfX * 2, STOCK.halfZ + STOCK.beach.endZ),
    nx: 0,
    nz: 0,
    minX: -STOCK.halfX,
    minZ: -STOCK.halfZ,
    cellX: 1,
    cellZ: 1,
    elevation: null,
    wet: null,
    floorY: -110,
    shelfY: -36,
    thermoY: -30,
    preferredDepth: -38,
    centerY: -36,
    landFrac: 0.18,
    wetFrac: 0.82,
    hasLand: true,
    synthetic: true,
    statics: true,
    current: { u: 0, v: 0 },
    presence: { herring: 1, mackerel: 1, sprat: 1, sandlance: 1, shark: 1, cod: 1 },
    note: "Synthetic North Sea shelf (offline fallback).",
    name: "Coastal shelf",
    region: "North Sea–style inner shelf",
    lab: false,
    boot: false,
  };
}

/** Empty cell shown under the world map until the user picks water or the lab. */
export function makeBootPatch() {
  const patch = makeSyntheticPatch();
  patch.boot = true;
  patch.presence = emptyPresence();
  patch.name = "World ocean";
  patch.region = "Pick a 1 km cell";
  patch.note = "The map is the home screen. Click water to enter a kilometre of ocean.";
  return patch;
}

/**
 * 10 km catalog tank: beach, inner/mid/outer shelves, a canyon to 2000 m,
 * a slope terrace, and a seamount. Every implemented animal is present.
 */
export function makeTestPatch() {
  const size = LAB_SIZE_M;
  const nx = 192;
  const nz = 192;
  const half = size / 2;
  const elevation = new Float32Array(nx * nz);
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const x = ((ix + 0.5) / nx - 0.5) * size;
      const z = ((iz + 0.5) / nz - 0.5) * size;
      elevation[iz * nx + ix] = labFloorY(x, z, half);
    }
  }
  const id = { ix: 0, iz: 0, key: "lab:catalog" };
  return makeElevationPatch(id, 22.4, -38.2, elevation, nx, nz, {
    sizeM: size,
    synthetic: true,
    lab: true,
    statics: true,
    presence: fullPresence(1),
    name: "Catalog tank",
    region: "10 km laboratory cell",
    note: "Not a real place. Every catalogued animal, a beach, stepped shelves, a canyon, a seamount, and a 2000 m basin.",
  });
}

/**
 * Stepped shelves rather than a single ramp. +Z is land.
 * Inner terrace ~40 m, mid ~110 m, outer ledge ~220 m, slope terrace
 * ~800 m, basin 2000 m, with a canyon and a seamount cutting the pattern.
 */
function labFloorY(x, z, half) {
  const zn = z / half;
  let y;
  if (zn > 0.76) {
    const u = (zn - 0.76) / 0.24;
    y = 0.4 + u * 7.2 + Math.sin(x * 0.0035) * 0.9 * u;
  } else if (zn > 0.68) {
    const u = (zn - 0.68) / 0.08;
    y = -6 + u * 6.4;
  } else if (zn > 0.32) {
    y = -40 + Math.sin(x * 0.0016) * 4;
    const channel = Math.exp(-((x - 900) * (x - 900)) / (260 * 260));
    const along = Math.exp(-((zn - 0.48) * (zn - 0.48)) / (0.07 * 0.07));
    y -= channel * along * 34;
  } else if (zn > 0.08) {
    y = -108 + Math.sin(x * 0.0011 + z * 0.0004) * 6;
    const ridge = Math.exp(-((x + 700) * (x + 700)) / (380 * 380));
    const along = Math.exp(-((zn - 0.18) * (zn - 0.18)) / (0.05 * 0.05));
    y += ridge * along * 36;
  } else if (zn > -0.04) {
    const u = (0.08 - zn) / 0.12;
    const s = u * u * (3 - 2 * u);
    y = -112 + s * (-220 + 112);
  } else if (zn > -0.22) {
    y = -220 + Math.sin(x * 0.0008) * 12;
  } else if (zn > -0.48) {
    const u = (-0.22 - zn) / 0.26;
    const s = u * u * (3 - 2 * u);
    y = -230 + s * (-820 + 230);
    y += Math.sin(x * 0.0007 + z * 0.0003) * 28;
  } else {
    const u = Math.min(1, (-0.48 - zn) / 0.52);
    y = -820 - u * 1180;
  }

  const canyonX = x + (z + 200) * 0.32;
  const canyon = Math.exp(-(canyonX * canyonX) / (420 * 420));
  const canyonMouth = zn < 0.18 ? 1 : Math.max(0, 1 - (zn - 0.18) / 0.22);
  const cut = zn < -0.12 ? 980 : 260;
  y -= canyon * canyonMouth * cut;
  y = Math.max(-2000, y);

  const smx = x + 1700;
  const smz = z + 2700;
  const seamount = Math.exp(-(smx * smx + smz * smz) / (780 * 780));
  if (y < -240) {
    const lift = Math.min(-y - 190, 1550);
    y += seamount * lift;
  }

  const knx = x - 2100;
  const knz = z + 1100;
  const knoll = Math.exp(-(knx * knx + knz * knz) / (520 * 520));
  if (zn < -0.05 && y < -500) y += knoll * 260;

  y += Math.sin(x * 0.0022 + z * 0.0014) * 3.5 + Math.sin(x * 0.008) * 1.2;
  return y;
}

export function formatLatLon(lat, lon) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}°${ns} ${Math.abs(lon).toFixed(2)}°${ew}`;
}

export function formatPlaceName(lat, lon) {
  return `Ocean cell · ${formatLatLon(lat, lon)}`;
}

const STOCK = {
  halfX: 240,
  halfZ: 280,
  floorY: -110,
  shelfY: -36,
  thermoY: -30,
  preferredDepth: -38,
  beach: {
    enabled: true,
    startZ: 36,
    shoreZ: 188,
    endZ: 258,
    shoreY: 0.18,
    duneY: 6.4,
  },
};

export function applyPatch(patch) {
  setActivePatch(patch);
  CONFIG.world.lat = patch.originLat;
  CONFIG.world.lon = patch.originLon;
  CONFIG.world.synthetic = !!patch.synthetic;
  CONFIG.world.statics = !!patch.statics;
  CONFIG.world.lab = !!patch.lab;
  const next = emptyPresence();
  const src = patch.presence || {};
  for (const id of Object.keys(next)) next[id] = src[id] ?? 0;
  if (!patch.lab) {
    for (const id of Object.keys(next)) {
      if (next[id] && SPECIES[id]?.guild === "demersal" && patch.floorY < -650) next[id] = 0;
    }
  }
  CONFIG.presence = next;
  CONFIG.flow.meanU = patch.current?.u ?? 0;
  CONFIG.flow.meanV = patch.current?.v ?? 0;
  CONFIG.maxSchools = patch.lab ? 48 : 32;
  CONFIG.schoolMinPer = patch.lab ? 80 : 0;

  if (patch.lab) {
    const half = (patch.sizeM || LAB_SIZE_M) / 2;
    CONFIG.location = "lab-cell";
    CONFIG.halfX = half;
    CONFIG.halfZ = half;
    CONFIG.floorY = patch.floorY;
    CONFIG.shelfY = patch.shelfY;
    CONFIG.initialFish = 20000;
    CONFIG.beach.enabled = true;
    CONFIG.beach.startZ = half * 0.4;
    CONFIG.beach.shoreZ = half * 0.68;
    CONFIG.beach.endZ = half;
    CONFIG.beach.shoreY = 0.18;
    CONFIG.beach.duneY = Math.max(4, patch.centerY > 0 ? patch.centerY : 6);
    bindColumnHabitat(patch.floorY, true);
    CONFIG.water.turbidity = 0.72;
    bindCellFauna();
    return patch;
  }

  if (patch.synthetic) {
    CONFIG.location = patch.boot ? "world-map" : "north-sea-shelf";
    CONFIG.halfX = STOCK.halfX;
    CONFIG.halfZ = STOCK.halfZ;
    CONFIG.floorY = STOCK.floorY;
    CONFIG.shelfY = STOCK.shelfY;
    CONFIG.initialFish = 12000;
    Object.assign(CONFIG.beach, STOCK.beach);
    bindColumnHabitat(STOCK.floorY, true);
    CONFIG.thermoY = STOCK.thermoY;
    CONFIG.fish.preferredDepth = STOCK.preferredDepth;
    CONFIG.water.turbidity = 1;
    bindCellFauna();
    return patch;
  }

  CONFIG.location = "world-cell";
  CONFIG.halfX = PATCH_SIZE_M / 2;
  CONFIG.halfZ = PATCH_SIZE_M / 2;
  CONFIG.floorY = patch.floorY;
  CONFIG.shelfY = patch.shelfY;
  CONFIG.initialFish = 12000;
  bindColumnHabitat(patch.floorY, patch.hasLand);
  if (patch.hasLand) {
    CONFIG.beach.enabled = true;
    CONFIG.beach.startZ = CONFIG.halfZ * 0.12;
    CONFIG.beach.shoreZ = CONFIG.halfZ * 0.72;
    CONFIG.beach.endZ = CONFIG.halfZ;
    CONFIG.beach.shoreY = 0.18;
    CONFIG.beach.duneY = Math.max(2, patch.centerY > 0 ? patch.centerY : 4);
  } else {
    CONFIG.beach.enabled = false;
    CONFIG.beach.startZ = CONFIG.halfZ + 400;
    CONFIG.beach.shoreZ = CONFIG.halfZ + 800;
    CONFIG.beach.endZ = CONFIG.halfZ;
    CONFIG.beach.shoreY = 0.18;
    CONFIG.beach.duneY = 6.4;
  }
  bindCellFauna();
  return patch;
}
