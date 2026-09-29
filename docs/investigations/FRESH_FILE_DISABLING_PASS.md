# Fresh File blanket disabling pass

Status: investigation, 2026-09-29, against `codex/fresh-file` at `7fd22c8e`.
Native paths are relative to `1GameData/Scripts`; planner paths to `packages/`.
Not an implementation authorization.

## Question

Which content can never occur anywhere in a first Underworld attempt on a
brand-new profile, whatever the player does during that attempt? For each
item: what is the native gate, what does the planner do on the `FreshFile`
route today, and which existing mechanism closes it?

Scope is blanket disables only: gates on `WorldUpgrade*`, `CompletedRunsCache`,
lifetime `TextLinesRecord`/`UseRecord`/`EncountersCompletedCache`/`RoomsEntered`
facts that the first attempt cannot supply, or structural impossibilities such
as `MaxCreationsThisRun = 1` or the four-god cap. Rules that depend on what
happens during the attempt are listed once under
[Conditional, out of scope](#conditional-out-of-scope) and not analysed.

## Notation

| Code    | Meaning                                                                                                                |
| ------- | ---------------------------------------------------------------------------------------------------------------------- |
| **NF**  | Add `{ kind: 'not', requirement: { kind: 'routeKeyEquals', routeKey: 'FreshFile' } }` to the declaration's requirement |
| **RKN** | Add trait eligibility `{ kind: 'routeKeyNot', routeKey: 'FreshFile' }` (the `PlantHealthBoon` Dream precedent)         |
| **xRK** | Add `'FreshFile'` to an existing `excludedRouteKeys` list                                                              |
| **gap** | No route-keyed hook exists on this declaration; see [Mechanism gaps](#mechanism-gaps)                                  |
| R       | Reachable/authorable on `FreshFile` today                                                                              |
| C       | Already closed on `FreshFile`                                                                                          |
| D       | Derived: closes automatically once the named row closes, no declaration change                                         |
| U       | Not modeled by the planner; native absence needs no planner action                                                     |

Fresh outcome is **unavailable** unless stated. Confidence: H = gate read in
source and planner hook verified; M = gate read, planner contact carries
`routeKey` by inspection but not exercised; L = inference.

## 1. Exclusion matrix

### Rooms

| Item                              | Native gate                                                                                                                              | Planner today                                         | Closing mechanism                      | Conf. |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------- | ----- |
| `F_Opening02/03`                  | `RoomCountCache.F_Opening01 >= 2` (`RoomDataF.lua:910-913`, `:981-990`)                                                                  | C: `initialProfile.openingRoomGameName`               | none needed (`route-profile.ts:47-49`) | H     |
| `F_Story01` Arachne               | lifetime `RoomsEntered.F_Boss01` + `TextLinesRecord.ArtemisFirstMeeting` (`RoomDataF.lua:3163-3170`)                                     | R: depth-only `eligibility` (`f.ts:1044`)             | NF on room `eligibility`               | H     |
| `G_Story01` Narcissus             | lifetime `RoomsEntered.G_Boss01` (`RoomDataG.lua:2559`)                                                                                  | R: depth-only (`g.ts:917`)                            | NF on room `eligibility`               | H     |
| `I_Story01` Hades                 | lifetime `RoomsEntered.I_Intro > 1` (`RoomDataI.lua:3122`); one `I_Intro` per run                                                        | R (`i.ts:59`)                                         | NF on room `eligibility`               | H     |
| `F_Reprieve01`                    | `WorldUpgradeErebusReprieve` (`RoomDataF.lua:3063`)                                                                                      | R: depth-only (`f.ts:1082`)                           | NF on room `eligibility`               | H     |
| `G_Reprieve01`                    | `WorldUpgradeOceanusReprieve` (`RoomDataG.lua:2482`)                                                                                     | R (`g.ts:955`)                                        | NF on room `eligibility`               | H     |
| `I_Reprieve01`                    | `WorldUpgradeTartarusReprieve` (`RoomDataI.lua:2403`)                                                                                    | R (`i.ts:818`)                                        | NF on room `eligibility`               | H     |
| `I_Combat24`                      | `WorldUpgradeTartarusReprieve` (`RoomDataI.lua:2814`)                                                                                    | R: depth-only (`i.ts:784`)                            | NF on room `eligibility`               | H     |
| `F_MiniBoss02` (`FogEmitter`)     | lifetime `EncountersCompletedCache.MiniBossTreant >= 2` (`RoomDataF.lua:1117`); Treant room `MaxCreationsThisRun = 1`                    | R (`f.ts:963`)                                        | NF on room `eligibility`               | H     |
| `F_MiniBoss03` (`Assassin`)       | same, plus `BossChronos01`/`BossPolyphemus01`/`ZombieAssassinIntro` completed (`RoomDataF.lua:1193-1203`)                                | R (`f.ts:1005`)                                       | NF on room `eligibility`               | H     |
| `G_MiniBoss02` (`Crawler`, Uh Oh) | lifetime completion of both `MiniBossWaterUnit` and `MiniBossJellyfish` (`RoomDataG.lua:1965-1968`); siblings mutually exclusive per run | R (`g.ts:835`)                                        | NF on room `eligibility`               | H     |
| Anomaly detour (`B_Combat*`)      | `AnomalyDoorRequirements` needs lifetime `UseRecord.NPC_Chronos_01` (`RoomData.lua:609-636`)                                             | R: `excludedRouteKeys: ['Dream']` (`layouts/g.ts:25`) | xRK on `anomalyReplacement.source`     | H     |

H minibosses (`RoomDataH.lua:1083`, `:1180`) and I minibosses 01/02
(`RoomDataI.lua:2825`, `:2927`) carry only run-local gates; they stay available.
`I_MiniBoss03` is `DebugOnly` and not declared by the planner.

### Room features and detours

| Item                             | Native gate                                                                                                                                                    | Planner today                                                                                                                    | Closing mechanism                                     | Conf. |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----- |
| Chaos gates                      | `SecretSpawn` `ChaosUnlocked` (`RoomData.lua:513`) → lifetime `UseRecord.HermesUpgrade`, not this run's `HermesFirstPickUp` (`RequirementsData.lua:1400-1412`) | R: `chaosExit` constants in `rooms/f.ts:4`, `g.ts:10`, `h.ts:6`, `i.ts:4`                                                        | NF on `RawChaosAdditionalExitDeclaration.requirement` | M     |
| Zagreus contract door            | `ZagreusContractRequirement` → `InfernalContractUnlocked`: `ReachedTrueEnding` + NeoChronos lines (`StoreData.lua:4-11`, `RequirementsData.lua:2795-2808`)     | R: `maxEnteredThisRoute: 0` only (`f.ts:1105`, `g.ts:978`)                                                                       | **gap** (no requirement field)                        | H     |
| Contract reward pedestal         | `SpawnZagContractRewards` needs `InfernalContractBoon` (`EventLogic.lua:1903`)                                                                                 | D (`shop/inventory.ts:216`, gated on equipped contract)                                                                          | D ← Zagreus contract                                  | H     |
| Ordinary Stygian Well            | `WorldUpgradeWellShops` (`RoomData.lua:576`)                                                                                                                   | R: `AddStygianWell` checks static `roomShop` only (`occurrence/dispatch.ts:337-344`)                                             | **gap**                                               | H     |
| Post-boss forced Well            | `WorldUpgradePostBossWellShops` (`RoomDataF.lua:2572`, `:2625`; `RoomDataG.lua:1065`, `:1120`; `RoomDataH.lua:1911`, `:1983`)                                  | R, and forced: `roomShop.forced: true` (`f.ts:1239`, `g.ts:1112`, `h.ts:1106`)                                                   | **gap**                                               | H     |
| Post-boss Purging Pool F/G       | `WorldUpgradePostBossSellTraitShops` (`RoomDataF.lua:2580`, `:2637`; `RoomDataG.lua:1072`, `:1108`)                                                            | R: static `purgingPool` (`f.ts:1237`, `g.ts:1110`)                                                                               | **gap**                                               | H     |
| Post-boss Purging Pool H         | object present but `BlockedByRequirements` (`RoomDataH.lua:2006-2007`, `ObstacleData.lua:3337`); present-unusable                                              | R (`h.ts:1104`)                                                                                                                  | **gap**; executor must tolerate the locked object     | H     |
| Post-boss keepsake rack          | `WorldUpgradePostBossGiftRack` (`RoomDataF.lua:2614`, `RoomDataG.lua:1096`, `RoomDataH.lua:1971`)                                                              | R: static `hasKeepsakeRack` (`f.ts:1235`, `g.ts:1108`, `h.ts:1102`)                                                              | **gap**                                               | H     |
| Resource points (all four tools) | `CompletedRunsCache >= 1` + `WorldUpgradeToolsShop` per point family (`RoomDataF.lua:46-60`, same in G/H/I)                                                    | R: `excludedRouteKeys: ['Dream']` (`resources.ts`, consumed at `simulation/resources.ts:245`, `execution-plan/assembler.ts:249`) | xRK on `normalResourcePointSupport` / H variant       | H     |
| Infernal Troves                  | `WorldUpgradeChallengeSwitches1` / `...Extra1` (`RoomData.lua:533-549`)                                                                                        | U                                                                                                                                | none                                                  | H     |
| Post-boss fountain               | ungated (`RoomDataF.lua:2598-2606`); **available**                                                                                                             | C: modeled                                                                                                                       | none                                                  | H     |

No separate "resource room" declaration exists in F–I. Herb points take the
ungated collection branch and are unmodeled.

### Encounters and enemies

| Item                                   | Native gate                                                                                                                                                                          | Planner today                                               | Closing mechanism                                   | Conf. |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------- | ----- |
| `ArtemisCombatF/G`                     | base needs `EncountersCompletedCache.ArtemisCombatIntro` (`EncounterData_Artemis.lua:9`); intro needs `CompletedRunsCache >= 1` (`:121-124`)                                         | R: run-local requirements (`encounters/f.ts:48`, `g.ts:41`) | NF on encounter `requirements`                      | H     |
| `ArachneCombatF` cocoon                | `CompletedRunsCache >= 1` (`EncounterData_Arachne.lua:234-238`)                                                                                                                      | R (`encounters/f.ts:79`)                                    | NF on encounter `requirements`                      | H     |
| `ArachneCombatG` cocoon                | base needs completed `ArachneCombatF` (`EncounterData_Arachne.lua:15`)                                                                                                               | R (`encounters/g.ts:72`)                                    | NF on encounter `requirements`                      | H     |
| `NemesisCombatF/G/H/I`                 | base needs completed `NemesisCombatIntro` + `NemesisGetFreeItemIntro01` (`EncounterData_Nemesis.lua:8-11`); intro needs `CompletedRunsCache >= 7` (`:232-236`)                       | R (`encounters/f.ts:105`, `g.ts:103`, `h.ts:78`, `i.ts:73`) | NF on encounter `requirements`                      | H     |
| `NemesisRandomEvent`                   | completed `NemesisCombatIntro` (`EncounterData_Story.lua:1929`)                                                                                                                      | R (`encounters/f.ts:258`)                                   | NF (beside the existing Dream `not`)                | H     |
| Nemesis shop appearance / bridge event | same Nemesis intro history; `BridgeNemesisRandomEvent` (`EncounterData_Story.lua:2048`)                                                                                              | U: shopping protection only; bridge event not declared      | none (derived with Nemesis)                         | M     |
| `DevotionTestF/G/I`                    | selected only for a `Devotion` room reward (`encounters/g.ts:218-222`)                                                                                                               | D                                                           | D ← Devotion reward                                 | H     |
| Thorn-Weeper (`SiegeVine`, elite)      | `EncountersOccurredCache.MiniBossFogEmitter` (`EnemyData_SiegeVine.lua:65`, `:126`)                                                                                                  | U while generated customization is off for this profile     | D ← `F_MiniBoss02`; bind when customization returns | M     |
| Hermes in person (F openings)          | `F_Opening01.ForcedRewards` needs `RoomCountCache.G_Intro >= 2` + Zeus use (`RoomDataF.lua:587-610`)                                                                                 | U (opening fixed empty)                                     | none                                                | H     |
| Rival/EM boss variants                 | Fear-driven                                                                                                                                                                          | C: zero Fear (Gate F)                                       | none                                                | H     |
| Hecate interlude alternatives          | lifetime `EncountersCompletedCache.BossHecate01` ≥ 1/2/10 (`WeaponData_Hecate.lua:202`, `:313`, `:534`, `:626`, `:741`); one Hecate fight per run; only `HecateMeteorShower` remains | R: six choices (`encounters/f.ts:339-355`)                  | **gap** (no per-choice availability)                | H     |
| Hecate polymorph                       | Pig/Rat need later-run history; Sheep only                                                                                                                                           | U (presentation native)                                     | none                                                | H     |
| Scylla featured performer              | first `BossScylla01` forces `Keytarist` (`EncounterLogic.lua:2810-2813`); only one fight per run                                                                                     | R: three choices (`encounters/g.ts:163-176`)                | **gap** (no per-choice availability)                | H     |

Heracles, Icarus, Athena, Circe and Medea encounters are not declared on F–I
rooms; no row.

### Reward types (room stores)

| Item                                                           | Native gate                                                                                                                                                                    | Planner today                                                                   | Closing mechanism                           | Conf. |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------- | ----- |
| Hammer (`WeaponUpgrade`, early/late)                           | `HammerLootRequirements`: ≥ 4 of six non-Apollo `FirstPickUp` lines (`RequirementsData.lua:1233-1250`); `MaxGodsPerRun = 4` with Apollo forced allows ≤ 3 (`HeroData.lua:168`) | R: run-local `hammerEarly`/`hammerLate` (`rewards/stores.ts:29-30`, `:150-151`) | NF on the shared hammer requirements        | H     |
| Hermes (`HermesUpgrade`)                                       | `TextLinesRecord.HermesFirstPickUp` (`RequirementsData.lua:1304-1309`); bootstrap needs Zeus use (`RoomDataF.lua:587-610`)                                                     | R: run-local `hermesLootLegal` (`stores.ts:31`)                                 | NF on `hermesLootLegal`                     | H     |
| Selene Hex (`SpellDrop`)                                       | `ArtemisFirstMeeting` + `SeleneFirstPickUp` (`RequirementsData.lua:1328-1333`); forced first drop needs `ArtemisCombatIntro` occurred (`RoomDataF.lua:555-564`)                | R: run-local `spellLegal` (`stores.ts:33`)                                      | NF on `spellLegal`                          | H     |
| Path of Stars (`TalentDrop`/`TalentBigDrop`/`MinorTalentDrop`) | `TalentLegal`: lifetime `UseRecord.SpellDrop >= 4` (`RequirementsData.lua:1355-1361`)                                                                                          | D: `talentLegal` needs a `SpellDrop` use                                        | D ← `SpellDrop`                             | H     |
| Devotion                                                       | `TextLinesRecord.PoseidonDevotionIntro01` (`LootData.lua:1641`, `:1927`); intro needs `DevotionTestUnlocked` (`RequirementsData.lua:436-470`)                                  | R: run-local `devotionLegal` (`stores.ts:32`, `:152`)                           | NF on `devotionLegal`                       | H     |
| MetaProgress Nectar (`GiftDrop`)                               | `GiftDropLootRequirements`: `CompletedRunsCache >= 1` (+ 50 Bones) (`RequirementsData.lua:1205-1216`)                                                                          | R: no requirement (`stores.ts:50`)                                              | NF on the MetaProgress entry only           | H     |
| Element drops / element placement                              | `WorldUpgradeElementalBoons` (`LootData.lua:930-960`, `:1789`)                                                                                                                 | Plan: disable placement incl. readiness/export                                  | owned by the plan's "Other progression" row | H     |

Fields optional `GiftDrop`, `ArmorBoost` and `MetaCurrencyDrop` are ungated
and stay available; do not route-exclude them.

### Traits and gods

| Item                                                                          | Native gate                                                                                                                                                                                                                   | Planner today                                                                                                      | Closing mechanism       | Conf. |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------- | ----- |
| Zeus                                                                          | `TextLinesRecord.ZeusFirstPickUp` (`LootData_Zeus.lua:10-11`); bootstraps need Rain (`BiomeStateData.lua:13-29`: `ZeusFirstPickUp` or `CompletedRunsCache >= 3`) or `ReachedTrueEnding` (`RoomDataF.lua:478-490`, `:680-690`) | R: no `lootRequirement` (`rewards/acquisitions.ts:128`)                                                            | NF as `lootRequirement` | M     |
| Hera                                                                          | `HeraFirstPickUp*` (`LootData_Hera.lua:10-11`); bootstrap `HeraUnlocked` needs `WorldUpgradeSurfacePenaltyCure` (`RequirementsData.lua:102-113`, `RoomDataF.lua:613-619`)                                                     | R (`acquisitions.ts:106`)                                                                                          | NF as `lootRequirement` | M     |
| Ares                                                                          | `AresFirstPickUp` (`LootData_Ares.lua:10-11`); bootstrap `AresUnlocked` needs `RoomsEntered.Q_Boss01` (`RequirementsData.lua:132-141`, `RoomDataF.lua:630-636`)                                                               | R (`acquisitions.ts:85`)                                                                                           | NF as `lootRequirement` | M     |
| Hephaestus                                                                    | lifetime `UseRecord.ZeusUpgrade`, not this run's `ZeusFirstPickUp` (`LootData_Hephaestus.lua:9-16`)                                                                                                                           | R (`acquisitions.ts:99`)                                                                                           | NF as `lootRequirement` | M     |
| Infusions of the five gods                                                    | `IsElementalTrait` → `ElementalGameStateRequirements` `WorldUpgradeElementalBoons` (`RunLogic.lua:114`, `TraitData.lua:723-730`)                                                                                              | R: `elementCount` only (`apollo.ts:232`, `aphrodite.ts:206`, `demeter.ts:241`, `hestia.ts:211`, `poseidon.ts:238`) | RKN on each             | H     |
| `PlantHealthBoon` (Demeter)                                                   | `WeaponsUnlocked.ToolShovel` (`TraitData_Demeter.lua:1820`)                                                                                                                                                                   | R: `routeKeyNot: 'Dream'` only (`demeter.ts:107`)                                                                  | RKN                     | H     |
| Excluded gods' traits, off-set Duos/Legendaries                               | follow from the four gods above                                                                                                                                                                                               | D                                                                                                                  | D ← god rows            | H     |
| Hermes / Selene / Chaos / Artemis / Arachne / Narcissus / Echo / Hades traits | follow from their sources                                                                                                                                                                                                     | D                                                                                                                  | D ← source rows         | H     |
| Random boon exchange (10 %)                                                   | `HeroData.BoonData.GameStateRequirements`: `CompletedRunsCache >= 2` (`HeroData.lua:172-179`, gate `TraitLogic.lua:1801`); too-few-options exchange unaffected                                                                | R: `boonReplacementChance: 0.1` scalar (`traits/index.ts:247`)                                                     | **gap**                 | H     |

Always-available gods: Apollo, Poseidon, Demeter (empty `GameStateRequirements`,
`LootData_Apollo.lua:8`, `LootData_Poseidon.lua:7`, `LootData_Demeter.lua:7`).

### Shops

| Item                                                          | Native gate                                                                                            | Planner today                                                     | Closing mechanism                               | Conf. |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ----------------------------------------------- | ----- |
| Mystery Boon (`BlindBoxLoot`)                                 | `BlindBoxLootRequirements`: use of seven gods incl. Zeus/Hephaestus (`RequirementsData.lua:1218-1231`) | R: no requirement (`rewards/shops.ts:81`, I group 2)              | NF via `routeOption`                            | H     |
| `ShopHermesUpgrade`                                           | `HermesFirstPickUp` (`ConsumableData.lua:1187`)                                                        | R: run-local `shopHermesLegal` (`shops.ts:89`)                    | NF                                              | H     |
| Shop hammers (`WeaponUpgradeDrop`)                            | lifetime `UseRecord.WeaponUpgrade` + hammer requirements (`StoreData.lua:232-251`)                     | R (`shops.ts:101-110`)                                            | NF                                              | H     |
| Anvil (`ChaosWeaponUpgrade`)                                  | current-run hammer (`ConsumableData.lua:1074`)                                                         | D: `chaosHammerLegal`                                             | D ← hammers                                     | H     |
| Shop Armor (`ArmorBoost`/`ArmorBigBoost`)                     | `RoomCountCache.F_Story01` (`ConsumableData.lua:939`)                                                  | R (`shops.ts:121`, I Survival group)                              | NF (shop options only)                          | H     |
| Shop Nectar (`GiftDrop`)                                      | `GiftDropLootRequirements` (`StoreData.lua:262`)                                                       | R (`shops.ts:133`)                                                | NF                                              | H     |
| Shop Hex / Path of Stars                                      | as the reward rows                                                                                     | R / D (`shops.ts:161`, `:169`)                                    | NF on `SpellDrop`; D for Talent                 | H     |
| Death Defiance refill (`LastStandDrop`)                       | `MissingLastStand` (`ConsumableData.lua:840`); zero DD all attempt                                     | R: unmodeled predicate (I Survival group)                         | NF                                              | H     |
| I_WorldShop resource group (Moondust, Nightmare, Charon Card) | lifetime `WeaponPointsRare` / `CardUpgradePoints` / `CharonPoints` gained (`StoreData.lua:409-445`)    | R: `ordinaryRouteOption` excludes only Dream (`shops.ts:175-190`) | NF (valid-empty slot already delivered, Gate D) | M     |

## 2. Owner-list check

| Owner item                        | Verdict             | Correction / source                                                                                                                                                 |
| --------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chaos                             | confirmed           | Gates need lifetime Hermes use; Hermes itself is unreachable, so this is blanket.                                                                                   |
| Resource rooms/points             | confirmed (points)  | No resource-room declaration exists; only points, all four families. Herb points remain but are unmodeled.                                                          |
| Wells                             | confirmed           | Two gates: ordinary (`WorldUpgradeWellShops`) and post-boss (`WorldUpgradePostBossWellShops`). The planner currently **forces** the post-boss Well.                 |
| Anomaly                           | confirmed           | Needs lifetime Chronos meeting.                                                                                                                                     |
| Zagreus                           | confirmed           | Contract door and its pedestal; `InfernalContractUnlocked` needs the true ending.                                                                                   |
| NPC rooms Arachne/Narcissus/Hades | confirmed           | Not `H_Bridge01`: the bridge stays and resolves to Shop (the plan's Bridge row).                                                                                    |
| No cocoons                        | confirmed           | `ArachneCombatF` needs a completed run; `ArachneCombatG` needs completed `ArachneCombatF`.                                                                          |
| No Nemesis                        | confirmed, wider    | Combat F/G/H/I, `NemesisRandomEvent`, bridge event and shop appearances all hang on `NemesisCombatIntro` (seven completed runs).                                    |
| No Artemis                        | confirmed           | Needs completed `ArtemisCombatIntro`, which needs a completed run.                                                                                                  |
| Some minibosses                   | confirmed, named    | `F_MiniBoss02` (Fog emitter), `F_MiniBoss03` (Assassin), `G_MiniBoss02` (Crawler). H and I minibosses are available. Root Stalker, Water unit, Jellyfish available. |
| Spell drop                        | confirmed           | = Selene Hex `SpellDrop`; Path of Stars (`TalentDrop` family) follows.                                                                                              |
| Hermes                            | confirmed           | Room reward, shop item and in-person opening appearance.                                                                                                            |
| Trial                             | ambiguous, both out | `TrialUpgrade` is Chaos's loot (`LootData_Chaos.lua:4`), closed with Chaos. If "trial" meant Devotion (Trial of the Gods), it is also closed.                       |
| Infusion traits                   | confirmed           | Gate is the shared `IsElementalTrait` check, not per-trait data; five planner traits need RKN.                                                                      |
| Demeter plant trait               | confirmed           | `PlantHealthBoon` (Plentiful Forage), Shovel unlock.                                                                                                                |
| Zeus                              | confirmed           | Text-record gate; Rain and true-ending bootstraps unreachable.                                                                                                      |
| Hephaestus                        | confirmed           | Needs lifetime Zeus use.                                                                                                                                            |
| Hera                              | confirmed, gated    | Text-record gate; bootstrap needs the Surface penalty cure.                                                                                                         |
| Ares                              | confirmed, exists   | `LootData_Ares.lua` is present in this version; bootstrap needs `Q_Boss01` entry.                                                                                   |

## 3. Unnamed blanket items

All are rows above: Reprieves F/G/I; **`I_Combat24`** (Tartarus reprieve
upgrade — not in any existing Fresh File document); post-boss keepsake rack;
Purging Pools; hammers (all sources) and Anvil; Mystery Boon; Devotion;
MetaProgress and shop Nectar; shop Armor; Death Defiance refill; I_WorldShop
resource group; random boon exchange; Hecate interlude and Scylla performer
domains; Nemesis event family; Infernal Troves (unmodeled).

Checked and **no row**: Circe, Icarus, Heracles, Medea, Athena, Dionysus
(not declared on F–I); Odysseus, Schelemeus, Dora, Fated List (hub only);
Charon's Pool, Gold Gold Gold, forge (no Hades II F–I equivalent); Poms
(ordinary legality); Echo (bridge variant, not a disable).

## 4. Mechanism gaps

Every other row closes with an existing hook (room `eligibility`, encounter
`requirements`, reward-store/shop option `requirement`, `lootRequirement`,
trait `routeKeyNot`, existing `excludedRouteKeys`). `routeKeyEquals` already
identifies the profile uniquely; a separate `routeInitialProfile` predicate
would add nothing.

| Gap                       | Declarations                                                       | Smallest addition                                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Room-feature availability | `roomShop` (ordinary and forced), `purgingPool`, `hasKeepsakeRack` | `excludedRouteKeys` on each feature declaration, following `resourcePointSupport.excludedRouteKeys`. Consumers: occurrence defaults/codec, `AddStygianWell`, `stygian-well.ts`, candidates, export          |
| Zagreus contract door     | `RawZagreusContractAdditionalExitDeclaration`                      | Optional `requirement`, mirroring `RawChaosAdditionalExitDeclaration`, evaluated in `assessZagreusContractPlacement`                                                                                        |
| Boss choice domains       | `EncounterCustomizationChoice` (Hecate, Scylla)                    | `excludedRouteKeys` per choice; the alternative, disabling boss customization on this route, leaves native choosing the same forced result                                                                  |
| Random boon exchange      | `boonReplacementChance` scalar                                     | A declaration-owned `boonReplacementRequirement` (native `BoonData.GameStateRequirements`) or a route exclusion list on the chance; consumers `traits/offers.ts:97`, `authoring/initial-composition.ts:130` |

## 5. Bounded unknowns and plan contacts

- `requireRouteKey` throws when a context lacks `routeKey`
  (`requirements/evaluator.ts:123-128`). Reward facts and shops carry it
  (`simulation/rewards/facts.ts:163`, `:289`); room, encounter and trait
  contacts already evaluate Dream route keys. The `lootRequirement` and Chaos
  exit contacts are M-confidence until one witness each.
- NPC encounters are reachable in the catalog; whether the Fresh File editor
  currently exposes them while generated customization is off is unverified.
- I_WorldShop resource group: blanket only because no F–I source of Moondust,
  Nightmare or Charon Cards exists in the attempt; the owner's observed four-item
  shop agrees. A faithful alternative is a `resourceGains` requirement.
- Thorn-Weeper binding matters only when encounter customization returns.
- **Conflict — rewards outline vs blanket form.** `FRESH_FILE_REWARDS.md`
  (and the Phase III "God/reward profiles" row) choose separate Fresh
  MetaProgress/RunProgress/shop profiles and "keep the mature declarations clean
  rather than adding Fresh File exceptions to each existing entry". The blanket
  form here adds NF to shared entries instead, following the existing
  `ordinaryRouteOption`/`dreamOption` Dream precedent. Needs an owner decision;
  both reuse the same bag and inventory machinery.
- **Phase III coverage.** "Room exclusions" omits `I_Combat24`; "Features" needs
  the room-feature gap closed and currently has a **forced** post-boss Well to
  remove, not merely an optional one. "Boss choices" and "Random exchange chance
  off" both depend on gaps above.
- The rewards outline's "seven gods where the game allows three" undercounts
  the unguarded set: Zeus, Hera, Ares and Hephaestus all lack a declared gate.

## Conditional, out of scope

- Hestia/Aphrodite unlock on Poseidon/Demeter use.
- First Apollo offer shape and `F_Combat01`/`FIntroFight` forcing.
- `FishmanIntro`/`ClockworkIntro` and enemy-triggered introductions.
- MetaProgress Bones five-Ashes and large-entry thresholds.
- Shop god pickup-history intersection and fallback.
- Eris health condition, gifts and curse.
- Echo vs Shop resolution at `H_Bridge01`.
- Nectar granting no Pom level (incantation-gated run-progress effect).
- `RandomStatusBoon` status pool from gods met this attempt.
- Ordinary Pom legality and the four-god cap itself.

## Recommended disposition

Treat the matrix as one catalog-first slice: NF/RKN/xRK on existing hooks for
every H/M row, plus the four gap additions. D rows need only a witness.
Resolve the rewards-profile conflict before touching reward stores and shops.
