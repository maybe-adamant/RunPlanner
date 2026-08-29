# Editor Model

## Purpose

This document defines how the external React application presents and edits
the authored project while consuming simulation results. It owns UI language
and interaction policy, not game rules or persisted topology structure.

## Editor Principle

The editor is a projection and command surface:

```text
authored project + simulation result
  -> WorkspaceBiome presentation projection
  -> React components
  -> semantic command
  -> replacement authored project
  -> fresh simulation result
```

The UI may tolerate incomplete and invalid authored plans. It must not hide,
repair, or silently delete them merely to keep the view visually legal.

The batch-level projection follows the locked all-biome project contract.
F/G/P author an ordinary batch Reward Pool, H authors its Fields outcome, I
authors one biome-wide Clockwork limit without a base store, O may derive its
outgoing store from a source wheel, and Q owns no ordinary base store. N first
projects its bounded PreHub decision with Hub as the sole Door 1 room choice,
then its fixed Hub board. All variants use the same semantic command and finding
ownership rules.

## Application Shell

The initial shell should preserve the useful high-level navigation proven by
the ImGui prototype:

- one horizontal tab per catalog route, followed by Settings;
- route-local biome navigation;
- a route settings panel;
- one shared route-structure workspace;
- a route status and findings surface;
- one focused semantic inspector.

The exact desktop composition may evolve. Tabs and panels are presentation,
not project identity.

Route and panel navigation is one generic UI-session model. The active route
is a nullable catalog route key, where `null` selects Settings, and each route
retains one tagged panel independently: route overview, the read-only NPC
index, or one catalog biome. Application state and React composition do not
define separate Underworld, Surface, F, G, NPC, or other route-specific
navigation fields. The ordered route tabs, labels, valid biome panels, and
initial route come from the normalized catalog. A semantic finding selects its
owning route and biome through the same generic session action; route-owned
findings select the route overview and project-owned findings retain the
current top-level location. A separate exact-owner navigation action moves from
the NPC index to the containing biome and opens its existing room-local detail
surface without creating authored history.

## Product Language Boundary

Product-language policy belongs at the presentation boundary. React owns the
static labels and accessible names that describe its components; projection
presentation functions own evidence-dependent route feedback, finding
destinations, and candidate explanations. Together they use routes, biomes,
rooms, doors, rewards, reward pools, Shops, Preboss, Hub rooms, findings, and
evaluation status. Internal model terms such as `occurrence`, `batch`,
`frontier`, `topology`, `canonical`, and `progressive` remain valid
implementation vocabulary but do not become unexplained product copy.

Authored selection and evaluated entry remain distinct in both the model and
the UI: a selected continuation is a `Room selected`; only an evaluated entry
is a `Door taken`. The projection presents evidence-dependent explanations in
the same language. React renders that projected evidence rather than translating
semantic evidence, topology state, or candidate support locally.

## Workspace Projection

The application projects every configured biome into one `WorkspaceBiome`
envelope. The envelope has an exhaustive node union for starts, ordinary
batches, takeover Preboss batches, mixed batches, the Hub decision, occurrence
workbenches, and completion. React renders that projection through one
`BiomeWorkspace`; it does not choose a layout-specific editor by layout type
or read authored decision arrays to reconstruct topology.

Ordinary decision nodes project:

- the start or fixed entry;
- selected-spine decisions and physical exit targets in declaration-owned
  order;
- one selected continuation, unselected generated leaves, and retained
  unavailable exits;
- authoring frontiers and declaration-owned ordinary or Preboss batch actions;
- referenced room-local workbenches;
- findings, coverage, and candidate interactions attached by semantic address.

The one Hub decision node projects:

- its exact PreHub occurrence source and derived Hub room;
- the 26 declaration-fixed Hub slots, of which nine or ten may be open;
- one complete target room and incoming reward for every open slot;
- the dense ordered pylon-visit prefix, through six positions;
- generated/unavailable and entered-order state for side-room slots under
  visited combat targets;
- derived parent restores and Hub returns;
- the completed-Hub handoff to the fixed width-one Preboss Shop and derived
  completion sequence;
- findings and candidate state attached by semantic address.

The topology-free frontier exposes only the generic `Start biome` action. It
creates and focuses the actual Opening or Intro occurrence; it does not own a
second room picker or reward editor. The created start occurrence then owns its
Room/Reward composition, including F's multi-choice Opening replacement picker
and each fixed Opening or Intro identity.

Every physical door uses the same Room/Reward composition. Before a room is
selected the Reward row says `Choose room to show reward`; afterward the
selected Room Declaration explicitly resolves it to no reward, one reward
editor, or all active reward editors declared by that room. The application
adapts this room-owned product for the editor, while React does not infer reward
presence from biome, room name, template, or room-local chronology. This also
covers H's active Fields cage offer group.

`HubDecisionWorkbench` is the sole N-specific renderer inside
`BiomeWorkspace`. Its occurrence-like tabs make the persistent board readable
without changing its model: Hub Overview renders the complete fixed-slot set
and exclusively owns both open/closed participation and each open room's main
reward identity editor; Hub Timeline renders the exact authored visit prefix,
compact next-visit target, visit cutoff, presentation-only tail, and read-only
reward context; and Hub Exit presents the declaration-owned fixed target as one
custom `Preboss` card. It stays visibly locked until the existing completed-Hub
handoff capability is available, then exposes one `Open next room` action—no
candidate picker or arbitrary room replacement. It may not persist a second
door-count value.

The Timeline roster makes rank, identity, traversal state, and reordering
readable. Membership and main reward-identity controls never appear there;
closing a slot remains the single semantic operation that reconciles its
authored occurrence and visit references. Its read-only reward summary links
the exact semantic owner back to the existing Overview editor without creating
another ownership path.

Hub destination ownership is explicit in the application projection. Hub
membership and the incoming identity of a main-room reward open Hub Overview;
the main visit and ordering owner opens Hub Timeline; and the entered main-room
occurrence, including the trait, Pom, spell, and other acquisition-resolution
children of its incoming reward, opens that occurrence's Timeline. Side-room
generation, entry order, and side reward identity remain on the parent main
occurrence's Overview. Once a side room is entered, its lifecycle and
acquisition detail opens the side occurrence's Timeline. React consumes these
destinations and never derives them from address shape, rendered ancestry, or
the currently selected tab.

Membership controls create or remove the one authored occurrence owned by a
fixed slot; visited slots cannot be closed until their visit references are
replaced or explicitly removed. A Hub-decision-owned aggregate interaction
evaluates complete proposed prefixes lazily on control intent, so rendering the
26-slot board does not replay every alternative. Per-visit markers and exact
destinations remain positional products even though they share that aggregate
interaction.

