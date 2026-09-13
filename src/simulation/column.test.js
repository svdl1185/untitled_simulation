import { attenuationKd, samplePAR, surfacePAR } from "./light.js";
import { climatologySST, columnQ10, meanSST, q10Factor, sampleTemp } from "./temperature.js";
import { CONFIG, breathTargetY, photicLimitY } from "../config.js";
import { Plankton, TROPHIC } from "./plankton.js";
import { presenceAt } from "../world/ranges.js";
import { applyPatch, makeSyntheticPatch, makeTestPatch } from "../world/patch.js";
import { faunaPresent } from "../config.js";
import { School } from "./school.js";
import { spawnPredators } from "./shark.js";
import { seafloorHeight } from "./obstacles.js";
import { vehicleCfg } from "../world/fauna.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

{
  const deep = samplePAR(-200, { night: 0, caustic: 1, sunDir: { y: 0.8 }, storm: 0 });
  const shallow = samplePAR(-10, { night: 0, caustic: 1, sunDir: { y: 0.8 }, storm: 0 });
  assert(shallow > deep, "PAR should decay with depth");
  const night = samplePAR(-10, { night: 1, caustic: 0, sunDir: { y: -0.2 }, storm: 0 });
  assert(night < shallow, "night PAR should be lower than day PAR at the same depth");
}

{
  const clear = CONFIG.water.turbidity;
  const floor = CONFIG.floorY;
  CONFIG.floorY = -4000;
  CONFIG.water.turbidity = 0.4;
  const kdClear = attenuationKd();
  const photicClear = photicLimitY();
  CONFIG.water.turbidity = 1.3;
  const kdMurky = attenuationKd();
  const photicMurky = photicLimitY();
  CONFIG.water.turbidity = clear;
  CONFIG.floorY = floor;
  assert(kdMurky > kdClear, "murkier water should attenuate faster");
  assert(photicMurky > photicClear, "murkier photic limit should be shallower (less negative)");
}

{
  const trop = meanSST(0);
  const pole = meanSST(72);
  assert(trop > 24, `equator SST should be tropical, got ${trop}`);
  assert(pole < 6, `polar SST should be cold, got ${pole}`);
  const july = climatologySST(50, 200);
  const jan = climatologySST(50, 15);
  assert(july > jan, "North Atlantic July should be warmer than January");
}

{
  assert(q10Factor(20, 10, 2) > 1.9, "Q10 at +10°C should roughly double rates");
  assert(q10Factor(0, 10, 2) < 0.6, "Q10 in polar water should slow rates");
  const q = columnQ10();
  assert(q >= 0.42 && q <= 2.85, `column Q10 should be clamped, got ${q}`);
}

{
  const Tsurf = sampleTemp(0, -2, 0);
  const Tdeep = sampleTemp(0, CONFIG.floorY + 4, 0);
  assert(Tsurf >= Tdeep - 0.2, "surface should not be colder than the deep in this climatology");
}

{
  const bloom = new Plankton();
  assert(bloom.benthos.length === bloom.n.length, "benthos is a 2D seafloor field");
  assert(bloom.ny >= 3, "NPZD column should have photic bins");
  const pShallow = bloom.profileAt(TROPHIC.P, -4);
  const pDeep = bloom.profileAt(TROPHIC.P, Math.min(-200, CONFIG.floorY + 8));
  assert(pShallow >= pDeep * 0.9, "seeded phytoplankton should sit in the photic, not the dark");
  const taken = bloom.grazeBenthos(0, 0, 0.01);
  assert(taken >= 0, "benthos graze should be non-negative");
  bloom.update(0.2, { night: 0, caustic: 0.8, sunDir: { y: 0.7 }, storm: 0 }, 0);
  assert(bloom.meanB >= 0, "benthos mean should stay defined after a step");
  assert(bloom.prodIndex >= 0, "production index should be tracked");
}

{
  applyPatch(makeSyntheticPatch());
  assert(!faunaPresent("giantsquid"), "North Sea shelf is too shallow for giant squid");
  assert(faunaPresent("herring"), "synthetic shelf should still hold herring");
  assert(faunaPresent("benthos"), "every wet cell has a benthos field");
}

