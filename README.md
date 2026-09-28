# Run Planner

Run Planner is a standalone Hades II route-authoring and simulation
application for Run Director. It owns the supported catalog, authored route,
deterministic game-language history, possibility and eligibility evaluation,
validation, findings, editor projections, profiles, recovery, and undo/redo.
The [Run Planner game module](game-module/) consumes a validated execution plan
and audits live runtime behavior; it is not a second planner or simulator.

## Architecture

The repository is split by ownership:

```text
packages/hades2-catalog   Hades II declarations and catalog construction
packages/planner-engine   pure authored model, reward kernel, simulation, and validation
apps/planner              application composition, Redux session state, and React UI
game-module               Hades II Lua module that executes published plans
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
npm run test:game-module  # game module Lua syntax, tests, and Luacheck
npm run test:game-host    # Rust game module package, target, install, and publication
```

Individual `typecheck`, `lint`, `format:check`, `build`, and `test:watch`
scripts are also available. The game host lane needs Rust (`cargo`). The game
module lane needs Lua 5.2 (`lua` and `luac`) with LuaUnit and Luacheck from LuaRocks on
`PATH`. Use the narrowest truthful lane while developing; configuration,
dependency, shared setup, and cross-layer changes require the complete gate.

## Desktop application

### Install

1. Download `RunPlanner-<version>-windows-x64-setup.exe` from the
   [latest release](https://github.com/maybe-adamant/RunPlanner/releases/latest).
   It needs 64-bit Windows 10 or 11; the installer fetches the Microsoft Edge
   WebView2 Runtime if it is missing.
2. Run the installer. It installs for your Windows account only and needs no
   administrator rights.
3. The installer is not code signed, so Windows SmartScreen may warn about an
   unrecognized app. Choose **More info**, then **Run anyway**.
4. Start **Run Planner** from the Start menu, then follow Game setup below.

Settings, the remembered project file and autosave recovery live in your
Windows profile, not the install folder, so an earlier portable build's data
carries over. Project files (`.runplanner.json`) stay wherever you save them.

Official releases check for updates without delaying startup, and About offers
a manual check. When an update is found, choose **Update**, then
**Install and restart**: the planner closes, installs the signed update
and reopens. If there are unsaved changes, the button is **Save and install**
and saves first; if the save is cancelled or fails, nothing is installed. If
the installer fails after the planner has closed, reopen Run Planner from the
Start menu and try again. **Later** hides the notice for this session; **Skip
this version** hides it until a newer release. Development builds do not check for
updates. Portable builds from before the installer do not detect installer
releases; install once manually to start receiving updates.

### Game setup

1. Install `adamant-ModpackLib` in your Hades II r2modman profile. r2modman
   also installs its dependencies. The planner reports ModpackLib and missing
   dependencies but never installs them.
2. In the desktop planner, open the **Game** panel. Under Game location, choose
   **Find r2modman profiles** and pick your profile, or **Choose folder…** for
   the folder that contains `ReturnOfModding` in a manual Hell2Modding install.
3. Follow the Game module steps, ending with **Install**. The module is built
   into the planner, so each planner release carries its matching module.
4. Under Plans in game, choose **Send here** on a slot. Later sends can use
   the header's **Send to game (slot N)**.

### Development

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

To cross-build the Windows executable directly from WSL, install the Rust
target once and run the dedicated build command:

```bash
sudo apt install gcc-mingw-w64-x86-64-posix
rustup target add x86_64-pc-windows-gnu
npm run desktop:build:windows
```

The executable is written to
`apps/planner/src-tauri/target/x86_64-pc-windows-gnu/release/run-planner.exe`.

The manually dispatched **Windows release** workflow builds and signs the
installer, installs and launch-tests it, and publishes the release. It embeds
the release version and source commit shown in About, uploads the installer,
its updater signature and `latest.json` to a draft, then publishes it. It
needs the `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
repository secrets and refuses to build while `plugins.updater.pubkey` in
`apps/planner/src-tauri/tauri.conf.json` is the placeholder. Its `dry_run`
input builds, signs and launch-tests without tagging or publishing. Each
published version identifies one build; choose a new version for a new build.
Run `npm run check` locally on the commit being
released before dispatching it; packaging does not repeat that repository gate.
The separate **Desktop host** workflow checks Windows Rust compilation and runs
the game host crate tests on Linux, and the
**Game module** workflow runs `npm run test:game-module`, on pull requests and
pushes to `main`.

The app's compatible-loading baseline is schema 86. Current files open without
conversion; future approved schema changes must supply explicit migrations and
original-file preservation. Older files still need the relevant offline tool
from [`schema/README.md`](schema/README.md).
