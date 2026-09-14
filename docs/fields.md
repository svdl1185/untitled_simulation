# Fields

How the water column is sampled. Agents never get a private current, a private sun, or a private temperature — they read these.

## Light — `src/simulation/light.js`

Photosynthetically active radiation. Beer–Lambert: \(I(z) = I_0 e^{-K_d z}\).

- \(I_0\) comes from the day look (sun elevation, night, storm).
- \(K_d\) is set so the 1% light depth matches `photicLimitY()` (turbidity).
- Fog, caustics, and phytoplankton growth share that envelope.
- `samplePAR(y, look)` is the function to call.

## Temperature — `src/simulation/temperature.js`

Sibling of `sampleFlow`.

- SST is a latitude climatology plus a seasonal cycle plus `CONFIG.water.sstAnomaly`.
- The mixed layer is well-mixed; below it temperature falls toward a deep value. `CONFIG.thermoY` is that mixed-layer depth.
- `sampleTemp(x, y, z)` returns °C.
- `q10Factor` / `columnQ10` scale NPZD rates, school metabolism/graze, and vehicle drain.
- Some catalog rows have `temp: { min, max }` and drop out of `presenceAt` when mean SST is outside the niche.

## NPZD + benthos — `src/simulation/plankton.js`

3D concentration is separable: \(C(x,y,z) = \mathrm{Patch}(x,z)\times\mathrm{Column}(y)\). Horizontal mass is 128×128 (`n`, `p`, `z`, `d`). The column is a shared shape, not a second budget and not a 128³ grid: P follows the photic / DCM, Z a DVM, N a nutricline, D sinks. `sampleAt` / `grazeAt` apply the product and return 0 below the local seafloor. Production uses PAR weighted by the P profile; Z grazing uses P–Z column coincidence; detritus export to `benthos` scales with the column bottom. Cod graze that store on the bed.

`overlap(look, y, layer)` is the 0–1 encounter weight. `grazeBenthos` is the demersal bite.

## Flow — `src/simulation/flow.js`

Unchanged: tide, longshore, thermocline shear, atlas mean. Still the only current.
