# Fresh File project viability

## Design outline index

This investigation remains the overview and source-evidence owner. The following
temporary outlines organize the proposed changes by domain; they are not four
delivery plans or approval to implement/bump a schema:

1. [Loadout](FRESH_FILE_LOADOUT.md): project creation and fixed starting state.
2. [Rooms](FRESH_FILE_ROOMS.md): restrictions, opening chronology, bridge and Eris.
3. [Rewards](FRESH_FILE_REWARDS.md): inventories, source-local rules and unlocks.
4. [Encounters](FRESH_FILE_ENCOUNTERS.md): introductions, fixed/mixed profiles
   and required customization.

Engine history and resource products expose facts; the outlines own their consumers. Loadout
and rooms establish the playable start; rewards and encounters consume reached
history throughout the route. Derive one dependency-ordered delivery plan from
these outlines, with complete testable slices rather than one gate per file.
Current code seams are investigation starting points, not locked task packets.

### Readiness for one coherent design

Delivery ordering is settled: first audit and correct the general executor
encounter-binding boundary, moving from name-equality inclusion gating toward
proven semantic-conflict exclusions while preserving phase/lifecycle ownership.
This prerequisite serves existing projects and must be verified before other
Fresh File implementation. See the encounter outline for its audit scope.

Compatibility approval: the owner authorizes one authored schema bump for the
Fresh File feature, including nullable mandatory selections; consolidate its
changes and migrate existing saves without altering their intent. Execution
compatibility remains a separate contract. Shop declarations retain their slot
count: the fifth Tartarus slot exists but is validly empty in Fresh File.

There is enough settled direction to write a single integrated design precursor,
but not yet a fully locked delivery plan. The domain outlines supply its inputs;
the integrated document should own the end-to-end contracts rather than repeat
five inventories or assign one implementation gate per outline.

Settled: FreshFile tag and fixed itinerary; fixed loadout; shared history and
numeric gain machinery; separate Fresh File bag/shop profiles; conditional
F_Combat01 forcing through existing requirements; first Apollo contents through
Fresh File/no-core-boons-at-all eligibility and Common rarity validation; Eris
feature-to-timeline interaction; bridge Shop; Nectar without levels; disabled
element placement; god matrix; deterministic first-combat identities.

First delivery is the playable Fresh File spine: project creation, loadout,
rooms, rewards and deterministic introductory encounter resolution. Enemy
introductions are settled identities in the encounter selector, gated on the
route's completion and occurrence history; customization is required on every
generated phase so that history is exact (see the encounters outline). Native
uncustomized mode is not publishable on this route.

The integrated design should trace initialization → production/history →
eligibility → authored actions → execution products, with explicit ownership.
It must keep these bounded decisions visible:

- Bounded executor handling of native introduction substitutions while still
  enforcing deterministic first encounters and meaningful room lifecycle.
- Persisted absence/profile representation, empty shop-group addressing and
  schema/protocol compatibility, with explicit owner approval for migrations.

Competing-introduction traversal cannot arise in authored compositions; it
and mixed-wave installation remain live diagnostics, not blockers.

Source-function probes establish control flow and budget behavior, not live
execution acceptance. The design may state those known boundaries now and
retain the concrete live probes; it must not present unresolved behavior as a
finished contract or imply implementation authorization.

## Question and conclusion

Investigated 2026-09-27. Can the planner support a fourth creation choice,
Fresh File, for the very first Underworld run, without introducing arbitrary
save-state authoring?

Yes. A closed first-run profile with fixed F → G → H → I order is viable.
It is a substantial cross-lane feature, not merely another route label or a
catalog exclusion pass. The important distinction is that initial progression
is fixed but some progression facts change within that first run.

This is a viability investigation, not a locked implementation plan or a
complete first-run eligibility matrix. No implementation or schema change is
authorized by this document.

## Evidence inspected

Sources are the local game scripts under `../../1GameData/Scripts/`.
`RunLogic.lua` was byte-checked against the installed Steam copy and matches.
Other cited files were inspected in the local source collection; the complete
source set was not version-attested in this pass.

## Classification contract

“Unavailable” below means unreachable during an ordinary, unmodified first
Underworld attempt—not merely false on room entry. An unlock available later
in that same attempt belongs in the dynamic matrix. First-run history includes
events from the current attempt; it is not a frozen empty save.

Source anchors name Lua tables/functions so the evidence remains locatable
without relying on line numbers. These matrices cover the inspected systems,
not an exhaustive certification of every game declaration.

## 1. Definitively unavailable within the first run

| Feature                                         | Decisive source evidence and reachability                                                                                                                                                                                                                                                             | Planner consequence                                                                                                                                                           |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Infusions                                       | `TraitData.lua:ElementalGameStateRequirements` requires `WorldUpgradeElementalBoons`. The fresh profile has no incantations; the run cannot purchase Crossroads upgrades.                                                                                                                             | Exclude infusion offers, not all Duo/Legendary traits.                                                                                                                        |
| Reprieve rooms                                  | F/G/I reprieve declarations require their world upgrades.                                                                                                                                                                                                                                             | Exclude `X_Reprieve`; **retain postboss rooms and their fountains**.                                                                                                          |
| Wells and Purging Pools                         | Base/postboss room setup gates these objects on world upgrades absent from the first-run profile.                                                                                                                                                                                                     | No corresponding room features or inventories.                                                                                                                                |
| Arachne/Narcissus/Hades story visits            | `F_Story01` requires prior F boss entry and Artemis meeting; `G_Story01` requires G boss entry; `I_Story01` requires more than one I intro entry. Forward first-run traversal cannot satisfy them before their placement opportunities.                                                               | Exclude these story candidates.                                                                                                                                               |
| Echo interaction                                | `Story_Echo_01` requires H boss entry, after the only first-run bridge opportunity.                                                                                                                                                                                                                   | Use the bridge's native Shop fallback; do not remove the bridge occurrence.                                                                                                   |
| Artemis combat introduction                     | `EncounterData_Artemis.lua:ArtemisCombatIntro` requires at least one completed run; subsequent variants require her introduction.                                                                                                                                                                     | Exclude introduction and dependent combat visits.                                                                                                                             |
| Nemesis combat/events/shopping                  | `NemesisCombatIntro` requires at least seven completed runs; dependent interactions require introduction history.                                                                                                                                                                                     | Exclude the dependent family, not just the ordinary combat candidate.                                                                                                         |
| Erebus cocoon encounter                         | `ArachneCombatF` requires at least one completed run.                                                                                                                                                                                                                                                 | No first-run Erebus cocoon customization.                                                                                                                                     |
| Other Erebus minibosses                         | `F_MiniBoss02/03` require two completed `MiniBossTreant` encounters, with further requirements on 03. A first traversal cannot supply two.                                                                                                                                                            | Only Root Stalker remains available.                                                                                                                                          |
| Uh Oh                                           | `G_MiniBoss02` requires completion of both Water Unit and Jellyfish minibosses. They are alternatives in the first Oceanus traversal.                                                                                                                                                                 | Keep Hellifish/Serpent candidates; exclude Uh Oh.                                                                                                                             |
| Thorn-Weeper                                    | `EnemyData_SiegeVine.lua` requires occurrence of `MiniBossFogEmitter`; its elite inherits the base restriction. That miniboss is unavailable above.                                                                                                                                                   | Exclude both normal and elite enemy types.                                                                                                                                    |
| Chaos gates                                     | `ChaosUnlocked` requires Hermes use and excludes the run of `HermesFirstPickUp`. Even acquiring Hermes for the first time cannot unlock Chaos that run. Wells/ Ixion cannot bypass this because wells are absent.                                                                                     | No Chaos detours.                                                                                                                                                             |
| Zagreus contract                                | `InfernalContractUnlocked` requires true-ending and subsequent dialogue history.                                                                                                                                                                                                                      | No contract detours.                                                                                                                                                          |
| Anomaly                                         | `AnomalyDoorRequirements` requires Chronos use/meeting history, excludes the run of `ChronosFirstMeeting`, and has its opportunity in G before the first Chronos boss meeting.                                                                                                                        | No anomaly detours; a first-run Chronos conversation does not unlock one.                                                                                                     |
| Ordinary Nectar room reward                     | `GiftDropLootRequirements` requires at least one completed run and 50 lifetime Bones.                                                                                                                                                                                                                 | Exclude this reward-store entry only. Fields optional Nectar is a separate, ungated source.                                                                                   |
| Starting Arcana/Fear/familiar/keepsake upgrades | `StartNewGame` resets GameState; `GameStateInit` initializes empty progression. `InitializeMetaUpgradeState` honors StartEquipped, but no active StartEquipped declaration exists in inspected `MetaUpgradeData.lua`. Shrine/familiar state is empty and starting keepsake uses unset LastAwardTrait. | Fixed starting restrictions; do not use the mature planner's mandatory keepsake or automatic Arcana defaults. Weapon/aspect representation is settled in the loadout section. |

