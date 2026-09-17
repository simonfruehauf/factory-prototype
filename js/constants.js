/* ========================================================================
   constants.js — Element IDs, Grid Dimensions, Colors, Physics Tunables
   ======================================================================== */

// Grid dimensions
export const GRID_W = 384;
export const GRID_H = 256;
export const CELL_COUNT = GRID_W * GRID_H;

// ── Element IDs (stored in bits 0–7 of each cell) ──────────────────────
export const AIR       = 0;
export const SAND      = 1;
export const WATER     = 2;
export const FIRE      = 3;
export const WOOD      = 4;
export const STONE     = 5;
export const OIL       = 6;
export const ACID      = 7;
export const STEAM     = 8;
export const SMOKE     = 9;
export const LAVA      = 10;
export const ICE       = 11;
export const GUNPOWDER = 12;
export const PLANT     = 13;
export const GLASS     = 14;
export const METAL     = 15;
export const SPAWNER   = 16;
export const WET_SAND  = 17;
export const GOLD      = 18;
export const RESIDUE   = 19;
export const SPARK     = 20;
export const LIQUID_GLASS = 21;
export const LIQUID_GOLD  = 22;
export const GRIT         = 23;
export const CONCENTRATE  = 24;
export const QUARTZ       = 25;
export const INGOT        = 26;

// ── Bit-packing layout ─────────────────────────────────────────────────
//   bits  0–7  : element ID
//   bits  8–19 : lifetime / metadata (used by Fire, Lava, Steam, Smoke, Spawner)
//   bit  20   : Fire is waiting to dissipate
//   bit  21   : Spark is waiting to dissipate
export const ID_MASK        = 0x000000FF;
export const LIFETIME_MASK  = 0x000FFF00;
export const LIFETIME_SHIFT = 8;
export const FIRE_DISSIPATING_FLAG = 0x00100000;
export const SPARK_DISSIPATING_FLAG = 0x00200000;
// Liquid flow direction metadata. No flag means the particle starts moving right.
export const LIQUID_LEFT_FLAG  = 0x00400000;
export const LIQUID_RIGHT_FLAG = 0x00800000;

// ── Gravity directions ─────────────────────────────────────────────────
export const GRAVITY_DOWN  = 0;
export const GRAVITY_UP    = 1;
export const GRAVITY_LEFT  = 2;
export const GRAVITY_RIGHT = 3;

// ── Physics tunables ───────────────────────────────────────────────────

// Fire
export const FIRE_LIFETIME_MIN   = 30;
export const FIRE_LIFETIME_MAX   = 90;
export const FIRE_SPREAD_CHANCE  = 0.08;
export const FIRE_SMOKE_CHANCE   = 0.04;
export const FIRE_DISSIPATION_DELAY_MIN = 1;
export const FIRE_DISSIPATION_DELAY_MAX = 3;

// Steam
export const STEAM_LIFETIME_MIN  = 80;
export const STEAM_LIFETIME_MAX  = 200;

// Smoke
export const SMOKE_LIFETIME_MIN  = 20;
export const SMOKE_LIFETIME_MAX  = 60;

// Oil
export const OIL_DISPERSION_MAX  = 1;
export const OIL_IGNITE_CHANCE   = 0.50;

// Acid
export const ACID_DISPERSION_MAX       = 1;
export const ACID_DISSOLVE_CHANCE_SAND  = 0.15;
export const ACID_DISSOLVE_CHANCE_WOOD  = 0.12;
export const ACID_DISSOLVE_CHANCE_STONE = 0.03;
export const ACID_DISSOLVE_CHANCE_OIL   = 0.10;
export const ACID_DISSOLVE_CHANCE_METAL = 0.06;
// Glass is immune to acid (chance = 0)

// Water
export const WATER_DISPERSION_MAX = 2;
export const WET_SAND_SINK_CHANCE = 0.18;
export const WET_SAND_FALL_CHANCE = 0.45;

// Sparks are short-lived heat sources that rise like small fire particles.
export const SPARK_LIFETIME_MIN = 24;
export const SPARK_LIFETIME_MAX = 64;
export const SPARK_DISSIPATION_DELAY_MIN = 1;
export const SPARK_DISSIPATION_DELAY_MAX = 3;

