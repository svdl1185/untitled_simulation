import { CONFIG } from "../config.js";
import { climatologySST, mixedLayerY } from "./temperature.js";

/**
 * Dissolved oxygen as `sampleTemp`'s sibling: cheap to sample anywhere.
 *
 * Units are ml L⁻¹. The mixed layer sits near saturation from SST.
 * Eastern-boundary and tropical cells get an oxygen-minimum zone below
 * that; deep water recovers. Detritus remineralisation subtracts a live
 * demand. `o2Anomaly` shifts the whole column.
 */

const _oxyCache = new Map();

export function saturationO2(sst) {
  const T = sst ?? 10;
  return 7.9 * Math.exp(-0.018 * T) + 0.4;
}

/**
 * Climatological OMZ intensity 0–1. Eastern tropical Pacific, eastern
 * tropical Atlantic, and the Arabian Sea are the strong cells. Poles
 * and the North Sea are zero. Lab cells force a refuge so Humboldt's
 * day band is visible in the catalog tank.
 */
export function climateOmz(lat, lon) {
  const a = Math.abs(lat);
  if (a > 52) return 0;
  const trop = Math.max(0, Math.cos((a * Math.PI) / 104));
  let east = 0;
  if (lon > -130 && lon < -70) {
    east = lon > -95 ? 1 : 0.55 + (0.45 * (lon + 130)) / 35;
  }
  if (lon > -25 && lon < 18 && lat > -32 && lat < 22) {
    east = Math.max(east, 0.72);
  }
  if (lon > 42 && lon < 100 && lat > -8 && lat < 26) {
    east = Math.max(east, 0.88);
  }
  const open = a < 18 ? 0.22 : a < 28 ? 0.08 : 0;
  return Math.min(1, Math.max(east, open) * (0.35 + 0.65 * trop));
}

export function omzStrength(lat, lon) {
  if (CONFIG.world?.lab) return Math.max(CONFIG.water?.omz ?? 0.82, 0.82);
  const la = lat ?? CONFIG.world?.lat ?? 56;
  const lo = lon ?? CONFIG.world?.lon ?? 0;
  if (CONFIG.water?.omz != null && la === CONFIG.world?.lat && lo === CONFIG.world?.lon) {
    return CONFIG.water.omz;
  }
  return climateOmz(la, lo);
}

function _state(lat, lon) {
  const la = lat ?? CONFIG.world?.lat ?? 56;
  const lo = lon ?? CONFIG.world?.lon ?? 0;
  const sst = CONFIG.water?.sst ?? climatologySST(la);
  const sat = saturationO2(sst);
  const mld = CONFIG.thermoY ?? mixedLayerY(la);
  const strength = omzStrength(la, lo);
  const anomaly = CONFIG.water?.o2Anomaly ?? 0;
  const demand = CONFIG.water?.o2Demand ?? 0;
  const omzMin = sat * (0.7 - 0.66 * strength) + 0.04;
  const pacific = lo < -70 || lo > 120;
  const deep = (pacific ? 2.6 : 5.1) - 0.7 * strength;
  const core = _coreY(la, lo, strength, mld);
  return { sat, mld, strength, anomaly, demand, omzMin, deep, core, floor: CONFIG.floorY };
}

function _coreY(lat, lon, strength, mld) {
  const s = strength ?? omzStrength(lat, lon);
  if (s < 0.12) return null;
  const y = -260 - s * 420;
  const floor = (CONFIG.floorY ?? -2000) + 24;
  const cap = (mld ?? mixedLayerY(lat)) - 80;
  return Math.max(floor, Math.min(cap, y));
}

/** Depth of the O₂ minimum, or null when the column has no OMZ. */
export function omzCoreY(lat, lon) {
  const s = _state(lat, lon);
  const min = s.omzMin - s.demand + s.anomaly;
  if (s.core == null || min > 1.2) return null;
  return s.core;
}

function _invSmooth(s) {
  if (s <= 0) return 0;
  if (s >= 1) return 1;
  let u = s;
  for (let i = 0; i < 4; i++) {
    const f = u * u * (3 - 2 * u) - s;
    const df = 6 * u * (1 - u);
    if (df < 1e-8) break;
    u -= f / df;
  }
  return Math.min(1, Math.max(0, u));
}

/**
 * Shallowest depth where O₂ falls below `threshold` ml L⁻¹.
 * Null if the column never goes that low.
 */
