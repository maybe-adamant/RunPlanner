# Encounter rules and enemy eligibility audit

Status: the confirmed catalog corrections below are implemented with regression
coverage. Route identity and its candidate explanation are now wired through
encounter requirement evaluation. The NPC follow-up corrections are implemented.
Executor eligibility and generated-composition diagnostics are implemented without
changing enforcement or mismatch policy. This investigation remains open until
the encounter work and in-game verification are finalized.
Planner baseline: `ae69b672`. Source: local Hades II script snapshot inspected
2026-09-23. This investigation owns the correction inventory before a plan.

## Question and scope

Compare the current encounter declarations and generated enemy composition
policy with the game, across all biomes, rather than fixing Fields in isolation.
Separately establish whether the executor can bypass native enemy eligibility.

The declaration census contains 168 encounter identities, 39 generated
composition policies, and 114 distinct generated or fixed enemy identities.
All 168 identities resolve in native EncounterData. This is not an audit of
every combat AI, boss attack, scripted summon, or enemy quantity formula.

## Method and evidence

Loaded EncounterData, EnemyData, their per-feature declarations, EncounterSets,
and EnemySets in a temporary Lua probe. Resolved inheritance with the game's
`ProcessDataInheritance` and `DeepInheritData` from `RunData.lua`, rather than
assuming child requirements accumulate with parent requirements. The probe
preserves mixed Lua tables containing numeric predicates and named requirements.
Presentation-only dependencies were stubbed; this is a declaration comparison,
not a running-game test.

Compared the catalog's complete generated pools, wave bounds, type bounds and
caps, depth ramp/axis, escalation, highlight elite blocking, cross-wave blocking,
elite caps, group caps, enemy depth restrictions, elite flags, solo blocking,
counterpart exclusions, and once-per-run enemy blacklisting. Reviewed native
admission requirements and the engine/executor consumers separately.

Primary source owners:

- Native `RunLogic.lua`: `ChooseEncounter`, `SetupEncounter`,
  `GenerateEncounter`, `FillEnemyTypes`, `FillEnemyCounts`, `IsEnemyEligible`,
  and `IsEncounterEligible`.
- Native `EncounterData_Generated.lua`, per-biome encounter declarations,
  `EnemyData_Zombie.lua`, `EnemyData_ZombieAssassin.lua`,
  `EnemyData_Screamer.lua`, and `RequirementsData.lua`.
- Catalog `src/declarations/encounters/`, especially `h.ts`, `f.ts`, and
  `generated/enemies.ts` / `generated/policies.ts`.
- Engine `src/simulation/encounters/generation.ts`,
  `generation-preparation.ts`, `preparation.ts`, and `candidates.ts`.
- Executor `src/mods/room/timeline/encounters/generated.lua` and `hooks.lua`.

## Confirmed correction inventory

| Area                         | Native fact                                                                                                                                                | Current discrepancy                                                       | Disposition                                                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Fields Treant encounter      | `GeneratedH_Treant2` requires biome depth at least 4 and no previous occurrence of itself in this run                                                      | `h.ts` has neither requirement                                            | Add both encounter admission rules; do not merely filter the fixed enemy from customization                                                |
| Fields Screamer encounter    | `GeneratedH_Screamer2` has the same depth and self-occurrence restrictions                                                                                 | `h.ts` has neither requirement                                            | Same correction; its completed-introduction predicate remains a mature-save assumption                                                     |
| Armored enemy classification | `ZombieAssassin_Elite`, `ZombieCrewman_Elite`, and `ZombieOlympus_Elite` inherit their normal enemy, not native `Elite`, and have no native `IsElite` flag | Catalog pair construction marks all three as elite                        | Separate armor/name presentation from the native flag used for highlight blocking and elite caps; retain their explicit depth requirements |
| Nemesis random event         | `NemesisRandomEvent.GameStateRequirements` explicitly rejects `CurrentRun.IsDreamRun`                                                                      | Its catalog requirements and encounter candidate path lack this exclusion | Add route-mode admission restriction; this is not a profile-unlock assumption                                                              |
| Fixed Screamer exclusion     | `Screamer2.GeneratorData` contains its difficulty but no `BlockEnemyTypes`                                                                                 | Catalog fixed Screamer excludes `Screamer_Elite`                          | Remove unsupported declaration. Currently inert against the configured generated pool, but not a truthful native fact                      |

