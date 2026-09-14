/**
 * Catalog contract for the viability suite. New species, hunt lists, and
 * named cells must stay complete so a multi-day cell run can still tell
 * gap from tweak from empty habitat.
 */
import { PRESENCE_IDS, SPECIES, namedPreyIds, SCHOOL_IDS, VEHICLE_IDS, FIELD_IDS } from "./fauna.js";
import { FAUNA } from "./fieldNotes.js";
import { DEMO_CELLS, coupledDemoIds, makeDemoPatch, naturalPresence, sandboxIds } from "./demos.js";
import { applyPatch } from "./patch.js";
import { fullCatalog, catalogRow } from "../simulation/viability.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

{
  const ids = Object.keys(SPECIES);
  assert(ids.length === PRESENCE_IDS.length, "PRESENCE_IDS must list every SPECIES key");
  for (const id of PRESENCE_IDS) {
    const spec = SPECIES[id];
    const note = FAUNA[id];
    assert(spec, `${id} is in PRESENCE_IDS but not SPECIES`);
    assert(note, `${id} needs a field-notes row so viability can name gaps`);
    assert(note.common && note.latin && note.guild, `${id} field-notes need common, latin, guild`);
    assert(note.program, `${id} field-notes need a program`);
    assert(Array.isArray(note.missing), `${id} needs missing[] — viability uses it to tell gap from tweak`);
    assert(spec.agent === "school" || spec.agent === "vehicle" || spec.agent === "field", `${id} agent`);
    for (const pid of namedPreyIds(id)) {
      assert(SPECIES[pid], `${id} hunts unknown catalog id ${pid}`);
      assert(pid !== id, `${id} should not list itself as named prey`);
    }
  }
}

{
  const catalog = fullCatalog();
  const live = PRESENCE_IDS.filter((id) => SPECIES[id]?.agent !== "field");
  assert(catalog.length === live.length, "fullCatalog must track every non-field catalog id");
  const sperm = catalogRow("spermwhale");
  assert(sperm.huntTaxa.includes("lanternfish"), "sperm whale huntTaxa includes lanternfish");
  assert(sperm.huntKinds.includes("giantsquid"), "sperm whale huntKinds includes giant squid");
  assert(sperm.namedPrey.includes("giantsquid"), "namedPrey must surface huntKinds");
  assert(sperm.missing.length > 0, "sperm whale card lists gaps");
}

{
  assert(SCHOOL_IDS.length + VEHICLE_IDS.length + FIELD_IDS.length === PRESENCE_IDS.length, "agent partitions");
  assert(FIELD_IDS.includes("benthos"), "benthos is the field guild");
}

{
  const coupled = coupledDemoIds();
  assert(coupled.includes("catalog"), "catalog tank is a coupled cell");
  assert(coupled.includes("shelf"), "North Sea is a coupled cell");
  assert(coupled.includes("demersal"), "demersal infauna field is a coupled cell");
  assert(coupled.includes("omz"), "Humboldt OMZ is a coupled cell");
  assert(coupled.includes("pelagic"), "open pelagic is a coupled cell");
  const seen = new Set();
  for (const demo of DEMO_CELLS) {
    assert(!seen.has(demo.id), `duplicate demo ${demo.id}`);
    seen.add(demo.id);
    const patch = makeDemoPatch(demo);
    applyPatch(patch);
    assert(patch.demoId === demo.id, `${demo.id} patch should stamp demoId`);
    const natural = naturalPresence(demo);
    const sandbox = sandboxIds(demo);
    assert(sandbox.length > 0, `${demo.id} sandbox is empty`);
    if (demo.kind === "lab") {
      assert(natural.spermwhale > 0 && natural.giantsquid > 0, "catalog tank holds sperm whale and giant squid");
    }
  }
}

console.log("catalog contract: 4 checks ok");
