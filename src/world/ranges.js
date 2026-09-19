/**
 * Range polygons until AquaMaps/OBIS slot into the atlas.
 * Wikipedia / IUCN / Cypron world maps are sampled onto 360×170 rasters
 * (`scripts/wiki_ranges.json`, `scripts/build_wiki_range.py`) when a map
 * matches the catalog grain. Hulls remain for taxa with no such map, and
 * as seasonal occupancy on top of a raster.
 *
 * A neritic hull is an envelope (which ocean, which coast), not the painted
 * range. `coastKm` clips it to kilometres from Natural Earth land so Overlay
 * follows the shoreline instead of an axis-aligned box. Do not ship a
 * four-corner rectangle as the visible habitat.
 *
 * Every species whose hull covers the cell is present. Overlap is real
 * habitat, not a bug: Humboldt can hold anchoveta and sardine; the North
 * Sea can hold herring, mackerel, sharks, and cod in one patch.
 * Predators still need prey in the cell (trophic gate), not a lat split.
 * Occupancy with a season floor scales abundance and does not empty a
 * year-round hull.
 */

import { emptyPresence, PRESENCE_IDS, SCHOOL_IDS, SPECIES, speciesLabel, isForagePrey } from "./fauna.js";
import { climatologySST } from "../simulation/temperature.js";
import { inOxygenNiche } from "../simulation/oxygen.js";
import { climateIce } from "../simulation/ice.js";
import { climateUpwell } from "../simulation/flow.js";
import { CONFIG } from "../config.js";
import { coastKmAt, coastWeight, fillRings } from "./coast.js";
import { WIKI_IDS, wikiMeta, applyWikiPresence, stampWikiRaster } from "./wikiRange.js";

const HERRING_RESIDENT = [
  [
    [-12, 48],
    [-12, 62],
    [14, 62],
    [30, 60],
    [30, 53],
    [12, 50],
    [2, 48],
    [-8, 48],
  ],
  [
    [-70, 41],
    [-69, 42.5],
    [-66, 44],
    [-64, 45],
    [-64, 42],
    [-67, 41],
  ],
];

const HERRING_FEED = [
  [
    [-44, 60],
    [-44, 72],
    [-20, 76],
    [8, 78],
    [40, 76],
    [40, 68],
    [20, 66],
    [0, 64],
    [-12, 62],
    [-28, 62],
  ],
];

const HERRING_WINTER = [
  [
    [10, 66],
    [20, 67],
    [20, 71],
    [12, 71],
    [8, 69],
  ],
];

const CAPELIN_HULLS = [
  [
    [-170, 52],
    [-155, 66],
    [-80, 76],
    [-20, 80],
    [40, 78],
    [58, 70],
    [44, 64],
    [20, 68],
    [-8, 64],
    [-44, 56],
    [-64, 52],
    [-72, 56],
    [-168, 54],
  ],
];

const CAPELIN_SPAWN = [
  [
    [-60, 46],
    [-52, 46],
    [-52, 52],
    [-60, 52],
  ],
  [
    [18, 69],
    [32, 69],
    [32, 72],
    [18, 72],
  ],
  [
    [-24, 63],
    [-13, 63],
    [-13, 66],
    [-24, 66],
  ],
];

const MENHADEN_HULLS = [
  [
    [-97, 18],
    [-97, 30],
    [-88, 31],
    [-84, 30],
    [-81, 25],
    [-80, 32],
    [-76, 35],
    [-74, 41],
    [-70, 42],
    [-67, 41],
    [-70, 36],
    [-76, 31],
    [-81, 24],
    [-89, 21],
  ],
];

const SARDINE_HULLS = [
  [
    [-126, 24],
    [-126, 48],
    [-116, 48],
    [-110, 32],
    [-110, 22],
    [-116, 22],
  ],
  [
    [-84, 4],
    [-84, -46],
    [-70, -46],
    [-70, 4],
  ],
  [
    [128, 28],
    [128, 46],
    [150, 46],
    [150, 28],
  ],
  [
    [8, -16],
    [8, -36],
    [20, -36],
    [20, -16],
  ],
  [
    [18, -26],
    [18, -38],
    [34, -38],
    [34, -26],
  ],
  [
    [110, -28],
    [110, -44],
    [180, -44],
    [180, -28],
  ],
  [
    [-180, -32],
    [-180, -44],
    [-170, -44],
    [-170, -32],
  ],
];

