# Project Reorganization Plan

## Purpose

This document is the delivery authority for reorganizing the standalone Run
Planner repository after Phase 6. The migration improves package names, source
ownership, test placement, import surfaces, and document navigation without
changing planner behavior or domain contracts.

This is primarily a structural migration. It does not authorize changes to
game rules, project persistence, simulation semantics, candidate support,
editor behavior, or the future execution-plan boundary.

Slices 1 through 7, Slices 8A-8B, and the candidate-registry half of Slice 8C
are complete. `../design/ARCHITECTURE.md` now owns the live repository shape;
this document preserves the migration sequence and defines the remaining
linear-materialization half of Slice 8C and Slice 8D cleanup work.

## Initial Structural Findings

The existing production dependency direction is sound:

```text
concrete Hades II declarations and catalog construction
  -> pure catalog/project interfaces and planner operations

React application composition
  -> concrete catalog
  -> pure authored-project and simulation operations
```

No production package imports the React application, and the pure planner code
does not import the concrete catalog package. The migration must preserve that
direction.

The organizational problems are narrower:

- `packages/core` contains catalog contracts, authored-project state,
  requirements, the reward kernel, and the complete simulator behind one
  generic package name and one broad root barrel;
- `packages/catalog/src` mixes declaration/compiler tests with authored-project
  and simulation conformance fixtures;
- `apps/planner/src/application` mixes composition, Redux state, persistence,
  project operations, capability policy, and editor projections;
- `apps/planner/src/ui` is flat despite containing several distinct editor and
  product surfaces;
- test-only representative projects and browser-loop fixtures sit beside
  production source;
- `rewards.ts`, `rewardKernel/`, and `simulation/rewards/` make three different
  reward responsibilities difficult to distinguish by path;
- several files have grown large enough that their internal ownership seams
  are hidden by the surrounding directory layout;
- stable design authorities, audits, and historical delivery documents share
  one flat documentation directory.

The standard `src` directory convention is not itself a problem. Pure engine,
concrete game-data, and React code should remain separate workspaces rather
than being collapsed into one application tree.

## Target Repository Shape

```text
RunPlanner/
  apps/
    planner/
      src/
        composition/
        state/
        persistence/
        workspace/
        projections/
        ui/
          shell/
          editor/
            linear/
            hub/
            rooms/
            rewards/
          feedback/
          project/
      test/
        fixtures/
        product-loops/

  packages/
    planner-engine/
      src/
        catalog-schema/
        authored-project/
        requirements/
        reward-kernel/
        simulation/
          completeness/
          materialization/
          lifecycle/
          history/
          generation/
          rewards/
          candidates/
      test/
        authored-project/
        simulation/
          biomes/

    hades2-catalog/
      src/
        declarations/
          rooms/
          rewards/
        compiler/
      test/
        catalog/
        biomes/

  docs/
    design/
    biomes/
    audits/
    progress/
```

The package identities are:

```text
packages/planner-engine  -> @run-planner/engine
packages/hades2-catalog  -> @run-planner/hades2-catalog
apps/planner             -> @run-planner/planner
```

`planner-engine` remains one package during this migration. Its simulator has
a clean internal dependency on the catalog schema, authored project, and
reward kernel, but splitting it into another workspace is not required to
clarify current ownership. A later split must be justified by an independent
consumer or build boundary rather than file count alone.

## Migration Invariants

Every slice must preserve these contracts:

- `ProjectDocument` schema version and encoded JSON remain unchanged;
- catalog version, normalized catalog values, and declaration order remain
  unchanged;
- the active F/G/H/I and N/O/P/Q capability surfaces remain unchanged;
- authored commands retain incomplete and context-invalid state exactly as
  before;
- simulation, findings, candidate results, profiles, recovery, undo/redo, and
  rendered behavior remain unchanged;
- no compatibility barrel, duplicate package, forwarding file, or deprecated
  alias is retained merely to support an intermediate repository state;
- production engine code never imports `@run-planner/hades2-catalog`;
- production catalog code may depend on engine schemas but never on the
  simulator or React application;
