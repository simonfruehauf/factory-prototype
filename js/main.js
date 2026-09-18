import {
  ACID,
  AIR,
  BUILD_SIZE,
  CONCENTRATE,
  ELEMENTS,
  FIRE,
  FILTER_MATERIALS,
  GOLD,
  GRID_H,
  GRID_W,
  GRIT,
  INGOT,
  LAVA,
  LIQUID_GLASS,
  LIQUID_GOLD,
  MACHINE_META,
  OIL,
  QUARTZ,
  RESIDUE,
  SAND,
  SIM_STEP,
  SMOKE,
  SPARK,
  STONE,
  STEAM,
  WATER,
  WET_SAND,
  WOOD,
  GLASS,
} from "./constants.js";
import { cellId, clearGrid, currentGrid, deserializeGrid, idx, packCell, serializeGrid, setCell } from "./grid.js";
import {
  canPlaceMachine,
  buyAreaExpansion,
  createStarterFactory,
  factoryStep,
  getAreaConnectedCount,
  getAreaMaterialTotal,
  getConveyorDirection,
  getConveyorLineCells,
  getMachineAtCell,
  getPressPartner,
  getWallAreaCells,
  getSelectedMachine,
  getExpansionCost,
  getWallLineCells,
  isAreaBoundaryCell,
  isHeatedCell,
  isLauncherFlightCell,
  isMachineCell,
  isToolUnlocked,
  placeConveyorLine,
  placeMachine,
  placeWallArea,
  placeWallLine,
  removeMachineAt,
  restoreFactory,
  serializeFactory,
  snapBuildCell,
} from "./factory.js";
import { paintMaterial, seedWorld, simulateStep } from "./simulation.js";
import { canvasPoint, getCanvas, renderFrame, resizeCanvas } from "./renderer.js";

const canvas = getCanvas();
const SAVE_KEY = "dustline-factory-loop-v4";
const LEGACY_SAVE_KEYS = ["dustline-factory-loop-v3", "dustline-factory-loop-v2"];
const ui = {
  runButton: document.getElementById("run-button"), runLabel: document.getElementById("run-label"),
  gridButton: document.getElementById("grid-button"), gridState: document.getElementById("grid-state"), clearButton: document.getElementById("clear-button"), saveButton: document.getElementById("save-button"), resetButton: document.getElementById("reset-button"),
  inspector: document.getElementById("inspector-content"), progression: document.getElementById("progression-content"), placementMode: document.getElementById("placement-mode"), cursor: document.getElementById("cursor-readout"), hint: document.getElementById("canvas-hint"), saveState: document.getElementById("save-state"),
  counterMaterial: document.getElementById("counter-material"), areaGrid: document.getElementById("area-grid"), areaSize: document.getElementById("area-size"), areaPixels: document.getElementById("area-pixels"), fieldMeta: document.getElementById("field-meta"), fieldZoneLabel: document.getElementById("field-zone-label"), goldStock: document.getElementById("gold-stock"), expandArea: document.getElementById("expand-area"), resources: document.getElementById("resource-list"), resourceSection: document.querySelector(".resource-section"),
  canvasWrap: document.getElementById("canvas-wrap"), canvasPaused: document.getElementById("canvas-paused"), statusCopy: document.getElementById("status-copy"), fieldState: document.getElementById("field-state"), cycleReadout: document.getElementById("cycle-readout"), producedReadout: document.getElementById("produced-readout"), targetReadout: document.getElementById("target-readout"), eventFeed: document.getElementById("event-feed"), eventCount: document.getElementById("event-count"), toolCount: document.getElementById("tool-count"), onboarding: document.getElementById("onboarding-card"), onboardingDismiss: document.getElementById("onboarding-dismiss"),
};

const PROGRESSION_MATERIALS = [
  [RESIDUE, "residue"],
  [GRIT, "grit"],
  [CONCENTRATE, "concentrate"],
  [QUARTZ, "quartz"],
  [GOLD, "gold"],
  [INGOT, "ingot"],
];
const MILESTONES = [
  { id: "residue", label: "residue", material: RESIDUE, threshold: 24, unlocks: ["sifter", "filter"] },
  { id: "grit", label: "grit", material: GRIT, threshold: 16, unlocks: ["washer", "pump"] },
  { id: "concentrate", label: "concentrate", material: CONCENTRATE, threshold: 8, unlocks: ["furnace", "heat-bank", "melter"] },
  { id: "quartz", label: "quartz", material: QUARTZ, threshold: 8, unlocks: ["gold-press", "quartz-press"] },
  { id: "ingot", label: "ingot block", material: INGOT, threshold: 1, unlocks: [] },
];
const TOOL_KEYS = { quarry: "q", "spark-generator": "j", "area-counter": "a", claw: "o", conveyor: "c", wall: "w", sifter: "s", washer: "u", pump: "p", furnace: "n", "gold-press": "g", "quartz-press": "z", "heat-bank": "h", filter: "f", launcher: "l", melter: "m", eyedropper: "i" };
const BUILD_TOOLS = ["quarry", "spark-generator", "area-counter", "conveyor", "wall", "sifter", "washer", "pump", "furnace", "gold-press", "quartz-press", "heat-bank", "launcher", "melter", "filter"];
const PLACEMENT_MODE_OPTIONS = { wall: ["line", "area"], "area-counter": ["single", "area"] };
const PLACEMENT_MODE_LABELS = { line: "line", area: "bulk area", single: "single bay" };
const RESOURCE_GROUPS = [
  { id: "solid", label: "solids", items: [
    [SAND, "sand", "brush"], [WOOD, "wood", "brush"], [STONE, "stone", "brush"], [GLASS, "glass", "cooled liquid glass"], [WET_SAND, "wet sand", "sand + water"], [GOLD, "gold", "furnace"], [RESIDUE, "residue", "quarry"], [GRIT, "grit", "sifter"], [CONCENTRATE, "concentrate", "sifter"], [QUARTZ, "quartz", "washer"], [INGOT, "ingot", "paired presses"],
  ] },
  { id: "fluid", label: "fluids", items: [
    [WATER, "water", "pump"], [OIL, "oil", "brush"], [ACID, "acid", "brush"], [LAVA, "lava", "brush"], [LIQUID_GLASS, "liquid glass", "melter + heat"], [LIQUID_GOLD, "liquid gold", "melter + heat"],
  ] },
  { id: "gas", label: "gases", items: [
    [FIRE, "fire", "brush / lava"], [STEAM, "steam", "hot water"], [SMOKE, "smoke", "fire"], [SPARK, "spark", "brush"],
  ] },
];
const COUNTER_MATERIALS = RESOURCE_GROUPS.flatMap((group) => group.items.map(([id, name]) => [id, name]));
const MATERIAL_SWATCHES = new Map(FILTER_MATERIALS.map((material) => [material.id, material.color]));
const MATERIAL_ROUTES = new Map(RESOURCE_GROUPS.flatMap((group) => group.items.map(([id, , route]) => [id, route])));
const materialNames = new Map([[AIR, "air"], ...FILTER_MATERIALS.map((material) => [material.id, material.name.toLowerCase()]), ...PROGRESSION_MATERIALS]);
const DEBUG_MATERIALS = new Map();
DEBUG_MATERIALS.set("air", AIR);
for (const material of [...ELEMENTS, ...FILTER_MATERIALS]) {
  DEBUG_MATERIALS.set(material.name.toLowerCase(), material.id);
}
const state = { factory: createStarterFactory(), running: true, speed: 1, gridVisible: true, tool: "select", materialId: SAND, placementMode: { wall: "line", "area-counter": "area" }, placementPreset: null, presetArmed: false, pointer: null, pointerDown: false, buildStart: null, buildEnd: null, selection: null, clipboard: null, replaceOnPlace: false, claw: null, selectedMachineId: "m-1", lastUiAt: 0, lastSaveAt: 0, lastToolAvailabilityKey: "", lastInspectorKey: "", lastAreaKey: "", lastResourceKey: "", lastProgressionKey: "", lastProducedByMaterial: {}, lastMilestoneKey: "", lastResonancePulses: 0, lastEvent: "field initialized", eventDetail: "ready for input", onboardingDismissed: false };
let lastFrameAt = 0;
let simulationAccumulator = 0;

