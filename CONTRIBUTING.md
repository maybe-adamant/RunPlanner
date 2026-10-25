# Contributing to Run Planner

Run Planner is a standalone Hades II route-authoring and simulation
application for Run Director. It owns the supported catalog, authored route,
deterministic game-language history, possibility and eligibility evaluation,
validation, findings, editor projections, the plan library, and undo/redo.
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

Dependency direction and ownership lanes are in [`AGENTS.md`](AGENTS.md).
Start with [Architecture](docs/design/ARCHITECTURE.md), then read the entry
document for your lane and go to a specialist document for a specific contract.

Catalog:

- [Catalog model](docs/design/CATALOG_MODEL.md): source-backed declarations
  and their normalization into the engine's catalog.

Planner engine:

- [Simulation and validation](docs/design/SIMULATION_AND_VALIDATION.md): the
  engine entry guide; authored inputs, evaluation products, chronology,
  candidates and findings.
- [Authored project model](docs/design/AUTHORED_PROJECT_MODEL.md): persisted
  project state, addresses, commands, schema and history.
- [Game generation rules](docs/design/GAME_GENERATION_RULES.md): the shared
  door, batch, cap and store contract the biome rules build on.
- [Reward model](docs/design/REWARD_MODEL.md): reward declarations, stores,
  shops, offers and acquisitions.
- [Trait offers](docs/design/TRAIT_OFFERS.md): trait-bearing offers, their
  assessment and settlement.
- [Room lifecycle model](docs/design/ROOM_LIFECYCLE_MODEL.md): the ordered
  single-room lifecycle and its history.
- [Encounter preparation](docs/design/ENCOUNTER_PREPARATION.md): authoring,
  resolving and preparing a room's encounters.
- [Candidate evaluation model](docs/design/CANDIDATE_EVALUATION_MODEL.md): how
  contextual alternatives are evaluated.
- [Draft mode](docs/design/DRAFT_MODE.md): drafting a random valid route from a
  described world.

Planner application and editor:

- [Editor model](docs/design/EDITOR_MODEL.md): the application entry guide;
  composition, projections, interaction binding and findings.
- [Application shell](docs/design/APPLICATION_SHELL.md): Home, the library,
  saving and opening, the Game tab, the Route/Draft/Loadout panels and the Run
  State sheet.
- [Structured editor workspace](docs/design/STRUCTURED_EDITOR_WORKSPACE.md):
  what the route and biome workspace shows and where.
- [Contextual editor UX](docs/design/CONTEXTUAL_EDITOR_UX.md): pickers and
  popup editors.

Game integration:

- [Execution protocol](docs/design/EXECUTION_PROTOCOL.md): the published plan
  wire and its conformance contract.
- [Game module distribution](docs/design/GAME_MODULE_DISTRIBUTION.md):
  installing and checking the module, plan admission and the bug report.
- [Plan slots and publication](docs/design/PLAN_SLOTS_AND_PUBLICATION.md): plan
  slots, sending, and the signed event and catalog feeds.
- [Run-start installation](docs/design/RUN_START_INSTALLATION.md): run
  modifiers, the starting loadout, Practice mode and snap corrections.
- [Biome execution navigation](docs/design/BIOME_EXECUTION_NAVIGATION.md): each
  biome's execution work beyond the shared F/G baseline.
- [Game module](game-module/CONTRIBUTING.md): the module's layout,
  dependencies and checks.

Game facts and other references:

- [Biome rules](docs/biomes/): each biome's route authority;
  [Fresh File rules](docs/biomes/FRESH_FILE_RULES.md) own the first-attempt
  route's differences from them.
- [Source audits](docs/audits/README.md): source evidence by subject, including
  the [feature-to-hook map](docs/audits/game-execution-contacts/FEATURE_HOOK_MAP.md)
  from published planner facts to native contacts.
- [In-game testing](docs/testing/README.md): pending live acceptance checks.
- [Releasing](docs/RELEASING.md): the installer, updater and release workflow.

### Lifecycle seams and profiles

