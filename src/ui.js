import { CONFIG } from "./config.js";
import { CAMERA_MODES } from "./camera.js";
import { formatDayOfYear } from "./simulation/day.js";
import { DEMO_CELLS, defaultToggles, demoById, presenceFromToggles, sandboxIds } from "./world/demos.js";
import { SPECIES, SCHOOL_IDS, VEHICLE_IDS } from "./world/fauna.js";
import { FAUNA } from "./world/fieldNotes.js";
import { habitatTint } from "./world/ranges.js";

/**
 * Add a control: push an item into MENU, then hud.on(id, handler) in main.js.
 * Or at runtime: hud.addSection(...) / hud.addItem(...).
 * Toggles default to off unless `value` is true. Sliders/selects keep the value you set here.
 * `mapOnly` / `cellOnly` hide a row until that view is active.
 */
export { CAMERA_MODES };

export const MENU = [
  {
    id: "time",
    title: "Time",
    items: [
      {
        id: "liveClock",
        kind: "toggle",
        label: "Live clock",
        hint: "Advance local solar time. One on-screen day is 16 minutes.",
        key: "L",
        value: true,
      },
      {
        id: "hour",
        kind: "slider",
        label: "Time of day",
        hint: "Sets the hour and pauses the live clock.",
        min: 0,
        max: 24,
        step: 0.05,
        value: 10.4,
        format: formatClock,
      },
      {
        id: "dayOfYear",
        kind: "slider",
        label: "Day of year",
        hint: "Season for SST, ice, polar night, and who is in range. Occupancy scales abundance; it does not empty a hull the species still lives in.",
        min: 1,
        max: 365,
        step: 1,
        value: CONFIG.time.dayIndex ?? 180,
        format: formatDayOfYear,
      },
    ],
  },
  {
    id: "water",
    title: "Water",
    items: [
      {
        id: "storm",
        kind: "toggle",
        label: "Storm",
        hint: "Deepens the mixed layer, lifts nutrients toward the light, and raises current speed.",
        key: "T",
        cellOnly: true,
      },
      {
        id: "turbidity",
        kind: "slider",
        label: "Turbidity",
        hint: "Optical extinction. Higher is murkier and a shallower 1% light depth.",
        min: 0.35,
        max: 1.4,
        step: 0.05,
        value: CONFIG.water.turbidity,
        format: (n) => Number(n).toFixed(2),
        cellOnly: true,
      },
      {
        id: "sstAnomaly",
        kind: "slider",
        label: "SST anomaly",
        hint: "Degrees added to climatological sea-surface temperature. Zero is the mean; positive is an El Niño-style warm event.",
        min: -4,
        max: 4,
        step: 0.25,
        value: 0,
        format: (n) => `${Number(n) >= 0 ? "+" : ""}${Number(n).toFixed(2)} °C`,
        cellOnly: true,
      },
      {
        id: "o2Anomaly",
        kind: "slider",
        label: "Oxygen anomaly",
        hint: "ml/L added to the dissolved-oxygen column. Zero is climatology; negative intensifies the OMZ.",
        min: -2,
        max: 2,
        step: 0.1,
        value: 0,
        format: (n) => `${Number(n) >= 0 ? "+" : ""}${Number(n).toFixed(1)} ml/L`,
        cellOnly: true,
      },
      {
        id: "iceAnomaly",
        kind: "slider",
        label: "Ice anomaly",
        hint: "Added to climatological sea-ice concentration. Zero is the season; positive packs the cell.",
        min: -1,
        max: 1,
        step: 0.05,
        value: 0,
        format: (n) => `${Number(n) >= 0 ? "+" : ""}${Number(n).toFixed(2)}`,
        cellOnly: true,
      },
    ],
  },
  {
    id: "life",
    title: "Life",
    items: [
      {
        id: "reset",
        kind: "action",
        label: "Reset school",
        hint: "Respawn forage and reseed the bloom.",
        key: "R",
        cellOnly: true,
      },
    ],
  },
  {
    id: "map",
    title: "Map",
    items: [
      {
        id: "currents",
        kind: "toggle",
        label: "Current overlay",
        hint: "HYCOM mean-flow arrows on the world map.",
        mapOnly: true,
      },
    ],
  },
  {
    id: "view",
    title: "Window",
    items: [
      {
        id: "fear",
        kind: "toggle",
        label: "Fear radius",
        hint: "Draw the volume forage fish flee from.",
        key: "F",
        cellOnly: true,
      },
      {
        id: "lamp",
        kind: "toggle",
        label: "Lamp",
        hint: "Dive torch on the camera. A tight beam in the water; does not feed visualRange.",
        key: "K",
        cellOnly: true,
      },
      {
        id: "lampPower",
        kind: "slider",
        label: "Lamp power",
        hint: "Torch output. [ and ] nudge it. Dim to off; raise from off to strike.",
        min: 0.35,
        max: 1.45,
        step: 0.05,
        value: CONFIG.lamp.intensity,
        format: (n) => Number(n).toFixed(2),
        cellOnly: true,
      },
      {
        id: "lampAngle",
        kind: "slider",
        label: "Lamp beam",
        hint: "Half-angle. Narrow is a spot; wide is a flood. Still a cone, not a fill.",
        min: 8,
        max: 36,
        step: 1,
        value: CONFIG.lamp.angle,
        format: (n) => `${Math.round(Number(n))}°`,
        cellOnly: true,
      },
      {
        id: "camera",
        kind: "select",
        label: "Follow camera",
        hint: "Chase, orbit, cinematic, or surface while following.",
        options: CAMERA_MODES,
        value: 0,
        key: "C",
        cellOnly: true,
      },
      {
        id: "nextTarget",
        kind: "action",
        label: "Next target",
        hint: "Jump to the next followed animal of this kind.",
        key: "N",
        cellOnly: true,
      },
      {
        id: "depthZone",
        kind: "select",
        label: "Water column",
        options: ["Surface", "Sunlit", "Seafloor"],
        value: 1,
        key: "G",
        cellOnly: true,
        hint: "Jump the camera to a named layer. If the floor here is shallower than that depth, the camera walks into deeper water.",
      },
      {
        id: "pilot",
        kind: "toggle",
        label: "Pilot shark",
        hint: "Drive the lead blue shark. Esc releases.",
        key: "P",
        cellOnly: true,
      },
    ],
  },
];

