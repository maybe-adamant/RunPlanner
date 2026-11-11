# Part 2, step C5: the item model

Status: owner model approved (2026-11-10); schema 103 scope expanded for
the later slices. C5a delivered on `live-pickups` (awaiting review); C5b-C5d
not started. Temporary plan; delete at delivery after promoting durable
results. Follows [LIVE_PICKUPS](LIVE_PICKUPS.md) step C.

Investigations (read-only, 2026-11-10):

- `/home/ayyatma/run-planner-investigations/live-pickups/existence-vs-interaction.md`
- `/home/ayyatma/run-planner-investigations/live-pickups/lifecycle-triggers.md`

## Owner model

- A room is a set of **items**. An item's properties are either derived (by
  engine rules) or observed (game rolls the planner is told).
- **Outcomes** (player choices) live on items.
- Timeline rows are thin: subject + verb, in order.
- **Verbs** are distinct interactions: pick up, goldify, transform
  (Artificer), talk to, buy, sell, reroll, choose, unlock (cage), use
  (fountain, Well), and so on.
- The live row lists things. Clicking a thing shows its verbs; choosing one
  creates that interaction row.
- When an item's source or content changes, the old item and its whole chain
  go and the new item spawns live.

## Slices

- **C5a** items and verbs on the live product. No schema, no behaviour
  change, equivalence unchanged.
- **C5b** observations and outcomes onto items, thin rows, the 102 → 103
  conversion.
- **C5c** same-key swap: rows keyed by item, so a same-role swap (Zeus Boon
  to Hera Boon) removes the old row like any other swap.
- **C5d** lifecycle events as triggered consequences, with encounter begin
  (depth) split from combat start (`StartEncounterEffects`).

## C5a: what the live product publishes

- Every live item (pickup or object) carries `verbs`: kind, participation,
  deadline, the row it stands as or places, and either the ordered commands
  performing it at that gap (empty while standing) or a picker. A picker is
  `before` (it supplies the commands: reroll press, unpinned Pool sale, blank
  Travel Deal item) or `after` (the commands apply as is: Pom level, Well or
  Pool rerolled list, rack keepsake, Artificer replacement).
- Each existing action maps to one verb by its row kind. A standing row
  acquiring one reached role adds goldify and transform where the
  conversion capability captured at its contact supports them (paid items
  never), each a `ReplaceAcquisitionDisposition`; the row's own verb then
  undoes a conversion.
- Choice verbs the live product lacked: door, cage and wheel reroll presses
  at the surface's append point; Well and Pool rerolls and unpinned Pool
  sales where the room's reached actions end; each only while a held card
  enables it and the pool pays. A pinned Pool sale and the rack are roster
  rows already.
- `progression` at the frontier: `leaveRoom` once the walk passes the room
  with nothing required live; `chooseWheel` when the next wheel's choice is
  the only required thing live. Leaving is the exit decision, not a row, so
  it carries no command.
- `leftBehind`: the optional pickups live at the room's last gap, once the
  walk passes the room.

Gaps left for C5b (the engine cannot derive them today):

- Goldify and transform for an unplaced item, or for a placed one at any
  gap but its own: the conversion capability exists only at a reached
  contact, so the state at another gap is unknown.
- A row covering several roles (a caged Blind Box) gets no conversion verbs.
- Well and Pool rerolls, Pool sales and door rerolls only at their append
  point: no engine query answers their other legal indices. A wheel
  reroll while its choice is unplaced appends past the frontier, so it is
  not offered.
- The keepsake rack's choice uses `ReplacePostbossKeepsake` after placing
  the row; there is no placement command carrying the keepsake.
