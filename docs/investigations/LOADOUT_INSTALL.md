# Loadout install

Status: open. Owner decisions recorded; open points below.

## Question

How can every planned run (normal and Practice mode) install the plan's
starting loadout instead of observing it, without changing the player's
profile?

## Owner decisions

- The module installs the starting weapon, Aspect, Arcana (cards and ranks),
  Fear (Vow ranks), keepsake and familiar for every planned run.
- The override is run-scoped: the profile's values come back after the run.
- The planner assumes a mature file, so the install ignores the player's unlocks
  and ranks.
- The starting-loadout conformance check is removed. An install failure makes
  execution passive.
- Fresh File routes install nothing; their loadout is the fixed native one.

## Evidence

Game scripts live under `1GameData/Scripts`.

- **Native precedent.** Chaos Trials back up `PrimaryWeaponName`,
  `LastWeaponUpgradeName`, `LastAwardTrait`, `EquippedFamiliar`,
  `ShrineUpgrades`, `ActiveShrineBounty` and `MetaUpgradeState`
  (`StoredGameStateInit`, `BountyLogic.lua:513-521`). They write the trial's
  loadout into GameState before `StartOver` (`BountyLogic.lua:524-731`), hold
  it for the whole run, and save it (`StoredGameState` is save-whitelisted,
  `SaveLogic.lua:4`). They restore on hub arrival and re-extract Vows and point
  caches (`BountyLogic.lua:734-753`, `DeathLoopLogic.lua:398-405`).
- **Restoring inside `StartNewRun` does not work.** Fear, Aspect identity,
  Arcana `Equipped`, keepsake and familiar are read from GameState throughout
  the run: about 60 files read Vows, plus Barren expiry re-equip, Circe, rack
  swaps and `AdvanceKeepsake`.
- **Timing.** Vow values are extracted at `RunLogic.lua:453-455`, and
  `CreateNewHero` reads the EnemyDamage Vow at `RunLogic.lua:25-29`. The swap
  must therefore precede base `CreateNewHero` and re-run
  `ShrineUpgradeExtractValues`.
- **Per input:**

  | Input    | Override for the run                                                                                                                                      | Mature-rank source                                                                                                                                           |
  | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | Weapon   | The planned primary and secondary go in `CurrentRun.Hero.Weapons` after base `CreateNewHero`. Never call `EquipPlayerWeapon` (it unlocks in the profile). | —                                                                                                                                                            |
  | Aspect   | `GameState.LastWeaponUpgradeName[weapon]`                                                                                                                 | wrap `GetWeaponUpgradeLevel`; never write `WeaponsUnlocked`                                                                                                  |
  | Arcana   | `MetaUpgradeState[*].Equipped` = the plan's set; clear `AdjacencyBonuses`; recompute `MetaUpgradeCostCache`                                               | wrap `GetMetaUpgradeLevel`; never write `.Level`. Set `Unlocked` only inside `AddRandomMetaUpgrades` calls (holding it would complete `QuestUnlockAllCards`) |
  | Fear     | `GameState.ShrineUpgrades` = configured ranks; re-extract every Vow; recompute `SpentShrinePointsCache`                                                   | —                                                                                                                                                            |
  | Keepsake | `GameState.LastAwardTrait`; `EquipKeepsake{ForceRarity}` at start                                                                                         | wrap `GetKeepsakeLevel` (scope `KeepsakeChambers` per call) so `AdvanceKeepsake` never re-equips at a lower rank                                             |
  | Familiar | `GameState.EquippedFamiliar`                                                                                                                              | wrap `GetFamiliarTraitStacks`; never write `FamiliarUpgrades`                                                                                                |

- **Grasp** is never enforced at run start or mid-run. Leave
  `MaxMetaUpgradeCostCache` alone.
- **Save and restore:**
  - The backup lives on `CurrentRun`, which is saved with it. The rank wrappers
    key off that saved marker, so they survive Save & Quit, a passive executor
    and Postboss resume.
  - The primary restore runs right after `RecordRunStats` (death and victory),
    before `KillHero`'s save. It restores GameState, re-extracts Vows and
    caches, swaps the hero weapon back, clears `TemporaryMetaUpgrades` and
    clears the backup.
  - Safety restores run in the next `StartNewRun` wrap and on a hub load with a
    backup still present.
  - A module removed mid-run leaves the planned values in the profile.
- **Practice mode** composes on top: the loadout install becomes its baseline.
  The run-wide `LastAwardTrait` is Practice mode's slotted keepsake.
- **What the plan carries:** `startingLoadout` has weapon, Aspect, Arcana
  (key, origin, rarity), Fear (configured and effective ranks), starting Hex
  and starting keepsake. **The familiar is not published** for normal runs.
  Mature Aspect and keepsake ranks are implied, not published.
- **What removing the check touches:**
  - module: `configuration`, `verifyCompleted`, the keepsake identity filter,
    the Practice familiar and configuration checks, and the weapon and Aspect
    checks in Postboss and Practice admission;
  - the status panel;
  - tests, the protocol comment, and docs (`GAME_INTEGRATION_BOUNDARY`, the
    keepsake and loadout audit, `NATIVE_CONFORMANCE_CONTACTS`,
    `FEATURE_HOOK_MAP`).
  - The contract that activation scopes are "process-local, never
    native-save-backed" changes.
- **Effects that remain:**
  - run records credit installed content (`ClearedWith*`, highest-Fear clear;
    these feed the Fated List);
  - `AdvanceKeepsake` adds real chambers to the planned keepsake;
  - Shrine bounties at planned Fear complete and drop rewards;
  - the weapon-of-the-night bonus depends on the planned weapon, which is
    unmodelled, as before.

## Disposition

Owner confirmed all open points (familiar and explicit ranks published;
starting Hex check removed; Postboss admission retired; Fresh File guard;
earned records accepted; save-backed install state accepted; Chaos Trial
refused). See `docs/progress/LOADOUT_INSTALL_PLAN.md`.
