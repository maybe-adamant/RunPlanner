# Game Integration Boundary

## Current contract

Protocol v9 carries a complete-valid configured F or F/G prefix. The desktop
publisher writes an execution-only JSON artifact to the Plan Executor's fixed
inbox; the browser build has no publication capability. Publication is a
start-of-run operation. The Executor cannot truthfully attach midway through a
run, repair an edited plan, or continue after a mismatch.

The compiler consumes the exact simulation assembly that the planner already
validated. It does not rerun candidate policy or duplicate validation. The
Executor strictly decodes this bounded artifact, translates its closed facts
through fixed native adapters, observes the player-controlled trace, and stops
at the first mismatch. Neither side searches, repairs, or replans.

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

| Planner surface | Execution meaning                                                      | Runtime responsibility                                                      |
| --------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Overview        | What the occurrence contains                                           | Realize supported room objects and fixed contents, then observe contact     |
| Timeline        | What happens in the occurrence and in which order                      | Realize enforceable offer facts; observe player actions and lifecycle order |
| Doors           | Which exits exist, what they offer, and which continuation is selected | Generate supported exits/rewards and observe the selected traversal         |

The protocol preserves concrete room and reward identifiers, repeatable room
occurrences with stable IDs, physical exit identity and order, picked and
unpicked offers, lifecycle ordering, semantic owner addresses, selected
acquisitions versus mere offers, canonical Run State checkpoints, and catalog
compatibility information.

Commands fall into three execution dispositions:

| Disposition | Examples                                                                | Contract                                                          |
| ----------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Realize     | room/door generation, reward identity, selected trait offer, Chaos pair | Apply only through a verified fixed adapter                       |
| Observe     | entering a room, choosing an exit, purchase or pickup order             | Compare semantic player transactions, not incidental callbacks    |
| Verify      | Run State counters, bags, traits, retained effects                      | Compare bounded observable state; never use it to steer traversal |

Some timeline steps combine these responsibilities: the runtime realizes an
offer but observes whether and when the player accepts it. The plan remains
conditional on player cooperation; enforcement does not erase player agency.

Native hooks and blocking checkpoints are deliberately different concepts.
Encounter start/end, cleanup, screen construction, and similar callbacks may
schedule a realization or identify the lifecycle window in which a semantic
transaction occurs. Their exact callback names, duplicate contacts, and
representation-only ordering are not independent conformance requirements.
They block only when the runtime cannot safely realize the next published
semantic result.

The blocking conformance surface is bounded to:

| Checkpoint                    | Compared product                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Room entered                  | occurrence/room identity and the planner-modeled Run State                                                       |
| Semantic Timeline transaction | selected trait or pickup, purchase, sale, keepsake change, fountain use, and other future-relevant player action |
| Exits ready                   | complete exit count, physical types, target room identities, and reward identities                               |
| Exit selected / before exit   | selected continuation, required Timeline settlement, and planner-modeled Run State                               |

The runtime may use several native calls to build one product. Conformance is
decided against the completed semantic product rather than by requiring each
construction callback to mirror an execution-plan row. This keeps lifecycle
wiring available for realization without turning native implementation detail
into a second game model.

The route-start keepsake is a pre-room realization, not a room Timeline step.
The wire carries its exact selected key and any already-authored immediate
equip result. The Executor freezes the plan at the nested `EquipKeepsake`
contact inside `StartNewRun`, arms that result, and lets the matching native
acquire callback consume it. Later rack changes use the same callback adapter
from their ordinary Timeline trace. Only the opening presentation is delayed;
Jeweled Pom, Experimental Hammer, and Transcendent Embryo acquire their result
when the keepsake is equipped.

## Supported F/G surface

The current vertical slice covers ordinary F/G rooms and rewards, supported
encounters and selected trait offers, fixed Preboss/Boss/Postboss continuation,
World Shops, Stygian Wells, Purging Pools, Keepsake Racks, fountains, resources,
and their supported acquisition dispositions. It also covers the following
special topology and interaction owners:

- Narcissus, Artemis, and supported Nemesis random-event resolutions;
- Anomaly replacement and its authored return;
- Zagreus Contract as a distinct additional exit;
- natural and Ixion-generated Chaos gates;
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

Run State is diagnostic at the published room-entered and before-room-exit
checkpoints. The observable surface includes exact counters, ranged reward-bag
counts, acquired traits, and retained effects. A match permits contact to
continue; a mismatch blocks it but never causes the Executor to choose a
different room, reward, or action.

## Mismatch classification

The first mismatch freezes further realization and reports the plan/catalog
fingerprints, semantic owner, checkpoint, expected value, observed value, and
bounded event context.

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

## Compatibility, transport, and security

The transport is canonical data-only JSON with a strict protocol-v9 decoder,
exact catalog compatibility, bounded collections, closed unions, and no silent
coercion. It permits no dynamic evaluation, executable expressions, arbitrary
paths or commands, or class reconstruction from untrusted names. Compression
or an outer checksum is unnecessary unless later transport evidence justifies
it. Run State diagnostics remain complete in the planner's semantic plan; on
the wire, frame zero replaces every closed top-level diagnostic section and
later sequential frames replace only changed sections. `artificer: null` is an
explicit replacement that clears prior state.

The Plan Executor verifies protocol and catalog identity before opening a
session. Runtime identifier existence and checkpoint contact are conformance
checks, not permission to reproduce planner eligibility policy.

## Evidence and deferred scope

Compiler, decoder, and session fixtures prove the local protocol contract.
They do not constitute a live-game probe. A Hades II host is not available in
the current delivery environment, so the prepared native probe remains
unexecuted; no live result is claimed. Each supported native seam still needs
recorded live contact before release confidence can rely on it.

Later-biome realization for H, I, N, O, P, Q, and Dream Dives remains deferred.
Those biomes require their own bounded native commands and probes. Automatic
diagnostic import and game-module UI beyond the fixed status surface are also
deferred.
