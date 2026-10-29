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
| Ephyra hidden return door            | the return door's `ExitDoorRooms` (placeholder room) and `OfferedRewards` (its draw)                          | exact  |
| Reroll pool                          | `CurrentRun.NumRerolls`, rerolls left, at each entry save                                                     | exact  |
| Screen rerolls per room              | `CurrentRoom.SpentRerolls` by screen id, on the departed room's history entry                                 | exact  |
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
- Hovering a row while a rarity-upgrade trait with uses left is held (such as
  Calling Card's `RarityUpgradeData`) calls
  `UpgradeChoiceScreenCheckRarifyButton` (`UpgradeChoiceLogic.lua:1364`,
  `:1377-1412`), which rewrites that row's rarity in `lootData.UpgradeOptions`
  to `GetUpgradedRarity(...)` before any Rarify click, even if none follows.
  The displayed row and the granted trait are unchanged, but
  `LogUpgradeChoice` logs `UpgradeOptions`, so a recorded row can read one
  rarity too high. A click also writes the row's raised rarity there, so a
  clicked row logs its rarity after its clicks, or one step above while uses
  remain. The record keeps each source's charges left at every entry save
  (Rarify clicks, below), but never which row took a click. The importer turns
  each room's spent charges into clicks, judged by the engine one at a time:
  the picked row first, rolled at its acquired rarity less its clicks
  (repeated clicks for Calling Card), then the screen's other rows, rolled
  under their logged rarity, then its rerolled-away screens, newest first. It
  lowers a row no click explains one step only where the engine could rarify
  it from there before any click: the picked row when its acquired trait
  holds the lower rarity (an acquired rarity alone is not proof: the live
  Underworld recording logs a picked `ElementalRarityUpgradeBoon` Epic and
  acquires it Rare with no such trait held), an unpicked row when only the
  lower rarity is a legal roll, reported as an assumption. Any other unpicked
  row keeps its recorded rarity, possibly one step high.
- Rerolls leave only `NumRerolls` and the pre-reroll options are lost. A
  screen reroll (`AttemptPanelReroll`, `InteractLogic.lua:1311`) also counts
  in `CurrentRoom.SpentRerolls` by screen id (a loot's object id, which no
  screen record keeps, or `WellShop` and `SellTraits` for the Well and Pool),
  the n-th reroll of one screen costing n, and draws nothing from the stores;
  `SpentRerolls` survives only on the departed room's history entry. A door,
  ship-wheel, Fields cage or Hub board-door reroll (`AttemptReroll`, `:1351`)
  costs 1, leaves no mark of its own and draws a fresh reward from the stores
  (`AttemptRerollDoor`, `AttemptRerollFieldsDoor`, `AttemptRerollShipWheel`),
  calling `ChooseRoomReward` again: it removes a second store entry and never
  returns the first, door order is unchanged, `OfferedRewards` keeps only the
  final roll, and a new roll excludes types already offered. Such a press shows
  only where `NumRerolls` falls beyond the room's screen rerolls and the
  stores lose more than the bracket's offers and known rolls. Run 1010
  rerolled two boon screens (`G_MiniBoss02`, `G_PreBoss01`; `NumRerolls` 10 →
  9 → 8, no store diff) and no door.
- Each `N_Combat*`, `N_MiniBoss*` and `N_Sub*` room's hidden return door
  (`EphyraExitDoorReturn`) takes one extra store draw at its first doors
  unlock, recorded under that door. In the Surface capture the extra removals
  match the return doors' `OfferedRewards` one for one (`N_Sub01` →
  `RoomMoneyTinyDrop`; `N_Combat14`, `N_Combat06` and `N_Combat10` → Boons;
  `N_Combat01` → `HermesUpgrade`), with placeholders such as `N_Sub04`,
  `N_Combat19`, `N_Combat12`, `N_Combat15` and `N_Combat11`; a Mini-Boss
  whose placeholder is a combat room draws from HubRewards (Surface run 2:
  `N_MiniBoss01` → `N_Combat13`). `N_PreHub01` takes none (no store change
  before the Hub), and a revisit returns the stored offer without drawing.
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

