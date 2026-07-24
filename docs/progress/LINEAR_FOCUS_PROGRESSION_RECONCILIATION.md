# Linear Focus Progression Reconciliation

## Status

Complete on 2026-07-24. Both implementation slices and the complete repository
gate passed before Phase 7 Commit 12.

The investigation and product disposition are recorded in
[`LINEAR_EDITOR_FOCUS_PROGRESSION_AUDIT.md`](../audits/LINEAR_EDITOR_FOCUS_PROGRESSION_AUDIT.md).
This document is the concrete execution plan.

## Objective

Make the existing Linear inspector behavior predictable without introducing a
new navigation system:

- creating a start or decision keeps the workbench that performed the command
  selected;
- completing that workbench reveals the next frontier without selecting it;
- one nearby navigation button selects the revealed frontier;
- the structure frontier and nearby button dispatch the same existing semantic
  focus action;
- focus remains transient and creates no authored history, simulation, or
  candidate work.

This is a shared Linear editor correction. It does not change biome rules,
topology, simulation, progressive coverage, or candidate evaluation.

## Existing Mechanism

The required primitives already exist:

- `semanticOwnerFocused` stores one transient semantic owner;
- `LinearWorkspace` keeps a resolvable explicit owner selected;
- the structured workspace already publishes the current truthful
  `projection.frontier`;
- the structure-region frontier already focuses that semantic address;
- authored commands and focus actions are already separate Redux actions.

The inconsistency comes from creation handlers that sometimes leave
`focusedSemanticOwner` null. Null invokes the moving `defaultMarker`, so a
newly published frontier appears to advance the inspector automatically.

The fix is to establish explicit focus when a creation command begins from the
currently displayed workbench. No new focus mode is required.

## Locked Behavior

1. `semanticOwnerFocused` remains the single focus action.
2. Every authored Linear start selects its created Room Occurrence.
3. Creating a batch or terminal from a displayed frontier first selects that
   frontier's continuation address.
4. The same continuation address resolves to the created decision workbench
   after the authored command.
5. Later edits retain that explicit owner while it remains representable.
6. A newly published frontier is visible but is not selected automatically.
7. One `Move to Next Decision` button selects that frontier.
8. The button is navigation-only and never creates a batch or terminal.
9. No behavior branches on biome key, room game name, reward type, rendered
   index, or probability.

“Complete” is not a new domain fact. The structured workspace already publishes
the next truthful frontier when the authored workbench becomes complete.

## Minimal Implementation

### Creation Focus Wiring

Remove `WorkspacePostCreateFocus` and `postCreateFocusByGameName`.

After `CreateStart`, always dispatch:

```ts
semanticOwnerFocused(createOccurrenceAddress(biome, occurrenceId));
```

When either frontier structural command is invoked:

- `CreateBatch`;
- `CreateTerminalTransition`;

dispatch `semanticOwnerFocused(frontierAddress)` before dispatching the
authored command. Focus and authored state remain separate actions. Only the
authored command enters undo history.

This uses the semantic continuation address already rendered by the frontier.
After creation, that same address resolves to the new batch or terminal
workbench, so no post-command topology lookup is necessary.

### Nearby Frontier Button

Add one optional next-frontier marker to the application-owned Linear workspace
projection for the workbench that directly precedes the current truthful
frontier. Reuse the existing `WorkspaceMarker`; do not introduce a generalized
successor-navigation hierarchy.

Render one button in that workbench:

```text
Move to Next Decision
```

The button dispatches only:

```ts
semanticOwnerFocused(nextFrontier.address);
```

The button and structure-region frontier must receive the same semantic
address. After navigating, the existing frontier workbench continues to own
`Add Next Decision` and any declaration-owned terminal action.

Do not add a separate `Move to Terminal Decision` path. Creating a terminal
from the frontier already keeps the same continuation address selected and
therefore resolves directly to the terminal workbench.

## Commit Slices

### Commit 1: Stable Creation Focus

Suggested subject:

```text
fix(editor): keep linear creation focus stable
```

Deliver:

- remove the declaration-dependent post-create focus policy;
- focus every created authored start occurrence;
- make `CreateBatch` and `CreateTerminalTransition` establish explicit focus
  on their existing continuation address;
- keep semantic focus outside authored history;
- preserve all existing structural commands and topology behavior.

Tests:

- stateful and stateless authored starts both retain their created occurrence;
- creating a batch retains the continuation workbench;
- creating a terminal retains the continuation workbench;
- completing a created decision does not select the newly published frontier;
- one authored creation remains one undo entry;
- focus wiring does not add project evaluation or candidate work.

Gate:

- `npm run test:ui`;
- `npm run test:planner`;
- all package typechecks.

### Commit 2: Explicit Frontier Navigation

Suggested subject:

```text
feat(editor): add linear frontier navigation
```

Deliver:

- project one optional next-frontier marker onto its direct predecessor
  workbench;
- render `Move to Next Decision` beside that workbench's structural actions;
- dispatch the existing `semanticOwnerFocused` action;
- keep the structure frontier independently selectable;
- use ordinary navigation styling and keyboard-accessible button behavior;
- update affected product-loop helpers and the owning design/progress
  documents.

Tests:

- the button appears only when the selected workbench directly precedes the
  current frontier;
- the button and structure frontier use the same semantic address;
- activating either surface selects the same frontier workbench;
- navigation changes no authored project, undo history, evaluation identity,
  autosave value, or candidate instrumentation;
- an accidental completing edit leaves its correction workbench selected until
  the user activates the button;
- representative Linear layouts continue to render their existing
  declaration-owned terminal actions.

Gate:

- `npm run test:planner`;
- `npm run test:product`;
- `npm run check`;
- `git diff --check`.

## Expected File Scope

Production:

- `apps/planner/src/projections/structuredWorkspace.ts`;
- `apps/planner/src/ui/editor/linear/LinearWorkspace.tsx`;
- `apps/planner/src/ui/editor/linear/LinearBiomeEditor.tsx`;
- `apps/planner/src/ui/editor/linear/LinearTopologyEditor.tsx`;
- `apps/planner/src/ui/styles.css` if the existing navigation style is
  insufficient.

Tests:

- `apps/planner/src/projections/structuredWorkspace.test.ts`;
- `apps/planner/src/ui/editor/linear/LinearWorkspace.test.tsx`;
- affected product-loop helpers.

Documentation:

- `docs/design/STRUCTURED_EDITOR_WORKSPACE.md`;
- `docs/design/EDITOR_MODEL.md`;
- `docs/audits/LINEAR_EDITOR_FOCUS_PROGRESSION_AUDIT.md`;
- `docs/progress/IMPLEMENTATION_PROGRESS.md`.

Changing editor-session state shape, planner-engine, catalog declarations,
biome rules, project schema, simulation, progressive coverage, or candidate
evaluation is outside the expected scope and requires a newly documented
reason.

## Review Checklist

- [x] The existing semantic focus action remains the only focus command.
- [x] Every authored Linear start retains its created occurrence.
- [x] Batch and terminal creation retain their continuation workbench.
- [x] Completing a workbench reveals but does not select the next frontier.
- [x] One nearby button selects the next frontier.
- [x] The button and structure frontier share one semantic address.
- [x] Frontier navigation creates no authored edit or undo entry.
- [x] No new inspector-selection, landing, or fallback subsystem was added.
- [x] No biome or game-name navigation branch exists.
- [x] The complete repository gate passes.

Do not mark the reconciliation complete in `IMPLEMENTATION_PROGRESS.md` until
both commit slices and the complete gate pass.
