# Route-position profiles

This audit owns source-backed starting-room, completion-room and NPC effect
profiles whose meaning depends on itinerary position rather than physical
biome identity. Sources are the installed Hades II scripts; source inspection
does not constitute live Dream Dive verification.

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

The planner resolves `routeFirst`/`routeLater` starting profiles for every
route, with an explicit Dream encounter override where needed. Ordinary F/N
openings retain their reward and encounter semantics. A normally rewardless
Intro is not intrinsically rewardless at every route position.

`RoomDataDream.lua` declares `Dream_PostBoss01/02/03`: a Well, fountain and
keepsake rack, without purging or natural Chaos. These rooms have neither
`ForceSurfaceShop` nor an increased Shrine spawn chance; the default is zero.
`DreamPostBossEntrancePresentation` is visual-only, and normal setup still
uses `IsSurfaceShopEligible` (`RunLogic.lua`, `RoomLogic.lua`). There is no
fourth Postboss. I also has a Dream-specific Preboss identity.

`RewardLogic.lua:ChooseRoomReward` selects `DreamPointsDrop` for
`CanSpawnDreamReward`; `CheckDreamBiomeCompletion` waits for its use record.
The matured-state planner excludes the `Dream_Intro` prologue. Dream Points
replace boss material drops, not a new modeled points economy. Runtime Dream
startup and completion remain outside currently supported publication.

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

## Coverage boundary

Internal route resolution supports supplied Dream itineraries and these
profiles. It does not establish Dream itinerary legality, mode-sensitive
inventory, resource restrictions or special timed-drop behavior. Public
Dream authoring, loading and execution publication remain disabled until those
contracts and runtime support are delivered.
