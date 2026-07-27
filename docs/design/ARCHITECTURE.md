# Architecture

## Purpose

This document defines the standalone app's product boundary, layer ownership,
dependency direction, lifecycle, and initial technology responsibilities.

It does not define biome rules, concrete persisted topology, validator
algorithms, or UI layout details. Those belong to the adjacent authorities.

## Product Boundary

Run Planner is primarily an authoring and simulation application.

The app owns:

- game-data declarations used by the supported planning domain;
- project creation, loading, saving, and migration;
- route and biome topology authoring;
- room-local and reward-local authored state;
- materialization into canonical simulated facts;
- game-language lifecycle history and ledgers;
- completeness, legality, candidate evaluation, and feedback;
- undo/redo and all rich editor interactions;
- eventual compilation of a declarative execution-plan document.

The future game module owns only:

- parsing and contact validation of an exported plan;
- translation through fixed, known runtime adapters;
- synchronization with live game events;
- conformance auditing and mismatch reporting.

The game module does not become a second simulator, validator, planner, or
editor.

## Possibility, Not Probability

Run Planner models the support of game decisions: which concrete outcomes can
or must occur from the current simulated state. It does not model how likely a
possible outcome is.

For every random decision, the catalog and current history determine a set of
possible concrete outcomes. The authored project chooses one outcome from that
set, and validation proves membership. A positive-probability outcome remains
valid even when its probability is extremely small. A zero-probability outcome
is impossible, and a singleton support set is forced.

This is a cross-cutting semantic contract, not merely a UI simplification. It
applies to room selection, reward-store selection, counted bags, encounters,
Boon sources, and later random game decisions. Weights and ratios may still be
read when they change the support set at a boundary, but the app does not
compute route likelihoods, expose "unlikely" warnings, consume RNG seeds, run
Monte Carlo search, or optimize for probability.

## Layered System

```text
raw declarations
  -> catalog construction
      -> normalized immutable catalog

project file
  -> authored project decoder
      -> authored project state

normalized catalog + authored project
  -> pure simulator
      -> execute catalog-selected room lifecycle profiles
      -> apply declaration-selected typed lifecycle effects
      -> compose occurrence-addressed room history fragments
      -> canonical route snapshots
      -> lifecycle history and ledgers
      -> validation and candidate results
      -> semantic findings

authored state + derived result
  -> presentation projectors
      -> React editor

validated derived result
  -> future execution-plan compiler
      -> JSON document for the game module
```

Every arrow points from an authority to a consumer. A downstream layer must
not write back into an upstream authority as a side effect.

## Repository Shape

The workspace is organized by current ownership:

```text
RunPlanner/
  apps/
    planner/
      src/
        composition/
        persistence/
        projections/
        state/
        ui/
        workspace/
      test/

  packages/
    hades2-catalog/
      src/
        declarations/
        compiler/
      test/

    planner-engine/
      src/
        catalog-schema/
        authored-project/
        requirements/
        reward-kernel/
        simulation/
      test/

  docs/
    design/
    biomes/
    audits/
    progress/
```

`packages/planner-engine` defines pure semantic types and operations. It defines
the normalized catalog interface required by simulation, but its production
code cannot import the catalog package. `packages/hades2-catalog` constructs
that interface from explicit declarations. The planner app is the composition
root that constructs the catalog, creates application state, invokes the
simulator, and binds results to React. Tests live beside the authority they
exercise; cross-layer browser fixtures live under `apps/planner/test/`.

This avoids a catalog/engine dependency cycle:

```text
planner-engine declares Catalog interface
hades2-catalog implements Catalog construction
planner composes hades2-catalog with planner-engine
```

## Dependency Rules

### Planner Engine

The planner engine may depend on TypeScript and small pure utility libraries
whose behavior is deterministic and platform-independent.

The planner engine must not depend on:

- React or JSX;
- Redux or React Redux;
- Tauri;
- DOM, browser, or filesystem APIs;
- shadcn/ui, Tailwind, or graph libraries;
- game-module Lua structures;
- mutable application singletons.

Planner-engine operations receive their inputs explicitly and return new
values or typed results.

### Catalog

Catalog owns raw explicit declarations and declaration normalization. It may
use the planner engine's public declaration and normalized interfaces. It must fail catalog
construction for malformed, unknown, or unsupported current-run facts rather
than inserting permissive fallback values.

### Application

The application layer owns composition and orchestration:

