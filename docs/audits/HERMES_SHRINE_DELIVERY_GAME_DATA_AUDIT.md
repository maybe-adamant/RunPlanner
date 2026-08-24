# Shrine of Hermes Delivery Game-Data Audit

## Status and scope

This is an implementation-free source audit for the Shrine of Hermes, called
`SurfaceShop` in the installed scripts. It records host rooms, inventory,
purchase and rush behavior, delayed delivery, encounter chronology, SpellDrop
blocking, and Travel Deal contact. It does not define planner state, commands,
UI, gates, or an implementation sequence.

The evidence was checked on 2026-08-16 against the installed Hades II scripts.
Primary sources are:

- `RoomData.lua` and `RoomDataI/N/O/P/Q.lua`;
- `RoomLogic.lua`, especially `HandleSecretSpawns`,
  `IsSurfaceShopEligible`, `EndEncounterEffects`, and `DoUnlockRoomExits`;
- `StoreData.lua`, `StoreLogic.lua`, `SurfaceShopData.lua`, and
  `SurfaceShopLogic.lua`;
- `TraitData.lua`, `TraitLogic.lua`, `EventPresentation.lua`, and
  `NPCData_Hermes.lua`; and
- `EncounterSets.lua`, `RequirementsData.lua`, and `RequirementsLogic.lua`.

The broader acquisition chronology is also recorded in
`ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md`. This focused audit owns the
Shrine-specific source matrix.

## Appearance and host rooms

Base Shrine eligibility requires:

- `WorldUpgradeSurfaceShops`;
- `BiomeDepthCache >= 3`;
- no `SurfaceShop` in the previous three rooms; and
- a physical `ChallengeSwitchBase` in the loaded map.

The base chance is zero. Surface declarations opt in with their own chances:

- `N_Shop01` uses `0.25`;
- eligible N subrooms use `0.08`;
- ordinary O rooms inherit `0.125`;
- ordinary P rooms inherit `0.13`; and
- ordinary Q rooms inherit `0.10`.

N/O/P Postboss declarations force a Shrine at chance `1.0`, subject to the
postboss Shrine upgrade. O and P Reprieve declarations also set chance `1.0`
without using the forced flag. These realized Shrines appear in later
three-room history and therefore participate in ordinary spacing.

The installed I room family does not declare a Shrine spawn chance. I is
relevant to delivery completion through `I_PreBoss01`, not as an ordinary
Shrine host. The accurate broad spawn description is therefore N/O/P/Q, with
I participating in a separate pending-delivery boundary.

## Room chronology

An eligible Shrine is installed during room setup and remains locked while
combat is active. It becomes usable through `DoUnlockRoomExits`, after the
room has reached its outgoing-generation boundary. This matters for
multi-encounter rooms such as O: the Shrine is a post-room-combat interaction,
not a between-encounter purchase surface.

```text
enter room and determine Shrine presence
  -> finish the room's required combat lifecycle
  -> generate and reveal outgoing exits
  -> unlock the Shrine
  -> purchase, and optionally rush, Shrine offers
  -> enter the selected next room
```

Shrine purchases cannot alter outgoing doors already generated in the host
room.

## Inventory

`StoreData.SurfaceShop` produces exactly three initial offers: one weighted
offer from its first group and two without-replacement offers from its second
group.

The first group is:

| Item                 | Weight |
| -------------------- | -----: |
| `HealBigDrop`        |   0.25 |
| `RoomRewardHealDrop` |   1.50 |
| `ArmorBigBoost`      |   0.25 |
| `ArmorBoost`         |   1.00 |
| `LastStandDrop`      |   1.50 |
| `GiftDrop`           |   0.15 |

`LastStandDrop` retains `MissingLastStand` both while the offer is generated
and when it is purchased (`ConsumableData.lua:822-872`). This is the same
missing-capacity predicate used by the Well's `LastStandShopItem`; their raw
item names and pickup timing differ, but the eligibility fact is shared.
`FillInShopOptions` filters ineligible entries before its weighted selection,
so a failed Last Stand requirement leaves the other eligible first-group items
available rather than assigning a fixed replacement (`StoreLogic.lua:179-250`).

