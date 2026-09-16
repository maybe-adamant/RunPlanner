# Structured Editor Workspace

## Purpose

This document defines the presentation structure for route and biome authoring.
It composes contextual-editor products into a legible structured workspace
without changing the authored-project model, simulation, validation, semantic
commands, or persistence.

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
editor all height remaining below the compact project header.
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

Before a project is open, the application presents a catalog-driven route
chooser. Once a route is selected, the header displays its identity and the
route-local navigation provides Route, configured biomes, and nonempty indexes;
it does not switch between sibling authored runs. The route rail is the
selected route's local overview and biome navigation, not a competing second
route selector.

### Route Rail

The route rail projects the selected route's normalized biome order and current
project evaluation. It shows Route Overview, each configured biome, its
status, and whether contextual evaluation is active, complete, or blocked by an
earlier biome. The catalog route collection is used only to populate the
chooser; it is not rendered as sibling project workspaces.

Selecting a biome changes UI-session navigation only. A downstream biome remains
visible when blocked and its contextual state remains unassessed. Required
upstream incompleteness locks its semantic authoring controls; upstream
invalidity alone does not.

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
Steady Growth progress and its rarity-dependent interval are joined from the
same equipped-trait snapshot; the workspace does not count lifecycle events or
predict a future automatic target.

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
and every physical offer's picked state, Room row, and Reward row. A topology-
free biome instead exposes one generic `Start biome` action. That action creates
and focuses the actual Opening or Intro occurrence, whose inspector exclusively
owns start-room identity and reward authoring. F therefore exposes its three-
room Opening picker only after the occurrence exists; fixed Opening and Intro
occurrences show their declaration-owned identity without a duplicate frontier
picker.

Before a physical offer's room is selected, the pending Reward row remains
visible as `Choose room to show reward`; after selection it explicitly renders
no reward, one editor, or all active editors for that room. This is one
projection product, not a biome-specific presentation branch.
Before a decision has one selected continuation, its numbered rail stop opens
that decision surface. Once exactly one target is selected, the same stop opens
the selected target occurrence stage; the predecessor stage still owns and
renders the outgoing door editor. Exact target and door-reward focus continues
to open the semantic control that owns the value. Findings retain their exact
semantic origin, but an acquisition child edited from a Room Timeline action
navigates first to that visible pickup action without opening its trait, spell,
or Pom dialog. The action's existing editor launcher is the deliberate next
step. Structural reward and encounter setup findings continue to open their
owning control directly. Fixed entries and N
visit-local details retain occurrence workbenches where they are player-facing
stages or subordinate Hub navigation.

Finding navigation selects the owning route and biome, preserves the semantic
finding owner, and brings its projected visible authoring point into view. The
inspector never searches for a rendered room label or decision number.

### Static Room Maps

Room maps are application-owned reference images keyed by the declared game
room name. Inspection is available from room headings, authored outgoing
targets, Hub cards/visits and side-room rows, including unpicked, closed and
ungenerated destinations. Viewing a map never edits participation, changes
semantic focus, adds history or requires complete authoring. The route rail
remains the navigation to room details.

One image viewport serves inspection dialogs and inline editing references.
Fields Layout keeps placement controls on the left and a larger reference on
the right. Hub Overview and Timeline share a top-right map toggle; individual
main/side-room dialogs remain independent of that Hub reference. Side-room
tables retain their full editing width. Inline references are sticky only
beside controls and stack above them in normal flow when space is narrow.
Images fit a bounded viewport with optional zoom and scrolling; Close/Escape
returns focus to the invoking control when it still exists.

Visibility and zoom belong to the local host, not the authored project. Edits
within that host preserve the reference; changing its room image resets Fit,
and changing the host cannot inherit another room's open reference. Images,
including placeholders and baked-in annotations, are replaceable static assets,
not previews generated from room contents or live spatial-authoring controls.
See the [asset replacement note](../../apps/planner/src/ui/room-maps/README.md).

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

P uses the same exact-phase presentation. Its workspace labels are **Opening
encounter** for `Intro` and **Follow-up encounter** for `Combat`.
The ordinary candidate pipeline evaluates Combat only after a valid,
non-terminating Intro selection; a terminating Heracles choice naturally
withholds the dormant suffix. The application renders the two existing phase
controls and does not flatten candidate pairs or infer Heracles, P room names,
phase legality, or sequence termination.

