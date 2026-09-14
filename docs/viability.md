# Viability suite

Headless Lotka–Volterra check of the catalog. No renderer: spawn a **named cell**, step the day cycle, school, vehicles, and NPZD for a few sim days, then say whether each animal died because the habitat is empty, because a mechanic is still missing, or because the program needs a tweak.

The camera is a window. This runner is how we look at a kilometre without one.

New catalog ids are included automatically (`PRESENCE_IDS`). The contract in `src/world/catalog.test.js` fails if a species is missing field-notes, `missing[]`, or a hunt id that is not in `SPECIES` — so the suite stays usable as the ocean grows.

## What a report answers

For every animal that belongs in the cell:

- Did it live, crash, or go extinct? Starved versus eaten.
- What did it actually eat, by prey id — lanternfish versus giant squid, not a single meal counter.
- Was named prey in the cell, did it ever spawn, or is it a range miss?
- Did depth envelopes overlap the prey it is wired to hunt?
- Is the failure a **tweak** (food and mechanics exist), a **gap** (the card already names a missing mechanic), or **expected** (this is not that animal’s water / programmed starve)?

Sperm whale × giant squid is the worked example: `huntTaxa` (market squid, Illex, lanternfish, Humboldt) versus `huntKinds` (giant squid). A whale that fills up on lanternfish while a giant squid lives in the same column is `hunt-kinds-idle`, not a silent OK. That may be natural rarity, or the dive may never occupy the squid’s band — the diet line and depth overlap say which.

## Commands

```bash
npm test                      # diagnose() + catalog contract + column/breath/demos
npm run viability             # catalog tank, 3 sim days
npm run viability -- --cell omz --days 3
npm run viability -- --cell shelf --days 7 --fish 4000
npm run viability -- --cell all --days 3 --fish 4000
npm run viability -- --cell catalog --species spermwhale,giantsquid --days 7
npm run viability -- --cell pelagic --json --out /tmp/pelagic.json
npm run viability:cells       # every coupled named cell, 3 days, smaller cap
```

`--cell` is a Cells picker id: `catalog`, `pelagic`, `omz`, `shelf`, `antarctic`, `polar`, plus gap tiles `reef`, `coast`, `demersal`, `hadal`. `--cell all` is every **coupled** demo; add `--gaps` to include gap tiles. `--place lab|shelf` still works.

`--species id,id` still runs the whole cell (prey has to be there) and prints only those rows. `--json` writes the compact census; `--trace` adds the time series (large). `--dt` is the integrator step. One sim day is `CONFIG.time.dayLength` (480 s ≈ 8 min wall). A few days is the useful span; 14 days is allowed and slow.

The logger keeps the full trace for the requested span (`CONFIG.viability.maxSamples` grows with `--days`).

## Verdicts

| | |
| --- | --- |
| **tweak** | Prey or bloom is in the cell and the program is wired, but the animal did not eat / starved / crashed. Overlap, detect, drain, or spawn gates. Look here first when changing knobs. |
| **gap** | Died, and `FAUNA[id].missing` already names a mechanic we do not run (glass squid, seals, …). Do not retune energy drain to fake that food. |
| **fail** | Fake fullness (energy without meals) or a grazer that never pulled on the bloom. Wiring cheat, not habitat. |
| **expected** | Not in this cell, or named prey is absent and starvation is the programmed budget. Empty is honest. |
| **watch** | Alive, but something is odd: ate smaller prey while a `huntKinds` vehicle lived here; boom; starve-cull. May be natural. |
| **ok** | Alive, eating, energy holding. |

Flags inside a row (fail / look / watch / ok / wait) are the Lotka–Volterra readout. Verdict is how to act on them.

## Flags

| | |
| --- | --- |
| **fail** | Extinct, never grazed, or energy without meals (fake fullness). |
| **look** | Crash, starving, prey present but no bites, prey never spawned, pup boom, idle `huntKinds` while energy fails. |
| **watch** | Named prey missing (programmed starve), starve-cull, boom, idle `huntKinds` while energy holds. |
| **ok** | Alive, eating, energy holding. |
| **wait** | Not in this cell, or not enough samples. |

`src/simulation/viability.js` is the recorder, the diet ledger, and the rules. `viabilityRun.js` is the cell driver. `src/world/catalog.test.js` is the contract that keeps those rules pointed at the live catalog. Add a flag when a new budget can fail in a new way. Add a `FAUNA.missing` row when a new animal has an honest gap — do not leave viability to guess.
