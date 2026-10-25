# Biome Execution Navigation

## Purpose

This document records the smallest execution delta each biome needs beyond the
navigation proven for Erebus (`F`) and Oceanus (`G`). The biome authorities
under [`docs/biomes/`](../biomes/) own each biome's native mechanisms and the
planner's legal product; this document answers a narrower question:

> Given a complete-valid plan, which native game contact must behave
> differently from the F/G baseline to realize that plan?

A planner distinction does not become an executor distinction merely because
it is biome-specific. A new execution product or native hook is earned only
when an exact planned fact cannot be realized through an existing contact, and
each earned contact carries one representative witness. When the baseline can
realize the plan and the game owns the remaining behavior, the disposition is
**no new mechanism**; enabling the biome in the route extent and adding a
regression witness are not new runtime architecture.

## Boundary

The planner engine owns candidate pools, eligibility, force pressure, caps,
history, room replacement, selected topology, and the exact resulting Room
Occurrences. The execution compiler translates that product without rerunning
those policies. The game module steers the native game at bounded contacts and
otherwise lets the game perform its own lifecycle.

Navigation owns:

- the exact Room Occurrence currently being entered;
- its incoming reward;
- the complete normal and additional exit set;
- each exit's target room and visible reward;
- protecting the selected continuation from native exit blocking while leaving
  unpicked exits under native control; and
- reporting the entered occurrence back to the route session.

Room features, encounters, pickups, purchases, and other timeline actions are
not navigation. A biome that reveals one of those contacts names it as an
adjacent room-session delta rather than misclassifying it as navigation.

## F/G Baseline

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

F needs no exception to those contacts; its opening, generated batches,
additional exits, Preboss takeover, and fixed completion links define the
baseline.

G earns one navigation hook for the Anomaly. Returning the planned
`B_CombatXX` declaration would skip native Anomaly entry presentation and
setup, so the adapter enters the native `ChooseNextRoomData` Anomaly branch
while supplying the planner-selected replacement and hidden G return. The
Anomaly room otherwise uses the ordinary route cursor, incoming reward,
one-exit realization, and next-room entry proof; the hook adds no second
detour topology or transition validator.

## Per-Biome Dispositions

### Mourning Fields (`H`)

