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
  const shape = look.shape || "fish";
  if (shape === "squid") return createSquidGeometry(look);
  if (shape === "krill") return createKrillGeometry(look);
  if (shape === "lantern") return createLanternGeometry(look);
  if (shape === "flying") return createFlyingGeometry(look);
  if (shape === "billfish") return createBillfishGeometry(look);
  if (shape === "mahi") return createMahiGeometry(look);
  return createFishBody(look, shape);
}

function createFishBody(look, shape) {
  const slim = shape === "needle" || shape === "barracuda" || shape === "billfish";
  const body = _latheBody(look, slim ? needleProfile() : null);
  const pecScale = look.pec ?? 1;
  const dorsalH = (look.dorsal ?? 1) * (shape === "tuna" || shape === "mahi" ? 0.2 : 0.14);
  const dorsal = _fin(0.0, 0.12, -0.08, -0.16, dorsalH, look);
  const tail = _tail(look);
  const pec = _fin(0.07, 0.02, 0.08, -0.12 * Math.min(1.6, pecScale), 0.08 * Math.min(1.4, pecScale), look);
  const pec2 = pec.clone();
  pec2.rotateZ(Math.PI);
  const parts = [body, dorsal, tail, pec, pec2];
  if (slim) {
    const anal = _fin(0.0, -0.06, -0.12, -0.14, -0.08, look);
    parts.push(anal);
  }
  if (shape === "billfish") parts.push(_spear(look));
  const geo = mergeGeometries(parts.map(prepare), false);
  geo.computeVertexNormals();
  return geo;
}

function createBillfishGeometry(look) {
  return createFishBody(look, "billfish");
}

function createMahiGeometry(look) {
  return createFishBody(look, "mahi");
}

function _spear(look) {
  const g = new THREE.ConeGeometry(0.022, 0.52, 5);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, 0.68);
  _paintLook(g, look);
  return g;
}

function createFlyingGeometry(look) {
  const body = _latheBody(look);
  const dorsal = _fin(0.0, 0.1, -0.05, -0.12, 0.1, look);
  const tail = _tail(look);
  const wing = _wing(look, 1, look.pec ?? 3.4);
  const wing2 = _wing(look, -1, look.pec ?? 3.4);
  const pelvic = _wing(look, 1, 1.35, -0.22);
  const pelvic2 = _wing(look, -1, 1.35, -0.22);
  const geo = mergeGeometries([body, dorsal, tail, wing, wing2, pelvic, pelvic2].map(prepare), false);
  geo.computeVertexNormals();
  return geo;
}

function createLanternGeometry(look) {
  const body = _latheBody(look);
  const dorsal = _fin(0.0, 0.1, -0.06, -0.12, 0.1, look);
  const tail = _tail(look);
  const pec = _fin(0.06, 0.02, 0.06, -0.1, 0.06, look);
  const pec2 = pec.clone();
  pec2.rotateZ(Math.PI);
  const eyeL = _eye(0.055, 0.06, 0.32, 0.045, look);
  const eyeR = _eye(-0.055, 0.06, 0.32, 0.045, look);
  const lights = _photophores(look);
  const geo = mergeGeometries([body, dorsal, tail, pec, pec2, eyeL, eyeR, lights].map(prepare), false);
  geo.computeVertexNormals();
  return geo;
}

function createKrillGeometry(look) {
  const profile = [
    new THREE.Vector2(0.001, -0.42),
    new THREE.Vector2(0.045, -0.32),
    new THREE.Vector2(0.07, -0.08),
    new THREE.Vector2(0.08, 0.12),
    new THREE.Vector2(0.055, 0.32),
    new THREE.Vector2(0.02, 0.42),
  ];
  const body = new THREE.LatheGeometry(profile, 8);
  body.rotateX(-Math.PI / 2);
  const bs = look.body || [0.22, 0.72, 1.55];
  body.scale(bs[0], bs[1], bs[2]);
  _paintLook(body, look);
  const fan = _tailFan(look);
  const parts = [body, fan];
  for (let i = 0; i < 3; i++) {
    const z = 0.16 - i * 0.11;
    parts.push(_fin(0.045, -0.035, z, 0.07, -0.08, look));
    parts.push(_fin(-0.045, -0.035, z, 0.07, -0.08, look));
  }
  const geo = mergeGeometries(parts.map(prepare), false);
  geo.computeVertexNormals();
  return geo;
}

