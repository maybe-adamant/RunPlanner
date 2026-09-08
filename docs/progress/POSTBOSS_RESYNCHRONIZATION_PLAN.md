# Postboss Resynchronization Plan

## Status and bases

Status: **locked for later implementation**.

Planning bases:

- Run Planner: `87bdc4ea01f51398cf0f1da6a6686e81b97e3fc9`
- Plan Executor: `70079e5ee50a19f5b568f381271e87ec7f08cd2b`
- Modpack parent: `3ce5b71bd6b1382bfbbd111a66ddd0535318acb3`

This plan consumes the Plan Executor host's active-plan inbox capability. It
does not depend on whether that host exposes one published file or several
slots.

## Objective

Permit one bounded mid-run admission: loading Hades II at the untouched start
of a selected Postboss room may synchronize the active execution plan when the
live modeled state matches that plan's expected Postboss-entry state.

The feature exists to reuse game-save checkpoints at biome boundaries. For
example, a matching `H_PostBoss01` save can synchronize the full Underworld
plan and then exercise I without replaying F, G, and H.

Every other mid-run load remains passive:

```text
load with CurrentRun
        |
        +-- current room is not a selected Postboss -> desynchronized
        |
        `-- selected Postboss
                |
                +-- active plan or expected state mismatch -> desynchronized
                |
                `-- match -> fresh route and room session at this occurrence
```

This is resynchronization, not continuation of serialized executor machinery.

## Authorities and source facts

- [`GAME_INTEGRATION_BOUNDARY.md`](../design/GAME_INTEGRATION_BOUNDARY.md) owns
  admission, frozen-plan, mismatch, and compiler/executor boundaries. Its
  current start-of-run-only statement must change only when this plan closes.
- [`ROOM_LIFECYCLE_MODEL.md`](../design/ROOM_LIFECYCLE_MODEL.md) owns the fresh
  Postboss room lifecycle.
- [`NATIVE_CONFORMANCE_CONTACTS.md`](../audits/game-execution-contacts/NATIVE_CONFORMANCE_CONTACTS.md)
  owns the native readers for modeled state.
- Route declarations and canonical rooms already identify `PostBoss` as a room
  kind and provide exact route-position mappings. The execution compiler must
  publish that existing fact rather than asking Lua to recognize room-name
  strings.
- Native `LeaveRoom` constructs the next room, assigns it to
  `CurrentRun.CurrentRoom`, and requests the `_Temp` checkpoint before loading
  the map. Native `OnAnyLoad` starts a saved current room when its exits are not
  already unlocked. A restored Postboss checkpoint therefore provides the
  clean room-entry seam assumed by this plan.

## Current implementation

- `StartNewRun` is the only execution admission.
- The active plan is decoded and frozen while the hero is constructed, the
  starting loadout is verified after native startup, and the route cursor begins
  at selected occurrence one.
- The route cursor has no supported constructor at a later selected occurrence.
- The runtime session is stored in a `currentRun` cache and contains transient
  room coordinators, handles, native-object bindings, callbacks, and mismatch
  state. None of that is valid recovery input.
- Execution occurrences contain the canonical Postboss room as an ordinary
  occurrence, but the wire does not explicitly mark it as a recovery boundary.
- Decoding expands sequential diagnostic deltas into complete expected
  `roomEntered` and `beforeRoomExit` states. Ongoing execution intentionally
  treats those complete frames as diagnostic-only and blocks only on named
  conformance facts.

## Locked decisions

### One admission boundary

- Recovery is attempted only on a fresh game-process attachment to an existing
  `CurrentRun`, at the native room-start contact.
- Starting a new run continues through the existing admission path.
- A successful or failed recovery attempt is final for that loaded run. The
  Executor does not search again at later rooms.
- Only a selected execution occurrence explicitly marked
  `resumeBoundary: "postbossEntry"` is eligible.
- A selected route's final biome has no Postboss and therefore no recovery
  boundary after its Boss.
- Hub restores, side-room parent restores, Shops, Reprieves, Stories, Intro
  rooms, Preboss rooms, Boss rooms, and an already-open Postboss are ineligible.

### Exact active plan

