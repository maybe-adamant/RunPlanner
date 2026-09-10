# Game Integration Boundary

## Contract

The active strict versioned protocol carries a complete-valid configured
Underworld or Surface prefix, through `F/G/H/I` or `N/O/P/Q`. The desktop
publisher writes an execution-only JSON artifact to one of six fixed Plan
Executor slots in an explicitly selected compatible r2modman profile; the
browser build has no publication capability. Publishing a slot and selecting
the active slot are separate operations. The Executor owns a persistent
`ActivePlanSlot` selection, reads only that slot at the next run admission, and
freezes the decoded plan for the live session. Execution normally admits at
run start; publication does not hot-swap a live session. One bounded recovery
path may instead admit a freshly loaded game at the start of an explicitly
marked Postboss occurrence when its native room, weapon/aspect, and published
entry-conformance state match. No other mid-run attachment, edited-plan repair,
or recovery after a mismatch is supported.

The transport names the slots `slot-1.runplanner.json` through
`slot-6.runplanner.json` under the Plan Executor configuration directory. The
planner never writes an active-pointer file, activates a slot implicitly, or
chooses a profile when more than one compatible profile is present. There is no
compatibility alias, active-pointer reader, or implicit migration. An empty or
invalid selected slot therefore remains a bounded admission error, while
publishing another slot does not disturb a frozen live session.

The compiler consumes the exact simulation assembly that the planner already
validated. It does not rerun candidate policy or duplicate validation. The
Executor strictly decodes this bounded artifact, translates its closed facts
through fixed native adapters, observes the player-controlled trace, and stops
enforcement at the first mismatch. The native game continues from that point;
neither side searches, repairs, or replans.

The planner engine and its complete-valid evaluation document are the sole
authority for concrete acquisition semantics. Each acquisition event carries
its resolved offer, producer lifecycle and store provenance, generated-parent
provenance when applicable, concrete roles, and settlement ownership. The
compiler is only a lossless shape translator from that engine document to the
execution-plan wire: it may select records by their semantic addresses, require
branch agreement, encode addresses, and copy the exact selected trait and level
products. It must not derive domain meaning. If the wire needs another semantic
fact, that fact must first become an explicit engine product. In particular,
the compiler must not recover Artificer, Sea Star, Echo, or other producer
meaning from encoded keys, inspect authored room internals as a fallback, or
substitute a lifecycle point for producer provenance.

The editable project and execution plan are separate schemas. An incomplete or
invalid project can be saved, but it cannot be published. The wire carries
resolved game identifiers and semantic owners, never authored commands,
candidate products, findings, UI labels, callbacks, or Lua.

Feature presence and feature interaction remain distinct facts on the wire.
A present uninteracted Stygian Well or Pool of Purging is emitted with
`interacted: false` and no fabricated inventory. A present interacted feature
is emitted with `interacted: true` and its exact engine-owned inventory. The
native adapter must realize the object in both cases, pass through vanilla
inventory generation only in the former, and constrain the latter.

## Execution ownership

The planner workspace already separates the information the runtime consumes:

| Planner surface | Execution meaning                                                      | Runtime responsibility                                                   |
| --------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Overview        | What the occurrence contains                                           | Realize supported room objects and fixed contents, then observe contact  |
| Timeline        | Consequential occurrence actions and their sparse dependencies         | Realize enforceable facts; bind native actions to published transactions |
| Doors           | Which exits exist, what they offer, and which continuation is selected | Generate supported exits/rewards and observe the selected traversal      |

The protocol preserves concrete room and reward identifiers, repeatable room
occurrences with stable IDs, physical exit identity and order, picked and
unpicked offers, lifecycle ordering, semantic owner addresses, selected
acquisitions versus mere offers, canonical Run State checkpoints, and catalog
compatibility information.

Commands fall into three execution dispositions:

