# Stygian Well Game-Data Audit

## Status and scope

This is an implementation-free source audit for the Well of Charon, referred
to in player-facing discussion as the Stygian Well. It records host-room
eligibility, spacing, inventory, interaction timing, Travel Deal contact, and
Spark of Ixion. It does not define planner state, commands, simulation APIs,
UI, gates, or an implementation sequence.

The evidence was checked on 2026-08-16 against the installed Hades II scripts.
Primary sources are:

- `RoomData.lua` and `RoomDataF/G/H/I.lua`;
- `RoomLogic.lua`, especially `HandleSecretSpawns`, `IsWellShopEligible`,
  `IsSecretDoorEligible`, and `DoUnlockRoomExits`;
- `RequirementsLogic.lua` and `RequirementsData.lua`;
- `StoreData.lua` and `StoreLogic.lua`; and
- `TraitData_Store.lua` and `TraitLogic.lua`.

The shared room-interaction chronology is summarized in
`SHOP_AND_WELL_INTERACTION_LIFECYCLE.md`. This focused audit owns the detailed
Well facts.

## Appearance and spacing

The base Well declaration has:

- `WellShopSpawnChance = 0.15`;
- the `WorldUpgradeWellShops` unlock requirement;
- `BiomeDepthCache >= 3`;
- an underworld-route requirement expressed as no reached `N` biome; and
- `RequiredMinRoomsSinceEvent(Event = "WellShop", Count = 4)`.

`RequiredMinRoomsSinceEvent` compares the current run depth with
`LastWellShopDepth`. A new Well is legal once the depth difference is at least
four. In route terms, three intervening rooms separate the two Well rooms.
This is more precise than describing the rule as either “three-room spacing”
or “four rooms between Wells.”

An actual spawn also requires a physical `ChallengeSwitchBase` in the loaded
map. `HandleSecretSpawns` installs the Well into that slot and records the
current depth as `LastWellShopDepth`. Forced Wells therefore participate in
the same later spacing history.

The ordinary underworld host family is F/G/H/I. I overrides the inherited
chance to `0.08`. F/G/H each declare one forced Postboss Well:

| Room           | Chance | Forced | Additional requirement          |
| -------------- | -----: | :----: | ------------------------------- |
| `F_PostBoss01` |    1.0 |  yes   | `WorldUpgradePostBossWellShops` |
| `G_PostBoss01` |    1.0 |  yes   | `WorldUpgradePostBossWellShops` |
| `H_PostBoss01` |    1.0 |  yes   | `WorldUpgradePostBossWellShops` |

The installed I declarations do not define an equivalent forced Postboss
Well. I supports ordinary Wells through its room family and reduced chance,
but the broad statement “every underworld Postboss has a Well” is not literally
true of the current declaration set.

## Room chronology

An eligible Well is created during room setup but remains locked during active
combat. `DoUnlockRoomExits` first completes the room's outgoing-generation
boundary and then marks the Well usable. In an H Fields room this means the
Well is not a between-cage interaction: it becomes usable after the room's
combat sequence reaches its exit-unlock boundary.

The relevant ordering is:

```text
enter room and determine Well presence
  -> finish the room's required combat lifecycle
  -> generate and reveal outgoing exits
  -> unlock the Well
  -> make zero or more Well purchases
  -> enter the selected next room
```

A Well purchase cannot retroactively change outgoing doors already generated
in its room. Its acquired item or retained trait may affect later rooms.

## Inventory

`StoreData.RoomShop` has `MaxOffers = 3`. It requests exactly one offer from a
weighted healing/defensive group, then fills the remaining available slots
from its other eligible trait and consumable declarations without treating
positive weight as a support exclusion.

The healing/defensive group is:

- `ArmorBoostStore`;
- `DamageSelfDrop`;
- `HealDropRange`;
- `EmptyMaxHealthShopItem`;
- `FirstHitHealTrait`;
- `TemporaryDoorHealTrait`;
- `TemporaryHealExpirationTrait`; and
- `LastStandShopItem`.

The additional temporary-trait family is:

