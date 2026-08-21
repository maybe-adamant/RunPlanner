# Structured Editor Workspace

## Status

This is ratified Phase 7 presentation authority.

## Purpose

This document defines the Phase 7 presentation structure for route and biome
authoring. It combines the existing contextual-editor contracts with a more
legible structured workspace without changing the authored-project model,
simulation, validation, semantic commands, or persistence.

This document owns:

- route, biome-structure, and inspector composition;
- shared ordinary-decision and Hub workspace presentation;
- picked-path and unpicked-offer visual hierarchy;
- progressive coverage and finding placement;
- empty-biome outlines;
- prompt-free removal editing, repair presentation, accessibility, and
  responsive behavior.

[`CONTEXTUAL_EDITOR_UX.md`](CONTEXTUAL_EDITOR_UX.md) owns contextual room and
reward selector behavior. [`EDITOR_MODEL.md`](EDITOR_MODEL.md) owns the broader
projection, navigation, command, finding, and persistence boundaries.

## Product Goal

The editor should present a biome as a game-structured route rather than a
database form. A user should be able to see:

- where they are in the route and biome;
- which authored decisions form the picked continuation;
- which generated offers are unpicked leaves;
- how far progressive evaluation has reached;
- where the first blocking or invalid owner is;
- which semantic owner is currently being edited;
- what remains structurally possible without inventing future game facts.

The workspace is a projection and command surface. It never becomes a second
serialized topology.

## Preserved Contracts

- Authored topology and Room Occurrences remain the only topology authority.
- Any non-complete-valid biome remains an authored-topology projection with
  only its reached assessment prefix overlaid. A complete-invalid biome does
  not publish canonical topology merely because authorship is complete.
- Only a complete-valid biome publishes canonical products and seeds the next
  route biome.
- UI destinations use occurrence IDs and semantic addresses, never rendered
  indexes.
- Context-invalid authored values remain visible until explicitly replaced or
  removed by an owning structural command.
- React implements no eligibility, force, reward-store, bag, sibling,
  Preboss-handoff, or route-gating rule.
- One visible user intent dispatches one semantic command and creates one undo
  entry.
- Focus, expansion, search, disclosure, and viewport state remain transient
  UI-session state.
- The simulator models possibility, not probability. The workspace does not
  display likelihood or an expected route length.

## Desktop Composition

The primary authoring surface uses three conceptual regions:

```text
+----------------+-----------------------------+---------------------------+
| Route rail     | Route structure             | Details                   |
|                |                             |                           |
| route status   | door choices / Hub          | selected decision, room,  |
| biome status   | decision labels / status    | reward, finding, or       |
| navigation     | next step                   | repair surface            |
+----------------+-----------------------------+---------------------------+
```

These are presentation regions, not persisted panels. The exact responsive
composition may become two columns, stacked regions, or an inspector drawer at
narrow widths.

### Desktop Sizing and Scroll Ownership

At desktop widths, the application shell occupies one viewport and gives the
editor all height remaining below the compact project header and route tabs.
The document itself is not a vertical scrollport. The route rail, Route
structure, Details region, and bounded findings list own overflow at their
respective presentation boundaries, so scrolling one never moves the others.
The desktop shell uses the available widescreen width rather than constraining
the authoring surface to a narrow content column. A short structure rail does
not advertise overflow merely because its connector decoration extends beyond
a terminal stop.

The route overview remains ordinary editor-panel content and may use that
panel's scroll container. At narrow widths the layout intentionally returns to
one document-flow column rather than retaining nested scrollports. These are
CSS presentation boundaries only: scroll position remains transient and no
layout state enters the authored project or semantic commands.

The existing horizontal route tabs remain the top-level route/Settings
navigation. The route rail is the selected route's local overview and biome
navigation, not a competing second route selector.

### Route Rail

The route rail projects the normalized catalog route order and current project
evaluation. It shows route settings, each configured biome, its status, and
whether contextual evaluation is active, complete, or blocked by an earlier
biome.

Selecting a biome changes UI-session navigation only. A downstream biome remains
editable when blocked, but its contextual state remains unassessed.

### Biome Structure

Every configured biome renders through one `BiomeWorkspace` composition over a
`WorkspaceBiome` projection. Its exhaustive workspace-node union retains
ordinary decisions, takeover and mixed Preboss batches, completion,
occurrence-local workbenches, and the Hub decision without React inspecting
authored topology. N's exact terminal decision carries a projected generic
Door 1 room picker whose sole candidate is Hub rather than another node family.
The projected rail
deliberately exposes only player-facing biome stages and decision points;
exhaustive node ownership does not imply one rail stop per node.
`HubDecisionWorkbench` is the one N-specific workbench and is nested inside
that shared workspace; it does not create a second editor surface.

The rail is a selective decision-highlight and navigation projection, not
workspace authority. Omitting a semantic owner from the rail changes neither
its authored data nor its workspace node, findings, contextual controls, focus
destination, or editability. Room rewards, encounter phases, and any future
features, items, or other room-local products remain available through the containing
decision or fixed-stage inspector unless a separate player-facing navigation
need justifies another rail highlight.

### Run State Join and Lifecycle Placement

