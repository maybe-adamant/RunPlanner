# Encounter Selection and Composition Game-Data Audit

## Status and Scope

This document is the stable source-evidence authority for Hades II encounter
selection and composition facts relevant to Run Planner. It records what the
game declares and when the game performs each transition. Source facts remain
separate from the explicit Planner dispositions recorded for completed audits.

The audit was refreshed on 2026-08-03 against the installed Steam build:

- application ID: `1145350`;
- build ID: `24432219`;
- script timestamps: 2026-08-01;
- route biomes: F, G, H, I, N, O, P, and Q.

The P ordered-encounter setup, execution, Fig Leaf propagation, and
end-effect paths were reread directly on 2026-08-23 against installed Steam
build `24556151`. That focused reread confirmed the P facts and source
disposition recorded below; the remaining encounter matrices retain their
2026-08-03 evidence date.

The Nemesis combat, random-event, generated-reward, and Fields-capacity paths
were also reread directly on 2026-08-23 against installed Steam build
`24556151`. That focused amendment replaces the earlier partial Nemesis notes
with the closed matrix and Planner disposition below.

The scope is:

- combat-bearing room and phase encounter pools;
- ordinary generated, opening, side-room, miniboss, boss, and Devotion combat
  identities needed to close that accounting;
- Artemis, Heracles, Icarus, Athena, Arachne, and Nemesis field encounters;
- encounter selection, recording, counter, and multi-phase timing;
- adjacent Nemesis random-event and Shop facts needed to distinguish them from
  combat replacement;
- the boundary where a selected encounter enters lower-level enemy generation;
  the detailed formation pipeline is owned by the focused enemy-formation
  audit.

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
- `EncounterLogic.lua`;
- `InteractLogic.lua`;
- `EventLogic.lua`;
- `NarrativeLogic.lua`;
- `RequirementsLogic.lua`;
- `TradeLogic.lua`;
- `SellTraitLogic.lua`;
- `ConsumableData.lua`;
- `LootData.lua`;
- `GiftLogic.lua`;
- `PowersLogic.lua`;
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

Planner disposition: the mutually exclusive I ordinary/Goal pairs are one
authored Combat profile per room-declared set. Clockwork reward realization
selects the exact eligible member during encounter preparation, so the exact
Goal keys remain history facts but are not separate authoring choices. The
overlapping P generators remain separate because the source does not provide
the same exclusive contextual partition.

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

F is the one raw postboss exception: `F_PostBoss01` names
`Story_Chronos_01`, whose definition inherits `Empty` and exists to run
conditional Chronos conversations and spawning from persistent progression
state. No source requirement consumes its completed identity. The normalized
static baseline therefore binds shared `Empty`, matching the other supported
postboss rooms without importing those progression events.

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

### P ordered execution and end effects

The build-24556151 reread confirms that P is an ordinary use of the game's
generic multiple-encounter protocol, not a separate composition system.
`SetupRoomMultipleEncountersData` chooses and records the positions in order.
A selected `BlockMultipleEncounters` member terminates construction of the
remaining suffix; the room runner later starts and completes every constructed
member in order before setting `AllEncountersCompleted` and allowing exit
readiness to proceed.

`GeneratedP_PreCombat` is a real selected, started, and completed first
position. It is non-counting and declares `SkipEndEncounterEffects`, so its
completion does not run the encounter-use/end-effect checkpoint. The later
`GeneratedP` position is counting and becomes independently unskippable after
another position through `CanEncounterSkipIfNotFirst = false`.
`HeraclesCombatP` is counting and declares `BlockMultipleEncounters`, so a
valid Heracles first selection is the complete active sequence and the second
position is neither constructed nor recorded.

A successful Fig Leaf roll at the P pre-combat position marks every already
constructed room encounter as spawn-skipped. Later positions carry the
multi-encounter propagation marker and do not consume another Fig Leaf use.
Both P positions still start and complete: the first still suppresses end
effects, while the terminal position still runs them. Skipped execution is
therefore distinct from completion and from the later end-effect checkpoint.

