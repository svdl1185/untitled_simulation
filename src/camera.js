import * as THREE from "three";
import { CONFIG, worldMaxZ } from "./config.js";
import { seafloorHeight } from "./simulation/obstacles.js";

export const CAM = { CINEMATIC: 0, FOLLOW: 1, ORBIT: 2, SURFACE: 3, FREE: 4 };

export const FOLLOW_CAMERAS = [
  { name: "Chase", mode: CAM.FOLLOW },
  { name: "Orbit", mode: CAM.ORBIT },
  { name: "Cinematic", mode: CAM.CINEMATIC },
  { name: "Surface", mode: CAM.SURFACE },
];

export const CAMERA_MODES = FOLLOW_CAMERAS.map((c) => c.name);

const ORBIT_SENS = 0.0058;
const PAN_SENS = 0.0024;
const ZOOM_SENS = 0.0017;
const PHI_MIN = 0.1;
const PHI_MAX = Math.PI - 0.12;

export function followCameraIndex(mode) {
  const i = FOLLOW_CAMERAS.findIndex((c) => c.mode === mode);
  return i < 0 ? 0 : i;
}

export function cameraHint(mode, piloting, following = false) {
  if (piloting) {
    return "Drag to look · Scroll zoom · WASD thrust · E/Q rise/dive · Shift boost · Space lunge · Esc release";
  }
  if (mode === CAM.FREE || !following) {
    return "Click an animal · Drag to look · WASD fly · E/Q rise/dive · G depth zone · Scroll dolly · I census";
  }
  return "C camera · N next · Drag orbit · Scroll zoom · V free roam";
}

function cameraSpan() {
  return Math.hypot(CONFIG.halfX * 2, CONFIG.halfZ * 2, Math.abs(CONFIG.floorY) + 80);
}

