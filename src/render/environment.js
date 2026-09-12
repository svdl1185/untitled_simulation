import * as THREE from "three";
import { CONFIG } from "../config.js";

export function createEnvironment(scene, uniforms) {
  const sky = _sky(uniforms);
  scene.add(sky);

  const sun = new THREE.DirectionalLight(0xe8dcc0, 1.35);
  sun.position.set(40, 80, 20);
  scene.add(sun);

  const hemi = new THREE.HemisphereLight(0x6eb0c4, 0x6a5a3a, 0.78);
  scene.add(hemi);

  const fill = new THREE.DirectionalLight(0x1a4a58, 0.45);
  fill.position.set(-30, -10, -40);
  scene.add(fill);

  const particles = _motes();
  scene.add(particles);

  return {
    sky,
    sun,
    hemi,
    fill,
    particles,
    _moteTint: new THREE.Color(0xaad8e8),
    update(time, camera, look) {
      uniforms.uTime.value = time;
      uniforms.uCamY.value = camera.position.y;
      particles.rotation.y = time * 0.012;
      const above = camera.position.y > 2.4;
      const depth = Math.max(0, -camera.position.y);
      const thermo =
        1 + 0.42 * Math.exp(-((camera.position.y + 18) * (camera.position.y + 18)) / 22);
      const pull = THREE.MathUtils.smoothstep(
        48,
        210,
        Math.max(camera.position.y, Math.hypot(camera.position.x, camera.position.z) * 0.28)
      );
      scene.fog.color.copy(above ? look.fogAbove : look.fog);
      scene.fog.density =
        ((above ? look.fogD * 0.62 : look.fogD) * thermo + (above ? 0 : depth * 0.00008)) *
        (1 - pull * 0.86);
      scene.background.copy(above ? look.bgAbove : look.bg);
      sun.color.copy(look.sun);
      sun.intensity = (above ? look.sunI * 1.15 : look.sunI) * look.wavePulse;
      sun.position.copy(look.sunDir).multiplyScalar(120);
      hemi.color.copy(look.hemiSky);
      hemi.groundColor.copy(look.hemiGround);
      hemi.intensity = look.hemiI;
      fill.intensity = look.fillI;
      fill.position.copy(look.sunDir).multiplyScalar(-40);
      sky.visible = above;
      particles.material.opacity = above ? 0.05 : 0.12 + look.caustic * 0.16;
      particles.material.color.copy(look.sun).lerp(this._moteTint, 0.55);
    },
  };
}

function _sky(uniforms) {
  const geo = new THREE.SphereGeometry(1400, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uSunDir: uniforms.uSunDir,
      uSkyZenith: uniforms.uSkyZenith,
      uSkyHorizon: uniforms.uSkyHorizon,
    },
    vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uSunDir;
      uniform vec3 uSkyZenith;
      uniform vec3 uSkyHorizon;
      varying vec3 vPos;
      void main() {
        vec3 n = normalize(vPos);
        float h = n.y;
        vec3 col = mix(uSkyHorizon, uSkyZenith, smoothstep(-0.05, 0.55, h));
        float sun = pow(max(dot(n, normalize(uSunDir)), 0.0), 160.0);
        col += vec3(1.0, 0.94, 0.78) * sun;
        float glow = pow(max(dot(n, normalize(uSunDir)), 0.0), 8.0);
        col += uSkyHorizon * glow * 0.25;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return new THREE.Mesh(geo, mat);
}

function _motes() {
  const n = 900;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 200;
    pos[i * 3 + 1] = CONFIG.floorY + 4 + Math.random() * (-4 - (CONFIG.floorY + 4));
    pos[i * 3 + 2] = (Math.random() - 0.5) * 200;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xaad8e8,
    size: 0.18,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}

export function createEatParticles() {
  const n = 220;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const vel = new Float32Array(n * 3);
  const life = new Float32Array(n);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xdde8e4,
    size: 0.22,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  let cursor = 0;

  return {
    points,
    burst(x, y, z) {
      for (let k = 0; k < 14; k++) {
        const i = cursor++ % n;
        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;
        vel[i * 3] = (Math.random() - 0.5) * 8;
        vel[i * 3 + 1] = (Math.random() - 0.2) * 6;
        vel[i * 3 + 2] = (Math.random() - 0.5) * 8;
        life[i] = 0.45 + Math.random() * 0.25;
      }
    },
    update(dt) {
      for (let i = 0; i < n; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        vel[i * 3 + 1] += 2.5 * dt;
        if (life[i] <= 0) pos[i * 3 + 1] = -400;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
