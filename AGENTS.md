# Agent Instructions

This repository is the standalone Run Planner application. It is app-first:
the catalog, authored plan, simulator, validator, and sophisticated editor live
here. The Hades II game module is a later consumer of a declarative plan and
must not shape the current UI or simulation around ImGui or ModpackLib.

## Read Before Editing

Read `README.md` and the relevant authority documents under `docs/` before
changing architecture or domain behavior. Stable cross-cutting design lives in
`docs/design/`, biome rules live in `docs/biomes/`, source evidence lives in
`docs/audits/`, and delivery history lives in `docs/progress/`. The
task-oriented documentation map is maintained in `README.md`.

The prior implementation at
`../run-director-modpack/Submodules/adamantRunDirector-Run_Planner/` is evidence,
not an API contract. Harvest verified rules and fixtures; do not port control,
storage, draw, or lifecycle machinery mechanically.

## Dependency Direction

The intended package direction is:

```text
catalog construction -> pure core <- application composition -> React UI
```

The pure core may define the normalized interfaces it consumes, but it must
not import React, Redux, Tauri, browser APIs, filesystem APIs, or UI component
libraries.

The UI may dispatch semantic commands and render derived projections. It must
not implement room eligibility, reward bags, lifecycle counters, or topology
repair.

## Code Placement and Module Boundaries

- Place code with the semantic authority that owns its policy or product, not
  with whichever caller first needs it. Prefer the nearest existing feature
  neighborhood over a new generic `common`, `shared`, `helpers`, or `services`
  area.
- Before creating a module boundary, identify its owner, explicit inputs,
  returned product, consumers, primary tests, and the old code it displaces.
- Use `index.ts` only for a deliberate supported surface. Do not add barrels
  merely to shorten imports or hide dependency direction.
- Use assembly or composition modules for wiring one level of owned products.
  They must not become semantic policy owners or ambient dependency registries.
- Cross-package imports use declared package exports. Planner imports follow
  the aliases and immediate-neighborhood relative-import rules in
  `docs/design/ARCHITECTURE.md`; aliases identify ownership roots, not public
  APIs or dependency injection.
- Put test-only fixtures, harnesses, builders, and observers under test support,
  never production `src/`. Production code must not import test support.

When a placement or import rule is mechanically observable, enforce it with
TypeScript, ESLint, or an architecture test in addition to documenting it.

## Construction and Data Flow

- Each stage receives explicit inputs and returns every product later stages
  consume. Do not communicate semantic facts through hidden registration,
  module initialization order, or a sidecar map keyed by an apparent result.
- A cache or identity attestation may memoize or verify an already-complete
  explicit product. It must not be the sole carrier of semantic facts or
  callable capabilities required by a consumer.
- Construct application-wide collaborators at the composition root and inject
  narrow capabilities. Do not introduce a dependency-injection container,
  service locator, mutable service table, or catch-all context object.
- Use parameter objects, interfaces, and factories only for real construction
  or product boundaries. Do not create them solely to make a long call shorter
  or to prepare for a later refactor.
- A mutable builder is acceptable inside one stage. Freeze and return its
  complete product before crossing the stage boundary.
- Keep closed semantic dispatch explicit and exhaustive. An orchestrator may
  remain long when chronological order or one atomic invariant is its coherent
  responsibility.

## Refactoring Discipline

- Before broad reorganization, inventory current responsibilities,
  producer/consumer paths, hidden state, test ownership, expected deletions,
  and relevant work-count baselines.
- Refactor in complete vertical slices: move one authority with its consumers
  and primary tests, then remove the superseded path in the same commit. Do not
  land context-only, interface-only, state-wrapper-only, compatibility, or
  forwarding commits for later work to repair.
- Keep behavior-preserving movement separate from product behavior changes. If
  movement exposes a defect, characterize it and fix it in a focused follow-up.
