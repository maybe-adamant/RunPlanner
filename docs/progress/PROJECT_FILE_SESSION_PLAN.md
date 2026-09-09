# Project File Session Plan

## Status and base

Status: **Drafted for review; implementation has not started**.

Planning base: `73a25a2e`.

This plan is application- and desktop-host-only. It does not change the
authored project schema, catalog, simulation, execution plan, or game module.

## Objective

Give project files one coherent lifecycle across the browser and the portable
Tauri application:

- browser/local-web sessions keep portable upload/download behavior and
  anonymous autosave recovery;
- Tauri remembers the last successfully accepted project file across process
  restarts;
- restoring newer autosave work in Tauri retains that file as the destination
  of the next ordinary Save;
- Tauri exposes standard Save As behavior for deliberately changing the active
  file; and
- New, Load, Save, Save As, and Publish to Game move into one accessible File
  menu while the existing publication dialog remains the second step.

The user-visible desktop result is:

```text
Load or first Save As -> active file A
edit -> autosave recovery changes, file A does not
restart -> recover edits, still associated with file A
Save -> overwrite file A
Save As -> write file B and make B active
```

## Current implementation and defect

- `ProfileFileAdapter` returns a host-owned `ProfileFileReference` from Load or
  first Save. `createProjectOperations` retains it in the local
  `activeProfileFile` closure, so repeated Save writes in place only for the
  lifetime of that JavaScript process.
- New clears that in-memory reference. Successful Load replaces it only after
  the selected document parses and its workspace prepares successfully.
- Application startup consults only `AutosaveRecoveryAdapter`. Both browser and
  Tauri composition currently use the browser `localStorage` implementation.
- Autosave intentionally stores only normalized authored JSON. It does not
  preserve an explicit baseline or file path and therefore reopens as
  `Recovered` / unsaved.
- Tauri's dialog-selected filesystem scope is dynamic and is not retained
  across restarts. Remembering a path in React or Redux would not itself
  recreate a safe writable native reference.
- Browser references deliberately write by downloading another file. Firefox
  and the supported browser contract do not provide a durable cross-browser
  writable file handle.
- `ProjectFileControls` presently renders New, Save, Load, and Publish as a
  wrapping header button row. Publish already owns a real modal dialog after
  target discovery.

The current durable documentation also contains a stale contradiction:
`EDITOR_MODEL.md` says a successfully loaded host file does not become the
active Save target, while the application, architecture document, tests, and
README say that it does within the session. Closure must state the new
cross-restart contract once.

## Locked decisions

### Authored data and host identity remain separate

- A project file continues to contain exactly one normalized
  `ProjectDocument`.
- Absolute paths, native handles, recent-file identity, autosave status, and
  explicit baselines never enter project JSON, schema migrations, undo/redo,
  simulation, or execution-plan publication.
- Autosave remains a recovery channel. It never writes the active project file
  and never marks a project clean.
- Persistent file identity is machine-local Tauri host-session metadata. It is
  not required to travel with the portable executable or project file.
- Do not introduce a generic preferences framework, service registry, or
  wrapper document. Add only the narrow active-profile capability this plan
  consumes.

### Browser/local-web policy

- Startup restores the browser autosave exactly as it does now: recovered work
  is anonymous and unsaved.
- Load uses an upload and Save uses a download. A remembered basename may name
  later downloads, but it is not a writable file association.
- The browser File menu exposes one Save command. A second Save As item would be
  a duplicate of the same download operation and is omitted.
- No File System Access API, origin-private filesystem, persisted browser
  handle, or browser-specific enhancement is added.

### Tauri active-file policy

- The native host persists at most one last accepted profile path.
- A path becomes active only after:
  1. a generated project snapshot is successfully written by first Save or
     Save As; or
  2. a selected file is read, decoded, simulated, and immediately projected
     successfully by Load.
- Cancelled, unreadable, invalid, stale-schema, or preparation-failing Load
  never replaces the previously active path.
- New clears the active association before the new route becomes the current
  project.
- Discard Autosave removes only recovery data. It does not discard a valid
  remembered profile path; after restart the accepted disk file can reopen.
- Save writes the current normalized snapshot to the active native file. With
  no active file, it follows the existing first-save Save As path.
- Save As always opens the native save dialog, writes the current normalized
  snapshot, makes the selected file active, and establishes that snapshot as
  the explicit clean baseline.
- Standard Save As semantics apply: it switches the active document to the new
  file. This plan does not add a separate Save a Copy operation.
