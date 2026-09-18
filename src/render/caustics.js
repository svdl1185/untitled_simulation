import * as THREE from "three";
import { openPhoticY } from "../config.js";
import { iceTransmit } from "../simulation/ice.js";

export const ROCK_SLOT_COUNT = 8;

export function createWorldUniforms() {
  return {
    uTime: { value: 0 },
    uCamY: { value: -10 },
    uSunDir: { value: new THREE.Vector3(0.25, 0.85, 0.2) },
    uCaustic: { value: 1 },
    uStorm: { value: 0 },
    uHour: { value: 10.4 },
    uSharkAmp: { value: 0.55 },
    uSharkPhase: { value: 0 },
    uRocks: {
      value: Array.from({ length: ROCK_SLOT_COUNT }, () => new THREE.Vector4()),
    },
    uWaterAbove: { value: new THREE.Vector3(0.04, 0.16, 0.18) },
    uWaterBelow: { value: new THREE.Vector3(0.02, 0.11, 0.13) },
    uWaterFres: { value: new THREE.Vector3(0.42, 0.64, 0.72) },
    uSkyZenith: { value: new THREE.Vector3(0.35, 0.62, 0.88) },
    uSkyHorizon: { value: new THREE.Vector3(0.72, 0.84, 0.9) },
    uPhoticY: { value: -180 },
    uIce: { value: 0 },
    uIceT: { value: 1 },
    uLampPos: { value: new THREE.Vector3() },
    uLampDir: { value: new THREE.Vector3(0, 0, -1) },
    uLampI: { value: 0 },
  };
}

export const WORLD_GLSL = /* glsl */ `
uniform vec3 uSunDir;
uniform float uTime;
uniform float uCaustic;
uniform float uStorm;
uniform float uPhoticY;
uniform float uGlow;
uniform float uIceT;
uniform vec3 uLampPos;
uniform vec3 uLampDir;
uniform float uLampI;
uniform vec4 uRocks[8];

float worldCaustic(vec3 w) {
  float depth = smoothstep(uPhoticY + 6.0, -5.0, w.y) * (1.0 - smoothstep(-1.4, 0.35, w.y));
  if (uCaustic < 0.01 || depth < 0.01) return 0.0;
  vec2 uv = w.xz * 0.07;
  uv += uSunDir.xz * (-w.y) * 0.035;
  float t = uTime * 0.32;
  vec2 p = uv + 0.22 * vec2(sin(uv.y * 1.9 + t), cos(uv.x * 1.6 - t * 0.85));
  float n = sin(p.x * 2.8 + p.y * 0.35 + t);
  n += sin(-p.x * 0.55 + p.y * 2.5 - t * 1.05);
  n += 0.5 * sin((p.x + p.y) * 1.9 + t * 0.62);
  float spec = pow(clamp(0.55 + 0.28 * n, 0.0, 1.0), 5.0);
  return spec * depth * uCaustic * (1.0 - uStorm * 0.85);
}

float rockLee(vec3 w) {
  vec2 sunxz = uSunDir.xz;
  float sl = length(sunxz);
  if (sl < 1e-4) return 1.0;
  sunxz /= sl;
  vec2 anti = -sunxz;
  float shade = 1.0;
  for (int i = 0; i < 8; i++) {
    float rad = uRocks[i].w;
    if (rad < 0.2) continue;
    vec2 rel = w.xz - uRocks[i].xz;
    float along = dot(rel, anti);
    vec2 perp = rel - anti * along;
    float pr = length(perp);
    float span = rad * 3.5;
    float width = rad * 1.2;
    if (along > 0.0 && along < span && pr < width) {
      float a = 1.0 - along / span;
      float p = 1.0 - pr / width;
      shade *= 1.0 - 0.58 * a * p;
    }
    float d = length(rel);
    shade *= mix(0.62, 1.0, smoothstep(rad * 0.35, rad * 1.75, d));
  }
  return shade;
}

vec3 applyWorldLight(vec3 col, vec3 w) {
  float lee = rockLee(w);
  float c = worldCaustic(w) * lee;
  float depth = max(0.0, -w.y);
  // uPhoticY is optical 1% light (openPhoticY), never the seafloor.
  float photic = max(24.0, -uPhoticY);
  float par = uIceT * exp(-(log(100.0) / photic) * depth);
  float clear = clamp(sqrt(par / 0.18), 0.0, 1.0);
  // Camera lamp is optics, not habitat: a local beam restores clear so
  // Kd does not eat the fill. Does not feed visualRange.
  float lamp = 0.0;
  if (uLampI > 0.001) {
    vec3 toFrag = w - uLampPos;
    float dist = length(toFrag);
    if (dist > 0.02) {
      float beam = smoothstep(0.38, 0.84, dot(toFrag / dist, uLampDir));
      lamp = uLampI * beam * exp(-dist * 0.034) * smoothstep(78.0, 5.0, dist);
      lamp = clamp(lamp, 0.0, 1.0);
    }
  }
  clear = max(clear, lamp);
  vec3 abyss = vec3(0.008, 0.016, 0.035);
  col *= 0.74 + 0.26 * lee;
  col += col * c * 0.62;
  col = mix(col, col * vec3(0.32, 0.52, 0.6), (1.0 - clear) * 0.5 * smoothstep(0.0, 0.12, par));
  col = mix(col, abyss, (1.0 - clear) * (1.0 - clear) * 0.92);
  col *= 0.08 + 0.92 * clear;
  col += uGlow * vec3(0.55, 0.85, 0.45) * (1.0 - clear);
  // Post-fog / post-tonemap fill: lift the beam so a nearby animal is readable
  // even when night sun and Kd have already gone to abyss.
  if (lamp > 0.001) {
    vec3 litUp = max(col * (1.0 + lamp * 0.55), vec3(0.18, 0.28, 0.34) * lamp);
    col = mix(col, litUp, lamp);
    col += vec3(0.42, 0.66, 0.82) * lamp * 0.14;
  }
  return col;
}
`;

