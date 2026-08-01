# Workspace Presentation Polish

## Status

This is the feature implementation plan for Phase 7 Commit 5b. Commit 5a is
complete in `44a2b8d`; it removed the remaining browser confirmation prompts
without introducing a destructive-action abstraction. Commit 5b.1 is complete
in `e059b7d`, and Commit 5b.2 is complete in `4d46957`. Commit 5b.3 remains the
feature frontier, followed by Commit 5b.4 closure. The re-anchor program is
closed, so Commit 5b may resume and remains limited to the four presentation
changes below. Exact authored Shop purchase order is the separate cross-layer
Commit 5c defined by
[`SHOP_PURCHASE_ORDER.md`](SHOP_PURCHASE_ORDER.md).

The decision-highlight rail follow-up documented below was delivered out of
sequence and does not complete, renumber, or replace the still-active 5b.3 and
5b.4 slices.

Stable ownership remains with
[`STRUCTURED_EDITOR_WORKSPACE.md`](../design/STRUCTURED_EDITOR_WORKSPACE.md),
[`CONTEXTUAL_EDITOR_UX.md`](../design/CONTEXTUAL_EDITOR_UX.md),
[`REWARD_MODEL.md`](../design/REWARD_MODEL.md), and the affected biome
authorities. This document owns delivery order, concrete UI policy, file scope,
and acceptance evidence for the follow-up.

## Delivered Decision-Highlight Rail Follow-Up

This out-of-sequence presentation follow-up supersedes this plan's requirement
that F/G/H/I/O/P/Q preserve their previously flat rail fixtures. The rail is a
selective decision-highlight projection, not the exhaustive workspace:
ordinary room occurrences and all other semantic products remain projected,
while the player-facing rail shows one stop per biome decision with a picked
room and reward summary. Selecting that stop presents all offered rooms,
rewards, and picked controls together. N retains the four-stage rail and
subordinate authored visit navigation delivered here. Current authority lives in
[`STRUCTURED_EDITOR_WORKSPACE.md`](../design/STRUCTURED_EDITOR_WORKSPACE.md);
5b.1 and 5b.2 below remain historical delivery evidence, while 5b.3 and 5b.4
remain the planned active slices.

Focused projection, editor, and product-loop coverage proves decision summaries,
co-located room and reward editing, exact finding focus, retained-invalid
offers, incomplete-decision fallback, and unchanged N Hub/visit behavior.
The complete repository gate passes with 59 test files and 618 tests, followed
by all package typechecks, lint, formatting, production build, and diff checks.

## Goal

Make the unified workspace easier to read and operate where the current
presentation exposes implementation structure instead of the authored game
concept:

1. present N as `Opening -> PreHub -> Hub -> Preboss`, with the six authored
   Hub visits nested under Hub;
2. replace Ephyra side-room entry buttons with one visible generated/entry-order
   grid;
3. stop showing dormant third H cage and O combat-phase reward sections when
   the authored active count excludes them;
4. translate internal implementation vocabulary into player-facing route,
   room, door, reward, and progress language.

This is not a general redesign pass. CSS, responsive, keyboard, and
accessibility work belongs here only when required to deliver these four
changes coherently.

## Preserved Boundaries

- Catalog declarations, schema 9, authored project state, commands, codecs,
  simulation, candidate semantics, findings, autosave, and Undo/Redo do not
  change.
- The application projection may add presentation products and candidate-backed
  interaction choices. React remains a consumer and does not inspect authored
  topology or derive game eligibility.
- Dormant authored values remain stored and reappear unchanged when reactivated.
- N keeps one `BiomeWorkspace` and one N-specific `HubDecisionWorkbench`; this
  work does not recreate a dedicated Hub editor.
- Hub visits and side-room visits remain distinct. Nesting a room under Hub is
  navigation, not persisted topology.
- Commit 5b adds no generic wrapper layer, graph library, dialog, edit
  completion status, post-edit focus protocol, localization framework, copy
  registry, or terminology adapter.

| Change               | Application projection                            | React presentation                     | Core or persistence |
| -------------------- | ------------------------------------------------- | -------------------------------------- | ------------------- |
| N rail               | Add explicit Hub children and detail ownership    | Render hierarchy and focused details   | Unchanged           |
| Side-room order      | Add every direct candidate-backed position        | Replace action buttons with one select | Unchanged           |
| H/O dormant sections | Consume existing `active` facts                   | Hide inactive cage/wheel sections      | Unchanged           |
| Product vocabulary   | Translate evidence-dependent presentation strings | Render player-facing copy              | Unchanged           |

