# Room Lifecycle Workbench Implementation

## Status

Draft focused delivery plan on clean base
`1d2af0cb37e18c95ba2bcdb25147f683b741f3be`.

This document is temporary delivery authority. It is not linked from the
README or stable design documents. It must receive one adversarial plan review
before implementation is locked. After the implementation and durable closure
land, absorb its lasting conclusions into the owning design, biome, and audit
documents and delete this file.

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
- Room Actions orders only participating purchases and generated pickups;
- when Travel Deal or Gold Gold Gold is active at Shop entry, Overview records
  the player's intended trigger source;
- the engine walk remains the sole authority for the source that actually
  triggered each effect; and
- mismatches between authored intent, effect rules, and chronology produce
  exact retained-invalid findings instead of silently rewriting either side.

## Source Facts and Planner Boundaries

### Shared room lifecycle

- Encounter identity is fixed before its encounter begins. Encounter
  completion is distinct from later NPC interaction, room-reward pickup, and
  generated-pickup interaction.
- Outgoing generation and exit usability are distinct lifecycle boundaries.
  A required object can remain unresolved after outgoing doors have already
  been generated.
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
- Before-combat actions occur between room entry and encounter start.
- NPC contacts, room rewards, deliveries, and other phase products occur after
  the matching encounter-end boundary according to their existing action
  dependencies.
- An encounterless room omits encounter boundaries rather than inventing an
  empty encounter editor.

### Mourning Fields

- A Fields room remains one physical occurrence with one global action order.
- Each active cage-completion action remains the existing atomic
  activation-through-combat simplification.
- The matching encounter picker is shown immediately before that cage action;
  the derived encounter-end boundary follows it.
- The passive entry phase remains declaration-owned. Passive Gorgon or other
  supported entry-phase contacts must not be lost merely because the compact
  player explanation emphasizes cages.
- Optional minor rewards can be placed before the first cage, between completed
  cages, or after the final cage.
- NPC/Gorgon contacts and cage rewards remain unavailable before their exact
  cage completion. Required cage rewards must resolve before exit usability.
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
- The Travel and Gold intended sources are independent authored intentions.
  One generic `First purchase` field is incorrect.
- Chronology derives the actual Travel and Gold sources. Intent never forces,
  reorders, or substitutes that result.

## Locked Modeling Shape

The decisions in this section are the intended implementation contract. The
plan remains draft until adversarial review confirms that each decision matches
the live code and owning audits.

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
- cleanup/post-outgoing interaction availability; and
- exit usable.

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

- room setup, Shop inventory, room feature, Fields setup, and trigger-intent
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

Removing a purchase does not cascade-delete Travel/Gold intent or payload. Any
dependent intent becomes retained-invalid and receives a finding.

If review proves that append cannot be a truthful structural default for every
active Shop supplement, the engine must return the one supported toggle intent;
the application may not choose among insertion proposals itself.

### 6. Persist separate Travel and Gold source intentions

Advance the strict authored document to schema 49. Add optional retained source
intent to the materialized `ShopState` using a closed semantic shape equivalent
to:

```ts
interface ShopSupplementalSourceIntents {
  readonly travelDealRefill?: {
    readonly kind: 'shopOffer';
    readonly offerKey: string;
  };
  readonly echoDoubleShopReward?:
    | { readonly kind: 'shopOffer'; readonly offerKey: string }
    | { readonly kind: 'travelDealRefill' };
}
```

Codec and structural commands validate that referenced initial offers belong
to the exact materialized Shop. They do not require the effect to be active or
the source to be context-valid; those are simulation facts. Structurally
representable intent survives upstream trait, purchase, and chronology edits.

The controls appear only when the corresponding effect was active at Shop
entry. Dormant retained intent remains persisted and reappears unchanged when
the effect becomes active again.

### 7. Intent authoring and canonical settlement stay distinct

An engine-owned source-intent domain exposes structurally addressable sources
and contextual evidence without asking React to inspect reward types or action
order.

The target choice may prepare the dependent authored payload before chronology
matches:

- Travel evaluates the selected initial offer under the declared intention
  that it is the first accepted normal paid purchase;
- Gold copies the exact selected eligible source, including an already-authored
  Travel refill source;
- a Gold target of `SpellDrop` remains retained and invalid;
- a Gold target of Travel remains unresolved until the Travel refill has enough
  exact authored source detail to define the duplicate.

