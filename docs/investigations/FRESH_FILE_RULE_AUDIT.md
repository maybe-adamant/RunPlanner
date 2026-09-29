# Fresh File rule audit and family review

Status: investigation, 2026-09-28. Reviews the Fresh File document family
against a fresh-profile source inventory and the planner's mature seams. No
implementation is authorized here. Native paths are relative to
`1GameData/Scripts`; planner paths to `packages/`.

## Question

Is the family's model of "one closed initial state, no unlocks, bounded
progression during the attempt" complete and correctly directed? Which native
rules differ on a fresh profile that the family does not yet cover, and where
does the planner's mature baseline contradict the fresh rules?

## What "fresh" is in code

`StartNewGame` (`RunLogic.lua:312-324`) → `GameStateInit` (`:134-310`) leaves
every progression table empty and starts the first attempt directly in
`F_Opening01` (`RoomDataF.lua:372`, `GameStart = true`), never passing
`Hub_PreRun`. `CompletedRunsCache` is nil (reads as 0, `RequirementsLogic.lua:633`)
until `EndRun` (`RunLogic.lua:1848-1850`). Fixed for the whole attempt: Staff
with the no-effect `DummyWeaponStaff` aspect (`WeaponUpgradeLogic.lua:428-441`,
`TraitData.lua:1342`), no keepsake (`RunLogic.lua:481`), no familiar, zero
Arcana (`MetaUpgradeLogic.lua:2-27`), zero Fear (`ShrineLogic.lua:503-507`),
30 HP / 50 Magick / 0 Gold (`HeroData.lua:6,8`, `RunLogic.lua:41`), **zero
Death Defiance** (`RunLogic.lua:45-56` adds only Arcana stands; the only
in-run `IncreaseMax` sources are Athena and Chaos, both unreachable), no
incantation can be added mid-run, biome state always Vanilla
(`BiomeStateData.lua:13-29` needs `ZeusFirstPickUp`).

Histories that start empty and fill during the attempt: `UseRecord`,
`TextLinesRecord`, `LootPickups`, `EncountersCompletedCache` /
`EncountersOccurredCache`, `RoomsEntered` / `RoomCountCache`,
`LifetimeResourcesGained`, `BiomeVisits`, `TraitsTaken`.

## Rule differences by domain

Legend for the planner column: **mature** = the current catalog/engine bakes
the mature outcome in; **modeled** = the engine already has the fact or rule;
**absent** = not modeled at all. The family column names the outline that
owns the rule, or **gap** when none does.

### Loadout and meta

| Rule                         | Native (fresh)                                                                                                                                                                                           | Planner today                                                                       | Family                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------- |
| Weapon / aspect              | Staff, `DummyWeaponStaff` (no `BaseStaffAspect`)                                                                                                                                                         | mature: `codec.ts:161-197` requires a catalog aspect                                | Loadout                      |
| Keepsake, familiar           | none                                                                                                                                                                                                     | mature: mandatory default keepsake (`loadout.ts`)                                   | Loadout                      |
| Arcana, Death Defiance       | 0 cards, 0 DD; first death ends the attempt                                                                                                                                                              | mature: automatic cards from an empty selection; DD from Arcana                     | Loadout (Arcana); DD **gap** |
| Fear / Oath                  | 0; no `Hub_PreRun`                                                                                                                                                                                       | mature: vows always authorable                                                      | Loadout                      |
| Hex / Path of Stars          | closed (`RequirementsData.lua:1328-1375`)                                                                                                                                                                | mature: `spellLegal`, `talentLegal` predicates                                      | Rewards                      |
| Infusions / elements         | closed (`WorldUpgradeElementalBoons`)                                                                                                                                                                    | mature: `elementThreshold` requirements, placement                                  | Rewards                      |
| Random boon exchange         | **off**: `HeroData.BoonData.GameStateRequirements` needs `CompletedRunsCache >= 2` (`HeroData.lua:170-189`, gate at `TraitLogic.lua:1801`); only the too-few-options fill (`:1935-1947`) still exchanges | mature: `boonReplacementChance: 0.1` always (`traits/index.ts:247`, `offers.ts:97`) | **gap**                      |
| Base rarity                  | base chances only; bonuses solely from in-run `RarityBonus` boons                                                                                                                                        | modeled (Arcana/keepsake bonuses simply absent)                                     | implicit                     |
| Shrine unpicked-boon ban     | 0                                                                                                                                                                                                        | modeled via Fear rank                                                               | implicit                     |
| Starting Gold 0, prices ×1.0 | `RunLogic.lua:41`; `StoreLogic.lua:678-686`                                                                                                                                                              | Gold not simulated                                                                  | out of scope                 |