The three armored classification errors are overly restrictive: they can reject
native compositions or highlights by counting these enemies against an elite
limit. The H admission errors are overly permissive and can force a whole
encounter before the game would normally offer it.

## Matching data and bounded non-corrections

| Area                                                                                                     | Result / disposition                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All 39 generated enemy pools                                                                             | Unique native membership matches catalog membership                                                                                                                                                                                            |
| Wave bounds, ordinary type bounds/caps, ramps/axes, escalation, elite caps, cross-wave rules, group caps | Compared declarations match the inherited native data                                                                                                                                                                                          |
| Generated-choice depth requirements                                                                      | Native run-local depth predicates match catalog thresholds, including strict `> 1` normalized to minimum 2                                                                                                                                     |
| Solo blocking and enemy once-per-run flags                                                               | Compared declarations match                                                                                                                                                                                                                    |
| Counterpart exclusions                                                                                   | Match except the fixed Screamer entry above; Harpy normal/elite exclusions are present and correct                                                                                                                                             |
| P small/large encounter overlap                                                                          | Native `< 10` and `>= 9` deliberately overlap at depth 9; not a gap to close                                                                                                                                                                   |
| Dream encounter overrides                                                                                | Inspected generated policies change money drops and active-enemy caps, not the authored wave/type composition fields                                                                                                                           |
| Hard-encounter caps                                                                                      | Catalog records native overrides, but engine does not consume `hardCap`. The existing audit and current scripts provide no assignment activating `MakeHardEncounter`; do not invent reachable hard states or equate boon rarity with this flag |
| Introduction / previous-run predicates                                                                   | External mature-save assumptions, not new player-state inputs                                                                                                                                                                                  |
| NPC `02` variants                                                                                        | Native weighting/history alternatives intentionally represented by the supported encounter identity rather than additional user choices                                                                                                        |
| Boss Rivals and miniboss Shadow variants                                                                 | Resolved through room/encounter bindings; absence of duplicated local requirements alone is not a defect                                                                                                                                       |
| Athena after Gorgon consumption                                                                          | Candidate logic already consults consumed Gorgon state; not a missing predicate                                                                                                                                                                |
| Quantity, difficulty, perks, summons                                                                     | Remain native; exact roster guidance is not a promise that no other enemy can ever appear                                                                                                                                                      |

## Executor safety assessment

The generated adapter does not override `IsEnemyEligible`'s answer. Its scoped
`RemoveRandomValue` interception chooses an authored enemy only when that enemy
is already in the native eligible candidate array. An absent choice produces
`native-ineligible` diagnostics and falls back to the game's selection.
It does not append an enemy to that array or spawn a replacement itself.

However, “only adjusts weights” is too narrow: it also steers wave count,
generated type count, highlight/type selection, and allocation shares. Native
eligibility and native count/spawn machinery remain authoritative at those
contacts.

Encounter selection is a separate trust boundary. `hooks.lua` temporarily sets
`CurrentRun.ForceNextEncounterData`; native `ChooseEncounter` consumes that before
its ordinary eligibility pool. Thus an invalid planner encounter can still be
forced. The Fields special encounters carry their named Treant/Screamer as fixed
template spawns, so safe filtering of generated additions cannot repair missing
encounter admission rules. The correction belongs upstream in the planner.

## Room mapping and generation-context follow-up

Compared 264 catalog room declarations and 352 bound encounter slots against
inherited native RoomData. All room identities resolved. The comparison expands
native multi-encounter slots, Fields cage legal encounters, catalog sets and
reward-dependent definition alternatives. A raw set difference is not itself a
bug: inherited Devotion sets are unreachable in many room reward domains,
Rivals/route-entry overrides add contextual identities, and progression variants
are deliberately omitted.

