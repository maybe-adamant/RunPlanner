# Room Occurrence and Action Chronology Implementation

## Status

Locked delivery plan on clean base
`8e8f83e26cec58fabdf4d147c70f6f285012063c`. Final adversarial review and
bounded verification are READY. The plan promotes Ephyra side rooms into
ordinary room occurrences, makes normal/additional decision exits lightweight
occurrence-backed door choices, and cuts room-local chronology over to one
shared action authority. The reviews split topology/presentation normalization
from chronology behavior, qualified multi-contact reward actions, preserved
the existing lifecycle/history/reward folds, and made generation handoff,
checkpoint, address, reconciliation, O phase-local generation, validation, and
deletion contracts exact.

This document is temporary delivery authority. It must not be linked from the
README or stable design documents. At phase closure, absorb its durable
conclusions into the smallest owning authorities and delete this file.

Owning evidence:

- [`ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md`](../audits/ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md)
- [`ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md`](../audits/ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md)
- [`FIELDS_OPTIONAL_REWARDS_AND_ARTIFICER_GAME_DATA_AUDIT.md`](../audits/FIELDS_OPTIONAL_REWARDS_AND_ARTIFICER_GAME_DATA_AUDIT.md)
- [`ROOM_LIFECYCLE_MODEL.md`](../design/ROOM_LIFECYCLE_MODEL.md)
- [`AUTHORED_PROJECT_MODEL.md`](../design/AUTHORED_PROJECT_MODEL.md)
- [`REWARD_MODEL.md`](../design/REWARD_MODEL.md)
- [`SIMULATION_AND_VALIDATION.md`](../design/SIMULATION_AND_VALIDATION.md)
- [`CANDIDATE_EVALUATION_MODEL.md`](../design/CANDIDATE_EVALUATION_MODEL.md)
- [`STRUCTURED_EDITOR_WORKSPACE.md`](../design/STRUCTURED_EDITOR_WORKSPACE.md)
- biome authorities for [H](../biomes/H_GAME_RULES.md),
  [N](../biomes/N_GAME_RULES.md), and [O](../biomes/O_GAME_RULES.md)

## Objective

Give every entered room occurrence one coherent chronology of
player-significant actions. Combat-NPC contacts, ordinary room rewards, Shop
purchases and pickups, Fields cages and optionals, O reward wheels, Time Piece,
Artificer transformations, and Artificer replacement pickups participate in the
same occurrence-local product when they physically coexist.

At the same time, make every physically distinct Ephyra main or side room a
real `RoomOccurrence`. Hub choice and local side-room traversal remain
topology; actions performed after entering a target belong to that target's own
occurrence.

Realign decision presentation with that same ownership. Every normal or
additional exit remains backed by its retained continuation `RoomOccurrence`,
but its decision card is only a lightweight door-transition surface: exit
identity, the compact door reward when the source creates one (otherwise its
target/envelope summary), picked state, status/findings, and genuine topology
transitions such as removing an existing Contract or natural Chaos exit and
anomaly takeover/revert.

The visible stage is anchored by the current/source occurrence, not by one of
its targets:

```text
current occurrence workbench
  predecessor-generated handoff edited through its exact reward-owner interaction
  room identity, payloads, encounters, internal state, and—after Gate B—actions
outgoing decision sourced by this occurrence
  lightweight normal/additional exit cards
```

The source occurrence workbench owns creation of an absent source-owned
additional exit, so add and later remove live in the same stage without
inventing an empty exit card. Selecting a normal, Contract, or Chaos target
advances to that continuation's own occurrence stage; it does not replace the
source workbench above the source decision. Because an Anomaly occurrence
cannot replace or restore its own identity, anomaly takeover, replacement-map
choice, and revert remain together on the parent normal-door transition.
Unselected occurrences remain independently addressable for repair; opening
one from a finding or inspector does not change the picked exit. A Hub-sourced
handoff remains inside the Hub topology workbench rather than fabricating an
occurrence source.

The user-visible hierarchy becomes:

```text
Hub
  Main Room 1
    Side Room 1
    Side Room 2
  Main Room 2
```

Opening an entered occurrence presents one `Room Actions` panel. A simple room
may contain only one player action. A complex Fields or O room contains fixed
checkpoints, dependencies, and several reorderable actions in one ranked view.

An occurrence stage therefore presents the current room first and its outgoing
decision second. Picking a normal, Contract, or natural Chaos exit chooses the
next stage without rewriting the source or any retained target. Exit cards do
not host the room reward editor, ordinary/Chaos room editor, Customize surface,
or suggested actions. The anomaly identity controls are the closed
door-transition exception.

The model keeps these questions independent:

1. which room occurrence exists and whether it was entered;
2. which outgoing door and frozen reward identity the preceding generation
   owner produced;
3. which physical or generated objects exist in the entered occurrence;
4. what payload each object owns;
5. which optional interactions participate; and
6. when each participating interaction occurs.

Adding, removing, or editing a participant must never require the current order
to evaluate successfully. Simulation may stop on an incomplete or invalid
ordered prefix, but occurrence, roster, and payload repair remain total.

The program has two inseparable product legs with separate authority. The
decision/occurrence redesign makes doors describe only what was generated and
which continuation was selected. The Room Actions cutover makes the entered
occurrence describe when and how its spawned objects are resolved. Neither leg
may leave door controls deciding pickup chronology or room actions rewriting a
generated door.

## Source Facts and Planner Simplifications

### Source-backed facts

- Encounter completion does not acquire a combat-NPC trait. The NPC and the
  ordinary room reward are distinct interactable objects and may often be
  resolved in either order after combat.
- Required-object clearance controls when an exit or next phase becomes usable,
  but outgoing-room generation may occur at an earlier source-specific
  checkpoint. Generation and exit usability are not one universal boundary.
- Story pickups can be generated after outgoing rewards while remaining
  required before departure. Echo Reward Reward Reward is the current modeled
  example.
- Shops generate outgoing choices independently of optional purchases and
  acquisitions; later Shop actions do not regenerate the already-created exits.
- Gorgon Amulet conditionally creates a required Athena contact attached to an
  exact hosted phase. Athena interaction is distinct from encounter completion
  and from the ordinary selectable P Athena encounter.
- Fields is one physical room. Between modeled waves, unlocked cage rewards,
  realized optionals, NPCs, source transformations, replacement pickups, and
  later cage activations may interleave subject to exact dependencies.
- Artificer destroys the source and creates a separate object. Transformation
  consumes its use and RunProgress bag entry immediately; reward/trait/Pom
  effects occur only when the replacement object is later acquired.
- O is one physical room divided into repeated fixed windows: wheel choice,
  matching combat, phase-produced interactions, required-object barrier, then
  the next wheel/combat window.
- An O ShipCombat target has no ordinary predecessor-generated incoming reward.
  Its retained occurrence declares an Intro-plus-one-Combat or
  Intro-plus-two-Combat envelope. Each wheel's offers are generated only at
  that wheel-bearing phase from the history reached after all prior required
  windows have settled.
- Devotion owns two distinct physical contacts beneath one incoming reward:
  `chosenSource` at `beforeCombat` and `spurnedSource` at `afterCombat`. The
  second contact observes the history produced by the first.
- O wheel choice before combat and acquisition of the selected wheel reward
  after combat are distinct player actions separated by the combat checkpoint.
