# Encounter Selection and Composition Game-Data Audit

## Status and Scope

This document is the stable source-evidence authority for Hades II encounter
selection and composition facts relevant to Run Planner. It records what the
game declares and when the game performs each transition. It does not decide
which distinctions the planner will model, simplify, defer, or expose.

The audit was refreshed on 2026-08-03 against the installed Steam build:

- application ID: `1145350`;
- build ID: `24432219`;
- script timestamps: 2026-08-01;
- route biomes: F, G, H, I, N, O, P, and Q.

The scope is:

- combat-bearing room and phase encounter pools;
- ordinary generated, opening, side-room, miniboss, boss, and Devotion combat
  identities needed to close that accounting;
- Artemis, Heracles, Icarus, Athena, Arachne, and Nemesis field encounters;
- encounter selection, recording, counter, and multi-phase timing;
- adjacent Nemesis random-event and Shop facts needed to distinguish them from
  combat replacement;
- the lower-level enemy-generation pipeline as future encounter-composition
  evidence.

Story presentation, dialogue content, exact enemy waves, rewards unrelated to
encounter eligibility, debug-only rooms, Anomaly rooms, and runtime forcing are
outside the completed source matrix unless called out explicitly.

Statements marked **runtime probe required** are not established by static Lua
inspection. All other behavior below was traced through the named scripts and
inheritance chains.

## Primary Sources

The primary evidence is the installed game scripts:

- `EncounterSets.lua`;
- `RunLogic.lua`;
- `RoomLogic.lua`;
- `RoomDataF.lua` through `RoomDataQ.lua`;
- `EncounterData.lua`;
- `EncounterData_Generated.lua`;
- `EncounterData_Opening.lua`;
- `EncounterData_Intro.lua`;
- `EncounterData_MiniBoss.lua`;
- `EncounterData_Devotion.lua`;
- `EncounterData_Artemis.lua`;
- `EncounterData_Heracles.lua`;
- `EncounterData_Icarus.lua`;
- `EncounterData_Athena.lua`;
- `EncounterData_Arachne.lua`;
- `EncounterData_Nemesis.lua`;
- `EncounterData_Story.lua`;
- `EncounterData_Unique.lua`;
- `RequirementsData.lua`;
- `NPCData.lua` and the family-specific NPC data files;
- `InteractLogic.lua`;
- `EventLogic.lua`;
- `NarrativeData.lua`.

## Encounter Selection Lifecycle

### Offered exits do not select ordinary encounters

`DoUnlockRoomExits` creates ordinary offered targets through `CreateRoom` with
`SkipChooseEncounter = true`. At offer time the target Room and its incoming
reward are known, but the target has no selected concrete encounter and no
encounter occurrence has been recorded.

After the player chooses an exit, `LeaveRoom` commits the predecessor to room
history and updates the relevant history caches. It then prepares only the
picked `nextRoom`:

- `SetupRoomMultipleEncountersData` resolves an ordered multi-encounter room;
- otherwise `ChooseEncounter` resolves its one encounter.

Initial rooms and other direct `CreateRoom` callers can choose immediately when
they do not use `SkipChooseEncounter`. Reward-owned special setup such as
Devotion is another distinct path.

### ChooseEncounter

`ChooseEncounter`:

1. reads the supplied phase `LegalEncounters`, otherwise the Room's legal set;
2. filters each entry through `IsEncounterEligible`;
3. prefers a forced eligible encounter when one exists;
4. otherwise chooses among eligible list entries;
5. deep-copies and sets up the chosen Encounter.

Repeated names are repeated entries in the random list and therefore affect
weight. They are not distinct concrete encounter identities. The game does not
declare one deterministic default member for a legal set.

Encounter eligibility can inspect:

- legal-set membership;
- room tags and room identity;
- the incoming room reward;
- current run, biome, encounter, completion, use, and room history;
- biome depth and biome encounter depth;
- appearance caps and rooms-since constraints;
- forced, blocked, or previously occurring encounters;
- named requirements and external save/profile state.

### Occurrence, start, and completion are distinct checkpoints

`RecordEncounter` runs during picked-room preparation. It updates encounter
occurrence caches before map load and encounter start.

`StartEncounter` later increments room, biome, and route encounter depth only
when the resolved Encounter has `CountsForRoomEncounterDepth = true`.

Encounter completion is recorded after combat. NPC use records are written by
NPC interaction paths, not by encounter selection. Different field NPCs use
different combinations of occurrence, completion, and use records for their
later requirements.

Consequently:

- unpicked offered rooms do not consume field-NPC occurrence;
- previous-room spacing observes committed predecessor room history;
- an encounter may have occurred without having started or completed;
- selecting an NPC encounter does not itself write that NPC's use record.

