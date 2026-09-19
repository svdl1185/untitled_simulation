import { CONFIG, breathTargetY, clampHabitatY, dvmY, faunaPresent, hasBeach, waterMaxZ, yearSeconds } from "../config.js";
import {
  SPECIES,
  VEHICLE_IDS,
  vehicleCfg,
  vehicleCountFor,
  vehicleIsPod,
  vehiclePodsFor,
  vehiclePodId,
  vehiclePodSlot,
  tickBreathHold,
  airY,
  ascentReserve,
} from "../world/fauna.js";
import { steerFromColliders, resolveColliders, seafloorHeight, seafloorSlope, placeInColumn, steerOffBounds, clampToCell } from "./obstacles.js";
import { sampleFlow } from "./flow.js";
import { columnQ10 } from "./temperature.js";
import { o2MetabolicFactor, oxygenLimitY } from "./oxygen.js";
import { TROPHIC } from "./plankton.js";
import { visualHunter, visualScales } from "./light.js";

const KINDS = [
  { scale: 1.02, aggression: 1.06, tint: { r: 1, g: 1, b: 1 } },
  { scale: 1.24, aggression: 1.2, tint: { r: 0.72, g: 0.7, b: 0.64 } },
  { scale: 0.78, aggression: 0.9, tint: { r: 1.12, g: 1.08, b: 1.18 } },
];

/**
 * Reynolds-style vehicle: steer velocity toward a desired velocity,
 * then hang the body off that path. Same model OpenSteer uses, and
 * the same seek / pursuit / arrive / wander set as most decent fish
 * and predator sims.
 *
 * Locomotion follows `cfg.gait` and `cfg.swim`: burst-and-glide or ram
 * for most fishes and sharks, pulse–coast jet for squid, vertical fluke
 * for cetaceans. Podded taxa (orca, dolphin, hammerhead, bluefin, sperm
 * whale) follow a leader; others keep a body-length of water between
 * each other.
 */
export class Shark {
  constructor(opts = {}) {
    this.id = opts.id ?? 0;
    this.kind = opts.kind || "shark";
    this.cfg = opts.cfg || vehicleCfg(this.kind);
    this.scale = opts.scale ?? 1;
    this.aggression = opts.aggression ?? 1;
    this.tint = opts.tint ?? null;
    this.sex = opts.sex ?? (Math.random() < 0.5 ? 0 : 1);
    this.cruiseMul = 0.78 + this.scale * 0.22;
    this.turnMul = 1.55 - this.scale * 0.48;
    this.x = 8;
    this.y = clampHabitatY(CONFIG.fish.preferredDepth, this.cfg.maxDepth);
    this.z = 28;
    this.vx = 0;
    this.vy = 0;
    this.vz = -6;
    this.yaw = Math.PI;
    this.pitch = 0.12;
    this.roll = 0;
    this.fwdX = -1;
    this.fwdY = 0;
    this.fwdZ = 0;
    this.mouthX = this.x;
    this.mouthY = this.y;
    this.mouthZ = this.z;
    this.controlled = false;
    this.lunging = false;
    this.lungeT = 0;
    this.aiMode = "patrol";
    this.aiT = 4 + Math.random() * 5;
    this.circleA = Math.random() * Math.PI * 2;
    this.huntIndex = 0;
    this.huntTarget = null;
    this.flankSign = Math.random() < 0.5 ? 1 : -1;
    this.thrust = 0.45;
    this.swimT = Math.random() * Math.PI * 2;
    this.lookX = 0;
    this.lookY = 0;
    this.yawLook = this.yaw;
    this.pitchLook = this.pitch;
    this.yawRate = 0;
    this.seekX = this.x;
    this.seekY = this.y;
    this.seekZ = this.z;
    this.wanderTheta = Math.random() * Math.PI * 2;
    this.speedCap = this.cfg.cruiseSpeed;
    this.eatEvents = [];
    this.eaten = 0;
    this.pups = 0;
    this.filterTaken = 0;
    this.filterMeals = 0;
    this.energyIn = 0;
    this.cause = null;
    this.biteT = 0;
    this.starveT = 0;
    this.dead = false;
    this.mateT = opts.mateT ?? (0.4 + Math.random() * 0.6) * yearSeconds();
    this.energy = 0.55 + Math.random() * 0.28;
    this.yDeep = this.y;
    this.yShallow = this.y;
    this.fearRadius = this.cfg.fearRadius;
    this.fearStrength = CONFIG.fish.fearWeight;
    this.biteRadius = this.cfg.biteRadius;
    this.biteScale = 1;
    this.biteGlowScale = 1;
    this.bursting = true;
    this.burstT =
      this.cfg.gait === "jet" || this.cfg.swim === "jet"
        ? 0.12 + Math.random() * 0.12
        : 1.2 + Math.random() * 1.8;
    this.glideT = 0;
    this.surfacing = !!this.cfg.breathes && Math.random() < 0.28;
    this.breathT = this.surfacing
      ? Math.random() * (this.cfg.surfaceTime ?? 6)
      : Math.random() * (this.cfg.diveTime ?? 20);
    this.blew = false;
    this.blowWait = 0;
    this.blowX = this.x;
    this.blowY = this.y;
    this.blowZ = this.z;
    this.roamX = 0;
    this.roamY = CONFIG.fish.preferredDepth;
    this.roamZ = 0;
    this.podId = opts.podId ?? 0;
    this.podSlot = opts.podSlot ?? 0;
    this._awaitFlip = 0;
    this._podFollow = false;
    this._pickRoam();
    this.onEat = (x, y, z) => {
      this.eaten++;
      this.eatEvents.push({ x, y, z, t: 0 });
    };
    this.onBlow = null;
  }

  get camRadius() {
    const len = (this.cfg?.length ?? CONFIG.shark.length) * (this.scale || 1);
    return Math.max(5, Math.min(64, len * 2.6 + 4));
  }

  setControlled(on) {
    this.controlled = on;
    this.lookX = 0;
    this.lookY = 0;
    this.yawLook = this.yaw;
    this.pitchLook = this.pitch;
    if (on) {
      this.lunging = false;
      this.bursting = true;
    }
  }

  feed() {
    const add = this.cfg.eatEnergy ?? CONFIG.shark.eatEnergy;
    this.energy = Math.min(1, this.energy + add);
    this.energyIn = (this.energyIn || 0) + add;
  }

  startLunge() {
    if (this.lunging && this.lungeT > 0.35) return;
    const lungeT = this.cfg.lungeTime;
    this.lunging = true;
    this.lungeT = lungeT;
    this.bursting = true;
    this.burstT = lungeT;
    const boost = 10 * this.cruiseMul;
    this.vx += this.fwdX * boost;
    this.vy += this.fwdY * boost * 0.28;
    this.vz += this.fwdZ * boost;
  }