function createSquidGeometry(look) {
  const profile = [
    new THREE.Vector2(0.001, 0.5),
    new THREE.Vector2(0.05, 0.38),
    new THREE.Vector2(0.12, 0.08),
    new THREE.Vector2(0.13, -0.18),
    new THREE.Vector2(0.08, -0.38),
    new THREE.Vector2(0.02, -0.48),
  ];
  const mantle = new THREE.LatheGeometry(profile, 8);
  mantle.rotateX(-Math.PI / 2);
  const bs = look.body || [0.38, 0.85, 1.35];
  mantle.scale(bs[0], bs[1], bs[2]);
  _paintLook(mantle, look);
  const fin = _fin(0.16, 0.0, 0.22, 0.22, 0.035, look);
  const fin2 = _fin(-0.16, 0.0, 0.22, 0.22, 0.035, look);
  const arms = _tentacles(look);
  const geo = mergeGeometries([mantle, fin, fin2, arms].map(prepare), false);
  geo.computeVertexNormals();
  return geo;
}

function needleProfile() {
  return [
    new THREE.Vector2(0.001, -0.5),
    new THREE.Vector2(0.028, -0.4),
    new THREE.Vector2(0.045, -0.12),
    new THREE.Vector2(0.05, 0.12),
    new THREE.Vector2(0.038, 0.34),
    new THREE.Vector2(0.016, 0.48),
    new THREE.Vector2(0.004, 0.56),
  ];
}

function _tentacles(look) {
  const g = new THREE.BufferGeometry();
  const verts = [];
  const idx = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * 0.05;
    const y = Math.sin(a) * 0.04;
    const b = verts.length / 3;
    verts.push(x, y, -0.42, x * 0.4, y * 0.4, -0.92, x + 0.012, y, -0.42);
    idx.push(b, b + 1, b + 2);
  }
  verts.push(0.04, -0.01, -0.42, 0.03, -0.02, -1.18, 0.055, 0.0, -0.42);
  verts.push(-0.04, -0.01, -0.42, -0.03, -0.02, -1.18, -0.055, 0.0, -0.42);
  const last = verts.length / 3;
  idx.push(last - 6, last - 5, last - 4, last - 3, last - 2, last - 1);
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  _paintFlat(g, look.fin || [0.48, 0.4, 0.3]);
  return g;
}

function _latheBody(look, profilePts = null) {
  const profile = (profilePts || [
    new THREE.Vector2(0.001, -0.48),
    new THREE.Vector2(0.05, -0.4),
    new THREE.Vector2(0.09, -0.22),
    new THREE.Vector2(0.11, 0.0),
    new THREE.Vector2(0.09, 0.22),
    new THREE.Vector2(0.045, 0.4),
    new THREE.Vector2(0.012, 0.48),
  ]);
  const g = new THREE.LatheGeometry(profile, 8);
  g.rotateX(-Math.PI / 2);
  const bs = look.body || [0.55, 1.15, 1];
  g.scale(bs[0], bs[1], bs[2]);
  _paintLook(g, look);
  return g;
}

function _paintLook(g, look) {
  const col = new Float32Array(g.attributes.position.count * 3);
  const pos = g.attributes.position;
  const back = look.back || [0.18, 0.28, 0.24];
  const belly = look.belly || [0.82, 0.88, 0.84];
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = 1 - THREE.MathUtils.smoothstep(y, -0.1, 0.1);
    col[i * 3] = back[0] * (1 - t) + belly[0] * t;
    col[i * 3 + 1] = back[1] * (1 - t) + belly[1] * t;
    col[i * 3 + 2] = back[2] * (1 - t) + belly[2] * t;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
}

