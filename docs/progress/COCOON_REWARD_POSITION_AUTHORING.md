# Cocoon reward position authoring

Status: locked for implementation; Gate A in progress.
Base: `2918b1f1` in `RunPlanner-main`.

## Objective and bounds

Let an Arachne combat encounter optionally select the numbered map point holding
its room-reward cocoon. Keep the existing count control independent: native count
plus explicit position, explicit count plus native position, and both explicit
are supported. `Any` means omitted position and native random selection.

This is not a cocoon-layout editor. Remaining positions, sizes, gold, enemies,
bombs and empty contents stay native. No enemy-wave placement, story-room
cocoons, acquisition ordering change, or new conformance transaction is included.

## Authorities and evidence

- `docs/design/AUTHORED_PROJECT_MODEL.md`: optional authored choices, strict
  decoding, semantic edits, retained invalidity and schema approval.
- `docs/design/SIMULATION_AND_VALIDATION.md`: owning assessment and repair.
- `docs/design/GAME_INTEGRATION_BOUNDARY.md`, encounter customization: native
  pass-through, bounded steering and diagnostic-only placement failures.
- `docs/audits/rooms-and-routes/COMBAT_ENCOUNTER_COMPOSITION_MATRIX.md`, cocoon
  setup and host-map sections: native eligibility and physical point pools.

Native `EncounterLogic.lua:2722–2760` separates spawning from reward assignment:
`SetupArachneCombatEncounter` calls `SpawnArachneCocoons`, then chooses one
actual object from `CurrentRun.CurrentRoom.CoocoonIds` using `GetRandomValue`.
It installs the reward callback, clears that cocoon's enemy spawn, and sets
`SpawnRewardOnId`. Preserve this native assignment rather than moving a reward
after setup, which would require restoring the formerly selected cocoon.

The spawn loop selects a point before choosing size, spawns and sets up the
obstacle, reserves its exact `OccupyingSpawnPointId`, and adds it to the room's
list. Native occupancy prevents subsequent cocoons using that same anchor.
F prefers EnemyPoint and permits the SpawnPoints fallback pool; G explicitly
requires EnemyPoint. If available points run out, fewer than the requested
8–14 cocoons can be placed. Do not turn the requested count into a new promise
that native capacity always satisfies it.

Completed evidence covers 41 maps: F_Combat02–22 (525 markers) and
G_Combat01–20 (476 markers). Capture numbers are ascending native-ID order,
not spatial ordering. Source packages are currently under
`C:/Users/Mohammed Ayyat/Saved Games/Hades II/Screenshots/Cocoons/{F,G}`:
`annotations.json`, `capture-manifest.json`, `capture-log.txt`, `Original`,
`Optimized`, and `Tagged`. G's obsolete `Hades II_1210.png` is excluded.
The annotations retain native IDs and screenshot positions; unavailable world
coordinates are not inferred. Current captures are unflipped; reflected-room
behavior requires live verification, not a second invented ID mapping.

## Ownership and contract

### Catalog and authored model

Catalog room declarations own the ordered legal cocoon anchor IDs. Normalize
these as room-specific domain data, not a React asset lookup. Copy the verified
inventory into the repository; production and tests must not read the user's
Screenshots directory. Retain capture provenance in the owning audit, not a
second production eligibility manifest.

Add a separate sparse encounter customization decision for reward position,
declared only for ArachneCombatF/G. Proposed value:
`{ kind: 'cocoonRewardPoint', spawnPointId: number }`. Omission is Any.
The existing `cocoonCount` value and its reset semantics stay unchanged.
Persist native ID, not screenshot coordinates or a display number. The number
shown on the map is the index in the room's declared ordered anchors.

Engine owns structural validation, the exact room-specific selection domain,
semantic set/clear, assessment, and export. A positive integral ID outside the
current host domain is representable but finding-backed; no silent clamping or
conversion to Any. Existing room/encounter replacement ownership rules apply:
if a leaf survives, an incompatible point must remain repairable; if the owner
is explicitly removed, its position is removed too. Do not add topology repair
or transfer a numbered position to another map.

Reuse encounter-phase finding ownership and customization repair. This leaf
does not change encounter eligibility, reward identity, timeline or history.

### Application and UI

Inside the existing encounter customization popup, retain the count slider and
add `Reward position` with Any and a numbered choice, backed by a selectable
cocoon map. Reuse map pan/zoom and accessible control primitives. A compact
numbered selector provides keyboard access; clicking a map marker sets the same
bound command. Show selected state without covering the number. The map is
cocoon-only, not the ordinary entry/exit map.

Application assets own WebP and visual coordinates; catalog owns legal IDs.
Use the established purple circles, black text/border and Cocoon legend. Import
only required optimized/tagged assets and overlay metadata, not raw screenshots
or review contact sheets. Match asset markers to catalog IDs with an integrity
test. React must not derive legality from image pixels or independently sort
native IDs. A stale selection remains visible with Any/valid-point repairs.

### Execution boundary

Publish the explicit position as its own decision in the matching encounter
phase customization. Export the native ID; do not publish image coordinates or
duplicate the count. Extend strict TypeScript and Lua decoders together.

Keep existing authored saves compatible without a schema/catalog bump or
migration: old sparse decisions remain unchanged. If implementation finds that
impossible, stop for approval rather than changing versions implicitly.
Execution protocol 51 is the current baseline. Gate C proposes one bilateral
execution-only increment (52 if still available); finalize against live HEAD
before implementation. Old published artifacts require re-publication, not
authored-save migration. Do not silently ignore new position decisions in an
older consumer.