function flashField(kind = "is-flashed") {
  if (!ui.canvasWrap) return;
  ui.canvasWrap.classList.remove("is-flashed", "is-blocked");
  void ui.canvasWrap.offsetWidth;
  ui.canvasWrap.classList.add(kind);
  window.setTimeout(() => ui.canvasWrap?.classList.remove(kind), kind === "is-blocked" ? 700 : 340);
}

function emitEvent(message, detail = "") {
  state.lastEvent = message;
  state.eventDetail = detail;
  if (ui.eventFeed) ui.eventFeed.textContent = message;
  if (ui.eventCount) ui.eventCount.textContent = detail;
  flashField();
}

function setRunPresentation() {
  ui.runLabel.textContent = state.running ? "running" : "paused";
  ui.runButton.setAttribute("aria-pressed", String(state.running));
  ui.canvasWrap?.classList.toggle("is-paused", !state.running);
  ui.canvasPaused?.setAttribute("aria-hidden", String(state.running));
  if (ui.statusCopy) ui.statusCopy.textContent = state.running ? "line online" : "line paused";
  if (ui.fieldState) ui.fieldState.textContent = state.running ? `${state.speed}x live field` : "manual field";
}

function setEventBaseline() {
  const produced = state.factory.stats?.produced || {};
  state.lastProducedByMaterial = { ...produced };
  state.lastMilestoneKey = (state.factory.progression?.completedMilestones || []).join(",");
  state.lastResonancePulses = state.factory.resonance?.pulses || 0;
}

function syncProductionSignals() {
  const stats = state.factory.stats || {};
  const produced = stats.produced || {};
  const changes = Object.entries(produced).map(([id, amount]) => [Number(id), (amount || 0) - (state.lastProducedByMaterial[id] || 0)]).filter(([, amount]) => amount > 0);
  if (changes.length) {
    const [materialId, amount] = changes.sort((a, b) => b[1] - a[1])[0];
    emitEvent(`output +${amount}`, `${materialLabel(materialId)} cells moved through the line`);
    state.lastProducedByMaterial = { ...produced };
  }
  const milestoneKey = (state.factory.progression?.completedMilestones || []).join(",");
  if (milestoneKey !== state.lastMilestoneKey) {
    const newMilestone = (state.factory.progression?.completedMilestones || []).find((id) => !state.lastMilestoneKey.split(",").includes(id));
    const milestone = MILESTONES.find((item) => item.id === newMilestone);
    if (milestone) emitEvent(`unlock: ${milestone.label}`, `${milestone.unlocks.length ? milestone.unlocks.join(" + ") : "prototype complete"} now available`);
    state.lastMilestoneKey = milestoneKey;
  }
  const pulses = state.factory.resonance?.pulses || 0;
  if (pulses > state.lastResonancePulses) {
    emitEvent("quarry overclock", "24 matching cells doubled quarry speed for 5 seconds");
    state.lastResonancePulses = pulses;
  }
}

function updateCursorReadout(point) {
  const materialId = cellId(currentGrid()[idx(point.x, point.y)]);
  const clawText = state.claw?.active ? ` · holding ${state.claw.cells.length} ${materialNames.get(state.claw.materialId) || `material ${state.claw.materialId}`}` : "";
  ui.cursor.textContent = `x ${String(point.x).padStart(3, "0")} / y ${String(point.y).padStart(3, "0")} · ${materialNames.get(materialId) || `material ${materialId}`}${clawText}`;
}

function canPaintMaterials(materialId = state.materialId) {
  const progression = state.factory.progression;
  return progression?.mode === "legacy" || progression?.completed === true;
}

