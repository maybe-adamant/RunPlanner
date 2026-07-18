# Implementation Progress

## Purpose

This file records factual delivery status against `IMPLEMENTATION_PLAN.md`. It
is mutable project history, not a design authority.

## Current Frontier

Phases 0 and 1 are complete. Phase 2 is in progress, beginning with the
versioned authored-project persistence boundary.

Before Phase 1 implementation, the inherited unique-room simplification was
removed from the app design. Room Declarations remain unique by game name;
authored Room Occurrences receive stable persisted occurrence IDs and may
reference the same declaration more than once. The exact I repeated-preboss
offer representation remains deferred to the I implementation slice.

The concrete Phase 1 documentation foundation now includes the reward model,
F/G game rules, F/G room-template contracts, and a migration provenance
ledger. F/G forked preboss exits are modeled as distinct terminal offer
occurrences rather than one singleton room instance with an entry-mode field.

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
- browser-development instructions in `README.md`.

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

## Next

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

The next slice adds terminal transition commands, explicit destructive and
exit-reconciliation commands, and then the authored undo/redo wrapper.
