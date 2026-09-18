import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { attachWorldShading } from "./caustics.js";
import { authoredVehicleGeometry } from "./models.js";
import { CONFIG } from "../config.js";

/**
 * Vehicle silhouettes. Authored glTFs when preloadAuthoredMeshes has run;
 * procedural stand-ins otherwise. Swim is a separate shader mode so a whale
 * does not lateral-undulate like a shark.
 */

function prepare(g) {
  g.computeVertexNormals();
  const n = g.attributes.position.count;
  if (!g.attributes.uv) {
    g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  }
  return g;
}

const EYES = {
  shark: { x: 0.4, y: 0.18, z: 3.55, r: 0.09 },
  hammerhead: { x: 1.92, y: 0.08, z: 4.55, r: 0.1 },
  whaleshark: { x: 0.78, y: 0.2, z: 3.85, r: 0.08 },
  tuna: { x: 0.28, y: 0.12, z: 3.35, r: 0.07 },
  cod: { x: 0.34, y: 0.16, z: 3.28, r: 0.08 },
  whale: { x: 0.48, y: 0.22, z: 3.85, r: 0.07 },
  spermwhale: { x: 0.88, y: -0.38, z: 2.55, r: 0.06 },
  dolphin: { x: 0.3, y: 0.16, z: 3.72, r: 0.07 },
  orca: { x: 0.36, y: 0.22, z: 3.42, r: 0.08 },
  squid: { x: 0.52, y: 0.1, z: -0.62, r: 0.2 },
  billfish: { x: 0.2, y: 0.1, z: 3.42, r: 0.055 },
  mahi: { x: 0.28, y: 0.32, z: 3.35, r: 0.07 },
  barracuda: { x: 0.16, y: 0.08, z: 3.95, r: 0.05 },
};

export function createSharkMesh(uniforms, opts = {}) {
  const tint = opts.tint || { r: 1, g: 1, b: 1 };
  const form = opts.form || "shark";
  const kind = opts.kind || "";
  const sex = opts.sex ?? 0;
  const swim = opts.swim || swimForForm(form);
  const authored = authoredVehicleGeometry(form, sex, kind);
  const geo = authored
    ? authored
    : mergeGeometries(partsFor(form, tint, kind, sex).map(prepare), false);
  if (!authored) geo.computeVertexNormals();

  const uSharkAmp = { value: 0.55 };
  const uSharkPhase = { value: 0 };
  const uCoast = { value: 0 };
  const uLunge = { value: 0 };

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: form === "squid" ? 0.42 : form === "spermwhale" ? 0.88 : 0.72,
    metalness: form === "tuna" || form === "billfish" || form === "mahi" ? 0.12 : 0.04,
    side: THREE.DoubleSide,
    envMapIntensity: 0.15,
  });
  if (uniforms) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.uniforms.uSharkAmp = uSharkAmp;
      shader.uniforms.uSharkPhase = uSharkPhase;
      shader.uniforms.uCoast = uCoast;
      shader.uniforms.uLunge = uLunge;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `#include <common>
          uniform float uTime;
          uniform float uSharkAmp;
          uniform float uSharkPhase;
          uniform float uCoast;
          uniform float uLunge;
          `
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        swimVertex(swim, form, kind)
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <beginnormal_vertex>",
        swimNormal(swim)
      );
    };
    mat.customProgramCacheKey = () => `vehicle-swim-${form}-${swim}-${kind}-v5`;
    attachWorldShading(mat, uniforms);
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  // Authored orca already carries black/white COLOR_0. Catalog tint would
  // crush the patches (male tint is ~0.22). Scale still differs by sex.
  if (authored) mat.color.set(0xffffff);

  const group = new THREE.Group();
  group.add(mesh);

  if (!authored) {
    const eye = EYES[form] || EYES.shark;
    const eyeGeo = new THREE.SphereGeometry(eye.r, 8, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.3 });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    const eyeR = new THREE.Mesh(eyeGeo.clone(), eyeMat);
    eyeL.position.set(eye.x, eye.y, eye.z);
    eyeR.position.set(-eye.x, eye.y, eye.z);
    group.add(eyeL, eyeR);
  }

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
  group.userData.uCoast = uCoast;
  group.userData.uLunge = uLunge;
  group.userData.swim = swim;
  group.userData.form = form;
  return group;
}

