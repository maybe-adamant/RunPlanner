# Authoritative simulation state

## Status and objective

Approved and locked execution contract; implementation has not started.
Behavior and performance base: `9b335f9f`, including the completed persistent
hub-offer correction. Independent pre-lock review corrections are incorporated.

Consolidate the live state already used by simulation into one authoritative,
immutable, branch-local `SimulationState`. Eligibility uses the exact snapshot
plus operation-specific context. The visible Run State remains a read-only
checkpoint projection. Do not require a `player`/`run` nesting split.

User-visible behavior is preserved. The maintenance outcome is that a rule
about existing live state can query that state at its exact contact without
threading another extracted fact through several intermediaries.

## Authorities and evidence

- Read `docs/design/SIMULATION_AND_VALIDATION.md` in full before engine work:
  chronology, complete settlement products, branch equivalence, readiness and
  Run-State Snapshots govern this refactor.
- `docs/design/CANDIDATE_EVALUATION_MODEL.md`, Exact Artifact Boundaries:
  candidates retain branch-correlated pre-effect state and repair capabilities.
- `docs/design/REWARD_MODEL.md`, Offer and Acquisition, Possibility Contract,
  and Trait-bearing reward leaves: source generation, acquired instances,
  Fear and source-specific rarity remain distinct.
- `docs/design/ROOM_LIFECYCLE_MODEL.md`, Counter and Cache Timing and Lifecycle
  Run-State Checkpoints: preserve all existing advancement and capture contacts.
- Investigation: `docs/investigations/PLAYER_STATE_BOUNDARY.md` records current
  producers/consumers and the rejected mandatory player/run split.

This plan changes ownership, not source-backed game facts. Supply Chain's
acquisition-resolved interval, dynamic clock advancement, retained keepsake
effects, NPC ordinal resolution and all other existing policies remain intact.
Do not use this refactor to correct newly discovered behavior defects; report
and isolate them for a separately approved change.

## Scope and ownership

Engine owns the new state contract, construction, transitions, eligibility,
candidate capture, biome handoff and checkpoint projection. Catalog definitions
remain immutable and separate. Application changes are limited to adapting
supported engine products and tests; React must not reconstruct state or rules.
No game-module work, authored migration, protocol bump, fixture regeneration,
or UI redesign is expected or authorized by this plan.

Existing typed authorities remain responsible for their policies. State
composition does not become a generic effect interpreter, event bus, service
container, universal trait dictionary or replacement history fold.

### State contract

Place the owned contract and construction/transition composition in a focused
`simulation/state/` neighborhood. Use no barrel unless it defines an intentional
supported surface. Low-level state types must not import reward coordinators;
move declaration-only pending-state types to their owning neighborhood if needed
to avoid a dependency cycle. Do not add forwarding modules for moved types.

The state contains these existing semantic products, not duplicate versions:

| Substate                          | Source and rule                                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Equipment identity                | Weapon/aspect initialized from loadout; acquired aspect effects still use existing transitions                             |
| Trait history                     | Existing equipped instances, slots, elements, rarity facts, bans, previous acquisitions and Chaos instances                |
| Arcana/Fear                       | Existing active cards, ranks, configured/effective vows and consumed uses                                                  |
| Keepsakes                         | Existing slot/history, retained sources, charges and independently expiring instances                                      |
| Hex progression                   | Installed tree and banked/invested progression                                                                             |
| Acquired Well effects             | Existing Yarn/Hymn/Ixion and other modeled counters; retain source-specific consumption rules                              |
| Reward generation                 | Bags and ordered priorities                                                                                                |
| Reward history                    | Existing offer/use/loot records and last-reward facts                                                                      |
| Persistent offered-reward lookups | Existing completed-board contributions, including open unvisited hub rewards; distinct from acquisitions and bag depletion |
| Pending acquisition work          | Pending Shops and Shrine orders; ordering/reservations are not acquired effects                                            |
| Reached progression               | Exact route position and existing lifecycle history view at the current operation contact                                  |

The chronology owner supplies the existing exact `HistoryStateView`; state
composition must not refold history, infer timing from a room index, or read a
final history view at an earlier contact. Immutable historical source witnesses
captured for generation remain explicit where they differ from current state.