| Boundary                  | Native contact                                                                                                                                                    | Planner contact / assessment                                                                                                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| H passive and cages       | `LeaveRoom` commits predecessor history, chooses the passive encounter, then chooses and records each cage encounter before map entry (`RoomLogic.lua:4376–4389`) | `prepareRoomEncounterPhases` walks envelope order; `projectEncounterRecordPreparation` carries records and known generation blacklists without advancing combat counters. Matches preparation semantics, not player cage-clear order |
| O ship sequence           | `SetupRoomMultipleEncountersData` chooses and records the sequence at transition; third slot tests pre-room encounter depth `>1` and `<6`                         | Intro/Combat1/Combat2 are prepared together; optional Combat2 requires depth 2–5. Starting Combat1 must not make Combat2 newly eligible or change its generation depth                                                               |
| P precombat and follow-up | Same setup loop; earlier records are visible to the next choice; `BlockMultipleEncounters` terminates the sequence                                                | Transient record prefix and `terminateSuffix` model this without a combat-counter increment. Indoor/Outdoor predicates remain definition-owned                                                                                       |
| Trial reward encounters   | `ChooseRoomReward`, `RewardLogic.lua:262`, sets up and records the Trial at reward generation                                                                     | Generated policy selects the captured reward-generation checkpoint rather than later entry state                                                                                                                                     |
| Counter advancement       | Native `StartEncounter`, `RoomLogic.lua:1902`, advances encounter depth after all these choices                                                                   | Preparation projection does not apply start/completion effects; lifecycle execution owns advancement                                                                                                                                 |

No new misplaced encounter binding or generation-depth discrepancy was established
in this pass. Raw differences resolve to the existing intentional exclusions:
first-time/tutorial encounters, NPC weighting variants, Tartarus progression
variants, specialized `GeneratedP_PreCombatChronosForces`, and H Bridge's
unmodeled Shop/Nemesis alternatives. F Postboss uses the supported empty
presentation rather than progression-only Chronos story. These are scope limits,
not evidence that the supported default identity is mapped to the wrong room.

The follow-up did expose an integration omission in the catalog correction:
`routeKeyEquals` already existed, but encounter preparation omitted `routeKey`
from its requirement context and its evidence union could not explain that
predicate. Catalog normalization tests did not exercise these consumers. The
context, evidence and picker explanation now carry that existing fact; no new
eligibility policy or schema is introduced. Focused engine/catalog checks:
58 passed after the correction. The picker has a route-exclusion witness too.

## NPC admission follow-up

Audited the supported Artemis F/G/N, Arachne F/G, Nemesis combat F/G/H/I
and random event, Heracles N/O/P, Icarus O/P, and Athena P identities,
including inherited named requirements in `RequirementsData.lua`.

| Rule family                                              | Disposition                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Depth, incoming reward exclusions, P Indoor/Outdoor tags | Supported primary declarations match the native predicates                                                                                                                                                                                                                                                          |
| Artemis/Athena interaction-use guards                    | Planner uses encounter occurrence as the cooperative once-per-run proxy; it does not model abandoning the NPC interaction and later meeting that NPC again                                                                                                                                                          |
| Icarus occurrence/use guards                             | Supported identities are route-once; same-room earlier records exclude a later Icarus slot                                                                                                                                                                                                                          |
| Heracles completed-encounter guard                       | Route-once occurrence is the existing supported proxy. Its separate 20-room family spacing is redundant once a supported occurrence is recorded                                                                                                                                                                     |
| Nemesis family guard                                     | Existing route-once rule intentionally subsumes the 99-room history lookback and biome-local random-event exclusions                                                                                                                                                                                                |
| Shared field-NPC spacing                                 | Declaration membership matches the supported primary identities, but the history-window interpretation has the concrete discrepancy below                                                                                                                                                                           |
| Arachne                                                  | Biome-local cap is appropriate; G inherits the five-entry history predicate. F replaces its parent requirement table and does not inherit that predicate                                                                                                                                                            |
| Nemesis/Heracles Shop appearances                        | Native callbacks set encounter flags; named requirements reject recent flags over 12/10 entries. The planner derives suppression for prior Shops inside a planned NPC's exact preparation window; shopping outcomes remain native outside that protection. Both shopping events are natively excluded in Dream runs |
| NPC introductions, prior-run visits/dialogue, plot locks | Mature-save/story-progression exclusions remain intentional. Includes HecateMissing, SurfaceRouteLockedByTyphonKill, NemesisBecomingCloserAvailable, and Heracles's prior-run Prometheus dialogue restriction                                                                                                       |
| StandardPackageBountyActive / ActiveBounty               | Bounty runs are outside supported project modes; not a missing ordinary/Dream player-state input                                                                                                                                                                                                                    |
| Echo MutePermanent                                       | Explicitly accepted as out of scope by the owner: one special story event suppressing NPC interaction, not a new planner live-state condition                                                                                                                                                                       |

