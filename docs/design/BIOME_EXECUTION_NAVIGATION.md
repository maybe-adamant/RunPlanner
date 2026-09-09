# Biome Execution Navigation

## Purpose

This document records the smallest execution delta each biome needs beyond the
navigation already proven for Erebus (`F`) and Oceanus (`G`). It is not a
summary of biome rules and it does not reproduce planner eligibility, force,
cap, history, or reward-bag policy.

The biome authorities under [`docs/biomes/`](../biomes/) answer whether a plan
is legal. This document answers a narrower question:

> Given a complete-valid plan, which native game contact must behave
> differently from the F/G baseline to realize that plan?

A planner distinction does not become an executor distinction merely because
it is biome-specific. A new execution product or native hook is justified only
when an exact planned fact cannot be realized through an existing contact.

## Boundary

The planner engine owns candidate pools, eligibility, force pressure, caps,
history, room replacement, selected topology, and the exact resulting Room
Occurrences. The execution compiler translates that product without rerunning
those policies. The Plan Executor steers the native game at bounded contacts
and otherwise lets the game perform its own lifecycle.

Navigation owns:

- the exact Room Occurrence currently being entered;
- its incoming reward;
- the complete normal and additional exit set;
- each exit's target room and visible reward; and
- reporting the entered occurrence back to the route session.

Room features, encounters, pickups, purchases, and other timeline actions are
not navigation. When extending a biome reveals one of those contacts, this
document names it as an adjacent room-session delta so the implementation plan
routes it to the correct owner.

## How a biome earns new execution work

For each biome, extension work must establish all four rows below:

| Question                              | Required disposition                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| What does the native game do?         | Name the concrete script function or declaration mechanism.                                      |
| What has the planner already decided? | Name the exact complete-valid fact; do not restate its eligibility algorithm.                    |
| Can the F/G baseline realize it?      | Reuse the existing room, reward, door, additional-exit, or fixed-link contact whenever possible. |
| What is genuinely missing?            | Add only the smallest product mapping or native hook, with one representative witness.           |

If the baseline can realize the plan and the game owns the remaining behavior,
the correct disposition is **no new mechanism**. Enabling the biome in the
route extent and adding a regression witness are not new runtime architecture.

## Proven F/G baseline

The F/G executor establishes the reusable navigation contract.

### Generic contacts

- `ChooseNextRoomData` receives the exact planned target Room declaration.
- `ChooseRoomReward` and reward setup receive the exact planned incoming or
  door reward and source.
- `DoUnlockRoomExits` realizes the complete ordered normal-door set and checks
  it after native generation.
- Batch, fixed-link, and terminal continuations share one route cursor.
- Chaos and Zagreus Contract are additional physical exits beside the normal
  door set. Selecting one is proved by the next room entry rather than an
  independent transition checkpoint.
- Preboss, Boss, and Postboss are ordinary persisted occurrences. Planner-side
  takeover and Vow-of-Rivals selection arrive as already-resolved topology and
  exact game room names.

F needs no exception to those contacts. Its opening, generated batches,
additional exits, Preboss takeover, and fixed completion links define the
baseline rather than separate F adapters.

### G-specific earned hook: Anomaly

Anomaly is the one proven G navigation exception. Merely returning the planned
`B_CombatXX` Room declaration would skip native Anomaly entry presentation and
setup. The adapter therefore enters the native `ChooseNextRoomData` Anomaly
branch while supplying the planner-selected replacement and hidden G return.

The resulting Anomaly room still uses the ordinary route cursor, incoming
reward, one-exit realization, and next-room entry proof. The hook exists only
to invoke the native Anomaly transition behavior; it does not introduce a
second detour topology or transition validator.

## Mourning Fields (`H`)

### Native mechanism

H Intro, specials, completion rooms, and ordinary physical exits use the same
room, reward, additional-exit, and fixed-link contacts as F/G. The exception is
an `H_Combat` target. While the previous room is generating its doors, the game
builds an ordered `CageRewards` array on each Fields target. After the selected
target is entered, `SpawnRewardCages` creates those already-selected cage
rewards, rolls and creates optional rewards, and assigns their physical points.

The room's Passive encounter and each cage encounter are selected through
separate repeated `ChooseEncounter` calls rather than
`SetupRoomMultipleEncountersData`. Every cage present in the resolved payload
is a required encounter. A two-cage payload activates `Cage01` and `Cage02`; a
three-cage payload also activates required `Cage03`.

