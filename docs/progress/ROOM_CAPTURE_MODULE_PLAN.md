# Internal Room Capture Mod

Status: Gate A complete; Gate B is next.
Planning base: `d6afab94` in RunPlanner-main.
Locked plan commit: `ee999384`.

## Delivery State

Gate A is committed as `5c177ae` in the standalone repository. With user
approval, its `src/` was fast-copy deployed to `h2-dev` on 2026-09-16 and
verified byte-for-byte. No other package was deployed or enabled/disabled.
The fallback window currently exposes concrete F/G combat, shop, and postboss
rooms. Native run/room loading is retained; the capture encounter is completed
Empty, shop examples are supplied before native stock spawning, and ordinary
reward examples are added after presentation. Camera framing and HUD ownership
have explicit stop/disable cleanup, including a native load already in flight.

Independent review found HUD ownership and disable-during-load issues; both
were corrected. Lua syntax, focused capture/lifecycle tests, and the real
ModpackLib boot/UI workflow pass: room selection, deferred Load, repeated Load,
rendered status, zoom/pan/reset, and HUD cleanup. Native presentation/setup
failures report Error and release capture framing. The boot harness reports its
expected missing native config-path warning. A suspended/resumed coroutine
witness covers deferred disable through scene setup and cleanup; it is not
evidence of native rendering.

The user confirmed the capture workflow works in-game, then separately
confirmed the extended 10% minimum zoom works. This closes Gate A's native
acceptance; it does not establish coverage for specialized rooms. Zoom remains
adjustable in 5% steps up to 150%. The focused checks passed after that change;
closure changes only record acceptance and were not a reason to rerun them.

Gate B adds Fields and Hub placement coverage using this same loader/camera.
Gates B–D have not started. No planner implementation, modpack wiring, executor,
or Lib changes were made.

## Outcome and Bounds

Build a standalone, coordinator-free Hades II mod for making room reference
images: load a chosen room directly, remove combat, show useful distinguishable
rewards at native positions, frame the room, then take a screenshot manually.
The user annotates that image outside the game and replaces the planner asset.

Package: `adamantRunPlanner-Room_Capture`, in the separate local repository
`/home/ayyatma/wsl-projects/modding/modpacks/adamantRunPlanner-Room_Capture`,
outside `run-planner-modpack` and the planner application. Use ModpackLib's
existing fallback window/menu. Do not register with the Run Planner coordinator
or modify its dependency list, release tools, executor, or execution protocol.
Creating a remote repository, publishing, and deployment are not implicit steps.

The user owns save backups and disables the executor while capturing. No backup,
save interception, rollback, resynchronization, or inter-mod arbitration work.
Capture sessions are disposable; they need not remain playable or legal runs.

Other exclusions: screenshot automation, stitching, an annotation editor, live
planner overlays, importing plans/catalog code, reward eligibility simulation,
trait offer editing, a general debug console, and a reusable modding framework.

## Source Facts and Native Contacts

Game sources for this workstation live at
`/home/ayyatma/wsl-projects/modding/1GameData/Scripts/`.
Lib sources/docs live under
`/home/ayyatma/wsl-projects/modding/modpacks/run-planner-modpack/adamant-ModpackLib/`.
These are development references, never runtime dependencies on local paths.

| Responsibility      | Source evidence                                                                                                                                              | Planned use                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coordinator-free UI | Lib `docs/module-authors/GETTING_STARTED.md`, Fallback UI; `docs/lib-contributors/MODULE_BOOTUP_LIFECYCLE.md`, Uncoordinated Fallback Boot                   | Normal `createModule`/declarations/`activate`, with `fallbackUi.attachGuiOnce` and a dedicated pack ID that has no coordinator. No new host.                                                            |
| Direct room entry   | `DeathLoopLogic.lua::StartOver` forwards `StartingRoomName` to `RunLogic.lua::StartNewRun` as `RoomName`, then calls `LoadMap`                               | Start each requested scene through this native run/load path, with capture-specific arguments and narrowly scoped hooks. Do not copy the run constructor or teleport a half-initialized room.           |
| Room preparation    | `RunLogic.lua::CreateRoom` copies a declaration, chooses encounters and rewards; `RoomLogic.lua::OnAnyLoad` initializes map state and calls `StartRoom`      | Install scene choices before their owning setup stage. Preserve native map, hero, art and obstacle initialization.                                                                                      |
| Combat boundary     | `RoomLogic.lua::StartRoom` runs room events before `StartEncounter`; `EncounterLogic.lua` waits on `BlockSpawnsOff` when `SessionState.BlockSpawns` is set   | Spawn blocking alone is not a finished capture scene. Suppress capture encounter execution and independent enemy spawners at their actual contacts; do not wait for combat victory to expose rewards.   |
| Camera              | `RoomPresentation.lua::StartRoomPresentation` sets clamps, camera target and zoom; `AdjustZoom`, `FocusCamera`, `PanCamera` are used by native presentations | Apply framing after room presentation has established the camera. Preserve manual framing until another room is loaded or Reset is selected.                                                            |
| HUD                 | `HUDLogic.lua::HideCombatUI`, `UnblockCombatUI`, `ShowCombatUI`                                                                                              | A capture-owned hide reason, plus a way to reopen controls while the HUD/window is hidden.                                                                                                              |
| Fields objects      | `RoomDataH.lua::H_CombatData.StartUnthreadedEvents`; `RoomLogic.lua::SpawnRewardCages` and `SpawnPassiveFieldsEnemies`                                       | Cage spawning and passive enemies are distinct. Keep the former's native object construction; suppress the latter. Cages use sorted `LootPoint` IDs; optionals use sorted `BonusRewardSpawnPoints` IDs. |
| Hub doors           | `RoomDataN.lua::N_Hub.PreObstacleSetupEvents` and `PredeterminedDoorRooms`; `RoomLogic.lua::ChooseAvailableN_HubDoors`                                       | Availability is selected before obstacle setup. Make declared destinations visible at that point, preserving physical door-to-room identity. Do not just unlock the already reduced board afterward.    |

