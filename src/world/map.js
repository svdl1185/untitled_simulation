import { formatLatLon } from "./patch.js";
import { gebcoMapUrl, fetchCurrentField } from "./atlas.js";
import { presenceAt, presentLabel } from "./ranges.js";
import { topoPolygons } from "./topo.js";

const INK = "#e7f4f2";
const LAND = "#050608";
const COAST = "rgba(236, 244, 242, 0.92)";
const WATER = "#07090c";
const SOUTH = -85;
const NORTH = 85;

export function createOceanMap({ onEnter, onLab }) {
  const root = document.createElement("div");
  root.id = "ocean-map";
  root.hidden = true;
  root.innerHTML = `
    <canvas id="ocean-map-canvas"></canvas>
    <div class="ocean-map-chrome">
      <div class="ocean-map-top">
        <p class="ocean-map-kicker">untitled_ocean_simulation</p>
        <p class="ocean-map-title">World ocean</p>
        <p class="ocean-map-lead">A nested ocean model. Click a kilometre of water to look through the camera. The lab is a 10 km tank with every implemented animal — beach, stepped shelves, a canyon, a seamount, 2000 m of water.</p>
        <p class="ocean-map-readout" id="ocean-map-readout">Hover water for coordinates and fauna in range</p>
      </div>
      <div class="ocean-map-bottom">
        <p class="ocean-map-status" id="ocean-map-status"></p>
        <button type="button" id="ocean-map-lab">Catalog tank</button>
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
  const status = root.querySelector("#ocean-map-status");
  const btnLab = root.querySelector("#ocean-map-lab");
  const ctx = canvas.getContext("2d", { alpha: false });
  const sheet = document.createElement("canvas");
  const sheetCtx = sheet.getContext("2d", { alpha: false, willReadFrequently: true });
  const restyle = document.createElement("canvas");
  const restyleCtx = restyle.getContext("2d", { willReadFrequently: true });

  let open = false;
  let currents = false;
  let land = null;
  let bathy = null;
  let arrows = [];
  let hover = null;
  let loading = false;
  let here = { lat: 56, lon: 3.2 };
  let dirty = true;

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

  function setHover(geo, landHit) {
    if (!geo || landHit) {
      hover = null;
      canvas.style.cursor = "default";
      readout.textContent = landHit
        ? "Land · pick water"
        : "Hover water for coordinates and fauna in range";
      draw();
      return;
    }
    hover = geo;
    canvas.style.cursor = "crosshair";
    const fauna = presenceAt(geo.lat, geo.lon);
    const who = presentLabel(fauna, 4);
    readout.textContent = `${formatLatLon(geo.lat, geo.lon)} · ${who}`;
    draw();
  }

  canvas.addEventListener("pointermove", (e) => {
    const rect = root.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    setHover(xyToLonLat(px, py), sampleLand(px, py));
  });
  canvas.addEventListener("pointerleave", () => setHover(null, false));
  btnLab?.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (loading || !onLab) return;
    loading = true;
    status.textContent = "Building 10 km catalog tank…";
    draw();
    try {
      await onLab();
      setOpen(false);
      status.textContent = "";
    } catch (err) {
      status.textContent = err?.message || "Could not open the lab.";
    } finally {
      loading = false;
      draw();
    }
  });
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
  };
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
