import * as THREE from "three";
import { CONFIG, anySchoolPresent, columnZones, faunaPresent, openPhoticY } from "./config.js";
import { SPECIES, VEHICLE_IDS, vehicleCfg } from "./world/fauna.js";
import { School } from "./simulation/school.js";
import { spawnPredators, resetSharks, createShark, tryBreed } from "./simulation/shark.js";
import { DayCycle } from "./simulation/day.js";
import { Plankton } from "./simulation/plankton.js";
import { createFishGeometry, createFishMaterial } from "./render/fish.js";
import { createSharkMesh, syncSharkMesh } from "./render/sharkMesh.js";
import { createWaterSurface, createSeafloor, createSandDetail, createThermocline } from "./render/water.js";
import { createOutcrops } from "./render/outcrops.js";
import { createWorldUniforms, syncWorldUniforms } from "./render/caustics.js";
import { createEnvironment, createEatParticles, createBlowParticles } from "./render/environment.js";
import { createPlanktonMesh } from "./render/plankton.js";
import { samplePAR, visualClarity } from "./simulation/light.js";
import { bindCellTemperature, sampleTemp } from "./simulation/temperature.js";
import { bindCellOxygen, sampleO2 } from "./simulation/oxygen.js";
import { bindCellIce } from "./simulation/ice.js";
import { createInput } from "./input.js";
import { CAM, cameraHint, createCameraRig, CAMERA_MODES, FOLLOW_CAMERAS, followCameraIndex } from "./camera.js";
import { createHUD } from "./ui.js";
import { getLocation, sharkCard, herringCard, schoolCard, censusList } from "./species.js";
import { seafloorHeight, findWaterAtDepth } from "./simulation/obstacles.js";
import { applyPatch, applyPresence, makeBootPatch, getActivePatch } from "./world/patch.js";
import { WorldStream } from "./world/stream.js";
import { loadPatchById } from "./world/atlas.js";
import { createOceanMap } from "./world/map.js";
import { demoById, makeDemoPatch, stampLoadedPatch } from "./world/demos.js";
import { stationBrief } from "./world/station.js";

if (window.__schoolTeardown) window.__schoolTeardown();

applyPatch(makeBootPatch());

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

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.35, 2400);

const uniforms = createWorldUniforms();
const day = new DayCycle();
day.sample();
syncWorldUniforms(uniforms, day.look);

const env = createEnvironment(scene, uniforms);
let water = createWaterSurface(uniforms);
let floor = createSeafloor(uniforms);
let sand = createSandDetail(uniforms);
let thermo = createThermocline(uniforms);
let outcrops = createOutcrops(uniforms);
scene.add(water, floor, sand, thermo, outcrops.group);

let school = new School(0);
school.colliders = outcrops.colliders;
school.colliderCount = outcrops.colliderCount;
let plankton = new Plankton();
school.clipToBloom(plankton);
let bloom = createPlanktonMesh(plankton, uniforms);
scene.add(bloom.mesh);
let sharks = spawnPredators(school);
let shark = sharks[0];

camera.position.set(
  school.centroid.x + 28,
  school.centroid.y + 11,
  school.centroid.z + 22
);
camera.lookAt(school.centroid.x, school.centroid.y - 4, school.centroid.z);

const fishLayers = [];

function rebuildFishLayers() {
  while (fishLayers.length) {
    const layer = fishLayers.pop();
    disposeTree(layer.mesh);
  }
  for (const t of school.taxa) {
    const geo = createFishGeometry(t.id);
    const mat = createFishMaterial(uniforms, t.id);
    const mesh = new THREE.InstancedMesh(geo, mat, CONFIG.maxFish);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    const phase = new Float32Array(CONFIG.maxFish);
    const phaseAttr = new THREE.InstancedBufferAttribute(phase, 1);
    mesh.geometry.setAttribute("aPhase", phaseAttr);
    scene.add(mesh);
    fishLayers.push({ id: t.id, mesh, phase, phaseAttr, shape: SPECIES[t.id]?.look?.shape || "fish" });
  }
}

rebuildFishLayers();

window.__sim = { school, shark, sharks, plankton, camera, fishLayers, day, outcrops, renderer, getCam: () => camMode, setCam: (m) => applyCamera(m) };

const sharkMeshes = [];
let fearVisible = false;

function bindShark(s) {
  s.onEat = (x, y, z) => {
    s.eaten++;
    s.eatEvents.push({ x, y, z, t: 0 });
    eatFX.burst(x, y, z);
  };
  s.onBlow = (x, y, z, kind, scale, dir) => blowFX.puff(x, y, z, kind, scale, dir);
}

