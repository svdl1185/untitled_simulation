import * as THREE from "three";

const PRESETS = [
  {
    h: 0,
    name: "Night",
    fog: 0x02080c,
    fogAbove: 0x0a1218,
    fogD: 0.0115,
    bg: 0x010508,
    bgAbove: 0x0b1520,
    sun: 0xc5d4ee,
    sunI: 0.14,
    hemiSky: 0x1a3040,
    hemiGround: 0x12100e,
    hemiI: 0.22,
    fillI: 0.28,
    caustic: 0.0,
    exposure: 0.52,
    skyZenith: [0.02, 0.04, 0.08],
    skyHorizon: [0.06, 0.08, 0.12],
    waterAbove: [0.02, 0.05, 0.07],
    waterBelow: [0.01, 0.04, 0.05],
    waterFres: [0.12, 0.18, 0.22],
    preferredDepth: -54,
    schoolRadiusScale: 0.58,
    fearScale: 0.52,
    tight: 1.0,
    night: 1,
    dawn: 0,
    dusk: 0,
  },
  {
    h: 5.2,
    name: "Night",
    fog: 0x061018,
    fogAbove: 0x243040,
    fogD: 0.0095,
    bg: 0x040b12,
    bgAbove: 0x2a3344,
    sun: 0xe8c8b0,
    sunI: 0.28,
    hemiSky: 0x4a5a70,
    hemiGround: 0x2a241c,
    hemiI: 0.32,
    fillI: 0.3,
    caustic: 0.08,
    exposure: 0.62,
    skyZenith: [0.08, 0.1, 0.18],
    skyHorizon: [0.22, 0.18, 0.2],
    waterAbove: [0.04, 0.1, 0.12],
    waterBelow: [0.02, 0.07, 0.09],
    waterFres: [0.28, 0.3, 0.32],
    preferredDepth: -50,
    schoolRadiusScale: 0.64,
    fearScale: 0.6,
    tight: 0.85,
    night: 0.85,
    dawn: 0.15,
    dusk: 0,
  },
  {
    h: 6.3,
    name: "Dawn",
    fog: 0x1a3a38,
    fogAbove: 0xe8b898,
    fogD: 0.0064,
    bg: 0x0c2428,
    bgAbove: 0xe0a878,
    sun: 0xffc090,
    sunI: 0.85,
    hemiSky: 0xffc8a0,
    hemiGround: 0x6a4a32,
    hemiI: 0.7,
    fillI: 0.38,
    caustic: 0.42,
    exposure: 0.88,
    skyZenith: [0.22, 0.32, 0.52],
    skyHorizon: [0.95, 0.62, 0.42],
    waterAbove: [0.12, 0.22, 0.2],
    waterBelow: [0.05, 0.16, 0.16],
    waterFres: [0.55, 0.42, 0.32],
    preferredDepth: -28,
    schoolRadiusScale: 0.92,
    fearScale: 0.88,
    tight: 0.2,
    night: 0.05,
    dawn: 1,
    dusk: 0,
  },
  {
    h: 9.5,
    name: "Morning",
    fog: 0x0a3840,
    fogAbove: 0xa8d0dc,
    fogD: 0.0056,
    bg: 0x052028,
    bgAbove: 0x86c2d2,
    sun: 0xfff0d0,
    sunI: 1.28,
    hemiSky: 0x8ec8d8,
    hemiGround: 0x6a5a3a,
    hemiI: 0.82,
    fillI: 0.42,
    caustic: 0.82,
    exposure: 1.0,
    skyZenith: [0.32, 0.58, 0.86],
    skyHorizon: [0.7, 0.82, 0.9],
    waterAbove: [0.05, 0.2, 0.22],
    waterBelow: [0.02, 0.12, 0.14],
    waterFres: [0.42, 0.64, 0.72],
    preferredDepth: -34,
    schoolRadiusScale: 1,
    fearScale: 1,
    tight: 0,
    night: 0,
    dawn: 0.15,
    dusk: 0,
  },
  {
    h: 12.5,
    name: "Noon",
    fog: 0x06232c,
    fogAbove: 0x9ec4d4,
    fogD: 0.0054,
    bg: 0x041c24,
    bgAbove: 0x7fb6c9,
    sun: 0xe8dcc0,
    sunI: 1.4,
    hemiSky: 0x6eb0c4,
    hemiGround: 0x6a5a3a,
    hemiI: 0.86,
    fillI: 0.45,
    caustic: 1,
    exposure: 1.05,
    skyZenith: [0.35, 0.62, 0.88],
    skyHorizon: [0.72, 0.84, 0.9],
    waterAbove: [0.04, 0.16, 0.18],
    waterBelow: [0.02, 0.11, 0.13],
    waterFres: [0.42, 0.64, 0.72],
    preferredDepth: -38,
    schoolRadiusScale: 1,
    fearScale: 1,
    tight: 0,
    night: 0,
    dawn: 0,
    dusk: 0,
  },
  {
    h: 17.1,
    name: "Dusk",
    fog: 0x1a2c30,
    fogAbove: 0xe8a070,
    fogD: 0.0068,
    bg: 0x0c181c,
    bgAbove: 0xc07048,
    sun: 0xff9058,
    sunI: 0.92,
    hemiSky: 0xe89068,
    hemiGround: 0x4a3020,
    hemiI: 0.62,
    fillI: 0.32,
    caustic: 0.3,
    exposure: 0.82,
    skyZenith: [0.12, 0.16, 0.32],
    skyHorizon: [0.92, 0.42, 0.22],
    waterAbove: [0.1, 0.14, 0.14],
    waterBelow: [0.04, 0.09, 0.1],
    waterFres: [0.62, 0.32, 0.22],
    preferredDepth: -40,
    schoolRadiusScale: 0.86,
    fearScale: 0.82,
    tight: 0.25,
    night: 0.1,
    dawn: 0,
    dusk: 1,
  },
  {
    h: 19.6,
    name: "Night",
    fog: 0x040c12,
    fogAbove: 0x121820,
    fogD: 0.01,
    bg: 0x02060a,
    bgAbove: 0x0c1218,
    sun: 0xb8c8e4,
    sunI: 0.18,
    hemiSky: 0x243848,
    hemiGround: 0x141210,
    hemiI: 0.26,
    fillI: 0.28,
    caustic: 0.02,
    exposure: 0.55,
    skyZenith: [0.03, 0.05, 0.1],
    skyHorizon: [0.08, 0.1, 0.14],
    waterAbove: [0.02, 0.06, 0.07],
    waterBelow: [0.01, 0.04, 0.05],
    waterFres: [0.14, 0.2, 0.24],
    preferredDepth: -50,
    schoolRadiusScale: 0.6,
    fearScale: 0.55,
    tight: 0.92,
    night: 0.95,
    dawn: 0,
    dusk: 0.1,
  },
  {
    h: 24,
    name: "Night",
    fog: 0x02080c,
    fogAbove: 0x0a1218,
    fogD: 0.0115,
    bg: 0x010508,
    bgAbove: 0x0b1520,
    sun: 0xc5d4ee,
    sunI: 0.14,
    hemiSky: 0x1a3040,
    hemiGround: 0x12100e,
    hemiI: 0.22,
    fillI: 0.28,
    caustic: 0.0,
    exposure: 0.52,
    skyZenith: [0.02, 0.04, 0.08],
    skyHorizon: [0.06, 0.08, 0.12],
    waterAbove: [0.02, 0.05, 0.07],
    waterBelow: [0.01, 0.04, 0.05],
    waterFres: [0.12, 0.18, 0.22],
    preferredDepth: -54,
    schoolRadiusScale: 0.58,
    fearScale: 0.52,
    tight: 1.0,
    night: 1,
    dawn: 0,
    dusk: 0,
  },
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpHex(a, b, t, target) {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  target.setRGB(
    (ar + (br - ar) * t) / 255,
    (ag + (bg - ag) * t) / 255,
    (ab + (bb - ab) * t) / 255
  );
}

export class DayCycle {
  constructor() {
    this.hour = 10.4;
    this.auto = false;
    this.dayLength = 96;
    this.storm = 0;
    this.stormTarget = 0;
    this._stormFog = new THREE.Color(0x152028);
    this._stormBg = new THREE.Color(0x0a1418);
    this.look = {
      name: "Morning",
      hour: 10.4,
      fog: new THREE.Color(),
      fogAbove: new THREE.Color(),
      bg: new THREE.Color(),
      bgAbove: new THREE.Color(),
      sun: new THREE.Color(),
      hemiSky: new THREE.Color(),
      hemiGround: new THREE.Color(),
      skyZenith: new THREE.Vector3(),
      skyHorizon: new THREE.Vector3(),
      waterAbove: new THREE.Vector3(),
      waterBelow: new THREE.Vector3(),
      waterFres: new THREE.Vector3(),
      sunDir: new THREE.Vector3(),
      fogD: 0.0058,
      sunI: 1.2,
      hemiI: 0.8,
      fillI: 0.4,
      caustic: 1,
      exposure: 1,
      preferredDepth: -38,
      schoolRadiusScale: 1,
      fearScale: 1,
      tight: 0,
      night: 0,
      dawn: 0,
      dusk: 0,
      storm: 0,
      wavePulse: 1,
    };
  }

  update(dt) {
    if (this.auto) this.hour = (this.hour + (24 / this.dayLength) * dt + 24) % 24;
    this.storm += (this.stormTarget - this.storm) * Math.min(1, dt * 0.55);
    this.sample();
  }

  setHour(h) {
    this.hour = ((h % 24) + 24) % 24;
    this.auto = false;
    this.sample();
  }

  sample() {
    const hour = this.hour;
    let i = 0;
    while (i < PRESETS.length - 1 && PRESETS[i + 1].h < hour) i++;
    const a = PRESETS[i];
    const b = PRESETS[i + 1];
    const span = b.h - a.h || 1;
    const t = THREE.MathUtils.clamp((hour - a.h) / span, 0, 1);
    const s = t * t * (3 - 2 * t);
    const look = this.look;
    look.hour = hour;
    look.name = s < 0.5 ? a.name : b.name;
    lerpHex(a.fog, b.fog, s, look.fog);
    lerpHex(a.fogAbove, b.fogAbove, s, look.fogAbove);
    lerpHex(a.bg, b.bg, s, look.bg);
    lerpHex(a.bgAbove, b.bgAbove, s, look.bgAbove);
    lerpHex(a.sun, b.sun, s, look.sun);
    lerpHex(a.hemiSky, b.hemiSky, s, look.hemiSky);
    lerpHex(a.hemiGround, b.hemiGround, s, look.hemiGround);
    look.skyZenith.set(
      lerp(a.skyZenith[0], b.skyZenith[0], s),
      lerp(a.skyZenith[1], b.skyZenith[1], s),
      lerp(a.skyZenith[2], b.skyZenith[2], s)
    );
    look.skyHorizon.set(
      lerp(a.skyHorizon[0], b.skyHorizon[0], s),
      lerp(a.skyHorizon[1], b.skyHorizon[1], s),
      lerp(a.skyHorizon[2], b.skyHorizon[2], s)
    );
    look.waterAbove.set(
      lerp(a.waterAbove[0], b.waterAbove[0], s),
      lerp(a.waterAbove[1], b.waterAbove[1], s),
      lerp(a.waterAbove[2], b.waterAbove[2], s)
    );
    look.waterBelow.set(
      lerp(a.waterBelow[0], b.waterBelow[0], s),
      lerp(a.waterBelow[1], b.waterBelow[1], s),
      lerp(a.waterBelow[2], b.waterBelow[2], s)
    );
    look.waterFres.set(
      lerp(a.waterFres[0], b.waterFres[0], s),
      lerp(a.waterFres[1], b.waterFres[1], s),
      lerp(a.waterFres[2], b.waterFres[2], s)
    );
    look.fogD = lerp(a.fogD, b.fogD, s);
    look.sunI = lerp(a.sunI, b.sunI, s);
    look.hemiI = lerp(a.hemiI, b.hemiI, s);
    look.fillI = lerp(a.fillI, b.fillI, s);
    look.caustic = lerp(a.caustic, b.caustic, s);
    look.exposure = lerp(a.exposure, b.exposure, s);
    look.preferredDepth = lerp(a.preferredDepth, b.preferredDepth, s);
    look.schoolRadiusScale = lerp(a.schoolRadiusScale, b.schoolRadiusScale, s);
    look.fearScale = lerp(a.fearScale, b.fearScale, s);
    look.tight = lerp(a.tight, b.tight, s);
    look.night = lerp(a.night, b.night, s);
    look.dawn = lerp(a.dawn, b.dawn, s);
    look.dusk = lerp(a.dusk, b.dusk, s);

    const az = ((hour - 6) / 24) * Math.PI * 2;
    const elev = Math.sin(((hour - 6) / 12) * Math.PI);
    const moon = elev < 0;
    const y = moon ? 0.32 : 0.18 + elev * 0.82;
    look.sunDir.set(Math.cos(az) * 0.72, y, Math.sin(az) * 0.72).normalize();
    if (moon) {
      look.sunI *= 0.35;
      look.caustic *= 0.08;
    }

    const storm = this.storm;
    look.storm = storm;
    look.sunI *= 1 - storm * 0.62;
    look.caustic *= 1 - storm * 0.88;
    look.fogD += storm * 0.0048;
    look.exposure *= 1 - storm * 0.22;
    look.hemiI *= 1 - storm * 0.15;
    if (storm > 0.05) {
      look.fog.lerp(this._stormFog, storm * 0.55);
      look.bg.lerp(this._stormBg, storm * 0.5);
    }

    look.wavePulse = 1 + 0.045 * Math.sin(performance.now() * 0.001 * 1.15);
    look.sunI *= look.wavePulse;
    look.caustic *= look.wavePulse;
    return look;
  }

  clockLabel() {
    const h = Math.floor(this.hour);
    const m = Math.floor((this.hour - h) * 60);
    const hh = String(h).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    return `${this.look.name} ${hh}:${mm}`;
  }
}