- UI code continues to dispatch semantic commands and never acquires domain
  mutation authority;
- tests may move or gain clearer fixtures, but no assertion or coverage is
  removed to make a move pass;
- unrelated model cleanup is not mixed into mechanical move commits.

The default validation gate after every slice is:

```text
npm run check
git diff --check
git status --short --branch
```

Focused tests should run while a slice is being developed, but the complete
gate is required before its commit.

## Slice 1 — Rename the Workspaces

### Goal

Replace generic package identities without changing their internal file
layout or public behavior.

### Deliverables

- move `packages/core` to `packages/planner-engine`;
- rename package `@run-planner/core` to `@run-planner/engine`;
- move `packages/catalog` to `packages/hades2-catalog`;
- rename package `@run-planner/catalog` to
  `@run-planner/hades2-catalog`;
- update workspace dependencies, package-lock workspace entries, TypeScript
  resolution, Vite configuration, Vitest configuration, ESLint configuration,
  and every import site;
- preserve the existing package export map exactly under the new identities;
- update only repository-path references that would otherwise become broken.

### Explicit Non-Deliverables

- no internal source moves;
- no symbol renames;
- no export narrowing;
- no test relocation;
- no documentation hierarchy migration.

### Acceptance

- repository search finds no live `@run-planner/core` or
  `@run-planner/catalog` imports;
- repository search finds no live `packages/core` or `packages/catalog` path
  references outside historical text that is intentionally preserved;
- all workspaces typecheck and the complete validation gate passes;
- the commit is a mechanical package rename that can be reviewed without
  interpreting domain behavior.

### Commit Recommendation

```text
refactor(repo): rename engine and catalog packages
```

## Slice 2 — Reorganize the Planner Engine

### Goal

Make the pure package readable by semantic authority and replace the broad
root barrel with explicit supported subpaths.

### Deliverables

- move normalized catalog interfaces from `catalog.ts` into
  `catalog-schema/`;
- move `project/` into `authored-project/`;
- group `requirements.ts` and `requirementEvaluator.ts` under
  `requirements/`;
- move the room reward bindings from `rewards.ts` into
  `reward-kernel/bindings.ts`, leaving all pure reward catalog, bag, shop,
  support, and history operations under one reward-kernel owner;
- retain `simulation/` as the derived pipeline and preserve its existing
  internal phase folders;
- define explicit package exports:

  ```text
  @run-planner/engine/catalog-schema
  @run-planner/engine/authored-project
  @run-planner/engine/requirements
  @run-planner/engine/reward-kernel
  @run-planner/engine/simulation
  ```

- switch production and test imports atomically to those subpaths;
- remove the old broad root export rather than leaving a forwarding barrel;
- keep public symbol names unchanged in this slice.

### Acceptance

- every import states which engine authority it consumes;
- no file imports through the removed `@run-planner/engine` root;
- no duplicate `rewards.ts` or camel-case `rewardKernel/` path remains;
- internal dependencies still point from simulation toward schema/authored/
  requirements/reward authorities, never the reverse;
- project JSON and catalog snapshot tests remain byte-for-byte equal;
- the complete validation gate passes.

### Commit Recommendation

```text
refactor(engine): organize domain authorities
```

## Slice 3 — Reorganize the Hades II Catalog

### Goal

Separate readable game declarations from the compiler that turns them into the
normalized engine catalog.

### Deliverables

- retain global and biome-specific facts under `declarations/`;
- move reward declaration data and raw reward declaration types from
  `rewardKernel/` to `declarations/rewards/`;
- rename `normalization/` to `compiler/`;
- move reward normalization into `compiler/rewards/`;
- move catalog construction from the generic `catalog.ts` root into
  `compiler/createCatalog.ts`;
- keep the package root responsible only for constructing and exporting the
  canonical Hades II catalog;
- replace the old `./reward-kernel` and `./testing` exports with one explicit
  test-support export for raw declarations;
- keep `createCatalog` and its raw input type available for compiler and
  contract tests;
- update imports without changing declaration contents, normalization order,
  error paths, or catalog freezing.