function disposeObject(obj) {
  obj.geometry?.dispose();
  if (!obj.material) return;
  const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
  for (const m of mats) {
    m.map?.dispose?.();
    m.uniforms?.uMap?.value?.dispose?.();
    m.dispose();
  }
}

function disposeTree(obj) {
  if (!obj) return;
  scene.remove(obj);
  obj.traverse?.(disposeObject);
  if (!obj.traverse) disposeObject(obj);
}

function placeCamera() {
  if (school.count) {
    camera.position.set(
      school.centroid.x + 28,
      school.centroid.y + 11,
      school.centroid.z + 22
    );
    camera.lookAt(school.centroid.x, school.centroid.y - 4, school.centroid.z);
    return;
  }
  camera.position.set(18, -8, 42);
  camera.lookAt(0, CONFIG.thermoY, 0);
}

function rebuildPlace() {
  disposeTree(water);
  disposeTree(floor);
  disposeTree(sand);
  disposeTree(thermo);
  if (outcrops?.group) disposeTree(outcrops.group);
  water = createWaterSurface(uniforms);
  floor = createSeafloor(uniforms);
  sand = createSandDetail(uniforms);
  thermo = createThermocline(uniforms);
  outcrops = createOutcrops(uniforms);
  scene.add(water, floor, sand, thermo, outcrops.group);
}

function rebuildLife() {
  while (sharks.length) removeLastShark();
  const fishN = anySchoolPresent() ? Number(hud?.get("fish") ?? CONFIG.initialFish) : 0;
  school = new School(fishN, { hour: day.look?.hour ?? 12 });
  school.colliders = outcrops.colliders;
  school.colliderCount = outcrops.colliderCount;
  plankton = new Plankton();
  school.clipToBloom(plankton);
  disposeTree(bloom?.mesh);
  bloom = createPlanktonMesh(plankton, uniforms);
  scene.add(bloom.mesh);
  rebuildFishLayers();
  const predCounts = {};
  if (CONFIG.world.lab) {
    for (const id of VEHICLE_IDS) {
      if (!faunaPresent(id)) continue;
      const cfg = vehicleCfg(id);
      predCounts[id] = Math.min(cfg.max ?? 2, Math.max(2, cfg.count || 2));
    }
  } else if (faunaPresent("shark")) {
    predCounts.shark = Number(hud?.get("sharks") ?? CONFIG.shark.count);
  }
  sharks = spawnPredators(school, predCounts);
  shark = sharks[0] || null;
  for (const s of sharks) {
    bindShark(s);
    addSharkMesh(s);
  }
  window.__sim.school = school;
  window.__sim.shark = shark;
  window.__sim.sharks = sharks;
  window.__sim.plankton = plankton;
  window.__sim.outcrops = outcrops;
  window.__sim.patch = getActivePatch();
  window.__sim.fishLayers = fishLayers;
}

function bindWorld() {
  day.latitude = CONFIG.world.lat;
  day.sample();
  syncWorldUniforms(uniforms, day.look);
  rebuildPlace();
  rebuildLife();
  hud.set("turbidity", CONFIG.water.turbidity);
  rig?.setExtents?.();
  syncDepthZones();
  inspect = null;
  tracking = null;
  if (typeof applyCamera === "function") applyCamera(CAM.FREE);
  placeCamera();
}

function addSharkMesh(s) {
  const spec = SPECIES[s.kind]?.vehicle || {};
  const mesh = createSharkMesh(uniforms, {
    tint: s.tint,
    form: spec.mesh || "shark",
    kind: s.kind,
    sex: s.sex,
    swim: spec.swim || "tail",
  });
  mesh.userData.fear.visible = fearVisible;
  scene.add(mesh);
  sharkMeshes.push(mesh);
  return mesh;
}

function removeLastShark() {
  removeSharkAt(sharks.length - 1);
}

function rebindLead() {
  if (!sharks.length) {
    shark = null;
    followSharkIndex = 0;
    return;
  }
  if (!shark || !sharks.includes(shark)) {
    shark = sharks[Math.min(followSharkIndex, sharks.length - 1)] || sharks[0];
  }
  followSharkIndex = Math.max(0, sharks.indexOf(shark));
  for (let i = 0; i < sharks.length; i++) sharks[i].id = i;
}

function removeSharkAt(i) {
  if (i < 0 || i >= sharks.length) return;
  const s = sharks[i];
  if (s.controlled) s.setControlled(false);
  sharks.splice(i, 1);
  const mesh = sharkMeshes.splice(i, 1)[0];
  if (mesh) {
    scene.remove(mesh);
    mesh.traverse(disposeObject);
  }
  rebindLead();
  if (tracking?.kind === "shark") {
    if (!sharks.length) stopFollow();
    else if (tracking.id >= sharks.length) {
      tracking.id = Math.max(0, sharks.length - 1);
      inspect = tracking;
    }
  }
  syncCamHud();
}