## Raw Named Encounter Sets

The following table reproduces every named F-through-Q encounter set from
`EncounterSets.lua`. `xN` is exact source multiplicity in the list. Commented
entries are not members and are listed separately afterward.

| Source set                | Raw members and multiplicity                                                                                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FEncountersDefault`      | `GeneratedF x12`; `ArtemisCombatF x1`; `ArtemisCombatF2 x4`; `ArachneCombatF x2`; `NemesisCombatF x1`; `NemesisRandomEvent x2`; `ArtemisCombatIntro x8`; `NemesisCombatIntro x8` |
| `GEncountersDefault`      | `FishmanIntro x1`; `GeneratedG x12`; `ArtemisCombatG x1`; `ArtemisCombatG2 x4`; `ArachneCombatG x1`; `NemesisCombatG x1`; `NemesisRandomEvent x2`                                |
| `HEncountersDefault`      | `GeneratedH x7`; `GeneratedH_Treant2 x1`; `GeneratedH_Screamer2 x1`; `NemesisCombatH x1`                                                                                         |
| `HEncountersPassive`      | `GeneratedH_Passive x5`; `NemesisRandomEvent x1`                                                                                                                                 |
| `HEncountersPassiveSmall` | `GeneratedH_PassiveSmall x5`; `NemesisRandomEvent x1`                                                                                                                            |
| `IEncountersDefault`      | `ClockworkIntro x1`; `GeneratedI x1`; `GeneratedI_GoalReward x1`; `GeneratedIChronosIntro x1`; `NemesisCombatI x1`                                                               |
| `IEncountersSmaller`      | `ClockworkIntro x1`; `GeneratedI_Small x1`; `GeneratedI_Small_GoalReward x1`; `GeneratedI_SmallChronosIntro x1`; `NemesisCombatI x1`                                             |
| `NEncountersDefault`      | `GeneratedN x10`; `HeraclesCombatIntro x4`; `ArtemisCombatN x2`; `ArtemisCombatN2 x4`; `HeraclesCombatN x1`; `HeraclesCombatN2 x1`                                               |
| `NEncountersSmaller`      | `GeneratedN_Smaller x10`; `ArtemisCombatN x2`; `ArtemisCombatN2 x4`; `HeraclesCombatN x1`; `HeraclesCombatN2 x1`                                                                 |
| `NEncountersBigger`       | `GeneratedN_Bigger x10`; `ArtemisCombatN x2`; `ArtemisCombatN2 x4`; `HeraclesCombatN x1`; `HeraclesCombatN2 x1`                                                                  |
| `NEncountersSubRoom`      | `GeneratedNSubRoom x5`; `GeneratedNSubRoom_Bigger x5`                                                                                                                            |
| `NEncountersSubRoomLight` | `GeneratedNSubRoom x6`; `Empty x1`                                                                                                                                               |
| `NEncountersSubRoomHeavy` | `GeneratedNSubRoom_Bigger x1`                                                                                                                                                    |
| `OEncountersDefault`      | `GeneratedO x10`; `DeadSeaIntro x1`; `IcarusCombatO x1`; `IcarusCombatO2 x4`; `IcarusCombatIntro x9`                                                                             |
| `OEncountersIntros`       | `GeneratedO_Intro01 x14`; `GeneratedO_Intro01_First x1`; `HeraclesCombatO x1`; `HeraclesCombatO2 x1`                                                                             |
| `PEncountersDefault`      | `GeneratedP x11`; `GeneratedP_Large x11`; `AthenaCombatIntro x8`; `AthenaCombatP x3`; `AthenaCombatP02 x3`; `IcarusCombatP x1`                                                   |
| `PEncountersIntros`       | `GeneratedP_PreCombat x1`; `GeneratedP_PreCombatChronosForces x1`; `HeraclesCombatP x1`                                                                                          |
| `QEncountersDefault`      | `GeneratedQ x1`; `TyphonIntro x1`                                                                                                                                                |
| `QEncountersIslands`      | `GeneratedQ_Islands x1`                                                                                                                                                          |
| `QEncountersPreBoss`      | `GeneratedQ_Large x1`; `TyphonIntro x1`                                                                                                                                          |

Commented source entries include `IcarusCombatP2` in `PEncountersDefault` and
`HeraclesCombatP2` in `PEncountersIntros`. They do not participate in the
installed build's support set.

## Room and Phase Bindings

### Pool-backed combat rooms

The table identifies the legal support used at each source selection position.
Room ranges refer to the named route rooms in the installed scripts.

| Biome / rooms                         | Source position                             | Legal set or inline support                                        | Encounter-depth facts and qualifications                                                |
| ------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| F `F_Opening01..03`                   | room encounter                              | `OpeningEmpty`, `OpeningGeneratedF`, `FCastTutorialFight`          | opening alternatives have their own progression requirements                            |
| F `F_Combat01`                        | room encounter                              | `FIntroFight`, `GeneratedF`                                        | overrides the F default set and therefore admits no field NPC                           |
| F `F_Combat02..22`                    | room encounter                              | `FEncountersDefault`                                               | ordinary generated and combat-NPC entries count; Arachne and Nemesis random do not      |
| G `G_Combat01..20`                    | room encounter                              | `GEncountersDefault`                                               | ordinary generated and combat-NPC entries count; Arachne and Nemesis random do not      |
| H `H_Combat01,03..08,10..12`          | passive encounter                           | `HEncountersPassive`                                               | ordinary passive and Nemesis random are non-counting                                    |
| H `H_Combat02,09,13..15`              | passive encounter                           | `HEncountersPassiveSmall`                                          | ordinary passive and Nemesis random are non-counting                                    |
| H each active reward cage             | cage encounter                              | `HEncountersDefault` from `FieldsRewardCage.LegalEncounters`       | cage encounters count; the number of active cage positions comes from Fields room setup |
| I `I_Combat01,06..19,21,24`           | room encounter                              | `IEncountersDefault`                                               | Goal and non-Goal generators are mutually gated by incoming Clockwork reward facts      |
| I `I_Combat02..05,20,22,23`           | room encounter                              | `IEncountersSmaller`                                               | smaller Goal and non-Goal generators have the same mutual gating                        |
| N `N_Opening01`                       | room encounter                              | `OpeningEmpty`, `OpeningGeneratedN`                                | opening alternatives are progression-gated                                              |
| N `N_PreHub01`                        | room encounter                              | `PreHubGeneratedN`                                                 | singleton, non-counting combat-bearing encounter                                        |
| N `N_Combat02..08,14,22,23`           | main Hub-room encounter                     | `NEncountersDefault`                                               | generated and standard Artemis/Heracles combat entries count                            |
| N `N_Combat12,17`                     | main Hub-room encounter                     | `NEncountersSmaller`                                               | generated and standard Artemis/Heracles combat entries count                            |
| N `N_Combat01,09..11,13,15,16,18..21` | main Hub-room encounter                     | `NEncountersBigger`                                                | generated and standard Artemis/Heracles combat entries count                            |
| N `N_Sub01,03..08,12,13,15`           | side-room encounter                         | `NEncountersSubRoom`                                               | both generated identities are non-counting                                              |
| N `N_Sub02`                           | side-room encounter                         | `NEncountersSubRoomLight`                                          | generated identity and `Empty` are non-counting                                         |
| N `N_Sub09..11,14`                    | side-room encounter                         | `NEncountersSubRoomHeavy`                                          | exact source member is `GeneratedNSubRoom_Bigger`, with an underscore                   |
| O `O_Combat01..15`                    | first ordered position                      | `OEncountersIntros`                                                | ordinary intro is non-counting; Heracles is counting                                    |
| O `O_Combat01..15`                    | second position and optional third position | `OEncountersDefault`                                               | each selected main combat is counting; the third position has `ChanceToPlay = 0.6`      |
| P `P_Intro`                           | room encounter                              | inline `PIntroCombat*`, two `Empty` entries, `PIntroDreamRunEmpty` | `BasePIntroEncounters` is non-counting                                                  |
| P `P_Combat01..19`                    | first ordered position                      | `PEncountersIntros` plus map-specific pre-combat keys              | position is non-counting unless Heracles is selected                                    |
| P `P_Combat01..19`                    | second ordered position                     | `PEncountersDefault`                                               | generated, Athena, and Icarus standard combat identities count                          |
| Q `Q_Combat01,02,04,06..09,12..16`    | room encounter                              | `QEncountersDefault`                                               | `GeneratedQ` is the ordinary generator; `TyphonIntro` is progression-gated              |
| Q `Q_Combat03,05`                     | room encounter                              | `QEncountersIslands`                                               | singleton `GeneratedQ_Islands`                                                          |
| Q `Q_Combat10,11`                     | room encounter                              | `QEncountersPreBoss`                                               | `GeneratedQ_Large` plus progression-gated `TyphonIntro`                                 |

The source spelling distinction for N heavy side rooms is material:
`GeneratedNSubRoom_Bigger` is the declared game encounter. The spelling
`GeneratedNSubRoomBigger` does not occur in the source set.

### P opening support

`P_Intro.LegalEncounters` contains these entries in source order:

```text
PIntroCombat01
PIntroCombat02
PIntroCombat03
PIntroCombat04
PIntroCombat05
PIntroCombat06
PIntroCombat07
PIntroCombat08
PIntroCombat09
PIntroCombat_DragonQuad
PIntroCombat_ZombieFishing
PIntroCombat_ZombieQuad
PIntroCombat_SapperGate
PIntroCombat_CrossbowStatues
Empty
PIntroCombat_SapperOverlook
Empty
PIntroDreamRunEmpty
```

The repeated `Empty` entry affects weighting. `PIntroDreamRunEmpty` is gated to
the Dream-run context. The combat entries inherit the non-counting
`BasePIntroEncounters` behavior.

### P map-specific pre-combat support

Every P normal room has two ordered positions. Its first position combines
`PEncountersIntros` with these room-local keys:

| Room             | Additional first-position members            |
| ---------------- | -------------------------------------------- |
| `P_Combat01`     | `P_Combat01_PreCombat01..04`                 |
| `P_Combat02`     | `P_Combat02_PreCombat01..03`                 |
| `P_Combat03`     | `OlympusIntro`, `P_Combat03_PreCombat01..03` |
| `P_Combat04`     | `P_Combat04_PreCombat01..03`                 |
| `P_Combat05`     | `P_Combat05_PreCombat01..03`                 |
| `P_Combat06`     | `P_Combat06_PreCombat01..04`                 |
| `P_Combat07`     | `P_Combat07_PreCombat01..03`                 |
| `P_Combat08`     | `P_Combat08_PreCombat01..03`                 |
| `P_Combat09`     | `P_Combat09_PreCombat01..03`                 |
| `P_Combat10`     | `P_Combat10_PreCombat01..03`                 |
| `P_Combat11`     | `P_Combat11_PreCombat01..04`                 |
| `P_Combat12`     | `P_Combat12_PreCombat01..03`                 |
| `P_Combat13`     | `P_Combat13_PreCombat01..03`                 |
| `P_Combat14`     | `P_Combat14_PreCombat01..03`                 |
| `P_Combat15`     | `P_Combat15_PreCombat01..04`                 |
| `P_Combat16`     | `P_Combat16_PreCombat01..03`                 |
| `P_Combat17..19` | no additional members                        |

The first position uses `ContinueIfInelligible = true`; an ineligible first
position does not prevent the later main position from being constructed.

### Context-sensitive ordinary members

The named support sets contain several mutually exclusive or overlapping
ordinary generators:

- `GeneratedI` rejects `ClockworkGoal`, while `GeneratedI_GoalReward` requires
  it;
- `GeneratedI_Small` and `GeneratedI_Small_GoalReward` have the equivalent
  smaller-set split;
- `GeneratedP` requires biome depth below 10;
- `GeneratedP_Large` requires biome depth at least 9;
- therefore both P generators are eligible at biome depth 9, while only the
  large generator is eligible from depth 10 onward;
- intro, Chronos, Typhon, first-time, and Dream-run identities use external or
  narrative requirements rather than one shared ordinary-run rule.

The source does not identify a deterministic winner for the overlapping P
depth-9 case. Multiplicity gives both generators equal raw list weight there.

### Fixed combat support

The following fixed combat-bearing route rooms do not admit a field NPC through
their legal encounter list. This table records the ordinary source identity or
legal family and the encounter-depth behavior established by the inherited
Encounter declarations.

| Biome | Fixed room support                                                                                                                                                         | Encounter-depth facts                                     |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| F     | `F_MiniBoss01: MiniBossTreant/MiniBossTreant_Shrine`; `F_MiniBoss02: MiniBossFogEmitter/MiniBossFogEmitter_Shrine`; `F_MiniBoss03: MiniBossAssassin`; Hecate boss variants | minibosses count; boss encounters do not                  |
| G     | `MiniBossWaterUnit`; `MiniBossCrawler`; `MiniBossJellyfish`; Scylla boss variants                                                                                          | WaterUnit and Jellyfish count; Crawler and boss do not    |
| H     | `MiniBossVampire`; `MiniBossLamia`; Cerberus boss variants                                                                                                                 | minibosses count; boss does not                           |
| I     | `MiniBossRatCatcher`; `MiniBossGoldElemental`; Chronos boss variants                                                                                                       | minibosses count; boss does not                           |
| N     | `MiniBossSatyrCrossbow`; `MiniBossBoar`; Polyphemus boss variants                                                                                                          | minibosses count; boss does not                           |
| O     | `MiniBossCharybdis`; `MiniBossCaptain`; reward-owned `DevotionTestO`; Eris boss variants                                                                                   | Captain and Devotion count; Charybdis and boss do not     |
| P     | `MiniBossTalos`; `MiniBossDragon`; Prometheus boss variants                                                                                                                | Dragon counts; Talos and boss do not                      |
| Q     | `BossTyphonArm01`; `MiniBossBrute`; `BossTyphonTail01`; `BossTyphonEye01`; `MiniBossStalker`; Typhon Head variants                                                         | Brute, Tail, and Stalker count; Arm, Eye, and Head do not |

Shop, Story, HealthRestore, `Empty`, and postboss identities are non-combat
selection positions and are outside the field-NPC replacement pools.

## Multiple-Encounter Composition

`SetupRoomMultipleEncountersData` considers each ordered position in turn. It
selects and records every eligible position during picked-room preparation.
Later selected entries are marked as subsequent encounters.

Those preparation-time records are immediately visible through
`CurrentRun.EncountersOccurredCache` and
`CurrentRun.EncountersOccurredBiomeCache`, so an occurrence-based requirement
on a later position sees an encounter recorded earlier in the same room.
`SumPrevRooms` has a different boundary: while the next room is being prepared,
it reads `CurrentRun.CurrentRoom` followed by `RoomHistory`. It therefore counts
the predecessor and earlier rooms, not positions already recorded for the next
room. Same-room occurrence exclusion and previous-room spacing are distinct
source checkpoints even though both ultimately inspect encounter history.

If the chosen Encounter has `BlockMultipleEncounters`, construction stops and
that Encounter is the last active position. Unpicked offered rooms do not
resolve any of these positions.

Important route structures are:

- O: non-counting Intro, counting first Combat, and a 60%-chance counting
  second Combat;
- P normal rooms: a non-counting first/pre-combat position followed by a
  counting main position;
- H Fields: a non-counting passive Encounter plus the room's active counting
  reward-cage positions.

The P field-NPC effects are asymmetric:

- `HeraclesCombatP` is selected only from the first-position support;
- it is counting and has `BlockMultipleEncounters`;
- when selected, the later main position is not constructed;
- `IcarusCombatP` and `AthenaCombatP` are selected only from the main-position
  support.

The O Heracles effect differs: `HeraclesCombatO` makes the Intro position
counting but does not block the later O combat positions.

## Field-NPC Source Matrix

### Concrete placements and encounter effects

| Family / mode   | Biome | Source set or position             | Standard concrete key      | Counts encounter depth | Sequence or reward effect                                               |
| --------------- | ----- | ---------------------------------- | -------------------------- | ---------------------- | ----------------------------------------------------------------------- |
| Artemis combat  | F     | `FEncountersDefault`               | `ArtemisCombatF`           | yes                    | none                                                                    |
| Artemis combat  | G     | `GEncountersDefault`               | `ArtemisCombatG`           | yes                    | none                                                                    |
| Artemis combat  | N     | N default/smaller/bigger sets      | `ArtemisCombatN`           | yes                    | none                                                                    |
| Heracles combat | N     | N default/smaller/bigger sets      | `HeraclesCombatN`          | yes                    | none                                                                    |
| Heracles combat | O     | `OEncountersIntros`                | `HeraclesCombatO`          | yes                    | turns the normally non-counting Intro into a counting encounter         |
| Heracles combat | P     | P first position                   | `HeraclesCombatP`          | yes                    | blocks the later main position                                          |
| Icarus combat   | O     | `OEncountersDefault`               | `IcarusCombatO`            | yes                    | can occupy either active O main combat position                         |
| Icarus combat   | P     | `PEncountersDefault`               | `IcarusCombatP`            | yes                    | Outdoor room requirement                                                |
| Athena combat   | P     | `PEncountersDefault`               | `AthenaCombatP`            | yes                    | none                                                                    |
| Arachne cocoon  | F     | `FEncountersDefault`               | `ArachneCombatF`           | no                     | replaces a normally counting combat                                     |
| Arachne cocoon  | G     | `GEncountersDefault`               | `ArachneCombatG`           | no                     | replaces a normally counting combat                                     |
| Nemesis combat  | F     | `FEncountersDefault`               | `NemesisCombatF`           | yes                    | kill-race wager can add or remove up to 100 Gold                        |
| Nemesis combat  | G     | `GEncountersDefault`               | `NemesisCombatG`           | yes                    | same kill-race wager                                                    |
| Nemesis combat  | H     | `HEncountersDefault` cage position | `NemesisCombatH`           | yes                    | preserves the cage reward; kill-race wager remains                      |
| Nemesis combat  | I     | I default/smaller sets             | `NemesisCombatI`           | yes                    | preserves the room reward; kill-race wager remains                      |
| Nemesis random  | F/G   | F/G default set                    | `NemesisRandomEvent`       | no                     | replaces combat and suppresses the inherited ordinary room-reward spawn |
| Nemesis random  | H     | H passive set                      | `NemesisRandomEvent`       | no                     | replaces passive work; cage encounters and cage rewards remain          |
| Nemesis Bridge  | H     | `H_Bridge01` legal support         | `BridgeNemesisRandomEvent` | no                     | Bridge-specific fixed-room composition                                  |

No Q named encounter set contains one of these field-NPC encounters.

### Intro and weight-oriented variants

| Family   | First-time or intro identities | Reweight/fallback identities                                | Adjacent Shop event                |
| -------- | ------------------------------ | ----------------------------------------------------------- | ---------------------------------- |
| Artemis  | `ArtemisCombatIntro`           | `ArtemisCombatF2`, `ArtemisCombatG2`, `ArtemisCombatN2`     | none                               |
| Heracles | `HeraclesCombatIntro`          | `HeraclesCombatN2`, `HeraclesCombatO2`; P2 is commented out | `HeraclesShopping` in N/O/P Shops  |
| Icarus   | `IcarusCombatIntro`            | `IcarusCombatO2`; P2 is commented out                       | none                               |
| Athena   | `AthenaCombatIntro`            | `AthenaCombatP02`                                           | none                               |
| Arachne  | no separate intro key          | none                                                        | none                               |
| Nemesis  | `NemesisCombatIntro`           | none                                                        | `NemesisShopping` in F/G/H/I Shops |

These are distinct source identities with distinct source requirements or list
weight. This audit does not decide whether a consumer preserves or projects
them.

### Depth, reward, and local placement requirements

Reward names are source keys. The reward tested is the incoming reward for the
room whose encounter is being chosen. An O wheel reward or an H cage-local
reward is not substituted for that incoming-room value in these requirements.

| Family / mode   | Depth requirement                                            | Forbidden incoming rewards                                                                      | Local placement requirements                               |
| --------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Artemis combat  | `BiomeDepthCache >= 4`                                       | `Boon`, `SpellDrop`, `Devotion`, `HermesUpgrade`, `WeaponUpgrade`                               | membership in F/G/N legal set                              |
| Heracles combat | no common depth minimum                                      | `Devotion`                                                                                      | N combat; O first position; P first position and Indoor    |
| Icarus combat   | `BiomeDepthCache >= 3`                                       | `Boon`, `SpellDrop`, `Devotion`, `HermesUpgrade`, `WeaponUpgrade`                               | O main position; P main position and Outdoor               |
| Athena combat   | `BiomeDepthCache >= 4`                                       | `Boon`, `SpellDrop`, `Devotion`, `HermesUpgrade`, `WeaponUpgrade`                               | P main position                                            |
| Arachne cocoon  | F: `4 <= BiomeDepthCache <= 8`; G: no local depth gate       | `Boon`, `SpellDrop`, `Devotion`, `HermesUpgrade`, `WeaponUpgrade`, `StackUpgrade`, `TalentDrop` | membership in F/G legal set                                |
| Nemesis combat  | F/G/I: `BiomeDepthCache >= 4`; H: `BiomeEncounterDepth >= 1` | `Boon`, `SpellDrop`, `Devotion`, `HermesUpgrade`, `WeaponUpgrade`, `StackUpgrade`, `TalentDrop` | F/G/I main combat or H cage                                |
| Nemesis random  | ordinary F/G/H: `BiomeDepthCache >= 4`                       | same seven-entry exclusion as Nemesis combat                                                    | F/G main encounter or H passive; Bridge has separate gates |

### Cardinality and spacing mechanisms

The game does not use one common NPC-history field:

| Family   | Same-family guard                                                                          | Spacing requirement                                                                                          |
| -------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Artemis  | `CurrentRun.UseRecord.NPC_Artemis_Field_01` must be false                                  | no listed field NPC in the previous 6 rooms                                                                  |
| Heracles | no Heracles encounter in `CurrentRun.EncountersCompletedCache`                             | no Heracles encounter in the previous 20 rooms and no listed field NPC in the previous 6 rooms               |
| Icarus   | `CurrentRun.UseRecord.NPC_Icarus_01` false, plus concrete current-run encounter exclusions | no listed field NPC in the previous 6 rooms                                                                  |
| Athena   | `CurrentRun.UseRecord.NPC_Athena_01` must be false                                         | no listed field NPC in the previous 6 rooms                                                                  |
| Nemesis  | no Nemesis encounter occurrence; the family predicate looks back 99 rooms                  | no listed field NPC in the previous 6 rooms; Shop appearances suppress encounters for an additional 12 rooms |
| Arachne  | no Arachne occurrence in `CurrentRun.EncountersOccurredBiomeCache`                         | no Arachne encounter in the previous 5 rooms; Arachne is not in the shared six-room field-NPC predicate      |

`EncountersOccurredBiomeCache` resets at biome transition. An Arachne encounter
in F therefore does not consume the G biome-local cap, although the five-room
lookback can still suppress an early G appearance.

The raw `NoRecentFieldNPCEncounter` list omits `AthenaCombatP02`. That omission
is present in the installed source.

### External save/profile requirements

The standard identities also inspect state outside run-local depth, reward,
room, occurrence, and spacing facts:

| Standard identity family | Additional external requirements                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Artemis                  | `ArtemisCombatIntro` completed; `StandardPackageBountyActive` false; `SurfaceRouteLockedByTyphonKill` false                                                                                |
| Heracles base            | `HeraclesCombatIntro` completed; `StandardPackageBountyActive` false                                                                                                                       |
| Heracles O               | `DeadSeaIntro` completed; lifetime `GameState.UseRecord.NPC_Heracles_01 >= 4`                                                                                                              |
| Heracles P               | lifetime Heracles uses at least 5; a prior `HeraclesCombatO/O2` occurrence; `AthenaFirstMeeting` recorded                                                                                  |
| Icarus base              | `GameState.BiomeVisits.O > 1`; `StandardPackageBountyActive` false                                                                                                                         |
| Icarus O                 | `IcarusCombatIntro` completed; no Icarus intro/O occurrence in the current run                                                                                                             |
| Icarus P                 | `IcarusCombatIntro` completed; lifetime Icarus uses at least 4; no Icarus encounter occurrence in the current run; `AthenaFirstMeeting` recorded                                           |
| Athena                   | `AthenaCombatIntro` completed; current-run Athena use absent; `AthenaEncounterKeepsake` not expired; `StandardPackageBountyActive` and `SurfaceRouteLockedByTyphonKill` false              |
| Arachne F                | at least one completed run; at least one of `MiniBossTreant`, `MiniBossFogEmitter`, or `BossHecate01` completed; its child requirements replace the base G-oriented completion requirement |
| Arachne G                | `ArachneCombatF` completed in game history                                                                                                                                                 |
| Nemesis F                | `NemesisCombatIntro` completed; `NemesisGetFreeItemIntro01` recorded; `StandardPackageBountyActive` and `HecateMissing` false                                                              |
| Nemesis G                | the F requirements plus no current-run `NemesisWithNarcissus01` text line                                                                                                                  |
| Nemesis H                | intro and free-item-intro completion; `StandardPackageBountyActive` and `HecateMissing` false                                                                                              |
| Nemesis I                | `NemesisCombatIntro`, `NemesisGetFreeItemIntro01`, and `NemesisPostCombatAboutTartarus02` recorded; `StandardPackageBountyActive` and `HecateMissing` false                                |

First-time identities have their own gates:

| Intro identity        | Salient requirements                                                                                                                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ArtemisCombatIntro`  | intro not completed; no current-run `ArachneFirstMeeting`; biome depth at least 3; at least one completed run; current health at least 10; no active bounty; at least four named prerequisite text lines recorded                                                                     |
| `HeraclesCombatIntro` | intro not completed; `HeraclesFirstMeeting` recorded in game history; neither `HeraclesFirstMeeting` nor `MedeaFirstMeeting` in the current run; no active bounty                                                                                                                     |
| `IcarusCombatIntro`   | no current-run `CirceFirstMeeting`; no Circe enlarge/shrink trait; intro not completed and not already occurred in the current run; current-run Icarus use absent; depth at least 3; more than one O visit; health fraction at least 0.33; no active bounty; shared field-NPC spacing |
| `AthenaCombatIntro`   | intro not completed; current-run Athena use absent; depth at least 4; no active bounty; shared field-NPC spacing                                                                                                                                                                      |
| `NemesisCombatIntro`  | intro not completed; at least seven completed runs; G Intro previously entered; previous run not cleared; depth at least 3; no active bounty; `StandardPackageBountyActive` and `HecateMissing` false                                                                                 |

