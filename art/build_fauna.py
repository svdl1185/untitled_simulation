#!/usr/bin/env python3
"""Build authored glTFs for every vehicle and school guild.

Blender: +Y nose, +Z dorsal, origin at body centre.
Vehicles ~10 units long (y ≈ −5.2 … 5.2). School guilds ~1 unit (y ≈ −0.5 … 0.5).
School COLOR_0 encodes look remap: G=0 body (R=belly mix), 0.5 fin, 0.85 eye, 1 photophore.
"""
from __future__ import annotations

import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "models")
ART = os.path.join(ROOT, "art")
os.makedirs(OUT, exist_ok=True)
os.makedirs(ART, exist_ok=True)

TAU = math.tau
KEEP = {"Camera", "Light", "Sun"}


def smoothstep(a, b, x):
    if b == a:
        return 0.0 if x < a else 1.0
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3.0 - 2.0 * t)


def lerp3(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)


def rgba(rgb, a=1.0):
    return (float(rgb[0]), float(rgb[1]), float(rgb[2]), a)


# ---------------------------------------------------------------------------
# bmesh
# ---------------------------------------------------------------------------
def add_body(bm, stations, segs, belly=0.78, dorsal=1.05, shape=None, nose="fan"):
    rings = []
    for y, rx, rz in stations:
        ring = []
        for i in range(segs):
            a = (i / segs) * TAU
            x = math.cos(a) * rx
            z = math.sin(a) * rz
            if z < 0:
                z *= belly
            elif z > 0:
                z *= dorsal
            if shape:
                x, z = shape(y, a, x, z, rx, rz)
            ring.append(bm.verts.new((x, y, z)))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for j in range(segs):
            j2 = (j + 1) % segs
            bm.faces.new((rings[i][j], rings[i + 1][j], rings[i + 1][j2], rings[i][j2]))
    if len(rings[0]) >= 3:
        bm.faces.new(list(reversed(rings[0])))
    if nose == "point" and rings:
        tip_y = stations[-1][0] + max(0.02, stations[-1][1])
        tip = bm.verts.new((0.0, tip_y, -0.012))
        last = rings[-1]
        for j in range(segs):
            j2 = (j + 1) % segs
            bm.faces.new((last[j], last[j2], tip))
    elif len(rings[-1]) >= 3:
        bm.faces.new(rings[-1])
    return rings


def add_poly(bm, verts, thick=0.04):
    pts = [Vector(v) for v in verts]
    if len(pts) < 3:
        return
    n = (pts[1] - pts[0]).cross(pts[2] - pts[0])
    if n.length < 1e-8:
        n = Vector((1.0, 0.0, 0.0))
    else:
        n.normalize()
    off = n * (thick * 0.5)
    top = [bm.verts.new(p + off) for p in pts]
    bot = [bm.verts.new(p - off) for p in pts]
    bm.faces.new(top)
    bm.faces.new(list(reversed(bot)))
    npts = len(pts)
    for i in range(npts):
        j = (i + 1) % npts
        bm.faces.new((top[i], top[j], bot[j], bot[i]))


def add_tube(bm, p0, p1, r0, r1, segs=6):
    d = Vector(p1) - Vector(p0)
    if d.length < 1e-6:
        return
    d.normalize()
    arb = Vector((0.0, 0.0, 1.0)) if abs(d.z) < 0.9 else Vector((1.0, 0.0, 0.0))
    u = d.cross(arb).normalized()
    v = d.cross(u).normalized()
    rings = []
    for t, r in ((0.0, r0), (1.0, r1)):
        p = Vector(p0).lerp(Vector(p1), t)
        ring = []
        for i in range(segs):
            a = (i / segs) * TAU
            ring.append(bm.verts.new(p + (u * math.cos(a) + v * math.sin(a)) * r))
        rings.append(ring)
    for j in range(segs):
        j2 = (j + 1) % segs
        bm.faces.new((rings[0][j], rings[1][j], rings[1][j2], rings[0][j2]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[1])


def add_eye(bm, loc, r, subdivisions=1, squash=None):
    geo = bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=r)
    verts = geo["verts"]
    if squash:
        sx, sy, sz = squash
        for v in verts:
            v.co.x *= sx
            v.co.y *= sy
            v.co.z *= sz
    bmesh.ops.translate(bm, verts=verts, vec=Vector(loc))
    return verts


def mesh_from_bm(name, bm):
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0008)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    obj.location = (0.0, 0.0, 0.0)
    return obj


def paint(obj, fn):
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    col = bm.loops.layers.color.get("Color") or bm.loops.layers.color.new("Color")
    for face in bm.faces:
        for loop in face.loops:
            x, y, z = loop.vert.co
            loop[col] = fn(x, y, z)
    bm.to_mesh(me)
    bm.free()
    me.color_attributes.active_color_index = 0
    try:
        me.color_attributes.render_color_index = 0
    except Exception:
        pass


def bbox_report(obj):
    xs, ys, zs = zip(*[v.co for v in obj.data.vertices])
    tris = sum(max(0, len(p.vertices) - 2) for p in obj.data.polygons)
    return {
        "name": obj.name,
        "verts": len(obj.data.vertices),
        "tris": tris,
        "x": (round(min(xs), 2), round(max(xs), 2)),
        "y": (round(min(ys), 2), round(max(ys), 2)),
        "z": (round(min(zs), 2), round(max(zs), 2)),
    }


def wipe_generated():
    keep = set(KEEP)
    for obj in list(bpy.data.objects):
        if obj.name in keep:
            continue
        if obj.name.startswith("orca_"):
            continue
        me = obj.data if obj.type == "MESH" else None
        bpy.data.objects.remove(obj, do_unlink=True)
        if me and me.users == 0:
            bpy.data.meshes.remove(me)
    for me in list(bpy.data.meshes):
        if me.users == 0 and not me.name.startswith("orca"):
            bpy.data.meshes.remove(me)


# ---------------------------------------------------------------------------
# vehicle paint
# ---------------------------------------------------------------------------
def counter_fn(back, belly, waterline=-0.1, eye=None, extra=None):
    def fn(x, y, z):
        if eye:
            for ex, ey, ez, er in eye:
                if (x - ex) ** 2 + (y - ey) ** 2 + (z - ez) ** 2 < er * er:
                    return (0.02, 0.02, 0.025, 1.0)
        t = smoothstep(waterline - 0.45, waterline + 0.28, -z)
        c = lerp3(back, belly, t)
        if extra:
            c = extra(x, y, z, c)
        return rgba(c)

    return fn


def school_fn(eye=None, glow=None):
    """Encode look remap in COLOR_0."""

    def fn(x, y, z):
        if glow:
            for gx, gy, gz, gr in glow:
                if (x - gx) ** 2 + (y - gy) ** 2 + (z - gz) ** 2 < gr * gr:
                    return (0.0, 1.0, 0.0, 1.0)
        if eye:
            for ex, ey, ez, er in eye:
                if (x - ex) ** 2 + (y - ey) ** 2 + (z - ez) ** 2 < er * er:
                    return (0.0, 0.85, 0.0, 1.0)
        # Heuristic: thin bits far from axis are fins / wings / flukes
        ax = abs(x)
        if ax > 0.09 and abs(z) < 0.12:
            return (0.0, 0.5, 0.0, 1.0)
        if abs(z) > 0.12 and ax < 0.04 and y < -0.15:
            return (0.0, 0.5, 0.0, 1.0)
        t = smoothstep(-0.08, 0.08, -z)
        return (t, 0.0, t, 1.0)

    return fn


