import { CONFIG, clampHabitatY, hasBeach } from "../config.js";
import { seafloorHeight } from "./obstacles.js";
import { sampleFlow } from "./flow.js";

const _grad = { x: 0, z: 0 };

/**
 * Trophic field for the pelagic web.
 *
 * Four 2D layers, not agents:
 *   n  dissolved nutrients
 *   p  phytoplankton (light × nutrients)
 *   z  zooplankton   (herring forage)
 *   d  detritus      (awaiting a benthic grazer)
 *
 * Future guilds should only touch this class:
 *   sampleLayer / grazeLayer / depositLayer / recycle / overlap / forageDepth
 * Herring graze `z`, carcasses and excretion return mass to `n` and `d`.
 * Keep new species on that API so the NPZD budget stays closed as the
 * ecosystem grows.
 */
export const TROPHIC = { N: "n", P: "p", Z: "z", D: "d" };

export class Plankton {
  constructor() {
    const cfg = CONFIG.plankton;
    this.nx = cfg.nx;
    this.nz = cfg.nz;
    this.minX = -CONFIG.halfX;
    this.minZ = -CONFIG.halfZ;
    this.spanX = CONFIG.halfX * 2;
    this.spanZ = hasBeach() ? CONFIG.beach.shoreZ - this.minZ : CONFIG.halfZ * 2;
    this.cellX = this.spanX / this.nx;
    this.cellZ = this.spanZ / this.nz;
    const cells = this.nx * this.nz;
    this.n = new Float32Array(cells);
    this.p = new Float32Array(cells);
    this.z = new Float32Array(cells);
    this.d = new Float32Array(cells);
    this._n = new Float32Array(cells);
    this._p = new Float32Array(cells);
    this._z = new Float32Array(cells);
    this._d = new Float32Array(cells);
    this.wet = new Uint8Array(cells);
    this.vent = new Float32Array(cells);
    this.mean = 0;
    this.meanN = 0;
    this.meanP = 0;
    this.meanZ = 0;
    this.meanD = 0;
    this._bytes = new Uint8Array(cells * 4);
    this.seed();
  }

