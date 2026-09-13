import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { attachWorldShading } from "./caustics.js";
import { lookFor } from "../world/fauna.js";

function prepare(g) {
  g.computeVertexNormals();
  const n = g.attributes.position.count;
  if (!g.attributes.uv) {
    g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  }
  return g;
}

export function createFishGeometry(speciesId = "herring") {
  const look = lookFor(speciesId);
  const body = _latheBody(look);
  const pecScale = look.pec ?? 1;
  const dorsal = _fin(0.0, 0.12, -0.08, -0.16, 0.14, look);
  const tail = _tail(look);
  const pec = _fin(0.07, 0.02, 0.08, -0.12 * pecScale, 0.08 * Math.min(1.4, pecScale), look);
  if (pecScale > 1.6) {
    pec.scale(pecScale * 0.55, 1, pecScale * 0.72);
  }
  const pec2 = pec.clone();
  pec2.rotateZ(Math.PI);
  const geo = mergeGeometries([body, dorsal, tail, pec, pec2].map(prepare), false);
  geo.computeVertexNormals();
  return geo;
}

function _latheBody(look) {
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
  const bs = look.body || [0.55, 1.15, 1];
  g.scale(bs[0], bs[1], bs[2]);
  const col = new Float32Array(g.attributes.position.count * 3);
  const pos = g.attributes.position;
  const back = look.back || [0.18, 0.28, 0.24];
  const belly = look.belly || [0.82, 0.88, 0.84];
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = THREE.MathUtils.clamp((y + 0.12) / 0.28, 0, 1);
    col[i * 3] = back[0] * (1 - t) + belly[0] * t;
    col[i * 3 + 1] = back[1] * (1 - t) + belly[1] * t;
    col[i * 3 + 2] = back[2] * (1 - t) + belly[2] * t;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

function _fin(x, y, z, w, h, look) {
  const g = new THREE.BufferGeometry();
  const verts = new Float32Array([
    x, y, z,
    x, y + h, z + w * 0.2,
    x, y + 0.02, z + w,
  ]);
  g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  g.setIndex([0, 1, 2]);
  const f = look.fin || [0.22, 0.32, 0.3];
  const col = new Float32Array([f[0], f[1], f[2], f[0] * 0.85, f[1] * 0.85, f[2] * 0.85, f[0] * 0.9, f[1] * 0.9, f[2] * 0.9]);
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

function _tail(look) {
  const fork = look.tail ?? 1;
  const g = new THREE.BufferGeometry();
  const verts = new Float32Array([
    0, 0, -0.46,
    0, 0.16 * fork, -0.68,
    0, 0.02, -0.58,
    0, 0, -0.46,
    0, -0.02, -0.58,
    0, -0.16 * fork, -0.68,
  ]);
  g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  g.setIndex([0, 1, 2, 3, 4, 5]);
  const f = look.fin || [0.28, 0.38, 0.4];
  const col = new Float32Array(6 * 3);
  for (let i = 0; i < 6; i++) {
    col[i * 3] = f[0];
    col[i * 3 + 1] = f[1];
    col[i * 3 + 2] = f[2];
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

export function createFishMaterial(uniforms, speciesId = "herring") {
  const look = lookFor(speciesId);
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.38,
    metalness: 0.28,
    emissive: 0x143028,
    emissiveIntensity: 0.18,
  });
  if (!uniforms) return mat;
  const wave = look.wave ?? 0.16;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uTail = { value: wave };
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
      attribute float aPhase;
      uniform float uTime;
      uniform float uTail;
      `
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
      vec3 transformed = vec3(position);
      float tail = smoothstep(0.05, -0.5, position.z);
      transformed.x += sin(uTime * 16.0 + aPhase) * tail * tail * uTail;
      `
    );
  };
  mat.customProgramCacheKey = () => `fish-tail-${speciesId}`;
  attachWorldShading(mat, uniforms);
  return mat;
}
