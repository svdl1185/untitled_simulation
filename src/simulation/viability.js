/**
 * Time series of the live budgets: headcount, energy, grazing, bites.
 * Diagnose() flags programs that go extinct, never eat, boom, or hold
 * energy without a meal — the Lotka–Volterra readout for this cell.
 */
import { CONFIG, faunaPresent } from "../config.js";
import { PRESENCE_IDS, SPECIES, vehicleCfg, schoolDiet, knobsFor, namedPreyIds } from "../world/fauna.js";
import { FAUNA } from "../world/fieldNotes.js";

export const SEVERITY = {
  fail: 4,
  look: 3,
  watch: 2,
  ok: 1,
  wait: 0,
};

/** How to read a flag: knob/wiring vs honest empty habitat vs a named gap. */
export const VERDICT_RANK = {
  fail: 5,
  tweak: 4,
  gap: 3,
  watch: 2,
  expected: 2,
  ok: 1,
  wait: 0,
};

const SERIES_COLORS = [
  "#7fd8cf",
  "#e2c07a",
  "#d9897a",
  "#8fb4e8",
  "#b89be4",
  "#8ecf9a",
  "#e0a56b",
  "#7ec4d8",
  "#d4a0b8",
  "#c5c98a",
  "#9aa7c2",
  "#d9b08c",
];

export function colorFor(id) {
  const i = Math.max(0, PRESENCE_IDS.indexOf(id));
  return SERIES_COLORS[i % SERIES_COLORS.length];
}

export function catalogRow(id) {
  const spec = SPECIES[id];
  const note = FAUNA[id];
  const vehicle = spec?.agent === "vehicle" ? vehicleCfg(id) : null;
  const fish = spec?.agent === "school" ? knobsFor(id) : null;
  const huntTaxa = vehicle?.huntTaxa || fish?.huntTaxa || null;
  const huntKinds = vehicle?.huntKinds || fish?.huntKinds || null;
  return {
    id,
    common: note?.common || spec?.label || id,
    latin: note?.latin || "",
    guild: note?.guild || spec?.guild || "",
    agent: spec?.agent || "school",
    diet: vehicle?.diet || (fish ? schoolDiet(fish) : "z"),
    huntTaxa,
    huntKinds,
    namedPrey: namedPreyIds(id),
    missing: note?.missing || [],
    maxDepth: vehicle?.maxDepth ?? fish?.maxDepth ?? 0,
    forageDepth: vehicle?.forageDepth ?? fish?.dayDepth ?? 0,
    energyDrain: vehicle?.energyDrain ?? spec?.fish?.metabolism ?? 0,
  };
}

export function fullCatalog() {
  return PRESENCE_IDS.filter((id) => SPECIES[id]?.agent !== "field").map(catalogRow);
}

function emptyEvents() {
  return { born: 0, starved: 0, eaten: 0 };
}

function last(arr) {
  return arr.length ? arr[arr.length - 1] : 0;
}

function first(arr) {
  return arr.length ? arr[0] : 0;
}

function maxOf(arr) {
  let m = 0;
  for (let i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i];
  return m;
}

function meanTail(arr, n = 6) {
  if (!arr.length) return 0;
  const start = Math.max(0, arr.length - n);
  let s = 0;
  let k = 0;
  for (let i = start; i < arr.length; i++) {
    s += arr[i];
    k++;
  }
  return k ? s / k : 0;
}

function preyPresent(row, liveIds) {
  const taxa = row.huntTaxa;
  const kinds = row.huntKinds;
  if (taxa?.length) {
    if (taxa.some((id) => liveIds.has(id))) return true;
  }
  if (kinds?.length) {
    if (kinds.some((id) => liveIds.has(id))) return true;
  }
  if (row.agent === "vehicle" && row.diet === "bite" && !taxa?.length && !kinds?.length) {
    for (const id of liveIds) {
      if (SPECIES[id]?.agent === "school") return true;
    }
  }
  if (row.agent === "school" && (row.diet === "bite" || row.diet === "both") && !taxa?.length) {
    for (const id of liveIds) {
      if (SPECIES[id]?.agent === "school" && id !== row.id) return true;
    }
  }
  return false;
}

