# Room Lifecycle Workbench Implementation

## Status

Locked focused delivery plan. Gate A landed as
`ddada8bccf3acaf51dffd9264a3f0f6c73a242c7` and Gate A.1 landed as
`3109c2b`. Gate B and Gate C remain. Gate A.1 was added after Gate A review
exposed a useful consequence of the lifecycle tabs: Run State can now name
exact room-local checkpoints instead of remaining a decision-only diagnostic.

This document is temporary delivery authority. It is not linked from the
README or stable design documents. Its required adversarial review completed
on 2026-08-19 with no model contradiction and the bounded Gate A/Gate B scope
clarifications recorded below. The lifecycle concordance was then amended
before Gate A review to lock the game-event correspondence, the single Cleanup
interval, O inter-phase barriers, and Fields' fixed encounter-cycle skeleton.
After the implementation and durable closure land, absorb its lasting
conclusions into the owning design, biome, and audit documents and delete this
file.

Gate B was narrowed again on 2026-08-20 after the Q final-Preboss Hermes
delivery contact exposed a false premise in the source-intent design. The first
eligible purchase identifies the source slot for Travel Deal or Gold Gold Gold,
but the generated payload is legal against the exact history at that purchase,
not against frozen Shop-entry history. Gate B therefore owns only Purchased
participation and Action-row clutter reduction. It adds no Travel/Gold intent,
payload, or schema authority.

The pending durable-closure gate in
[`ROOM_ACTION_ORDER_IMPLEMENTATION.md`](./ROOM_ACTION_ORDER_IMPLEMENTATION.md)
remains paused. This plan builds on the landed occurrence-owned Room Actions
model and replaces only its current player-facing workbench composition. It
does not reopen the schema-47 chronology cutover, N Hub engine walk, door
ownership, or occurrence-stage model.

Owning authorities:

- [`ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md`](../audits/ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md)
- [`SHOP_AND_WELL_INTERACTION_LIFECYCLE.md`](../audits/SHOP_AND_WELL_INTERACTION_LIFECYCLE.md)
- [`ALL_TOGETHER_AND_SHOP_TRAITS_GAME_DATA_AUDIT.md`](../audits/ALL_TOGETHER_AND_SHOP_TRAITS_GAME_DATA_AUDIT.md)
- [`ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md`](../audits/ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md)
- [`HERMES_SHRINE_DELIVERY_GAME_DATA_AUDIT.md`](../audits/HERMES_SHRINE_DELIVERY_GAME_DATA_AUDIT.md)
- [`ROOM_LIFECYCLE_MODEL.md`](../design/ROOM_LIFECYCLE_MODEL.md)
- [`AUTHORED_PROJECT_MODEL.md`](../design/AUTHORED_PROJECT_MODEL.md)
- [`EDITOR_MODEL.md`](../design/EDITOR_MODEL.md)
- [`STRUCTURED_EDITOR_WORKSPACE.md`](../design/STRUCTURED_EDITOR_WORKSPACE.md)
- biome authorities for [H](../biomes/H_GAME_RULES.md),
  [N](../biomes/N_GAME_RULES.md), and [O](../biomes/O_GAME_RULES.md)

## Objective

Make an entered room read like the room the player experiences in the game:

1. **Room Overview** declares what exists or is intended in the room.
2. **Room Actions** presents the fixed lifecycle and the actual player-action
   chronology that resolves those objects.
3. **Room Doors** presents the outgoing decision owned by that occurrence
   stage.

The workbench must stop mixing setup, chronology, and outgoing doors in one
long vertical surface. Authoring should normally proceed left to right without
creating a second semantic authority for encounter timing, Shop purchases,
generated pickups, or door generation.

The ordinary player-facing shape is:

```text
Room Overview | Room Actions | Room Doors
```

O ShipCombat uses its declaration-owned phase envelope:

```text
Room Overview | Intro Actions | Combat 1 Actions | Combat 2 Actions | Room Doors
```

`Combat 2 Actions` exists only when the third phase is structurally active.
Retained inactive Combat 2 state and stale chronology remain accessible through
an explicit repair surface; phase deactivation must not erase or hide them.

The plan also restores a concise Shop authoring flow:

- Overview marks which initial Shop offers were purchased;
- Room Actions orders only participating purchases and generated pickups; and
- the engine walk remains the sole authority for both the purchase that
  triggers Travel Deal or Gold Gold Gold and the exact history against which
  its generated payload is evaluated.

## Source Facts and Planner Boundaries

### Shared room lifecycle

- Encounter identity is fixed before its encounter begins. Encounter
  completion is distinct from later NPC interaction, room-reward pickup, and
  generated-pickup interaction.
- Outgoing generation and exit usability remain distinct engine checkpoints.
  They are not separate peer phases in the player-facing timeline. Cleanup is
  the one final-room interval and contains those checkpoints at the exact
  profile-owned positions.
- Structural World Shops generate their outgoing decision before optional paid
  purchases settle.
- Wells of Charon and Shrines of Hermes are room-local interactions unlocked
  after encounter completion and outgoing generation. Their future purchase
  actions therefore belong to the cleanup interval and cannot retroactively
  alter the current room's doors.
