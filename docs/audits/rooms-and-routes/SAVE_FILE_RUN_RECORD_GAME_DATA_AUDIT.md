# Save-File Run Record Game-Data Audit

## Status and scope

Source audit completed on 2026-10-26 against installed Hades II build
`25481925` (`Content/Scripts`, `Content/Maps`) and two complete save captures
of runs played with no gameplay mod active (a mod loader was installed, so the
header flag reads `0x0001`), each holding every save write of one run:

- **Capture S**: a Surface run ending on the biome timer at `O_Boss02`, under
  heavy Fear (all sixteen Vows active, including Forfeit, Menace, Fangs,
  Return, and shop prices at rank 2).
- **Capture U**: an Underworld victory at `I_Boss01` under light Fear
  (`EnemySpeedShrineUpgrade` 2 and `BiomeSpeedShrineUpgrade` 3 only).

This audit records what the save files of a vanilla run reveal about that run:
the container format, which files are written when, run boundaries, and which
run facts are exact, inferable, or lost. It describes save evidence only; game
rules for the underlying mechanics stay with the audits linked below.

The route is the spine of the record: every recovered fact attaches to a
`RoomHistory` position, which is why this audit lives under rooms and routes.

## Container

Every `.sav` file is little-endian:

| Offset | Field                             | Notes                                                                                                                                                               |
| ------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0      | magic `SGB1`                      |                                                                                                                                                                     |
| 4      | `u32` checksum                    | Adler-32 of bytes 8 to end of file; holds for all 112 full saves in both captures.                                                                                  |
| 8      | `u16` format version, `u16` flags | Format version `0x12` in every save. Flags `0x0001` on some profiles of the capture machine (every capture save) and `0x0000` on others; see Uncertainties.         |
| 12     | `u64` timestamp                   | Unix seconds of the write.                                                                                                                                          |
| 20     | string location                   | `GameState.LocationName` text key, e.g. `Location_BiomeF`, `Location_Home`.                                                                                         |
| then   | `u32` run count                   | Equals `#GameState.RunHistory` in every save.                                                                                                                       |
| then   | `u32`                             | `0` in every save; meaning unknown.                                                                                                                                 |
| then   | `u32` Fear                        | Equals `GameState.SpentShrinePointsCache` (62 in capture S, 12 in capture U).                                                                                       |
| then   | `u32`, `u32`, 2 bytes             | `30`, `582358`, `0000` in every save; meaning unknown.                                                                                                              |
| then   | `u32` count + strings             | Display list of Vow, weapon, and trait names, ending with a `DevSaveName=Run N, Depth D, <room>, <encounter> (<reward> or PostReward)` label; `N` is run count + 1. |
| then   | string `mapName`                  | Map being left or current map.                                                                                                                                      |
| then   | string `nextMap`                  | Map to load next; empty for a PostReward checkpoint.                                                                                                                |
| then   | `u32` compressed length           | Equals the remaining file length.                                                                                                                                   |
| then   | LZ4 block                         | Raw LZ4 block; the decompressed size is not stored (about 3.3 MB observed).                                                                                         |

Strings are a `u32` length followed by UTF-8 bytes.

The decompressed payload is luabins: a `u8` value count (always 1), then
tagged values: `-` nil, `0` false, `1` true, `N` an `f64`, `S` a `u32` length
and bytes, `T` a `u32` array size and `u32` hash size followed by that many
key/value pairs. The single value is a table of the globals named in
`GlobalSaveWhitelist` (`SaveLogic.lua:1`): `GameState`, `CurrentRun`,
`MapState`, `AudioState`, `CodexStatus`, `NextSeeds`, `Revision`,
`RevisionFirstSave`, `_worldTime`, `_worldTimeUnmodified`; `StoredGameState` and
`CurrentHubRoom` were absent in both captures.

`Profile1.v.sav` is 9 bytes: `SGB1`, `u32` `18`, and one validity byte written
by `ValidateCheckpoint`. It was `1` after each room checkpoint and `0` after
in-room actions that call `InvalidateCheckpoint` (`RunLogic.lua:2698`) and at
death.

## Files and write cadence

All run saves go through `RequestSave` (`RunLogic.lua:2717`). A call with
`SaveName = "_Temp"` writes `Profile1_Temp.sav`; a call without it writes the
hub profile `Profile1.sav`.

