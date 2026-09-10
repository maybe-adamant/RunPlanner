# Postboss Resynchronization Plan

## Status and bases

Status: **Gates A-B implemented; Gate C requires live-evidence remediation;
Gate D live proof and closure remain**.

Planning bases:

- Run Planner: `ea2915d7`
- Plan Executor: `5cf1cb8`
- Modpack parent: `f923f8e`

This plan consumes the Plan Executor host's selected active-plan capability.
Published-slot identity remains host configuration and does not enter the
execution protocol or recovered route session.

## Objective

Permit one bounded mid-run admission: loading Hades II at the start of a
selected Postboss room may synchronize the active execution plan when the live
admission state matches that plan's expected Postboss-entry state.

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
- Native save restoration resumes either at room entry or after the current
  room has fully settled and opened its exits. A Postboss room has no combat,
  so loading a Postboss save enters that room at its Timeline origin. Recovery
  never has to infer which Postboss interactions have already occurred or
  reconstruct a partial room session.

## Current implementation

- `StartNewRun` admits ordinary execution at selected occurrence one. Gate C
  added a second, bounded admission at marked Postboss entry and an indexed
  route constructor for that exact occurrence.
- The first Gate C implementation stored the runtime session in a `currentRun`
  cache. Live save/reload proved that this serializes transient room
  coordinators, handles, native-object bindings, callbacks, and mismatch state
  into the native save and can corrupt that save with `extra data at end`.
  Runtime execution state must instead be process-local from construction.
- The first Gate C implementation also realized a replacement Postboss room
  after Hades II had already restored one. Recovery must instead adopt the
  restored native room and construct only fresh executor coordinators.
- Execution occurrences now mark canonical selected Postboss rooms explicitly
  as recovery boundaries.
- Decoding expands sequential diagnostic deltas into complete expected
  `roomEntered` and `beforeRoomExit` states. Ongoing execution intentionally
  treats those complete frames as diagnostic-only and blocks only on named
  conformance facts. Recovery can therefore read the matched occurrence's
  expanded `roomEntered` state directly; it needs neither another absolute
  checkpoint nor a history walk.

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
  rooms, Preboss rooms, and Boss rooms are ineligible.

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
- Admission derives only the nine existing authoritative conformance families
  from that frame: `traitInventory`, `elementCounts`, `steadyGrowth`, `chaos`,
  `keepsakeEffects`, `rewardPriorities`, `pathOfStars`, `forfeit`, and
  `stygianWell`.
- Each family reuses its ordinary native reader and its existing exact, set,
  ordered, absence, or range semantics. Recovery does not introduce a generic
  deep comparison of the diagnostic frame or raw Lua object graphs.
- Trait comparison remains limited to the planner's modeled inventory;
  unrelated native traits and other unmodeled state remain ignored under the
  ordinary conformance policy.
- Other diagnostic sections—including counters, reward bags, god-pool
  internals, Arcana and Vow history, Artificer state, Echo duplicate state, and
  Hermes delivery bookkeeping—remain diagnostic evidence. Recovery adds no
  native readers or blocking comparisons for them; any consequential mismatch
  is caught later at its ordinary owning boundary.
- Expected values are never copied into the observed side. The expanded frame
  remains a source for the named admission projection, not a new globally
  blocking Run State comparison.

### Fresh sessions only

- Serialized executor session state is discarded. Recovery never restores an
  old route object, room coordinator, timeline handle, native-object binding,
  forcing scope, callback, or mismatch.
- The executor registers no save-backed cache for runtime execution state. One
  process-local state object is constructed at the composition root and is
  explicitly reset at each new-run admission.
- Success constructs a fresh route cursor at the matched selected occurrence,
  then constructs and enters an ordinary fresh room session for that Postboss.
- Success adopts the native Postboss room that Hades II already restored. It
  stamps only the matched occurrence identity, then enters that same room
  through the ordinary route/room lifecycle. It does not prepare, realize,
  replace, or mutate the room from planner Overview or incoming-reward
  products; those products own room creation, which has already happened.
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
3. asks the admission projection to compare weapon/aspect and the existing
   bounded conformance surface;
4. constructs the route cursor and room coordinator on success; and
5. records one passive mismatch on failure.

The route session owns indexed construction. Room adapters remain ordinary
consumers after successful admission.

### Native admission projection

A focused recovery projection derives the bounded expected values from the
expanded Postboss-entry frame and compares them through the existing low-level
native readers and conformance semantics. It adds no recovery-only reader and
does not make transaction adapters or the protocol decoder aware of native game
state.

## Delivery gates

### Gate A — Recovery contract and wire marker

1. Publish `resumeBoundary: "postbossEntry"` from canonical `PostBoss` room
   kind.
2. Extend the strict model, codec, product validation, and decoder without
   teaching Lua canonical room-kind policy.
3. Prove that F/G/H and N/O/P Postboss occurrences are marked when selected,
   while I/Q terminals and every non-Postboss occurrence are not.
4. Prove the decoder exposes the marked occurrence's fully expanded
   `roomEntered` frame without publishing a second resume snapshot.
5. Refresh only protocol fixtures whose bytes change and keep planner/executor
   copies byte-identical.

Commit boundary: `feat(execution): mark postboss recovery boundaries` plus the
coordinated executor protocol commit.

### Gate B — Admission state projection

1. Project immutable weapon/aspect identity and the nine named admission
   families from the matched occurrence's expanded entry frame.
2. Compare them through the existing loadout and conformance readers, preserving
   their owned exact, set, ordered, absent, and ranged semantics.
3. Keep the projection read-only and independent of route/session creation;
   do not add recovery-only native readers or duplicate the complete owning
   conformance matrices.
4. Add focused witnesses for a complete match, weapon/aspect rejection, each
   family reaching its existing comparator, modeled-trait mismatch, and
   tolerated unrelated or diagnostic-only native state.

Commit boundary: `feat(executor): verify postboss admission state`.

### Gate C — Runtime resynchronization

1. Add the one fresh-process mid-run admission entry point at native room
   start.
2. Remove the executor's save-backed runtime cache. Construct runtime state in
   process-local composition scope and reset it explicitly for every new run.
3. Add route construction at one exact selected index without weakening normal
   cursor advancement.
4. On success, adopt and enter the already-restored native Postboss through a
   fresh ordinary room session without reconstructing or replacing it.
5. On failure, record one passive mismatch and prove no later room retries.
6. Prove that no loadout effect, completed Timeline action, or previous forcing
   scope is replayed.

Commit boundary: `feat(executor): resynchronize at postboss entry` followed by
the modpack-parent integration commit.

### Gate D — Live proof and closure

1. With a full Underworld plan active, restore an H Postboss entry
   checkpoint whose state matches and complete a focused I test.
2. Prove the executor adds no runtime graph to `CurrentRun`, and that the
   native checkpoint saves and reloads without executor serialization errors.
3. Prove one admission-checked Postboss state mismatch becomes passive without
   blocking the game.
4. Prove one non-Postboss mid-run load becomes passive and never retries.
5. If feasible in the same campaign, repeat the successful contact at a Surface
   Postboss; otherwise retain it as the next explicit live-evidence gap.
6. Run the complete planner, executor, Luacheck, fixture-identity, and parent
   smoke gates once after focused tests stabilize.
7. Amend the durable start-of-run-only integration contract with this single
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
| Correct Postboss room with one admission-checked difference     | Passive mismatch naming the state section.                        |
| Correct state plus unrelated or diagnostic-only native data     | Admission succeeds.                                               |
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