const KEY_HELP = [
  ["M / Tab", "Open or close controls"],
  ["O", "World map (home)"],
  ["Cells", "Named kilometres: catalog tank and biomes"],
  ["Overlay", "Paint current habitat of any catalog taxon on the map"],
  ["Station", "This kilometre: what the water is doing"],
  ["I", "Census, when a cell is open"],
  ["Click census", "Jump to that animal"],
  ["Click column", "Jump to that depth; walks offshore if the floor here is too shallow"],
  ["Click water", "Enter a 1 km cell"],
  ["Click animal", "Field notes on that individual"],
  ["Drag", "Look around · orbit when following"],
  ["Scroll", "Zoom or dolly"],
  ["Right-drag", "Pan · Shift-drag also pans"],
  ["K", "Dive lamp · [ ] power"],
  ["C", "Follow camera (after Follow)"],
  ["N", "Next followed animal"],
  ["V / Esc", "Free roam · Esc also closes map if a cell is open"],
  ["WASD", "Move · E/Q rise/dive · G named depth · Shift boost · Space lunge"],
];

function formatClock(hour) {
  const h = Math.floor(((Number(hour) % 24) + 24) % 24);
  const m = Math.floor((Number(hour) % 1) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  for (const child of children) {
    if (child) node.append(child);
  }
  return node;
}

function defaultValue(item) {
  if (item.kind === "toggle") return item.value === true;
  if (item.kind === "slider") return Number(item.value ?? item.min ?? 0);
  if (item.kind === "select") return Number(item.value ?? 0);
  return null;
}

export function createHUD() {
  const body = document.getElementById("menu-body");
  const menu = document.getElementById("menu");
  const about = document.getElementById("about");
  const btnMenu = document.getElementById("btn-menu");
  const btnAbout = document.getElementById("btn-about");
  const btnMap = document.getElementById("btn-map");
  const btnCells = document.getElementById("btn-cells");
  const btnFilter = document.getElementById("btn-filter");
  const btnStation = document.getElementById("btn-station");
  const hint = document.getElementById("pilot-hint");
  const notes = document.getElementById("hud-notes");
  const btnNotes = document.getElementById("btn-notes");
  const stationPanel = document.getElementById("hud-station");
  const demosPanel = document.getElementById("hud-demos");
  const demosBody = document.getElementById("hud-demos-body");
  const filterPanel = document.getElementById("hud-filter");
  const filterBody = document.getElementById("hud-filter-body");
  const censusPanel = document.getElementById("hud-census");
  const columnRoot = document.getElementById("hud-column");
  const stationBody = document.getElementById("hud-station-body");
  const censusBody = document.getElementById("hud-census-body");
  const brandPlace = document.getElementById("brand-place");
  const subjectPanel = document.getElementById("hud-subject");
  const subjectKind = document.getElementById("hud-subject-kind");
  const subjectTitle = document.getElementById("hud-subject-title");
  const subjectSub = document.getElementById("hud-subject-sub");
  const subjectBody = document.getElementById("hud-subject-body");
  const subjectNotes = document.getElementById("hud-subject-notes");
  const btnFollow = document.getElementById("hud-follow");
  const tip = el("div", { class: "hud-tip", hidden: "", role: "tooltip" });
  document.body.append(tip);
  const fields = new Map();
  const sections = new Map();
  const handlers = new Map();
  const values = { oceanMap: false };
  const censusRows = bindCensus(censusBody, (id) => {
    const fn = handlers.get("focusSpecies");
    if (fn) fn(id);
  });
  const stationView = bindStation(stationBody);
  const columnView = bindColumn(columnRoot, (y) => emit("jumpY", y));
  const subjectRows = bindStats(subjectBody, tip, (id) => {
    const fn = handlers.get("focusSpecies");
    if (fn) fn(id);
  });
  const noteRows = bindNotes(subjectNotes);
  let filterView = { hasSelection() { return false; } };

  let dock = null;
  let cameraLive = false;
  let entered = false;
  const CELL_DOCKS = new Set(["census", "station", "subject"]);
  body.replaceChildren();

  for (const section of MENU) {
    const block = el("section", { class: "menu-section", "data-section": section.id }, [
      el("h3", { text: section.title }),
    ]);
    sections.set(section.id, block);
    for (const item of section.items) {
      values[item.id] = defaultValue(item);
      const field = buildItem(item, values);
      fields.set(item.id, field);
      bindField(item, field);
      render(item.id);
      block.append(field.row);
    }
    body.append(block);
  }

  const help = el("section", { class: "menu-section menu-help" }, [
    el("h3", { text: "Keys" }),
  ]);
  const keys = el("dl", { class: "about-glossary menu-keys" });
  for (const [key, text] of KEY_HELP) {
    keys.append(
      el("div", {}, [
        el("dt", { text: key }),
        el("dd", { text }),
      ])
    );
  }
  help.append(keys);
  body.append(help);

  function emit(id, value) {
    const fn = handlers.get(id);
    if (fn) fn(value);
  }

  function render(id) {
    const item = findItem(id);
    const field = fields.get(id);
    if (!item || !field) return;
    const value = values[id];
    if (item.kind === "toggle") {
      field.row.classList.toggle("on", !!value);
      field.row.setAttribute("aria-checked", value ? "true" : "false");
    } else if (item.kind === "slider") {
      field.input.value = String(value);
      field.readout.textContent = (item.format || String)(value);
    } else if (item.kind === "select") {
      field.input.value = String(value);
    }
  }

  function set(id, value) {
    const item = findItem(id);
    if (item) {
      if (item.kind === "toggle") value = !!value;
      if (item.kind === "slider" || item.kind === "select") value = Number(value);
    } else if (id === "oceanMap") {
      value = !!value;
    } else {
      return;
    }
    if (values[id] === value) {
      render(id);
      return;
    }
    values[id] = value;
    render(id);
    if (id === "oceanMap") syncNav();
  }

  function inCell() {
    return entered && !values.oceanMap;
  }

  function rowHidden(item) {
    if (item.mapOnly && !values.oceanMap) return true;
    if (item.cellOnly && !inCell()) return true;
    if ((item.id === "camera" || item.id === "nextTarget") && !cameraLive) return true;
    return false;
  }

  function syncFields() {
    for (const section of MENU) {
      let any = false;
      for (const item of section.items) {
        const field = fields.get(item.id);
        if (!field) continue;
        const hide = rowHidden(item);
        field.row.hidden = hide;
        if (!hide) any = true;
      }
      const block = sections.get(section.id);
      if (block) block.hidden = !any;
    }
  }

  function syncNav() {
    const mapOn = !!values.oceanMap;
    const cell = inCell();
    if ((mapOn || !cell) && CELL_DOCKS.has(dock)) {
      if (dock === "subject") emit("dismissSubject", true);
      dock = null;
    }
    if (cell && (dock === "filter" || dock === "demos")) dock = null;
    if (btnMap) {
      btnMap.classList.toggle("on", mapOn);
      btnMap.setAttribute("aria-pressed", mapOn ? "true" : "false");
    }
    if (btnCells) {
      btnCells.hidden = cell;
      btnCells.classList.toggle("on", !cell && dock === "demos");
      btnCells.setAttribute("aria-expanded", !cell && dock === "demos" ? "true" : "false");
    }
    if (btnFilter) {
      const filterOn = !cell && (dock === "filter" || filterView.hasSelection());
      btnFilter.hidden = cell;
      btnFilter.classList.toggle("on", filterOn);
      btnFilter.setAttribute("aria-expanded", !cell && dock === "filter" ? "true" : "false");
    }
    if (btnStation) {
      btnStation.hidden = !cell;
      btnStation.classList.toggle("on", cell && dock === "station");
      btnStation.setAttribute("aria-expanded", cell && dock === "station" ? "true" : "false");
    }
    if (btnNotes) {
      btnNotes.hidden = !cell;
      btnNotes.classList.toggle("on", cell && dock === "census");
      btnNotes.setAttribute("aria-expanded", cell && dock === "census" ? "true" : "false");
    }
    if (btnAbout) {
      btnAbout.classList.toggle("on", dock === "about");
      btnAbout.setAttribute("aria-expanded", dock === "about" ? "true" : "false");
    }
    if (btnMenu) {
      btnMenu.classList.toggle("on", dock === "menu");
      btnMenu.setAttribute("aria-expanded", dock === "menu" ? "true" : "false");
    }
    if (stationPanel) stationPanel.hidden = dock !== "station";
    if (demosPanel) demosPanel.hidden = dock !== "demos";
    if (filterPanel) filterPanel.hidden = dock !== "filter";
    if (censusPanel) censusPanel.hidden = dock !== "census";
    if (subjectPanel) subjectPanel.hidden = dock !== "subject";
    if (about) about.hidden = dock !== "about";
    if (menu) menu.hidden = dock !== "menu";
    notes.classList.toggle("is-collapsed", !dock);
    notes.classList.toggle("is-wide", dock === "about" || dock === "menu" || dock === "demos" || dock === "station" || dock === "filter");
    if (columnRoot) columnRoot.hidden = !cell;
    document.body.classList.toggle("has-column", cell);
    syncFields();
  }

  function setDock(next) {
    let id = next || null;
    if (CELL_DOCKS.has(id) && !inCell()) id = null;
    if (dock === id) {
      syncNav();
      return;
    }
    const prev = dock;
    dock = id;
    if (prev === "subject" && dock !== "subject") emit("dismissSubject", true);
    if (dock && document.pointerLockElement) document.exitPointerLock();
    tip.hidden = true;
    syncNav();
  }

  function toggleDock(id) {
    setDock(dock === id ? null : id);
  }

  function setOpen(next) {
    setDock(next ? "menu" : dock === "menu" ? null : dock);
  }

  function setCameraLive(on) {
    cameraLive = !!on;
    syncFields();
  }

  function bindField(item, field) {
    const id = item.id;
    if (item.kind === "toggle") {
      field.row.addEventListener("click", () => {
        const next = !values[id];
        set(id, next);
        emit(id, next);
      });
    } else if (item.kind === "slider") {
      field.input.addEventListener("input", () => {
        const next = Number(field.input.value);
        set(id, next);
        emit(id, next);
      });
    } else if (item.kind === "select") {
      field.input.addEventListener("change", () => {
        const next = Number(field.input.value);
        set(id, next);
        emit(id, next);
      });
    } else if (item.kind === "action") {
      field.row.addEventListener("click", () => emit(id, true));
    }
  }

  function addSection(id, title) {
    if (MENU.some((s) => s.id === id)) return;
    const spec = { id, title, items: [] };
    MENU.push(spec);
    const block = el("section", { class: "menu-section", "data-section": id }, [
      el("h3", { text: title }),
    ]);
    sections.set(id, block);
    body.insertBefore(block, help);
  }

  function addItem(sectionId, item) {
    let spec = MENU.find((s) => s.id === sectionId);
    if (!spec) {
      addSection(sectionId, item.sectionTitle || sectionId);
      spec = MENU.find((s) => s.id === sectionId);
    }
    spec.items.push(item);
    values[item.id] = defaultValue(item);
    const field = buildItem(item, values);
    fields.set(item.id, field);
    bindField(item, field);
    body.querySelector(`[data-section="${sectionId}"]`).append(field.row);
    render(item.id);
    syncFields();
  }

  const demosView = bindDemos(demosBody, (id, payload) => emit(id, payload));
  filterView = bindFilter(filterBody, (kind, payload) => {
    if (kind === "state") emit("mapFilter", payload);
    syncNav();
  });

  btnMenu.addEventListener("click", () => toggleDock("menu"));
  btnAbout?.addEventListener("click", () => toggleDock("about"));
  btnNotes.addEventListener("click", () => toggleDock("census"));
  btnStation?.addEventListener("click", () => toggleDock("station"));
  btnMap?.addEventListener("click", () => {
    const next = !values.oceanMap;
    set("oceanMap", next);
    emit("oceanMap", next);
  });
  btnCells?.addEventListener("click", () => toggleDock("demos"));
  btnFilter?.addEventListener("click", () => {
    const next = dock !== "filter";
    if (next && !values.oceanMap) {
      set("oceanMap", true);
      emit("oceanMap", true);
    }
    setDock(next ? "filter" : null);
  });
  btnFollow.addEventListener("click", () => emit("followSubject", true));
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!dock) return;
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (t.closest(".nav-bar")) return;
      if (t.closest("#hud-notes")) return;
      if (t.closest(".hud-tip")) return;
      if (dock === "filter" && t.closest("#ocean-map")) return;
      setDock(null);
    },
    true
  );
  setCameraLive(false);
  syncNav();

  window.addEventListener("keydown", (e) => {
    if (e.code === "Tab" || e.code === "KeyM") {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")) {
        if (e.code === "KeyM") return;
      }
      e.preventDefault();
      toggleDock("menu");
      return;
    }
    if (e.code === "Escape" && dock) {
      e.preventDefault();
      e.stopImmediatePropagation();
      setDock(null);
      return;
    }
    if (e.repeat) return;
    if (e.code === "KeyO") {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")) return;
      e.preventDefault();
      const next = !values.oceanMap;
      set("oceanMap", next);
      emit("oceanMap", next);
      return;
    }
    if (e.code === "KeyI") {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")) return;
      if (!inCell()) return;
      e.preventDefault();
      toggleDock("census");
      return;
    }
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")) return;
    if (e.code === "BracketLeft" || e.code === "BracketRight") {
      const lampItem = findItem("lamp");
      const powerItem = findItem("lampPower");
      if (!lampItem || !powerItem || rowHidden(lampItem)) return;
      e.preventDefault();
      const step = Number(powerItem.step ?? 0.05) * (e.shiftKey ? 4 : 1);
      const dir = e.code === "BracketRight" ? 1 : -1;
      const next = Math.min(
        powerItem.max,
        Math.max(powerItem.min, Number(values.lampPower ?? powerItem.value) + dir * step)
      );
      set("lampPower", next);
      emit("lampPower", next);
      if (!values.lamp && dir > 0) {
        set("lamp", true);
        emit("lamp", true);
      } else if (values.lamp && dir < 0 && next <= powerItem.min + 1e-6) {
        set("lamp", false);
        emit("lamp", false);
      }
      return;
    }
    for (const section of MENU) {
      for (const item of section.items) {
        if (!item.key || e.code !== `Key${item.key}`) continue;
        if (rowHidden(item)) continue;
        if (item.kind === "toggle") {
          const next = !values[item.id];
          set(item.id, next);
          emit(item.id, next);
        } else if (item.kind === "action") {
          emit(item.id, true);
        } else if (item.kind === "select") {
          const n = item.options.length;
          const next = (Number(values[item.id]) + 1) % n;
          set(item.id, next);
          emit(item.id, next);
        }
      }
    }
  });

  let frames = 0;
  let acc = 0;
  let fpsVal = 60;

  return {
    values,
    isOpen: () => dock === "menu",
    setOpen,
    set,
    addItem,
    addSection,
    get: (id) => values[id],
    on(id, fn) {
      handlers.set(id, fn);
    },
    setCamera(name) {
      const i = CAMERA_MODES.indexOf(name);
      if (i >= 0) set("camera", i);
    },
    setControl(on) {
      set("pilot", on);
    },
    setHint(text) {
      hint.textContent = text;
    },
    setDemoState(state) {
      demosView.setState(state);
    },
    showFilterNotes(id) {
      filterView.showNotes?.(id);
      if (id && !values.oceanMap) {
        set("oceanMap", true);
        emit("oceanMap", true);
      }
      if (dock !== "filter") setDock("filter");
    },
    setCameraLive,
    setEntered(on) {
      entered = !!on;
      syncNav();
    },
    setSelectOptions(id, options, value) {
      const item = findItem(id);
      const field = fields.get(id);
      if (!item || !field || item.kind !== "select" || !field.input) return;
      item.options = options.slice();
      field.input.replaceChildren();
      options.forEach((name, i) => {
        field.input.append(el("option", { value: String(i), text: name }));
      });
      const next = Math.max(0, Math.min(options.length - 1, Number(value ?? values[id] ?? 0)));
      values[id] = next;
      render(id);
    },
    tick(dt, view = {}) {
      frames++;
      acc += dt;
      if (acc >= 0.4) {
        fpsVal = Math.round(frames / acc);
        frames = 0;
        acc = 0;
      }
      censusRows.set(view.census || []);
      stationView.set(
        view.station
          ? { ...view.station, fps: fpsVal }
          : null
      );
      columnView.set(inCell() ? view.column : null);
      const lampHud = document.getElementById("lamp-hud");
      if (lampHud) {
        const lamp = view.lamp;
        const show = !!(lamp && inCell());
        lampHud.hidden = !show;
        if (show) {
          lampHud.textContent = `Lamp  ${Math.round(lamp.angle)}° · ${Number(lamp.power).toFixed(2)}`;
        }
      }
      if (brandPlace) {
        brandPlace.textContent = values.oceanMap ? "World ocean" : view.placeName || brandPlace.textContent;
      }
      const subject = view.subject;
      if (subject) {
        subjectKind.textContent = subject.kindLabel || "Subject";
        subjectTitle.textContent = subject.title || "";
        subjectTitle.hidden = !subject.title;
        const sub = subject.subtitle || "";
        subjectSub.textContent = sub;
        subjectSub.hidden = !sub;
        noteRows.set(subject.notes || []);
        subjectRows.set(subject.stats || []);
        btnFollow.textContent = subject.following ? "Unfollow" : "Follow";
      }
      if (subject?.picked && dock !== "subject") setDock("subject");
      else if (dock === "subject" && !subject) setDock(null);
      if (view.day) {
        if (values.liveClock) set("hour", Number(view.day.hour.toFixed(2)));
        else render("hour");
      }
    },
  };
}