- A normal Shrine purchase creates pending delivery state. A qualifying later
  `EndEncounterEffects` decrement may materialize the exact delivery before
  exits unlock and before post-combat pickups are resolved. The later concrete
  pickup is a separate action.

The player-facing tab order is an authoring workflow, not a claim that every
Overview edit occurs before every lifecycle event. In particular, the Room
Actions timeline must continue to show outgoing generation before post-outgoing
Shop, Well, or Shrine interactions where the source does so. Room Doors may be
the last authoring tab while still describing doors generated before those
cleanup interactions.

### Encounter and room-action timing

- Encounter selection remains authored on the exact
  `EncounterPhaseAddress`. It is not a movable `RoomActionReference`.
- The encounter picker appears at the derived `Start encounter` boundary for
  its phase. The fixed boundary gives the selection chronological meaning
  without persisting lifecycle events or a second order.
- `Start encounter` is a closed mandatory start sequence around the exact
  engine encounter activation. Devotion's chosen-source interaction and O's
  wheel choice may be grouped into that sequence because no unrelated room
  action, feature, or door can interleave there. No second `Combat started`
  boundary is introduced.
- Before-combat actions occur between room entry and encounter start.
- NPC contacts, room rewards, deliveries, and other phase products occur after
  the matching encounter-end boundary according to their existing action
  dependencies.
- `End encounter` consistently means combat ended and post-combat objects became
  available. O's later required-object wait belongs to `Start next phase`, not
  to a different meaning of encounter end.
- An encounterless room omits encounter boundaries rather than inventing an
  empty encounter editor.

### Mourning Fields

- A Fields room remains one physical occurrence with one global action order,
  but its lifecycle skeleton is fixed rather than freely shaped.
- The active cage count creates two or three ordinal encounter cycles. Authored
  cage order chooses which cage occupies the first, second, and optional third
  cycle.
- Each cycle is exactly
  `Start chosen cage encounter -> End chosen cage encounter`. The existing cage
  action remains the atomic
  activation-through-combat simplification, so no modeled action may occur
  inside the active wave.
- The matching encounter picker is shown at that cycle's Start boundary; the
  derived End boundary follows the atomic cage action.
- The passive entry phase remains declaration-owned. Passive Gorgon or other
  supported entry-phase contacts must not be lost merely because the compact
  player explanation emphasizes cages.
- Optional minor rewards can be placed before the first cage, between completed
  cages, or after the final cage. The planner intentionally omits their
  technically possible mid-combat pickup.
- NPC/Gorgon contacts and cage rewards remain unavailable before their exact
  cage ends. An ordinary unpicked cage reward does not block the next cage.
- A contact with `BlockFieldsEncounterStart`, including Gorgon Athena, must
  resolve before the next authored cage starts. That dependency follows the
  authored cage permutation, not declaration slot order.
- After the final cage ends, Cleanup contains the remaining fluid actions. All
  required cage rewards and dependent required pickups must resolve before exit
  use; optional minors may remain. Room features are unavailable between cage
  cycles and join only the final Cleanup interval.
- Fields setup—active cages, cage reward identities, optional count, and
  optional reward identities—belongs to Overview. Interacting with those
  objects belongs only to Room Actions.

### Ephyra main and side rooms

- An N main-room Overview owns its complete local side-room board: which side
  rooms are generated and the order in which the player visits them.
- Generation and visit order remain parent-main-room topology. They are not
  Room Actions and are not moved into a side-room occurrence.
- Each generated side room remains a real addressable `RoomOccurrence`. Once
  entered, that occurrence owns only its own Overview, Room Actions, and Room
  Doors products.
- A side-room failure blocks the true engine walk from that occurrence onward,
  but it does not retroactively invalidate or hide the parent main room's
  generation and ordering controls.

### Thessaly ShipCombat

- The active envelope is Intro, Combat 1, and optional Combat 2.
- Encounter count belongs to Overview.
- Each phase tab renders its encounter picker at `Start encounter`, its
  post-combat interactions after `End encounter`, and the next wheel editor at
  the declaration-owned `Start new phase` boundary.
- Wheel identity authoring and the chronological `chooseRewardWheel` action
  remain distinct products. The editor can configure a wheel at the boundary
  without pretending the choice action has already occurred.
- Wheel 1 setup belongs after Intro and before Combat 1. Wheel 2 setup belongs
  after Combat 1 and before Combat 2. The final active phase has no following
  wheel editor.
- `Start new phase` requires the preceding phase's complete required-object
  cleanup. It is intentionally analogous to a room-transition barrier, but it
  does not expose room features or doors. O has only one room-level Cleanup,
  after the final active phase.
- The selected wheel pickup stays after its matching combat. Outgoing
  generation continues to use the final active wheel's exact source offer
  point.
- A retained inactive phase row is rendered exactly once in an inactive-phase
  repair surface and never grouped under another active phase.

### World Shop, Travel Deal, and Gold Gold Gold