### Target Package Surface

```text
@run-planner/hades2-catalog
@run-planner/hades2-catalog/test-support
```

The production root exposes the canonical catalog and catalog compiler contact
needed by composition. Raw declaration values are test support, not an
application API.

### Acceptance

- `src/normalization`, `src/rewardKernel`, and the generic root `catalog.ts` no
  longer exist;
- complete room facts remain readable at their declaration points;
- compiler code contains no authored-project or simulation policy;
- normalized catalog snapshot and catalog error-path tests remain unchanged;
- no application code imports raw declarations;
- the complete validation gate passes.

### Commit Recommendation

```text
refactor(catalog): separate data and compiler
```

## Slice 4 — Relocate Tests to Their Authorities

### Goal

Make a test's path identify the production contract it verifies.

### Catalog Test Deliverables

Move declaration and compiler tests under `packages/hades2-catalog/test/`:

- catalog construction and closure;
- global structure and reference parity;
- reward declaration/compiler normalization;
- lifecycle declaration normalization;
- room declaration parity for F/G/H/I/N/O/P/Q.

These tests may import raw declarations through a test-support export owned by
the catalog package.

### Authored-Project Test Deliverables

Move generic codec, command, topology, room-state, and history tests under
`packages/planner-engine/test/authored-project/`.

Move concrete authored conformance fixtures, including H/I/N/O authorship and
Q staged authorship, beside those tests. The engine package may declare a
development-only dependency on `@run-planner/hades2-catalog`; its production
dependency graph must remain unchanged.

### Simulation Test Deliverables

Move concrete lifecycle, completeness, materialization, history, generation,
reward, selected-validation, and candidate fixtures under
`packages/planner-engine/test/simulation/biomes/`.

Use biome folders when more than one file exists for a biome:

```text
simulation/biomes/f/
  completeness.test.ts
  materialization.test.ts
  history.test.ts
  generation.test.ts
  rewards.test.ts
```

O history and O validation therefore leave the catalog package even though
they consume the concrete catalog.

### Application Test Deliverables

- move `pSimulation.test.ts`, `qAuthorship.test.ts`, and
  `qSimulation.test.ts` out of `apps/planner/src/application` to their engine
  authorities;
- keep Redux, persistence, projection, and React interaction tests in the app;
- do not move browser product loops yet; Slice 6 owns their final location.

### Test Configuration Deliverables

- update the engine and catalog TypeScript configurations to include both
  `src/` and `test/`;
- update the planner TypeScript configuration to include `src/`, `test/`, and
  its Vite configuration;
- keep Vitest discovery explicit for package and application test roots;
- ensure moved tests remain statically typechecked rather than only transpiled
  by Vitest.

### Acceptance

- `hades2-catalog` tests verify declarations and compilation, not simulator
  orchestration;
- engine tests verify authored and simulated behavior;
- app tests verify application composition, state, projections, persistence,
  or rendered interaction;
- test names no longer use delivery-state words such as `dormant` when the
  tested feature is active;
- every moved TypeScript test remains inside a package or app typecheck;
- test count does not decrease;
- the complete validation gate passes.

### Commit Recommendation

```text
test(repo): align fixtures with authorities
```

## Slice 5 — Split Application Responsibilities

### Goal

Replace the flat `application/` directory with explicit application owners
without changing Redux state shape or public behavior.

### Deliverables

Move files into these owners:

```text
composition/
  createApplication.ts
  capabilities.ts
  capabilityConfiguration.ts
  projectBootstrap.ts

state/
  store.ts
  projectWorkspaceSlice.ts
  editorSessionSlice.ts
  profileSessionSlice.ts

persistence/
  autosaveRecovery.ts
  browserAutosaveRecoveryAdapter.ts
  profileFile.ts
  browserProfileFileAdapter.ts

workspace/
  projectDocuments.ts
  projectOperations.ts
  occurrenceIds.ts

projections/
  candidateProjection.ts
  editorNavigation.ts
  evaluationProjection.ts
  roomSelectorProjection.ts
```

