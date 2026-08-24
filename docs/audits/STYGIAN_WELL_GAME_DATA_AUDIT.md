# Stygian Well Game-Data Audit

## Status and scope

This is an implementation-free source audit for the Well of Charon, called the
Stygian Well in player-facing discussion. It records the live `RoomShop`
inventory, physical appearance, interaction timing, purchase behavior, and the
subset of effects that changes the planner's modeled run state. It does not
define planner schema, commands, simulation APIs, UI, delivery gates, or an
implementation sequence.

The evidence was refreshed on 2026-08-24 against the installed Hades II
scripts. Primary sources are:

- `StoreData.lua:14-118` and `StoreLogic.lua:436-438, 1101-1201`;
- `TraitData_Store.lua:15-510` and `ConsumableData.lua:944-955,
1202-1529`;
- `RoomData.lua:572-587`, `RequirementsLogic.lua:1231-1254`, and
  `RoomLogic.lua:4056-4069, 4891-4918`; and
- `TraitLogic.lua:1766-1807`, `UpgradeChoiceLogic.lua:1124-1141`, and
  `ROUTE_DETOUR_FINDINGS.md` and `BOON_RARITY_LEDGER_GAME_DATA_AUDIT.md`
  for the already-audited downstream rules.

`SHOP_AND_WELL_INTERACTION_LIFECYCLE.md` owns the shared room-interaction
chronology. This focused audit owns the complete Well pool and its disposition.

## Appearance, physical realization, and interaction boundary

The base Well declaration has `WellShopSpawnChance = 0.15`, requires the Well
upgrade, biome depth at least three, an underworld route, and a run-depth gap
of at least four from `LastWellShopDepth`. Thus three intervening rooms
separate two ordinary Wells. A realized Well also needs an available physical
`ChallengeSwitchBase`; `HandleSecretSpawns` claims that slot and records the
current depth. Forced Wells share that later spacing history.

The ordinary host family is F/G/H/I; I overrides its inherited chance to
`0.08`. F/G/H each declare a forced Postboss Well, conditional on
`WorldUpgradePostBossWellShops`; the installed I declarations have no matching
forced Postboss Well. See `RoomDataF.lua:2561-2640`,
`RoomDataG.lua:1053-1123`, `RoomDataH.lua:1900-1986`, and
`RoomLogic.lua:4891-4905`.

The obstacle is present during room setup but locked through combat.
`DoUnlockRoomExits` first completes outgoing generation, then makes the Well
usable (`RoomLogic.lua:4056-4061`). A purchase therefore cannot alter doors
or rewards already generated in the host room:

```text
enter and materialize Well inventory
  -> resolve encounter and incoming reward
  -> generate outgoing exits
  -> unlock Well; make zero or more purchases
  -> enter selected next room
```

`HandleStorePurchase` applies a successful purchase immediately. This says
nothing about gold affordability or numerical combat, health, Magick, or
meta-resource results; those are separate facts and are deliberately deferred
unless noted below.

## Inventory and purchase facts

`RoomShop` has at most three offers. It first requests exactly one member of
the eight-entry healing/defensive weighted group, then fills remaining
available slots from its ten traits and seven consumables
(`StoreData.lua:14-88`). The following is the complete live, 25-identity pool;
individual game-state and purchase requirements still determine whether an
identity is eligible on a particular visit.

