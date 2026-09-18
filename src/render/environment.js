import * as THREE from "three";
import { CONFIG } from "../config.js";
import { attenuationKd, visualClarity } from "../simulation/light.js";

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

  const lamp = new THREE.SpotLight(0xffe8c4, 0, 42, 0.28, 0.42, 2);
  scene.add(lamp);
  scene.add(lamp.target);
  const beam = _lampVolume();
  scene.add(beam.mesh);
  const _lampFwd = new THREE.Vector3();
  const _lampRight = new THREE.Vector3();
  const _lampUp = new THREE.Vector3();

  const particles = _motes();
  scene.add(particles);

  return {
    sky,
    sun,
    hemi,
    fill,
    lamp,
    lampOn: false,
    beam,
    particles,
    _moteTint: new THREE.Color(0xaad8e8),
    _abyss: new THREE.Color(0x010308),
    update(time, camera, look) {
      uniforms.uTime.value = time;
      uniforms.uCamY.value = camera.position.y;
      particles.rotation.y = time * 0.012;
      const above = camera.position.y > 2.4;
      const turb = CONFIG.water?.turbidity ?? 1;
      const inLight = above ? 1 : visualClarity(camera.position.y, look);
      const optical = above ? 0 : 1 - inLight;
      const thermo =
        1 + 0.18 * Math.exp(-((camera.position.y - CONFIG.thermoY) * (camera.position.y - CONFIG.thermoY)) / 36);
      const pull = THREE.MathUtils.smoothstep(
        64,
        280,
        Math.max(camera.position.y, Math.hypot(camera.position.x, camera.position.z) * 0.28)
      );
      scene.fog.color.copy(above ? look.fogAbove : look.fog);
      if (!above) scene.fog.color.lerp(this._abyss, optical * 0.72);
      scene.fog.density =
        ((above ? look.fogD * 0.62 : look.fogD * turb) * thermo) * (1 - pull * 0.86);
      scene.background.copy(above ? look.bgAbove : look.bg);
      if (!above) scene.background.lerp(this._abyss, optical * 0.82);
      sun.color.copy(look.sun);
      sun.intensity = (above ? look.sunI * 1.15 : look.sunI * (0.18 + 0.82 * inLight)) * look.wavePulse;
      sun.position.copy(look.sunDir).multiplyScalar(120);
      hemi.color.copy(look.hemiSky);
      hemi.groundColor.copy(look.hemiGround);
      hemi.intensity = look.hemiI * (above ? 1 : 0.22 + 0.78 * inLight);
      fill.intensity = look.fillI * (above ? 1 : 0.16 + 0.84 * inLight);
      fill.position.copy(look.sunDir).multiplyScalar(-40);
      sky.visible = above;
      particles.material.opacity = above ? 0.05 : (0.12 + look.caustic * 0.16) * (0.12 + 0.88 * inLight);
      particles.material.color.copy(look.sun).lerp(this._moteTint, 0.55);
      if (!above) particles.material.color.lerp(this._abyss, optical * 0.88);

      camera.getWorldDirection(_lampFwd);
      _lampRight.crossVectors(_lampFwd, camera.up);
      if (_lampRight.lengthSq() < 1e-6) _lampRight.set(1, 0, 0);
      else _lampRight.normalize();
      _lampUp.crossVectors(_lampRight, _lampFwd).normalize();
      // Handheld offset beside the eye — never a bulb in front of the near plane.
      lamp.position
        .copy(camera.position)
        .addScaledVector(_lampRight, 0.2)
        .addScaledVector(_lampUp, -0.12)
        .addScaledVector(_lampFwd, 0.06);
      const power = Math.max(0, CONFIG.lamp?.intensity ?? 1);
      const halfDeg = THREE.MathUtils.clamp(CONFIG.lamp?.angle ?? 16, 8, 40);
      const halfRad = THREE.MathUtils.degToRad(halfDeg);
      const kd = attenuationKd();
      const range = THREE.MathUtils.clamp(1.15 / Math.max(kd, 0.012), 16, 56);
      const inner = Math.cos(halfRad * 0.62);
      const outer = Math.cos(halfRad * 1.18);
      lamp.target.position.copy(camera.position).addScaledVector(_lampFwd, range);
      lamp.target.updateMatrixWorld();
      lamp.angle = halfRad * 1.05;
      lamp.penumbra = 0.45;
      lamp.distance = range;
      lamp.decay = 2;
      uniforms.uLampPos.value.copy(lamp.position);
      uniforms.uLampDir.value.copy(_lampFwd);
      uniforms.uLampCos.value.set(outer, inner);
      uniforms.uLampKd.value = kd;
      uniforms.uLampRange.value = range;
      if (this.lampOn && power > 0.02) {
        uniforms.uLampI.value = power;
        lamp.intensity = 0;
        beam.update(camera, halfRad, range, above ? 0 : power, kd);
      } else {
        uniforms.uLampI.value = 0;
        lamp.intensity = 0;
        beam.update(camera, halfRad, range, 0, kd);
      }
    },
  };
}

const LAMP_SLICES = 12;

