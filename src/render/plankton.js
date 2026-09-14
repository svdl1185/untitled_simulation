import * as THREE from "three";
import { CONFIG } from "../config.js";

const SLICE_N = 12;
const COL_MIN = 0.12;

/**
 * Visual of the separable NPZD field: horizontal patch × live column.
 * One shared 128×128 texture; slices sit on column bins (P in the photic,
 * Z on DVM) so swimming the water actually shows the bloom.
 */
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

  const group = new THREE.Group();
  group.renderOrder = 1;
  const slices = [];
  for (let i = 0; i < SLICE_N; i++) {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: tex },
        uTime: uniforms.uTime,
        uCamY: uniforms.uCamY,
        uCaustic: uniforms.uCaustic,
        uOrigin: { value: new THREE.Vector2(plankton.minX, plankton.minZ) },
        uSpan: { value: new THREE.Vector2(plankton.spanX, plankton.spanZ) },
        uRise: { value: 0 },
        uPhy: { value: 1 },
        uZoo: { value: 1 },
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
        uniform float uPhy;
        uniform float uZoo;
        varying vec3 vWorld;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          vec2 uv = (vWorld.xz - uOrigin) / uSpan;
          if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) discard;
          vec4 f = texture2D(uMap, uv);
          float phy = f.r * uPhy;
          float zoo = f.g * uZoo;
          float visP = smoothstep(0.015, 0.22, phy);
          float visZ = smoothstep(0.015, 0.22, zoo);
          if (max(visP, visZ) < 0.04) discard;
          float near = 1.0 - smoothstep(14.0, 95.0, abs(uCamY - vWorld.y));
          float pulse = 0.84 + 0.16 * sin(uTime * 0.7 + vWorld.x * 0.05);
          vec2 gp = floor(vWorld.xz * 0.42);
          float spec = hash(gp + floor(uTime * 1.6));
          float spark = smoothstep(0.78, 1.0, spec + 0.1 * sin(uTime * 2.8 + spec * 30.0));
          vec3 phyCol = mix(vec3(0.06, 0.4, 0.42), vec3(0.18, 0.78, 0.4), visP);
          vec3 zooCol = mix(vec3(0.2, 0.52, 0.28), vec3(0.7, 0.92, 0.34), visZ);
          vec3 col = phyCol * visP + zooCol * visZ * (0.55 + 0.45 * uRise);
          col += vec3(0.75, 0.95, 0.45) * spark * visZ * 0.65;
          col += col * uCaustic * 0.12;
          float alpha = (visP * 0.2 + visZ * 0.24) * (0.28 + 0.72 * near) * pulse;
          alpha *= 0.82 + 0.18 * spark;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    mesh.visible = false;
    group.add(mesh);
    slices.push({ mesh, mat });
  }

  const out = {
    mesh: group,
    update(look) {
      tex.needsUpdate = true;
      const night = look?.night ?? 0;
      const dusk = look?.dusk ?? 0;
      const dawn = look?.dawn ?? 0;
      const rise = Math.min(1, night * 0.9 + dusk * 0.5 + dawn * 0.4);
      const ny = plankton.ny || 0;
      const ys = plankton.layerY;
      const pCol = plankton.pCol;
      const zCol = plankton.zCol;
      const floor = Math.max(-220, (CONFIG.floorY ?? -200) + 6);
      let s = 0;
      for (let i = 0; i < ny && s < SLICE_N; i++) {
        const y = ys[i];
        if (y > -0.8 || y < floor) continue;
        const pw = pCol?.[i] ?? 0;
        const zw = zCol?.[i] ?? 0;
        if (pw < COL_MIN && zw < COL_MIN) continue;
        const sl = slices[s++];
        sl.mesh.visible = true;
        sl.mesh.position.y = y;
        sl.mat.uniforms.uPhy.value = pw;
        sl.mat.uniforms.uZoo.value = zw;
        sl.mat.uniforms.uRise.value = rise;
      }
      for (; s < SLICE_N; s++) slices[s].mesh.visible = false;
    },
  };
  out.update({ night: 0, dusk: 0, dawn: 0 });
  return out;
}
