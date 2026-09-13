import { chunkIdFromLatLon } from "./patch.js";

const CACHE_CAP = 8;

/**
 * 1 km chunk cache. This pass loads one cell and binds it.
 * Neighbour ids are stable so a later streamer can keep adjacent
 * field grids without changing keys.
 */
export class WorldStream {
  constructor() {
    this.chunks = new Map();
    this.order = [];
    this.activeKey = null;
  }

  keyOf(id) {
    return id.key || `${id.ix}:${id.iz}`;
  }

  neighbors(id) {
    return [
      { ix: id.ix - 1, iz: id.iz, key: `${id.ix - 1}:${id.iz}` },
      { ix: id.ix + 1, iz: id.iz, key: `${id.ix + 1}:${id.iz}` },
      { ix: id.ix, iz: id.iz - 1, key: `${id.ix}:${id.iz - 1}` },
      { ix: id.ix, iz: id.iz + 1, key: `${id.ix}:${id.iz + 1}` },
    ];
  }

  peek(id) {
    return this.chunks.get(this.keyOf(id));
  }

  async loadChunk(id, fetchPatch) {
    const key = this.keyOf(id);
    const hit = this.chunks.get(key);
    if (hit) {
      this._touch(key);
      return hit;
    }
    const patch = await fetchPatch(id);
    this.chunks.set(key, patch);
    this._touch(key);
    this._evict();
    return patch;
  }

  unloadChunk(id) {
    const key = this.keyOf(id);
    this.chunks.delete(key);
    this.order = this.order.filter((k) => k !== key);
    if (this.activeKey === key) this.activeKey = null;
  }

  async enter(lat, lon, fetchPatch) {
    const id = chunkIdFromLatLon(lat, lon);
    const patch = await this.loadChunk(id, fetchPatch);
    this.activeKey = this.keyOf(id);
    return patch;
  }

  _touch(key) {
    this.order = this.order.filter((k) => k !== key);
    this.order.push(key);
  }

  _evict() {
    while (this.order.length > CACHE_CAP) {
      const key = this.order.shift();
      if (key === this.activeKey) {
        this.order.push(key);
        if (this.order.length <= CACHE_CAP) break;
        continue;
      }
      this.chunks.delete(key);
    }
  }
}
