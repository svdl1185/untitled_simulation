/**
 * Live briefing for the open kilometre. Census is who is here;
 * this is what the water is doing, and how the animals in range
 * use it at this hour.
 */
import { knobsFor, SPECIES, vehicleCfg } from "./fauna.js";
import { demoById } from "./demos.js";
import { formatLatLon } from "./patch.js";

function metres(y) {
  if (!Number.isFinite(y)) return null;
  return Math.round(Math.abs(Math.min(0, y)));
}

function joinAnd(names) {
  if (!names.length) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function nameList(items, cap = 4) {
  const names = items.map((item) => item.common);
  if (names.length <= cap) return joinAnd(names);
  return `${joinAnd(names.slice(0, cap))}, and ${names.length - cap} more`;
}

function clockText(hour) {
  const h = Math.floor(((Number(hour) % 24) + 24) % 24);
  const m = Math.floor((Number(hour) % 1) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function clipY(y, floorY) {
  if (!Number.isFinite(y)) return y;
  const floor = (Number.isFinite(floorY) ? floorY : -8000) + 6;
  return Math.max(y, floor);
}

function scheduleY(phase, fish, omzCoreY, ice = 0) {
  let y;
  if (phase === "Night") y = fish.nightDepth;
  else if (phase === "Dawn") y = fish.dawnDepth ?? fish.nightDepth;
  else if (phase === "Dusk") y = fish.duskDepth ?? fish.nightDepth;
  else if (fish.omzRefuge && Number.isFinite(omzCoreY)) y = omzCoreY;
  else y = fish.dayDepth;
  if (fish.iceAssociated && ice > 0.08) {
    const under = -2.6 - (1 - ice) * 9;
    y += (under - y) * Math.min(1, ice * 1.05);
  }
  return y;
}

function schoolBand(id, ice = 0) {
  const spec = SPECIES[id];
  const fish = knobsFor(id);
  const look = spec?.look || {};
  if (fish.iceAssociated && ice > 0.12) return "ice";
  if (look.shape === "flying" || look.shape === "needle") return "surface";
  if (look.photophores) return "dsl";
  if (look.shape === "krill") return "krill";
  if (fish.diet === "bite" && (fish.habitat === "benthic" || spec?.guild === "demersal" || spec?.guild === "slope")) {
    return "benthic";
  }
  if (fish.diet === "bite" && (fish.omzRefuge || spec?.guild === "cephalopod-predator")) return "omz-hunter";
  if (fish.diet === "bite" || spec?.guild?.includes("predator")) return "hunter";
  if (look.shape === "squid") return "squid";
  if (fish.grazeOn === "p") return "filter-p";
  if (fish.social === "loose") return "surface";
  return "forage";
}

function schoolBehavior(band, fish, phase, omzCoreY, floorY, ice = 0) {
  const y = metres(clipY(scheduleY(phase, fish, omzCoreY, ice), floorY));
  const night = metres(clipY(fish.nightDepth, floorY));
  const dayRaw = fish.omzRefuge && Number.isFinite(omzCoreY) ? omzCoreY : fish.dayDepth;
  const day = metres(clipY(dayRaw, floorY));
  const floorM = metres(floorY);
  const clipped = Number.isFinite(floorY) && Number.isFinite(dayRaw) && floorY + 8 > dayRaw;
  const clipNote = clipped ? ` The ${floorM} m floor clips that dive — they hit sand, not the abyss.` : "";

  if (band === "ice") {
    return `Under the ice. Typical DVM shoals toward the ice–water film; now around ${y} m. Polar cod graze z; krill graze ice-algal P.`;
  }

  if (band === "surface") {
    return `Stay in the top ~20 m. Fear still steers them toward the air, in water. Now around ${y} m.`;
  }
  if (band === "dsl") {
    return `Deep scattering layer. Night near ${night} m; day around ${day} m. They can occupy the OMZ. Now around ${y} m.`;
  }
  if (band === "squid") {
    return `Pulse–coast on the school grid. Night near ${night} m; day around ${day} m. Now around ${y} m.`;
  }
  if (band === "krill") {
    return phase === "Night"
      ? `Night graze on phytoplankton near ${night} m.`
      : `Day refuge around ${day} m. Type II graze on p.${clipNote}`;
  }
  if (band === "filter-p") {
    return `Type II graze on phytoplankton. Shallow DVM — now around ${y} m.${clipNote}`;
  }
  if (band === "benthic") {
    return `On the hashed grid, hugging the bed. Live around ${y} m on a ${floorM} m floor.`;
  }
  if (band === "omz-hunter") {
    return phase === "Night"
      ? `On the hashed grid. Night in the upper ~100 m. Now around ${y} m.`
      : `On the hashed grid. Day follows the OMZ core (~${day} m), not a clock. Now around ${y} m.`;
  }
  if (band === "hunter") {
    const o2 = fish.o2Min;
    const oxy = Number.isFinite(o2) && o2 >= 2 ? ` Stay above about ${o2} ml/L.` : "";
    return `On the hashed grid — abundance is a catalog diet, not a Reynolds handful. Hunt school prey. Now around ${y} m.${oxy}`;
  }
  if (phase === "Night") {
    return `Night feeding near ${night} m on zooplankton.`;
  }
  if (phase === "Dawn" || phase === "Dusk") {
    return `On the commute between ${night} m and ${day} m. Type II graze on z.${clipNote}`;
  }
  return `Day visual refuge around ${day} m. Type II graze on z.${clipNote}`;
}

function meanY(animals) {
  if (!animals.length) return null;
  let s = 0;
  for (const a of animals) s += a.y;
  return s / animals.length;
}

function vehicleBehavior(kind, animals, phase, omzCoreY, floorY) {
  const cfg = vehicleCfg(kind);
  const n = animals.length;
  const here = metres(meanY(animals));
  const max = metres(clipY(cfg.maxDepth, floorY));
  const floorM = metres(floorY);

  if (cfg.breathes) {
    const atAir = animals.filter((s) => s.surfacing && s.y > (cfg.minDepth ?? -2) - 8).length;
    const forage = metres(clipY(cfg.forageDepth ?? -80, floorY));
    if (atAir === n) {
      return `${n} hanging and blowing at the surface. Next dive is toward live prey or about ${forage} m, not the ${max} m record.`;
    }
    if (atAir === 0) {
      return `${n} on a forage dive — now around ${here} m. Typical band ~${forage} m; the floor at ${floorM} m always wins.`;
    }
    return `${atAir} at the air, ${n - atAir} on a forage dive (typical ~${forage} m). Live depth around ${here} m.`;
  }

  if (cfg.omzRefuge) {
    const core = Number.isFinite(omzCoreY) ? metres(omzCoreY) : metres(cfg.dayDepth);
    return phase === "Night"
      ? `${n} in the upper ~100 m by night. Now around ${here} m.`
      : `${n} follow the OMZ core (~${core} m) by day, not a clock. Now around ${here} m. Tunas stay above their oxygen floor.`;
  }

  if (cfg.gait === "benthic" || cfg.diet === "benthos") {
    return `${n} hug the bed. Live around ${here} m on a ${floorM} m floor.`;
  }

  if (cfg.diet === "filter") {
    return `${n} filter the bloom. Live around ${here} m.`;
  }

  const hunting = animals.filter(
    (s) => s.lunging || s.aiMode === "strike" || s.aiMode === "stalk"
  ).length;
  const o2 = cfg.o2Min;
  const hunt =
    hunting === n
      ? "hunting"
      : hunting
        ? `${hunting} hunting, the rest patrolling`
        : "patrolling";
  const oxy = Number.isFinite(o2) && o2 >= 2 ? ` Stay above about ${o2} ml/L.` : "";
  return `${n} ${hunt}. Mean ${here} m; biological max ${max} m.${oxy}`;
}

function columnLines({
  floorY,
  photicY,
  mixedY,
  nutriclineY,
  omzCoreY,
  upwell,
  storm,
  meanP,
  meanZ,
  forageCount,
  forageCap,
  ice,
  iceH,
  iceT,
}) {
  const lines = [];
  const floorM = metres(floorY);
  const photicM = metres(photicY);
  const mixM = metres(mixedY);
  const nutM = metres(nutriclineY);
  if (Number.isFinite(floorY) && Number.isFinite(photicY) && floorY > photicY + 4) {
    lines.push(
      `Shelf floor at ${floorM} m sits inside the photic envelope (1% light ${photicM} m). The sand wins.`
    );
  } else {
    lines.push(`Floor ${floorM} m. 1% light ${photicM} m. Mixed layer ${mixM} m; nutricline ${nutM} m.`);
  }
  if ((ice ?? 0) > 0.08) {
    const pct = Math.round(ice * 100);
    const h = Number(iceH) > 0.05 ? ` · ${Number(iceH).toFixed(1)} m` : "";
    const t = Math.round((iceT ?? 1) * 100);
    const leads = Math.max(0, 100 - pct);
    lines.push(
      `Sea ice ${pct}%${h}. Under-ice PAR is ${t}% of open water. Leads are ${leads}% of the surface — not a charted polynya. Ice algae produces in the top metres.`
    );
  }
  if ((upwell ?? 0) > 0.25) {
    lines.push(
      `Climate upwell is lifting the nutricline toward the light (${nutM} m) — eastern-boundary production, not a gyre desert.`
    );
  }
  if (Number.isFinite(omzCoreY)) {
    lines.push(`OMZ core around ${metres(omzCoreY)} m. Hypoxia is a habitat, not a tint.`);
  }
  if (storm) {
    lines.push("Storm: mixed layer deepens, nutricline shoals, current speeds up.");
  }
  const p = Math.round((meanP ?? 0) * 100);
  const z = Math.round((meanZ ?? 0) * 100);
  const live = Number(forageCount) || 0;
  const cap = Number(forageCap) || 0;
  if (cap > 0) {
    lines.push(
      `Bloom P ${p} · Z ${z}. Hashed-grid ${live.toLocaleString()} against a grazer cap of ${cap.toLocaleString()}.`
    );
  }
  return lines;
}

function schoolNow(census, phase, omzCoreY, floorY, ice = 0) {
  const groups = new Map();
  for (const row of census || []) {
    if (row.agent !== "school" || !(row.count > 0)) continue;
    const band = schoolBand(row.id, ice);
    if (!groups.has(band)) groups.set(band, []);
    groups.get(band).push(row);
  }
  const order = ["forage", "filter-p", "surface", "krill", "ice", "squid", "dsl", "hunter", "omz-hunter", "benthic"];
  const lines = [];
  for (const band of order) {
    const items = groups.get(band);
    if (!items?.length) continue;
    items.sort((a, b) => b.count - a.count);
    const fish = knobsFor(items[0].id);
    const n = items.reduce((s, row) => s + row.count, 0);
    lines.push(
      `${nameList(items)} — ${n.toLocaleString()} in the cell. ${schoolBehavior(band, fish, phase, omzCoreY, floorY, ice)}`
    );
  }
  return lines;
}

function vehicleNow(census, sharks, phase, omzCoreY, floorY) {
  const live = new Map();
  for (const s of sharks || []) {
    if (!s || s.dead) continue;
    const id = s.kind || "shark";
    if (!live.has(id)) live.set(id, []);
    live.get(id).push(s);
  }
  const rows = (census || []).filter((row) => row.agent === "vehicle" && live.has(row.id));
  rows.sort((a, b) => (live.get(b.id)?.length || 0) - (live.get(a.id)?.length || 0));
  const lines = [];
  for (const row of rows.slice(0, 6)) {
    lines.push(
      `${row.common}: ${vehicleBehavior(row.id, live.get(row.id), phase, omzCoreY, floorY)}`
    );
  }
  return lines;
}

function fieldNow(census, meanB, meanI, meanBedP) {
  const benthos = (census || []).find((row) => row.id === "benthos");
  if (!benthos) return [];
  const carbon = Math.round((meanB ?? 0) * 100);
  const living = Math.round((meanI ?? 0) * 100);
  const algae = Math.round((meanBedP ?? 0) * 100);
  const cod = (census || []).find((row) => row.id === "cod" && row.count > 0);
  const stock = `infauna ${living}, microphyto ${algae}, carbon ${carbon}`;
  if (cod) {
    return [`Benthos: ${stock}. ${cod.common} graze the living bed.`];
  }
  return [`Benthos: ${stock}. A field, not a crab.`];
}

export function stationBrief(input = {}) {
  const {
    loc = {},
    patch = null,
    hour = 12,
    look = {},
    storm = false,
    census = [],
    sharks = [],
    floorY = -200,
    spanLabel = "1000 m",
    sst = null,
    mixedY = -40,
    nutriclineY = -80,
    omzCoreY = null,
    upwell = 0,
    photicY = -180,
    o2Cam = null,
    parPct = null,
    meanP = 0,
    meanZ = 0,
    meanB = 0,
    meanI = 0,
    meanBedP = 0,
    forageCount = 0,
    forageCap = 0,
    ice = 0,
    iceH = 0,
    iceT = 1,
    cameraLabel = "Free roam",
    fps = null,
    lat = 0,
    lon = 0,
  } = input;

  const demo = patch?.demoId ? demoById(patch.demoId) : null;
  const phase = look.name || "Day";
  const weather = storm ? "Storm" : "Calm";
  const title = loc.region || loc.name || formatLatLon(lat, lon);
  const kicker = demo?.kicker
    ? `${demo.kicker} · ${formatLatLon(lat, lon)}`
    : `${spanLabel} cell · ${formatLatLon(lat, lon)}`;

  const now = [
    ...columnLines({
      floorY,
      photicY,
      mixedY,
      nutriclineY,
      omzCoreY,
      upwell,
      storm,
      meanP,
      meanZ,
      forageCount,
      forageCap,
      ice,
      iceH,
      iceT,
    }),
    ...schoolNow(census, phase, omzCoreY, floorY, ice),
    ...vehicleNow(census, sharks, phase, omzCoreY, floorY),
    ...fieldNow(census, meanB, meanI, meanBedP),
  ];

  const column = [
    { id: "floor", label: "Floor", value: `${metres(floorY)} m` },
    { id: "photic", label: "1% light", value: `${metres(photicY)} m` },
    { id: "mld", label: "Mixed layer", value: `${metres(mixedY)} m` },
    { id: "nutricline", label: "Nutricline", value: `${metres(nutriclineY)} m` },
    Number.isFinite(sst) ? { id: "sst", label: "SST", value: `${Number(sst).toFixed(1)} °C` } : null,
    Number.isFinite(o2Cam) ? { id: "o2", label: "O₂ here", value: `${Number(o2Cam).toFixed(1)} ml/L` } : null,
    Number.isFinite(parPct) ? { id: "par", label: "PAR here", value: `${Math.round(parPct)}%` } : null,
    Number.isFinite(omzCoreY)
      ? { id: "omz", label: "OMZ core", value: `${metres(omzCoreY)} m` }
      : { id: "omz", label: "OMZ", value: "None" },
    (ice ?? 0) > 0.04
      ? { id: "ice", label: "Sea ice", value: `${Math.round(ice * 100)}%` }
      : { id: "ice", label: "Sea ice", value: "None" },
  ].filter(Boolean);

  const missing = (demo?.missing || []).slice();
  if (patch?.note) missing.unshift(patch.note);

  return {
    kicker,
    title,
    meta: `${clockText(hour)} · ${phase} · ${weather}`,
    lead: loc.about || demo?.about || "",
    now,
    column,
    missing,
    attr: fps != null
      ? `Census (I) lists every name · ${cameraLabel} · ${fps} fps`
      : `Census (I) lists every name · ${cameraLabel}`,
  };
}