Before that node exists, the exact PreHub terminal decision projects one Hub
takeover control. The application binds its engine-evaluated support and the
complete `ReplaceWithHubDecision` intent; React neither derives depth nor
constructs the command. Selecting it replaces the terminal decision card with
the existing Hub workbench, while removal and Undo restore the same card.

An authored Hub visit activates a combat room's side-room table. Each declared
row then projects generation and visit-order controls; a visited row owns a
unique ordinal (`1` when it is the only entered sibling). A side reward becomes
an active workspace leaf only when that row's authored generation is
`generated`: it receives its exact marker, reward interaction, and editor even
before evaluated entry. A `notGenerated` row retains its authored offer value
for a later re-enable, but publishes no current reward leaf. Evaluated entry
controls acquisition, not reward activation. Generated and visited totals are
derived. The editor must allow every permutation, and it must not suggest that
reordering entries changes already-generated sibling offers. Reordering
preserves the final modeled parent-exit state while changing the exact
history/execution trace.

The N route rail nests entered side occurrences beneath their owning main visit.
Only side occurrences present in the authored local `visitOrder` appear there;
generated but unentered rows remain available through the parent Overview only.
Side entries retain their authored side-entry order, select the side occurrence
when focused, and do not increment the Hub's six-main-visit count. Parent-owned
side generation, order, and reward-identity markers continue to select the
parent main visit.

Hub Timeline roster cards use one shared structural column layout for drag
handle, rank, identity, visit metadata, room details, and reorder controls.
Long labels wrap inside the identity column rather than shifting later
controls. The Hub Overview fixed-slot board uses three columns at its normal
width, two at an intermediate container width, and one on narrow layouts;
declaration order and fixed membership slots do not change with those breakpoints.
These are presentation rules only and do not enter authored state or UI-session
persistence.

Projectors consume normalized domain state and never infer topology from
rendered components.

### Decision and Room Data Hierarchy

The authored and projected hierarchy is:

```text
decision batch
  -> physical target reference
    -> Room Occurrence
      -> mandatory offer-time leaves
      -> optional picked-room details
```

The batch owns decision topology and selection. A target is the relationship
from one physical exit to one persisted Room Occurrence. The occurrence owns
its game room declaration and room-local state, including its incoming reward
and any local reward leaves. Presentation may place the room and its complete
offer-reward surface together on the decision card without transferring
semantic ownership to the batch or target. An offer surface can be empty,
incoming, or a declaration-owned local group; the selected room remains the
authority for that distinction.

Every structurally owned occurrence must have one reachable control package.
That package may be nested in its decision workbench; it need not appear as a
standalone workspace node. Exact target, occurrence, reward, and room-local
addresses all resolve to that containing inspector and then to their own
interaction.

Mandatory offer-time leaves remain authored and editable for picked and
unpicked rooms. Optional picked-room details become active only when the
authored topology activates the occurrence:

| Occurrence source                 | Authored activation                                |
| --------------------------------- | -------------------------------------------------- |
| Biome start or fixed entry        | active when the occurrence exists                  |
| Linked exit                       | active when the link exists                        |
| Ordinary or takeover batch target | active when selected by its decision               |
| N Hub main target                 | active when present in the authored visit sequence |
| Fixed Boss/Postboss occurrence    | fixed link and ordinary occurrence-local detail    |

Activation is not simulated entry. The workspace carries authored
`detailsActive` separately from evaluated `entered`, so progressive coverage or
an unavailable evaluator cannot erase authored detail ownership. Dormant
optional state is retained and becomes editable again if the same occurrence is
reactivated.

### Lifecycle Room Workbenches and Encounter Phases

A details-active room renders one tabbed occurrence workbench. The application
projection publishes the closed Standard, Fields, Ship, or Shop composition;
React renders that composition without switching on biome keys, room labels,
or lifecycle-profile strings. The ordinary shape is Room Overview, Room
Timeline, and Room Doors. Tabs are transient editor-session state and do not
move semantic ownership or enter authored history.

Room Overview contains read-only incoming-door context and only meaningful
room-local setup. An N main room keeps its parent-owned side-room generation
and visit order there. Fields keeps cage and optional identities there. Shops
keep inventory, conditions, and Purchased markers there. Room features remain
Overview-owned. Room Timeline renders the engine-owned lifecycle timeline and
the one occurrence-owned action chronology; encounter controls attach to their
exact Start encounter boundaries. Room Doors renders the existing total
outgoing-stage product without changing decision, target, or reward ownership.
Empty sections remain absent. One fixed utility slot at the top of each active
tab presents its projected lifecycle Run State: Overview and ordinary Room
Timeline share the entry snapshot, each Ship Timeline tab uses its phase-start
snapshot, and Doors uses the pre-exit snapshot. An inactive Room Timeline
remains launcher-free.

Fixed Boss/Postboss occurrences use the ordinary occurrence workbench and
timeline language. Boss renders the fixed `Room entered -> Start encounter -> Boss
defeated -> End encounter -> Cleanup · Doors open` spine, with Judgment attached
to `Boss defeated` when active. A fixed Postboss renders the shared Room
Timeline product at its exact occurrence owner: required `Use fountain`,
required `Choose keepsake` when replacing, and `Cleanup · Doors open` after the
required action. Its rack and fountain rows are ranked by the engine; React
does not infer action membership or legal positions.

A normal active required action is already ranked when its owner becomes
structurally active. Its row is move-only within engine-published legal
positions: it has neither a Position selector nor a generic Remove action.
Deliberately malformed input that already omits a required action remains
visible as repair state and exposes one direct `Restore required action`
control bound to the engine's canonical late insertion, not a menu of
application-chosen positions. Optional participation and stale-row repair keep
their existing owning controls.

ShipCombat uses Room Overview, Intro Timeline, Combat 1 Timeline, optional Combat
2 Timeline, and Room Doors. Encounter count stays in Overview. Each phase tab
consumes the engine timeline, including its encounter picker and following
wheel boundary; one inactive repair surface retains rows from a dormant phase.
The tabs never create phase-local orders.

The room header is compact orientation and renders only `Entering <room>` plus
cross-tab markers or controls. Room Overview renders the predecessor-owned
offer-reward surface once as compact read-only incoming context: the visible
reward summary, `Hidden`, or `None`. It never rediscovers or edits that reward
from room-local state. Room-feature children likewise render their bound action
directly under `Room features`; they do not add a duplicate Chaos-gate or
Zagreus-contract heading above that action.

