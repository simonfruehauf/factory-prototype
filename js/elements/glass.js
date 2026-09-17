/* ========================================================================
   elements/glass.js — Glass (Buoyant Solid) Simulation Rules
   ========================================================================
   Glass rises through sand until it reaches the top of the granular pile.
   It does not move through air, so loose glass remains where it is placed.
   ========================================================================
 */

import { GRID_W, SAND, WET_SAND } from "../constants.js";
import { cellId } from "../grid.js";

export function simulateGlass(read, write, x, y, i, cell, isBlocked = () => false) {
  const above = y - 1;
  if (above < 0 || isBlocked(x, above, cellId(cell))) return;

  const target = above * GRID_W + x;
  const aboveId = cellId(write[target]);

  // Buoyancy only applies inside a sand pile. Glass stops at the air surface.
  if (aboveId !== SAND && aboveId !== WET_SAND) return;

  const displaced = write[target];
  write[target] = cell;
  write[i] = displaced;
}
