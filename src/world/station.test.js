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
      { id: "humboldtsquid", common: "Humboldt squid", agent: "school", count: 4 },
      { id: "tuna", common: "Skipjack tuna", agent: "school", count: 6 },
      { id: "benthos", common: "Benthos", agent: "field", count: 4 },
    ],
    sharks: [],
  });
  const text = brief.now.join(" ");
  assert(brief.title === "Humboldt Current, off Peru", "title is the place");
  assert(brief.meta.includes("11:13") && brief.meta.includes("Day"), "clock and phase");
  assert(text.includes("Climate upwell"), "upwell is a now-line");
  assert(text.includes("OMZ core"), "OMZ is named");
  assert(text.includes("Anchoveta") && text.includes("Pacific sardine"), "forage clustered");
  assert(text.includes("Deep scattering layer"), "lanternfish as DSL");
  assert(text.includes("Humboldt squid") && text.includes("hashed grid"), "Humboldt on the school grid");
  assert(text.includes("Skipjack tuna") && text.includes("Hunt school prey"), "skipjack is a grid hunter");
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
      { id: "cod", common: "Atlantic cod", agent: "school", count: 2 },
      { id: "benthos", common: "Benthos", agent: "field", count: 12 },
    ],
    sharks: [],
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

{
  const brief = stationBrief({
    loc: { region: "Barents Sea, north of 74°N", about: "A high-Arctic kilometre." },
    patch: { demoId: "polar" },
    hour: 12,
    look: { name: "Midnight sun" },
    lat: 75.4,
    lon: 32.1,
    floorY: -220,
    photicY: -180,
    mixedY: -24,
    nutriclineY: -40,
    ice: 0.72,
    iceH: 1.5,
    iceT: 0.28,
    forageCount: 4000,
    forageCap: 3500,
    census: [
      { id: "polarcod", common: "Polar cod", agent: "school", count: 3800 },
      { id: "benthos", common: "Benthos", agent: "field", count: 8 },
    ],
    sharks: [],
  });
  const text = brief.now.join(" ");
  assert(text.includes("Sea ice 72%"), "ice cover is a now-line");
  assert(text.includes("Ice algae"), "ice algae named");
  assert(text.includes("Polar cod") && text.includes("Under the ice"), "polar cod under ice");
  assert(brief.column.some((row) => row.id === "ice" && row.value.includes("72")), "ice in column");
}

console.log("station brief: 4 checks ok");
