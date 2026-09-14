import { CONFIG } from "../config.js";

/**
 * Sea ice as `sampleTemp`'s sibling: cheap to sample anywhere.
 *
 * Concentration 0–1 is a latitude–season climatology. Thickness follows
 * concentration. Transmission is leads plus Beer–Lambert through the
 * floe — PAR, caustics, and visual hunt all read that factor. Ice algae
 * is a P source in the top metres, not a second NPZD box.
 *
 * Drift, ice age, and mapped polynyas are still gaps. Leads here are
 * 1 − concentration, not a charted breathing hole.
 */

export function climateIce(lat, lon, dayOfYear = 180) {
  const la = lat ?? CONFIG.world?.lat ?? 56;
  const lo = lon ?? CONFIG.world?.lon ?? 0;
  const doy = ((dayOfYear % 365) + 365) % 365;
  const a = Math.abs(la);
  const south = la < 0;
  if (south) {
    if (a < 54) return 0;
    const season = _season(doy, 262);
    const edge = 71 - season * 13;
    return _pack(a - edge);
  }
  if (a < 62) return 0;
  const season = _season(doy, 80);
  let summerEdge = 80;
  let winterEdge = 70;
  if (lo > 15 && lo < 62) {
    winterEdge = 72;
    summerEdge = 78;
  } else if (lo < -40 || lo > 100) {
    winterEdge = 62;
    summerEdge = 74;
  }
  const edge = summerEdge - season * (summerEdge - winterEdge);
  return _pack(a - edge);
}

function _season(doy, peak) {
  return 0.5 + 0.5 * Math.cos(((doy - peak) / 365) * Math.PI * 2);
}

function _pack(dist) {
  if (dist < -8) return 0;
  const conc = 0.5 + dist / 16;
  if (conc <= 0) return 0;
  if (conc >= 0.98) return 0.98;
  return conc;
}

export function iceThickness(conc) {
  const c = conc ?? 0;
  if (c < 0.02) return 0;
  return 0.22 + c * 1.85;
}

/**
 * Under-ice PAR factor 0–1. Open water and leads stay near 1.
 * Pack ice with a thin snow skin transmits a few percent.
 */
export function iceTransmit(conc) {
  const c = conc ?? CONFIG.water?.ice ?? 0;
  if (c < 0.02) return 1;
  const leads = 1 - c;
  const h = iceThickness(c);
  const tau = Math.exp(-1.55 * h - 0.55);
  return Math.min(1, leads * 0.94 + c * Math.max(0.012, tau));
}

/** Extra P target in the ice-water film. Zero below ~10 m or without ice. */
export function iceAlgaeWant(y, par) {
  const ice = CONFIG.water?.ice ?? 0;
  if (ice < 0.05 || y < -10) return 0;
  const film = Math.max(0, 1 + y / 10);
  const light = Math.max(0, par ?? 0);
  return ice * film * (0.28 + 0.72 * light);
}

export function bindCellIce() {
  const lat = CONFIG.world?.lat ?? 56;
  const lon = CONFIG.world?.lon ?? 0;
  const doy = CONFIG.time?.dayIndex ?? 180;
  if (CONFIG.world?.lab) {
    CONFIG.water.ice = 0;
    CONFIG.water.iceH = 0;
    CONFIG.water.iceT = 1;
    return;
  }
  const raw = climateIce(lat, lon, doy) + (CONFIG.water?.iceAnomaly ?? 0);
  const c = Math.min(0.98, Math.max(0, raw));
  CONFIG.water.ice = c;
  CONFIG.water.iceH = iceThickness(c);
  CONFIG.water.iceT = iceTransmit(c);
}
