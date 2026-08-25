# Room Lifecycle Model

## Purpose and Authority

This document defines the ordered single-room lifecycle that turns one entered
Room Occurrence into a canonical history fragment. It owns the semantic timing
of room preparation, entry, encounters, counter effects, room-owned offer
generation, reward acquisition, outgoing-door generation, purchases,
room-history commit, and exit.

`GAME_GENERATION_RULES.md` owns how an outgoing batch selects and creates its
targets. `REWARD_MODEL.md` owns what offers and acquisitions mean.
`SIMULATION_AND_VALIDATION.md` owns how the simulator composes room fragments,
folds their events into ledgers, and reports findings. Concrete biome documents
own exceptional local phases and select the lifecycle profiles used by their
rooms.

The lifecycle is catalog-derived simulation behavior. It is not persisted UI
state and is not an execution script authored by the user.

The design concept previously described as a "single-room history profile" is
split deliberately into the reusable `RoomLifecycleProfile` declaration and
the concrete `RoomHistoryFragment` it produces. This keeps the recipe distinct
from recorded history.

## Evidence Status

The general separation between target generation, entry, acquisition, and
later outgoing generation is verified against the Hades II extraction. The
midshop ordering was specifically re-audited on 2026-07-19 against:

```text
../../1GameData/Scripts/RoomLogic.lua
../../1GameData/Scripts/EncounterData.lua
../../1GameData/Scripts/EncounterData_Unique.lua
../../1GameData/Scripts/EncounterData_Devotion.lua
../../1GameData/Scripts/EncounterSets.lua
../../1GameData/Scripts/EncounterLogic.lua
../../1GameData/Scripts/InteractLogic.lua
../../1GameData/Scripts/UpgradeChoiceLogic.lua
../../1GameData/Scripts/RewardLogic.lua
../../1GameData/Scripts/RunLogic.lua
../../1GameData/Scripts/StoreLogic.lua
```

Relevant call sites are:

- `EncounterSets.lua:446-453`, `UpgradeChoiceLogic.lua:1035-1066`, and
  `InteractLogic.lua:1124-1149`: an ordinary encounter spawns its reward after
  combat, and completing a loot or consumable pickup removes the required
  object before outgoing exits unlock;
- `EncounterData_Devotion.lua:34-54`, `EncounterLogic.lua:1682-1730`, and
  `RewardLogic.lua:395-398`: Devotion selects and acquires the chosen source
  before starting combat, then spawns the spurned source after combat;
- `RoomLogic.lua:4372-4394`: the prior room is committed, the next room becomes
  current, and `RunShopGeneration` resolves shop inventory;
- `StoreLogic.lua:150-196`: ordinary shop Boon sources resolve while inventory
  is generated;
- `EncounterData_Unique.lua:15-30`: Shop is a noncombat encounter;
- `RoomLogic.lua:1848-1940`: the encounter completes and initiates exit unlock;
- `RoomLogic.lua:3871-3961`: outgoing rooms and their rewards are generated;
- `StoreLogic.lua:1134-1295`: later player purchases remove options and apply
  their effects;
- `RewardLogic.lua:187-207` and `RunLogic.lua:1819-1845`: ordinary source
  support reads acquired `LootTypeHistory`, plus explicit peer exclusions, not
  unpurchased shop offers.
- `RoomLogic.lua:1900-1903`: every counting encounter increments room, biome,
  and route encounter depth when that encounter starts;
- `RoomLogic.lua:4372-4394` and `RunLogic.lua:1857-1869`: the source room is
  appended to history and depth caches are recomputed after its outgoing batch
  exists but before the selected target's encounter preparation and shop
  generation;
- `RunLogic.lua:1912-1928`: biome-local encounter depth and related ledgers
  reset at the layout-owned biome transition rather than at an arbitrary room
  event.

Focused biome authorities remain responsible for verifying that each special
room selects an accurate profile. A new lifecycle profile is not considered
closed until its ordering has a game-data audit and a canonical fixture.

## Game Event Concordance

The planner's lifecycle vocabulary names semantic state boundaries. Those
names must remain tied to the game functions and state transitions that make
the boundary observable. They are not assumed to be one-to-one wrappers around
Lua functions: the game sometimes spreads one semantic transition across
several calls, and the planner intentionally groups a few source sequences.

Every boundary is classified as one of:

- **Exact**: the planner boundary corresponds to a directly observable game
  state transition, even if one game function performs surrounding work too;
- **Grouped**: the planner intentionally treats several ordered game steps as
  one atomic boundary; or
- **Derived**: the boundary names a useful state interval or capability that
  follows from game state but is not dispatched as one universal game event.

### Shared correspondence