export function copyDiet(src) {
  const out = Object.create(null);
  if (!src) return out;
  for (const [k, v] of Object.entries(src)) {
    if (v > 0) out[k] = v;
  }
  return out;
}

export function dietMeals(diet, ids) {
  if (!diet || !ids?.length) return 0;
  let n = 0;
  for (const id of ids) n += diet[id] || 0;
  return n;
}

export function formatDiet(diet) {
  const entries = Object.entries(diet || {}).filter(([, n]) => n > 0);
  entries.sort((a, b) => b[1] - a[1]);
  if (!entries.length) return "no meals";
  return entries
    .map(([id, n]) => {
      const name = id === "z" ? "zooplankton" : id === "p" ? "phytoplankton" : FAUNA[id]?.common || id;
      return `${name} ${n}`;
    })
    .join(", ");
}

export function depthOverlapM(aMin, aMax, bMin, bMax) {
  const aLo = Math.min(aMin || 0, aMax || 0);
  const aHi = Math.max(aMin || 0, aMax || 0);
  const bLo = Math.min(bMin || 0, bMax || 0);
  const bHi = Math.max(bMin || 0, bMax || 0);
  if (aHi <= 0 && aLo <= 0) return 0;
  if (bHi <= 0 && bLo <= 0) return 0;
  const lo = Math.max(aLo, bLo);
  const hi = Math.min(aHi, bHi);
  return Math.max(0, hi - lo);
}

function preyBuckets(row, liveIds, everAlive) {
  const wanted = row.namedPrey?.length ? row.namedPrey : [...(row.huntTaxa || []), ...(row.huntKinds || [])];
  const habitat = [];
  const alive = [];
  const missing = [];
  for (const id of wanted) {
    const inHabitat = liveIds.has(id);
    const wasAlive = everAlive.has(id);
    if (wasAlive) alive.push(id);
    if (inHabitat) habitat.push(id);
    if (!inHabitat && !wasAlive) missing.push(id);
  }
  return { wanted, habitat, alive, missing };
}

/**
 * Rank one species' trace. Pure: feed it arrays, get flags.
 * `days` is recorded sim time, not wall clock.
 * Optional `diet` / `everAlive` distinguish "ate lanternfish, never giant squid"
 * from "prey was never in this cell".
 */
