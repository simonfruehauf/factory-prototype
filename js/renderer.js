import { AIR, BUILD_SIZE, COLORS, FIRE, GOLD, GRID_H, GRID_W, INGOT, LIQUID_GLASS, LIQUID_GOLD, QUARTZ, RESIDUE, SAND, SMOKE, STONE, STEAM, WATER, WET_SAND } from "./constants.js";
import { cellId, cellMeta, currentGrid } from "./grid.js";

const canvas = document.getElementById("sim-canvas");
canvas.width = GRID_W;
canvas.height = GRID_H;
const ctx = canvas.getContext("2d", { alpha: false });
const imageData = ctx.createImageData(GRID_W, GRID_H);
const pixels = imageData.data;
ctx.imageSmoothingEnabled = false;

const MACHINE_SPRITE_SIZE = BUILD_SIZE;
const MACHINE_SPRITES = {
  "wall-full": [0, 0],
  "wall-slope-down-right": [8, 0],
  "wall-slope-up-right": [16, 0],
  "conveyor-single-right": [0, 16],
  "conveyor-single-left": [8, 16],
  "conveyor-left-end-right": [32, 0],
  "conveyor-left-end-left": [40, 0],
  "conveyor-right-end-right": [48, 0],
  "conveyor-right-end-left": [56, 0],
  "conveyor-middle-right": [0, 8],
  "conveyor-middle-left": [8, 8],
  "heat-bank": [16, 8],
  "launcher-up-right": [24, 8],
  "launcher-up-left": [32, 8],
  "launcher-default": [40, 8],
  melter: [48, 8],
  filter: [56, 8],
  quarry: [24, 16],
  "area-counter": [40, 16],
  sifter: [48, 16],
  washer: [0, 24],
  pump: [8, 24],
  furnace: [16, 24],
  "gold-press": [24, 24],
  "quartz-press": [32, 24],
  cursor: [56, 16],
};
const machineSpriteAtlas = new Image();
let machineSpritesReady = false;
machineSpriteAtlas.addEventListener("load", () => { machineSpritesReady = true; });
machineSpriteAtlas.src = new URL("../assets/machine-sprites.png", import.meta.url).href;

const colorVariation = { [SAND]: 10, [WATER]: 7, [WET_SAND]: 8, [GOLD]: 8, [RESIDUE]: 8, [STONE]: 5, [LIQUID_GLASS]: 10, [LIQUID_GOLD]: 10, [INGOT]: 4, [QUARTZ]: 8 };
const rgbCache = Object.fromEntries(Object.entries(COLORS).map(([id, color]) => [id, color]));

export function resizeCanvas() {
  const frame = document.getElementById("canvas-wrap");
  if (!frame) return;
  const frameStyle = getComputedStyle(frame);
  const horizontalPadding = parseFloat(frameStyle.paddingLeft) + parseFloat(frameStyle.paddingRight);
  const verticalPadding = parseFloat(frameStyle.paddingTop) + parseFloat(frameStyle.paddingBottom);
  const availableWidth = frame.clientWidth - horizontalPadding;
  const availableHeight = frame.clientHeight - verticalPadding;
  const rawScale = Math.min(availableWidth / GRID_W, availableHeight / GRID_H);
  if (rawScale <= 0) return;
  // Keep integer scaling when it is close to the available size. On very
  // wide fields, using the full safe scale avoids large letterbox bands.
  const integerScale = Math.floor(rawScale);
  const scale = rawScale >= 2 && rawScale - integerScale < 0.12 ? integerScale : rawScale;
  canvas.style.width = `${Math.floor(GRID_W * scale)}px`;
  canvas.style.height = `${Math.floor(GRID_H * scale)}px`;
}

const canvasFrame = document.getElementById("canvas-wrap");
if (canvasFrame && typeof ResizeObserver !== "undefined") {
  new ResizeObserver(() => resizeCanvas()).observe(canvasFrame);
}

