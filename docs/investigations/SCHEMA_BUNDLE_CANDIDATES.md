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