Tests remain beside their application authority during this slice.

### Ownership Rules

- `composition/` may import every application authority and both packages;
- `state/` owns Redux reducers, selectors, typed hooks, and store construction;
- `persistence/` owns external profile/recovery ports and browser adapters;
- `workspace/` owns capability-aware project lifecycle operations;
- `projections/` translates domain results into editor-facing read models;
- none of these folders may acquire biome or reward game rules.

### Acceptance

- `apps/planner/src/application` no longer exists;
- Redux state keys and serialized project/profile values are unchanged;
- `createApplication()` retains the same returned composition surface;
- browser adapters remain injected and testable;
- no generic replacement folder such as `services/`, `utils/`, or `common/` is
  introduced;
- the complete validation gate passes.

### Commit Recommendation

```text
refactor(app): separate application owners
```

## Slice 6 — Organize UI and Test Support

### Goal

Make the React tree navigable by product responsibility and remove test-only
fixtures from production source.

### UI Deliverables

Move the existing UI without changing component behavior:

```text
ui/shell/
  App.tsx

ui/editor/linear/
  LinearBiomeEditor.tsx
  LinearTopologyEditor.tsx
  RoomSelector.tsx

ui/editor/hub/
  HubBiomeEditor.tsx

ui/editor/rooms/
  RoomStateEditor.tsx

ui/editor/rewards/
  RewardEditors.tsx

ui/feedback/
  EvaluationFeedback.tsx
  candidatePresentation.ts
  semanticOwner.ts

ui/project/
  ProjectFileControls.tsx
  ProjectHistoryControls.tsx
  projectHistoryShortcuts.ts
```

Move `styles.css` under `ui/` and update the application entry import.

### Test Deliverables

- keep focused component interaction tests beside their components;
- move `GoldenUnderworldProductLoop.interaction.test.tsx` and
  `GoldenSurfaceProductLoop.interaction.test.tsx` to
  `apps/planner/test/product-loops/`;
- move `testing/surfaceProject.ts` and `testing/renderPlanner.tsx` to
  `apps/planner/test/fixtures/`;
- extract any representative Underworld fixture that remains embedded inside
  a golden test into the same fixture owner only when that extraction is
  behavior-neutral;
- ensure no production file imports from `apps/planner/test`.

### Explicit Non-Deliverables

- do not split large React components in this slice;
- do not change CSS values or visual layout;
- do not change labels, accessibility names, or interaction contracts;
- do not introduce hooks merely to make files shorter.

### Acceptance

- the app's production `src` contains no reusable test fixtures or golden
  browser loops;
- UI imports follow shell/editor/feedback/project direction rather than a flat
  peer graph;
- component and golden interaction assertions remain unchanged;
- the production Vite bundle contains no test-support modules;
- the complete validation gate passes.

### Commit Recommendation

```text
refactor(ui): organize editor surfaces
```

## Slice 7 — Reconcile Documentation

### Goal

Separate stable design, game evidence, and historical delivery state while
making the new repository shape authoritative.

### Deliverables

Create and populate:

```text
docs/design/
  ARCHITECTURE.md
  CATALOG_MODEL.md
  REWARD_MODEL.md
  GAME_GENERATION_RULES.md
  ROOM_LIFECYCLE_MODEL.md
  AUTHORED_PROJECT_MODEL.md
  SIMULATION_AND_VALIDATION.md
  EDITOR_MODEL.md
  CONTEXTUAL_EDITOR_UX.md
  GAME_INTEGRATION_BOUNDARY.md

docs/audits/
  N_SIDE_ROOM_FINDINGS.md
  REWARD_GAME_DATA_AUDIT.md

docs/progress/
  IMPLEMENTATION_PLAN.md
  IMPLEMENTATION_PROGRESS.md
  MIGRATION_PROVENANCE.md
  PROJECT_REORGANIZATION_PLAN.md
```

Keep `docs/biomes/` as the biome-specific authority. Move
`../audits/N_SIDE_ROOM_FINDINGS.md` into `docs/audits/` only if its remaining
content is evidence rather than a live N rule; otherwise fold the live
conclusions into `../biomes/N_GAME_RULES.md` and archive only the evidence.

