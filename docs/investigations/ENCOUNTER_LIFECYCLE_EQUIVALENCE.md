# Executor encounter lifecycle compatibility audit

Inspected 2026-09-28 against installed native scripts, current catalog and
executor. Investigation only: no production changes or live-game verification.
Native source root: `/home/ayyatma/wsl-projects/modding/1GameData/Scripts`.

## Conclusion and settled scope

An executor-only property check is viable. Compare requested and actual native
encounter lifecycle policies in the same room/phase role. Compatible different
names bind and log; incompatible cases retain existing mismatch behavior.
No planner equivalence matrix, authored change or protocol expansion is justified
by the inspected paths.

This is NOT complete encounter equivalence. Trait givers, acquisitions and NPC
outcomes remain with existing conformance. Selection requirements, identity
history, rosters, budgets and presentation are outside this comparator. Native
records actual history. Customization admission remains separate: lifecycle
compatibility does not authorize installing a different variant's composition.

## Native property/consumer inventory

| Policy               | Native properties                                                                                | Consumer and consequence                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Depth                | `CountsForRoomEncounterDepth`                                                                    | `RoomLogic.StartEncounter`: room, biome and run encounter depth advance together.                                                                                         |
| Ordinary end effects | NonCombat predicate, `SkipEndEncounterEffects`                                                   | `EndEncounterEffects` early return controls automatic callbacks and encounter-use consumption. Compare effective enabled/disabled policy, not all encounter-type strings. |
| Boss effects         | Boss predicate, `SkipBossTraits`                                                                 | Start/end effects and boss pre-damage distinguish boss-specific uses/effects independently of depth.                                                                      |
| Spawn-dependent uses | `BlockSpawnMultipliers`                                                                          | `EndEncounterEffects` additionally gates traits declaring `UsesRequireSpawnMultiplier`.                                                                                   |
| Fig Leaf             | `CanEncounterSkip`, `CanEncounterSkipIfNotFirst`, `BlockDionysusEncounterKeepsake`               | `EncounterLogic.HandleEncounterPreSpawns`, `HandleEnemySpawns`, `CanDionysusSkip`: positive support and envelope-wide blockers are distinct.                              |
| Skip propagation     | `PreSpawnEnemies` with `SkipEndEncounterEffects` in multi-encounter context                      | Successful pre-spawn skip marks the remaining array skipped. Compare this conjunction, not prespawning in isolation.                                                      |
| Gorgon               | `BlockAthenaEncounterKeepsake`, `CheckAthenaEncounterKeepsakeOnSkipEncounterStart`, start policy | `HandleAthenaSpawn` and `StartEncounter` distinguish ordinary and suppressed-start checks.                                                                                |
| Start effects        | `SkipEncounterStart`, `ForceEncounterStart`, `DelayedStart`, NonCombat role, start callback      | `StartEncounter`/`StartEncounterEffects`: delayed start can still execute all start effects through an event.                                                             |
| Envelope termination | `BlockMultipleEncounters`                                                                        | `SetupRoomMultipleEncountersData` stops phase assembly. Structural count proof remains necessary.                                                                         |

Normalize truthiness as native does: nil versus false is not a discrepancy.
Compare meaningful derived policies when another gate masks a flag. Never
deep-compare the whole native encounter table.

### Delivery and automatic clocks

`TraitData.StorePendingDeliveryItem` declares `UsesAsEncounters = true`.
Its clock is the ordinary decrement in `RoomLogic.EndEncounterEffects`, not depth.
Room `IgnoreEncounterUses`, `SkipRoomsPerUpgrade`, and current/challenge/override
carrier role affect end behavior. These are shared room/role context for the two
candidates, not a planner-exported encounter matrix.

Existing automatic outcome hooks use bound phases. Maintaining compatible native
start/end behavior keeps these hooks meaningful without revalidating traits.

## Non-scalar seam: start callbacks

`RoomLogic.BeginArachneEncounter`, `BeginArtemisEncounter`,
`BeginIcarusEncounter`, `BeginHeraclesEncounter`, `BeginNemesisEncounter`,
`BeginCrawlerEncounter` and `BeginPerfectClearEncounter` call
`StartEncounterEffects`. Heracles/Nemesis also invalidate checkpoints; that is
not a planner lifecycle counter.

