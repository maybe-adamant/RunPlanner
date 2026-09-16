# Room Maps and Editing References

Status: Gates A/B/C implemented and independently reviewed; Gate D closure is next.
Base: `fa766878`.

Gate A verification: 59 focused viewer/asset/workbench tests passed, followed by
41 affected tests after review remediation. Planner typecheck, scoped ESLint,
format checks and production web build passed. Browser checks covered real
images, a placeholder, Fit/zoom/scroll, Close/Escape/focus, narrow layout and
additional-exit controls; the production preview loaded a packaged image.
All 107 copied screenshots are byte-identical to their sources; the remaining
154 declared rooms have placeholders. Native Tauri loading was not exercised.

Gate B verification: 26 focused asset/viewer/Fields tests, planner typecheck,
scoped ESLint, formatting and production build checks passed. Independent review found no
actionable issues. Browser checks covered the 70/30 wide layout, stacked narrow
layouts, a placeholder and a tall-image sizing probe, placement edits/Undo with
retained zoom, and Expand/Escape/focus.

Gate C verification: 52 focused tests and planner typecheck passed, followed by
20 affected tests after review and presentation corrections. Side generation,
destination inspection and Undo remain covered. Scoped ESLint/format checks and
production web build passed. Browser checks covered the annotated Hub asset,
closed four-column board, open responsive board/Timeline, a sticky Hub reference
at bottom rows and short window heights, separate main/side room dialogs,
full-width side-room controls, focus return, Exit/return visibility and unpinned
map-first narrow stacking. The source PNG is byte-identical to its packaged
copy. Gate D's complete phase-closure gate remains pending; native Tauri execution
was not exercised.

## Objective

Make room screenshots useful while choosing rooms and configuring spatially
relevant authoring. Ordinary and side rooms get inspection viewers; Fields
Layout and the Ephyra Hub can keep a reference image visible while the existing
controls remain usable.

Maps are static presentation assets. Later screenshots, merged images and
annotations replace those assets without changing application behavior,
authored plans, simulation or execution publication.

## Authority and Current Evidence

- `docs/design/ARCHITECTURE.md`, ownership and code placement: this is entirely
  application-owned presentation, not catalog normalization or engine work.
- `docs/design/EDITOR_MODEL.md`, workspace projection, bound interactions and
  findings/navigation: viewing is not a semantic edit or authoring prerequisite.
- `docs/design/STRUCTURED_EDITOR_WORKSPACE.md`, Desktop Sizing and Scroll
  Ownership, Focused Inspector, and Hub Decision Workspace: preserve inspector
  navigation, responsive stacking, board density and separate control ownership.

Current contacts:

- `OccurrenceWorkbench.tsx` owns the room heading and ordinary/H/O tabs. Its
  `WorkspaceRoomSummary` already carries `gameName` and the display label.
- `DecisionWorkbench.tsx` and `RoomSelector.tsx` own outgoing room selection.
  An authored target has its own `door.room`; inspection must use that identity,
  not the source room or selected continuation. Include the additional-exit
  presentations under `room-features/AdditionalExitControls.tsx` where their
  chosen room is displayed.
- `locals/FieldsWorkbench.tsx::FieldsLayoutWorkbench` owns the Entry, Cage,
  Optional and Nemesis position controls. Its parent can supply room identity;
  no new engine spatial product is needed.
- `HubDecisionWorkbench.tsx` owns Hub Overview, Timeline and Exit.
  `HubMembershipBoard.tsx`, `HubRoomCards.tsx` and `HubVisitTimeline.tsx` render
  the fixed 26-room board and compact visit roster.
- `locals/LocalVisitWorkbench.tsx` owns the side-room table inside a main room's
  Overview and destination map actions. Main-room inspection stays in the room
  heading; it does not add a second reference pane to the side-room table.
- `assembly/hub-assembly.ts` already reads fixed main and side room declarations,
  but `WorkspaceHubSlot` and the ungenerated `WorkspaceLocalVisitSlot` branch
  omit a directly usable room game name. Carry the existing identity into these
  application descriptors; do not construct an occurrence workbench to view it.
