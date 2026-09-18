# Combat Room Encounter Composition Matrix

## Scope and evidence

This matrix covers **every encounter supported in biome Combat rooms**, not
only the default Combat choice, plus `O_Devotion01`. Field-NPC combats are
first-class entries. The unit is the resolved encounter identity at its phase:
H passive/cage phases, O Intro/Combat1/Combat2, and P Intro/Combat remain separate.

The current catalog exposes 155 scoped rooms and 94 distinct resolved encounter
identities: 39 generator-family identities (including 13 field-NPC combats and
four Devotion identities), 52 prescribed P precombat vignettes, two Arachne
cocoon encounters, and one shared Nemesis random event. These are not 94 picker
choices: ordinary Combat profiles also resolve reward-dependent Trial/Goal
identities.

The customization candidates are the **39 generator-family identities**,
including H's two mixed fixed/generated templates. The other 55 identities
remain in this inventory to explain their exclusion from wave/type
customization: P's prescribed rosters stay fixed, Arachne keeps its cocoon
mechanism, and Nemesis's noncombat event has no roster. Native-only variants
are summarized as intentional exclusions, not additional implementation scope.

Source inspection: 2026-09-18, installed Steam build `24556151`. The 125 local
encounter/enemy declaration, room declaration and supporting logic files used
for this pass were byte-equal to the installed scripts. Inheritance was checked
with the native `RunData.lua:ProcessDataInheritance` / `DeepInheritData`
functions; scalar defaults were not inferred from names or copied from a
different NPC/biome.

Authority split:

- [Encounter selection](ENCOUNTER_SELECTION_AND_COMPOSITION_FINDINGS.md) owns
  encounter availability, weighting, placement, recording and phase lifecycles.
- [Enemy formation and Fear Vows](ENEMY_FORMATION_AND_FEAR_VOW_GAME_DATA_AUDIT.md)
  owns the shared generation algorithm, wave-budget patterns, quantity
  allocation and subsequent Vow interventions.
- This matrix owns concrete composition declarations, inherited differences,
  enemy pools, and the generated-versus-scripted boundary in the scoped rooms.

Bosses, miniboss rooms, opening/biome-intro rooms, N side rooms, G Anomaly rooms
and incidental challenge/locked-door combats are not added to this scope.
Being omitted here does not mean their generation is identical or unsupported
elsewhere. No composition controls described here are implemented yet.

## Room and phase coverage

Ranges below refer to native room-name suffixes. Each identity listed is subject
to its existing placement/reward requirements; membership is not a claim that
every choice is simultaneously eligible.

| Rooms / phase                           | Supported resolved identities                                                                             |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| F Combat01                              | `GeneratedF`                                                                                              |
| F Combat02–22                           | `GeneratedF`, `DevotionTestF`, `ArtemisCombatF`, `ArachneCombatF`, `NemesisCombatF`, `NemesisRandomEvent` |
| G Combat01–20                           | `GeneratedG`, `DevotionTestG`, `ArtemisCombatG`, `ArachneCombatG`, `NemesisCombatG`, `NemesisRandomEvent` |
| H passive: 01,03–08,10–12               | `GeneratedH_Passive`, `NemesisRandomEvent`                                                                |
| H passive: 02,09,13–15                  | `GeneratedH_PassiveSmall`, `NemesisRandomEvent`                                                           |
| Every active H cage                     | `GeneratedH`, `GeneratedH_Treant2`, `GeneratedH_Screamer2`, `NemesisCombatH`                              |
| I Combat01,06–19,21,24                  | `GeneratedI`, `GeneratedI_GoalReward`, `DevotionTestI`, `NemesisCombatI`                                  |
| I Combat02–05,20,22,23                  | `GeneratedI_Small`, `GeneratedI_Small_GoalReward`, `DevotionTestI`, `NemesisCombatI`                      |
| N Combat02–08,14,22,23                  | `GeneratedN`, `ArtemisCombatN`, `HeraclesCombatN`                                                         |
| N Combat12,17                           | `GeneratedN_Smaller`, `ArtemisCombatN`, `HeraclesCombatN`                                                 |
| N Combat01,09–11,13,15,16,18–21         | `GeneratedN_Bigger`, `ArtemisCombatN`, `HeraclesCombatN`                                                  |
| O Combat01–15, Intro                    | `GeneratedO_Intro01`, `HeraclesCombatO`                                                                   |
| O Combat01–15, Combat1 / active Combat2 | `GeneratedO`, `IcarusCombatO`                                                                             |
| O_Devotion01                            | `DevotionTestO`                                                                                           |
| P Combat01–19, Intro                    | `GeneratedP_PreCombat`, `HeraclesCombatP`, plus the room-local vignette identities below for rooms 01–16  |
| P Combat01–19, Combat                   | `GeneratedP`, `GeneratedP_Large`, `AthenaCombatP`, `IcarusCombatP`                                        |
| Q Combat01,02,04,06–09,12–16            | `GeneratedQ`                                                                                              |
| Q Combat03,05                           | `GeneratedQ_Islands`                                                                                      |
| Q Combat10,11                           | `GeneratedQ_Large`                                                                                        |

