# Trait history ownership

## Question and disposition

At `eb963360`, which responsibilities in
`packages/planner-engine/src/simulation/traits/history.ts` should remain one
authority, and which can move without changing chronology or introducing a
second scheduler?

The useful boundary is event production versus event folding. Preserve the
fold and its sequence-group finalization together. Separate its contracts,
reusable upgrade predicates, and operations that construct events and return a
new folded history. Move Steady Growth candidate artifact construction to the
existing candidate family. No game-rule correction is established here.

This is static inspection, not implementation or a new test run. The working
tree was clean; recent repository verification is recorded at `9469bccc`.

## Authorities

- `docs/design/SIMULATION_AND_VALIDATION.md`: Ordered State-Flow Ownership;
  lifecycle and candidate ownership remain unchanged.
- `docs/design/ARCHITECTURE.md`: Code Placement, Product Construction, and
  Reorganization Contract.
- `docs/design/CANDIDATE_EVALUATION_MODEL.md`: exact captured candidate contexts.

Trait history is not the route/room history fold in `simulation/history/`.
Their products have different responsibilities and must not be merged merely
because both fold events.

## Responsibility inventory

All locations below refer to the current `traits/history.ts` unless qualified.

| Responsibility                                            | Current contacts                                                                                                                                  | Proposed disposition                                                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Closed events, transition contracts, equipped-state facts | Lines 14–356                                                                                                                                      | A trait-history contract owner; preserve all fields and discriminants.                                         |
| Shared upgrade predicates                                 | `isLevelBearingTrait`, `isPomEligibleTrait`, `hasEffectiveInRunUpgrade`, `isPomUpgradeTarget`, `nextRarity`                                       | One small lower-level policy owner consumed by folding and effect assessment.                                  |
| History construction and derived views                    | `createTraitHistoryState`, `deriveFacts`, `combinedElementFacts`, `ordinaryEquippedSlots`, `traitDerivedFacts`, `attachTraitHistory`              | Keep with the fold initially; no reason to split every projection.                                             |
| Chronological state machine                               | `foldTraitHistoryEvents`, rarity-floor helpers and Steady Growth credit                                                                           | Preserve together, including mutable local builders.                                                           |
| Event-producing operations                                | `assessRansom`, `advanceChaosClock`, `settleFountainRarityMutation`, Steady Growth advancement/assessment/settlement, pickup-producer advancement | One substantive transition neighborhood above the fold; preserve complete returned histories and due products. |
| Exact Steady Growth candidate artifacts                   | `createSteadyGrowthCandidateArtifacts`, empty factory, capability/artifact types                                                                  | Existing `candidates/steady-growth.ts` is a concrete owning consumer; it already owns the query.               |

Diagnostic baseline: 1,358 lines in one file. The fold body is about 360 lines,
not the entire file. Its surrounding private derivation/promotion logic adds
roughly another 150 lines. The objective is clearer dependencies, not making
the fold small.

## Why the fold should stay intact

`foldTraitHistoryEvents` makes a stable sequence sort, retains insertion order
within each sequence, applies the group's events, then derives elements and
rarity-floor activation. It promotes newly active floor targets only after the
group. A global event-type reorder or per-event promotion would change behavior.

Concrete coupled paths:

- Bridal Glow's targeted promotion precedes same-boundary Proper Upbringing
  credit. Floor activation can also add a level to its earlier target.
- Rarity changes preserve Steady Growth's remaining encounter credit through
  `withRarityAndSteadyGrowthCredit`; self-promotion can explicitly reset it.
- Chaos Creation contributes elements on maturity/direct blessing and removes
  those contributions on direct blessing removal. Elements can activate the
  rarity floor at the same sequence boundary.
- Replacement preserves the removed trait's level unless the recorded effective
  level supplies the result. Acquired/banned history survives trait removal.
- Progress and expiration use acquisition identity where required, so removing
  and reacquiring the same trait does not make stale events target the new one.

These share the fold's equipped ledger and group finalization. Extracting each
event case into callbacks receiving mutable state would distribute the state
machine rather than clarify it. Existing skip/attestation behavior for invalid
events also remains unchanged; this is not a stricter history-validator project.

## Event producers are not another clock owner

`rewards/biome/lifecycle-transitions/encounter-end-effects.ts` determines when
the trait operations run, alongside Well and keepsake transitions. The lower
operations consume one already-qualified checkpoint:

- Steady Growth returns updated history plus exact pre-threshold target
  frontiers. Candidate assessment and selected settlement use that same
  frontier; they must not recompute targets from a later branch.
