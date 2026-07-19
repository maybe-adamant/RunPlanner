# Implementation Plan

## Purpose

This document defines the greenfield implementation order for the standalone
app. It separates stable design guidance from mutable implementation progress.

`IMPLEMENTATION_PROGRESS.md` is the factual status ledger. Do not turn
completed checkpoint history into design authority.

## Delivery Principles

- Build pure domain foundations before sophisticated UI. A thin authored editor
  may precede simulation, but contextual validation and enrichment wait for the
  simulator.
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
- the initial `RewardPrimitive` and `acquiredAs` projection prototype, payload
  domains, stores, bags, and bindings required by F/G;
- the initial counted-entry duplicate and reward-projection policies;
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

- schema version 1 `ProjectDocument` decoder and encoder;
- empty project and route defaults;
- contiguous configured route prefixes;
- F/G `LinearBiome` authored topology;
- opaque persisted occurrence IDs separate from game room names;
- occurrence-state initialization from recursive declaration defaults;
- leaf-owned counted reward state containing the selected store and concrete
  reward;
- complete eagerly initialized WorldShop state on every shop occurrence;
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
- offer-time leaves are always complete after construction or replacement;
- every shop occurrence contains complete WorldShop state;
- every counted reward leaf contains one coherent selected store and concrete
  reward under the original prototype authority;
- upstream replacement retains compatible downstream topology;
- exit shrink, re-pick, reconcile, and capacity restoration match the locked
  downstream policy;
- explicit structural deletion removes owned occurrences while undo restores
  the complete prior snapshot;
- undo/redo reproduces exact authored snapshots;
- malformed JSON and invalid structural commands fail at their contact
  boundaries.

This phase records the delivered prototype rather than the final reward
authority. Phase 2.7 replaces its leaf-owned store and eager-shop contracts in
one schema-version-2 switch.

## Phase 2.5: Authored Editor Smoke

### Deliverables

- Underworld/Surface/Settings application shell;
- an F-configured project bootstrap for smoke testing;
- linear start, ordinary decision, picked-exit, terminal, reward, and shop
  projections bound only to Phase 2 semantic commands;
- complete leaf-owned reward-pool, reward-primitive, payload, and shop editors;
- undo/redo controls;
- deliberately neutral incomplete/invalid presentation without simulated
  eligibility, findings, or candidate decoration.

### Acceptance

- a user can exercise the complete authored F topology and leaf command surface
  without editing JSON;
- selectors render declaration labels and never persist UI categories;
- retained overflow and explicit destructive actions remain visible;
- all edits pass through semantic commands and authored history;
- the slice makes no claim about game validity before Phase 3.

## Phase 2.6: Reward Kernel

### Purpose

Implement the audited reward vocabulary and pure reward-state transitions
without changing the connected schema-version-1 F/G editor. The kernel accepts
explicit synthetic fact snapshots; it does not own topology, canonical route
history, the authored project, or UI projection.

### Deliverables

- normalized reward types, payload domains, complete resolved offers, and
  typed acquisition roles;
- closed source-support policies for ordinary peer-excluding Boons, ordinary
  no-peer sources, and acquired-source Devotion pairs, each with an explicit
  resolution point;
- counted stores and entries with declaration order, multiplicity, duplicate
  policy, requirements, retained leftovers, one complete refill, and latent
  bag-state branching;
- the exact 13-entry fully progressed `MetaProgress` projection;
- generic offer history plus the closed Devotion offer-time spacing projection;
- concrete acquisition declarations and the exhaustive `lootAndUse` or
  `consumableAndUse` history-projection registry;
- ordered World, I, and Q shop groups with offer counts, per-option
  requirements, and without-replacement support;
- the behavior-preserving requirement rename from `notInStore` to
  `notInCurrentRoomShopOptions` in the shared evaluator and reward declarations;
- pure shop generation and purchase-order transitions, including delayed Blind
  Box source validation;
