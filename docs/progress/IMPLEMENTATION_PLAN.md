# Implementation Roadmap

## Purpose

This is the durable forward roadmap for the standalone Run Planner. It records
the next product boundary and the acceptance shape for work that has not yet
landed. Completed delivery history belongs in
[`IMPLEMENTATION_PROGRESS.md`](IMPLEMENTATION_PROGRESS.md), while game facts
and modeling decisions belong in the catalog, design, biome, and audit
authorities.

The original greenfield phases are complete. Their durable outcomes remain in
the owning authorities and the progress record; this document does not repeat
their implementation checklists or commit chronology.

## Current Product Boundary

The browser application supports the eight route biomes through the catalog,
authored project, simulation, candidates, findings, structured workspace,
profile persistence, and recovery loop. The current persisted contract is
strict authored schema 59 with catalog `0.41.0-stygian-well`. The Phase 8
permission-minimal Tauri preview is also complete.

The game module remains a later declarative consumer and runtime auditor. It
does not own a second planner or simulator.

## Forward Phase 9: Simulation Conformance and Game Protocol

Begin only after the readiness conditions in
[`GAME_INTEGRATION_BOUNDARY.md`](../design/GAME_INTEGRATION_BOUNDARY.md) are
met. This phase establishes the application-to-game contract; it does not
move simulation into the game module.

### Deliverables

- representative manual or instrumented traces from complete authored plans;
- a durable mismatch record distinguishing app, game, and probe evidence;
- corrections to the app where the mismatch is an app-model defect;
- an execution-plan JSON schema derived from observed runtime needs;
- a compiler from a complete valid simulation to that schema;
- a game-module importer and runtime auditor in its owning repository; and
- iterative conformance fixtures with structured mismatch reports.

### Acceptance

- the readiness gate names the complete authored/simulated product being
  exported;
- every emitted execution-plan field has one catalog, authored, simulation,
  or compiler owner;
- the game module consumes declarative output and reports observations rather
  than reconstructing planner policy; and
- representative traces cover both ordinary route progression and the
  supported detour/room-feature lifecycles.

## Forward Phase 10: Hardening

Phase 10 follows a measured Phase 9 protocol and is not a license to add
speculative infrastructure.

### Candidate work

- project-schema migrations and explicit recovery/corruption UX;
- broad performance profiling, with worker offload only if measurements show
  simulation latency requires it;
- release-process hardening and any separately justified installer/updater
  work;
- a complete accessibility audit; and
- reconciliation and retirement of superseded temporary migration notes.

The frozen ImGui editor in the game module may be removed only after the
execution-plan boundary proves it is no longer needed. No Phase 10 item is
implied by the current browser or Tauri implementation.

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
- Incomplete and context-invalid authored state remains visible and repairable.
- A refactor must move one complete responsibility with explicit inputs and
  returned products; line count alone is not an acceptance criterion.

## Maintenance Frontier After Plan 2

The 2026-08-26 responsibility and chronology review completed the remaining
audit-proven catalog compiler and engine evaluation seams. Catalog construction
now separates local declaration normalization from frozen collection closure;
engine materialization separates complete batches from progressive traversal;
and project evaluation composes a biome product, exact private artifacts, and
route orchestration without changing the supported simulation surface.

Reward evaluation retains one exhaustive event chronology. Its focused event
families receive explicit current facts and return complete transition products;
the chronology alone advances branches, applies emissions, and publishes the
final result. History folding, lifecycle execution, room-template
materialization, topology commands, readable declaration data, and the
planner's coherent application vocabulary remain intact because their ordered
or exhaustive authority was not divisible into a smaller complete product.

No source family is now pre-authorized for another maintainability split. A
future change must begin with a fresh responsibility audit that identifies a
complete product, its consumers, primary tests, expected deletion, and any
ordered invariant it must preserve.

## Out of Scope for the Roadmap

The roadmap does not authorize a second simulator, runtime effect registry,
generic context/service container, compatibility decoder, React-owned domain
policy, probabilistic simulation, or mechanical splitting of readable
declaration data. Those require their own authority and acceptance decision.