function bindColumn(root, onJump) {
  if (!root) return { set() {} };
  const track = root.querySelector("#hud-column-track");
  const you = root.querySelector("#hud-column-you");
  const depthRead = root.querySelector("#hud-column-depth");
  const floorRead = root.querySelector("#hud-column-floor");
  const hover = root.querySelector("#hud-column-hover");
  const hoverRead = hover?.querySelector("span");
  const zoneBtns = new Map();
  let zoneKey = "";

  function frac(y, surface, floor) {
    const span = surface - floor;
    if (!(span > 0.5)) return 0;
    const t = Math.min(1, Math.max(0, (surface - y) / span));
    return Math.sqrt(t);
  }

  function yAt(clientY, surface, floor) {
    const r = track.getBoundingClientRect();
    const u = r.height ? Math.min(1, Math.max(0, (clientY - r.top) / r.height)) : 0;
    return surface - u * u * (surface - floor);
  }

  function showHover(clientY) {
    if (!hover || !track) return;
    const surface = Number(track.dataset.surface || 0);
    const floor = Number(track.dataset.floor || -100);
    const y = yAt(clientY, surface, floor);
    const t = frac(y, surface, floor);
    hover.hidden = false;
    hover.style.top = `${t * 100}%`;
    if (hoverRead) hoverRead.textContent = `${Math.max(0, -y).toFixed(0)} m`;
  }

  track?.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".column-zone")) return;
    const surface = Number(track.dataset.surface || 0);
    const floor = Number(track.dataset.floor || -100);
    onJump(yAt(e.clientY, surface, floor));
  });
  track?.addEventListener("pointermove", (e) => {
    if (e.target.closest(".column-zone")) {
      if (hover) hover.hidden = true;
      return;
    }
    showHover(e.clientY);
  });
  track?.addEventListener("pointerleave", () => {
    if (hover) hover.hidden = true;
  });

  return {
    set(col) {
      if (!col || !track) return;
      const surface = Number(col.surfaceY ?? 0);
      const floor = Number(col.floorY ?? -100);
      track.dataset.surface = String(surface);
      track.dataset.floor = String(floor);
      if (floorRead) floorRead.textContent = `${Math.abs(Math.min(0, floor)).toFixed(0)} m`;
      const zones = col.zones || [];
      const nextKey = zones.map((z) => `${z.id}:${z.y.toFixed(1)}`).join("|");
      if (nextKey !== zoneKey) {
        for (const btn of zoneBtns.values()) btn.remove();
        zoneBtns.clear();
        let lastT = -1;
        for (const z of zones) {
          const t = frac(z.y, surface, floor);
          if (t - lastT < 0.035 && lastT >= 0) continue;
          lastT = t;
          const metres = `${Math.abs(z.y).toFixed(0)} m`;
          const btn = el(
            "button",
            {
              type: "button",
              class: "column-zone",
              "data-id": z.id,
              title: `${z.label} · ${metres}. Click to go there. If this column is shallower, the camera walks into deeper water.`,
            },
            [el("span", { text: z.label }), el("em", { text: metres })]
          );
          btn.style.top = `${t * 100}%`;
          btn.addEventListener("pointerdown", (e) => e.stopPropagation());
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            onJump(z.y);
          });
          track.append(btn);
          zoneBtns.set(z.id, btn);
        }
        zoneKey = nextKey;
      }
      const t = frac(col.camY ?? 0, surface, floor);
      if (you) you.style.top = `${t * 100}%`;
      if (depthRead) depthRead.textContent = `${Math.max(0, -(col.camY ?? 0)).toFixed(0)} m`;
    },
  };
}

