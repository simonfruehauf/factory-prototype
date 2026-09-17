import { AIR, GLASS, GRID_H, GRID_W, LIQUID_GLASS_LIFETIME, OIL, SAND, WATER, WET_SAND } from "../constants.js";
import { cellId, cellLifetime, packCell } from "../grid.js";
import { simulateMolten } from "./molten.js";

export function simulateLiquidGlass(read, write, x, y, i, cell, isBlocked = () => false, isHeated = () => false) {
  const below = y + 1;
  let lifetime = cellLifetime(cell);
  if (below < GRID_H && isHeated(x, below)) lifetime = LIQUID_GLASS_LIFETIME;
  if (lifetime <= 0) {
    write[i] = packCell(GLASS, 0);
    return;
  }
  cell = packCell(cellId(cell), lifetime);
  const above = y - 1;
  if (above >= 0 && !isBlocked(x, above, cellId(cell))) {
    const target = above * GRID_W + x;
    const aboveId = cellId(write[target]);
    if (aboveId === GLASS || aboveId === SAND || aboveId === WET_SAND) {
      const displaced = write[target];
      write[target] = cell;
      write[i] = displaced;
      return;
    }
  }

  // Once it reaches the surface, liquid glass rests on sand instead of
  // sinking back into the pile through the molten-liquid rule.
  if (below < GRID_H) {
    const belowId = cellId(write[below * GRID_W + x]);
    if (belowId === SAND || belowId === WET_SAND) return;
  }

  simulateMolten(read, write, x, y, i, cell, GLASS, [AIR, WATER, OIL], isBlocked, 1);
}
