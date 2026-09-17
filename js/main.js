import { AIR, BUILD_SIZE, FIRE, FILTER_MATERIALS, GRID_H, GRID_W, LAVA, MACHINE_META, SAND, SIM_STEP, SPARK, STONE, WATER } from "./constants.js";
import { cellId, clearGrid, currentGrid, deserializeGrid, idx, packCell, serializeGrid, setCell } from "./grid.js";
import { canPlaceMachine, factoryStep, getConveyorDirection, getConveyorLineCells, getMachineAtCell, getSelectedMachine, getWallLineCells, isHeatedCell, isLauncherFlightCell, isMachineCell, placeConveyorLine, placeMachine, placeWallLine, removeMachineAt, restoreFactory, createStarterFactory, serializeFactory, snapBuildCell } from "./factory.js";
import { paintMaterial, seedWorld, simulateStep } from "./simulation.js";
import { canvasPoint, getCanvas, renderFrame, resizeCanvas } from "./renderer.js";

const canvas = getCanvas();
const SAVE_KEY = "dustline-factory-loop-v2";
const ui = {
  runButton: document.getElementById("run-button"), runLabel: document.getElementById("run-label"), cycle: document.getElementById("cycle-value"),
  gridButton: document.getElementById("grid-button"), gridState: document.getElementById("grid-state"), clearButton: document.getElementById("clear-button"), saveButton: document.getElementById("save-button"), resetButton: document.getElementById("reset-button"),
  inspector: document.getElementById("inspector-content"), cursor: document.getElementById("cursor-readout"), hint: document.getElementById("canvas-hint"), saveState: document.getElementById("save-state"), brushSize: document.getElementById("brush-size"), brushValue: document.getElementById("brush-value"),
};

const state = { factory: createStarterFactory(), running: true, speed: 1, gridVisible: true, tool: "select", material: "sand", brushSize: 4, pointer: null, pointerDown: false, buildStart: null, buildEnd: null, replaceOnPlace: false, selectedMachineId: "m-6", lastPaintPoint: null, lastUiAt: 0, lastSaveAt: 0 };
let lastFrameAt = 0;
let simulationAccumulator = 0;
let lastFilterInspectorKey = "";
const materialNames = new Map([[AIR, "air"], ...FILTER_MATERIALS.map(material => [material.id, material.name.toLowerCase()])]);

function updateCursorReadout(point) {
  const materialId = cellId(currentGrid()[idx(point.x, point.y)]);
  const materialName = materialNames.get(materialId) || `material ${materialId}`;
  ui.cursor.textContent = `x ${String(point.x).padStart(2, "0")} / y ${String(point.y).padStart(2, "0")} · ${materialName}`;
}

function setTool(tool) {
  state.tool = tool;
  document.querySelectorAll("[data-tool]").forEach(button => { const selected = button.dataset.tool === tool; button.classList.toggle("is-selected", selected); button.setAttribute("aria-pressed", String(selected)); });
  document.querySelectorAll("[data-material]").forEach(button => { const selected = tool === "material" && button.dataset.material === state.material; button.classList.toggle("is-selected", selected); button.setAttribute("aria-pressed", String(selected)); });
  ui.hint.textContent = tool === "material" ? `paint ${state.material} / drag to pour` : tool === "erase" ? "click a machine to remove it · move over a machine to preview" : tool === "select" ? "click an 8 × 8 bay to inspect · x then click to remove · hold ctrl to build over" : tool === "conveyor" ? "drag across bays to make a belt line" : tool === "launcher" ? "place in any bay / drag to aim" : tool === "wall" ? "drag straight for blocks or diagonally for slopes" : `place ${MACHINE_META[tool].label} / click any 8 × 8 bay`;
}

function setMaterial(material) { state.material = material; setTool("material"); }

