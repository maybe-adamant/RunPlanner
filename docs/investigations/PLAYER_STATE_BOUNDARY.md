# Authoritative simulation-state ownership probe

## Question and disposition

At base `9b335f9f`, should simulation carry one authoritative state,
rather than threading player and run facts through
separate eligibility contexts and diagnostic products?

Recommendation: yes. One immutable, branch-local simulation state should be the
authority used at exact eligibility and transition contacts. It composes existing
typed substates without requiring a binary `player`/`run` nesting structure.
The existing Run State inspector
projects this authority at defined checkpoints, rather than becoming a second
state owner or feeding its presentation product back into simulation.

This is ownership consolidation, not a new simulation, universal trait
dictionary, or mutable singleton. Retain the acquired-instance model, effect
transitions, chronology and game rules. The gain must be removal of fragmented
ownership and repeated fact assembly, not another wrapper around parallel data.

This is a bounded source probe, not a locked implementation plan. No production
code or game rules were changed. The governing contracts are
`docs/design/SIMULATION_AND_VALIDATION.md` (chronology, settlement handoffs and
branch equivalence), `CANDIDATE_EVALUATION_MODEL.md` (exact trait candidate
boundary), and `REWARD_MODEL.md` (equipped state and acquired effects).

## Current ownership inventory

Paths below are relative to `packages/planner-engine/src/`.

| State                                                   | Current authority/contact                                                                                  | Proposed disposition                                                                                                     |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Weapon/aspect                                           | Authored loadout, passed independently into branch initialization and trait contexts                       | Initialize immutable player equipment identity once; retain authored loadout as input, not a competing live authority    |
| Acquired boons, hammers, NPC traits                     | `authored-project/traits/state.ts: EquippedTrait`; `simulation/traits/history/model.ts: TraitHistoryState` | Reuse acquired instances and history as a typed substate                                                                 |
| Slots, elements, rarity counts, upgradeability          | `simulation/traits/history/fold.ts: deriveFacts`, `traitDerivedFacts`                                      | Keep derived from authoritative player trait history, not separately editable fields                                     |
| Denial bans and previously picked traits                | `TraitHistoryState`                                                                                        | Retain player acquisition history even after removal; current equipment alone is insufficient                            |
| Chaos curses/blessings                                  | `TraitHistoryState`                                                                                        | Retain typed live instances and their clocks; do not flatten into ordinary boons                                         |
| Active Arcana and spent Artificer uses                  | `simulation/arcana-fear.ts`                                                                                | Retain typed substate; active cards differ from starting selections                                                      |
| Configured/effective Fear and spent Forfeit             | `simulation/arcana-fear.ts: FearState`                                                                     | Preserve configured, suppressed and consumed distinctions and biome resets                                               |
| Keepsake slot, retained effects and charges             | `simulation/keepsakes/state.ts: KeepsakeState`                                                             | Preserve the distinction between removing a keepsake and removing its retained effects                                   |
| Hex tree and banked/invested points                     | `simulation/hex-progress.ts`; branch `hexProgress`                                                         | Retain progression with exact installation and acquisition timing                                                        |
| Yarn, Hymn, Spark, discounts and other Well durations   | `simulation/commerce/stygian-well.ts: StygianWellRunState`                                                 | Retain active acquired effects separately from inventory and purchase participation, within the same authoritative state |
| Bags and reward priorities                              | `simulation/rewards/branch-primitives.ts`                                                                  | Remain run-generation state, including priorities produced by player effects                                             |
| Persistent offered-reward lookups                       | Chronology `rewardLookup`, `ProgressiveSeed.rewardLookups`, generation checkpoints and acquisition inputs  | Move into exact state; preserve completed-board publication, unvisited offers and cross-biome persistence                |
| Pending Shops and Shrine deliveries                     | Same branch contract                                                                                       | Remain pending run/acquisition work; buying a delivery does not yet equip its outcome                                    |
| Reward-use history, Echo last reward, room counters     | Reward history and lifecycle owners                                                                        | Eligibility reads the exact snapshot rather than separately threaded copies                                              |
| Selected findings, candidate artifacts and offer traces | Settlement products                                                                                        | Remain evaluation products, not authoritative simulation state                                                           |

The current runtime already distinguishes declaration from acquisition.
`EquippedTrait` stores rarity, level, acquisition identity, runtime rarity
blocking, and effect progress/intervals. Trait folding builds new equipped
instances and derives current facts. The unified state should not duplicate
the catalog or replace this working model with copied declarations.