| Identity                                          | Exact game effect                                                                               | Current planner disposition                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `ArmorBoostStore`                                 | Grants 20 armor.                                                                                | Defer: armor/combat state.                                                          |
| `DamageSelfDrop`                                  | Pays gold for 10–30 health damage, at 1.1–1.8 gold per health.                                  | Defer: health and economy.                                                          |
| `HealDropRange`                                   | Heals 21–39% of maximum health.                                                                 | Defer: health.                                                                      |
| `EmptyMaxHealthShopItem`                          | Adds 25 maximum health without healing.                                                         | Defer: health.                                                                      |
| `FirstHitHealTrait`                               | The next hit heals 100% of its damage; stacking adds uses.                                      | Defer: health/combat.                                                               |
| `TemporaryDoorHealTrait`                          | Heals 10% of maximum health after each of the next three room transitions.                      | Defer: health.                                                                      |
| `TemporaryHealExpirationTrait`                    | After four encounters, heals 50% of maximum health on expiry.                                   | Defer: health.                                                                      |
| `LastStandShopItem`                               | Adds a distinct Last Stand that restores 40% health and Magick.                                 | Consequential: existing Last Stand capacity; defer health/Magick values.            |
| `TemporaryImprovedSecondaryTrait`                 | Multiplies secondary damage by 1.40 for five encounters.                                        | Defer: combat.                                                                      |
| `TemporaryImprovedCastTrait`                      | Multiplies Cast damage by 1.35 for five encounters.                                             | Defer: combat.                                                                      |
| `TemporaryMoveSpeedTrait`                         | Multiplies movement speed by 1.20 for eight encounters.                                         | Defer: combat/movement.                                                             |
| `TemporaryBoonRarityTrait` (Yarn of Ariadne)      | Gives one eligible God-loot offer +1.0 Rare, +0.25 Epic, +0.10 Duo, and +0.10 Legendary chance. | Consequential: rarity ledger.                                                       |
| `TemporaryImprovedExTrait`                        | Multiplies Omega damage by 1.50 for six encounters.                                             | Defer: combat.                                                                      |
| `TemporaryImprovedDefenseTrait`                   | Multiplies incoming health damage by 0.90 for five encounters.                                  | Defer: combat/health.                                                               |
| `TemporaryDiscountTrait`                          | Multiplies Store costs by 0.70 for six encounters.                                              | Consequential only for later Well eligibility; defer economy.                       |
| `TemporaryForcedSecretDoorTrait` (Spark of Ixion) | Adds one forced secret-door use.                                                                | Consequential: Chaos topology.                                                      |
| `TemporaryEmptySlotDamageTrait`                   | Triples damage for six encounters while a core slot is empty.                                   | Consequential only for later Well eligibility; defer combat.                        |
| `ExtendedShopTrait`                               | Makes the next whitelisted temporary Well trait last for two boss uses.                         | Consequential when extending either eligibility-blocking trait; otherwise deferred. |
| `MetaCurrencyRange`                               | Grants 20–40 Bones.                                                                             | Defer: meta resource.                                                               |
| `MetaCardPointsCommonRange`                       | Grants 6–12 Ashes.                                                                              | Defer: meta resource.                                                               |
| `MemPointsCommonRange`                            | Grants 20–30 Psyche.                                                                            | Defer: meta resource.                                                               |
| `SeedMysteryRange`                                | Grants two Mystery Seeds.                                                                       | Defer: meta resource.                                                               |
| `RandomStoreItem`                                 | Immediately awards one eligible item from a closed nine-trait/seven-consumable nested pool.     | Consequential for nested Yarn, Discount, or Last Stand outcomes.                    |
| `LimitedManaRegenDrop`                            | Regenerates 500 Magick over three seconds.                                                      | Defer: Magick.                                                                      |
| `LimitedSwapTraitDrop` (Sacrificial Hymn)         | Adds one forced-replacement use; its replacement gains two levels and the next rarity tier.     | Consequential: next eligible trait offer.                                           |

The raw effects and values are declared in `TraitData_Store.lua:15-510` and
`ConsumableData.lua:944-955, 1202-1529`. The table's disposition is a planner
scope decision, not a claim that the deferred identities are mechanically
identical or unavailable in the game.

`RandomStoreItem` chooses one currently eligible identity from a separate
nine-trait/seven-consumable nested pool (`ConsumableData.lua:1490-1529`; award
logic in `StoreLogic.lua:1366-1411`). That nested trait list includes
`TemporaryBoonRarityTrait`, `TemporaryDiscountTrait`, and `LastStandShopItem`,
so Twist can produce any of those consequential states. It does not list
Spark, Sacrificial Hymn, `TemporaryEmptySlotDamageTrait`, or
`ExtendedShopTrait`. Its other possible results remain deferred under the
table above.