export function diagnoseSpecies(row, series, ctx = {}) {
  const flags = [];
  const days = ctx.days ?? 0;
  const n = series?.n || [];
  const energy = series?.energy || [];
  const graze = series?.graze || [];
  const meals = series?.meals || [];
  const born = series?.born || [];
  const starved = series?.starved || [];
  const eaten = series?.eaten || [];
  if (!n.length || days < 0.05) {
    return {
      id: row.id,
      status: "wait",
      flags: [{ code: "wait", severity: "wait", text: "Waiting for samples." }],
    };
  }

  const nowN = last(n);
  const startN = ctx.firstN != null ? ctx.firstN : first(n);
  if (startN <= 0 && nowN <= 0) {
    return {
      id: row.id,
      status: "wait",
      flags: [{ code: "absent", severity: "wait", text: "Not in this cell." }],
    };
  }
  const peak = Math.max(ctx.peakN ?? 0, maxOf(n));
  const eNow = meanTail(energy, 8);
  const eStart = first(energy);
  const mealsN = last(meals);
  const grazeN = last(graze);
  const bornN = last(born);
  const starvedN = last(starved);
  const eatenN = last(eaten);
  const liveIds = ctx.liveIds || new Set();
  const everAlive = ctx.everAlive || liveIds;
  const diet = ctx.diet || {};
  const school = row.agent === "school";
  const filter = row.diet === "filter" || row.diet === "p" || row.diet === "both";
  const biter = row.diet === "bite" || row.diet === "both";
  const habitatPrey = preyPresent(row, liveIds);
  const alivePrey = preyPresent(row, everAlive);
  const buckets = preyBuckets(row, liveIds, everAlive);

  if (startN > 0 && nowN <= 0) {
    let text = `Gone by day ${days.toFixed(2)}.`;
    if (starvedN > eatenN && starvedN > 0) {
      text += ` Starved ${starvedN.toLocaleString()} vs eaten ${eatenN.toLocaleString()}.`;
    } else if (eatenN > starvedN && eatenN > 0) {
      text += ` Eaten ${eatenN.toLocaleString()} vs starved ${starvedN.toLocaleString()}.`;
    } else {
      text += " Died off, starved, or was eaten out.";
    }
    flags.push({
      code: "extinct",
      severity: "fail",
      text,
    });
  } else if (startN >= 8 && nowN > 0 && nowN < startN * 0.35) {
    flags.push({
      code: "crash",
      severity: "look",
      text: `Down ${Math.round((1 - nowN / startN) * 100)}% from the start (${startN.toLocaleString()} → ${nowN.toLocaleString()}).`,
    });
  }

  if (nowN > 0 && days > 0.2 && eNow < 0.16) {
    flags.push({
      code: "starving",
      severity: "look",
      text: `Mean energy ${Math.round(eNow * 100)}%. Metabolism is winning.`,
    });
  }

  if (school && !biter && nowN > 0 && days > 0.35 && grazeN <= 1e-6) {
    flags.push({
      code: "not-grazing",
      severity: "fail",
      text: "No Type II pull on the bloom. This shoal is not eating.",
    });
  }

  if (school && biter && nowN > 0 && days > 0.45) {
    const ate = mealsN > 0 || grazeN > 1e-5;
    if (!ate && !alivePrey && !habitatPrey) {
      flags.push({
        code: "no-prey",
        severity: "watch",
        text: "Named prey is not in this cell. Starvation is the programmed budget, not a missing meal cheat.",
      });
    } else if (!ate && habitatPrey && !alivePrey) {
      flags.push({
        code: "prey-never-spawned",
        severity: "look",
        text: "Range puts named prey in this cell, but none ever had a live agent. Spawn or floor gate, not a meal cheat.",
      });
    } else if (!ate && alivePrey) {
      flags.push({
        code: "not-eating",
        severity: "look",
        text: "Prey is present but this hashed-grid piscivore has not landed a meal.",
      });
    }
  }

  if (!school && nowN > 0 && days > 0.45) {
    const ate = mealsN > 0 || grazeN > 1e-5;
    if (!ate && !alivePrey && !habitatPrey && biter) {
      flags.push({
        code: "no-prey",
        severity: "watch",
        text: "Named prey is not in this cell. Starvation is the programmed budget, not a missing meal cheat.",
      });
    } else if (!ate && habitatPrey && !alivePrey && biter) {
      flags.push({
        code: "prey-never-spawned",
        severity: "look",
        text: "Range puts named prey in this cell, but none ever had a live agent. Spawn or floor gate, not a meal cheat.",
      });
    } else if (!ate && alivePrey && biter) {
      flags.push({
        code: "not-eating",
        severity: "look",
        text: "Prey is present but this vehicle has not landed a meal.",
      });
    } else if (!ate && filter) {
      flags.push({
        code: "not-filtering",
        severity: "look",
        text: "Filter graze has taken nothing from z.",
      });
    }
  }

  if (row.huntKinds?.length && (nowN > 0 || startN > 0) && days > 1.0) {
    const kindAlive = row.huntKinds.filter((id) => everAlive.has(id));
    const kindMeals = dietMeals(diet, row.huntKinds);
    const taxaMeals = dietMeals(diet, row.huntTaxa);
    if (kindAlive.length && kindMeals === 0 && (mealsN > 0 || taxaMeals > 0)) {
      const names = kindAlive.map((id) => FAUNA[id]?.common || id).join(", ");
      flags.push({
        code: "hunt-kinds-idle",
        severity: eNow < 0.35 ? "look" : "watch",
        text: `Ate smaller named prey (${formatDiet(diet)}) but never bit ${names} even though that vehicle lived in the cell. Depth overlap or detect may be thin — or the larger prey is rare enough that smaller meals dominate.`,
      });
    }
  }

  if (nowN > 0 && days > 0.7 && mealsN <= 0 && grazeN <= 1e-6 && eNow > 0.62 && eNow >= eStart - 0.04) {
    flags.push({
      code: "unearned",
      severity: "fail",
      text: "Energy is holding without meals. Check drain — this looks like fake fullness.",
    });
  }

  if (school && nowN > 0 && days > 0.7 && bornN === 0 && eNow > 0.5 && nowN < peak * 0.9 && nowN >= 16) {
    flags.push({
      code: "no-recruit",
      severity: "watch",
      text: "No recruits yet while energy is decent. May be bloom-capped or sex-split.",
    });
  }

  if (nowN > 0 && startN > 0 && nowN > startN * 2.4 && eNow > 0.62 && bornN > startN * 0.8) {
    flags.push({
      code: "boom",
      severity: "watch",
      text: `Headcount ×${(nowN / startN).toFixed(1)} with high energy. Recruitment may be cheap.`,
    });
  }

  if (!school && nowN > 0 && days > 1.2 && bornN > Math.max(4, startN * 2) && days < 8) {
    flags.push({
      code: "pup-boom",
      severity: "look",
      text: `${bornN} pups in ${days.toFixed(1)} days. Year-timer recruit is firing too often.`,
    });
  }

  if (starvedN > 0 && nowN > 0 && starvedN > Math.max(8, startN * 0.4) && school) {
    flags.push({
      code: "starve-cull",
      severity: "watch",
      text: `${starvedN.toLocaleString()} starved out. Over the bloom cap or not finding z.`,
    });
  }

  if (!flags.length) {
    const eatenTxt = school
      ? "grazing"
      : mealsN > 0
        ? `${mealsN} meals (${formatDiet(diet)})`
        : filter && grazeN > 0
          ? "filtering"
          : "no meals yet";
    flags.push({
      code: "ok",
      severity: "ok",
      text: `${nowN.toLocaleString()} live · energy ${Math.round(eNow * 100)}% · ${eatenTxt}.`,
    });
  }

  let status = "ok";
  let best = -1;
  for (const f of flags) {
    const s = SEVERITY[f.severity] ?? 0;
    if (s > best) {
      best = s;
      status = f.severity;
    }
  }
  return { id: row.id, status, flags, buckets };
}

