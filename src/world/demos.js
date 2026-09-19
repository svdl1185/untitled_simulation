/**
 * Named kilometres for the Cells picker. Map is still free roam.
 * Coupled rows load a real place (atlas, or a synthetic floor if the
 * atlas is down). Gap rows still open a pelagic cell at that site —
 * the missing biome is named, not faked with a mesh. Polar ice and a
 * living bed (microphytobenthos, infauna, cod graze) are coupled.
 */
import {
  ELEV_NX,
  ELEV_NZ,
  PATCH_SIZE_M,
  chunkIdFromLatLon,
  makeElevationPatch,
  makeSyntheticPatch,
  makeTestPatch,
} from "./patch.js";
import { PRESENCE_IDS, SCHOOL_IDS, SPECIES, VEHICLE_IDS, emptyPresence, fullPresence } from "./fauna.js";
import { faunaIdsPresent, presenceAt } from "./ranges.js";

export const DEMO_CELLS = [
  {
    id: "catalog",
    location: "lab-cell",
    kind: "lab",
    status: "coupled",
    title: "Catalog tank",
    kicker: "2 × 2 km lab",
    region: "Not a real place",
    lat: 22.4,
    lon: -38.2,
    observe: [
      "Every catalogued animal in one cell — coexistence on a shared bloom cap, not a biogeographic range.",
      "Stepped shelves, a canyon, a seamount, and a 2000 m basin so guild depth is visible.",
      "Lab OMZ and a forced upwell so Humboldt’s day refuge and the nutricline still move.",
    ],
    missing: [],
    about:
      "A synthetic 2 × 2 km cell: a beach on +Z, inner shelf near −40 m, mid-shelf near −110 m, outer ledge near −220 m, slope terrace near −800 m, a canyon and a seamount, basin to −2000 m. Every implemented animal is present. Not a real place — a test of the model.",
  },
  {
    id: "pelagic",
    location: "world-cell",
    kind: "atlas",
    status: "coupled",
    title: "Open pelagic",
    kicker: "Coupled · still a thin slice",
    region: "North Atlantic gyre",
    lat: 26.4,
    lon: -41.2,
    observe: [
      "Lanternfish DVM and the deep scattering layer in a clear, deep column.",
      "Flying fish in the top ~20 m; tunas, mahi, and sailfish in the photic.",
      "Sperm whale breath-hold toward squid and lanternfish; giant squid if the floor is deep enough.",
    ],
    missing: [
      "Gelatinous zooplankton, the rest of the mesopelagic fish, beaked whales, and bait-ball hydrodynamics are still gaps.",
    ],
    about:
      "A one-kilometre gyre cell. Clear water, an abyssal floor, no beach. The pelagic loop we actually have: NPZD, forage schools, vehicles. Still a thin slice of the open ocean.",
    fallback: { floorY: -4200, beach: false },
  },
  {
    id: "omz",
    location: "world-cell",
    kind: "atlas",
    status: "coupled",
    title: "Mesopelagic / OMZ",
    kicker: "DSL · Humboldt · sperm",
    region: "Humboldt Current, off Peru",
    lat: -16.0,
    lon: -76.2,
    observe: [
      "Climate upwell shoals the nutricline; anchoveta, sardine, and jack mackerel graze the bloom.",
      "Humboldt squid day DVM follows the OMZ core; tunas stay above their o2Min.",
      "Lanternfish occupy the hole. Sperm whales dive on squid when they are present.",
    ],
    missing: [],
    about:
      "Eastern-boundary upwelling off Peru. Dissolved oxygen, not a clock, is Humboldt’s day refuge. The catalog tank forces an OMZ; this cell earns one from latitude and longitude.",
    extras: ["humboldtsquid", "lanternfish", "anchovy", "sardine", "jackmackerel"],
    fallback: { floorY: -2800, beach: false, eastShallow: -90 },
  },
  {
    id: "shelf",
    location: "north-sea-shelf",
    kind: "atlas",
    status: "coupled",
    title: "North Sea shelf",
    kicker: "Shelf carbon · herring water",
    region: "Central North Sea",
    lat: 56.0,
    lon: 3.2,
    observe: [
      "Herring, sprat, mackerel, and sand lance on a shallow floor — DVM clipped by the sand, not the abyss.",
      "Cod graze living infauna on the bed. Photic floors grow microphytobenthos.",
      "No OMZ. Climate upwell is near zero. Empty of sardinella is a thermal gate.",
    ],
    missing: ["Named worms and crabs, flatfish, and kelp are still gaps — infauna is a density, not a crab."],
    about:
      "A North Sea kilometre: tide, a sandy floor tens of metres down, and the shelf forage the model actually runs. Cod eat living infauna on that bed. Flatfish and kelp are not meshed.",
    extras: ["herring", "sprat", "mackerel", "sandlance", "cod", "shark"],
    fallback: { floorY: -72, beach: true },
  },
  {
    id: "antarctic",
    location: "world-cell",
    kind: "atlas",
    status: "coupled",
    title: "Antarctic slope",
    kicker: "Silverfish · toothfish · krill",
    region: "Southern Ocean slope",
    lat: -64.8,
    lon: -60.2,
    observe: [
      "Antarctic silverfish and krill on a polar clock. Type II graze on z and p.",
      "Toothfish hug the slope floor — not a North Sea cod. Minke filter the bloom and bite.",
      "Sea ice follows latitude and season — pack ice shades PAR; ice algae feeds the top metres.",
      "Cold SST gates tropical tunas out. Empty of skipjack here is a niche, not a missing mesh.",
    ],
    missing: ["Ice types, mapped polynyas, penguins, and icefish are still gaps."],
    about:
      "An Antarctic slope cell. Silverfish, krill, and toothfish are the Southern Ocean loop that exists today. Ice is a field: winter pack here shades the column and grows ice-algal P. Still not a polynya, and penguins are not agents.",
    extras: ["silverfish", "krill", "toothfish", "minke"],
    fallback: { floorY: -1600, beach: false, northShallow: -280 },
  },
  {
    id: "demersal",
    location: "world-cell",
    kind: "atlas",
    status: "coupled",
    title: "Demersal fauna",
    kicker: "Infauna field · MPB · cod",
    region: "North Sea bed",
    lat: 54.9,
    lon: 1.6,
    observe: [
      "Microphytobenthos on the sunlit bed. Infauna density grows from that carbon and from pelagic rain.",
      "Cod graze the living store, not a detritus film. Herring and sand lance still occupy the column.",
    ],
    missing: [
      "Named worms and crabs, flatfish, kelp forests, and grain-size burying are still gaps.",
    ],
    about:
      "A shelf bed with a living loop: photic floors grow carbon, infauna lives on it, cod graze that store. The picker does not invent a plaice to fill the tile.",
    extras: ["cod", "herring", "sandlance", "benthos"],
    fallback: { floorY: -38, beach: true },
  },
  {
    id: "reef",
    location: "world-cell",
    kind: "atlas",
    status: "gap",
    title: "Coral reef",
    kicker: "Calcification · bleaching",
    region: "Belize Barrier Reef, forereef water",
    lat: 16.8,
    lon: -87.4,
    observe: [
      "The pelagic water over a reef latitude: flying fish, barracuda, skipjack, mahi, reef-associated sharks if range covers the cell.",
    ],
    missing: [
      "Hard coral as a field, zooxanthellae, bleaching, rugosity, parrotfish, groupers, and the reef soundscape are not in the model. This kilometre is tropical pelagic, not a reef.",
    ],
    about:
      "Offshore of the Belize Barrier. The atlas floor may be shallow; the animals are the tropical pelagic catalog. Coral is a dashed node on the coupling figure.",
    extras: ["flyingfish", "barracuda", "tuna", "mahi", "hammerhead", "tigershark", "whaleshark"],
    fallback: { floorY: -24, beach: true },
  },
  {
    id: "polar",
    location: "world-cell",
    kind: "atlas",
    status: "coupled",
    title: "Polar ice",
    kicker: "Ice field · PAR · polar cod",
    region: "Barents Sea, north of 74°N",
    lat: 75.4,
    lon: 32.1,
    observe: [
      "Sea-ice concentration from latitude and season. Pack ice shades PAR; leads stay brighter.",
      "Ice algae produces in the top metres; krill graze that P. Polar cod shoal under the ice.",
      "Polar night / midnight sun follow solar elevation at this latitude, not a 24 h clock.",
    ],
    missing: [
      "Ice types, drift, mapped polynyas, seals, walrus, polar bear, and penguins are not in the model.",
    ],
    about:
      "A high-Arctic kilometre. Ice is a field: concentration, thickness, under-ice PAR, and ice-algal P. Polar cod use the underside. Seals and a haul-out are not meshed.",
    extras: ["polarcod", "capelin", "minke", "orca", "humpback"],
    fallback: { floorY: -220, beach: false },
  },
  {
    id: "coast",
    location: "world-cell",
    kind: "atlas",
    status: "gap",
    title: "Coast / estuary",
    kicker: "Mangrove · seagrass · salt",
    region: "Chesapeake mouth",
    lat: 37.05,
    lon: -75.85,
    observe: [
      "Menhaden graze phytoplankton in a shallow, turbid column — the estuarine forage we actually run.",
      "A beach if the atlas cell has land. Blue sharks if school prey is present.",
    ],
    missing: [
      "Estuarine circulation, salt wedge, mangroves, seagrass, oyster reefs, and anadromy are not in the model. Salinity is not a field.",
    ],
    about:
      "Mouth of the Chesapeake. Menhaden on p is the coastal loop that exists. The estuary itself — salt, seagrass, a salt wedge — is still a gap.",
    extras: ["menhaden", "shark", "greatwhite", "benthos"],
    fallback: { floorY: -18, beach: true },
  },
  {
    id: "hadal",
    location: "world-cell",
    kind: "atlas",
    status: "gap",
    title: "Vent / seep / hadal",
    kicker: "Chemosynthesis · trenches",
    region: "Mariana Trench axis",
    lat: 11.32,
    lon: 142.2,
    observe: [
      "A deep pelagic column: lanternfish, giant squid if the floor is deep enough, sperm whale breath-hold.",
      "The seafloor wins on depth. Chemosynthesis does not feed this cell.",
    ],
    missing: [
      "Hydrothermal vents, cold seeps, hadal snailfish, and a chemosynthetic budget are not in the model. A trench floor here is bathymetry, not a vent field.",
    ],
    about:
      "A Mariana kilometre. The floor can be thousands of metres down. Nothing in the catalog eats sulphide. This is the abyss the pelagic loop can already occupy.",
    extras: ["lanternfish", "giantsquid", "spermwhale"],
    fallback: { floorY: -8600, beach: false },
  },
];