| Disposition | Examples                                                                | Contract                                                                  |
| ----------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Realize     | room/door generation, reward identity, selected trait offer, Chaos pair | Apply only through a verified fixed adapter                               |
| Observe     | entering a room, choosing an exit, or completing a required interaction | Compare only explicit structural facts and obligated transactions         |
| Verify      | Named changed traits, charges, clocks, and retained effects             | Compare only published room-exit conformance facts; never steer with them |

Some timeline steps combine these responsibilities. An acquisition adapter
claims a ready owner and steers its randomized native surface, but completing
that steering handle is not proof that the player chose or retained the
authored result. The plan remains conditional on player cooperation;
enforcement does not erase player agency.

Exact source correlation precedes readiness. A materialized native action must
bind to its published owner rather than to another transaction with a similar
god, reward, or item payload. If the player consumes that exact action before
its published prerequisites complete, the runtime records the generic
`transaction-prerequisite` mismatch and becomes passive while still invoking
the native action. This protects DAG order without turning transaction
completion into semantic result verification.

Native hooks and conformance checkpoints are deliberately different concepts.
Encounter start/end, cleanup, screen construction, and similar callbacks may
schedule a realization or identify the lifecycle window in which a semantic
transaction occurs. Their exact callback names, duplicate contacts, and
representation-only ordering are not independent conformance requirements.
The supported native game functions used by those adapters are required host
infrastructure. A missing function or an error raised by it propagates as an
executor fault; it is not converted into ineligibility, a default value, or a
plan mismatch. Protected calls are used only as exception-safe cleanup around
temporary forcing scopes, and they restore that scope before immediately
rethrowing the original error.
When a standard checkpoint fails, or an exact-bound irreversible action begins
before its published prerequisites, the runtime records the mismatch and stops
planner realization. It must still invoke the native operation and must not
prevent player input, room creation, or traversal. An ordinary steering failure
remains diagnostic until one of those boundaries proves divergence.

The conformance surface is bounded to:

| Checkpoint                    | Compared product                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Room entered                  | occurrence/room identity, published Overview content, and any obligation due at `roomEntered`                                                                      |
| Semantic Timeline transaction | the exact published transaction bound to the native action when it is an explicit obligation; acquisition handles instead express steering and local DAG readiness |
| Exits ready                   | complete exit count, physical types, target room identities, reward identities, and obligations due at outgoing/exit-usable contact                                |
| Room exit                     | obligations due at `roomExit` and only the planner-published named conformance facts that changed in this occurrence                                               |

The runtime may use several native calls to build one product. Conformance is
decided against the completed semantic product rather than by requiring each
construction callback to mirror an execution-plan row. This keeps lifecycle
wiring available for realization without turning native implementation detail
into a second game model.

Selected acquisition transactions remain on the wire with their exact roles,
payloads, and meaningful local dependencies, but they are not checkpoint
obligations. Their completion means that the native action reached its declared
terminal and may release a local dependent; it does not attest that steering or
the resulting state matched. A missing or different player acquisition does
not become an adapter-local semantic comparison: durable modeled results are
checked only by the sparse named room-exit conformance facts selected by the
planner. Simulation-neutral health, Magick, Gold, Armor, healing, and
meta-progression results intentionally have no blocking completion proof.
The executor trusts planner eligibility and does not preflight exact trait rows
through `IsTraitEligible`, duo requirements, replacement constraints, or a
second offer-legality policy before forcing them.

The route-start keepsake is a pre-room realization, not a room Timeline step.
The wire carries its exact selected key and any already-authored immediate
equip result. The Executor freezes the plan at the nested `EquipKeepsake`
contact inside `StartNewRun`, arms that result, and lets the matching native
acquire callback consume it. Later rack changes use the same callback adapter
from their ordinary Timeline trace. Only the opening presentation is delayed;
Jeweled Pom, Experimental Hammer, and Transcendent Embryo acquire their result
when the keepsake is equipped.

## Supported fixed-route surface