function applySharkCount(n) {
  if (!faunaPresent("shark")) n = 0;
  const next = Math.max(0, Math.min(CONFIG.shark.max, n | 0));
  const isShark = (s) => (s.kind || "shark") === "shark";
  while (sharks.filter(isShark).length > next) {
    const i = sharks.findLastIndex(isShark);
    if (i < 0) break;
    removeSharkAt(i);
  }
  while (sharks.filter(isShark).length < next) {
    const s = createShark(sharks.filter(isShark).length, next, school, "shark");
    bindShark(s);
    sharks.push(s);
    addSharkMesh(s);
  }
  rebindLead();
  syncCamHud();
}

const eatFX = createEatParticles();
scene.add(eatFX.points);
const blowFX = createBlowParticles();
scene.add(blowFX.points);
for (const s of sharks) {
  bindShark(s);
  addSharkMesh(s);
}

const _dir = new THREE.Vector3();
const _z = new THREE.Vector3(0, 0, 1);
const _xAxis = new THREE.Vector3(1, 0, 0);
const _q = new THREE.Quaternion();
const _hang = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _m = new THREE.Matrix4();

function syncFish() {
  const { pos, vel, scale, count, taxon } = school;
  const nT = fishLayers.length;
  const used = new Uint32Array(nT);
  for (let i = 0; i < count; i++) {
    const t = taxon[i];
    const layer = fishLayers[t];
    if (!layer) continue;
    const k = used[t]++;
    const i3 = i * 3;
    _dir.set(vel[i3], vel[i3 + 1], vel[i3 + 2]);
    const len = _dir.length();
    if (len < 1e-4) _dir.set(0, 0, 1);
    else _dir.multiplyScalar(1 / len);
    if (_dir.dot(_z) < -0.999) _q.set(0, 1, 0, 0);
    else _q.setFromUnitVectors(_z, _dir);
    if (layer.shape === "krill") {
      _hang.setFromAxisAngle(_xAxis, -0.38);
      _q.multiply(_hang);
    }
    _p.set(pos[i3], pos[i3 + 1], pos[i3 + 2]);
    const bodyLen = school.taxonCfg(i).length || 0.95;
    const sc = scale[i] * (bodyLen / 0.95) * (0.9 + 0.1 * school.energy[i]);
    _s.set(sc, sc, sc);
    _m.compose(_p, _q, _s);
    layer.mesh.setMatrixAt(k, _m);
    layer.phase[k] = school.phase[i];
  }
  for (let t = 0; t < nT; t++) {
    const layer = fishLayers[t];
    layer.mesh.count = used[t];
    layer.mesh.instanceMatrix.needsUpdate = true;
    layer.phaseAttr.needsUpdate = true;
  }
}

function syncPhotophores(look) {
  const dark = 1 - visualClarity(camera.position.y, look);
  for (const layer of fishLayers) {
    const glow = layer.mesh.material.userData.uGlow;
    if (!glow) continue;
    glow.value = 0.12 + 1.65 * dark;
  }
}

const CAM_NAME = CAMERA_MODES;
let camMode = CAM.FREE;
let followKind = "shark";
let followSharkIndex = 0;
let followSchoolId = 0;
let followHerringIndex = 0;
let inspect = null;
let tracking = null;
const herringCam = { x: 0, y: 0, z: 0, fwdX: -1, fwdY: 0, fwdZ: 0, camRadius: 16 };
const schoolCam = { x: 0, y: 0, z: 0, fwdX: 0, fwdY: 0, fwdZ: 1, camRadius: 42 };
const rig = createCameraRig(camera);

const { input, consumePointer } = createInput(canvas);
const hud = createHUD();
hud.setControl(false);
hud.setHint(cameraHint(CAM.FREE, false, false));

const world = new WorldStream();
const oceanMap = createOceanMap({
  onEnter: enterCell,
});

let cellEntered = false;

async function enterCell(lat, lon) {
  const patch = await world.enter(lat, lon, loadPatchById);
  applyPatch(patch);
  if (hud.get("fish") > CONFIG.maxFish) hud.set("fish", CONFIG.initialFish);
  bindWorld();
  oceanMap.focus(lat, lon);
  hud.set("oceanMap", false);
  hud.setEntered(true);
  cellEntered = true;
  hud.setDemoState({ activeId: null, loading: false, status: "" });
  hud.setHint(cameraHint(CAM.FREE, false, false));
  return patch;
}

function enterLab() {
  return enterDemo("catalog");
}

const DEMO_OFFSETS = [
  [0, 0],
  [0.12, 0],
  [-0.12, 0],
  [0, 0.12],
  [0, -0.12],
  [0.18, 0.1],
  [-0.18, -0.1],
];

