# Hub Workspace Reconciliation

## Status

Planned. This is the execution plan for Phase 7 Commit 12 after the Linear
focus-progression reconciliation closes.

The stable presentation authority remains
[`STRUCTURED_EDITOR_WORKSPACE.md`](../design/STRUCTURED_EDITOR_WORKSPACE.md).
The concrete N domain behavior remains owned by
[`N_GAME_RULES.md`](../biomes/N_GAME_RULES.md). This document changes
presentation composition only.

## Objective

Bring N's Hub editor into the same route-rail, biome-structure, and focused
inspector language as the Linear biomes without representing the persistent Hub
as Linear topology.

The Hub structure rail is:

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

Opening, Pre-Hub, and Preboss reuse the same fixed-room presentation and
room-state editing language used by Linear workbenches. Hub owns the initial
board and visit plan. Room 1 through Room 6 own the side-room configuration for
the main room selected at that visit position.

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

## Semantic Structure

### Fixed Rooms

The fixed rail stops use their existing semantic owners:

```text
Opening  -> FixedEntryRoomAddress(opening)
Pre-Hub  -> FixedEntryRoomAddress(preHub)
Preboss  -> FixedEntryRoomAddress(preboss)
```

They reuse a shared fixed-room workbench for room state, incoming reward, shop,
assessment, and findings. Reuse means extracting or composing generic
fixed-room presentation; it does not mean rendering `LinearBiomeEditor` inside
the Hub editor.

### Hub

The Hub rail stop uses `HubOpenSetAddress`.

Its workbench owns:

- initialization of the fixed Hub topology when the biome is empty;
- selection of the nine or ten open catalog-fixed main-room slots;
- every open main room's incoming reward;
- the complete ordered six-room visit plan;
- board and visit completeness summaries;
- board-, slot-, reward-, and visit-owned findings.

The Hub workbench presents all 26 physical slots in declaration-owned physical
door order. Closed slots remain visible and compact. Open slots show their room,
incoming reward summary, assessment, visit status, and findings. Selecting a
slot does not expose arbitrary room replacement.

The six visit selectors live in the Hub workbench because this is the sole
authoring authority for visit order. Room 1 through Room 6 consume that order;
they do not provide a second ordering control.

### Room 1 Through Room 6

Each numbered rail stop is a visit position:

```text
Room 1 -> HubVisitAddress(1)
Room 2 -> HubVisitAddress(2)
...
Room 6 -> HubVisitAddress(6)
```

The compact rail label includes the currently selected main room when authored:

```text
Room 1 — Combat 05
Room 2 — Medea
Room 3 — Unselected
```

The workbench resolves the visit position through its selected Hub slot to the
existing main-room occurrence. It shows:

- the selected main room as read-only context;
- its parent-local side-room slots;
- side-room generation state;
- entered-side order;
- side-room incoming rewards;
- side-room findings and contextual candidate feedback;
- derived parent restore and Hub return landmarks where useful.

Main-room membership, main-room reward, and visit-order controls remain in Hub.
The numbered room workbench contains no second copy of those controls.

If the selected main room has no configurable side rooms, the workbench states
that directly. If the visit position is unauthored, it points the user back to
Hub without inventing a room or side state.

Changing the room selected at a visit position changes which occurrence that
numbered workbench resolves. Side-room state stays attached to its original
occurrence and appears at whichever visit position references that occurrence.

### Completion

Preboss uses the shared fixed-room workbench and owns its existing shop state.
Boss and Postboss appear after it as read-only completion landmarks using their
existing semantic completion addresses.

## Structure and Inspector Composition

N uses the same outer composition as the Linear workspace:

```text
+----------------------+---------------------------------------------+
| Hub structure rail   | Focused inspector                           |
|                      |                                             |
| Opening              | selected fixed room, Hub board, visit-side  |
| Pre-Hub              | configuration, Preboss, finding, or         |
| Hub                  | completion landmark                         |
| Room 1..6            |                                             |
| Preboss              |                                             |
| Boss / Postboss      |                                             |
+----------------------+---------------------------------------------+
```

The structure rail is a presentation projection, not persisted topology.
Every activation dispatches the existing transient semantic focus action.
Finding navigation resolves through the structured workspace's semantic focus
index and opens the same workbench as direct rail activation.

The Hub workbench may be larger than an ordinary room workbench because it owns
the one atomic board and visit plan. It should still use compact slot summaries
instead of rendering 26 complete room editors simultaneously.

## Progressive Coverage

Coverage must preserve the Hub region boundaries:

- before topology initialization, the fixed outline and all rail roles are
  visible but only the truthful initialization frontier is actionable;
- while board membership or board rewards are incomplete, Hub is the active
  workbench;
- the board is assessed atomically and never presented as a slot-order prefix;
- Room 1 through Room 6 follow the sequential visit coverage;
- authored later visits remain visible when an earlier visit is invalid, but
  their contextual state remains unassessed;
- Preboss and completion remain visible landmarks without claiming entry before
  six valid visits;
- an upstream-invalid Surface prefix leaves N editable but contextually blocked
  without fabricated N-local findings.

## Finding Destinations

Findings navigate by semantic ownership:

- fixed Opening, Pre-Hub, and Preboss findings focus their fixed-room
  workbench;
- open-set, membership, main-room, main-reward, and visit-order findings focus
  Hub;