function pointerToBuildCell(point) {
  const snapped = snapBuildCell(point.x, point.y);
  return { ...snapped, valid: state.tool !== "material" && state.tool !== "select" && canPlaceMachine(state.factory, state.tool, snapped.x, snapped.y, state.replaceOnPlace) };
}

function buildPreview() {
  if (state.tool === "erase" && state.pointer) {
    const machine = getMachineAtCell(state.factory, state.pointer.x, state.pointer.y);
    return machine ? { cells: [machine], valid: true, type: "erase" } : null;
  }
  const buildTools = ["heat-bank", "conveyor", "launcher", "melter", "filter", "wall"];
  if (!state.pointer || !buildTools.includes(state.tool)) return null;
  const end = snapBuildCell(state.pointer.x, state.pointer.y);
  const start = state.buildStart || end;
  if (["heat-bank", "melter", "filter"].includes(state.tool)) {
    const cell = pointerToBuildCell(end);
    return { cells: [cell], valid: cell.valid, type: state.tool };
  }
  if (state.tool === "conveyor") {
    const cells = getConveyorLineCells(start, end);
    return { cells, valid: cells.every(({ x, y }) => canPlaceMachine(state.factory, "conveyor", x, y, state.replaceOnPlace)), direction: getConveyorDirection(start, end) };
  }
  if (state.tool === "wall") {
    const cells = getWallLineCells(start, end);
    return { cells, valid: cells.every(({ x, y }) => canPlaceMachine(state.factory, "wall", x, y, state.replaceOnPlace)), type: "wall" };
  }
  const cell = pointerToBuildCell(start);
  return { cells: [cell], valid: cell.valid, type: "launcher", direction: end.x === start.x && end.y === start.y ? "default" : end.x < start.x ? "up-left" : "up-right" };
}

function paintBetween(a, b) {
  const dx = b.x - a.x; const dy = b.y - a.y; const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  const materialIds = { sand: SAND, water: WATER, fire: FIRE, lava: LAVA, spark: SPARK, erase: 0 };
  for (let i = 0; i <= steps; i += 1) { const x = Math.round(a.x + (dx * i) / steps); const y = Math.round(a.y + (dy * i) / steps); paintMaterial(x, y, state.brushSize, materialIds[state.material] ?? 0); }
}

function handleCanvasDown(event) {
  event.preventDefault(); canvas.setPointerCapture?.(event.pointerId); state.pointerDown = true;
  const point = canvasPoint(event); state.pointer = point; updateCursorReadout(point);
  state.replaceOnPlace = event.ctrlKey || event.metaKey;
  if (state.tool === "material") { paintBetween(point, point); state.lastPaintPoint = point; return; }
  if (["heat-bank", "conveyor", "launcher", "melter", "filter", "wall"].includes(state.tool)) { state.buildStart = snapBuildCell(point.x, point.y); state.buildEnd = state.buildStart; return; }
  const machine = getMachineAtCell(state.factory, point.x, point.y);
  if (state.tool === "select") { state.selectedMachineId = machine?.id || null; return; }
  if (state.tool === "erase") { removeMachineAt(state.factory, point.x, point.y); state.selectedMachineId = null; return; }
  const cell = pointerToBuildCell(point);
  if (cell.valid) { if (state.replaceOnPlace) removeMachineAt(state.factory, cell.x, cell.y); const placed = placeMachine(state.factory, state.tool, cell.x, cell.y); if (placed) state.selectedMachineId = placed.id; }
}

function handleCanvasMove(event) {
  const point = canvasPoint(event); state.pointer = point; updateCursorReadout(point);
  if (state.pointerDown && state.tool === "material") { paintBetween(state.lastPaintPoint || point, point); state.lastPaintPoint = point; }
  if (state.pointerDown && state.buildStart) state.buildEnd = snapBuildCell(point.x, point.y);
}