function bindStation(root) {
  if (!root) {
    return { set() {} };
  }
  const kicker = el("p", { class: "about-kicker station-kicker" });
  const title = el("p", { class: "about-title" });
  const meta = el("p", { class: "station-meta" });
  const lead = el("p");
  const nowHead = el("h3", { text: "Now" });
  const nowList = el("ul", { class: "station-now" });
  const colHead = el("h3", { text: "Column" });
  const col = el("dl", { class: "about-glossary station-column" });
  const missWrap = el("div", { class: "station-missing" });
  const attr = el("p", { class: "about-attr" });
  root.replaceChildren(kicker, title, meta, lead, nowHead, nowList, colHead, col, missWrap, attr);

  const colRows = new Map();
  let nowKey = "";
  let missKey = "";

  function setColumn(rows) {
    const seen = new Set();
    for (const item of rows || []) {
      if (!item?.id) continue;
      seen.add(item.id);
      let row = colRows.get(item.id);
      if (!row) {
        const dt = el("dt");
        const dd = el("dd");
        const node = el("div", {}, [dt, dd]);
        row = { node, dt, dd };
        colRows.set(item.id, row);
        col.append(node);
      }
      if (row.dt.textContent !== item.label) row.dt.textContent = item.label;
      const next = item.value == null ? "—" : String(item.value);
      if (row.dd.textContent !== next) row.dd.textContent = next;
    }
    for (const [id, row] of colRows) {
      if (seen.has(id)) continue;
      row.node.remove();
      colRows.delete(id);
    }
  }

  return {
    set(brief) {
      if (!brief) return;
      if (kicker.textContent !== brief.kicker) kicker.textContent = brief.kicker || "";
      if (title.textContent !== brief.title) title.textContent = brief.title || "";
      if (meta.textContent !== brief.meta) meta.textContent = brief.meta || "";
      if (lead.textContent !== brief.lead) lead.textContent = brief.lead || "";
      lead.hidden = !brief.lead;
      const lines = brief.now || [];
      const nextNow = lines.join("\n");
      if (nextNow !== nowKey) {
        nowKey = nextNow;
        nowList.replaceChildren(...lines.map((line) => el("li", { text: line })));
      }
      setColumn(brief.column || []);
      const missing = brief.missing || [];
      const nextMiss = missing.join("\n");
      if (nextMiss !== missKey) {
        missKey = nextMiss;
        if (!missing.length) missWrap.replaceChildren();
        else {
          missWrap.replaceChildren(
            el("p", { class: "about-label", text: "Not in the model" }),
            ...missing.map((line) => el("p", { text: line }))
          );
        }
      }
      const nextAttr = brief.fps != null
        ? `${brief.attr} · ${brief.fps} fps`
        : brief.attr || "";
      if (attr.textContent !== nextAttr) attr.textContent = nextAttr;
    },
  };
}

