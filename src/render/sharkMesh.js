import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { attachWorldShading } from "./caustics.js";
import { CONFIG } from "../config.js";

function prepare(g) {
  g.computeVertexNormals();
  const n = g.attributes.position.count;
  if (!g.attributes.uv) {
    g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  }
  return g;
}

export function createSharkMesh(uniforms, opts = {}) {
  const tint = opts.tint || { r: 1, g: 1, b: 1 };
  const form = opts.form || "shark";
  const parts =
    form === "whale"
      ? _whaleParts(tint)
      : form === "squid"
        ? _squidParts(tint)
        : form === "billfish"
          ? _billfishParts(tint)
          : form === "dolphin"
            ? _dolphinParts(tint)
            : form === "tuna" || form === "cod"
              ? _tunaParts(tint)
              : _sharkParts(tint);
  const geo = mergeGeometries(parts.map(prepare), false);
  geo.computeVertexNormals();

  const uSharkAmp = { value: 0.55 };
  const uSharkPhase = { value: 0 };

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
      shader.uniforms.uSharkAmp = uSharkAmp;
      shader.uniforms.uSharkPhase = uSharkPhase;
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
          float bodyN = clamp((5.2 - along) / 10.05, 0.0, 1.0);
          float tail = smoothstep(0.32, 1.0, bodyN);
          float head = 1.0 - smoothstep(0.0, 0.28, bodyN);
          float phase = uSharkPhase;
          float wave = sin(phase - along * 0.62);
          float amp = uSharkAmp;
          float lat = wave * amp * (0.05 + pow(tail, 1.65) * 2.2);
          lat -= sin(phase) * amp * 0.2 * head;
          transformed.x += lat;
          transformed.y += cos(phase - along * 0.45) * amp * 0.09 * tail * tail;
          if (abs(position.x) > 0.52 && position.z > 0.35 && position.z < 2.05) {
            float pec = (abs(position.x) - 0.52) / 1.4;
            float pecAmp = min(amp, 0.72);
            transformed.y += sin(phase * 0.85) * 0.34 * sign(position.x) * pec * pecAmp;
            transformed.z += sin(phase * 0.85 + 0.55) * 0.1 * pec * pecAmp;
          }
          `
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <beginnormal_vertex>",
        `
          vec3 objectNormal = vec3(normal);
          float alongN = position.z;
          float tailN = smoothstep(0.32, 1.0, clamp((5.2 - alongN) / 10.05, 0.0, 1.0));
          float dWave = cos(uSharkPhase - alongN * 0.62) * 0.62;
          objectNormal.x += dWave * uSharkAmp * tailN * 0.4;
          objectNormal = normalize(objectNormal);
          `
      );
    };
    mat.customProgramCacheKey = () => "shark-swim-v4";
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
  group.userData.uSharkAmp = uSharkAmp;
  group.userData.uSharkPhase = uSharkPhase;
  return group;
}

function _sharkParts(tint) {
  return [
    _body(tint, 1, 0.78),
    _triFin(0, 0.55, 0.1, 1.15, 1.4, 0.28, tint),
    _triFin(0, 0.15, -4.6, 1.6, 1.9, 0.2, tint),
    _triFin(0, -0.05, -4.6, -1.05, 1.35, 0.18, tint),
    _pec(1, tint),
    _pec(-1, tint),
    _triFin(0, -0.42, -0.8, -0.45, 0.7, 0.12, tint),
  ];
}

function _tunaParts(tint) {
  return [
    _body(tint, 0.72, 0.92),
    _triFin(0, 0.42, 0.2, 0.72, 1.1, 0.16, tint),
    _triFin(0, 0.12, -4.6, 1.35, 1.5, 0.14, tint),
    _triFin(0, -0.08, -4.6, -1.2, 1.4, 0.14, tint),
    _pec(1, tint, 0.72),
    _pec(-1, tint, 0.72),
  ];
}

function _whaleParts(tint) {
  return [
    _body(tint, 1.55, 1.05, [
      [0.02, -5.1],
      [0.28, -4.4],
      [0.95, -2.4],
      [1.28, 0.2],
      [1.05, 2.4],
      [0.55, 4.2],
      [0.12, 5.0],
    ]),
    _triFin(0, 0.62, -0.4, 0.55, 0.9, 0.22, tint),
    _triFin(0.55, 0.05, -4.7, 0.15, 1.6, 0.18, tint),
    _triFin(-0.55, 0.05, -4.7, 0.15, 1.6, 0.18, tint),
    _pec(1, tint, 1.25),
    _pec(-1, tint, 1.25),
  ];
}

function _dolphinParts(tint) {
  return [
    _body(tint, 0.95, 0.95),
    _triFin(0, 0.5, 0.05, 0.95, 1.15, 0.2, tint),
    _triFin(0.4, 0.02, -4.55, 0.12, 1.35, 0.16, tint),
    _triFin(-0.4, 0.02, -4.55, 0.12, 1.35, 0.16, tint),
    _pec(1, tint, 0.85),
    _pec(-1, tint, 0.85),
  ];
}

function _billfishParts(tint) {
  const bill = _triFin(0, 0.04, 4.6, 0.08, 2.4, 0.08, tint);
  const sail = _triFin(0, 0.45, 0.4, 1.85, 2.6, 0.1, tint);
  return [
    _body(tint, 0.55, 0.88),
    sail,
    bill,
    _triFin(0, 0.1, -4.55, 1.2, 1.45, 0.12, tint),
    _triFin(0, -0.08, -4.55, -1.05, 1.3, 0.12, tint),
    _pec(1, tint, 0.65),
    _pec(-1, tint, 0.65),
  ];
}

function _squidParts(tint) {
  const mantle = _body(tint, 1.15, 0.62, [
    [0.02, -4.2],
    [0.55, -3.4],
    [0.95, -1.2],
    [0.82, 1.4],
    [0.42, 3.6],
    [0.08, 4.6],
  ]);
  const tent = _triFin(0, -0.15, -4.1, -0.08, 2.8, 0.22, tint);
  const tent2 = _triFin(0.25, -0.1, -4.1, -0.06, 2.4, 0.16, tint);
  const tent3 = _triFin(-0.25, -0.1, -4.1, -0.06, 2.4, 0.16, tint);
  return [
    mantle,
    _triFin(0.7, 0.15, 0.8, 0.35, 1.4, 0.12, tint),
    _triFin(-0.7, 0.15, 0.8, 0.35, 1.4, 0.12, tint),
    tent,
    tent2,
    tent3,
  ];
}

function _shade(baseR, baseG, baseB, tint) {
  return [baseR * tint.r, baseG * tint.g, baseB * tint.b];
}

function _body(tint, width = 1, height = 0.78, ring = null) {
  const profile = (ring || [
    [0.01, -4.85],
    [0.12, -4.55],
    [0.42, -3.8],
    [0.72, -2.6],
    [0.95, -0.2],
    [0.7, 2.2],
    [0.28, 4.5],
    [0.02, 5.2],
  ]).map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(profile, 10);
  g.rotateX(-Math.PI / 2);
  g.scale(width, height, 1);
  const col = new Float32Array(g.attributes.position.count * 3);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = THREE.MathUtils.smoothstep(y, -0.45, 0.38);
    const [r, gc, b] = _shade(0.26 + t * 0.28, 0.3 + t * 0.26, 0.34 + t * 0.2, tint);
    col[i * 3] = r;
    col[i * 3 + 1] = gc;
    col[i * 3 + 2] = b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

function _triFin(x, y, z, h, length, thickness, tint) {
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
  const [r, gc, b] = _shade(0.2, 0.26, 0.32, tint);
  for (let i = 0; i < 5; i++) {
    col[i * 3] = r;
    col[i * 3 + 1] = gc;
    col[i * 3 + 2] = b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

function _pec(side, tint, span = 1) {
  const g = new THREE.BufferGeometry();
  const s = side;
  const verts = new Float32Array([
    0.55 * s, -0.15, 1.6,
    1.9 * s * span, -0.45, 0.9,
    0.5 * s, -0.2, 0.55,
  ]);
  g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  g.setIndex([0, 1, 2]);
  const a = _shade(0.28, 0.34, 0.38, tint);
  const b = _shade(0.22, 0.28, 0.33, tint);
  const c = _shade(0.3, 0.36, 0.4, tint);
  const col = new Float32Array([...a, ...b, ...c]);
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

export function syncSharkMesh(group, shark) {
  const spd = Math.hypot(shark.vx, shark.vy, shark.vz);
  const coast = !shark.bursting && !shark.lunging && shark.thrust < 0.5;
  const amp = (0.26 + Math.min(spd, 28) * 0.02) * (shark.lunging ? 1.55 : coast ? 0.52 : 1);
  if (group.userData.uSharkAmp) group.userData.uSharkAmp.value = amp;
  if (group.userData.uSharkPhase) group.userData.uSharkPhase.value = shark.swimT;
  const wag = Math.sin(shark.swimT) * 0.055 * (0.35 + amp) * (coast ? 0.45 : 1);
  const bob = Math.sin(shark.swimT + 0.6) * 0.018 * (0.4 + amp);
  group.position.set(shark.x, shark.y, shark.z);
  group.rotation.set(shark.pitch + bob, shark.yaw + wag, shark.roll + wag * 0.35, "YXZ");
  group.scale.setScalar(
    shark.scale * ((shark.cfg?.length ?? CONFIG.shark.length) / CONFIG.shark.length)
  );
  const fear = group.userData.fear;
  if (fear.visible) {
    const r = shark.fearRadius / Math.max(shark.scale, 0.01);
    fear.scale.setScalar(r);
    fear.children.forEach((ring) => {
      ring.material.opacity = shark.lunging ? 0.38 : 0.2;
    });
  }
}