- N Hub decisions, main-room entry, and side-room traversal are topology.
  Entering a side room creates a distinct room chronology rather than a child
  action list owned by its parent.
- Generated N side rewards remain one parent-local unordered sibling generation
  cohort. Promoting their payloads to occurrences must not independently
  regenerate them, consume reward support twice, or change declaration-ranked
  availability pressure.

### Chosen planner simplifications

- A Fields cage activation and combat wave remain one atomic `Complete cage`
  barrier. Interaction during an active wave is not modeled.
- Fixed lifecycle events are projected into chronology but not copied wholesale
  into authored state.
- Authored order contains references to player-triggered semantic owners, never
  embedded reward, trait, effect, or lifecycle payloads.
- Semantic owners contribute explicit action/checkpoint facts. One room-owned
  assembler produces the roster; there is no mutable registration phase or
  generic scripting language.
- The assembled room-action sequence orchestrates the existing closed lifecycle
  dispatch, history composition, reward processing, and generation authorities.
  It does not replace them with one generic effect interpreter.
- Existing reward bags, trait legality, encounter composition, and
  producer-specific payload policy remain in their current authorities.
- Exit cards remain projections of occurrence-backed generated targets, not a
  second room model. Their compact surface owns door comparison/selection and
  true door transitions only; selected and inspected occurrence workbenches own
  room-internal authoring and state.
- Local side-room nesting is one level deep for supported N topology.

## Locked Model Decisions

The chronology, topology, decision/occurrence presentation, O phase-local
generation, and roster-reconciliation decisions below passed independent
adversarial review and bounded verification.

### 1. Every authored main/local room is a `RoomOccurrence`

Advance schema 45 to strict schema 46. Promote each supported Ephyra side room
from `EphyraSideRoomState`/local-child state into the same occurrence
collection used by ordinary main rooms.

This gate does not promote the catalog-derived Boss/Postboss completion tail
into authored occurrences. Those fixed completion nodes and their existing
completion interactions remain under completion authority; speculative
completion-interaction authorship is explicitly excluded. If a later audited
feature requires reorderable work inside a completion room, it must first
establish a deliberate occurrence/completion contract rather than relying on
this heading.

Local traversal remains topology rather than becoming a room-payload field.
Extend `BiomeTopology.decisions` with an occurrence-sourced decision:

```text
LocalVisitDecision
  kind: localVisit
  sourceOccurrenceId: OccurrenceId
  groupKey: string
  targetsBySlot:
    <slotKey>:
      occurrenceId: OccurrenceId
      generation: generated | notGenerated
  visitOrder: OccurrenceId[]
```

Exact field names may follow nearby model vocabulary, but ownership is locked:

- the `LocalVisitDecision` is sourced by the main occurrence and owns
  local-target topology and visit order;
- the side occurrence owns its ordinary `AuthoredRoomState`, encounters,
  reward/acquisition payloads, room actions, findings, and workspace identity;
- `visitOrder` contains only generated local occurrences owned by that main
  occurrence and has no duplicates;
- an entered local occurrence retains its own history and is not replayed when
  the parent Hub is restored; and
- Hub `openTargets`/`visitOrder` continues to order main-room topology. It
  absorbs neither local visits nor room actions.

Creating a main target creates its declaration-fixed local decision and one
retained occurrence for each supported local slot, including currently
not-generated slots. Closing the main target removes the local decision, every
local occurrence, and their descendants atomically.

The existing pre-entry authoring boundary is preserved exactly:

- a generated but unentered side occurrence is visible beneath its parent and
  exposes its reward payload authoring;
- its encounter picker, active Room Actions, settlement findings, counters,
  and reached-history effects remain withheld until entry; and
- a not-generated slot retains authored payload internally but publishes no
  reachable workspace or active semantic product.

Generation of the side sibling set remains parent-local. One evaluator resolves
all generated side rewards together, preserves declaration-ranked availability
pressure and one-time reward-bag effects, and writes/validates the retained
payloads on the referenced occurrences. It must not evaluate each child through
ordinary independent door generation. Side entry preserves
`IgnoreEncounterUses`; main-room Soul Pylon clearance and parent/Hub restoration
remain fixed topology/lifecycle checkpoints and never replay child generation.

There is no `LocalChildAddress` compatibility branch. Commands, codec,
projection, findings, and navigation use ordinary `OccurrenceAddress` plus the
semantic address inside that occurrence. `LocalRewardAddress` remains only for
actual Fields local rewards.

The replacement topology owners are named up front:

```text
LocalVisitDecisionAddress { sourceOccurrenceId, groupKey }
LocalVisitSlotAddress     { sourceOccurrenceId, groupKey, slotKey }
LocalVisitOrderAddress    { sourceOccurrenceId, groupKey }
```

Their semantic commands are `SetLocalVisitGeneration` and
`ReplaceLocalVisitOrder`. `LocalChildAddress` and `LocalChildGroupAddress` are
deleted rather than aliased or retained as compatibility identities.

### 2. Door generation and room settlement are separate contracts

Door identity is fully independent from reward pickup timing. The
source-generation contract owns:

```text
normal/additional exit identity
target occurrence identity
door reward / incoming producer identity
selection among generated exits
entry-time facts derived from that frozen output
explicit topology replacement such as Contract, Chaos, or Anomaly
```

`door reward / incoming producer identity` is present only when that source
declaration actually creates an ordinary incoming reward. It is not a required
field of every target transition. In particular, an O ShipCombat transition
identifies the target occurrence and may summarize its retained
Intro-plus-one/two-Combat envelope, but it owns no wheel reward identity.

It does not own participation, acquisition disposition, pickup order, fresh
trait/Pom detail, NPC interaction timing, Artificer replacement pickup, or any
other room-action transition.

The selected target occurrence consumes that generated contract and owns:

```text
physical action roster and mandatory/optional participation
encounter and fixed lifecycle checkpoints
NPC and reward interaction order
normal / Time Piece / Artificer source resolution
dependent replacement pickup
trait, Pom, history, and effect settlement
```

Picking a door selects the continuation and its incoming facts. It does not
pick up the reward, settle an encounter/NPC, spend Time Piece or Artificer, or
insert/move an action. Editing the generated door identity causes a fresh pure
evaluation and derives a reconciliation product for the future occurrence
roster without executing it or rewriting the authored action order.
Editing participation, payload detail, or action order never regenerates,
reselects, or rewrites the door batch.

O is the deliberate non-incoming-reward stress case. Its `wheel1` offer domain
is evaluated at the first wheel checkpoint. Only after Combat 1 and every
required reward/NPC/dependent action in that window settle does the engine
evaluate `wheel2`. A retained Wheel 2 payload may remain structurally authorable
before that checkpoint, but it is dormant/unassessed rather than treated as a
door-generated reward. The final outgoing door decision is generated only
after the last active O window clears.

The persisted reward payload may remain on its exact occurrence/reward owner;
this contract describes semantic generation and settlement authority, not a
UI-driven storage move. Application projection may present predecessor-owned
door facts in the selected occurrence workbench, but its commands retain their
exact engine owners. The boundary must be observable in command types,
projection products, undo entries, and tests rather than inferred from visual
placement.

### 3. Every occurrence owns one authored action order

Gate B advances schema 46 to strict schema 47. Every `RoomOccurrence` owns:

```text
roomActions:
  order: RoomActionReference[]
```

`RoomActionReference` is a closed union of stable references to current
occurrence-local semantic owners:

```text
completeFieldsCage       { phaseKey }
interactIncomingReward   { producerPoint, acquisitionRole }
interactLocalReward      { groupKey, slotKey }
chooseRewardWheel        { wheelKey }
interactWheelReward      { wheelKey }
interactShopOffer        { offerKey }
interactEncounter        { phaseKey }
interactGorgon           { phaseKey }
interactAcquisitionEntry { siteKey, entryKey }
```

`producerPoint` and `acquisitionRole` are declaration-owned reward-kernel
identities, not copied effect payload. They allow Devotion's `chosenSource` at
`beforeCombat` and `spurnedSource` at `afterCombat` to be two stable contacts
without duplicate references. Ordinary single-contact rewards contribute their
one declared point/role.

`chooseRewardWheel` is the mandatory pre-combat player action that fixes
`pickedOfferIndex`; `interactWheelReward` is the mandatory post-combat action
that acquires the selected concrete offer. Combat is a fixed checkpoint between
them. Both are distinct from offer authoring, and implementation retires the
automatic combined `recordPhaseOfferAcquisition` path.

Names may tighten during implementation, but variants may not collapse into a
stringly typed action or embed payload. If preflight finds another supported
player-triggered owner, the plan must name its exact variant before proceeding.
Fixed lifecycle rows/checkpoints are derived and never persisted in `order`.

### 4. Action facts are decentralized; roster authority is singular

Each existing semantic owner returns immutable `RoomActionContribution[]`
from explicit inputs. Contributors include:

- room lifecycle/declaration assembly;
- encounter and Gorgon settlement;
- incoming, local, wheel, and Shop reward owners;
- acquisition-site producers;
- Time Piece/Artificer source roles; and
- H/O lifecycle authorities for fixed barriers/windows.

One pure `assembleRoomActionRoster(...)` receives all contributions plus the
authored occurrence order and returns the complete roster, dependencies,
proposals, and checkpoints. It is the sole chronology authority.

A contribution contains only:

```text
action reference and stable key, or fixed checkpoint identity
exact semantic owner address
required | optional participation
legal lifecycle window
closed dependencies
```

Fixed lifecycle contributors return checkpoint contributions, not player
actions. The dependency vocabulary is closed and domain-named:

- after an exact action or checkpoint;
- before an exact checkpoint;
- required before a later lifecycle barrier; and
- same fixed window.

There is no new mutable registry, module-initialization registration, callback
capability table, generic room-action effect registry, hidden semantic sidecar,
or application-owned contribution. The existing closed lifecycle operation and
effect dispatch remains authoritative, as do canonical history composition,
reward processing, and generation folds. One exhaustive room-action sequence
orchestrator resolves each `RoomActionReference` to its existing semantic owner
and feeds those authorities in roster order. It does not become a monolithic
replacement effect fold.

#### Total reconciliation after roster-shape changes

Generated-door, encounter-identity, reward-identity, and producer-payload
commands never write `roomActions.order`. When one of those edits changes the
active action set,
`assembleRoomActionRoster(...)` reconciles the authored references as a pure
derived product:

- active references whose exact semantic identity is unchanged retain their
  authored rank;
- authored references whose owner is no longer active are retained as explicit
  stale references with remove-only repair and do not execute;
- newly required active references with no authored rank are published as
  unranked required actions with exact insertion proposals; and
- optional active references remain available for insertion without receiving
  an invented rank or participation choice.

The occurrence is incomplete while any required active reference is unranked,
and invalid while a stale authored reference remains. Findings, inspector
destinations, and insert/remove proposals attach to the exact action owner or
stale reference. Structural proposal generation remains total even when the
current executable prefix is invalid. Only explicit room-action commands may
insert, remove, or move these references; reconciliation never auto-appends,
reorders, settles, or deletes authored chronology.

This is especially observable when a predecessor door reward changes between
an ordinary one-contact reward and Devotion's two contacts. The door command
changes only the generated reward identity. Any exact compatible action keeps
its rank, obsolete contacts become stale repair rows, and newly required
`chosenSource`/`spurnedSource` contacts appear unranked until the author places
them around the combat checkpoint. No positional correspondence or default
timing is inferred.

### 5. Payload ownership stays specialized

The action model never owns the payload it resolves:

- room reward state remains on its room/reward owner;
- encounter identity and offer remain encounter-owned;
- Gorgon activation and Athena offer remain keepsake/encounter facts;
- wheel offers and picked identity remain on `RewardWheelState`;
- Shop inventory and derived entries remain Shop-owned;
- acquisition reward/trait/Pom payload remains under exact
  `AcquisitionEntryAddress`; and
- Fields cage/optional payload remains Fields reward state.

An incoming door reward has an explicit cross-occurrence handoff. The preceding
generation contract—an occurrence-sourced exit decision, Hub decision, or local
visit decision—owns creation of the door/visit, its target occurrence, and the
frozen reward identity shown on that transition. An explicit structural
transition such as anomaly takeover/revert or adding/removing Contract or
natural Chaos rewrites that authored generation contract and causes a fresh
evaluation; it is not an in-room action. The target occurrence does not
regenerate its incoming decision. Once entered, its Room Actions chronology
owns what happens to the incoming reward object: ordinary pickup, Time Piece,
Artificer source destruction/use and replacement creation, later replacement
pickup, and resulting trait/Pom/effect settlement. The selected occurrence
workbench may present the predecessor-generated reward fact through its exact
reward-owner interaction, but presentation does not move semantic generation
authority into React or duplicate the reward in occurrence state.

Structural controls choose what exists: reward identity, Shop inventory, wheel
offer set, encounter identity, optional generation, and similar producer facts.
Chronology-sensitive participation and resolution are edited at the action row:

- selected wheel offer at `chooseRewardWheel`;
- acquisition disposition;
- fresh trait offer;
- Pom resolution;
- encounter/NPC outer trait offer; and
- dependent generated-pickup payload.

Structural cards may summarize active payloads but expose no competing editor.
A single-action room still receives one truthful Room Actions row.

### 6. Participation and payload are independent

Mandatory interactions participate. Optional physical objects may retain a
complete payload outside authored order and publish supported insertion
proposals.

Insertion/deletion are structural roster operations. They do not execute the
order, settle rewards, or require unrelated earlier payloads to be valid.
Required actions reject deletion. Dormant/ungenerated actions publish no active
row; reactivation restores retained payload and reconciles participation from
declaration-owned required/optional facts.

Move proposals reuse Hub's ranked interaction language: visible rank,
peer-aware movement, dependency/window explanations, and no move buttons
without peers. Rough Fields and standalone Acquisitions lists are deleted.

### 7. Prefix evaluation is total

Simulation executes actions in order interleaved with fixed checkpoints. It may
stop at the first missing, invalid, or unavailable owner while retaining:

- reached prefix;
- exact blocked action/finding;
- payload and action repair capabilities; and
- structurally available proposals independent of semantic settlement.

Concrete-only evaluators run only after their owner is complete and reached.
Unresolved state is a normal blocked frontier, never an exception or a reason
to suppress unrelated authoring.

### 8. Outgoing generation and exit usability are distinct

The engine derives declaration/lifecycle-specific checkpoints rather than one
universal “outgoing after last required object” row:

```text
outgoingGeneration
exitUsable / nextPhaseUsable
```

For standard and H room windows, `outgoingGeneration` is inserted dynamically
immediately after the last participating required action in the authored
sequence. An optional action before that required action contributes to the
generation history; an optional action after the checkpoint remains executable
but cannot change the batch. The checkpoint therefore moves as required-action
order changes without becoming authored state.

Source-specific profiles may place generation differently. Story-pickup rooms
may generate outgoing first and then require a `roomExit` pickup, such as Echo
RRR, before departure. Shops generate outgoing before optional purchases and
acquisitions. O derives a required-object/next-phase barrier after each active
combat window and outgoing generation only at its declared final boundary. O
wheel rewards are phase-local products, not incoming rewards supplied by the
preceding door.

Outgoing target identity, incoming reward, offer projection, and generation
legality are evaluated from the history snapshot at `outgoingGeneration` and
remain frozen. Later source-room actions may affect only the selected target's
preparation and other explicitly entry-time facts that consume final
post-interaction history. They never regenerate or revalidate the already
created exit choices.

After selection, the generated normal/additional door or local visit contract
becomes the target occurrence's entry contract. When it carries an ordinary
incoming reward, that reward identity remains the generation owner's frozen
output for the evaluation while participation, disposition, acquisition order,
nested trait/Pom resolution, and effects belong exclusively to the target
occurrence chronology. O ShipCombat carries only its target/envelope into the
room; its wheel rewards are generated later by that occurrence's phase
checkpoints. Both forms are handoffs between generation and settlement, not
shared mutable ownership.

The plan reconciles two owning audits explicitly: the room-action audit's
last-required-object rule owns standard/H windows, while the acquisition
delivery audit owns post-outgoing Shop, Narcissus, and Echo settlement points.
Neither is promoted into a universal fallback.

Fixed checkpoints are visible but not authored, movable, or removable. UI must
not imply generation and departure are the same event.

### 9. Artificer intent, produced identity, and pickup are separate

`AcquisitionDisposition` becomes intent-only:

```text
normal | timePiece | artificer
```

`dispositionByAcquisitionRole` remains because roles are reward-kernel facts,
but Artificer disposition no longer embeds replacement payload.

The source contribution carries exact source `AcquisitionSiteAddress` and
occurrence-local `siteKey`. Selecting Artificer activates a stable
source-derived entry stored under that site:

```text
RoomOccurrence
  acquisitionSites[siteKey]
    pickupEntries[entryKey]
```

A Fields source stays at its Fields acquisition site and never converges into
generic `roomExit`.

There is one engine-owned, collision-safe
`acquisitionSiteStorageKey(AcquisitionSiteAddress)` projection. It includes the
exact semantic site owner and point, is used by codec, commands,
materialization, reconciliation, and roster contributions, and round-trips to
the attested exact site address within its occurrence. No command looks up a
site by `roomExit`, by point alone, or by occurrence alone. Dedicated witnesses
cover distinct Fields cage and optional sites with equal entry-role names.

Chronology is exact:

1. missing/invalid replacement identity blocks at source before spending;
2. complete identity consumes one use and exact bag entry, destroys source, and
   materializes replacement;
3. generated entry later settles reward and fresh trait/Pom child; and
4. missing trait/Pom blocks dependent pickup, not transformation.

The dependent row follows its source. Required status transfers from a required
source; optional sources create optional pickups. Switching away/back retains
dormant payload without publishing the dormant row.

No pending registry, private order, duplicate bag, source-nested editor, or
application repair policy may remain.

### 10. Encounter contacts join chronology

Delete generic trait settlement at `encounterCompleted`. Inventory every
modeled trait-producing contact—not only combat NPCs—and assign an exact
chronology contribution. A reached contact settles only when its action runs.

Provider-specific dependent effects retain true timing:

- Echo BBB remains a fixed dependent child of Echo interaction, not a pickup;
- Echo RRR activates a required generated pickup at declaration-owned
  post-outgoing `roomExit`; and
- Narcissus activates declared acquisition entries at its story checkpoint,
  after which they participate independently.

Gate-A preflight enumerates every normalized `traitOfferProducer` as room
action, fixed dependent child, generated pickup, or deliberately dormant. No
fallback may keep settling a producer at encounter completion.

### 11. Gorgon preserves hosted provenance

- With source-local Death Defiance false, Customize exposes ordinary hosted
  encounter choices and no Gorgon action.
- With Death Defiance true at an eligible pending phase, Gorgon Athena is the
  sole valid effective choice shown by Customize.
- Selecting virtual Athena edits Gorgon semantic state, never
  `encounterKeyByPhase`.
- Hosted encounter remains authority for lifecycle, counters, and Fig Leaf.
- Later `interactGorgon` owns and settles Athena's trait offer.

Ordinary selectable P Athena remains distinct.

### 12. H, O, and N stress the same model differently

- H contributes cage barriers, local/cage rewards, optionals, NPC/Gorgon,
  transformations, and pickups into one roster. Only real cage/wave
  dependencies restrict movement. Active-wave interaction remains excluded.
- O contributes wheel, combat, reward, NPC, required-object, and next-phase
  checkpoints. Its target occurrence knows whether the envelope is Intro +
  Combat 1 or Intro + Combat 1 + Combat 2, but no wheel reward is attributed to
  the preceding door. `chooseRewardWheel` precedes its matching combat and
  `interactWheelReward` follows it. Reward/Icarus reorder only within their
  legal post-combat window. Wheel 2 generation/assessment consumes the exact
  post-Combat-1 history and may neither reuse entry history nor be evaluated as
  a sibling of Wheel 1.
- Each O phase block keeps structural authoring distinct from chronology. The
  phase owns its encounter identity plus wheel store/count/offer payloads; the
  `chooseRewardWheel` action selects one complete offer at the reached
  pre-combat checkpoint; post-combat reward/NPC/dependent actions then resolve
  that selected output. Editing a retained wheel payload neither chooses nor
  acquires it.
- The final active wheel remains the source-owned outgoing-store authority. A
  two-phase ShipCombat occurrence supplies `wheel1.storeKey`; a three-phase
  occurrence supplies `wheel2.storeKey`. Its generated outgoing batch persists
  the declaration-owned `sourceOfferPoint` policy and resolves the concrete
  store from that addressed final wheel after the last active barrier; it does
  not author a duplicate base store. This outgoing provenance is independent
  from the fact that the ShipCombat target had no predecessor-generated
  incoming reward.
- N is the topology control: Hub main-room choice, local side-room visit, and
  occurrence actions are separate layers. Each main/side occurrence gets the
  standard editor and Room Actions product. Main-room Soul Pylon clearance and
  side/Hub restore are derived fixed lifecycle/topology checkpoints rather than
  authored action rows.

### 13. Workbench composition is shared by contract, specialized by room shape

One occurrence/action authority does not require one monolithic React
workbench. The application projection exposes a closed presentation shape from
explicit room/lifecycle products; React does not switch on biome keys to derive
semantics:

```text
standard occurrence   compact room header + ordinary action sequence
Fields occurrence     H inventory/cage composition + shared action rows
ShipCombat occurrence O phase-window composition + shared action rows
```

Exact product/type names may follow the existing workspace vocabulary, but the
boundary is locked:

- every composition consumes the same occurrence identity, action roster,
  checkpoint/window evidence, bound semantic commands, findings, inspector,
  focus destinations, and undo/redo path;
- H may group cages, optionals, contacts, transformations, and dependent
  pickups around its fixed wave barriers without retaining a private Fields
  order or eligibility fold;
- O may group Intro, each wheel/combat window, its phase-local actions, and the
  outgoing next-door decision without retaining a private wheel order or
  pre-evaluating later windows;
- standard rooms do not pay the complexity cost of H/O presentation; and
- N keeps its specialized Hub/main/local topology composition, while each
  entered main or side occurrence reuses the standard occurrence workbench
  unless Gate-A implementation demonstrates a concrete presentation contract
  that standard composition cannot express. No speculative N-only wrapper is
  created.

There is no biome-key renderer registry, duplicated action component family,
or specialized semantic command path. Shared action-row primitives may be
composed differently, but specialized benches own layout/disclosure only.

## Ownership by Lane

### Hades II catalog

Owns main/local room identity, local-target relationships, lifecycle
checkpoints/windows, mandatory/optional facts, producer phase/site ownership,
Fields dependencies, O windows, and Gorgon hosted provenance. It emits no
authored order, UI row, command, callback, or simulation result.

### Planner engine

Owns strict schema-46 occurrence topology and strict schema-47 actions; side
occurrence construction/commands/codec; contribution products and one assembler;
dependencies/checkpoints/proposals; total prefix execution; encounter action
settlement; Artificer source-site separation; and canonical reward/trait/Pom,
Time Piece, bag, and lifecycle transitions.

It uses no hidden registration, mutable semantic table, sidecar keyed by roster
output, or second authored order.

### Planner application and React

Owns Hub/main/local navigation; dormant structural customization versus active
entered chronology; roster presentation; bound insert/remove/move actions;
payload/finding/inspector/focus destinations; and Redux undo/redo.

Decision presentation owns only generated-exit comparison, selection, and
genuine topology transitions. Each normal, Contract, or natural Chaos exit
remains linked to its continuation occurrence, but the stage renders the
current/source occurrence workbench followed by the outgoing decision sourced
by it. The current workbench may present its incoming reward through controls
for the predecessor-generated handoff, but edits it through the existing exact
reward-owner interaction. Presentation moves neither generation authority nor
persisted reward ownership.
Missing targets may expose the minimal door-level creation control because no
occurrence exists yet. Retained unselected occurrences remain repairable
through exact inspector/finding navigation without changing selection. A
source occurrence workbench exposes creation of its absent Contract/Chaos
additional exit; once present, its lightweight outgoing card exposes removal
and selection in the same stage. Anomaly takeover, replacement-map selection,
and revert remain together on the normal exit card because they replace the
target occurrence's identity. Chaos map selection, anomaly cleared state,
reward acquisition, and every other inside-room edit belong to the occurrence
workbench. Hub-sourced decisions remain composed by the Hub workbench.

Application projection also owns the closed occurrence presentation shape.
Fields and ShipCombat receive deliberate compositions over the same engine
roster rather than accumulating conditionals in one catch-all workbench. N's
Hub/visit hierarchy remains specialized topology presentation; its actual room
occurrences use the standard bench unless a concrete projection need justifies
another closed shape. React neither derives the shape from biome labels nor
reimplements action legality inside a specialized bench.

React derives no eligibility, window, dependency, participation, topology,
checkpoint, Gorgon, or Artificer policy.

## Delivery Shape

Topology and presentation normalization are separated from chronology
behavior. Gate A removes the local-child topology exception and realigns the
existing decision/occurrence editor boundary without changing room-action
semantics. Gate B then replaces the three competing chronology paths in one
behavior cutover. No gate lands a context-only wrapper or a temporary fourth
order.

These are two delivery gates for one product correction, not independent
features. Gate A removes timing/payload editors from door cards only by moving
the still-current controls intact into the occurrence workbench; no authoring
or repair path may disappear before Gate B. Gate B then replaces those legacy
timing paths with the one occurrence roster and moves chronology-sensitive
controls onto their exact action rows. The completed product is accepted only
when both the lightweight-door surface and Room Actions surface are present and
their command domains remain disjoint.

Each gate receives its own fresh executor, independent reviewer, holistic diff
review, full repository check, and Conventional Commit. Stop after Gate A for
the requested hierarchy/topology product review, and after Gate B for Room
Actions product review. Gate C is docs-only durable closure.

## Gate A — Room-Occurrence and Decision Presentation Normalization

### Objective and schema

Advance schema 45 to strict schema 46 and replace the parent-local child-room
exception with ordinary occurrences plus `LocalVisitDecision`. Preserve all
existing chronology behavior during this gate: Fields and acquisition-site
orders, implicit encounter settlement, and existing room lifecycle folds remain
unchanged until Gate B.

In the same vertical slice, make all normal and additional decision cards pure
generated-door choices and compose each occurrence stage as the current/source
occurrence workbench followed by its outgoing decision. Selecting a
continuation advances to that continuation's own stage. This is a
presentation/ownership correction over existing source/target occurrences, not
a new topology, selection, reward, or chronology model.

### Complete vertical slice

- Create every declaration-supported local target as a retained occurrence and
  connect it through the parent-sourced local visit decision.
- Preserve parent-local joint sibling generation, availability pressure,
  one-time bag effects, reward authoring, encounter dormancy, pylon clearance,
  `IgnoreEncounterUses`, visit order, parent restore, and Hub restore.
- Reuse ordinary occurrence state, room replacement, commands, findings,
  workspace/navigation, persistence, and history identity for side rooms.
- Add `LocalVisitDecisionAddress`, `LocalVisitSlotAddress`, and
  `LocalVisitOrderAddress` plus exact generation/order commands.
- Keep every normal, Contract, and natural Chaos exit backed by its retained
  continuation occurrence while reducing the exit card to exit identity,
  compact door reward when present (otherwise target/envelope summary), picked
  state, status/findings, and genuine topology transitions: remove an existing
  Contract or Chaos exit and anomaly takeover/revert. Creation of an absent
  source-owned additional exit stays on the source occurrence workbench in the
  same occurrence stage.
- Project one full current/source occurrence workbench before the outgoing exit
  cards sourced by that occurrence. Present its incoming handoff through the
  existing exact reward-owner interaction without moving the predecessor's
  generation authority, and move ordinary/Chaos room identity and reward
  editing, Customize, suggested actions, encounters, and anomaly cleared/reward
  state into that occurrence stage. Keep anomaly
  takeover, replacement-map selection, and revert together on the source
  stage's normal-exit card.
- Preserve every existing acquisition participation/order, reward disposition,
  trait/Pom, encounter, Fields, and anomaly-success authoring path in the
  occurrence workbench during Gate A. This gate moves presentation ownership;
  it neither anticipates Room Actions nor drops functionality that Gate B will
  replace.
- For O ShipCombat targets, render no invented door reward. The compact target
  may summarize its Intro-plus-one/two-Combat envelope. After selection, that O
  occurrence's own stage owns encounter count, retained wheel payloads, and
  phase editors; its outgoing next-door grid follows the source occurrence
  workbench and final phase checkpoint.