## Current Implementation Anchors

- `apps/planner/src/projections/structured-workspace/`
  - `contract.ts` declares `WorkspaceRailEntry`, Hub visit products, and the
    public room-local descriptors;
  - `presentation/biome-presentation.ts` owns the selective decision-highlight
    rail and respects `railVisibility: "inspectorOnly"`;
  - `assembly/hub-assembly.ts` creates Hub room-local workbenches and connects
    authored Hub visits to their occurrence-owned `WorkspaceRoomSummary`;
  - `assembly/occurrence-assembly.ts` owns the projected Ephyra entry-order,
    Fields, and Ship descriptors, including their `active` facts;
  - `interactions/interaction-binding.ts` binds the complete side-room sequence
    to its candidate query, while `OccurrenceWorkbench.tsx` dispatches
    `ReplaceSideRoomEntryOrder`.
- `apps/planner/src/ui/editor/biome/BiomeWorkspace.tsx` renders the
  projection-owned selective rail and resolves a focused semantic owner to its
  projected workbench.
- `apps/planner/src/ui/editor/biome/HubDecisionWorkbench.tsx` owns the persistent
  N board, open-slot membership, incoming main-room offers, and visit order.
- `apps/planner/src/ui/editor/biome/OccurrenceWorkbench.tsx` owns Ephyra side
  rooms, H cages, O reward wheels, and Shop inventory.
- `apps/planner/src/ui/shell/App.tsx`,
  `apps/planner/src/projections/evaluationProjection.ts`, and the biome
  workbenches currently render terms such as route prefix, frontier, batch,
  takeover, occurrence, topology, canonical, progressive, and retained.
- [`USER_FACING_VOCABULARY_AUDIT.md`](../audits/USER_FACING_VOCABULARY_AUDIT.md)
  records the exact current leaks and their player-facing translations.

## Change 1: Hierarchical N Rail and Hub Visit Details

### Presentation

The complete N authoring rail is:

```text
Opening
PreHub
Hub
  Visit 1 · <room label>
  Visit 2 · <room label>
  Visit 3 · <room label>
  Visit 4 · <room label>
  Visit 5 · <room label>
  Visit 6 · <room label>
Preboss
```

Only authored visits appear as interactive Hub children. The next and locked
visit positions remain in `HubDecisionWorkbench`, where visit selection is
already owned. A complete Hub therefore shows all six children; an incomplete
Hub shows only its authored prefix and does not invent room labels.

Before each stage exists, the existing truthful authoring frontier remains
visible. N's internal linked-exit and completed-Hub takeover decision nodes
remain projected and editable, but they do not become additional equal-weight
rail stops once their target stage exists. N's derived Boss and PostBoss
completion remain visible in the structure/coverage presentation, not as
authoring tabs after Preboss.

### Ownership

- `Opening`, `PreHub`, and `Preboss` focus their occurrence workbenches.
- `Hub` focuses the `HubDecisionAddress` and retains board membership, main-room
  incoming rewards, and Hub visit selection.
- Each indented visit child is labelled by visit index but focuses the visited
  room's `OccurrenceAddress`. Local-child findings therefore select the same
  child through occurrence ownership.
- A visit child renders only additional room-local detail. For Ephyra combat
  rooms this is the side-room surface; for a Shop it is Shop inventory; a room
  without additional detail states that directly. Main incoming Hub rewards
  stay on the Hub board rather than being duplicated in the child.
- The Hub board must keep main incoming reward controls available for open
  slots after they are visited, because the child no longer duplicates them.

The projection owns the group/child rail shape and labels. React renders that
shape and indentation; it does not infer that a topology occurrence belongs to
a Hub visit.

### Deliverables

- Extend the workspace rail projection with an explicit nested child product
  sufficient for one Hub group and occurrence workbench children.
- Project authored Hub visits in visit order with occurrence workbench identity
  and semantic markers.
- Collapse N's linked/takeover scaffolding into the four player-facing stages
  without removing the underlying nodes or commands.