  update(dt, input, school, look, pack = null) {
    if (this.dead) return;
    const cfg = this.cfg || CONFIG.shark;
    if (this.controlled) this._player(dt, input, cfg);
    else this._ai(dt, school, cfg, pack, look);

    if (cfg.gait === "jet" || cfg.swim === "jet") this._tickJet(dt);

    if (pack) this._fleeHunted(pack, dt);

    this.lungeT -= dt;
    if (this.lungeT <= 0) this.lunging = false;
    this.biteT = Math.max(0, (this.biteT ?? 0) - dt);

    const fearMul = look?.fearScale ?? 1;
    const striking = this.lunging || this.aiMode === "strike";
    let fear = (striking ? cfg.lungeFearRadius : cfg.fearRadius) * fearMul * this.scale;
    if (visualHunter(cfg)) {
      const vis = visualScales(this.y, look);
      fear *= 0.1 + 0.9 * vis.clear;
      this.biteScale = vis.bite;
      this.biteGlowScale = vis.biteGlow;
    } else {
      this.biteScale = 1;
      this.biteGlowScale = 1;
    }
    this.fearRadius = fear;
    this.fearStrength = striking ? CONFIG.fish.fearWeight * 1.55 : CONFIG.fish.fearWeight;
    this.biteRadius = (striking ? cfg.lungeBiteRadius : cfg.biteRadius) * this.scale;

    const colliders = school.colliders;
    const nCol = school.colliderCount;
    const rockR = 4.6 * this.scale;
    const rock = steerFromColliders(this.x, this.y, this.z, colliders, nCol, rockR + 1, 18);
    this.vx += rock.ax * dt;
    this.vy += rock.ay * dt;
    this.vz += rock.az * dt;

    if (pack) {
      this._avoidPack(pack, dt);
      this._coherePod(pack, dt);
    }

    const swim = cfg.swim || "tail";
    const gliding = !this.bursting && !this.lunging;
    const coastKick =
      swim === "fluke" || swim === "thunniform" || cfg.gait === "ram"
        ? 1
        : gliding
          ? cfg.gait === "benthic"
            ? 0.06
            : 0.14
          : 1;
    let kickForce;
    if (cfg.gait === "jet" || swim === "jet") {
      const pulse = this.bursting ? 0.85 + Math.max(0, Math.sin(this.swimT)) * 0.4 : 0.04;
      kickForce = pulse * (this.lunging ? 16 : 6.4) * this.thrust * this.cruiseMul;
    } else if (swim === "fluke" || swim === "thunniform") {
      const kick = Math.sin(this.swimT);
      kickForce = kick * kick * (this.lunging ? 10 : 3.4) * this.thrust * this.cruiseMul;
    } else {
      const kick = Math.max(0, Math.sin(this.swimT));
      kickForce = kick * kick * (this.lunging ? 9 : 3.1) * this.thrust * this.cruiseMul * coastKick;
    }
    this.vx += this.fwdX * kickForce * dt;
    const commuting = cfg.breathes && this.surfacing && this.y <= airY(cfg);
    const kickY = swim === "jet" || commuting ? 1 : swim === "fluke" ? 0.55 : 0.25;
    this.vy += this.fwdY * kickForce * dt * kickY;
    this.vz += this.fwdZ * kickForce * dt;
    if (gliding && (cfg.gait === "jet" || swim === "jet" || cfg.gait === "benthic")) {
      const drag = Math.exp(-dt * (cfg.gait === "benthic" ? 1.6 : 2.4));
      this.vx *= drag;
      this.vy *= drag;
      this.vz *= drag;
    }

    this._limitSpeed(this.speedCap);
    if (cfg.breathes && this.surfacing && this.y > airY(cfg)) {
      const hang = Math.hypot(this.vx, this.vy, this.vz);
      const cap = (cfg.cruiseSpeed ?? 6) * 0.4 * this.cruiseMul;
      if (hang > cap) {
        const s = cap / hang;
        this.vx *= s;
        this.vy *= s;
        this.vz *= s;
      }
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;

    const flow = sampleFlow(this.x, this.y, this.z, look?.simTime ?? 0, look?.storm ?? 0);
    const coasting = (cfg.gait === "jet" || swim === "jet") && !this.bursting && !this.lunging;
    const flowMul = coasting ? 1.45 : 1;
    this.x += flow.x * dt * flowMul;
    this.y += flow.y * dt * (coasting ? 0.85 : 0.45);
    this.z += flow.z * dt * flowMul;

    const drain = cfg.energyDrain * (this.lunging ? 2.4 : this.aiMode === "strike" ? 1.6 : 1) * columnQ10() * o2MetabolicFactor(this.y, cfg);
    this.energy = Math.max(0, this.energy - drain * dt);
    this._filterFeed(dt, school, look, cfg);
    this._benthosFeed(dt, school, cfg);
    this.mateT = Math.max(0, this.mateT - dt);
    this._tickBreath(dt, cfg, pack);
    if (this.energy < cfg.starveAt) this.starveT += dt;
    else this.starveT = Math.max(0, this.starveT - dt * 1.8);
    if (this.starveT >= cfg.starveDays * CONFIG.time.dayLength) {
      this.cause = this.cause || "starve";
      this.dead = true;
    }

    this._keepInWater(cfg, dt, true);

    const pushed = resolveColliders(this.x, this.y, this.z, colliders, nCol, rockR);
    this.x = pushed.x;
    this.y = pushed.y;
    this.z = pushed.z;
    if (this.y < this.yDeep) this.yDeep = this.y;
    if (this.y > this.yShallow) this.yShallow = this.y;

    const ground = this._keepInWater(cfg, dt, false);

    this._orientFromVelocity(dt, cfg);

    if (cfg.breathes && this.surfacing && this.y > airY(cfg) - 3.5) {
      this.pitch += (0 - this.pitch) * Math.min(1, dt * 2.8);
      this.roll += (0 - this.roll) * Math.min(1, dt * 2.4);
    } else if (cfg.breathes && this.surfacing && this.y < airY(cfg) - 10) {
      this.pitch += (-0.72 - this.pitch) * Math.min(1, dt * 2.2);
      this.roll += (0 - this.roll) * Math.min(1, dt * 2.2);
    } else if (cfg.breathes && !this.surfacing && this.y > (cfg.minDepth ?? -2) - 28) {
      this.pitch += (0.58 - this.pitch) * Math.min(1, dt * 1.7);
      this.roll += (0 - this.roll) * Math.min(1, dt * 2.2);
    } else if (this.y > cfg.minDepth - 2.2 && this.pitch < 0.05) {
      this.pitch += (0.08 - this.pitch) * Math.min(1, dt * 2.2);
    }
    if (this.y < ground + cfg.floorClearance * this.scale + 4 && this.pitch > 0) {
      this.pitch += (-0.12 - this.pitch) * Math.min(1, dt * 2.4);
    }

    const cp = Math.cos(this.pitch);
    this.fwdX = Math.sin(this.yaw) * cp;
    this.fwdY = -Math.sin(this.pitch);
    this.fwdZ = Math.cos(this.yaw) * cp;
    const mouth = cfg.mouthOffset * this.scale;
    this.mouthX = this.x + this.fwdX * mouth;
    this.mouthY = this.y + this.fwdY * mouth;
    this.mouthZ = this.z + this.fwdZ * mouth;
    this._tickBlow(dt, cfg);

    const spd = Math.hypot(this.vx, this.vy, this.vz);
    const len = cfg.length ?? 11;
    let freq;
    if (swim === "jet") freq = (0.42 + spd * 0.028) / Math.sqrt(this.scale);
    else if (swim === "fluke") freq = ((0.16 + spd * 0.016) / Math.sqrt(this.scale)) * (len > 8 ? 0.68 : 1);
    else if (swim === "thunniform") freq = (0.55 + spd * 0.05) / Math.sqrt(this.scale);
    else if (swim === "body") freq = (0.28 + spd * 0.03) / Math.sqrt(this.scale);
    else freq = (0.32 + spd * 0.042) / Math.sqrt(this.scale);
    this.swimT += dt * Math.PI * 2 * freq * Math.sqrt(columnQ10());

    for (let i = this.eatEvents.length - 1; i >= 0; i--) {
      this.eatEvents[i].t += dt;
      if (this.eatEvents[i].t > 0.7) this.eatEvents.splice(i, 1);
    }
  }

  _eatVehicles(pack, plankton) {
    const kinds = this.cfg?.huntKinds;
    if (!kinds?.length || this.dead) return;
    if ((this.biteT ?? 0) > 0) return;
    if ((this.cfg.diet || "bite") === "filter") return;
    const r = this.biteRadius;
    for (let i = 0; i < pack.length; i++) {
      const o = pack[i];
      if (o === this || o.dead) continue;
      if (!kinds.includes(o.kind)) continue;
      const hit = r + (o.cfg?.length ?? 1) * (o.scale || 1) * 0.4;
      const dx = o.x - this.mouthX;
      const dy = o.y - this.mouthY;
      const dz = o.z - this.mouthZ;
      if (dx * dx + dy * dy + dz * dz >= hit * hit) continue;
      o.cause = "eaten";
      o.dead = true;
      const meal = this.cfg.eatVehicleEnergy ?? (this.cfg.eatEnergy ?? 0.08) * 2.2;
      this.energy = Math.min(1, this.energy + meal);
      this.energyIn = (this.energyIn || 0) + meal;
      this.biteT =
        this.lunging || this.aiMode === "strike"
          ? this.cfg?.lungeBiteCooldown ?? CONFIG.shark.lungeBiteCooldown
          : this.cfg?.biteCooldown ?? CONFIG.shark.biteCooldown;
      this.onEat(o.x, o.y, o.z);
      return;
    }
  }

  _fleeHunted(pack, dt) {
    for (let i = 0; i < pack.length; i++) {
      const o = pack[i];
      if (o === this || o.dead) continue;
      if (!o.cfg?.huntKinds?.includes(this.kind)) continue;
      const dx = this.x - o.x;
      const dy = this.y - o.y;
      const dz = this.z - o.z;
      const d = Math.hypot(dx, dy, dz);
      if (d < 0.4 || d > 85) continue;
      const w = ((1 - d / 85) ** 2) * 26;
      const vert = this.cfg.gait === "jet" || this.cfg.swim === "jet" ? 1.15 : 0.4;
      this.vx += (dx / d) * w * dt;
      this.vy += (dy / d) * w * dt * vert;
      this.vz += (dz / d) * w * dt;
      if ((this.cfg.gait === "jet" || this.cfg.swim === "jet") && o.y > this.y - 6) {
        this.vy -= w * dt * 0.9;
      }
    }
  }

  _filterFeed(dt, school, look, cfg) {
    const diet = cfg.diet || "bite";
    if (diet !== "filter" && diet !== "both") return;
    const bloom = school?._plankton;
    if (!bloom || !(cfg.filterGraze > 0)) return;
    const ov = bloom.overlap(look, this.y);
    const taken = bloom.grazeAt(TROPHIC.Z, this.x, this.y, this.z, cfg.filterGraze * dt * ov);
    if (taken > 0) {
      const gain = taken * (cfg.filterGain ?? 0.4);
      this.energy = Math.min(1, this.energy + gain);
      this.filterTaken = (this.filterTaken || 0) + taken;
      this.filterMeals = (this.filterMeals || 0) + 1;
      this.energyIn = (this.energyIn || 0) + gain;
    }
  }

  _benthosFeed(dt, school, cfg) {
    if (!(cfg.benthosGraze > 0)) return;
    const bloom = school?._plankton;
    if (!bloom) return;
    const ground = seafloorHeight(this.x, this.z);
    if (this.y > ground + (cfg.floorClearance ?? 4) * 2.4 + 6) return;
    const taken = bloom.grazeBenthos(this.x, this.z, cfg.benthosGraze * dt);
    if (taken > 0) {
      const gain = taken * 0.55;
      this.energy = Math.min(1, this.energy + gain);
      this.energyIn = (this.energyIn || 0) + gain;
      this.filterMeals = (this.filterMeals || 0) + 1;
    }
  }

  _tickBreath(dt, cfg, pack) {
    if (!cfg.breathes) return;
    const lead = podLeader(this, pack);
    if (lead && lead !== this) {
      const lag = 0.22 + (this.podSlot || 0) * 0.18;
      if (lead.surfacing !== this.surfacing) {
        this._awaitFlip = (this._awaitFlip || 0) + dt;
        if (this._awaitFlip >= lag) {
          this.surfacing = lead.surfacing;
          this.breathT = lead.breathT;
          this._awaitFlip = 0;
        }
      } else {
        this._awaitFlip = 0;
        this.breathT = lead.breathT;
      }
      return;
    }
    const atAir = this.y > airY(cfg);
    const justArrived = atAir && this._submerged;
    this._submerged = !atAir;
    const next = tickBreathHold(this.surfacing, this.breathT, dt, cfg, atAir, {
      y: this.y,
      justArrived: justArrived && this.surfacing,
    });
    this.surfacing = next.surfacing;
    this.breathT = next.breathT;
    if (next.drowned) {
      this.cause = this.cause || "drown";
      this.dead = true;
    }
  }

  _tickBlow(dt, cfg) {
    if (!cfg.breathes) return;
    const sperm = this.kind === "spermwhale";
    const along = (cfg.mouthOffset ?? 2.2) * (sperm ? 0.98 : 0.62) * this.scale;
    const leftAmt = sperm ? 0.52 * this.scale : 0;
    const lx = -this.fwdZ;
    const lz = this.fwdX;
    const up = Math.max(0.45, (sperm ? 0.085 : 0.05) * (cfg.length ?? 11) * this.scale);
    const atAir = this.y > (cfg.minDepth ?? -2) - 0.55;
    this.blowX = this.x + this.fwdX * along + lx * leftAmt;
    this.blowY = atAir ? Math.max(this.y + up, 0.25) : this.y + up;
    this.blowZ = this.z + this.fwdZ * along + lz * leftAmt;
    if (this.surfacing && atAir) {
      if (!this.blew) {
        this.blew = true;
        this.blowWait = 0;
        this._emitBlow(1, lx, lz);
      } else {
        this.blowWait += dt;
        const gap = sperm ? 2.8 : 2.15;
        if (this.blowWait >= gap) {
          this.blowWait = 0;
          this._emitBlow(0.62, lx, lz);
        }
      }
    } else if (!this.surfacing) {
      this.blew = false;
      this.blowWait = 0;
    }
  }

  _emitBlow(strength, lx, lz) {
    this.onBlow?.(this.blowX, this.blowY, this.blowZ, this.kind, this.scale * strength, {
      fx: this.fwdX,
      fz: this.fwdZ,
      lx,
      lz,
    });
  }

  _columnFloor(x, z, cfg) {
    const ground = seafloorHeight(x, z) + (cfg.floorClearance ?? 6) * (this.scale || 1) + 1.2;
    return Math.max(ground, oxygenLimitY(cfg));
  }

  _breathTargetY(tx, tz, huntY, cfg) {
    return breathTargetY({
      surfacing: this.surfacing,
      huntY,
      forageDepth: cfg.forageDepth,
      minDepth: cfg.minDepth,
      floor: this._columnFloor(tx, tz, cfg),
    });
  }

  _avoidPack(pack, dt) {
    const podded = vehicleIsPod(this.cfg);
    for (let i = 0; i < pack.length; i++) {
      const o = pack[i];
      if (o === this || o.dead) continue;
      const dx = this.x - o.x;
      const dy = this.y - o.y;
      const dz = this.z - o.z;
      const d = Math.hypot(dx, dy, dz);
      let gap = this.cfg.spacing ?? CONFIG.shark.spacing;
      if (podded && o.kind === this.kind && o.podId !== this.podId) gap *= 3.2;
      const minD = gap * (0.55 + 0.28 * (this.scale + o.scale));
      if (d < 0.4 || d > minD) continue;
      const w = ((minD - d) / minD) ** 2;
      const push = (18 + (this.huntIndex === o.huntIndex ? 10 : 0)) * w;
      this.vx += (dx / d) * push * dt;
      this.vy += (dy / d) * push * dt * 0.45;
      this.vz += (dz / d) * push * dt;
      if (this.huntIndex === o.huntIndex && o.id < this.id) {
        this.flankSign = -o.flankSign;
      }
    }
  }

  _coherePod(pack, dt) {
    if (!vehicleIsPod(this.cfg) || this.controlled) return;
    let n = 0;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    let cvx = 0;
    let cvy = 0;
    let cvz = 0;
    for (let i = 0; i < pack.length; i++) {
      const o = pack[i];
      if (o.dead || o.kind !== this.kind || o.podId !== this.podId) continue;
      n++;
      cx += o.x;
      cy += o.y;
      cz += o.z;
      cvx += o.vx;
      cvy += o.vy;
      cvz += o.vz;
    }
    if (n < 2) return;
    const inv = 1 / n;
    cx *= inv;
    cy *= inv;
    cz *= inv;
    cvx *= inv;
    cvy *= inv;
    cvz *= inv;
    const dx = cx - this.x;
    const dy = cy - this.y;
    const dz = cz - this.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    const spacing = this.cfg.spacing ?? 16;
    const striking = this.aiMode === "strike" || this.lunging;
    if (d > spacing * 0.7) {
      const w = Math.min(1, (d - spacing * 0.7) / (spacing * 5));
      const k = striking ? 7 : 16;
      this.vx += (dx / d) * k * w * dt;
      this.vy += (dy / d) * k * w * dt * 0.55;
      this.vz += (dz / d) * k * w * dt;
    }
    const ali = striking ? 2.2 : 7.5;
    const blend = Math.min(1, ali * dt);
    this.vx += (cvx - this.vx) * blend;
    this.vy += (cvy - this.vy) * blend * 0.7;
    this.vz += (cvz - this.vz) * blend;
  }

  _keepInWater(cfg, dt, steer = true) {
    if (steer) {
      const bound = steerOffBounds(this.x, this.z, this.vx, this.vz, { weight: 36 });
      this.vx = bound.vx + bound.ax * dt;
      this.vz = bound.vz + bound.az * dt;
    }
    const boxed = clampToCell(this.x, this.z, this.vx, this.vz);
    this.x = boxed.x;
    this.z = boxed.z;
    this.vx = boxed.vx;
    this.vz = boxed.vz;

    const ground = seafloorHeight(this.x, this.z);
    const ceil = cfg.minDepth;
    const floor = Math.max(
      ground + cfg.floorClearance * (0.72 + 0.28 * this.scale),
      oxygenLimitY(cfg)
    );
    const column = ceil - floor;

    if (steer && column < cfg.beachTurnWater) {
      const slope = seafloorSlope(this.x, this.z);
      const span = Math.max(0.6, cfg.beachTurnWater - cfg.minWater);
      const u = Math.min(1, (cfg.beachTurnWater - column) / span);
      const w = (20 + u * 48) * dt;
      this.vx -= slope.x * w;
      this.vz -= slope.z * w;
      if (column < cfg.minWater && hasBeach() && this.vz > 0) this.vz *= 0.28;
    }

    if (column < 1.4) {
      this.y = (ceil + floor) * 0.5;
      this.vy = 0;
    } else {
      if (this.y > ceil) {
        this.y = ceil;
        this.vy = Math.min(this.vy, 0);
      }
      if (this.y < floor) {
        this.y = floor;
        this.vy = Math.max(this.vy, 0);
      }
    }
    return ground;
  }

  _player(dt, input, cfg) {
    const mx = Math.max(-cfg.maxMouseStep, Math.min(cfg.maxMouseStep, input.mouseDx));
    const my = Math.max(-cfg.maxMouseStep, Math.min(cfg.maxMouseStep, input.mouseDy));
    this.lookX += (mx - this.lookX) * Math.min(1, dt * 14);
    this.lookY += (my - this.lookY) * Math.min(1, dt * 14);
    this.yawLook += -this.lookX * cfg.mouseTurn;
    this.pitchLook += this.lookY * cfg.mouseTurn * 0.8;
    this.pitchLook = Math.max(-0.5, Math.min(0.55, this.pitchLook));

    if (input.left) this.yawLook += 1.15 * dt;
    if (input.right) this.yawLook -= 1.15 * dt;
    if (input.up) this.pitchLook -= 0.95 * dt;
    if (input.down) this.pitchLook += 0.95 * dt;

    let thrust = 0.42;
    if (input.forward) thrust += 0.58;
    if (input.back) thrust -= 0.48;
    if (input.boost) thrust += 0.38;
    this.thrust = thrust;
    if (cfg.gait !== "jet" && cfg.swim !== "jet") this.bursting = thrust > 0.5;

    if (input.lunge) {
      this.startLunge();
      input.lunge = false;
    }

    const maxSpd = this.lunging
      ? cfg.lungeSpeed
      : input.boost
        ? cfg.boostSpeed
        : cfg.cruiseSpeed;
    this.speedCap = maxSpd * this.cruiseMul;
    const cp = Math.cos(this.pitchLook);
    const desX = Math.sin(this.yawLook) * cp * this.speedCap * thrust;
    const desY = -Math.sin(this.pitchLook) * this.speedCap * thrust;
    const desZ = Math.cos(this.yawLook) * cp * this.speedCap * thrust;
    this._steer(desX, desY, desZ, this.lunging ? cfg.lungeForce : cfg.maxForce, dt);
  }

  _aiFilter(dt, school, cfg, look) {
    if (this.aiT <= 0) {
      this.aiMode = "patrol";
      this.aiT = 5 + Math.random() * 5;
      this._pickRoam();
    }
    const bloom = school?._plankton;
    const fy = bloom?.forageDepth(look) ?? cfg.minDepth - 10;
    const rdx = this.roamX - this.x;
    const rdz = this.roamZ - this.z;
    if (rdx * rdx + rdz * rdz < 28 * 28) this._pickRoam();
    const hungry = this.energy < (cfg.hungry ?? 0.5);
    let tx = this.roamX;
    let ty = hungry ? fy : this.roamY;
    let tz = this.roamZ;
    const maxSpd = cfg.cruiseSpeed * 0.62 * this.cruiseMul;
    const force = cfg.maxForce * 0.42;
    this.thrust = 0.34;
    if (cfg.gait !== "jet" && cfg.swim !== "jet") this.bursting = cfg.gait === "ram";
    this.speedCap = maxSpd;

    const tGround = seafloorHeight(tx, tz);
    ty = Math.min(ty, cfg.minDepth - 0.4);
    ty = Math.max(ty, tGround + cfg.floorClearance + 1.2, oxygenLimitY(cfg));
    tz = Math.min(tz, waterMaxZ() - 36);

    const follow = 1 - Math.exp(-dt * 2.2);
    this.seekX += (tx - this.seekX) * follow;
    this.seekY += (ty - this.seekY) * follow;
    this.seekZ += (tz - this.seekZ) * follow;
    const des = this._desired(this.seekX, this.seekY, this.seekZ, maxSpd, 22);
    this._steer(des.x, des.y, des.z, force, dt);
  }

  _ai(dt, school, cfg, pack, look) {
    this.aiT -= dt;
    this._tickLocomotion(dt);
    this.huntTarget = null;
    const diet = cfg.diet || "bite";
    if (diet === "filter") {
      this._aiFilter(dt, school, cfg, look);
      return;
    }
    const targetSchool = school.targetFor(this);
    const preyV = nearestHuntKind(this, pack, cfg.huntKinds);
    let target = targetSchool;
    let huntVehicle = null;
    if (preyV) {
      const vd = Math.hypot(preyV.x - this.x, preyV.y - this.y, preyV.z - this.z);
      const sd = targetSchool
        ? Math.hypot(targetSchool.x - this.x, targetSchool.y - this.y, targetSchool.z - this.z)
        : Infinity;
      if (!targetSchool || vd < 120 || vd < sd * 0.9 || this.energy < cfg.hungry) {
        target = { x: preyV.x, y: preyV.y, z: preyV.z, vx: preyV.vx, vy: preyV.vy, vz: preyV.vz };
        huntVehicle = preyV;
      }
    }
    if (huntVehicle) this.huntTarget = huntVehicle.kind;
    else if (targetSchool?.id) this.huntTarget = targetSchool.id;
    const hasPrey = !!(huntVehicle || targetSchool);
    if (!target) {
      target = { x: this.roamX, y: this.roamY, z: this.roamZ, vx: 0, vy: 0, vz: 0 };
    }
    const cx = target.x;
    const cy = target.y;
    const cz = target.z;
    let hvx = target.vx || 0;
    let hvz = target.vz || 0;
    let hLen = Math.hypot(hvx, hvz);
    if (hLen < 0.25) {
      hvx = Math.sin(this.yaw);
      hvz = Math.cos(this.yaw);
      hLen = 1;
    }
    const hx = hvx / hLen;
    const hz = hvz / hLen;
    const fx = -hz;
    const fz = hx;
    const dist = Math.hypot(cx - this.x, cy - this.y, cz - this.z);
    const holdR = huntVehicle
      ? Math.max(6, (huntVehicle.cfg?.length ?? 8) * (huntVehicle.scale ?? 1) * 0.65)
      : (CONFIG.fish.schoolRadius ?? 34);

    const lead = podLeader(this, pack);
    this._podFollow = !!(lead && lead !== this);
    if (this._podFollow) {
      this.huntIndex = lead.huntIndex;
      this.roamX = lead.roamX;
      this.roamY = lead.roamY;
      this.roamZ = lead.roamZ;
      if (lead.aiMode !== this.aiMode) {
        if (lead.aiMode === "strike") this.startLunge();
        this.aiMode = lead.aiMode;
      }
      this.aiT = lead.aiT;
    } else if (this.aiT <= 0) this._nextMode(school, dist, holdR, pack);

    const hungry = this.energy < cfg.hungry / this.aggression;
    const satiated = this.energy > cfg.satiated;

    this.circleA += dt * (this.aiMode === "stalk" ? 0.34 : 0.18);
    this.wanderTheta += (Math.random() - 0.5) * 1.4 * dt;

    let tx;
    let ty;
    let tz;
    let maxSpd;
    let force;
    let arriveR = 14;
    if (this.aiMode === "strike") {
      const detect = cfg.sense === "echo" ? 120 : 22;
      let visR = detect;
      let glowR = detect;
      if (visualHunter(cfg)) {
        const vis = visualScales(this.y, look);
        visR = detect * (0.1 + 0.9 * vis.clear);
        const huntsGlow = !cfg.huntTaxa?.length || cfg.huntTaxa.some((id) => SPECIES[id]?.look?.photophores);
        if (huntsGlow && vis.clear < 0.98) {
          const dsl = detect * 0.5;
          glowR = Math.max(visR, visR * vis.clear + dsl * (1 - vis.clear));
        } else glowR = visR;
      }
      const prey =
        huntVehicle ||
        school.nearestFish(this.mouthX, this.mouthY, this.mouthZ, visR, cfg.huntTaxa, glowR) ||
        school.nearestFish(this.x, this.y, this.z, visR, cfg.huntTaxa, glowR);
      if (prey) {
        const lead = 0.16;
        tx = prey.x + prey.vx * lead;
        ty = prey.y + prey.vy * lead;
        tz = prey.z + prey.vz * lead;
        if (!huntVehicle && Number.isFinite(prey.i)) this.huntTarget = school.taxonId(prey.i);
      } else {
        const ahead = Math.min(8, 2.5 + dist * 0.1);
        tx = cx + hx * ahead - fx * this.flankSign * holdR * 0.22;
        tz = cz + hz * ahead - fz * this.flankSign * holdR * 0.22;
        ty = cy - Math.min(1.5, 0.55 + dist * 0.018);
      }
      ty = Math.max(ty, seafloorHeight(tx, tz) + cfg.floorClearance + 1.5);
      maxSpd = cfg.lungeSpeed * this.cruiseMul;
      force = cfg.lungeForce;
      arriveR = 0;
      this.thrust = 1.2;
      this.bursting = true;
    } else if (this.aiMode === "recover") {
      const back = hungry ? 34 : 48;
      const side = hungry ? 18 : 28;
      tx = cx - hx * back + fx * this.flankSign * side;
      ty = hungry ? cy - 1.4 : Math.min(cy + 2.2, cfg.minDepth - 2);
      tz = cz - hz * back + fz * this.flankSign * side;
      maxSpd = cfg.cruiseSpeed * (hungry ? 0.88 : 0.72) * this.cruiseMul;
      force = cfg.maxForce * (hungry ? 0.65 : 0.42);
      arriveR = hungry ? 12 : 18;
      this.thrust = hungry ? 0.48 : 0.32;
      if (cfg.gait !== "jet" && cfg.swim !== "jet") this.bursting = false;
    } else if (this.aiMode === "stalk") {
      const r = (hungry ? holdR * 0.86 : holdR + 8) + 3 * Math.sin(this.circleA * 0.7);
      const weave = Math.sin(this.circleA * 1.15) * 6;
      tx = cx + hx * (hungry ? 6 : 4) + fx * this.flankSign * r + hx * weave * 0.2;
      ty = cy - (hungry ? 2.1 : 2.8);
      tz = cz + hz * (hungry ? 6 : 4) + fz * this.flankSign * r + hz * weave * 0.2;
      const closing = dist > r + 2;
      maxSpd =
        (closing && hungry ? cfg.boostSpeed : cfg.cruiseSpeed) *
        this.cruiseMul *
        (closing ? (hungry ? 1.08 : 0.92) : 0.55);
      force = cfg.maxForce * (closing ? (hungry ? 1.25 : 1) : 0.62);
      arriveR = hungry ? 5 : 12;
      this.thrust = closing ? (hungry ? 0.92 : 0.68) : 0.38;
    } else if (this.sex === 0 && this.mateT <= 0 && this.energy >= cfg.mateEnergy && pack) {
      const mate = nearestOpposite(this, pack);
      if (mate) {
        tx = mate.x;
        ty = mate.y;
        tz = mate.z;
        maxSpd = cfg.cruiseSpeed * 0.72 * this.cruiseMul;
        force = cfg.maxForce * 0.58;
        arriveR = 7;
        this.thrust = 0.44;
        if (cfg.gait !== "jet" && cfg.swim !== "jet") this.bursting = false;
      } else {
        const rdx = this.roamX - this.x;
        const rdz = this.roamZ - this.z;
        if (rdx * rdx + rdz * rdz < 22 * 22) this._pickRoam();
        tx = this.roamX;
        ty = this.roamY;
        tz = this.roamZ;
        maxSpd = cfg.cruiseSpeed * 0.58 * this.cruiseMul;
        force = cfg.maxForce * 0.48;
        arriveR = 24;
        this.thrust = 0.36;
      }
    } else if ((satiated && !hungry) || !hasPrey) {
      const rdx = this.roamX - this.x;
      const rdz = this.roamZ - this.z;
      if (rdx * rdx + rdz * rdz < 22 * 22) this._pickRoam();
      tx = this.roamX;
      ty = this.roamY;
      tz = this.roamZ;
      maxSpd = cfg.cruiseSpeed * 0.58 * this.cruiseMul;
      force = cfg.maxForce * 0.48;
      arriveR = 24;
      this.thrust = 0.36;
    } else {
      const r = (satiated ? 62 : 48) + 10 * Math.sin(this.circleA * 0.28);
      const wx = Math.cos(this.wanderTheta) * 9;
      const wz = Math.sin(this.wanderTheta) * 9;
      tx = cx + hx * 16 + fx * Math.cos(this.circleA) * r + wx;
      ty = cy - 2.4;
      tz = cz + hz * 16 + fz * Math.sin(this.circleA) * r + wz;
      maxSpd = cfg.cruiseSpeed * this.cruiseMul * (dist > 75 ? 0.88 : 0.64);
      force = cfg.maxForce * 0.72;
      arriveR = 18;
      this.thrust = dist > 75 ? 0.58 : 0.36;
    }

    if (!this.bursting && this.aiMode !== "strike" && !this.lunging) {
      maxSpd *= 0.8;
      force *= 0.45;
      this.thrust *= 0.7;
    }

    if (this.cfg.gait === "benthic") {
      ty = seafloorHeight(tx, tz) + cfg.floorClearance + 1.6;
    } else if (cfg.nightDepth != null && this.aiMode !== "strike" && !(hungry && hasPrey)) {
      ty = dvmY(look?.hour ?? 12, cfg);
    }

    if (cfg.breathes) {
      const followPrey = this.aiMode === "strike" || (hasHuntPrey(this, school, pack, cfg) && !satiated);
      if (!followPrey && !this._podFollow) {
        const rdx = this.roamX - this.x;
        const rdz = this.roamZ - this.z;
        if (rdx * rdx + rdz * rdz < 22 * 22) this._pickRoam();
        tx = this.roamX;
        ty = this.roamY;
        tz = this.roamZ;
      }
    }

    if (this._podFollow && this.aiMode !== "strike") {
      const form = formationOff(this, lead);
      tx = form.x;
      tz = form.z;
      if (!cfg.breathes) ty = form.y;
    }

    if (cfg.breathes) ty = this._breathTargetY(tx, tz, ty, cfg);

    const commuting = cfg.breathes && this.surfacing && this.y <= airY(cfg) - 8;
    if (commuting) {
      const rise = airY(cfg) - this.y;
      const ahead = Math.min(Math.max(12, rise * 0.45), 48);
      tx = this.x + this.fwdX * ahead;
      tz = this.z + this.fwdZ * ahead;
    }

    const tGround = seafloorHeight(tx, tz);
    ty = Math.min(ty, cfg.minDepth - 0.4);
    ty = Math.max(ty, tGround + cfg.floorClearance + 1.2, oxygenLimitY(cfg));
    if (tGround > -20) {
      const sl = seafloorSlope(tx, tz);
      tx -= sl.x * 28;
      tz -= sl.z * 28;
    }
    tz = Math.min(tz, waterMaxZ() - 36);

    this.speedCap = maxSpd;
    if (cfg.breathes && Math.abs(ty - this.y) > 12) {
      this.speedCap = Math.max(this.speedCap, cfg.diveSpeed ?? 24);
      this.thrust = Math.max(this.thrust, 0.85);
      this.bursting = true;
    }

    const follow = 1 - Math.exp(-dt * (this.aiMode === "strike" ? 8.5 : commuting ? 5.8 : 2.4));
    this.seekX += (tx - this.seekX) * follow;
    this.seekY += (ty - this.seekY) * follow;
    this.seekZ += (tz - this.seekZ) * follow;

    const des = this._desired(this.seekX, this.seekY, this.seekZ, this.speedCap, arriveR);
    this._steer(des.x, des.y, des.z, force, dt);
  }

  _tickJet(dt) {
    const striking = this.lunging || this.aiMode === "strike";
    const driven = this.controlled && this.thrust > 0.5;
    if (this.bursting) {
      this.burstT -= dt;
      if (this.burstT <= 0) {
        this.bursting = false;
        const hang = Math.sqrt((this.cfg.length ?? 2) / 2);
        this.glideT = striking || driven ? 0.16 + Math.random() * 0.18 : (0.5 + Math.random() * 0.85) * hang;
      }
    } else {
      this.glideT -= dt;
      if (this.glideT <= 0) {
        this.bursting = true;
        const hang = Math.sqrt((this.cfg.length ?? 2) / 2);
        this.burstT = striking || driven ? 0.08 + Math.random() * 0.08 : (0.12 + Math.random() * 0.16) * hang;
      }
    }
  }

  _tickLocomotion(dt) {
    if (this.cfg.gait === "jet" || this.cfg.swim === "jet") return;
    if (this.cfg.gait === "ram") {
      this.bursting = true;
      return;
    }
    if (this.lunging || this.aiMode === "strike") {
      this.bursting = true;
      return;
    }
    if (this.bursting) {
      this.burstT -= dt;
      if (this.burstT <= 0) {
        this.bursting = false;
        this.glideT =
          this.cfg.gait === "burst" && this.cfg.swim === "body"
            ? 1.8 + Math.random() * 2.6
            : 0.7 + Math.random() * 1.5;
      }
    } else {
      this.glideT -= dt;
      if (this.glideT <= 0) {
        this.bursting = true;
        this.burstT =
          this.cfg.gait === "burst" && this.cfg.swim === "body"
            ? 0.28 + Math.random() * 0.42
            : 1.1 + Math.random() * 1.9;
      }
    }
  }

  _pickRoam() {
    if (this._podFollow) return;
    const a = Math.random() * Math.PI * 2;
    const r = 36 + Math.random() * 96;
    this.roamX = Math.cos(a) * r;
    this.roamZ = Math.sin(a) * r * 0.72 - (hasBeach() ? 16 : 0);
    if (hasBeach()) this.roamZ = Math.min(this.roamZ, CONFIG.beach.startZ - 24);
    this.roamX = Math.max(-CONFIG.halfX + 24, Math.min(CONFIG.halfX - 24, this.roamX));
    this.roamZ = Math.max(-CONFIG.halfZ + 24, Math.min(waterMaxZ() - 24, this.roamZ));
    const cfg = this.cfg;
    const deep = this._columnFloor(this.roamX, this.roamZ, cfg);
    const hi = cfg.minDepth ?? -2;
    this.roamY =
      cfg.gait === "benthic"
        ? deep
        : cfg.breathes
          ? roamForageY(cfg, hi, deep, this.energy)
          : hi + Math.random() * (deep - hi);
  }

  _nextMode(school, dist, holdR, pack) {
    if ((this.cfg.diet || "bite") === "filter") {
      this.aiMode = "patrol";
      this.aiT = 5 + Math.random() * 4;
      this._pickRoam();
      return;
    }
    const hungry = this.energy < (this.cfg.hungry ?? CONFIG.shark.hungry) / this.aggression;
    const satiated = this.energy > (this.cfg.satiated ?? CONFIG.shark.satiated);
    const prey = hasHuntPrey(this, school, pack, this.cfg);
    if (this.aiMode === "recover") {
      if (hungry && prey) {
        this.aiMode = "stalk";
        this.aiT = 1.5 + Math.random() * 1.4;
      } else {
        this.aiMode = "patrol";
        this.aiT = 6 + Math.random() * 5;
        this._pickRoam();
      }
      this._nextHunt(school, pack);
      this.flankSign *= -1;
    } else if (this.aiMode === "patrol") {
      if (satiated) {
        this.aiT = 3 + Math.random() * 3.5;
      } else if (prey && (hungry || dist < 72)) {
        this.aiMode = "stalk";
        this.aiT = hungry ? 2.8 + Math.random() * 2.2 : 6.5 + Math.random() * 4;
      } else {
        this.aiT = 3 + Math.random() * 3.5;
      }
    } else if (this.aiMode === "stalk") {
      if (satiated) {
        this.aiMode = "patrol";
        this.aiT = 7 + Math.random() * 5;
        this._pickRoam();
      } else if (dist < holdR * (hungry ? 1.18 : 1.05) && prey) {
        this.aiMode = "strike";
        this.aiT = hungry ? 2.35 : 1.9;
        this.startLunge();
      } else {
        this.aiT = hungry ? 0.65 : 1.8;
      }
    } else if (this.aiMode === "strike") {
      this.aiMode = "recover";
      this.aiT = hungry ? 1.7 + Math.random() * 0.9 : 5.5 + Math.random() * 3;
    } else {
      this.aiMode = "patrol";
      this.aiT = 5 + Math.random() * 3;
    }
  }

  _nextHunt(school, pack) {
    const claimed = new Set();
    if (pack) {
      for (let i = 0; i < pack.length; i++) {
        if (pack[i] !== this) claimed.add(pack[i].huntIndex);
      }
    }
    let fallback = -1;
    const want = this.cfg?.huntTaxa;
    for (let k = 1; k <= school.maxSchools; k++) {
      const idx = (this.huntIndex + k) % school.maxSchools;
      if (school.schoolN[idx] < 8) continue;
      if (want && want.length) {
        const id = school.taxa[school.anchors[idx]?.taxon ?? 0]?.id;
        if (!want.includes(id)) continue;
      }
      if (fallback < 0) fallback = idx;
      if (!claimed.has(idx)) {
        this.huntIndex = idx;
        return;
      }
    }
    if (fallback >= 0) this.huntIndex = fallback;
  }

  _desired(tx, ty, tz, maxSpd, slowR) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dz = tz - this.z;
    const dist = Math.hypot(dx, dy, dz) || 1;
    let spd = maxSpd;
    if (slowR > 0 && dist < slowR) spd = maxSpd * Math.max(0.34, dist / slowR);
    return { x: (dx / dist) * spd, y: (dy / dist) * spd, z: (dz / dist) * spd };
  }

