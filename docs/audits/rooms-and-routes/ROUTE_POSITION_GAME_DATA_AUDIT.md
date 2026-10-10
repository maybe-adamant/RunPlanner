# Route-position profiles

This audit owns source-backed starting-room, completion-room and NPC effect
profiles whose meaning depends on itinerary position rather than physical
biome identity, route-mode content restrictions, the fresh-profile first
attempt, and starting a run at a later biome. Sources are the installed Hades II scripts; source inspection does not
constitute live Dream Dive verification.

## Biome order

`DreamRunLogic.lua:SelectNextDreamBiome` begins with G/H/I/O/P/Q and adds F/N
after the first choice. Selection removes the chosen biome from the pool.
Later choices exclude the current biome's natural successor declared in
`RoomSets.lua:NextRoomSets` (F→G→H→I and N→O→P→Q); the exclusion is directional.
`GameData.FullRunBiomeCount` is four. First-ever forced H and previous-run
starting-biome avoidance are save-progression predicates outside the matured
planner model; explicit published choices override them.

The catalog declares the start pool and successor relation. Engine public
admission validates complete four-biome projects and incremental draft choices;
publication validates the configured prefix. Native selection is steered at
pool removal, retaining `DreamBiomePool`, `LastDreamStartingBiome` and
`NextRoomSet` bookkeeping rather than replacing the final result afterward.

## Starts and completion

`DreamRunLogic.lua:EnterNextDreamBiome` uses `ChooseStartingRoom`.
G/H/I/O/P/Q Intro declarations admit a RunProgress opening reward with
`IsDreamRun && EnteredBiomes == 0`; `RoomLogic.lua` records biome entry afterward.
Later Dream transitions skip reward selection in `AttemptUseDreamRunExit`.
F/N later entries are consequently rewardless too.

`EncounterData_Opening.lua` declares `PIntroDreamRunEmpty` for a first-position
Dream P entry. Later P uses its ordinary intro encounter. `OpeningEmpty` in
`EncounterData.lua` is AlwaysForce and Dream-eligible, giving F/N combatless
Dream entries. N's separate PreHub is unchanged.

The planner represents this with rewardless entry declarations and one
route-owned run-start reward binding, realized only at the first itinerary
entry. Narrow contextual encounter rules select Dream `OpeningEmpty` for F/N
at every ordinal and `PIntroDreamRunEmpty` only for first-position P. Ordinary
F/N openings retain their reward and encounter semantics without duplicated
first/later room profiles.

`RoomDataDream.lua` declares `Dream_PostBoss01/02/03`: a Well, fountain and
keepsake rack, without purging or natural Chaos. These rooms have neither
`ForceSurfaceShop` nor an increased Shrine spawn chance; the default is zero.
`DreamPostBossEntrancePresentation` is visual-only, and normal setup still
uses `IsSurfaceShopEligible` (`RunLogic.lua`, `RoomLogic.lua`). There is no
fourth Postboss. I also has a Dream-specific Preboss identity.

`RewardLogic.lua:ChooseRoomReward` selects `DreamPointsDrop` for
`CanSpawnDreamReward`; `CheckDreamBiomeCompletion` waits for its use record.
The matured-state planner excludes the `Dream_Intro` prologue. Dream Points
replace boss material drops, not a new modeled points economy. Native startup
creates the prologue explicitly (`RunLogic.lua`, `DeathLoopData.lua`).
`EnterNextDreamBiome` calls `ChooseStartingRoom` before `LeaveRoom`, so later
entry preparation precedes departure of the active Postboss. Native completion
retains Dream Points use and the fourth-biome ending.

`ShrineLogic.lua:IsBossDifficultyShrineUpgradeActive` uses ordinal for Rivals.
Dream additionally requires prior enhanced-boss progression, treated as met
by the planner's fully progressed baseline. Physical room facts, such as a
particular Postboss's Moon Beam effect, remain physical facts; route position
identifies the actual preceding room instead of guessing it from the next biome.

## NPC acquisition profiles

`EventLogic.lua` assigns Dream NPC menu rarity using
`RarityUpgradeOrder[EnteredBiomes]`. This is an internal scaling mechanism, not
a new authorable rarity roll. The planner resolves the supported numeric
effects by acquisition ordinal on both ordinary and Dream routes.

