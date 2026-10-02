# Victory Summary

Status: locked 2026-10-02. Base: `b8c1af9b` (RunPlanner), ModpackLib `748710a` (4.1.0).

## Objective

The victory (RunClear) screen shows, beneath ModpackLib's `Modded` stamp, one
right-aligned planner line: `Planned through <room>` where `<room>` is the last
published occurrence the route cursor exited under the admitted plan
(for example `Planned through Erebus · Combat 11`). No line when no occurrence
was exited.

## Scope

Included: a generic ModpackLib victory region; one executor table with one
row-producing function; lib minimum bump to 4.2.0.
Excluded: planner application, engine, protocol, fixtures; biome-completion or
extent logic; any planner-specific lib API.

## Facts and simplifications

- Source fact: RunClear opens inside the final boss room before LeaveRoom
  (`PresentationBiomeI.lua:151`, `PresentationBiomeQ.lua:42` call
  `OpenRunClearScreen` after the kill), so on a synchronized session the
  current occurrence is the last room realized as planned. Otherwise
  `routeSession.exit` records `route.lastExitedOccurrence`; room disposal on
  mismatch or fault leaves the cursor at the unexited room, so the last exited
  occurrence is the fallback. Recovery admission (`newAt`) starts the cursor at
  the recovered index, so earlier rooms are never credited.
- Simplification: extent and biome boundaries are not consulted. Hub and
  transparent rooms never advance the cursor and never appear.

## Ownership

- ModpackLib `core/overlays` (gate 1, lib repo): new managed region
  `victoryStack`, right anchor beneath the stamp, `GroupName` shared with the
  stamp, HUD-independent, visible only while RunClear is open, the stamp is
  eligible and UI is not suppressed. Supports `createLine` and `createTable`
  with `order`. Modules still cannot create stamps. API.md region paragraph,
  CHANGELOG, version 4.2.0. Primary test: `tests/overlays/TestOverlays_Retained.lua`.
- Game module `host/` (gate 2, this repo): `roomName` moves from
  `room/guide.lua` to one shared owner; `createTable("victory-summary",
  { region = "victoryStack", maxRows = 4 })`; `afterHook("OnScreenOpened")` on
  `RunClear` sets rows from one `victoryRows(state)` function; manifest template
  dependency `adamant-ModpackLib-4.2.0`; host tests pin the new requirement.
  Primary tests: `tests/host/`, `tests/room/test_room_guide.lua`, game-host Rust.

## Gates

1. `feat(overlays): add the victoryStack region` in ModpackLib, then
   `chore(release): 4.2.0`.
2. `feat(game-module): show the planned-through room on the victory screen`.
3. Closure: delete this plan; API.md and game-module README own the durable
   description.

## Non-goals

Hiding the `Modded` stamp, reflowing other overlays on RunClear, a lib
callback API, per-line executor declarations.
