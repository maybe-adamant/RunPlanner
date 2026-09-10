# Outcome-driven store execution plan

Status: locked for implementation  
Planner base: `b7be25edfeefaac163ef607b1465d33e28df31ca`  
Plan Executor base: `0f0599e4a34f279d2ebb2461fad7ec0073131f69`
Modpack base: `1c78803d42c6f539fce9af4def12d2c9c8f68624`

## Objective

Make the execution boundary describe intended outcomes rather than the native
gesture that produced them. A Boon, Hammer, Mystery Boon, direct item, level
effect, Spell, or Path acquisition must use the same execution transaction and
consumer whether it came from a room reward, generated pickup, World Shop, or
Hermes Shrine delivery.

Initial store inventory remains Overview-owned room content. Ordinary purchase,
payment, affordability, and purchase-counter observation leave the execution
contract. Missing an intended purchase is detected because its required outcome
transaction remains incomplete, not because the executor reimplements commerce.

Travel Deal is the sole store-specific runtime exception. It creates a new
inventory option dynamically, so the engine must publish the exact expected
refill position and payload. The runtime compares the native refill contact with
that product, steers the replacement, and settles one refill-realization owner.
It does not rediscover the first qualifying purchase.

## Locked boundary

The editable planner continues to author purchases because purchase order,
eligibility, cost-independent state transitions, Travel Deal, Extended, and
other game rules affect simulation. This plan changes only what survives the
validated planner-to-execution boundary.

```text
editable action and simulation
  -> complete-valid engine outcome
     -> execution acquisition / transformation / item effect
        -> native outcome terminal completes the owner
```

The source gesture is erased unless it creates a runtime structure that cannot
be represented by the resulting outcome. At present, only Travel Deal refill
realization satisfies that exception.

The following rules are locked:

1. The compiler trusts the complete-valid engine document. It does not infer
   that a reward was purchased from its address, encoded key, or native name.
2. Execution acquisition consumers match planner-published roles and payloads,
   never `shopPurchase` versus `acquisition` provenance.
3. One authored World Shop purchase publishes its intended outcome under the
   existing semantic owner. It does not publish a second purchase-proof owner.
4. If the player never produces the intended outcome, that owner remains
   incomplete at its declared checkpoint.
5. If another native source produces a compatible ready outcome, it may settle
   that owner. Equivalent outcomes are intentionally interchangeable at
   runtime; the executor does not adjudicate pedestal provenance.
6. An incompatible or unmodeled acquisition runs natively. It does not consume
   an intended owner. Existing named room-exit conformance may independently
   detect a modeled state difference.
7. No hook blocks or reverses a native purchase. A mismatch stops subsequent
   steering while normal gameplay continues.
8. Pool sales remain absent as individual execution transactions. Overview
   constrains their inventory and the room-exit trait delta proves the result.
9. The authored project schema does not change. This is an execution protocol
   change and receives one protocol-version bump after the closed wire shape is
   implemented.

## Source facts and chosen simplification

Native World Shop acquisitions already enter their ordinary outcome paths after
the cost guards accept interaction:

- `UseLoot` removes the paid world item before continuing into the ordinary
  trait screen;
- `OpenSpellScreen` removes the paid item before opening the Spell screen;
- `UseConsumableItem` accepts the interaction, removes the paid world item, and
  continues through the item's native effect sequence; and
- `RemoveStoreItem` owns World Shop first-purchase replacement and calls
  `RestockWorldItem` when Travel Deal applies.

Stygian Well effects run inside `HandleStorePurchase`. Hermes Shrine orders run
through `HandleSurfaceShopAction`; the game owns their pending-delivery clock and
the delivered object later uses the ordinary acquisition path.

The planner already validates which purchase and refill sequence is legal.
Consequently, the executor does not need gold, affordability, purchase counters,
or exact purchase provenance. The chosen simplification is to prove the native
result, with one explicit structural witness for Travel Deal's dynamic refill.

### Paid direct consumables

Paid direct consumables do not require a commerce transaction. Max Health,
Max Magick, Armor, healing, Gold, ordinary Nectar, and comparable World Shop
objects use the same native `UseConsumableItem` function as free world pickups.
The native function performs its cost and requirement guards before
`ConsumableUsedPresentation`, removes the paid store object inside the accepted
sequence, applies the item's fields and use functions, and then returns.