| Planner seam                    | Engine authority                                                  | Game-data anchor                                                                                                                                                                                                             | Status and exact meaning                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Room preparation                | `prepareRoom` and entry-time `materializeOfferPoint` operations   | `LeaveRoom` commits the source, selects/records the next room's encounter data, assigns `CurrentRoom`, and runs `RunShopGeneration` before map load (`RoomLogic.lua:4372-4394`)                                              | **Grouped.** Preparation is later than predecessor commit and earlier than the target's `StartRoom`. It must not regenerate the incoming room or reward already attached to the chosen door.                                                                                                                                                                                                     |
| Room entered                    | `enterRoom`; editor `roomEntered` boundary                        | `StartRoom` begins the entered room and applies room-entry state/hooks (`RoomLogic.lua:1067-1342`)                                                                                                                           | **Exact semantic transition.** The next room is already current and its entry-time preparation already exists. `roomEntered` does not include predecessor commit or target generation.                                                                                                                                                                                                           |
| Start encounter                 | `startEncounter(phase)`; editor `encounterStart` boundary         | `StartEncounter` marks the encounter in progress, records it as active, and applies definition-owned encounter-depth changes before running its event sequence (`RoomLogic.lua:1848-1919`, especially `1897-1905`)           | **Grouped player-facing boundary around an exact engine transition.** It begins the closed mandatory start sequence and ends with the encounter active. When no unrelated player action can interleave, that sequence may also contain a required pre-combat choice such as Devotion's chosen source or a Ship wheel selection. `StartEncounterEffects` alone is not the universal anchor.       |
| Encounter completed             | `completeEncounter(phase)`                                        | after `RunEvents` returns, `StartEncounter` removes the active encounter, marks it complete, and updates completion caches before applying encounter-end effects (`RoomLogic.lua:1919-1939`)                                 | **Exact internal checkpoint.** Completion identity, encounter-local offers, and phase blockers settle here even when the phase is noncombat, skipped by Fig Leaf, or declares `SkipEndEncounterEffects`. It is not a separate player-facing timeline row.                                                                                                                                        |
| Encounter ended                 | `encounterEndEffectsApplied`; editor `encounterEnd` boundary      | `StartEncounter` runs applicable `EndEncounterEffects` after completion and only then checks exit readiness (`RoomLogic.lua:1919-1939`)                                                                                      | **Exact post-state when end effects apply.** Encounter-use effects and newly materialized deliveries are visible to later actions. Noncombat and declaration-owned `SkipEndEncounterEffects` phases complete without emitting this event; their visible End encounter boundary remains the completion edge before the next phase or room work. A Fig Leaf spawn skip alone does not suppress it. |
| Required-object barrier cleared | Room Action dependencies and fixed roster checkpoints             | `CheckRoomExitsReady` requires no `RoomRequiredObjects`, no blocking screens, no incomplete required active encounter, and a completed multiple-encounter sequence (`RoomLogic.lua:3100-3129`)                               | **Derived barrier.** There is no authored action named “clear barrier.” Each object/encounter completion changes the inputs; the first successful readiness check authorizes the next fixed transition.                                                                                                                                                                                          |
| Outgoing batch generated        | `generateOutgoingBatch`; internal `outgoingGeneration` checkpoint | readiness calls `UnlockRoomExits`, which reaches `DoUnlockRoomExits`; that function creates/restores target rooms and resolves their incoming rewards before making doors usable (`RoomLogic.lua:3778-3844`, `3871-3988`)    | **Exact internal checkpoint.** It is the point after target identity/reward materialization is frozen. It remains simulation/history authority but is not a player-facing timeline row. `room.ExitsUnlocked = true` at the beginning of `UnlockRoomExits` is not itself the generation checkpoint.                                                                                               |
| Cleanup · Doors open            | editor `cleanup` interval anchored to roster `exitUsable`         | after target generation, `DoUnlockRoomExits` creates door previews and sets each eligible `door.ReadyToUse = true`; its callbacks enable the Well, purge shop, Surface Shop, and related objects (`RoomLogic.lua:3778-4094`) | **Derived player-facing interval.** It begins only when every required action has resolved and the door or equivalent continuation is usable. Eligible optional actions may occur before or after this boundary; door-open-only contacts occur after it. Using the selected continuation ends the interval.                                                                                      |
| Exit usable                     | roster `exitUsable` capability/checkpoint                         | door interaction checks the room-readiness and `ReadyToUse` facts established by the unlock path (`RoomLogic.lua:757-789`, `3996-4010`)                                                                                      | **Exact capability that anchors Cleanup.** It remains an engine predicate for profiles with a door or another continuation, but is not rendered as a second sibling row. Required actions cannot follow it; later optional actions do not mutate the already-generated outgoing batch.                                                                                                           |
| Room committed                  | `commitRoom`                                                      | `LeaveRoom` appends the source room to `RoomHistory` and updates run-history caches before preparing the selected target (`RoomLogic.lua:4372-4394`)                                                                         | **Exact semantic transition.** Commit occurs after the source's outgoing batch and supported remaining local work. It is not the moment doors first become usable.                                                                                                                                                                                                                               |
| Room exited                     | `exitRoom`                                                        | the selected door invokes `LeaveRoom`; after source leave effects and commit, the selected target becomes `CurrentRoom` and map loading begins (`RoomLogic.lua:4159-4400`)                                                   | **Grouped transfer.** The operation closes the source fragment and hands the already-generated target to preparation/entry. It does not choose or regenerate the target.                                                                                                                                                                                                                         |

The editor boundary order describes semantic visibility, not a literal call
stack. `cleanup` is the one player-facing final-room interval and is labeled
**Cleanup · Doors open**. Outgoing generation and `exitUsable` remain distinct
engine facts because candidate history and required-object validation need
their exact positions, but neither is a separate rendered row. The timeline
must not imply that an optional cleanup action is required before leaving.

### Biome-specific correspondence

#### Devotion

Devotion's chosen-source decision and acquisition occur before combat, followed
immediately by the encounter start; the spurned source is created only after
combat (`EncounterData_Devotion.lua:34-54`, `EncounterLogic.lua:1682-1730`).
The game exposes no unrelated room feature, door, or free room action between
the required first choice and combat activation. The player-facing Start
encounter boundary therefore groups that closed mandatory sequence without
moving the two producer roles: chosen remains before combat and spurned remains
after End encounter.

#### Noncombat and Story encounters

The game still records and runs a Story encounter through `StartEncounter`,
but its `EncounterType = NonCombat` skips combat start/end effects. The planner
therefore preserves the encounter identity, history, NPC interaction, trait
offer, and any exact pickup timing while omitting player-facing Start encounter
and End encounter boundaries. This same rule applies to all `nonCombat` phase
kinds. Only `combat`, `miniboss`, and `boss` phase kinds render a combat spine.

#### Automatic Boss/Postboss occurrences and Judgment

The automatic Boss occurrence has the fixed `BossRoom` lifecycle. Its player-facing timeline is `Room
entered -> Start encounter -> Boss defeated -> End encounter -> Cleanup · Doors
open`. `Boss defeated` is an exact derived seam before generic encounter-end
effects. When Judgment is active, it is one engine-owned fixed effect at that
seam, not a Room Action or persisted ordering value. Its exact existing
The occurrence-plus-phase Judgment Arcana address owns the editor, candidate frontier, finding,
and semantic command. End encounter remains the later seam for post-encounter
delivery. A reached Steady Growth threshold then settles after End encounter
and before Cleanup.

The automatic Postboss occurrence uses the same timeline presentation without a
combat interval. Its active shape is `Room entered -> ranked actions
-> Cleanup · Doors open`: `Use fountain` is required and a replacement's
`Choose keepsake` rack action is required when a replacement is selected. The rack may be ordered before or
after the fountain; Cleanup follows the last required action. The automatic
occurrence lifecycle still runs its noncombat entry sequence after `roomEntered`
and before the first ranked player action, but those internal boundaries are
not rendered as encounter rows. The action roster and exact occurrence owner
carry the persisted order, immediate equip result, findings, and history.

These interactions emit exact ranked-action events. `fountainUsed` carries a
`RoomActionSemanticAddress`: an ordinary Reprieve event is owned by that
occurrence, while a Postboss event is owned by its automatic occurrence action address.
`keepsakeRackUsed` carries the same `RoomActionSemanticAddress` and is emitted only
by the active Postboss rack action. The event owners are the same semantic
owners consumed by the Room Action roster and history fold; neither event is
reconstructed from a rendered row or a generic room checkpoint.

#### Mourning Fields

`StartFieldsEncounter` rejects a new cage while another required encounter or
an object with `BlockFieldsEncounterStart` remains active, then configures the
cage encounter and calls `StartEncounter`. Only after that synchronous
encounter returns does it enable the cage reward and destroy the cage obstacle
(`EncounterLogic.lua:2890-2947`).

Fields has a fixed lifecycle skeleton and an authored cage permutation. After
room entry, each active cage occupies exactly one ordinal encounter cycle:

```text
Room entered
  optional pre-combat pickups
Start first chosen cage encounter
End first chosen cage encounter
  between-encounter actions
Start second chosen cage encounter
End second chosen cage encounter
  between-encounter actions
... one cycle per remaining active cage ...
Cleanup
```

The declaration supplies two or three active cage identities; the order of the
existing cage actions chooses which identity occupies each ordinal cycle. The
planner's `completeFieldsCage` reference remains a **grouped simplification**
of cage activation through synchronous encounter completion. Derived
`encounterStart` and `encounterEnd` seams bracket it, and no modeled action may
occur between those seams. This deliberately omits optional pickup interaction
during an active wave.

