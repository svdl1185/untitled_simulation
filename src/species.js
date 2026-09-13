import { CONFIG, faunaPresent } from "./config.js";
import { getActivePatch } from "./world/patch.js";

/**
 * Field notes for every implemented animal. Presence, not this list,
 * decides who occupies a cell. A later tile can list a hundred entries;
 * getLocation still filters to faunaPresent.
 */
export const FAUNA = {
  herring: {
    id: "herring",
    common: "Atlantic herring",
    latin: "Clupea harengus",
    guild: "Pelagic forage fish",
    diet: "Zooplankton",
    sex: "Female / male. Females are drawn slightly larger.",
    program:
      "Reynolds shoal on a hashed 3D grid shared with every other school species in the cell: nearest-neighbour spacing, same-shoal alignment, a thin pancake envelope. Diel vertical migration stays epipelagic (night near −20 m, day toward −110 m, max about −180 m). Hungry shoals may rise toward zooplankton; satiated shoals sit in the day refuge. Type II graze on z; the cell's bloom mean caps the shared forage headcount; starvation and kills recycle biomass.",
    about:
      "North Atlantic forage fish. Shares a cell with mackerel, capelin, sharks, or cod wherever those ranges overlap. Recruits only when shoal energy is high and the NPZD field can feed the mixed budget.",
  },
  capelin: {
    id: "capelin",
    common: "Capelin",
    latin: "Mallotus villosus",
    guild: "Pelagic forage fish",
    diet: "Zooplankton",
    sex: "Female / male. Females are drawn slightly larger.",
    program:
      "Same hashed-grid shoal as other forage, species-pure schools. Shallower DVM than herring (night near −8 m, day near −52 m). Type II graze on z; competes with herring for the shared bloom cap where ranges overlap (Iceland, Barents, Labrador).",
    about:
      "Arctic and subarctic smelt. Surface-leaning relative to herring. Present in the North Pacific (Bering) as well as the North Atlantic.",
  },
  menhaden: {
    id: "menhaden",
    common: "Atlantic menhaden",
    latin: "Brevoortia tyrannus",
    guild: "Pelagic forage fish",
    diet: "Phytoplankton and zooplankton",
    sex: "Female / male. Females are drawn slightly larger.",
    program:
      "Filter-style Type II graze with a higher graze multiplier on z (p is not a separate bite yet). Coastal, shallow DVM (night near −6 m, day near −32 m, max about −48 m). Larger, slower body than herring. Shares the US east / Gulf shelf with anchovy, sardinella, and menhaden's own predators.",
    about:
      "Western Atlantic filter feeder. Estuarine and inner-shelf; does not commute into the abyss.",
  },
  sardine: {
    id: "sardine",
    common: "Pacific sardine",
    latin: "Sardinops sagax",
    guild: "Pelagic forage fish",
    diet: "Zooplankton",
    sex: "Female / male. Females are drawn slightly larger.",
    program:
      "Tight, fast clupeid shoal. DVM night near −12 m, day near −58 m. Type II graze on z. Co-occurs with anchovy and mackerel in eastern-boundary currents (California, Humboldt, Kuroshio, Benguela).",
    about:
      "Pacific and southern-hemisphere sardine. Empty in the North Sea is a range gate.",
  },
  pilchard: {
    id: "pilchard",
    common: "European pilchard",
    latin: "Sardina pilchardus",
    guild: "Pelagic forage fish",
    diet: "Zooplankton",
    sex: "Female / male. Females are drawn slightly larger.",
    program:
      "Clupeid shoal, DVM a little deeper than Pacific sardine (day near −68 m). Type II graze on z. Overlaps herring at the Celtic / Biscay edge and anchovy in the Mediterranean.",
    about:
      "Northeast Atlantic, Mediterranean, and northwest African upwelling.",
  },
  anchovy: {
    id: "anchovy",
    common: "Anchovy",
    latin: "Engraulis",
    guild: "Pelagic forage fish",
    diet: "Zooplankton",
    sex: "Female / male. Females are drawn slightly larger.",
    program:
      "Small, slender engraulid shoal. Shallow DVM (night −8 m, day −38 m). Type II graze on z. Latin name follows the cell: ringens (Humboldt), mordax (California), japonicus (Kuroshio), encrasicolus (Europe).",
    about:
      "Coastal upwelling forage. Competes with sardine where both ranges cover the same kilometre.",
  },
  sardinella: {
    id: "sardinella",
    common: "Round sardinella",
    latin: "Sardinella aurita",
    guild: "Pelagic forage fish",
    diet: "Zooplankton",
    sex: "Female / male. Females are drawn slightly larger.",
    program:
      "Tropical clupeid shoal. DVM night −10 m, day −48 m. Type II graze on z. Often shares a cell with flying fish and skipjack.",
    about:
      "Tropical Atlantic, Caribbean, Gulf of Guinea, and Indian Ocean. The forage that occupies warm water herring never reach.",
  },
  mackerel: {
    id: "mackerel",
    common: "Mackerel",
    latin: "Scomber scombrus",
    guild: "Pelagic forage fish",
    diet: "Zooplankton; small fish not yet a separate bite",
    sex: "Female / male. Females are drawn slightly larger.",
    program:
      "Faster, looser shoal than herring, DVM night −12 m, day −48 m, max −140 m. Still a Type II grazer of z in this build — piscivory on herring agents is not wired, so mackerel compete for the bloom rather than farming the herring school. Smaller share of the shared headcount.",
    about:
      "Atlantic mackerel in the North Atlantic and Mediterranean; chub mackerel (Scomber japonicus) in the Pacific cells of the same id. Co-occurs with herring in the North Sea.",
  },
  flyingfish: {
    id: "flyingfish",
    common: "Flying fish",
    latin: "Exocoetidae",
    guild: "Surface forage fish",
    diet: "Zooplankton",
    sex: "Female / male. Females are drawn slightly larger.",
    program:
      "Same hashed grid as other school fish, but the DVM never leaves the top ~16 m (night −2 m, day −10 m). Type II graze on z; overlap with the zooplankton layer is high at night when z rises, poor by day — energy drains until dusk. Large pectorals are the mesh, not a flight integrator. Small share of the shared forage budget.",
    about:
      "Tropical and subtropical surface. Co-occurs with sardinella, sardine, anchovy, and tuna. Missing surface hunters (booby, mahi) are why they still sit so shallow.",
  },
  shark: {
    id: "shark",
    common: "Pelagic shark",
    latin: "Prionace glauca",
    guild: "Pelagic predator",
    diet: "Forage fish",
    sex: "Female / male. Females are larger and initiate courtship.",
    program:
      "Burst-and-glide vehicle. Hunger runs patrol → stalk → strike-from-below → recover. Bites any school fish in mouth radius (herring, sardine, flying fish, …). Satiated animals roam. Pack members keep spacing and prefer different shoals. A year-timer plus high energy lets a female pup; the pup costs maternal energy. Starvation recycles the carcass. Stays in the forage depth band, not the abyss.",
    about:
      "Blue-shark / lamnid guild until named species split. Present wherever school prey exists and latitude is below about 55°. Can share a cell with tuna and with cod.",
  },
  tuna: {
    id: "tuna",
    common: "Skipjack tuna",
    latin: "Katsuwonus pelamis",
    guild: "Pelagic predator",
    diet: "Forage fish",
    sex: "Female / male.",
    program:
      "Ram gait — continuous thrust, not burst-and-glide. Hunts the same school fish as sharks, in the photic band (max about −120 m). Bite restores energy; starvation recycles. Reproduction is an energy-threshold recruit (skipjack are broadcast spawners; the year-timer stands in for a batch). Absent where no school prey exists, and poleward of about 38°.",
    about:
      "Tropical and subtropical ram hunter. Co-occurs with sharks in warm temperate water. Does not replace them.",
  },
  cod: {
    id: "cod",
    common: "Atlantic cod",
    latin: "Gadus morhua",
    guild: "Demersal predator",
    diet: "Herring and capelin",
    sex: "Female / male. Females are larger.",
    program:
      "Slow benthic vehicle. Prefers seafloor + a few metres, max about −200 m. Small fear radius, so pelagic herring only feel it when the day refuge sits near the shelf. Bites school fish that enter mouth range. Energy drain is low; starve days are long. Recruits on an energy threshold. Dropped on abyssal floors (deeper than ~280 m) even if the lat-lon hull matches — this is a shelf fish.",
    about:
      "North Atlantic demersal. Shares the North Sea cell with herring, mackerel, and pelagic sharks because the jobs partition: column vs floor.",
  },
};