def _school_part(x, y, z, eye=None, glow=None, fin_if=None):
    if glow:
        for gx, gy, gz, gr in glow:
            if (x - gx) ** 2 + (y - gy) ** 2 + (z - gz) ** 2 < gr * gr:
                return 1.0, 0.5
    if eye:
        for ex, ey, ez, er in eye:
            if (x - ex) ** 2 + (y - ey) ** 2 + (z - ez) ** 2 < er * er:
                return 0.85, 0.15
    if fin_if and fin_if(x, y, z):
        return 0.5, 0.0
    return 0.0, smoothstep(-0.08, 0.08, -z)


def school_paint_parts(obj, eye=None, glow=None, fin_if=None):
    """COLOR_0 is a Blender preview. UV.x = belly mix, UV.y = part
    (0 body, 0.5 fin, 0.85 eye, 1 photophore) — UVs are not colour-managed."""
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    col = bm.loops.layers.color.get("Color") or bm.loops.layers.color.new("Color")
    uv_lay = bm.loops.layers.uv.get("UVMap") or bm.loops.layers.uv.new("UVMap")
    for face in bm.faces:
        for loop in face.loops:
            x, y, z = loop.vert.co
            part, mix = _school_part(x, y, z, eye, glow, fin_if)
            loop[uv_lay].uv = (mix, part)
            if part > 0.92:
                loop[col] = (0.45, 0.9, 0.35, 1.0)
            elif part > 0.7:
                loop[col] = (0.06, 0.07, 0.08, 1.0)
            elif part > 0.3:
                loop[col] = (0.2, 0.28, 0.24, 1.0)
            else:
                c = lerp3((0.16, 0.22, 0.2), (0.82, 0.86, 0.84), mix)
                loop[col] = rgba(c)
    bm.to_mesh(me)
    bm.free()
    me.color_attributes.active_color_index = 0
    try:
        me.color_attributes.render_color_index = 0
    except Exception:
        pass


# ---------------------------------------------------------------------------
# shared appendages (vehicle scale)
# ---------------------------------------------------------------------------
def v_dorsal(bm, y=0.1, h=1.45, root=1.35, z0=0.52, thick=0.07):
    add_poly(
        bm,
        [(0, y, z0), (0, y - root * 0.35, z0 + h), (0, y - root, z0 + 0.08)],
        thick,
    )


def v_caudal(bm, y=-4.55, span=1.95, thick=0.06):
    add_poly(bm, [(0, y, 0.12), (0, y - span * 0.55, span * 0.55), (0, y - span * 0.22, 0.04)], thick)
    add_poly(bm, [(0, y, -0.06), (0, y - span * 0.22, -0.04), (0, y - span * 0.42, -span * 0.38)], thick)


def v_flukes(bm, y=-4.85, span=1.85, chord=1.45, thick=0.07):
    add_poly(
        bm,
        [(0, y, 0.02), (span, y - chord * 0.35, -0.04), (span * 0.15, y - chord, 0.0), (-span, y - chord * 0.35, -0.04)],
        thick,
    )


def v_pec(bm, side, y=1.2, z=-0.22, reach=2.55, chord=0.85, thick=0.05):
    s = 1.0 if side > 0 else -1.0
    add_poly(
        bm,
        [
            (0.18 * s, y, z),
            (reach * s, y - chord * 0.25, z - 0.12),
            (reach * 0.55 * s, y - chord, z - 0.18),
            (0.22 * s, y - chord * 0.55, z - 0.06),
        ],
        thick,
    )


def v_anal(bm, y=-0.7, h=-0.42, root=0.65):
    add_poly(bm, [(0, y, -0.08), (0, y - root, -0.06), (0, y - root * 0.35, h)], 0.045)


# ---------------------------------------------------------------------------
# vehicles
# ---------------------------------------------------------------------------
def shark_stations(kind):
    if kind == "greatwhite":
        return [
            (-5.08, 0.03, 0.03),
            (-4.42, 0.22, 0.24),
            (-3.15, 0.62, 0.70),
            (-1.15, 0.92, 1.05),
            (0.55, 0.98, 1.12),
            (1.85, 0.90, 0.96),
            (2.85, 0.82, 0.78),
            (3.45, 0.76, 0.58),
            (3.95, 0.64, 0.44),
            (4.32, 0.46, 0.32),
            (4.55, 0.26, 0.20),
            (4.70, 0.10, 0.08),
        ]
    if kind == "tigershark":
        return [
            (-5.05, 0.03, 0.035),
            (-4.38, 0.24, 0.26),
            (-2.75, 0.78, 0.86),
            (-0.55, 1.00, 1.10),
            (1.15, 0.96, 1.02),
            (2.25, 0.90, 0.86),
            (3.15, 0.90, 0.72),
            (3.70, 0.92, 0.64),
            (4.15, 0.88, 0.54),
            (4.48, 0.74, 0.42),
            (4.68, 0.42, 0.28),
            (4.80, 0.16, 0.14),
        ]
    # Blue shark: slender fusiform, long conical snout, distinct head.
    return [
        (-5.08, 0.02, 0.025),
        (-4.42, 0.14, 0.16),
        (-3.2, 0.36, 0.42),
        (-1.6, 0.55, 0.64),
        (0.05, 0.62, 0.70),
        (1.45, 0.64, 0.68),
        (2.35, 0.58, 0.54),
        (3.05, 0.52, 0.42),
        (3.48, 0.50, 0.34),
        (3.82, 0.46, 0.28),
        (4.12, 0.36, 0.20),
        (4.42, 0.26, 0.14),
        (4.74, 0.16, 0.09),
        (5.02, 0.075, 0.048),
        (5.16, 0.028, 0.022),
    ]


def _ang_dist(a, a0):
    return abs((a - a0 + math.pi) % TAU - math.pi)


def _flat_snout(y, a, x, z, y0, y1, amount):
    if y > y0 and math.sin(a) < 0:
        z *= 1.0 - amount * smoothstep(y0, y1, y)
    return x, z


def blue_shark_shape(y, a, x, z, rx, rz):
    """Conical snout, flattened underside, mild cheek for the eye."""
    x, z = _flat_snout(y, a, x, z, 3.35, 5.08, 0.42)
    if 3.62 < y < 3.98:
        lat = 1.0 - _ang_dist(a, 0.22 if x >= 0 else math.pi - 0.22) / 0.5
        if lat > 0:
            k = lat ** 1.5 * max(0.0, 1.0 - abs(y - 3.80) / 0.16)
            x *= 1.0 - 0.05 * k
    if 3.68 < y < 3.96 and math.sin(a) > 0.2:
        lat = 1.0 - _ang_dist(a, 0.7 if x >= 0 else math.pi - 0.7) / 0.4
        if lat > 0:
            k = lat * max(0.0, 1.0 - abs(y - 3.82) / 0.12)
            z += 0.025 * k
    return x, z


def greatwhite_shape(y, a, x, z, rx, rz):
    """Stout short cone, heavy cheek, flattened underside."""
    x, z = _flat_snout(y, a, x, z, 3.15, 4.70, 0.34)
    if 3.28 < y < 3.88:
        lat = 1.0 - _ang_dist(a, 0.18 if x >= 0 else math.pi - 0.18) / 0.55
        if lat > 0:
            k = lat ** 1.3 * max(0.0, 1.0 - abs(y - 3.55) / 0.22)
            x *= 1.0 + 0.08 * k
    if 3.40 < y < 3.80 and math.sin(a) > 0.15:
        lat = 1.0 - _ang_dist(a, 0.65 if x >= 0 else math.pi - 0.65) / 0.42
        if lat > 0:
            k = lat * max(0.0, 1.0 - abs(y - 3.58) / 0.14)
            z += 0.045 * k
    return x, z