- Redux store construction;
- project lifecycle commands;
- simulation scheduling;
- derived-result publication;
- portable profile-file and autosave-recovery adapters;
- future Tauri integration;
- error boundaries and developer diagnostics.

It does not own biome or reward rules.

### UI

The React UI consumes authored state and a coherent derived result. It
dispatches semantic commands. It may own transient navigation and interaction
state, but it cannot directly modify topology tables or room payload records.
Route tabs and per-route panel selection are catalog-driven UI-session state;
they do not introduce route-specific reducers or authored fields.

## Technology Responsibilities

### TypeScript

TypeScript is the common implementation language for catalog, planner engine,
and UI.
Discriminated unions should represent layout variants, room state variants,
reward bindings, commands, lifecycle events, and findings.

Static types do not replace contact validation. Project files, imported
catalog assets, and future game artifacts are untrusted data until decoded.

### React

React renders projections and binds user interactions to semantic commands.
React component identity is not domain identity. Component keys derive from
stable semantic addresses.

### Redux Toolkit

Redux Toolkit owns application-coordinated state:

- the current authored project;
- undo and redo history;
- project dirty/save state;
- transient editor session state;
- the latest atomically published simulation result;
- application-level errors.

Domain mutations remain explicit commands. Reducers may use Immer-backed
updates, but command handlers must preserve the authored model invariants.

The simulation result is not persisted and is not edited. Undo/redo changes
authored state and triggers a fresh simulation.

### Vite and Vitest

Vite hosts the initial browser application and builds the React SPA. Vitest
runs pure package tests and focused UI-adapter tests. Type checking remains a
separate required command because test transformation alone is not a type
proof.

### shadcn/ui and Tailwind

Adopt component source selectively for accessible interaction primitives and
consistent styling. Copied components become project code and should remain
small, inspectable, and aligned with the editor's design language.

### Tauri

Tauri is deferred until the browser-hosted vertical slice requires desktop
capabilities. Its eventual responsibilities are narrow:

- native window and packaging;
- open/save dialogs;
- scoped project-file access;
- clipboard integration;
- application preferences and update plumbing if later required.

No simulator rule moves into Rust merely because Tauri is present.

### React Flow

React Flow is optional and deferred. If adopted, it renders a graph projection
of canonical authored topology. Node coordinates, selection rectangles,
viewport state, and visual edges remain UI-session data. They never become
the authored plan.

## Application Lifecycle

The initial lifecycle is intentionally simple:

```text
create/load project
  -> decode and normalize authored state
  -> run full pure simulation
  -> atomically publish authored + derived view

semantic edit
  -> apply one authored command
  -> push undo history when appropriate
  -> run full pure simulation
  -> atomically publish replacement derived result

undo/redo
  -> replace authored state
  -> run full pure simulation
  -> atomically publish replacement derived result
```

There is no source revision, rebuild revision, incremental invalidation graph,
or background worker in the initial architecture. The complete route model is
small enough to favor correctness and explicitness. Performance optimization
must be driven by measurement.

If simulation later becomes perceptibly expensive, the first escalation is a
worker boundary around the same pure function and immutable input/output
contract. Incremental simulation is not introduced until profiling shows it
is necessary.

## Atomic Derived Publication

One simulation attempt produces one coherent immutable result:

```ts
interface ProjectEvaluation {
  status: 'empty' | 'valid' | 'incomplete' | 'invalid';
  projectId: string;
  catalogVersion: string;
  routes: readonly ProjectRouteEvaluation[];
  findings: readonly SemanticFinding[];
  summary: ProjectEvaluationSummary;
}
```

One route evaluation publishes explicit `completeValidPrefix`, `active`, and
`blockedSuffix` processing regions. Only a complete and valid biome enters the
prefix and seeds the next biome. Every biome result separately reports
authoring state and evaluation coverage. Incomplete active biomes publish their
semantic authoring frontier and no canonical snapshot. Biomes with generated
progression publish one immutable materialized prefix with its partial history,
room-generation proof, reward witnesses, counters, and findings. The prefix is
folded by the same lifecycle, reward, and generation authorities as complete
simulation and is clamped at the first unsupported state. The Hub progression
publishes the same class of partial products through its fixed entry, one atomic
open board, and ordered visits with parent-local side state. Hub coverage never
claims a prefix of rendered board slots: the board is either not generated or
materialized and evaluated in full. Neither progression variant introduces a
second candidate-only evaluation path.

Complete biome results strengthen that same progressive result with the
selected Preboss and derived completion sequence, canonical snapshot, final
biome history, selected-plan validity, and downstream seed eligibility.
Incomplete biome results cannot carry those complete-biome products. The UI
must never combine prefix or final history from one authored snapshot with
findings or candidate decoration from another.

