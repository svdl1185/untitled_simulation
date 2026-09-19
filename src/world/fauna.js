/**
 * Living catalog of implemented animals.
 *
 * Presence is independent: if a range covers the cell, the species is in
 * the cell. Overlap is honest. A later tile with fifty forage fishes,
 * six sharks, squid, and kelp should still be a catalog lookup plus a
 * shared agent budget — never N copies of the 20k herring loop.
 *
 * `agent: "school"`  — hashed-grid individuals. Grazers share a bloom cap;
 *   piscivores (`diet: "bite"`) share a prey-capped budget on the same grid.
 *   Abundance is `share`, not the integrator. Skipjack and cod live here.
 * `agent: "vehicle"` — rare Reynolds loops (sharks, whales, giant squid,
 *   air-breathers). A handful by design. `pods` / `podSize` keep social
 *   taxa traveling as a unit; do not put a shelf gadid here.
 * `agent: "field"`   — Eulerian guild (benthos carbon + infauna). Later: `"density"` for super-individuals.
 */

/** Wall-clock seconds per sim day. 16 min ≈ 1 day (90×). */
export const DAY_SECONDS = 960;
const DAY_REF = 480;

/**
 * Per-second cruise drain so a full tank lasts `days` sim-days.
 * Bigger animals use 2–2.5; dolphin 1.5.
 */
export function drainForDays(days, starveAt = 0.06) {
  return +((1 - starveAt) / (Math.max(0.2, days) * DAY_SECONDS)).toFixed(7);
}

function schoolMet(old = 0.012) {
  return +(old * (drainForDays(1.5, 0.07) / 0.012)).toFixed(6);
}

export const FISH_DEFAULTS = {
  restSpacing: 1.48,
  sepRadius: 2.25,
  yMul: 1.08,
  aliRadius: 6.8,
  cohRadius: 8.4,
  sepWeight: 2.15,
  aliWeight: 1.7,
  cohWeight: 0.5,
  holdWeight: 2.4,
  fearWeight: 5.2,
  boundsWeight: 1.6,
  cruiseWeight: 0.68,
  depthWeight: 0.55,
  forageWeight: 3.6,
  forageGain: 0.02,
  metabolism: schoolMet(),
  starveAt: 0.07,
  recruitEnergy: 0.52,
  spawnEnergy: 0.42,
  noiseWeight: 1.15,
  pitchDamp: 2.15,
  pitchLimit: 0.48,
  lead: 20,
  preferredDepth: -38,
  nightDepth: -20,
  dawnDepth: -70,
  dayDepth: -110,
  duskDepth: -45,
  maxDepth: -400,
  surfaceClearance: 1.35,
  floorClearance: 2.2,
  minWater: 12,
  beachTurnWater: 24,
  beachLook: 42,
  minSpeed: 2.8,
  maxSpeed: 10.8,
  fleeSpeed: 22,
  maxAccel: 24,
  maxTurn: 1.35,
  length: 0.95,
  schoolRadius: 34,
  schoolHeight: 8.5,
  splitDistance: 78,
  mergeDistance: 24,
  minSchoolFrac: 0.04,
  minSchoolSize: 120,
  joinSlack: 1.55,
  grazeMul: 1,
  diet: "z",
  eatEnergy: 0.08,
  biteRadius: 1.15,
  o2Min: 1.4,
  anchorTop: -3.2,
  social: "polarized",
  groups: 2,
  swim: "tail",
};

/** Reynolds vehicles (sharks, whales, giant squid). School knobs stay on FISH_DEFAULTS. */
export const VEHICLE_DEFAULTS = {
  count: 3,
  max: 8,
  spacing: 34,
  length: 11.2,
  cruiseSpeed: 11,
  boostSpeed: 19,
  lungeSpeed: 27,
  maxForce: 9.5,
  lungeForce: 24,
  turnSmooth: 4.0,
  mouseTurn: 0.72,
  maxMouseStep: 0.055,
  minDepth: -2.6,
  maxDepth: -1000,
  floorClearance: 6.8,
  minWater: 15,
  beachTurnWater: 26,
  fearRadius: 42,
  lungeFearRadius: 46,
  biteRadius: 2.0,
  lungeBiteRadius: 4.6,
  mouthOffset: 4.8,
  lungeTime: 2.15,
  biteCooldown: 0.16,
  lungeBiteCooldown: 0.1,
  energyDrain: drainForDays(2),
  eatEnergy: 0.08,
  hungry: 0.42,
  satiated: 0.82,
  starveAt: 0.06,
  starveDays: 3,
  mateEnergy: 0.74,
  mateDist: 22,
  pupCost: 0.22,
  pupEnergy: 0.48,
  carcass: 0.55,
  gait: "burst",
  swim: "tail",
  minSpeed: 4.4,
  diet: "bite",
  mesh: "shark",
  filterGraze: 0,
  filterGain: 0.4,
  sense: "sight",
  pods: 0,
  podSize: 0,
};

/**
 * Typical foraging dive or surface interval in nature (minutes) →
 * wall-clock seconds. The day clock is 90× (16 min ≈ 1 day). Breath-hold
 * is milder so a 6 min orca dive is still a couple of minutes on screen, and
 * a 45 min sperm-whale forage is several minutes — not a blink, and
 * not the whole game-day. Tanks stretch with `DAY_SECONDS` so a longer
 * day actually slows oxygen drop.
 *
 * Shallow guilds (orca, dolphin, rorquals): compress 5.
 * Sperm whale: compress 15.
 */
export function breathHold(natureMin, compress = 5) {
  const scale = DAY_SECONDS / DAY_REF;
  return Math.round((natureMin * 60 * 10 * scale) / compress) / 10;
}

/** Depth (y) at which an air-breather is at the air and can recover. */
export function airY(cfg) {
  return (cfg.minDepth ?? -2) - 2.4;
}

/**
 * Wall-clock seconds to swim from `y` to the air at `diveSpeed`.
 * The 1.35× is a heading/steer margin, not extra tank.
 */
export function commuteTime(y, cfg) {
  const dist = Math.max(0, airY(cfg) - (Number.isFinite(y) ? y : airY(cfg)));
  const spd = Math.max(4, cfg.diveSpeed ?? 24);
  return (dist / spd) * 1.35;
}

/**
 * Remaining dive seconds at which the animal must leave for the air.
 * Floor is 12% of the tank so the HUD still shows oxygen on the way up.
 */
export function ascentReserve(y, cfg) {
  const diveTime = cfg.diveTime ?? 28;
  return Math.max(diveTime * 0.12, commuteTime(y, cfg));
}

/**
 * Typical nature minutes plus a commute pad so leaving before the tank
 * is empty does not steal forage time that used to sit after 0%.
 */
export function diveHold(natureMin, compress, forageDepth, diveSpeed, minDepth) {
  const hold = breathHold(natureMin, compress);
  const pad = ascentReserve(forageDepth, {
    diveTime: hold,
    diveSpeed,
    minDepth: minDepth ?? -1.2,
  });
  return Math.round((hold + pad) * 10) / 10;
}

/**
 * Advance an air-breather's breath timer. The tank drains while
 * submerged, including the commute up. Recovery (the `surfaceTime`
 * hang) only starts at the air. Empty tank underwater is drowning.
 *
 * `extra.y` is current depth (for the ascent reserve). `extra.justArrived`
 * resets the hang clock on the first frame at the air.
 */