function swimForForm(form) {
  if (form === "whale" || form === "spermwhale" || form === "dolphin" || form === "orca") return "fluke";
  if (form === "squid") return "jet";
  if (form === "tuna" || form === "billfish" || form === "mahi") return "thunniform";
  if (form === "cod" || form === "barracuda") return "body";
  return "tail";
}

function swimVertex(swim, form, kind) {
  const pecBeat =
    kind === "humpback" || form === "dolphin" || form === "orca"
      ? `
          if (abs(position.x) > 0.55 && position.z > -0.2 && position.z < 2.6) {
            float pec = (abs(position.x) - 0.55) / 2.4;
            transformed.y += sin(uSharkPhase * 0.7) * 0.22 * pec * min(uSharkAmp, 0.85);
          }`
      : "";
  if (swim === "fluke") {
    const bodyK = form === "dolphin" || form === "orca" ? "0.58" : form === "spermwhale" ? "0.74" : "0.38";
    const headK = form === "spermwhale" ? "0.04" : "0.14";
    return `
          vec3 transformed = vec3(position);
          float along = position.z;
          float bodyN = clamp((5.2 - along) / 10.4, 0.0, 1.0);
          float tail = smoothstep(${bodyK}, 1.0, bodyN);
          float head = 1.0 - smoothstep(0.0, 0.18, bodyN);
          float wave = sin(uSharkPhase - along * 0.42);
          float amp = uSharkAmp;
          transformed.y += wave * amp * (0.03 + pow(tail, 1.35) * 2.55);
          transformed.y -= sin(uSharkPhase) * amp * ${headK} * head;
          ${pecBeat}
          `;
  }
  if (swim === "jet") {
    return `
          vec3 transformed = vec3(position);
          float amp = uSharkAmp;
          float pulse = 0.5 + 0.5 * sin(uSharkPhase);
          float kick = pow(max(0.0, sin(uSharkPhase)), 1.7) * (1.0 - uCoast);
          float mantle = smoothstep(-1.2, 0.35, position.z);
          float radial = 1.0 + (pulse * 0.1 - kick * 0.22) * amp * mantle;
          transformed.x *= radial;
          transformed.y *= radial;
          float arm = 1.0 - mantle;
          float trail = sin(uSharkPhase - 1.25 - position.z * 0.5);
          transformed.x += trail * amp * (0.28 + uCoast * 0.45) * arm * arm * (0.25 + abs(position.x));
          transformed.y += cos(uSharkPhase * 0.9 - 0.7) * amp * 0.22 * arm * arm;
          transformed.z += kick * amp * 0.18 * arm - uLunge * arm * 1.15;
          float fin = smoothstep(0.55, 1.15, abs(position.x)) * smoothstep(0.9, 2.6, position.z);
          transformed.y += sin(uSharkPhase * 2.4) * 0.42 * fin * (0.25 + uCoast);
          `;
  }
  if (swim === "thunniform") {
    return `
          vec3 transformed = vec3(position);
          float along = position.z;
          float bodyN = clamp((5.2 - along) / 10.4, 0.0, 1.0);
          float tail = smoothstep(0.72, 1.0, bodyN);
          float wave = sin(uSharkPhase * 1.45 - along * 1.35);
          float amp = uSharkAmp * 0.62;
          transformed.x += wave * amp * pow(tail, 1.2) * 1.55;
          `;
  }
  const alongK = swim === "body" ? "0.88" : "0.62";
  const tailStart = swim === "body" ? "0.16" : "0.32";
  const tailPow = swim === "body" ? "1.25" : "1.65";
  const pec =
    swim === "body"
      ? `
          if (abs(position.x) > 0.52 && position.z > 0.35 && position.z < 2.05) {
            float pec = (abs(position.x) - 0.52) / 1.4;
            transformed.y += sin(uSharkPhase * 0.85) * 0.22 * sign(position.x) * pec * min(uSharkAmp, 0.6);
          }`
      : "";
  return `
          vec3 transformed = vec3(position);
          float along = position.z;
          float bodyN = clamp((5.2 - along) / 10.05, 0.0, 1.0);
          float tail = smoothstep(${tailStart}, 1.0, bodyN);
          float head = 1.0 - smoothstep(0.0, 0.28, bodyN);
          float phase = uSharkPhase;
          float wave = sin(phase - along * ${alongK});
          float amp = uSharkAmp;
          float lat = wave * amp * (0.05 + pow(tail, ${tailPow}) * 2.2);
          lat -= sin(phase) * amp * 0.2 * head;
          transformed.x += lat;
          transformed.y += cos(phase - along * 0.45) * amp * 0.09 * tail * tail;
          ${pec}
          `;
}

