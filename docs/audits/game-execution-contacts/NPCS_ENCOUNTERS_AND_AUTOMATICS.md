# NPCs, encounters, and automatic outcomes

## Source index

- NPC menus: `Scripts/EventLogic.lua:906-1230`
- Encounter selection: `Scripts/RunLogic.lua:1022-1110`
- Multi-encounter assembly and lifecycle: `Scripts/RoomLogic.lua` functions
  `SetupRoomMultipleEncountersData`, `StartEncounter`, and
  `EndEncounterEffects`
- Boss Arcana activation: `Scripts/MetaUpgradeLogic.lua:499-560`
- Embryo and keepsake grants: `Scripts/PowersLogic.lua:4840-4910`
- Catalog encounter declarations:
  `packages/hades2-catalog/src/declarations/encounters/`
- Current native contacts: `src/mods/room/timeline/encounters/hooks.lua`,
  and focused acquisition adapters beneath
  `src/mods/room/timeline/acquisitions/` in the Run Planner game module

## Trait-menu carriers

NPC identity is not enough to identify a native trait-offer contact. Some NPCs
use ordinary loot; others build bespoke menus before the generic selection
function is reached.

| Provider                         | Native offer contact                          | Current status                                                                                                                                         |
| -------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Arachne                          | `ArachneCostumeChoice`                        | Covered by the focused NPC acquisition adapter.                                                                                                        |
| Narcissus                        | `NarcissusBenefitChoice`                      | Covered for the menu, native generated children, and Mystery Boon handoff.                                                                             |
| Medea                            | `MedeaCurseChoice`                            | Menu and native selected effects are covered; complete Surface live proof remains pending.                                                             |
| Circe                            | `CirceBlessingChoice`                         | Menu and exact Arcana/Fear consequences are covered; complete Surface live proof remains pending.                                                      |
| Icarus                           | `IcarusBenefitChoice`                         | Menu and Latest Model target are covered; deterministic levels and Supply Chain production remain native; complete Surface live proof remains pending. |
| Echo                             | `EchoChoice`                                  | Menu, nested Boon replay, and Pom target are covered; other consequences remain native or hand off to their ordinary consumer.                         |
| Artemis, Athena, Hades, Dionysus | Ordinary loot or encounter-owned trait source | Covered only through the ordinary loot carrier reached by the encounter.                                                                               |

The six bespoke contacts are defined in `Scripts/EventLogic.lua`. Their explicit
adapters are intentional; a single `UseLoot` hook does not cover these menus.
The native NPC source remains the stable owner through menu construction and
selection. Trait-owned generated pickups remain separate acquisitions claimed
at their own accepted interaction; the executor neither recreates the drop nor
requires source-trait provenance. Coverage of a dormant contact does not claim
that its route navigation is enabled.

