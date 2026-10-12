# Contributing to Run Planner

Run Planner is a standalone Hades II route-authoring and simulation
application for Run Director. It owns the supported catalog, authored route,
deterministic game-language history, possibility and eligibility evaluation,
validation, findings, editor projections, profiles, recovery, and undo/redo.
The [Run Planner game module](game-module/) consumes a validated execution plan
and audits live runtime behavior; it is not a second planner or simulator.

Ownership lanes, placement rules and testing policy live in
[`AGENTS.md`](AGENTS.md). Player-facing documentation is the
[README](README.md).

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
- [In-game testing](docs/testing/) tracks pending live acceptance checks separately
  from implementation plans.
- [Game integration](docs/design/GAME_INTEGRATION_BOUNDARY.md) defines the
  compiler/executor contract; [biome execution navigation](docs/design/BIOME_EXECUTION_NAVIGATION.md)
  defines only the biome-specific execution work beyond the shared F/G
  baseline. The [feature-to-hook map](docs/audits/game-execution-contacts/FEATURE_HOOK_MAP.md)
  maps published planner facts to native contacts and explains each intervention.
- [Source audit map](docs/audits/README.md) routes source evidence by subject.
- [Game module](game-module/CONTRIBUTING.md) describes the module's layout,
  dependencies and checks.

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

Clone with `git clone --recurse-submodules`, or run
`git submodule update --init` afterwards, to fetch the ModpackLib source used
for reference under `external/adamant-ModpackLib`. Builds and tests do not need
it.

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

The app's compatible-loading baseline is schema 86. Current files open without
conversion; future approved schema changes must supply explicit migrations and
original-file preservation. Older files still need the relevant offline tool
from [`schema/README.md`](schema/README.md).

## Desktop development

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

## Release process

The manually dispatched **Release** workflow (`release.yml`) validates the
version and the `main` commit once, then calls the reusable **Build Windows**
and **Build Linux** workflows. Windows builds the NSIS installer; Linux builds
the AppImage on Ubuntu 22.04. Each build embeds the release version and source
commit shown in About, checks the bundle type stamped into the executable,
signs its updater asset (the installer or the AppImage), launch-tests it (the
AppImage under Xvfb), and uploads a workflow artifact. A single publish job
then creates one draft release, uploads every platform's assets with one
`latest.json` naming the Windows installer and the AppImage, and publishes it
once all are present. The workflow needs the `TAURI_SIGNING_PRIVATE_KEY` and
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` repository secrets and refuses to build
while `plugins.updater.pubkey` in `apps/planner/src-tauri/tauri.conf.json` is
the placeholder.

Its `dry_run` input builds, signs and launch-tests both platforms without
tagging or publishing; dispatching **Build Windows** or **Build Linux**
directly is a single-platform build-only check that never publishes. Each
published version identifies one build; choose a new version for a new build.
Run `npm run check` locally on the commit being released before dispatching
it; packaging does not repeat that repository gate.

Each release also publishes `module-build.json`, `{"version", "buildId"}` of
the game module it ships, written by the Linux build from the same Rust assembly
the app embeds (`events_ci module-build`). The community event workflows read it.

### Community events

Events live in the separate
[RunPlanner-Events](https://github.com/maybe-adamant/RunPlanner-Events)
repository, which validates pull requests and publishes the signed feed with its
own workflows; this repository only reads the feed (see
[Event feed](docs/design/GAME_INTEGRATION_BOUNDARY.md#event-feed)). Those
workflows check out the latest planner release and call its single event
builder, `npm run events:build` (`apps/planner/src/workspace/eventFeedBuilder.ts`
over `eventDocument.ts`, the builder the development **Export event file…** also
uses), and the `events_ci` example of the game host crate for the module build,
host-side feed checks and signature verification.

The feed is signed with a dedicated event key, not the updater key. The app
embeds its public key from `apps/planner/src-tauri/event-feed.pub`, which ships
as a placeholder that turns events off. To set the key up once:

1. `npx @tauri-apps/cli signer generate -w events.key` and keep the private key
   and password safe.
2. In the events repository, create the `events-publish` environment with a
   deployment branch policy of `main` only, and add the
   `EVENTS_SIGNING_PRIVATE_KEY` and `EVENTS_SIGNING_PRIVATE_KEY_PASSWORD`
   secrets to that environment, not the repository: repository secrets would be
   reachable from a workflow run on any branch.
3. Replace `event-feed.pub` here with the one-line contents of `events.key.pub`
   and release the planner. The events workflows refuse a planner release that
   still ships the placeholder.

The separate **Desktop host** workflow checks Rust compilation of the desktop
application on Windows and Linux and runs the game host crate tests on Linux,
and the **Game module** workflow runs `npm run test:game-module`, on pull
requests and pushes to `main`.
