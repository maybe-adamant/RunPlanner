# I/Q World Shop Phase Game-Data Audit

## Status and scope

This is an implementation-free source audit of the first- and second-half
inventory rules for `I_WorldShop` and `Q_WorldShop`. It records the complete
phase-sensitive option matrices so a later implementation plan can consume
settled facts without rereading game data.

The audit answers:

1. what `InRunFirstHalf` and `InRunSecondHalf` mean;
2. which exact I/Q Shop entries each predicate controls;
3. which entries remain possible in both halves;
4. which rarity-bearing options the boon rarity ledger later consumes; and
5. which additional Dream Run condition remains separate from biome order.

It does not implement Dream Dive, change Shop authoring, model probability
weights, or define the boon rarity ledger. The shared Shop settlement boundary
remains owned by
[Acquisition Delivery and Room Settlement](../rewards-and-acquisition/ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md), and
the rarity arithmetic remains owned by the
[boon rarity ledger audit](../traits/BOON_RARITY_LEDGER_GAME_DATA_AUDIT.md).

The evidence was checked on 2026-08-22 against the installed Hades II scripts:

- `StoreData.lua`, especially `I_WorldShop` and `Q_WorldShop`;
- `RequirementsData.lua`, especially `InRunFirstHalf` and
  `InRunSecondHalf`;
- `StoreLogic.lua`, especially `FillInShopOptions` and
  `RunShopGeneration`; and
- `LootData.lua`, `LootData_Hermes.lua`, and `StoreLogic.lua` for the ordinary,
  boosted, and Hermes boon-item identities.

## The phase fact is entered-biome history

The named requirements are exact numeric predicates over
`CurrentRun.EnteredBiomes`:

```text
InRunFirstHalf  = EnteredBiomes <= 2
InRunSecondHalf = EnteredBiomes > 2
```

The count includes the biome currently being entered before its structural
World Shop inventory is generated. The rule is not keyed to literal biome I or
Q and does not ask whether the biome is fourth in a configured route.

In the ordinary routes, I and Q are fourth, so only their second-half options
can materialize. A reordered run can reach the same Shop profile in the first
half, in which case its first-half entries replace the phase-specific
second-half entries while the phase-independent entries remain.

The planner already has an `enteredBiomes` requirement axis and supplies the
reached count to reward and Shop requirement evaluation. This audit identifies
an existing fact for Shop declarations to consume; it does not justify another
lifecycle counter or a Shop-local approximation.

## Inventory construction

Both profiles are ordered collections of option groups. Each group filters its
entries by requirements and then emits its declared number of options without
replacement. Positive weights select among eligible possibilities but do not
remove a positive-weight option from the planner's possibility domain.

The phase predicates belong to individual option entries. They do not select
one monolithic early or late Shop profile, and they do not change the number of
groups or authored slots:

| Profile       | Groups | Total offers | Special cardinality                      |
| ------------- | -----: | -----------: | ---------------------------------------- |
| `I_WorldShop` |      5 |            5 | One offer from every group               |
| `Q_WorldShop` |      5 |            6 | Two distinct offers from the first group |

Every phase-gated entry retains its other requirements. For example, phase
eligibility does not waive Hammer history, Hermes history, Spell state, Pom
targets, Last Stand inventory, or current-Shop exclusion.

## I World Shop

### Complete phase matrix

| Group | Offers | First-half-only entries                           | Second-half-only entries                                                                             | Entries available in either half                                                                        |
| ----- | -----: | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1     |      1 | `RandomLoot`                                      | `BoostedRandomLoot`, `StackUpgradeBig`                                                               | none                                                                                                    |
| 2     |      1 | none                                              | none                                                                                                 | `RandomLoot`, `BlindBoxLoot`, `MaxHealthDrop`, `MaxManaDrop`, `StackUpgrade`, `TalentDrop`, `SpellDrop` |
| 3     |      1 | `RoomRewardHealDrop`, `ArmorBoost`                | `HealBigDrop`, `ArmorBigBoost`                                                                       | `LastStandDrop`                                                                                         |
| 4     |      1 | `WeaponUpgradeDrop`, `RandomLoot`, `BlindBoxLoot` | `ShopHermesUpgrade`, `ChaosWeaponUpgrade`, `BoostedRandomLoot`, `MaxHealthDropBig`, `MaxManaDropBig` | none                                                                                                    |
| 5     |      1 | none                                              | none                                                                                                 | standard/Dream-run alternatives described separately below                                              |

