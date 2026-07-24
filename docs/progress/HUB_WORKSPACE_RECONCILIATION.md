# Unified Biome Workspace and Hub-Node Reconciliation

## Status

Planned. This is the execution plan for Phase 7 Commit 12 after the Linear
focus-progression reconciliation closes.

The stable presentation authority remains
[`STRUCTURED_EDITOR_WORKSPACE.md`](../design/STRUCTURED_EDITOR_WORKSPACE.md).
The concrete N domain behavior remains owned by
[`N_GAME_RULES.md`](../biomes/N_GAME_RULES.md). This document changes
presentation projection and composition only.

## Decision

Every biome is rendered through one shared `BiomeWorkspace`. Biome differences
enter that workspace through explicit projected node variants and focused
workbenches, not through separate full-biome editors.

N does not receive a `HubWorkspace`, and `HubBiomeEditor` does not remain a
production composition boundary. The atomic Hub board is the one specialized
workspace node because it is the one genuinely different authoring region.
Fixed rooms, resolved Room Occurrences, findings, focus, route landmarks, and
completion presentation reuse the same workspace language as the other biomes.

This boundary ensures that workspace-wide fixes to navigation, focus, findings,
room editing, accessibility, responsive layout, and completion presentation
apply to N without a second implementation.

The generalization is presentation-only:

- N remains an authored `HubBiome`;
- Linear biomes remain authored `LinearBiome` topologies;
- the simulator continues to evaluate each topology according to its domain
  rules;
- the shared workspace is a projection and React composition boundary, not a
  new persisted topology.

## Objective

Replace the current `LinearWorkspace` versus `HubBiomeEditor` split with one
explicit biome-workspace contract, then project N into that contract without
representing its persistent Hub as Linear topology.

N's projected route is:

```text
Opening
Pre-Hub
Hub
Room 1
Room 2
Room 3
Room 4
Room 5
Room 6
Preboss
Boss       derived landmark
Postboss   derived landmark
```

Opening, Pre-Hub, Preboss, resolved room occurrences, and completion landmarks
use shared node presentation and workbenches. Hub alone uses a specialized
board workbench. Room 1 through Room 6 resolve the occurrence selected at that
visit position and expose its ordinary occurrence-owned side-room state.

## Workspace Contract

### Shared Envelope

The structured projection exposes one common biome-workspace envelope rather
than requiring the React shell to choose a full editor from authored topology:

```ts
interface WorkspaceBiome {
  biomeName: BiomeName
  topologyKind: "linear" | "hub"
  nodes: readonly WorkspaceNode[]
  defaultFocus: WorkspaceFocusAddress
  completion: WorkspaceCompletion
}
```

The exact field names may follow existing project conventions. The required
contract is:

- React receives an ordered set of complete node variants;
- authored topology kind remains explicit rather than inferred from nodes;
- the workspace owns rail, focus, inspector, finding navigation, and common
  layout exactly once;
- node variants carry normalized presentation data and semantic addresses;
- React does not reconstruct topology, eligibility, coverage, or evaluation;
- persisted project state contains none of the workspace nodes or layout data.

### Explicit Node Variants

Use an explicit discriminated union, not a capability bag, renderer registry,
or structure filled with optional fields:

```ts
type WorkspaceNode =
  | WorkspaceRoomNode
  | WorkspaceLinearDecisionNode
  | WorkspaceHubBoardNode
  | WorkspaceTerminalNode
  | WorkspaceCompletionNode
```

`WorkspaceRoomNode` covers ordinary room presentation, including fixed rooms
and a Hub visit position once it resolves to a Room Occurrence. It may represent
an unresolved semantic room reference, such as an unauthored Hub visit, so the
shared workbench can present a truthful empty state. Its semantic address states
whether focus belongs to a fixed room, occurrence, or visit position.

`WorkspaceLinearDecisionNode` remains the explicit presentation of Linear
choice and continuation semantics.

`WorkspaceHubBoardNode` is the sole Hub-specific structure node. It presents
the joint board-selection and visit-order authority described below.

Terminal and completion nodes retain their existing semantic distinctions.
They are not fabricated Room Occurrences.

The union should be dispatched by an ordinary exhaustive switch. Do not add
metaprogramming that conceals which game-domain node is being rendered.

### Shared React Composition

`BiomeWorkspace` owns:

- the ordered route rail;
- selection and transient semantic focus;
- default-focus progression;
- finding counts and status markers;
- finding-to-focus resolution;
- the focused inspector shell;
- keyboard and pointer interaction;
- responsive rail/inspector layout;
- shared room and completion workbenches.

Node-specific workbenches own only their distinct authoring surface. The
workspace does not translate semantic commands into lower-level mutations.

Removing a full Hub editor does not require removing Hub-named components.
`HubBoardWorkbench` and Hub-specific candidate controls remain appropriate
because their commands and facts are genuinely Hub-specific.

## Preserved Domain Contracts

- N remains a `HubBiome`; it does not acquire Linear continuations or batches.
- The catalog-fixed physical board contains 26 possible slots, of which exactly
  nine or ten are open.
- The open board is generated as one atomic semantic region.
- Every open main room owns a real incoming reward, including rooms that are
  never visited.
- Board membership and the ordered six-room visit plan remain separate authored
  facts and separate semantic controls.
- Main room declarations are fixed to Hub slots and cannot be replaced
  arbitrarily.
- Visit positions reference open Hub slots; they do not own or copy Room
  Occurrences.
- Side-room state remains owned by the selected main-room occurrence.
- Reordering visits never moves, duplicates, resets, or copies side-room state.
- Opening, Pre-Hub, and Preboss remain fixed authored Room Occurrences.
- Boss and Postboss remain layout-derived read-only completion rooms.
- Existing semantic commands, simulation, candidate evaluation, findings,
  persistence, autosave, and undo/redo remain authoritative.

## N Node Semantics

### Fixed Rooms

The fixed rail stops use shared room nodes with their existing semantic owners:

```text
Opening  -> FixedEntryRoomAddress(opening)
Pre-Hub  -> FixedEntryRoomAddress(preHub)
Preboss  -> FixedEntryRoomAddress(preboss)
```

They reuse the shared room workbench for room state, incoming reward, shop,
assessment, and findings. N does not wrap or render a Linear editor to obtain
that presentation.

### Hub Board

The Hub rail stop is a `WorkspaceHubBoardNode` addressed by
`HubOpenSetAddress`.

Its workbench owns:

- initialization of the fixed Hub topology when the biome is empty;
- selection of the nine or ten open catalog-fixed main-room slots;
- every open main room's incoming reward;
- the complete ordered six-room visit plan;
- board and visit completeness summaries;
- board-, slot-, reward-, and visit-owned findings.

The workbench presents all 26 physical slots in declaration-owned physical door
order. Closed slots remain visible and compact. Open slots show their room,
incoming reward summary, assessment, visit status, and findings. Selecting a
slot does not expose arbitrary room replacement.

The six visit selectors live in this workbench because the Hub board is the
sole authoring authority for visit order. Room 1 through Room 6 consume that
order; they do not provide a second ordering control.

The board may require a larger inspector surface than an ordinary node. It
still uses compact slot summaries rather than mounting 26 complete room editors
simultaneously.

### Room 1 Through Room 6

Each numbered stop begins from a stable visit-position owner:

```text
Room 1 -> HubVisitAddress(1)
Room 2 -> HubVisitAddress(2)
...
Room 6 -> HubVisitAddress(6)
```

The projection resolves the selected slot to its existing Room Occurrence when
one is authored. The node then uses the shared occurrence workbench to present:

- the selected main room as read-only route context;
- its parent-local side-room slots;
- side-room generation state;
- entered-side order;
- side-room incoming rewards;
- side-room findings and contextual candidate feedback;
- derived parent restore and Hub return landmarks where useful.

The compact rail label includes the resolved main room:

```text
Room 1 — Combat 05
Room 2 — Medea
Room 3 — Unselected
```

Main-room membership, main-room reward, and visit-order controls remain in the
Hub board node. A numbered room contains no second copy of those controls.

If the selected main room has no configurable side rooms, the shared workbench
states that directly. If the visit position is unauthored, the node presents a
truthful unresolved state and points to Hub without inventing an occurrence.

Changing the room selected at a visit position changes which occurrence that
numbered node resolves. Side-room state remains attached to the original
occurrence and appears wherever that occurrence is referenced.

### Completion

Preboss uses the shared room workbench and owns its existing shop state. Boss
and Postboss follow it as read-only shared completion nodes using their existing
semantic completion addresses.

