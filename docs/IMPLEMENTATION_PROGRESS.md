# Implementation Progress

## Purpose

This file records factual delivery status against `IMPLEMENTATION_PLAN.md`. It
is mutable project history, not a design authority.

## Current Frontier

Phases 0, 1, 2, 2.5, 2.6, and 2.7 are complete. Phases 0 through 2.5 were
completed under the prior reward-store ownership model; Phase 2.6 added the
audited reward kernel as an intentionally unconnected pure subsystem; Phase
2.7 atomically made it the sole connected F/G reward authority under schema
version 2. Phase 2.8 is the current frontier and imports P/Q/H/O/I/N as dormant
declaration sets before Phase 3 begins.

The Phase 3 timing foundation is documented in `ROOM_LIFECYCLE_MODEL.md`. It
defines reusable single-room lifecycle profiles, occurrence-addressed history
fragments, typed declaration-driven effects, exact counter/cache timing, and
outgoing-generation checkpoints. This is design authority only; no Phase 3
lifecycle executor or route-history composition is implemented yet.

Possibility-only simulation and the reward-authority shape are locked by the
complete audit set. O added the source-offer-point batch-store form without
moving store ownership back to reward leaves; I confirms that a `none` batch
can still resolve every counted target through a declaration-owned forced-
store override; N confirms the same shape for one heterogeneous persistent hub
board.

Before Phase 1 implementation, the inherited unique-room simplification was
removed from the app design. Room Declarations remain unique by game name;
authored Room Occurrences receive stable persisted occurrence IDs and may
reference the same declaration more than once. I now proves the consequence:
each repeated preboss offer is an ordinary target occurrence in its real
generated batch.

The concrete Phase 1 documentation foundation now includes the shared game-
generation rules, separate F and G game-rule authorities, F/G room-template
contracts, and a migration provenance ledger. F/G forked preboss exits are
modeled as distinct terminal offer occurrences rather than one singleton room
instance with an entry-mode field.

The cross-biome audits establish P, Q, H, O, I, and N as dormant declaration
targets.
`biomes/P_GAME_RULES.md` records its typed source-sensitive exits, reward-free
empty-intro simplification, intentionally collapsed counting combat projection,
miniboss encounter-depth asymmetry, forked preboss, and persistent-NPC
composition boundary. The F, G, P, Q, H, O, I, and N rule documents now
distinguish verified game behavior, modeling disposition, canonical
projection, reconsideration trigger, and current feature coverage. Production
P, Q, H, O, I, and N declarations have not yet been imported.

`biomes/Q_GAME_RULES.md` records Q's declaration-driven scripted stages, real foyer
variants, independently generated and repeatable miniboss peers, reward-free
combat spine, Typhon miniboss store, direct Summit shop, Eye/Tail encounter-
depth asymmetry, and boss-level repeat-run completion. It excludes the Palace
postboss/story path as narrative progression and proves that reward-free
generated batches must not author a meaningless base store.

`biomes/H_GAME_RULES.md` records H's four-room count-driven spine, exact physical
exits, bridge forced-pool competition, batch-owned semantic Min/Max cage
outcome, hidden two-Max ceiling updates, room-owned local cage slots, and
two-or-three counting encounters per entered combat. Its generated batch uses
`none` because every supported target is reward-free or resolves
declaration-owned RunProgress provenance. It defers
`FieldsOptionalRewards` under a canonical no-pickup trace and narrowly omits
the terminal-only cage roll because H has no downstream consumer for it.

`biomes/O_GAME_RULES.md` records O's six-room single-exit spine, ordered Intro plus
one/two counting ShipCombat phases, phase-owned one/two-option wheels,
source-derived outgoing store, three combat eligibility families, special-room
BED asymmetry, and direct shop-only preboss. It corrects the legacy assumption
that early O combat requirements compose with the inherited recent-room rule.

`biomes/I_GAME_RULES.md` records the fixed progressed-save Story entry, five
acquisition-driven Clockwork Goals, authored three-through-six non-goal cap,
fixed Tartarus target-store override, exact two-exit reserve, and supported
special peers. It replaces the old terminal-plus-companion workaround with one
conditional-terminal `ClockworkDoorBatch`: picking `I_PreBoss02` completes the
biome, while picking its ordinary peer continues and permits a later preboss
occurrence.

