# Run Planner

Run Planner is a standalone desktop planning and simulation application for
Hades II Run Director routes.

The application owns the sophisticated part of the product:

- route and biome authoring;
- room, encounter, and reward declarations;
- decision-tree editing;
- deterministic simulation;
- semantic validation and feedback;
- project persistence and undo/redo;
- eventual compilation of a declarative execution-plan document.

The game module is deliberately outside the current implementation scope. It
will eventually accept a JSON execution plan, translate that trusted document
through fixed runtime adapters, and audit the real game against the app's
simulation. It will not contain a second planner or simulator.

## Status

Phase 0 is complete: the TypeScript workspaces, pure core/catalog packages,
React/Vite shell, Redux application composition, and repository checks are in
place. Phase 1 begins with the focused F/G catalog foundation.

The previous Lua/ImGui planner remains a behavioral prototype and source of
verified domain decisions. It is not the architecture authority for this app.
Useful rules are brought forward deliberately; Lib controls, ImGui drawing,
managed-storage codecs, and module lifecycle contracts are not.

## Initial Technology Direction

The initial application stack is:

- TypeScript for the catalog, authored model, simulator, and UI;
- React for UI projection;
- Vite for development and builds;
- Redux Toolkit for explicit authored edit commands and application state;
- Vitest for catalog, model, simulation, and UI-adapter tests;
- shadcn/ui and Tailwind CSS for selectively adopted UI components;
- Tauri 2 later, after the browser-hosted app needs desktop file and packaging
  capabilities.

React Flow is not a foundation dependency. It may later provide an optional
graph projection, but it will never own topology or node identity.

## Documentation Reading Order

1. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) defines product boundaries,
   package dependencies, lifecycle, and technology responsibilities.
2. [`docs/CATALOG_MODEL.md`](docs/CATALOG_MODEL.md) defines declaration
   families, source evidence, normalization, and supported game-rule scope.
3. [`docs/REWARD_MODEL.md`](docs/REWARD_MODEL.md) defines reward primitives,
   payloads, counted bags, producer bindings, shops, and reward lifecycle
   semantics.
4. [`docs/F_G_GAME_RULES.md`](docs/F_G_GAME_RULES.md) defines the concrete F/G
   structure and generation rules for the first vertical slice.
5. [`docs/F_G_ROOM_TEMPLATES.md`](docs/F_G_ROOM_TEMPLATES.md) defines the
   app-native leaf contracts shared by F/G room declarations.
6. [`docs/AUTHORED_PROJECT_MODEL.md`](docs/AUTHORED_PROJECT_MODEL.md) defines
   persisted project state, topology ownership, identities, and edit commands.
7. [`docs/SIMULATION_AND_VALIDATION.md`](docs/SIMULATION_AND_VALIDATION.md)
   defines the pure derived pipeline, history, counters, validation, and
   findings.
8. [`docs/EDITOR_MODEL.md`](docs/EDITOR_MODEL.md) maps authored and derived
   state into the external editor without leaking UI structure into the
   domain.
9. [`docs/GAME_INTEGRATION_BOUNDARY.md`](docs/GAME_INTEGRATION_BOUNDARY.md)
   records the intentionally deferred app/game contract and conformance loop.
10. [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) defines the
    development order and acceptance gates.
11. [`docs/MIGRATION_PROVENANCE.md`](docs/MIGRATION_PROVENANCE.md) tracks the
    disposition and implementation status of inherited evidence.

These documents are one coherent design set. A rule belongs in exactly one
authority and should be referenced rather than copied elsewhere.

## Authority Boundaries

| Concern                                                                 | Authority                      |
| ----------------------------------------------------------------------- | ------------------------------ |
| Product layers, dependencies, lifecycle, and stack                      | `ARCHITECTURE.md`              |
| Declaration schema, provenance, normalization, and supported game facts | `CATALOG_MODEL.md`             |
| Reward vocabulary, composition, stores, shops, and offer semantics      | `REWARD_MODEL.md`              |
| Concrete F/G cross-room generation and topology rules                   | `F_G_GAME_RULES.md`            |
| F/G room-template leaf and materialization contracts                    | `F_G_ROOM_TEMPLATES.md`        |
| Authored state, persistence, topology, identity, and commands           | `AUTHORED_PROJECT_MODEL.md`    |
| Materialization, history, validation, feedback, and simulation          | `SIMULATION_AND_VALIDATION.md` |
| UI projection and interaction policy                                    | `EDITOR_MODEL.md`              |
| Future execution artifact and runtime audit                             | `GAME_INTEGRATION_BOUNDARY.md` |
| Delivery sequence and acceptance                                        | `IMPLEMENTATION_PLAN.md`       |
| Legacy evidence disposition and port verification status                | `MIGRATION_PROVENANCE.md`      |

## Architectural Spine

The app preserves the established planning cycle in a framework-independent
form:

```text
declarations
  -> normalized catalog
  -> authored project
  -> canonical materialization
  -> game-language history
  -> validation
  -> semantic findings
  -> editor presentation
```

The authored project and immutable declarations are the only durable semantic
inputs. History, validation, candidate decoration, and UI projections are
derived and replaceable.

Room Declarations are unique by Hades `gameName`. Authored Room Occurrences
have their own stable persisted IDs, so several offers may reference the same
game room without conflating their leaf state or feedback identity.

## Source Evidence

During migration, two existing sources remain useful evidence:

- `../run-director-modpack/Submodules/adamantRunDirector-Run_Planner/`
  contains the Lua prototype and its revamp documents;
- `../../1GameData/Scripts/` contains the game-data reference used to verify
  declarations and simulation rules.

Neither is imported at runtime. Once a rule has been ported and covered by app
fixtures, the app's catalog and simulator become its implementation authority.

## Current Scope

The first product slice is F with shared F/G foundations:

- explicit declarations;
- authored linear-biome topology;
- complete room and reward leaf defaults;
- materialized history;
- validation and semantic feedback;
- a usable editor with undo/redo.

Biome rollout remains F/G, H/I, N/O, then P/Q unless implementation evidence
shows a better dependency order.

## Development

The repository uses the Linux-native Node installation already managed by
`nvm`. From WSL:

```bash
cd /home/ayyatma/wsl-projects/modding/modpacks/RunPlanner
source "$HOME/.nvm/nvm.sh"
nvm use
npm install
npm run dev
```

Activating `nvm` is important on systems where Windows npm also appears in the
WSL `PATH`; workspace symlinks must be created by Linux npm.

Run the complete local validation suite with:

```bash
npm run check
```

Individual commands are available for `typecheck`, `test`, `lint`,
`format:check`, and `build`.

Implementation status is recorded separately in
[`docs/IMPLEMENTATION_PROGRESS.md`](docs/IMPLEMENTATION_PROGRESS.md).
