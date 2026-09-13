import {
  FISH_DEFAULTS,
  dominantSchoolId,
  emptyPresence,
  knobsFor,
  schoolTaxaFromPresence,
  vehicleCfg,
} from "./world/fauna.js";

export const CONFIG = {
  location: "north-sea-shelf",

  maxFish: 20000,
  initialFish: 12000,
  schoolCount: 2,
  maxSchools: 32,
  schoolMinPer: 0,
  forageId: "herring",

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
    lab: false,
  },

  presence: { ...emptyPresence(), herring: 1, shark: 1, cod: 1 },

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

  fish: { ...FISH_DEFAULTS },

  shark: vehicleCfg("shark"),
  tuna: vehicleCfg("tuna"),
  cod: vehicleCfg("cod"),

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

  /** Headcount / energy / meal recorder for the headless viability suite. */
  viability: {
    sampleDt: 2,
    maxSamples: 1800,
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

export function activeForageId() {
  return dominantSchoolId(CONFIG.presence);
}

export function cellSchoolTaxa() {
  return schoolTaxaFromPresence(CONFIG.presence);
}

export function anySchoolPresent() {
  return cellSchoolTaxa().length > 0;
}

export function bindCellFauna() {
  const id = dominantSchoolId(CONFIG.presence);
  Object.assign(CONFIG.fish, knobsFor(id || "herring"));
  CONFIG.forageId = id || null;
  return CONFIG.forageId;
}

export function bindForageSpecies(id) {
  return bindCellFauna();
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
 * biological maximum (more negative). The seafloor always wins on a
 * shallow shelf. Lighting is not a depth cap.
 */
export function clampHabitatY(y, maxDepth) {
  const floor = CONFIG.floorY + (CONFIG.fish.floorClearance ?? 2.2) + 4;
  const ceil = -(CONFIG.fish.surfaceClearance ?? 1.35) - 0.4;
  const deep = Math.max(floor, maxDepth ?? CONFIG.fish.maxDepth ?? -180);
  if (y < deep) return deep;
  if (y > ceil) return ceil;
  return y;
}

export function dvmY(hour, depths = CONFIG.fish) {
  const f = depths;
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

export function herringDvmY(hour) {
  return dvmY(hour, CONFIG.fish);
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

export function gridMinY(taxa = null) {
  const list = taxa && taxa.length ? taxa : cellSchoolTaxa();
  let deep = CONFIG.fish.maxDepth ?? -180;
  let day = CONFIG.fish.dayDepth ?? -95;
  for (const t of list) {
    const c = t.cfg || knobsFor(t.id);
    if ((c.maxDepth ?? 0) < deep) deep = c.maxDepth;
    if ((c.dayDepth ?? 0) < day) day = c.dayDepth;
  }
  const pelagic = Math.min(deep, day) - 50;
  return Math.max(CONFIG.floorY, pelagic);
}
