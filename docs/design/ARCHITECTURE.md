# Architecture

## Purpose and Reading Map

Run Planner is an authoring and simulation application. Its three planner
ownership lanes are the Hades II catalog, the pure planner engine, and the
planner application; the Hades II game module in `game-module/` is a fourth,
downstream lane. This document explains their relationship and how to extend
them without creating parallel policy.

Start with the lane that owns the question:

| Question                                                   | Entry document                                    |
| ---------------------------------------------------------- | ------------------------------------------------- |
| What does the game declare, and how is it normalized?      | [Catalog Model](CATALOG_MODEL.md)                 |
| What does authored state mean, and what follows from it?   | [Planner Engine](SIMULATION_AND_VALIDATION.md)    |
| How is that result edited, displayed, navigated and saved? | [Planner Application and Editor](EDITOR_MODEL.md) |

The engine guide routes deeper authored-state, generation, lifecycle, reward
and candidate contracts. The application guide routes workspace layout and
contextual-picker behavior. [Biome documents](../biomes/) own concrete route
rules; [audits](../audits/README.md) own source evidence and bounded unknowns.
The [Execution Protocol](EXECUTION_PROTOCOL.md) owns the downstream execution
contract, with [game module distribution](GAME_MODULE_DISTRIBUTION.md),
[plan slots and publication](PLAN_SLOTS_AND_PUBLICATION.md) and
[run-start installation](RUN_START_INSTALLATION.md) beside it.

## Product Contract

The application models possible supported outcomes, not their likelihood.
An authored choice selects one concrete outcome. Validation checks whether
the exact history and declarations support it. Positive weight is not a reason
to reject an unlikely choice. Zero and forced boundaries matter; route
likelihoods, seeded RNG replay and Monte Carlo search do not belong here.

Persisted choices and derived truth are separate. Structurally representable
incomplete and context-invalid plans remain editable documents. Evaluation
does not silently repair them, choose replacement values or delete suffixes.
Semantic commands own explicit changes; Undo/Redo restores authored snapshots.

A project contains one route. Catalog Room Declarations have unique game
names, while authored Room Occurrences have stable IDs and may repeat a game
name. Rendered rows, tabs and component identities are not domain identities.

The game module (`game-module/`) consumes a declarative execution plan. It realizes
supported outcomes and checks conformance under the integration contract. It
is not another planner or simulator, and its Lua/UI constraints must not shape
the application's authored model or React editor.

## Lanes and Runtime Flow

[`AGENTS.md`](../../AGENTS.md#ownership-lanes) owns the four ownership lanes,
dependency direction, code placement, construction and data-flow rules, and
refactoring discipline:

| Lane        | Package          | Owns                                                                              |
| ----------- | ---------------- | --------------------------------------------------------------------------------- |
| Catalog     | `hades2-catalog` | Game declarations and their compilation into the engine's catalog contract        |
| Engine      | `planner-engine` | Authored state, commands, history, simulation, candidates, findings and execution |
| Application | `apps/planner`   | Composition, persistence adapters, Redux coordination, projections and React      |
| Game module | `game-module/`   | Lua runtime execution and conformance of published plans                          |

The dependency map is not the runtime processing order. At runtime:

```text
source-backed declarations → immutable catalog
profile / semantic commands → immutable authored project
catalog + project → exact engine evaluation assembly
project + matching assembly → application projections and bound interactions
bound interaction → command → replacement project
validated engine product → execution document → game module
```

The application constructs the catalog and engine collaborators at its
composition root. The draft worker (`apps/planner/src/workspace/draftWorker.ts`)
is a second composition entry point and constructs its own catalog.

### Imports

Cross-package consumers use declared package exports. Within the planner,
cross-root imports use `@planner/*` for composition, persistence, projections,
state, ui and workspace. Test support uses `@planner-test/*`, and repository
authored fixtures use `@run-planner/test-fixtures`. Immediate-neighborhood
`./` and `../` imports remain appropriate; planner imports do not climb two
or more parent directories. The engine uses direct internal relative imports
instead of routing internal dependencies through public barrels. Pure package
imports remain static, and planner aliases do not enter pure package source.

## Publication and Readiness

The authored snapshot and its exact evaluation are published together.
Undo/Redo may reuse an assembly for the identical immutable snapshot. It must
never combine current authorship with another snapshot's history, findings or
candidate context.

Evaluation coverage is not authoring readiness. A missing required choice
locks later repair regions; invalidity alone does not. Retained authored
structure stays visible even without assessed facts. The engine owns the
[horizon](SIMULATION_AND_VALIDATION.md#authoring-readiness); the application
[binds it to controls](EDITOR_MODEL.md#authored-first-assembly).

## Adding a Feature

A new room using existing templates should primarily be declaration work:
supply its exact exits, encounter binding, reward surface, eligibility and
defaults. Normalization proves the contract; existing engine and application
consumers use it. A biome-name branch is not justified merely because the
declaration is new.

A genuinely new mechanic starts at the authority that cannot yet express it.
For a targeted acquisition:

1. Catalog describes the supported effect and its declaration facts.
2. Authored state persists only the user's choices; commands maintain their
   structural ownership atomically.
3. Lifecycle determines when settlement runs.
4. Settlement returns branch effects, findings and exact repair frontiers
   together.
5. Candidates consume those frontiers; the application binds the child and
   its finding to one repair interaction.
6. React renders the supported control and submits a complete intent.

Not every feature touches every lane. Layout polish may need no engine
change; a supported declaration may need no application change. Execution
publication consumes engine meaning rather than inventing an additional
semantic interpretation.

Where a policy has a callable owner, enumerate its edge cases against that
owner with minimal inputs; whole-route evaluation proves the wiring with one or
two witnesses. A targeted effect needs an incomplete-target repair witness,
not just proof that a complete acquisition succeeds. A generated pickup needs
a source edit and removal witness, not just proof that it appears once.
Route-spanning interactions use real
[authored checkpoints](../../test/fixtures/authored-project/checkpoints/README.md).

## Hosts and Build Identity

Vite builds the same React application for browser and desktop. Tauri owns
native windows, packaging, scoped file transport, the
[project library](EDITOR_MODEL.md#project-library) folder (its subfolders,
recursive head-only scan, plan and folder moves, and deletes to the recycle
bin) and its session, a
close gate that lets the planner write pending edits, and the
[game module lane](GAME_MODULE_DISTRIBUTION.md):
the compile-time embedded module, the game target setting, install checks,
plan-slot writes and bug-report assembly. A single-instance guard hands a second
launch to the running window, so one process writes the library. Rust does not
parse planner semantics; the library reads only a document's head (identity,
name, route summary) to list and file it, and accepts only plain portable
folder and file names inside the library. The browser host keeps the same
library in IndexedDB. Browser/filesystem effects
stay behind application adapters; desktop integration does not move simulator
rules into the host. Native file-drop interception remains disabled to retain
ordinary HTML interaction behavior.

Build identity is application metadata, separate from schema and catalog
identity. Official CI builds supply one validated release version to Tauri and
the frontend, together with the source commit. Local builds identify themselves
as Development. About is on Home, which the app starts on with no plan open.
Installer, updater and release workflow details belong to
[Releasing](../RELEASING.md).

TypeScript checks static contracts; runtime codecs protect external contacts.
Vitest transformation alone is not a type proof. Optimize measured bottlenecks
while preserving pure input/output contracts: keep normalized data immutable,
avoid duplicate derived Redux state and keep subscriptions narrow. Do not
introduce workers, incremental invalidation or new infrastructure solely in
anticipation of growth.