function _lampVolume() {
  const geo = new THREE.CircleGeometry(1, 22);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uI: { value: 0 },
      uKd: { value: 0.026 },
      uRange: { value: 42 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mvPosition = vec4(position, 1.0);
        #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
        #endif
        vec4 world = modelMatrix * mvPosition;
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uI;
      uniform float uKd;
      uniform float uRange;
      varying vec3 vWorld;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r2 = dot(p, p);
        if (r2 > 1.0) discard;
        float dist = length(vWorld - cameraPosition);
        float core = exp(-r2 * 3.8);
        float halo = exp(-r2 * 1.15);
        float along = exp(-dist * uKd) * (1.0 - smoothstep(uRange * 0.58, uRange, dist));
        float near = smoothstep(2.2, 9.0, dist);
        float spark = smoothstep(0.94, 0.998, fract(sin(dot(vWorld * 0.71, vec3(12.98, 78.23, 37.72))) * 43758.5453));
        float a = uI * along * near * (core * 0.14 + halo * 0.05 + spark * core * 0.35);
        gl_FragColor = vec4(vec3(1.0, 0.94, 0.82) * a, 0.0);
      }
    `,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, LAMP_SLICES);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  mesh.visible = false;
  const dummy = new THREE.Object3D();

  return {
    mesh,
    update(camera, halfRad, range, intensity, kd) {
      const on = intensity > 0.02;
      mesh.visible = on;
      if (!on) {
        mat.uniforms.uI.value = 0;
        return;
      }
      mesh.position.copy(camera.position);
      mesh.quaternion.copy(camera.quaternion);
      const tan = Math.tan(halfRad);
      for (let i = 0; i < LAMP_SLICES; i++) {
        const t = (i + 1) / (LAMP_SLICES + 0.35);
        const z = 2.4 + t * t * range;
        dummy.position.set(0, 0, -z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(Math.max(0.12, z * tan));
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mat.uniforms.uI.value = (intensity / LAMP_SLICES) * 0.28;
      mat.uniforms.uKd.value = kd;
      mat.uniforms.uRange.value = range;
    },
  };
}

function _sky(uniforms) {
  const geo = new THREE.SphereGeometry(1800, 24, 16);
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
  const top = -4;
  const bot = CONFIG.floorY + 4;
  const span = Math.max(8, top - bot);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * CONFIG.halfX * 2;
    pos[i * 3 + 1] = bot + Math.random() * span;
    pos[i * 3 + 2] = (Math.random() - 0.5) * CONFIG.halfZ * 2;
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

const PARK_Y = -1e5;

function _park(pos, i) {
  pos[i * 3] = 0;
  pos[i * 3 + 1] = PARK_Y;
  pos[i * 3 + 2] = 0;
}

export function createEatParticles() {
  const n = 220;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const vel = new Float32Array(n * 3);
  const life = new Float32Array(n);
  for (let i = 0; i < n; i++) _park(pos, i);
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
  points.visible = false;
  let cursor = 0;

  return {
    points,
    burst(x, y, z) {
      points.visible = true;
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
      if (!points.visible) return;
      let live = 0;
      for (let i = 0; i < n; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        vel[i * 3 + 1] += 2.5 * dt;
        if (life[i] <= 0) _park(pos, i);
        else live++;
      }
      points.visible = live > 0;
      geo.attributes.position.needsUpdate = true;
    },
  };
}

export function createBlowParticles() {
  const n = 1400;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const vel = new Float32Array(n * 3);
  const life = new Float32Array(n);
  for (let i = 0; i < n; i++) _park(pos, i);
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2.4,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    sizeAttenuation: true,
    fog: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 6;
  points.visible = false;
  let cursor = 0;

  function emit(x, y, z, count, vx0, vy0, vz0, spread, life0) {
    for (let k = 0; k < count; k++) {
      const i = cursor++ % n;
      pos[i * 3] = x + (Math.random() - 0.5) * 0.45;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.45;
      vel[i * 3] = vx0 + (Math.random() - 0.5) * spread;
      vel[i * 3 + 1] = vy0 * (0.65 + Math.random() * 0.7);
      vel[i * 3 + 2] = vz0 + (Math.random() - 0.5) * spread;
      life[i] = life0 * (0.75 + Math.random() * 0.5);
    }
  }

  return {
    points,
    puff(x, y, z, kind = "", scale = 1, dir = {}) {
      points.visible = true;
      const s = Math.max(0.55, scale);
      const fx = dir.fx ?? 0;
      const fz = dir.fz ?? 1;
      const lx = dir.lx ?? 0;
      const lz = dir.lz ?? 0;
      const sperm = kind === "spermwhale";
      const small = kind === "commondolphin" || kind === "orca";
      const mysticete = kind === "humpback" || kind === "minke";
      const count = Math.round((small ? 22 : sperm ? 70 : 36) * s);
      const up = (small ? 8 : sperm ? 14 : 11) * s;
      const fwd = sperm ? 8 * s : small ? 1.8 * s : 0.8 * s;
      const left = sperm ? 4.5 * s : 0;
      const spread = (small ? 1.8 : sperm ? 3.2 : 2.2) * s;
      const life0 = small ? 0.85 : sperm ? 1.6 : 1.2;
      const vx0 = fx * fwd + lx * left;
      const vz0 = fz * fwd + lz * left;
      if (mysticete) {
        const off = 0.55 * s;
        emit(x + lx * off, y, z + lz * off, count, vx0 * 0.15, up, vz0 * 0.15, spread, life0);
        emit(x - lx * off, y, z - lz * off, count, vx0 * 0.15, up, vz0 * 0.15, spread, life0);
      } else {
        emit(x, y, z, count, vx0, up, vz0, spread, life0);
      }
      emit(x, y, z, Math.round(14 * s), 0, 5.5 * s, 0, 7.2 * s, 0.42);
    },
    update(dt) {
      if (!points.visible) return;
      const drag = Math.exp(-dt * 1.05);
      let live = 0;
      for (let i = 0; i < n; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        vel[i * 3] *= drag;
        vel[i * 3 + 2] *= drag;
        vel[i * 3 + 1] -= 2.4 * dt;
        vel[i * 3 + 1] *= 0.99;
        if (pos[i * 3 + 1] < -2.8 || life[i] <= 0) {
          life[i] = 0;
          _park(pos, i);
        } else live++;
      }
      points.visible = live > 0;
      geo.attributes.position.needsUpdate = true;
    },
  };
}