- **Entry checkpoint.** `LeaveRoom` (`RoomLogic.lua:4159`) appends the departed
  room to `RoomHistory` (`RoomLogic.lua:4373`), chooses the next room's
  encounter and Fields cage encounters (`RoomLogic.lua:4380`, `:4386`),
  generates its shop stock (`RoomLogic.lua:4394`), then writes `_Temp`
  (`RoomLogic.lua:4403`) unless the room sets `SkipSave`. Exactly one entry
  save per entered room was observed.
- **PostReward checkpoint.** When room exits unlock, `_Temp` is written again
  (`RoomLogic.lua:3837`) unless the encounter sets `SkipExitReadyCheckpoint`.
  `NonCombat` (`EncounterData.lua:43`) sets it, so `Empty`, `Shop`, Story, and
  fountain encounters have none: Hub, Intro, Shop, Preboss, Postboss, Story,
  Reprieve, and Chaos rooms were all observed without one. Arachne,
  Nemesis random-event, Anomaly, and `BossZagreus01` encounters also set it
  (`EncounterData_Arachne.lua:7`, `EncounterData_Nemesis.lua:28`,
  `EncounterData_Challenge.lua:189`, `EncounterData_Boss.lua:1575`).
- **Run start.** `StartOver` (`DeathLoopLogic.lua:548`) calls `EndRun`
  (`:569`), `StartNewRun` (`:579`), and writes the first `_Temp` (`:598`).
- **Run end.** `KillHero` (`DeathLoopLogic.lua:2`) writes the hub profile
  (`:243`). Later hub room moves and loadout changes rewrite it
  (`DeathLoopLogic.lua:310`, `:742`) with the same finished run.
- **I endings.** Two I-biome ending presentations write `_Temp` for
  flashback and credits maps (`PresentationBiomeI.lua:1579`, `:2210`); neither
  capture reached them.
- **Backups.** Each save file has a one-deep `.bak` copy of its previous
  version. `Profile1.sav` also keeps numbered `.bak1` to `.bak7` snapshots at
  irregular intervals. Rotation is engine-side; no script refers to it.

`Save()` (`SaveLogic.lua:207`) shapes every file:

- `StripRoomsForSave(CurrentRun, true)` reduces every `RoomHistory` entry
  except the last to `RoomSaveWhitelist` (`SaveLogic.lua:87`) and its
  encounters to `EncounterSaveWhitelist` (`SaveLogic.lua:116`: `Name`,
  `RewardStoreName`, Nemesis and Heracles shopping, obstacles). The last entry
  is the room just departed, so each entry save carries that room's complete
  final state; this audit calls it the departure record.
- `MapState` is always `{}`: `Save()` iterates `ipairs` over
  `MapStateWhitelist`, a lookup table (`SaveLogic.lua:125`, `:213`). Spawn
  points, offered exit doors, and ship wheels never reach a save.
- `CurrentRun.CurrentRoom` is saved unstripped.

## Run boundaries and identity

- **Start.** The first `_Temp` of a run has header `mapName` `Hub_PreRun`,
  `nextMap` the opening room, an empty `RoomHistory`, `GameplayTime` `0`, and
  `RunDepthCache` `1`. Observed in both captures.
- **Victory before the end.** `RecordRunCleared` (`RunLogic.lua:2037`) sets
  `Cleared` and calls `RecordRunStats` (`RunLogic.lua:1945`), which sets
  `RunResult` and `EndingRoomName`. Capture U's post-boss PostReward `_Temp`
  already carries `Cleared true` and `RunResult 1` with `Hero.IsDead` unset.
- **End.** `KillHero` sets `KilledByName` and `Hero.IsDead`
  (`DeathLoopLogic.lua:38`, `:52`), runs `RecordRunStats` (`:66`) and
  `InvalidateCheckpoint` (`:69`), appends the final room to `RoomHistory`
  (`:133`), and writes the hub profile. Victory reaches the same path through
  `Kill(CurrentRun.Hero)` (`RoomPresentation.lua:1877`). The end is therefore a
  non-`_Temp` save with `Hero.IsDead true` and `RunResult` set; values follow
  `RunResultData` (`RunHistoryData.lua:645`: 1/3 success, 2/4 fail, 9/10
  Dream). Capture S ended with `RunResult 4` and `KilledByName BiomeTimer`.
- **The end save is not a build snapshot.** In both captures the hub save keeps
  one `Hero.Traits` entry and an empty `SlottedTraits`; the final build is in
  the last `_Temp`. Its departure record of the final room is unstripped.