  _steer(desX, desY, desZ, maxForce, dt) {
    let ax = desX - this.vx;
    let ay = desY - this.vy;
    let az = desZ - this.vz;
    const len = Math.hypot(ax, ay, az);
    if (len > maxForce && len > 1e-5) {
      const s = maxForce / len;
      ax *= s;
      ay *= s;
      az *= s;
    }
    this.vx += ax * dt;
    this.vy += ay * dt;
    this.vz += az * dt;
  }

  _limitSpeed(maxSpd) {
    const spd = Math.hypot(this.vx, this.vy, this.vz);
    if (spd > maxSpd) {
      const s = maxSpd / spd;
      this.vx *= s;
      this.vy *= s;
      this.vz *= s;
    } else if (!this.controlled && spd < (this.cfg.minSpeed ?? 4.4)) {
      const hanging =
        this.cfg.breathes && this.surfacing && this.y > airY(this.cfg);
      const coast =
        hanging ||
        (!this.bursting &&
          !this.lunging &&
          (this.cfg.gait === "jet" ||
            this.cfg.swim === "jet" ||
            this.cfg.gait === "benthic" ||
            (this.cfg.gait === "burst" && this.cfg.swim === "body")));
      if (!coast) {
        const s = (this.cfg.minSpeed ?? 4.4) / (spd || 1);
        this.vx *= s;
        this.vy *= s * 0.4;
        this.vz *= s;
      }
    }
  }

