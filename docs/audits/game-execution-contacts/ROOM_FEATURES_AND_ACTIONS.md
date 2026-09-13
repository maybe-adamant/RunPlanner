# Room features and actions

The room session is the execution boundary. Overview says what exists, Timeline
says which player or automatic outcomes matter, and Doors says what is offered
when exits open. A native event may help bind one of those facts, but it is not
a global action cursor.

## Source index

- Catalog room and feature declarations:
  `packages/hades2-catalog/src/declarations/rooms/`,
  `packages/hades2-catalog/src/declarations/layouts/`, and
  `packages/hades2-catalog/src/declarations/resources.ts`
- Execution Overview, Timeline, and Doors union:
  `packages/planner-engine/src/execution-plan/model.ts`
- Door opening: `Scripts/RoomLogic.lua:3871-3990`
- Reward generation: `Scripts/RewardLogic.lua:210-330`
- Fountain: `Scripts/InteractLogic.lua:741-790`
- Resources: `Scripts/HarvestLogic.lua:266-330`
- Current native contacts: `src/mods/room/features/` for fixed room content and
  inventories, `src/mods/navigation/` for doors and their rewards, and focused
  action-family adapters beneath `src/mods/room/timeline/` in the Plan Executor

## Overview contacts

| Published fact                      | Native contact                                                                                                                   | Current status                                                                                                                                                                             |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Current room identity               | `ChooseStartingRoom`, `CreateRoom`, `StartRoom`                                                                                  | Covered.                                                                                                                                                                                   |
| Encounter phases                    | `ChooseEncounter`, `SetupRoomMultipleEncountersData`                                                                             | Covered across both fixed routes, including O and P multi-phase rooms.                                                                                                                     |
| Incoming reward                     | `SetupRoomReward`, `SpawnRoomReward`                                                                                             | Covered.                                                                                                                                                                                   |
| Effect-neutral required boss reward | native required reward remains intact                                                                                            | Covered; it is not compiled as a simulated acquisition.                                                                                                                                    |
| Stygian Well presence               | `IsWellShopEligible`                                                                                                             | Covered.                                                                                                                                                                                   |
| Purging Pool presence               | `IsSellTraitShopEligible`                                                                                                        | Covered.                                                                                                                                                                                   |
| World Shop inventory                | room `StoreDataName` plus Shop contacts                                                                                          | Covered.                                                                                                                                                                                   |
| Keepsake Rack                       | native obstacle with `UseKeepsakeRack`                                                                                           | Covered as room content; only an actual change creates a Timeline transaction.                                                                                                             |
| Fountain                            | native obstacle with `UseHealthFountain`                                                                                         | Covered.                                                                                                                                                                                   |
| Successful resource                 | declaration-owned room point plus `GrantElementFromTool`                                                                         | The route product publishes `native`, `suppress`, or `force` per room/family; the adapter steers only the native element roll, and the next-room checkpoint proves the resulting counters. |
| Chaos gate                          | `HandleSecretSpawns`, `IsSecretDoorEligible`                                                                                     | Covered.                                                                                                                                                                                   |
| Zagreus Contract                    | `SpawnZagContract`                                                                                                               | Covered.                                                                                                                                                                                   |
| N side rooms, H cages, O wheels     | Covered through the Ephyra Hub/side-room, Fields cage, and ShipCombat wheel adapters; complete-route live proof remains pending. |
| Shrine of Hermes                    | Inventory and purchase/delivery carriers are covered through the fixed Surface route.                                            |

Presence and interaction are different. An uninteracted Well or Pool is a
valid Overview fact with no purchase/sale transaction. A Shop or Shrine still
requires full inventory authoring even when no offer is purchased.

### Published presence as a native construction input

The presence adapters deliberately replace the native eligibility result for
an owned occurrence. They do not recalculate spawn rules or create objects:

| Published content     | Native decision                                                 | Native work retained                                                                                              |
| --------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Chaos additional exit | `IsSecretDoorEligible` inside `HandleSecretSpawns`              | Point availability, gate creation, health cost and `ForceSecretDoor` trait consumption.                           |
| Stygian Well          | `IsWellShopEligible`                                            | Inventory generation, point selection, obstacle setup and `LastWellShopDepth`.                                    |
| Purging Pool          | `IsSellTraitShopEligible`                                       | Point selection, obstacle setup and native sale-value construction.                                               |
| Hermes Shrine         | `IsSurfaceShopEligible`                                         | Inventory generation, obstacle setup, price, rush and delivery behavior.                                          |
| Zagreus Contract      | Destination `zagreusContractPresent` applied after `CreateRoom` | Incoming preview and later `SpawnZagContract` read the same host flag; native creates the additional destination. |

`RoomLogic.lua:HandleSecretSpawns` checks native point availability outside
these predicates and owns their resulting mutations. `StoreLogic.lua:RunShopGeneration`
also calls the Well/Shrine predicates before spawning. Their occurrence-bound
answers must therefore cover both contacts, not just a spawn-time scope.
Chaos's Boolean is confined to secret generation; native calls outside that
scope pass through. Unowned occurrences and passive sessions retain native
decisions. This is explicit room-content insertion, not a claim that only the
random roll was overridden.

Resource construction and gathering are separate contacts. Native room leave
auto-harvest runs after the room session closes, so resource-owned disposition
must survive until `GrantElementFromTool`. The adapter inserts spawn policy at
`SetupHarvestPoints` and steers the exact later element roll; it does not keep
the departed session alive or increment counters itself. The following room's
exit checkpoint can observe the late harvest through named element conformance.

### Fields placement evidence

The Fields adapter reads the coordinator's current room session through its
`occurrence`, then steers published entry points, cage points, optional reward
count/identities/points, and Nemesis's native spawn-point selection. Native
`SpawnRewardCages` retains object construction and encounters; native Forfeit
retains Boon/Hermes-to-Onion substitution. Original cage offers remain the
navigation input, not a physical-object assertion.

`RoomLogic.lua:1195–1198` runs room/encounter setup events before
`StartRoomPresentation` at `:1285`, before input unblocks. The adapter captures
a copied planned/observed snapshot at that presentation contact. It records
cage and reward IDs/names/points, optional reward restore spawn points, entry
points and Nemesis's available position. Native optional restore data at
`:5730–5740` does not retain `LootName`; Nemesis's final coordinates are not
asserted equal to the chosen point.

These observations are logged once per snapshot even while synchronized.
Missing or displaced objects and actual Onion names are diagnostic evidence,
not new mismatch conditions or a second Forfeit implementation. Existing
room-exit conformance remains unchanged. Required native API faults still
propagate. Local coordinator-shaped and reporting tests cover the contact and
snapshot isolation; in-game placement verification remains pending.

## Timeline transaction contacts

| Transaction             | Native contact                                                                    | Current status                                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acquisition             | `UseLoot` or `UseConsumableItem`, plus producer-specific creation/unwrap contacts | Covered subject to the carrier matrix in Rewards and items. It steers outcomes and may release DAG dependents, but is not a checkpoint obligation or semantic proof. |
| Encounter interaction   | encounter/NPC-specific menu contact                                               | Covered for the fixed-route NPC and encounter families; complete-route live proof remains pending.                                                                   |
| Item effect             | effect-specific native Well/item contact                                          | Covered for published consequential Well effects; ordinary payment itself has no execution transaction.                                                              |
| Transformation          | Anvil, Artificer, or Well Twist contact                                           | Covered by the focused transformation adapters.                                                                                                                      |
| Travel Deal Well refill | `RestockWorldItem` and `SpawnStoreItemInWorld`                                    | Covered.                                                                                                                                                             |
| Pool sale               | `CreateSellButtons`, `HandleSellChoiceSelection`                                  | Intentionally omitted as a transaction: Overview fixes the menu and `traitInventory` conformance proves the authored removal.                                        |
| Keepsake change         | `EquipKeepsake` after a real rack selection                                       | Covered. Opening/closing the rack without changing keepsake is not a transaction.                                                                                    |
| Fountain use            | `UseHealthFountain`                                                               | Covered.                                                                                                                                                             |
| Automatic               | effect-specific callbacks                                                         | Covered for the closed four-effect union.                                                                                                                            |

