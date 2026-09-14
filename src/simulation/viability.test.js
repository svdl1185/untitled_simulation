import { diagnoseSpecies, verdictOf, formatDiet, catalogRow } from "./viability.js";

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
  const skipjack = { id: "tuna", agent: "school", diet: "bite", huntTaxa: null, huntKinds: null };
  const r = diagnoseSpecies(
    skipjack,
    series({
      n: [80, 80, 80],
      energy: [0.55, 0.4, 0.28],
      meals: [0, 0, 0],
      graze: [0, 0, 0],
      born: [0, 0, 0],
      starved: [0, 0, 0],
    }),
    { days: 0.8, liveIds: new Set(["tuna", "herring"]) }
  );
  assert(r.flags.some((f) => f.code === "not-eating"), "school biter with prey and no meals");
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

{
  const r = diagnoseSpecies(
    sperm,
    series({
      n: [2, 2, 2],
      energy: [0.4, 0.3, 0.22],
      meals: [0, 0, 0],
      graze: [0, 0, 0],
      born: [0, 0, 0],
      starved: [0, 0, 0],
    }),
    {
      days: 0.8,
      liveIds: new Set(["spermwhale", "marketsquid"]),
      everAlive: new Set(["spermwhale"]),
    }
  );
  assert(r.flags.some((f) => f.code === "prey-never-spawned"), "habitat prey that never lived is a spawn miss");
  assert(!r.flags.some((f) => f.code === "not-eating"), "unspawned prey is not a missed meal");
}

{
  const whale = catalogRow("spermwhale");
  const r = diagnoseSpecies(
    whale,
    series({
      n: [1, 1, 1],
      energy: [0.55, 0.5, 0.48],
      meals: [0, 4, 12],
      graze: [0, 0, 0],
      born: [0, 0, 0],
      starved: [0, 0, 0],
    }),
    {
      days: 2.0,
      liveIds: new Set(["spermwhale", "lanternfish", "giantsquid"]),
      everAlive: new Set(["spermwhale", "lanternfish", "giantsquid"]),
      diet: { lanternfish: 12, giantsquid: 0 },
    }
  );
  assert(r.flags.some((f) => f.code === "hunt-kinds-idle"), "sperm whale on lanternfish with live giant squid should flag idle kinds");
  const judged = verdictOf({ ...whale, ...r, mealsNow: 12, preyAlive: ["lanternfish", "giantsquid"] });
  assert(judged.verdict === "watch", `healthy idle-kinds is watch, not fail, got ${judged.verdict}`);
}

{
  const whale = catalogRow("spermwhale");
  const r = diagnoseSpecies(
    whale,
    series({
      n: [1, 1, 1],
      energy: [0.4, 0.22, 0.12],
      meals: [0, 2, 4],
      graze: [0, 0, 0],
      born: [0, 0, 0],
      starved: [0, 0, 0],
    }),
    {
      days: 2.0,
      liveIds: new Set(["spermwhale", "lanternfish", "giantsquid"]),
      everAlive: new Set(["spermwhale", "lanternfish", "giantsquid"]),
      diet: { lanternfish: 4, giantsquid: 0 },
    }
  );
  const judged = verdictOf({ ...whale, ...r, mealsNow: 4, preyAlive: ["lanternfish", "giantsquid"] });
  assert(judged.verdict === "tweak", `starving idle-kinds should be a tweak, got ${judged.verdict}`);
}

{
  const whale = catalogRow("spermwhale");
  const r = diagnoseSpecies(
    whale,
    series({
      n: [1, 1, 1],
      energy: [0.6, 0.58, 0.55],
      meals: [0, 1, 2],
      graze: [0, 0, 0],
      born: [0, 0, 0],
      starved: [0, 0, 0],
    }),
    {
      days: 2.0,
      liveIds: new Set(["spermwhale", "giantsquid", "lanternfish"]),
      everAlive: new Set(["spermwhale", "giantsquid", "lanternfish"]),
      diet: { giantsquid: 1, lanternfish: 1 },
    }
  );
  assert(!r.flags.some((f) => f.code === "hunt-kinds-idle"), "a giant-squid bite should clear idle-kinds");
  assert(r.status === "ok" || r.status === "watch", `got ${r.status}`);
}

{
  const r = diagnoseSpecies(
    herring,
    series({
      n: [400, 200, 0],
      energy: [0.4, 0.2, 0],
      graze: [0.2, 0.1, 0],
      born: [0, 0, 0],
      starved: [10, 20, 30],
      eaten: [80, 200, 370],
    }),
    { days: 1.4, liveIds: new Set(["herring", "cod"]) }
  );
  assert(r.flags.some((f) => /Eaten/.test(f.text)), "extinct text should say eaten when kills dominate");
}

{
  const judged = verdictOf({
    id: "spermwhale",
    status: "watch",
    flags: [{ code: "no-prey", severity: "watch", text: "Named prey is not in this cell." }],
    missing: ["Glass squid (Histioteuthis) are not agents."],
    mealsNow: 0,
    preyAlive: [],
  });
  assert(judged.verdict === "expected", "no-prey is expected habitat, not a wiring fail");
}

{
  assert(formatDiet({ lanternfish: 12, giantsquid: 1 }).includes("Giant squid"), "diet names catalog prey");
  assert(formatDiet({}) === "no meals", "empty diet");
}

console.log("viability diagnose: 16 checks ok");
