# Agent Instructions

This repository is the standalone Run Planner application. It is app-first:
the catalog, authored plan, simulator, validator, and sophisticated editor live
here. The Hades II game module is a later consumer of a declarative plan and
must not shape the current UI or simulation around ImGui or ModpackLib.

## Read Before Editing

Read `README.md` and the relevant authority documents under `docs/` before
changing architecture or domain behavior. The documentation set is ordered in
`README.md`.

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

Keep tests near their authority:

- declaration normalization tests in the catalog package;
- command and codec tests in the core project model;
- lifecycle and game-rule fixtures in the simulator;
- interaction tests at the UI adapter boundary;
- end-to-end tests only for cross-layer behavior.

Do not test React, Redux Toolkit, or third-party component internals.

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