These are ordinary first-run availability conclusions, not claims that a debug
or externally forced reward cannot bypass the game's requirements.

## 2. Available, but fixed or restricted

| Feature                     | Source-backed restriction                                                                                                                                                                                                                                                                                                                | Disposition                                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| First combat and Apollo     | `F_Combat01.ForceIfEncounterNotCompleted = FIntroFight`; the encounter declares four fixed spawn waves. The room forces unused Apollo, Common rarity on the first run, and Nova Strike / Blinding Rush / Lucid Gain through `ForceLootTableFirstRun`. `SetTraitsOnLoot` and `IsRarityForcedCommon` consume these fields.                 | Fixed first-combat offer, acquired after combat—not a free mature-style opening reward.                                   |
| Empty opening               | `OpeningEmpty` is forced before Apollo use and its events do not spawn a reward.                                                                                                                                                                                                                                                         | Fixed `F_Opening01`, empty before the forced first combat; no loadout reward.                                             |
| Initial Olympian candidates | Apollo/Poseidon/Demeter have no top-level unlock gate; Hestia/Aphrodite are conditional below. Zeus/Hera/Ares require introduction records; Hephaestus needs Zeus and excludes Zeus's first-pickup run. `F_Opening01.ForcedRewards` and biome-state gates do not provide an obvious first-run Zeus bootstrap (Rain requires later runs). | Strong support for the proposed five-god pool; finish forced-source reachability before certifying every excluded reward. |
| Fields bridge               | `H_Bridge01.ForcedRewards` chooses Story only when eligible, otherwise Shop; `BridgeShop` is a legal encounter.                                                                                                                                                                                                                          | Same bridge topology, different resolved offering. Generation-pressure/scam behavior remains open.                        |
| Sirens featured performer   | `ApplyScyllaFightSpotlight` guarantees `Keytarist` on the first `BossScylla01` occurrence.                                                                                                                                                                                                                                               | Jetty fixed; mature explicit customization must not bypass this restriction.                                              |
| Hecate interlude            | `MidPhaseWeapons` leaves only `HecateMeteorShower` without prior-clear requirements; alternatives require 1/2/10 clears. Transition 1 filters requirements and transition 2 reuses the choice.                                                                                                                                           | Fixed native choice. User's “Dark Side ring” terminology remains a source discrepancy, not a second supported option.     |
| Hecate polymorph            | `PolymorphPresentationData`: Sheep has no progression gate; Pig requires O story entry, Rat requires rival F boss entry. `EffectLogic.lua` filters options before choosing.                                                                                                                                                              | Sheep only on this route/profile. Leave presentation native.                                                              |
| First Oceanus combat        | `FishmanIntro` is AlwaysForce when unfinished and declares fixed waves.                                                                                                                                                                                                                                                                  | Resolve the introduction identity rather than ordinary GeneratedG; full introduction inventory remains necessary.         |

### Shop god history: first-run restriction

Normal and boosted world-shop boons cannot introduce a previously unmet god
on a fresh file. `StoreLogic.lua:FillInShopOptions` selects both `RandomLoot`
and `BoostedRandomLoot` through `GetEligibleInteractedGod`. In `RunLogic.lua`,
`GetEligibleInteractedGods` intersects ordinary eligible gods with
`GetInteractedGods`, which reads lifetime `GameState.LootPickups`.

This is a general native rule, not a Fresh File-only conditional. The mature
planner can assume those gods have already been met; Fresh File cannot.
Its lifetime pickup history consists only of pickups reached in the current
attempt. Shop source candidates must therefore consume reached god-pickup
history at inventory generation, not merely the five-god first-run domain or
the gods currently eligible for ordinary room rewards. A door offer alone does
not add a god to that history.

The helper has a fallback to ordinary eligible gods when the intersection is
empty. The mandatory first Apollo pickup prevents that fallback from providing
a new god in the proposed three-god shop scenario: Apollo remains an eligible,
previously encountered candidate.

Consequently, entering a shop with three gods (including Apollo), buying a
fourth there, then taking a fifth from an already-generated door is not a
reachable bootstrap. The shop can only repeat an encountered god. An ordinary
door can introduce the fourth; subsequent ordinary selection respects the
four-god cap. That path supplies at most three of the four non-Apollo
first-pickup records required by `HammerLootRequirements`.

### Reward unlock closure: Hermes, Selene, Mystery Boons and Devotion

These reward families are unavailable on the first Underworld attempt, not
merely unavailable at its start:

| Reward            | Ordinary gate                                                                                                  | Why its introduction/alternative source cannot bootstrap it                                                                                                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hermes            | `HermesUpgradeRequirements` and `ConsumableData.ShopHermesUpgrade` require `HermesFirstPickUp`.                | The F opening introduction requires at least two G intro entries and Zeus use. Later forced Hermes branches require previous Q progress, epilogue, or an already-used keepsake/Hermes. N/Q sources are outside this route.                    |
| Selene / Hex      | `SpellDropRequirements` requires both `ArtemisFirstMeeting` and `SeleneFirstPickUp`.                           | The forced first SpellDrop in F opening requires `ArtemisCombatIntro`; that encounter requires at least one completed run. No first-run Artemis bootstrap exists.                                                                             |
| Path of Stars     | `TalentLegal` requires at least four lifetime SpellDrop uses, a current-run SpellDrop, and an unfinished tree. | There is no first-run Hex acquisition; this is not a family that unlocks immediately after acquiring the first Hex either.                                                                                                                    |
| Mystery Boon      | `BlindBoxLootRequirements` requires use of Zeus, Poseidon, Apollo, Demeter, Aphrodite, Hephaestus and Hestia.  | Hephaestus requires Zeus use but excludes the current run of Zeus's first pickup. Narcissus's separate Mixed Blessings drop cannot bypass the restriction here because Narcissus's room is unavailable; Nemesis sources are also unavailable. |
| Devotion / trials | Reward stores require `PoseidonDevotionIntro01`.                                                               | That dialogue itself and the forced opening offer require `DevotionTestUnlocked`: Surface survival incantation, Surface dialogue history, three N Hub entries and an N boss entry. Meeting Poseidon during this run cannot unlock trials.     |

Sources: `RequirementsData.lua` named gates; `RoomDataF.lua:F_Opening01.ForcedRewards`;
`LootData_Poseidon.lua:PoseidonDevotionIntro01`; `LootData.lua` reward stores;
`ConsumableData.lua:BlindBoxLoot/ShopHermesUpgrade`;
`LootData_Hephaestus.lua:HephaestusUpgrade.GameStateRequirements`;
`TraitData_Narcissus.lua` Mixed Blessings drop.

