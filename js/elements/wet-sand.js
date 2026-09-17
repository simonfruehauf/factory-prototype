/*
 * Wet sand keeps the reference sand movement shape, but has a higher
 * effective density than ordinary sand and settles through it slowly.
 */
import { AIR, GRID_W, GRID_H, OIL, SAND, WATER, WET_SAND, WET_SAND_FALL_CHANCE, WET_SAND_SINK_CHANCE } from "../constants.js";
import { cellId, inBounds } from "../grid.js";

export function simulateWetSand(read, write, x, y, i, cell, isBlocked = () => false) {
  const below = y + 1;
  if (below >= GRID_H || isBlocked(x, below, WET_SAND)) return;

  const belowIndex = below * GRID_W + x;
  const belowId = cellId(write[belowIndex]);

  // It is deliberately slower than dry sand in open air.
  if (belowId === AIR) {
    if (Math.random() < WET_SAND_FALL_CHANCE) {
      write[belowIndex] = cell;
      write[i] = AIR;
    }
    return;
  }

  // Wet sand is denser than ordinary sand, water, and oil.
  if (belowId === SAND && Math.random() < WET_SAND_SINK_CHANCE) {
    const displaced = write[belowIndex];
    write[belowIndex] = cell;
    write[i] = displaced;
    return;
  }
  if (belowId === WATER || belowId === OIL) {
    const displaced = write[belowIndex];
    write[belowIndex] = cell;
    write[i] = displaced;
    return;
  }

  const leftFirst = Math.random() < 0.5;
  const directions = leftFirst ? [-1, 1] : [1, -1];
  for (const dx of directions) {
    const nx = x + dx;
    if (!inBounds(nx, below) || isBlocked(nx, below, WET_SAND)) continue;
    const target = below * GRID_W + nx;
    const targetId = cellId(write[target]);
    if (targetId === AIR && Math.random() < WET_SAND_FALL_CHANCE) {
      write[target] = cell;
      write[i] = AIR;
      return;
    }
    if (targetId === SAND && Math.random() < WET_SAND_SINK_CHANCE) {
      const displaced = write[target];
      write[target] = cell;
      write[i] = displaced;
      return;
    }
    if (targetId === WATER || targetId === OIL) {
      const displaced = write[target];
      write[target] = cell;
      write[i] = displaced;
      return;
    }
  }
}
