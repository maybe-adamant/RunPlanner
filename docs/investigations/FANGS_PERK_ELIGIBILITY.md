# Fangs perk eligibility and combinations

Status: source audit, 2026-09-23; Fangs checkpoint delivered. Direct installation
under the complete-ownership contract is the next adapter revision.
Scope: the 39 supported generated encounter policies, including fixed seeds.
Source paths below are relative to the installed `1GameData/Scripts` snapshot.

## Selection contract

`RoomLogic.lua:5273–5321` collects native `IsElite` spawn entries across an
encounter's waves and selects one type, then removes duplicate occurrences of
that type. Separate cages are separate encounters. H passive/passive-small block
attributes. The supported profiles have no nondefault type-count or forced
attribute-count overrides.

`ShrineLogic.lua:687–744` filters the selected type's options by encounter bans,
enemy blocks, run bans and attribute requirements. It draws one/two distinct
attributes according to effective Fangs rank, removing each chosen attribute's
blocked successors. It stops if no options remain. Type selection itself does
not prefilter empty perk pools.

## Complete eligible-type pool inventory

G denotes the generic pool (`EnemySets.lua:649`, `EnemyData.lua:262`):
Blink, ExtraDamage, Fog, Frenzy, HeavyArmor, ManaDrain, Massive, Miasma,
Molten, Orbit, Rooting, SpreadHitShields, StasisDeath, Unflinching, Vacuuming.

All names below carry `_Elite` unless explicitly stated otherwise. Apply the
following context and enemy filters after this declaration-level table.

| Declared pool                  | Supported identities                                                                                                                                                                                                                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G                              | Guard, Radiator, FishmanRanged, FishSwarmerSquad, Turtle, Guard2, Radiator2, CorruptedShadeMedium, BrokenHearted, Lovesick, Lamia, GoldElemental, TimeElemental, SwarmerClockwork, Zombie, Stickler, Scimiterror, WaterElemental, SatyrSapper, SatyrCrossbow2, SimpleSquad, Stalker, Mati, DragonBurrower; unsuffixed Treant2 and Screamer2 |
| G + Rifts                      | Carrion, Drunk, HarpyCutter, AutomatonEnforcer, HarpyDropper                                                                                                                                                                                                                                                                                |
| G + Metallic                   | Mourner, ZombieHeavyRanged, AutomatonBeamer                                                                                                                                                                                                                                                                                                 |
| G + Hex                        | Screamer, CorruptedShadeLarge, SatyrRatCatcher, Mudman                                                                                                                                                                                                                                                                                      |
| G + Homing                     | Mage, WaterUnit, CorruptedShadeSmall, SatyrLancer, Mage2, SentryBot, SatyrLancer2                                                                                                                                                                                                                                                           |
| G + Rifts + Metallic           | Brawler, ClockworkHeavyMelee                                                                                                                                                                                                                                                                                                                |
| G + Hex + Metallic             | FishmanMelee, Swab, Dragon, Brute                                                                                                                                                                                                                                                                                                           |
| G + Rifts + Hex                | Lycanthrope                                                                                                                                                                                                                                                                                                                                 |
| Fog, HeavyArmor, Orbit, Radial | SiegeVine, ZombieSpawner                                                                                                                                                                                                                                                                                                                    |
| Empty                          | DespairElemental                                                                                                                                                                                                                                                                                                                            |

Explicit pool sources: `EnemyData_Brawler.lua:87`, `EnemyData_Screamer.lua:110`,
`EnemyData_Mage.lua:103,199`, `EnemyData_SiegeVine.lua:104`,
`EnemyData_FishmanMelee.lua:82`, `EnemyData_WaterUnit.lua:130`,
`EnemyData_CorruptedShadeSmall.lua:69`, `EnemyData_CorruptedShadeLarge.lua:70`,
`EnemyData_Lycanthrope.lua:104`, `EnemyData_Mourner.lua:116`,
`EnemyData_ClockworkHeavyMelee.lua:85`, `EnemyData_SatyrLancer.lua:95,232`,
`EnemyData_SatyrRatCatcher.lua:105`, `EnemyData_Carrion.lua:148`,
`EnemyData_Mudman.lua:144`, `EnemyData_ZombieSpawner.lua:110`,
`EnemyData_ZombieHeavyRanged.lua:114`, `EnemyData_Swab.lua:99`,
`EnemyData_Drunk.lua:107`, `EnemyData_Harpy.lua:100,205`,
`EnemyData_SentryBot.lua:118`, `EnemyData_AutomatonBeamer.lua:120`,
`EnemyData_AutomatonEnforcer.lua:111`, `EnemyData_Dragon.lua:126`,
`EnemyData_Brute.lua:99`, `EnemyData_DespairElemental.lua:81`.
Inheritance (`RunData.lua:1363–1416`) takes own values before missing parent
values; ordinary option arrays replace, not union with, inherited arrays.

## Filters