A new or moved [room lifecycle](docs/design/ROOM_LIFECYCLE_MODEL.md) seam,
operation, effect or profile lands with:

1. the exact game function or state transition, or the grouped/derived
   rationale, located in the game data;
2. the pre-state it reads and the post-state later rules observe, including
   commit-time depth/cache/ordinal effects and encounter counter effects;
3. its relation to required objects, active encounters, offer and acquisition
   points, and the already-frozen outgoing batch (or why the profile has none);
4. whether optional actions may occur on both sides, and the
   declaration/profile scope in which it exists;
5. its placement: room-local, encounter-local, reward-local,
   layout-structural or route-structural, reusing an existing operation with a
   new declaration-owned effect when only state mutation differs;
6. any intentional simplification, deferral or exclusion, recorded in the
   owning audit and biome document;
7. normalized references, strict dispatch, events and ledgers, with a
   canonical event-order fixture that asserts both events and state
   boundaries and fails if the seam crosses an incompatible Room Action window
   or changes source history; and
8. updates to the concrete biome authority and the shared room lifecycle
   authority in the same change.

The conformance fixtures keep, at minimum: a standard room whose acquired
reward affects its outgoing batch; a Devotion whose acquisitions straddle
combat; a World Shop whose purchase does not affect its already-generated
batch (the fourth-shop-source/fifth-door-source trace); an unpicked target
whose offer affects offer history but never acquisition history; and an O Ship
room with a Heracles Intro whose counting record precedes the later phases
without trimming them, and whose active Combat2 wheel keeps independent
offer/acquisition timing.

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
Rust-side domain behavior. Plans live in the library folder
(`Documents/RunPlanner/Projects/`) and every edit is written there; the
planner reopens the last plan at startup. The browser build keeps the same
library in IndexedDB. On a machine with the platform's Tauri prerequisites:

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

[Releasing](docs/RELEASING.md) owns the installer, updater and release
workflow.

### Community events

Events live in the separate
[RunPlanner-Events](https://github.com/maybe-adamant/RunPlanner-Events)
repository, which validates pull requests and publishes the signed feed with its
own workflows; this repository only reads the feed (see
[Event feed](docs/design/PLAN_SLOTS_AND_PUBLICATION.md#event-feed)). Those
workflows check out the latest planner release and call its single event
builder, `npm run events:build` (`apps/planner/src/workspace/eventFeedBuilder.ts`,
which compiles every event's project through the same `eventDocument.ts` the
app compiles events with), and the `events_ci` example of the game host crate
for host-side feed checks and signature verification. The feed carries each
event's project reference, not compiled plans, so a planner release needs no
feed republish. A development build's **Import event folder…** plays a local
event folder from that repository through the same checks, without a
signature.

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

### Plan catalog

Template plans live in the separate
[RunPlanner-Catalog](https://github.com/maybe-adamant/RunPlanner-Catalog)
repository, whose workflows validate pull requests and publish the signed index
the same way (see
[Plan catalog feed](docs/design/PLAN_SLOTS_AND_PUBLICATION.md#plan-catalog-feed)).
They call this repository's single catalog builder, `npm run catalog:build`
(`apps/planner/src/workspace/catalogFeedBuilder.ts`, which loads and compiles
every plan as the app would), and the `catalog_ci` example of the game host
crate. The repository is the `external/RunPlanner-Catalog` submodule for local
work; `npm run test:catalog-entries` builds its pinned entries with this
planner and skips when the submodule is absent. It is opt-in, not part of
`npm run check`.

The index is signed with its own catalog key. The app embeds the public key
from `apps/planner/src-tauri/catalog-feed.pub`, which ships as a placeholder
that turns the catalog off; the catalog repository's README describes the
one-time key setup, which ends by replacing that file and releasing the
planner.

The separate **Desktop host** workflow checks Rust compilation of the desktop
application on Windows and Linux and runs the game host crate tests on Linux,
and the **Game module** workflow runs `npm run test:game-module`, on pull
requests and pushes to `main`.
