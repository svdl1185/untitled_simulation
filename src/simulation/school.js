import { CONFIG, cellSchoolTaxa, dvmY, gridMinY, hasBeach, waterMaxZ } from "../config.js";
import {
  allocateMixedSchoolCounts,
  isSchoolBiter,
  isSchoolGrazer,
  schoolDiet,
  schoolHunts,
} from "../world/fauna.js";
import { UniformGrid3D } from "./grid.js";
import { steerFromColliders, resolveColliders, seafloorHeight, seafloorSlope, lookAheadShore, steerOffShore, clampLocalY, placeInColumn, pickHabitatXZ } from "./obstacles.js";
import { sampleFlow } from "./flow.js";
import { TROPHIC } from "./plankton.js";
import { columnQ10 } from "./temperature.js";
import { o2MetabolicFactor, oxygenLimitY } from "./oxygen.js";

function packOf(sharks) {
  return Array.isArray(sharks) ? sharks : sharks ? [sharks] : [];
}

function shoalTargetY(hour, cfg, x, z) {
  if (cfg.habitat === "benthic") {
    return seafloorHeight(x, z) + (cfg.floorClearance ?? 2.4) + 2;
  }
  return dvmY(hour, cfg);
}

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
 * Mixed pelagic school on a shared uniform grid.
 *
 * Every school species present in the cell occupies this one agent set.
 * Individuals carry a taxon index and a social mode. Polarized taxa
 * keep the herring pancake; loose taxa aggregate without aligning;
 * scatter is nearly independent. Shoals stay species-pure. Grazers share a
 * bloom-capped budget; bite-only taxa share a prey-capped slice of the same
 * grid, split by catalog `share`. Mackerel (`diet: "both"`) stays on the
 * bloom budget and also bites named forage.
 *
 * Spacing is nearest-neighbor packing (project + spring on the K closest
 * fish), not a crowd of cancelling forces. Alignment is same-school only
 * so each shoal stays polarized. A thin pancake envelope, pinned just
 * ahead of the live centroid, keeps the volume flat. Alarm spreads
 * through neighbors as a turn wave; flee blends with hold so a strike
 * opens a hole without detonating the shoal.
 *
 * Trophic: grazers Type II-pull `p` or `z`; piscivores bite named forage on
 * the neighbour walk; demersal taxa graze living infauna on the bed. Starvation and
 * predator kills recycle biomass back into the NPZD water column.
 */
