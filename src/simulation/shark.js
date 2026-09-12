import { CONFIG } from "../config.js";
import { steerFromColliders, resolveColliders, seafloorHeight, seafloorSlope } from "./obstacles.js";

/**
 * Reynolds-style vehicle: steer velocity toward a desired velocity,
 * then hang the body off that path. Same model OpenSteer uses, and
 * the same seek / pursuit / arrive / wander set as most decent fish
 * and predator sims.
 */
export class Shark {
  constructor() {
    this.x = 8;
    this.y = CONFIG.fish.preferredDepth;
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
    this.aiT = 6;
    this.circleA = Math.random() * Math.PI * 2;
    this.huntIndex = 0;
    this.flankSign = Math.random() < 0.5 ? 1 : -1;
    this.thrust = 0.45;
    this.swimT = 0;
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
    this.fearRadius = CONFIG.shark.fearRadius;
    this.fearStrength = CONFIG.fish.fearWeight;
    this.biteRadius = CONFIG.shark.biteRadius;
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
    if (on) this.lunging = false;
  }

  startLunge() {
    this.lunging = true;
    this.lungeT = 1.25;
  }

  update(dt, input, school, look) {
    const cfg = CONFIG.shark;
    if (this.controlled) this._player(dt, input, cfg);
    else this._ai(dt, school, cfg);

    this.lungeT -= dt;
    if (this.lungeT <= 0) this.lunging = false;

    const fearMul = look?.fearScale ?? 1;
    this.fearRadius = (this.lunging ? cfg.lungeFearRadius : cfg.fearRadius) * fearMul;
    this.fearStrength = this.lunging ? CONFIG.fish.fearWeight * 1.55 : CONFIG.fish.fearWeight;
    this.biteRadius = this.lunging ? cfg.lungeBiteRadius : cfg.biteRadius;

    const colliders = school.colliders;
    const nCol = school.colliderCount;
    const rock = steerFromColliders(this.x, this.y, this.z, colliders, nCol, 5.2, 18);
    this.vx += rock.ax * dt;
    this.vy += rock.ay * dt;
    this.vz += rock.az * dt;

    this._limitSpeed(this.speedCap);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;

    this._keepInWater(cfg, dt, true);

    const pushed = resolveColliders(this.x, this.y, this.z, colliders, nCol, 4.2);
    this.x = pushed.x;
    this.y = pushed.y;
    this.z = pushed.z;

    const ground = this._keepInWater(cfg, dt, false);

    this._orientFromVelocity(dt, cfg);

    if (this.y > cfg.minDepth - 2.2 && this.pitch < 0.05) {
      this.pitch += (0.08 - this.pitch) * Math.min(1, dt * 2.2);
    }
    if (this.y < ground + cfg.floorClearance + 4 && this.pitch > 0) {
      this.pitch += (-0.12 - this.pitch) * Math.min(1, dt * 2.4);
    }

    const cp = Math.cos(this.pitch);
    this.fwdX = Math.sin(this.yaw) * cp;
    this.fwdY = -Math.sin(this.pitch);
    this.fwdZ = Math.cos(this.yaw) * cp;
    this.mouthX = this.x + this.fwdX * cfg.mouthOffset;
    this.mouthY = this.y + this.fwdY * cfg.mouthOffset;
    this.mouthZ = this.z + this.fwdZ * cfg.mouthOffset;

    const spd = Math.hypot(this.vx, this.vy, this.vz);
    const freq = (0.28 * Math.max(spd, 2.2)) / 2.15;
    this.swimT += dt * Math.PI * 2 * freq;

    for (let i = this.eatEvents.length - 1; i >= 0; i--) {
      this.eatEvents[i].t += dt;
      if (this.eatEvents[i].t > 0.7) this.eatEvents.splice(i, 1);
    }
  }