- Admission loads and strictly decodes the host-selected active plan at the
  attempt.
- Protocol, catalog, and plan-fingerprint validation remain unchanged.
- The current native room must match exactly one marked selected occurrence by
  game identity. Occurrence ID remains plan-side correlation; it is not
  reconstructed from the game.
- No plan search, alternate-slot search, closest state, repair, or suffix
  compilation is permitted.

### Expected-state admission

- The expected state is the marked occurrence's already-expanded
  `diagnostics.roomEntered` product plus the immutable weapon/aspect identity
  from the starting loadout.
- Arcana, keepsake, traits, Elements, clocks, bags, priorities, and every other
  mutable modeled value come from the Postboss room-entry frame, not the
  starting loadout.
- Comparison uses semantic native projections and the planner's existing
  exact/range semantics. It never compares raw Lua object graphs.
- Traits and other native state outside the planner's modeled projection remain
  ignored under the same policy as ordinary conformance.
- The complete diagnostic frame becomes blocking only for this exceptional
  admission decision. It remains diagnostic-only during ordinary synchronized
  execution.
- Every section required for admission must have one audited native reader. A
  missing reader makes recovery unsupported and passive; expected values are
  never copied into the observed side.

### Fresh sessions only

- Serialized executor session state is discarded. Recovery never restores an
  old route object, room coordinator, timeline handle, native-object binding,
  forcing scope, callback, or mismatch.
- Success constructs a fresh route cursor at the matched selected occurrence,
  then constructs and enters an ordinary fresh room session for that Postboss.
- The current native Postboss room is prepared through the same Overview and
  incoming-reward realization products required at ordinary creation. The
  recovery adapter adds no Postboss feature policy.
- The Postboss Timeline begins with no completed handles. Its Rack, fountain,
  Well, Pool, delivery, and other authored actions proceed normally.
- Start-of-run keepsake and Hex effects are not replayed.
- From Postboss exit onward, ordinary room, navigation, timeline, and
  conformance behavior is unchanged.

### Failure policy

- Any rejected attempt records one bounded admission mismatch, enters the
  existing passive/desynchronized state, and lets the native room continue.
- No recovery failure may return early from `StartRoom`, block input, replace
  native state, choose another plan, or retry at a later Postboss.
- An execution fault while reading required native infrastructure remains an
  executor fault under the existing policy; it is not converted into a state
  mismatch or guessed default.

## Ownership

### Planner engine and execution protocol

The engine owns publication of the existing canonical room-kind fact as:

```json
"resumeBoundary": "postbossEntry"
```

Only selected canonical `PostBoss` occurrences receive it. This is an execution
admission fact, not authored state or catalog duplication. The strict
TypeScript codec and Lua decoder close the new optional field. The planner's
source-owned assembler and product validation prove that only canonical
`PostBoss` occurrences receive it. Lua does not reconstruct room kind from a
game name; it validates only that the marked occurrence is selected, unique,
and carries the required room-entry diagnostic frame.

The compiler otherwise remains a lossless translator. It does not construct a
resume snapshot, suffix plan, or alternate route.

### Plan Executor host and runtime

The host provides one active decoded-plan source. The runtime owns one
`attemptPostbossAdmission` coordinator that:

1. recognizes fresh-process mid-run attachment;
2. resolves the current room against marked selected occurrences;
3. asks the admission projection to compare expected and observed state;
4. constructs the route cursor and room coordinator on success; and
5. records one passive mismatch on failure.

The route session owns indexed construction. Room adapters remain ordinary
consumers after successful admission.

### Native admission projection

A focused recovery projection owns the complete Postboss-entry comparison. It
reuses the same low-level native readers as room-exit conformance and loadout
verification but does not make transaction adapters or the protocol decoder
aware of native game state.

## Delivery gates

### Gate A — Recovery contract and wire marker

1. Audit the diagnostic sections against the current native reader inventory;
   record each reusable reader and each genuinely missing Postboss-entry
   projection before runtime work begins.
2. Publish `resumeBoundary: "postbossEntry"` from canonical `PostBoss` room
   kind.
3. Extend the strict model, codec, product validation, and decoder without
   teaching Lua canonical room-kind policy.
