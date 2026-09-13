import { CONFIG, faunaPresent } from "./config.js";
import { getActivePatch } from "./world/patch.js";
import { SPECIES, knobsFor, vehicleCfg } from "./world/fauna.js";
import { FAUNA } from "./world/fieldNotes.js";

export { FAUNA };

export const LOCATIONS = {
  "world-map": {
    id: "world-map",
    name: "World ocean",
    region: "Pick a 1 km cell",
    about:
      "The map is the window onto the basin. Click water to load that kilometre: GEBCO bathymetry, a mean current, and every catalogued animal whose range covers the cell. The lab is a 10 km tank with the whole catalog, for testing coexistence and depth — not a real place.",
    fauna: Object.values(FAUNA),
  },
  "lab-cell": {
    id: "lab-cell",
    name: "Catalog tank",
    region: "10 × 10 km laboratory cell",
    about:
      "A synthetic 10 km cell: a beach on +Z, an inner shelf near −40 m, a mid-shelf terrace near −110 m, an outer ledge near −220 m, a slope terrace near −800 m, a canyon and a seamount, and a basin to −2000 m. Every implemented animal is present. School fish share one bloom-capped budget; vehicles spawn in pairs or more. Not a biogeographic range — a test of the model.",
    fauna: Object.values(FAUNA),
  },
  "north-sea-shelf": {
    id: "north-sea-shelf",
    name: "Coastal shelf",
    region: "North Sea–style inner shelf",
    about:
      "A few hundred metres of shelf: a sandy beach on the inner edge, inner shelf near −36 m, floor dropping to −110 m offshore. Tide, longshore current, and an NPZD bloom set how many animals this cell can carry. Herring, mackerel, sprat, and sand lance graze z; sharks hunt the column; cod wait on the sand.",
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
  const loc = LOCATIONS[id] || LOCATIONS["world-map"];
  const patch = getActivePatch();
  const fauna = (loc.fauna || []).filter((sp) => faunaPresent(sp.id)).map(localizeFauna);
  if (!patch) return { ...loc, fauna };
  return {
    ...loc,
    name: patch.name || loc.name,
    region: patch.region || loc.region,
    about: patch.lab
      ? loc.about
      : patch.synthetic
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
  if (sp.id === "sandlance") {
    if (lon < -100 || lon > 120) return { ...sp, latin: "Ammodytes personatus" };
    return { ...sp, latin: "Ammodytes marinus" };
  }
  if (sp.id === "minke" && lat < 0) {
    return { ...sp, latin: "Balaenoptera bonaerensis" };
  }
  if (sp.id === "jackmackerel") {
    if (lon < -68 && lat < 10) return { ...sp, common: "Chilean jack mackerel", latin: "Trachurus murphyi" };
    if (lon < -100) return { ...sp, common: "Pacific jack mackerel", latin: "Trachurus symmetricus" };
    if (lon > 120 && lat > 0) return { ...sp, common: "Japanese jack mackerel", latin: "Trachurus japonicus" };
    if (lat < -20) return { ...sp, common: "Greenback horse mackerel", latin: "Trachurus declivis" };
    return { ...sp, latin: "Trachurus trachurus" };
  }
  if (sp.id === "illex") {
    if (lat < 0) return { ...sp, common: "Argentine shortfin squid", latin: "Illex argentinus" };
    return { ...sp, common: "Northern shortfin squid", latin: "Illex illecebrosus" };
  }
  if (sp.id === "krill") {
    if (lat < 0) return { ...sp, common: "Antarctic krill", latin: "Euphausia superba" };
    return { ...sp, common: "Northern krill", latin: "Meganyctiphanes norvegica" };
  }
  if (sp.id === "toothfish" && lat > -58) {
    return { ...sp, common: "Patagonian toothfish", latin: "Dissostichus eleginoides" };
  }
  if (sp.id === "bluefin") {
    if (lat < -20) return { ...sp, common: "Southern bluefin", latin: "Thunnus maccoyii" };
    if (lon < -100 || lon > 120) return { ...sp, common: "Pacific bluefin", latin: "Thunnus orientalis" };
    return { ...sp, common: "Atlantic bluefin", latin: "Thunnus thynnus" };
  }
  return sp;
}

const CENSUS_GUILD_ORDER = [
  "Pelagic forage fish",
  "Mesopelagic forage fish",
  "Benthopelagic forage fish",
  "Surface forage fish",
  "Euphausiid",
  "Pelagic cephalopod",
  "Pelagic predator",
  "Coastal pelagic predator",
  "Surface pelagic predator",
  "Demersal predator",
  "Slope predator",
  "Filter-feeding shark",
  "Pelagic cephalopod predator",
  "Mysticete",
  "Odontocete",
];

export function censusList(school, sharks = []) {
  const counts = {};
  const present = [];
  for (const spec of Object.values(FAUNA)) {
    if (!faunaPresent(spec.id)) continue;
    counts[spec.id] = 0;
    present.push(localizeFauna(spec));
  }
  if (school) {
    for (let i = 0; i < school.count; i++) {
      const id = school.taxonId?.(i) || "herring";
      counts[id] = (counts[id] || 0) + 1;
    }
  }
  for (const s of sharks) {
    const id = s.kind || "shark";
    counts[id] = (counts[id] || 0) + 1;
  }
  present.sort((a, b) => {
    const ga = CENSUS_GUILD_ORDER.indexOf(a.guild);
    const gb = CENSUS_GUILD_ORDER.indexOf(b.guild);
    const ia = ga < 0 ? 99 : ga;
    const ib = gb < 0 ? 99 : gb;
    if (ia !== ib) return ia - ib;
    return a.common.localeCompare(b.common);
  });
  return present.map((spec) => ({
    id: spec.id,
    common: spec.common,
    latin: spec.latin,
    guild: spec.guild,
    count: counts[spec.id] || 0,
    agent: SPECIES[spec.id]?.agent || "school",
  }));
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
  if (cfg.breathes && s.surfacing) return "Breathing";
  if (cfg.breathes && !s.surfacing) return "Foraging dive";
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
  const social = school.taxonCfg?.(i)?.social || "polarized";
  if (social === "loose") {
    return `This ${sex} is in a loose surface aggregation — nearby fish, not a polarized school.`;
  }
  if (social === "scatter") {
    return `This ${sex} is swimming independently, only avoiding neighbours.`;
  }
  return `This ${sex} is schooling with its own species: same-shoal alignment, nearest-neighbour spacing, and a pancake envelope.`;
}

function livePredator(s) {
  const spec = faunaOf(s.kind || "shark");
  const cfg = s.cfg || CONFIG.shark;
  const sex = sexLabel(s.sex).toLowerCase();
  const floor = depthText(CONFIG.floorY);
  const cap = depthText(Math.max(CONFIG.floorY + (cfg.floorClearance ?? 4), cfg.maxDepth));
  if (s.controlled) return `This ${sex} is piloted. Energy still drains and eating still restores it.`;
  if (s.energy < cfg.starveAt) return `This ${sex} is starving. Without a meal it will die and recycle into the water column.`;
  if (cfg.breathes && s.surfacing) {
    return `This ${sex} is at the surface to breathe. Next dive can go to ${cap} in this cell (floor ${floor}; biological max ${depthText(cfg.maxDepth)}).`;
  }
  if (cfg.breathes && !s.surfacing) {
    return `This ${sex} is on a foraging dive toward ${cap}. The seafloor at ${floor} wins if it is shallower than the biological max of ${depthText(cfg.maxDepth)}. Time is compressed, so the descent is sped up enough to actually reach that depth.`;
  }
  if (s.sex === 0 && s.mateT <= 0 && s.energy >= cfg.mateEnergy) {
    return `This female is courting: the year-timer has elapsed and energy is high enough to seek a male.`;
  }
  if (s.aiMode === "stalk") return `This ${sex} is stalking, holding a flank on the hunted school.`;
  if (s.aiMode === "strike") return `This ${sex} is striking.`;
  if (s.aiMode === "recover") return `This ${sex} is recovering after a strike.`;
  if ((cfg.diet || "bite") === "filter") {
    return `This ${sex} is filter-feeding: a Type II pull on zooplankton at this depth, not a bite.`;
  }
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
  if ((school.shoalCfg?.(id)?.social || "polarized") === "loose") return `Loose aggregation. ${mix}`;
  if ((school.shoalCfg?.(id)?.social || "polarized") === "scatter") return `Scattered. ${mix}`;
  if (hunger > 0.55) return `Foraging up the bloom gradient. ${mix}`;
  return `Polarized commute. ${mix}`;
}

function cfgFor(id) {
  return SPECIES[id]?.agent === "vehicle" ? vehicleCfg(id) : knobsFor(id);
}

function depthCapText(cfg) {
  const bio = cfg.maxDepth;
  const floor = CONFIG.floorY + (cfg.floorClearance ?? 2);
  const here = Math.max(floor, bio);
  if (Math.abs(here - bio) < 5) return depthText(bio);
  return `${depthText(bio)} · here ${depthText(here)}`;
}

function cellDepthBlurb(id) {
  const cfg = cfgFor(id);
  const floor = CONFIG.floorY;
  const cap = Math.max(floor + (cfg.floorClearance ?? 2), cfg.maxDepth);
  let dvm = "";
  if (cfg.nightDepth != null && cfg.dayDepth != null) {
    dvm = ` DVM in this build: night ${depthText(cfg.nightDepth)}, day ${depthText(cfg.dayDepth)}.`;
  }
  return `Biological max ${depthText(cfg.maxDepth)}. This cell's floor is ${depthText(floor)}, so the deepest it can go here is ${depthText(cap)}.${dvm}`;
}

function speciesNotes(spec, live) {
  const notes = [
    { id: "behavior", label: "Now", text: live },
    { id: "about", label: "In nature", text: spec.about },
    { id: "program", label: "In this cell", text: `${spec.program} ${cellDepthBlurb(spec.id)}` },
  ];
  if (spec.missing?.length) {
    notes.push({ id: "missing", label: "Not in the model", text: spec.missing.join(" ") });
  }
  return notes;
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
      { id: "maxdepth", label: "Max depth", value: depthCapText(cfg) },
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
      { id: "maxdepth", label: "Max depth", value: depthCapText(school.taxonCfg?.(i) || knobsFor(spec.id)) },
      { id: "energy", label: "Energy", value: `${Math.round(school.energy[i] * 100)}%` },
      { id: "school", label: "School", value: ctx.schoolLabel },
      {
        id: "state",
        label: "State",
        value:
          school.alarm[i] > 0.28
            ? "Fleeing"
            : school.taxonCfg?.(i)?.social === "loose"
              ? "Aggregating"
              : school.taxonCfg?.(i)?.social === "scatter"
                ? "Drifting"
                : school.anchors[sid]?.mill > 0.45
                  ? "Milling"
                  : "Schooling",
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
      { id: "maxdepth", label: "Max depth", value: depthCapText(school.shoalCfg?.(id) || knobsFor(spec.id)) },
      { id: "energy", label: "Energy", value: `${Math.round((1 - (school.schoolHunger[id] ?? 0.5)) * 100)}%` },
      { id: "id", label: "Shoal", value: ctx.schoolLabel },
      { id: "depth", label: "Depth", value: depthText(c?.y ?? 0) },
      {
        id: "mode",
        label: "Mode",
        value:
          mill > 0.45
            ? "Milling"
            : school.shoalCfg?.(id)?.social === "loose"
              ? "Aggregating"
              : school.shoalCfg?.(id)?.social === "scatter"
                ? "Scattered"
                : "Foraging",
      },
    ],
    notes: speciesNotes(spec, liveSchool(school, id)),
  };
}