// Lava
export const LAVA_LIFETIME_MIN   = 120;
export const LAVA_LIFETIME_MAX   = 255;
export const LAVA_COOL_CHANCE    = 0.004;
export const LAVA_DISPERSION_MAX = 1;
export const LAVA_IGNITE_CHANCE  = 0.60;
export const LAVA_FIRE_CHANCE    = 0.0025;

// Molten outputs cool slowly while remaining physical liquid pixels.
export const MOLTEN_COOL_CHANCE = 0.002;
export const LIQUID_GLASS_LIFETIME = 1500;
export const LIQUID_GOLD_LIFETIME = 255;
export const MOLTEN_DISPERSION_MAX = 1;

// Ice
export const ICE_MELT_CHANCE     = 0.02;
export const ICE_FREEZE_CHANCE   = 0.008;

// Gunpowder
export const GUNPOWDER_EXPLODE_RADIUS = 8;

// Plant
export const PLANT_GROW_CHANCE       = 0.01;
export const PLANT_GROW_WATER_RANGE  = 3;

// ── Color palette — [R, G, B] ─────────────────────────────────────────
export const COLORS = {
  [AIR]:       [10, 14, 23],
  [SAND]:      [224, 192, 104],
  [WATER]:     [64, 128, 255],
  [FIRE]:      [255, 96, 32],
  [WOOD]:      [139, 94, 60],
  [STONE]:     [136, 140, 152],
  [OIL]:       [60, 40, 80],
  [ACID]:      [120, 255, 60],
  [STEAM]:     [180, 200, 220],
  [SMOKE]:     [60, 60, 70],
  [LAVA]:      [255, 80, 20],
  [ICE]:       [160, 210, 240],
  [GUNPOWDER]: [90, 80, 75],
  [PLANT]:     [50, 160, 60],
  [GLASS]:     [180, 210, 230],
  [METAL]:     [170, 175, 185],
  [SPAWNER]:   [255, 255, 100],
  [WET_SAND]:  [164, 143, 103],
  [GOLD]:      [232, 184, 63],
  [RESIDUE]:   [118, 105, 88],
  [SPARK]:     [255, 210, 104],
  [LIQUID_GLASS]: [255, 152, 72],
  [LIQUID_GOLD]:  [255, 198, 54],
  [GRIT]:        [170, 158, 132],
  [CONCENTRATE]: [86, 74, 62],
  [QUARTZ]:      [202, 220, 226],
  [INGOT]:       [236, 226, 178],
};

// Per-element color variation ranges for visual richness
export const COLOR_VARIATION = {
  [SAND]:      { r: [-12, 12], g: [-10, 10], b: [-8, 8] },
  [WATER]:     { r: [-8, 8],   g: [-6, 12],  b: [-5, 10] },
  [FIRE]:      { r: [-20, 0],  g: [-40, 40], b: [-10, 20] },
  [WOOD]:      { r: [-10, 10], g: [-8, 8],   b: [-5, 5] },
  [STONE]:     { r: [-6, 6],   g: [-6, 6],   b: [-4, 4] },
  [OIL]:       { r: [-8, 8],   g: [-5, 5],   b: [-10, 10] },
  [ACID]:      { r: [-10, 10], g: [-8, 8],   b: [-12, 12] },
  [STEAM]:     { r: [-8, 8],   g: [-6, 6],   b: [-4, 4] },
  [SMOKE]:     { r: [-8, 8],   g: [-8, 8],   b: [-6, 6] },
  [LAVA]:      { r: [-15, 0],  g: [-30, 30], b: [-10, 10] },
  [ICE]:       { r: [-6, 6],   g: [-4, 8],   b: [-3, 5] },
  [GUNPOWDER]: { r: [-8, 8],   g: [-6, 6],   b: [-5, 5] },
  [PLANT]:     { r: [-8, 12],  g: [-15, 15], b: [-8, 8] },
  [GLASS]:     { r: [-4, 4],   g: [-3, 3],   b: [-2, 2] },
  [METAL]:     { r: [-5, 5],   g: [-5, 5],   b: [-4, 4] },
  [SPAWNER]:   { r: [-5, 5],   g: [-5, 5],   b: [-5, 5] },
  [WET_SAND]:  { r: [-8, 8],   g: [-8, 8],   b: [-6, 6] },
  [GOLD]:      { r: [-10, 10], g: [-8, 8],   b: [-5, 5] },
  [RESIDUE]:   { r: [-8, 8],   g: [-7, 7],   b: [-5, 5] },
  [SPARK]:     { r: [-18, 18], g: [-12, 12], b: [-8, 8] },
  [LIQUID_GLASS]: { r: [-12, 12], g: [-12, 12], b: [-8, 8] },
  [LIQUID_GOLD]:  { r: [-12, 12], g: [-10, 10], b: [-6, 6] },
  [GRIT]:        { r: [-10, 10], g: [-8, 8], b: [-6, 6] },
  [CONCENTRATE]: { r: [-8, 8], g: [-7, 7], b: [-5, 5] },
  [QUARTZ]:      { r: [-8, 8], g: [-6, 6], b: [-4, 4] },
  [INGOT]:       { r: [-4, 4], g: [-4, 4], b: [-3, 3] },
};