Their source-independent execution terminal is therefore:

```text
enter UseConsumableItem
  -> native guards accept
  -> ConsumableUsedPresentation claims the compatible ready acquisition
  -> native payment/removal and item effects run without executor inspection
  -> UseConsumableItem returns
  -> complete the acquisition owner
```

The transaction does not complete at `RemoveStoreItem`. A rejected or
unaffordable attempt never reaches the acceptance contact and leaves the outcome
owner incomplete. An exception after acceptance also leaves it incomplete.
Specialized consumables retain their more precise terminals: direct-level
Nectar completes at the level mutation, Talent Drops at the Path screen,
Mystery Boons after their trait selection, and Anvil through its transformation
adapter.

### Shop acquisition settlement parity

This matrix is exhaustive for the option identities declared by `WorldShop`,
`I_WorldShop`, `Q_WorldShop`, and `SurfaceShop`. Early/late Hammer entries and
boosted Boon entries are grouped because they differ in Shop eligibility or
offer construction, not acquisition settlement.

| Declared Shop option identities                                        | Result acquired by the player               | Matching non-Shop acquisition family         | Source-independent settlement terminal                                                                   |
| ---------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `RandomLoot`, `BoostedRandomLoot`                                      | resolved ordinary-god Boon                  | ordinary Boon room reward or generated Boon  | selected trait settles and the ordinary trait screen closes                                              |
| `ShopHermesUpgrade`                                                    | `HermesUpgrade` trait offer                 | ordinary Hermes reward                       | selected trait settles and the ordinary trait screen closes                                              |
| `WeaponUpgradeDropEarly`, `WeaponUpgradeDropLate`, `WeaponUpgradeDrop` | `WeaponUpgrade` Hammer offer                | ordinary Hammer reward                       | selected Hammer settles and the ordinary trait screen closes                                             |
| `BlindBoxLoot`                                                         | Mystery Boon, then its hidden god and trait | generated, NPC, or delivered Mystery Boon    | box unwrap binds the provider; selected trait settles and the screen closes                              |
| `StackUpgrade`, `StackUpgradeBig`                                      | visible Pom target and level count          | ordinary Pom reward                          | selected level result settles and the Pom screen closes                                                  |
| `StoreRewardRandomStack`                                               | one Pom Slice level mutation                | generated or direct Pom Slice                | the published target settles at `AddStackToTraits`                                                       |
| `SpellDrop`                                                            | ordered Hex offer                           | ordinary Spell Drop                          | selected Hex settles and the Spell screen closes                                                         |
| `TalentDrop`                                                           | Path of Stars points                        | ordinary Talent Drop                         | published Path result settles when the Talent screen closes                                              |
| `MaxHealthDrop`, `MaxHealthDropBig`                                    | Max Health increase                         | ordinary Max Health pickup                   | accepted `UseConsumableItem` returns after native mutation                                               |
| `MaxManaDrop`, `MaxManaDropBig`                                        | Max Magick increase                         | ordinary Max Magick pickup                   | accepted `UseConsumableItem` returns after native mutation                                               |
| `RoomRewardHealDrop`, `HealBigDrop`                                    | healing                                     | ordinary healing pickup                      | accepted `UseConsumableItem` returns after native mutation                                               |
| `ArmorBoost`, `ArmorBigBoost`                                          | Armor increase                              | ordinary Armor pickup                        | accepted `UseConsumableItem` returns after native mutation                                               |
| `LastStandDrop`                                                        | Death Defiance restoration                  | ordinary Death Defiance pickup               | accepted `UseConsumableItem` returns after native mutation                                               |
| `GiftDrop`                                                             | Nectar acquisition                          | ordinary Nectar pickup                       | accepted `UseConsumableItem` returns; any published level child settles separately at its level mutation |
| `MetaCardPointsCommonDrop`, `MetaCurrencyDrop`                         | Ashes or Bones                              | ordinary matching resource pickup            | accepted `UseConsumableItem` returns after native mutation                                               |
| `WeaponPointsRareDrop`, `CardUpgradePointsDrop`, `CharonPointsDrop`    | Nightmare, Moon Dust, or Obol Points        | ordinary matching resource pickup            | accepted `UseConsumableItem` returns after native mutation                                               |
| `ChaosWeaponUpgrade`                                                   | Anvil removal plus two Hammer additions     | no separately declared normal-pickup carrier | the Anvil transformation settles at its native transformation terminal                                   |