- visit-position findings focus the corresponding Room 1 through Room 6;
- local-child and local-reward findings focus the numbered room currently
  referencing their parent occurrence;
- completion findings focus the derived completion landmark;
- if a side-room parent is no longer in the visit plan, its retained authored
  state remains owned by the occurrence and is reachable from its main-room
  slot in Hub.

Rendered board position, room label, and visit array offset are never finding
identity.

## Implementation Slices

### Commit 1: Hub Rail and Shared Fixed Rooms

Suggested subject:

```text
refactor(editor): add the structured hub rail
```

Deliver:

- pass `WorkspaceHubBiome` and the complete structured workspace to the Hub
  React path;
- introduce `HubWorkspace` with the locked rail order and focused inspector;
- project exact focus destinations for fixed rooms, Hub, visits, Preboss, and
  completion landmarks;
- extract or compose the shared fixed-room workbench used by Opening, Pre-Hub,
  and Preboss;
- preserve the empty-topology initialization command;
- keep the existing Hub editor available only as temporary internal source
  during the migration, not as a parallel production surface.

Tests:

- empty, partial, complete, invalid, and blocked N rail projections;
- exact semantic activation for every rail role;
- shared fixed-room state and shop editing;
- read-only Boss and Postboss landmarks;
- navigation remaining outside authored history and candidate work.

Gate:

- N renders through `WorkspaceHubBiome`;
- React no longer constructs the Hub rail from raw topology;
- `npm run test:planner` and all package typechecks pass.

### Commit 2: Hub and Numbered-Room Workbenches

Suggested subject:

```text
refactor(editor): split hub board and visit workbenches
```

Deliver:

- move board membership, all open main-room rewards, and six-position visit
  order into the Hub workbench;
- replace 26 complete room cards with compact fixed-slot summaries and focused
  reward editing;
- implement Room 1 through Room 6 workbenches over `HubVisitAddress`;
- move visited-parent side-room generation, entered order, rewards, and
  findings into the matching numbered workbench;
- remove the old duplicate visited-parent details list;
- retain lazy candidate activation for membership, visits, rewards, side-room
  generation, and entered-order proposals;
- preserve all existing semantic commands and one-command undo behavior.

Tests:

- opening and closing board slots;
- editing the reward of an open unvisited room;
- authoring and replacing visit order only through Hub;
- each numbered room resolving its selected occurrence;
- side-room state following its occurrence after visit reordering;
- rooms without side children and unauthored visit positions;
- exact reward, side-room, and finding focus;
- zero candidate queries during ordinary rendering.

Gate:

- board membership and visit order have one visible authoring authority;
- every open unvisited reward remains visible and editable;
- numbered rooms contain side-room configuration without duplicating main-room
  controls;
- `npm run test:planner` and `npm run test:product` pass.

### Commit 3: Cross-Layer Hub Closure

Suggested subject:

```text
test(editor): close the structured hub workspace
```

Deliver:

- representative keyboard and pointer workflows across Hub and Room 1 through
  Room 6;
- exact semantic finding navigation;
- progressive, invalid, retained, and blocked presentation;
- profile, autosave, undo, and redo regression coverage through the new
  presentation;
- responsive board, rail, and inspector styling;
- reconciliation of `STRUCTURED_EDITOR_WORKSPACE.md`, `EDITOR_MODEL.md`,
  `IMPLEMENTATION_PLAN.md`, and `IMPLEMENTATION_PROGRESS.md`.

Gate:

- the board remains one atomic evaluation region;
- the visit sequence remains ordered and separate from board membership;
- no arbitrary main-room replacement or duplicate ordering authority exists;
- focus-only actions produce no authored edit, evaluation, autosave, or
  candidate work;
- `npm run check` and `git diff --check` pass without timeout relaxation.

## Expected File Scope

Production:

- `apps/planner/src/projections/structuredWorkspace.ts`;
- `apps/planner/src/ui/shell/App.tsx`;
- a new Hub workspace component under `apps/planner/src/ui/editor/hub/`;
- `apps/planner/src/ui/editor/hub/HubBiomeEditor.tsx` or smaller workbench
  components extracted from it;
- `apps/planner/src/ui/editor/hub/HubCandidateControls.tsx`;
- `apps/planner/src/ui/styles.css`.

Tests:

- `apps/planner/src/projections/structuredWorkspace.test.ts`;
- Hub workspace interaction tests under `apps/planner/src/ui/editor/hub/`;
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

- [ ] The rail is Opening, Pre-Hub, Hub, Room 1 through Room 6, Preboss, and
      derived completion.
- [ ] Opening, Pre-Hub, and Preboss reuse shared fixed-room presentation.
- [ ] Hub is the only board-membership, main-reward, and visit-order workbench.
- [ ] Room 1 through Room 6 show only their selected parent's side-room
      configuration.
- [ ] Visit positions use `HubVisitAddress`.
- [ ] Side-room state remains occurrence-owned through reordering.
- [ ] The board remains one atomic coverage region.
- [ ] Open unvisited rewards remain visible and editable.
- [ ] Findings focus exact semantic owners.
- [ ] No arbitrary room replacement or duplicate visit-order authority exists.
- [ ] React does not rebuild Hub topology or evaluation rules.
- [ ] The complete repository gate passes.

Do not mark Phase 7 Commit 12 complete until all three slices and the complete
repository gate pass.
