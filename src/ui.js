import { CONFIG } from "./config.js";

/**
 * Add a control: push an item into MENU, then hud.on(id, handler) in main.js.
 * Or at runtime: hud.addSection(...) / hud.addItem(...).
 * Toggles default to off unless `value` is true. Sliders/selects keep the value you set here.
 */
export const CAMERA_MODES = [
  "Cinematic",
  "Follow shark",
  "Orbit",
  "Surface",
  "Free roam",
];

export const MENU = [
  {
    id: "sim",
    title: "Simulation",
    items: [
      {
        id: "liveClock",
        kind: "toggle",
        label: "Live clock",
        hint: "Advance time of day",
        key: "L",
        value: true,
      },
      {
        id: "hour",
        kind: "slider",
        label: "Time",
        min: 0,
        max: 24,
        step: 0.05,
        value: 10.4,
        format: formatClock,
      },
      {
        id: "fish",
        kind: "slider",
        label: "Fish cap",
        min: 2000,
        max: CONFIG.maxFish,
        step: 500,
        value: CONFIG.initialFish,
        format: (n) => Number(n).toLocaleString(),
      },
      {
        id: "sharks",
        kind: "slider",
        label: "Shark cap",
        min: 0,
        max: CONFIG.shark.max,
        step: 1,
        value: CONFIG.shark.count,
      },
      { id: "reset", kind: "action", label: "Reset school", key: "R" },
    ],
  },
  {
    id: "world",
    title: "World",
    items: [
      { id: "storm", kind: "toggle", label: "Storm", key: "T" },
    ],
  },
  {
    id: "view",
    title: "View",
    items: [
      { id: "fear", kind: "toggle", label: "Fear radius", key: "F" },
      {
        id: "camera",
        kind: "select",
        label: "Camera",
        options: CAMERA_MODES,
        value: 0,
        key: "C",
      },
      { id: "nextTarget", kind: "action", label: "Next target", key: "N" },
      { id: "pilot", kind: "toggle", label: "Pilot shark", key: "P" },
    ],
  },
];

const KEY_HELP = [
  ["M / Tab", "Open or close this menu"],
  ["Click", "Inspect a shark, herring, or school"],
  ["Drag", "Orbit the view"],
  ["Scroll", "Zoom in and out"],
  ["Right-drag", "Pan · Shift-drag also pans"],
  ["N", "Next shark or school"],
  ["V", "Free roam (WASD fly, drag to look)"],
  ["WASD", "Move · E/Q rise/dive · Shift boost · Space lunge"],
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
  const backdrop = document.getElementById("menu-backdrop");
  const btnMenu = document.getElementById("btn-menu");
  const btnClose = document.getElementById("btn-menu-close");
  const hint = document.getElementById("pilot-hint");
  const generalBody = document.getElementById("hud-general-body");
  const subjectPanel = document.getElementById("hud-subject");
  const subjectKind = document.getElementById("hud-subject-kind");
  const subjectTitle = document.getElementById("hud-subject-title");
  const subjectSub = document.getElementById("hud-subject-sub");
  const subjectBody = document.getElementById("hud-subject-body");
  const subjectNotes = document.getElementById("hud-subject-notes");
  const btnFollow = document.getElementById("hud-follow");
  const generalRows = bindStats(generalBody);
  const subjectRows = bindStats(subjectBody);
  const noteRows = bindNotes(subjectNotes);

  const fields = new Map();
  const handlers = new Map();
  const values = {};
  let open = false;
  body.replaceChildren();

  for (const section of MENU) {
    const block = el("section", { class: "menu-section", "data-section": section.id }, [
      el("h3", { text: section.title }),
    ]);
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
    el("h3", { text: "Controls" }),
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
    if (!item) return;
    if (item.kind === "toggle") value = !!value;
    if (item.kind === "slider" || item.kind === "select") value = Number(value);
    if (values[id] === value) {
      render(id);
      return;
    }
    values[id] = value;
    render(id);
  }

  function setOpen(next) {
    open = !!next;
    menu.hidden = !open;
    backdrop.hidden = !open;
    btnMenu.classList.toggle("on", open);
    btnMenu.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.classList.toggle("menu-open", open);
    if (open && document.pointerLockElement) document.exitPointerLock();
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
  }

  btnMenu.addEventListener("click", () => setOpen(!open));
  btnClose.addEventListener("click", () => setOpen(false));
  backdrop.addEventListener("click", () => setOpen(false));
  btnFollow.addEventListener("click", () => emit("followSubject", true));

  window.addEventListener("keydown", (e) => {
    if (e.code === "Tab" || e.code === "KeyM") {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")) {
        if (e.code === "KeyM") return;
      }
      e.preventDefault();
      setOpen(!open);
      return;
    }
    if (e.code === "Escape" && open) {
      e.preventDefault();
      e.stopImmediatePropagation();
      setOpen(false);
      return;
    }
    if (e.repeat) return;
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")) return;
    for (const section of MENU) {
      for (const item of section.items) {
        if (!item.key || e.code !== `Key${item.key}`) continue;
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
      }));
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
        subjectRows.set(subject.stats || []);
        noteRows.set(subject.notes || []);
        const following = !!subject.following;
        btnFollow.disabled = following;
        btnFollow.textContent = following ? "Following" : "Follow";
        btnFollow.hidden = subject.followable === false;
      }
      if (view.day) {
        if (values.liveClock) set("hour", Number(view.day.hour.toFixed(2)));
        else render("hour");
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

function bindStats(root) {
  const rows = new Map();
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
          row = { node, label, value };
          rows.set(item.id, row);
        }
        if (row.label.textContent !== item.label) row.label.textContent = item.label;
        const next = item.value == null ? "—" : String(item.value);
        if (row.value.textContent !== next) row.value.textContent = next;
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

function findItem(id) {
  for (const section of MENU) {
    for (const item of section.items) if (item.id === id) return item;
  }
  return null;
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
        item.hint ? el("span", { class: "switch-hint", text: item.hint }) : null,
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
      input,
    ]);
    return { row, input };
  }

  const row = el("button", {
    type: "button",
    class: "menu-action",
    id: `opt-${item.id}`,
  }, [
    el("span", { text: item.label }),
    item.key ? el("kbd", { text: item.key }) : null,
  ]);
  return { row };
}