function bindCensus(root, onPick) {
  if (!root) {
    return { set() {} };
  }
  const rows = new Map();
  const heads = new Map();
  let layoutKey = "";
  return {
    set(list) {
      const items = (list || []).filter((item) => item?.id);
      const nextKey = items.map((item) => `${item.guild || ""}:${item.id}`).join("|");
      const rebuild = nextKey !== layoutKey;
      const seen = new Set();
      const seenGuild = new Set();
      let lastGuild = "";
      for (const item of items) {
        if (item.guild && item.guild !== lastGuild) {
          lastGuild = item.guild;
          seenGuild.add(lastGuild);
          let head = heads.get(lastGuild);
          if (!head) {
            head = el("h4", { class: "census-guild", text: lastGuild });
            heads.set(lastGuild, head);
          }
          if (rebuild) root.append(head);
        }
        seen.add(item.id);
        let row = rows.get(item.id);
        if (!row) {
          const id = item.id;
          const name = el("span", { class: "census-name" });
          const count = el("strong", { class: "census-count" });
          const btn = el("button", {
            type: "button",
            class: "census-row",
            "data-id": id,
          }, [name, count]);
          btn.addEventListener("pointerdown", (e) => e.stopPropagation());
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            onPick(id);
          });
          row = { btn, name, count };
          rows.set(id, row);
        }
        if (row.name.textContent !== item.common) row.name.textContent = item.common;
        const next = item.count == null ? "—" : Number(item.count).toLocaleString();
        if (row.count.textContent !== next) row.count.textContent = next;
        row.btn.disabled = !item.count;
        row.btn.title = item.latin ? `${item.latin} · click to look` : "Click to look";
        if (rebuild) root.append(row.btn);
      }
      if (rebuild) {
        for (const [id, row] of rows) {
          if (seen.has(id)) continue;
          row.btn.remove();
          rows.delete(id);
        }
        for (const [guild, head] of heads) {
          if (seenGuild.has(guild)) continue;
          head.remove();
          heads.delete(guild);
        }
        layoutKey = nextKey;
      }
    },
  };
}