export const LOCATIONS = {
  "north-sea-shelf": {
    id: "north-sea-shelf",
    name: "Coastal shelf",
    region: "North Sea–style inner shelf",
    about:
      "A few hundred metres of shelf: a sandy beach on the inner edge, inner shelf near −36 m, floor dropping to −110 m offshore. Tide, longshore current, and an NPZD bloom set how many animals this cell can carry. Herring and mackerel both graze z here; sharks hunt the column; cod wait on the sand.",
    fauna: Object.values(FAUNA),
  },
  "world-cell": {
    id: "world-cell",
    name: "Ocean cell",
    region: "1 km nested patch",
    about:
      "A one-kilometre cell of the world ocean. Bathymetry and a mean current come from public grids; every catalogued animal whose range covers the cell is present. Overlap is habitat. Empty of herring here is a range gate, not a missing mesh.",
    fauna: Object.values(FAUNA),
  },
};

export function getLocation(id = CONFIG.location) {
  const loc = LOCATIONS[id] || LOCATIONS["north-sea-shelf"];
  const patch = getActivePatch();
  const fauna = (loc.fauna || []).filter((sp) => faunaPresent(sp.id)).map(localizeFauna);
  if (!patch) return { ...loc, fauna };
  return {
    ...loc,
    name: patch.name || loc.name,
    region: patch.region || loc.region,
    about: patch.synthetic
      ? loc.about
      : `1 km cell at ${patch.region}. Mean floor ${Math.abs(patch.floorY).toFixed(0)} m. ${
          fauna.length ? fauna.map((s) => s.common).join(", ") : "No implemented fauna in range."
        }${patch.note ? ` ${patch.note}` : ""}`,
    fauna,
  };
}