The location of `EquippedTrait` under authored-project is worth reviewing during
placement design, but moving that type alone does not solve the ownership issue.

## Concrete producer/consumer traces

### Initialization and biome handoff

`simulation/rewards/branch-lifecycle.ts: initializeRewardBranches` builds
Arcana/Fear, keepsakes, empty trait history, Hex progress and Well effect state,
then applies starting keepsake results and aspect state. Weapon/aspect still
travel as separate loadout inputs. Successor initialization explicitly copies
each substate and performs biome-local resets before branch merging.

`publicRewardBranch` independently enumerates the carried state again.
The public `RewardBranch` and internal `RewardBranchState` therefore both need
to carry the authoritative simulation state. Adding a state wrapper only internally,
while reconstructing separate fields at every biome handoff, would retain the
fragile seam. Evaluation traces and candidate artifacts remain branch products
outside the simulation state itself.

### Eligibility and source context

`simulation/traits/offer-domain.ts: TraitOfferContext` mixes:

- player identity: weapon/aspect and current keepsake;
- extracted player facts: active Arcana trait keys, manual Grasp cost and
  whether Circe has a removable vow;
- historical/run facts: settled Spell Drop, Echo last reward, route and ordinal;
- source rules: Trial restrictions, provider, room/item rarity overrides,
  temporary-bonus suppression and replacement policy;
- prepared assessment products: resolved rarity contributions and rescue policy.

`simulation/rewards/trait-settlement/coordinator.ts: encounterTraitContext`
extracts Arcana and keepsake facts for encounter offers. Acquisition offers
instead begin with the reward's `traitContext` and attach reached history facts.
Additional source preparation carries Yarn/Hymn counters. Gorgon has its own
contact in `biome/encounter-acquisition/gorgon-started.ts`.

`simulation/traits/offers.ts: traitOfferGenerationContext` accepts trait history,
context and optional Arcana/Fear separately. It derives rarity and effective
Denial; when Arcana/Fear is absent it can retain a previously captured rescue
flag. These are real construction paths to inventory, not evidence that every
optional value can simply become mandatory without adapting callers.

Fates' Trimmings is a concrete witness: the current fix correctly extracts
`activeArcanaTraitKeys` at its encounter frontier. Under unified state ownership the
same requirement could query that frontier's active cards directly. It must not
query starting cards, Fated status or remaining rerolls as substitutes.

### Acquisition and history publication

Trait transitions return updated history. Numerous callers then update both
`branch.traitHistory` and `branch.history` through `attachTraitHistory`.
The latter installs the narrow `TraitDerivedFacts` projection consumed by the
reward kernel. This is an intentional lower-level contract, not proof that the
reward kernel should receive the whole simulation state.

A trait transition should return its complete updated substate; the owning
simulation-state transition must publish the required reward-history projection at that
same handoff. The old paired update responsibility must either move into one
owner or disappear through an explicit kernel-input change. Merely nesting
`traitHistory` leaves this obligation unchanged.

### Candidates, nested effects and branch identity

`simulation/traits/offers.ts: TraitOfferCandidateContext` currently retains
`before`, `context`, optional Arcana/Fear and optional keepsakes. Reached offer
evaluations carry similar inputs. These are snapshots of the exact pre-effect
state, not references to a moving current player.

The selected-child settlement contract retains repair contexts separately from
the resulting branch. Concave Stone's residual must see the primary acquisition;
the original offer must still see its earlier state. An invalid nested target
must preserve its repair snapshot without applying its effect.

`simulation/rewards/branch-primitives.ts: equivalentBranchStateKey` includes
trait history, Arcana/Fear, keepsakes, Well effects and Hex progress. Unified state
ownership must preserve those equivalence distinctions. Object identity is not
semantic branch identity, and shared mutable state would corrupt both branch
comparison and retained candidates.

Run State assembly in `simulation/rewards/run-state.ts` observes these products.
Its checkpoint products may aggregate equivalent branches or expose diagnostic
ranges. Such summaries cannot authorize eligibility. It must project the exact
simulation snapshots, not become their owner or an input to simulation.

## Recommended shape

### Code-inspection constraints

The working migration boundary is broader than `RewardBranchState` alone:

- `initializeRewardBranches` and `publicRewardBranch` separately enumerate live
  fields. Successor construction currently defaults omitted Well effects,
  deliveries and trait history. Replace this with complete state handoff and
  declared resets; preserve first-run keepsake/Hex/aspect initialization order.