`BeginAthenaEncounter` calls start effects only for a single-encounter room.
`ShipsEncounterSetup` reaches start effects after wheel selection. Therefore raw
`DelayedStart` equality is conservative, not full semantic equivalence; whole
event-array equality would incorrectly reject harmless presentation differences.

Recommendation: a small executor-owned classification of native start contacts
and role conditions, not an encounter-name-pair registry. Never execute setup or
callbacks speculatively. Unknown start paths are not proven compatible; retain
existing mismatch behavior for a differing-name case whose lifecycle cannot be
classified. This bounded contact classification is the remaining implementation
detail to pin, rather than a reason to export planner policy.

## Policy must not be confused with runtime progress

Use inherited native declarations for both identities, applying relevant
declarative context overrides symmetrically. Comparing the pristine planned
declaration against arbitrary live actual fields is incorrect:

- `HandleEncounterPreSpawns` changes `CanEncounterSkip` to false after a failed
  roll. That prevents rerolling; it is not a new lifecycle policy.
- `SetupRoomMultipleEncountersData` sets later phases' `SkipEncounterStart` and
  applies `CanEncounterSkipIfNotFirst` after `ChooseEncounter` returns. Selection
  and reload must use the same phase-role interpretation despite this timing.
- `SetupEncounter` applies Dream overrides, generation and setup callbacks,
  then may replace the encounter with an enemy introduction. Resolve relevant
  declarative overrides without replaying setup. Any callback modifying a
  compared policy needs a focused contact rule, not invented expected state.

`Completed`, `InProgress`, `StartTime`, `SpawnsSkipped`, generated waves and
remaining spawns are runtime progress, not declaration compatibility fields.

## Representative results

- O intro versus Heracles: incompatible. `GeneratedO_Intro01` does not count
  depth; `HeraclesCombatO` does. Fig Leaf support also differs. No NPC matrix is
  needed to establish this conflict.
- P precombat versus ordinary combat: depth/end-effect policies differ;
  precombat also carries whole-envelope Fig Leaf propagation.
- Generated combat versus ordinary enemy introductions: different rosters and
  seeds are irrelevant. GuardIntro/FishSwarmerIntro inherit biome generated
  declarations plus generation-oriented BaseIntroEncounter fields. Compare the
  inherited lifecycle policy, without requiring the planner to catalog every intro.
- NPC weighting variants: changed eligibility or suffix is not a mismatch reason.
  Match lifecycle properties; leave acquired traits to conformance.
- Empty versus presentation-only story: different names are insufficient to
  reject. Trait-bearing story outcomes also remain outside this comparator.
- Rival/miniboss variants: compare lifecycle policy, not exact names/types.
  Boss-choice/composition admission remains separately scoped.
- H cages/O wheels/P phases: preserve phase role, native carrier collection,
  order and cardinality. Property matching cannot flatten their topology.

## Executor integration and acceptance

`room/timeline/encounters/hooks.lua` has an exact-name gate after selection.
`encounters/phases.lua.prove` repeats name proof before binding reconstructed
room-entry objects. Both must consume one comparator.

Retain same-name acceptance, occurrence ownership, one phase per native object,
phase count/order and the distinction between modeled and unmodeled carriers.
Different-name acceptance should log both names; rejection should name the
conflicting lifecycle fact. Missing native declarations cannot prove compatibility.
Avoid repeated substitution logging solely because room-entry proof rebinds.

Primary witnesses: compatible different names; each policy conflict; nil/false;
trait outcomes excluded; customization independently declined; later-phase
overrides; consumed Fig Leaf state across reload; reconstructed object binding;
and phase-count/ownership rejection. Include a source-backed inherited-declaration
probe rather than relying solely on synthetic tables.

The audit establishes the relevant consumers and concrete mutation/callback
hazards. It does not certify arbitrary future setup callbacks or claim live tests.
The older noncombat identity audit's exact-name policy should be replaced when
delivery lands, preserving its source facts. No production behavior changed here.
