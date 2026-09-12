import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { attachWorldShading } from "./caustics.js";

function prepare(g) {
  g.computeVertexNormals();
  const n = g.attributes.position.count;
  if (!g.attributes.uv) {
    g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  }
  return g;
}

export function createFishGeometry() {
  const body = _latheBody();
  const dorsal = _fin(0.0, 0.12, -0.08, -0.16, 0.14);
  const tail = _tail();
  const pec = _fin(0.07, 0.02, 0.08, -0.12, 0.08);
  const pec2 = pec.clone();
  pec2.rotateZ(Math.PI);
  const geo = mergeGeometries([body, dorsal, tail, pec, pec2].map(prepare), false);
  geo.computeVertexNormals();
  return geo;
}

function _latheBody() {
  const profile = [
    new THREE.Vector2(0.001, -0.48),
    new THREE.Vector2(0.05, -0.4),
    new THREE.Vector2(0.09, -0.22),
    new THREE.Vector2(0.11, 0.0),
    new THREE.Vector2(0.09, 0.22),
    new THREE.Vector2(0.045, 0.4),
    new THREE.Vector2(0.012, 0.48),
  ];
  const g = new THREE.LatheGeometry(profile, 8);
  g.rotateX(-Math.PI / 2);
  g.scale(0.55, 1.15, 1);
  const col = new Float32Array(g.attributes.position.count * 3);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = THREE.MathUtils.clamp((y + 0.12) / 0.28, 0, 1);
    // Countershading: dark olive back, silver flank, pale belly.
    const r = 0.55 + t * 0.38;
    const gch = 0.62 + t * 0.28;
    const b = 0.58 + t * 0.32;
    const back = 1 - t;
    col[i * 3] = r * (0.22 + 0.78 * t) * (1 - back * 0.35);
    col[i * 3 + 1] = gch * (0.28 + 0.72 * t);
    col[i * 3 + 2] = b * (0.26 + 0.7 * t);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

function _fin(x, y, z, w, h) {
  const g = new THREE.BufferGeometry();
  const verts = new Float32Array([
    x, y, z,
    x, y + h, z + w * 0.2,
    x, y + 0.02, z + w,
  ]);
  g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  g.setIndex([0, 1, 2]);
  const col = new Float32Array([0.22, 0.32, 0.3, 0.18, 0.26, 0.25, 0.2, 0.28, 0.27]);
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

function _tail() {
  const g = new THREE.BufferGeometry();
  const verts = new Float32Array([
    0, 0, -0.46,
    0, 0.16, -0.68,
    0, 0.02, -0.58,
    0, 0, -0.46,
    0, -0.02, -0.58,
    0, -0.16, -0.68,
  ]);
  g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  g.setIndex([0, 1, 2, 3, 4, 5]);
  const col = new Float32Array(6 * 3);
  for (let i = 0; i < 6; i++) {
    col[i * 3] = 0.28;
    col[i * 3 + 1] = 0.38;
    col[i * 3 + 2] = 0.4;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

export function createFishMaterial(uniforms) {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.38,
    metalness: 0.28,
    emissive: 0x143028,
    emissiveIntensity: 0.18,
  });
  if (!uniforms) return mat;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
      attribute float aPhase;
      uniform float uTime;
      `
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
      vec3 transformed = vec3(position);
      float tail = smoothstep(0.05, -0.5, position.z);
      transformed.x += sin(uTime * 16.0 + aPhase) * tail * tail * 0.16;
      `
    );
  };
  mat.customProgramCacheKey = () => "herring-tail";
  attachWorldShading(mat, uniforms);
  return mat;
}