export class School {
  constructor(count, opts = {}) {
    const max = CONFIG.maxFish;
    this.max = max;
    this.taxa = opts.taxa || cellSchoolTaxa();
    this._tcfg = this.taxa.map((t) => t.cfg);
    this.maxSchools = CONFIG.maxSchools;
    this.initialSchools = CONFIG.schoolCount;
    this.schoolCount = CONFIG.schoolCount;
    this.count = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.phase = new Float32Array(max);
    this.scale = new Float32Array(max);
    this.pref = new Float32Array(max);
    this.alarm = new Float32Array(max);
    this._alarm = new Float32Array(max);
    this.energy = new Float32Array(max);
    this.sex = new Uint8Array(max);
    this.schoolId = new Uint8Array(max);
    this.taxon = new Uint8Array(max);
    this._compact = new Float32Array(this.maxSchools);
    this.schoolHunger = new Float32Array(this.maxSchools);

    this.centroid = { x: 0, y: CONFIG.fish.preferredDepth, z: 0 };
    this.centroids = [];
    this.anchors = [];
    this.schoolN = new Uint32Array(this.maxSchools);
    this.schoolFem = new Uint32Array(this.maxSchools);
    this.schoolMal = new Uint32Array(this.maxSchools);
    this._sx = new Float64Array(this.maxSchools);
    this._sy = new Float64Array(this.maxSchools);
    this._sz = new Float64Array(this.maxSchools);
    this._svx = new Float64Array(this.maxSchools);
    this._svz = new Float64Array(this.maxSchools);
    this._se = new Float64Array(this.maxSchools);
    this._splitLock = new Float32Array(this.maxSchools);
    this._mark = new Uint8Array(max);
    this._eaten = new Uint8Array(max);
    this.biteT = new Float32Array(max);
    this._nj = new Int32Array(NEAR_K);
    this._nd = new Float32Array(NEAR_K);
    this._orgT = 0;
    this.colliders = null;
    this.colliderCount = 0;
    this.anchorT = 0;
    this.eatenThisFrame = 0;
    this.totalEaten = 0;
    this.totalBorn = 0;
    this.cap = count;
    this._recruitAcc = 0;
    this._starveAcc = 0;
    this._harvestDebt = 0;
    this._hungryN = 0;
    this.meanEnergy = 0.6;
    this._plankton = opts.plankton || null;
    this._hour = opts.hour ?? 12;
    this._tmax = 48;
    this._tn = new Uint32Array(this._tmax);
    this._te = new Float64Array(this._tmax);
    this._th = new Uint32Array(this._tmax);
    this.grazeTaken = new Float64Array(this._tmax);
    this.mealsOf = new Uint32Array(this._tmax);
    this.bornOf = new Uint32Array(this._tmax);
    this.starvedOf = new Uint32Array(this._tmax);
    this.eatenOf = new Uint32Array(this._tmax);
    this.yDeep = new Float32Array(this._tmax);
    this.yShallow = new Float32Array(this._tmax);

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
        gx: 0,
        gz: 0,
        food: 0,
        cruise: 6.8,
        baseCruise: 6.8,
        mill: 0,
        wantMill: 0,
        modeT: 6 + s * 2.1,
        taxon: 0,
      });
    }

    this.grid = new UniformGrid3D({
      minX: -CONFIG.halfX,
      minY: gridMinY(this.taxa),
      minZ: -CONFIG.halfZ,
      maxX: CONFIG.halfX,
      maxY: CONFIG.surfaceY + 4,
      maxZ: waterMaxZ(),
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

  taxonId(i) {
    return this.taxa[this.taxon[i]]?.id || this.taxa[0]?.id || "herring";
  }

  taxonCfg(i) {
    return this._tcfg[this.taxon[i]] || CONFIG.fish;
  }

  shoalCfg(s) {
    return this._tcfg[this.anchors[s]?.taxon ?? 0] || CONFIG.fish;
  }

  /** Per-taxon headcount, energy, graze, births, and deaths since last respawn. */
  taxonTally() {
    const out = {};
    for (let t = 0; t < this.taxa.length; t++) {
      const id = this.taxa[t].id;
      const n = this._tn[t];
      out[id] = {
        n,
        energy: n ? this._te[t] / n : 0,
        hungry: this._th[t],
        graze: this.grazeTaken[t],
        meals: this.mealsOf[t],
        born: this.bornOf[t],
        starved: this.starvedOf[t],
        eaten: this.eatenOf[t],
        yDeep: this.yDeep[t] < 1e8 ? this.yDeep[t] : 0,
        yShallow: this.yShallow[t] > -1e8 ? this.yShallow[t] : 0,
      };
    }
    return out;
  }

  _home(s) {
    const cfg = this.shoalCfg(s);
    const bandY =
      cfg.habitat === "benthic"
        ? cfg.dayDepth ?? -70
        : dvmY(this._hour ?? 12, cfg);
    const wantY = bandY + (s % 2 === 0 ? -2 : 2.5);
    const diet = schoolDiet(cfg);
    let foodPeak = null;
    const bloom = this._plankton;
    if (bloom) {
      if (cfg.habitat === "benthic") foodPeak = bloom.peakLayer("infauna");
      else if (diet !== "bite") {
        foodPeak = bloom.peakLayer(cfg.grazeOn === "p" || diet === "p" ? TROPHIC.P : TROPHIC.Z);
      }
    }
    let kind = "pelagic";
    if (cfg.habitat === "benthic") kind = "benthic";
    else if ((cfg.dayDepth ?? -40) > -22 || cfg.anchorTop) kind = "surface";
    else if ((cfg.dayDepth ?? 0) < -200 || (cfg.maxDepth ?? 0) < -600) kind = "deep";
    const xz = pickHabitatXZ(s, {
      wantY,
      kind,
      foodPeak,
      ringCount: Math.max(1, this.initialSchools),
    });
    const yTarget =
      cfg.habitat === "benthic"
        ? seafloorHeight(xz.x, xz.z) + (cfg.floorClearance ?? 2.4) + 2
        : wantY;
    const placed = placeInColumn(xz.x, xz.z, yTarget, {
      maxDepth: oxygenLimitY(cfg),
      clearance: cfg.floorClearance,
      minWater: cfg.minWater,
    });
    return {
      x: placed.x,
      y: placed.y,
      z: placed.z,
      heading: ((s / Math.max(1, this.initialSchools)) * Math.PI * 2 + 0.31) + Math.PI * 0.5,
    };
  }

  respawn(count, hour) {
    if (hour != null) this._hour = hour;
    const n = this.taxa.length ? Math.max(0, Math.min(this.max, count | 0)) : 0;
    this.count = 0;
    this.cap = n;
    this.totalEaten = 0;
    this.totalBorn = 0;
    this._recruitAcc = 0;
    this._starveAcc = 0;
    this._harvestDebt = 0;
    this._tn.fill(0);
    this._te.fill(0);
    this._th.fill(0);
    this.grazeTaken.fill(0);
    this.mealsOf.fill(0);
    this.bornOf.fill(0);
    this.starvedOf.fill(0);
    this.eatenOf.fill(0);
    this.yDeep.fill(1e9);
    this.yShallow.fill(-1e9);
    this._splitLock.fill(0);
    this.alarm.fill(0);
    this._alarm.fill(0);
    this.biteT.fill(0);
    this._eaten.fill(0);
    this.schoolHunger.fill(0.4);

    const slots = this.taxa.map(() => []);
    let used = 0;
    for (let t = 0; t < this.taxa.length && used < this.maxSchools; t++) {
      slots[t].push(used++);
    }
    for (let t = 0; t < this.taxa.length && used < this.maxSchools; t++) {
      const want = Math.max(1, this._tcfg[t]?.groups ?? 2);
      while (slots[t].length < want && used < this.maxSchools) slots[t].push(used++);
    }
    if (!slots.length) slots.push([0]);
    this.initialSchools = Math.max(1, used);
    this.schoolCount = this.initialSchools;
    this._taxonSlots = slots;

    const homes = [];
    for (let s = 0; s < this.maxSchools; s++) {
      let t = 0;
      for (let k = 0; k < slots.length; k++) {
        if (slots[k].includes(s)) {
          t = k;
          break;
        }
      }
      if (s >= used) t = Math.max(0, this.taxa.length - 1);
      const a = this.anchors[s];
      a.taxon = t;
      const home = this._home(s % Math.max(1, this.initialSchools));
      homes[s] = home;
      a.x = home.x;
      a.y = home.y;
      a.z = home.z;
      a.t = s * 2.4;
      a.hx = Math.sin(home.heading);
      a.hz = Math.cos(home.heading);
      a.gx = 0;
      a.gz = 0;
      a.food = 0;
      a.cruise = 6.4 + (s % 3) * 0.45;
      a.baseCruise = a.cruise;
      a.mill = 0;
      a.wantMill = 0;
      a.modeT = 8 + s * 3.1;
      this.schoolN[s] = 0;
    }

    const bloomCap = this._plankton ? this._plankton.carryingCapacity(n) : n;
    const alloc = allocateMixedSchoolCounts(
      n,
      this.taxa,
      bloomCap,
      CONFIG.schoolMinPer || 0,
      CONFIG.piscivorePreyRatio
    );
    const nY = 5;
    let i = 0;
    for (let t = 0; t < alloc.length; t++) {
      const want = alloc[t].n;
      const cfg = this._tcfg[t] || CONFIG.fish;
      const rest = cfg.restSpacing;
      const sids = this._taxonSlots[t] || [0];
      const nSid = Math.max(1, sids.length);
      const polarized = (cfg.social || "polarized") === "polarized";
      const per = Math.ceil(want / nSid);
      const nSide = Math.max(5, Math.round(Math.sqrt(per / nY) * 0.62));
      const nAlong = Math.max(8, Math.ceil(per / (nY * nSide)));
      for (let k = 0; k < want && i < n; k++, i++) {
        const sid = sids[k % nSid];
        const i3 = i * 3;
        this.taxon[i] = t;
        this.schoolId[i] = sid;
        const home = homes[sid];
        const heading0 = home.heading + (Math.random() - 0.5) * (polarized ? 0.22 : 1.8);
        let x;
        let y;
        let z;
        if (polarized) {
          const layer = k % nY;
          const plane = (k / nY) | 0;
          const sideI = plane % nSide;
          const alongI = (plane / nSide) | 0;
          const jitter = rest * 0.42;
          const side =
            (sideI + (alongI & 1) * 0.5 - (nSide - 1) * 0.5) * rest +
            (Math.random() - 0.5) * jitter;
          const along =
            (alongI - (nAlong - 1) * 0.5) * rest * 0.92 +
            (Math.random() - 0.5) * jitter;
          const up =
            (layer - (nY - 1) * 0.5) * rest * 0.72 +
            (Math.random() - 0.5) * jitter * 0.7;
          const hx = Math.sin(home.heading);
          const hz = Math.cos(home.heading);
          x = home.x + hx * along - hz * side;
          y = home.y + up;
          z = home.z + hz * along + hx * side;
        } else {
          const spread = rest * (6 + (k % nSid) * 0.4);
          x = home.x + (Math.random() - 0.5) * spread * 2.4;
          y = home.y + (Math.random() - 0.5) * rest * 1.6;
          z = home.z + (Math.random() - 0.5) * spread * 2.4;
        }
        y = clampLocalY(y, x, z, oxygenLimitY(cfg), cfg.floorClearance);
        this.pos[i3] = x;
        this.pos[i3 + 1] = y;
        this.pos[i3 + 2] = z;
        const spd = (cfg.minSpeed + cfg.maxSpeed) * 0.42 + Math.random() * 1.8;
        this.vel[i3] = Math.sin(heading0) * spd;
        this.vel[i3 + 1] = (Math.random() - 0.5) * (polarized ? 0.08 : 0.35);
        this.vel[i3 + 2] = Math.cos(heading0) * spd;
        this.phase[i] = Math.random() * Math.PI * 2;
        const female = Math.random() < 0.5;
        this.sex[i] = female ? 0 : 1;
        this.scale[i] = (0.84 + Math.random() * 0.32) * (female ? 1.05 : 0.96);
        this.pref[i] = 0.86 + Math.random() * 0.28;
        this.energy[i] = 0.52 + Math.random() * 0.28;
      }
    }
    this.count = i;
    this.meanEnergy = 0.66;
    this._refreshCentroids();
  }

  clipToBloom(plankton) {
    if (!plankton) return;
    this._plankton = plankton;
    const foodCap = plankton.carryingCapacity(this.cap);
    const alloc = allocateMixedSchoolCounts(
      this.cap,
      this.taxa,
      foodCap,
      0,
      CONFIG.piscivorePreyRatio
    );
    const want = alloc.map((row) => row.n);
    const have = new Array(this.taxa.length).fill(0);
    for (let i = 0; i < this.count; i++) have[this.taxon[i]]++;
    let i = this.count - 1;
    let guard = this.count + 8;
    while (guard-- > 0 && i >= 0) {
      const t = this.taxon[i];
      if (have[t] > (want[t] ?? 0)) {
        this.remove(i, false);
        have[t]--;
        if (i >= this.count) i = this.count - 1;
      } else {
        i--;
      }
    }
    this._refreshCentroids();
  }

  setCount(next) {
    if (!this.taxa.length) {
      this.cap = 0;
      if (this.count !== 0) {
        this.count = 0;
        this._refreshCentroids();
      }
      return;
    }
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
      this.taxon[i] = this.anchors[sid]?.taxon ?? 0;
      const tcfg = this.taxonCfg(i);
      const x = c.x + (Math.random() - 0.5) * rest * 4;
      const z = c.z + (Math.random() - 0.5) * rest * 4;
      this.pos[i3] = x;
      this.pos[i3 + 1] = clampLocalY(
        c.y + (Math.random() - 0.5) * rest * 2,
        x,
        z,
        oxygenLimitY(tcfg),
        tcfg.floorClearance
      );
      this.pos[i3 + 2] = z;
      const spd = a.cruise;
      this.vel[i3] = a.hx * spd;
      this.vel[i3 + 1] = 0;
      this.vel[i3 + 2] = a.hz * spd;
      this.phase[i] = Math.random() * Math.PI * 2;
      const female = Math.random() < 0.5;
      this.sex[i] = female ? 0 : 1;
      this.scale[i] = (0.84 + Math.random() * 0.32) * (female ? 1.05 : 0.96);
      this.pref[i] = 0.86 + Math.random() * 0.28;
      this.alarm[i] = 0;
      this.energy[i] = 0.48 + Math.random() * 0.2;
    }
    this.count = n;
    this.cap = n;
    this._refreshCentroids();
  }

  remove(i, harvested = true) {
    const t = this.taxon[i];
    if (harvested) this.eatenOf[t]++;
    else this.starvedOf[t]++;
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
      this.pref[i] = this.pref[last];
      this.alarm[i] = this.alarm[last];
      this.energy[i] = this.energy[last];
      this.biteT[i] = this.biteT[last];
      this.sex[i] = this.sex[last];
      this.schoolId[i] = this.schoolId[last];
      this.taxon[i] = this.taxon[last];
    }
    this.count = last;
    if (harvested) {
      this.totalEaten++;
      this.eatenThisFrame++;
    }
  }

  nearestFish(x, y, z, radius, taxa = null, glowRadius = 0) {
    const grid = this.grid;
    if (!grid || this.count <= 0) return null;
    const { heads, next, keyOf, nx, ny, nz, mask, inv, minX, minY, minZ } = grid;
    const pos = this.pos;
    const vel = this.vel;
    const rGlow = glowRadius > radius ? glowRadius : radius;
    const r2 = rGlow * rGlow;
    const vis2 = radius * radius;
    let ix0 = (x - minX) * inv | 0;
    let iy0 = (y - minY) * inv | 0;
    let iz0 = (z - minZ) * inv | 0;
    if (ix0 < 0) ix0 = 0;
    else if (ix0 >= nx) ix0 = nx - 1;
    if (iy0 < 0) iy0 = 0;
    else if (iy0 >= ny) iy0 = ny - 1;
    if (iz0 < 0) iz0 = 0;
    else if (iz0 >= nz) iz0 = nz - 1;
    let best = -1;
    let bestD = r2;
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
        if (keyOf[j] !== want) continue;
        inspected++;
        if (inspected > NEIGHBOR_BUDGET) break outer;
        if (taxa && taxa.length && !taxa.includes(this.taxonId(j))) continue;
        const j3 = j * 3;
        const dx = pos[j3] - x;
        const dy = pos[j3 + 1] - y;
        const dz = pos[j3 + 2] - z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < bestD) {
          if (d2 > vis2 && !this.taxa[this.taxon[j]]?.look?.photophores) continue;
          bestD = d2;
          best = j;
        }
      }
    }
    if (best < 0) return null;
    const i3 = best * 3;
    return {
      i: best,
      x: pos[i3],
      y: pos[i3 + 1],
      z: pos[i3 + 2],
      vx: vel[i3],
      vy: vel[i3 + 1],
      vz: vel[i3 + 2],
    };
  }

  targetFor(shark) {
    const want = shark.cfg?.huntTaxa;
    let best = 0;
    let bestD = Infinity;
    let matched = false;
    for (let s = 0; s < this.maxSchools; s++) {
      if (this.schoolN[s] < 8) continue;
      if (want && want.length) {
        const tid = this.anchors[s]?.taxon ?? 0;
        const id = this.taxa[tid]?.id;
        if (!want.includes(id)) continue;
        matched = true;
      }
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
    if (want && want.length && !matched) {
      return this.centroids[this.schoolN[shark.huntIndex] > 8 ? shark.huntIndex : 0] || this.centroid;
    }
    const idx = this.schoolN[shark.huntIndex] > 8 && (!want || want.includes(this.taxa[this.anchors[shark.huntIndex]?.taxon ?? 0]?.id))
      ? shark.huntIndex
      : best;
    return this.centroids[idx];
  }

  update(dt, sharks, look, plankton) {
    this.eatenThisFrame = 0;
    this._plankton = plankton || null;
    this._look = look || null;
    const pack = packOf(sharks);
    this._wanderAnchors(dt, pack, look);
    this.grid.rebuild(this.pos, this.count);
    this._eat(pack, plankton);
    for (let p = 0; p < pack.length; p++) pack[p]._eatVehicles?.(pack, plankton);
    this._flock(dt, pack, look);
    this._resolveBites(plankton);
    this._reorganize(dt, pack, look);
    if (plankton) {
      this._recruit(dt, plankton);
      this._starve(dt, plankton);
    }
  }

  _preyCentroid(s, cfg) {
    const eaterId = this.taxa[this.anchors[s]?.taxon ?? 0]?.id;
    let best = null;
    let bestD = Infinity;
    for (let k = 0; k < this.maxSchools; k++) {
      if (k === s || this.schoolN[k] < 4) continue;
      const tid = this.anchors[k]?.taxon ?? 0;
      const id = this.taxa[tid]?.id;
      if (!schoolHunts(cfg, eaterId, id)) continue;
      const c = this.centroids[k];
      const me = this.centroids[s];
      const d2 = (c.x - me.x) ** 2 + (c.y - me.y) ** 2 + (c.z - me.z) ** 2;
      if (d2 < bestD) {
        bestD = d2;
        best = c;
      }
    }
    return best;
  }

  _wanderAnchors(dt, pack, look) {
    this.anchorT += dt * 0.11;
    const boundX = CONFIG.halfX - 32;
    const boundZ = CONFIG.halfZ - 36;
    for (let s = 0; s < this.maxSchools; s++) {
      const scfg = this.shoalCfg(s);
      const depth = shoalTargetY(look?.hour ?? 12, scfg, this.centroids[s].x, this.centroids[s].z);
      const lead = scfg.lead ?? CONFIG.fish.lead;
      const polarized = (scfg.social || "polarized") === "polarized";
      this._splitLock[s] = Math.max(0, this._splitLock[s] - dt);
      if (this.schoolN[s] === 0) {
        this.anchors[s].mill = 0;
        this.anchors[s].wantMill = 0;
        continue;
      }
      const a = this.anchors[s];
      const c = this.centroids[s];
      a.t += dt;
      a.modeT -= dt;
      const bloom = this._plankton;
      const hunger = this.schoolHunger[s];
      const biter = isSchoolBiter(scfg);
      const grazer = isSchoolGrazer(scfg);
      const grazeP = scfg.grazeOn === "p";
      const food = grazer && bloom
        ? bloom.sampleAt(grazeP ? TROPHIC.P : TROPHIC.Z, c.x, c.y, c.z)
        : biter
          ? 0.35
          : 0;

      let hx = a.hx;
      let hz = a.hz;
      let sharkNear = false;
      let farAll = true;
      for (let p = 0; p < pack.length; p++) {
        const shark = pack[p];
        const dx = c.x - shark.x;
        const dy = c.y - shark.y;
        const dz = c.z - shark.z;
        const d2 = dx * dx + dz * dz;
        const avoidR = shark.fearRadius + scfg.schoolRadius;
        if (d2 + dy * dy < (shark.fearRadius + 82) ** 2) farAll = false;
        if (d2 < avoidR * avoidR && d2 > 1) {
          sharkNear = true;
          const d = Math.sqrt(d2);
          const w = (1 - d / avoidR) ** 2;
          hx += (dx / d) * w * 1.4;
          hz += (dz / d) * w * 1.4;
        }
      }
      if (sharkNear) {
        a.wantMill = 0;
        a.modeT = 5 + Math.random() * 4;
      } else if (!polarized) {
        const turn = Math.sin(a.t * 0.19 + s * 2.1) * 0.95 + (Math.random() - 0.5) * 0.4;
        const ang = Math.atan2(hx, hz) + turn * dt;
        hx = Math.sin(ang);
        hz = Math.cos(ang);
        a.wantMill = hunger < 0.62 && farAll ? 1 : 0;
        if (a.modeT <= 0) a.modeT = 6 + Math.random() * 10;
      } else {
        const turn = Math.sin(a.t * 0.11 + s * 1.3) * (a.mill > 0.45 ? 0.82 : 0.2);
        const ang = Math.atan2(hx, hz) + turn * dt;
        hx = Math.sin(ang);
        hz = Math.cos(ang);
        if (a.modeT <= 0) {
          if (food > 0.3 && hunger < 0.42 && farAll) {
            a.wantMill = 1;
            a.modeT = 7 + Math.random() * 11;
          } else if (hunger > 0.55 || food < 0.1) {
            a.wantMill = 0;
            a.modeT = 10 + Math.random() * 16;
          } else if (a.mill < 0.5 && farAll && Math.random() < 0.38) {
            a.wantMill = 1;
            a.modeT = 8 + Math.random() * 12;
          } else {
            a.wantMill = 0;
            a.modeT = 14 + Math.random() * 22;
          }
        }
      }
      const hLen = Math.hypot(hx, hz) || 1;
      a.hx = hx / hLen;
      a.hz = hz / hLen;

      const flowA = sampleFlow(c.x, c.y, c.z, look?.simTime ?? 0, look?.storm ?? 0);
      a.hx += flowA.x * 0.07;
      a.hz += flowA.z * 0.07;
      if (biter && !grazer) {
        const prey = this._preyCentroid(s, scfg);
        if (prey) {
          let gx = prey.x - c.x;
          let gz = prey.z - c.z;
          const gLen = Math.hypot(gx, gz) || 1;
          const pull = 0.22 + hunger * 1.15;
          a.hx += (gx / gLen) * pull;
          a.hz += (gz / gLen) * pull;
          a.gx = gx / gLen;
          a.gz = gz / gLen;
          a.food = 0.45;
        } else {
          a.gx = 0;
          a.gz = 0;
          a.food = 0;
        }
      } else if (bloom) {
        const g = grazeP ? bloom.gradientLayer(TROPHIC.P, c.x, c.z) : bloom.gradient(c.x, c.z);
        let pull = 0.18 + hunger * 1.2;
        if (food < 0.14) pull += 0.45;
        if (food > 0.42 && hunger < 0.36) pull *= 0.12;
        a.hx += g.x * pull;
        a.hz += g.z * pull;
        a.gx = g.x;
        a.gz = g.z;
        a.food = food;
      } else {
        a.gx = 0;
        a.gz = 0;
        a.food = 0;
      }
      if (c.x > boundX) a.hx = -Math.abs(a.hx);
      else if (c.x < -boundX) a.hx = Math.abs(a.hx);
      if (c.z > boundZ) a.hz = -Math.abs(a.hz);
      else if (c.z < -boundZ) a.hz = Math.abs(a.hz);
      const groundA = seafloorHeight(c.x, c.z);
      if (groundA > depth + 6) {
        const sl = seafloorSlope(c.x, c.z);
        a.hx -= sl.x * 2.4;
        a.hz -= sl.z * 2.4;
      }
      const shore = lookAheadShore(c.x, c.z, a.hx, a.hz, CONFIG.fish.beachLook);
      if (shore.urgency > 0) {
        const turned = steerOffShore(
          a.hx,
          a.hz,
          shore.urgency,
          shore.gx,
          shore.gz,
          dt * (3.6 + shore.urgency * 8)
        );
        a.hx = turned.hx;
        a.hz = turned.hz;
        a.wantMill = 0;
        a.modeT = Math.max(a.modeT, 6);
      }
      if (hasBeach() && c.z > CONFIG.beach.shoreZ - 50) a.hz = -Math.abs(a.hz);
      const hn = Math.hypot(a.hx, a.hz) || 1;
      a.hx /= hn;
      a.hz /= hn;

      const wantMill = shore.urgency > 0.12 ? 0 : a.wantMill ? 1 : 0;
      a.mill += (wantMill - a.mill) * Math.min(1, dt * 0.65);
      if (a.mill < 0.02) a.mill = 0;
      a.cruise = (a.baseCruise || a.cruise) * (1 + hunger * 0.2) * (food > 0.4 && hunger < 0.38 ? 0.74 : 1);

      const leadD = lead * (1 - shore.urgency * 0.75);
      a.x = c.x + a.hx * leadD;
      a.z = c.z + a.hz * leadD;
      let wantY = depth + (s % 2 === 0 ? -3 : 2.2);
      if (scfg.habitat !== "benthic") {
        const forageY = bloom ? bloom.forageDepth(look) : wantY;
        const night = look?.night ?? 0;
        if (night > 0.45) {
          wantY += (forageY - wantY) * (0.35 + hunger * 0.4);
        } else if (hunger > 0.62) {
          wantY += (forageY - wantY) * Math.min(0.28, (hunger - 0.62) * 0.7);
        }
        if (biter && hunger > 0.48) {
          const prey = this._preyCentroid(s, scfg);
          if (prey) wantY += (prey.y - wantY) * 0.42;
        }
      }
      a.y += (wantY - a.y) * Math.min(1, dt * 0.55);
      const scfgBot = this.shoalCfg(s);
      const waterTop = scfgBot.anchorTop ?? -3.2;
      const pad = scfgBot.habitat === "benthic" ? (scfgBot.floorClearance ?? 2.4) + 1.6 : 8;
      const waterBot = Math.max(groundA + pad, oxygenLimitY(scfgBot));
      if (waterBot < waterTop) {
        if (a.y < waterBot) a.y = waterBot;
        else if (a.y > waterTop) a.y = waterTop;
      } else {
        a.y = (groundA - 1.2) * 0.5;
      }
    }
  }

  _flock(dt, pack, look) {
    const { count, pos, vel, schoolId } = this;
    const cfg = CONFIG.fish;
    const { heads, next, keyOf, nx, ny, nz, mask, inv, minX, minY, minZ } = this.grid;
    const tight = look?.tight ?? 0;
    const holdR0 = cfg.schoolRadius * (look?.schoolRadiusScale ?? 1);
    const cohW = cfg.cohWeight * (1 + tight * 0.6);
    const aliCap = 14;
    const cohCap = 12;
    const colliders = this.colliders;
    const colliderCount = this.colliderCount;
    const nj = this._nj;
    const nd = this._nd;
    const simT = look?.simTime ?? 0;

    const nPred = pack.length;
    this._eaten.fill(0);

    const compact = this._compact;
    for (let s = 0; s < this.maxSchools; s++) {
      if (this.schoolN[s] === 0) {
        compact[s] = 0;
        continue;
      }
      const c = this.centroids[s];
      const holdRs = (this.shoalCfg(s).schoolRadius ?? cfg.schoolRadius) * (look?.schoolRadiusScale ?? 1);
      let u = 0;
      for (let p = 0; p < nPred; p++) {
        const pred = pack[p];
        const fearR = pred.fearRadius;
        const d = Math.hypot(c.x - pred.x, c.y - pred.y, c.z - pred.z);
        const inner = fearR + 10;
        const outer = fearR + holdRs + 30;
        let uu = 0;
        if (d < inner) uu = 1;
        else if (d < outer) uu = (outer - d) / (outer - inner);
        if (uu > u) u = uu;
      }
      compact[s] = u * u;
    }

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
    this._se.fill(0);
    this.schoolN.fill(0);
    this.schoolFem.fill(0);
    this.schoolMal.fill(0);
    this._hungryN = 0;
    this._tn.fill(0);
    this._te.fill(0);
    this._th.fill(0);
    const halfSat = CONFIG.plankton.halfSat;
    const grazeRate = CONFIG.plankton.graze;
    const q10 = columnQ10();

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const px = pos[i3];
      const py = pos[i3 + 1];
      const pz = pos[i3 + 2];
      const vx = vel[i3];
      const vy = vel[i3 + 1];
      const vz = vel[i3 + 2];
      const sid = schoolId[i];
      const tcfg = this._tcfg[this.taxon[i]] || cfg;
      const cfg = tcfg;
      const rest = cfg.restSpacing;
      const yMul = cfg.yMul;
      const sepR2 = cfg.sepRadius * cfg.sepRadius;
      const aliR2 = cfg.aliRadius * cfg.aliRadius;
      const cohR2 = cfg.cohRadius * cfg.cohRadius;
      const forageGain = cfg.forageGain;
      const metabolism = cfg.metabolism;
      const polarized = (cfg.social || "polarized") === "polarized";
      const diet = schoolDiet(cfg);
      const eaterId = this.taxa[this.taxon[i]]?.id;
      this.biteT[i] = Math.max(0, (this.biteT[i] || 0) - dt);
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
      let neighAlarm = 0;
      let pdx = 0;
      let pdy = 0;
      let pdz = 0;
      let pd2 = 1e15;
      let sfx = 0;
      let sfy = 0;
      let sfz = 0;
      let fearR = 1;
      let inFear = false;
      let lunging = false;

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
          const jcfg = this._tcfg[this.taxon[j]];
          const preyId = this.taxa[this.taxon[j]]?.id;
          if (schoolHunts(jcfg, preyId, eaterId)) {
            const scareR = jcfg.fearRadius || (jcfg.biteRadius || 1.2) * 5;
            if (d2 < scareR * scareR && d2 > 1e-5) {
              inFear = true;
              neighAlarm = Math.max(neighAlarm, 1);
              if (d2 < pd2) {
                pd2 = d2;
                pdx = dx;
                pdy = dy;
                pdz = dz;
                fearR = scareR;
                let sLen = Math.hypot(vel[j3], vel[j3 + 1], vel[j3 + 2]);
                if (sLen < 1e-4) sLen = 1;
                sfx = vel[j3] / sLen;
                sfy = vel[j3 + 1] / sLen;
                sfz = vel[j3 + 2] / sLen;
              }
            }
          }
          if (
            schoolHunts(cfg, eaterId, preyId) &&
            this.energy[i] < 0.82 &&
            this.biteT[i] <= 0 &&
            !this._eaten[j]
          ) {
            const br = cfg.biteRadius || 1.2;
            if (d2 < br * br) {
              this._eaten[j] = 1;
              this.energy[i] = Math.min(1, this.energy[i] + (cfg.eatEnergy || 0.08));
              this.mealsOf[this.taxon[i]]++;
              this.biteT[i] = 0.16;
            }
          }
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

          if (d2 < aliR2 && this.alarm[j] > neighAlarm) neighAlarm = this.alarm[j];
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
          const push = gap * 0.38;
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
        ay += (aliY * invN - vy) * cfg.aliWeight * 0.32;
        az += (aliZ * invN - vz) * cfg.aliWeight;
      }

      if (cohN > 0) {
        const invN = 1 / cohN;
        const cx = cohX * invN - px;
        const cy = cohY * invN - py;
        const cz = cohZ * invN - pz;
        const cLen = Math.hypot(cx, cy, cz);
        if (cLen > 1e-4) {
          const w = (cohW * (1 + this._compact[sid] * 0.7)) / cLen;
          ax += cx * w * cfg.maxSpeed;
          ay += cy * w * cfg.maxSpeed * 0.82;
          az += cz * w * cfg.maxSpeed;
        }
      }

      for (let p = 0; p < nPred; p++) {
        const pred = pack[p];
        const dx = px - pred.x;
        const dy = py - pred.y;
        const dz = pz - pred.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < pred.fearRadius * pred.fearRadius && d2 > 1e-5) inFear = true;
        if (d2 < pd2) {
          pd2 = d2;
          pdx = dx;
          pdy = dy;
          pdz = dz;
          fearR = pred.fearRadius;
          lunging = pred.lunging;
          let sLen = Math.hypot(pred.vx, pred.vy, pred.vz);
          if (sLen < 1e-4) sLen = 1;
          sfx = pred.vx / sLen;
          sfy = pred.vy / sLen;
          sfz = pred.vz / sLen;
        }
      }
      let nextAlarm = this.alarm[i] * Math.exp(-dt * 3.1);
      if (inFear) nextAlarm = 1;
      else if (neighAlarm > (polarized ? 0.22 : 0.5)) {
        const spread = neighAlarm * (polarized ? 0.58 : 0.16);
        if (spread > nextAlarm) {
          nextAlarm += (spread - nextAlarm) * Math.min(1, dt * 7);
        }
      }
      if (nextAlarm < 0.02) nextAlarm = 0;
      else if (nextAlarm > 1) nextAlarm = 1;
      this._alarm[i] = nextAlarm;
      const alarm = nextAlarm;
      const mill = polarized ? anchor.mill : 0;
      const packed = polarized ? this._compact[sid] : this._compact[sid] * 0.35;
      const holdR = (cfg.schoolRadius * (look?.schoolRadiusScale ?? 1)) *
        (1 - tight * 0.1) * (1 - packed * 0.24) * (1 - mill * 0.1);
      const holdH = cfg.schoolHeight * (1 - tight * 0.34) * (1 - packed * 0.16);
      const alongR = holdR * 1.36;
      const sideR = holdR * 0.68;
      let maxSpd = cfg.maxSpeed * (0.82 + this.pref[i] * 0.22);
      let maxAcc = cfg.maxAccel;

      let dhx = anchor.hx;
      let dhz = anchor.hz;
      const wantSpd = anchor.cruise * this.pref[i] * (1 - mill * 0.55);
      if (mill > 0.04) {
        const rx = px - hold.x;
        const rz = pz - hold.z;
        const r = Math.hypot(rx, rz);
        let tx = -rz;
        let tz = rx;
        const tlen = Math.hypot(tx, tz);
        if (tlen > 1e-4) {
          tx /= tlen;
          tz /= tlen;
          const invR = 1 / (r > 0.2 ? r : 0.2);
          const inward = (r - holdR * 0.5) * 0.14;
          dhx = dhx * (1 - mill) + (tx - rx * invR * inward) * mill;
          dhz = dhz * (1 - mill) + (tz - rz * invR * inward) * mill;
          const hl = Math.hypot(dhx, dhz) || 1;
          dhx /= hl;
          dhz /= hl;
        }
      }
      const shore = lookAheadShore(px, pz, dhx, dhz, 36);
      if (shore.urgency > 0) {
        const turned = steerOffShore(dhx, dhz, shore.urgency, shore.gx, shore.gz, 0.2 + shore.urgency * 0.35);
        dhx = turned.hx;
        dhz = turned.hz;
      }

      let cruiseX = (dhx * wantSpd - vx) * cfg.cruiseWeight;
      let cruiseY = -vy * cfg.pitchDamp;
      let cruiseZ = (dhz * wantSpd - vz) * cfg.cruiseWeight;
      const nse = Math.sin(simT * 1.25 + this.phase[i] * 2.7);
      cruiseX += -anchor.hz * nse * cfg.noiseWeight;
      cruiseZ += anchor.hx * nse * cfg.noiseWeight;

      const groundHold = seafloorHeight(px, pz);
      const ceilHold = -cfg.surfaceClearance;
      const sandPad = Math.max(groundHold + cfg.floorClearance + 0.6, oxygenLimitY(cfg));
      const room = Math.max(2.2, (ceilHold - sandPad) * 0.5);
      const localH = Math.min(holdH, room);
      let holdY = hold.y;
      if (holdY < sandPad + localH) holdY = sandPad + localH;
      if (holdY > ceilHold - localH) holdY = ceilHold - localH;
      const hdx = px - hold.x;
      const hdy = py - holdY;
      const hdz = pz - hold.z;
      if (polarized) {
        const along = hdx * anchor.hx + hdz * anchor.hz;
        const side = hdx * -anchor.hz + hdz * anchor.hx;
        const nxh = along / alongR;
        const nyh = hdy / localH;
        const nzh = side / sideR;
        const e2 = nxh * nxh + nyh * nyh + nzh * nzh;
        if (e2 > 1) {
          const e = Math.sqrt(e2);
          const extra = (e - 1) * cfg.holdWeight * (1 + (e - 1) * 0.65);
          cruiseX -= extra * (nxh * anchor.hx) / alongR - extra * (nzh * anchor.hz) / sideR;
          cruiseY -= extra * nyh / localH;
          cruiseZ -= extra * (nxh * anchor.hz) / alongR + extra * (nzh * anchor.hx) / sideR;
        } else if (along < 0) {
          const catchUp = (-along / alongR) * 2.6;
          cruiseX += dhx * catchUp;
          cruiseZ += dhz * catchUp;
        }
        const sideAbs = Math.abs(side);
        if (mill < 0.25 && sideAbs > alongR * 0.4) {
          const cut = (sideAbs / sideR - 0.5) * 3.1;
          if (cut > 0) {
            const sgn = side > 0 ? 1 : -1;
            cruiseX += anchor.hz * sgn * cut;
            cruiseZ -= anchor.hx * sgn * cut;
          }
        }
      } else {
        const d2 = hdx * hdx + hdz * hdz;
        const r = Math.max(8, cfg.schoolRadius);
        if (d2 > r * r) {
          const d = Math.sqrt(d2);
          const w = cfg.holdWeight * Math.min(2.2, d / r - 1);
          cruiseX -= (hdx / d) * w;
          cruiseZ -= (hdz / d) * w;
        }
      }
      cruiseY += (anchor.y - py) * cfg.depthWeight;
      let e = this.energy[i];
      const bloom = this._plankton;
      if (alarm < 0.82 && shore.urgency < 0.45 && bloom) {
        if (diet !== "bite") {
          const grazeP = cfg.grazeOn === "p";
          const layer = grazeP ? TROPHIC.P : TROPHIC.Z;
          const zFood = bloom.sampleAt(layer, px, py, pz);
          const hunger = 1 - e;
          const sat = zFood / (zFood + halfSat);
          const panic = alarm * 0.7;
          const demand = grazeRate * (cfg.grazeMul ?? 1) * sat * dt * (0.4 + hunger * 0.9) * (1 - panic) * q10;
          const taken = bloom.grazeAt(layer, px, py, pz, demand);
          this.grazeTaken[this.taxon[i]] += taken;
          e += sat * forageGain * dt * (1.08 - e) * (1 - alarm * 0.6);
        }
        const hunger = 1 - e;
        const pull = cfg.forageWeight * (0.18 + hunger * 1.25);
        cruiseX += anchor.gx * pull;
        cruiseZ += anchor.gz * pull;
        if (cfg.benthosGraze > 0) {
          const ground = seafloorHeight(px, pz);
          if (py < ground + (cfg.floorClearance ?? 2.4) * 2.6 + 2) {
            const taken = bloom.grazeBenthos(px, pz, cfg.benthosGraze * dt);
            if (taken > 0) e = Math.min(1, e + taken * 18);
          }
        }
      }
      e -= metabolism * q10 * o2MetabolicFactor(py, cfg) * dt * (1 + alarm * 1.45 + (look?.storm ?? 0) * 0.3);
      if (e < 0) e = 0;
      else if (e > 1) e = 1;
      this.energy[i] = e;
      const ti = this.taxon[i];
      this._tn[ti]++;
      this._te[ti] += e;
      if (e < cfg.starveAt) {
        this._hungryN++;
        this._th[ti]++;
      }

      let fleeX = 0;
      let fleeY = 0;
      let fleeZ = 0;
      if (alarm > 0.08) {
        const d = Math.sqrt(pd2 > 1e-5 ? pd2 : 1e-5);
        const falloff = Math.max(0, 1 - d / Math.max(fearR, d));
        const ahead = (pdx * sfx + pdy * sfy + pdz * sfz) / d;
        const panic = Math.max(alarm, falloff * falloff * (0.75 + 0.5 * Math.max(0, ahead))) * (lunging ? 1.28 : 1);
        let fx = pdx / d + anchor.hx * 0.55;
        let fy = pdy / d * 0.22;
        let fz = pdz / d + anchor.hz * 0.55;
        if ((cfg.maxDepth ?? -400) > -55) fy += 0.95;
        else if ((cfg.dayDepth ?? 0) < -200) fy -= 0.7;
        else if ((cfg.floorClearance ?? 2.2) < 1.5) fy -= 0.45;
        const alongS = pdx * sfx + pdy * sfy + pdz * sfz;
        let lx = pdx - alongS * sfx;
        let ly = pdy - alongS * sfy;
        let lz = pdz - alongS * sfz;
        const lLen = Math.hypot(lx, ly, lz);
        if (lLen > 1e-4) {
          fx += (lx / lLen) * 0.7;
          fy += (ly / lLen) * 0.18;
          fz += (lz / lLen) * 0.7;
        }
        const fLen = Math.hypot(fx, fy, fz) || 1;
        fx /= fLen;
        fy /= fLen;
        fz /= fLen;
        const want = cfg.fleeSpeed * (0.5 + 0.5 * panic);
        const match = 2.5 * (0.4 + panic);
        fleeX = (fx * want - vx) * match;
        fleeY = (fy * want - vy) * match;
        fleeZ = (fz * want - vz) * match;
        maxSpd = cfg.maxSpeed + (cfg.fleeSpeed - cfg.maxSpeed) * alarm;
        maxAcc = cfg.maxAccel * (1 + alarm * 1.2);
      }

      const fleeMix = alarm * alarm * (3 - 2 * alarm);
      ax += cruiseX * (1 - fleeMix * 0.85) + fleeX * fleeMix;
      ay += cruiseY * (1 - fleeMix * 0.65) + fleeY * fleeMix;
      az += cruiseZ * (1 - fleeMix * 0.85) + fleeZ * fleeMix;

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
      const column = ceilY - (ground + cfg.floorClearance);
      const shoreU = Math.max(shore.urgency, column < cfg.beachTurnWater
        ? Math.min(1, (cfg.beachTurnWater - column) / Math.max(8, cfg.beachTurnWater - cfg.minWater))
        : 0);
      const floorKeep = Math.max(
        ground + cfg.floorClearance + (cfg.habitat === "benthic" ? 0.4 : 1.4) + shoreU * 2.6,
        oxygenLimitY(cfg)
      );
      if (py < floorKeep) ay += (floorKeep - py) * (5.5 + shoreU * 9);
      if (cfg.habitat === "benthic" && shoreU < 0.08) {
        const bed = ground + cfg.floorClearance + 1.2;
        ay += (bed - py) * 3.8;
      }
      if (shoreU > 0.02) {
        const slope = shore.urgency > 0
          ? { x: shore.gx, z: shore.gz }
          : seafloorSlope(px, pz);
        const into = Math.max(0, vx * slope.x + vz * slope.z);
        const w = 28 + shoreU * shoreU * 70 + into * 22;
        ax -= slope.x * w;
        az -= slope.z * w;
        if (hasBeach() && vz > 0) az -= vz * (2.5 + shoreU * 10);
        maxAcc = Math.max(maxAcc, cfg.maxAccel * (1.15 + shoreU * 0.9));
      }
      if (pz > waterMaxZ() - margin) az -= (pz - (waterMaxZ() - margin)) * cfg.boundsWeight;
      if (hasBeach() && pz > CONFIG.beach.shoreZ - 28) {
        az -= (pz - (CONFIG.beach.shoreZ - 28)) * cfg.boundsWeight * 3.2;
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
      const swim = cfg.swim || "tail";
      const minSpd =
        cfg.minSpeed *
        (swim === "paddle" ? 0.4 : 1) *
        (0.45 + 0.55 * (1 - mill)) *
        (alarm > 0.5 ? 1.6 : 1);
      if (spd > maxSpd) {
        const s = maxSpd / spd;
        nvx *= s;
        nvy *= s;
        nvz *= s;
        spd = maxSpd;
      } else if (spd < minSpd && !(swim === "jet" && alarm < 0.4)) {
        const s = 1 + (minSpd / spd - 1) * 0.32;
        nvx *= s;
        nvy *= s;
        nvz *= s;
        spd *= s;
      }

      const oldSpd = Math.hypot(vx, vy, vz);
      if (oldSpd > 0.4) {
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
        const maxAng = cfg.maxTurn * (1 + alarm * 1.05 + shoreU * 1.6) * dt;
        if (ang > maxAng && ang > 1e-4) {
          const t = maxAng / ang;
          let dx = ox + (nxv - ox) * t;
          let dy = oy + (nyv - oy) * t;
          let dz = oz + (nzv - oz) * t;
          const dLen = Math.hypot(dx, dy, dz) || 1;
          const blend = oldSpd + (spd - oldSpd) * (alarm > 0.4 ? 0.7 : 0.4);
          nvx = (dx / dLen) * blend;
          nvy = (dy / dLen) * blend;
          nvz = (dz / dLen) * blend;
          spd = blend;
        }
      }

      const depthErr = Math.abs((anchor.y ?? py) - py);
      if (swim === "jet" && alarm < 0.45) {
        const pulse = Math.pow(Math.max(0, Math.sin(simT * 5.4 + this.phase[i])), 2.2);
        if (pulse < 0.18) {
          const drag = Math.exp(-dt * 2.2);
          nvx *= drag;
          nvy *= drag;
          nvz *= drag;
          spd = Math.hypot(nvx, nvy, nvz);
        } else {
          const boost = 1 + pulse * 0.7;
          nvx *= boost;
          nvy *= boost;
          nvz *= boost;
          spd *= boost;
        }
      }
      const maxPitch =
        alarm > 0.45
          ? cfg.pitchLimit * 2.1
          : shoreU > 0.2
            ? cfg.pitchLimit * 1.55
            : depthErr > 16
              ? cfg.pitchLimit * 1.65
              : cfg.pitchLimit;
      const horiz = Math.hypot(nvx, nvz);
      const pitchCap = horiz * Math.tan(maxPitch) + 0.04;
      if (nvy > pitchCap) nvy = pitchCap;
      else if (nvy < -pitchCap) nvy = -pitchCap;
      if (hasBeach() && shoreU > 0.28 && nvz > 0) nvz *= 1 - Math.min(0.9, shoreU * 0.95);

      const flow = sampleFlow(px, py, pz, look?.simTime ?? 0, look?.storm ?? 0);
      const flowMul = swim === "jet" || swim === "paddle" ? 1.4 : 1;
      let nxPos = px + (nvx + flow.x * flowMul) * dt + corrX;
      let nyPos = py + (nvy + flow.y * (swim === "jet" || swim === "paddle" ? 0.85 : 1)) * dt + corrY;
      let nzPos = pz + (nvz + flow.z * flowMul) * dt + corrZ;
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
        if (hasBeach() && nvz > 0) nvz *= 0.32;
      }
      if (nzPos > waterMaxZ() - 22) {
        nzPos = waterMaxZ() - 22;
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
      if (nyPos < this.yDeep[ti]) this.yDeep[ti] = nyPos;
      if (nyPos > this.yShallow[ti]) this.yShallow[ti] = nyPos;

      sumX[sid] += nxPos;
      sumY[sid] += nyPos;
      sumZ[sid] += nzPos;
      svx[sid] += nvx;
      svz[sid] += nvz;
      this._se[sid] += this.energy[i];
      this.schoolN[sid]++;
      if (this.sex[i] === 0) this.schoolFem[sid]++;
      else this.schoolMal[sid]++;
    }

    const swap = this.alarm;
    this.alarm = this._alarm;
    this._alarm = swap;

    let bestN = 0;
    let occupied = 0;
    let energySum = 0;
    for (let s = 0; s < this.maxSchools; s++) {
      const n = this.schoolN[s];
      if (n > 0) {
        occupied++;
        this.centroids[s].x = sumX[s] / n;
        this.centroids[s].y = sumY[s] / n;
        this.centroids[s].z = sumZ[s] / n;
        this.centroids[s].vx = svx[s] / n;
        this.centroids[s].vz = svz[s] / n;
        const meanE = this._se[s] / n;
        energySum += this._se[s];
        this.schoolHunger[s] = 1 - meanE;
      } else {
        this.schoolHunger[s] = 0.5;
      }
      if (n > bestN) {
        bestN = n;
        this.centroid.x = this.centroids[s].x;
        this.centroid.y = this.centroids[s].y;
        this.centroid.z = this.centroids[s].z;
      }
    }
    this.schoolCount = occupied;
    this.meanEnergy = count > 0 ? energySum / count : 0.5;
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
    this.schoolFem.fill(0);
    this.schoolMal.fill(0);
    for (let i = 0; i < this.count; i++) {
      const sid = this.schoolId[i];
      const i3 = i * 3;
      sumX[sid] += this.pos[i3];
      sumY[sid] += this.pos[i3 + 1];
      sumZ[sid] += this.pos[i3 + 2];
      this.schoolN[sid]++;
      if (this.sex[i] === 0) this.schoolFem[sid]++;
      else this.schoolMal[sid]++;
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

  _minSchoolSize(s = 0) {
    const cfg = this.shoalCfg(s);
    const frac = cfg.minSchoolFrac ?? 0.04;
    return Math.max(cfg.minSchoolSize ?? 12, Math.min(400, (this.count * frac) | 0));
  }

  _reorganize(dt, pack, look) {
    this._orgT += dt;
    if (this._orgT < 0.45) return;
    this._orgT = 0;
    this._trySplits(pack, look);
    this._tryJoins(pack, look);
    this._tryMerges(pack, look);
    this._refreshCentroids();
  }

  _trySplits(pack, look) {
    const { pos, schoolId, count } = this;
    for (let s = 0; s < this.maxSchools; s++) {
      const n = this.schoolN[s];
      const minS = this._minSchoolSize(s);
      const cfg = this.shoalCfg(s);
      const splitR = cfg.splitDistance * (look?.schoolRadiusScale ?? 1);
      const splitR2 = splitR * splitR;
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

      let avx = 0;
      let avz = 0;
      let bvx0 = 0;
      let bvz0 = 0;
      for (let i = 0; i < count; i++) {
        if (schoolId[i] !== s) continue;
        const i3 = i * 3;
        if (this._mark[i]) {
          bvx0 += this.vel[i3];
          bvz0 += this.vel[i3 + 2];
        } else {
          avx += this.vel[i3];
          avz += this.vel[i3 + 2];
        }
      }
      const ah = Math.hypot(avx, avz) || 1;
      const bh = Math.hypot(bvx0, bvz0) || 1;
      const headingDot = (avx * bvx0 + avz * bvz0) / (ah * bh);
      let sharkNear = false;
      for (let p = 0; p < pack.length; p++) {
        const shark = pack[p];
        const sdx = c.x - shark.x;
        const sdy = c.y - shark.y;
        const sdz = c.z - shark.z;
        if (sdx * sdx + sdy * sdy + sdz * sdz < (shark.fearRadius + 55) ** 2) {
          sharkNear = true;
          break;
        }
      }
      if (headingDot > 0.6 && !sharkNear) continue;

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
      a.baseCruise = this.anchors[s].baseCruise || a.cruise;
      a.taxon = this.anchors[s].taxon;
      a.mill = 0;
      a.wantMill = 0;
      a.modeT = 10;
      a.t = this.anchors[s].t + 0.7;
      this._splitLock[s] = 8;
      this._splitLock[nid] = 8;
    }
  }

  _tryJoins(pack, look) {
    const { pos, vel, schoolId, count } = this;
    let switched = 0;
    const cap = 70;
    for (let i = 0; i < count; i++) {
      if (switched >= cap) break;
      const sid = schoolId[i];
      const jcfg = this.shoalCfg(sid);
      if ((jcfg.social || "polarized") !== "polarized") continue;
      const minS = this._minSchoolSize(sid);
      const holdR = jcfg.schoolRadius * (look?.schoolRadiusScale ?? 1);
      const slack = jcfg.joinSlack;
      if (this.schoolN[sid] <= minS) continue;
      if (this._splitLock[sid] > 0.5) continue;
      const i3 = i * 3;
      let scared = false;
      for (let p = 0; p < pack.length; p++) {
        const shark = pack[p];
        const dxs = pos[i3] - shark.x;
        const dys = pos[i3 + 1] - shark.y;
        const dzs = pos[i3 + 2] - shark.z;
        if (dxs * dxs + dys * dys + dzs * dzs < shark.fearRadius * shark.fearRadius) {
          scared = true;
          break;
        }
      }
      if (scared) continue;
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
        if ((this.anchors[s]?.taxon ?? 0) !== (this.taxon[i] ?? 0)) continue;
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

  _tryMerges(pack, look) {
    const { schoolId, count } = this;
    for (let a = 0; a < this.maxSchools; a++) {
      const acfg = this.shoalCfg(a);
      if ((acfg.social || "polarized") !== "polarized") continue;
      const minS = this._minSchoolSize(a);
      if (this.schoolN[a] < minS) continue;
      if (this._splitLock[a] > 0) continue;
      const mergeR = acfg.mergeDistance * (0.85 + (look?.tight ?? 0) * 0.4);
      const mergeR2 = mergeR * mergeR;
      const ca = this.centroids[a];
      let scared = false;
      for (let p = 0; p < pack.length; p++) {
        const shark = pack[p];
        const adx = ca.x - shark.x;
        const ady = ca.y - shark.y;
        const adz = ca.z - shark.z;
        if (adx * adx + ady * ady + adz * adz < (shark.fearRadius + 12) ** 2) {
          scared = true;
          break;
        }
      }
      if (scared) continue;
      for (let b = a + 1; b < this.maxSchools; b++) {
        if (this.schoolN[b] < this._minSchoolSize(b)) continue;
        if (this._splitLock[b] > 0) continue;
        if ((this.anchors[a]?.taxon ?? 0) !== (this.anchors[b]?.taxon ?? 0)) continue;
        if ((this.shoalCfg(b).social || "polarized") !== "polarized") continue;
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

  _resolveBites(plankton) {
    const carcass = CONFIG.plankton.carcass;
    for (let i = this.count - 1; i >= 0; i--) {
      if (!this._eaten[i]) continue;
      const i3 = i * 3;
      if (plankton) plankton.recycle(this.pos[i3], this.pos[i3 + 2], carcass, this.pos[i3 + 1]);
      this.remove(i, true);
    }
  }

  _eat(pack, plankton) {
    const { pos, count } = this;
    const carcass = CONFIG.plankton.carcass;
    const nT = this.taxa.length;
    const glowTaxon = new Uint8Array(nT);
    for (let t = 0; t < nT; t++) glowTaxon[t] = this.taxa[t]?.look?.photophores ? 1 : 0;
    for (let i = count - 1; i >= 0; i--) {
      const i3 = i * 3;
      const x = pos[i3];
      const y = pos[i3 + 1];
      const z = pos[i3 + 2];
      const taxon = this.taxon[i];
      const id = this.taxa[taxon]?.id;
      const glow = glowTaxon[taxon];
      for (let p = 0; p < pack.length; p++) {
        const shark = pack[p];
        if ((shark.biteT ?? 0) > 0) continue;
        if ((shark.cfg?.diet || "bite") === "filter") continue;
        if (shark.cfg?.huntTaxa?.length && !shark.cfg.huntTaxa.includes(id)) continue;
        const scale = glow ? shark.biteGlowScale ?? 1 : shark.biteScale ?? 1;
        const r = shark.biteRadius * scale;
        const dx = x - shark.mouthX;
        const dy = y - shark.mouthY;
        const dz = z - shark.mouthZ;
        if (dx * dx + dy * dy + dz * dz < r * r) {
          if (plankton) plankton.recycle(x, z, carcass, y);
          this.remove(i, true);
          if (shark.feed) shark.feed();
          shark.biteT =
            shark.lunging || shark.aiMode === "strike"
              ? shark.cfg?.lungeBiteCooldown ?? CONFIG.shark.lungeBiteCooldown
              : shark.cfg?.biteCooldown ?? CONFIG.shark.biteCooldown;
          shark.onEat(x, y, z);
          break;
        }
      }
    }
  }

  _recruit(dt, plankton) {
    if (!this.taxa.length || this.cap <= 0) return;
    const foodCap = plankton.carryingCapacity(this.cap);
    const alloc = allocateMixedSchoolCounts(
      this.cap,
      this.taxa,
      foodCap,
      0,
      CONFIG.piscivorePreyRatio
    );
    const have = new Array(this.taxa.length).fill(0);
    for (let i = 0; i < this.count; i++) have[this.taxon[i]]++;
    let need = 0;
    let spawnT = -1;
    for (let t = 0; t < alloc.length; t++) {
      const deficit = (alloc[t].n || 0) - (have[t] || 0);
      if (deficit > need) {
        need = deficit;
        spawnT = t;
      }
    }
    if (need <= 0 || this.count >= this.max) return;
    const cfg = this._tcfg[spawnT] || CONFIG.fish;
    const grazer = isSchoolGrazer(cfg);
    if (grazer && (Math.max(plankton.meanZ, plankton.meanP) < 0.045 || this.meanEnergy < CONFIG.fish.recruitEnergy * 0.55)) {
      return;
    }
    if (!grazer && this.meanEnergy < CONFIG.fish.recruitEnergy * 0.4) return;
    let breeders = 0;
    for (let s = 0; s < this.maxSchools; s++) {
      if ((this.anchors[s]?.taxon ?? 0) !== spawnT) continue;
      if (this.schoolFem[s] < 2 || this.schoolMal[s] < 2) continue;
      if (this.schoolHunger[s] > 0.62) continue;
      breeders += Math.min(this.schoolFem[s], this.schoolMal[s]);
    }
    if (breeders < 4) return;
    const fed = grazer
      ? 0.28 + plankton.meanZ * 0.5 + this.meanEnergy * 0.45
      : 0.22 + this.meanEnergy * 0.55;
    this._recruitAcc += Math.min(28, 8 + need * 0.04) * fed * dt;
    while (this._recruitAcc >= 1 && this.count < this.max && have[spawnT] < alloc[spawnT].n) {
      this._recruitAcc -= 1;
      const before = this.count;
      this._spawnOne(plankton, spawnT);
      if (this.count > before) {
        have[spawnT]++;
        this._harvestDebt = Math.max(0, this._harvestDebt - 1);
      } else break;
    }
  }

  _spawnOne(plankton, taxonIndex) {
    let sid = -1;
    let best = -1;
    for (let s = 0; s < this.maxSchools; s++) {
      if ((this.anchors[s]?.taxon ?? 0) !== taxonIndex) continue;
      if (this.schoolN[s] <= 0) continue;
      const cfg = this.shoalCfg(s);
      const c = this.centroids[s];
      let food = 1.15 - this.schoolHunger[s];
      if (isSchoolGrazer(cfg)) {
        const grazeP = cfg.grazeOn === "p";
        food *= plankton.sampleAt(grazeP ? TROPHIC.P : TROPHIC.Z, c.x, c.y, c.z);
      }
      const score = food * Math.max(1, this.schoolFem[s]);
      if (score > best) {
        best = score;
        sid = s;
      }
    }
    if (sid < 0) {
      for (let s = 0; s < this.maxSchools; s++) {
        if ((this.anchors[s]?.taxon ?? 0) === taxonIndex && this.schoolN[s] > 0) {
          sid = s;
          break;
        }
      }
    }
    if (sid < 0) return;
    const i = this.count;
    const i3 = i * 3;
    const c = this.centroids[sid];
    const a = this.anchors[sid];
    const rest = CONFIG.fish.restSpacing;
    const female = Math.random() < 0.5;
    this.schoolId[i] = sid;
    this.taxon[i] = taxonIndex;
    const tcfg = this.taxonCfg(i);
    const x = c.x + (Math.random() - 0.5) * rest * 3;
    const z = c.z + (Math.random() - 0.5) * rest * 3;
    this.pos[i3] = x;
    this.pos[i3 + 1] = clampLocalY(
      c.y + (Math.random() - 0.5) * rest * 1.4,
      x,
      z,
      oxygenLimitY(tcfg),
      tcfg.floorClearance
    );
    this.pos[i3 + 2] = z;
    this.vel[i3] = a.hx * a.cruise;
    this.vel[i3 + 1] = 0;
    this.vel[i3 + 2] = a.hz * a.cruise;
    this.phase[i] = Math.random() * Math.PI * 2;
    this.sex[i] = female ? 0 : 1;
    this.scale[i] = (0.84 + Math.random() * 0.32) * (female ? 1.05 : 0.96);
    this.pref[i] = 0.86 + Math.random() * 0.28;
    this.alarm[i] = 0;
    this.biteT[i] = 0;
    this.energy[i] = CONFIG.fish.spawnEnergy * (0.85 + Math.random() * 0.3);
    this.count = i + 1;
    this.totalBorn++;
    this.bornOf[this.taxon[i]]++;
    if (female) this.schoolFem[sid]++;
    else this.schoolMal[sid]++;
    this.schoolN[sid]++;
    if (isSchoolGrazer(tcfg)) {
      const grazeP = tcfg.grazeOn === "p";
      plankton.grazeAt(
        grazeP ? TROPHIC.P : TROPHIC.Z,
        c.x,
        c.y,
        c.z,
        CONFIG.plankton.spawnCost
      );
    }
  }

  _starve(dt, plankton) {
    const foodCap = plankton.carryingCapacity(this.cap);
    const alloc = allocateMixedSchoolCounts(
      this.cap,
      this.taxa,
      foodCap,
      0,
      CONFIG.piscivorePreyRatio
    );
    const have = new Array(this.taxa.length).fill(0);
    for (let i = 0; i < this.count; i++) have[this.taxon[i]]++;
    let over = 0;
    for (let t = 0; t < alloc.length; t++) over += Math.max(0, (have[t] || 0) - (alloc[t].n || 0));
    const hungry = this._hungryN;
    this._starveAcc += Math.min(5, over * 0.002 + hungry * 0.00085) * dt;
    let guard = 28;
    while (this._starveAcc >= 1 && this.count > 48 && guard-- > 0) {
      this._starveAcc -= 1;
      const i = this._pickWeak(alloc, have);
      if (i < 0) break;
      const t = this.taxon[i];
      const i3 = i * 3;
      plankton.recycle(this.pos[i3], this.pos[i3 + 2], CONFIG.plankton.carcass * 0.7, this.pos[i3 + 1]);
      this.remove(i, false);
      have[t]--;
    }
  }

  _pickWeak(alloc, have) {
    const { count, energy } = this;
    if (count <= 0) return -1;
    let best = -1;
    let bestE = 2;
    const samples = Math.min(32, count);
    for (let n = 0; n < samples; n++) {
      const i = (Math.random() * count) | 0;
      const t = this.taxon[i];
      const extra = alloc && have && have[t] > (alloc[t]?.n ?? 0) ? 0.35 : 0;
      const e = energy[i] - extra;
      if (e < bestE) {
        bestE = e;
        best = i;
      }
    }
    return best;
  }
}
