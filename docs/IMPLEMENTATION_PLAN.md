# Implementation Plan

## Purpose

This document defines the greenfield implementation order for the standalone
app. It separates stable design guidance from mutable implementation progress.

When implementation begins, add `IMPLEMENTATION_PROGRESS.md` as a factual
status ledger. Do not turn completed checkpoint history into design authority.

## Delivery Principles

- Build the pure model and simulator before sophisticated UI.
- Deliver thin vertical slices for behavior and UI, but import declaration-only
  biome slices before Phase 3 so the shared model is not frozen from F/G alone.
  Audit every biome and reconcile the shared vocabulary before importing those
  slices.
- Preserve explicit readable game declarations.
- Use F as the first complete slice and G as the first reuse proof.
- Keep browser development independent of Tauri packaging.
- Freeze rather than delete the old game-module prototype.
- Port verified rules, not Lua architecture.
- Model the support of game outcomes, never their probability or likelihood.
- Add abstractions only after two concrete consumers prove the shared shape.

## Phase 0: Repository and Tooling Foundation

### Deliverables

- workspace package manager and lockfile;
- TypeScript strict configuration shared by packages;
- `packages/core`;
- `packages/catalog`;
- `apps/planner` using React and Vite;
- Redux Toolkit application store;
- Vitest configuration;
- lint and formatting configuration;
- CI-friendly scripts for typecheck, test, lint, and build;
- local development instructions.

Do not add Tauri or React Flow in this phase.

### Acceptance

- the browser app renders a minimal shell;
- core tests run without browser globals;
- catalog tests construct a trivial fixture catalog;
- the app composes catalog and core through one explicit composition root;
- all declared repository checks pass from a clean checkout.

## Phase 1: F/G Catalog Foundation

### Deliverables

- normalized catalog interfaces in core;
- explicit route declarations;
- reward primitives, payload domains, stores, bags, and bindings required by
  F/G;
- counted-entry duplicate policies and primitive acquisition projections;
- encounter profiles required by F/G;
- F and G room declarations with explicit labels and defaults;
- F/G linear layout declarations;
- F/G layout reward-store policies and room forced-store overrides;
- requirement expression normalization and the evaluator registry needed by
  focused rules;
- declaration contract errors with readable paths;
- migration notes mapping each declaration family to verified Lua/game-data
  evidence.

### Migration Policy

Use the existing revamp declarations and game-data audits as starting evidence.
For each ported rule:

1. read the current Lua declaration and relevant design authority;
2. verify uncertain facts against game scripts;
3. write a direct TypeScript declaration;
4. normalize it into immutable catalog structures;
5. add focused declaration tests;
6. stop treating the Lua implementation as authority for that rule.

Avoid code generators or Lua parsers initially. Explicit declarations are
easier to audit while the app model is still settling.

### Acceptance

- catalog construction is deterministic;
- every F/G room has explicit game name, label, kind, template, exits, encounter
  profile, reward binding, eligibility, caps, and defaults where applicable;
- game names uniquely identify declarations without imposing authored
  occurrence uniqueness;
- every referenced declaration key resolves;
- reward-store policy, forced overrides, duplicate behavior, and acquisition
  projections normalize without simulator name switches;
- malformed declarations fail at construction;
- no React or Redux imports exist in catalog/core domain code;
- focused parity fixtures cover representative opening, combat, miniboss,
  story, fountain, shop, and preboss rooms.

## Phase 2: Authored Project and Commands

### Deliverables

- schema version 2 `ProjectDocument` decoder and encoder;
- empty project and route defaults;
- contiguous configured route prefixes;
- F/G `LinearBiome` authored topology;
- opaque persisted occurrence IDs separate from game room names;
- occurrence-state initialization from recursive declaration defaults;
- lifecycle-aware occurrence state: offer-time defaults on every target and
  entry-materialized shop defaults only on picked targets;
- explicit batch reward-store policy, with batch-owned `baseRewardStoreKey`
  only when generated store selection is observable and not already owned by a
  source offer point, plus concrete reward-only incoming leaves;
- semantic address constructors;
- explicit topology and leaf command handlers;
- `ReplaceBatchRewardStore` with target-reward and downstream retention;
- structural normalization;
- repeated game-name support across distinct occurrences;
- downstream re-anchoring and retained unavailable exits;
- explicit destructive reconciliation;
- undo/redo state wrapper;
- JSON round-trip fixtures.

### Acceptance