export function attachWorldShading(material, uniforms) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev(shader, renderer);
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uSunDir = uniforms.uSunDir;
    shader.uniforms.uCaustic = uniforms.uCaustic;
    shader.uniforms.uStorm = uniforms.uStorm;
    shader.uniforms.uRocks = uniforms.uRocks;
    shader.uniforms.uPhoticY = uniforms.uPhoticY;
    shader.uniforms.uIceT = uniforms.uIceT;
    shader.uniforms.uLampPos = uniforms.uLampPos;
    shader.uniforms.uLampDir = uniforms.uLampDir;
    shader.uniforms.uLampI = uniforms.uLampI;
    shader.uniforms.uGlow = material.userData.uGlow || { value: 0 };
    if (!shader.vertexShader.includes("varying vec3 vCausticWorld")) {
      shader.vertexShader = shader.vertexShader.replace(
        "varying vec3 vViewPosition;",
        `varying vec3 vViewPosition;
        varying vec3 vCausticWorld;`
      );
    }
    if (!shader.vertexShader.includes("vCausticWorld = ")) {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        #ifdef USE_INSTANCING
        vCausticWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
        vCausticWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`
      );
    }
    if (!shader.fragmentShader.includes("float worldCaustic")) {
      shader.fragmentShader =
        `varying vec3 vCausticWorld;\n${WORLD_GLSL}\n` + shader.fragmentShader;
    }
    if (!shader.fragmentShader.includes("applyWorldLight(gl_FragColor.rgb, vCausticWorld)")) {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `#include <opaque_fragment>
        gl_FragColor.rgb = applyWorldLight(gl_FragColor.rgb, vCausticWorld);`
      );
    }
  };
  const prevKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () =>
    `${prevKey ? prevKey() : material.uuid}|world-caustic-v10`;
  material.needsUpdate = true;
  return material;
}

export function syncWorldUniforms(uniforms, look) {
  uniforms.uSunDir.value.copy(look.sunDir);
  uniforms.uCaustic.value = look.caustic;
  uniforms.uStorm.value = look.storm;
  if (uniforms.uHour) uniforms.uHour.value = look.hour;
  uniforms.uWaterAbove.value.copy(look.waterAbove);
  uniforms.uWaterBelow.value.copy(look.waterBelow);
  uniforms.uWaterFres.value.copy(look.waterFres);
  uniforms.uSkyZenith.value.copy(look.skyZenith);
  uniforms.uSkyHorizon.value.copy(look.skyHorizon);
  if (uniforms.uPhoticY) uniforms.uPhoticY.value = openPhoticY();
  if (uniforms.uIce) uniforms.uIce.value = look.ice ?? 0;
  if (uniforms.uIceT) uniforms.uIceT.value = iceTransmit(look.ice);
}

export function setRockSlots(uniforms, colliders, count) {
  const slots = uniforms.uRocks.value;
  const ranked = [];
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    ranked.push({
      x: colliders[o],
      y: colliders[o + 1],
      z: colliders[o + 2],
      r: colliders[o + 3],
    });
  }
  ranked.sort((a, b) => b.r - a.r);
  for (let i = 0; i < ROCK_SLOT_COUNT; i++) {
    const s = ranked[i];
    if (s) slots[i].set(s.x, s.y, s.z, s.r);
    else slots[i].set(0, 0, 0, 0);
  }
}
