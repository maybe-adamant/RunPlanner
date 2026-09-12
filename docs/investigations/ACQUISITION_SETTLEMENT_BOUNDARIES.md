# Acquisition settlement boundaries

## Question and disposition

Inspected production base: `088ee598`. The worktree also contains the requested
retirement of older trait investigations; those deletions do not change this
baseline. This is code analysis, not a game-source audit or implementation plan.

Can acquisition settlement be decomposed into smaller change neighborhoods
without changing chronology, branch survival, conversion behavior, or repair
evidence?

Yes. Preserve one producer-role orchestrator and extract complete owned work
around it. The strongest candidates are site traversal and Artificer conversion
generation. Standardize site-level finding publication as a separate complete
boundary change. Do not introduce a generic acquisition pipeline or effect registry.

Authority: `docs/design/SIMULATION_AND_VALIDATION.md`, Ordered State-Flow
Ownership; `docs/design/ARCHITECTURE.md`, Product Construction and package
boundaries. Ordered state stays with its coordinator unless an extraction can
return its complete product without sharing mutable coordinator collections.

## Current responsibilities and consumers

Paths below are relative to `packages/planner-engine/src/simulation/rewards/`.
`acquisition-settlement.ts` is approximately 1,988 lines; its
`applyProducerRoleHistory` occupies roughly 700. Counts identify inspection
regions, not acceptance targets.

| Responsibility                | Current symbols                                                                                | Consumers / boundary                                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Producer and owned-site entry | `settleProducerAcquisitionSite`, `settleOwnedAcquisitionSite`                                  | Biome incoming/local generation, wheel/Fields lifecycle, encounters, shop settlement                                       |
| Ordered pickup site           | `settlePickupAcquisitionSite`                                                                  | Authored-site settlement and reached acquisition paths; owns participation and pre-entry repair evidence                   |
| Acquisition-resolved reward   | `settleAcquisitionResolvedReward`                                                              | Carrier reaches acquisition; this function resolves the child source and retains its derived frontier                      |
| Replacement pickup            | `settleArtificerReplacementAcquisition`, `withStoredArtificerReplacements`                     | Site paths and stored room acquisitions; separate generated replacement from its later pickup                              |
| Conversion eligibility        | `assessTimePieceConversion`, `assessArtificerConversion`, `assessSeaStarDuplication`           | Role settlement and `acquisition-artifacts.ts`; these are already shared policy, not duplicated candidate implementations  |
| Concrete role fold            | `applyProducerRoleHistory`                                                                     | Site wrappers and recursive immediate Artificer replacement settlement                                                     |
| Candidate artifacts           | `AcquisitionRoleFrontier`, `DerivedAcquisitionEntryFrontier`, `PickupAcquisitionEntryFrontier` | `acquisition-artifacts.ts`, producer frontiers, biome publication; keep captured branch evidence and explicit capabilities |
| Finding merging               | `accumulateProducerRoleFindingEmissions`, `findings.ts:addRewardFinding`                       | Site wrappers merge role findings into their caller's map                                                                  |

`AcquisitionSource` already carries explicit free/paid provenance, producer
identity, Forfeit eligibility, authored payloads, and role dispositions. Preserve
these facts; do not reconstruct them from encoded addresses or caller names.

## Sequence that must remain visible

The role fold currently:

1. Checks offer support unless the offer was already generated, then resolves
   the declaration-owned concrete role.
2. Applies the eligible Forfeit substitution and captures the realized
   acquisition for downstream conversion candidates.
3. Assesses Sea Star and records retained-source eligibility; applies free
   provider materialization bookkeeping, including the hidden unwrapped source.
4. Processes Time Piece before ordinary acquisition effects. A supported
   conversion consumes its charge and stops that acquisition; an invalid
   retained conversion emits a repairable finding instead.
5. Settles a forfeited concrete reward, or processes Artificer generation and
   either defers its pickup or settles the replacement roles immediately.
6. Assesses Anvil detail, applies concrete history, fixed trait/element/Path
   effects, delegates trait settlement, and records the acquisition event.
7. Retains blocked trait children separately from surviving branches and
   publishes the exact pre-role frontier, realized substitutions, mutation
   dependencies, and candidate contacts.

Do not collapse missing Artificer detail or a blocked trait child into generic
`rewardAcquisitionUnavailable`: the existing unresolved flags distinguish them.
Do not move candidate capture after mutation. Preserve generation-time Pom
history versus current application history.

The pickup-site fold additionally inspects unpicked entries for editable
authorship and candidate frontiers. Its candidate-only role folds must not
advance the actual current branches or spend uses. Entries without a pickup
remain different from entries with an unresolved authored reward. This is not
permission to remove candidate probes simply because they resemble settlement.

## Artificer: shared rules versus different operations

Conversion eligibility is already centralized in `assessArtificerConversion`.
Both replacement settlement and the captured `evaluateOffer` capability prepare
the RunProgress bag and call `consumeCountedOffer`, excluding Devotion and
SpellDrop. This is a plausible shared support/preparation boundary.

They are not currently equivalent:

- Settlement checks the replacement lifecycle, spends an Artificer use, projects
  generation history, records offer/conversion events, and may settle child roles.
- Settlement permits a same-reward pending-sibling generation path when ordinary
  bag consumption yields no possibilities. The comment identifies coexisting
  Fields rewards; the implementation recognizes prior conversion/acquisition
  events. The candidate closure does not include this path.