| Enemy                     | Native blocks           | Source                               |
| ------------------------- | ----------------------- | ------------------------------------ |
| Mage_Elite, Mage2_Elite   | ExtraDamage             | EnemyData_Mage.lua:64                |
| GoldElemental_Elite       | Tracking, ExtraDamage   | EnemyData_GoldElemental.lua:65       |
| TimeElemental_Elite       | StasisDeath             | EnemyData_TimeElemental.lua:54       |
| SwarmerClockwork_Elite    | SpreadHitShields        | EnemyData_Swarmer.lua:20             |
| ClockworkHeavyMelee_Elite | Orbit, Vacuum           | EnemyData_ClockworkHeavyMelee.lua:47 |
| ZombieHeavyRanged_Elite   | Orbit, Vacuum           | EnemyData_ZombieHeavyRanged.lua:63   |
| AutomatonEnforcer_Elite   | Orbit, Vacuum           | EnemyData_AutomatonEnforcer.lua:66   |
| Dragon_Elite              | Orbit, Vacuum           | EnemyData_Dragon.lua:88              |
| Brute_Elite               | Orbit, Vacuum           | EnemyData_Brute.lua:78               |
| WaterElemental_Elite      | Metallic, Orbit, Vacuum | EnemyData_WaterElemental.lua:58      |
| Screamer_Elite            | Tracking                | EnemyData_Screamer.lua:61            |
| Screamer2                 | Tracking, Vacuuming     | EnemyData_Screamer.lua:161           |
| Treant2                   | Frenzy                  | EnemyData_Treant.lua:60              |

`Vacuum` is not `Vacuuming`: do not silently repair that native spelling.
Blocks of absent options do nothing. Rooting requires room set F/H;
StasisDeath requires N/N_SubRooms/O/P (`EnemyData.lua:436–471`). HeavyArmor
excludes SuperElite (`:313`); no supported identity inherits SuperElite.

The existing catalog already correctly sets `elite: false` for
ZombieAssassin_Elite, ZombieCrewman_Elite and ZombieOlympus_Elite. Their names and
armor do not make them Fangs candidates. Conversely Treant2/Screamer2 inherit
Elite and participate as fixed seeds. Do not add another competing elite flag.

Run bans have an initialized table (`RunLogic.lua:421`), but their ordinary
selection call is commented (`:503`). The only encounter-specific ban declaration
found is Challenge (`EncounterData_Challenge.lua:412`), outside scope. Preserve
native runtime guards; do not add hypothetical authored progression inputs.

## Legal combinations

Every pair of distinct, individually eligible options is possible except:

| Incompatible pair    | EnemyData.lua lines |
| -------------------- | ------------------- |
| Blink / Orbit        | 282, 411            |
| Frenzy / Homing      | 298, 372            |
| Frenzy / Vacuuming   | 298, 352            |
| ExtraDamage / Molten | 333, 359            |
| Fog / Metallic       | 494, 522            |

Native removal is ordered/directed; these current declarations happen to be
symmetric. Keep declaration-owned blocked successors, not hand-coded picker
exceptions. Rank 1 requires one pick, rank 2 two when available; no premature
finish while another compatible option exists. Empty pools do not grant perks.

## Selection is not a promise about every spawned unit

Fog, Hex and Metallic each have `MaxPerRoom = 1`
(`EnemyData.lua:484,510,516`). `ApplyEliteAttribute` enforces that at application
(`ShrineLogic.lua:612–622`), not during selection. Thus repeated waves/cages can
legally select them, but not every copy will receive them. Show the cap in perk
supporting text; do not recreate a room-wide application ledger in the planner.

Squads require a bounded runtime probe: FishSwarmerSquad_Elite and
SimpleSquad_Elite inherit generic options, not their children's additions/blocks
(`EnemyData_FishSwarmer.lua:183`, `EnemyData_Simple.lua:147`). Selection records
the squad key. `SpawnUnitGroup` changes the identity to the child
(`EncounterLogic.lua:1011–1040`); `SetupUnit` looks up the final unit name
(`RoomLogic.lua:3309–3319`). No remapping was found. Source therefore indicates
the chosen squad perks may not reach members. Keep native selection semantics,
explain this limitation for those candidates, and test in game before claiming
member effects. Do not insert child-key copies as an unapproved game correction.

## Current disposition

The delivered Fangs checkpoint uses separate Target and Perks pickers: target
changes persist, perk prefixes are transient until Finish. The revised complete
composition plan retains these controls but replaces optional native perk draws
with required assignments wherever Fangs applies. UI details and delivery gates
belong to that plan, not this source matrix.

Candidates come from the resolved authored encounter composition, deduplicated
across waves, including fixed seeds. No speculative random types. Retain stale
authored choices for repair when composition/rank changes. Inactive Fangs and
blocked encounters retain dormant values without exporting overrides.

Primary coverage: complete pool/filter matrix, five pair exclusions in both
orders, all distinct eligible pairs, rank/exhaustion, fixed seeds, nonelite armor,
biome requirements in Dream order, repeated waves and separate cages. Cover
native selection separately from capped/grouped application. The source matrix
and delivered code do not by themselves establish live-game acceptance.
