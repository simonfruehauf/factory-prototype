/*
 * Material update orchestration, kept close to the linked reference:
 * double-buffered baseline, alternating bottom-up sweep, element-owned rules.
 * The optional blocker callback is the only factory-layer extension.
 */
import { AIR, GRID_W, GRID_H, SAND, WATER, WET_SAND, GOLD, FIRE, WOOD, STONE, GLASS, OIL, ACID, STEAM, SMOKE, LAVA, SPARK, LIQUID_GLASS, LIQUID_GOLD, RESIDUE, GRIT, CONCENTRATE, QUARTZ, INGOT } from "./constants.js";
import { cellId, currentGrid, nextGrid, copyCurrentToNext, swapBuffers, idx, inBounds, packCell, setCell, randInt } from "./grid.js";
import { simulateSand } from "./elements/sand.js";
import { simulateWetSand } from "./elements/wet-sand.js";
import { simulateWater } from "./elements/water.js";
import { simulateFire } from "./elements/fire.js";
import { simulateWood } from "./elements/wood.js";
import { simulateStone } from "./elements/stone.js";
import { simulateGlass } from "./elements/glass.js";
import { simulateOil } from "./elements/oil.js";
import { simulateAcid } from "./elements/acid.js";
import { simulateSteam } from "./elements/steam.js";
import { simulateLava } from "./elements/lava.js";
import { simulateSpark } from "./elements/spark.js";
import { simulateLiquidGlass } from "./elements/liquid-glass.js";
import { simulateLiquidGold } from "./elements/liquid-gold.js";

let frameParity = 0;

// Sandustry's wetting reaction is a contact conversion, not a machine buffer:
// one adjacent Sand and Water become two Wet Sand pixels in place.
function resolveSandWaterContacts(read, write, isBlocked) {
  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      const i = idx(x, y);
      if (cellId(read[i]) !== SAND || cellId(write[i]) !== SAND || isBlocked(x, y, SAND)) continue;
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const nx = x + dx; const ny = y + dy;
        if (!inBounds(nx, ny) || isBlocked(nx, ny, WATER)) continue;
        const ni = idx(nx, ny);
        if (cellId(read[ni]) === WATER && cellId(write[ni]) === WATER) {
          write[i] = packCell(WET_SAND, 0);
          write[ni] = packCell(WET_SAND, 0);
          break;
        }
      }
    }
  }
}

export function simulateStep(isBlocked = () => false, isHeated = () => false) {
  const read = currentGrid();
  const write = nextGrid();
  copyCurrentToNext();
  resolveSandWaterContacts(read, write, isBlocked);

  // Same alternating scan direction as the reference project.
  const scanLTR = (frameParity & 1) === 0;
  for (let y = GRID_H - 1; y >= 0; y -= 1) {
    const xStart = scanLTR ? 0 : GRID_W - 1;
    const xEnd = scanLTR ? GRID_W : -1;
    const xStep = scanLTR ? 1 : -1;
    for (let x = xStart; x !== xEnd; x += xStep) {
      const i = y * GRID_W + x;
      const cell = read[i];
      const id = cellId(cell);
      if (id === AIR || id === WOOD || id === STONE || isBlocked(x, y, id) || cellId(write[i]) !== id) continue;
      switch (id) {
        case SAND: simulateSand(read, write, x, y, i, cell, isBlocked); break;
        case GLASS: simulateGlass(read, write, x, y, i, cell, isBlocked); break;
        case RESIDUE:
        case GRIT:
        case CONCENTRATE:
        case QUARTZ:
        case INGOT: simulateSand(read, write, x, y, i, cell, isBlocked); break;
        case WET_SAND: simulateWetSand(read, write, x, y, i, cell, isBlocked); break;
        case GOLD: simulateSand(read, write, x, y, i, cell, isBlocked); break;
        case WATER: simulateWater(read, write, x, y, i, cell, isBlocked); break;
        case FIRE: simulateFire(read, write, x, y, i, cell, isBlocked); break;
        case OIL: simulateOil(read, write, x, y, i, cell, isBlocked); break;
        case ACID: simulateAcid(read, write, x, y, i, cell, isBlocked); break;
        case STEAM:
        case SMOKE: simulateSteam(read, write, x, y, i, cell, isBlocked); break;
        case LAVA: simulateLava(read, write, x, y, i, cell, isBlocked); break;
        case SPARK: simulateSpark(read, write, x, y, i, cell, isBlocked); break;
        case LIQUID_GLASS: simulateLiquidGlass(read, write, x, y, i, cell, isBlocked, isHeated); break;
        case LIQUID_GOLD: simulateLiquidGold(read, write, x, y, i, cell, isBlocked); break;
      }
    }
  }
  swapBuffers();
  frameParity += 1;
}

export function seedWorld() {
  currentGrid().fill(packCell(AIR, 0));
  nextGrid().fill(packCell(AIR, 0));
  // The first build space is bounded by the factory layer at 80 x 80 px. A
  // small physical starter sample makes the material field useful before
  // the player has built the later machines.
  for (let y = 8; y < 12; y += 1) for (let x = 48; x < 60; x += 1) setCell(x, y, packCell(SAND, 0));
  for (let y = 8; y < 12; y += 1) for (let x = 64; x < 72; x += 1) setCell(x, y, packCell(WATER, 0));
  for (let y = 16; y < 20; y += 1) for (let x = 48; x < 56; x += 1) setCell(x, y, packCell(OIL, 0));
  for (let y = 16; y < 20; y += 1) for (let x = 64; x < 72; x += 1) setCell(x, y, packCell(ACID, 0));
  for (let y = 24; y < 27; y += 1) for (let x = 48; x < 54; x += 1) setCell(x, y, packCell(SPARK, randInt(34, 46)));
  // This is the durable heat source for the later furnace path. It sits in a
  // small stone-lined vent in the starter area so it remains available long
  // enough for the player to reach and use the heat milestone.
  for (let y = 56; y < 64; y += 1) for (let x = 24; x < 32; x += 1) setCell(x, y, packCell(LAVA, 4095));
  for (let y = 56; y <= 64; y += 1) {
    setCell(23, y, packCell(STONE, 0));
    setCell(32, y, packCell(STONE, 0));
  }
  for (let x = 24; x < 32; x += 1) setCell(x, 64, packCell(STONE, 0));
  for (let x = 2; x < GRID_W - 2; x += 1) for (let y = GRID_H - 4; y < GRID_H; y += 1) setCell(x, y, packCell(STONE, 0));
}

export function paintMaterial(x, y, brushSize, materialId, replace = false) {
  const grid = currentGrid();
  const halfBrush = Math.floor(brushSize / 2);
  for (let dy = -halfBrush; dy <= halfBrush; dy += 1) {
    for (let dx = -halfBrush; dx <= halfBrush; dx += 1) {
      const gx = x + dx; const gy = y + dy;
      if (!inBounds(gx, gy) || dx * dx + dy * dy > halfBrush * halfBrush + 1) continue;
      const i = idx(gx, gy);
      if (materialId === AIR) grid[i] = packCell(AIR, 0);
      else if (replace || cellId(grid[i]) === AIR) {
        const lifetime = materialId === FIRE ? 60 : materialId === LAVA ? 220 : materialId === SPARK ? randInt(34, 46) : 0;
        grid[i] = packCell(materialId, lifetime);
      }
    }
  }
}
