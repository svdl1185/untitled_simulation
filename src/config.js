export const CONFIG = {
  location: "north-sea-shelf",

  maxFish: 20000,
  initialFish: 12000,
  schoolCount: 2,
  maxSchools: 16,

  surfaceY: 0,
  floorY: -110,
  shelfY: -36,
  thermoY: -30,
  halfX: 240,
  halfZ: 280,

  world: {
    lat: 56.0,
    lon: 3.2,
    synthetic: true,
    statics: true,
  },

  presence: {
    herring: 1,
    shark: 1,
  },

  beach: {
    enabled: true,
    startZ: 36,
    shoreZ: 188,
    endZ: 258,
    shoreY: 0.18,
    duneY: 6.4,
  },

  cellSize: 3.8,

  time: {
    // Real seconds per 24 h. Long enough that a ~90 m DVM dive is
    // a fraction of daylight, not the whole morning.
    dayLength: 480,
    daysPerYear: 12,
  },

  /**
   * Optical water, not bathymetry. `photicY` is the 1% light depth at
   * turbidity 1 (coastal). Clearer cells push that envelope deeper.
   * Fog and sunlight use this, never the abyssal floor.
   */
  water: {
    photicY: -180,
    turbidity: 1,
  },

  fish: {
    restSpacing: 1.48,
    sepRadius: 2.25,
    yMul: 1.08,
    aliRadius: 6.8,
    cohRadius: 8.4,
    sepWeight: 2.15,
    aliWeight: 1.7,
    cohWeight: 0.5,
    holdWeight: 3.4,
    fearWeight: 5.2,
    boundsWeight: 1.6,
    cruiseWeight: 0.68,
    depthWeight: 0.55,
    forageWeight: 3.6,
    forageGain: 0.16,
    metabolism: 0.012,
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
    maxDepth: -180,
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
    schoolHeight: 6.4,
    splitDistance: 78,
    mergeDistance: 24,
    minSchoolFrac: 0.04,
    minSchoolSize: 280,
    joinSlack: 1.55,
  },

  shark: {
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
    maxDepth: -220,
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
    energyDrain: 0.002,
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
  },

  flow: {
    tide: 1.85,
    tidePeriod: 48,
    longshore: 1.2,
    longshorePeriod: 74,
    shear: 0.9,
    stormMul: 1.65,
    meanU: 0,
    meanV: 0,
  },

  plankton: {
    nx: 128,
    nz: 128,
    graze: 0.00018,
    halfSat: 0.2,
    growP: 0.046,
    kN: 0.16,
    grazeZ: 0.052,
    kP: 0.26,
    effZ: 0.42,
    mortP: 0.007,
    mortZ: 0.01,
    remin: 0.018,
    mix: 0.07,
    upwell: 0.022,
    baseN: 0.004,
    carcass: 0.1,
    spawnCost: 0.018,
    excrete: 0.36,
    detritus: 0.24,
  },
};

export function yearSeconds() {
  return CONFIG.time.dayLength * CONFIG.time.daysPerYear;
}

export function hasBeach() {
  return CONFIG.beach.enabled !== false;
}

export function waterMaxZ() {
  return hasBeach() ? CONFIG.beach.shoreZ : CONFIG.halfZ;
}

export function worldMaxZ() {
  return hasBeach() ? CONFIG.beach.endZ : CONFIG.halfZ;
}

export function faunaPresent(id) {
  return (CONFIG.presence?.[id] ?? 0) > 0.05;
}

/** Pelagic habitat for this floor — never a fraction of the abyss. */
export function bindColumnHabitat(floorY, hasLand) {
  const floor = floorY + 8;
  CONFIG.thermoY = Math.max(floor, Math.min(-18, -32));
  CONFIG.fish.preferredDepth = clampHabitatY(-38, CONFIG.fish.maxDepth);
  if (hasLand || -floorY < 140) CONFIG.water.turbidity = 1;
  else CONFIG.water.turbidity = Math.min(0.85, Math.max(0.34, 140 / Math.max(140, -floorY)));
}

/** 1% light depth for this cell. Shelf floors clip it. */
export function photicLimitY() {
  const turb = Math.max(0.35, CONFIG.water?.turbidity ?? 1);
  const open = (CONFIG.water?.photicY ?? -180) / turb;
  return Math.max(CONFIG.floorY, open);
}

/**
 * Keep an animal in its guild's vertical niche. `maxDepth` is the
 * deepest it will go (more negative). The seafloor always wins on a
 * shallow shelf.
 */
export function clampHabitatY(y, maxDepth) {
  const floor = CONFIG.floorY + (CONFIG.fish.floorClearance ?? 2.2) + 4;
  const ceil = -(CONFIG.fish.surfaceClearance ?? 1.35) - 0.4;
  const deep = Math.max(floor, maxDepth ?? CONFIG.fish.maxDepth ?? -180);
  if (y < deep) return deep;
  if (y > ceil) return ceil;
  return y;
}

export function herringDvmY(hour) {
  const f = CONFIG.fish;
  const keys = [
    [0, f.nightDepth],
    [4.8, f.nightDepth],
    [6.4, f.dawnDepth],
    [8.2, f.dayDepth],
    [17.6, f.dayDepth],
    [19.4, f.duskDepth],
    [21.4, f.nightDepth],
    [24, f.nightDepth],
  ];
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1][0] < hour) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const span = b[0] - a[0] || 1;
  const t = Math.min(1, Math.max(0, (hour - a[0]) / span));
  const s = t * t * (3 - 2 * t);
  return clampHabitatY(a[1] + (b[1] - a[1]) * s, f.maxDepth);
}

const ZONE_CATALOG = [
  { id: "surface", label: "Surface", y: -2.5, minColumn: 6 },
  { id: "epipelagic", label: "Epipelagic", y: -40, minColumn: 18 },
  { id: "mesopelagic", label: "Mesopelagic", y: -600, minColumn: 250 },
  { id: "bathypelagic", label: "Bathypelagic", y: -2000, minColumn: 1100 },
  { id: "abyssal", label: "Abyssal", y: -4500, minColumn: 3200 },
  { id: "benthos", label: "Seafloor", y: null, minColumn: 14 },
];

/** Zones that actually exist in this cell's water column. */
export function columnZones(preferredY) {
  const floor = CONFIG.floorY;
  const column = Math.max(6, -floor);
  const epi = clampHabitatY(preferredY ?? CONFIG.fish.preferredDepth, CONFIG.fish.maxDepth);
  return ZONE_CATALOG.filter((z) => column >= z.minColumn).map((z) => {
    let y = z.id === "benthos" ? floor + 8 : z.id === "epipelagic" ? epi : z.y;
    y = Math.min(-2.2, Math.max(floor + 6, y));
    return { id: z.id, label: z.label, y };
  });
}

export function zoneAt(y) {
  const zones = columnZones(y);
  if (!zones.length) return { id: "water", label: "Water", y };
  let best = zones[0];
  let d = Math.abs(y - best.y);
  for (let i = 1; i < zones.length; i++) {
    const n = Math.abs(y - zones[i].y);
    if (n < d) {
      best = zones[i];
      d = n;
    }
  }
  return best;
}

export function gridMinY() {
  const pelagic = Math.min(CONFIG.fish.maxDepth ?? -180, CONFIG.fish.dayDepth ?? -95) - 50;
  return Math.max(CONFIG.floorY, pelagic);
}