export function tickBreathHold(surfacing, breathT, dt, cfg, atAir, extra) {
  const diveTime = cfg.diveTime ?? 28;
  const surfaceTime = cfg.surfaceTime ?? 6;
  const y = extra?.y;
  const reserve = Number.isFinite(y) ? ascentReserve(y, cfg) : diveTime * 0.12;
  if (surfacing) {
    if (!atAir) {
      const t = (Number.isFinite(breathT) ? breathT : reserve) - dt;
      if (t <= 0) return { surfacing: true, breathT: 0, drowned: true };
      return { surfacing: true, breathT: t };
    }
    const hang = extra?.justArrived ? surfaceTime : Number.isFinite(breathT) ? breathT : surfaceTime;
    const t = hang - dt;
    if (t > 0) return { surfacing: true, breathT: t };
    return { surfacing: false, breathT: diveTime };
  }
  const t = (Number.isFinite(breathT) ? breathT : diveTime) - dt;
  if (t <= 0 && !atAir) return { surfacing: true, breathT: 0, drowned: true };
  if (t <= reserve && !atAir) return { surfacing: true, breathT: Math.max(t, 0.01) };
  if (t > 0) return { surfacing: false, breathT: t };
  return { surfacing: true, breathT: surfaceTime };
}

/**
 * How individuals relate. Polarized is a traveling ribbon (herring);
 * a mill-ball is only when a vehicle predator is in fear range. Loose is a
 * heading-aligned surface patch (flying fish). Scatter is nearly
 * independent — keep it for later solitary pelagics.
 */
export const SOCIAL = {
  polarized: {
    social: "polarized",
    groups: 2,
  },
  loose: {
    social: "loose",
    restSpacing: 4.6,
    sepRadius: 6.2,
    yMul: 0.72,
    aliRadius: 7.5,
    cohRadius: 9.5,
    sepWeight: 1.55,
    aliWeight: 0.22,
    cohWeight: 0.07,
    holdWeight: 0.42,
    fearWeight: 3.4,
    cruiseWeight: 0.4,
    depthWeight: 0.7,
    noiseWeight: 2.9,
    schoolRadius: 52,
    schoolHeight: 5.2,
    minSchoolSize: 10,
    minSchoolFrac: 0.015,
    splitDistance: 22,
    mergeDistance: 7,
    joinSlack: 2.4,
    lead: 6,
    groups: 5,
  },
  scatter: {
    social: "scatter",
    restSpacing: 8.5,
    sepRadius: 10,
    yMul: 0.85,
    aliRadius: 5,
    cohRadius: 6,
    sepWeight: 1.35,
    aliWeight: 0.06,
    cohWeight: 0.02,
    holdWeight: 0.12,
    fearWeight: 2.8,
    cruiseWeight: 0.34,
    noiseWeight: 3.6,
    schoolRadius: 70,
    minSchoolSize: 2,
    minSchoolFrac: 0.004,
    splitDistance: 14,
    mergeDistance: 4,
    joinSlack: 3,
    lead: 3,
    groups: 8,
  },
};

const LOOK_HERRING = {
  body: [0.55, 1.15, 1],
  back: [0.18, 0.28, 0.24],
  belly: [0.82, 0.88, 0.84],
  fin: [0.22, 0.32, 0.3],
  pec: 1,
  tail: 1,
  wave: 0.16,
};