- **History.** `EndRun` (`RunLogic.lua:1848`) appends the finished run to
  `GameState.RunHistory` only at the next `StartOver`. Both end saves still held
  the previous run as the last `RunHistory` entry.
- **Identity.** No run id or start time exists in `CurrentRun`. The header run
  count is constant from the first `_Temp` through the end save and increases by
  one per started run (1002 in capture S, 1003 in capture U); the first save's
  header timestamp marks the start.
- **Resume.** `OnAnyLoad` (`RoomLogic.lua:180`) restores the saved
  `CurrentRun` verbatim and calls `RestoreUnlockRoomExits` for a PostReward
  checkpoint, otherwise `StartRoom` (`RoomLogic.lua:233`–`:236`). No script
  saves on load, so a resume adds no write; progress after the last checkpoint
  is lost. Source-only: neither capture resumed.
- **Quit to menu.** No script handles it. Unverified: which file the engine
  loads afterwards and whether an abandoned run's `_Temp` survives.

## Field inventory

Status: **exact** (read directly), **inferred** (derived by the stated rule),
**source-only** (saved per source, not exercised by either capture), **lost**
(not saved). "Bracket" means the change between two consecutive saves of the
same room, attributing it to that room.

### Route and rewards

| Fact                                 | Save source                                                                                                   | Status |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------ |
| Route family, biome order            | `CurrentRun.BiomeVisitOrder`, `BiomesReached`, `IsDreamRun`                                                   | exact  |
| Visited rooms in order               | `RoomHistory[i].Name`; run depth = index + 1                                                                  | exact  |
| Encounter per room and phase         | `Encounter.Name`; multi-phase rooms list `Encounters`                                                         | exact  |
| Offered doors and their rewards      | `ExitDoorRooms` (door id to room), `OfferedRewards` (door id to `Type`, `ForceLootName`, Devotion loot names) | exact  |
| Taken door                           | next `RoomHistory` name                                                                                       | exact  |
| Room reward and store                | `ChosenRewardType`, `Reward`, `RewardStoreName`, `ForceLootName`                                              | exact  |
| N Hub board and side-room generation | `PredeterminedDoorRooms` in the departure record or entry save                                                | exact  |
| Collected pickups and uses per room  | `UseRecord` (`RecordUse`, `InteractLogic.lua:292`)                                                            | exact  |
| Reward-store consumption             | `CurrentRun.RewardStores` bracket diff                                                                        | exact  |
| Tartarus non-goal reward cap         | `CurrentRun.MaxClockworkNonGoalRewards`, rolled once by `InitClockworkGoalReward` (`RewardLogic.lua:277`)     | exact  |
| Fresh-profile first attempt          | header run count zero (`#GameState.RunHistory`, which only `EndRun` grows, `RunLogic.lua:1848`)               | exact  |

`UseRecord` of a room revisited in N (Hub, a combat room re-entered from a side
room) is shared across its `RoomHistory` entries; per-visit uses come from
diffing successive departure records.

A Trial door's two loot names are its `LootAName` and `LootBName`
(`RewardLogic.lua:268-273`), not the player's choice; the god whose screen
opens first in the room is the chosen one (`StartDevotionTest`,
`EncounterLogic.lua:1682`).

### Boon and Chaos screens

`LogUpgradeChoice` (`UpgradeChoiceLogic.lua:1160`) appends one
`LootChoiceHistory` entry per completed screen: `UpgradeName` (giver), `Depth`,
and `UpgradeChoices` of `{Name, Rarity, Chosen}` with `"true"`/`"false"`
strings, plus `TraitToReplace`/`OldRarity` for replacements. Blocked options
are omitted. `Depth` is `#RoomHistory` at pick time, so the screen belongs to
`RoomHistory[Depth + 1]` (1-based), the room where it was opened. Exact for
options, rarity, and pick. Several screens in one room share a depth (capture
U: two each in `H_Combat15` and `H_Combat07`).