Travel Deal (`FirstPurchaseDiscount`) affects a Well's first purchase in two
ways: it applies its first-purchase price treatment and replaces that physical
slot with a fresh `RoomShop` option, excluding current inventory names before
the game's ordinary fallback (`StoreLogic.lua:1184-1201`). The refill is a new
option, not a duplicate of the purchase. Gold Gold Gold and Infernal Contract
are World Shop mechanisms and do not add a Well option or duplicate a Well
purchase.

A Well purchase is one atomic purchase lifecycle. It does not become an
ordinary free pickup and therefore does not invoke pickup-only alternate
interactions such as Time Piece, Artificer, Sea Star, or Echo's last-reward
recording.

## Repeated offers and overlapping uses

The Well has no general rule excluding an identity merely because the hero
already holds or previously purchased it. Initial generation selects distinct
identities for the three visible positions, and a Travel Deal refill excludes
the purchased and still-visible names in that Well. A later Well starts from
the declared pool again and may offer an identity purchased on an earlier
visit.

Most temporary Well traits can therefore overlap. `HandleStorePurchase` adds a
new retained trait instance unless the declaration owns different stacking
behavior. `FirstHitHealTrait` explicitly combines another purchase into its
remaining-use count. `LimitedSwapTraitDrop` adds one use to the existing
`LimitedSwapBonusTrait`. Repeated Spark and Yarn purchases create additional
one-use instances; Spark consumes one instance per forced gate, while every
held Yarn contributes to an eligible offer and only one Yarn instance is
consumed when that offer closes (`StoreLogic.lua:1206-1222`,
`EventLogic.lua:1779-1787`, and `TraitLogic.lua:400-451`).

The source has three relevant exceptions to an unrestricted-repeat summary:

- `TemporaryDiscountTrait` is ineligible while the same trait is held;
- `TemporaryEmptySlotDamageTrait` is likewise ineligible while held and also
  requires an empty primary or secondary core slot; and
- `LastStandShopItem` can be offered and purchased only while a Last Stand is
  missing.

The first two exceptions depend on temporary active-state expiration; the
third depends on whether a Last Stand is missing at that exact generation and
purchase frontier. They are declaration-specific requirements, not evidence
for a global nonstacking Well rule.

Those exceptions do not require a parallel expiry subsystem. Discount and
Empty Slot use the same encounter-use countdown shape as other modeled timed
effects. The planner does not derive a route-wide Death Defiance capacity
ledger. The [runtime fallback audit](RUNTIME_OFFER_FALLBACK_AUDIT.md) instead
keeps Last Stand as the preferred result and owns pool-local safe alternatives
for initial inventory, a Travel Deal refill, and a Twist result without
inventing health/death simulation.

One narrow interaction extends temporary-trait lifetime. The exact
`ExtendedShopTrait.ValidPermanentItemsLookup` whitelist is:

- `TemporaryDoorHealTrait`;
- `TemporaryImprovedSecondaryTrait`;
- `TemporaryImprovedCastTrait`;
- `TemporaryMoveSpeedTrait`;
- `TemporaryImprovedExTrait`;
- `TemporaryImprovedDefenseTrait`;
- `TemporaryDiscountTrait`; and
- `TemporaryEmptySlotDamageTrait`.

When an active Extended use applies to a direct Well purchase of one of those
eight traits, `HandleStorePurchase` changes that purchased instance to two
boss uses and consumes an Extended use (`TraitData_Store.lua:15-39`;
`StoreLogic.lua:886-889, 1206-1217`). Discount and Empty Slot are the two
whitelisted identities whose extended active lifetime changes current planner
offer eligibility. The other six still consume Extended, but their resulting
duration remains sim-neutral. Extended itself, Spark, Yarn, Sacrificial Hymn,
Last Stand, `FirstHitHealTrait`, `TemporaryHealExpirationTrait`, and every
consumable are outside the whitelist. Twist awards its nested result through a
separate consumable path and does not make that result a direct
`MakePermanent` purchase, so it neither receives nor consumes Extended.

## The three direct consequential identities

### Spark of Ixion

Spark is `TemporaryForcedSecretDoorTrait`: a one-use `ForceSecretDoor` trait.
It requires the first Chaos pickup and rejects Dream runs
(`TraitData_Store.lua:301-322`). Repeated acquisitions may retain multiple
one-use instances. A forced gate consumes one use when it is actually created,
not on purchase.