`biomes/N_GAME_RULES.md` records fixed authored Opening, PreHub, and preboss leaves;
one nine-or-ten-target persistent hub offer board over catalog-fixed slots; six
ordered pylon visits; bounded generated and entered side-room state; parent and
hub restores; and the full-board reward lookup consumed by the terminal
WorldShop. `biomes/N_SIDE_ROOM_FINDINGS.md` closes exact local availability
ranks for all multi-side-door maps. Local rewards validate as one unordered
sibling batch. Eventual hub execution order remains a targeted conformance
probe rather than unresolved schema work.

The completed G audit additionally locks Anomaly replacement beside natural
Chaos as a suppressed route-structural detour, keeps Narcissus's internal
benefit choice deferred to future concrete NPC/trait resolution, and names the
progressed-save exclusions for `FishmanIntro`, early-run Eris, and prior-run
Narcissus force. It also replaces a hidden simulator-appended biome tail with
the forward contract for concrete derived boss/postboss Room Declarations,
ordered layout completion, and explicit entered-room reward-store history.
Those schema and declaration changes remain pending.

The P audit is now closed under the same derived-tail contract:
`P_Boss01 -> P_PostBoss01 -> Q_Intro`, neutral `BossPrometheus01`, resolved
boss-offer store history, and no modeled automatic boss-drop surface. F, G, P,
Q, H, O, I, and N are closed as biome-rule/design audits; this does not promote
them beyond documentation coverage or mark any derived completion declaration
implemented.

## Completed

### Phase 0: Repository and Tooling Foundation

Delivered:

- standalone Git repository;
- npm workspace and lockfile;
- Linux Node activation through `.nvmrc`;
- shared strict TypeScript configuration;
- pure `@run-planner/core` package;
- explicit `@run-planner/catalog` construction boundary;
- React/Vite planner application;
- Redux Toolkit editor-session store;
- application composition root joining catalog, core, store, and UI;
- Vitest package and app-render smoke tests;
- ESLint dependency-boundary rules;
- Prettier configuration;
- production build and aggregate `npm run check` script;
- browser-development instructions in `../README.md`.

Validation at completion:

- workspace type checking passed;
- 3 test files and 4 tests passed;
- ESLint passed with zero warnings;
- Prettier check passed;
- Vite production build passed.

No F/G declarations, Tauri dependency, graph library, project model, or
simulator behavior was introduced during this phase.

### Phase 1: F/G Catalog Foundation

Six migration slices delivered, completing the F/G catalog foundation:

- normalized core catalog, reward, room, encounter, and current-run
  requirement contracts;
- path-bearing catalog contract errors;
- explicit Underworld and Surface route declarations;
- `BoonSource` and `DevotionPair` payload domains;
- explicit primitives required by `RunProgress`, `MetaProgress`, and the first F
  rooms;
- `RunProgress` in game declaration order with exact multiplicity;
- `MetaProgress` in current game declaration order with exact multiplicity;
- current-run portions of RunProgress and MetaProgress entry requirements,
  with external save/profile gates omitted by the catalog scope policy;
- `F_Opening`, standard combat, F miniboss, story, reprieve, shop, and preboss
  encounter profiles;
- normalized `F_Opening01..03`, all 22 explicit F combat declarations, all
  three F minibosses, Arachne, Fountain, Midshop, and Preboss;
- normalized multi-store reward bindings with explicit default-store
  selection;
- fixed and shop reward-producer bindings;
- the ordinary `WorldShop` option sets and three stable offer slots, including
  recursive concrete defaults;
- the forked F preboss declaration, with WorldShop as the first offer and at
  most one filtered free-reward offer;
- the `Underworld_F` `LinearBiome` layout, its three opening alternatives,
  ordinary continuation rule, depth-10 terminal, and authored bounds;
- explicit F miniboss mutual exclusion through current-run entered-room
  history, plus the F miniboss and shop force windows;
- executable parity coverage for every F combat room's physical exits,
  encounter-depth range, reward binding, counters, and appearance cap;
- executable parity coverage for every remaining F room family, WorldShop,
  and the F layout;
- a `none` reward producer and fixed-start layout mode for reward-free biome
  intros;
- normalized `G_Intro`, all 20 explicit G combat declarations, all three G
  minibosses, Narcissus, Fountain, Midshop, and Preboss;
- exact G two/three-exit topology, including the one-exit Crawler room and its
  non-counting encounter profile;
- explicit G combat depth ranges, the four Devotion exclusions, miniboss
  mutual exclusion, and independent Midshop eligibility/force windows;
- the forked G preboss declaration, with WorldShop as the first offer and at
  most two filtered free-reward offers;
