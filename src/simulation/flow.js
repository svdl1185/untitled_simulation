import { CONFIG, hasBeach } from "../config.js";

const _out = { x: 0, y: 0, z: 0 };
const TWO_PI = Math.PI * 2;

/**
 * Local current. Tide, longshore, thermocline shear, plus an atlas mean
 * (east → X, north → Z). Cheap enough to sample per fish.
 */
export function sampleFlow(x, y, z, t, storm = 0, out = _out) {
  const cfg = CONFIG.flow;
  const thermo = CONFIG.thermoY;
  const beachOn = hasBeach();
  const shoreZ = CONFIG.beach.shoreZ;
  const startZ = CONFIG.beach.startZ;

  let shore = 0;
  if (beachOn) {
    shore = (z - startZ) / (shoreZ - startZ);
    if (shore < 0) shore = 0;
    else if (shore > 1) shore = 1;
    shore = shore * shore * (3 - 2 * shore);
  }
  const open = 1 - shore * 0.92;

  const water = Math.max(8, -CONFIG.floorY);
  let depth01 = -y / water;
  if (depth01 < 0) depth01 = 0;
  else if (depth01 > 1) depth01 = 1;
  const depthMul = 1 - depth01 * 0.72;

  const stormMul = 1 + storm * cfg.stormMul;
  const tide = Math.sin((t / cfg.tidePeriod) * TWO_PI);
  const long = Math.sin((t / cfg.longshorePeriod) * TWO_PI + 0.7);

  let u = (0.28 + long * cfg.longshore) * (0.35 + shore * 0.9) * depthMul;
  let w = tide * cfg.tide * open * depthMul;

  const shearGate = 1 / (1 + ((y - thermo) * (y - thermo)) / 22);
  const shearSign = Math.tanh((y - thermo) * 0.22);
  u += shearSign * cfg.shear * shearGate * open;
  w += -shearSign * cfg.shear * 0.35 * shearGate * open;

  const eddy =
    Math.sin(x * 0.018 + z * 0.014 + t * 0.11) * 0.22 +
    Math.sin(x * 0.041 - z * 0.027 - t * 0.07) * 0.12;
  u += eddy * open * depthMul;
  w += Math.sin(x * 0.015 - z * 0.02 + t * 0.09) * 0.16 * open * depthMul;

  let v = Math.sin(x * 0.02 + t * 0.28) * 0.12 * shearGate;
  v += storm * Math.sin(x * 0.05 + z * 0.04 + t * 1.1) * 0.18;

  u += (cfg.meanU || 0) * open * depthMul;
  w += (cfg.meanV || 0) * open * depthMul;

  u *= stormMul;
  v *= stormMul;
  w *= stormMul;

  if (beachOn && z > shoreZ - 18) {
    const dry = (z - (shoreZ - 18)) / 18;
    u *= Math.max(0, 1 - dry);
    v *= Math.max(0, 1 - dry);
    w *= Math.max(0, 1 - dry);
  }

  out.x = u;
  out.y = v;
  out.z = w;
  return out;
}