### Route and rooms

| Rule                                               | Native (fresh)                                                                                                                                   | Planner today                                           | Family              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ------------------- |
| Itinerary                                          | F → G → H → I only; no room-count/depth overrides; `EasyModeFirstRun` does not exist                                                             | routes declared; `ExecutionRouteKey` lacks the profile  | Loadout, Rooms      |
| Opening                                            | `F_Opening01` only, `OpeningEmpty` forced while Apollo unused (`EncounterData.lua:435-450`)                                                      | mature: three openings, `entryContextualEncounterRules` | Rooms               |
| `ForceIfUnseenForRuns`                             | only openings and story rooms carry it; on fresh every eligible carrier is forced, but only `F_Opening01` is eligible                            | not modeled (external history)                          | no impact           |
| `F_Combat01`                                       | forced by `ForceIfEncounterNotCompleted = FIntroFight` at depth ≤ 5 (`RoomDataF.lua:1278,1325-1332`)                                             | `RoomForce.kind: requirement` exists (O uses it)        | Rooms, plan (reuse) |
| Story rooms, Reprieves, Uh Oh, F minibosses 02/03  | ineligible (cited in the viability matrix)                                                                                                       | mature: all declared and eligible                       | Rooms               |
| `H_Bridge01`                                       | always `BridgeShop` (`RoomDataH.lua:800-817`)                                                                                                    | mature: fixed `Story_Echo_01`                           | Rooms               |
| Chaos gates, Anomaly, Zagreus contract             | none                                                                                                                                             | mature: `chaosExit`, anomaly/contract detours           | Rooms               |
| Boss variants                                      | `BossHecate01`, `BossScylla01`, `InfestedCerberus01`, `BossChronos01`; no Rival (zero Fear); `I_PreBoss01`                                       | modeled via Fear/route context                          | Encounters          |
| Eris in G/H/I intros                               | spawns when HP > 50% and DD ≤ 0 (`RequirementsData.lua:151-163`) and no curse; gifts 20 Ashes / 50 Psyche / 300 Bones, `NPCDrop` (no multiplier) | absent                                                  | Rooms               |
| Hermes in person, Artemis, Nemesis, Arachne cocoon | absent                                                                                                                                           | mature: all modeled                                     | Rooms/Encounters    |

### Room features

| Feature                                                                                  | Native (fresh)                                                                                                                           | Planner today                                                | Family                                   |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------- |
| Wells                                                                                    | none (`RoomData.lua:572-587`; post-boss `WorldUpgradePostBossWellShops`)                                                                 | mature: Well inventories on rooms                            | Rooms                                    |
| Purging Pool F/G post-boss                                                               | none (`WorldUpgradePostBossSellTraitShops`)                                                                                              | mature                                                       | Rooms                                    |
| Purging Pool H post-boss                                                                 | **object present, unusable** (`ObstacleData.lua:3331-3350` overwrite, `BlockedByRequirements`)                                           | mature                                                       | Rooms (as absent; executor note **gap**) |
| Post-boss fountain                                                                       | present, 20% heal (`ObstacleData.lua:1325-1370`)                                                                                         | modeled (heal amount not simulated)                          | Rooms                                    |
| Post-boss keepsake/gift rack                                                             | **absent**: needs `WorldUpgradePostBossGiftRack` (`RoomDataF.lua:2606-2617`, `RoomDataG.lua:1092-1097`, `RoomDataH.lua:1960-1974`)       | mature: `keepsake-rack-used.ts`, rack actions                | **gap**                                  |
| Resource points                                                                          | **never spawn**: shovel/pickaxe/exorcism/fishing need `CompletedRuns >= 1` and tool incantations (`RoomDataF.lua:46-230`, same in G/H/I) | mature: `resourcePointSupport`, execution `resources` policy | **gap**                                  |
| Herb points                                                                              | always the ungated "collection" branch (`RoomDataF.lua:21-44` etc.)                                                                      | not modeled                                                  | out of scope                             |
| Infernal Troves, meta stands, golden urns, shade mercs, safe zones, Fields reward finder | absent / inert                                                                                                                           | not modeled                                                  | out of scope                             |

### Rewards

