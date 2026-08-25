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

## Maintenance Frontier After Plan 1

The 2026-08-25 repository-gravity review and Plan 1 decomposition completed the
catalog compiler, planner presentation/projection, engine trait/reward,
persistence decoder, generation, and progressive-product slices. Their former
entry monoliths now compose named complete products, and their policy matrices
live with those owners. Large room and trait declarations remain readable
source-backed facts, while the structured-workspace contract remains the
explicit application vocabulary; neither is a target solely because of length.

The remaining source gravity needs a fresh responsibility and chronology audit
before any Plan 2 is locked:

- engine chronological coordinators: `simulation/rewards/biome.ts`,
  `simulation/project.ts`, `simulation/materialization/biome.ts`,
  `simulation/materialization/rooms.ts`, `simulation/lifecycle/execute.ts`, and
  `simulation/history/fold.ts`, whose order, hidden state, and consumer handoffs
  must be mapped together;
- the atomic topology command dispatcher, which stays intact unless an audit
  proves a complete transition product without distributing its invariants;
- catalog room/layout declaration-language compilers, which require a
  compiler-specific audit distinct from their large declaration inputs; and
- coherent planner vocabulary/composition modules such as the structured
  workspace contract, decision assembly, occurrence reward assembly, source
  index, and occurrence interaction binding, which remain deliberately intact
  unless a smaller supported product is demonstrated.

A later maintenance plan should select only audit-proven seams, map consumers
and primary test ownership, and name expected deletions before implementation.
Plan 1 does not pre-authorize those changes.

## Out of Scope for the Roadmap

The roadmap does not authorize a second simulator, runtime effect registry,
generic context/service container, compatibility decoder, React-owned domain
policy, probabilistic simulation, or mechanical splitting of readable
declaration data. Those require their own authority and acceptance decision.