### Planner product

The planner has already applied the Fields `min` or `max` legality rule and its
target-capacity clamp. Each outgoing target therefore owns its exact ordered
cage reward payload. The selected `H_Combat` occurrence also owns its exact
optional rewards, entry pair, cage point assignments, optional point
assignments, Nemesis point when present, and active ordered encounter phases.

The `min` or `max` choice, native chance table, ceiling counter, and clamp are
not execution facts. They must not cross the boundary merely so the executor
can repeat a decision the planner has already resolved.

### Execution disposition

H has **no new route-navigation mechanism**. It earns one Fields-room vertical
slice with two contacts:

1. **Fields door payload realization.** During ordinary outgoing-door
   generation, bypass the native cage-count roll and install each target's
   exact ordered cage rewards. The resulting grouped cage preview extends an
   ordinary door target; it is not an incoming reward or a collection of fake
   exits.
2. **Fields room realization.** On entry to the selected `H_Combat` occurrence,
   let native Fields setup create the cages and optional rewards while steering
   their exact authored identities and physical assignments. Bind the repeated
   native encounter selections to `Passive`, `Cage01`, `Cage02`, and active
   `Cage03`, then leave starts, completions, acquisitions, and side effects to
   the existing encounter and timeline adapters.

Entry already has a native exact start/end override. Cage, optional-reward, and
Nemesis placement require bounded selection adapters because their native
functions choose randomly from finite map point sets. These contacts consume
the planner's explicit spatial result; they do not infer a layout from room
names or recreate native objects manually.

Everything outside `H_Combat` cage construction and realization reuses existing
work: Intro and room forcing, one- and two-door navigation, Chaos and Ixion,
Wells and resources, Echo Bridge, Nemesis outcomes, Preboss takeover,
Boss/Postboss links, ordinary acquisitions, Artificer, and room-exit
conformance. The executor does not count the four qualifying H rooms or
re-evaluate Preboss eligibility.

## Tartarus (`I`)

### Native mechanism

`I_Intro` calls `InitClockworkGoalReward`, which initializes five remaining
Clockwork Goals and a native random non-goal cap. Tartarus declarations use
those values for native reward and Preboss pressure. Spawning a
`ClockworkGoal` calls `SpawnClockworkGoalReward`, which decrements the native
remaining-goal count.

Room generation and reward selection still use the ordinary
`ChooseNextRoomData` and `ChooseRoomReward` contacts.

### Planner product

The planner has already selected a legal non-goal cap outcome, exact ordered
room occurrences, the Goal or non-goal realization of each relevant target,
the concrete encounter selection, and the retained ordinary Preboss peer. The
executor must not count Goals, apply the cap, advance Tartarus stages, or
re-evaluate Preboss eligibility.

### Execution disposition

I has **no new navigation mechanism**. Exact rooms, ordinary rewards, peers,
and the fixed Preboss-to-Boss link use the F/G baseline. The game remains
responsible for its Clockwork counters and goal lifecycle.

One product adaptation is required: a materialized Goal must cross the
execution boundary as the ordinary exact reward identity `ClockworkGoal`.
Today the canonical room records it as `clockworkReward: 'goal'` rather than an
ordinary `incomingReward`; the compiler must map that fact into the existing
execution reward shape. It must not publish an I-specific counter or cap
controller.

The representative witness must prove that exact planned reward forcing wins
even when native `ForcedFirstReward` or cap pressure would choose differently,
while the native `SpawnClockworkGoalReward` lifecycle remains intact.

## Ephyra (`N`)

### Native mechanism

N Opening and PreHub use fixed linked rooms before entering `N_Hub`. The Hub
calls `ChooseAvailableN_HubDoors` once to choose its persistent open board, and
ordinary exit generation assigns every open physical door its predetermined
room and reward. `PersistentExitDoorRewards` preserves those offers across all
later Hub returns.

Visited main rooms use the same persistence mechanism for their local doors.
`CheckN_SubRoomDoorUnavailable` decides which declared side doors generate;
ordinary exit generation assigns every generated side room and reward. The
game records the used door in `DoorRoomHistory`, restores the same parent after
a side visit, and eventually restores the same Hub. These restores are native
transitions, not newly entered planner occurrences.

### Planner product

The planner has already selected the complete nine- or ten-door open Hub board,
including the exact room and incoming reward on every open slot whether or not
it will be visited. It separately publishes the six ordered main visits. For
each visited main room it has selected every declared side slot's
`generated`/`notGenerated` disposition, every generated room and reward, and
the entered side-room order.