For encounter selection, meaningful means a set-backed phase with two or more
declaration-owned choices; it does not mean that two candidates happen to be
eligible in the current evaluation. The control projects the exact
`EncounterPhaseAddress`, selected concrete definition, bound candidate
interaction, marker, and reset intent. React does not inspect a set, evaluate a
requirement, or decide whether a phase terminates another phase.

A singleton set remains a semantic phase owner with an exact marker and focus
destination, but it does not produce a one-option picker or no-op reset button.
If its retained selection has a phase-owned finding, the containing Encounter
section shows it as read-only diagnostic information. Empty placeholder
sections are not rendered merely because a room has potential detail state.

An active invalid phase remains visible and correctable even when an upstream
evaluation prefix is blocked. Conversely, a structurally dormant phase retains
its authored selection without a control, candidate, finding, history, or NPC
row. This is an activation rule, not a validity-based visibility rule.

The route NPC index is read-only. It groups resolved standard NPC definitions
by declaration-owned `npcPresentationKey` and navigates to the exact phase in
its containing inspector. The grouping never selects candidates, defines
history, or creates an NPC-specific authoring path.

## Structured Workspace Presentation

The primary editor presents a route rail, one shared biome-structure region, and
a focused semantic inspector. This is a structured projection over the unified
workspace envelope, not a graph canvas or a second serialized UI tree.

For ordinary biomes, the structure rail is an outline of authored decision
points rather than an exhaustive entity index. Each decision appears once with
its decision label and semantic assessment. When exactly one target is
authored as selected, that stop navigates to the continuation occurrence stage
and may also carry the selected room label; when that room has one direct,
compactly displayable reward, it carries a structured reward token as well.
These are authored-selection context, not a claim that simulation entered the
room. The predecessor occurrence stage retains the complete outgoing-door
surface with room selection, reward selection, and picked state together.
Generated unpicked targets remain fully inspectable in that decision surface;
their rewards still participate in sibling, bag, source, and possibility
evaluation. For N, the center region remains the fixed Hub ranked board with
its explicit visit-prefix cutoff rather than a false ordinary spine. Its fixed Opening and
PreHub stages and authored Hub visits may each show the same read-only primary
reward token when their room declares one; Ephyra side-room offers never become
an aggregate rail reward.

Rail inclusion controls visual prominence and navigation only. It does not
control whether a semantic owner, authored value, finding, or editor exists.
Occurrence, target, reward, retained-invalid, and room-local products remain in
the exhaustive workspace projection even when they do not receive independent
rail stops.

The structure projection consumes authored topology plus progressive or
canonical evaluation. Only a complete-valid biome is described as canonical.
Complete-invalid and incomplete results use the same authored-first projection
with an optional reached assessment overlay when coverage exists; their
coverage frontier, retained later authorship, and blocked or unassessed regions
remain visibly distinct.

A configured empty biome may show a read-only declared outline around its live
frontier. Fixed-count layouts may show exact remaining stages; variable layouts
show only a truthfully projected completion horizon or state that length varies.
The UI never derives an expected route length or interprets force rules locally.

`STRUCTURED_EDITOR_WORKSPACE.md` owns the concrete route-rail,
ordinary-decision, Hub, inspector, coverage, empty-outline, prompt-removal,
and repair presentation contracts.

## Rows Versus Domain Language

Rows, cards, lanes, graph nodes, and columns are valid UI concepts. They do
not enter authored state, canonical snapshots, history, or findings.

The UI may produce a decision-card series for F and a Hub-oriented surface for N
while both consume the same semantic ownership conventions.

Room components use the persisted domain `occurrenceId` as their React key.
Structural components without a room occurrence use their stable semantic
address. The UI does not invent a second occurrence identity.

## Topology Editing

All topology edits dispatch commands from `AUTHORED_PROJECT_MODEL.md`.

Room replacement uses one grouped contextual picker:

```text
Combat
  Combat 03
  Combat 06
Miniboss
  Shadow-Spiller
```

Room kind is transient grouping and search vocabulary, not a required first
selection. An authored target is one stable Room Occurrence whose current
selection is a concrete `gameName`. Choosing a concrete replacement dispatches
one atomic `ReplaceOccurrenceRoom` command and preserves its `occurrenceId`.
The command retains declaration-bounded compatible room-local leaves; React
does not decide which values survive or dispatch follow-up resets. Contextual
support, grouping, zero/one-candidate behavior, and selected-invalid retention
are defined in `CONTEXTUAL_EDITOR_UX.md`.

Creating a previously absent target allocates an occurrence ID and installs
the declaration's complete offer-time defaults in the same semantic command.
If it is also picked, the command installs any required entry-time defaults.
Once that target exists, its ordinary selector has no empty value. Its game
name can be replaced, while the occurrence itself can be removed only through
an explicit owning structural command.

Selectors do not hide a game name merely because another occurrence already
uses it. Repeated game names are legal authored structure; creation caps,
appearance caps, and eligibility are simulation results.

Picked continuation should use a single-choice interaction visually aligned
with physical exit targets. Radio semantics are appropriate because exactly
one target continues. A single-exit decision may select its newly specified
target in the same semantic command group.

F/G/H/P takeover Preboss batches use the same normal-exit language. They
create one Preboss occurrence per eligible physical exit, with the
declaration-owned Shop or Free Reward role aligned to that exit. Selecting the
entered Preboss target is ordinary exit-selection topology; the editor does not
add a second entry-mode selector. O/Q use a declaration-fixed width-one Preboss
batch, while N exposes its fixed width-one Preboss Shop only through the
completed-Hub handoff in `HubDecisionWorkbench`.

I keeps its post-goal preboss and ordinary peer in one decision card because
they are one game batch. `Add Next Decision` is I's only frontier-advance
action: before Goal completion it derives a Goal on the first exit, and after
Goal completion it derives `I_PreBoss02` there. A second exit, when present,
renders an ordinary room leaf. Both targets are directly pickable through the
same single-choice interaction. Picking the Preboss visually closes the biome,
while picking the peer exposes its downstream decision. I never renders a
separate Preboss action because its Preboss is a generated peer in the same
ordinary decision.

Shop editors follow the shared entry-materialization rule. An unpicked shop
target renders as a dead leaf without requiring or exposing shop inventory.
Picking it atomically installs the profile's complete defaults when absent and
exposes its shop editor. Switching the pick away may retain those values
dormantly, but the editor hides them because they produce no current game
facts. Incoming and free-reward editors remain visible on unpicked targets
because those offers materialize on their doors.