  _orientFromVelocity(dt, cfg) {
    const spd = Math.hypot(this.vx, this.vy, this.vz);
    const swim = cfg.swim || "tail";
    if (spd < 0.35) {
      this.yawRate *= Math.max(0, 1 - dt * 4);
      this.roll += (0 - this.roll) * Math.min(1, dt * 3);
      return;
    }
    const desiredYaw = Math.atan2(this.vx, this.vz);
    const horiz = Math.hypot(this.vx, this.vz);
    let desiredPitch = Math.max(-0.55, Math.min(0.58, -Math.atan2(this.vy, horiz)));
    if (cfg.gait === "benthic") desiredPitch *= 0.12;
    if (this.kind === "barracuda") desiredPitch *= 0.22;
    const hanging = cfg.breathes && this.surfacing && this.y > airY(cfg);
    const commuting = cfg.breathes && this.surfacing && !hanging;
    if (hanging) desiredPitch *= 0.12;
    else if (commuting) desiredPitch = Math.max(-1.05, Math.min(0.15, desiredPitch * 1.55));
    else if (cfg.breathes) desiredPitch = Math.max(-0.75, Math.min(0.45, desiredPitch * 1.25));
    if (swim === "jet") desiredPitch = Math.max(-0.85, Math.min(0.85, desiredPitch * 1.35));
    let dyaw = desiredYaw - this.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    const turn = cfg.turnSmooth * this.turnMul * (this.lunging ? 1.45 : 0.82);
    const k = 1 - Math.exp(-dt * turn);
    this.yaw += dyaw * k;
    this.yawRate = dyaw / Math.max(dt, 1 / 120);
    const pitchK =
      cfg.gait === "benthic"
        ? 5.8
        : swim === "jet"
          ? 6.2
          : commuting
            ? 4.4
            : cfg.breathes && !this.surfacing
              ? 2.6
              : swim === "fluke" && (cfg.length ?? 11) > 8
                ? 1.55
                : 3.1;
    this.pitch += (desiredPitch - this.pitch) * (1 - Math.exp(-dt * pitchK));
    const len = cfg.length ?? 11;
    const bankMul =
      cfg.gait === "benthic"
        ? 0.05
        : swim === "jet"
          ? 0.1
          : swim === "fluke" && len > 8
            ? 0.07
            : swim === "fluke"
              ? 0.42
              : len > 8
                ? 0.08
                : 0.24;
    const bankCap =
      cfg.gait === "benthic"
        ? 0.12
        : swim === "jet"
          ? 0.2
          : swim === "fluke" && len > 8
            ? 0.14
            : swim === "fluke"
              ? 0.55
              : len > 8
                ? 0.16
                : 0.58;
    const bank = Math.max(-bankCap, Math.min(bankCap, -this.yawRate * bankMul));
    this.roll += (bank - this.roll) * (1 - Math.exp(-dt * (swim === "fluke" ? 2.4 : 3.4)));
  }
}

