import { diagnoseSpecies } from "./viability.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function series(partial) {
  return {
    n: [],
    energy: [],
    graze: [],
    meals: [],
    born: [],
    starved: [],
    eaten: [],
    ...partial,
  };
}

const herring = { id: "herring", agent: "school", diet: "z", huntTaxa: null, huntKinds: null };
const shark = { id: "shark", agent: "vehicle", diet: "bite", huntTaxa: null, huntKinds: null };
const sperm = {
  id: "spermwhale",
  agent: "vehicle",
  diet: "bite",
  huntTaxa: ["marketsquid"],
  huntKinds: null,
};

{
  const r = diagnoseSpecies(herring, series({}), { days: 0 });
  assert(r.status === "wait", "empty trace should wait");
}

{
  const r = diagnoseSpecies(
    herring,
    series({
      n: [1200, 800, 0],
      energy: [0.5, 0.2, 0],
      graze: [0.2, 0.2, 0.2],
      born: [0, 0, 0],
      starved: [0, 40, 200],
    }),
    { days: 1.2, liveIds: new Set(["herring"]) }
  );
  assert(r.status === "fail", "zeroed school should be extinct/fail");
  assert(r.flags.some((f) => f.code === "extinct"), "expected extinct flag");
}

{
  const r = diagnoseSpecies(
    herring,
    series({
      n: [400, 400, 400],
      energy: [0.5, 0.52, 0.48],
      graze: [0, 0, 0],
      born: [0, 0, 0],
      starved: [0, 0, 0],
    }),
    { days: 0.8, liveIds: new Set(["herring"]) }
  );
  assert(r.flags.some((f) => f.code === "not-grazing"), "school with zero graze should fail");
  assert(r.status === "fail", "not-grazing is fail");
}

{
  const r = diagnoseSpecies(
    herring,
    series({
      n: [800, 790, 810],
      energy: [0.55, 0.5, 0.52],
      graze: [0.1, 0.4, 0.9],
      born: [0, 4, 12],
      starved: [0, 1, 3],
    }),
    { days: 1.4, liveIds: new Set(["herring"]) }
  );
  assert(r.status === "ok", `healthy school should be ok, got ${r.status}`);
}

{
  const r = diagnoseSpecies(
    shark,
    series({
      n: [3, 3, 3],
      energy: [0.6, 0.4, 0.22],
      meals: [0, 0, 0],
      graze: [0, 0, 0],
      born: [0, 0, 0],
      starved: [0, 0, 0],
    }),
    { days: 0.8, liveIds: new Set(["shark", "herring"]) }
  );
  assert(r.flags.some((f) => f.code === "not-eating"), "biter with prey and no meals");
}

{
  const r = diagnoseSpecies(
    sperm,
    series({
      n: [2, 2, 2],
      energy: [0.6, 0.35, 0.18],
      meals: [0, 0, 0],
      graze: [0, 0, 0],
      born: [0, 0, 0],
      starved: [0, 0, 0],
    }),
    { days: 0.8, liveIds: new Set(["spermwhale", "herring"]) }
  );
  assert(r.flags.some((f) => f.code === "no-prey"), "sperm whale without squid is a watch, not a cheat");
  assert(r.status === "watch" || r.status === "look", `got ${r.status}`);
  assert(!r.flags.some((f) => f.code === "not-eating"), "missing prey should not also be not-eating");
}

{
  const r = diagnoseSpecies(
    shark,
    series({
      n: [2, 2, 2],
      energy: [0.7, 0.72, 0.74],
      meals: [0, 0, 0],
      graze: [0, 0, 0],
      born: [0, 0, 0],
      starved: [0, 0, 0],
    }),
    { days: 1.0, liveIds: new Set(["shark"]) }
  );
  assert(r.flags.some((f) => f.code === "unearned"), "energy without meals is fake fullness");
  assert(r.status === "fail", "unearned is fail");
}

{
  const r = diagnoseSpecies(
    herring,
    series({
      n: [200, 400, 620],
      energy: [0.7, 0.72, 0.74],
      graze: [0.2, 0.8, 1.6],
      born: [0, 120, 280],
      starved: [0, 0, 0],
    }),
    { days: 1.5, liveIds: new Set(["herring"]) }
  );
  assert(r.flags.some((f) => f.code === "boom"), "fast growth with high energy is a boom watch");
}

{
  const r = diagnoseSpecies(
    herring,
    series({
      n: [0, 0, 0],
      energy: [0, 0, 0],
      graze: [0.4, 0.4, 0.4],
      born: [0, 0, 0],
      starved: [80, 80, 80],
    }),
    { days: 14, liveIds: new Set(), firstN: 740, peakN: 740 }
  );
  assert(r.status === "fail", "truncated series must still fail if the run started with fish");
  assert(r.flags.some((f) => f.code === "extinct"), "firstN>0 and n=0 is extinct, not absent");
}

console.log("viability diagnose: 9 checks ok");
