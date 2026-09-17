# Hub Map Editor

## Status and objective

Status: Gate A is committed as `41915681`; Gate B's independently reviewed map
ordering checkpoint is `1e15ce01`. Panel polish is committed as `532d4d85`.
Focused tests, static checks, and browser checks passed for those checkpoints.
Gate B.2 and its presentation polish are user-approved for this checkpoint.
Timeline uses append/Reset with visible reward icons; Overview defaults to Map
with Details as the canonical finding fallback. The clean background and shared
annotations replace the capture markers. Engine reorder commands remain intact.
Independent reviews found no actionable issues in the simplified Timeline,
reward icons, or atomic Reset Board command. Focused command/binding/Hub checks
(37), architecture and related UI checks (92), and final presentation/product-loop
checks (80) pass, along with planner typecheck and touched lint/format. The icon
production build passed. Desktop/narrow browser checks cover map alignment,
icon interaction, Reset/Undo, Details/Back focus, control placement and overflow.
Gate C's complete repository gate and documentation closure have not started.

Planning base: `7d42d084` (`feat(planner): support dragging zoomed room maps`).
The unrelated Room Capture progress document is outside this change.

Give Ephyra Hub Overview a primary Map and detailed List fallback, and make
Timeline a single map-based sequence editor. Both consume the same application
interactions and engine-owned ordered visit model.

## Scope and authorities

Hub membership, reward-control presentation, visit-order proposals, map
assets/annotations, and finding/focus integration. The sole engine addition is
the atomic `ResetHubBoard` command, reusing existing topology-removal closure
while retaining the Hub decision and source. No catalog,
authored schema, simulation, candidate-policy, execution-protocol, or game-module
changes. Engine commands retain ownership of topology and cleanup.

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

The Timeline no longer needs a ranked-roster presentation model. Append and
Reset send complete proposals through the existing Hub interaction. Retain the
engine's full visit-order command and its application binding, including support
for reorder proposals; this is a UI simplification, not a domain restriction.
Generic `RankedPrefix` functions still serve room-action ordering and must not
change with the retirement of Hub-only presentation helpers.

## Agreed experience

### Two views, one source

- Overview opens in Map by default. `Details →` beneath Reset Board opens the
  detailed List; its header offers `Back to Map`. Findings still open List at
  the exact repair control, including on initial navigation. Timeline is
  map-only; Hub Exit retains its existing presentation.
- Remember Overview's view choice locally for the current Hub host. View,
  selected marker, popover, drag, zoom and pan are not authored state or Undo
  entries. Changing the project/Hub host cannot retain stale marker selections.
- Overview List retains its compact layout and controls, with no inline Hub map. Map
  gets the available workbench width, not a second full editor beside it.
- Overview views share a panel shell. Both maps overlay Zoom/Fit at the
  viewport's top left; Overview places Reset Board and Details beside the
  top-right legend, and Timeline places Reset visits there. Neither map has
  a toolbar row above the canvas. Controls and legends stay fixed while the
  image pans or zooms. The Hub uses the standard room
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
- An open door shows its room number above a small authored-reward icon. Clicking it
  exposes the existing reward control, not another reward picker
  implementation. Show missing authored reward state honestly.
- Keep full controls in one active anchored popover rather than placing editors
  beside all 26 circles. Include an explicit Close room action there, subject
  to the existing close capability; clicking an open circle never closes it.
- Opening/closing and reward edits dispatch their existing single intents.
  Re-read the current slot by stable identity after publication; do not retain
  stale bound interactions inside a popover.
- `Reset Board` closes every slot, clears visits and Hub-owned room/handoff
  contents, and retains the Hub itself. It dispatches one bound `ResetHubBoard`
  intent, never a UI loop of slot closures. One Undo restores all contents.
  Render it beside the legend in Map and in List's header; disable it on an
  empty board or when Hub authoring is locked. No confirmation or schema change.

### Timeline: construct a sequence

- Show annotations for open rooms only, including open but unvisited rooms.
  Closed-room annotations disappear; the underlying map does not change shape.
- Keep room identity inside the circle. Show `Visit 1`, etc. as a distinct badge,
  never replace room 12's identity with its chronological rank. Visited markers
  are solid; unvisited markers are translucent, not disabled. Category color
  retains its existing meaning. The Map has no separate sequence strip.
  Capacity comes from the existing workspace product (currently six), not a
  second limit declaration.
- Both map editors show the authored reward icon inside the existing circle,
  below its room label. Keep icons and labels opaque while only unvisited
  backgrounds are translucent. Full projected reward names remain available
  to hover and assistive technology; unknown/missing rewards are not guessed.
  Package normalized transparent icons locally and map from the existing
  structured reward identity, never summary text. Closed rooms retain `Closed`.
  This adds no engine, schema, or click-behavior changes.
- Clicking an unvisited room appends it at the next position when space remains,
  without opening a menu that interrupts sequential room selection.
  Visited rooms and all rooms at capacity have no click action; no implicit
  replacement occurs. Keep markers focusable for exact finding navigation and
  reward descriptions, with inactive controls identified accessibly.
- A Timeline-only Reset visits button beside the top-right map legend, with a
  subtle red border, clears the sequence with one undoable
  empty-prefix proposal. It preserves open rooms
  and their rewards, uses existing engine-owned handoff cleanup, and requires
  no confirmation. Disable it when empty or when Hub editing is locked. The
  author can then click unvisited markers to rebuild the sequence in order.
