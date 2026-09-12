import * as THREE from "three";
import { CONFIG } from "./config.js";
import { School } from "./simulation/school.js";
import { spawnSharks, resetSharks, createShark } from "./simulation/shark.js";
import { DayCycle } from "./simulation/day.js";
import { Plankton } from "./simulation/plankton.js";
import { createFishGeometry, createFishMaterial } from "./render/fish.js";
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

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.35, 2400);

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

window.__sim = { school, shark, sharks, plankton, camera, fishMesh, day, outcrops, renderer, getCam: () => camMode, setCam: (m) => applyCamera(m) };

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
  if (followSharkIndex >= sharks.length) followSharkIndex = sharks.length - 1;
  if (inspect?.kind === "shark" && inspect.id >= sharks.length) inspect = null;
  syncCamHud();
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
    const sc = scale[i] * (0.9 + 0.1 * school.energy[i]);
    _s.set(sc, sc, sc);
    _m.compose(_p, _q, _s);
    fishMesh.setMatrixAt(i, _m);
  }
  fishMesh.count = count;
  fishMesh.instanceMatrix.needsUpdate = true;
  fishMesh.geometry.attributes.aPhase.needsUpdate = true;
}

const CAM_NAME = CAMERA_MODES;
let camMode = CAM.CINEMATIC;
let followKind = "school";
let followSharkIndex = 0;
let followSchoolId = 0;
let followHerringIndex = 0;
let inspect = null;
const herringCam = { x: 0, y: 0, z: 0, fwdX: -1, fwdY: 0, fwdZ: 0, camRadius: 16 };
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
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
  resetSharks(sharks, school);
});
hud.on("pilot", (on) => {
  if (on !== shark.controlled) togglePilot(on);
});
hud.on("camera", (mode) => {
  if (mode === CAM.FOLLOW) followKind = "shark";
  else if (mode !== CAM.FREE) followKind = "school";
  applyCamera(mode);
});
hud.on("nextTarget", () => cycleTarget());
hud.on("followSubject", () => followShown());

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

function pinnedShark() {
  if (shark.controlled) return shark;
  if (followSharkIndex >= sharks.length) followSharkIndex = Math.max(0, sharks.length - 1);
  return sharks[followSharkIndex];
}

function pinnedSchool() {
  resolveSchoolId();
  return school.centroids[followSchoolId] || school.centroid;
}