/**
 * Read flags as a verdict: tweak the program, name a gap, or accept the habitat.
 */
export function verdictOf(report, ctx = {}) {
  const codes = new Set((report.flags || []).map((f) => f.code));
  const missing = ctx.missingNotes || report.missing || FAUNA[report.id]?.missing || [];
  const preyAlive = ctx.preyAlive || report.preyAlive || [];
  const mealsNow = ctx.mealsNow ?? report.mealsNow ?? 0;
  const top = report.flags?.find((f) => f.severity === report.status) || report.flags?.[0];

  if (codes.has("wait") || codes.has("absent")) {
    return {
      verdict: "expected",
      why: "Not in this cell — range, floor, or trophic gate. Empty is honest.",
    };
  }
  if (codes.has("unearned")) {
    return {
      verdict: "fail",
      why: "Energy without meals — fake fullness, not a habitat story.",
    };
  }
  if (codes.has("not-grazing")) {
    return {
      verdict: "fail",
      why: "Grazer never pulled on the bloom. Wiring or depth, not a missing taxon.",
    };
  }
  if (codes.has("no-prey")) {
    const gap = missing[0] ? ` Card already names a gap: ${missing[0]}` : "";
    return {
      verdict: "expected",
      why: `Named prey is not in this cell. Starvation is the programmed budget.${gap}`,
    };
  }
  if (codes.has("prey-never-spawned")) {
    return {
      verdict: "tweak",
      why: "The range says prey belongs here, but no agent ever spawned. Check floor, OMZ, or count gates.",
    };
  }
  if (codes.has("not-eating") || codes.has("not-filtering")) {
    return {
      verdict: "tweak",
      why: "Food is in the cell but this animal has not landed a meal. Overlap, detect, or rates need a look.",
    };
  }
  if (codes.has("extinct")) {
    if (preyAlive.length && mealsNow <= 0) {
      return {
        verdict: "tweak",
        why: "Died with prey in the cell and no meals — coupling or knobs, not an honest empty habitat.",
      };
    }
    if (!preyAlive.length && missing.length) {
      return {
        verdict: "gap",
        why: `Died, and the card already names a missing mechanic: ${missing[0]}`,
      };
    }
    if (!preyAlive.length) {
      return {
        verdict: "expected",
        why: "Died in a cell that does not hold its food. That is the programmed starve.",
      };
    }
    return {
      verdict: "tweak",
      why: "Died despite some meals. Drain versus intake, or recruitment, needs a look.",
    };
  }
  if (codes.has("hunt-kinds-idle") && (codes.has("starving") || codes.has("crash") || report.status === "look")) {
    return {
      verdict: "tweak",
      why: top?.text || "Ate smaller prey, never the huntKinds vehicle, and energy is failing.",
    };
  }
  if (codes.has("hunt-kinds-idle")) {
    return {
      verdict: "watch",
      why: top?.text || "Ate smaller named prey; the larger huntKinds vehicle lived here and was never bitten.",
    };
  }
  if (codes.has("starving") || codes.has("crash")) {
    return {
      verdict: "tweak",
      why: top?.text || "Still alive but crashing or starving with the cell's food in play.",
    };
  }
  if (report.status === "ok") {
    return { verdict: "ok", why: top?.text || "Alive, eating, energy holding." };
  }
  return { verdict: report.status === "look" ? "tweak" : report.status, why: top?.text || "" };
}

