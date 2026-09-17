import {
  AIR,
  BUILD_SIZE,
  FIRE,
  FILTER_MATERIALS,
  GOLD,
  GRID_H,
  GRID_W,
  LAVA,
  LIQUID_GLASS,
  LIQUID_GOLD,
  MACHINE_META,
  RESIDUE,
  SAND,
  SMOKE,
  SPARK,
  STEAM,
  STEAM_LIFETIME_MIN,
  STEAM_LIFETIME_MAX,
  WATER,
  WET_SAND,
} from "./constants.js";
import { cellId, currentGrid, idx, inBounds, packCell, randInt, setCell } from "./grid.js";

// The factory is an overlay on the same material grid. It owns machine
// placement and timing only. Materials remain in currentGrid at all times.
let nextMachineNumber = 6;
let nextFlightNumber = 1;
const HEAT_SOURCE_RATES = { [FIRE]: 10, [SPARK]: 18, [LAVA]: 24 };
const HEAT_TRANSFER_RATE = 12;
const MELTER_HEAT_COST = 4;
const WATER_EVAPORATION_HEAT_COST = 1;
const LAUNCH_HORIZONTAL_SPEED = 30;
const LAUNCH_INITIAL_VERTICAL_SPEED = -52;
const LAUNCH_GRAVITY = 92;
const LAUNCH_RANGE = 40;

function defaultDirection(type) {
  if (type === "launcher") return "default";
  if (type === "conveyor") return "right";
  return null;
}

function defaultFilterMaterials() {
  return FILTER_MATERIALS.map((material) => material.id);
}

function machineContainsCell(machine, x, y) {
  if (x < machine.x || x >= machine.x + BUILD_SIZE || y < machine.y || y >= machine.y + BUILD_SIZE) return false;
  if (machine.type !== "wall" || machine.shape === "full") return true;
  const localX = x - machine.x;
  const localY = y - machine.y;
  return machine.shape === "slope-down-right"
    ? localY >= localX
    : localY >= BUILD_SIZE - 1 - localX;
}

function makeMachine(type, x, y, options = {}) {
  const meta = MACHINE_META[type];
  return {
    id: `m-${nextMachineNumber++}`,
    type,
    x,
    y,
    direction: options.direction || defaultDirection(type),
    shape: type === "wall" ? options.shape || "full" : null,
    filterMode: type === "filter" ? options.filterMode || "allow" : null,
    filterMaterials: type === "filter" ? [...(options.filterMaterials || defaultFilterMaterials())] : [],
    progress: 0,
    timer: 0,
    beltTimer: 0,
    cycles: 0,
    active: true,
    blocked: false,
    heat: 0,
    heatCapacity: meta.heatCapacity || 100,
  };
}

export function createStarterFactory() {
  nextMachineNumber = 6;
  nextFlightNumber = 1;
  return {
    // The starter line now contains only the heat bank. New machines are
    // placed into the empty field by the player.
    machines: [makeMachine("heat-bank", 136, 64)],
    flights: [],
    elapsed: 0,
    stats: { cycles: 0, totalProduced: 0, mined: 0, savedAt: null },
  };
}

export function getMachineAtCell(factoryState, x, y) {
  // Newest placement wins only for inspection if a legacy save contains an
  // overlap. New placements never allow machine footprints to overlap.
  return [...factoryState.machines].reverse().find((machine) => machineContainsCell(machine, x, y)) || null;
}

export function getSelectedMachine(factoryState, id) {
  return factoryState.machines.find((machine) => machine.id === id) || null;
}

export function isMachineCell(factoryState, x, y, materialId = null) {
  const machines = factoryState.machines.filter((machine) => machineContainsCell(machine, x, y));
  if (!machines.length) return false;
  return machines.some((machine) => {
    if (machine.type === "launcher") return false;
    if (machine.type === "filter") {
      if (materialId === null || materialId === AIR) return false;
      const selected = machine.filterMaterials || [];
      return machine.filterMode === "block" ? selected.includes(materialId) : !selected.includes(materialId);
    }
    return true;
  });
}