The biome-local identity counts are F 6, G 6, H 7, I 6, N 5, O 5, P 58 and
Q 3. Their sum is 96; `NemesisRandomEvent` shared across F/G/H reduces the
distinct union to 94. The room counts are 22/20/15/24/23/16/19/16 respectively.

Catalog contacts: `packages/hades2-catalog/src/declarations/encounters/`
`f.ts`, `g.ts`, `h.ts`, `i.ts`, `n.ts`, `o.ts`, `p_definitions.ts`, `p_sets.ts`,
`q.ts`, and their room declarations/envelopes. Native contacts: `EncounterSets.lua`,
`RoomDataF/G/H/I/N/O/P/Q.lua`, and `FieldsRewardCage.LegalEncounters`.

## Reading the generation tables

- **Waves** is the resolved declaration's `MinWaves..MaxWaves`, not a free
  difficulty setting. Fixed ranges remain fixed. Choosing a different number
  of O encounter phases is a separate room structure decision.
- **D** means `GetBiomeDepth(CurrentRun)` at generation; **E** means
  `CurrentRun.BiomeEncounterDepth`. Eligibility predicates using
  `BiomeDepthCache` are explicitly called out rather than relabeled D.
- **R** means the native random type-count path when highlight is absent.
  With highlight, it preserves the wave-index target instead. **E** means
  `EscalateTypeCount`, which replaces even a highlight target with the floored
  maximum expression. In both modes `MaxTypesCap` clamps the result.
- **Min / max** are type-count inputs, not individual-enemy counts. The maximum
  expression is floored. Pool exhaustion can realize fewer types.
- **Highlight: conditional** means active for multiple newly constructed waves;
  one-wave results do not use it. Fixed NPC waves below use it. No listed
  supported generator blocks highlight globally; pre-existing waves are the
  important alternative branch.
- **Elite cap** is `MaxEliteTypes`, not elite quantities or Fangs attributes.
- Pool names refer to the exact expanded inventory below. Normal and elite
  variants are different native type identities, not an attribute toggle.

The shared algorithm, including selection-order qualifications, is defined in
the formation audit. Tables show ordinary resolved values before any active
hard-encounter override; the override table below is part of this evidence.

## Generated biome and Devotion encounters

| Identity                      | Waves | Highlight   | Type mode; min / max     | Type cap | Elite cap | Enemy pool                                          |
| ----------------------------- | ----- | ----------- | ------------------------ | -------- | --------- | --------------------------------------------------- |
| `GeneratedF`                  | 1–3   | Conditional | R; 2 / 2 + .20D          | 3        | 1         | `BiomeF`                                            |
| `GeneratedG`                  | 1–3   | Conditional | R; 1 / 2 + .10D          | 3        | 2         | `BiomeG`                                            |
| `GeneratedH_Passive`          | 1     | No          | R; 2 / 2 + .50D          | 4        | 3         | `BiomeHPassive`                                     |
| `GeneratedH_PassiveSmall`     | 1     | No          | R; 2 / 2 + .50D          | 4        | 1         | `BiomeHPassive`                                     |
| `GeneratedH`                  | 1     | No          | E; 2 / 2 + .20D          | 3        | 3         | `BiomeH`                                            |
| `GeneratedH_Treant2`          | 1     | No          | E; 2 / 2, mixed template | 3        | 1         | Fixed `Treant2` plus one generated `BiomeH` entry   |
| `GeneratedH_Screamer2`        | 1     | No          | E; 2 / 2, mixed template | 3        | 1         | Fixed `Screamer2` plus one generated `BiomeH` entry |
| `GeneratedI`                  | 1–3   | Conditional | R; 2 / 2 + .25D          | 3        | 3         | `BiomeI`                                            |
| `GeneratedI_GoalReward`       | 1–3   | Conditional | R; 2 / 2 + .25D          | 3        | 3         | `BiomeI`                                            |
| `GeneratedI_Small`            | 2–3   | Yes         | R; 2 / 2 + .25D          | 2        | 3         | `BiomeIOptional`                                    |
| `GeneratedI_Small_GoalReward` | 2–3   | Yes         | R; 2 / 2 + .25D          | 2        | 3         | `BiomeI`                                            |
| `GeneratedN`                  | 1–2   | Conditional | E; 2 / 2 + .20E          | 3        | 1         | `BiomeN`                                            |
| `GeneratedN_Smaller`          | 1–2   | Conditional | E; 2 / 2 + .20E          | 2        | 1         | `BiomeN`                                            |
| `GeneratedN_Bigger`           | 2–3   | Yes         | E; 2 / 2 + .20E          | 3        | 1         | `BiomeN`                                            |
| `GeneratedO_Intro01`          | 1     | No          | E; 1 / 2 + .35D          | 2        | 2         | `BiomeOIntro`                                       |
| `GeneratedO`                  | 1–2   | Conditional | E; 1 / 2 + .35D          | 2        | 2         | `BiomeO`                                            |
| `GeneratedP_PreCombat`        | 1     | No          | R; 2 / 2 + .33D          | 2        | 3         | `BiomePIntro`                                       |
| `GeneratedP`                  | 1–2   | Conditional | R; 1 / 2 + .33D          | 3        | 3         | `BiomeP`                                            |
| `GeneratedP_Large`            | 3     | Yes         | R; 1 / 2 + .33D          | 3        | 3         | `BiomeP`                                            |
| `GeneratedQ`                  | 1     | No          | E; 1 / 2 + .143E         | 2        | 2         | `BiomeQ`                                            |
| `GeneratedQ_Large`            | 1     | No          | E; 1 / 2 + .143E         | 2        | 2         | `BiomeQ`                                            |
| `GeneratedQ_Islands`          | 1     | No          | E; 1 / 2 + .143E         | 2        | 2         | `BiomeQIslands`                                     |
| `DevotionTestF`               | 2–3   | Yes         | R; 3 / 3                 | 3        | 1         | `BiomeF`                                            |
| `DevotionTestG`               | 2–3   | Yes         | R; 2 / 4                 | 3        | 3         | `BiomeG`                                            |
| `DevotionTestI`               | 2–3   | Yes         | R; 2 / 3                 | 3        | 4         | `BiomeIOptional`                                    |
| `DevotionTestO`               | 3     | Yes         | E; 3 / 4                 | 3        | 3         | `BiomeO`                                            |

