/* ========================================================================
   elements/fire.js — Fire (Gas / Reactive) Simulation Rules
   ========================================================================
   Rises upward randomly. Ticks down a lifetime counter, then waits 1–3
   ticks before dissipating into air or smoke.
   Ignites adjacent Wood and Oil. Emits Smoke particles upward.
   ======================================================================== */

import {
  GRID_W, GRID_H, AIR, WOOD, OIL, FIRE, SMOKE,
  FIRE_LIFETIME_MIN, FIRE_LIFETIME_MAX,
  FIRE_SPREAD_CHANCE, FIRE_SMOKE_CHANCE, OIL_IGNITE_CHANCE,
  SMOKE_LIFETIME_MIN, SMOKE_LIFETIME_MAX,
  FIRE_DISSIPATING_FLAG,
  FIRE_DISSIPATION_DELAY_MIN, FIRE_DISSIPATION_DELAY_MAX,
} from "../constants.js";
import { cellId, cellLifetime, packCell, inBounds, randInt } from "../grid.js";

export function simulateFire(read, write, x, y, i, cell, isBlocked = () => false) {
  // Keep the flame visible for a short, per-particle delay after its normal
  // lifetime ends. This prevents a painted group of fire from vanishing as a
  // single synchronized block.
  if ((cell & FIRE_DISSIPATING_FLAG) !== 0) {
    const delay = cellLifetime(cell) - 1;
    if (delay <= 0) {
      if (Math.random() < 0.3) {
        write[i] = packCell(SMOKE, randInt(SMOKE_LIFETIME_MIN, SMOKE_LIFETIME_MAX));
      } else {
        write[i] = AIR;
      }
    } else {
      write[i] = packCell(FIRE, delay) | FIRE_DISSIPATING_FLAG;
    }
    return;
  }

  // Decrement lifetime
  let lifetime = cellLifetime(cell);
  lifetime--;

  if (lifetime <= 0) {
    write[i] = packCell(
      FIRE,
      randInt(FIRE_DISSIPATION_DELAY_MIN, FIRE_DISSIPATION_DELAY_MAX),
    ) | FIRE_DISSIPATING_FLAG;
    return;
  }

  // ── Spread to adjacent flammables ────────────────────────────────
  const nx8 = [x - 1, x + 1, x, x, x - 1, x + 1, x - 1, x + 1];
  const ny8 = [y, y, y - 1, y + 1, y - 1, y - 1, y + 1, y + 1];

  for (let n = 0; n < 8; n++) {
    const nx = nx8[n];
    const ny = ny8[n];

    if (!inBounds(nx, ny) || isBlocked(nx, ny, FIRE)) {
      continue;
    }

    const ni  = ny * GRID_W + nx;
    const nId = cellId(write[ni]);

    if (nId === WOOD && Math.random() < FIRE_SPREAD_CHANCE) {
      write[ni] = packCell(FIRE, randInt(FIRE_LIFETIME_MIN, FIRE_LIFETIME_MAX));
    }

    if (nId === OIL && Math.random() < OIL_IGNITE_CHANCE) {
      write[ni] = packCell(FIRE, randInt(FIRE_LIFETIME_MIN, FIRE_LIFETIME_MAX));
    }
  }

  // ── Emit smoke upward ────────────────────────────────────────────
  if (y >= 2 && Math.random() < FIRE_SMOKE_CHANCE) {
    const smokeY = y - 2;
    const smokeI = smokeY * GRID_W + x;
    if (!isBlocked(x, smokeY, SMOKE) && cellId(write[smokeI]) === AIR) {
      write[smokeI] = packCell(SMOKE, randInt(SMOKE_LIFETIME_MIN, SMOKE_LIFETIME_MAX));
    }
  }

  // ── Movement: rise upward (up, up-left, up-right) ───────────────
  const above = y - 1;
  if (above >= 0) {
    const moves = [];
    const iUp = above * GRID_W + x;

    if (!isBlocked(x, above, FIRE) && cellId(write[iUp]) === AIR) {
      moves.push(iUp);
    }
    if (inBounds(x - 1, above) && !isBlocked(x - 1, above, FIRE) && cellId(write[above * GRID_W + (x - 1)]) === AIR) {
      moves.push(above * GRID_W + (x - 1));
    }
    if (inBounds(x + 1, above) && !isBlocked(x + 1, above, FIRE) && cellId(write[above * GRID_W + (x + 1)]) === AIR) {
      moves.push(above * GRID_W + (x + 1));
    }

    if (moves.length > 0) {
      const target = moves[randInt(0, moves.length - 1)];
      write[target] = packCell(FIRE, lifetime);
      write[i] = AIR;
      return;
    }

    // Can't go up → try sideways
    const sideDir = Math.random() < 0.5 ? -1 : 1;
    const sx = x + sideDir;
    if (inBounds(sx, y) && !isBlocked(sx, y, FIRE) && cellId(write[y * GRID_W + sx]) === AIR) {
      write[y * GRID_W + sx] = packCell(FIRE, lifetime);
      write[i] = AIR;
      return;
    }
  }

  // Stayed in place — update lifetime
  write[i] = packCell(FIRE, lifetime);
}