The reweight identities append cross-run conditions rather than replacing the
standard family requirements:

| Identity family    | Added condition                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Artemis `F2/G2/N2` | no Artemis field spawn in the previous 4 runs and no Shrine interaction in the previous run                                     |
| Heracles `N2`      | no Heracles-family occurrence in the previous 8 runs and no Shrine interaction in the previous run                              |
| Heracles `O2/P2`   | no Heracles-family occurrence in the previous 4 runs and no Shrine interaction in the previous run; P2 is not a live set member |
| Icarus `O2/P2`     | no Icarus-family occurrence in the previous 4 runs and no Shrine interaction in the previous run; P2 is not a live set member   |
| `AthenaCombatP02`  | at most two Athena NPC spawns in the previous 4 runs and no Shrine interaction in the previous run                              |

These progression facts change eligibility or source weighting. The audit
records them without selecting a production disposition.

## Nemesis Random Events and Adjacent Behavior

Nemesis uses two selection checkpoints:

1. encounter preparation can choose combat or `NemesisRandomEvent` from a
   legal encounter list;
2. interacting with Nemesis during `NemesisRandomEvent` chooses an eligible
   text-line behavior that supplies a cost, challenge, and result.

The ordinary random event has five behavior families:

| Interaction family   | Ordinary biomes | Player cost or challenge       | Result                                                      | Additional requirements                                 |
| -------------------- | --------------- | ------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------- |
| free item            | F, G, H         | none                           | random health, healing, death-defiance, or armor consumable | Bridge uses a separate premium free-item realization    |
| buy item             | F, G, H         | randomized Gold price          | generated health, mana, Pom, or Hammer offer                | insufficient Gold prevents acceptance                   |
| take damage for item | F, G, H         | randomized direct damage       | generated health, mana, Pom, Gold, or Psyche offer          | repeat lines require no available hit shield            |
| give trait for item  | F, G, H         | one eligible Olympian trait    | `RoomMoneyTripleDrop`                                       | requires a sellable god trait                           |
| damage contest       | F, G, H         | deal 1,000 damage in 5 seconds | success reward pool or consolation reward                   | 2,000 damage changes presentation, not the success pool |