const PILCHARD_HULLS = [
  [
    [-18, 14],
    [-18, 48],
    [-8, 51],
    [2, 50],
    [12, 44],
    [36, 42],
    [36, 30],
    [12, 31],
    [0, 35],
    [-10, 28],
    [-17, 16],
  ],
];

const ANCHOVY_HULLS = [
  [
    [-84, 6],
    [-84, -42],
    [-70, -42],
    [-70, 6],
  ],
  [
    [-126, 24],
    [-126, 50],
    [-116, 50],
    [-112, 28],
    [-116, 24],
  ],
  [
    [118, 28],
    [118, 46],
    [148, 46],
    [148, 28],
  ],
  [
    [-10, 34],
    [-8, 48],
    [8, 46],
    [42, 46],
    [42, 40],
    [28, 36],
    [10, 35],
    [-5, 35],
  ],
];

const SARDINELLA_HULLS = [
  [
    [-62, 28],
    [-80, 28],
    [-90, 22],
    [-98, 18],
    [-90, 8],
    [-60, -4],
    [-40, -8],
    [-8, -4],
    [12, 6],
    [8, 18],
    [-16, 16],
    [-18, 12],
    [-60, 8],
  ],
  [
    [-10, -8],
    [-10, 10],
    [14, 10],
    [14, -8],
  ],
  [
    [38, 24],
    [38, -28],
    [78, -22],
    [120, -22],
    [152, -18],
    [152, 10],
    [130, 12],
    [120, 22],
    [78, 24],
  ],
  [
    [142, -24],
    [156, -24],
    [156, -10],
    [142, -10],
  ],
];

const MACKEREL_HULLS = [
  [
    [-76, 35],
    [-76, 62],
    [-44, 68],
    [-8, 72],
    [20, 70],
    [30, 58],
    [20, 42],
    [8, 36],
    [-8, 36],
    [-20, 38],
    [-50, 38],
  ],
  [
    [-126, 22],
    [-126, 46],
    [-110, 46],
    [-110, 22],
  ],
  [
    [128, 26],
    [128, 46],
    [150, 46],
    [150, 26],
  ],
  [
    [-84, 0],
    [-84, -42],
    [-70, -42],
    [-70, 0],
  ],
];

const SPRAT_HULLS = [
  [
    [-12, 48],
    [-8, 62],
    [12, 66],
    [30, 60],
    [28, 52],
    [12, 50],
    [0, 48],
  ],
];

const SANDLANCE_HULLS = [
  [
    [-76, 36],
    [-70, 52],
    [-44, 62],
    [-8, 66],
    [18, 62],
    [22, 50],
    [8, 42],
    [-20, 38],
    [-60, 36],
  ],
  [
    [-170, 48],
    [-155, 62],
    [-140, 58],
    [-122, 50],
    [-122, 36],
    [-128, 34],
    [-160, 42],
  ],
  [
    [128, 36],
    [128, 52],
    [150, 50],
    [148, 36],
  ],
];

const POLARCOD_HULLS = [
  [
    [-180, 66],
    [-180, 88],
    [180, 88],
    [180, 66],
  ],
];

/** Pleuragramma: high Antarctic, not the whole ACC. */
const SILVERFISH_HULLS = [
  [
    [-180, -80],
    [-180, -60],
    [0, -60],
    [0, -80],
  ],
  [
    [0, -80],
    [0, -60],
    [180, -60],
    [180, -80],
  ],
];

/** Euphausia superba reaches the polar front. */
const KRILL_SO_HULLS = [
  [
    [-180, -80],
    [-180, -54],
    [0, -54],
    [0, -80],
  ],
  [
    [0, -80],
    [0, -54],
    [180, -54],
    [180, -80],
  ],
];

const SAURY_HULLS = [
  [
    [140, 30],
    [140, 48],
    [180, 50],
    [180, 32],
  ],
  [
    [-180, 32],
    [-180, 50],
    [-122, 48],
    [-122, 30],
  ],
];

const MARKETSQUID_HULLS = [
  [
    [-126, 26],
    [-126, 46],
    [-116, 46],
    [-116, 26],
  ],
  [
    [-12, 36],
    [-8, 58],
    [12, 58],
    [20, 44],
    [8, 36],
  ],
  [
    [128, 30],
    [128, 44],
    [146, 44],
    [146, 30],
  ],
  [
    [-6, 30],
    [8, 44],
    [36, 42],
    [36, 32],
    [10, 30],
  ],
];