| Rule                                                                  | Native (fresh)                                                                                           | Planner today                                                                                                                                                 | Family           |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| MetaProgress Bones / big entries                                      | Ashes ≥ 5; big at Ashes ≥ 100 and Bones ≥ 500 (`LootData.lua:1093-1246`)                                 | mature: `smallEnteredBiomes` / `largeEnteredBiomes` (`rewards/requirements.ts:163-173`); accumulated `resourceGains` record exists; no threshold declarations | Rewards          |
| Pickup quantities, Buried Treasure, Double Up                         | per-object rounding, non-compounding (viability follow-up)                                               | modeled: amount resolved at production, credited to `resourceGains` at acquisition                                                                            | implicit         |
| Hammers, Hermes, Devotion, Hex, Talent, Mystery Boon, ordinary Nectar | closed                                                                                                   | mature predicates assume reachability                                                                                                                         | Rewards          |
| `F_Combat01` Apollo                                                   | fixed Common Nova Strike / Blinding Rush / Lucid Gain (`RoomDataF.lua:1283-1294`, `TraitLogic.lua:1794`) | modeled by ordinary offer rules once the profile restricts                                                                                                    | Rewards          |
| Consumable RunProgress bonuses                                        | Ashes +5 HP, Bones +5 Magick, Nectar Pom level gated by incantations                                     | not simulated (Nectar level: Rewards)                                                                                                                         | Rewards (Nectar) |
| LastStand items                                                       | ineligible (no DD to lose)                                                                               | `MissingLastStand` predicate                                                                                                                                  | viability        |
| Fields optional pool                                                  | ungated Armor/Nectar/Bones; no MinorTalent                                                               | mature                                                                                                                                                        | Rewards          |
| Zeus/Rain forced opening chain                                        | dead (Vanilla state, empty opening)                                                                      | mature biome-state modeling                                                                                                                                   | implicit         |

### Shops

| Rule             | Native (fresh)                                                                                                        | Planner today                                                   | Family       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------ |
| WorldShop groups | G1 boon from an interacted god; G2 Heal/MaxHP/Ashes/Bones; G3 MaxMana/Pom                                             | mature                                                          | Rewards      |
| I_WorldShop      | four items, G5 empty (`StoreLogic.lua:FillInShopOptions`)                                                             | `validEmpty` slot: stable five slots, empty group emits no item | Rewards      |
| Shop god         | eligible ∩ lifetime `LootPickups`, recorded at selection (`UpgradeChoiceLogic.lua:1046`); empty-intersection fallback | derived god-pickup history, empty-intersection fallback         | Rewards      |
| Armor            | needs `RoomCountCache.F_Story01`                                                                                      | mature                                                          | Rewards      |
| Charon cards     | spending accrues, none granted                                                                                        | not modeled                                                     | out of scope |

### Encounters (probe partial)

| Rule                                           | Native (fresh)                                                                             | Planner today                                                                                 | Family                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | --------------------- |
| Fixed firsts                                   | `FIntroFight`, `FishmanIntro`, `ClockworkIntro`                                            | `GeneratedIChronosIntro` modeled; F/G firsts absent                                           | Encounters            |
| Enemy-triggered intros                         | `SetupEncounter` post-generation scan; generated intros return first (viability follow-up) | executor binds lifecycle-compatible substitutes (`lifecycle-substitution`); planner unmodeled | Encounters (deferred) |
| Fear-driven elites, Fangs, Menace              | none (zero Fear)                                                                           | modeled via vow ranks → naturally zero                                                        | implicit              |
| Thorn-Weeper                                   | excluded until `MiniBossFogEmitter` occurs (never)                                         | mature pool                                                                                   | viability             |
| Hecate interlude / polymorph, Scylla performer | Meteor Shower / Sheep; Keytarist                                                           | mature: full choice domains                                                                   | Encounters            |
| Cerberus / Chronos summons                     | no first-run restriction found; Chronos first-victory scripting unverified                 | modeled                                                                                       | open                  |

### Traits and boons (five reachable gods)