- the `Underworld_G` `LinearBiome` layout, fixed reward-free intro, ordinary
  continuation rule, depth-8 terminal, and authored bounds;
- executable parity coverage for every G room family, encounter identity,
  physical exit, reward binding, and layout fact;
- focused success and contract-failure tests at reward, shop, room-reference,
  and layout contacts;
- application summary wired to the production catalog slice;
- a pure typed evaluation context that keeps counter, history, shop-option,
  current-reward, exit, spacing, and flag inputs distinct;
- an exhaustive current-run evaluator registry covering every normalized
  requirement kind used by F/G;
- exact inclusive range, summed-record, recursive boolean, shop-option,
  current-reward, exit, flag, and event-spacing behavior fixtures;
- catalog contact failure for a runtime requirement kind without an evaluator.

Validation at completion:

- workspace type checking passed;
- the full Vitest suite passed;
- ESLint passed with zero warnings;
- Prettier check passed;
- the Vite production build passed.

### Phase 2: Authored Project and Commands

The initial persistence slice now delivers:

- schema version 1 `ProjectDocument`, route-plan, and incomplete linear-biome
  types;
- an opaque `OccurrenceId` domain type separate from game room names;
- catalog-ordered empty-project defaults;
- configured-route defaults whose biome arrays are the sole contiguous-prefix
  authority;
- explicit `topology: null` for configured but unstarted F/G biomes;
- strict project and JSON decoders with path-bearing contract errors;
- exact catalog-version compatibility and rejection of unknown persisted
  fields;
- deterministic normalized JSON encoding and round-trip fixtures;
- focused failures for route gaps, unknown schema versions, catalog mismatch,
  UI-state leakage, invalid JSON, and configuration beyond registered layouts.

The second authored-model slice now delivers:

- explicit F/G `RoomTemplateKey` typing at the normalized catalog boundary;
- recursive counted-reward defaults from binding store through primitive
  payload;
- complete WorldShop defaults with stable slots and concrete purchase state;
- strict authored payload, counted-choice, fixed, shop, and preboss-free state
  codecs;
- topology-derived F/G preboss Shop/Free realization roles;
- non-null `LinearBiomeTopology`, Room Occurrence, target, batch, and terminal
  contracts;
- canonical picked-spine, physical-target, and occurrence ordering;
- structural rejection of duplicate IDs, dangling or multiply owned
  occurrences, detached downstream continuations, cycles, invalid roles,
  unreferenced dormant leaves, and topology bounds overflow;
- round-trip coverage for two distinct occurrences of the same F combat room.

The third authored-model slice now delivers:

- frozen semantic biome, occurrence, continuation, target, picked, incoming-
  reward, and shop-purchase addresses with canonical keys;
- an immutable command application boundary with address-bearing failures;
- `CreateStart`, `CreateBatch`, `CreateTarget`, and `SetPicked` for an ordinary
  F/G decision path;
- occurrence-preserving room replacement with complete declaration-default
  state replacement;
- downstream continuation re-anchoring when the picked peer changes;
- retained overflow targets and picks after a parent shrinks, while direct
  creation or selection on unavailable exits is rejected;
- counted-reward replacement and concrete shop purchase editing;
- repeated-room, duplicate-ID, invalid-leaf, immutable-source, re-anchoring,
  overflow, and recursive-default fixtures.

The final Phase 2 slices now deliver:

- terminal transition construction from predecessor generated exits with
  derived Shop/Free occurrence roles;
- terminal selection and complete shop offer plus purchase editing;
- explicit ordinary and terminal exit reconciliation;
- batch and terminal removal, continuation-form replacement, owned-subtree
  deletion, and complete topology clearing;
- capacity restoration before reconciliation without state loss;
- frozen unbounded authored history with exact undo/redo, no-op suppression,
  redo invalidation after new edits, and destructive recovery fixtures.

Phase 2 was completed under the original leaf-owned counted-store
representation. The completed cross-biome audit locked its replacement, and
Phase 2.7 later performed the atomic switch described below.

### Phase 2.5: Authored Editor Smoke

The first application-state slice now delivers:

- an explicit F-configured smoke-project bootstrap with unstarted topology;
- application composition of the normalized catalog, initial project, and
  planner store;
- one Redux-owned authored `ProjectHistory` using the pure core history
  boundary;
- semantic project-command dispatch plus undo and redo application actions;
- exact snapshot restoration and semantic no-op coverage at the application
  adapter boundary.

The second shell and F-start slice now delivers:

