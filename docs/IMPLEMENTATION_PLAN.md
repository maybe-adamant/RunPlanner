# Implementation Plan

## Purpose

This document defines the greenfield implementation order for the standalone
app. It separates stable design guidance from mutable implementation progress.

When implementation begins, add `IMPLEMENTATION_PROGRESS.md` as a factual
status ledger. Do not turn completed checkpoint history into design authority.

## Delivery Principles

- Build the pure model and simulator before sophisticated UI.
- Deliver thin vertical slices rather than porting every declaration first.
- Preserve explicit readable game declarations.
- Use F as the first complete slice and G as the first reuse proof.
- Keep browser development independent of Tauri packaging.
- Freeze rather than delete the old game-module prototype.
- Port verified rules, not Lua architecture.
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
- encounter profiles required by F/G;
- F and G room declarations with explicit labels and defaults;
- F/G linear layout declarations;
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
- malformed declarations fail at construction;
- no React or Redux imports exist in catalog/core domain code;
- focused parity fixtures cover representative opening, combat, miniboss,
  story, fountain, shop, and preboss rooms.

## Phase 2: Authored Project and Commands

### Deliverables

- versioned `ProjectDocument` decoder and encoder;
- empty project and route defaults;
- contiguous configured route prefixes;
- F/G `LinearBiome` authored topology;
- opaque persisted occurrence IDs separate from game room names;
- occurrence-state initialization from recursive declaration defaults;
- semantic address constructors;
- explicit topology and leaf command handlers;
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
- active leaves are always complete after construction or replacement;
- upstream replacement retains compatible downstream topology;
- exit shrink, re-pick, reconcile, and capacity restoration match the locked
  downstream policy;
- explicit structural deletion removes owned occurrences while undo restores
  the complete prior snapshot;
- undo/redo reproduces exact authored snapshots;
- malformed JSON and invalid structural commands fail at their contact
  boundaries.

## Phase 3: F Simulation Vertical Slice

### Deliverables

- F completeness gate;
- common linear canonical materializer;
- room-template materializers required by F;
- lifecycle event stream;
- route history and counter ledgers;
- F room eligibility, caps, and force validation;
- F reward offers, acquisitions, counted-bag simulation, and shop behavior;
- semantic findings;
- deterministic golden fixtures for complete valid, incomplete, and invalid F
  projects.

Candidate simulation is not required until selected-plan validation is stable.

### Acceptance

- one representative F project materializes every picked and unpicked
  occurrence;
- a focused fixture materializes repeated game room names as distinct offers;
- creation, appearance, offer, and acquisition histories differ correctly;
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
2. I: Clockwork Goals, repeated preboss offer semantics, and terminal
   companions.
3. N: Hub layout, ordered pylon visits, returns, and side rooms.
4. O: ship multi-encounter rooms and sequential reward wheels.
5. P: linear surface topology and room-internal encounter rules.
6. Q: forced skeleton and paired miniboss structure.

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

## Immediate Next Work Item

Phases 0 and 1 are complete. Phase 2's top-level document codec, configured
route prefixes, incomplete linear-biome form, and deterministic JSON round
trips are implemented. Recursive F/G room defaults and the non-null linear
topology codec are also complete. Semantic address constructors and the first
ordinary topology/leaf command path are implemented. Next add terminal and
explicit destructive/reconciliation commands before the undo/redo wrapper.
