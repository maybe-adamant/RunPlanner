# Shop and Well Interaction Lifecycle Audit

## Status and scope

This is a source-backed game-fact audit for structural World Shops, Wells of
Charon, and Shrines of Hermes. It records their inventory, room-interaction,
outgoing-generation, purchase, and delivery timing.

It does not define a planner schema, simulation product, command, UI, delivery
gate, or implementation sequence. Planner interpretation of these facts lives
outside this audit.

This document does not define complete item pools, prices, probability
weights, or UI labels. `REWARD_GAME_DATA_AUDIT.md` remains the source authority
for the supported `WorldShop`, `I_WorldShop`, and `Q_WorldShop` offer matrices.
Future Well or Shrine work must refresh the focused pool and eligibility facts
listed under unresolved questions before declaring those families supported.

The game evidence was checked on 2026-08-11 against the installed Hades II
scripts. Primary sources are:

- `RunLogic.lua`, especially `CreateRoom`;
- `RoomLogic.lua`, especially `HandleSecretSpawns`, `UnlockRoomExits`,
  `DoUnlockRoomExits`, `IsWellShopEligible`, and `IsSurfaceShopEligible`;
- `StoreLogic.lua`, especially `FillInShopOptions`, `RunShopGeneration`,
  `UseWellShop`, and `HandleStorePurchase`;
- `SurfaceShopLogic.lua`, especially `ShowSurfaceShopScreen`,
  `HandleSurfaceShopAction`, `CloseSurfaceShopScreen`, and
  `CompleteSurfaceShopItems`;
- `StoreData.lua`, especially `RoomShop`, `SurfaceShop`, and the World Shop
  profiles;
- `ObstacleData.lua` and `ObstacleDataN.lua`, especially `WellShop` and
  `SurfaceShop`;
- `EncounterLogic.lua`, which locks and unlocks room-local interaction
  obstacles with encounter state; and
- `TraitData.lua` and `TraitLogic.lua`, especially
  `StorePendingDeliveryItem` and its expiration action.

In player-facing discussion, “Stygian Well” refers here to the game's Well of
Charon backed by `RoomShop`; “Hermes Well” refers to the Shrine of Hermes backed
by `SurfaceShop`.

## Terms

**Inventory materialization**
: Selection of the concrete options attached to a Shop or Well for the current
room.

**Outgoing generation**
: Creation of the current room's exit targets and reward previews.

**Post-encounter interaction**
: A room-local action available after the encounter and outgoing generation
but before the player enters a selected exit.

**Acquisition**
: The point when an offered, purchased, dropped, or delivered item actually
changes run history. Purchase and acquisition are not always the same event.

**Pending delivery**
: A Shrine purchase whose concrete item and remaining delay are retained until
the game later spawns that item for acquisition.

## Shared lifecycle facts

Structural Shops and room-local Wells have different hosts, but their room
ordering shares an important boundary:

```text
enter room and materialize available inventory
  -> resolve the room encounter and incoming reward, if any
  -> generate and reveal outgoing doors from pre-interaction state
  -> perform available Shop or Well interactions
  -> enter the selected next room with post-interaction state
```

`RunShopGeneration` runs for the next room during the transition into it. It
can materialize a structural World Shop, `RoomShop`, or `SurfaceShop` inventory
before the new map loads. Room setup separately installs eligible Well or
Shrine obstacles into a physical `ChallengeSwitchBase` slot.

For combat-bearing rooms, the Well and Shrine remain locked during the
encounter. `DoUnlockRoomExits` creates exit rooms and reward previews before it
marks `WellShop` and `SurfaceShop` usable. The player therefore uses either
interaction after the current exits exist and before entering one.

Consequently:

1. a post-encounter purchase cannot retroactively change the doors or rewards
   already generated in that room; and
2. its immediate or retained result can affect later lifecycle work beginning
   with the selected next room.

## Structural World Shops

A structural Shop is the room's primary noncombat product rather than an
optional obstacle in another room. `WorldShop`, `I_WorldShop`, and
`Q_WorldShop` use declared ordered groups and offer counts. Their inventories
materialize on entry.

The Shop encounter initiates outgoing generation before ordinary purchases.
Requirements observing the current room's generated Shop options therefore see
the complete inventory, not a post-purchase remainder.