function handleCanvasUp() {
  if (state.pointerDown && state.buildStart && state.buildEnd) {
    const start = state.buildStart;
    const end = state.buildEnd;
    if (state.tool === "conveyor") {
      if (state.replaceOnPlace) startReplacement(state.factory, getConveyorLineCells(start, end));
      const placed = placeConveyorLine(state.factory, start, end, state.replaceOnPlace);
      if (placed.length) state.selectedMachineId = placed[placed.length - 1].id;
    } else if (state.tool === "wall") {
      if (state.replaceOnPlace) startReplacement(state.factory, getWallLineCells(start, end));
      const placed = placeWallLine(state.factory, start, end, state.replaceOnPlace);
      if (placed.length) state.selectedMachineId = placed[placed.length - 1].id;
    } else if (state.tool === "launcher") {
      const direction = end.x === start.x && end.y === start.y ? "default" : end.x < start.x ? "up-left" : "up-right";
      if (state.replaceOnPlace) removeMachineAt(state.factory, start.x, start.y);
      const placed = placeMachine(state.factory, "launcher", start.x, start.y, { direction });
      if (placed) state.selectedMachineId = placed.id;
    } else {
      if (state.replaceOnPlace) removeMachineAt(state.factory, start.x, start.y);
      const placed = placeMachine(state.factory, state.tool, start.x, start.y);
      if (placed) state.selectedMachineId = placed.id;
    }
  }
  state.pointerDown = false; state.lastPaintPoint = null; state.buildStart = null; state.buildEnd = null; state.replaceOnPlace = false;
}

function startReplacement(factoryState, cells) {
  const removed = new Set();
  cells.forEach(({ x, y }) => {
    const machine = getMachineAtCell(factoryState, x, y);
    if (machine && !removed.has(machine.id)) { removeMachineAt(factoryState, x, y); removed.add(machine.id); }
  });
}

function renderInspector() {
  const selected = getSelectedMachine(state.factory, state.selectedMachineId);
  if (!selected) {
    lastFilterInspectorKey = "none";
    ui.inspector.innerHTML = "<p>select a machine bay to inspect it.</p>";
    return;
  }
  const filterInspectorKey = selected.type === "filter"
    ? `${selected.id}:${selected.filterMode}:${(selected.filterMaterials || []).join(",")}`
    : "";
  if (selected.type === "filter" && filterInspectorKey === lastFilterInspectorKey) return;
  lastFilterInspectorKey = filterInspectorKey;
  const meta = MACHINE_META[selected.type];
  const progress = Math.round((selected.progress || 0) * 100);
  const heat = Math.round(selected.heat || 0);
  const status = selected.type === "filter" ? ["routing materials", "active"] : selected.type === "heat-bank" ? [heat > 0 ? "holding heat" : "empty", "active"] : selected.blocked ? ["waiting for input", "warn"] : ["processing", "active"];
  const directionLine = selected.direction ? `<div class="status-row"><span>direction</span><strong>${selected.direction}</strong></div>` : "";
  const heatLine = selected.type === "heat-bank" ? `<div class="status-row"><span>stored heat</span><strong>${heat} / ${selected.heatCapacity}</strong></div>` : `<div class="status-row"><span>machine heat</span><strong>${heat}%</strong></div>`;
  const progressLabel = selected.type === "filter" ? "filter phase" : selected.type === "heat-bank" ? "charge" : selected.type === "conveyor" ? "belt phase" : "cycle progress";
  const filterControls = selected.type === "filter" ? `<fieldset class="filter-settings"><legend>filter rule</legend><label><input type="radio" name="filter-mode" value="allow" ${selected.filterMode !== "block" ? "checked" : ""} /> allow selected</label><label><input type="radio" name="filter-mode" value="block" ${selected.filterMode === "block" ? "checked" : ""} /> block selected</label><div class="filter-actions"><button type="button" data-filter-action="select-all">select all</button><button type="button" data-filter-action="unselect-all">unselect all</button></div><div class="filter-materials">${FILTER_MATERIALS.map((material) => `<label><input type="checkbox" data-filter-material="${material.id}" ${selected.filterMaterials?.includes(material.id) ? "checked" : ""} /> ${material.name}</label>`).join("")}</div></fieldset>` : "";
  ui.inspector.innerHTML = `<p><strong>${meta.label}</strong><br />bay ${String(selected.x / BUILD_SIZE + 1).padStart(2, "0")} / ${String(selected.y / BUILD_SIZE + 1).padStart(2, "0")} · 8 x 8</p><div class="status-row"><span>status</span><strong>${status[0]}</strong></div>${directionLine}${heatLine}<div class="status-row"><span>recipe</span><strong>${meta.input}</strong></div><div class="status-row"><span>output</span><strong>${meta.output}</strong></div><div class="progress-label">${progressLabel}: ${progress}%<progress max="100" value="${progress}">${progress}%</progress></div>${filterControls}`;
  if (selected.type === "filter") {
    ui.inspector.querySelectorAll("[name='filter-mode']").forEach((input) => input.addEventListener("change", () => { selected.filterMode = input.value; lastFilterInspectorKey = `${selected.id}:${selected.filterMode}:${(selected.filterMaterials || []).join(",")}`; saveGame(); }));
    ui.inspector.querySelectorAll("[data-filter-material]").forEach((input) => input.addEventListener("change", () => { const materialId = Number(input.dataset.filterMaterial); const next = new Set(selected.filterMaterials || []); if (input.checked) next.add(materialId); else next.delete(materialId); selected.filterMaterials = [...next]; lastFilterInspectorKey = `${selected.id}:${selected.filterMode}:${selected.filterMaterials.join(",")}`; saveGame(); }));
    ui.inspector.querySelector("[data-filter-action='select-all']")?.addEventListener("click", () => { selected.filterMaterials = FILTER_MATERIALS.map((material) => material.id); renderInspector(); saveGame(); });
    ui.inspector.querySelector("[data-filter-action='unselect-all']")?.addEventListener("click", () => { selected.filterMaterials = []; renderInspector(); saveGame(); });
  }
}