const BY_ID = new Map(DEMO_CELLS.map((d) => [d.id, d]));

export function demoById(id) {
  return BY_ID.get(id) || null;
}

function demoEnv(demo) {
  return { floorY: demo?.fallback?.floorY };
}

export function naturalPresence(demo) {
  if (!demo) return emptyPresence();
  if (demo.kind === "lab") return fullPresence(1);
  return presenceAt(demo.lat, demo.lon, demoEnv(demo));
}

export function sandboxIds(demo) {
  if (!demo) return [];
  if (demo.kind === "lab") return PRESENCE_IDS.slice();
  const ids = new Set(faunaIdsPresent(demo.lat, demo.lon, demoEnv(demo)));
  for (const id of demo.extras || []) {
    if (SPECIES[id]) ids.add(id);
  }
  const out = [];
  for (const id of [...SCHOOL_IDS, ...VEHICLE_IDS, "benthos"]) {
    if (ids.has(id)) out.push(id);
  }
  return out;
}

export function defaultToggles(demo) {
  const natural = naturalPresence(demo);
  const toggles = {};
  for (const id of sandboxIds(demo)) toggles[id] = (natural[id] ?? 0) > 0.05;
  if (demo?.kind === "lab") {
    for (const id of PRESENCE_IDS) toggles[id] = true;
  }
  return toggles;
}

