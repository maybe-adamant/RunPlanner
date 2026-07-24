# Linear Editor Focus Progression Audit

## Purpose

This audit investigates inconsistent focused-inspector progression while
authoring Linear biomes, first reported while editing F and G.

It records current behavior and identifies the ownership defect. It does not
change authored topology, simulation, candidate evaluation, or game rules.

The concrete delivery stages are maintained in
[`LINEAR_FOCUS_PROGRESSION_RECONCILIATION.md`](../progress/LINEAR_FOCUS_PROGRESSION_RECONCILIATION.md).

`STRUCTURED_EDITOR_WORKSPACE.md` remains the presentation authority. The
accepted reconciliation updates that authority with the final focus contract.

The ownership and evidence sections below describe the pre-reconciliation
baseline. `Reconciliation Outcome` records the delivered contract.

## Reported Symptom

After the user finishes the visible room or decision work, some flows present
the next active decision immediately while other flows leave the inspector on
the previous decision until the user selects the frontier manually.

The report described this as an F/G difference. The implementation does expose
an F/G difference at start creation, but later generated-room behavior is not
selected by biome key. The direction of later movement depends on how the
inspector acquired focus before the semantic edit.

## Scope

The audit covers:

- F and G authored starts;
- ordinary generated Linear decisions;
- structure-node and frontier activation;
- semantic finding focus;
- authored edits, undo, redo, and whole-project replacement;
- the relationship between Redux editor-session focus and the structured
  workspace's projected frontier.

Hub focus and the Phase 7 Commit 12 N board/timeline presentation are out of
scope. The reconciled vocabulary should be reusable there, but this task must
not pre-implement Hub structure.

## Current Ownership

The relevant authorities are:

- `structuredWorkspace.ts`, which projects semantic markers, inspector
  destinations, and the current frontier;
- `editorSessionSlice.ts`, which stores one nullable
  `focusedSemanticOwner`;
- `LinearWorkspace.tsx`, which resolves the visible inspector from the stored
  owner or a local fallback;
- `LinearBiomeEditor.tsx`, which applies a special post-create focus policy to
  authored starts;
- semantic project commands, which replace authored state and publish a new
  evaluation but deliberately do not edit UI-session state.

Catalog Room Declarations and planner-engine simulation do not select editor
focus.

## Evidence

### One nullable field represents two different intents

`focusedSemanticOwner === null` currently means that `LinearWorkspace` should
choose its local `defaultMarker`. That function selects the current projected
frontier first.

As authored state changes, a null session value therefore behaves like a
moving **follow-frontier** mode even though the state does not name that mode.

A non-null owner that still resolves through `workspace.focusByOwner` behaves
like a sticky **inspect-owner** mode. Authored commands do not clear or replace
it, so the inspector remains on that owner while the frontier moves elsewhere.

If a stored owner stops resolving, React silently falls back to the current
default marker. That third case can look like automatic progression even
though stale session state remains stored.

### Every structure button currently pins focus

`FocusButton` dispatches `semanticOwnerFocused(marker.address)` for entries,
decisions, terminals, completion-adjacent nodes, and the active frontier.

Consequently, selecting the active frontier changes the session from implicit
follow-frontier behavior to sticky owner inspection. Creating and completing a
decision after that click leaves the inspector on the old semantic owner.

If the inspector was already showing the frontier through its null fallback,
the user can invoke the same authoring command without that click. The null
value survives, so the next workspace revision immediately displays the new
frontier.

The visible command is the same; the hidden focus mode differs.

### F and G starts intentionally diverge

The structured-workspace start projection derives `postCreateFocusByGameName`
from declaration-owned default room state:

| Start      | Default state           | Current post-create behavior           |
| ---------- | ----------------------- | -------------------------------------- |
| F Opening  | Editable counted reward | Store the created occurrence owner     |
| G Entrance | No editable room state  | Leave focus null and show the frontier |

Focused production tests currently require both behaviors:

- `retains a newly created start when its room owns an editable reward`;
- `advances an ordinary created start to its frontier`.