H has **no new route-navigation mechanism**. It earns one Fields-room slice
with two contacts over the [native Fields setup](../biomes/H_GAME_RULES.md#native-execution-contacts):

1. **Fields door payload realization.** During ordinary outgoing-door
   generation, bypass the native cage-count roll and install each target's
   exact ordered cage rewards. The grouped cage preview extends an ordinary
   door target; it is not an incoming reward or a collection of fake exits.
2. **Fields room realization.** On entry to the selected `H_Combat`
   occurrence, let native Fields setup create the cages and optional rewards
   while steering their exact authored identities and physical assignments,
   using bounded selection adapters over the native point choices. Bind the
   repeated native encounter selections to `Passive`, `Cage01`, `Cage02`, and
   active `Cage03`, then leave starts, completions, acquisitions, and side
   effects to the existing encounter and timeline adapters.

The Fields `min`/`max` choice, native chance table, ceiling counter, and clamp
are not execution facts; they do not cross the boundary for the executor to
repeat. The adapters consume the planner's explicit spatial result rather than
inferring a layout from room names or recreating native objects. Everything
outside `H_Combat` reuses existing work, and the executor neither counts the
four qualifying H rooms nor re-evaluates Preboss eligibility.

### Tartarus (`I`)

I has **no new navigation mechanism**; exact rooms, ordinary rewards, peers,
and the fixed Preboss-to-Boss link use the baseline, and the game keeps its
Clockwork counters and goal lifecycle. One product mapping is required: the
canonical room's `clockworkReward: 'goal'` crosses the boundary as the
ordinary exact reward identity `ClockworkGoal`, never as an I-specific counter
or cap controller. The executor does not count Goals, apply the cap, advance
Tartarus stages, or re-evaluate Preboss eligibility. Its witness proves that
exact planned reward forcing wins even when native `ForcedFirstReward` or cap
pressure would choose differently, while native `SpawnClockworkGoalReward`
stays intact.

### Ephyra (`N`)

Canonical N history distinguishes each fresh main or side occurrence from the
[native parent and Hub restores](../biomes/N_GAME_RULES.md#native-board-and-restore-contacts)
between them; restores preserve simulation history but are not execution
actions, so the execution route contains only fresh authored occurrences. N
earns three bounded contacts within one Ephyra navigation adapter:

1. **Hub-entry realization.** An occurrence that owns the published Hub product
   has a planner-terminal outgoing envelope but one native structural exit to
   `N_Hub`. Force and prove that destination without turning the Hub into an
   execution occurrence, from `N_PreHub01` or an N-entry Chaos source alike.
2. **Persistent Hub board realization.** At the native Hub-board contact,
   install the exact open physical doors and force every open door's room and
   reward, including unvisited offers, since the complete board exists before
   the first visit and feeds the Hub reward lookup. Realize and prove the board
   once; native persistence owns later Hub returns, and the fresh-occurrence
   sequence proves visit order and the eventual Preboss entry.
3. **Main-local side realization.** At each visited main room's side-door
   contact, steer every declared slot to its published generated disposition
   and force each generated door's room and reward, including generated but
   unvisited slots. The native persistent-room path performs every parent
   return.

The route cursor treats a native reload of `N_Hub` or an already-completed
persistent parent as transparent: it neither advances nor opens, closes, or
replays a room session, and the next freshly entered room must still match the
next published occurrence. This is cursor continuity, not executor-owned
restoration or a restore transaction in the plan. Native N declarations keep
the return transitions and side-room counter suppression; the executor does
not implement Hub visit counts, side-room clocks, pylons, or restoration.

### Thessaly (`O`)

O has **no new route-navigation mechanism**. It earns one `O_Combat` slice
over the [native ShipCombat sequence](../biomes/O_GAME_RULES.md#shipcombat-phase-and-wheel-contract)
with two contacts:

1. **Active phase realization.** At `SetupRoomMultipleEncountersData`, steer
   the native optional third entry so the encounter count matches the
   planner's two- or three-phase product. The generic ordered
   `ChooseEncounter` binding then maps Intro, Combat1, and Combat2 to their
   exact identities; the executor does not rerun the native depth/chance rule.
2. **Wheel realization.** At each non-Intro `ShipsEncounterSetup`, force the
   authored offer count, shared store, and every offered reward and source.
   Bind the player's `UseShipWheel` callback to the exact published
   picked-offer transaction while the native function records the choice,
   starts the encounter, spawns the reward, and enforces
   `WaitForNextEncounterReady`. The adapter does not replace or block input.

The selected wheel reward uses the existing acquisition adapter and Icarus the
existing encounter-interaction adapter. The executor does not create wheel
pickups, duplicate the between-phase barrier, or infer the final outgoing
store; every other O room and feature reuses established contacts.

### Mount Olympus (`P`)

P needs **no new navigation mechanism** and **no new encounter
infrastructure**: the generic multiple-encounter adapter already binds native
`ChooseEncounter` calls to the published ordered phase list. Its witnesses
cover PreCombat followed by Combat, and Heracles in the first position with
the native block suppressing the suffix. The executor does not start the
second phase, reproduce Heracles's block rule, or read phase identity from
room names.

### Summit (`Q`)

Q has **no new navigation mechanism**. Exact room names, rewards, door widths,
and the fixed Boss link use the baseline; the executor adds no Q progression
cursor and repeats no room eligibility. World Shop realization and room-local
delivery or timeline behavior belong to their existing adapters, not to Q
navigation.

## Execution Delta Summary

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

Planner legality matrices remain tested by their planner and catalog owners.
Executor tests prove translation and native contact behavior, not that the
planner's candidate, cap, or force rules are correct a second time.

## Dream Navigation

Dream execution publishes the ordered configured prefix, not an independently
editable runtime itinerary, and reuses the biome contacts above. Startup
requires the native run mode to match the plan. The native `Dream_Intro`
prologue is outside the occurrence cursor; the first biome receives the
published starting reward and later entries use their resolved rewardless
declarations.

The existing cursor supplies the next biome during native selection, including
selection before Postboss departure; fixed-route adapters never infer route
position from room names. Scoped pool removal preserves native bookkeeping, and
the native starting-room choice prepares the published entry without replacing
the active predecessor session. After the configured prefix, selection becomes
native. Dream Points, difficulty, transitions and final completion remain game
owned. The [hook map](../audits/game-execution-contacts/FEATURE_HOOK_MAP.md#dream-route-navigation)
owns the exact contacts and scope lifetimes.