The first group therefore changes from one ordinary boon possibility in the
first half to either a boosted boon or a Big Pom in the second half. The second
group always retains an ordinary boon possibility and its other progression
options, independent of phase.

## Q World Shop

### Complete phase matrix

| Group | Offers | First-half-only entries            | Second-half-only entries                                                                             | Entries available in either half                                                        |
| ----- | -----: | ---------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1     |      2 | `StackUpgrade`                     | `BoostedRandomLoot`, `StackUpgradeBig`                                                               | `RandomLoot`, `BlindBoxLoot`, `MaxHealthDrop`, `MaxManaDrop`, `TalentDrop`, `SpellDrop` |
| 2     |      1 | `RandomLoot`                       | `HealBigDrop`, `ArmorBigBoost`                                                                       | none                                                                                    |
| 3     |      1 | `RoomRewardHealDrop`, `ArmorBoost` | `HealBigDrop`, `ArmorBigBoost`                                                                       | `LastStandDrop`                                                                         |
| 4     |      1 | `WeaponUpgradeDrop`, `RandomLoot`  | `ShopHermesUpgrade`, `ChaosWeaponUpgrade`, `BoostedRandomLoot`, `MaxHealthDropBig`, `MaxManaDropBig` | none                                                                                    |
| 5     |      1 | none                               | none                                                                                                 | standard/Dream-run alternatives described separately below                              |

`RandomLoot` and `BlindBoxLoot` each have separate first- and second-half
source rows in Q's first group because their probability weights change. Their
semantic identity and non-phase requirements do not change. In a possibility
model that deliberately omits weights, each is one option available in either
half; the duplicate source rows must not become duplicate authored choices.

Q still emits two distinct options from its first group. Phase filtering occurs
before that without-replacement selection, so the exact eligible domain for
both positions comes from the same reached `EnteredBiomes` value.

## Rarity-bearing contacts

The phase predicate does not directly modify every boon generated in an I/Q
Shop. It changes which exact Shop item can materialize:

- `RandomLoot` uses the ordinary selected provider's base rarity ledger;
- `BoostedRandomLoot` carries the sparse boosted item override; and
- the I/Q `ShopHermesUpgrade` entry is second-half-only and declares
  `UpgradeChance = 1.0`, so its concrete Hermes offer always receives the
  boosted item override.

I and Q do not declare a room-wide boon rarity override. An ordinary
`RandomLoot` option in either profile remains ordinary even when another slot
can contain `BoostedRandomLoot`. The rarity authority should consume the exact
generated item identity rather than infer a boost from the Shop profile, biome
key, or entered-biome count.

This separates responsibilities cleanly:

```text
entered-biome history
  -> Shop option eligibility and exact generated item
  -> item-owned rarity override
  -> trait-offer rarity ledger
```

## Dream Run group-five switch is a separate condition

The fifth group in both profiles is not controlled by `EnteredBiomes`:

- outside a Dream Run, progression permitting, it contains
  `WeaponPointsRareDrop`, `CardUpgradePointsDrop`, and `CharonPointsDrop`; and
- during a Dream Run, those three entries are rejected and `ElementalBoost` is
  the supported alternative.

The current planner deliberately excludes `ElementalBoost` and has no authored
Dream Run mode. Correcting first-/second-half eligibility will make groups one
through four order-sensitive, but it will not by itself make the complete Shop
inventory Dream-Dive-faithful. A future Dream Dive slice must supply the
separate `IsDreamRun` fact and settle `ElementalBoost` before claiming complete
group-five support.