def tiger_shark_shape(y, a, x, z, rx, rz):
    """Wide truncated snout — a blunt head, not a cone."""
    x, z = _flat_snout(y, a, x, z, 3.05, 5.10, 0.30)
    if y > 3.15:
        t = smoothstep(3.15, 5.00, y)
        x *= 1.0 + 0.20 * t
        if math.sin(a) > 0:
            z *= 1.0 - 0.20 * t
    return x, z


def whale_shark_shape(y, a, x, z, rx, rz):
    """Broad truncated head; mouth sits on the front face."""
    if y > 3.30:
        t = smoothstep(3.30, 5.05, y)
        x *= 1.0 + 0.10 * t
        if math.sin(a) < 0:
            z *= 1.0 - 0.26 * t
        else:
            z *= 1.0 - 0.06 * t
    return x, z


def add_lower_jaw(bm, stations, segs=10):
    """Separate mandible so the gape reads in silhouette."""
    rings = []
    for y, rx, rz, zc in stations:
        ring = []
        for i in range(segs):
            a = (i / segs) * TAU
            ring.append(bm.verts.new((math.cos(a) * rx, y, zc + math.sin(a) * rz)))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for j in range(segs):
            j2 = (j + 1) % segs
            bm.faces.new((rings[i][j], rings[i + 1][j], rings[i + 1][j2], rings[i][j2]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])


def add_gape(bm, verts, thick=0.02):
    add_poly(bm, verts, thick)


def add_gills(bm, side, y0=3.08, x0=0.51, n=5, span=0.88, h=0.32):
    s = 1.0 if side > 0 else -1.0
    for i in range(n):
        t = i / max(1, n - 1)
        y = y0 - t * span
        x = s * (x0 - t * 0.05)
        hh = h - t * 0.05
        add_poly(
            bm,
            [
                (x, y + 0.008, 0.11),
                (x * 1.012, y - 0.018, 0.11 - hh),
                (x * 1.012, y - 0.034, 0.11 - hh),
                (x, y - 0.006, 0.11),
            ],
            0.01,
        )


def add_shark_teeth(bm, y=4.10, z_up=-0.05, z_lo=-0.14, w=0.18, n_up=7, n_lo=5, hang=0.045):
    def tooth(x, yy, z0, tip_z, width=0.018):
        add_poly(
            bm,
            [
                (x - width, yy + 0.006, z0),
                (x + width, yy + 0.006, z0),
                (x, yy - 0.004, tip_z),
            ],
            0.007,
        )

    tw = 0.028 if n_up <= 6 else 0.016
    for i in range(n_up):
        t = i / max(1, n_up - 1)
        x = (t - 0.5) * 2.0 * w
        yy = y + 0.03 * (1.0 - (x / max(w, 1e-4)) ** 2)
        tooth(x, yy, z_up, z_up - hang, tw)
    for i in range(n_lo):
        t = i / max(1, n_lo - 1)
        wl = w * 0.78
        x = (t - 0.5) * 2.0 * wl
        yy = y - 0.04 + 0.02 * (1.0 - (x / max(wl, 1e-4)) ** 2)
        tooth(x, yy, z_lo, z_lo + hang * 0.9, tw * 0.85)


def add_cephalofoil(bm):
    """Scalloped hammer: wide foil with real chord at the lobes, eyes at the tips."""
    # x, y_lead, y_trail, hz — modest scallop, trailing edge keeps chord at the tips.
    half = [
        (0.0, 4.68, 3.80, 0.15),
        (0.50, 4.78, 3.92, 0.14),
        (1.05, 4.66, 4.02, 0.13),
        (1.60, 4.80, 4.14, 0.13),
        (2.18, 4.55, 4.22, 0.12),
    ]

    def ring(x, y_lead, y_trail, hz):
        return [
            bm.verts.new((x, y_lead, hz)),
            bm.verts.new((x, y_trail, hz * 0.65)),
            bm.verts.new((x, y_trail, -hz * 0.5)),
            bm.verts.new((x, y_lead, -hz * 0.4)),
        ]

    def loft(stations):
        rings = [ring(*st) for st in stations]
        for i in range(len(rings) - 1):
            a, b = rings[i], rings[i + 1]
            for j in range(4):
                j2 = (j + 1) % 4
                bm.faces.new((a[j], a[j2], b[j2], b[j]))
        bm.faces.new(rings[-1])

    loft(half)
    loft([(-x, yl, yt, hz) for x, yl, yt, hz in half])


def add_terminal_mouth(bm, y=5.10, w=0.90, zc=-0.02, h=0.20):
    add_poly(
        bm,
        [
            (-w, y, zc + h),
            (w, y, zc + h),
            (w * 0.82, y, zc - h),
            (-w * 0.82, y, zc - h),
        ],
        0.045,
    )


def add_flank_ridge(bm, x, z=0.55, y0=-2.4, y1=3.6, h=0.10):
    s = 1.0 if x >= 0 else -1.0
    add_poly(
        bm,
        [
            (x, y0, z),
            (x + 0.04 * s, (y0 + y1) * 0.45, z + h),
            (x, y1, z + 0.02),
            (x - 0.02 * s, (y0 + y1) * 0.45, z),
        ],
        0.035,
    )


