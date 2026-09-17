import {
  AIR, GRID_W, GRID_H, SPARK,
  SPARK_DISSIPATING_FLAG,
  SPARK_DISSIPATION_DELAY_MIN, SPARK_DISSIPATION_DELAY_MAX,
} from "../constants.js";
import { cellId, cellLifetime, inBounds, packCell, randInt } from "../grid.js";

export function simulateSpark(read, write, x, y, i, cell, isBlocked = () => false) {
  // Keep each spark visible for a short, per-particle delay after its normal
  // lifetime ends so a group does not disappear as one synchronized block.
  if ((cell & SPARK_DISSIPATING_FLAG) !== 0) {
    const delay = cellLifetime(cell) - 1;
    write[i] = delay <= 0
      ? AIR
      : packCell(SPARK, delay) | SPARK_DISSIPATING_FLAG;
    return;
  }

  let lifetime = cellLifetime(cell) - 1;
  if (lifetime <= 0) {
    write[i] = packCell(
      SPARK,
      randInt(SPARK_DISSIPATION_DELAY_MIN, SPARK_DISSIPATION_DELAY_MAX),
    ) | SPARK_DISSIPATING_FLAG;
    return;
  }

  const candidates = [[x, y - 1], [x - 1, y - 1], [x + 1, y - 1]];
  for (const [nx, ny] of candidates.sort(() => Math.random() - 0.5)) {
    if (!inBounds(nx, ny) || isBlocked(nx, ny, SPARK)) continue;
    const target = ny * GRID_W + nx;
    if (cellId(write[target]) !== AIR) continue;
    write[target] = packCell(SPARK, lifetime);
    write[i] = AIR;
    return;
  }
  // A blocked spark still ages. Do not refresh its lifetime here, otherwise
  // sparks trapped against a surface never dissipate.
  write[i] = packCell(SPARK, lifetime);
}