function swimNormal(swim) {
  if (swim === "fluke") {
    return `
          vec3 objectNormal = vec3(normal);
          float alongN = position.z;
          float tailN = smoothstep(0.36, 1.0, clamp((5.2 - alongN) / 10.4, 0.0, 1.0));
          float dWave = cos(uSharkPhase - alongN * 0.48) * 0.48;
          objectNormal.y += dWave * uSharkAmp * tailN * 0.45;
          objectNormal = normalize(objectNormal);
          `;
  }
  if (swim === "jet") {
    return `
          vec3 objectNormal = vec3(normal);
          objectNormal = normalize(objectNormal);
          `;
  }
  const alongK = swim === "thunniform" ? "1.2" : swim === "body" ? "0.88" : "0.62";
  const tailStart = swim === "thunniform" ? "0.64" : swim === "body" ? "0.16" : "0.32";
  return `
          vec3 objectNormal = vec3(normal);
          float alongN = position.z;
          float tailN = smoothstep(${tailStart}, 1.0, clamp((5.2 - alongN) / 10.05, 0.0, 1.0));
          float dWave = cos(uSharkPhase - alongN * ${alongK}) * ${alongK};
          objectNormal.x += dWave * uSharkAmp * tailN * 0.4;
          objectNormal = normalize(objectNormal);
          `;
}

function partsFor(form, tint, kind, sex) {
  switch (form) {
    case "whale":
      return _whaleParts(tint, kind);
    case "spermwhale":
      return _spermParts(tint);
    case "squid":
      return _squidParts(tint, kind);
    case "billfish":
      return _billfishParts(tint);
    case "dolphin":
      return _dolphinParts(tint);
    case "orca":
      return _orcaParts(tint, sex);
    case "tuna":
      return _tunaParts(tint, kind);
    case "cod":
      return _codParts(tint);
    case "mahi":
      return _mahiParts(tint);
    case "barracuda":
      return _barracudaParts(tint);
    case "hammerhead":
      return _hammerParts(tint);
    case "whaleshark":
      return _whaleSharkParts(tint);
    default:
      return _sharkParts(tint, kind);
  }
}

function _sharkParts(tint, kind) {
  const tiger = kind === "tigershark";
  const white = kind === "greatwhite";
  const paint = tiger
    ? (x, y, z, t) => {
        const stripe = Math.sin(z * 2.35 + x * 0.4) > 0.42 && y > -0.05;
        const [r, g, b] = _counter(t, tint, 0.22, 0.2, 0.12, 0.7, 0.62, 0.42);
        return stripe ? [r * 0.55, g * 0.5, b * 0.45] : [r, g, b];
      }
    : white
      ? (x, y, z, t) => _counter(t, tint, 0.42, 0.44, 0.46, 0.92, 0.9, 0.86)
      : (x, y, z, t) => _counter(t, tint, 0.18, 0.28, 0.42, 0.72, 0.78, 0.82);
  const snout = white
    ? [
        [0.02, -4.9],
        [0.18, -4.5],
        [0.55, -3.4],
        [0.88, -1.4],
        [0.92, 0.6],
        [0.7, 2.6],
        [0.42, 4.2],
        [0.12, 5.05],
      ]
    : null;
  return [
    _body(tint, white ? 1.12 : 1, white ? 0.88 : 0.78, snout, paint),
    _triFin(0, 0.52, 0.05, 1.35, 1.55, 0.22, tint),
    _triFin(0, 0.14, -4.55, 2.05, 1.95, 0.14, tint),
    _triFin(0, -0.06, -4.55, -0.82, 1.15, 0.12, tint),
    _pec(1, tint, 1.28, { reach: 2.55, y: -0.22 }),
    _pec(-1, tint, 1.28, { reach: 2.55, y: -0.22 }),
    _triFin(0, -0.42, -0.7, -0.42, 0.65, 0.12, tint),
  ];
}

