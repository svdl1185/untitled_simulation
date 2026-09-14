import { CONFIG } from "../config.js";

/**
 * Temperature as `sampleFlow`'s sibling: cheap to sample anywhere.
 *
 * SST is a latitude climatology plus a seasonal cycle and an optional
 * anomaly (El Niño-style slider). The mixed layer is well-mixed; below
 * it temperature falls toward a deep value. Q10 scales rates.
 */

export function meanSST(lat) {
  const a = Math.abs(lat);
  const trop = 27.6 * Math.cos((a * Math.PI) / 148);
  const polar = a > 55 ? (a - 55) * 0.2 : 0;
  return Math.max(-1.7, trop - polar);
}

export function climatologySST(lat, dayOfYear = 180) {
  const mean = meanSST(lat);
  const a = Math.abs(lat);
  const amp = 1.2 + 7.4 * Math.sin((a * Math.PI) / 180) ** 1.35;
  const phase = lat >= 0 ? 1 : -1;
  const seasonal = amp * Math.sin(((dayOfYear - 110) / 365) * Math.PI * 2) * phase;
  const anomaly = CONFIG.water?.sstAnomaly ?? 0;
  const sst = mean + seasonal + anomaly;
  if (sst < -1.8) return -1.8;
  if (sst > 31) return 31;
  return sst;
}

/** Mixed-layer depth as a negative y. Winter mixes deeper; storms mix
 *  deeper still. The floor always wins. */
export function mixedLayerY(
  lat = CONFIG.world?.lat ?? 56,
  dayOfYear,
  floorY = CONFIG.floorY,
  storm = 0
) {
  const doy = dayOfYear ?? CONFIG.time?.dayIndex ?? 180;
  const sst = climatologySST(lat, doy);
  const a = Math.abs(lat);
  const phase = lat >= 0 ? 1 : -1;
  const winter = 0.5 - 0.5 * Math.sin(((doy - 110) / 365) * Math.PI * 2) * phase;
  let mld = 26 + winter * (36 + a * 0.45);
  if (sst > 24) mld = 38 + winter * 22;
  if (a > 60) mld = 18 + winter * 28;
  mld += Math.max(0, storm) * (20 + a * 0.18);
  const floor = (floorY ?? CONFIG.floorY) + 8;
  return Math.max(floor, -mld);
}

export function deepTemp(sst) {
  if (sst < 4) return Math.max(-1.5, sst * 0.35 - 0.4);
  return Math.max(1.4, Math.min(5.2, 2.2 + sst * 0.08));
}

/**
 * Temperature (°C) at a point. `x`/`z` reserved for later fronts.
 * `t` unused; season lives on `CONFIG.time.dayIndex`.
 */
export function sampleTemp(x, y, z, t) {
  const lat = CONFIG.world?.lat ?? 56;
  const doy = CONFIG.time?.dayIndex ?? 180;
  const sst = climatologySST(lat, doy);
  const mld = CONFIG.thermoY ?? mixedLayerY(lat, doy);
  const deep = deepTemp(sst);
  if (y >= mld) return sst;
  const span = Math.max(24, Math.abs(CONFIG.floorY - mld));
  const u = Math.min(1, (mld - y) / span);
  const s = u * u * (3 - 2 * u);
  return sst + (deep - sst) * s;
}

export function q10Factor(temp, ref, q) {
  const Tref = ref ?? CONFIG.water?.tRef ?? 10;
  const Q = q ?? CONFIG.water?.q10 ?? 2;
  const f = Q ** ((temp - Tref) / 10);
  if (f < 0.42) return 0.42;
  if (f > 2.85) return 2.85;
  return f;
}

/** Q10 at the mixed layer relative to this cell's SST — animals stay
 *  calibrated. Vertical departure (colder deep water) still slows them. */
export function columnQ10() {
  const y = CONFIG.thermoY ?? mixedLayerY();
  const T = sampleTemp(0, y, 0);
  const ref = CONFIG.water?.sst ?? T;
  return q10Factor(T, ref, 1.55);
}

/** Absolute Q10 for phytoplankton growth — tropics produce faster. */
export function productionQ10() {
  const sst = CONFIG.water?.sst ?? climatologySST(CONFIG.world?.lat ?? 56);
  return q10Factor(sst, CONFIG.water?.tRef ?? 10, CONFIG.water?.q10 ?? 2);
}

export function inTempNiche(sst, niche) {
  if (!niche) return true;
  const t = sst;
  if (niche.min != null && t < niche.min) return false;
  if (niche.max != null && t > niche.max) return false;
  return true;
}

/** Bind mixed-layer depth and a cell SST onto CONFIG. `storm` 0–1 deepens the mixed layer. */
export function bindCellTemperature(storm = 0) {
  const lat = CONFIG.world?.lat ?? 56;
  const doy = CONFIG.time?.dayIndex ?? 180;
  const sst = climatologySST(lat, doy);
  CONFIG.water.sst = sst;
  CONFIG.thermoY = mixedLayerY(lat, doy, CONFIG.floorY, storm);
}