Purchases remove or consume offers and apply their effects in the player's
chosen order. The selected next room is entered with that post-purchase state.
Money, affordability, discounts, rerolls, and other purchase requirements are
separate game behaviors from this lifecycle ordering.

## Well of Charon (`RoomShop`)

The base room declaration gives a Well of Charon a chance to appear after the
relevant permanent unlock, at biome depth three or later, with four rooms of
spacing from the previous Well event. Concrete rooms may override the chance,
requirements, or force state. Appearance also requires an available physical
`ChallengeSwitchBase` slot.

When eligible, room setup records `ForceWellShop`, installs a locked `WellShop`
obstacle, and records the current run depth as the latest Well depth. Its
`RoomShop` inventory contains up to three eligible options, including healing
or defensive consumables, temporary traits, run resources, and other declared
effects. Positive weights determine probability among supported options; they
do not by themselves remove an option from the possible domain.

The obstacle becomes usable only after outgoing exits unlock. Purchases are
then applied immediately by `HandleStorePurchase`, subject to the item's
resource and use requirements. Some options are temporary traits whose later
expiration or remaining-use behavior remains semantically relevant after the
purchase.

Spark of Ixion is one Well item with separate forced-Chaos behavior. Its
existence does not change the ordinary Well timing recorded here.

## Shrine of Hermes (`SurfaceShop`)

The Surface Shrine uses the same physical room-interaction family but a
different store and effect lifecycle. Base eligibility starts at biome depth
three after the relevant permanent unlock and rejects a Shrine in the previous
three rooms. Surface room declarations provide their own spawn chances and may
override or force the interaction. An available `ChallengeSwitchBase` slot is
still required.

`SurfaceShop` materializes three offers: one from its first group and two
distinct offers from its second group. It becomes usable after the encounter
and outgoing doors unlock.

A normal purchase does not immediately grant the item. It creates a
`StorePendingDeliveryItem` trait carrying the selected item and a room-delay
count. When that countdown expires, the item is spawned for acquisition in a
later room:

```text
post-encounter Shrine purchase
  -> pending delivery with encounter-use countdown
  -> later item spawn
  -> concrete acquisition
```

The player may pay again to rush a purchased offer. Rushing removes the
pending state and spawns the item in the current room when the Shrine screen
closes:

```text
post-encounter Shrine purchase
  -> rush interaction
  -> same-room item spawn
  -> concrete acquisition
```

Some declarations also mark rooms that automatically complete pending
delivery. A delivered item is mandatory to collect once it materializes; it
cannot be abandoned as an optional pickup.

Purchase timing and acquisition timing are therefore distinct for the Shrine.
A normal purchase creates retained pending state, while rush or declared forced
completion produces a concrete item at the reached delivery room.

## Timing comparison

| Family                | Inventory form                                              | Interaction time                        | Purchase result                                                                     |
| --------------------- | ----------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------- |
| Structural World Shop | room-primary inventory materialized on entry                | after current outgoing generation       | immediate supported acquisition/effect                                              |
| Well of Charon        | optional physical room obstacle and `RoomShop` inventory    | after encounter and outgoing generation | immediate supported acquisition/effect, sometimes with later temporary-trait expiry |
| Shrine of Hermes      | optional physical room obstacle and `SurfaceShop` inventory | after encounter and outgoing generation | pending delivery unless rushed or forcibly completed                                |

The shared fact is the post-outgoing interaction boundary. The families do not
share one acquisition behavior: World Shop and Well purchases are ordinarily
immediate, while Shrine purchases ordinarily schedule later materialization.

## Unresolved source questions

Future evidence refreshes for Wells or Shrines should close these gaps:

- exact eligible host declarations and concrete `ChallengeSwitchBase`
  capability for each supported biome;
- current `RoomShop` and `SurfaceShop` pools, offer counts, per-item
  requirements, and without-replacement behavior;
- encounter-use decrement timing for every pending Hermes delivery;
- forced postboss Wells and Shrines versus naturally spawned interactions;
- restock, reroll, first-purchase discount, and rush semantics;
- temporary-trait expiry and the subset that affects modeled history;
- interaction coexistence when a map has multiple physical challenge slots;
  and
- exact affordability, health-cost, resource, and profile-progression
  predicates that materially change support.
