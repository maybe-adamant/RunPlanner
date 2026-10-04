# Boss opening moves

Status: source investigation, not an implementation plan. Owner direction:
exclude actors with a single forced opening; do not replace scripted openers.
Scope: the opening only, for native `*_Boss01` / `*_Boss02` rooms, including
normal and Rival encounters and their participating actors. No runtime changes.

## Conclusion

Opening selection can be controlled once per actor, but it is not uniformly
random or independent of the player. Several actual first moves are scripted
attacks, transformations, or coordinated sequences. Replacing those is different
from selecting an otherwise variable opening. Do not silently call the first
random attack after a fixed opener the boss's opening move.

## Native control and limits

Source root: `/home/ayyatma/wsl-projects/modding/1GameData/Scripts`.

- `EnemyAILogic.lua:1232` (`SelectWeapon`) consumes an actor's
  `ForcedNextWeapon` once, before chains, combos and the ordinary weapon pool.
  A `ForcedWeaponInterrupt` has higher priority. The forced branch bypasses
  `IsEnemyWeaponEligible`; it is a mechanism, not proof a move is a valid opener.
- Selection still performs conditional swaps, selector expansion and combo setup.
  A combo is not necessarily a single hit; selecting its root does not fix every
  randomized subattack, target or timing. Preserve the chosen move's native tail.
- `EnemyAILogic.lua:1370` checks attack counts, player distance/angle, line of
  sight, nearby actors, health and partner state. `ForceFirst` and
  `ForceUseIfReady` prioritize eligible candidates, rather than adding every
  listed weapon to the opening domain.
- `MinAttacksBetweenUse` does NOT prohibit the first use: never-used weapons
  return -1 from `NumAttacksSinceWeapon` (`EnemyAILogic.lua:5865`). In contrast,
  `RequireTotalAttacks` explicitly gates the initial selection.
- `EncounterLogic.lua:1824,1974` starts boss/auxiliary actors separately;
  `SetupBoss` waits and executes a pre-AI function before `SetupAI`. Input is
  released while these threads can still be starting. Player movement can
  therefore affect even the first ordinary selection.
- `StagedAI` (`EnemyAILogic.lua:5601`) applies Rival stage data and may replace
  the pool and `ForcedNextWeapon`. An early spawn-time assignment can be lost.
- `DoAttackerAILoop` (`EnemyAILogic.lua:704`) records selection before execution.
  Empty `WeaponHistory` is not a universal opening marker: some intros already
  record weapons, and combos can record a root before the first actual attack.

## Room and actor inventory

The native files contain 15 matching rooms: C; F/G/H/N/O/Q 01 and 02; I/P 01.
Chronos and Prometheus use two encounters on one physical room, not an I/P 02 map.