const HUMPBACK_FEED = [
  [
    [-170, 50],
    [-140, 62],
    [-120, 50],
    [-122, 36],
    [-150, 36],
  ],
  [
    [-76, 36],
    [-70, 52],
    [-44, 64],
    [-8, 70],
    [20, 68],
    [24, 52],
    [8, 42],
    [-20, 38],
  ],
  [
    [140, -32],
    [140, -64],
    [180, -64],
    [180, -32],
  ],
  [
    [-180, -32],
    [-180, -64],
    [-160, -64],
    [-160, -32],
  ],
  [
    [-180, -52],
    [-180, -70],
    [0, -70],
    [0, -52],
  ],
  [
    [0, -52],
    [0, -70],
    [180, -70],
    [180, -52],
  ],
  [
    [18, -30],
    [18, -42],
    [32, -42],
    [32, -30],
  ],
  [
    [-84, -32],
    [-84, -48],
    [-70, -48],
    [-70, -32],
  ],
];

const HUMPBACK_BREED = [
  [
    [-178, 18],
    [-178, 28],
    [-154, 28],
    [-154, 18],
  ],
  [
    [-116, 20],
    [-116, 32],
    [-105, 32],
    [-105, 20],
  ],
  [
    [-85, 10],
    [-85, 22],
    [-60, 22],
    [-60, 10],
  ],
  [
    [-82, -4],
    [-82, 12],
    [-75, 12],
    [-75, -4],
  ],
  [
    [-176, -24],
    [-176, -15],
    [-170, -15],
    [-170, -24],
  ],
  [
    [174, -24],
    [174, -15],
    [180, -15],
    [180, -24],
  ],
  [
    [-84, -2],
    [-84, -18],
    [-70, -18],
    [-70, -2],
  ],
];

const COD_HULLS = [
  [
    [-76, 42],
    [-68, 42],
    [-55, 46],
    [-48, 52],
    [-44, 60],
    [-52, 68],
    [-65, 60],
    [-76, 52],
  ],
  [
    [-24, 48],
    [-10, 43],
    [2, 43],
    [12, 50],
    [24, 60],
    [44, 72],
    [52, 76],
    [30, 78],
    [8, 72],
    [-8, 64],
    [-20, 58],
    [-24, 52],
  ],
];

const MINKE_NH = [
  [
    [-76, 48],
    [-60, 45],
    [-44, 50],
    [-20, 52],
    [8, 50],
    [30, 58],
    [50, 72],
    [40, 78],
    [10, 78],
    [-20, 76],
    [-50, 70],
    [-70, 62],
  ],
  [
    [140, 42],
    [155, 44],
    [180, 50],
    [180, 66],
    [160, 66],
    [145, 58],
    [140, 50],
  ],
  [
    [-180, 50],
    [-140, 48],
    [-122, 50],
    [-125, 60],
    [-150, 66],
    [-180, 66],
  ],
];

const MINKE_SH = [
  [
    [-180, -70],
    [-180, -50],
    [0, -50],
    [0, -70],
  ],
  [
    [0, -70],
    [0, -50],
    [180, -50],
    [180, -70],
  ],
];

const BLUEFIN_FEED = [
  [
    [-76, 36],
    [-76, 70],
    [25, 72],
    [25, 42],
    [10, 36],
    [-20, 36],
  ],
  [
    [140, 32],
    [140, 48],
    [180, 48],
    [180, 32],
  ],
  [
    [-180, 32],
    [-180, 48],
    [-120, 48],
    [-120, 32],
  ],
];

const BLUEFIN_SPAWN = [
  [
    [-97, 18],
    [-81, 18],
    [-81, 30],
    [-97, 30],
  ],
  [
    [-6, 30],
    [36, 30],
    [36, 42],
    [8, 44],
    [-6, 38],
  ],
  [
    [120, 18],
    [145, 18],
    [145, 32],
    [120, 32],
  ],
];