export function createShark(i, count, school, kind = "shark") {
  const kindCfg = vehicleCfg(kind);
  const tints = SPECIES[kind]?.vehicle?.tints;
  const kindTint = tints && tints.length ? tints : KINDS;
  const variant = kindTint[i % kindTint.length];
  const n = Math.max(1, count | 0);
  const nPods = vehiclePodsFor(kindCfg, n);
  const podId = vehiclePodId(i, n, nPods);
  const podSlot = vehiclePodSlot(i, n, nPods);
  const sex = i === 0 ? 0 : i === 1 ? 1 : Math.random() < 0.5 ? 0 : 1;
  const dimorph = sex === 0 ? 1.08 : 0.94;
  const shark = new Shark({
    id: i,
    kind,
    sex,
    scale: variant.scale * dimorph * (0.97 + Math.random() * 0.06),
    aggression: variant.aggression * (sex === 0 ? 0.96 : 1.05),
    tint: variant.tint,
    podId,
    podSlot,
  });
  seedVehiclePose(shark, i, n, school);
  const schools = Math.max(1, school.initialSchools || 1);
  shark.huntIndex = vehicleIsPod(kindCfg) ? podId % schools : i % schools;
  shark.flankSign = podSlot % 2 === 0 ? 1 : -1;
  return shark;
}