| P result                          | Active sequence                      | Encounter-depth advances | End-effect checkpoints |
| --------------------------------- | ------------------------------------ | -----------------------: | ---------------------: |
| normal, Athena, Icarus, or Gorgon | pre-combat, terminal                 |                        1 |         1, at terminal |
| Heracles                          | Heracles                             |                        1 |                      1 |
| successful Fig Leaf               | skipped pre-combat, skipped terminal |                        1 |         1, at terminal |

O remains the control case: its ordinary Intro is non-counting but does not
declare `SkipEndEncounterEffects`, so its Intro and every later active combat
run their own end-effect checkpoint. Encounter depth, encounter completion,
and end effects are three independent source facts.

## Field-NPC Source Matrix

### Concrete placements and encounter effects

| Family / mode   | Biome | Source set or position             | Standard concrete key      | Counts encounter depth | Sequence or reward effect                                                                       |
| --------------- | ----- | ---------------------------------- | -------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| Artemis combat  | F     | `FEncountersDefault`               | `ArtemisCombatF`           | yes                    | none                                                                                            |
| Artemis combat  | G     | `GEncountersDefault`               | `ArtemisCombatG`           | yes                    | none                                                                                            |
| Artemis combat  | N     | N default/smaller/bigger sets      | `ArtemisCombatN`           | yes                    | none                                                                                            |
| Heracles combat | N     | N default/smaller/bigger sets      | `HeraclesCombatN`          | yes                    | none                                                                                            |
| Heracles combat | O     | `OEncountersIntros`                | `HeraclesCombatO`          | yes                    | turns the normally non-counting Intro into a counting encounter                                 |
| Heracles combat | P     | P first position                   | `HeraclesCombatP`          | yes                    | blocks the later main position                                                                  |
| Icarus combat   | O     | `OEncountersDefault`               | `IcarusCombatO`            | yes                    | can occupy either active O main combat position                                                 |
| Icarus combat   | P     | `PEncountersDefault`               | `IcarusCombatP`            | yes                    | Outdoor room requirement                                                                        |
| Athena combat   | P     | `PEncountersDefault`               | `AthenaCombatP`            | yes                    | none                                                                                            |
| Arachne cocoon  | F     | `FEncountersDefault`               | `ArachneCombatF`           | no                     | replaces a normally counting combat                                                             |
| Arachne cocoon  | G     | `GEncountersDefault`               | `ArachneCombatG`           | no                     | replaces a normally counting combat                                                             |
| Nemesis combat  | F     | `FEncountersDefault`               | `NemesisCombatF`           | yes                    | kill-race wager can add or remove up to 100 Gold                                                |
| Nemesis combat  | G     | `GEncountersDefault`               | `NemesisCombatG`           | yes                    | same kill-race wager                                                                            |
| Nemesis combat  | H     | `HEncountersDefault` cage position | `NemesisCombatH`           | yes                    | preserves the cage reward; kill-race wager remains                                              |
| Nemesis combat  | I     | I default/smaller sets             | `NemesisCombatI`           | yes                    | preserves the room reward; kill-race wager remains                                              |
| Nemesis random  | F/G   | F/G default set                    | `NemesisRandomEvent`       | no                     | replaces combat and suppresses the inherited ordinary room-reward spawn                         |
| Nemesis random  | H     | H passive set                      | `NemesisRandomEvent`       | no                     | selected instead of the generated passive identity; separate optional-reward generation remains |
| Nemesis Bridge  | H     | `H_Bridge01` legal support         | `BridgeNemesisRandomEvent` | no                     | Bridge-specific fixed-room composition                                                          |

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
2. interacting with Nemesis during `NemesisRandomEvent` causes the narrative
   system to choose one eligible interaction family and its realized request
   or offer. The player chooses only the response where that family has an
   accept/decline decision.

`GetRandomEligibleTextLines` owns the second random choice. The interaction
family is therefore a realized game outcome, not a menu from which the player
chooses. External dialogue and profile-history requirements affect which lines
can be selected, but do not change the five ordinary mechanical families.