The workspace joins each engine-published Run State snapshot to its exact
semantic owner. A structurally eligible owner projects one
launcher: an available launcher binds that exact snapshot, while an unreached
launcher carries the engine coverage reason and binds no invented state.
Presentation owns structural titles, catalog-backed labels, section ordering,
and compact requirement copy; it does not evaluate requirements, fold traits,
derive bags, or infer availability.
Equipped and banned trait labels come from the same engine snapshot. Forfeit's
inactive, available, or consumed state is likewise passed through from the
progressive Arcana/Fear ledger; the workspace does not infer it from the route
loadout or room list. Keepsake presentation joins the exact engine history to
catalog labels as a biome-by-biome chronology; React does not reconstruct that
sequence from current and removed inventories.

Run State remains available through the covered lifecycle checkpoint that
precedes or contains the first blocking value and unavailable afterward. The
workspace consumes that engine-published coverage directly; it does not apply
a second canonical or finding-order clamp.

Only two decision-generation launchers remain public: the `HubDecisionAddress`
before the Hub board is generated and the Hub-sourced `ExitDecisionAddress`
before Preboss generation. Ordinary occurrence-sourced decisions do not retain
a `beforeTargetGeneration` launcher on their door cards. Room-local lifecycle
launchers keep their exact engine owners while the application projects one
consistent utility slot at the top of each tab panel. Ordinary/H/Shop Overview
and Timeline reuse the same Room-entered launcher. O Overview and Intro Timeline
reuse Intro's pre-start launcher, while each later phase tab uses that phase's
pre-start launcher. Room Doors uses the literal pre-exit launcher. Inactive
Actions is a repair surface and owns no lifecycle launcher. An unavailable
retained checkpoint stays visible and disabled; an occurrence absent from the
materialized prefix owns no launcher. The workspace-level launcher index
resolves the sheet without React scanning nested workbenches or reconstructing
history.

N has an explicit two-layer presentation:
its outer chronology is Opening -> PreHub -> Hub -> Preboss, while Hub visits,
slots, side-room occurrences, and restores are inner chronology. Opening
remains a fixed stage. Entered N occurrences use the same room-entry and
pre-exit lifecycle launchers as other ordinary rooms. The Hub launcher is owned
by the Hub decision before board generation, and the visible completed-Hub
handoff owns the retained generation diagnostic before Preboss. React consumes
these projected owners and never distinguishes them from room names or rendered
nesting.

The center region does not attempt to make ordinary decision topology and the
Hub board look structurally identical. It does give both the same route rail,
semantic focus, finding navigation, coverage, and focused-inspector language.

### Focused Inspector

The inspector renders the occurrence stage or exact structural workbench
containing the focused semantic owner. An ordinary decision remains the
outgoing-door section of its source occurrence and includes its batch policy
and every physical offer's picked state, room selector, and reward controls.
Before a decision has one selected continuation, its numbered rail stop opens
that decision surface. Once exactly one target is selected, the same stop opens
the selected target occurrence stage; the predecessor stage still owns and
renders the outgoing door editor. Exact target, door-reward, and finding focus
continues to open the semantic control that owns the value. Fixed entries and N
visit-local details retain occurrence workbenches where they are player-facing
stages or subordinate Hub navigation.

Finding navigation selects the owning route and biome, focuses the semantic
owner, and brings its inspector surface into view. The inspector never searches
for a rendered room label or decision number.

### Encounter Phase Products

Each structurally active pool-backed encounter phase is a first-class
workspace owner. Its exact `EncounterPhaseAddress` resolves to the containing
occurrence inspector, one marker, one focus destination, and—if
the declared set has meaningful choice cardinality—one bound selection
interaction. The projector consumes the engine's context-free
`EncounterPhaseAuthoringDomain`, whose activation comes from catalog,
persisted selection, and template-controlled authored facts. The engine's exact
sequence status suppresses only a validly terminated dormant suffix. Reached
candidate support decorates the remaining product; its absence leaves an active
control unassessed and does not decide whether that control exists. The
projector never derives phase activity from a rendered ordinal or finding.

The workspace publishes active phases even behind an invalid evaluated prefix,
so their retained selections remain editable; only the blocking phase is
assessed until repair restores an exact later checkpoint. A dormant potential
phase retains its persisted selection but has no live interaction, marker,
finding, or route-NPC index entry. Singleton phases preserve their exact
semantic destination without producing no-op controls. This gives finding
navigation and closure the same phase identity regardless of whether the
presentation has a visible picker.

### Lifecycle Occurrence Workbenches

The application publishes one closed occurrence-presentation union rather than
a generic room-details disclosure. Standard, Fields, and Shop occurrences
render Room Overview, Room Timeline, and Room Doors. Overview contains read-only
incoming context and meaningful room-local setup: optional N Side rooms,
Fields identities, Shop inventory and Purchased markers, and Room features.
Actions consumes the engine lifecycle timeline plus the one occurrence-owned
chronology. Doors consumes the unchanged total outgoing-stage product. A
section is omitted when its projected product is empty.

Required chronology rows arrive ranked from the activating semantic command
and expose only engine-assessed moves. React renders no Position or generic
Remove control for them. A retained malformed omission is the exception: its
unranked required row exposes exactly one canonical restore intent supplied by
the engine. The application binds that intent without selecting an insertion
rank, while optional membership and stale removal remain on their established
paths.

Manual tab selection is transient and defaults to Overview for a newly focused
occurrence. Exact semantic focus overrides it: setup and purchase markers open
Overview, active encounter/action owners open the matching Actions tab,
inactive Ship actions open repair, and outgoing owners open Room Doors. The
application publishes that closed destination; React does not parse addresses
or labels. Tabs use one stable tabpanel identity and roving ArrowLeft,
ArrowRight, Home, and End keyboard activation.