- `ProgressiveSeed.history` remains legitimate canonical lifecycle history.
  Consolidating its independently carried reward lookup does not justify
  deleting the seed or replacing that history fold.
- `captureRunState` combines branches, a history view, ordinal and a facts
  closure. `recordTargetSlotHistory` emits parallel histories, pending-Spell
  flags, Hex closure and lookup fields. Capture correlated state atomically
  during the ownership migration, not in a later inspector cleanup.
- `targetRewardHistories` checks agreement on the specific inputs generation
  consumes. Retain that check over state-derived facts; neither arbitrary
  first-branch selection nor equality of entire states is equivalent.
- `RewardEvent` is not a diagnostics-only trace: `reachedOfferForOrigin` reads
  it for generated provider identity, acquisition settlement reads Forfeit
  replacements, and `equivalentBranchStateKey` includes Forfeit records and the
  processed-history cursor. Preserve this ledger and its semantic consumers.
- `deriveTravelRefill` captures post-purchase `generationFacts` and callbacks;
  pending Gold retains earlier source history. Those source-time witnesses
  cannot be replaced by whichever state is current when settlement resumes.
- Materialization's `traitContextForOffer` runs before live assessment. Keep
  source descriptors there and join the reached state at assessment; do not
  manufacture a complete state during room materialization.
- `createRunState` caches derived products by state identities plus a facts
  context token covering source/view/shop/peer inputs. This is legitimate
  read-only memoization, not a competing state authority. Consolidation must
  retain context-sensitive invalidation without deep-copying or serializing
  whole states.

One inspection caveat needs characterization, not a silent behavior fix:
`captureRunState` describes lookups in its context-token comment but omits the
lookup/branch arguments to `createBiomeRewardFacts`, whose defaults are empty.
That proves a missing input, not an observed incorrect inspector result. Before
changing any output, determine whether a current bag/requirement consumer can
observe it. Isolate observable corrections from the behavior-preserving refactor.

This makes the gate boundary concrete: A owns construction, transitions,
publication, handoff and capture; B removes independent eligibility contexts;
C simplifies only remaining read-only projection and cache assembly. None may
leave missing state to be repaired by a later gate.

### State and operation boundary

Each possibility branch carries one authoritative simulation state:

```text
Simulation state
  equipment identity
  acquired traits and history
  Arcana/Fear
  keepsakes and retained effects
  Hex progression
  active acquired effects
  bags and generation priorities
  progression and reward history
  inventory and pending acquisition work
```

This is a semantic inventory, not a locked field layout or a new simulator.
Existing typed substates and transition authorities remain. Active Hymn, Yarn
and Ixion effects, inventories and pending deliveries have different semantics
but participate in one authoritative snapshot. Exact field placement must follow
the current source inventory, not only whether a field is mutable.

A mandatory player/run split does not earn a boundary here: Ixion and keepsakes
affect generation, Supply Chain creates pickups, and Forfeit combines player
configuration with biome-local consumption. The split neither removes these
interactions nor defines reset timing or snapshot lifetime. Introduce a grouped
subset only if actual consumers justify it, not to classify every field into
one of two conceptual buckets.

Eligibility and settlement boundaries receive:

1. Catalog: immutable definitions and policies.
2. The exact branch-local simulation snapshot, including player and run facts.
3. Operation-specific context: addressed source, provider, Trial restrictions,
   room/item overrides and other rules specific to this contact.

A normal and boosted boon can see the same simulation snapshot and still need
different source rules. Conversely, current Arcana, Fear, acquired-effect uses
and historical facts already owned by the snapshot should not be independently
reconstructed into optional context fields at each caller.

Keep low-level functions narrow: an Arcana transition may consume only its
Arcana substate, and the reward kernel may keep its supported fact interface.
Do not mechanically pass the entire state to every helper. Prepared rarity and
composition products may remain explicit and cached; they derive from the same
snapshot and source contact rather than becoming another mutable authority.

### Timeline precision and diagnostic checkpoints

Simulation transitions carry state through timeline operations at the existing
declared lifecycle contacts. Candidates retain the exact pre-effect snapshot;
nested effects retain the appropriate intermediate snapshot. These contacts
are finer-grained than the checkpoints exposed by the inspector.

The Run State inspector projects snapshots at defined contacts such as room
entry, door generation and pre-exit. It does not determine when simulation state
updates. No new public snapshot for every timeline row is required, and no
eligibility query should reconstruct truth from an inspector projection.