// ── Element registry (for UI generation) ───────────────────────────────
export const ELEMENTS = [
  { id: SAND,      name: "Sand",      key: "1", color: "#E0C068", type: "solid" },
  { id: WATER,     name: "Water",     key: "2", color: "#4080FF", type: "liquid" },
  { id: FIRE,      name: "Fire",      key: "3", color: "#FF6020", type: "gas" },
  { id: WOOD,      name: "Wood",      key: "4", color: "#8B5E3C", type: "solid" },
  { id: STONE,     name: "Stone",     key: "5", color: "#888C98", type: "solid" },
  { id: OIL,       name: "Oil",       key: "6", color: "#3C2850", type: "liquid" },
  { id: ACID,      name: "Acid",      key: "7", color: "#78FF3C", type: "liquid" },
  { id: STEAM,     name: "Steam",     key: "8", color: "#B4C8DC", type: "gas" },
  { id: LAVA,      name: "Lava",      key: "9", color: "#FF5014", type: "liquid" },
  { id: ICE,       name: "Ice",       key: "0", color: "#A0D2F0", type: "solid" },
  { id: GUNPOWDER, name: "Powder",    key: "G", color: "#5A504B", type: "solid" },
  { id: PLANT,     name: "Plant",     key: "P", color: "#32A03C", type: "solid" },
  { id: GLASS,     name: "Glass",     key: "L", color: "#B4D2E6", type: "solid" },
  { id: METAL,     name: "Metal",     key: "M", color: "#AAAFB9", type: "solid" },
  { id: SPAWNER,   name: "Spawner",   key: "F", color: "#FFFF64", type: "tool" },
  { id: SPARK,     name: "Spark",     key: "K", color: "#FFD268", type: "gas" },
  { id: LIQUID_GLASS, name: "Liquid glass", key: "", color: "#FF9848", type: "liquid" },
  { id: LIQUID_GOLD,  name: "Liquid gold",  key: "", color: "#FFC636", type: "liquid" },
  { id: GRIT, name: "Grit", key: "", color: "#AA9E84", type: "solid" },
  { id: CONCENTRATE, name: "Concentrate", key: "", color: "#564A3E", type: "solid" },
  { id: QUARTZ, name: "Quartz", key: "", color: "#CADCE2", type: "solid" },
  { id: INGOT, name: "Ingot", key: "", color: "#ECE2B2", type: "solid" },
];

export const FILTER_MATERIALS = [
  ...ELEMENTS.filter((element) => element.id !== SPAWNER),
  { id: WET_SAND, name: "Wet sand", color: "#A48F67", type: "solid" },
  { id: GOLD, name: "Gold", color: "#E8B83F", type: "solid" },
  { id: SMOKE, name: "Smoke", color: "#3C3C46", type: "gas" },
  { id: RESIDUE, name: "Residue", color: "#766958", type: "solid" },
  { id: GRIT, name: "Grit", color: "#AA9E84", type: "solid" },
  { id: CONCENTRATE, name: "Concentrate", color: "#564A3E", type: "solid" },
  { id: QUARTZ, name: "Quartz", color: "#CADCE2", type: "solid" },
  { id: INGOT, name: "Ingot", color: "#ECE2B2", type: "solid" },
];