- Initial Shop inventory materializes on entry. Reward identity remains owned
  by the inventory row.
- A normal paid offer participates only when the player marks it Purchased.
  Purchase membership and position remain encoded by the one
  occurrence-owned `roomActions.order`; no second purchased set is persisted.
- Overview's purchase marker is a direct semantic view of that membership. It
  inserts or removes the exact `interactShopOffer` reference through an
  engine-owned intent. It does not expose ordering controls.
- Room Actions renders participating paid offers, active supplemental pickups,
  and required/stale repair rows. It does not repeat every unpurchased initial
  offer below an ordering boundary.
- Travel Deal is determined by the first accepted normal paid purchase when
  Travel Deal was already active at Shop entry. Infernal Contract does not
  participate, and acquiring Travel Deal from the same Shop cannot
  retroactively trigger it.
- Gold Gold Gold is determined by the first accepted eligible source while its
  one-use effect is active. `SpellDrop` is ineligible and does not consume the
  effect. A materialized Travel Deal refill can itself become Gold's eligible
  source; Infernal Contract cannot.
- Chronology derives the actual Travel and Gold sources. No persisted source
  selector duplicates that authority.
- The generated payload is evaluated against the exact history prefix at the
  triggering purchase. A source slot chosen by first-purchase rules is not a
  sufficient payload-authoring context.
- Earlier same-room actions may change that context. The Q final-Preboss forced
  Hermes delivery is the representative future contact: acquiring it before a
  purchase may lock the god pool before Travel generates a refill, while
  acquiring it afterward cannot retroactively change that refill.
- Gate B changes only base-purchase participation and presentation. It leaves
  all existing Travel/Gold commands, payloads, frontiers, findings, and
  settlement rules untouched.

## Locked Modeling Shape

The decisions in this section are the locked implementation contract. The
concordance amendment below supersedes conflicting earlier wording and must be
reviewed against the live Gate A diff before that gate is committed.

### Concordance correction before Gate A continuation

The interrupted Gate A implementation must be reviewed and remediated against
the following exact corrections before it can be committed:

| Area                 | Required documentation/model correction                                                                                                                                                                       | Required implementation correction                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start encounter      | Treat the label as one closed mandatory start sequence around exact encounter activation. Devotion's chosen source and O's wheel choice may be grouped only because no unrelated interaction can occur there. | Place the boundary before the complete mandatory start sequence; do not allow ranked actions to straddle it and do not add a second combat-start seam.                                                            |
| End encounter        | Give it one meaning in every combat profile: combat has ended and post-combat objects/effects are now observable.                                                                                             | Place the boundary before NPC, room-reward, wheel-reward, delivery, and other post-combat interactions rather than after the entire action window.                                                                |
| O next phase         | Treat the prior phase's required-object wait as the gate for the next phase. No room feature or door is usable between Ship phases.                                                                           | Keep reward/NPC resolution after End encounter; publish the next wheel/start boundary only after all required actions in that phase clear. Render one final Cleanup after the last active phase.                  |
| Cleanup and exit use | Present one Cleanup interval. Outgoing generation and exit usability remain exact engine checkpoints within or at its profile-owned edges, not peer player-facing phases.                                     | Remove the universal `exitUsable` timeline row while retaining its validation capability/checkpoint. Place Cleanup from the profile's final no-more-encounters point and preserve exact outgoing-generation rank. |
| Fields structure     | Lock a two- or three-cycle ordinal skeleton whose cage identities are supplied by authored order. Actions remain fluid only before the first cycle, between cycles, and in final Cleanup.                     | Derive Fields cycle order from ranked active cage actions, bracket each atomic cage action with Start/End, and reject any action placement inside that atomic span.                                               |
| Fields blockers      | An unpicked cage reward does not block a later cage. A same-phase `BlockFieldsEncounterStart` contact does, and its barrier follows whichever cage is authored next.                                          | Replace declaration-slot-based cross-cage contact dependencies with schedule/order-aware validation. Preserve same-cage availability and final required-reward exit barriers.                                     |

Gate A remains schema-preserving. The persisted `completeFieldsCage` reference
continues to name the atomic activation-through-completion action; the corrected
timeline supplies its player-facing Start and End seams. This avoids inventing
separately authored lifecycle events or a second Fields order.

### 1. Setup, chronology, and exits remain separate authorities

Overview may author room-local declarations and intent. It may not settle an
action or write a second order. Room Actions may change participation and
ordering but may not rewrite reward, encounter, or door identity. Room Doors
may author the outgoing decision but may not settle objects in the current
room.

The occurrence stage remains the semantic owner of both the room and its
outgoing decision. Tabs change presentation only; they do not move the
decision, occurrence, or reward payload in authored state.

### 2. Lifecycle boundaries are an engine-owned derived product

Add a closed engine product that places fixed semantic boundaries and existing
Room Action rows into one occurrence-local sequence. At minimum, its boundary
vocabulary must distinguish:

- room entered;
- encounter start for an exact phase;
- encounter end for an exact phase;
- start of the next Ship phase and its exact wheel;
- outgoing generation when declared;
- one final Cleanup interval; and
- exit usability as a non-rendered capability/checkpoint.

