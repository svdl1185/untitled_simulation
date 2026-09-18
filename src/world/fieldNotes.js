/**
 * Natural-history copy for every catalog id. Presence still lives on
 * SPECIES + ranges. Cards in species.js compose In nature /
 * Not in the model from these rows.
 */
export const FAUNA = {
  herring: {
    id: "herring",
    common: "Atlantic herring",
    latin: "Clupea harengus",
    guild: "Pelagic forage fish",
    diet: "Zooplankton (calanoid copepods, krill)",
    sex: "Female / male. Females are drawn slightly larger.",
    about:
      "North Atlantic clupeid, typically 20–38 cm. Lives in polarized shoals. Night feeding near 10–40 m; day refuge around 100–150 m. Recorded to about 400 m. Eaten by cod, sharks, tuna, whales, seals, and gannets. Recruits in spring when the bloom can carry the mixed forage budget.",
    program:
      "Polarized hashed-grid shoal (pancake envelope, same-shoal alignment). Type II graze on z. Hungry shoals may rise toward zooplankton; satiated shoals sit in the day refuge. Starvation and kills recycle to detritus.",
    missing: [
      "Seals and gannets are not agents; the day dive is the refuge those visual hunters would create.",
      "Temperature is a mixed-layer field with Q10 on graze and metabolism; spawning grounds are still not a place.",
      "Seasonal feeding–spawning migration (Norwegian Sea, Georges Bank, Baltic) is a range hull, not a swim between cells.",
      "Gravel-bank spawning, egg beds, and larval drift are not a season — recruits appear when the bloom can carry the mixed forage budget.",
      "Natal homing and stock structure are not states.",
      "The lateral line and vision are neighbour forces, not separate senses.",
      "Overwintering as dense inactive layers in fjords is not a programme.",
    ],
  },
  capelin: {
    id: "capelin",
    common: "Capelin",
    latin: "Mallotus villosus",
    guild: "Pelagic forage fish",
    diet: "Zooplankton",
    sex: "Female / male. Females are drawn slightly larger.",
    about:
      "Arctic–subarctic smelt, typically 12–20 cm. Shallower than herring (night near the surface, day tens of metres). Recorded to about 300 m. Beach-spawns in some stocks. Forage for cod, seabirds, and minke.",
    program:
      "Species-pure polarized shoal on the shared grid. Type II graze on z. Competes with herring for the bloom cap where ranges overlap (Iceland, Barents, Labrador, Bering).",
    missing: [
      "Beach spawning and bird predation are not agents.",
      "Ice is a field; capelin are not ice-associated — polar cod shoal under pack.",
      "Semelparity (many stocks spawn once and die) is not a life-history — they recruit and starve like any other school fish.",
      "Males do not grow spawning ridges or a hooked lower jaw; sex is a size tint.",
      "The beach rolling run onto the strand is not a state.",
      "Post-spawn carcass pulses that feed bears and birds on the beach are not a budget.",
    ],
  },
  menhaden: {
    id: "menhaden",
    common: "Atlantic menhaden",
    latin: "Brevoortia tyrannus",
    guild: "Pelagic forage fish",
    diet: "Phytoplankton and zooplankton",
    sex: "Female / male. Females are drawn slightly larger.",
    about:
      "Western Atlantic filter feeder, typically 20–35 cm. Estuarine and inner-shelf; rarely below about 50 m. Schools in murky coastal water. Eaten by striped bass, sharks, and birds.",
    program:
      "Polarized shoal. Type II graze on phytoplankton p (the same knob krill uses; z is not a separate bite). Shallow DVM. o2Min 2 ml/L: they will not sit in a hypoxic shelf. Does not commute into the abyss.",
    missing: [
      "Striped bass and coastal birds are not agents.",
      "Estuarine nurseries and larval ingress through inlets are not a habitat.",
      "Gill-raker particle-size filtering is graze-on-p, not a filter that splits p versus z by size.",
      "The reduction fishery is not mortality.",
    ],
  },
  sardine: {
    id: "sardine",
    common: "Pacific sardine",
    latin: "Sardinops sagax",
    guild: "Pelagic forage fish",
    diet: "Zooplankton",
    sex: "Female / male. Females are drawn slightly larger.",
    about:
      "Pacific and southern-hemisphere sardine, typically 15–25 cm. Tight, fast shoals in eastern-boundary currents. Usually in the upper 100 m; recorded near 200 m. Co-occurs with anchovy.",
    program:
      "Polarized clupeid shoal. Type II graze on z. Occupies eastern-boundary cells where climate upwell shoals the nutricline. Empty in the North Sea is a range gate.",
    missing: [
      "Temperature-driven stock collapses are not a field.",
      "Sardine–anchovy regime alternation is not a two-stock oscillator.",
      "Spawning in offshore upwelling filaments is not a season — the cell has a climate lift, not a filament.",
      "Tight balling under bird attack is the same polarized school, not a distinct compression.",
    ],
  },
  pilchard: {
    id: "pilchard",
    common: "European pilchard",
    latin: "Sardina pilchardus",
    guild: "Pelagic forage fish",
    diet: "Zooplankton",
    sex: "Female / male. Females are drawn slightly larger.",
    about:
      "Northeast Atlantic, Mediterranean, and northwest African upwelling. Typically 15–25 cm. Day depths tens of metres; recorded to about 150 m. Overlaps herring at the Celtic / Biscay edge.",
    program: "Polarized shoal. Type II graze on z. Canary / Iberian cells inherit climate upwell on the nutricline.",
    missing: [
      "Purse-seine fishing mortality is not in the budget.",
      "Coastwise migration along Iberia and the Canary Current is a range hull, not a swim.",
      "Egg buoyancy and larval drift are not a field.",
    ],
  },
  anchovy: {
    id: "anchovy",
    common: "Anchovy",
    latin: "Engraulis",
    guild: "Pelagic forage fish",
    diet: "Zooplankton",
    sex: "Female / male. Females are drawn slightly larger.",
    about:
      "Small engraulid, typically 8–16 cm. Coastal upwelling. Usually above 100 m; recorded to about 150 m. Latin follows the cell: ringens (Humboldt), mordax (California), japonicus (Kuroshio), encrasicolus (Europe).",
    program: "Slender polarized shoal. Type II graze on z. Competes with sardine where both hulls cover the kilometre. Humboldt / California cells shoal the nutricline under climate upwell.",
    missing: [
      "Egg and larval stages are not agents.",
      "Lunar batch spawning is not a clock.",
      "Humboldt El Niño collapses are not an ENSO oscillator — SST anomaly and climate upwell are fields, not a two-stock crash.",
      "Cannibalism on eggs is not a bite.",
      "The inshore–offshore split versus sardine is hull overlap, not two depth programmes.",
    ],
  },
  sardinella: {
    id: "sardinella",
    common: "Round sardinella",
    latin: "Sardinella aurita",
    guild: "Pelagic forage fish",
    diet: "Zooplankton",
    sex: "Female / male. Females are drawn slightly larger.",
    about:
      "Tropical Atlantic, Caribbean, Gulf of Guinea, and Indian Ocean. Typically 15–25 cm. Upper 100–200 m. The forage that occupies warm water herring never reach.",
    program: "Polarized tropical shoal. Type II graze on z.",
    missing: [
      "Indian oil sardine is the same id with a localized latin name, not a second loop.",
      "Monsoon-driven inshore/offshore shifts are a range hull, not a swim.",
      "Round versus flat sardinella (S. maderensis) is not a second taxon.",
    ],
  },
  mackerel: {
    id: "mackerel",
    common: "Mackerel",
    latin: "Scomber scombrus",
    guild: "Pelagic forage fish",
    diet: "Zooplankton; small fish",
    sex: "Female / male. Females are drawn slightly larger.",
    about:
      "Atlantic mackerel (Scomber scombrus) in the North Atlantic; chub mackerel (S. japonicus) in Pacific cells of this id. Typically 25–40 cm. Fast, looser shoals than herring. Often 0–200 m; recorded to about 400 m. Adults eat small fish as well as zooplankton.",
    program:
      "Polarized shoal with a smaller share of the bloom-capped grid. Type II graze on z, plus a neighbour-walk bite on herring, capelin, sprat, sand lance, anchovy, sardine, and polar cod (`diet: both`, `huntTaxa`). Piscivory is extra calories on the grazer cap, not a second headcount.",
    missing: [
      "Pacific chub mackerel is this id with a localized name, not a second species loop.",
      "Ram-filter feeding through copepod patches is Type II graze, not a ram-filter gait.",
      "Summer feeding migrations into the North Sea and Norwegian Sea are a hull, not a commute.",
      "Overwintering in deep water off the shelf edge is not a seasonal state.",
    ],
  },
  flyingfish: {
    id: "flyingfish",
    common: "Flying fish",
    latin: "Exocoetidae",
    guild: "Surface forage fish",
    diet: "Zooplankton",
    sex: "Female / male. Females are drawn slightly larger.",
    about:
      "Tropical and subtropical surface fish, typically 15–30 cm. Stay in the top ~20 m. They glide above water when fleeing; they aggregate but do not hold a herring pancake. Eaten by mahi, tuna, and billfish.",
    program:
      "Loose social mode on the shared grid: metres of spacing, weak alignment, individual darts instead of a turn-wave. Type II graze on z. Large pectorals are the mesh, not a flight integrator. Fear steers toward the surface — still in the water.",
    missing: [
      "Aerial gliding is not simulated.",
      "Gannets and other birds are not agents; common dolphin and mahi are the surface bites that exist.",
      "The taxi-then-glide (tail-beats on the surface, then airborne) is not a state — fear only swims.",
      "Eggs with filaments stuck to flotsam are not objects.",
      "Wind-relative glide heading is not a cue.",
    ],
  },
  sprat: {
    id: "sprat",
    common: "European sprat",
    latin: "Sprattus sprattus",
    guild: "Pelagic forage fish",
    diet: "Zooplankton",
    sex: "Female / male. Females are drawn slightly larger.",
    about:
      "Northeast Atlantic and Baltic clupeid, typically 8–16 cm. Smaller and shallower than herring. Usually above 100 m; recorded to about 150 m. Shares the North Sea with herring and sand lance.",
    program: "Tight polarized shoal. Type II graze on z. Smaller catalog share so it does not fill the 20k budget alone.",
    missing: [
      "Baltic salinity is not a field.",
      "Spring and autumn spawning pulses are not a season.",
      "Hypoxia-driven vertical squeeze in Baltic basins is not a field.",
      "Mixed herring–sprat schools in nature are species-pure shoals here.",
    ],
  },
  sandlance: {
    id: "sandlance",
    common: "Sand lance",
    latin: "Ammodytes",
    guild: "Benthopelagic forage fish",
    diet: "Zooplankton",
    sex: "Female / male. Females are drawn slightly larger.",
    about:
      "North Atlantic (A. marinus) and North Pacific (A. personatus) sandeels, typically 10–20 cm. Hover in thin schools near sand and bury in the bed. Usually 10–80 m; recorded to about 120 m. Important cod and seabird prey.",
    program:
      "Polarized but a very thin pancake, tight floor clearance. Type II graze on z. Fear steers toward the bed (still in the water — burying is not a state). Cod feel this school more than the herring pancake above.",
    missing: [
      "Burying in sand is not a state — they stay in the water.",
      "Seabird predation is not an agent.",
      "Diurnal bury/emerge (in the bed by day, out at dusk in many stocks) is not a schedule.",
      "Sediment grain-size as habitat is not a field.",
      "Winter dormancy in the sand is not a season.",
    ],
  },
  polarcod: {
    id: "polarcod",
    common: "Polar cod",
    latin: "Boreogadus saida",
    guild: "Pelagic forage fish",
    diet: "Zooplankton",
    sex: "Female / male. Females are drawn slightly larger.",
    about:
      "Circumpolar Arctic gadid, typically 15–25 cm. Ice-associated. Often 0–300 m; recorded to about 700 m under ice and on Arctic slopes. Forage for beluga, seabirds, and Greenland sharks (none of those are meshed).",
    program: "Slow polarized shoal. Type II graze on z. When the cell holds ice, DVM shoals toward the ice–water film. Carries the high Arctic when herring drop out.",
    missing: [
      "Beluga and Greenland shark are not in the catalog.",
      "Ice algae feeds P; polar cod still graze z, not a direct ice-algal bite.",
      "Antifreeze glycoproteins are not a physiology. Temperature is a field; this taxon is gated to cold SST.",
      "Under-ice spawning is not a season.",
    ],
  },
  silverfish: {
    id: "silverfish",
    common: "Antarctic silverfish",
    latin: "Pleuragramma antarctica",
    guild: "Pelagic forage fish",
    diet: "Zooplankton (copepods, krill)",
    sex: "Female / male. Females are drawn slightly larger.",
    about:
      "The pelagic forage of the Southern Ocean, typically 10–25 cm. Lives throughout the water column over the Antarctic slope; recorded to about 700 m. Eaten by penguins, toothfish, minke, and orca.",
    program: "Polarized shoal. Type II graze on z. When the cell holds ice, DVM shoals toward the ice–water film. Fills cells south of about 54°S that no northern clupeid covers. Toothfish hunt this taxon.",
    missing: [
      "Penguins are not agents.",
      "Krill is now a school taxon where hulls overlap; silverfish still graze z, not krill bites.",
      "Neutral buoyancy from high muscle lipid (no swim bladder) is just a fish integrator.",
      "Platelet ice as a distinct crystal habitat is not a type — ice is concentration and thickness.",
      "Ontogenetic depth split (larvae versus adults) is not a stage.",
      "Weddell seals are not agents.",
    ],
  },
  saury: {
    id: "saury",
    common: "Pacific saury",
    latin: "Cololabis saira",
    guild: "Surface forage fish",
    diet: "Zooplankton",
    sex: "Female / male. Females are drawn slightly larger.",
    about:
      "North Pacific scomberesocid, typically 20–30 cm. Surface to about 50 m. Loose aggregations, not a polarized lattice. Migrates with the Kuroshio / Oyashio.",
    program: "Loose surface aggregation on the shared grid. Type II graze on z. Fear steers toward the surface.",
    missing: [
      "Seasonal north–south migration is a range hull, not a swim.",
      "Night-light attraction (the stick-held dip-net fishery) is not a cue.",
      "The Oyashio–Kuroshio front is not a temperature field.",
      "Surface skipping and jumping are not a behaviour.",
    ],
  },
  marketsquid: {
    id: "marketsquid",
    common: "Market squid",
    latin: "Doryteuthis / Loligo",
    guild: "Pelagic cephalopod",
    diet: "Zooplankton; small fish",
    sex: "Female / male.",
    about:
      "Temperate loliginids (California Doryteuthis opalescens, European Loligo, Japanese Todarodes-adjacent market squid). Typically 12–30 cm mantle. Night near the surface; day tens to a few hundred metres. Recorded to about 400 m. Short-lived; spawn and die. Prey for sperm whales, sea lions, and fish.",
    program:
      "Scatter social mode on the shared hashed grid — nearly independent, not a fish shoal. Type II graze on z. Can pitch nearly vertically. Pulse–coast on the school velocity (same clock as the mantle mesh), then hang on the current. Sperm whales prefer this taxon (with Illex and lanternfish) when it is present.",
    missing: [
      "Piscivory on small fish is not a bite.",
      "Spawning aggregations and die-off are not a season.",
      "Sea lions are not agents.",
      "Chromatophore displays are not a state.",
      "The mantle pulse is now a speed envelope on the school loop, not a second integrator.",
      "Ink as a decoy is not a behaviour.",
      "Mating chains and benthic egg mops are not objects.",
      "Paralarvae are not agents.",
    ],
  },
  lanternfish: {
    id: "lanternfish",
    common: "Lanternfish",
    latin: "Myctophidae",
    guild: "Mesopelagic forage fish",
    diet: "Zooplankton",
    sex: "Female / male. Females are drawn slightly larger.",
    about:
      "The deep-scattering layer. Typically 3–15 cm. Night in the upper 100 m; day a few hundred metres down. Recorded to about 450 m for the taxa we mesh. Photophores glow against the dark and restore a fraction of visual detect for sighted hunters in the DSL. Food for Humboldt squid, sperm whales, and tunas.",
    program:
      "Scatter shoal on the shared hashed grid. Type II graze on z. Own DVM (night ~−40 m, day ~−280 m, max −450 m). o2Min 0.08 ml/L so they can occupy the OMZ; tunas cannot follow. Fear steers down toward the day band, not up. Modest catalog share so it does not fill the 20k budget. Presence is oceanic (|lat| < 52°), not a hull. Enlarges gridMinY only when this taxon is in the cell. Photophores are a look flag: in low PAR they restore detect range for sighted hunters and raise mesh emissive. Sperm whales still hunt this taxon by echolocation (darkness is not a starve).",
    missing: [
      "Family is one catalog id, not thirty myctophid species.",
      "Species-specific photophore patterns are not a mate cue.",
      "Ventral counterillumination is not rendered as a match to downwelling.",
      "Lunar inhibition of DVM is not a clock.",
      "Swimbladder resonance (the acoustic deep-scattering layer) is not a sense.",
    ],
  },
  krill: {
    id: "krill",
    common: "Krill",
    latin: "Euphausiidae",
    guild: "Euphausiid",
    diet: "Phytoplankton (p)",
    sex: "Female / male.",
    about:
      "Swarming euphausiids. Antarctic krill (Euphausia superba) south of about 54°S; northern krill (Meganyctiphanes) in the North Atlantic. Typically 2–6 cm. Night near the surface on phytoplankton; day tens of metres down. Food for minke, humpback, and silverfish in nature.",
    program:
      "Scatter swarm on the shared grid. Type II graze on phytoplankton p (not z), including ice-algal P when the cell holds ice. When ice is present, DVM shoals toward the ice–water film. Recruits when p or z can carry the mixed school budget. Mysticetes bite this taxon like any other school agent. Mesh hangs head-up; the paddle can station-keep below herring minSpeed, and hangs on the current more than a ram fish.",
    missing: [
      "Krill as a basin-scale density field is not this agent set.",
      "Ice-edge blooms as a mapped filament are not a season — ice concentration is a cell mean.",
      "Swarm densities of thousands per cubic metre are a scatter school, not a super-swarm field.",
      "Filter-basket feeding is Type II graze on p, not an appendage model.",
      "Antarctic lipid overwinter and diapause are not a season.",
      "Calyptopis / furcilia larvae and moulting stanzas are not stages.",
      "Photophore flashing is not a cue.",
    ],
  },
  jackmackerel: {
    id: "jackmackerel",
    common: "Jack mackerel",
    latin: "Trachurus",
    guild: "Pelagic forage fish",
    diet: "Zooplankton; small fish",
    sex: "Female / male. Females are drawn slightly larger.",
    about:
      "Carangid forage of eastern-boundary currents, typically 20–50 cm. Deeper and larger than sardine. Humboldt (murphyi), California (symmetricus), Japan (japonicus), New Zealand (declivis). Usually the upper 150 m; recorded near 300 m. Prey for tunas and Humboldt squid.",
    program:
      "Polarized shoal, not a Scomber clone: different hulls, a deeper day band, and a Humboldt-squid huntTaxa slot. Type II graze on z.",
    missing: [
      "Piscivory on anchoveta is not a school-on-school bite.",
      "The oceanic jack-mackerel-belt spawning is a hull, not a swim.",
      "Seamount aggregations are not landmarks.",
    ],
  },
  illex: {
    id: "illex",
    common: "Shortfin squid",
    latin: "Illex",
    guild: "Pelagic cephalopod",
    diet: "Zooplankton; small fish",
    sex: "Female / male.",
    about:
      "Ommastrephid squid of the Atlantic. Northern shortfin (illecebrosus) from the Grand Banks to the Mid-Atlantic; Argentine shortfin (argentinus) on the Patagonian shelf. Typically 20–40 cm mantle. Night near the surface; day a few hundred metres. Recorded to about 600 m. The Atlantic squid sperm whales actually meet.",
    program:
      "Scatter school squid, same programme as market squid but an Atlantic hull and a deeper day refuge. Type II graze on z. Can pitch nearly vertically. Pulse–coast on the school velocity. Sperm huntTaxa includes this id.",
    missing: [
      "Shelf-break spawning and the fishery are not a season.",
      "Chromatophores and ink are not displays. The mantle pulse is a speed envelope on the school loop, not a second integrator.",
      "Semelparity after spawning is not a death programme.",
      "Onshore–offshore ontogenetic migration is a hull, not a swim.",
      "Cannibalism is not a bite.",
    ],
  },
  shark: {
    id: "shark",
    common: "Blue shark",
    latin: "Prionace glauca",
    guild: "Pelagic predator",
    diet: "Fish, squid, carrion",
    sex: "Female / male. Females are larger and initiate courtship.",
    about:
      "Oceanic lamnid-adjacent carcharhinid, typically 1.8–3.3 m. Worldwide in temperate and tropical gyres. Usually 0–350 m; recorded to about 1000 m. Eats pelagic fish and squid. Viviparous; females pup after a gestation the year-timer stands in for.",
    program:
      "Burst-and-glide vehicle: the tail actually quiets on the glide, then kicks on the burst. Patrol → stalk → strike-from-below → recover. Bites any school fish in mouth radius. Pack spacing; different hunt indices. Roam uses the full column this cell allows, not a herring-only band.",
    missing: [
      "Humboldt squid are a school pack sperm whales hunt on huntTaxa; blue sharks do not bite Humboldt.",
      "Carrion and seabirds are not food items.",
      "Transoceanic pupping-versus-feeding migrations are a range hull, not a swim.",
      "Sexual segregation (females and males in different gyres) is not a state.",
      "Olfaction along an odor corridor to a carcass is not a sense.",
      "Courtship is a year-timer plus energy, not bite-copulation or a nursery in another cell.",
      "Magnetoreception is not a sense.",
    ],
  },
  tuna: {
    id: "tuna",
    common: "Skipjack tuna",
    latin: "Katsuwonus pelamis",
    guild: "Pelagic predator",
    diet: "Forage fish, squid",
    sex: "Female / male.",
    about:
      "Tropical and subtropical tuna, typically 40–80 cm. Ram ventilator — must keep swimming. Usually 0–200 m; recorded to about 260 m. Schools with birds on surface forage. Broadcast spawner.",
    program:
      "Polarized hashed-grid tuna (`diet: bite`). Neighbour-walk bites on forage fish in the photic-to-upper-mesopelagic band. Share of the prey-capped school slice, not a Reynolds handful. o2Min 2.4 ml/L — they will not follow lanternfish or Humboldt into the OMZ. Recruit from the mixed school budget when energy holds. Absent without school prey, poleward of about 40°.",
    missing: [
      "Bird-associated surface feeding is not a cue.",
      "Squid diet is school fish only.",
      "FAD and log association is not a cue.",
      "Mixed schools with yellowfin or dolphins are pack spacing, not a mixed-species association.",
      "Surface boiling schools are generic ram hunting, not a feeding mode.",
      "Spawning whenever the water is warm is a year-timer recruit, not an SST gate.",
    ],
  },
  cod: {
    id: "cod",
    common: "Atlantic cod",
    latin: "Gadus morhua",
    guild: "Demersal predator",
    diet: "Fish, infauna, crabs",
    sex: "Female / male. Females are larger.",
    about:
      "North Atlantic shelf gadid, typically 40–120 cm. Lives on the sand and in the lower column, usually 10–400 m; recorded to about 600 m. Not an abyssal fish. Eats herring, capelin, sand lance, and infauna.",
    program:
      "Scatter school on the shelf floor (`habitat: benthic`). Neighbour-walk bites herring, capelin, sand lance, sprat, and polar cod (huntTaxa). Also Type II-grazes living infauna when on the bed (`grazeBenthos`). Prey-capped headcount so a North Sea cell holds a shoal of cod, not a vehicle pair. Dropped if the cell floor is deeper than about 650 m — that is slope/abyss, not shelf.",
    missing: [
      "Named crabs, polychaetes, and amphipods are not agents — the bed field is infauna density, not a crab loop.",
      "Fishing mortality is not in the budget.",
      "Skrei / Lofoten spawning migrations are a hull, not a commute.",
      "Drumming in spawning aggregations is not a sound field.",
      "Age-structured cannibalism is not a bite.",
      "Year-class structure is not a state.",
    ],
  },
  toothfish: {
    id: "toothfish",
    common: "Antarctic toothfish",
    latin: "Dissostichus mawsoni",
    guild: "Slope predator",
    diet: "Antarctic silverfish, other notothenioids",
    sex: "Female / male.",
    about:
      "The large demersal predator of the Southern Ocean slope, typically 1–2 m. Lives from the shelf break to about 2000 m. Not a North Sea cod. Eats silverfish. Antarctic toothfish (mawsoni) on this hull; Patagonian toothfish is a later range.",
    program:
      "Scatter school on the Antarctic slope (`habitat: benthic`). huntTaxa silverfish only. Prey-capped slice of the hashed grid. Biological max 2000 m; the seafloor still wins. Not dropped at 650 m — that gate is for Atlantic cod. Starves if silverfish are missing.",
    missing: [
      "Patagonian toothfish (D. eleginoides) is not a second hull yet.",
      "Icefish and other notothenioids are not school taxa.",
      "Neutral buoyancy from muscle lipid is not a physics.",
      "Circumpolar displacement on the Antarctic Circumpolar Current is a hull, not a swim.",
      "Slow growth over decades is not an age timer.",
      "The longline fishery is not mortality.",
    ],
  },
  greatwhite: {
    id: "greatwhite",
    common: "Great white shark",
    latin: "Carcharodon carcharias",
    guild: "Coastal pelagic predator",
    diet: "Fish, marine mammals, carrion",
    sex: "Female / male. Females are larger.",
    about:
      "Temperate coastal lamnid, typically 4–6 m. California, northeast US, Chile, southern Australia, Japan, Mediterranean, South Africa. Often 0–250 m; recorded to about 1200 m on offshore dives. Adults eat mammals; juveniles eat fish.",
    program:
      "Burst-and-glide vehicle. Bites school fish. Larger fear radius than the blue shark. Temperate coastal hulls only.",
    missing: [
      "Seals, sea lions, and whale carcasses are not agents — this build is the fish-eating programme.",
      "Endothermy / regional warm muscle is not a temperature field.",
      "Breaching on pinnipeds is not a behaviour.",
      "The juvenile-to-adult diet shift (fish, then mammals) is not ontogeny.",
      "The offshore white-shark-café commute is a hull, not a swim.",
      "Spyhopping is not a state.",
      "Colony-adjacent hunting landmarks are not objects.",
    ],
  },
  tigershark: {
    id: "tigershark",
    common: "Tiger shark",
    latin: "Galeocerdo cuvier",
    guild: "Coastal pelagic predator",
    diet: "Fish, turtles, carrion, birds",
    sex: "Female / male.",
    about:
      "Tropical coastal shark, typically 3–4.5 m. Usually 0–100 m; recorded to about 350 m. Famous generalist.",
    program: "Burst-and-glide. Tropical (|lat| < 28°) with school prey. Bites school fish.",
    missing: [
      "Turtles, carrion, and seabirds are not agents. Energy is only from school-fish bites, not a fake constant.",
      "Night-inshore / day-offshore commutes are not a schedule.",
      "Ambush at turtle nesting beaches is not a landmark.",
      "Scavenging on whale carcasses is not an object.",
      "Rolling on large prey is not a handling behaviour.",
    ],
  },
  hammerhead: {
    id: "hammerhead",
    common: "Scalloped hammerhead",
    latin: "Sphyrna lewini",
    guild: "Coastal pelagic predator",
    diet: "Fish, rays, squid",
    sex: "Female / male.",
    about:
      "Tropical and subtropical sphyrnid, typically 1.5–3 m. Schools by day at seamounts; hunts at night. Usually 0–275 m; recorded to about 500 m.",
    program: "Burst-and-glide, tighter pack spacing than tiger sharks. Bites school fish. |lat| < 32°.",
    missing: [
      "Rays and seamount schooling landmarks are not in the cell.",
      "Electroreception is not a sense.",
      "Daytime seamount schooling then night hunting is not a schedule — they use the generic patrol/stalk loop.",
      "The cephalofoil is the mesh, not a sensory array or hydrofoil.",
      "Natal homing to coastal pupping lagoons is not a migration.",
      "Scalloped, great, and smooth hammerheads are one id.",
    ],
  },
  whaleshark: {
    id: "whaleshark",
    common: "Whale shark",
    latin: "Rhincodon typus",
    guild: "Filter-feeding shark",
    diet: "Zooplankton, fish eggs, small fish",
    sex: "Female / male.",
    about:
      "Largest fish, typically 8–12 m. Tropical. Feeds at the surface on blooms and bait, but makes deep dives — recorded to about 1920 m. Not a hunter of herring shoals.",
    program:
      "Ram vehicle. Filter diet: Type II graze on z at the current depth (plankton.graze). Does not bite school fish. Hungry animals stay with the bloom; satiated animals may roam the full column this cell allows. Tiny fear radius. Little bank — pecs are hydrofoils, not flapping wings.",
    missing: [
      "Fish eggs and bait balls as a separate food are not fields.",
      "The deep-dive optical story is still photic water — lighting is not a reason to forbid the dive.",
      "Ram-filter versus suction-filter (vertical feeding, yo-yo dives) is graze-while-cruising, not a feeding-mode switch.",
      "Aggregations at fish-spawn slicks are not a cue.",
      "Remoras are not agents.",
      "Seasonal coastal aggregations (Ningaloo, Yucatán) are hull presence, not a commute.",
    ],
  },
  minke: {
    id: "minke",
    common: "Minke whale",
    latin: "Balaenoptera acutorostrata / bonaerensis",
    guild: "Mysticete",
    diet: "Krill and small schooling fish",
    sex: "Female / male.",
    about:
      "Small rorqual, typically 7–10 m. Northern (acutorostrata) and Antarctic (bonaerensis) minke share this id. Usually feeds in the upper 100 m; recorded to about 400 m. Must surface to breathe. Lunge-feeds on krill and forage fish.",
    program:
      "Ram vehicle, authored minke glTF (slender rorqual, not a humpback clone). Diet both: filter-graze z and bite school fish, including krill swarms when that taxon is present. Air-breather: hangs level at the surface and blows, then a foraging dive toward prey or typical forage ~50 m, clamped by min(400 m, this cell's floor). Typical 6 min dive / 1.5 min blow series, mapped 5× onto wall-clock; recovery only counts at the air.",
    missing: [
      "Lunge-feeding bubble nets are not a hydrodynamics model.",
      "Ice-edge krill super-swarms are still a school patch, not a basin field.",
      "Gape-and-accordion lunge kinematics are a bite radius, not a gulp.",
      "Mother–calf pairs are not a social unit.",
      "Seasonal fasting is not a budget.",
      "Northern and Antarctic minke share this id; dwarf minke is not split.",
    ],
  },
  humpback: {
    id: "humpback",
    common: "Humpback whale",
    latin: "Megaptera novaeangliae",
    guild: "Mysticete",
    diet: "Krill and schooling fish",
    sex: "Female / male.",
    about:
      "Coastal migratory rorqual, typically 12–16 m. Feeds in high-latitude summers, winters in tropics. Lunge-feeds; recorded to about 500 m, usually much shallower. Must surface to breathe.",
    program:
      "Burst vehicle, fluke swim, huge bite radius, long pecs, ventral grooves on the throat. Slow turn, little bank; pecs beat. Hunts school fish and krill. Air-breather: hangs level at the surface and blows two columns, then a foraging dive toward prey or typical forage ~60 m, clamped by min(500 m, this cell's floor). Typical 10 min dive / 2.5 min blow series, mapped 5× onto wall-clock; recovery only counts at the air. Coastal migratory hulls. Needs school prey in the cell.",
    missing: [
      "Song and breeding lagoons are not a season.",
      "Bubble-net hydrodynamics are not a field.",
      "Cooperative bubble-net feeding (a ring of bubbles, trap the bait) is not a behaviour.",
      "Breach, pec-slap, and lobtail are not states.",
      "Fasting on the tropical wintering grounds is not a budget — they hunt wherever the hull says.",
      "Male escorting and competition are not a courtship.",
      "Calf nursing is not an energy transfer.",
      "North–south migration is a hull, not a swim between cells.",
    ],
  },
  spermwhale: {
    id: "spermwhale",
    common: "Sperm whale",
    latin: "Physeter macrocephalus",
    guild: "Odontocete",
    diet: "Squid (deep-sea squid, Humboldt, market squid)",
    sex: "Female / male. Males are drawn larger (typically 16 m vs 11 m).",
    about:
      "The deep-diving toothed whale. Females ~11 m, males ~16 m. Cosmopolitan in ice-free oceans. Typical foraging dives 400–1200 m for 40–50 minutes; recorded beyond 2000 m. Hunts squid by echolocation. Must return to the surface to breathe.",
    program:
      "Burst vehicle, fluke swim, block head (spermaceti organ, underslung jaw, left blowhole, knuckles to the fluke). The head stays stiff; only the tailstock waves. Slow turn, little bank. Air-breather: hangs level at the surface and blows a single forward-left spout, then a foraging dive toward live squid/lanternfish or typical forage ~700 m — not a commute to 2000 m. maxDepth 2000 m is the clamp; in a 1500 m cell the floor wins first. Prefers market squid, Illex, lanternfish, and Humboldt squid (huntTaxa). Bites giant squid when that vehicle is in mouth range (huntKinds). Typical 45 min forage / 8 min blow series, mapped 15× onto wall-clock (~3 min dive) so it still finishes inside the 8 min day; recovery only counts at the air. Does not bite herring. Missing named prey still produces the dive; it does not get free calories. sense is echo: PAR does not shrink this whale's detect or fear.",
    missing: [
      "Glass squid (Histioteuthis) are not agents. The whale still dives; it does not get free calories from empty water.",
      "Echolocation clicks are not a sound field. Detect range does not fall with PAR — darkness is not a starve.",
      "Coda dialects and clan culture are not a state.",
      "Creche behaviour — females and calves staying at the surface while adults dive — is not a social split. Every vehicle dives.",
      "Spermaceti buoyancy control is not a physics.",
      "The blow is a particle puff, not condensing vapour or a sound.",
      "Vertical sleeping at the surface is not a state.",
      "Male bachelor groups versus female social units are size dimorphism, not kinship.",
      "Calf nursing during the surface interval is not a transfer.",
    ],
  },
  orca: {
    id: "orca",
    common: "Orca",
    latin: "Orcinus orca",
    guild: "Odontocete",
    diet: "Fish (this ecotype); other ecotypes eat mammals",
    sex: "Female / male.",
    about:
      "Cosmopolitan dolphin, typically 5–8 m. Fish-eating (resident-type) ecotypes hunt herring, salmon, and other fish, usually in the upper 100–200 m; recorded to about 800 m. Must surface to breathe. Mammal-eating (transient) ecotypes hunt seals and whales.",
    program:
      "Ram vehicle, authored orca glTF (taller dorsal on males; white eye patch and belly). Tight pack, large fear radius. Bites school fish. Air-breather: hangs level at the surface and blows a short puff, then a foraging dive toward the school or typical forage ~90 m, clamped by min(800 m, this cell's floor). Typical 6 min dive / ~1.2 min blow series, mapped 5× onto wall-clock; recovery only counts at the air. This is the fish-eating programme. Banks in the turn like a dolphin, not a rorqual. sense is echo: PAR does not shrink detect or fear.",
    missing: [
      "Mammal-eating ecotypes are not wired — seals and other whales are not prey.",
      "Salmon are not a school taxon.",
      "Pod culture / dialect is not a state.",
      "Carousel feeding (herring ball plus tail-slap) is a generic bite, not a cooperative hunt.",
      "Wave-washing seals off ice and beach-hunting at Punta Norte are not behaviours.",
      "Spyhop, breach, and play (kelp, waves, tossing prey) are not states.",
      "Matrilineal pods that stay together for life are pack spacing, not kinship.",
      "Food-sharing and teaching calves are not a transfer.",
      "Transient, resident, and offshore ecotypes are one fish-eating programme.",
    ],
  },
  commondolphin: {
    id: "commondolphin",
    common: "Common dolphin",
    latin: "Delphinus delphis",
    guild: "Odontocete",
    diet: "Flying fish, sardinella, anchovy, sardine",
    sex: "Female / male.",
    about:
      "Small oceanic dolphin, typically 1.7–2.4 m. Tropical and warm-temperate. Hunts surface forage, often with tunas. Usually the upper 200 m; recorded near 300 m. Must surface to breathe.",
    program:
      "Ram vehicle, authored dolphin glTF, smaller than orca. Banks in the turn. huntTaxa is flying fish, sardinella, anchovy, and sardine — the surface loop mahi also uses. Air-breather: hangs level at the surface and blows a small puff, then a foraging dive toward that prey or typical forage ~18 m, clamped by min(300 m, this cell's floor). Typical 2.5 min dive / ~40 s blow series, mapped 5× onto wall-clock; recovery only counts at the air. Present |lat| < 40° when that prey exists.",
    missing: [
      "Tuna-dolphin associations are not a cue.",
      "Long-beaked D. capensis is not a second id.",
      "Bow-riding and wake-riding are not behaviours.",
      "Aerial play, spinning, and surfing internal waves are not states.",
      "Super-pods of hundreds to thousands are a raised vehicle count (18–28), not the hashed grid — they breathe.",
      "Night feeding on the DSL / lanternfish in some stocks is not wired — huntTaxa is surface forage only.",
      "Whistles and echolocation are not a sense.",
      "Cooperative herding of anchovy into a bait ball is not hydrodynamics.",
      "Mother–calf pairs and babysitting are not a social unit.",
    ],
  },
  humboldtsquid: {
    id: "humboldtsquid",
    common: "Humboldt squid",
    latin: "Dosidicus gigas",
    guild: "Pelagic cephalopod predator",
    diet: "Fish, other squid",
    sex: "Female / male.",
    about:
      "East Pacific jumbo flying squid, typically 0.8–2 m. Famous DVM: night in the upper 100 m, day 200–700 m, recorded to about 1200 m in the oxygen minimum. Hunts anchoveta, sardine, and lanternfish. Cannibalistic.",
    program:
      "Scatter school, jet pulse–coast on the hashed-grid velocity (same integrator as market squid), not a Reynolds handful. Day DVM follows the OMZ core (`omzCoreY`); night the upper 100 m. Enlarges `gridMinY` when present. Neighbour-walk bites anchovy, sardine, mackerel, lanternfish, and jack mackerel (huntTaxa). In low PAR, lanternfish photophores restore a fraction of detect range so the day OMZ hunt is not a starve. Flees sperm whales downward (deep day band). East Pacific hull plus an OMZ presence gate. Sperm whales hunt this taxon (`huntTaxa`).",
    missing: [
      "Cannibalism is not a school-on-school huntTaxa loop on this pack.",
      "Rapid chromatophore flashing as pack communication is not a state.",
      "Colour change (red at depth, paler at the surface) is not a shader.",
      "Feeding frenzies packing on a bait are generic strikes.",
      "Floating gelatinous egg masses are not objects.",
      "One-to-two-year boom–bust with El Niño is not a season.",
    ],
  },
  mahi: {
    id: "mahi",
    common: "Mahi-mahi",
    latin: "Coryphaena hippurus",
    guild: "Surface pelagic predator",
    diet: "Flying fish, other surface forage",
    sex: "Female / male.",
    about:
      "Tropical surface hunter, typically 0.8–1.5 m. Lives with flotsam in the top ~85 m. Fast-growing. Eaten by billfish and sharks.",
    program:
      "Loose hashed-grid hunter in the surface band (`diet: bite`). Neighbour-walk bites on school fish. Prey-capped share, not a vehicle pair. Absent poleward of about 32°.",
    missing: [
      "Flotsam / FADs are not objects.",
      "Aerial flying-fish strikes are not a behaviour.",
      "Extreme growth (adult size in months) is a recruit, not a growth curve.",
      "Colour change (gold alive, silver in death) is not a shader.",
      "Sargassum as a nursery is not an object.",
      "Jumping after flying fish is not a behaviour.",
      "The bull's steep forehead is not a sexed mesh.",
    ],
  },
  barracuda: {
    id: "barracuda",
    common: "Great barracuda",
    latin: "Sphyraena barracuda",
    guild: "Coastal pelagic predator",
    diet: "Fish",
    sex: "Female / male.",
    about:
      "Tropical ambush piscivore, typically 0.6–1.7 m. Reefs, wrecks, and clear coastal water. Usually 0–50 m; recorded to about 110 m. Sit-and-dash, not a ram tuna.",
    program:
      "Scatter hashed-grid sit-and-dash (`diet: bite`): wide spacing, short neighbour bites, stays nearly horizontal. Tropical (|lat| < 28°). Prey-capped share, not a vehicle pack.",
    missing: [
      "Reef structure as a sit-and-wait landmark is not a collider type.",
      "Hover-then-dash from a wreck or reef is scatter spacing, not ambush-from-structure.",
      "Curiosity toward shiny objects is not a cue.",
      "Solitary adults versus juvenile schools are scatter spacing on one grid.",
      "Crepuscular hunting peaks are not a clocked window — hunger is the gate.",
    ],
  },
  yellowfin: {
    id: "yellowfin",
    common: "Yellowfin tuna",
    latin: "Thunnus albacares",
    guild: "Pelagic predator",
    diet: "Fish, squid",
    sex: "Female / male.",
    about:
      "Tropical tuna, typically 1–1.8 m. Deeper and larger than skipjack. Often 0–250 m; recorded to about 500 m. Can share a cell with skipjack because skipjack stay shallower.",
    program:
      "Polarized hashed-grid tuna (`diet: bite`). Neighbour-walk bites on school fish. Prey-capped share. o2Min 2 ml/L so the −500 m record is an oxygen ceiling, not a commute. Tropical (|lat| < 32°).",
    missing: [
      "FADs and dolphin-associated schools are not cues.",
      "Mixed-species tuna schools are pack spacing, not an association.",
      "Regional endothermy is not a temperature field.",
      "Surface boiling is generic ram hunting.",
      "Spawning in warm water is a year-timer, not an SST gate.",
    ],
  },
  bluefin: {
    id: "bluefin",
    common: "Bluefin tuna",
    latin: "Thunnus thynnus / orientalis / maccoyii",
    guild: "Pelagic predator",
    diet: "Herring, mackerel, sardine, saury, anchovy, squid",
    sex: "Female / male.",
    about:
      "Temperate giant tuna. Atlantic, Pacific, and southern bluefin share this id (latin follows hemisphere). Typically 1.5–3 m. Endothermic; hunts from the surface to about 1000 m. Needs named temperate forage, not a flying-fish-only cell.",
    program:
      "Ram gait. Trophic gate is named forage (herring, mackerel, sardine, saury, anchovy, pilchard, jack mackerel). Uses the column down to min(1000 m, this cell's floor).",
    missing: [
      "Regional endothermy is not a temperature field.",
      "Spawning in the Gulf of Mexico / Mediterranean is not a migration.",
      "Transoceanic feeding–spawning commutes are a hull, not a swim.",
      "Giant versus school-size bluefin are one vehicle scale.",
      "Purse-seine and ranching mortality are not in the budget.",
      "The thermal niche that lets them hunt in subpolar water is not a field.",
    ],
  },
  sailfish: {
    id: "sailfish",
    common: "Sailfish",
    latin: "Istiophorus platypterus",
    guild: "Surface pelagic predator",
    diet: "Fish, squid",
    sex: "Female / male.",
    about:
      "Tropical billfish, typically 2–3 m. Fastest cruise in the catalog. Usually the upper 50–100 m; recorded to about 200 m. Raises the sail when herding bait. Depth partitions it from yellowfin.",
    program:
      "Loose hashed-grid billfish (`diet: bite`). Tropical (|lat| < 32°) with school prey. Neighbour-walk bites restore energy on the prey-capped slice.",
    missing: [
      "Sail-herding hydrodynamics are not a behaviour.",
      "The sail is the mesh, not a scoring device.",
      "Group herding with raised sails and colour flashing is not a cooperative hunt.",
      "The bill is used as a mouth bite, not a tap-and-slash on bait.",
      "Rapid colour change during the hunt is not a shader.",
      "Jumping and surface basking are not states.",
    ],
  },
  giantsquid: {
    id: "giantsquid",
    common: "Giant squid",
    latin: "Architeuthis dux",
    guild: "Pelagic cephalopod predator",
    diet: "Fish and squid (lanternfish, market squid, Illex)",
    sex: "Female / male. Females are drawn larger.",
    about:
      "The deep oceanic squid sperm whales actually hunt. Mantle to about 2 m; total length often 8–13 m. Worldwide in ice-free deep water, typically 300–1000 m, recorded near 1200 m. Not a Humboldt jumbo: slower, deeper, and not tied to the East Pacific OMZ.",
    program:
      "Jet vehicle on its own DVM (night ~−420 m, day ~−850 m, max −1200 m). Longer hang between pulses than Humboldt. Bites lanternfish, market squid, and Illex (huntTaxa). In low PAR, lanternfish photophores restore a fraction of detect range. Absent on shelves shallower than about 350 m. Sperm whales bite this vehicle (huntKinds). Starves if named prey is missing — no free calories.",
    missing: [
      "Colossal squid (Mesonychoteuthis) is not a second hull.",
      "Ammonium chloride buoyancy is not a physics.",
      "The beak and toothed suckers are a mouth radius, not handling.",
      "Sperm-whale sucker-scar stories are not a wound state.",
      "Gelatinous tissue and a low metabolic rate are an energyDrain knob, not a tissue model.",
    ],
  },
  benthos: {
    id: "benthos",
    common: "Benthos",
    latin: "Seafloor carbon and infauna",
    guild: "Benthos",
    diet: "Sinking detritus; microphytobenthos on photic floors",
    sex: "Unsexed field.",
    about:
      "Two boxes on the bed: organic carbon (pelagic rain plus microphytobenthos where the sand is sunlit) and living infauna density that grazes that carbon. Not a named worm or a crab — a field the demersal guild can actually eat.",
    program:
      "Field agent. Detritus sinks down the shared NPZD column onto a 2D carbon store. Photic floors grow extra carbon from PAR (the shelf analog of ice algae). Infauna Type-II-grazes that carbon, remineralises, and is what `grazeBenthos` bites. Cod graze the living store when they are on the bed. Present in every wet cell.",
    missing: [
      "Named benthic taxa (crabs, amphipods, polychaetes) are not agents — infauna is a density, not a worm mesh.",
      "Sediment grain size is not a field. Bed oxygen is the column sample at the seafloor, not a sediment profile.",
      "Bioturbation is not mixing.",
      "Phytodetritus pulses after blooms are rain plus MPB, not a seasonal dump.",
    ],
  },
};