const TROPICAL_OCEANIC = [
  [
    [-98, 8],
    [-90, 28],
    [-82, 34],
    [-75, 42],
    [-8, 42],
    [-8, 32],
    [16, 18],
    [18, -8],
    [16, -36],
    [-15, -40],
    [-45, -42],
    [-72, -32],
    [-82, -8],
    [-98, 12],
  ],
  [
    [20, -36],
    [20, 12],
    [32, 28],
    [60, 26],
    [78, 24],
    [100, 22],
    [128, 8],
    [128, -38],
    [110, -42],
    [40, -42],
  ],
  [
    [100, -8],
    [108, 20],
    [122, 36],
    [150, 42],
    [180, 42],
    [180, -42],
    [150, -44],
    [110, -40],
  ],
  [
    [-180, 42],
    [-120, 42],
    [-72, 32],
    [-72, -40],
    [-180, -42],
  ],
];

const MED_HULL = [
  [
    [-6, 30],
    [12, 30],
    [36, 32],
    [36, 42],
    [8, 45],
    [-6, 38],
  ],
];

/** Sphyraena: coastal tropics of the Atlantic and Indo-West Pacific, not the eastern Pacific. */
const TROPICAL_COASTAL = [
  [
    [-98, 18],
    [-94, 30],
    [-84, 30],
    [-80, 28],
    [-81, 40],
    [-70, 36],
    [-62, 26],
    [-58, 12],
    [-48, -2],
    [-34, -8],
    [-34, -28],
    [-48, -34],
    [-58, -22],
    [-70, 2],
    [-78, 10],
    [-88, 16],
  ],
  [
    [-179, 18],
    [-154, 18],
    [-154, 29],
    [-179, 29],
  ],
  [
    [-18, 20],
    [-5, 16],
    [10, 6],
    [16, -8],
    [20, -34],
    [10, -35],
    [-5, -18],
    [-18, 6],
  ],
  [
    [28, -36],
    [50, -28],
    [58, -8],
    [44, 14],
    [50, 26],
    [78, 24],
    [96, 16],
    [100, -8],
    [80, -20],
    [44, -12],
    [32, -28],
  ],
  [
    [100, -12],
    [108, 18],
    [122, 34],
    [146, 36],
    [156, 18],
    [180, -10],
    [180, -42],
    [148, -46],
    [112, -40],
    [108, -22],
  ],
  [
    [-180, -10],
    [-170, -18],
    [-170, -42],
    [-180, -42],
  ],
];

const COMMON_DOLPHIN_HULLS = [
  [
    [-80, 28],
    [-70, 50],
    [-8, 55],
    [-6, 36],
    [-20, 30],
    [-62, 28],
  ],
  ...MED_HULL,
  [
    [-130, 22],
    [-116, 42],
    [-110, 32],
    [-110, 18],
    [-120, 18],
  ],
  [
    [-82, 4],
    [-70, -42],
    [-78, -42],
    [-84, -8],
  ],
  [
    [128, 28],
    [148, 44],
    [148, 30],
    [132, 28],
  ],
  [
    [165, -32],
    [180, -32],
    [180, -48],
    [165, -48],
  ],
  [
    [-180, -32],
    [-170, -32],
    [-170, -48],
    [-180, -48],
  ],
  [
    [14, -26],
    [36, -26],
    [36, -38],
    [14, -38],
  ],
  [
    [110, -32],
    [154, -32],
    [154, -44],
    [110, -44],
  ],
];

const WHALESHARK_NINGALOO = [
  [
    [112, -24],
    [118, -24],
    [118, -20],
    [112, -20],
  ],
];

const WHALESHARK_YUCATAN = [
  [
    [-92, 18],
    [-86, 18],
    [-86, 24],
    [-92, 24],
  ],
];

const WHALESHARK_MOZ = [
  [
    [32, -26],
    [38, -26],
    [38, -20],
    [32, -20],
  ],
];

/** East Pacific margin from the CCS to Chile — envelope, then coastKm. */
const HUMBOLDT_COAST = [
  [
    [-126, 46],
    [-126, 38],
    [-122, 30],
    [-116, 24],
    [-110, 18],
    [-102, 12],
    [-92, 6],
    [-86, 0],
    [-82, -10],
    [-82, -22],
    [-78, -34],
    [-74, -46],
    [-70, -46],
    [-70, -36],
    [-72, -22],
    [-76, -8],
    [-80, 4],
    [-88, 12],
    [-98, 18],
    [-110, 24],
    [-118, 32],
    [-124, 40],
    [-124, 46],
  ],
];