### Biome placement and ordinary reward delivery

| Biome | Clean combat placement | Random-event placement | Ordinary room or cage reward                                                          |
| ----- | ---------------------- | ---------------------- | ------------------------------------------------------------------------------------- |
| F     | main encounter         | main encounter         | combat spawns the incoming door reward; random event suppresses its spawn             |
| G     | main encounter         | main encounter         | combat spawns the incoming door reward; random event suppresses its spawn             |
| H     | one cage encounter     | passive encounter slot | combat leaves that cage's reward intact; random event leaves every cage reward intact |
| I     | main encounter         | absent                 | combat spawns the incoming door reward                                                |

`EncounterSets.lua` declares one clean combat member for each of F, G, H, and
I. F and G each also contain two weighted `NemesisRandomEvent` entries. H
declares the random event in both passive sets, while I has no random-event
member.

For F and G, the incoming door reward and its exact source are selected before
the room encounter. That draw remains visible to the random event's
`RequireNotRoomReward` exclusion. `NemesisRandomEvent` then replaces the
inherited `NonCombat` event list with `UnthreadedEvents = {}`, so the already
drawn incoming reward is not spawned. Encounter selection does not refund or
replace the reward-bag draw.

The clean F, G, and I combat event sequences call `SpawnRoomReward` before
settling the Nemesis kill-race wager. H combat uses its Fields-specific event
sequence and does not spawn a second reward because the active cage already
owns one. This is the clean combat behavior the Planner currently models.

Combat and random-event occurrences share `NoRecentNemesisEncounter`: the
source looks back 99 rooms across the Nemesis combat variants, the ordinary
random event, and the Bridge event. They also share the six-room
`NoRecentFieldNPCEncounter` spacing rule. The ordinary random event is limited
to one occurrence per biome, and H separately excludes a second H combat or
random event in that biome.

### Ordinary random-event family matrix

| Family         | Game-selected request or result                                                                     | Player response                                                            | Produced pickup                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| free item      | one eligible `EmptyMaxHealthDrop`, `HealDrop`, `LastStandDrop`, or `ArmorBoost`                     | none                                                                       | optional                                                                                            |
| Gold trade     | one eligible health, magick, Pom, or Hammer item plus an inclusive rolled Gold price                | accept or decline; insufficient Gold disables accept                       | required on accept; absent on decline                                                               |
| damage trade   | one eligible health, magick, Pom, Gold, or `TalentDrop` item plus an inclusive rolled damage amount | accept or decline; the source deals pure damage before creating the reward | required on surviving accept; absent on decline or death                                            |
| trait trade    | one eligible equipped god trait, preferring Common when any exist                                   | accept or decline                                                          | removes that exact trait and creates required `RoomMoneyTripleDrop` on accept; no change on decline |
| damage contest | success or failure, then one eligible result from the corresponding pool                            | deal damage after starting the five-second contest                         | optional                                                                                            |

The free-item pool includes `LastStandDrop` only while `MissingLastStand` is
true. It has no accept/decline step.

The Gold-trade result and price domains in `NPCData.lua` are:

| Result             | Entered-biome condition                           | Inclusive Gold price |
| ------------------ | ------------------------------------------------- | -------------------- |
| `MaxHealthDrop`    | `EnteredBiomes <= 2`                              | 105–130              |
| `MaxHealthDropBig` | `EnteredBiomes > 2`                               | 230–255              |
| `MaxManaDrop`      | `EnteredBiomes <= 2`                              | 80–105               |
| `MaxManaDropBig`   | `EnteredBiomes > 2`                               | 180–205              |
| `StackUpgrade`     | `EnteredBiomes <= 1` and Pom legal                | 80–105               |
| `StackUpgradeBig`  | `EnteredBiomes > 1` and Pom legal                 | 280–305              |
| `WeaponUpgrade`    | an early- or late-Hammer requirement is satisfied | 180–205              |