- Pickup producers return updated history plus maturity records. The caller
  owns the resulting acquisition frontiers and placement. `deferMaturity`
  preserves a reached threshold for the existing Chaos case; moving the
  function must not change this behavior or remove that input.
- Chaos advancement appends the existing clock event and refolds; the callers
  determine which clock applies. It does not schedule a room action itself.
- Ransom returns removals, level mutations, summary facts, and resulting
  history. Fountain mutation returns resulting history and legality.

Hermes delivery, Embryo, Well expiry, and Experimental Hammer remain in their
existing authorities. This investigation does not reopen lifecycle timing,
Supply Chain identity, pending-effect consumption, or scheduler unification.

## Consumers and dependency direction

Assessment, ordinary drafts, offer recording, level effects, keepsake effects,
acquisition settlement and reward publication consume trait-history products.
The broad `traits/index.ts` and supported `simulation/index.ts` exports must
retain their current public vocabulary while direct internal consumers move.

Current specific contacts include:

- `traits/offers.ts`: Ransom, folding, Pom predicate.
- `traits/level-effects.ts`: folding and upgrade predicates for level recording
  and exact target domains.
- `traits/authoring/assessment.ts` and `drafts.ts`: history/transition contracts
  and lower-level predicates/views.
- `rewards/biome/lifecycle-transitions/encounter-end-effects.ts`: advancement,
  thresholds and settlement.
- `rewards/biome/lifecycle-transitions/fountain-used.ts`: fountain mutation.
- `rewards/trait-settlement.ts`: Chaos screen advancement and trait mutation
  classification.
- `rewards/biome/chronology.ts`: creates Steady Growth artifacts from captured
  frontiers; `rewards/biome/publication.ts` consumes the artifact contract.
- `candidates/steady-growth.ts`: exact artifact lookup and query evidence.

The candidate factory copies its input map into a private closure and exposes
`at(address)` plus evaluation. That is an explicit returned capability, not a
hidden result-keyed registry to remove. Preserve its current threshold contract
and branch aggregation behavior; moving it does not authorize API redesign.

Moving upgrade predicates into `level-effects.ts` would introduce a runtime
cycle because that module already calls the fold. A lower-level policy module
avoids this. Likewise, the fold must not import the new event producers or the
candidate factory.

## Bounded candidate shape

A reasonable shape to challenge when writing the plan is a `traits/history/`
neighborhood with four substantive owners:

- `model.ts`: event/state and fold-transition contracts.
- `upgrades.ts`: shared level/rarity advancement predicates.
- `fold.ts`: initial state, ordered fold, private derivation/promotion helpers,
  and history views/attachment.
- `transitions.ts`: event-producing operations and their result contracts.

Candidate artifact construction joins existing `candidates/steady-growth.ts`;
no new candidate service or extra barrel is needed. The intended dependency is
transitions → fold → upgrade predicates, with type contracts below all three.
Keep event-kind classification with the history neighborhood, not in a generic
utility directory. Remove the old mixed file in a complete migration, rather
than leave a compatibility forwarding layer.

This is preferable to either extracting only types (which leaves the mixed
runtime responsibilities) or producing one file per event/trait (which adds
navigation cost and mutable-state plumbing). Final export and consumer details
still need to be pinned before locking a plan.

## Verification and risks

Existing primary witnesses already cover the sensitive behavior:

- `trait-history.test.ts`: Selene equipment, Proper activation/deactivation,
  same-boundary Bridal credit, rarity domains and branch-local replay.
- `trait-level-effects.test.ts`: targeted upgrades and Supply Chain, including
  final Steady Growth branch, O phases and deferred Chaos maturity.
- `run-impacting-trait-candidates.test.ts`: threshold missing-target repair,
  exact owner commands, candidate support and branch evidence.
- `chaos-traits.test.ts`, `fountain-rarity-candidate.test.ts`,
  `pom-level-resolution.test.ts`, and `trait-offer-levels.test.ts`: their owning
  effect/domain contacts.

Use those matrices rather than recreate them for the new filenames. Existing
runtime-import architecture tests and explicit TypeScript protect dependency
direction. A one-off body comparison should establish movement equality;
performance comparison should preserve refold/work shape, not motivate an
incremental reducer or cache change during cleanup.

Main risks are a new fold/effect cycle, leaking internal helpers through broad
exports, changing same-sequence timing, replacing pre-threshold state with
current state, and inadvertently changing no-op identity. No persistence,
catalog, execution protocol, UI, or generated fixture change is justified.

Remaining uncertainty is placement granularity, not game behavior. The evidence
supports a bounded ownership cleanup; it does not support changing the fold,
splitting its event cases, or broadening the work into another scheduler effort.
