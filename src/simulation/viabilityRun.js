/**
 * Headless Lotka–Volterra run of a cell. No renderer.
 * Defaults to the 10 km catalog tank (every implemented animal).
 *
 *   node src/simulation/viabilityRun.js
 *   node src/simulation/viabilityRun.js --days 7 --fish 8000
 *   node src/simulation/viabilityRun.js --place shelf --days 14 --fish 2000
 */
import { fileURLToPath } from "node:url";
import { CONFIG, faunaPresent, anySchoolPresent } from "../config.js";
import { VEHICLE_IDS, PRESENCE_IDS, SPECIES, vehicleCfg } from "../world/fauna.js";
import { applyPatch, makeSyntheticPatch, makeTestPatch } from "../world/patch.js";
import { School } from "./school.js";
import { spawnPredators, tryBreed } from "./shark.js";
import { Plankton } from "./plankton.js";
import { DayCycle } from "./day.js";
import { ViabilityLog } from "./viability.js";

const EMPTY_INPUT = { mouseDx: 0, mouseDy: 0 };

export function runViability(opts = {}) {
  const daysWanted = Math.max(0.05, Number(opts.days) || 14);
  const dt = Math.max(0.02, Number(opts.dt) || 0.08);
  const place = opts.place === "shelf" ? "shelf" : "lab";
  const patch = place === "shelf" ? makeSyntheticPatch() : makeTestPatch();
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
  const predCounts = {};
  if (CONFIG.world.lab) {
    for (const id of VEHICLE_IDS) {
      if (!faunaPresent(id)) continue;
      const cfg = vehicleCfg(id);
      predCounts[id] = Math.min(cfg.max ?? 2, Math.max(2, cfg.count || 2));
    }
  } else if (faunaPresent("shark")) {
    predCounts.shark = CONFIG.shark.count;
  }
  const sharks = spawnPredators(school, predCounts);
  const log = new ViabilityLog();
  log.selectIds(PRESENCE_IDS.filter((id) => faunaPresent(id) && SPECIES[id]?.agent !== "field"));

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
      plankton.recycle(sharks[i].x, sharks[i].z, sharks[i].cfg?.carcass ?? CONFIG.shark.carcass);
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
      onProgress(simClock / CONFIG.time.dayLength, { school, sharks, plankton, log });
      nextNote += CONFIG.time.dayLength;
    }
  }

  const world = { school, sharks, plankton, day };
  const reports = log.reports(world);
  return {
    place,
    days: log.days(),
    dt,
    fishCap: fishN,
    meanP: plankton.meanP,
    meanZ: plankton.meanZ,
    schoolCount: school.count,
    predatorCount: sharks.length,
    reports,
    summary: log.summary(reports),
    world,
    log,
  };
}

export function formatReport(result) {
  const lines = [];
  lines.push(
    `Viability · ${result.place} · ${result.days.toFixed(2)} sim days · forage cap ${result.fishCap.toLocaleString()} · dt ${result.dt}s`
  );
  lines.push(
    `Bloom P/Z ${Math.round((result.meanP ?? 0) * 100)}/${Math.round((result.meanZ ?? 0) * 100)} · forage ${result.schoolCount.toLocaleString()} · vehicles ${result.predatorCount}`
  );
  const s = result.summary;
  lines.push(
    `Flags  fail ${s.fail || 0}  look ${s.look || 0}  watch ${s.watch || 0}  ok ${s.ok || 0}`
  );
  lines.push("");
  const order = ["fail", "look", "watch", "ok", "wait"];
  for (const status of order) {
    const rows = result.reports.filter((r) => r.status === status);
    if (!rows.length) continue;
    lines.push(status.toUpperCase());
    for (const r of rows) {
      const top = r.flags.find((f) => f.severity === r.status) || r.flags[0];
      const deep =
        r.depthMaxM > 0 || r.depthMinM > 0
          ? `${r.depthMinM.toFixed(0)}–${r.depthMaxM.toFixed(0)} m`
          : "—";
      const meals = r.agent === "school"
        ? `graze ${(r.grazeNow || 0).toFixed(2)}`
        : `${r.mealsNow | 0} meals`;
      const vital = `born ${r.bornNow | 0}  starved ${r.starvedNow | 0}`;
      const peak = r.peakN && r.peakN !== r.nNow ? `peak ${r.peakN}` : "";
      lines.push(
        `  ${r.common.padEnd(24)} n=${String(r.nNow ?? 0).padStart(5)} ${peak.padStart(10)}  E=${Math.round((r.energyNow || 0) * 100)}%  ${deep.padStart(12)}  ${meals}  ${vital}`
      );
      lines.push(`    ${top?.text || ""}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function parseArgs(argv) {
  const out = { days: 14, dt: 0.08, place: "lab" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const n = argv[i + 1];
    if (a === "--days") out.days = Number(n);
    else if (a === "--dt") out.dt = Number(n);
    else if (a === "--place") out.place = n;
    else if (a === "--fish") out.fish = Number(n);
    else continue;
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
    onProgress: (day) => {
      process.stderr.write(`  day ${day.toFixed(1)}\n`);
    },
  });
  const ms = Date.now() - t0;
  console.log(formatReport(result));
  console.log(`Wall ${((ms / 1000) | 0)}s`);
}