{
  applyPatch(makeTestPatch());
  assert(faunaPresent("giantsquid"), "catalog tank is 2000 m and should hold giant squid");
  assert(faunaPresent("spermwhale"), "catalog tank should hold sperm whales");
}

{
  applyPatch(makeTestPatch());
  const hour = 12;
  const school = new School(480, { hour });
  let buried = 0;
  let airborne = 0;
  for (let i = 0; i < school.count; i++) {
    const i3 = i * 3;
    const x = school.pos[i3];
    const y = school.pos[i3 + 1];
    const z = school.pos[i3 + 2];
    const ground = seafloorHeight(x, z);
    if (y < ground + 0.4) buried++;
    if (y > 0.2) airborne++;
  }
  assert(!buried, `${buried} school fish spawned below the local seafloor`);
  assert(!airborne, `${airborne} school fish spawned above the surface`);
  const pack = spawnPredators(school);
  for (const s of pack) {
    const ground = seafloorHeight(s.x, s.z);
    assert(s.y > ground + 0.3, `${s.kind} spawned in the rock (y=${s.y.toFixed(1)} floor=${ground.toFixed(1)})`);
    assert(s.y < 0.2, `${s.kind} spawned above the surface (y=${s.y.toFixed(1)})`);
    const cfg = vehicleCfg(s.kind);
    if (cfg.gait === "benthic") {
      assert(s.y < ground + 12, `${s.kind} should seed on the bed`);
    }
  }
  const squid = pack.find((s) => s.kind === "humboldtsquid");
  if (squid) {
    const ground = seafloorHeight(squid.x, squid.z);
    assert(squid.y > ground + 0.3, "Humboldt squid must not seed inside a dropoff");
    assert(squid.y < -200, `Humboldt squid day band should be mesopelagic, got ${squid.y.toFixed(1)}`);
  }
  const giant = pack.find((s) => s.kind === "giantsquid");
  if (giant) {
    const ground = seafloorHeight(giant.x, giant.z);
    assert(giant.y > ground + 0.3, "giant squid must not seed inside a dropoff");
    assert(giant.y < -500, `giant squid day band should be mesopelagic, got ${giant.y.toFixed(1)}`);
  }
}

{
  const mid = presenceAt(12, -30);
  assert(mid.lanternfish > 0, "tropical Atlantic should have lanternfish");
  assert(mid.giantsquid > 0, "deep-capable oceanic cell flags giant squid before the floor gate");
  const north = presenceAt(56, 3.2);
  assert(north.herring > 0, "North Sea lat/lon is herring water");
  assert(!(north.sardinella > 0), "sardinella thermal niche should drop the North Sea");
}

{
  const I0 = surfacePAR({ night: 0, caustic: 1, sunDir: { y: 0.85 }, storm: 0 });
  const I1 = surfacePAR({ night: 0, caustic: 1, sunDir: { y: 0.85 }, storm: 1 });
  assert(I1 < I0, "storms should cut surface PAR");
}

{
  const floor = -2000;
  const dive = breathTargetY({
    surfacing: false,
    huntY: -280,
    forageDepth: -700,
    minDepth: -1.2,
    floor,
  });
  assert(dive === -280, `hungry dive should follow prey, got ${dive}`);
  const empty = breathTargetY({
    surfacing: false,
    huntY: -700,
    forageDepth: -700,
    minDepth: -1.2,
    floor,
  });
  assert(empty === -700, `empty-water dive should sit at typical forage, got ${empty}`);
  const surface = breathTargetY({
    surfacing: true,
    huntY: -700,
    forageDepth: -700,
    minDepth: -1.2,
    floor,
  });
  assert(surface === -1.2, `breathing should pin to minDepth, got ${surface}`);
  const clamped = breathTargetY({
    surfacing: false,
    huntY: -2500,
    forageDepth: -700,
    minDepth: -1.2,
    floor,
  });
  assert(clamped === -2000, `maxDepth/floor should clamp a too-deep hunt, got ${clamped}`);
}

console.log("column physics: 11 checks ok");