Primary declaration contacts: `EncounterData.lua:Generated/GeneratedF`
(82/182); `EncounterData_Generated.lua` G 8, H passive 137/209, H cage 222/327/373,
I 422/561/574/589, N 676/745/753, O 820/922, P 1003/1165/1182,
Q 1296/1409/1420; `EncounterData_Devotion.lua` Base 4, F 152, G 162, I 185, O 217.

Material distinctions:

- I small Goal combat uses `BiomeI`, unlike small non-Goal combat; Trial uses
  `BiomeIOptional` in both room-size families. Read the resolved definition.
- `GeneratedP` requires `BiomeDepthCache < 10`; `GeneratedP_Large` requires
  `BiomeDepthCache >= 9`. Both remain possible at nine. The wave-domain change
  belongs to encounter selection, not a wave-count depth ramp.
- P generated precombat has `MaxTypesPerGroup = { Automatons = 1,
ChronosForces = 1 }`; main P has `{ Automatons = 1, ChronosForces = 2 }`.
  These are ordered fill gates, not unconditional final-set maxima after seeds.
- `GeneratedO_Intro01` and `GeneratedP_PreCombat` require completed enemy intros.
  Base Devotion also requires completed intros and skips post-generation intro
  encounter replacement. Other ordinary rows can inherit room/depth intro gates.
- O Intro's separately spawned `ZombieCrewman` captain is native staging,
  not another freely generated type slot. Enemy summons, squad expansion,
  NPC staging and other native additions are not promised by the base roster.
- H Treant/Screamer templates each contain one named fixed-count spawn plus an
  unnamed generated entry. They go through placeholder resolution and native
  count allocation, not the ordinary all-generated type-add loop. Fixed and
  generated members must remain distinguishable; an empty generic roster would
  discard the encounter's identity.

### Hard-encounter composition overrides

`SetupEncounter` marks `IsHardEncounter` from `room.RewardOverrides.MakeHardEncounter`;
`GenerateEncounter` applies inherited `HardEncounterOverrideValues` before wave
and type generation. These are conditional native inputs, not user controls.

| Base lineage    | Effective hard type cap   | Other composition facts                                                |
| --------------- | ------------------------- | ---------------------------------------------------------------------- |
| F, G, H cage, I | 4                         | No wave/type-ramp/elite-cap override                                   |
| O               | 4                         | No wave/type-ramp/elite-cap override                                   |
| P               | 3                         | No wave/type-ramp/elite-cap override; may reduce an inherited cap of 4 |
| H passive, N, Q | No declared hard override | Keep ordinary values                                                   |

The same overrides survive into derived NPC/Devotion identities unless replaced.
For example, a hard O lineage can escape its ordinary two-type cap; this does
not mean every O encounter can actually acquire the hard flag. The actual room
and reward-generation context must supply it. The matrix records the conditional
declaration, not an assertion that all combinations are reachable. Dream-run
overrides are outside the currently supported ordinary-route scope.