  seed() {
    const { nx, nz, n, p, z, d, wet, vent } = this;
    n.fill(0);
    p.fill(0);
    z.fill(0);
    d.fill(0);
    wet.fill(0);
    vent.fill(0);
    const sx = this.spanX / 480;
    const sz = this.spanZ / 468;
    const phyto = [
      { x: -40 * sx, z: -30 * sz, r: 58, a: 0.78 },
      { x: 70 * sx, z: -80 * sz, r: 50, a: 0.7 },
      { x: -90 * sx, z: 20 * sz, r: 44, a: 0.62 },
      { x: 20 * sx, z: 40 * sz, r: 38, a: 0.55 },
      { x: 110 * sx, z: -20 * sz, r: 42, a: 0.48 },
      { x: -20 * sx, z: -110 * sz, r: 36, a: 0.52 },
      { x: 40 * sx, z: -190 * sz, r: 48, a: 0.64 },
      { x: -130 * sx, z: -160 * sz, r: 42, a: 0.5 },
    ];
    const zoo = [
      { x: -28 * sx, z: -18 * sz, r: 50, a: 0.7 },
      { x: 58 * sx, z: -68 * sz, r: 44, a: 0.62 },
      { x: -78 * sx, z: 12 * sz, r: 40, a: 0.58 },
      { x: 32 * sx, z: 28 * sz, r: 34, a: 0.5 },
      { x: 96 * sx, z: -8 * sz, r: 36, a: 0.44 },
      { x: 28 * sx, z: -175 * sz, r: 40, a: 0.56 },
    ];
    const vents = [
      { x: -40 * sx, z: -30 * sz, r: 36, a: 0.9 },
      { x: 70 * sx, z: -80 * sz, r: 32, a: 0.8 },
      { x: -20 * sx, z: -110 * sz, r: 28, a: 0.7 },
      { x: 110 * sx, z: -50 * sz, r: 30, a: 0.55 },
      { x: 36 * sx, z: -210 * sz, r: 40, a: 0.85 },
      { x: -150 * sx, z: -200 * sz, r: 34, a: 0.7 },
    ];
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const x = this.minX + (ix + 0.5) * this.cellX;
        const zWorld = this.minZ + (iz + 0.5) * this.cellZ;
        const ground = seafloorHeight(x, zWorld);
        if (ground > -1.5) continue;
        const i = iz * nx + ix;
        wet[i] = 1;
        const shelf = CONFIG.shelfY;
        const basin = Math.min(CONFIG.floorY, shelf - 8);
        const depth = Math.min(1, Math.max(0, (shelf - ground) / (shelf - basin)));
        let nut = 0.2 + depth * 0.46;
        let phy = 0.06;
        let zoa = 0.04;
        let det = 0.05 + depth * 0.06;
        for (const patch of phyto) {
          const dx = (x - patch.x) / patch.r;
          const dz = (zWorld - patch.z) / patch.r;
          phy += patch.a * Math.exp(-(dx * dx + dz * dz));
        }
        for (const patch of zoo) {
          const dx = (x - patch.x) / patch.r;
          const dz = (zWorld - patch.z) / patch.r;
          zoa += patch.a * Math.exp(-(dx * dx + dz * dz));
        }
        let v = 0;
        for (const patch of vents) {
          const dx = (x - patch.x) / patch.r;
          const dz = (zWorld - patch.z) / patch.r;
          v += patch.a * Math.exp(-(dx * dx + dz * dz));
        }
        phy += 0.07 * Math.sin(x * 0.04 + zWorld * 0.03);
        zoa += 0.05 * Math.sin(x * 0.11 - zWorld * 0.09);
        nut += 0.04 * Math.sin(x * 0.02 - zWorld * 0.025);
        n[i] = _clamp01(nut);
        p[i] = _clamp01(phy);
        z[i] = _clamp01(zoa);
        d[i] = _clamp01(det);
        vent[i] = v * (0.35 + depth);
      }
    }
    this._refreshMean();
  }

  _indexWorld(x, z) {
    const fx = (x - this.minX) / this.cellX - 0.5;
    const fz = (z - this.minZ) / this.cellZ - 0.5;
    return { fx, fz };
  }

  _field(layer) {
    if (layer === TROPHIC.N) return this.n;
    if (layer === TROPHIC.P) return this.p;
    if (layer === TROPHIC.D) return this.d;
    return this.z;
  }

  sample(x, z) {
    return this.sampleLayer(TROPHIC.Z, x, z);
  }

  sampleLayer(layer, x, z) {
    return this._sampleField(this._field(layer), x, z);
  }

  _sampleField(dens, x, z) {
    const { nx, nz } = this;
    const { fx, fz } = this._indexWorld(x, z);
    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    if (x0 < -1 || z0 < -1 || x0 >= nx || z0 >= nz) return 0;
    const tx = fx - x0;
    const tz = fz - z0;
    const a = this._at(x0, z0, dens);
    const b = this._at(x0 + 1, z0, dens);
    const c = this._at(x0, z0 + 1, dens);
    const d = this._at(x0 + 1, z0 + 1, dens);
    return a * (1 - tx) * (1 - tz) + b * tx * (1 - tz) + c * (1 - tx) * tz + d * tx * tz;
  }

  _at(ix, iz, dens) {
    if (ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz) return 0;
    return dens[iz * this.nx + ix];
  }

  gradient(x, z, out = _grad) {
    return this.gradientLayer(TROPHIC.Z, x, z, out);
  }

  gradientLayer(layer, x, z, out = _grad) {
    const e = this.cellX;
    const dens = this._field(layer);
    out.x = (this._sampleField(dens, x + e, z) - this._sampleField(dens, x - e, z)) * 0.5;
    out.z = (this._sampleField(dens, x, z + e) - this._sampleField(dens, x, z - e)) * 0.5;
    return out;
  }

  /**
   * Vertical overlap of a grazer at depth `y` with the zooplankton layer.
   * Daytime herring sit on the thermocline with the zoo; night DVM splits
   * them until a hungry school rises. Pass `y` so later pelagic species
   * can share this without a herring-specific hack.
   */
  overlap(look, y) {
    const zooY = this.forageDepth(look);
    const py = y ?? look?.preferredDepth ?? CONFIG.fish.preferredDepth;
    const dy = py - zooY;
    return 0.34 + 0.66 / (1 + (dy * dy) / 170);
  }

  /** Zooplankton DVM depth: thermocline by day, photic at night. */
  forageDepth(look) {
    const night = look?.night ?? 0;
    const dusk = look?.dusk ?? 0;
    const dawn = look?.dawn ?? 0;
    const rise = Math.min(1, night * 0.9 + dusk * 0.55 + dawn * 0.4);
    const deep = clampHabitatY(CONFIG.thermoY - 5, CONFIG.fish.maxDepth);
    return deep + (clampHabitatY(-7.2, CONFIG.fish.maxDepth) - deep) * rise;
  }

  graze(x, z, amount) {
    if (amount <= 0) return 0;
    const { nx, nz, wet } = this;
    const { fx, fz } = this._indexWorld(x, z);
    const ix = Math.round(fx);
    const iz = Math.round(fz);
    const taken = this._take(this.z, wet, nx, nz, ix, iz, amount);
    if (taken > 0) {
      const cfg = CONFIG.plankton;
      this._give(this.n, wet, nx, nz, ix, iz, taken * cfg.excrete);
      this._give(this.d, wet, nx, nz, ix, iz, taken * cfg.detritus);
    }
    return taken;
  }

  grazeLayer(layer, x, z, amount) {
    return this._splatter(this._field(layer), x, z, -amount);
  }

  depositLayer(layer, x, z, amount) {
    this._splatter(this._field(layer), x, z, amount);
  }

  /** Uneaten mass from a graze: dissolved N plus sinking detritus. */
  excrete(x, z, eaten) {
    if (eaten <= 0) return;
    const cfg = CONFIG.plankton;
    this.depositLayer(TROPHIC.N, x, z, eaten * cfg.excrete);
    this.depositLayer(TROPHIC.D, x, z, eaten * cfg.detritus);
  }

  /** Dead biomass (shark bite, starvation) returns to the water column. */
  recycle(x, z, biomass) {
    if (biomass <= 0) return;
    this.depositLayer(TROPHIC.D, x, z, biomass * 0.72);
    this.depositLayer(TROPHIC.N, x, z, biomass * 0.28);
  }

  _splatter(dens, x, z, signed) {
    if (signed === 0) return 0;
    const { nx, nz, wet } = this;
    const { fx, fz } = this._indexWorld(x, z);
    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    const tx = fx - x0;
    const tz = fz - z0;
    const w00 = (1 - tx) * (1 - tz);
    const w10 = tx * (1 - tz);
    const w01 = (1 - tx) * tz;
    const w11 = tx * tz;
    if (signed < 0) {
      const want = -signed;
      let taken = 0;
      taken += this._take(dens, wet, nx, nz, x0, z0, want * w00);
      taken += this._take(dens, wet, nx, nz, x0 + 1, z0, want * w10);
      taken += this._take(dens, wet, nx, nz, x0, z0 + 1, want * w01);
      taken += this._take(dens, wet, nx, nz, x0 + 1, z0 + 1, want * w11);
      return taken;
    }
    this._give(dens, wet, nx, nz, x0, z0, signed * w00);
    this._give(dens, wet, nx, nz, x0 + 1, z0, signed * w10);
    this._give(dens, wet, nx, nz, x0, z0 + 1, signed * w01);
    this._give(dens, wet, nx, nz, x0 + 1, z0 + 1, signed * w11);
    return signed;
  }

  _take(dens, wet, nx, nz, ix, iz, amount) {
    if (amount <= 0 || ix < 0 || iz < 0 || ix >= nx || iz >= nz) return 0;
    const i = iz * nx + ix;
    if (!wet[i]) return 0;
    const v = dens[i];
    if (v <= 0) return 0;
    const take = v < amount ? v : amount;
    dens[i] = v - take;
    return take;
  }

  _give(dens, wet, nx, nz, ix, iz, amount) {
    if (amount <= 0 || ix < 0 || iz < 0 || ix >= nx || iz >= nz) return;
    const i = iz * nx + ix;
    if (!wet[i]) return;
    const next = dens[i] + amount;
    dens[i] = next > 1 ? 1 : next;
  }

  carryingCapacity(cap, layer = TROPHIC.Z) {
    if (!cap || cap <= 0) return 0;
    const mean =
      layer === TROPHIC.D ? this.meanD : layer === TROPHIC.P ? this.meanP : this.meanZ;
    const forage =
      mean < 0.05 ? 0.42 + mean * 9 : 0.86 + 0.14 * Math.min(1, mean / 0.28);
    return Math.max(48, (cap * forage) | 0);
  }

  update(dt, look, t) {
    const { nx, nz, wet, cellX, cellZ, minX, minZ, vent } = this;
    const cfg = CONFIG.plankton;
    const storm = look?.storm ?? 0;
    const night = look?.night ?? 0;
    const dawn = look?.dawn ?? 0;
    const dusk = look?.dusk ?? 0;
    const caustic = look?.caustic ?? 0.5;
    const light =
      Math.max(
        0.025,
        (1 - night) * (0.26 + 0.74 * caustic) + dawn * 0.18 + dusk * 0.1
      ) *
      (1 - storm * 0.32);
    const flowT = t ?? 0;
    const mix = cfg.mix * (1 + storm * 2.4) * dt;
    const growP = cfg.growP * light;
    const grazeZ = cfg.grazeZ * (0.75 + 0.35 * (night + dusk + dawn));
    const nextN = this._n;
    const nextP = this._p;
    const nextZ = this._z;
    const nextD = this._d;
    const srcN = this.n;
    const srcP = this.p;
    const srcZ = this.z;
    const srcD = this.d;

    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const i = iz * nx + ix;
        if (!wet[i]) {
          nextN[i] = 0;
          nextP[i] = 0;
          nextZ[i] = 0;
          nextD[i] = 0;
          continue;
        }
        const x = minX + (ix + 0.5) * cellX;
        const z = minZ + (iz + 0.5) * cellZ;
        const flow = sampleFlow(x, CONFIG.thermoY, z, flowT, storm);
        const px = x - flow.x * dt;
        const pz = z - flow.z * dt;
        const back = this._indexWorld(px, pz);
        const bx = Math.round(back.fx);
        const bz = Math.round(back.fz);
        nextN[i] = this._at(bx, bz, srcN);
        nextD[i] = this._at(bx, bz, srcD);
        nextP[i] = this._sampleField(srcP, px, pz);
        nextZ[i] = this._sampleField(srcZ, px, pz);
      }
    }

    let sumN = 0;
    let sumP = 0;
    let sumZ = 0;
    let sumD = 0;
    let wetN = 0;

    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const i = iz * nx + ix;
        if (!wet[i]) continue;
        let nut = nextN[i];
        let phy = nextP[i];
        let zoa = nextZ[i];
        let det = nextD[i];

        nut += this._lap(nextN, wet, nx, nz, ix, iz) * mix;
        phy += this._lap(nextP, wet, nx, nz, ix, iz) * mix;
        zoa += this._lap(nextZ, wet, nx, nz, ix, iz) * mix * 0.7;
        det += this._lap(nextD, wet, nx, nz, ix, iz) * mix * 0.45;

        const uptake = growP * (nut / (nut + cfg.kN)) * phy;
        const zg = grazeZ * (phy / (phy + cfg.kP)) * zoa;
        const mortP = cfg.mortP * phy;
        const mortZ = cfg.mortZ * zoa;
        const remin = cfg.remin * det;
        const ground = seafloorHeight(
          minX + (ix + 0.5) * cellX,
          minZ + (iz + 0.5) * cellZ
        );
        const deep = Math.min(
          1,
          Math.max(0, (CONFIG.shelfY - ground) / Math.max(8, CONFIG.shelfY - CONFIG.floorY))
        );
        const upwell =
          (cfg.baseN * (0.35 + deep) + storm * cfg.upwell * deep + vent[i] * (0.012 + storm * 0.04)) *
          (1 - nut);

        phy += (uptake - zg - mortP) * dt;
        zoa += (cfg.effZ * zg - mortZ) * dt;
        det += ((1 - cfg.effZ) * zg + mortP * 0.55 + mortZ * 0.65 - remin) * dt;
        nut += (mortP * 0.45 + mortZ * 0.35 + remin + upwell - uptake) * dt;

        nut = _clamp01(nut);
        phy = _clamp01(phy);
        zoa = _clamp01(zoa);
        det = _clamp01(det);
        srcN[i] = nut;
        srcP[i] = phy;
        srcZ[i] = zoa;
        srcD[i] = det;
        sumN += nut;
        sumP += phy;
        sumZ += zoa;
        sumD += det;
        wetN++;
      }
    }

    const inv = 1 / Math.max(1, wetN);
    this.meanN = sumN * inv;
    this.meanP = sumP * inv;
    this.meanZ = sumZ * inv;
    this.meanD = sumD * inv;
    this.mean = this.meanZ;
    this._toBytes();
  }

  _lap(arr, wet, nx, nz, ix, iz) {
    const i = iz * nx + ix;
    const c = arr[i];
    let acc = 0;
    let n = 0;
    if (ix > 0 && wet[i - 1]) {
      acc += arr[i - 1];
      n++;
    }
    if (ix + 1 < nx && wet[i + 1]) {
      acc += arr[i + 1];
      n++;
    }
    if (iz > 0 && wet[i - nx]) {
      acc += arr[i - nx];
      n++;
    }
    if (iz + 1 < nz && wet[i + nx]) {
      acc += arr[i + nx];
      n++;
    }
    if (!n) return 0;
    return acc - n * c;
  }

  _refreshMean() {
    let sumN = 0;
    let sumP = 0;
    let sumZ = 0;
    let sumD = 0;
    let wetN = 0;
    const { n, p, z, d, wet } = this;
    for (let i = 0; i < n.length; i++) {
      if (!wet[i]) continue;
      sumN += n[i];
      sumP += p[i];
      sumZ += z[i];
      sumD += d[i];
      wetN++;
    }
    const inv = 1 / Math.max(1, wetN);
    this.meanN = sumN * inv;
    this.meanP = sumP * inv;
    this.meanZ = sumZ * inv;
    this.meanD = sumD * inv;
    this.mean = this.meanZ;
    this._toBytes();
  }

  _toBytes() {
    const { p, z, d, n, _bytes } = this;
    for (let i = 0; i < p.length; i++) {
      const o = i * 4;
      _bytes[o] = _u8(p[i]);
      _bytes[o + 1] = _u8(z[i]);
      _bytes[o + 2] = _u8(d[i]);
      _bytes[o + 3] = _u8(n[i]);
    }
  }
}

function _clamp01(v) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function _u8(v) {
  let x = v * 255;
  if (x < 0) return 0;
  if (x > 255) return 255;
  return x;
}