Keep these separate from the resource/store inventory audit. Ordinary Nectar
remains blocked by completed-run history while Fields optional Nectar remains
available. Poms have `StackUpgradeLegal` (at least one upgradable trait), a
within-run condition, not one of these permanent exclusions. No blanket ban on
health, magick or money rewards follows from the reward unlocks above.

### First-run world-shop inventory

`StoreData.lua:WorldShop/I_WorldShop` retain their normal groups; first-run
progression removes candidates. Group numbers below are declaration order,
not left-to-right visual positions in the map.

| Shop / group             | First-run candidates                                       | Removed candidates                                                                         |
| ------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| WorldShop 1: boon        | Normal boon from previously encountered gods               | Mystery Boon, Hermes                                                                       |
| WorldShop 2: mixed       | Healing, Max Health, Ashes, Bones                          | Armor, shop hammers, ordinary Nectar; elements remain Dream-only                           |
| WorldShop 3: progression | Max Magick, Pom, Pom Slice under ordinary Pom requirements | Hex, Path of Stars                                                                         |
| I_WorldShop 1            | Boosted boon or Double Pom                                 | First-half alternatives do not apply at ordinal four                                       |
| I_WorldShop 2            | Normal boon, Max Health, Max Magick, Pom                   | Mystery Boon, Hex, Path of Stars                                                           |
| I_WorldShop 3: survival  | Large healing (`HealBigDrop`)                              | Armor; Death Defiance refill has no missing charge to restore                              |
| I_WorldShop 4: premium   | Boosted boon, large Max Health, large Max Magick           | Hermes; Anvil requires an acquired hammer                                                  |
| I_WorldShop 5: resources | No candidates under the fresh resource profile             | Nightmare, Moondust, Charon Card require prior lifetime acquisition; element is Dream-only |

New evidence beyond the previously closed reward families:

- `ConsumableData.ArmorBoost.GameStateRequirements` requires
  `GameState.RoomCountCache.F_Story01`. `ArmorBigBoost` inherits this gate.
  Arachne's unavailable room therefore excludes armor from both shops.
- `LastStandDrop` requires `MissingLastStand`; no starting Death Defiance is
  not a missing charge. Thus the Tartarus survival group resolves to food.
  This proves the item, not the user's physical “first slot” description.
- Shop hammer entries require prior `UseRecord.WeaponUpgrade` in addition
  to their named hammer requirements. `ChaosWeaponUpgrade` (Anvil) requires
  at least one current-run hammer. These do not bootstrap the first hammer.
- Ordinary shop Bones use the consumable's requirements, not the room-reward
  bag's five-Ashes threshold. Do not copy room-store gates onto shop entries.
- `MailboxLogic.HandleCharonPurchase` records spending but only grants cards
  if `MailboxData.CharonPointsRequirements` passes, including prior use of
  `CharonPointsDrop`. Spending 1,000 during the first run is not by itself a
  first-card source.
- `FillInShopOptions` appends a group's selected items only when its eligible
  option list is nonempty. There is **no major-reward replacement** in this
  path for an empty resource group. Under the fresh resource profile this
  produces four items in I_WorldShop, not five with a replacement major.
  `SpawnStoreItemsInWorld` places the resulting ordered list at sorted
  `LootPoint` IDs; declaration order is not a claim about visual orientation.

#### Empty fifth group: deeper verification

`StoreData.lua` and `StoreLogic.lua` were byte-compared with the installed Steam
scripts and match. The complete relevant path is:

1. `I_PreBoss01` selects `I_WorldShop` and `EncounterSets.ShopRoomEvents`.
2. `RunShopGeneration` generates that inventory. `SetupWorldShop` subsequently
   spawns it; `SpawnStoreItemsInWorld` can generate it itself if absent.
3. `FillInShopOptions` filters the fifth group's four declarations through
   their replacement requirements. Zero eligible options skips the append
   block; there is no fallback, retry with major rewards, or minimum-five fill.
4. The spawning loop iterates actual inventory entries, not all LootPoints.
   An unused LootPoint does not itself create an item.
5. The remaining shop-room events concern Zagreus contracts and terminal Dream
   deliveries, neither a first-run fifth-slot replacement. Purchase restocking
   requires `FirstPurchaseDiscount` and an actually purchased item; it does
   not fill empty initial slots and Fresh File has no such keepsake.

A bounded Lua probe executed the unmodified `FillInShopOptions` function with
the actual fifth-group declaration. Engine helpers were stubbed; eligibility
was restricted to this group's PathTrue/PathFalse predicates, not a full-game
simulation. Empty lifetime resources in a non-Dream run produced **zero items**.
Positive controls produced exactly Nightmare, Moondust, or Charon Card when
their respective lifetime resource was present, and Elemental Boost in Dream.
This verifies the empty-group algorithm, not a complete played-run observation.

Conclusion: under the stated first-run resource facts, the fifth group is
absent, not replaced. An observed fifth major reward would require a concrete
save/log or a different game version/source path to reconcile; do not implement
an undocumented fallback from the original anecdotal list.

The current catalog's `declarations/rewards/shops.ts` assumes mature
progression: Armor and the normal meta-resource inventory remain available,
and I_WorldShop declares five slots. Fresh File therefore needs both restricted
candidates and a supported absent resource slot—not just a different default
selection. The ordinary shop still has three nonempty groups. No production
change is made by this investigation.

Poms remain ordinary unchanged behavior. Their eligibility is not a new
Fresh File history rule.

## Reward-pool inventory matrix

The shop group matrix above is the WorldShop/I_WorldShop inventory owner in
this investigation. The following tables cover the four requested reward
pools. Counts are **declaration copies per refill**, not spawned item quantities
or independent authorable slots. Room exclusions, duplicate checks, forced
rewards and existing bag consumption still apply.

Sources: `LootData.lua:RewardStoreData`, `RewardLogic.lua:IsRoomRewardEligible`,
`ChooseRoomReward`, `SpawnRoomReward`, and `RoomLogic.lua:SpawnRewardCages`.
The literal Lua tables were loaded to count active entries, excluding commented
ones: MetaProgress 19, RunProgress 18, TartarusRewards 9, FieldsOptionalRewards 19. The tables below account for every entry.

### MetaProgress

Let **A** be lifetime Ashes gained, **B** lifetime Bones gained, and **n** the
number of entered biomes. These start at zero on Fresh File and gains during
the attempt update them. Spending does not reduce lifetime totals.

| Native entry                                     | Copies | Eligibility                              | First-run consequence / difference from mature assumptions                                                       |
| ------------------------------------------------ | -----: | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `GiftDrop`                                       |      1 | B ≥ 50 AND completed runs ≥ 1            | Unavailable throughout this attempt.                                                                             |
| `MetaCurrencyDrop` (Bones), first biome          |      2 | A ≥ 5 AND n ≤ 1                          | Unlocks after gaining five Ashes; no retroactive change to generated rewards.                                    |
| `MetaCurrencyDrop` (Bones), later biomes         |      2 | A ≥ 5 AND n > 1 AND (B < 500 OR A < 100) | Track reached totals; do not assume mature large rewards.                                                        |
| `MetaCurrencyBigDrop` (large Bones)              |      2 | A ≥ 5 AND n > 1 AND B ≥ 500 AND A ≥ 100  | Conditional on reaching both totals. Reachability of the totals is not assumed or replaced with a permanent ban. |
| `MetaCardPointsCommonDrop` (Ashes), first biome  |      4 | n ≤ 1                                    | Available without a prior-resource unlock.                                                                       |
| `MetaCardPointsCommonDrop` (Ashes), later biomes |      4 | n > 1 AND (B < 500 OR A < 100)           | Ordinary-size rewards until both thresholds pass.                                                                |
| `MetaCardPointsCommonBigDrop` (large Ashes)      |      4 | n > 1 AND B ≥ 500 AND A ≥ 100            | Same dynamic threshold boundary as large Bones.                                                                  |