function _hammerParts(tint) {
  const foil = new THREE.BoxGeometry(4.15, 0.14, 0.92);
  foil.translate(0, 0.06, 4.58);
  _paintSolid(foil, tint, 0.22, 0.3, 0.34);
  return [
    _body(tint, 0.92, 0.76, null, (x, y, z, t) => _counter(t, tint, 0.28, 0.34, 0.36, 0.7, 0.74, 0.72)),
    foil,
    _triFin(0, 0.52, 0.1, 1.15, 1.3, 0.24, tint),
    _triFin(0, 0.14, -4.55, 1.65, 1.75, 0.14, tint),
    _triFin(0, -0.06, -4.55, -0.85, 1.15, 0.12, tint),
    _pec(1, tint, 0.95),
    _pec(-1, tint, 0.95),
  ];
}

function _whaleSharkParts(tint) {
  const paint = (x, y, z, t) => {
    const [r, g, b] = _counter(t, tint, 0.22, 0.28, 0.34, 0.55, 0.58, 0.6);
    const h = Math.sin(x * 13.1 + y * 71.4 + z * 29.7) * 43758.5453;
    const fract = h - Math.floor(h);
    if (y > -0.08 && fract > 0.78) return [r + 0.28, g + 0.26, b + 0.22];
    return [r, g, b];
  };
  const mouth = new THREE.BoxGeometry(1.85, 0.28, 0.55);
  mouth.translate(0, -0.18, 4.85);
  _paintSolid(mouth, tint, 0.18, 0.2, 0.22);
  return [
    _body(
      tint,
      1.45,
      0.95,
      [
        [0.08, -5.0],
        [0.45, -4.3],
        [1.05, -2.2],
        [1.35, 0.2],
        [1.28, 2.4],
        [1.15, 4.0],
        [0.85, 4.85],
        [0.2, 5.15],
      ],
      paint
    ),
    mouth,
    _triFin(0, 0.62, -0.2, 0.72, 1.1, 0.22, tint),
    _triFin(0, 0.14, -4.55, 1.55, 1.7, 0.14, tint),
    _triFin(0, -0.06, -4.55, -0.95, 1.2, 0.12, tint),
    _pec(1, tint, 1.45, { y: -0.18, reach: 2.2 }),
    _pec(-1, tint, 1.45, { y: -0.18, reach: 2.2 }),
  ];
}

function _tunaParts(tint, kind) {
  const yellow = kind === "yellowfin";
  const blue = kind === "bluefin";
  const paint = (x, y, z, t) => {
    const [r, g, b] = _counter(
      t,
      tint,
      blue ? 0.12 : 0.18,
      blue ? 0.22 : 0.28,
      blue ? 0.38 : 0.48,
      0.78,
      0.8,
      0.72
    );
    const band = Math.sin(z * 4.2) > 0.55 && y > 0.05;
    return band ? [r * 0.7, g * 0.75, b * 0.85] : [r, g, b];
  };
  const parts = [
    _body(tint, 0.7, 0.95, null, paint),
    _triFin(0, 0.4, 0.35, 0.62, 0.95, 0.14, tint),
    _triFin(0, 0.08, -4.55, yellow ? 1.55 : 1.4, 1.15, 0.1, tint),
    _triFin(0, -0.06, -4.55, yellow ? -1.45 : -1.3, 1.1, 0.1, tint),
    _pec(1, tint, 0.62),
    _pec(-1, tint, 0.62),
  ];
  if (yellow) {
    parts.push(_triFin(0, 0.28, -1.8, 1.15, 2.4, 0.08, tint));
    parts.push(_triFin(0, -0.22, -1.8, -1.05, 2.3, 0.08, tint));
  }
  return parts;
}

function _codParts(tint) {
  const barb = new THREE.ConeGeometry(0.05, 0.45, 5);
  barb.rotateX(Math.PI * 0.65);
  barb.translate(0, -0.42, 4.35);
  _paintSolid(barb, tint, 0.35, 0.3, 0.22);
  return [
    _body(
      tint,
      1.05,
      0.92,
      [
        [0.04, -4.7],
        [0.28, -4.2],
        [0.78, -2.6],
        [1.05, -0.4],
        [0.95, 1.6],
        [0.62, 3.4],
        [0.32, 4.55],
        [0.08, 5.05],
      ],
      (x, y, z, t) => {
        const mottled = Math.sin(x * 6.2 + z * 3.4) * Math.sin(z * 2.1);
        const [r, g, b] = _counter(t, tint, 0.38, 0.32, 0.22, 0.7, 0.62, 0.45);
        const k = mottled > 0.25 ? 0.78 : 1;
        return [r * k, g * k, b * k];
      }
    ),
    barb,
    _triFin(0, 0.48, -0.4, 0.85, 1.35, 0.2, tint),
    _roundTail(tint),
    _pec(1, tint, 0.78),
    _pec(-1, tint, 0.78),
    _triFin(0, -0.38, -1.6, -0.38, 0.7, 0.1, tint),
  ];
}