The random event is absent from I encounter sets. Most ordinary text-line
behaviors exclude `H_Bridge01`; the Bridge uses its separate realization.

### F/G reward suppression

The incoming door reward is chosen before encounter selection and remains
available to `RequireNotRoomReward` eligibility. `NonCombat` normally inherits
`EncounterEventsDefault`, whose final event calls `SpawnRoomReward`.
`NemesisRandomEvent` assigns `UnthreadedEvents = {}`, replacing the inherited
event list. The ordinary room reward is therefore not spawned. The selected
Nemesis interaction supplies the effective benefit or trade result.

### H Fields behavior

H has no singular main-room reward. The random event replaces the non-counting
passive encounter, while active cage encounters and their rewards remain.

`BlockMaxBonusRewards` can reserve an NPC position by reducing optional Fields
bonus positions when every point would otherwise be occupied. This does not
identify or rewrite one particular cage reward. The Fields-only
`MoneyDropStore = 25` caps ordinary enemy Gold drops; it is not a room-reward
replacement declaration.

`NemesisCombatH` is a separate counting member of `HEncountersDefault` and can
occupy a cage encounter.

### Shop and combat-wager behavior

`NemesisShopping` and `HeraclesShopping` are Shop-owned events. They are not
members of ordinary combat-phase selection merely because the same NPC can
appear there.

