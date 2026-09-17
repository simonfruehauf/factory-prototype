import {
  AIR,
  GRID_H,
  GRID_W,
  MOLTEN_COOL_CHANCE,
  MOLTEN_DISPERSION_MAX,
} from "../constants.js";
import { cellId, cellLifetime, inBounds, packCell, randInt, cellFlowDirection, withFlowDirection } from "../grid.js";

// Shared dense-liquid movement for the melter outputs. A molten pixel is
// never queued in a machine: it falls, displaces lighter material, and cools
// into its solid material in the same double-buffered field.
export function simulateMolten(read, write, x, y, i, cell, finalId, swappableIds, isBlocked = () => false, coolChance = MOLTEN_COOL_CHANCE) {
  let lifetime = cellLifetime(cell);
  if (Math.random() < coolChance) lifetime -= 1;
  if (lifetime <= 0) {
    write[i] = packCell(finalId, 0);
    return;
  }

  const canDisplace = (nx, ny, nId) => (
    inBounds(nx, ny)
    && !isBlocked(nx, ny, cellId(cell))
    && (nId === AIR || swappableIds.includes(nId))
  );

  const below = y + 1;
  if (below < GRID_H && canDisplace(x, below, cellId(write[below * GRID_W + x]))) {
    const target = below * GRID_W + x;
    const nId = cellId(write[target]);
    if (nId === AIR) {
      write[target] = packCell(cellId(cell), lifetime);
      write[i] = AIR;
    } else {
      const displaced = write[target];
      write[target] = packCell(cellId(cell), lifetime);
      write[i] = displaced;
    }
    return;
  }

  const direction = cellFlowDirection(cell);
  for (const [pass, dx] of [direction, -direction].entries()) {
    const nx = x + dx;
    if (!inBounds(nx, below) || isBlocked(nx, below, cellId(cell))) continue;
    const target = below * GRID_W + nx;
    const nId = cellId(write[target]);
    if (nId !== AIR && !swappableIds.includes(nId)) continue;
    if (nId === AIR) {
      write[target] = withFlowDirection(packCell(cellId(cell), lifetime), pass === 0 ? direction : -direction);
      write[i] = AIR;
    } else {
      const displaced = write[target];
      write[target] = withFlowDirection(packCell(cellId(cell), lifetime), pass === 0 ? direction : -direction);
      write[i] = displaced;
    }
    return;
  }

  const dispersion = randInt(1, MOLTEN_DISPERSION_MAX);
  for (const dir of [direction, -direction]) {
    let best = -1;
    for (let distance = 1; distance <= dispersion; distance += 1) {
      const nx = x + dir * distance;
      if (!inBounds(nx, y) || isBlocked(nx, y, cellId(cell))) break;
      const target = y * GRID_W + nx;
      if (cellId(write[target]) !== AIR) break;
      best = target;
    }
    if (best !== -1) {
      write[best] = withFlowDirection(packCell(cellId(cell), lifetime), dir);
      write[i] = AIR;
      return;
    }
  }

  write[i] = withFlowDirection(packCell(cellId(cell), lifetime), -direction);
}
