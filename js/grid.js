/* ========================================================================
   grid.js — Double-Buffered State Matrix & Cell Helpers
   ======================================================================== */

import {
  GRID_W, GRID_H, CELL_COUNT,
  ID_MASK, LIFETIME_MASK, LIFETIME_SHIFT,
  LIQUID_LEFT_FLAG, LIQUID_RIGHT_FLAG,
} from "./constants.js";

// ── Double-buffered Uint32Array grid ───────────────────────────────────

let gridA = new Uint32Array(CELL_COUNT);
let gridB = new Uint32Array(CELL_COUNT);

let current = gridA;
let next    = gridB;

/** Get the current (read) grid */
export function currentGrid() {
  return current;
}

/** Get the next (write) grid */
export function nextGrid() {
  return next;
}

/** Copy current → next as a pre-step baseline */
export function copyCurrentToNext() {
  next.set(current);
}

/** Swap read/write buffers after a simulation step */
export function swapBuffers() {
  const tmp = current;
  current = next;
  next = tmp;
}

/** Clear both buffers (all cells → Air) */
export function clearAll() {
  current.fill(0);
  next.fill(0);
}

// Names used by the factory overlay. The underlying state and buffer
// operations remain the reference implementation above.
export const clearGrid = clearAll;

/** Serialize the current grid to a base64 string for save */
export function serialize() {
  const bytes = new Uint8Array(current.buffer, current.byteOffset, current.byteLength);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Deserialize a base64 string back into the current grid */
export function deserialize(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const restored = new Uint32Array(bytes.buffer);
  if (restored.length === CELL_COUNT) {
    current.set(restored);
    next.set(restored);
    return true;
  }
  return false;
}

export const serializeGrid = serialize;
export const deserializeGrid = deserialize;

// ── Cell packing helpers ───────────────────────────────────────────────

/** Pack element ID + lifetime into a 32-bit cell value */
export function packCell(id, lifetime) {
  return (id & ID_MASK) | ((lifetime << LIFETIME_SHIFT) & LIFETIME_MASK);
}

/** Extract element ID (bits 0–7) from a cell value */
export function cellId(cellValue) {
  return cellValue & ID_MASK;
}

/** Extract lifetime (bits 8–19) from a cell value */
export function cellLifetime(cellValue) {
  return (cellValue & LIFETIME_MASK) >>> LIFETIME_SHIFT;
}

export const cellMeta = cellLifetime;

/** Read a liquid particle's persistent horizontal direction. */
export function cellFlowDirection(cellValue) {
  return (cellValue & LIQUID_LEFT_FLAG) !== 0 ? -1 : 1;
}

/** Preserve the cell payload while changing a liquid particle's direction. */
export function withFlowDirection(cellValue, direction) {
  const cleared = cellValue & ~(LIQUID_LEFT_FLAG | LIQUID_RIGHT_FLAG);
  return cleared | (direction < 0 ? LIQUID_LEFT_FLAG : LIQUID_RIGHT_FLAG);
}

// ── Coordinate helpers ─────────────────────────────────────────────────

/** Convert (x, y) to flat array index */
export function idx(x, y) {
  return y * GRID_W + x;
}

/** Check whether (x, y) is within grid bounds */
export function inBounds(x, y) {
  return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H;
}

export function getCell(x, y, grid = current) {
  return inBounds(x, y) ? grid[idx(x, y)] : 0;
}

export function setCell(x, y, value, grid = current) {
  if (inBounds(x, y)) grid[idx(x, y)] = value;
}

// ── Math helpers ───────────────────────────────────────────────────────

/** Random integer in [min, max] inclusive */
export function randInt(min, max) {
  return (Math.random() * (max - min + 1) | 0) + min;
}

/** Clamp val to [min, max] */
export function clamp(val, min, max) {
  return val < min ? min : val > max ? max : val;
}
