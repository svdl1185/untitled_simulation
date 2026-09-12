import { CONFIG } from "../config.js";
import { seafloorHeight } from "./obstacles.js";
import { sampleFlow } from "./flow.js";

const _grad = { x: 0, z: 0 };

/**
 * Zooplankton / chlorophyll as a 2D density field. Herring graze it;
 * currents advect it; night and storms refill it. Not agents.
 */
export class Plankton {
  constructor() {
    const cfg = CONFIG.plankton;
    this.nx = cfg.nx;
    this.nz = cfg.nz;
    this.minX = -CONFIG.halfX;
    this.minZ = -CONFIG.halfZ;
    this.spanX = CONFIG.halfX * 2;
    this.spanZ = CONFIG.beach.shoreZ - this.minZ;
    this.cellX = this.spanX / this.nx;
    this.cellZ = this.spanZ / this.nz;
    this.dens = new Float32Array(this.nx * this.nz);
    this._next = new Float32Array(this.nx * this.nz);
    this.wet = new Uint8Array(this.nx * this.nz);
    this.mean = 0;
    this._bytes = new Uint8Array(this.nx * this.nz);
    this.seed();
  }

  seed() {
    const { nx, nz, dens, wet } = this;
    dens.fill(0);
    wet.fill(0);
    const patches = [
      { x: -40, z: -30, r: 55, a: 0.82 },
      { x: 70, z: -80, r: 48, a: 0.7 },
      { x: -90, z: 20, r: 42, a: 0.64 },
      { x: 20, z: 40, r: 36, a: 0.58 },
      { x: 110, z: -20, r: 40, a: 0.5 },
    ];
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const x = this.minX + (ix + 0.5) * this.cellX;
        const z = this.minZ + (iz + 0.5) * this.cellZ;
        const ground = seafloorHeight(x, z);
        if (ground > -6) continue;
        wet[iz * nx + ix] = 1;
        let d = 0.08;
        for (const p of patches) {
          const dx = (x - p.x) / p.r;
          const dz = (z - p.z) / p.r;
          d += p.a * Math.exp(-(dx * dx + dz * dz));
        }
        d += 0.08 * Math.sin(x * 0.04 + z * 0.03);
        d += 0.05 * Math.sin(x * 0.11 - z * 0.09);
        if (d < 0) d = 0;
        else if (d > 1) d = 1;
        dens[iz * nx + ix] = d;
      }
    }
    this._refreshMean();
  }

  _indexWorld(x, z) {
    const fx = (x - this.minX) / this.cellX - 0.5;
    const fz = (z - this.minZ) / this.cellZ - 0.5;
    return { fx, fz };
  }

  sample(x, z) {
    const { nx, nz, dens } = this;
    const { fx, fz } = this._indexWorld(x, z);
    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    if (x0 < -1 || z0 < -1 || x0 >= nx || z0 >= nz) return 0;
    const tx = fx - x0;
    const tz = fz - z0;
    const x1 = x0 + 1;
    const z1 = z0 + 1;
    const a = this._at(x0, z0, nx, nz, dens);
    const b = this._at(x1, z0, nx, nz, dens);
    const c = this._at(x0, z1, nx, nz, dens);
    const d = this._at(x1, z1, nx, nz, dens);
    return a * (1 - tx) * (1 - tz) + b * tx * (1 - tz) + c * (1 - tx) * tz + d * tx * tz;
  }

  _at(ix, iz, nx, nz, dens) {
    if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) return 0;
    return dens[iz * nx + ix];
  }

  gradient(x, z, out = _grad) {
    const e = this.cellX;
    out.x = (this.sample(x + e, z) - this.sample(x - e, z)) * 0.5;
    out.z = (this.sample(x, z + e) - this.sample(x, z - e)) * 0.5;
    return out;
  }

  graze(x, z, amount) {
    if (amount <= 0) return;
    const { nx, nz, dens } = this;
    const { fx, fz } = this._indexWorld(x, z);
    const ix = Math.round(fx);
    const iz = Math.round(fz);
    if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) return;
    const i = iz * nx + ix;
    const next = dens[i] - amount;
    dens[i] = next > 0 ? next : 0;
  }

  carryingCapacity(cap) {
    return Math.max(32, (cap * (0.4 + 0.6 * this.mean)) | 0);
  }

  update(dt, look, t) {
    const { nx, nz, dens, _next, wet, cellX, cellZ, minX, minZ } = this;
    const storm = look?.storm ?? 0;
    const night = look?.night ?? 0;
    const grow =
      CONFIG.plankton.grow * (1 + night * 0.85 + storm * 1.05) * dt;
    const flowT = t ?? 0;
    let sum = 0;
    let wetN = 0;

    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const i = iz * nx + ix;
        if (!wet[i]) {
          _next[i] = 0;
          continue;
        }
        const x = minX + (ix + 0.5) * cellX;
        const z = minZ + (iz + 0.5) * cellZ;
        const flow = sampleFlow(x, CONFIG.thermoY, z, flowT, storm);
        const px = x - flow.x * dt;
        const pz = z - flow.z * dt;
        let d = this.sample(px, pz);
        d += grow * (1 - d);
        if (d > 1) d = 1;
        else if (d < 0) d = 0;
        _next[i] = d;
        sum += d;
        wetN++;
      }
    }

    dens.set(_next);
    this.mean = sum / Math.max(1, wetN);
    this._toBytes();
  }

  _refreshMean() {
    let sum = 0;
    const { dens } = this;
    for (let i = 0; i < dens.length; i++) sum += dens[i];
    this.mean = sum / dens.length;
    this._toBytes();
  }

  _toBytes() {
    const { dens, _bytes } = this;
    for (let i = 0; i < dens.length; i++) {
      let v = dens[i] * 255;
      if (v < 0) v = 0;
      else if (v > 255) v = 255;
      _bytes[i] = v;
    }
  }
}