- equal project JSON decodes to equal normalized authored state;
- encode/decode round trips semantic choices;
- occurrence IDs survive replacement of their selected game room;
- distinct occurrences may reference the same game room name;
- existing targets cannot be emptied by ordinary replacement commands;
- offer-time leaves are always complete after construction or replacement;
- every picked shop occurrence is fully typed, while an unpicked shop may omit
  its entry state or retain a complete dormant value;
- changing the picked target installs missing shop defaults without clearing
  the old target's dormant shop state;
- no persisted counted leaf contains a competing `storeKey`;
- upstream replacement retains compatible downstream topology;
- exit shrink, re-pick, reconcile, and capacity restoration match the locked
  downstream policy;
- explicit structural deletion removes owned occurrences while undo restores
  the complete prior snapshot;
- undo/redo reproduces exact authored snapshots;
- malformed JSON and invalid structural commands fail at their contact
  boundaries.

## Phase 2.5: Authored Editor Smoke

### Deliverables

- Underworld/Surface/Settings application shell;
- an F-configured project bootstrap for smoke testing;
- linear start, ordinary decision, picked-exit, terminal, reward, and shop
  projections bound only to Phase 2 semantic commands;
- one batch-level Reward Pool selector per generated decision, with concrete
  reward-only target editors;
- undo/redo controls;
- deliberately neutral incomplete/invalid presentation without simulated
  eligibility, findings, or candidate decoration.

### Acceptance

- a user can exercise the complete authored F topology and leaf command surface
  without editing JSON;
- selectors render declaration labels and never persist UI categories;
- retained overflow and explicit destructive actions remain visible;
- all edits pass through semantic commands and authored history;
- changing a Reward Pool retains target rewards and downstream topology;
- the slice makes no claim about game validity before Phase 3.

## Phase 2.75: Cross-Biome Catalog Closure

### Purpose

Implement the declaration and authored-schema vocabulary established by the
completed F/G/P/Q/H/O/I/N audits before Phase 3 builds canonical history. This
phase is the atomic catalog and schema-version-2 authority switch. It is not an
early simulator slice.

The completed biome rule documents are the entry gate. They establish the
smallest faithful shared model for generated-store ownership, physical exits,
encounter phases, fixed completion, conditional terminals, room-local slots,
and persistent hubs. Later-biome declarations remain dormant after import.

### Capability Boundary

Catalog presence must not imply product activation. Application composition
must distinguish these capabilities independently:

- declared in the normalized catalog;
- authorable by the project model;
- simulatable by the derived pipeline;
- editable through a UI projector.

Capability metadata is application composition, not game data stored on Room
or Biome Declarations. At this phase's end all eight biomes are declared, F/G
are authorable through schema version 2, F remains the active editor smoke
slice, and no biome is marked simulatable before Phase 3. Focused tests must
prove dormant declarations cannot leak into project defaults, selectors,
simulation dispatch, or editor navigation.

### Normalized Catalog Hardening

- authored versus layout-derived Room Declarations;
- structural room tags separate from presentation kinds;
- typed physical exits and source-sensitive compatibility;
- `LinearBiome` and `HubBiome` layout declarations;
- layout-owned fixed entry and ordered completion sequences;
- standard, staged, Fields, Clockwork, and persistent-hub batch policies;
- forked, direct, independent, and conditional terminal policies;
- authored, source-offer-derived, and absent generated-store policies;
- typed biome-global and batch-global authored fields;
- stable encounter phases with optional presence, lifecycle timing, offer
  points, and counter effects;
- bounded cage, wheel, and side-room descriptors owned by concrete rooms;
- entered-room reward-store history policies;
- complete declaration-time defaults and codecs for every imported authored
  leaf surface;
- no callbacks, untyped extension bags, room-name switches, or placeholder
  canonical materializers inside declaration records.

The legacy `fixedBoss` target mode is removed. Neutral boss/postboss rooms are
concrete derived declarations referenced by layout completion data.

### Atomic Schema Version 2 Switch

- generated batches own a base store only when their policy exposes one;
- O source batches derive the store from an addressed room offer point;
- Q and I batch policies can explicitly own no base-store value;
- Room Declarations own forced and individual store overrides;
- counted room leaves persist concrete rewards without a competing `storeKey`;
- counted-store entries own multiplicity and duplicate policy;
- reward primitives own acquisition projections;
- shop state is entry-materialized, required only on picked occurrences, and
  retained dormantly after re-pick;