The occurrence header presents only the compact `Entering <room>` identity plus
cross-tab markers or controls. Room Overview consumes the exact predecessor
door preview and renders one compact read-only incoming-reward fact: its
visible summary, `Hidden`, or `None`. React does not rediscover an offer from
room-local state or expose an incoming-reward editor there. A Room-features
child renders its bound Add or Remove Chaos-gate/Zagreus-contract action
directly, without a second child heading that repeats the action's subject.

ShipCombat is the deliberate fourth shape. It renders Room Overview, Intro
Timeline, Combat 1 Timeline, structurally active Combat 2 Timeline, and Room
Doors. Overview owns encounter count and room features. Each phase tab contains
its projected encounter control at Start encounter, its post-combat actions,
and the declaration-attached wheel editor at the following `nextPhase`
boundary. Wheel 1's structural editor therefore appears under Intro, Wheel 2's
under Combat 1 when active, and final Combat 2 has no following wheel editor.
Choose and post-combat pickup actions do not move with that structural editor.
The groups are views over one interaction and one authored order: global ranks,
proposals, pointer drag, keyboard moves, and Undo are unchanged. The application
consumes engine-owned timeline action keys and phase attachments; React does
not derive lifecycle barriers or create another order. An action retained from
a now-inactive Ship phase is excluded from those active groups and rendered
exactly once in the Ship repair surface, preserving its finding, semantic
focus, and explicit removal proposal.

Room features is a closed application product containing the currently
supported Chaos-gate and Zagreus-contract Add/Remove controls. The resulting
exit card owns only decision selection, room navigation, and its remaining
door-specific identity controls; Anomaly identity/revert remains on its door.
Incoming room identity and door-visible reward are read-only context in an
entered occurrence; their editor remains the predecessor's outgoing door.

### Fields and Artificer Products

A Fields occurrence workbench projects one optional-count control, one active
inventory row per spawned optional, and one engine-owned mixed chronology.
Inventory rows own reward payload and acquisition disposition. Optional
interaction checkboxes are derived from chronology membership; the chronology
owns all completion, interaction, movement, and source-before-replacement
constraints. Dormant optional values and inactive cage payloads retain authored
state but publish no control, marker, or finding destination. A retained
inactive chronology action alone remains visible as its explicit removal
repair.

Every reached acquisition role reuses the shared disposition control for
ordinary acquisition, Time Piece, and supported Artificer. Selecting Artificer
publishes the complete replacement reward editor at its exact generated-
acquisition owner. Ordered sites expose its later pickup through their existing
chronology. When that pickup is required, the activating command inserts its
action reference in the sole persisted order and the workbench renders one
move-only action card with no generic Remove or Position control; an optional
replacement retains its explicit participation path. The action card contains
the owner-bound editor rather than duplicating it elsewhere. React renders the
engine's support, replacement domain, and complete command intents and does not
evaluate eligibility or bag state.

The control presents those authored choices as reward outcomes rather than
exposing internal role vocabulary. An automatic Forfeit veto is not added to
the authored disposition union: the engine records it in the same reward-event
stream as the other acquisition outcomes, the workspace marks the exact reward
control, and React replaces dormant acquisition children with a read-only
`Removed by Vow of Forfeit` status. Retained authored children remain in the
document and reappear if an upstream edit makes the veto no longer apply.

### Keepsake Products

Route Settings projects the mandatory starting selection, and each reached
nonfinal Postboss completion projects its retain-or-replace selection. Immediate
Jeweled Pom and Experimental Hammer results appear beneath that exact selection.
Calling Card actions remain on trait-offer rows, Time Piece conversions remain
on acquisition roles, and Fig Leaf plus Gorgon controls remain on exact
encounter phases. Each reached product has one bound interaction, finding
destination, and containing inspector; dormant detail publishes none. React
renders those products without switching on keepsake keys to decide legality.
Reached Gorgon offers display their encounter-snapshotted rarity read-only and
dispatch only the persisted Athena identities and selection. Cherished Heirloom
uses the ordinary trait-offer control; it adds no action button or keepsake-rank
control.

Gift Gift Gift's captured identity and replay status are Run State facts, not a
rack editor. The only authored replay child is a reached Experimental Hammer
result at the succeeding biome-start owner. It reuses the shared keepsake-equip
result interaction and is contained by that biome's entry inspector; a dormant
future result publishes no marker, interaction, or finding destination.

## Application Projection Boundary

The application projects a structured workspace from:

```text
authored topology
  + normalized layout
  + room declarations
  + progressive or canonical biome evaluation
  + addressed findings and contextual options
  -> WorkspaceBiome structured workspace view
```

The projection owns visual grouping, ordering, compact summaries, coverage
markers, Preboss and completion-outline facts, and semantic focus destinations.
React renders that projection and dispatches semantic commands.

### Public Workspace Entry

Application composition and React consume the structured workspace only through
the `projections/structured-workspace` public entry. Its exported vocabulary,
service, and deliberate interaction helpers are the stable projection contract.
Independent closure helpers are test support, not a production public seam.
Contract declarations and projector assembly are private modules: the projector
may consume the contract, but neither module may depend on the public entry or
become an alternate consumer import path. This keeps workspace construction
replaceable without making React or application composition depend on its
internal assembly order.

### Internal Projection Production Line