function setTool(tool) {
  if (BUILD_TOOLS.includes(tool) && !isToolUnlocked(state.factory, tool)) return;
  if (tool === "paint" && !canPaintMaterials()) return;
  if (state.tool === "claw" && tool !== "claw") releaseClaw(state.pointer);
  if (state.clipboard?.machines?.length && tool !== "select") state.clipboard = null;
  if (!state.presetArmed && state.tool !== tool) state.placementPreset = null;
  state.tool = tool;
  document.querySelectorAll("[data-tool]").forEach((button) => {
    const selected = button.dataset.tool === tool;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  ui.hint.textContent = state.clipboard?.machines?.length && tool === "select"
    ? "move the copied bays into place · click to drop · esc to cancel"
    : tool === "erase"
    ? "drag across bays to remove machines"
    : tool === "select"
      ? "click to inspect · drag across bays to select · ctrl+c copy · ctrl+x cut"
      : tool === "conveyor"
        ? "drag across bays to make a belt line"
      : tool === "wall"
          ? state.placementMode.wall === "area" ? "drag a rectangle to fill with wall bays" : "drag horizontal, vertical, or 45° diagonal"
          : tool === "claw"
            ? "hold on a material, move the claw, release to drop it"
      : tool === "area-counter"
            ? state.placementMode["area-counter"] === "area" ? "drag a rectangle · every bay uses the selected material" : "click an 8 × 8 bay to place an area counter"
          : tool === "paint"
            ? `paint ${materialLabel(state.materialId)} into the field`
          : tool === "eyedropper"
            ? "click a machine to copy its type and settings"
          : tool === "launcher"
            ? "place in any bay / drag to aim"
            : `place ${MACHINE_META[tool]?.label || tool} / click an 8 × 8 bay`;
  renderPlacementMode();
  renderToolAvailability();
  if (ui.statusCopy && ui.fieldState && state.running) {
    ui.statusCopy.textContent = tool === "select" ? "line online" : `${MACHINE_META[tool]?.label || tool} armed`;
    ui.fieldState.textContent = tool === "select" ? `${state.speed}x live field` : "click field to place";
  }
}

function renderPlacementMode() {
  const options = PLACEMENT_MODE_OPTIONS[state.tool];
  const hasPreset = state.placementPreset?.type === state.tool;
  if (!options && !hasPreset) {
    ui.placementMode.hidden = true;
    ui.placementMode.innerHTML = "";
    return;
  }
  const mode = state.placementMode[state.tool];
  ui.placementMode.hidden = false;
  const counterOptions = COUNTER_MATERIALS.map(([id, name]) => `<option value="${id}" ${Number(state.factory.progression?.selectedMaterial) === id ? "selected" : ""}>${name}</option>`).join("");
  const counterSelect = state.tool === "area-counter"
    ? `<label class="placement-select">count <select id="counter-material">${counterOptions}</select></label>`
    : "";
  const preset = hasPreset
    ? `<small class="placement-preset">copied settings${state.tool === "filter" ? " · filter list included" : ""}</small>`
    : "";
  const modeControls = options ? `<div role="group" aria-label="${MACHINE_META[state.tool].label} placement mode">${options.map((option) => `<button type="button" data-placement-mode="${option}" aria-pressed="${String(option === mode)}">${PLACEMENT_MODE_LABELS[option]}</button>`).join("")}</div>` : "";
  ui.placementMode.innerHTML = `<span>placement</span>${counterSelect}${modeControls}${preset}`;
  ui.placementMode.querySelector("#counter-material")?.addEventListener("change", (event) => {
    state.factory.progression.selectedMaterial = Number(event.target.value);
    state.lastInspectorKey = "";
    saveGame();
  });
  ui.placementMode.querySelectorAll("[data-placement-mode]").forEach((button) => button.addEventListener("click", () => {
    setPlacementMode(state.tool, button.dataset.placementMode);
  }));
}

function setPlacementMode(tool, mode) {
  if (!PLACEMENT_MODE_OPTIONS[tool]?.includes(mode)) return;
  state.placementMode[tool] = mode;
  setTool(tool);
}

function placementOptions(type) {
  const preset = state.placementPreset;
  if (type === "area-counter") return { areaMaterial: preset?.areaMaterial || state.factory.progression.selectedMaterial || RESIDUE };
  if (!preset || preset.type !== type) return {};
  if (type === "filter") {
    return { filterMode: preset.filterMode, filterMaterials: [...(preset.filterMaterials || [])] };
  }
  if (type === "launcher" || type === "conveyor") return { direction: preset.direction };
  if (type === "wall") return { shape: preset.shape };
  return {};
}

function pickMachine(point) {
  const machine = getMachineAtCell(state.factory, point.x, point.y);
  if (!machine) {
    ui.hint.textContent = "eyedropper found no machine here · click an 8 × 8 bay";
    return false;
  }
  state.placementPreset = {
    type: machine.type,
    direction: machine.direction,
    shape: machine.shape,
    areaMaterial: machine.areaMaterial,
    filterMode: machine.filterMode,
    filterMaterials: [...(machine.filterMaterials || [])],
  };
  if (machine.type === "area-counter") state.factory.progression.selectedMaterial = machine.areaMaterial || RESIDUE;
  state.presetArmed = true;
  setTool(machine.type);
  state.presetArmed = false;
  ui.hint.textContent = `copied ${MACHINE_META[machine.type]?.label || machine.type} · place it again${machine.type === "filter" ? " with its filter settings" : ""}`;
  saveGame();
  return true;
}

function selectMaterial(materialId) {
  if (!canPaintMaterials(materialId)) {
    ui.hint.textContent = "that material unlocks after the production route is complete";
    return;
  }
  state.materialId = Number(materialId);
  state.placementPreset = null;
  setTool("paint");
  ui.hint.textContent = `paint ${materialLabel(state.materialId)} · drag across the field`;
  emitEvent(`${materialLabel(state.materialId)} brush armed`, "drag across the field to paint a reaction");
}

function renderToolAvailability() {
  const progression = state.factory.progression || {};
  const readyTools = ["select", "eyedropper", "erase", "claw", ...BUILD_TOOLS].filter((tool, index, list) => list.indexOf(tool) === index && (!BUILD_TOOLS.includes(tool) || isToolUnlocked(state.factory, tool))).length;
  if (ui.toolCount) ui.toolCount.textContent = `${readyTools} ready`;
  const key = `${progression.mode}:${(progression.unlockedTools || []).join(",")}`;
  if (key === state.lastToolAvailabilityKey) return;
  state.lastToolAvailabilityKey = key;
  document.querySelectorAll("[data-tool]").forEach((button) => {
    const type = button.dataset.tool;
    const unlocked = !BUILD_TOOLS.includes(type) || isToolUnlocked(state.factory, type);
    button.disabled = !unlocked;
    button.setAttribute("aria-disabled", String(!unlocked));
    const key = TOOL_KEYS[type];
    const small = button.querySelector("small");
    if (small && type !== "select" && type !== "erase") {
      const requirement = MILESTONES.find((milestone) => milestone.unlocks.includes(type));
      const modeHint = type === "wall"
        ? `line / area (${key.toUpperCase()} / Shift+${key.toUpperCase()})`
        : type === "area-counter"
          ? `bulk / single (${key.toUpperCase()} / Shift+${key.toUpperCase()})`
          : type === "spark-generator"
            ? `creates sparks / ${key.toUpperCase()}`
          : type === "claw"
            ? `pick up / ${key.toUpperCase()}`
          : type === "eyedropper"
            ? `copy + preset / ${key.toUpperCase()}`
          : `place / ${key.toUpperCase()}`;
      small.textContent = unlocked ? modeHint : `locked · ${requirement ? `${requirement.threshold} ${requirement.label}` : key.toUpperCase()}`;
    }
  });
}

function pointerToBuildCell(point) {
  const snapped = snapBuildCell(point.x, point.y);
  return { ...snapped, valid: BUILD_TOOLS.includes(state.tool) && canPlaceMachine(state.factory, state.tool, snapped.x, snapped.y, state.replaceOnPlace) };
}

function selectionBounds(start, end) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x) + BUILD_SIZE,
    height: Math.abs(end.y - start.y) + BUILD_SIZE,
  };
}

function machinesInSelection(start, end) {
  const bounds = selectionBounds(start, end);
  return state.factory.machines.filter((machine) => (
    machine.x >= bounds.x
    && machine.x < bounds.x + bounds.width
    && machine.y >= bounds.y
    && machine.y < bounds.y + bounds.height
  ));
}

function machineClipboardOptions(machine) {
  const options = {};
  if (machine.direction) options.direction = machine.direction;
  if (machine.shape) options.shape = machine.shape;
  if (machine.type === "area-counter") options.areaMaterial = machine.areaMaterial;
  if (machine.type === "filter") {
    options.filterMode = machine.filterMode;
    options.filterMaterials = [...(machine.filterMaterials || [])];
  }
  return options;
}

function copySelection(cut = false) {
  if (!state.selection) {
    emitEvent("nothing selected", "drag across machine bays in inspect mode first");
    return false;
  }
  const bounds = selectionBounds(state.selection.start, state.selection.end);
  const machines = machinesInSelection(state.selection.start, state.selection.end);
  if (!machines.length) {
    emitEvent("nothing selected", "drag across occupied bays in inspect mode first");
    return false;
  }
  state.clipboard = {
    mode: cut ? "cut" : "copy",
    width: bounds.width,
    height: bounds.height,
    machines: machines.map((machine) => ({
      type: machine.type,
      x: machine.x - bounds.x,
      y: machine.y - bounds.y,
      options: machineClipboardOptions(machine),
    })),
  };
  if (cut) {
    const ids = new Set(machines.map((machine) => machine.id));
    state.factory.machines = state.factory.machines.filter((machine) => !ids.has(machine.id));
    state.factory.flights = (state.factory.flights || []).filter((flight) => !ids.has(flight.launcherId));
    state.selection = null;
    state.selectedMachineId = null;
  }
  setTool("select");
  emitEvent(cut ? `cut ${machines.length} machine${machines.length === 1 ? "" : "s"}` : `copied ${machines.length} machine${machines.length === 1 ? "" : "s"}`, "move the ghost and click to place");
  if (cut) saveGame();
  return true;
}

function clipboardCellsAt(origin) {
  if (!state.clipboard) return [];
  return state.clipboard.machines.map((machine) => ({
    x: origin.x + machine.x,
    y: origin.y + machine.y,
    type: machine.type,
    options: machine.options,
  }));
}

function clipboardPlacement(origin) {
  const cells = clipboardCellsAt(origin);
  return {
    cells,
    valid: cells.length > 0 && cells.every((cell) => canPlaceMachine(state.factory, cell.type, cell.x, cell.y)),
  };
}