- `styles/room-workbenches.css` preserves the four/two/one-column Hub board and
  compact Timeline columns. `styles/responsive.css` stacks the biome rail and
  inspector at narrow widths. A map must not introduce an always-on third
  workspace column or reduce the editor below its current usable width.

The user supplied and authorized use of assets under
`/mnt/c/Users/Mohammed Ayyat/Desktop/Hades`. The `Maps` folder currently contains
111 WebP files, approximately 22.9 MiB, covering Erebus, Oceanus, Fields and
Tartarus. This is an ingestion source only, never a runtime filesystem path.
The user also supplied an annotated Ephyra Hub PNG (`Maps/Ephyra/Hub.png`),
which replaces the `N_Hub` placeholder unchanged for Gate C. Main and side-room
images remain individual placeholders; the Hub overview is not their substitute.
Surface and other missing room images initially use placeholders. Some images
contain incidental enemies/props: they are room references, not a preview of
the exact generated contents of the plan.

## Locked Product Decisions

### One replaceable image per room

- The stable lookup identity is the game room name, not a display label,
  occurrence ID, Hub visit number, physical door ID or a parsed slot key.
- Every supported declared room has a stable room-named image asset. Missing
  images contain a reusable, legible "Map not available yet" placeholder.
  Replacing one room's placeholder must not replace another room's image.
- An app-owned static asset lookup resolves that image. Prefer the existing
  Vite asset pipeline so browser and portable desktop builds consume the same
  files with correct build URLs. No runtime asset-folder scan, absolute local
  path, network service or game installation dependency.
- Keep filenames/references stable across image replacement. The image's
  intrinsic dimensions may change; fitting must not assume one aspect ratio.
- Commit only the room-map subset, not the entire extracted collection. Keep
  the supplied WebP content unchanged when no preparation is needed. Initial
  placeholder copies and lookup coverage can be prepared mechanically; do not
  build a new asset pipeline or require regeneration after a simple swap.
- `H_Combat01T/B` and `H_Combat05L/R` are split source images, not additional
  room identities. Final combined images require a separate user decision.
  Until supplied or explicitly approved, these two room assets may remain
  placeholders. Do not discard a half silently or introduce multi-image
  navigation to accommodate temporary source packaging.
- Fields annotations will be baked into replacement images following later
  in-game coordination. No point-coordinate metadata, interactive markers,
  live placement overlay or annotation generation is included here.

### One viewer, two hosts

Use one small image viewport with a room title, Fit, Zoom In/Out, readable zoom
status, and scrolling when enlarged. The viewport accommodates large/tall
images without stretching them. No mandatory drag/pinch gestures: visible
controls and ordinary keyboard-accessible scrolling are sufficient.

1. **Inspection dialog:** enlarged, accessible modal with Close/Escape and
   focus returned to the invoking control when it still exists.
2. **Editing reference pane:** a non-modal, closable region composed alongside
   existing controls. An Expand action opens the same image in the inspection
   dialog; closing that dialog leaves the reference and edits intact.

A missing map is an ordinary image, not a disabled feature or finding. A genuine
image-load failure gets a nonfatal local presentation message rather than an
application fault or invisible broken image. Map viewing must work for known
rooms even when their semantic authoring controls are blocked or invalid.

Visibility, selected preview room, zoom and scroll are transient UI state.
Keep state with the containing workbench, not authored history, persistence or
an application-wide mutable registry. Preserve visibility and zoom across edits
only while both the host identity and displayed game room name remain the same.
A room replacement can retain its occurrence ID: it must still switch the image
to the new game name and reset Fit. Changing the containing occurrence/Hub resets
or closes its reference; changing preview room also resets Fit. One reference per
workbench is sufficient. No pinning across navigation, docking framework,
resizable window manager, new browser window or popout Tauri window.

### Placement by editing surface