function renderUi(now) {
  ui.cycle.textContent = String(state.factory.stats.cycles).padStart(4, "0");
  if (state.pointer) updateCursorReadout(state.pointer);
  renderInspector();
  state.lastUiAt = now;
}

function saveGame(manual = false) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ grid: serializeGrid(), factory: serializeFactory(state.factory), savedAt: Date.now() }));
    state.factory.stats.savedAt = Date.now(); ui.saveState.textContent = manual ? "saved" : "local";
    if (manual) window.setTimeout(() => { ui.saveState.textContent = "local"; }, 1600);
  } catch { ui.saveState.textContent = "offline"; }
}

function restoreGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    const restoredFactory = saved?.factory ? restoreFactory(saved.factory) : null;
    if (saved?.grid && restoredFactory && deserializeGrid(saved.grid)) { state.factory = restoredFactory; state.selectedMachineId = state.factory.machines[2]?.id || state.factory.machines[0]?.id || null; return true; }
  } catch { /* fall through to the starter state */ }
  seedWorld();
  return false;
}

function clearField() {
  clearGrid();
  for (let x = 0; x < GRID_W; x += 1) for (let y = GRID_H - 4; y < GRID_H; y += 1) setCell(x, y, packCell(STONE, 0));
}

function toggleRunning() {
  state.running = !state.running;
  ui.runLabel.textContent = state.running ? "running" : "paused";
  ui.runButton.setAttribute("aria-pressed", String(state.running));
}