This authoring product is not canonical run history. The simulator still walks
the actual Room Action order, derives the actual trigger, and blocks the
supplemental settlement when intent and chronology disagree.

### 8. Findings compare intent with actual chronology

Publish exact findings for at least:

- an active effect with no source intent;
- an intended source that is not marked Purchased or never becomes active;
- Travel intent that is not the first accepted normal purchase;
- Gold intent that is not the first accepted eligible source;
- an ineligible Gold source such as `SpellDrop`;
- Gold targeting Travel when the refill is absent or unresolved; and
- mutually incompatible Travel/Gold intentions.

The intentions are compatible when chronology can satisfy both. In particular:

- Travel and Gold may name the same initial offer when that offer is
  Gold-eligible;
- Travel may name `SpellDrop` while Gold names a later eligible source; and
- Gold may name the Travel refill when the actual order first produces and then
  acquires that refill before any other eligible Gold source consumes the
  effect.

Findings attach to the exact supplemental entry/source-intent semantic owner and
navigate to Overview. The related action row may show the same evidence as a
read-only marker or navigation affordance, but it must not host a second source
selector.

### 9. Dependent payload editors appear once

Overview owns the complete Travel/Gold source-intent and dependent reward
authoring surface. The Room Action row owns participation, position, and a
read-only source/outcome summary. It does not duplicate reward, trait, Pom, or
disposition editors.

The existing caller-supplied `sourceOfferKey` command path must be retired once
source intent is persisted. Derived-entry payload commands resolve their exact
source from authored intent plus the engine-owned authoring domain; callers may
not submit a contradictory source coordinate.

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

## User-Facing Composition

### Standard, Shop, Fields, and N occurrences

`Room Overview` contains only sections that exist:

- read-only room and incoming reward context;
- meaningful room-specific setup;
- Shop inventory, purchase markers, conditions, and Travel/Gold intent;
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

Start Cage 1 encounter
  Encounter: <exact Cage 1 picker>
  Complete Cage 1
End Cage 1 encounter
  Cage 1 reward / NPC / optional pickups when ordered here

Start Cage 2 encounter
  ...

Outgoing generation
Cleanup
Exit usable
```

The illustration is not a hardcoded three-cage layout. Application assembly
uses the declaration-owned active phase envelope, and inactive retained state
remains repairable.

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
  Exit usable
```

The final active phase owns outgoing generation. Two-phase ShipCombat places it
after Combat 1; three-phase ShipCombat places it after Combat 2.

## Ownership by Lane

### Planner Engine

Owns:

- schema-49 Shop source intent and strict codec;
- structural commands for source intent and Shop purchase participation;
- semantic lifecycle-boundary/timeline product;
- exact H/O phase placement and inactive-row preservation;
- Travel/Gold source-intent domains;
- actual trigger derivation from canonical Room Action order;
- cross-intent and intent-versus-chronology findings; and
- derived-entry payload authoring from persisted source intent.

It does not return tabs, UI labels, React components, or callbacks.

### Planner Application

Owns:

- adapting the engine timeline into Overview/Action/Doors workspace products;
- joining exact encounter, wheel, reward, feature, purchase, and source-intent
  interactions to their semantic positions;
- closed semantic-owner-to-tab focus routing;
- binding purchase markers and source selectors to complete engine intents; and
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
- Standard, encounterless, Shop, Fields, and Ship timeline composition;
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
3. H optionals can remain before Cage 1, between cages, or after the last cage;
   cage reward/NPC dependencies and exit barrier remain exact.
4. Passive Gorgon contact remains visible and correctly placed.
5. O two-phase and three-phase tabs place encounter, wheel editor, wheel choice,
   pickup, outgoing generation, and exit boundaries exactly once.
6. O 3-to-2 retains inactive Combat 2 rows in one repair surface and restores
   them unchanged on 2-to-3.
7. A finding opens the exact Overview, phase Action, inactive repair, or Doors
   tab without changing authored history.
8. N side-room generation and visit ordering remain under the parent main-room
   Overview, while each entered side occurrence owns only its own
   Overview/Actions/Doors tabs.

### Gate B — Shop participation and source intent

Intended commit:

```text
feat(planner): author shop participation and effect targets
```

Deliver:

- strict schema 49 and exact codec/default updates;
- retained Travel/Gold source intent on materialized Shop state;
- engine-owned Purchased toggle intents that write only `roomActions.order`;
- Overview purchase markers and source selectors;
- Actions filtered to participating base purchases plus active/stale/required
  supplemental work;