// Density ordering (higher = sinks below lower)
export const DENSITY = {
  [AIR]:       0,
  [SMOKE]:     3,
  [STEAM]:     5,
  [FIRE]:      2,
  [OIL]:       40,
  [WATER]:     60,
  [ACID]:      70,
  [SAND]:      100,
  [GUNPOWDER]: 105,
  [WOOD]:      200,
  [PLANT]:     200,
  [ICE]:       90,
  [GLASS]:     210,
  [METAL]:     230,
  [STONE]:     255,
  [LAVA]:      150,
  [SPAWNER]:   255,
  [WET_SAND]:  150,
  [GOLD]:      300,
  [RESIDUE]:   120,
  [SPARK]:     4,
  [LIQUID_GLASS]: 140,
  [LIQUID_GOLD]:  320,
  [GRIT]:        135,
  [CONCENTRATE]: 180,
  [QUARTZ]:      220,
  [INGOT]:       255,
};

// Elements that emit glow for bloom post-processing
export const GLOW_ELEMENTS = new Set([FIRE, LAVA, ACID, SPARK]);

export const BUILD_SIZE = 8;
export const START_AREA_BAYS = 10;
// The reference still advances one cellular step at a time. This clock is
// intentionally a little slower than a 60 Hz animation frame.
export const SIM_STEP = 1 / 50;

export const MACHINE_META = {
  quarry: { label: "quarry", short: "Q", cycle: 3, color: "#766958", input: "residue seam", output: "5-8 residue", detail: "releases a batch of 5-8 physical residue cells every 3 seconds" },
  "area-counter": { label: "area counter", short: "A", cycle: 0, color: "#4A9D9A", input: "preselected material inside connected counters", output: "live count / collected stock", detail: "counts and collects the preselected material inside edge-connected counters of the same material" },
  sifter: { label: "sifter", short: "S", cycle: 0.42, color: "#B39B72", input: "residue", output: "grit / concentrate", detail: "separates residue into grit and concentrate" },
  washer: { label: "washer", short: "U", cycle: 0.65, color: "#4D9CC2", input: "grit + water", output: "quartz", detail: "washes grit into quartz" },
  pump: { label: "water pump", short: "P", cycle: 0.7, color: "#4080FF", input: "groundwater", output: "water", detail: "adds physical water to the field" },
  furnace: { label: "furnace", short: "N", cycle: 0.8, color: "#E7724D", input: "concentrate + heat", output: "gold", detail: "refines concentrate with stored heat" },
  "gold-press": { label: "gold press", short: "G", cycle: 0, color: "#E8B83F", input: "gold charge", output: "paired ingot", detail: "holds a 64-cell gold charge for the paired press" },
  "quartz-press": { label: "quartz press", short: "Z", cycle: 0, color: "#CADCE2", input: "quartz charge", output: "paired ingot", detail: "holds a 64-cell quartz charge for the paired press" },
  "heat-bank": { label: "heat bank", short: "H", cycle: 0, color: "#e7724d", input: "fire / sparks / lava", output: "stored heat", detail: "stores heat from touching sources and shares it with touching machines", heatCapacity: 100 },
  conveyor: { label: "conveyor belt", short: "C", cycle: 0.14, color: "#6faeaa", input: "material on top", output: "pile moved one cell", detail: "moves a contiguous physical pile along its direction" },
  launcher: { label: "launcher", short: "L", cycle: 0.12, color: "#a88ce3", input: "material inside", output: "ballistic arc", detail: "accepts pixels inside its no-collision body and launches them on an arc" },
  melter: { label: "melter", short: "M", cycle: 0.75, color: "#f08a55", input: "sand / gold + heat", output: "liquid glass / liquid gold", detail: "melts touching sand or gold when it has heat" },
  filter: { label: "filter", short: "F", cycle: 0, color: "#5ea6c7", input: "selected materials", output: "allowed materials pass through", detail: "lets selected materials pass through while blocking the rest" },
  wall: { label: "wall", short: "W", cycle: 0, color: "#8e9794", input: "none", output: "solid barrier", detail: "blocks material movement; diagonal drags make half-block slopes" },
};
