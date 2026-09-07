# Biome Execution Navigation

## Purpose

This document is the durable execution-navigation authority for every fixed
route biome currently modeled by Run Planner:

```text
Underworld: F -> G -> H -> I
Surface:    N -> O -> P -> Q
```

The individual files under [`docs/biomes/`](../biomes/) remain the authority
for complete game rules, source evidence, eligibility, counters, rewards, and
planner simplifications. This document extracts only the facts needed to carry
one validated route through the execution boundary. It gives later-biome work
one normalized source without duplicating each biome's full rule matrix in an
implementation plan.

## Boundary and ownership

The planner engine has already decided the exact selected route and produced
all Room Occurrences. The execution compiler translates that complete-valid
product; it does not regenerate candidates or infer biome policy. The Plan
Executor realizes and observes the published route through two nested owners:

```text
route session
  current selected Room Occurrence
  navigation: incoming reward and complete outgoing exits

room session
  overview: fixed contents and physical placement
  timeline: encounters and consequential player actions
  conformance: published room-exit facts
```

Navigation therefore answers only:

- which occurrence has been entered;
- what incoming reward that occurrence carries;
- which normal and additional exits exist when exits become available;
- which room and reward each exit exposes; and
- which occurrence is expected when the player next enters a room.

Room features, inventory contents, encounter phases, pickups, purchases, and
other room-local actions keep their existing Overview or Timeline owners. A
biome-specific structure appears below when it changes navigation or when its
placement must be published beside navigation, not because navigation takes
ownership of that structure.

## Shared execution rules

### Occurrence identity and traversal

Every entered room is matched to the next selected occurrence by occurrence ID
and game room name. Leaving a room advances the outer cursor. The next room
entry proves which continuation the player took, so there is no independent
"exit selected" conformance checkpoint and no transition replay.

Unselected peer rooms remain published occurrences when the game creates them,
but they are not part of the selected cursor. Fixed Boss and Postboss links are
ordinary persisted occurrences on that cursor, not invisible executor steps.

### Incoming rewards and doors

The incoming reward belongs to the target occurrence. Doors publish their
physical order, target occurrence, visible reward surface, and any additional
exit identity. The runtime may use several native calls to construct them, but
comparison occurs only after the complete exit set is ready.

A reward-free room publishes no incoming reward. A native required reward that
is intentionally simulation-neutral is preserved through its explicit
effect-neutral disposition rather than reclassified as an authored reward.
Grouped reward surfaces such as H cages must remain grouped; they are not
flattened into one ordinary reward merely to reuse the F/G wire shape.

### Additional exits and detours

Chaos and Zagreus Contract are additional physical exits in Overview and are
compared beside normal doors when the exit set is ready. Anomaly is a selected
normal-target replacement whose B room owns one ordinary hidden return. None of
these paths needs a special transition checkpoint: their selected continuation
is proved at the next room entry.

### Completion rooms

A Preboss is always a real occurrence. Depending on the biome, it either takes
over the source's complete physical normal-exit set or remains an eligible
ordinary peer. Selecting it creates the declaration-owned Boss and, where the
route position has one, Postboss occurrences through fixed links.

Boss variant selection is already resolved from Vow of Rivals by the planner.
The executor receives the exact room name and does not interpret the Vow.

## Route summary

| Biome | Entry                    | Ordinary navigation                              | Unique structure affecting execution                            | Completion                                                    |
| ----- | ------------------------ | ------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------- |
| F     | one selected Opening     | standard generated batches                       | natural/Ixion Chaos and Contract use shared additional exits    | takeover Preboss -> Boss -> Postboss                          |
| G     | fixed Intro              | standard generated batches                       | Anomaly replacement and declaration-sized Chaos returns         | takeover Preboss -> Boss -> Postboss                          |
| H     | fixed Intro              | Fields batches with grouped cage reward surfaces | exact Fields placement and multiple cage cycles stay room-owned | four-room eligibility -> takeover Preboss -> Boss -> Postboss |
| I     | fixed Intro              | Clockwork Goal/NonGoal batches                   | Goal is a derived target realization, not another room kind     | retained ordinary Preboss peer -> Boss                        |
| N     | fixed Opening and PreHub | persistent Hub board and ordered visits          | parent-local side-room visits and Hub/parent restores           | completed Hub -> Preboss -> Boss -> Postboss                  |
| O     | fixed Intro              | one physical exit per source                     | ShipCombat phases and wheels determine the outgoing store       | eligibility takeover Preboss -> Boss -> Postboss              |
| P     | fixed Intro              | standard generated two-door batches              | ordered Opening/Follow-up encounter envelope stays room-owned   | takeover Preboss -> Boss -> Postboss                          |
| Q     | fixed Intro              | six declaration-owned candidate stages           | stage identity constrains each ordinary target pool             | width-one takeover Preboss -> Boss                            |

## Erebus (`F`)

- The route begins in one selected `F_Opening01..03` occurrence. Openings are
  start-only and expose one normal exit.
