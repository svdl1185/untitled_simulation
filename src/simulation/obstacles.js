import { CONFIG } from "../config.js";

export function seafloorHeight(x, z) {
  const b = CONFIG.beach;
  const zWave =
    z - Math.sin(x * 0.0105) * 14 - Math.sin(x * 0.028) * 5.5;
  const dunes =
    Math.sin(x * 0.045 + z * 0.02) * 1.6 +
    Math.sin(z * 0.07) * 1.1 +
    Math.sin(x * 0.16 + z * 0.12) * 0.35;

  const shelf = CONFIG.shelfY;
  let basinT = (b.startZ - zWave) / (b.startZ + CONFIG.halfZ);
  if (basinT < 0) basinT = 0;
  else if (basinT > 1) basinT = 1;
  basinT = basinT * basinT * (3 - 2 * basinT);
  const offshore = shelf + basinT * (CONFIG.floorY - shelf);

  let t = (zWave - b.startZ) / (b.shoreZ - b.startZ);
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  t = t * t * (3 - 2 * t);
  const duneAmp = 1 - t * 0.72;
  let y = offshore + dunes * duneAmp + t * (b.shoreY - shelf);

  if (zWave > b.shoreZ) {
    let u = (zWave - b.shoreZ) / (b.endZ - b.shoreZ);
    if (u < 0) u = 0;
    else if (u > 1) u = 1;
    u = u * u * (3 - 2 * u);
    y =
      b.shoreY +
      u * (b.duneY - b.shoreY) +
      Math.sin(x * 0.07) * 0.5 * u +
      Math.sin(x * 0.2 + z * 0.09) * 0.22 * u;
  }
  return y;
}

export function seafloorSlope(x, z, eps = 3.2) {
  const dx = seafloorHeight(x + eps, z) - seafloorHeight(x - eps, z);
  const dz = seafloorHeight(x, z + eps) - seafloorHeight(x, z - eps);
  return { x: dx / (eps * 2), z: dz / (eps * 2) };
}

export function waterColumn(x, z) {
  const cfg = CONFIG.fish;
  return -cfg.surfaceClearance - (seafloorHeight(x, z) + cfg.floorClearance);
}

/** How soon heading (hx, hz) runs out of water. urgency 0..1. */
export function lookAheadShore(x, z, hx, hz, look) {
  const need = CONFIG.fish.beachTurnWater;
  let worst = waterColumn(x, z);
  let hitX = x;
  let hitZ = z;
  const d1 = look * 0.38;
  const d2 = look * 0.72;
  for (const d of [d1, d2, look]) {
    const sx = x + hx * d;
    const sz = z + hz * d;
    const col = waterColumn(sx, sz);
    if (col < worst) {
      worst = col;
      hitX = sx;
      hitZ = sz;
    }
  }
  const span = Math.max(8, need - CONFIG.fish.minWater);
  const urgency = worst >= need ? 0 : Math.min(1, (need - worst) / span);
  if (urgency <= 0) return { urgency: 0, gx: 0, gz: 0, col: worst };
  const sl = seafloorSlope(hitX, hitZ, 6);
  return { urgency, gx: sl.x, gz: sl.z, col: worst };
}

export function steerOffShore(hx, hz, urgency, gx, gz, rate = 0.22) {
  if (urgency <= 0) return { hx, hz };
  let dx = -gx;
  let dz = -gz;
  if (Math.hypot(dx, dz) < 0.06) {
    dx = 0;
    dz = -1;
  }
  if (dz > 0.2) dz = 0.2;
  const len = Math.hypot(dx, dz) || 1;
  dx /= len;
  dz /= len;
  const mix = Math.min(1, (0.32 + urgency * 1.7) * rate);
  let nx = hx * (1 - mix) + dx * mix;
  let nz = hz * (1 - mix) + dz * mix;
  const nlen = Math.hypot(nx, nz) || 1;
  return { hx: nx / nlen, hz: nz / nlen };
}

export function steerFromColliders(px, py, pz, colliders, count, pad, weight) {
  let ax = 0;
  let ay = 0;
  let az = 0;
  if (!colliders || count <= 0) return { ax, ay, az };
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    const dx = px - colliders[o];
    const dy = py - colliders[o + 1];
    const dz = pz - colliders[o + 2];
    const r = colliders[o + 3] + pad;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > r * r || d2 < 1e-8) continue;
    const d = Math.sqrt(d2);
    const push = ((r - d) / (d + 0.08)) * weight;
    ax += (dx / d) * push;
    ay += (dy / d) * push * 0.55;
    az += (dz / d) * push;
  }
  return { ax, ay, az };
}

export function resolveColliders(px, py, pz, colliders, count, pad) {
  if (!colliders || count <= 0) return { x: px, y: py, z: pz };
  let x = px;
  let y = py;
  let z = pz;
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    const dx = x - colliders[o];
    const dy = y - colliders[o + 1];
    const dz = z - colliders[o + 2];
    const r = colliders[o + 3] + pad;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= r * r || d2 < 1e-8) continue;
    const d = Math.sqrt(d2);
    const s = r / d;
    x = colliders[o] + dx * s;
    y = colliders[o + 1] + dy * s;
    z = colliders[o] + dz * s;
  }
  return { x, y, z };
}
