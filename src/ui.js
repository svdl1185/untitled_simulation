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
        hint: "Raises current speed and upwelling.",
        key: "T",
        cellOnly: true,
      },
      {
        id: "turbidity",
        kind: "slider",
        label: "Turbidity",
        hint: "Optical extinction. Higher is murkier and a shallower photic zone.",
        min: 0.35,
        max: 1.4,
        step: 0.05,
        value: CONFIG.water.turbidity,
        format: (n) => Number(n).toFixed(2),
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
        hint: "Jump the camera to a zone that exists in this cell.",
        options: ["Surface", "Epipelagic", "Seafloor"],
        value: 1,
        key: "G",
        cellOnly: true,
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
  ["Click water", "Enter a 1 km cell"],
  ["Click animal", "Field notes on that individual"],
  ["Drag", "Look around · orbit when following"],
  ["Scroll", "Zoom or dolly"],
  ["Right-drag", "Pan · Shift-drag also pans"],
  ["C", "Follow camera (after Follow)"],
  ["N", "Next followed animal"],
  ["V / Esc", "Free roam · Esc also closes map if a cell is open"],
  ["WASD", "Move · E/Q rise/dive · G depth zone · Shift boost · Space lunge"],
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
  const btnClose = document.getElementById("btn-menu-close");
  const btnAbout = document.getElementById("btn-about");
  const btnAboutClose = document.getElementById("btn-about-close");
  const btnMap = document.getElementById("btn-map");
  const btnLab = document.getElementById("btn-lab");
  const btnCell = document.getElementById("btn-cell");
  const hint = document.getElementById("pilot-hint");
  const notes = document.getElementById("hud-notes");
  const btnNotes = document.getElementById("btn-notes");
  const generalPanel = document.getElementById("hud-general");
  const censusPanel = document.getElementById("hud-census");
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
  const subjectRows = bindStats(subjectBody, tip);
  const noteRows = bindNotes(subjectNotes);

  let open = false;
  let aboutOpen = false;
  let cellOpen = true;
  let censusOpen = true;
  let cameraLive = false;
  let entered = false;
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
      btnCell.classList.toggle("on", cell && cellOpen);
      btnCell.setAttribute("aria-expanded", cell && cellOpen ? "true" : "false");
    }
    if (btnNotes) {
      btnNotes.hidden = !cell;
      btnNotes.classList.toggle("on", cell && censusOpen);
      btnNotes.setAttribute("aria-expanded", cell && censusOpen ? "true" : "false");
    }
    if (btnAbout) {
      btnAbout.classList.toggle("on", aboutOpen);
      btnAbout.setAttribute("aria-expanded", aboutOpen ? "true" : "false");
    }
    if (btnMenu) {
      btnMenu.classList.toggle("on", open);
      btnMenu.setAttribute("aria-expanded", open ? "true" : "false");
    }
    if (generalPanel) generalPanel.hidden = !cell || !cellOpen;
    if (censusPanel) censusPanel.hidden = !cell || !censusOpen;
    notes.classList.toggle("is-collapsed", !cell || (!cellOpen && !censusOpen));
    syncFields();
  }

  function setBackdrop() {
    tip.hidden = true;
    backdrop.hidden = !open && !aboutOpen;
    document.body.classList.toggle("menu-open", open || aboutOpen);
    if ((open || aboutOpen) && document.pointerLockElement) document.exitPointerLock();
  }

  function setOpen(next) {
    open = !!next;
    if (open) aboutOpen = false;
    menu.hidden = !open;
    if (about) about.hidden = !aboutOpen;
    setBackdrop();
    syncNav();
  }

  function setAboutOpen(next) {
    aboutOpen = !!next;
    if (aboutOpen) open = false;
    if (about) about.hidden = !aboutOpen;
    menu.hidden = !open;
    setBackdrop();
    syncNav();
  }

  function setCellOpen(next) {
    cellOpen = !!next;
    syncNav();
  }

  function setCensusOpen(next) {
    censusOpen = !!next;
    syncNav();
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

  btnMenu.addEventListener("click", () => setOpen(!open));
  btnClose.addEventListener("click", () => setOpen(false));
  btnAbout?.addEventListener("click", () => setAboutOpen(!aboutOpen));
  btnAboutClose?.addEventListener("click", () => setAboutOpen(false));
  backdrop.addEventListener("click", () => {
    setOpen(false);
    setAboutOpen(false);
  });
  btnNotes.addEventListener("click", () => setCensusOpen(!censusOpen));
  btnCell?.addEventListener("click", () => setCellOpen(!cellOpen));
  btnMap?.addEventListener("click", () => {
    const next = !values.oceanMap;
    set("oceanMap", next);
    emit("oceanMap", next);
  });
  btnLab?.addEventListener("click", () => emit("lab", true));
  btnFollow.addEventListener("click", () => emit("followSubject", true));
  setCameraLive(false);
  syncNav();

  window.addEventListener("keydown", (e) => {
    if (e.code === "Tab" || e.code === "KeyM") {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")) {
        if (e.code === "KeyM") return;
      }
      e.preventDefault();
      setOpen(!open);
      return;
    }
    if (e.code === "Escape" && (open || aboutOpen)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      setOpen(false);
      setAboutOpen(false);
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
      setCensusOpen(!censusOpen);
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
    isOpen: () => open,
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
      generalRows.set((view.general || []).concat({
        id: "fps",
        label: "FPS",
        value: String(fpsVal),
        hint: "Frames drawn per second. A drop here is the near-camera agent load, not the basin.",
      }));
      censusRows.set(view.census || []);
      if (brandPlace) {
        brandPlace.textContent = values.oceanMap ? "World ocean" : view.placeName || brandPlace.textContent;
      }
      const subject = view.subject;
      if (!subject) {
        subjectPanel.hidden = true;
      } else {
        subjectPanel.hidden = false;
        subjectKind.textContent = subject.kindLabel || "Subject";
        subjectTitle.textContent = subject.title || "";
        subjectTitle.hidden = !subject.title;
        const sub = subject.subtitle || "";
        subjectSub.textContent = sub;
        subjectSub.hidden = !sub;
        noteRows.set(subject.notes || []);
        subjectRows.set(subject.stats || []);
        const following = !!subject.following;
        btnFollow.textContent = following ? "Unfollow" : "Follow";
      }
      if (view.day) {
        if (values.liveClock) set("hour", Number(view.day.hour.toFixed(2)));
        else render("hour");
      }
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

function bindStats(root, tip) {
  const rows = new Map();
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
          const node = el("div", { class: "stat", "data-stat": item.id }, [label, value]);
          node.addEventListener("pointerenter", () => showTip(node));
          node.addEventListener("pointerleave", hideTip);
          node.addEventListener("focus", () => showTip(node));
          node.addEventListener("blur", hideTip);
          row = { node, label, value };
          rows.set(item.id, row);
          root.append(node);
        }
        if (row.label.textContent !== item.label) row.label.textContent = item.label;
        const next = item.value == null ? "—" : String(item.value);
        if (row.value.textContent !== next) row.value.textContent = next;
        if (item.hint) {
          row.node.dataset.hint = item.hint;
          row.node.setAttribute("tabindex", "0");
          row.node.setAttribute("aria-label", `${item.label}: ${next}. ${item.hint}`);
        } else {
          delete row.node.dataset.hint;
          row.node.removeAttribute("tabindex");
          row.node.removeAttribute("aria-label");
        }
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
