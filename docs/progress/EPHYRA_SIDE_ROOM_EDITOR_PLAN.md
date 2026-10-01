# Ephyra side-room editor

Status: locked; owner approved implementation. Gate A is next.
Base: `c1571c72dbefba39bad0758fd351f9b55927ee81`.

## Objective

Give Ephyra side-room generation and traversal a deliberate, coherent authoring
home. Replace the compact Overview table with a **Side Rooms** room tab containing
**Doors** and **Visits** views. Both use the Fields Room Layout proportions:
controls on the left and the clickable parent-room map on the right, stacking
at narrow widths.

The left editor remains the primary explanation of order and the reliable
keyboard/repair surface. The map identifies physical doors and selects the
same editor target; clicking it does not silently generate, close, visit, or
reorder a room.

## Established facts and preserved policy

Authority: `docs/biomes/N_GAME_RULES.md`, especially “Hub and side-room facts”,
“Runtime-derived side-room availability ranks”, and “Main targets, pylons, and
side rooms”. Relevant live paths:

- `packages/hades2-catalog/src/declarations/rooms/n/hub-main.ts`: fixed side
  slots, destination rooms, physical door IDs, and availability ranks.
- `packages/planner-engine/src/simulation/generation/hub.ts`, `validateVisit`:
  side-generation pressure follows availability rank and the cumulative
  generated count. Native evidence is `RoomLogic.lua`,
  `CheckN_SubRoomDoorUnavailable`, and `ObstacleDataN.lua`:
  `MinSubRoomsPerPylon = 0.5`, `AboveMinAvailableChance = 0.3`.
- Generated rewards form a joint sibling region. Priority is not an authored
  reward-acquisition order; visiting rooms establishes acquisition chronology.
- `packages/planner-engine/src/authored-project/commands/topology/local-visits.ts`:
  `SetLocalVisitGeneration` changes membership without deleting the retained
  occurrence. Disabling generation requires removal from the visit list first.
  `ReplaceLocalVisitOrder` accepts distinct generated occurrences and retains
  their room-local state when order or membership changes.
- `apps/planner/src/projections/structured-workspace/assembly/hub-assembly.ts`,
  `localVisitOrderControl`: the current position edit removes the selected
  occurrence and inserts it at the requested position. Other visits shift;
  this is not a pairwise swap.
- Side-room excursions return through the main room before the Hub. They are
  not additional Hub visits and do not share a room-local action timeline.

This delivery changes presentation, not any of these policies.

## Scope and non-goals

Included: side-room tab/navigation, Doors and Visits presentation, map-marker
geometry, selection binding, explicit visit movement, finding destinations,
responsive layout, accessibility, and focused regression coverage.

Excluded:

- Fields cage-order editing, Aetos, and Nemesis contest controls.
- Authored schema, execution protocol, catalog facts, engine legality,
  occurrence creation/removal policy, and game-module changes.
- Automatic visiting when opening a door; automatic closing when removing a
  visit; combined generation/visit commands; cascading destructive edits.
- A second editable copy of side-room controls in Overview, a generic map
  editor framework, a graph library, or a whole-editor Save/Cancel draft.
- Changes to ordinary room-map inspection or side-room encounter/timeline
  authoring after entry.

Edits continue to dispatch the existing semantic commands immediately and
participate in Undo/redo. The map and list share transient selection, not an
additional authored ordering model.

## Product decisions

### Side Rooms home

- Show the outer tab only when the parent has a declared local side-room group.
- Remove generation, reward, and visit controls from Room Overview.
- Default to Doors on ordinary entry. Preserve the selected inner view while
  editing the same parent; do not leak selection into another occurrence.
- Use accessible outer and inner tabs with existing keyboard conventions.
- Do not invent a new Run State checkpoint for either inner view. Resolve the
  existing appropriate parent checkpoint, or omit the utility if no truthful
  checkpoint is available.

### Doors

- Show every declared side slot, including ungenerated slots, in immutable
  availability-priority order. Name this order **Generation priority**.
- Each row identifies the destination side room, generation state, and its
  existing reward editor when generated. A row/map selection exposes or focuses
  those controls without changing authored state.