## Native enforcement seam

Extend `game-module/src/mods/room/timeline/encounters/arachne.lua` in place.
The current adapter only equalizes count bounds around native setup. Preserve
that path, including position-only setup when no count is authored.

Before mutation, resolve the explicit point against the actual native pool for
the setup arguments and check live occupancy with `IsSpawnPointEligible`.
An absent/occupied/illegal point declines position steering with one diagnostic;
independently valid count steering can still apply. Any and unsynchronized or
unbound contacts remain native.

Proposed bounded interception, to verify against the hook framework in Gate C:

1. During this exact native combat setup's spawn call, substitute the selected
   anchor for its first cocoon point selection. Native creates that cocoon as
   one of N, not an extra N+1 object. Subsequent selections remain native and
   observe the normal reservation.
2. Resolve the actual spawned object's ID through its `OccupyingSpawnPointId`.
3. At setup's reward `GetRandomValue` contact, substitute that object only when
   the argument is the exact current `CoocoonIds` table and the object exists.
   Leave size/content draws and unrelated random selections untouched. Native
   then installs all reward callbacks itself.

Use the existing hook mechanism and explicit short-lived scope. Clear it on
normal return, error and any nested contact; no permanent monkey patch or
room-name-only interception. Story/direct cocoon spawning must remain untouched.
If the framework cannot safely isolate these calls, amend this seam before
implementing a broader native replacement.

Missing target after spawning falls back to native reward selection with a
diagnostic, without retrying setup, duplicating cocoons or undoing native
mutations. Native errors are rethrown after cleanup. Placement shortfall keeps
the existing diagnostic. No placement-only desync; ordinary reward acquisition
conformance is unchanged. An explicit F fallback anchor is permitted even when
preferred anchors remain: chosen placement intentionally steers native priority,
but must still pass pool membership and occupancy checks.

## Delivery gates and commit boundaries

Commit the agreed plan before implementation. Main session owns Git, scope and
closure; follow the repository's executor/reviewer routine for these cross-lane
gates. One writer at a time. Each gate stays testable; no release until the full
producer/consumer contract is delivered.

### A — Catalog and engine

Start with encounter declarations/compiler, normalized room contracts, authored
customization union/codecs/commands, and `simulation/encounters/authoring-domain.ts`.
Deliver verified anchor declarations, independent optional position decision,
exact host assessment/candidates, set/reset/Undo and finding ownership.

The new closed-union member also requires its consumers to remain truthful in
this intermediate commit. Include minimal workspace projection and a compact
Any/numbered selector with retained-invalid repair here, advancing that portion
of B. Explicit reward positions temporarily reject execution publication with
`executionCoverageMissing` until C implements the wire contract; existing plans
and count-only customization continue to publish unchanged. C replaces this
guard, rather than leaving a second publication path. Do not silently omit a
selected position or send it to a consumer that cannot enforce it.

Primary tests: all 41 inventories and F/G pool evidence; old-save round trip;
malformed versus retained-invalid ID; native count plus explicit point; count
reset retaining position and position reset retaining count; owner replacement
and Undo; explicit-position publication rejection and a representative selector
binding witness. Preserve existing default fixture bytes. Run catalog/engine
and affected application lanes.

### B — Map assets and bound editor

Start with `CocoonCountControl.tsx`, `EncounterPhaseControl.tsx`, structured
workspace occurrence-reward assembly/contracts and `ui/room-maps`.
Deliver cocoon-specific assets, map selection and compact selector, selected
state, Any clearing, precise finding navigation and retained-invalid repair.
Do not replace ordinary map assets or add per-cocoon content controls.

Primary tests: asset/domain concordance; representative F/G map and selector
edits sharing the same intent; count independence; Undo; keyboard access;
invalid selection focus; narrow popup pan/zoom usability. Engine owns the full
legality matrix; UI tests do not repeat it. Run affected planner/UI lanes.

### C — Export, native adapter and closure

Start with execution-plan model, assembly/overview and codec/overview, Lua
protocol/overview and the existing Arachne adapter. Land bilateral protocol
change and producer/consumer coverage together. Extend an existing authored
fixture/checkpoint with an explicit point; generate its execution product using
the owning builder and Prettier. Mechanically update only the version scalar
for otherwise unchanged execution fixtures. Lua reads the same corpus.

Primary tests: real producer-to-Lua witness; Any omission; strict malformed
decoding; count-only/position-only/both; native draw N preserved; selected point
occupied once; reward callback belongs to that object; G fallback rejection;
missing/occupied point fallback; placement shortfall; untouched size/content
random calls; story/unbound pass-through; scope cleanup on errors and nesting.
Tests assert behavior, not absence of old implementation symbols.

After focused checks and independent review/remediation, run one complete
`npm run check`. Inspect fixture churn and ensure there is no parallel adapter,
duplicate legality path or checked-in dependency on external capture files.

Live acceptance: choose two different points in F and G; break the selected
cocoon and observe the room reward; test explicit position with native count,
explicit count with position, Any, and a reflected room if reachable. Record
actual results; do not mark live acceptance passed from mocked tests.

At closure update only the owning encounter audit and integration/model
contract where changed, retire temporary plan after delivery acceptance, and
leave unrelated investigations/plans untouched. No capture-module changes are
expected. Raw originals remain external and recoverable.