- Subsequent occurrences use ordinary generated batches with declaration-owned
  one- or two-exit width and ordinary incoming rewards.
- Natural or Ixion-provided Chaos and Zagreus Contract use the shared additional
  exit product. A selected Chaos occurrence returns through its own declared
  visible exit count to a fresh F occurrence.
- At `biomeDepthCache = 10`, `F_PreBoss01` atomically takes over every normal
  exit: exit 1 is the Shop occurrence and a second exit, when present, is a
  free RunProgress occurrence.
- The selected Preboss links to the planner-resolved Hecate Boss variant and
  `F_PostBoss01`, then to `G_Intro`.

F adds no execution-navigation primitive beyond the shared generated batch,
additional exit, takeover, and fixed-link products.

## Oceanus (`G`)

- `G_Intro` is the fixed reward-free entry occurrence.
- Ordinary sources expose declaration-owned two- or three-exit generated
  batches. The supported planner trace assumes the picked physical exit is
  already open; optional locked-exit combat is outside the current product.
- An eligible normal target may be replaced by one Anomaly B occurrence. That
  occurrence owns one fresh hidden G return and otherwise traverses like an
  ordinary one-exit room. Reverting the replacement restores the displaced G
  target rather than preserving a second detour topology.
- Chaos and Contract remain shared additional exits. Each selected Chaos map
  publishes its declaration-owned visible return width.
- At `biomeDepthCache = 8`, `G_PreBoss01` takes over every normal exit: the first
  target is the Shop and the remaining one or two targets are free RunProgress
  occurrences.
- The selected Preboss links to the planner-resolved Scylla Boss variant,
  `G_PostBoss01`, and `H_Intro`.

## Mourning Fields (`H`)

- `H_Intro` is the fixed entry occurrence.
- Every ordinary Fields decision resolves its batch-wide `min` or `max` cage
  outcome before target preparation. A target's active cage rewards are its
  declaration-owned grouped door-offer surface; H has no ordinary outgoing
  RunProgress/MetaProgress store.
- The target occurrence owns its exact player-entry, cage, optional-reward, and
  Nemesis physical-point assignments. These are room Overview/Layout facts,
  not new route edges.
- Entering a Fields room runs a fixed Passive phase followed by two or three
  active cage cycles. Those cycles and their mixed acquisitions remain one room
  Timeline. Navigation becomes usable only after the room's required actions
  clear.
- `H_PreBoss01` becomes required after four entered H combat, miniboss, or
  Bridge occurrences. Chaos contributes its declared depth effects but does
  not count as one of those four qualifying occurrences.
- The takeover follows the predecessor's physical normal exits: exit 1 is the
  Shop and exit 2, when present, is a free RunProgress occurrence.
- The selected Preboss links to the planner-resolved Cerberus Boss variant,
  `H_PostBoss01`, and `I_Intro`.

H execution therefore needs one exact grouped cage-offer product and one exact
room-placement product. It must not translate Fields into a sequence of fake
rooms or make cage pickups into doors.

## Tartarus (`I`)

- `I_Intro` initializes five Clockwork Goals and the authored non-goal cap.
- A Clockwork batch creates targets in physical order. The first eligible combat
  target receives the derived Goal realization; a later combat peer may retain
  its declaration-owned non-goal reward while capacity remains.
- Goal/NonGoal is occurrence-owned derived state. It is not a persisted room
  variant or encounter choice. The selected room declaration still determines
  whether its ordinary Combat uses the normal or Small encounter set.
- `I_PreBoss02` is an ordinary retained peer, not a takeover. It may appear
  beside another target; only selecting it begins completion and materializes
  its `I_WorldShop` inventory.
- The selected Preboss links to `I_Boss01`. The supported fourth-position route
  has no Postboss occurrence.

I needs an explicit Clockwork target realization on the execution product, but
the game module must not independently count Goals or choose Goal encounters.

## Ephyra (`N`)

- Normal entry is `N_Opening01 -> N_PreHub01 -> N_Hub`. Natural Chaos may be
  selected from Opening and returns to a fresh Hub while skipping PreHub.
- The Hub board is generated once. It contains nine or ten open fixed slots and
  their complete incoming offers before the first visit. Returning to the Hub
  restores that same board; it does not regenerate rewards or create another
  occurrence.
- Exactly six distinct open main targets are visited in authored order. Each
  visited target is an ordinary occurrence with its own room session, incoming
  reward, pylon completion, and return to the persistent Hub.
- A visited combat target may own one parent-local side-room region. Generated
  side rooms are real occurrences with their own rewards and room sessions.
  Side-room visits return to the persistent parent; completing the parent then
  returns to the Hub. Side visits do not consume one of the six Hub visits.
- Side rooms record room and encounter-completion history but do not advance
  encounter-use, room-upgrade, or pending Shrine-delivery clocks. That
  declaration-owned suppression must be present before N execution is enabled;
  it is not inferred from the side-room name by the executor.