The damage-trade pool uses the same health and magick split at two entered
biomes and the same Pom split after one entered biome. The early result costs
10–20 damage; each corresponding late result costs 20–40. `RoomMoneyDrop`
uses 10–20 through the first entered biome and 20–40 afterward. `TalentDrop`
always costs 10–20 and is present only when `TalentLegal` is true. The repeat
interaction family also requires `NoHitShieldAvailable`. The current source
offers Path of Stars (`TalentDrop`), not Psyche.

The trait trade is eligible only when the hero owns a rarity-bearing trait for
which `IsGodTrait(..., ForShop = true)` succeeds. Trade construction selects
exactly one trait, randomly among Common candidates when any exist and
otherwise randomly among all eligible candidates. Acceptance removes that
exact trait before creating the Gold pickup.

The damage contest starts its five-second timer on the first hit. At 1,000
damage, it selects one eligible `MaxHealthDrop`, `MaxManaDrop`, `StackUpgrade`,
`RoomMoneyDrop`, or `TalentDrop`; Pom and Path of Stars retain their ordinary
legality requirements. Failure produces `RoomRewardConsolationPrize`. Reaching
2,000 damage changes presentation only and does not alter the success pool.

### Interaction gate and generated-pickup behavior

Spawning Nemesis adds the NPC to `MapState.RoomRequiredObjects`. Ordinary
dialogue clears that required object after the interaction. The damage contest
deliberately skips the ordinary clear and releases the gate only after its
timer and result resolve. Thus the Nemesis contact is required even when its
generated item is optional.

Accepted trades add their generated result to `RoomRequiredObjects`. Free-item
and damage-contest results do not, so those pickups remain optional. Generated
consumables use the ordinary pickup path with `NPCDrop = true`; that flag
disables the usual Money/health reward multipliers but does not create a
Nemesis-specific acquisition lifecycle.

The exact concrete declaration continues to determine pickup capabilities:

| Result identity                        | Sea Star | Time Piece | Artificer | Echo last reward |
| -------------------------------------- | -------- | ---------- | --------- | ---------------- |
| `EmptyMaxHealthDrop`                   | yes      | yes        | no        | no               |
| `HealDrop`                             | yes      | no         | no        | no               |
| `LastStandDrop`                        | yes      | yes        | no        | no               |
| `ArmorBoost`                           | yes      | yes        | no        | no               |
| `MaxHealthDrop`, `MaxHealthDropBig`    | yes      | yes        | no        | yes              |
| `MaxManaDrop`, `MaxManaDropBig`        | yes      | yes        | no        | yes              |
| `StackUpgrade`, `StackUpgradeBig`      | yes      | yes        | no        | yes              |
| `WeaponUpgrade`                        | no       | yes        | no        | yes              |
| `RoomMoneyDrop`, `RoomMoneyTripleDrop` | yes      | no         | no        | yes              |
| `TalentDrop`                           | yes      | yes        | no        | yes              |
| `RoomRewardConsolationPrize`           | yes      | yes        | no        | no               |

These capabilities apply at the actual generated pickup. Converting the item
first prevents its normal pickup, Sea Star roll, and last-reward update. None
of the ordinary Nemesis results inherits `MetaConversionEligible`, so none is
an Artificer source. A Nemesis Gold or damage trade is not a Shop purchase: the
accepted exchange creates a later required pickup and that pickup retains its
ordinary declaration capabilities.

### H Fields capacity and chronology

H generates and locks its cage rewards first. It then generates optional
Fields rewards independently. When `BlockMaxBonusRewards` is active and the
optional result count would occupy every physical bonus spawn point,
`GenerateOptionalRewards` clamps that count to `#BonusRewardSpawnPoints - 1`.
This reserves one physical position for Nemesis; it does not disable the
separate optional-reward generator, consume a Fields optional-reward bag entry,
or remove a cage reward. The clamp is conditional: when chance rolls already
produce fewer optional rewards than the number of physical points, no count is
decremented.

The normalized H declarations expose physical optional capacities from two to
four. Enabling the random event therefore leaves up to `capacity - 1` ordinary
optional rewards. For example, a four-position room can contain Nemesis and up
to three generated optional rewards.