export function oxyclineY(threshold = 1.4) {
  const key = Math.round((threshold ?? 1.4) * 20) / 20;
  if (_oxyCache.has(key)) return _oxyCache.get(key);
  const s = _state();
  const surf = s.sat * 0.96 - s.demand * 0.15 + s.anomaly;
  if (surf < key) {
    _oxyCache.set(key, -2);
    return -2;
  }
  const coreMin = s.omzMin - s.demand + s.anomaly;
  if (s.core == null || coreMin >= key) {
    _oxyCache.set(key, null);
    return null;
  }
  const span = Math.max(40, s.mld - s.core);
  const t = (key - s.sat * 0.96) / (s.omzMin - s.sat * 0.96);
  const y = s.mld - _invSmooth(Math.min(1, Math.max(0, t))) * span;
  _oxyCache.set(key, y);
  return y;
}

/**
 * Dissolved oxygen (ml L⁻¹) at a point. `x`/`z` reserved for later
 * fronts. Live demand from NPZD peaks around the OMZ core.
 */
export function sampleO2(x, y, z) {
  const s = _state();
  const surf = s.sat * 0.96 - s.demand * 0.15 + s.anomaly;
  if (y >= s.mld) return _clampO2(surf);
  const core = s.core ?? s.mld - 180;
  let o2;
  if (y > core) {
    const span = Math.max(40, s.mld - core);
    const u = Math.min(1, (s.mld - y) / span);
    const w = u * u * (3 - 2 * u);
    o2 = s.sat * 0.96 + (s.omzMin - s.sat * 0.96) * w;
  } else {
    const span = Math.max(80, core - (s.floor + 20));
    const u = Math.min(1, (core - y) / span);
    const w = u * u * (3 - 2 * u);
    o2 = s.omzMin + (s.deep - s.omzMin) * w;
  }
  const dy = y - core;
  const uDemand = Math.exp(-(dy * dy) / (220 * 220));
  o2 -= s.demand * (0.25 + 0.75 * uDemand);
  return _clampO2(o2 + s.anomaly);
}

function _clampO2(v) {
  if (v < 0.02) return 0.02;
  if (v > 9) return 9;
  return v;
}

/**
 * Deepest y this animal may occupy: biological maxDepth, then the
 * oxycline for `o2Min`. OMZ-refuge species are not clamped by hypoxia.
 */
export function oxygenLimitY(cfg) {
  const bio = cfg?.maxDepth ?? CONFIG.fish.maxDepth ?? -180;
  if (!cfg || cfg.omzRefuge) return bio;
  const min = cfg.o2Min;
  if (min == null || min <= 0) return bio;
  const y = oxyclineY(min);
  if (y == null) return bio;
  return Math.max(bio, y);
}

/** Hypoxia raises drain for intolerant animals. OMZ specialists stay at 1. */
export function o2MetabolicFactor(y, cfg) {
  if (cfg?.omzRefuge) return 1;
  const min = cfg?.o2Min;
  if (min == null || min <= 0) return 1;
  const o2 = sampleO2(0, y, 0);
  if (o2 >= min) return 1;
  const stress = (min - o2) / Math.max(0.2, min);
  return 1 + Math.min(0.85, stress * 0.9);
}

export function inOxygenNiche(lat, lon, niche) {
  if (!niche) return true;
  if (niche.needOmz && climateOmz(lat, lon) < 0.18) return false;
  return true;
}

/** Detritus remineralisation consumes O₂ around the OMZ / thermocline. */
export function setOxygenDemand(meanD, meanB) {
  const want = Math.min(1.6, (meanD ?? 0) * 1.8 + (meanB ?? 0) * 0.35);
  const cur = CONFIG.water.o2Demand ?? 0;
  CONFIG.water.o2Demand = cur + (want - cur) * 0.08;
  _oxyCache.clear();
}

export function bindCellOxygen() {
  const lat = CONFIG.world?.lat ?? 56;
  const lon = CONFIG.world?.lon ?? 0;
  CONFIG.water.omz = CONFIG.world?.lab ? 0.82 : climateOmz(lat, lon);
  CONFIG.water.o2Sat = saturationO2(CONFIG.water.sst ?? climatologySST(lat));
  CONFIG.water.omzCoreY = omzCoreY(lat, lon);
  _oxyCache.clear();
}