- explicit synthetic requirement and reward-context fixtures for every rule
  the kernel consumes.

The schema-version-1 leaf-owned store model remains the sole connected
production authority throughout this phase. The new kernel may coexist only as
an unconnected pure subsystem with no competing project or UI representation.

### Acceptance

- all reward declarations normalize without reward-name switches;
- every source-bearing reward selects an audited source policy and compatible
  offer- or acquisition-time resolution point;
- reward parity covers store order and multiplicity, duplicates, one-refill
  behavior, latent bag states, source support, Devotion timing, acquisition
  projections, and all three shop profiles;
- Blind Box support branches over meaningful purchase orders and retains an
  execution witness;
- the trait-free `upgradableTraitCount`, `allSpellInvested`, and
  `pendingSpellDrop` baselines are explicit fixtures;
- no authored schema, editor command, canonical history walker, candidate
  evaluation, or semantic finding changes in this phase.

## Phase 2.7: F/G Reward Authority Switch

### Purpose

Move F/G onto the reward kernel and the locked store-ownership model in one
schema-version-2 change. Delete the superseded v1 types rather than preserving
two authorities or adding pre-release migration scaffolding.

### Deliverables

- schema version 2 project defaults, codecs, commands, semantic addresses, and
  round-trip fixtures;
- batch-owned generated stores only where the batch policy exposes an authored
  base store;
- declaration-owned forced and individual store overrides;
- complete resolved-offer-only counted leaves with no competing `storeKey`;
- entry-materialized shop state required only on picked occurrences and
  retained dormantly after re-pick;
- `ReplaceBatchRewardStore` with target-reward and downstream retention;
- F/G declarations bound to normalized reward types, stores, source policies,
  shops, producer lifecycles, and store-history policies;
- F editor projection and application bootstrap moved to the new authority.

Schema version 1 is rejected explicitly after the switch. There is no permanent
migration path for the superseded pre-release format.

### Acceptance

- no persisted counted leaf contains a generated `storeKey`;
- no unpicked shop occurrence requires invented inventory;
- changing a batch store retains target rewards and downstream topology;
- F/G schema-version-2 JSON round trips, command fixtures, and F editor smoke
  tests pass;
- the old `RewardPrimitive`, `acquiredAs`, eager-shop, and leaf-store
  authorities are deleted;
- one connected reward authority exists before Phase 2.8 begins.

## Phase 2.8: Cross-Biome Declaration Closure

### Purpose

Harden the structural catalog vocabulary against every completed biome audit,
reconcile F/G to it, and import P/Q/H/O/I/N as dormant declarations before
Phase 3 builds canonical history.

### Capability Boundary

Application composition distinguishes declared, authorable, simulatable, and
editable capabilities. Capability metadata is not game data on Room or Biome
Declarations. At phase end all eight biomes are declared, F/G are authorable,
F remains the active editor smoke slice, and no biome is simulatable before
Phase 3.

### Deliverables

- authored versus layout-derived rooms and structural tags separate from
  presentation kinds;
- typed physical exits and source-sensitive compatibility;
- `LinearBiome` and `HubBiome` layouts with fixed entry and ordered derived
  completion sequences;
- standard, staged, Fields, Clockwork, persistent-hub, forked, direct,
  independent, and conditional-terminal policies;
- authored, source-offer-derived, and absent generated-store policies;
- typed biome-global and batch-global fields, stable encounter phases, bounded
  local slots, and entered-store history policies;
- derived F/G boss and postboss Room Declarations replacing `fixedBoss`;
- extensions to the typed requirement and force-query surface required by
  later-biome declarations, evaluated over explicit synthetic fact snapshots;
- dormant P, Q, H, O, I, and N declaration imports in that pressure-test order;
- capability-isolation tests proving dormant declarations cannot leak into
  project defaults, selectors, simulation dispatch, or editor navigation.

Each dormant import adds readable room, encounter, reward, exit, layout,
requirement, and completion parity fixtures. It does not add an editor panel,
canonical history, contextual candidates, or placeholder simulation.