export function isHeatedCell(factoryState, x, y) {
  return factoryState.machines.some((machine) => (
    machineContainsCell(machine, x, y)
    && (machine.type === "heat-bank" || machine.heat > 0.5)
  ));
}

export function isLauncherFlightCell(factoryState, x, y) {
  return Array.isArray(factoryState.flights)
    && factoryState.flights.some((flight) => flight.x === x && flight.y === y);
}

export function snapBuildCell(x, y) {
  const maxX = Math.max(0, GRID_W - BUILD_SIZE);
  const maxY = Math.max(0, GRID_H - BUILD_SIZE);
  return {
    x: Math.max(0, Math.min(maxX, Math.floor(x / BUILD_SIZE) * BUILD_SIZE)),
    y: Math.max(0, Math.min(maxY, Math.floor(y / BUILD_SIZE) * BUILD_SIZE)),
  };
}

function overlaps(a, b) {
  return a.x < b.x + BUILD_SIZE && a.x + BUILD_SIZE > b.x
    && a.y < b.y + BUILD_SIZE && a.y + BUILD_SIZE > b.y;
}

function footprintIsClear(factoryState, x, y) {
  const candidate = { x, y };
  // Machines are an overlay on the material field. Existing smoke, sand,
  // water, and other pixels do not prevent construction; machine overlap is
  // still rejected so two physical machines cannot occupy the same bay.
  return !factoryState.machines.some((machine) => overlaps(candidate, machine));
}

export function canPlaceMachine(factoryState, type, x, y, allowOverlap = false) {
  return Boolean(MACHINE_META[type])
    && inBounds(x, y)
    && x + BUILD_SIZE <= GRID_W
    && y + BUILD_SIZE <= GRID_H
    && (allowOverlap || footprintIsClear(factoryState, x, y));
}

export function placeMachine(factoryState, type, x, y, options = {}) {
  const { allowOverlap = false, ...machineOptions } = options;
  if (!canPlaceMachine(factoryState, type, x, y, allowOverlap)) return null;
  const machine = makeMachine(type, x, y, machineOptions);
  factoryState.machines.push(machine);
  return machine;
}

export function getConveyorDirection(start, end) {
  if (end.x < start.x) return "left";
  return "right";
}

export function getConveyorLineCells(start, end) {
  const cells = [];
  const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
  if (horizontal) {
    const step = end.x < start.x ? -BUILD_SIZE : BUILD_SIZE;
    for (let x = start.x; step > 0 ? x <= end.x : x >= end.x; x += step) cells.push({ x, y: start.y });
  } else {
    const step = end.y < start.y ? -BUILD_SIZE : BUILD_SIZE;
    for (let y = start.y; step > 0 ? y <= end.y : y >= end.y; y += step) cells.push({ x: start.x, y });
  }
  return cells.length ? cells : [{ ...start }];
}

export function placeConveyorLine(factoryState, start, end, allowOverlap = false) {
  const cells = getConveyorLineCells(start, end);
  const direction = getConveyorDirection(start, end);
  if (cells.some(({ x, y }) => !canPlaceMachine(factoryState, "conveyor", x, y, allowOverlap))) return [];
  return cells.map(({ x, y }) => placeMachine(factoryState, "conveyor", x, y, { direction, allowOverlap }));
}