- No new verb exports on `./simulation` yet; they land with the first
  consumer (the planner's live row in D).

## Inventory (summary of existence-vs-interaction)

Item identity today is (reward owner address, acquisition role); every
outcome map is keyed by role. The pickup verb (normal, Time Piece,
Artificer) is the item's `dispositionByAcquisitionRole`, not a row kind.

| Kind                                                                                               | Verbs                         | Outcome lives on                                                   |
| -------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------ |
| Boss forced drop, room, cage, optional, wheel reward                                               | pick up, goldify, transform   | the reward state, by role                                          |
| Generated entries (delivery, clocked drop, Echo, Artificer, Sea Star, Nemesis, Eris, switch claim) | pick up (+ conversions)       | the acquisition site entry; existence needs the source row settled |
| NPC contact, Gorgon, Eris                                                                          | talk to                       | the phase (Nemesis, Gorgon, bet) or the occurrence                 |
| Fields cage                                                                                        | unlock (starts its fight)     | none                                                               |
| Ship wheel                                                                                         | choose, reroll                | `pickedOfferIndex` on the wheel, no row                            |
| Fountain, keepsake rack                                                                            | use                           | the occurrence (Phial target, rack keepsake)                       |
| Challenge switch, locked door                                                                      | press, unlock (start a fight) | observation; door customization on the row                         |
| World Shop, Shrine, Well, Pedestal                                                                 | buy, rush, take               | the stock slot; membership = bought                                |
| Pool                                                                                               | sell, reroll                  | sale presence; the rolled list on the row                          |
| Door, cage, wheel reroll                                                                           | reroll                        | the reward on the row, mirrored into the target                    |

Mixing hot spots, where a row is the item's existence or holds its outcome:

- Commerce membership: Shop, Pedestal, Pool sale exist as contributions only
  with their row; the Well keeps a second membership list
  (`purchasedGenerationKeys`).
- Reroll rows (`reroll`, Well, Pool) are the new roll's existence and carry
  its result; door rerolls duplicate it into the target.
- Generated pickups exist only once their source row settles; Sea Star's
  proc is an observation stored as a row.
- Row-owned outcomes: reroll rewards, Well and Pool restocks,
  `unlockExit.customization`, Shrine `rushed`, a delivery's
  `encounterPhaseKey`.
- The incoming reward row key embeds the role; that alone made the W8 rekey
  necessary (deleted in C2).

## Lifecycle triggers (summary of lifecycle-triggers)

Owner corrections, binding:

1. A required delivery is always placed before Doors open. In a non-final
   Ship phase it sits after Wheels open but before the wheels are
   interactable; no after-doors fix is needed (confirmed in six cases).
2. Encounter depth matters for depth-gated room eligibility (read at Doors
   open) and the budget baked at entry. Begin-vs-gate increment timing
   matters only for rolls inside the room between an encounter's begin and
   its gate (Ship next-wheel rolls, per-encounter budgets). C5d audits
   `BiomeEncounterDepth` readers against those cases; the Q1 audit found no
   observable difference today.

| Event                           | Game trigger                                                                | Engine today                   | Fit                            |
| ------------------------------- | --------------------------------------------------------------------------- | ------------------------------ | ------------------------------ |
| Room prepared, entered          | previous door use                                                           | profile ops                    | clean                          |
| Encounter begun (depth++)       | automatic, or an interaction (cage, switch, locked door)                    | folded into encounter started  | fused                          |
| Combat starts                   | automatic, or a gate: Opening reward, Devotion choice, wheel use, intro end | point + windows, C1/C4 patches | slot + patches                 |
| Encounter outcome               | observation (Aetos, Gorgon, Nemesis, Anomaly)                               | outcome point                  | clean                          |
| Encounter end / end effects     | event list returns; Ship waits for required objects                         | point, Ship deferral           | slot + 1 exception             |
| Reward spawn                    | event-list step; Opening first; cages at entry                              | spawn moments                  | clean                          |
| Wheels open                     | next encounter's first event                                                | point (not the first wheel)    | asymmetry                      |
| Doors open                      | readiness predicate: last required removal or encounter end                 | fixed point + required-first   | derivable                      |
| Delivery arrival                | end effects tier B; Preboss flush at entry                                  | windows per room shape         | clean concept, patched windows |
| Switch press, locked door press | interaction starts a fight                                                  | rows                           | target shape already           |
| Leave                           | door use                                                                    | commit, exit                   | clean                          |

Target shape (C5d): items with verbs; each verb has an enabler and
consequences; events have declared triggers (a verb, an event, a predicate
becoming true, an observation). The windows, C1 and C4 patches, the Ship
deferral and Doors open as a slot collapse into "deadline = the first event
that needs the item". Nemesis event boundaries, observations, and
topology stay outside that shape.