function clamp(value) { return Math.max(0, Math.min(255, value)); }
function pseudo(i) { const hash = (i * 2654435761) >>> 0; return [(hash & 255) / 255, ((hash >>> 8) & 255) / 255, ((hash >>> 16) & 255) / 255]; }
function conveyorSpriteKey(machine, factoryState) {
  const left = factoryState.machines.some((other) => (
    other !== machine && other.type === "conveyor" && other.y === machine.y && other.x + BUILD_SIZE === machine.x
  ));
  const right = factoryState.machines.some((other) => (
    other !== machine && other.type === "conveyor" && other.y === machine.y && machine.x + BUILD_SIZE === other.x
  ));
  const goingLeft = machine.direction === "left";
  if (!left && !right) return `conveyor-single-${goingLeft ? "left" : "right"}`;
  if (!left) return `conveyor-left-end-${goingLeft ? "left" : "right"}`;
  if (!right) return `conveyor-right-end-${goingLeft ? "left" : "right"}`;
  return `conveyor-middle-${goingLeft ? "left" : "right"}`;
}

function machineSpriteKey(machine, factoryState) {
  if (machine.type === "wall") return `wall-${machine.shape || "full"}`;
  if (machine.type === "conveyor") return conveyorSpriteKey(machine, factoryState);
  if (machine.type === "launcher") return machine.direction === "up-left"
    ? "launcher-up-left"
    : machine.direction === "up-right"
      ? "launcher-up-right"
      : "launcher-default";
  return machine.type;
}

function drawMachineSprite(machine, factoryState) {
  if (!machineSpritesReady) return false;
  const sprite = MACHINE_SPRITES[machineSpriteKey(machine, factoryState)];
  if (!sprite) return false;
  ctx.drawImage(
    machineSpriteAtlas,
    sprite[0], sprite[1], MACHINE_SPRITE_SIZE, MACHINE_SPRITE_SIZE,
    machine.x, machine.y, MACHINE_SPRITE_SIZE, MACHINE_SPRITE_SIZE,
  );
  return true;
}

function drawGrid(gridVisible) {
  if (!gridVisible) return;
  ctx.strokeStyle = "rgba(141,154,149,.17)"; ctx.lineWidth = .45; ctx.setLineDash([]);
  for (let x = BUILD_SIZE; x < GRID_W; x += BUILD_SIZE) { ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, GRID_H); ctx.stroke(); }
  for (let y = BUILD_SIZE; y < GRID_H; y += BUILD_SIZE) { ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(GRID_W, y + .5); ctx.stroke(); }
  ctx.strokeStyle = "rgba(231,164,86,.28)"; ctx.lineWidth = .7;
  ctx.strokeRect(.5, .5, GRID_W - 1, GRID_H - 1);
}

function drawMachine(machine, factoryState) {
  drawMachineSprite(machine, factoryState);
}

function previewMachine(previewCell, preview) {
  return {
    id: `preview-${previewCell.x}-${previewCell.y}`,
    type: preview.type || (previewCell.shape ? "wall" : "conveyor"),
    x: previewCell.x,
    y: previewCell.y,
    direction: preview.direction || null,
    shape: previewCell.shape || null,
  };
}

function drawBuildPreview(factoryState, preview) {
  if (!preview) return;
  if (preview.type === "erase") {
    const minX = Math.min(preview.start.x, preview.end.x);
    const minY = Math.min(preview.start.y, preview.end.y);
    const width = Math.abs(preview.end.x - preview.start.x) + BUILD_SIZE;
    const height = Math.abs(preview.end.y - preview.start.y) + BUILD_SIZE;
    const selectedMachines = factoryState.machines.filter((machine) => (
      machine.x >= minX
      && machine.x <= minX + width - BUILD_SIZE
      && machine.y >= minY
      && machine.y <= minY + height - BUILD_SIZE
    ));
    ctx.save();
    ctx.fillStyle = "rgba(190, 64, 64, .18)";
    ctx.strokeStyle = "rgba(190, 64, 64, .95)";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 2]);
    ctx.fillRect(minX, minY, width, height);
    ctx.strokeRect(minX + .5, minY + .5, width - 1, height - 1);
    ctx.setLineDash([]);
    ctx.beginPath();
    selectedMachines.forEach((machine) => {
      ctx.moveTo(machine.x + 1, machine.y + 1); ctx.lineTo(machine.x + BUILD_SIZE - 1, machine.y + BUILD_SIZE - 1);
      ctx.moveTo(machine.x + BUILD_SIZE - 1, machine.y + 1); ctx.lineTo(machine.x + 1, machine.y + BUILD_SIZE - 1);
    });
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (!preview.cells?.length) return;
  const previewMachines = preview.cells.map((cell) => previewMachine(cell, preview));
  const previewState = { ...factoryState, machines: [...factoryState.machines, ...previewMachines] };
  ctx.save();
  ctx.globalAlpha = preview.valid ? 0.58 : 0.25;
  for (const machine of previewMachines) drawMachine(machine, previewState);
  ctx.restore();
}

