import * as THREE from "three";
import { CONFIG } from "./config.js";
import { School } from "./simulation/school.js";
import { spawnSharks, resetSharks, focusShark, createShark } from "./simulation/shark.js";
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
import { createInput } from "./input.js";
import { CAM, cameraHint, createCameraRig } from "./camera.js";
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

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.35, 1800);

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
const sharks = spawnSharks(CONFIG.shark.count, school);
const shark = sharks[0];

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

window.__sim = { school, shark, sharks, plankton, rays, camera, fishMesh, rayMesh, day, outcrops, renderer, getCam: () => camMode, setCam: (m) => applyCamera(m) };

const sharkMeshes = [];
let fearVisible = false;

function bindShark(s) {
  s.onEat = (x, y, z) => {
    s.eaten++;
    s.eatEvents.push({ x, y, z, t: 0 });
    eatFX.burst(x, y, z);
  };
}

function disposeObject(obj) {
  obj.geometry?.dispose();
  if (!obj.material) return;
  const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
  for (const m of mats) m.dispose();
}

function addSharkMesh(s) {
  const mesh = createSharkMesh(uniforms, { tint: s.tint });
  mesh.userData.fear.visible = fearVisible;
  scene.add(mesh);
  sharkMeshes.push(mesh);
  return mesh;
}

function removeLastShark() {
  if (sharks.length <= 1) return;
  sharks.pop();
  const mesh = sharkMeshes.pop();
  if (!mesh) return;
  scene.remove(mesh);
  mesh.traverse(disposeObject);
}

function applySharkCount(n) {
  const next = Math.max(1, Math.min(CONFIG.shark.max, n | 0));
  while (sharks.length > next) removeLastShark();
  while (sharks.length < next) {
    const s = createShark(sharks.length, next, school);
    bindShark(s);
    sharks.push(s);
    addSharkMesh(s);
  }
}

const eatFX = createEatParticles();
scene.add(eatFX.points);
for (const s of sharks) {
  bindShark(s);
  addSharkMesh(s);
}

const _dir = new THREE.Vector3();
const _z = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _m = new THREE.Matrix4();

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

const CAM_NAME = CAMERA_MODES;
let camMode = CAM.CINEMATIC;
const rig = createCameraRig(camera);

const { input, consumePointer } = createInput(canvas);
const hud = createHUD();
hud.setCamera(CAM_NAME[camMode]);
hud.setControl(false);
hud.setHint(cameraHint(camMode, false));

hud.on("fish", (n) => school.setCount(n));
hud.on("sharks", (n) => applySharkCount(n));
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
  fearVisible = on;
  for (const mesh of sharkMeshes) mesh.userData.fear.visible = on;
});
hud.on("reset", () => {
  school.respawn(Number(hud.get("fish")));
  plankton.seed();
  rays.respawn(CONFIG.rays.count);
  resetSharks(sharks, school);
});
hud.on("pilot", (on) => {
  if (on !== shark.controlled) togglePilot(on);
});
hud.on("camera", (mode) => applyCamera(mode));

function camCtx() {
  return {
    school,
    follow: shark.controlled ? shark : focusShark(sharks),
    day,
    outcrops,
    piloting: shark.controlled,
    input,
  };
}

function applyCamera(mode) {
  if (shark.controlled && mode !== CAM.FOLLOW) togglePilot(false);
  camMode = mode;
  rig.setMode(camMode, camCtx());
  hud.setCamera(CAM_NAME[camMode]);
  if (!shark.controlled) hud.setHint(cameraHint(camMode, false));
}

function togglePilot(force) {
  const next = force === undefined ? !shark.controlled : force;
  shark.setControlled(next);
  hud.setControl(next);
  if (next) {
    hud.setOpen(false);
    camMode = CAM.FOLLOW;
    rig.setMode(CAM.FOLLOW, camCtx());
    hud.setCamera(CAM_NAME[camMode]);
  }
  hud.setHint(cameraHint(camMode, next));
}

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.code === "KeyV") {
    if (shark.controlled) togglePilot(false);
    applyCamera(CAM.FREE);
  }
  if (e.code === "Escape" && shark.controlled && !hud.isOpen()) togglePilot(false);
});

rig.setMode(CAM.CINEMATIC, camCtx());

function updateCamera(dt, pointer) {
  rig.update(dt, { ...camCtx(), pointer });
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.__sim.meshes = sharkMeshes;
window.__sim.input = input;
window.__sim.rig = rig;

let last = performance.now();
syncFish();
syncRays();
let raf = 0;
let alive = true;

function frame(now) {
  if (!alive) return;
  try {
    const dt = Math.min((now - last) / 1000, 0.033);
    last = now;
    const t = now * 0.001;

    const pointer = consumePointer();
    if (shark.controlled && (pointer.ox || pointer.oy) && !pointer.panning) {
      input.mouseDx = pointer.ox * 0.0012;
      input.mouseDy = pointer.oy * 0.0012;
    } else {
      input.mouseDx = 0;
      input.mouseDy = 0;
    }

    day.update(dt);
    const tod = day.look;
    tod.simTime = t;
    let lunging = false;
    for (const s of sharks) {
      s.update(dt, input, school, tod, sharks);
      if (s.lunging) lunging = true;
    }
    if (lunging && tod.caustic > 0.05) tod.caustic = Math.min(1.15, tod.caustic + 0.28);
    syncWorldUniforms(uniforms, tod);
    renderer.toneMappingExposure = tod.exposure;

    school.update(dt, sharks, tod, plankton);
    rays.update(dt, sharks, tod);
    plankton.update(dt, tod, t);
    bloom.update();
    syncFish();
    syncRays();
    for (let i = 0; i < sharks.length; i++) syncSharkMesh(sharkMeshes[i], sharks[i]);
    eatFX.update(dt);
    outcrops.update(dt, tod);
    updateCamera(dt, pointer);
    env.update(t, camera, tod);
    hud.tick(dt, school, sharks, day, plankton);

    renderer.render(scene, camera);
  } catch (err) {
    console.error(err);
    window.__frameErr = String(err && err.stack ? err.stack : err);
  }
  raf = requestAnimationFrame(frame);
}

window.__schoolTeardown = () => {
  alive = false;
  cancelAnimationFrame(raf);
  renderer.dispose();
};

raf = requestAnimationFrame(frame);
