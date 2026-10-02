# Chronology walk state and seam table

Status: locked 2026-10-02 on `main` at `085a86be`. Behaviour-preserving
refactor of the two largest orchestrator closures. The last major change
before maintenance mode.

## Objective

`evaluateBiomeRewardChronology` (`simulation/rewards/biome/chronology.ts`,
~2111 lines in one function) and the trait-settlement coordinator
(`applyTraitOfferForAcquisitionInternal`, ~612 lines; `settleEncounterTraitOffer`,
~270) hold their walk state as closure locals and dispatch every seam inline.
The lifecycle-transition modules already own the per-seam logic; what remains
inline is state plumbing between them plus three bodies that never got a
module. Replace closure locals with an explicit walk state, make the seam
sequence a table of handlers, and return findings from settlement instead of
mutating a shared map. No product changes.

## Non-negotiable rules

- Behaviour-preserving only. Every commit must reproduce the Gate 0 digest
  exactly. A defect found during extraction is characterized and fixed in a
  separate commit after the refactor, never inside it.
- Code-versus-documentation mismatches are recorded, not repaired (see
  "Recorded mismatches").
- Exported module signatures stay fixed for the lifecycle-transition modules
  that tests import directly, `applyTraitOfferForAcquisition`, and the
  positional `settleEncounterTraitOffer`. A transition whose deliverable moves a
  seam into it may change its signature: A2 (`room-prepared`, no importers) and
  A4 (`fountain-used`, which now requires the authored `room`).
- No per-event copying of biome accumulators: the walk is O(events).

## Gate 0 — equivalence lane (permanent)

Opt-in lane `npm run test:equivalence`, excluded from the correctness lane.
For every project below it hashes the full `simulateProject` JSON, the encoded
execution plan where assemblable, and a candidate probe (evaluate candidates
for every published finding owner and every trait-offer owner through
`createPreparedProjectCandidateSession`, hash the outcomes; JSON misses Maps
and closures). Baseline hashes are committed and must match on every later
commit of this plan.

Corpus: all execution-fixture builders; all checkpoint registry entries; the
golden builders in `test/fixtures/authored-project/routes/underworld.ts`; the
Fresh File builders in `routes/fresh-file.ts` including `authorFreshFileFrontier`.
Performance witness at closure: `npm run test:performance:compare`
(rebuild about 90 ms; threshold +20% / 100 ms).

## Shape

- `ChronologyWalkState`, frozen between steps, holds only the small fields:
  branches and halt; batch state (`peers`, `pendingHubBoard`,
  `targetGenerationByParent`, `expectedStores`); per-room keyed scratch
  (Shrine, Well and Pool assessments, the Shrine refill trio, Well refill
  realizations, Ship lifecycle contexts, Gorgon eligibility and block state).
- `ChronologyAccumulator` is one explicit stage-local builder for the biome
  accumulators (findings with their write rule, producer frontiers, trait
  contacts, conversion contexts, derived entries, timeline nodes, run-state
  snapshots, trait-child builders, Hub departures, Echo outcome), frozen once
  at publication.
- Handlers `(context, state, event) → { state, emissions }` in documentation
  seam order; one `mergeEmissions` replaces the `record*` closures and keeps
  the nested call order (role frontiers → trait contacts → producer; derived
  entries → role frontiers) and each finding's write rule (merge, set in place,
  merge emissions).
- Thin adapters in the seam table call the unchanged transition modules.

## Delivery, one seam per commit, lowest coupling first

A1 Echo keepsake replay prelude → biome-start transition.
A2 Fields optional-count findings → `room-prepared`.
A3 Remove the duplicated `offerPointAcquired` / `producerRoleAdvanced` body.
A4 Purging Pool assessment → `fountain-used`.
A5 `ChronologyAccumulator` + `mergeEmissions` (keystone).
A6 Adapters: Eris, keepsake rack, room exited, encounter end effects (halt),
Well purchase.
A7 Acquisition point and Shrine deliveries, refill trio and Pool state explicit.
A8 Encounter group: started and settlement with shared Gorgon state.
A9 Generation group: outgoing, room created, target generation completed,
Hub flush as batch state.
A10 Run-state capture with the trait-child snapshot registry.
A11 Finalization: Hub frontier capture, boss door, blank frontier, publication,
order unchanged.
B1 Trait settlement returns findings as a product (per-call tuples merged in
original order; Circe drop-on-reject; blocked-child precedence kept).
B2 Phase functions for the internal apply path.
B3 Per-disposition encounter settlement replacing the IIFE and outer lets.
B4 Remove dead `findings !== undefined` guards.

Fresh independent review after A5, after A11 and after B3; one bounded
remediation each. Full gate and performance compare at closure.

## Recorded mismatches (document at closure, do not repair here)

1. The boss-door store is evaluated after the history loop, so its findings
   are published last; its comment says "at that room's exit boundary".
2. The switch order is unrelated to the seam-table order (dispatch is by
   kind; no effect).
3. One settlement handler covers two seams: encounter completed and the
   cleanup-window encounter Room Actions.
4. `biomeStarted` is not dispatched; the Echo replay runs as an inline prelude
   at the biome start sequence.
5. Room committed has no reward handler; Fountain, Rack, Eris, Well and Shrine
   deliveries are Room Actions with no seam-table row.
6. Hub departure is a second dispatch outside the switch.
7. `offerPointAcquired` and `producerRoleAdvanced` have identical bodies.
8. Hoisted `recordAcquisitionRoleFrontiers` uses locals declared later; it
   works only because of call order.
9. Trait settlement's level-resolution path settles from the opened branch,
   ignoring a Calling Card spend that every other path keeps (`effectiveBranch`).
10. A selected offer's settled branch takes reward history from the opened
    branch but keepsakes from the effective branch.

## Bounded unknown

No corpus project attaches a Run State snapshot to a trait-child settlement:
every child-producing step empties the walk, and no outgoing site settlement
emits a child before its capture. The order is pinned by a unit witness of
the seam step; whether attachment is reachable at all is a separate follow-up
before closure.

## Closure

Promote the seam table to `docs/design/ROOM_LIFECYCLE_MODEL.md` as the
authority (add the missing Room Action rows, state the boss-door position),
keep `test:equivalence` as a maintenance lane, record the gate result in the
commit, delete this plan.