## Progressive Coverage

The common workspace must preserve topology-specific coverage:

- before Hub initialization, N's fixed outline and all route roles are visible,
  but only the truthful initialization frontier is actionable;
- while board membership or board rewards are incomplete, the Hub board is the
  active workbench;
- the board is assessed atomically and never presented as a slot-order prefix;
- Room 1 through Room 6 follow sequential visit coverage;
- authored later visits remain visible when an earlier visit is invalid, but
  their contextual state remains unassessed;
- Preboss and completion remain visible landmarks without claiming entry before
  six valid visits;
- an upstream-invalid Surface prefix leaves N editable but contextually blocked
  without fabricated N-local findings.

`BiomeWorkspace` renders projected coverage. It does not calculate these rules.

## Finding Destinations

Findings navigate by semantic ownership:

- fixed Opening, Pre-Hub, and Preboss findings focus their room nodes;
- open-set, membership, main-room, main-reward, and visit-order findings focus
  the Hub board node;
- visit-position findings focus the corresponding Room 1 through Room 6;
- local-child and local-reward findings focus the node currently resolving
  their parent occurrence;
- completion findings focus the derived completion node;
- if a side-room parent is no longer in the visit plan, its retained authored
  state remains occurrence-owned and is reachable from its main-room slot in
  the Hub board.

Rendered board position, room label, rail position, and visit array offset are
never finding identity.

## Implementation Slices

### Commit 1: Generalize the Biome Workspace

Suggested subject:

```text
refactor(editor): generalize biome workspace composition
```

Deliver:

- introduce the common `WorkspaceBiome` envelope and explicit
  `WorkspaceNode` union;
- migrate the current Linear projection to the common envelope without changing
  its topology semantics, focus addresses, or coverage results;
- replace or rename `LinearWorkspace` with `BiomeWorkspace`;
- move rail, focus, inspector selection, findings, default progression,
  completion presentation, and responsive composition into that shared
  component;
- keep Linear decision rendering as an explicit node workbench;
- make the application shell render a projected workspace rather than choose a
  full editor from raw authored topology;
- keep N on its current presentation temporarily until its complete projection
  lands in Commit 2.

Tests:

- projection fixtures proving unchanged Linear node order and addresses;
- exhaustive node dispatch;
- Linear pointer, keyboard, finding-navigation, and default-focus regressions;
- focus-only actions remaining outside authored history, evaluation, autosave,
  and candidate work;
- application-shell coverage proving workspace selection is projection-driven.

Gate:

- every currently migrated Linear biome renders through `BiomeWorkspace`;
- the shared renderer contains no Linear eligibility or topology calculation;
- no Linear behavior or authored serialization changes;
- `npm run test:planner` and all package typechecks pass.

### Commit 2: Project N Through the Shared Workspace

Suggested subject:

```text
refactor(editor): model the hub as a workspace node
```

Deliver:

- project N's locked node order: Opening, Pre-Hub, Hub board, Room 1 through
  Room 6, Preboss, Boss, and Postboss;
- add `WorkspaceHubBoardNode` as the sole Hub-specific structure node;
- reuse shared room nodes and workbenches for Opening, Pre-Hub, Preboss, and
  resolved visit occurrences;
- preserve truthful unresolved room nodes for unauthored visit positions;
- move board membership, all open main-room rewards, and six-position visit
  order into `HubBoardWorkbench`;
- replace 26 complete room cards with compact fixed-slot summaries and focused
  reward editing;
- present visited-parent side-room generation, entered order, rewards, and
  findings through the shared occurrence workbench;
- preserve the empty-topology initialization command;
- retain lazy candidate activation for membership, visits, rewards, side-room
  generation, and entered-order proposals;
- preserve all existing semantic commands and one-command undo behavior.

Tests:

- empty, partial, complete, invalid, retained, and upstream-blocked N
  projections;
- exact node order and semantic activation for every N route role;
- opening and closing board slots;
- editing the reward of an open unvisited room;
- authoring and replacing visit order only through the Hub board;
- each numbered room resolving its selected occurrence;
- side-room state following its occurrence after visit reordering;
- rooms without side children and unauthored visit positions;
- shared fixed-room state and Preboss shop editing;
- exact reward, side-room, finding, Boss, and Postboss focus;
- zero candidate queries during ordinary rendering.