After one cage ends, its reward becomes available. That reward may remain on
the ground while another cage starts. A phase-produced object with
`BlockFieldsEncounterStart`, notably Gorgon Athena, must instead resolve before
the next chosen cage may start. This dependency follows the authored encounter
order, never declaration slot order. Optional minor rewards are room-wide and
may occur before the first cage, between cage cycles, or after the final cage.
Cleanup requires every still-required cage reward and dependent required
pickup before exit use; optional minors may remain. The passive entry phase
remains declaration-owned evidence but does not create another player-chosen
cage cycle.

#### Thessaly ShipCombat

The game executes the active multiple-encounter list sequentially from
`StartRoom` (`RoomLogic.lua:1319-1334`). For a normal Ship combat phase:

1. `ShipsEncounterSetup` generates and exposes the wheel options, waits for
   `ShipsEncounterSelected`, and then starts encounter effects
   (`RoomLogic.lua:1375-1446`);
2. `UseShipWheel` records the selected store/reward on the current encounter;
3. the encounter event sequence runs combat, spawns the selected room reward,
   and calls `WaitForNextEncounterReady`
   (`EncounterSets.lua:474-490`, with Icarus/Heracles variants at `550-593`);
4. `WaitForNextEncounterReady` does not return while a required object or a
   blocking choice/dialog screen remains (`RoomLogic.lua:1369-1373`); and
5. only then can `StartRoom` advance to the next selected encounter.

The planner's `nextPhaseUsable(wheel)` is consequently a **derived Ship-only
barrier**, not a free action and not one Lua callback. It means the preceding
phase's required-object wait has cleared and the next phase's
`ShipsEncounterSetup` may expose its wheel. Wheel configuration belongs at
that next-phase boundary; `chooseRewardWheel` records the player's selection,
and the selected pickup remains after the matching encounter end. There is no
room-level Cleanup between Ship phases: room features and physical exits remain
unavailable. O uses one final Cleanup only after the final active encounter and
its required post-combat objects have resolved.

#### Ephyra restoration

`RestoreUnlockRoomExits` restores a persistent parent/Hub room and its door
state. It does not replay `StartRoom`, its encounters, or its earlier local
actions. The planner therefore treats Hub/main/side traversal and restoration
as topology between distinct entered-occurrence fragments, not additional
`roomEntered`, `encounterStart`, or `encounterEnd` events inside one room
timeline.

### Rule for adding or moving a boundary

A new lifecycle seam, or a change to an existing seam's position, is not
complete until its owner records:

1. the exact game function/state transition or the explicit grouped/derived
   rationale;
2. the pre-state it reads and the post-state later rules may observe;
3. its relation to required objects, active encounters, generated offers, and
   already-frozen outgoing targets;
4. whether optional actions may occur on both sides of the seam;
5. the declaration/profile scope in which it exists; and
6. a fixture that fails if the seam crosses an incompatible Room Action window
   or changes source history.

Application and React code may label and group these engine facts. They must
not position a semantic boundary by comparing display labels, biome names, or
incidental numeric action ranks when the lifecycle profile or roster already
owns the relevant window/checkpoint relation.

### Room Action roster boundary

Semantic action producers contribute explicit `RoomActionContribution`
products. The one `assembleRoomActionRoster` authority receives those
contributions together with the owning occurrence's
authored `roomActions.order` and returns the complete roster consumed by
lifecycle, validation, candidate, and workspace products. Producers do not
register callbacks, mutate a hidden
registry, or communicate action membership through sidecar state.

Roster assembly reconciles every authored and derived key exactly once:
ranked active actions become the executable chronology, active but unranked
actions remain explicit incomplete rows, and ranked keys whose action is no
longer active remain stale repair rows. Invalid or incomplete authorship is
therefore retained for correction rather than dropped or silently reordered.
There is no parallel Fields, Shop, Acquisitions, or presentation-owned action
assembler and no second order authority.

The same pure structural action domain also classifies required participation
for semantic commands. When a command newly activates required actions, the
engine extends the one authored order with their deterministic latest legal
schedule: lifecycle windows and dependencies constrain placement, existing
rows keep their relative order, and stable contribution order breaks otherwise
equal ties. An unrelated retained-invalid row or a pre-existing missing
prerequisite does not reject the edit or become silently repaired. Missing
required authorship remains a supported incomplete state with one canonical
late restore position.

### Lifecycle structure and derived authoring timeline

The pure action domain publishes one closed `RoomLifecycleStructure` from the
resolved lifecycle profile and its active declaration-owned phase scope. Its
ordered points are the rigid room skeleton: `roomEntered`, each exact
`encounterStart` then `encounterEnd`, Ship `nextPhase` seams, internal
outgoing-generation, and final `cleanup`. The same frozen structure is carried
by the `RoomActionRoster` and consumed by required-action scheduling,
lifecycle execution, checkpoint assembly, and `RoomLifecycleTimeline`.
None of those consumers may reconstruct phase membership or boundary order
from authored action ranks.

When encounter preparation assesses a suffix as dormant, the engine scopes
that same structure and roster to the assessed active phase prefix for both
execution and workspace projection. An invalid terminating selection does not
fabricate a shorter structure; its later phase remains available for repair.
The application consumes the engine's phase status and scoping operation
rather than deciding suffix activity from the selected encounter label.

The roster remains authoritative for active action rows, dependencies,
proposals, stale repair, and structural validity. The timeline places those
exact roster keys into the structure's flexible intervals. It may carry
declaration-owned phase identity and before/action/after placement, but never
tabs, labels, callbacks, or another eligibility/order calculation.

An action rank selects only the inter-action slot to which a boundary is
anchored. The lifecycle profile and its active phase order independently own
the structural boundary sequence: Room entered, each phase's Start then End,
the next-phase seams between phases, and the profile-specific final seams. If
retained-invalid action ranks imply contradictory boundary anchors, the
timeline keeps the authored action order for repair and moves the later
semantic boundary forward to the earliest compatible slot. It never sorts
Start and End by display priority or permits End to precede its matching Start.

The player-facing timeline renders one final **Cleanup · Doors open** at the
`exitUsable` rank and renders neither `outgoingGeneration` nor `exitUsable` as
a peer row. Encounterless and Shop profiles omit
invented encounter seams. Fields Passive is Room Entered setup, while every
structurally active cage owns a rigid Start/End cycle in the structure's
authored cage permutation. A missing cage-completion action remains a repair
row but cannot erase that cycle. Ship phase grouping consumes the same
structure's phase attachment; the application does not place wheel or action
rows by rank arithmetic.

The editor presents this product through Room Overview, Room Timeline, and Room
Doors. Overview declares room-local setup, Timeline resolves the one chronology,
and Doors edits the occurrence-owned outgoing decision. These are transient
views over unchanged semantic owners, not persisted lifecycle events or a
second room model.

### Lifecycle Run State checkpoints

Room-local Run State is a derived diagnostic at exact lifecycle checkpoints.
An ordinary occurrence publishes `roomEntered` and `beforeRoomExit`; a
ShipCombat occurrence instead publishes one `beforeEncounterStart` checkpoint
for each active phase plus `beforeRoomExit`. Entry consumes the existing entry
history, each Ship phase consumes the history fold captured immediately before
its `encounterStarted` event, and pre-exit consumes post-commit room-local
settlement immediately before `roomExited`.