## Field-NPC combats

All 13 identities below are generated encounters and are **within the prospective
composition scope**. Their interaction/assist scripts are not a reason to
exclude their generated enemy roster. Native NPC placement, rewards, assist
timing, encounter termination and completion remain separate source contracts.

All set `BlockHighlightEliteTypes = true`. The flag is assigned to the first
wave, so first-wave filler as well as the anchor is non-elite; later waves can
contain eligible elites. All use highlight generation with their fixed wave
counts. The target sequences below assume ordinary caps and enough candidates.

| Identity          | Waves | Mode; min / max | Cap / elite cap | Target types by wave | Pool     |
| ----------------- | ----- | --------------- | --------------- | -------------------- | -------- |
| `ArtemisCombatF`  | 4     | R; 2 / 2        | 3 / 1           | 1,2,2,2              | `BiomeF` |
| `ArtemisCombatG`  | 4     | R; 1 / 2        | 3 / 3           | 1,2,2,2              | `BiomeG` |
| `ArtemisCombatN`  | 4     | E; 2 / 2        | 3 / 1           | 2,2,2,2              | `BiomeN` |
| `NemesisCombatF`  | 4     | R; 2 / 2        | 3 / 1           | 1,2,2,2              | `BiomeF` |
| `NemesisCombatG`  | 4     | R; 1 / 2        | 3 / 2           | 1,2,2,2              | `BiomeG` |
| `NemesisCombatH`  | 4     | E; 2 / 2        | 3 / 3           | 2,2,2,2              | `BiomeH` |
| `NemesisCombatI`  | 4     | R; 2 / 2        | 3 / 3           | 1,2,2,2              | `BiomeI` |
| `HeraclesCombatN` | 3     | E; 2 / 3 + .20E | 3 / 1           | 3,3,3                | `BiomeN` |
| `HeraclesCombatO` | 3     | E; 2 / 3 + .35D | 3 / 1           | 3,3,3                | `BiomeO` |
| `HeraclesCombatP` | 3     | R; 4 / 4        | 4 / 3           | 1,2,3                | `BiomeP` |
| `IcarusCombatO`   | 4     | E; 1 / 2        | 2 / 2           | 2,2,2,2              | `BiomeO` |
| `IcarusCombatP`   | 4     | R; 1 / 2        | 3 / 3           | 1,2,2,2              | `BiomeP` |
| `AthenaCombatP`   | 3     | R; 1 / 2        | 3 / 3           | 1,2,2                | `BiomeP` |

All type ramps here are zero except the two explicitly shown Heracles ramps.
P NPCs retain P's group-fill gates. Heracles P's minimum of four does not force
four types into its first wave: the preassigned highlight target bypasses that
random lower bound. N/O escalating inheritance is equally material.

Native contacts: `EncounterData_Artemis.lua` Base 4, F 74, G 156, N 183;
`EncounterData_Nemesis.lua` Base 4, F 120, G 126, H 155, I 193;
`EncounterData_Heracles.lua` Base 4, N 60, O 113, P 168;
`EncounterData_Icarus.lua` Base 4, O 64, P 149;
`EncounterData_Athena.lua` Base 4, P 73.

Placement/sequence qualifications remain important but are not composition
controls: Heracles P is an Indoor Intro encounter that terminates the later
phase; Icarus P requires Outdoor; Heracles O does not terminate the ship phases.
Nemesis I inherits the ordinary I pool even inside smaller I rooms. Heracles'
dummy unit sets are staging units, not an alternative generated pool
(`EncounterLogic.lua:SpawnHeracles`, dummy `RequiredKill = false`).

Gorgon does not replace the current encounter with `AthenaCombatP` or change
its formed waves. Trait dispatch invokes `HandleAthenaSpawn` on the current
encounter (`RoomLogic.lua`, `EncounterLogic.lua:54`); its live active-enemy-cap
adjustment is separate from type quota. Likewise Fig Leaf can prevent native
spawning without turning a configured composition into an obligatory combat.

## Exact enemy pools

In this table **pair(X)** means exactly `X` and `X_Elite`, never a wildcard or
every similarly named enemy. A multiplicity suffix applies to both members
unless stated otherwise. Unmarked entries occur once. These multiplicities
weight native type selection; they do not assign difficulty shares. The listed
pool is declaration support, not a guarantee that every member is eligible.