- Establish the closed standard/Fields/ShipCombat occurrence presentation
  shapes without duplicating room state, interaction binding, finding routing,
  or command ownership. Gate A relocates existing controls into those
  compositions; Gate B later supplies their common Room Actions rows.
- Preserve exact unselected-target inspection and repair without changing the
  picked exit. A missing target may retain a compact creation control until its
  occurrence exists; afterward all room-internal editing uses the occurrence
  workbench.
- Delete `EphyraSideRoomState`, `CanonicalLocalChildRoom`,
  `LocalChildAddress`, `LocalChildGroupAddress`, and every local-child-specific
  codec, command, candidate, materialization, history, finding, workspace, and
  UI branch in the same commit.
- Delete the inline full `RoomOfferEditor`, existing-occurrence room/map
  selectors, Customize, suggested-action, and anomaly-clearance surfaces from
  normal-target, `ZagreusContractExit`, and `NaturalChaosExit` cards; do not
  replace them with a second selected-room editor.

### Primary Gate-A witnesses

- All generated sibling rewards are evaluated as one parent-local unordered
  cohort with identical pressure/bag results before and after promotion.
- A generated unentered occurrence exposes reward authoring only; encounter,
  active findings, Room Actions, counters, and history remain dormant.
- Entry activates the ordinary occurrence editor and exact retained encounter;
  not-generated state remains retained but unreachable.
- Main/side IDs, state, findings, and histories are distinct; local visit order
  remains independent from Hub visit order.
- `IgnoreEncounterUses`, Soul Pylon clearance, side return, parent restore, Hub
  restore, and route continuation do not replay generation or settlement.
- Closing/replacing a main target and undo/redo preserve complete descendant
  closure with no orphan occurrence or decision.
- Normal, Contract, and natural Chaos exit cards show only door
  comparison/selection facts and genuine topology transitions; they contain no
  full room reward editor, ordinary/Chaos existing-occurrence editor, Customize
  surface, suggested actions, encounter editor, or anomaly cleared control.
  The normal card may expose the closed anomaly identity transition
  (takeover/map/revert). A missing normal target retains only its explicit
  creation control.
- A source occurrence workbench adds Contract or natural Chaos; the resulting
  compact additional-exit card immediately appears below with selection and
  removal. Add, remove, and undo/redo stay in one occurrence stage and never
  create a second additional-exit editor.
- The current occurrence workbench owns ordinary/Chaos room authoring, complete
  incoming-reward authoring through the existing exact reward-owner
  interaction, room customization, suggested actions, encounter editing, and
  anomaly cleared/reward state. It cannot takeover, retarget, or revert its own
  Anomaly identity.
- When present, the current workbench shows the exact predecessor-generated
  incoming reward, but resolving it—pickup, Time Piece, Artificer, replacement
  acquisition, and nested effects—belongs only to the current occurrence;
  those actions cannot regenerate or rewrite the predecessor's exit batch. O
  instead shows its envelope and phase-local wheel rewards at their own reached
  checkpoints.
- Selecting or editing a door changes only target/generated facts and produces
  no acquisition, NPC, trait, Pom, disposition, participation, or action-order
  command. Gate-A undo/redo proves those domains remain separate.
- Every timing/payload control removed from an exit card remains reachable in
  the occurrence workbench with the same pre-Gate-B semantic command and repair
  behavior.
- An O transition card contains no wheel reward summary/editor. Switching to an
  O ShipCombat target presents its retained encounter envelope without
  materializing or validating Wheel 1 or Wheel 2 at the predecessor decision.
- Switching among normal, Contract, and natural Chaos exits changes only the
  selected next occurrence stage. The source occurrence workbench and its
  outgoing grid remain together, and no continuation occurrence is mutated or
  loses authored state.
- A finding on a retained unselected occurrence opens and repairs that exact
  occurrence without changing the picked exit. A missing target can be created
  from its compact door card and is then edited through its occurrence
  workbench.
- Decision, occurrence, inspector, finding, focus, and Redux witnesses prove
  there is one room editor authority rather than an inline-card and
  occurrence-workbench pair.
- Stage composition witnesses prove every occurrence-sourced decision is nested
  beneath its exact source occurrence, while Hub-sourced handoffs remain under
  the Hub workbench and never attach to a selected target by rendered position.

### Gate-A validation and boundary

Run narrow catalog/engine/planner/UI/contract/product owners while developing.
After independent review and accepted remediation, run `npm run check` once
before committing `refactor(planner): align room occurrences and decision exits`.
No Room Actions schema, contribution product, or chronology behavior enters
this commit.

## Gate B — Shared Room-Action Cutover

Advance schema 46 to strict schema 47. Contributions, rewards, acquisitions,
encounters, H, and O share one new action model and must not land as temporary
parallel sub-gates. The checkpoints below are implementation order only.

### Gate B checkpoint 1 — contribution/checkpoint spine

- Advance schema 46 to strict schema 47 and add the closed occurrence-level
  `roomActions.order`; reject schema 46 without migration/compatibility.
- Define explicit immutable contribution contract.
- Inventory every semantic producer and fixed lifecycle contributor.
- Establish one assembler and closed dependency/window vocabulary.
- Derive distinct outgoing-generation and exit/next-phase checkpoints.
- Add total derived reconciliation plus explicit insert/remove/move commands.
  Preserve compatible ranks, publish stale references as remove-only repairs,
  and publish newly required references as unranked insertion repairs without
  mutating order or inventing timing.
- Prove proposal totality under invalid prefix and absence of sidecars.
- Enforce the command boundary: door generation/selection commands cannot write
  `roomActions`, and room-action commands cannot write targets, generated door
  rewards, or `ExitSelection`.

### Gate B checkpoint 2 — rewards, acquisitions, and Artificer

- Migrate incoming/local/wheel/Shop rewards and every acquisition entry.
- Delete `AuthoredAcquisitionSiteState.order` and
  `ReplaceAcquisitionOrder`.
- Preserve identity independently from participation, order, and nested detail.
- Make disposition intent-only.
- Store replacement at exact source site; never fold Fields into `roomExit`.
- Reuse canonical settlement, bag, finding, and candidate authorities.
- Delete standalone Acquisitions order and source-nested replacement editor.

### Gate B checkpoint 3 — encounter contacts and Gorgon

- Inventory all trait producers and remove encounter-completion fallback.
- Contribute NPC/story/Gorgon interactions or exact dependent child/pickup.
- Preserve complete, unresolved, dormant, and retained-invalid offers.
- Implement forced virtual Gorgon Athena without changing hosted identity.
- Route navigation/focus/history through exact action or dependent child.
- Prove both legal reward/contact orders where one changes the other's domain.

### Gate B checkpoint 4 — H and O stress

- Replace Fields private fold/UI with common contributions/roster.
- Preserve cage dependencies, optionals, contacts, transformations, pickups,
  and exact bag/use timing.
- Adapt O repeated envelope into fixed contributions/windows without a private
  per-wheel or per-phase order.
- Prove within-window reordering and cross-window rejection.
- Prove N occurrence actions remain separate from Hub/local visit topology.

### Gate B checkpoint 5 — product and deletion audit

- Render one Room Actions panel per entered occurrence, including one-action
  rooms.
- Compose the shared roster through standard, Fields, and ShipCombat benches;
  do not grow one all-biome workbench or restore H/O private chronology.