Important implementation constraints established by these sources:

- Native start events and presentation sometimes read `RoomData[name]` rather
  than the room instance. A room-instance override alone does not intercept
  every event. Identify the exact consumer before choosing a hook or temporary
  declaration change; never duplicate all of `StartRoom` to avoid this.
- `StartOver` can load a named room, but that does not prove every specialized
  entrance works without its predecessor. Supply only the room-family context
  shown necessary by source tracing and an in-game probe. Do not fabricate route
  history or build a miniature navigation simulator.
- `StartRoom` can wait for encounter-start proximity before `StartEncounter`,
  and runs `PostCombatEvents` after it. A no-op `StartEncounter` alone is not a
  complete capture boundary: bypass capture-disrupting waits and progression/
  camera events at their owning contacts while retaining scene initialization.
- Lib actions execute synchronously during `drawTabAndCommit`; an action handler
  must schedule a game thread for yielding operations such as `StartOver`, not
  call them directly or retain the draw context for later use.
- Do not call the broad native `EditingModeOn` as a shortcut: it also changes
  unrelated game/debug state. Use the specific camera/spawn contacts needed.

## Product Contract

### 1. Camera

One compact control area: zoom slider/value, simple framing offsets or pan
controls, Reset, and Hide UI. The initial zoom range is a practical capture
range to be checked in-game, not a game-rule constant. Reset returns to the
room's normal framing. Capture mode may relax camera clamps when they prevent
framing the full map; the chosen native mechanism must be demonstrated in-game.

Hiding the UI must leave an independently reachable toggle to bring it back.
Do not freeze the whole game engine, since that can prevent camera input and
room presentation from finishing. No per-frame camera override unless a traced
native controller demonstrably requires it. Tall/large rooms must remain
frameable, even if fitting them requires reduced screenshot detail.

### 2. Load a Capture Scene

Search/filter concrete native room declarations by biome and game name. Do not
offer inherited base declarations or other non-loadable templates as rooms.
Initial coverage is run rooms used by the planner: F/G/H/I, N/O/P/Q, Chaos,
Anomaly and Zagreus rooms; not Crossroads cosmetics or game developer test maps.
No planner import is needed to obtain these native identities.

Load/Reload creates a fresh scene with deterministic capture choices and fixed
unflipped orientation. The same room/preset produces the same example objects
at the same points; it does not promise bit-identical ambient animation frames.
Loading another room discards previous scene objects and transient bindings.

Use a simple explicit loading/ready/error state to prevent duplicate load
requests. The Load action schedules its native work on a game thread. Ready means
the selected map, hero/scene setup, example objects and camera framing are ready
for capture; it does not wait for encounter completion or room-exit readiness.
An explicitly requested placement whose native point is missing produces a
concrete error, never a false Ready status or an
object silently moved elsewhere. A room with no points of a given family is
ordinary absence, not a failed capture. Combat suppression must preserve NPC and
prop construction needed for the scene; do not blanket-block all unit spawning.

### 3. Contents for Annotation

This is placement coverage, not a legal authored room. Representative objects
may deliberately exceed normal generation counts so all candidate positions can
be annotated. Native geometry, point IDs and door destination identity remain
truthful. Use distinct native reward silhouettes/icons and a small fixed palette,
not a user-facing inventory editor or custom art system.