| EnemySets key    | Exact members, with multiplicity                                                                                                                                                                                                  | Source line |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `BiomeF`         | pair(`Guard`) ×2; pair(`Brawler`) ×2; pair(`Radiator`) ×2; pair(`Screamer`) ×2; pair(`Mage`) ×2; pair(`SiegeVine`)                                                                                                                | 4           |
| `BiomeG`         | pair(`FishmanMelee`); pair(`FishmanRanged`); pair(`FishSwarmerSquad`); pair(`Turtle`); pair(`WaterUnit`); pair(`Guard2`); pair(`Radiator2`)                                                                                       | 72          |
| `BiomeHPassive`  | `DespairElemental_Elite`; pair(`CorruptedShadeSmall`) ×3; pair(`CorruptedShadeMedium`) ×3; pair(`CorruptedShadeLarge`) ×3                                                                                                         | 193         |
| `BiomeH`         | `BrokenHearted` ×2, `BrokenHearted_Elite`; pair(`Lovesick`); pair(`Lycanthrope`); pair(`Mourner`); pair(`Lamia`); `FogEmitter2`                                                                                                   | 164         |
| `BiomeI`         | pair(`GoldElemental`); pair(`TimeElemental`); pair(`SwarmerClockwork`); pair(`ClockworkHeavyMelee`); pair(`SatyrLancer`); pair(`SatyrRatCatcher`)                                                                                 | 252         |
| `BiomeIOptional` | `GoldElemental`, `GoldElemental_Elite` ×2; `TimeElemental`, `TimeElemental_Elite` ×2; `ClockworkHeavyMelee`, `ClockworkHeavyMelee_Elite` ×2; `SatyrLancer`, `SatyrLancer_Elite` ×2; `SatyrRatCatcher`, `SatyrRatCatcher_Elite` ×2 | 280         |
| `BiomeN`         | pair(`Carrion`); pair(`Mudman`); pair(`Zombie`); pair(`ZombieSpawner`); pair(`ZombieHeavyRanged`); pair(`ZombieAssassin`)                                                                                                         | 304         |
| `BiomeO`         | pair(`Stickler`); pair(`Scimiterror`); pair(`Swab`); pair(`Drunk`); pair(`HarpyCutter`); pair(`WaterElemental`); pair(`Mage2`)                                                                                                    | 375         |
| `BiomeOIntro`    | pair(`Stickler`); pair(`Swab`); pair(`Drunk`); pair(`ZombieCrewman`)                                                                                                                                                              | 404         |
| `BiomeP`         | pair(`SentryBot`) ×2; pair(`AutomatonBeamer`) ×2; pair(`AutomatonEnforcer`) ×2; pair(`Dragon`) ×2; pair(`HarpyDropper`) ×2; pair(`SatyrSapper`) ×2; pair(`SatyrLancer2`); pair(`SatyrCrossbow2`); pair(`ZombieOlympus`) ×2        | 420         |
| `BiomePIntro`    | `BiomeP` without pair(`ZombieOlympus`), retaining other multiplicities                                                                                                                                                            | 472         |
| `Automatons`     | pair(`SentryBot`); pair(`AutomatonBeamer`); pair(`AutomatonEnforcer`)                                                                                                                                                             | 511         |
| `ChronosForces`  | pair(`Dragon`) ×2; pair(`HarpyDropper`) ×2; pair(`SatyrSapper`) ×2; pair(`SatyrLancer2`); pair(`SatyrCrossbow2`); pair(`ZombieOlympus`) ×2                                                                                        | 523         |
| `BiomeQ`         | pair(`SimpleSquad`); pair(`Stalker`); pair(`Brute`); pair(`Mati`); pair(`DragonBurrower`)                                                                                                                                         | 553         |
| `BiomeQIslands`  | pair(`SimpleSquad`); pair(`Mati`); pair(`DragonBurrower`)                                                                                                                                                                         | 571         |

`Automatons` and `ChronosForces` also identify P's allegiance groups; the
standalone sets matter to the native-only specialized precombat below. Raw
normal/elite pairs remain separate even where a future presentation might group
them. Do not invent additional enemies from a family-name prefix.

### Type eligibility and cross-wave restrictions

Generic gates live in `RunLogic.lua:IsEnemyEligible` (1576) and the ordered
`FillEnemyTypes` loop (1317). The pool inventory above has these concrete
qualifications after inheritance:

| Gate                               | Exact affected pool members / rule                                                                                                                                                                         | Primary declaration evidence                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Ordinary elite depth               | Most elite members require `BiomeDepthCache >= 3`                                                                                                                                                          | `EnemyData.lua:Elite` (237)                                                      |
| N elite depth                      | Every `BiomeN` elite instead requires `BiomeEncounterDepth >= 3`                                                                                                                                           | N enemy-family `_Elite` declarations                                             |
| H cage elite depth                 | `BrokenHearted_Elite`, `Lovesick_Elite`, `Mourner_Elite`, `Lamia_Elite` require `BiomeEncounterDepth > 1`; `Lycanthrope_Elite` keeps the ordinary cached-depth rule                                        | Corresponding H enemy-family declarations                                        |
| Other elite overrides              | `DespairElemental_Elite`: cached biome depth >=2; `Stalker_Elite` and `Brute_Elite`: encounter depth >=3                                                                                                   | `EnemyData_DespairElemental.lua`, `EnemyData_Stalker.lua`, `EnemyData_Brute.lua` |
| Cannot be sole type / highlight    | Both `SiegeVine` variants; both `Radiator2` variants; `FogEmitter2`; ordinary `TimeElemental`; ordinary `ZombieSpawner`                                                                                    | Their `GeneratorData.BlockSolo`                                                  |
| Once-per-run generated type        | `FogEmitter2.BlacklistAfterFirstAppearance = true`; ordinary type-add updates the run blacklist                                                                                                            | `EnemyData_FogEmitter.lua`, `RunLogic.lua:1397`                                  |
| Profile gate without an intro name | Both `SiegeVine` variants require a prior `MiniBossFogEmitter` occurrence; ordinary `WaterUnit` requires completed `MiniBossWaterUnit`; ordinary `Turtle` requires two `G_Intro` visits                    | `EnemyData_SiegeVine.lua`, `EnemyData_WaterUnit.lua`, `EnemyData_Turtle.lua`     |
| Combined run/profile gate          | Ordinary `Brute` requires encounter depth >=1 and completed `MiniBossBrute`; its elite has its own encounter-depth requirement instead                                                                     | `EnemyData_Brute.lua`                                                            |
| Unconditional completed intro      | Both `HarpyDropper` variants require completed `OlympusIntro` even if the wave otherwise admits unseen introductions                                                                                       | `EnemyData_Harpy.lua:IneligibleIfUncompletedIntroEncounter`                      |
| Pair exclusions                    | Every listed ordinary/elite pair excludes its counterpart. Lamia additionally excludes `Lamia_Miniboss`; `FogEmitter2` excludes `FogEmitter`; passive `DespairElemental_Elite` excludes `DespairElemental` | Each resolved `GeneratorData.BlockEnemyTypes`                                    |

All supported generator lineages inherit `BlockTypesAcrossWaves = true`.
Ordinary type additions carry excluded identities into the encounter blacklist;
the selected type itself can recur in later waves unless another rule blocks
it. Highlight and placeholder seeding have different update contacts, as
documented in the formation audit. P group restrictions close future draws at
their native post-add point, not before every seeded selection.

Introduction identities are exact source facts, not prerequisites the planner
currently obtains from a player's save. Where a wave requires completed intros,
these families are filtered; otherwise `SetupEncounter` can replace the formed
encounter with their intro afterward:

| Pool area | Families with an intro identity (applies to both variants)                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------- |
| F         | `Radiator` → `RadiatorIntro`; `Screamer` → `ScreamerIntro`                                                     |
| G         | `FishSwarmerSquad` → `FishSwarmerIntro`; `Turtle` → `TurtleIntro`; `Guard2` and `Radiator2` → `FishmanIntro`   |
| H cage    | `Lovesick`, `Lycanthrope`, `Mourner`, `Lamia` → corresponding `*Intro`                                         |
| N         | `Mudman`, `ZombieSpawner`, `ZombieHeavyRanged`, `ZombieAssassin` → corresponding `*Intro`                      |
| O         | `Scimiterror`, `Drunk`, `HarpyCutter`, `WaterElemental`, `Mage2` → corresponding `*Intro`                      |
| P         | `SentryBot`, `AutomatonBeamer`, `AutomatonEnforcer`, `HarpyDropper` → `OlympusIntro`; `Dragon` → `DragonIntro` |
| Q         | `Mati` → `MatiIntro`                                                                                           |

I and H passive pool members have no intro identity. Unlisted families in the
listed pools also have none. These statements do not cover scripted-only
enemies outside those pools.

Native inheritance is significant: `Elite` is the first parent of many elite
variants, and its requirements can replace rather than combine with the normal
enemy's requirements. For example `WaterUnit_Elite`, `Turtle_Elite` and
`Brute_Elite` do not simply append every normal-variant profile restriction.
Use resolved source requirements, not an invented union of ancestor conditions.

## Prescribed and non-generator encounters in the same rooms

These entries are included because room scope is broader than generation
scope. Their native constraints remain visible even where ordinary wave/type
authoring has no choice to expose.

### P map-specific precombat

Each full identity is `P_Combat{room}_PreCombat{column}`. All 52 have one
pre-existing wave with explicit counts and map spawn IDs. The table records
distinct type names, not editable quantities. There is no highlight, no depth
type ramp on the prescribed roster, and no generated type-budget allocation.