Update:

- every Markdown link and README reading-order entry;
- `../../AGENTS.md` path guidance;
- the proposed repository shape and package names in `../design/ARCHITECTURE.md`;
- current-status paragraphs that still describe active biomes as dormant or
  declaration-only;
- authority tables so historical progress text is not mistaken for live
  design guidance.

Historical phase descriptions may retain words such as `dormant` when they
describe the state at that earlier slice. Stable design documents may not.

### Acceptance

- README remains the complete ordered entry point;
- every linked document resolves at its new path;
- stable design documents contain no known stale capability status;
- no design rule is duplicated merely because documents moved;
- repository path searches find no obsolete package or document paths;
- the complete validation gate passes.

### Commit Recommendation

```text
docs(repo): organize design and progress
```

## Slice 8 — Remove Reorganization Scars

Slice 8 follows the mechanical migration and is intentionally reviewed as
behavior-preserving code cleanup. It may be delivered as the following
independent commits rather than one large change.

### Slice 8A — Remove Legacy F Aliases

Replace F-specific wrappers and type aliases that now only forward to the
shared linear engine, including:

- `evaluateFCompleteness`;
- `composeFHistory` and `foldFHistoryEvents`;
- `evaluateFRoomGeneration` and `evaluateFRoomTargetCandidate`;
- `evaluateFRewards`;
- corresponding `F*` aliases whose types are exactly shared linear types.

F tests should call the same linear authorities used by G/H/I/O/P/Q. Do not
remove a name if it still expresses a real F-only contract.

Recommended commit:

```text
refactor(engine): remove legacy F aliases
```

### Slice 8B — Split Authored Command Dispatch

Decompose the large authored command implementation by existing semantic
families:

```text
authored-project/commands/
  dispatch.ts
  topology-linear.ts
  topology-hub.ts
  room-state.ts
  rewards.ts
  history.ts
```

Keep one public `applyProjectCommand` boundary and one closed `ProjectCommand`
union. Do not add handler fallbacks or duplicate validation.

Recommended commit:

```text
refactor(authored): split command handlers
```

### Slice 8C — Split Simulation Registries

Decompose candidate evaluation and linear materialization only along their
existing typed dispatch families:

- candidate context preparation;
- room/topology queries;
- reward/shop/wheel queries;
- Hub and layout-field queries;
- room-leaf materialization;
- continuation and terminal materialization.

Keep one public candidate evaluator and one public linear materializer. The
split must not create repeated simulation or per-option catalog rebuilding.

Recommended commits:

```text
refactor(sim): split candidate evaluators
refactor(sim): split linear materialization
```

### Slice 8D — Split Editor Components

Extract stable presentation components from `LinearTopologyEditor`,
`HubBiomeEditor`, and `RoomStateEditor` only where ownership is already clear.
The parent editor continues to own semantic command wiring and domain
addresses. Extracted components must not acquire duplicated local authored
state or independently run simulation.

Recommended commit:

```text
refactor(ui): split editor projections
```

### Slice 8 Acceptance

- no compatibility aliases or forwarding files remain;
- public composition functions remain singular;
- allocations and candidate rebuilding do not regress;
- focused allocation/responsiveness fixtures and the complete validation gate
  pass after every sub-slice.

## Completion Definition

The reorganization is complete when:

- package and folder names communicate actual ownership;
- all production imports use explicit engine authorities;
- tests reside with declaration, authored, simulation, application, or UI
  ownership rather than whichever package supplies their fixture;
- application composition, state, persistence, workspace operations, and
  projections are visibly separate;
- test-only fixtures do not live under production `src`;
- documentation distinguishes stable design from audits and delivery history;
- legacy F-only forwarding APIs are gone;
- large files are either split along real typed seams or explicitly retained
  because no stronger ownership boundary exists;
- project JSON, catalog output, simulation output, and browser behavior remain
  unchanged;
- every slice is represented by its own reviewed Conventional Commit.