  _keepInWater(cfg, dt, steer = true) {
    this.x = Math.max(-CONFIG.halfX + 8, Math.min(CONFIG.halfX - 8, this.x));
    this.z = Math.max(-CONFIG.halfZ + 8, Math.min(CONFIG.beach.shoreZ - 10, this.z));

    const ground = seafloorHeight(this.x, this.z);
    const ceil = cfg.minDepth;
    const floor = ground + cfg.floorClearance;
    const column = ceil - floor;

    if (steer && column < cfg.beachTurnWater) {
      const slope = seafloorSlope(this.x, this.z);
      const span = Math.max(0.6, cfg.beachTurnWater - cfg.minWater);
      const u = Math.min(1, (cfg.beachTurnWater - column) / span);
      const w = (20 + u * 48) * dt;
      this.vx -= slope.x * w;
      this.vz -= slope.z * w;
      if (column < cfg.minWater && this.vz > 0) this.vz *= 0.28;
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

    const maxSpd = this.lunging
      ? cfg.lungeSpeed
      : input.boost
        ? cfg.boostSpeed
        : cfg.cruiseSpeed;
    this.speedCap = maxSpd;
    const cp = Math.cos(this.pitchLook);
    const desX = Math.sin(this.yawLook) * cp * maxSpd * thrust;
    const desY = -Math.sin(this.pitchLook) * maxSpd * thrust;
    const desZ = Math.cos(this.yawLook) * cp * maxSpd * thrust;
    this._steer(desX, desY, desZ, this.lunging ? cfg.lungeForce : cfg.maxForce, dt);

    if (input.lunge) {
      this.startLunge();
      input.lunge = false;
    }
  }

  _ai(dt, school, cfg) {
    this.aiT -= dt;
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
    const flank = holdR + 16;

    if (this.aiT <= 0) this._nextMode(school, dist, holdR);

    this.circleA += dt * (this.aiMode === "stalk" ? 0.28 : 0.16);
    this.wanderTheta += (Math.random() - 0.5) * 1.1 * dt;

    let tx;
    let ty;
    let tz;
    let maxSpd;
    let force;
    let arriveR = 14;
    if (this.aiMode === "strike") {
      const look = Math.min(18, dist * 0.45);
      tx = cx + hx * look + fx * this.flankSign * holdR * 0.28;
      tz = cz + hz * look + fz * this.flankSign * holdR * 0.28;
      ty = Math.min(cy - 0.6, cfg.minDepth - 0.8);
      ty = Math.max(ty, seafloorHeight(tx, tz) + cfg.floorClearance + 1.5);
      maxSpd = cfg.lungeSpeed;
      force = cfg.lungeForce;
      arriveR = 0;
      this.thrust = 1.15;
    } else if (this.aiMode === "recover") {
      tx = cx - hx * 38 + fx * this.flankSign * 22;
      ty = Math.min(cy + 3.5, cfg.minDepth - 2);
      tz = cz - hz * 38 + fz * this.flankSign * 22;
      maxSpd = cfg.cruiseSpeed * 0.92;
      force = cfg.maxForce * 0.85;
      arriveR = 16;
      this.thrust = 0.48;
    } else if (this.aiMode === "stalk") {
      const r = flank + 3 * Math.sin(this.circleA * 0.55);
      tx = cx - hx * 8 + fx * this.flankSign * r;
      ty = cy - 2.2;
      tz = cz - hz * 8 + fz * this.flankSign * r;
      const closing = dist > flank + 8;
      maxSpd = cfg.cruiseSpeed * (closing ? 0.95 : 0.58);
      force = cfg.maxForce * (closing ? 1 : 0.7);
      arriveR = 12;
      this.thrust = closing ? 0.62 : 0.4;
    } else {
      const r = 46 + 8 * Math.sin(this.circleA * 0.3);
      const wx = Math.cos(this.wanderTheta) * 7;
      const wz = Math.sin(this.wanderTheta) * 7;
      tx = cx + hx * 14 + fx * Math.cos(this.circleA) * r + wx;
      ty = cy - 1.2;
      tz = cz + hz * 14 + fz * Math.sin(this.circleA) * r + wz;
      maxSpd = cfg.cruiseSpeed * (dist > 75 ? 0.9 : 0.7);
      force = cfg.maxForce * 0.8;
      arriveR = 18;
      this.thrust = dist > 75 ? 0.6 : 0.38;
    }

    const tGround = seafloorHeight(tx, tz);
    ty = Math.min(ty, cfg.minDepth - 0.4);
    ty = Math.max(ty, tGround + cfg.floorClearance + 1.2);
    if (tGround > -20) {
      const sl = seafloorSlope(tx, tz);
      tx -= sl.x * 28;
      tz -= sl.z * 28;
    }
    tz = Math.min(tz, CONFIG.beach.shoreZ - 36);

    this.speedCap = maxSpd;

    const follow = 1 - Math.exp(-dt * (this.aiMode === "strike" ? 7 : 2.15));
    this.seekX += (tx - this.seekX) * follow;
    this.seekY += (ty - this.seekY) * follow;
    this.seekZ += (tz - this.seekZ) * follow;

    const des = this._desired(
      this.seekX,
      this.seekY,
      this.seekZ,
      maxSpd,
      arriveR
    );
    this._steer(des.x, des.y, des.z, force, dt);
  }

  _nextMode(school, dist, holdR) {
    if (this.aiMode === "recover") {
      this.aiMode = "patrol";
      this.aiT = 5 + Math.random() * 4;
      this._nextHunt(school);
      this.flankSign *= -1;
    } else if (this.aiMode === "patrol" && dist < 62 && school.count > 8) {
      this.aiMode = "stalk";
      this.aiT = 7 + Math.random() * 4;
    } else if (this.aiMode === "stalk") {
      if (dist < holdR + 20 && school.count > 8) {
        this.aiMode = "strike";
        this.aiT = 1.45;
        this.startLunge();
      } else {
        this.aiT = 2.4;
      }
    } else if (this.aiMode === "strike") {
      this.aiMode = "recover";
      this.aiT = 6 + Math.random() * 3;
    } else {
      this.aiMode = "patrol";
      this.aiT = 5 + Math.random() * 3;
    }
  }

  _nextHunt(school) {
    for (let k = 1; k <= school.maxSchools; k++) {
      const idx = (this.huntIndex + k) % school.maxSchools;
      if (school.schoolN[idx] > 40) {
        this.huntIndex = idx;
        return;
      }
    }
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
    const desiredPitch = Math.max(-0.48, Math.min(0.52, -Math.atan2(this.vy, horiz)));
    let dyaw = desiredYaw - this.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    const k = 1 - Math.exp(-dt * cfg.turnSmooth);
    this.yaw += dyaw * k;
    this.yawRate = dyaw / Math.max(dt, 1 / 120);
    this.pitch += (desiredPitch - this.pitch) * (1 - Math.exp(-dt * 3.3));
    const bank = Math.max(-0.4, Math.min(0.4, -this.yawRate * 0.16));
    this.roll += (bank - this.roll) * (1 - Math.exp(-dt * 3.6));
  }
}