function bindNotes(root) {
  const rows = new Map();
  return {
    set(list) {
      const seen = new Set();
      for (const item of list) {
        if (!item?.id) continue;
        seen.add(item.id);
        let row = rows.get(item.id);
        if (!row) {
          const label = el("h4");
          const text = el("p");
          const node = el("div", { class: "hud-note", "data-note": item.id }, [label, text]);
          row = { node, label, text };
          rows.set(item.id, row);
        }
        if (row.label.textContent !== item.label) row.label.textContent = item.label;
        const next = item.text == null ? "" : String(item.text);
        if (row.text.textContent !== next) row.text.textContent = next;
        root.append(row.node);
      }
      for (const [id, row] of rows) {
        if (seen.has(id)) continue;
        row.node.remove();
        rows.delete(id);
      }
    },
  };
}

function bindStats(root, tip, onPick) {
  const rows = new Map();
  let orderKey = "";
  function hideTip() {
    if (tip) tip.hidden = true;
  }
  function showTip(node) {
    const text = node.dataset.hint;
    if (!tip || !text) return hideTip();
    tip.textContent = text;
    tip.hidden = false;
    const r = node.getBoundingClientRect();
    const width = Math.min(240, Math.max(160, r.left - 24));
    tip.style.width = `${width}px`;
    let left = r.left - width - 10;
    if (left < 12) left = Math.min(window.innerWidth - width - 12, r.right + 10);
    let top = r.top;
    const h = tip.offsetHeight || 48;
    if (top + h > window.innerHeight - 12) top = Math.max(12, r.bottom - h);
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }
  function syncLinks(row, item) {
    const links = item.links || [];
    const key = links.map((l) => `${l.id || ""}:${l.label}`).join("|");
    if (key === row.linkKey) return;
    row.linkKey = key;
    row.links.replaceChildren();
    if (!links.length) {
      row.links.hidden = true;
      return;
    }
    row.links.hidden = false;
    for (const link of links) {
      if (link.id && onPick) {
        const btn = el("button", {
          type: "button",
          class: "diet-link",
          "data-id": link.id,
          text: link.label,
          title: `Look at ${link.label}`,
        });
        let handled = false;
        btn.addEventListener("pointerdown", (e) => {
          e.stopPropagation();
          handled = false;
        });
        btn.addEventListener("pointerup", (e) => {
          e.preventDefault();
          e.stopPropagation();
          handled = true;
          onPick(link.id);
        });
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (handled) return;
          onPick(link.id);
        });
        row.links.append(btn);
      } else {
        row.links.append(el("span", { class: "diet-field", text: link.label }));
      }
    }
  }
  return {
    set(list) {
      const seen = new Set();
      for (const item of list) {
        if (!item?.id) continue;
        seen.add(item.id);
        let row = rows.get(item.id);
        if (!row) {
          const label = el("span");
          const value = el("strong");
          const links = el("div", { class: "stat-links" });
          const detail = el("p", { class: "stat-detail" });
          const fill = el("i");
          const meter = el("div", { class: "stat-meter", "aria-hidden": "true" }, [fill]);
          links.hidden = true;
          meter.hidden = true;
          detail.hidden = true;
          const node = el("div", { class: "stat", "data-stat": item.id }, [
            label,
            value,
            links,
            meter,
            detail,
          ]);
          node.addEventListener("pointerenter", () => showTip(node));
          node.addEventListener("pointerleave", hideTip);
          node.addEventListener("focus", () => showTip(node));
          node.addEventListener("blur", hideTip);
          row = { node, label, value, links, detail, meter, fill, linkKey: null };
          rows.set(item.id, row);
          root.append(node);
        }
        if (row.label.textContent !== item.label) row.label.textContent = item.label;
        const next = item.value == null ? "—" : String(item.value);
        const hasLinks = !!(item.links && item.links.length);
        row.node.classList.toggle("stat-wide", !!item.wide);
        syncLinks(row, item);
        row.value.hidden = hasLinks;
        if (!hasLinks && row.value.textContent !== next) row.value.textContent = next;
        if (item.meter != null) {
          row.meter.hidden = false;
          row.fill.style.width = `${Math.round(Math.min(1, Math.max(0, item.meter)) * 100)}%`;
        } else {
          row.meter.hidden = true;
        }
        if (item.detail) {
          row.detail.hidden = false;
          if (row.detail.textContent !== item.detail) row.detail.textContent = item.detail;
        } else {
          row.detail.hidden = true;
        }
        const hintable = item.hint && !hasLinks;
        if (hintable) {
          row.node.dataset.hint = item.hint;
          row.node.setAttribute("tabindex", "0");
          row.node.setAttribute("aria-label", `${item.label}: ${next}. ${item.hint}`);
        } else {
          delete row.node.dataset.hint;
          row.node.removeAttribute("tabindex");
          row.node.removeAttribute("aria-label");
        }
      }
      const nextOrder = (list || []).filter((item) => item?.id).map((item) => item.id).join("|");
      if (nextOrder !== orderKey) {
        for (const item of list || []) {
          const row = item?.id ? rows.get(item.id) : null;
          if (row) root.append(row.node);
        }
        orderKey = nextOrder;
      }
      for (const [id, row] of rows) {
        if (seen.has(id)) continue;
        row.node.remove();
        rows.delete(id);
      }
    },
  };
}

function findItem(id) {
  for (const section of MENU) {
    for (const item of section.items) if (item.id === id) return item;
  }
  return null;
}

