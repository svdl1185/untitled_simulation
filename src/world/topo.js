/** Decode quantized TopoJSON (world-atlas / Natural Earth) into lon/lat rings. */

export function topoPolygons(topology, objectName) {
  const obj = topology.objects[objectName];
  if (!obj) return [];
  const geoms = obj.geometries || [obj];
  const polygons = [];
  for (const g of geoms) {
    if (g.type === "Polygon") polygons.push(ringsOf(topology, g.arcs));
    else if (g.type === "MultiPolygon") {
      for (const poly of g.arcs) polygons.push(ringsOf(topology, poly));
    }
  }
  return polygons;
}

function ringsOf(topology, polyArcs) {
  return polyArcs.map((ring) => mergeArcs(topology, ring));
}

function mergeArcs(topology, indices) {
  const ring = [];
  for (let i = 0; i < indices.length; i++) {
    const pts = decodeArc(topology, indices[i]);
    const start = ring.length ? 1 : 0;
    for (let j = start; j < pts.length; j++) ring.push(pts[j]);
  }
  return ring;
}

function decodeArc(topology, index) {
  const reverse = index < 0;
  const arc = topology.arcs[reverse ? ~index : index];
  const tr = topology.transform;
  const sx = tr?.scale?.[0] ?? 1;
  const sy = tr?.scale?.[1] ?? 1;
  const tx = tr?.translate?.[0] ?? 0;
  const ty = tr?.translate?.[1] ?? 0;
  let x = 0;
  let y = 0;
  const pts = new Array(arc.length);
  for (let i = 0; i < arc.length; i++) {
    x += arc[i][0];
    y += arc[i][1];
    pts[i] = [x * sx + tx, y * sy + ty];
  }
  if (reverse) pts.reverse();
  return pts;
}
