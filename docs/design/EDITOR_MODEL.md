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
outgoing store from a source wheel, and Q owns no ordinary base store. N
projects its fixed Hub board rather than an ordinary batch. All variants use the
same semantic command and finding ownership rules.

## Application Shell

The initial shell should preserve the useful high-level navigation proven by
the ImGui prototype:

- one horizontal tab per catalog route, followed by Settings;
- route-local biome navigation;
- a route settings panel;
- one shared biome structure workspace;
- a route status and findings surface;
- one focused semantic inspector.

The exact desktop composition may evolve. Tabs and panels are presentation,
not project identity.

Route and panel navigation is one generic UI-session model. The active route
is a nullable catalog route key, where `null` selects Settings, and each route
retains its selected biome key or route-overview selection independently.
Application state and React composition do not define separate Underworld,
Surface, F, G, or other route-specific navigation fields. The ordered route
tabs, labels, valid biome panels, and initial route come from the normalized
catalog. A semantic finding selects its owning route and biome through the same
generic session action; route- and project-owned findings select the route
overview or retain the current top-level location respectively.

## Workspace Projection

The application projects every configured biome into one `WorkspaceBiome`
envelope. The envelope has an exhaustive node union for starts, linked exits,
ordinary batches, takeover Preboss batches, mixed batches, the Hub decision,
occurrence workbenches, and completion. React renders that projection through
one `BiomeWorkspace`; it does not choose a whole-biome editor by layout type or
read authored decision arrays to reconstruct topology.

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

- fixed Opening and PreHub occurrence workbenches;
- the 26 declaration-fixed Hub slots, of which nine or ten may be open;
- one complete target room and incoming reward for every open slot;
- the ordered six-visit pylon sequence;
- generated/unavailable and entered-order state for side-room slots under
  visited combat targets;
- derived parent restores and Hub returns;
- the completed-Hub handoff to the fixed width-one Preboss Shop and derived
  completion sequence;
- findings and candidate state attached by semantic address.

`HubDecisionWorkbench` is the sole N-specific renderer inside
`BiomeWorkspace`. It may arrange the Hub as a board and visit timeline, but it
may not expose arbitrary room replacement for a fixed slot or persist a second
door-count value. Open-set membership and visit order remain separate controls
because every open, unvisited slot owns a real offered reward leaf.

Membership controls create or remove the one authored occurrence owned by a
fixed slot; visited slots cannot be closed until their visit references are
replaced or explicitly removed. Candidate work remains lazy on control intent
so rendering the 26-slot board does not replay every alternative.

For each active side slot, generation and entry may project as simple toggles;
an entered slot additionally owns a unique ordinal (`1` when it is the only
entered sibling). Generated and entered totals are derived. The editor must
allow every permutation, and it must not suggest that reordering entries changes
already-generated sibling offers. Reordering preserves the final modeled
parent-exit state while changing the exact history/execution trace.

Projectors consume normalized domain state and never infer topology from
rendered components.

## Structured Workspace Presentation

The primary editor presents a route rail, one shared biome-structure region, and
a focused semantic inspector. This is a structured projection over the unified
workspace envelope, not a graph canvas or a second serialized UI tree.

For ordinary decisions, the picked continuation forms the visual trunk and
generated unpicked targets remain compact inspectable leaves. Visual emphasis
does not change their game meaning: unpicked rewards still participate in
sibling, bag, source, and possibility evaluation. For N, the center region
remains the fixed Hub board plus ordered visit timeline rather than a false
ordinary spine.

The structure projection consumes authored topology plus progressive or
canonical evaluation. An incomplete biome is never described as canonical. Its
coverage frontier, retained later authorship, and blocked or unassessed regions
remain visibly distinct.

A configured empty biome may show a read-only declared outline around its live
frontier. Fixed-count layouts may show exact remaining stages; variable layouts
show only a truthfully projected completion horizon or state that length varies.
The UI never derives an expected route length or interprets force rules locally.