- Hub and parent restores are reference-only navigation contacts. They do not
  replay Overview, Timeline, resource, or reward generation.
- A complete six-visit Hub owns one fixed handoff to `N_PreBoss01`. Selecting
  it links to the planner-resolved Polyphemus Boss variant, `N_PostBoss01`, and
  `O_Intro`.

N requires explicit persistent-board, ordered-visit, local-side-region, and
restore products. It must not be flattened into ordinary generated batches or
one Hub-wide Timeline.

## Thessaly (`O`)

- `O_Intro` is the fixed entry. Every supported normal source has one physical
  `ShipsExitDoor`, so the selected continuation is declaration-derived rather
  than a user-authored fork.
- A ShipCombat occurrence contains Intro, Combat 1, and optional Combat 2
  phases. Wheel 1 belongs to Combat 1 and Wheel 2 to Combat 2; their authoring
  controls appear at the preceding next-phase boundary. These are room-local
  Timeline phases, not exits or subordinate rooms.
- Each active wheel owns its complete one- or two-offer cohort and selected
  reward. The final active wheel supplies the outgoing reward-store provenance.
  The target declaration then decides whether that store is consumed,
  overridden, discarded, or retained only as entered-store history.
- No door or room feature becomes usable between ShipCombat phases. The one
  room-level exit is realized only after the final active phase.
- At the eligibility frontier (`biomeDepthCache = 7` on the standard route),
  `O_PreBoss01` performs a width-one takeover containing only the World Shop.
- The selected Preboss links to the planner-resolved Eris Boss variant,
  `O_PostBoss01`, and `P_Intro`.

O requires phase-aware room execution and the final-wheel outgoing-store fact;
it does not require a new route topology.

## Mount Olympus (`P`)

- `P_Intro` is the fixed entry and exposes two physical exits. Ordinary P
  sources use declaration-owned one- or two-exit generated batches with indoor
  and outdoor compatibility already resolved by the planner.
- Ordinary P combat contains an Opening encounter followed by a terminal
  Follow-up encounter. Heracles in the first position terminates the suffix;
  the standard PreCombat phase does not. Icarus and Athena remain Follow-up
  choices. These phases are one room session, not separate occurrences.
- A successful Fig Leaf result suppresses enemies without deleting either
  prepared encounter identity or the terminal encounter-end checkpoint.
- Natural Chaos uses the shared additional-exit and fresh-return model.
- After eight ordinary batches, `P_PreBoss01` takes over the physical normal
  exits: the first target is the World Shop and a later target, when present,
  is a free RunProgress occurrence.
- The selected Preboss links to the planner-resolved Prometheus Boss variant,
  `P_PostBoss01`, and `Q_Intro`.

P reuses ordinary navigation. Its unique work is the ordered multi-encounter
room Timeline and native preparation of the selected prefix.

## Summit (`Q`)

- `Q_Intro` is the fixed entry.
- Six declaration-owned stages constrain the exact candidate pool: foyer,
  first fork, first miniboss, ordinary room, second fork, and second miniboss.
  Their concrete room declarations retain their own one- or two-exit widths.
- Stage identity is structural planner output. The executor receives exact
  target occurrences and never infers or advances a stage counter itself.
- After the second miniboss, the ordinary stage frontier is empty and
  `Q_PreBoss01` performs a width-one takeover containing only `Q_WorldShop`.
- The final Preboss also owns the source-backed forced Hermes delivery. Its
  pickup and World Shop purchases share one room Timeline, so the published
  dependency order determines whether the delivery can affect later purchase
  payloads. This currently unimplemented planner surface must close before Q
  execution is enabled.
- The selected Preboss links to `Q_Boss01`. The supported fourth-position route
  has no Postboss occurrence.

Q needs stage identity only when it is required to bind the correct native
generation contact. It must not introduce a second staged candidate evaluator.

## Publication requirements for a biome slice

A biome becomes executable only when the engine product and strict protocol
publish every execution-relevant fact above without compiler inference. The
slice must provide:

1. the complete selected occurrence cursor, including fixed completion rooms;
2. all created normal and additional peer occurrences needed by native door or
   board realization;
3. exact incoming reward and outgoing reward surfaces, including grouped or
   source-derived forms;
4. the smallest explicit biome-owned structural product named above;
5. existing Overview, Timeline, and room-exit conformance products for every
   selected occurrence; and
6. a native adapter that realizes those facts and proves room identity and the
   complete exit set at the shared checkpoints.

The compiler may reject a biome whose required structural product is absent.
It may not reconstruct that product from game names, authored UI state, or
runtime counters.

## Deferred routes

Dream Dives may reorder F-Q rooms and use different route-position completion
behavior. The fixed-route facts above remain reusable, but Dream Dives require
their own route-order, entered-biome-count, Preboss, and Postboss authority
before publication. They must not be approximated by making the fixed-route
executor infer a route from room names.
