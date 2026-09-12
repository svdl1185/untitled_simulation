import * as THREE from "three";
import { CONFIG } from "../config.js";

export function createPlanktonMesh(plankton, uniforms) {
  const tex = new THREE.DataTexture(
    plankton._bytes,
    plankton.nx,
    plankton.nz,
    THREE.RGBAFormat
  );
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  tex.colorSpace = THREE.NoColorSpace;
  tex.flipY = false;

  const geo = new THREE.PlaneGeometry(plankton.spanX, plankton.spanZ, 1, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(
    plankton.minX + plankton.spanX * 0.5,
    0,
    plankton.minZ + plankton.spanZ * 0.5
  );

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: tex },
      uTime: uniforms.uTime,
      uCamY: uniforms.uCamY,
      uCaustic: uniforms.uCaustic,
      uOrigin: { value: new THREE.Vector2(plankton.minX, plankton.minZ) },
      uSpan: { value: new THREE.Vector2(plankton.spanX, plankton.spanZ) },
      uRise: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uTime;
      uniform float uCamY;
      uniform float uCaustic;
      uniform vec2 uOrigin;
      uniform vec2 uSpan;
      uniform float uRise;
      varying vec3 vWorld;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        vec2 uv = (vWorld.xz - uOrigin) / uSpan;
        if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) discard;
        vec4 f = texture2D(uMap, uv);
        float phy = f.r;
        float zoo = f.g;
        float d = max(phy, zoo);
        if (d < 0.045) discard;
        float near = 1.0 - smoothstep(7.0, 26.0, abs(uCamY - vWorld.y));
        float pulse = 0.84 + 0.16 * sin(uTime * 0.7 + vWorld.x * 0.05);
        vec2 gp = floor(vWorld.xz * 0.42);
        float spec = hash(gp + floor(uTime * 1.6));
        float spark = smoothstep(0.78, 1.0, spec + 0.1 * sin(uTime * 2.8 + spec * 30.0));
        vec3 phyCol = mix(vec3(0.06, 0.4, 0.42), vec3(0.18, 0.78, 0.4), phy);
        vec3 zooCol = mix(vec3(0.2, 0.52, 0.28), vec3(0.7, 0.92, 0.34), zoo);
        vec3 col = phyCol * phy + zooCol * zoo * (0.65 + 0.35 * uRise);
        col += vec3(0.75, 0.95, 0.45) * spark * zoo * 0.65;
        col += col * uCaustic * 0.12;
        float alpha = (phy * phy * 0.22 + zoo * zoo * 0.28) * (0.28 + 0.72 * near) * pulse;
        alpha *= 0.82 + 0.18 * spark;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = CONFIG.thermoY - 2;
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;

  return {
    mesh,
    update(look) {
      tex.needsUpdate = true;
      const night = look?.night ?? 0;
      const dusk = look?.dusk ?? 0;
      const dawn = look?.dawn ?? 0;
      const rise = Math.min(1, night * 0.9 + dusk * 0.5 + dawn * 0.4);
      mesh.position.y = (CONFIG.thermoY - 2) * (1 - rise) + -8.5 * rise;
      mat.uniforms.uRise.value = rise;
    },
  };
}