function _paintFlat(g, rgb) {
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = rgb[0];
    col[i * 3 + 1] = rgb[1];
    col[i * 3 + 2] = rgb[2];
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
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

function _wing(look, side, span = 3.4, zOff = 0) {
  const g = new THREE.BufferGeometry();
  const s = side;
  const w = 0.16 * span;
  const verts = new Float32Array([
    0.04 * s, 0.02, 0.14 + zOff,
    w * s, 0.05, -0.02 + zOff,
    0.07 * s, -0.02, -0.18 + zOff,
  ]);
  g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  g.setIndex([0, 1, 2]);
  const f = look.fin || [0.16, 0.28, 0.42];
  const col = new Float32Array([f[0], f[1], f[2], f[0] * 0.8, f[1] * 0.85, f[2] * 0.9, f[0] * 0.9, f[1] * 0.9, f[2] * 0.95]);
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

function _tailFan(look) {
  const g = new THREE.BufferGeometry();
  const verts = new Float32Array([
    0, 0, -0.4,
    0.09, 0.02, -0.62,
    0, 0.04, -0.7,
    0, 0, -0.4,
    -0.09, 0.02, -0.62,
    0, 0.04, -0.7,
  ]);
  g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  g.setIndex([0, 1, 2, 3, 4, 5]);
  _paintFlat(g, look.fin || [0.7, 0.28, 0.16]);
  return g;
}

function _eye(x, y, z, r, look) {
  const g = new THREE.SphereGeometry(r, 6, 5);
  g.translate(x, y, z);
  _paintFlat(g, look.eye || [0.08, 0.1, 0.12]);
  return g;
}

function _photophores(look) {
  const g = new THREE.BufferGeometry();
  const verts = [];
  const idx = [];
  for (let i = 0; i < 6; i++) {
    const z = -0.28 + i * 0.09;
    const b = verts.length / 3;
    verts.push(-0.01, -0.07, z, 0.01, -0.07, z, 0, -0.055, z + 0.02);
    idx.push(b, b + 1, b + 2);
  }
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  _paintFlat(g, look.glow || [0.55, 0.85, 0.45]);
  return g;
}

function fishSwim(look) {
  if (look.swim) return look.swim;
  if (look.shape === "squid") return "jet";
  if (look.shape === "krill") return "paddle";
  if (look.shape === "flying") return "fly";
  if (look.shape === "needle" || look.shape === "barracuda") return "eel";
  if (look.shape === "tuna" || look.shape === "billfish" || look.shape === "mahi") return "thunniform";
  if (look.shape === "cod") return "body";
  return "tail";
}

function fishVertex(swim) {
  if (swim === "jet") {
    return `
      vec3 transformed = vec3(position);
      float cycle = uTime * 5.4 + aPhase;
      float pulse = pow(max(0.0, sin(cycle)), 2.4);
      float mantle = smoothstep(-0.22, 0.12, position.z);
      float radial = 1.0 + pulse * 0.14 * uTail * mantle;
      transformed.x *= radial;
      transformed.y *= radial;
      float arm = 1.0 - mantle;
      float trail = 1.0 - pulse;
      transformed.x += sin(cycle - 1.15) * arm * arm * uTail * (0.28 + trail * 0.7);
      transformed.y += cos(cycle * 0.7) * arm * arm * uTail * 0.28;
      `;
  }
  if (swim === "paddle") {
    return `
      vec3 transformed = vec3(position);
      float tail = smoothstep(0.05, -0.45, position.z);
      transformed.y += sin(uTime * 22.0 + aPhase + position.z * 10.0) * tail * uTail;
      transformed.x += sin(uTime * 14.0 + aPhase * 1.7) * 0.02 * uTail;
      `;
  }
  if (swim === "eel") {
    return `
      vec3 transformed = vec3(position);
      float along = smoothstep(0.42, -0.52, position.z);
      transformed.x += sin(uTime * 14.0 + aPhase - position.z * 8.0) * along * uTail;
      `;
  }
  if (swim === "fly") {
    return `
      vec3 transformed = vec3(position);
      float tail = smoothstep(0.05, -0.5, position.z);
      transformed.x += sin(uTime * 16.0 + aPhase) * tail * tail * uTail;
      float wing = smoothstep(0.07, 0.22, abs(position.x));
      transformed.y += sin(uTime * 28.0 + aPhase) * wing * 0.14 * uTail;
      `;
  }
  if (swim === "thunniform") {
    return `
      vec3 transformed = vec3(position);
      float tail = smoothstep(-0.05, -0.52, position.z);
      transformed.x += sin(uTime * 22.0 + aPhase) * tail * tail * uTail * 0.72;
      `;
  }
  if (swim === "body") {
    return `
      vec3 transformed = vec3(position);
      float along = smoothstep(0.35, -0.5, position.z);
      transformed.x += sin(uTime * 11.0 + aPhase - position.z * 6.0) * along * uTail;
      `;
  }
  return `
      vec3 transformed = vec3(position);
      float tail = smoothstep(0.05, -0.5, position.z);
      transformed.x += sin(uTime * 16.0 + aPhase) * tail * tail * uTail;
      `;
}

export function createFishMaterial(uniforms, speciesId = "herring") {
  const look = lookFor(speciesId);
  const swim = fishSwim(look);
  const lantern = look.shape === "lantern";
  const glow = look.glow || [0.55, 0.85, 0.45];
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: look.shape === "squid" || look.shape === "krill" ? 0.5 : 0.38,
    metalness: look.shape === "squid" ? 0.08 : 0.28,
    emissive: lantern ? new THREE.Color(glow[0], glow[1], glow[2]) : 0x143028,
    emissiveIntensity: lantern ? 0 : 0.18,
  });
  if (lantern) mat.userData.uGlow = { value: 0.12 };
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
      fishVertex(swim)
    );
  };
  mat.customProgramCacheKey = () => `fish-${speciesId}-${swim}-v3`;
  attachWorldShading(mat, uniforms);
  return mat;
}
