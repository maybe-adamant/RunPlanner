# Hub Map Editor

## Status and objective

Status: Gate A is committed as `41915681`; Gate B's independently reviewed map
ordering checkpoint is `1e15ce01`. Panel polish is committed as `532d4d85`.
Focused tests, static checks, and browser checks passed for those checkpoints.
Gate B.2 below is locked for the user-approved Timeline List retirement.
Gate C's complete repository gate and documentation closure have not started.

Planning base: `7d42d084` (`feat(planner): support dragging zoomed room maps`).
The unrelated Room Capture progress document is outside this change.

Give Ephyra Hub Overview interchangeable List and Map presentations, and make
Timeline a single map-based sequence editor. Both consume the same application
interactions and engine-owned ordered visit model.

## Scope and authorities

Application/UI only: Hub membership, reward-control presentation, visit-order
proposals, map assets/annotations, and finding/focus integration. No catalog,
authored schema, simulation, candidate-policy, execution-protocol, or game-module
changes. Existing engine commands retain ownership of topology and cleanup.

Read these exact authorities when implementing the affected boundary:

- `docs/design/ARCHITECTURE.md`: Application; Construction and Publication;
  Code Placement and Imports; Adding a Feature.
- `docs/design/EDITOR_MODEL.md`: Authored-First Assembly; Readiness, availability
  and coverage; Bound Interactions; Findings and Navigation; Presentation and
  Accessibility.
- `docs/design/STRUCTURED_EDITOR_WORKSPACE.md`: Static Room Maps; Hub Decision
  Workspace; Progressive Coverage and Findings; Removal Actions and Repair.
- `apps/planner/src/ui/room-maps/README.md`: asset ownership and encoding.

This plan deliberately replaces the Hub's static side-reference presentation
described there. It preserves Fields Layout, ordinary map inspection, the rail,
main/side-room editors, Hub Exit, and the completed-Hub handoff.

## Current code and constraints

| Responsibility                                                   | Starting neighborhood / existing product                                                      |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Hub tabs, current map toggle, explicit finding navigation        | `ui/editor/biome/HubDecisionWorkbench.tsx`                                                    |
| Open/close controls and main reward editor                       | `HubMembershipBoard.tsx`, `HubRoomCards.tsx`, `DoorRewardEditor.tsx` in the same neighborhood |
| Dense visit prefix, remaining-room list, drag and arrow controls | `HubVisitTimeline.tsx`, `HubVisitRanking.tsx`                                                 |
| Semantic membership attempts and complete visit-order proposals  | `projections/structured-workspace/interactions/hub-interaction-binding.ts`                    |
| Presentation-only ordering                                       | `projections/structured-workspace/presentation/hub-ranking.ts`                                |
| Fit, zoom, pan and packaged reference images                     | `ui/room-maps/RoomMapViewport.tsx`, `roomMapAssets.ts`, `room-maps.css`                       |
| One repair-target feedback/focus path                            | `ui/feedback/useFindingTarget.tsx`; workbench `findingNavigationRevision`                     |

Paths in the table are under `apps/planner/src/` unless stated otherwise.

The workspace already supplies the 26 fixed slots, open state, bound reward
surfaces, visit owners, current authored visit prefix, and required visit count.
The map must consume these, not reconstruct a second Hub from its annotations.

Opening a slot allocates occurrence identities through a bound opening attempt.
Map rendering/hover must not allocate identities or eagerly evaluate all slots.
Map actions must retain the same readiness and candidate checks as List actions.

The persisted Hub has a dense ordered list of distinct open slot keys. It does
not store independent per-room ranks. Conflicting numbers and ordinal gaps are
not new supported states in this work.

The current ranked-roster helper can promote a tail room when removing from a
full prefix, and can evict the last visit when adding to it. Those implicit
substitutions are unsuitable for the agreed explicit replacement interaction.
Its generic `RankedPrefix` functions also serve room-action ordering: do not
change those unrelated consumers or globally change their semantics.

## Agreed experience

### Two views, one source

- Overview exposes `List | Map`, initially List. Timeline is map-only; Hub Exit
  retains its existing presentation. Neither has a view switch.
- Remember Overview's view choice locally for the current Hub host. View,
  selected marker, popover, drag, zoom and pan are not authored state or Undo
  entries. Changing the project/Hub host cannot retain stale marker selections.
- Overview List retains its compact layout and controls, with no inline Hub map. Map
  gets the available workbench width, not a second full editor beside it.
- Overview views share a panel shell, with `List | Map` at its top right and the
  List heading or Map zoom controls at the left. Timeline puts zoom controls on
  the left and Reset visits on the right. The Hub uses the standard room
  panel and heading with right-aligned status counts. `Run State` and `Remove Hub`
  sit to the right of the Hub tabs, outside the tablist, across all views.