The published rows are inserted before the named NPC function so native
option-specific preparation sees them (notably Circe's familiar data). Native
requirements, priority selection, and preparation remain native; the executor
does not run its own eligibility preflight. It retains the native row metadata
and requires the published keys to exist in that construction input. The menu
contact reapplies the same rows after native ordering, preserving prepared
metadata rather than rebuilding the NPC's effects.

For Circe promotion, native `CirceMetaUpgradeRarity` selects cards and invokes
their upgrade callbacks; copying final rarity fields would omit those effects.
For Vow removal, `CirceRemoveShrineUpgrades` owns disable callbacks and value
extraction. The executor selects their keys only. Ordered Arcana draws use
native `AddRandomMetaUpgrades` admission/card selectors, preserving native
activation and dependent eligibility rather than replaying it in Lua.

Icarus Latest Model selects the old Hammer in `UpgradeHammers`, before its
inner rarity call. Native code uses that same selected trait for later weapon
setup, so merely overriding the inner `ForceUpgrade` argument would be too
late. Echo's Pom target similarly steers `EchoDoubleLevelBoon`'s native
candidate selection; native calculates and applies the level increase.

## Nemesis random events

Nemesis uses a distinct event family rather than a trait provider menu.

| Planner outcome                     | Game contact                                                                              | Status                                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Choose event family                 | `SpawnNemesisForRandomEvents` and `CheckAvailableTextLines`                               | Covered.                                                                              |
| Free item                           | `NPCRewardDropPreProcess`, `NPCRewardDropPreProcessArgs`, `NPCRewardDrop`                 | Covered for the exact authored consumable identity.                                   |
| Gold/damage trade accept or decline | `NemesisTradeChoice`                                                                      | Covered; price and damage amounts are simulation-neutral.                             |
| Trait trade                         | `NemesisTradeChoice` → native `GenerateSellTraitShop` / `SellOptions` → `TradeDoExchange` | Exact offer target; screen-bound exchange terminal, native response/removal retained. |
| Damage contest                      | `StartNemesisDamageContest` → `NemesisDamageContestTimer`                                 | Source-bound start/completion; native contest retained.                               |

Door theft and shop theft retain their documented planner simplifications and
are not Timeline obligations. See the Nemesis disposition in the room/route
audits.

Native `NemesisGiveTraitForItemChoices` supplies `{ SellTrait = true }`, not a
trait-named give option. `OpenTradeScreen` requests one common-prioritized sale
candidate from `GenerateSellTraitShop` before rendering `SellOptions`. The
executor selects the published trait from native `SellValues` or the already
selected `SellOptions`, retaining native sale metadata; it does not replace the
give descriptor or perform the exchange. Purging Pool inventory steering must
not run for that single-trait trade request. A one-shot trade context is consumed
at generation, not retained through player menu input to identify the offer.

### Native event boundaries

Spawn-time text selection prepares the family without beginning the interaction.
`EventLogic.lua:NemesisTradeChoice` opens the native choice and, on acceptance,
sets `TradeDoExchange` on the outer dialog screen's close callback.
`NarrativeLogic.lua:PlayTextLines` and `UILogic.lua:OnScreenCloseFinished`
forward that same screen. Accepted trait exchanges therefore retain only the
screen-bound transaction until `TradeDoExchange` returns. The executor does
not observe a global next trait removal or verify the removal in that callback;
native exchange and room-exit trait conformance own those responsibilities.

`InteractLogic.lua:NPCRewardDropPreProcess` synchronously prepares reward
arguments without yielding. Its source context is needed only during that
preparation. The later `NPCRewardDrop` begins the exact source's free-item
interaction and completes it on return. Contest participation instead begins
at `EventLogic.lua:StartNemesisDamageContest`; its source identifies the later
`NemesisDamageContestTimer` completion. Native countdown, response and reward
application remain unchanged.

## Encounter realization

### Ship wheel selection

`RoomLogic.lua:ShipsEncounterSetup` constructs reward previews, then waits for
`ShipsEncounterSelected`. Its generation-only steering context ends after the
last required preview; the native wheel retains its published wheel/offer
identity. `UseShipWheel` is the accepted contact: rejection occurs in the
earlier directional use functions. It sets the reward and notifies waiters,
which `Main.lua:notifyExistingWaiters` resumes immediately. The executor must
resolve the stamped wheel in the current occurrence and publish its accepted
choice and reward context before native notification can resume the encounter.
It cannot retrieve that information from a setup scope after native use returns.

### Encounter phases

The planner publishes ordered encounter phases in each occurrence Overview.
The game exposes single and multi-phase selection through `ChooseEncounter` and
`SetupRoomMultipleEncountersData`. `EndEncounterEffects` identifies the
encounter-end lifecycle window. Boss defeat is observed at `Kill` only to open
the declared boss-defeated window.

| Encounter family                                                                                               | Status                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F/G Combat, Miniboss, Story, Shop, Boss                                                                        | Covered through exact room and encounter declarations.                                                                                                         |
| Chaos                                                                                                          | Covered for room/encounter and its trait-pair acquisition.                                                                                                     |
| G Anomaly                                                                                                      | Covered as a real one-exit Anomaly occurrence, not a hidden return.                                                                                            |
| Zagreus Contract                                                                                               | Covered as an additional exit and encounter occurrence.                                                                                                        |
| Devotion                                                                                                       | Covered where its chosen/spurned acquisitions are published.                                                                                                   |
| P PreCombat plus room-ending encounter, H bonus encounter, N side rooms, O wheels, I goals, Q structured rooms | Covered through the generic phase adapter, Ephyra and ShipCombat adapters, and ordinary resolved I/Q room products; complete-route live proof remains pending. |

General enemy composition, wave counts, and Fear-modified enemy generation are
not authored execution facts. The bounded Boss decisions below select existing
native behaviors, not independently authored enemy waves.

### Native encounter and phase identity

`ChooseEncounter` passes the selected declaration to `SetupEncounter`, which
returns a deep-copied native encounter table. For a multiple-encounter room,
`SetupRoomMultipleEncountersData` repeats that operation for every reached
position and stores the returned tables in order in `room.Encounters`.
`StartEncounter` and `EndEncounterEffects` later receive those same native
tables.

The selected encounter declaration remains an enforceable planner outcome. It
is steered at `ChooseEncounter` before `SetupEncounter` constructs the native
table; the returned table is then bound to the corresponding published phase.
Selection steering and phase binding are separate contacts.

Consequently, an encounter name is a declaration identity, not a selected
phase identity. Two phases may legitimately contain separate native tables
with the same `Name`. The execution boundary can bind each returned table to
its published phase when the encounter is chosen or assembled and recover that
phase from table identity at later lifecycle contacts. Searching for the first
phase with a matching encounter name is not sound and is not used by the
executor.

Phase identity also does not identify a Timeline transaction. One phase may
own an encounter interaction and one or more effect-qualified automatic
outcomes at the same time. Encounter start and encounter end open and close
the phase's native lifecycle; transactions within that phase remain distinct
by their complete semantic contact. A bare phase key therefore cannot be a
unique transaction index.

This identity model serves both fixed routes, including H cage encounters and O
multi-phase rooms, without a second encounter cursor or a different
phase-binding scheme.

### Boss decisions

Room and encounter identity are distinct. `RoomDataI.lua` and `RoomDataP.lua`
retain `I_Boss01` and `P_Boss01` for both variants; `EncounterData_Boss.lua`
gates their concrete definitions through `BossDifficultyActive`, interpreted by
`ShrineLogic.lua:IsBossDifficultyShrineUpgradeActive`. Configured Rivals rank 4
selects `BossChronos02`; rank 3 or higher selects `BossPrometheus02`. Lower ranks
select the corresponding `01` encounter. The planner resolves this before
publication, through the same route-position rule as physical Boss-map selection.

| Decision                  | Native domain                                                                       | Selection and application evidence                                                                                                                                                                                            | Planner disposition                                                                                                                                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hecate interlude          | Six patterns; corresponding `_EM` variants in Rival                                 | `EnemyAILogic.lua:HecateStageTransition1` appends and remembers the selected weapon; transition two reuses `MidPhaseWeapon`. `WeaponData_Hecate.lua` declares prior-clear restrictions rechecked by `IsEnemyWeaponEligible`.  | One choice serves both transitions. Explicit selection replaces the remembered/appended result and omits only that selected weapon's top-level progression requirements at eligibility. Polymorph and other eligibility remain native.    |
| Scylla featured performer | Scylla, Roxy (`Drummer`), Jetty (`Keytarist`); Rival adds Charybdis                 | `EncounterLogic.lua:ApplyScyllaFightSpotlight` draws a flag, then first-fight branches force Jetty or Charybdis. `EnemyData_Scylla.lua` declares the flags and effects.                                                       | A private flag input maps both deterministic branch keys to the selected performer. Native code applies music, presentation and effects once.                                                                                             |
| Cerberus howl             | Small, medium or large corrupted shades; corresponding elite variants in Rival      | `WeaponData_InfestedCerberus.lua:InfestedCerberusHowlSummonSelector` chooses a `SpawnBurstOnFire` weapon, requiring 12 attacks and allowing one use. The second-phase howl is commented out of active weapon lists.           | Narrow the first selector's resolved weapon-data pool; retain readiness, use limits and spawning. No second-phase choice.                                                                                                                 |
| Cerberus burrow           | `CerberusSpawns01..05`; Rival `CerberusEMSpawns01..04`                              | `EnemyData_InfestedCerberus.lua` supplies stage `RandomSpawnEncounter`; `EnemyAILogic.lua:StagedAI` applies Rival stage overrides and spawns before `CerberusStageExit`. The Rival list repeats `04` and omits declared `05`. | Copy the enemy's burrow stage before `StagedAI`, supplying the selected encounter to both normal and Rival inputs. Default preserves native weighting. Native thresholds (50% normal, 65% Rival), timeouts and re-entry remain unchanged. |
| Eris early summons        | Normal `ErisSummon01/02`; Rival Harpy, Swab, Jellyfish, Turtle                      | `WeaponData_Eris.lua:ErisSummonSelector` / `ErisEMSummonSelector` own the pools.                                                                                                                                              | Each decision accepts zero, one or two distinct choices in actual-use order; the remaining tail stays native.                                                                                                                             |
| Eris late summons         | Normal `ErisSummon03/04`; Rival FishmanRanged, FishmanMelee, FishSwarmer, Automaton | `WeaponData_Eris.lua:ErisSummonSelector2` / `ErisEMSummonSelector2` own the pools. Rival grenade chains reach these same selectors.                                                                                           | Apply the same prefix contract. Do not choose the Automaton's inner `SpawnerOptions`.                                                                                                                                                     |

Explicit Hecate/Scylla choices intentionally override those save-progression
selection restrictions; Default preserves them. No save clear count is edited.
All decisions are conditional on native gameplay reaching the move. Fast
combat may skip an optional howl or summon without creating an unmet obligation.

`EnemyAILogic.lua:GetWeaponAIData` resolves conditional inputs before
`DoAttackerAILoop` selects a chained weapon. Cerberus/Eris narrow only that local
result. Eris selectors allow two uses and each concrete variant one; native
`WeaponHistory` is the use authority. The getter runs before the current weapon
is appended, so prefix position counts only recorded concrete variants from the
full native selector pool, never selector/grenade entries or getter calls.

Preplaced Boss units do not own an `Encounter` field. These contacts use the
current native room encounter's existing phase binding. Burrow subencounters
do not replace that outer identity. The adapters need no thread-spanning scope:
Hecate retains its native remembered weapon, Scylla receives private arguments,
burrow receives enemy-local stages before native AI, and chained selectors
receive local resolved weapon data. Shared declarations remain unchanged.

## Closed automatic transaction union

| Effect              | Planner trigger                     | Native contact                                                     | Status   |
| ------------------- | ----------------------------------- | ------------------------------------------------------------------ | -------- |
| Steady Growth       | reached encounter interval          | `AddRarityToTraits` during the published encounter-end window      | Covered. |
| Transcendent Embryo | reached eight-encounter replacement | `AddRandomChaosBlessing` during the published encounter-end window | Covered. |
| Judgment            | boss defeated                       | `AddRandomMetaUpgrades`                                            | Covered. |
| Crystal Figurine    | boss defeated                       | `AddRandomMetaUpgrades` with the Figurine rarity contract          | Covered. |

Judgment and Crystal Figurine are authored as result sets. The planner's
execution projection orders a selected companion before The Fates when both
belong to the set, matching the native loop's per-card equipped-state update.
The boss adapter also admits Eternity's positive `RandomDrawChance` branch only
when Eternity belongs to the exact published result. Native code still owns the
activation loop and all state mutation.

This is the entire `automatic` union. Natural Selection and All Together are
nested selected-trait consequences, Ransoms are native-authoritative, and
Circe, Icarus, and Echo resolve through their NPC acquisition contacts; none is
an automatic member.

## Live-witness gaps

The executor has unit coverage for all four automatic shapes, but byte-product
fixtures should not be mistaken for complete native contact evidence. Current
fixture coverage is strongest for F/G room flow, ordinary offers, Chaos, Wells,
and shops. Concave Stone's second offer and later-biome NPCs remain useful
bounded live probes even though their adapters have focused unit coverage.
Encounter closure additionally needs focused witnesses for
two native encounter tables sharing one declaration name and for two different
transaction contacts sharing one phase.
