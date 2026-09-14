import { DEMO_CELLS, defaultToggles, demoById, makeDemoPatch, naturalPresence, presenceFromToggles, sandboxIds } from "./demos.js";
import { PRESENCE_IDS, SPECIES } from "./fauna.js";
import { applyPatch, applyPresence, makeSyntheticPatch, makeTestPatch } from "./patch.js";
import { faunaPresent } from "../config.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

{
  const ids = new Set();
  for (const demo of DEMO_CELLS) {
    assert(demo.id && !ids.has(demo.id), `duplicate demo id ${demo.id}`);
    ids.add(demo.id);
    assert(demo.title && demo.region && demo.about, `${demo.id} needs title, region, about`);
    assert(demo.status === "coupled" || demo.status === "gap", `${demo.id} status`);
    assert(Array.isArray(demo.observe) && demo.observe.length, `${demo.id} needs observe`);
    if (demo.kind !== "lab") {
      assert(Number.isFinite(demo.lat) && Number.isFinite(demo.lon), `${demo.id} needs lat/lon`);
    }
    for (const id of sandboxIds(demo)) {
      assert(SPECIES[id], `${demo.id} sandbox id ${id} is not in the catalog`);
    }
  }
  assert(demoById("catalog")?.kind === "lab", "catalog tank is the 10 km lab");
  assert(DEMO_CELLS.some((d) => d.id === "shelf"), "North Sea shelf demo");
  assert(DEMO_CELLS.some((d) => d.id === "polar" && d.status === "coupled"), "polar ice is coupled");
  assert(DEMO_CELLS.some((d) => d.id === "reef" && d.status === "gap"), "reef is still a gap tile");
}

{
  const demo = demoById("catalog");
  const all = defaultToggles(demo);
  assert(all.herring && all.spermwhale && all.benthos, "catalog defaults every taxon on");
  const off = { ...all, herring: false };
  const p = presenceFromToggles(demo, off);
  assert(p.herring === 0, "sandbox can drop herring in the tank");
  assert(p.cod === 1, "other catalog taxa stay on");
}

{
  const demo = demoById("shelf");
  const natural = naturalPresence(demo);
  assert(natural.herring > 0, "North Sea demo is herring water");
  assert(!(natural.sardinella > 0), "sardinella should not default on in the North Sea");
  const ids = sandboxIds(demo);
  assert(ids.includes("herring") && ids.includes("cod"), "shelf sandbox includes herring and cod");
  const toggles = defaultToggles(demo);
  toggles.humboldtsquid = true;
  const p = presenceFromToggles(demo, toggles);
  assert(!(p.humboldtsquid > 0), "Humboldt is not in the North Sea sandbox pool");
  toggles.cod = false;
  const dropped = presenceFromToggles(demo, toggles);
  assert(dropped.cod === 0, "sandbox can drop cod on the shelf");
}

{
  const ant = makeDemoPatch(demoById("antarctic"));
  assert(ant.dayIndex === 15, `antarctic window is austral summer, got ${ant.dayIndex}`);
  const polar = makeDemoPatch(demoById("polar"));
  assert(polar.dayIndex === 172, `polar window is midnight sun, got ${polar.dayIndex}`);
  const tank = makeDemoPatch(demoById("catalog"));
  assert(tank.dayIndex === 180, `catalog tank stays day 180, got ${tank.dayIndex}`);
  const shelf = makeDemoPatch(demoById("shelf"));
  assert(shelf.dayIndex === 180, "North Sea stays day 180");
}

{
  applyPatch(makeTestPatch());
  const p = { ...PRESENCE_IDS.reduce((acc, id) => ((acc[id] = 1), acc), {}), herring: 0 };
  applyPresence(p, { honorFloor: false });
  assert(!faunaPresent("herring"), "applyPresence should drop herring in the tank");
  assert(faunaPresent("cod"), "applyPresence keeps other lab taxa");
}

{
  applyPatch(makeSyntheticPatch());
  assert(faunaPresent("herring"), "synthetic shelf still holds herring after applyPatch");
  applyPresence({ herring: 1, cod: 0, benthos: 1, shark: 1 });
  assert(faunaPresent("herring"), "sandbox keeps herring");
  assert(!faunaPresent("cod"), "sandbox can remove cod");
}

console.log("demo cells: 6 checks ok");
