import { CONFIG, hasBeach, waterMaxZ } from "../config.js";
import { getActivePatch, samplePatchElevation } from "../world/patch.js";

function syntheticSeafloor(x, z) {
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

export function seafloorHeight(x, z) {
  const patch = getActivePatch();
  if (patch?.elevation) {
    const detail = patch.lab ? 1.8 : 0.35;
    let y = samplePatchElevation(patch, x, z);
    y += Math.sin(x * 0.045 + z * 0.02) * detail + Math.sin(x * 0.16 + z * 0.12) * detail * 0.35;
    return y;
  }
  return syntheticSeafloor(x, z);
}

export function seafloorSlope(x, z, eps = 3.2) {
  const dx = seafloorHeight(x + eps, z) - seafloorHeight(x - eps, z);
  const dz = seafloorHeight(x, z + eps) - seafloorHeight(x, z - eps);
  return { x: dx / (eps * 2), z: dz / (eps * 2) };
}

/** Local floor an animal may occupy: seafloor + clearance, then biological max. */
export function columnFloorY(x, z, maxDepth, clearance) {
  const ground = seafloorHeight(x, z);
  const clear = clearance ?? CONFIG.fish.floorClearance ?? 2.2;
  const bio = maxDepth ?? CONFIG.fish.maxDepth ?? -180;
  return Math.max(ground + clear, bio);
}

/**
 * Keep a vertical target in the water at this (x, z). `CONFIG.floorY` is
 * the cell minimum — a dropoff or seamount is the floor that matters.
 */
export function clampLocalY(y, x, z, maxDepth, clearance) {
  const floor = columnFloorY(x, z, maxDepth, clearance);
  const ceil = -(CONFIG.fish.surfaceClearance ?? 1.35) - 0.4;
  if (floor >= ceil - 0.5) return (ceil + Math.min(floor, ceil)) * 0.5;
  if (y < floor) return floor;
  if (y > ceil) return ceil;
  return y;
}

/**
 * Seed an animal in its typical band without putting it in the rock.
 * If the local column is too shallow for `wantY`, step toward deeper
 * water until the band fits (or sit at the deepest water in the cell).
 */
export function placeInColumn(x, z, wantY, opts = {}) {
  const maxDepth = opts.maxDepth;
  const clearance = opts.clearance ?? CONFIG.fish.floorClearance ?? 2.2;
  const minWater = opts.minWater ?? CONFIG.fish.minWater ?? 12;
  const ceil = -(CONFIG.fish.surfaceClearance ?? 1.35) - 0.4;
  const margin = 24;
  const minX = -CONFIG.halfX + margin;
  const maxX = CONFIG.halfX - margin;
  const minZ = -CONFIG.halfZ + margin;
  const maxZ = waterMaxZ() - margin;
  const clampX = (v) => (v < minX ? minX : v > maxX ? maxX : v);
  const clampZ = (v) => (v < minZ ? minZ : v > maxZ ? maxZ : v);
  let px = clampX(x);
  let pz = clampZ(z);
  const span = Math.min(CONFIG.halfX, CONFIG.halfZ);
  const step = Math.max(18, span * 0.05);
  const dirs = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
    [-0.7, -0.7],
    [0.7, -0.7],
    [-0.7, 0.7],
    [0.7, 0.7],
  ];

  const scoreAt = (gx, gz) => {
    const ground = seafloorHeight(gx, gz);
    const wetFloor = ground + clearance;
    const column = ceil - wetFloor;
    if (column < minWater) return -1e9 + column;
    const room = wantY - wetFloor;
    if (room >= -0.4) return 1e6 - Math.abs(room - 8);
    return room;
  };

  let bestX = px;
  let bestZ = pz;
  let best = scoreAt(px, pz);
  for (let i = 0; i < 20; i++) {
    if (best >= 1e6 - 400) break;
    const sl = seafloorSlope(px, pz);
    const slen = Math.hypot(sl.x, sl.z) || 1;
    let nextX = clampX(px - (sl.x / slen) * step);
    let nextZ = clampZ(pz - (sl.z / slen) * step);
    let nextS = scoreAt(nextX, nextZ);
    for (let d = 0; d < dirs.length; d++) {
      const cx = clampX(px + dirs[d][0] * step);
      const cz = clampZ(pz + dirs[d][1] * step);
      const sc = scoreAt(cx, cz);
      if (sc > nextS) {
        nextS = sc;
        nextX = cx;
        nextZ = cz;
      }
    }
    if (nextS <= best + 0.05) break;
    px = nextX;
    pz = nextZ;
    best = nextS;
    bestX = px;
    bestZ = pz;
  }
  return { x: bestX, y: clampLocalY(wantY, bestX, bestZ, maxDepth, clearance), z: bestZ };
}

/**
 * Camera (or any visitor) that wants depth `wantY`. If this (x, z) is
 * too shallow, pick the nearest wet sample that actually has that
 * column. Empty elevation falls back to `placeInColumn`.
 */
export function findWaterAtDepth(x, z, wantY, opts = {}) {
  const clearance = opts.clearance ?? 6;
  const maxDepth = opts.maxDepth ?? CONFIG.floorY;
  const here = seafloorHeight(x, z);
  if (here <= wantY - clearance) {
    return { x, y: clampLocalY(wantY, x, z, maxDepth, clearance), z };
  }
  const patch = getActivePatch();
  const elev = patch?.elevation;
  const nx = patch?.nx | 0;
  const nz = patch?.nz | 0;
  if (!elev || nx < 4 || nz < 4) {
    return placeInColumn(x, z, wantY, { ...opts, clearance, maxDepth });
  }
  const need = wantY - clearance;
  let bestX = x;
  let bestZ = z;
  let bestD = Infinity;
  let deepX = x;
  let deepZ = z;
  let deepY = here;
  const minX = patch.minX;
  const minZ = patch.minZ;
  const cellX = patch.cellX;
  const cellZ = patch.cellZ;
  for (let iz = 0; iz < nz; iz++) {
    const gz = minZ + (iz + 0.5) * cellZ;
    for (let ix = 0; ix < nx; ix++) {
      const gy = elev[iz * nx + ix];
      if (gy < deepY) {
        deepY = gy;
        deepX = minX + (ix + 0.5) * cellX;
        deepZ = gz;
      }
      if (gy > need) continue;
      const gx = minX + (ix + 0.5) * cellX;
      const dx = gx - x;
      const dz = gz - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        bestX = gx;
        bestZ = gz;
      }
    }
  }
  if (!(bestD < Infinity)) {
    bestX = deepX;
    bestZ = deepZ;
  }
  return { x: bestX, y: clampLocalY(wantY, bestX, bestZ, maxDepth, clearance), z: bestZ };
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
    dz = hasBeach() ? -1 : (hz < 0 ? -1 : 1);
  }
  if (hasBeach() && dz > 0.2) dz = 0.2;
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
