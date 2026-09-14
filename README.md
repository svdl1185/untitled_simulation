# untitled_simulation

A scientific ocean simulation. The aim is the most complete coupled ocean that can run in a browser: every factor that changes a **budget**, a **habitat**, or a **sensory cue**, so any kilometre of the world ocean can be a living cell rather than a backdrop.

The camera is a window into that system, not the point of it. There is no score, no collectible, no species that exists only to look like another species.

```bash
npm install
npm run dev
```

Open the URL Vite prints. The **world map** is home. Click water to load that kilometre (GEBCO floor, a mean current, every catalogued animal whose range and thermal niche cover the cell). Land is not a cell. **Catalog tank** is a 10 km lab with the whole catalog, a beach, stepped shelves, a canyon, a seamount, and 2000 m of water — for coexistence and depth, not a real place.

The public host is a Cloudflare Worker with the Vite `dist`. Atlas paths `/gebco`, `/gmrt`, `/hycom` are the same in `npm run dev` and in production (Vite proxy locally, Worker fetch on the edge). Attach a domain: [`docs/deploy.md`](docs/deploy.md).

Menu: `M` / `Tab`. Toggles start off. Prefer a physical control (turbidity, SST anomaly, oxygen anomaly) over a cosmetic one.

## Mission

Physics first, then chemistry, then life.

Light sets photosynthesis. Photosynthesis sets plankton. Plankton, temperature, and currents set where forage fish go. Forage fish set where predators hunt. Detritus sinks; the seafloor holds carbon; demersal animals eat it. If a feature does not change a budget, a habitat, or a sensory cue, it does not belong yet.

The long-term target is a single catalog plus presence plus shared budgets that can hold any ocean ecosystem — pelagic, mesopelagic, demersal, reef, polar, coastal, upwelling — without a second 20k boid loop. Near the camera: agents. Kilometres out: density. Basin: Eulerian fields.

How to add an animal: [`.cursor/rules/species.mdc`](.cursor/rules/species.mdc). Architecture for agents: [`.cursor/rules/mission.mdc`](.cursor/rules/mission.mdc). Keep this README in the same commit as the feature: [`.cursor/rules/readme.mdc`](.cursor/rules/readme.mdc). Public deploy: [`docs/deploy.md`](docs/deploy.md).

## What is coupled now

**Bathymetry and flow** — GEBCO / GMRT floor; HYCOM mean current when the atlas answers; local tide, longshore, thermocline shear, eddies (`src/simulation/flow.js`). `sampleFlow` is the only current.

**Light** — Beer–Lambert PAR (`src/simulation/light.js`). Turbidity shallows the 1% light depth. Fog, caustics, and phytoplankton growth share that envelope. [`docs/fields.md`](docs/fields.md).

**Temperature** — climatological SST by latitude and season, mixed-layer depth, a vertical profile, Q10 on NPZD / metabolism / graze / predator drain (`src/simulation/temperature.js`). SST anomaly is a physical control. Some species drop out when mean SST is outside `temp.min` / `temp.max`.

**Dissolved oxygen** — saturation from SST, mixed-layer well-mixed, an OMZ in eastern-boundary and tropical cells, recovery in deep water (`src/simulation/oxygen.js`). Detritus remineralisation is a live demand. Humboldt's day DVM follows the OMZ core; lanternfish can occupy it; tunas and sharks stay above their `o2Min` oxycline. Oxygen anomaly is a physical control. Humboldt also needs an OMZ to be present.

**NPZD + benthos** — Separable 3D: a 128×128 horizontal patch times a shared vertical column (not a 128³ grid). Mass lives in the patch; the column is the photic / DCM, zooplankton DVM, nutricline, and sinking shape. `sampleAt` is the 3D concentration; production, grazing, and detritus export read that product. The camera sees it as green P / yellow-green Z slices at those live depths (`src/render/plankton.js`). The column bottom feeds a seafloor carbon field. Cod graze that field on the bed (`src/simulation/plankton.js`).

