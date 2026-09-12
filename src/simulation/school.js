import { CONFIG } from "../config.js";
import { UniformGrid3D } from "./grid.js";
import { steerFromColliders, resolveColliders, seafloorHeight, seafloorSlope } from "./obstacles.js";
import { sampleFlow } from "./flow.js";

const NEAR_K = 6;
const NEIGHBOR_BUDGET = 40;
const N27X = new Int8Array(27);
const N27Y = new Int8Array(27);
const N27Z = new Int8Array(27);
{
  let n = 0;
  N27X[n] = 0;
  N27Y[n] = 0;
  N27Z[n++] = 0;
  const faces = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  for (const [x, y, z] of faces) {
    N27X[n] = x;
    N27Y[n] = y;
    N27Z[n++] = z;
  }
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      N27X[n] = x;
      N27Y[n] = y;
      N27Z[n++] = 0;
    }
  }
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      N27X[n] = x;
      N27Y[n] = 0;
      N27Z[n++] = z;
    }
  }
  for (const y of [-1, 1]) {
    for (const z of [-1, 1]) {
      N27X[n] = 0;
      N27Y[n] = y;
      N27Z[n++] = z;
    }
  }
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      for (const z of [-1, 1]) {
        N27X[n] = x;
        N27Y[n] = y;
        N27Z[n++] = z;
      }
    }
  }
}

/**
 * Herring schools on a shared uniform grid.
 *
 * Spacing is nearest-neighbor packing (project + spring on the K closest
 * fish), not a crowd of cancelling forces. Alignment is same-school only
 * so each shoal stays polarized. A soft pancake envelope keeps the volume
 * flat without crushing the interior. Shark fear turns the school aside
 * instead of detonating it.
 */
export class School {
  constructor(count) {
    const max = CONFIG.maxFish;
    this.max = max;
    this.maxSchools = CONFIG.maxSchools;
    this.initialSchools = CONFIG.schoolCount;
    this.schoolCount = CONFIG.schoolCount;
    this.count = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.phase = new Float32Array(max);
    this.scale = new Float32Array(max);
    this.schoolId = new Uint8Array(max);

    this.centroid = { x: 0, y: CONFIG.fish.preferredDepth, z: 0 };
    this.centroids = [];
    this.anchors = [];
    this.schoolN = new Uint32Array(this.maxSchools);
    this._sx = new Float64Array(this.maxSchools);
    this._sy = new Float64Array(this.maxSchools);
    this._sz = new Float64Array(this.maxSchools);
    this._svx = new Float64Array(this.maxSchools);
    this._svz = new Float64Array(this.maxSchools);
    this._splitLock = new Float32Array(this.maxSchools);
    this._mark = new Uint8Array(max);
    this._nj = new Int32Array(NEAR_K);
    this._nd = new Float32Array(NEAR_K);
    this._orgT = 0;
    this.colliders = null;
    this.colliderCount = 0;
    this.anchorT = 0;
    this.eatenThisFrame = 0;
    this.totalEaten = 0;
    this.cap = count;
    this._recruitAcc = 0;
    this._plankton = null;

    for (let s = 0; s < this.maxSchools; s++) {
      this.centroids.push({
        x: 0,
        y: CONFIG.fish.preferredDepth,
        z: 0,
        vx: 0,
        vz: 0,
      });
      this.anchors.push({
        x: 0,
        y: CONFIG.fish.preferredDepth,
        z: 0,
        t: s * 1.7,
        hx: 1,
        hz: 0,
        cruise: 6.8,
      });
    }

    this.grid = new UniformGrid3D({
      minX: -CONFIG.halfX,
      minY: CONFIG.floorY,
      minZ: -CONFIG.halfZ,
      maxX: CONFIG.halfX,
      maxY: CONFIG.surfaceY + 4,
      maxZ: CONFIG.halfZ,
      cellSize: CONFIG.cellSize,
      maxAgents: max,
    });

    this.respawn(count);
  }

  get occupied() {
    let n = 0;
    for (let s = 0; s < this.maxSchools; s++) if (this.schoolN[s] > 0) n++;
    return n;
  }

  _home(s) {
    const n = Math.max(1, this.initialSchools);
    const a = (s / n) * Math.PI * 2 + 0.31;
    return {
      x: Math.cos(a) * 90,
      y: CONFIG.fish.preferredDepth + (s % 2 === 0 ? -2 : 2.5),
      z: Math.sin(a) * 70 - 55,
      heading: a + Math.PI * 0.5,
    };
  }