function placeClipboard() {
  if (!state.clipboard || !state.pointer) return false;
  const origin = snapBuildCell(state.pointer.x, state.pointer.y);
  const placement = clipboardPlacement(origin);
  if (!placement.valid) {
    emitEvent("paste blocked", "move the ghost to empty bays inside the active zone");
    flashField("is-blocked");
    ui.hint.textContent = "paste blocked · move the ghost to empty bays inside the active zone";
    return false;
  }
  const placed = placement.cells.map((cell) => placeMachine(state.factory, cell.type, cell.x, cell.y, cell.options));
  if (placed.some((machine) => !machine)) {
    emitEvent("paste blocked", "the selected bays changed before placement completed");
    flashField("is-blocked");
    return false;
  }
  state.selectedMachineId = placed[placed.length - 1]?.id || null;
  const wasCut = state.clipboard.mode === "cut";
  if (wasCut) state.clipboard = null;
  state.selection = null;
  setTool("select");
  emitEvent(`placed ${placed.length} copied machine${placed.length === 1 ? "" : "s"}`, wasCut ? "cut selection moved to the new bays" : "copy remains ready for another placement");
  saveGame();
  return true;
}

function getBuildAreaCells(start, end) {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  const cells = [];
  for (let y = minY; y <= maxY; y += BUILD_SIZE) {
    for (let x = minX; x <= maxX; x += BUILD_SIZE) cells.push({ x, y });
  }
  return cells;
}

function getWallPlacementCells(start, end) {
  return state.placementMode.wall === "area" ? getWallAreaCells(start, end) : getWallLineCells(start, end);
}

function getClawRect(point) {
  return {
    x: Math.max(0, Math.min(GRID_W - BUILD_SIZE, point.x)),
    y: Math.max(0, Math.min(GRID_H - BUILD_SIZE, point.y)),
  };
}

function pickupClaw(point) {
  const rect = getClawRect(point);
  const grid = currentGrid();
  const centerX = rect.x + Math.floor(BUILD_SIZE / 2);
  const centerY = rect.y + Math.floor(BUILD_SIZE / 2);
  const materialId = cellId(grid[idx(centerX, centerY)]);
  if (materialId === AIR) return false;
  const cells = [];
  for (let y = 0; y < BUILD_SIZE; y += 1) {
    for (let x = 0; x < BUILD_SIZE; x += 1) {
      const value = grid[idx(rect.x + x, rect.y + y)];
      if (cellId(value) !== materialId) continue;
      cells.push({ x, y, value });
    }
  }
  if (!cells.length) return false;
  for (const cell of cells) grid[idx(rect.x + cell.x, rect.y + cell.y)] = packCell(AIR, 0);
  state.claw = { active: true, materialId, rect, cells };
  return true;
}

function releaseClaw(point) {
  if (!state.claw?.active) {
    state.claw = null;
    return true;
  }
  const rect = getClawRect(point || state.pointer || state.claw.rect);
  const grid = currentGrid();
  const empty = [];
  for (let y = 0; y < BUILD_SIZE; y += 1) {
    for (let x = 0; x < BUILD_SIZE; x += 1) {
      if (cellId(grid[idx(rect.x + x, rect.y + y)]) === AIR) empty.push({ x, y });
    }
  }
  if (empty.length < state.claw.cells.length) {
    state.claw.blocked = true;
    ui.hint.textContent = "not enough empty space here · move the claw and release again";
    emitEvent("claw blocked", "not enough empty space at the drop point");
    return false;
  }
  const byOffset = new Map(empty.map((cell) => [`${cell.x},${cell.y}`, cell]));
  for (const held of state.claw.cells) {
    const matching = byOffset.get(`${held.x},${held.y}`);
    const destination = matching || empty.shift();
    byOffset.delete(`${destination.x},${destination.y}`);
    const emptyIndex = empty.findIndex((cell) => cell.x === destination.x && cell.y === destination.y);
    if (emptyIndex >= 0) empty.splice(emptyIndex, 1);
    grid[idx(rect.x + destination.x, rect.y + destination.y)] = held.value;
  }
  state.claw = null;
  ui.hint.textContent = "hold on a material, move the claw, release to drop it";
  emitEvent("claw dropped batch", "material returned to the field");
  return true;
}

function clawRenderState() {
  if (state.tool !== "claw" || !state.pointer) return null;
  return {
    rect: getClawRect(state.pointer),
    cells: state.claw?.active ? state.claw.cells : [],
  };
}

function buildPreview() {
  if (state.tool === "select" && state.clipboard?.machines?.length && state.pointer) {
    const origin = snapBuildCell(state.pointer.x, state.pointer.y);
    const placement = clipboardPlacement(origin);
    return { type: "clipboard", origin, width: state.clipboard.width, height: state.clipboard.height, cells: placement.cells, valid: placement.valid, mode: state.clipboard.mode };
  }
  if (state.tool === "select" && state.buildStart && state.buildEnd) {
    const bounds = selectionBounds(state.buildStart, state.buildEnd);
    return { type: "selection", start: state.buildStart, end: state.buildEnd, bounds, valid: true };
  }
  if (state.tool === "select" && state.selection) {
    const bounds = selectionBounds(state.selection.start, state.selection.end);
    return { type: "selection", start: state.selection.start, end: state.selection.end, bounds, valid: true };
  }
  if (state.tool === "erase" && state.pointer) {
    const end = snapBuildCell(state.pointer.x, state.pointer.y);
    const start = state.buildStart || end;
    return { start, end, valid: true, type: "erase" };
  }
  if (!state.pointer || !BUILD_TOOLS.includes(state.tool) || !isToolUnlocked(state.factory, state.tool)) return null;
  const end = snapBuildCell(state.pointer.x, state.pointer.y);
  const start = state.buildStart || end;
  if (state.tool === "area-counter" && state.placementMode["area-counter"] === "area") {
    const cells = getBuildAreaCells(start, end);
    return { cells, valid: cells.every(({ x, y }) => canPlaceMachine(state.factory, "area-counter", x, y, state.replaceOnPlace)), type: "area-counter" };
  }
  if (["quarry", "spark-generator", "area-counter", "sifter", "washer", "pump", "furnace", "gold-press", "quartz-press", "heat-bank", "melter", "filter"].includes(state.tool)) {
    const cell = pointerToBuildCell(end);
    return { cells: [cell], valid: cell.valid, type: state.tool };
  }
  if (state.tool === "conveyor") {
    const cells = getConveyorLineCells(start, end);
    return { cells, valid: cells.every(({ x, y }) => canPlaceMachine(state.factory, "conveyor", x, y, state.replaceOnPlace)), direction: getConveyorDirection(start, end) };
  }
  if (state.tool === "wall") {
    const cells = getWallPlacementCells(start, end);
    return { cells, valid: cells.every(({ x, y }) => canPlaceMachine(state.factory, "wall", x, y, state.replaceOnPlace)), type: "wall" };
  }
  const cell = pointerToBuildCell(start);
  return { cells: [cell], valid: cell.valid, type: "launcher", direction: end.x === start.x && end.y === start.y ? "default" : end.x < start.x ? "up-left" : "up-right" };
}

