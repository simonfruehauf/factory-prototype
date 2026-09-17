# Factory prototype

## Direction

1-bit operations console for a falling-sand factory. The interface takes its visual language from the supplied 8 x 8 sprite atlas: hard black marks, squared geometry, compact labels, visible bays, and state changes that read as deliberate pattern or signal changes.

## World

- Warm paper and ink are the base palette. Signal red is reserved for live and blocked runtime states.
- Borders, rules, and compact uppercase labels create the control-panel rhythm. No rounded cards, gradients, soft shadows, or decorative icon set.
- The sprite atlas is the tool vocabulary. Sprite previews are nearest-neighbour scaled and remain legible at their native 8 x 8 logic.
- The simulation canvas remains the primary instrument and keeps its physical material colors for causal readability. The surrounding UI stays monochrome.

## First viewport

The first screen exposes a strong factory prototype masthead, run and speed controls, a dense sprite-led build inventory, the live field, inspector state, progression targets, and cursor/material readout. The first run starts with physical sand, water, wet sand, lava, sparks, and one heat bank beside a flame.

## Signature interaction

The player places an 8x8 machine footprint on the snapped build grid. Conveyor drag creates a line, launcher drag sets its diagonal aim, and wall drag creates full blocks or diagonal half-block slopes. The selected machine reports its direction, heat state, status, and progress.

## Responsive behavior

On wide screens the layout is a three-zone console: tools, field, and inspector. Below 1000 pixels the tools stack into the main flow, and below 700 pixels the inspector follows the field. The simulation preserves its aspect ratio without overflowing the viewport.

## Surface rules

- Keep the mechanical state legible without stopping the simulation.
- Show selected states with native button state and text.
- Use labels and geometry when the canvas needs color to distinguish materials.