`ChooseRoomReward` tests eligibility when selecting from the bag. It retains
ineligible remaining entries when adding a refill; do not rewrite the bag into
a static first-run list. After repeated failed refills it falls back to
`RoomRewardHealDrop`. Thus “Oceanus has Bones, Ashes, then food” is a possible
distinct-door outcome, not an unconditional three-entry store definition.

### RunProgress

| Native entry    | Copies | Fresh File availability               | Requirement / disposition                                                                                                                                         |
| --------------- | -----: | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MaxHealthDrop` |      2 | Available                             | One unconditional entry; second requires at least one Olympian in current loot history. Same native rule, satisfied after mandatory Apollo.                       |
| `MaxManaDrop`   |      2 | Available                             | Same one unconditional / one Olympian-history split.                                                                                                              |
| `RoomMoneyDrop` |      2 | Available                             | Same one unconditional / one Olympian-history split.                                                                                                              |
| `StackUpgrade`  |      2 | Available under ordinary Pom legality | Both require an upgradable trait; second also requires at least one Olympian in loot history. No Fresh File-specific Pom rule.                                    |
| `Boon`          |      4 | Available                             | All four allow duplicate reward family; god selection still applies the five-god domain, Hestia/Aphrodite unlock and four-god cap.                                |
| `WeaponUpgrade` |      2 | Unavailable throughout Fresh File     | Separate early/late entries remain in the declaration inventory; neither is eligible in this profile.                                                             |
| `HermesUpgrade` |      1 | Unavailable                           | Closed Hermes introduction gate.                                                                                                                                  |
| `Devotion`      |      1 | Unavailable                           | Closed Poseidon dialogue gate. Native additional rules remain encounter depth ≥ 7, biome encounter depth ≥ 2, two qualifying gods, 15-room spacing and two exits. |
| `SpellDrop`     |      1 | Unavailable                           | Closed Artemis/Selene introduction gate.                                                                                                                          |
| `TalentDrop`    |      1 | Unavailable                           | TalentLegal; additionally n > 1 and no TalentDrop use this biome. No Hex bootstrap exists.                                                                        |

### TartarusRewards

| Native entry          | Copies | Fresh File availability               | Requirement / disposition                                                             |
| --------------------- | -----: | ------------------------------------- | ------------------------------------------------------------------------------------- |
| `RoomMoneyTripleDrop` |      1 | Available                             | No additional pool-entry requirement.                                                 |
| `StackUpgradeTriple`  |      1 | Available under ordinary Pom legality | StackUpgradeLegal; unchanged.                                                         |
| `Boon`                |      3 | Available                             | Duplicate family allowed; ordinary eligible god resolution.                           |
| `WeaponUpgrade`       |      2 | Unavailable throughout Fresh File     | Separate early/late entries; neither is eligible in this profile.                     |
| `Devotion`            |      1 | Unavailable                           | Closed introduction gate; native two-god, 15-room spacing and two-exit checks remain. |
| `TalentBigDrop`       |      1 | Unavailable                           | TalentLegal cannot be reached.                                                        |

Clockwork goals and the Tartarus non-goal reward limit are room/route rules,
not extra entries in this nine-entry pool.

### FieldsOptionalRewards

| Native entry               | Copies | Fresh File availability     | Requirement / disposition                                                                 |
| -------------------------- | -----: | --------------------------- | ----------------------------------------------------------------------------------------- |
| `MaxManaDropSmall`         |      3 | Available                   | No pool-entry progression requirement.                                                    |
| `MaxHealthDropSmall`       |      3 | Available                   | No pool-entry progression requirement.                                                    |
| `RoomMoneyTinyDrop`        |      3 | Available                   | No pool-entry progression requirement.                                                    |
| `RoomRewardHealDrop`       |      1 | Available                   | No pool-entry progression requirement.                                                    |
| `ArmorBoost`               |      1 | Available through this pool | Unlike shop selection, this entry has no Arachne gate. See source-path distinction below. |
| `GiftDrop`                 |      1 | Available through this pool | No ordinary Nectar completed-run/Bones gate on this entry.                                |
| `MetaCurrencyDrop`         |      1 | Available through this pool | No MetaProgress five-Ashes gate on this entry.                                            |
| `MetaCardPointsCommonDrop` |      4 | Available                   | Ordinary Ashes; no threshold-based large replacement in this pool.                        |
| `MinorTalentDrop`          |      2 | Unavailable                 | Both require TalentLegal.                                                                 |

`SpawnRewardCages` selects optional rewards via `ChooseRoomReward` with the
room's bonus store. `IsRoomRewardEligible` checks the reward-store entry's
requirements, not `ConsumableData[item].GameStateRequirements`.
`SpawnRoomReward` then creates the selected consumable directly; the inspected
creation path does not reapply the shop eligibility check. Consequently,
**shop Armor's Arachne gate must not become a global Armor prohibition**.
The same source distinction explains optional Nectar and Bones. These Fields
items do not themselves unlock Arachne or change completed-run history.

### Required facts versus unchanged rules

- Newly explicit for Fresh File: reached lifetime Ashes/Bones totals, fixed
  zero completed runs, restricted first-run reward families, shop god pickup
  history, and the absent Tartarus resource group.
- Reuse existing semantics: Pom legality, ordinal rules, bag copies/consumption,
  duplicate prevention, reward-store precedence and ordinary god-cap handling.
- Source-local restrictions stay source-local: shop Armor, ordinary Nectar,
  and MetaProgress Bones do not constrain their ungated Fields pool entries.
- Death Defiance refill items are unavailable throughout Fresh File, because
  this profile cannot acquire a charge to lose; they are not a user-authorable
  missing-charge outcome.
- Owner's in-game verification confirms the four-item Tartarus shop and absent
  fifth group. No replacement-major implementation is needed.
- Hammers are settled as unavailable throughout Fresh File, including shop
  hammers and Anvil. Do not reopen reachability as a delivery prerequisite.
  Resource thresholds are modeled directly rather than declared unreachable.

## 3. Facts that can unlock or change during the run

| Fact / feature                | Initial state → trigger                                             | Timing and consumer                                                                                                                                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hestia/Aphrodite availability | No Poseidon/Demeter use → either god used.                          | Top-level loot requirements read `GameState.UseRecord`. `RecordUse` updates both profile and current-run history at use. An offered door alone does not qualify. Later generation sees the updated fact.                                                                                             |
| Enemy introduction completion | Empty completion history → an introduction completes.               | `HasEncounterBeenCompleted` reads current-run and historical completion. `ChooseEncounter` / `SetupEncounter` can substitute unfinished introductions; `IsEnemyEligible` can require a completed introduction. Record completion before subsequent encounter evaluation.                             |
| Minor reward-store thresholds | Zero lifetime resources → resource acquisition.                     | `AddResource` updates lifetime totals immediately unless NoLifetimeEffect. `MetaProgress` uses Ashes/Bones thresholds and entered-biome count. Bones entries require at least five lifetime Ashes; later entries change at higher thresholds. Exact reachable inventory needs a resource-path audit. |
| God pool membership           | No interacted gods → loot interactions enter history.               | `GetInteractedGodsThisRun` derives membership from loot history; `ReachedMaxGods` uses a cap of four. This is not simply the current equipped-trait set. Relevant to hammer reachability and later god candidates.                                                                                   |
| First-pickup dialogue history | No first-pickup records → qualifying first interaction/dialogue.    | Some reward requirements count named records, not just god membership. Prefer a bounded semantic derivation once reachability is proven, not a general text-record interpreter.                                                                                                                      |
| Fields optional Nectar        | No ordinary Nectar eligibility, but optional `GiftDrop` is ungated. | `FieldsOptionalRewards` can yield Nectar during the run. This does not satisfy the separate completed-run gate for ordinary Nectar rewards.                                                                                                                                                          |

`EndRun` updates completed-run history. None of these acquisitions changes
“zero completed runs” while the first attempt is still in progress.

## 4. Existing rules that can remain in use

| Existing system                                     | Bounded evidence for reuse                                                                                                                           | Qualification                                                                                                                                                        |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fixed Underworld itinerary and biome-local topology | Fresh File still traverses F → G → H → I. Existing route-ordinal plumbing and room declarations provide the structure.                               | Candidate restrictions and opening chronology differ; this is not blanket reuse of mature eligibility.                                                               |
| Postboss fountains                                  | E.g. `F_PostBoss01` activates `HealthFountainF` without the reprieve setup requirement.                                                              | “No fountains” does not remove these rooms or interactions. Wells/pools remain absent.                                                                               |
| Tartarus production minibosses                      | `I_MiniBoss01/02` use current-run depth, sibling exclusion, door and reward-budget requirements rather than prior-file progression. 03 is DebugOnly. | Retain both production candidates under their existing current-run rules.                                                                                            |
| Ordinary reward duplicate exclusion and fallback    | `IsRoomRewardEligible` checks duplicate identity; `ChooseRoomReward` eventually falls back to healing after failed refill attempts.                  | The eligible store contents change. This supports a food third door when only two distinct minor rewards are eligible, not a universal hard-coded Oceanus exit list. |
| Ordinary trait prerequisites                        | `LegacyGameStateRequirements` no longer has its former dialogue unlock; individual trait prerequisites still apply.                                  | Do not extend the infusion exclusion into an unsupported blanket Duo ban. Audit actual reachable traits.                                                             |
| Native encounter generation mathematics             | Intro encounters may themselves be Generated; `FishSwarmerIntro` mixes a fixed first wave with a generated template.                                 | Reuse mathematics where the resolved declaration uses it. “Every encounter is fully scripted” is not established.                                                    |
| Native presentation and combat                      | Sheep presentation and fixed boss selection can stay native.                                                                                         | Do not add authored controls simply because a first-run restriction exists.                                                                                          |

## Follow-up: introduction precedence, pressure and resource arithmetic

Source follow-up on 2026-09-28; no production changes or in-game verification.

### Competing introductions

`RunLogic.lua:SetupEncounter` (1098–1154) generates the proposed encounter,
runs setup events, then scans its original `SpawnWaves` and each wave's
`Spawns` using `pairs`. For each unfinished introduction whose requirements
pass, it replaces the local result with that introduction. A **generated**
introduction is generated and returned immediately. A **fixed** introduction
does not return: subsequent entries in the original traversal can replace it
again. The replacement's waves are not recursively scanned by this loop.

A bounded Lua probe executing the unmodified `SetupEncounter` function with
stubbed eligibility/generation and synthetic dense spawn arrays produced:

| Original traversal            | Returned introduction |
| ----------------------------- | --------------------- |
| Fixed A, Fixed B              | Fixed B               |
| Fixed B, Fixed A              | Fixed A               |
| Fixed A, Generated C, Fixed B | Generated C           |
| Generated C, Fixed A          | Generated C           |

This verifies control flow, not the game's runtime ordering guarantee for
`pairs`. Native first-selection also has a separate `ChooseEncounter`
`ForceIntroduction` pass over `EnemySet`; it must not be conflated with this
post-generation pass.

Consequently, “first new enemy always wins” and “the game admits only one
unintroduced type in the proposed composition” are not supported rules.
F Radiator/Screamer and G FishSwarmer/Turtle use generated introductions.
Correction after tracing inheritance: the fixed-roster H introductions also
inherit `Generated = true` from `BaseIntroEncounter`/`GeneratedH`, so they
return immediately too. Fixed roster content must not be confused with the
non-generated control-flow branch used by the synthetic probe. The planner
must resolve the resulting whole encounter, not combine introductions or
record all encountered candidates as completed.

Recommended authoring boundary: identify competing eligible introduction
profiles and require an explicit switch to a legal resolved profile; do not
derive priority from picker click order. Before specifying automatic priority,
verify actual generated spawn ordering in game. The bounded function probe
does not justify treating Lua `pairs` as a portable ordering contract.

### Room-generation pressure

`RunLogic.lua:ChooseNextRoomData` filters with `IsRoomEligible` **before**
collecting `IsRoomForced` candidates, then randomly selects from the forced
list when nonempty. It contains no Fresh File-specific pressure algorithm or
generic miniboss-over-shop priority.

- `RoomDataF.lua:F_Shop01`: force window 4–6, eligibility through depth 6,
  at least two offered exits, at most one creation per run.
- `RoomDataG.lua:G_Shop01`: force window 3–6, but eligibility only through
  depth 5, the same two-exit requirement and one-creation limit. The force
  maximum does not override that eligibility cutoff.
- `RequirementsLogic.lua:RequiredMinExits` counts actual offered exits.
  On a one-exit boundary the shop is ineligible; this is not evidence of a
  miniboss winning a priority contest. Fresh File has no Chaos bypass.
- `RoomDataH.lua:H_Bridge01`: always forced when eligible, after exactly two
  counted H combat/miniboss rooms and before the third, with one creation per
  run. Its eligibility is independent of whether its content is Echo or Shop.
  `ForcedRewards` selects eligible Story first, otherwise Shop;
  `EncounterData_Unique.lua:BridgeShop` requires the Shop reward.

Disposition: reuse existing room pressure and creation-versus-visit semantics.
The Fresh File bridge changes its content, not its topology or pressure.
Offering the bridge and choosing another door still consumes its creation
allowance; do not invent a replacement guarantee for the missed shop.

### Resource quantities and timing

Source facts and the planner disposition are in the reward audit's
[Resource quantities](../audits/rewards-and-acquisition/REWARD_GAME_DATA_AUDIT.md#resource-quantities).

## Remaining probes and implementation pinning

### Generous F/G resource witness

A 2026-09-28 bounded probe executed native `RoomLogic.ChooseNextRewardStore`
with its ratio history and random outcome supplied by a small harness. It
checked the following selected-store sequence, not a complete authored project
or full room/offer eligibility. Use the owner's neutral RunProgress opening
substitute (e.g. a hammer with no resource contribution), then mandatory
RunProgress Apollo. No Wells, Chaos, story rooms or Reprieve rooms are used.

| Position     | Store / action                                | Ashes gained | Bones gained |
| ------------ | --------------------------------------------- | -----------: | -----------: |
| F opening    | Neutral major substitute                      |            0 |            0 |
| F ordinary 1 | Forced Apollo                                 |            0 |            0 |
| F ordinary 2 | Minor Ashes                                   |            5 |            0 |
| F ordinary 3 | Major Poseidon: assume Epic Buried Treasure   |            0 |          100 |
| F ordinary 4 | Root Stalker forced major: Poseidon, Sea Star |            0 |            0 |
| F ordinary 5 | Minor Ashes, duplicated                       |           20 |            0 |
| F ordinary 6 | Midshop, RunProgress store; buy Bones         |            0 |          100 |
| F ordinary 7 | Minor Ashes, duplicated                       |           20 |            0 |
| F ordinary 8 | Major, no resource contribution               |            0 |            0 |
| F ordinary 9 | Minor Ashes, duplicated                       |           20 |            0 |
| F preboss    | Shop, forced RunProgress; buy Bones           |            0 |          100 |
| G intro      | Eris Ashes gift                               |           20 |            0 |
| G ordinary 1 | Minor Ashes, duplicated                       |           20 |            0 |
| G ordinary 2 | Major, no resource contribution               |            0 |            0 |
| G ordinary 3 | Minor Bones, duplicated                       |            0 |          200 |
| Total        | Both thresholds reached                       |          105 |          500 |

At G entry the illustrative ledger is four MetaProgress entries out of eleven.
G's first three store-selection values are approximately 0.213636, -0.316667,
and 0.003846: Minor/Major/Minor is supported, although the last is rare.
Major/Major/Minor/Major can complete the seven-room G body, leaving another
MetaProgress selection after threshold crossing. F's four Ashes rewards consume
its four first-biome Ashes copies; G can consume its distinct later-biome copies.

This deliberately grants early Epic Buried Treasure, successful Sea Star rolls,
shop Bones availability and purchasing power. Shop pickups cannot duplicate;
Buried Treasure's initial gift is not duplicated because Sea Star is obtained
later. Ordinary Bones are 50 base, Epic-boosted to 100; duplicated room Bones
yield 200. Eris's 20 Ashes are not multiplied. No Tartarus Eris resources or
large MetaProgress items bootstrap the threshold.

Conclusion: minor/major pressure does **not** establish impossibility, even
without excess shops or detours. This is the requested generous resource/store
witness, not proof of full Fresh File legality. Before claiming the latter,
validate exact room candidates/offered-door creation history, early boon offer
and rarity restrictions, money and the real empty opening's store history.
Do not retire resource arithmetic on the assumption that 500 Bones is too high.

The remaining live behavioral check is:

- **Competing introductions:** test in game what happens when a proposed
  encounter contains multiple enemies with unfinished introductions. The
  source control flow above is established, but actual generated spawn
  traversal order needs confirmation before promising automatic priority.
  An explicit legal-profile switch avoids inventing picker-order priority.

Pressure and resource arithmetic are source-resolved above. Delivery still
needs production-context pickup quantities and representative witnesses for
the two-exit shop gate, bridge creation consumption, per-pickup rounding and
separate duplicate acquisitions; no general multiplier inventory is needed.

The implementation plan still needs exact declaration/consumer wiring for god
ordering and shop history, the profile/schema/export representation, and the
fixed/mixed-wave extension. These are design tasks, not reasons to reopen
settled exclusions, the empty opening, no-equipment choices, or Eris's scope.
Hecate's source identity is `HecateMeteorShower`; any reconciliation of the
original “Dark Side ring” wording is presentation clarification, not another
legal move.

## Agreed authoring outline: loadout

This records the owner's agreed Fresh File contract, not an implementation
gate or schema approval. Organize subsequent design into general legality
foundations, followed by loadout → room → reward → encounter → encounter
customization.

| Loadout field / initialization | Fresh File rule                                                                                                                                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Starting weapon / aspect       | No authorable choice; represent both selections as none. The actual game weapon is the fixed, aspect-less staff. Absence of selections must not be interpreted as unarmed if a downstream rule needs weapon identity. |
| Starting Arcana                | Exactly zero active cards, including automatically activated cards. Not an editable mature Arcana loadout.                                                                                                            |
| Starting Fear                  | Exactly zero; no active vows.                                                                                                                                                                                         |
| Starting keepsake              | None. Support a genuine no-keepsake loadout state rather than selecting a placeholder keepsake.                                                                                                                       |
| Starting reward                | None. Do not require a reward selection or silently insert Apollo here.                                                                                                                                               |
| F opening room                 | Exactly one valid opening: `F_Opening01`. Initialize it without an opening-variant picker. It has no combat and no reward. Native `OpeningEmpty` is an empty lifecycle identity, not an authored combat encounter.    |

The first combat room owns the fixed Apollo reward and its fixed Common offer
(Nova Strike, Blinding Rush, Lucid Gain). Acquisition follows that room's
scripted combat; it is not a loadout reward or an acquisition in the empty
opening. The precise first-combat authoring presentation belongs to the later
room/reward sections.

These are fixed Fresh File restrictions, not defaults that users can freely
change. The no-keepsake representation must be supported structurally; this
agreement does not otherwise broaden mature-route loadout policy. The fixed
staff is a Fresh File fact, not an additional user selection. Do not expand
this feature into arbitrary starting-stat or equipment authoring.

## Agreed authoring outline: rooms

Most room differences are catalog eligibility, not new topology or bespoke
editors. Fresh File is a closed project profile: encode proven exclusions
against that profile rather than importing arbitrary save-history inputs.
Existing depth, spacing, sibling, and door rules still apply to eligible rooms.

### Catalog-only restrictions

| Room or feature        | Fresh File disposition                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Opening variants       | Only `F_Opening01`; exclude the other F opening variants. Its empty initialization is covered by the loadout contract above. |
| Story rooms            | Exclude Arachne, Narcissus, and Hades rooms. Echo is handled separately through the bridge's content resolution below.       |
| Reprieve rooms         | Ineligible. Ordinary postboss rooms and their fountains remain available.                                                    |
| Erebus miniboss rooms  | Only `F_MiniBoss01` (Root Stalker) is eligible.                                                                              |
| Oceanus miniboss rooms | Retain Hellifish and Serpent; exclude Uh Oh.                                                                                 |
| Special detours        | Chaos, Zagreus contract, and Anomaly are ineligible.                                                                         |
| Room features          | Wells and Purging Pools are unavailable; no inventory authoring for these absent features.                                   |

“Catalog-only” describes ownership of the restriction. The shared eligibility
path must consume the Fresh File profile, and the editor must render the
result; it does not mean hard-coding exclusions in React. Encounter-family
exclusions such as Artemis, Nemesis, and cocoons belong to the later encounter
inventory, not additional room kinds.

### Three room behaviors needing more than exclusions

| Existing room                   | Catalog facts                                                                                                                                         | Additional modeled behavior                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `G_Intro`, `H_Intro`, `I_Intro` | Eris spawn requirements, curse, and respective resource gifts: 20 Ashes, 50 Psyche, 300 Bones. Existing Eris curse prevents another such interaction. | A bounded intro-timeline checkbox supplies the unmodeled health condition. The engine resolves whether Eris occurs and applies her curse and resource acquisition. This consumes the general resource-gain machinery; it does not introduce health simulation or three independent gift toggles.                                                            |
| `H_Bridge01`                    | Native forced reward resolves to Story when Echo is eligible, otherwise Shop; `BridgeShop` is supported by the game.                                  | Resolve bridge content by project profile: Fresh File has the shop, mature projects retain Echo. Support the shop's inventory/interaction through the existing shop model rather than treating the bridge as necessarily story-bearing. Preserve the same bridge occurrence and topology. Generation-pressure/force-collision details remain an audit item. |
| `F_Combat01`                    | Forced first combat room, `FIntroFight`, and fixed Common Apollo offer: Nova Strike, Blinding Rush, Lucid Gain.                                       | Enforce the room immediately after the empty opening and resolve its introductory encounter and reward. Acquire Apollo after combat using the normal trait-offer machinery, with its fixed offer. Do not recreate a starting reward in the loadout.                                                                                                         |

These are special behaviors of existing room declarations, not new room
types. Export and executor support must carry/enforce their resolved products;
the exact adapter work remains to be inventoried before implementation.
First Oceanus/Tartarus encounter substitutions belong to encounter resolution;
Tartarus shop inventory belongs to rewards; fixed boss choices belong to
encounter customization. None requires another special room identity.

The shared foundation for Eris and reward-store unlocks is actual cumulative
meta-resource gains, not merely pickup counts or held inventory. Model normal
and large pickup amounts, applicable Buried Treasure multiplication/native
rounding and Double Up acquisitions, and Eris's fixed non-duplicating gifts.
Requirements then consume those totals, including the later-biome small/large
MetaProgress transition. Do not assume the higher thresholds unreachable or
defer the reward-family decision to the executor.

## Agreed reward and shop classification

The inventories above record the source facts. Their implementation roots
must distinguish permanent exclusions from eligibility that changes during
the attempt. Membership in the five-god Fresh File domain does not establish
when a god can first appear, nor whether a shop can offer that god.

### Static profile exclusions

Encode proven unreachable families as declaration-owned Fresh File
restrictions, consumed by the common eligibility path. These include hammers, Zeus
and the other excluded Olympians, Hermes, Selene/Path of Stars, Mystery Boons,
Devotion, and infusions. Ordinary Nectar remains unavailable, but its Fields
optional entry does not inherit that exclusion. Shop Armor is unavailable
without Arachne, but optional Fields Armor remains available. Dream-only
elements and the locked Tartarus resource group do not acquire substitute
items merely because their candidates are absent.

These exclusions need profile-aware catalog consumption, not a simulated
unlock process. Hammer ineligibility is settled, not an outstanding probe.

### Within-run unlocks and source-sensitive history

| Rule family                                  | Required fact and transition                                                                                                                                                                                     | Disposition                                                                                                                                                                                                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| God introductions and order                  | Start with the closed first-run history; resolve the forced Apollo acquisition and subsequent first-god eligibility/introductions. Poseidon/Demeter are potentially available, unlike permanently excluded Zeus. | Finish a per-god matrix of initial eligibility, unlocking event, forced-introduction precedence, and later eligibility before implementation. The five-god whitelist alone is insufficient; do not assume the mature candidate machinery already handles introduction ordering. |
| Hestia/Aphrodite unlock                      | Neither qualifying god used → Poseidon or Demeter used. Native requirements read use history, not merely an offered reward or an equipped trait.                                                                 | Catalog declares the condition; chronological engine history supplies the reached fact to later reward generation.                                                                                                                                                              |
| World-shop god selection                     | Previously unmet god → qualifying pickup enters lifetime loot history. In Fresh File, that history starts empty and accumulates only during this attempt.                                                        | Normal/boosted shop candidates intersect ordinary eligibility with reached pickup history at inventory generation, retaining the native empty-intersection fallback described above. This is distinct from room-reward god eligibility and current equipped traits.             |
| MetaProgress Bones                           | Zero Ashes gained → at least five cumulative Ashes gained.                                                                                                                                                       | Add actual resource-gain accounting and a declaration-owned threshold consumer. Do not gate shop or Fields optional Bones through this room-bag rule.                                                                                                                           |
| Later-biome small/large MetaProgress entries | Small entries remain eligible until both 100 Ashes and 500 Bones have been gained; then large entries become eligible under their ordinal conditions.                                                            | Evaluate totals at generation using the declared entries and bag semantics. Preserve separate small/large bag copies; this is not an executor-only cosmetic variant substitution.                                                                                               |
| First-pickup records used by requirements    | No record → the qualifying first interaction occurs.                                                                                                                                                             | Close each relevant source condition, then derive only the bounded semantic facts needed by consumers. Do not introduce a general dialogue-history simulator.                                                                                                                   |

The engine's existing chronological state is the carrier, not a second Fresh
File simulation. Reuse existing acquisition/use history where it represents
the exact native fact; add missing facts and consumers where it does not.
Offered, used, acquired, currently equipped, and introduced are not
interchangeable. The implementation plan must pin each producer, observation
point, and consumer rather than classify this entire group as catalog-only.

### Existing behavior to reuse

Health, Magick, Gold, ordinary Pom eligibility, ordinal-dependent shop groups,
bag consumption/refill, duplicate exclusion, and the ordinary god cap retain
their existing semantics unless a specific source discrepancy is established.
Poms becoming eligible after an upgradable boon are dynamic, but do not need
new Fresh File machinery. Static and dynamic restrictions filter the relevant
source's candidates; they do not replace its ordinary rules.

This is the investigation-level foundation for the future reward/shop plan,
not a claim that the full god-order matrix or implementation seams are closed.

## Encounter research and deferred customization shape

Delivery scope is narrowed as described in the overview and encounter outline:
only deterministic encounter identity resolution belongs to the first delivery.
The detailed customization design below is retained for the later encounter
work, not a requirement to expose Fresh File authoring.

Fresh File needs introduction-aware encounter resolution, not a blanket
scripted replacement for ordinary combat. Restrict the inventory to encounters
reachable through legal F/G/H/I rooms and their actual enemy pools.

### Introduction profiles

| Placement                  | Identity                                                          | Native wave shape                                                                                  |
| -------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| F opening                  | Existing `OpeningEmpty`                                           | No combat.                                                                                         |
| Forced `F_Combat01`        | `FIntroFight`                                                     | Four fixed waves.                                                                                  |
| Eligible ordinary F combat | `RadiatorIntro`, `ScreamerIntro`                                  | Fixed first wave, generated second wave.                                                           |
| First G combat             | `FishmanIntro`                                                    | Three fixed waves.                                                                                 |
| Eligible later G combat    | `FishSwarmerIntro`                                                | Fixed first wave, generated second wave.                                                           |
| Outside Fresh File         | `TurtleIntro`                                                     | Fixed first wave, two generated waves; Turtle requires two lifetime G_Intro entries.               |
| Eligible H cage encounters | `MournerIntro`, `LamiaIntro`, `LovesickIntro`, `LycanthropeIntro` | Three fixed waves each.                                                                            |
| First I combat             | `ClockworkIntro`                                                  | Three fixed waves; distinct from mature `GeneratedIChronosIntro` / `GeneratedI_SmallChronosIntro`. |

The [introduction resolution matrix](FRESH_FILE_ENEMY_INTRODUCTION_MATRIX.md)
owns the detailed history and competition audit. In particular, enemy-seen
history does not prove introduction completion, and TurtleIntro is not a
reachable Fresh File profile.

Do not import every declaration ending in Intro. Guard has no active
`GuardIntro` link; SiegeVine and WaterUnit links are commented out.
`VampireIntro` is outside the ordinary H pool and its miniboss skips intro
replacement. Surface introductions are outside this itinerary. Introduction
requirements still apply: notably Lycanthrope's introduction requires prior
Mourner, Lovesick, and Lamia introduction occurrences. An unfinished intro
alone does not establish that it replaces the encounter.

Sources: `EncounterData.lua` (`BaseIntroEncounter`, F introductions,
`FIntroFight`); `EncounterData_Intro.lua`; `EncounterData_Opening.lua:ClockworkIntro`;
`EnemySets.lua`; active `IntroEncounterName` fields in the enemy declarations;
`EncounterData_MiniBoss.lua` skip flags; `RunLogic.lua:SetupEncounter`.

### Authoring and resolution

Settled model: identity is chosen in the encounter selector (introduction
members gated on exact completion/occurrence facts); Customize edits only the
settled identity, with fixed waves read-only and unfinished-introduction types
excluded from the ordinary type domain. No preliminary popup or Continue step.

Sources: `RunLogic.lua:ChooseEncounter/SetupEncounter/GenerateEncounter`;
`RoomLogic.lua` target/cage encounter preparation; planner
`simulation/encounters/resolve.ts`, `preparation.ts`, and
`simulation/history/composition.ts`.

### Bounded fixed/mixed-wave extension

Current `GeneratedEncounterSelection.fixedEnemies` means a fixed seed inside
a generated wave, not a complete fixed wave. The catalog compiler allows at
most one such seed and only a single-wave profile. Engine assessment currently
infers shared-highlight mode from multiple waves. Executor generated admission
rejects pre-existing `SpawnWaves`. Consequently the mixed F/G introductions
cannot be added faithfully through declarations alone.

Extend the supported profile to distinguish declaration-owned fixed waves
from generated waves, and express generation mode explicitly rather than
inferring a shared highlight from wave count. Fixed waves have read-only
rosters/counts. Generated portions reuse existing budget/count mathematics
with their native wave shares, declared seeds, and eligibility; fixed prefix
waves must not cause the remaining shares to be renormalized. The editor
renders that distinction from assessment. Export/runtime support preserves
native fixed waves and installs only authored generated portions.

Fully fixed introductions can use resolved encounter identity and native
execution without routing through the generated installer. Do not copy their
fixed counts into authored state merely to make them look customized.

Code evidence: `catalog-schema/encounter-generation.ts`;
`hades2-catalog/src/compiler/encounters/generation.ts` fixed-seed constraints;
`simulation/encounters/generation.ts` shared-highlight and fixed-seed handling;
`game-module/src/mods/room/timeline/encounters/generated.lua:installable`.
Native `GenerateEncounter` preserves pre-existing waves and fills only the
remaining templates, using the full encounter's wave-count budget pattern.

The two substantive additions are therefore contextual introduction resolution
and fixed/mixed-wave profile support across catalog, engine, application, and
executor. This is a bounded extension, not a second encounter engine. Exact
wire/schema consequences remain for the implementation plan and owner approval.

### Boss customization disposition

| Boss     | Fresh File policy                                                                                                                                                                      |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hecate   | Restrict the interlude to `HecateMeteorShower` (current planner label: Large meteors). Other choices require previous Hecate clears. The second transition reuses the first selection. |
| Scylla   | Jetty is fixed by the first-fight guarantee.                                                                                                                                           |
| Cerberus | Retain the normal non-Rival three howl and five burrow choices; no additional first-run restriction found in these contacts.                                                           |
| Chronos  | Retain the normal non-Rival three late-summon choices; no additional first-run restriction found in this contact.                                                                      |

These are profile-aware restrictions on existing boss customization, not new
boss identities. Mature explicit-choice progression overrides must not bypass
Fresh File's legal domain. Cerberus's stage-spawn path starts its intermission
directly, without `SetupEncounter`'s enemy-introduction substitution; do not
apply ordinary room intro resolution to those summons.

Sources: `EnemyAILogic.lua:HecateStageTransition1/2` and stage-spawn handling;
`WeaponData_Hecate.lua` interlude requirements;
`EncounterLogic.lua:ApplyScyllaFightSpotlight`;
`EnemyData_InfestedCerberus.lua`, `WeaponData_InfestedCerberus.lua`,
`EncounterData_Boss.lua:CerberusSpawns01..05`;
`WeaponData_Chronos.lua:ChronosDefense3/ChronosEliteSpawn1..3`.

## Current planner seams

- `declarations/routes.ts` and `authored-project/route-context.ts` already
  separate itinerary position from biome identity. A fixed Fresh File route
  can reuse F/G/H/I topology and ordinary completion links.
- `authored-project/defaults.ts` currently initializes a route-independent
  loadout. `createDefaultRouteLoadout` selects a catalog aspect and a mandatory
  default keepsake. Zero manually selected Arcana is not itself a declaration
  that all automatic Arcana are unavailable. Fresh File needs real fixed
  loadout semantics, not merely disabled controls.
- `simulation/evaluation/project.ts` currently makes a null starting reward a
  blocking finding whenever any biome is configured. Fresh File's empty
  opening requires an explicit no-starting-reward policy; moving Apollo early
  to satisfy this assumption would be incorrect.
- `SimulationState` is already the chronological fact carrier. Existing
  acquisition and encounter history can supply some first-run unlock facts;
  add only missing semantic facts with actual consumers. Do not replicate an
  unrestricted `GameState`, text-record interpreter, or profile editor.
- The mature catalog intentionally omits external progression gates
  (`CATALOG_MODEL.md`). A new closed profile changes this boundary deliberately;
  it does not make every omitted profile predicate suddenly relevant.
- The generated-encounter catalog does not currently model the general native
  enemy-introduction replacement system. Intro identities and their reached
  completion history are the largest encounter addition. Do not treat all
  Fresh File fights as ordinary generated customization.
- Execution assembly/codecs explicitly accept Underworld/Surface/Dream.
  The executor decoder does likewise. Fresh File requires a deliberate wire
  decision, not a new live save-profile identification subsystem. The player
  selects the slot and existing encounter conformance handles incompatibility.
- The executor's generated installer already checks unfinished enemy intros
  (`game-module/src/mods/room/timeline/encounters/generated.lua`). Merely exporting normal
  generated encounters would risk declined customization or native replacement;
  resolved first-run identities must be understood upstream.

## Recommended bounded shape

Expose Underworld / Surface / Dream Dive / Fresh File as four creation choices.
Fresh File owns a fixed itinerary and closed initial progression profile.
Reuse room declarations, semantic commands, history and reward settlement.
Catalog declarations own first-run availability and variants; engine evaluation
owns changes to the small set of first-run facts. UI renders the resulting
restricted loadout and candidates rather than implementing restrictions.

Distinguish three kinds of fact:

1. Permanently absent during this run: unlocked incantations, prior completed
   runs, equipment upgrades and similar fixed initial conditions.
2. Derivable during this run: gods used, introductions completed, resource
   acquisitions relevant to reward-store eligibility.
3. Actual gameplay conditions outside the simulator: notably Eris's health
   threshold, supplied by the agreed bounded intro checkbox. Derive her
   resource gift and retain the occurrence/curse fact that prevents another
   intro gift. Her curse increases damage taken; do not simulate that damage
   or health. The planner's relevant consequence is meta-resource progression.

The executor should support running a plan on an actual first-run save, not
rewrite a mature save into a fresh one. A replay/reset utility is a separate
feature, not implied by this project type.

There is no new save-profile identification or verification subsystem. The
player selects the published slot. Existing encounter enforcement/conformance
handles an incompatible opening: if the intended noncombat `F_Opening01`
encounter cannot be realized, desync. Passing that contact is not a claim that
the executor has certified every aspect of the save's progression.

Before a delivery plan, finish the remaining probes above and pin the shared
contracts; do not turn settled decisions back into open-ended investigations.
Boss presentation details can stay native where they have no planner semantic
consumer. Schema/protocol work needs its own explicit compatibility decision;
this investigation grants no bump approval.

## Assessment

The feature is practical and fits a separate creation choice. Its unifying
model is one closed initial state with bounded progression during the attempt,
not arbitrary save-state support and not a parallel Fresh File simulator.

| Area            | Agreed overall shape                                                                                   | Main additional responsibility                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Loadout         | Fixed aspect-less staff, no weapon/aspect selection, zero Arcana/Fear, no keepsake or starting reward. | Represent absence honestly without placeholder mature selections.                           |
| Rooms           | Reuse Underworld topology and filter unavailable candidates.                                           | Fixed opening → F_Combat01, bridge Shop instead of Echo, conditional Eris resources.        |
| Rewards / shops | Separate permanent exclusions, existing eligibility, and within-run unlocks.                           | Actual resource gains plus source-correct god/use/pickup history at generation.             |
| Encounters      | Mandatory complete generated authoring, automatic fixed content, contextual introductions.             | Introduction resolution and fixed/mixed-wave profile support.                               |
| Bosses          | Restrict Hecate/Scylla; preserve normal Cerberus/Chronos choices.                                      | Profile-aware choice domains, not duplicate boss identities.                                |
| Executor        | Install the resolved plan and use existing diagnostics/conformance.                                    | Support the new encounter shapes; no save detection, resetting, or progression fabrication. |

Encounters are the largest technical risk and mandatory composition is the
largest authoring cost. Fixed content must not become busywork. The explicit
intro switch should explain the consequence early enough that users do not
finish a composition only to discover its replacement; exact picker
presentation remains for the plan. Eligibility and the replacement decision
remain engine-owned regardless of presentation.

Keep the resource model bounded to gains with real eligibility consumers, and
keep source-local exclusions local. A missing shop Armor unlock must not ban
Fields optional Armor; a room-bag Bones threshold must not constrain shop
Bones. No full health, damage, economy, or dialogue simulation follows from
this feature. Most restrictions simplify the authoring domain; the new work
is concentrated in chronological unlocks and introduction profiles.