export function getWallLineCells(start, end) {
  const startX = Math.round(start.x / BUILD_SIZE);
  const startY = Math.round(start.y / BUILD_SIZE);
  const endX = Math.round(end.x / BUILD_SIZE);
  const endY = Math.round(end.y / BUILD_SIZE);
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const diagonal = deltaX !== 0 && deltaY !== 0;
  const cells = [];
  const steps = Math.max(Math.abs(deltaX), Math.abs(deltaY));
  for (let step = 0; step <= steps; step += 1) {
    const ratio = steps === 0 ? 0 : step / steps;
    const x = Math.round(startX + deltaX * ratio) * BUILD_SIZE;
    const y = Math.round(startY + deltaY * ratio) * BUILD_SIZE;
    const shape = diagonal ? (deltaX * deltaY > 0 ? "slope-down-right" : "slope-up-right") : "full";
    if (!cells.some((cell) => cell.x === x && cell.y === y)) cells.push({ x, y, shape });
  }
  return cells.length ? cells : [{ x: start.x, y: start.y, shape: "full" }];
}

export function placeWallLine(factoryState, start, end, allowOverlap = false) {
  const cells = getWallLineCells(start, end);
  if (cells.some(({ x, y }) => !canPlaceMachine(factoryState, "wall", x, y, allowOverlap))) return [];
  return cells.map(({ x, y, shape }) => placeMachine(factoryState, "wall", x, y, { shape, allowOverlap }));
}

export function removeMachineAt(factoryState, x, y) {
  const machine = getMachineAtCell(factoryState, x, y);
  if (!machine) return false;
  factoryState.machines = factoryState.machines.filter((item) => item.id !== machine.id);
  return true;
}

function touchesMachine(first, second) {
  const horizontalTouch = (first.x + BUILD_SIZE === second.x || second.x + BUILD_SIZE === first.x)
    && first.y < second.y + BUILD_SIZE && first.y + BUILD_SIZE > second.y;
  const verticalTouch = (first.y + BUILD_SIZE === second.y || second.y + BUILD_SIZE === first.y)
    && first.x < second.x + BUILD_SIZE && first.x + BUILD_SIZE > second.x;
  return horizontalTouch || verticalTouch;
}

function touchingHeat(factoryState, machine) {
  const grid = currentGrid();
  const edge = new Set();
  for (let x = machine.x; x < machine.x + BUILD_SIZE; x += 1) {
    edge.add(`${x},${machine.y - 1}`);
    edge.add(`${x},${machine.y + BUILD_SIZE}`);
  }
  for (let y = machine.y; y < machine.y + BUILD_SIZE; y += 1) {
    edge.add(`${machine.x - 1},${y}`);
    edge.add(`${machine.x + BUILD_SIZE},${y}`);
  }
  let rate = 0;
  for (const point of edge) {
    const [x, y] = point.split(",").map(Number);
    if (inBounds(x, y)) rate += HEAT_SOURCE_RATES[cellId(grid[idx(x, y)])] || 0;
  }
  return rate;
}

function updateHeat(factoryState, dt) {
  for (const machine of factoryState.machines) {
    const loss = machine.type === "heat-bank" ? 0.04 : 0.8;
    machine.heat = Math.max(0, machine.heat - loss * dt);
    const sourceRate = touchingHeat(factoryState, machine);
    if (sourceRate) machine.heat = Math.min(machine.heatCapacity, machine.heat + sourceRate * dt);
  }

  // Heat crosses a boundary only when two machine footprints share an edge.
  // The bank retains any remainder, so a recipient cannot make heat vanish.
  for (const bank of factoryState.machines.filter((machine) => machine.type === "heat-bank")) {
    for (const recipient of factoryState.machines) {
      if (recipient === bank || !touchesMachine(bank, recipient) || recipient.heat >= recipient.heatCapacity) continue;
      const transfer = Math.min(bank.heat, HEAT_TRANSFER_RATE * dt, recipient.heatCapacity - recipient.heat);
      bank.heat -= transfer;
      recipient.heat += transfer;
    }
  }
}

