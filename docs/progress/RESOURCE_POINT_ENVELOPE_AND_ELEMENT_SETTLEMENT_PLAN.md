# Resource Point Envelope and Element Settlement Plan

## Status

Locked on 2026-09-06 after review of the live planner, execution product, Plan
Executor route/room handshake, and Hades II `SetupHarvestPoints`,
`GrantElementFromTool`, `AutoHarvestOnExit`, and `LeaveRoom` contacts.

Starting commits:

- Run Planner: `70a46577`
- Plan Executor: `bc26cf48`
- Modpack shell: `c5b84aad` with the Plan Executor worktree already advanced to
  `bc26cf48`

The Run Planner worktree also contains pre-existing native-contact audit edits.
They are not implementation evidence for this plan and must be explicitly
inventoried before Gate A is committed.

## Objective

Complete the selected-success Resource model at its two missing boundaries:

1. the planner must protect the physical point-generation envelope required to
   make the selected point legal while leaving unrelated physical points native;
2. the Plan Executor must force the once-per-run element roll only at the
   selected occurrence and verify the exact post-room element ledger at the
   next stable route checkpoint.

The user-visible authored model remains one optional successful placement for
each of Pickaxe, Exorcism, Shovel, and Fishing. There is no new editor control,
no authored negative point state, and no manual-versus-automatic gathering
choice.

## Source facts and selected simplification

The durable game-data authority is
[Room Features Game-Data Audit](../audits/room-features/ROOM_FEATURES_GAME_DATA_AUDIT.md).
The cross-boundary authorities are
[Room Lifecycle Model](../design/ROOM_LIFECYCLE_MODEL.md),
[Game Integration Boundary](../design/GAME_INTEGRATION_BOUNDARY.md), and
[Room Features and Actions](../audits/game-execution-contacts/ROOM_FEATURES_AND_ACTIONS.md).

The game has two independent constraints:

- physical points consume declaration-owned same-family lookback,
  cross-family lookback, biome capacity, and room capacity even when their
  element roll fails;
- after a successful interaction, `GrantElementFromTool` independently rolls
  for one element and records one success per upgraded tool in
  `CurrentRun.ToolElementsSpawned`.

The planner continues to author only the selected successful occurrence. From
that positive choice, the engine derives the minimum point overrides needed to
guarantee it:

- `force` the selected point;
- `suppress` an otherwise-native point only when it could consume the selected
  point's same-family lookback, cross-family lookback, biome capacity, or
  room-local capacity;
- leave every point outside that protected envelope `native`.

Physical point generation and the element roll are distinct native operations,
but the selected-success planner model permits only the three combinations
below. The execution product therefore publishes one disposition rather than a
parallel roll table. For a family without a selected success, every reached
`native` point receives a failed roll. Native code still owns tool availability,
point consumption, `ToolElementsSpawned`, trait addition, and presentation.

The resulting room/family product has this exact meaning:

| Point disposition | Physical point generation | Element roll  |
| ----------------- | ------------------------- | ------------- |
| `native`          | Preserve native behavior  | Force failure |
| `suppress`        | Prevent the point         | Not reached   |
| `force`           | Require the point         | Force success |

`native` therefore applies only to physical point generation; it never grants
an unplanned successful element roll. The engine derives all four families as
one route product because cross-family lookback and room-capacity constraints
can require one family's point to be suppressed to protect another family's
selected success.

## Current defect

The catalog already declares the four families and their lookback/capacity
facts, and the authored route already persists one selected occurrence per
family. The live planner legality query, however, compares only the four
selected successful placements. Since a family can have only one selected
placement, its same-family lookback check cannot witness an earlier unselected
physical point. No derived per-occurrence suppression envelope is published.

The live execution Overview publishes only the positive resource contribution.
The Plan Executor compensates by setting all four native `*PointSuccess` fields
to false in every room and re-enabling only the selected point. That globally
suppresses points outside the protected envelope and places planner policy in
the native adapter.

