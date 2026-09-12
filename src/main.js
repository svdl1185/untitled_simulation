import * as THREE from "three";
import { CONFIG } from "./config.js";
import { School } from "./simulation/school.js";
import { Shark } from "./simulation/shark.js";
import { DayCycle } from "./simulation/day.js";
import { Plankton } from "./simulation/plankton.js";
import { Rays } from "./simulation/rays.js";
import { createFishGeometry, createFishMaterial } from "./render/fish.js";
import { createRayGeometry, createRayMaterial } from "./render/rays.js";
import { createSharkMesh, syncSharkMesh } from "./render/sharkMesh.js";
import { createWaterSurface, createSeafloor, createSandDetail, createThermocline } from "./render/water.js";
import { createOutcrops } from "./render/outcrops.js";
import { createWorldUniforms, syncWorldUniforms } from "./render/caustics.js";
import { createEnvironment, createEatParticles } from "./render/environment.js";
import { createPlanktonMesh } from "./render/plankton.js";
import { seafloorHeight } from "./simulation/obstacles.js";
import { createInput } from "./input.js";
import { createHUD, CAMERA_MODES } from "./ui.js";

if (window.__schoolTeardown) window.__schoolTeardown();

const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x041c24);
scene.fog = new THREE.FogExp2(0x06232c, 0.0058);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.4, 520);

const uniforms = createWorldUniforms();
const day = new DayCycle();
day.sample();
syncWorldUniforms(uniforms, day.look);

const env = createEnvironment(scene, uniforms);
const water = createWaterSurface(uniforms);
const floor = createSeafloor(uniforms);
const sand = createSandDetail(uniforms);
const thermo = createThermocline(uniforms);
const outcrops = createOutcrops(uniforms);
scene.add(water, floor, sand, thermo, outcrops.group);

const school = new School(CONFIG.initialFish);
school.colliders = outcrops.colliders;
school.colliderCount = outcrops.colliderCount;
const plankton = new Plankton();
const bloom = createPlanktonMesh(plankton, uniforms);
scene.add(bloom.mesh);
const rays = new Rays(CONFIG.rays.count);
rays.colliders = outcrops.colliders;
rays.colliderCount = outcrops.colliderCount;
const shark = new Shark();
shark.x = school.centroid.x + 52;
shark.y = school.centroid.y - 2;
shark.z = school.centroid.z + 38;

camera.position.set(
  school.centroid.x + 28,
  school.centroid.y + 11,
  school.centroid.z + 22
);
camera.lookAt(school.centroid.x, school.centroid.y - 4, school.centroid.z);

const fishGeo = createFishGeometry();
const fishMat = createFishMaterial(uniforms);
const fishMesh = new THREE.InstancedMesh(fishGeo, fishMat, CONFIG.maxFish);
fishMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
fishMesh.frustumCulled = false;
fishMesh.geometry.setAttribute(
  "aPhase",
  new THREE.InstancedBufferAttribute(school.phase, 1)
);
scene.add(fishMesh);

const rayGeo = createRayGeometry();
const rayMat = createRayMaterial(uniforms);
const rayMesh = new THREE.InstancedMesh(rayGeo, rayMat, CONFIG.rays.max);
rayMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
rayMesh.frustumCulled = false;
rayMesh.geometry.setAttribute(
  "aPhase",
  new THREE.InstancedBufferAttribute(rays.phase, 1)
);
scene.add(rayMesh);

window.__sim = { school, shark, plankton, rays, camera, fishMesh, rayMesh, day, outcrops, renderer, getCam: () => camMode, setCam: (m) => { camMode = m; hud.setCamera(CAM_NAME[camMode]); } };

const sharkMesh = createSharkMesh(uniforms);
scene.add(sharkMesh);

const eatFX = createEatParticles();
scene.add(eatFX.points);
shark.onEat = (x, y, z) => {
  shark.eaten++;
  shark.eatEvents.push({ x, y, z, t: 0 });
  eatFX.burst(x, y, z);
};

