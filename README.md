# Factory prototype

An idle factory layer built on top of a falling-sand cellular automata grid, presented as a mechanical browser prototype.

## Machines & materials

This is the complete interaction reference for the current runtime. The simulation moves real field pixels. Machines do not use hidden inventories or production buffers.

### Machine interactions

| Machine | Input / contact | Result |
| --- | --- | --- |
| Heat bank | Fire, sparks, or lava touching any outside edge | Stores heat, up to 100. Heat slowly decays, then transfers to machines that share a full 8-pixel edge. |
| Conveyor belt | A contiguous pile directly above a connected belt line | Moves the pile one field cell per belt step, left or right. A blocked run stops together and reports `waiting for input` only when it cannot move its payload. |
| Launcher | Material inside its 8 x 8 no-collision body | Catches the pixels before they fall out, then launches them along a visible ballistic arc. Drag left or right to aim. Flights stop at a machine, another material, the edge of the field, or after 40 cells. |
| Melter | Sand, wet sand, or gold touching an outside edge, plus at least 4 stored heat and a touching hot machine or heat bank | Sand and wet sand become physical liquid glass. Gold becomes physical liquid gold. Each melt costs 4 heat. |
| Filter | Any material crossing its footprint | In `allow selected` mode, only checked materials pass. In `block selected` mode, checked materials are blocked and everything else passes. It has no timer or buffer. |
| Wall | Material attempting to cross its occupied cells | Blocks movement. A straight drag creates full blocks. A diagonal drag creates half-block slopes. |

Machine-to-machine rules:

- Every machine occupies one 8 x 8 bay. New placements cannot overlap another bay unless `ctrl` is held while placing.
- A heat bank shares heat only with machines touching its footprint edge. Diagonal contact does not transfer heat.
- A conveyor line is one connected horizontal or vertical run. Segments only move together when they have the same direction.
- A machine is an overlay on the field. Existing sand, water, lava, and other pixels do not prevent placement, except for machine overlap rules.
- Walls and filters block material according to their shape or rule. Launchers are the exception: their body is a no-collision capture area, so material can enter it before being launched.

### Material interactions

| Material | Movement | Interactions |
| --- | --- | --- |
| Sand | Falls, then slides diagonally when blocked | Sinks through water and oil. Sand touching water converts both pixels into wet sand. Sand touching lava becomes glass. |
| Water | Falls, slides, and spreads sideways up to two cells | Sinks through oil. Contact with fire turns both pixels into steam. Contact with lava turns the water into steam and slightly cools the lava. Water on a powered melter becomes steam and costs 1 heat per pixel. |
| Wet sand | Falls and slides slowly; denser than dry sand | Slowly sinks through sand and displaces water or oil. It is accepted by a heated melter and becomes liquid glass. |
| Fire | Rises, drifts sideways when blocked, then expires | Can ignite wood and oil. Water contact turns both pixels into steam. It emits smoke while burning and acts as a heat source for nearby heat banks and machines. |
| Lava | Flows as a dense liquid and slowly cools | Sinks through water and oil. Water becomes steam. Sand becomes glass. It can ignite wood, oil, gunpowder, and plant, and can emit fire and smoke. When its lifetime ends it becomes stone. |
| Spark | Rises like a short-lived heat particle | Charges nearby heat banks and machines. It ages out even when trapped, becoming air. |
| Oil | Flows as a light liquid and stays above water | Sand, wet sand, water, acid, and lava can move through or displace it according to their density. Fire and lava can ignite it. Acid can dissolve it. |
| Acid | Flows like a liquid and sinks below water and oil | Slowly dissolves adjacent sand, wood, stone, and oil. A successful dissolve consumes the acid pixel. |
| Steam | Rises and drifts | Expires back into water. It can displace water while moving. |
| Smoke | Rises and drifts | Expires into air. |
| Gold | Falls and slides like sand, but is denser | Can be fed into a heated melter to produce liquid gold. |
| Liquid glass | Falls and spreads as a heavy liquid for about 30 seconds | Displaces air, water, and oil. It cools into glass after about 30 seconds. A powered heater directly underneath resets its timer and keeps it liquid. |
| Liquid gold | Falls and spreads as a heavy liquid | Displaces air, oil, sand, water, and wet sand. It cools into gold. |
| Wood | Static solid | Can be ignited by fire or lava and dissolved by acid. |
| Stone | Static solid | Acts as a stable barrier. Lava eventually cools into stone. |
| Glass | Static solid | Is produced by lava touching sand or liquid glass cooling. It is not dissolved by the current acid rules. |
| Ice, gunpowder, plant, metal, spawner, residue | Registered material types | These are present in the element registry or legacy rules, but are not currently paintable from the toolbar and do not have a complete active simulation rule in this runtime. |