- horizontal Underworld, Surface, and Settings navigation;
- route-local Underworld navigation for Route and Erebus panels;
- authored project and catalog projection through the application shell;
- application-bound undo and redo controls;
- an explicit unstarted Erebus surface with no implicit opening selection;
- opening creation with application-allocated occurrence identity;
- occurrence-preserving authored opening replacement after topology creation;
- neutral route and frontier placeholders that make no simulation claims.

The final authored F projection slice now delivers:

- declaration-derived two-stage room selectors without persisted UI
  categories or implicit room selection;
- ordinary decision cards with complete physical exits, stable occurrence
  identity, single-choice picked exits, and unpicked dead-leaf editors;
- retained unavailable exits that remain visible and editable after an
  upstream exit-capacity shrink;
- explicit ordinary and terminal reconciliation, subtree removal,
  continuation replacement, and complete-biome clearing actions;
- declaration-bound disabling for impossible target, batch, and terminal
  construction at authored topology limits;
- predecessor-derived F Preboss Shop and Free Reward occurrences with terminal
  single-choice entry;
- complete counted reward-pool, primitive, single-source, and paired-source
  editors using declaration labels;
- complete WorldShop offer, payload, and purchase editors;
- neutral structural language with no eligibility, validity, candidate, or
  finding claims before simulation exists;
- projection fixtures for empty, started, ordinary, terminal, shop, and
  retained-overflow authored states.

Phase 2.5 is complete. The editor now exercises the full Phase 2 F command
surface without editing JSON.

### Phase 2.6: Reward Kernel

Delivered:

- isolated `@run-planner/core/reward-kernel` and
  `@run-planner/catalog/reward-kernel` entry points with no connection to the
  schema-version-1 project or editor;
- normalized payload domains, complete resolved-offer defaults, reward types,
  source-support policies, semantic resolution points, acquisition roles, and
  producer-owned shop acquisition lifecycles;
- strict contact validation for payload/default compatibility, source-policy
  compatibility, role resolution, concrete acquisition references, counted
  store defaults, shop groups, without-replacement capacity, and complete
  acquisition-lifecycle bindings;
- the complete eight-store inventory with declaration order, multiplicity,
  current-run requirements, duplicate policy, immutable bag defaults, retained
  leftovers, one call-local full refill, and deduplicated latent-state
  branching;
- the exact 13-entry fully progressed `MetaProgress` projection;
- policy-dispatched `ordinaryBoonPeer`, `ordinaryNoPeer`, and
  `devotionAcquiredPair` source support with the four-source cap, peer
  exclusion fallback, acquired-source pairs, and delayed Blind Box validation;
- generic resolved-offer history plus exact Devotion offer-time spacing;
- the exhaustive concrete acquisition registry and closed `lootAndUse` and
  `consumableAndUse` projections, including Spell's cross-kind behavior and
  ordinary-source trait-count folding;
- ordered `WorldShop`, `I_WorldShop`, and `Q_WorldShop` declarations with exact
  group support, offer counts, distinct option entries, requirements, and
  recursively complete defaults;
- pure shop generation witnesses, without-replacement assignment, purchased-
  set order branching, state equivalence merging, and retained executable
  purchase-order witnesses;
- behavior-preserving replacement of `notInStore` and
  `currentRoomStoreOptionNames` by `notInCurrentRoomShopOptions` and
  `currentRoomShopOptionNames` at the shared current-run requirement boundary;
- parity and contract fixtures covering every store multiset, duplicate
  position, acquisition identity/profile, shop group, source policy, refill,
  latent bag branch, offer projection, trait-free baseline, and the order-
  sensitive Blind Box case.

At Phase 2.6 completion, the schema-version-1 F/G catalog, project document,
commands, and editor remained the only connected production authority. The
subsequent Phase 2.7 switch replaced that authority without adding a canonical
route-history walker, candidate evaluator, or semantic finding.

Validation at completion:

- workspace type checking passed;
- 13 test files and 95 tests passed;
- ESLint passed with zero warnings;
- Prettier check passed;
- the Vite production build passed;
- `git diff --check` passed.

### Phase 2.7: F/G Reward Authority Switch

Delivered:

- one root catalog reward authority normalized from the audited reward kernel;
- explicit F/G producer lifecycle bindings, forced-store overrides, and
  entered-room store-history policies;
- F/G layout-owned authored base-store policies with RunProgress defaults and
  RunProgress/MetaProgress domains;
- schema version 2 batch reward-store and batch-state persistence;
- resolved-offer-only counted and free-reward leaves with typed payloads;
- entry-materialized shop inventory required only on picked occurrences and
  retained dormantly after another target is picked;