- Chaos screens log the blessing only; the paired curse is the
  `SecondaryItemName` and is not logged. The chosen curse appears in
  `Hero.Traits` in the same bracket, its `RemainingUses` at that first save
  being its rolled duration; its rolled magnitudes, and its pending
  blessing's under `OnExpire.TraitData`, sit in the native fields the
  catalog declares per Chaos operand, which the record keeps. Under Vow of
  Denial, `HandleUpgradeChoiceSelection` writes each
  unpicked button's `Data.Name` (on a Chaos screen, its curse) to
  `CurrentRun.BannedTraits` in button order up to `numBans`
  (`UpgradeChoiceLogic.lua:974-989`), so the bracket's newly banned names
  recover those curses; for god boons they name the banned unpicked boons.
  Without Denial the unpicked curses are lost, but inert.
- Concave Stone's extra pick, made under its `DoubleBoonChance` roll, is not
  logged (`UpgradeChoiceLogic.lua:990`); the game picks a random unpicked
  non-replacement option of the same screen (`:1002-1023`). The trait diff
  shows it as an acquisition no screen of the room chose, one of the screen's
  unpicked options, timestamped after that screen's pick and before the room's
  next one. Inferred while the Stone is held (live Underworld recording:
  `HestiaManaBoon` after the Hestia screen in `H_Combat07`).
- Rerolls leave only `NumRerolls` and the pre-reroll options are lost. A
  screen reroll (`AttemptPanelReroll`, `InteractLogic.lua:1311`) also counts
  in `CurrentRoom.SpentRerolls` by screen id, the n-th reroll of one screen
  costing n, and draws nothing from the stores; `SpentRerolls` survives only on
  the departed room's history entry. A door or ship-wheel reroll
  (`AttemptReroll`, `:1351`) costs 1, leaves no mark of its own and draws a
  fresh reward from the stores (`AttemptRerollDoor`, `AttemptRerollShipWheel`),
  so it is inferred where `NumRerolls` falls beyond the room's screen rerolls
  and the stores lose more than the bracket's offers and known rolls. Run 1010
  rerolled two boon screens (`G_MiniBoss02`, `G_PreBoss01`) and no door.
- A Forfeit skip increments `CurrentRun.BiomeBoonSkipCount` in the bracket of
  the room whose boon it replaced and spawns `RoomRewardConsolationPrize`
  (`ShrineLogic.lua:917`); the prize appears in `UseRecord` only when collected
  (capture S: `N_Opening01` collected; in `O_Combat06` the Time Piece
  converted it). Exact by bracket. See
  [Initial trait offers and Fear pressure](../traits/TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md).

### Loadout

| Fact                      | Save source                                                             | Status            |
| ------------------------- | ----------------------------------------------------------------------- | ----------------- |
| Weapon                    | `Hero.Weapons` keys                                                     | exact             |
| Aspect, Familiar          | `Hero.SlottedTraits.Aspect` / `.Familiar`, `GameState.EquippedFamiliar` | exact             |
| Starting keepsake         | `Hero.SlottedTraits.Keepsake` in the first `_Temp`                      | exact             |
| Arcana and card level     | `GameState.MetaUpgradeState[*].Equipped` and `.Level`                   | exact             |
| Fear Vow ranks            | `GameState.ShrineUpgrades` in the first `_Temp`                         | exact             |
| Aspect and keepsake level | `Rarity` of the aspect and keepsake traits in `Hero.Traits`             | exact             |
| Familiar level            | `StackNum` of the familiar trait                                        | exact             |
| Keepsake swaps            | `UseRecord.GiftRack` plus the keepsake change in `Hero.Traits`          | exact             |
| Embryo blessings          | Chaos blessings gained after the Embryo equips, rolled fields included  | inferred by cycle |

`GameState.LastAwardTrait` in the end save is the last swapped keepsake, not the
starting one.

### Encounters, Fangs, and Menace

| Fact               | Save source                                                                         | Status      |
| ------------------ | ----------------------------------------------------------------------------------- | ----------- |
| Generated waves    | entry-save `CurrentRoom.Encounter.SpawnWaves`: ordered types, `TotalCount`, budgets | exact       |
| Multi-phase waves  | each `Encounters[k].SpawnWaves`                                                     | exact       |
| Blocked types      | `Encounter.Blacklist`, spawn `GeneratorData.BlockEnemyTypes`                        | exact       |
| Fangs attributes   | `Encounter.EliteAttributes` (elite type to perk list) in PostReward or departure    | exact       |
| Fig Leaf skip      | `SpawnsSkipped` on the started phase or cage encounter, PostReward or departure     | source-only |
| Kills              | `CurrentRoom.Kills` (`CombatLogic.lua:3855`), PostReward or departure record        | exact       |
| Menace conversions | rolled `SpawnWaves` versus `Kills`                                                  | inferred    |