function bindUi() {
  document.querySelectorAll("[data-tool]").forEach(button => button.addEventListener("click", () => setTool(button.dataset.tool)));
  document.querySelectorAll("[data-material]").forEach(button => button.addEventListener("click", () => setMaterial(button.dataset.material)));
  document.querySelectorAll("[data-speed]").forEach(button => button.addEventListener("click", () => { state.speed = Number(button.dataset.speed); document.querySelectorAll("[data-speed]").forEach(item => item.setAttribute("aria-pressed", String(item === button))); }));
  ui.runButton.addEventListener("click", toggleRunning);
  ui.gridButton.addEventListener("click", () => { state.gridVisible = !state.gridVisible; ui.gridState.textContent = state.gridVisible ? "on" : "off"; });
  ui.clearButton.addEventListener("click", clearField);
  ui.saveButton.addEventListener("click", () => saveGame(true));
  ui.resetButton.addEventListener("click", () => { state.factory = createStarterFactory(); state.selectedMachineId = "m-6"; state.running = true; ui.runLabel.textContent = "running"; seedWorld(); saveGame(true); });
  ui.brushSize.addEventListener("input", () => { state.brushSize = Number(ui.brushSize.value); ui.brushValue.textContent = ui.brushSize.value; });
  window.addEventListener("resize", resizeCanvas);
  canvas.addEventListener("pointerdown", handleCanvasDown); canvas.addEventListener("pointermove", handleCanvasMove); canvas.addEventListener("pointerup", handleCanvasUp); canvas.addEventListener("pointercancel", handleCanvasUp); canvas.addEventListener("pointerleave", () => { if (!state.pointerDown) state.pointer = null; });
  window.addEventListener("keydown", event => {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === " ") { event.preventDefault(); toggleRunning(); }
    if (event.key.toLowerCase() === "g") ui.gridButton.click();
    if (event.key.toLowerCase() === "e") setMaterial("erase");
    if (event.key.toLowerCase() === "x") setTool("erase");
    if (event.key === "1") setMaterial("sand"); if (event.key === "2") setMaterial("water"); if (event.key === "3") setMaterial("fire"); if (event.key === "4") setMaterial("lava"); if (event.key === "5") setMaterial("spark");
    if (event.key.toLowerCase() === "v") setTool("select"); if (event.key.toLowerCase() === "c") setTool("conveyor"); if (event.key.toLowerCase() === "l") setTool("launcher"); if (event.key.toLowerCase() === "m") setTool("melter"); if (event.key.toLowerCase() === "h") setTool("heat-bank"); if (event.key.toLowerCase() === "f") setTool("filter"); if (event.key.toLowerCase() === "w") setTool("wall");
    if (event.key === "Delete" || event.key === "Backspace") { const selected = getSelectedMachine(state.factory, state.selectedMachineId); if (selected) { removeMachineAt(state.factory, selected.x, selected.y); state.selectedMachineId = null; } }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); saveGame(true); }
  });
}

function loop(now) {
  const frameDt = lastFrameAt === 0 ? 0 : Math.min(0.1, Math.max(0, (now - lastFrameAt) / 1000));
  lastFrameAt = now;
  if (state.running) {
    for (let tick = 0; tick < state.speed; tick += 1) factoryStep(state.factory, frameDt);
    simulationAccumulator += frameDt * state.speed;
    let steps = 0;
    while (simulationAccumulator >= SIM_STEP && steps < 12) {
      simulateStep((x, y, materialId) => isMachineCell(state.factory, x, y, materialId) || isLauncherFlightCell(state.factory, x, y), (x, y) => isHeatedCell(state.factory, x, y));
      simulationAccumulator -= SIM_STEP;
      steps += 1;
    }
    if (steps === 12) simulationAccumulator = 0;
  }
  renderFrame(state.factory, { gridVisible: state.gridVisible, preview: buildPreview(), pointer: state.pointer });
  if (now - state.lastUiAt > 160) renderUi(now);
  if (now - state.lastSaveAt > 10000) { saveGame(); state.lastSaveAt = now; }
  window.requestAnimationFrame(loop);
}

bindUi();
restoreGame();
resizeCanvas();
setTool("select");
renderUi(0);
window.requestAnimationFrame(loop);