**Agents** — hashed-grid forage schools (one 20k budget, split by catalog `share`) and Reynolds vehicles (sharks, tunas, whales, squid, cod). Only near the camera. Silhouettes are guild stand-ins (`src/render/fish.js`, `src/render/sharkMesh.js`) with matching swim: lateral tail, body wave, thunniform, vertical fluke, jet pulse–coast. School squid pulse–coast on the grid, then hang on the current. Surface forage rise when fleeing; lanternfish and sand lance go down. Sharks actually glide between tail bursts. Air-breathers hang at the surface and blow (sperm: a single forward-left spout; mysticetes: two columns), then pitch into the dive. Replace later with authored models.

**Budgets** — bloom mean × photic production caps the school; Type II graze depletes `p`/`z`; bites restore predator energy; carcasses recycle; Q10 and hypoxia scale the rates. Named prey missing is a programmed starve, not a cheat.

**Depth** — biological `maxDepth` is a clamp, then the seafloor. Agents seed at their DVM / forage / breath / bed depth for the current hour, then the **local** floor at that (x, z) — a dropoff or seamount is a wall, not `CONFIG.floorY`. If the typical band does not fit, they walk downslope until it does. Lighting is optics, not a depth cap. Air-breathers surface, blow, then dive toward prey or typical `forageDepth` — not a commute to the record.

**Range** — hulls in `src/world/ranges.js`, thermal niches, OMZ gates, trophic gates, shelf-depth gates (`minFloorY` for giant squid; cod drop off the slope). Overlap is habitat. Empty is honest.

**Catalog** — clupeids and other forage, lanternfish, krill, loliginids and Illex, Humboldt squid, **giant squid** (`Architeuthis`), named sharks and tunas, cod, toothfish, mysticetes, odontocetes including sperm whale (bites Humboldt and giant squid), and a **benthos** field guild.

## What is not in the model yet

The honest list. Closing a row means moving it into **What is coupled now**, not deleting the gap. A mesh without a budget, a habitat, or a sensory cue is still a gap. Species cards keep the per-taxon holes under **Not in the model**.

The kilometre we load today is a **pelagic cell**: fields, forage schools, and vehicles. Four other systems are first-class ocean, not later colour, so a coral, a vent, or an ice edge is not buried under “named benthos.”

### 1. The ocean as a system

Physics, chemistry, scale, and senses that every biome would read.

| Gap | Why it matters |
| --- | --- |
| Salinity, density, pycnocline | Baltic sprat, estuaries, Mediterranean outflow; a crossing cost, not a tint |
| Nutrient species beyond one N | Si (diatoms), Fe (HNLC gyres), PO₄, NH₄ vs NO₃, N₂ fixation, denitrification |
| Microbial loop, DOM, viruses | Regenerated production; P/Z are two boxes |
| Full 3D NPZD | Mass is a 128×128 patch times a shared column, not a 128³ grid |
| Carbonate chemistry, pH, Ω_arag | Calcifiers, pteropods, ocean acidification |
| Air–sea heat, freshwater, CO₂ | The mixed layer is a climatology, not a flux |
| Horizontal O₂ fronts, bed oxygen, dead zones | `sampleO2` x/z is reserved; coastal hypoxia is not a map |
| Live upwelling, Ekman, vertical velocity | HYCOM is a mean current; the nutricline does not shoal under a wind |
| Mesoscale eddies as 3D rotors | Eddy term is a sine, not a chlorophyll ring or larval trap |
| Internal waves, baroclinic tides, seamount mixing | Bathymetry is a wall, not a mixer |
| Surface gravity waves, Stokes drift, Langmuir | Windrows of plankton; beach orbital motion |
| Storm deepening of the mixed layer | Storm is a look; the thermocline does not mix |
| Climate modes (ENSO, IOD, NAO, PDO) | Humboldt collapse, sardine–anchovy regimes |
| Basin streaming of agents | Neighbour chunks cache patches; animals do not swim between cells |
| Density / super-individuals beyond the camera | Far field is empty water, not biomass |
| AquaMaps / OBIS / acoustic DSL | Hulls are coarse polygons |
| Fishing mortality | Not a budget |
| Age, stage, larval drift | Recruits are bloom × year-timer |
| Spawn as a swim | Seasonal occupancy is not a commute between cells |
| Senses as fields | Echolocation, olfaction, electroreception, lateral line, magnetoreception, soundscape |
| Photophores as a light field | Lanternfish still render in epipelagic light; 1500 m is too green |
| Moon, lunar DVM, polar night / midnight sun | Day/night is a clock |
| Marine snow / migratory carbon pump | Detritus is a column shape, not sinking aggregates or DVM flux |
| Size-structured plankton | No nauplii → copepodite → adult, no gelatinous vs crustacean Z |
| Vehicle–vehicle and school–school bites | Sperm whale × Humboldt / giant squid only; mackerel do not eat herring |
| Disease, parasites, epizootics | Not a budget |
| Pressure, compressibility, gas solubility | Deep physiology |
| Authored meshes | Guild silhouettes |
| Sediment grain size and transport | Burying, gravel spawn beds, resuspension turbidity |