These checkpoint addresses and snapshots are not authored or persisted. A
structurally retained occurrence beyond progressive coverage may expose a
disabled launcher, while an occurrence absent from the materialized prefix
publishes none. The `beforeTargetGeneration` product remains internally useful
for generation assessment, but only N's Hub-board and Hub-sourced Preboss
generation exceptions retain public launchers. A literal pre-exit snapshot must
not replace or relabel either exception. N parent and Hub restoration replay no
lifecycle and therefore create no duplicate Run State checkpoint.

## Core Model

A generated target and an entered room are different semantic objects in time.
The predecessor creates the target occurrence and resolves its incoming reward
offer. Only the picked target is later entered and executes a room lifecycle.

```text
source room reaches outgoing generation
  -> create every target occurrence in physical exit order
  -> resolve every incoming target offer
  -> complete any remaining source-room operations
  -> leave through the selected target
      -> execute that target occurrence's room lifecycle
```

The lifecycle is an ordered transition over immutable simulation state. Every
operation reads the state produced by earlier operations and returns the next
state plus zero or more canonical events. No later operation rewrites an event
or generated target that already exists.

The critical rule is:

> An outgoing batch is validated and materialized from the exact history visible
> at its generation operation. Later acquisitions never retroactively change
> that batch's room identities, rewards, offer projections, or legality.

Preparing the next entered room also starts its empty current-room use record.
Current-run and biome-use records persist. This reset occurs at preparation,
before an entered WorldShop materializes its inventory, because that room is
already the game's current room at that point.

## Vocabulary

`RoomLifecycleProfile`
: A normalized reusable declaration that derives the ordered semantic
operations for one entered room shape from its Room Declaration and complete
room-local materialization. Rooms select a profile through their declaration
or normalized template/encounter composition. Bounded authored phase choices
may select operations within the profile; they do not author the operations
themselves.

`RoomLifecycleOperation`
: One member of the closed semantic operation vocabulary. Operations express
observable game ordering, not presentation callbacks or elapsed frames.

`RoomLifecycleEffect`
: One typed state transition activated while an operation executes. The owning
declaration determines whether and how the effect applies; the lifecycle
profile determines when it can run.

`RoomLifecycleEvent`
: One immutable room-addressed fact emitted after an effect is applied.
Authored and automatic rooms use their occurrence address. Events are folded into ledgers and
retained as ordering evidence. An operation may emit zero, one, or several
events.

`RoomHistoryFragment`
: The concrete room-addressed event sequence produced by executing one
lifecycle profile against one entered room and its resolved local state.

`Outgoing-generation checkpoint`
: The operation at which the layout-owned next batch is evaluated and
permanently materialized from the current state.

`Entry history`
: The canonical state visible after preparation and entry but before
room-local encounter or acquisition effects occur.

`Preparation history`
: The post-predecessor-commit state used to select entry-time encounter phases,
shop inventory, and other room-owned prepared facts. It is later than the
predecessor's outgoing-generation state.

`Exit history`
: The state after every supported local acquisition and exit effect has run. It
is threaded into the already-generated picked target's preparation.

`Automatic Postboss action`
: A ranked action owned by an automatic Postboss occurrence. `Use fountain` is
required; `Choose keepsake` is the required rack interaction created by a
replacement. Its position determines which equipped keepsake and fountain
effects later actions observe.

## Ownership

| Concern                                                 | Owner                             |
| ------------------------------------------------------- | --------------------------------- |
| Ordered room operations and their state visibility      | Room lifecycle profile            |
| Concrete room, envelope-slot, encounter, and exit facts | Room Declaration                  |
| Encounter counting and phase-local effects              | Encounter/phase declaration       |
| Target structure and outgoing batch attachment          | Biome layout                      |
| Biome transition resets                                 | Route/biome layout                |
| Incoming and room-owned authored reward values          | Room Occurrence leaf state        |
| Acquisition roles emitted at lifecycle points           | Reward producer/type declarations |
| Counter and ledger effect implementations               | Pure simulator registries         |
| Event folding and possibility branching                 | Simulator                         |
| Legality at an operation's pre-state                    | Validator                         |
| Rendered controls and sequencing explanation            | Editor projection                 |

The simulator must not switch on a concrete room name to reconstruct ordering.
The editor must not persist lifecycle operations or history snapshots.

### Postboss Keepsake Ordering

The route enters each automatic Postboss occurrence with the keepsake used for the Boss.
Boss Judgment therefore observes the old keepsake. The occurrence roster contains required
`Use fountain`; a replacement also contributes optional `Choose keepsake`.
The authored order may place the rack before or after the fountain. Immediate
equip results occur when the rack action executes, so the fountain observes the
old or new keepsake according to that order and later acquisitions observe the
resulting state.

The rack is a shared Room Action owned by the exact Postboss occurrence, not a
fixed lifecycle seam. Retention records no rack action; replacing and returning
to retain atomically adds or removes its required membership while dormant equip
detail remains authored. Final-tail Postboss interactions remain active.

## Closed Operation Vocabulary

The initial semantic vocabulary is deliberately small:

```ts
type RoomLifecycleOperation =
  | { kind: 'prepareRoom' }
  | { kind: 'materializeOfferPoint'; offerPoint: string }
  | { kind: 'enterRoom' }
  | { kind: 'startEncounter'; encounterRole: string }
  | { kind: 'completeEncounter'; encounterRole: string }
  | { kind: 'runEncounterSequence' }
  | { kind: 'runRewardEncounterSequence' }
  | { kind: 'advanceProducer'; point: ProducerLifecyclePointKey }
  | { kind: 'generateOutgoingBatch' }
  | { kind: 'settleAcquisitionPoint'; point: string }
  | { kind: 'commitRoom' }
  | { kind: 'exitRoom' };
```

This is the stable semantic vocabulary. Production TypeScript may use narrower
field names and grouped operation inputs, but it must preserve this ownership
and ordering contract.

`prepareRoom` resolves bounded room-entry structure from the state after the
predecessor commits. It selects encounter phases and other entry facts; it does
not reconsider the room or incoming reward already generated by the
predecessor. `materializeOfferPoint` covers room-owned offers rather than
incoming door offers. Initial examples are entry-generated shop inventory and
O's internal reward wheels. `advanceProducer` does not regenerate an offer; it
advances an already-resolved producer and emits the acquisition roles bound to
that point. `commitRoom` appends declared history and updates commit-time
caches before the selected target prepares.

`runEncounterSequence` executes every already-prepared active phase of one
Encounter Envelope in declaration order. It emits start, definition-owned
depth advancement, and completion for each phase. H uses it for the passive
Fields phase followed by the active two- or three-cage prefix. Cage reward
offer and acquisition events remain separate local producers rather than being
hidden inside this encounter operation.

`runRewardEncounterSequence` adds declaration-owned phase offer points around
that same encounter sequence. For every selected O ShipCombat phase it emits
the phase offer before encounter start and the picked acquisition after
encounter completion when the phase declares an offer point. Intro has no
offer: the ordinary Intro definition is non-counting, while a selected
Heracles Intro increments encounter depth once. Combat1 and the conditionally
selected Combat2 each increment encounter depth once, materialize one complete
active wheel jointly, and acquire only its selected offer. The canonical room
passes the selected encounter-phase prefix to the executor; the executor
rejects a non-prefix selection or omission of a required phase.