function handleCanvasDown(event) {
  event.preventDefault();
  canvas.setPointerCapture?.(event.pointerId);
  state.pointerDown = true;
  const point = canvasPoint(event);
  state.pointer = point;
  updateCursorReadout(point);
  state.replaceOnPlace = event.ctrlKey || event.metaKey;
  if (state.tool === "claw") {
    const picked = state.claw?.active ? true : pickupClaw(point);
    state.pointerDown = picked;
    if (picked) emitEvent(`claw holding ${state.claw.cells.length}`, `${materialLabel(state.claw.materialId)} cells · move and release`);
    else emitEvent("claw found nothing", "hold on a material patch to pick it up");
    return;
  }
  if (state.tool === "eyedropper") {
    state.pointerDown = false;
    pickMachine(point);
    return;
  }
  if (state.tool === "select" && state.clipboard?.machines?.length) return;
  if (state.tool === "paint") {
    if (!canPaintMaterials()) return;
    paintMaterial(point.x, point.y, 3, state.materialId, true);
    return;
  }
  if (BUILD_TOOLS.includes(state.tool) || state.tool === "erase") {
    state.buildStart = snapBuildCell(point.x, point.y);
    state.buildEnd = state.buildStart;
    return;
  }
  if (state.tool === "select") {
    state.buildStart = snapBuildCell(point.x, point.y);
    state.buildEnd = state.buildStart;
    return;
  }
}

function handleCanvasMove(event) {
  const point = canvasPoint(event);
  state.pointer = point;
  updateCursorReadout(point);
  if (state.pointerDown && state.tool === "paint" && canPaintMaterials()) paintMaterial(point.x, point.y, 3, state.materialId, true);
  if (state.pointerDown && state.buildStart) state.buildEnd = snapBuildCell(point.x, point.y);
}

function handleCanvasUp(event) {
  if (state.tool === "claw") {
    const point = event ? canvasPoint(event) : state.pointer;
    releaseClaw(point);
    state.pointerDown = false;
    state.replaceOnPlace = false;
    return;
  }
  if (state.tool === "paint") {
    state.pointerDown = false;
    return;
  }
  if (state.tool === "select" && state.clipboard?.machines?.length) {
    if (state.pointerDown) placeClipboard();
    state.pointerDown = false;
    state.buildStart = null;
    state.buildEnd = null;
    state.replaceOnPlace = false;
    return;
  }
  if (state.pointerDown && state.buildStart && state.buildEnd && state.tool === "select") {
    const selected = machinesInSelection(state.buildStart, state.buildEnd);
    state.selection = selected.length ? { start: state.buildStart, end: state.buildEnd, machineIds: selected.map((machine) => machine.id) } : null;
    state.selectedMachineId = selected.length === 1 ? selected[0].id : null;
    emitEvent(selected.length ? `${selected.length} machine${selected.length === 1 ? "" : "s"} selected` : "selection empty", selected.length ? "press ctrl+c to copy or ctrl+x to cut" : "drag across occupied bays to select them");
    state.pointerDown = false;
    state.buildStart = null;
    state.buildEnd = null;
    state.replaceOnPlace = false;
    return;
  }
  if (state.pointerDown && state.buildStart && state.buildEnd && state.tool === "erase") {
    const removed = eraseMachinesInArea(state.factory, state.buildStart, state.buildEnd);
    state.selectedMachineId = null;
    if (removed) emitEvent(`removed ${removed} machine${removed === 1 ? "" : "s"}`, "the field is ready for a new line");
    else emitEvent("nothing to remove", "drag across an occupied bay");
  } else if (state.pointerDown && state.buildStart && state.buildEnd && isToolUnlocked(state.factory, state.tool)) {
    const start = state.buildStart;
    const end = state.buildEnd;
    let placedCount = 0;
    let placedType = state.tool;
    if (state.tool === "conveyor") {
      if (state.replaceOnPlace) startReplacement(state.factory, getConveyorLineCells(start, end));
      const placed = placeConveyorLine(state.factory, start, end, state.replaceOnPlace);
      placedCount = placed.length;
      if (placed.length) state.selectedMachineId = placed[placed.length - 1].id;
    } else if (state.tool === "wall") {
      const cells = getWallPlacementCells(start, end);
      if (state.replaceOnPlace) startReplacement(state.factory, cells);
      const placed = state.placementMode.wall === "area"
        ? placeWallArea(state.factory, start, end, state.replaceOnPlace)
        : placeWallLine(state.factory, start, end, state.replaceOnPlace);
      placedCount = placed.length;
      if (placed.length) state.selectedMachineId = placed[placed.length - 1].id;
    } else if (state.tool === "area-counter" && state.placementMode["area-counter"] === "area") {
      const cells = getBuildAreaCells(start, end);
      if (state.replaceOnPlace) startReplacement(state.factory, cells);
      if (cells.every(({ x, y }) => canPlaceMachine(state.factory, "area-counter", x, y, false))) {
        const placed = cells.map(({ x, y }) => placeMachine(state.factory, "area-counter", x, y, { areaMaterial: state.factory.progression.selectedMaterial }));
        placedCount = placed.length;
        if (placed.length) state.selectedMachineId = placed[placed.length - 1].id;
      }
    } else if (state.tool === "launcher") {
      const direction = end.x === start.x && end.y === start.y ? "default" : end.x < start.x ? "up-left" : "up-right";
      if (state.replaceOnPlace) removeMachineAt(state.factory, start.x, start.y);
      const placed = placeMachine(state.factory, "launcher", start.x, start.y, { direction, ...placementOptions("launcher") });
      placedCount = placed ? 1 : 0;
      if (placed) state.selectedMachineId = placed.id;
    } else {
      if (state.replaceOnPlace) removeMachineAt(state.factory, start.x, start.y);
      const placed = placeMachine(state.factory, state.tool, start.x, start.y, placementOptions(state.tool));
      placedCount = placed ? 1 : 0;
      if (placed) state.selectedMachineId = placed.id;
    }
    if (placedCount) emitEvent(`placed ${placedCount} ${MACHINE_META[placedType]?.label || placedType}`, placedCount > 1 ? "line committed to the field" : "select the bay to inspect its flow");
    else {
      emitEvent("placement blocked", "choose an empty bay inside the active zone");
      flashField("is-blocked");
      ui.hint.textContent = "placement blocked · choose an empty bay inside the active zone";
    }
  }
  state.pointerDown = false;
  state.buildStart = null;
  state.buildEnd = null;
  state.replaceOnPlace = false;
}

function eraseMachinesInArea(factoryState, start, end) {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  let removed = 0;
  [...factoryState.machines].forEach((machine) => {
    if (machine.x >= minX && machine.x <= maxX && machine.y >= minY && machine.y <= maxY) {
      if (removeMachineAt(factoryState, machine.x, machine.y)) removed += 1;
    }
  });
  return removed;
}

function startReplacement(factoryState, cells) {
  const removed = new Set();
  cells.forEach(({ x, y }) => {
    const machine = getMachineAtCell(factoryState, x, y);
    if (machine && !removed.has(machine.id)) { removeMachineAt(factoryState, x, y); removed.add(machine.id); }
  });
}

function materialLabel(id) { return materialNames.get(id) || `material ${id}`; }

