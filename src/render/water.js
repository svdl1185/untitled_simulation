import * as THREE from "three";
import { CONFIG } from "../config.js";
import { seafloorHeight } from "../simulation/obstacles.js";
import { attachWorldShading } from "./caustics.js";

function _xzExtent() {
  const pad = 48;
  const minZ = -CONFIG.halfZ - pad * 0.4;
  const maxZ = CONFIG.beach.endZ + pad;
  return {
    spanX: CONFIG.halfX * 2 + pad * 2,
    spanZ: maxZ - minZ,
    zCenter: (minZ + maxZ) * 0.5,
  };
}

export function createWaterSurface(uniforms) {
  const ext = _xzExtent();
  const geo = new THREE.PlaneGeometry(ext.spanX, ext.spanZ, 96, 108);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, ext.zCenter);
  const shoreZ = CONFIG.beach.shoreZ.toFixed(1);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: uniforms.uTime,
      uCamY: uniforms.uCamY,
      uStorm: uniforms.uStorm,
      uSunDir: uniforms.uSunDir,
      uWaterAbove: uniforms.uWaterAbove,
      uWaterBelow: uniforms.uWaterBelow,
      uWaterFres: uniforms.uWaterFres,
    },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: true,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uStorm;
      varying vec3 vN;
      varying vec3 vWorld;

      void gerstner(inout vec3 p, inout vec3 nAcc, vec2 dir, float steep, float wl, float speed) {
        float k = 6.28318530718 / wl;
        float a = steep / k;
        float theta = k * dot(dir, p.xz) - speed * uTime;
        float s = sin(theta);
        float c = cos(theta);
        p.x += dir.x * a * c;
        p.z += dir.y * a * c;
        p.y += a * s;
        nAcc.x += -dir.x * k * a * c;
        nAcc.y += 1.0;
        nAcc.z += -dir.y * k * a * c;
      }

      void main() {
        vec3 p = position;
        vec3 nAcc = vec3(0.0);
        float chop = 1.0 + uStorm * 0.85;
        float zWave = p.z - 14.0 * sin(p.x * 0.0105) - 5.5 * sin(p.x * 0.028);
        float shore = smoothstep(${shoreZ} - 28.0, ${shoreZ} + 8.0, zWave);
        chop *= 1.0 - shore * 0.85;
        gerstner(p, nAcc, normalize(vec2(1.0, 0.35)), 0.14 * chop, 28.0, 1.15);
        gerstner(p, nAcc, normalize(vec2(-0.6, 1.0)), 0.09 * chop, 17.0, 1.55);
        gerstner(p, nAcc, normalize(vec2(0.2, -1.0)), 0.05 * chop, 9.0, 2.1);
        vN = normalize(nAcc);
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uCamY;
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uWaterAbove;
      uniform vec3 uWaterBelow;
      uniform vec3 uWaterFres;
      varying vec3 vN;
      varying vec3 vWorld;

      void main() {
        float zWave = vWorld.z - 14.0 * sin(vWorld.x * 0.0105) - 5.5 * sin(vWorld.x * 0.028);
        float shore = smoothstep(${shoreZ} - 22.0, ${shoreZ} + 4.0, zWave);
        if (shore > 0.97) discard;
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        float fromAbove = smoothstep(-0.4, 1.2, uCamY);
        float ndv = abs(dot(N, V));
        vec3 above = mix(uWaterAbove, uWaterFres, 0.35 * ndv);
        above = mix(above, uWaterFres, fres * 0.4);
        float window = smoothstep(0.5, 0.88, ndv);
        vec3 below = mix(uWaterBelow * 0.7, uWaterBelow * 1.4, window * 0.55);
        float sunGlint = pow(max(dot(reflect(-normalize(uSunDir), N), V), 0.0), 80.0);
        above += vec3(1.0, 0.95, 0.85) * sunGlint * 0.45 * fromAbove;
        float foamBand = 1.0 - smoothstep(0.0, 0.28, abs(shore - 0.58));
        float foam = foamBand * (0.4 + 0.6 * sin(vWorld.x * 0.35 + uTime * 2.4 + zWave * 0.2));
        above = mix(above, vec3(0.92, 0.96, 0.98), foam * 0.7 * fromAbove);
        below = mix(below, vec3(0.55, 0.72, 0.78), foam * 0.25);
        vec3 col = mix(below, above, fromAbove);
        float alpha = mix(0.78, 0.62, fromAbove) * (1.0 - shore);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = CONFIG.surfaceY;
  mesh.renderOrder = 2;
  return mesh;
}

export function createSeafloor(uniforms) {
  const ext = _xzExtent();
  const geo = new THREE.PlaneGeometry(ext.spanX, ext.spanZ, 160, 176);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, ext.zCenter);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = seafloorHeight(x, z);
    pos.setY(i, h - CONFIG.floorY);
    const wet = THREE.MathUtils.smoothstep(h, -7, 0.15);
    const dry = THREE.MathUtils.smoothstep(h, -0.4, 3.8);
    const r = 0.78 + wet * 0.08 + dry * 0.16;
    const g = 0.62 + wet * 0.04 + dry * 0.14;
    const b = 0.38 + wet * -0.04 + dry * 0.12;
    col[i * 3] = r * (1 - dry * 0.05);
    col[i * 3 + 1] = g;
    col[i * 3 + 2] = b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();

  const tex = _sandTexture();
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.95,
    metalness: 0,
    vertexColors: true,
    color: 0xffffff,
  });
  attachWorldShading(mat, uniforms);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = CONFIG.floorY;
  return mesh;
}

