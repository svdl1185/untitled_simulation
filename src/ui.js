import { CONFIG } from "./config.js";
import { CAMERA_MODES } from "./camera.js";

/**
 * Add a parameter: push an item into MENU, then hud.on(id, handler) in main.js.
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
        hint: "Advance local solar time. One on-screen day is 8 minutes.",
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
    ],
  },
  {
    id: "life",
    title: "Life",
    items: [
      {
        id: "fish",
        kind: "slider",
        label: "School cap",
        hint: "Forage-fish ceiling in this cell. The bloom still caps how many it can carry.",
        min: 2000,
        max: CONFIG.maxFish,
        step: 500,
        value: CONFIG.initialFish,
        format: (n) => Number(n).toLocaleString(),
        cellOnly: true,
      },
      {
        id: "sharks",
        kind: "slider",
        label: "Blue sharks",
        hint: "Headcount for blue sharks only. Other predators follow range and catalog counts.",
        min: 0,
        max: CONFIG.shark.max,
        step: 1,
        value: CONFIG.shark.count,
        cellOnly: true,
      },
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
    title: "View",
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
        hint: "Camera fill light after dark. Optics, not habitat.",
        key: "K",
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
  ["M / Tab", "Open or close parameters"],
  ["O", "World map (home)"],
  ["I", "Census, when a cell is open"],
  ["Click census", "Jump to that animal"],
  ["Click column", "Jump to that depth; walks offshore if the floor here is too shallow"],
  ["Click water", "Enter a 1 km cell"],
  ["Click animal", "Field notes on that individual"],
  ["Drag", "Look around · orbit when following"],
  ["Scroll", "Zoom or dolly"],
  ["Right-drag", "Pan · Shift-drag also pans"],
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
  const backdrop = document.getElementById("menu-backdrop");
  const btnMenu = document.getElementById("btn-menu");
  const btnAbout = document.getElementById("btn-about");
  const btnMap = document.getElementById("btn-map");
  const btnLab = document.getElementById("btn-lab");
  const btnCell = document.getElementById("btn-cell");
  const hint = document.getElementById("pilot-hint");
  const notes = document.getElementById("hud-notes");
  const btnNotes = document.getElementById("btn-notes");
  const generalPanel = document.getElementById("hud-cell");
  const censusPanel = document.getElementById("hud-census");
  const columnRoot = document.getElementById("hud-column");
  const generalBody = document.getElementById("hud-general-body");
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
  const generalRows = bindStats(generalBody, tip);
  const censusRows = bindCensus(censusBody, (id) => {
    const fn = handlers.get("focusSpecies");
    if (fn) fn(id);
  });
  const columnView = bindColumn(columnRoot, (y) => emit("jumpY", y));
  const subjectRows = bindStats(subjectBody, tip, (id) => {
    const fn = handlers.get("focusSpecies");
    if (fn) fn(id);
  });
  const noteRows = bindNotes(subjectNotes);

  let dock = null;
  let cameraLive = false;
  let entered = false;
  const CELL_DOCKS = new Set(["census", "cell", "subject"]);
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
  for (const [key, text] of KEY_HELP) {
    help.append(
      el("p", { class: "menu-help-row" }, [
        el("kbd", { text: key }),
        el("span", { text }),
      ])
    );
  }
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
    if (btnMap) {
      btnMap.classList.toggle("on", mapOn);
      btnMap.setAttribute("aria-pressed", mapOn ? "true" : "false");
    }
    if (btnLab) {
      btnLab.classList.toggle("on", false);
      btnLab.disabled = false;
    }
    if (btnCell) {
      btnCell.hidden = !cell;
      btnCell.classList.toggle("on", cell && dock === "cell");
      btnCell.setAttribute("aria-expanded", cell && dock === "cell" ? "true" : "false");
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
    if (generalPanel) generalPanel.hidden = dock !== "cell";
    if (censusPanel) censusPanel.hidden = dock !== "census";
    if (subjectPanel) subjectPanel.hidden = dock !== "subject";
    if (about) about.hidden = dock !== "about";
    if (menu) menu.hidden = dock !== "menu";
    notes.classList.toggle("is-collapsed", !dock);
    notes.classList.toggle("is-about", dock === "about");
    if (columnRoot) columnRoot.hidden = !cell;
    document.body.classList.toggle("has-column", cell);
    if (backdrop) backdrop.hidden = true;
    document.body.classList.remove("menu-open");
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

  btnMenu.addEventListener("click", () => toggleDock("menu"));
  btnAbout?.addEventListener("click", () => toggleDock("about"));
  btnNotes.addEventListener("click", () => toggleDock("census"));
  btnCell?.addEventListener("click", () => toggleDock("cell"));
  btnMap?.addEventListener("click", () => {
    const next = !values.oceanMap;
    set("oceanMap", next);
    emit("oceanMap", next);
  });
  btnLab?.addEventListener("click", () => emit("lab", true));
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
    setCameraLive,
    setEntered(on) {
      entered = !!on;
      if (entered && !values.oceanMap && !CELL_DOCKS.has(dock)) setDock("census");
      else syncNav();
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
      generalRows.set((view.general || []).concat({
        id: "fps",
        label: "FPS",
        value: String(fpsVal),
        hint: "Frames drawn per second. A drop here is the near-camera agent load, not the basin.",
      }));
      censusRows.set(view.census || []);
      columnView.set(inCell() ? view.column : null);
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