function normalizeDebugMaterialName(value) {
  return String(value).trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function resolveDebugMaterial(material) {
  if (Number.isInteger(material)) {
    if (material >= 0 && material <= 255) return material;
    throw new Error(`material id must be between 0 and 255, got ${material}`);
  }
  const id = DEBUG_MATERIALS.get(normalizeDebugMaterialName(material));
  if (id === undefined) {
    throw new Error(`unknown material "${material}". Use factoryDebug.listMaterials() to see valid names.`);
  }
  return id;
}

function unlockEverything() {
  const progression = state.factory.progression || {};
  progression.mode = "legacy";
  progression.unlockedTools = ["select", "erase", ...Object.keys(MACHINE_META)];
  progression.completedMilestones = MILESTONES.map((milestone) => milestone.id);
  progression.completed = true;
  progression.upgrades = { ...(progression.upgrades || {}), quarryRate: 2 };
  state.factory.progression = progression;
  renderUi(performance.now());
  saveGame(true);
  return { unlockedTools: progression.unlockedTools.length, completed: true };
}

function placeDebugMaterial(material, x = state.pointer?.x, y = state.pointer?.y, brushSize = 1) {
  const materialId = resolveDebugMaterial(material);
  const pointX = Number(x);
  const pointY = Number(y);
  const size = Math.max(1, Math.floor(Number(brushSize)));
  if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) throw new Error("placeMaterial needs x and y coordinates, or a canvas cursor position.");
  if (!Number.isFinite(size)) throw new Error("brushSize must be a finite number.");
  paintMaterial(Math.round(pointX), Math.round(pointY), size, materialId, true);
  saveGame();
  renderFrame(state.factory, { gridVisible: state.gridVisible, preview: buildPreview(), pointer: state.pointer, claw: clawRenderState(), selectedMachineId: state.selectedMachineId });
  return { material: materialLabel(materialId), id: materialId, x: Math.round(pointX), y: Math.round(pointY), brushSize: size };
}

function installDebugCommands() {
  const commands = {
    unlockAll: unlockEverything,
    unlockEverything,
    listMaterials: () => [...new Set(DEBUG_MATERIALS.keys())].sort(),
    place: placeDebugMaterial,
    placeMaterial: placeDebugMaterial,
  };
  window.factoryDebug = commands;
  window.unlockEverything = unlockEverything;
  window.unlockAll = unlockEverything;
  window.placeMaterial = placeDebugMaterial;
  console.info("factory debug commands: unlockEverything(), placeMaterial(name, x, y, brushSize), factoryDebug.listMaterials()");
}

function renderInspector() {
  const selected = getSelectedMachine(state.factory, state.selectedMachineId);
  if (!selected) {
    if (state.lastInspectorKey !== "none") {
      state.lastInspectorKey = "none";
      ui.inspector.innerHTML = "<p>select a machine bay to inspect it.</p>";
    }
    return;
  }
  const filterKey = selected.type === "filter" ? `${selected.id}:${selected.filterMode}:${(selected.filterMaterials || []).join(",")}` : "";
  const areaKey = selected.type === "area-counter" ? `${selected.id}:${selected.areaMaterial}:${selected.lastAreaCount}` : "";
  const key = `${selected.id}:${selected.type}:${filterKey}:${areaKey}:${selected.fill}:${selected.blockReason}`;
  const progressValue = Math.round((selected.progress || 0) * 100);
  if (key === state.lastInspectorKey) {
    const cycleLabel = ui.inspector.querySelector("[data-inspector-cycle]");
    if (cycleLabel) cycleLabel.textContent = `cycle: ${progressValue}%`;
    return;
  }
  state.lastInspectorKey = key;
  const meta = MACHINE_META[selected.type];
  const heat = Math.round(selected.heat || 0);
  const status = selected.blocked ? (selected.blockReason || "waiting for input") : selected.type === "area-counter" ? "counting" : selected.type === "heat-bank" ? (heat > 0 ? "holding heat" : "empty") : "processing";
  let details = `<div class="status-row"><span>status</span><strong>${status}</strong></div>`;
  if (selected.type === "area-counter") {
    const options = COUNTER_MATERIALS.map(([id, name]) => `<option value="${id}" ${selected.areaMaterial === id ? "selected" : ""}>${name}</option>`).join("");
    const milestone = MILESTONES.find((item) => item.material === selected.areaMaterial);
    const target = milestone?.threshold || "-";
    const liveCount = selected.lastAreaCount || getAreaConnectedCount(state.factory, selected, selected.areaMaterial);
    details += `<label class="area-select">count material<select id="area-material">${options}</select></label><div class="status-row"><span>inside now</span><strong>${liveCount}${target === "-" ? "" : ` / ${target}`}</strong></div><p>this is the collection zone. matching cells inside connected counter bays count while they remain physical.</p>`;
  } else if (["gold-press", "quartz-press"].includes(selected.type)) {
    const partner = getPressPartner(state.factory, selected);
    const needed = selected.type === "gold-press" ? "gold" : "quartz";
    details += `<div class="status-row"><span>fill</span><strong>${selected.fill} / ${selected.fillCapacity}</strong></div><div class="status-row"><span>pair</span><strong>${partner ? MACHINE_META[partner.type].label : "not connected"}</strong></div><div class="status-row"><span>input</span><strong>${needed}</strong></div>`;
  } else {
    const directionLine = selected.direction ? `<div class="status-row"><span>direction</span><strong>${selected.direction}</strong></div>` : "";
    const heatLine = selected.type === "heat-bank" ? `<div class="status-row"><span>stored heat</span><strong>${heat} / ${selected.heatCapacity}</strong></div>` : ["furnace", "melter"].includes(selected.type) ? `<div class="status-row"><span>machine heat</span><strong>${heat}%</strong></div>` : "";
    details += `${directionLine}${heatLine}<div class="status-row"><span>input</span><strong>${meta.input}</strong></div><div class="status-row"><span>output</span><strong>${meta.output}</strong></div><p class="machine-detail">${meta.detail}</p>`;
    if (meta.cycle && selected.type !== "conveyor") details += `<div class="cycle-readout"><span data-inspector-cycle>cycle: ${progressValue}%</span></div>`;
  }
  const filterControls = selected.type === "filter" ? `<fieldset class="filter-settings"><legend>filter rule</legend><label><input type="radio" name="filter-mode" value="allow" ${selected.filterMode !== "block" ? "checked" : ""} /> allow selected</label><label><input type="radio" name="filter-mode" value="block" ${selected.filterMode === "block" ? "checked" : ""} /> block selected</label><div class="filter-actions"><button type="button" data-filter-action="select-all">select all</button><button type="button" data-filter-action="unselect-all">unselect all</button></div><div class="filter-materials">${FILTER_MATERIALS.map((material) => `<label><input type="checkbox" data-filter-material="${material.id}" ${selected.filterMaterials?.includes(material.id) ? "checked" : ""} /> ${material.name}</label>`).join("")}</div></fieldset>` : "";
  ui.inspector.innerHTML = `<p class="inspector-intro"><strong>${meta.label}</strong><small>bay ${String(selected.x / BUILD_SIZE + 1).padStart(2, "0")} / ${String(selected.y / BUILD_SIZE + 1).padStart(2, "0")} · 8 × 8 cells</small></p>${details}${filterControls}`;
  if (selected.type === "area-counter") ui.inspector.querySelector("#area-material")?.addEventListener("change", (event) => { selected.areaMaterial = Number(event.target.value); state.factory.progression.selectedMaterial = selected.areaMaterial; state.lastInspectorKey = ""; saveGame(); });
  if (selected.type === "filter") {
    ui.inspector.querySelectorAll("[name='filter-mode']").forEach((input) => input.addEventListener("change", () => { selected.filterMode = input.value; state.lastInspectorKey = ""; saveGame(); }));
    ui.inspector.querySelectorAll("[data-filter-material]").forEach((input) => input.addEventListener("change", () => { const materialId = Number(input.dataset.filterMaterial); const next = new Set(selected.filterMaterials || []); if (input.checked) next.add(materialId); else next.delete(materialId); selected.filterMaterials = [...next]; state.lastInspectorKey = ""; saveGame(); }));
    ui.inspector.querySelector("[data-filter-action='select-all']")?.addEventListener("click", () => { selected.filterMaterials = FILTER_MATERIALS.map((material) => material.id); state.lastInspectorKey = ""; renderInspector(); saveGame(); });
    ui.inspector.querySelector("[data-filter-action='unselect-all']")?.addEventListener("click", () => { selected.filterMaterials = []; state.lastInspectorKey = ""; renderInspector(); saveGame(); });
  }
}