Persistent reward lookups currently live outside `RewardBranchState`: chronology
owns a separate lookup, `ProgressiveSeed` carries it across biomes, and generation
checkpoints and acquisition inputs transport it independently. Include these
carriers in consolidation, not only fields already on a branch. The completed
hub board updates state at its existing publication contact; its own generation
and earlier snapshots must not observe that contribution. Restores remain
idempotent and later biomes retain it. Branches may share the immutable lookup
substate; do not deep-copy it or add a second lookup authority.

Branches still carry evaluation products outside state: findings, candidate
artifacts and selected assessments. Existing exact source reservations needed
by later transitions (for example Sea Star duplication eligibility) remain
preserved and explicitly carried; they must not be erased as mere diagnostics.
Keep the existing reward-event ledger explicitly carried as well: it is not
only diagnostics. `reachedOfferForOrigin` reads generated offers from it,
acquisition settlement reads `rewardForfeited`, and branch equivalence includes
those Forfeit records and `processedThroughHistorySequence`. Preserve these
semantic witnesses and cursor distinctions without creating a duplicate event
index or rewriting event publication. Findings and candidate evaluations remain
evaluation products; do not classify every non-equipment field that way.

`PendingShopTravelRefill.evaluateOffer` and `evaluateShopOption` are callable
candidate capabilities, not simulation data. Their owner remains Shop
settlement. Split the existing complete pending product into data held in state
and explicitly carried Shop continuation capabilities in the internal branch
envelope. Return both together at the owning transition; do not introduce an
ambient registry, reconstruct closures later, or duplicate semantic facts in
the capability carrier. Public data-only branches must not export these
functions. Preserve room-exit closure of pending Shops; biome handoff does not
invent persistence for these room-local capabilities. Tests must cover Travel
Deal continuation across interleaved actions and its publication boundary.

### Construction and updates

Initialize complete state once from the authored loadout and route context using
existing initialization order. Carry it through biome transitions with the same
declared resets. Production transitions never silently fabricate empty traits,
Arcana or keepsakes to compensate for missing state. Test builders belong under
test support and invoke production constructors/transitions.

Use immutable structural sharing. Local mutation inside an owned transition is
allowed; shared mutation across candidate snapshots or possibility branches is
not. No globally stable mutable object or snapshot-ID registry.

Keep `TraitDerivedFacts` as the reward kernel's narrow contract. The state-owned
trait-history replacement transition must atomically install trait history and
its derived reward-history facts. Move the existing paired publication into
this owner and remove scattered paired updates. No second mutable trait-fact
authority and no dependency from the reward kernel into simulation state.

Low-level Arcana, history and clock helpers may continue accepting narrow
substates. At eligibility/settlement composition boundaries use complete state
and operation context; do not mechanically pass the whole state to every helper.

### Offer-context disposition

Replace parallel state carriers at candidate and selected-assessment boundaries.
The following matrix covers the current `TraitOfferContext` fields:

| Current fields                                                                                    | Destination                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `weaponKey`, `aspectKey`, `currentKeepsakeKey`                                                    | Read state directly                                                                                                                                                           |
| `manualArcanaGraspCost`, `activeArcanaTraitKeys`, `circeRemovableFearVow`                         | Derive with existing predicates from state at the reached contact; remove transported copies                                                                                  |
| `settledSpellDrop`, `echoLastRewardAvailable`, `echoLastRewardRecreation`                         | Read exact reward history from state; preserve source-time recreation witnesses where needed                                                                                  |
| `temporaryBoonRarityUses`, `limitedSwapUses`                                                      | Read active acquired effects from state; source suppression remains contextual                                                                                                |
| `routeKey`, `acquisitionOrdinal`                                                                  | Read reached route context for ordinary acquisitions; explicitly captured acquisition/source ordinal remains an operation witness when chronology requires an earlier ordinal |
| `devotionNoDuo`, `blockGiftBoons`, `resolvedProviderKey`                                          | Operation/source context                                                                                                                                                      |
| `freshRarityOverride`, `gorgonResolvedRarity`, `boonRarityRoomOverride`, `boonRarityItemOverride` | Exact resolved source witnesses; do not turn these into global state rarity                                                                                                   |
| `ordinarySlotReplacement`, `stackBoostsSuppressed`, `suppressTemporaryBoonRarity`                 | Source policy context                                                                                                                                                         |
| `boonRarityFacts`, `replacementRollChance`, `finalRarityRescueDisabled`                           | Prepared assessment results derived from the same state and source; no optional fallback to independently transported stale player facts                                      |

