import * as THREE from "three";
import { CONFIG } from "../config.js";
import { seafloorHeight } from "../simulation/obstacles.js";
import { attachWorldShading, setRockSlots } from "./caustics.js";

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hash3(x, y, z) {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function fbm(x, y, z) {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < 5; i++) {
    v += a * (hash3(x * f, y * f, z * f) * 2 - 1);
    a *= 0.5;
    f *= 2.13;
  }
  return v;
}

const SITES = [
  { x: 54, z: 36, seed: 1101, scale: 1.15, count: 5 },
  { x: -48, z: 64, seed: 2202, scale: 0.95, count: 4 },
  { x: 22, z: -74, seed: 3303, scale: 1.32, count: 6 },
  { x: -76, z: -30, seed: 4404, scale: 0.88, count: 4 },
  { x: 90, z: -6, seed: 5505, scale: 1.08, count: 5 },
  { x: -8, z: 10, seed: 6606, scale: 0.78, count: 3 },
  { x: 38, z: -168, seed: 7707, scale: 1.22, count: 5 },
  { x: -122, z: -188, seed: 8808, scale: 1.05, count: 4 },
];

const WRECK = { x: -102, z: 78 };

export function createOutcrops(uniforms, opts = {}) {
  const canned = opts.canned !== false && (opts.canned || CONFIG.world?.statics);
  const group = new THREE.Group();
  if (!canned) {
    setRockSlots(uniforms, new Float32Array(0), 0);
    return {
      group,
      colliders: null,
      colliderCount: 0,
      sites: [],
      update() {},
    };
  }
  const colliders = [];
  const tex = _rockTexture();
  const rockMat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.94,
    metalness: 0.03,
    vertexColors: true,
    color: 0xc8c0b4,
  });
  attachWorldShading(rockMat, uniforms);
  const wreckMat = new THREE.MeshStandardMaterial({
    color: 0x5a4a3a,
    roughness: 0.82,
    metalness: 0.12,
  });
  attachWorldShading(wreckMat, uniforms);

  for (const site of SITES) {
    group.add(_mound(site, rockMat, colliders));
  }
  group.add(_wreck(wreckMat, colliders));

  const colliderArray = new Float32Array(colliders.length * 4);
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    colliderArray[i * 4] = c.x;
    colliderArray[i * 4 + 1] = c.y;
    colliderArray[i * 4 + 2] = c.z;
    colliderArray[i * 4 + 3] = c.r;
  }
  setRockSlots(uniforms, colliderArray, colliders.length);

  const bubbles = _bubbles(colliders);
  group.add(bubbles.points);

  return {
    group,
    colliders: colliderArray,
    colliderCount: colliders.length,
    sites: SITES.map((s) => ({ x: s.x, z: s.z, y: seafloorHeight(s.x, s.z) })),
    update(dt, look) {
      bubbles.update(dt, look);
    },
  };
}

function _mound(site, mat, colliders) {
  const group = new THREE.Group();
  const rand = rng(site.seed);
  const baseY = seafloorHeight(site.x, site.z);
  const n = site.count;
  for (let i = 0; i < n; i++) {
    const whale = i === 0 && rand() > 0.4;
    const geo = _boulderGeo(site.seed + i * 97, whale);
    const mesh = new THREE.Mesh(geo, mat);
    const spread = 4.2 * site.scale;
    const ox = (rand() - 0.5) * spread * 2;
    const oz = (rand() - 0.5) * spread * 2;
    const w = (whale ? 7.5 : 3.6 + rand() * 3.4) * site.scale;
    const d = (whale ? 4.2 : 3.2 + rand() * 2.6) * site.scale;
    const h = (whale ? 2.4 : 1.7 + rand() * 1.5) * site.scale;
    mesh.position.set(site.x + ox, baseY + h * 0.18, site.z + oz);
    mesh.rotation.y = rand() * Math.PI * 2;
    mesh.rotation.x = (rand() - 0.5) * 0.18;
    mesh.rotation.z = (rand() - 0.5) * 0.16;
    mesh.scale.set(w, h, d);
    group.add(mesh);
    const radius = Math.max(w, d) * 0.52 + h * 0.2;
    colliders.push({
      x: mesh.position.x,
      y: mesh.position.y + h * 0.15,
      z: mesh.position.z,
      r: radius,
    });
  }
  colliders.push({
    x: site.x,
    y: baseY + 1.2 * site.scale,
    z: site.z,
    r: 5.2 * site.scale,
  });
  return group;
}