The supported fixed-route surface covers ordinary rooms and rewards, supported
encounters and selected trait offers, fixed Preboss/Boss/Postboss continuation,
World Shops, Stygian Wells, Purging Pools, Keepsake Racks, fountains, resources,
and their supported acquisition dispositions. It also covers the following
special topology and interaction owners:

- Narcissus, Artemis, and supported Nemesis random-event resolutions;
- Anomaly replacement and its authored return;
- Zagreus Contract as a distinct additional exit;
- natural and Ixion-generated Chaos gates;
- H Fields cage placement and cage rewards;
- N Hub doors, rewards, side-room presence, and side-room rewards;
- O ShipCombat phase count, wheel cohorts, wheel rewards, and selected pickups;
- P's native ordered PreCombat/Combat envelope and Heracles suffix termination;
- Q's ordinary stage-resolved rooms, World Shop, fixed Boss link, and terminal
  topology;
- three authored distinct Chaos curse options, the selected curse/blessing
  pair, acquisition, and the selected Chaos map's declaration-sized visible
  return batch to G.

For Chaos, the selected blessing is reserved for the selected curse before the
native screen is constructed. The other two blessings remain distinct
native-generated peers. Their omission from the engine document is deliberate:
they are neither acquired nor consumed by later planner semantics.

Ixion and natural generation are not different kinds of Chaos room. The origin
records only whether Ixion inserted the gate so removing that purchase can
remove its generated topology. A visible Chaos gate consumes one pending Ixion
regardless of how the gate originated.

Complete Run State snapshots are diagnostic-only at the published room-entered
and before-room-exit checkpoints. They may expose counters, ranged reward-bag
counts, acquired traits, and retained effects for later adjudication, but a
difference in that diagnostic frame never blocks execution by itself. The
planner separately publishes the sparse named facts that changed during the
room. Only a mismatch in one of those named conformance facts, a required
Timeline obligation, or another explicit structural/transaction comparison
stops further planner enforcement. The native contact still completes and the
Executor never chooses a substitute room, reward, or action.

A Pool of Purging sale illustrates the boundary. The authored sale does not
become an execution Timeline transaction: Overview constrains the visible Pool
inventory and the room-exit `traitInventory` fact proves the expected trait
removal. The Executor neither reimplements the sale nor requires its individual
button callback to complete an action handle.

Shop, Well, and Shrine inventory is likewise Overview content. Ordinary
payment, affordability, and purchase-counter behavior remain native and do not
publish execution transactions. A purchased row instead publishes its acquired
result, which the ordinary source-independent acquisition, transformation, or
item-effect adapter settles. Travel Deal is the sole dynamic inventory
exception: the wire names its exact refill realization and payload. World
Shop's dedicated refill callback can report an unexpected refill
diagnostically; Well and Shrine use generic native contacts and pass through
when no refill was published.

## Mismatch classification

Runtime contacts have five distinct outcomes. Adapters must not promote a
weaker outcome into a mismatch merely because they can observe it.

| Outcome             | Meaning                                                                                             | Runtime disposition                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Admission rejection | A selected slot is absent, malformed, incompatible, or not a complete execution plan.               | Do not create a synchronized session; report the admission error.                                            |
| Executor fault      | A required host function is missing or throws, or a decoded-plan/session invariant fails.           | Restore temporary forcing scope, report or propagate the fault, and do not describe it as player divergence. |
| Incidental contact  | Native code reaches a supported hook but no compatible published owner claims it.                   | Pass through unchanged without completing a transaction or desynchronizing.                                  |
| Diagnostic          | A bounded actuator could not install or apply its intended steering.                                | Record bounded evidence and continue native behavior without changing synchronization.                       |
| Execution mismatch  | A standard checkpoint or premature exact-owner action proves the remaining simulated prefix unsafe. | Preserve the first mismatch, stop later realization, and let the native game continue.                       |

The first execution mismatch reports the plan/catalog fingerprints, semantic
owner, checkpoint, expected value, observed value, and bounded event context.
The executor then becomes passive: the game continues natively, and no hooked
game function returns early merely because the execution session
desynchronized.

