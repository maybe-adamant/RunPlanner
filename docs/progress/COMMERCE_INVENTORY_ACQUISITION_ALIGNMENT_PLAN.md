# Stygian Well Correction and Travel Deal Slot Alignment

## Status and objective

Status: **Gate A implemented and independently reviewed.** Gate B is next and
has not started.
Base: `e351211b` (timeline presentation cleanup; clean tracked worktree).

The expanded contract passed independent adversarial review before locking.
Gate A review findings about the saved result label and incompatible retained
children are resolved. Focused simulation, execution, codec, navigation and UI
tests passed, including initial/refill Timeline selection and reopening.
Workspace contract checks, engine/application/fixture typechecks, and scoped
lint/format checks passed. The complete repository gate remains reserved for
final phase closure.

Separate generated inventory from the outcome of acquiring its item. A Travel
Deal refill is conditional inventory, but once generated it follows its host's
ordinary slot contract. It is not a different acquisition family.

- World Shop Overview selects Mystery Boon without asking for a god. After
  Purchased is selected, its Timeline action owns source and trait authoring.
- Well Overview selects Fateful Twist without selecting its result. After
  Purchased is selected, its Timeline action owns that result, evaluated at
  the purchase's position. This applies to initial and Travel Deal slots.
- Well Travel Deal generation reads its actual triggering purchase context,
  separately from the later acquisition of the generated item.

Deliver two complete vertical slices, Wells then World Shops. Commit the agreed
plan before implementation. No intermediate UI bypass or generic commerce
framework is needed.

## Evidence and timing contract

The installed source root is `/home/ayyatma/wsl-projects/modding/1GameData/Scripts`.
These are source traces, not a claim of live-game verification.

| Contact                                                                       | Source fact / current defect                                                                             | Disposition                                                                                                                     |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `ConsumableData.lua:RandomStoreItem`; `StoreLogic.lua:AwardRandomStoreItem`   | Fateful Twist builds its eligible nested pool when used, then selects a trait or consumable.             | Resolve its authored outcome at its purchase action, not inventory generation.                                                  |
| `TraitData_Store.lua:TemporaryDiscountTrait`                                  | The discount trait requires that it is not already held.                                                 | An earlier purchase can remove it from a later Twist's result domain.                                                           |
| `StoreLogic.lua:HandleStorePurchase`                                          | The Well's first-purchase refill calls `FillInShopOptions` before applying the triggering item's effect. | Capture Well refill generation at the triggering action, before its effect; do not import World Shop's post-acquisition timing. |
| Engine `commerce/stygian-well.ts` and `lifecycle-transitions/room-entered.ts` | Initial inventory, refill support and every Twist result currently share a room-entry assessment.        | Keep initial inventory assessment separate from reached refill and Twist assessments.                                           |
| Engine `encounter-acquisition/well-purchase.ts`                               | Nested Twist effects already apply at the purchase.                                                      | Retain this effect owner; move result validation/candidate capture to the same contact, before application.                     |
| Engine World Shop commands/codec versus supplemental acquisition entries      | Ordinary Mystery inventory is identity-only; Travel still stores its full reward in a pickup entry.      | Give Travel ordinary inventory/acquisition separation, preserving its dynamic generation contact.                               |

The common contract does not imply identical native timing:

| Product                             | Context used                                                  | Editor   |
| ----------------------------------- | ------------------------------------------------------------- | -------- |
| Initial World Shop / Well inventory | Existing inventory-generation context                         | Overview |
| World Shop Travel inventory         | Existing settled-trigger, post-purchase generation capability | Overview |
| Well Travel inventory               | Reached trigger, before applying its item effect              | Overview |
| Mystery source / traits             | Exact pre-acquisition context of the purchased item           | Timeline |
| Fateful Twist result                | Exact pre-effect context of its purchase                      | Timeline |

Keep the existing Well simplification that one purchase action applies the
nested outcome. Do not create another pickup action for native consumable
presentation. Exact money, health, affordability and unmodeled Last Stand
inventory remain outside the simulation; use the modeled result predicates,
not a newly invented resource ledger.

## Authorities and ownership

Read `docs/design/SIMULATION_AND_VALIDATION.md` in full before engine work.
Relevant specialist sections:

