# Run Planner

Run Planner is a standalone Hades II route-authoring and simulation
application for Run Director. It owns the supported catalog, authored route,
deterministic game-language history, possibility and eligibility evaluation,
validation, findings, editor projections, profiles, recovery, and undo/redo.
The [Run Planner game module](https://github.com/h2pack-runplanner/adamantRunPlanner-Run_Planner)
consumes a validated execution plan and audits live
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
context-invalid authored states remain visible and repairable; chronological
authoring locks only the suffix beyond the engine-published authoring horizon.
UI-session state never enters authored history.

## Documentation

Start with [Architecture](docs/design/ARCHITECTURE.md) for dependency direction,
ownership and how to add a feature. Then use the relevant lane entry:

- [Catalog Model](docs/design/CATALOG_MODEL.md): source-backed declarations and
  normalization.
- [Planner Engine](docs/design/SIMULATION_AND_VALIDATION.md): authored inputs,
  evaluation products, chronology, candidates and findings.
- [Planner Application and Editor](docs/design/EDITOR_MODEL.md): composition,
  persistence, projections, interaction binding and presentation.

For a specific contract, go directly to its specialist authority:

- [Authored project](docs/design/AUTHORED_PROJECT_MODEL.md),
  [game generation](docs/design/GAME_GENERATION_RULES.md),
  [rewards](docs/design/REWARD_MODEL.md),
  [room lifecycle](docs/design/ROOM_LIFECYCLE_MODEL.md), and
  [candidate evaluation](docs/design/CANDIDATE_EVALUATION_MODEL.md) own the
  detailed engine contracts.
- [Structured workspace](docs/design/STRUCTURED_EDITOR_WORKSPACE.md) owns layout
  and workbenches; [contextual UX](docs/design/CONTEXTUAL_EDITOR_UX.md) owns
  picker and draft presentation.
- [Biome rules](docs/biomes/) contain the route authorities.
- [Game integration](docs/design/GAME_INTEGRATION_BOUNDARY.md) defines the
  compiler/executor contract; [biome execution navigation](docs/design/BIOME_EXECUTION_NAVIGATION.md)
  defines only the biome-specific execution work beyond the shared F/G
  baseline. The [feature-to-hook map](docs/audits/game-execution-contacts/FEATURE_HOOK_MAP.md)
  maps published planner facts to native contacts and explains each intervention.
- [Source audit map](docs/audits/README.md) routes source evidence by subject.

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
Rust-side domain behavior. Its native File menu remembers the last accepted
project file across restarts: Save overwrites that file, while Save As chooses
and activates another one. Autosave remains a separate recovery channel, so
recovered unsaved edits stay associated with their desktop file without
writing it implicitly. The browser build retains portable upload/download
behavior and exposes no duplicate Save As command. On a machine with the
platform's Tauri prerequisites:

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
