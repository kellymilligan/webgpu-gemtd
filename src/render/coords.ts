import { GRID_H, GRID_W } from '../sim/data/map';

/** Sim tile space (x, y) -> world (x, 0, z). Tile centres sit at +0.5. */
export const toWorldX = (x: number) => x - GRID_W / 2;
export const toWorldZ = (y: number) => y - GRID_H / 2;
export const toTileX = (wx: number) => Math.floor(wx + GRID_W / 2);
export const toTileY = (wz: number) => Math.floor(wz + GRID_H / 2);

export const AIR_HEIGHT = 1.9;

/** Small stable hash for per-tile visual variation (not used by the sim). */
export function hash2(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