### 2. Seafloor besides tropical coral reefs

Soft sediment, rocky shelf, kelp, slope, seamount, abyss, hadal, seeps, and vents. Carbon on the bed is a field; almost nothing that lives in it is an agent. Cod graze that field. That is the whole demersal loop.

| Gap | Why it matters |
| --- | --- |
| Named infauna and epifauna | Polychaetes, amphipods, bivalves, nematodes, meiofauna — the actual benthos |
| Crabs, lobsters, shrimp, amphipod scavengers | Cod’s “crabs” are seafloor carbon |
| Echinoderms | Brittle-star plains, urchin barrens, holothurian herds, crinoids |
| Sponges, sea pens, gorgonians, glass-sponge reefs | Structure and filter budgets on mud and rock |
| Cold-water coral (*Lophelia* and kin) | A carbonate reef that is not tropical and not photic |
| Flatfish, skates, rays, chimaeras | Sit-on-sand guilds |
| Shelf gadids and neighbours | Haddock, pollock, hake, whiting, wolffish — not a second cod |
| Grenadiers, cusk eels, snailfish, tripod fish, hagfish | Slope, abyss, hadal programmes |
| Sleeper sharks, sixgill, Greenland shark, dogfish | Demersal predators |
| Kelp forests and urchin–otter coupling | Canopy light, holdfast habitat, carbon export — temperate rocky reef |
| Maerl / rhodolith beds | Living gravel, not sand |
| Microphytobenthos on shallow floors | A light-driven bed budget, not only pelagic rain |
| Bioturbation and sediment redox | Oxic / suboxic / sulfidic layers; denitrification |
| Phytodetritus pulses after blooms | Seasonal food on the abyssal plain |
| Hydrothermal vents | Chemosynthesis (*Riftia*, vent shrimp, yeti crabs); not a detritus film |
| Cold seeps, brine pools, hydrates | Another primary-production pathway |
| Whale falls, wood falls, *Osedax* | Succession from a pelagic carcass |
| Seamount sessile fauna and topography-trapped flow | Hammerhead day-schooling has no landmark |
| Canyon turbidity currents, overflows | Downslope carbon and larval transport |
| Hadal trenches | Pressure, food poverty, endemic snailfish |
| Sand-lance burying, grain-size habitat | Fear steers at the bed; they never enter it |
| Demersal eggs on gravel | Herring spawn beds are not a place |
| Bottom water, contour currents, iceberg scour | Habitat, not a floor mesh |
| Trawl disturbance | A mortality and a sediment event |
| Octopus, cuttlefish, benthic squid egg mops | Cephalopods in this catalog are pelagic |

### 3. Coral reefs

A photic, calcifying, structurally complex coast. Barracuda is the only catalog animal that even pretends to sit on one, and the reef itself is not there.

