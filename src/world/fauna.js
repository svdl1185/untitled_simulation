/**
 * Living catalog of implemented animals.
 *
 * Presence is independent: if a range covers the cell, the species is in
 * the cell. Overlap is honest. A later tile with fifty forage fishes,
 * six sharks, squid, and kelp should still be a catalog lookup plus a
 * shared agent budget — never N copies of the 20k herring loop.
 *
 * `agent: "school"`  — pelagic individuals in the hashed-grid school.
 * `agent: "vehicle"` — few Reynolds vehicles (sharks, tuna, cod).
 * Later: `"density"` for super-individuals, `"field"` for coral/kelp.
 */

export const FISH_DEFAULTS = {
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
  grazeMul: 1,
  anchorTop: -3.2,
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
    guild: "forage",
    agent: "school",
    share: 1,
    fish: {},
    look: LOOK_HERRING,
  },
  capelin: {
    id: "capelin",
    guild: "forage",
    agent: "school",
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
      maxDepth: -110,
      minSpeed: 2.4,
      maxSpeed: 9.4,
      fleeSpeed: 18,
      minSchoolSize: 160,
      metabolism: 0.014,
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
    guild: "forage",
    agent: "school",
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
      metabolism: 0.01,
      grazeMul: 1.35,
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
    guild: "forage",
    agent: "school",
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
      maxDepth: -100,
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
    guild: "forage",
    agent: "school",
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
      maxDepth: -120,
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
    guild: "forage",
    agent: "school",
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
      maxDepth: -72,
      minSpeed: 2.6,
      maxSpeed: 11.2,
      fleeSpeed: 20,
      minSchoolSize: 200,
      metabolism: 0.015,
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
    guild: "forage",
    agent: "school",
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
      maxDepth: -90,
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
    guild: "forage",
    agent: "school",
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
      maxDepth: -140,
      minSpeed: 3.8,
      maxSpeed: 14.2,
      fleeSpeed: 26,
      minSchoolSize: 80,
      metabolism: 0.013,
      grazeMul: 0.85,
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
    guild: "surface",
    agent: "school",
    share: 0.16,
    fish: {
      restSpacing: 1.35,
      sepRadius: 2.05,
      yMul: 0.82,
      aliRadius: 6.2,
      cohRadius: 7.6,
      schoolHeight: 2.4,
      schoolRadius: 22,
      length: 0.48,
      nightDepth: -2.4,
      dawnDepth: -6,
      dayDepth: -10,
      duskDepth: -5,
      maxDepth: -16,
      surfaceClearance: 0.7,
      floorClearance: 1.6,
      minSpeed: 4.2,
      maxSpeed: 14.5,
      fleeSpeed: 26,
      minSchoolSize: 60,
      metabolism: 0.016,
      grazeMul: 0.55,
      anchorTop: -1.05,
      lead: 16,
      splitDistance: 48,
      mergeDistance: 16,
    },
    look: {
      body: [0.38, 0.92, 1.18],
      back: [0.1, 0.2, 0.38],
      belly: [0.78, 0.84, 0.92],
      fin: [0.16, 0.28, 0.42],
      pec: 3.4,
      tail: 0.88,
      wave: 0.22,
    },
  },
  shark: {
    id: "shark",
    guild: "pelagic-predator",
    agent: "vehicle",
    prey: ["school"],
  },
  tuna: {
    id: "tuna",
    guild: "pelagic-predator",
    agent: "vehicle",
    prey: ["school"],
  },
  cod: {
    id: "cod",
    guild: "demersal",
    agent: "vehicle",
    prey: ["herring", "capelin"],
  },
};

export const SCHOOL_IDS = Object.keys(SPECIES).filter((id) => SPECIES[id].agent === "school");
export const VEHICLE_IDS = Object.keys(SPECIES).filter((id) => SPECIES[id].agent === "vehicle");
export const FORAGE_IDS = Object.keys(SPECIES).filter((id) => SPECIES[id].guild === "forage");
export const PRESENCE_IDS = Object.keys(SPECIES);

export function knobsFor(id) {
  const spec = SPECIES[id];
  if (!spec?.fish) return { ...FISH_DEFAULTS };
  return { ...FISH_DEFAULTS, ...spec.fish };
}

export function lookFor(id) {
  return SPECIES[id]?.look || LOOK_HERRING;
}

export function emptyPresence() {
  const p = {};
  for (const id of PRESENCE_IDS) p[id] = 0;
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
  let best = null;
  let s = 0;
  for (const t of taxa) {
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

/** Split a shared agent cap across every school species in the cell. */
export function allocateSchoolCounts(cap, taxa) {
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
  if (used > n) {
    out[out.length - 1].n = Math.max(0, out[out.length - 1].n - (used - n));
  }
  return out;
}
