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
  `src/mods/room/timeline/acquisitions/` in the Plan Executor

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
The six bespoke contacts and their consequence boundaries are specified in
[NPC trait and generated-pickup execution](NPC_TRAIT_AND_GENERATED_PICKUP_EXECUTION.md).
Coverage of a dormant contact does not claim that its route navigation is
enabled.

## Nemesis random events

Nemesis uses a distinct event family rather than a trait provider menu.

| Planner outcome                     | Game contact                                                              | Status                                                    |
| ----------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------- |
| Choose event family                 | `SpawnNemesisForRandomEvents` and `CheckAvailableTextLines`               | Covered.                                                  |
| Free item                           | `NPCRewardDropPreProcess`, `NPCRewardDropPreProcessArgs`, `NPCRewardDrop` | Covered for the exact authored consumable identity.       |
| Gold/damage trade accept or decline | `NemesisTradeChoice`                                                      | Covered; price and damage amounts are simulation-neutral. |
| Trait trade                         | `NemesisTradeChoice` followed by `RemoveTrait`                            | Covered for exact trait and response.                     |
| Damage contest                      | `NemesisDamageContestTimer`                                               | Covered for success/failure only.                         |

Door theft and shop theft retain their documented planner simplifications and
are not Timeline obligations. See the Nemesis disposition in the room/route
audits.

## Encounter realization

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

Enemy composition, wave counts, and Fear-modified enemy generation are not
currently authored execution facts. They remain outside the blocking execution
boundary even though a future first slice may expose wave count and dominant
enemy type.

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