async function loadDemoAtlas(demo) {
  let last = null;
  for (const [dlat, dlon] of DEMO_OFFSETS) {
    try {
      return await world.enter(demo.lat + dlat, demo.lon + dlon, loadPatchById);
    } catch (err) {
      last = err;
    }
  }
  throw last || new Error("No water cell at that site.");
}

async function enterDemo(id, presence) {
  const demo = demoById(id);
  if (!demo) return null;
  hud.setDemoState({ loading: true, status: `Loading ${demo.title}…` });
  hud.setHint(`Loading ${demo.title}…`);
  let patch;
  let note = "";
  try {
    if (demo.kind === "lab") {
      patch = makeDemoPatch(demo, presence);
    } else {
      try {
        patch = await loadDemoAtlas(demo);
        stampLoadedPatch(patch, demo);
        if (presence) patch.presence = presence;
      } catch (err) {
        patch = makeDemoPatch(demo, presence);
        note = err?.message || "Atlas did not bind this cell; using a synthetic floor.";
      }
    }
    applyPatch(patch);
    if (presence) applyPresence(presence, { honorFloor: !patch.lab });
    if (hud.get("fish") > CONFIG.maxFish) hud.set("fish", CONFIG.initialFish);
    else hud.set("fish", CONFIG.initialFish);
    bindWorld();
    if (Number.isFinite(patch.originLat)) oceanMap.focus(patch.originLat, patch.originLon);
    hud.set("oceanMap", false);
    hud.setEntered(true);
    cellEntered = true;
    hud.setHint(cameraHint(CAM.FREE, false, false));
    if (!note && patch.synthetic && demo.kind !== "lab") {
      note = "Synthetic floor — atlas did not bind this cell.";
    }
    hud.setDemoState({ activeId: demo.id, loading: false, status: note });
    return patch;
  } catch (err) {
    hud.setDemoState({ loading: false, status: err?.message || "Could not open that cell." });
    hud.setHint("Cells: that kilometre did not load");
    throw err;
  }
}

function applySandbox(presence) {
  applyPresence(presence, { honorFloor: !CONFIG.world.lab });
  if (anySchoolPresent()) {
    const n = Number(hud.get("fish") ?? CONFIG.initialFish);
    hud.set("fish", n > 0 ? n : CONFIG.initialFish);
  } else {
    hud.set("fish", 0);
  }
  rebuildLife();
  inspect = null;
  tracking = null;
  if (typeof applyCamera === "function") applyCamera(CAM.FREE);
}

window.__sim.enter = enterCell;
window.__sim.lab = enterLab;
window.__sim.demo = enterDemo;
window.__sim.map = oceanMap;

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
  school.respawn(anySchoolPresent() ? Number(hud.get("fish")) : 0, day.look.hour);
  plankton.seed();
  school.clipToBloom(plankton);
  resetSharks(sharks, school);
  day.dayIndex = 0;
});
hud.on("pilot", (on) => {
  if (shark && on !== shark.controlled) togglePilot(on);
});
hud.on("camera", (index) => {
  const spec = FOLLOW_CAMERAS[index];
  if (spec && isFollowing()) applyCamera(spec.mode);
});
hud.on("nextTarget", () => cycleTarget());
hud.on("followSubject", () => followShown());
hud.on("depthZone", (index) => jumpDepthZone(index));
hud.on("jumpY", (y) => jumpToDepth(y));
hud.on("oceanMap", (on) => {
  if (!on && !cellEntered) {
    hud.set("oceanMap", true);
    oceanMap.setOpen(true);
    return;
  }
  oceanMap.setOpen(on);
});
hud.on("demo", ({ id, presence } = {}) => {
  enterDemo(id, presence);
  oceanMap.setOpen(false);
});
hud.on("demoFauna", ({ presence } = {}) => {
  if (!cellEntered) return;
  applySandbox(presence);
});
hud.on("focusSpecies", (id) => focusSpecies(id));
hud.on("dismissSubject", () => {
  inspect = null;
});
hud.on("currents", (on) => oceanMap.setCurrents(on));
hud.on("lamp", (on) => {
  env.lampOn = !!on;
});
hud.on("turbidity", (n) => {
  CONFIG.water.turbidity = Number(n);
});
hud.on("sstAnomaly", (n) => {
  CONFIG.water.sstAnomaly = Number(n);
  bindCellTemperature(day.storm);
  bindCellOxygen();
});
hud.on("o2Anomaly", (n) => {
  CONFIG.water.o2Anomaly = Number(n);
  bindCellOxygen();
});
hud.on("iceAnomaly", (n) => {
  CONFIG.water.iceAnomaly = Number(n);
  bindCellIce();
});

