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
- `packages/planner-engine`;
- `packages/hades2-catalog`;
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
  from route-placed normalized layouts and whose authorable, simulatable, and editable
  sets are independently explicit;
- normalized subset invariants: editable biomes are authorable, and every
  active capability references a declared biome;
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
- F/G declarations, projects, commands, and the F editor
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

#### Commit 4: Route/Biome Identity Cleanup

Deliver:

- one global Biome Declaration collection owning stable biome keys and labels;
- route declarations containing only ordered global biome-key references;
- room, layout, capability, project, semantic-address, and editor contracts
  using `biomeKey` without route-qualified biome identities;
- project schema version 3 and a matching catalog-version bump, with no
  compatibility scaffold for the pre-cleanup document shape;
- layout completion descriptors containing only biome-owned completion rooms,
  while route order is the sole authority for next-biome versus route-complete
  behavior.

Gate:

- one Biome Declaration can be referenced by more than one route without
  duplicate room or layout declarations;
- `routeKey + biomeKey` remains the current placement and semantic-address
  owner pair;
- duplicate use of one biome within the same route fails until a distinct
  route-placement identity is deliberately introduced;
- F/G authored behavior and dormant P isolation remain unchanged;
- Q declarations are not imported in this commit.

#### Commit 5: Dormant Q Declaration Import

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

#### Commit 6: Dormant H Declaration Import

Deliver:

- H's fixed entry, combat, bridge, special-room, preboss, boss, and postboss
  declaration set;
- the four-room count-driven Fields layout and its standard, Fields, and
  forked-preboss structural policies;
- typed batch-owned Min/Max cage outcome with a complete declaration-owned
  default, plus the history-derived hidden two-Max ceiling contract;
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

#### Commit 7: Dormant O Declaration Import

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

#### Commit 8: Dormant I Declaration Import

Deliver:

- I's authored Intro, generated Story peers, ordinary combat/special rooms, canonical
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

#### Commit 9: Dormant N Declaration Import

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

#### Commit 10: Cross-Biome Closure Matrix

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
- every derived completion room is layout-driven and every route transition is
  derived from route-owned biome order;
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

### Required Commit Sequence

Phase 3 is delivered through the following ordered commits. Each commit must
leave the pure core and normalized catalog internally coherent and must pass
the repository validation suite. A later commit may extend an earlier result,
but it must not supply missing invariants that the earlier commit claimed to
close. React, Redux publication, editor feedback rendering, candidate lists,
and execution-plan compilation remain outside this sequence.

#### Commit 1: Evaluation Contracts and F Completeness

Deliver:

- discriminated incomplete and complete biome-evaluation contracts that make
  it impossible to attach a canonical snapshot to an incomplete biome;
- the semantic finding contract with stable game-domain codes, severity,
  phase, semantic origin, and structured evidence, without UI positions or
  instance-shaped finding codes;
- one F completeness evaluator over normalized authored topology, separate
  from project decoding and semantic legality;
- explicit completeness checks for an authored start, a closed picked spine,
  every referenced target, every required pick, the terminal transition and
  its active targets, batch-owned values, active incoming rewards, and picked
  shop state;
- focused fixtures for an unstarted F biome, a partially authored ordinary
  decision, a missing pick, an unfinished terminal transition, and one fully
  complete but not yet validated F biome.

Gate:

- malformed topology remains a project-codec contract error rather than an
  incomplete result;
- a structurally valid but unfinished F biome produces addressed completeness
  findings and no canonical snapshot;
- completeness does not evaluate room eligibility, caps, force, reward
  support, or shop possibility;
- no placeholder `simulateProject`, canonical materializer, event stream, or
  candidate result is introduced.

#### Commit 2: Lifecycle Profiles and Single-Room Execution

Deliver:

- normalized reusable Room Lifecycle Profile declarations and the closed
  operation vocabulary required by F;
- strict catalog normalization for lifecycle profile keys, operation kinds,
  encounter references, producer lifecycle points, and declaration-owned
  effect kinds;
- declaration-driven effect and exhaustive operation dispatch registries in
  the pure core;
- immutable occurrence-addressed lifecycle events and a concrete
  `RoomHistoryFragment` result;
- F-required standard-room, WorldShop, terminal, Boss, and PostBoss lifecycle
  profiles plus Devotion producer-point composition, reusing the existing
  reward producer lifecycle authority rather than duplicating acquisition
  timing;
- focused ordering fixtures for the standard producer-advance point, Devotion
  before/after-combat producer points, WorldShop generation-before-purchase,
  counting versus non-counting encounters, and commit-time counter effects.

Gate:

- lifecycle execution dispatches through normalized profile, encounter,
  producer, and effect declarations and never through concrete F room names;
- an unknown profile, operation, effect, or lifecycle point fails at a strict
  construction or dispatch boundary rather than becoming a no-op;
- no unrestricted callback/event DSL or final-room aggregate is introduced as
  a second timing authority;
- the executor can produce a deterministic single-room fragment without a
  linear-biome materializer or React/application dependency.

#### Commit 3: Common Linear Materializer and Canonical F

Deliver:

- the canonical linear-biome, room, batch, target, terminal-entry, and
  completion-room contracts defined by `../design/SIMULATION_AND_VALIDATION.md`;
- one common `LinearBiome` materializer that consumes complete normalized
  topology and layout declarations without validating contextual legality;
- strict room-template materializer dispatch for every authored F template;
- materialization of the selected F opening, every ordinary picked and
  unpicked occurrence, batch store provenance, resolved incoming leaves,
  terminal Shop/Free targets, and stable semantic return addresses;
- layout-derived `F_Boss01` and `F_PostBoss01` completion materialization in
  declared order;
- fixtures for a representative complete F topology, repeated `gameName`
  values with distinct occurrence IDs, one- and two-exit predecessors, and
  terminal realization from exact predecessor exits.

Gate:

- the materializer is callable only after completeness succeeds and never
  invents missing authored values;
- complete but context-invalid authored facts still materialize unchanged so
  later validation can diagnose them;
- repeated game room names remain separate canonical occurrences, offers, and
  semantic owners;
- completion rooms come only from the layout descriptor and are not authored
  occurrences, generated candidates, or room-name special cases;
- no history reconstruction, eligibility decision, topology repair, or
  candidate enumeration appears in the materializer.

#### Commit 4: Lifecycle Composition and History Ledgers

Deliver:

- composition of occurrence-addressed room fragments by following the picked
  F spine while retaining every generated unpicked peer at its predecessor's
  outgoing-generation checkpoint;
- one immutable deterministic lifecycle event stream spanning authored rooms,
  terminal entry, derived Boss/PostBoss completion, and biome completion;
- event-folded ledgers for room creation, room appearance, encounter starts
  and completion, `biomeDepthCache`, `biomeEncounterDepth`, route encounter
  depth, room-history ordinal, and entered-store history;
- exact pre-outgoing, post-commit, preparation, entry, outgoing-generation,
  and exit state views needed by later validators;
- fixtures proving sequential physical target creation, unpicked creation
  without appearance, encounter-start depth increments, commit-time cache
  increments, target preparation from predecessor post-commit state, and
  declared biome-transition resets.

Gate:

- the ordered event stream is the timing authority and every ledger is a pure
  fold over those events;
- outgoing generation observes source pre-commit caches while selected-target
  preparation observes predecessor post-commit caches;
- one committed room advances room-history caches once even when its profile
  contains several encounter phases;
- no validator reconstructs intermediate history from a final aggregate, and
  no unpicked occurrence executes an entered-room fragment.

#### Commit 5: F Room Possibility and Generation Validation

Deliver:

- exact requirement-evaluation contexts projected from lifecycle state at the
  room-generation contact point;
- F physical-exit, source/target compatibility, room eligibility, creation-
  cap, appearance-cap, and mutual-exclusion validation;
- support-only room selection with sequential physical-peer updates, positive-
  weight possibility, and forced-pool replacement of the ordinary eligible
  pool;
- unresolved force-pressure ledger updates derived at each physical target
  generation point;
- F force-pressure evaluation using the documented capped force-chance formula
  without treating its maximum as a separate upper eligibility bound;