The product carries semantic keys, phase/wheel identity, and position relative
to ranked actions. It does not return React tabs, component labels, picker
sections, callbacks, or mutable UI state.

The existing `RoomActionRoster` remains the authority for active actions,
dependencies, stale rows, proposals, and validity. The timeline consumes or is
assembled beside that roster; it must not recalculate action eligibility or
introduce another order.

### 3. Encounter controls attach to fixed boundaries

Application assembly joins each projected encounter interaction to its exact
engine `encounterStart` boundary. React renders the existing contextual picker
there. The authored command remains `SelectEncounter`/`ResetEncounter` at the
same `EncounterPhaseAddress`.

There is no new persisted encounter action, no generic lifecycle command, and
no implicit encounter selection when a tab opens.

### 4. Tabs are transient application state

Manual tab selection is editor-session state and never enters the project
document or undo history. Ordinary occurrence entry defaults to Overview.

Semantic focus overrides that default:

- room setup, Shop inventory/participation, room feature, and Fields setup
  findings open Overview;
- encounter and active action findings open the exact Room Actions or O phase
  tab;
- inactive Ship rows open the inactive repair surface;
- outgoing decision, room target, and door reward findings open Room Doors.

Application projection owns the closed owner-to-tab destination. React must not
infer it from labels, action-key strings, biome keys, or DOM location.

### 5. Shop purchase markers reuse chronology membership

Each initial Shop row projects an engine-backed Purchased toggle. Checked means
its exact `interactShopOffer` reference participates in
`roomActions.order`; unchecked means it does not.

Checking an offer uses one engine-owned insertion intent with a declared stable
default position. The intended default is after the currently ranked room
actions, which is legal for the shared post-outgoing Shop window and remains
freely reorderable afterward. Unchecking removes only that exact action.

The semantic participation command is one closed
`ReplaceShopPurchaseParticipation` intent over an exact `ShopOfferAddress`.
`purchased: true` appends that offer's `interactShopOffer` reference at the
declared default position and therefore requires a current materialized Shop
plus an exact declaration-owned initial offer. `purchased: false` removes only
the exact matching ordered `interactShopOffer`; it remains structurally
accepted when the occurrence is no longer a Shop or the offer is no longer
active so a room-replacement/deactivated-owner edit cannot strand stale
chronology. It never removes another stale action. Overview owns the ordinary
insert/remove interaction. Actions may move ranked base
purchases but must not expose generic `InsertRoomAction`/`RemoveRoomAction`
membership for them. Those generic commands reject `interactShopOffer`, and
the Room Action roster emits no generic insert/remove proposal for a base Shop
offer. A retained stale base-purchase row may expose the same
`purchased: false` semantic repair intent, never a second removal authority.
Unranked optional initial offers are neither active rows nor repair rows;
generated supplemental pickup rows retain their existing generic insert/remove
repair interactions. Direct command and proposal tests must prove this closed
split.

If review proves that append cannot be a truthful structural default for every
active initial Shop offer, the engine must return the one supported toggle intent;
the application may not choose among insertion proposals itself.

### 6. Travel and Gold remain action-point-derived

Gate B does not add a source selector, a source-intent field, an effective-source
mode, or an Overview-owned Travel/Gold payload editor. The actual ordered
actions remain the sole source authority:

- the first accepted normal paid purchase triggers Travel Deal;
- the first accepted Gold-eligible purchase triggers Gold Gold Gold according
  to the game's own processing order;
- a `SpellDrop` purchase may trigger Travel while leaving Gold available for a
  later eligible purchase; and
- a reached Travel refill may become Gold's source only through the real
  chronology that generated and then purchased it.

The source action does not by itself determine the dependent reward's complete
candidate domain. Generation uses the exact history at that action point. Any
earlier same-room acquisition may change god-pool closure, trait history, Pom
targets, reward-bag eligibility, or another contextual requirement. Q's forced
final-Preboss Hermes delivery is the representative contact: opening a delivered
Hermes mystery reward before the World Shop purchase may lock a fourth god,
while taking the purchase first evaluates Travel's refill before that lock.

Therefore a future Travel/Gold presentation correction must consume an exact
action-point candidate frontier. It must not approximate that frontier from
Shop-entry history, a chosen source slot, or an existential completion of later
actions. Reordering an earlier acquisition across the source purchase must
re-evaluate the dependent payload at the new history prefix while preserving a
structurally retained invalid payload for repair where the authored model
supports it.

This gate leaves the existing Travel/Gold authored payload, settlement,
placeholder, and command paths unchanged. It neither blesses their current UI
as the final design nor creates transitional compatibility state. Their later
replacement belongs with delivery-aware, action-point authoring and must delete
the superseded path in that complete slice.

### 7. Purchased markers do not settle purchases

Overview checkboxes author only participation. They do not acquire the offer,
choose a Travel/Gold source, generate a dependent reward, or advance canonical
history. The purchase occurs only when the engine walk reaches its ordered
`interactShopOffer` action.

