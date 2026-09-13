import { CONFIG, clampHabitatY, faunaPresent, hasBeach, waterMaxZ, yearSeconds } from "../config.js";
import { steerFromColliders, resolveColliders, seafloorHeight, seafloorSlope } from "./obstacles.js";
import { sampleFlow } from "./flow.js";

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
 * Locomotion is burst-and-glide (tail kicks, then a coast) rather than
 * a constant thruster. AI sharks split schools, strike from below, and
 * keep a body-length of water between each other.
 */
export class Shark {
  constructor(opts = {}) {
    this.id = opts.id ?? 0;
    this.scale = opts.scale ?? 1;
    this.aggression = opts.aggression ?? 1;
    this.tint = opts.tint ?? null;
    this.sex = opts.sex ?? (Math.random() < 0.5 ? 0 : 1);
    this.cruiseMul = 0.78 + this.scale * 0.22;
    this.turnMul = 1.55 - this.scale * 0.48;
    this.x = 8;
    this.y = clampHabitatY(CONFIG.fish.preferredDepth, CONFIG.shark.maxDepth);
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
    this.speedCap = CONFIG.shark.cruiseSpeed;
    this.eatEvents = [];
    this.eaten = 0;
    this.pups = 0;
    this.biteT = 0;
    this.starveT = 0;
    this.dead = false;
    this.mateT = opts.mateT ?? (0.4 + Math.random() * 0.6) * yearSeconds();
    this.energy = 0.55 + Math.random() * 0.28;
    this.fearRadius = CONFIG.shark.fearRadius;
    this.fearStrength = CONFIG.fish.fearWeight;
    this.biteRadius = CONFIG.shark.biteRadius;
    this.bursting = true;
    this.burstT = 1.2 + Math.random() * 1.8;
    this.glideT = 0;
    this.roamX = 0;
    this.roamY = CONFIG.fish.preferredDepth;
    this.roamZ = 0;
    this._pickRoam();
    this.onEat = (x, y, z) => {
      this.eaten++;
      this.eatEvents.push({ x, y, z, t: 0 });
    };
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
    this.energy = Math.min(1, this.energy + CONFIG.shark.eatEnergy);
  }

