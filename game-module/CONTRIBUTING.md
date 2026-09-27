# Development

This directory contains the Hades II game module for Run Planner. The planner
owns authoring, simulation, and validation. This module consumes its published
execution plans; it is not a second planner or simulator. Ownership rules for
this lane live in the repository's `AGENTS.md`.

## Layout

- `src/` — the active Hades II module.
- `tests/` — Lua unit and integration tests.

Within `src/mods/`, code is grouped by runtime responsibility: host and protocol
integration, route navigation, room behavior, timeline interactions, and
modeled traits or keepsakes.

The tests read the planner's execution fixtures in place from
`packages/planner-engine/test/execution-plan/fixtures/`; there is no module-local
copy.

## Checks

From the repository root, run the Lua suite and Luacheck together:

```sh
npm run test:game-module
```

This parses every Lua file under `src/` and `tests/` with `luac -p`, then runs
`lua tests/all.lua` and `luacheck src` from `game-module/`. It requires Lua 5.2
with LuaUnit and Luacheck installed from LuaRocks.

`manifest.template.json` is the source of the package manifest; the release
build adds `version_number`.

`README.md` is the player-facing introduction; keep implementation and
development details here.