The final row is an acquisition-carrier exception, not a commerce exception:
Anvil has no normal-pickup comparison in the supported catalog, but payment
still does not settle it. Supplemental World Shop slots created by Infernal
Contract, Travel Deal, or Echo Gold Gold Gold contain one of the same option
identities and therefore use the same row. Travel Deal additionally settles its
separate refill-realization owner when that dynamic slot is created.

## Execution matrix

| Authored result                                      | Published execution product                  | Runtime completion owner                                                                 |
| ---------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Room, generated, NPC, Shop, or delivered Boon/Hammer | ordinary trait acquisition                   | ordinary trait screen terminal                                                           |
| Mystery Boon from any supported source               | box/provider/trait acquisition               | Mystery adapter after the selected trait settles                                         |
| Visible Pom or direct random-level effect            | level acquisition                            | corresponding level-selection or mutation terminal                                       |
| Spell or Path of Stars result                        | Spell/Path acquisition                       | selected Spell or completed Path screen terminal                                         |
| Direct consumable or resource                        | direct acquisition                           | accepted native use after the native effect sequence returns                             |
| World Shop Anvil                                     | Anvil transformation                         | native Hammer transformation terminal                                                    |
| Stygian Well Twist                                   | random-item transformation                   | native Twist award terminal                                                              |
| Other Stygian Well item                              | item-effect outcome                          | accepted native item-effect terminal; named retained state remains room-exit conformance |
| Purging Pool sale                                    | no Timeline transaction                      | room-exit trait-inventory delta                                                          |
| Hermes Shrine order                                  | no purchase transaction                      | later delivered outcome owns its ordinary acquisition transaction                        |
| Echo-generated item                                  | ordinary acquisition                         | applicable acquisition terminal                                                          |
| Infernal Contract's native deterministic trait       | automatic/state outcome or named conformance | native game behavior; Gate A must retain one existing engine-owned proof                 |
| Travel Deal replacement in Shop, Well, or Shrine     | Travel Deal refill realization               | exact native refill position and payload contact                                         |
| Acquisition of a Travel Deal replacement             | its ordinary outcome product                 | applicable acquisition/transformation/item-effect terminal                               |

An authored but unpurchased inventory row has no execution outcome. An authored
purchased row has the outcome product required by the table. The executor never
needs a `purchased` flag to distinguish those cases because publication has
already omitted every untouched optional action.

## Travel Deal product

The engine must promote one complete Travel Deal refill-realization product for
each expected dynamic replacement. It is a closed carrier union with the exact
facts already known by simulation:

```text
owner
occurrence
carrier: worldShop | stygianWell | hermesShrine
source position/generation
replacement position/generation
expected option identity and normalized payload
lifecycle window and obligation checkpoint
```

The runtime behavior is deliberately small:

| Native observation                              | Result                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| Expected refill occurs at the expected position | constrain it to the published option and complete the refill owner |
| Refill occurs at another position               | record a mismatch and leave the owner incomplete                   |
| Expected refill never occurs                    | the refill owner fails its room checkpoint                         |
| No refill is published and World Shop invokes its dedicated refill callback | record an unexpected-refill mismatch                    |
| Refilled item is later acquired                 | its separate outcome transaction handles it normally               |

The execution graph contains no source-purchase node, competitor-purchase
barriers, or refill-purchase node. The planner remains the sole authority that
determines the first qualifying purchase. The executor only checks the resulting
replacement contact.

## Ownership and intended deletions

### Planner engine

`packages/planner-engine` owns the semantic projection from validated timeline
actions to execution outcomes.

- Replace the `shopPurchase` wire transaction with the same source-agnostic
  acquisition transaction used by non-Shop acquisitions.
- Preserve the existing semantic owner and meaningful same-room outcome
  dependencies. Do not create parallel purchase and acquisition owners.