def build_shark(name, kind):
    bm = bmesh.new()
    white = kind == "greatwhite"
    tiger = kind == "tigershark"
    blue = kind == "shark"
    segs = 22 if not blue else 24
    shape = blue_shark_shape if blue else greatwhite_shape if white else tiger_shark_shape if tiger else None
    add_body(
        bm,
        shark_stations(kind),
        segs,
        belly=0.70 if blue else 0.74 if tiger else 0.72,
        dorsal=1.08 if white else 1.04,
        shape=shape,
        nose="point" if blue else "fan",
    )
    if blue:
        v_dorsal(bm, y=-0.22, h=1.32, root=1.25)
        v_caudal(bm, span=1.9)
        v_pec(bm, 1, y=2.18, z=-0.18, reach=3.15, chord=1.05)
        v_pec(bm, -1, y=2.18, z=-0.18, reach=3.15, chord=1.05)
        v_anal(bm, y=-0.85)
        add_gills(bm, 1, y0=3.08, x0=0.51)
        add_gills(bm, -1, y0=3.08, x0=0.51)
        add_lower_jaw(
            bm,
            [
                (3.40, 0.30, 0.055, -0.17),
                (3.66, 0.26, 0.068, -0.205),
                (3.90, 0.20, 0.055, -0.185),
                (4.08, 0.10, 0.032, -0.145),
            ],
        )
        add_gape(bm, [(-0.18, 4.06, -0.04), (0.18, 4.06, -0.04), (0.16, 3.88, -0.16), (-0.16, 3.88, -0.16)])
        add_shark_teeth(bm)
        add_eye(bm, (0.45, 3.76, 0.05), 0.125, subdivisions=2, squash=(0.32, 1.08, 1.08))
        add_eye(bm, (-0.45, 3.76, 0.05), 0.125, subdivisions=2, squash=(0.32, 1.08, 1.08))
        eye = [(0.45, 3.76, 0.05, 0.14), (-0.45, 3.76, 0.05, 0.14)]
        mouth = (3.88, 4.18, -0.14, -0.01, 0.24)
    elif white:
        v_dorsal(bm, y=0.12, h=1.62, root=1.45)
        v_caudal(bm, span=2.15)
        v_pec(bm, 1, y=2.05, z=-0.22, reach=2.55, chord=1.15)
        v_pec(bm, -1, y=2.05, z=-0.22, reach=2.55, chord=1.15)
        v_anal(bm, y=-0.75)
        add_gills(bm, 1, y0=3.15, x0=0.78, span=1.05, h=0.48)
        add_gills(bm, -1, y0=3.15, x0=0.78, span=1.05, h=0.48)
        add_lower_jaw(
            bm,
            [
                (3.28, 0.38, 0.07, -0.22),
                (3.62, 0.46, 0.10, -0.30),
                (4.00, 0.40, 0.09, -0.26),
                (4.28, 0.20, 0.05, -0.16),
            ],
        )
        add_gape(bm, [(-0.32, 4.18, -0.05), (0.32, 4.18, -0.05), (0.28, 3.90, -0.22), (-0.28, 3.90, -0.22)])
        add_shark_teeth(bm, y=4.16, z_up=-0.06, z_lo=-0.18, w=0.30, n_up=6, n_lo=5, hang=0.07)
        add_eye(bm, (0.82, 3.50, 0.12), 0.13, subdivisions=2, squash=(0.34, 1.05, 1.05))
        add_eye(bm, (-0.82, 3.50, 0.12), 0.13, subdivisions=2, squash=(0.34, 1.05, 1.05))
        eye = [(0.82, 3.50, 0.12, 0.15), (-0.82, 3.50, 0.12, 0.15)]
        mouth = (3.72, 4.22, -0.24, -0.02, 0.30)
    else:
        v_dorsal(bm, y=0.22, h=1.38, root=1.35)
        v_caudal(bm, span=1.85)
        v_pec(bm, 1, y=2.10, z=-0.20, reach=2.45, chord=1.20)
        v_pec(bm, -1, y=2.10, z=-0.20, reach=2.45, chord=1.20)
        v_anal(bm, y=-0.65)
        add_gills(bm, 1, y0=3.20, x0=0.78, span=0.95, h=0.42)
        add_gills(bm, -1, y0=3.20, x0=0.78, span=0.95, h=0.42)
        add_lower_jaw(
            bm,
            [
                (3.35, 0.42, 0.08, -0.20),
                (3.70, 0.50, 0.10, -0.26),
                (4.10, 0.44, 0.09, -0.22),
                (4.38, 0.22, 0.05, -0.14),
            ],
        )
        add_gape(bm, [(-0.36, 4.22, -0.05), (0.36, 4.22, -0.05), (0.32, 3.96, -0.20), (-0.32, 3.96, -0.20)])
        add_shark_teeth(bm, y=4.18, z_up=-0.06, z_lo=-0.18, w=0.34, n_up=8, n_lo=6, hang=0.05)
        add_eye(bm, (0.92, 3.62, 0.10), 0.11, subdivisions=2, squash=(0.32, 1.05, 1.05))
        add_eye(bm, (-0.92, 3.62, 0.10), 0.11, subdivisions=2, squash=(0.32, 1.05, 1.05))
        eye = [(0.92, 3.62, 0.10, 0.13), (-0.92, 3.62, 0.10, 0.13)]
        mouth = (3.85, 4.18, -0.24, -0.06, 0.22)
    obj = mesh_from_bm(name, bm)

    def face_extra(x, y, z, c, mouth_box, stripe=False):
        y0, y1, z0, z1, xw = mouth_box
        if y0 < y < y1 and z0 < z < min(z1, -0.05) and abs(x) < xw:
            if z > z0 + (z1 - z0) * 0.35:
                return (0.07, 0.045, 0.045)
            if z < z0 + (z1 - z0) * 0.55:
                return (0.93, 0.91, 0.86)
        if stripe and z > -0.08 and y < 4.35:
            bar = math.sin(y * 1.7 + x * 0.22) * 0.7 + math.sin(y * 3.4) * 0.3
            if bar > 0.22:
                return (c[0] * 0.52, c[1] * 0.46, c[2] * 0.40)
        return c

    if tiger:
        paint(
            obj,
            counter_fn(
                (0.48, 0.34, 0.16),
                (0.82, 0.74, 0.56),
                -0.08,
                eye=eye,
                extra=lambda x, y, z, c: face_extra(x, y, z, c, mouth, True),
            ),
        )
    elif white:
        paint(
            obj,
            counter_fn(
                (0.40, 0.42, 0.44),
                (0.93, 0.91, 0.88),
                -0.04,
                eye=eye,
                extra=lambda x, y, z, c: face_extra(x, y, z, c, mouth),
            ),
        )
    else:
        paint(
            obj,
            counter_fn(
                (0.10, 0.22, 0.46),
                (0.84, 0.88, 0.90),
                -0.08,
                eye=eye,
                extra=lambda x, y, z, c: face_extra(x, y, z, c, mouth),
            ),
        )
    return obj


def build_hammerhead(name):
    bm = bmesh.new()
    add_body(
        bm,
        [
            (-5.0, 0.02, 0.02),
            (-4.4, 0.16, 0.18),
            (-2.6, 0.50, 0.56),
            (-0.5, 0.68, 0.76),
            (1.3, 0.66, 0.72),
            (2.55, 0.56, 0.54),
            (3.20, 0.48, 0.38),
            (3.70, 0.40, 0.22),
        ],
        20,
        belly=0.76,
        dorsal=1.04,
        shape=lambda y, a, x, z, rx, rz: _flat_snout(y, a, x, z, 3.05, 3.70, 0.22),
        nose="fan",
    )
    add_cephalofoil(bm)
    v_dorsal(bm, y=0.05, h=1.32, root=1.15)
    v_caudal(bm, span=1.75)
    v_pec(bm, 1, y=1.85, z=-0.16, reach=1.95, chord=0.90)
    v_pec(bm, -1, y=1.85, z=-0.16, reach=1.95, chord=0.90)
    add_gills(bm, 1, y0=2.95, x0=0.48, span=0.80, h=0.30)
    add_gills(bm, -1, y0=2.95, x0=0.48, span=0.80, h=0.30)
    add_lower_jaw(
        bm,
        [
            (3.42, 0.16, 0.04, -0.10),
            (3.68, 0.18, 0.05, -0.13),
            (3.90, 0.14, 0.04, -0.11),
            (4.06, 0.06, 0.02, -0.08),
        ],
        segs=8,
    )
    add_gape(bm, [(-0.12, 4.02, -0.03), (0.12, 4.02, -0.03), (0.10, 3.86, -0.11), (-0.10, 3.86, -0.11)])
    add_shark_teeth(bm, y=4.00, z_up=-0.04, z_lo=-0.11, w=0.10, n_up=5, n_lo=4, hang=0.03)
    add_eye(bm, (2.14, 4.52, 0.04), 0.10, subdivisions=2, squash=(0.48, 1.12, 1.12))
    add_eye(bm, (-2.14, 4.52, 0.04), 0.10, subdivisions=2, squash=(0.48, 1.12, 1.12))
    obj = mesh_from_bm(name, bm)
    eye = [(2.14, 4.52, 0.04, 0.12), (-2.14, 4.52, 0.04, 0.12)]

    def extra(x, y, z, c):
        if abs(x) > 0.38 and y > 3.75:
            t = smoothstep(-0.12, 0.10, z)
            return (
                0.24 + 0.08 * t,
                0.30 + 0.06 * t,
                0.32 + 0.06 * t,
            )
        if 3.78 < y < 4.06 and -0.13 < z < -0.02 and abs(x) < 0.14:
            return (0.07, 0.045, 0.045)
        return c

    paint(obj, counter_fn((0.26, 0.32, 0.34), (0.72, 0.76, 0.74), -0.08, eye=eye, extra=extra))
    return obj