function evaporateWaterOnPoweredMelters(factoryState) {
  const grid = currentGrid();
  for (const melter of factoryState.machines) {
    if (melter.type !== "melter" || !hasHotNeighbor(factoryState, melter) || melter.heat < WATER_EVAPORATION_HEAT_COST) continue;

    // The top edge is the melter surface. Water cannot occupy the machine
    // footprint, so this is the physical "on the melter" contact point.
    const y = melter.y - 1;
    if (y < 0) continue;
    for (let x = melter.x; x < melter.x + BUILD_SIZE; x += 1) {
      const cell = idx(x, y);
      if (cellId(grid[cell]) !== WATER) continue;
      grid[cell] = packCell(STEAM, randInt(STEAM_LIFETIME_MIN, STEAM_LIFETIME_MAX));
      melter.heat -= WATER_EVAPORATION_HEAT_COST;
      if (melter.heat < WATER_EVAPORATION_HEAT_COST) break;
    }
  }
}

function getConveyorRun(factoryState, machine) {
  const run = [machine];
  for (const direction of [-1, 1]) {
    let x = machine.x + direction * BUILD_SIZE;
    while (factoryState.machines.some((other) => (
      other.type === "conveyor"
      && other.y === machine.y
      && other.x === x
      && (other.direction === machine.direction || (!other.direction && !machine.direction))
    ))) {
      const next = factoryState.machines.find((other) => other.type === "conveyor" && other.y === machine.y && other.x === x);
      if (!next || run.includes(next)) break;
      run.push(next);
      x += direction * BUILD_SIZE;
    }
  }
  return run.sort((first, second) => first.x - second.x);
}

function getConveyorPayload(factoryState, run) {
  const direction = run[0].direction === "left" ? -1 : 1;
  const beltY = run[0].y - 1;
  if (beltY < 0) return { direction, beltY, columns: [], sourceCells: new Set() };
  const minX = run[0].x;
  const maxX = run[run.length - 1].x + BUILD_SIZE - 1;
  const grid = currentGrid();
  const columns = [];
  const sourceCells = new Set();
  for (let x = minX; x <= maxX; x += 1) {
    const stack = [];
    for (let y = beltY; y >= 0; y -= 1) {
      if (isMachineCell(factoryState, x, y, null) || isLauncherFlightCell(factoryState, x, y)) break;
      const source = idx(x, y);
      if (cellId(grid[source]) === AIR) break;
      stack.push([x, y, grid[source]]);
      sourceCells.add(source);
    }
    if (stack.length) columns.push(stack);
  }
  return { direction, beltY, columns, sourceCells };
}

function moveConveyorRun(factoryState, run) {
  const payload = getConveyorPayload(factoryState, run);
  if (!payload.columns.length) return 0;
  const grid = currentGrid();
  const movedSources = new Set();
  let movedCount = 0;
  const columns = payload.direction > 0 ? [...payload.columns].reverse() : payload.columns;
  for (const stack of columns) {
    const moves = [];
    let blocked = false;
    for (const [x, y, value] of stack) {
      const targetX = x + payload.direction;
      if (!inBounds(targetX, y) || isMachineCell(factoryState, targetX, y, cellId(value)) || isLauncherFlightCell(factoryState, targetX, y)) {
        blocked = true;
        break;
      }
      const target = idx(targetX, y);
      // A neighboring stack is free only after that stack has actually
      // moved. This lets clear columns continue without overwriting a stack
      // that is waiting against a wall.
      if (!movedSources.has(target) && cellId(grid[target]) !== AIR) {
        blocked = true;
        break;
      }
      moves.push([idx(x, y), target, value]);
    }
    if (blocked) continue;
    for (const [source] of moves) {
      grid[source] = packCell(AIR, 0);
      movedSources.add(source);
    }
    for (const [, target, value] of moves) grid[target] = value;
    movedCount += moves.length;
  }
  return movedCount;
}