function syncDepthZones() {
  if (!hud?.setSelectOptions) return;
  const zones = columnZones(day.look.preferredDepth);
  const labels = zones.map((z) => z.label);
  if (!labels.length) return;
  let idx = Number(hud.get("depthZone") ?? 1);
  if (idx >= labels.length) idx = Math.max(0, labels.length - 1);
  const epi = zones.findIndex((z) => z.id === "sunlit");
  if (idx < 0) idx = epi >= 0 ? epi : 0;
  hud.setSelectOptions("depthZone", labels, idx);
}

function jumpDepthZone(index) {
  const zones = columnZones(day.look.preferredDepth);
  if (!zones.length) return;
  const z = zones[Math.max(0, Math.min(zones.length - 1, index | 0))];
  jumpToDepth(z.y);
}

function jumpToDepth(y) {
  if (!Number.isFinite(y)) return;
  if (shark?.controlled) {
    shark.setControlled(false);
    hud.setControl(false);
  }
  applyCamera(CAM.FREE);
  const want = Math.min(-2.2, y);
  const x0 = camera.position.x;
  const z0 = camera.position.z;
  const ground = seafloorHeight(x0, z0);
  let x = x0;
  let z = z0;
  let py = want;
  if (ground + 8 > want) {
    const placed = findWaterAtDepth(x0, z0, want, {
      maxDepth: CONFIG.floorY,
      clearance: 6,
    });
    x = placed.x;
    z = placed.z;
    py = placed.y;
  } else {
    py = Math.max(want, ground + 1.8);
  }
  rig.jumpTo(x, py, z);
  const zones = columnZones(day.look.preferredDepth);
  let best = 0;
  let d = Infinity;
  for (let i = 0; i < zones.length; i++) {
    const n = Math.abs(zones[i].y - py);
    if (n < d) {
      d = n;
      best = i;
    }
  }
  hud.set("depthZone", best);
}

function occupiedSchoolIds() {
  const ids = [];
  for (let s = 0; s < school.maxSchools; s++) {
    if (school.schoolN[s] > 0) ids.push(s);
  }
  return ids;
}

function resolveSchoolId() {
  const ids = occupiedSchoolIds();
  if (!ids.length) {
    followSchoolId = 0;
    return ids;
  }
  if (!ids.includes(followSchoolId)) followSchoolId = ids[0];
  return ids;
}

function herringAsFollow(i) {
  const i3 = i * 3;
  herringCam.x = school.pos[i3];
  herringCam.y = school.pos[i3 + 1];
  herringCam.z = school.pos[i3 + 2];
  const vx = school.vel[i3];
  const vy = school.vel[i3 + 1];
  const vz = school.vel[i3 + 2];
  const len = Math.hypot(vx, vy, vz) || 1;
  herringCam.fwdX = vx / len;
  herringCam.fwdY = vy / len;
  herringCam.fwdZ = vz / len;
  return herringCam;
}

function schoolAsFollow(id) {
  const c = school.centroids[id] || school.centroid;
  schoolCam.x = c.x;
  schoolCam.y = c.y;
  schoolCam.z = c.z;
  const len = Math.hypot(c.vx || 0, c.vz || 0) || 1;
  schoolCam.fwdX = (c.vx || 0) / len;
  schoolCam.fwdY = 0;
  schoolCam.fwdZ = (c.vz || 1) / len;
  return schoolCam;
}

function subjectValid(sub) {
  if (!sub) return false;
  if (sub.kind === "shark") return sub.id >= 0 && sub.id < sharks.length;
  if (sub.kind === "herring") return sub.id >= 0 && sub.id < school.count;
  if (sub.kind === "school") return school.schoolN[sub.id] > 0;
  return false;
}

function sameSubject(a, b) {
  return !!(a && b && a.kind === b.kind && a.id === b.id);
}

function isFollowing() {
  return !!(tracking && subjectValid(tracking)) || !!(shark && shark.controlled);
}

function pinnedFollow() {
  if (shark?.controlled) return shark;
  const sub = subjectValid(tracking) ? tracking : null;
  if (!sub) return null;
  if (sub.kind === "shark") return sharks[sub.id];
  if (sub.kind === "herring") return herringAsFollow(sub.id);
  return schoolAsFollow(sub.id);
}

function pinnedSchool() {
  if (tracking?.kind === "school" && subjectValid(tracking)) {
    return school.centroids[tracking.id] || school.centroid;
  }
  resolveSchoolId();
  return school.centroids[followSchoolId] || school.centroid;
}

function shownSubject() {
  if (subjectValid(inspect)) return inspect;
  inspect = null;
  if (subjectValid(tracking)) return tracking;
  return null;
}