function seedVehiclePose(shark, i, count, school) {
  const kind = shark.kind;
  const kindCfg = shark.cfg || vehicleCfg(kind);
  const n = Math.max(1, count | 0);
  const nPods = vehiclePodsFor(kindCfg, n);
  const podId = shark.podId ?? vehiclePodId(i, n, nPods);
  const podSlot = shark.podSlot ?? vehiclePodSlot(i, n, nPods);
  shark.podId = podId;
  shark.podSlot = podSlot;
  const seed = (kind.charCodeAt(0) * 17 + kind.length * 13 + podId * 47) % 628;
  const world = Math.max(46, Math.min(CONFIG.halfX, CONFIG.halfZ) * 0.38);
  const prey = school?.count ? school.targetFor(shark) : null;
  const podded = vehicleIsPod(kindCfg) && nPods > 0;
  let ang;
  if (podded) {
    const podAng = (podId / Math.max(1, nPods)) * Math.PI * 2 + seed * 0.01;
    const podR = (kindCfg.gait === "benthic" ? world * 0.35 : world * 0.48) * (nPods === 1 ? 0.55 : 0.85);
    let pcx;
    let pcz;
    if (kindCfg.gait === "benthic") {
      pcx = Math.cos(podAng) * podR;
      pcz = (hasBeach() ? CONFIG.beach.startZ : 0) - 120 - podId * 80;
    } else if (prey && Number.isFinite(prey.x)) {
      pcx = prey.x + Math.cos(podAng) * podR * (nPods === 1 ? 0.28 : 0.5);
      pcz = prey.z + Math.sin(podAng) * podR * (nPods === 1 ? 0.28 : 0.5);
      if (kindCfg.breathes) pcz = prey.z + Math.sin(podAng) * world * 0.18;
      if ((kindCfg.maxDepth ?? -400) < -800) pcz = Math.min(pcz, -Math.abs(world) * 0.45);
    } else {
      pcx = Math.cos(podAng) * podR;
      if (kindCfg.breathes) pcz = Math.sin(podAng) * world * 0.32 - world * 0.12;
      else if ((kindCfg.maxDepth ?? -400) < -800) pcz = -Math.abs(world) * 0.7 + Math.sin(podAng) * world * 0.18;
      else pcz = (school.centroid?.z || 0) + Math.sin(podAng) * podR * 0.7;
    }
    const dummy = {
      x: pcx,
      y: 0,
      z: pcz,
      fwdX: Math.sin(podAng + Math.PI),
      fwdZ: Math.cos(podAng + Math.PI),
    };
    const off = formationOff(shark, dummy);
    shark.x = off.x;
    shark.z = off.z;
    ang = podAng + Math.PI;
    if (kindCfg.breathes) {
      const u = ((podId * 17 + kind.charCodeAt(0)) % 100) / 100;
      shark.surfacing = u < 0.28;
      shark.breathT = shark.surfacing
        ? u * (kindCfg.surfaceTime ?? 6)
        : u * (kindCfg.diveTime ?? 20);
    }
  } else {
    ang = (i / n) * Math.PI * 2 + seed * 0.01;
    const r = (kindCfg.gait === "benthic" ? world * 0.35 : world * 0.55) * (0.45 + (i + 1) / (n + 1));
    if (kindCfg.gait === "benthic") {
      shark.x = Math.cos(ang) * r;
      shark.z = (hasBeach() ? CONFIG.beach.startZ : 0) - 120 - (i % 3) * 80;
    } else if (prey && Number.isFinite(prey.x)) {
      shark.x = prey.x + Math.cos(ang) * r * 0.45;
      shark.z = prey.z + Math.sin(ang) * r * 0.45;
      if (kindCfg.breathes) shark.z = prey.z + Math.sin(ang) * world * 0.22;
      if ((kindCfg.maxDepth ?? -400) < -800) shark.z = Math.min(shark.z, -Math.abs(world) * 0.45);
    } else {
      shark.x = Math.cos(ang) * r;
      if (kindCfg.breathes) {
        shark.z = Math.sin(ang) * world * 0.4 - world * 0.15;
      } else if ((kindCfg.maxDepth ?? -400) < -800) {
        shark.z = -Math.abs(world) * 0.7 + Math.sin(ang) * world * 0.22;
      } else {
        shark.z = (school.centroid?.z || 0) + Math.sin(ang) * r * 0.85;
        shark.x = (school.centroid?.x || 0) + Math.cos(ang) * r;
      }
    }
  }
  shark.x = Math.max(-CONFIG.halfX + 24, Math.min(CONFIG.halfX - 24, shark.x));
  shark.z = Math.max(-CONFIG.halfZ + 24, Math.min(waterMaxZ() - 24, shark.z));
  const hour = school?._hour ?? 12;
  let wantY;
  if (kindCfg.gait === "benthic") {
    wantY = seafloorHeight(shark.x, shark.z) + kindCfg.floorClearance + 2;
  } else if (kindCfg.breathes) {
    wantY = shark.surfacing ? -2.2 : -4 - podSlot * 0.8;
  } else if (kindCfg.nightDepth != null) {
    wantY = dvmY(hour, kindCfg);
  } else {
    wantY = (kindCfg.minDepth ?? CONFIG.fish.preferredDepth) - 8 - i * 2;
  }
  const placed = placeInColumn(shark.x, shark.z, wantY, {
    maxDepth: oxygenLimitY(kindCfg),
    clearance: kindCfg.floorClearance,
    minWater: kindCfg.minWater,
  });
  shark.x = placed.x;
  shark.y = placed.y;
  shark.z = placed.z;
  if (kindCfg.breathes) {
    const air = airY(kindCfg);
    shark._submerged = shark.y <= air;
    if (shark.surfacing && shark.y <= air) {
      shark.breathT = Math.max(shark.breathT || 0, ascentReserve(shark.y, kindCfg));
    }
  }
  shark.yDeep = shark.y;
  shark.yShallow = shark.y;
  shark.yaw = podded ? ang : ang + Math.PI;
  shark.yawLook = shark.yaw;
  shark.fwdX = Math.sin(shark.yaw);
  shark.fwdZ = Math.cos(shark.yaw);
  shark.seekX = shark.x;
  shark.seekY = shark.y;
  shark.seekZ = shark.z;
}

