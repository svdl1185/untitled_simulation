import { attenuationKd, samplePAR, surfacePAR } from "./light.js";
import { bindCellTemperature, climatologySST, columnQ10, meanSST, q10Factor, sampleTemp } from "./temperature.js";
import {
  bindCellOxygen,
  climateOmz,
  omzCoreY,
  oxygenLimitY,
  sampleO2,
  saturationO2,
} from "./oxygen.js";
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
  applyPatch(makeTestPatch());
  const bloom = new Plankton();
  const amp = bloom.sampleLayer(TROPHIC.P, 0, 0);
  const w = bloom.profileAt(TROPHIC.P, -8);
  const c = bloom.sampleAt(TROPHIC.P, 0, -8, 0);
  assert(Math.abs(c - amp * w) < 1e-5, "sampleAt should be patch × column");
  const ground = seafloorHeight(0, 0);
  assert(bloom.sampleAt(TROPHIC.P, 0, ground - 12, 0) === 0, "sampleAt below the local floor should be empty");
  assert(bloom.grazeAt(TROPHIC.Z, 0, ground - 12, 0, 0.2) === 0, "grazeAt below the floor should take nothing");
  const day = { night: 0, caustic: 0.85, sunDir: { y: 0.8 }, storm: 0 };
  const night = { night: 1, caustic: 0, sunDir: { y: -0.2 }, storm: 0 };
  for (let i = 0; i < 10; i++) bloom._updateColumn(0.4, night);
  const zNight = bloom.peakY(bloom.zCol);
  for (let i = 0; i < 10; i++) bloom._updateColumn(0.4, day);
  const zDay = bloom.peakY(bloom.zCol);
  assert(zNight > zDay, `zooplankton DVM should rise at night (night ${zNight}, day ${zDay})`);
  assert(bloom.photicLight >= 0 && bloom.photicLight <= 1.05, "photic-weighted PAR should be a fraction");
  assert(bloom.pzCoincide >= 0 && bloom.pzCoincide <= 1.05, "P–Z column coincidence should be 0–1");
  const before = bloom.sampleLayer(TROPHIC.Z, 0, 0);
  bloom.grazeAt(TROPHIC.Z, 0, -12, 0, 0.05);
  assert(bloom.sampleLayer(TROPHIC.Z, 0, 0) <= before, "3D graze should deplete the 2D patch");
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

{
  const saved = {
    lat: CONFIG.world.lat,
    lon: CONFIG.world.lon,
    lab: CONFIG.world.lab,
    floorY: CONFIG.floorY,
    thermoY: CONFIG.thermoY,
    sst: CONFIG.water.sst,
    omz: CONFIG.water.omz,
    o2Anomaly: CONFIG.water.o2Anomaly,
    o2Demand: CONFIG.water.o2Demand,
    omzCoreY: CONFIG.water.omzCoreY,
  };

  CONFIG.world.lab = false;
  CONFIG.floorY = -4000;
  CONFIG.water.o2Anomaly = 0;
  CONFIG.water.o2Demand = 0;

  CONFIG.world.lat = -16;
  CONFIG.world.lon = -76;
  bindCellTemperature();
  bindCellOxygen();
  const peruSurf = sampleO2(0, -2, 0);
  const peruCore = omzCoreY();
  assert(climateOmz(-16, -76) > 0.5, "Peru should have a strong OMZ");
  assert(peruCore != null && peruCore < -250 && peruCore > -900, `Peru OMZ core should be mesopelagic, got ${peruCore}`);
  const peruOmz = sampleO2(0, peruCore, 0);
  assert(peruSurf > peruOmz + 1.5, `Peru surface O2 (${peruSurf.toFixed(2)}) should beat the OMZ (${peruOmz.toFixed(2)})`);
  assert(peruOmz < 1.4, `Peru OMZ should be hypoxic, got ${peruOmz.toFixed(2)}`);
  const tunaFloor = oxygenLimitY(vehicleCfg("tuna"));
  assert(tunaFloor > peruCore, `skipjack should stay above the OMZ core (${tunaFloor.toFixed(0)} vs ${peruCore.toFixed(0)})`);
  assert(oxygenLimitY(vehicleCfg("humboldtsquid")) < -800, "Humboldt OMZ refuge is not an oxygen ceiling");

  CONFIG.world.lat = 56;
  CONFIG.world.lon = 3.2;
  bindCellTemperature();
  bindCellOxygen();
  assert(climateOmz(56, 3.2) < 0.12, "North Sea should not have an OMZ");
  assert(omzCoreY() == null, "North Sea omzCoreY should be null");
  const ns80 = sampleO2(0, -80, 0);
  assert(ns80 > 4, `North Sea at 80 m should stay oxygenated, got ${ns80.toFixed(2)}`);

  assert(saturationO2(0) > saturationO2(28), "cold surface water holds more oxygen");

  CONFIG.world.lat = -16;
  CONFIG.world.lon = -76;
  CONFIG.water.o2Anomaly = 0;
  bindCellTemperature();
  bindCellOxygen();
  const core = omzCoreY();
  const base = sampleO2(0, core, 0);
  CONFIG.water.o2Anomaly = -1;
  bindCellOxygen();
  const low = sampleO2(0, omzCoreY() ?? core, 0);
  assert(low < base - 0.4, "negative oxygen anomaly should intensify the OMZ");

  CONFIG.world.lat = saved.lat;
  CONFIG.world.lon = saved.lon;
  CONFIG.world.lab = saved.lab;
  CONFIG.floorY = saved.floorY;
  CONFIG.thermoY = saved.thermoY;
  CONFIG.water.sst = saved.sst;
  CONFIG.water.omz = saved.omz;
  CONFIG.water.o2Anomaly = saved.o2Anomaly;
  CONFIG.water.o2Demand = saved.o2Demand;
  CONFIG.water.omzCoreY = saved.omzCoreY;
}

{
  applyPatch(makeTestPatch());
  assert(CONFIG.water.omz > 0.5, "catalog tank should force an OMZ so Humboldt has a day refuge");
  const labCore = omzCoreY();
  assert(labCore != null && labCore < -200, `lab OMZ core should be mesopelagic, got ${labCore}`);
  const peru = presenceAt(-16, -76);
  assert(peru.humboldtsquid > 0, "eastern tropical Pacific should hold Humboldt squid");
  const north = presenceAt(56, 3.2);
  assert(!(north.humboldtsquid > 0), "North Sea should not hold Humboldt squid");
}

console.log("column physics: 14 checks ok");
