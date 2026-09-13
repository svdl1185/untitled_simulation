import { CONFIG, photicLimitY } from "../config.js";

/**
 * Photosynthetically active radiation. Optics and NPZD share this
 * Beer–Lambert envelope — turbidity shallows both fog and growth.
 *
 * I(z) = I0 · exp(−Kd · depth). Kd is set so the 1% light depth matches
 * `photicLimitY()` before the seafloor clips it.
 */

export function attenuationKd() {
  const turb = Math.max(0.35, CONFIG.water?.turbidity ?? 1);
  const open = (CONFIG.water?.photicY ?? -180) / turb;
  const z = Math.max(24, -open);
  return Math.log(100) / z;
}

/** Surface PAR 0–1 from the day look (sun elevation, night, storm). */
export function surfacePAR(look) {
  const night = look?.night ?? 0;
  const dawn = look?.dawn ?? 0;
  const dusk = look?.dusk ?? 0;
  const caustic = look?.caustic ?? 0.5;
  const storm = look?.storm ?? 0;
  const sunY = look?.sunDir?.y;
  const elev = sunY == null ? 1 - night : Math.max(0, sunY);
  const day =
    (1 - night) * (0.2 + 0.8 * Math.max(caustic, elev)) + dawn * 0.2 + dusk * 0.12;
  return Math.max(0.02, day) * (1 - storm * 0.38);
}

/** PAR at depth `y` (metres, more negative = deeper). */
export function samplePAR(y, look) {
  const I0 = surfacePAR(look);
  const depth = Math.max(0, -y);
  return I0 * Math.exp(-attenuationKd() * depth);
}

export function photicY() {
  return photicLimitY();
}
