# Reward Frontier Handoff Canonicalization Plan

## Status and base

Locked for implementation on 2026-08-29 against `1f6e9d2d`.

This is a focused planner-engine performance correction. It is independent of
the deferred single-route project-document plan: removing a sibling route does
not correct duplicate reward states carried from one biome into the next.

## Objective

Make a completed biome seed its successor with one branch per distinct
future-observable reward state, rather than one branch per historical path to
that state. Preserve every supported counted-bag possibility, branch-correlated
trait/keepsake/Fear state, and downstream candidate result.

The user-visible outcome is that editing a route after a branch-heavy Fields
biome frontier no longer pauses while the next biome replays hundreds of
semantically duplicate states.

## Measured diagnosis

Profiling `run-plan.runplanner(32).json` established the following current
behavior:

| Boundary                     | Concrete branches | Existing canonical branches |
| ---------------------------- | ----------------: | --------------------------: |
| Enter H from G               |                32 |                           2 |
| After generating H_Combat02  |               128 |                           8 |
| After generating H_Combat03  |               512 |                          24 |
| Before generating H_Combat10 |               512 |                           6 |
| After generating H_Combat10  |               768 |                           4 |
| After generating H_Combat06  |               768 |                           2 |

The existing `mergeEquivalentRewardBranches` authority already identifies the
correct semantic equivalence and unions retained trait and level-resolution
evidence. The defect is that the cross-biome initializer resets biome-local
history and events but returns every transformed input branch without applying
that existing canonicalization.

A temporary local experiment that canonicalized only this handoff reduced a
full simulation of the supplied save from roughly 2.8 seconds to roughly 0.67
seconds. Canonicalizing room-generation boundaries as well reached roughly
0.51 seconds, but that broader change crosses unresolved generated-offer event
lifetimes and is deliberately excluded from this slice.

## Source facts and planner disposition

- Every generated Fields cage offer consumes its counted store even when its
  target room is not selected. This plan does not discard unpicked peers or
  choose one hidden bag outcome.
- Identical visible reward types can consume distinct eligible store entries,
  so genuinely different remaining bag states remain distinct.
- Completed-biome `RewardBranch.events`, current-room history, pending Shops,
  and biome-local counters are reset when constructing the successor biome.
  Historical paths that become identical only after those declared resets have
  no remaining forward distinction.
- The planner therefore canonicalizes after applying all begin-biome resets,
  not before them and not by selecting a representative input branch.

## Included scope

### Planner engine

- In the existing cross-biome path of `initializeRewardBranches`, transform
  every public predecessor branch through the current begin-biome resets and
  then pass the complete transformed collection through
  `mergeEquivalentRewardBranches`.
- Leave first-biome branch construction unchanged.
- Preserve the existing branch-equivalence key and its trait/level evidence
  union. This slice does not introduce hashes, caches, symbolic bags, or a
  second frontier model.

### Tests

- Add one focused engine test owner for handoff canonicalization.
- Prove that duplicate predecessor paths with discarded biome-local event
  differences become one successor branch.
- Prove that distinct forward state—at minimum different counted-bag or
  trait/Fear state—remains distinct.
- Retain representative F/G/H/I evaluation, Fields generation, trait-offer,
  keepsake, and Arcana/Fear witnesses through the existing engine lane.
- Run the existing same-host performance comparison without changing its
  fixture or eight-metric contract. Record the supplied-save timing only as
  diagnostic evidence, not a machine-independent correctness budget.

## Excluded scope

- route-level or application-level result caching;
- the deferred single-route project schema;
- canonicalization inside `roomCreated`, acquisition, or arbitrary chronology
  events;
- changing counted-store declarations, refill rules, peer consumption, or
  Fields generation semantics;
- changing the branch equivalence definition;
- worker offload, asynchronous simulation, seeded RNG, probability, or
  symbolic/interval bag representations; and
- React, Redux, persistence, schema, catalog, or game-module changes.

## Delivery gates and commit boundaries

### Gate A — Engine correction

Implement the cross-biome canonicalization and its focused engine tests in one
commit. Acceptance requires:

- canonicalization occurs after all existing begin-biome transformations;
- semantically distinct branches survive;
- downstream selected offers, findings, candidate domains, and route validity
  retain their existing meaning;
- `npm run test:engine`, engine typechecking, lint, formatting, and diff checks
  pass; and
- the unchanged performance comparison shows no regression, with the supplied
  save manually confirming the diagnosed reduction.

### Gate B — Closure absorption

After Gate A review, update the smallest durable simulation authority and
delivery record with the cross-biome canonical-frontier invariant, delete this
temporary plan, and commit closure. Run the complete repository gate once at
phase closure; do not rerun it after unchanged sequential passes.

## Review audits against

Review must reject the gate if it:

1. drops a distinct counted-bag, trait, keepsake, Hex, Well, Shrine-delivery,
   Arcana, or Fear state;
2. canonicalizes before begin-biome resets or inside an unresolved offer
   lifetime;
3. changes generated-peer consumption to consider only the selected door;
4. adds a parallel frontier model, semantic cache, or route-specific H branch;
5. changes the performance fixture while comparing against the base; or
6. treats duplicate branch count as probability or RNG weighting.

## Completion definition

The slice is complete when a successor biome receives only canonical
future-distinct reward branches, the branch-heavy H save remains semantically
valid while its full simulation falls below the observed one-second
interaction scale on the profiling host, all owning tests pass, durable design
and progress records absorb the invariant, and this plan is removed.