function _boulderGeo(seed, elongated) {
  const geo = new THREE.IcosahedronGeometry(1, 3);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const ox = (seed % 17) * 0.37;
  const oy = (seed % 23) * 0.29;
  const oz = (seed % 11) * 0.41;
  const stretch = elongated ? 1.55 : 1;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i) * stretch;
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const n = fbm(x * 1.4 + ox, y * 1.4 + oy, z * 1.4 + oz);
    const n2 = fbm(x * 3.2 + oz, y * 3.2 + ox, z * 3.2 + oy);
    const s = 1 + n * 0.2 + n2 * 0.08;
    x *= s;
    y *= s;
    z *= s;
    y *= 0.58;
    if (y < 0.05) {
      const t = 1 - y;
      x *= 1 + t * 0.22;
      z *= 1 + t * 0.22;
      y = -0.42 + y * 0.22;
    }
    y -= 0.12;
    pos.setXYZ(i, x, y, z);
    const cave = Math.max(0, -n);
    const wet = THREE.MathUtils.clamp((-y + 0.2) * 0.45, 0, 0.35);
    col[i * 3] = 0.42 - cave * 0.12 - wet * 0.08;
    col[i * 3 + 1] = 0.4 - cave * 0.1 - wet * 0.04;
    col[i * 3 + 2] = 0.36 - cave * 0.08;
  }
  pos.needsUpdate = true;
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

function _rockTexture() {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const n =
        fbm(x * 0.035, y * 0.035, 1.7) * 18 +
        fbm(x * 0.11, y * 0.11, 4.2) * 8 +
        (((x * 19 + y * 13) % 11) - 5);
      data[i] = 118 + n;
      data[i + 1] = 108 + n * 0.85;
      data[i + 2] = 92 + n * 0.65;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function _wreck(mat, colliders) {
  const group = new THREE.Group();
  const y = seafloorHeight(WRECK.x, WRECK.z) + 0.6;
  group.position.set(WRECK.x, y, WRECK.z);
  group.rotation.y = 0.7;
  group.rotation.z = 0.14;

  const hull = new THREE.Mesh(new THREE.BoxGeometry(16, 2.4, 5.4), mat);
  group.add(hull);
  const rib = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.28, 5.6), mat);
  rib.position.y = 1.1;
  group.add(rib);
  const stern = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.2, 5.0), mat);
  stern.position.set(-7.4, 0.5, 0);
  group.add(stern);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 4.2, 6), mat);
  mast.position.set(2.2, 1.8, 0.4);
  mast.rotation.z = 1.18;
  mast.rotation.x = 0.18;
  group.add(mast);

  colliders.push({ x: WRECK.x, y: y + 0.4, z: WRECK.z, r: 8.2 });
  return group;
}

function _bubbles(colliders) {
  const n = 220;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const home = new Float32Array(n * 3);
  const speed = new Float32Array(n);
  const big = colliders.filter((c) => c.r > 3.2);
  const src = big.length ? big : colliders;
  for (let i = 0; i < n; i++) {
    const c = src[i % src.length];
    const a = Math.random() * Math.PI * 2;
    const r = c.r * (0.25 + Math.random() * 0.55);
    home[i * 3] = c.x + Math.cos(a) * r;
    home[i * 3 + 1] = c.y - c.r * 0.15;
    home[i * 3 + 2] = c.z + Math.sin(a) * r;
    pos[i * 3] = home[i * 3];
    pos[i * 3 + 1] = home[i * 3 + 1] + Math.random() * 6;
    pos[i * 3 + 2] = home[i * 3 + 2];
    speed[i] = 0.35 + Math.random() * 0.7;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xcfe8ee,
    size: 0.11,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return {
    points,
    update(dt, look) {
      const lift = 1 + look.caustic * 0.4;
      mat.opacity = 0.12 + look.caustic * 0.22;
      for (let i = 0; i < n; i++) {
        pos[i * 3 + 1] += speed[i] * lift * dt;
        pos[i * 3] += Math.sin(pos[i * 3 + 1] * 0.8 + i) * dt * 0.15;
        if (pos[i * 3 + 1] > home[i * 3 + 1] + 8) {
          pos[i * 3] = home[i * 3];
          pos[i * 3 + 1] = home[i * 3 + 1];
          pos[i * 3 + 2] = home[i * 3 + 2];
        }
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