### Required Commit Sequence

Phase 2.8 is delivered through the following ordered commits. A later commit
must not compensate for a missing earlier gate, and biome imports must not be
combined merely because they share declaration syntax. A commit is complete
only when its implementation, parity/isolation fixtures, and documentation all
satisfy both its Deliver and Gate lists; deferred work or a follow-up fix is not
evidence that the current commit is closed.

#### Commit 1: Capability Isolation

Deliver:

- one composition-owned capability matrix whose declared capability is derived
  from the normalized catalog and whose authorable, simulatable, and editable
  sets are independently explicit;
- normalized subset invariants: editable biomes are authorable, and every
  active capability references a declared biome step;
- the Phase 2.8 baseline of F/G authorable, F editable, and no simulatable
  biome;
- capability-aware project bootstrap/load and semantic-command contact points
  that reject dormant biome authoring without putting capability flags on Room
  or Biome Declarations;
- capability-derived editor navigation and selector scope rather than a second
  handwritten supported-biome list;
- isolation fixtures proving Underworld cannot be configured past G, Surface
  cannot yet be configured, dormant commands fail at the application boundary,
  and only F receives an editor entry.

Gate:

- adding a normalized dormant layout or room cannot change project defaults,
  accepted application commands, simulator availability, or UI navigation;
- catalog construction and pure structural codecs remain independent of React,
  Redux, and application capability policy;
- no simulator stub or placeholder editor panel is introduced.

#### Commit 2: Shared Structure and F/G Reconciliation

Deliver:

- explicit authored versus layout-derived room mode, with structural tags
  separated from player-facing room kind;
- typed physical exits and an explicit compatibility policy for the currently
  unconstrained F/G doors;
- the closed layout discriminants and reusable fixed-entry, fixed-authored-
  slot, ordered-completion, terminal, batch, biome-field, batch-field, and
  local-child descriptor vocabulary required by the audited biome set;
- the authored-base-store, source-offer-point, and no-base-store policy union,
  while retaining authored-base-store as the only F/G active form;
- concrete F/G boss and postboss Room Declarations plus layout-owned ordered
  completion sequences and route transitions;
- removal of `fixedBoss` as an encoded room-exit shortcut;
- F/G declarations, schema-version-2 projects, commands, and the F editor
  reconciled without changing their authored behavior;
- synthetic construction failures for every newly closed semantic policy or
  descriptor kind.

Gate:

- every F/G structural and reward parity fixture remains green;
- F/G completion is entirely declaration/layout driven even though Phase 3
  does not materialize it yet;
- no P/Q/H/O/I/N room declaration is imported in this commit;
- no event stream, history ledger, candidate evaluator, semantic finding, or
  biome-specific simulator switch appears.

#### Commit 3: Dormant P Declaration Import

Deliver:

- the complete progressed-save, NPC-free P room and encounter declaration set;
- P's intentionally empty intro projection, ordinary linear layout, forked
  preboss, and ordered boss/postboss completion;
- typed Indoor/Outdoor structural tags and source-sensitive exit compatibility
  without encoding target consequences as fake eligibility ranges;
- P's authored RunProgress/MetaProgress batch-store policy, concrete room
  filters, caps, force rules, counters, store-history policies, and reward
  producers;
- parity fixtures for every P room identity, physical exit, encounter-depth
  asymmetry, requirement, terminal role, and completion step.

Gate:

- P is declared but remains non-authorable, non-simulatable, and non-editable;
- NPC variants and save/profile requirements remain omitted rather than
  represented by production placeholders;
- after excluding the required catalog-version change, the F smoke project and
  selector projections remain structurally identical across the P import.

#### Commit 4: Dormant Q Declaration Import

Deliver:

- Q's supported foyer, combat, miniboss, shop, boss, and repeat-run completion
  declarations under the progressed-save baseline;