- semantic findings addressed to the owning batch, target, picked choice, or
  occurrence, with structured pre-decision evidence;
- fixtures for a possible low-weight room, an impossible room, ordinary rooms
  excluded by an active forced pool, chance boundaries below and at forced,
  same-batch repeated names, later repeated offers, and separate creation and
  appearance caps.

Gate:

- validation checks the authored selected outcome by membership in the exact
  support set and produces no probability, likelihood, or RNG replay result;
- the same normalized requirement evaluators remain the sole current-run
  predicate authority;
- validation never edits topology, chooses a replacement, or suppresses the
  canonical snapshot of a complete invalid biome;
- candidate projection arrays and editor option decoration remain absent.

#### Commit 6: F Reward, Bag, Acquisition, and Shop Simulation

Deliver:

- lifecycle integration of the existing reward-kernel store-support, counted-
  bag, offer-history, concrete-acquisition, source-support, and shop-order
  operations;
- F authored base-store support plus declaration-owned forced and individual
  target-store overrides at the exact outgoing-generation history view;
- sequential target offer resolution, counted-bag consumption, and offer
  projections for picked and unpicked occurrences;
- concrete acquisition emission only from entered producers at their declared
  lifecycle points, including Devotion's ordered source pair;
- WorldShop inventory generation, active-option history, ordered purchased-set
  exploration, equivalent-state merging, and retained witness orders;
- semantic findings for unsupported store outcomes, bag entries, payloads,
  Boon sources, shop options, purchases, and acquisition resolutions;
- fixtures for impossible/possible/forced reward-store boundaries, one-refill
  counted bags, unpicked offers without acquisitions, standard same-room
  acquisition effects, and the fourth-shop-source/fifth-door-source trace.

Gate:

- generated target rewards are resolved in physical order and later peers see
  earlier offers, bag consumption, and offer projections;
- WorldShop inventory and outgoing targets observe pre-purchase acquisition
  history, and purchases never rewrite or revalidate the already-generated
  batch;
- reward possibility proves support only and emits no probability score;
- the simulator orchestrates the existing reward kernel instead of creating a
  competing reward, bag, source, or shop authority.

#### Commit 7: Project Simulation Orchestration and Golden Closure

Deliver:

- the pure deterministic
  `simulateProject(catalog, authoredProject): ProjectEvaluation` composition
  root;
- route-ordered biome processing with F as the only registered simulator,
  incomplete and invalid processing horizons, validated-prefix tracking, and
  project/route summaries;
- application capability promotion of F to simulatable only after the public
  simulator exists, without yet publishing simulation through Redux or React;
- explicit incomplete, complete-invalid, and complete-valid F evaluation
  results, with complete results retaining canonical snapshots, event streams,
  ledgers, witnesses, and findings;
- one representative complete valid F golden project plus focused incomplete
  and complete-invalid golden projects;
- deterministic deep-equality, stable semantic-origin, repeated-room,
  terminal-context, counter-timing, force-support, and reward/shop integration
  assertions over the public evaluation result;
- final Phase 3 documentation and implementation-progress reconciliation.

Gate:

- equal normalized catalogs and authored projects produce deeply equal public
  evaluations without reading or mutating React, Redux, browser, filesystem,
  game-runtime, or wall-clock state;
- incomplete F has no canonical snapshot, while complete invalid F retains its
  snapshot and addressed findings;
- dormant G/P/Q/H/O/I/N declarations cannot enter simulation dispatch;
- the result publishes no placeholder candidates, UI decoration, execution-
  plan JSON, or game-module instruction;
- the full repository validation suite passes and every Phase 3 acceptance
  item is covered by a named fixture before the phase is marked complete.

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

These Phase 3 gates describe the original complete-biome simulation closure.
Phase 7 deliberately enriches incomplete biome results with one progressively
evaluated prefix while preserving every no-canonical-snapshot and
complete-valid route-seed invariant above.

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

### Recommended Commit Sequence

#### Commit 1: Atomic Project Workspace and Simulation Publication

Deliver:

- one Redux-owned project-workspace state containing authored `ProjectHistory`
  and the `ProjectEvaluation` for its exact `present` document;
- initial full-project simulation at application construction;
- full deterministic resimulation after every effective semantic command,
  undo, redo, and project replacement;
- one atomic state publication for authored history plus derived evaluation,
  without a middleware or subscription follow-up dispatch;
- application selectors for the present project, history availability, and
  coherent evaluation;
- focused application tests for initial, edited, no-op, undo, and redo
  publication.

Gate:

- no Redux-observable state can pair an authored document with an evaluation
  produced from another document;
- the simulator remains a pure core collaborator and the application does not
  duplicate any completeness, materialization, generation, reward, or
  validity rule;
- simulation output remains derived, non-editable, non-persisted, and outside
  authored undo history.

#### Commit 2: Route-Prefix Command and Empty-Project Bootstrap

Deliver:

- a route-level semantic address and explicit `ConfigureRoutePrefix` project
  command;
- catalog-ordered contiguous-prefix expansion and explicit destructive
  shrink behavior in core;
- exact undo/redo restoration of removed biome plans after a prefix shrink;
- application capability enforcement over every newly configured biome;
- replacement of the hard-coded F smoke bootstrap with a normal empty project;
- an Underworld route control exposing `None` and `Erebus` in Phase 4, while
  Surface remains unconfigured;
- confirmation before a prefix shrink discards authored biome state.

Gate:

- the project persists only the route plan's ordered biome array, never a
  duplicate configured count or dormant route tree;
- the core command can reach the application-authorable prefix boundary, but
  the Phase 4 UI exposes only the prefix whose biomes are both editable and
  simulatable;
- configuring F produces `topology: null`, and removing F does not silently
  preserve or repair its topology outside semantic history.

#### Commit 3: Status, Findings, and Semantic Navigation

Deliver:

- application indexing of simulation findings by
  `semanticAddressKey(finding.origin)`;
- explicit player-facing presentation copy for every Phase 3 finding code,
  without rendering raw codes or evidence as labels;
- project, route, and F biome completeness/validity status projection;
- owner markers on the existing F start, decision, target, picked, reward,
  occurrence, shop, and terminal surfaces;
- a project-level findings surface whose entries select the owning route and
  biome panel and focus or scroll to the exact semantic owner;
- transient selected-finding/navigation state that remains outside the
  project document and authored history.

Gate:

- finding navigation resolves by semantic address and never scans rendered
  rows for a room game name, occurrence index, or display label;
- incomplete and invalid projects remain fully editable;
- room and reward declarations continue to supply player-facing labels, and
  internal game names or occurrence IDs do not leak into ordinary UI text;
- no candidate simulation, option filtering, contextual option coloring, or
  UI-local validity rule is introduced.

#### Commit 4: Keyboard History Interaction

Deliver:

- `Ctrl/Cmd+Z` undo;
- `Ctrl/Cmd+Shift+Z` and `Ctrl+Y` redo;
- text-entry and content-editable protection so project history does not steal
  native text editing;
- accessible enabled/disabled history controls driven from the same project
  history authority;
- a browser-capable React interaction-test harness and focused tests proving
  that UI intents dispatch our semantic/application actions.

Gate:

- one visible semantic edit remains one history entry;
- navigation, selected findings, panel state, and focus do not enter history;
- tests assert Run Planner command binding and resulting application state,
  not React, Redux Toolkit, or browser-control internals.

#### Commit 5: Browser Project Persistence and JSON Transfer

Deliver:

- injected application adapters for browser-local storage and JSON file
  transfer, with browser globals confined to browser adapter construction;
- explicit New, Save, and Load project operations over an initial single local
  project slot;
- downloadable encoded `ProjectDocument` JSON and upload/import through the
  capability-aware project decoder;
- project replacement that resets undo/redo history and runs a fresh atomic
  simulation rather than becoming an undoable edit;
- explicit presentation of decode, capability, and storage failures without
  substituting a guessed project;
- adapter and application tests proving normalized project and evaluation
  round trips.

Gate:

- only semantic `ProjectDocument` state is stored or exported; evaluation,
  history stacks, session state, and UI projections are reconstructed;
- save followed by load reproduces equal normalized authored state and equal
  deterministic simulation output;