`empty` identifies a project with no configured biome prefix and no invented
finding. Ordinary incomplete and invalid plans remain first-class editor states.
Malformed project documents, impossible catalog construction, and violated
internal invariants throw at their contact boundary and do not masquerade as
user feedback.

## Composition and Dependency Injection

The planner app owns one composition root. It constructs concrete systems and
passes explicit collaborators downward:

```text
build catalog
build codecs
build simulator registries
build profile-file adapter
build autosave-recovery adapter
build Redux store and evaluation coordinator
render React application
```

Do not use mutable service tables that acquire properties during composition.
Construct complete named collaborators and return new system objects. Tests
can compose the same planner engine with fixture catalogs and in-memory project
repositories.

## Persistence Boundary

The app persists an authored project document, not Redux state and not a
simulation cache. The document contains only durable semantic choices and its
schema version.

The normalized `ProjectDocument` is also the portable profile-file format. The
initial product does not wrap it in a second profile document: a profile is one
saved planning workspace, and `project.name` supplies the suggested normalized
filename. A future wrapper is justified only if one profile must own data that
is not part of one authored project, such as several projects or application
preferences.

Manual profile persistence and automatic recovery are separate application
authorities:

```ts
interface ProfileFileAdapter {
  save(suggestedFileName: string, json: string): Promise<'saved' | 'cancelled'>;
  load(): Promise<string | null>;
}

interface AutosaveRecoveryAdapter {
  read(): string | null;
  write(json: string): void;
  clear(): void;
}
```

`ProfileFileAdapter` owns explicit user-directed Save Profile and Load Profile
operations. The browser implementation uses download/upload; a later Tauri
implementation may use native dialogs without changing the application
contract. `AutosaveRecoveryAdapter` owns a separate browser-local recovery key
and never substitutes for an explicit profile file. Browser globals remain
confined to the browser adapter composition.

The application keeps the fingerprint of the last successfully saved snapshot
or explicitly loaded profile as session state. Dirty state is derived by
comparing that fingerprint with the current normalized project fingerprint.
If the user edits while an asynchronous save is pending, success establishes
the serialized snapshot as the baseline and the newer current project remains
dirty. Autosave writes do not establish a clean baseline. Undoing back to the
explicit baseline is therefore clean even without another save, while
restoring an autosave is always reported as recovered and unsaved.

Autosave observes only effective authored-project replacements, including
semantic edits, undo/redo, New, and successful profile load. It is debounced
and ignores navigation, findings, and derived simulation publication. A
corrupt recovery value is preserved for diagnosis or explicit discard: startup
uses a safe new project, presents the failure, and suspends further autosave so
the raw value cannot be overwritten accidentally. Successful profile load or
explicit Discard Autosave clears that recovery blockade.

Authored room identity is occurrence-based: each persisted occurrence has an
opaque stable ID, selected game room name, and local state. The catalog keeps
game declarations unique, while topology may contain several occurrences of
the same game name.

These remain transient:

- active route, biome, and inspector tab;
- expanded panels and tree nodes;
- search and selector text;
- hover, focus, and selection rectangles;
- simulation history and findings;
- candidate colors and messages;
- undo/redo history in the initial product;
- future graph viewport and node positions unless explicitly introduced as
  user presentation preferences in a separate settings document.

## Performance Policy

Correctness comes first, but the editor should remain responsive:

- normalize declarations once at app startup;
- use immutable catalog arrays and maps;
- keep simulation pure and deterministic;
- memoize only measured expensive projections;
- avoid storing duplicate derived facts in Redux;
- virtualize genuinely large lists if needed;
- keep React component subscriptions narrow;
- benchmark full-project simulation before designing incremental caches.

Unlike the ImGui implementation, ordinary React render allocation is not a
domain constraint. Performance work should target observed latency rather than
recreating draw-path restrictions from the game module.

## Rejected Shapes

Do not introduce:

- simulation logic inside React components;
- a UI tree as the authored topology authority;
- persisted Redux store snapshots as the project format;
- a second validator in the future game module;
- game-module APIs inside the planner-engine package;
- arbitrary executable plan code;
- a graph library as topology storage;
- silent repair of invalid user choices;
- generic fallback behavior for missing current-run rules;
- probability scoring, route-likelihood warnings, or seeded RNG replay;
- premature incremental simulation, workers, databases, or Rust services.
