# Editor Model

## Purpose

This document defines how the external React application presents and edits
the authored project while consuming simulation results. It owns UI language
and interaction policy, not game rules or persisted topology structure.

## Editor Principle

The editor is a projection and command surface:

```text
authored project + simulation result
  -> layout-specific presentation projection
  -> React components
  -> semantic command
  -> replacement authored project
  -> fresh simulation result
```

The UI may tolerate incomplete and invalid authored plans. It must not hide,
repair, or silently delete them merely to keep the view visually legal.

The batch-level Reward Pool projection described below follows the locked
F/G/P/Q/H/O/I-compatible schema version 2 contract. Production remains on the
older representation until the Phase 2.75 atomic authority switch.

## Application Shell

The initial shell should preserve the useful high-level navigation proven by
the ImGui prototype:

- horizontal route tabs: Underworld, Surface, Settings;
- route-local biome navigation;
- a route settings panel;
- one primary biome editor;
- a route status and findings surface;
- a details/inspector area when richer room editing needs it.

The exact desktop composition may evolve. Tabs and panels are presentation,
not project identity.

## Layout Projectors

Editor layout is selected by normalized biome layout kind:

```ts
interface BiomeEditorProjector<TTopology, TView> {
  project(input: {
    catalog: Catalog;
    topology: TTopology;
    occurrences: RoomOccurrenceIndex;
    simulation: BiomeSimulationView;
  }): TView;
}
```

`LinearBiome` projects:

- start room;
- each selected-spine decision;
- physical exit targets in order;
- one picked continuation;
- unpicked dead leaves;
- unavailable retained exits;
- active continuation frontier;
- ordered terminal targets, picked realization, and companions;
- referenced room-local editors;
- findings and candidate state attached by semantic address.

`HubBiome` projects:

- fixed authored entry-room leaves;
- the nine-or-ten-member open set over catalog-fixed hub slots;
- one complete target room and incoming reward per open slot;
- the ordered six-slot pylon visit sequence;
- generated/unavailable and entered-order state for side-room slots under
  visited combat targets;
- derived parent restores and hub returns;
- the fixed authored preboss shop and derived completion sequence;
- findings and candidate state attached by semantic address.

The N editor may visually arrange the hub as a map, board, list, or visit
timeline. None of those projections may expose arbitrary room replacement for
a fixed hub slot or persist a second door-count value. Open-set membership and
visit order remain separate controls because every open unvisited slot still
owns a real offered reward leaf.

For each active side slot, generation and entry may project as simple toggles;
an entered slot additionally owns a unique ordinal (`1` when it is the only
entered sibling).
Generated and entered totals are derived. The editor must allow every
permutation, and it must not suggest that reordering entries changes already-
generated sibling offers. Reordering preserves the final modeled parent-exit
state while changing the exact history/execution trace.

Projectors consume normalized domain state and never infer topology from
rendered components.

## Rows Versus Domain Language

Rows, cards, lanes, graph nodes, and columns are valid UI concepts. They do
not enter authored state, canonical snapshots, history, or findings.

The UI may produce a linear series of decision cards for F and a hub-oriented
surface for N while both consume the same semantic ownership conventions.

Room components use the persisted domain `occurrenceId` as their React key.
Structural components without a room occurrence use their stable semantic
address. The UI does not invent a second occurrence identity.

## Topology Editing

All topology edits dispatch commands from `AUTHORED_PROJECT_MODEL.md`.

The UI may use convenient two-stage selection:

```text
Type: Combat / Miniboss / Story / Fountain / Shop
Room: category-filtered concrete room labels
```

The category is transient browsing state. An authored target is one stable
Room Occurrence whose current selection is a concrete `gameName`. Changing
category does not clear the occurrence; choosing a concrete replacement
dispatches one atomic `ReplaceOccurrenceRoom` command and preserves its
`occurrenceId`.

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

F/G terminal sections use the same physical-exit language. They render one
terminal occurrence per active predecessor exit, with the policy-derived Shop
or Free Reward editor aligned to that exit. Selecting the entered terminal
target is single-choice topology; the editor does not add a second preboss
entry-mode selector.

I keeps its post-goal preboss and ordinary peer in one decision card because
they are one game batch. `Add Next Decision` is I's only frontier-advance
action: before Goal completion it derives a Goal on the first exit, and after
Goal completion it derives `I_PreBoss02` there. A second exit, when present,
renders an ordinary room leaf. Both targets are directly pickable through the
same single-choice interaction. Picking the preboss visually closes the biome,
while picking the peer exposes its downstream decision. I never renders `Go to
Preboss`; that action is reserved for layouts whose preboss is an independent
terminal transition.

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