- Render Hub/main/local hierarchy and ordinary occurrence tabs.
- Move chronology-sensitive editors to rows; remove competing editors.
- Reuse mature ranked Hub interaction language.
- Close findings, inspector, focus, undo/redo, repair, dormant suppression, and
  room replacement.
- Audit exact source addresses, especially Fields Artificer sites.
- Delete all superseded paths before independent review.

### Primary acceptance witnesses

#### Ordinary/story rooms

- A generation owner freezes normal/additional exits and their reward
  identities; picking one creates no new batch, and every
  pickup/Time Piece/Artificer operation on that reward appears only in the
  selected target occurrence chronology.
- The same selected door/reward supports two legal room-action orders with
  different truthful histories while its generated target and reward identity
  remain unchanged; derived status and findings may legitimately differ.
  Changing that door reward derives the future incoming-action reconciliation
  without executing, inserting, moving, or settling it.
- Changing a door reward between Boon and Devotion proves cardinality repair:
  exact compatible ranks survive, obsolete references are visible remove-only
  repairs, both newly required Devotion contacts are visible unranked with
  legal insertion proposals, and no door command writes `roomActions.order`.
- Door selection and room-action edits create separate semantic undo entries;
  undoing one cannot roll back or manufacture the other.
- Reward then Icarus and Icarus then reward yield truthful distinct histories.
- Missing NPC blocks at its action after earlier effects, not at completion.
- Devotion contributes `chosenSource` before combat and `spurnedSource` after
  combat; the latter observes the former's exact acquired history.
- Echo may generate exits, then require RRR before departure; pickup affects
  next room without changing generated choices.
- Narcissus activation, authoring, participation, and order stay independent.

#### O outgoing generation

- A two-phase ShipCombat outgoing decision resolves its store through
  `sourceOfferPoint` at `wheel1.storeKey`; a three-phase decision resolves it at
  `wheel2.storeKey`.
- Wheel 2 cannot contribute outgoing provenance before its sequential
  checkpoint or while its prior required window is unresolved. After the last
  active barrier, outgoing generation uses the exact final-wheel store and does
  not copy it into an authored base-store field.
- Switching the retained envelope between two and three phases changes the
  addressed final-wheel source and reconciles the phase roster without
  inventing an incoming door reward, acquiring a wheel offer, or rewriting the
  outgoing order.

#### Shop/participation

- Shop exits exist before optional purchases and never regenerate afterward.
- Optional complete payload inserts without evaluating invalid prefix.
- Remove/reinsert retains payload exactly; required rows reject removal.
- Payload edits never insert/move; order edits never rewrite payload.
- In an ordinary/H window, the same optional Fields/Artificer action can be
  placed before or after the dynamically derived outgoing checkpoint; only the
  before case affects the frozen generated batch.

#### Artificer

- Intent persists only `artificer`; missing identity blocks before spending.
- Complete source spends exact use/bag entry and materializes same-site entry.
- Later missing trait/Pom blocks only pickup.
- Switching away/back retains payload and suppresses dormant row.
- Required status transfers; dependent action cannot precede source.
- Three Fields optionals transform to Hammers before any produced/cage Hammer
  pickup constrains subsequent legality.

#### Gorgon/H/O

- DD false gives hosted domain/no Athena action; DD true gives sole virtual
  Athena while preserving hosted provenance.
- Athena is a repairable later required action; unresolved Athena blocks later
  Fields cage.
- H supports audited interleaving.
- O renders one occurrence sequence in exact phase order:

  ```text
  Intro and its phase-owned encounter editing
  edit Wheel 1 store/count/offer payloads at the reached phase
  choose Wheel 1 offer
  Combat 1
  Combat 1 reward / NPC / dependent actions in legal authored order
  required-object barrier
  edit Wheel 2 store/count/offer payloads at the reached phase (when active)
  choose Wheel 2 offer (when the third phase is active)
  Combat 2
  Combat 2 reward / NPC / dependent actions in legal authored order
  final required-object and outgoing-generation checkpoints
  Next Door Choice
  ```

- `chooseRewardWheel`, combat, and `interactWheelReward` are separate
  chronological rows/checkpoints. Reward/Icarus may resolve in either
  post-combat order, the next phase waits for required objects, and cross-window
  moves are rejected.
- Wheel 2 candidates and validity are computed from the settled post-Combat-1
  history. Primary witnesses include one retained reward that was supported at
  entry but becomes unavailable before Wheel 2 and one reward that becomes
  supported only after the first window; neither is silently replaced,
  prevalidated, or attributed to the predecessor door.
- A two-phase O occurrence never publishes Wheel 2 actions. A three-phase
  occurrence retains Wheel 2 authoring while unresolved earlier state blocks
  its contextual assessment normally rather than throwing or inventing entry
  history.
- The old automatic `recordPhaseOfferAcquisition` cannot settle the wheel reward
  outside its explicit action.

#### Product/resilience

- Every active row has one panel, owner, payload control where applicable,
  finding destination, and focus target.
- Invalid/unresolved rows stay visible and repairable.
- One-participant rooms show no meaningless move controls.
- Standard rooms remain compact; H and O render their declaration-owned
  cage/window structure while reusing identical action-row commands,
  participation, findings, focus, and undo/redo contracts.
- N Hub/local topology remains visually specialized without creating a second
  semantic room bench for ordinary N occurrences.
- Persistence, replacement, route edits, projection, and undo/redo never throw
  with incomplete occurrence/action/payload.
- Generated target identity/reward/offers remain unchanged after any
  post-generation action; only declared entry-time preparation observes the
  final source-room history.
- Shop, Narcissus, Echo, Devotion, Time Piece, Fields, Artificer, O wheel,
  Gorgon, and encounter workflows retain owner-specific effects.

### Deletion and audit-against

Delete or replace:

- `FieldsCombatState.actionOrder`, `FieldsCombatAction`, private command,
  codec, candidates, materialization, and UI;
- `FieldsActionAddress`, `runFieldsActionSequence`, `fieldsActions`, and
  string-parsed Fields action events;
- `AuthoredAcquisitionSiteState.order`, `ReplaceAcquisitionOrder`, private
  interaction, and standalone order panel;
- source-nested Artificer replacement/adapters/presentation state;
- implicit encounter/Gorgon settlement at `encounterCompleted`;
- automatic O `recordPhaseOfferAcquisition` settlement that bypasses the
  explicit post-combat wheel-reward action;
- competing card-local trait/Pom/disposition editors;
- duplicate order/dependency logic in Fields, Shops, story pickups, or O; and
- fixture helpers that fabricate retired local-child/order/default state.

Preserve:

- N Hub main-room topology/ranked visit order;
- schema-46 `LocalVisitDecision` topology and its ranked visit order;
- `LocalRewardAddress` for actual Fields local rewards;
- exact specialized payload owners and acquisition addresses;
- existing closed lifecycle operation/effect registry, history composition,
  reward processing, generation folds, and H/O fixed lifecycle facts;
- reward bags, Artificer capacity/use evidence, trait composition, and outgoing
  generation authority; and
- Forfeit/automatic effects that are not player-triggered actions.

Audit final diff for:

- `catalog -> pure engine <- application/React`;
- one action order and one authoritative roster sequence orchestrator feeding
  the existing lifecycle/history/reward/generation authorities;
- returned contributions, not registration/callback capabilities;
- no new generic room-action interpreter/registry, pending map, second bag,
  sidecar, or hidden order;