After a Nemesis combat kill race, `HandleNemesisEncounterReward` compares
Melinoe and Nemesis kills. The result can add or remove a wager of up to 100
Gold; a tie leaves Gold unchanged. This economy effect exists in addition to
the combat encounter identity.

## Enemy-Composition Pipeline

For a generated encounter, the game:

1. resolves difficulty from base values, biome/run/encounter depth, modifiers,
   and multipliers;
2. computes the active-enemy cap;
3. chooses a wave count and wave templates;
4. allocates difficulty across waves;
5. chooses highlight or family encounter generation;
6. filters an `EnemySet` through introduction, elite, blacklist, grouping,
   trait, and enemy-specific requirements;
7. chooses enemy types;
8. allocates counts from enemy difficulty ratings and count caps.

`SetupEncounter` can subsequently replace the generated result with an enemy
introduction encounter when a generated enemy has an unseen eligible intro.

Concrete waves therefore depend on more than encounter identity and biome
depth. Inputs include run history, save/profile state, room/map facts, traits,
enemy declarations, RNG, and encounter-specific overrides.

The source exposes possible intervention points—legal-set narrowing, enemy-set
replacement, and complete `SpawnWaves` data—but static inspection does not
prove that any is a safe execution adapter.

## Confirmed Unknowns and Runtime Probes

The following questions remain outside static-source certainty:

1. Whether narrowing a legal set at runtime preserves every setup,
   introduction, recording, and completion behavior for all supported rooms.
2. Whether an exact requested enemy type survives introduction replacement and
   map compatibility repair.
3. Whether complete authored waves can pass every active-cap, spawn-point,
   elite, timing, and encounter-completion path safely.
4. Which apparent source conditions are additionally affected by native engine
   behavior not visible in Lua.

A focused runtime probe should trace one ordinary and one NPC encounter from
offered exit creation through picked-room preparation, occurrence recording,
start, NPC interaction, completion, and next-room eligibility. Enemy-generation
probes should separately test pool narrowing, exact types, and exact waves.

These probes are evidence work. They do not imply a planner schema or runtime
adapter design.