| Effect                                    | Ordinals 1 / 2 / 3 / 4 |
| ----------------------------------------- | ---------------------- |
| Narcissus Pom, Magick and Life pickups    | 1 / 1 / 2 / 4          |
| Narcissus elemental pickups               | 2 / 2 / 3 / 4          |
| Narcissus Last Stand pickups              | 1 / 1 / 2 / 3          |
| Narcissus Mystery Box                     | 1 / 1 / 1 / 1          |
| Circe activation / Fear suppression       | 1 / 1 / 2 / 3          |
| Circe Arcana promotion                    | 2 / 2 / 3 / 5          |
| Icarus Ingenious Strike / Flourish levels | 3 / 3 / 3 / 5          |
| Icarus Supply Chain interval              | 7 / 7 / 7 / 3          |
| Icarus Latest Model targets               | 1 / 1 / 1 / 2          |

Sources: `TraitData_Narcissus.lua`, `TraitData_Circe.lua`,
`TraitData_Icarus.lua`, and their acquire functions in `TraitLogic.lua` and
`EventLogic.lua`. Selection counts cap at the native eligible pool.
The ordinary-position values match native ordinary effects without assigning
artificial Rare/Epic rarity to normally Common NPC traits. Acquired producer
intervals persist across biome changes; maturity does not rescale the source.

Arachne/Medea combat arithmetic and Echo's scaled health/dodge/refill amounts
remain outside the modeled effects. Echo reward replay, BBB, doubled levels,
Gold duplicate and keepsake replay gain no new target/cardinality rules here.
Hades and the rarity-bearing Artemis/Athena/Dionysus menus do not use the
six-menu rewrite.

Latest Model's native `UpgradeHammers` selects old Hammers before its nested
rarity changes. The planner retains distinct source-capable Rank I targets;
the broader native rank-agnostic pool adds no reachable supported case because
Latest Model is the only permanent Rank II producer and is once per run.

## Route-mode content restrictions

These restrictions use the saved route identity independently of acquisition
ordinal. Selected assessment and alternative candidates consume the same
declared restriction; retained invalid choices remain repairable.

| Contact                     | Dream rule                                                                               | Native source                     |
| --------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------- |
| Ordinary World Shop group 2 | Replace Ashes, Bones and Nectar membership with the four individual element boosts.      | `StoreData.lua:260–268`           |
| I/Q World Shop group 5      | Replace Nightmare, Moon Dust and Obol Points membership with ElementalBoost.             | `StoreData.lua:405–446,538–579`   |
| Spark of Ixion              | Unavailable in initial Well inventory and Travel Deal refill.                            | `TraitData_Store.lua:301–313`     |
| Plentiful Forage            | Unavailable; its independent BlockGiftBoons restriction also applies.                    | `TraitData_Demeter.lua:1812–1832` |
| Discovery                   | Unavailable in Chaos offers and Embryo blessing selection.                               | `TraitData_Chaos.lua:634–646`     |
| Tool/fishing resources      | Native setup is disabled; no supported placement, element grant or forced resource host. | `RunLogic.lua:656–744`            |
| Oceanus Anomaly             | Unavailable through the existing takeover contact.                                       | `RoomData.lua:607–615`            |

Shop rules compose with first/second-half ordinal requirements and apply to
initial inventory and Travel Deal generation. They are not global bans on
metaprogression rewards in doors, optional rewards, Wells or Shrines.
Element boosts reuse ordinary acquisition settlement. Meta Reward Stands have
their own native Dream exclusion (`RoomData.lua:552–565`) and are not resource
tool placements. Natural Chaos retains its existing local restrictions.

Fateful Twist's native `RandomStoreItem.UseFunctionArgs` whitelist
(`ConsumableData.lua:1505–1528`) already omits Ixion on every route; it still
permits its declared resource consumables. No Dream-specific Twist rule is
needed. Hades' Dream conditions change presentation rather than eligibility.