function renderPlayableArea() {
  if (!ui.areaGrid) return;
  const area = state.factory.area;
  const cost = getExpansionCost(state.factory);
  const gold = getAreaMaterialTotal(state.factory, GOLD);
  const counterKey = state.factory.machines.filter((machine) => machine.type === "area-counter").map((machine) => `${machine.x},${machine.y}:${machine.areaMaterial}`).join(";");
  const key = `${area.width}:${area.height}:${gold}:${counterKey}`;
  if (key === state.lastAreaKey) return;
  state.lastAreaKey = key;
  ui.areaSize.textContent = `${area.width} × ${area.height} bays`;
  ui.areaPixels.textContent = `${area.width * BUILD_SIZE} × ${area.height * BUILD_SIZE} px`;
  ui.fieldMeta.textContent = `build ${area.width} × ${area.height} bays · ${area.width * BUILD_SIZE} × ${area.height * BUILD_SIZE} px`;
  if (ui.fieldZoneLabel) ui.fieldZoneLabel.textContent = `${area.width} × ${area.height}`;
  document.documentElement.style.setProperty("--field-zoom", String(Math.max(1, Math.min(2.35, 23.5 / Math.max(area.width, area.height)))));
  ui.goldStock.textContent = String(gold);
  ui.areaGrid.style.setProperty("--area-cols", area.width);
  ui.areaGrid.innerHTML = Array.from({ length: area.width * area.height }, (_, index) => {
    const x = index % area.width;
    const y = Math.floor(index / area.width);
    const occupied = state.factory.machines.some((machine) => machine.type === "area-counter" && machine.x / BUILD_SIZE === x && machine.y / BUILD_SIZE === y);
    return `<span class="area-cell${occupied ? " is-counter" : ""}" title="bay ${x + 1}, ${y + 1}${occupied ? " · area counter" : ""}"></span>`;
  }).join("");
  ui.areaGrid.setAttribute("aria-label", `playable build area, ${area.width} by ${area.height} bays`);
  ui.expandArea.disabled = cost === null || gold < cost;
  ui.expandArea.textContent = cost === null ? "area fully expanded" : `expand +2 bays · ${cost} gold`;
  ui.expandArea.title = cost === null ? "maximum build area reached" : gold < cost ? `need ${cost - gold} more gold inside gold area counters` : `remove ${cost} gold cells from the area counters to expand the build area`;
}

function renderResourceList() {
  if (!ui.resources) return;
  const fullPaletteUnlocked = state.factory.progression?.mode === "legacy" || state.factory.progression?.completed === true;
  if (ui.resourceSection) ui.resourceSection.hidden = !fullPaletteUnlocked;
  if (!fullPaletteUnlocked) {
    ui.resources.innerHTML = "";
    state.lastResourceKey = "palette-hidden";
    return;
  }
  const key = `${state.tool}:${state.materialId}:${fullPaletteUnlocked}`;
  if (key === state.lastResourceKey) return;
  state.lastResourceKey = key;
  ui.resources.innerHTML = RESOURCE_GROUPS.map((group) => `<section class="resource-group" aria-labelledby="resource-${group.id}"><div class="resource-group-heading"><strong id="resource-${group.id}">${group.label}</strong><small>${group.items.length} obtainable</small></div><div class="resource-items">${group.items.map(([id, name, route]) => `<button type="button" class="resource-item${state.tool === "paint" && state.materialId === id ? " is-selected" : ""}" data-material-id="${id}" aria-pressed="${String(state.tool === "paint" && state.materialId === id)}" title="select ${name} for painting · route: ${route}"><span class="material-swatch" style="--swatch: ${MATERIAL_SWATCHES.get(id) || "#999"}" aria-hidden="true"></span><span><strong>${name}</strong><small>${route}</small></span></button>`).join("")}</div></section>`).join("");
  ui.resources.querySelectorAll("[data-material-id]").forEach((button) => button.addEventListener("click", () => selectMaterial(button.dataset.materialId)));
}

function renderProgression() {
  const progression = state.factory.progression;
  const completed = progression?.completedMilestones || [];
  const next = MILESTONES.find((milestone) => !completed.includes(milestone.id));
  const currentCounter = state.factory.machines.find((machine) => machine.type === "area-counter");
  const targetCounter = next
    ? state.factory.machines.find((machine) => machine.type === "area-counter" && machine.areaMaterial === next.material)
    : currentCounter;
  const live = targetCounter ? getAreaConnectedCount(state.factory, targetCounter, next?.material || targetCounter.areaMaterial) : 0;
  const nextText = next ? `${next.label}: ${live} / ${next.threshold}` : "all milestones complete";
  const resonance = state.factory.resonance || {};
  const resonanceActive = (resonance.activeUntil || 0) > state.factory.elapsed;
  const resonanceText = resonanceActive ? `live · quarry x2 · ${Math.max(0, resonance.activeUntil - state.factory.elapsed).toFixed(1)}s` : `at 24 residue · ${resonance.pulses || 0} overclocks`;
  const key = `${progression?.completed}:${next?.id || "done"}:${live}:${state.factory.stats.mined || 0}:${state.factory.stats.ingots || 0}`;
  if (key !== state.lastProgressionKey) {
    state.lastProgressionKey = key;
    const targetRoute = next ? `${materialLabel(next.material)} → ${next.unlocks.length ? next.unlocks.join(" + ") : "prototype complete"}` : "all systems unlocked";
    ui.progression.innerHTML = `<div class="progress-summary"><strong>${progression?.completed ? "prototype complete" : "next target"}</strong><span>${nextText}</span><small>${targetRoute}</small></div><div class="status-row"><span>mined</span><strong>${state.factory.stats.mined || 0}</strong></div><div class="status-row"><span>ingot blocks</span><strong>${state.factory.stats.ingots || 0}</strong></div><div class="status-row resonance-row"><span>quarry overclock</span><strong data-resonance-status>${resonanceText}</strong></div><p class="mechanic-note">24 matching cells in one connected counter bank triggers a 5 second quarry overclock. the full material palette unlocks after every production goal is complete.</p><ol class="milestone-list">${MILESTONES.map((milestone) => `<li class="${completed.includes(milestone.id) ? "is-complete" : ""}"><span>${milestone.label}</span><small>${completed.includes(milestone.id) ? "complete" : `${milestone.threshold} connected`}</small></li>`).join("")}</ol>`;
  } else {
    ui.progression.querySelector("[data-resonance-status]")?.replaceChildren(document.createTextNode(resonanceText));
  }
}

function renderTelemetry() {
  const stats = state.factory.stats || {};
  const progression = state.factory.progression || {};
  const completed = progression.completedMilestones || [];
  const next = MILESTONES.find((milestone) => !completed.includes(milestone.id));
  const counter = next ? state.factory.machines.find((machine) => machine.type === "area-counter" && machine.areaMaterial === next.material) : null;
  const live = counter ? getAreaConnectedCount(state.factory, counter, next.material) : 0;
  if (ui.cycleReadout) ui.cycleReadout.textContent = String(stats.cycles || 0).padStart(4, "0");
  if (ui.producedReadout) ui.producedReadout.textContent = String(stats.totalProduced || 0);
  if (ui.targetReadout) ui.targetReadout.textContent = next ? `${materialLabel(next.material)} ${live} / ${next.threshold}` : "all systems live";
  if (ui.eventFeed) ui.eventFeed.textContent = state.lastEvent;
  if (ui.eventCount) ui.eventCount.textContent = state.eventDetail;
  syncProductionSignals();
}

function renderUi(now) {
  if (state.pointer) updateCursorReadout(state.pointer);
  renderToolAvailability();
  renderPlayableArea();
  renderResourceList();
  renderProgression();
  renderInspector();
  renderTelemetry();
  state.lastUiAt = now;
}

function saveGame(manual = false) {
  if (state.claw?.active) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 4, grid: serializeGrid(), factory: serializeFactory(state.factory), savedAt: Date.now() }));
    state.factory.stats.savedAt = Date.now();
    ui.saveState.textContent = manual ? "saved" : "local";
    if (manual) emitEvent("run saved", "local checkpoint updated");
    if (manual) window.setTimeout(() => { ui.saveState.textContent = "local"; }, 1600);
  } catch { ui.saveState.textContent = "offline"; }
}