- semantic `BatchRewardStoreAddress` and `ReplaceBatchRewardStore`, retaining
  every target offer and all downstream topology;
- F editor batch Reward Pool projection and schema-version-2 command wiring;
- explicit rejection of schema version 1 without migration scaffolding;
- deletion of the old primitive, `acquiredAs`, flat store, option-set,
  eager-shop, and leaf-owned-store production authorities.

Validation at completion:

- workspace type checking passed;
- 13 test files and 102 tests passed;
- ESLint passed with zero warnings;
- Prettier check passed;
- the Vite production build passed;
- `git diff --check` passed.

## Post-Phase 2.5 Audit Findings

The 2026-07-18 game-data audits locked possibility-only simulation and produced
these cross-biome reward-model findings for continued verification:

- the simulator models outcome support only; every nonzero-probability outcome
  is valid, while impossible and forced boundaries are enforced;
- generated reward-store selection is resolved at the batch boundary, but its
  concrete authority may be an authored batch value or an already-authored
  source offer point rather than a counted room leaf;
- a generated batch authors one `baseRewardStoreKey` only when the observable
  generated-store outcome is not already owned by a source offer point;
  reward-free batches use an explicit no-store policy;
- Room Declarations own forced-store overrides independently of that batch
  policy;
- target leaves author complete resolved offers only, while canonical
  materialization attaches resolved store provenance;
- fixed Story and Shop targets retain resolved store provenance for later
  entered-room ratio history;
- store entries own duplicate policy; the settled store/consumer proof permits
  one complete refill while making the raw second-refill/Heal branch
  unreachable in the planner baseline; ambiguous matching entries branch into
  every distinct reachable latent bag state;
- the Phase 1 `RewardPrimitive.acquiredAs` shape must split into reward types,
  resolved offers, concrete acquisitions, and concrete history projections;
  reward types own typed acquisition roles, while producer and encounter
  lifecycles own their timing rather than a generic alias;
- Devotion owns the only supported reward-type-specific offer projection and
  writes its spacing marker when offered, including on unpicked targets;
- the exhaustive concrete acquisition registry separates acquisition kind from
  the closed `lootAndUse` and `consumableAndUse` history projection profiles;
- same-batch Boon source exclusion and the ordinary source cap belong to
  reward simulation, not editor filtering, with the game's exhaustion fallback
  restoring weaker source support;
- source-bearing rewards select an explicit policy and resolution point:
  ordinary generated Boons use peer-aware offer-time support, shop RandomLoot
  uses no-peer offer-time support, Blind Box uses no-peer acquisition-time
  support, and Devotion selects two distinct already acquired ordinary sources;
- Devotion needs explicit chosen/spurned roles;
- Blind Box persists its intended source while acquisition-time purchase-order
  branches determine whether that source is possible;
- World, I, and Q shops are ordered entry-generated groups with per-option
  requirements and offer counts, not flat option unions;
- MetaProgress must replace the Phase 1 19-entry progression-elided union with
  the exact 13-entry fully progressed projection: early ordinary resources and
  late Big resources only.
- the trait-free reward baseline increments `upgradableTraitCount` per ordinary
  god source, holds `allSpellInvested` false, and keeps `pendingSpellDrop` false
  while Surface Shop delivery remains deferred.

`REWARD_GAME_DATA_AUDIT.md` records the exact, simplified, deferred, and
excluded disposition of the complete reward surface. It also records deferred
affordability, resource, reroll, and trait depth, plus derived purchase-order
branching, so production does not grow placeholder predicates for them.

The N audit confirmed the shared store shape and added fixed authored layout
slots, a fixed-slot persistent hub board, ordered restores, and side-room
generation pressure. Phase 2.7 has now applied the shared schema-version-2
store and picked-entry shop contracts to F/G. The remaining biome structures
stay dormant until Phase 2.8 imports their declarations.

## Next

### Phase 2.8: Cross-Biome Declaration Closure

Current:

1. add declared/authorable/simulatable/editable capability gates;
2. harden shared layout, exit, encounter, requirement, completion, batch, and
   local-slot vocabulary and reconcile F/G to it;
3. import dormant P, Q, H, O, I, and N declarations in the documented
   pressure-test order;
4. run cross-biome parity and capability-isolation gates.

Phase 3 remains blocked until Phase 2.8 passes without placeholder
materializers, dormant biome activation, duplicated authority, or
schema-version-1 compatibility scaffolding.