The before-history, optional Arcana/Fear and optional keepsakes currently carried
by `TraitOfferCandidateContext` become one exact snapshot. Prepared products may
be cached against complete immutable inputs. Neither application nor candidates
may synthesize missing snapshots or borrow facts from another branch.

The same disposition applies beyond trait offers: initial inventory, Travel Deal
and room-generation assessments obtain persistent reward lookups from their exact
state snapshot. Keep catalog entry predicates and narrow requirement inputs;
remove independently threaded lookup arguments at composition boundaries. A
projection required by the reward kernel is not a second authoritative carrier.

### Diagnostics and external products

`RunStateSnapshot` remains a projection, not the new authority. Its ranges,
grouping, labels and availability are not valid eligibility inputs. Capture
the new state at existing contacts: room entry, before target generation,
before encounter start and pre-exit. Preserve branch correlation and coverage.
No requirement to publish an inspector snapshot for every timeline row.

Capture ownership changes in Gate A, not C. Both `captureRunState` and
`recordTargetSlotHistory` must capture correlated state at their existing
contacts. `TargetRewardHistoryCheckpoint` currently splits histories, pending
Spell flags, Hex closure and reward lookups into parallel fields; replace that
transport with exact state snapshots. Retain the generation consumer's current
agreement checks over the facts it uses, rather than arbitrarily choosing one
branch or requiring unrelated state to agree.

Materialization runs before live settlement. Its `traitContextForOffer` must
become source/operation description, not an invented early simulation snapshot.
Gate B supplies the reached state when preparing assessment. Earlier source-time
witnesses still remain distinct from the current acquisition state.

Execution plans, authored documents, findings, semantic addresses and candidate
answers must remain equivalent. Public engine interfaces may change internally
with their consumers in the same gate; serialized products must not.

## Delivery gates and intended commits

Each gate is a complete working slice. One write-capable executor at a time,
with a focused packet and reusable context for adjacent remediation. After each
implementation stabilizes, use a fresh independent reviewer. Main session owns
scope, finding disposition, Git and broad closure checks. Do not commit partial
interfaces, compatibility wrappers or unconsumed state scaffolding.

### A — Authoritative state through the simulation walk

Starting contacts: `rewards/branch-primitives.ts`, `branch-lifecycle.ts`,
`rewards/model.ts`, `rewards/biome/chronology.ts`, `history/model.ts`, trait history
folding and state transitions in Arcana/Fear, keepsakes, Hex and commerce.
Also inventory `rewards/biome/prepared-inputs.ts`, `progressive/biome.ts` and
`evaluation/project.ts` for the separately carried reward lookup.

Before source edits, complete and review one bounded transition inventory in
the investigation. Name the current producer, new owner, consumers, reset/capture
timing, primary tests and exact displaced fields for the contacts below. Main
session accepts this inventory and the concrete Gate A write packet before
implementation begins; it is a scope check, not a new scaffolding commit.

| Contact                                           | Required ownership decision                                                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `initializeRewardBranches` / `publicRewardBranch` | Complete constructor versus successor resets; carry state directly without re-enumerating optional live fields               |
| `RewardBranchState` / `RewardBranch`              | State versus evaluation products, semantic event witnesses and Shop continuation capabilities                                |
| `deriveTravelRefill` / Shop resume and closure    | Data-only pending state versus callbacks; preserve frozen post-purchase generation facts and Gold's earlier source witnesses |
| `flushPendingHubBoard` / `ProgressiveSeed`        | Lookup transition and state handoff; retain the legitimate canonical lifecycle-history seed                                  |
| `captureRunState` / `recordTargetSlotHistory`     | Exact state and operation context captured atomically, including retained trait-child branches                               |
| Branch and candidate deduplication                | Existing semantic keys, relevant new state inputs, and unrelated history/views that must not prevent merging                 |

Current navigation baseline: 48 engine source files reference
`RewardBranchState`, 14 reference `TraitOfferContext`, and 15 call
`attachTraitHistory`. These are reach indicators, not edit quotas. Record
representative branch counts and candidate-context counts using existing tests
before migration; retain their owners and inputs for comparison after each gate.