def build_whaleshark(name):
    bm = bmesh.new()
    add_body(
        bm,
        [
            (-5.05, 0.10, 0.10),
            (-4.2, 0.50, 0.55),
            (-2.0, 1.15, 1.22),
            (0.3, 1.42, 1.48),
            (2.15, 1.38, 1.38),
            (3.35, 1.36, 1.20),
            (4.20, 1.34, 0.90),
            (4.70, 1.30, 0.64),
            (5.05, 1.24, 0.50),
        ],
        20,
        belly=0.82,
        dorsal=1.02,
        shape=whale_shark_shape,
        nose="fan",
    )
    v_dorsal(bm, y=-0.15, h=1.05, root=0.85, z0=0.7)
    v_caudal(bm, span=1.7)
    v_pec(bm, 1, y=1.65, z=-0.22, reach=2.45, chord=1.15)
    v_pec(bm, -1, y=1.65, z=-0.22, reach=2.45, chord=1.15)
    add_gills(bm, 1, y0=3.35, x0=1.15, span=1.15, h=0.62)
    add_gills(bm, -1, y0=3.35, x0=1.15, span=1.15, h=0.62)
    add_terminal_mouth(bm, y=5.055, w=0.88, zc=-0.04, h=0.12)
    add_lower_jaw(
        bm,
        [
            (4.62, 0.90, 0.10, -0.26),
            (4.88, 1.00, 0.09, -0.16),
            (5.02, 1.02, 0.06, -0.08),
        ],
        segs=12,
    )
    for x in (0.0, 0.42, -0.42, 0.85, -0.85):
        add_flank_ridge(bm, x, z=0.48 if abs(x) < 0.2 else 0.22, y0=-2.2, y1=3.8, h=0.12 if abs(x) < 0.2 else 0.09)
    add_eye(bm, (1.18, 4.62, 0.14), 0.08, subdivisions=2, squash=(0.4, 1.0, 1.0))
    add_eye(bm, (-1.18, 4.62, 0.14), 0.08, subdivisions=2, squash=(0.4, 1.0, 1.0))
    obj = mesh_from_bm(name, bm)
    eye = [(1.18, 4.62, 0.14, 0.10), (-1.18, 4.62, 0.14, 0.10)]

    def extra(x, y, z, c):
        if y > 4.96 and abs(x) < 0.96 and -0.20 < z < 0.12:
            return (0.08, 0.07, 0.07)
        h = math.sin(x * 13.1 + y * 7.14 + z * 2.97) * 43758.5453
        fract = h - math.floor(h)
        if z > -0.08 and fract > 0.62:
            return (min(1, c[0] + 0.38), min(1, c[1] + 0.36), min(1, c[2] + 0.32))
        return c

    paint(obj, counter_fn((0.16, 0.22, 0.30), (0.55, 0.58, 0.60), -0.12, eye=eye, extra=extra))
    return obj


def build_minke(name):
    bm = bmesh.new()
    add_body(
        bm,
        [
            (-5.05, 0.03, 0.03),
            (-4.45, 0.22, 0.24),
            (-2.6, 0.72, 0.78),
            (0.05, 0.98, 1.02),
            (2.35, 0.82, 0.88),
            (4.15, 0.42, 0.48),
            (4.95, 0.12, 0.14),
        ],
        16,
        belly=0.8,
        dorsal=1.04,
    )
    v_dorsal(bm, y=-0.3, h=0.72, root=0.55, z0=0.55)
    v_flukes(bm, y=-4.9, span=1.85, chord=1.4)
    v_pec(bm, 1, y=1.35, z=-0.32, reach=1.55, chord=0.7)
    v_pec(bm, -1, y=1.35, z=-0.32, reach=1.55, chord=0.7)
    add_eye(bm, (0.48, 3.85, 0.18), 0.07)
    add_eye(bm, (-0.48, 3.85, 0.18), 0.07)
    obj = mesh_from_bm(name, bm)
    paint(obj, counter_fn((0.28, 0.3, 0.34), (0.62, 0.64, 0.66), -0.14))
    return obj


def build_humpback(name):
    bm = bmesh.new()
    add_body(
        bm,
        [
            (-5.15, 0.04, 0.04),
            (-4.5, 0.32, 0.36),
            (-2.5, 1.02, 1.1),
            (0.15, 1.38, 1.42),
            (2.5, 1.12, 1.18),
            (4.25, 0.58, 0.62),
            (5.05, 0.16, 0.18),
        ],
        16,
        belly=0.84,
        dorsal=1.06,
    )
    v_dorsal(bm, y=-1.1, h=0.82, root=0.42, z0=0.7)
    v_flukes(bm, y=-4.95, span=2.45, chord=1.7)
    v_pec(bm, 1, y=1.35, z=-0.34, reach=3.2, chord=1.15, thick=0.07)
    v_pec(bm, -1, y=1.35, z=-0.34, reach=3.2, chord=1.15, thick=0.07)
    add_eye(bm, (0.55, 3.9, 0.16), 0.07)
    add_eye(bm, (-0.55, 3.9, 0.16), 0.07)
    obj = mesh_from_bm(name, bm)

    def extra(x, y, z, c):
        if z < -0.12 and 0.4 < y < 4.2 and abs(math.sin(x * 9.5)) > 0.72:
            return (c[0] * 0.72, c[1] * 0.72, c[2] * 0.75)
        if abs(x) > 1.2 and z < -0.05:
            return lerp3(c, (0.82, 0.84, 0.86), 0.55)
        return c

    paint(obj, counter_fn((0.18, 0.2, 0.24), (0.42, 0.44, 0.46), -0.16, extra=extra))
    return obj


def build_spermwhale(name):
    bm = bmesh.new()
    add_body(
        bm,
        [
            (-5.42, 0.05, 0.05),
            (-4.72, 0.28, 0.32),
            (-3.35, 0.62, 0.7),
            (-1.65, 0.8, 0.9),
            (-0.05, 0.86, 0.98),
            (1.25, 0.9, 1.08),
            (2.4, 0.92, 1.22),
            (3.5, 0.95, 1.38),
            (4.55, 0.88, 1.32),
            (5.22, 0.55, 0.82),
            (5.42, 0.12, 0.18),
        ],
        18,
        belly=0.88,
        dorsal=1.02,
    )
    add_tube(bm, (0, 2.9, -1.05), (0, 5.15, -1.12), 0.22, 0.16, 8)
    v_dorsal(bm, y=-0.85, h=0.32, root=0.7, z0=0.62)
    for i in range(4):
        v_dorsal(bm, y=-1.55 - i * 0.72, h=0.16 + i * 0.03, root=0.32, z0=0.48, thick=0.05)
    v_flukes(bm, y=-5.28, span=2.55, chord=1.7)
    v_pec(bm, 1, y=0.85, z=-0.52, reach=1.15, chord=0.55)
    v_pec(bm, -1, y=0.85, z=-0.52, reach=1.15, chord=0.55)
    add_eye(bm, (0.88, 2.55, -0.38), 0.06)
    add_eye(bm, (-0.88, 2.55, -0.38), 0.06)
    obj = mesh_from_bm(name, bm)

    def extra(x, y, z, c):
        wr = 1.0 - max(0.0, math.sin(y * 2.1 + x * 4.2)) * 0.18
        if y > 4.7 and z > 0.7 and x < -0.15:
            return (0.06, 0.06, 0.07)
        return (c[0] * wr, c[1] * wr, c[2] * wr)

    paint(obj, counter_fn((0.22, 0.21, 0.2), (0.36, 0.34, 0.32), -0.2, extra=extra))
    return obj