An Anomaly-capable G target exposes one bound `Replace with Anomaly` action on
the target card, including unpicked and finding-backed targets. The resulting
occurrence retains its reward editor and exposes its map, authored success,
and exact revert action. Fixed `GeneratedAnomalyB` remains a catalog and
lifecycle fact rather than a redundant editor control. On the selected spine,
the outgoing host continuation is an ordinary width-one decision: its concrete
target and reward remain editable while its selection is declaration-derived,
so React adds neither a player branch selector nor a special return control.

A selected, details-active declared Midshop with materialized Shop state
exposes the bound Zagreus Add action from its Room features. Once authored,
the same feature surface exposes the corresponding Remove action. The persisted
contract remains a sibling continuation in the containing decision, where the
normal lane and fixed `C_Boss01` card are independently inspectable and
selectable. Findings never hide an already-active selected source control;
unpicked Midshops have no active contract control. `C_Boss01` uses the same ordinary
width-one continuation presentation. React supplies no eligibility, topology,
reward, or return policy.

A selected, details-active N/F/G/P room with declared natural-Chaos capability
exposes one bound Add action in Room features. Once authored, the same feature
surface exposes its bound Remove action. Adding an optional room-local
gate configures the current room and is not itself a peer of the primary
route-navigation choice. Once authored, however, the gate is a genuine
sibling continuation in the containing decision, where the normal lane and
concrete Chaos room are independently inspectable and use the same single-choice
interaction. The Chaos card exposes its declaration-owned map domain and fixed
encounter and reward facts without inventing editable fixed leaves. Invalid
active gates retain those controls. Selecting
Chaos publishes its downstream continuation as the ordinary next-step frontier.
React supplies no source, spacing, depth, map, reward, or return policy.

A materialized Shop preserves declaration order for inventory rows while
deriving `Purchased` membership from exact `interactShopOffer` references in
its one occurrence-owned `roomActions.order`. Each inventory row exposes only
that membership toggle; Room Timeline owns ranked move controls over
participating purchases. It uses the same ranked-prefix presentation as the
other room actions: numbered participant cards, compact arrow controls, and
pointer reordering. Unpurchased initial offers remain editable in Overview and
do not appear as active or generic repair rows in Actions.
Membership changes are structural set edits and do not activate chronological candidate evaluation;
the same rule applies to declaration-produced pickup and Fields interaction
checkboxes. Candidate support is evaluated only for move proposals; impossible positions remain visible
with their evidence, and a selected invalid order remains editable for repair.
Per-offer Shop-purchase markers and finding destinations remain stable. A stale
base purchase repairs through the same Purchased interaction, including after
room replacement removes the active Shop owner; it never gains a second generic
remove control. An individual purchase or generated-pickup failure remains
owned by its exact action or acquisition-entry address.
The Shop inventory row remains the sole editor for what was bought. Its
Room Timeline row may edit acquisition-time trait, Pom, or disposition children,
but cannot change the purchased reward identity. A producer-owned pickup retains
an outer reward editor only when its payload remains authorable. A declaration-
fixed Narcissus pickup has no false identity picker, while an unresolved Blind
Box payload remains editable on its canonical Room Timeline row.
The Timeline action title names the stable pickup interaction and does not change
when Time Piece or Artificer is selected. That acquisition disposition is shown
separately as `Pickup outcome`; trait and Pom launchers share one aligned compact
trailing control strip and one unspecified/invalid/valid color language. Every
Timeline action reserves the same compact deletion slot: an engine- or
interaction-projected removal is red and enabled, while required actions and
Overview-owned participation remain visibly grey and disabled.

Every generated I preboss offer is a distinct Room Occurrence and follows that
same contract; it does not introduce an I-specific shop mode.

A declaration-produced optional pickup uses the same Room Timeline chronology
as a Shop purchase: membership and position come from the exact action
reference, while the pickup row owns any reward, trait, or Pom repair controls.
The Story or other producer control owns only the source choice. React never
derives produced items from a selected trait key and never nests acquisition
children inside the producer's trait dialog.

Travel Deal and Gold Gold Gold source selection remains chronology-derived.
Overview does not add a source selector or generated-payload approximation.
Any future presentation that authors their dependent payload must consume the
candidate frontier at the exact triggering action prefix; Shop-entry history
and a first-purchase slot alone are insufficient when earlier same-room actions
can change eligibility.

An I combat target renders its derived Goal marker instead of a reward editor
when the current simulation resolves Goal. Its complete potential Tartarus
reward remains dormant in authored state. When an upstream edit makes that
same occurrence NonGoal, the editor exposes the retained reward value; it does
not install a new default or ask the user to author Goal versus NonGoal.

Generated continuation is direct rather than a persistent `Next Step` mode.
When a selected room directly precedes the next generated decision, the room's
outgoing section already renders the ordinary empty door workbench. This is a
pure projection, not a phantom authored decision. Its first reward-store,
Fields-outcome, ordinary-room, or takeover edit dispatches one complete atomic
command. React neither reconstructs the command nor chains decision creation
with another edit, and one undo returns to the provisional cards.