- Inventory every branch field and initialization/handoff consumer; assign it
  to state, an exact retained source witness or an evaluation product.
- Introduce the complete state contract, initialize it and carry it through all
  existing operations and biome handoffs. Update direct readers/writers and
  public branch consumers together; preserve policy helpers.
- Fold the persistent lookup into state at the existing completed-board flush.
  Replace its separate chronology authority and biome-seed handoff; preserve
  empty initial lookup, unvisited offers, restore idempotence and route ordering.
- Centralize atomic trait-history/derived-fact replacement and remove the old
  scattered paired writes. Preserve existing chronological event publication.
- Adapt branch-equivalence keys to compare the same meaningful substates and
  source witnesses. Do not blindly compare diagnostic products or all retained
  chronology views and thereby prevent previously valid branch merges.
- Adapt inspector/execution consumers enough to keep existing products working.
  Migrate checkpoint capture and its immediate readers atomically. Keep the
  lifecycle-history seed/envelope; remove only independent live-state transport.
  Existing pure offer-context extraction from the new state may remain until B,
  and pure inspector projection/cache code may remain until C. Neither may
  reconstruct a missing state or maintain another writable carrier.

Gate A exit contract: construction, transitions, public branch publication,
biome handoff and checkpoint capture all have one state authority. There are
no compatibility getters mirroring the old branch shape or partial-state
constructors for production callers. Preserve valid incomplete-project paths
through existing coverage rules; do not fabricate state for unreached owners.

Acceptance: engine typecheck and engine suite; focused initialization, retained
old-snapshot and divergent-branch witnesses; complete biome handoff coverage;
execution fixture integrity. Compare representative branch counts to base.
Expected deletion: old top-level state carriers, separate lookup ownership and
the independent `ProgressiveSeed.rewardLookups` field, and repeated trait-fact writes.
Intended commit: `refactor(engine): consolidate authoritative simulation state`.

### B — Eligibility and candidate snapshots

Starting contacts: `traits/offer-domain.ts`, `offers.ts`, `level-effects.ts`,
`offer-levels.ts`, `traits/authoring/`, `rewards/trait-settlement/`,
`candidates/trait-offer/capability.ts`, materialization trait contexts, Gorgon
encounter acquisition and Anvil settlement.
Inventory/generation contacts include `generation/target-policy.ts`,
`generation/biome.ts`, hub/takeover/additional-exit candidates and
`rewards/biome/encounter-acquisition/acquisition-point-reached.ts::factsAt`.

- Apply the context matrix across ordinary, NPC, Chaos, Gorgon, Echo, Stone,
  direct-grant and acquisition paths; retain specialized policies.
- Make selected assessment and candidates use the same state-based predicates.
  Capture candidates before selected effects and before branch merging.
- Migrate initial inventory, Travel Deal and room-generation lookup consumers
  to those snapshots. Preserve their separate generation contacts and catalog
  source-specific exclusions; no global Spell/Hammer ban or gameplay change.
- Preserve source-time target generation versus acquisition-time application,
  primary versus residual Stone state and repair for incomplete nested effects.
- Update candidate-context deduplication (including `mergeTraitEvaluations`)
  against explicit relevant semantic inputs. Do not blanket-serialize the new
  state: functions and Sets are not faithfully compared by JSON, and unrelated
  chronology data must not spuriously multiply equivalent candidate contexts.
  Retain one equivalent-context and one divergent-context witness proving
  deduplication preserves the correlated state actually consumed by assessment.
- Remove superseded context facts, optional parallel substate arguments and
  missing-state fallbacks from migrated boundaries. Do not replace them with a
  newly named bag of copied player facts.
- Migrate `createBiomeRewardFacts` and selected/candidate assessment entry
  points to state plus explicit source/view/shop/peer context. Do not immediately
  unpack the state and rethread the old argument list across intermediaries.
  A single pure adapter may derive the kernel's narrow requirements/facts;
  domain helpers remain narrow. Keep materialized source descriptors state-free.