The second group is:

- `SpellDrop`;
- `ShopHermesUpgrade`;
- `MaxHealthDrop`;
- `MaxManaDrop`;
- `BlindBoxLoot`; and
- `TalentDrop`.

The Hammer group present in a block comment is not live inventory. Individual
entries retain their own source requirements. In particular, SpellDrop and
TalentDrop have progression and run-state requirements, GiftDrop retains its
ordinary requirement, and Blind Box retains its source-resolution
requirements.

## Purchase and pending delivery

Each materialized offer receives an integer `RoomDelay` from 2 through 8.
Delay also affects price, but numeric price is separate from the lifecycle
facts in this audit.

A normal first purchase does not grant the reward. It creates a
`StorePendingDeliveryItem` carrying:

- the exact purchased item payload;
- `RemainingUses = RoomDelay`;
- `UsesAsEncounters = true`;
- its purchase depth and display identity; and
- an expiration action that spawns the item with zero remaining purchase
  cost.

The Shrine is opened only after its host encounter has ended, so the purchase
room's completed encounter does not immediately consume a newly created
delivery use. Later qualifying encounter completions decrement it.

`EndEncounterEffects` performs that decrement for the room's main encounter or
an encounter override. It excludes noncombat and explicitly skipped
encounters, respects `IgnoreEncounterUses`, and is not equivalent to merely
entering a room. A multi-encounter room can therefore advance or expire a
delivery between encounter instances.

When the count reaches zero, trait expiration spawns the retained item at a
room-local pickup point, marks it as a required room object, and leaves
concrete acquisition to that pickup. In the default combat event list the
ordinary room-reward object is spawned before `EndEncounterEffects`; the
delivery then materializes before exits unlock and before the player completes
the room's pickups. The source does not impose “room reward first” acquisition
order, so the delivered pickup can be collected before the room reward.

The lifecycle is:

```text
purchase exact Shrine offer
  -> retain exact item with 2..8 qualifying encounter uses
  -> decrement after each qualifying encounter
  -> spawn required pickup when the count expires
  -> acquire it through ordinary pickup behavior
```

Multiple pending purchases are independent trait instances and can expire in
the same room.

## Rush delivery

After buying an offer, the same Shrine slot becomes a rush action. Paying its
speed-up cost removes that pending instance and queues the exact item for
same-room spawn when the Shrine screen closes. It is still a normal concrete
pickup rather than an effect granted inside the screen.

```text
purchase exact Shrine offer
  -> rush that purchased offer
  -> close Shrine screen
  -> spawn exact item in the Shrine room
  -> acquire it through ordinary pickup behavior
```

## Travel Deal, Gold, and Contract

Travel Deal's `FirstPurchaseDiscount` participates in the Shrine handler:

- the first purchase receives its first-purchase price treatment whether or
  not any delivery is later rushed; and
- only the first rushed purchase can refill its vacated physical slot with a
  freshly generated `SurfaceShop` offer.

An ordinary delayed purchase marks its existing slot as purchased and changes
that slot's next action to Rush. It does not vacate or refill the slot. Delivery
expiring in a later room also does not revisit the old Shrine menu. Travel
Deal's extra offer therefore exists only when the player rushes one purchased
item while still at that Shrine. If no purchase is rushed, Travel Deal provides
the discount but no replacement offer.

The rush refill narrows multi-offer groups to one offer for same-index
replacement, excludes the rushed item and current visible names first, and
falls back to ordinary Surface Shop generation when needed. The
`FirstSpeedUpPurchase` guard permits only one such refill in that Shrine. The
`ShopHermesUpgrade` offer can eventually yield Travel Deal as its selected
Hermes trait, but that acquisition occurs only when the delivered Hermes pickup
is resolved. It cannot retroactively qualify the purchase or rush that created
that delivery. Travel Deal must already be held when the relevant Shrine action
checks it.

