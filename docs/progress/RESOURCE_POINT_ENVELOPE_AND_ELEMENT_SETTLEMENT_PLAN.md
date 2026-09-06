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

The roll policy is independent of the point policy. For a family with a
selected success, native attempts outside the selected occurrence must fail and
the selected occurrence must succeed. For a family without a selected success,
all reached attempts must fail. Native code still owns tool availability,
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
from the selected route chronology. It contains, for each family:

- the selected successful occurrence ID, or an explicit no-success value;
- the occurrence IDs whose physical point must be suppressed;
- the declaration-owned family, granted trait, and element identity already
  normalized by the catalog.

The Plan Executor's fixed native binding remains the sole translation from
that abstract family to `ToolPickaxe2`, `ToolExorcismBook2`, `ToolShovel2`, or
`ToolFishingRod2`. Native tool names do not enter the planner catalog merely to
serve the adapter.

For every occurrence with a configured successor, it also exposes the exact
five-element counts after that occurrence has fully exited: Aether, Earth, Air,
Fire, and Water.

The precise wire layout may optimize repetition, but these facts must have one
authority. The execution product must not retain the existing positive-only
`Overview.resources` representation as a parallel semantic path. A room
feature adapter may receive the current occurrence's resolved point disposition
from the route policy; it may not reconstruct lookbacks.

### Derived state, not authored negative records

The editable project continues to persist only the four positive singleton
placements. Suppression IDs and post-exit element counts are replaceable engine
products. Moving or removing a selected success automatically recomputes the
complete envelope without migration, cleanup commands, or Undo noise.

Candidate legality and execution materialization consume the same derived
envelope authority. They must not maintain separate implementations of point
spacing or capacity.

### The compiler remains a translator

The planner engine derives point suppressions and post-exit element counts from
the complete-valid simulation. The execution assembler copies the completed
product and requires branch agreement. It does not add contributions to a
diagnostic frame, infer prior rooms from IDs, or reproduce resource rules.

This changes the execution protocol but not the authored project schema.

### Room sessions end normally; the route cursor spans native leaving

The Room Occurrence session still closes after its Timeline obligations,
specialized room-exit conformance, and Doors proof complete. It is not retained
through auto-harvest and gains no `departing` state.

The outer route cursor changes from an exit-advanced cursor to a small
transition state:

```text
active occurrence X
  -> room session closes
  -> route cursor remains on X while native LeaveRoom runs
  -> next StartRoom validates X's post-exit element counts
  -> cursor advances to occurrence Y
  -> Y's room session begins
```

During the native transition, next-room construction may consult the already
known next occurrence, but `current()` continues to identify X. This is route
navigation state, not a retained Room session or a cross-room Timeline edge.

### Resource roll steering consults only the route cursor

The `GrantElementFromTool` adapter maps the native tool through the fixed native
binding and asks the route session for the current occurrence's published roll
result. It never consults the Room Timeline, scans the plan, or understands
lookback rules.

The adapter constrains only the one native `RandomChance` reached by that
`GrantElementFromTool` invocation. The forcing scope must be one-shot,
exception-safe, and unable to affect unrelated random calls. Native
`GrantElementFromTool` must still execute so it owns the success flag, element
trait, and presentation. Manual use and `AutoHarvestOnExit` therefore share the
same path.

### Exact element conformance is acknowledged at the next room start

The engine publishes the absolute post-exit five-counter vector for every
reached occurrence that has a configured successor, including rooms where it
is unchanged. Checking unchanged rooms is necessary to catch an unintended
early element roll before it can affect the next planned room.

At the earliest `StartRoom` contact, before advancing the route cursor or
starting the new Room session, the executor compares `CurrentRun.Hero.Elements`
with the prior occurrence's published vector. A mismatch records the first
conformance discrepancy and stops future realization, while native
`StartRoom` still proceeds.

Missing native element-table keys normalize to zero; the adapter compares the
five named counters, not table identity or one summed total.

This is delayed cleanup conformance for the prior occurrence, not a dependency
on the new occurrence. It does not join `traitInventory`, which intentionally
compares only named equipped-trait changes.

The final configured occurrence publishes no post-exit element obligation.
Whether its resource roll succeeds cannot affect another planned outcome, so a
later unconfigured room or true run termination marks the executor inactive
without a trailing element comparison.

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
- Record exact post-`roomExited` element counts from the resulting simulation
  branch for occurrences with configured successors and require complete-valid
  branch agreement.
- Replace the positive-only execution resource shape with the complete
  route-owned resource policy and post-exit count product.
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
- Close the Room session before native leaving as today, but make route exit
  begin a transition without clearing or advancing the current occurrence.
- Expose the known next occurrence separately for native next-room preparation.
- Make `GrantElementFromTool` consult the route cursor's current occurrence and
  apply only its published one-shot roll result.
- At the next `StartRoom`, compare the prior occurrence's exact five native
  `CurrentRun.Hero.Elements` counters before advancing the route cursor and
  opening the new Room session.
- Declare the prefix complete without inventing a trailing element obligation
  for its final occurrence.
- Remove resource access through `room.current`, global point suppression, and
  any obsolete resource mismatch path replaced by the exact count boundary.

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
- The next `StartRoom` compares the prior exact element vector before cursor
  advancement; matching state advances, mismatching state records the first
  discrepancy while native entry continues.
- An unexpected early element is detected even when the expected vector was
  unchanged.
- The first unconfigured room makes the executor inactive without requiring a
  final configured-room element comparison.
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
- Confirm the selected element appears exactly once, the unchanged and changed
  five-counter checks settle at the following room entries, and no Room session
  survives native `LeaveRoom`.
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
  inventory conformance.
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
5. every reached configured occurrence with a configured successor has its five
   element counters checked at that successor's stable entry, including
   unchanged vectors;
6. native errors and player input continue normally after the first mismatch;
7. focused tests, one bounded live probe, and the final repository gates pass;
   and
8. durable documentation owns the final facts and this temporary plan is
   removed.