export const SPECIES = {
  herring: {
    id: "herring",
    label: "herring",
    guild: "forage",
    agent: "school",
    temp: { min: -1.8, max: 24 },
    social: "polarized",
    share: 1,
    fish: {},
    look: LOOK_HERRING,
  },
  capelin: {
    id: "capelin",
    label: "capelin",
    guild: "forage",
    agent: "school",
    temp: { min: -1.8, max: 12 },
    social: "polarized",
    share: 0.85,
    fish: {
      restSpacing: 1.12,
      sepRadius: 1.7,
      schoolHeight: 4.2,
      schoolRadius: 28,
      length: 0.52,
      nightDepth: -8,
      dawnDepth: -28,
      dayDepth: -52,
      duskDepth: -18,
      maxDepth: -300,
      minSpeed: 2.4,
      maxSpeed: 9.4,
      fleeSpeed: 18,
      minSchoolSize: 160,
      metabolism: schoolMet(0.014),
    },
    look: {
      body: [0.4, 1.02, 1],
      back: [0.12, 0.2, 0.26],
      belly: [0.72, 0.7, 0.62],
      fin: [0.2, 0.24, 0.22],
      pec: 0.85,
      tail: 0.82,
      wave: 0.14,
    },
  },
  menhaden: {
    id: "menhaden",
    label: "menhaden",
    guild: "forage",
    agent: "school",
    realm: "shelf",
    social: "polarized",
    share: 0.9,
    fish: {
      restSpacing: 1.72,
      sepRadius: 2.55,
      schoolHeight: 5.2,
      schoolRadius: 38,
      length: 1.18,
      nightDepth: -6,
      dawnDepth: -18,
      dayDepth: -32,
      duskDepth: -14,
      maxDepth: -48,
      minSpeed: 2.1,
      maxSpeed: 8.2,
      fleeSpeed: 16,
      minSchoolSize: 140,
      metabolism: schoolMet(0.01),
      grazeMul: 1.35,
      grazeOn: "p",
      o2Min: 2,
    },
    look: {
      body: [0.78, 1.05, 1],
      back: [0.22, 0.32, 0.16],
      belly: [0.78, 0.72, 0.42],
      fin: [0.28, 0.32, 0.18],
      pec: 1.05,
      tail: 0.9,
      wave: 0.12,
    },
  },
  sardine: {
    id: "sardine",
    label: "sardine",
    guild: "forage",
    agent: "school",
    social: "polarized",
    share: 1,
    fish: {
      restSpacing: 1.14,
      sepRadius: 1.78,
      schoolHeight: 4.6,
      schoolRadius: 30,
      length: 0.72,
      nightDepth: -12,
      dawnDepth: -38,
      dayDepth: -58,
      duskDepth: -24,
      maxDepth: -200,
      minSpeed: 3.2,
      maxSpeed: 12.6,
      fleeSpeed: 24,
      minSchoolSize: 180,
    },
    look: {
      body: [0.46, 1.22, 1],
      back: [0.14, 0.28, 0.4],
      belly: [0.9, 0.92, 0.86],
      fin: [0.16, 0.28, 0.34],
      pec: 0.82,
      tail: 1.08,
      wave: 0.18,
    },
  },
  pilchard: {
    id: "pilchard",
    label: "pilchard",
    guild: "forage",
    agent: "school",
    social: "polarized",
    share: 0.95,
    fish: {
      restSpacing: 1.18,
      sepRadius: 1.88,
      schoolHeight: 5.0,
      schoolRadius: 32,
      length: 0.7,
      nightDepth: -14,
      dawnDepth: -42,
      dayDepth: -68,
      duskDepth: -28,
      maxDepth: -150,
      minSpeed: 3.0,
      maxSpeed: 11.6,
      fleeSpeed: 22,
      minSchoolSize: 170,
    },
    look: {
      body: [0.5, 1.18, 1],
      back: [0.16, 0.34, 0.3],
      belly: [0.88, 0.9, 0.78],
      fin: [0.18, 0.3, 0.26],
      pec: 0.88,
      tail: 1.02,
      wave: 0.17,
    },
  },
  anchovy: {
    id: "anchovy",
    label: "anchovy",
    guild: "forage",
    agent: "school",
    social: "polarized",
    share: 1,
    fish: {
      restSpacing: 0.88,
      sepRadius: 1.42,
      schoolHeight: 3.6,
      schoolRadius: 26,
      length: 0.42,
      nightDepth: -8,
      dawnDepth: -24,
      dayDepth: -38,
      duskDepth: -16,
      maxDepth: -150,
      minSpeed: 2.6,
      maxSpeed: 11.2,
      fleeSpeed: 20,
      minSchoolSize: 200,
      metabolism: schoolMet(0.015),
    },
    look: {
      body: [0.34, 1.28, 1],
      back: [0.2, 0.26, 0.22],
      belly: [0.86, 0.84, 0.72],
      fin: [0.22, 0.24, 0.2],
      pec: 0.7,
      tail: 0.78,
      wave: 0.2,
    },
  },
  sardinella: {
    id: "sardinella",
    label: "sardinella",
    guild: "forage",
    agent: "school",
    temp: { min: 16, max: 31 },
    social: "polarized",
    share: 0.9,
    fish: {
      restSpacing: 1.08,
      sepRadius: 1.7,
      schoolHeight: 4.4,
      schoolRadius: 29,
      length: 0.62,
      nightDepth: -10,
      dawnDepth: -32,
      dayDepth: -48,
      duskDepth: -20,
      maxDepth: -200,
      minSpeed: 3.1,
      maxSpeed: 12.2,
      fleeSpeed: 23,
      minSchoolSize: 180,
    },
    look: {
      body: [0.48, 1.16, 1],
      back: [0.2, 0.3, 0.22],
      belly: [0.9, 0.82, 0.48],
      fin: [0.24, 0.3, 0.18],
      pec: 0.84,
      tail: 0.96,
      wave: 0.17,
    },
  },
  mackerel: {
    id: "mackerel",
    label: "mackerel",
    guild: "forage",
    agent: "school",
    social: "polarized",
    share: 0.55,
    fish: {
      restSpacing: 1.55,
      sepRadius: 2.4,
      schoolHeight: 5.8,
      schoolRadius: 36,
      length: 1.22,
      nightDepth: -12,
      dawnDepth: -32,
      dayDepth: -48,
      duskDepth: -22,
      maxDepth: -400,
      minSpeed: 3.8,
      maxSpeed: 14.2,
      fleeSpeed: 26,
      minSchoolSize: 80,
      metabolism: schoolMet(0.013),
      grazeMul: 0.85,
      diet: "both",
      huntTaxa: ["herring", "capelin", "sprat", "sandlance", "anchovy", "sardine", "polarcod"],
      biteRadius: 0.95,
      eatEnergy: 0.045,
    },
    look: {
      body: [0.52, 1.08, 1],
      back: [0.08, 0.22, 0.34],
      belly: [0.7, 0.78, 0.62],
      fin: [0.12, 0.24, 0.28],
      pec: 1.15,
      tail: 1.12,
      wave: 0.19,
    },
  },
  flyingfish: {
    id: "flyingfish",
    label: "flying fish",
    guild: "surface",
    agent: "school",
    realm: "oceanic",
    temp: { min: 16, max: 31 },
    social: "loose",
    share: 0.16,
    fish: {
      length: 0.48,
      nightDepth: -2.4,
      dawnDepth: -6,
      dayDepth: -10,
      duskDepth: -5,
      maxDepth: -20,
      surfaceClearance: 0.7,
      floorClearance: 1.6,
      minSpeed: 4.2,
      maxSpeed: 14.5,
      fleeSpeed: 26,
      pitchLimit: 0.22,
      pitchDamp: 3.4,
      maxTurn: 1.55,
      metabolism: schoolMet(0.016),
      grazeMul: 0.55,
      anchorTop: -1.05,
    },
    look: {
      shape: "flying",
      swim: "fly",
      body: [0.38, 0.92, 1.18],
      back: [0.1, 0.2, 0.38],
      belly: [0.78, 0.84, 0.92],
      fin: [0.16, 0.28, 0.42],
      pec: 3.4,
      tail: 0.88,
      wave: 0.22,
    },
  },
  sprat: {
    id: "sprat",
    label: "sprat",
    guild: "forage",
    agent: "school",
    social: "polarized",
    share: 0.55,
    fish: {
      restSpacing: 0.82,
      sepRadius: 1.28,
      schoolHeight: 3.4,
      schoolRadius: 22,
      length: 0.14,
      nightDepth: -8,
      dawnDepth: -22,
      dayDepth: -38,
      duskDepth: -16,
      maxDepth: -150,
      minSpeed: 2.2,
      maxSpeed: 8.8,
      fleeSpeed: 16,
      minSchoolSize: 220,
      metabolism: schoolMet(0.016),
    },
    look: {
      body: [0.32, 1.08, 1],
      back: [0.16, 0.24, 0.2],
      belly: [0.86, 0.86, 0.74],
      fin: [0.2, 0.26, 0.22],
      pec: 0.72,
      tail: 0.84,
      wave: 0.2,
    },
  },
  sandlance: {
    id: "sandlance",
    label: "sand lance",
    guild: "forage",
    agent: "school",
    realm: "shelf",
    social: "polarized",
    share: 0.4,
    fish: {
      restSpacing: 1.02,
      sepRadius: 1.55,
      schoolHeight: 2.4,
      schoolRadius: 24,
      length: 0.22,
      nightDepth: -6,
      dawnDepth: -22,
      dayDepth: -42,
      duskDepth: -14,
      maxDepth: -120,
      floorClearance: 1.1,
      minSpeed: 2.0,
      maxSpeed: 9.6,
      fleeSpeed: 18,
      minSchoolSize: 140,
      metabolism: schoolMet(0.014),
    },
    look: {
      shape: "needle",
      swim: "eel",
      body: [0.22, 1.35, 1.12],
      back: [0.28, 0.32, 0.18],
      belly: [0.78, 0.74, 0.52],
      fin: [0.24, 0.28, 0.16],
      pec: 0.55,
      tail: 0.7,
      wave: 0.12,
    },
  },
  polarcod: {
    id: "polarcod",
    label: "polar cod",
    guild: "forage",
    agent: "school",
    temp: { min: -1.8, max: 6 },
    social: "polarized",
    share: 0.75,
    fish: {
      restSpacing: 1.22,
      sepRadius: 1.85,
      schoolHeight: 4.0,
      schoolRadius: 26,
      length: 0.28,
      nightDepth: -12,
      dawnDepth: -28,
      dayDepth: -48,
      duskDepth: -22,
      maxDepth: -700,
      minSpeed: 1.8,
      maxSpeed: 7.4,
      fleeSpeed: 14,
      minSchoolSize: 120,
      metabolism: schoolMet(0.011),
      iceAssociated: true,
    },
    look: {
      body: [0.42, 1.12, 1],
      back: [0.22, 0.3, 0.38],
      belly: [0.7, 0.72, 0.68],
      fin: [0.2, 0.26, 0.32],
      pec: 0.9,
      tail: 0.88,
      wave: 0.13,
    },
  },
  silverfish: {
    id: "silverfish",
    label: "Antarctic silverfish",
    guild: "forage",
    agent: "school",
    temp: { min: -1.8, max: 6 },
    social: "polarized",
    share: 1,
    fish: {
      restSpacing: 1.08,
      sepRadius: 1.65,
      schoolHeight: 4.8,
      schoolRadius: 30,
      length: 0.2,
      nightDepth: -18,
      dawnDepth: -48,
      dayDepth: -82,
      duskDepth: -32,
      maxDepth: -700,
      minSpeed: 2.2,
      maxSpeed: 8.6,
      fleeSpeed: 16,
      minSchoolSize: 180,
      metabolism: schoolMet(0.012),
      iceAssociated: true,
    },
    look: {
      body: [0.28, 1.18, 1],
      back: [0.42, 0.48, 0.5],
      belly: [0.88, 0.9, 0.92],
      fin: [0.36, 0.4, 0.44],
      pec: 0.78,
      tail: 0.9,
      wave: 0.15,
    },
  },
  saury: {
    id: "saury",
    label: "Pacific saury",
    guild: "surface",
    agent: "school",
    temp: { min: 6, max: 25 },
    social: "loose",
    share: 0.22,
    fish: {
      length: 0.32,
      nightDepth: -2.8,
      dawnDepth: -8,
      dayDepth: -14,
      duskDepth: -6,
      maxDepth: -50,
      surfaceClearance: 0.8,
      minSpeed: 3.6,
      maxSpeed: 13.2,
      fleeSpeed: 24,
      pitchLimit: 0.28,
      pitchDamp: 2.8,
      maxTurn: 1.5,
      metabolism: schoolMet(0.015),
      grazeMul: 0.7,
      anchorTop: -1.2,
    },
    look: {
      shape: "needle",
      swim: "eel",
      body: [0.26, 1.32, 1.08],
      back: [0.08, 0.28, 0.22],
      belly: [0.72, 0.82, 0.7],
      fin: [0.1, 0.3, 0.24],
      pec: 1.35,
      tail: 0.95,
      wave: 0.21,
    },
  },
  marketsquid: {
    id: "marketsquid",
    label: "market squid",
    guild: "cephalopod",
    agent: "school",
    social: "scatter",
    share: 0.18,
    fish: {
      length: 0.28,
      nightDepth: -16,
      dawnDepth: -48,
      dayDepth: -200,
      duskDepth: -80,
      maxDepth: -400,
      minSpeed: 1.6,
      maxSpeed: 8.4,
      fleeSpeed: 18,
      pitchLimit: 0.95,
      pitchDamp: 0.85,
      maxTurn: 2.15,
      metabolism: schoolMet(0.018),
      grazeMul: 0.9,
      minSchoolSize: 8,
    },
    look: {
      shape: "squid",
      swim: "jet",
      body: [0.38, 0.85, 1.35],
      back: [0.42, 0.38, 0.28],
      belly: [0.62, 0.52, 0.38],
      fin: [0.48, 0.4, 0.3],
      pec: 1.6,
      tail: 1.4,
      wave: 0.28,
    },
  },
  lanternfish: {
    id: "lanternfish",
    label: "lanternfish",
    guild: "forage",
    agent: "school",
    realm: "oceanic",
    ice: "avoid",
    temp: { min: 3, max: 30 },
    social: "scatter",
    share: 0.14,
    fish: {
      length: 0.08,
      nightDepth: -40,
      dawnDepth: -140,
      dayDepth: -280,
      duskDepth: -120,
      maxDepth: -450,
      minSpeed: 1.2,
      maxSpeed: 6.4,
      fleeSpeed: 12,
      pitchLimit: 0.7,
      pitchDamp: 1.4,
      metabolism: schoolMet(0.014),
      grazeMul: 0.55,
      o2Min: 0.08,
      minSchoolSize: 12,
      schoolRadius: 18,
      schoolHeight: 8,
    },
    look: {
      shape: "lantern",
      photophores: true,
      glow: [0.55, 0.85, 0.45],
      body: [0.32, 1.05, 1.12],
      back: [0.06, 0.1, 0.14],
      belly: [0.42, 0.48, 0.4],
      fin: [0.08, 0.14, 0.16],
      pec: 0.7,
      tail: 0.82,
      wave: 0.2,
    },
  },
  krill: {
    id: "krill",
    label: "krill",
    guild: "forage",
    agent: "school",
    social: "scatter",
    share: 0.4,
    fish: {
      length: 0.055,
      nightDepth: -6,
      dawnDepth: -40,
      dayDepth: -90,
      duskDepth: -28,
      maxDepth: -220,
      minSpeed: 0.7,
      maxSpeed: 3.8,
      fleeSpeed: 7,
      pitchLimit: 0.82,
      pitchDamp: 1.1,
      maxTurn: 1.85,
      metabolism: schoolMet(0.02),
      grazeMul: 1.35,
      grazeOn: "p",
      minSchoolSize: 16,
      schoolRadius: 14,
      schoolHeight: 5,
      iceAssociated: true,
    },
    look: {
      shape: "krill",
      swim: "paddle",
      body: [0.22, 0.72, 1.55],
      back: [0.62, 0.22, 0.12],
      belly: [0.82, 0.42, 0.22],
      fin: [0.7, 0.28, 0.16],
      pec: 0.45,
      tail: 1.15,
      wave: 0.32,
    },
  },
  jackmackerel: {
    id: "jackmackerel",
    label: "jack mackerel",
    guild: "forage",
    agent: "school",
    social: "polarized",
    share: 0.5,
    fish: {
      restSpacing: 1.35,
      sepRadius: 2.05,
      schoolHeight: 5.6,
      schoolRadius: 32,
      length: 0.42,
      nightDepth: -14,
      dawnDepth: -42,
      dayDepth: -95,
      duskDepth: -38,
      maxDepth: -300,
      minSpeed: 3.2,
      maxSpeed: 11.4,
      fleeSpeed: 20,
      metabolism: schoolMet(0.013),
      grazeMul: 0.85,
      minSchoolSize: 140,
    },
    look: {
      body: [0.34, 1.22, 1.05],
      back: [0.18, 0.32, 0.28],
      belly: [0.72, 0.78, 0.62],
      fin: [0.22, 0.38, 0.3],
      pec: 1.05,
      tail: 0.92,
      wave: 0.17,
    },
  },
  illex: {
    id: "illex",
    label: "shortfin squid",
    guild: "cephalopod",
    agent: "school",
    social: "scatter",
    share: 0.16,
    fish: {
      length: 0.32,
      nightDepth: -20,
      dawnDepth: -80,
      dayDepth: -240,
      duskDepth: -90,
      maxDepth: -600,
      minSpeed: 1.8,
      maxSpeed: 9.2,
      fleeSpeed: 20,
      pitchLimit: 0.95,
      pitchDamp: 0.85,
      maxTurn: 2.2,
      metabolism: schoolMet(0.019),
      grazeMul: 0.85,
      minSchoolSize: 8,
    },
    look: {
      shape: "squid",
      swim: "jet",
      body: [0.36, 0.82, 1.4],
      back: [0.28, 0.22, 0.2],
      belly: [0.52, 0.42, 0.32],
      fin: [0.34, 0.26, 0.22],
      pec: 1.55,
      tail: 1.45,
      wave: 0.3,
    },
  },
  shark: {
    id: "shark",
    label: "blue shark",
    guild: "pelagic-predator",
    agent: "vehicle",
    temp: { min: 8, max: 28 },
    prey: ["school"],
    vehicle: {
      mesh: "shark",
      diet: "bite",
      maxDepth: -1000,
      o2Min: 1.4,
      tints: [
        { scale: 1.02, aggression: 1.06, tint: { r: 1, g: 1, b: 1 } },
        { scale: 1.24, aggression: 1.2, tint: { r: 0.72, g: 0.7, b: 0.64 } },
        { scale: 0.78, aggression: 0.9, tint: { r: 1.12, g: 1.08, b: 1.18 } },
      ],
    },
  },
  tuna: {
    id: "tuna",
    label: "skipjack",
    guild: "pelagic-predator",
    agent: "school",
    realm: "oceanic",
    social: "polarized",
    share: 0.9,
    prey: ["school"],
    temp: { min: 16, max: 31 },
    fish: {
      diet: "bite",
      restSpacing: 2.4,
      sepRadius: 3.4,
      schoolHeight: 7.2,
      schoolRadius: 42,
      length: 0.82,
      nightDepth: -8,
      dawnDepth: -22,
      dayDepth: -48,
      duskDepth: -18,
      maxDepth: -260,
      minSpeed: 6.2,
      maxSpeed: 16,
      fleeSpeed: 22,
      minSchoolSize: 24,
      metabolism: schoolMet(0.018),
      o2Min: 2.4,
      biteRadius: 1.35,
      eatEnergy: 0.07,
      fearRadius: 12,
      groups: 3,
    },
    look: {
      shape: "tuna",
      swim: "thunniform",
      body: [0.48, 1.28, 1.05],
      back: [0.22, 0.32, 0.48],
      belly: [0.72, 0.78, 0.62],
      fin: [0.18, 0.28, 0.4],
      pec: 0.72,
      tail: 1.22,
      wave: 0.12,
    },
  },
  cod: {
    id: "cod",
    label: "cod",
    guild: "demersal",
    agent: "school",
    realm: "shelf",
    floor: { min: -650 },
    social: "scatter",
    share: 1,
    prey: ["herring", "capelin", "sandlance"],
    fish: {
      diet: "bite",
      habitat: "benthic",
      restSpacing: 6.4,
      sepRadius: 7.2,
      schoolHeight: 4.2,
      schoolRadius: 28,
      length: 1.12,
      nightDepth: -40,
      dawnDepth: -50,
      dayDepth: -70,
      duskDepth: -48,
      maxDepth: -600,
      floorClearance: 2.4,
      minWater: 8,
      beachTurnWater: 18,
      minSpeed: 1.15,
      maxSpeed: 5.4,
      fleeSpeed: 8.5,
      minSchoolSize: 8,
      metabolism: schoolMet(0.008),
      biteRadius: 1.15,
      eatEnergy: 0.1,
      fearRadius: 9,
      benthosGraze: 0.00045,
      huntTaxa: ["herring", "capelin", "sandlance", "sprat", "polarcod"],
      groups: 4,
    },
    look: {
      shape: "cod",
      swim: "body",
      body: [0.78, 0.92, 1.08],
      back: [0.42, 0.36, 0.24],
      belly: [0.62, 0.56, 0.4],
      fin: [0.38, 0.32, 0.22],
      pec: 1.15,
      tail: 0.92,
      wave: 0.22,
    },
  },
  toothfish: {
    id: "toothfish",
    label: "Antarctic toothfish",
    guild: "slope-predator",
    agent: "school",
    realm: "slope",
    social: "scatter",
    share: 0.4,
    prey: ["silverfish"],
    fish: {
      diet: "bite",
      habitat: "benthic",
      restSpacing: 8.2,
      sepRadius: 9.4,
      schoolHeight: 5.5,
      schoolRadius: 36,
      length: 1.45,
      nightDepth: -80,
      dawnDepth: -120,
      dayDepth: -180,
      duskDepth: -110,
      maxDepth: -2000,
      floorClearance: 3.2,
      minWater: 14,
      minSpeed: 0.9,
      maxSpeed: 4.8,
      fleeSpeed: 7.2,
      minSchoolSize: 4,
      metabolism: schoolMet(0.007),
      biteRadius: 1.35,
      eatEnergy: 0.11,
      fearRadius: 11,
      huntTaxa: ["silverfish"],
      groups: 3,
    },
    look: {
      shape: "cod",
      swim: "body",
      body: [0.72, 0.95, 1.12],
      back: [0.32, 0.38, 0.44],
      belly: [0.48, 0.52, 0.5],
      fin: [0.28, 0.34, 0.4],
      pec: 1.05,
      tail: 0.88,
      wave: 0.18,
    },
  },
  greatwhite: {
    id: "greatwhite",
    label: "great white",
    guild: "pelagic-predator",
    agent: "vehicle",
    prey: ["school"],
    vehicle: {
      count: 2,
      max: 4,
      spacing: 48,
      length: 5.2,
      cruiseSpeed: 8.4,
      boostSpeed: 16,
      lungeSpeed: 24,
      maxDepth: -1200,
      o2Min: 2,
      fearRadius: 52,
      lungeFearRadius: 58,
      biteRadius: 2.4,
      lungeBiteRadius: 5.2,
      mouthOffset: 2.4,
      energyDrain: drainForDays(2),
      eatEnergy: 0.12,
      starveDays: 4,
      gait: "burst",
      mesh: "shark",
      diet: "bite",
      tints: [
        { scale: 1.08, aggression: 1.12, tint: { r: 0.72, g: 0.74, b: 0.78 } },
        { scale: 0.92, aggression: 1.0, tint: { r: 0.55, g: 0.58, b: 0.62 } },
      ],
    },
  },
  tigershark: {
    id: "tigershark",
    label: "tiger shark",
    guild: "pelagic-predator",
    agent: "vehicle",
    temp: { min: 18, max: 31 },
    prey: ["school"],
    vehicle: {
      count: 2,
      max: 5,
      spacing: 40,
      length: 3.8,
      cruiseSpeed: 7.2,
      boostSpeed: 14,
      lungeSpeed: 20,
      maxDepth: -350,
      o2Min: 1.8,
      fearRadius: 38,
      lungeFearRadius: 44,
      biteRadius: 2.1,
      mouthOffset: 1.8,
      energyDrain: drainForDays(2),
      eatEnergy: 0.1,
      gait: "burst",
      mesh: "shark",
      diet: "bite",
      tints: [
        { scale: 1.05, aggression: 0.92, tint: { r: 0.62, g: 0.52, b: 0.32 } },
        { scale: 0.9, aggression: 1.05, tint: { r: 0.48, g: 0.4, b: 0.24 } },
      ],
    },
  },
  hammerhead: {
    id: "hammerhead",
    label: "hammerhead",
    guild: "pelagic-predator",
    agent: "vehicle",
    temp: { min: 16, max: 31 },
    prey: ["school"],
    vehicle: {
      count: 8,
      max: 14,
      pods: 1,
      spacing: 18,
      length: 2.6,
      cruiseSpeed: 9.2,
      boostSpeed: 16,
      lungeSpeed: 22,
      maxDepth: -500,
      o2Min: 2,
      fearRadius: 32,
      lungeFearRadius: 38,
      biteRadius: 1.6,
      mouthOffset: 1.4,
      energyDrain: drainForDays(2),
      eatEnergy: 0.08,
      gait: "burst",
      mesh: "hammerhead",
      diet: "bite",
      tints: [
        { scale: 1.0, aggression: 1.1, tint: { r: 0.42, g: 0.5, b: 0.55 } },
        { scale: 0.86, aggression: 1.18, tint: { r: 0.35, g: 0.42, b: 0.48 } },
      ],
    },
  },
  whaleshark: {
    id: "whaleshark",
    label: "whale shark",
    guild: "filter-feeder",
    agent: "vehicle",
    prey: ["bloom"],
    temp: { min: 18, max: 31 },
    vehicle: {
      count: 1,
      max: 2,
      spacing: 70,
      length: 10.5,
      cruiseSpeed: 3.4,
      boostSpeed: 5.2,
      lungeSpeed: 6.4,
      maxForce: 4.2,
      lungeForce: 6,
      minDepth: -3.2,
      maxDepth: -1920,
      o2Min: 1.6,
      floorClearance: 8,
      fearRadius: 8,
      lungeFearRadius: 10,
      biteRadius: 0.2,
      lungeBiteRadius: 0.2,
      mouthOffset: 4.2,
      energyDrain: drainForDays(2.5),
      eatEnergy: 0.04,
      hungry: 0.5,
      satiated: 0.88,
      starveDays: 6,
      gait: "ram",
      minSpeed: 1.8,
      turnSmooth: 2.2,
      mesh: "whaleshark",
      swim: "tail",
      diet: "filter",
      filterGraze: 0.14,
      filterGain: 0.55,
      tints: [{ scale: 1.0, aggression: 0.4, tint: { r: 0.35, g: 0.42, b: 0.5 } }],
    },
  },
  minke: {
    id: "minke",
    label: "minke whale",
    guild: "mysticete",
    agent: "vehicle",
    temp: { min: -1.8, max: 18 },
    prey: ["bloom"],
    vehicle: {
      count: 2,
      max: 4,
      spacing: 55,
      length: 8.2,
      cruiseSpeed: 6.4,
      boostSpeed: 10,
      lungeSpeed: 12,
      maxForce: 7,
      minDepth: -1.2,
      maxDepth: -400,
      forageDepth: -50,
      floorClearance: 6.8,
      fearRadius: 28,
      lungeFearRadius: 34,
      biteRadius: 2.8,
      lungeBiteRadius: 4.2,
      mouthOffset: 3.4,
      energyDrain: drainForDays(2.5),
      eatEnergy: 0.09,
      starveDays: 5,
      gait: "ram",
      minSpeed: 2.4,
      turnSmooth: 3.2,
      mesh: "whale",
      swim: "fluke",
      diet: "both",
      breathes: true,
      surfaceTime: breathHold(1.5),
      diveTime: diveHold(6, 5, -50, 22, -1.2),
      diveSpeed: 22,
      filterGraze: 0.1,
      filterGain: 0.48,
      tints: [
        { scale: 1.04, aggression: 0.7, tint: { r: 0.45, g: 0.48, b: 0.52 } },
        { scale: 0.9, aggression: 0.75, tint: { r: 0.38, g: 0.4, b: 0.44 } },
      ],
    },
  },
  humpback: {
    id: "humpback",
    label: "humpback",
    guild: "mysticete",
    agent: "vehicle",
    prey: ["school"],
    vehicle: {
      count: 1,
      max: 3,
      spacing: 72,
      length: 13.5,
      cruiseSpeed: 5.2,
      boostSpeed: 9,
      lungeSpeed: 11,
      maxForce: 6.5,
      minDepth: -1.2,
      maxDepth: -500,
      forageDepth: -60,
      fearRadius: 58,
      lungeFearRadius: 66,
      biteRadius: 4.5,
      lungeBiteRadius: 7.2,
      mouthOffset: 5.5,
      energyDrain: drainForDays(2.5),
      eatEnergy: 0.14,
      starveDays: 6,
      gait: "burst",
      minSpeed: 2.0,
      turnSmooth: 2.6,
      mesh: "whale",
      swim: "fluke",
      diet: "bite",
      breathes: true,
      surfaceTime: breathHold(2.5),
      diveTime: diveHold(10, 5, -60, 28, -1.2),
      diveSpeed: 28,
      tints: [{ scale: 1.0, aggression: 0.65, tint: { r: 0.28, g: 0.3, b: 0.34 } }],
    },
  },
  spermwhale: {
    id: "spermwhale",
    label: "sperm whale",
    guild: "odontocete",
    agent: "vehicle",
    realm: "oceanic",
    floor: { max: -400 },
    ice: "avoid",
    vehicle: {
      count: 1,
      max: 2,
      pods: 1,
      spacing: 48,
      length: 14.5,
      cruiseSpeed: 5.8,
      boostSpeed: 10,
      lungeSpeed: 12,
      minDepth: -1.2,
      maxDepth: -2000,
      forageDepth: -700,
      fearRadius: 48,
      lungeFearRadius: 54,
      biteRadius: 3.2,
      lungeBiteRadius: 5.5,
      mouthOffset: 6.2,
      energyDrain: drainForDays(2.5),
      eatEnergy: 0.16,
      starveDays: 7,
      gait: "burst",
      minSpeed: 2.2,
      turnSmooth: 2.4,
      mesh: "spermwhale",
      swim: "fluke",
      diet: "bite",
      sense: "echo",
      breathes: true,
      surfaceTime: breathHold(8, 15),
      diveTime: diveHold(45, 15, -700, 55, -1.2),
      diveSpeed: 55,
      huntTaxa: ["marketsquid", "illex", "lanternfish", "humboldtsquid"],
      huntKinds: ["giantsquid"],
      eatVehicleEnergy: 0.38,
      tints: [{ scale: 1.05, aggression: 0.8, tint: { r: 0.52, g: 0.51, b: 0.5 } }],
    },
  },
  orca: {
    id: "orca",
    label: "orca",
    guild: "odontocete",
    agent: "vehicle",
    prey: ["school"],
    vehicle: {
      count: 5,
      max: 8,
      pods: 1,
      spacing: 14,
      length: 6.8,
      cruiseSpeed: 10.5,
      boostSpeed: 18,
      lungeSpeed: 24,
      maxForce: 12,
      lungeForce: 22,
      turnSmooth: 5.4,
      minDepth: -1.2,
      maxDepth: -800,
      forageDepth: -90,
      fearRadius: 62,
      lungeFearRadius: 70,
      biteRadius: 2.2,
      lungeBiteRadius: 4.8,
      mouthOffset: 2.8,
      energyDrain: drainForDays(2),
      eatEnergy: 0.13,
      starveDays: 4,
      gait: "ram",
      minSpeed: 4.0,
      mesh: "orca",
      swim: "fluke",
      diet: "bite",
      sense: "echo",
      breathes: true,
      surfaceTime: breathHold(1.2),
      diveTime: diveHold(6, 5, -90, 32, -1.2),
      diveSpeed: 32,
      tints: [
        { scale: 1.08, aggression: 1.25, tint: { r: 0.22, g: 0.22, b: 0.26 } },
        { scale: 0.88, aggression: 1.15, tint: { r: 0.85, g: 0.86, b: 0.9 } },
      ],
    },
  },
  humboldtsquid: {
    id: "humboldtsquid",
    label: "Humboldt squid",
    guild: "cephalopod-predator",
    agent: "school",
    social: "scatter",
    share: 0.72,
    prey: ["anchovy", "sardine", "mackerel", "lanternfish", "jackmackerel"],
    o2: { needOmz: true },
    upwellMin: 0.12,
    fish: {
      diet: "bite",
      length: 1.6,
      nightDepth: -80,
      dawnDepth: -280,
      dayDepth: -700,
      duskDepth: -220,
      maxDepth: -1200,
      omzRefuge: true,
      o2Min: 0.04,
      minSpeed: 1.6,
      maxSpeed: 12,
      fleeSpeed: 22,
      pitchLimit: 0.95,
      pitchDamp: 0.85,
      maxTurn: 2.2,
      metabolism: schoolMet(0.02),
      biteRadius: 1.4,
      eatEnergy: 0.07,
      fearRadius: 16,
      huntTaxa: ["anchovy", "sardine", "mackerel", "lanternfish", "jackmackerel"],
      minSchoolSize: 8,
      groups: 6,
      restSpacing: 5.2,
      sepRadius: 6.4,
    },
    look: {
      shape: "squid",
      swim: "jet",
      body: [0.48, 0.9, 1.55],
      back: [0.72, 0.28, 0.22],
      belly: [0.85, 0.42, 0.28],
      fin: [0.62, 0.24, 0.2],
      pec: 1.7,
      tail: 1.5,
      wave: 0.34,
    },
  },
  giantsquid: {
    id: "giantsquid",
    label: "giant squid",
    guild: "cephalopod-predator",
    agent: "vehicle",
    realm: "oceanic",
    ice: "avoid",
    floor: { max: -350 },
    minFloorY: -350,
    prey: ["lanternfish", "marketsquid", "illex"],
    vehicle: {
      count: 5,
      max: 8,
      spacing: 48,
      length: 8.6,
      cruiseSpeed: 4.2,
      boostSpeed: 9,
      lungeSpeed: 13,
      maxForce: 7.5,
      minDepth: -80,
      maxDepth: -1200,
      nightDepth: -420,
      dawnDepth: -620,
      dayDepth: -850,
      duskDepth: -580,
      fearRadius: 28,
      lungeFearRadius: 36,
      biteRadius: 2.4,
      lungeBiteRadius: 3.8,
      mouthOffset: 3.4,
      energyDrain: drainForDays(2),
      eatEnergy: 0.12,
      starveDays: 5.5,
      gait: "jet",
      minSpeed: 1.1,
      turnSmooth: 2.2,
      mesh: "squid",
      swim: "jet",
      diet: "bite",
      huntTaxa: ["lanternfish", "marketsquid", "illex"],
      tints: [{ scale: 1.12, aggression: 0.85, tint: { r: 0.82, g: 0.55, b: 0.48 } }],
    },
  },
  commondolphin: {
    id: "commondolphin",
    label: "common dolphin",
    guild: "odontocete",
    agent: "vehicle",
    temp: { min: 14, max: 31 },
    prey: ["flyingfish", "sardinella", "anchovy", "sardine"],
    vehicle: {
      count: 18,
      max: 28,
      podSize: 10,
      spacing: 8,
      length: 2.15,
      cruiseSpeed: 11.2,
      boostSpeed: 18,
      lungeSpeed: 22,
      maxForce: 11,
      lungeForce: 20,
      turnSmooth: 5.6,
      minDepth: -1.1,
      maxDepth: -300,
      forageDepth: -18,
      fearRadius: 26,
      lungeFearRadius: 32,
      biteRadius: 1.15,
      lungeBiteRadius: 2.0,
      mouthOffset: 0.95,
      energyDrain: drainForDays(1.5),
      eatEnergy: 0.08,
      starveDays: 3,
      gait: "ram",
      minSpeed: 4.6,
      mesh: "dolphin",
      swim: "fluke",
      diet: "bite",
      breathes: true,
      surfaceTime: breathHold(0.7),
      diveTime: diveHold(2.5, 5, -18, 24, -1.1),
      diveSpeed: 24,
      huntTaxa: ["flyingfish", "sardinella", "anchovy", "sardine"],
      tints: [
        { scale: 1.0, aggression: 1.12, tint: { r: 0.55, g: 0.62, b: 0.72 } },
        { scale: 0.9, aggression: 1.18, tint: { r: 0.72, g: 0.76, b: 0.82 } },
      ],
    },
  },
  mahi: {
    id: "mahi",
    label: "mahi-mahi",
    guild: "pelagic-predator",
    agent: "school",
    social: "loose",
    share: 0.38,
    prey: ["school"],
    temp: { min: 16, max: 31 },
    fish: {
      diet: "bite",
      length: 1.15,
      nightDepth: -3,
      dawnDepth: -8,
      dayDepth: -18,
      duskDepth: -8,
      maxDepth: -85,
      o2Min: 2.6,
      minSpeed: 5.4,
      maxSpeed: 16,
      fleeSpeed: 22,
      minSchoolSize: 8,
      metabolism: schoolMet(0.019),
      biteRadius: 1.2,
      eatEnergy: 0.07,
      fearRadius: 11,
      groups: 2,
      cruiseWeight: 0.86,
      noiseWeight: 0.85,
    },
    look: {
      shape: "mahi",
      swim: "thunniform",
      body: [0.55, 1.05, 1.22],
      back: [0.22, 0.55, 0.48],
      belly: [0.85, 0.82, 0.28],
      fin: [0.28, 0.72, 0.55],
      pec: 0.9,
      tail: 1.15,
      wave: 0.16,
    },
  },
  barracuda: {
    id: "barracuda",
    label: "barracuda",
    guild: "pelagic-predator",
    agent: "school",
    social: "scatter",
    share: 0.28,
    prey: ["school"],
    temp: { min: 18, max: 31 },
    fish: {
      diet: "bite",
      length: 1.35,
      nightDepth: -6,
      dawnDepth: -12,
      dayDepth: -28,
      duskDepth: -14,
      maxDepth: -110,
      o2Min: 2.2,
      minSpeed: 1.6,
      maxSpeed: 14,
      fleeSpeed: 26,
      minSchoolSize: 4,
      metabolism: schoolMet(0.014),
      biteRadius: 1.15,
      eatEnergy: 0.08,
      fearRadius: 10,
      groups: 3,
      restSpacing: 7.5,
      cruiseWeight: 0.84,
      noiseWeight: 0.7,
    },
    look: {
      shape: "barracuda",
      swim: "body",
      body: [0.28, 1.45, 1.08],
      back: [0.32, 0.48, 0.4],
      belly: [0.62, 0.72, 0.58],
      fin: [0.28, 0.42, 0.36],
      pec: 0.7,
      tail: 0.85,
      wave: 0.2,
    },
  },
  yellowfin: {
    id: "yellowfin",
    label: "yellowfin",
    guild: "pelagic-predator",
    agent: "school",
    social: "polarized",
    share: 0.48,
    prey: ["school"],
    temp: { min: 16, max: 31 },
    fish: {
      diet: "bite",
      restSpacing: 2.8,
      sepRadius: 3.8,
      schoolHeight: 8.2,
      schoolRadius: 46,
      length: 1.55,
      nightDepth: -12,
      dawnDepth: -40,
      dayDepth: -90,
      duskDepth: -32,
      maxDepth: -500,
      minSpeed: 6.4,
      maxSpeed: 18,
      fleeSpeed: 24,
      minSchoolSize: 12,
      metabolism: schoolMet(0.018),
      o2Min: 2,
      biteRadius: 1.5,
      eatEnergy: 0.08,
      fearRadius: 14,
      groups: 2,
    },
    look: {
      shape: "tuna",
      swim: "thunniform",
      body: [0.5, 1.32, 1.08],
      back: [0.22, 0.3, 0.38],
      belly: [0.78, 0.72, 0.28],
      fin: [0.82, 0.68, 0.18],
      pec: 0.78,
      tail: 1.28,
      wave: 0.11,
    },
  },
  bluefin: {
    id: "bluefin",
    label: "bluefin",
    guild: "pelagic-predator",
    agent: "vehicle",
    temp: { min: 6, max: 24 },
    prey: ["herring", "mackerel", "sardine", "saury", "anchovy", "pilchard", "jackmackerel", "menhaden"],
    vehicle: {
      count: 3,
      max: 6,
      pods: 1,
      spacing: 18,
      length: 2.4,
      cruiseSpeed: 11.8,
      boostSpeed: 19,
      lungeSpeed: 23,
      maxForce: 11,
      minDepth: -2.2,
      maxDepth: -1000,
      o2Min: 2.2,
      fearRadius: 36,
      lungeFearRadius: 42,
      biteRadius: 1.8,
      lungeBiteRadius: 3.2,
      mouthOffset: 1.05,
      energyDrain: drainForDays(2),
      eatEnergy: 0.1,
      starveDays: 3.5,
      gait: "ram",
      minSpeed: 5.8,
      mesh: "tuna",
      swim: "thunniform",
      diet: "bite",
      tints: [
        { scale: 1.1, aggression: 1.05, tint: { r: 0.22, g: 0.32, b: 0.48 } },
        { scale: 0.95, aggression: 1.1, tint: { r: 0.28, g: 0.38, b: 0.52 } },
      ],
    },
  },
  sailfish: {
    id: "sailfish",
    label: "sailfish",
    guild: "pelagic-predator",
    agent: "school",
    social: "loose",
    share: 0.16,
    prey: ["school"],
    temp: { min: 16, max: 31 },
    fish: {
      diet: "bite",
      length: 2.7,
      nightDepth: -6,
      dawnDepth: -18,
      dayDepth: -42,
      duskDepth: -16,
      maxDepth: -200,
      o2Min: 2.2,
      minSpeed: 7.0,
      maxSpeed: 22,
      fleeSpeed: 28,
      minSchoolSize: 4,
      metabolism: schoolMet(0.02),
      biteRadius: 1.4,
      eatEnergy: 0.08,
      fearRadius: 16,
      groups: 2,
      restSpacing: 8.4,
      cruiseWeight: 0.9,
      noiseWeight: 0.55,
    },
    look: {
      shape: "billfish",
      swim: "thunniform",
      body: [0.32, 1.55, 1.12],
      back: [0.18, 0.38, 0.62],
      belly: [0.55, 0.72, 0.82],
      fin: [0.22, 0.48, 0.72],
      pec: 0.85,
      tail: 1.18,
      wave: 0.1,
    },
  },
  benthos: {
    id: "benthos",
    label: "benthos",
    guild: "benthos",
    agent: "field",
  },
};