- `REWARD_MODEL.md`: Shops; Offer and Acquisition.
- `AUTHORED_PROJECT_MODEL.md`: Occurrence State and Replacement; Commands;
  Ordered reconciliation; Persistence and Validation.
- `CANDIDATE_EVALUATION_MODEL.md`: Reward Producer Frontiers; Application and
  React Boundary.
- `STRUCTURED_EDITOR_WORKSPACE.md`: Lifecycle Occurrence Workbenches.
- `docs/audits/room-features/ROOM_FEATURES_GAME_DATA_AUDIT.md`: Stygian Wells.

The catalog retains item identities, pools and requirements. Engine commands
own representability, participation and atomic child reconciliation; simulation
owns chronological generation, outcome legality and exact candidate products.
Application projections bind those products to controls and finding targets;
React performs no eligibility, source-slot inference or chronology repair.

Commands and decoders must not consume simulation or candidate capabilities.
They accept structurally representable context-invalid state. Dynamic support
belongs to selected evaluation and candidates, not command rejection.

## Gate A — Well acquisition-time outcomes and dynamic refills

One engine/application implementation commit; no saved-shape migration.

### Engine contract

Retain `StygianWellState`, `twistResultKeyBySlot`, the existing generation keys
and `purchaseStygianWellOffer` references. The result map stores authored
purchase outcomes even though it lives alongside inventory. Moving a control
does not justify moving all Well persistence into a new acquisition model.

1. Initial inventory owns presence, groups and joint initial-offer legality.
   It must no longer validate Twist results or publish their room-entry domains.
2. At a reached qualifying trigger, capture and validate Travel inventory with
   its source group and exclusions before applying that purchase's effect.
   Capture it before an unresolved Twist result can stop that same action.
   Retained detail alone does not activate a refill.
3. At each purchased Twist, capture its result candidates before applying its
   outcome. Use the same bounded eligibility helper for the selected result and
   alternatives. Earlier actions contribute; later actions and the selected
   result itself do not.
4. Return findings, exact generation/result assessments and existing effects
   explicitly through the Well transition and chronology composition. Reuse
   the existing Well candidate surface keyed by occurrence and generation;
   replace its incorrect producer rather than add a parallel evaluator.
5. Missing/invalid results retain their repair candidates and do not apply an
   unresolved effect. Their finding chronology is the purchase, not room entry.
   An unreached purchase has no fabricated candidate context.

Keep initial and refill acquisitions on this one Well purchase path. Reuse
existing activation, slot-group, exclusion and Extended-item policies; this is
not permission to expand native item domains or change duration semantics.

### Presentation and repair

Overview retains item selection and Purchased membership. The existing
`Purchase Slot N Offer · Fateful Twist` or `Purchase Travel Deal Offer · Fateful
Twist` Timeline row gains a compact Result picker using the exact generation's
engine product. Remove the duplicate Overview result control.

Use the existing `stygianWellTwist` semantic owner for result findings. Navigation
and the inline finding border must point to the same Timeline control. Missing
or invalid results must not hide the row or prevent moving/removing purchases
inside the occurrence. Do not infer that every Well finding belongs to Timeline:
inventory findings still target Overview.

An unpurchased Twist requires no result. Clearing purchase may retain its
dormant result, but must not apply it, demand repair or publish its acquisition.
Restoring purchase revalidates it at the new position. Item replacement must
not attach an incompatible old result to a different item; same-item edits and
Undo preserve compatible authorship. Losing the Travel trigger retains dormant
inventory; a retained stale refill purchase remains visible and removable.

### Focused starting paths

Engine paths relative to `packages/planner-engine/src/`:

- `simulation/commerce/stygian-well.ts`
- `simulation/rewards/biome/lifecycle-transitions/room-entered.ts`
- `simulation/rewards/biome/encounter-acquisition/well-purchase.ts`
- `simulation/rewards/biome/chronology.ts` and its existing result assembly
- `authored-project/commands/occurrence/dispatch.ts` (Well cases)

Application paths relative to `apps/planner/src/`:

- `projections/structured-workspace/assembly/occurrence-features-assembly.ts`
- existing Timeline action assembly and semantic finding destinations
- `projections/structured-workspace/interactions/occurrence-interaction-binding.ts`
- `ui/editor/biome/commerce/RoomInventoryPanel.tsx` and its Timeline consumer

## Gate B — World Shop Travel inventory/acquisition separation

One engine/schema/application implementation commit; one schema bump.

### Saved carrier and dynamic slot

Reuse `ShopOfferState` in optional `ShopState.travelDealRefill`. Keep it outside
`offers`, initial profile slot counts and the Contract generation cohort.

- Inventory owns exact `optionKey`, reward identity and normal item-owned
  children. Share ordinary creation/decoding/replacement policy rather than
  copy a Mystery-specific implementation.
- Mystery inventory is identity-only. Its purchased source/traits use the
  existing `roomExit.pickupEntries.travelDealRefill` child and shared
  acquisition-entry reconciliation. Non-Mystery children stay on the slot;
  no duplicate full reward remains in pickup storage.
- Keep the existing Travel `interactAcquisitionEntry` action and position.
  Resolve its inventory through the Shop owner without creating a second
  pickup participant. Use the `shopOffer` address family with the reserved
  Travel key for inventory edits.

Travel is not a statically declared profile slot. One narrow Shop adapter must
resolve initial versus refill storage and separate structural checks from
dynamic support:

- Decoder/commands accept the optional slot and check known host-profile option
  identity, reward compatibility and child structure, not active source-group
  eligibility. They must not index a nonexistent static Travel profile slot or
  require an evaluated trigger before an edit can be represented.
- Candidate projection and settlement use `deriveTravelRefill`'s captured
  source-slot/group and post-trigger generation facts.
- Settlement validates the retained exact option against that capability and
  uses its exact rarity/lifecycle witness. A null option remains repairable;
  never select an arbitrary supporting witness. Ordinary and boosted Boons
  remain distinct wherever the source group permits both.

Mystery candidates use the later acquisition context, not frozen refill
generation facts. Clearing purchase keeps inventory and reconciles only its
Mystery child using the ordinary slot policy. Wire Travel insertion/removal
through `commands/room-actions.ts` as well as inventory replacement; generic
action removal currently does not run ordinary Shop child reconciliation.
No path may leave a child without its owning participant or duplicate it.

Overview authors inventory and Purchased; Timeline owns source/trait repair.
Removing/restoring the trigger preserves dormant inventory without publishing
it. A retained stale purchase remains addressable. Echo Gold Gold Gold stays a
free generated pickup, but its existing Travel source lookup reads the new
inventory owner.

### Schema and migration

Move saved ownership once with **schema 82 -> 83**. Gate A's existing Well
shape needs no migration. The focused offline migration must:

- move the old World Shop Travel entry to `shop.travelDealRefill`, preserving
  action order, keys, unresolved/null values and dormant inventory;
- split a purchased Mystery into identity-only inventory and the existing
  source/trait acquisition child; an unpurchased Mystery retains only inventory,
  matching ordinary Shop policy;
- move non-Mystery children without recomputing traits, targets or history;
- infer exact options only from unambiguous declaration evidence; use the
  existing null-option repair state for ambiguous ordinary/boosted identity;
- preserve Well and Shrine data unchanged, reject old/new carrier collisions,
  write a sibling output and never overwrite the input.

Keep strict current-schema decoding; no runtime compatibility reader or
simulation-based migration guessing.

### Focused starting paths

Engine: `authored-project/model.ts`, `shop.ts`,
`commands/occurrence/shop.ts`, `commands/room-actions.ts`,
`commands/acquisition/acquisition-site.ts`, `acquisition/acquisition-entry.ts`,
`room-state/decoding/shop-codec.ts`, `acquisition-site-codec.ts`, and
`simulation/rewards/shop/{derived-rewards,settlement}.ts`.

Application: `occurrence-shop-supplementals.ts`, `occurrence-reward-assembly.ts`,
ordinary `ShopOfferEditor`, and existing derived-entry interaction binding.
Migration: `schema/`, following the existing standalone scripts.

## Acceptance and primary test ownership