The live `LeaveRoom` hook also closes the Room Occurrence session and advances
the route cursor before native `AutoHarvestOnExit` calls
`GrantElementFromTool`. The resource hook therefore cannot bind the native roll
to its occurrence. The existing `beforeRoomExit` Run State frame is
intentionally captured before the planner's `roomExited` resource
contribution, so it cannot serve as the final element proof.

## Locked architecture

### One route-owned resource execution product

The engine exposes one complete immutable resource execution policy derived
from the selected route chronology. For every entered occurrence it publishes
exactly one `native`, `suppress`, or `force` disposition for each of the four
families. This occurrence table is the sole point authority; the wire product
must not repeat the same selected and suppressed identities in a second family
index. Any declaration-owned family, granted-trait, or element identity needed
by the adapter is normalized once alongside that table.

The Plan Executor's fixed native binding remains the sole translation from
that abstract family to `ToolPickaxe2`, `ToolExorcismBook2`, `ToolShovel2`, or
`ToolFishingRod2`. Native tool names do not enter the planner catalog merely to
serve the adapter.

The existing room-exit conformance product separately exposes the exact
five-element counts at each complete `beforeRoomExit` snapshot: Aether, Earth,
Air, Fire, and Water. Element observation therefore uses the ordinary
conformance boundary rather than extending the resource-policy table.

The precise wire layout may optimize repetition, but these facts must have one
authority. The execution product must not retain the existing positive-only
`Overview.resources` representation as a parallel semantic path. Family names,
tool names, granted-trait identities, and element identities remain owned by
the catalog/native binding and are not repeated in this execution product. A
room feature adapter may receive the current occurrence's resolved point
disposition from the route policy; it may not reconstruct lookbacks.

### Derived state, not authored negative records

The editable project continues to persist only the four positive singleton
placements. Suppression IDs and exact element counts are replaceable engine
products. Moving or removing a selected success automatically recomputes the
complete envelope without migration, cleanup commands, or Undo noise.

The chronology is the game's entered-room history, not only the main-route
spine. An entered N side room is a distinct occurrence that can receive any of
the three dispositions and occupies its real position in resource lookback.
Repeated Hub restoration does not create a selectable placement, but Hub
entries remain part of the distance calculation where room history records
them. The resource derivation must not substitute N's six main visits or its
encounter-depth counter for that chronology. A side room's successful element
is present in the next authored main or side occurrence's ordinary room-exit
element conformance. Restoring the Hub neither performs conformance nor promotes
Hub into an authored occurrence or resource-policy row.

Candidate legality and execution materialization consume the same derived
envelope authority. They must not maintain separate implementations of point
spacing or capacity.

### The compiler remains a translator

The planner engine derives point suppressions and the ordinary room-exit element
fact from the complete-valid simulation. The execution assembler copies the
completed products and requires branch agreement. It does not add contributions
to a diagnostic frame, infer prior rooms from IDs, or reproduce resource rules.

This changes the execution protocol but not the authored project schema.

### Room sessions end normally; the route cursor spans only native leaving

The Room Occurrence session still closes after its Timeline obligations,
specialized room-exit conformance, and Doors proof complete. It is not retained
through auto-harvest and gains no `departing` state.

The outer route cursor retains the departing occurrence only across the native
`LeaveRoom` call:

```text
active occurrence X
  -> room session closes
  -> route cursor remains on X while native LeaveRoom runs
  -> native LeaveRoom returns and the cursor advances to occurrence Y
  -> Y's room session begins
```

During native leaving, next-room construction may consult the already known
next occurrence, but `current()` continues to identify X for automatic resource
gathering. This is a bounded route-navigation state, not a retained Room session,
cross-room Timeline edge, or deferred-conformance queue.

### Resource roll steering consults only the route cursor

The `GrantElementFromTool` adapter maps the native tool through the fixed native
binding and asks the route session for the current occurrence's published roll
result. It never consults the Room Timeline, scans the plan, or understands
lookback rules.

The adapter derives the roll mechanically from the current occurrence's point
disposition: `force` succeeds and `native` fails; `suppress` has no point to
invoke the adapter. It constrains only the one native `RandomChance` reached by
that `GrantElementFromTool` invocation. The forcing scope must be one-shot,
exception-safe, and unable to affect unrelated random calls. Native
`GrantElementFromTool` must still execute so it owns the success flag, element
trait, and presentation. Manual use and `AutoHarvestOnExit` therefore share the
same path.