def build_dolphin(name):
    bm = bmesh.new()
    add_body(
        bm,
        [
            (-4.7, 0.02, 0.02),
            (-4.15, 0.18, 0.2),
            (-2.4, 0.55, 0.62),
            (-0.4, 0.78, 0.88),
            (1.6, 0.72, 0.82),
            (3.4, 0.48, 0.52),
            (4.55, 0.22, 0.22),
            (4.95, 0.1, 0.08),
        ],
        16,
        belly=0.78,
        dorsal=1.06,
    )
    add_tube(bm, (0, 4.85, -0.04), (0, 5.85, -0.06), 0.11, 0.03, 8)
    v_dorsal(bm, y=0.05, h=1.12, root=1.05, z0=0.48, thick=0.06)
    v_flukes(bm, y=-4.65, span=1.45, chord=1.12)
    v_pec(bm, 1, y=1.4, z=-0.22, reach=1.35, chord=0.55)
    v_pec(bm, -1, y=1.4, z=-0.22, reach=1.35, chord=0.55)
    add_eye(bm, (0.3, 3.72, 0.14), 0.07)
    add_eye(bm, (-0.3, 3.72, 0.14), 0.07)
    obj = mesh_from_bm(name, bm)

    def extra(x, y, z, c):
        # hourglass flank
        if 0.22 < abs(x) < 0.7 and -0.5 < y < 3.2 and -0.05 < z < 0.35:
            return lerp3(c, (0.78, 0.72, 0.42), 0.55)
        return c

    paint(obj, counter_fn((0.22, 0.3, 0.4), (0.84, 0.86, 0.88), -0.08, extra=extra))
    return obj


def build_bluefin(name):
    bm = bmesh.new()
    add_body(
        bm,
        [
            (-4.9, 0.02, 0.02),
            (-4.35, 0.18, 0.28),
            (-2.6, 0.48, 0.78),
            (-0.4, 0.62, 0.95),
            (1.6, 0.58, 0.88),
            (3.4, 0.38, 0.55),
            (4.55, 0.16, 0.22),
            (5.05, 0.04, 0.05),
        ],
        16,
        belly=0.7,
        dorsal=1.12,
    )
    v_dorsal(bm, y=0.35, h=0.95, root=0.62, z0=0.42, thick=0.05)
    v_caudal(bm, y=-4.55, span=1.4)
    v_pec(bm, 1, y=1.5, z=-0.12, reach=1.15, chord=0.45)
    v_pec(bm, -1, y=1.5, z=-0.12, reach=1.15, chord=0.45)
    for i in range(6):
        yy = -1.6 - i * 0.38
        add_poly(bm, [(0, yy, 0.22), (0, yy - 0.12, 0.38), (0, yy - 0.28, 0.2)], 0.03)
        add_poly(bm, [(0, yy, -0.18), (0, yy - 0.28, -0.16), (0, yy - 0.12, -0.32)], 0.03)
    add_eye(bm, (0.28, 3.35, 0.12), 0.07)
    add_eye(bm, (-0.28, 3.35, 0.12), 0.07)
    obj = mesh_from_bm(name, bm)

    def extra(x, y, z, c):
        if math.sin(y * 4.2) > 0.55 and z > 0.05:
            return (c[0] * 0.7, c[1] * 0.75, c[2] * 0.85)
        if y < -1.4 and abs(z) > 0.28:
            return (0.82, 0.62, 0.12)
        return c

    paint(obj, counter_fn((0.12, 0.22, 0.38), (0.78, 0.8, 0.72), -0.06, extra=extra))
    return obj


def build_giantsquid(name):
    bm = bmesh.new()
    # Mantle tip at +Y (game +Z after bake) so the jet shader's mantle band is the front.
    add_body(
        bm,
        [
            (-1.45, 0.22, 0.22),
            (-1.05, 0.72, 0.7),
            (-0.15, 0.95, 0.88),
            (1.5, 0.88, 0.8),
            (3.6, 0.48, 0.42),
            (5.05, 0.04, 0.04),
        ],
        14,
        belly=0.92,
        dorsal=1.02,
    )
    add_poly(bm, [(0.16, 1.6, 0.05), (1.55, 2.4, 0.02), (0.2, 3.1, 0.04)], 0.05)
    add_poly(bm, [(-0.16, 1.6, 0.05), (-0.2, 3.1, 0.04), (-1.55, 2.4, 0.02)], 0.05)
    for i in range(8):
        a = (i / 8) * TAU
        x, z = math.cos(a) * 0.42, math.sin(a) * 0.32
        add_tube(bm, (x, -1.35, z), (x * 0.45, -4.15, z * 0.45), 0.08, 0.025, 5)
    add_tube(bm, (0.22, -1.35, -0.05), (0.12, -5.35, -0.08), 0.07, 0.02, 5)
    add_tube(bm, (-0.22, -1.35, -0.05), (-0.12, -5.35, -0.08), 0.07, 0.02, 5)
    add_eye(bm, (0.52, -0.62, 0.1), 0.2)
    add_eye(bm, (-0.52, -0.62, 0.1), 0.2)
    obj = mesh_from_bm(name, bm)
    paint(obj, counter_fn((0.55, 0.28, 0.22), (0.78, 0.48, 0.36), 0.0))
    return obj


# ---------------------------------------------------------------------------
# school guilds (~1 unit along Y)
# ---------------------------------------------------------------------------
def s_dorsal(bm, y=-0.08, h=0.14, root=0.16, z0=0.12, thick=0.012):
    add_poly(bm, [(0, y, z0), (0, y - root * 0.35, z0 + h), (0, y - root, z0 + 0.02)], thick)


def s_tail(bm, y=-0.46, fork=1.0, thick=0.012):
    add_poly(bm, [(0, y, 0.0), (0, y - 0.22, 0.16 * fork), (0, y - 0.12, 0.02)], thick)
    add_poly(bm, [(0, y, 0.0), (0, y - 0.12, -0.02), (0, y - 0.22, -0.16 * fork)], thick)


def s_pec(bm, side, y=0.08, z=0.02, reach=0.12, chord=0.1, thick=0.01):
    s = 1.0 if side > 0 else -1.0
    add_poly(
        bm,
        [
            (0.04 * s, y, z),
            (reach * s, y - chord * 0.2, z - 0.01),
            (reach * 0.4 * s, y - chord, z - 0.02),
        ],
        thick,
    )