- the scripted/staged linear layout, stage-owned candidate pools, direct Summit
  shop transition, and declared completion sequence with no Palace postboss or
  inaccessible Story path;
- explicit no-base-store ordinary batches, independent paired miniboss target
  semantics, and the `TyphonBossRewards` forced-store surface;
- Eye/Tail encounter-depth asymmetry, exact caps, requirements, exits, and
  repeatable-peer parity fixtures.

Gate:

- Q's reward-free spine does not acquire an invented RunProgress/MetaProgress
  batch value;
- paired minibosses remain distinct ordered occurrences and are not collapsed
  into a uniqueness rule;
- Q remains non-authorable, non-simulatable, and non-editable.

#### Commit 5: Dormant H Declaration Import

Deliver:

- H's fixed entry, combat, bridge, special-room, preboss, boss, and postboss
  declaration set;
- the four-room count-driven Fields layout and its standard, Fields, and
  forked-preboss structural policies;
- typed batch-owned Min/Max cage outcome and hidden two-Max ceiling state with
  complete declaration-owned defaults;
- bounded room-local cage slots, exact capacity/physical-order descriptors,
  and RunProgress individual-store ownership;
- two-or-three counting-encounter profiles plus exact bridge force competition,
  counters, exits, and completion parity.

Gate:

- H uses a no-base-store batch policy and never persists an unobservable
  RunProgress/MetaProgress batch value;
- `FieldsOptionalRewards` and the terminal-only unused cage roll remain explicit
  documented deferrals, not zombie fields;
- H remains non-authorable, non-simulatable, and non-editable.

#### Commit 6: Dormant O Declaration Import

Deliver:

- the full supported O intro, combat, special-room, shop-only preboss, boss, and
  completion declaration set;
- ordered Intro plus one/two ShipCombat encounter profiles with phase-owned
  wheel offer points and complete maximum-capacity dormant wheel state;
- typed one/two-option wheel descriptors, RunProgress/MetaProgress wheel-store
  ownership, and the final-active-wheel source address;
- source-offer-point outgoing batch-store policy alongside the authored form
  used by non-ShipCombat sources;
- O's three combat eligibility families, special-room encounter-depth
  asymmetry, one-exit topology, reward timing, and completion parity fixtures.

Gate:

- room exits remain physical exits and are never inferred from wheel option
  count;
- the outgoing source-derived store is not copied into a competing persisted
  batch or leaf value;
- O remains non-authorable, non-simulatable, and non-editable.

#### Commit 7: Dormant I Declaration Import

Deliver:

- I's fixed entry sequence, ordinary combat/special rooms, canonical
  `I_PreBoss02`, WorldShop, boss, and completion declarations;
- Clockwork batch state and derived Goal/NonGoal incoming realization with one
  complete dormant NonGoal offer value;
- declaration-owned `TartarusRewards` forced-store overrides, exact room
  filters, counters, requirements, and no-base-store generated batches;
- conditional-terminal batch policy in which ordinary Add Decision remains the
  sole frontier action and the picked preboss target alone closes editable
  topology;
- entry-materialized I WorldShop state required only when the preboss target is
  picked;
- parity fixtures for pre-goal, post-goal unpicked preboss, picked terminal
  preboss, and ordinary companion targets.

Gate:

- no separate Go To Preboss command or editable unpicked preboss shop state is
  introduced for I;
- Goal versus NonGoal remains derived from batch/history context rather than a
  user-authored room kind;
- I remains non-authorable, non-simulatable, and non-editable.

#### Commit 8: Dormant N Declaration Import

Deliver:

- the `HubBiome` layout discriminant and N's fixed authored Opening, PreHub,
  Hub, PreBoss, boss, and completion declarations;
- one fixed-slot persistent hub board with declaration-owned slot identity,
  supported open-set bounds, ordered six-visit trace, and derived restores;
- exact combat/miniboss target declarations, pylon requirements, hub reward
  lookup, forced-store ownership, and terminal trigger;