Older `RoomHistory` entries keep only the encounter name and store; waves
survive in the room's own entry save, PostReward save, and departure record.
Observed counts match the generator rule in
[Enemy formation and Fear Vows](ENEMY_FORMATION_AND_FEAR_VOW_GAME_DATA_AUDIT.md)
(each type at least one; the final type takes the rounded-up remainder) for all
56 distinct generated waves in both captures.

Fangs attributes are written by `PickEncounterEliteAttributes`
(`RoomLogic.lua:5297`) at encounter start, so the entry save lacks them.
Room-level `CurrentRoom.EliteAttributes` is a different field.

A Fig Leaf skip sets `SpawnsSkipped` on the encounter table at its start
(`HandleEncounterPreSpawns`, `EncounterLogic.lua:352-372`, or
`HandleEnemySpawns`, `:479-497`), which the saved `CurrentRoom.Encounter`,
`Encounters` or cage `Encounter` carries, so it is exact like the Fangs
attributes. A skipped first phase that declares `SkipEndEncounterEffects`
also marks every later phase of `Encounters`, those with
`MultiEncounterSpawnSkip`; the first phase owns the skip. No capture skipped an
encounter. The live Underworld recording predates the record's skip mark: its
skips show as rolled phases with no kills (`G_Combat05`, `H_Combat05`'s second
cage, `I_Combat11`), which identify a skip only while Fig Leaf's effect can
still trigger.

Menace swaps a shallow copy of the spawn request inside `HandleNextSpawn`
(`EncounterLogic.lua:783`–`:808`) without rewriting `SpawnWaves`. A source type
whose kills fall short of its rolled count, matched by kills of next-biome
types never rolled, identifies conversions (capture S `N_PreHub01`: Carrion 10
rolled, 6 killed; Mudman 2 and 1; Scimiterror 4 and Stickler 1 killed). Noise:
summoned children, breakables and props, Return respawns, later phases, and
enemies left alive. `Kills` is per room, so a conversion's wave is exact only
when its source type occurs in one wave.

### Shops and the Hermes Shrine

| Fact                         | Save source                                                                                                             | Status   |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| World Shop and Well stock    | entry-save `CurrentRoom.Store.StoreOptions`; a room whose map lacks a `ChallengeSwitchBase` still rolls Well stock      | exact    |
| Purchases                    | departure record: bought options removed from `StoreOptions` (`StoreLogic.lua:326`), `StoreItemsPurchased`, `UseRecord` | exact    |
| Final prices of unsold items | departure record `Store.SpawnedStoreItems[*].ResourceCosts`                                                             | exact    |
| Price paid                   | base cost times the multiplier below                                                                                    | inferred |
| Purchase order               | none                                                                                                                    | lost     |
| Hermes Shrine stock          | entry-save `Store.StoreOptions` with `SurfaceShopChanceSuccess`                                                         | exact    |
| Hermes Shrine purchases      | `CurrentRun.SurfaceShopPurchases` and `UseRecord.SurfaceShop` counts, `UseRecord` item names                            | exact    |
| Hermes delivery delay        | pending `StorePendingDeliveryItem` trait (`RoomDelay`, costs) while undelivered                                         | exact    |
| Hermes delivery room         | the room whose `UseRecord` gains the pending item                                                                       | inferred |
| Travel Deal refill           | departure record `SpawnedStoreItems` holds the refill's kit id and cost but no name                                     | lost     |

Base costs: Boon options carry `Args.ResourceCosts`, some consumables carry
`CostOverride`, the rest come from `ConsumableData.lua`. The multiplier
(`GetShopCostMultiplier`, `StoreLogic.lua:679`) is the Price Vow value (1.4 or
1.8; `MetaUpgradeData.lua:1650`) times the product of `StoreCostMultiplier`
traits, and on a room's first purchase with Travel Deal the product minus
`1 - FirstPurchaseDiscount` (0.95). Prices are rounded per item (boons
`RoomLogic.lua:2285`, consumables `InteractLogic.lua:887`). Capture U matched it
at 150 × 0.95 → 143 and 650 × (0.7 − 0.05) → 422. The Hermes Shrine adds a
rolled delay (`SurfaceShopLogic.lua:117`) priced by `DelayPriceDiscount`
(`SurfaceShopData.lua:1`) and a 1.5× rush (`SurfaceShopLogic.lua:393`) that
adds a second count to `SurfaceShopPurchases`; capture S totals matched both.