Changing Purchased membership may therefore change which existing
chronology-derived supplemental action becomes active or invalid. That result
continues to come from the engine's current settlement product. The application
does not predict it, and the participation command never cascades into a
supplemental payload edit.

### 8. Gate B is schema-neutral

The existing strict authored schema remains unchanged. Purchased state is
already represented by exact membership in occurrence-owned
`roomActions.order`; a second persisted purchase set would be redundant. Gate B
adds only the semantic participation command and its application projection.
It adds no Shop envelope, retained source intent, or payload materialization
basis.

### 9. Findings and navigation retain existing ownership

Purchase-marker findings and stale participation repair attach to the exact
Shop offer/Room Action owner and open the containing Overview or Actions
surface as appropriate. Existing Travel/Gold findings continue to follow their
current chronology and acquisition-entry ownership. Gate B does not translate
them into Overview source-intent findings or move their payload editor.

### 10. Future Well and Shrine support fits without scaffolding

This plan does not implement Wells or Shrines. It locks the extension contact
they will later use:

- their inventory and selected purchases belong to Overview;
- Well/Shrine interactions contribute actions in the cleanup/post-outgoing
  interval;
- normal Shrine purchases create retained delivery state rather than immediate
  acquisition;
- qualifying encounter-end processing may contribute a delivered pickup to the
  matching post-encounter interval; and
- concrete delivery acquisition uses the ordinary acquisition participant and
  payload machinery.

Do not add empty Well/Shrine unions, registries, controls, or persisted fields
in this implementation merely to reserve that future work.

### 11. Run State checkpoints follow the lifecycle without replacing generation state

Run State is a derived diagnostic over exact reward branches and history views.
It is not authored state and does not enter undo/redo. Gate A.1 adds one closed,
non-persisted room-checkpoint owner with three exact points:

- `roomEntered`: after the room-entry event and before its first Room Action;
- `beforeEncounterStart(phaseKey)`: after any preceding phase transition and
  wheel materialization/choice, but before that phase's encounter-start
  effects; and
- `beforeRoomExit`: after all reached room-local settlement and immediately
  before the room-exit event.

The existing decision-owned `beforeTargetGeneration` snapshot remains a
separate engine product because it explains the state that generated door
identity and rewards. A literal `beforeRoomExit` snapshot must not replace or
relabel it. Ordinary Room Doors presents the new pre-exit checkpoint; Hub board
generation may continue to present the existing decision snapshot where no
ordinary occurrence checkpoint is the truthful owner.

The checkpoint owner is a derived semantic address containing the occurrence
and exact checkpoint discriminator. It is not added to the authored codec and
does not bump the schema. Non-Ship occurrences publish `roomEntered` and
`beforeRoomExit`; ShipCombat publishes one `beforeEncounterStart` per active
phase plus `beforeRoomExit`, with no separate Ship `roomEntered` owner. Intro's
pre-start state is the Ship entry diagnostic.

Progressive coverage enumerates structurally eligible checkpoint owners only
from the retained `materializedPrefix`. Owners retained beyond the assessment
frontier remain visible but disabled; authored occurrences absent from that
prefix publish no launcher. React receives complete launchers and never
reconstructs snapshots from events or room-action rows.

The history fold owns an exact per-phase pre-start view captured immediately
before each `encounterStarted` event. Run State consumes that product rather
than refolding event prefixes or rebuilding counters. Entry consumes the
existing room `entry` view. Pre-exit consumes `postCommit`; Shop capture occurs
after `completePendingShopAcquisitionSite` and before the `roomExited` branch
advance, preserving settlement semantics while including all final purchases.
An N main occurrence's pre-exit view is the state before leaving that main
occurrence into its first local visit or its topology-owned continuation. A
later side-room acquisition belongs to that side occurrence's own checkpoints
and is not retroactively included in the main-room snapshot. Parent and Hub
restoration replay no lifecycle and create no additional main/Hub Run State
snapshot. The persistent Hub room never receives a fabricated room-exit
checkpoint.

## User-Facing Composition

### Standard, Shop, Fields, and N occurrences

`Room Overview` contains only sections that exist:

- read-only room and incoming reward context;
- meaningful room-specific setup;
- Shop inventory, purchase markers, and conditions;
- Fields cage/optional setup;
- N main-room side-room generation and local visit ordering before Room
  features; and
- Room features such as Add/Remove Chaos gate or Zagreus contract.

`Room Actions` renders the engine timeline, including fixed boundaries and the
one ranked action product. A no-encounter room omits encounter boundaries. A
Shop still shows outgoing generation before its paid purchase actions.

`Room Doors` renders the existing total outgoing-stage product: authored doors,
provisional authoring frontier, blocker, topology-owned continuation, or
terminal state. Moving this surface into a tab does not change its exact owner
or commands.

### H Fields occurrence

The Fields action tab remains one global chronology. It visually partitions
the order at engine-projected entry/passive and cage boundaries while retaining
one shared reorder interaction.

Illustrative presentation:

```text
Room entered
  optional pickups and passive contacts when ordered here

Start first chosen cage encounter
  Encounter: <picker for that exact cage>
End first chosen cage encounter
  its cage reward / NPC / optional pickups when ordered here

Start second chosen cage encounter
  ...

Outgoing generation
Cleanup
```

The labels are ordinal authored execution slots, not a fixed `Cage01` then
`Cage02` declaration order. Application assembly uses the active cage count and
ranked cage permutation, and inactive retained state remains repairable.

### O ShipCombat occurrence

Overview contains encounter count and general room features. Phase tabs consume
the engine timeline:

```text
Intro Actions
  Start Intro encounter
    Encounter: <Intro picker>
  End Intro encounter
    Intro contacts
  Start Combat 1 phase
    Wheel 1 editor
    Choose Wheel 1 action

Combat 1 Actions
  Start Combat 1 encounter
    Encounter: <Combat 1 picker>
  End Combat 1 encounter
    Wheel 1 pickup / Icarus contact
  Start Combat 2 phase        (three-phase only)
    Wheel 2 editor
    Choose Wheel 2 action

Combat 2 Actions             (three-phase only)
  Start Combat 2 encounter
    Encounter: <Combat 2 picker>
  End Combat 2 encounter
    Wheel 2 pickup / Icarus contact
  Outgoing generation
  Cleanup
```

The final active phase owns outgoing generation. Two-phase ShipCombat places it
after Combat 1; three-phase ShipCombat places it after Combat 2.

## Ownership by Lane

### Planner Engine

Owns:

- the structural Shop purchase-participation command over
  `roomActions.order`;
- semantic lifecycle-boundary/timeline product;
- exact H/O phase placement and inactive-row preservation;
- actual trigger derivation from canonical Room Action order;
- existing Travel/Gold settlement and action-point candidate authority; and
- exact active/stale purchase-row support and proposals.

It does not return tabs, UI labels, React components, or callbacks.

### Planner Application

Owns:

- adapting the engine timeline into Overview/Action/Doors workspace products;
- joining exact encounter, wheel, reward, feature, and purchase
  interactions to their semantic positions;
- closed semantic-owner-to-tab focus routing;
- binding purchase markers to complete engine intents; and
- ensuring every editable payload and every action row appears exactly once.

It does not derive lifecycle placement, Shop trigger rules, Gold exclusions,
Fields cage partitions, or O phase ordering.

### React

Owns:

- accessible tab presentation and keyboard behavior;
- rendering the closed workspace products;
- local visual summaries and responsive layout; and
- dispatching complete bound intents.

It does not inspect reward types, action keys, trait identities, lifecycle
profiles, or biome names to infer policy.

## Delivery Gates and Commit Boundaries

### Gate A — Lifecycle timeline and tabbed room workbench

Intended commit:

```text
feat(planner): present room work through lifecycle tabs
```

Deliver:

- engine-owned closed lifecycle-boundary/timeline product;
- corrected Start/End placement, one Cleanup interval, and non-rendered exit
  usability checkpoint;
- Standard, encounterless, Shop, Fields, and Ship timeline composition;
- Fields ordinal cage cycles derived from authored cage order, including
  order-aware blocking-contact barriers;
- Overview/Actions/Doors workspace contracts;
- O phase-specific Action tabs and inactive repair surface;
- encounter controls at exact start boundaries;
- wheel editors at exact next-phase boundaries;
- outgoing decisions in Room Doors with ownership unchanged;
- transient tab state and exact finding navigation; and
- deletion of the old vertically composed direct Encounter/Fields setup/Room
  features/Room Actions/outgoing rendering path.

Gate A must not change authored schema, Shop trigger behavior, purchase
participation, Travel/Gold persistence, Well/Shrine support, or canonical
settlement.

The tabbed Shop in Gate A therefore retains the complete current Room Action
roster and its existing ranked/unranked membership presentation. Gate A does
not add Purchased markers and does not filter unmarked initial offers out of
Actions. Those two coupled participation changes land together in Gate B.

Primary owners:

- engine Room Action assembly/timeline tests;
- H materialization and O validation/history witnesses;
- structured-workspace occurrence assembly and closure tests;
- OccurrenceWorkbench and BiomeWorkspace interaction tests; and
- representative F/H/N/O product-loop workflows.

Acceptance witnesses:

1. Standard combat opens Overview, then Actions with its encounter picker at
   Start Encounter, then Doors.
2. A no-encounter Shop omits encounter boundaries but shows outgoing generation
   before post-outgoing purchases.
3. H with two and three active cages renders one fixed ordinal Start/End cycle
   per cage in authored cage order. Optionals can remain before the first,
   between cycles, or after the last, with no modeled mid-combat position.
4. Passive Gorgon contact remains visible and correctly placed.
5. Reversing two H cages also reverses their lifecycle cycles. The first
   cycle's blocking NPC must precede the second Start, while its unpicked cage
   reward may remain until final Cleanup.
6. O two-phase and three-phase tabs place encounter, wheel editor, wheel choice,
   pickup, outgoing generation, and one final Cleanup exactly once; no
   room-level Cleanup exists between phases.