function podLeader(self, pack) {
  if (!pack || !vehicleIsPod(self.cfg)) return null;
  let lead = null;
  for (let i = 0; i < pack.length; i++) {
    const o = pack[i];
    if (o.dead || o.kind !== self.kind || o.podId !== self.podId) continue;
    if (!lead || (o.podSlot ?? 99) < (lead.podSlot ?? 99)) lead = o;
  }
  return lead;
}

function formationOff(self, lead) {
  const spacing = self.cfg?.spacing ?? 16;
  const slot = Math.max(0, self.podSlot | 0);
  const cols = spacing < 16 ? 3 : 2;
  const row = Math.floor(slot / cols);
  const col = slot % cols;
  const behind = spacing * (0.28 + row * 0.52);
  const wide = spacing * 0.4 * (col - (cols - 1) / 2);
  const lx = lead.fwdX ?? Math.sin(lead.yaw || 0);
  const lz = lead.fwdZ ?? Math.cos(lead.yaw || 0);
  return {
    x: lead.x - lx * behind + -lz * wide,
    y: lead.y + (slot % 2 === 0 ? 0.45 : -0.45),
    z: lead.z - lz * behind + lx * wide,
  };
}

export function hasHuntPrey(self, school, pack, cfg) {
  if (nearestHuntKind(self, pack, cfg.huntKinds)) return true;
  const want = cfg.huntTaxa;
  if (!want?.length) return (school?.count ?? 0) > 8;
  if (!school) return false;
  for (let s = 0; s < school.maxSchools; s++) {
    if (school.schoolN[s] < 8) continue;
    const id = school.taxa[school.anchors[s]?.taxon ?? 0]?.id;
    if (want.includes(id)) return true;
  }
  return false;
}

