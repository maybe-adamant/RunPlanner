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
in the [Execution Protocol](../docs/design/EXECUTION_PROTOCOL.md) and its
sibling documents.

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

`src/main.lua` wires each presentation surface through `presentationSurface`,
which logs and skips a surface that fails to load or attach, and passes the
session, inbox and route inspection views it reads and, for the status window's
slot picker, the active-slot write and inbox load capabilities. Surfaces
register hooks and overlay callbacks through
`src/mods/host/presentation_hooks.lua`, which runs native base with its
original arguments, returns base's results unchanged except the allowlisted
map sub-icon decoration, and contains a presentation failure, logging it once,
so it does not reach the native chain or execution. Execution notifies the
planned-choice markers through the instance it is given.

The status window's only player actions are its slot picker, which writes
`active-slot.json`, and **Load**, which decodes the shown slot. Otherwise it
never decodes a plan: it describes slots from the
[slot overview](../docs/design/PLAN_SLOTS_AND_PUBLICATION.md#slot-overview),
which it reads with the active slot when it opens, on **Load** and after its
own write. It uses ModpackLib's module frame: the status header sits above one
tab bar of the module's tabs and Lib's **Advanced** tab. **Plan** picks the
next run's slot and describes it. **Current Run** shows the frozen session's
room progress, counted from a Practice start's room, and words its first
mismatch from the record's checkpoint and expected and observed values; an
unrecognized record is shown only as readable fields. **Diagnostics** is always
listed but shows its contents only in the module's Debug Mode: the raw slot
status, identities and records. The window draws ASCII only, because its ImGui
font has no other glyphs: names from the overview, the plan or the game are
shown with accented Latin letters folded to their base letters and common
punctuation folded to ASCII. It reports existing execution status without
adding conformance checks or revalidating player state while rendering.

The tests read the planner's execution fixtures in place from
`packages/planner-engine/test/execution-plan/fixtures/`; there is no
module-local copy.

`manifest.template.json` is the source of the package manifest; the release
build adds `version_number`. `src/execution-compatibility.json` names the plan
header the module admits: the format, catalog and the planner's authored schema
pair. It and the decoder's constants must change together with the planner's
`PROJECT_DOCUMENT_SCHEMA_VERSION` and `PROJECT_DOCUMENT_SCHEMA_REVISION`; the
fixture decode tests and the compatibility test hold them aligned. A
module-only change keeps the pair, so sent plans stay valid.

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