| Rule                                    | Native (fresh)                                                                                                                                                                                        | Planner today                                        | Family                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------- |
| Offer gates                             | none of the five gods' traits reads a weapon, aspect, keepsake, Arcana, `CompletedRuns` or `WorldUpgrade` at offer time; only linked `OneOf`/`OneFromEachSet` prerequisites (`TraitData.lua:121-640`) | modeled (trait requirements)                         | implicit                |
| `PlantHealthBoon` (Demeter)             | **unreachable**: `PathTrue GameState.WeaponsUnlocked.ToolShovel` (`TraitData_Demeter.lua:1820`; Shovel is a Crossroads unlock, `WeaponShopData.lua:3206`)                                             | mature: declared without the gate (`demeter.ts:101`) | **gap**                 |
| Infusions of the five                   | the only five-god traits gated on `WorldUpgradeElementalBoons` (`UnityTrait`, `TraitData.lua:896-923`)                                                                                                | mature                                               | Rewards                 |
| Duos among the five                     | all ten structurally reachable under the four-god cap with Apollo forced (`TraitData.lua:365-491`); off-set duos need Zeus/Hera/Hephaestus/Ares                                                       | modeled (Duo entry)                                  | viability (now settled) |
| Legendaries of the five                 | reachable after in-run events (`OneFromEachSet`, `TraitData.lua:129-233`); Demeter's Plant Health route is dead, other set members remain                                                             | modeled                                              | settled                 |
| `RandomStatusBoon` pool                 | statuses gated per god on `TextLinesRecord.<God>FirstPickUp` (`TraitData_Aphrodite.lua:2064-2140`): only gods met this attempt contribute                                                             | check the engine's status-pool derivation            | **gap** (minor)         |
| Base rarity                             | Rare .10 / Epic .05 / Duo .12 / Legendary .10, **no Heroic roll** (`HeroData.lua:180-186`, order `TraitData.lua:713`)                                                                                 | modeled: `Heroic: 0` (`traits/index.ts:243`)         | implicit                |
| Heroic in-run                           | only via rarify: Steady Growth every 6 rooms (`TraitData_Demeter.lua:1925-1933`) or the too-few-options exchange fill at upgraded rarity (`UpgradeChoiceLogic.lua:816-817`)                           | modeled (Steady Growth, replacement rarity)          | implicit                |
| Random exchange offer                   | off (see Loadout table)                                                                                                                                                                               | mature `boonReplacementChance`                       | **gap**                 |
| `RoomRewardBonusBoon` (Buried Treasure) | `BlockOfferIfPreviouslyPicked`; not in `BlockGiftBoons` rooms                                                                                                                                         | modeled                                              | viability               |

### Chronos first fight (settled)

`I_PreBoss01` → `BossChronos01` (`BossDifficultyActive` false at zero Fear;
`EncounterData_Boss.lua:712-750`), two phases and 20,000 HP
(`EnemyData_Chronos.lua:17-18`; the three-phase overrides need Rivals or
`HecateMissing`), stage summons unchanged and ungated, EM-only weapon variants
off, Chronos ignores time-slow (`WorldUpgradeTimeSlowChronosFight` is offered
only after `RoomsEntered.I_Boss01`), no forced unpause, all pre-placed adds
active (`HadesChronosDebuffBoon` unobtainable). Victory is a normal run clear;
`I_PostBoss01` exists for the first win with first-meeting dialogue only; loss
has no first-attempt branch. Nothing here needs a planner change beyond the
existing zero-Fear boss domain.

## Findings

### The family's matrices hold

Every row of the viability investigation's unavailable / fixed / dynamic
tables is confirmed by the independent inventory. The reward-store, shop-group
and god-domain facts agree, including the empty fifth Tartarus group, the
`LootPickups`-based shop god rule, the Fields optional pool's ungated entries,
`FIntroFight` / `FishmanIntro` / `ClockworkIntro`, and zero Fear collapsing
Rival bosses, Fangs and Menace to nothing.

### Rules the family does not cover

1. **No post-boss keepsake rack.** `WorldUpgradePostBossGiftRack` gates the rack
   in F, G and H post-boss rooms. The planner models rack use
   (`keepsake-rack-used.ts`, Jeweled Pom cleanup, rack actions). The rooms
   outline says "postboss fountains stay" and lists Wells and Pools as absent
   but never the rack. Fresh File must declare the rack absent, or the
   editor offers a keepsake action the game cannot realize.
2. **No resource points.** Shovel, pickaxe, exorcism and fishing points require
   `CompletedRuns >= 1` plus tool incantations in every F–I room declaration.
   The planner publishes an engine-owned resource-point policy per occurrence
   (`resourcePointSupport`, execution `resources`). Fresh File must publish
   none; today the mature declarations would export points that never exist.