export const SCHOOL_IDS = Object.keys(SPECIES).filter((id) => SPECIES[id].agent === "school");
export const VEHICLE_IDS = Object.keys(SPECIES).filter((id) => SPECIES[id].agent === "vehicle");
export const FIELD_IDS = Object.keys(SPECIES).filter((id) => SPECIES[id].agent === "field");
export const FORAGE_IDS = Object.keys(SPECIES).filter((id) => SPECIES[id].guild === "forage");
export const PRESENCE_IDS = Object.keys(SPECIES);

function swimFromLook(look = {}) {
  if (look.swim) return look.swim;
  if (look.shape === "squid") return "jet";
  if (look.shape === "krill") return "paddle";
  if (look.shape === "flying") return "fly";
  if (look.shape === "needle") return "eel";
  return "tail";
}

export function knobsFor(id) {
  const spec = SPECIES[id];
  const social = spec?.social || "polarized";
  const mode = SOCIAL[social] || SOCIAL.polarized;
  return {
    ...FISH_DEFAULTS,
    ...mode,
    swim: swimFromLook(spec?.look),
    ...(spec?.fish || {}),
  };
}

export function vehicleCfg(id) {
  const spec = SPECIES[id];
  return { ...VEHICLE_DEFAULTS, ...(spec?.vehicle || {}) };
}