- no Tauri API, direct filesystem assumption, autosave policy, dirty-state
  protocol, or schema-migration compatibility layer is introduced.

#### Commit 6: Golden F Product-Loop Closure

Deliver:

- one browser interaction fixture that starts from an empty project,
  configures F, and builds the representative golden F project without JSON
  editing;
- focused interaction fixtures for an incomplete finding, an invalid finding,
  semantic-owner navigation, undo/redo, and destructive prefix shrink/restore;
- persistence closure proving that the interactively authored golden project
  reloads to the same authored document and `ProjectEvaluation`;
- a player-facing label audit over the rendered golden editor;
- final Phase 4 implementation-progress and status-document reconciliation.

Gate:

- every Phase 4 acceptance item has a named test or focused browser smoke
  procedure;
- the complete repository validation suite and production build pass;
- Phase 4 closes without G activation, candidate evaluation, autosave/dirty
  state, Tauri packaging, execution-plan compilation, or game-module work.

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
- one explicit portable Save Profile/Load Profile workflow over normalized
  `ProjectDocument` JSON, replacing the temporary separate local and transfer
  operations from Phase 4;
- project-name editing and safe suggested profile-filename normalization;
- a separate debounced autosave/recovery channel;
- normalized-fingerprint dirty state relative to the last successful explicit
  profile save/load baseline;
- resilient project-load error presentation;
- measured responsiveness for full F/G edits;
- accessibility and keyboard pass.

### Profile Persistence Contract

Phase 5 keeps the profile file equal to the existing normalized
`ProjectDocument`; it does not introduce a competing wrapper or persistence
schema. The application receives two explicit adapters:

- `ProfileFileAdapter` for user-directed Save Profile and Load Profile;
- `AutosaveRecoveryAdapter` for browser-local crash/restart recovery.

The browser profile adapter uses download/upload and derives a safe
`.runplanner.json` filename from `project.name`. A later native adapter may use
filesystem dialogs behind the same contract. Browser globals do not enter
application or core code.

Successful explicit load establishes the loaded fingerprint baseline. A
successful save establishes the fingerprint of the snapshot actually passed
to the adapter, so an edit made while saving remains dirty. New and restored
recovery documents have no clean baseline; autosave writes never establish
one. Dirty state is equality with that normalized baseline, so undoing back to
the saved document becomes clean automatically.

Autosave runs only after effective authored replacements: semantic edits,
undo, redo, New, and successful profile load. It is debounced and ignores
session navigation, findings, and derived evaluation. A valid startup recovery
is capability-decoded, installed with fresh history and simulation, and marked
Recovered / Unsaved. A corrupt recovery value must remain intact while the app
boots a safe new project, presents the failure, and suspends further autosave
until explicit Discard Autosave or a successful profile load.

Focused coverage must prove:

- profile save/load normalized-project and evaluation equality;
- safe filename derivation from edited project names and pending-save snapshot
  semantics;
- edit-to-dirty and undo-back-to-clean behavior;
- valid startup recovery with fresh history and evaluation;
- corrupt recovery preservation and explicit discard;
- autosave failure without loss of the editable project;
- save/load cancellation as a state-preserving no-op.

### Recommended Commit Sequence

#### Commit 1: Candidate-Evaluation Foundation

Deliver:

- pure candidate-query and candidate-result contracts addressed by semantic
  generation point and proposed semantic value;
- typed distinction between unavailable evaluation context and evaluated
  impossible, possible, or forced support;
- typed game-language exclusion and force reasons suitable for later
  presentation without carrying colors, visibility, labels, or control state;
- candidate execution through the same materialization, history, generation,
  reward-support, and validation authorities used by selected-plan simulation;
- focused parity fixtures proving that selecting an evaluated candidate yields
  the same legality result under the same history.

Gate:

- candidate evaluation is pure and cannot modify the authored project or
  dispatch an editor command;
- the currently authored value remains evaluable even when it is impossible;
- incomplete earlier history produces typed unavailable context rather than a
  guessed local result;
- no React, Redux, display label, color, or rendered-position concept enters
  the candidate result.

#### Commit 2: Complete F Candidate Projection

Deliver:

- application projections for every candidate-bearing F opening, room target,
  batch reward store, reward type/payload, shop, and preboss surface;
- semantic-address indexing that lets controls consume candidate results
  without re-running domain rules;
- declaration-impossible values omitted and context-invalid values retained
  with common invalid decoration;
- focused interaction coverage across every distinct F room template and
  reward editor shape.

Gate:

- candidate and selected-plan validation agree for the same F value;
- UI code maps typed results to presentation but owns no eligibility, force,
  reward-bag, lifecycle, or topology rule;
- invalid authored values remain visible and replaceable;
- option projections use stable cached structures or measured dirty rebuilds
  rather than allocating full option sets on every render.

#### Commit 3: G Simulation and Route Continuation

Deliver:

- G completeness, linear materialization, lifecycle history, generation
  legality, reward legality, and finding composition through shared linear
  foundations;
- validated F history carried into G in route order, with declared biome-local
  resets applied at the correct completion boundary;
- G-specific opening, depth, exit, miniboss, force, and closed-door
  approximation rules from the reconciled biome authority;
- layout-derived `G_Boss01 -> G_PostBoss01` completion and the declared resolved
  boss-offer store-history contribution;
- project fixtures for valid, incomplete, invalid, and upstream-blocked G.

Gate:

- G is a registered simulator only after its full result closes under the same
  project-evaluation contract as F;
- invalid or incomplete F blocks G without inventing G-local findings;
- shared linear mechanics are generalized at their owning seam rather than
  copied into a second F-shaped pipeline;
- no G declaration becomes an editor or application rule.

#### Commit 4: G Editor Activation

Deliver:

- shared linear-biome editor composition for F and G with biome-specific room
  declarations and leaf editors selected from the catalog;
- G route navigation, topology authoring, findings navigation, status, and
  candidate decoration;
- capability activation of G as simulatable and editable only after the full
  simulator and editor paths are installed;
- F-to-G browser interaction fixtures covering authoring, upstream blocking,
  undo/redo, and semantic-owner navigation.

Gate:

- F behavior and its golden fixture remain unchanged;
- G editing dispatches only existing or deliberately generalized semantic
  commands;
- no component branches on game room names to reproduce declaration or
  simulation facts;
- dormant H/I/N/O/P/Q capabilities remain unchanged.

#### Commit 5: Portable Profile Workflow

Deliver:

- replacement of the temporary local-slot and JSON-transfer UI with injected
  `ProfileFileAdapter` Save Profile and Load Profile operations;
- one semantic project-name command and an accessible project-name editor;
- safe `.runplanner.json` suggested filename normalization;
- snapshot-accurate asynchronous save baselines and atomic capability-aware
  profile replacement;
- browser download/upload adapters plus cancellation and failure coverage.

Gate:

- the normalized `ProjectDocument` remains the only profile payload;
- successful load resets history and publishes one coherent fresh evaluation;
- failed or cancelled operations preserve the current project, evaluation,
  history, and baseline;
- browser globals remain confined to adapter construction.

#### Commit 6: Dirty State and Autosave Recovery

Deliver:

- normalized project fingerprint comparison with the explicit profile baseline
  and visible Clean, Dirty, Unsaved, and Recovered status;
- a separately injected debounced `AutosaveRecoveryAdapter` triggered only by
  effective authored replacements;
- startup recovery through the capability-aware decoder with fresh history and
  simulation;
- corrupt-recovery preservation, autosave suspension, and explicit Discard
  Autosave recovery action;
- deterministic timer, storage-failure, undo-to-clean, and recovery tests.

Gate:

- autosave never establishes the explicit clean baseline;
- session edits and simulation publication never schedule autosave;
- a fallback new project cannot overwrite an unreadable recovery value;
- recovery or autosave failure never makes the editable authored project
  unavailable.

#### Commit 7: F/G Product-Loop Closure

Deliver:

- complete F/G browser fixtures covering authoring, candidate feedback,
  simulation, validation, profiles, recovery, and semantic navigation;
- an accessibility and keyboard audit over the shared F/G editor and project
  lifecycle controls;
- measured full-rebuild, candidate-projection, and representative edit latency
  with optimization only where evidence requires it;
