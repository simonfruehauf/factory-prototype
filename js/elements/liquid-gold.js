import { AIR, GOLD, OIL, SAND, WATER, WET_SAND } from "../constants.js";
import { simulateMolten } from "./molten.js";

export function simulateLiquidGold(read, write, x, y, i, cell, isBlocked = () => false) {
  simulateMolten(read, write, x, y, i, cell, GOLD, [AIR, OIL, SAND, WATER, WET_SAND], isBlocked);
}