| Rooms                                               | Native opening evidence                                                                                                                                                                                                                                                                                                                                       | Control disposition                                                                                                                                                                                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `C_Boss01` — Zagreus                                | `EnemyData_Zagreus.lua:125-142` supplies `ForcedNextWeapon = ZagreusSpearOffenseCombo1`.                                                                                                                                                                                                                                                                      | Fixed opening combo, not an ordinary pool roll. A replacement needs a deliberately validated alternative; don't flatten the combo.                                                                                                                      |
| `F_Boss01` — Hecate                                 | `PresentationBiomeF.lua:9-56` executes `HecateBattleIntro` directly before AI; it inherits the torch ring (`WeaponData_Hecate.lua:759`). The later pool is melee combo, melee attack and split (`EnemyData_Hecate.lua:268`).                                                                                                                                  | The actual opener is fixed. The three later options must not be advertised as interchangeable true openers without a separate intro-replacement decision.                                                                                               |
| `F_Boss02` — Hecate and copies                      | First stage forces `HecateDarkSideTransform` (`EnemyData_Hecate.lua:291-304`), which applies the Dark Side effect (`WeaponData_Hecate.lua:1384`). Two copies are spawned by `SpawnHecateClones`; `RoomDataF.lua:2390` starts their AI by type. Copy pool: homing torches, fork, ring, wolf howl (`EnemyData_Hecate.lua:5794`); howl is distance-sensitive.    | Preserve the main transformation. Copies are distinct opening actors; a per-copy choice requires a stable authored role or an explicit shared-copy contract.                                                                                            |
| `G_Boss01` — Scylla, Roxy, Jetty                    | Scylla is forced to `ScyllaBelt` by stage 1 (`EnemyData_Scylla.lua:326-357`). Roxy has inward/outward cone patterns; her circle combos require prior attacks (`EnemyData_SirenDrummer.lua:277`, `WeaponData_Siren.lua`). Jetty's dive has `ForceFirst`, chaining to surfacing (`WeaponData_Siren.lua:1258`).                                                  | Roxy is a particularly clear two-choice opening. Scylla and Jetty already have preferred/fixed openings. Store choices per performer, never one global first-call override.                                                                             |
| `G_Boss02` — band, Charybdis and six tentacles      | Scylla forces `ScyllaClamUp2`; Roxy forces `SirenDrummerBeatConeOut_EM`; Jetty retains her dive priority. Seven auxiliary IDs start separately (`RoomDataG.lua:908-909`). Charybdis spit tiers depend on group health and player distance; tentacle whip/spike/wait pools depend on distance (`EnemyData_Charybdis.lua:221,414`, `WeaponData_Charybdis.lua`). | Band choices and auxiliary behavior are separate. Do not offer late-phase spit tiers at the opening, or pretend a wait selection guarantees an immediate attack. Multiple tentacles need individually identified roles or an explicitly shared setting. |
| `H_Boss01` — Cerberus                               | Stage-1 pool includes swipe, turn slam, left/right pound, geyser, fireball combo and vacuum (`EnemyData_InfestedCerberus.lua:311`). Angle/distance affect several choices; circles/howl have attack-count gates (`WeaponData_InfestedCerberus.lua`).                                                                                                          | A restricted opening domain is feasible. The full stage pool is not the opening domain, and a guaranteed positional move would change native eligibility.                                                                                               |
| `H_Boss02` — Cerberus                               | Stage 1 forces `InfestedCerberusFireStream_Short` and starts an independent `DumbFireWeapons` circle pattern (`EnemyData_InfestedCerberus.lua:340-374`).                                                                                                                                                                                                      | Main opener is fixed, with concurrent arena behavior. Changing the selected weapon alone does not determine the entire opening scene.                                                                                                                   |
| `I_Boss01` — Chronos normal/Rival                   | Normal pool includes swings, scythe throw, rush, dash, grind and orbit; banner summons require prior attacks (`EnemyData_Chronos.lua:180`, `WeaponData_Chronos.lua`). Rival stage forces `ChronosEMRushThrow` (`EnemyData_Chronos.lua:353-369`). `ChronosBattleStart` starts the preplaced Cultists separately (`PresentationBiomeI.lua:1`).                  | Normal opening is context-sensitive; Rival has a fixed combo. Cultist openings must remain native unless explicitly included as separate actors. Later-bar openings are out of scope.                                                                   |
| `N_Boss01` — Polyphemus                             | Slam needs nearby player; kick needs a more distant player; leap is less positional; player/sheep grabs have their own target requirements. Stage 1 also equips one search variant (`EnemyData_Polyphemus.lua:307-335`, `WeaponData_Polyphemus.lua`).                                                                                                         | Feasible curated choice; neither all grabs nor every search variant is an unconditional opener. Sheep behavior remains native.                                                                                                                          |
| `N_Boss02` — Polyphemus and Medea                   | Polyphemus forces `PolyphemusStomp` (`EnemyData_Polyphemus.lua:319`). Medea starts separately (`RoomDataN.lua:2438`); `MedeaCast_NoTeleport` has `ForceFirst` and chains to teleport out (`WeaponData_Medea.lua:152`).                                                                                                                                        | Two distinct actors with native opening behavior. Selecting Polyphemus's opener must not consume Medea's choice.                                                                                                                                        |
| `O_Boss01` — Eris                                   | Initial pool is spray, grenade cluster, dash, flight and summon selector, but flight and summons require prior attacks (`EnemyData_Eris.lua:132`, `WeaponData_Eris.lua`). Dash checks line of sight.                                                                                                                                                          | Spray/grenade/dash are the candidate starting neighborhood, with native line-of-sight eligibility retained or explicitly addressed. Do not expose flight/summon as native-eligible opening rolls.                                                       |
| `O_Boss02` — Eris                                   | Rival stage writes `ForcedNextWeapon = ErisBackDashCombo` through stage `AIData` (`EnemyData_Eris.lua:350-378`); `StagedAI` copies that onto the enemy.                                                                                                                                                                                                       | Fixed opening combo; any alternative must use the Rival arsenal and respect setup/chains.                                                                                                                                                               |
| `P_Boss01` — Prometheus, eagle; Rival adds Heracles | `PrometheusBattleStart` and `EagleBattleStart` execute explicit intros (`PresentationBiomeP.lua:65-90`). Eagle intro chains into `EagleCombo_Intro` (`WeaponData_Eagle.lua:550-604`). Heracles begins with `HeraclesEMRoar_Dummy` (`EnemyData_Heracles.lua:19`). Rival attacks use shared `MapAggressor` requirements.                                        | Coordinated opening, not independent dropdowns for every actor. Preserve the joint intro; replacing it is a dedicated encounter-level intervention, not a generic first-weapon override.                                                                |
| `Q_Boss01` — Typhon head                            | Initial options are ram, roar, tongue, center eye and volley (`EnemyData_TyphonHead.lua:298`). Ram gets priority when the player is close. A separate gust runs through `DumbFireWeapons`.                                                                                                                                                                    | Curated main-attack selection is feasible, but does not control the simultaneous gust or all spatial details.                                                                                                                                           |
| `Q_Boss02` — Typhon head and Chronos                | Typhon forces tongue slam A, chaining to B (`EnemyData_TyphonHead.lua:317-332`). Chronos is activated by the encounter and started separately by ID (`EncounterData_Boss.lua:1563`, `RoomDataQ.lua:2404`); his assist arsenal is declared at `EnemyData_Chronos.lua:4776`. Later scripted restarts also exist.                                                | Separate main/assist actors; no rearming Chronos on later `SetupAI` calls. Exact allowed initial assist choices still need startup/game-state validation.                                                                                               |

