import { attenuationKd, samplePAR, surfacePAR, visualClarity, visualHunter, visualRange } from "./light.js";
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
import { DayCycle, solarSinElev } from "./day.js";
import { CONFIG, breathTargetY, photicLimitY, openPhoticY, columnZones, dvmY } from "../config.js";
import { Plankton, TROPHIC, bedAlgaeWant } from "./plankton.js";
import { presenceAt, rasterHabitat } from "../world/ranges.js";
import { applyPatch, applyPresence, makeSyntheticPatch, makeTestPatch } from "../world/patch.js";
import { faunaPresent } from "../config.js";
import { School } from "./school.js";
import { spawnPredators } from "./shark.js";
import { seafloorHeight, findWaterAtDepth } from "./obstacles.js";
import { vehicleCfg, knobsFor, SPECIES, allocateMixedSchoolCounts, schoolDiet, vehicleCountFor } from "../world/fauna.js";
import { readFileSync } from "node:fs";
import { setCoastPolygons, coastKmAt } from "../world/coast.js";
import { topoPolygons } from "../world/topo.js";

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
  assert(bloom.meanI >= 0, "infauna mean should stay defined after a step");
  assert(bloom.infauna.length === bloom.benthos.length, "infauna is a 2D living store");
  assert(bloom.prodIndex >= 0, "production index should be tracked");
}

{
  const day = { night: 0, caustic: 1, sunDir: { y: 0.8 }, storm: 0 };
  const parShelf = samplePAR(-20, day);
  const parAbyss = samplePAR(-2000, day);
  assert(bedAlgaeWant(-20, parShelf) > 0.05, "photic floors grow microphytobenthos");
  assert(bedAlgaeWant(-2000, parAbyss) === 0, "abyss does not grow microphytobenthos");
  assert(bedAlgaeWant(-8, 0) === 0, "night or zero PAR is not a bed source");
}

{
  applyPatch(makeSyntheticPatch());
  const bloom = new Plankton();
  let x = 0;
  let z = 0;
  let found = false;
  for (let iz = 0; iz < bloom.nz && !found; iz++) {
    for (let ix = 0; ix < bloom.nx && !found; ix++) {
      const i = iz * bloom.nx + ix;
      if (!bloom.wet[i] || bloom.infauna[i] < 0.01) continue;
      x = bloom.minX + (ix + 0.5) * bloom.cellX;
      z = bloom.minZ + (iz + 0.5) * bloom.cellZ;
      found = true;
    }
  }
  assert(found, "synthetic shelf should seed wet infauna");
  const live0 = bloom.sampleInfauna(x, z);
  const carbon0 = bloom.sampleBenthos(x, z);
  const taken = bloom.grazeBenthos(x, z, 0.02);
  assert(taken > 0, "cod bite should take living infauna on a wet shelf");
  assert(bloom.sampleInfauna(x, z) < live0, "grazeBenthos depletes infauna, not a detritus film");
  assert(Math.abs(bloom.sampleBenthos(x, z) - carbon0) < 1e-8, "a bite should not lift bed carbon");
  const day = { night: 0, caustic: 0.9, sunDir: { y: 0.75 }, storm: 0 };
  for (let i = 0; i < 24; i++) bloom.update(0.35, day, i * 0.35);
  assert(bloom.meanI > 0, `shelf infauna should stay alive, got ${bloom.meanI}`);
  assert(bloom.meanB >= 0, "two-box bed carbon stays non-negative");
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
  const topo = JSON.parse(readFileSync(new URL("../../public/world/land-50m.json", import.meta.url)));
  setCoastPolygons(topoPolygons(topo, "land"));
  const hawaii = coastKmAt(21.2, -157.8);
  const gyre = coastKmAt(12, -30);
  assert(hawaii != null && hawaii < 80, `Hawaii should sit near land, got ${hawaii} km`);
  assert(gyre > 500, `open Atlantic gyre should be far from land, got ${gyre} km`);
}

