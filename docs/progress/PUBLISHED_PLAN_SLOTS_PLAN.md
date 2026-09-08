# Published Plan Slots Plan

## Status and bases

Status: **locked for implementation**.

Planning bases:

- Run Planner: `87bdc4ea01f51398cf0f1da6a6686e81b97e3fc9`
- Plan Executor: `70079e5ee50a19f5b568f381271e87ec7f08cd2b`
- Modpack parent: `3ce5b71bd6b1382bfbbd111a66ddd0535318acb3`

This plan is independent of runtime Postboss resynchronization. It changes how
validated execution plans are stored and selected, not what an execution plan
means.

## Objective

Replace the Plan Executor's single published inbox file with six fixed plan
slots. The desktop planner publishes a validated plan to an explicitly chosen
r2modman profile and slot. The Plan Executor's in-game ImGui surface chooses
which populated slot is active for the next execution session.

The user-visible flow is:

```text
Run Planner desktop                 Plan Executor in game

Publish to Game                     Active plan
  Profile: h2-dev                     Slot 1  Underworld · ready
  Slot:    Slot 3                     Slot 2  Surface · ready
  Publish                              ...
                                      Slot 3  Underworld · ready  <- selected
```

Publishing and activation are deliberately separate. Publishing to Slot 3
does not change a currently running execution session and does not implicitly
make Slot 3 active.

## Current implementation

The Windows desktop host discovers every compatible direct child below:

```text
%APPDATA%\r2modmanPlus-local\HadesII\profiles
```

A profile is compatible only when its installed Plan Executor manifest has the
exact expected namespace, name, full name, and module version. Publication
re-discovers that profile, confines the destination below its
`ReturnOfModding/config` tree, rejects links and non-regular files, enforces a
1 MiB bound, and atomically replaces:

```text
adamantRunPlanner-Plan_Executor/active.runplanner.json
```

The React flow publishes immediately when discovery returns one compatible
profile and presents a profile picker when it returns several. The Lua inbox
and status UI expose only the fixed `active.runplanner.json` file.

## Locked decisions

### Fixed slots

The closed slot set is exactly:

```text
slot-1.runplanner.json
slot-2.runplanner.json
slot-3.runplanner.json
slot-4.runplanner.json
slot-5.runplanner.json
slot-6.runplanner.json
```

- Callers pass a slot number from 1 through 6, never a filename or path.
- Native publication maps that number to the fixed filename after resolving the
  compatible profile.
- Every slot independently retains the existing 1 MiB limit and atomic replace
  behavior.
- `active.runplanner.json` is retired. There is no compatibility reader or
  automatic migration; the status surface asks the user to republish.
- Slot storage is transport state. Slot identity does not enter the editable
  project, execution-plan schema, plan fingerprint, or compiler.

### Profile and publication UX

- Discovery continues to return every compatible r2modman profile. It never
  chooses the first profile when several exist.
- Publish to Game always opens one bounded selection surface, including when
  only one compatible profile exists, because a slot must always be chosen.
- With one compatible profile, that profile may be preselected. With several,
  the user selects one.
- The surface selects one of six slots and publishes only after both values are
  resolved.
- Slot occupancy metadata is not required in the planner's first slice. Adding
  a second execution decoder merely to label an occupied slot is excluded.

### In-game activation

- The Plan Executor owns a persistent `ActivePlanSlot` setting with values 1
  through 6 and default Slot 1.
- The in-game Plan Executor surface displays all six slots, the selected active
  slot, and bounded inspection status for the selected slot.
- Inspection is explicit or cached; the UI does not decode six 1 MiB files on
  every draw.
- Changing `ActivePlanSlot` affects only the next new-run or recovery admission.
  A plan already frozen into a live session remains unchanged.
- Empty, oversized, malformed, protocol-incompatible, or catalog-incompatible
  active slots fail the next admission through the existing passive error
  policy. Selecting or inspecting them does not affect ordinary game behavior.

## Ownership

### Run Planner desktop host

The Rust publication adapter owns:

- the fixed slot-number domain;
- safe profile plus slot destination resolution;
- bounded atomic replacement of one slot; and
- native publication errors.

It does not decode execution semantics or store the active slot.

### Planner application

The application owns:

- profile-and-slot selection state;
- the publication dialog and feedback; and
- passing a complete `(profileId, slotNumber, planJson)` request to the native
  adapter.

Project compilation remains exactly where it is now. The React layer does not
construct paths or filenames.

### Plan Executor host

The Executor host owns:

- persistent active-slot selection;
- reading and decoding one selected slot;
- selected-slot inspection status; and
- freezing the decoded plan for a new execution session.

Route, room, timeline, feature, and conformance modules remain unaware of slot
identity.

## Delivery gates

### Gate A — Native publication slots

1. Replace the fixed destination with a fixed slot resolver.
2. Extend native publication to require a slot number.
3. Preserve compatible-profile re-discovery, containment, regular-file,
   1 MiB, temporary-file, flush, and atomic-replace protections per slot.
4. Add Rust tests for all six legal mappings, rejected out-of-domain values,
   isolation between slots, and failed replacement preserving prior bytes.

Commit boundary: `feat(desktop): publish plans to fixed slots`.

### Gate B — Planner publication UX

1. Extend the application publication capability with the closed slot number.
2. Replace immediate single-profile publication with the unified profile and
   slot selection surface.
3. Keep compilation and publication feedback unchanged apart from naming the
   selected profile and slot.
4. Update focused persistence, project-operation, and UI workflow tests.

Commit boundary: `feat(planner): select game publication slot`.

### Gate C — Executor active-slot host

1. Parameterize the inbox over one validated slot number and retire the fixed
   active filename.
2. Add the persistent active-slot setting and in-game selector.
3. Inspect and load only the selected slot.
4. Freeze the decoded active plan at admission; prove that changing the setting
   does not mutate a live session.
5. Update inbox, status UI, host-composition, smoke, and session tests without
   changing protocol fixtures.

Commit boundary: `feat(executor): select active plan slot` followed by the
modpack-parent submodule integration commit.

### Gate D — Closure

1. Run the planner's focused desktop/application tests and production desktop
   build, then its complete repository gate once.
2. Run the complete Plan Executor Lua and Luacheck gates plus the parent smoke
   test.
3. Update the durable game-integration transport description and delivery
   history.
4. Delete this temporary plan in the closure commit.

Commit boundary: `docs(execution): close published plan slots`.

## Acceptance matrix

| Case                                         | Expected result                                                 |
| -------------------------------------------- | --------------------------------------------------------------- |
| One compatible r2modman profile              | Profile is preselected; user still selects a slot.              |
| Multiple compatible profiles                 | User explicitly selects profile and slot.                       |
| Publish to occupied Slot 4                   | Only Slot 4 is atomically replaced.                             |
| Select Slot 4 in game                        | The next admission loads Slot 4.                                |
| Change active slot during a synchronized run | Current frozen plan is unchanged; selection applies later.      |
| Empty active slot                            | Admission becomes passive with a bounded `not-published` error. |
| Malformed active slot                        | Admission becomes passive with the decoder reason.              |
| Out-of-range slot from any caller            | Rejected before filesystem resolution.                          |

## Explicit exclusions

- No execution protocol, catalog, authored-project, or fixture change.
- No active-slot pointer file written by the planner.
- No arbitrary slot names, paths, slot count, or user-created banks.
- No automatic activation on publish.
- No hot swapping or restarting a live execution session.
- No browser publication.
- No game-save checkpoint capture or Postboss resynchronization.
