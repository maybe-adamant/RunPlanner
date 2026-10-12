# Contributing to the Run Planner game module

This is the contributor guide for the Hades II mod in `game-module/`. The
player-facing introduction is [README.md](README.md); the repository-wide guide
is the root [CONTRIBUTING.md](../CONTRIBUTING.md).

## What it does

The planner owns authoring, simulation and validation. This module consumes
its published execution plans; it is not a second planner or simulator. At
each new run it decodes the active plan slot strictly, freezes it, steers the
native game through the plan's choices and checks the run against the plan's
published state, stopping at the first mismatch while native gameplay
continues. It also presents that status: the **Run Planner** window, drawn as
ModpackLib's standalone fallback window, the optional room guide and choice
highlights, and the victory-screen row. Ownership rules for this lane live in
the repository's [`AGENTS.md`](../AGENTS.md), and the contract with the planner
in [Game integration](../docs/design/GAME_INTEGRATION_BOUNDARY.md).

## Layout

- `src/` — the active Hades II module. `src/main.lua` creates the ModpackLib
  module and `src/mods/runtime/composition.lua` composes the runtime.
- `tests/` — Lua unit and integration tests; `tests/probes/` holds opt-in
  probes against the game's own scripts.

Within `src/mods/`, code is grouped by runtime responsibility: host and
protocol integration, route navigation, room behavior, timeline interactions,
and modeled traits or keepsakes. `src/mods/presentation/` holds everything that
only draws or formats: the status window, slot overview reader, room guide,
victory summary and planned-choice markers.

The presentation layer is fenced because the build identity excludes it.
`src/main.lua` is the only execution file that imports it; it attaches each
surface under pcall and passes read-only inspections and, for the status
window's slot picker, the active-slot write and inbox load capabilities.
Presentation must not import execution modules other than the JSON codec, the
inbox's slot-file names and `src/mods/host/presentation_hooks.lua`, and must
not write session, route, room, inbox, `CurrentRun` or game global state.
Anything that decides or changes execution stays outside it, even when it also
draws. Presentation registers hooks and overlay callbacks only through
`presentation_hooks.lua`, the build-covered hook boundary, so a presentation
failure is logged and never reaches the native chain or execution.
`tests/architecture/test_presentation_boundary.lua` rejects direct writes, and
writes through simple local aliases, by static scan; see [Game integration](../docs/design/GAME_INTEGRATION_BOUNDARY.md#distribution-and-the-game-target).

The tests read the planner's execution fixtures in place from
`packages/planner-engine/test/execution-plan/fixtures/`; there is no
module-local copy.

`manifest.template.json` is the source of the package manifest; the release
build adds `version_number`. Assembly also stamps `buildId`, a hash of the
`src/` payload outside `src/mods/presentation/`, into
`execution-compatibility.json`; the checked-in file carries no `buildId`.

## ModpackLib

The module is built on `adamant-ModpackLib`. The required version is the
`adamant-ModpackLib` dependency in `manifest.template.json`; raise it only when
the module needs a newer API. ModpackLib's source is the
`external/adamant-ModpackLib` submodule, pinned to a release tag and bumped with
each ModpackLib release. It is reference only: nothing builds against it, and
lint, format and tests skip `external/`. Before changing ModpackLib-facing code
(the window, overlays, the victory summary, configuration), read its `API.md`
and `CHANGELOG.md`.

## Checks

From the repository root, run the Lua suite and Luacheck together:

```sh
npm run test:game-module
```

This parses every Lua file under `src/` and `tests/` with `luac -p`, then runs
`lua tests/all.lua` and `luacheck src` from `game-module/`. It requires Lua 5.2
with LuaUnit and Luacheck installed from LuaRocks.

The probes under `tests/probes/` are not part of the suite. Each one's header
says how to run it from `game-module/` against the game's `Scripts` folder,
given as `HADES2_SCRIPTS_PATH` or as an argument:

```sh
HADES2_SCRIPTS_PATH=/path/to/Scripts lua tests/probes/test_generated_encounter_native.lua
lua tests/probes/test_inventory_native.lua /path/to/Scripts
```