Gate:

- N renders through the same `BiomeWorkspace` as Linear biomes;
- Hub board is the only Hub-specific workbench and board-shaped node;
- board membership and visit order have one visible authoring authority;
- every open unvisited reward remains visible and editable;
- numbered rooms reuse occurrence presentation without duplicating main-room
  controls;
- `npm run test:planner` and `npm run test:product` pass.

### Commit 3: Retire the Separate Editors and Close the Contract

Suggested subject:

```text
test(editor): close the unified biome workspace
```

Deliver:

- remove `HubBiomeEditor` after all N behavior is reachable through projected
  nodes and focused workbenches;
- remove the obsolete `LinearWorkspace` boundary if it was retained as a
  temporary migration adapter;
- remove duplicate Hub visited-parent detail and biome-level composition code;
- add representative keyboard and pointer workflows across the Hub board and
  Room 1 through Room 6;
- close profile, autosave, undo, redo, progressive, retained, invalid, and
  blocked-state regressions;
- close responsive board, rail, and inspector styling;
- update `STRUCTURED_EDITOR_WORKSPACE.md` so one biome workspace is design
  authority rather than separate Linear and Hub workspace shells;
- reconcile `EDITOR_MODEL.md`, `IMPLEMENTATION_PLAN.md`, and
  `IMPLEMENTATION_PROGRESS.md`.

Gate:

- no production full-biome editor duplicates workspace composition;
- workspace-wide behavior has one implementation used by N and Linear biomes;
- the board remains one atomic evaluation region;
- visit order remains separate from board membership;
- no arbitrary main-room replacement or duplicate ordering authority exists;
- focus-only actions produce no authored edit, evaluation, autosave, or
  candidate work;
- `npm run check` and `git diff --check` pass without timeout relaxation.

## Expected File Scope

Production:

- `apps/planner/src/projections/structuredWorkspace.ts`;
- `apps/planner/src/ui/shell/App.tsx`;
- shared workspace components under `apps/planner/src/ui/editor/`;
- shared room and completion workbenches extracted from existing editors;
- a focused Hub board workbench under
  `apps/planner/src/ui/editor/hub/`;
- `apps/planner/src/ui/editor/hub/HubCandidateControls.tsx`;
- removal of
  `apps/planner/src/ui/editor/hub/HubBiomeEditor.tsx`;
- `apps/planner/src/ui/styles.css`.

Tests:

- `apps/planner/src/projections/structuredWorkspace.test.ts`;
- shared workspace interaction tests;
- focused Hub-board interaction tests;
- affected Surface product-loop fixtures.

Documentation:

- `docs/design/STRUCTURED_EDITOR_WORKSPACE.md`;
- `docs/design/EDITOR_MODEL.md`;
- `docs/progress/IMPLEMENTATION_PLAN.md`;
- `docs/progress/IMPLEMENTATION_PROGRESS.md`.

Changing planner-engine, catalog declarations, N game rules, authored-project
schema, Hub simulation, reward processing, or candidate evaluation is outside
the expected scope and requires a newly documented reason.

## Review Checklist

- [ ] One `BiomeWorkspace` renders every migrated biome.
- [ ] Authored `LinearBiome` and `HubBiome` topology kinds remain distinct.
- [ ] React receives explicit projected nodes and does not infer topology.
- [ ] The rail is Opening, Pre-Hub, Hub, Room 1 through Room 6, Preboss, and
      derived completion.
- [ ] Opening, Pre-Hub, Preboss, resolved occurrences, and completion reuse
      shared presentation.
- [ ] Hub board is the only Hub-specific structure workbench.
- [ ] Hub board is the only board-membership, main-reward, and visit-order
      authority.
- [ ] Room 1 through Room 6 show only their resolved occurrence's side-room
      configuration.
- [ ] Visit positions use `HubVisitAddress`.
- [ ] Side-room state remains occurrence-owned through reordering.
- [ ] The board remains one atomic coverage region.
- [ ] Open unvisited rewards remain visible and editable.
- [ ] Findings focus exact semantic owners.
- [ ] No arbitrary room replacement or duplicate visit-order authority exists.
- [ ] Workspace-wide fixes have no separate N implementation path.
- [ ] The complete repository gate passes.

Do not mark Phase 7 Commit 12 complete until all three slices and the complete
repository gate pass.