function subjectDetail() {
  if (!isFollowing()) return "";
  const sub = tracking;
  if (sub?.kind === "shark") return `${sub.id + 1}/${sharks.length}`;
  if (sub?.kind === "school") {
    const ids = occupiedSchoolIds();
    return `${Math.max(1, ids.indexOf(sub.id) + 1)}/${Math.max(1, ids.length)}`;
  }
  return "";
}

function cameraLabel() {
  if (shark?.controlled) return "Pilot shark";
  if (!isFollowing()) return "Free roam";
  const name = FOLLOW_CAMERAS[followCameraIndex(camMode)]?.name || CAM_NAME[0];
  const detail = subjectDetail();
  return detail ? `${name} ${detail}` : name;
}

function hudView() {
  const foodCap = plankton.carryingCapacity(school.cap);
  const patch = getActivePatch();
  const loc = getLocation();
  const km = (CONFIG.halfX * 2) / 1000;
  const span = km >= 1.5 ? `${km.toFixed(0)} × ${km.toFixed(0)} km` : `${Math.round(CONFIG.halfX * 2)} m`;
  const census = censusList(school, sharks, plankton);
  const station = stationBrief({
    loc,
    patch,
    hour: day.hour,
    look: day.look,
    storm: day.storm > 0.2 || day.stormTarget > 0.5,
    census,
    sharks,
    floorY: patch?.floorY ?? CONFIG.floorY,
    spanLabel: span,
    sst: day.look.sst ?? sampleTemp(0, -1, 0),
    mixedY: CONFIG.thermoY,
    nutriclineY: plankton.nutriclineY(),
    omzCoreY: CONFIG.water?.omzCoreY ?? null,
    upwell: CONFIG.water?.upwell ?? 0,
    photicY: openPhoticY(),
    o2Cam: sampleO2(0, camera.position.y, 0),
    parPct: samplePAR(camera.position.y, day.look) * 100,
    meanP: plankton.meanP,
    meanZ: plankton.meanZ,
    meanB: plankton.meanB,
    meanI: plankton.meanI,
    forageCount: school.count,
    forageCap: foodCap,
    ice: CONFIG.water?.ice ?? 0,
    iceH: CONFIG.water?.iceH ?? 0,
    iceT: CONFIG.water?.iceT ?? 1,
    cameraLabel: cameraLabel(),
    lat: CONFIG.world.lat,
    lon: CONFIG.world.lon,
  });
  const sub = shownSubject();
  let subject = null;
  const following = sameSubject(sub, tracking) && isFollowing();
  const counts = {};
  for (const row of census) counts[row.id] = row.count;
  const dietCtx = {
    following,
    counts,
    bloom: { p: plankton.meanP, z: plankton.meanZ, b: plankton.meanB },
  };
  if (sub?.kind === "shark") {
    const s = sharks[sub.id];
    if (s) subject = sharkCard(s, dietCtx);
  } else if (sub?.kind === "school") {
    const ids = occupiedSchoolIds();
    subject = schoolCard(school, sub.id, {
      ...dietCtx,
      schoolLabel: `${Math.max(1, ids.indexOf(sub.id) + 1)} of ${Math.max(1, ids.length)}`,
    });
  } else if (sub?.kind === "herring") {
    const ids = occupiedSchoolIds();
    const sid = school.schoolId[sub.id];
    subject = herringCard(school, sub.id, {
      ...dietCtx,
      schoolLabel: `${Math.max(1, ids.indexOf(sid) + 1)} of ${Math.max(1, ids.length)}`,
    });
  }
  if (subject) subject.picked = !!(inspect && sameSubject(sub, inspect));
  const column = {
    surfaceY: CONFIG.surfaceY ?? 0,
    floorY: CONFIG.floorY,
    camY: camera.position.y,
    zones: columnZones(day.look.preferredDepth),
  };
  return { station, subject, day, census, placeName: loc.name || loc.region, column };
}

function hudHit(clientX, clientY) {
  const hit = document.elementFromPoint(clientX, clientY);
  return !!hit?.closest("#hud-notes, .nav-bar, #menu, #hud-column, #pilot-hint");
}

