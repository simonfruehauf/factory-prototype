# Factory prototype

## Direction

Mechanical browser prototype. The interface uses native controls and a simple document flow so the simulation, tools, and current values stay visible without a visual identity.

## World

- Browser-default colors, type, buttons, and form controls.
- Minimal layout CSS exists only to keep tools, field, inspector, and runtime values readable and contained.
- The simulation canvas is the primary surface. The factory layer stays as simple geometry and labels required to operate the prototype.

## First viewport

The first screen exposes the tool list, simulation controls, live field, inspector, and material values. The first run starts with physical sand, water, wet sand, lava, sparks, and one heat bank beside a flame.

## Signature interaction

The player places an 8x8 machine footprint on the snapped build grid. Conveyor drag creates a line, launcher drag sets its diagonal aim, and wall drag creates full blocks or diagonal half-block slopes. The selected machine reports its direction, heat state, status, and progress.

## Responsive behavior

On narrow screens the tool list and production values stack, and the simulation preserves its aspect ratio without overflowing the viewport.

## Surface rules

- Keep the mechanical state legible without stopping the simulation.
- Show selected states with native button state and text.
- Use labels and geometry when the canvas needs color to distinguish materials.