function localizeFauna(sp) {
  const lat = CONFIG.world.lat;
  const lon = CONFIG.world.lon;
  if (sp.id === "anchovy") {
    if (lon < -68 && lat < 8) return { ...sp, common: "Anchoveta", latin: "Engraulis ringens" };
    if (lon < -100) return { ...sp, common: "Northern anchovy", latin: "Engraulis mordax" };
    if (lon > 110) return { ...sp, common: "Japanese anchovy", latin: "Engraulis japonicus" };
    return { ...sp, common: "European anchovy", latin: "Engraulis encrasicolus" };
  }
  if (sp.id === "mackerel" && (lon < -100 || lon > 110 || (lon < -68 && lat < 5))) {
    return { ...sp, common: "Chub mackerel", latin: "Scomber japonicus" };
  }
  if (sp.id === "sardinella" && lon > 30) {
    return { ...sp, common: "Indian oil sardine", latin: "Sardinella longiceps" };
  }
  return sp;
}

function faunaOf(id) {
  const spec = FAUNA[id] || FAUNA.herring;
  return localizeFauna(spec);
}

export function sexLabel(sex) {
  if (sex === 0) return "Female";
  if (sex === 1) return "Male";
  return "Unsexed";
}

function depthText(y) {
  return `${Math.max(0, -Number(y)).toFixed(0)} m`;
}

function speedText(vx, vy, vz) {
  return `${Math.hypot(vx, vy, vz).toFixed(1)} m/s`;
}