- player-facing label and internal-identifier leakage audit;
- final Phase 5 progress, status, and acceptance reconciliation.

Gate:

- every Phase 5 acceptance item has a named automated fixture or documented
  browser smoke procedure;
- the complete repository validation suite and production build pass;
- no Tauri packaging, execution-plan compiler, game-module integration, or
  contextual-selection UX policy is pulled into Phase 5;
- H/I/N/O/P/Q remain declaration-only and dormant.

### Acceptance

- F and G both author, simulate, validate, save as portable profiles, and load
  to equal authored and derived state;
- autosave restores valid authored work without becoming the explicit clean
  profile baseline;
- corrupt autosave cannot be silently overwritten by fallback startup state;
- candidate results agree with selected-plan validation for the same value;
- blocked downstream biome behavior is clear and does not invent local
  validity;
- no simulation rule exists only in UI code;
- full rebuild latency remains comfortably interactive on representative
  projects;
- the app is useful without Tauri packaging or game execution.

### Contextual UX Data Readiness

Phase 5 candidate evaluation preserves the game-language facts consumed by
the later contextual-selection work without implementing that presentation
inside the simulator:

- candidate results retain semantic generation-point ownership;
- support state and exclusion reasons remain typed simulation facts rather
  than `hidden`, color, dropdown-group, or other UI states;
- evaluation output distinguishes evaluated context from context unavailable
  because required earlier history is missing;
- the currently authored candidate remains assessable when it is unsupported;
- candidate support and selected-plan validation agree for the same semantic
  value;
- temporary Phase 5 decoration consumes an application projection and does
  not narrow the simulation result to the needs of the current control.

These are data-shape and ownership constraints, not additional Phase 5 UX
deliverables. The presentation contract is defined in
`../design/CONTEXTUAL_EDITOR_UX.md`.

## Phase 6: Controlled Biome Expansion

Implement in this order unless concrete dependencies justify a change:

1. H: Fields room structure, cage batches, and encounter-depth behavior.
2. I: Clockwork Goals, acquisition counters, and conditional-terminal batches
   with repeated preboss occurrences.
3. N: Hub layout, ordered pylon visits, returns, and side rooms.
4. O: ship multi-encounter rooms and sequential reward wheels.
5. P: linear surface topology and room-internal encounter rules.
6. Q: forced skeleton and independently generated two-exit miniboss stages.

The original rollout placed a UX insertion after N and before O. Delivery order
deliberately changed so O/P/Q could complete the cross-biome pressure test
first. The contextual room/reward work now begins in Phase 7 across all eight
active biomes; it is not an activation gate inside Phase 6.

For each biome, close these acceptance gates:

- verify declarations;
- add authored topology support;
- add golden canonical/history fixtures;
- add selected validation;
- add editor projection;
- add candidate evaluation;
- activate it only after its full product loop passes.

These gates are not a required one-commit-per-gate sequence. H used seven
slices because it established Fields batch state, room-local rewards, dormant
candidate projection, and the first controlled post-F/G activation boundary.
Later linear biomes should reuse those authorities and split commits only when
they introduce a genuinely new authored, simulation, candidate, or editor
contract. Declaration verification was already completed by Phase 2.8 and is
normally a parity gate rather than another migration slice.

### H Delivery Slices

H is implemented through these atomic slices:

1. dormant authored topology:
   - admit the declaration-owned `fields` batch policy and `none` generated-
     store policy through the linear project codec and semantic commands;
   - default every ordinary batch to semantic `Min` and expose one explicit
     `ReplaceFieldsCageOutcome` command;
   - preserve complete maximum-capacity cage leaves while changing batch
     state;
   - close the exact four-batch, seven-ordinary-target, forked-terminal shape
     through completeness fixtures without activating H capabilities;
2. canonical Fields materialization:
   - derive one batch capacity in physical target order;
   - activate two or three cage slots from semantic Min/Max without mutating
     dormant leaves;
   - retain no-combat and capacity-two Max outcomes while omitting the
     terminal-only cage roll;
   - materialize the fixed intro, forked terminal, boss, and postboss tail;
3. H lifecycle and route history:
   - offer active cages for every generated combat target in physical order;
   - acquire every active cage only from the picked combat occurrence;
   - apply non-counting passive phases, per-cage encounter increments,
     `fieldsMaxDoorsRolled`, fixed store provenance, and G-to-H carried state;
4. selected H validation:
   - validate H eligibility, caps, force competition, Bridge timing, miniboss
     exclusion, preboss timing, Fields outcome support, and cage reward bags;
   - emit addressed semantic findings without editing authored state;
5. H candidate evaluation:
   - expose room, cage reward, terminal reward/shop, purchase, and Min/Max
     candidate support from the same selected-plan authorities;
   - preserve selected invalid values and explicit unavailable context;
6. dormant H editor projection:
   - project the fixed-count Fields spine, batch outcome, active cage prefix,
     room leaves, terminal entry, findings, and candidates through shared
     semantic commands;
   - keep H outside production navigation and profile capabilities;
7. H product-loop activation:
   - promote H to authorable, simulatable, and editable together;
   - close complete F/G/H profiles, recovery, blocked-prefix behavior,
     accessibility, interaction, and responsiveness fixtures before moving to
     I.

### I Delivery Slices

I should close through five slices:

1. Clockwork authorship:
   - persist the declaration-owned `maxNonGoalRewards` bounded value at the
     biome owner and expose one typed semantic replacement command;
   - admit `clockwork` batches, the authored single-choice Intro, generated
     Story peers, and generated `I_PreBoss02` target occurrences without adding
     a second terminal action;
   - require complete WorldShop state only when a generated preboss target is
     picked, while retaining repeated preboss occurrences as distinct authored
     identities;
   - close codec, command, downstream-retention, completeness, and malformed-
     authority fixtures without activating I capabilities;
2. Clockwork materialization and history:
   - derive Goal versus NonGoal from the exact pre-generation Clockwork state;
   - materialize the authored Entrance, ordinary batches, repeated conditional
     preboss targets, picked-terminal closure, boss, and postboss tail;
   - apply Goal acquisition, non-goal reward acquisition,
     `BiomeRewardsSpawned`, encounter-depth, and completion timing at their
     exact lifecycle points;
   - carry the validated F/G/H route state into I without inventing a
     route-local reset;
3. selected validation and candidates:
   - validate Goal pressure, non-goal caps, room eligibility, generated
     preboss support, Tartarus reward resolution, shops, and completion;
   - evaluate the biome field, rooms, rewards, shop offers, and purchases
     through the same selected-plan authorities;
   - preserve authored invalid values and return unavailable context when the
     F/G/H prefix is incomplete or invalid;
4. I editor projection:
   - render the bounded Clockwork setting and one `Add Next Decision` frontier;
   - show derived Goal markers instead of editable rewards, retained NonGoal
     rewards when active, and generated preboss peers in the ordinary decision
     card;
   - expose a picked preboss WorldShop, semantic findings, candidates, and
     undo/redo without introducing `Go to Preboss`;
5. I product-loop activation:
   - promote I to authorable, simulatable, and editable atomically;
   - close complete F/G/H/I profiles, recovery, blocked-prefix behavior,
     semantic navigation, accessibility, interaction, and responsiveness.

### N Delivery Slices

N closes through nine slices because it establishes the persistent-Hub
traversal body inside the shared biome envelope:

1. dormant Hub authorship:
   - add `HubBiomePlan` and its exact persisted topology to the project union,
     project codec, route-prefix initializer, semantic-address vocabulary, and
     command dispatcher;
   - create the fixed authored Opening, PreHub, and Preboss leaves, author the
     nine-or-ten-member open set over catalog-fixed slots, and author a
     six-entry distinct visit sequence separately from open membership;
   - expose typed side-room generation and entered-order replacements over the
     declaration-owned bounded local slots;
   - close schema, round-trip, command, downstream-retention, completeness,
     and malformed-authority fixtures without activating N capabilities;
2. canonical Hub materialization:
   - materialize fixed entries, one persistent Hub board, all open offered
     targets in normalized physical order, six ordered visits, local side
     slots, the fixed terminal entry, and derived completion rooms;
   - preserve physical generation order separately from player visit order and
     represent parent/Hub restores without duplicate authored occurrences;