/** Typical forage band for an air-breather. Never the biological max. */
function roamForageY(cfg, hi, deep, energy) {
  const typical = Math.max(deep, Math.min(hi - 0.4, cfg.forageDepth ?? hi + (deep - hi) * 0.35));
  const satiated = energy > (cfg.satiated ?? 0.82);
  const center = satiated ? (typical + hi) * 0.5 : typical;
  const span = Math.max(8, Math.abs(typical - hi) * (satiated ? 0.25 : 0.18));
  return Math.max(deep, Math.min(hi - 0.4, center + (Math.random() - 0.5) * 2 * span));
}

function nearestHuntKind(self, pack, kinds) {
  if (!kinds?.length || !pack) return null;
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < pack.length; i++) {
    const o = pack[i];
    if (o === self || o.dead) continue;
    if (!kinds.includes(o.kind)) continue;
    const d = Math.hypot(o.x - self.x, o.y - self.y, o.z - self.z);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

function nearestOpposite(self, pack) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < pack.length; i++) {
    const o = pack[i];
    if (o === self || o.dead || o.sex === self.sex) continue;
    const d = Math.hypot(o.x - self.x, o.y - self.y, o.z - self.z);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

export function tryBreed(pack) {
  const year = yearSeconds();
  for (const kind of VEHICLE_IDS) {
    if (!faunaPresent(kind)) continue;
    const cfg = vehicleCfg(kind);
    const group = pack.filter((p) => p.kind === kind && !p.dead);
    if (group.length >= cfg.max) continue;
    for (let i = 0; i < group.length; i++) {
      const a = group[i];
      if (a.sex !== 0 || a.mateT > 0 || a.energy < cfg.mateEnergy) continue;
      const b = nearestOpposite(a, group);
      if (!b) continue;
      const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      if (d > cfg.mateDist) continue;
      a.energy = Math.max(cfg.hungry, a.energy - cfg.pupCost);
      a.mateT = year;
      a.pups++;
      return birthShark(a, b, pack.length);
    }
  }
  return null;
}

export function birthShark(mother, father, id) {
  const kind = KINDS[id % KINDS.length];
  const sex = Math.random() < 0.5 ? 0 : 1;
  const parentScale = 0.55 * mother.scale + 0.45 * (father?.scale ?? mother.scale);
  const pup = new Shark({
    id,
    kind: mother.kind || "shark",
    sex,
    scale: parentScale * (0.55 + Math.random() * 0.08) * (sex === 0 ? 1.06 : 0.95),
    aggression: kind.aggression * (sex === 0 ? 0.96 : 1.05),
    tint: mother.tint || kind.tint,
    mateT: yearSeconds(),
  });
  const side = mother.flankSign || 1;
  pup.x = mother.x + mother.fwdZ * 6 * side;
  pup.y = mother.y;
  pup.z = mother.z - mother.fwdX * 6 * side;
  pup.vx = mother.vx * 0.4;
  pup.vy = 0;
  pup.vz = mother.vz * 0.4;
  pup.yaw = mother.yaw;
  pup.yawLook = mother.yaw;
  pup.fwdX = mother.fwdX;
  pup.fwdY = 0;
  pup.fwdZ = mother.fwdZ;
  pup.energy = vehicleCfg(mother.kind).pupEnergy;
  pup.huntIndex = mother.huntIndex;
  pup.flankSign = -side;
  pup.podId = mother.podId ?? 0;
  pup.podSlot = (mother.podSlot ?? 0) + 6 + ((id | 0) % 5);
  pup.seekX = pup.x;
  pup.seekY = pup.y;
  pup.seekZ = pup.z;
  pup.aiMode = "patrol";
  pup.aiT = 4 + Math.random() * 3;
  return pup;
}

export function spawnSharks(n, school) {
  return spawnPredators(school, { shark: n });
}

export function spawnPredators(school, counts = {}) {
  const pack = [];
  for (const kind of VEHICLE_IDS) {
    if (!faunaPresent(kind)) continue;
    const cfg = vehicleCfg(kind);
    const weight = CONFIG.presence?.[kind] ?? 1;
    const raw = counts[kind] !== undefined ? counts[kind] : vehicleCountFor(kind, weight);
    const want = CONFIG.world?.lab ? Math.max(2, raw | 0) : raw | 0;
    const count = Math.max(0, Math.min(cfg.max ?? want, want));
    for (let i = 0; i < count; i++) pack.push(createShark(i, count, school, kind));
  }
  return pack;
}

export function resetSharks(pack, school) {
  const seen = {};
  for (let i = 0; i < pack.length; i++) {
    const kind = pack[i].kind || "shark";
    seen[kind] = (seen[kind] || 0) + 1;
  }
  const idx = {};
  for (let i = 0; i < pack.length; i++) {
    const s = pack[i];
    const kind = s.kind || "shark";
    const n = seen[kind];
    const k = idx[kind] || 0;
    idx[kind] = k + 1;
    s.eaten = 0;
    s.pups = 0;
    s.filterTaken = 0;
    s.filterMeals = 0;
    s.energyIn = 0;
    s.cause = null;
    s.energy = 0.55 + Math.random() * 0.25;
    s.biteT = 0;
    s.starveT = 0;
    s.dead = false;
    s.mateT = Math.random() * yearSeconds();
    s.lunging = false;
    s.lungeT = 0;
    s.aiMode = "patrol";
    s.aiT = 4 + Math.random() * 4;
    const nPods = vehiclePodsFor(s.cfg, n);
    s.podId = vehiclePodId(k, n, nPods);
    s.podSlot = vehiclePodSlot(k, n, nPods);
    seedVehiclePose(s, k, n, school);
    s.yDeep = s.y;
    s.yShallow = s.y;
    s.vx = 0;
    s.vy = 0;
    s.vz = -5;
    s.huntIndex = vehicleIsPod(s.cfg)
      ? s.podId % Math.max(1, school.initialSchools || 1)
      : k % Math.max(1, school.initialSchools || 1);
    s.flankSign = s.podSlot % 2 === 0 ? 1 : -1;
    s._podFollow = false;
    s._pickRoam();
  }
}

export function focusShark(pack) {
  let best = pack[0];
  let score = -1;
  for (let i = 0; i < pack.length; i++) {
    const s = pack[i];
    const sc = s.lunging ? 4 : s.aiMode === "strike" ? 3 : s.aiMode === "stalk" ? 1.5 : 0;
    if (sc > score) {
      score = sc;
      best = s;
    }
  }
  return best;
}