{
  const mid = presenceAt(12, -30, { floorY: -4000, dayOfYear: 180 });
  assert(mid.lanternfish > 0, "tropical Atlantic should have lanternfish");
  assert(mid.giantsquid > 0, "abyssal tropical cell should hold giant squid");
  assert(mid.flyingfish > 0, "tropical gyre should hold flying fish");
  assert(!(mid.menhaden > 0), "menhaden is an inner-shelf fish");
  assert(!(mid.cod > 0), "cod should not occupy a tropical gyre");

  const north = presenceAt(56, 3.2, { floorY: -71, dayOfYear: 180 });
  assert(north.herring > 0, "North Sea lat/lon is herring water");
  assert(!(north.sardinella > 0), "sardinella thermal niche should drop the North Sea");
  assert(!(north.giantsquid > 0), "North Sea shelf is too shallow for giant squid");
  assert(!(north.spermwhale > 0), "sperm whales are oceanic, not a 71 m shelf");
  assert(!(north.lanternfish > 0), "lanternfish should drop on the inner shelf");
  assert(!(north.flyingfish > 0), "flying fish should drop in the North Sea");
  assert(!(north.humboldtsquid > 0), "North Sea should not hold Humboldt squid");
  assert(north.cod > 0, "June North Sea shelf should hold cod");
  assert(north.minke > 0, "June North Sea is minke feeding water");

  const northJan = presenceAt(56, 3.2, { floorY: -71, dayOfYear: 15 });
  assert(northJan.herring > 0, "herring occupancy is year-round in the hull");
  assert(!(northJan.minke > 0), "January North Sea should drop minke feeding occupancy");
  assert(!(northJan.humpback > 0), "January North Sea should drop humpback feeding occupancy");

  const hawaiiJan = presenceAt(21.2, -157.8, { floorY: -2000, dayOfYear: 15 });
  assert(hawaiiJan.humpback > 0, "Hawaii in January is humpback wintering water");
  const hawaiiJun = presenceAt(21.2, -157.8, { floorY: -2000, dayOfYear: 180 });
  assert(!(hawaiiJun.humpback > 0), "Hawaii in June should empty the breeding hull");

  const chesapeake = presenceAt(36.2, -75.0, { floorY: -18, dayOfYear: 180 });
  assert(chesapeake.menhaden > 0, "Chesapeake inner shelf should hold menhaden");
  assert(!(chesapeake.spermwhale > 0), "inner shelf should drop sperm whales");
  assert(!(chesapeake.lanternfish > 0), "inner shelf should drop lanternfish");

  const iceEdge = presenceAt(72, 20, { floorY: -200, dayOfYear: 180 });
  assert(iceEdge.polarcod > 0, "high Arctic summer should hold polar cod");

  const norwayJun = presenceAt(68, 5, { floorY: -300, dayOfYear: 180 });
  const norwayJan = presenceAt(68, 5, { floorY: -300, dayOfYear: 15 });
  assert(norwayJun.herring > 0, "Norwegian Sea summer is herring feeding water");
  assert(!(norwayJan.herring > 0), "Norwegian Sea winter should drop feeding occupancy");
  const lofotenJan = presenceAt(68.5, 15, { floorY: -200, dayOfYear: 15 });
  assert(lofotenJan.herring > 0, "Vestfjorden winter should hold overwintering herring");

  const nfldMay = presenceAt(70.5, 25, { floorY: -80, dayOfYear: 150 });
  const nfldJan = presenceAt(70.5, 25, { floorY: -80, dayOfYear: 15 });
  assert(nfldMay.capelin > 0.8, "Barents spring should boost spawning capelin");
  assert(nfldJan.capelin > 0 && nfldJan.capelin < nfldMay.capelin, "Barents winter capelin should sit on the feeding prior");

  const gulfApr = presenceAt(29, -89.5, { floorY: -40, dayOfYear: 120 });
  const gulfJan = presenceAt(29, -89.5, { floorY: -40, dayOfYear: 15 });
  assert(gulfApr.bluefin > 0, "Gulf of Mexico in April is bluefin spawning water");
  assert(!(gulfJan.bluefin > 0), "Gulf of Mexico in January should drop spawn occupancy");

  const ningalooApr = presenceAt(-22, 114, { floorY: -80, dayOfYear: 105 });
  const ningalooOct = presenceAt(-22, 114, { floorY: -80, dayOfYear: 288 });
  assert(ningalooApr.whaleshark > 0.6, "Ningaloo in April is a whale-shark aggregation");
  assert(ningalooOct.whaleshark > 0 && ningalooOct.whaleshark < ningalooApr.whaleshark, "Ningaloo October should fall back to the tropical prior");

  const cafeMar = presenceAt(28, -132, { floorY: -4000, dayOfYear: 60 });
  const cafeJun = presenceAt(28, -132, { floorY: -4000, dayOfYear: 180 });
  assert(cafeMar.greatwhite > 0, "White Shark Café in March should hold great whites");
  assert(!(cafeJun.greatwhite > 0), "White Shark Café in June should empty");

  const wiki = { dayOfYear: 180, trophic: false };
  assert(presenceAt(24, -76, { floorY: -80, ...wiki }).tigershark > 0, "Bahamas is tiger-shark water");
  assert(presenceAt(21.2, -157.8, { floorY: -2000, ...wiki }).tigershark > 0, "Hawaii is tiger-shark water");
  assert(!(presenceAt(12, -30, { floorY: -4000, ...wiki }).tigershark > 0), "open Atlantic gyre is not tiger-shark habitat");
  assert(!(presenceAt(36, 15, { floorY: -200, ...wiki }).tigershark > 0), "Mediterranean is not tiger-shark habitat");
  assert(presenceAt(36, 15, { floorY: -200, ...wiki }).hammerhead > 0, "scalloped hammerhead reaches the Mediterranean");
  assert(!(presenceAt(56, 3.2, { floorY: -71, ...wiki }).tigershark > 0), "North Sea is not tiger-shark habitat");
  assert(presenceAt(12, -30, { floorY: -4000, ...wiki }).tuna > 0, "tropical gyre is skipjack water");
  assert(!(presenceAt(36, 15, { floorY: -200, ...wiki }).tuna > 0), "skipjack should not fill the Mediterranean");

  const chesJan = presenceAt(36.2, -75.0, { floorY: -18, dayOfYear: 15 });
  const chesJun = presenceAt(36.2, -75.0, { floorY: -18, dayOfYear: 180 });
  assert(chesJan.menhaden > 0, "winter Chesapeake still holds menhaden — occupancy is abundance, not an empty cell");
  assert(chesJun.menhaden > chesJan.menhaden, "summer should raise menhaden abundance in the same hull");

  const offshore = presenceAt(8, -40, { floorY: -4000, ...wiki });
  assert(!(offshore.tigershark > 0), "open water hundreds of km off Brazil is not tiger-shark habitat");

  const pack = rasterHabitat({
    cols: 90,
    rows: 42,
    ids: ["tigershark", "tuna"],
    dayOfYear: 180,
  });
  const at = (lat, lon) => {
    const i = Math.max(0, Math.min(pack.cols - 1, (((lon + 180) / 360) * pack.cols) | 0));
    const j = Math.max(0, Math.min(pack.rows - 1, (((pack.north - lat) / (pack.north - pack.south)) * pack.rows) | 0));
    return j * pack.cols + i;
  };
  assert(pack.grid.tigershark[at(24, -76)] > 0.05, "overlay should paint tiger sharks on the Bahamas shelf");
  assert(!(pack.grid.tigershark[at(12, -30)] > 0.05), "overlay should not paint tiger sharks in the gyre");
  assert(pack.grid.tuna[at(12, -30)] > 0.05, "overlay should paint skipjack across the tropical gyre");

  assert(vehicleCountFor("commondolphin", 0.3) < vehicleCountFor("commondolphin", 1), "vehicle count should scale with presence weight");
  assert(vehicleCountFor("spermwhale", 0.4) === 1, "a scarce vehicle should still seed one when present");
}