- Split Hub main-offer presentation from visit-local detail without moving
  either value to a new owner.
- Add compact, responsive, keyboard-operable nested rail styling.
- Preserve the flat rail output and behavior for F/G/H/I/O/P/Q.

### Acceptance

- Partial N projects `Opening`, `PreHub`, `Hub`, and only the authored visit
  children that actually exist.
- Complete N projects exactly six ordered child rooms and one Preboss stage.
- Replacing or truncating the visit sequence immediately updates child labels
  and order from the new authored snapshot.
- Selecting a child focuses the exact occurrence; a side-room or Shop finding
  reaches the same local-detail workbench.
- Hub main rewards are editable from Hub before and after a room is visited and
  are not duplicated in its child workbench.
- Ordinary-biome rail fixtures remain unchanged.

## Change 2: Direct Ephyra Side-Room Entry Grid

### Presentation

An entered Ephyra parent presents its declared side rooms as:

```text
Side room       Generated       Entry order
Side Room 1     Generated       2nd
Side Room 2     Generated       1st
Side Room 3     Not generated   Not entered
```

Use `Generated`, not `Opened`. Generation and entry are distinct facts: a side
room may be generated without being entered, while a not-generated room cannot
be entered.

The entry control is one select with `Not entered` followed by every structural
position available to that row. Candidate-impossible positions remain visible
but disabled. The select replaces `Enter Last`, `Remove From Entry Order`,
`Earlier`, and `Later`.

The side-room control is purpose-built over a presentation-ready row
interaction. It does not force array-valued order proposals through the shared
scalar `CandidateSelect`.

### Ordering Policy

- A currently entered room in an order of length `k` exposes positions `1`
  through `k`. A not-entered room exposes insertion positions `1` through
  `k + 1`.
- Selecting `Not entered` removes the room and compacts the remaining order.
- Selecting position `n` removes the room from its old position if necessary,
  inserts it at `n`, and shifts the other entered rooms atomically.
- Every option represents one complete proposed `enteredSlotKeys` sequence.
  Duplicate ordinals and gaps are never rendered or dispatched.
- The application projection constructs every direct insertion/removal
  proposal and evaluates it through the existing
  `sideRoomEntryOrders` candidate capability.
- React dispatches one existing `ReplaceSideRoomEntryOrder` command with the
  selected complete sequence. It performs no local repair.
- Candidate-impossible positions remain visible and disabled with the existing
  explanation behavior.
- Changing generation continues through `ReplaceSideRoomGeneration`. An entered
  room is not silently removed from entry order to permit a generation change.
- Generated and dormant reward presentation retains its existing behavior; this
  slice changes side-room generation and order controls, not reward ownership
  or retention.

### Deliverables

- Replace adjacent-only side-room order proposals with all direct positions for
  the selected row.
- Project presentation-ready position labels and complete proposed sequences.
- Replace the current action-button cluster with the generated/entry-order grid.
- Keep side-room reward editing associated with its row and visually subordinate
  to the two structural controls.
- Preserve semantic markers, candidate loading, findings, and one-command
  Undo/Redo.

### Acceptance

- Every generated room can move directly to any legal position in one action.
- Removing an entered room compacts the order; inserting or moving one shifts
  peers deterministically.
- No interaction can author duplicates, gaps, or a not-generated entered room.
- One change creates one history entry; Undo and Redo restore the exact order.
- Generation, entry order, and reward values survive profile round trips
  without a schema change.

## Change 3: Hide Dormant H and O Reward Sections

### H Policy

`WorkspaceRoomLocal.kind === "fields"` continues to project every declared cage
and its `active` flag. `FieldsWorkbench` renders only active cages. A combat
with two active cage rewards shows Cage 1 and Cage 2, not a third dormant card.
When three are active, Cage 3 appears with its retained authored value.

### O Policy

`WorkspaceRoomLocal.kind === "ship"` continues to project both declared reward
wheels and their `active` flags. `ShipWorkbench` renders only active wheels. An
authored `Intro + 1 combat` room shows Reward Wheel 1; `Intro + 2 combats`
shows Reward Wheels 1 and 2. The dormant second wheel remains authored and
reappears unchanged when the third encounter phase is restored.

This change does not alter offer-count presentation inside an active wheel.
Inactive offers governed by the wheel's existing `offerCount` control remain
outside this slice.