Preserve immutable earlier snapshots and branch isolation. Transitions may use
local mutable builders, as trait folding already does, but must return complete
immutable products. Structural sharing avoids copying the entire state for each
operation. There is no globally shared current-player object, event bus or
generic effect interpreter.

“Stable identity” means a consistent semantic owner and snapshot contract, not
one JavaScript object reused throughout the run. Acquisition identity still
matters for independently expiring effects and remove/reacquire behavior.

### Acquisition-resolved versus dynamic values

Supply Chain illustrates the distinction. The catalog declares how its interval
is resolved; acquisition installs the resolved interval on the acquired instance.
The current `EquippedTrait.pickupProducerInterval` already represents this fact.
The live progress counter advances from that instance under lifecycle policy.
Moving biomes must not reinterpret its acquisition interval; removing and
reacquiring it creates a newly resolved instance.

Unified state ownership makes this the consistent model, not new Supply Chain behavior.
Freeze only acquisition-resolved values: clock-advancement rules and effects
that respond to later rarity/state changes remain dynamic. Do not copy the
whole trait declaration into each instance or pre-resolve every effect forever.

## Scope, risks and verification needed for a plan

This is a foundational engine refactor, not a small follow-up to Narcissus.
At the base, textual references span 14 source files for `TraitOfferContext`,
48 for `RewardBranchState`, and 15 containing `attachTraitHistory(`. These counts
are navigation indicators, not promised edit counts or evidence of defects.

Primary risk contacts and existing witness owners:

| Risk                                                                     | Existing engine test neighborhoods                                                                               |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Starting state vs mid-run Arcana, suppression and rank changes           | `simulation/arcana-fear.test.ts`, `circe-traits.test.ts`, `judgment-arcana.test.ts`, `narcissus-pickups.test.ts` |
| Earlier candidates accidentally observe later acquisitions               | `trait-offer-focused-candidates.test.ts`, `selected-trait-products.test.ts`, `concave-stone.test.ts`             |
| Source rarity overrides confused with player bonuses                     | `boon-rarity.test.ts`, `shop-trait-reward-settlement.test.ts`, `gorgon-amulet.test.ts`                           |
| Retained effects lost on keepsake removal or biome handoff               | `keepsake-selection-candidates.test.ts`, `echo-gift-keepsake.test.ts`, `chaos-traits.test.ts`                    |
| Acquired instance mutations/history lost                                 | `trait-history.test.ts`, `trait-level-effects.test.ts`, `denial-traits.test.ts`                                  |
| Simulation snapshot no longer agrees with reward generation or execution | `hex-progress.test.ts`, execution compiler/assembler and generated fixture integrity tests                       |

A plan should require deletion of superseded parallel carriers, explicit
branch-equivalence and old-snapshot-isolation witnesses, and a representative
product loop. Keep complete effect matrices with existing policy owners.
Measure rebuild/candidate/edit/Undo performance and avoid deep-copying the
whole simulation state at every query; immutable structural sharing is sufficient.
Require acquisition-resolved effect values to survive biome handoff, and verify
that diagnostic checkpoint products and eligibility observe the same underlying
state without routing eligibility through diagnostic aggregation.

No authored schema or wire-protocol change is inherently required. Internal
public engine products and their application consumers may change; confirm
that through the consumer inventory rather than promising zero app edits.
Serialized execution products should remain semantically identical.

Before locking implementation, resolve these bounded design questions:

- Choose the exact simulation-state type, its typed substate ownership and
  initialization contract, including how low-level tests construct truthful
  state without optional empty production fallbacks.
- Enumerate all current offer-context constructors and classify each field as
  authoritative state, operation-specific input or prepared result; preserve
  specialized contacts and delete redundant state carriers.
- Decide the single owner of publishing trait-derived reward facts. Preserve
  the reward kernel's narrow interface unless an explicit change earns its cost.
- Preserve the distinct transitions for acquired Well effects, inventory and
  delivery reservations without introducing a generic effect/commerce owner.
- Map current Run State checkpoint capture to authoritative simulation snapshots
  while preserving coverage, unavailable states and branch-correlated summaries.

Do not combine this with rewriting trait history folding, clock scheduling,
eligibility rules, or the branch solver. Preserve existing execution output and
authored behavior. The probe supports one simulation-state authority, not a
mandatory player/run split or replacement of those mechanisms.

The acceptance target is that a new live-state eligibility rule can read the
authoritative snapshot at its exact contact without threading another extracted
fact through multiple intermediaries. The inspector reflects that same state at
selected checkpoints; its aggregated presentation never becomes eligibility input.
