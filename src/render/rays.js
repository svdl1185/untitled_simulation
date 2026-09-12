import * as THREE from "three";
import { attachWorldShading } from "./caustics.js";

export function createRayGeometry() {
  const verts = [
    0, 0.06, 0.95,
    -1.35, 0.01, 0.05,
    0, 0.04, -0.55,
    1.35, 0.01, 0.05,
    0, 0.03, -1.25,
    -0.16, 0.02, -0.55,
    0.16, 0.02, -0.55,
    0, -0.03, 0.2,
  ];
  const idx = [
    0, 1, 2,
    0, 2, 3,
    2, 5, 4,
    2, 4, 6,
    0, 7, 1,
    0, 3, 7,
    1, 7, 2,
    3, 2, 7,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const belly = y < 0 ? 1 : 0;
    col[i * 3] = belly ? 0.62 : 0.18;
    col[i * 3 + 1] = belly ? 0.52 : 0.16;
    col[i * 3 + 2] = belly ? 0.38 : 0.12;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

export function createRayMaterial(uniforms) {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.72,
    metalness: 0.06,
    side: THREE.DoubleSide,
    emissive: 0x1a140c,
    emissiveIntensity: 0.12,
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
      float wing = smoothstep(0.18, 1.25, abs(position.x));
      transformed.y += sin(uTime * 3.6 + aPhase) * wing * 0.22;
      `
    );
  };
  mat.customProgramCacheKey = () => "ray-wing-v2";
  attachWorldShading(mat, uniforms);
  return mat;
}
