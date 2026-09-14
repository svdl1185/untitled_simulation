import { attenuationKd, samplePAR, surfacePAR, visualClarity, visualHunter, visualRange, huntDetectRange } from "./light.js";
import { bindCellTemperature, climatologySST, columnQ10, meanSST, mixedLayerY, q10Factor, sampleTemp } from "./temperature.js";
import {
  bindCellOxygen,
  climateOmz,
  omzCoreY,
  oxygenLimitY,
  sampleO2,
  saturationO2,
} from "./oxygen.js";
import { bindCellUpwell, climateUpwell, sampleFlow } from "./flow.js";
import { bindCellIce, climateIce, iceAlgaeWant, iceThickness, iceTransmit } from "./ice.js";
import { DayCycle, observeDayIndex, solarSinElev } from "./day.js";
import { CONFIG, breathTargetY, photicLimitY, openPhoticY, columnZones, dvmY } from "../config.js";
import { Plankton, TROPHIC } from "./plankton.js";
import { presenceAt } from "../world/ranges.js";
import { applyPatch, makeSyntheticPatch, makeTestPatch } from "../world/patch.js";
import { demoById, makeDemoPatch } from "../world/demos.js";
import { faunaPresent } from "../config.js";
import { School, shoalHuntY, schoolBiteRadius } from "./school.js";
import { spawnPredators } from "./shark.js";
import { seafloorHeight, findWaterAtDepth } from "./obstacles.js";
import { vehicleCfg, knobsFor, lookFor, SPECIES, allocateMixedSchoolCounts, schoolDiet } from "../world/fauna.js";

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
  const savedFloor = CONFIG.floorY;
  const savedTurb = CONFIG.water.turbidity;
  CONFIG.floorY = -71;
  CONFIG.water.turbidity = 1;
  const open = openPhoticY();
  const clipped = photicLimitY();
  const day = { night: 0, caustic: 1, sunDir: { y: 0.8 }, storm: 0 };
  const I0 = surfacePAR(day);
  const bed = samplePAR(-71, day);
  const mid = visualClarity(-53, day);
  CONFIG.floorY = savedFloor;
  CONFIG.water.turbidity = savedTurb;
  assert(open < -150, `optical 1% at turbidity 1 is ~180 m, got ${open.toFixed(0)}`);
  assert(clipped === -71, `photicLimitY clips to the water that exists, got ${clipped}`);
  assert(bed > I0 * 0.05, `North Sea sand should stay well above 1% PAR (${((bed / I0) * 100).toFixed(1)}%)`);
  assert(mid > 0.9, `53 m on the shelf should still be visually clear, got ${mid.toFixed(2)}`);
}

{
  const trop = meanSST(0);
  const pole = meanSST(72);
  assert(trop > 24, `equator SST should be tropical, got ${trop}`);
  assert(pole < 6, `polar SST should be cold, got ${pole}`);
  const july = climatologySST(50, 200);
  const jan = climatologySST(50, 15);
  assert(july > jan, "North Atlantic July should be warmer than January");
  const antJan = climatologySST(-64.8, 15);
  const antJun = climatologySST(-64.8, 180);
  assert(antJan < 4.5, `Antarctic January SST should stay polar, got ${antJan.toFixed(1)}`);
  assert(antJan > antJun, "austral summer should be milder than austral winter");
  const barents = climatologySST(75.4, 172);
  assert(barents < 8, `Barents June SST should not be temperate, got ${barents.toFixed(1)}`);
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
  assert(bloom.meanI >= 0 && bloom.meanBedP >= 0, "infauna and microphyto means should stay defined");
  assert(bloom.prodIndex >= 0, "production index should be tracked");
  assert(bloom.infauna.length === bloom.n.length, "infauna is a 2D seafloor field");
  assert(bloom.bedP.length === bloom.n.length, "microphytobenthos is a 2D seafloor field");
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
  applyPatch(makeTestPatch());
  const bloom = new Plankton();
  bloom.acclimate({ night: 0, caustic: 0.8, sunDir: { y: 0.72 }, storm: 0 }, 8, 0.4);
  const z0 = bloom.meanZ;
  for (let i = 0; i < 80; i++) bloom.update(0.4, { night: 0, caustic: 0.8, sunDir: { y: 0.72 }, storm: 0 }, i * 0.4);
  assert(z0 > 0.02, `seeded Z should be a real stock, got ${z0.toFixed(4)}`);
  assert(bloom.meanZ > z0 * 0.35, `Z should not crash in a lit column (${bloom.meanZ.toFixed(4)} vs start ${z0.toFixed(4)})`);
}