The private workspace implementation preserves one directed production line:

```text
WorkspaceBiomeSource
  -> WorkspaceBiomeSemanticAssembly
       ├-> biome presentation (rail, default inspector, exact destinations)
       └-> project-wide interaction binding
biome presentation + evaluated findings
  -> exact finding routing
semantic assembly + presentation + exact finding routing + bound interactions
  -> cached structured-workspace service (with local construction invariants)

test support: catalog + persisted authored state
  -> independent expected owners, leaves, and structural controls
production workspace products + expectations
  -> test-time closure
```

The semantic assembly owns complete biome facts: authored structural nodes,
room-local products, controls, preliminary destinations, and interaction
requirements. Biome presentation and interaction binding are sibling consumers
of that immutable product. Presentation may also read immutable catalog display
metadata for an already-resolved reward token; it never revisits authored source
or interaction binding. Presentation owns the selective rail, Hub visit
grouping, default inspector, and final inspector/rail destinations; interaction
binding owns executable command adapters and does not consume presentation.
For the policy-bearing families it binds, it returns complete command intents;
the shared React adapter dispatches only that intent and, when declared, its
focus timing. React does not allocate occurrence identities or reconstruct
creation focus. Simple declaration-projected fields and intentionally retained fixed
owner-plus-value controls remain direct semantic mappings rather than being
wrapped merely for uniformity. `WorkspaceBiome` carries its typed biome owner
only because React needs it to scope global semantic focus; generic markers do
not become a route back to typed control owners.
Independently derived authored-owner expectations live in test support and
derive identity and visibility from catalog plus persisted state without
importing assembly, marker ownership, presentation, binding, or facade
products. The cached service composes the returned products, project and route
markers, legitimate coarse finding fallbacks, and the final immutable workspace;
it does not construct occurrence, decision, Hub, rail, or test-closure
families itself.

Creation establishes explicit transient semantic focus through the existing
semantic-owner action. Every authored start selects its created Room Occurrence.
An ordinary target selects its target owner while remaining in the owning
decision workbench. The direct predecessor of a generated continuation exposes
the ordinary empty door workbench inline. That workbench is a pure projection,
not an authored node. Its first reward-pool, Fields, ordinary-room, or takeover
edit is already bound to one atomic engine command; React never chains
structural creation with a second edit. Focus resolves through the source room
stage, and undo restores the provisional workbench directly.

An empty generated decision publishes one Door 1 room control inside its own
workbench. The control is target-addressed, but its picker can contain both
target-owned ordinary candidates and decision-owned takeover Preboss evidence.
Binding returns the chosen complete atomic initialization or takeover-creation
intent lazily, allocating occurrence IDs only on activation. Once an authored
empty envelope exists, the same control returns the ordinary target or takeover
replacement intent. Both the target route and the decision-owned takeover route
resolve independently to the same containing decision inspector. Later doors
remain ordinary sequential target controls; a populated ordinary decision
never publishes a retroactive takeover control.

The rail may retain a truthful continuation marker without stealing inspector
focus, but generated continuation has no navigation-only `Go to next step`
action or separate `Add Preboss doors` control. A completed-Hub handoff and
repair of an already-authored takeover remain distinct declared interactions.

Every non-complete-valid biome is an authored-topology projection, optionally
enriched by reached progressive evaluation when coverage exists. It must not
be described as canonical topology.

### Authored-First Assembly

Persisted authored topology determines workspace membership and order.
Evaluation is an optional overlay indexed by semantic owner; it may add
assessment, availability, Goal state, simulated entry, and derived lifecycle
facts. Evaluation must not create, remove, or replace a persisted decision,
target, occurrence, or editable offer-time leaf.

`WorkspaceBiomeSource` acquires the context-free completeness product once for
semantic and interaction assembly. For a blocked result it builds evaluated
overlays from the clamped assessment prefix, never from the larger retained
authored materialization. The full document remains the source of downstream
decisions and controls. Those retained owners stay editable and unassessed;
they receive no canonical entered state, evaluator-derived physical-state
overlay, Clockwork reward, or room-local evaluation fact. Declaration-derived
physical exits and authored activation still keep their controls usable.

The projector walks the authored start and then authored exit decisions or the
Hub in selected-topology order. A selected target subtree precedes retained
physical peers. Peers follow the current physical-exit order with a stable
semantic tie-breaker. Disconnected or malformed but structurally representable
state remains reachable through the same deterministic ordering; the codec and
semantic commands, not projection, remain responsible for structural validity.
Simulation order never substitutes for authored topology order.

The physical exits for a decision are those resolved from its current authored
batch and layout state. A current exit without an authored target is projected
as a missing offer. A retained authored target outside that current set remains
visible as an unavailable offer; projection does not discard it or promise
blank rows for merely potential or policy-gated exits.