- Retain engine candidate support, waiting states, invalid-state repair, and
  generation findings. Do not turn an authored invalid generation into a
  disabled repair surface merely because its selected value is invalid.
- For a visited room, keep closing blocked with a concise instruction to
  remove its visit first. Never remove the visit implicitly.
- Explain once that doors are checked in this fixed order. Do not suggest that
  map position or the destination-room number determines priority.

### Visits

- Render visited rooms in `visitOrder`, not generation-priority order. Show
  visit ordinal, destination identity, and reward summary together.
- Below the sequence, show generated-but-unvisited rooms available to add.
  Ungenerated rooms remain visible on the map but cannot be added; their
  selection can offer navigation to Doors without generating them.
- Add appends a room, Remove excludes it, and Move explicitly chooses a
  position with the resulting ordered sequence visible before confirmation.
  Use the existing complete-order intents and candidate evidence. Moving is
  insertion with shifting, never an undocumented swap.
- Keep all existing authoring-readiness restrictions. An invalid later reward
  must not introduce a new blanket lock where existing supported repair was
  available. Do not create speculative repair exceptions in React.
- Generated-but-unvisited is a legitimate outcome, not a missing visit finding.
- Side-room encounter, acquisition, and local timeline editors stay in their
  current occurrence workbenches; this view authors traversal only.

### Map and selection

- Both views use the parent map, not the selected destination's map.
- Retain destination-room numbers on markers. Display visit ordinals separately
  from that identity; never relabel Side Room 03 as Room 1 when it is visited first.
- Selection synchronizes map and left editor using the parent's declared slot
  identity. Priority, array index, visit ordinal, and painted labels are not keys.
- Doors markers reflect generation state; Visits markers reflect visit state.
  Selected/invalid/waiting states must remain distinguishable without relying
  solely on color, and must not reuse Hub room-quality categories.
- Preserve zoom/pan alignment, drag-versus-click suppression, keyboard marker
  activation, and useful focus after closing any selected-row popover.
- Reuse the Fields layout and `RoomMapViewport` behaviour. Adapt the Hub's
  interaction patterns rather than importing Hub membership or visit policy.

## Map evidence and ownership

The capture annotation inventory covers all **29 side slots across 16 main
rooms**, matching the current room declarations. Source files are currently
external:

`/mnt/c/Users/Mohammed Ayyat/Saved Games/Hades II/Screenshots/N/annotations.json`

and the corresponding `Tagged/N_CombatXX.overlay.svg` files. The JSON uses a
640 × 360 coordinate space; current overlays/images use 2560 × 1440. Normalize
geometry explicitly and verify against the final packaged image.

The existing WebPs bake in yellow destination-room markers. Import only the
needed side-marker geometry into application-owned room-map metadata. Initially
overlay hit targets and state/selection decoration on those markers; do not
duplicate painted numbers or require recapture/re-encoding. Inspect all maps
for alignment before locking the metadata. Original images remain untouched.

Geometry is presentation data. Catalog physical-door IDs and slot identities
remain semantic evidence; the application binds them explicitly to the matching
destination marker for each parent. Add an integrity witness for complete,
unique correspondence. Production must not read the external capture directory.

## Ownership and starting neighborhood

| Responsibility                                          | Owner / starting files                                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Existing meaning and legality                           | Engine commands/candidates above; consume unchanged                                                                      |
| Complete side-room descriptors and bound intents        | `structured-workspace/contracts/locals.ts`, `assembly/hub-assembly.ts`, `interactions/occurrence-interaction-binding.ts` |
| Outer/inner view destinations and exact finding routing | `structured-workspace/contracts/navigation.ts`, existing marker-destination assembly and navigation bindings             |
| Room-tab composition                                    | `OccurrenceWorkbench.tsx`, `OccurrenceDirectRoomWorkbench.tsx`                                                           |
| Doors/Visits editor and transient selection             | Existing `locals/LocalVisitWorkbench.tsx` neighborhood                                                                   |
| Parent-map geometry and viewport                        | `ui/room-maps/`; patterns in `HubMapOverview.tsx`, `HubMapTimeline.tsx`, and `locals/FieldsWorkbench.tsx`                |
| Styling                                                 | Existing room-workbench and room-map CSS neighborhoods                                                                   |