- Publish Anvil as a transformation outcome rather than a commerce transaction.
- Publish Well items as item-effect outcomes; publish Twist through its exact
  transformation result.
- Promote the exact three-carrier Travel Deal refill-realization product from
  existing simulation facts. The compiler copies it without choosing its
  source, position, or replacement.
- Remove execution-only first-purchase and competing-purchase dependency edges.
  Planner simulation and authored validation retain their existing policy.
- Remove `shopPurchase` and `wellPurchase` from the execution wire once every
  concrete consumer has moved. Do not retain compatibility aliases or dual
  shapes.
- Keep `wellRefill` only until the generalized Travel Deal refill product fully
  replaces it in the same gate.

Primary engine owners are the execution-plan model, assembly, codec, validation,
and their neighboring tests. Catalog declarations and editable authored state
are inputs, not change targets unless implementation exposes a missing engine
fact.

### Room features

Executor room features continue to own initial Shop, Well, Shrine, and Pool
presence and inventory. They may stamp native objects with opaque correlation
data needed by a later outcome consumer, but they do not begin or complete a
Timeline owner merely because an item spawned.

Travel Deal's refill actuator belongs beside inventory realization because it
creates inventory. It consumes only the published refill-realization product.

### Timeline outcomes

- Acquisition adapters own trait, Mystery, level, Spell, Path, and direct-use
  outcomes regardless of source.
- Anvil moves from commerce to transformations.
- Twist moves from commerce to transformations.
- Well-native retained or immediate effects live in an item-effect outcome
  neighborhood even when their native contact is `HandleStorePurchase`.
- An adapter may use the native item identity and published payload to claim one
  compatible ready owner. It must not ask which store or producer supplied it.

### Commerce deletion target

The broad executor commerce coordinator is superseded. Delete, rather than
leave unreachable:

- World Shop purchase-counter and exact-purchase comparison;
- `shopBinding` and `completesAtPurchase` policy;
- ordinary `RemoveStoreItem` transaction completion;
- non-Travel Shrine purchase/rush mismatch checks;
- `WellPurchases` and `StoreItemsPurchased` delta checks;
- transaction-kind branches that exist only to distinguish purchase from
  pickup; and
- commerce-owned Anvil and Twist wiring after their outcome adapters move.

If a small composition module remains because several native store hooks share
one physical callback, it must be named and organized by that callback boundary,
not retain commerce semantics or purchase policy.

## Delivery gates

### Gate A — engine outcome publication

One planner-engine commit establishes the final wire product.

Deliverables:

- source-agnostic acquisition publication for every World Shop acquisition
  family currently carried by `shopPurchase.roles`;
- explicit Anvil transformation and Well item-effect/Twist products;
- one explicit three-carrier Travel Deal refill-realization union;
- removal of purchase-proof transactions and execution-only first-purchase
  edges;
- codec, validation, and protocol-version update with no dual decoder; and
- refreshed planner-owned execution fixtures for representative Underworld and
  Surface routes.

Acceptance:

- room reward and World Shop versions of the same Boon, direct item, level item,
  Mystery Boon, Spell, and Path result expose the same consumer-facing role
  shape;
- an authored World Shop outcome publishes exactly one executable owner;
- untouched Shop inventory publishes no outcome transaction;
- every currently published `shopPurchase` and `wellPurchase` family is mapped
  to a concrete outcome product or an already-existing named conformance fact;
  no purchase family is silently dropped;
- Anvil and Twist do not appear as commerce/purchase transactions;
- each World Shop, Well, and Shrine Travel Deal fixture carries one exact refill
  realization and no source/competitor purchase nodes;
- meaningful trait/acquisition ordering dependencies remain valid with no
  dangling owners; and
- authored-project encode/decode remains byte-compatible because its schema did
  not change.

Primary validation: focused execution assembly/codec/fixture tests,
`npm run test:engine`, typecheck, lint, format check, and diff check.

### Gate B — executor outcome consumers and refill actuator

One Plan Executor commit consumes Gate A's closed product and removes the old
purchase-observation path.

Deliverables:

- decoder support for the new closed transaction union only;
- source-agnostic unbound and pre-bound claims for every acquisition family;
- Anvil and Twist moved to transformation ownership;
- Well item-effect completion without purchase counters or cost verification;
- one Travel Deal refill actuator for the three carrier variants;
- Shrine delay configuration retained without ordinary purchase verification;
- deletion of superseded commerce modules, helpers, tests, and hook tags; and
- no change to mismatch behavior that could block or return early from gameplay.

Acceptance:

- the same acquisition consumer settles equivalent room-reward, World Shop, and
  delivered carriers;
- paid and free Max Health and Armor witnesses use the same direct-acquisition
  consumer, claim only after native guards accept, and complete only after
  `UseConsumableItem` returns;
- an unaffordable or otherwise rejected paid consumable does not begin or
  complete its intended acquisition;
- an intended outcome not produced remains incomplete at the room checkpoint;
- an incompatible native outcome does not consume the intended owner;
- an equivalent compatible outcome may consume it without a provenance
  mismatch;
- World Shop and Well tests contain no purchase-counter assertions;
- delayed and rushed Shrine deliveries are settled only by their eventual
  acquisition outcomes;
- correct, wrong-position, and missing Travel Deal refill cases are covered for
  World Shop, Well, and Shrine; World Shop additionally covers an unexpected
  refill through its dedicated native callback, while generic Well and Shrine
  purchase contacts remain pass-through when no refill is published;
- Anvil and Twist retain their existing steering behavior after relocation; and
- no removed purchase transaction survives in protocol fixtures or runtime
  indexes.

Primary validation: focused acquisition, transformation, inventory, Travel
Deal, protocol, and room-session suites; `lua tests/all.lua`; `luacheck src/`;
and diff check.

### Gate C — cross-repository closure

One closure commit in the planner and one submodule-pointer commit in the
modpack finish the phase.

Deliverables:

- byte-for-byte shared fixture agreement at the final protocol version;
- durable documentation corrected to describe outcome execution rather than
  purchase observation;
- this temporary plan removed after its decisions are absorbed;
- no stale protocol-version comments, hook tags, commerce tests, or compatibility
  paths; and
- local publish/decode smoke plus one bounded in-game route containing a normal
  Shop acquisition, Well effect, Shrine delivery, Anvil or Twist, and Travel
  Deal refill before phase closure.

Update at minimum:

- `docs/design/GAME_INTEGRATION_BOUNDARY.md`;
- `docs/audits/rooms-and-routes/GAME_EXECUTION_TIMELINE_RECONCILIATION_AUDIT.md`;
- `docs/audits/game-execution-contacts/REWARDS_AND_ITEMS.md`;
- `docs/audits/game-execution-contacts/DIRECT_PICKUP_ACQUISITION_EXECUTION.md`;
  and
- the Plan Executor README only if its user-facing behavior materially changes.

Run the complete planner repository gate once at phase closure. Do not rerun it
after every executor-only adjustment.

## Adversarial review requirements

Each implementation gate uses a fresh executor and an independent read-only
reviewer. Reviews must specifically challenge:

- whether the compiler derived purchase meaning instead of copying an engine
  product;
- whether one authored action accidentally produced both a purchase and outcome
  obligation;
- whether a removed purchase dependency left a meaningful outcome dependency
  dangling;
- whether an outcome consumer still switches on source transaction kind;
- whether Travel Deal logic started rediscovering first-purchase eligibility;
- whether native callback nesting can leave an outcome unclaimable;
- whether wrong or omitted outcomes remain detectable at the correct room
  checkpoint; and
- whether the diff adds a compatibility layer instead of deleting the old path.

The main session owns final cross-repository review and all commits.

## Explicit non-goals

- No editable-project schema change or migration.
- No gold, price, affordability, resource-cost, or purchase-counter simulation.
- No enforcement that the player used a particular physical pedestal when an
  equivalent ready outcome was produced.
- No executor reconstruction of Shop eligibility, Travel Deal first-purchase
  policy, Extended, Yarn, Hymn, or retained-effect simulation.
- No Pool sale callback transaction.
- No Hermes Shrine clock implementation; the native game retains the clock.
- No cross-room action dependencies.
- No generic event bus, transaction scheduler, source-search algorithm, or
  compatibility decoder.
- No broader refactor of navigation, encounters, conformance, or the editable
  planner timeline.
