# Execution Protocol v7 Transport Plan

## Status

**Implementation-ready.**

This focused cross-repository gate starts from Run Planner
`c73df8ac4ec8add78e83d273ab19e714cd9c4ed8` and Plan Executor
`558b8a28d6095ec517329b168f3dc25f0faf3a38`. It changes only the
execution-plan transport representation. Planner simulation, execution
semantics, lifecycle checkpoints, live observation, mismatch classification,
and first-mismatch blocking remain unchanged.

## Objective

Reduce execution-plan growth before four-biome support by removing repeated
Run State snapshots and unused synthetic trace identifiers. The current F/G
fixtures spend roughly two thirds of compact JSON on complete Run State copies.
Measured against the checked-in fixtures, sequential top-level replacements
plus trace-ID removal reduce compact F/G artifacts by about 60 percent.

## Locked protocol-v7 shape

The planner's in-memory `ExecutionPlan` continues to contain a complete
`ExecutionRunStateDiagnostic` at every supported checkpoint. Only the wire
codec is compact.

Each wire checkpoint carries one sequential frame:

```json
{
  "frame": 17,
  "owner": "semantic checkpoint owner",
  "checkpoint": "roomEntered",
  "replace": {
    "counters": {},
    "bags": []
  }
}
```

- Frame zero must replace every Run State top-level section.
- Every later frame number must be exactly the prior frame plus one.
- Later `replace` objects contain only changed top-level sections; an empty
  replacement is legal.
- Replacement keys are the current closed diagnostic sections. Values retain
  their existing exact shapes and bounds.
- Key presence is distinct from value presence. In particular,
  `"artificer": null` explicitly clears prior Artificer state.
- Owner and checkpoint remain explicit provenance and must close the containing
  room/checkpoint.
- There is no base graph, frame lookup, deep patch language, delete language,
  string dictionary, compression, or segmented plan.

The TypeScript encoder computes frames from the complete semantic plan. The
TypeScript decoder validates and reconstructs the complete semantic plan, so
`decode(encode(plan))` remains equal to `plan`. The Lua decoder validates and
normalizes frames without reimplementing planner policy. At the matching live
checkpoint, the session applies the next frame to session-owned expected state
and performs the existing comparison unchanged. It never applies a future
frame, searches for a frame, or repairs observed state.

Protocol v7 also removes `ExecutionTraceStep.id`. These IDs are synthetic
compiler strings, are not semantic owners, and have no runtime behavior. The
single required-pickup mismatch that currently reports a trace ID will report
the existing semantic action owner instead.

The plan fingerprint remains derived from the complete expanded semantic plan,
including protocol version 7, rather than from formatting or transport
compaction details. Protocol v6 is rejected; no beta migration chain is added.

## Ownership and files

Run Planner owns:

- protocol/version and expanded execution model;
- strict wire framing, delta construction, and round-trip reconstruction;
- removal of synthetic trace IDs from compiler output;
- shared readable protocol-v7 fixtures; and
- durable boundary/progress documentation.

Plan Executor owns:

- strict frame decoding and bounds;
- session-local expected-state frame application at the observed checkpoint;
- use of semantic action owners in mismatch evidence;
- unchanged live diagnostic comparison; and
- its mirrored byte-identical fixtures and README compatibility statement.

The shell repository owns only the final validated Plan Executor submodule pin.
Its unrelated dirty submodules remain untouched.

## Acceptance witnesses

Primary Run Planner tests must prove:

- protocol-v7 encode/decode reconstructs the exact expanded plan;
- frame zero is complete;
- empty deltas reconstruct correctly;
- a skipped, repeated, reordered, negative, or non-integer frame is rejected;
- unknown replacement keys and malformed replacement values are rejected;
- nullable Artificer state can be introduced and cleared;
- trace steps no longer publish synthetic IDs; and
- representative compact F, F/G, and F/G Ixion/Chaos fixtures are materially
  smaller than their expanded JSON without a hard long-term byte budget.

Primary Plan Executor tests must prove:

- the same wire fixtures decode;
- frame zero and sequential deltas are applied only at their matching trace
  checkpoints;
- empty replacements retain prior expected state;
- malformed sequencing, unknown fields, and Artificer clearing are rejected or
  applied exactly as appropriate;
- repeated observation cannot advance a frame twice;
- existing exact counter, ranged bag, trait, retained-state, and player
  divergence witnesses retain their classifications; and
- the first mismatch still blocks every later realization.

Validation is narrow during implementation. Closure runs the Run Planner's
complete `npm run check`, Plan Executor's Lua suite and source parsing, and its
existing Luacheck policy. The shared fixtures must be byte-identical.

## Commit and closure boundaries

1. Commit this locked plan in Run Planner.
2. Land one coherent protocol-v7 implementation commit in Plan Executor.
3. Land one coherent protocol-v7 implementation/fixture commit in Run Planner.
4. After independent review and complete closure validation, pin only the Plan
   Executor submodule in the shell repository.
5. Absorb the stable v7 decision into
   `docs/design/GAME_INTEGRATION_BOUNDARY.md`, the Executor README, and durable
   progress; then delete this temporary plan in the Run Planner implementation
   commit.

## Explicit non-goals

- No simulation, eligibility, topology, reward, trait, or lifecycle change.
- No change to the checkpoints at which Run State is compared.
- No change to live observation or mismatch classification.
- No deep field patches, operation language, generic diff library, or runtime
  planner.
- No string interning, abbreviated keys, compression, binary transport,
  streaming, or plan segmentation.
- No later-biome execution behavior.
- No cleanup of unrelated planner, Executor, or shell code.