| Scene                           | Required capture content                                                                                                                                                                                                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordinary rooms                  | Native room art/doors and representative reward objects at native reward points. Shops show their native pedestal arrangement with deterministic example stock. No combat is required to reveal them.                                                                                   |
| H cage rooms                    | All native cage points and optional points receive distinguishable examples, including candidate points beyond a normal cage-count roll. Retain native cage/reward construction where practical; the chosen presentation must not obscure the identities behind identical cage effects. |
| H entry and Nemesis references  | Log entry/end pairs and point IDs. Optional rewards and Nemesis share a point family: keep the main capture uncluttered and provide a separate Nemesis reference view where needed, not overlapping objects. Distinguish optional-only points from eligible Nemesis points.             |
| N Hub                           | Expose the full declared board and stable example rewards, including normally closed destinations. Retain each door's `PredeterminedDoorRooms` identity; unused decorative doors are not invented destinations.                                                                         |
| N main/side rooms               | Directly load their own geometry and expose their native local-door/reward points. No main-to-side-to-main restore simulation is required.                                                                                                                                              |
| O/P and other specialized rooms | Keep their native structure and relevant wheel/reward/door objects without running battles. Add a bounded family setup only where direct native initialization needs it; no phase-progression simulator or story outcome implementation.                                                |

The point inventory is a small log output: room, orientation, point family,
native point ID/coordinates, assigned example reward, and destination for doors.
Use stable native ID ordering. Do not claim ordinal labels match planner Layout
positions until cross-checked against its existing declarations/audit; the native
IDs make that comparison possible without a runtime planner dependency.

Camera and capture objects must remain usable despite loadout effects such as
Forfeit changing a boon into an onion. Suppress only such capture-visible effects
at their native contact or give this disposable capture run a neutral loadout.
Do not build generalized loadout editing or change persisted player settings to
achieve a neutral scene.

## Ownership and Code Shape

The standalone package owns all implementation and focused Lua tests. The
planner owns only the resulting static images and this temporary delivery plan.
No engine, catalog, authored file, execution fixture, or Lib change is expected.

Start with `main.lua` for composition, data/UI declarations, one camera module,
and a capture neighborhood owning loading and example contents. Fields/Hub get
small named setup modules when their distinct contacts warrant it. Do not create
a plugin registry, event bus, generic recipe interpreter, or one directory per
biome just to hold dispatch. One module instance owns capture state; no state
depends on importing the same file twice or on globals used as hidden registries.

Hooks are inert outside a requested capture session. Scene-local changes must
not duplicate themselves on Reload, and camera/HUD overrides have explicit
reset/disable behavior. This is ordinary tool hygiene, not save recovery.

## Delivery Gates and Commit Boundaries

### A — Standalone camera and direct-room capture

Deliver the working fallback UI, named-room loader, combat suppression, neutral
capture setup, ordinary reward presentation, zoom/framing/reset, Hide UI and
reopen. Use native `StartOver`/`StartNewRun`, not copied constructor blocks.
Resolve the concrete encounter/presentation contacts during this gate and keep
them documented beside their implementation only when the choice is non-obvious.

Acceptance: coordinator-free boot; initial load and repeated room changes;
ordinary combat/shop/postboss room representatives; no active combat or
progression/proximity requirement; movable camera and reversible HUD hiding.
Check that later room events do not start a battle or reset the framed camera.
A test proves callbacks pass through outside capture and repeated load requests
do not stack.
In-game proof is required for native loading/camera behavior; mocks cannot close
those claims. Do not proceed on a known broken entry path.

### B — Fields and Hub placement coverage

Add the bounded Fields and Hub setup, native point inventory, distinct stable
examples, and direct main/side-room references.
Keep the same loader/camera rather than introducing a second special-room path.

Acceptance: Fields of different capacities, `H_Combat01`/`H_Combat05` large-map
framing and `H_Combat13` point inventory; optional/Nemesis shared-point handling;
full N Hub board plus a main and side room.
No duplicate/missing point placement or overlapping optional/Nemesis examples.
Repeated capture uses stable identity even when incidental animation differs.

### C — Remaining room-family contacts

Verify the shared loader against O ships, P multiphase rooms, I/Q rooms,
story/boss rooms, Chaos, Anomaly and Zagreus. Add only source-required setup or
presentation exceptions, not full encounter/phase implementations. This is
separate from Fields/Hub so a specialized entrance cannot hold up that useful
capture checkpoint.

Acceptance: representative rooms from these families reach a stable capture
scene without prior biome traversal, battle progression or reward collection.
Wheel/reward/door objects appear at their native positions; repeated loads and
camera/HUD controls use the same implementation. Log and document concrete
unverified cases honestly; do not silently skip a requested room or claim mocks
prove it renders.

### D — Review and capture handoff

Independent review of native contacts, lack of constructor/event-loop copying,
point identity, session scoping, and feature size. One bounded remediation pass.
Run the standalone module's Lua syntax/smoke/focused tests; do not run the full
planner engine suite for this unrelated utility. User in-game captures establish
that images are usable, not merely that mocked functions were called.

Keep a short module README with installation, executor-disabled prerequisite,
controls, disposable-session behavior, tested room-family coverage, and any
concrete remaining game limitation. Remove this temporary plan on delivery;
do not add it to the planner README or create permanent planner architecture
documents for an internal capture tool. No automatic image replacement, commit,
deployment, release or push is implied by finishing a gate.
