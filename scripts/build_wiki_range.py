#!/usr/bin/env python3
"""Rasterize Wikipedia / IUCN / Cypron world range maps onto 360×170 occupancy.

Catalog grain must match the map. Add a row to wiki_ranges.json, run this script.
Outputs src/world/wikiRangeData.js (2-bit packed rasters).
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import struct
import sys
import urllib.error
import urllib.parse
import urllib.request
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = Path(__file__).with_name("wiki_ranges.json")
CACHE = Path(__file__).with_name(".cache") / "wiki-range"
OUT = ROOT / "src" / "world" / "wikiRangeData.js"
GREATWHITE = ROOT / "src" / "world" / "greatwhiteIucn.js"

COLS, ROWS = 360, 170
SOUTH, NORTH = -85.0, 85.0
UA = {"User-Agent": "untitled-ocean-sim/0.1 (wiki range raster)"}

# Robinson interpolation table (Wikipedia / Snyder).
ROBINSON = [
    (0, 1.0000, 0.0000),
    (5, 0.9986, 0.0620),
    (10, 0.9954, 0.1240),
    (15, 0.9900, 0.1860),
    (20, 0.9822, 0.2480),
    (25, 0.9730, 0.3100),
    (30, 0.9600, 0.3720),
    (35, 0.9427, 0.4340),
    (40, 0.9216, 0.4958),
    (45, 0.8962, 0.5571),
    (50, 0.8679, 0.6176),
    (55, 0.8350, 0.6769),
    (60, 0.7986, 0.7346),
    (65, 0.7597, 0.7903),
    (70, 0.7186, 0.8435),
    (75, 0.6732, 0.8936),
    (80, 0.6213, 0.9394),
    (85, 0.5722, 0.9761),
    (90, 0.5322, 1.0000),
]


def robinson_XY(lat_deg: float) -> tuple[float, float]:
    a = min(90.0, abs(lat_deg))
    i = min(17, int(a // 5))
    t = (a - i * 5) / 5.0
    _lat0, x0, y0 = ROBINSON[i]
    _lat1, x1, y1 = ROBINSON[i + 1]
    return x0 + t * (x1 - x0), y0 + t * (y1 - y0)


def paeth(a: int, b: int, c: int) -> int:
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


def read_png(path: Path):
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{path} is not a PNG")
    pos = 8
    idat = b""
    w = h = bit = ctype = inter = None
    while pos < len(data):
        ln = struct.unpack(">I", data[pos : pos + 4])[0]
        tag = data[pos + 4 : pos + 8]
        body = data[pos + 8 : pos + 8 + ln]
        pos += 12 + ln
        if tag == b"IHDR":
            w, h, bit, ctype, _comp, _filt, inter = struct.unpack(">IIBBBBB", body)
        elif tag == b"IDAT":
            idat += body
        elif tag == b"IEND":
            break
    if bit != 8 or inter != 0 or ctype not in (2, 6):
        raise ValueError(f"{path}: need 8-bit RGB/RGBA non-interlaced, got {bit}/{ctype}/{inter}")
    raw = zlib.decompress(idat)
    bpp = 3 if ctype == 2 else 4
    stride = w * bpp
    rows = []
    i = 0
    prev = bytearray(stride)
    for _y in range(h):
        filt = raw[i]
        i += 1
        row = bytearray(raw[i : i + stride])
        i += stride
        if filt == 1:
            for x in range(stride):
                a = row[x - bpp] if x >= bpp else 0
                row[x] = (row[x] + a) & 255
        elif filt == 2:
            for x in range(stride):
                row[x] = (row[x] + prev[x]) & 255
        elif filt == 3:
            for x in range(stride):
                a = row[x - bpp] if x >= bpp else 0
                row[x] = (row[x] + ((a + prev[x]) // 2)) & 255
        elif filt == 4:
            for x in range(stride):
                a = row[x - bpp] if x >= bpp else 0
                b = prev[x]
                c = prev[x - bpp] if x >= bpp else 0
                row[x] = (row[x] + paeth(a, b, c)) & 255
        elif filt != 0:
            raise ValueError(f"unknown PNG filter {filt}")
        rows.append(row)
        prev = row
    return w, h, bpp, rows


def pixel(rows, bpp, x, y):
    if x < 0 or y < 0 or y >= len(rows):
        return 0, 0, 0, 0
    row = rows[y]
    w = len(row) // bpp
    if x >= w:
        return 0, 0, 0, 0
    i = x * bpp
    if bpp == 4:
        return row[i], row[i + 1], row[i + 2], row[i + 3]
    return row[i], row[i + 1], row[i + 2], 255


def classify(r, g, b, a) -> int:
    """0 empty, 2 extant. IUCN yellow would be 1; these Cypron thumbs are one range colour."""
    if a < 40:
        return 0
    mx, mn = max(r, g, b), min(r, g, b)
    chroma = mx - mn
    lum = (r + g + b) / 3.0
    if lum < 18:
        return 0
    # cream / gray land
    if chroma < 42 and 70 < lum < 245:
        return 0
    # near-white ocean (or white-with-alpha)
    if lum > 238:
        return 0
    # pale ocean (common-dolphin light-blue sea)
    if lum > 198 and chroma < 55:
        return 0
    if lum > 210 and b > r - 10 and chroma < 80:
        return 0
    # remaining saturated cool / teal / yellow range fill
    if chroma < 35:
        return 0
    return 2


def in_map(r, g, b, a) -> bool:
    if a < 40:
        return False
    lum = (r + g + b) / 3.0
    return lum > 12


def map_frame(w, h, bpp, rows):
    """Robinson oval: equator width is ±180°, central meridian is ±90°."""
    inrow = []
    for y in range(h):
        xs = [x for x in range(0, w, 2) if in_map(*pixel(rows, bpp, x, y))]
        if xs:
            inrow.append((y, xs[0], xs[-1]))
    if not inrow:
        return 0, 0, w - 1, h - 1
    # row where the painted oval is widest ≈ equator
    y_eq, left, right = max(inrow, key=lambda t: t[2] - t[1])
    cx = 0.5 * (left + right)
    # central-meridian column: top/bottom of the oval
    col = int(cx)
    ys = [y for y in range(h) if in_map(*pixel(rows, bpp, col, y))]
    if not ys:
        top, bottom = inrow[0][0], inrow[-1][0]
    else:
        top, bottom = ys[0], ys[-1]
    return left, top, right, bottom


def robinson_pixel(lat, lon, left, top, right, bottom, central=11.0):
    X, Y = robinson_XY(lat)
    x_max = 0.8487 * math.pi
    y_max = 1.3523
    x = 0.8487 * math.radians(lon - central) * X
    y = 1.3523 * Y * (1.0 if lat >= 0 else -1.0)
    cx = 0.5 * (left + right)
    cy = 0.5 * (top + bottom)
    half_w = 0.5 * (right - left)
    half_h = 0.5 * (bottom - top)
    px = cx + (x / x_max) * half_w
    py = cy - (y / y_max) * half_h
    return px, py


def equirect_pixel(lat, lon, left, top, right, bottom, south=-90.0, north=90.0):
    px = left + ((lon + 180.0) / 360.0) * (right - left)
    py = top + ((north - lat) / (north - south)) * (bottom - top)
    return px, py


def sample_code(rows, bpp, px, py) -> int:
    x0, y0 = int(math.floor(px)), int(math.floor(py))
    best = 0
    for dy in range(-1, 2):
        for dx in range(-1, 2):
            r, g, b, a = pixel(rows, bpp, x0 + dx, y0 + dy)
            c = classify(r, g, b, a)
            if c > best:
                best = c
                if best >= 2:
                    return best
    return best


def rasterize(path: Path, projection: str, central: float = 11.0) -> bytes:
    w, h, bpp, rows = read_png(path)
    left, top, right, bottom = map_frame(w, h, bpp, rows)
    codes = bytearray(COLS * ROWS)
    offsets = (-0.35, 0.0, 0.35)
    for j in range(ROWS):
        lat0 = NORTH - ((j + 0.5) / ROWS) * (NORTH - SOUTH)
        for i in range(COLS):
            lon0 = -180.0 + ((i + 0.5) / COLS) * 360.0
            best = 0
            for dlat in offsets:
                lat = lat0 + dlat
                for dlon in offsets:
                    lon = lon0 + dlon
                    if projection == "robinson":
                        px, py = robinson_pixel(lat, lon, left, top, right, bottom, central)
                    else:
                        px, py = equirect_pixel(lat, lon, left, top, right, bottom)
                    c = sample_code(rows, bpp, px, py)
                    if c > best:
                        best = c
                        if best >= 2:
                            break
                if best >= 2:
                    break
            codes[j * COLS + i] = best
    return pack(codes)


def pack(codes: bytearray) -> str:
    n = (len(codes) + 3) // 4
    buf = bytearray(n)
    for k, c in enumerate(codes):
        buf[k >> 2] |= (c & 3) << ((k & 3) << 1)
    import base64

    return base64.b64encode(buf).decode("ascii")


def orig_url(name: str) -> str:
    h = hashlib.md5(name.encode()).hexdigest()
    return f"https://upload.wikimedia.org/wikipedia/commons/{h[0]}/{h[:2]}/{urllib.parse.quote(name)}"


def thumb_php(name: str, width: int = 2000) -> str:
    return "https://commons.wikimedia.org/w/thumb.php?" + urllib.parse.urlencode({"f": name, "w": str(width)})


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def ensure_png(spec: dict) -> Path:
    name = spec["file"]
    local_name = Path(name).stem + ".png"
    CACHE.mkdir(parents=True, exist_ok=True)
    dest = CACHE / local_name
    tmp = Path("/tmp/wiki-range") / local_name
    if dest.exists() and dest.stat().st_size > 5000:
        return dest
    if tmp.exists() and tmp.stat().st_size > 5000:
        dest.write_bytes(tmp.read_bytes())
        return dest
    print(f"  download {name}")
    data = None
    if name.lower().endswith(".svg"):
        try:
            data = fetch(thumb_php(name, 2000))
        except urllib.error.HTTPError as e:
            print(f"  thumb.php {e.code}, trying original")
    if data is None:
        data = fetch(orig_url(name))
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{name}: expected PNG, got {data[:20]!r}")
    dest.write_bytes(data)
    return dest


def reuse_greatwhite_packed() -> str:
    text = GREATWHITE.read_text()
    m = re.search(r'const PACKED = "([^"]+)"', text)
    if not m:
        raise ValueError("could not read greatwhite packed raster")
    return m.group(1)


def js_string(s: str) -> str:
    return json.dumps(s, ensure_ascii=True)


def main() -> int:
    man = json.loads(MANIFEST.read_text())
    meta_js = []
    packed_js = []
    for spec in man["maps"]:
        sid = spec["id"]
        print(f"== {sid}")
        meta = {
            "mode": spec["mode"],
            "skipHabitat": bool(spec.get("skipHabitat")),
            "source": spec.get("source", ""),
            "file": spec.get("file") or "",
        }
        if spec.get("occupancy") is not None:
            meta["occupancy"] = spec["occupancy"]
        if spec.get("coastKm") is not None:
            meta["coastKm"] = spec["coastKm"]
        if spec.get("reusePacked"):
            packed = reuse_greatwhite_packed()
            print(f"  reused packed raster ({len(packed)} chars)")
        else:
            path = ensure_png(spec)
            packed = rasterize(
                path,
                spec.get("projection", "robinson"),
                spec.get("centralMeridian", 11.0),
            )
            print(f"  raster {path.name} → {len(packed)} chars")
        meta_js.append(f"  {sid}: {json.dumps(meta)}")
        packed_js.append(f"  {sid}: {js_string(packed)}")

    skip_lines = ",\n".join(
        f"  {json.dumps(row['id'])}: {json.dumps(row['reason'])}" for row in man.get("skip", [])
    )
    body = (
        "/** Generated by scripts/build_wiki_range.py — do not edit. */\n"
        "export const WIKI_META = {\n"
        + ",\n".join(meta_js)
        + "\n};\n\n"
        + "export const WIKI_SKIP = {\n"
        + skip_lines
        + "\n};\n\n"
        + "export const WIKI_PACKED = {\n"
        + ",\n".join(packed_js)
        + "\n};\n"
    )
    OUT.write_text(body)
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