| Surface                                                                                | Map contact and behavior                                                                                                                                                   |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordinary room inspector, including fixed/start, story, shop, boss, side and ship rooms | View Map in the existing room heading beside utilities; opens inspection without changing tabs or navigation.                                                              |
| Outgoing physical target with a chosen room, picked or unpicked                        | Compact map action beside that target's room control/label; previews the target without selecting its exit. No invented action before a room identity exists.              |
| Fields Room Layout                                                                     | Reference map visible with the current Entry/Cage/Optional/Nemesis controls; closable and reopenable. No new Map tab. Other Fields tabs retain ordinary inspection.        |
| Hub Overview and Timeline                                                              | Hub Map at the top right opens the Hub's static reference. Both tabs share it; in side-by-side layout it stays visible while the board scrolls.                            |
| Hub main-room cards, including closed/unvisited cards, and Timeline rows               | Compact per-room map action beside the name opens inspection of that fixed main room. It does not replace the Hub reference, navigate the rail or alter membership/visits. |
| Side-room table row, generated or not                                                  | Compact map action beside the side-room name opens inspection of the declared destination. It never generates or visits the side room.                                     |

Per-room Hub/side inspection dialogs are distinct from the persistent Hub
editing reference. Their titles must make the shown room unmistakable.

Reference layout uses the available container width, not just viewport width:
map and controls side by side only when both have useful space; otherwise map
above controls. Fields puts compact placement controls on the left (roughly 30%)
and the map on the right (roughly 70%), with a minimum usable control width rather
than a forced ratio at narrow sizes. Both share one outer panel and aligned
headers; the inline map combines its heading and viewer actions in one toolbar.
Keep the viewport bounded so a tall image does not create an
unbounded page. Existing controls retain their natural width and scroll behavior;
opening the map must not put the rail or unrelated panels into a new scrollport.
Closed map panes restore the existing layout. Placeholder images use the same
viewer geometry and do not change control placement when replaced later.

Hub cards gain no thumbnails, extra detail rows or separate Map column. Preserve
the four-column normal board and compact roster when the reference is closed;
when it is open the existing container-responsive rules may reduce columns.
The Fields and Hub references are sticky within their editing surfaces, not fixed
to the app; they scroll normally when stacked above controls. Zoomed-image
scrolling remains available inside the image viewport. The side-room table keeps its full width.
Map buttons are separate from membership labels, row reorder grips and rewards,
so pointer, touch and keyboard activation cannot trigger those interactions.

## Implementation Ownership and Bounds

- Keep image assets, their lookup, viewport, dialog and reference-pane styling
  in one application-owned `apps/planner/src/ui/room-maps/` neighborhood. Start
  with ordinary modules, not a generic media framework or convenience barrel.
  Explicit inputs are game room identity, title and local visibility callbacks;
  the product is rendered reference content, never a command capability.
- Existing workbench components compose this feature and continue owning their
  authoring controls. No second copy of Fields, Hub or side-room editors inside
  the map dialog. Reuse only the narrow layout wrapper needed by the reference
  presentations.
- Application projections carry missing game names from existing declarations
  through `contracts/structure.ts`, `contracts/locals.ts` and `hub-assembly.ts`.
  Supply the Hub map's concrete room identity from the existing progression
  descriptor's `terminal.roomGameName`;
  React must not derive it from `hubKey`, labels or hardcoded biome assumptions.
  Assets themselves need not enter engine or workspace semantic products.
- No catalog/engine production changes, native Rust/game-module changes, new
  dependency unless concretely justified, saved schema/protocol changes or
  execution/authored fixture refreshes are expected.
- No room-picker candidate thumbnail/gallery redesign, new navigation hierarchy,
  spatial authoring, live annotations, screenshot capture, image merging, trait
  artwork, loading another plan or changing incomplete-horizon policy.

## Delivery Gates

### A — Room image assets, shared viewer and ordinary inspection

Deliver stable per-room assets/placeholders, the shared viewport and dialog,
room-heading launchers and outgoing-target launchers as one usable slice.
Include fixed/start rooms and nonselected outgoing targets, not only entered
ordinary combat rooms. Initial source inventory must catch filename/key mismatches
and explicitly leave the split-room assets pending; do not guess aliases.