This distinction was added during Tartarus reconciliation so F Opening and I
Entrance would expose their newly available edit surfaces. It is a legitimate
start-creation exception, not a general F/G decision-progression policy.

Once a generated decision exists, F and G use the same Linear workspace,
target editor, room-state editor, and semantic command handlers. There is no
room-game-name or biome-key branch that advances one biome after an ordinary
room edit.

### Focus origin, not biome, determines later behavior

The current behavior matrix is:

| Focus before an authored edit        | Workspace after the edit | Visible result                                         |
| ------------------------------------ | ------------------------ | ------------------------------------------------------ |
| Null/default                         | Frontier advances        | Inspector advances                                     |
| Resolved explicit owner              | Frontier advances        | Inspector stays                                        |
| Removed or unresolved explicit owner | Frontier advances        | Inspector falls back and appears to advance            |
| Finding-selected owner               | Frontier advances        | Inspector stays on the finding owner while it resolves |

This explains why the reported direction can differ from the start fixture's
F-stays/G-advances direction. Clicking a structure decision, finding, or
frontier before the edit changes the later result without changing any F/G
game rule.

### Existing fixtures mask the distinction

The complete Underworld product-loop helper selects `.linear-frontier-node`
when it exists before pressing `Add Next Decision`. That helper proves the
authoring result but does not assert the inspector destination after completing
the new decision.

Existing Linear workspace tests cover F/G post-create focus and exact finding
focus. They do not provide a table-driven parity fixture for:

- retaining the current F and G decision after it becomes complete;
- exposing the newly available frontier without selecting it;
- moving to that frontier only after explicit activation.

The focused audit lane passed on 2026-07-24 with the three existing post-create
tests.

## Finding

This is a transient editor-navigation defect, not a catalog, authored-project,
simulation, or validation defect.

The structured workspace projects the correct new frontier. The inconsistency
comes from mixing an unnamed moving null fallback with exact semantic-owner
inspection. The product must select one predictable navigation contract.

No project schema change, topology repair, room declaration change, or
simulator rule is justified.

## Product Disposition

On 2026-07-24 the product direction selected conservative, explicit
progression: completing an authored room or decision must not move the focused
inspector automatically.

This protects the user's local context after an accidental selection or a
command that unexpectedly makes the panel complete. The new frontier should
become visible in the structure region, but the user decides when to leave the
completed workbench.

Automatic follow-frontier mode is rejected. Focus remains transient and
semantic, but progression is an explicit navigation action.

## Reconciliation Outcome

The accepted delivery is the smaller reconciliation in
[`LINEAR_FOCUS_PROGRESSION_RECONCILIATION.md`](../progress/LINEAR_FOCUS_PROGRESSION_RECONCILIATION.md).
It retains the existing `semanticOwnerFocused` action rather than adding a
landing, fallback, or focus-mode subsystem. Creation explicitly focuses the
created start or existing continuation workbench. When that workbench directly
precedes a truthful continuation frontier, the workspace projects the same
marker onto it and renders one navigation-only `Move to Next Decision` action.

The action shares the structure frontier's address and creates no authored
edit, history entry, evaluation, or candidate work. The reconciliation does
not add `Move to Terminal Decision`; declaration-owned terminal actions remain
on the frontier.

## Superseded Proposed Focus Contract

The following initial proposal is retained as audit history. It is not the
delivery authority; the reconciliation above supersedes its landing/fallback
and terminal-navigation requirements.

The editor should retain one exact semantic inspector selection:

`InspectOwner`
: Resolve the selected semantic owner through the structured workspace's focus
index. Authored edits do not replace that selection merely because the
workspace publishes a different frontier.

The interaction rules should be:

1. Selecting an active frontier, entry, decision, target, room, terminal,
   completion detail, or semantic finding selects that exact semantic owner
   without subscribing the inspector to later frontiers.
2. Creating an authored start selects the created Room Occurrence in every
   Linear biome, including stateless G Entrance.
3. Creating a decision from a selected continuation keeps that continuation
   selected. The same semantic owner may now resolve to the new decision
   workbench, but later completion does not select its successor.
4. Creating or editing targets, picked state, rewards, shops, local children,
   batch settings, or biome fields retains the current workbench.