- no React-derived domain/topology/checkpoint policy;
- no catch-all workbench whose conditionals reconstruct H/O/N semantics, and no
  specialized bench with its own roster, order, candidate, or command path;
- no door/exit command that settles or orders room interactions and no
  room-action command that regenerates or reselects an exit;
- no exception-driven incomplete handling;
- exact occurrence/site/owner addresses and dormant retention;
- one primary test owner per matrix; and
- growth offset by deletion of local-child, Fields, Acquisitions, and implicit
  encounter paths.

### Gate-B validation and boundary

Use narrow owning lanes during implementation. After independent review,
accepted remediation, and holistic deletion/growth audit, run `npm run check`
once before committing `feat(planner): unify room action chronology`. Stop for
user product review. This full check is required because Gate B changes strict
schema and shared engine/application behavior.

## Gate C — Durable Closure

After user product review, perform a fresh architecture/gameplay audit. Correct
only concrete defects through bounded review, absorb schemas 46/47 and chronology
into stable authorities, and delete this plan.

Confirm:

- each supported physical main/side room is one occurrence;
- Hub topology, local visit topology, and room chronology remain separate;
- all semantic owners contribute explicitly into one assembler;
- H/O lifecycle owns facts but no competing order;
- encounter/Gorgon settle only at exact action/dependent checkpoint;
- Artificer intent/transformation/payload/pickup remain distinct at exact site;
- door generation/selection remains independent from incoming reward
  participation, disposition, order, and settlement in model, commands,
  projection, and UI;
- generation and exit usability are independently placed where required;
- optional participation stays editable under invalid state;
- every active occurrence/action has application/navigation closure;
- retired fields/commands/UI are absent; and
- growth is concentrated at explicit boundaries and offset by deletion.

Update only owning README, authored-project, lifecycle, reward, simulation,
candidate, editor/workspace, H/N/O, acquisition, Fields/Artificer, encounter,
room-action, polish, and implementation-progress authorities. Delete this plan
after absorption.

Gate B's full check is the phase-closure result when Gate C remains docs-only.
Run it again only if closure changes production, tests, build configuration, or
behavior. Land one coherent docs closure commit, or a fix commit only for a
bounded production correction found by closure audit.

## Validation Policy

During Gates A and B use the narrowest truthful lane:

- `npm run test:catalog` for declaration/topology/lifecycle;
- `npm run test:engine` for schema, commands, contributions, roster,
  proposals, chronology, effects, and H/O/N;
- `npm run test:planner` for workspace/navigation/binding/Redux/focus;
- `npm run test:ui` for hierarchy and Room Actions;
- `npm run test:contract` for workspace capabilities; and
- `npm run test:product` for cross-layer workflows.

Run typecheck, lint, formatting, diff check, and build before each handoff. Run
one complete `npm run check` after each gate's narrow suites and review fixes,
before that broad schema/shared-package commit. Do not repeatedly rerun it for
prose-only adjustments.

## Explicit Exclusions

- Stygian Wells;
- Shrines of Hermes and delayed delivery;
- natural-resource element events;
- interaction during active Fields wave;
- exact Fields map geometry;
- recursive arbitrary side-room nesting;
- speculative authored completion-interaction state;
- unmodeled NPC/effect families;
- new reward-bag, trait, encounter, or outgoing-choice policy;
- generic event scripting/arbitrary lifecycle;
- schema-45 or schema-46 migration/compatibility after their replacing gate;
  and
- broad visual redesign beyond occurrence hierarchy, lightweight decision
  exits, the selected occurrence workbench, Room Actions, and retired panels.

Future Wells, Shrines, resources, and completion interactions must extend this
same explicit contribution/roster authority at audited checkpoints. They must
not add private participation/order models.

## Final Plan Lock Checklist

1. Is Gate A a complete topology/presentation-only vertical slice with no Room
   Actions or chronology behavior mixed into schema 46?
2. Does `LocalVisitDecision` preserve joint sibling generation, availability
   pressure, bag use, pylon/restore behavior, and all descendant cleanup while
   fully deleting the local-child exception?
3. Are the generated-unentered reward controls and dormant encounter/action
   controls exactly the same as current N behavior?
4. Are normal, Contract, and natural Chaos exit cards limited to door
   facts/selection and genuine topology transitions while one occurrence
   workbench owns ordinary/Chaos room authoring, reward/customization, anomaly
   clearance, and exact selected/unselected repair without selection mutation?
   Do anomaly takeover, replacement-map selection, and revert remain together
   on the parent normal-door transition rather than its occurrence workbench?
5. Does the source occurrence add an absent Contract/Chaos exit and its compact
   card remove/select it in the same tab without a split or duplicate editor?
6. Does each stage keep the current/source occurrence workbench with the
   outgoing decision it sources, while selecting a normal or additional exit
   advances to that continuation's own stage without mutating any retained
   occurrence? Can a missing target still be created without reintroducing an
   inline room editor, and do Hub-sourced handoffs remain Hub-owned?
7. Do Gate A and Gate B form the two complete legs of one product—lightweight
   generated doors and occurrence-owned action timing—without an interim lost
   editor, a door command writing chronology, or an action command rewriting a
   door?
8. Does Gate B's action union identify Devotion's two contacts and O's wheel
   choice/reward acquisition separately without embedding payload?
9. Are contributions explicit returned facts rather than registration or
   callbacks, while the existing lifecycle/history/reward/generation folds
   remain authoritative?
10. Can standard/H dynamic outgoing placement, Shop/story post-outgoing points,
    and O repeated barriers be derived without another persisted lifecycle?
11. Does an O entry transition carry only its target/envelope while Wheel 1 and
    Wheel 2 are generated and assessed at their own sequential history
    checkpoints, followed by the outgoing next-door decision? Does that
    decision preserve `sourceOfferPoint`, resolving `wheel1.storeKey` for two
    phases and `wheel2.storeKey` for three without duplicating the store?
12. When a roster-shape edit changes required action cardinality, do exact
    compatible ranks survive, stale references remain visible remove-only
    repairs, and new required references remain unranked with insertion
    proposals until an explicit room-action command places them?
13. Do standard, Fields, and ShipCombat benches compose one shared occurrence
    and action contract without a catch-all conditional component or
    specialized semantic paths, while N reuses standard room composition unless
    a concrete need is proven?
14. Does removing Fields/acquisition orders preserve every payload and exact
    address, including a collision-safe site-storage projection?
15. Is Artificer replacement stored at the exact source site, especially Fields,
    with identity failure before spending and child failure after materializing?
16. Are structural proposals total under invalid prefix?
17. Does trait-producer inventory correctly classify BBB, RRR, Narcissus, and
    every other normalized producer?
18. Does Gorgon retain hosted provenance with virtual Athena and later action?
19. Does the occurrence claim remain limited to authored main/local rooms,
    leaving Boss/Postboss derived completion nodes and excluded completion
    interactions under their existing authority?
20. Do deletion scans eliminate local-child, normal/Contract/Chaos inline
    decision-card room editors, Fields, Acquisitions, automatic O reward
    acquisition, and encounter chronology as parallel paths?
21. Does each broad gate run one complete repository check before commit?

Any material contradiction stops execution for another amendment. Review may
not silently reinterpret the gate or defer a competing path to closure.