Canonical N history already distinguishes each fresh main or side occurrence
from the parent and Hub restores between them. Those restore facts preserve
simulation history but do not become execution actions. The selected execution
route contains only fresh authored occurrences.

### Execution disposition

N earns three bounded realization contacts within one Ephyra navigation adapter:

1. **Hub-entry realization.** An occurrence that owns the published Hub product
   has a planner-terminal outgoing envelope but one native structural exit to
   `N_Hub`. Force and prove that single native destination without turning the
   Hub into an execution occurrence. This applies equally to the normal
   `N_PreHub01` source and an N-entry Chaos source.
2. **Persistent Hub board realization.** At the native Hub-board contact,
   install the exact open physical doors and force every open door's room and
   reward. This includes unvisited offers because the complete board exists
   before the first visit and contributes to the Hub reward lookup. Realize and
   prove that board once. Native persistence owns later Hub returns, while the
   fresh-occurrence sequence proves visit order and the eventual Preboss entry.
3. **Main-local side realization.** At each visited main room's side-door
   contact, steer every declared slot to its published generated disposition
   and force each generated door's room and reward, including generated but
   unvisited slots. Let the native persistent-room path perform every parent
   return.

The route cursor needs one narrow N accommodation: a native reload of `N_Hub`
or an already-completed persistent parent is transparent to the occurrence
sequence. It neither advances the cursor nor opens, closes, or replays a room
session. The next freshly entered main or side room must still match the next
published occurrence. This is cursor continuity across native restoration,
not executor ownership of restoration and not a restore transaction in the
execution plan.

Opening, PreHub, every fresh main and side occurrence, Preboss, Boss, and
Postboss otherwise reuse the established room, reward, encounter, timeline,
and conformance adapters. The Hub-entry contact only realizes the structural
destination already named by the Hub product. Native N declarations remain
responsible for the actual return transitions and side-room counter
suppression; the executor does not implement Hub visit counts, side-room
clocks, pylons, or restoration.

## Thessaly (`O`)

### Native mechanism

O room entry, its one physical `ShipsExitDoor`, incoming rewards outside
ShipCombat, Preboss takeover, and fixed completion links use the ordinary room
and navigation path. The exception is the room-local sequence inside an
`O_Combat` occurrence.

Before room entry, `SetupRoomMultipleEncountersData` prepares an ordered list:
Intro and Combat1 are always active, while Combat2 is selected through the
third declaration entry's native requirements and chance. `StartRoom` then
runs the resulting encounter objects sequentially. The Intro encounter carries
an Empty reward and `SkipShipsEncounterSetup`, so it creates no wheel.

At the start of Combat1 and active Combat2, `ShipsEncounterSetup` creates one
or two wheel choices, selects their shared RunProgress or MetaProgress store,
generates each offered reward, and waits for the player to use one wheel.
`UseShipWheel` records the selected store and reward on the current encounter.
After combat, native `SpawnRoomReward` creates that selected pickup and
`WaitForNextEncounterReady` prevents the next encounter from beginning while a
required room object or choice screen remains unresolved.

### Planner product

The planner has already selected whether the occurrence has two active phases
(Intro and Combat1) or three (including Combat2), and it publishes each exact
encounter identity in that order. Each active combat phase owns one wheel with
an exact offer count, RunProgress or MetaProgress store, complete simultaneous
offer cohort, and one picked offer.

Its room timeline already orders the native sequence:

```text
Intro
-> choose Wheel 1
-> Combat1
-> collect the selected Wheel 1 reward
-> choose Wheel 2, when active
-> Combat2
-> collect the selected Wheel 2 reward
-> Cleanup / Doors
```

Encounter-owned interactions such as Icarus and the selected wheel pickup are
separate required actions after their combat. The planner's dependency graph
already permits their valid relative order and blocks the next phase until its
required predecessor state is complete.

### Execution disposition

O has **no new route-navigation mechanism**. It earns one `O_Combat` vertical
slice with two bounded contacts:

1. **Active phase realization.** At `SetupRoomMultipleEncountersData`, steer
   the native optional third entry so the resulting encounter count matches the
   planner's two- or three-phase product. Once the active list is correct, the
   existing generic ordered `ChooseEncounter` binding maps Intro, Combat1, and
   Combat2 to their exact published identities. The executor does not rerun the
   native depth/chance rule.
