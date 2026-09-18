import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * Authored vehicle glTFs. One shared BufferGeometry per form/sex — vehicles
 * are rares, so a few thousand triangles is fine; do not put these on the
 * 20k school instancer. Nose must be +Z, dorsal +Y, origin at the body
 * centre, matching the fluke/tail swim shaders in sharkMesh.js.
 */
const VEHICLE_GLB = {
  orca: "/models/orca.glb",
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

export async function preloadVehicleMeshes() {
  const loader = new GLTFLoader();
  await Promise.all(
    Object.entries(VEHICLE_GLB).map(async ([form, url]) => {
      try {
        const gltf = await loader.loadAsync(url);
        const named = {};
        gltf.scene.traverse((o) => {
          if (o.isMesh) named[o.name] = o;
        });
        const male = named.orca_male || named[`${form}_male`];
        const female = named.orca_female || named[`${form}_female`];
        if (male) geos.set(`${form}:1`, bake(male));
        if (female) geos.set(`${form}:0`, bake(female));
        if (!male && !female) {
          const first = Object.values(named)[0];
          if (first) geos.set(`${form}:1`, bake(first));
        }
      } catch (err) {
        console.warn(`authored mesh ${form} failed`, err);
      }
    })
  );
}

export function authoredVehicleGeometry(form, sex) {
  return geos.get(`${form}:${sex ? 1 : 0}`) || geos.get(`${form}:1`) || null;
}
