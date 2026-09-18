import { formatLatLon } from "./patch.js";
import { gebcoMapUrl, fetchCurrentField } from "./atlas.js";
import { presenceAt, presentNames, rasterHabitat, habitatTint } from "./ranges.js";
import { speciesLabel } from "./fauna.js";
import { topoPolygons } from "./topo.js";
import { CONFIG } from "../config.js";
import { formatDayOfYear } from "../simulation/day.js";

const INK = "#e7f4f2";
const LAND = "#050608";
const COAST = "rgba(236, 244, 242, 0.92)";
const WATER = "#07090c";
const SOUTH = -85;
const NORTH = 85;

export function createOceanMap({ onEnter }) {
  const root = document.createElement("div");
  root.id = "ocean-map";
  root.hidden = true;
  root.innerHTML = `
    <canvas id="ocean-map-canvas"></canvas>
    <div class="ocean-map-chrome">
      <div class="ocean-map-top">
        <p class="ocean-map-readout" id="ocean-map-readout">Hover water for coordinates and fauna in range</p>
        <p class="ocean-map-fauna" id="ocean-map-fauna"></p>
        <div class="ocean-map-swatches" id="ocean-map-swatches" hidden></div>
      </div>
      <div class="ocean-map-bottom">
        <p class="ocean-map-status" id="ocean-map-status"></p>
        <div class="ocean-map-legend" aria-hidden="true">
          <span>Shelf</span>
          <i></i><i></i><i></i><i></i>
          <span>Abyss</span>
        </div>
        <p class="ocean-map-attr">1 km cells · Esc returns to the last cell if you have entered one</p>
      </div>
    </div>
  `;
  document.body.append(root);
  const canvas = root.querySelector("#ocean-map-canvas");
  const readout = root.querySelector("#ocean-map-readout");
  const faunaList = root.querySelector("#ocean-map-fauna");
  const swatches = root.querySelector("#ocean-map-swatches");
  const status = root.querySelector("#ocean-map-status");
  const ctx = canvas.getContext("2d", { alpha: false });
  const sheet = document.createElement("canvas");
  const sheetCtx = sheet.getContext("2d", { alpha: false, willReadFrequently: true });
  const restyle = document.createElement("canvas");
  const restyleCtx = restyle.getContext("2d", { willReadFrequently: true });
  const overlay = document.createElement("canvas");
  const overlayCtx = overlay.getContext("2d", { willReadFrequently: true });

  let open = false;
  let currents = false;
  let land = null;
  let bathy = null;
  let bathyRaw = null;
  let arrows = [];
  let hover = null;
  let loading = false;
  let here = { lat: 56, lon: 3.2 };
  let dirty = true;
  let overlayIds = [];
  let overlayGrid = null;
  let overlayKey = "";

  function lonToX(L, w = canvas.width) {
    return ((wrapLon(L) + 180) / 360) * w;
  }
  function latToY(A, h = canvas.height) {
    return ((NORTH - A) / (NORTH - SOUTH)) * h;
  }
  function xyToLonLat(px, py) {
    const dpr = canvas.width / Math.max(1, root.clientWidth);
    const x = px * dpr;
    const y = py * dpr;
    const L = wrapLon(-180 + (x / canvas.width) * 360);
    const A = NORTH - (y / canvas.height) * (NORTH - SOUTH);
    return { lon: L, lat: clampLat(A) };
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.floor(root.clientWidth * dpr);
    const h = Math.floor(root.clientHeight * dpr);
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${root.clientWidth}px`;
    canvas.style.height = `${root.clientHeight}px`;
    canvas.style.cursor = "default";
    dirty = true;
    bake();
    draw();
  }

  async function loadLand() {
    if (land) return;
    const topo = await fetch("/world/land-50m.json").then((r) => r.json());
    land = topoPolygons(topo, "land");
    dirty = true;
  }

  async function loadBasemap() {
    if (bathy) return;
    const url = gebcoMapUrl(-180, SOUTH, 180, NORTH, 1600, 760);
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = url;
    });
    if (!open) return;
    const raw = document.createElement("canvas");
    raw.width = image.width;
    raw.height = image.height;
    const rawCtx = raw.getContext("2d", { willReadFrequently: true });
    rawCtx.drawImage(image, 0, 0);
    bathyRaw = rawCtx.getImageData(0, 0, raw.width, raw.height);
    bathy = restyleGebco(image, restyle, restyleCtx);
    dirty = true;
    bake();
    draw();
  }

  async function loadCurrents() {
    arrows = await fetchCurrentField(-180, SOUTH, 180, NORTH);
    dirty = true;
    bake();
    draw();
  }

  function drawLand(target, w, h, fill, stroke, width) {
    if (!land?.length) return;
    const jump = w * 0.45;
    target.lineJoin = "round";
    target.lineWidth = width;
    target.strokeStyle = stroke;
    target.fillStyle = fill;
    target.beginPath();
    for (const poly of land) {
      for (const ring of poly) {
        if (ring.length < 3) continue;
        let prevX = null;
        for (let i = 0; i < ring.length; i++) {
          const x = lonToX(ring[i][0], w);
          const y = latToY(ring[i][1], h);
          if (i === 0 || prevX == null || Math.abs(x - prevX) > jump) target.moveTo(x, y);
          else target.lineTo(x, y);
          prevX = x;
        }
        target.closePath();
      }
    }
    target.fill("evenodd");
    target.stroke();
  }

  function bake() {
    const w = canvas.width;
    const h = canvas.height;
    if (!w || !h) return;
    if (sheet.width !== w || sheet.height !== h) {
      sheet.width = w;
      sheet.height = h;
      dirty = true;
    }
    if (!dirty) return;
    dirty = false;
    const g = sheetCtx;
    g.fillStyle = WATER;
    g.fillRect(0, 0, w, h);
    if (bathy) g.drawImage(bathy, 0, 0, w, h);
    g.strokeStyle = "rgba(231, 244, 242, 0.07)";
    g.lineWidth = Math.max(1, w / 1800);
    g.beginPath();
    for (let a = -80; a <= 80; a += 20) {
      const y = latToY(a, h);
      g.moveTo(0, y);
      g.lineTo(w, y);
    }
    for (let L = -180; L <= 180; L += 30) {
      const x = lonToX(L, w);
      g.moveTo(x, 0);
      g.lineTo(x, h);
    }
    g.stroke();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    drawLand(g, w, h, LAND, COAST, 1.2 * dpr);
    if (currents && arrows.length) {
      g.strokeStyle = "rgba(231, 244, 242, 0.5)";
      g.fillStyle = "rgba(231, 244, 242, 0.5)";
      g.lineWidth = Math.max(1, w / 1100);
      let max = 0.05;
      for (const a of arrows) max = Math.max(max, Math.hypot(a.u, a.v));
      const scale = Math.min(w, h) * 0.012 / max;
      for (const a of arrows) {
        const x = lonToX(a.lon, w);
        const y = latToY(a.lat, h);
        const dx = a.u * scale;
        const dy = -a.v * scale;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + dx, y + dy);
        g.stroke();
      }
    }
    const hx = lonToX(here.lon, w);
    const hy = latToY(here.lat, h);
    g.fillStyle = INK;
    g.beginPath();
    g.arc(hx, hy, 4 * dpr, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = dpr;
    g.beginPath();
    g.arc(hx, hy, 9 * dpr, 0, Math.PI * 2);
    g.stroke();
  }

  function draw() {
    bake();
    ctx.drawImage(sheet, 0, 0);
    if (overlayIds.length) {
      paintOverlay(ensureOverlay());
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      drawLand(ctx, canvas.width, canvas.height, LAND, COAST, 1.2 * dpr);
    }
    if (hover) {
      const x = lonToX(hover.lon);
      const y = latToY(hover.lat);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      ctx.strokeStyle = INK;
      ctx.lineWidth = dpr;
      ctx.beginPath();
      ctx.moveTo(x - 10 * dpr, y);
      ctx.lineTo(x + 10 * dpr, y);
      ctx.moveTo(x, y - 10 * dpr);
      ctx.lineTo(x, y + 10 * dpr);
      ctx.stroke();
    }
    if (loading) {
      ctx.fillStyle = "rgba(5, 6, 8, 0.45)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function overlayCacheKey() {
    return [
      CONFIG.time?.dayIndex ?? 180,
      CONFIG.water?.sstAnomaly ?? 0,
      CONFIG.water?.iceAnomaly ?? 0,
      bathyRaw ? 1 : 0,
    ].join("|");
  }

  function ensureOverlay() {
    if (!overlayIds.length) return null;
    const key = overlayCacheKey();
    if (overlayGrid && overlayKey === key) return overlayGrid;
    overlayKey = key;
    overlayGrid = rasterHabitat({
      cols: 160,
      rows: 76,
      dayOfYear: CONFIG.time?.dayIndex ?? 180,
      floorAt: bathyRaw ? (lat, lon) => floorYAt(lat, lon) : undefined,
    });
    return overlayGrid;
  }

  function paintOverlay(pack) {
    if (!pack) return;
    const { cols, rows, grid } = pack;
    if (overlay.width !== cols || overlay.height !== rows) {
      overlay.width = cols;
      overlay.height = rows;
    }
    const img = overlayCtx.createImageData(cols, rows);
    const d = img.data;
    for (let k = 0; k < cols * rows; k++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (const id of overlayIds) {
        const w = grid[id]?.[k] ?? 0;
        if (w <= 0.05) continue;
        const tint = habitatTint(id);
        const rgb = hslToRgb(tint.h, tint.s, tint.l);
        const alpha = 0.48 * w;
        r += rgb[0] * alpha;
        g += rgb[1] * alpha;
        b += rgb[2] * alpha;
        a = Math.min(0.78, a + alpha);
      }
      if (a <= 0.02) continue;
      const i = k * 4;
      d[i] = Math.min(255, r / Math.max(a, 0.001));
      d[i + 1] = Math.min(255, g / Math.max(a, 0.001));
      d[i + 2] = Math.min(255, b / Math.max(a, 0.001));
      d[i + 3] = Math.min(255, a * 255);
    }
    overlayCtx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(overlay, 0, 0, canvas.width, canvas.height);
  }

  function renderSwatches() {
    if (!swatches) return;
    swatches.replaceChildren();
    if (!overlayIds.length) {
      swatches.hidden = true;
      return;
    }
    swatches.hidden = false;
    for (const id of overlayIds) {
      const tint = habitatTint(id);
      const chip = document.createElement("span");
      chip.className = "ocean-map-chip";
      chip.innerHTML = `<i style="background:hsl(${tint.h} ${tint.s}% ${tint.l}%)"></i>${speciesLabel(id)}`;
      swatches.append(chip);
    }
  }

  function setOverlay(ids) {
    overlayIds = (ids || []).filter(Boolean);
    renderSwatches();
    if (open) draw();
  }

  function sampleLand(px, py) {
    const w = sheet.width;
    const h = sheet.height;
    if (!w || !h) return false;
    const dpr = w / Math.max(1, root.clientWidth);
    const x = Math.max(0, Math.min(w - 1, (px * dpr) | 0));
    const y = Math.max(0, Math.min(h - 1, (py * dpr) | 0));
    const p = sheetCtx.getImageData(x, y, 1, 1).data;
    return p[0] <= 6 && p[1] <= 8 && p[2] <= 12;
  }

  function floorYAt(lat, lon) {
    if (!bathyRaw) return undefined;
    const x = ((wrapLon(lon) + 180) / 360) * bathyRaw.width;
    const y = ((NORTH - lat) / (NORTH - SOUTH)) * bathyRaw.height;
    const ix = Math.max(0, Math.min(bathyRaw.width - 1, x | 0));
    const iy = Math.max(0, Math.min(bathyRaw.height - 1, y | 0));
    const i = (iy * bathyRaw.width + ix) * 4;
    const p = bathyRaw.data;
    return floorYFromGebcoRgb(p[i], p[i + 1], p[i + 2]);
  }

  function faunaAt(lat, lon) {
    return presenceAt(lat, lon, {
      floorY: floorYAt(lat, lon),
      dayOfYear: CONFIG.time?.dayIndex ?? 180,
    });
  }

  function setHover(geo, landHit) {
    if (!geo || landHit) {
      hover = null;
      canvas.style.cursor = "default";
      readout.textContent = landHit
        ? "Land · pick water"
        : "Hover water for coordinates and fauna in range";
      faunaList.textContent = "";
      draw();
      return;
    }
    hover = geo;
    canvas.style.cursor = "crosshair";
    const fauna = faunaAt(geo.lat, geo.lon);
    const date = formatDayOfYear(CONFIG.time?.dayIndex ?? 180);
    readout.textContent = `${formatLatLon(geo.lat, geo.lon)} · ${date}`;
    if (overlayIds.length) {
      const hits = overlayIds
        .filter((id) => (fauna[id] ?? 0) > 0.05)
        .map((id) => `${speciesLabel(id)} ${(fauna[id] * 100) | 0}%`);
      faunaList.textContent = hits.length ? hits.join(" · ") : "none of the filtered taxa in this cell";
    } else {
      const who = presentNames(fauna);
      faunaList.textContent = who.length ? who.join(", ") : "no implemented fauna";
    }
    draw();
  }

  canvas.addEventListener("pointermove", (e) => {
    const rect = root.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    setHover(xyToLonLat(px, py), sampleLand(px, py));
  });
  canvas.addEventListener("pointerleave", () => setHover(null, false));
  canvas.addEventListener("click", async (e) => {
    if (loading) return;
    const rect = root.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    if (sampleLand(px, py)) {
      status.textContent = "That's land.";
      return;
    }
    const geo = xyToLonLat(px, py);
    loading = true;
    status.textContent = "Loading 1 km cell…";
    draw();
    try {
      await onEnter(geo.lat, geo.lon);
      setOpen(false);
      status.textContent = "";
    } catch (err) {
      status.textContent = err?.message || "Could not enter that cell.";
    } finally {
      loading = false;
      draw();
    }
  });

  function setOpen(next) {
    open = !!next;
    root.hidden = !open;
    document.body.classList.toggle("ocean-map-open", open);
    if (!open) return;
    const ready = land ? Promise.resolve() : loadLand();
    ready
      .then(() => {
        if (!open) return;
        dirty = true;
        resize();
        if (!bathy) {
          return loadBasemap().catch(() => {
            if (open) status.textContent = "Depth tiles failed to load.";
          });
        }
      })
      .catch(() => {
        status.textContent = "Coastline failed to load.";
      });
    if (bathy || land) {
      dirty = true;
      resize();
    }
  }

  function setCurrents(on) {
    currents = !!on;
    if (open && currents) loadCurrents();
    else {
      arrows = [];
      dirty = true;
      bake();
      draw();
    }
  }

  function focus(nextLat, nextLon) {
    here = { lat: clampLat(nextLat), lon: wrapLon(nextLon) };
    dirty = true;
    if (open) {
      bake();
      draw();
    }
  }

  window.addEventListener("resize", () => {
    if (open) resize();
  });

  return {
    isOpen: () => open,
    setOpen,
    setCurrents,
    focus,
    setStatus(text) {
      status.textContent = text || "";
    },
    refresh() {
      overlayGrid = null;
      overlayKey = "";
      if (open) draw();
      if (hover) setHover(hover, false);
    },
    setOverlay,
    overlayIds: () => overlayIds.slice(),
  };
}

function floorYFromGebcoRgb(r, g, b) {
  const t = (0.2 * r + 0.45 * g + 0.35 * b) / 255;
  if (t < 0.16) return -5500;
  if (t < 0.26) return -3500;
  if (t < 0.36) return -2000;
  if (t < 0.46) return -1000;
  if (t < 0.56) return -400;
  if (t < 0.66) return -150;
  if (t < 0.76) return -60;
  return -25;
}

function hslToRgb(h, s, l) {
  const sat = s / 100;
  const lit = l / 100;
  const a = sat * Math.min(lit, 1 - lit);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (lit - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

function restyleGebco(image, canvas, ctx) {
  canvas.width = image.width;
  canvas.height = image.height;
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const p = data.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i];
    const g = p[i + 1];
    const b = p[i + 2];
    const t = (0.2 * r + 0.45 * g + 0.35 * b) / 255;
    const v = 0.1 + t * 0.52;
    p[i] = v * 78;
    p[i + 1] = v * 96;
    p[i + 2] = v * 112;
    p[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

function wrapLon(lon) {
  let x = lon;
  while (x < -180) x += 360;
  while (x > 180) x -= 360;
  return x;
}

function clampLat(lat) {
  return Math.max(SOUTH, Math.min(NORTH, lat));
}