Gold Gold Gold is absent from `HandleSurfaceShopAction`; its duplicate hook is
owned by World Shop pickup handling. Infernal Contract likewise adds a
pedestal only to declared World Shops. Neither effect adds or duplicates a
Shrine offer.

## Pending SpellDrop

Purchasing a delayed `SpellDrop` sets `CurrentRun.PendingSpellDrop = true`.
Both the Surface Shop option requirements and the ordinary
`SpellDropRequirements` reject another SpellDrop while that flag is true.
This prevents a pending Shrine delivery from also appearing as a door reward
or another Shop offer before it is acquired.

The installed scripts do not clear `PendingSpellDrop` on delivery. After the
pickup, the ordinary SpellDrop use record independently makes another
SpellDrop ineligible, so the retained flag is redundant rather than reopening
the reward.

SpellDrop is the only live Shrine offer with a dedicated pending reservation.
No other branch in `HandleSurfaceShopAction` sets an item-specific pending
flag, and no other Surface Shop entry checks for one. In particular, a pending
Hermes boon, Path of Stars, Blind Box, Death Defiance refill, Nectar, Max
Health, Max Magick, heal, or armor delivery does not itself suppress an
otherwise legal matching reward elsewhere.

Some of those rewards still have ordinary generation or pickup requirements,
such as Hermes biome/history limits, Path of Stars legality, or a missing Death
Defiance slot. Those requirements are updated by actual acquisitions and run
state, not by the pending Shrine wrapper. Likewise, without-replacement names
inside one visible Shrine inventory and the rush-refill exclusion list are
local menu-generation rules rather than run-wide pending reservations.

## Forced completion boundary

The installed source reaches the same final-Preboss outcome through two
different mechanisms.

For Dream Dives, F/G/H/I/N/O/P Preboss declarations carry
`AutocompleteSurfaceShopDelivery`. Their shared Shop-room event calls
`CompleteSurfaceShopItems` only when all three conditions hold:

1. `CurrentRun.IsDreamRun` is true;
2. the current room has `AutocompleteSurfaceShopDelivery`; and
3. `CurrentRun.EnteredBiomes == 4`.

For the normal fixed Surface route, `Q_PreBoss01` instead owns a Hermes distance
trigger guarded by `CurrentRun.EnteredBiomes == 4`. `SpawnHermesInPerson`
collects every pending Shrine-delivery trait and removes each one. Removal runs
the retained `OnExpire.SpawnShopItem` action, so all outstanding purchases are
delivered in that room. This is the normal-run forced-completion path; it is
not performed by `CompleteSurfaceShopItems`.

`Q_PreBoss01` does not need the autocomplete declaration because its Hermes
event owns the equivalent transition. It also covers Q when Q is the fourth
biome of a Dream Dive. Together, the two source paths support the following
game-level rule:

```text
reach the run's final Preboss with EnteredBiomes == 4
  -> complete every pending Shrine delivery in that Preboss room
```

The planner can therefore model one mode-independent final-Preboss completion
rule. The distinction between the generic Dream-Dive event and Q's Hermes
presentation is an implementation detail unless presentation itself later
enters scope.

## Current planner disposition

The planner does not yet model Shrine presence, its three-offer inventory,
pending-delivery countdowns, rush, forced final-Preboss completion, or the
pending-SpellDrop door block. Existing World Shop and Travel Deal support must
not be interpreted as implicit Shrine support.

The forced Q contact nevertheless fixes a future planner requirement. If a
delivered Hermes pickup and a World Shop purchase coexist in `Q_PreBoss01`,
their positions in the one room chronology determine the Travel Deal or Gold
Gold Gold payload context. Delivery before the purchase may add a fourth god
and lock the pool before a refill is generated; delivery after the purchase
cannot retroactively constrain that refill. A future payload editor must use
the triggering action's exact history prefix rather than Shop-entry history or
only the selected source slot.

This audit intentionally leaves authored shape and UX open. A later plan must
decide how much numeric delay choice is useful while preserving the source
distinction between purchase, delivery materialization, and concrete pickup.