function _sandTexture() {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const n =
        ((Math.sin(x * 0.17) + Math.sin(y * 0.13)) * 0.5 +
          ((x * 13 + y * 17) % 9) * 0.04) *
        18;
      data[i] = 210 + n;
      data[i + 1] = 176 + n * 0.7;
      data[i + 2] = 112 + n * 0.4;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 18);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSandDetail(uniforms) {
  const group = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x8a7660,
    roughness: 0.95,
    metalness: 0,
  });
  attachWorldShading(rockMat, uniforms);
  const pebbleMat = new THREE.MeshStandardMaterial({
    color: 0xd4b88a,
    roughness: 0.9,
    metalness: 0,
  });
  attachWorldShading(pebbleMat, uniforms);
  for (let i = 0; i < 28; i++) {
    const g = new THREE.SphereGeometry(0.55 + Math.random() * 0.9, 7, 5);
    const m = new THREE.Mesh(g, rockMat);
    const a = Math.random() * Math.PI * 2;
    const r = 22 + Math.random() * (CONFIG.halfX * 0.7);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    m.position.set(x, seafloorHeight(x, z) + 0.12, z);
    m.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
    m.scale.set(1.2 + Math.random() * 0.4, 0.28 + Math.random() * 0.18, 1 + Math.random() * 0.35);
    group.add(m);
  }
  for (let i = 0; i < 50; i++) {
    const g = new THREE.SphereGeometry(0.2 + Math.random() * 0.4, 5, 4);
    const m = new THREE.Mesh(g, pebbleMat);
    const x = (Math.random() - 0.5) * CONFIG.halfX * 1.6;
    const z = (Math.random() - 0.5) * CONFIG.halfZ * 1.4;
    m.position.set(x, seafloorHeight(x, z) + 0.12, z);
    m.scale.y = 0.45;
    group.add(m);
  }
  const dryMat = new THREE.MeshStandardMaterial({
    color: 0xe8d4a8,
    roughness: 0.98,
    metalness: 0,
  });
  attachWorldShading(dryMat, uniforms);
  for (let i = 0; i < 36; i++) {
    const g = new THREE.SphereGeometry(0.35 + Math.random() * 1.1, 6, 5);
    const m = new THREE.Mesh(g, i % 3 === 0 ? rockMat : dryMat);
    const x = (Math.random() - 0.5) * CONFIG.halfX * 1.7;
    const z = CONFIG.beach.startZ + 20 + Math.random() * (CONFIG.beach.endZ - CONFIG.beach.startZ);
    m.position.set(x, seafloorHeight(x, z) + 0.15, z);
    m.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.5);
    m.scale.set(1.1 + Math.random(), 0.22 + Math.random() * 0.2, 0.9 + Math.random() * 0.4);
    group.add(m);
  }
  return group;
}

export function createThermocline(uniforms) {
  const span = CONFIG.halfX * 2 + 40;
  const geo = new THREE.PlaneGeometry(span, span, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const thermoY = CONFIG.thermoY.toFixed(1);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: uniforms.uTime,
      uCamY: uniforms.uCamY,
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uCamY;
      varying vec3 vWorld;
      void main() {
        float near = 1.0 - smoothstep(5.0, 22.0, abs(uCamY - (${thermoY})));
        float ripple = 0.5 + 0.5 * sin(vWorld.x * 0.04 + uTime * 0.15);
        float alpha = 0.045 * near * (0.65 + 0.35 * ripple);
        gl_FragColor = vec4(0.55, 0.78, 0.82, alpha);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = CONFIG.thermoY;
  mesh.renderOrder = 1;
  return mesh;
}