Room-local activation follows the hierarchy and source rules in
[`EDITOR_MODEL.md`](EDITOR_MODEL.md#decision-and-room-data-hierarchy).
Mandatory room and reward leaves do not depend on activation, findings,
candidate support, or evaluation coverage. Optional picked-room details may
depend on authored `detailsActive`, while evaluated `entered` remains a
separate fact.

Occurrence assembly consumes narrow authored activation facts.
`FieldsBatchFacts` is one shared engine-derived input for both occurrence and
decision assembly, rather than a room-local lifecycle table or duplicated
calculation. Persisted room-state schema coherence belongs to engine codec,
default, and semantic-command boundaries; the workspace projector deliberately
does not preflight a complete document. It retains only exact declaration and
product-contact assertions needed to publish a concrete control, including
dormant optional detail.

### Projection Integrity and Independent Test Closure

Production enforces invariants where products are constructed: exact
project/evaluation provenance, declaration lookup, impossible evaluated-overlay
rejection, duplicate semantic-key rejection, and required exact lookups. A
live finding must publish an exact owner destination; a coarse finding may
inherit its biome shell, while a fine-grained finding must resolve to an
existing exact inspector subject and may not be converted into a default-
inspector or biome-shell fallback. These are local production contracts, not a
second traversal that reconstructs an expected workspace after the product is
built.

Test support independently enumerates the semantic owners, declaration-required
editable leaves, and structural controls implied by catalog plus persisted
authored state. It verifies that:

- every decision, target, occurrence, Hub slot/visit, and active
  declaration-owned leaf has one reachable projection;
- every exact semantic address resolves to its containing inspector, marker,
  and exact interaction;
- advertised structural controls and frontier capabilities have the expected
  kind, key, owner, and bound interaction;
- fine-grained findings resolve to their exact owner rather than a biome-level
  fallback.

A target's room and reward may be nested inside its decision workbench. Test
closure therefore validates semantic-owner reachability, not a count or shape
of standalone UI nodes. Candidate support and findings decorate reachable
controls; they never decide whether a mandatory authored control exists. React
renders projected facts and does not recreate topology, containment, lifecycle,
or interaction policy.

## Ordinary Decision Workspace

For F/G/H/I/O/P/Q, the center region presents a concise decision-point rail:

- the authored start or fixed entries;
- each generated decision as exactly one labeled stop;
- the active continuation frontier;
- retained downstream structure after an invalid upstream edit;
- a layout-owned Preboss stage where it is distinct from an ordinary decision;
- completion rooms as a separate derived, read-only outline.

The rail is not a freeform graph. Its visual position is derived from semantic
topology and never persisted.

### Empty Decision Entry

Both a persisted empty decision and an uncommitted exit frontier use the same
decision workbench, not an intermediate mode card. The frontier version is
projected only; it has no removal action and is replaced in place by the
authored workbench after its first atomic edit. Because its empty target list
has nothing to choose, it also publishes no exit-selection interaction. Both
show declared batch setup
when present, the Door 1 Room picker, and later physical doors waiting for
sequential generation. A required reward pool
or Fields roll can disable ordinary mutation locally, but it cannot hide a
supported takeover option in that same Door 1 picker. Selecting an ordinary
room reveals its mandatory room/reward leaves; selecting the required Hub
candidate replaces the envelope atomically with the persistent Hub decision.
Selecting another supported takeover replaces the envelope atomically with the
declaration's Shop/free-offer shape. Findings
decorate those controls and never decide whether the structural control is
projected.

### Decision Offers and Picked State

Selecting a decision shows all of its physical offers together. Every authored
offer keeps its room selector and reward editor at the same visual level,
because the room and incoming reward jointly describe the offered door.
The door contract keeps game preview visibility separate from planner
authorship. An Anomaly or Zagreus automatic return remains hidden in game, but
its freshly generated host reward still consumes the ordinary reward store and
therefore retains its reward editor and finding destination in the decision.
Single-choice controls live on those cards, and the picked card receives the
strongest emphasis because it is the authored selected route. Evaluated entry
is shown separately when materialization has actually reached that room.
For an authored RunProgress/MetaProgress decision, the batch control is labeled
as the base reward pool. When a declaration-owned forced room changes the
evaluated final shared pool, the decision also presents that effective pool and
briefly identifies the forced-room override; React does not derive the result.

Unpicked targets remain fully visible in the decision workbench because they
still affect reward bags, sibling conflicts, source support, and possibility
evaluation. They do not become equal-weight stops on the biome rail. A numbered
decision stop always shows its decision identity and semantic assessment. When
exactly one target is authored as selected, it navigates to that continuation's
occurrence stage and may progressively add that room label; if its room-local
surface has exactly one direct compact reward, it may add a structured reward
token. The selected room remains useful context when the reward surface is
multiple or not compactly representable, so room and reward cardinality are
deliberately independent. Findings, evaluated entry, and physical availability
never suppress this authored-selection context.

The rail product retains the resolved reward offer plus its current text
fallback. React currently renders the fallback, while a later compact icon or
token renderer can consume the same structured offer without recreating reward
or selection policy. Fields, Ship, and Shop surfaces do not infer a token by
counting nested controls. Ephyra opts in only through its explicit incoming
main reward; its side-room offers never become an aggregate rail token. Target,
occurrence, reward, and finding focus continue to resolve to the exact control
inside the decision.

Picked and unpicked targets use the same occurrence identity and semantic
addresses. Visual grouping does not change ownership.

The projection publishes one closed selected-continuation navigation product
when exactly one normal, Chaos, Zagreus, or Preboss occurrence continuation is
selected. It contains the occurrence-owned door and room marker only; it does
not include Hub interactions or UI labels. The decision footer consumes that
same product through one `Open next room` action immediately before
`Remove these doors`. The action remains disabled until the product exists,
then focuses the selected occurrence's Room Overview without creating authored
history. Individual decision cards do not publish room-opening actions.

The one-stop-per-decision rule applies only to rail presentation. It does not
collapse, delete, or coarsen the decision's target, occurrence, reward,
room-local, or finding products.

### Variant-Owned Structure

- F/G/P use the same Door 1 flow for ordinary rooms and their required atomic
  normal-door takeover at the declaration-admitted terminal source. N uses the
  same flow for its required Hub candidate after PreHub or selected natural
  Chaos.
- H retains four realized Fields decisions; its fifth empty decision can only
  resolve to the required takeover, even if its ordinary Fields setup is still
  unresolved.
- I's Preboss remains a generated ordinary peer after Goal completion; it has
  no over-bound terminal envelope and closes the biome only when picked.
- O and Q each add a terminal empty decision after their six ordinary units;
  only the declaration-fixed width-one Preboss is authorable there. The
  ordinary declaration domain may remain visible as disabled options rather
  than being hidden by terminal invalidity.

The shared rail and inspector share a direct room-choice surface, not a
universal ownership model or a separate Preboss action.

## Hub Decision Workspace

N uses the same route rail, inspector, semantic focus, finding, and coverage
language, but its center is not an ordinary decision spine. The
`HubDecisionWorkbench` projects:

- fixed Opening and PreHub entries;
- the persistent board over 26 declaration-fixed Hub slots, with nine or ten
  open members;
- one complete room and incoming reward for each open slot;
- Hub Overview for the complete fixed-slot set, open/closed membership, and
  each open room's reward editor; Hub Timeline for the exact dense authored
  visit prefix (through six positions), compact next-position target for every
  remaining visit owner, presentation-only unvisited tail, and read-only
  reward context; and Hub Exit for the existing completed-Hub handoff;
- side-room generation and entry state under visited parents;
- derived Hub returns and parent restores;
- the fixed completed-Hub handoff to the width-one Preboss Shop and its derived
  completion sequence.

Exact Hub inspector destinations also carry their presentation tab: Hub,
slot-set, and board-reward owners open Overview; visit owners open Timeline;
and the uncommitted completed-Hub handoff opens Exit. React consumes that
explicit destination and does not infer tab ownership from semantic-address
shapes.

The board remains a joint generation region. Its authored prefix is the only
traversal order; its unvisited tail is React-local presentation state and is
not persisted, evaluated, or placed in Undo history. A visible boundary keeps
that distinction explicit. Open-set membership and visit order remain separate
semantic controls.

One Hub-decision-owned interaction supplies complete visit-prefix proposals.
It never replaces the exact `HubVisitAddress` markers, inspector destinations,
or positional assessment products: those remain reachable for both authored
and unplanned visit positions. Tail-only moves are presentation changes;
any prefix change dispatches one aggregate semantic command after the bound
candidate interaction has evaluated the complete proposed prefix.

Hub Overview renders all 26 fixed slots in declaration order so membership
changes never move a card. An open card exposes the existing main-reward
editor; a closed card reserves the same reward region with an instruction to
open the room, preventing row-height shifts when participation changes. Hub
Timeline renders only open slots as a ranked roster with read-only reward
summaries. A visible pointer drag grip is an optional direct-manipulation
surface, with named arrow controls retained for keyboard operation.

The N rail gives its fixed Opening and PreHub stages and each authored Hub
visit one read-only primary-reward token when the room projects one. This is
the same resolved token product used by ordinary selected-room context: fixed,
incoming, and Ephyra incoming rewards are eligible, while side-room offers are
not. The token neither changes focus nor creates another edit path; the Hub
board remains the sole editable main-reward surface.

Compact board cells may focus their room and reward state in the inspector, but
N never acquires arbitrary room replacement merely to reuse an ordinary room
picker. Membership, visits, and the completed-Hub handoff remain Hub-owned
semantic interactions.

Hub membership changes are batch composition rather than navigation. Their
bound `OpenHubSlot` and `CloseHubSlot` intents have no semantic-focus product:
opening or closing a room must not select the moved slot or jump the inspector
to its room configuration. Pointer and touch changes preserve the current
viewport. Keyboard changes use transient React-local continuity to move to the
nearest enabled membership control in the source region (then its documented
local fallback), never the card that just moved. This focus continuity is not
persisted or stored in Redux. Explicit Room details, reward, and finding
actions continue to use their exact semantic owner destinations.

## Progressive Coverage and Findings

The workspace consumes the single atomic project evaluation:

- evaluated owners render their contextual support and findings;
- published coverage stops at the first blocking atomic region, whose co-owned
  findings and exact repair interaction remain navigable;
- the coverage frontier is visible at its semantic stop or Hub region;
- retained later authored owners remain editable but are marked unassessed;
- later findings and candidate context remain unavailable rather than leaking
  from the retained authored materialization;
- a downstream biome blocked by an earlier biome shows the upstream gate rather
  than fabricated local invalidity;
- invalidity propagates to biome, route, and project summaries without losing
  the exact semantic owner.

When an earlier reached value is invalid and authorship is also incomplete,
the invalid status takes precedence without hiding or moving the later
authored frontier.

Color is supplementary. Icons, labels, grouping, descriptions, and accessible
names carry the same state.

The default presentation uses compact owner markers and inspector detail rather
than repeating full inline error sentences beside every control.

## Empty and Future Outline

A configured biome with no authored topology should show its declared structure
and live authoring frontier rather than a blank form. This is a read-only outline,
not preallocated authored state.

The outline follows these rules:

- declared start, fixed entry, Preboss, Boss, and PostBoss roles may appear as
  concrete read-only landmarks;
- fixed-count layouts may show their exact remaining stage count;
- variable-length layouts may show only a simulation-provided completion
  horizon;
- when no truthful horizon exists, the UI says that the route length varies and
  does not invent an approximate count;
- I presents its eventual completion role without pretending that an independent
  Preboss slot is currently authorable;
- N presents an empty Hub board and visit structure, not a false ordinary rail;
- only the current semantic frontier is interactive.

Any completion-horizon or remaining-structure summary must reach the application
projection as a normalized layout fact or simulation result. Neither the
application presentation layer nor React interprets force or timing declarations
to calculate it.

## Contextual Controls

The inspector's decision offers and fixed-stage workbenches compose the shared
contextual controls from `CONTEXTUAL_EDITOR_UX.md`:

- grouped room selection for replaceable ordinary occurrences;
- required-first and unavailable disclosures;
- selected-invalid retention;
- producer-resolved reward domains;
- sibling, source, and counted-bag guidance;
- one compound reward interaction over a complete resolved offer.

The application owns picker grouping, ordering, and player-facing explanation
policy. React owns accessible interaction, search, disclosure, and incomplete
popover progress.

After `ReplaceOccurrenceRoom`, the workspace projects the one reconciled
authored snapshot. It does not retain or reset leaves by rendered position:
compatible values remain at their stable semantic owners, newly introduced
leaves show declaration defaults, and retained context-invalid values receive
ordinary finding presentation.

## Removal Actions and Repair

Commit 5a removes browser-native confirmation from the existing immediate
semantic-command paths without replacing it with an application dialog. Every
current in-project structural edit already has one semantic command and one
history entry; existing Undo/Redo remains its recovery mechanism. Controls
that remove existing authored structure use the red danger affordance only to
communicate that subtractive effect. They do not receive a different command,
history, confirmation, or recovery path. This follow-up does not add a generic
removal-action abstraction, completion status, or post-edit focus policy.

Retained-overflow and Preboss-handoff repairs remain explicit:

1. show unavailable retained targets at their semantic owner;
2. show which picked target or Preboss realization is no longer available;
3. let the user select a representable continuation;
4. expose the owning reconciliation command;
5. reconcile immediately when the user invokes that explicit action;
6. rely on the existing Undo/Redo history controls for recovery when needed.

Existing action labels invoke semantic commands; they do not calculate
deletion scope or repair the project themselves. Persistent deletion-scope
copy is intentionally absent from the editor until user research identifies a
specific action that needs it. Commit 5a does not add a command-specific
post-edit focus rule. The application-wide session liveness reconciliation may
clear a deleted finding or focus reference after a new workspace publication,
but never rehomes it or supplies command focus.

The authored-project core calculates the pure removal impact when it executes
the semantic command. The workspace exposes a complete removal or repair
command-intent capability with its declared before-focus behavior, not a
projected impact closure. Neither the projection nor React walks authored
descendants to infer deletion.

For a completed Hub, closing an unvisited slot that crosses the declared
open-set minimum includes both the detached slot subtree and the Hub-owned
completed-handoff subtree in that one engine-owned impact. The resulting board
remains visible as incomplete with its authored visits retained.

## Component Foundation

Use accessible primitives for popovers, radio groups, disclosures, status
announcements, and keyboard navigation. The contextual picker uses Radix
Popover plus `cmdk`, styled through the existing hand-written CSS. No
removal-confirmation dialog dependency is required for in-project editing.
Confirmation is reserved for a future operation that is both externally
consequential and not recoverable through project history. Tailwind adoption
and literal shadcn component copying are out of scope.

Dependency choice remains subordinate to the ownership contract. A component
library must not hide semantic commands, make caller-owned option models mutable,
or move presentation policy into generic wrappers.

## Acceptance

### Trait Offer Closure

Each active trait-bearing acquisition role is an expected workspace leaf with
one `TraitOfferAddress`, one containing inspector, one bound interaction, and
one exact finding destination. The occurrence assembler derives these leaves
from normalized acquisition roles; it does not switch on Hammer names or
reconstruct lifecycle order. Room, local, wheel, Devotion, and Shop
projections all reuse the same interaction package. A materialized Shop
publishes ordinary paid-purchase trait and Pom controls only from participating
`interactShopOffer` rows in Room Timeline. Unpurchased initial inventory exposes
only `Purchased` membership in Overview; it has no acquisition-child control,
finding, trait event, or equipped-state fold until its entry participates.
The inventory remains the only reward-identity editor. Once purchased, its
Room Timeline row exposes resolution children and chronology only; it cannot
turn the purchased Boon, Mystery Boon, Pom, or other item into another reward.

The same Room Timeline chronology contains declaration-produced pickups such as Narcissus
outputs. It derives entry labels, required/optional classification, lifecycle
windows, reward controls, and exact acquisition children from the engine
product, while exact membership and chronology come from the occurrence's sole
persisted order. Producer cards may expose the outer Story choice or Shop
inventory, but they do not duplicate pickup-owned reward, trait, or Pom
editors. A mandatory singleton renders one already-ranked, move-only action
card; a malformed omission renders its one canonical restore repair instead.

The same closure applies to Artificer replacement children. Every reached
replacement reward, trait offer, Pom resolution, disposition, and later pickup
has one containing inspector, bound interaction, and exact finding destination.
Not-yet-generated replacements and children beneath dormant optional or cage
state publish none. Fields chronology rows reference those shared reward
controls rather than duplicating their editors.

The shared trait editor is a projection over the engine's complete offer
assessment: one to three materialized trait options or mutually exclusive
Fallback Gold for exhausted Olympian/Hermes offers, and the existing fixed
three-option outcomes elsewhere. It dispatches complete semantic replacements
and selected-option commands; it never evaluates prerequisites, slots, rarity
counts, element thresholds, exhaustion fill, loadout compatibility, or
chronology. The route Traits panel is a second reference to those controls,
not a persisted route-wide model. Dialog target and focus restoration remain
transient editor-session state.

Each trait leaf binds one lazy focused-option domain factory. Its inputs are the
complete local offer draft and exact option key; its output is an
application-projected trait and rarity picker model. Workspace projection does
not traverse selected assessments to enrich replacement rarities and does not
evaluate candidate alternatives. One activated domain evaluates its complete
declaration-owned concrete variant batch through the project-bound candidate
session and caches it for the immutable workspace interaction identity.
The same interaction binds engine-owned starting- and next-draft capabilities
for returning from fallback and appending a position. Fallback owns no
option-local expected leaf, and removing a trailing row never creates a
placeholder owner.

A selected Circe effect option adds one exact resolution child beneath the
same trait leaf. The workspace publishes its value, exact marker and finding
destination, and a lazy engine-backed domain loader; it does not expose the
Arcana/Fear ledger. Red, Lapis, and Black Night differ only in the engine
domain product rendered by the shared trait surface. Switching a draft option
updates this child in the existing dialog, while dormant detail remains owned
by authored state. A reached Boss completion similarly publishes one exact
Judgment child control and interaction from its completion address, not a room
occurrence or route-settings substitute.

A selected Echo option follows the same active-child rule. Pom, Boon, and
Reward each publish one exact child in the containing trait inspector; Reward's
generated acquisition descendants route back to that same owner. A reached
Gold duplicate is the one exception to purchase-first child visibility: its
stable supplemental Shop row is the sole complete reward editor, including
boon, Pom, and Time Piece children, before `Picked up` is selected. Those edits
dispatch the shared derived-Shop-entry command, which atomically persists the
engine-owned default without adding the key to chronology. Room Timeline shows
only the Gold chronology row after pickup participation is
selected; it never duplicates the reward editor.
Gift's reached Hammer child uses the biome-start keepsake result described
above. Each active child has one marker, bound semantic interaction, and exact
finding destination. Switching the outer Echo row or making a generated child
unreached retains structurally valid authored detail without publishing a
phantom destination. React renders these supported products and never decides
Echo legality from provider, reward, trait, or keepsake names.

A Shop renders its declaration-owned initial slots first, then the shared
supplemental rows in Travel, Gold, Contract order when present. Travel and Gold
reuse one `supplementalOffers` projection, one reward-control adapter, and one
React renderer. Disabled placeholders expose instructions only; active rows
carry engine-bound defaults, domains, semantic edits, findings, and complete
participation proposals. One Room Timeline workbench owns the interleavable
initial, Travel, Gold, and Contract chronology, including atomic source rebind,
move, and dependent removal. The application does not infer a source or repair
an order from rendered positions.

Every Room Timeline workbench is hosted by the occurrence that owns its exact
chronology, including a Shop whose outgoing decision is authored later.
Participating entries form a numbered draggable sequence with compact arrow
controls. Initial Shop nonparticipants remain in Overview rather than below an
Action-order boundary. Their Purchased toggles alone change base-purchase
membership; drag and arrows alone change the relative order of existing
participants. Generated optional pickups retain their existing action-owned
participation and repair interactions.

Complete-offer first-Olympian composition findings are projected through the
same leaf and destination. They do not add a workspace mode or marker; the
engine derives empty ordinary-boon slots from equipped state, and dormant,
unpicked, or unpurchased leaves remain non-consuming authoring surfaces.
Exhaustion, banned-trait, and Fallback Gold findings follow that same exact
owner and interaction; the workspace does not duplicate their policy.

Replacement evidence uses that same leaf and interaction. A reached
Olympian replacement carries its exact engine transition and promoted rarity
into the option annotation and selected chronological summary. The workspace
does not add a replacement editor or checkbox, and React never reconstructs
slot occupancy, promotion, shortage limits, or branch legality. Heroic appears
only when the bound engine candidate is an Epic-to-Heroic replacement or is the
retained authored value under repair. Context-invalid selected values remain
visible, while unavailable alternatives stay inspectable but disabled.

The structured workspace is complete when:

- ordinary-decision biomes show one labeled rail stop per decision, active
  frontier, Preboss structure, coverage, and findings without adding every
  room offer to the rail;
- N shows Hub Overview, Hub Timeline with an explicit visit-prefix cutoff, and
  Hub Exit through `HubDecisionWorkbench` without acquiring ordinary-decision
  semantics;
- every ordinary decision exposes room, reward, and picked state together while
  preserving unpicked reward and finding state;
- finding navigation focuses the exact semantic owner inside its owning
  decision or N visit-local workbench;
- empty and partial biomes show only truthful declared or projected structure;
- no expected length, probability, invented exit, or hypothetical future room is
  presented as a game fact;
- removal and repair interactions use explicit labels and dispatch only
  existing semantic commands;
- the layout remains keyboard operable, screen-reader legible, and responsive;
- no persisted authored contract, simulation rule, or topology identity is introduced for
  presentation convenience.