function restoreGame() {
  try {
    const saved = JSON.parse([SAVE_KEY, ...LEGACY_SAVE_KEYS].map((key) => localStorage.getItem(key)).find(Boolean) || "null");
    const restoredFactory = saved?.factory ? restoreFactory(saved.factory) : null;
    if (saved?.grid && restoredFactory && deserializeGrid(saved.grid)) {
      state.factory = restoredFactory;
      state.selectedMachineId = state.factory.machines[0]?.id || null;
      return true;
    }
  } catch { /* fall through to the progression starter */ }
  seedWorld();
  return false;
}

function clearField() {
  releaseClaw(state.pointer);
  clearGrid();
  for (let x = 0; x < GRID_W; x += 1) for (let y = GRID_H - 4; y < GRID_H; y += 1) setCell(x, y, packCell(STONE, 0));
  emitEvent("field cleared", "machines stayed in place · paint or run a new batch");
}

function toggleRunning() {
  state.running = !state.running;
  setRunPresentation();
  emitEvent(state.running ? "line resumed" : "line paused", state.running ? `${state.speed}x simulation active` : "place machines while the field is still");
}

function bindUi() {
  document.querySelectorAll("[data-tool]").forEach((button) => button.addEventListener("click", () => setTool(button.dataset.tool)));
  document.querySelectorAll("[data-speed]").forEach((button) => button.addEventListener("click", () => { state.speed = Number(button.dataset.speed); document.querySelectorAll("[data-speed]").forEach((item) => item.setAttribute("aria-pressed", String(item === button))); setRunPresentation(); emitEvent(`speed ${state.speed}x`, "simulation clock adjusted"); }));
  ui.runButton.addEventListener("click", toggleRunning);
  ui.gridButton.addEventListener("click", () => { state.gridVisible = !state.gridVisible; ui.gridState.textContent = state.gridVisible ? "on" : "off"; emitEvent(`grid ${state.gridVisible ? "on" : "off"}`, state.gridVisible ? "build bays visible" : "clean field view"); });
  ui.clearButton.addEventListener("click", clearField);
  ui.saveButton.addEventListener("click", () => saveGame(true));
  ui.onboardingDismiss?.addEventListener("click", () => { state.onboardingDismissed = true; ui.onboarding.hidden = true; emitEvent("guide dismissed", "the field remains ready whenever you need it"); });
  ui.expandArea?.addEventListener("click", () => {
    const result = buyAreaExpansion(state.factory);
    if (result.ok) {
      state.lastInspectorKey = "";
      ui.hint.textContent = `build area expanded to ${result.width} × ${result.height} bays · ${result.width * BUILD_SIZE} × ${result.height * BUILD_SIZE} px`;
      emitEvent("territory expanded", `removed ${result.spent} physical gold cells · ${result.width} × ${result.height} bays now online`);
      renderUi(performance.now());
      saveGame(true);
    } else {
      emitEvent("expansion waiting", result.reason === "need_gold" ? `need ${result.cost - (result.available || 0)} more gold inside area counters` : "maximum build area reached");
      ui.hint.textContent = result.reason === "need_gold" ? `area expansion needs ${result.cost} physical gold cells inside gold area counters` : "the build area is fully expanded";
    }
  });
  ui.resetButton.addEventListener("click", () => { releaseClaw(state.pointer); state.factory = createStarterFactory(); state.selectedMachineId = state.factory.machines[0]?.id || null; state.placementPreset = null; state.materialId = SAND; state.running = true; state.lastToolAvailabilityKey = ""; state.lastInspectorKey = ""; state.lastAreaKey = ""; state.lastProgressionKey = ""; state.lastResourceKey = ""; setEventBaseline(); setRunPresentation(); setTool("select"); seedWorld(); emitEvent("new run ready", "quarry online · watch for residue"); saveGame(true); });
  window.addEventListener("resize", resizeCanvas);
  canvas.addEventListener("pointerdown", handleCanvasDown);
  canvas.addEventListener("pointermove", handleCanvasMove);
  canvas.addEventListener("pointerup", handleCanvasUp);
  canvas.addEventListener("pointercancel", handleCanvasUp);
  canvas.addEventListener("pointerleave", () => { if (!state.pointerDown) state.pointer = null; });
  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") { event.preventDefault(); copySelection(false); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "x") { event.preventDefault(); copySelection(true); return; }
    if (event.key === " ") { event.preventDefault(); toggleRunning(); }
    if (event.key.toLowerCase() === "g") ui.gridButton.click();
    if (event.key.toLowerCase() === "v") setTool("select");
    if (event.key.toLowerCase() === "x") setTool("erase");
    if (event.key.toLowerCase() === "i") setTool("eyedropper");
    if (event.key === "Escape") {
      state.clipboard = null;
      state.selection = null;
      state.pointerDown = false;
      state.buildStart = null;
      state.buildEnd = null;
      setTool("select");
      emitEvent("clipboard cleared", "inspect mode ready");
      return;
    }
    if (event.key.toLowerCase() === "w") { setPlacementMode("wall", event.shiftKey ? "area" : "line"); return; }
    if (event.key.toLowerCase() === "a") { setPlacementMode("area-counter", event.shiftKey ? "area" : "single"); return; }
    const tool = Object.entries(TOOL_KEYS).find(([, key]) => key === event.key.toLowerCase())?.[0];
    if (tool) setTool(tool);
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
      simulateStep((x, y, materialId) => isAreaBoundaryCell(state.factory, x, y) || isMachineCell(state.factory, x, y, materialId) || isLauncherFlightCell(state.factory, x, y), (x, y) => isHeatedCell(state.factory, x, y));
      simulationAccumulator -= SIM_STEP;
      steps += 1;
    }
    if (steps === 12) simulationAccumulator = 0;
  }
  renderFrame(state.factory, { gridVisible: state.gridVisible, preview: buildPreview(), pointer: state.pointer, claw: clawRenderState(), selectedMachineId: state.selectedMachineId });
  if (now - state.lastUiAt > 160) renderUi(now);
  if (now - state.lastSaveAt > 10000) { saveGame(); state.lastSaveAt = now; }
  window.requestAnimationFrame(loop);
}

bindUi();
restoreGame();
setEventBaseline();
installDebugCommands();
resizeCanvas();
setTool("select");
setRunPresentation();
renderUi(0);
window.requestAnimationFrame(loop);