The current toolbar paints sand, water, fire, lava, and sparks. Wet sand, steam, smoke, glass, liquid glass, liquid gold, and cooled outputs are created by simulation. The other registered materials remain available to the data model for future tools and interactions.

## Controls

- Space pauses or runs the simulation.
- 1, 2, 3, 4, and 5 select sand, water, fire, lava, and spark.
- H selects a heat bank, C selects a conveyor belt, L selects a launcher, M selects a melter, F selects a filter, and W selects a wall.
- Drag with the conveyor tool to place a line. Drag the launcher tool to aim up-left or up-right, or click for its default sprite.
- Drag the wall tool horizontally or vertically for full blocks. A diagonal drag places diagonally cut half-block slopes.
- V returns to inspect mode.
- E paints air to erase material.
- G toggles the 8 x 8 build grid.
- Delete removes the selected machine.
- Ctrl+S saves the current grid and factory to local storage.

One heat bank is already installed beside a small pinned flame. Place machines into any 8 x 8 bay that does not already contain another machine, even when material is passing through it. Paint material into the field to experiment with the material layer directly.

## Run

```powershell
python serve.py
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000).

## Architecture

- `js/grid.js` owns the double-buffered `Uint32Array` state and serialization.
- `js/simulation.js` performs the alternating bottom-up cellular automata sweep.
- `js/renderer.js` writes one `ImageData` buffer per frame, then draws the 8 x 8 PNG machine sprites.
- `js/factory.js` owns 8 x 8 machine occupancy, conveyor and launcher movement, physical melting, wall collision masks, heat transfer, and persistence data. It does not own a separate material queue.
- `js/main.js` connects the two layers to the controls and local save.

Basic machines have no power cost. The heat bank is a separate thermal state: touching fire, sparks, or lava charges it; heat then bleeds into machines sharing an 8-pixel edge. Water resting on a powered melter becomes steam and consumes stored heat. Wet sand uses a slower dense-material rule, so it settles through dry sand over time. Lava can emit short-lived fire above itself. A melter beside a hot machine changes touching sand into liquid glass and touching gold into liquid gold. Both molten materials fall and spread as real field pixels before cooling.

The material layer follows the structure and techniques shown in [Mahnoor-Zaffar's falling-sand simulator](https://github.com/Mahnoor-Zaffar/The-2D-Falling-Sand-Physics-Simulator): double buffers, packed cells, bottom-up alternating sweeps, element-owned rules, and a Bresenham brush. The factory layer is original code over that grid. Liquid glass uses a deterministic 30-second cooling timer and is reheated while directly supported by a powered heat bank or heated machine. Machine behavior follows the documented [Sandustry water rules](https://wiki.hoodedhorse.com/Sandustry/Water), [wet sand reaction](https://wiki.hoodedhorse.com/Sandustry/Wet_Sand), and [shaker behavior](https://wiki.hoodedhorse.com/Sandustry/Shaker).

`assets/machine-sprites.png` is a 64x24 atlas of 8x8 sprites. Its first row is wall, two slopes, single conveyor, left-end right, left-end left, right-end right, and right-end left. Its second row is middle conveyor right, middle conveyor left, heat bank, launcher right, launcher left, launcher default, melter, and the pointer cursor. Its third row begins with the single conveyor sprites for right and left. `assets/cursor-large.png` is a 4x nearest-neighbor upscale of that final tile and is used across the page. The browser cursor is hidden over the canvas, where the original 8x8 tile is drawn at the active material-field cell.