function _whaleParts(tint, kind) {
  const hump = kind === "humpback";
  const pecSpan = hump ? 2.55 : 1.05;
  const paint = (x, y, z, t) => {
    let [r, g, b] = _counter(t, tint, 0.22, 0.24, 0.28, 0.55, 0.56, 0.58);
    if (hump && y < -0.12 && z > 0.4 && z < 4.2 && Math.abs(Math.sin(x * 9.5)) > 0.72) {
      r *= 0.72;
      g *= 0.72;
      b *= 0.75;
    }
    return [r, g, b];
  };
  return [
    _body(
      tint,
      hump ? 1.55 : 1.22,
      hump ? 1.08 : 0.92,
      hump
        ? [
            [0.04, -5.15],
            [0.32, -4.5],
            [1.02, -2.5],
            [1.38, 0.15],
            [1.12, 2.5],
            [0.58, 4.25],
            [0.16, 5.05],
          ]
        : [
            [0.03, -5.05],
            [0.22, -4.45],
            [0.72, -2.6],
            [0.98, 0.05],
            [0.82, 2.35],
            [0.42, 4.15],
            [0.12, 4.95],
          ],
      paint
    ),
    _triFin(0, hump ? 0.72 : 0.58, hump ? -1.15 : -0.35, hump ? 0.38 : 0.48, hump ? 0.85 : 0.72, 0.18, tint),
    _flukes(-4.85, hump ? 2.45 : 1.85, hump ? 1.75 : 1.45, tint),
    _pec(1, tint, pecSpan, { y: -0.32, reach: hump ? 3.15 : 1.55, z: 1.35 }),
    _pec(-1, tint, pecSpan, { y: -0.32, reach: hump ? 3.15 : 1.55, z: 1.35 }),
  ];
}

function _spermParts(tint) {
  const trunk = _body(
    tint,
    0.92,
    1.08,
    [
      [0.05, -5.42],
      [0.28, -4.72],
      [0.62, -3.35],
      [0.8, -1.65],
      [0.86, -0.05],
      [0.9, 1.25],
      [0.88, 2.15],
    ],
    (x, y, z, t) => {
      const wrinkle = 1 - Math.max(0, Math.sin(z * 10.5 + x * 4.2)) * 0.22;
      const [r, g, b] = _counter(t, tint, 0.2, 0.2, 0.2, 0.32, 0.31, 0.3);
      return [r * wrinkle, g * wrinkle, b * wrinkle];
    }
  );
  const head = new THREE.SphereGeometry(1, 18, 14);
  head.scale(0.92, 1.38, 2.08);
  {
    const pos = head.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      if (z > 1.52) pos.setZ(i, 1.52 + (z - 1.52) * 0.18);
    }
  }
  head.translate(0, 0.2, 3.22);
  _paintSolid(head, tint, 0.3, 0.29, 0.28);
  const brow = new THREE.SphereGeometry(0.82, 12, 10);
  brow.scale(0.88, 1.12, 0.42);
  brow.translate(0, 0.38, 5.02);
  _paintSolid(brow, tint, 0.32, 0.31, 0.3);
  const jaw = new THREE.CylinderGeometry(0.16, 0.2, 2.55, 8, 1, false);
  jaw.rotateX(Math.PI / 2);
  jaw.translate(0, -1.12, 4.08);
  _paintSolid(jaw, tint, 0.34, 0.32, 0.3);
  const hole = new THREE.SphereGeometry(0.15, 8, 6);
  hole.scale(1.2, 0.42, 1.15);
  hole.translate(-0.4, 1.38, 4.95);
  _paintSolid(hole, tint, 0.06, 0.06, 0.07);
  const parts = [
    trunk,
    head,
    brow,
    jaw,
    hole,
    _triFin(0, 0.62, -0.85, 0.32, 0.75, 0.22, tint),
    _flukes(-5.28, 2.55, 1.72, tint, true),
    _pec(1, tint, 0.48, { z: 0.85, y: -0.52, reach: 1.15 }),
    _pec(-1, tint, 0.48, { z: 0.85, y: -0.52, reach: 1.15 }),
  ];
  for (let i = 0; i < 4; i++) {
    parts.push(_triFin(0, 0.48, -1.55 - i * 0.72, 0.16 + i * 0.03, 0.34, 0.14, tint));
  }
  return parts;
}