function moveConveyors(factoryState, dt) {
  const interval = MACHINE_META.conveyor.cycle;
  const visited = new Set();
  for (const machine of factoryState.machines) {
    if (machine.type !== "conveyor" || visited.has(machine.id)) continue;
    const run = getConveyorRun(factoryState, machine);
    for (const segment of run) {
      visited.add(segment.id);
      segment.beltTimer += dt;
      segment.active = true;
      segment.blocked = false;
    }
    const timer = Math.min(...run.map((segment) => segment.beltTimer));
    for (const segment of run) segment.progress = Math.min(1, timer / interval);
    if (timer < interval) continue;
    const moved = moveConveyorRun(factoryState, run);
    for (const segment of run) {
      segment.beltTimer = Math.max(0, segment.beltTimer - interval);
      segment.progress = Math.min(1, segment.beltTimer / interval);
    }
    if (!moved) for (const segment of run) segment.blocked = true;
  }
}

function findLauncherInputs(factoryState, machine) {
  const grid = currentGrid();
  const xOrder = [machine.x + 4, machine.x + 3, machine.x + 5, machine.x + 2, machine.x + 6, machine.x + 1, machine.x + 7];
  const inputs = [];
  // Read from the bottom of the no-collision body upward. Material can fall
  // through the launcher, but the launcher catches it before it leaves.
  for (let y = machine.y + BUILD_SIZE - 1; y >= machine.y; y -= 1) {
    for (const x of xOrder) {
      if (!inBounds(x, y)) continue;
      if (isLauncherFlightCell(factoryState, x, y)) continue;
      const value = grid[idx(x, y)];
      if (cellId(value) !== AIR) inputs.push([x, y, value]);
    }
  }
  return inputs;
}

function processLauncher(factoryState, machine) {
  const inputs = findLauncherInputs(factoryState, machine);
  if (!inputs.length) return false;
  const direction = machine.direction === "up-left" ? -1 : 1;
  const horizontalVelocity = machine.direction === "up-left" || machine.direction === "up-right"
    ? direction * LAUNCH_HORIZONTAL_SPEED
    : 0;
  const grid = currentGrid();
  let launched = 0;
  // A launch begins in the real source cell. Its flight state then advances
  // that same cell over later factory frames, so firing is visible rather
  // than a source-to-destination teleport.
  for (const input of inputs) {
    if (isLauncherFlightCell(factoryState, input[0], input[1])) continue;
    factoryState.flights.push({
      id: `f-${nextFlightNumber++}`,
      x: input[0],
      y: input[1],
      launcherId: machine.id,
      direction,
      value: input[2],
      distance: 0,
      xPosition: input[0],
      yPosition: input[1],
      xVelocity: horizontalVelocity,
      yVelocity: LAUNCH_INITIAL_VERTICAL_SPEED,
    });
    launched += 1;
  }
  machine.cycles += launched;
  return launched > 0;
}

function setLauncherFlightDirection(flight, launcher) {
  const direction = launcher.direction === "up-left" ? -1 : 1;
  flight.direction = launcher.direction === "up-left" || launcher.direction === "up-right" ? direction : 0;
  flight.xVelocity = flight.direction * LAUNCH_HORIZONTAL_SPEED;
  flight.yVelocity = LAUNCH_INITIAL_VERTICAL_SPEED;
  flight.launcherId = launcher.id;
}