/** Nigmatullin equatorial tongue, west toward 140°W. Not a filled gyre. */
const HUMBOLDT_EQUATOR = [
  [
    [-140, 8],
    [-110, 10],
    [-88, 5],
    [-82, 0],
    [-88, -5],
    [-110, -10],
    [-140, -8],
  ],
];

const JACKMACKEREL_HULLS = [
  [
    [-126, 22],
    [-126, 48],
    [-116, 48],
    [-110, 32],
    [-110, 22],
  ],
  [
    [-84, 8],
    [-84, -46],
    [-70, -46],
    [-70, 8],
  ],
  [
    [128, 28],
    [128, 44],
    [148, 44],
    [148, 28],
  ],
  [
    [165, -48],
    [165, -32],
    [180, -32],
    [180, -48],
  ],
  [
    [-180, -48],
    [-180, -32],
    [-170, -32],
    [-170, -48],
  ],
];

/** Trachurus murphyi oceanic spawning belt west of Chile. */
const JACKMACKEREL_BELT = [
  [
    [-120, -32],
    [-92, -30],
    [-78, -36],
    [-78, -48],
    [-96, -50],
    [-120, -44],
  ],
];

const ILLEX_HULLS = [
  [
    [-76, 35],
    [-76, 52],
    [-40, 52],
    [-40, 35],
  ],
  [
    [-70, -55],
    [-70, -32],
    [-40, -32],
    [-40, -55],
  ],
];

const KRILL_NA_HULLS = [
  [
    [-70, 42],
    [-70, 72],
    [20, 76],
    [32, 58],
    [8, 48],
    [-24, 42],
  ],
];

