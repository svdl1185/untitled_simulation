# untitled_simulation

A coupled ocean: physics first, then chemistry, then life. The camera is a window into that system, not the point of it.

Light sets photosynthesis. Photosynthesis sets plankton. Plankton and currents set where forage fish go. Forage fish set where predators hunt. If a feature does not change a budget, a habitat, or a sensory cue, it does not belong yet.

```bash
npm install
npm run dev
```

Open the URL Vite prints. The **world map** is home. Click water to load that kilometre (GEBCO floor, a mean current, every catalogued animal whose range covers the cell). Land is not a cell. **Catalog tank** is a 10 km lab with the whole catalog, a beach, stepped shelves, a canyon, a seamount, and 2000 m of water — for coexistence and depth, not a real place.

Menu: `M` / `Tab`. Toggles start off.

## What is coupled now

**Fields** — tide, longshore, shear, eddies; 128×128 NPZD (nutrients, phytoplankton, zooplankton, detritus). **Agents** — hashed-grid forage schools and a few Reynolds vehicles (sharks, tunas, whales, squid, cod), only near the camera. **Budgets** — bloom mean caps the school; grazing depletes `z`; bites restore predator energy; carcasses recycle. Depth is biological (`maxDepth`), then the seafloor; overlapping ranges share one cell.

## Tests

Diagnose whether animals actually eat, starve, recruit, or go extinct, including min/max depth. See **[docs/viability.md](docs/viability.md)**.

```bash
npm test
npm run viability
```

## Extending it

Knobs: `src/config.js`. Menu: `MENU` in `src/ui.js`, then `hud.on` in `src/main.js`. Fields under `src/simulation/`; meshes under `src/render/`.

A new animal needs a guild, a food, a flow coupling, a range, and a reason it is not the last one — [`.cursor/rules/species.mdc`](.cursor/rules/species.mdc). Mission for agents: [`.cursor/rules/mission.mdc`](.cursor/rules/mission.mdc).