export function vehicleCountFor(id, weight = 1) {
  const cfg = vehicleCfg(id);
  if (weight <= 0.05) return 0;
  const n = Math.round((cfg.count || 1) * weight);
  return Math.max(1, Math.min(cfg.max ?? n, n));
}

/** Whether this vehicle cfg travels as one or more social units. */
export function vehicleIsPod(cfg) {
  return (cfg?.pods | 0) > 0 || (cfg?.podSize | 0) > 0;
}

/**
 * How many social units to split `n` animals into. `podSize` wins when set
 * (dolphins: ~10 per pod → 1–3 pods as count scales). `pods` is a fixed
 * unit count (orca: one matriline). 0 means independent roam.
 */
export function vehiclePodsFor(cfg, n) {
  n = Math.max(0, n | 0);
  if (n === 0) return 0;
  const size = cfg?.podSize | 0;
  if (size > 0) return Math.max(1, Math.min(n, Math.round(n / size) || 1));
  const want = cfg?.pods | 0;
  if (want <= 0) return 0;
  return Math.max(1, Math.min(want, n));
}

export function vehiclePodId(i, n, nPods) {
  if (nPods <= 1) return 0;
  const size = Math.ceil(n / nPods);
  return Math.min(nPods - 1, Math.floor(i / size));
}