export function pointInPolygon(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const hit = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function inAny(lon, lat, hulls) {
  for (let i = 0; i < hulls.length; i++) {
    if (pointInPolygon(lon, lat, hulls[i])) return true;
  }
  return false;
}

function wrapLon(lon) {
  let x = lon;
  while (x < -180) x += 360;
  while (x > 180) x -= 360;
  return x;
}

const RANGES = [
  { id: "herring", hulls: HERRING_RESIDENT },
  { id: "herring", hulls: HERRING_FEED, season: { peak: 210, width: 95 } },
  { id: "herring", hulls: HERRING_WINTER, season: { peak: 15, width: 70 } },
  { id: "capelin", hulls: CAPELIN_HULLS, occupancy: 0.5 },
  { id: "capelin", hulls: CAPELIN_SPAWN, season: { peak: 150, width: 50 } },
  { id: "menhaden", hulls: MENHADEN_HULLS, coastKm: 200, season: { peak: 210, width: 120, floor: 0.4 } },
  { id: "sardine", hulls: SARDINE_HULLS, coastKm: 420 },
  { id: "pilchard", hulls: PILCHARD_HULLS, coastKm: 280 },
  { id: "anchovy", hulls: ANCHOVY_HULLS, coastKm: 380 },
  { id: "sardinella", hulls: SARDINELLA_HULLS, coastKm: 480 },
  { id: "mackerel", hulls: MACKEREL_HULLS, coastKm: 750 },
  { id: "sprat", hulls: SPRAT_HULLS },
  { id: "sandlance", hulls: SANDLANCE_HULLS },
  { id: "polarcod", hulls: POLARCOD_HULLS },
  { id: "silverfish", hulls: SILVERFISH_HULLS },
  { id: "saury", hulls: SAURY_HULLS },
  { id: "marketsquid", hulls: MARKETSQUID_HULLS, coastKm: 380 },
  { id: "jackmackerel", hulls: JACKMACKEREL_HULLS, coastKm: 900 },
  { id: "jackmackerel", hulls: JACKMACKEREL_BELT },
  { id: "illex", hulls: ILLEX_HULLS, coastKm: 650 },
  { id: "krill", hulls: [...KRILL_SO_HULLS, ...KRILL_NA_HULLS] },
  { id: "toothfish", hulls: SILVERFISH_HULLS },
  { id: "cod", hulls: COD_HULLS, coastKm: 900 },
  { id: "humpback", hulls: HUMPBACK_FEED, season: { peak: 210, width: 80 } },
  { id: "humpback", hulls: HUMPBACK_BREED, season: { peak: 30, width: 70 } },
  { id: "humboldtsquid", hulls: HUMBOLDT_COAST, coastKm: 950 },
  { id: "humboldtsquid", hulls: HUMBOLDT_EQUATOR },
  { id: "minke", hulls: MINKE_NH, season: { peak: 210, width: 100 }, coastKm: 1600 },
  { id: "minke", hulls: MINKE_SH, season: { peak: 210, width: 100 } },
  { id: "bluefin", hulls: [BLUEFIN_FEED[0]], season: { peak: 210, width: 110 } },
  { id: "bluefin", hulls: [BLUEFIN_FEED[1], BLUEFIN_FEED[2]], season: { peak: 210, width: 110 }, coastKm: 700 },
  { id: "bluefin", hulls: BLUEFIN_SPAWN, season: { peak: 120, width: 55, absolute: true }, coastKm: 450 },
  { id: "whaleshark", hulls: WHALESHARK_NINGALOO, season: { peak: 105, width: 55, absolute: true }, coastKm: 180 },
  { id: "whaleshark", hulls: WHALESHARK_YUCATAN, season: { peak: 210, width: 50, absolute: true }, coastKm: 220 },
  { id: "whaleshark", hulls: WHALESHARK_MOZ, season: { peak: 15, width: 55, absolute: true }, coastKm: 200 },
  { id: "flyingfish", hulls: TROPICAL_OCEANIC },
  { id: "tuna", hulls: TROPICAL_OCEANIC },
  { id: "yellowfin", hulls: TROPICAL_OCEANIC },
  { id: "sailfish", hulls: TROPICAL_OCEANIC },
  { id: "mahi", hulls: [...TROPICAL_OCEANIC, ...MED_HULL] },
  { id: "barracuda", hulls: TROPICAL_COASTAL, coastKm: 560 },
];

/** Cosmopolitan pelagic taxa without a Wikipedia world map: geographic prior is 1, then catalog niches. */
const OPEN_RANGE = ["lanternfish", "giantsquid"];

export function seasonWeight(doy, peak, width, lat = 0, absolute = false) {
  if (peak == null || width == null || width <= 0) return 1;
  const day = ((Number(doy) % 365) + 365) % 365;
  const raw = ((Number(peak) % 365) + 365) % 365;
  const p = !absolute && lat < 0 ? (raw + 182) % 365 : raw;
  let d = Math.abs(day - p);
  if (d > 182.5) d = 365 - d;
  if (d >= width) return 0;
  return 0.5 + 0.5 * Math.cos((d / width) * Math.PI);
}

function occupancyOf(spec, lat, dayOfYear) {
  const prior = spec.occupancy ?? 1;
  if (!spec.season) return prior;
  const w = seasonWeight(
    dayOfYear,
    spec.season.peak,
    spec.season.width,
    lat,
    spec.season.absolute === true
  );
  const floor = spec.season.floor ?? 0;
  return prior * (floor + (1 - floor) * w);
}

function hullWeight(spec, lat, lon, dayOfYear) {
  let w = occupancyOf(spec, lat, dayOfYear);
  if (w <= 0.05) return 0;
  if (spec.coastKm != null) w *= coastWeight(coastKmAt(lat, lon), spec.coastKm);
  return w;
}

function taper(value, inner, outer) {
  if (inner === outer) return value === inner ? 1 : 0;
  if (inner > outer) {
    if (value >= inner) return 1;
    if (value <= outer) return 0;
    return (value - outer) / (inner - outer);
  }
  if (value <= inner) return 1;
  if (value >= outer) return 0;
  return (outer - value) / (outer - inner);
}

export function realmWeight(floorY, realm) {
  if (floorY == null || !realm || realm === "any") return 1;
  if (realm === "shelf") return taper(floorY, -220, -650);
  if (realm === "oceanic") {
    if (floorY <= -350) return 1;
    if (floorY > -90) return 0;
    if (floorY > -180) return 0.45 * taper(floorY, -180, -90);
    return 0.45 + 0.55 * taper(floorY, -350, -180);
  }
  if (realm === "slope") {
    return Math.min(taper(floorY, -250, -80), taper(floorY, -2500, -2800));
  }
  return 1;
}

export function floorWeight(floorY, spec) {
  if (floorY == null || !spec) return 1;
  const pad = 70;
  let w = 1;
  const floor = spec.floor;
  if (floor?.min != null) w *= taper(floorY, floor.min, floor.min - pad);
  if (floor?.max != null) w *= taper(floorY, floor.max, floor.max + pad);
  if (spec.minFloorY != null) w *= taper(floorY, spec.minFloorY, spec.minFloorY + pad);
  if (spec.guild === "demersal") w *= taper(floorY, -220, -650);
  return w;
}

const TEMP_PAD = 1.6;

export function tempWeight(sst, niche) {
  if (!niche) return 1;
  const t = sst;
  let w = 1;
  if (niche.min != null) {
    if (t < niche.min - TEMP_PAD) return 0;
    if (t < niche.min) w *= (t - (niche.min - TEMP_PAD)) / TEMP_PAD;
  }
  if (niche.max != null) {
    if (t > niche.max + TEMP_PAD) return 0;
    if (t > niche.max) w *= (niche.max + TEMP_PAD - t) / TEMP_PAD;
  }
  return Math.max(0, Math.min(1, w));
}

function iceWeight(ice, spec) {
  const assoc = spec?.ice === "associated" || spec?.fish?.iceAssociated;
  const avoid = spec?.ice === "avoid" || (spec?.temp?.min != null && spec.temp.min >= 16);
  if (avoid && ice > 0.15) return 0;
  if (assoc) return ice > 0.08 ? 0.55 + 0.45 * Math.min(1, ice) : 0.45;
  if (spec?.realm === "oceanic" && ice > 0.55) return 0;
  return 1;
}

function upwellWeight(upwell, spec) {
  if (spec?.upwellMin == null) return 1;
  const min = spec.upwellMin;
  const pad = 0.08;
  if (upwell < min - pad) return 0;
  const core = Math.min(1, 0.45 + upwell);
  if (upwell < min) return core * ((upwell - (min - pad)) / pad);
  return core;
}

export function habitatWeight(spec, env) {
  if (!spec) return 0;
  const sst = env.sst;
  const ice = env.ice ?? 0;
  const upwell = env.upwell ?? 0;
  const t = tempWeight(sst, spec.temp);
  if (t <= 0.05) return 0;
  if (!inOxygenNiche(env.lat, env.lon, spec.o2)) return 0;
  let w = t;
  w *= realmWeight(env.floorY, spec.realm);
  w *= floorWeight(env.floorY, spec);
  w *= iceWeight(ice, spec);
  w *= upwellWeight(upwell, spec);
  return w;
}

function schoolPreyCount(p) {
  let n = 0;
  for (const id of SCHOOL_IDS) {
    if ((p[id] ?? 0) > 0.05 && isForagePrey(id)) n += 1;
  }
  return n;
}

function preySatisfied(spec, p) {
  const prey = spec?.prey;
  if (!prey || !prey.length) return true;
  if (prey.includes("bloom")) return true;
  if (prey.includes("school")) return schoolPreyCount(p) > 0;
  for (const id of prey) if ((p[id] ?? 0) > 0.05) return true;
  return false;
}

export function herringSuitability(lat, lon, env) {
  return presenceAt(lat, lon, env).herring ?? 0;
}

function climateEnv(lat, lon, env = {}) {
  const dayOfYear = env.dayOfYear ?? CONFIG.time?.dayIndex ?? 180;
  return {
    lat,
    lon,
    dayOfYear,
    floorY: env.floorY,
    sst: env.sst ?? climatologySST(lat, dayOfYear) + (CONFIG.water?.sstAnomaly ?? 0),
    ice: env.ice ?? climateIce(lat, lon, dayOfYear) + (CONFIG.water?.iceAnomaly ?? 0),
    upwell: env.upwell ?? climateUpwell(lat, lon),
  };
}

export function presenceAt(lat, lon, env = {}) {
  const p = emptyPresence();
  const x = wrapLon(lon);
  const climate = climateEnv(lat, lon, env);

  for (const spec of RANGES) {
    if (!inAny(x, lat, spec.hulls)) continue;
    const occ = hullWeight(spec, lat, x, climate.dayOfYear);
    if (occ <= 0.05) continue;
    p[spec.id] = Math.max(p[spec.id] ?? 0, occ);
  }

  applyWikiPresence(p, lat, lon);

  for (const id of OPEN_RANGE) {
    if ((p[id] ?? 0) > 0.05) continue;
    p[id] = 1;
  }
  p.benthos = 1;

  for (const id of Object.keys(p)) {
    if ((p[id] ?? 0) <= 0.05) continue;
    if (wikiMeta(id)?.skipHabitat) continue;
    const w = habitatWeight(SPECIES[id], climate);
    p[id] = w > 0.05 ? Math.min(1, p[id] * w) : 0;
  }

  if (env.trophic !== false) {
    for (const id of Object.keys(p)) {
      if ((p[id] ?? 0) <= 0.05) continue;
      if (!preySatisfied(SPECIES[id], p)) p[id] = 0;
    }
  }
  return p;
}

export function faunaIdsPresent(lat, lon, env) {
  const p = presenceAt(lat, lon, env);
  const ids = [];
  for (const id of Object.keys(p)) {
    if (p[id] > 0.05) ids.push(id);
  }
  return ids;
}

export function presentNames(presence) {
  const who = [];
  for (const id of Object.keys(presence || {})) {
    if ((presence[id] ?? 0) > 0.05) who.push(speciesLabel(id));
  }
  return who;
}

export function presentLabel(presence) {
  const who = presentNames(presence);
  return who.length ? who.join(", ") : "no implemented fauna";
}

export const OVERLAY_IDS = PRESENCE_IDS.filter((id) => id !== "benthos");

const GOLD = 137.508;

export function habitatTint(id) {
  const i = Math.max(0, OVERLAY_IDS.indexOf(id));
  return { h: (i * GOLD) % 360, s: 62, l: 56 };
}

export const OVERLAY_COLS = 360;
export const OVERLAY_ROWS = 170;

export function rasterHabitat({
  cols = OVERLAY_COLS,
  rows = OVERLAY_ROWS,
  dayOfYear,
  floorAt,
  ids,
  trophic = false,
} = {}) {
  const south = -85;
  const north = 85;
  const doy = dayOfYear ?? 180;
  const want = new Set(ids?.length ? ids : OVERLAY_IDS);
  if (trophic) {
    for (const id of SCHOOL_IDS) if (isForagePrey(id)) want.add(id);
  }
  const grid = {};
  for (const id of want) grid[id] = new Float32Array(cols * rows);
  const tmp = new Float32Array(cols * rows);
  const latOf = (j) => north - ((j + 0.5) / rows) * (north - south);
  const lonOf = (i) => -180 + ((i + 0.5) / cols) * 360;

  for (const spec of RANGES) {
    if (!grid[spec.id]) continue;
    tmp.fill(0);
    for (const ring of spec.hulls) fillRings(tmp, cols, rows, south, north, [ring], 1, "max");
    const g = grid[spec.id];
    for (let j = 0; j < rows; j++) {
      const lat = latOf(j);
      const row = j * cols;
      for (let i = 0; i < cols; i++) {
        const idx = row + i;
        if (tmp[idx] <= 0) continue;
        const w = hullWeight(spec, lat, lonOf(i), doy);
        if (w > g[idx]) g[idx] = w;
      }
    }
  }
  for (const id of WIKI_IDS) {
    if (grid[id]) stampWikiRaster(id, grid[id], cols, rows, south, north);
  }
  for (const id of OPEN_RANGE) {
    const g = grid[id];
    if (!g) continue;
    for (let k = 0; k < g.length; k++) if (g[k] <= 0.05) g[k] = 1;
  }

  const p = emptyPresence();
  for (let j = 0; j < rows; j++) {
    const lat = latOf(j);
    for (let i = 0; i < cols; i++) {
      const lon = lonOf(i);
      const idx = j * cols + i;
      let any = false;
      for (const id of want) {
        p[id] = grid[id][idx];
        if (p[id] > 0.05) any = true;
      }
      if (!any) continue;
      const climate = climateEnv(lat, lon, { dayOfYear: doy, floorY: floorAt?.(lat, lon) });
      for (const id of want) {
        if (p[id] <= 0.05) continue;
        if (wikiMeta(id)?.skipHabitat) continue;
        const w = habitatWeight(SPECIES[id], climate);
        p[id] = w > 0.05 ? Math.min(1, p[id] * w) : 0;
      }
      if (trophic) {
        for (const id of want) {
          if ((p[id] ?? 0) <= 0.05) continue;
          if (!preySatisfied(SPECIES[id], p)) p[id] = 0;
        }
      }
      for (const id of want) grid[id][idx] = p[id];
    }
  }
  return { cols, rows, south, north, grid };
}