Primary acceptance:

- One asset-owner test validates declared-room coverage, resolvable files and
  deliberate known mappings, including a placeholder. This is presentation asset
  integrity, not a duplicate room catalog or topology evaluator.
- Viewer tests cover image/title, placeholder, load error, zoom/Fit state and
  Close/Escape/focus behavior. Do not simulate browser layout to claim visual proof.
- Representative `OccurrenceWorkbench.test.tsx` and `DecisionWorkbench.test.tsx`
  contacts prove the correct room opens, including a different unpicked target,
  and authored state/navigation/Undo remain unchanged by viewing.
- Production web build resolves the packaged images without using the extraction
  directory. Check desktop asset loading in the actual host when available;
  do not claim native execution from a jsdom test or a Vite build.

### B — Fields Layout reference

Compose the shared map pane with the existing Fields Layout controls. Pass room
identity from `OccurrenceWorkbench`; keep all placement interactions and finding
targets in their current owners. Add responsive reference layout and Expand.

Primary acceptance:

- Use an existing real H Fields fixture to open Layout, view its map, change a
  position through the existing radio control, and keep the reference open.
  Undo remains the existing semantic edit; map operations create no history.
- Replace the room while retaining the same occurrence ID: the reference shows
  the new room image and resets Fit. Navigating to another occurrence likewise
  cannot retain the previous room's image.
- Close/reopen/Expand preserve a usable editor and exact finding navigation.
- Visually inspect wide and narrow workbench widths, a tall/large image and a
  placeholder. Position labels and map controls remain usable together.
  Annotation accuracy is expressly not claimed before annotated images exist.

### C — Hub and side-room references

Carry missing declaration identities through the application descriptors, add
the Hub reference across Overview/Timeline, add per-main-room inspection actions,
and add destination inspection to the full-width side-room section.
Keep the rail as room-detail navigation and preserve the current compact board.

Primary acceptance:

- An existing Surface fixture provides closed and open Hub cards, a visit roster,
  and a main room with generated/ungenerated side slots. Inspect each declared
  identity without generating, opening, visiting or navigating to it.
- Hub Map survives Overview/Timeline switching; a per-room inspection dialog
  leaves that Hub reference and the roster/membership state intact.
- Main-room heading inspection and side-row inspection display their own correct
  identities. Side generation/order/reward edits use the unchanged controls;
  viewing generated or ungenerated destinations does not edit them.
- Representative Hub interaction tests protect checkbox, drag/reorder, reward
  and finding contacts. Do not replicate the engine's full Hub policy matrix.
- Visual review covers the four-column closed-pane board, open-pane responsive
  layout, sticky map while editing bottom rows, compact Timeline, full-width
  side-room table, and narrow stacked presentation without pinned overlays.

### D — Independent review and closure

Review the completed feature against image identity, static asset replacement,
inspection-versus-editing behavior, focus/readiness, Hub/Fields density, ownership
and unintended evaluation/fixture churn. Main session owns one bounded remediation
pass, broad verification and final visual assessment.

During implementation use focused application projection/UI tests; keep tests
under `apps/planner/test/` mirroring the owner. Shared viewer behavior has one
primary test owner; embedding surfaces retain representative workflow witnesses.
Use current real H/Surface fixtures without modifying their authored content.
No synthetic fixture family, browser testing platform or repeated broad gates
are required for this feature.

Run `npm run check` once after stable review fixes, rerunning only failed affected
lanes after remediation. Verify source images were not altered, unrelated assets
were not imported and no game/execution fixture changed. Report unavailable
native/manual visual checks honestly rather than inventing a passed smoke test.

At closure integrate only map placement and static-reference ownership into the
existing editor/workspace authority, and retain a short asset replacement note
beside the assets. Remove this plan. Do not add the plan to README or create a
new durable design/audit document for this presentation-only feature.

Each A/B/C gate is a complete usable commit boundary, with independent review
and focused remediation before commitment. Commit the agreed plan before starting
implementation. Image preparation/annotations can arrive later without reopening
these gates; no deployment or pushing is part of this plan.