const _dir = new THREE.Vector3();
const _z = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _m = new THREE.Matrix4();
const _look = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function syncFish() {
  const { pos, vel, scale, count } = school;
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    _dir.set(vel[i3], vel[i3 + 1], vel[i3 + 2]);
    const len = _dir.length();
    if (len < 1e-4) _dir.set(0, 0, 1);
    else _dir.multiplyScalar(1 / len);
    if (_dir.dot(_z) < -0.999) _q.set(0, 1, 0, 0);
    else _q.setFromUnitVectors(_z, _dir);
    _p.set(pos[i3], pos[i3 + 1], pos[i3 + 2]);
    const sc = scale[i];
    _s.set(sc, sc, sc);
    _m.compose(_p, _q, _s);
    fishMesh.setMatrixAt(i, _m);
  }
  fishMesh.count = count;
  fishMesh.instanceMatrix.needsUpdate = true;
  fishMesh.geometry.attributes.aPhase.needsUpdate = true;
}

function syncRays() {
  const { pos, vel, scale, count } = rays;
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    _dir.set(vel[i3], vel[i3 + 1], vel[i3 + 2]);
    const len = _dir.length();
    if (len < 1e-4) _dir.set(0, 0, 1);
    else _dir.multiplyScalar(1 / len);
    if (_dir.dot(_z) < -0.999) _q.set(0, 1, 0, 0);
    else _q.setFromUnitVectors(_z, _dir);
    _p.set(pos[i3], pos[i3 + 1], pos[i3 + 2]);
    const sc = scale[i] * CONFIG.rays.length;
    _s.set(sc, sc, sc);
    _m.compose(_p, _q, _s);
    rayMesh.setMatrixAt(i, _m);
  }
  rayMesh.count = count;
  rayMesh.instanceMatrix.needsUpdate = true;
  rayMesh.geometry.attributes.aPhase.needsUpdate = true;
}

const CAM = { CINEMATIC: 0, FOLLOW: 1, ORBIT: 2, SURFACE: 3, FREE: 4 };
const CAM_NAME = CAMERA_MODES;
let camMode = CAM.CINEMATIC;
let orbitTheta = 0.7;
let orbitPhi = 1.42;
let orbitR = 30;
let cineT = 0;
let freeYaw = 0;
let freePitch = -0.25;
const followSpring = new THREE.Vector3().copy(camera.position);
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();

const { input, consumeLook, consumeOrbit, lock, unlock } = createInput(canvas);
const hud = createHUD();
hud.setCamera(CAM_NAME[camMode]);
hud.setControl(false);

hud.on("fish", (n) => school.setCount(n));
hud.on("hour", (h) => {
  day.setHour(h);
  hud.set("liveClock", false);
});
hud.on("liveClock", (on) => {
  day.auto = on;
});
hud.on("storm", (on) => {
  day.stormTarget = on ? 1 : 0;
});
hud.on("fear", (on) => {
  sharkMesh.userData.fear.visible = on;
});
hud.on("reset", () => {
  school.respawn(Number(hud.get("fish")));
  plankton.seed();
  rays.respawn(CONFIG.rays.count);
  shark.eaten = 0;
  shark.energy = 0.72;
});
hud.on("pilot", (on) => {
  if (on !== shark.controlled) togglePilot(on);
});
hud.on("camera", (mode) => applyCamera(mode));

function applyCamera(mode) {
  if (shark.controlled && mode !== CAM.FOLLOW) togglePilot(false);
  camMode = mode;
  if (camMode === CAM.FREE) enterFreeRoam();
  else if (!shark.controlled) unlock();
  hud.setCamera(CAM_NAME[camMode]);
}

function enterFreeRoam() {
  camera.getWorldDirection(_fwd);
  freeYaw = Math.atan2(_fwd.x, _fwd.z);
  freePitch = Math.asin(THREE.MathUtils.clamp(_fwd.y, -1, 1));
}