export function presenceFromToggles(demo, toggles, base) {
  const natural = base || naturalPresence(demo);
  const p = emptyPresence();
  const pool = new Set(sandboxIds(demo));
  for (const id of PRESENCE_IDS) {
    if (pool.has(id)) {
      if (toggles && Object.prototype.hasOwnProperty.call(toggles, id)) p[id] = toggles[id] ? 1 : 0;
      else p[id] = (natural[id] ?? 0) > 0.05 ? 1 : 0;
    } else {
      p[id] = natural[id] ?? 0;
    }
  }
  return p;
}

export function makeDemoPatch(demo, presence) {
  if (!demo) return makeTestPatch();
  if (demo.kind === "lab") {
    const patch = makeTestPatch();
    if (presence) patch.presence = presence;
    stampDemo(patch, demo);
    return patch;
  }
  if (demo.id === "shelf") {
    const patch = makeSyntheticPatch();
    patch.presence = presence || naturalPresence(demo);
    stampDemo(patch, demo);
    return patch;
  }
  return makeFallbackPatch(demo, presence);
}

export function makeFallbackPatch(demo, presence) {
  const spec = demo.fallback || { floorY: -2000, beach: false };
  const size = PATCH_SIZE_M;
  const nx = ELEV_NX;
  const nz = ELEV_NZ;
  const elevation = new Float32Array(nx * nz);
  const floor = spec.floorY ?? -2000;
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const u = (ix + 0.5) / nx;
      const v = (iz + 0.5) / nz;
      let y = floor;
      if (spec.eastShallow != null) {
        const t = u * u * (3 - 2 * u);
        y = floor + t * (spec.eastShallow - floor);
      } else if (spec.northShallow != null) {
        const t = v * v * (3 - 2 * v);
        y = floor + t * (spec.northShallow - floor);
      }
      if (spec.beach && v > 0.72) {
        const t = (v - 0.72) / 0.28;
        y = y * (1 - t) + 3.4 * t;
      }
      y += Math.sin(u * 18.1 + v * 11.4) * Math.min(8, Math.abs(y) * 0.012);
      elevation[iz * nx + ix] = y;
    }
  }
  const id = chunkIdFromLatLon(demo.lat, demo.lon);
  id.key = `demo:${demo.id}`;
  const patch = makeElevationPatch(id, demo.lat, demo.lon, elevation, nx, nz, {
    sizeM: size,
    synthetic: true,
    presence: presence || naturalPresence(demo),
  });
  stampDemo(patch, demo);
  patch.note = `${patch.note ? `${patch.note} ` : ""}Synthetic floor — atlas did not bind this cell.`.trim();
  return patch;
}

function stampDemo(patch, demo) {
  patch.demoId = demo.id;
  patch.location = demo.location;
  patch.name = demo.title;
  patch.region = demo.region;
  patch.about = demo.about;
  return patch;
}

export function stampLoadedPatch(patch, demo) {
  return stampDemo(patch, demo);
}