function pinnedFollow() {
  if (shark.controlled) return shark;
  if (camMode === CAM.FOLLOW && followKind === "herring") {
    const i = followHerringIndex;
    if (i < school.count) {
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
  }
  return pinnedShark();
}

function sameSubject(a, b) {
  return !!(a && b && a.kind === b.kind && a.id === b.id);
}

function cameraSubject() {
  if (shark.controlled) return { kind: "shark", id: 0 };
  if (camMode === CAM.FREE) return null;
  if (camMode === CAM.FOLLOW) {
    if (followKind === "herring" && followHerringIndex < school.count) {
      return { kind: "herring", id: followHerringIndex };
    }
    return { kind: "shark", id: followSharkIndex };
  }
  resolveSchoolId();
  if (!school.schoolN[followSchoolId]) return null;
  return { kind: "school", id: followSchoolId };
}

function shownSubject() {
  if (inspect) {
    if (inspect.kind === "shark" && inspect.id < sharks.length) return inspect;
    if (inspect.kind === "school" && school.schoolN[inspect.id] > 0) return inspect;
    if (inspect.kind === "herring" && inspect.id < school.count) return inspect;
    inspect = null;
  }
  return cameraSubject();
}

function subjectDetail() {
  if (camMode === CAM.FREE) return "";
  if (camMode === CAM.FOLLOW) {
    if (followKind === "herring") return "";
    return `${followSharkIndex + 1}/${sharks.length}`;
  }
  const ids = resolveSchoolId();
  if (!ids.length) return "";
  return `${ids.indexOf(followSchoolId) + 1}/${ids.length}`;
}

function cameraLabel() {
  if (shark.controlled) return "Pilot shark";
  if (camMode === CAM.FOLLOW && followKind === "herring") return "Follow herring";
  const name = CAM_NAME[camMode] || "";
  const detail = subjectDetail();
  return detail ? `${name} ${detail}` : name;
}

function clockText(hour) {
  const h = Math.floor(((Number(hour) % 24) + 24) % 24);
  const m = Math.floor((Number(hour) % 1) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function depthText(y) {
  return `${Math.max(0, -Number(y)).toFixed(0)} m`;
}

function weatherText() {
  if (day.storm > 0.2 || day.stormTarget > 0.5) return "Storm";
  return "Calm";
}

function sharkState(s) {
  if (s.controlled) return "Pilot";
  const modes = {
    patrol: "AI patrol",
    stalk: "AI stalk",
    strike: "AI strike",
    recover: "AI recover",
  };
  return modes[s.aiMode] || "AI";
}

function sharkSize(s) {
  if (s.scale > 1.12) return "Large";
  if (s.scale < 0.88) return "Small";
  return "Adult";
}

function hudView() {
  // Append another { id, label, value } when a new world or species
  // readout exists. bindStats reuses DOM nodes by id.
  const general = [
    { id: "sky", label: "Sky", value: day.look.name },
    { id: "time", label: "Time", value: clockText(day.hour) },
    { id: "weather", label: "Weather", value: weatherText() },
    { id: "fish", label: "Fish", value: school.count.toLocaleString() },
    { id: "bloom", label: "P / Z", value: `${Math.round((plankton.meanP ?? 0) * 100)} · ${Math.round((plankton.meanZ ?? 0) * 100)}` },
    { id: "schools", label: "Schools", value: String(school.occupied) },
    { id: "camera", label: "Camera", value: cameraLabel() },
  ];
  const sub = shownSubject();
  let subject = null;
  if (sub?.kind === "shark") {
    const s = sharks[sub.id];
    if (s) {
      subject = {
        kindLabel: "Shark",
        title: `${sub.id + 1} of ${sharks.length}`,
        following: sameSubject(sub, cameraSubject()),
        stats: [
          { id: "size", label: "Size", value: sharkSize(s) },
          { id: "hunger", label: "Hunger", value: `${Math.round(s.energy * 100)}%` },
          { id: "eaten", label: "Eaten", value: s.eaten.toLocaleString() },
          { id: "state", label: "State", value: sharkState(s) },
          { id: "depth", label: "Depth", value: depthText(s.y) },
          { id: "speed", label: "Speed", value: `${Math.hypot(s.vx, s.vy, s.vz).toFixed(1)} m/s` },
        ],
      };
    }
  } else if (sub?.kind === "school") {
    const ids = occupiedSchoolIds();
    const n = school.schoolN[sub.id] || 0;
    const c = school.centroids[sub.id];
    const mill = school.anchors[sub.id]?.mill ?? 0;
    subject = {
      kindLabel: "School",
      title: `${Math.max(1, ids.indexOf(sub.id) + 1)} of ${Math.max(1, ids.length)}`,
      following: sameSubject(sub, cameraSubject()),
      stats: [
        { id: "members", label: "Herring", value: n.toLocaleString() },
        { id: "energy", label: "Energy", value: `${Math.round((1 - (school.schoolHunger[sub.id] ?? 0.5)) * 100)}%` },
        { id: "depth", label: "Depth", value: depthText(c?.y ?? 0) },
        { id: "mode", label: "Mode", value: mill > 0.45 ? "Milling" : "Foraging" },
      ],
    };
  } else if (sub?.kind === "herring") {
    const i = sub.id;
    const i3 = i * 3;
    const sid = school.schoolId[i];
    const ids = occupiedSchoolIds();
    const vx = school.vel[i3];
    const vy = school.vel[i3 + 1];
    const vz = school.vel[i3 + 2];
    subject = {
      kindLabel: "Herring",
      title: `School ${Math.max(1, ids.indexOf(sid) + 1)} of ${Math.max(1, ids.length)}`,
      following: sameSubject(sub, cameraSubject()),
      stats: [
        { id: "energy", label: "Energy", value: `${Math.round(school.energy[i] * 100)}%` },
        { id: "depth", label: "Depth", value: depthText(school.pos[i3 + 1]) },
        { id: "speed", label: "Speed", value: `${Math.hypot(vx, vy, vz).toFixed(1)} m/s` },
        { id: "state", label: "State", value: school.alarm[i] > 0.28 ? "Fleeing" : "Schooling" },
      ],
    };
  }
  return { general, subject, day };
}

function pickSubject(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const origin = raycaster.ray.origin;
  const dir = raycaster.ray.direction;

  let bestShark = -1;
  let bestSharkD = Infinity;
  for (let i = 0; i < sharks.length; i++) {
    const s = sharks[i];
    const vx = s.x - origin.x;
    const vy = s.y - origin.y;
    const vz = s.z - origin.z;
    const t = vx * dir.x + vy * dir.y + vz * dir.z;
    if (t < 1 || t > 320) continue;
    const dx = origin.x + dir.x * t - s.x;
    const dy = origin.y + dir.y * t - s.y;
    const dz = origin.z + dir.z * t - s.z;
    const rad = 3.4 * s.scale + t * 0.02;
    if (dx * dx + dy * dy + dz * dz < rad * rad && t < bestSharkD) {
      bestSharkD = t;
      bestShark = i;
    }
  }

  const pos = school.pos;
  const scale = school.scale;
  let bestFish = -1;
  let bestFishD = Infinity;
  for (let i = 0; i < school.count; i++) {
    const i3 = i * 3;
    const vx = pos[i3] - origin.x;
    const vy = pos[i3 + 1] - origin.y;
    const vz = pos[i3 + 2] - origin.z;
    const t = vx * dir.x + vy * dir.y + vz * dir.z;
    if (t < 1.5 || t > 260) continue;
    const dx = origin.x + dir.x * t - pos[i3];
    const dy = origin.y + dir.y * t - pos[i3 + 1];
    const dz = origin.z + dir.z * t - pos[i3 + 2];
    const rad = 0.85 * scale[i] + t * 0.028;
    if (dx * dx + dy * dy + dz * dz < rad * rad && t < bestFishD) {
      bestFishD = t;
      bestFish = i;
    }
  }

  if (bestShark >= 0 && (bestFish < 0 || bestSharkD <= bestFishD * 1.35 + 10)) {
    return { kind: "shark", id: bestShark };
  }
  if (bestFish >= 0) return { kind: "herring", id: bestFish };

  let bestSchool = -1;
  let bestSchoolD = Infinity;
  for (let s = 0; s < school.maxSchools; s++) {
    const n = school.schoolN[s];
    if (!n) continue;
    const c = school.centroids[s];
    const vx = c.x - origin.x;
    const vy = c.y - origin.y;
    const vz = c.z - origin.z;
    const t = vx * dir.x + vy * dir.y + vz * dir.z;
    if (t < 4 || t > 360) continue;
    const dx = origin.x + dir.x * t - c.x;
    const dy = origin.y + dir.y * t - c.y;
    const dz = origin.z + dir.z * t - c.z;
    const r = 16 + Math.sqrt(n) * 0.42;
    if (dx * dx + dy * dy + dz * dz < r * r && t < bestSchoolD) {
      bestSchoolD = t;
      bestSchool = s;
    }
  }
  if (bestSchool >= 0) return { kind: "school", id: bestSchool };
  return null;
}

function syncCamHud() {
  hud.setCamera(CAM_NAME[camMode]);
  if (!shark.controlled) hud.setHint(cameraHint(camMode, false));
}

function camCtx() {
  return {
    school,
    follow: pinnedFollow(),
    schoolTarget: pinnedSchool(),
    day,
    outcrops,
    piloting: shark.controlled,
    input,
  };
}

function applyCamera(mode) {
  if (shark.controlled && mode !== CAM.FOLLOW) togglePilot(false);
  camMode = mode;
  inspect = null;
  rig.setMode(camMode, camCtx());
  syncCamHud();
}

function cycleTarget() {
  inspect = null;
  if (camMode === CAM.FREE) return;
  if (camMode === CAM.FOLLOW) {
    if (followKind === "herring") {
      followKind = "shark";
      rig.setMode(CAM.FOLLOW, camCtx());
    }
    if (shark.controlled || sharks.length < 2) {
      syncCamHud();
      return;
    }
    followSharkIndex = (followSharkIndex + 1) % sharks.length;
  } else {
    const ids = resolveSchoolId();
    if (ids.length < 2) return;
    followSchoolId = ids[(ids.indexOf(followSchoolId) + 1) % ids.length];
  }
  syncCamHud();
}

function followShown() {
  const s = shownSubject();
  if (!s) return;
  inspect = null;
  if (shark.controlled && (s.kind !== "shark" || s.id !== 0)) togglePilot(false);
  if (s.kind === "shark") {
    followKind = "shark";
    followSharkIndex = s.id;
    applyCamera(CAM.FOLLOW);
    return;
  }
  if (s.kind === "school") {
    followKind = "school";
    followSchoolId = s.id;
    const schoolCam = camMode === CAM.FOLLOW || camMode === CAM.FREE ? CAM.ORBIT : camMode;
    applyCamera(schoolCam);
    return;
  }
  followKind = "herring";
  followHerringIndex = s.id;
  followSchoolId = school.schoolId[s.id];
  applyCamera(CAM.FOLLOW);
}

function togglePilot(force) {
  const next = force === undefined ? !shark.controlled : force;
  shark.setControlled(next);
  hud.setControl(next);
  if (next) {
    hud.setOpen(false);
    inspect = null;
    followKind = "shark";
    followSharkIndex = 0;
    camMode = CAM.FOLLOW;
    rig.setMode(CAM.FOLLOW, camCtx());
  }
  hud.setHint(cameraHint(camMode, next));
  hud.setCamera(CAM_NAME[camMode]);
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

function frame(now) {
  if (!alive) return;
  try {
    const dt = Math.min((now - last) / 1000, 0.033);
    last = now;
    const t = now * 0.001;

    const pointer = consumePointer();
    if (pointer.click && !hud.isOpen()) {
      inspect = pickSubject(pointer.click.x, pointer.click.y);
    }
    if (followKind === "herring" && followHerringIndex >= school.count) {
      followKind = "school";
      if (camMode === CAM.FOLLOW && !shark.controlled) applyCamera(CAM.ORBIT);
    }
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
    plankton.update(dt, tod, t);
    bloom.update(tod);
    syncFish();
    for (let i = 0; i < sharks.length; i++) syncSharkMesh(sharkMeshes[i], sharks[i]);
    eatFX.update(dt);
    outcrops.update(dt, tod);
    updateCamera(dt, pointer);
    env.update(t, camera, tod);
    hud.tick(dt, hudView());

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