Dependencies are planner-published ordering constraints between transaction
owners. The executor checks only those edges; it must not infer semantic rules
such as "Travel Deal goes first" or "Phial follows a rack change." Obligations
are the independently published subset that must complete by a checkpoint.
Acquisition transactions are intentionally absent from that subset: their
completion records only that the native action reached its declared terminal
and establishes local DAG readiness. It does not attest to the steered result.
Other published transaction kinds retain one explicit obligation.

Material exact native contacts must retain their published source identity. Two
Shop pedestals may carry the same god while owning different normal and boosted
offers; payload similarity or authored order cannot identify them. Once an
exact-bound action is consumed, an unmet prerequisite is an immediate generic
DAG-readiness mismatch. This is not purchase verification and does not add an
eligibility pass before trait forcing.

## Doors contacts

Normal door rooms and rewards are realized during native outgoing generation
through `ChooseNextRoomData`, `IsRoomRewardEligible`, `ChooseRoomReward`, and
`DoUnlockRoomExits`. Chaos and Zagreus Contract are additional exits and retain
their dedicated native spawning contacts. Actual `LeaveRoom` closure checks
the published `exitUsable` and departure obligations. The supplied native
scripts contain no `UseExitDoor` contact; the executor does not interpret the
selected destination or compare transition strings at closure.

### Reward-selection filter

Navigation and Fields optional rewards bind their published reward to a
bounded `ChooseRoomReward` invocation. Their `IsRoomRewardEligible` override
accepts the published reward type, rather than rerunning legality that the
planner already settled. `RewardLogic.lua:ChooseRoomReward` still performs
native store refill/selection, priority removal, store withdrawal and assignment
of `room.Reward`, `ForceLootName` and `RewardOverrides`. Returning just the
reward name would skip this work; recreating it in the executor is not a
simplification. The temporary filter ends on native return or fault.

Source identity is installed through the existing reward fields and
`SetupRoomReward` contact. A complete live witness for a differing native
source with keepsake provenance or Devotion setup remains useful: source
patching alone does not prove all native source-specific preparation agrees.

### Additional exits and checkpoints

For additional exits, Overview is the authoritative declaration that the
feature must spawn, but Navigation owns the resulting Door. Immediately before
room exit it proves the complete additional-door set and each Door's occurrence,
kind, and destination alongside the normal Door product. The route cursor then
advances without interpreting which Door was used; the following `StartRoom`
proves the next published occurrence identity. Named room-exit conformance
separately checks retained state caused by a feature, such as consumption of an
Ixion charge.

The blocking comparison boundary is:

- room identity and authored Overview content after room entry;
- normal and additional door room/reward facts immediately before room exit;
- explicit required Timeline obligations at their published checkpoint.

Run State frames remain diagnostics and sources for named room-exit conformance
facts. They are not a second full-state desynchronization engine.

## Retained and cross-room effects

Spark, Yarn, Hymn, Travel Deal, Echo Shop duplication, keepsake charges,
Steady Growth progress, Shrine delivery clocks, and Chaos clocks persist beyond
one room. They are planner run state, not cross-room Timeline edges. The current
room publishes only:

1. transactions that originate or consume an effect in that room; and
2. named conformance facts that must agree before leaving.

This keeps room sessions independent while still exposing pending-state drift.
Hermes Shrine purchase and delivery are separate covered contacts, with
delivery—not payment—owning the acquisition. Fixed Surface navigation now
reaches the Shrine through the ordinary room-feature boundary.