### Exact element conformance uses the ordinary room-exit boundary

The engine publishes a separate absolute five-counter conformance fact for every
reached occurrence with a complete `beforeRoomExit` snapshot, including rooms
where the vector is unchanged. It is not folded into `traitInventory`.

The executor compares this fact with `CurrentRun.Hero.Elements` alongside the
room's other exit-conformance facts. The current room's vector already includes
any element gathered while leaving the prior authored occurrence plus any
modeled element changes inside the current room. A resource gathered during the
current native `LeaveRoom` is therefore observed at the next authored
occurrence's room-exit check.

Missing native element-table keys normalize to zero; the adapter compares the
five named counters, not table identity or one summed total.

This deliberately accepts detection up to one authored occurrence later in
exchange for keeping all mismatch detection on the ordinary room-exit boundary.
Planner simulation and later authoring eligibility are unchanged. An element
gathered while leaving the final configured occurrence still has no trailing
obligation because it cannot affect another planned outcome.

## Gate A — Planner envelope and execution product

Intended commit: `fix(resources): publish protected resource outcomes`

### Production work

- Extend the engine-owned resource derivation to calculate one minimal physical
  point envelope across the actual entered occurrence chronology.
- Include same-family lookback, target-owned cross-family lookback, prior
  same-family biome-cap consumption, and same-room simple/complex/all-tool
  capacity in that envelope.
- Reject conflicting selected successes through the same authority, including
  one selected point suppressing another selected point.
- Preserve native point behavior outside every selected envelope.
- Publish exact element counts as an ordinary room-exit conformance fact from
  each complete `beforeRoomExit` snapshot and require complete-valid branch
  agreement.
- Replace the positive-only execution resource shape with the complete
  route-owned point policy, and publish element counts through ordinary
  room-exit conformance.
- Bump the strict execution protocol and update its TypeScript codec and
  fixtures. Do not bump the authored project schema.
- Update the durable Resource and game-integration dispositions to distinguish
  point realization, roll steering, and delayed element conformance.

### Primary tests

- A selected Pickaxe point suppresses a previous eligible Pickaxe point inside
  its lookback while leaving an earlier point outside every constraint native.
- Prior same-family points elsewhere in the target biome are suppressed when
  they would consume its biome cap, even outside the short lookback.
- A target-owned cross-family window suppresses the conflicting prior family;
  an authored selected success there is rejected rather than silently removed.
- Same-room simple/complex and Chaos all-tool capacity produce exact
  suppressions and selected-placement conflicts.
- An entered N side-room occurrence can be selected and participates in
  lookback at its actual RoomHistory position without being flattened into its
  parent Hub visit; its successful element is checked by the next authored
  occurrence's ordinary room-exit conformance rather than at Hub restoration.
- Moving and removing a selected success recompute the envelope without
  persisted negative state.
- The selected room has a forced point and successful roll; earlier attempts
  for that family fail, a family with no selected success always fails, and a
  later attempt may use native `ToolElementsSpawned` short-circuiting without
  reaching `RandomChance` again.
- Post-exit element counts change only at the selected occurrence and are
  visible to the following room's existing Proper Upbringing/infusion logic.
- The strict codec round-trips the complete new product and rejects missing,
  duplicate, unknown, or cross-occurrence references.

Narrow validation: catalog/resource tests when declaration contact changes,
engine resource and execution-plan tests, TypeScript typecheck, formatting, and
diff checks.

## Gate B — Route-cursor realization and settlement

Intended commits:

- Plan Executor: `fix(executor): realize protected resource outcomes`
- Modpack shell: `chore(modpack): update plan executor`

### Production work

- Decode the new strict execution resource product and remove the superseded
  positive-only resource decoder path.
- Change resource room setup from blanket false assignment to the exact current
  occurrence point disposition: force, suppress, or preserve native.
- Close the Room session before native leaving as today, retain the current
  route occurrence only while native `LeaveRoom` executes, and advance it when
  that call returns.
