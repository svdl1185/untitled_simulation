import { openPhoticY } from "../config.js";

/**
 * Photosynthetically active radiation. Optics and NPZD share this
 * Beer–Lambert envelope — turbidity shallows both fog and growth.
 *
 * I(z) = I0 · exp(−Kd · depth). Kd is set so the 1% light depth matches
 * `openPhoticY()` (turbidity). A shelf floor shallower than that is still
 * in the envelope — do not treat the sand as the 1% depth.
 */

let _kd = 4.605170186 / 180;
let _kdOpen = NaN;

export function attenuationKd() {
  const open = openPhoticY();
  if (open === _kdOpen) return _kd;
  _kdOpen = open;
  const z = Math.max(24, -open);
  _kd = Math.log(100) / z;
  return _kd;
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

/**
 * 0–1 how well a visual hunter can see at `y`. 1 in the bright photic,
 * ~0 below the 1% depth or on a dark night. Same Kd as `samplePAR`.
 */
export function visualClarity(y, look) {
  return Math.min(1, Math.sqrt(samplePAR(y, look) / 0.18));
}

/**
 * Detect / fear range in metres. `base` is the daylight radius.
 * `glow` 0–1 is photophore prey: restores a fraction of `base` in the
 * dark so lanternfish stay findable in the DSL. Echolocators should
 * skip this and use `base`.
 */
export function visualRange(y, look, base, glow = 0) {
  const b = Math.max(0, base);
  const clear = visualClarity(y, look);
  const floor = 0.1;
  const seen = b * (floor + (1 - floor) * clear);
  if (!(glow > 0) || clear >= 0.98) return seen;
  const dsl = b * (0.18 + 0.32 * Math.min(1, glow));
  return Math.max(seen, seen * clear + dsl * (1 - clear));
}

/**
 * Scale on mouth radius for a sighted bite. Floor stays high enough
 * that overlapping still counts; photophores help a little in the dark
 * but do not enlarge the mouth.
 */
export function visualBiteScale(y, look, glow = 0) {
  const vis = visualScales(y, look);
  return glow > 0 ? vis.biteGlow : vis.bite;
}

/**
 * One PAR sample: clarity plus both bite scales. Call once per hunter
 * per frame — do not run Beer–Lambert inside the school eat loop.
 */
export function visualScales(y, look) {
  const clear = visualClarity(y, look);
  const bite = 0.32 + 0.68 * clear;
  let biteGlow = bite;
  if (clear < 0.98) {
    const dsl = 0.6;
    biteGlow = Math.max(bite, bite * clear + dsl * (1 - clear));
  }
  return { clear, bite, biteGlow };
}

/**
 * Sighted hunters read PAR. Echolocators (`sense: "echo"`) and
 * filter-only diets do not — darkness is not a starve for them.
 */
export function visualHunter(cfg) {
  if (!cfg) return true;
  if (cfg.sense === "echo") return false;
  if ((cfg.diet || "bite") === "filter") return false;
  return true;
}

export function photicY() {
  return openPhoticY();
}