Expose only the narrow application destination needed for the inner view and
selected slot. Do not overload semantic addresses with UI state or rediscover
containment/legality in React. Generation and generated reward findings belong
to Doors; visit-order findings belong to Visits. Destination-room encounter and
action findings continue to belong to that occurrence's own workbench.

## Delivery gates and commit boundaries

### Gate A — Side Rooms home and Doors

Deliver the outer tab, both inner-view destinations, left/right layout, packaged
geometry, shared selection, and the Doors editor. Initially retain the existing
visit-position controls in Visits, so the landed gate is complete and usable.
Remove the old Overview editor in the same slice and move findings to their
new exact home. Keep declaration priority and all existing candidate bindings.

Primary tests: room-tab/editor workflows, map geometry integrity, and finding
routing. Representative witnesses cover generation/reward edits from the new
home, waiting/invalid repair, visited-door close restriction, and map selection
without authored-history mutation.

Commit boundary: a usable replacement home with no duplicate Overview controls.

### Gate B — Explicit visit sequence and movement

Replace the temporary per-room position dropdowns with the ordered visit list,
available-room list, and Add/Remove/Move operations described above. Bind to
existing complete-order proposals and engine candidates; remove superseded
position-select rendering and styles in this slice. Retain occurrence content,
exact findings, and Undo/redo throughout.

Primary tests: application interaction/projection ownership of order proposals
and focused UI workflows. Witness first/middle/last insertion, removal and
re-addition, generated-but-unvisited rooms, retained reward/encounter/action
state, and unavailable order proposals. Do not duplicate the engine's complete
legality matrix or manufacture new domain rules to satisfy the layout.

Commit boundary: one coherent ordering editor and no parallel dropdown path.

### Gate C — Review and closure

Review the full product for identity fidelity, finding navigation, retained
state, candidate-readiness boundaries, accessibility, responsive proportions,
and superseded paths. Verify marker placement for every supported parent map;
test representative one-, two-, and three-door parents interactively.

Use the repository multi-agent routine for implementation: a focused executor
packet per coherent gate, followed by an independent reviewer after the gate
stabilizes. The main session owns scope, Git, remediation disposition, and
broad closure. Do not add engine work merely to accommodate an application
presentation preference; report any demonstrated contract gap separately.

## Acceptance and verification

- Doors are always displayed in fixed generation priority; Visits always in
  authored traversal order.
- Generated rewards remain authored even when a room is not visited.
- Disabling/re-enabling generation and removing/re-adding visits preserve the
  same occurrence identity and room-local contents.
- Moving one visit shifts the sequence visibly and produces one semantic Undo
  step; navigation, map selection, and zoom produce none.
- Findings open the correct outer/inner view and exact slot or order control,
  including repeated navigation to the same owner.
- Invalid generation remains repairable; pre-context controls stay waiting;
  visited generation cannot be disabled until its visit is removed.
- Map drags never edit or select accidentally; keyboard access can perform all
  authoring without the map. Narrow layouts stack without losing controls.
- Ordinary map inspection, Hub editing, main-room timelines, side-room
  workbenches, and executor exports retain their previous contracts.

During implementation use the narrow truthful UI/projection/map tests, followed
by `npm run test:planner` and a representative existing Surface product witness
at the tab/navigation boundary. Run typecheck, lint, and formatting checks after
the presentation contracts stabilize. Run one complete `npm run check` at
phase closure; record actual results in the closure commit rather than claiming
source review as a runtime pass.

## Retirement

Delete the old Overview table path, obsolete native visit-select rendering and
CSS, and tests that assert that presentation remains the intended home. Retain
behavioural witnesses under the new editor rather than deleting their policy
coverage. Keep the per-position engine/application proposals still consumed by
Move; deletion is based on actual callers, not the old widget's name.

Update `ui/room-maps/README.md` for interactive side-marker metadata and its
integrity ownership. Update durable presentation documentation only where the
new tab/navigation changes an existing documented contract. No biome rule
rewrite is needed because generation and traversal policy are unchanged.
Delete this temporary plan at closure. No new in-game checklist is needed for
an application-only presentation change.