function advanceLauncherFlights(factoryState, dt) {
  if (!Array.isArray(factoryState.flights) || !factoryState.flights.length) return;
  const grid = currentGrid();
  const remainingFlights = [];
  for (const flight of factoryState.flights) {
    // Keep the position continuous between grid cells. The material still
    // occupies one real grid cell, but its trajectory now has horizontal
    // velocity, vertical velocity, and gravity instead of a fixed diagonal.
    flight.xPosition = Number.isFinite(flight.xPosition) ? flight.xPosition : flight.x;
    flight.yPosition = Number.isFinite(flight.yPosition) ? flight.yPosition : flight.y;
    flight.xVelocity = Number.isFinite(flight.xVelocity)
      ? flight.xVelocity
      : (flight.direction === 0 ? 0 : (flight.direction || 1) * LAUNCH_HORIZONTAL_SPEED);
    flight.yVelocity = Number.isFinite(flight.yVelocity)
      ? flight.yVelocity
      : LAUNCH_INITIAL_VERTICAL_SPEED;
    const delta = Math.max(0, dt);
    flight.yVelocity += LAUNCH_GRAVITY * delta;
    flight.xPosition += flight.xVelocity * delta;
    flight.yPosition += flight.yVelocity * delta;

    const targetX = Math.round(flight.xPosition);
    const targetY = Math.round(flight.yPosition);
    let stopped = false;
    if (!inBounds(targetX, targetY)) {
      stopped = true;
    } else {
      // At the bottom of the arc, gravity can move the continuous position
      // more than one cell in a frame. Resolve that path one cell at a time
      // so the projectile cannot tunnel through a wall or another material.
      const nextX = flight.x + Math.sign(targetX - flight.x);
      const nextY = flight.y + Math.sign(targetY - flight.y);
      if (nextX === flight.x && nextY === flight.y) {
        if (flight.yPosition >= GRID_H) stopped = true;
      } else {
        const launcher = getMachineAtCell(factoryState, nextX, nextY);
        const target = idx(nextX, nextY);
        if (launcher?.type === "launcher"
          && launcher.id !== flight.launcherId
          && cellId(grid[target]) === AIR) {
          grid[idx(flight.x, flight.y)] = packCell(AIR, 0);
          grid[target] = flight.value;
          flight.x = nextX;
          flight.y = nextY;
          flight.xPosition = nextX;
          flight.yPosition = nextY;
          flight.distance = 0;
          setLauncherFlightDirection(flight, launcher);
        } else if (isMachineCell(factoryState, nextX, nextY, cellId(flight.value))) {
          stopped = true;
        } else {
          if (cellId(grid[target]) !== AIR) {
            stopped = true;
          } else {
            const stepDistance = Math.max(Math.abs(nextX - flight.x), Math.abs(nextY - flight.y));
            grid[idx(flight.x, flight.y)] = packCell(AIR, 0);
            grid[target] = flight.value;
            flight.x = nextX;
            flight.y = nextY;
            flight.distance += stepDistance;
          }
        }
      }
    }
    if (!stopped && flight.distance < LAUNCH_RANGE && inBounds(flight.x, flight.y)) remainingFlights.push(flight);
  }
  factoryState.flights = remainingFlights;
}

function hasHotNeighbor(factoryState, machine) {
  return factoryState.machines.some((other) => (
    other !== machine
    && touchesMachine(machine, other)
    && (other.type === "heat-bank" || other.heat > 0.5)
  ));
}

function findMelterInput(machine) {
  const grid = currentGrid();
  const candidates = [];
  for (let x = machine.x; x < machine.x + BUILD_SIZE; x += 1) candidates.push([x, machine.y - 1], [x, machine.y + BUILD_SIZE]);
  for (let y = machine.y; y < machine.y + BUILD_SIZE; y += 1) candidates.push([machine.x - 1, y], [machine.x + BUILD_SIZE, y]);
  const validCandidates = candidates.filter(([x, y]) => {
    if (!inBounds(x, y)) return false;
    const value = grid[idx(x, y)];
    const id = cellId(value);
    return id === SAND || id === WET_SAND || id === GOLD;
  });
  if (!validCandidates.length) return null;
  const [x, y] = validCandidates[machine.cycles % validCandidates.length];
  const value = grid[idx(x, y)];
  return [x, y, value, cellId(value)];
}

