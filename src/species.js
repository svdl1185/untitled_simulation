import { CONFIG } from "./config.js";

export const SPECIES = {
  herring: {
    common: "Atlantic herring",
    latin: "Clupea harengus",
    guild: "Pelagic forage fish",
    diet: "Zooplankton",
    about:
      "A clupeid shoaler of this North Sea–style shelf cell. Individuals graze zooplankton with a Type II response; mean zooplankton caps how many fish the bloom can carry. Females are drawn slightly larger than males. Recruits appear only when school energy is high and the NPZD field can feed them. Starvation and shark kills return biomass to the water column.",
  },
  shark: {
    common: "Pelagic shark",
    latin: "Lamnidae",
    guild: "Pelagic predator",
    diet: "Atlantic herring",
    about:
      "A lamnid hunter of the herring patch — this guild is not yet split into named species. Swim is burst-and-glide, not a constant thruster. Hunger runs a patrol → stalk → strike-from-below → recover loop; satiated animals roam instead of farming the school. Females court when a year-timer has elapsed and energy is high; a pup costs maternal energy and inherits mixed parent size.",
  },
};

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

function sharkMate(s) {
  if (s.sex !== 0) return "Male (does not initiate)";
  if (s.mateT <= 0) {
    return s.energy >= CONFIG.shark.mateEnergy ? "Ready" : "Waiting on energy";
  }
  const days = Math.ceil(s.mateT / CONFIG.time.dayLength);
  return `${days} d`;
}

export function herringBehavior(school, i) {
  const sex = sexLabel(school.sex[i]).toLowerCase();
  const alarm = school.alarm[i];
  const energy = school.energy[i];
  const sid = school.schoolId[i];
  const mill = school.anchors[sid]?.mill ?? 0;
  const hunger = school.schoolHunger[sid] ?? 0.5;

  if (alarm > 0.28) {
    return `This ${sex} is in the flee mix. Alarm spreads through neighbours as a turn-wave; flee blends with school hold so a shark strike opens a hole instead of detonating the shoal.`;
  }
  if (energy < CONFIG.fish.starveAt * 2.5) {
    return `This ${sex} is energy-poor. Grazing is a Type II pull up the zooplankton gradient. Metabolism, alarm, and storms drain energy; below the starve floor the fish is removed and its mass returns to the NPZD field.`;
  }
  if (mill > 0.45) {
    return `This ${sex} is milling with its shoal. When food is rich and sharks are far, the school anchor slows and turns the pancake volume into a holding gyre instead of a foraging commute.`;
  }
  if (hunger > 0.55) {
    return `This ${sex} is commuting with a hungry shoal. The anchor steers up the plankton gradient, tracks the forage depth of the zooplankton layer, and peels off the beach before the school strands.`;
  }
  return `This ${sex} is schooling: same-school alignment, nearest-neighbour spacing, and a thin pancake envelope pinned ahead of the live centroid. Individuals ride the shared current and graze zooplankton while they swim.`;
}

export function sharkBehavior(s) {
  const sex = sexLabel(s.sex).toLowerCase();
  if (s.controlled) {
    return `This ${sex} is piloted. WASD, rise/dive, boost, and a space lunge override the AI; energy still drains and eating still restores it.`;
  }
  if (s.energy < CONFIG.shark.starveAt) {
    return `This ${sex} is starving. After a few days without a kill the animal dies and the carcass recycles into the water column.`;
  }
  if (s.sex === 0 && s.mateT <= 0 && s.energy >= CONFIG.shark.mateEnergy) {
    return `This female is courting: the year-timer has elapsed and energy is high enough to seek a male. A pup costs maternal energy, starts small, and inherits mixed parent size.`;
  }
  if (s.aiMode === "stalk") {
    return `This ${sex} is stalking. It holds a flank below the hunted school, weaves, then closes when hungry enough for a strike. Pack members claim different schools when they can.`;
  }
  if (s.aiMode === "strike") {
    return `This ${sex} is striking: a burst-and-lunge from below. Fear radius and bite radius open for the pass, then the AI peels into recover.`;
  }
  if (s.aiMode === "recover") {
    return `This ${sex} is recovering after a strike — peeling off, swapping flanks, then either stalking again if hungry or returning to patrol.`;
  }
  if (s.energy > CONFIG.shark.satiated) {
    return `This ${sex} is roaming. Energy is above the satiation threshold, so the AI picks wander points instead of farming the school.`;
  }
  return `This ${sex} is on patrol: circling the hunted school at cruise with burst-and-glide kicks, waiting for hunger or proximity to start a stalk. Body-length spacing keeps the pack from stacking.`;
}

