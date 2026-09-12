# Shop settlement boundaries

## Question and disposition

Inspected base: `89920fb4`, after acquisition settlement decomposition.
This is a code-ownership investigation, not a new game-source audit or a locked
implementation plan. No production behavior changes are proposed here.

Can Shop settlement become easier to maintain without distributing its ordered
purchase state across independent handlers?

Yes. Inventory generation is already a separate transition and should return
its complete result. The remaining ordered Shop fold should retain branch
survival, slot witnesses, purchase order, and resumable state. Travel refill
derivation and Echo Gold materialization are plausible focused extractions,
but only as complete products, not helpers that mutate the coordinator.

Authorities: `docs/design/SIMULATION_AND_VALIDATION.md`, Ordered State-Flow
Ownership and the Echo/Travel acquisition paragraphs;
`docs/design/ARCHITECTURE.md`, Product Construction and Reorganization Contract.
Existing source evidence lives in
`docs/audits/traits/ALL_TOGETHER_AND_SHOP_TRAITS_GAME_DATA_AUDIT.md` and
`docs/audits/rooms-and-routes/I_Q_WORLD_SHOP_PHASE_GAME_DATA_AUDIT.md`.
This investigation does not reverify native scripts or reinterpret those rules.

## Current owners and consumers

Paths in this section are relative to `packages/planner-engine/src/`.
`simulation/rewards/shop-settlement.ts` has approximately 1,227 lines. Most are
one `settleShopAcquisitionSite` operation, not many unrelated exported functions.

| Responsibility                                                                   | Current owner                                                | Direct production consumer                                                  |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Inventory support, generation history, pending witness creation                  | `processShopInventory`                                       | `simulation/rewards/biome/offer-lifecycle/shop-offer-point-materialized.ts` |
| Ordered paid/free entry settlement and derived reward frontiers                  | `settleShopAcquisitionSite`                                  | `simulation/rewards/biome/generation/authored-site-settlement.ts`           |
| Final pending-witness removal                                                    | `completePendingShopAcquisitionSite`                         | `simulation/rewards/biome/lifecycle-transitions/room-exited.ts`             |
| Exact profile/group/index support and purchase gates                             | `reward-kernel/shop.ts`                                      | Inventory and ordered settlement                                            |
| Concrete acquisitions, conversions, trait/Pom/Anvil outcomes and repair evidence | `simulation/rewards/acquisition/` and its effect authorities | Shop settlement delegates here                                              |
| Internal pending Shop state                                                      | `simulation/rewards/branch-primitives.ts`                    | Inventory creation, resumed settlement, branch equivalence and room exit    |

Direct test contacts are `shop-trait-reward-settlement.test.ts`,
`infernal-contract-travel-deal.test.ts`, and their shared
`shop-trait-purchase-support.ts`. The latter supplies the chronology tests too.
The production import graph is small; any future move must update these exact
consumers rather than retain a forwarding module.

## State lifetime: why an ordered coordinator remains necessary

1. Inventory generation evaluates the jointly authored inventory against each
   incoming branch. Each support witness creates a branch with generated-offer
   history and a `pendingShops[occurrence]` record containing that exact witness.
2. Settlement may receive no actions for candidate activation, one selected
   entry, or an ordered group. It restores the pending witness and remaining
   slots into local `ShopExecution` builders. Travel/Gold entry eligibility is
   captured when that state is initialized, then retained across calls.
3. Each ordered entry captures the current agreement cohort, runs the owning
   purchase/derived-entry policy, collects findings and frontiers, and selects
   surviving executions. Other timeline acquisitions can run between calls.
4. The invocation either publishes updated immutable pending state or completes
   the site. Room exit also closes pending inventory, including unpurchased
   offers, and rejects a divergent pending-presence frontier.

`PendingShopState` is explicit internal simulation state, not authored save
data or an ambient sidecar. Its Travel refill includes generation facts and a
captured evaluator; Gold retains source history and source-time Pom targets.
These are necessary inputs to later candidate/pickup evaluation. Moving their
types must not drop them or change branch-equivalence policy.

Do not remove this lifetime merely because it resembles temporary state. A
whole-room replay at each purchase would invalidate the exact interleaving
frontiers this design preserves.

## Concrete cleanup opportunities

### Inventory: complete returned product

`processShopInventory` returns branches but writes findings into a caller-owned
Map. Its sole production caller already returns a complete transition, so this
remaining boundary is straightforward to regularize: return branches and
finding emissions, then merge once at the existing invocation point.

There is no observed read dependency on prior caller findings. Preserve the
distinction between unsupported individual slots and an unsupported joint set,
finding owners/chronology, witness order, and the caller's separate handling of
unresolved inventory. Reuse the existing finding merger. This is not a reason to
create a generic result type for every reward operation.

### Derived rewards: return transitions rather than mutate ShopExecution

