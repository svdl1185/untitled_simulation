# untitled_simulation

A coupled ocean: physics first, then chemistry, then life. The camera is a window into that system, not the point of it.

The long aim is the most complete, self-consistent simulation of the world’s oceans that will run on a machine you can sit in front of — not a documentary backdrop, and not a fish game with nicer lighting.

---

## Mission

Build one living ocean whose parts constrain each other.

Light sets photosynthesis. Photosynthesis sets plankton. Plankton and currents set where forage fish go. Forage fish set where predators hunt, and how many of them the water can carry. Storms, tides, the seafloor, and the beach are not scenery; they change those budgets.

If a feature does not change a budget, a habitat, or a sensory world, it does not belong yet.

We will not win by drawing 10¹⁵ individual fish. We win by nesting scales the way real ocean models do: agents where you are looking, aggregations a few kilometres out, Eulerian fields and statistical biomass at the basin.

This coastal herring patch is the first nested cell of that ocean.

---

## What is running now

A few hundred metres of shelf: about 480 m alongshore and 540 m from beach to basin. Inner shelf sits near −36 m; the floor drops to −110 m offshore. A sandy beach is on +Z.

| Layer | What it does |
| --- | --- |
| **Flow** | Tide (beach-normal), longshore current, thermocline shear, eddies, storm boost. Sampled per animal. |
| **Plankton** | 128×128 NPZD field (nutrients, phytoplankton, zooplankton, detritus). Advected by flow, grazed by herring, recycled from excretion and carcasses. Mean zooplankton caps how many fish the patch can hold. |
| **Herring** | Up to 20k Reynolds boids on a hashed 3D grid. They forage up the plankton gradient, peel off the beach before they strand, recruit when the bloom can feed them. |
| **Sharks** | A small pack (1–8) with burst-and-glide swimming, hunger, satiation, size/aggression variants. Satiated sharks roam instead of farming the school. |
| **Rays** | A benthic guild on their own grid. They hug the sand, ride weaker flow, and flee sharks. |
| **Light & weather** | Day cycle, storm, caustics, depth fog, a haze sheet at the thermocline. |
| **Place** | Rocks, a wreck, Gerstner surface, sloping seafloor. |

Controls live in the **Menu** (`M` / `Tab`). Toggles start off. New systems should appear there.

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

---

## Architecture (do not abandon this)

Three kinds of state, always:

1. **Fields** — continuous quantities on a grid or analytic field (flow, plankton, later temperature, nutrients, light). Cheap to sample everywhere.
2. **Agents** — individuals with heading and metabolism, only where resolution is worth it (herring near camera, sharks, rays).
3. **Budgets** — counts and energies that fields and agents must agree on (bloom → fish cap → shark hunger).

Adding a species means giving it a guild (pelagic school, benthic, predator), a food, a flow coupling, and a reason it cannot occupy every cell. Do not clone the herring loop and retint the mesh.

Far-field life is density or super-individuals, never a second 20k boid set “just offscreen.”

---

## Roadmap — toward every ocean

Ordered by what actually unlocks the next scale. Each step should ship as a coupled system, not as a mesh.

### 1. Make this patch a closed ecosystem

- **3D plankton** with a deep chlorophyll maximum and diel vertical migration, not a 2D carpet.
- **Light as extinction** (Beer–Lambert through water, bloom, and storm turbidity) driving growth, not only the look of the frame.
- **Temperature field** that sets metabolic rate and a pycnocline animals cross at a cost.
- **Herring energy**, not only school recruitment: graze, starve, spawn, die besides being eaten.
- **Nutrients / NPZD** (nutrient–phytoplankton–zooplankton–detritus) so blooms have a source and a sink.
- **Sediment plume** off the beach after storms, cutting light and shoving forage offshore.

### 2. Fill functional roles, not a zoo

A handful of *jobs*, then more skins later:

- A second pelagic (mackerel / sand eel) that partitions depth and speed with herring.
- Benthos beyond rays: flatfish, crabs, a seagrass or kelp carbon store on the slope.
- A surface hunter that only exists in the top metres (gannet, seal) so the school has a reason to go deep by day.
- Microbial / detrital loop so dead fish do not vanish.

If two species eat the same thing at the same depth at the same time, one of them is decoration. Cut it.

### 3. Sense the water, don’t cheat

- Vision falloff from turbidity and night (the fear radius should be a consequence, not a toggle).
- Olfaction and wakes carried *downstream* by `sampleFlow`.
- Lateral line: fish react to acceleration in the water, not only neighbour position.
- Sharks that lose the school in the bloom or the dark, and find it again by cue, not by `targetFor()`.

### 4. Nest the domain

The ~480×540 m shelf cell is cell zero.

- **Stream chunks** of seafloor and fields as the camera moves.
- **Super-individuals / density volumes** for schools beyond a couple of kilometres.
- **Nested grids**: bay → shelf → basin, with flow and plankton handed across boundaries.
- **GPGPU** for fields and far aggregations; CPU keeps nearby agents.

### 5. Become *the* oceans, not a prettier box

- Real bathymetry (GEBCO) and coastlines instead of a synthetic beach.
- Forced by reanalysis: currents, SST, waves, wind (CMEMS / HYCOM / ERA5).
- Biogeographic ranges (AquaMaps / OBIS) so Humboldt anchoveta do not spawn in the North Sea.
- Climate modes (ENSO, NAO, IOD) as modulators of the same NPZD and storm fields.
- Calibration: this herring cell against North Sea / Norwegian spring-spawning stock knowledge, then other Large Marine Ecosystems as presets of the same engine.

The test of success is not “it looks like Blue Planet.” It is: if you change the wind, the bloom, the fish, and the sharks all move, and the budgets still close.

---

## Extending it

Simulation knobs belong in `src/config.js`. Menu entries belong in `MENU` inside `src/ui.js`, then `hud.on("id", …)` in `src/main.js`. Fields go under `src/simulation/`; meshes under `src/render/`.

A Cursor rule in `.cursor/rules/mission.mdc` restates this for anyone (or any agent) working in the repo.