function blankSeries() {
  return {
    n: [],
    energy: [],
    hungry: [],
    graze: [],
    meals: [],
    born: [],
    starved: [],
    eaten: [],
    energyIn: [],
    yDeep: [],
    yShallow: [],
  };
}

export class ViabilityLog {
  constructor() {
    this.reset();
    this.timeScale = 1;
    this.selected = new Set(PRESENCE_IDS);
  }

  reset() {
    this.t = 0;
    this._acc = 0;
    this.samples = [];
    this.series = {};
    this.meta = {};
    this.bloom = { p: [], z: [], n: [], d: [] };
    this.time = [];
    this.vehicleEvents = {};
    this.started = false;
    this.diet = {};
    this.everAlive = new Set();
  }

  selectAll() {
    this.selected = new Set(PRESENCE_IDS);
  }

  selectIds(ids) {
    this.selected = new Set(ids);
  }

  selectedList() {
    return PRESENCE_IDS.filter((id) => this.selected.has(id));
  }

  noteVehicleExit(s) {
    const id = s.kind || "shark";
    const row = this.vehicleEvents[id] || (this.vehicleEvents[id] = emptyEvents());
    if (s.cause === "eaten") row.eaten++;
    else row.starved++;
  }

  noteVehicleBirth(kind) {
    const row = this.vehicleEvents[kind] || (this.vehicleEvents[kind] = emptyEvents());
    row.born++;
  }

  tick(dt, world) {
    if (dt <= 0) return;
    this.t += dt;
    this._acc += dt;
    const every = CONFIG.viability?.sampleDt ?? 2;
    if (!this.started || this._acc >= every) {
      this._acc = this.started ? this._acc - every : 0;
      this.started = true;
      this.sample(world);
    }
  }

