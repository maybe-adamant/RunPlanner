# Schema bundle candidates

Question: which planner model corrections found during Record mode gap work
need an authored-shape change (a major schema bump)? They are collected here
and shipped as one migration, not one bump each. Corrections confined to the
catalog or engine land individually and are not listed.

Status: open, collecting. It becomes a locked plan once the capture checklist
and the door-order probe are done.

## Candidates

### Contract pedestal in every Preboss

- **Finding:** the Zagreus Contract pedestal spawns in every Preboss that
  declares a pedestal destination while the hero holds `InfernalContractBoon`,
  whatever the room's reward. `SpawnZagContractRewards`
  (`EventLogic.lua:1900-1935`) is a room-level `ShopRoomEvents` entry
  (`EncounterSets.lua:386-412`). It never reads the reward or the store, and
  `SetupWorldShop` (`StoreLogic.lua:454`) skips only the Charon shop when there
  is no store.
- **Affected rooms:** the F, G, H and P Prebosses in their boon form. N, O and
  Q are always the Shop form, and I always has its static World Shop.
- **Planner today:** the pedestal is a Shop offer end to end, so a boon-form
  Preboss cannot hold it.
  - authored state: `room-state/defaults.ts:283-322`, `shop-codec.ts:128-150`,
    `authored-project/shop.ts`;
  - simulation: shop inventory and settlement, the `shopInventory` offer point,
    `materializeShopEntry`;
  - execution plan: `overview.shop.infernalContract`;
  - game module: `protocol/overview.lua:121-168`, `world_shop.lua:25`;
  - app: shop projections.
- **Evidence:** live recording Run 1008, G_PreBoss01 (boon form, Demeter):
  `StackUpgradeBig` used, HestiaCastBoon level 3 → 5.
- **Correction:** a Preboss-owned pedestal feature shared by both forms. It
  touches authored state, simulation, the plan wire, the game module, the app
  and the importer.

### Door and ship-wheel rerolls

- **Finding:** a door reroll (the `DoorReroll` arcana sets `AllowDoorReroll`;
  `InteractLogic.lua:1351-1443`) calls `ChooseRoomReward` again. That removes a
  second entry from `CurrentRun.RewardStores` (`RewardLogic.lua:178`) and never
  returns the first. Door order is unchanged. `OfferedRewards` is overwritten
  with the final roll, and a new roll excludes types already offered. The
  ship-wheel reroll (`InteractLogic.lua:1468`) follows the same path.
- **Not a candidate:** a boon screen reroll (`RerollBoonLoot`,
  `UpgradeChoiceLogic.lua:707-718`) re-rolls only that screen's options. The
  store, loot history and bans are untouched, and only the final screen is
  logged. The final screen is enough.
- **Planner today:** rerolls are not modeled, so the plan keeps the spent
  entries wrong and later bag draws drift. The store-diff inferences for
  unentered Fields doors and unpicked wheel offers are also corrupted.
- **Evidence:** source only. Run 1010 had two screen rerolls (G_MiniBoss02,
  G_PreBoss01), with `NumRerolls` 10 → 9 → 8 and no store diff. It had no
  door reroll.
- **Detection without a model:** `NumRerolls` decreases in a bracket whose
  store loss exceeds the doors offered.
- **Correction:** a modeled door and wheel reroll input that spends the extra
  entry.

### N hidden return-door draws

- **Finding:** every N main and side room has a hidden return door
  (`EphyraExitDoorReturn`, `ObstacleDataN.lua:90-100`: `HideRewardPreview`,
  `ReturnToPreviousRoomName = "N_Hub"`). When the room's exits unlock on its
  first visit, `DoUnlockRoomExits` (`RoomLogic.lua:3916-3947`) creates a
  placeholder next room for that door and takes one reward draw.
  - Main rooms draw from HubRewards (`ForcedRewardStore`,
    `RoomDataN.lua:2849`), refilling with 10 when the store is empty.
  - Side rooms draw from SubRoomRewards or SubRoomRewardsHard
    (`IndividualRewardStore`, `RoomDataN.lua:3795`).
  - A placeholder forced to a Shop draws nothing.
  - Restores do not draw again: a revisit returns the stored offer before
    the store is touched (`RewardLogic.lua:108-114`).
- **Planner today:** the catalog declares the return exit
  (`declarations/rooms/n/hub-main.ts:32`, `side.ts:20`), but nothing draws
  for it. The plan's N bags are one entry richer after every cleared
  parent, and later board draws and refill timing drift.
- **Evidence:** Surface capture. The extra removals match the return doors'
  `OfferedRewards` one for one: N_Sub01 → RoomMoneyTinyDrop; N_Combat14,
  N_Combat06 and N_Combat10 → Boons; N_Combat01 → HermesUpgrade. Import
  conformance flags the drift at rooms 5, 8, 10, 12 and 14.
- **Correction:** an authored hidden-draw leaf per first-visit N parent.
  The drawn entry is random, so it must be authored like a visible door
  reward. The record already holds it in the return door's
  `OfferedRewards`.
- **Open:**
  - Does the draw affect the exclusion set of the parent's own side-door
    batch?
  - Which placeholders are forced to a Shop (`ChooseNextRoomData`)?