- A `playerDivergence` means the player performed a different observable action
  from the published trace.
- A `conformanceDiscrepancy` means the player followed the trace but the live
  game did not match a realized or verified fact.

A non-player discrepancy is evidence that the planner under-models the game or
that a native adapter is wrong. It must be adjudicated against game data and
corrected at the planner-engine or adapter authority. A compiler correction is
appropriate only when its lossless translation omitted or misencoded an
already-explicit engine fact. The Executor must not hide a discrepancy with
fallback planning.

Representative boundaries keep this policy concrete:

- A trait, Pom, or automatic-effect adapter completes when its native steering
  terminal returns. A local steering failure is diagnostic; the published
  room-exit trait, Arcana, keepsake, or retained-effect fact proves the durable
  outcome.
- Travel Deal binds one exact dynamic refill carrier, generation, and slot. An
  unrelated refill passes through. A refill at the wrong published slot is
  diagnostic and does not complete the declared refill; the outstanding
  obligation fails at its ordinary deadline if the exact terminal never
  occurs.
- Artificer completes only after the expected replacement is observed and the
  source is destroyed. A presentation callback or wrong replacement is useful
  diagnostic evidence, but it is not the declared terminal.
- A native encounter, pickup, purchase, or transformation with no compatible
  owner is incidental. Its existence is not itself a reason to stop a run.

Faults remain a separate infrastructure boundary. Unknown Timeline handles,
conflicting native bindings, missing decoded owners, unsupported lifecycle
checkpoints, closed-session use, malformed post-admission payloads, and missing
or throwing required native functions are executor defects. Exception guards
may restore temporary forcing state before rethrowing; they are never fallback
gameplay behavior.

## Compatibility, transport, and security

The transport is canonical data-only JSON with a strict versioned decoder,
exact catalog compatibility, bounded collections, closed unions, and no silent
coercion. It permits no dynamic evaluation, executable expressions, arbitrary
paths or commands, or class reconstruction from untrusted names. Compression
or an outer checksum is unnecessary unless later transport evidence justifies
it. Run State diagnostics remain complete in the planner's semantic plan; on
the wire, frame zero replaces every closed top-level diagnostic section and
later sequential frames replace only changed sections. `artificer: null` is an
explicit replacement that clears prior state.

Publication is profile-scoped transport, not authored or execution semantics.
The desktop adapter resolves a compatible profile again at write time, maps a
caller-supplied slot number in the closed range 1 through 6 to its fixed
filename, confines the destination below that profile's Plan Executor
configuration tree, rejects links and non-regular files, enforces the existing
1 MiB bound, and atomically replaces only the selected slot. The Plan Executor
persists `ActivePlanSlot` (defaulting to Slot 1), displays the selected slot's
bounded status, and loads and freezes that one slot only at the next new-run
or eligible Postboss admission. Changing the setting cannot hot-swap a live
session.

Postboss recovery is a fresh admission, not restoration of serialized executor
state. It is attempted once when a new game process attaches to an existing run
at a selected occurrence marked `resumeBoundary: "postbossEntry"`. The executor
adopts the already-restored native room, compares the existing bounded
conformance families plus weapon/aspect identity, and constructs fresh route
and room coordinators at that occurrence. A mismatch makes execution passive;
the executor does not search another slot, retry at later rooms, replay loadout
effects, or reconstruct earlier Timeline progress.

The Plan Executor verifies protocol and catalog identity before opening a
session. Runtime identifier existence and checkpoint contact are conformance
checks, not permission to reproduce planner eligibility policy. Exact source
binding and published prerequisite readiness are execution coordination, not
eligibility inference.

## Deferred scope

Wrong continuation is detected by the next room-entry identity check; the
executor deliberately has no separate selected-transition conformance
checkpoint.

Dream Dive route ordering, Postboss selection, and phase differences remain
deferred pending their own source audit and authored-route product. Automatic
diagnostic import and game-module UI beyond the fixed status surface are also
deferred.