Acceptance: engine suite, catalog requirement contact tests and representative
planner contract/product witnesses. Cover Narcissus eligibility after temporary
Arcana activation, Circe suppression, normal versus boosted boon source rules,
Stone nested targets, and earlier candidates remaining unchanged after a later
acquisition. Retain the hub inventory/refill candidate-parity and repair witnesses.
Existing low-level tests retain their owning policy matrices.
Expected deletion: parallel player-fact fields, independent lookup arguments at
migrated composition boundaries and redundant context assembly.
Intended commit: `refactor(engine): assess eligibility from exact simulation state`.

### C — Checkpoint projections and end-to-end verification

Starting contacts: `rewards/run-state.ts`, chronology checkpoint capture,
`simulation/evaluation/`, `simulation/progressive/`, execution-plan consumers and
application Run State projections.

- Simplify `createRunState` projection and its derivation cache over the exact
  state captured in A. This gate does not retrofit state capture or migrate
  eligibility consumers left behind by A/B. Keep public inspector behavior,
  missing-coverage behavior and branch-correlated summaries unchanged.
- Replace projection-only redundant assembly, not legitimate operation inputs.
  Bag eligibility still depends on source/view/shop/peer context as well as state.
  Preserve complete cache keys: equal reward-history identity alone is not equal
  context. Memoized trait, bag and god-pool projections remain permitted; no
  blanket state serialization or obligatory recomputation on every read.
- Audit remaining semantic state extraction across generation, progressive
  eligibility and execution consumers: narrow derived kernel inputs are allowed;
  parallel mutable authority or manually threaded live-state copies are not.
- Prove Supply Chain's acquired interval and progress survive biome transitions;
  use existing real fixtures for timed effects and retained keepsake behavior.
  No new giant fixture or redundant effect matrix.
- Reuse `hermes-shrine-inventory.test.ts` and the application reconciliation
  witness for hub lookup chronology: earlier snapshots stay unchanged, later
  initial/refill inventory inherits open unvisited offers, and upstream edits
  and Undo rebuild eligibility. Preserve the existing Dream pre-N and carried
  lookup coverage. Confirm A/B removed independent checkpoint lookup plumbing;
  do not duplicate the catalog exclusion matrix in product tests.

Acceptance: focused engine snapshot tests, planner/contract tests, representative
real-plan product loops and execution fixture integrity. Compare derived products
against base using test-only harnesses with stable IDs; never normalize away
differences in ordering, branch correlation, findings or eligibility.
Expected deletion: redundant projection-only input plumbing and fact assembly.
Intended commit: `refactor(planner): project run state from simulation snapshots`.

If Gate A's inspection exposes an existing omitted fact or stale-context output,
characterize whether a current consumer can observe it. Do not quietly fix it
while claiming equivalence: isolate any observable correction for explicit
approval and refresh the comparison base before continuing. The new state must
not preserve a missing-fact fallback as permanent compatibility machinery.

### D — Closure

- Main session reviews the complete base-to-head diff for semantic changes,
  parallel carriers, dependency direction, unbounded growth and stale comments.
- Run one full `RUN_PLANNER_PERFORMANCE_BASE_REF=9b335f9f npm run check`
  after narrow tests/review remediation. Pin the performance base to the start
  of this refactor so successive gate commits cannot hide cumulative cost.
  Gate A–C results and closure results belong in commit
  history, not appended to durable design documents as bug-fix paragraphs.
- Require unchanged generated execution fixtures. Investigate semantic diffs;
  do not regenerate fixtures to bless a behavior-preserving refactor. Preserve
  the repository's generated JSON formatting policy.
- Update the owning sections of Simulation and Validation, Candidate Evaluation
  and Run State documentation only where contracts changed; avoid duplicate
  explanations. Delete this plan and the investigation at closure.
- Leave existing unrelated runtime-acceptance plans untouched.

## Audit-against and explicit non-goals

- No mandatory player/run split, new generic effect system or mutable singleton.
- No rewrite of trait history, scheduler, lifecycle, branch solver or game rules.
- No eligibility based on aggregate inspector ranges or final-state lookahead.
- No invented defaults for unavailable/unreached states.
- No copied catalog definitions on live instances; retain acquisition-resolved
  values and genuinely dynamic rules separately.
- No production shadow evaluator, dual-state synchronization, generic registry,
  broad service object, or test-only production hooks.
- No prerequisite to remove all derived facts: pure, complete, exact projections
  remain valid; independently assembled semantic authority does not.
- No schema/protocol change or executor edits without a demonstrated contract
  need and explicit plan amendment.