def build_school_fish(name):
    bm = bmesh.new()
    add_body(
        bm,
        [
            (-0.48, 0.004, 0.004),
            (-0.4, 0.05, 0.055),
            (-0.22, 0.09, 0.11),
            (0.0, 0.11, 0.13),
            (0.22, 0.09, 0.105),
            (0.4, 0.045, 0.05),
            (0.48, 0.012, 0.014),
        ],
        8,
        belly=0.75,
        dorsal=1.08,
    )
    s_dorsal(bm)
    s_tail(bm)
    s_pec(bm, 1, reach=0.13)
    s_pec(bm, -1, reach=0.13)
    obj = mesh_from_bm(name, bm)
    school_paint_parts(
        obj,
        fin_if=lambda x, y, z: abs(x) > 0.09 or (y < -0.42 and abs(z) > 0.02) or (z > 0.13 and abs(x) < 0.03),
    )
    return obj


def build_school_flying(name):
    bm = bmesh.new()
    add_body(
        bm,
        [
            (-0.48, 0.004, 0.004),
            (-0.38, 0.04, 0.045),
            (-0.16, 0.07, 0.085),
            (0.08, 0.085, 0.1),
            (0.3, 0.06, 0.07),
            (0.46, 0.02, 0.022),
        ],
        8,
        belly=0.78,
        dorsal=1.05,
    )
    s_dorsal(bm, y=-0.05, h=0.1)
    s_tail(bm, fork=0.88)
    for s in (1, -1):
        add_poly(
            bm,
            [(0.04 * s, 0.14, 0.02), (0.54 * s, -0.02, 0.05), (0.07 * s, -0.18, -0.02)],
            0.01,
        )
        add_poly(
            bm,
            [(0.04 * s, -0.08, -0.02), (0.22 * s, -0.22, -0.02), (0.05 * s, -0.18, -0.04)],
            0.01,
        )
    obj = mesh_from_bm(name, bm)
    school_paint_parts(
        obj,
        fin_if=lambda x, y, z: abs(x) > 0.08 or y < -0.42,
    )
    return obj


def build_school_needle(name):
    bm = bmesh.new()
    add_body(
        bm,
        [
            (-0.5, 0.003, 0.003),
            (-0.4, 0.028, 0.03),
            (-0.12, 0.045, 0.05),
            (0.12, 0.05, 0.055),
            (0.34, 0.038, 0.042),
            (0.48, 0.016, 0.018),
            (0.56, 0.004, 0.004),
        ],
        8,
        belly=0.8,
        dorsal=1.04,
    )
    s_dorsal(bm, h=0.1, root=0.14)
    s_tail(bm, y=-0.48, fork=0.7)
    s_pec(bm, 1, reach=0.08, chord=0.08)
    s_pec(bm, -1, reach=0.08, chord=0.08)
    add_poly(bm, [(0, -0.12, -0.06), (0, -0.26, -0.05), (0, -0.18, -0.14)], 0.01)
    obj = mesh_from_bm(name, bm)
    school_paint_parts(obj, fin_if=lambda x, y, z: abs(x) > 0.06 or y < -0.45 or z < -0.08 or z > 0.08)
    return obj


def build_school_tuna(name):
    bm = bmesh.new()
    add_body(
        bm,
        [
            (-0.5, 0.004, 0.004),
            (-0.4, 0.04, 0.07),
            (-0.18, 0.08, 0.14),
            (0.05, 0.1, 0.16),
            (0.28, 0.075, 0.12),
            (0.44, 0.035, 0.05),
            (0.5, 0.01, 0.012),
        ],
        8,
        belly=0.68,
        dorsal=1.14,
    )
    s_dorsal(bm, y=0.05, h=0.18, root=0.12, z0=0.14)
    s_tail(bm, y=-0.48, fork=1.22)
    s_pec(bm, 1, reach=0.1, chord=0.08)
    s_pec(bm, -1, reach=0.1, chord=0.08)
    obj = mesh_from_bm(name, bm)
    school_paint_parts(obj, fin_if=lambda x, y, z: abs(x) > 0.08 or y < -0.42 or z > 0.16)
    return obj


def build_school_cod(name):
    bm = bmesh.new()
    add_body(
        bm,
        [
            (-0.48, 0.008, 0.008),
            (-0.38, 0.06, 0.07),
            (-0.16, 0.12, 0.13),
            (0.06, 0.14, 0.15),
            (0.26, 0.1, 0.11),
            (0.42, 0.05, 0.055),
            (0.5, 0.014, 0.016),
        ],
        8,
        belly=0.82,
        dorsal=1.06,
    )
    s_dorsal(bm, y=-0.06, h=0.16, root=0.18, z0=0.13)
    add_poly(
        bm,
        [(0, -0.46, 0.0), (0.11, -0.62, 0.02), (0, -0.68, 0.04), (-0.11, -0.62, 0.02)],
        0.012,
    )
    s_pec(bm, 1, reach=0.14, chord=0.1)
    s_pec(bm, -1, reach=0.14, chord=0.1)
    add_tube(bm, (0, 0.42, -0.07), (0, 0.5, -0.16), 0.012, 0.006, 4)
    obj = mesh_from_bm(name, bm)
    school_paint_parts(obj, fin_if=lambda x, y, z: abs(x) > 0.1 or y < -0.44 or z > 0.14 or z < -0.1)
    return obj


def build_school_mahi(name):
    bm = bmesh.new()
    add_body(
        bm,
        [
            (-0.48, 0.004, 0.004),
            (-0.38, 0.04, 0.05),
            (-0.16, 0.09, 0.12),
            (0.08, 0.11, 0.16),
            (0.28, 0.12, 0.2),
            (0.42, 0.07, 0.12),
            (0.5, 0.02, 0.03),
        ],
        8,
        belly=0.72,
        dorsal=1.18,
    )
    add_poly(bm, [(0, 0.42, 0.12), (0, -0.08, 0.32), (0, -0.12, 0.14)], 0.012)
    s_tail(bm, fork=1.15)
    s_pec(bm, 1, reach=0.12)
    s_pec(bm, -1, reach=0.12)
    obj = mesh_from_bm(name, bm)
    school_paint_parts(obj, fin_if=lambda x, y, z: abs(x) > 0.08 or y < -0.42 or z > 0.16)
    return obj


def build_school_barracuda(name):
    bm = bmesh.new()
    add_body(
        bm,
        [
            (-0.5, 0.004, 0.004),
            (-0.4, 0.025, 0.028),
            (-0.16, 0.048, 0.052),
            (0.08, 0.055, 0.06),
            (0.3, 0.042, 0.046),
            (0.46, 0.022, 0.024),
            (0.56, 0.01, 0.01),
        ],
        8,
        belly=0.8,
        dorsal=1.04,
    )
    s_dorsal(bm, y=0.06, h=0.08, root=0.1, z0=0.06)
    s_tail(bm, y=-0.48, fork=0.85)
    s_pec(bm, 1, reach=0.08, chord=0.07)
    s_pec(bm, -1, reach=0.08, chord=0.07)
    obj = mesh_from_bm(name, bm)
    school_paint_parts(obj, fin_if=lambda x, y, z: abs(x) > 0.055 or y < -0.44 or z > 0.07)
    return obj