export function vehiclePodSlot(i, n, nPods) {
  if (nPods <= 1) return i;
  const size = Math.ceil(n / nPods);
  return i - vehiclePodId(i, n, nPods) * size;
}

export function speciesLabel(id) {
  return SPECIES[id]?.label || id;
}

export function preyOf(id) {
  return SPECIES[id]?.prey || null;
}

export function lookFor(id) {
  return SPECIES[id]?.look || LOOK_HERRING;
}

export function emptyPresence() {
  const p = {};
  for (const id of PRESENCE_IDS) p[id] = 0;
  return p;
}

export function fullPresence(weight = 1) {
  const p = emptyPresence();
  for (const id of PRESENCE_IDS) p[id] = weight;
  return p;
}

export function schoolTaxaFromPresence(presence) {
  const taxa = [];
  if (!presence) return taxa;
  for (const id of SCHOOL_IDS) {
    const w = presence[id] ?? 0;
    if (w <= 0.05) continue;
    taxa.push({
      id,
      cfg: knobsFor(id),
      look: lookFor(id),
      share: (SPECIES[id].share ?? 1) * w,
    });
  }
  return taxa;
}


export function dominantSchoolId(presence) {
  const taxa = schoolTaxaFromPresence(presence);
  const forage = taxa.filter((t) => schoolDiet(t.cfg) !== "bite");
  const pool = forage.length ? forage : taxa;
  let best = null;
  let s = 0;
  for (const t of pool) {
    if (t.share > s) {
      s = t.share;
      best = t.id;
    }
  }
  return best;
}