3. N lifecycle and route history:
   - apply exact Opening, PreHub, main encounter, Soul Pylon, side-room,
     parent-restore, Hub-restore, Preboss, Boss, and Postboss timing;
   - preserve room-history, biome-depth, encounter-depth, creation,
     appearance, and required-object axes at their declared lifecycle points;
4. shared biome-envelope reconciliation:
   - extract one shared history-composition boundary for biome start, fixed
     entry walking, traversal-body dispatch, terminal walking, completion-tail
     walking, transition resets, and final history folding;
   - make linear and Hub history bodies emit their ordered events through the
     same writer and return the exact terminal predecessor, while retaining
     their separate authored plans and canonical snapshots;
   - extract the duplicated completion-room materialization primitive with
     explicit reward-store provenance, but keep linear and Hub entry, body,
     terminal, snapshot assembly, and public canonical types variant-owned;
   - reduce N-specific history composition to the persistent board, open
     membership, six visit references, parent-local side excursions, and
     parent/Hub restores;
   - prove behavior preservation against the existing F, I, and N canonical
     snapshots and histories before reward simulation is attached;
5. N reward simulation:
   - generate the complete nine-or-ten-offer Hub board once in normalized
     physical order and let open unvisited targets consume counted bags without
     emitting acquisitions;
   - jointly resolve each entered parent's generated side-room sibling batch,
     acquire only entered rooms, and derive `hubRewardLookup` from the full
     initial board before validating the fixed Preboss WorldShop;
6. selected N validation:
   - validate fixed-slot identity, open count, miniboss availability, six
     distinct visits, pylons, side-generation pressure, entered ordinals,
     room/reward support, restores, shop lookup, and terminal completion;
   - address findings to exact Hub slots, visit positions, parent-local side
     slots, or leaf owners without editing authorship;
7. N candidate evaluation:
   - evaluate open membership, visit choices, side generation and entry order,
     fixed-entry rewards, Hub rewards, side rewards, Preboss offers, and
     purchases through the same selected-plan authorities;
   - preserve selected invalid values and typed unavailable upstream context;
8. dormant N editor projection:
   - project fixed entry leaves, the fixed-slot open board, a separate six-step
     visit timeline, visited-parent side-room state, the fixed Preboss shop,
     findings, and candidates through semantic commands;
   - use a structurally truthful board/list interaction without attempting the
     later contextual visual-polish pass;
9. N product-loop activation:
   - promote N to authorable, simulatable, and editable atomically;
   - close the one-biome Surface prefix, profiles, recovery, blocked-prefix
     behavior, findings navigation, candidate parity, accessibility,
     interaction, and responsiveness fixtures.

N must activate before any later Surface biome because application route
prefixes remain contiguous.

Across all nine slices, N must reuse the shared room-lifecycle,
completion-materialization, history-envelope, history-fold, counter, finding,
and feedback authorities. Its typed plan and materializer continue to own the
fixed authored entry/terminal leaves and canonical Hub assembly. Inside history
composition, Hub-specific code owns only board generation, open membership,
the six ordered visit references, parent-local side excursions, and restores.
Opening and PreHub remain a fixed entry chain; PreHub must not become an
ordinary depth-gated generated candidate. This boundary permits a dedicated
Hub plan and canonical traversal projection without creating a second history
stack.

#### Slice 4 Reconciliation Shape

Slice 4 is a behavior-preserving internal composition refactor. It does not
merge `LinearBiomePlan` and `HubBiomePlan`, replace their canonical snapshot
discriminants, or add a persisted generic body field. The existing authored
and canonical types remain the public semantic products.

The shared history order is:

```text
begin biome from layout counters and optional prior-route seed
  -> compose fixed entry chain
  -> compose traversal body
  -> compose terminal entry
  -> compose completion tail
  -> emit completion and declared transition resets
  -> fold through the topology-neutral canonical history fold
```

History composition uses the already-materialized snapshot through these
handoffs:

| Segment             | Receives                                               | Returns                                              |
| ------------------- | ------------------------------------------------------ | ---------------------------------------------------- |
| Entry composer      | canonical entry rooms and shared event writer          | last entered source room                             |
| Body adapter        | last entry, canonical body, shared event writer        | exact terminal predecessor after ordered body events |
| Terminal adapter    | predecessor, canonical terminal, shared writer         | entered terminal room                                |
| Completion composer | terminal, canonical completion rooms, shared writer    | completed ordered tail                               |
| History envelope    | layout counters, optional seed, adapters, reset policy | one topology-neutral `CanonicalBiomeHistory`         |

The linear body adapter owns generated batches, picked-target continuation,
Fields/Clockwork body state, and generated-terminal realization. The Hub body
adapter owns `N_Hub`, its one board generation, open target references, visit
order, local side excursions, and restore events. A fixed authored N Preboss
is a terminal strategy, not part of the Hub body. Opening and PreHub are entry
chain members, including their distinct leaf and lifecycle facts.

Materialization remains variant-owned. `materializeLinearBiome` continues to
own authored starts, derived fixed entries, generated batches, forked or
generated terminals, and `CanonicalLinearBiome` assembly.
`materializeHubBiome` continues to own fixed authored entries, the persistent
board, visits, the fixed authored terminal, and `CanonicalHubBiome` assembly.
Slice 4 extracts only the shared completion-room primitive because that
duplication is concrete. Its caller supplies any terminal-derived reward-store
provenance, and the helper retains the existing declaration and lifecycle
validation.

Do not introduce a materialization adapter registry, generic public body type,
or generic snapshot assembler in this slice. Entry and terminal realization
may share smaller primitives later if another concrete consumer demonstrates
the same contract.

The expected history seam is one shared event writer/lifecycle runner and one
shared envelope orchestrator with typed linear and Hub body/terminal
callbacks. Dispatch may use the normalized layout discriminant or direct typed
composition; it must not switch on biome key, room game name, or UI shape.
Function ownership is the contract. The slice does not require a particular
file split merely to make the source tree mirror the conceptual segments.

Slice 4 fixtures must prove:

- representative F and I snapshots, event order, counters, histories, and
  transition state are unchanged;
- the representative N snapshot, 26 appearances, physical board order, side
  generation order, six Pylon pairs, four parent restores, six Hub restores,
  and transition state are unchanged;
- PreHub is always the second fixed entry and never appears in room-candidate
  or generated-target projections;
- one room occurrence is still created once even when restores add several
  appearance records;
- no body adapter can emit biome start, biome completion, transition resets,
  or directly invoke a topology-specific fold;
- linear and Hub completion materialization retain their existing resolved,
  fixed, or absent entered-store behavior.

Slice 4 must not add reward simulation, selected validation, candidates,
editor projection, application capabilities, schema changes, address changes,
or compatibility scaffolding. Any golden semantic output change fails the
slice rather than being accepted as refactor fallout.

### O Delivery Slices

O should close through six slices after N:

1. ship authorship:
   - admit direct-terminal topology and source-offer-point batch-store
     authority through the project codec and semantic commands;
   - expose typed replacements for encounter count, wheel offer count, wheel
     store, active offers, and picked offer while preserving complete
     maximum-capacity wheel defaults;
   - retain dormant second-wheel values when the room uses only Intro plus one
     combat;
2. ship materialization and lifecycle:
   - materialize Intro, Combat1/wheel1, optional Combat2/wheel2, direct preboss,
     boss, and postboss in physical order;
   - generate each active wheel's offers jointly, acquire only its picked
     offer at the declared phase, and derive the outgoing batch store from the
     last active wheel;
   - apply exact encounter-depth and room-counter timing across all active
     phases and carry N route history into O;
3. selected O validation:
   - validate one-exit topology, combat-family eligibility, caps, special-room
     timing, wheel capacity, stores, offers, picks, direct preboss timing, and
     completion;
   - emit findings at the exact room, wheel, offer, pick, or continuation
     owner without editing authorship;
4. O candidate evaluation:
   - add only the new candidate vocabulary required for encounter count and
     wheel count/store/offer/pick values;
   - reuse existing room, reward, shop, and selected-plan authorities;
   - prove candidate/selected consistency, selected-invalid retention, and
     unavailable upstream context;