History exposes both materialization and acquisition checkpoints for each
phase offer point. Reward simulation evaluates all active offers at the former
state, consumes only the picked offer at the latter state, and resolves the
room's outgoing store from the final active wheel. The acquisition event also
records that active wheel's selected store in entered-store history before a
later phase or room can evaluate reward-ratio support. A two-wheel room
therefore contributes two ordered store entries; dormant wheel capacity emits
no lifecycle or store-ledger event.

Encounter record history retains the concrete definition, envelope, stable slot,
and exact room origin. Consumers must not recover those facts from a maximum
capacity Room Declaration: an H Min outcome activates only its two-cage prefix
even though the declaration's complete envelope retains the third cage.

Do not introduce an unrestricted callback or event DSL. Add or split an
operation, effect, or event kind only when audited game behavior has an
observable distinction that the closed vocabulary cannot represent correctly.

### Concrete Encounter Preparation

`prepareRoom` resolves an active room's Envelope slots from the
post-predecessor-commit checkpoint. A fixed binding supplies its exact
definition; a pool-backed binding supplies the room instance's exact authored
definition. For each valid active slot, preparation appends an
`encounterRecorded` event before entry. The event carries the definition key,
envelope key, stable slot key, and exact room-instance origin.

A later slot in the same room evaluates against the preceding recorded prefix.
It can therefore observe exact earlier encounter identities, while encounter
counters remain at the post-predecessor snapshot until the matching
`encounterStarted` event. Previous-room spacing is a different view: it
examines committed predecessor room origins and excludes every slot owned by
the room currently being prepared. These are checkpointed projections of one
canonical event fold, not a profile baseline, provisional counter slate, or
NPC-specific ledger.

An active retained selection that fails its requirements is not replaced.
Preparation keeps its exact phase address available for correction, emits no
substitute definition, and stops canonical execution before that phase's
start, counter, reward, completion, or room commit. Later structurally active
slots remain authorable from the valid record prefix. A valid
definition-owned `terminateSuffix` effect may end the remaining active
sequence; an invalid selection never performs that trim. Dormant slots retain
their authored choice but emit no lifecycle product.

`encounterStarted` applies only the resolved definition's encounter-depth
effect. `encounterCompleted` stays at its declared later lifecycle point.
`encounterEndEffectsApplied` follows that completion only for a resolved phase
whose declaration permits the game's end effects. It is absent for noncombat
and `skipEndEncounterEffects` phases; Fig Leaf's skipped execution does not by
itself remove it. N entered side-room occurrences execute their own preparation
and lifecycle in authored `enteredOrdinal` order before the corresponding
parent restore. The same ordered history therefore supports ordinary rooms,
O/P/H multi-phase rooms, and N side-room occurrences without a second
encounter engine.

Steady Growth consumes this existing `encounterEndEffectsApplied` seam. Each
qualifying emitted event advances every equipped Steady Growth acquisition
once; source-declared skipped subrooms do not advance it. A reached threshold
settles its authored rarity target immediately at that checkpoint and publishes
one fixed automatic timeline effect after End encounter. It is not a movable
Room Action, and it does not introduce a second lifecycle clock or scheduler.

## Operations, Effects, and Events

Operations, effects, and events are deliberately different concepts:

```text
RoomLifecycleProfile selects an operation
  -> operation reads its exact pre-state
  -> declarations select applicable typed effects
  -> simulator applies each effect
  -> immutable RoomLifecycleEvents record what occurred
  -> next operation receives the resulting state
```

For example, `startEncounter(main)` does not hard-code counter arithmetic into
a one-phase room profile. It resolves the already-prepared concrete encounter
definition. When that definition counts for encounter depth, the operation
applies the room, biome, and route encounter-depth effects and emits addressed
counter-change events before combat continues.

Likewise, `commitRoom` does not blindly increment every depth axis. It applies
the Room Declaration and layout's commit policy, appends the appropriate room-
history fact, recomputes `runDepthCache` and `biomeDepthCache`, advances the
route-wide room-history ordinal when declared, and emits the corresponding
events. A biome reset is a later layout transition effect, not a hidden part of
an arbitrary room profile.

The first expected effect families are:

- room preparation and resolved encounter-sequence facts;
- room appearance and current-room facts;
- required-object spawn and completion facts;
- encounter occurrence, start, completion, end-effect application, and
  counting-depth changes;
- room creation, offer, counted-bag, and offer-projection changes;
- concrete acquisition and acquisition-driven counter changes;
- shop purchase and active-option changes;
- room-history commit, depth-cache, and route-ordinal changes;
- biome transition resets outside the completed room fragment.

Effect kinds and event kinds use closed registries with strict normalization.
They are additive when new audited behavior becomes observable, but an unknown
kind is a catalog or construction error rather than a silent no-op.

## Operation Timing Matrix

| Operation                 | State it observes                                      | Typical effects and emitted facts                                                                            |
| ------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `prepareRoom`             | Post-predecessor-commit history                        | Resolve encounter sequence, optional phase support, and other entry materialization                          |
| `materializeOfferPoint`   | The operation's current state                          | Resolve room-owned shop or wheel offers, consume bags, and apply offer projections                           |
| `enterRoom`               | Prepared room state                                    | Emit semantic appearance/current-room facts and activate the entered occurrence                              |
| `spawnRequiredObjects`    | Entered-room state                                     | Emit declaration-owned required-object spawns and activate their exit blockers                               |
| `startEncounter`          | State before the declared encounter phase              | Emit encounter occurrence/start and increment declared room, biome, and route encounter-depth axes           |
| `completeEncounter`       | State after the phase's combat or noncombat work       | Emit completion facts, release phase-local blockers, then emit end-effect application when declared          |
| `completeRequiredObjects` | State after the declared required-object work          | Emit paired completion facts and release the corresponding required-object blockers                          |
| `advanceProducer`         | State at the producer's named point                    | Resolve acquisition roles, project loot/use history, and update acquisition-driven counters                  |
| `generateOutgoingBatch`   | Current state before this room commits                 | Create targets sequentially, resolve incoming offers, consume counted bags, and apply offer projections      |
| `settleAcquisitionPoint`  | Already-generated outgoing batch plus active inventory | Execute the exact active Room Action acquisition references assigned to this lifecycle point                 |
| `commitRoom`              | State after supported room-local work                  | Append declared room history, recompute depth caches, advance route ordinal, and record entered-store policy |
| `exitRoom`                | Committed source state plus selected generated target  | Close the fragment and transfer control to the selected target's preparation                                 |

The table describes semantic visibility, not elapsed time or presentation
callbacks. An effect belongs at the earliest operation after which a supported
game rule can observe it.

## Canonical Lifecycle Profiles

### Standard Reward Room

```text
prepareRoom
enterRoom
startEncounter(main)
completeEncounter(main)
advanceProducer(roomRewardPickup)
generateOutgoingBatch
commitRoom
exitRoom
```

The incoming offer was resolved by the predecessor. Its concrete acquisition
updates history before the outgoing batch is evaluated, so the next rooms and
rewards observe it.