| Room | 01                                                       | 02                                         | 03                                                           | 04                                        |
| ---- | -------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------ | ----------------------------------------- |
| 01   | `SatyrSapper`, `ZombieOlympus`                           | `SatyrLancer2`                             | `SentryBot`, `ZombieOlympus`                                 | `HarpyDropper`, `AutomatonBeamer_Elite`   |
| 02   | `SentryBot`, `SatyrLancer2`                              | `SatyrSapper`, `SatyrLancer2`              | `AutomatonBeamer_Elite`, `SatyrCrossbow2`                    | —                                         |
| 03   | `SatyrSapper`, `SentryBot`                               | `SatyrCrossbow2`                           | `SatyrLancer2_Elite`                                         | —                                         |
| 04   | `SatyrSapper`                                            | `AutomatonEnforcer`, `ZombieOlympus_Elite` | `SentryBot`, `HarpyDropper`                                  | —                                         |
| 05   | `SatyrCrossbow2`                                         | `Dragon`                                   | `AutomatonBeamer`, `SatyrLancer2`, `SatyrSapper`             | —                                         |
| 06   | `AutomatonBeamer`, `SatyrLancer2`                        | `HarpyDropper`                             | `Dragon_Elite`, `SentryBot`                                  | `AutomatonEnforcer_Elite`, `SatyrLancer2` |
| 07   | `SatyrSapper`, `SatyrLancer2`, `AutomatonEnforcer_Elite` | `AutomatonBeamer`, `ZombieOlympus_Elite`   | `SatyrSapper`                                                | —                                         |
| 08   | `ZombieOlympus`                                          | `HarpyDropper`                             | `AutomatonEnforcer_Elite`, `SatyrLancer2`                    | —                                         |
| 09   | `AutomatonEnforcer_Elite`, `SatyrLancer2`                | `SatyrSapper_Elite`                        | `SatyrCrossbow2`                                             | —                                         |
| 10   | `HarpyDropper`, `SatyrSapper`                            | `AutomatonEnforcer`, `ZombieOlympus`       | `SatyrSapper`, `SentryBot_Elite`                             | —                                         |
| 11   | `Dragon_Elite`                                           | `SatyrSapper`                              | `AutomatonBeamer`, `SentryBot_Elite`, `SatyrLancer2`         | `Dragon_Elite`, `SentryBot`               |
| 12   | `SentryBot`, `ZombieOlympus`                             | `ZombieOlympus`                            | `AutomatonEnforcer`, `SatyrLancer2_Elite`                    | —                                         |
| 13   | `AutomatonBeamer`, `AutomatonEnforcer`, `SatyrCrossbow2` | `Dragon`                                   | `SatyrCrossbow2`                                             | —                                         |
| 14   | `SentryBot`, `AutomatonEnforcer`, `ZombieOlympus_Elite`  | `Dragon_Elite`                             | `AutomatonEnforcer_Elite`, `SentryBot`, `HarpyDropper_Elite` | —                                         |
| 15   | `Dragon`                                                 | `SatyrCrossbow2`                           | `ZombieOlympus`, `AutomatonEnforcer`                         | `SatyrSapper`, `SentryBot_Elite`          |
| 16   | `SatyrCrossbow2`, `SatyrSapper_Elite`                    | `AutomatonBeamer`, `SatyrLancer2`          | `Dragon`, `SentryBot`                                        | —                                         |

Source: `EncounterData_Opening.lua:P_BaseVignette` (1517), then all
`P_Combat01_PreCombat01` through `P_Combat16_PreCombat03` definitions (1527–2974).
There are no corresponding room-specific choices for P Combat17–19.
`Generated = true` is inherited, but does not mean these waves are refilled:
the generator counts the existing wave and skips it in family filling.
Inherited `MaxTypesCap = 2` therefore must not reject a prescribed three-type
roster or cause its fixed enemies to be replaced.

### Arachne cocoons and Nemesis events

| Identity             | Native composition mechanism                                                             | Wave / highlight / depth-type policy        |
| -------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------- |
| `ArachneCombatF`     | 8–14 cocoons, small/medium/large source multiplicity 3/2/1; one receives the room reward | No generated waves, highlight or type quota |
| `ArachneCombatG`     | Same cocoon setup using `_G` obstacle variants                                           | No generated waves, highlight or type quota |
| `NemesisRandomEvent` | Noncombat interaction/event in F/G or H passive phase                                    | No combat roster to author                  |

Cocoon enemy supports are not per-wave choices:

| Cocoon pool | Distinct enemy types                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| F easy      | `Guard`, `Screamer`                                                                                                       |
| F medium    | `Brawler`, `Guard_Elite`, `Mage_Elite`, `Radiator_Elite`, `Screamer_Elite`                                                |
| F hard      | `Brawler_Elite`, `SiegeVine_Elite`                                                                                        |
| G easy      | `FishSwarmer`, `FishSwarmer_Elite`, `Guard2`, `Radiator2`                                                                 |
| G medium    | `FishmanRanged`, `FishmanRanged_Elite`, `FishmanMelee`, `FishmanMelee_Elite`, `Turtle`, `Guard2_Elite`, `Radiator2_Elite` |
| G hard      | `FishSwarmerSquad`, `FishSwarmerSquad_Elite`, `FishmanMelee_Elite`, `FishmanRanged_Elite`, `Turtle_Elite`                 |

