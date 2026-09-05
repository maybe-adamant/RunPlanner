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
  focused acquisition adapters beneath `src/mods/room/timeline/acquisitions/`,
  and named deferred later-route NPC menu bridges in the Plan Executor

## Trait-menu carriers

NPC identity is not enough to identify a native trait-offer contact. Some NPCs
use ordinary loot; others build bespoke menus before the generic selection
function is reached.

| Provider                         | Native offer contact                          | Current status                                                                                           |
| -------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Arachne                          | `ArachneCostumeChoice`                        | Covered by the focused NPC acquisition adapter.                                                          |
| Narcissus                        | `NarcissusBenefitChoice`                      | Covered for the menu, native generated children, and Mystery Boon handoff.                               |
| Medea                            | `MedeaCurseChoice`                            | Deferred route; adapter exists.                                                                          |
| Circe                            | `CirceBlessingChoice`                         | Deferred route; adapter exists, exceptional result coverage remains separate.                            |
| Icarus                           | `IcarusBenefitChoice`                         | Deferred route; adapter exists.                                                                          |
| Echo                             | `EchoChoice`                                  | Deferred route; adapter exists, but each exceptional replay/result still needs its semantic transaction. |
| Artemis, Athena, Hades, Dionysus | Ordinary loot or encounter-owned trait source | Covered only through the ordinary loot carrier reached by the encounter.                                 |

The six bespoke contacts are defined in `Scripts/EventLogic.lua`. Their explicit
adapters are intentional; a single `UseLoot` hook does not cover these menus.
Arachne and Narcissus are specified in
[NPC trait and generated-pickup execution](NPC_TRAIT_AND_GENERATED_PICKUP_EXECUTION.md);
the later providers remain deferred.

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

| Encounter family                                                                                               | Status                                                                                                           |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| F/G Combat, Miniboss, Story, Shop, Boss                                                                        | Covered through exact room and encounter declarations.                                                           |
| Chaos                                                                                                          | Covered for room/encounter and its trait-pair acquisition.                                                       |
| G Anomaly                                                                                                      | Covered as a real one-exit Anomaly occurrence, not a hidden return.                                              |
| Zagreus Contract                                                                                               | Covered as an additional exit and encounter occurrence.                                                          |
| Devotion                                                                                                       | Covered where its chosen/spurned acquisitions are published.                                                     |
| P PreCombat plus room-ending encounter, H bonus encounter, N side rooms, O wheels, I goals, Q structured rooms | Deferred route; each needs biome-specific execution facts without changing the general room-session coordinator. |

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

This identity model is sufficient for the current F/G encounters and for later
H and O multi-phase rooms. Those later routes may add cage, wheel, or other
phase-local contacts, but they do not require a second encounter cursor or a
different phase-binding scheme.

## Closed automatic transaction union

| Effect              | Planner trigger                     | Native contact                                                     | Status   |
| ------------------- | ----------------------------------- | ------------------------------------------------------------------ | -------- |
| Steady Growth       | reached encounter interval          | `AddRarityToTraits` during the published encounter-end window      | Covered. |
| Transcendent Embryo | reached eight-encounter replacement | `AddRandomChaosBlessing` during the published encounter-end window | Covered. |
| Judgment            | boss defeated                       | `AddRandomMetaUpgrades`                                            | Covered. |
| Crystal Figurine    | boss defeated                       | `AddRandomMetaUpgrades` with the Figurine rarity contract          | Covered. |

This is the entire `automatic` union. Natural Selection and All Together are
nested selected-trait consequences, Ransoms are native-authoritative, and Echo
and Circe remain deferred later-route contacts; none is an automatic member.

## Live-witness gaps

The executor has unit coverage for all four automatic shapes, but byte-product
fixtures should not be mistaken for complete native contact evidence. Current
fixture coverage is strongest for F/G room flow, ordinary offers, Chaos, Wells,
and shops. Concave Stone's second offer and each future-biome NPC remain useful
bounded live probes. Encounter closure additionally needs focused witnesses for
two native encounter tables sharing one declaration name and for two different
transaction contacts sharing one phase.
