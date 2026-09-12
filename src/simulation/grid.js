/**
 * Hashed 3D grid. Rebuild is O(n); neighbor walks only touch occupied buckets.
 */
export class UniformGrid3D {
  constructor({ minX, minY, minZ, maxX, maxY, maxZ, cellSize, maxAgents }) {
    this.minX = minX;
    this.minY = minY;
    this.minZ = minZ;
    this.cellSize = cellSize;
    this.inv = 1 / cellSize;
    this.nx = Math.max(1, Math.ceil((maxX - minX) * this.inv));
    this.ny = Math.max(1, Math.ceil((maxY - minY) * this.inv));
    this.nz = Math.max(1, Math.ceil((maxZ - minZ) * this.inv));
    this.nxy = this.nx * this.ny;
    this.bucketN = 32768;
    this.mask = this.bucketN - 1;
    this.heads = new Int32Array(this.bucketN);
    this.next = new Int32Array(maxAgents);
    this.keyOf = new Int32Array(maxAgents);
    this.cellOf = this.keyOf;
    this.heads.fill(-1);
  }

  _pack(ix, iy, iz) {
    return ix + 1 + (iy + 1) * 512 + (iz + 1) * 512 * 64;
  }

  _hash(ix, iy, iz) {
    return (Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663) ^ Math.imul(iz, 83492791)) & this.mask;
  }

  rebuild(pos, count) {
    const { heads, next, keyOf, inv, minX, minY, minZ, nx, ny, nz, mask } = this;
    heads.fill(-1);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      let ix = (pos[i3] - minX) * inv | 0;
      let iy = (pos[i3 + 1] - minY) * inv | 0;
      let iz = (pos[i3 + 2] - minZ) * inv | 0;
      if (ix < 0) ix = 0;
      else if (ix >= nx) ix = nx - 1;
      if (iy < 0) iy = 0;
      else if (iy >= ny) iy = ny - 1;
      if (iz < 0) iz = 0;
      else if (iz >= nz) iz = nz - 1;
      const key = ix + 1 + (iy + 1) * 512 + (iz + 1) * 32768;
      keyOf[i] = key;
      const h = (Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663) ^ Math.imul(iz, 83492791)) & mask;
      next[i] = heads[h];
      heads[h] = i;
    }
  }
}