- F/G defaults, codecs, commands, projection, fixtures, and application
  bootstrap move to the new authority in one change.

Schema version 1 is rejected explicitly after the switch. The pre-release app
does not retain a permanent migration path for a document format that encodes
the superseded ownership model.

### Requirement and Force Query Contract

Freeze the typed fact surface that Phase 3 history will populate:

- exact counter axes;
- creation, appearance, reward, use, and event records;
- room-history ordinal and event spacing;
- current predecessor exits and structural tags;
- generated-store and entered-store histories;
- biome-specific folded counters;
- force-pool and force-pressure inputs.

Requirement and force evaluators remain pure and receive explicit synthetic
fact snapshots in Phase 2.75 tests. This phase does not build the history
walker that produces those snapshots during a real route.

### F/G Authority Proof

Before later imports, migrate F/G onto the final vocabulary:

- concrete-only counted leaves and batch-owned store policies;
- entry-materialized shops;
- exact physical exits, force declarations, and store-history policies;
- derived `F_Boss01`, `F_PostBoss01`, `G_Boss01`, and `G_PostBoss01` Room
  Declarations;
- layout-owned completion sequences;
- current F editor smoke behavior preserved through schema version 2.

### Dormant Import Order

1. P: typed source tags and source-sensitive exit compatibility.
2. Q: staged candidate pools, reward-free batches, and boss-only completion.
3. H: typed batch-global cage outcome and room-local bounded cage slots.
4. O: ordered encounter phases, reward wheels, and source-offer-derived store.
5. I: biome globals, fixed Tartarus provenance, and conditional terminal
   batches.
6. N: fixed authored slots, persistent hub board, visits, and bounded side
   rooms.

Each import adds explicit room, encounter, reward, exit, layout, requirement,
and completion declarations with readable parity fixtures. It must not add an
editor panel, canonical history, contextual candidate results, or a placeholder
simulation implementation.

### Acceptance

- one immutable catalog normalizes faithful F/G/H/I/N/O/P/Q declarations;
- every declaration reference, semantic kind, policy key, requirement kind,
  default, and codec validates at construction;
- per-biome parity fixtures cover room identities, labels, exits, tags,
  encounters, rewards, caps, requirements, layouts, and completion;
- external save/profile requirements remain omitted rather than represented by
  production zombie predicates;
- no topology consequence is encoded as fake room eligibility;
- no counted room leaf retains generated-store authority;
- no unpicked shop occurrence requires invented inventory;
- every derived completion room and route transition is data-driven;
- F/G schema-version-2 round trips and the F editor smoke suite pass;
- dormant capability guards prevent H/I/N/O/P/Q authoring, simulation, and UI
  activation;
- no canonical event stream, history ledger, candidate evaluation, or semantic
  finding is introduced before Phase 3.

## Phase 3: F Simulation Vertical Slice

### Deliverables

- F completeness gate;
- common linear canonical materializer;
- layout-derived F boss/postboss completion materialization;
- room-template materializers required by F;
- lifecycle event stream;
- route history and counter ledgers;
- F room eligibility, caps, and force validation;
- F reward offers, acquisitions, counted-bag simulation, and shop behavior;
- possibility-support evaluation for rooms, reward stores, bag entries, and
  Boon sources;
- semantic findings;
- deterministic golden fixtures for complete valid, incomplete, and invalid F
  projects.

Candidate simulation is not required until selected-plan validation is stable.

### Acceptance

- one representative F project materializes every picked and unpicked
  occurrence;
- a focused fixture materializes repeated game room names as distinct offers;
- creation, appearance, offer, and acquisition histories differ correctly;
- a low-weight eligible room remains valid while an active forced pool excludes
  ordinary eligible rooms;
- reward-store chance boundaries distinguish impossible, possible, and forced
  outcomes without producing likelihood scores;
- `biomeDepthCache` and `biomeEncounterDepth` follow declared timing;
- terminal realization uses predecessor context correctly;
- incomplete F produces no canonical snapshot;
- invalid complete F retains its snapshot and findings;
- equal normalized inputs produce deeply equal simulation results;
- findings resolve to stable semantic addresses without UI information.

## Phase 4: Thin Usable F Editor

### Deliverables