- Switching views preserves authored values immediately; there is no map draft,
  Apply/Save button, independent route cache, or synchronization command.
- A loaded plan renders its actual open set and visits; only genuinely closed
  slots start closed. Do not reset a board on entering Map mode.

### Overview: membership and rewards

- Show every declared door at its fixed annotation position. Closed doors are
  subdued and explicitly identified as closed; color alone is insufficient.
- Clicking a closed door attempts to open it using the existing bound membership
  interaction and shows its reward editor as soon as that opening is published.
  It does not schedule a visit or navigate to the room.
- An open door has a compact `Opened`/reward badge. Clicking that badge (or the
  open marker) exposes the existing reward control, not another reward picker
  implementation. Show missing authored reward state honestly.
- Keep full controls in one active anchored popover rather than placing editors
  beside all 26 circles. Include an explicit Close room action there, subject
  to the existing close capability; clicking an open circle never closes it.
- Opening/closing and reward edits dispatch their existing single intents.
  Re-read the current slot by stable identity after publication; do not retain
  stale bound interactions inside a popover.

### Timeline: construct a sequence

- Show annotations for open rooms only, including open but unvisited rooms.
  Closed-room annotations disappear; the underlying map does not change shape.
- Keep room identity inside the circle. Show `Visit 1`, etc. as a distinct badge,
  never replace room 12's identity with its chronological rank. Visited markers
  are solid; unvisited markers are translucent, not disabled. Category color
  retains its existing meaning. The Map has no separate sequence strip.
  Capacity comes from the existing workspace product (currently six), not a
  second limit declaration.
- Clicking an unvisited room appends it at the next position when space remains.
  At capacity, it opens an explicit chooser naming each visit to replace. Merely
  opening/canceling that chooser changes nothing. Replacement keeps that visit's
  position and returns the displaced room to the unvisited open set.
- A Timeline-only Reset visits button on the right of the map toolbar, with a
  subtle red border, clears the sequence with one undoable
  empty-prefix proposal. It preserves open rooms
  and their rewards, uses existing engine-owned handoff cleanup, and requires
  no confirmation. Disable it when empty or when Hub editing is locked. The
  author can then click unvisited markers to rebuild the sequence in order.
- Clicking a visited marker opens Remove visit and Move to each other position
  in the authored prefix. Moving C first in `A → B → C` yields `C → A → B`:
  intervening visits shift, not swap. No gaps or duplicate ranks are introduced.
  Removal shortens the prefix and compacts later visits without closing the
  room or promoting any unvisited room. Both marker menus support keyboard
  activation and never navigate the rail.
- The map is the sole Timeline editor. Remove the List roster, drag/arrow path,
  and transient unvisited-tail ordering; no hidden editor or alternate route
  may silently substitute another room.
- Produce one complete visit-order proposal through the existing bound candidate
  interaction and `ReplaceHubVisitOrder`. These are sequence edits, not a new
  validator. Respect candidate/readiness outcomes rather than promising every
  proposed permutation will be accepted. The engine alone reconciles topology,
  occurrence liveness and any completed-handoff removal.

### Findings and interaction continuity

- Overview List remains its canonical repair destination. Timeline finding
  navigation stays on the map: authored visit owners bind their corresponding
  marker, and the next missing visit owner binds the existing planned-count
  status. These are exact semantic targets, not a generic tab fallback. Finding
  navigation must focus and border that same target, including repeated requests.
- Ordinary edits must not repeatedly force Overview List merely because an old finding
  remains selected. Preserve rail selection and existing destination ownership.
- Map markers may reflect existing repair-target feedback, but must not register
  competing canonical targets or invent finding routing. Mount only the active
  view; avoid duplicate semantic DOM IDs from hidden editors or popovers.
- Apply readiness at every activation root: marker, badge, keyboard action and
  popover control. Viewing, panning and switching views remain available while
  authoring is locked. Never use missing evaluation to hide retained authorship.
  Visit-order editing uses the Hub-decision interaction's readiness,
  not the readiness of each visited occurrence. Incomplete room content
  cannot prevent rearranging the Hub sequence; an incomplete prerequisite before
  the Hub still locks its edits. Exact visit finding targets remain distinct.
- Use accessible buttons and existing popover primitives. One active popover,
  collision-aware positioning, keyboard access and Escape/focus return suffice;
  no persistent per-door popup machinery or collision-solving framework.
- Background drag pans; marker/control interaction does not start a viewport
  drag. A drag or canceled pointer sequence must never open a room or append a
  visit. Retain unrelated room-action drag behavior unchanged.