Nemesis does not declare `BlockFieldsEncounterStart`. The required interaction
may therefore occur before, between, or after cage interactions, but it must
resolve before room exit. `NemesisCombatH` remains a separate counting cage
encounter and is not this passive room feature.

The Fields-only `MoneyDropStore = 25` caps ordinary enemy Gold drops during the
random event. It is not a room-reward replacement or a generated event pickup.

### Adjacent behavior excluded from the random-event model

`BridgeNemesisRandomEvent` is a separate, one-time progression encounter with
its own premium free-item pool. It is outside the Planner's run-local Nemesis
model.

`NemesisShopping` is Shop-owned behavior. Nemesis takes long enough to buy an
item that the player can purchase an intended offer first; modeling shop theft
would add timing without improving route validity, so it is excluded. The
current source event steals one Shop item and then calls
`NemesisTeleportExitPresentation`; it does not call `NemesisTakeRoomExit` or
disable an offered exit.

After an ordinary random event, `NemesisTakeRoomExit` first filters the offered
doors to exits without an encounter cost and whose health cost, if any, the
player can afford. With one or fewer eligible exits, Nemesis teleports away and
steals nothing. With two or more, the game randomly chooses one; it can be the
Planner's intended continuation unless the player has already begun using it.

A Chaos gate participates in this calculation. `HandleSecretSpawns` creates it
as `ObstacleData.SecretDoor`, assigns its Chaos room through
`AssignRoomToExitDoor`, and therefore inserts it into
`MapState.OfferedExitDoors`. It has a health cost and no encounter cost, so it
is eligible for Nemesis only while current health is strictly greater than the
gate cost. If stolen, its `TrialUpgrade` reward identity is recorded in
`NemesisTakeExitRecord` like any other offered exit.

The Planner does not model current health. It therefore treats every authored
natural Chaos gate as affordable and includes it in the eligible-exit count.

The authored Zagreus Contract special exit does not participate in door theft.
In source it is also assigned through `AssignRoomToExitDoor` and can coexist
with `NemesisShopping` in a supported Shop room. That Shop event uses its
separate item-theft path and teleports Nemesis away; it never invokes the door
theft function. Conversely, Nemesis combat and `NemesisRandomEvent`, which do
invoke door theft, are not Shop-room encounters. The Planner therefore protects
every Shop exit, including a selected or unselected Zagreus Contract, and
excludes `zagreusContract` from Nemesis's eligible-exit count.

The Planner makes this timing race simulation-neutral. A room with one eligible
exit has no theft. In a room with two or three eligible exits, the authored
selected continuation is protected and Nemesis is treated as taking one of the
nonselected exits. Because the removed exit cannot affect the authored route,
the Planner persists no theft state. This conclusion follows directly from the
source branch: theft is unreachable with one eligible exit, while two or more
eligible exits guarantee at least one other candidate after protecting exactly
one authored continuation. A selected Chaos continuation receives the same
protection; an eligible unselected Chaos gate can be the simulation-neutral
stolen alternative.

After a clean Nemesis combat kill race, `HandleNemesisEncounterReward` compares
Melinoe and Nemesis kills. It can add or remove a wager of up to 100 Gold; a tie
does nothing. The encounter and ordinary reward timing are modeled, while the
scalar wager outcome remains deferred.

### Settled Planner disposition

- The existing clean Nemesis combat representation remains the complete I
  model and remains available in F, G, and H.
- F and G persist one realized Nemesis encounter subtype: clean combat or one
  of the five random-event families. A random event suppresses delivery of the
  already-drawn incoming reward while preserving its exact identity and
  reward-bag consumption.
- Although the game selects H Nemesis instead of the generated passive
  encounter identity, the Planner persists the selection in the H Passive slot;
  the application presents it as an additive required Room Feature because the
  separate optional-reward generator still runs. There is no second feature
  boolean or event state. Nemesis sets the optional-reward upper bound to
  `capacity - 1`; it does not remove an already generated reward when the
  chance-rolled count is lower. It leaves cage rewards untouched and can be
  ordered freely among room interactions before exit. Retained authored states
  exceeding the resulting upper bound remain repairable rather than being
  silently truncated.