The provisional frontier and an authored empty decision use the ordinary
decision layout immediately. Their Door 1
Room picker offers the declaration-supported ordinary room choices and, where
the source admits it, a takeover Preboss choice. Selecting an ordinary room
(including I's `retainNormalPeers` Preboss) creates one target. Selecting a
`takeOverNormalDoors` Preboss dispatches decision-owned atomic creation at an
uncommitted frontier or atomic replacement for an authored envelope. The
shared picker does not flatten their
ownership: Door 1 remains target-addressed, while takeover evidence and its
intent remain decision-addressed.

An empty envelope may be the declaration-admitted terminal decision after the
ordinary progression bound. That still presents the same Door 1 picker; it is
not a separate Preboss authoring card. Ordinary setup can explain why an
ordinary room is unavailable, but neither setup nor findings hide a supported
takeover option. Fixed linked transitions and N's completed-Hub handoff remain
their own declaration-owned controls.

There is no generated `Add doors`, `Add Preboss doors`, `Check Preboss rooms`,
or navigation-only `Go to next step` action. An existing populated ordinary
batch does not expose retroactive conversion to Preboss. An authored takeover
batch continues to expose its exact reconciliation action when it needs
repair.

The shared decision presentation and variant-owned action sets are recorded in
`../audits/editor/EDITOR_UX_AUDIT.md`. React may share the container, but
it does not reinterpret takeover, mixed, declaration-fixed width-one, or
completed-Hub Preboss semantics.

### Room feature presence and resource placement

Room-feature controls consume one application-projected presence state. A room
without declaration-owned support omits the control; a supported absent feature
is unchecked and enabled only when its exact engine assessment permits the
authoring command, otherwise it remains visible and disabled; an authored
optional feature stays checked and removable even when its retained state is
currently invalid; and a game-forced feature is checked and locked. React
renders this closed state and does not infer support, chronology, spacing, or
forced status from room or route data.

Resource controls remain checkbox-based, but their labels describe the selected
successful outcome: `Successful Mining — Fire`, `Successful Spirit — Air`,
`Successful Seed — Earth`, and `Successful Fishing — Water`. The application
projection obtains each element from the selected room declaration's
`resourcePointSupport.rules[family].element` and combines it with the existing
family vocabulary. The Resources heading carries the inline note: `Each
successful element outcome can be placed once across the route.`

An absent resource uses the existing add command, an authored resource at its
current room uses the existing remove command, and another legal room uses the
existing replacement command as a move. Only that move row includes a second
column identifying the current placement and linking to that occurrence.
Illegal targets remain disabled. No confirmation dialog is needed; one semantic
edit and ordinary Undo provide the mutation safety contract. React renders the
projected destination and never searches the authored route for it.

## Downstream Editing

Upstream replacement retains downstream state whenever the semantic structure
can remain represented.

The UI must visibly represent overflow targets after exit-capacity shrink. It
does not detach, hide, or auto-delete the picked continuation. The repair flow
is:

1. show retained unavailable targets and the associated structural finding;
2. require the user to choose an available picked exit;
3. re-anchor an ordinary continuation or Preboss realization through
   `SetExitSelection`;
4. enable an explicit Remove Unavailable Exits action;
5. reconcile only after the user invokes it.

Restoring capacity before reconciliation restores those targets as available.

In-project authored commands execute immediately when the user invokes an
explicitly labeled action. Commands that remove existing authored structure use
the red danger treatment as a visual affordance only: adding, changing, and
removing all create one semantic-command history entry and share Undo/Redo
recovery. The UI does not persistently display projected deletion scope. The
command layer, not React, defines the actual deletion scope.

Semantic action styling is an explicit React/CSS convention rather than a
generic button abstraction. A local scope has at most one Primary command: the
commit or forward action such as Save, Start biome, or Open next room.
Secondary commands make reversible supporting changes such as adding,
restoring, or rarifying. Quiet commands cover dismissal, navigation, history,
ordering, and low-emphasis local-draft cleanup. Danger commands remove authored
structure or replace or discard a project or recovery snapshot. Green remains
status language; it is not a second forward-action treatment.

Every production button carries either one of those four command treatments or
a named specialized-surface class. Contextual-picker triggers, tabs, rail and
completion nodes, semantic focus links, findings, trait and timeline launchers,
and icon-only ordering controls keep their specialized interaction treatments.
An architecture test guards explicit classification; semantic correctness
remains a review responsibility. Shared action rows only arrange co-located
controls (danger actions before a right-aligned primary continuation on wide
screens, in the same DOM order on narrow screens); they do not alter the
command, history, recovery, or confirmation contract.

## Room and Reward Editors

Room editors are selected by room template and receive:

- immutable declaration and labels;
- current complete offer-time state and any active entry-time state;
- semantic replacement callbacks;
- room-local findings and candidate results;
- immutable topology context only where the template genuinely requires it.

They do not receive mutable biome topology.

After a room replacement, its inline offer card renders the reconciled authored
snapshot: compatible incoming and local values remain selected, new or
structurally incompatible leaves show replacement defaults, and leaves no
longer admitted by the declaration disappear. A retained value that is
context-invalid displays ordinary finding and candidate guidance at its stable
leaf address. The room selection remains one undoable command; the editor
performs no secondary repair or confirmation step.

Compatibility is limited to catalog-backed production leaf contracts. The
current replacement surface covers counted rewards plus H cage and O wheel
members; fixed, shop, and Ephyra values receive replacement defaults. Preboss
Shops remain topology-owned roles, independent of ordinary midshops.

The declaration-bounded compatibility rule belongs to
`AUTHORED_PROJECT_MODEL.md`.

Reward composition remains bottom-up:

```text
payload domain
  -> reward type and complete resolved-offer default
  -> counted store domain or fixed binding
  -> batch-resolved reward offer / shop / room-local offer point
  -> room template
```

A parent selection immediately installs the selected child's complete declared
defaults. The UI never commits an intermediate empty payload or reward.

Reward type and payload project through one compact compound picker. A
payload-free reward commits immediately; Boon advances to one source choice;
Devotion advances through chosen and spurned sources. Partial picker progress
is transient session state, and only the complete `ResolvedRewardOffer`
dispatches one semantic replacement command. The contextual store, sibling,
bag, and source rules are defined in `CONTEXTUAL_EDITOR_UX.md`.

Blind Box deliberately exposes its intended eventual Boon source as planner
intent even though the in-game shop hides that result. The editor labels it as
an eventual result, not as visible shop information. An unpurchased box retains
the complete source payload dormantly; contextual validation does not require
that source to be possible until purchase.

Every ordinary generated decision projects its store according to policy. Its
physical offer cards place each room selector beside that room's resolved reward
editor, including for unpicked offers. An `authoredBaseStore` batch renders one
batch-owned `Reward Pool` selector for
its `baseRewardStoreKey`. A new authored selector displays an explicit
unresolved placeholder and keeps dependent room controls inactive until one
semantic replacement command selects the pool. A `sourceOfferPoint` batch
renders that store only at its owning room-local offer point; the outgoing
batch may show derived provenance but exposes no second editor. A `none` batch
renders no placeholder store field. Each target room then renders only its
resolved-offer editor. A declaration-forced target may display the derived pool
as read-only context, but it does not gain another persisted store selector.
This keeps batch, declaration, and leaf ownership visible in the UI.

O gives its non-ShipCombat `authoredBaseStore` selector the product label
`Next store roll`: it remains the one authored `ChooseNextRewardStore` outcome,
not a claim that every selected target draws a visible reward from that bag.
For every O normal target, the application projects one read-only target-card
consequence from the canonical incoming reward, resolved store provenance,
declaration-owned producer, and any forced store. React renders that complete
product without inspecting O game names, reward keys, declarations, or store
policy. ShipCombat says that it has no incoming reward and the outgoing store
is discarded; Miniboss and Devotion show their forced RunProgress Boon or
Devotion; Reprieve says its reward is drawn from the resolved RunProgress or
MetaProgress store; and Story, Midshop, and Preboss Shop show their fixed
identity plus the resolved RunProgress or MetaProgress provenance that counts
as entered-store history. An unavailable or retained-invalid target publishes
an explicit unresolved consequence instead of a false store claim. A Ship
source has no outgoing selector: where relevant, its consequence identifies
the store as derived from the final active wheel, whose existing wheel control
is the only editable authority. These statements augment their existing reward
editors and never become addresses, candidates, findings, or a second reward
control.

Replacing the batch reward pool retains every target reward. Candidate and
selected-plan validation mark a retained reward invalid when its newly resolved
store cannot produce it; the editor does not reset it. The UI never displays
probability percentages, likelihood scores, or warnings for merely unlikely
but possible outcomes.

An H ordinary batch has no Reward Pool selector because its observable rewards
use declaration-owned RunProgress bindings. It instead renders one batch-owned
Fields door-roll selector with Min and Max semantic values. The view shows the
derived per-door cage count and current two-Max ceiling as read-only context,
but persists neither. A new decision displays `Select roll` until one explicit
selection replaces the unresolved state. A special-only batch keeps the
selector visible because a Max result still affects later rolls, while
explanatory copy makes clear that the current targets do not consume the Fields
multi-cage count. Each combat occurrence renders its three room-owned cage
values in its complete projection product; the batch projection marks only the
derived active prefix as participating. The editor renders that active prefix
only, while retaining a dormant third authored value so it reappears unchanged
when a later Fields result activates it. Active cage rewards are mandatory room
structure and render directly on the room surface for picked and unpicked
targets. Concrete encounter identities render in the direct Encounter section.
A non-combat target renders
no cage editor, and deferred
`FieldsOptionalRewards` render no controls.

An O ShipCombat occurrence renders one encounter-count selector and both
declaration-bounded reward wheels in its complete projection product. The
selected two- or three-phase value marks `wheel2` dormant or active without
deleting its retained state. The editor renders active wheels only, so a
dormant wheel reappears unchanged when the third encounter phase is restored.
Encounter count and active reward wheels are mandatory room structure. The
application groups the active Ship envelope as Intro, Combat 1, and optional
Combat 2 from declaration-owned phase/wheel attachments plus engine-owned Room
Action windows. Each group renders its Encounter, wheel structure when present,
and its view of the single global Room Timeline chronology. A reward-wheel
structural editor appears in the phase immediately before the combat named by
its declaration-owned `encounterPhaseKey`: Wheel 1 under Intro and active Wheel
2 under Combat 1. Its choose and pickup actions remain grouped by their own
engine windows rather than by the editor's structural placement. Ranks remain global,
and every active row and checkpoint appears exactly once under its active
phase. A retained action owned by a now-dormant Ship phase appears exactly once
in the Ship repair surface outside the active phase groups. Semantic focus
targets the already-rendered exact control.
Each rendered wheel owns its Run/Meta store, active offer count, ordered
maximum-capacity offers, and one picked active offer. The editor renders only
offers marked active by that complete projection product. Reducing the active
offer count hides the surplus offer editors without deleting their authored
values; restoring the count reveals those values again. The picked index
remains constrained to an active offer.
Within one active wheel, its offers render as simultaneous offer cards: one
active offer fills the available row, while two render as equal sibling columns
and collapse to one column in a narrow container. The cards may share the
compact exit-card visual language, but they are not exits: they render no door
number, exit selection, room state, or topology action. A read-only selected
marker may reflect the current picked index; the sole interactive `Picked
offer` control remains at its exact wheel acquisition action on the Room
Timeline. Wheel 1 and Wheel 2 remain separate sequential phase sections.
The outgoing decision exposes no duplicate store selector because its
`sourceOfferPoint` policy derives from the last active wheel. The editor
dispatches only ship and reward-wheel semantic commands and does not encode
phase timing.

Display labels remain separate from persisted game identifiers:

```ts
interface LabeledGameValue {
  gameName: string;
  label: string;
}
```

Selectors render labels. Authored state persists stable semantic/game keys.
Internal names such as `AresUpgrade` must not leak into player-facing text
when the declaration provides `Ares`.

## Findings and Feedback

The simulator returns semantic findings. The application indexes them by
owner address and projects them into UI destinations:

| Semantic owner          | Presentation                           |
| ----------------------- | -------------------------------------- |
| Biome                   | biome status and findings summary      |
| Start                   | start selector marker                  |
| Parent batch            | decision card and batch marker         |
| Batch reward store      | decision Reward Pool selector          |
| Batch policy state      | policy-specific batch selector         |
| Parent plus exit index  | target selector or physical exit       |
| Picked continuation     | single-choice surface                  |
| Preboss batch / handoff | batch, handoff, and realization        |
| Preboss target          | physical exit and selection            |
| Mixed Preboss target    | target row and biome-completion marker |
| Room occurrence         | room editor                            |
| Occurrence plus slot    | local reward/child editor              |
| Reward wheel            | wheel count, store, and picked offer   |
| Reward wheel offer      | ordered wheel reward editor            |

Finding resolution is direct lookup. It never scans rows for a matching game
room name.

The visible `Findings` panel is route-scoped: an active route tab lists only
that route evaluation's findings, across its configured biomes. Settings has
no Findings panel. Project and route status summaries may still expose
aggregate counts, but they do not turn Settings into a diagnostic destination.
If a future project-owned finding is introduced, it requires an explicit
presentation destination rather than falling back to Settings.

Context-invalid authored values remain visible and are decorated.
Declaration-impossible values may be absent. Contextual pickers ordinarily
omit unselected impossible values while keeping them inspectable through an
unavailable disclosure. Before contextual candidate simulation is available,
selectors show stable declaration-derived domains without pretending they are
validated. `CONTEXTUAL_EDITOR_UX.md` owns the detailed presentation policy;
simulation continues to own support and exclusion reasons.

The active biome consumes progressive evaluation coverage from
`SIMULATION_AND_VALIDATION.md`. A missing downstream decision or Preboss batch
does not suppress findings and candidate support for an earlier covered owner. The
page renders that one atomic prefix result; it does not request or assemble a
separate partial history.

Published validation stops at the first blocked atomic region. Every co-owned
finding there and the exact repair interaction remain navigable, while later
findings and candidate context remain unavailable. If an earlier reached value
is invalid and authorship is also incomplete, invalid presentation takes
precedence without hiding the later authored frontier.

Later biomes blocked by an earlier incomplete or invalid biome remain visible
and editable. Their contextual validity is unavailable because the required
history does not exist. The view should communicate that state without
inventing local errors.

## Undo and Redo UX

Undo/redo applies to semantic authored commands. One visible user intent is one
history entry, including compound default installation.

Expected examples:

- replacing a room is one undo step;
- selecting a reward type and installing its complete offer payload is one undo
  step;
- removing a decision and its downstream topology is one undo step;
- clearing a biome is one undo step;
- navigation and panel expansion are not undoable project edits.

The command history may later power an edit log, but the initial product needs
only reliable undo and redo.

## Project and Session State

Persisted project state includes semantic authored choices only.

Session state may include:

- active route and biome;
- selected room or finding;
- inspector tab;
- panel expansion;
- selector category and search text;
- zoom or viewport if a graph projection is introduced;
- an exact open Run State semantic owner—decision-generation or room-lifecycle
  checkpoint—and its local disclosures.

Session state must never be required to reconstruct the authored project.

After every effective authored-project publication, application coordination
reconciles transient semantic navigation against that publication's findings
and exact workspace destinations. A finding selection whose exact finding no
longer exists clears independently from a semantic focus whose owner no longer
has a destination. Reconciliation never chooses a replacement owner, changes
the current route or panel, or enters authored history. A finding that remains
live without an exact workspace destination is a workspace-projection contract
failure, not ordinary stale session state. Native keyboard focus remains a
local React concern and is not reconstructed from this session cleanup.

An open Run State target is reconciled against the newly published set of
available snapshot owners. If its exact decision-generation or lifecycle-
checkpoint launcher or snapshot disappears, it clears rather than rehoming to
another owner. Route, panel, and semantic navigation also close the read-only
sheet. Opening and closing it publish no authored command, persistence value,
undo entry, candidate-session preparation, or project evaluation; the editor
reads its already-published workspace product.

## Profile Files, Autosave, and Dirty State

The user-facing project lifecycle has one explicit file workflow:

- **New** creates a fresh project;
- **Save Profile** writes the normalized `ProjectDocument` through the
  platform profile-file adapter;
- **Load Profile** decodes one selected profile file and replaces the project
  only after the entire document passes catalog validation.

Local Save/Load and Export/Import are not retained as two public persistence
concepts. Browser Save Profile uses a
download and Browser Load Profile uses an upload. A later desktop host may use
native file dialogs through the same application contract. The application
profile session remembers the basename returned by Load Profile and reuses it
for later saves. New and recovery-only startup have no filename, so Save
Profile suggests `run-plan.runplanner.json`. The filename never enters the
authored document, undo history, or dirty-state comparison.

Explicit profile replacement is atomic: successful load resets undo/redo,
runs one fresh simulation, installs the loaded document as the clean baseline,
and then queues recovery autosave. Cancellation is a no-op. Decode failure
leaves the current project, history, evaluation, and clean baseline untouched.

Autosave is a distinct recovery channel, not an implicit Save Profile action.
It observes effective authored changes only and is debounced. Navigation,
finding selection, panel state, and simulation publication do not trigger it.
Autosave failure is presented without blocking continued editing.

The visible dirty state follows the normalized authored document rather than
an imperative flag:

| Action                      | Explicit profile baseline | Resulting status               |
| --------------------------- | ------------------------- | ------------------------------ |
| New                         | none                      | Unsaved                        |
| Save Profile succeeds       | serialized snapshot       | Clean only if still equal      |
| Semantic edit               | unchanged                 | Dirty if unequal               |
| Undo/redo                   | unchanged                 | Clean exactly when equal again |
| Load Profile succeeds       | loaded project            | Clean                          |
| Restore autosave at startup | none                      | Recovered / Unsaved            |
| Autosave write              | unchanged                 | No dirty-state change          |

On startup, a valid recovery document is decoded through the same catalog-aware
project boundary and receives a fresh history and simulation.
If recovery is corrupt, the editor opens a safe new project, reports the
failure, preserves the raw recovery value, and suspends further autosave. The
user may explicitly Discard Autosave, or successfully load a profile, to clear
that blockade. The app must never overwrite corrupt recovery merely because a
blank fallback project booted successfully.

## Graph Policy

Do not begin with a freeform graph canvas. Ordinary decision topology and Hub
topology have stronger semantic structure than arbitrary nodes and edges, and a
structured editor is easier to make readable and accessible.

The structured workspace in `STRUCTURED_EDITOR_WORKSPACE.md` is the primary
authoring surface. A later graph remains an optional overview projection rather
than a prerequisite for showing the picked path or Hub visit structure.

React Flow may later provide:

- an overview projection;
- pan and zoom over large plans;
- visual branch inspection;
- navigation to a selected decision.

It must consume semantic topology. Dragging a node may change transient layout
only unless a separately designed semantic command exists.

## Accessibility and Keyboard Interaction

Use standard accessible primitives for tabs, dialogs, comboboxes, radio
groups, menus, and tooltips. The editor should support:

- full keyboard traversal of decisions and controls;
- typeahead/search for room and reward selectors;
- visible focus state;
- labels independent of color;
- labels that clearly name removal actions without relying on color alone;
- navigation from a finding to its semantic owner;
- predictable undo/redo shortcuts.

## Trait Offer Presentation

Trait offers are projected from reached engine evaluations, never recomputed
in React. A room/reward summary, the chronological route Traits panel, and a
finding destination all reference the same `TraitOfferAddress` and bound
interaction. The shared modal renders the one to three materialized option
rows, their selected option, and contextual trait pickers, or the mutually
exclusive Fallback Gold outcome. When fewer than three dependable ordinary
boons remain, engine-projected controls may add or remove only a trailing
optional Duo/Legendary outcome; otherwise the shape controls are absent. The
engine likewise owns fallback availability and the supported draft for
returning to traits. Selectable-rarity traits receive a contextual rarity
picker; declaration-fixed Duo/Legendary traits retain their rarity as read-only
text, while rarityless NPC and Hammer rows omit rarity entirely. Giver
labels, selected trait labels, contextual support,
and findings are presentation products derived from catalog and engine outputs.

The same surface presents an active Selene `SpellDrop` as `Edit spell`: three
rarityless rows and no fallback, sparse, rarity, replacement, target, or
god-pool controls. It still binds the existing complete `ReplaceTraitOffer`
semantic edit and exact finding destination. Opening the dialog does not
evaluate a candidate domain; focused editing invokes the already-bound engine
capability lazily. Aspect of Selene instead owns its frozen Sky Fall tree in
the route loadout; its later Spell Drop has no trait-offer child, control, or
missing-offer finding. The ordinary rows expose their position-owned Path of
Stars bonus as Crescent, Half, and Full Moonglow for the first, second, and
third slots respectively, and the launcher summarizes the selected spell and
its fixed slot.

First-Olympian composition findings use the same `TraitOfferAddress` and
existing finding presentation path. The editor adds no mode or persisted state:
whether the rule applies comes from the engine's selected-offer assessment
published through coverage. Alternative assessment remains behind the exact
bound replacement interaction. The editor neither reads nor reconstructs
pre-offer histories or contexts and does not rerun selected-path evaluation.

The same modal presents an engine-derived Olympian replacement as an option
annotation with its exact old trait, slot transition, and promoted rarity. The
application binds address-scoped candidate evidence and React renders it; the
editor does not infer occupied slots, rarity promotion, replacement limits, or
eligibility. Structurally supported but context-invalid rarities remain visible
for repair, while Heroic is offered only when the engine exposes an
Epic-to-Heroic replacement.

An active Aspect-of-Persephone row may also present the engine's bounded
Persephone contribution picker and the derived effective level beside the
effective-rarity evidence. The picker offers the exact active integer range
(`+0..+5`, or `+0..+8` after a prior Premium Service acquisition). An omitted
authored value is displayed and settled as `+0`; selecting zero removes the
optional persisted detail. The application writes the complete trait offer
through the existing semantic replacement intent and does not calculate the
level, inspect history, or let a same-screen Premium Service selection alter
sibling or Concave Stone rows. Context-invalid explicit values retain the
focused engine finding for repair.

When a declaration-owned option targets another equipped trait, the same row
renders a generic engine-backed target picker. Catalog labels present the exact
target domain; a missing or stale selected target remains visible for repair
and keeps Save disabled. React does not infer a target, traverse equipped
history, or switch on Bridal Glow, Latest Model, Icarus, or Hammer names.

Natural Selection reuses the existing selected-trait compound-outcome language:
one complete ordered target sequence is edited beneath the selected option and
saved through the ordinary `ReplaceTraitOffer` command. The engine capability
decides the next legal round-robin position and whether a short sequence is
complete; React does not derive target exclusion or early exhaustion. Ransom
offers render a read-only engine-derived removal/level preview with no
persisted result or editor. Steady Growth renders a fixed automatic timeline
effect with the existing contextual target picker; it is not a Pom, a Room
Action, or a draggable/removable authored effect. The distinct
`previouslyPicked` finding uses the normal trait-offer feedback path.

Run State presents Steady Growth's derived progress and rarity interval from
the equipped trait ledger; React does not count checkpoints or predict future
thresholds.

Picker activation evaluates one focused option domain with every materialized
sibling held fixed. Sibling findings therefore remain visible in the complete
feedback panel without falsely disabling unrelated focused repairs. Trait and
rarity selection changes only the local complete draft; Save still dispatches
one `ReplaceTraitOffer` command and creates one authored undo entry. An
unassessed option remains selectable, an impossible alternative remains
inspectable but disabled, and a selected impossible value remains pinned until
the user repairs it.

The editor never derives the ordinary/high-tier/replacement domains, sparse
fill, or Fallback Gold availability. A fallback outcome has no rarity,
targeted-acquisition, Circe, Death Defiance, or selected-option child, and the
modal does not render those controls until the engine supplies a trait draft.

Trait dialog visibility and focus handoff are UI-session state. Opening from a
room, Shop, route Traits row, or semantic finding does not enter authored
history or undo/redo. Escape first dismisses an open nested picker and restores
its trigger; a later Escape may dismiss the dialog and restore its launcher.
The route projection groups branch evidence by semantic
owner while preserving engine chronology; it does not create a route-wide
trait model. Dormant descendants remain withheld until their parent lifecycle
reaches the role, and invalid reached offers stay editable with their exact
finding.

Circe uses the same trait dialog and one selected-option child control. Red
Citrine shows one engine-derived inactive Arcana picker, Lapis shows an
engine-derived unordered bounded multi-select of active non-Heroic cards, and
Black Night shows one engine-derived removable active Vow picker. Switching a
draft between direct and effect-backed options must immediately project the
corresponding child without reopening the dialog; dormant authored detail is
preserved by the engine. React does not calculate target eligibility, manually
active Arcana cost, Fear totals, or Circe removal policy.

Route settings own the starting loadout controls: manual Arcana toggles and
declaration-bounded Fear ranks. The engine supplies current starting Grasp
cost/capacity and assesses each proposed Arcana toggle or Void rank; React only
disables proposals that the engine rejects. Ordinary automatic Arcana
indicators and the derived Fear total are read-only engine products. The same
workspace exposes a reached Judgment completion control only at its exact
fixed Boss occurrence; there is no route-level Judgment editor. The fixed
Boss and Postboss entries in the completion outline are selectable inspector
destinations, so a completed Judgment result remains reopenable after its
finding disappears. The Judgment picker renders one Arcana choice per row.

Run State presents the engine-folded banned-trait labels and Forfeit's
current-biome inactive, available, or consumed status. React neither accumulates
unselected Denial options nor infers Forfeit eligibility from rendered rooms.

The existing trait-offer surface presents the engine's generic
`rarityRollUnavailable` finding as ordinary option feedback. A retained
authored value remains visible and repairable when its exact room, generated
item, Arcana, or active-Proper context makes that fresh rarity impossible;
structurally unsupported values continue to use `freshRarityUnavailable`.
Contextual picker availability comes from the bound candidate artifact, so
React does not calculate percentages, inspect Proper Upbringing, infer
Miniboss or Shop context, or introduce an activation control or special panel.
Run State may show the engine-derived `Proper Upbringing active` status, but it
does not display a global rarity ledger.

## Initial F Editor Acceptance

The first usable editor slice is complete when a user can:

- create or load a project;
- configure the Underworld prefix through F;
- select an F opening;
- add decisions and choose one or more physical targets;
- select one concrete base reward pool for every generated decision;
- select the picked exit;
- edit every referenced F room's supported reward state;
- terminate through the F preboss model;
- retain downstream decisions across compatible upstream replacements;
- see incomplete and invalid findings at semantic owners;
- undo and redo every semantic edit;
- save, reload, and reproduce the same authored project and simulation result.

The slice need not have Tauri packaging or game export.

## Rejected Editor Shapes

Do not introduce:

- topology mutation through arbitrary object writes;
- empty sentinels for existing room or reward selections;
- UI-local eligibility rules;
- per-room store selectors that compete with batch store authority;
- probability or likelihood decoration for valid possible choices;
- findings keyed by rendered index;
- a second serialized UI tree;
- hiding a currently authored invalid choice;
- automatic surviving-exit selection;
- graph coordinates as domain topology;
- a large generic form generator that obscures room semantics;
- parity with the old ImGui layout as a goal in itself.