Typhon arm/tail/eye encounters belong to other room names and are outside the
requested `*_Boss01/02` scope. Hecate missing/kidnapped story substitutions do
not provide a normal Hecate fight and must not receive a combat-opening override.

## Recommended boundary and remaining questions

1. Author an optional opening choice by concrete encounter variant and stable
   participant role; absent choice preserves native behavior.
2. Exclude actors with a single forced or scripted opening, per owner direction.
   Apply this per participant: Scylla and Jetty being fixed does not exclude
   Roxy's variable opening in the same encounter. Do not substitute a later
   random attack for the excluded actor's actual opener.
3. Consume once at the validated actor's opening contact after native stage
   setup. Preserve native chains and ordinary later AI; never rearm on phase
   changes, AI restarts, later summons or another same-type enemy.
4. Curate actual opening candidates from declarations and requirements. A
   runtime-ineligible selection needs an explicit contract: fallback is not a
   guarantee, while bypassing requirements changes game behavior. Do not wait
   indefinitely for eligibility: that would cease to control the opening.
5. Preserve targeting, movement, timings and unrelated actors. Selecting an
   opening does not promise a hit, simultaneous actor ordering or a completely
   deterministic fight. Later AI remains native but can naturally diverge because
   the opening changed history, positions, RNG consumption or health.

Source checks loaded the relevant native enemy/weapon tables and resolved weapon
inheritance using native `DeepInheritData`. Focused probes executed actual
`SelectWeapon` and `IsEnemyWeaponEligible` in an isolated Lua environment:
one-shot consumption, untouched subsequent pool, per-actor isolation, interrupt
priority, forced-branch eligibility bypass, distance-dependent eligibility and
opening attack-count exclusion all passed. This is not live combat validation.

With fixed openers excluded, the main candidate scope is normal Roxy in
`G_Boss01`, Cerberus in `H_Boss01`, normal Chronos in `I_Boss01`, Polyphemus in
`N_Boss01`, Eris in `O_Boss01`, and Typhon head in `Q_Boss01`. These are six
actor/encounter entries, not six unconditional attack menus. Hecate's Rival
copies and Chronos's Typhon assist remain auxiliary candidates pending exact
startup validation. Charybdis/tentacles are state-driven attack/wait cases,
not demonstrated independent random opening menus.

Before locking a plan: finish actor-startup
probes for Charybdis/tentacles, Hecate copies and Chronos's Typhon assist; lock
only the candidate domains supported by those probes. Actual movement,
animations, partner synchronization and interruptions require in-game checks.
