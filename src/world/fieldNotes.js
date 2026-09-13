/**
 * Natural-history copy for every catalog id. Presence still lives on
 * SPECIES + ranges. Cards in species.js compose Now / In nature /
 * In this cell / Not in the model from these rows.
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
      "Temperature and spawning grounds are not fields yet.",
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
      "Ice cover is not a field.",
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
      "Polarized shoal with a higher graze multiplier on z (p is not a separate bite). Shallow DVM. Does not commute into the abyss.",
    missing: [
      "Direct phytoplankton bites are not wired; graze still pulls z.",
      "Striped bass and coastal birds are not agents.",
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
      "Polarized clupeid shoal. Type II graze on z. Empty in the North Sea is a range gate.",
    missing: ["Temperature-driven stock collapses are not a field."],
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
    program: "Polarized shoal. Type II graze on z.",
    missing: ["Purse-seine fishing mortality is not in the budget."],
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
    program: "Slender polarized shoal. Type II graze on z. Competes with sardine where both hulls cover the kilometre.",
    missing: ["Egg and larval stages are not agents."],
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
    missing: ["Indian oil sardine is the same id with a localized latin name, not a second loop."],
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
      "Polarized shoal with a smaller share of the shared headcount. Type II graze on z only — piscivory on herring agents is not a bite yet, so they compete for the bloom rather than farming the herring school.",
    missing: [
      "Piscivory on herring, sprat, and sand lance is not wired.",
      "Pacific chub mackerel is this id with a localized name, not a second species loop.",
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
      "Loose social mode on the shared grid: metres of spacing, weak alignment, individual darts instead of a turn-wave. Type II graze on z. Large pectorals are the mesh, not a flight integrator.",
    missing: [
      "Aerial gliding is not simulated.",
      "Gannets and other birds are not agents; common dolphin and mahi are the surface bites that exist.",
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
    missing: ["Baltic salinity is not a field."],
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
      "Polarized but a very thin pancake, tight floor clearance. Type II graze on z. Cod feel this school more than the herring pancake above.",
    missing: [
      "Burying in sand is not a state — they stay in the water.",
      "Seabird predation is not an agent.",
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
    program: "Slow polarized shoal. Type II graze on z. Carries the high Arctic when herring drop out.",
    missing: [
      "Sea ice, beluga, and Greenland shark are not in the catalog.",
      "Under-ice habitat is not a field.",
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
    program: "Polarized shoal. Type II graze on z. Fills cells south of about 54°S that no northern clupeid covers. Toothfish hunt this taxon.",
    missing: [
      "Penguins are not agents.",
      "Krill is now a school taxon where hulls overlap; silverfish still graze z, not krill bites.",
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
    program: "Loose surface aggregation on the shared grid. Type II graze on z.",
    missing: ["Seasonal north–south migration is a range hull, not a swim."],
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
      "Scatter social mode on the shared hashed grid — nearly independent, not a fish shoal. Type II graze on z. Mesh is a mantle. Sperm whales prefer this taxon (with Illex and lanternfish) when it is present.",
    missing: [
      "Piscivory on small fish is not a bite.",
      "Spawning aggregations and die-off are not a season.",
      "Sea lions are not agents.",
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
      "The deep-scattering layer. Typically 3–15 cm. Night in the upper 100 m; day a few hundred metres down. Recorded to about 450 m for the taxa we mesh. Photophores are real; the shader is still epipelagic. Food for Humboldt squid, sperm whales, and tunas.",
    program:
      "Scatter shoal on the shared hashed grid. Type II graze on z. Own DVM (night ~−40 m, day ~−280 m, max −450 m). Modest catalog share so it does not fill the 20k budget. Presence is oceanic (|lat| < 52°), not a hull. Enlarges gridMinY only when this taxon is in the cell.",
    missing: [
      "A true mesopelagic optical story (dark water, photophore lighting) is not in the shader.",
      "Oxygen-minimum habitat is not a field.",
      "Family is one catalog id, not thirty myctophid species.",
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
      "Scatter swarm on the shared grid. Type II graze on phytoplankton p (not z). Recruits when p or z can carry the mixed school budget. Mysticetes bite this taxon like any other school agent.",
    missing: [
      "Krill as a basin-scale density field is not this agent set.",
      "Ice-edge blooms are not a season.",
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
    missing: ["Piscivory on anchoveta is not a school-on-school bite."],
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
      "Scatter school squid, same programme as market squid but an Atlantic hull and a deeper day refuge. Type II graze on z. Sperm huntTaxa includes this id.",
    missing: ["Shelf-break spawning and the fishery are not a season."],
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
      "Burst-and-glide vehicle. Patrol → stalk → strike-from-below → recover. Bites any school fish in mouth radius. Pack spacing; different hunt indices. Roam uses the full column this cell allows, not a herring-only band.",
    missing: [
      "Humboldt squid are a vehicle sperm whales hunt; blue sharks do not bite vehicles.",
      "Carrion and seabirds are not food items.",
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
      "Ram gait vehicle. Hunts school fish in the photic-to-upper-mesopelagic band. Bite restores energy. Year-timer recruit stands in for a spawn batch. Absent without school prey, poleward of about 40°.",
    missing: ["Bird-associated surface feeding is not a cue.", "Squid diet is school fish only."],
  },
  cod: {
    id: "cod",
    common: "Atlantic cod",
    latin: "Gadus morhua",
    guild: "Demersal predator",
    diet: "Fish, benthos, crabs",
    sex: "Female / male. Females are larger.",
    about:
      "North Atlantic shelf gadid, typically 40–120 cm. Lives on the sand and in the lower column, usually 10–400 m; recorded to about 600 m. Not an abyssal fish. Eats herring, capelin, sand lance, and benthos.",
    program:
      "Slow benthic vehicle: seafloor + a few metres. Small fear radius. Bites herring, capelin, sand lance, sprat, and polar cod (huntTaxa). Dropped if the cell floor is deeper than about 650 m — that is slope/abyss, not shelf.",
    missing: [
      "Benthos and crabs are not agents, so energy is only from named school-fish bites.",
      "Fishing mortality is not in the budget.",
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
      "Benthic vehicle on the Antarctic slope. huntTaxa silverfish only. Biological max 2000 m; the seafloor still wins. Not dropped at 650 m — that gate is for Atlantic cod. Starves if silverfish are missing.",
    missing: [
      "Patagonian toothfish (D. eleginoides) is not a second hull yet.",
      "Icefish and other notothenioids are not school taxa.",
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
    missing: ["Rays and seamount schooling landmarks are not in the cell.", "Electroreception is not a sense."],
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
      "Ram vehicle. Filter diet: Type II graze on z at the current depth (plankton.graze). Does not bite school fish. Hungry animals stay with the bloom; satiated animals may roam the full column this cell allows. Tiny fear radius.",
    missing: [
      "Fish eggs and bait balls as a separate food are not fields.",
      "The deep-dive optical story is still photic water — lighting is not a reason to forbid the dive.",
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
      "Ram vehicle, diet both: filter-graze z and bite school fish, including krill swarms when that taxon is present. Air-breather: surface, then dive as deep as min(400 m, this cell's floor). Time is compressed so the dive can finish in one breath-hold on screen.",
    missing: [
      "Lunge-feeding bubble nets are not a hydrodynamics model.",
      "Ice-edge krill super-swarms are still a school patch, not a basin field.",
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
      "Burst vehicle with a huge bite radius. Hunts school fish and krill. Air-breather: surface, then dive to min(500 m, this cell's floor). Coastal migratory hulls. Needs school prey in the cell.",
    missing: [
      "Song and breeding lagoons are not a season.",
      "Bubble-net hydrodynamics are not a field.",
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
      "Burst vehicle. Air-breather: brief surface, then a foraging dive to min(2000 m, this cell's floor). In a 1500 m cell that is ~1500 m, not a photic cap. Prefers market squid, Illex, and lanternfish (huntTaxa). Bites Humboldt squid when that vehicle is in mouth range (huntKinds). Time is compressed so the descent is fast enough to reach that floor in one breath-hold. Does not bite herring.",
    missing: [
      "Giant and glass squid (Architeuthis, Histioteuthis) are not agents. The whale still dives; it does not get free calories from empty water.",
      "Echolocation clicks are not a sense or a sound field.",
      "Lighting below the photic zone is still the epipelagic shader. That is an optical gap, not a reason to keep the whale shallow.",
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
      "Ram vehicle, tight pack, large fear radius. Bites school fish. Air-breather: surface, then dive to min(800 m, this cell's floor). This is the fish-eating programme.",
    missing: [
      "Mammal-eating ecotypes are not wired — seals and other whales are not prey.",
      "Salmon are not a school taxon.",
      "Pod culture / dialect is not a state.",
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
      "Ram vehicle, dolphin mesh, smaller than orca. huntTaxa is flying fish, sardinella, anchovy, and sardine — the surface loop mahi also uses. Air-breather. Present |lat| < 40° when that prey exists.",
    missing: [
      "Tuna-dolphin associations are not a cue.",
      "Long-beaked D. capensis is not a second id.",
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
      "Ram / jet vehicle, not a school scatter. Follows its own DVM band (not the herring pancake). Bites anchovy, sardine, mackerel, lanternfish, and jack mackerel (huntTaxa). Flees sperm whales. Fast energy drain. East Pacific hull. Sperm whales bite this vehicle.",
    missing: [
      "The oxygen-minimum zone is not a field.",
      "Cannibalism is not a huntKinds loop on this pack.",
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
    program: "Ram vehicle in the surface band. Hunts school fish. Absent poleward of about 32°.",
    missing: ["Flotsam / FADs are not objects.", "Aerial flying-fish strikes are not a behaviour."],
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
    program: "Burst-and-glide, slow cruise, fast lunge. Tropical (|lat| < 28°). Bites school fish.",
    missing: ["Reef structure as a sit-and-wait landmark is not a collider type."],
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
    program: "Ram gait. Hunts school fish. Tropical (|lat| < 32°).",
    missing: ["FADs and dolphin-associated schools are not cues."],
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
    program: "Ram vehicle, billfish mesh. Tropical (|lat| < 32°) with school prey. Bites restore energy.",
    missing: ["Sail-herding hydrodynamics are not a behaviour.", "The sail is the mesh, not a scoring device."],
  },
};