The exact Intro and Combat addresses remain the semantic owners. Timeline
phases, retained-invalid findings, Fig Leaf, Gorgon, and terminal trait offers
keep their existing markers, focus destinations, and child interactions. Each
phase selection keeps its ordinary semantic command and Undo unit; no lifecycle
or child ownership moves to a composite editor.

### Lifecycle Occurrence Workbenches

The application publishes one closed occurrence-presentation union rather than
a generic room-details disclosure. Standard, Fields, and Shop occurrences
render Room Overview, Room Timeline, and Room Doors. Overview contains read-only
incoming context and meaningful room-local setup: optional N Side rooms,
Fields identities, Shop inventory and Purchased markers, and Room features.
Room Timeline consumes the engine lifecycle timeline plus the one
occurrence-owned chronology. Doors consumes the unchanged total outgoing-stage
product. A
section is omitted when its projected product is empty.

Timeline action headings use **Purchase** for paid World Shop/Well items and
their refills, **Interact** for other actions (including Contract items and
Echo-generated pickups), and **Sell** for Pool sales. Omit generic `with` and
`pickup` wording; retain distinguishing cage, phase, source-role, and boosted
identities. Purchases use `Purchase Slot N Offer · Item` or
`Purchase Travel Deal Offer · Item`, with N matching inventory display order;
Contract items use `Interact Contract Item · Item`. Timeline Pom names are
**Pom**, **Double Pom**, **Triple Pom**, and
**Pom Slice**, without changing catalog names. Headings, drag previews, and
action controls share the projected label; outcome details remain separate.

Required chronology rows arrive ranked from the activating semantic command
and expose only engine-assessed moves. React renders no Position or generic
Remove control for them. A retained malformed omission is the exception: its
unranked required row exposes exactly one canonical restore intent supplied by
the engine. The application binds that intent without selecting an insertion
rank, while optional membership and stale removal remain on their established
paths.

Manual tab selection is transient and defaults to Overview for a newly focused
occurrence. Exact semantic focus overrides it: setup and purchase markers open
Overview, active encounter/action owners open the matching Room Timeline tab,
inactive Ship actions open repair, and outgoing owners open Room Doors. The
application publishes that closed destination; React does not parse addresses
or labels. Tabs use one stable tabpanel identity and roving ArrowLeft,
ArrowRight, Home, and End keyboard activation.

The occurrence header presents only the compact `Entering <room>` identity plus
cross-tab markers or controls. Room Overview consumes the exact predecessor
offer-reward surface and renders one compact read-only incoming-reward fact:
its visible summary, `Hidden`, or `None`. React does not rediscover an offer
from room-local state or expose an incoming-reward editor there. A Room-features
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

Room features consume closed application presence products for supported
resources, exits and objects; room-inherent Fields/Nemesis and side-room setup
retain their own sections. The resulting exit card owns only decision selection, room
navigation, and its remaining door-specific identity controls; Anomaly
identity/revert remains on its door. A selected F/G Nemesis event projects its
contextual family/outcome editor beneath the encounter phase; H projects the
same editor at the required Passive event row and uses the engine-derived
optional-count maximum. Incoming room identity and door-visible reward are
read-only context in an entered occurrence; their editor remains the
predecessor's outgoing door.

### Feature presence and resource placement

A feature that the room cannot structurally support has no control. A supported
absent feature is unchecked and enabled only when the engine permits adding it;
temporary unavailability keeps it visible but disabled. An optional authored
feature remains checked and removable even when context-invalid. A forced
feature is checked and locked. The application supplies this state; React does
not derive spacing, support or force from room names.

Resource labels name the successful outcome and declaration-owned element,
such as Successful Mining — Fire. The Resources heading explains that each
successful outcome may be placed once across the route. Moving an existing
placement uses its ordinary semantic replacement command; the row's separate
location column identifies and links to the current room. Removing or moving
uses normal Undo, not an additional confirmation workflow. Neither the local
control nor the Resources index displays the occurrence ID as its room label.