- intent-aware derived payload authoring;
- canonical intent-versus-order validation and findings;
- exact navigation/undo/redo; and
- deletion of placeholder-only activation UX and caller-supplied derived source
  coordinates.

Primary owners:

- authored Shop model/codec/command tests;
- Shop reward-processing and Room Action tests;
- Travel Deal/Gold/Contract source audit fixtures;
- candidate-domain and finding tests;
- structured-workspace binding/assembly tests;
- Shop React tests; and
- one complete World Shop product loop.

Acceptance witnesses:

1. Marking two offers Purchased adds only those two purchase actions; unmarked
   inventory stays out of Actions.
2. Unmarking a target source removes its purchase action but retains Travel or
   Gold intent/payload with an exact finding.
3. Travel intent matches the first accepted normal purchase and rejects a later
   target without reordering it.
4. Gold skips `SpellDrop` without consuming its source opportunity and accepts
   the next eligible purchased source.
5. Travel may target `SpellDrop` while Gold targets a later eligible source.
6. When Travel's target is Gold-eligible, a different Gold target produces a
   cross-intent/chronology finding.
7. Gold may target the Travel refill only after that refill has exact authored
   source detail and chronology places it before another eligible Gold source.
8. Infernal Contract neither satisfies Travel nor becomes a Gold source.
9. Acquiring Travel Deal in the same Shop does not retroactively expose a
   target control or refill.
10. Upstream removal and restoration of Travel/Gold retains dormant intent and
    payload.
11. Source and payload editors appear once in Overview; Actions carries only
    participation/order and a read-only summary.
12. One semantic edit creates one undo step, and undo/redo restores membership,
    target intent, payload, and finding focus coherently.

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
- record the schema and completed delivery in `IMPLEMENTATION_PROGRESS.md`;
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
- Travel/Gold placeholder copy whose only repair is “order purchases first”;
- caller-supplied `sourceOfferKey` on derived Shop payload edits after source
  intent becomes persisted authority;
- duplicate Travel/Gold editors on both Overview and Action rows; and
- finding navigation that opens only the containing occurrence without the
  exact tab/phase destination.

Do not retain a compatibility projection, hidden legacy workbench, or schema-48
decoder after the schema-49 cutover.

## Explicit Non-Goals

- Implementing Wells of Charon or Shrines of Hermes.
- Modeling prices, affordability, rerolls, discounts, delivery delay choice,
  rush, or pending SpellDrop.
- Changing reward identity, trait, Pom, Artificer, Time Piece, Contract, or
  Echo settlement rules beyond the source-intent contact described here.
- Persisting UI tabs, expansions, scroll positions, or timeline labels.
- Persisting fixed lifecycle events or encounter selection as Room Actions.
- Auto-reordering purchases to satisfy Travel or Gold intent.
- Auto-rewriting intent to match the current order.
- Creating a generic lifecycle scripting language, effect registry, or React
  policy switch on biome names.
- Reopening N Hub generation or visit chronology.
- Moving incoming room or reward identity out of the predecessor-owned door
  contract.

## Adversarial Review Targets

Before locking implementation, challenge at least these risks:

1. Does the proposed engine timeline represent before-combat, encounter-end,
   outgoing-generation, post-outgoing cleanup, and exit usability without
   duplicating lifecycle execution?
2. Can H optional actions be partitioned visually without inventing phase
   windows or losing passive Gorgon contacts?
3. Does O retain one global order while phase tabs render each active or stale
   row exactly once?
4. Can Room Doors move into a tab without breaking provisional first-edit,
   unselected target repair, additional exits, terminal stages, or semantic
   focus?
5. Is appending a newly marked purchase always a truthful default, including
   Travel/Gold/Contract and retained stale rows?
6. Is `ShopState` the correct persisted owner for supplemental source intent,
   or should the exact acquisition site own it without introducing a generic
   envelope?
7. Can target-driven payload authoring remain branch-exact without an
   existential candidate union or fabricated chronology?
8. Does Gold targeting Travel preserve the source order in which Travel is
   generated, acquired, and only then duplicated?
9. Are active-at-entry trait facts used consistently so a same-Shop trait
   acquisition cannot retroactively activate an effect?
10. Do retained-invalid target and payload values remain visible and navigable
    after upstream changes?
11. Does tab routing stay application-owned and transient without making React
    infer semantic ownership?
12. Do future Well/Shrine contacts fit the lifecycle product without adding
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