This distinction prevents `EnteredBiomes > 2` from being used as a proxy for
Dream Run identity.

## Current planner discrepancy

The normalized catalog currently declares the ordinary-route second-half I/Q
possibility domains unconditionally:

- second-half options do not carry `enteredBiomes > 2` requirements;
- first-half-only options are absent from the affected groups; and
- group five always exposes the supported non-Dream rare-resource projection.

That is correct for the current fixed routes, where I and Q are fourth. It is
not a reusable Shop model for reordered biomes. In particular, an early I/Q
Shop would currently retain late boosted, Big, Chaos-Hammer, and Hermes options
while omitting its legal early ordinary, small, and Hammer alternatives.

The existing requirement system already supports the exact correction through
`counterRange` over `enteredBiomes`. The source does not require a new phase
enum, persisted Shop mode, route-index lookup, literal I/Q conditional, or
React-side filter.

## Stable source facts

1. First half means `EnteredBiomes <= 2`; second half means
   `EnteredBiomes > 2`.
2. The predicate is evaluated at Shop inventory generation from reached run
   history.
3. Phase eligibility belongs to individual I/Q option entries; group and slot
   cardinality remain fixed.
4. Q group one emits two distinct eligible options without replacement.
5. Positive weights change probability, not possibility. Q's phase-specific
   duplicate `RandomLoot` and `BlindBoxLoot` rows therefore share one semantic
   option identity in the planner.
6. All non-phase requirements remain conjunctive with the phase guard.
7. `BoostedRandomLoot` owns its rarity override. I/Q Shop identity alone does
   not boost an ordinary boon.
8. The I/Q `ShopHermesUpgrade` is second-half-only and always boosted.
9. Dream Run group-five replacement is independent of the first-/second-half
   predicate.

## Planner disposition

The Gate-A correction makes the complete phase-sensitive I/Q option matrices
consume the existing chronological `enteredBiomes` requirement fact. The
exact generated option remains the sole authored Shop identity and keeps all
existing option-specific requirements, purchase interaction, acquisition
lifecycle, and without-replacement behavior. Catalog version
`0.29.0-world-shop-phase` records the normalized-fact change while the
authored document schema remains 50.

Current standard routes retain the same second-half inventories. Gate-A
order-independence evidence establishes:

- an I/Q Shop reached at count one or two exposes only its first-half entries
  plus phase-independent entries;
- the same profile reached at count three or greater exposes only its
  second-half entries plus phase-independent entries;
- Q's first group still produces two distinct choices from the filtered
  domain;
- phase-ineligible authored options remain structurally representable and
  receive normal contextual invalidity/repair evidence rather than being
  deleted during decode; and
- no ordinary `WorldShop` option changes merely because F, G, N, or P is
  reached later.

The landed catalog `0.30.0-boon-rarity-ledger` and its engine-owned rarity
ledger consume the exact `RandomLoot`, `BoostedRandomLoot`, or boosted Hermes
item produced by this Shop authority at the trait-offer frontier. The ledger
does not reevaluate Shop phase eligibility or infer the item context from the
Shop profile, biome key, or count; the option witness remains the source of
truth.

The live fixed-route evaluator currently supplies `biomeIndex + 1` as
`enteredBiomeCount`, which is equivalent to the entered-biome count for the
supported fixed-order routes. A future Dream Dive implementation must change
that fact producer to supply the actual reordered reached count through the
existing engine input; it must not change the I/Q Shop declarations.

The earlier phase correction made no planner-engine or application production
change. The existing engine candidate, finding, structural decode, and repair
paths remain the authorities for retained phase-ineligible offers and joint Q
unavailability.

## Explicit non-goals

This audit does not require:

- Dream Dive route construction or biome reordering;
- an `IsDreamRun` authored input or `ElementalBoost` implementation;
- probability weights or deterministic Shop RNG;
- prices, affordability, discounts, or rerolls;
- external progression/save predicates that remain outside the planner;
- Stygian Well or Shrine of Hermes implementation.