| Gap | Why it matters |
| --- | --- |
| Hard coral as a `field` agent | Calcification, mucus, a carbonate budget |
| Zooxanthellae, bleaching, OA | Light + temperature + Ω on the animal that built the habitat |
| Rugosity / crest / flat / lagoon / forereef / mesophotic | One beach is not a reef profile |
| Crustose coralline algae | Settlement cue and cement |
| Herbivory that keeps coral dominant | Parrotfish (and bioerosion → sand), surgeonfish, *Diadema* |
| Cryptobenthic fish | Gobies and blennies are a large part of reef production |
| Corallivores and invertivores | Butterflyfish, triggerfish, wrasses, filefish |
| Groupers, snappers, morays | Sit-and-wait on structure; spawning aggregations |
| Reef sharks and rays | Whitetip / blacktip / grey reef, nurse, benthic batoids |
| Octopus, reef squid, cleaner wrasse / shrimp | Hunting and mutualism on the framework |
| Anemones, giant clams, sponges, soft corals | Hosts and binders, not set dressing |
| Crown-of-thorns and algal phase shifts | A coral budget can collapse |
| Mass spawning, larval settlement, lunar clocks | Recruits are not a bloom timer |
| Reef soundscape as a settlement cue | Sensory field |
| Wave energy, internal-wave nutrient pulses | Forereef production |
| Sediment, nutrients, island freshwater | Kill switches for the carbonate factory |
| Grazing halos, sand patches, caves | Fine-scale habitat |
| Connectivity to seagrass and mangrove nurseries | The reef does not raise all of its fish |
| Nocturnal / diurnal shift | Squirrelfish and cardinalfish vs the day shift |
| Territoriality, sex change, cleaning stations | Reef programmes, not pelagic roam |

### 4. Open ocean

The cell this build is. Forage schools, named pelagic predators, NPZD, DVM, an OMZ. Still a thin slice of the pelagic.

| Gap | Why it matters |
| --- | --- |
| Gelatinous zooplankton | Salps, jellies, siphonophores, pyrosomes, ctenophores — often the biomass |
| Phytoplankton functional types | *Prochlorococcus* vs diatoms vs coccolithophores vs *Trichodesmium* |
| Deep-scattering layer as sound | Swimbladder resonance, not only a lanternfish school |
| The rest of the mesopelagic fish | Hatchetfish, bristlemouths, dragonfish, viperfish — one myctophid id |
| Glass squid, colossal squid, vampire squid | Sperm-whale diet still has a hole |
| Beaked whales; blue, fin, sei, right whales | Different dive and filter programmes |
| Mako, thresher, oceanic whitetip, porbeagle | Pelagic shark guilds not in the catalog |
| Manta / devil rays, ocean sunfish | Filter and jelly diets |
| Sea turtles | Leatherback → jellies; others → neuston and seagrass |
| Seabirds | Albatross, petrel, shearwater, gannet, tropicbird — surface pressure is DVM |
| Neuston, *Sargassum*, flotsam, FADs | Mahi, flying fish, turtles, and juvenile habitat |
| Fronts and eddy rings as forage traps | Presence is a hull, not a chlorophyll filament |
| Tuna–dolphin–bird feeding associations | Not a cue |
| Flying-fish glide | Fear only swims |
| Counterillumination, chromatophores, ink | Display and hunt, not a shader |
| Bait-ball, sail-herd, bubble-net hydrodynamics | Generic mouth radius |
| Endothermy in tunas and lamnids | Temperature is SST, not warm muscle |
| Oligotrophic gyre vs bloom biome | The patch does not know it is a desert |
| Western boundary currents as live jets | Mean *u*, *v*, not the Gulf Stream or Kuroshio |
| Migratory carbon pump | DVM is a depth programme, not an export flux |
| Whale falls from this column | Carcasses recycle in place; they do not seed the bed succession |
| Remoras, pilotfish | Commensals on the large vehicles |
| Surface boiling, lunge kinematics, spyhop / breach | Behaviours |
| School piscivory | Mackerel and jack mackerel still only graze `z` |
| Lunar inhibition of DVM | Night is night |
| Diadromy through this cell | Eels, salmon — the Sargasso and the river are not places |

### 5. Polar seas and ice

Ice is a habitat and a light field, not a winter colour on SST. Polar cod and silverfish already occupy cold hulls; the ice they need does not exist.