- Settlement suppresses only the named one-refill eligibility invariant error;
  the candidate closure currently catches every thrown error and returns false.

Source follow-up resolves the pending-sibling question. `GiftLogic.lua` calls
`ChooseRoomReward` for every conversion; `RewardLogic.lua:ChooseRoomReward`
filters the current bag, refills only when no eligible entry remains, and removes
the selected entry before returning. No pending-object exemption exists.
The durable Fields/Artificer audit already describes this correctly: multiple
uncollected Hammers require multiple remaining eligible entries (which can
accumulate through earlier refills). Delayed acquisition preserves eligibility,
not bag quantity. The bypass originated in `f38247d3` during room-action chronology
work and must be removed, not copied into candidates. Keep this semantic fix
separate from behavior-preserving extraction. Exception-policy differences remain
outside that fix; do not silently broaden it.

The useful extraction returns generated branches, findings, and replacement
source/role information. Immediate recursion stays with the role coordinator;
do not inject a settlement callback merely to make the extracted helper recurse.
Deferred replacement pickup remains a separate timeline action.

## Complete finding publication

`ProducerRoleSettlementProduct` already returns branches, finding emissions,
role frontiers, and blocked trait children. In contrast, site entry points take
a caller-owned findings map and omit findings from `AcquisitionSettlementProduct`.

Recommended correction: each site collects findings locally and returns them
alongside its existing complete product. Every caller merges the returned
findings at the same chronological location. Remove the map parameter and old
caller path in the same slice; no transitional dual write/return contract.

Preserve `addRewardFinding` semantics: identity-based merge, region/chronology,
and deduplicated `levelResolutionEvaluations` from divergent Pom frontiers.
Concatenating arrays or calling `Map.set` is not an equivalent replacement.
Reuse the existing merge algorithm; a narrowly named merger belongs with
findings rather than conversion policy. Local mutable maps remain acceptable.

## Proposed extraction boundaries

These are responsibilities to lock in a plan, not required filenames.

| Owner                        | Inputs and complete output                                                                                               | What it displaces                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Site settlement              | Authored site/order, sources and input branches → entries, branches, findings, frontiers, child checkpoints              | Site entry/traversal blocks in the central file                                                                     |
| Conversion policy/generation | Exact source/role/frontier and selected replacement → eligibility evidence or generated conversion branches and findings | Inline Artificer generation and its shared support preparation; existing conversion assessments move with consumers |
| Concrete acquisition effects | Concrete acquisition, branch, authored detail and source context → updated branch or exact blocked effect findings       | Inline Anvil/fixed grant/element/Path effect block, only if it can remain one complete transition                   |
| Role coordinator             | Explicit source and role → existing complete producer-role product                                                       | Retains ordered composition, branch aggregation, recursion and repair capture                                       |

Keep existing Anvil, trait, level, reward-kernel, and keepsake authorities. The
effects extraction delegates to them; it must not reimplement them. If that
extraction needs shared mutable history/branch variables, leave it inline.

Group these under the existing acquisition neighborhood rather than scattering
new root files. Move shared contracts only where needed to avoid runtime cycles;
do not create interface-only commits, forwarding facades, or a generic services
directory. Update internal consumers directly and remove displaced code.

## Existing tests and targeted gaps

- `test/simulation/artificer.test.ts` owns conversion capacity/bag use,
  Forfeit interaction, Sea Star source/duplicate behavior, refill and delayed
  replacement pickup. Reuse its builders. Pending-sibling candidate parity is
  not established by this inspection and needs a bounded characterization.
- `test/simulation/time-piece.test.ts` covers conversion before effects,
  paid/free distinctions, invalid retained conversions, and charge order.
- `test/simulation/anvil.test.ts` owns transformation results and missing detail.
- `test/simulation/pom-level-resolution.test.ts` covers stale targets and
  divergent/removed-cohort assessment preservation. Its existing merge witnesses
  are especially relevant to returned site findings.
- `test/simulation/hermes-shrine-inventory.test.ts` includes an unresolved rushed
  Mystery Boon under its exact postboss action. Keep delivery scheduling outside
  this refactor; this is a caller/repair witness.
- Existing `echo-traits`, `all-together`, `trait-offers`, and H/N/O simulation
  suites exercise real consumers. Run affected tests rather than duplicate their
  semantic matrices in a new acquisition suite.
- Application `acquisition-conversion-interactions.test.ts` is a representative
  binding contact. Select an existing product-loop repair workflow if caller
  evidence changes; do not add one giant new fixture per acquisition family.

Minimum discriminating evidence for the future plan: converted source does not
apply original effects; deferred replacement is not acquired early; source and
replacement retain their exact repair owners; candidate probes do not mutate
real history; returned findings preserve divergent Pom evaluation evidence.
Test-count growth is not an objective. No tests were run for this investigation.

## Scope and unresolved decisions

The plan can now name concrete slices, beginning with the source-confirmed
Artificer correction. Choose whether
the concrete-effect extraction earns its own boundary after examining its full
input/result shape; it is not mandatory to reduce the main file's length.

No authored schema, execution protocol, game module, UI behavior, scheduler,
or reward-bag algorithm changes are requested. Beyond the explicit Artificer
correction, acquisition behavior is preserved. Broad closure
belongs after the implementation and review, not this analysis. Remove this
investigation with the delivered plan; promote only durable ownership changes
to existing design authorities.