- A cancelled or failed Save As leaves the prior active file and explicit
  baseline unchanged.

### Desktop startup reconciliation

Before constructing the synchronous application, the Tauri composition root
may asynchronously ask the native profile-session adapter for the remembered
file and its raw contents. Project decoding and workspace preparation remain
application responsibilities; Rust performs no schema or planner work.

Startup resolves disk and autosave inputs as follows:

| Remembered file                 | Autosave                                           | Startup result                                                                                                                                                       |
| ------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| absent                          | absent                                             | Existing route chooser.                                                                                                                                              |
| absent                          | valid                                              | Existing anonymous `Recovered` project; first Save asks for a file.                                                                                                  |
| valid                           | absent                                             | Open remembered file, bind it, and establish a clean baseline.                                                                                                       |
| valid                           | valid and byte-equivalent after canonical encoding | Open remembered file clean and bind it.                                                                                                                              |
| valid                           | valid and different                                | Open autosave as `Recovered`, retain the disk snapshot as explicit baseline, and bind Save to the remembered file.                                                   |
| missing or unreadable           | valid                                              | Recover autosave anonymously, clear the stale association, and report the file problem without losing work.                                                          |
| invalid project file            | valid                                              | Recover autosave anonymously, clear the unsafe association, and report the file problem rather than silently overwriting it.                                         |
| valid                           | corrupt/unsupported autosave                       | Preserve and block the autosave under the existing recovery policy; retain the remembered association so discarding recovery and restarting can open the valid file. |
| missing, unreadable, or invalid | absent                                             | Clear the stale association, remain at the route chooser, and report the startup file failure.                                                                       |

Canonical equality is about normalized project content, not whitespace in the
source file. A matching autosave is not presented as recovered merely because
its JSON formatting differs.

### Native boundary

- The Tauri host owns the remembered path and native reads/writes needed to
  reconstruct its reference after restart.
- The host stores that path in the ordinary machine-local application-data
  location, not in the executable directory or authored file.
- Native commands accept and return raw profile bytes and bounded file-session
  results. They do not parse planner JSON, calculate dirty state, choose
  recovery precedence, or publish to the game.
- Initial Open and Save As continue to use native dialogs. The application
  activates their returned path only after the owning operation succeeds.
- Restored writes use the host-owned active reference rather than expanding the
  filesystem plugin to arbitrary permanent path access.
- Host failures are returned as explicit operation/startup failures. They are
  not guessed away and do not erase a valid autosave.

### File menu

With a project open, the wrapping file-action button row becomes one accessible
File menu:

```text
New
Load…
────────
Save
Save As…          Tauri only
────────
Publish to Game…  when the desktop publication capability exists
```

- Use an established accessible menu primitive with keyboard navigation,
  focus return, outside-click dismissal, and Escape handling. Do not emulate a
  menu with an unstructured popover or `div` click handlers.
- Selecting an operation closes the menu before its native dialog or async work
  begins.
- Publish to Game performs the existing discovery and opens the existing modal
  profile/slot dialog. Its compiler, discovery, slots, and publication behavior
  do not change.
- Profile status and operation feedback remain visible outside the menu.
  Undo/Redo and About remain independent header controls.
- The no-project/New entry panel keeps its route chooser, Load affordance, and
  blocked-recovery actions; it does not render an empty File menu.
- This pass adds no new global file keyboard shortcuts. They can be considered
  separately without coupling persistence correctness to menu delivery.

## Ownership

### Application persistence

`apps/planner/src/persistence` owns the cross-host file contracts, the browser
download/upload adapter, the Tauri profile-session adapter, and startup input
normalization. The contract must expose the difference between a downloadable
reference and a durable native target without making React inspect Tauri.

`apps/planner/src/workspace/projectOperations.ts` owns atomic New, Load, Save,
and Save As semantics. It receives an optional restored active reference at
construction; it does not discover native paths itself.

`apps/planner/src/composition` owns canonical startup reconciliation of the
prepared autosave and remembered disk project. Redux receives the resulting
project, baseline, filename, and recovery status as ordinary initial session
state. Redux never stores the absolute path or a native callback.

### Tauri host

`apps/planner/src-tauri` owns machine-local active-path persistence and the
narrow native read/write commands required after restart. It remains a thin
host and has no planner-engine dependency or JSON semantics.

### React

`ProjectFileControls` owns menu/dialog presentation and pending/result
feedback. It invokes complete project operations and does not implement target
activation, recovery precedence, baseline selection, or host detection.

