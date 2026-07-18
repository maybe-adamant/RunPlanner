# Implementation Progress

## Purpose

This file records factual delivery status against `IMPLEMENTATION_PLAN.md`. It
is mutable project history, not a design authority.

## Current Frontier

Phases 0 and 1 are complete. The next frontier is Phase 2: the versioned
authored project, codecs, semantic addresses, and edit commands.

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

Start with the versioned `ProjectDocument` codec and stable repeatable Room
Occurrence identity. Then add recursive leaf defaults, semantic addresses, and
topology/leaf commands against exact JSON round-trip fixtures.
