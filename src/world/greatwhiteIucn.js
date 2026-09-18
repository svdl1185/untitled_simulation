/** @deprecated Use wikiRange.js. Kept so older imports still resolve. */
import { wikiOccupancy, stampWikiRaster, SOUTH as _SOUTH, NORTH as _NORTH } from "./wikiRange.js";

export const SOUTH = _SOUTH;
export const NORTH = _NORTH;

export function greatwhiteOccupancy(lat, lon) {
  return wikiOccupancy("greatwhite", lat, lon);
}

export function stampGreatwhiteRaster(grid, cols, rows, south, north) {
  stampWikiRaster("greatwhite", grid, cols, rows, south, north);
}