2. **Wheel realization.** At each non-Intro `ShipsEncounterSetup`, force the
   authored offer count, shared store, and every offered reward and source.
   After the player uses a wheel, bind that `UseShipWheel` callback to the exact
   published picked-offer transaction while leaving the native function to
   record the choice, start the encounter, spawn the reward, and enforce
   `WaitForNextEncounterReady`. The adapter does not replace or block player
   input.

The selected wheel reward then uses the existing acquisition adapter; Icarus
uses the existing encounter-interaction adapter. The executor does not create
wheel pickups, duplicate the native between-phase barrier, or infer the final
outgoing store. Intro, ordinary O rooms and rewards, Midshop, Story, Reprieve,
Devotion, Miniboss, Preboss, Boss, Postboss, shops, resources, and conformance
otherwise reuse established products and contacts.

## Mount Olympus (`P`)

### Native mechanism

P uses ordinary room and reward navigation. Its combat declarations add an
ordered `MultipleEncountersData` list: an Intro/PreCombat position followed by
a Combat position. `SetupRoomMultipleEncountersData` calls `ChooseEncounter`
for each eligible position. A selected `HeraclesCombatP` carries
`BlockMultipleEncounters`, so the native loop stops before preparing the Combat
suffix.

### Planner product

The planner has already selected the exact encounter identity for each active
position. The phases remain members of one Room Occurrence and do not alter its
incoming reward or outgoing doors.

### Execution disposition

P has **no new navigation mechanism**. Its Intro, ordinary batches, Chaos
additional exits, Preboss takeover, and fixed completion links use the F/G
baseline.

P also needs **no new encounter infrastructure**. The existing generic
multiple-encounter adapter already indexes native `ChooseEncounter` calls and
binds them to the published ordered phase list. Enabling P requires carrying
its existing phase product through the expanded route extent and adding
representative witnesses for:

- PreCombat followed by Combat; and
- Heracles in the first position, with the native block suppressing the
  suffix.

The executor must not manually start the second phase, reproduce Heracles's
block rule, or interpret P room names to recover phase identity.

## Summit (`Q`)

### Native mechanism

Q room declarations participate in the ordinary room-generation path. Their
force depths, linked rooms, concrete exit widths, rewards, and final
`Q_PreBoss01 -> Q_Boss01` link are native declaration facts.

### Planner product

The planner's six stage pools constrain authoring and produce exact legal Room
Occurrences. Stage identity, candidate exhaustion, final Preboss pressure, and
the absence of a fourth-position Postboss have already been resolved before
publication.

### Execution disposition

Q has **no new navigation mechanism**. The executor receives exact room names,
rewards, door widths, and the fixed Boss link through the F/G baseline. It must
not publish or advance a Q stage cursor and must not repeat the stage candidate
evaluator.

World Shop realization and any room-local delivery or timeline behavior belong
to their existing feature and timeline adapters. They are not Q navigation
work merely because they occur in a Q room.

## Planning and acceptance

The complete fixed-route delta is intentionally small:

| Biome | Execution delta beyond the F/G baseline                                                      |
| ----- | -------------------------------------------------------------------------------------------- |
| F     | None; establishes the baseline.                                                              |
| G     | Native Anomaly entry contact.                                                                |
| H     | Fields door cage payload and selected Fields room realization.                               |
| I     | Map the resolved Goal fact to the ordinary `ClockworkGoal` reward identity.                  |
| N     | Persistent Hub board, main-local side slots, and cursor transparency across native restores. |
| O     | Active ShipCombat phase realization and wheel realization.                                   |
| P     | None; carry the existing ordered encounter product through the expanded route extent.        |
| Q     | None; carry ordinary occurrences through the expanded route extent.                          |

The later-biome implementation plan is driven by the dispositions in this
document, not by a generic checklist of biome features. For each enabled
biome, a gate should contain only:

1. route/protocol extent changes needed to admit its occurrences;
2. existing execution facts that require a small mapping into a baseline
   product;
3. native hooks explicitly earned by the comparison above; and
4. one representative fixture or native-harness witness for each earned
   contact.

Planner legality matrices remain tested by their planner and catalog owners.
Executor tests prove translation and native contact behavior, not that the
planner's candidate, cap, or force rules are correct a second time.

Dream Dives require a separate route-order and completion-room comparison. A
future Dream Dive plan may reuse biome contacts established here, but it must
not make fixed-route adapters infer route position from room names.
