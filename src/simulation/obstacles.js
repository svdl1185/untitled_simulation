import { CONFIG } from "../config.js";

export function seafloorHeight(x, z) {
  const b = CONFIG.beach;
  const zWave =
    z - Math.sin(x * 0.0105) * 14 - Math.sin(x * 0.028) * 5.5;
  const dunes =
    Math.sin(x * 0.045 + z * 0.02) * 1.6 +
    Math.sin(z * 0.07) * 1.1 +
    Math.sin(x * 0.16 + z * 0.12) * 0.35;

  let t = (zWave - b.startZ) / (b.shoreZ - b.startZ);
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  t = t * t * (3 - 2 * t);
  const duneAmp = 1 - t * 0.72;
  let y = CONFIG.floorY + dunes * duneAmp + t * (b.shoreY - CONFIG.floorY);

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