3. **Random boon exchange is off.** `HeroData.BoonData.GameStateRequirements`
   requires two completed runs, so the 10 % exchange-first roll never fires on
   a fresh profile; replacement rows appear only when a god has too few
   options. The catalog's `boonReplacementChance` must be profile-aware
   (effectively 0), and the Sacrificial Hymn path is moot (no Wells). This
   changes trait-offer legality, not just availability.
4. **Zero Death Defiance is a run fact, not only an item gate.** The family
   handles `MissingLastStand` items but does not state that no DD source exists
   in the attempt. Any planner consumer of DD counts (keepsake charge logic,
   `LastStand` conformance) should see zero for the profile.
5. **H post-boss Purging Pool is present but unusable**, not absent. The
   planner disposition (no inventory) is right; the executor should expect
   the locked object and not treat its presence as a stray feature.
6. **Executor admission works on the fresh path, but the first room is created
   before the module synchronizes.** `RoomLogic.lua:150` → `StartNewGame` →
   `StartNewRun(nil, { RoomName = "F_Opening01" })`. The module admits the plan
   in its `CreateNewHero` wrapper (`loadout/hooks.lua:72`) and proves the
   loadout after `StartNewRun` returns (`:55-70`, `synchronizeStartingRoom`);
   `StartRoom` follows at `RoomLogic.lua:236`, so `route.enter` binds
   `F_Opening01` by game name. What differs from a mature run: the
   `args.RoomName` branch (`StartNewRun` +67) calls `CreateRoom` directly and
   never reaches the `ChooseStartingRoom` wrapper (`room/hooks.lua:27`), and
   the `CreateRoom` wrapper (`:69`) returns early while the session is still
   `starting`. The opening is therefore never passed through `room.realize` /
   `realizeIncomingReward` and carries no `__runPlannerExecutionRoomId` until
   `StartRoom`. Harmless for an empty, rewardless `F_Opening01` with a forced
   `OpeningEmpty`, but it is a second start path; the spine should
   synchronize at the `RoomName` branch (or in `CreateRoom` when
   `startDepth > 0`) so both paths share one contract.
7. **The starting-loadout proof needs a null aspect and keepsake.**
   `loadout/session.lua:21` requires `observed.aspectKey == expected.aspectKey`
   **and** `native.hasTrait(expected.aspectKey)`; on fresh
   `LastWeaponUpgradeName` is `{}` (observed nil) and `hasTrait(nil)` is false,
   so any published aspect mismatches. Keepsake (`:35-37`) compares
   `LastAwardTrait`/`EquippedKeepsake` (nil on fresh) with the published key;
   native `EquipKeepsake` returns early for nil (`KeepsakeLogic.lua:106-111`).
   Arcana and Fear proofs pass on empty sets. Sparse room-exit trait facts do
   not enumerate the hero's traits, so `DummyWeaponStaff` needs no mapping.
8. Biome state is always Vanilla; the Zeus/Rain forced opening chain is dead.
   Where the planner models F weather state, Fresh File fixes it.
9. **Demeter's Plant Health is unreachable** (Shovel unlock gate). The catalog
   declares it ungated; the Fresh File profile must exclude it, and the
   Demeter Legendary's second set loses that member.

### Direction review

The family's direction is right and stays bounded: one profile tag, closed
initial facts, the same chronology, source-local exclusions, no generic save
editor, one approved schema bump, and a spine-first delivery with ordinary
encounter customization disabled. Zero Fear is the strongest argument for that
last choice: Fangs, Menace and Rival variants vanish, so the customization
machinery has little to steer on a fresh profile.

## Open items carried from the inventory

Not source-resolved; do not encode as facts:

- Competing-introduction spawn traversal order (already open in the family).

Closed without a probe: `ChanceToPlay` RNG consumption (no fresh-versus-mature
RNG reproduction is planned) and the empty `{}` `LegacyGameStateRequirements`
entry (every `LegacyTrait` of the five gods is obtainable in play).

Settled from source: exit doors roll their next rooms at exit unlock
(`DoUnlockRoomExits`, `RoomLogic.lua:3871-3914`), which waits only on
`RoomRequiredObjects` (`CheckRoomExitsReady`, `:3100-3108`); Fields optional
rewards are registered in `MapState.OptionalRewards` (`:5736`), never as
required objects. A threshold crossed by an optional pickup collected after
the doors appear affects the following room's roll only — the planner's
existing outgoing-generation checkpoint ordering already expresses this, so
lifetime totals consumed at that checkpoint must include only acquisitions
ordered before it.