React consumes the projected `active` facts. It does not derive cage count from
the Fields outcome or wheel presence from `encounterCount`.

### Deliverables

- Filter H cage and O wheel rendering by their existing projection-owned
  `active` flags.
- Remove dormant-card labels and spacing for the hidden sections.
- Retain compact active-count context where needed to explain the current room
  configuration.
- Add toggle regressions proving dormant values reappear unchanged.

### Acceptance

- A two-cage H combat renders exactly two cage editors; a three-cage combat
  renders three.
- A two-encounter O combat renders one wheel; a three-encounter combat renders
  two.
- Reducing and restoring the active count does not reset dormant rewards,
  stores, offer counts, or picked values.
- No projection, authored model, materialization, or candidate behavior changes.

## Change 4: Use Player-Facing Product Vocabulary

### Policy

[`USER_FACING_VOCABULARY_AUDIT.md`](../audits/USER_FACING_VOCABULARY_AUDIT.md)
is the concrete copy inventory for this change. Production-visible text,
accessible names, tooltips, statuses, findings, candidate explanations, and
removal impact use player intent and game concepts. Internal model and
projection terms remain unchanged in types, commands, semantic addresses,
data attributes, developer errors, and tests that exercise those contracts.

The route setting becomes:

```text
Configure route up to
[ Fields ]

Configuring Erebus, Oceanus, and Fields.
```

The compact route status reads `Through Fields`. An empty route uses
`No biomes` and `No biomes configured.` The current contiguous-prefix and
destructive-effect paragraph is removed; the configured list makes the result
visible and existing Undo/Redo owns recovery.

Across the shared workspace:

- `prefix`, `frontier`, `occurrence`, `topology`, `batch`, `takeover`,
  `canonical`, `progressive`, `declaration-owned`, and raw topology-state
  values do not appear as unexplained product copy;
- rooms, doors, offered/generated/entered state, Preboss, Hub, route progress,
  rewards, findings, and evaluation status remain explicit;
- raw projection sources and `complete` / `partial` / `retained` topology state
  are omitted rather than translated into a second status system;
- evidence-dependent findings and candidate explanations are translated in
  their existing application presentation functions; and
- React continues to consume projected impact and support rather than deriving
  topology, eligibility, or repair scope.

### Deliverables

- Implement every 5b.4-owned row in the vocabulary audit.
- Replace route-prefix configuration copy with the exact route-up-to control,
  compact through-biome status, and included-biome sentence.
- Translate rail, inspector, door, fixed-room, Preboss, completion, Hub,
  removal, repair, finding, and candidate-explanation copy.
- Remove raw projection-source and topology-state enum values from rendered and
  accessible UI.
- Keep visible labels, accessible names, and finding destinations consistent.
- Update `EDITOR_MODEL.md` with the stable product-language boundary when the
  slice lands.
- Preserve the 5c-owned Shop purchase-order message for Commit 5c.

### Acceptance

- Empty, partial, and full route settings name exactly the included biomes
  without exposing prefix terminology.
- Representative ordinary, Fields, mixed, fixed-next-room, Hub, Preboss,
  retained, repair, and completion surfaces use the audit translations.
- Downstream not-evaluated and waiting states explain what the user can do and
  which earlier biome must be finished or fixed.
- No representative render exposes raw `authored`, `canonical`, or
  `progressive` projection sources or raw topology-state chips; legitimate
  product status such as `Complete · Valid` remains.
- Removal summaries remain exact while naming rooms, doors, and later choices.
- Internal types, commands, semantic addresses, persistence, simulation,
  candidate support, and data attributes are unchanged.
- Tests assert intended surface copy; no repository-wide forbidden-word test,
  localization framework, or generic copy abstraction is introduced.

## Delivery Slices

Each slice is independently reviewable and must leave the editor usable.

### Commit 5b.1: Structure Ephyra Rail and Visit Details — complete

Delivered in `e059b7d` (`feat(planner): structure Ephyra rail and visit
details`).

Owns Change 1 only.

Historical delivery files (before the later structured-workspace split):

- `apps/planner/src/projections/structuredWorkspace.ts` (historical facade;
  since decomposed under `structured-workspace/`);