export function schoolBehavior(school, id) {
  const mill = school.anchors[id]?.mill ?? 0;
  const hunger = school.schoolHunger[id] ?? 0.5;
  const food = school.anchors[id]?.food ?? 0;
  const fem = school.schoolFem[id] || 0;
  const mal = school.schoolMal[id] || 0;
  const mix = `The shoal is mixed (${fem.toLocaleString()} female / ${mal.toLocaleString()} male). Schools split when they stretch and merge when they close; each keeps its own heading so two shoals do not become one species of motion.`;
  if (mill > 0.45) {
    return `Milling: food is rich enough and sharks are far enough that the anchor has dropped into a slow gyre. ${mix}`;
  }
  if (hunger > 0.55 || food < 0.1) {
    return `Foraging: hunger or thin zooplankton is pulling the anchor up the bloom gradient and toward the forage depth of the zooplankton layer. ${mix}`;
  }
  return `Polarized commute: the pancake envelope leads the centroid, the shoal peels off the beach before it strands, and flow plus the plankton gradient bias the heading. ${mix}`;
}

export function sharkCard(s, ctx) {
  const spec = SPECIES.shark;
  const sex = sexLabel(s.sex);
  const length = CONFIG.shark.length * s.scale;
  return {
    kindLabel: spec.guild,
    title: spec.common,
    subtitle: `${spec.latin} · ${sex}`,
    following: ctx.following,
    stats: [
      { id: "sex", label: "Sex", value: sex },
      { id: "size", label: "Size", value: sharkSize(s) },
      { id: "length", label: "Length", value: `${length.toFixed(1)} m` },
      { id: "diet", label: "Diet", value: spec.diet },
      { id: "hunger", label: "Energy", value: `${Math.round(s.energy * 100)}%` },
      { id: "eaten", label: "Eaten", value: s.eaten.toLocaleString() },
      { id: "pups", label: "Pups", value: String(s.pups || 0) },
      { id: "breed", label: "Breeding", value: sharkMate(s) },
      { id: "state", label: "State", value: sharkState(s) },
      { id: "id", label: "Pack", value: `${ctx.index + 1} of ${ctx.total}` },
      { id: "depth", label: "Depth", value: depthText(s.y) },
      { id: "speed", label: "Speed", value: speedText(s.vx, s.vy, s.vz) },
    ],
    notes: [
      { id: "behavior", label: "Behavior", text: sharkBehavior(s) },
      { id: "about", label: "Species", text: spec.about },
    ],
  };
}

export function herringCard(school, i, ctx) {
  const spec = SPECIES.herring;
  const sex = sexLabel(school.sex[i]);
  const i3 = i * 3;
  const sid = school.schoolId[i];
  const length = CONFIG.fish.length * school.scale[i];
  return {
    kindLabel: spec.guild,
    title: spec.common,
    subtitle: `${spec.latin} · ${sex}`,
    following: ctx.following,
    stats: [
      { id: "sex", label: "Sex", value: sex },
      { id: "size", label: "Size", value: herringSize(school.scale[i]) },
      { id: "length", label: "Length", value: `${length.toFixed(2)} m` },
      { id: "diet", label: "Diet", value: spec.diet },
      { id: "energy", label: "Energy", value: `${Math.round(school.energy[i] * 100)}%` },
      { id: "school", label: "School", value: ctx.schoolLabel },
      { id: "depth", label: "Depth", value: depthText(school.pos[i3 + 1]) },
      { id: "speed", label: "Speed", value: speedText(school.vel[i3], school.vel[i3 + 1], school.vel[i3 + 2]) },
      {
        id: "state",
        label: "State",
        value: school.alarm[i] > 0.28 ? "Fleeing" : school.anchors[sid]?.mill > 0.45 ? "Milling" : "Schooling",
      },
    ],
    notes: [
      { id: "behavior", label: "Behavior", text: herringBehavior(school, i) },
      { id: "about", label: "Species", text: spec.about },
    ],
  };
}

export function schoolCard(school, id, ctx) {
  const spec = SPECIES.herring;
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
    notes: [
      { id: "behavior", label: "Behavior", text: schoolBehavior(school, id) },
      { id: "about", label: "Species", text: spec.about },
    ],
  };
}