function forageSize(scale) {
  if (scale < 0.88) return "Small";
  if (scale > 1.1) return "Large";
  return "Adult";
}

function predatorSize(s) {
  if (s.scale < 0.72) return "Juvenile";
  if (s.scale > 1.12) return "Large";
  if (s.scale < 0.88) return "Small";
  return "Adult";
}

function predatorState(s) {
  const cfg = s.cfg || CONFIG.shark;
  if (s.controlled) return "Pilot";
  if (s.energy < cfg.starveAt) return "Starving";
  if (s.sex === 0 && s.mateT <= 0 && s.energy >= cfg.mateEnergy) return "Courting";
  const modes = {
    patrol: "AI patrol",
    stalk: "AI stalk",
    strike: "AI strike",
    recover: "AI recover",
  };
  if (s.energy > cfg.satiated && s.aiMode === "patrol") return "Roaming";
  return modes[s.aiMode] || "AI";
}

function liveForage(school, i) {
  const spec = faunaOf(school.taxonId?.(i) || "herring");
  const sex = sexLabel(school.sex[i]).toLowerCase();
  const alarm = school.alarm[i];
  const energy = school.energy[i];
  const sid = school.schoolId[i];
  const mill = school.anchors[sid]?.mill ?? 0;
  const cfg = school.taxonCfg?.(i) || CONFIG.fish;
  if (alarm > 0.28) {
    return `This ${sex} ${spec.common.toLowerCase()} is in the flee mix. Alarm spreads as a neighbour turn-wave.`;
  }
  if (energy < cfg.starveAt * 2.5) {
    return `This ${sex} is energy-poor. Grazing is a Type II pull on zooplankton; below the starve floor the fish is removed and its mass returns to the NPZD field.`;
  }
  if (mill > 0.45) {
    return `This ${sex} is milling with its ${spec.common.toLowerCase()} shoal — a slow gyre while food is rich and predators are far.`;
  }
  return `This ${sex} is schooling with its own species: same-shoal alignment, nearest-neighbour spacing, and a pancake envelope.`;
}

function livePredator(s) {
  const spec = faunaOf(s.kind || "shark");
  const cfg = s.cfg || CONFIG.shark;
  const sex = sexLabel(s.sex).toLowerCase();
  if (s.controlled) return `This ${sex} is piloted. Energy still drains and eating still restores it.`;
  if (s.energy < cfg.starveAt) return `This ${sex} is starving. Without a kill it will die and recycle into the water column.`;
  if (s.sex === 0 && s.mateT <= 0 && s.energy >= cfg.mateEnergy) {
    return `This female is courting: the year-timer has elapsed and energy is high enough to seek a male.`;
  }
  if (s.aiMode === "stalk") return `This ${sex} is stalking, holding a flank on the hunted school.`;
  if (s.aiMode === "strike") return `This ${sex} is striking.`;
  if (s.aiMode === "recover") return `This ${sex} is recovering after a strike.`;
  if (s.energy > cfg.satiated) return `This ${sex} is roaming — satiated, so it is not farming the school.`;
  return `This ${sex} ${spec.common.toLowerCase()} is on patrol.`;
}

function liveSchool(school, id) {
  const t = school.anchors[id]?.taxon ?? 0;
  const spec = faunaOf(school.taxa[t]?.id || "herring");
  const mill = school.anchors[id]?.mill ?? 0;
  const hunger = school.schoolHunger[id] ?? 0.5;
  const fem = school.schoolFem[id] || 0;
  const mal = school.schoolMal[id] || 0;
  const mix = `${spec.common} shoal (${fem.toLocaleString()} female / ${mal.toLocaleString()} male).`;
  if (mill > 0.45) return `Milling. ${mix}`;
  if (hunger > 0.55) return `Foraging up the bloom gradient. ${mix}`;
  return `Polarized commute. ${mix}`;
}