### Room features and run items

| Fact                          | Save source                                                                                                                                                                                                                                                                                                                 | Status                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Stygian Well                  | stock in entry `Store`; purchases by bracket diff of cumulative `CurrentRun.WellShopPurchases` (`StoreLogic.lua:1169`), `UseRecord.WellShop`                                                                                                                                                                                | exact                          |
| Pool of Purging               | departure record `SellOptions` (offered slots, sold slot removed, `SellTraitLogic.lua:333`); `UseRecord.SellTraitShop` counts opens; `TraitsSold` counts sales; sold trait by `Hero.Traits` diff                                                                                                                            | exact                          |
| Anvil of Fates                | World Shop purchase `ChaosWeaponUpgrade`, then the hammer swap as a `Hero.Traits` diff                                                                                                                                                                                                                                      | inferred                       |
| Path of Stars                 | `Hero.SlottedSpell`: spell name and `Talents` layout with `Invested` flags                                                                                                                                                                                                                                                  | exact                          |
| Spell Drop                    | picked spell only (`SlottedSpell.Name`); its position by the bonus points the first Path screen spends (`SpellTalentData.InitialBonuses`)                                                                                                                                                                                   | exact; options lost            |
| Chaos gate                    | source room `ExitDoorRooms` and `OfferedRewards` (`TrialUpgrade`), `ForceSecretDoor`, `SecretDoorHealthCost`, `UseRecord.SecretDoor`; the Chaos room in `RoomHistory`                                                                                                                                                       | exact                          |
| Artificer conversion          | `CurrentRun.MetaConversionUses` increment (`GiftLogic.lua:20`) in the room's bracket; the replacement in `UseRecord`; its RunProgress roll in the store diff                                                                                                                                                                | inferred                       |
| Time Piece conversion         | `GoldifyKeepsake.BoonConversionUses` decrement (`GiftLogic.lua:117`) in the room's bracket, with the gold gain; the converted reward never reaches `UseRecord`                                                                                                                                                              | exact by bracket               |
| Judgment and Crystal Figurine | Arcana cards gained in `CurrentRun.TemporaryMetaUpgrades` in the boss room's bracket; their traits join `Hero.Traits` in draw order with the card as `SourceName`, Judgment's call before the Figurine's (`CombatLogic.lua:3969-3980`, `EncounterLogic.lua:1640-1654`, `AddRandomMetaUpgrades`, `MetaUpgradeLogic.lua:499`) | exact                          |
| Fountains                     | `UseRecord.HealthFountain*`                                                                                                                                                                                                                                                                                                 | exact                          |
| Resource points               | `Num*Points` per room records presence; the room whose point granted a tool's element by `CurrentRun.ToolElementsSpawned` bracket diff (`GrantElementFromTool`, `HarvestLogic.lua:266`, once per tool per run); `FishCaught` names carry the biome letter                                                                   | element room exact; point lost |

Artificer converts a dropped MetaProgress pickup into a fresh RunProgress roll
(`GiftLogic.lua:1`–`:40`); see
[Fields optional rewards and Artificer](../rewards-and-acquisition/FIELDS_OPTIONAL_REWARDS_AND_ARTIFICER_GAME_DATA_AUDIT.md).
Chaos rules are in [Route detours](ROUTE_DETOURS_GAME_DATA_AUDIT.md).

### Thessaly ship wheels

`ShipsEncounterSetup` (`RoomLogic.lua:1375`) rolls one wheel or, with
`TwoRewardChoiceChance` 0.8 (`EncounterData_Generated.lua:836`), a left then a
right wheel from one store. Every roll runs `ChooseRoomReward`, which removes
the entry from `RewardStores` whether picked or not (`RewardLogic.lua:177`).
`UseShipWheel` (`RoomLogic.lua:1464`) writes the pick to the encounter. Wheel
rules are in [O game rules](../../biomes/O_GAME_RULES.md).