- bounded side-room descriptors with availability rank, generated/entered
  authored state, ordinary/hard reward bags, and jointly generated sibling
  semantics;
- parity fixtures for hub identity, open slots, visit order, restores, side-room
  capacity, side-room reward support, and completion.

Gate:

- fixed hub slots cannot be replaced through arbitrary target-creation
  commands;
- side-room player entry order remains authored separately from generation
  rank and does not create a false inherent room order;
- N remains non-authorable, non-simulatable, and non-editable.

#### Commit 9: Cross-Biome Closure Matrix

Deliver:

- one catalog-wide reference and parity matrix covering all eight biomes;
- exhaustive capability-isolation fixtures for project defaults/load,
  application commands, selectors, simulation dispatch, and editor navigation;
- route-transition and derived-completion coverage across Underworld and
  Surface layouts;
- construction failures for unknown semantic kinds, incompatible exits,
  malformed layout policies, incomplete defaults, and invalid local-slot
  ownership;
- final documentation and progress reconciliation naming every intentional
  simplification, deferral, and exclusion that remains after import.

Gate:

- F/G are authorable, F alone is editable, and no biome is simulatable;
- P/Q/H/O/I/N are fully declared but cannot enter authored state or any product
  loop;
- all repository validation passes with no placeholder materializer, dormant
  activation, duplicated authority, or compatibility scaffolding;
- Phase 3 begins only after this commit is reviewed and accepted.

### Acceptance

- one immutable catalog normalizes faithful F/G/H/I/N/O/P/Q declarations;
- every declaration reference, semantic kind, policy key, requirement kind,
  default, and codec validates at construction;
- per-biome parity covers identities, labels, exits, tags, encounters, rewards,
  caps, requirements, layouts, and completion;
- external save/profile requirements remain omitted rather than represented by
  production zombie predicates;
- no topology consequence is encoded as fake room eligibility;
- every derived completion room and route transition is data-driven;
- dormant capability guards prevent H/I/N/O/P/Q authoring, simulation, and UI
  activation;
- no canonical event stream, history ledger, candidate evaluation, or semantic
  finding is introduced before Phase 3.

## Phase 3: F Simulation Vertical Slice

### Deliverables

- F completeness gate;
- normalized reusable room lifecycle profiles and their closed operation
  vocabulary;
- declaration-driven lifecycle effects and immutable occurrence-addressed
  events with strict dispatch;
- occurrence-addressed single-room history fragments composed through exact
  outgoing-generation checkpoints;
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
- standard reward acquisition affects the same room's outgoing generation,
  while WorldShop purchases affect generation only after the already-generated
  next room;
- the fourth-shop-source/fifth-door-source trace remains valid and has an
  operation-order witness;
- a low-weight eligible room remains valid while an active forced pool excludes
  ordinary eligible rooms;
- reward-store chance boundaries distinguish impossible, possible, and forced
  outcomes without producing likelihood scores;
- `biomeDepthCache` and `biomeEncounterDepth` follow declared timing;
- target preparation observes predecessor post-commit caches while outgoing
  generation observes source pre-commit caches;
- terminal realization uses predecessor context correctly;
- incomplete F produces no canonical snapshot;
- invalid complete F retains its snapshot and findings;
- equal normalized inputs produce deeply equal simulation results;
- findings resolve to stable semantic addresses without UI information.

## Phase 4: Thin Usable F Editor

Phase 4 promotes the existing Phase 2.5 authored-editor smoke surface by
connecting it to Phase 3 simulation, findings, and project persistence. It does
not rebuild the shell or command-bound topology editors.

### Deliverables

- route prefix control;
- Phase 3 simulation publication through the application composition root;
- completeness, validity, and semantic-finding projection onto the existing F
  editor;
- project-level status and findings navigation;
- undo/redo keyboard shortcuts for the existing semantic history;
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
- complete F candidate-projection coverage across every room template;
- G simulation coverage using the shared linear foundation;
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