The active frontier offers policy-admitted structural actions rather than a
persistent `Next Step` field:

- Add Next Decision;
- Go to Preboss, only for layouts with an independent terminal transition;
- replace terminal outcome with continuing rooms where the layout permits;
- remove from this decision;
- clear biome through an explicit destructive action.

## Downstream Editing

Upstream replacement retains downstream state whenever the semantic structure
can remain represented.

The UI must visibly represent overflow targets after exit-capacity shrink. It
does not detach, hide, or auto-delete the picked continuation. The repair flow
is:

1. show retained unavailable targets and the associated structural finding;
2. require the user to choose an available picked exit;
3. re-anchor an ordinary continuation through `SetPicked`, or select the
   available terminal realization through `SetTerminalPicked`;
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

Reward composition remains bottom-up:

```text
payload domain
  -> reward primitive
  -> counted store domain or fixed binding
  -> batch-resolved offer / shop / room-local offer point
  -> room template
```

A parent selection immediately installs the selected child's complete declared
defaults. The UI never commits an intermediate empty payload or reward.

Every ordinary generated decision projects its store according to policy. An
`authoredBaseStore` batch renders one batch-owned `Reward Pool` selector for
its `baseRewardStoreKey`. A `sourceOfferPoint` batch renders that store only at
its owning room-local offer point; the outgoing batch may show derived
provenance but exposes no second editor. A `none` batch renders no placeholder
store field. Each target room then renders only its concrete reward editor. A
declaration-forced target may display the derived pool as read-only context,
but it does not gain another persisted store selector. This keeps batch,
declaration, and leaf ownership visible in the UI.

Replacing the batch reward pool retains every target reward. Candidate and
selected-plan validation mark a retained reward invalid when its newly resolved
store cannot produce it; the editor does not reset it. The UI never displays
probability percentages, likelihood scores, or warnings for merely unlikely
but possible outcomes.

An H ordinary batch has no Reward Pool selector because its observable rewards
use declaration-owned RunProgress bindings. It instead renders one batch-owned
Fields cage outcome selector with Min and Max semantic values. The view may
show the derived active cage count and current two-Max ceiling as read-only
context, but it persists neither. Each combat occurrence renders its three
room-owned cage values; the batch projection marks only the derived active
prefix as participating and leaves a dormant third value retained. A
non-combat target renders no cage editor, and deferred
`FieldsOptionalRewards` render no controls.

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

| Semantic owner              | Presentation                           |
| --------------------------- | -------------------------------------- |
| Biome                       | biome status and findings summary      |
| Start                       | start selector marker                  |
| Parent batch                | decision card and batch marker         |
| Batch reward store          | decision Reward Pool selector          |
| Batch policy state          | policy-specific batch selector         |
| Parent plus exit index      | target selector or physical exit       |
| Picked continuation         | single-choice surface                  |
| Terminal predecessor        | terminal section                       |
| Terminal target             | terminal exit and realization          |
| Conditional terminal target | target row and biome-completion marker |
| Room occurrence             | room editor                            |
| Occurrence plus slot        | local reward/child editor              |

Finding resolution is direct lookup. It never scans rows for a matching game
room name.

Context-invalid candidates remain visible and are decorated. Declaration-
impossible values may be absent. Before contextual candidate simulation is
available, selectors show stable declaration-derived domains without
pretending they are validated.

Later biomes blocked by an earlier incomplete or invalid biome remain visible
and editable. Their contextual validity is unavailable because the required
history does not exist. The view should communicate that state without
inventing local errors.

## Undo and Redo UX

Undo/redo applies to semantic authored commands. One visible user intent is one
history entry, including compound default installation.

Expected examples:

- replacing a room is one undo step;
- selecting a reward primitive and its default payload is one undo step;
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

## Graph Policy

Do not begin with a freeform graph canvas. Linear and hub layouts have stronger
semantic structure than arbitrary nodes and edges, and a structured editor is
easier to make readable and accessible.

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
- hidden invalid choices;
- automatic surviving-exit selection;
- graph coordinates as domain topology;
- a large generic form generator that obscures room semantics;
- parity with the old ImGui layout as a goal in itself.