### Wheel offer cards

Active offers within one wheel use equal sibling cards, collapsing vertically
in narrow space. Two offers use the shared exit-card selection shell and its
radio treatment; one offer needs no false choice control. They remain rewards,
not doors: no room selector, door number or topology interaction is introduced.
Wheel 1 and Wheel 2 stay in their separate phase sections.

The chronological Choose action does not duplicate card selection with another
picker. Its engine-bound choice assesses the generated cohort without demanding
that the newly selected pickup's trait child already be complete. Reducing
offer or phase count hides dormant editors without deleting retained values.

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

The same outcome neighborhood exposes the engine-projected `Sea Star procced`
control only for a reached supported normal free pickup. Checking it creates
one ordinary generated acquisition row after its source; unchecking removes it
through the source-scoped semantic command. The reused acquisition row owns a
second-use consumable/resource's independent outcome detail or a fresh full
Pom's unresolved detail, requiredness, and Time Piece control. A retained
invalid result remains visible at its source with the engine finding and repair
intent but does not fabricate a child row. React never decides free-versus-paid
status, duplication capability, recursion, lifecycle inheritance, or Pom
freshness.

The control presents those authored choices as reward outcomes rather than
exposing internal role vocabulary. Forfeit is not added to the authored
disposition union: the engine records its fixed Red Onion materialization in
the same reward-event stream as the other acquisition outcomes, the workspace
marks the exact reward control with the realized acquisition, and React keeps
the legal pickup interactions visible beneath a compact substitution status.
Retained authored children remain in the document and reappear if an upstream
edit makes the substitution no longer apply.

### Keepsake Products

Route Overview projects the mandatory starting selection. Each fixed Postboss
occurrence with a declared rack projects an optional `Choose keepsake` action
at every supported nonterminal route position; when active, that action owns
the replacement selection. Immediate Jeweled Pom and Experimental Hammer
results appear beneath that exact selection.
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