function _dolphinParts(tint) {
  const beak = new THREE.ConeGeometry(0.2, 1.45, 8);
  beak.rotateX(-Math.PI / 2);
  beak.translate(0, -0.04, 5.35);
  _paintSolid(beak, tint, 0.55, 0.6, 0.62);
  return [
    _body(tint, 0.88, 0.9, null, (x, y, z, t) => _counter(t, tint, 0.28, 0.36, 0.46, 0.78, 0.8, 0.82)),
    beak,
    _triFin(0, 0.48, 0.05, 1.05, 1.15, 0.16, tint),
    _flukes(-4.65, 1.45, 1.15, tint),
    _pec(1, tint, 0.78),
    _pec(-1, tint, 0.78),
  ];
}

function _orcaParts(tint, sex) {
  const male = sex === 1;
  const patchL = _patch(0.42, 0.28, 3.35, 0.28, 0.18, 0.38, [0.92, 0.93, 0.95]);
  const patchR = _patch(-0.42, 0.28, 3.35, 0.28, 0.18, 0.38, [0.92, 0.93, 0.95]);
  const saddle = _patch(0, 0.55, 0.15, 0.55, 0.12, 0.7, [0.55, 0.56, 0.6]);
  return [
    _body(tint, 1.08, 1.02, null, (x, y, z, t) => {
      if (t > 0.48) return _shade(0.92, 0.93, 0.95, tint);
      return _shade(0.08, 0.08, 0.1, tint);
    }),
    patchL,
    patchR,
    saddle,
    _triFin(0, 0.55, 0.05, male ? 2.45 : 1.55, male ? 1.15 : 1.35, 0.22, tint),
    _flukes(-4.7, 1.85, 1.3, tint),
    _pec(1, tint, 1.12, { y: -0.28 }),
    _pec(-1, tint, 1.12, { y: -0.28 }),
  ];
}

function _billfishParts(tint) {
  const bill = new THREE.ConeGeometry(0.07, 2.65, 6);
  bill.rotateX(-Math.PI / 2);
  bill.translate(0, 0.04, 6.15);
  _paintSolid(bill, tint, 0.35, 0.42, 0.55);
  return [
    _body(tint, 0.52, 0.82, null, (x, y, z, t) => _counter(t, tint, 0.12, 0.32, 0.58, 0.7, 0.78, 0.82)),
    bill,
    _triFin(0, 0.38, 0.35, 2.55, 3.25, 0.07, tint),
    _triFin(0, 0.08, -4.55, 1.55, 1.15, 0.1, tint),
    _triFin(0, -0.06, -4.55, -1.4, 1.1, 0.1, tint),
    _pec(1, tint, 0.58),
    _pec(-1, tint, 0.58),
  ];
}

function _mahiParts(tint) {
  return [
    _body(
      tint,
      0.72,
      1.05,
      [
        [0.02, -4.85],
        [0.18, -4.4],
        [0.55, -2.8],
        [0.72, -0.6],
        [0.78, 1.4],
        [0.95, 3.15],
        [0.55, 4.35],
        [0.1, 4.85],
      ],
      (x, y, z, t) => {
        const gold = THREE.MathUtils.smoothstep(y, -0.1, 0.45);
        return _shade(0.18 + gold * 0.7, 0.55 + gold * 0.28, 0.28 + t * 0.2, tint);
      }
    ),
    _triFin(0, 0.52, 0.55, 1.35, 5.05, 0.09, tint),
    _triFin(0, 0.08, -4.55, 1.25, 1.05, 0.1, tint),
    _triFin(0, -0.06, -4.55, -1.15, 1.0, 0.1, tint),
    _pec(1, tint, 0.7),
    _pec(-1, tint, 0.7),
  ];
}

