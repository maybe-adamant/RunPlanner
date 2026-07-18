# Implementation Progress

## Purpose

This file records factual delivery status against `IMPLEMENTATION_PLAN.md`. It
is mutable project history, not a design authority.

## Current Frontier

Phase 0 is complete. Phase 1, the focused F/G catalog foundation, is in
progress.

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

## In Progress

### Phase 1: F/G Catalog Foundation

Four migration slices delivered, completing the F declaration surface:

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
- focused success and contract-failure tests at reward, shop, room-reference,
  and layout contacts;
- application summary wired to the production catalog slice.

Still required before Phase 1 closes:

- complete G room declarations;
- G encounter profiles and layout declaration;
- exact G requirement coverage and declaration parity fixtures;
- the requirement evaluator registry needed by the focused F/G rules.
