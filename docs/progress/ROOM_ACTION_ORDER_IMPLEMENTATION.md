# Room Occurrence and Action Chronology Implementation

## Status

Locked delivery plan. Gate A landed as `e1e3af0`, Gate B landed as `f38247d`,
and the first pre-closure correction landed as `daa876f`. Product review then
found a second pre-closure correction in N: Hub-board generation, visit
chronology, and nested main/side-room execution must be projected from the
engine's true walk rather than coupled through UI nesting or an all-or-nothing
progressive candidate search. That correction is locked below before Gate C
durable closure. Gate C has not started and may not absorb either superseded
path.

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
but its decision card is a door-transition surface: target room identity,
every reward identity visible on that door, picked state, status/findings, and
genuine topology transitions such as removing an existing Contract or natural
Chaos exit and anomaly takeover/revert. The card owns reward-identity
authoring, but never pickup participation, disposition, trait/Pom resolution,
or action timing.

The visible stage is anchored by the current/source occurrence, not by one of
its targets:

```text
current occurrence workbench
  room-internal generation, encounters, internal state, and actions
outgoing decision sourced by this occurrence
  target room and door-visible reward authoring, selection, and transitions
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
decision second. The outgoing section is total: it renders the authored
decision, the exact authoring frontier or blocker when the decision does not
yet exist, or an explicit terminal state. Picking a normal, Contract, or
natural Chaos exit chooses the next stage without rewriting the source or any
retained target. Exit cards host only target-room and door-visible reward
identity authoring plus selection and genuine door transitions. They do not
host pickup/disposition/trait/Pom timing, encounter editing, Customize, or
suggested actions. The anomaly identity controls remain the closed
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
UI-driven storage move. The application door-contract projection binds the
exact identity editor only when preview mode is `visible`. The selected
occurrence workbench receives only read-only handoff context and exact Room
Action settlement children; it cannot bind a second identity editor. The
boundary must be observable in command types, projection products, undo
entries, and tests rather than inferred from visual placement.

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
frozen reward identity retained by that generation handoff. Only a `visible`
door contract shows the identity and binds its exact reward-owner editor;
`hidden` and `none` expose no reward summary or editor. An explicit structural
transition such as anomaly takeover/revert or adding/removing Contract or
natural Chaos rewrites that authored generation contract and causes a fresh
evaluation; it is not an in-room action. The target occurrence does not
regenerate its incoming decision. Once entered, its Room Actions chronology
owns what happens to the incoming reward object: ordinary pickup, Time Piece,
Artificer source destruction/use and replacement creation, later replacement
pickup, and resulting trait/Pom/effect settlement. The selected occurrence
workbench may summarize a visible predecessor-generated reward only as
read-only context; exact Room Action rows bind its settlement children.
Presentation does not move semantic generation authority into React or
duplicate the reward in occurrence state.

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

The pre-closure correction also gives the engine one closed
`OccurrenceOutgoingStatus` query/product. Given an exact occurrence and the
project's retained/progressive evaluation, it classifies that occurrence as:

- an authored outgoing decision, with its exact decision owner;
- the current authorable exit frontier, with the exact source occurrence,
  candidate capability/command owner, and any finding at that frontier;
- blocked or unentered, with the exact blocker owner and findings but no
  fabricated authoring capability;
- topology-owned Hub/local continuation, with its exact Hub or local-visit
  owner rather than an occurrence-local exit; or
- terminal/no physical outgoing, including the selected Preboss completion
  boundary.

This query owns progression/topology classification. Application assembly may
adapt it, but may not infer a case from rendered position, the biome-global
completeness frontier, room kind, or absent decision lookup.

It uses no hidden registration, mutable semantic table, sidecar keyed by roster
output, or second authored order.

### Planner application and React

Owns Hub/main/local navigation; dormant structural customization versus active
entered chronology; roster presentation; bound insert/remove/move actions;
payload/finding/inspector/focus destinations; and Redux undo/redo.

Decision presentation owns generated target-room identity, each door's exact
reward-preview mode, every reward identity visible on that door, selection,
and genuine topology transitions.
Each normal, Contract, or natural Chaos exit remains linked to its continuation
occurrence, but the stage renders the current/source occurrence workbench
followed by the outgoing decision or outgoing authoring frontier sourced by it.
The continuation workbench may summarize its incoming handoff read-only and
Room Action rows may expose chronology-owned child editors, but neither may
offer a second base reward-identity editor. Presentation moves neither
generation authority nor persisted reward ownership; the decision product
binds the existing exact reward-owner interaction.
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

Application projection adapts the engine's closed outgoing-status product to
`WorkspaceOccurrenceStage.outgoing`; React performs only keyed rendering of
the authored decision, frontier/blocker, topology-owned handoff, or terminal
case. Application projection also owns the closed occurrence presentation shape.
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

Gate A and Gate B are the two completed delivery gates for one product
correction, not independent features. Gate A separates the occurrence
workbench from its outgoing door surface. Gate B replaces the legacy timing
paths with one occurrence roster and moves chronology-sensitive controls onto
their exact action rows. The bounded pre-closure correction restores base
reward-identity authoring to the door surface and makes the outgoing section
total without changing Room Actions.
The completed product is accepted only when the door-contract and Room Actions
surfaces are both present and their command domains remain disjoint.

Each gate receives its own fresh executor, independent reviewer, holistic diff
review, full repository check, and Conventional Commit. Stop after Gate A for
the requested hierarchy/topology product review, after Gate B for Room Actions
product review, and after the bounded correction for door/stage product review.
Gate C remains docs-only durable closure unless its fresh audit finds a concrete
defect.

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
  door-visible reward authoring when present (otherwise target/envelope
  summary), picked state, status/findings, and genuine topology transitions:
  remove an existing Contract or Chaos exit and anomaly takeover/revert.
  Creation of an absent source-owned additional exit stays on the source
  occurrence workbench in the same occurrence stage.
- Project one full current/source occurrence workbench before the outgoing exit
  cards sourced by that occurrence. Keep ordinary/Chaos room-internal
  generation, Customize, suggested actions, encounters, and anomaly
  cleared/reward state in that occurrence stage, but keep target-room and
  door-visible base reward identity on the predecessor's door product through
  the existing exact reward-owner interaction. Keep anomaly
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
- Delete the inline full `RoomOfferEditor`, Customize, suggested-action,
  encounter, anomaly-clearance, and chronology-sensitive child surfaces from
  normal-target, `ZagreusContractExit`, and `NaturalChaosExit` cards. Retain the
  bounded target-room and door-visible reward identity editors; do not replace
  them with a second selected-room editor.

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
- Normal, Contract, and natural Chaos exit cards show target-room identity,
  their declaration-owned `visible | hidden | none` reward-preview state,
  comparison/selection facts, and genuine topology transitions. Only a
  `visible` preview carries the base reward editor; Contract and natural-Chaos
  entry cards remain hidden. They contain no pickup disposition, trait/Pom
  child, Customize, suggested action, encounter, or anomaly-cleared control.
  The normal card may expose the closed anomaly identity transition
  (takeover/map/revert). A missing normal target retains only its explicit
  creation control.
- A source occurrence workbench adds Contract or natural Chaos; the resulting
  compact additional-exit card immediately appears below with selection and
  removal. Add, remove, and undo/redo stay in one occurrence stage and never
  create a second additional-exit editor.
- The current occurrence workbench owns room-internal generation, room
  customization, suggested actions, encounter editing, anomaly cleared state,
  and Room Actions. It may summarize the exact predecessor-generated incoming
  reward read-only, but cannot edit its base identity, takeover, retarget, or
  revert its own Anomaly identity.
- A predecessor door with a `visible` preview edits the exact incoming base
  reward identity; hidden/none doors expose no reward editor. Resolving a
  reward—pickup, Time Piece, Artificer, replacement acquisition, and nested
  effects—belongs only to the entered occurrence and cannot regenerate or
  rewrite the predecessor's exit batch. O instead shows only its envelope on
  the door and owns phase-local wheel rewards at their reached checkpoints.
- Selecting or editing a door changes only target/generated facts and produces
  no acquisition, NPC, trait, Pom, disposition, participation, or action-order
  command. Gate-A undo/redo proves those domains remain separate.
- Every chronology-sensitive control removed from an exit card remains
  reachable on its exact Room Action row. Base door-visible reward identity
  remains editable only on the exit card through the existing semantic command.
- An O transition card contains no wheel reward summary/editor. Switching to an
  O ShipCombat target presents its retained encounter envelope without
  materializing or validating Wheel 1 or Wheel 2 at the predecessor decision.
- Switching among normal, Contract, and natural Chaos exits changes only the
  selected next occurrence stage. The source occurrence workbench and its
  outgoing grid remain together, and no continuation occurrence is mutated or
  loses authored state.
- A finding on a retained unselected occurrence opens and repairs that exact
  occurrence without changing the picked exit. A missing target can be created
  from its compact door card; its target-room/visible-reward identity remains
  on that card while its room-internal state is edited through its occurrence
  workbench.
- Decision, occurrence, inspector, finding, focus, and Redux witnesses prove
  there is one base door identity/reward editor and one disjoint room-internal
  editor rather than duplicated authority across the card and workbench.
- Stage composition witnesses prove every occurrence-sourced authored decision,
  outgoing frontier, or outgoing blocker is nested beneath its exact source
  occurrence, while Hub-sourced handoffs remain under the Hub workbench and
  never attach to a selected target by rendered position.

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

## Pre-Closure Correction — Door Contract and Total Outgoing Stage

Gate B product review found two coupled Gate-A presentation defects. The
decision projection currently derives a target's reward by inspecting the
target occurrence workbench, so the door card and decision rail join room
identity from the decision with reward identity from a second presentation
owner. An occurrence stage also pairs only an already-authored outgoing
decision node; when the outgoing decision is still an authoring frontier, the
doors disappear behind separate navigation such as `Move to next decision`, a
finding, or an unrelated additional-exit edit.

Correct both before Gate C. This is one bounded application/engine-product
slice, not a new topology, reward, or chronology model.

### Door contract

- Project one explicit immutable door-contract product per physical target.
  It contains the target room identity, a declaration/canonical reward-preview
  mode, exact door-visible reward identities when the mode is `visible`,
  picked/availability/retained state, and genuine transition capabilities.
  Door cards and decision-rail summaries consume this same product; neither may
  rediscover reward identity from `WorkspaceRoomSummary` or an occurrence
  workbench.
- Reward-preview mode is closed:
  - `visible` carries the exact identity plus its existing owner interaction;
  - `hidden` records that the physical door deliberately withholds preview and
    exposes no reward editor or summary; and
  - `none` means the door has no door-visible reward product.
    Being reward-bearing internally is not sufficient to select `visible`.
    Catalog/canonical door facts own the mode; React must not dispatch on room or
    detour kind.
- Bind reward identity through the existing exact reward-owner interaction.
  Do not copy reward payload into new authored state or move persisted ownership.
  Generated/evaluated and retained-unreached evidence must remain distinguishable
  under progressive evaluation rather than being joined by rendered position.
- Ordinary visible-preview doors edit that base reward identity on the door
  card. The entered room may show it read-only for context. Its Room Action row
  alone owns disposition, pickup, trait/Pom child, Artificer replacement, and
  timing controls.
- The natural-Chaos entry gate and Zagreus Contract entry door are `hidden`:
  neither exposes the generated Chaos reward or the Contract room's forced
  output. The automatic Anomaly and Contract host-return doors are also
  `hidden`. A normal exit from an entered Chaos room is an ordinary visible
  host-return door and uses the ordinary door contract. An Anomaly entry that
  replaced an ordinary visible door retains the already-authored Anomaly
  reward as that visible door's reward; takeover/revert remains a door identity
  transition. These cases require separate witnesses rather than one generic
  special-door rule.
- An H outgoing decision owns its shared declaration-derived cage outcome/count,
  and each H target door card owns the identity of its two or three active cage
  rewards because those are visible before entry. The entered Fields room owns
  side-reward count and identities because those are generated/revealed on the
  map, plus all cage/side participation and Room Action chronology. Cage action
  rows may summarize their reward and expose chronology-dependent child
  controls, but cannot edit the base cage identity.
- An O door carries only target/envelope identity. Wheel stores, offers, picked
  wheel identity, and reward payload remain phase-local products of the entered
  ShipCombat occurrence. No generic door product may fabricate an O reward.
- N Hub and local-visit doors preserve their existing topology owners. Where
  they display a generated main/local reward, their presentation must consume
  the same owner-complete door/visit handoff fact rather than derive it from the
  entered room workbench.

### Total outgoing occurrence stage

- Add the engine-owned `OccurrenceOutgoingStatus` query described above. It
  consumes an exact occurrence plus retained/progressive evaluation and returns
  one closed case: authored decision, current authorable exit frontier,
  blocked/unentered, topology-owned Hub/local continuation, or terminal/no
  physical outgoing. Frontier and blocker cases carry their exact semantic
  source address, candidate capability/command owner when authorable, and exact
  findings; the product never substitutes the biome-global frontier for an
  occurrence-local fact.
- Replace optional `outgoingDecisionNodeKey` with the application adaptation
  `WorkspaceOccurrenceStage.outgoing`. Application assembly joins the engine
  status to exact workspace nodes/interactions once; React performs keyed
  rendering only and contains no room-kind, topology, or progression inference.
- Every selected or directly opened occurrence renders its outgoing section
  immediately after its workbench. After creating an Underworld opening room,
  the same inspector therefore shows the outgoing authoring frontier without a
  separate rail click, finding, Chaos gate, or `Move to next decision` action.
- Authoring the frontier replaces that section in place with the outgoing door
  cards. Door selection advances to the chosen target occurrence stage; it does
  not detach the source workbench from its own outgoing section.
- A blocked frontier remains visible with its exact finding/repair destination.
  A terminal occurrence shows an explicit terminal state. Hub-sourced handoffs
  remain composed by the Hub workbench and are not attached to a target by
  rendered order.
- A retained unselected or directly opened occurrence reports its truthful
  blocked/unentered or authored status without borrowing the selected route's
  global frontier. N main/local occurrences report their topology-owned
  Hub/local continuation; rooms that merely source an additional Contract or
  Chaos exit still derive their ordinary outgoing status independently. A
  selected Preboss reports terminal/no physical outgoing.
- Remove the redundant `Move to next decision` detour once every occurrence
  stage has a total outgoing product. Navigation, findings, and rail entries may
  still focus that same product but are no longer required to reveal it.

### Primary correction witnesses

- Starting an Underworld project and selecting the opening room immediately
  renders its outgoing frontier below the room workbench. Authoring the batch in
  place renders its doors without another navigation action; undo restores the
  frontier in the same stage.
- A completed and a progressively blocked ordinary decision project room and
  reward from one door-contract product. The selected decision rail consumes
  that exact product and never calls the occurrence-room reward adapter.
- Editing an ordinary door reward changes only the door reward identity and its
  derived future-action reconciliation. The entered room has no second base
  identity editor; its exact pickup row retains disposition/trait/Pom controls.
- Natural-Chaos and Zagreus Contract entry cards show their destinations but no
  reward preview/editor. Automatic Anomaly and Contract return doors remain
  hidden. The ordinary return from an entered Chaos room shows its normal
  visible reward contract. Anomaly takeover/revert retains the visible reward
  on the replaced ordinary door without creating a hidden-return editor.
- An H outgoing decision authors the shared two/three-cage outcome and each exit
  card authors its active cage reward identities. The entered H room authors
  side rewards separately and presents cage completion/pickup plus side
  participation/order in Room Actions with no duplicate cage identity editor.
- An O exit card has no reward editor or reward summary. After entry, Wheel 1
  and optional Wheel 2 remain editable only at their reached phase-owned
  products and their pickup children remain on Room Action rows.
- Normal, Contract, natural Chaos, anomaly takeover/revert, Hub/local visit,
  finding focus, rail selection, and unselected retained-room repair retain
  exact owner and undo/redo behavior.
- Engine status witnesses cover an authored ordinary decision, current
  authorable frontier, retained-unselected blocker, N main and local
  topology-owned continuations, a source room with an additional Contract or
  Chaos exit, and selected-Preboss terminal. Application contract tests prove
  each becomes the matching `WorkspaceOccurrenceStage.outgoing` case without
  consulting room kind or the biome-global frontier.

Use a fresh executor and independent reviewer. Run the narrow engine/planner/UI/
contract/product owners while developing, then one `npm run check` after review
if production, tests, or shared products changed. Commit the correction as
`fix(planner): restore door contract staging`, then resume Gate C from that
commit.

## Second Pre-Closure Correction — N Hub Board and Engine Walk

Product testing after the door-contract correction exposed two symptoms of one
remaining N ownership error:

- an unresolved opening reward does not receive progressive generation support
  until some reward is selected; and
- editing rewards across nine or ten open Hub doors can freeze while candidate
  evaluation searches for a complete sibling configuration through the
  progressive visit result.

The N Hub is not a sequence of UI panels and is not generated through its six
visits. The game creates one complete persistent board before the first main
room is entered. The engine then walks the six selected main rooms and any
nested side rooms in chronology. Lock those as separate regions.

### Macro topology and the Hub generation region

The normal N route remains:

```text
Opening -> PreHub -> Hub -> Preboss
```

The existing natural-Chaos takeover retains its audited entry variation. It
does not change the Hub rules below.

On the first Hub entry, the engine settles one persistent Hub board containing
all nine or ten open doors. The open/closed set owns every declaration-fixed
door participant:

- slot and target occurrence identity;
- open or closed membership; and
- the complete base reward identity generated on that door.

The board-generation context is the post-PreHub or audited takeover history
plus the currently authored/resolved participants in that same unordered Hub
generation region. It contains no main-room acquisition, encounter result,
Room Action result, side-room generation, or visit-order history. The six-room
visit order must never be substituted for board generation order.

Partial authoring remains total. Each open door may be repaired from that one
Hub-generation product using the resolved peer identities already present on
the board. An unresolved or invalid peer keeps the board incomplete or invalid,
but does not hide or disable the other door editors. Complete selected
validation still requires one supported complete board under the existing
unordered-generation rules. It does not search future main/side-room
chronology to decide whether a board edit can be made.

Opening and PreHub reward candidates follow the same generation-frontier
principle at their own owners: candidate support is available before the first
selection and does not require a fabricated selected reward history.

Hub offers are generated objects, not acquisitions. All open doors contribute
their generated base identities to the complete Hub board and Hub reward
lookup. Only the six visited target occurrences later acquire or otherwise
resolve their rewards through their own Room Actions.

### Visit order is the singular Hub chronology authority

The Hub persists exactly one ordered list of six distinct open main-room
occurrences. Open membership and reward identity are not encoded in that list.
The order answers only which main room the engine enters next.

Hub editing therefore has two lightweight structural surfaces:

1. the unordered open/closed participant set, including every open door's room
   and base reward identity; and
2. the six-entry visit order over open main-room occurrences.

Neither surface edits traits, Pom targets, Time Piece, Artificer, encounters,
side rewards, or Room Actions. Those products become available only at their
true occurrence/action owner during the engine walk. A blocked current visit
must not suppress either Hub editor: changing the visit order is itself a valid
repair operation.

### The engine walk is the only progressive chronology

After the initial Hub board is settled, selected validation walks the authored
visits and nested local visits exactly as the engine does. A representative
walk is:

```text
Hub entry        -- settle the complete Hub board once
Main Room 1      -- first entry; execute its lifecycle and Room Actions
Side Room 1.1    -- first entry; execute its lifecycle and Room Actions
Main Room 1      -- restored parent context; do not replay settled work
Side Room 1.2    -- if generated and visited
Main Room 1      -- restored parent context
Hub              -- restored Hub context; do not regenerate the board
Main Room 2      -- first entry; execute its lifecycle and Room Actions
...
Hub              -- restored after Main Room 6
Preboss
```

The first instance of a room occurrence in this walk is the real execution
point for its lifecycle, Room Actions, acquisitions, encounter effects, and
history. A restored parent is a spatial/ownership restoration only. It carries
the accumulated history forward, resumes the parent's remaining local or Hub
visit sequence, and never replays the parent's lifecycle or actions.

Main-room side generation is parent-local. The main occurrence owns whether
its declaration-fixed side rooms are generated and the local visit sequence.
Each generated side room remains its own occurrence and owns only its own room
state, payloads, Room Actions, findings, and first-entry execution. Side-room
generation findings attach to the exact main-room/local-decision owner; an
entered side-room finding attaches to the exact side occurrence or action.

The progressive validator stops at the first invalid or unresolved action in
this engine walk. The remaining chronological suffix is unevaluated:

- a main-room failure stops the rest of that main room, its side rooms, and all
  later main/side visits;
- a side-room failure stops the rest of that side room and all later restored
  parent, side-room, and main-room visits; and
- actions and history established before the blocker remain canonical.

Neither failure retroactively invalidates or regenerates the already-settled
Hub board. It may make the selected Hub traversal and overall route incomplete
or invalid, but the Hub board and visit-order editors remain available from
their own earlier generation/structural products.

### Engine ownership and UI projection

The engine walk, not the editor hierarchy, owns chronology and finding
propagation. Simulation returns the exact reached prefix, restoration events,
first blocker, and withheld suffix. Candidate and application products consume
those facts. React may render Hub, main rooms, and nested side rooms as a useful
hierarchy, but it must not infer execution order, replay a parent, propagate a
child error, or decide which later occurrence is reachable from panel order.

Keep three statuses distinguishable:

- Hub board generation complete/incomplete/invalid;
- selected Hub visit execution complete/blocked/invalid; and
- overall N/route status.

A downstream traversal finding may affect the latter two without changing the
first. Findings always focus their exact semantic occurrence/action owner.

### Persisted shape and expected replacement

Do not introduce another Hub state model. The existing `HubDecision`
`openTargets`, occurrence-owned incoming rewards, six-entry `visitOrder`,
`LocalVisitDecision`, and occurrence-owned `roomActions.order` already contain
the required authored facts. Retain dormant occurrence/local payloads under
their existing ownership.

Replace the current focused-repair/existential sibling-completion path with one
explicit Hub-board generation product and the existing engine-walk traversal.
Remove any application or React logic that joins Hub generation validity to a
main/side-room panel or selected progressive suffix. Preserve the separate
opening-reward frontier fix while replacing any temporary Hub candidate-search
optimization that merely makes the superseded coupling faster.

### Primary correction witnesses

- With no opening reward selected, the opening reward control receives exact
  generation candidates from its pre-selection frontier.
- A Hub with nine and with ten open doors can author every room/reward
  participant from the board-generation region without selecting a visit or
  evaluating any main/side-room lifecycle.
- An unresolved or retained-invalid Hub peer leaves the board incomplete or
  invalid while unrelated door editors and open/close repair remain responsive.
- Completing the board produces one stable board and Hub reward lookup; changing
  visit order neither regenerates offers nor changes unvisited door identities.
- Six-room visit order is editable while the currently selected traversal is
  blocked inside a main or side room.
- A main-room action failure preserves the complete Hub board and prior history,
  then withholds that room's suffix, all nested side visits, and every later
  main-room visit.
- A side-room action failure preserves the Hub board, main-room actions, and
  earlier side visits, then withholds the remaining restored-parent/Hub walk and
  all later main-room visits.
- Parent and Hub restoration events advance the same canonical history without
  rerunning board generation, room lifecycle, reward acquisition, counters, or
  Room Actions.
- Application hierarchy/focus tests prove that moving panels or opening a nested
  inspector cannot change the reached prefix, blocker, or candidate context.

Implement this correction through a fresh executor and independent reviewer.
Use the engine's Hub board/reward/candidate/progressive owners first, then adapt
the smallest application products. Run focused engine/planner/contract/UI/
product witnesses while developing and one complete `npm run check` only after
review remediation is stable. Commit it as one coherent correction before Gate
C durable closure.

## Gate C — Durable Closure

After both pre-closure correction commits and user product review, perform a
fresh architecture/gameplay audit. Correct only concrete defects through
bounded review, absorb schemas 46/47, door contracts, total occurrence staging,
the N Hub board/engine walk, and chronology into stable authorities, and delete
this plan.

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

During Gates A, B, and the pre-closure correction use the narrowest truthful
lane:

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
4. Are normal, Contract, and natural Chaos exit cards limited to target-room
   identity, the exact declaration-owned reward-preview mode and visible base
   reward identity when applicable, selection, and genuine topology transitions
   while one occurrence workbench owns room-internal generation, customization,
   anomaly clearance, chronology children, and exact selected/unselected repair
   without selection mutation?
   Do anomaly takeover, replacement-map selection, and revert remain together
   on the parent normal-door transition rather than its occurrence workbench?
5. Does the source occurrence add an absent Contract/Chaos exit and its compact
   card remove/select it in the same tab without a split or duplicate editor?
6. Does each stage keep the current/source occurrence workbench with a total
   outgoing state—authored decision, frontier/blocker, or terminal—while
   selecting a normal or additional exit advances to that continuation's own
   stage without mutating any retained occurrence? Can a missing target still
   be created without reintroducing an inline room editor, and do Hub-sourced
   handoffs remain Hub-owned?
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
20. Do deletion scans eliminate local-child, normal/Contract/Chaos inline full
    room/chronology editors, `Move to next decision`, Fields, Acquisitions,
    automatic O reward acquisition, and encounter chronology as parallel paths,
    while retaining the one bounded door identity/reward editor?
21. Does each broad gate run one complete repository check before commit?
22. Do door cards and decision rails consume one exact door-contract product,
    with H cage rewards on the door, Fields side rewards in the room, and O
    wheel rewards phase-local after entry?

Any material contradiction stops execution for another amendment. Review may
not silently reinterpret the gate or defer a competing path to closure.