The reward pickup is also represented by the canonical acquisition-settlement
product for its exact producer point. Its participation and order are derived;
the lifecycle does not persist or render a second control for an unavoidable
singleton reward.

### Narcissus Story Room

```text
prepareRoom
enterRoom
advanceProducer(beforeCombat)
startEncounter(main)
completeEncounter(main)
advanceProducer(afterCombat)
advanceProducer(roomRewardPickup)
generateOutgoingBatch
settleAcquisitionPoint(roomExit)
commitRoom
exitRoom
```

The selected Narcissus trait is resolved during the encounter-owned choice and
enters equipped history. Its declaration-owned pickup producer settles at the
occurrence-owned `roomExit` point after the outgoing batch is frozen. Their
authored order therefore affects later route state without regenerating the
current doors. A pickup owns its exact reward, trait offer, or level-resolution
child; those children are not nested under the outer Narcissus option. The
consequential concrete set includes Ashes, Psyche, Bones, Max Magick, Max
Health, and Death Defiance; each remains optional and independently ordered.

The same acquisition-entry seam hosts all current generated pickups. A normal
Quick Buck, Buried Treasure, equipping Narcissus acquisition, or selected
Nemesis random-event result activates its
declaration-owned entries at its declared pickup window; source selection alone
does not. Sea Star adds one later source-scoped entry after an eligible normal
free pickup. A Nemesis interaction is required and every active event result
entry depends on it; accepted trades are required while free-item and contest
results retain ordinary optional participation. The source action and generated
action remain in the occurrence's one ordered Room Action roster, so a
generated result can affect later rooms without regenerating the current
outgoing batch. Direct Shop purchase actions remain atomic and do not emit any
alternate pickup interaction; a free entry generated in that Shop room is a
distinct pickup action.

### Opening Reward Room

```text
prepareRoom
enterRoom
advanceProducer(roomRewardPickup)
startEncounter(OpeningGeneratedF | OpeningGeneratedN)
completeEncounter(OpeningGeneratedF | OpeningGeneratedN)
generateOutgoingBatch
commitRoom
exitRoom
```

F and N Opening declarations share this ordering. Their encounter starts late
and the room waits for its reward pickup first. `N_PreHub01` uses the standard
combat-then-reward profile, while its encounter declaration keeps that combat
non-counting. The mandatory-action scheduler reads the Opening declaration's
exact profile, so a newly created Opening places its incoming pickup before
`startEncounter` rather than applying the ordinary after-combat reward alias.

### Ephyra Main Target

```text
prepareRoom
enterRoom
spawnRequiredObjects(SoulPylon)
advanceProducer(beforeCombat)
startEncounter(main)
completeEncounter(main)
completeRequiredObjects(SoulPylon)
advanceProducer(afterCombat)
advanceProducer(roomRewardPickup)
generateOutgoingBatch
commitRoom
exitRoom
```

Devotion, when supported by a producer, still emits its chosen and spurned
roles at their declared before/after-combat points. The required Soul Pylon
spawns at entry and completes after combat but before reward pickup, local
side-room generation, or exit. Ephyra side rooms use the standard
combat-then-reward order without outgoing generation; the persistent Hub uses
entry, one stable-board generation, commit, and exit without a producer.

### Devotion Room

```text
prepareRoom
enterRoom
advanceProducer(beforeCombat)
startEncounter(main)
completeEncounter(main)
advanceProducer(afterCombat)
generateOutgoingBatch
commitRoom
exitRoom
```

The chosen and spurned sources acquire at different points, but both precede
outgoing generation. Devotion's spacing projection remains an offer-time event
that occurred when the predecessor generated this room.

### World Shop

```text
prepareRoom
materializeOfferPoint(shopInventory)
enterRoom
generateOutgoingBatch
settleAcquisitionPoint(roomExit)
commitRoom
exitRoom
```

Shop inventory and the outgoing batch both observe pre-purchase acquisition
history. The full generated inventory is the current-room shop option set while
the outgoing batch is evaluated. Purchases update history only after that batch
already exists.

Purchase participation and order are both the exact `interactShopOffer`
references in the occurrence's one `roomActions.order`. The editor's Purchased
marker only inserts or removes that reference; the engine walk still performs
the purchase when it reaches the ranked action. Unpurchased initial offers do
not become active timeline or generic repair rows. A retained stale purchase
remains removable through its specialized participation intent.

The Shop purchase action settles the paid acquisition completely. It does not
become an acquisition-entry source or expose Time Piece, Artificer, or Sea
Star. This applies to Shop Poms as well: their declaration can be duplicable
in a free lifecycle, while the paid instance cannot duplicate. Free
declaration-produced entries in the same Shop occurrence are independent
pickup actions and retain their own capabilities.

Travel Deal and Gold Gold Gold continue to derive their trigger from that true
action order. The selected source slot is not a complete payload-authoring
context: the generated payload must be evaluated against the exact history
prefix at the triggering action. A forced or ordinary Hermes delivery in
`Q_PreBoss01` may lock the god pool if acquired before the World Shop purchase
and cannot do so retroactively if acquired after it. The Shrine source action
and its later required pickup remain distinct room owners, while both use this
same ordered room fold.

### Room Features at Cleanup

Purging Pool sales, Shrine purchases, and Well purchases are optional ranked
`RoomActionReference` variants in their host occurrence's one action order. A
Pool and Well may use their feature-local **Interact** boundary: until then
their live random inventory remains dormant and no action is active. World Shop
and Shrine inventories are always fully authored; neither receives that
convenience because their visible identities affect outgoing generation.

Well purchases settle immediately as paid effects and never invoke free-pickup
alternatives. A Shrine purchase instead either rushes into a required same-room
pickup at that one action rank or derives a later required pickup at the
reached encounter-end host. Automatic Boss occurrences are ordinary later
delivery hosts. No feature owns a private purchase order or a completion-only
settlement path.

The selected next room is therefore also already created and rewarded before
the purchase. Shop acquisitions first affect generation when that selected
room later reaches its own outgoing-generation checkpoint. This is the precise
meaning of shop purchases having a one-room-delayed effect on room generation;
the acquisition itself is not delayed.

Canonical support fixture:

```text
commit predecessor with 3 acquired ordinary sources
  -> prepare WorldShop and materialize its inventory
  -> enter WorldShop
  -> shop inventory offers a 4th source
  -> outgoing batch offers a 5th source
  -> player purchases the 4th source
  -> player enters and may acquire the already-offered 5th source
```

This trace is valid. Validating the outgoing fifth source against post-purchase
history would be an ordering bug.

### Ordered Multi-Encounter Room

O and later multi-phase rooms compose the same operations rather than owning a
separate history engine:

```text
prepareRoom
enterRoom
startEncounter(intro)
completeEncounter(intro)
materializeOfferPoint(wheel1)
startEncounter(combat1)
completeEncounter(combat1)
advanceProducer(wheel1Acquisition)
... optional declared phases ...
generateOutgoingBatch
commitRoom
exitRoom
```

The concrete O authority owns its exact active phases and offer points.
`prepareRoom` derives whether its conditional phase exists from pre-room state;
a counter increment from an earlier phase cannot retroactively add another
phase. The shared lifecycle model owns their ordered execution and state
visibility.