{
  applyPatch(makeTestPatch());
  const saved = CONFIG.water.ice;
  CONFIG.water.ice = 0.7;
  const bloom = new Plankton();
  const day = { night: 0, caustic: 0.6, sunDir: { y: 0.55 }, storm: 0 };
  for (let i = 0; i < 12; i++) bloom._updateColumn(0.4, day);
  const film = bloom.profileAt(TROPHIC.Z, -3);
  const mid = bloom.profileAt(TROPHIC.Z, -40);
  CONFIG.water.ice = saved;
  assert(film > 0.25, `under-ice Z should occupy the ice–water film by day, got ${film.toFixed(3)}`);
  assert(mid > 0.15, `day Z should still have a thermocline lobe, got ${mid.toFixed(3)}`);
}

{
  const dt = 0.8;
  const tEnd = CONFIG.time.dayLength;
  for (const id of ["polar", "antarctic", "shelf"]) {
    applyPatch(makeDemoPatch(demoById(id)));
    const bloom = new Plankton();
    const clock = new DayCycle();
    bloom.acclimate(clock.look, 8, 0.4);
    const z0 = bloom.meanZ;
    for (let t = 0; t < tEnd; t += dt) {
      clock.update(dt);
      bloom.update(dt, clock.look, t);
    }
    assert(z0 > 0.015, `${id} should seed a Z stock, got ${z0.toFixed(4)}`);
    assert(
      bloom.meanZ > 0.02,
      `${id} Z should persist a sim day (Z ${bloom.meanZ.toFixed(4)} P ${bloom.meanP.toFixed(4)} ice ${CONFIG.water.ice.toFixed(2)})`
    );
    assert(bloom.meanP > 0.02, `${id} P should persist a sim day, got ${bloom.meanP.toFixed(4)}`);
  }
  applyPatch(makeTestPatch());
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
  const school = new School(6000, { hour });
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
  const squidN = [];
  for (let i = 0; i < school.count; i++) {
    if (school.taxonId(i) === "humboldtsquid") squidN.push(i);
  }
  assert(squidN.length > 4, `Humboldt squid should be a hashed-grid pack, got ${squidN.length}`);
  for (const i of squidN.slice(0, 16)) {
    const i3 = i * 3;
    const x = school.pos[i3];
    const y = school.pos[i3 + 1];
    const z = school.pos[i3 + 2];
    const ground = seafloorHeight(x, z);
    assert(y > ground + 0.3, "Humboldt squid must not seed inside a dropoff");
    assert(y < -200, `Humboldt squid day band should be mesopelagic, got ${y.toFixed(1)}`);
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
  const day = { night: 0, caustic: 1, sunDir: { y: 0.8 }, storm: 0 };
  const night = { night: 1, caustic: 0, sunDir: { y: -0.2 }, storm: 0 };
  const shallow = visualRange(-10, day, 10);
  const deep = visualRange(-700, day, 10);
  const glow = visualRange(-700, day, 10, 1);
  assert(shallow > deep * 3, `visualRange at 700 m should collapse (shallow ${shallow.toFixed(2)} deep ${deep.toFixed(2)})`);
  assert(glow > deep, "photophores should restore detect range in the dark");
  assert(visualRange(-10, night, 10) < shallow, "night should cut visual range at the same depth");
  assert(visualClarity(-700, day) < 0.05, "clarity at 700 m should be near zero by day");
  assert(visualHunter({ sense: "echo" }) === false, "sperm whale / orca echolocation skips PAR");
  assert(visualHunter({ diet: "filter" }) === false, "filter diets skip visual detect");
  assert(visualHunter({ diet: "bite" }) === true, "sighted biters read PAR");
  assert(visualHunter(vehicleCfg("spermwhale")) === false, "sperm whale sense is echo");
  assert(visualHunter(vehicleCfg("orca")) === false, "orca sense is echo");
  assert(visualHunter(knobsFor("tuna")) === true, "skipjack is a visual hunter");
  assert(visualHunter(vehicleCfg("whaleshark")) === false, "whale shark filter skips visual detect");
  assert(visualHunter(knobsFor("humboldtsquid")) === true, "Humboldt is visual; lanternfish glow restores range");
}

{
  const day = { night: 0, caustic: 1, sunDir: { y: 0.8 }, storm: 0 };
  const echo = huntDetectRange(vehicleCfg("spermwhale"), -700, day, 7.2);
  const eyeDark = huntDetectRange(vehicleCfg("giantsquid"), -700, day, 7.2);
  const eyeGlow = huntDetectRange(vehicleCfg("giantsquid"), -700, day, 7.2, 1);
  assert(echo > 35, `sperm whale echo detect should be tens of metres, got ${echo.toFixed(1)}`);
  assert(echo > eyeDark * 4, `echo should beat dark vision (${echo.toFixed(1)} vs ${eyeDark.toFixed(1)})`);
  assert(eyeGlow > eyeDark, "photophores should still enlarge giant-squid detect in the DSL");
}

{
  applyPatch(makeTestPatch());
  const bed = { habitat: "benthic", floorClearance: 2.4, diet: "bite", huntTaxa: ["herring"] };
  const satiated = shoalHuntY(12, bed, 0, 0, 0.12, -18);
  const hungry = shoalHuntY(12, bed, 0, 0, 0.88, -18);
  assert(hungry > satiated + 10, `hungry benthic hunter should leave the bed toward prey (${hungry.toFixed(1)} vs ${satiated.toFixed(1)})`);
  assert(Math.abs(hungry - -18) < 6, `hungry benthic hunter should occupy prey depth, got ${hungry.toFixed(1)}`);
  const skipjack = knobsFor("tuna");
  const refuge = shoalHuntY(12, skipjack, 0, 0, 0.1, -8);
  const chase = shoalHuntY(12, skipjack, 0, 0, 0.8, -8);
  assert(Math.abs(chase - -8) < Math.abs(refuge - -8), "hungry skipjack should close on surface prey Y");
  const herring = knobsFor("herring");
  const herringBand = shoalHuntY(12, herring, 0, 0, 0.1, -30);
  const herringGraze = shoalHuntY(12, herring, 0, 0, 0.8, -30);
  assert(Math.abs(herringGraze - -30) < Math.abs(herringBand - -30), "hungry herring should leave DVM toward the Z peak");
  const tooth = knobsFor("toothfish");
  const toothBed = shoalHuntY(12, tooth, 0, 0, 0.1, null);
  const toothSeek = shoalHuntY(12, tooth, 0, 0, 0.8, null);
  assert(toothSeek > toothBed + 40, `hungry toothfish without a lock should leave the bed (${toothSeek.toFixed(0)} vs ${toothBed.toFixed(0)})`);
  assert(schoolBiteRadius({ biteRadius: 2.6 }) >= 3.79, "school bite must reach a hashed-grid cell");
  assert(schoolBiteRadius({ biteRadius: 6 }) === 6, "a larger mouth keeps its radius");
}

{
  applyPatch(makeTestPatch());
  const bloom = new Plankton();
  bloom.photicLight = 0.12;
  bloom.prodIndex = 0.01;
  bloom.meanZ = 0.04;
  bloom.meanP = 0.04;
  const school = new School(800, { hour: 12 });
  const before = school.count;
  school.clipToBloom(bloom);
  assert(before > 200, `lab school should spawn a crowd, got ${before}`);
  assert(school.count <= bloom.carryingCapacity(800) + 24, `clipToBloom should honour the bloom cap (${school.count} vs ${bloom.carryingCapacity(800)})`);
  assert(school.count < before * 0.5, `clipToBloom should drop a seeded crowd (${before} → ${school.count})`);
  const occupied = [];
  for (let s = 0; s < school.maxSchools; s++) if (school.schoolN[s] > 0) occupied.push(school.schoolN[s]);
  assert(occupied.length >= 1, "clip should leave at least one live pack");
  assert(
    occupied.every((n) => n >= 1) && occupied.some((n) => n >= 2 || occupied.length === 1),
    `survivors should pack into live shoals, not one-fish scatter (${occupied.join(",")})`
  );
}

{
  applyPatch(makeTestPatch());
  const bloom = new Plankton();
  bloom.prodIndex = 0.001;
  bloom.meanZ = 0.00005;
  bloom.meanP = 0.00005;
  const dead = bloom.carryingCapacity(4000);
  bloom.prodIndex = 0.4;
  bloom.meanZ = 0.22;
  const live = bloom.carryingCapacity(4000);
  assert(dead < live * 0.5, `a collapsed bloom should carry less than a live one (${dead} vs ${live})`);
  const polar = new Plankton();
  polar.acclimate({ night: 0.9, caustic: 0, sunDir: { y: -0.2 }, storm: 0 }, 12, 0.4);
  const summer = new Plankton();
  summer.acclimate({ night: 0, caustic: 0.85, sunDir: { y: 0.8 }, storm: 0 }, 12, 0.4);
  assert(polar.prodIndex <= summer.prodIndex, "a dark column should not out-produce a lit one");
  assert(polar.photicLight < summer.photicLight, "a dark column should have less photic light");
  assert(
    polar.carryingCapacity(4000) <= summer.carryingCapacity(4000),
    `a dark column should not carry more grazers (${polar.carryingCapacity(4000)} vs ${summer.carryingCapacity(4000)})`
  );
  const dim = new Plankton();
  dim.photicLight = 0.12;
  dim.prodIndex = 0.02;
  dim.meanZ = 0.1;
  const bright = new Plankton();
  bright.photicLight = 0.72;
  bright.prodIndex = 0.3;
  bright.meanZ = 0.22;
  assert(
    dim.carryingCapacity(4000) < bright.carryingCapacity(4000) * 0.45,
    `a dim cold column should carry fewer grazers (${dim.carryingCapacity(4000)} vs ${bright.carryingCapacity(4000)})`
  );
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
  const tunaFloor = oxygenLimitY(knobsFor("tuna"));
  assert(tunaFloor > peruCore, `skipjack should stay above the OMZ core (${tunaFloor.toFixed(0)} vs ${peruCore.toFixed(0)})`);
  assert(oxygenLimitY(knobsFor("humboldtsquid")) < -800, "Humboldt OMZ refuge is not an oxygen ceiling");

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

{
  applyPatch(makeTestPatch());
  const zones = columnZones(-38);
  const ids = zones.map((z) => z.id);
  assert(ids.includes("sunlit"), "lab column should name the sunlit layer");
  assert(ids.includes("twilight"), "2000 m lab should have twilight");
  assert(ids.includes("midnight"), "2000 m lab should have midnight");
  assert(ids.includes("benthos"), "lab column should end at the seafloor");
  const shelf = findWaterAtDepth(0, 2200, -1000, { maxDepth: -2000, clearance: 6 });
  const deepFloor = seafloorHeight(shelf.x, shelf.z);
  assert(deepFloor < -180, `a 1000 m jump from the inner shelf should walk into deeper water (floor ${deepFloor.toFixed(0)})`);
  assert(shelf.y < -180, `placed camera y should be deep, got ${shelf.y.toFixed(0)}`);
}

{
  const saved = {
    lat: CONFIG.world.lat,
    lon: CONFIG.world.lon,
    lab: CONFIG.world.lab,
    floorY: CONFIG.floorY,
    thermoY: CONFIG.thermoY,
    sst: CONFIG.water.sst,
    upwell: CONFIG.water.upwell,
  };

  CONFIG.world.lab = false;
  CONFIG.floorY = -4000;

  assert(climateUpwell(-16, -76) > 0.55, "Peru should be a strong upwelling cell");
  assert(climateUpwell(36, -122) > 0.4, "California Current should upwell");
  assert(climateUpwell(28, -150) < 0.12, "North Pacific gyre should not upwell");
  assert(climateUpwell(56, 3.2) < 0.12, "North Sea should not be an eastern-boundary upwell");

  const calm = mixedLayerY(56, 180, -200, 0);
  const blown = mixedLayerY(56, 180, -200, 1);
  assert(blown < calm - 12, `storms should deepen the mixed layer (calm ${calm.toFixed(1)} storm ${blown.toFixed(1)})`);

  CONFIG.world.lat = -16;
  CONFIG.world.lon = -76;
  bindCellTemperature();
  bindCellUpwell();
  const peru = new Plankton();
  const day = { night: 0, caustic: 0.8, sunDir: { y: 0.7 }, storm: 0 };
  for (let i = 0; i < 12; i++) peru._updateColumn(0.4, day);
  const peruNut = peru.nutriclineY();

  CONFIG.world.lat = 28;
  CONFIG.world.lon = -150;
  bindCellTemperature();
  bindCellUpwell();
  const gyre = new Plankton();
  for (let i = 0; i < 12; i++) gyre._updateColumn(0.4, day);
  const gyreNut = gyre.nutriclineY();
  assert(
    peruNut > gyreNut + 12,
    `Peru nutricline should sit shallower than a gyre (${peruNut.toFixed(0)} vs ${gyreNut.toFixed(0)})`
  );

  CONFIG.water.upwell = 1;
  CONFIG.thermoY = -32;
  const lift = sampleFlow(0, -32, 0, 0, 0);
  assert(lift.y > 0.08, `upwelling cell should have a mean upward flow at the thermocline, got ${lift.y.toFixed(3)}`);

  CONFIG.world.lat = saved.lat;
  CONFIG.world.lon = saved.lon;
  CONFIG.world.lab = saved.lab;
  CONFIG.floorY = saved.floorY;
  CONFIG.thermoY = saved.thermoY;
  CONFIG.water.sst = saved.sst;
  CONFIG.water.upwell = saved.upwell;
}

{
  const ids = ["herring", "capelin", "sandlance", "cod"];
  const taxa = ids.map((id) => ({ id, share: SPECIES[id].share, cfg: knobsFor(id) }));
  const alloc = allocateMixedSchoolCounts(2000, taxa, 2000, 40);
  const shares = Object.fromEntries(alloc.map((r) => [r.id, r.n]));
  assert(shares.herring > shares.cod * 3, "grazer herring should outnumber school-cod on the prey cap");
  assert(shares.cod > 8, "cod still get a prey-capped slice, not a vehicle pair");
  assert(schoolDiet(knobsFor("cod")) === "bite", "cod is a school biter");
  assert(SPECIES.tuna.agent === "school", "skipjack is a school tuna, not a vehicle");
  assert(SPECIES.humboldtsquid.agent === "school", "Humboldt squid is a school pack");
  assert(SPECIES.commondolphin.agent === "vehicle", "common dolphin stays a breathing vehicle");
  assert(SPECIES.bluefin.agent === "vehicle", "bluefin stays a rare vehicle");
  assert(SPECIES.orca.vehicle.count < shares.cod, "orca count stays below school-cod abundance");
}

{
  const ids = ["anchovy", "sardine", "lanternfish", "humboldtsquid", "tuna", "yellowfin", "mahi"];
  const taxa = ids.map((id) => ({ id, share: SPECIES[id].share, cfg: knobsFor(id) }));
  const alloc = allocateMixedSchoolCounts(4000, taxa, 96, 0);
  const byId = Object.fromEntries(alloc.map((r) => [r.id, r.n]));
  const biters = alloc.reduce((n, r) => n + (schoolDiet(knobsFor(r.id)) === "bite" ? r.n : 0), 0);
  const grazers = alloc.reduce((n, r) => n + (schoolDiet(knobsFor(r.id)) !== "bite" ? r.n : 0), 0);
  assert(grazers <= 96 + 4, `tight bloom should cap grazers, got ${grazers}`);
  assert(byId.humboldtsquid >= 1, `Humboldt should still get a pack on a tight bloom, got ${byId.humboldtsquid}`);
  assert(biters <= 20, `piscivores should stay a slice, got ${biters}`);
}

{
  const north = climateIce(56, 3.2, 80);
  const barentsWinter = climateIce(75.4, 32.1, 80);
  const barentsSummer = climateIce(75.4, 32.1, 200);
  const antarcticWinter = climateIce(-64.8, -60.2, 262);
  assert(north === 0, `North Sea should be ice-free, got ${north}`);
  assert(barentsWinter > 0.45, `Barents March should hold pack, got ${barentsWinter.toFixed(2)}`);
  assert(barentsWinter > barentsSummer, "Barents ice should thin toward summer");
  assert(antarcticWinter > 0.5, `Antarctic slope in September should hold pack, got ${antarcticWinter.toFixed(2)}`);
  assert(iceThickness(0.7) > iceThickness(0.2), "thicker pack on higher concentration");
  assert(iceTransmit(0.8) < 0.45, "pack ice should cut under-ice PAR");
  assert(iceTransmit(0) === 1, "open water transmits fully");
}

{
  const saved = { ice: CONFIG.water.ice, iceT: CONFIG.water.iceT, iceH: CONFIG.water.iceH, anomaly: CONFIG.water.iceAnomaly };
  CONFIG.water.ice = 0;
  CONFIG.water.iceT = 1;
  const open = samplePAR(-8, { night: 0, caustic: 1, sunDir: { y: 0.8 }, storm: 0 });
  CONFIG.water.ice = 0.8;
  CONFIG.water.iceT = iceTransmit(0.8);
  const under = samplePAR(-8, { night: 0, caustic: 1, sunDir: { y: 0.8 }, storm: 0 });
  assert(under < open * 0.5, `under-ice PAR should drop (${under.toFixed(3)} vs open ${open.toFixed(3)})`);
  const algae = iceAlgaeWant(-2, 0.4);
  const deep = iceAlgaeWant(-40, 0.4);
  CONFIG.water.ice = saved.ice;
  CONFIG.water.iceT = saved.iceT;
  CONFIG.water.iceH = saved.iceH;
  CONFIG.water.iceAnomaly = saved.anomaly;
  assert(algae > 0.05, "ice algae produces in the film");
  assert(deep === 0, "ice algae is not a 40 m source");
}

{
  applyPatch(makeSyntheticPatch());
  const day = { night: 0, caustic: 0.85, sunDir: { y: 0.8 }, storm: 0 };
  const shelf = new Plankton();
  const ground = seafloorHeight(0, 0);
  const parBed = samplePAR(ground, day);
  assert(parBed > 0.05, `sunlit shelf floor should hold PAR, got ${parBed.toFixed(3)} at ${ground.toFixed(0)} m`);
  for (let i = 0; i < 36; i++) shelf.update(0.4, day, i * 0.4);
  assert(shelf.meanBedP > 0.02, `microphytobenthos should grow on a sunlit shelf, got ${shelf.meanBedP.toFixed(3)}`);
  assert(shelf.meanI > 0.02, `infauna should hold on a sunlit bed, got ${shelf.meanI.toFixed(3)}`);
  const i0 = shelf.sampleInfauna(0, 0);
  const taken = shelf.grazeBenthos(0, 0, 0.08);
  assert(taken > 0, "cod graze should take infauna, not empty carbon");
  assert(shelf.sampleInfauna(0, 0) < i0 - 0.001, "grazeBenthos should deplete infauna");

  applyPatch(makeDemoPatch(demoById("pelagic")));
  const abyss = new Plankton();
  for (let i = 0; i < 36; i++) abyss.update(0.4, day, i * 0.4);
  assert(
    abyss.meanBedP < shelf.meanBedP * 0.45,
    `abyss should not grow a microphyto film (${abyss.meanBedP.toFixed(3)} vs shelf ${shelf.meanBedP.toFixed(3)})`
  );
  applyPatch(makeSyntheticPatch());
}

{
  const savedIce = CONFIG.water.ice;
  CONFIG.water.ice = 0.8;
  const cfg = knobsFor("polarcod");
  const y = dvmY(12, cfg);
  CONFIG.water.ice = savedIce;
  assert(y > -30, `polar cod under pack ice should shoal, got ${y.toFixed(1)}`);
}

{
  assert(solarSinElev(75, 12, 355) < 0, "75°N at December noon is polar night");
  assert(solarSinElev(75, 0, 172) > 0, "75°N at June midnight is midnight sun");
  const day = new DayCycle();
  day.latitude = 75.4;
  day.dayIndex = 355;
  day.setHour(12);
  assert(day.look.night > 0.45, `polar-night noon should stay dark, night=${day.look.night.toFixed(2)}`);
  assert(day.look.name === "Polar night", `phase should be Polar night, got ${day.look.name}`);
  day.dayIndex = 172;
  day.setHour(0);
  assert(day.look.night < 0.4, `midnight sun should not use the 24 h night preset, night=${day.look.night.toFixed(2)}`);
  assert(day.look.name === "Midnight sun", `phase should be Midnight sun, got ${day.look.name}`);
  day.latitude = 56;
  day.dayIndex = 180;
  day.setHour(12);
  assert(day.look.night < 0.15, "North Sea noon is still day");
}

{
  assert(observeDayIndex(-64.8) === 15, "antarctic observe day is austral summer");
  assert(observeDayIndex(75.4) === 172, "arctic observe day is midnight sun");
  assert(observeDayIndex(56) === 180, "North Sea observe day stays 180");
}

{
  applyPatch(makeTestPatch());
  const ff = knobsFor("flyingfish");
  const hunt = shoalHuntY(12, ff, 0, 0, 0.95, -80);
  assert(hunt >= ff.maxDepth - 0.05, `hungry flying fish must not chase Z past maxDepth, got ${hunt.toFixed(1)}`);
  const taxa = [{ id: "flyingfish", cfg: ff, look: lookFor("flyingfish"), share: 1 }];
  const school = new School(40, { hour: 12, taxa });
  const sid0 = school.schoolId[0];
  const c = school.centroids[sid0];
  for (let i = 0; i < school.count; i++) {
    const i3 = i * 3;
    school.pos[i3] = c.x + i * 1.7;
    school.pos[i3 + 1] = -8;
    school.pos[i3 + 2] = c.z;
    school.vel[i3] = 7.2;
    school.vel[i3 + 1] = 0;
    school.vel[i3 + 2] = 0.15;
    school.energy[i] = 0.55;
    school.schoolId[i] = sid0;
  }
  school._refreshCentroids();
  let t = 0;
  const dt = 1 / 30;
  for (let k = 0; k < 180; k++) {
    t += dt;
    school.update(dt, [], { hour: 12, simTime: t, night: 0, tight: 0 }, null);
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let deep = 0;
  for (let i = 0; i < school.count; i++) {
    const i3 = i * 3;
    const x = school.pos[i3];
    const y = school.pos[i3 + 1];
    const z = school.pos[i3 + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
    if (y < ff.maxDepth - 0.6) deep++;
  }
  const spans = [maxX - minX, maxY - minY, maxZ - minZ].sort((a, b) => b - a);
  assert(!deep, `${deep} flying fish sat below maxDepth ${ff.maxDepth} (deepest ${minY.toFixed(1)})`);
  assert(
    spans[0] < spans[1] * 6.5 || spans[0] < 28,
    `loose school should not collapse to a file (${spans.map((s) => s.toFixed(1)).join(" × ")})`
  );
}

{
  applyPatch(makeTestPatch());
  const herring = knobsFor("herring");
  const taxa = [{ id: "herring", cfg: herring, look: lookFor("herring"), share: 1 }];
  const school = new School(220, { hour: 6.2, taxa });
  let t = 0;
  const dt = 1 / 30;
  for (let k = 0; k < 240; k++) {
    t += dt;
    const hour = 6.2 + (k / 240) * 2.4;
    school.update(dt, [], { hour, simTime: t, night: Math.max(0, 1 - (hour - 6.2) / 2), tight: 0 }, null);
  }
  let best = 0;
  let bestSid = 0;
  for (let s = 0; s < school.maxSchools; s++) {
    if (school.schoolN[s] > best) {
      best = school.schoolN[s];
      bestSid = s;
    }
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < school.count; i++) {
    if (school.schoolId[i] !== bestSid) continue;
    const i3 = i * 3;
    const x = school.pos[i3];
    const y = school.pos[i3 + 1];
    const z = school.pos[i3 + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const sx = maxX - minX;
  const sy = maxY - minY;
  const sz = maxZ - minZ;
  const horiz = Math.max(sx, sz);
  assert(
    best > 20,
    `dawn herring commute should keep a live pancake, got ${best}`
  );
  assert(
    sy < horiz * 2.4 || sy < 28,
    `polarized school should not stretch into a depth filament (${sx.toFixed(1)} × ${sy.toFixed(1)} × ${sz.toFixed(1)})`
  );
}

console.log("column physics: 33 checks ok");
