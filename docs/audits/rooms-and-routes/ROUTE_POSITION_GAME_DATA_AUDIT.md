# Route-position profiles

This audit owns source-backed starting-room, completion-room and NPC effect
profiles whose meaning depends on itinerary position rather than physical
biome identity, and route-mode content restrictions. Sources are the installed
Hades II scripts; source inspection does not constitute live Dream Dive verification.

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

## Coverage boundary

Public fixed-order Dream authoring and publication consume these declarations,
ordinal profiles, content restrictions and timed-drop rules. Compiler-built
mixed-route and native-hook witnesses cover first/later entries, Postboss cursor
recovery and configured-prefix pass-through. Full-run live verification remains
separate from source evidence and automated coverage.
