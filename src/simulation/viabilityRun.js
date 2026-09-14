/**
 * Headless Lotka–Volterra run of a named cell. No renderer.
 * Walks every present catalog id. Diet is counted by prey, so a sperm
 * whale that only eats lanternfish while giant squid live in the cell
 * shows up as hunt-kinds-idle, not a silent OK.
 *
 *   node src/simulation/viabilityRun.js
 *   node src/simulation/viabilityRun.js --cell omz --days 3
 *   node src/simulation/viabilityRun.js --cell all --days 3 --fish 4000
 *   node src/simulation/viabilityRun.js --cell catalog --species spermwhale,giantsquid --days 7
 *   node src/simulation/viabilityRun.js --cell pelagic --json --out /tmp/pelagic.json
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CONFIG, faunaPresent, anySchoolPresent } from "../config.js";
import { VEHICLE_IDS, PRESENCE_IDS, SPECIES, vehicleCfg } from "../world/fauna.js";
import { FAUNA } from "../world/fieldNotes.js";
import { DEMO_CELLS, demoById, coupledDemoIds, allDemoIds, makeDemoPatch } from "../world/demos.js";
import { applyPatch } from "../world/patch.js";
import { School } from "./school.js";
import { spawnPredators, tryBreed } from "./shark.js";
import { Plankton } from "./plankton.js";
import { DayCycle } from "./day.js";
import { ViabilityLog, formatDiet, VERDICT_RANK } from "./viability.js";

const EMPTY_INPUT = { mouseDx: 0, mouseDy: 0 };

function cellInfo(demo, patch) {
  return {
    id: demo?.id || patch?.demoId || "catalog",
    title: demo?.title || patch?.name || "Catalog tank",
    region: demo?.region || "",
    kind: demo?.kind || (CONFIG.world.lab ? "lab" : "atlas"),
    status: demo?.status || "coupled",
    lat: CONFIG.world.lat,
    lon: CONFIG.world.lon,
    floorY: CONFIG.floorY,
    missing: demo?.missing || [],
    about: demo?.about || "",
  };
}

function predatorCounts() {
  const predCounts = {};
  for (const id of VEHICLE_IDS) {
    if (!faunaPresent(id)) continue;
    const cfg = vehicleCfg(id);
    const n = cfg.count || 1;
    predCounts[id] = CONFIG.world.lab
      ? Math.min(cfg.max ?? 2, Math.max(2, n))
      : Math.min(cfg.max ?? n, n);
  }
  return predCounts;
}

function resolveCellIds(opts) {
  const raw = opts.cell || opts.place || "catalog";
  if (raw === "lab") return ["catalog"];
  if (raw === "all") return opts.gaps ? allDemoIds() : coupledDemoIds();
  if (raw === "coupled") return coupledDemoIds();
  const demo = demoById(raw);
  if (!demo) {
    const known = DEMO_CELLS.map((d) => d.id).join(", ");
    throw new Error(`Unknown cell "${raw}". Coupled: ${coupledDemoIds().join(", ")}. All: ${known}.`);
  }
  return [demo.id];
}

export function runViability(opts = {}) {
  const ids = resolveCellIds(opts);
  if (ids.length === 1) return runOneCell(ids[0], opts);
  const cells = [];
  for (const id of ids) {
    cells.push(runOneCell(id, opts));
  }
  return {
    place: "all",
    cell: { id: "all", title: opts.gaps ? "Every named cell" : "Coupled cells" },
    days: opts.days,
    cells,
    reports: flattenFocus(cells, opts.species),
    summary: mergeSummaries(cells),
  };
}

function flattenFocus(cells, species) {
  const want = speciesSet(species);
  const out = [];
  for (const cell of cells) {
    for (const r of cell.reports) {
      if (want && !want.has(r.id)) continue;
      out.push({ ...r, cellId: cell.cell?.id, cellTitle: cell.cell?.title });
    }
  }
  out.sort((a, b) => (VERDICT_RANK[b.verdict] || 0) - (VERDICT_RANK[a.verdict] || 0));
  return out;
}

function mergeSummaries(cells) {
  const counts = { fail: 0, look: 0, watch: 0, ok: 0, wait: 0 };
  const verdicts = { fail: 0, tweak: 0, gap: 0, watch: 0, expected: 0, ok: 0 };
  for (const cell of cells) {
    const s = cell.summary || {};
    for (const k of Object.keys(counts)) counts[k] += s[k] || 0;
    const v = s.verdicts || {};
    for (const k of Object.keys(verdicts)) verdicts[k] += v[k] || 0;
  }
  return { ...counts, verdicts };
}

function speciesSet(species) {
  if (!species) return null;
  const list = Array.isArray(species) ? species : String(species).split(",");
  const ids = list.map((s) => String(s).trim()).filter(Boolean);
  return ids.length ? new Set(ids) : null;
}

export function runOneCell(cellId, opts = {}) {
  const daysWanted = Math.max(0.05, Number(opts.days) || 3);
  const dt = Math.max(0.02, Number(opts.dt) || 0.08);
  const demo = demoById(cellId);
  const patch = makeDemoPatch(demo);
  applyPatch(patch);
  if (opts.fish != null) CONFIG.initialFish = Math.max(0, opts.fish | 0);
  const sampleDt = CONFIG.viability?.sampleDt ?? 2;
  CONFIG.viability.maxSamples = Math.ceil((daysWanted * CONFIG.time.dayLength) / sampleDt) + 32;

  const day = new DayCycle();
  day.auto = true;
  day.latitude = CONFIG.world.lat;
  day.sample();
  const fishN = anySchoolPresent() ? Number(opts.fish ?? CONFIG.initialFish) : 0;
  const school = new School(fishN, { hour: day.look.hour });
  const plankton = new Plankton();
  school.clipToBloom(plankton);
  const sharks = spawnPredators(school, predatorCounts());
  const log = new ViabilityLog();
  const present = PRESENCE_IDS.filter((id) => faunaPresent(id) && SPECIES[id]?.agent !== "field");
  log.selectIds(present);

  const total = daysWanted * CONFIG.time.dayLength;
  let simClock = 0;
  let nextNote = CONFIG.time.dayLength;
  const onProgress = opts.onProgress;
  while (simClock < total) {
    simClock += dt;
    day.update(dt);
    const tod = day.look;
    tod.simTime = simClock;
    for (let i = 0; i < sharks.length; i++) {
      sharks[i].update(dt, EMPTY_INPUT, school, tod, sharks);
    }
    school.update(dt, sharks, tod, plankton);
    for (let i = sharks.length - 1; i >= 0; i--) {
      if (!sharks[i].dead) continue;
      log.noteVehicleExit(sharks[i]);
      plankton.recycle(sharks[i].x, sharks[i].z, sharks[i].cfg?.carcass ?? CONFIG.shark.carcass, sharks[i].y);
      sharks.splice(i, 1);
    }
    const pup = tryBreed(sharks);
    if (pup) {
      log.noteVehicleBirth(pup.kind);
      sharks.push(pup);
    }
    plankton.update(dt, tod, simClock);
    log.tick(dt, { school, sharks, plankton, day });
    if (onProgress && simClock >= nextNote) {
      onProgress(simClock / CONFIG.time.dayLength, { school, sharks, plankton, log, cell: demo?.id });
      nextNote += CONFIG.time.dayLength;
    }
  }

  const world = { school, sharks, plankton, day };
  let reports = log.reports(world);
  const focus = speciesSet(opts.species);
  if (focus) reports = reports.filter((r) => focus.has(r.id));
  const cell = cellInfo(demo, patch);
  return {
    place: cell.id,
    cell,
    days: log.days(),
    dt,
    fishCap: fishN,
    meanP: plankton.meanP,
    meanZ: plankton.meanZ,
    meanN: plankton.meanN,
    meanD: plankton.meanD,
    schoolCount: school.count,
    predatorCount: sharks.length,
    present,
    reports,
    summary: log.summary(reports),
    world,
    log,
  };
}

function pad(s, n) {
  s = String(s ?? "");
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

function formatOverlap(r) {
  if (!r.preyOverlap?.length) return "";
  const bits = r.preyOverlap.map((p) => {
    const band = `${p.preyMinM.toFixed(0)}–${p.preyMaxM.toFixed(0)} m`;
    const hit = p.overlapM > 4 ? `overlap ${p.overlapM.toFixed(0)} m` : "no depth overlap";
    return `${p.common} ${band} (${hit})`;
  });
  return bits.join("; ");
}

export function formatReport(result) {
  if (result.cells) {
    const parts = result.cells.map((c) => formatReport(c));
    parts.push("");
    parts.push(`Across ${result.cells.length} cells`);
    const v = result.summary?.verdicts || {};
    parts.push(
      `Verdicts  tweak ${v.tweak || 0}  gap ${v.gap || 0}  fail ${v.fail || 0}  expected ${v.expected || 0}  watch ${v.watch || 0}  ok ${v.ok || 0}`
    );
    return parts.join("\n");
  }

  const lines = [];
  const cell = result.cell || {};
  lines.push(
    `Viability · ${cell.title || result.place} · ${result.days.toFixed(2)} sim days · forage cap ${result.fishCap.toLocaleString()} · dt ${result.dt}s`
  );
  if (cell.region) lines.push(`${cell.region}  ${cell.lat?.toFixed?.(2) ?? ""}  ${cell.lon?.toFixed?.(2) ?? ""}  floor ${cell.floorY} m  ${cell.status}`);
  lines.push(
    `Bloom P/Z ${Math.round((result.meanP ?? 0) * 100)}/${Math.round((result.meanZ ?? 0) * 100)} · forage ${result.schoolCount.toLocaleString()} · vehicles ${result.predatorCount}`
  );
  const s = result.summary || {};
  const v = s.verdicts || {};
  lines.push(
    `Flags   fail ${s.fail || 0}  look ${s.look || 0}  watch ${s.watch || 0}  ok ${s.ok || 0}`
  );
  lines.push(
    `Verdict tweak ${v.tweak || 0}  gap ${v.gap || 0}  fail ${v.fail || 0}  expected ${v.expected || 0}  watch ${v.watch || 0}  ok ${v.ok || 0}`
  );
  lines.push("");
  lines.push("tweak = prey/mechanics exist, knobs or overlap failed.  gap = card already names a missing mechanic.  expected = empty habitat or programmed starve.");
  lines.push("");

  const order = ["fail", "tweak", "gap", "watch", "expected", "ok"];
  for (const verdict of order) {
    const rows = result.reports.filter((r) => r.verdict === verdict);
    if (!rows.length) continue;
    lines.push(verdict.toUpperCase());
    for (const r of rows) {
      const deep =
        r.depthMaxM > 0 || r.depthMinM > 0
          ? `${r.depthMinM.toFixed(0)}–${r.depthMaxM.toFixed(0)} m`
          : "—";
      const meals =
        r.agent === "school" && r.diet !== "bite"
          ? `graze ${(r.grazeNow || 0).toFixed(2)}`
          : `${r.mealsNow | 0} meals`;
      const vital = `born ${r.bornNow | 0}  starved ${r.starvedNow | 0}  eaten ${r.eatenNow | 0}`;
      const peak = r.peakN && r.peakN !== r.nNow ? `peak ${r.peakN}` : "";
      lines.push(
        `  ${pad(r.common, 24)} n=${String(r.nNow ?? 0).padStart(5)} ${pad(peak, 10)}  E=${Math.round((r.energyNow || 0) * 100)}%  ${pad(deep, 12)}  ${meals}  ${vital}`
      );
      lines.push(`    ${r.why || r.flags?.[0]?.text || ""}`);
      if (r.dietText && r.dietText !== "no meals") lines.push(`    diet  ${r.dietText}`);
      if (r.huntKinds?.length) {
        lines.push(
          `    hunt  taxa ${r.huntTaxaMeals | 0}  kinds ${r.huntKindsMeals | 0}  (kinds: ${r.huntKinds.map((id) => FAUNA[id]?.common || id).join(", ")})`
        );
      }
      const alive = (r.preyAlive || []).map((id) => FAUNA[id]?.common || id);
      const missing = (r.preyMissing || []).map((id) => FAUNA[id]?.common || id);
      if (alive.length || missing.length) {
        lines.push(
          `    prey  in cell ${alive.length ? alive.join(", ") : "—"}  missing ${missing.length ? missing.join(", ") : "—"}`
        );
      }
      const overlap = formatOverlap(r);
      if (overlap) lines.push(`    depth vs prey  ${overlap}`);
      if (r.verdict === "gap" && r.missing?.[0]) {
        lines.push(`    not in the model  ${r.missing[0]}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function serializeResult(result, { trace = false } = {}) {
  const compact = (r) => ({
    id: r.id,
    common: r.common,
    latin: r.latin,
    guild: r.guild,
    agent: r.agent,
    diet: r.diet,
    verdict: r.verdict,
    why: r.why,
    status: r.status,
    flags: r.flags,
    nNow: r.nNow,
    firstN: r.firstN,
    peakN: r.peakN,
    energyNow: r.energyNow,
    mealsNow: r.mealsNow,
    grazeNow: r.grazeNow,
    bornNow: r.bornNow,
    starvedNow: r.starvedNow,
    eatenNow: r.eatenNow,
    depthMinM: r.depthMinM,
    depthMaxM: r.depthMaxM,
    meals: r.mealsByPrey,
    dietText: r.dietText,
    huntTaxa: r.huntTaxa,
    huntKinds: r.huntKinds,
    huntTaxaMeals: r.huntTaxaMeals,
    huntKindsMeals: r.huntKindsMeals,
    preyAlive: r.preyAlive,
    preyHabitat: r.preyHabitat,
    preyMissing: r.preyMissing,
    preyOverlap: r.preyOverlap,
    missing: r.missing,
    cellId: r.cellId,
    cellTitle: r.cellTitle,
  });
  const one = (res) => ({
    cell: res.cell,
    days: res.days,
    dt: res.dt,
    fishCap: res.fishCap,
    bloom: { p: res.meanP, z: res.meanZ, n: res.meanN, d: res.meanD },
    schoolCount: res.schoolCount,
    predatorCount: res.predatorCount,
    present: res.present,
    summary: res.summary,
    species: (res.reports || []).map(compact),
    trace: trace
      ? {
          time: res.log?.time,
          bloom: res.log?.bloom,
          series: res.log?.series,
        }
      : undefined,
  });
  if (result.cells) {
    return {
      cell: result.cell,
      days: result.days,
      summary: result.summary,
      cells: result.cells.map((c) => one(c)),
    };
  }
  return one(result);
}

function parseArgs(argv) {
  const out = { days: 3, dt: 0.08, cell: "catalog", json: false, gaps: false, trace: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const n = argv[i + 1];
    if (a === "--days") out.days = Number(n);
    else if (a === "--dt") out.dt = Number(n);
    else if (a === "--place" || a === "--cell") out.cell = n;
    else if (a === "--fish") out.fish = Number(n);
    else if (a === "--species") out.species = n;
    else if (a === "--out") out.out = n;
    else if (a === "--json") {
      out.json = true;
      continue;
    } else if (a === "--gaps") {
      out.gaps = true;
      continue;
    } else if (a === "--trace") {
      out.trace = true;
      continue;
    } else continue;
    i++;
  }
  return out;
}

const isMain = fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const opts = parseArgs(process.argv.slice(2));
  const t0 = Date.now();
  const result = runViability({
    ...opts,
    onProgress: (day, ctx) => {
      const tag = ctx?.cell ? `${ctx.cell} ` : "";
      process.stderr.write(`  ${tag}day ${day.toFixed(1)}\n`);
    },
  });
  const ms = Date.now() - t0;
  if (opts.json && !opts.out) {
    console.log(JSON.stringify(serializeResult(result, { trace: opts.trace }), null, 2));
  } else {
    console.log(formatReport(result));
    console.log(`Wall ${((ms / 1000) | 0)}s`);
  }
  if (opts.out) {
    writeFileSync(opts.out, JSON.stringify(serializeResult(result, { trace: opts.trace }), null, 2));
    process.stderr.write(`wrote ${opts.out}\n`);
  }
}