7. O 3-to-2 retains inactive Combat 2 rows in one repair surface and restores
   them unchanged on 2-to-3.
8. A finding opens the exact Overview, phase Action, inactive repair, or Doors
   tab without changing authored history.
9. N side-room generation and visit ordering remain under the parent main-room
   Overview, while each entered side occurrence owns only its own
   Overview/Actions/Doors tabs.

### Gate A.1 — Lifecycle-checkpoint Run State

Intended commit:

```text
feat(planner): expose room lifecycle run state
```

Deliver:

- one derived, non-persisted room Run State checkpoint address;
- exact engine snapshots and explicit progressive availability for room entry,
  active O phase starts, and pre-exit;
- preservation of the existing decision `beforeTargetGeneration` snapshot;
- ordinary/H/Shop entry launchers at `Room entered` in Room Actions;
- one launcher for each active O phase at its encounter-start seam;
- one literal pre-exit launcher in Room Doors;
- a workspace-level launcher index so sheet lookup and reconciliation do not
  scan or infer nested React structure;
- exact disabled behavior for unreached checkpoints; and
- deletion of occurrence-sourced decision-card Run State placement superseded
  by the room-local entry/pre-exit launchers. Both `HubDecisionAddress` board
  generation and Hub-sourced `ExitDecisionAddress` before-Preboss launchers
  remain generation-owned because neither has a truthful ordinary occurrence
  replacement.

Gate A.1 must not change authored schema, lifecycle execution, Room Action
order, reward settlement, candidate eligibility, door generation, Hub
chronology, or the contents of the Run State presentation. It may generalize
the current decision-only owner/snapshot names, but it must keep generation and
pre-exit checkpoints distinct.

Primary owners:

- history-fold per-phase checkpoint tests;
- engine Run State snapshot/publication and progressive-coverage tests;
- reward-walk witnesses at `roomEntered`, O `encounterStarted`, and
  `roomExited`;
- structured-workspace source/index/occurrence assembly tests;
- editor-session reconciliation and Run State sheet lookup tests;
- OccurrenceWorkbench lifecycle-placement tests; and
- the Run State product loop.

Acceptance witnesses:

1. A reached ordinary combat exposes room-entry state in Actions and
   pre-exit state in Doors; their history sequences and checkpoint identities
   are distinct.
2. A later occurrence retained in `materializedPrefix` but beyond assessment
   coverage exposes its structural launchers disabled and creates no snapshot;
   an occurrence absent from the prefix exposes no launcher.
3. O exposes Intro, Combat 1, and active Combat 2 pre-start snapshots on their
   exact phase tabs; it exposes no separate room-entry owner, and two-phase O
   exposes no Combat 2 owner.
4. Combat 1 state includes the resolved Wheel 1 transition but precedes Combat
   1 encounter-start effects; Combat 2 follows the analogous Wheel 2 frontier.
5. Post-outgoing Shop settlement appears in `beforeRoomExit` but not in the
   retained `beforeTargetGeneration` snapshot.
6. Opening and closing any launcher changes only transient editor state and
   never authored history.
7. Finding navigation/tab changes do not alter which checkpoint a launcher
   opens.
8. Before-Hub `HubDecisionAddress` and Hub-sourced before-Preboss
   `ExitDecisionAddress` Run State remain generation-owned; neither is
   fabricated as a room-exit checkpoint.
9. An N main pre-exit snapshot excludes later side-room acquisitions; the side
   occurrence's own pre-exit snapshot includes its reached acquisition, and
   restoring the parent/Hub publishes no duplicate snapshot.

### Gate B — Shop purchase participation

Intended commit:

```text
feat(planner): author shop purchase participation
```

Deliver:

- one engine-owned Purchased toggle intent that writes only the exact base
  `interactShopOffer` membership in `roomActions.order`;
- Overview purchase markers for every materialized initial Shop offer;
- Actions filtered to participating base purchases plus the existing
  active/stale/required supplemental work;
- specialized stale purchase repair through the same Purchased interaction;
- ranked purchase movement without a second generic membership interaction;
- exact marker/finding navigation and one-step undo/redo; and
- deletion of unranked, unpurchased base Shop offers from both the active Action
  timeline and generic repair surface.

Explicitly do not add a schema version, Shop source intent, Travel/Gold selector,
Gold authoring mode, target-driven payload frontier, or Overview-owned
supplemental payload editor. Existing Travel/Gold settlement and authoring paths
remain untouched in this gate.

Primary owners:

- authored Shop participation command tests;
- Room Action structural-support, roster, and timeline tests;
- structured-workspace binding/assembly tests;
- Shop React tests; and
- one complete World Shop product loop.

Acceptance witnesses:

1. Marking two offers Purchased adds only those exact two purchase actions;
   unmarked inventory remains editable in Overview and absent from Actions.
2. Unmarking removes only that purchase action. One edit is one undo step, and
   undo/redo restores membership, order, marker focus, and rendered row.
3. Generic Room Action insert/remove rejects base `interactShopOffer`; ranked
   purchases retain move proposals and reorder normally.