Other cocoon outcomes include money and `BloodMinePreFused`; these are not enemy
generator types. Sources: `EncounterData_Arachne.lua` Base/F/G (4/24/245),
`EncounterLogic.lua:SetupArachneCombatEncounter` (2722), `ObstacleData.lua`
cocoon selectors (486/538/589), `EnemySets.lua` cocoon pools (43/126), and
`EncounterData_Story.lua:NemesisRandomEvent` (1915).

## Intentional native-only exclusions

These declarations are not current planner encounter choices and do not expand
the customization scope. Detailed formation rules for them are unnecessary
unless the planner deliberately adds their encounter identities later.

| Group                           | Native identities                                                                                                          | Reason for exclusion                                                                                                               |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| NPC selection-weight duplicates | `ArtemisCombatF2/G2/N2`, `HeraclesCombatN2/O2`, `IcarusCombatO2`, `AthenaCombatP02`                                        | Only selection requirements differ; the planner authors the primary encounter directly. No separate composition or execution path. |
| Scripted first-time encounters  | `FIntroFight`, `FishmanIntro`, `ClockworkIntro`, `DeadSeaIntro`, `GeneratedO_Intro01_First`, `OlympusIntro`, `TyphonIntro` | Native progression encounters, not planner choices.                                                                                |
| NPC introductions               | `ArtemisCombatIntro`, `NemesisCombatIntro`, `HeraclesCombatIntro`, `IcarusCombatIntro`, `AthenaCombatIntro`                | Progression variants that can alter NPC behavior; existing primary NPC identities remain the customization targets.                |
| Tartarus progression variants   | `GeneratedIChronosIntro`, `GeneratedI_SmallChronosIntro`                                                                   | Not modeled; use the existing ordinary I profiles.                                                                                 |
| Specialized P precombat         | `GeneratedP_PreCombatChronosForces`                                                                                        | Not modeled; composition customization does not introduce another encounter choice.                                                |
| Inactive set/reward contacts    | `HeraclesCombatP2`, `IcarusCombatP2`, `GeneratedP_PreCombatAutomatons`, `DevotionTestH/N/P`                                | Not active in the relevant ordinary encounter sets or reward contacts. Q has no `DevotionTestQ` declaration.                       |

Source contacts: `EncounterSets.lua`, `EncounterData.lua`,
`EncounterData_Intro/Opening/Generated.lua`, and the corresponding NPC
declarations. N's inherited Devotion declaration is specifically blocked by
the ordinary main rooms' forced `HubRewards` bag, whose Devotion entry is
commented out (`RoomDataN.lua:2849`, `LootData.lua:842–859`). The selection audit
owns placement/profile evidence; these exclusions are not missing customization
work.

## Prospective planner disposition and bounded unknowns

The chosen direction is encounter-owned optional wave/type customization,
including field-NPC generated combats, not a room-wide default-combat override.
Default leaves native generation untouched and requires no authoring. A resolved
wave count determines highlight participation; one highlight type is shared,
remaining types belong to individual waves. Exact wave composition requires an
explicit highlight when that branch uses one. Optional type-budget weights are
best-effort requests within each native wave budget, not a guarantee of realized
shares, enemy counts or encounter difficulty. Realization failures warrant
diagnostics, not synchronization failure or new conformance obligations. This
is the accepted direction, not shipped behavior.

The following need explicit resolution rather than guesses during implementation:

1. A verified pre-generation runtime contact for each preparation path,
   including reward-owned Devotion and repeated H/O/P phases. The current
   executor resolves the phase before `ChooseEncounter`, but binds the resulting
   object after it returns. Carrying that known phase into preparation needs
   proof; attaching fields only to the returned encounter is too late.
2. How supported profile/introduction assumptions apply to enemy candidates.
   Existing boss-choice progression overrides do not automatically authorize
   bypassing enemy intros, room packages or native intro replacement.
3. Ordered type-choice possibility, including highlight/placeholder seeding,
   P group gates, run blacklists and declaration-owned hard context. A blanket
   independent-per-wave or final-set validator would misstate native support.
4. The narrow contact for requested budget shares. There is no native share
   field; sampling interception, final remainder, rounding/caps and mixed
   fixed/generated templates need bounded evidence. These are steering
   constraints, not grounds for validating realized percentages.

NPC assist logic, all prescribed spawns, enemy quantities, perks, spawn timing,
Menace substitutions and Return respawns remain native-owned. This audit does
not require a combat simulator, a new lifecycle clock, or final-live-roster
conformance checks. Source matrix completeness is not live adapter acceptance.
