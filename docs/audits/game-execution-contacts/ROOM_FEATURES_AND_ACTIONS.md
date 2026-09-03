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
- Current native contacts: `src/mods/room/features/hooks.lua`,
  `src/mods/room/features/inventory_hooks.lua`, and
  `src/mods/room/timeline/feature_interactions.lua` in the Plan Executor

## Overview contacts

| Published fact                                    | Native contact                                                                                                          | Current status                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Current room identity                             | `ChooseStartingRoom`, `CreateRoom`, `StartRoom`                                                                         | Covered.                                                                       |
| Encounter phases                                  | `ChooseEncounter`, `SetupRoomMultipleEncountersData`                                                                    | Covered for F/G.                                                               |
| Incoming reward                                   | `SetupRoomReward`, `SpawnRoomReward`                                                                                    | Covered.                                                                       |
| Effect-neutral required boss reward               | native required reward remains intact                                                                                   | Covered; it is not compiled as a simulated acquisition.                        |
| Stygian Well presence                             | `IsWellShopEligible`                                                                                                    | Covered.                                                                       |
| Purging Pool presence                             | `IsSellTraitShopEligible`                                                                                               | Covered.                                                                       |
| World Shop inventory                              | room `StoreDataName` plus Shop contacts                                                                                 | Covered.                                                                       |
| Keepsake Rack                                     | native obstacle with `UseKeepsakeRack`                                                                                  | Covered as room content; only an actual change creates a Timeline transaction. |
| Fountain                                          | native obstacle with `UseHealthFountain`                                                                                | Covered.                                                                       |
| Successful resource                               | declaration-owned room point plus `GrantElementFromTool`                                                                | Covered for the four element outcomes.                                         |
| Chaos gate                                        | `HandleSecretSpawns`, `IsSecretDoorEligible`                                                                            | Covered.                                                                       |
| Zagreus Contract                                  | `SpawnZagContract`                                                                                                      | Covered.                                                                       |
| N side rooms, H cages, O wheels, Shrine of Hermes | Deferred route. The semantic product already owns most authored facts, but native contacts need route-specific mapping. |

Presence and interaction are different. An uninteracted Well or Pool is a
valid Overview fact with no purchase/sale transaction. A Shop or Shrine still
requires full inventory authoring even when no offer is purchased.

## Timeline transaction contacts

| Transaction             | Native contact                                                                    | Current status                                                                    |
| ----------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Acquisition             | `UseLoot` or `UseConsumableItem`, plus producer-specific creation/unwrap contacts | Covered subject to the carrier matrix in Rewards and items.                       |
| Encounter interaction   | encounter/NPC-specific menu contact                                               | Covered for F/G and Nemesis; future-biome contacts deferred.                      |
| Shop purchase           | `HandleStorePurchase` or `RemoveStoreItem`                                        | Covered. Payment does not settle a later trait or level acquisition.              |
| Well purchase           | `HandleStorePurchase`                                                             | Covered.                                                                          |
| Travel Deal Well refill | `RestockWorldItem` and `SpawnStoreItemInWorld`                                    | Covered.                                                                          |
| Pool sale               | `CreateSellButtons`, `HandleSellChoiceSelection`                                  | Covered.                                                                          |
| Keepsake change         | `EquipKeepsake` after a real rack selection                                       | Covered. Opening/closing the rack without changing keepsake is not a transaction. |
| Fountain use            | `UseHealthFountain`                                                               | Covered.                                                                          |
| Automatic               | effect-specific callbacks                                                         | Covered for the closed four-effect union.                                         |

Dependencies are planner-published ordering constraints between transaction
owners. The executor checks only those edges; it must not infer semantic rules
such as "Travel Deal goes first" or "Phial follows a rack change." Obligations
are the independently published subset that must complete by a checkpoint.
Non-obligation transactions may remain incomplete without blocking the room.

## Doors contacts

Normal door rooms and rewards are realized during native outgoing generation
through `ChooseNextRoomData`, `IsRoomRewardEligible`, `ChooseRoomReward`, and
`DoUnlockRoomExits`. Chaos and Zagreus Contract are additional exits and retain
their dedicated native spawning contacts. `UseExitDoor` selects the next room;
it is not a reason to compare every native transition string.

For those additional exits, Overview is the authoritative declaration that the
feature must spawn, but Navigation owns the resulting Door. At Doors-open it
proves the complete additional-door set and each Door's occurrence, kind, and
destination alongside the normal Door product. Room-exit conformance checks
only retained state caused by the feature, such as consumption of an Ixion
charge; it does not re-prove topology.

The blocking comparison boundary is:

- room identity and authored Overview content after room entry;
- normal and additional door room/reward facts when doors open;
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
Hermes Shrine delivery is deferred route; its purchase and later delivery must
remain separate contacts, with delivery—not payment—owning the acquisition.