4. A stale base purchase repairs through the same `purchased: false` intent,
   never a generic remove proposal, including after room replacement removes
   the active Shop owner.
5. Unranked initial Shop offers appear neither as active Action rows nor generic
   repair rows. Existing supplemental pickup participation/repair remains
   unchanged.
6. Travel Deal, Gold Gold Gold, and Infernal Contract behavior is byte-for-byte
   unchanged by toggling an unrelated base purchase except for the canonical
   consequences of that changed action membership/order. No source selector or
   new supplemental editor appears in Overview.
7. One reached World Shop workflow can mark purchases, reorder them in Actions,
   unmark one from Overview, and undo/redo without extra evaluation work or a
   duplicate membership control.

### Gate C — Durable closure

Intended commit:

```text
docs(planner): close room lifecycle workbench delivery
```

After fresh adversarial review of Gates A and B:

- update `ROOM_LIFECYCLE_MODEL.md`, `AUTHORED_PROJECT_MODEL.md`,
  `EDITOR_MODEL.md`, and `STRUCTURED_EDITOR_WORKSPACE.md` with the final model;
- update H/O and Shop/Travel/Gold planner dispositions without rewriting source
  facts;
- record the unchanged schema and completed delivery in
  `IMPLEMENTATION_PROGRESS.md`;
- reconcile the still-pending closure record in
  `ROOM_ACTION_ORDER_IMPLEMENTATION.md`;
- remove superseded wording, gate comments, and temporary compatibility paths;
- delete this temporary plan and, if all its remaining closure obligations are
  satisfied, the older Room Action implementation plan; and
- run one complete `npm run check` after all reviewed remediation is stable.

## Deletion and Retirement Expectations

The completed change must remove, not preserve beside the new path:

- the direct Encounter section outside lifecycle boundaries;
- separate vertical Room features, Fields setup, Room Actions, and outgoing
  sections as the top-level occurrence composition;
- application-owned O phase placement that duplicates the engine timeline;
- unpurchased initial Shop offers from the Action ordering surface;
- unranked optional initial Shop offers from the repair-row surface;
- finding navigation that opens only the containing occurrence without the
  exact tab/phase destination.

Do not retain a compatibility projection or hidden legacy workbench. Gate B is
schema-neutral and must not add a persisted purchase set beside
`roomActions.order`.

## Explicit Non-Goals

- Implementing Wells of Charon or Shrines of Hermes.
- Modeling prices, affordability, rerolls, discounts, delivery delay choice,
  rush, or pending SpellDrop.
- Changing Travel Deal, Gold Gold Gold, Contract, Echo, reward identity, trait,
  Pom, Artificer, or Time Piece settlement/authoring rules in Gate B.
- Adding Travel/Gold source intent, source selectors, effective-source modes,
  or Overview-owned generated payload editors.
- Approximating a generated Shop payload from Shop-entry history rather than
  its exact triggering action prefix.
- Persisting UI tabs, expansions, scroll positions, or timeline labels.
- Persisting fixed lifecycle events or encounter selection as Room Actions.
- Auto-reordering purchases to satisfy Travel or Gold.
- Creating a generic lifecycle scripting language, effect registry, or React
  policy switch on biome names.
- Reopening N Hub generation or visit chronology.
- Moving incoming room or reward identity out of the predecessor-owned door
  contract.

## Adversarial Review Targets

Before locking implementation, challenge at least these risks:

1. Does the proposed engine timeline represent the closed Start sequence,
   encounter end, exact outgoing generation, one Cleanup interval, and the
   non-rendered exit-usability capability without duplicating lifecycle
   execution?
2. Can H derive its ordinal cage cycles from authored cage order while keeping
   optional actions fluid, blocking contacts order-aware, ordinary cage rewards
   nonblocking, and passive Gorgon provenance intact?
3. Does O retain one global order and one final Cleanup while phase tabs render
   each active or stale row exactly once?
4. Can Room Doors move into a tab without breaking provisional first-edit,
   unselected target repair, additional exits, terminal stages, or semantic
   focus?
5. Is appending a newly marked purchase always a truthful structural default,
   while canonical Travel/Gold consequences remain engine-derived from order?
6. Can stale purchase membership always repair through Purchased without
   exposing a second generic remove authority?
7. Are unpurchased initial offers absent from both active rows and repair rows
   without hiding generated supplemental repair?
8. Does the gate leave every Travel/Gold command, payload, frontier, finding,
   and settlement path unchanged?
9. Does tab routing stay application-owned and transient without making React
   infer semantic ownership?
10. Do future Well/Shrine contacts fit the lifecycle product without adding
    speculative production scaffolding now?

## Verification Policy

During implementation, use the narrowest truthful owning lanes. Each executor
must report exact commands and totals. After a gate's focused tests and static
checks pass, run one independent adversarial review before committing that
gate. Route accepted findings back through one bounded remediation pass.

Do not run the complete repository gate after every edit. Gate C owns one final
`npm run check` after the implementation and review fixes are frozen. Record
the regular/heavy test totals, typecheck, lint, format, build, and any known
advisory truthfully in the durable progress record.