- One route-wide Nemesis occurrence rule covers clean combat and ordinary
  random events. The shared six-room field-NPC spacing rule also applies.
- The Planner authors the realized family and request or result rather than
  simulating profile history, text-line selection, or RNG. Free item and
  contest persist the selected item; Gold and damage trades persist only their
  accept/decline response; trait trade persists the selected eligible trait and
  response. Accept means the source cost was paid and the player survived. The
  exact rolled Gold price, damage amount, scalar affordability, health, death,
  contest threshold, and the 2,000-damage presentation tier remain outside
  simulation.
- Event-generated rewards use the ordinary acquisition and pickup semantics
  for their concrete declarations. Requiredness comes from the event family,
  trait trade reuses ordinary trait removal, and pickup alternatives remain
  available only at the actual pickup.
- Door theft is simulation-neutral: it is absent with one eligible exit, while
  a multiple-exit room protects the authored continuation and assigns theft to
  a nonselected exit. Authored natural Chaos always counts as eligible because
  health is unmodeled. A Zagreus Contract exit never counts: it can coexist
  with the separate Nemesis Shop event, but that event steals an item rather
  than a door, so every Shop exit is protected. Bridge progression, Shop theft,
  and combat-wager economy are not added to the authored Nemesis state.

The audited Planner boundary now includes the ordinary F/G/H
`NemesisRandomEvent`, its H Passive room feature, sparse source/result state,
and ordinary generated-pickup settlement. The normalized reward catalog also
retains the exact `EmptyMaxHealthDrop`, `HealDrop`, and
`RoomRewardConsolationPrize` identities; similarly named existing rewards are
not substitutes for those source objects.

## Enemy-Composition Pipeline

The generated wave, enemy-type, count, spawn-substitution, unit-setup, and
post-death pipeline is now owned by
[Enemy Formation and Fear Vows](ENEMY_FORMATION_AND_FEAR_VOW_GAME_DATA_AUDIT.md).
That audit also records how ordinary Combat and Devotion reuse the generator
and where Vows of Hordes, Menace, Fangs, Return, and the unit-modifying Vows
intervene.

The encounter-selection conclusions in this document stop once
`SetupEncounter` receives the selected declaration. Concrete waves still
depend on run and profile history, room and map facts, enemy declarations,
traits, encounter overrides, and RNG; encounter identity and biome depth alone
do not determine them.

## Confirmed Unknowns and Runtime Probes

The following questions remain outside static-source certainty:

1. Whether narrowing a legal set at runtime preserves every setup,
   introduction, recording, and completion behavior for all supported rooms.
2. Whether an exact requested enemy type survives every introduction and map
   compatibility path described in the enemy-formation audit.
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

## Current P planner disposition

The planner keeps P's exact `Intro` and `Combat` selections in the ordinary
phase-based authored state. Shared sequential preparation records the valid
first position before evaluating the second, and the normalized
`terminateSuffix` fact represents `BlockMultipleEncounters`. The generic room
lifecycle executes only that prepared active prefix. Fig Leaf remains owned by
the exact eligible first phase and propagates skipped execution without
removing either completion identity.

Encounter completion now emits its own history fact, followed by
`encounterEndEffectsApplied` only when the resolved declaration permits the
game's end effects. Encounter-counted Chaos maturation and Experimental Hammer
duration consume that later event. Neither consumer contains P, phase-index,
or Fig Leaf timing policy.

The editor exposes those two persisted positions through their ordinary,
sequential phase controls: **Opening encounter** for `Intro` and **Follow-up
encounter** for `Combat`. The second control is evaluated only after the
selected first phase has extended the room preparation; a terminating Heracles
selection withholds it while retaining the dormant stored Combat selection for
a later ordinary edit. Exact Fig Leaf, Gorgon, and terminal trait-offer
children retain their phase owners. No P preset, variant enum, composition
descriptor, second runtime sequence, or composite command is persisted.