- `apps/planner/src/projections/structuredWorkspace.test.ts`;
- `apps/planner/src/ui/editor/biome/BiomeWorkspace.tsx`;
- `apps/planner/src/ui/editor/biome/HubDecisionWorkbench.tsx`;
- `apps/planner/src/ui/editor/biome/OccurrenceWorkbench.tsx`;
- focused workspace and product interaction fixtures;
- `apps/planner/src/ui/styles.css`.

Gate:

- planner typecheck;
- `npm run test:planner`;
- `npm run test:product`;
- lint, format check, and `git diff --check`.

Review validation ran the root typecheck, `npm run test:planner` (22 files, 183
tests), the changed Surface and Underworld product-loop fixtures (2 files, 11
tests), lint, format check, and `git diff --check`. The complete product lane and
repository gate remain part of Commit 5b.4 closure.

### Commit 5b.2: Simplify Ephyra Side-Room Ordering — complete

Delivered in `4d46957` (`feat(planner): streamline Ephyra side room ordering`).

Owns Change 2 only.

Historical delivery files (before the later structured-workspace split):

- `apps/planner/src/projections/structuredWorkspace.ts` (historical facade;
  since decomposed under `structured-workspace/`);
- `apps/planner/src/projections/structuredWorkspace.test.ts`;
- `apps/planner/src/ui/editor/biome/OccurrenceWorkbench.tsx`;
- focused N interaction and Undo/Redo fixtures;
- `apps/planner/src/ui/styles.css`.

Gate:

- planner typecheck;
- `npm run test:planner`;
- lint, format check, and `git diff --check`.

Review validation ran the root typecheck, `npm run test:planner` (22 files, 185
tests), lint, format check, and `git diff --check`.

### Commit 5b.3: Hide Dormant Fields and Ship Sections

Suggested subject:

```text
feat(editor): hide dormant room reward sections
```

Owns Change 3 only.

Likely files:

- `apps/planner/src/ui/editor/biome/OccurrenceWorkbench.tsx`;
- focused H/O interaction fixtures;
- `apps/planner/src/ui/styles.css`.

The projection types and tests should remain unchanged because their complete
active/dormant products are deliberate.

Gate:

- `npm run test:ui`;
- planner typecheck;
- desktop and narrow visual review of H and O;
- lint, format check, and `git diff --check`.

### Commit 5b.4: Translate Product Vocabulary and Close 5b

Suggested subject:

```text
feat(editor): use player-facing route language
```

Owns Change 4 plus final Commit 5b documentation and gate evidence. It audits
the final surfaces produced by 5b.1 through 5b.3 but does not reopen their
structure or interaction ownership.

Likely files:

- `apps/planner/src/ui/shell/App.tsx`;
- `apps/planner/src/ui/feedback/EvaluationFeedback.tsx`;
- `apps/planner/src/projections/evaluationProjection.ts`;
- `apps/planner/src/projections/contextualOptions.ts`;
- `apps/planner/src/projections/structured-workspace/presentation/biome-presentation.ts`
  for rail and Hub labels;
- `apps/planner/src/projections/structured-workspace/assembly/decision-assembly.ts`
  for evidence-backed door and prerequisite messages;
- `apps/planner/src/projections/structured-workspace/assembly/occurrence-assembly.ts`
  for room-local summaries and labels;
- shared biome, decision, Hub, occurrence, and removal-presentation components;
- focused shell, workspace, feedback, candidate, and product fixtures;
- `EDITOR_MODEL.md`, README, audit, and progress closure.

Gate:

- `npm run test:ui`;
- `npm run test:planner`;
- `npm run test:product`;
- desktop and narrow visual review of all four delivered changes;
- `npm run check`;
- `git diff --check`.

## Final Acceptance

Commit 5b is complete only when:

- all four changes above are delivered without a fifth catch-all redesign;
- no catalog, schema, authored-project, command, codec, simulator, candidate,
  or finding contract changes;
- the projection remains the presentation boundary and React contains no new
  topology or game-rule derivation;
- keyboard and pointer operation, semantic finding navigation, responsive
  layout, and visible focus remain usable on the changed surfaces;
- existing Undo/Redo, autosave, profile round trips, and prompt-free edits
  remain intact;
- the complete repository gate passes without threshold or timeout relaxation;
  and
- `IMPLEMENTATION_PROGRESS.md` records the four commits and advances the
  single active frontier to Commit 5c only after the final gate.