`deriveTravelRefill` already returns a bounded descriptor: source slot, excluded
interaction identities, supported domain, generation facts, and evaluator. It
can receive the exact branch/profile/source inputs without the mutable
`ShopExecution` builder. Keep the rule that retries without exclusions when the
excluded domain is empty; this is existing modeled behavior, not cleanup noise.

`materializeGold` currently changes both `execution.candidate` and
`execution.goldMaterialization`, and appends to the outer derived-frontier list.
It combines one coherent transition: consume the eligible one-use trait,
capture pre-source history, derive the duplicate, and probe its child frontiers.
A useful extraction returns all those products together. Candidate-only probes
must not replace the real branch or acquire the unpicked duplicate.

Do not split every special entry into its own file. Contract source construction
and paid-source binding may stay with the coordinator unless their complete
inputs and outputs genuinely reduce coupling. `settlePaid` currently updates
branches, role records, findings and child frontiers; moving it unchanged behind
a mutation callback would not improve the boundary.

## Ordering and evidence that must remain visible

- Ordinary purchases first pass the indexed Shop-kernel gate. The selected
  option supplies its lifecycle and boosted rarity context; generic reward type
  alone cannot replace that witness.
- Gold materializes before the source acquisition is settled. Its pre-source
  history and repair frontier survive even when later source detail is invalid.
  The free duplicate is acquired only at its own later authored entry.
- Travel derives after successful first normal purchase settlement. A Spell can
  trigger Travel while leaving Gold armed. A Travel refill can subsequently
  trigger Gold; Contract is free and is not the normal-purchase trigger.
- Travel generation facts are frozen at the source point, not regenerated from
  the later refill pickup state. Distinct refill rarity witnesses remain distinct.
- Gold Pom generation retains source-time targets while they remain present;
  the existing disappeared-target branch deliberately uses current history.
- Purchased acquisition-resolved rewards use `settleAcquisitionResolvedReward`.
  A Mystery Boon's hidden source remains an acquisition concern, not inventory
  generation policy. Do not duplicate its unwrapping semantics in Shop code.
- Current-entry agreement branches are captured before entry mutation; derived
  frontiers also retain their original cohort size for attestation. Do not
  substitute surviving-branch counts simply because they are easier to access.
- Missing-authorship classification uses local settlement emissions. Keep exact
  child findings rather than masking them with a generic joint-order failure.

## Suggested placement and exclusions

A final `simulation/rewards/shop/` neighborhood fits inventory generation,
ordered settlement, and any justified derived-reward transition. It is a sibling
of acquisition: Shop owns more than acquisition, and acquisition remains shared
with non-Shop producers. Choose the final directory before updating imports.

Keep the reward kernel authoritative for generation and purchase legality;
`simulation/commerce/` remains the existing store-assessment neighborhood. Do
not unify World Shops, Wells, Shrines, and Pools into a new commerce framework.
Their existing contacts can be compared when needed, not rewritten by this work.

No schema, catalog, execution protocol, UI, scheduler, fixture serialization,
or game-module changes are justified by this investigation. No event registry,
generic purchase pipeline, shared mutable context, or candidate-only simulator.

## Existing witnesses and bounded questions

- `shop-trait-reward-settlement.test.ts`: inventory-versus-purchase effects,
  unresolved Pom repair evidence, Hammer settlement and stale loadout detail.
- `shop-purchase-chronology.test.ts`: paid/free provenance, divergent All Together
  cohorts, Gold pre-source Pom history, delayed pickup, boosted copies, conversion
  and Mystery Boon resolution. Includes a materialized repair frontier whose
  later paid-source detail is invalid.
- `infernal-contract-travel-deal.test.ts`: Contract non-triggering, indexed
  refills, first-source changes, missing/stale children, Spell/Gold sequencing,
  rarity witnesses, branch disagreement and no retroactive Travel activation.
- `shop-inventory-generation.test.ts`: representative authored participation and
  movement contact, not the inventory legality matrix despite its filename.
- `test/reward-kernel/behavior.test.ts`: primary kernel generation/purchase rules.

Use these existing matrices rather than adding a replacement suite. A future
inventory-product change may need a narrow local-emission/merge assertion.
The inspected suites did not reveal a direct test naming pending-state
continuation or exit cleanup. Trace existing product witnesses before adding
one focused interleaved-call/closure test; the broad tests may exercise it
indirectly, but their counts alone do not establish that contract.

Investigation validation: the four named simulation suites passed, 60 tests in
total. No production changes or full repository rerun were needed.

The omitted-order convenience path derives its traversal from room actions but
publishes entries from `context.order ?? []`. Production supplies explicit order.
Its intended direct-call contract should be characterized before altering it;
this inspection does not establish a user-facing defect or authorize a fix.

The recommendation is a focused behavior-preserving cleanup, not immediate
implementation. Keep the exact sequence and exception behavior; any discovered
semantic defect requires separate disposition. Retire this investigation with
the eventual implementation and promote only durable ownership conclusions.