- Do not add production shadow models, exhaustive self-audits, or manifests to
  make a refactor testable. Production validation protects real contact and
  invariant boundaries; independent closure and mutation auditing belongs in
  tests.
- Give each policy and edge-case matrix one primary test owner. Facade,
  integration, and product-loop suites retain representative boundary witnesses
  rather than duplicate the complete matrix.
- Treat line count, file count, test count, and directory size as diagnostic
  evidence only. The acceptance target is a smaller, explicit change
  neighborhood with no parallel path or unexplained production growth.

## Modeling Rules

- Use game-domain language in catalog, authored state, history, and findings.
- Keep UI rows, tabs, expansion state, canvas positions, and selector text out
  of persisted domain state.
- Keep topology ownership separate from room-local leaf ownership.
- Keep unique game Room Declarations separate from repeatable authored Room
  Occurrences. Topology and feedback use persisted occurrence IDs; simulation
  resolves each occurrence through its game name.
- Preserve incomplete and context-invalid authored states when they are
  structurally representable.
- Perform destructive changes only through explicit semantic commands.
- Use complete declaration-owned defaults for active leaf values.
- Keep persisted authored state separate from replaceable simulation output.
- Address findings by stable semantic owner, never by rendered position.
- Keep external save/profile progression predicates out of production catalog
  data unless the project deliberately adds a modeled input for them.
- Prefer explicit declarations and command handlers over compact metaprogramming
  that hides game facts.

## Application State

Redux Toolkit is the application state coordinator, not the domain engine.
Reducers own authored project and UI-session state. Simulation remains a pure
operation over an authored snapshot and normalized catalog.

Undo/redo records semantic authored edits. Navigation, hover, expanded panels,
search text, and derived findings do not enter authored history.

## UI

Start with normal React composition and CSS layout. Do not introduce a graph
library until a concrete view requires it. If React Flow is later added, its
nodes and positions are projections of domain topology, never topology
authority.

Use accessible component primitives for dialogs, menus, tabs, comboboxes, and
keyboard interaction. Customize copied shadcn/ui components deliberately; do
not accumulate wrapper layers that conceal ownership.

## Testing

Once the project is scaffolded, every domain change should run the repository's
declared scripts for:

- TypeScript type checking;
- Vitest unit and fixture tests;
- linting;
- formatting or diff checks;
- production build when application wiring changes.

Use the narrowest truthful test lane during implementation:

- `npm run test:changed` for tests related to uncommitted source or fixture
  changes;
- `npm run test:ui` for leaf React/editor changes;
- `npm run test:planner` for planner projection, Redux, workspace, UI, and
  architecture-boundary changes;
- `npm run test:contract` for application/workspace capability changes;
- `npm run test:product` for cross-layer browser workflows;
- `npm run test:engine` or `npm run test:catalog` for their owning packages.

`npm run test` and `npm run check` remain the complete phase, push, and release
gates. Run the complete gate for test/configuration changes, shared package
changes with broad downstream impact, and before declaring a phase closed.

Keep tests near their authority:

- declaration normalization tests in the catalog package;
- command and codec tests in the core project model;
- lifecycle and game-rule fixtures in the simulator;
- interaction tests at the UI adapter boundary;
- end-to-end tests only for cross-layer behavior.

Test helpers may construct inputs and observe outputs, but must not reproduce
production eligibility, topology, lifecycle, reward, focus, or candidate
policy. Do not test React, Redux Toolkit, or third-party component internals.

## Documentation

Update the owning document whenever a modeling or ownership decision changes.
Keep implementation progress separate from design authority once a progress
tracker is introduced.

Unknown game behavior belongs in focused audit notes or failing/skipped
research fixtures. Do not add generic `unsupported` values to production
models merely to remember unfinished research.

## Git

Use Conventional Commits. Inspect the live worktree before editing, preserve
unrelated user work, and never delete the previous game-module prototype as
part of app work unless explicitly requested.
