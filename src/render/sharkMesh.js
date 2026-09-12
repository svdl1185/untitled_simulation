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

export function createSharkMesh(uniforms) {
  const body = _body();
  const dorsal = _triFin(0, 0.55, 0.1, 1.15, 1.4, 0.28);
  const tailUpper = _triFin(0, 0.15, -4.6, 1.6, 1.9, 0.2);
  const tailLower = _triFin(0, -0.05, -4.6, -1.05, 1.35, 0.18);
  const pecL = _pec(1);
  const pecR = _pec(-1);
  const pelvic = _triFin(0, -0.42, -0.8, -0.45, 0.7, 0.12);
  const geo = mergeGeometries(
    [body, dorsal, tailUpper, tailLower, pecL, pecR, pelvic].map(prepare),
    false
  );
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.72,
    metalness: 0.04,
    side: THREE.DoubleSide,
    envMapIntensity: 0.15,
  });
    if (uniforms) {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = uniforms.uTime;
        shader.uniforms.uSharkAmp = uniforms.uSharkAmp;
        shader.uniforms.uSharkPhase = uniforms.uSharkPhase;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <common>",
          `#include <common>
          uniform float uTime;
          uniform float uSharkAmp;
          uniform float uSharkPhase;
          `
        );
        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          `
          vec3 transformed = vec3(position);
          float along = position.z;
          float tail = smoothstep(1.4, -4.85, along);
          float head = 1.0 - smoothstep(-0.4, 4.6, along);
          float phase = uSharkPhase;
          float wave = sin(phase - along * 0.55);
          float amp = uSharkAmp;
          transformed.x += wave * amp * (0.08 + tail * tail * 1.85);
          transformed.x -= sin(phase) * amp * 0.14 * head;
          transformed.y += cos(phase - along * 0.4) * amp * 0.1 * tail;
          if (abs(position.x) > 0.52 && position.z > 0.35 && position.z < 2.05) {
            float pec = (abs(position.x) - 0.52) / 1.4;
            transformed.y += sin(phase * 0.7) * 0.28 * sign(position.x) * pec * amp;
            transformed.z += sin(phase * 0.7 + 0.5) * 0.08 * pec * amp;
          }
          `
        );
        shader.vertexShader = shader.vertexShader.replace(
          "#include <beginnormal_vertex>",
          `
          vec3 objectNormal = vec3(normal);
          float alongN = position.z;
          float tailN = smoothstep(1.4, -4.85, alongN);
          float dWave = cos(uSharkPhase - alongN * 0.55) * 0.55;
          objectNormal.x += dWave * uSharkAmp * tailN * 0.35;
          objectNormal = normalize(objectNormal);
          `
        );
      };
      mat.customProgramCacheKey = () => "shark-swim-v3";
      attachWorldShading(mat, uniforms);
    }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;

  const group = new THREE.Group();
  group.add(mesh);

  const eyeGeo = new THREE.SphereGeometry(0.09, 8, 8);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.3 });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(0.38, 0.18, 3.55);
  eyeR.position.set(-0.38, 0.18, 3.55);
  group.add(eyeL, eyeR);

  const fear = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x7ee7ff,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.01, 6, 48), ringMat);
  ring.rotation.x = Math.PI / 2;
  const ring2 = ring.clone();
  ring2.rotation.x = 0.55;
  const ring3 = ring.clone();
  ring3.rotation.x = Math.PI - 0.55;
  fear.add(ring, ring2, ring3);
  fear.visible = false;
  group.add(fear);
  group.userData.fear = fear;
  group.userData.body = mesh;
  return group;
}

function _body() {
  const profile = [
    new THREE.Vector2(0.01, -4.85),
    new THREE.Vector2(0.12, -4.55),
    new THREE.Vector2(0.42, -3.8),
    new THREE.Vector2(0.72, -2.6),
    new THREE.Vector2(0.95, -0.2),
    new THREE.Vector2(0.7, 2.2),
    new THREE.Vector2(0.28, 4.5),
    new THREE.Vector2(0.02, 5.2),
  ];
  const g = new THREE.LatheGeometry(profile, 10);
  g.rotateX(-Math.PI / 2);
  g.scale(1, 0.78, 1);
  const col = new Float32Array(g.attributes.position.count * 3);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = THREE.MathUtils.smoothstep(y, -0.4, 0.35);
    col[i * 3] = 0.32 + t * 0.22;
    col[i * 3 + 1] = 0.38 + t * 0.18;
    col[i * 3 + 2] = 0.42 + t * 0.14;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

function _triFin(x, y, z, h, length, thickness) {
  const g = new THREE.BufferGeometry();
  const t = thickness;
  const verts = new Float32Array([
    x - t, y, z,
    x + t, y, z,
    x, y + h, z + length * 0.15,
    x - t * 0.4, y, z + length * 0.35,
    x + t * 0.4, y, z + length * 0.35,
  ]);
  g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 1, 4, 2, 3, 2, 4]);
  const col = new Float32Array(5 * 3);
  for (let i = 0; i < 5; i++) {
    col[i * 3] = 0.22;
    col[i * 3 + 1] = 0.28;
    col[i * 3 + 2] = 0.34;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

function _pec(side) {
  const g = new THREE.BufferGeometry();
  const s = side;
  const verts = new Float32Array([
    0.55 * s, -0.15, 1.6,
    1.9 * s, -0.45, 0.9,
    0.5 * s, -0.2, 0.55,
  ]);
  g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  g.setIndex([0, 1, 2]);
  const col = new Float32Array([0.3, 0.36, 0.4, 0.24, 0.3, 0.35, 0.32, 0.38, 0.42]);
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

export function syncSharkMesh(group, shark, uniforms) {
  const spd = Math.hypot(shark.vx, shark.vy, shark.vz);
  const amp = (0.32 + Math.min(spd, 28) * 0.018) * (shark.lunging ? 1.45 : 1);
  if (uniforms?.uSharkAmp) uniforms.uSharkAmp.value = amp;
  if (uniforms?.uSharkPhase) uniforms.uSharkPhase.value = shark.swimT;
  const wag = Math.sin(shark.swimT) * 0.045 * (0.4 + amp);
  const bob = Math.sin(shark.swimT + 0.6) * 0.02 * (0.45 + amp);
  group.position.set(shark.x, shark.y, shark.z);
  group.rotation.set(shark.pitch + bob, shark.yaw + wag, shark.roll + wag * 0.4, "YXZ");
  const fear = group.userData.fear;
  if (fear.visible) {
    const r = shark.fearRadius;
    fear.scale.setScalar(r);
    fear.children.forEach((ring) => {
      ring.material.opacity = shark.lunging ? 0.38 : 0.2;
    });
  }
}