## Delivery gates

### Gate A — Durable Tauri file session

1. Add the narrow native active-profile store and restored read/write/clear
   commands.
2. Extend the Tauri profile adapter so a dialog-selected reference can be
   activated only after an accepted operation and a restored reference can
   write after process restart.
3. Add pre-application desktop bootstrap without making general application
   construction asynchronous.
4. Reconcile remembered disk content with autosave according to the locked
   startup matrix, preserving canonical parsing/preparation and corrupt
   recovery behavior.
5. Seed project operations with the restored active reference; clear it on New
   and preserve it across ordinary recovery restoration.

Primary witnesses:

- valid remembered file with no autosave opens clean;
- equivalent autosave remains clean;
- newer autosave restores while Save overwrites the remembered file;
- missing/invalid remembered file recovers autosave anonymously;
- corrupt autosave remains blocked without losing the remembered file;
- invalid/cancelled Load does not replace the active target; and
- New removes the durable association.

Commit boundary: `feat(desktop): restore active profile sessions`.

### Gate B — Standard Save As

1. Add one `saveProfileAs` application operation that always requests a new
   target and switches association only after a successful write.
2. Preserve the current active target and baseline on cancellation or failure.
3. Publish a narrow host capability indicating whether Save As is meaningfully
   distinct; do not branch React directly on Tauri globals.
4. Keep browser Save/download behavior unchanged and omit a duplicate browser
   Save As action.

Primary witnesses cover first Save, repeated Save, successful Save As followed
by Save to the new target, cancellation, failure, browser download behavior,
and New after Save As.

Commit boundary: `feat(app): add native profile Save As`.

### Gate C — File menu

1. Replace the open-project file-action row with the accessible File menu and
   capability-driven entries.
2. Preserve status, operation feedback, entry-panel recovery controls,
   Undo/Redo, and About placement.
3. Launch the unchanged Publish to Game dialog from the menu and prove that
   publication does not change the active project file.
4. Cover menu focus/dismissal, disabled/pending behavior, browser versus Tauri
   entries, operation results, and publication-dialog handoff at the UI
   boundary.

Commit boundary: `feat(ui): add project File menu`.

### Gate D — Closure

1. Exercise a portable Windows build: Load file A, edit, allow autosave,
   restart, Save, and confirm file A is overwritten without another dialog.
2. Exercise Save As to file B and confirm later Save updates B while A remains
   unchanged.
3. Exercise missing remembered file plus valid autosave and corrupt autosave
   plus valid remembered file.
4. Confirm browser/local-web startup and downloads retain their existing
   behavior.
5. Run the complete repository gate once, including the desktop Rust check and
   production build.
6. Reconcile `README.md`, `ARCHITECTURE.md`, and `EDITOR_MODEL.md`; record the
   completed delivery and delete this temporary plan.

Commit boundary: `docs(app): close project file sessions`.

## Acceptance matrix

| Action                     | Browser/local web                                | Tauri                                               |
| -------------------------- | ------------------------------------------------ | --------------------------------------------------- |
| New                        | Fresh unsaved project                            | Fresh unsaved project; durable target cleared       |
| Load valid A               | Upload A; later Save downloads with its basename | A becomes active only after complete preparation    |
| Load invalid/cancelled B   | Existing project and basename unchanged          | Existing project, baseline, and active A unchanged  |
| First Save                 | Download                                         | Native Save As dialog; selected file becomes active |
| Save with active A         | Download another file                            | Overwrite A                                         |
| Save As B                  | Not separately exposed                           | Write B and make B active                           |
| Restart after clean Save   | Anonymous autosave recovery when present         | Reopen bound file clean when recovery is equivalent |
| Restart after unsaved edit | Anonymous recovered project                      | Recovered project still bound to active file        |
| Publish to Game            | Unavailable                                      | Existing modal publication; active file unchanged   |

## Explicit exclusions

- No authored-project or execution-protocol schema change.
- No browser File System Access API or persisted browser handle.
- No Save a Copy, recent-files list, file rename/move/delete, or directory
  browser.
- No implicit write to the active profile during autosave or shutdown.
- No path stored in project JSON, autosave JSON, Redux, undo history, or game
  publication.
- No relocation of recovery data beside the portable executable.
- No game-profile discovery or publication behavior change.
- No general application-preferences framework and no persistence service
  locator.
- No new global file keyboard shortcuts in this delivery.