- Reward icons, hover titles and accessible descriptions provide the Timeline's
  reward preview; there is no click-to-preview popover.
  There are no Move-to, swap, replacement, or individual removal actions.
  Reset rebuilds the sequence; Undo corrects accidental edits.
- The map is the sole Timeline editor. Remove the List roster, drag/arrow path,
  and transient unvisited-tail ordering; no hidden editor or alternate route
  may silently substitute another room.
- Produce one complete visit-order proposal through the existing bound candidate
  interaction and `ReplaceHubVisitOrder`. These are sequence edits, not a new
  validator. Respect candidate/readiness outcomes. The engine alone reconciles topology,
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
  cannot prevent appending or resetting the Hub sequence; an incomplete prerequisite before
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

The canonical background is the untouched, clean 2560 × 1440 capture:

`C:/Users/Mohammed Ayyat/Saved Games/Hades II/Screenshots/Hades II_557.png`

`HubMapAnnotations.tsx` owns all 26 door positions and the user-approved
Perfect/Good/Bad/Special categories. Coordinates are expressed directly against
this capture: no image padding, image translation, runtime offset or retained
old coordinate system. An external reference overlay is available at:

`C:/Users/Mohammed Ayyat/Saved Games/Hades II/Screenshots/New folder/Annotated/N_Hub.overlay.svg`

These categories are presentation metadata, not game legality or opening state.
Keep categorization separate from Opened/Unvisited/Visit status. The screenshot
contains no capture labels or reward markers; room numbers, rewards and status
come from the shared live annotation layer. Inspection and editing use the same
`N_Hub.webp` background without a second flattened runtime map.

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
- Reward icons live beside the Hub editor, outside the room-image glob. Sources
  are the user's `Hades/Items` PNGs; trim transparent margins, fit to 112 × 112
  inside a transparent 128 × 128 canvas, and export lossless WebP. Both maps
  share one structured-identity mapping and marker-content component.
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

### B — Map Timeline checkpoint

Delivered as `1e15ce01`. Its local move/replacement menus and List companion
are superseded by B.2. Retain engine visit-order operations and generic room
action ordering; the final application acceptance is defined below.

### B.2 — Append and Reset on the Timeline map

Base: `532d4d85`. Application-only simplification of the accepted Map behavior.
No new engine product, command, schema, eligibility policy, or map library.

Deliver Timeline directly as Map; retain Overview's Map/Details navigation and its
finding navigation. Deliver append, visible reward/visit markers, Reset,
Undo, pre-Hub readiness, keyboard interaction, and pan/zoom. Reset retains the native
command's downstream cleanup; Undo restores it as one semantic edit. Room
content findings remain owned by the room editor. No separate draft state.

The existing `hubVisitOrderIncomplete` finding still needs a repair destination.
Bind the next missing visit's exact marker to the existing planned-count status,
focusable on navigation, and bind authored visit markers to their map buttons.
Keep the inherited Hub readiness owner so room-local incompleteness cannot
lock sequence edits. Preserve the rail/tab destinations; no duplicate IDs,
hidden List, hidden editor targets, new status language, or second finding path.

Expected deletions: `HubVisitTimeline.tsx`, Timeline-only pieces of
`HubVisitRanking.tsx` and `HubRoomCards.tsx`, roster drag/scroll/focus state,
Timeline view-switch and preview-popover state, roster-only CSS and test support, local reorder and
replacement menus, and their Hub-only projection helpers/exports/tests. Preserve
the bound complete-order interaction and engine commands/tests, and do not
change generic RankedPrefix behavior used by room actions. Overview room cards
remain compact membership/reward cards.

Primary tests: focused `hub-map/HubMapTimeline.test.tsx` owns append-to-capacity,
readable inactive markers with no history mutation, Reset with real
handoff cleanup and Undo, and the incomplete-first-room readiness witness.
Migrate consumer contacts in `BiomeWorkspace.test.tsx`,
`HubDecisionWorkbench.interaction.test.tsx`, and `HubRoomCards.test.tsx`.
Retire obsolete List/menu UI and Hub-only presentation-policy tests; preserve
engine command, bound proposal, and shared room-action tests. Keep the real incomplete-prefix finding-navigation
witness proving exact count focus/border and continued room selection. Preserve
the existing missing-first-room and locked-pre-Hub witnesses.

One executor owns implementation and affected tests; a fresh read-only reviewer
checks finding repair, deletion completeness, keyboard support, Overview and
room-action isolation. Main session owns browser checks at desktop/narrow
widths and broader related-test verification. Do not run full Gate C closure or
commit implementation until requested.

### C — Product review and closure

Keep one representative real application workflow using existing Surface
checkpoints: Overview membership/reward edits → Timeline append/Reset
→ finding repair → Undo/Redo, plus Overview view switching. Add no large new execution fixture
or duplicated engine policy matrix for this presentation work.

Perform real-browser checks at desktop and narrow widths: nearest marker pairs,
long reward labels, edge popovers, keyboard/Escape, pan versus click, zoomed hit
testing, inactive Timeline markers and pointer cancellation. Verify Fields and ordinary
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
