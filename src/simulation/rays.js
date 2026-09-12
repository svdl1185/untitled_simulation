import { CONFIG } from "../config.js";
import { UniformGrid3D } from "./grid.js";
import { steerFromColliders, resolveColliders, seafloorHeight, seafloorSlope } from "./obstacles.js";
import { sampleFlow } from "./flow.js";

/**
 * Benthic guild on the same seafloor, flow, and rock colliders as the
 * herring. Own hashed grid — they do not share the pelagic neighbor walk.
 */
export class Rays {
  constructor(count) {
    const max = CONFIG.rays.max;
    this.max = max;
    this.count = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.phase = new Float32Array(max);
    this.scale = new Float32Array(max);
    this.colliders = null;
    this.colliderCount = 0;
    this.grid = new UniformGrid3D({
      minX: -CONFIG.halfX,
      minY: CONFIG.floorY,
      minZ: -CONFIG.halfZ,
      maxX: CONFIG.halfX,
      maxY: CONFIG.surfaceY + 4,
      maxZ: CONFIG.halfZ,
      cellSize: 6.5,
      maxAgents: max,
    });
    this.respawn(count);
  }

  respawn(count) {
    const n = Math.max(0, Math.min(this.max, count | 0));
    this.count = n;
    const cfg = CONFIG.rays;
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const a = (i / n) * Math.PI * 2 + 0.4;
      const r = 40 + (i % 7) * 14;
      let x = Math.cos(a) * r + (Math.random() - 0.5) * 18;
      let z = Math.sin(a) * r * 0.85 - 20 + (Math.random() - 0.5) * 22;
      z = Math.min(z, CONFIG.beach.startZ - 8);
      const y = seafloorHeight(x, z) + cfg.floorClearance;
      this.pos[i3] = x;
      this.pos[i3 + 1] = y;
      this.pos[i3 + 2] = z;
      const heading = a + Math.PI * 0.5 + (Math.random() - 0.5) * 0.8;
      const spd = cfg.cruise * (0.75 + Math.random() * 0.4);
      this.vel[i3] = Math.sin(heading) * spd;
      this.vel[i3 + 1] = 0;
      this.vel[i3 + 2] = Math.cos(heading) * spd;
      this.phase[i] = Math.random() * Math.PI * 2;
      this.scale[i] = 0.78 + Math.random() * 0.5;
    }
  }

  update(dt, sharks, look, plankton) {
    const pack = Array.isArray(sharks) ? sharks : sharks ? [sharks] : [];
    const { count, pos, vel } = this;
    const cfg = CONFIG.rays;
    const t = look?.simTime ?? 0;
    const storm = look?.storm ?? 0;
    const colliders = this.colliders;
    const nCol = this.colliderCount;
    this.grid.rebuild(pos, count);
    const { heads, next, keyOf, nx, ny, nz, mask, inv, minX, minY, minZ } = this.grid;
    const sepR2 = cfg.sepRadius * cfg.sepRadius;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      let px = pos[i3];
      let py = pos[i3 + 1];
      let pz = pos[i3 + 2];
      let vx = vel[i3];
      let vy = vel[i3 + 1];
      let vz = vel[i3 + 2];

      const sl = seafloorSlope(px, pz);
      const clen = Math.hypot(-sl.z, sl.x) || 1;
      let hx = -sl.z / clen;
      let hz = sl.x / clen;
      const along = vx * hx + vz * hz;
      if (along < 0) {
        hx = -hx;
        hz = -hz;
      }
      const wander = Math.sin(t * 0.17 + i * 1.7) * 0.35;
      const wx = -hz * wander;
      const wz = hx * wander;

      let ax = (hx * cfg.cruise + wx * cfg.cruise - vx) * 1.6;
      let ay = 0;
      let az = (hz * cfg.cruise + wz * cfg.cruise - vz) * 1.6;

      let inFear = false;
      let dxs = 0;
      let dys = 0;
      let dzs = 0;
      let pd2 = 1e15;
      for (let p = 0; p < pack.length; p++) {
        const shark = pack[p];
        const dx = px - shark.x;
        const dy = py - shark.y;
        const dz = pz - shark.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        const r2 = cfg.fearRadius * cfg.fearRadius * shark.scale * shark.scale;
        if (d2 < r2 && d2 > 1e-4) inFear = true;
        if (d2 < pd2) {
          pd2 = d2;
          dxs = dx;
          dys = dy;
          dzs = dz;
        }
      }
      let maxSpd = cfg.maxSpeed;
      if (inFear && pd2 > 1e-4) {
        const d = Math.sqrt(pd2);
        const panic = 1 - d / Math.max(cfg.fearRadius, d);
        ax += (dxs / d) * cfg.fleeSpeed * panic * 2.4;
        az += (dzs / d) * cfg.fleeSpeed * panic * 2.4;
        ay -= panic * 3.5;
        maxSpd = cfg.fleeSpeed;
      }

      let ix0 = (px - minX) * inv | 0;
      let iy0 = (py - minY) * inv | 0;
      let iz0 = (pz - minZ) * inv | 0;
      if (ix0 < 0) ix0 = 0;
      else if (ix0 >= nx) ix0 = nx - 1;
      if (iy0 < 0) iy0 = 0;
      else if (iy0 >= ny) iy0 = ny - 1;
      if (iz0 < 0) iz0 = 0;
      else if (iz0 >= nz) iz0 = nz - 1;
      for (let ox = -1; ox <= 1; ox++) {
        const ix = ix0 + ox;
        if (ix < 0 || ix >= nx) continue;
        for (let oy = -1; oy <= 1; oy++) {
          const iy = iy0 + oy;
          if (iy < 0 || iy >= ny) continue;
          for (let oz = -1; oz <= 1; oz++) {
            const iz = iz0 + oz;
            if (iz < 0 || iz >= nz) continue;
            const want = ix + 1 + (iy + 1) * 512 + (iz + 1) * 32768;
            const h =
              (Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663) ^ Math.imul(iz, 83492791)) &
              mask;
            for (let j = heads[h]; j >= 0; j = next[j]) {
              if (keyOf[j] !== want || j === i) continue;
              const j3 = j * 3;
              const dx = px - pos[j3];
              const dy = py - pos[j3 + 1];
              const dz = pz - pos[j3 + 2];
              const d2 = dx * dx + dy * dy + dz * dz;
              if (d2 > sepR2 || d2 < 1e-6) continue;
              const d = Math.sqrt(d2);
              const push = ((cfg.sepRadius - d) / d) * 4.2;
              ax += dx * push;
              ay += dy * push * 0.2;
              az += dz * push;
            }
          }
        }
      }

      const rock = steerFromColliders(px, py, pz, colliders, nCol, 1.6, 14);
      ax += rock.ax;
      ay += rock.ay;
      az += rock.az;

      if (px > CONFIG.halfX - 14) ax -= (px - (CONFIG.halfX - 14)) * 1.8;
      else if (px < -CONFIG.halfX + 14) ax += (-CONFIG.halfX + 14 - px) * 1.8;
      if (pz < -CONFIG.halfZ + 14) az += (-CONFIG.halfZ + 14 - pz) * 1.8;
      if (pz > CONFIG.beach.startZ - 6) az -= (pz - (CONFIG.beach.startZ - 6)) * 3.2;

      const aLen = Math.hypot(ax, ay, az);
      if (aLen > cfg.maxAccel) {
        const s = cfg.maxAccel / aLen;
        ax *= s;
        ay *= s;
        az *= s;
      }

      vx += ax * dt;
      vy += ay * dt;
      vz += az * dt;
      let spd = Math.hypot(vx, vy, vz);
      if (spd > maxSpd) {
        const s = maxSpd / spd;
        vx *= s;
        vy *= s;
        vz *= s;
        spd = maxSpd;
      } else if (spd < 0.6) {
        const s = 0.6 / (spd || 1);
        vx *= s;
        vz *= s;
      }

      const flow = sampleFlow(px, py, pz, t, storm);
      px += (vx + flow.x * 0.45) * dt;
      pz += (vz + flow.z * 0.45) * dt;
      const ground = seafloorHeight(px, pz);
      const wantY = ground + cfg.floorClearance + Math.sin(t * 1.6 + this.phase[i]) * 0.18;
      py += (wantY - py) * Math.min(1, dt * 6);
      py += (vy + flow.y * 0.2) * dt;
      if (py < ground + 0.22) py = ground + 0.22;
      if (py > ground + 2.4) py = ground + 2.4;

      const pushed = resolveColliders(px, py, pz, colliders, nCol, 1.1);
      px = pushed.x;
      py = pushed.y;
      pz = pushed.z;
      pz = Math.min(pz, CONFIG.beach.startZ - 4);
      px = Math.max(-CONFIG.halfX + 6, Math.min(CONFIG.halfX - 6, px));

      if (plankton) {
        const det = plankton.sampleLayer("d", px, pz);
        if (det > 0.02) {
          const eaten = plankton.grazeLayer(
            "d",
            px,
            pz,
            cfg.graze * dt * (det / (det + 0.22))
          );
          if (eaten > 0) plankton.depositLayer("n", px, pz, eaten * 0.55);
        }
      }

      pos[i3] = px;
      pos[i3 + 1] = py;
      pos[i3 + 2] = pz;
      vel[i3] = vx;
      vel[i3 + 1] = vy;
      vel[i3 + 2] = vz;
      this.phase[i] += dt * (2.2 + spd * 0.4);
    }
  }
}