5. O editor projection:
   - render active and dormant wheel capacity, ordered wheel offers, one picked
     offer, direct-preboss frontier, findings, and candidates through semantic
     commands;
   - keep encounter and wheel timing out of React;
6. O product-loop activation:
   - promote O atomically after N is active;
   - close complete N/O Surface profiles, recovery, navigation, accessibility,
     interaction, and responsiveness without skipping the N prefix.

### P Delivery Slices

P should be a three-slice reuse proof:

1. dormant P core loop:
   - reuse standard batches, authored Run/Meta stores, eligibility-driven
     progression, forked preboss, and the common linear authored contract;
   - materialize and replay P's fixed start, room-internal encounter rules,
     ordinary rewards, selected validation, preboss, boss, and postboss after
     the N/O prefix;
   - add no P-specific production abstraction unless a verified rule cannot be
     represented by the existing linear authorities;
2. P candidates and editor:
   - reuse existing room, reward, shop, batch-store, terminal, finding, and
     linear-editor surfaces;
   - add only focused P fixtures for its unique room eligibility and
     room-internal encounter behavior;
3. P product-loop activation:
   - promote P atomically after N/O;
   - close complete N/O/P Surface profiles and the shared product-loop gates.

### Q Delivery Slices

Q should close through four slices:

1. scripted authorship:
   - admit the declaration-owned staged progression and direct terminal through
     codec, semantic commands, completeness, and downstream retention;
   - preserve fixed stage order, physical target order, reward-free ordinary
     batches, and independently authored miniboss peers;
2. scripted materialization and validation:
   - materialize Intro, foyer, both forks, both miniboss stages, ordinary
     stages, direct preboss, and boss in declaration order;
   - replay reward-free rooms and counted `TyphonBossRewards` offers with exact
     counters, candidate pools, force rules, and completion;
   - emit selected-plan findings without adding a generic script interpreter;
3. Q candidates and editor:
   - project stage-constrained room candidates, two-exit miniboss decisions,
     reward-free leaves, direct-preboss frontier, findings, and navigation;
   - reuse existing reward controls for miniboss rewards and add no meaningless
     batch-store editor;
4. Q product-loop activation:
   - promote Q atomically after N/O/P;
   - close the complete N/O/P/Q Surface product loop, profiles, recovery,
     accessibility, interaction, and responsiveness.

Candidate support for every later biome must consume the normal selected-plan
evaluator. Do not reintroduce a candidate-only dormant simulator. If a dormant
editor slice cannot use the normal evaluator without a second authority, keep
candidate/editor wiring in the final activation slice instead.

Dormant core work may land before a predecessor is active, but application
activation must preserve route-prefix order: `F -> G -> H -> I` and
`N -> O -> P -> Q`.

Do not create placeholder production behavior that claims a biome is simulated
when it only has declarations or UI.

Phase 6 biome editors preserve the data required by the contextual-selection
contract in `../design/CONTEXTUAL_EDITOR_UX.md`, but they do not claim that
contract is already presented. Frontier controls remain layout-specific; no
biome editor may move frontier game rules into React merely to improve its
presentation.

## Phase 7: Contextual Editing and Cross-Biome UX

Begin only after every supported biome has completed its product loop. The
completed inventory and frontier decision record live in
`../audits/CROSS_BIOME_EDITOR_UX_AUDIT.md`.

Phase 7 first makes incomplete active-biome evaluation and candidate evidence
useful during authoring. It then replaces the high-friction room and reward
controls, reconciles feedback hierarchy, and projects the result through a
layout-specific structured workspace with a focused inspector. Linear and Hub
share semantic focus, coverage, findings, and compact controls without being
forced into the same center-region structure.

### Commit 1: Progressive Evaluation Contract and Route Gate

Deliver:

- one typed progressive biome result carrying authoring completion and maximum
  truthful semantic coverage;
- explicit complete-valid prefix, one active biome, and blocked downstream
  route regions;
- unchanged canonical snapshots, final history, completion, and downstream
  seeding for complete-valid biomes;
- no canonical snapshot or invented future facts for an incomplete biome;
- route fixtures covering incomplete, invalid, valid, and blocked Underworld
  and Surface states.

The public result must remain one atomic project evaluation. Do not introduce a
candidate-only simulator or UI row coordinate.

### Commit 2: Linear Progressive Coverage

Deliver:

- covered-prefix materialization, lifecycle, history, counters, generation
  views, reward witnesses, and findings for Linear biomes;
- concrete coverage fixtures for eligibility-driven F/G/P, fixed-count H/O,
  conditional-terminal I, and staged Q;
- exact pre-decision ownership across ordinary batches, Fields outcomes,
  Clockwork Goal/NonGoal, ship wheels, and staged pools;
- strengthening of the same result to the existing complete canonical
  evaluation when the terminal and completion sequence are authored.

### Commit 3: Hub Progressive Coverage

Deliver:

- N coverage through fixed entry, complete joint open board, ordered visits
  with parent-local side state, fixed preboss, and completion;
- an explicit semantic-region boundary for the jointly generated board rather
  than rendered slot-order prefix claims;
- the same no-canonical-snapshot and no-downstream-seed rules as Linear
  incompleteness;
- focused partial-N and N-to-O route-gate fixtures.

### Commit 4: Candidate Evidence and Contextual Projection

Deliver:

- addressed coverage-not-reached evidence replacing blanket active-biome
  `biomeIncomplete` results while retaining distinct upstream-incomplete and
  upstream-invalid reasons;
- typed room requirement, counter, cap, force, compatibility, store, bag,
  sibling, Boon-source, and Devotion-pair evidence;
- one application-owned `ContextualOption` resolver with centralized
  player-facing explanations;
- forced, possible, impossible, and unassessed presentation fixtures;
- immutable-project and semantic-owner projection caching.

### Commit 5: Contextual Picker and Grouped Room Selection

Deliver:

- one application-owned ordered picker model over `ContextualOption`, including
  required, semantic-category, unassessed, selected-invalid, and unavailable
  sections;
- one accessible reusable picker component that renders the application model
  and owns only search, focus, disclosure, and interaction state;
- Radix Popover plus `cmdk` installed at the application boundary and styled
  through the existing hand-written CSS without a generic wrapper hierarchy;
- one accessible grouped and searchable concrete-room picker for Linear room
  occurrences;
- declaration/stage domains refined by contextual support rather than a
  required Type then Room interaction;
- required-first ordering, selected-invalid pinning, and an inspectable
  unavailable disclosure;
- zero- and one-option category behavior without implicit authoring;
- keyboard, screen-reader, interaction, and responsiveness fixtures across
  representative F/H/I/O/P/Q owners.

N retains its fixed-slot Hub controls and consumes the common contextual
vocabulary without acquiring arbitrary room replacement.

Gate:

- React contains no candidate grouping, force, eligibility, visibility, or
  reason-copy policy;
- a concrete room choice remains one explicit semantic command and one undo
  entry;
- the shared picker is not left as an unused abstraction.

### Commit 6: Producer-Resolved Reward-Type Domains

Deliver:

- reward domains resolved from the exact producer store before authoring;
- ordinary reward-type choices that omit unsupported store members while
  retaining and explaining the currently selected invalid type;
- declaration-forced, batch-authored, source-offer-point, fixed, wheel, cage,
  side-room, Goal/NonGoal, and shop producer ownership without a union fallback;
- representative F/G/P batch, H cage, I NonGoal, N board/side/shop, O wheel,
  and Q miniboss fixtures;
- unchanged authored rewards when a parent reward pool changes.

Gate:

- RunProgress cannot present MetaProgress-only rewards as supported and vice
  versa;
- React does not resolve stores or repair retained authored rewards;
- every projected type is justified by the existing reward-candidate authority.

### Commit 7: Relational Reward Payload Domains

Deliver:

- sequential or unordered sibling support according to the producer's declared
  generation order;
- counted-bag, Boon-source, and complete Devotion-pair assessment through the
  existing possibility frontier;
- selected-invalid payload retention with distinct bag, peer, source, pair, and
  payload explanations;
