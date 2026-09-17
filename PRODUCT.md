# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: dependency-free static HTML, CSS, and JavaScript with an HTML canvas simulation

## Users

Players who want a hands-on idle factory sandbox inspired by falling-sand cellular automata and Sandustry-style machine chains.

## Product Purpose

Let the player place machines on a discrete grid, feed them simulated materials, and watch an automated production loop grow over time. Success means the first screen makes the machine-to-material-to-output loop understandable and playable.

## Positioning

The core loop combines cellular-automata material motion with fixed-size 8x8 machine footprints and idle production. The player shapes a living material flow instead of only clicking upgrade buttons.

## Operating Context

Single-player browser play in a desktop-first control-room view, with a responsive layout for narrower screens. The simulation should remain useful while paused and continue producing while the player observes.

## Capabilities and Constraints

- Materials include sand-like solids, water-like liquids, wet sand, lava, sparks, molten glass, molten gold, and heat sources.
- Materials fall, spread, and react inside a visible grid.
- Machines occupy 8x8 pixels and run in place without power requirements.
- The player can place, inspect, and remove heat banks, conveyor lines, launchers, melters, and wall lines, paint materials, pause, speed up, reset, and save/load locally. Wall drags support full horizontal/vertical blocks and diagonal half-block slopes.
- The simulation layer should follow the supplied Mahnoor-Zaffar reference architecture: a double-buffered typed-array cellular automata grid, direct canvas pixel rendering, scan-direction alternation, and a requestAnimationFrame loop.
- The factory layer is an original overlay on top of that material grid, with 8x8 machine footprints snapped to a build grid and explicit input, output, direction, heat, and blockage states.
- Material interaction follows the documented Sandustry water, wet-sand, and shaker rules where those rules are defined. The machine implementation remains original code over the Mahnoor-style grid.

## Brand Commitments

The request references Sandustry and the linked falling-sand simulator as inspiration. This is an inspiration boundary, not a request to copy proprietary art or code.

## Evidence on Hand

The user supplied a falling-sand simulator repository and the Sandustry Vault flow page as references. No production assets, product name, or existing brand system were supplied.

## Product Principles

- Make the material flow visible and causally legible.
- Every machine placement should change the simulation, not just the interface.
- Keep the first useful action obvious within seconds.
- Reward planning with persistent, observable throughput.

## Accessibility & Inclusion

Use keyboard-accessible controls, visible focus states, text labels alongside color, and responsive containment. Do not make color the only way to identify a material or machine.