- Underworld/Surface/Settings application shell;
- route prefix control;
- linear-biome F projection;
- opening selection;
- add/remove decision commands;
- type and room target selectors;
- picked-exit single-choice UI;
- room-template and reward editors required by the F fixture;
- preboss editor;
- project-level status and findings navigation;
- undo/redo controls and keyboard shortcuts;
- browser-local project load/save initially, with downloadable/uploadable JSON
  if direct filesystem access is not yet present.

### Acceptance

- a user can build the golden F project without editing JSON;
- all UI changes dispatch semantic commands;
- invalid and incomplete states remain editable;
- findings navigate to their semantic owner;
- room labels never leak internal identifiers;
- save/reload reproduces authored state and simulation output;
- UI tests cover our command binding, not third-party component internals.

## Phase 5: F/G Product Loop

### Deliverables

- candidate evaluation using shared materializers and validators;
- context-invalid option decoration;
- complete F template coverage;
- G catalog and simulation coverage using the shared linear foundation;
- G's neutral `G_Boss01`/`G_PostBoss01` completion sequence and resolved boss-
  offer store-history contribution;
- G editor activation;
- project dirty state and autosave policy;
- resilient project-load error presentation;
- measured responsiveness for full F/G edits;
- accessibility and keyboard pass.

### Acceptance

- F and G both author, simulate, validate, save, and reload;
- candidate results agree with selected-plan validation for the same value;
- blocked downstream biome behavior is clear and does not invent local
  validity;
- no simulation rule exists only in UI code;
- full rebuild latency remains comfortably interactive on representative
  projects;
- the app is useful without Tauri packaging or game execution.

## Phase 6: Controlled Biome Expansion

Implement in this order unless concrete dependencies justify a change:

1. H: Fields room structure, cage batches, and encounter-depth behavior.
2. I: Clockwork Goals, acquisition counters, and conditional-terminal batches
   with repeated preboss occurrences.
3. N: Hub layout, ordered pylon visits, returns, and side rooms.
4. O: ship multi-encounter rooms and sequential reward wheels.
5. P: linear surface topology and room-internal encounter rules.
6. Q: forced skeleton and independently generated two-exit miniboss stages.

For each biome:

- verify declarations;
- add authored topology support;
- add golden canonical/history fixtures;
- add selected validation;
- add editor projection;
- add candidate evaluation;
- activate it only after its full product loop passes.

Do not create placeholder production behavior that claims a biome is simulated
when it only has declarations or UI.

## Phase 7: Desktop Shell

Add Tauri after browser F/G proves the application architecture.

### Deliverables

- Tauri 2 wrapper around the existing Vite build;
- native open/save dialogs;
- scoped project-file access;
- clipboard integration;
- Windows packaging;
- app preferences that are separate from project documents.

### Acceptance

- browser-hosted core and tests remain unchanged;
- no simulation logic moves into Rust;
- project files round-trip identically in browser fixtures and desktop use;
- filesystem permissions are narrow and explicit;
- packaged Windows behavior passes a focused smoke test.

## Phase 8: Simulation Conformance and Game Protocol

Begin only after the readiness gate in `GAME_INTEGRATION_BOUNDARY.md` passes.

### Deliverables

- manual or instrumented traces for representative complete plans;
- documented expected/observed mismatches;
- corrections to app simulation;
- execution-plan JSON schema derived from runtime needs;
- compiler from complete valid simulation to that schema;
- game-module importer and runtime auditor in its own repository;
- structured mismatch report format;
- iterative conformance fixtures.

The game module remains a declarative consumer and auditor.

## Phase 9: Hardening

- project schema migrations;
- corruption and recovery UX;
- broad performance profiling;
- worker offload only if measured simulation latency requires it;
- application updates and release process;
- full accessibility audit;
- documentation reconciliation;
- removal of superseded temporary migration notes;
- decision on whether the frozen ImGui editor can be removed from the game
  module.

## Legacy Work Disposition

Carry forward:

- verified game-data facts;
- explicit declaration content;
- reward hierarchy and defaults;
- route and biome layout concepts;
- topology/leaf lifecycle distinction;
- separation of unique Room Declarations from repeatable authored Room
  Occurrences;
- downstream-retention policy;
- semantic addresses;
- materialization/history/validation separation;
- focused behavior fixtures that can be expressed independently of Lib.

Leave behind:

- ModpackLib control instances;
- bounded managed-storage codecs designed for controls;
- ImGui draw and transient selector plumbing;
- commit/reload publication callbacks;
- allocation rules specific to the game draw loop;
- fake-ImGui tests;
- runtime execution compilation until Phase 8.
