import { CONFIG, faunaPresent } from "./config.js";
import { getActivePatch } from "./world/patch.js";
import { SPECIES, knobsFor, vehicleCfg, SCHOOL_IDS, schoolDiet, isSchoolBiter, airY } from "./world/fauna.js";
import { FAUNA } from "./world/fieldNotes.js";

export { FAUNA };

export const LOCATIONS = {
  "world-map": {
    id: "world-map",
    name: "World ocean",
    region: "Pick a 1 km cell",
    about:
      "The map is the window onto the basin. Click water to load that kilometre: GEBCO bathymetry, a mean current, and every catalogued animal whose range covers the cell. Cells is a picker of named kilometres — the catalog tank plus biomes from the coupling figure — not a second ocean.",
    fauna: Object.values(FAUNA),
  },
  "lab-cell": {
    id: "lab-cell",
    name: "Catalog tank",
    region: "2 × 2 km laboratory cell",
    about:
      "A synthetic 2 × 2 km cell: a beach on +Z, an inner shelf near −40 m, a mid-shelf terrace near −110 m, an outer ledge near −220 m, a slope terrace near −800 m, a canyon and a seamount, and a basin to −2000 m. Every implemented animal is present. Grazers share a bloom-capped budget; piscivores share a prey-capped slice of the same hashed grid. Vehicles are the rares. Not a biogeographic range — a test of the model.",
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
  const named = patch.about || (patch.lab || patch.synthetic ? loc.about : null);
  return {
    ...loc,
    name: patch.name || loc.name,
    region: patch.region || loc.region,
    about: named
      ? named
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
  "Benthos",
  "Mysticete",
  "Odontocete",
];

export function censusList(school, sharks = [], plankton) {
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
  if (plankton && faunaPresent("benthos")) {
    counts.benthos = Math.max(1, Math.round((plankton.meanI ?? plankton.meanB ?? 0) * 100));
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
  if (cfg.breathes && s.surfacing && s.y > airY(cfg)) return "Breathing";
  if (cfg.breathes && s.surfacing) return "Surfacing";
  if (cfg.breathes && !s.surfacing) return "Foraging dive";
  if (s.sex === 0 && s.mateT <= 0 && s.energy >= cfg.mateEnergy) return "Courting";
  const modes = {
    patrol: "Patrol",
    stalk: "Stalk",
    strike: "Strike",
    recover: "Recover",
  };
  if (s.energy > cfg.satiated && s.aiMode === "patrol") return "Roaming";
  return modes[s.aiMode] || "Patrol";
}

const BLOOM_MIN = 0.02;

function fieldLive(kind, bloom) {
  if (kind === "p") return (bloom?.p ?? 0) > BLOOM_MIN;
  if (kind === "z") return (bloom?.z ?? 0) > BLOOM_MIN;
  if (kind === "b") return (bloom?.b ?? 0) > BLOOM_MIN;
  return false;
}

function bitePreyIds(id) {
  const spec = SPECIES[id];
  if (!spec || spec.agent === "field") return [];
  const cfg = spec.agent === "school" ? knobsFor(id) : vehicleCfg(id);
  const diet = cfg.diet || schoolDiet(cfg);
  if (diet === "filter" || diet === "z" || diet === "p") {
    if (!isSchoolBiter(cfg)) return [];
  }
  if (cfg.huntTaxa?.length) return cfg.huntTaxa.slice();
  const prey = spec.prey || [];
  const named = prey.filter((p) => p !== "school" && p !== "bloom");
  if (named.length) return named;
  if (diet === "bite" || diet === "both" || prey.includes("school")) {
    return SCHOOL_IDS.filter((sid) => {
      if (sid === id) return false;
      const g = SPECIES[sid]?.guild;
      return g === "forage" || g === "surface" || g === "cephalopod";
    });
  }
  return [];
}

function dietLinks(id, ctx) {
  const counts = ctx?.counts || {};
  const bloom = ctx?.bloom || {};
  const spec = SPECIES[id];
  const links = [];
  const seen = new Set();

  function add(link) {
    const key = link.id || `field:${link.label}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push(link);
  }

  if (spec?.agent === "school") {
    const cfg = knobsFor(id);
    const diet = schoolDiet(cfg);
    if ((diet === "p" || diet === "both") && fieldLive("p", bloom)) add({ label: "Phytoplankton" });
    if ((diet === "z" || diet === "both") && fieldLive("z", bloom)) add({ label: "Zooplankton" });
    if (cfg.benthosGraze > 0 && (counts.benthos || 0) > 0) {
      add({ id: "benthos", label: faunaOf("benthos").common });
    }
    if (isSchoolBiter(cfg)) {
      for (const pid of bitePreyIds(id)) {
        if ((counts[pid] || 0) <= 0) continue;
        add({ id: pid, label: faunaOf(pid).common });
      }
    }
  } else if (spec?.agent === "field") {
    add({ label: "Detritus" });
  } else if (spec?.agent === "vehicle") {
    const v = vehicleCfg(id);
    const diet = v.diet || "bite";
    if ((diet === "filter" || diet === "both" || v.filterGraze > 0) && fieldLive("z", bloom)) {
      add({ label: "Zooplankton" });
    }
    if (v.benthosGraze > 0 && (counts.benthos || 0) > 0) {
      add({ id: "benthos", label: faunaOf("benthos").common });
    }
    for (const pid of bitePreyIds(id)) {
      if ((counts[pid] || 0) <= 0) continue;
      add({ id: pid, label: faunaOf(pid).common });
    }
    for (const kid of v.huntKinds || []) {
      if ((counts[kid] || 0) <= 0) continue;
      add({ id: kid, label: faunaOf(kid).common });
    }
  }
  return links;
}

function dietStat(id, ctx) {
  const spec = faunaOf(id);
  const links = dietLinks(id, ctx);
  return {
    id: "diet",
    label: "Diet",
    value: links.length ? links.map((l) => l.label).join(", ") : "None in cell",
    links,
    detail: spec.diet ? `In nature: ${spec.diet}` : "",
    hint: spec.diet ? `Natural diet: ${spec.diet}` : "No modeled food in this cell.",
    wide: true,
  };
}

function breathOxygen(s) {
  const cfg = s.cfg || CONFIG.shark;
  if (!cfg.breathes) return null;
  const atAir = s.y > airY(cfg);
  if (s.surfacing && atAir) {
    const total = Math.max(0.01, cfg.surfaceTime ?? 6);
    return Math.min(1, Math.max(0, 1 - (s.breathT ?? 0) / total));
  }
  const total = Math.max(0.01, cfg.diveTime ?? 28);
  return Math.min(1, Math.max(0, (s.breathT ?? 0) / total));
}

function oxygenStat(s) {
  const frac = breathOxygen(s);
  if (frac == null) return null;
  return {
    id: "oxygen",
    label: "Oxygen",
    value: `${Math.round(frac * 100)}%`,
    meter: frac,
    hint: "Remaining breath-hold. Leaves for the surface before the tank is empty; 0% underwater is drowning. Recovers only at the air.",
  };
}

function depthCapText(cfg) {
  const bio = cfg.maxDepth;
  const floor = CONFIG.floorY + (cfg.floorClearance ?? 2);
  const here = Math.max(floor, bio);
  if (Math.abs(here - bio) < 5) return depthText(bio);
  return `${depthText(bio)} · here ${depthText(here)}`;
}

function speciesNotes(spec) {
  const notes = [{ id: "about", label: "In nature", text: spec.about }];
  if (spec.missing?.length) {
    notes.push({ id: "missing", label: "Not in the model", text: spec.missing.join(" ") });
  }
  return notes;
}

export function sharkCard(s, ctx) {
  const spec = faunaOf(s.kind || "shark");
  const cfg = s.cfg || CONFIG.shark;
  const sex = sexLabel(s.sex);
  const o2 = oxygenStat(s);
  const stats = [
    { id: "sex", label: "Sex", value: sex },
    { id: "size", label: "Size", value: predatorSize(s) },
    { id: "length", label: "Length", value: `${(cfg.length * s.scale).toFixed(1)} m` },
    { id: "maxdepth", label: "Max depth", value: depthCapText(cfg) },
    { id: "hunger", label: "Energy", value: `${Math.round(s.energy * 100)}%` },
  ];
  if (o2) stats.push(o2);
  stats.push(
    { id: "state", label: "State", value: predatorState(s) },
    { id: "depth", label: "Depth", value: depthText(s.y) },
    { id: "speed", label: "Speed", value: speedText(s.vx, s.vy, s.vz) },
    dietStat(spec.id, ctx),
  );
  return {
    kindLabel: spec.guild,
    title: spec.common,
    subtitle: `${spec.latin} · ${sex}`,
    following: ctx.following,
    stats,
    notes: speciesNotes(spec),
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
      dietStat(spec.id, ctx),
    ],
    notes: speciesNotes(spec),
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
      dietStat(spec.id, ctx),
    ],
    notes: speciesNotes(spec),
  };
}