5. When a new frontier becomes available, it appears in the structure region
   without stealing the inspector. The user explicitly selects it to continue.
6. A completed decision workbench exposes a nearby navigation-only action for
   its declaration-projected successor:
   - `Move to Next Decision` for an ordinary authored or authorable
     continuation;
   - `Move to Terminal Decision` when the successor is the terminal workbench.
     The action selects the exact projected destination. It does not create a
     batch, create a terminal, replace topology, run a second evaluation, or
     enter authored history.
7. Entering a biome panel resolves one deterministic initial landing owner and
   stores that semantic selection before an authored command can be made. The
   landing selection must not remain an implicit moving default.
8. If deletion, undo, redo, or project replacement removes the selected owner,
   the application resolves one documented nearest surviving semantic owner.
   That fallback is navigation state and does not enter authored history.
9. No focus decision branches on biome key, room game name, reward type,
   rendered decision index, or completion probability.

“Finishing a room” should not become a new domain event. The presentation
signal is only that the application-owned workspace publishes a different
active frontier. Publishing it does not select it.

## Superseded Recommended Delivery

### Slice 1: Explicit Focus Intent

Deliver:

- an explicit transient semantic inspector selection instead of using null as
  a moving frontier mode;
- semantic session actions for selecting and clearing an inspector owner;
- one application-projected initial landing owner for each Linear biome panel;
- finding navigation and route/biome navigation reconciled to the exact-owner
  state;
- focused reducer fixtures for navigation, findings, and history exclusion.

Gate:

- null or an unresolved address no longer causes an authored revision to
  select a newer frontier silently;
- editor focus remains outside `AuthoredProject`, profile JSON, autosave, and
  undo/redo history.

### Slice 2: Structured Linear Consumption

Deliver:

- application/workspace-owned resolution of the current Linear inspector
  destination from the exact semantic selection;
- active-frontier activation that selects only that current frontier;
- existing structure, room, decision, terminal, completion, and finding
  activation that selects its exact owner;
- a decision-owned successor-navigation descriptor containing its exact
  workspace destination and player-facing label;
- `Move to Next Decision` or `Move to Terminal Decision` beside the current
  decision's structural actions only when that truthful successor exists;
- consistent created-occurrence focus for F Opening, G Entrance, and I
  Entrance;
- workbench retention across effective authored commands;
- a documented fallback when an inspected owner disappears.

Gate:

- React does not infer room completion or compare biome/game names;
- a newly published frontier never changes the selected inspector;
- an existing decision remains selected after becoming structurally complete;
- the next frontier remains visible and explicitly selectable from both the
  structure region and the current workbench;
- successor navigation performs no authored command, evaluation, or candidate
  query.

### Slice 3: F/G Parity and Cross-Layer Closure

Deliver:

- table-driven F/G interaction fixtures proving that completing the current
  decision retains its workbench;
- matching fixtures proving that the next frontier is visible but not selected;
- fixtures proving that the structure frontier and the in-workbench successor
  action move the inspector to the same semantic destination exactly once;
- label coverage for ordinary and terminal successors;
- reconciled F/G created-start fixtures that retain the created occurrence;
- a misclick fixture proving that an accidental completing command leaves its
  correction surface in place;
- undo, redo, finding navigation, render-purity, and candidate-work assertions;
- reconciliation of `STRUCTURED_EDITOR_WORKSPACE.md`,
  `EDITOR_MODEL.md`, and implementation progress.

Gate:

- identical F/G generated-decision workflows retain focus identically;
- one semantic edit remains one authored undo entry;
- focus-only actions produce no project evaluation or candidate query;
- all Linear biomes retain their variant-owned frontier and terminal behavior;
- `npm run check` passes.

## Non-Goals

- changing F or G room declarations;
- adding a persisted “room complete” flag;
- clearing selected invalid values to force progression;
- advancing after any reward, room-state, picked, or structural edit;
- moving a user away from an explicitly inspected historical decision;
- changing progressive simulation coverage;
- implementing the N Hub board/timeline focus surface;
- introducing graph or rendered-row identity.