| Fact                          | Save source                                                                                                             | Status   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| World Shop and Well stock     | entry-save `CurrentRoom.Store.StoreOptions`; a room whose map lacks a `ChallengeSwitchBase` still rolls Well stock      | exact    |
| Purchases                     | departure record: bought options removed from `StoreOptions` (`StoreLogic.lua:326`), `StoreItemsPurchased`, `UseRecord` | exact    |
| Final prices of unsold items  | departure record `Store.SpawnedStoreItems[*].ResourceCosts`                                                             | exact    |
| Price paid                    | base cost times the multiplier below                                                                                    | inferred |
| Purchase order                | none                                                                                                                    | lost     |
| Hermes Shrine stock           | entry-save `Store.StoreOptions` with `SurfaceShopChanceSuccess`                                                         | exact    |
| Hermes Shrine purchases       | `CurrentRun.SurfaceShopPurchases` and `UseRecord.SurfaceShop` counts, `UseRecord` item names                            | exact    |
| Hermes Shrine rush or delay   | departure record: a rushed option leaves `StoreOptions`, a delayed one stays `Purchased` (`SurfaceShopLogic.lua:317`)   | exact    |
| Shrine Travel Deal refill     | departure record: the first rush restocks its slot (`SurfaceShopLogic.lua:450-474`); lost when the refill is rushed     | exact    |
| Hermes delivery delay         | pending `StorePendingDeliveryItem` trait (`RoomDelay`, costs) while undelivered                                         | exact    |
| Hermes delivery room          | the room whose `UseRecord` gains the pending item                                                                       | inferred |
| World Shop Travel Deal refill | departure record `SpawnedStoreItems` holds the refill's kit id and cost but no name                                     | lost     |

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