| Fact                  | Save source                                                                                                    | Status   |
| --------------------- | -------------------------------------------------------------------------------------------------------------- | -------- |
| Encounter count       | entry-save `len(CurrentRoom.Encounters)`                                                                       | exact    |
| Store and picked type | `Encounters[k].RewardStoreName` and `.EncounterRoomRewardOverride`, per setup, from the PostReward save        | exact    |
| Picked boon god       | the matching `LootChoiceHistory` screen, or `CurrentRoom.ForceLootName` for the last setup                     | exact    |
| Offer count and side  | `UseRecord` key: `ShipsSteeringWheel` (one offer) or `ShipsSteeringWheelLeft`/`Right` (two, left rolled first) | inferred |
| Unpicked type         | store bracket diff, minus the picks, minus Artificer rolls                                                     | inferred |
| Unpicked boon god     | none: the god is an RNG draw recorded nowhere                                                                  | lost     |

A room with one left and one right pick across two setups cannot assign sides
to setups. Capture S `O_Combat05`: MetaProgress lost `GiftDrop` and the picked
`MetaCardPointsCommonBigDrop`; RunProgress lost the picked `SpellDrop`,
`MaxManaDrop`, and `MaxHealthDrop`, the last being the Artificer roll that
replaced the Meta pickup.

### Mourning Fields

| Fact                  | Save source                                                                                                                                                                | Status                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Cage rewards          | `CurrentRoom.CageRewards[i]` `{RewardType, ForceLootName, Encounter}` from the entry save                                                                                  | exact                  |
| Untaken door cages    | `RewardStores` loss across the door-creation bracket, less the entered room's rolls and the door offers; one offer-less untaken door, no refill                            | inferred; gods lost    |
| Cage point            | `CageRewards[i].Encounter.EligibleSpawnPoints`, written on opening (`EncounterLogic.lua:2936`), names a spawn group whose map ids identify the `RewardCageSpawnPoints` key | inferred               |
| Player entry          | `CurrentRoom.HeroStartPoint` / `HeroEndPoint` from the PostReward save                                                                                                     | exact                  |
| Uncollected optionals | `Encounter.RewardsToRestore[objectId]` `{RewardOverride, SpawnRewardOnId}` (`RoomLogic.lua:5738`)                                                                          | exact                  |
| Collected optionals   | `UseRecord` by type; `RewardsToRestore` drops them on pickup or conversion (`InteractLogic.lua:1126`, `GiftLogic.lua:39`)                                                  | type exact, point lost |
| Optional count        | uncollected plus collected                                                                                                                                                 | inferred               |
| Fields Nemesis point  | `SpawnNemesisForRandomEvents` keeps it only in session state (`EncounterLogic.lua:242`)                                                                                    | lost                   |

The cage's own `SpawnPointId` lives on the map object (`RoomLogic.lua:5695`)
and is not saved. A cage on a point with no `RewardCageSpawnPoints` entry gets
no `EligibleSpawnPoints`; its point follows by elimination when every other
cage resolves. The point inventories and the `H_Combat13` table/map mismatch
are owned by
[H Fields spatial points](H_FIELDS_SPATIAL_POINTS_GAME_DATA_AUDIT.md). Take
optionals from the departure record: the PostReward snapshot predates later
pickups.

### Acquisition order and timing

`Hero.Traits` is an array in insertion order, and every trait added during a
run carries an `Id` built by `GetTraitUniqueId` (`TraitLogic.lua:593-597`) as
the concatenation of the trait count, the run depth (`1 + #RoomHistory`),
`_worldTime` and a random float, with no separators. The random part always
begins `0.`, and the count and depth are bounded by the trait's position and
the room list, so the world time parses out, and where several splits fall
between the two checkpoints the room's depth picks one; every save also stores
its own `_worldTime`. Relaunching the game restarts `_worldTime` from zero
while `TotalTime` continues from the save (run 1010, `G_Combat05`), so the
window after a relaunch starts at zero. Together they order and timestamp every trait-granting acquisition (boons, hammers, Chaos
blessings, talents, keepsakes and swaps, Max Health and Max Magick traits,
pending Hermes deliveries, Essences) and place each one between two
checkpoints. A trait later removed (sold, swapped, expired) survives only in
the checkpoints taken while it was held. Gold, fountain heals, and consumables
that add no trait carry no timestamp; `UseRecord` and `ConsumableRecord` are
counters without order.

## Never saved

- Intra-room action order beyond the entry, PostReward, and departure brackets.
- Purchase order within a shop.
- Pre-reroll boon options; Chaos curses of unpicked options without Vow of
  Denial, and every unpicked Chaos option's duration.
- Spell Drop unpicked options.
- The physical resource point, and the room of a gather that granted no
  element.