function togglePilot(force) {
  const next = force === undefined ? !shark.controlled : force;
  shark.setControlled(next);
  hud.setControl(next);
  if (next) {
    hud.setOpen(false);
    camMode = CAM.FOLLOW;
    hud.setCamera(CAM_NAME[camMode]);
    followSpring.set(shark.x, Math.min(shark.y + 4.5, -3), shark.z + 16);
    camera.position.copy(followSpring);
    lock();
  } else {
    unlock();
  }
}

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.code === "KeyV") {
    if (shark.controlled) togglePilot(false);
    applyCamera(CAM.FREE);
  }
  if (e.code === "Escape" && shark.controlled && !hud.isOpen()) togglePilot(false);
});

canvas.addEventListener("click", () => {
  if ((shark.controlled || camMode === CAM.FREE) && !input.pointerLocked) lock();
});

function updateCamera(dt) {
  const orbit = consumeOrbit();
  if (camMode === CAM.FREE && !shark.controlled) {
    const lookX = input.mouseDx + orbit.ox;
    const lookY = input.mouseDy + orbit.oy;
    freeYaw -= lookX * 1.15;
    freePitch -= lookY * 1.15;
    freePitch = THREE.MathUtils.clamp(freePitch, -1.25, 1.25);
    const cp = Math.cos(freePitch);
    _fwd.set(Math.sin(freeYaw) * cp, Math.sin(freePitch), Math.cos(freeYaw) * cp);
    _right.set(Math.cos(freeYaw), 0, -Math.sin(freeYaw));
    let speed = (input.boost ? 62 : 28) * dt;
    if (input.forward) camera.position.addScaledVector(_fwd, speed);
    if (input.back) camera.position.addScaledVector(_fwd, -speed);
    if (input.right) camera.position.addScaledVector(_right, speed);
    if (input.left) camera.position.addScaledVector(_right, -speed);
    if (input.up) camera.position.y += speed;
    if (input.down) camera.position.y -= speed;
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -CONFIG.halfX + 4, CONFIG.halfX - 4);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -CONFIG.halfZ + 4, CONFIG.beach.endZ - 8);
    const ground = seafloorHeight(camera.position.x, camera.position.z);
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, ground + 1.5, 36);
    _look.copy(camera.position).add(_fwd);
    camera.up.copy(_up);
    camera.lookAt(_look);
    return;
  }
  if (camMode === CAM.ORBIT) {
    orbitTheta -= orbit.ox * 1.6;
    orbitPhi -= orbit.oy * 1.6;
    orbitPhi = THREE.MathUtils.clamp(orbitPhi, 0.35, Math.PI - 0.35);
    orbitR *= 1 + orbit.wheel * 0.0012;
    orbitR = THREE.MathUtils.clamp(orbitR, 10, 160);
    const target = school.centroid;
    camera.position.set(
      target.x + Math.sin(orbitTheta) * Math.sin(orbitPhi) * orbitR,
      target.y + Math.cos(orbitPhi) * orbitR,
      target.z + Math.cos(orbitTheta) * Math.sin(orbitPhi) * orbitR
    );
    camera.position.y = Math.max(
      camera.position.y,
      seafloorHeight(camera.position.x, camera.position.z) + 2.2
    );
    _look.set(target.x, target.y, target.z);
    camera.up.copy(_up);
    camera.lookAt(_look);
    return;
  }

  if (camMode === CAM.FOLLOW || shark.controlled) {
    const back = shark.controlled ? 16 : 22;
    const lift = shark.controlled ? 5.2 : 9;
    _camPos.set(
      shark.x - shark.fwdX * back,
      shark.y - shark.fwdY * back * 0.12 + lift,
      shark.z - shark.fwdZ * back
    );
    _camPos.y = Math.max(_camPos.y, seafloorHeight(_camPos.x, _camPos.z) + 3.2);
    _camPos.y = Math.min(_camPos.y, -0.8);
    followSpring.lerp(_camPos, 1 - Math.exp(-dt * (shark.controlled ? 5.5 : 3.6)));
    const camFloor = seafloorHeight(followSpring.x, followSpring.z) + 2.4;
    followSpring.y = THREE.MathUtils.clamp(followSpring.y, camFloor, -0.7);
    camera.position.copy(followSpring);
    _look.set(
      shark.x + shark.fwdX * 8,
      shark.y - 1.8,
      shark.z + shark.fwdZ * 8
    );
    _look.y = Math.min(_look.y, -1.1);
    _look.y = Math.max(_look.y, seafloorHeight(_look.x, _look.z) + 1.6);
    camera.up.copy(_up);
    camera.lookAt(_look);
    return;
  }

  if (camMode === CAM.SURFACE) {
    orbitR *= 1 + orbit.wheel * 0.0012;
    orbitR = THREE.MathUtils.clamp(orbitR, 18, 140);
    const target = school.centroid;
    _camPos.set(target.x + 12, 14 + orbitR * 0.12, target.z + orbitR * 0.55);
    camera.position.lerp(_camPos, 1 - Math.exp(-dt * 1.8));
    _look.set(target.x, -10, target.z);
    camera.up.copy(_up);
    camera.lookAt(_look);
    return;
  }

  cineT += dt;
  const look = day.look;
  const night = look.night;
  const dawn = look.dawn;
  const dusk = look.dusk;
  let radius = 36 + Math.sin(cineT * 0.13) * 8;
  let y = school.centroid.y + 9;
  let tx = school.centroid.x;
  let ty = school.centroid.y - 2;
  let tz = school.centroid.z;
  if (night > 0.55) {
    radius = 20 + Math.sin(cineT * 0.2) * 4;
    y = school.centroid.y + 5.5;
  } else if (dusk > 0.45) {
    radius = 28;
    tx = shark.x;
    ty = shark.y - 1;
    tz = shark.z;
    y = Math.min(shark.y + 3.5, -4);
  } else if (dawn > 0.45) {
    radius = 42;
    y = Math.min(school.centroid.y + 12, -3.2);
    ty = school.centroid.y + 1;
  } else {
    const site = outcrops.sites[(cineT * 0.08) % outcrops.sites.length | 0];
    radius = 32 + Math.sin(cineT * 0.13) * 6;
    y = school.centroid.y + 9;
    tx = THREE.MathUtils.lerp(school.centroid.x, site.x, 0.18);
    tz = THREE.MathUtils.lerp(school.centroid.z, site.z, 0.18);
  }
  y = Math.min(y, -2.8);
  const theta = cineT * (night > 0.55 ? 0.05 : 0.09);
  _camPos.set(tx + Math.cos(theta) * radius, y, tz + Math.sin(theta) * radius);
  _camPos.y = Math.max(_camPos.y, seafloorHeight(_camPos.x, _camPos.z) + 2.4);
  camera.position.lerp(_camPos, 1 - Math.exp(-dt * (night > 0.55 ? 1.6 : 2.4)));
  camera.position.y = Math.max(
    camera.position.y,
    seafloorHeight(camera.position.x, camera.position.z) + 2.2
  );
  _look.set(tx, ty, tz);
  _look.y = Math.max(_look.y, seafloorHeight(_look.x, _look.z) + 1.5);
  camera.lookAt(_look);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let last = performance.now();
syncFish();
syncRays();
let raf = 0;

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;
  const t = now * 0.001;

  const look = consumeLook();
  input.mouseDx = look.mx;
  input.mouseDy = look.my;

  day.update(dt);
  const tod = day.look;
  tod.simTime = t;
  if (shark.lunging && tod.caustic > 0.05) tod.caustic = Math.min(1.15, tod.caustic + 0.28);
  syncWorldUniforms(uniforms, tod);
  renderer.toneMappingExposure = tod.exposure;

  shark.update(dt, input, school, tod);
  school.update(dt, shark, tod, plankton);
  rays.update(dt, shark, tod);
  plankton.update(dt, tod, t);
  bloom.update();
  syncFish();
  syncRays();
  syncSharkMesh(sharkMesh, shark, uniforms);
  eatFX.update(dt);
  outcrops.update(dt, tod);
  updateCamera(dt);
  env.update(t, camera, tod);
  hud.tick(dt, school, shark, day, plankton);

  renderer.render(scene, camera);
  raf = requestAnimationFrame(frame);
}

window.__schoolTeardown = () => {
  cancelAnimationFrame(raf);
  renderer.dispose();
};

raf = requestAnimationFrame(frame);
