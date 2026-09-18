# Factory prototype improvement plan

## North star

Keep the original shell recognizable while making the first production loop readable, tactile, and reliable. The falling-sand field stays the main event, and every click should produce an obvious state change.

## Pass 1: preserve the shell and clarify progression

- Restore the original layout shell and remove secondary telemetry that competes with the field, including the cycle number.
- Keep production goals in the progression panel, with plain language for the next target and the quarry overclock rule.
- Hide the full material palette until every production goal is complete. It is a post-progression sandbox tool, not a per-step unlock.

## Pass 2: make the field precise

- Use one stable yellow dotted outline for the active build area. Do not change its colour during the quarry overclock.
- Make the active area a hard rectangle on all four sides so falling materials cannot leak sideways or above the build space.
- Render machine sprites, procedural overlays, and borders on a pixel-aligned canvas with nearest-neighbour scaling.

## Pass 3: harden the play loop

- Make reset, save, pause, speed, grid, painting, drag placement, erase, expansion, and progression states explicit and reliable.
- Preserve local saves and the existing debug surface. Avoid new dependencies and keep the app static-host friendly.

## Verification rounds

1. Baseline runtime check: load, inspect logs, reset, play for one minute, and verify the starter loop changes state.
2. Desktop visual check: inspect the restored shell, canvas scale, sprite sharpness, and active-area outline.
3. Player review: run the first-minute loop again, test reset and progression visibility, and confirm the palette remains hidden until completion.
4. Independent review: use subagents to check the play loop, boundary behavior, and release regressions.

## Release bar

- The first useful action is clear without reading the readme.
- The player can tell what is running, what is blocked, and what to do next.
- The field owns the visual focus and remains usable at narrow widths.
- No runtime errors, dead controls, accidental overflow, or unacknowledged destructive states remain in the tested loop.