function hintNode(item) {
  return item.hint ? el("span", { class: "menu-hint", text: item.hint }) : null;
}

function buildItem(item, values) {
  if (item.kind === "toggle") {
    const row = el("button", {
      type: "button",
      class: "switch",
      role: "switch",
      "aria-checked": "false",
      id: `opt-${item.id}`,
    }, [
      el("span", { class: "switch-copy" }, [
        el("span", { class: "switch-label", text: item.label }),
        hintNode(item),
      ]),
      item.key ? el("kbd", { text: item.key }) : null,
      el("span", { class: "switch-track", "aria-hidden": "true" }),
    ]);
    return { row };
  }

  if (item.kind === "slider") {
    const readout = el("b", { text: (item.format || String)(values[item.id]) });
    const input = el("input", {
      type: "range",
      min: String(item.min),
      max: String(item.max),
      step: String(item.step ?? 1),
      value: String(values[item.id]),
      id: `opt-${item.id}`,
    });
    const row = el("label", { class: "menu-slider" }, [
      el("span", { class: "menu-slider-label" }, [
        el("span", { text: item.label }),
        readout,
      ]),
      hintNode(item),
      input,
    ]);
    return { row, input, readout };
  }

  if (item.kind === "select") {
    const input = el("select", { id: `opt-${item.id}` });
    item.options.forEach((name, i) => {
      const opt = el("option", { value: String(i), text: name });
      if (i === values[item.id]) opt.selected = true;
      input.append(opt);
    });
    const row = el("label", { class: "menu-select" }, [
      el("span", {}, [
        el("span", { text: item.label }),
        item.key ? el("kbd", { text: item.key }) : null,
      ]),
      hintNode(item),
      input,
    ]);
    return { row, input };
  }

  const row = el("button", {
    type: "button",
    class: "menu-action",
    id: `opt-${item.id}`,
  }, [
    el("span", { class: "switch-copy" }, [
      el("span", { text: item.label }),
      hintNode(item),
    ]),
    item.key ? el("kbd", { text: item.key }) : null,
  ]);
  return { row };
}

function taxonName(id) {
  return FAUNA[id]?.common || SPECIES[id]?.label || id;
}

function taxonGroup(id) {
  const agent = SPECIES[id]?.agent;
  if (agent === "school") return "School";
  if (agent === "vehicle") return "Vehicles";
  return "Field";
}

/** Overlay list bins — biological guild, not school vs vehicle. */
const OVERLAY_GROUP_ORDER = [
  "Forage",
  "Squid",
  "Demersal",
  "Sharks",
  "Pelagic predators",
  "Marine mammals",
];

function overlayGroup(id) {
  const spec = SPECIES[id];
  if (!spec) return "Other";
  const guild = spec.guild;
  const mesh = spec.vehicle?.mesh;
  const named = `${FAUNA[id]?.common || ""} ${FAUNA[id]?.guild || ""}`;
  if (guild === "mysticete" || guild === "odontocete") return "Marine mammals";
  if (
    guild === "filter-feeder" ||
    mesh === "shark" ||
    mesh === "hammerhead" ||
    mesh === "whaleshark" ||
    /shark/i.test(named)
  ) {
    return "Sharks";
  }
  if (guild === "cephalopod" || guild === "cephalopod-predator") return "Squid";
  if (guild === "demersal" || guild === "slope-predator") return "Demersal";
  if (guild === "pelagic-predator") return "Pelagic predators";
  if (guild === "forage" || guild === "surface") return "Forage";
  return "Other";
}

function overlayBuckets() {
  const buckets = new Map(OVERLAY_GROUP_ORDER.map((title) => [title, []]));
  for (const id of [...SCHOOL_IDS, ...VEHICLE_IDS]) {
    const title = overlayGroup(id);
    if (!buckets.has(title)) buckets.set(title, []);
    buckets.get(title).push(id);
  }
  return buckets;
}

function bindFilter(root, emit) {
  if (!root) {
    return { hasSelection() { return false; }, showNotes() {}, trophic: () => false };
  }
  const selected = new Set();
  let trophic = false;
  let focusId = null;
  let query = "";
  const lead = el("p", {
    text: "Geographic habitat on this day of year: Wikipedia raster where we have one, otherwise a hull envelope clipped to kilometres from shore, then season, SST, ice, upwell, and floor. Occupancy scales how many animals the cell holds — it does not empty a range the species still lives in. Spawn mode adds the trophic gate the cell uses. Several taxa overlay at once.",
  });
  const search = el("input", {
    type: "search",
    class: "filter-search",
    placeholder: "Search taxa",
    autocomplete: "off",
  });
  const actions = el("div", { class: "filter-actions" });
  const mode = el("button", { type: "button", class: "filter-clear", text: "Range" });
  const solo = el("button", { type: "button", class: "filter-clear", text: "Solo" });
  const clear = el("button", { type: "button", class: "filter-clear", text: "Clear" });
  actions.append(mode, solo, clear);
  const list = el("div", { class: "filter-list" });
  const rows = new Map();
  const groups = [];

  function paint() {
    const q = query.trim().toLowerCase();
    for (const [id, row] of rows) {
      const on = selected.has(id);
      row.classList.toggle("on", on);
      row.classList.toggle("focus", id === focusId);
      row.setAttribute("aria-pressed", on ? "true" : "false");
      const name = taxonName(id).toLowerCase();
      const latin = (FAUNA[id]?.latin || "").toLowerCase();
      row.hidden = !!(q && !name.includes(q) && !latin.includes(q));
    }
    for (const group of groups) {
      group.kicker.hidden = !group.ids.some((id) => !rows.get(id)?.hidden);
    }
    mode.textContent = trophic ? "Spawn" : "Range";
    mode.title = trophic
      ? "Showing cells that would spawn (trophic gate on)"
      : "Showing geographic range (Wikipedia-style)";
    emit("state", { ids: [...selected], trophic });
  }

  function addGroup(title, ids) {
    if (!ids.length) return;
    const kicker = el("p", { class: "filter-kicker", text: title });
    list.append(kicker);
    const sorted = ids.slice().sort((a, b) => taxonName(a).localeCompare(taxonName(b)));
    for (const id of sorted) {
      const tint = habitatTint(id);
      const swatch = el("i", { class: "filter-swatch" });
      swatch.style.background = `hsl(${tint.h} ${tint.s}% ${tint.l}%)`;
      const row = el("button", {
        type: "button",
        class: "filter-row",
        "aria-pressed": "false",
      }, [
        swatch,
        el("span", { text: taxonName(id) }),
      ]);
      row.addEventListener("click", () => {
        if (selected.has(id)) {
          selected.delete(id);
          if (focusId === id) focusId = null;
        } else {
          selected.add(id);
          focusId = id;
        }
        paint();
      });
      rows.set(id, row);
      list.append(row);
    }
    groups.push({ kicker, ids: sorted });
  }

  for (const [title, ids] of overlayBuckets()) addGroup(title, ids);
  search.addEventListener("input", () => {
    query = search.value;
    paint();
  });
  search.addEventListener("search", () => {
    query = search.value;
    paint();
  });
  mode.addEventListener("click", () => {
    trophic = !trophic;
    paint();
  });
  solo.addEventListener("click", () => {
    const keep = focusId && selected.has(focusId)
      ? focusId
      : selected.size
        ? [...selected][selected.size - 1]
        : null;
    selected.clear();
    if (keep) {
      selected.add(keep);
      focusId = keep;
    }
    paint();
  });
  clear.addEventListener("click", () => {
    selected.clear();
    focusId = null;
    paint();
  });
  root.replaceChildren(lead, search, actions, list);
  return {
    hasSelection() {
      return selected.size > 0;
    },
    trophic: () => trophic,
    showNotes(id) {
      if (!id || !rows.has(id)) return;
      selected.add(id);
      focusId = id;
      paint();
    },
  };
}