- The Chaos gate spawn point (`ExitDoorRooms` keys are runtime object ids).
- The order in which a room's exit doors were generated. `DoUnlockRoomExits`
  walks `CollapseTableOrdered(MapState.OfferedExitDoors)`, whose
  `CompareGameDataTables` ties on doors sharing an obstacle name and falls
  back to `next()` table order; `MapState` is not saved. The order decides
  which door draws from the reward bag first.
- The Travel Deal refill item's identity.
- The unpicked ship-wheel boon god.
- Physical points of collected Fields optional rewards and of Fields Nemesis.

## Not exercised by either capture

Duo and Legendary offers, trait replacement screens, door and ship-wheel
rerolls, Jeweled Pom and Experimental Hammer equip results, Sea Star, Echo
replay, Cocoons, Aetos, Phial, Eris, Oceanus Anomaly, Gold Gold Gold, Travel
Deal refills at the Hermes Shrine or Well, the Fields Nemesis event, Dream
runs, Surface victory, I-biome ending saves, and quit to menu. A later
Underworld recording without raw saves exercised Steady Growth, Gorgon and
Athena, Echo's Pom, the Zagreus contract, Infernal Contract pedestals, Fig
Leaf skips and Concave Stone's extra pick; a fresh profile's first attempt is
still unrecorded. Run 1010, an Underworld attempt
reset in `H_Combat04` with every save kept, exercised Judgment and the
Crystal Figurine, Aspect of Selene with God Sent nodes, Artificer boons,
screen rerolls and a relaunch mid-run.

## Uncertainties

- Header fields after the Fear total, and the leading zero field, are
  unidentified.
- The flag word at offset 10 is `0x0001` on profiles written with a mod loader
  installed and `0x0000` on profiles that date from before it, so it is likely
  set by a mod-loader install (correlation reported by the owner), unconfirmed
  in source. Unmodded installs are therefore expected to write `0x00000012`.
  The payload format is the same under either value.
- `UseRecord.FieldsRewardCage` read 4 in capture U `H_Combat07`, which had 3
  cages; `CageRewards` is the reliable count.
- The spawn-group-to-id membership for cage points comes from the map binaries
  and was not re-derived for this audit.
- Engine-side behavior: which file "continue" loads, `.bak` rotation policy,
  quit to menu.

## Discrepancies

- Revisited N rooms share one `UseRecord` table across history entries, so
  any single history entry overstates a visit's uses.
- The end save keeps the finished run but drops `Hero.Traits` and
  `SlottedTraits`; the build and loadout must come from `_Temp` saves.
- `H_Combat13` cage mapping: see
  [H Fields spatial points](H_FIELDS_SPATIAL_POINTS_GAME_DATA_AUDIT.md#h_combat13-source-discrepancy).

## Planner disposition

- Importing an unmodded run from its saves is feasible: the route, doors,
  rewards, encounters and waves, boon screens, purchases, and feature uses are
  saved or inferable, read from the entry save, PostReward save, and departure
  record of each room plus the first and last `_Temp`.
- Facts marked lost stay unauthored and surface as findings, except where the
  project owner decided otherwise:
  - an unpicked ship-wheel boon takes the first eligible god;
  - a collected Fields optional reward takes the first free optional point;
  - aspect and keepsake levels are assumed to be maximum, although the save
    records the equipped rarity.
- A Fig Leaf skip is imported exactly from `SpawnsSkipped`. A record without
  the skip mark infers a skip at a phase Fig Leaf may skip whose rolled
  enemies the room never killed, and reports it as an assumption.
- Concave Stone's extra pick is imported as the result of the screen it
  followed.
- Judgment's and the Crystal Figurine's cards are imported exactly from the
  boss room's draw order. Aspect of Selene's tree is the run's first Spell
  snapshot without its God Sent nodes.
- Door and ship-wheel rerolls are not modelled: each inferred one is reported
  as an unsupported area, since the plan's stores keep the rewards they
  replaced.
- A batch's doors are ordered by the catalog's declared native door order for
  the source room, an exact order; a room without one takes ascending door id
  and reports the order as an assumption. The one declared room is inferred,
  pending a native door-order probe: `H_Combat05` processes door `621199`
  before `564448`. In the live Underworld recording's reward-bag replay that
  generates the Mini-Boss door first, refilling the store, so `H_Combat07`'s
  recorded Hestia cage finds a Boon; ascending id leaves it none.