{
  const day = new DayCycle();
  const start = day.dayIndex;
  day.auto = true;
  day.hour = 10.4;
  day.update(CONFIG.time.dayLength);
  assert(day.dayIndex === start, "live clock should not tick the calendar");
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
  applyPatch(makeSyntheticPatch());
  applyPresence({ herring: 1, benthos: 1 });
  const bloom = new Plankton();
  let planted = null;
  for (let iz = 0; iz < bloom.nz; iz += 4) {
    for (let ix = 0; ix < bloom.nx; ix += 4) {
      const i = iz * bloom.nx + ix;
      if (!bloom.wet[i]) continue;
      const x = bloom.minX + (ix + 0.5) * bloom.cellX;
      const z = bloom.minZ + (iz + 0.5) * bloom.cellZ;
      if (z > -30 || Math.hypot(x, z) < 100) continue;
      bloom.z[i] = 2;
      planted = { x, z };
      break;
    }
    if (planted) break;
  }
  assert(planted, "should find a wet offshore cell to plant a bloom");
  const peak = bloom.peakLayer(TROPHIC.Z);
  assert(peak && Math.hypot(peak.x - planted.x, peak.z - planted.z) < 8, "peakLayer should see the planted cell");
  const school = new School(400, { hour: 12, plankton: bloom });
  let hx = 0;
  let hz = 0;
  let n = 0;
  for (let s = 0; s < school.maxSchools; s++) {
    if (!school.schoolN[s]) continue;
    hx += school.anchors[s].x;
    hz += school.anchors[s].z;
    n += 1;
  }
  assert(n > 0, "herring shoals should spawn");
  hx /= n;
  hz /= n;
  const toPeak = Math.hypot(hx - peak.x, hz - peak.z);
  const toOrigin = Math.hypot(hx, hz);
  assert(toPeak < toOrigin, `grazer home should sit nearer the bloom peak than the origin (peak ${toPeak.toFixed(0)} origin ${toOrigin.toFixed(0)})`);
}

console.log("column physics: 24 checks ok");