The forced branch is evaluated before natural chance and ordinary
secret-door requirements. It still needs a physical `SecretPoint`, rejects the
explicit Preboss, boss, Postboss, `I_Intro`, and Anomaly cases, and waits past
any ineligible map. It then creates a zero-health-cost Chaos gate, consumes one
Spark use, and records the host in ordinary secret-door history. The resulting
host restarts the natural ten-room Chaos lookback; there is no distinct reset
operation. `ROUTE_DETOUR_FINDINGS.md` records the exact forced-branch source
walk and remains the detailed authority for its route consequences.

### Yarn of Ariadne

Yarn is `TemporaryBoonRarityTrait`, with `GodLootOnly`, one remaining use, and
the declared additive Rare/Epic/Duo/Legendary contribution
(`TraitData_Store.lua:282-300`). It is eligible for Olympian and Hermes offers.
The exact lifecycle is:

```text
buy Yarn
  -> retain one temporary RarityBonus use
  -> construct the next eligible God boon offer without IgnoreTempRarityBonus
  -> apply Yarn to the complete offer's rarity ledger
  -> consume one RarityBonus when that choice screen closes
```

The selected option is not the consumption condition. An offer that ignores
temporary rarity bonuses neither receives nor consumes Yarn. The full values
and offer-local lifecycle are owned by
`BOON_RARITY_LEDGER_GAME_DATA_AUDIT.md`.

### Sacrificial Hymn

Sacrificial Hymn is the player-facing `LimitedSwapTraitDrop`. Its immediate
use calls `AddLimitedSwapTrait(Amount = 1)`, which creates the nonstacking
`LimitedSwapBonusTrait` with `ForceSwaps`, one use, and
`ExchangeLevelBonus = 2` (`ConsumableData.lua:1314-1327`,
`EventLogic.lua:1779-1787`, and `TraitData_Store.lua:489-508`).

When a boon is generated, a held forced-swap use makes the generator attempt
`GetReplacementTraits`. That function returns one random eligible replacement
from the possible set; a nonempty result marks the offer to use the trait. An
empty result falls back to its normal priority path and leaves the use intact
(`TraitLogic.lua:1791-1815`; selection in
`UpgradeChoiceLogic.lua:795-822`). When a marked boon choice screen closes, it
consumes one use whether the player selected the replacement or not
(`UpgradeChoiceLogic.lua:1134-1141`). A replacement receives the next rarity
tier and its displayed stack level uses the displaced trait's existing count
plus the two-level bonus (`UpgradeChoiceLogic.lua:321-327, 795-822`).

Thus Hymn is neither an immediate forced boon acquisition nor a permanent
replacement rule. It is a one-use, next-eligible-offer generator rule, and
its player choice remains optional.

## Current planner disposition

The planner does not yet model Well presence, inventory, purchases, or any
temporary Well state. Spark, Yarn, and Sacrificial Hymn remain the three direct
rule-changing Well identities. Exact future Well-offer eligibility additionally
requires encounter- or boss-use lifetime state for Discount and Empty Slot and
the source's missing-Last-Stand requirement at each applicable slot or
nested-result frontier. That runtime requirement does not become authored
state; the shared fallback disposition owns it.
Extended applies to the exact eight-identity whitelist above; only
Discount and Empty Slot need their extended boss-use lifetime simulated, while
the other six still consume a use. That consumption remains consequential run
state because it prevents a later Discount or Empty Slot purchase from using
the same Extended charge. Twist can award Yarn, Discount, or Last Stand through
its nested pool. Their combat, health-restoration, Magick, price, and gold
values remain deferred.

Same-Well generation retains distinct visible identities and Travel Deal
refill exclusions. Across separate Wells, repeat eligibility follows the held
state above rather than a global purchased-name ban. Repeated Spark, Yarn,
Hymn, and consequential Twist outcomes retain their exact use semantics.
Existing World Shop, Travel Deal, Gold Gold Gold, Infernal Contract, natural
Chaos, rarity ledger, Last Stand, and trait-replacement models are not implicit
Well support.