function speciesNotes(spec, live) {
  return [
    { id: "behavior", label: "Now", text: live },
    { id: "program", label: "Program", text: spec.program },
    { id: "about", label: "Species", text: spec.about },
  ];
}

export function sharkCard(s, ctx) {
  const spec = faunaOf(s.kind || "shark");
  const cfg = s.cfg || CONFIG.shark;
  const sex = sexLabel(s.sex);
  return {
    kindLabel: spec.guild,
    title: spec.common,
    subtitle: `${spec.latin} · ${sex}`,
    following: ctx.following,
    stats: [
      { id: "sex", label: "Sex", value: sex },
      { id: "size", label: "Size", value: predatorSize(s) },
      { id: "length", label: "Length", value: `${(cfg.length * s.scale).toFixed(1)} m` },
      { id: "diet", label: "Diet", value: spec.diet },
      { id: "hunger", label: "Energy", value: `${Math.round(s.energy * 100)}%` },
      { id: "state", label: "State", value: predatorState(s) },
      { id: "depth", label: "Depth", value: depthText(s.y) },
      { id: "speed", label: "Speed", value: speedText(s.vx, s.vy, s.vz) },
    ],
    notes: speciesNotes(spec, livePredator(s)),
  };
}

export function herringCard(school, i, ctx) {
  return forageCard(school, i, ctx);
}

export function forageCard(school, i, ctx) {
  const spec = faunaOf(school.taxonId?.(i) || "herring");
  const sex = sexLabel(school.sex[i]);
  const i3 = i * 3;
  const sid = school.schoolId[i];
  return {
    kindLabel: spec.guild,
    title: spec.common,
    subtitle: `${spec.latin} · ${sex}`,
    following: ctx.following,
    stats: [
      { id: "sex", label: "Sex", value: sex },
      { id: "size", label: "Size", value: forageSize(school.scale[i]) },
      { id: "diet", label: "Diet", value: spec.diet },
      { id: "energy", label: "Energy", value: `${Math.round(school.energy[i] * 100)}%` },
      { id: "school", label: "School", value: ctx.schoolLabel },
      {
        id: "state",
        label: "State",
        value: school.alarm[i] > 0.28 ? "Fleeing" : school.anchors[sid]?.mill > 0.45 ? "Milling" : "Schooling",
      },
      { id: "depth", label: "Depth", value: depthText(school.pos[i3 + 1]) },
      { id: "speed", label: "Speed", value: speedText(school.vel[i3], school.vel[i3 + 1], school.vel[i3 + 2]) },
    ],
    notes: speciesNotes(spec, liveForage(school, i)),
  };
}

export function schoolCard(school, id, ctx) {
  const t = school.anchors[id]?.taxon ?? 0;
  const spec = faunaOf(school.taxa[t]?.id || "herring");
  const n = school.schoolN[id] || 0;
  const c = school.centroids[id];
  const mill = school.anchors[id]?.mill ?? 0;
  const fem = school.schoolFem[id] || 0;
  const mal = school.schoolMal[id] || 0;
  return {
    kindLabel: "Shoal",
    title: `${spec.common} shoal`,
    subtitle: `${spec.latin} · mixed sex`,
    following: ctx.following,
    stats: [
      { id: "sex", label: "Sex", value: "Mixed" },
      { id: "sexes", label: "F / M", value: `${fem.toLocaleString()} / ${mal.toLocaleString()}` },
      { id: "members", label: spec.common, value: n.toLocaleString() },
      { id: "diet", label: "Diet", value: spec.diet },
      { id: "energy", label: "Energy", value: `${Math.round((1 - (school.schoolHunger[id] ?? 0.5)) * 100)}%` },
      { id: "id", label: "Shoal", value: ctx.schoolLabel },
      { id: "depth", label: "Depth", value: depthText(c?.y ?? 0) },
      { id: "mode", label: "Mode", value: mill > 0.45 ? "Milling" : "Foraging" },
    ],
    notes: speciesNotes(spec, liveSchool(school, id)),
  };
}