| Fact                          | Save source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Status                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Stygian Well                  | stock in entry `Store`; purchases by bracket diff of cumulative `CurrentRun.WellShopPurchases` (`StoreLogic.lua:1169`), `UseRecord.WellShop`                                                                                                                                                                                                                                                                                                                                                                                                                                                            | exact                              |
| Pool of Purging               | departure record `SellOptions` (offered slots, sold slot removed, `SellTraitLogic.lua:333`); `UseRecord.SellTraitShop` counts opens; `TraitsSold` counts sales; sold trait by `Hero.Traits` diff                                                                                                                                                                                                                                                                                                                                                                                                        | exact                              |
| Anvil of Fates                | World Shop purchase `ChaosWeaponUpgrade`, then the hammer swap as a `Hero.Traits` diff                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | inferred                           |
| Path of Stars                 | `Hero.SlottedSpell`: spell name and `Talents` layout with `Invested` flags, keyed by depth from 1 and slot from 0 (Nacelle's third row has slot 0)                                                                                                                                                                                                                                                                                                                                                                                                                                                      | exact                              |
| Spell Drop                    | picked spell only (`SlottedSpell.Name`); its position by the bonus points the first Path screen spends (`SpellTalentData.InitialBonuses`)                                                                                                                                                                                                                                                                                                                                                                                                                                                               | exact; options lost                |
| Chaos gate                    | source room `ExitDoorRooms` and `OfferedRewards` (`TrialUpgrade`), `ForceSecretDoor`, `SecretDoorHealthCost`, `UseRecord.SecretDoor`; the Chaos room in `RoomHistory`                                                                                                                                                                                                                                                                                                                                                                                                                                   | exact                              |
| Artificer conversion          | `CurrentRun.MetaConversionUses` increment (`GiftLogic.lua:20`) in the room's bracket; the replacement in `UseRecord`; its RunProgress roll in the store diff                                                                                                                                                                                                                                                                                                                                                                                                                                            | inferred                           |
| Time Piece conversion         | `GoldifyKeepsake.BoonConversionUses` decrement (`GiftLogic.lua:117`) in the room's bracket, with the gold gain; the converted reward never reaches `UseRecord`                                                                                                                                                                                                                                                                                                                                                                                                                                          | exact by bracket                   |
| Rarify clicks                 | each held rarify source's `RarityUpgradeData.Uses`, not the trait's own `Uses`, by entry-save diff; only a click spends (`UpgradeChoiceLogic.lua:1249`), an unslotted source is removed once spent (`:1252-1253`), a Fated-opposing keepsake zeroes Calling Card (`KeepsakeLogic.lua:208-214`, `RoomLogic.lua:1223-1229`); a room spends its entry uses plus a Cherished Heirloom advance picked there (Calling Card +2, an Olympian keepsake refilled to one, `KeepsakeLogic.lua:322-323`) less the next entry's; Echo adds only in a biome intro, which has no screen; the clicked rows are not saved | count exact by room; rows inferred |
| Judgment and Crystal Figurine | Arcana cards gained in `CurrentRun.TemporaryMetaUpgrades` in the boss room's bracket; their traits join `Hero.Traits` in draw order with the card as `SourceName`, Judgment's call before the Figurine's (`CombatLogic.lua:3969-3980`, `EncounterLogic.lua:1640-1654`, `AddRandomMetaUpgrades`, `MetaUpgradeLogic.lua:499`)                                                                                                                                                                                                                                                                             | exact                              |
| Fountains                     | `UseRecord.HealthFountain*`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | exact                              |
| Phial fountain target         | the trait whose rarity rose in the fountain room's `Hero.Traits` diff (`AddRarityToTraits`, `InteractLogic.lua:769-773`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | inferred                           |
| Sea Star duplicates           | `CurrentRun.PoseidonDoubleRewardCount` bracket diff (`DoubleRewardPresentation`, `EventPresentation.lua:3198`); which pickups were duplicated is not saved                                                                                                                                                                                                                                                                                                                                                                                                                                              | count exact; pickups lost          |
| Aetos                         | `CurrentRoom.OlympusEagleSpawn`, a room flag set on spawn (`OlympusEagleSpawn`, `EventLogic.lua:1807`); its phase and wave are not saved                                                                                                                                                                                                                                                                                                                                                                                                                                                                | presence exact; wave lost          |
| Resource points               | `Num*Points` per room records presence; the room whose point granted a tool's element by `CurrentRun.ToolElementsSpawned` bracket diff (`GrantElementFromTool`, `HarvestLogic.lua:266`, once per tool per run); `FishCaught` names carry the biome letter                                                                                                                                                                                                                                                                                                                                               | element room exact; point lost     |

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

| Fact                  | Save source                                                                                                                                                     | Status   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Encounter count       | entry-save `len(CurrentRoom.Encounters)`                                                                                                                        | exact    |
| Store and picked type | `Encounters[k].RewardStoreName` and `.EncounterRoomRewardOverride`, per setup, from the PostReward save                                                         | exact    |
| Picked boon god       | the matching `LootChoiceHistory` screen, or `CurrentRoom.ForceLootName` for the last setup                                                                      | exact    |
| Offer count and side  | `UseRecord` key: `ShipsSteeringWheel` (one offer) or `ShipsSteeringWheelLeft`/`Right` (two, left rolled first); mixed sides are counted per room, not per setup | inferred |
| Unpicked type         | none in the record: solved by the importer from the saved stores (see Planner disposition)                                                                      | inferred |
| Unpicked boon god     | none: traceless except for excluding that god from the same wheel's other Boon roll                                                                             | lost     |

Both offers of a wheel draw from its one store (`RoomLogic.lua:1426-1439`).
The RunProgress and HubRewards `Boon` entries allow duplicates
(`IsRoomRewardEligible`), so one wheel may offer two Boons of different gods.
An unpicked Boon's god comes from `ChooseLoot` (`RewardLogic.lua:1-13`, called
by `SetupRoomReward` at `:228-258`), a pure random pick with no
`LootTypeHistory` write and no store draw; its only effect is that a later
Boon roll on the same wheel excludes that god. A held `ForceBoonName` trait
still writes the room's forced boon names for an unpicked offer, but its `Uses`
are spent only when that god's loot materializes through `GiveLoot`
(`RoomLogic.lua:2059-2068`), before pickup, so an unpicked offer spends
nothing; the
[Olympian keepsake audit](../loadout-and-progression/OLYMPIAN_KEEPSAKE_AND_MOON_BEAM_REWARD_PRESSURE_AUDIT.md#provider-force-consumption-is-loot-materialization)
owns the full contact table. Every roll, picked or not, also
removes the first eligible `RewardPriorities` name (`RewardLogic.lua:~170`),
so an unpicked draw can consume a priority, and a store refills only when
nothing in it is eligible (`:147-157`), so draw order inside the room can
matter. A wheel reroll press (`AttemptRerollShipWheel`,
`InteractLogic.lua:1468-1490`) may target either offer, picked or unpicked,
and excludes the offer's original type and every type currently on the wheel.

A room with one left and one right pick across two setups cannot assign sides
to setups; the importer solves the split (see Planner disposition). Capture S `O_Combat05`: MetaProgress lost `GiftDrop` and the picked
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
- The World Shop Travel Deal refill item's identity, and the Hermes Shrine
  refill's when it was itself rushed.
- Which pickups Sea Star duplicated, and the phase and wave Aetos joined.
- The unpicked ship-wheel boon god.
- Physical points of collected Fields optional rewards and of Fields Nemesis.

## Not exercised by either capture

Duo and Legendary offers, trait replacement screens, door, ship-wheel, cage,
Hub, Well and Pool rerolls, Jeweled Pom and Experimental Hammer equip results, Echo replay,
Cocoons, Eris, Oceanus Anomaly, Gold Gold Gold, Travel Deal refills at the
Well, the Fields Nemesis event, Dream runs, I-biome ending saves, and quit to
menu. A later
Underworld recording without raw saves exercised Steady Growth, Gorgon and
Athena, Echo's Pom, the Zagreus contract, Infernal Contract pedestals, Fig
Leaf skips and Concave Stone's extra pick; a fresh profile's first attempt is
still unrecorded. Run 1010, an Underworld attempt
reset in `H_Combat04` with every save kept, exercised Judgment and the
Crystal Figurine, Aspect of Selene with God Sent nodes, Artificer boons,
screen rerolls and a relaunch mid-run. Run 1011, a Surface victory with every
save kept, exercised Sea Star, Aetos, the Phial, a Hermes Shrine Travel Deal
refill, a Nacelle tree, a blind box beside a World Shop refill, and two doors
to one room (`Q_Combat14` to `Q_MiniBoss03`).

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
  - an unpicked ship-wheel Boon takes the first god the wheel admits,
    unreported, since the god leaves no trace;
  - a collected Fields optional reward takes the first free optional point;
  - aspect and keepsake levels are assumed to be maximum, although the save
    records the equipped rarity.
- A Fig Leaf skip is imported exactly from `SpawnsSkipped`. A record without
  the skip mark infers a skip at a phase Fig Leaf may skip whose rolled
  enemies the room never killed, and reports it as an assumption.
- A selected trait's outcome children are answered from the record on the
  screen's final rows, each from what its room acquired or upgraded at the
  child's own carrier's acquisition time, and each checked against the
  engine's domain for that child: Bridal Glow's target is the trait upgraded
  at its acquisition time, Echo's Pom target the trait whose level doubled
  there, and Concave Stone's extra pick the result of the screen it followed
  (its own children keyed to the extra pick's time). Several qualifying values
  take the first the engine admits, an assumption. A child the record does not
  answer, or whose recorded value the engine refuses, takes Draft's first
  eligible value and is reported, so no such child stops the import; one an
  earlier change makes stale is answered again the same way.
- Judgment's and the Crystal Figurine's cards are imported exactly from the
  boss room's draw order. Aspect of Selene's tree is the run's first Spell
  snapshot without its God Sent nodes.
- A bought World Shop Travel Deal refill is inferred from the use its room
  recorded beyond the bought stock (`RestockWorldItem`, `StoreLogic.lua:412`,
  rerolls the first purchase's slot): for a boon, the god whose screen follows.
  A bought blind box's god is not saved either; it takes the room's first boon
  screen its purchases leave unexplained, so the refill is the god after it
  (run 1011 `N_PreBoss01`: the box opened Hera, the refill Zeus). The refill
  is reported as an assumption; an unbought refill leaves no use and takes the
  first eligible item, reported as not in the record.
- A Hermes Shrine Travel Deal refill is imported exactly from its rushed slot,
  with its delayed purchase.
- A batch's boon doors, the Hub board included, are authored one door per
  distinct god first and repeated gods after, so each door is checked against
  the god exclusions the game applied when it rolled.
- Two doors to one room are told apart by the reward collected there, its god
  included.
- The Phial's fountain targets the trait whose rarity rose in the fountain
  room.
- Each Sea Star duplicate a room counted is placed on the room's own reward,
  an assumption; a further duplicate, or one in a room without a duplicable
  reward, is reported as not in the record.
- Aetos is placed on the room's first phase whose encounter declares Aetos
  waves, at the first wave the plan admits; a choice among several waves is an
  assumption.
- A random Pom with no screen (`AddStackToTraits`, `TraitLogic.lua:2482`)
  targets the trait the record shows upgraded in its room or, when the trait
  was acquired there too, the trait whose level rose between the room's entry
  saves; several risen candidates make the target an assumption.
- A selected trait's optional pickups, such as Narcissus's gifts
  (`TraitData_Narcissus.lua`), are collected as often per reward type as the
  room's `UseRecord` counts.
- A screen's recorded rerolls come from `SpentRerolls`. One rerolled loot
  screen among one rerollable screen in its room is exact; otherwise the ids
  in ascending order take the rerollable screens in record order, an
  assumption. The record keeps only the final screen, so it is authored
  exactly and the earlier screens are guessed (the first legal chain) and
  reported; a reroll the engine refuses is reported and left out. Well and
  Pool rerolls are authored as unpinned rerolls, since only their count is
  known, and reported.
- Door, ship-wheel, cage and Hub rerolls are solved from the stores: the
  rewards a bracket's presses replaced are, per store, what the game's stores
  lost beyond the plan's draws (pre-count plus a refill multiple less
  post-count, choosing the refill difference that leaves no negative count and
  totals the expected press count), and the press count is how far the plan's
  pool runs ahead of the saved `NumRerolls`. Each replaced reward is placed, in
  store and declaration order, on the first owner in native order the engine
  accepts. Every placement removing the same rewards leaves the same stores,
  so a placement that reproduces the saved stores is one assumption for the
  room; otherwise each press is reported. In a ship room the unpicked offers
  and the presses are solved jointly: the presses take what the solved offers
  leave of the room's unknown draws. A press on a picked offer loses the same
  rewards as one on the unpicked offer of its wheel, so it is imported as that
  unpicked offer's press, which the room simulation confirms. A restored Hub
  stay's presses are placed by the board doors whose saved offer changed
  between Hub visits. The planner's pool is compared with `NumRerolls` at each entry save.
- A ship room's unpicked wheel offers are solved once its save-to-save
  window closes: the next room entered, every draw authored and any Artificer
  or Time Piece conversion applied, or reported refused when no pickup of the
  ship can take it by then; a room whose sides are open applies its
  conversions after the solve instead (below). Until then each holds a provisional value,
  the first supported type of its wheel's domain, taking types the room's
  wheels did not pick before those they did and then those the saved store
  lost most of first, so that an earlier answer is less often refused. The
  store arithmetic above, with the plan's draws on those offers added back,
  gives every multiset of unknown draws the saved stores admit; each way to give the
  unpicked offers, in setup order, a type of their own store from it, the rest
  left to the room's presses, is simulated, and an assignment fits when the
  plan's wheel stores across the room match the saved ones. Fits are grouped
  by the ship's exit state (every store's counts, reward priorities, the god
  pool and the rerolls left). The first fit in canonical order (setup order,
  then the store's declared type order) is authored; when every fit shares
  one exit state nothing is reported, otherwise each offer whose value
  differs is reported as not in the record with the other groups' values as
  alternatives. When nothing fits the provisional values stay, each reported
  as not in the record, and each wheel store's loss is reported as a
  mismatch. Unpicked offers of a room whose
  window never closes (the last room, one past a stop, a record without entry
  saves) keep their provisional values and are reported as not in the record,
  as are those of wheels whose side is unknown.
- A ship room whose two-offer wheels used both sides first authors the
  canonical split, the first wheels in setup order taking the Left uses. The
  solve then also tries every other split consistent with the Left and Right
  counts, moving each pick with its authorship to the other side, and groups
  those fits by exit state as above; a wheel whose side differs between groups
  is reported as not in the record with the other side as its alternative.
  A swap cannot carry what was generated from an offer, so in such a room the
  recorded Artificer and Time Piece conversions and the pickups a picked
  trait drops are authored after the split is chosen: each split's simulation
  applies the conversions to its own picks before the stores compare, and the
  conversions' draws count as known in the arithmetic. When the window never
  closes or nothing fits, each wheel's canonical side is reported the same
  way, and the conversions act on the canonical picks.
- A hidden return door's placeholder and reward are pinned exactly from the
  return door's `ExitDoorRooms` and `OfferedRewards`.
- A batch's doors are ordered by the catalog's declared native door order for
  the source room, an exact order; a room without one takes ascending door id
  and reports the order as an assumption. Both declared rooms are inferred
  from reward-store replays, pending a native door-order probe:
  - `H_Combat05` processes door `621199` before `564448`. In the live
    Underworld recording's reward-bag replay that generates the Mini-Boss
    door first, refilling the store, so `H_Combat07`'s recorded Hestia cage
    finds a Boon; ascending id leaves it none.
  - `G_Combat20` processes doors `776584`, `776586`, then `569053`. In run
    1010 the MetaProgress store refills between saves 027 and 028: the first
    two doors draw `MetaCardPointsCommonBigDrop` and `MetaCurrencyBigDrop`,
    and `569053` draws `GiftDrop` from the refilled store. Ascending id
    refuses all three, and the guess put another reward on the taken
    `G_Combat05` door, dropping its Nectar's run-progress level-up
    (`UseStoreRewardRandomStack`, ConsumableData.lua:1852-1866) on
    `ZeusCastBoon`; the relaunch mid-room was coincidental.
- An imported plan is checked against each room's entry save, which leaving
  the previous room writes: the plan's `beforeRoomExit` of that room holds the
  same moment. The checked state is held traits (rarity, and level as
  `StackNum`), the slotted keepsake, reward store counts, Denial bans,
  Artificer and Time Piece uses, Well purchases, Chaos curses' remaining uses
  and blessings, invested Path of Stars nodes, Forfeit and elements; each
  difference is reported as a mismatch where it begins. Elements are read
  from the plan's entry into the next room, since the plan grants a gathered
  element as the room is left, after `beforeRoomExit`. Two native facts bound
  the comparison: `BiomeBoonSkipCount` resets in the next biome's first room
  (`EndBiomeRecords`, `RunLogic.lua:1912`, after its entry save),
  and each store fill or refill (`RewardLogic.lua:157`) keeps every entry
  declared for another route, so store names with such an entry are not
  compared. `Secrets` is not compared: every Chaos gate a room creates draws
  its `TrialUpgrade` (`RoomLogic.lua:4858`), taken or not, and the store
  refills itself when empty (`RewardLogic.lua:140`). The first room and rooms left from a revisited occurrence are not
  checked.