Timed-drop deferral and terminal delivery are owned by the
[scheduled-effects audit](SCHEDULED_AND_AUTOMATIC_TIMELINE_OUTCOMES_AUDIT.md)
and [Shrine audit](../room-features/ROOM_FEATURES_GAME_DATA_AUDIT.md#purchase-delivery-and-travel-deal-facts).

## Fresh-profile first attempt

### Initial state and start

A brand-new profile has no `GameState`: `RoomLogic.lua:150` calls
`StartNewGame` (`RunLogic.lua:312-324`), whose `GameStateInit` (`:134-310`)
leaves every progression table empty, then
`StartNewRun(nil, { RoomName = "F_Opening01", StartingBiome = "F" })`. The
`args.RoomName` branch calls `CreateRoom` directly (`RunLogic.lua:505-508`), so
this start never reaches `ChooseStartingRoom` and never visits `Hub_PreRun`.
`F_Opening01` is the `GameStart` room (`RoomDataF.lua:372`); `F_Opening02/03`
need `RoomCountCache.F_Opening01 >= 2` (`RoomDataF.lua:910-913,981-990`), and
`OpeningEmpty` is forced while Apollo is unused, spawning no reward
(`EncounterData.lua:435-450`). `CompletedRunsCache` is nil, read as 0
(`RequirementsLogic.lua:633`), until `EndRun` (`RunLogic.lua:1848-1850`).

Fixed for the whole attempt: the Staff with the no-effect `DummyWeaponStaff`
aspect trait (`WeaponUpgradeLogic.lua:428-441`, `TraitData.lua:1342`), no
keepsake (`RunLogic.lua:481`; `EquipKeepsake` returns early for nil,
`KeepsakeLogic.lua:106-111`), no familiar, zero Arcana (no active
`StartEquipped` card, `MetaUpgradeLogic.lua:2-27`), zero Fear
(`ShrineLogic.lua:503-507`), zero Death Defiance (`RunLogic.lua:45-56` adds only
Arcana stands; the in-run `IncreaseMax` sources, Athena and Chaos, are
unreachable), 30 Health, 50 Magick and 0 Gold (`HeroData.lua:6,8`,
`RunLogic.lua:41`), and the Vanilla biome state (`BiomeStateData.lua:13-29`
needs `ZeusFirstPickUp` or three completed runs). `UseRecord`,
`TextLinesRecord`, `LootPickups`, the encounter completion and occurrence
caches, `RoomsEntered`/`RoomCountCache`, `LifetimeResourcesGained`,
`BiomeVisits` and `TraitsTaken` start empty and fill during the attempt.

Planner disposition: the `FreshFile` route stores no weapon aspect, starting
keepsake or Arcana, starts with empty god-use, god-pickup and resource-gain
history, and has no run-start reward. The Executor realizes the opening at the
nested `CreateRoom` contact
([integration boundary](../../design/GAME_INTEGRATION_BOUNDARY.md)). A
brand-new profile run on 2026-09-30 (module source as of `0d65c432`) bound the opening under
`StartNewGame` and completed the published F–I plan with no mismatch.

### Unreachable content

These gates need a `WorldUpgrade*`, a completed run or lifetime history that
the first attempt cannot supply, or a structural impossibility. The catalog
closes each on its existing declaration by route availability
([catalog model](../../design/CATALOG_MODEL.md)).

| Content                                   | Native gate                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `F_Story01`, `G_Story01`, `I_Story01`     | Lifetime `RoomsEntered.F_Boss01` + `ArtemisFirstMeeting`; `RoomsEntered.G_Boss01`; `RoomsEntered.I_Intro > 1` (`RoomDataF.lua:3163-3170`, `RoomDataG.lua:2559`, `RoomDataI.lua:3122`)                                                                                                                                  |
| Reprieves and `I_Combat24`                | `WorldUpgradeErebus/Oceanus/TartarusReprieve` (`RoomDataF.lua:3063`, `RoomDataG.lua:2482`, `RoomDataI.lua:2403,2814`)                                                                                                                                                                                                  |
| `F_MiniBoss02/03`, `G_MiniBoss02` (Uh Oh) | Two lifetime `MiniBossTreant` completions (one Treant room per run); both `MiniBossWaterUnit` and `MiniBossJellyfish`, alternatives in one G (`RoomDataF.lua:1117,1193-1203`, `RoomDataG.lua:1965-1968`)                                                                                                               |
| Chaos gates                               | `ChaosUnlocked`: lifetime Hermes use, excluding the run of `HermesFirstPickUp` (`RoomData.lua:513`, `RequirementsData.lua:1400-1412`)                                                                                                                                                                                  |
| Zagreus Contract door                     | `InfernalContractUnlocked`: true ending and later dialogue (`StoreData.lua:4-11`, `RequirementsData.lua:2795-2808`)                                                                                                                                                                                                    |
| Oceanus Anomaly                           | `AnomalyDoorRequirements`: lifetime Chronos meeting (`RoomData.lua:609-636`)                                                                                                                                                                                                                                           |
| Stygian Wells, forced Postboss Wells      | `WorldUpgradeWellShops`, `WorldUpgradePostBossWellShops` (`RoomData.lua:576`, `RoomDataF.lua:2572,2625`, `RoomDataG.lua:1065,1120`, `RoomDataH.lua:1911,1983`)                                                                                                                                                         |
| Postboss Pools of Purging                 | F/G: `WorldUpgradePostBossSellTraitShops` (`RoomDataF.lua:2580,2637`, `RoomDataG.lua:1072,1108`). H: the object spawns but `BlockedByRequirements` locks it (`RoomDataH.lua:2006-2007`, `ObstacleData.lua:3331-3350`)                                                                                                  |
| Postboss keepsake racks                   | `WorldUpgradePostBossGiftRack` (`RoomDataF.lua:2606-2617`, `RoomDataG.lua:1092-1097`, `RoomDataH.lua:1960-1974`)                                                                                                                                                                                                       |
| Tool and fishing resource points          | `CompletedRunsCache >= 1` plus `WorldUpgradeToolsShop` per family (`RoomDataF.lua:46-230`, same in G/H/I)                                                                                                                                                                                                              |
| Artemis, Arachne cocoon, Nemesis family   | `ArtemisCombatIntro` needs a completed run; `ArachneCombatF` a completed run, `ArachneCombatG` a completed `ArachneCombatF`; `NemesisCombatIntro` seven (`EncounterData_Artemis.lua:9,121-124`, `EncounterData_Arachne.lua:15,234-238`, `EncounterData_Nemesis.lua:8-11,232-236`, `EncounterData_Story.lua:1929,2048`) |
| Hammers, shop hammers, Anvil              | ≥4 of six non-Apollo `FirstPickUp` lines under `MaxGodsPerRun = 4` with Apollo forced; shop hammers also lifetime `UseRecord.WeaponUpgrade` (`RequirementsData.lua:1233-1250`, `HeroData.lua:168`, `StoreData.lua:232-251`, `ConsumableData.lua:1074`)                                                                 |
| Hermes, Selene Hex, Path of Stars         | `HermesFirstPickUp` (bootstrap needs two `G_Intro` visits and Zeus use); `ArtemisFirstMeeting` + `SeleneFirstPickUp`; four lifetime `SpellDrop` uses (`RequirementsData.lua:1304-1361`, `RoomDataF.lua:555-610`, `ConsumableData.lua:1187`)                                                                            |
| Devotion                                  | `PoseidonDevotionIntro01`, itself behind `DevotionTestUnlocked` (`LootData.lua:1641,1927`, `RequirementsData.lua:436-470`)                                                                                                                                                                                             |
| Mystery Boon                              | `BlindBoxLootRequirements`: use of seven gods including Zeus and Hephaestus (`RequirementsData.lua:1218-1231`)                                                                                                                                                                                                         |
| Room-reward and shop Nectar               | `GiftDropLootRequirements`: a completed run (`RequirementsData.lua:1205-1216`, `StoreData.lua:262`); Fields optional Nectar is ungated                                                                                                                                                                                 |
| Shop Armor, Death Defiance refill         | `RoomCountCache.F_Story01` (`ConsumableData.lua:939`); `MissingLastStand` with no charge to restore (`ConsumableData.lua:840`)                                                                                                                                                                                         |
| I_WorldShop resource group                | Lifetime `WeaponPointsRare`, `CardUpgradePoints` or `CharonPoints` gains (`StoreData.lua:409-445`)                                                                                                                                                                                                                     |
| Zeus, Hera, Ares, Hephaestus              | First-pickup text records whose bootstraps need Rain, the Surface cure, `Q_Boss01` or the true ending; Hephaestus needs lifetime Zeus use (`LootData_Zeus.lua:10-11`, `LootData_Hera.lua:10-11`, `LootData_Ares.lua:10-11`, `LootData_Hephaestus.lua:9-16`, `RequirementsData.lua:102-141`)                            |
| Infusions, Plentiful Forage               | `WorldUpgradeElementalBoons` through `IsElementalTrait` (`RunLogic.lua:114`, `TraitData.lua:723-730`); `WeaponsUnlocked.ToolShovel` (`TraitData_Demeter.lua:1820`)                                                                                                                                                     |
| Random boon exchange roll                 | `HeroData.BoonData.GameStateRequirements`: two completed runs (`HeroData.lua:170-189`, `TraitLogic.lua:1801`); the too-few-options exchange fill still applies                                                                                                                                                         |

Available throughout: Apollo, Poseidon and Demeter have no top-level gate;
Hestia and Aphrodite need lifetime `UseRecord` of Poseidon or Demeter
(`LootData_Hestia.lua:7-11`, `LootData_Aphrodite.lua:7-12`). H minibosses and
I minibosses 01/02 carry only run-local gates. Postboss fountains, Fields
optional Armor, Nectar and Bones, herb points (unmodeled) and ordinary Pom
legality are unchanged.

In-attempt rules have their own owners: the forced first combat and Apollo
offer ([trait offers](../traits/TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md#first-run-forced-loot-table),
[forced room rewards](../rewards-and-acquisition/REWARD_GAME_DATA_AUDIT.md#forced-room-rewards)),
MetaProgress thresholds and Nectar levels ([reward audit](../rewards-and-acquisition/REWARD_GAME_DATA_AUDIT.md)),
Eris ([room action order](ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md#eris-is-a-required-object-at-a-young-profiles-biome-intro)),
enemy introductions ([composition matrix](COMBAT_ENCOUNTER_COMPOSITION_MATRIX.md)),
boss choices ([boss decisions](../game-execution-contacts/NPCS_ENCOUNTERS_AND_AUTOMATICS.md#boss-decisions))
and the Fields bridge ([H rules](../../biomes/H_GAME_RULES.md)).

## Later-biome run start

Debug and Chaos Trial bounties start a run at a later biome through
`StartOver` → `StartNewRun` with `RunOverrides`, which native writes onto the
fresh `CurrentRun` before hero creation (`BountyData.lua:162-232`,
`RunLogic.lua:449-451`). They leave `RoomHistory` empty, so native depth
restarts.

On an Intro the game itself runs `EndBiomeRecords`, resetting the biome
records and biome encounter depth; advances `EnteredBiomes` and
`BiomeVisitOrder`, grants a `BiomeStartRoom`'s Tight Deadline allowance and
runs the keepsake biome-start effects (`RoomLogic.lua:1205-1293`); calls
`ChooseNextRewardStore`; and, in I, initializes the Clockwork counters. The
Intro's reward and encounter are chosen while the previous biome's records are
still live. Run-wide state is never reinitialized at a biome entry:
`RoomHistory`, encounter caches and depths, room counts, `UseRecord`,
`LootTypeHistory`, `ConsumableRecord`, `RewardStores`, `RewardPriorities`, the
last Devotion and Well depths, `Blacklist` and talent points. Run depth is
`1 + #RoomHistory`, and biome depth counts back to the last record with a
`NextRoomSet` (`RunLogic.lua:GetRunDepth`, `GetBiomeDepth`);
`RoomSaveWhitelist` (`SaveLogic.lua:86-114`) is the record shape native
already tolerates.

Every map load runs `DoPatches`, whose `UpdateRunHistoryCache` re-derives
`RunDepthCache` and `BiomeDepthCache` from `RoomHistory` and the current room
(`RoomLogic.lua:139`, `PatchLogic.lua:687-689`); `StartRoom` keeps those
values (`RoomLogic.lua:1081`). A depth cache written between `StartNewRun`
and the map load therefore never reaches `StartRoom`. `DoPatches` also sets
`PrevRun` to the last `RunHistory` entry (`PatchLogic.lua:13-17`).

A clear runs `RecordRunCleared` and `RecordRunStats`: the `ClearedWith*`
tables, depth, fastest-clear, lifetime trait and boss difficulty records
(`RunLogic.lua:1945-2120`). A death runs `KillHero`, which calls
`RecordRunStats` and writes inline records (`DeathLoopLogic.lua:36-240`). The
ended run is appended to `RunHistory` by `EndRun`, which `StartOver` calls as
the next run begins (`RunLogic.lua:1848-1855`). Writes made during play (rooms
entered, kills, dialogue, codex, `TraitsTaken`) and `CheckProgressAchievements`,
which runs on every map load (`RoomLogic.lua:226`), are part of play; platform
achievements can unlock irreversibly.

Planner disposition: the
[Practice mode start](../../design/GAME_INTEGRATION_BOUNDARY.md#practice-mode-start)
installs a stub `RoomHistory` and the run-wide records the planner holds
exactly, and its only record change is removing the run from `RunHistory`.

## Coverage boundary

Public fixed-order Dream authoring and publication consume these declarations,
ordinal profiles, content restrictions and timed-drop rules. Compiler-built
mixed-route and native-hook witnesses cover first/later entries, Postboss cursor
recovery and configured-prefix pass-through. Full-run live verification remains
separate from source evidence and automated coverage.
