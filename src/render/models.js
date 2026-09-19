import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * Authored glTFs. Vehicles are rares (a few hundred tris is fine). School
 * guilds stay under ~600 tris for the 20k instancer. Nose +Z, dorsal +Y,
 * origin at the body centre — same axes as the swim shaders.
 *
 * Vehicles key by catalog id, then by mesh form. School keys by look.shape.
 * School UV.x = belly mix, UV.y = part (0 body, 0.5 fin, 0.85 eye, 1 photophore).
 */
const VEHICLE_GLB = {
  orca: "/models/orca.glb",
  shark: "/models/shark.glb",
  greatwhite: "/models/greatwhite.glb",
  tigershark: "/models/tigershark.glb",
  hammerhead: "/models/hammerhead.glb",
  whaleshark: "/models/whaleshark.glb",
  minke: "/models/minke.glb",
  humpback: "/models/humpback.glb",
  spermwhale: "/models/spermwhale.glb",
  commondolphin: "/models/dolphin.glb",
  bluefin: "/models/bluefin.glb",
  giantsquid: "/models/giantsquid.glb",
};

const VEHICLE_FORM = {
  shark: "shark",
  greatwhite: "shark",
  tigershark: "shark",
  hammerhead: "hammerhead",
  whaleshark: "whaleshark",
  minke: "whale",
  humpback: "whale",
  spermwhale: "spermwhale",
  orca: "orca",
  commondolphin: "dolphin",
  bluefin: "tuna",
  giantsquid: "squid",
};

const SCHOOL_GLB = {
  fish: "/models/school-fish.glb",
  flying: "/models/school-flying.glb",
  needle: "/models/school-needle.glb",
  squid: "/models/school-squid.glb",
  lantern: "/models/school-lantern.glb",
  krill: "/models/school-krill.glb",
  tuna: "/models/school-tuna.glb",
  cod: "/models/school-cod.glb",
  mahi: "/models/school-mahi.glb",
  barracuda: "/models/school-barracuda.glb",
  billfish: "/models/school-billfish.glb",
};

const geos = new Map();

function prepare(geo) {
  geo.computeVertexNormals();
  const n = geo.attributes.position.count;
  if (!geo.attributes.uv) {
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  }
  return geo;
}

function bake(obj) {
  const geo = obj.geometry.clone();
  obj.updateWorldMatrix(true, false);
  geo.applyMatrix4(obj.matrixWorld);
  // Blender +Y-up glTF: head was Blender +Y → glTF −Z. Game swim shaders
  // treat +Z as the rostrum (bodyN = 0 at z ≈ 5.2).
  geo.rotateY(Math.PI);
  geo.computeBoundingBox();
  geo.userData.shared = true;
  return prepare(geo);
}

function firstMesh(gltf) {
  const named = {};
  gltf.scene.traverse((o) => {
    if (o.isMesh) named[o.name] = o;
  });
  return named;
}

function putVehicle(kind, form, sexKey, geo) {
  geos.set(`${kind}:${sexKey}`, geo);
  // Form is a swim-shader bucket (great white and tiger both swim as "shark"),
  // not a shared mesh. Filling an empty form slot keeps a fallback if a
  // kind-specific glb fails; overwriting it would give the blue shark the last
  // carcharhinid that finished loading.
  const formKey = `${form}:${sexKey}`;
  if (kind === form || !geos.has(formKey)) geos.set(formKey, geo);
}

function registerVehicle(kind, named) {
  const form = VEHICLE_FORM[kind] || kind;
  const male = named[`${kind}_male`] || named[`${form}_male`] || named.orca_male;
  const female = named[`${kind}_female`] || named[`${form}_female`] || named.orca_female;
  const first = male || female || Object.values(named)[0];
  if (male) putVehicle(kind, form, "1", bake(male));
  if (female) putVehicle(kind, form, "0", bake(female));
  if (!male && !female && first) putVehicle(kind, form, "1", bake(first));
}

async function loadAll(loader, entries, onGltf) {
  await Promise.all(
    entries.map(async ([key, url]) => {
      try {
        const gltf = await loader.loadAsync(url);
        onGltf(key, firstMesh(gltf));
      } catch (err) {
        console.warn(`authored mesh ${key} failed`, err);
      }
    })
  );
}

export async function preloadAuthoredMeshes() {
  const loader = new GLTFLoader();
  await loadAll(loader, Object.entries(VEHICLE_GLB), registerVehicle);
  await loadAll(loader, Object.entries(SCHOOL_GLB), (shape, named) => {
    const mesh = named[`school_${shape}`] || Object.values(named)[0];
    if (mesh) geos.set(`school:${shape}`, bake(mesh));
  });
}

export async function preloadVehicleMeshes() {
  return preloadAuthoredMeshes();
}

export function authoredVehicleGeometry(form, sex, kind = "") {
  const s = sex ? 1 : 0;
  return (
    geos.get(`${kind}:${s}`) ||
    geos.get(`${kind}:1`) ||
    geos.get(`${form}:${s}`) ||
    geos.get(`${form}:1`) ||
    null
  );
}

export function authoredSchoolGeometry(shape = "fish") {
  return geos.get(`school:${shape}`) || geos.get("school:fish") || null;
}

export function recolorSchoolGeometry(src, look = {}) {
  const geo = src.clone();
  geo.userData.shared = false;
  const uv = geo.attributes.uv;
  if (!uv) return geo;
  const back = look.back || [0.18, 0.28, 0.24];
  const belly = look.belly || [0.82, 0.88, 0.84];
  const fin = look.fin || [0.22, 0.32, 0.3];
  const glow = look.glow || [0.55, 0.85, 0.45];
  const eye = look.eye || [0.08, 0.1, 0.12];
  const n = uv.count;
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const mix = uv.getX(i);
    // glTF flips Blender V, so part was authored as 1 − this channel.
    const part = 1 - uv.getY(i);
    let r, g, b;
    if (part > 0.92) {
      r = glow[0];
      g = glow[1];
      b = glow[2];
    } else if (part > 0.7) {
      r = eye[0];
      g = eye[1];
      b = eye[2];
    } else if (part > 0.3) {
      r = fin[0];
      g = fin[1];
      b = fin[2];
    } else {
      r = back[0] * (1 - mix) + belly[0] * mix;
      g = back[1] * (1 - mix) + belly[1] * mix;
      b = back[2] * (1 - mix) + belly[2] * mix;
    }
    out[i * 3] = r;
    out[i * 3 + 1] = g;
    out[i * 3 + 2] = b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(out, 3));
  return geo;
}