- Edits preserve map position. If a selected door disappears through Undo/close,
  discard only that transient selection and return focus to an existing local
  control. Mode/tab changes close obsolete popovers without changing authorship.

## Map asset and code ownership

The canonical background is the untouched 2560 × 1440 `Hades II_556.png`
recapture, also saved as `N_Hub_Background.png`. Its replacement annotation
source is available at:

`C:/Users/Mohammed Ayyat/Saved Games/Hades II/Screenshots/New folder/Annotated/N_Hub.overlay.svg`

The background files are in the parent `New folder` directory. The SVG contains
all 26 recalibrated door positions and the user-approved Perfect/Good/Bad/Special
categories. Coordinates are expressed directly against this capture: no image
padding, image translation, runtime offset or retained old coordinate system.

These categories are presentation metadata, not game legality or opening state.
Keep categorization separate from Opened/Unvisited/Visit status. The screenshot
retains the game's small door numbers and door graphics as fixed scenery; hiding
a closed-room annotation means hiding our overlay, not erasing native scenery.

Asset preparation replaces the existing flattened `N_Hub.webp` with a render of
this new source pair so today's reference viewer also uses the new capture.
The earlier annotated image and padded recapture are superseded, not alternate
backgrounds. Gate A replaces the flattened runtime image with the background
and shared live annotation layer; it does not keep two independently maintained
maps for inspection and editing.

- Package the verified background and one typed annotation description with the
  Hub UI. Map declared game-room identities to the workspace's stable slot keys;
  never use array position, screen coordinates, or display text as edit identity.
- Use the source image coordinate system for a live SVG/positioned-button layer.
  It must share the displayed image rectangle and transform under Fit/zoom/pan,
  including letterboxing, not anchor to the surrounding scrollport.
- Read-only Hub inspection renders all markers from the same background and
  annotation description that drives the editor, without editing handlers.
  Keep one declared `N_Hub` asset identity and one annotation authority. Do not
  retain a second flattened runtime reference or introduce a fictitious room
  into the asset discovery glob. Other room images stay ordinary static assets.
- Export the new background as WebP quality 90, preserving dimensions. Package
  it with browser and desktop builds; no runtime Windows paths or network fetch.
- Keep Hub-specific composition with the existing `ui/editor/biome` Hub files;
  a cohesive `hub-map/` child is appropriate for the map layer and its asset.
  Shared viewport changes are limited to image-aligned overlay composition and
  gesture isolation. No broad movement of existing editors merely for imports.
- Shared Hub proposal/interaction behavior belongs beside current Hub projection
  and binding owners. Extract reusable membership/reward contacts only where
  both actual views consume them; do not duplicate candidate logic in React.

## Delivery gates

### A — Map Overview, end to end

Deliver the verified background, fixed marker layer, List/Map switching for
Overview, shared membership/reward interactions, pan/zoom-safe popovers, and
canonical List finding navigation. Keep Timeline in List until B lands. Remove
the old side-reference toggle/layout from the Hub; preserve general reference
components used elsewhere. This is a usable vertical slice, not an asset-only
or interface-only commit.

Primary tests: `test/ui/room-maps/`, `test/ui/editor/biome/HubMembershipBoard.test.tsx`,
`HubDecisionWorkbench.interaction.test.tsx`, and focused Hub map tests beside
those UI owners. Reuse `test/support/hub-workbench.ts` and existing Surface
fixtures. Binding tests own one opening-attempt/intent witness, not another
complete membership-legality matrix.

Acceptance: all 26 declared doors map exactly once to the right owner; no eager
opening attempts; open → edit reward → switch to List → Undo/Redo agrees;
disabled/locked marker and badge cannot bypass controls; close uses the same
engine-owned cleanup; finding navigation from Map reaches the exact List field.
Visually verify dense clusters and marker alignment at Fit and zoom.

### B — Map Timeline and explicit shared Hub sequence actions

Deliver the open-only layer, visit badges, direct position menus,
append/reorder/remove, and explicit full-sequence replacement. Adapt List actions to the same Hub
proposals. Keep generic ranked-prefix behavior for room actions unchanged; share
only applicable ordering and drag primitives, not implicit tail substitutions.
Finish mode/finding/focus continuity across both tabs.

Primary policy tests: `test/projections/structured-workspace/presentation/`
owns the complete Hub sequence-edit matrix. Bound-intent contacts stay in
`test/projections/structured-workspace/interactions/hub-interaction-binding.test.ts`.
`test/ui/editor/biome/HubVisitRanking.test.tsx` and focused map tests prove actual
controls; retain generic room-action ordering coverage with its existing owner.