`STRUCTURED_EDITOR_WORKSPACE.md` owns the concrete route-rail,
ordinary-decision, Hub, inspector, coverage, empty-outline, dialog, and repair
presentation contracts.

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

Every generated I preboss offer is a distinct Room Occurrence and follows that
same contract; it does not introduce an I-specific shop mode.

An I combat target renders its derived Goal marker instead of a reward editor
when the current simulation resolves Goal. Its complete potential Tartarus
reward remains dormant in authored state. When an upstream edit makes that
same occurrence NonGoal, the editor exposes the retained reward value; it does
not install a new default or ask the user to author Goal versus NonGoal.

The active frontier offers declaration-admitted structural actions rather
than a persistent `Next Step` field:

- create the next ordinary decision where progression permits it;
- create a candidate, takeover, or direct Preboss batch where its declaration
  permits it;
- create the fixed completed-Hub handoff only after the sixth authored visit;
- remove from this decision;
- clear biome through an explicit destructive action.

The shared frontier presentation and variant-owned action sets are recorded in
`../audits/CROSS_BIOME_EDITOR_UX_AUDIT.md`. React may share the container, but
it does not reinterpret takeover, mixed, direct, or completed-Hub Preboss
semantics.

When a selected authored entry or decision directly precedes the current
continuation frontier, its structural actions may also expose `Move to Next
Decision`. This navigation-only action focuses the existing frontier address;
it does not create or replace topology, enter history, or trigger evaluation.
The frontier itself continues to own its declaration-projected creation action.
There is no separate completion-navigation path.

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

Destructive commands receive appropriate confirmation when their visible
impact is substantial. The command layer, not the dialog, defines the actual
deletion scope.

## Room and Reward Editors

Room editors are selected by room template and receive:

- immutable declaration and labels;
- current complete offer-time state and any active entry-time state;
- semantic replacement callbacks;
- room-local findings and candidate results;
- immutable topology context only where the template genuinely requires it.

They do not receive mutable biome topology.

After a room replacement, both the compact summary and focused inspector render
the same reconciled authored snapshot: compatible incoming and local values
remain selected, new or structurally incompatible leaves show replacement
defaults, and leaves no longer admitted by the declaration disappear. A
retained value that is context-invalid displays ordinary finding and candidate
guidance at its stable leaf address. The room selection remains one undoable
command; the editor performs no secondary repair or confirmation step.

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

Every ordinary generated decision projects its store according to policy. An
`authoredBaseStore` batch renders one batch-owned `Reward Pool` selector for
its `baseRewardStoreKey`. A new authored selector displays an explicit
unresolved placeholder and keeps dependent room controls inactive until one
semantic replacement command selects the pool. A `sourceOfferPoint` batch
renders that store only at its owning room-local offer point; the outgoing
batch may show derived provenance but exposes no second editor. A `none` batch
renders no placeholder store field. Each target room then renders only its
resolved-offer editor. A declaration-forced target may display the derived pool
as read-only context, but it does not gain another persisted store selector.
This keeps batch, declaration, and leaf ownership visible in the UI.

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
values; the batch projection marks only the derived active prefix as
participating and leaves a dormant third value retained. A non-combat target
renders no cage editor, and deferred
`FieldsOptionalRewards` render no controls.

An O ShipCombat occurrence renders one encounter-count selector and both
declaration-bounded reward wheels. The selected two- or three-phase value marks
`wheel2` dormant or active without deleting its retained state. Each wheel
owns its Run/Meta store, active offer count, ordered maximum-capacity offers,
and one picked active offer. Dormant wheels and offers remain editable and
visibly dormant; the outgoing decision exposes no duplicate store selector
because its `sourceOfferPoint` policy derives from the last active wheel. The
editor dispatches only ship and reward-wheel semantic commands and does not
encode phase timing.

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
- pending dialog state.

Session state must never be required to reconstruct the authored project.

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
native file dialogs through the same application contract. The suggested
filename is derived from the editable project name, for example
`erebus-route.runplanner.json`.

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
- explicit destructive-action descriptions;
- navigation from a finding to its semantic owner;
- predictable undo/redo shortcuts.

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
