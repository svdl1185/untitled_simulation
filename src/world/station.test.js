import { stationBrief } from "./station.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

{
  const brief = stationBrief({
    loc: {
      name: "Mesopelagic / OMZ",
      region: "Humboldt Current, off Peru",
      about: "Eastern-boundary upwelling off Peru.",
    },
    patch: { demoId: "omz" },
    hour: 11.23,
    look: { name: "Day" },
    lat: -16,
    lon: -76.2,
    floorY: -3494,
    photicY: -514,
    mixedY: -68,
    nutriclineY: -41,
    omzCoreY: -280,
    upwell: 0.7,
    sst: 23.7,
    o2Cam: 5.3,
    parPct: 63,
    meanP: 0.1,
    meanZ: 0.06,
    forageCount: 10601,
    forageCap: 5897,
    census: [
      { id: "anchovy", common: "Anchoveta", agent: "school", count: 4200 },
      { id: "sardine", common: "Pacific sardine", agent: "school", count: 3100 },
      { id: "lanternfish", common: "Lanternfish", agent: "school", count: 1800 },
      { id: "humboldtsquid", common: "Humboldt squid", agent: "vehicle", count: 4 },
      { id: "benthos", common: "Benthos", agent: "field", count: 4 },
    ],
    sharks: [
      { kind: "humboldtsquid", y: -274, surfacing: false, aiMode: "patrol", dead: false },
      { kind: "humboldtsquid", y: -291, surfacing: false, aiMode: "stalk", dead: false },
    ],
  });
  const text = brief.now.join(" ");
  assert(brief.title === "Humboldt Current, off Peru", "title is the place");
  assert(brief.meta.includes("11:13") && brief.meta.includes("Day"), "clock and phase");
  assert(text.includes("Climate upwell"), "upwell is a now-line");
  assert(text.includes("OMZ core"), "OMZ is named");
  assert(text.includes("Anchoveta") && text.includes("Pacific sardine"), "forage clustered");
  assert(text.includes("Deep scattering layer"), "lanternfish as DSL");
  assert(text.includes("Humboldt squid") && text.includes("OMZ core"), "Humboldt day refuge");
  assert(brief.column.some((row) => row.id === "omz" && row.value.includes("280")), "OMZ in column");
  assert(brief.kicker.includes("16.00°S"), "kicker has lat/lon");
}

{
  const brief = stationBrief({
    loc: { region: "Central North Sea", about: "A North Sea kilometre." },
    patch: { demoId: "shelf" },
    hour: 13,
    look: { name: "Day" },
    lat: 56,
    lon: 3.2,
    floorY: -72,
    photicY: -80,
    mixedY: -32,
    nutriclineY: -55,
    upwell: 0.02,
    forageCount: 8000,
    forageCap: 9000,
    census: [
      { id: "herring", common: "Atlantic herring", agent: "school", count: 5000 },
      { id: "cod", common: "Atlantic cod", agent: "vehicle", count: 2 },
      { id: "benthos", common: "Benthos", agent: "field", count: 12 },
    ],
    sharks: [
      { kind: "cod", y: -64, surfacing: false, aiMode: "patrol", dead: false },
    ],
  });
  const text = brief.now.join(" ");
  assert(text.includes("clips") || text.includes("sand"), "shelf DVM hits the floor");
  assert(text.includes("Atlantic herring"), "herring named");
  assert(text.includes("Atlantic cod") && text.includes("bed"), "cod on the bed");
  assert(text.includes("seafloor carbon"), "benthos coupled to cod");
  assert(brief.column.some((row) => row.id === "omz" && row.value === "None"), "no OMZ on the shelf");
  assert((brief.missing || []).length >= 1, "shelf demo keeps its gap note");
}

{
  const brief = stationBrief({
    loc: { region: "World ocean", about: "A map cell." },
    hour: 2,
    look: { name: "Night" },
    lat: 26.4,
    lon: -41.2,
    floorY: -4200,
    photicY: -180,
    mixedY: -40,
    nutriclineY: -90,
    census: [{ id: "spermwhale", common: "Sperm whale", agent: "vehicle", count: 1 }],
    sharks: [{ kind: "spermwhale", y: -1.4, surfacing: true, aiMode: "patrol", dead: false }],
  });
  const text = brief.now.join(" ");
  assert(text.includes("hanging and blowing") || text.includes("at the surface"), "sperm at the air");
  assert(!text.includes("Climate upwell"), "gyre is not an upwell cell");
}

console.log("station brief: 3 checks ok");