def build_school_billfish(name):
    bm = bmesh.new()
    add_body(
        bm,
        [
            (-0.5, 0.003, 0.003),
            (-0.38, 0.03, 0.04),
            (-0.14, 0.055, 0.08),
            (0.12, 0.06, 0.09),
            (0.34, 0.04, 0.055),
            (0.48, 0.016, 0.02),
            (0.56, 0.006, 0.006),
        ],
        8,
        belly=0.72,
        dorsal=1.1,
    )
    add_tube(bm, (0, 0.54, 0.01), (0, 1.02, 0.02), 0.012, 0.004, 5)
    add_poly(bm, [(0, 0.42, 0.08), (0, -0.18, 0.34), (0, -0.22, 0.08)], 0.01)
    s_tail(bm, y=-0.48, fork=1.18)
    s_pec(bm, 1, reach=0.1)
    s_pec(bm, -1, reach=0.1)
    obj = mesh_from_bm(name, bm)
    school_paint_parts(obj, fin_if=lambda x, y, z: abs(x) > 0.07 or y < -0.42 or z > 0.1 or y > 0.55)
    return obj


def build_school_lantern(name):
    bm = bmesh.new()
    add_body(
        bm,
        [
            (-0.48, 0.004, 0.004),
            (-0.38, 0.045, 0.05),
            (-0.16, 0.08, 0.09),
            (0.08, 0.09, 0.1),
            (0.3, 0.06, 0.07),
            (0.46, 0.02, 0.022),
        ],
        8,
        belly=0.78,
        dorsal=1.06,
    )
    s_dorsal(bm, h=0.1)
    s_tail(bm)
    s_pec(bm, 1, reach=0.1, chord=0.08)
    s_pec(bm, -1, reach=0.1, chord=0.08)
    add_eye(bm, (0.055, 0.32, 0.06), 0.045)
    add_eye(bm, (-0.055, 0.32, 0.06), 0.045)
    glow = []
    for i in range(6):
        yy = -0.28 + i * 0.09
        add_eye(bm, (0.0, yy, -0.07), 0.016)
        glow.append((0.0, yy, -0.07, 0.022))
    obj = mesh_from_bm(name, bm)
    school_paint_parts(
        obj,
        eye=[(0.055, 0.32, 0.06, 0.05), (-0.055, 0.32, 0.06, 0.05)],
        glow=glow,
        fin_if=lambda x, y, z: abs(x) > 0.08 or y < -0.42 or z > 0.11,
    )
    return obj


def build_school_krill(name):
    bm = bmesh.new()
    add_body(
        bm,
        [
            (-0.42, 0.02, 0.02),
            (-0.32, 0.045, 0.05),
            (-0.08, 0.07, 0.075),
            (0.12, 0.08, 0.085),
            (0.32, 0.055, 0.06),
            (0.42, 0.02, 0.022),
        ],
        8,
        belly=0.85,
        dorsal=1.02,
    )
    add_poly(
        bm,
        [(0, -0.4, 0.0), (0.09, -0.62, 0.02), (0, -0.7, 0.04), (-0.09, -0.62, 0.02)],
        0.01,
    )
    for i in range(3):
        y = 0.16 - i * 0.11
        for s in (1, -1):
            add_poly(
                bm,
                [(0.045 * s, y, -0.035), (0.12 * s, y + 0.04, -0.08), (0.05 * s, y - 0.05, -0.06)],
                0.008,
            )
    obj = mesh_from_bm(name, bm)
    school_paint_parts(obj, fin_if=lambda x, y, z: abs(x) > 0.07 or y < -0.4 or z < -0.05)
    return obj


def build_school_squid(name):
    bm = bmesh.new()
    add_body(
        bm,
        [
            (-0.48, 0.02, 0.02),
            (-0.38, 0.08, 0.075),
            (-0.18, 0.13, 0.12),
            (0.08, 0.12, 0.11),
            (0.38, 0.05, 0.045),
            (0.5, 0.004, 0.004),
        ],
        8,
        belly=0.92,
        dorsal=1.02,
    )
    add_poly(bm, [(0.16, 0.22, 0.0), (0.38, 0.32, 0.0), (0.16, 0.44, 0.0)], 0.012)
    add_poly(bm, [(-0.16, 0.22, 0.0), (-0.16, 0.44, 0.0), (-0.38, 0.32, 0.0)], 0.012)
    for i in range(8):
        a = (i / 8) * TAU
        x, z = math.cos(a) * 0.05, math.sin(a) * 0.04
        add_tube(bm, (x, -0.42, z), (x * 0.4, -0.92, z * 0.4), 0.012, 0.005, 4)
    add_tube(bm, (0.04, -0.42, -0.01), (0.03, -1.18, -0.02), 0.012, 0.004, 4)
    add_tube(bm, (-0.04, -0.42, -0.01), (-0.03, -1.18, -0.02), 0.012, 0.004, 4)
    obj = mesh_from_bm(name, bm)
    school_paint_parts(obj, fin_if=lambda x, y, z: abs(x) > 0.14 or y < -0.4)
    return obj


# ---------------------------------------------------------------------------
# export
# ---------------------------------------------------------------------------
def export_glb(objs, path):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.hide_set(False)
        o.hide_viewport = False
        o.location = (0.0, 0.0, 0.0)
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    kw = dict(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="PLACEHOLDER",
    )
    op = bpy.ops.export_scene.gltf
    # Blender 4/5 vertex-color enum
    try:
        op(**kw, export_vertex_color="ACTIVE")
    except TypeError:
        try:
            op(**kw, export_colors=True)
        except TypeError:
            op(**kw)
    print("wrote", path, os.path.getsize(path), "bytes")


def main():
    wipe_generated()
    reports = []

    vehicles = [
        ("shark_male", lambda n: build_shark(n, "shark"), "shark.glb"),
        ("greatwhite_male", lambda n: build_shark(n, "greatwhite"), "greatwhite.glb"),
        ("tigershark_male", lambda n: build_shark(n, "tigershark"), "tigershark.glb"),
        ("hammerhead_male", build_hammerhead, "hammerhead.glb"),
        ("whaleshark_male", build_whaleshark, "whaleshark.glb"),
        ("minke_male", build_minke, "minke.glb"),
        ("humpback_male", build_humpback, "humpback.glb"),
        ("spermwhale_male", build_spermwhale, "spermwhale.glb"),
        ("commondolphin_male", build_dolphin, "dolphin.glb"),
        ("bluefin_male", build_bluefin, "bluefin.glb"),
        ("giantsquid_male", build_giantsquid, "giantsquid.glb"),
    ]
    schools = [
        ("school_fish", build_school_fish, "school-fish.glb"),
        ("school_flying", build_school_flying, "school-flying.glb"),
        ("school_needle", build_school_needle, "school-needle.glb"),
        ("school_tuna", build_school_tuna, "school-tuna.glb"),
        ("school_cod", build_school_cod, "school-cod.glb"),
        ("school_mahi", build_school_mahi, "school-mahi.glb"),
        ("school_barracuda", build_school_barracuda, "school-barracuda.glb"),
        ("school_billfish", build_school_billfish, "school-billfish.glb"),
        ("school_lantern", build_school_lantern, "school-lantern.glb"),
        ("school_krill", build_school_krill, "school-krill.glb"),
        ("school_squid", build_school_squid, "school-squid.glb"),
    ]

    built = {}
    for name, fn, glb in vehicles + schools:
        obj = fn(name)
        built[name] = (obj, glb)
        reports.append(bbox_report(obj))

    for name, (obj, glb) in built.items():
        export_glb([obj], os.path.join(OUT, glb))

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ART, "fauna.blend"))
    for r in reports:
        print(r)
    print("done", len(reports), "meshes")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback

        traceback.print_exc()
        sys.exit(1)
