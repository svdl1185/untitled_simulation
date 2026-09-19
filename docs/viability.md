# Viability suite

Headless Lotka–Volterra check of the catalog. No renderer: spawn a cell, step the day cycle, school, vehicles, and NPZD, then flag programs that go extinct, never eat, boom, or hold energy without a meal.

The default cell is the **catalog tank** — the same 2 × 2 km lab as **Cells → Catalog tank**: beach, stepped shelves, canyon, seamount, 2000 m of water, every implemented animal. `--place shelf` is the synthetic North Sea fallback.

Each species also records the shallowest and deepest depth it reached during the run.

## Commands

```bash
npm test                 # diagnose() unit checks
npm run viability        # lab, 14 sim days, lab fish cap
npm run viability -- --days 7 --fish 8000
npm run viability -- --place shelf --days 14 --fish 2000
```

`--dt` is the integrator step (seconds of sim time). One sim day is `CONFIG.time.dayLength` (960 s). The logger keeps the full trace for the requested span.

## Flags

| | |
| --- | --- |
| **fail** | Extinct, never grazed, or energy without meals (fake fullness). |
| **look** | Crash, starving, prey present but no bites, pup boom. |
| **watch** | Named prey missing (programmed starve, not a cheat), starve-cull, boom. |
| **ok** | Alive, eating, energy holding. |
| **wait** | Not in this cell, or not enough samples. |

`src/simulation/viability.js` is the recorder and the rules. `viabilityRun.js` is the lab/shelf driver. Add a flag when a new budget can fail in a new way.
