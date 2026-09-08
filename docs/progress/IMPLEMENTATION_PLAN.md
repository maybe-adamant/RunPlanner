# Implementation Roadmap

## Purpose

This is the durable forward roadmap for Run Planner. Completed delivery history
belongs in [`IMPLEMENTATION_PROGRESS.md`](IMPLEMENTATION_PROGRESS.md); stable
game facts and architectural decisions belong in the catalog, biome, design,
and audit authorities. A focused active delivery plan may temporarily refine a
roadmap item but is removed at closure.

## Current Product Boundary

The browser and desktop application support all eight fixed-route biomes
through the catalog, strict authored schema 78, catalog
`0.55.0-anvil-of-fates`, simulation, validation, contextual authoring,
persistence, and recovery. Each project owns one Underworld or Surface route.

Execution protocol 33 publishes complete-valid configured prefixes for both
fixed routes, through `F/G/H/I` and `N/O/P/Q`. The F/G boundary has focused
live-game proof; complete Underworld and Surface live campaigns remain to be
run. The planner remains the sole simulator and semantic authority; the game
module is a strict native adapter, not a second planner.

## Active Execution Frontier

The fixed-route execution structure is complete. The next work is validation
and then the distinct Dream Dive route model, without rebuilding the
already-closed universal acquisition, trait, keepsake, encounter, commerce,
resource, and conformance layers.

The intended order is:

1. complete Underworld (`F/G/H/I`) live proof;
2. complete Surface (`N/O/P/Q`) live proof; and
3. implement Dream Dives only after route ordering and its Postboss and phase
   differences have a dedicated source audit and authored-route product.

Each biome slice starts from its durable biome authority and the shared
execution boundary. It adds only the topology, room structure, native
navigation contacts, and conformance required by that biome. A newly discovered
generic semantic effect returns to its owning universal audit rather than being
hidden in biome code.

## Later Hardening

After both fixed routes have live execution proof, separately measured work may
cover release packaging, accessibility, performance, corruption recovery, and
Dream Dive portability. None of those topics authorizes speculative runtime
infrastructure or a second simulation layer.

## Durable Ownership Rules

- Hades II declarations and source-backed facts live in
  `packages/hades2-catalog` and `docs/audits/`.
- Authored state, codecs, semantic commands, materialization, simulation,
  candidates, findings, and lifecycle semantics live in
  `packages/planner-engine` and their design authorities.
- Composition, persistence adapters, Redux coordination, projections,
  interaction binding, and React presentation live in `apps/planner`.
- Persisted occurrence IDs identify authored instances; game room names identify
  catalog declarations.
- The engine models supported possibility, not probability.
- Incomplete and context-invalid authored state remains visible and repairable;
  only the suffix beyond the first incomplete chronological owner is locked.
- A refactor moves one complete responsibility with explicit inputs and returned
  products; line count alone is not an acceptance criterion.

## Maintenance Frontier

The catalog compiler, planner projection and presentation, engine trait and
reward logic, persistence codec, biome generation, and progressive-evaluation
families already have explicit semantic owners. Reward evaluation deliberately
retains one exhaustive event chronology: its focused event families return
complete transition products while that chronology alone advances branches,
applies emissions, and publishes the final result.

No source family is pre-authorized for another maintainability split. A future
change begins with a responsibility audit that identifies a complete product,
its consumers, primary tests, expected deletion, and any ordered invariant it
must preserve.

## Out of Scope

The roadmap does not authorize a second simulator, runtime effect registry,
generic context or service container, compatibility decoder, React-owned domain
policy, probabilistic simulation, or mechanical splitting of readable
declaration data. Those require their own authority and acceptance decision.