### Confirmed history-window discrepancy

`LeaveRoom` appends the departing room to `RoomHistory` at
`RoomLogic.lua:4373`, prepares the target encounters, and only then replaces
`CurrentRun.CurrentRoom` at line 4392. `RequirementsLogic.lua:328–338` reads
`CurrentRoom` at `roomsBack == 0`, then the last `RoomHistory` entry at
`roomsBack == 1`. At this contact those are the same departing room.

For a six-entry predicate and predecessor history `[A, B, C, D, E, F]`, native
evaluation visits `[F, F, E, D, C, B]`, whereas the planner checks six distinct
predecessors `[A, B, C, D, E, F]`. An NPC in A is therefore rejected by the
planner although native preparation permits it. This is an overly restrictive
boundary interpretation, not a catalog number typo.

The observable correction applies to the shared field-NPC cooldown and Arachne
G's five-entry cooldown. The Heracles 20-entry discrepancy is masked by the
existing route-once model. Do not globally subtract one from every history
window: contacts such as an in-room Shop event have not yet appended the current
room and do not have this duplication. Correct the encounter-preparation
interpretation with explicit boundary witnesses. Existing tests currently
encode the distinct-room interpretation and must change alongside it.

F Arachne's extra five-room predicate is also unsupported by inheritance:
`EncounterData_Arachne.lua:213` replaces the parent table without `Append`.
Remove that copied restriction for declaration fidelity, keeping the depth
4–8 and biome-local cap. This pass has not established a reachable authored
route on which the extra restriction changes the outcome; do not overstate it
as a demonstrated gameplay failure.

### Shopping scope boundary

Shopping flags are real run-local facts, not save-progression assumptions.
Native encounter admission can reject the planned NPC after an incidental Shop
appearance. The accepted protection derives the exact preparation window and
suppresses only the corresponding earlier shopping callbacks, before native
flag writes. It does not author shopping outcomes, add shopping history to the
simulation, or introduce a mismatch check. Source facts and the current bounded
disposition live in the encounter selection audit.

## Closure disposition

The requested NPC rule inventory is now dispositioned. The preparation-time
history-window boundary and copied F Arachne spacing predicate are corrected,
with five/six-entry boundary witnesses and catalog declaration coverage. Their
source facts are integrated into the encounter selection audit. Retain this
inventory through review of the accumulated correction work, then promote its
remaining durable dispositions and retire it.
Shopping outcomes and the specified story/meta predicates are bounded exclusions;
the shopping cooldown envelope is protected as described above. In-game steering remains
best effort and is not proven by a static catalog audit.

The durable composition matrix also retains stale prospective language
(including “No composition controls ... implemented yet” and ordinary-route-only
scope). Replace that wording at delivery closure; preserve its useful native
facts and bounded unknowns rather than appending another historical narrative.

## Recommended direction

One bounded catalog/admission correction pass, followed by focused engine
context fixes only where the remaining checks prove them necessary. No schema
bump, enemy-spawning machinery, stricter executor mismatch policy, or generalized
save-progression model follows from this audit. Further implementation remains
pending disposition of the remaining context checks.
