import { CONFIG } from "./config.js";

/**
 * Fauna and place notes for each simulated cell. A new location is a
 * catalog: name, a short habitat, and the animals that actually occupy
 * it. Do not clone a species into a second cell without a different
 * guild, food, or depth. Swap `CONFIG.location` (or pass an id) when
 * another cell exists.
 */
export const LOCATIONS = {
  "north-sea-shelf": {
    id: "north-sea-shelf",
    name: "Coastal shelf",
    region: "North Sea–style inner shelf",
    about:
      "A few hundred metres of shelf: a sandy beach on the inner edge, inner shelf near −36 m, floor dropping to −110 m offshore. Tide, longshore current, and an NPZD bloom set how many animals this cell can carry.",
    fauna: [
      {
        id: "herring",
        common: "Atlantic herring",
        latin: "Clupea harengus",
        guild: "Pelagic forage fish",
        diet: "Zooplankton",
        sex: "Female / male. Females are drawn slightly larger.",
        program:
          "Reynolds shoal on a hashed 3D grid: nearest-neighbour spacing, same-school alignment, a thin pancake envelope. The school forages up the zooplankton gradient, mills when food is rich, peels off the beach before it strands, and flees through a neighbour alarm-wave. Grazing is Type II; bloom mean caps headcount; starvation and kills recycle biomass into the water column.",
        about:
          "The forage fish of this cell. Recruits appear only when school energy is high and the NPZD field can feed them.",
      },
      {
        id: "shark",
        common: "Pelagic shark",
        latin: "Lamnidae",
        guild: "Pelagic predator",
        diet: "Atlantic herring",
        sex: "Female / male. Females are larger and initiate courtship.",
        program:
          "Burst-and-glide, not a constant thruster. Hunger runs patrol → stalk → strike-from-below → recover. Satiated animals roam instead of farming the school. Pack members keep a body-length of water between them and claim different shoals when they can. A year-timer plus high energy lets a female pup; the pup costs maternal energy and inherits mixed parent size. Starvation recycles the carcass.",
        about:
          "The hunter of this herring patch. The guild is not yet split into named species.",
      },
    ],
  },
};

export function getLocation(id = CONFIG.location) {
  return LOCATIONS[id] || LOCATIONS["north-sea-shelf"];
}

function faunaOf(id) {
  return getLocation().fauna.find((sp) => sp.id === id);
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

function herringSize(scale) {
  if (scale < 0.88) return "Small";
  if (scale > 1.1) return "Large";
  return "Adult";
}

function sharkSize(s) {
  if (s.scale < 0.72) return "Juvenile";
  if (s.scale > 1.12) return "Large";
  if (s.scale < 0.88) return "Small";
  return "Adult";
}

function sharkState(s) {
  if (s.controlled) return "Pilot";
  if (s.energy < CONFIG.shark.starveAt) return "Starving";
  if (s.sex === 0 && s.mateT <= 0 && s.energy >= CONFIG.shark.mateEnergy) return "Courting";
  const modes = {
    patrol: "AI patrol",
    stalk: "AI stalk",
    strike: "AI strike",
    recover: "AI recover",
  };
  if (s.energy > CONFIG.shark.satiated && s.aiMode === "patrol") return "Roaming";
  return modes[s.aiMode] || "AI";
}

function liveHerring(school, i) {
  const sex = sexLabel(school.sex[i]).toLowerCase();
  const alarm = school.alarm[i];
  const energy = school.energy[i];
  const sid = school.schoolId[i];
  const mill = school.anchors[sid]?.mill ?? 0;
  if (alarm > 0.28) {
    return `This ${sex} is in the flee mix. Alarm spreads as a neighbour turn-wave; flee blends with hold so a strike opens a hole instead of detonating the shoal.`;
  }
  if (energy < CONFIG.fish.starveAt * 2.5) {
    return `This ${sex} is energy-poor. Grazing is a Type II pull up the zooplankton gradient; below the starve floor the fish is removed and its mass returns to the NPZD field.`;
  }
  if (mill > 0.45) {
    return `This ${sex} is milling with its shoal — a slow gyre while food is rich and sharks are far.`;
  }
  return `This ${sex} is schooling: same-school alignment, nearest-neighbour spacing, and a pancake envelope ahead of the centroid.`;
}

function liveShark(s) {
  const sex = sexLabel(s.sex).toLowerCase();
  if (s.controlled) return `This ${sex} is piloted. Energy still drains and eating still restores it.`;
  if (s.energy < CONFIG.shark.starveAt) return `This ${sex} is starving. Without a kill it will die and recycle into the water column.`;
  if (s.sex === 0 && s.mateT <= 0 && s.energy >= CONFIG.shark.mateEnergy) {
    return `This female is courting: the year-timer has elapsed and energy is high enough to seek a male.`;
  }
  if (s.aiMode === "stalk") return `This ${sex} is stalking, holding a flank below the hunted school.`;
  if (s.aiMode === "strike") return `This ${sex} is striking: a burst-and-lunge from below.`;
  if (s.aiMode === "recover") return `This ${sex} is recovering after a strike, then stalking again or returning to patrol.`;
  if (s.energy > CONFIG.shark.satiated) return `This ${sex} is roaming — satiated, so it is not farming the school.`;
  return `This ${sex} is on patrol, circling at cruise with burst-and-glide kicks.`;
}

function liveSchool(school, id) {
  const mill = school.anchors[id]?.mill ?? 0;
  const hunger = school.schoolHunger[id] ?? 0.5;
  const fem = school.schoolFem[id] || 0;
  const mal = school.schoolMal[id] || 0;
  const mix = `Mixed shoal (${fem.toLocaleString()} female / ${mal.toLocaleString()} male).`;
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
  const spec = faunaOf("shark");
  const sex = sexLabel(s.sex);
  return {
    kindLabel: spec.guild,
    title: spec.common,
    subtitle: `${spec.latin} · ${sex}`,
    following: ctx.following,
    stats: [
      { id: "sex", label: "Sex", value: sex },
      { id: "size", label: "Size", value: sharkSize(s) },
      { id: "length", label: "Length", value: `${(CONFIG.shark.length * s.scale).toFixed(1)} m` },
      { id: "diet", label: "Diet", value: spec.diet },
      { id: "hunger", label: "Energy", value: `${Math.round(s.energy * 100)}%` },
      { id: "state", label: "State", value: sharkState(s) },
      { id: "depth", label: "Depth", value: depthText(s.y) },
      { id: "speed", label: "Speed", value: speedText(s.vx, s.vy, s.vz) },
    ],
    notes: speciesNotes(spec, liveShark(s)),
  };
}

export function herringCard(school, i, ctx) {
  const spec = faunaOf("herring");
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
      { id: "size", label: "Size", value: herringSize(school.scale[i]) },
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
    notes: speciesNotes(spec, liveHerring(school, i)),
  };
}

export function schoolCard(school, id, ctx) {
  const spec = faunaOf("herring");
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
      { id: "members", label: "Herring", value: n.toLocaleString() },
      { id: "diet", label: "Diet", value: spec.diet },
      { id: "energy", label: "Energy", value: `${Math.round((1 - (school.schoolHunger[id] ?? 0.5)) * 100)}%` },
      { id: "id", label: "Shoal", value: ctx.schoolLabel },
      { id: "depth", label: "Depth", value: depthText(c?.y ?? 0) },
      { id: "mode", label: "Mode", value: mill > 0.45 ? "Milling" : "Foraging" },
    ],
    notes: speciesNotes(spec, liveSchool(school, id)),
  };
}