function _barracudaParts(tint) {
  const jaw = new THREE.BoxGeometry(0.18, 0.16, 1.35);
  jaw.translate(0, -0.12, 5.15);
  _paintSolid(jaw, tint, 0.55, 0.62, 0.58);
  return [
    _body(
      tint,
      0.42,
      0.58,
      [
        [0.02, -4.95],
        [0.12, -4.5],
        [0.32, -2.8],
        [0.4, -0.4],
        [0.38, 1.8],
        [0.28, 3.6],
        [0.16, 4.7],
        [0.05, 5.35],
      ],
      (x, y, z, t) => _counter(t, tint, 0.32, 0.42, 0.38, 0.78, 0.82, 0.76)
    ),
    jaw,
    _triFin(0, 0.28, 0.4, 0.42, 0.7, 0.1, tint),
    _triFin(0, 0.08, -4.55, 1.15, 1.05, 0.1, tint),
    _triFin(0, -0.06, -4.55, -1.05, 1.0, 0.1, tint),
    _pec(1, tint, 0.48),
    _pec(-1, tint, 0.48),
  ];
}

function _squidParts(tint, kind) {
  const giant = kind === "giantsquid";
  const mantle = _body(
    tint,
    giant ? 1.05 : 0.95,
    giant ? 0.72 : 0.62,
    [
      [0.04, 5.05],
      [0.48, 3.6],
      [0.88, 1.5],
      [0.95, -0.15],
      [0.72, -1.05],
      [0.22, -1.45],
    ],
    (x, y, z, t) => _counter(t, tint, 0.55, 0.28, 0.22, 0.72, 0.48, 0.38)
  );
  const parts = [
    mantle,
    _sideFin(1, tint),
    _sideFin(-1, tint),
  ];
  const armN = 8;
  for (let i = 0; i < armN; i++) {
    const a = (i / armN) * Math.PI * 2;
    const r = 0.32;
    parts.push(_arm(Math.cos(a) * r, Math.sin(a) * r * 0.7, -1.35, giant ? -4.2 : -3.35, 0.07, tint));
  }
  const tent = giant ? -7.4 : -5.1;
  parts.push(_arm(0.18, -0.08, -1.4, tent, 0.055, tint));
  parts.push(_arm(-0.18, -0.08, -1.4, tent, 0.055, tint));
  return parts;
}

function _shade(baseR, baseG, baseB, tint) {
  return [baseR * tint.r, baseG * tint.g, baseB * tint.b];
}

function _counter(t, tint, br, bg, bb, wr, wg, wb) {
  return _shade(br + t * (wr - br), bg + t * (wg - bg), bb + t * (wb - bb), tint);
}

