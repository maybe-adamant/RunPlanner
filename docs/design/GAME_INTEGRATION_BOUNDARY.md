# Game Integration Boundary

## Current contract

Protocol v6 carries a complete-valid configured F or F/G prefix. The desktop
publisher writes an execution-only JSON artifact to the Plan Executor's fixed
inbox; the browser build has no publication capability. Publication is a
start-of-run operation. The Executor cannot truthfully attach midway through a
run, repair an edited plan, or continue after a mismatch.

The compiler consumes the exact simulation assembly that the planner already
validated. It does not rerun candidate policy or duplicate validation. The
Executor strictly decodes this bounded artifact, translates its closed facts
through fixed native adapters, observes the player-controlled trace, and stops
at the first mismatch. Neither side searches, repairs, or replans.

The editable project and execution plan are separate schemas. An incomplete or
invalid project can be saved, but it cannot be published. The wire carries
resolved game identifiers and semantic owners, never authored commands,
candidate products, findings, UI labels, callbacks, or Lua.

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
| Observe     | entering a room, choosing an exit, purchase or pickup order             | Compare the player's action with the next expected trace fact     |
| Verify      | Run State counters, bags, traits, retained effects                      | Compare bounded observable state; never use it to steer traversal |

Some timeline steps combine these responsibilities: the runtime realizes an
offer but observes whether and when the player accepts it. The plan remains
conditional on player cooperation; enforcement does not erase player agency.

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
  pair, acquisition, and the fixed return to G.

Ixion and natural generation are not different kinds of Chaos room. The origin
records only whether Ixion inserted the gate so removing that purchase can
remove its generated topology. A visible Chaos gate consumes one pending Ixion
regardless of how the gate originated.

Run State is diagnostic at published lifecycle checkpoints. The observable
surface includes exact counters, ranged reward-bag counts, acquired traits, and
retained effects. A match permits contact to continue; a mismatch blocks it but
never causes the Executor to choose a different room, reward, or action.

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
corrected at the planner/compiler or adapter authority. The Executor must not
hide it with fallback planning.

## Compatibility, transport, and security

The transport is canonical data-only JSON with a strict protocol-v6 decoder,
exact catalog compatibility, bounded collections, closed unions, and no silent
coercion. It permits no dynamic evaluation, executable expressions, arbitrary
paths or commands, or class reconstruction from untrusted names. Compression
or an outer checksum is unnecessary unless later transport evidence justifies
it.

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