| Gate / primary owner                                                                                             | Acceptance                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: `packages/planner-engine/test/simulation/stygian-well.test.ts`                                                | A real ordered Well workflow buys Discount then Twist; Discount is excluded at Twist and an authored invalid result retains repair support. Reverse the order and it is eligible. Include a first-purchase Twist producing Discount: its earlier refill-generation domain must not inherit that result. Cover a Twist acquired from Travel and missing/unreached result contexts. |
| A: owning Well command/codec tests                                                                               | Purchase removal/restoration, same-item retention, incompatible replacement, dormant refill and Undo without ghost effects; unchanged saved shape round-trips.                                                                                                                                                                                                                    |
| A: `apps/planner/test/ui/editor/biome/StygianWellWorkbench.test.tsx`                                             | Through production commands/evaluation, choose Twist inventory with no result prompt, purchase it, resolve/repair from Timeline and navigate its finding to that same control. One initial/refill workflow, not duplicate policy matrices.                                                                                                                                        |
| B: `packages/planner-engine/test/authored-project/commands/occurrence-shop.test.ts`, Room Action and codec tests | Slot creation/replacement, identity-only Mystery, atomic membership/child reconciliation through actual insertion/removal commands, incomplete/dormant round-trip, no duplicate participant.                                                                                                                                                                                      |
| B: `infernal-contract-travel-deal.test.ts` and `shop-purchase-chronology.test.ts`                                | Post-trigger inventory versus pre-acquisition source context, exact option witness, unchanged source/exclusion/order policy and Echo source.                                                                                                                                                                                                                                      |
| B: `schema/migrate-project-82-to-83.test.js`                                                                     | Purchased/unpurchased Mystery, non-Mystery children, unresolved/dormant inventory, ambiguous identity, collisions and unchanged Well/Shrine state.                                                                                                                                                                                                                                |
| B: `apps/planner/test/ui/editor/biome/OccurrenceEncounterWorkbench.test.tsx`                                     | Real Travel purchase workflow: identity-only Overview selection, Timeline god/traits, meaningful earlier acquisition affecting that source domain, reopen/repair, clear/restore purchase and trigger, Undo and persist/reload.                                                                                                                                                    |
| Existing execution-product tests                                                                                 | Well initial/refill Twist and World Shop Mystery still publish their existing outcome/acquisition products. Unpurchased or dormant results publish no acquisition. Compare equivalent fully authored products where semantics did not change.                                                                                                                                     |

Use existing route fixtures/builders, not a new fixture per assertion. Unit
tests own the policy matrix; application tests own representative full repair
paths. Replace tests of room-entry Twist eligibility rather than preserve a
second policy. Do not manufacture unmodeled affordability/DD states to test
the native pool.

## Execution boundary, exclusions and closure

The game module and execution wire shapes are unchanged. Engine assembly reads
the corrected products and continues publishing inventory, refill source and
concrete acquisition/outcome facts. Corrected Well chronology may change
derived validity/support; it is not a behavior-preserving assertion about old
invalid plans. If an actually required fact cannot fit the existing wire,
stop for review rather than silently add a protocol redesign.

Hermes Shrines retain their existing inventory, Rush and delivery-acquisition
path. No new shop framework, event bus, scheduler, affordability ledger,
generic optional-payload relaxation, or migration of Wells/Echo/NPC pickups
into World Shop state.

Remove the old room-entry Twist/refill assessment path and Overview Twist editor
in Gate A. Remove World Shop Travel's combined-pickup inventory binding in Gate
B. Retain `EditDerivedShopEntry` only where still genuinely owned by Echo; no
Travel compatibility path or duplicate result editor.

For each gate, use one write-capable executor and a fresh read-only independent
reviewer after stabilization, with bounded remediation. The main session owns
Git, scope and closure. Run narrow owning tests during implementation; run one
complete repository gate and the repository performance comparison at final
closure. Do not repeat full suites just to generate review evidence.

Regenerate only semantically changed execution fixtures using repository
Prettier formatting; schema-only fixture changes use bounded migration. Update
the existing owning explanations in Reward/Authored Project/Workspace documents
and schema README only where these contracts change. Integrate the Well timing
evidence into its existing source audit, without bug-history paragraphs.
Delete this temporary plan at closure; leave the unrelated Postboss plan alone.