function _body(tint, width = 1, height = 0.78, ring = null, paint = null) {
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
  const g = new THREE.LatheGeometry(profile, 12);
  g.rotateX(-Math.PI / 2);
  g.scale(width, height, 1);
  const col = new Float32Array(g.attributes.position.count * 3);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = 1 - THREE.MathUtils.smoothstep(y, -0.45, 0.38);
    const [r, gc, b] = paint ? paint(x, y, z, t) : _counter(t, tint, 0.26, 0.3, 0.34, 0.54, 0.56, 0.54);
    col[i * 3] = r;
    col[i * 3 + 1] = gc;
    col[i * 3 + 2] = b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

function _paintSolid(g, tint, r, gc, b) {
  const [sr, sg, sb] = _shade(r, gc, b, tint);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = sr;
    col[i * 3 + 1] = sg;
    col[i * 3 + 2] = sb;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
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
    x, y + h * 0.15, z + length,
  ]);
  g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 1, 4, 2, 3, 2, 5, 4, 5, 2]);
  const col = new Float32Array(6 * 3);
  const [r, gc, b] = _shade(0.2, 0.26, 0.32, tint);
  for (let i = 0; i < 6; i++) {
    col[i * 3] = r;
    col[i * 3 + 1] = gc;
    col[i * 3 + 2] = b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

function _roundTail(tint) {
  return _triFin(0, 0.02, -4.45, 0.85, 1.05, 0.22, tint);
}

function _sideFin(side, tint) {
  const g = new THREE.BufferGeometry();
  const s = side;
  const verts = new Float32Array([
    0.45 * s, 0.04, 3.15,
    1.85 * s, 0.02, 2.05,
    0.42 * s, 0.0, 0.95,
  ]);
  g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  g.setIndex([0, 1, 2]);
  const a = _shade(0.45, 0.28, 0.22, tint);
  const b = _shade(0.38, 0.22, 0.18, tint);
  const c = _shade(0.5, 0.32, 0.24, tint);
  const col = new Float32Array([...a, ...b, ...c]);
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

function _flukes(z, span, length, tint, triangular = false) {
  const g = new THREE.BufferGeometry();
  const t = 0.07;
  const verts = triangular
    ? new Float32Array([
        0, t, z,
        span, 0, z - length,
        span * 0.06, 0, z - length * 0.72,
        0, -t, z,
        -span, 0, z - length,
        -span * 0.06, 0, z - length * 0.72,
      ])
    : new Float32Array([
        0, t, z,
        span, 0, z - length * 0.18,
        span * 0.18, 0, z - length,
        0, -t, z,
        -span, 0, z - length * 0.18,
        -span * 0.18, 0, z - length,
      ]);
  g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 3, 2, 1, 0, 4, 5, 0, 5, 3, 3, 5, 4]);
  const col = new Float32Array(6 * 3);
  const [r, gc, b] = _shade(0.22, 0.24, 0.28, tint);
  for (let i = 0; i < 6; i++) {
    col[i * 3] = r;
    col[i * 3 + 1] = gc;
    col[i * 3 + 2] = b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

function _pec(side, tint, span = 1, opts = {}) {
  const g = new THREE.BufferGeometry();
  const s = side;
  const z = opts.z ?? 1.6;
  const y = opts.y ?? -0.15;
  const reach = (opts.reach ?? 1.9) * span;
  const verts = new Float32Array([
    0.55 * s, y, z,
    reach * s, y - 0.32 * span, z - 0.7,
    0.48 * s, y - 0.05, z - 1.05,
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

function _arm(x, y, z0, z1, r, tint) {
  const len = Math.abs(z0 - z1);
  const g = new THREE.CylinderGeometry(r * 0.28, r, len, 5, 1, true);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, (z0 + z1) * 0.5);
  _paintSolid(g, tint, 0.5, 0.32, 0.26);
  return g;
}

function _patch(x, y, z, sx, sy, sz, rgb) {
  const g = new THREE.SphereGeometry(1, 8, 6);
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = rgb[0];
    col[i * 3 + 1] = rgb[1];
    col[i * 3 + 2] = rgb[2];
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

export function syncSharkMesh(group, shark) {
  const spd = Math.hypot(shark.vx, shark.vy, shark.vz);
  const swim = group.userData.swim || "tail";
  const jet = swim === "jet";
  const coast = !shark.bursting && !shark.lunging && shark.thrust < 0.5;
  const len = shark.cfg?.length ?? CONFIG.shark.length;
  const logging =
    shark.cfg?.breathes && shark.surfacing && shark.y > (shark.cfg.minDepth ?? -2) - 3.2;
  const amp =
    (0.26 + Math.min(spd, 28) * 0.02) *
    (shark.lunging ? 1.55 : logging ? 0.16 : coast ? (jet ? 0.28 : 0.52) : 1);
  if (group.userData.uSharkAmp) group.userData.uSharkAmp.value = amp;
  if (group.userData.uSharkPhase) group.userData.uSharkPhase.value = shark.swimT;
  if (group.userData.uCoast) {
    group.userData.uCoast.value = jet ? (shark.bursting ? 0 : 1) : coast ? 1 : 0;
  }
  if (group.userData.uLunge) group.userData.uLunge.value = shark.lunging || shark.aiMode === "strike" ? 1 : 0;
  group.position.set(shark.x, shark.y, shark.z);
  if (swim === "fluke") {
    const beat =
      Math.sin(shark.swimT) * (len > 8 ? 0.042 : 0.08) * (0.35 + amp) * (coast ? 0.4 : 1);
    group.rotation.set(shark.pitch + beat, shark.yaw, shark.roll, "YXZ");
  } else if (jet) {
    const roll = Math.sin(shark.swimT * (coast ? 2.2 : 0.5)) * (coast ? 0.08 : 0.03);
    group.rotation.set(shark.pitch, shark.yaw, shark.roll * 0.35 + roll, "YXZ");
  } else {
    const wag = Math.sin(shark.swimT) * 0.055 * (0.35 + amp) * (coast ? 0.45 : 1);
    const bob = Math.sin(shark.swimT + 0.6) * 0.018 * (0.4 + amp);
    const wagMul = swim === "thunniform" ? 0.35 : 1;
    group.rotation.set(shark.pitch + bob, shark.yaw + wag * wagMul, shark.roll + wag * 0.28 * wagMul, "YXZ");
  }
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