4. Prove that F/G/H and N/O/P Postboss occurrences are marked when selected,
   while I/Q terminals and every non-Postboss occurrence are not.
5. Refresh only protocol fixtures whose bytes change and keep planner/executor
   copies byte-identical.

Commit boundary: `feat(execution): mark postboss recovery boundaries` plus the
coordinated executor protocol commit.

### Gate B — Admission state projection

1. Implement one complete expected-versus-native Postboss-entry projection
   using audited readers.
2. Compare immutable weapon/aspect identity and all mutable modeled sections at
   the Postboss frame.
3. Preserve exact, set, ordered, absent, and ranged semantics from their owning
   planner products rather than one generic deep-equality helper.
4. Keep the projection read-only and independent of route/session creation.
5. Add focused mutation tests that vary expected and native values
   independently for every reader family. Reuse existing conformance matrices
   instead of duplicating them when the exact reader and semantics are shared.

Commit boundary: `feat(executor): verify postboss admission state`.

### Gate C — Runtime resynchronization

1. Add the one fresh-process mid-run admission entry point at native room
   start.
2. Discard any serialized transient executor state before evaluating recovery.
3. Add route construction at one exact selected index without weakening normal
   cursor advancement.
4. On success, prepare, realize, and enter the matched Postboss through a fresh
   ordinary room session.
5. On failure, record one passive mismatch and prove no later room retries.
6. Prove that no loadout effect, completed Timeline action, or previous forcing
   scope is replayed.

Commit boundary: `feat(executor): resynchronize at postboss entry` followed by
the modpack-parent integration commit.

### Gate D — Live proof and closure

1. With a full Underworld plan active, restore an untouched H Postboss
   checkpoint whose state matches and complete a focused I test.
2. Prove one mismatched Postboss state becomes passive without blocking the
   game.
3. Prove one non-Postboss mid-run load becomes passive and never retries.
4. If feasible in the same campaign, repeat the successful contact at a Surface
   Postboss; otherwise retain it as the next explicit live-evidence gap.
5. Run the complete planner, executor, Luacheck, fixture-identity, and parent
   smoke gates once after focused tests stabilize.
6. Amend the durable start-of-run-only integration contract with this single
   Postboss exception, update the native-contact audit and delivery history,
   and delete this temporary plan.

Commit boundary: `docs(execution): close postboss resynchronization`.

## Acceptance matrix

| Loaded state                                                    | Expected result                                                   |
| --------------------------------------------------------------- | ----------------------------------------------------------------- |
| No `CurrentRun` / new run                                       | Existing `StartNewRun` admission only.                            |
| Matching selected F/G/H or N/O/P Postboss entry                 | Fresh synchronized session begins at that occurrence.             |
| Non-Postboss room                                               | One passive admission mismatch; no later retry.                   |
| Postboss absent from active plan prefix                         | Passive mismatch.                                                 |
| Valid but wrong active plan                                     | Room or expected-state admission mismatch; native room continues. |
| Invalid protocol, catalog, or self-fingerprint                  | Active-plan load failure; native room continues.                  |
| Correct Postboss room with one modeled state difference         | Passive mismatch naming the state section.                        |
| Correct state plus unrelated unmodeled native data              | Admission succeeds.                                               |
| Postboss whose actions or exits are already settled             | Ineligible; no partial-room reconstruction.                       |
| Successful recovery followed by Postboss actions and next biome | Ordinary room/timeline/door execution continues.                  |

## Explicit exclusions

- No arbitrary-room, Preboss, Boss, Intro, Shop, Reprieve, Story, Hub, side-room,
  or mid-Timeline recovery.
- No recovery after a mismatch in the same loaded run.
- No serialized route cursor, room session, Timeline handle, or native-object
  identity.
- No replay of prior-biome actions or reconstruction of how the state arose.
- No plan repair, state mutation to make a save match, alternate plan search, or
  suffix recompilation.
- No desktop management, copying, renaming, or overwriting of Hades II save
  files. Initial use relies on externally preserved native checkpoints.
- No Dream Dive recovery until Dream Dive has its own authored and execution
  route product.