| Gap | Why it matters |
| --- | --- |
| Sea ice (concentration, thickness, drift, age) | Polar cod, krill overwinter, seals as a platform |
| Fast ice, pack, pancake, multiyear, platelet ice | Different under-ice programmes |
| Leads and polynyas | Breathing holes, bloom factories, glacier-front foraging |
| Ice algae and under-ice blooms | A primary-production pathway the pelagic NPZD does not have |
| Polar night and midnight sun as optics | The day/night clock is not a polar light climate |
| Ice-edge blooms | Krill and minke actually track this, not a hull |
| Ice seals | Ringed, Weddell, crabeater, leopard, harp — great-white and orca diets |
| Walrus, polar bear | Benthic and ice-edge predators |
| Penguins | Surface pressure on silverfish and krill |
| Beluga, narwhal, bowhead | Ice-associated whales |
| Greenland shark | The polar demersal predator |
| Icefish and other notothenioids | Toothfish prey besides silverfish; no-hemoglobin physiology |
| Krill lipid overwinter under ice | A season, not a scatter school |
| Iceberg scour, dropstones, glacial plumes | Bed habitat and coastal turbidity |
| Ice-shelf cavities, bottom-water formation | Polar overturning |
| Wave-washing seals off ice | An orca programme with no ice and no seal |

### 6. Coasts, estuaries, and the intertidal

The beach in the catalog tank is a wall and a tide sine. It is not a nursery, a marsh, or a river mouth.

| Gap | Why it matters |
| --- | --- |
| Estuarine circulation and a salt wedge | Menhaden, many reef fish, and anadromous migrants |
| Tidal zonation | Splash / high / mid / low as habitats, not a shoreline mesh |
| Mangroves | Nursery, carbon, structure |
| Salt marsh, mudflat, wrack | Terrestrial carbon and bird foraging |
| Seagrass meadows | Nurseries, dugong / turtle / urchin grazing, a light-limited bed |
| Oyster reefs, mussel beds, rocky intertidal | Filter budgets and zonation |
| Sandy-beach surf zone and tidal flats | Capelin and grunion spawn; birds and rays forage |
| Anadromous and catadromous fish | Salmon, eels, sturgeon, shad, lamprey — river is not a cell |
| Seals, sea lions, fur seals | Haulouts; great-white and orca diets; sand-lance / herring pressure |
| Coastal birds | Gannet, pelican, cormorant, auk, puffin — DVM is the stand-in |
| Manatee, dugong, sea otter | Seagrass and kelp grazers / keystones |
| Sea turtles on beaches | Nesting; tiger-shark ambush landmarks |
| Hypoxic dead zones | Mississippi, Baltic, Black Sea — O₂ as a map, not a column |
| River plumes, CDOM, sediment | Light and nutrients that are not a turbidity knob |
| Upwelling coasts as a wind-driven pump | Humboldt / California / Canary / Benguela are hulls |
| Harmful algal blooms | Toxin, not only `p` |
| Inlet larval ingress, fjord sills, lagoons | Nursery physics |
| Beach-spawning die-offs | Capelin carcass pulses are not a budget |
| Flats (bonefish, tarpon, rays) | Another coastal programme |
| Bull shark / sawfish in rivers | The cell stops at salt water |

Species cards list **In nature** and per-taxon gaps under **Not in the model**. Diet is the live prey in this cell (click a name to look) or **None in cell**, with the natural diet kept underneath. Air-breathers show remaining breath-hold.

## Tests

Diagnose whether animals actually eat, starve, recruit, or go extinct, including min/max depth: [`docs/viability.md`](docs/viability.md). Column physics (PAR, SST, Q10, oxygen / OMZ, separable NPZD, benthos, giant-squid gates): `src/simulation/column.test.js`.

```bash
npm test
npm run viability
```

## Extending it

Knobs: `src/config.js`. Menu: `MENU` in `src/ui.js`, then `hud.on` in `src/main.js`. Fields under `src/simulation/`; meshes under `src/render/`.

A new animal needs a guild, a food, a flow coupling, a range, and a reason it is not the last one. A new field needs `sample…` cheap enough to call per fish, a closed budget, and a README row in the same change.