function bindDemos(root, emit) {
  if (!root) {
    return { setState() {} };
  }
  let selected = "catalog";
  let toggles = defaultToggles(demoById(selected));
  let activeId = null;
  let loading = false;
  let status = "";

  const lead = el("p", {
    text: "Named kilometres. Map is still free roam. Coupled tiles load a real place. Polar ice is a field. Gap tiles still open the pelagic water at that site — they do not invent coral or a vent.",
  });
  const grid = el("div", { class: "demo-grid" });
  const detail = el("div", { class: "demo-detail" });
  const scroll = el("div", { class: "demo-scroll" }, [lead, grid, detail]);
  const actions = el("div", { class: "demo-actions" });
  root.replaceChildren(scroll, actions);

  const cards = new Map();
  for (const demo of DEMO_CELLS) {
    const card = el("button", {
      type: "button",
      class: `demo-card is-${demo.status}`,
      "data-demo": demo.id,
    }, [
      el("span", { class: "demo-kicker", text: demo.kicker }),
      el("span", { class: "demo-title", text: demo.title }),
      el("span", { class: "demo-region", text: demo.region }),
    ]);
    card.addEventListener("click", () => select(demo.id));
    cards.set(demo.id, card);
    grid.append(card);
  }

  function select(id, keepToggles = false) {
    const demo = demoById(id);
    if (!demo) return;
    selected = id;
    if (!keepToggles) toggles = defaultToggles(demo);
    render();
  }

  function presence() {
    return presenceFromToggles(demoById(selected), toggles);
  }

  function setTaxon(id, on) {
    toggles = { ...toggles, [id]: !!on };
    render();
    if (activeId === selected && !loading) emit("demoFauna", { id: selected, presence: presence() });
  }

  function enter() {
    if (loading) return;
    emit("demo", { id: selected, presence: presence() });
  }

  function render() {
    const demo = demoById(selected);
    for (const [id, card] of cards) {
      card.classList.toggle("on", id === selected);
      card.classList.toggle("is-active", id === activeId);
    }
    if (!demo) {
      detail.replaceChildren();
      actions.replaceChildren();
      return;
    }
    const live = activeId === demo.id;
    const observe = el("ul", { class: "demo-observe" });
    for (const line of demo.observe || []) observe.append(el("li", { text: line }));
    const missing = (demo.missing || []).length
      ? el("div", { class: "demo-missing" }, [
          el("p", { class: "about-label", text: "Not in the model" }),
          ...demo.missing.map((line) => el("p", { text: line })),
        ])
      : null;
    const groups = new Map();
    for (const id of sandboxIds(demo)) {
      const g = taxonGroup(id);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(id);
    }
    const fauna = el("div", { class: "demo-fauna" });
    fauna.append(
      el("p", { class: "about-label", text: live ? "Fauna in this cell" : "Fauna (sandbox)" })
    );
    for (const [group, ids] of groups) {
      fauna.append(el("p", { class: "demo-fauna-group", text: group }));
      const row = el("div", { class: "demo-taxa" });
      for (const id of ids) {
        const on = !!toggles[id];
        const chip = el("button", {
          type: "button",
          class: `demo-taxon${on ? " on" : ""}`,
          "aria-pressed": on ? "true" : "false",
          title: on ? `Remove ${taxonName(id)}` : `Add ${taxonName(id)}`,
        }, [el("span", { text: taxonName(id) })]);
        chip.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          setTaxon(id, !on);
        });
        row.append(chip);
      }
      fauna.append(row);
    }
    const enterBtn = el("button", {
      type: "button",
      class: "demo-enter",
      disabled: loading ? "" : false,
      text: loading ? "Loading…" : live ? "Reload this cell" : "Enter this cell",
    });
    const resetBtn = el("button", {
      type: "button",
      class: "demo-reset",
      text: "Reset fauna",
    });
    enterBtn.addEventListener("click", enter);
    resetBtn.addEventListener("click", () => {
      toggles = defaultToggles(demo);
      render();
      if (activeId === selected && !loading) emit("demoFauna", { id: selected, presence: presence() });
    });
    actions.replaceChildren(enterBtn, resetBtn);
    const note = status
      ? el("p", { class: "demo-status", text: status })
      : live
        ? el("p", { class: "demo-status", text: "This cell is open. Toggle a name to add or remove it." })
        : null;
    detail.replaceChildren(
      ...[
        el("p", { class: "demo-detail-title", text: demo.title }),
        el("p", { text: demo.about }),
        el("p", { class: "about-label", text: "Observe" }),
        observe,
        missing,
        fauna,
        note,
      ].filter(Boolean)
    );
  }

  render();
  return {
    setState(next = {}) {
      if (next.activeId !== undefined) {
        activeId = next.activeId;
        if (activeId && activeId !== selected) select(activeId, false);
      }
      if (next.loading !== undefined) loading = !!next.loading;
      if (next.status !== undefined) status = next.status || "";
      render();
    },
  };
}