export function forageIdFromPresence(presence) {
  return dominantSchoolId(presence);
}

/** Forage guilds school piscivores may bite when huntTaxa is empty. */
export function isForagePrey(id) {
  const g = SPECIES[id]?.guild;
  return g === "forage" || g === "surface" || g === "cephalopod";
}

export function schoolDiet(cfg = {}) {
  if (cfg.diet) return cfg.diet;
  if (cfg.grazeOn === "p") return "p";
  if (cfg.huntTaxa?.length || cfg.benthosGraze > 0) return "bite";
  return "z";
}

export function isSchoolBiter(cfg = {}) {
  const d = schoolDiet(cfg);
  return d === "bite" || d === "both";
}

export function isSchoolGrazer(cfg = {}) {
  const d = schoolDiet(cfg);
  return d === "z" || d === "p" || d === "both";
}

export function schoolHunts(eaterCfg, eaterId, preyId) {
  if (!preyId || eaterId === preyId) return false;
  if (!isSchoolBiter(eaterCfg)) return false;
  const want = eaterCfg.huntTaxa;
  if (want?.length) return want.includes(preyId);
  const prey = SPECIES[eaterId]?.prey;
  if (prey?.length && !prey.includes("school")) return prey.includes(preyId);
  return isForagePrey(preyId);
}