export function createCameraRig(camera) {
  function applyLens() {
    const span = cameraSpan();
    camera.near = span > 3500 ? 1.2 : 0.35;
    camera.far = Math.max(2400, span * 1.25);
    camera.updateProjectionMatrix();
  }
  applyLens();

  const target = new THREE.Vector3();
  const pan = new THREE.Vector3();
  const _fwd = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);
  const _look = new THREE.Vector3();
  const _pos = new THREE.Vector3();
  const _offset = new THREE.Vector3();

  let mode = -1;
  let theta = 0.72;
  let phi = 1.18;
  let radius = 48;
  let radiusWant = 48;
  let freeYaw = 0;
  let freePitch = -0.22;
  let cineT = 0;
  let userHold = 0;
  let radiusUser = false;

  function rangeFor(m, piloting) {
    if (piloting) return [12, 240];
    if (m === CAM.FOLLOW) return [4, 280];
    if (m === CAM.SURFACE) return [20, 720];
    if (m === CAM.FREE) return [4, 780];
    return [12, 640];
  }

  function applyZoom(wheel, m, piloting) {
    if (!wheel) return;
    const [min, max] = rangeFor(m, piloting);
    radiusWant *= Math.exp(wheel * ZOOM_SENS);
    radiusWant = THREE.MathUtils.clamp(radiusWant, min, max);
    radiusUser = true;
  }

  function orbitBy(dx, dy, phiMin = PHI_MIN, phiMax = PHI_MAX) {
    if (!dx && !dy) return false;
    theta -= dx * ORBIT_SENS;
    phi = THREE.MathUtils.clamp(phi - dy * ORBIT_SENS, phiMin, phiMax);
    userHold = 8;
    return true;
  }

  function panBy(dx, dy) {
    if (!dx && !dy) return false;
    const scale = Math.max(14, radius) * PAN_SENS;
    _fwd.set(Math.sin(theta), 0, Math.cos(theta));
    _right.set(_fwd.z, 0, -_fwd.x);
    pan.addScaledVector(_right, -dx * scale);
    const along = Math.sin(phi);
    pan.addScaledVector(_fwd, dy * scale * along);
    pan.y += dy * scale * Math.cos(phi);
    pan.x = THREE.MathUtils.clamp(pan.x, -CONFIG.halfX * 0.85, CONFIG.halfX * 0.85);
    pan.z = THREE.MathUtils.clamp(pan.z, -CONFIG.halfZ * 0.85, worldMaxZ() * 0.7);
    pan.y = THREE.MathUtils.clamp(pan.y, -36, 28);
    userHold = 8;
    return true;
  }

  function spherical(out, r, th, ph) {
    const sp = Math.sin(ph);
    out.set(Math.sin(th) * sp * r, Math.cos(ph) * r, Math.cos(th) * sp * r);
  }

  function clampCam(pos) {
    pos.x = THREE.MathUtils.clamp(pos.x, -CONFIG.halfX + 2, CONFIG.halfX - 2);
    pos.z = THREE.MathUtils.clamp(pos.z, -CONFIG.halfZ + 2, worldMaxZ() - 6);
    pos.y = Math.max(pos.y, seafloorHeight(pos.x, pos.z) + 1.6);
    pos.y = Math.min(pos.y, 170);
  }

  function placeOrbit() {
    spherical(_offset, radius, theta, phi);
    _pos.copy(target).add(pan).add(_offset);
    clampCam(_pos);
    _look.copy(target).add(pan);
    _look.y = Math.max(_look.y, seafloorHeight(_look.x, _look.z) + 0.8);
    camera.position.copy(_pos);
    camera.up.copy(_up);
    camera.lookAt(_look);
  }

  function captureAround(tx, ty, tz) {
    target.set(tx, ty, tz);
    const dx = camera.position.x - tx;
    const dy = camera.position.y - ty;
    const dz = camera.position.z - tz;
    const r = Math.max(16, Math.hypot(dx, dy, dz));
    radius = radiusWant = r;
    theta = Math.atan2(dx, dz);
    phi = Math.acos(THREE.MathUtils.clamp(dy / r, -1, 1));
    phi = THREE.MathUtils.clamp(phi, PHI_MIN, PHI_MAX);
  }

  function enterFree() {
    camera.getWorldDirection(_fwd);
    freeYaw = Math.atan2(_fwd.x, _fwd.z);
    freePitch = Math.asin(THREE.MathUtils.clamp(_fwd.y, -1, 1));
  }

  function behindHeading(follow) {
    return Math.atan2(-follow.fwdX, -follow.fwdZ);
  }

  function setExtents() {
    applyLens();
  }

  function jumpToY(y) {
    camera.position.y = y;
    clampCam(camera.position);
  }

  function setMode(next, ctx) {
    const prev = mode;
    mode = next;
    if (next === prev && prev !== -1) return;
    userHold = 0;
    radiusUser = false;
    pan.set(0, 0, 0);
    const school = ctx.school;
    const follow = ctx.follow;
    const aim = follow || ctx.schoolTarget || school.centroid;
    if (next === CAM.FREE) {
      enterFree();
      return;
    }
    if (next === CAM.FOLLOW && follow) {
      captureAround(follow.x, follow.y + 1.4, follow.z);
      theta = behindHeading(follow);
      radiusWant = radius = follow.camRadius || 28;
      phi = 1.28;
      return;
    }
    if (next === CAM.SURFACE) {
      captureAround(aim.x, aim.y, aim.z);
      radiusWant = radius = 110;
      phi = 0.48;
      return;
    }
    if (next === CAM.ORBIT) {
      captureAround(aim.x, aim.y, aim.z);
      radiusWant = radius = Math.max(42, radius);
      phi = THREE.MathUtils.clamp(phi, 0.35, 1.55);
      return;
    }
    captureAround(aim.x, aim.y, aim.z);
  }

  function updateFree(dt, input, pointer) {
    if (pointer.ox || pointer.oy) {
      freeYaw -= pointer.ox * ORBIT_SENS;
      freePitch -= pointer.oy * ORBIT_SENS;
      freePitch = THREE.MathUtils.clamp(freePitch, -1.32, 1.32);
    }
    const cp = Math.cos(freePitch);
    _fwd.set(Math.sin(freeYaw) * cp, Math.sin(freePitch), Math.cos(freeYaw) * cp);
    _right.set(-Math.cos(freeYaw), 0, Math.sin(freeYaw));
    if (pointer.px || pointer.py) {
      const scale = 0.085;
      camera.position.addScaledVector(_right, -pointer.px * scale);
      camera.position.y += pointer.py * scale;
    }
    if (pointer.wheel) {
      camera.position.addScaledVector(_fwd, -pointer.wheel * 0.055);
    }
    let speed = (input.boost ? 92 : 42) * dt * Math.max(1, Math.sqrt(CONFIG.halfX / 240));
    const vSpeed = (input.boost ? 620 : 260) * dt * Math.max(1, Math.sqrt(Math.abs(CONFIG.floorY) / 110));
    if (input.forward) camera.position.addScaledVector(_fwd, speed);
    if (input.back) camera.position.addScaledVector(_fwd, -speed);
    if (input.right) camera.position.addScaledVector(_right, speed);
    if (input.left) camera.position.addScaledVector(_right, -speed);
    if (input.up) camera.position.y += vSpeed;
    if (input.down) camera.position.y -= vSpeed;
    clampCam(camera.position);
    _look.copy(camera.position).add(_fwd);
    camera.up.copy(_up);
    camera.lookAt(_look);
  }

  function cinematicAim(dt, ctx) {
    const { school, schoolTarget, follow, day, outcrops } = ctx;
    cineT += dt;
    const look = day.look;
    const night = look.night;
    const dawn = look.dawn;
    const pack = follow || schoolTarget || school.centroid;
    let tx = pack.x;
    let ty = pack.y - 1.5;
    let tz = pack.z;
    let wantR = 40 + Math.sin(cineT * 0.13) * 8;
    let wantPhi = 1.22;
    let spin = 0.09;
    if (night > 0.55) {
      wantR = 22 + Math.sin(cineT * 0.2) * 4;
      wantPhi = 1.32;
      ty = pack.y - 0.8;
      spin = 0.05;
    } else if (dawn > 0.45) {
      wantR = 48;
      ty = pack.y + 1;
      wantPhi = 1.05;
    } else if (outcrops?.sites?.length) {
      const site = outcrops.sites[(cineT * 0.08) % outcrops.sites.length | 0];
      wantR = 36 + Math.sin(cineT * 0.13) * 6;
      tx = THREE.MathUtils.lerp(pack.x, site.x, 0.18);
      tz = THREE.MathUtils.lerp(pack.z, site.z, 0.18);
    }
    const air = THREE.MathUtils.smoothstep(70, 220, radiusWant);
    wantPhi = THREE.MathUtils.lerp(wantPhi, 0.52, air);
    return { tx, ty, tz, wantR, wantPhi, spin };
  }

  function update(dt, ctx) {
    const { input, pointer, school, follow, piloting } = ctx;
    const m = piloting ? CAM.FOLLOW : mode;
    userHold = Math.max(0, userHold - dt);

    if (m === CAM.FREE && !piloting) {
      updateFree(dt, input, pointer);
      return;
    }

    const phiMin = m === CAM.SURFACE ? 0.16 : PHI_MIN;
    const phiMax = m === CAM.SURFACE ? 0.98 : PHI_MAX;
    if (!piloting) {
      orbitBy(pointer.ox, pointer.oy, phiMin, phiMax);
      panBy(pointer.px, pointer.py);
    }
    applyZoom(pointer.wheel, m, piloting);

    const [zMin, zMax] = rangeFor(m, piloting);
    radiusWant = THREE.MathUtils.clamp(radiusWant, zMin, zMax);
    radius += (radiusWant - radius) * (1 - Math.exp(-dt * 10));

    if (m === CAM.CINEMATIC) {
      const aim = cinematicAim(dt, ctx);
      const followAmt = 1 - Math.exp(-dt * (userHold > 0 ? 1.1 : 2.2));
      target.x += (aim.tx - target.x) * followAmt;
      target.y += (aim.ty - target.y) * followAmt;
      target.z += (aim.tz - target.z) * followAmt;
      if (userHold <= 0) {
        theta += dt * aim.spin;
        phi += (aim.wantPhi - phi) * (1 - Math.exp(-dt * 1.4));
        if (!radiusUser) radiusWant += (aim.wantR - radiusWant) * (1 - Math.exp(-dt * 1.1));
      }
      placeOrbit();
      return;
    }

    if (m === CAM.FOLLOW && follow) {
      const followAmt = 1 - Math.exp(-dt * (piloting ? 6.2 : 3.8));
      target.x += (follow.x - target.x) * followAmt;
      target.y += (follow.y + (piloting ? 1.1 : 1.8) - target.y) * followAmt;
      target.z += (follow.z - target.z) * followAmt;
      if (piloting) {
        const behind = behindHeading(follow);
        let d = behind - theta;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        theta += d * (1 - Math.exp(-dt * 5.2));
        const wantPhi = THREE.MathUtils.clamp(1.22 - follow.fwdY * 0.35, phiMin, phiMax);
        phi += (wantPhi - phi) * (1 - Math.exp(-dt * 3.2));
      }
      placeOrbit();
      return;
    }

    const aim = follow || ctx.schoolTarget || school.centroid;
    const followAmt = 1 - Math.exp(-dt * 2.4);
    target.x += (aim.x - target.x) * followAmt;
    target.y += (aim.y - target.y) * followAmt;
    target.z += (aim.z - target.z) * followAmt;
    if (m === CAM.SURFACE && userHold <= 0) {
      phi += (0.46 - phi) * (1 - Math.exp(-dt * 1.2));
    }
    placeOrbit();
  }

  return {
    CAM,
    get mode() {
      return mode;
    },
    setMode,
    setExtents,
    jumpToY,
    update,
    enterFree,
    get radius() {
      return radius;
    },
    get theta() {
      return theta;
    },
    get phi() {
      return phi;
    },
  };
}