- player-facing sibling explanations that identify the semantic conflicting
  offer without exposing occurrence IDs;
- support aggregation for a Devotion first source from complete supported pairs;
- representative jointly generated and sequential fixtures across F/G/P, H, N,
  O, and Q;
- no deterministic bag-count presentation when several latent bag states are
  reachable.

Gate:

- the picker never evaluates a reward proposal in isolation when the producer
  declares sibling interaction;
- a reward remains possible when at least one reachable latent bag state supports
  it, regardless of likelihood;
- no peer, bag, Boon-source, or Devotion-pair rule exists only in React.

### Commit 8: Compact Compound Reward Picker

Deliver:

- one closed-row reward summary and one accessible transient interaction;
- immediate commit for payload-free rewards, one Boon-source step, and ordered
  chosen/spurned Devotion steps;
- support aggregation for Devotion first-source choices from complete pair
  candidates;
- one complete `ResolvedRewardOffer` command and one undo entry per finished
  interaction;
- cancellation with no authored or history change.

Gate:

- incomplete reward or payload progress never enters the authored project,
  autosave, profile document, or undo history;
- the closed control remains compact at ordinary editor widths;
- the same interaction composes incoming rewards, cages, wheels, side rooms,
  shops, and other concrete reward producers without hiding owner differences.

### Commit 9: Feedback Hierarchy and Blocked Presentation

Deliver:

- local candidate guidance beside post-command semantic findings;
- upward biome, route, and project status summaries;
- coverage-derived unassessed and blocked presentation for downstream owners;
- exact semantic navigation without finding-order or rendered-position
  inference;
- selected-invalid repair guidance independent of color;
- cross-route fixtures proving later pages remain visible and editable.

Gate:

- finding and coverage presentation resolves directly from semantic owners;
- unassessed downstream context is never rendered as local invalidity;
- compact markers and focused detail carry the same state without requiring
  color or repeated full inline error text.

### Commit 10: Structured Workspace Projection

Deliver:

- one application-owned structured-workspace projection over normalized layout,
  authored topology, occurrences, progressive or canonical evaluation,
  contextual options, and addressed findings;
- shared route-rail, semantic-focus, coverage, marker, compact-summary, and
  inspector-destination vocabulary;
- a Linear projection containing start/fixed entries, picked trunk, generated
  leaves, retained overflow, active frontier, variant-owned terminal structure,
  and completion landmarks;
- a Hub projection containing fixed entries, the joint open board, ordered visit
  timeline, side-room state, fixed terminal, and completion landmarks;
- truthful empty-outline facts: exact fixed stages, a projected terminal horizon,
  or an explicit variable-length state;
- deterministic projection and semantic-focus fixtures for all eight biomes.

Gate:

- incomplete authored topology is never labeled or treated as canonical;
- React does not walk topology, calculate route length, interpret force timing,
  or translate finding owners into rendered positions;
- N's board remains one joint generation region and does not acquire a false
  slot-order evaluation prefix.

### Candidate-System Refactor Gate

Phase 7 pauses here before Commit 11. The architecture and replay contracts are
defined by `../design/CANDIDATE_EVALUATION_MODEL.md`. The refactor lands through
the following reviewed slices.

#### Refactor Slice 1: Session Boundary and Measurement

Deliver:

- one prepared candidate session bound to an exact immutable
  `ProjectDocument` and its published `ProjectEvaluation`;
- stable route, biome, occurrence, target, and semantic-owner indexes;
- the existing scalar candidate API preserved through a compatibility adapter;
- instrumentation for the representative G product-loop and dense reward
  domains that distinguishes project rebuilds from addressed-biome candidate
  replay.

Gate:

- the candidate session consumes the exact Redux-published evaluation;
- current candidate support, evidence, and finding fixtures remain unchanged;
- measurements count replay work as well as wall-clock duration.

#### Refactor Slice 2: Reward Producer Domains

Deliver:

- typed reward-producer frontiers captured before each covered offer or atomic
  offer group during selected reward evaluation;
- complete reward-domain evaluation from one prepared producer context;
- sequential peers, unordered groups, bags, latent branches, Boon sources,
  Devotion pairs, shops, and selected-invalid repair through the existing
  reward authorities;
- removal of full addressed-biome replay from ordinary reward and shop-offer
  domains.

Gate:

- all 72 complete Devotion pairs reuse one producer frontier;
- reward-domain evaluation applies no temporary project command and performs no
  addressed-biome rebuild;
- selected-plan and candidate support agree for the same exact offer.

#### Refactor Slice 3: Room and Direct-Ledger Domains

Deliver:

- one prepared room-generation context per target owner;
- complete room-domain assessment without repeated owner lookup or
  target-generation map construction;
- indexed start-room, batch-store, and Fields support ledgers;
- exact force, requirement, cap, compatibility, counter, and reward-history
  evidence retained.

Gate:

- every room option for one target shares one pre-generation context;
- room replacement support remains independent of retained downstream repair.

#### Refactor Slice 4: Room-Local Lifecycle Domains

Deliver:

- scoped occurrence-lifecycle evaluation for O encounter count, reward wheels,
  shop purchases, and other room-local candidate families;
- unchanged lifecycle timing and acquisition ordering;
- full-biome fallback retained only for explicitly documented broad fields.

Gate:

- local room controls do not rebuild unrelated earlier or later rooms;
- scalar compatibility results and domain results remain semantically
  identical.

#### Refactor Slice 5: Hub Regions

Deliver:

- prepared N joint-board, visit, and parent-local side-room contexts;
- membership, visit, side generation, and entered-order evaluation at their
  declared region boundaries;
- unchanged atomic Hub board and ordered visit semantics.

Gate:

- no candidate path invents a slot-order Hub prefix;
- N reward and structural candidates retain selected-plan parity.

#### Refactor Slice 6: Structured Workspace Consumption Bridge

Deliver:

- structured workspace bound to the project candidate session;
- its lazy contextual resolver as the primary React candidate contact;
- removal of direct render-time candidate requests from the replaced editor
  path;
- comparable reruns of the isolated G product-loop benchmark and complete
  suite;
- removal of temporary timeout headroom when measurements justify it.

Gate:

- one project simulation occurs per authored revision;
- ordinary reward domains perform zero full addressed-biome candidate replays;
- interactive candidate work is proportional to the focused owner and domain;
- the live React path no longer receives the unbound candidate, contextual
  picker, or reward picker services;
- capability closure may proceed without changing candidate semantics.

#### Refactor Slice 7: Composition Capability Seal

Deliver:

- a production-facing candidate-session factory whose only simulation
  capability is binding one exact immutable `ProjectDocument` and its published
  `ProjectEvaluation`;
- removal of the broad candidate projection, contextual picker, and reward
  picker services from the public `createApplication()` result;
- migration of every scalar compatibility consumer, including engine,
  workspace, benchmark, and React tests, to the same production session factory
  or structured-workspace/application boundary used at runtime;
- deletion of the scalar compatibility API before this slice commits;
- focused fixtures that provide setup and injectable observers without
  implementing alternate candidate behavior;
- one audited production dependency path from application composition through
  the structured workspace to the bound session;
- no general `evaluateProject(project)` callback below the Redux publication
  boundary.

Gate:

- `main.tsx`, `App`, and editor component props expose no simulation or
  candidate-projection service;
- production candidate acquisition always consumes the exact already-published
  project/evaluation pair;
- engine, workspace, benchmark, and React tests exercise the production
  composition path appropriate to their boundary;
- test fixtures may observe production evaluation but cannot expose a scalar
  compatibility service or implement an alternate evaluator;
- candidate support, evidence, replay instrumentation, and current editor
  behavior remain unchanged.

#### Refactor Slice 8: Workspace-Owned Interaction Catalog

Deliver:

- structured-workspace interaction descriptors for every live candidate
  family: start and target rooms, counted and explicit rewards, biome fields,
  batch stores, Fields outcomes, O encounter and wheel settings, Hub
  membership and visits, side-room generation and entry order, and shop
  purchases;
- declaration-owned choice domains, labels, semantic owners, selected values,
  and zero-argument lazy loaders captured by those descriptors;
- removal of React-supplied candidate addresses, value arrays, store lists, and
  option grouping from candidate requests;