function drawCursor(pointer) {
  if (!machineSpritesReady || !pointer) return;
  const sprite = MACHINE_SPRITES.cursor;
  ctx.drawImage(
    machineSpriteAtlas,
    sprite[0], sprite[1], MACHINE_SPRITE_SIZE, MACHINE_SPRITE_SIZE,
    pointer.x, pointer.y, MACHINE_SPRITE_SIZE, MACHINE_SPRITE_SIZE,
  );
}

function drawClaw(claw) {
  if (!claw?.rect) return;
  ctx.save();
  for (const cell of claw.cells || []) {
    const color = COLORS[cellId(cell.value)] || COLORS[AIR];
    ctx.fillStyle = `rgb(${color[0]} ${color[1]} ${color[2]})`;
    ctx.fillRect(claw.rect.x + cell.x, claw.rect.y + cell.y, 1, 1);
  }
  if (machineSpritesReady) {
    ctx.globalAlpha = 0.34;
    const sprite = MACHINE_SPRITES["area-counter"];
    ctx.drawImage(
      machineSpriteAtlas,
      sprite[0], sprite[1], MACHINE_SPRITE_SIZE, MACHINE_SPRITE_SIZE,
      claw.rect.x, claw.rect.y, MACHINE_SPRITE_SIZE, MACHINE_SPRITE_SIZE,
    );
  }
  ctx.restore();
}

export function renderFrame(factoryState, { gridVisible = true, preview = null, pointer = null, claw = null } = {}) {
  const grid = currentGrid();
  for (let i = 0, pixel = 0; i < grid.length; i += 1, pixel += 4) {
    const cell = grid[i]; const id = cellId(cell); const base = rgbCache[id] || rgbCache[AIR]; const variation = colorVariation[id] || 0; const noise = pseudo(i);
    let r = base[0]; let g = base[1]; let b = base[2];
    if (variation) { r += (noise[0] - .5) * variation; g += (noise[1] - .5) * variation; b += (noise[2] - .5) * variation; }
    if (id === FIRE) { r = 220 + noise[0] * 30; g = 55 + noise[1] * 55; b = 35; }
    if (id === STEAM) { const fade = Math.max(.25, 1 - cellMeta(cell) / 180); r *= fade; g *= fade; b *= fade; }
    if (id === SMOKE) { const fade = Math.max(.18, 1 - cellMeta(cell) / 110); r *= fade; g *= fade; b *= fade; }
    pixels[pixel] = clamp(r); pixels[pixel + 1] = clamp(g); pixels[pixel + 2] = clamp(b); pixels[pixel + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  drawGrid(gridVisible);
  for (const machine of factoryState.machines) drawMachine(machine, factoryState);
  drawBuildPreview(factoryState, preview);
  if (claw) drawClaw(claw);
  else drawCursor(pointer);
}

export function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: Math.max(0, Math.min(GRID_W - 1, Math.floor(((event.clientX - rect.left) / rect.width) * GRID_W))), y: Math.max(0, Math.min(GRID_H - 1, Math.floor(((event.clientY - rect.top) / rect.height) * GRID_H))) };
}
export function getCanvas() { return canvas; }