  respawn(count) {
    const n = Math.max(0, Math.min(this.max, count | 0));
    this.count = n;
    this.cap = n;
    this.totalEaten = 0;
    this._recruitAcc = 0;
    this.schoolCount = this.initialSchools;
    this._splitLock.fill(0);
    for (let s = 0; s < this.maxSchools; s++) {
      const home = this._home(s % this.initialSchools);
      const a = this.anchors[s];
      a.x = home.x;
      a.y = home.y;
      a.z = home.z;
      a.t = s * 2.4;
      a.hx = Math.sin(home.heading);
      a.hz = Math.cos(home.heading);
      a.cruise = 6.4 + (s % 3) * 0.45;
      this.schoolN[s] = 0;
    }

    const rest = CONFIG.fish.restSpacing;
    const per = Math.ceil(n / Math.max(1, this.initialSchools));
    const nY = 13;
    const nSide = Math.max(6, Math.round(Math.sqrt(per / nY)));
    const nAlong = Math.max(6, Math.ceil(per / (nY * nSide)));

    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const sid = i % this.initialSchools;
      this.schoolId[i] = sid;
      const home = this._home(sid);
      const k = (i / this.initialSchools) | 0;
      const layer = k % nY;
      const plane = (k / nY) | 0;
      const sideI = plane % nSide;
      const alongI = (plane / nSide) | 0;
      const jitter = rest * 0.07;
      const side =
        (sideI + (alongI & 1) * 0.5 - (nSide - 1) * 0.5) * rest +
        (Math.random() - 0.5) * jitter;
      const along =
        (alongI - (nAlong - 1) * 0.5) * rest * 0.92 +
        (Math.random() - 0.5) * jitter;
      const up =
        (layer - (nY - 1) * 0.5) * rest * 1.18 +
        (Math.random() - 0.5) * jitter * 0.55;
      const hx = Math.sin(home.heading);
      const hz = Math.cos(home.heading);
      this.pos[i3] = home.x + hx * along - hz * side;
      this.pos[i3 + 1] = home.y + up;
      this.pos[i3 + 2] = home.z + hz * along + hx * side;
      const heading = home.heading + (Math.random() - 0.5) * 0.05;
      const spd = 7.2 + Math.random() * 0.6;
      this.vel[i3] = Math.sin(heading) * spd;
      this.vel[i3 + 1] = (Math.random() - 0.5) * 0.12;
      this.vel[i3 + 2] = Math.cos(heading) * spd;
      this.phase[i] = Math.random() * Math.PI * 2;
      this.scale[i] = 0.84 + Math.random() * 0.32;
    }
    this._refreshCentroids();
  }

  setCount(next) {
    const n = Math.max(32, Math.min(this.max, next | 0));
    this.cap = n;
    if (n === this.count) return;
    if (n < this.count) {
      this.count = n;
      this._refreshCentroids();
      return;
    }
    let sid = 0;
    let best = Infinity;
    for (let s = 0; s < this.maxSchools; s++) {
      if (this.schoolN[s] > 0 && this.schoolN[s] < best) {
        best = this.schoolN[s];
        sid = s;
      }
    }
    const c = this.centroids[sid];
    const a = this.anchors[sid];
    const rest = CONFIG.fish.restSpacing;
    for (let i = this.count; i < n; i++) {
      const i3 = i * 3;
      this.schoolId[i] = sid;
      this.pos[i3] = c.x + (Math.random() - 0.5) * rest * 4;
      this.pos[i3 + 1] = c.y + (Math.random() - 0.5) * rest * 2;
      this.pos[i3 + 2] = c.z + (Math.random() - 0.5) * rest * 4;
      const spd = a.cruise;
      this.vel[i3] = a.hx * spd;
      this.vel[i3 + 1] = 0;
      this.vel[i3 + 2] = a.hz * spd;
      this.phase[i] = Math.random() * Math.PI * 2;
      this.scale[i] = 0.84 + Math.random() * 0.32;
    }
    this.count = n;
    this.cap = n;
    this._refreshCentroids();
  }

  remove(i) {
    const last = this.count - 1;
    if (i !== last) {
      const i3 = i * 3;
      const l3 = last * 3;
      this.pos[i3] = this.pos[l3];
      this.pos[i3 + 1] = this.pos[l3 + 1];
      this.pos[i3 + 2] = this.pos[l3 + 2];
      this.vel[i3] = this.vel[l3];
      this.vel[i3 + 1] = this.vel[l3 + 1];
      this.vel[i3 + 2] = this.vel[l3 + 2];
      this.phase[i] = this.phase[last];
      this.scale[i] = this.scale[last];
      this.schoolId[i] = this.schoolId[last];
    }
    this.count = last;
    this.totalEaten++;
    this.eatenThisFrame++;
  }

  targetFor(shark) {
    let best = 0;
    let bestD = Infinity;
    for (let s = 0; s < this.maxSchools; s++) {
      if (this.schoolN[s] < 8) continue;
      const c = this.centroids[s];
      const dx = c.x - shark.x;
      const dy = c.y - shark.y;
      const dz = c.z - shark.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < bestD) {
        bestD = d2;
        best = s;
      }
    }
    const idx = this.schoolN[shark.huntIndex] > 8 ? shark.huntIndex : best;
    return this.centroids[idx];
  }

  update(dt, shark, look, plankton) {
    this.eatenThisFrame = 0;
    this._plankton = plankton || null;
    this._wanderAnchors(dt, shark, look);
    this.grid.rebuild(this.pos, this.count);
    this._flock(dt, shark, look);
    this._reorganize(dt, shark, look);
    this._eat(shark);
    if (plankton) this._recruit(dt, plankton);
  }

  _wanderAnchors(dt, shark, look) {
    this.anchorT += dt * 0.11;
    const bound = CONFIG.halfX - 28;
    const depth = look?.preferredDepth ?? CONFIG.fish.preferredDepth;
    const fearR = shark.fearRadius;
    for (let s = 0; s < this.maxSchools; s++) {
      this._splitLock[s] = Math.max(0, this._splitLock[s] - dt);
      if (this.schoolN[s] === 0) continue;
      const a = this.anchors[s];
      const c = this.centroids[s];
      a.t += dt;

      let hx = a.hx;
      let hz = a.hz;
      const dx = c.x - shark.x;
      const dz = c.z - shark.z;
      const d2 = dx * dx + dz * dz;
      const avoidR = fearR + CONFIG.fish.schoolRadius;
      if (d2 < avoidR * avoidR && d2 > 1) {
        const d = Math.sqrt(d2);
        const w = (1 - d / avoidR) ** 2;
        hx += (dx / d) * w * 1.4;
        hz += (dz / d) * w * 1.4;
      } else {
        const turn = Math.sin(a.t * 0.11 + s * 1.3) * 0.2;
        const ang = Math.atan2(hx, hz) + turn * dt;
        hx = Math.sin(ang);
        hz = Math.cos(ang);
      }
      const hLen = Math.hypot(hx, hz) || 1;
      a.hx = hx / hLen;
      a.hz = hz / hLen;
      a.x += a.hx * a.cruise * dt;
      a.z += a.hz * a.cruise * dt;
      const flowA = sampleFlow(a.x, a.y, a.z, look?.simTime ?? 0, look?.storm ?? 0);
      a.x += flowA.x * dt;
      a.z += flowA.z * dt;
      const bloom = this._plankton;
      if (bloom) {
        const g = bloom.gradient(a.x, a.z);
        a.hx += g.x * 0.55;
        a.hz += g.z * 0.55;
        const hn2 = Math.hypot(a.hx, a.hz) || 1;
        a.hx /= hn2;
        a.hz /= hn2;
      }
      if (a.x > bound) a.hx = -Math.abs(a.hx);
      else if (a.x < -bound) a.hx = Math.abs(a.hx);
      if (a.z > bound) a.hz = -Math.abs(a.hz);
      else if (a.z < -bound) a.hz = Math.abs(a.hz);
      a.x = Math.max(-bound, Math.min(bound, a.x));
      const groundA = seafloorHeight(a.x, a.z);
      if (groundA > depth - 10) {
        const sl = seafloorSlope(a.x, a.z);
        a.hx -= sl.x;
        a.hz -= sl.z;
        const hn = Math.hypot(a.hx, a.hz) || 1;
        a.hx /= hn;
        a.hz /= hn;
      }
      if (a.z > CONFIG.beach.shoreZ - 58) {
        a.hz = -Math.abs(a.hz);
        a.z = Math.min(a.z, CONFIG.beach.shoreZ - 58);
      }
      a.y += (depth + (s % 2 === 0 ? -2 : 2.5) - a.y) * Math.min(1, dt * 0.35);
      const waterTop = -3.2;
      const waterBot = groundA + 8;
      if (waterBot < waterTop) {
        if (a.y < waterBot) a.y = waterBot;
        else if (a.y > waterTop) a.y = waterTop;
      } else {
        a.y = (groundA - 1.2) * 0.5;
      }
    }
  }

  _flock(dt, shark, look) {
    const { count, pos, vel, schoolId } = this;
    const cfg = CONFIG.fish;
    const rest = cfg.restSpacing;
    const yMul = cfg.yMul;
    const sepR2 = cfg.sepRadius * cfg.sepRadius;
    const aliR2 = cfg.aliRadius * cfg.aliRadius;
    const cohR2 = cfg.cohRadius * cfg.cohRadius;
    const aliCap = 14;
    const cohCap = 12;
    const { heads, next, keyOf, nx, ny, nz, mask, inv, minX, minY, minZ } = this.grid;
    const holdR = cfg.schoolRadius * (look?.schoolRadiusScale ?? 1);
    const holdH = cfg.schoolHeight * (0.9 + (look?.tight ?? 0) * 0.12);
    const tight = look?.tight ?? 0;
    const cohW = cfg.cohWeight * (1 + tight * 0.6);
    const colliders = this.colliders;
    const colliderCount = this.colliderCount;
    const nj = this._nj;
    const nd = this._nd;

    const sx = shark.x;
    const sy = shark.y;
    const sz = shark.z;
    const fearR = shark.fearRadius;
    const fearR2 = fearR * fearR;
    let sLen = Math.hypot(shark.vx, shark.vy, shark.vz);
    if (sLen < 1e-4) sLen = 1;
    const sfx = shark.vx / sLen;
    const sfy = shark.vy / sLen;
    const sfz = shark.vz / sLen;

    const halfX = CONFIG.halfX;
    const sumX = this._sx;
    const sumY = this._sy;
    const sumZ = this._sz;
    const svx = this._svx;
    const svz = this._svz;
    sumX.fill(0);
    sumY.fill(0);
    sumZ.fill(0);
    svx.fill(0);
    svz.fill(0);
    this.schoolN.fill(0);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const px = pos[i3];
      const py = pos[i3 + 1];
      const pz = pos[i3 + 2];
      const vx = vel[i3];
      const vy = vel[i3 + 1];
      const vz = vel[i3 + 2];
      const sid = schoolId[i];
      const anchor = this.anchors[sid];
      const hold = this.centroids[sid];

      nd.fill(1e9);
      nj.fill(-1);
      let nearWorst = 1e9;
      let aliX = 0;
      let aliY = 0;
      let aliZ = 0;
      let aliN = 0;
      let cohX = 0;
      let cohY = 0;
      let cohZ = 0;
      let cohN = 0;

      let ix0 = (px - minX) * inv | 0;
      let iy0 = (py - minY) * inv | 0;
      let iz0 = (pz - minZ) * inv | 0;
      if (ix0 < 0) ix0 = 0;
      else if (ix0 >= nx) ix0 = nx - 1;
      if (iy0 < 0) iy0 = 0;
      else if (iy0 >= ny) iy0 = ny - 1;
      if (iz0 < 0) iz0 = 0;
      else if (iz0 >= nz) iz0 = nz - 1;
      let inspected = 0;

      outer: for (let o = 0; o < 27; o++) {
        const ix = ix0 + N27X[o];
        if (ix < 0 || ix >= nx) continue;
        const iy = iy0 + N27Y[o];
        if (iy < 0 || iy >= ny) continue;
        const iz = iz0 + N27Z[o];
        if (iz < 0 || iz >= nz) continue;
        const want = ix + 1 + (iy + 1) * 512 + (iz + 1) * 32768;
        const h = (Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663) ^ Math.imul(iz, 83492791)) & mask;
        for (let j = heads[h]; j >= 0; j = next[j]) {
          if (keyOf[j] !== want || j === i) continue;
          inspected++;
          if (inspected > NEIGHBOR_BUDGET) break outer;
          const j3 = j * 3;
          const dx = px - pos[j3];
          const dy = py - pos[j3 + 1];
          const dz = pz - pos[j3 + 2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > cohR2) continue;

          if (d2 < sepR2) {
            const dyS = dy * yMul;
            const d2s = dx * dx + dyS * dyS + dz * dz;
            if (d2s < nearWorst) {
              let w = 0;
              for (let t = 1; t < NEAR_K; t++) if (nd[t] > nd[w]) w = t;
              nd[w] = d2s;
              nj[w] = j;
              nearWorst = nd[0];
              for (let t = 1; t < NEAR_K; t++) if (nd[t] > nearWorst) nearWorst = nd[t];
            }
          }

          if (schoolId[j] === sid) {
            if (aliN < aliCap && d2 < aliR2) {
              aliX += vel[j3];
              aliY += vel[j3 + 1];
              aliZ += vel[j3 + 2];
              aliN++;
            }
            if (cohN < cohCap && d2 > rest * rest * 2.1) {
              cohX += pos[j3];
              cohY += pos[j3 + 1];
              cohZ += pos[j3 + 2];
              cohN++;
            }
          }
        }
      }

      let corrX = 0;
      let corrY = 0;
      let corrZ = 0;
      let springX = 0;
      let springY = 0;
      let springZ = 0;
      let nearN = 0;
      for (let t = 0; t < NEAR_K; t++) {
        const j = nj[t];
        if (j < 0) continue;
        const j3 = j * 3;
        const dx = px - pos[j3];
        const dy = py - pos[j3 + 1];
        const dz = pz - pos[j3 + 2];
        const dyS = dy * yMul;
        const d = Math.sqrt(dx * dx + dyS * dyS + dz * dz);
        if (d < 1e-4) {
          corrX += ((i * 13 + j) % 5) - 2;
          corrZ += ((i * 7 + j) % 5) - 2;
          nearN++;
          continue;
        }
        const gap = rest - d;
        const inv = 1 / d;
        if (gap > 0) {
          const push = gap * 0.5;
          corrX += dx * inv * push;
          corrY += dy * inv * push * 0.55;
          corrZ += dz * inv * push;
        }
        springX += dx * inv * gap;
        springY += dy * inv * gap * yMul;
        springZ += dz * inv * gap;
        nearN++;
      }

      let ax = springX * cfg.sepWeight;
      let ay = springY * cfg.sepWeight;
      let az = springZ * cfg.sepWeight;

      if (aliN > 0) {
        const invN = 1 / aliN;
        ax += (aliX * invN - vx) * cfg.aliWeight;
        ay += (aliY * invN - vy) * cfg.aliWeight;
        az += (aliZ * invN - vz) * cfg.aliWeight;
      }

      if (cohN > 0) {
        const invN = 1 / cohN;
        const cx = cohX * invN - px;
        const cy = cohY * invN - py;
        const cz = cohZ * invN - pz;
        const cLen = Math.hypot(cx, cy, cz);
        if (cLen > 1e-4) {
          const w = cohW / cLen;
          ax += cx * w * cfg.maxSpeed;
          ay += cy * w * cfg.maxSpeed * 0.82;
          az += cz * w * cfg.maxSpeed;
        }
      }

      const pdx = px - sx;
      const pdy = py - sy;
      const pdz = pz - sz;
      const pd2 = pdx * pdx + pdy * pdy + pdz * pdz;
      const inPanic = pd2 < fearR2 && pd2 > 1e-5;
      let maxSpd = cfg.maxSpeed;
      let maxAcc = cfg.maxAccel;

      if (!inPanic) {
        ax += (anchor.hx * anchor.cruise - vx) * cfg.cruiseWeight;
        ay += -vy * 0.06;
        az += (anchor.hz * anchor.cruise - vz) * cfg.cruiseWeight;

        const groundHold = seafloorHeight(px, pz);
        const ceilY = -cfg.surfaceClearance;
        const sandPad = groundHold + cfg.floorClearance + 0.6;
        const room = Math.max(2.8, (ceilY - sandPad) * 0.5);
        const localH = Math.min(holdH, room);
        let holdY = hold.y;
        if (holdY < sandPad + localH) holdY = sandPad + localH;
        if (holdY > ceilY - localH) holdY = ceilY - localH;

        const hdx = px - hold.x;
        const hdy = py - holdY;
        const hdz = pz - hold.z;
        const along = hdx * anchor.hx + hdz * anchor.hz;
        const side = hdx * -anchor.hz + hdz * anchor.hx;
        const nx = along / holdR;
        const ny = hdy / localH;
        const nz = side / (holdR * 0.86);
        const e2 = nx * nx + ny * ny + nz * nz;
        if (e2 > 1) {
          const e = Math.sqrt(e2);
          const extra = (e - 1) * cfg.holdWeight;
          ax -= extra * (nx * anchor.hx) / holdR - extra * (nz * anchor.hz) / (holdR * 0.86);
          ay -= extra * ny / localH;
          az -= extra * (nx * anchor.hz) / holdR + extra * (nz * anchor.hx) / (holdR * 0.86);
        } else {
          const flat = Math.hypot(along, side) / holdR;
          const vert = Math.abs(hdy) / localH;
          const want = flat * 0.62;
          if (flat > 0.12 && vert < want) {
            const puff = (want - vert) * 7.5;
            ay += (hdy > 0.05 ? 1 : hdy < -0.05 ? -1 : (i & 1) * 2 - 1) * puff;
          }
        }
        ay += (anchor.y - py) * cfg.depthWeight;
        const bloom = this._plankton;
        if (bloom) {
          const g = bloom.gradient(px, pz);
          ax += g.x * cfg.forageWeight;
          az += g.z * cfg.forageWeight;
          bloom.graze(px, pz, CONFIG.plankton.graze * dt);
        }
      } else {
        const d = Math.sqrt(pd2);
        const falloff = 1 - d / fearR;
        const ahead = (pdx * sfx + pdy * sfy + pdz * sfz) / d;
        const panic = falloff * falloff * (0.75 + 0.5 * Math.max(0, ahead));
        let fx = pdx / d + anchor.hx * 0.55;
        let fy = pdy / d * 0.35 - 0.08;
        let fz = pdz / d + anchor.hz * 0.55;
        const along = pdx * sfx + pdy * sfy + pdz * sfz;
        let lx = pdx - along * sfx;
        let ly = pdy - along * sfy;
        let lz = pdz - along * sfz;
        const lLen = Math.hypot(lx, ly, lz);
        if (lLen > 1e-4) {
          fx += (lx / lLen) * 0.7;
          fy += (ly / lLen) * 0.25;
          fz += (lz / lLen) * 0.7;
        }
        const fLen = Math.hypot(fx, fy, fz) || 1;
        fx /= fLen;
        fy /= fLen;
        fz /= fLen;
        const want = cfg.fleeSpeed * (0.58 + 0.42 * panic);
        const match = 3.2 * (0.5 + panic);
        ax += (fx * want - vx) * match;
        ay += (fy * want - vy) * match;
        az += (fz * want - vz) * match;
        maxSpd = cfg.fleeSpeed;
        maxAcc = cfg.maxAccel * 2.2;
      }

      const rock = steerFromColliders(px, py, pz, colliders, colliderCount, 1.8, 22);
      ax += rock.ax;
      ay += rock.ay;
      az += rock.az;

      const margin = 12;
      if (px > halfX - margin) ax -= (px - (halfX - margin)) * cfg.boundsWeight;
      else if (px < -halfX + margin) ax += (-halfX + margin - px) * cfg.boundsWeight;
      if (pz < -CONFIG.halfZ + margin) az += (-CONFIG.halfZ + margin - pz) * cfg.boundsWeight;
      const ground = seafloorHeight(px, pz);
      const ceilY = -cfg.surfaceClearance;
      if (py > ceilY) ay -= (py - ceilY) * 5.2;
      const floorKeep = ground + cfg.floorClearance + 1.4;
      if (py < floorKeep) ay += (floorKeep - py) * 5.5;
      const column = ceilY - (ground + cfg.floorClearance);
      if (column < cfg.beachTurnWater) {
        const slope = seafloorSlope(px, pz);
        const span = Math.max(1, cfg.beachTurnWater - cfg.minWater);
        const u = Math.min(1, (cfg.beachTurnWater - column) / span);
        const w = 16 + u * u * 38;
        ax -= slope.x * w;
        az -= slope.z * w;
      }
      if (pz > CONFIG.beach.shoreZ - 12) {
        az -= (pz - (CONFIG.beach.shoreZ - 12)) * cfg.boundsWeight * 2.4;
      }

      const aLen = Math.hypot(ax, ay, az);
      if (aLen > maxAcc) {
        const s = maxAcc / aLen;
        ax *= s;
        ay *= s;
        az *= s;
      }

      let nvx = vx + ax * dt;
      let nvy = vy + ay * dt;
      let nvz = vz + az * dt;
      let spd = Math.hypot(nvx, nvy, nvz);
      if (spd < 1e-4) {
        nvx = 1;
        spd = 1;
      }
      const minSpd = inPanic ? cfg.maxSpeed : cfg.minSpeed;
      if (spd > maxSpd) {
        const s = maxSpd / spd;
        nvx *= s;
        nvy *= s;
        nvz *= s;
        spd = maxSpd;
      } else if (spd < minSpd) {
        const s = minSpd / spd;
        nvx *= s;
        nvy *= s;
        nvz *= s;
        spd = minSpd;
      }

      const oldSpd = Math.hypot(vx, vy, vz);
      if (oldSpd > 0.4 && !inPanic) {
        const ox = vx / oldSpd;
        const oy = vy / oldSpd;
        const oz = vz / oldSpd;
        const nxv = nvx / spd;
        const nyv = nvy / spd;
        const nzv = nvz / spd;
        let dot = ox * nxv + oy * nyv + oz * nzv;
        if (dot > 1) dot = 1;
        else if (dot < -1) dot = -1;
        const ang = Math.acos(dot);
        const maxAng = cfg.maxTurn * dt;
        if (ang > maxAng && ang > 1e-4) {
          const t = maxAng / ang;
          let dx = ox + (nxv - ox) * t;
          let dy = oy + (nyv - oy) * t;
          let dz = oz + (nzv - oz) * t;
          const dLen = Math.hypot(dx, dy, dz) || 1;
          const blend = oldSpd + (spd - oldSpd) * 0.4;
          nvx = (dx / dLen) * blend;
          nvy = (dy / dLen) * blend;
          nvz = (dz / dLen) * blend;
        }
      }

      const flow = sampleFlow(px, py, pz, look?.simTime ?? 0, look?.storm ?? 0);
      let nxPos = px + (nvx + flow.x) * dt + corrX;
      let nyPos = py + (nvy + flow.y) * dt + corrY;
      let nzPos = pz + (nvz + flow.z) * dt + corrZ;
      const ground2 = seafloorHeight(nxPos, nzPos);
      const hardCeil = -0.7;
      const hardFloor = ground2 + 1.35;
      if (nyPos > hardCeil) {
        nyPos = hardCeil;
        nvy = Math.min(nvy, 0);
      }
      if (nyPos < hardFloor) {
        nyPos = hardFloor;
        nvy = Math.max(nvy, 0);
      }
      if (nzPos > CONFIG.beach.shoreZ - 8) {
        nzPos = CONFIG.beach.shoreZ - 8;
        nvz = Math.min(nvz, 0);
      }
      const resolved = resolveColliders(nxPos, nyPos, nzPos, colliders, colliderCount, 1.4);
      nxPos = resolved.x;
      nyPos = resolved.y;
      nzPos = resolved.z;

      pos[i3] = nxPos;
      pos[i3 + 1] = nyPos;
      pos[i3 + 2] = nzPos;
      vel[i3] = nvx;
      vel[i3 + 1] = nvy;
      vel[i3 + 2] = nvz;

      sumX[sid] += nxPos;
      sumY[sid] += nyPos;
      sumZ[sid] += nzPos;
      svx[sid] += nvx;
      svz[sid] += nvz;
      this.schoolN[sid]++;
    }

    let bestN = 0;
    let occupied = 0;
    for (let s = 0; s < this.maxSchools; s++) {
      const n = this.schoolN[s];
      if (n > 0) {
        occupied++;
        this.centroids[s].x = sumX[s] / n;
        this.centroids[s].y = sumY[s] / n;
        this.centroids[s].z = sumZ[s] / n;
        this.centroids[s].vx = svx[s] / n;
        this.centroids[s].vz = svz[s] / n;
      }
      if (n > bestN) {
        bestN = n;
        this.centroid.x = this.centroids[s].x;
        this.centroid.y = this.centroids[s].y;
        this.centroid.z = this.centroids[s].z;
      }
    }
    this.schoolCount = occupied;
  }

  _refreshCentroids() {
    const nSchools = this.maxSchools;
    const sumX = this._sx;
    const sumY = this._sy;
    const sumZ = this._sz;
    sumX.fill(0);
    sumY.fill(0);
    sumZ.fill(0);
    this.schoolN.fill(0);
    for (let i = 0; i < this.count; i++) {
      const sid = this.schoolId[i];
      const i3 = i * 3;
      sumX[sid] += this.pos[i3];
      sumY[sid] += this.pos[i3 + 1];
      sumZ[sid] += this.pos[i3 + 2];
      this.schoolN[sid]++;
    }
    let bestN = 0;
    let occupied = 0;
    for (let s = 0; s < nSchools; s++) {
      const n = this.schoolN[s];
      if (n > 0) {
        occupied++;
        this.centroids[s].x = sumX[s] / n;
        this.centroids[s].y = sumY[s] / n;
        this.centroids[s].z = sumZ[s] / n;
      }
      if (n > bestN) {
        bestN = n;
        this.centroid.x = this.centroids[s].x;
        this.centroid.y = this.centroids[s].y;
        this.centroid.z = this.centroids[s].z;
      }
    }
    this.schoolCount = occupied;
  }

  _allocSchool() {
    for (let s = 0; s < this.maxSchools; s++) {
      if (this.schoolN[s] === 0) return s;
    }
    return -1;
  }

  _minSchoolSize() {
    const cfg = CONFIG.fish;
    return Math.max(cfg.minSchoolSize, Math.min(400, (this.count * cfg.minSchoolFrac) | 0));
  }

  _reorganize(dt, shark, look) {
    this._orgT += dt;
    if (this._orgT < 0.45) return;
    this._orgT = 0;
    this._trySplits(shark, look);
    this._tryJoins(shark, look);
    this._tryMerges(shark, look);
    this._refreshCentroids();
  }

  _trySplits(shark, look) {
    const minS = this._minSchoolSize();
    const cfg = CONFIG.fish;
    const splitR = cfg.splitDistance * (look?.schoolRadiusScale ?? 1);
    const splitR2 = splitR * splitR;
    const { pos, schoolId, count } = this;
    for (let s = 0; s < this.maxSchools; s++) {
      const n = this.schoolN[s];
      if (n < minS * 2.2) continue;
      if (this._splitLock[s] > 0) continue;
      const nid = this._allocSchool();
      if (nid < 0) return;

      const c = this.centroids[s];
      let farI = -1;
      let farD = 0;
      let farN = 0;
      for (let i = 0; i < count; i++) {
        if (schoolId[i] !== s) continue;
        const i3 = i * 3;
        const dx = pos[i3] - c.x;
        const dy = pos[i3 + 1] - c.y;
        const dz = pos[i3 + 2] - c.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > splitR2) farN++;
        if (d2 > farD) {
          farD = d2;
          farI = i;
        }
      }
      if (farI < 0 || farD < splitR2) continue;
      if (farN < Math.max(minS, (n * 0.22) | 0)) continue;

      const f3 = farI * 3;
      const fx = pos[f3];
      const fy = pos[f3 + 1];
      const fz = pos[f3 + 2];
      let nB = 0;
      for (let i = 0; i < count; i++) {
        if (schoolId[i] !== s) {
          this._mark[i] = 0;
          continue;
        }
        const i3 = i * 3;
        const dB =
          (pos[i3] - fx) ** 2 + (pos[i3 + 1] - fy) ** 2 + (pos[i3 + 2] - fz) ** 2;
        const dA =
          (pos[i3] - c.x) ** 2 + (pos[i3 + 1] - c.y) ** 2 + (pos[i3 + 2] - c.z) ** 2;
        const take = dB < dA * 0.72 ? 1 : 0;
        this._mark[i] = take;
        nB += take;
      }
      const nA = n - nB;
      if (nB < minS || nA < minS) continue;

      let bx = 0;
      let by = 0;
      let bz = 0;
      let bvx = 0;
      let bvz = 0;
      for (let i = 0; i < count; i++) {
        if (!this._mark[i]) continue;
        schoolId[i] = nid;
        const i3 = i * 3;
        bx += pos[i3];
        by += pos[i3 + 1];
        bz += pos[i3 + 2];
        bvx += this.vel[i3];
        bvz += this.vel[i3 + 2];
      }
      const inv = 1 / nB;
      this.schoolN[s] = nA;
      this.schoolN[nid] = nB;
      this.centroids[nid].x = bx * inv;
      this.centroids[nid].y = by * inv;
      this.centroids[nid].z = bz * inv;
      const a = this.anchors[nid];
      a.x = this.centroids[nid].x;
      a.y = this.centroids[nid].y;
      a.z = this.centroids[nid].z;
      const hLen = Math.hypot(bvx, bvz) || 1;
      a.hx = bvx / hLen;
      a.hz = bvz / hLen;
      a.cruise = this.anchors[s].cruise;
      a.t = this.anchors[s].t + 0.7;
      this._splitLock[s] = 6;
      this._splitLock[nid] = 6;
    }
  }

  _tryJoins(shark, look) {
    const minS = this._minSchoolSize();
    const holdR = CONFIG.fish.schoolRadius * (look?.schoolRadiusScale ?? 1);
    const slack = CONFIG.fish.joinSlack;
    const fearR2 = shark.fearRadius * shark.fearRadius;
    const { pos, vel, schoolId, count } = this;
    let switched = 0;
    const cap = 70;
    for (let i = 0; i < count; i++) {
      if (switched >= cap) break;
      const sid = schoolId[i];
      if (this.schoolN[sid] <= minS) continue;
      if (this._splitLock[sid] > 0.5) continue;
      const i3 = i * 3;
      const dxs = pos[i3] - shark.x;
      const dys = pos[i3 + 1] - shark.y;
      const dzs = pos[i3 + 2] - shark.z;
      if (dxs * dxs + dys * dys + dzs * dzs < fearR2) continue;
      const c = this.centroids[sid];
      const dox = pos[i3] - c.x;
      const doy = pos[i3 + 1] - c.y;
      const doz = pos[i3 + 2] - c.z;
      const dOwn2 = dox * dox + doy * doy + doz * doz;
      if (dOwn2 < holdR * holdR * slack * slack) continue;

      let best = -1;
      let bestD = dOwn2 * 0.7;
      for (let s = 0; s < this.maxSchools; s++) {
        if (s === sid || this.schoolN[s] < minS) continue;
        const o = this.centroids[s];
        const dx = pos[i3] - o.x;
        const dy = pos[i3 + 1] - o.y;
        const dz = pos[i3 + 2] - o.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= bestD) continue;
        const spd = Math.hypot(vel[i3], vel[i3 + 2]) || 1;
        const dot =
          (vel[i3] / spd) * this.anchors[s].hx + (vel[i3 + 2] / spd) * this.anchors[s].hz;
        if (dot < 0.12) continue;
        best = s;
        bestD = d2;
      }
      if (best >= 0) {
        schoolId[i] = best;
        switched++;
      }
    }
  }

  _tryMerges(shark, look) {
    const minS = this._minSchoolSize();
    const mergeR = CONFIG.fish.mergeDistance * (0.85 + (look?.tight ?? 0) * 0.4);
    const mergeR2 = mergeR * mergeR;
    const fearR = shark.fearRadius;
    const { schoolId, count } = this;
    for (let a = 0; a < this.maxSchools; a++) {
      if (this.schoolN[a] < minS) continue;
      if (this._splitLock[a] > 0) continue;
      const ca = this.centroids[a];
      const adx = ca.x - shark.x;
      const ady = ca.y - shark.y;
      const adz = ca.z - shark.z;
      if (adx * adx + ady * ady + adz * adz < (fearR + 12) ** 2) continue;
      for (let b = a + 1; b < this.maxSchools; b++) {
        if (this.schoolN[b] < minS) continue;
        if (this._splitLock[b] > 0) continue;
        const cb = this.centroids[b];
        const dx = ca.x - cb.x;
        const dy = ca.y - cb.y;
        const dz = ca.z - cb.z;
        if (dx * dx + dy * dy + dz * dz > mergeR2) continue;
        const heading =
          this.anchors[a].hx * this.anchors[b].hx + this.anchors[a].hz * this.anchors[b].hz;
        if (heading < 0.35) continue;
        const keep = this.schoolN[a] >= this.schoolN[b] ? a : b;
        const drop = keep === a ? b : a;
        for (let i = 0; i < count; i++) {
          if (schoolId[i] === drop) schoolId[i] = keep;
        }
        this.schoolN[keep] += this.schoolN[drop];
        this.schoolN[drop] = 0;
        this._splitLock[keep] = 2.4;
        return;
      }
    }
  }

  _eat(shark) {
    const r = shark.biteRadius;
    const r2 = r * r;
    const mx = shark.mouthX;
    const my = shark.mouthY;
    const mz = shark.mouthZ;
    const { pos, count } = this;
    for (let i = count - 1; i >= 0; i--) {
      const i3 = i * 3;
      const dx = pos[i3] - mx;
      const dy = pos[i3 + 1] - my;
      const dz = pos[i3 + 2] - mz;
      if (dx * dx + dy * dy + dz * dz < r2) {
        const x = pos[i3];
        const y = pos[i3 + 1];
        const z = pos[i3 + 2];
        this.remove(i);
        if (shark.feed) shark.feed();
        shark.onEat(x, y, z);
      }
    }
  }

  _recruit(dt, plankton) {
    const foodCap = plankton.carryingCapacity(this.cap);
    const target = Math.min(this.cap, foodCap);
    if (this.count >= target || this.count >= this.max) return;
    if (plankton.mean < 0.05) return;
    const deficit = target - this.count;
    this._recruitAcc += Math.min(18, 4 + deficit * 0.02) * (0.35 + plankton.mean) * dt;
    while (this._recruitAcc >= 1 && this.count < target && this.count < this.max) {
      this._recruitAcc -= 1;
      this._spawnOne(plankton);
    }
  }

  _spawnOne(plankton) {
    let sid = 0;
    let best = -1;
    for (let s = 0; s < this.maxSchools; s++) {
      if (this.schoolN[s] < 8) continue;
      const c = this.centroids[s];
      const food = plankton.sample(c.x, c.z);
      if (food > best) {
        best = food;
        sid = s;
      }
    }
    const i = this.count;
    const i3 = i * 3;
    const c = this.centroids[sid];
    const a = this.anchors[sid];
    const rest = CONFIG.fish.restSpacing;
    this.schoolId[i] = sid;
    this.pos[i3] = c.x + (Math.random() - 0.5) * rest * 3;
    this.pos[i3 + 1] = c.y + (Math.random() - 0.5) * rest * 1.4;
    this.pos[i3 + 2] = c.z + (Math.random() - 0.5) * rest * 3;
    this.vel[i3] = a.hx * a.cruise;
    this.vel[i3 + 1] = 0;
    this.vel[i3 + 2] = a.hz * a.cruise;
    this.phase[i] = Math.random() * Math.PI * 2;
    this.scale[i] = 0.84 + Math.random() * 0.32;
    this.count = i + 1;
  }
}
