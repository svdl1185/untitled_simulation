# Fields

How the water column is sampled. Agents never get a private current, a private sun, a private temperature, or a private oxygen field — they read these.

## Light — `src/simulation/light.js`

Photosynthetically active radiation. Beer–Lambert: \(I(z) = I_0 e^{-K_d z}\).

- \(I_0\) comes from the day look (sun elevation, night, storm).
- \(K_d\) is set so the 1% light depth matches `openPhoticY()` (turbidity). `photicLimitY()` clips that to the seafloor for the column HUD — fog, caustics, and seafloor shading do not treat the sand as the 1% depth.
- Fog, caustics, phytoplankton growth, fish/seafloor shading, and visual hunt share that envelope.
- `samplePAR(y, look)` is PAR 0–1 at depth.
- `visualRange(y, look, base, glow)` scales detect / fear for sighted hunters. `glow` is photophore prey (lanternfish): restores a fraction of `base` in the dark. Sperm whale / orca `sense: "echo"` skip this. Filter-only diets skip it.
- Camera lamp (`K`) is fill after dark. It does not feed `visualRange`.

## Temperature — `src/simulation/temperature.js`

Sibling of `sampleFlow`.

- SST is a latitude climatology plus a seasonal cycle plus `CONFIG.water.sstAnomaly`.
- The mixed layer is well-mixed; below it temperature falls toward a deep value. `CONFIG.thermoY` is that mixed-layer depth. Winter mixes deeper; storms mix deeper still.
- `sampleTemp(x, y, z)` returns °C.
- `q10Factor` / `columnQ10` scale NPZD rates, school metabolism/graze, and vehicle drain.
- Some catalog rows have `temp: { min, max }` and drop out of `presenceAt` when mean SST is outside the niche.

## Dissolved oxygen — `src/simulation/oxygen.js`

Sibling of `sampleTemp`. Units ml L⁻¹.

- Surface saturation falls as SST rises. The mixed layer is near saturation.
- Eastern-boundary and tropical cells get an oxygen-minimum zone below the mixed layer; deep water recovers. The catalog tank forces a refuge so Humboldt's day band is visible.
- `sampleO2(x, y, z)` returns ml L⁻¹.
- `oxygenLimitY(cfg)` is the deepest y an animal may occupy (`o2Min`, unless `omzRefuge`).
- Detritus remineralisation is `setOxygenDemand` — a live subtract around the OMZ core.
- Humboldt `o2: { needOmz }` gates presence; day DVM follows `omzCoreY`. `o2Anomaly` is a physical control.

## Flow — `src/simulation/flow.js`

Tide, longshore, thermocline shear, atlas mean. The only current.

Climate upwell (`climateUpwell`) and storms add a mean **upward** lift around the mixed layer. Eastern-boundary cells (Humboldt, California, Canary, Benguela) and the equatorial cold tongue are high; gyres and the North Sea are near zero. Animals and plankton advection sample that lift. The NPZD column uses the same climate term to shoal the nutricline — nutrients in the light, not a 2D sprinkle only.

## Mixed layer — `src/simulation/temperature.js`

`mixedLayerY` is well-mixed SST. Winter mixes deeper. Storms mix deeper still and write `CONFIG.thermoY`. Shear, oxygen’s mixed layer, and NPZD all read that depth.

## NPZD + benthos — `src/simulation/plankton.js`

3D concentration is separable: \(C(x,y,z) = \mathrm{Patch}(x,z)\times\mathrm{Column}(y)\). Horizontal mass is 128×128 (`n`, `p`, `z`, `d`). The column is a shared shape, not a second budget and not a 128³ grid: P follows the photic / DCM, Z a DVM, N a nutricline that shoals under climate upwell and storms, D sinks. `sampleAt` / `grazeAt` apply the product and return 0 below the local seafloor. Production uses PAR weighted by the P profile; Z grazing uses P–Z column coincidence; detritus export to `benthos` scales with the column bottom. Cod graze that store on the bed.

`overlap(look, y, layer)` is the 0–1 encounter weight. `grazeBenthos` is the demersal bite. The renderer stacks slices on the live column bins so P is green in the photic and Z sparkles on the DVM.