- one shared UI interaction adapter for activation, immutable-workspace cache
  identity, pending reward-domain state, and stale-result rejection;
- replacement of the broad `WorkspaceContextualResolver` methods and the
  control-specific `useRef`/`useState` lazy implementations with typed
  workspace interactions.

Gate:

- React may render static choices and authored selections but cannot choose a
  candidate horizon or construct an evaluation domain;
- every candidate loader is zero-argument with respect to semantic owner and
  declaration-owned values;
- closed, disabled, dormant, and off-focus controls perform no candidate query;
- undo, redo, profile replacement, or any authored edit invalidates interaction
  results by immutable workspace identity;
- all current keyboard, pointer, finding-navigation, and retained-authorship
  behavior remains intact.

#### Refactor Slice 9: Boundary Enforcement and Closure

Deliver:

- lint/import restrictions preventing `ui/**` from importing candidate-session
  construction, scalar candidate services, contextual projection authorities,
  or runtime simulation entry points; type-only published-evaluation imports
  remain allowed;
- one allowed UI interaction adapter as the only React-side caller of lazy
  workspace loaders;
- architecture tests proving the production application exports only the
  structured workspace boundary and that no scalar compatibility helper or
  alternate test evaluation authority remains;
- representative Underworld and Surface render-purity fixtures covering all
  eight biomes with zero candidate query batches before interaction;
- table-driven activation fixtures proving each candidate family evaluates
  only its addressed owner/domain and does not reacquire the project
  evaluation;
- stale asynchronous reward-domain fixtures spanning edit, undo, redo, and
  profile replacement;
- final G product-loop and complete-suite measurements, an audit confirming
  that fixtures compose production authorities, and reconciliation of the
  candidate design/progress documents.

Gate:

- simulation and candidate-session ownership ends at the application/workspace
  boundary;
- no React render path can reach a candidate evaluation authority directly;
- runtime and tests share the same candidate-session and structured-workspace
  production boundaries;
- one user activation produces only the declared owner/domain work and stale
  results cannot publish into a newer workspace;
- ordinary candidate interactions perform zero full addressed-biome replay;
- Phase 7 Commit 11 may resume.

### Tartarus Reconciliation Gate

Before Phase 7 Commit 11 continues, complete the independently passing slices
in [`I_BIOME_RECONCILIATION.md`](I_BIOME_RECONCILIATION.md). The reconciliation
restores Story as a second-door generated occurrence, makes `I_Intro` the sole
authored Entrance, persists one explicit bounded `3..6` simulated roll, and
closes the resulting simulation, candidate, persistence, and editor seams.

### Commit 11: Linear Spine and Focused Inspector

Deliver:

- the route rail, Linear structure rail, and focused inspector composition for
  F/G/H/I/O/P/Q;
- picked continuations as the visual trunk and unpicked generated targets as
  compact inspectable leaves;
- room, incoming reward, assessment, and finding summaries on every compact
  leaf so visual collapse does not erase simulation-relevant offers;
- coverage frontier, retained unassessed suffix, and exact semantic finding
  focus;
- truthful empty and partial outlines without expected-length or probability
  decoration;
- variant-specific terminal presentation for independent F/G/H/P forks, I's
  generated peer, and O/Q direct terminals.

Gate:

- every authored occurrence and local reward remains reachable through the
  structure rail or inspector;
- visual emphasis on the picked path does not suppress unpicked sibling, bag,
  source, or finding state;
- no persisted panel, row, lane, or graph identity is introduced.

### Linear Focus Progression Reconciliation Gate

Before Commit 12, close the transient Linear focus inconsistency recorded in
[`LINEAR_EDITOR_FOCUS_PROGRESSION_AUDIT.md`](../audits/LINEAR_EDITOR_FOCUS_PROGRESSION_AUDIT.md).
Execute the staged delivery in
[`LINEAR_FOCUS_PROGRESSION_RECONCILIATION.md`](LINEAR_FOCUS_PROGRESSION_RECONCILIATION.md).

Deliver:

- retain `semanticOwnerFocused` as the single transient focus action;
- focus every created authored start occurrence and preserve the originating
  continuation workbench when creating a batch or terminal;
- retain that explicit workbench while later edits publish a new frontier;
- project the current continuation frontier marker only onto its direct
  predecessor entry or decision;
- offer one navigation-only `Move to Next Decision` action beside that
  predecessor's structural actions, sharing the structure frontier's exact
  semantic address;
- retain the frontier's own `Add Next Decision` and declaration-owned terminal
  actions without adding a `Move to Terminal Decision` path;
- cover nearby navigation, accidental completion, focus-only identity, and the
  product-loop path; and
- reconcile the structured-workspace, editor, audit, and progress authorities.

Gate:

- every authored Linear start retains its created occurrence;
- a completed direct predecessor remains selected while its next frontier is
  visible but unselected;
- the nearby action and structure frontier focus the same semantic destination;
- nearby navigation changes no authored state, history, evaluation, candidate
  result, profile payload, or autosave value;
- no new selection subsystem, biome/game-name branch, or terminal-navigation
  path is introduced; and
- the complete repository gate passes.

### Commit 12: Hub Board, Visit Timeline, and Focused Inspector

Deliver:

- N in the same route-rail and inspector shell with an N-specific center region;
- compact fixed-slot board cells with membership, incoming reward, assessment,
  and finding summaries;
- the separate ordered six-visit timeline and parent-local side-room focus;
- fixed Opening/PreHub, Preboss, Hub return, parent restore, and completion
  landmarks;
- coverage and blocked presentation by semantic Hub region rather than rendered
  board position;
- keyboard and interaction fixtures for board membership, visit replacement,
  side-room editing, reward focus, and finding navigation.

Gate:

- N retains fixed slot identity and separate membership versus visit-order
  semantics;
- the shared inspector does not introduce arbitrary room replacement or a
  duplicate exit-count authority;
- every open unvisited slot keeps its real reward leaf visible and editable.

### Commit 13: Frontier, Dialog, Repair, and Presentation Closure

Deliver:

- one shared frontier presentation container with variant-owned actions;
- concrete policies for F/G/P independent forks, H fixed-count fork, I
  generated terminal peer, O/Q direct terminals, and N fixed Hub completion;
- retained-overflow and terminal repair flows that require explicit commands;
- accessible application dialogs replacing browser-native confirmation and
  describing the exact visible deletion scope;
- Radix Dialog integrated through explicit application-owned pending-dialog
  state without placing destructive scope in the component primitive;
- a dedicated retained-exit repair surface showing unavailable targets and the
  continuation that must be re-anchored;
- final keyboard, accessibility, visual hierarchy, spacing, responsive layout,
  and measured interaction/rebuild performance closure;
- complete F/G/H/I/N/O/P/Q browser interaction fixtures.

Do not invent a universal frontier action. Shared labels or components require
at least two consumers with identical semantics.

### Phase Acceptance

- every covered active-biome owner receives truthful contextual support before
  downstream completion is authored;
- every later route biome remains editable but unassessed until its validated
  predecessor prefix exists;
- every room and reward exclusion exposed in ordinary UX has typed game
  evidence and centralized player-facing copy;
- selected invalid topology and leaf state remain visible and require explicit
  replacement or owning structural deletion;
- every frontier family retains its declaration, command, and simulation
  semantics;
- Linear biomes expose the picked continuation, generated leaves, coverage, and
  terminals through a structured rail and focused inspector;
- N exposes its Hub board and visit timeline through the same focus language
  without acquiring Linear structure;
- empty and partial workspaces show only truthful declared or projected facts;
- no room, reward, bag, force, terminal, completion, or blocking rule exists
  only in React;
- representative interaction fixtures cover all eight biomes;
- the full repository test suite, production build, accessibility checks, and
  measured responsiveness pass.

## Phase 8: Desktop Shell

Add Tauri after the browser application proves the complete cross-biome
simulation and shared UX architecture.

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

## Phase 9: Simulation Conformance and Game Protocol

Begin only after the readiness gate in `../design/GAME_INTEGRATION_BOUNDARY.md` passes.

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

## Phase 10: Hardening

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
- runtime execution compilation until Phase 9.