Acceptance: partial-prefix append; prefix-only reorder; remove from a full
prefix does not substitute a tail room; explicit replacement names and replaces
the chosen visit only; cancellation does not edit; closed rooms cannot be visited;
List and Map display the same result after switching/Undo. Use an existing
completed-Hub fixture to verify removal's real engine handoff cleanup and Undo
without recreating that policy in an application helper. A real incomplete
first-visit fixture must still allow editing later visits through the Hub-owned
sequence interaction, while the later room's interior remains locked. Preserve
the witness that an incomplete pre-Hub prerequisite locks sequence edits.

### B.2 — Retire Timeline List

Base: `532d4d85`. Application-only simplification of the accepted Map behavior.
No new engine product, command, schema, eligibility policy, or map library.

Deliver Timeline directly as Map; retain Overview's List/Map choice and its
finding navigation. Preserve Reset, append, exact-position moves, removal,
explicit replacement, Undo, pre-Hub readiness, keyboard/Escape, and pan/zoom.
Reordering can invalidate room contents; those findings remain owned by the
room editor. Do not claim that all route contents remain valid after reordering.

The existing `hubVisitOrderIncomplete` finding still needs a repair destination.
Bind the next missing visit's exact marker to the existing planned-count status,
focusable on navigation, and bind authored visit markers to their map buttons.
Keep the inherited Hub readiness owner so room-local incompleteness cannot
lock sequence edits. Preserve the rail/tab destinations; no duplicate IDs,
hidden List, hidden editor targets, new status language, or second finding path.

Expected deletions: `HubVisitTimeline.tsx`, Timeline-only pieces of
`HubVisitRanking.tsx` and `HubRoomCards.tsx`, roster drag/scroll/focus state,
Timeline view-switch state, roster-only CSS and test support. Move the live
replacement chooser beside its Map consumer if its old module becomes obsolete.
Prune dead Hub-only helpers without changing generic RankedPrefix behavior used
by room actions. Overview room cards remain compact membership/reward cards.

Primary tests: retain Map workflows from `HubVisitRanking.test.tsx` under their
live owner; migrate List consumer contacts in `BiomeWorkspace.test.tsx`,
`HubDecisionWorkbench.interaction.test.tsx`, and `HubRoomCards.test.tsx`.
Retire List-only UI/drag/layout tests; preserve relevant semantic proposal tests
and shared room-action tests. Add a real incomplete-prefix finding-navigation
witness proving exact count focus/border and continued room selection. Preserve
the existing missing-first-room and locked-pre-Hub witnesses.

One executor owns implementation and affected tests; a fresh read-only reviewer
checks finding repair, deletion completeness, keyboard support, Overview and
room-action isolation. Main session owns browser checks at desktop/narrow
widths and broader related-test verification. Do not run full Gate C closure or
commit implementation until requested.

### C — Product review and closure

Keep one representative real application workflow using existing Surface
checkpoints: Overview membership/reward edits → Timeline append/reorder/replace
→ finding repair → Undo/Redo, plus Overview view switching. Add no large new execution fixture
or duplicated engine policy matrix for this presentation work.

Perform real-browser checks at desktop and narrow widths: nearest marker pairs,
long reward labels, edge popovers, keyboard/Escape, pan versus click, zoomed hit
testing, destination menus and pointer cancellation. Verify Fields and ordinary
map dialogs remain usable. User visual review is part of acceptance; don't
claim it from jsdom dimensions alone.

After focused tests and independent review stabilize, run `npm run check` once
for closure; it includes `npm run test`. Record truthful results in the closure commit.
Revise the owning Hub/static-map sections of `STRUCTURED_EDITOR_WORKSPACE.md`
and the asset note to describe the resulting model; do not append a bug diary
or duplicate it across documents. Delete this temporary plan at closure.

## Review and retirement boundaries

For each implementation gate, the main session supplies a bounded executor
packet, one write owner, and a fresh independent review after stabilization.
Review shared behavior against both views, current engine capabilities, and
unrelated room-action consumers, not solely screenshots or synthetic proposals.
Each gate has one coherent implementation commit after review; no automatic
commit before any user-requested inspection.

Retire the old Hub side-reference layout/toggle, flattened Hub runtime reference,
and superseded Hub-only implicit promotion/eviction paths. Update their owning
tests, retaining the generic tests that still describe room-action behavior.
Keep Overview List controls, exact repair targets, other rooms' static inspection assets,
and shared references used by Fields.

Non-goals: independent numeric ranks, conflict-tolerant rank persistence, a new
graph/editor library, route-line drawing, map-based room-detail navigation,
interactive Fields placement, inferred reward eligibility, new native game
hooks, revised Hub visit legality, schema migration, or execution fixture churn.
