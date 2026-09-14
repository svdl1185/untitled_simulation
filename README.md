# untitled_simulation

A scientific ocean simulation. The aim is the most complete coupled ocean that can run in a browser: every factor that changes a **budget**, a **habitat**, or a **sensory cue**, so any kilometre of the world ocean can be a living cell rather than a backdrop.

The camera is a window into that system, not the point of it. There is no score, no collectible, no species that exists only to look like another species.

```bash
npm install
npm run dev
```

Open the URL Vite prints. The **world map** is home. Click water to load that kilometre (GEBCO floor, a mean current, every catalogued animal whose range and thermal niche cover the cell). Land is not a cell. **Catalog tank** is a 10 km lab with the whole catalog, a beach, stepped shelves, a canyon, a seamount, and 2000 m of water — for coexistence and depth, not a real place.

The public host is a Cloudflare Worker with the Vite `dist`. Atlas paths `/gebco`, `/gmrt`, `/hycom` are the same in `npm run dev` and in production (Vite proxy locally, Worker fetch on the edge). Attach a domain: [`docs/deploy.md`](docs/deploy.md).

Menu: `M` / `Tab`. Toggles start off. Prefer a physical control (turbidity, SST anomaly) over a cosmetic one.

## Mission

Physics first, then chemistry, then life.

Light sets photosynthesis. Photosynthesis sets plankton. Plankton, temperature, and currents set where forage fish go. Forage fish set where predators hunt. Detritus sinks; the seafloor holds carbon; demersal animals eat it. If a feature does not change a budget, a habitat, or a sensory cue, it does not belong yet.

The long-term target is a single catalog plus presence plus shared budgets that can hold any ocean ecosystem — pelagic, mesopelagic, demersal, polar, upwelling — without a second 20k boid loop. Near the camera: agents. Kilometres out: density. Basin: Eulerian fields.

How to add an animal: [`.cursor/rules/species.mdc`](.cursor/rules/species.mdc). Architecture for agents: [`.cursor/rules/mission.mdc`](.cursor/rules/mission.mdc). Keep this README in the same commit as the feature: [`.cursor/rules/readme.mdc`](.cursor/rules/readme.mdc). Public deploy: [`docs/deploy.md`](docs/deploy.md).

## What is coupled now

**Bathymetry and flow** — GEBCO / GMRT floor; HYCOM mean current when the atlas answers; local tide, longshore, thermocline shear, eddies (`src/simulation/flow.js`). `sampleFlow` is the only current.

**Light** — Beer–Lambert PAR (`src/simulation/light.js`). Turbidity shallows the 1% light depth. Fog, caustics, and phytoplankton growth share that envelope. [`docs/fields.md`](docs/fields.md).

**Temperature** — climatological SST by latitude and season, mixed-layer depth, a vertical profile, Q10 on NPZD / metabolism / graze / predator drain (`src/simulation/temperature.js`). SST anomaly is a physical control. Some species drop out when mean SST is outside `temp.min` / `temp.max`.

**NPZD + benthos** — Separable 3D: a 128×128 horizontal patch times a shared vertical column (not a 128³ grid). Mass lives in the patch; the column is the photic / DCM, zooplankton DVM, nutricline, and sinking shape. `sampleAt` is the 3D concentration; production, grazing, and detritus export read that product. The camera sees it as green P / yellow-green Z slices at those live depths (`src/render/plankton.js`). The column bottom feeds a seafloor carbon field. Cod graze that field on the bed (`src/simulation/plankton.js`).

**Agents** — hashed-grid forage schools (one 20k budget, split by catalog `share`) and Reynolds vehicles (sharks, tunas, whales, squid, cod). Only near the camera. Silhouettes are guild stand-ins (`src/render/fish.js`, `src/render/sharkMesh.js`) with matching swim: lateral tail, body wave, thunniform, vertical fluke, jet pulse–coast. School squid pulse–coast on the grid, then hang on the current. Surface forage rise when fleeing; lanternfish and sand lance go down. Sharks actually glide between tail bursts. Air-breathers hang at the surface and blow (sperm: a single forward-left spout; mysticetes: two columns), then pitch into the dive. Replace later with authored models.

**Budgets** — bloom mean × photic production caps the school; Type II graze depletes `p`/`z`; bites restore predator energy; carcasses recycle; Q10 scales the rates. Named prey missing is a programmed starve, not a cheat.

**Depth** — biological `maxDepth` is a clamp, then the seafloor. Agents seed at their DVM / forage / breath / bed depth for the current hour, then the **local** floor at that (x, z) — a dropoff or seamount is a wall, not `CONFIG.floorY`. If the typical band does not fit, they walk downslope until it does. Lighting is optics, not a depth cap. Air-breathers surface, blow, then dive toward prey or typical `forageDepth` — not a commute to the record.

**Range** — hulls in `src/world/ranges.js`, thermal niches, trophic gates, shelf-depth gates (`minFloorY` for giant squid; cod drop off the slope). Overlap is habitat. Empty is honest.

**Catalog** — clupeids and other forage, lanternfish, krill, loliginids and Illex, Humboldt squid, **giant squid** (`Architeuthis`), named sharks and tunas, cod, toothfish, mysticetes, odontocetes including sperm whale (bites Humboldt and giant squid), and a **benthos** field guild.

## What is not in the model yet

The honest list. Closing a row means moving it into **What is coupled now**, not deleting the gap.

| Gap | Why it matters |
| --- | --- |
| Dissolved oxygen / OMZ | Humboldt squid’s day refuge, lanternfish habitat |
| Sea ice | Polar cod, krill overwinter, polar night as more than a clock |
| Salinity | Baltic sprat, estuarine nurseries |
| Basin streaming of agents | Neighbour chunks cache patches; animals do not swim between cells |
| Named benthos (crabs, worms) | Seafloor carbon is a field, not taxa |
| Seals, birds, penguins, salmon | Diets and surface pressure still use DVM / missing notes |
| Photophores as a light field | Lanternfish still render in epipelagic light |
| Oxygen- and temperature-gated spawn migrations | Recruits still follow bloom + year-timer |
| Fishing mortality | Not a budget |
| AquaMaps / OBIS ranges | Hulls are coarse polygons |

Species cards list **In nature** and per-taxon gaps under **Not in the model**. Diet is the live prey in this cell (click a name to look) or **None in cell**, with the natural diet kept underneath. Air-breathers show remaining breath-hold.

## Tests

Diagnose whether animals actually eat, starve, recruit, or go extinct, including min/max depth: [`docs/viability.md`](docs/viability.md). Column physics (PAR, SST, Q10, separable NPZD, benthos, giant-squid gates): `src/simulation/column.test.js`.

```bash
npm test
npm run viability
```

## Extending it

Knobs: `src/config.js`. Menu: `MENU` in `src/ui.js`, then `hud.on` in `src/main.js`. Fields under `src/simulation/`; meshes under `src/render/`.

A new animal needs a guild, a food, a flow coupling, a range, and a reason it is not the last one. A new field needs `sample…` cheap enough to call per fish, a closed budget, and a README row in the same change.