  sample(world) {
    const { school, sharks, plankton } = world || {};
    const t = this.t;
    const max = CONFIG.viability?.maxSamples ?? 1800;
    if (this.time.length >= max) {
      this.time.shift();
      this.bloom.p.shift();
      this.bloom.z.shift();
      this.bloom.n.shift();
      this.bloom.d.shift();
      for (const s of Object.values(this.series)) {
        for (const k of Object.keys(s)) s[k].shift();
      }
    }
    this.time.push(t);
    this.bloom.p.push(plankton?.meanP ?? 0);
    this.bloom.z.push(plankton?.meanZ ?? 0);
    this.bloom.n.push(plankton?.meanN ?? 0);
    this.bloom.d.push(plankton?.meanD ?? 0);

    const tally = school?.taxonTally?.() || {};
    const pack = sharks || [];
    const vehicle = {};
    for (const s of pack) {
      const id = s.kind || "shark";
      let v = vehicle[id];
      if (!v) {
        v = vehicle[id] = {
          n: 0,
          energy: 0,
          hungry: 0,
          meals: 0,
          graze: 0,
          energyIn: 0,
          yDeep: 1e9,
          yShallow: -1e9,
          diet: Object.create(null),
        };
      }
      const cfg = s.cfg || vehicleCfg(id);
      v.n++;
      v.energy += s.energy || 0;
      if ((s.energy || 0) < (cfg.starveAt ?? 0.06)) v.hungry++;
      v.meals += (s.eaten || 0) + (s.filterMeals || 0);
      v.graze += s.filterTaken || 0;
      v.energyIn += s.energyIn || 0;
      if ((s.yDeep ?? s.y) < v.yDeep) v.yDeep = s.yDeep ?? s.y;
      if ((s.yShallow ?? s.y) > v.yShallow) v.yShallow = s.yShallow ?? s.y;
      const meals = s.dietOf;
      if (meals) {
        for (const [prey, n] of Object.entries(meals)) {
          v.diet[prey] = (v.diet[prey] || 0) + n;
        }
      }
    }

    for (const id of PRESENCE_IDS) {
      if (SPECIES[id]?.agent === "field") continue;
      if (!this.selected.has(id) && !faunaPresent(id) && !tally[id] && !vehicle[id]) continue;
      let s = this.series[id];
      if (!s) s = this.series[id] = blankSeries();
      const spec = SPECIES[id];
      if (spec?.agent === "vehicle") {
        const v = vehicle[id] || { n: 0, energy: 0, hungry: 0, meals: 0, graze: 0, energyIn: 0 };
        const ev = this.vehicleEvents[id] || emptyEvents();
        s.n.push(v.n);
        s.energy.push(v.n ? v.energy / v.n : 0);
        s.hungry.push(v.hungry);
        s.meals.push(v.meals);
        s.graze.push(v.graze);
        s.born.push(ev.born);
        s.starved.push(ev.starved);
        s.eaten.push(ev.eaten);
        s.energyIn.push(v.energyIn);
        s.yDeep.push(v.n && v.yDeep < 1e8 ? v.yDeep : 0);
        s.yShallow.push(v.n && v.yShallow > -1e8 ? v.yShallow : 0);
        if (v.n > 0) this.everAlive.add(id);
        this.diet[id] = copyDiet(v.diet);
      } else {
        const row = tally[id] || {
          n: 0,
          energy: 0,
          hungry: 0,
          graze: 0,
          born: 0,
          starved: 0,
          eaten: 0,
          yDeep: 0,
          yShallow: 0,
          diet: null,
        };
        s.n.push(row.n);
        s.energy.push(row.energy);
        s.hungry.push(row.hungry);
        s.graze.push(row.graze);
        s.meals.push(row.meals || 0);
        s.born.push(row.born);
        s.starved.push(row.starved);
        s.eaten.push(row.eaten);
        s.energyIn.push(row.graze);
        s.yDeep.push(row.yDeep || 0);
        s.yShallow.push(row.yShallow || 0);
        if (row.n > 0) this.everAlive.add(id);
        this.diet[id] = copyDiet(row.diet);
      }
      this._touchMeta(id, s);
    }
  }

  _touchMeta(id, s) {
    const nn = last(s.n);
    const yDeep = last(s.yDeep);
    const yShallow = last(s.yShallow);
    let m = this.meta[id];
    if (!m) {
      m = this.meta[id] = {
        firstN: nn,
        peakN: nn,
        yDeep: nn > 0 && yDeep < 0 ? yDeep : 1e9,
        yShallow: nn > 0 && yShallow < 0 ? yShallow : -1e9,
      };
      return;
    }
    if (nn > m.peakN) m.peakN = nn;
    if (nn > 0 && yDeep < m.yDeep) m.yDeep = yDeep;
    if (nn > 0 && yShallow > m.yShallow) m.yShallow = yShallow;
  }

  days() {
    const day = CONFIG.time.dayLength || 480;
    return this.t / day;
  }

  liveIds(world) {
    const ids = new Set();
    const school = world?.school;
    if (school?.taxa) {
      for (const t of school.taxa) ids.add(t.id);
    }
    for (const s of world?.sharks || []) ids.add(s.kind || "shark");
    for (const id of PRESENCE_IDS) {
      if (faunaPresent(id)) ids.add(id);
    }
    return ids;
  }

