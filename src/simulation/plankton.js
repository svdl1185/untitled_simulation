import { CONFIG, clampHabitatY, hasBeach } from "../config.js";
import { seafloorHeight } from "./obstacles.js";
import { sampleFlow } from "./flow.js";
import { samplePAR } from "./light.js";
import { columnQ10, productionQ10 } from "./temperature.js";
import { setOxygenDemand } from "./oxygen.js";
import { iceAlgaeWant } from "./ice.js";

const _grad = { x: 0, z: 0 };
const _flowP = { x: 0, y: 0, z: 0 };
const _flowZ = { x: 0, y: 0, z: 0 };
const _flowN = { x: 0, y: 0, z: 0 };
const _flowD = { x: 0, y: 0, z: 0 };

/**
 * Trophic field for the pelagic web.
 *
 * 3D concentration is separable: C(x,y,z) = Patch(x,z) × Column(y).
 * Mass lives on the 128×128 patch (`n`,`p`,`z`,`d`). The column is a
 * shared vertical shape — photic / DCM, zooplankton DVM, nutricline,
 * sinking — not a second budget and not a 128³ grid.
 *
 * `sampleLayer` is the xz amplitude. `sampleAt` / `grazeAt` apply the
 * column and the local seafloor. Production, P–Z graze, and detritus
 * export read the live column so the product stays one field.
 *
 * Future guilds should only touch this class:
 *   sampleAt / grazeAt / sampleLayer / grazeLayer / depositLayer /
 *   recycle / overlap / forageDepth / grazeBenthos
 * School fish graze `z` unless a taxon sets `grazeOn: "p"` (krill, menhaden).
 * The bed is three 2D stores: detrital carbon (`benthos`), microphytobenthos
 * (`bedP`, PAR at the local floor), infauna (`infauna`, Type II on both).
 * `grazeBenthos` takes infauna — the living film, not raw carbon.
 * Carcasses and excretion return mass to `n` and `d`.
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
    this.meanB = 0;
    this.meanI = 0;
    this.meanBedP = 0;
    this.prodIndex = 0;
    this.bloomY = CONFIG.thermoY;
    this.zooY = CONFIG.thermoY;
    this.nutY = CONFIG.thermoY;
    this.detY = CONFIG.thermoY;
    this.photicLight = 0.4;
    this.pzCoincide = 0.75;
    this.sinkFrac = 0;
    this._bytes = new Uint8Array(cells * 4);
    this.benthos = new Float32Array(cells);
    this.bedP = new Float32Array(cells);
    this.infauna = new Float32Array(cells);
    this._initColumn();
    this.seed();
  }

  _initColumn() {
    const floor = Math.min(-8, CONFIG.floorY + 6);
    const targets = [-2, -8, -18, -32, -55, -90, -140, -220, -380, -600, -900, -1400, -2000];
    const ys = [];
    for (let i = 0; i < targets.length; i++) {
      const y = targets[i];
      if (y < floor) break;
      ys.push(y);
    }
    if (!ys.length || ys[ys.length - 1] > floor + 12) ys.push(floor);
    this.ny = ys.length;
    this.layerY = new Float32Array(ys);
    this.layerDy = new Float32Array(this.ny);
    this.pCol = new Float32Array(this.ny);
    this.zCol = new Float32Array(this.ny);
    this.nCol = new Float32Array(this.ny);
    this.dCol = new Float32Array(this.ny);
    this._layoutDy();
    this._seedColumn();
  }

  _layoutDy() {
    const { ny, layerY, layerDy } = this;
    for (let i = 0; i < ny; i++) {
      const y = layerY[i];
      const yHi =
        i === 0
          ? Math.min(0, y + (ny > 1 ? (y - layerY[1]) * 0.5 : 4))
          : 0.5 * (layerY[i - 1] + y);
      const yLo = i === ny - 1 ? y : 0.5 * (y + layerY[i + 1]);
      layerDy[i] = Math.max(1, yHi - yLo);
    }
  }

  _seedColumn() {
    const { ny, layerY, pCol, zCol, nCol, dCol } = this;
    const thermo = CONFIG.thermoY ?? -30;
    const dayLook = { night: 0, caustic: 0.75, sunDir: { y: 0.72 }, storm: 0 };
    const nutLine = nutriclineTarget(dayLook);
    const nutSpan = Math.max(40, -CONFIG.floorY);
    for (let i = 0; i < ny; i++) {
      const y = layerY[i];
      const photic = samplePAR(y, dayLook);
      const deep = Math.min(1, Math.max(0, (thermo - y) / nutSpan));
      const nDeep = nProfile(y, nutLine);
      nCol[i] = 0.14 + nDeep * 0.86;
      pCol[i] = Math.max(1e-4, photic * (0.2 + 0.8 * (1 - deep * 0.5)));
      const dy = y - thermo;
      zCol[i] = Math.max(1e-4, Math.exp(-(dy * dy) / (2 * 22 * 22)));
      dCol[i] = 0.08 + deep * 0.92;
    }
    this._maxNormalize(pCol);
    this._maxNormalize(zCol);
    this._maxNormalize(nCol);
    this._maxNormalize(dCol);
    this._syncColumnStats(dayLook);
  }

  seed() {
    const { nx, nz, n, p, z, d, wet, vent } = this;
    n.fill(0);
    p.fill(0);
    z.fill(0);
    d.fill(0);
    wet.fill(0);
    vent.fill(0);
    this.benthos.fill(0);
    this.bedP.fill(0);
    this.infauna.fill(0);
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
        this.benthos[i] = 0.04 + depth * 0.12;
        const parBed = samplePAR(ground, {
          night: 0,
          caustic: 0.75,
          sunDir: { y: 0.72 },
          storm: 0,
        });
        this.bedP[i] = _clamp01(parBed * 0.38);
        this.infauna[i] = _clamp01(0.035 + (1 - depth) * 0.1 + parBed * 0.08);
      }
    }
    this._initColumn();
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
   * Vertical overlap of a grazer at depth `y` with a column layer.
   * Shape comes from the live NPZD column (P in the photic, Z on a DVM).
   */
  overlap(look, y, layer = TROPHIC.Z) {
    const py = y ?? look?.preferredDepth ?? CONFIG.fish.preferredDepth;
    const w = this.profileAt(layer, py);
    return 0.22 + 0.78 * w;
  }

  _inWater(x, y, z) {
    if (y > 0.05) return false;
    return y >= seafloorHeight(x, z) + 0.2;
  }

  sampleAt(layer, x, y, z) {
    if (!this._inWater(x, y, z)) return 0;
    return this.sampleLayer(layer, x, z) * this.profileAt(layer, y);
  }

  grazeAt(layer, x, y, z, amount) {
    if (amount <= 0 || !this._inWater(x, y, z)) return 0;
    return this.graze(x, z, amount, layer);
  }

  profileAt(layer, y) {
    const col = this._col(layer);
    if (!col || this.ny < 2) return 1;
    const ys = this.layerY;
    if (y >= ys[0]) return col[0];
    if (y <= ys[this.ny - 1]) return col[this.ny - 1];
    for (let i = 0; i < this.ny - 1; i++) {
      if (y <= ys[i] && y >= ys[i + 1]) {
        const span = ys[i] - ys[i + 1] || 1;
        const t = (ys[i] - y) / span;
        return col[i] * (1 - t) + col[i + 1] * t;
      }
    }
    return col[0];
  }

  _col(layer) {
    if (layer === TROPHIC.N) return this.nCol;
    if (layer === TROPHIC.P) return this.pCol;
    if (layer === TROPHIC.D) return this.dCol;
    return this.zCol;
  }

  peakY(col) {
    let best = col[0];
    let y = this.layerY[0];
    for (let i = 1; i < this.ny; i++) {
      if (col[i] > best) {
        best = col[i];
        y = this.layerY[i];
      }
    }
    return y;
  }

  /**
   * Shallowest depth where the N column has risen to half of its
   * maximum — the nutricline, not the deep-N peak.
   */
  nutriclineY() {
    const { ny, layerY, nCol } = this;
    if (!ny) return CONFIG.thermoY ?? -30;
    let max = nCol[0];
    for (let i = 1; i < ny; i++) if (nCol[i] > max) max = nCol[i];
    const cut = max * 0.5;
    if (nCol[0] >= cut) return layerY[0];
    for (let i = 1; i < ny; i++) {
      if (nCol[i] >= cut) {
        const a = nCol[i - 1];
        const b = nCol[i];
        const t = (cut - a) / Math.max(1e-6, b - a);
        return layerY[i - 1] + (layerY[i] - layerY[i - 1]) * t;
      }
    }
    return layerY[ny - 1];
  }

  /** Zooplankton DVM depth: column peak, falling back to mixed layer. */
  forageDepth(look) {
    if (this.zCol && this.ny) {
      const y = this.peakY(this.zCol);
      this.bloomY = this.peakY(this.pCol);
      return clampHabitatY(y, CONFIG.fish.maxDepth);
    }
    const night = look?.night ?? 0;
    const dusk = look?.dusk ?? 0;
    const dawn = look?.dawn ?? 0;
    const rise = Math.min(1, night * 0.9 + dusk * 0.55 + dawn * 0.4);
    const deep = clampHabitatY(CONFIG.thermoY - 5, CONFIG.fish.maxDepth);
    return deep + (clampHabitatY(-7.2, CONFIG.fish.maxDepth) - deep) * rise;
  }

  graze(x, z, amount, layer = TROPHIC.Z) {
    if (amount <= 0) return 0;
    const { nx, nz, wet } = this;
    const { fx, fz } = this._indexWorld(x, z);
    const ix = Math.round(fx);
    const iz = Math.round(fz);
    const taken = this._take(this._field(layer), wet, nx, nz, ix, iz, amount);
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

  /** Dead biomass returns to the water column, or to the bed if the carcass is already there. */
  recycle(x, z, biomass, y) {
    if (biomass <= 0) return;
    const onBed = y != null && y < seafloorHeight(x, z) + 8;
    if (onBed) {
      this._splatter(this.benthos, x, z, biomass * 0.72);
      this.depositLayer(TROPHIC.N, x, z, biomass * 0.28);
      return;
    }
    this.depositLayer(TROPHIC.D, x, z, biomass * 0.72);
    this.depositLayer(TROPHIC.N, x, z, biomass * 0.28);
  }

  grazeBenthos(x, z, amount) {
    if (amount <= 0) return 0;
    const { nx, nz, wet, infauna } = this;
    const { fx, fz } = this._indexWorld(x, z);
    const ix = Math.round(fx);
    const iz = Math.round(fz);
    const taken = this._take(infauna, wet, nx, nz, ix, iz, amount);
    if (taken > 0) this._give(this.n, wet, nx, nz, ix, iz, taken * CONFIG.plankton.excrete);
    return taken;
  }

  sampleBenthos(x, z) {
    return this._sampleField(this.benthos, x, z);
  }

  sampleInfauna(x, z) {
    return this._sampleField(this.infauna, x, z);
  }

  sampleBedP(x, z) {
    return this._sampleField(this.bedP, x, z);
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
    const light = Math.max(0.04, Math.min(1, this.photicLight || 0.4));
    const q = Math.max(0.2, Math.min(1.15, productionQ10()));
    const pFrac = Math.min(1, Math.max(0, this.prodIndex) / 0.28);
    const prod = 0.2 + 0.8 * pFrac;
    const stock = 0.08 + 0.92 * Math.min(1, mean / 0.2);
    const climate = Math.max(0.06, light * light * q);
    return Math.max(96, (cap * stock * prod * climate) | 0);
  }

  /** Settle the column against the live look before clipping spawn. Does not graze the patch down. */
  acclimate(look, steps = 24, dt = 0.4) {
    const tod = look || { night: 0, caustic: 0.8, sunDir: { y: 0.7 }, storm: 0 };
    for (let i = 0; i < steps; i++) this._updateColumn(dt, tod);
    this.update(dt, tod, 0);
  }

  update(dt, look, t) {
    this._updateColumn(dt, look);
    const { nx, nz, wet, cellX, cellZ, minX, minZ, vent } = this;
    const cfg = CONFIG.plankton;
    const storm = look?.storm ?? 0;
    const q10 = columnQ10();
    const qProd = productionQ10();
    const qLoop = Math.min(q10, qProd);
    const flowT = t ?? 0;
    const mix = cfg.mix * (1 + storm * 2.4) * dt;
    const ice = CONFIG.water?.ice ?? 0;
    const iceGrow = ice > 0.05 ? ice * 0.05 * (0.45 + 0.55 * this.photicLight) : 0;
    const growP = cfg.growP * this.photicLight * qProd + iceGrow;
    const grazeZ =
      cfg.grazeZ *
      (0.62 + 0.48 * this.pzCoincide) *
      qLoop *
      (0.48 + 0.52 * Math.min(1, this.photicLight / 0.32));
    const sinkFrac = this.sinkFrac;
    const yP = this.bloomY;
    const yZ = this.zooY;
    const yN = this.nutY;
    const yD = this.detY;
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
        sampleFlow(x, yN, z, flowT, storm, _flowN);
        sampleFlow(x, yD, z, flowT, storm, _flowD);
        sampleFlow(x, yP, z, flowT, storm, _flowP);
        sampleFlow(x, yZ, z, flowT, storm, _flowZ);
        const backN = this._indexWorld(x - _flowN.x * dt, z - _flowN.z * dt);
        const backD = this._indexWorld(x - _flowD.x * dt, z - _flowD.z * dt);
        nextN[i] = this._at(Math.round(backN.fx), Math.round(backN.fz), srcN);
        nextD[i] = this._at(Math.round(backD.fx), Math.round(backD.fz), srcD);
        nextP[i] = this._sampleField(srcP, x - _flowP.x * dt, z - _flowP.z * dt);
        nextZ[i] = this._sampleField(srcZ, x - _flowZ.x * dt, z - _flowZ.z * dt);
      }
    }

    let sumN = 0;
    let sumP = 0;
    let sumZ = 0;
    let sumD = 0;
    let sumB = 0;
    let sumI = 0;
    let sumBedP = 0;
    let prod = 0;
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
        const mortP = cfg.mortP * phy * qLoop;
        const mortZ = cfg.mortZ * zoa * qLoop * (1 + zoa / 0.16);
        const remin = cfg.remin * det * q10;
        const ground = seafloorHeight(
          minX + (ix + 0.5) * cellX,
          minZ + (iz + 0.5) * cellZ
        );
        const deep = Math.min(
          1,
          Math.max(0, (CONFIG.shelfY - ground) / Math.max(8, CONFIG.shelfY - CONFIG.floorY))
        );
        const upwell =
          (cfg.baseN * (0.35 + deep) +
            (storm + (CONFIG.water?.upwell ?? 0) * 0.55) * cfg.upwell * deep +
            vent[i] * (0.012 + storm * 0.04)) *
          (1 - nut);

        phy += (uptake - zg - mortP) * dt;
        zoa += (cfg.effZ * zg - mortZ) * dt;
        det += ((1 - cfg.effZ) * zg + mortP * 0.55 + mortZ * 0.65 - remin) * dt;
        nut += (mortP * 0.45 + mortZ * 0.35 + remin + upwell - uptake) * dt;

        const bed = this.benthos;
        const toBed = Math.max(0, det) * sinkFrac * (0.35 + deep * 0.8);
        det -= toBed;
        let benthic = bed[i] + toBed;
        const bedRemin = cfg.remin * 0.42 * q10 * benthic * dt;
        benthic -= bedRemin;
        nut += bedRemin;
        bed[i] = _clamp01(benthic);
        nut = this._stepBed(i, ground, nut, look, dt, qProd, qLoop);

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
        sumB += bed[i];
        sumI += this.infauna[i];
        sumBedP += this.bedP[i];
        prod += uptake;
        wetN++;
      }
    }

    const inv = 1 / Math.max(1, wetN);
    this.meanN = sumN * inv;
    this.meanP = sumP * inv;
    this.meanZ = sumZ * inv;
    this.meanD = sumD * inv;
    this.meanB = sumB * inv;
    this.meanI = sumI * inv;
    this.meanBedP = sumBedP * inv;
    this.mean = this.meanZ;
    this.prodIndex = prod * inv;
    this._toBytes();
    setOxygenDemand(this.meanD, this.meanB + this.meanI * 0.55);
  }

  _updateColumn(dt, look) {
    const { ny, layerY, pCol, zCol, nCol, dCol } = this;
    if (!ny) return;
    const cfg = CONFIG.plankton;
    const night = look?.night ?? 0;
    const dawn = look?.dawn ?? 0;
    const dusk = look?.dusk ?? 0;
    const rise = Math.min(1, night * 0.9 + dusk * 0.55 + dawn * 0.4);
    const thermo = CONFIG.thermoY ?? -30;
    const nutLine = nutriclineTarget(look);
    const nutSpan = Math.max(40, -CONFIG.floorY);
    const zWant = thermo - 4 + (-7.2 - (thermo - 4)) * rise;
    const sigZ = 18 + (1 - rise) * 10;
    const dayLook = { night: 0, caustic: 0.8, sunDir: { y: 0.74 }, storm: look?.storm ?? 0 };
    const kN = 1 - Math.exp(-0.08 * dt * 8);
    const kP = 1 - Math.exp(-0.22 * dt * 8);
    const kZ = 1 - Math.exp(-0.28 * dt * 8);
    const kD = 1 - Math.exp(-0.12 * dt * 8);
    const sinkK = (cfg.sink ?? 0.012) * 1.8 * dt;

    for (let i = 0; i < ny; i++) {
      const y = layerY[i];
      const deep = Math.min(1, Math.max(0, (thermo - y) / nutSpan));
      const nDeep = nProfile(y, nutLine);
      nCol[i] += (0.12 + 0.88 * nDeep - nCol[i]) * kN;
      const parDay = samplePAR(y, dayLook);
      const parNow = samplePAR(y, look);
      const pWant = Math.max(
        1e-5,
        parDay * (0.18 + 0.82 * Math.max(0, nCol[i])) + iceAlgaeWant(y, parNow)
      );
      pCol[i] += (pWant - pCol[i]) * kP;
      const dy = y - zWant;
      let zWantCol = Math.exp(-(dy * dy) / (2 * sigZ * sigZ));
      const ice = CONFIG.water?.ice ?? 0;
      if (ice > 0.08 && y > -14) {
        const film = Math.max(0, 1 + y / 14);
        zWantCol = Math.max(zWantCol, ice * 0.9 * film);
      }
      zCol[i] += (zWantCol - zCol[i]) * kZ;
      dCol[i] += (0.1 + 0.9 * deep - dCol[i]) * kD;
      if (nCol[i] < 0) nCol[i] = 0;
      if (pCol[i] < 0) pCol[i] = 0;
      if (zCol[i] < 0) zCol[i] = 0;
      if (dCol[i] < 0) dCol[i] = 0;
    }
    for (let i = 0; i < ny - 1; i++) {
      const move = dCol[i] * sinkK;
      dCol[i] -= move;
      dCol[i + 1] += move;
    }
    const bed = dCol[ny - 1] * sinkK;
    dCol[ny - 1] = Math.max(0, dCol[ny - 1] - bed);
    this._maxNormalize(pCol);
    this._maxNormalize(zCol);
    this._maxNormalize(nCol);
    this._maxNormalize(dCol);
    this.sinkFrac = (cfg.sink ?? 0.012) * dt * (0.28 + 0.72 * dCol[ny - 1]);
    this._syncColumnStats(look);
  }

  /**
   * Light-driven bed algae, then Type II infauna on carbon + microphyto.
   * Returns the leftover dissolved N. Stays on the seafloor — no current.
   */
  _stepBed(i, ground, nut, look, dt, qProd, qLoop) {
    const cfg = CONFIG.plankton;
    const par = samplePAR(ground, look);
    const nTerm = nut / (nut + cfg.kN);
    const colonize = 0.08 + 0.92 * this.bedP[i];
    const uptake = cfg.growBedP * par * nTerm * qProd * colonize * dt;
    this.bedP[i] = _clamp01(this.bedP[i] + uptake);
    nut = Math.max(0, nut - uptake);

    const food = this.benthos[i] + this.bedP[i];
    const stock = Math.max(this.infauna[i], 0.008);
    const g = cfg.growI * (food / (food + cfg.kI)) * stock * qLoop * dt;
    const denom = food > 1e-8 ? food : 1;
    const takeP = g * (this.bedP[i] / denom);
    const takeC = g * (this.benthos[i] / denom);
    this.bedP[i] = Math.max(0, this.bedP[i] - takeP);
    this.benthos[i] = Math.max(0, this.benthos[i] - takeC);
    this.infauna[i] = _clamp01(this.infauna[i] + cfg.effI * g);

    const mort = cfg.mortI * this.infauna[i] * qLoop * (1 + this.infauna[i] / 0.18) * dt;
    this.infauna[i] = Math.max(0, this.infauna[i] - mort);
    this.benthos[i] = _clamp01(this.benthos[i] + mort * 0.55);
    return nut + mort * 0.45;
  }

  _maxNormalize(col) {
    let m = 0;
    for (let i = 0; i < col.length; i++) if (col[i] > m) m = col[i];
    if (m < 1e-8) {
      col.fill(1);
      return;
    }
    const inv = 1 / m;
    for (let i = 0; i < col.length; i++) col[i] *= inv;
  }

  _syncColumnStats(look) {
    const { ny, layerY, layerDy, pCol, zCol } = this;
    let pNum = 0;
    let pDen = 0;
    let dot = 0;
    let p2 = 0;
    let z2 = 0;
    for (let i = 0; i < ny; i++) {
      const dy = layerDy[i];
      const p = pCol[i];
      const z = zCol[i];
      pNum += samplePAR(layerY[i], look) * p * dy;
      pDen += p * dy;
      dot += p * z * dy;
      p2 += p * p * dy;
      z2 += z * z * dy;
    }
    this.photicLight = pDen > 1e-8 ? pNum / pDen : samplePAR(CONFIG.thermoY ?? -30, look);
    this.pzCoincide = p2 > 1e-8 && z2 > 1e-8 ? dot / Math.sqrt(p2 * z2) : 0.7;
    this.bloomY = this.peakY(pCol);
    this.zooY = this.peakY(zCol);
    this.nutY = this.nutriclineY();
    this.detY = this.peakY(this.dCol);
    CONFIG.water.nutriclineY = this.nutY;
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
    let sumB = 0;
    let sumI = 0;
    let sumBedP = 0;
    let wetN = 0;
    const { n, p, z, d, wet, benthos, bedP, infauna } = this;
    for (let i = 0; i < n.length; i++) {
      if (!wet[i]) continue;
      sumN += n[i];
      sumP += p[i];
      sumZ += z[i];
      sumD += d[i];
      sumB += benthos[i];
      sumI += infauna[i];
      sumBedP += bedP[i];
      wetN++;
    }
    const inv = 1 / Math.max(1, wetN);
    this.meanN = sumN * inv;
    this.meanP = sumP * inv;
    this.meanZ = sumZ * inv;
    this.meanD = sumD * inv;
    this.meanB = sumB * inv;
    this.meanI = sumI * inv;
    this.meanBedP = sumBedP * inv;
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

/** Depth where N starts to rise. Climate upwell and storms lift it toward the light. */
function nutriclineTarget(look) {
  const thermo = CONFIG.thermoY ?? -30;
  const climate = CONFIG.water?.upwell ?? 0;
  const storm = look?.storm ?? 0;
  const lift = Math.min(1, climate + storm * 0.45);
  const photic = -16;
  return thermo * (1 - lift) + photic * lift;
}

/** 0–1 how far below the nutricline this depth sits. Rise is tens of metres, not the abyss. */
function nProfile(y, nutLine) {
  return Math.min(1, Math.max(0, (nutLine - y) / 48));
}