- Expose the known next occurrence separately for native next-room preparation.
- Make `GrantElementFromTool` consult the route cursor's current occurrence and
  derive its one-shot roll result directly from the published point
  disposition; do not decode a second roll-policy table.
- Decode and read the separate element-count conformance fact through the
  existing room-exit conformance path.
- Remove resource access through `room.current`, global point suppression, the
  resource-specific `StartRoom` comparison, and the superseded route
  acknowledgement state.

### Primary tests

- Native point fields are forced only at the selected target, suppressed only
  in the published envelope, and otherwise retain their native value.
- All four tool bindings consume the same resource policy path.
- A selected native roll succeeds and an earlier/unselected roll fails while
  native `GrantElementFromTool` still executes and updates its own state.
- The one-shot random scope cannot affect an unrelated `RandomChance`, cannot
  replay, and is restored before a native error propagates.
- Manual gathering and `AutoHarvestOnExit` use the same current-occurrence
  policy.
- `LeaveRoom` closes the Room session but the route cursor continues to expose
  the source occurrence throughout the native call.
- Every complete room carries an exact element-count conformance fact, including
  unchanged vectors, and its ordinary room-exit proof detects mismatch.
- An element gathered while leaving one occurrence is visible to the next
  authored occurrence's room-exit proof; an element gathered while leaving the
  final configured occurrence has no trailing obligation.
- Existing next-room preparation can resolve the next occurrence without
  changing `current()` during native leaving.

Narrow validation: protocol decoder, route session, room feature, resource
adapter, room hook, composition, and smoke suites. Do not run unrelated planner
tests while iterating on the isolated Lua adapter.

## Gate C — Adversarial closure and live proof

Gate C adds no new behavior unless review or the live probe exposes a concrete
contract defect.

- Review the two repositories together against the locked envelope and cursor
  contract, with special attention to duplicate resource authorities,
  route-cursor advancement timing, random-scope leakage, and points outside the
  protected envelope.
- Run one representative published route containing an allowed native point
  before the selected envelope, one suppressed point inside it, the selected
  successful point, and a later room that observes the resulting element.
- Confirm the selected element appears exactly once, unchanged and changed
  five-counter facts settle through ordinary room-exit conformance, and no Room
  session survives native `LeaveRoom`.
- Run the complete Run Planner gate once after Gate A/B corrections and focused
  review fixes are stable. Run the Plan Executor/module and shell gates once
  before pinning closure. Do not repeat full gates solely to reproduce already
  recorded passing evidence.
- Update `IMPLEMENTATION_PROGRESS.md` and the durable contact audits with the
  truthful live result, then remove this temporary plan after its knowledge is
  absorbed.

## Explicit exclusions

- No resource-point editor changes or authored-project schema change.
- No persisted failed rolls, negative point rows, manual/automatic gathering
  choice, meta-resource quantities, familiar capacity, or tool unlock model.
- No simulation of general physical point RNG outside the derived protected
  envelope.
- No executor lookback, biome-cap, room-capacity, or candidate policy.
- No full Run State comparison and no element data folded into ordinary trait
  inventory conformance; element counts are their own bounded fact.
- No retained/departing Room session, cross-room Timeline edge, generic
  deferred-conformance queue, or generalized route transition framework.
- No manual element-trait insertion by the executor; native
  `GrantElementFromTool` remains authoritative.
- No support expansion beyond the currently published route surface except the
  generic engine product required for later routes.

## Closure criteria

This plan is complete only when:

1. a selected successful resource derives a truthful minimal physical spawn
   envelope and points outside it remain native;
2. no same-family lookback or biome-cap rule is structurally dead behind the
   positive singleton model;
3. the execution compiler copies one engine-owned resource policy without
   semantic reconstruction or a parallel positive-only path;
4. the Plan Executor forces the native roll through the route cursor without
   retaining a Room session;
5. every reached occurrence with a complete exit snapshot has its five element
   counters checked through ordinary room-exit conformance, including unchanged
   vectors;
6. native errors and player input continue normally after the first mismatch;
7. focused tests, one bounded live probe, and the final repository gates pass;
   and
8. durable documentation owns the final facts and this temporary plan is
   removed.