function pickSubject(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  camera.updateMatrixWorld();
  const mx = clientX - rect.left;
  const my = clientY - rect.top;
  const w = rect.width;
  const h = rect.height;

  function screenHit(x, y, z, px) {
    _p.set(x, y, z).project(camera);
    if (_p.z < -1 || _p.z > 1) return Infinity;
    if (_p.x < -1.2 || _p.x > 1.2 || _p.y < -1.2 || _p.y > 1.2) return Infinity;
    const sx = (_p.x * 0.5 + 0.5) * w;
    const sy = (-_p.y * 0.5 + 0.5) * h;
    const d = Math.hypot(sx - mx, sy - my);
    return d <= px ? d : Infinity;
  }

  let bestShark = -1;
  let bestSharkD = Infinity;
  for (let i = 0; i < sharks.length; i++) {
    const s = sharks[i];
    const d = screenHit(s.x, s.y, s.z, 58 * Math.max(0.65, s.scale));
    if (d < bestSharkD) {
      bestSharkD = d;
      bestShark = i;
    }
  }

  const pos = school.pos;
  const scale = school.scale;
  let bestFish = -1;
  let bestFishD = Infinity;
  for (let i = 0; i < school.count; i++) {
    const i3 = i * 3;
    const d = screenHit(pos[i3], pos[i3 + 1], pos[i3 + 2], 22 + scale[i] * 12);
    if (d < bestFishD) {
      bestFishD = d;
      bestFish = i;
    }
  }

  if (bestShark >= 0 && (bestFish < 0 || bestSharkD <= bestFishD + 12)) {
    return { kind: "shark", id: bestShark };
  }
  if (bestFish >= 0) return { kind: "herring", id: bestFish };

  let bestSchool = -1;
  let bestSchoolD = Infinity;
  for (let s = 0; s < school.maxSchools; s++) {
    const n = school.schoolN[s];
    if (!n) continue;
    const c = school.centroids[s];
    const d = screenHit(c.x, c.y, c.z, 70 + Math.sqrt(n) * 1.1);
    if (d < bestSchoolD) {
      bestSchoolD = d;
      bestSchool = s;
    }
  }
  if (bestSchool >= 0) return { kind: "school", id: bestSchool };
  return null;
}

function syncCamHud() {
  const following = isFollowing();
  hud.setCameraLive(following);
  if (following) {
    hud.setCamera(FOLLOW_CAMERAS[followCameraIndex(camMode)]?.name || "Chase");
  }
  if (!shark?.controlled) hud.setHint(cameraHint(camMode, false, following));
}

function camCtx() {
  return {
    school,
    follow: pinnedFollow(),
    schoolTarget: pinnedSchool(),
    day,
    outcrops,
    piloting: !!(shark && shark.controlled),
    input,
  };
}

function applyCamera(mode) {
  if (mode === CAM.FREE) {
    if (shark?.controlled) {
      shark.setControlled(false);
      hud.setControl(false);
    }
    tracking = null;
    camMode = CAM.FREE;
    rig.setMode(CAM.FREE, camCtx());
    syncCamHud();
    return;
  }
  if (shark?.controlled && mode !== CAM.FOLLOW) togglePilot(false);
  camMode = mode;
  rig.setMode(camMode, camCtx());
  syncCamHud();
}

function stopFollow() {
  applyCamera(CAM.FREE);
}

function focusSpecies(id) {
  if (!id) return;
  const spec = SPECIES[id];
  if (!spec) return;
  if (oceanMap.isOpen()) {
    oceanMap.setOpen(false);
    hud.set("oceanMap", false);
  }
  if (spec.agent === "field") {
    jumpToDepth(CONFIG.floorY + 6);
    return;
  }
  if (spec.agent === "vehicle") {
    const i = sharks.findIndex((s) => (s.kind || "shark") === id);
    if (i < 0) return;
    inspect = { kind: "shark", id: i };
    tracking = inspect;
    followKind = "shark";
    followSharkIndex = i;
    applyCamera(CAM.FOLLOW);
    return;
  }
  let taxon = -1;
  for (let t = 0; t < school.taxa.length; t++) {
    if (school.taxa[t].id === id) {
      taxon = t;
      break;
    }
  }
  if (taxon < 0) return;
  for (let s = 0; s < school.maxSchools; s++) {
    if (school.schoolN[s] > 0 && school.anchors[s]?.taxon === taxon) {
      inspect = { kind: "school", id: s };
      tracking = inspect;
      followKind = "school";
      followSchoolId = s;
      applyCamera(CAM.ORBIT);
      return;
    }
  }
  for (let i = 0; i < school.count; i++) {
    if (school.taxon[i] === taxon) {
      inspect = { kind: "herring", id: i };
      tracking = inspect;
      followKind = "herring";
      followHerringIndex = i;
      followSchoolId = school.schoolId[i];
      applyCamera(CAM.FOLLOW);
      return;
    }
  }
}

function followShown() {
  const s = shownSubject();
  if (!s) return;
  if (sameSubject(s, tracking) && isFollowing()) {
    stopFollow();
    inspect = s;
    return;
  }
  if (shark?.controlled && (s.kind !== "shark" || s.id !== sharks.indexOf(shark))) {
    togglePilot(false);
  }
  tracking = { kind: s.kind, id: s.id };
  inspect = tracking;
  followKind = s.kind;
  if (s.kind === "shark") {
    followSharkIndex = s.id;
    applyCamera(CAM.FOLLOW);
    return;
  }
  if (s.kind === "herring") {
    followHerringIndex = s.id;
    followSchoolId = school.schoolId[s.id];
    applyCamera(CAM.FOLLOW);
    return;
  }
  followSchoolId = s.id;
  applyCamera(CAM.ORBIT);
}

