# Run Planner

Run Planner is a standalone Hades II route-authoring and simulation
application for Run Director. It owns the supported catalog, authored route,
deterministic game-language history, possibility and eligibility evaluation,
validation, findings, editor projections, profiles, recovery, and undo/redo.
The future game module will consume a validated execution plan and audit live
runtime behavior; it is not a second planner or simulator.

## Architecture

The repository is split by ownership:

```text
packages/hades2-catalog   Hades II declarations and catalog construction
packages/planner-engine   pure authored model, reward kernel, simulation, and validation
apps/planner              application composition, Redux session state, and React UI
```

The dependency direction is:

```text
catalog construction -> pure planner engine <- application composition -> React UI
```

Immutable catalog declarations and authored project state are the durable
semantic inputs. Materialization, history, validation, candidates, findings,
and UI projections are replaceable derived products. Simulation models
possibility, not probability. Game Room Declarations are unique; authored Room
Occurrences are repeatable and own stable persisted IDs. Incomplete and
context-invalid authored states remain editable, and UI-session state never
enters authored history.

## Documentation

Use the smallest authority that answers the question:

- [Architecture](docs/design/ARCHITECTURE.md), [catalog model](docs/design/CATALOG_MODEL.md),
  [authored project](docs/design/AUTHORED_PROJECT_MODEL.md),
  [reward model](docs/design/REWARD_MODEL.md),
  [room lifecycle](docs/design/ROOM_LIFECYCLE_MODEL.md), and
  [simulation and validation](docs/design/SIMULATION_AND_VALIDATION.md) define
  cross-cutting design.
- [Biome rules](docs/biomes/) contain the route authorities.
- [Editor ownership](docs/design/EDITOR_MODEL.md), [contextual UX](docs/design/CONTEXTUAL_EDITOR_UX.md),
  and [structured workspace](docs/design/STRUCTURED_EDITOR_WORKSPACE.md) define
  application/editor boundaries.
- [Source audit map](docs/audits/README.md) routes source evidence by subject.
- [Progress](docs/progress/IMPLEMENTATION_PROGRESS.md) records durable delivery
  history.

## Quickstart

The repository uses the Linux-native Node installation selected by `.nvmrc`.
From the repository root in WSL:

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
npm install
npm run dev
```

Activating `nvm` matters when Windows npm also appears in the WSL `PATH`;
workspace symlinks must be created by Linux npm.

## Development and validation

```bash
npm run check          # complete typecheck, tests, lint, format, and build gate
npm run test:changed   # tests related to uncommitted source/test changes
npm run test:ui        # React component and editor fixtures
npm run test:planner   # planner, UI, architecture, and workspace support
npm run test:contract  # application architecture and workspace contracts
npm run test:product   # browser product loops
npm run test:engine    # authored model, simulator, and validation
npm run test:catalog   # declaration and catalog construction
```

Individual `typecheck`, `lint`, `format:check`, `build`, and `test:watch`
scripts are also available. Use the narrowest truthful lane while developing;
configuration, dependency, shared setup, and cross-layer changes require the
complete gate.

## Desktop preview

The desktop host wraps the same production Vite build without adding
Rust-side domain behavior. Its native Open/Save flow remembers the selected
project file and overwrites it on later saves; the browser build retains
portable upload/download behavior. On a machine with the platform's Tauri
prerequisites:

```bash
npm run desktop:dev
npm run desktop:build
```

To cross-build the portable Windows executable directly from WSL, install the
Rust target once and run the dedicated build command:

```bash
sudo apt install gcc-mingw-w64-x86-64-posix
rustup target add x86_64-pc-windows-gnu
npm run desktop:build:windows
```

The executable is written to
`apps/planner/src-tauri/target/x86_64-pc-windows-gnu/release/run-planner.exe`.

## Source evidence

The earlier Lua/ImGui prototype is retained at
`../run-director-modpack/Submodules/adamantRunDirector-Run_Planner/` as
historical evidence, and the game-data reference is at
`../../1GameData/Scripts/`. Neither is imported at runtime. Verified rules move
into the catalog, simulator, and focused fixtures; the prototype's control,
storage, draw, and lifecycle machinery is not an API contract.