  reports(world) {
    const days = this.days();
    const liveIds = this.liveIds(world);
    const everAlive = this.everAlive;
    const depths = {};
    const out = [];
    for (const id of PRESENCE_IDS) {
      if (SPECIES[id]?.agent === "field") continue;
      if (!this.selected.has(id)) continue;
      const series = this.series[id];
      if (!series && !faunaPresent(id) && !liveIds.has(id) && !everAlive.has(id)) continue;
      const row = catalogRow(id);
      const meta = this.meta[id] || {};
      const diet = this.diet[id] || {};
      const report = diagnoseSpecies(row, series || blankSeries(), {
        days,
        liveIds,
        everAlive,
        diet,
        firstN: meta.firstN,
        peakN: meta.peakN,
      });
      const yDeep = meta.yDeep < 1e8 ? meta.yDeep : series?.yDeep?.length ? last(series.yDeep) : 0;
      const yShallow =
        meta.yShallow > -1e8 ? meta.yShallow : series?.yShallow?.length ? last(series.yShallow) : 0;
      const depthMaxM = yDeep < 0 ? -yDeep : 0;
      const depthMinM = yShallow < 0 ? -yShallow : 0;
      depths[id] = { minM: depthMinM, maxM: depthMaxM };
      const preyAlive = (report.buckets?.alive || []).slice();
      const preyHabitat = (report.buckets?.habitat || []).slice();
      const preyMissing = (report.buckets?.missing || []).slice();
      const mealsNow = series?.meals?.length ? series.meals[series.meals.length - 1] : 0;
      const packed = {
        ...row,
        ...report,
        color: colorFor(id),
        firstN: meta.firstN ?? 0,
        peakN: meta.peakN ?? 0,
        depthMaxM,
        depthMinM,
        nNow: series?.n?.length ? series.n[series.n.length - 1] : 0,
        energyNow: series?.energy?.length ? series.energy[series.energy.length - 1] : 0,
        mealsNow,
        grazeNow: series?.graze?.length ? series.graze[series.graze.length - 1] : 0,
        bornNow: series?.born?.length ? series.born[series.born.length - 1] : 0,
        starvedNow: series?.starved?.length ? series.starved[series.starved.length - 1] : 0,
        eatenNow: series?.eaten?.length ? series.eaten[series.eaten.length - 1] : 0,
        mealsByPrey: diet,
        dietText: formatDiet(diet),
        preyAlive,
        preyHabitat,
        preyMissing,
        huntTaxaMeals: dietMeals(diet, row.huntTaxa),
        huntKindsMeals: dietMeals(diet, row.huntKinds),
      };
      const judged = verdictOf(packed, {
        missingNotes: row.missing,
        preyAlive,
        mealsNow,
      });
      packed.verdict = judged.verdict;
      packed.why = judged.why;
      out.push(packed);
    }
    for (const r of out) {
      r.preyOverlap = [];
      for (const pid of r.namedPrey || []) {
        const prey = depths[pid];
        if (!prey) continue;
        const overlapM = depthOverlapM(r.depthMinM, r.depthMaxM, prey.minM, prey.maxM);
        r.preyOverlap.push({
          id: pid,
          common: FAUNA[pid]?.common || pid,
          preyMinM: prey.minM,
          preyMaxM: prey.maxM,
          overlapM,
        });
      }
    }
    out.sort((a, b) => {
      const dv = (VERDICT_RANK[b.verdict] || 0) - (VERDICT_RANK[a.verdict] || 0);
      if (dv) return dv;
      const ds = (SEVERITY[b.status] || 0) - (SEVERITY[a.status] || 0);
      if (ds) return ds;
      return a.common.localeCompare(b.common);
    });
    return out;
  }

  summary(reports) {
    const counts = { fail: 0, look: 0, watch: 0, ok: 0, wait: 0 };
    const verdicts = { fail: 0, tweak: 0, gap: 0, watch: 0, expected: 0, ok: 0 };
    for (const r of reports) {
      counts[r.status] = (counts[r.status] || 0) + 1;
      if (r.verdict) verdicts[r.verdict] = (verdicts[r.verdict] || 0) + 1;
    }
    return { ...counts, verdicts };
  }
}