function cycleTarget() {
  if (!isFollowing() || shark?.controlled) return;
  if (tracking?.kind === "shark") {
    if (sharks.length < 2) return;
    tracking = { kind: "shark", id: (tracking.id + 1) % sharks.length };
    followSharkIndex = tracking.id;
    inspect = tracking;
    rig.setMode(camMode, camCtx());
  } else if (tracking?.kind === "school") {
    const ids = occupiedSchoolIds();
    if (ids.length < 2) return;
    const next = ids[(ids.indexOf(tracking.id) + 1) % ids.length];
    tracking = { kind: "school", id: next };
    followSchoolId = next;
    inspect = tracking;
    rig.setMode(camMode, camCtx());
  }
  syncCamHud();
}

function togglePilot(force) {
  if (!shark) return;
  const next = force === undefined ? !shark.controlled : force;
  shark.setControlled(next);
  hud.setControl(next);
  if (next) {
    hud.setOpen(false);
    tracking = { kind: "shark", id: Math.max(0, sharks.indexOf(shark)) };
    inspect = tracking;
    followKind = "shark";
    followSharkIndex = tracking.id;
    camMode = CAM.FOLLOW;
    rig.setMode(CAM.FOLLOW, camCtx());
  }
  hud.setHint(cameraHint(camMode, next, isFollowing()));
  syncCamHud();
}

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.code === "Escape" && oceanMap.isOpen()) {
    if (!cellEntered) return;
    oceanMap.setOpen(false);
    hud.set("oceanMap", false);
    return;
  }
  if (e.code === "KeyV") {
    stopFollow();
  }
  if (e.code === "Escape" && !hud.isOpen()) {
    if (shark?.controlled) togglePilot(false);
    else if (isFollowing()) stopFollow();
    else inspect = null;
  }
});

rig.setMode(CAM.FREE, camCtx());
syncCamHud();

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
window.__sim.pick = pickSubject;

let last = performance.now();
syncFish();
let raf = 0;
let alive = true;
window.__alive = true;

function frame(now) {
  window.__ticks = (window.__ticks || 0) + 1;
  if (!alive) return;
  try {
    const dt = Math.min((now - last) / 1000, 0.033);
    last = now;
    const t = now * 0.001;

    const pointer = consumePointer();
    if (oceanMap.isOpen()) {
      hud.tick(dt, hudView());
    } else {
      if (pointer.click && !hudHit(pointer.click.x, pointer.click.y)) {
        inspect = pickSubject(pointer.click.x, pointer.click.y);
      }
      if (tracking?.kind === "herring" && tracking.id >= school.count) stopFollow();
      if (tracking?.kind === "school" && !school.schoolN[tracking.id]) stopFollow();
      if (shark?.controlled && (pointer.ox || pointer.oy) && !pointer.panning) {
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

      school.update(dt, sharks, tod, plankton);
      for (let i = sharks.length - 1; i >= 0; i--) {
        if (!sharks[i].dead) continue;
        plankton.recycle(sharks[i].x, sharks[i].z, sharks[i].cfg?.carcass ?? CONFIG.shark.carcass, sharks[i].y);
        removeSharkAt(i);
      }
      const pup = tryBreed(sharks);
      if (pup) {
        bindShark(pup);
        sharks.push(pup);
        addSharkMesh(pup);
        rebindLead();
      }
      plankton.update(dt, tod, t);
      bloom.update(tod);
      syncFish();
      syncPhotophores(tod);
      for (let i = 0; i < sharks.length; i++) syncSharkMesh(sharkMeshes[i], sharks[i]);
      eatFX.update(dt);
      blowFX.update(dt);
      outcrops.update(dt, tod);
      updateCamera(dt, pointer);
      env.update(t, camera, tod);
      renderer.toneMappingExposure = tod.exposure;
      hud.tick(dt, hudView());

      renderer.render(scene, camera);
    }
  } catch (err) {
    console.error(err);
    window.__frameErr = String(err && err.stack ? err.stack : err);
  }
  raf = requestAnimationFrame(frame);
}

window.__schoolTeardown = () => {
  alive = false;
  window.__alive = false;
  cancelAnimationFrame(raf);
  renderer.dispose();
};

raf = requestAnimationFrame(frame);
window.__sim.step = frame;

bootHome();
window.__booted = true;

function bootHome() {
  hud.set("oceanMap", true);
  oceanMap.setOpen(true);
  hud.setHint("Click water to enter a 1 km cell · Cells picks a named kilometre");
}