/** Live forage individuals per hashed-grid piscivore. */
export const PISCIVORE_PREY_RATIO = 22;

export function piscivoreCapacity(preyN, biterTaxa = [], ratio = PISCIVORE_PREY_RATIO) {
  if (!biterTaxa.length) return 0;
  const n = Math.max(0, preyN | 0);
  const r = Math.max(8, ratio | 0);
  return Math.max(0, Math.min(Math.floor(n / r), 2400));
}

export function grazerTaxaOf(taxa) {
  return taxa.filter((t) => isSchoolGrazer(t.cfg || knobsFor(t.id)));
}

export function biterOnlyTaxaOf(taxa) {
  return taxa.filter((t) => {
    const cfg = t.cfg || knobsFor(t.id);
    return isSchoolBiter(cfg) && !isSchoolGrazer(cfg);
  });
}

/** Split a shared agent cap across every school species in the cell. */
export function allocateSchoolCounts(cap, taxa, minPer = 0) {
  const n = Math.max(0, cap | 0);
  const out = taxa.map((t) => ({ id: t.id, n: 0 }));
  if (!taxa.length || n <= 0) return out;
  let sum = 0;
  for (const t of taxa) sum += t.share;
  if (sum <= 0) {
    out[0].n = n;
    return out;
  }
  let used = 0;
  const denom = Math.max(1, sum);
  for (let i = 0; i < taxa.length; i++) {
    const take = Math.round((n * taxa[i].share) / denom);
    out[i].n = Math.max(0, take);
    used += out[i].n;
  }
  const floor = Math.max(
    n >= taxa.length ? 1 : 0,
    minPer > 0 ? Math.min(minPer, Math.floor(n / taxa.length)) : 0
  );
  if (floor > 0) {
    for (let i = 0; i < out.length; i++) {
      if (out[i].n < floor) {
        used += floor - out[i].n;
        out[i].n = floor;
      }
    }
  }
  const biggest = () => {
    let b = 0;
    for (let i = 1; i < out.length; i++) if (out[i].n > out[b].n) b = i;
    return b;
  };
  while (used > n) {
    const b = biggest();
    if (out[b].n <= floor && used - 1 < taxa.length * Math.max(1, floor)) break;
    out[b].n -= 1;
    used -= 1;
  }
  if (used < n) {
    out[biggest()].n += n - used;
  }
  return out;
}

/**
 * Grazers take the bloom cap. Bite-only taxa take a prey-limited slice of
 * the same hashed grid so skipjack never eat herring's NPZD budget.
 */
export function allocateMixedSchoolCounts(totalCap, taxa, bloomCap, minPer = 0, ratio = PISCIVORE_PREY_RATIO) {
  const n = Math.max(0, totalCap | 0);
  const bloom = Math.max(0, bloomCap | 0);
  const out = taxa.map((t) => ({ id: t.id, n: 0 }));
  if (!taxa.length || n <= 0) return out;
  const grazers = grazerTaxaOf(taxa);
  const biters = biterOnlyTaxaOf(taxa);
  const index = new Map(out.map((row, i) => [row.id, i]));
  const write = (alloc) => {
    for (const row of alloc) {
      const i = index.get(row.id);
      if (i != null) out[i].n = row.n;
    }
  };
  if (!biters.length) {
    write(allocateSchoolCounts(Math.min(n, bloom || n), grazers.length ? grazers : taxa, minPer));
    return out;
  }
  const preyGuess = Math.min(n, bloom || n);
  const bWant = piscivoreCapacity(preyGuess, biters, ratio);
  const gCap = Math.min(bloom || n, Math.max(0, n - bWant));
  write(allocateSchoolCounts(gCap, grazers, minPer));
  let preyN = 0;
  for (let i = 0; i < taxa.length; i++) {
    const cfg = taxa[i].cfg || knobsFor(taxa[i].id);
    if (isSchoolGrazer(cfg)) preyN += out[i].n;
  }
  const bCap = Math.min(n - gCap, piscivoreCapacity(preyN, biters, ratio));
  write(allocateSchoolCounts(bCap, biters, 0));
  return out;
}
