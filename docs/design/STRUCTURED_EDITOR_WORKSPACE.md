# Structured Editor Workspace

## Purpose

This document defines what the route and biome workspace shows and where:
the route rail, biome structure, focused inspector, occurrence workbenches,
ordinary decisions, the Hub board, empty-biome outlines and removal repair. It
composes engine and application products into a game-structured route rather
than a database form, so a user can see where they are, which authored
decisions form the picked continuation, which generated offers are unpicked
leaves, how far evaluation has reached, where the first blocking owner is,
what is being edited, and what remains structurally possible without invented
future facts.

[Editor Model](EDITOR_MODEL.md) owns projection, binding, readiness and
[findings and feedback](EDITOR_MODEL.md#findings-and-feedback);
[Contextual Editor UX](CONTEXTUAL_EDITOR_UX.md) owns picker and popup-editor
behaviour; [Application Shell](APPLICATION_SHELL.md) owns the route-level
panels and the Run State sheet. This document determines where products
appear, not what they mean.

## Workspace Invariants

- The workspace is a projection and command surface, never a second
  serialized topology. Authored topology and Room Occurrences remain the only
  topology authority, and no authored field, topology identity, lifecycle rule
  or simulation fact is introduced for presentation convenience.
- Any non-complete-valid biome remains an authored-topology projection with
  only its reached assessment prefix overlaid. A complete-invalid biome does
  not publish canonical topology merely because authorship is complete. Only a
  complete-valid biome publishes canonical products and seeds the next biome.
- Every active semantic owner has one bound interaction, one finding
  destination and one containing inspector even when route indexes or
  summaries also reference it. UI destinations use occurrence IDs and semantic
  addresses, never rendered indexes, ancestry or encoded identifiers.
- Overview owns occurrence contents and feature inventory, Timeline owns
  participating actions and their chronology, Layout owns Fields spawn-point
  placement, and Doors owns outgoing offers and selection.
- Dormant, ungenerated, unvisited and unpurchased children publish no active
  Timeline control merely because their authored detail is retained.
- Context-invalid authored values remain visible until explicitly replaced or
  removed by an owning structural command.
- Ordinary decisions and N's Hub use their own declared topology products
  without teaching either renderer the other's semantics.
- React implements no eligibility, force, reward-store, bag, sibling,
  Preboss-handoff or route-gating rule; contextual controls consume
  application-projected products.
- One visible user intent dispatches one engine-owned semantic command and one
  Undo entry; removal and repair rely on ordinary Undo/Redo for recovery.
- Focus, expansion, search, disclosure and viewport state remain transient
  UI-session state.
- Empty and partial biomes show only truthful declared or evaluated structure.
  The simulator models possibility, not probability: the workspace shows no
  likelihood or expected route length.

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

These are presentation regions, not persisted panels; narrow layouts may stack
them.

### Route Rail

The route rail projects the selected route's normalized biome order and
current project evaluation. It shows the Route, Draft and Loadout panels
([Application Shell](APPLICATION_SHELL.md#editor-panels)), then each
configured biome with its status and whether contextual evaluation is active,
complete or blocked by an earlier biome, then nonempty route-local indexes.
The workspace opens on Route. Loadout carries the same status marker and
finding count as a biome for route-start owners, and every route-scoped or
route-start finding opens it; Route carries no marker.

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

### Run State Launchers

The workspace joins each engine-published Run State snapshot to its exact
semantic owner. A structurally eligible owner projects one launcher: an
available launcher binds that exact snapshot, while an unreached launcher
carries the engine coverage reason and binds no invented state. Run State is
available through the covered lifecycle checkpoint that precedes or contains
the first blocking value and unavailable afterward; the workspace applies no
second canonical or finding-order cut. The
[sheet](APPLICATION_SHELL.md#run-state-sheet) presents the snapshot.

Only two decision-generation launchers remain public: the `HubDecisionAddress`
before the Hub board is generated and the Hub-sourced `ExitDecisionAddress`
before Preboss generation. Ordinary occurrence-sourced decisions do not retain
a `beforeTargetGeneration` launcher on their door cards. Room-local lifecycle
launchers keep their exact engine owners while the application projects one
consistent utility slot at the top of each tab panel. Ordinary/H/Shop Overview
and Timeline reuse the same Room-entered launcher. O Overview and Intro Timeline
reuse Intro's pre-start launcher, while each later phase tab, and the wheel
tab whose pick leads into that phase, uses that phase's pre-start launcher. Room Doors uses the literal pre-exit launcher. Inactive
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
exit owns the retained generation diagnostic before Preboss. React consumes
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
visible, asking for the room first; after selection it explicitly renders
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

One image viewer serves inspection dialogs and inline references. Fields Room
Layout and Ephyra Side Rooms keep controls beside a larger reference;
individual main/side-room dialogs remain independent of the Hub editor. Side
Rooms uses an illustrative parent map with declared local slot status;
generation and traversal are edited in the controls. Images support zoom and
pan, and Close/Escape returns focus to the invoking control when it still
exists. Visibility and zoom belong to the local host, not the project: edits
within that host keep the reference, changing its room image resets the zoom,
and a new host cannot inherit another room's open reference. Images, including
placeholders and Fields annotations, are replaceable static assets
([asset note](../../apps/planner/src/ui/room-maps/README.md)). The Hub's
read-only inspection and interactive Overview/Timeline draw their own markers
over one shared background with shared door and fountain coordinates;
coordinates are presentation data, not topology.

### Encounter Phase Products

Each structurally active encounter phase, including fixed and passive phases,
is a first-class workspace owner. Its exact `EncounterPhaseAddress` resolves to
the containing occurrence inspector, one marker, one focus destination, and—if
the declared set has meaningful choice cardinality—one bound selection
interaction. The projector consumes the engine's context-free
`EncounterPhaseAuthoringDomain`, whose activation comes from catalog,
persisted selection, and template-controlled authored facts. The engine's exact
sequence status suppresses only a validly terminated dormant suffix. Reached
candidate support decorates the remaining product; its absence leaves an active
control unassessed and does not decide whether that control exists. The
projector never derives phase activity from a rendered ordinal or finding.

The workspace publishes active phases even behind an invalid evaluated prefix,
so their retained selections remain visible. Every phase of a room entered
through the [selected cut](SIMULATION_AND_VALIDATION.md#selected-cut),
including one whose own finding blocks the Overview, keeps its candidate
support; phases of later rooms are unreached until repair restores an exact
later checkpoint. A dormant potential
phase retains its persisted selection but has no live interaction, marker,
finding, or route-NPC index entry. Singleton phases preserve their exact
semantic destination without producing no-op controls. This gives finding
navigation and closure the same phase identity regardless of whether the
presentation has a visible picker.

The resolved definition's customization domain supplies a separate **Customize
encounter** control, including for fixed identities. One dialog renders declared
single choices, bounded ordered prefixes and generated compositions; it does not switch on Boss names
or calculate Rivals. Changes dispatch immediately through bound commands and
Undo. Unsupported retained choices remain visible for repair. Boss decisions
retain their declared defaults; generated customization can reset wholly to
native control. Identity and customization are fixed on entry, so every
phase's selector and launcher render in Room Overview; finding navigation
selects Overview and focuses/highlights the launcher without automatically
opening the dialog. The Room Timeline names a definitional encounter's settled
identity in its Start encounter banner: the encounter, prefixed by the phase in
a multi-phase room unless a Fields cage label already names it. A non-combat
encounter settled on entry (a Nemesis event, Empty) leaves its Room entered
banner plain; a selected Nemesis family is read-only text on its movable
interaction row. The banner identity only navigates to its Overview owner. The events decided at that start
(Fig Leaf, Gorgon, Aetos) render in the banner row's editors only when present;
a Nemesis response stays on its interaction row, and an Anomaly outcome is an
Encounter ended event. Event findings have their own phase-child owners and
navigate to that Timeline control.

Opening generated composition is read-only. Edit initializes a complete value
through the exact engine capability; Reset removes that value. Customized controls
have no inner native defaults. Wave tabs contain staged whole-wave pickers and
budget tables showing allocations, derived counts and final cost. Variable budget
sliders map through the engine; fixed budgets remain labels. Intermediate picker
choices and input drafts are local. Finish Wave allows an early stop while more
enemies are eligible; a selection that completes a valid wave with no eligible
continuation commits immediately and closes the picker. Both publish one replacement
and one Undo entry, while Cancel is inert. Opening or reassessing a draft never
commits it. Completion depends on composition validity, not
unrelated retained Menace count findings.

Fangs uses adjacent Target and Perks controls: target edits persist immediately,
while ordered perk prefixes remain local until Finish. Active Menace adds aligned
Menace Target and Menace Count rows under Count; inactive values remain dormant.
The application renders engine-owned domains/counts and does not calculate budget,
perk or conversion legality. Retained invalid values and per-control repair
messages stay visible. The dialog itself is not another saved draft.

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
render Room Overview, Room Timeline, and Room Doors; Fields adds Room Layout,
which edits the spawn-point placement of the entry, cages, optionals and
Nemesis beside the room map. Overview contains read-only
incoming context and meaningful room-local setup: Fields identities, World
Shop inventory, and Room features, whose Shrine and Well inventories likewise
hold only their fixed slots (a Shrine slot shows its item and the delay rolled
with it) and whose Champion Item holds the Contract pedestal's item. Overview
authors content only: buying, rushing, collecting and every Travel Deal refill
are authored on the Room Timeline. A Stygian Well or Pool of Purging Overview
shows only its presence and initial stock, whose slots are always editable and
optional; using it starts on the Timeline. Ephyra parents with declared
side-room groups add a dedicated Side Rooms workbench.
Every Overview renders its sections in one order, showing only those the room
has: Encounters, room contents (Shop inventory, Fields optional rewards),
Additional Exits, Objects, Resources, NPCs.
Room Timeline consumes the engine lifecycle timeline plus the one
occurrence-owned chronology. Doors consumes the unchanged total outgoing-stage
product. A section is omitted when its projected product is empty.

When a block lies in a room's Timeline or doors opening, the application marks
the rows named by the engine's `roomTimeline.blockingRowKeys` as the blocking
product; it never infers that row set. Those rows keep their row-level edits
(order, removal, purchase participation) and findings; an inner picker is
editable only where the engine published a reached capability, so rows past
the failing contact show it read-only with the unreached hint. Rows after the
blocking product, Room Doors and later rooms show their authored values the
same way. A block at the Overview leaves the Overview as the repair surface and
the Timeline and Doors read-only.

Timeline action headings name their verb (Buy for paid World Shop, Shrine and
Well items and refills, Rush for rushed Shrine purchases, Collect for pickups
including Contract items and Echo-generated pickups, Sell for Pool sales,
Reroll for rerolls) and keep distinguishing cage, phase, source-role, slot and boosted identities. Pom
actions use their pickup names (Pom, Double Pom, Triple Pom, Pom Slice)
without changing catalog names. Headings, drag previews and action controls
share the projected label; outcome details remain separate.

Purchase and collect rows carry no inner checkbox; their delete control
removes the action. The purchase row that triggers Travel Deal renders the refill's inventory controls as its second line: for a
Shrine, the engine's refill source (the first rushed initial purchase made
with Travel Deal); for a Well, its first purchase; for a World Shop, the
purchase the refill entry names as its source. The line has no placeholder. A
purchased refill that no line hosts keeps its own purchase row with a bound
removal, and refill findings route to the line's control or to that row.

Each present Stygian Well, Pool of Purging, World Shop (the Preboss Shop form
included), Hermes Shrine and Champion Item has an entry at the top of the
optional actions listing what the engine publishes as possible at the end of
the room's current actions, each option named by the row it appends. A Well
or Pool offers buy or sell for each offered slot (a blank initial slot takes
its item or trait in the same pick) and Reroll with its cost, disabled with a
hint when screen rerolls are not enabled, nothing is left to reroll or the
pool cannot pay. A World Shop offers each unbought item; a Shrine offers Buy
or Rush for each unbought item, one pick and one Undo step either way; once
its Travel Deal item is live, either offers to buy it, a blank one taking its
item in the same pick; a Champion Item offers its collect. Every entry is
shown while its object is present and is disabled with the reason when nothing
can be done there (everything bought or sold, the only option left a reroll
that cannot be made, the item collected or not yet chosen, the pedestal
inactive). One pick appends one action at the end, which
Move repositions. A reroll row carries an optional picker for each restocked
slot, pinned or native.

Room Doors keeps its door layout and lists the room's door and Fields cage
rerolls below the doors in one ordered **Rerolls** list headed by the rerolls
left: each row is a target and its new reward with Remove, and a new row is
appended at the end once its target is chosen. A removal keeps the later rows
it invalidates, with their findings. The same presses appear as Timeline rows,
where Move is the only way to change their position among other post-unlock
actions. A rerolled target reads first draw → final, and the next room's
header and the rail show the final reward. Reroll findings route to the list
row, except an out-of-order press, which routes to its Timeline row. An Ephyra
room's hidden return door sits in Room Doors as one automatic line, in place of
a continuation note, until its placeholder room or reward is pinned; a reward
picker waits for the room. Reroll lists and counts are hidden without a card
that enables them unless the plan already holds rerolls.

An Anvil of Fates result launcher sits on the Timeline row of the reward that
carries the Anvil, wherever it settles: a Shop slot's purchase row, the Gold
Gold Gold duplicate's pickup row, or the refill's own purchase row, never the
Travel Deal line. It stays mounted on every Anvil-bearing role and is disabled
with a waiting hint until the engine reaches that role's Anvil frontier,
which it does only under a `normal` disposition. While the result applies, its
findings route to the launcher; otherwise they route to the row.

In a Room Timeline action, the pickup-outcome control precedes everything that
outcome enables: trait, Pom, Anvil, Artificer output and Fountain controls.

Required chronology rows arrive ranked from the activating semantic command
and expose only engine-assessed moves. React renders no Position or generic
Remove control for them. A retained malformed omission is the exception: its
unranked required row exposes exactly one canonical restore intent supplied by
the engine. The application binds that intent without selecting an insertion
rank, while optional membership and stale removal remain on their established
paths.

Manual tab selection is transient and defaults to Overview for a newly focused
occurrence. Exact semantic focus overrides it: setup and fixed-slot purchase
markers and encounter identity and customization owners open Overview, Travel
Deal refill markers, Fig Leaf, Gorgon, Aetos and Nemesis-response owners and
action owners open the matching Room Timeline tab,
inactive Ship actions open repair, Fields spawn-point owners open Room Layout,
and outgoing owners open Room Doors. The
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
Timeline, Intro Wheels, Combat 1 Timeline, then Combat 1 Wheels and Combat 2
Timeline when Combat 2 is structurally active, and Room Doors. Overview owns
encounter count, every phase's encounter and room features. Each phase tab
contains its Start encounter banner and events and its post-combat actions;
its following `nextPhase` boundary is a read-only marker. Each active wheel's
tab follows the timeline tab it closes and holds the wheel's pool, offers, its
Rerolls list and the pick; final Combat 2 has no wheel. Wheel rerolls also
show as Timeline rows, and Choose and post-combat pickup actions stay on their
phase tab.
The groups are views over one interaction and one authored order: global ranks,
proposals, pointer drag, keyboard moves, and Undo are unchanged. The application
consumes engine-owned timeline action keys and phase attachments; React does
not derive lifecycle barriers or create another order. An action retained from
a now-inactive Ship phase is excluded from those active groups and rendered
exactly once in the Ship repair surface, preserving its finding, semantic
focus, and explicit removal proposal.

Room features consume closed application presence products for supported
resources, exits, objects and the observed Eris spawn; room-inherent
Fields/Nemesis and side-room setup retain their own sections. The resulting exit
card owns only decision selection, room
navigation, and its remaining door-specific identity controls; Anomaly
identity/revert remains on its door. A selected F/G Nemesis event's family is
chosen in the phase's Overview identity picker and its outcome on the Timeline
interaction row; the H Passive event's family is chosen beside its phase in the
Overview, and H projects the outcome editor at the required Passive event
row and uses the engine-derived optional-count maximum. Incoming room identity
and door-visible reward are read-only context in an entered occurrence; their
editor remains the predecessor's outgoing door.

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
One staged Combat Order picker above Room entered displays cage identities and
rewards. Only the final selection commits the complete permutation as one
semantic edit; closing an unfinished picker leaves the chronology unchanged.
Encounter-cycle headings show their assigned cage as a read-only label.
Inventory rows own reward payload and acquisition disposition. An optional
pickup joins or leaves the chronology from the Timeline's optional actions; the
chronology owns all completion, interaction, movement, and source-before-replacement
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
edit makes the substitution no longer apply. The reward control names the
realization inside its own picker trigger, `(Red Onion)` after the authored
offer with the Vow named on hover; nothing renders beside the control, and the
timeline row carries no provenance because its label already names the
realized pickup.

### Keepsake Products

The Loadout panel projects the mandatory starting selection. Each fixed Postboss
occurrence with a declared rack projects a permanent `Keepsake Rack` action
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
use the same labeled inline row as editable rewards. The door contract keeps
game preview visibility separate from planner authorship. An Anomaly or
Zagreus automatic return remains hidden in game, but
its freshly generated host reward still consumes the ordinary reward store and
therefore retains its reward editor and finding destination in the decision.
Single-choice controls live on those cards, and the picked card receives the
strongest emphasis because it is the authored selected route. Evaluated entry
is shown separately when materialization has actually reached that room.
A decision with a reward pool shows one pool row. Its Reward Pool half is the
editable picker for an authored RunProgress/MetaProgress batch or, where an O
ShipCombat wheel already decided the pool, a fixed value marked as from ship
combat with a link to that wheel. Its Effective Pool half is what the selected
exit records for the store ratio, read from the engine's entered-store
product: blank while no exit is selected or when the counted store equals the
pool; otherwise it names the different store (a forced sibling's flip), the
discarding room for a room that records no entered store, or an additional
exit's own store with its room. React derives none of these values. A decision
without a pool renders no pool row. Batch-wide rules stay with the batch;
reward visibility stays with the individual door.

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

Every biome's terminal takeover (the F/G/P/O/Q Preboss, N's Hub after PreHub
or natural Chaos) appears as a candidate in the same Door 1 room picker; I's
Preboss is an ordinary peer. When each becomes available is a biome rule (see
[`docs/biomes/`](../biomes/)). The shared rail and inspector share a direct
room-choice surface, not a universal ownership model or a separate Preboss
action.

## Hub Decision Workspace

N uses the same route rail, inspector, semantic focus, finding, and coverage
language, but its center is not an ordinary decision spine. The
`HubDecisionWorkbench` projects:

- fixed Opening and PreHub entries;
- the persistent board over 26 declaration-fixed Hub slots, with nine or ten
  open members;
- one complete room and incoming reward for each open slot;
- Hub Overview for the complete fixed-slot set, open/closed membership, and
  each open room's reward editor; Hub Timeline for the exact authored action
  prefix (up to six room visits, one fountain use and board-door rerolls) on
  the map or in its Details timeline; and Hub Exit's fixed Preboss door for the Hub's
  completed-Hub exit;
- side-room generation and entry state under visited parents;
- derived Hub returns and parent restores;
- the fixed completed-Hub exit to the width-one Preboss Shop and its derived
  completion sequence, authored with the Hub.

Hub Exit shows the Preboss as Door 1 with the shared `Open next room`
continuation; it has no create or remove action. While the Hub is incomplete
the chain is unreached: the continuation is disabled with a hint and the
Preboss rooms follow the unreached-context policy.

Exact Hub inspector destinations also carry their presentation tab: Hub,
slot-set, and main incoming-reward-identity owners open Hub Overview; main
visit and ordering owners open Hub Timeline; entered main-room occurrences and
their incoming-reward acquisition children open the main occurrence Timeline;
parent-owned side generation, side reward identity, and side entry order open
the parent main occurrence Side Rooms workbench;
entered side occurrences and their acquisition
children open the side occurrence Timeline; the completed-Hub exit opens
Exit; Hub fountain placement opens Hub Timeline; and its Phial
outcome and board-door rerolls open the Hub Timeline's Details. React consumes that explicit destination and
does not infer tab ownership from semantic-address shapes or rendered ancestry.

The board remains a joint generation region. Open-set membership and the dense
authored visit prefix are distinct engine-owned products. There is no persisted
map position or unvisited ordering.

Overview opens in Map. Clicking a closed door lazily invokes its bound opening
attempt and opens the existing reward editor on success; rendering markers does
not allocate occurrences or eagerly prepare every candidate. Open doors expose
that same editor. **Details** opens the fixed-slot List, which remains the stable
repair home for membership and reward findings; **Back to Map** returns to the
visual editor. Finding navigation selects Details even when Map was open. The List shows
every fixed-slot card in declaration order.
**Reset Board** dispatches one atomic command that closes all slots and removes
their owned visits and rooms while retaining the Hub, its source and its
completed-Hub chain. It differs from Remove Hub and participates in ordinary Undo/Redo.

Hub Timeline opens on the map. Open doors retain their stable room labels and reward
icons; visited markers carry a badge with the combined action order, while room visit ordinals
stay 1–6. Clicking an unvisited door appends it when fewer than six rooms are
visited; the fountain's distinct marker appends its one use regardless of room
capacity. Once all six visits and the fountain are placed, visited doors show
a room/reward popup with an explicit Open Room action; the fountain shows its
timing and an Open Interaction action. Clicking outside or Escape dismisses
the popup without leaving the map. Visited room banners offer a Hub Timeline return beside View Map, regardless of navigation
entry point. Markers do not reorder
or open a second reward preview. Overview shows the labeled fountain diamond
without interaction or board membership. **Reset visits** submits the empty
action prefix, clearing the
fountain use and its Phial outcome, as one undoable edit, including normal
downstream cleanup; it is disabled while the order holds board-door rerolls.

**Details** opens the Hub timeline as a list: the visits in order, with each
gap between them (each Hub stay) holding its Rerolls list for board doors not
yet entered and a board recap of every door's current reward, first draw →
final when rerolled. The fountain is a row in its gap, carrying its Phial
outcome editor and a Move action that places it in any gap; before its use it
is a Use row at the end. Map and Details send the same Hub action-order
command; finding navigation to a reroll or the Phial outcome selects Details.

The existing Hub-owned interaction assesses complete proposals with Hub-level
readiness, not the interior readiness of each visited room. Exact visit markers
and the count target remain available for findings. Map controls, reward icons
and badges are projections of the same workspace owners as Details; they do not
create another membership, legality or chronology path.

The N rail gives its fixed Opening and PreHub stages and each authored Hub
visit one read-only primary-reward token when the room projects one. This is
the same resolved token product used by ordinary selected-room context: fixed,
incoming, and Ephyra incoming rewards are eligible, while side-room offers are
not. The token neither changes focus nor creates another edit path; the Hub
board remains the sole editable main-reward surface.

Entered side occurrences extend the N rail as nested children of their owning
main visit. The rail includes only side occurrences in the authored local
`visitOrder`; unentered side rows stay in the parent Side Rooms workbench and
do not receive rail entries. Side children retain side-entry order, select the
side occurrence's Timeline, and do not contribute to the six-main-visit count.
Parent-owned side generation, entry order, and reward-identity markers select
the parent main visit and its Side Rooms workbench. The rail uses the complete marker
family supplied by each owner, including acquisition children, rather than a
rendered-position or partial-marker heuristic.

Hub Overview owns membership and main-reward editing; Hub Timeline owns visit
order. Both display read-only room labels. The rail is the primary navigation
to visited room details, with findings retaining their exact destinations.
N never acquires arbitrary room replacement merely to reuse an ordinary room
picker. Membership and visits remain Hub-owned semantic interactions; the
completed-Hub exit has no authoring interaction of its own.

Hub membership changes are batch composition rather than navigation. Their
bound `OpenHubSlot` and `CloseHubSlot` intents have no semantic-focus product:
opening or closing a room must not jump the inspector to its room configuration.
The local reward popover and keyboard focus remain transient presentation state;
neither changes the rail selection or enters authored history. Explicit rail
and finding actions retain their exact semantic owner destinations.

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

## Removal Actions and Repair

Every in-project structural edit has one semantic command and one history
entry; Undo/Redo is its recovery mechanism. Controls that remove existing
authored structure use the red danger affordance only to communicate that
subtractive effect. They do not receive a different command, history,
confirmation, or recovery path. The workspace has no generic removal-action
abstraction, completion status, or post-edit focus policy.

Retained-overflow and Preboss repairs remain explicit:

1. show unavailable retained targets at their semantic owner;
2. show which picked target or Preboss realization is no longer available;
3. let the user select a representable continuation;
4. expose the owning reconciliation command;
5. reconcile immediately when the user invokes that explicit action;
6. rely on the existing Undo/Redo history controls for recovery when needed.

An ordinary and a takeover batch share one exact repair slot bound to
`ReconcileBatchExitCapacity`. The projected repair names its effect: removing
unavailable doors (a danger action) or adding missing Preboss doors. A takeover
batch offers it whenever the engine can match the batch to its source's
declared doors, and its repair carries the batch's finding mark, including that
of a missing door, which has no row of its own.

Action labels invoke semantic commands; they do not calculate deletion scope
or repair the project themselves. Persistent deletion-scope copy belongs only
on a concrete action whose user research requires it. In-project edits have no
confirmation step; confirmation is reserved for operations that are both
externally consequential and not recoverable through project history.

Closing an unvisited slot that crosses the declared open-set minimum removes
only the detached slot subtree. The resulting board remains visible as
incomplete with its authored visits and completed-Hub chain retained.
