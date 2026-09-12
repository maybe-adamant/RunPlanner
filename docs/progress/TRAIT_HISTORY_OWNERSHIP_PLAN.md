# Trait history ownership cleanup

## Status and objective

Status: locked; independent pre-implementation challenge passed with the
export and leaf-import constraints below incorporated.
Production base: `eb963360`.
Evidence: `docs/investigations/TRAIT_HISTORY_OWNERSHIP.md`.

Separate event production from trait-history folding while preserving every
authored, simulation, candidate and execution result. This is engine-only
ownership cleanup with no user-visible behavior change.

## Authorities and exclusions

Read `SIMULATION_AND_VALIDATION.md` / Ordered State-Flow Ownership,
`ARCHITECTURE.md` / Code Placement, Product Construction and Reorganization
Contract, and `CANDIDATE_EVALUATION_MODEL.md` / exact captured candidate
contexts, all under `docs/design/`.

No game-data change or simplification is proposed. Catalog declarations remain
inputs; trait history owns the equipment/event ledger; lifecycle callers own
when checkpoints happen; candidates assess captured frontiers. Application,
React and execution serialization contracts do not change.

Exclude scheduler redesign, incremental reduction, caches, new event registries,
per-event callback extraction, stricter malformed-event validation, changes to
source identity or timing, and trait settlement/draft redesign. No schema,
protocol, catalog or generated-fixture updates are expected. No app logic moves.

## Locked shape to challenge

Replace `simulation/traits/history.ts` with four concrete owners in
`simulation/traits/history/`; no new barrel or forwarding file:

- `model.ts`: existing event union and event/state contracts, replacement and
  targeted-transition assessment contracts. Type-only dependencies. Result
  contracts used only by event-producing operations live with those operations.
- `upgrades.ts`: `isLevelBearingTrait`, `isPomEligibleTrait`,
  `hasEffectiveInRunUpgrade`, `isPomUpgradeTarget`, `nextRarity`. Explicit
  declaration/equipped-trait inputs; no fold or effect imports.
- `fold.ts`: `createTraitHistoryState`, `foldTraitHistoryEvents`, their constants
  and private derivation/promotion helpers, `ordinaryEquippedSlots`,
  `traitDerivedFacts`, `attachTraitHistory`, `isTraitOfferMutationEvent`.
- `transitions.ts`: `assessRansom`, `advanceChaosClock`,
  `assessSteadyGrowthTarget`, `settleSteadyGrowthThreshold`,
  `settleFountainRarityMutation`, `advanceSteadyGrowthProgress`,
  `advancePickupProducerProgress`, and their result/threshold contracts.

Move Steady Growth artifact/capability contracts and both factories into the
existing `simulation/candidates/steady-growth.ts`, beside its query consumer.
The query keeps its current evidence aggregation. It imports transition policy;
the history neighborhood must not import candidate implementations.

Dependency direction: transitions → fold → upgrades; model is a type dependency
below them. Keep `withRarityAndSteadyGrowthCredit`, `activeRarityFloorSources`,
`promoteActiveFloorTargets`, `deriveFacts`, and `combinedElementFacts` private
to the fold. Do not reuse `level-effects.ts` for lower-level predicates because
it already imports and calls the fold.

Update all direct source/test consumers to the exact owner, including
`traits/level-effects.ts`, `offers.ts`, authoring assessment/drafts, keepsakes,
reward lifecycle transitions, chronology and publication. Preserve the
supported package vocabulary through deliberate `traits/index.ts`,
`candidates/index.ts`, and `simulation/index.ts` entries. Keep candidate factory
exports on their candidate surface rather than making traits re-export the
candidate implementation and introducing a back-edge. Inspect actual public
exports before movement; retain supported names without exposing formerly
private helpers. No broad unrelated import cleanup.

Specifically, `candidates/index.ts` exports both Steady Growth factories and
their artifact/capability types; `traits/index.ts` no longer exports them.
Do not add them to package-level `simulation/index.ts`, which does not currently
export those factories. Chronology, candidate-artifacts, progressive products,
publication and direct tests import that candidate leaf. Its history dependencies
are the transition assessor and type contracts, never a trait barrel. The
`TraitAssessmentFinding` reference in the history model remains type-only;
`offer-domain.ts` consumes the fold's slot view and cannot become its dependency.

## Preservation requirements

1. Preserve original function bodies, event discriminants, fields and signatures
   wherever possible; explain any difference beyond imports/type paths.
2. Stable sequence sort and original within-sequence order remain unchanged.
   Derivation, floor activation and promotion stay after each complete group.
3. Preserve Bridal Glow/Proper ordering, rarity-change Steady Growth credit and
   self-reset behavior, Chaos Creation additions/removals, replacement levels,
   and prior picked/banned history after removals.
4. Event producers retain their current no-op identities, event append/refold
   counts and full returned products. No hidden shared accumulator or registry.
5. Preserve threshold `before` histories, exact target lists, acquisition
   identities, `deferMaturity`, and downstream placement ownership. Do not
   derive candidates from post-mutation state.
6. Candidate factory still privately copies the supplied map and exposes the
   same address-bound capability. Do not change its threshold exposure,
   empty-domain behavior, branch agreement, or lookup semantics.
7. Keep the fold's existing invalid-event attestation/skip behavior. A cleanup
   must not introduce new findings or exceptions.

## Delivery

One complete implementation gate is sufficient: migrate contracts, fold,
operations, candidate factory, exports and consumers together. Splitting this
into interface-only or forwarding stages would create unnecessary intermediate
coupling. Commit the challenged locked plan and investigation before code.

One Terra-high executor owns source/tests; main owns documentation, Git,
contract decisions, independent review, and closure. Provide the executor this
focused packet and function inventory, not broad repository rereads. Reuse for
one bounded remediation pass. A fresh independent reviewer checks the stable
whole diff before closure. No code commit until the whole boundary is coherent.

## Verification and retirement

Primary existing engine suites under `test/simulation/`:
`trait-history.test.ts`, `trait-level-effects.test.ts`,
`run-impacting-trait-candidates.test.ts`, `chaos-traits.test.ts`,
`fountain-rarity-candidate.test.ts`, `pom-level-resolution.test.ts`,
`trait-offer-levels.test.ts`. Existing runtime-import architecture tests own
runtime dependency checks. Find their current paths instead of duplicating them.
The current contact is `apps/planner/test/architecture/engineRuntimeImportGraph.test.ts`.

Keep all existing test bodies and authority matrices. Change imports when
needed; add a behavioral witness only for a concrete uncovered boundary, not
to prove a filename or deleted implementation no longer exists. No fixture
regeneration or local watchdog overrides. Run assigned suites through shared
correctness, explicit engine TypeScript, touched lint/format and diff checks.

Main performs a one-off original/new function-body and export comparison;
review checks runtime direction, no-op identity, event ordering and complete
products. Then run one full `npm run check` and explicit performance comparison
against `eb963360`. Do not globally set the performance base override for the
comparison unit tests. Record actual outcomes, not test-count targets.

At closure, promote the minimal durable ownership note into the existing
simulation design authority. Delete this plan and its investigation, record
verification in the closure commit, and leave other plans untouched.