function processMelter(factoryState, machine) {
  if (!hasHotNeighbor(factoryState, machine) || machine.heat < MELTER_HEAT_COST) return false;
  const input = findMelterInput(machine);
  if (!input) return false;
  const output = input[3] === GOLD ? LIQUID_GOLD : LIQUID_GLASS;
  const lifetime = output === LIQUID_GOLD ? 255 : 220;
  setCell(input[0], input[1], packCell(output, lifetime));
  machine.heat -= MELTER_HEAT_COST;
  machine.cycles += 1;
  factoryState.stats.totalProduced += 1;
  return true;
}

export function factoryStep(factoryState, dt) {
  const delta = Math.max(0, Number(dt) || 0);
  factoryState.elapsed += delta;
  factoryState.stats.cycles += 1;
  updateHeat(factoryState, delta);
  evaporateWaterOnPoweredMelters(factoryState);
  advanceLauncherFlights(factoryState, delta);
  moveConveyors(factoryState, delta);

  for (const machine of factoryState.machines) {
    const meta = MACHINE_META[machine.type];
    machine.active = true;

    if (machine.type === "heat-bank") {
      machine.blocked = false;
      machine.progress = machine.heat / machine.heatCapacity;
      continue;
    }

    if (machine.type === "conveyor") continue;

    if (machine.type === "wall") {
      machine.blocked = false;
      machine.progress = 0;
      continue;
    }

    if (machine.type === "filter") {
      machine.blocked = false;
      machine.progress = 0;
      continue;
    }

    machine.timer += delta;
    machine.progress = Math.min(1, machine.timer / meta.cycle);
    if (machine.timer < meta.cycle) continue;

    const completed = machine.type === "launcher"
      ? processLauncher(factoryState, machine)
      : processMelter(factoryState, machine);
    if (completed) {
      machine.timer -= meta.cycle;
      machine.progress = Math.min(1, machine.timer / meta.cycle);
      machine.blocked = false;
    } else {
      machine.timer = meta.cycle;
      machine.progress = 1;
      machine.blocked = true;
    }
  }
}

export function serializeFactory(factoryState) {
  return JSON.stringify(factoryState);
}

export function restoreFactory(serialized) {
  const saved = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
  const defaults = createStarterFactory();
  const savedMachines = Array.isArray(saved?.machines) ? saved.machines : null;
  const supportedMachines = savedMachines
    ? savedMachines.filter((machine) => MACHINE_META[machine.type]).map((machine) => ({
      ...makeMachine(machine.type, machine.x, machine.y, { direction: machine.direction }),
      ...machine,
      direction: machine.direction || defaultDirection(machine.type),
      heat: Number.isFinite(machine.heat) ? machine.heat : 0,
      heatCapacity: MACHINE_META[machine.type].heatCapacity || 100,
      filterMode: machine.type === "filter" ? (machine.filterMode === "block" ? "block" : "allow") : null,
      filterMaterials: machine.type === "filter"
        ? (Array.isArray(machine.filterMaterials) ? machine.filterMaterials : defaultFilterMaterials())
        : [],
    }))
    : defaults.machines;
  // A pre-factory save can contain only retired machine types. Migrate that
  // state to the current starter heat bank instead of leaving a dead field.
  const machines = supportedMachines.length ? supportedMachines : defaults.machines;
  const restored = {
    ...defaults,
    ...saved,
    machines,
    flights: Array.isArray(saved?.flights) ? saved.flights : [],
    stats: { ...defaults.stats, ...(saved?.stats || {}) },
  };
  const highestId = restored.machines.reduce((highest, machine) => {
    const number = Number.parseInt(String(machine.id).replace("m-", ""), 10);
    return Number.isFinite(number) ? Math.max(highest, number) : highest;
  }, 5);
  nextMachineNumber = highestId + 1;
  nextFlightNumber = restored.flights.reduce((highest, flight) => {
    const number = Number.parseInt(String(flight.id).replace("f-", ""), 10);
    return Number.isFinite(number) ? Math.max(number, highest) : highest;
  }, 0) + 1;
  return restored;
}