  startLunge() {
    if (this.lunging && this.lungeT > 0.35) return;
    const lungeT = CONFIG.shark.lungeTime;
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
    const cfg = CONFIG.shark;
    if (this.controlled) this._player(dt, input, cfg);
    else this._ai(dt, school, cfg, pack);

    this.lungeT -= dt;
    if (this.lungeT <= 0) this.lunging = false;
    this.biteT = Math.max(0, (this.biteT ?? 0) - dt);

    const fearMul = look?.fearScale ?? 1;
    const striking = this.lunging || this.aiMode === "strike";
    this.fearRadius = (striking ? cfg.lungeFearRadius : cfg.fearRadius) * fearMul * this.scale;
    this.fearStrength = striking ? CONFIG.fish.fearWeight * 1.55 : CONFIG.fish.fearWeight;
    this.biteRadius = (striking ? cfg.lungeBiteRadius : cfg.biteRadius) * this.scale;

    const colliders = school.colliders;
    const nCol = school.colliderCount;
    const rockR = 4.6 * this.scale;
    const rock = steerFromColliders(this.x, this.y, this.z, colliders, nCol, rockR + 1, 18);
    this.vx += rock.ax * dt;
    this.vy += rock.ay * dt;
    this.vz += rock.az * dt;

    if (pack) this._avoidPack(pack, dt);

    const kick = Math.max(0, Math.sin(this.swimT));
    const kickForce = kick * kick * (this.lunging ? 9 : 3.1) * this.thrust * this.cruiseMul;
    this.vx += this.fwdX * kickForce * dt;
    this.vy += this.fwdY * kickForce * dt * 0.25;
    this.vz += this.fwdZ * kickForce * dt;

    this._limitSpeed(this.speedCap);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;

    const flow = sampleFlow(this.x, this.y, this.z, look?.simTime ?? 0, look?.storm ?? 0);
    this.x += flow.x * dt;
    this.y += flow.y * dt * 0.45;
    this.z += flow.z * dt;

    const drain = cfg.energyDrain * (this.lunging ? 2.4 : this.aiMode === "strike" ? 1.6 : 1);
    this.energy = Math.max(0, this.energy - drain * dt);
    this.mateT = Math.max(0, this.mateT - dt);
    if (this.energy < cfg.starveAt) this.starveT += dt;
    else this.starveT = Math.max(0, this.starveT - dt * 1.8);
    if (this.starveT >= cfg.starveDays * CONFIG.time.dayLength) this.dead = true;

    this._keepInWater(cfg, dt, true);

    const pushed = resolveColliders(this.x, this.y, this.z, colliders, nCol, rockR);
    this.x = pushed.x;
    this.y = pushed.y;
    this.z = pushed.z;

    const ground = this._keepInWater(cfg, dt, false);

    this._orientFromVelocity(dt, cfg);

    if (this.y > cfg.minDepth - 2.2 && this.pitch < 0.05) {
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

    const spd = Math.hypot(this.vx, this.vy, this.vz);
    const freq = (0.32 + spd * 0.042) / Math.sqrt(this.scale);
    this.swimT += dt * Math.PI * 2 * freq;

    for (let i = this.eatEvents.length - 1; i >= 0; i--) {
      this.eatEvents[i].t += dt;
      if (this.eatEvents[i].t > 0.7) this.eatEvents.splice(i, 1);
    }
  }

  _avoidPack(pack, dt) {
    for (let i = 0; i < pack.length; i++) {
      const o = pack[i];
      if (o === this) continue;
      const dx = this.x - o.x;
      const dy = this.y - o.y;
      const dz = this.z - o.z;
      const d = Math.hypot(dx, dy, dz);
      const minD = CONFIG.shark.spacing * (0.55 + 0.28 * (this.scale + o.scale));
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

  _keepInWater(cfg, dt, steer = true) {
    this.x = Math.max(-CONFIG.halfX + 8, Math.min(CONFIG.halfX - 8, this.x));
    this.z = Math.max(-CONFIG.halfZ + 8, Math.min(waterMaxZ() - 10, this.z));

    const ground = seafloorHeight(this.x, this.z);
    const ceil = cfg.minDepth;
    const floor = Math.max(
      ground + cfg.floorClearance * (0.72 + 0.28 * this.scale),
      cfg.maxDepth ?? CONFIG.fish.maxDepth
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
    this.bursting = thrust > 0.5;

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

  _ai(dt, school, cfg, pack) {
    this.aiT -= dt;
    this._tickLocomotion(dt);
    const target = school.targetFor(this);
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
    const holdR = CONFIG.fish.schoolRadius;

    if (this.aiT <= 0) this._nextMode(school, dist, holdR, pack);

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
      const prey =
        school.nearestFish(this.mouthX, this.mouthY, this.mouthZ, 7.2) ||
        school.nearestFish(this.x, this.y, this.z, 7.2);
      if (prey) {
        const lead = 0.16;
        tx = prey.x + prey.vx * lead;
        ty = prey.y + prey.vy * lead;
        tz = prey.z + prey.vz * lead;
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
      this.bursting = false;
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
        this.bursting = false;
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
    } else if (satiated && !hungry) {
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

    const tGround = seafloorHeight(tx, tz);
    ty = Math.min(ty, cfg.minDepth - 0.4);
    ty = Math.max(ty, tGround + cfg.floorClearance + 1.2);
    if (tGround > -20) {
      const sl = seafloorSlope(tx, tz);
      tx -= sl.x * 28;
      tz -= sl.z * 28;
    }
    tz = Math.min(tz, waterMaxZ() - 36);

    this.speedCap = maxSpd;

    const follow = 1 - Math.exp(-dt * (this.aiMode === "strike" ? 8.5 : 2.4));
    this.seekX += (tx - this.seekX) * follow;
    this.seekY += (ty - this.seekY) * follow;
    this.seekZ += (tz - this.seekZ) * follow;

    const des = this._desired(this.seekX, this.seekY, this.seekZ, maxSpd, arriveR);
    this._steer(des.x, des.y, des.z, force, dt);
  }

  _tickLocomotion(dt) {
    if (this.lunging || this.aiMode === "strike") {
      this.bursting = true;
      return;
    }
    if (this.bursting) {
      this.burstT -= dt;
      if (this.burstT <= 0) {
        this.bursting = false;
        this.glideT = 0.7 + Math.random() * 1.5;
      }
    } else {
      this.glideT -= dt;
      if (this.glideT <= 0) {
        this.bursting = true;
        this.burstT = 1.1 + Math.random() * 1.9;
      }
    }
  }

  _pickRoam() {
    const a = Math.random() * Math.PI * 2;
    const r = 36 + Math.random() * 96;
    this.roamX = Math.cos(a) * r;
    this.roamZ = Math.sin(a) * r * 0.72 - (hasBeach() ? 16 : 0);
    if (hasBeach()) this.roamZ = Math.min(this.roamZ, CONFIG.beach.startZ - 24);
    this.roamX = Math.max(-CONFIG.halfX + 24, Math.min(CONFIG.halfX - 24, this.roamX));
    this.roamZ = Math.max(-CONFIG.halfZ + 24, Math.min(waterMaxZ() - 24, this.roamZ));
    this.roamY = clampHabitatY(
      CONFIG.fish.preferredDepth + (Math.random() - 0.5) * 12,
      CONFIG.shark.maxDepth
    );
  }

  _nextMode(school, dist, holdR, pack) {
    const hungry = this.energy < CONFIG.shark.hungry / this.aggression;
    const satiated = this.energy > CONFIG.shark.satiated;
    if (this.aiMode === "recover") {
      if (hungry && school.count > 8) {
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
      } else if (school.count > 8 && (hungry || dist < 72)) {
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
      } else if (dist < holdR * (hungry ? 1.18 : 1.05) && school.count > 8) {
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
    for (let k = 1; k <= school.maxSchools; k++) {
      const idx = (this.huntIndex + k) % school.maxSchools;
      if (school.schoolN[idx] <= 40) continue;
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
    } else if (!this.controlled && spd < 4.4) {
      const s = 4.4 / (spd || 1);
      this.vx *= s;
      this.vy *= s * 0.4;
      this.vz *= s;
    }
  }

  _orientFromVelocity(dt, cfg) {
    const spd = Math.hypot(this.vx, this.vy, this.vz);
    if (spd < 0.35) {
      this.yawRate *= Math.max(0, 1 - dt * 4);
      this.roll += (0 - this.roll) * Math.min(1, dt * 3);
      return;
    }
    const desiredYaw = Math.atan2(this.vx, this.vz);
    const horiz = Math.hypot(this.vx, this.vz);
    const desiredPitch = Math.max(-0.55, Math.min(0.58, -Math.atan2(this.vy, horiz)));
    let dyaw = desiredYaw - this.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    const turn = cfg.turnSmooth * this.turnMul * (this.lunging ? 1.45 : 0.82);
    const k = 1 - Math.exp(-dt * turn);
    this.yaw += dyaw * k;
    this.yawRate = dyaw / Math.max(dt, 1 / 120);
    this.pitch += (desiredPitch - this.pitch) * (1 - Math.exp(-dt * 3.1));
    const bank = Math.max(-0.58, Math.min(0.58, -this.yawRate * 0.24));
    this.roll += (bank - this.roll) * (1 - Math.exp(-dt * 3.4));
  }
}

export function createShark(i, count, school) {
  const kind = KINDS[i % KINDS.length];
  const n = Math.max(1, count | 0);
  const sex = i === 0 ? 0 : i === 1 ? 1 : Math.random() < 0.5 ? 0 : 1;
  const dimorph = sex === 0 ? 1.08 : 0.94;
  const shark = new Shark({
    id: i,
    sex,
    scale: kind.scale * dimorph * (0.97 + Math.random() * 0.06),
    aggression: kind.aggression * (sex === 0 ? 0.96 : 1.05),
    tint: kind.tint,
  });
  const ang = (i / n) * Math.PI * 2 + 0.55;
  const r = 46 + i * 22;
  shark.x = school.centroid.x + Math.cos(ang) * r;
  shark.y = school.centroid.y - 2.5 - i * 1.8;
  shark.z = school.centroid.z + Math.sin(ang) * r * 0.85;
  shark.yaw = ang + Math.PI;
  shark.yawLook = shark.yaw;
  shark.fwdX = Math.sin(shark.yaw);
  shark.fwdZ = Math.cos(shark.yaw);
  shark.huntIndex = i % Math.max(1, school.initialSchools || 1);
  shark.flankSign = i % 2 === 0 ? 1 : -1;
  shark.seekX = shark.x;
  shark.seekY = shark.y;
  shark.seekZ = shark.z;
  return shark;
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
  if (!faunaPresent("shark") || pack.length >= CONFIG.shark.max) return null;
  const cfg = CONFIG.shark;
  const year = yearSeconds();
  for (let i = 0; i < pack.length; i++) {
    const a = pack[i];
    if (a.dead || a.sex !== 0 || a.mateT > 0 || a.energy < cfg.mateEnergy) continue;
    const b = nearestOpposite(a, pack);
    if (!b) continue;
    const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (d > cfg.mateDist) continue;
    a.energy = Math.max(cfg.hungry, a.energy - cfg.pupCost);
    a.mateT = year;
    a.pups++;
    return birthShark(a, b, pack.length);
  }
  return null;
}

export function birthShark(mother, father, id) {
  const kind = KINDS[id % KINDS.length];
  const sex = Math.random() < 0.5 ? 0 : 1;
  const parentScale = 0.55 * mother.scale + 0.45 * (father?.scale ?? mother.scale);
  const pup = new Shark({
    id,
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
  pup.energy = CONFIG.shark.pupEnergy;
  pup.huntIndex = mother.huntIndex;
  pup.flankSign = -side;
  pup.seekX = pup.x;
  pup.seekY = pup.y;
  pup.seekZ = pup.z;
  pup.aiMode = "patrol";
  pup.aiT = 4 + Math.random() * 3;
  return pup;
}

export function spawnSharks(n, school) {
  if (!faunaPresent("shark")) return [];
  const count = Math.max(0, Math.min(CONFIG.shark.max ?? n, n | 0));
  const pack = [];
  for (let i = 0; i < count; i++) pack.push(createShark(i, count, school));
  return pack;
}

export function resetSharks(pack, school) {
  for (let i = 0; i < pack.length; i++) {
    const s = pack[i];
    s.eaten = 0;
    s.pups = 0;
    s.energy = 0.55 + Math.random() * 0.25;
    s.biteT = 0;
    s.starveT = 0;
    s.dead = false;
    s.mateT = Math.random() * yearSeconds();
    s.lunging = false;
    s.lungeT = 0;
    s.aiMode = "patrol";
    s.aiT = 4 + Math.random() * 4;
    const ang = (i / pack.length) * Math.PI * 2 + 0.55;
    const r = 46 + i * 22;
    s.x = school.centroid.x + Math.cos(ang) * r;
    s.y = school.centroid.y - 2.5 - i * 1.8;
    s.z = school.centroid.z + Math.sin(ang) * r * 0.85;
    s.vx = 0;
    s.vy = 0;
    s.vz = -5;
    s.yaw = ang + Math.PI;
    s.huntIndex = i % Math.max(1, school.initialSchools || 1);
    s.flankSign = i % 2 === 0 ? 1 : -1;
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