P consumes that same ordered engine without a P-only runtime profile. Its
declaration-owned `Intro` and `Combat` positions are prepared sequentially, so
the terminal position observes the first position's recorded identity. A valid
`terminateSuffix` first selection leaves the stored Combat choice dormant and
executes only that first position; otherwise both positions start and complete
in order. The ordinary pre-combat declaration completes but suppresses end
effects, while the terminal declaration completes and emits
`encounterEndEffectsApplied`. A successful Fig Leaf result propagates skipped
execution across the prepared prefix without deleting either completion or the
terminal end-effect event.

### Mourning Fields Combat Room

```text
prepare all cage offers and encounter identities
enter room
materialize active Fields optional offers
apply Passive entry effects
run optional pre-combat actions
for each active cage in authored order:
  start the chosen cage encounter
  complete that encounter atomically
  run legal between-encounter actions
resolve every remaining required cage/dependent pickup
generate outgoing batch
publish exit usability and room features
enter Cleanup · Doors open
run any remaining eligible optional actions
commit and exit when chosen
```

The Fields action sequence is the room's only chronology, but it is not an
unconstrained list. The active cage count creates a fixed sequence of ordinal
Start/End encounter pairs, and the ordered cage references assign cage
identities to those pairs. Flexible actions occupy the room-entry,
between-encounter, pre-door, and post-door Cleanup intervals according to
their engine-owned availability. One cage action atomically
represents activation through encounter completion because pickup interaction
during an active combat wave is outside the supported model. Cage reward
interaction becomes ready only afterward and never blocks a later cage merely
because it remains unpicked. A phase-produced blocking NPC does block that
later start. Every interaction uses the shared acquisition settlement fold.

Selecting Artificer at a source interaction consumes the current
`RunProgress` bag and creates, but does not acquire, its source-owned
replacement. A required cage transfers its obligation to a later replacement
action; an optional Fields source may omit that action and leave the
replacement behind. Several conversions may therefore precede every generated
replacement acquisition. The sequence does not create a Fields-private
acquisition fold or Artificer-private order.

### Preboss and Persistent Structures

A selected Preboss completes its declaration-owned normal-door batch, enters
through its normal room lifecycle, and then begins the layout-owned completion
sequence. A persistent Hub may generate a stable board once and later emit
restore fragments. Those are structural compositions of room-addressed
fragments, not reasons to weaken the ordering contract or introduce UI-shaped
rows into history.

## Counter and Cache Timing

Counter names that sound similar are not interchangeable, and they do not
advance at one generic "room completed" point.

### Encounter Depth

When a declared encounter phase counts, `startEncounter` increments:

- the current room's encounter depth;
- `biomeEncounterDepth`;
- route-wide encounter depth.

The increment occurs before the encounter's combat work, completion, reward
pickup, and outgoing generation. A room with several counting phases can
therefore increment encounter depth several times while contributing only one
later room commit. A non-counting phase emits its occurrence/start facts but no
depth effect.

Phase structure that the game prepares before room entry reads preparation
history. It cannot become active because another phase increments
`biomeEncounterDepth` later in the same room. O's conditional Combat2 is the
first concrete fixture for this rule.

### Depth Caches and Room-History Ordinal

`runDepthCache`, `biomeDepthCache`, and route-wide room-history ordinal advance
at `commitRoom`, after the source's outgoing batch has already been generated.
Consequently:

- the source room's outgoing room and reward choices read its pre-commit depth
  caches;
- the source room's counting encounters may already have changed encounter
  depth when those outgoing choices are generated;
- committing the source updates depth caches before the picked target executes
  `prepareRoom`;
- the picked target's prepared encounters and shop inventory see the committed
  predecessor depth;
- the picked target does not contribute its own depth-cache increment until it
  later commits.

Layout initial counters describe the state before the fixed start commits;
they are not a replacement for that room's declaration-owned contribution.
F and N begin new routes at `biomeDepthCache = 0`. Later biomes begin at
`biomeDepthCache = 1` after the prior biome transition. In both cases, a
supported Opening or Intro with a one-step room-history contribution generates
its outgoing target from the initial source depth and advances the cache once
at commit. Candidate evaluation consumes the recorded source view directly and
must not add that contribution speculatively.

The semantic `enterRoom` event may record that an occurrence was entered, while
game-shaped room-history caches remain commit-time effects. Consumers must name
the exact ledger they require rather than treating "appearance" and "committed
room count" as the same timestamp.

### Generation and Acquisition Counters

Each physical target creation inside `generateOutgoingBatch` immediately
updates creation history before the next peer is evaluated. Incoming offers
likewise consume counted bags and apply offer projections in physical order.
None of those target offers enter acquisition history unless that occurrence
is later picked and its producer advances.

Acquisition-driven counters update at their producer point. Examples include
loot/use histories, ordinary-source history, Clockwork Goal progress, and I's
non-goal acquisition count. A final room aggregate cannot safely reconstruct
these intermediate views.

I initializes `clockworkGoalsRemaining` from the declaration-owned Clockwork
`initialGoalCount` (currently `5`),
`clockworkNonGoalRewardsAcquired = 0`, and the authored
`clockworkMaxNonGoalRewards` at `biomeStarted`. Every generated batch records
that exact pre-generation view before its targets are created. An entered Goal
emits `clockworkGoalAcquired` immediately after room entry and clamps the
remaining count at zero; an entered concrete NonGoal emits
`clockworkNonGoalRewardSpawned` at its actual reward-spawn boundary and advances
only the non-goal count. Ordinary rewards spawn after encounter completion;
Devotion spawns before its declared before-combat acquisition. Unpicked offers
emit neither event. The preboss carries Goal structurally and therefore only
confirms the already-zero state.

### Biome Transition Resets

Biome-local resets occur after the declared completion sequence at the layout
transition boundary. They are not `exitRoom` defaults and are not repeated by
every room profile. The next biome starts from the reset state plus any
route-wide history retained by its declared transition policy.

The initial closed transition vocabulary is one ordered `resetCounter` effect
over `biomeDepthCache` or `biomeEncounterDepth`. Every current layout declares
both effects in that order. Route encounter depth and room-history ordinal are
not biome-local and therefore receive no reset event.

## History Views and Composition

Composition begins with one addressed `biomeStarted` event whose payload owns
the biome's exact layout-declared initial counter state. For F that state is
`biomeDepthCache = 0`, `biomeEncounterDepth = 1`, route encounter depth `1`,
and room-history ordinal `0`. The opening's later commit applies its declared
`biomeDepthCache = 1` delta. These are separate events so generation contacts
never depend on an implicit fold initializer or a hidden opening exception.
G begins at `biomeDepthCache = 1` and `biomeEncounterDepth = 1`, matching the
game's between-biome depth baseline. Its route encounter depth and room-history
ordinal are carried from F after F's declared biome-local resets.
N is the first Surface biome and starts at `biomeDepthCache = 0`,
`biomeEncounterDepth = 1`, route encounter depth `1`, and room-history ordinal
`0`. Its Hub history additionally initializes generated-side-room and Soul
Pylon spawn/completion counters at zero.

Every fragment exposes conceptually distinct states:

```text
predecessorOutgoingGenerationHistory
  -> predecessor remaining local operations
  -> predecessorCommittedHistory
  -> prepare selected room
  -> preparationHistory
  -> enter selected room
  -> entryHistory
  -> ordered local operations before outgoing generation
  -> outgoingGenerationHistory
  -> generate and freeze outgoing batch
  -> ordered remaining local operations
  -> commit current room
  -> committedHistory
  -> exitHistory transferred to the selected target
```

The simulator need not persist a full state snapshot at every operation. It
must preserve the event order and be able to evaluate each rule from its exact
pre-operation view.

Fragment composition threads state while following the picked target:

```text
current RoomHistoryFragment
  -> generated target occurrences and incoming offers
  -> remaining current-room operations and commit
  -> picked target preparation and RoomHistoryFragment
  -> generated target occurrences and incoming offers
  -> ...
```

Unpicked targets contribute creation, offer, bag-consumption, and offer-
projection events at the source room's outgoing checkpoint. They never execute
an entered-room fragment and never emit concrete acquisitions.

Each physical target has a `roomCreated` event followed by a
`targetGenerationCompleted` marker. Room/reward legality, incoming-offer, bag,
and offer-projection events occupy that interval in physical order. Commit 4
initially contains only creation in the interval; later reward integration may
insert its events without moving either boundary or changing the target's
pre/post generation views.

## Possibility and Validation

An operation may branch when several outcomes have positive support, including
counted-bag explanations, generated-store outcomes, or reward-source outcomes
within one authored `roomActions.order`. Each branch still has
one total event order. Equivalent post-operation states may be merged while
retaining at least one witness.

Validation occurs at contact points in that order:

1. catalog normalization validates profile operation kinds and references;
2. room/template normalization validates profile compatibility;
3. lifecycle execution validates authored offers and acquisitions against the
   state visible at their operation;
4. outgoing generation validates the authored batch against its exact
   generation history;
5. fragment composition validates the picked continuation and folds the result;
6. findings address the owning occurrence, offer point, acquisition, or batch,
   never a rendered row.

A final flattened history is insufficient evidence that every intermediate
decision was possible. The simulator must retain ordered events or equivalent
operation witnesses so validation cannot accidentally use a later state for an
earlier decision.

## Additive Extension Contract

The lifecycle model is intentionally extensible, but it is not a mirror of all
game callbacks. A new operation, effect, or event kind is justified only when
its ordering changes a supported declaration, authored choice, history ledger,
validation result, execution instruction, or runtime conformance finding.

Extension procedure:

1. identify the observable consumer and the exact missing distinction;
2. locate the game-data call sites and determine the relevant pre/post state;
3. decide whether the behavior is room-local, encounter-local, reward-local,
   layout-structural, or route-structural;
4. reuse an existing operation with a new declaration-owned effect when only
   state mutation differs;
5. add a new operation only when existing operations cannot express the
   required ordering;
6. add normalized references, strict dispatch, events, ledgers, and fixtures
   together;
7. update the concrete biome authority and this shared lifecycle authority.

Likely room-local additions include wells, gathering, challenges, and other
optional interactions when they enter product scope. Persistent NPC entities
may transform or insert encounter phases during `prepareRoom`. A Chaos or
Anomaly detour changes route structure and therefore composes at outgoing
generation through a layout/route feature; it must not be disguised as a local
room event.

Presentation-only callbacks remain excluded. Unknown or deferred behavior is
documented in audits and suppressed according to the owning feature contract;
it does not become a generic production `unsupported` operation.

### Anomaly, Zagreus, and Chaos inserted-room ordering

Anomaly and `C_Boss01` use the ordinary entered-occurrence lifecycle. Their
automatic host target is generated at their outgoing-generation checkpoint:
after entry-time and room-local effects (including reward acquisition), but
before their own commit-time room history, route ordinal, `runDepthCache`, and
host `biomeDepthCache` effects. The room then commits and the generated target
enters automatically. The target is a distinct, normal host target with a
normally selected and consumed reward; automatic and hidden are presentation
and traversal facts, not an accounting-free callback.

Anomaly's fixed `GeneratedAnomalyB` uses the normal counting encounter path;
its retained incoming offer is acquired only when authored success is true.
`C_Boss01` runs fixed `BossZagreus01`, acquires `InfernalContractBoon`, and
does not advance encounter depth. Both once-per-route limits are consumed only
when the inserted occurrence enters, not when an authored replacement or
additional exit is created.

Natural Chaos is likewise created at its source's outgoing-generation
checkpoint, but its declared `Chaos_01`–`Chaos_06` room runs `Empty_Chaos`,
acquires direct `TrialUpgrade`, and applies its own declared depth effects.
Its following host target is generated by the ordinary player-selected Chaos
decision rather than an automatic return callback. The offer ledger is distinct
from entry: skipped and selected gates consume the same source offer, while
only selected Chaos runs the inserted-room lifecycle.

## Audit and Fixture Requirements

Every lifecycle profile must record:

- the game-data functions or declarations establishing its order;
- which operations read pre-event versus post-event state;
- every declaration-owned effect and emitted event kind;
- encounter-start and completion counter effects;
- commit-time depth/cache/ordinal effects;
- every offer point and acquisition point;
- the outgoing-generation checkpoint, or the reason it has none;
- any intentional simplification, deferral, or exclusion;
- at least one canonical event-order fixture.

Timing fixtures should assert both events and observable state boundaries. The
initial conformance set must include:

- a standard room whose acquired reward affects its outgoing batch;
- a Devotion whose first and second acquisitions straddle combat;
- a WorldShop whose purchase does not affect its already-generated outgoing
  batch, including the fourth-shop-source/fifth-door-source trace;
- an unpicked target whose offer affects offer history but never acquisition
  history;
- an O `ShipCombatRoom` with selected `HeraclesCombatO` at Intro, proving that
  its counting record precedes the later active main phases without trimming
  the suffix, and with the active Combat2 wheel retaining its independent
  offer/acquisition timing.

Each profile audit should use this compact record:

```text
Profile:
Concrete rooms/templates:
Game-data evidence:
Prepared structure:
Ordered operations:
Declaration-owned effects:
Pre/post state read by each rule:
Outgoing-generation checkpoint:
Commit behavior:
Exact / Simplified / Deferred / Excluded notes:
Required fixtures:
```

Future runtime mismatch reports should identify the room occurrence, lifecycle
operation, expected pre-state, observed event, and subsequent divergence. A
mismatch updates the relevant lifecycle profile or audit; the game module must
not grow an independent timing workaround.

## Implementation Boundary

Pure reward and shop transitions operate against explicit fact snapshots.
Lifecycle-profile execution decides when a room invokes those transitions and
fragment composition threads the resulting state between rooms.

For shops, the required orchestration is:

```text
commit predecessor
  -> prepare shop from committed predecessor history
  -> validate/materialize shop inventory from preparation history
  -> enter shop
  -> generate outgoing batch from the same pre-purchase history
  -> execute participating `roomActions.order` entries in the post-outgoing Shop window and
     derive exit history
  -> commit and exit the shop
  -> prepare and enter the already-generated picked target
```

Calling shop purchase simulation before outgoing generation would violate this
document even if the final acquisition ledger looked plausible.
