import * as THREE from "three";
import { CONFIG } from "../config.js";

export function createPlanktonMesh(plankton, uniforms) {
  const tex = new THREE.DataTexture(
    plankton._bytes,
    plankton.nx,
    plankton.nz,
    THREE.RedFormat
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
      uOrigin: { value: new THREE.Vector2(plankton.minX, plankton.minZ) },
      uSpan: { value: new THREE.Vector2(plankton.spanX, plankton.spanZ) },
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
      uniform vec2 uOrigin;
      uniform vec2 uSpan;
      varying vec3 vWorld;

      void main() {
        vec2 uv = (vWorld.xz - uOrigin) / uSpan;
        if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) discard;
        float d = texture2D(uMap, uv).r;
        if (d < 0.04) discard;
        float near = 1.0 - smoothstep(10.0, 28.0, abs(uCamY - vWorld.y));
        float pulse = 0.82 + 0.18 * sin(uTime * 0.7 + vWorld.x * 0.05);
        float alpha = d * d * 0.28 * (0.4 + 0.6 * near) * pulse;
        gl_FragColor = vec4(0.28, 0.78, 0.42, alpha);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = CONFIG.thermoY - 2;
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;

  return {
    mesh,
    update() {
      tex.needsUpdate = true;
    },
  };
}