- `TemporaryImprovedSecondaryTrait`;
- `TemporaryImprovedCastTrait`;
- `TemporaryMoveSpeedTrait`;
- `TemporaryBoonRarityTrait`;
- `TemporaryImprovedExTrait`;
- `TemporaryImprovedDefenseTrait`;
- `TemporaryDiscountTrait`;
- `TemporaryForcedSecretDoorTrait`;
- `TemporaryEmptySlotDamageTrait`; and
- `ExtendedShopTrait`.

The additional consumable family is:

- `MetaCurrencyRange`;
- `MetaCardPointsCommonRange`;
- `MemPointsCommonRange`;
- `SeedMysteryRange`;
- `RandomStoreItem`;
- `LimitedManaRegenDrop`; and
- `LimitedSwapTraitDrop`.

Individual declarations retain their own game-state and purchase
requirements. This audit records the complete raw pool, not a claim that every
entry is simultaneously eligible.

## Purchases and Shop-trait interaction

`HandleStorePurchase` applies a successful Well purchase immediately. Traits
are added to the hero; consumables are spawned and consumed through their
declared behavior. Gold costs and numeric combat/healing effects are separate
from the possibility and chronology facts recorded here.

Travel Deal is `FirstPurchaseDiscount`. It has two source contacts at a Well:

1. the first purchase receives the first-purchase price treatment; and
2. that first purchase replaces its physical index with a freshly generated
   `RoomShop` option, using the current inventory names as exclusions before
   the source's ordinary fallback behavior.

The refill is a new Well option, not a copy of the purchased item. Travel Deal
is not itself a `RoomShop` pool entry, so this consequence requires it to have
been acquired before the Well purchase.

Echo Gold Gold Gold is not invoked by `HandleStorePurchase`; its duplicate
hook belongs to the World Shop purchase path. Infernal Contract is likewise a
World Shop pedestal mechanism and does not add a Well slot.

## Spark of Ixion

Spark of Ixion is `TemporaryForcedSecretDoorTrait`:

- it is a one-use Well trait with `ForceSecretDoor = true`;
- offering it requires the first Chaos pickup to have occurred;
- it is unavailable in Dream runs; and
- each successful forced-gate creation consumes one held trait use through
  `UseHeroTraitsWithValue("ForceSecretDoor", true)`.

Repeated Spark acquisitions may leave multiple held one-use trait instances.
Gate creation consumes one use rather than clearing every held instance.

While a Spark use is available, `IsSecretDoorEligible` takes the forced branch
before natural chance and ordinary `SecretDoorRequirements`. The forced branch
still requires:

- a physical `SecretPoint` in the current map;
- a room outside the explicit Preboss, boss, Postboss, and `I_Intro`
  exclusions; and
- a room set other than `Anomaly`.

The force branch can therefore bypass natural chance, natural biome/depth
restrictions, and the ordinary recent-Chaos check. The trait waits through
ineligible maps and is consumed when the first eligible gate is actually
created. A forced gate has zero health cost.

Both natural and forced gate creation set the host room's `ForceSecretDoor`
marker. `NoRecentChaosEncounter` rejects natural gates when that marker exists
in the previous ten rooms. Spark therefore restarts the natural ten-room
spacing through ordinary room history; there is no separate mutable “Chaos
cooldown reset” operation.

The resulting chronology is:

```text
buy Spark at a Well
  -> retain one forced-gate use
  -> enter rooms until one has a legal SecretPoint host
  -> create a zero-cost Chaos gate and consume one use
  -> record the host as a recent secret-door room
  -> natural Chaos eligibility observes a fresh ten-room history window
```

## Current planner disposition

The planner does not yet model Well presence, Well inventory, Well purchase
chronology, temporary Well traits, or Spark's forced Chaos state. Existing
World Shop, Travel Deal, Gold Gold Gold, Infernal Contract, and natural Chaos
models must not be interpreted as implicit Well support.

This audit intentionally leaves implementation choices open. A later plan may
select a consequential subset of the full Well pool, but that simplification
must preserve the source distinctions recorded above.