[Editor Model](EDITOR_MODEL.md#workspace-projection) owns the supported
workspace entry, authored-first construction, interaction binding, exact
finding routing and independent projection closure tests. This document owns
the concrete workbenches composed from that product.

The workspace renders authored structure with only reached evaluator overlays.
Missing or invalid values remain at their semantic owners; candidate support
never decides whether a mandatory control exists. Readiness disables controls
beyond the engine's incomplete horizon without hiding them. A rendered position
or tab is neither domain identity nor chronological authority.

## Ordinary Decision Workspace

For F/G/H/I/O/P/Q, the center region presents a concise decision-point rail:

- the authored start or fixed entries;
- each generated decision as exactly one labeled stop;
- the active continuation frontier;
- retained downstream structure after an invalid upstream edit;
- a layout-owned Preboss stage where it is distinct from an ordinary decision;
- realized fixed Boss/Postboss occurrences in their declared order.

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
offer keeps its Room and Reward rows at the same visual level, because the
selected room owns the complete reward surface for that offered door. An
unresolved offer keeps its pending Reward row, while a resolved room publishes
`No reward`, one editor, or all active sibling editors. Fixed and empty rewards
use the same labeled inline row as editable rewards, with a consistent gap
from Room controls rather than a horizontal divider. The door contract keeps
game preview visibility separate from planner authorship. An Anomaly or
Zagreus automatic return remains hidden in game, but
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
occurrence stage and may progressively add that room label; if its complete
offer surface has exactly one direct, compactly displayable reward, it may add
a structured reward token. The selected room remains useful context when the
reward surface is multiple or not compactly representable, so room and reward
cardinality are deliberately independent. Findings, evaluated entry, and
physical availability never suppress this authored-selection context.

A takeover decision uses the `Preboss` rail label while its selected
continuation is the normal Preboss batch. If an additional Chaos continuation
is selected instead, that same decision stop uses the selected Chaos room
label; the later fresh Preboss draw remains the sole `Preboss` stop.

The rail is intentionally lossy presentation. It consumes the complete
room-owned offer surface but emits one reward token only for a visible,
resolved surface containing exactly one reward. Zero, unresolved, hidden, and
multi-reward surfaces emit no token; that omission never removes their editor,
marker, finding, or focus destination. React consumes this derived token or
text fallback without recreating reward or selection policy. Fields, Ship, and
Shop surfaces do not infer a token by counting nested controls. Ephyra opts in
only through its explicit incoming main reward; its side-room offers never
become an aggregate rail token. Target, occurrence, reward, and finding focus
continue to resolve to the exact control inside the decision.

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
- H exposes the required takeover only after four qualifying H room records;
  detours can therefore leave another ordinary Fields frontier even when four
  topology transitions already exist.
- I's Preboss remains a generated ordinary peer after Goal completion; it has
  no over-bound terminal envelope and closes the biome only when picked.
- O and Q reach a width-one takeover when their Preboss declarations become
  eligible and required at depth 7. Q's exhausted stage sequence contributes no
  seventh ordinary candidates; O's ordinary candidates are excluded by the
  required Preboss pressure.

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
  reward context; and Hub Exit's fixed `Preboss` card for the existing completed-Hub handoff;
- side-room generation and entry state under visited parents;
- derived Hub returns and parent restores;
- the fixed completed-Hub handoff to the width-one Preboss Shop and its derived
  completion sequence.

Exact Hub inspector destinations also carry their presentation tab: Hub,
slot-set, and main incoming-reward-identity owners open Hub Overview; main
visit and ordering owners open Hub Timeline; entered main-room occurrences and
their incoming-reward acquisition children open the main occurrence Timeline;
parent-owned side generation, entry order, and side reward identity open the
parent main occurrence Overview; entered side occurrences and their acquisition
children open the side occurrence Timeline; and the uncommitted completed-Hub
handoff opens Exit. React consumes that explicit destination and does not infer
tab ownership from semantic-address shapes or rendered ancestry.

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

The Hub Timeline roster reserves one shared column layout for its drag handle,
rank, room identity, reward preview, and reorder controls. Long room labels
wrap within the identity column; they do not move later columns. On narrow
layouts, the reward preview moves below the room identity.
The Overview board uses four equal columns at its normal workbench width, two
at an intermediate container width, and one on narrow layouts. All 26 fixed
slots remain in declaration order at every breakpoint, and these layout rules
are presentation-only.

The N rail gives its fixed Opening and PreHub stages and each authored Hub
visit one read-only primary-reward token when the room projects one. This is
the same resolved token product used by ordinary selected-room context: fixed,
incoming, and Ephyra incoming rewards are eligible, while side-room offers are
not. The token neither changes focus nor creates another edit path; the Hub
board remains the sole editable main-reward surface.

Entered side occurrences extend the N rail as nested children of their owning
main visit. The rail includes only side occurrences in the authored local
`visitOrder`; generated but unentered side rows stay on the parent Overview and
do not receive rail entries. Side children retain side-entry order, select the
side occurrence's Timeline, and do not contribute to the six-main-visit count.
Parent-owned side generation, entry order, and reward-identity markers select
the parent main visit and its Overview. The rail uses the complete marker
family supplied by each owner, including acquisition children, rather than a
rendered-position or partial-marker heuristic.

Hub Overview owns membership and main-reward editing; Hub Timeline owns visit
order. Both display read-only room labels. The rail is the primary navigation
to visited room details, with findings retaining their exact destinations.
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
persisted or stored in Redux. Explicit rail, reward, and finding actions
continue to use their exact semantic owner destinations.

## Progressive Coverage and Findings

The workspace presents the single atomic project evaluation described by
`EDITOR_MODEL.md`. Evaluated owners show their interactions and findings; the
repair owner at the authoring horizon remains navigable; retained later
authorship stays visible but unassessed and locked. Invalidity alone does not
lock repair, and an upstream block is never restated as fabricated downstream
invalidity.

The route rail, inspector, tabs, and Findings panel reference the same semantic
destination. The owning control receives the persistent error treatment;
summaries may show aggregate status but never create a second finding location.
Color remains supplementary to labels, icons, descriptions, and accessible
names.

## Empty and Future Outline

A configured biome with no authored topology should show its declared structure
and live authoring frontier rather than a blank form. This is a read-only outline,
not preallocated authored state.

The outline follows these rules:

- declared Opening, Intro, PreHub, Preboss, Boss, and PostBoss roles may appear
  as concrete read-only landmarks;
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

The workspace places the shared selector products defined by
`CONTEXTUAL_EDITOR_UX.md` beside their exact semantic owners. It may arrange
their labels, triggers, summaries, and responsive layout, but it does not
restate candidate grouping, required-first behavior, selected-invalid
retention, reward-store resolution, sibling awareness, or counted-bag policy.

After any semantic edit, the workspace renders the newly projected authored
snapshot. Compatible values remain at their stable owners, newly active leaves
use declaration-owned defaults, and context-invalid values retain their normal
finding presentation. No rendered position, open picker, or local draft becomes
a second source of reconciliation policy.

## Removal Actions and Repair

Every in-project structural edit has one semantic command and one history
entry; Undo/Redo is its recovery mechanism. Controls that remove existing
authored structure use the red danger affordance only to communicate that
subtractive effect. They do not receive a different command, history,
confirmation, or recovery path. The workspace has no generic removal-action
abstraction, completion status, or post-edit focus policy.

Retained-overflow and Preboss-handoff repairs remain explicit:

1. show unavailable retained targets at their semantic owner;
2. show which picked target or Preboss realization is no longer available;
3. let the user select a representable continuation;
4. expose the owning reconciliation command;
5. reconcile immediately when the user invokes that explicit action;
6. rely on the existing Undo/Redo history controls for recovery when needed.

Action labels invoke semantic commands; they do not calculate deletion scope
or repair the project themselves. Persistent deletion-scope copy belongs only
on a concrete action whose user research requires it. The application-wide
session liveness reconciliation may clear a deleted finding or focus reference
after a new workspace publication,
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
Confirmation is reserved for operations that are both externally consequential
and not recoverable through project history. Tailwind adoption and literal
shadcn component copying are out of scope.

Dependency choice remains subordinate to the ownership contract. A component
library must not hide semantic commands, make caller-owned option models mutable,
or move presentation policy into generic wrappers.

`ui/styles.css` is the ordered stylesheet entry. Its owned layers preserve the
cascade: foundation/shell, project/route, trait feedback, biome layout, editor
structure, room workbenches, shell metadata, responsive overrides and final
finding overrides. Keep local container/media rules with their selectors and
preserve the order of later refinements. A stylesheet relocation must not
silently change layout or finding precedence; verify the expanded cascade and
representative wide/narrow browser surfaces.

Keep the room editor beside the rail only while it retains roughly half the
available app width; otherwise stack them with shared scrolling, independently
of the header and navigation's mobile layout.

Compound controls must fit their actual container, not only a viewport breakpoint.
Wrap complete target/value fields before compressing their contents; at narrower
widths a label may sit above its slider, but the slider and displayed value stay
together. Check descendants against their field and visible panel: an ancestor
with clipped overflow can hide a defect from document-level overflow checks.

## Workspace Invariants

The structured workspace must ensure:

- every active semantic owner has one bound interaction, one finding
  destination, and one containing inspector even when route indexes or
  summaries also reference it;
- Overview owns occurrence contents and feature inventory, Timeline owns
  participating actions and their chronology, Layout owns read-only physical
  placement, and Doors owns outgoing offers and selection;
- dormant, ungenerated, unvisited, and unpurchased children do not publish
  active Timeline controls merely because their authored detail is retained;
- ordinary decisions and N's Hub use their own declared topology products
  without teaching either renderer the other's semantics;
- finding navigation focuses the exact repair surface and never derives a
  destination from rendered ancestry or an encoded identifier;
- empty and partial biomes show only truthful declared or evaluated structure;
- contextual controls consume application-projected products without
  rebuilding candidate policy;
- removal and repair controls dispatch engine-owned semantic commands and rely
  on ordinary Undo/Redo for recovery;
- the layout remains keyboard operable, screen-reader legible, and responsive;
  and
- no authored field, topology identity, lifecycle rule, or simulation fact is
  introduced solely for presentation convenience.

Feature-specific authoring behavior belongs to `EDITOR_MODEL.md`, selector
behavior to `CONTEXTUAL_EDITOR_UX.md`, and domain legality to the corresponding
engine authority. This document determines where those products appear, not
what they mean.
