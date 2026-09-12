# Engine source directory disposition

Snapshot: `05cc25b9`, after Slice A; 321 source files.
This is a temporary directory review before Slice B, not a new design authority.
No source movement or semantic changes are performed by this document.

## Current complete tree

The tree below is the actual filesystem, not a proposed layout. Every source
file is included. Tests are intentionally outside this inventory.

```text
src/
├── authored-project/
│   ├── acquisition/
│   │   ├── acquisition-entry.ts
│   │   ├── acquisition-sources.ts
│   │   ├── artificer.ts
│   │   ├── pickup-producers.ts
│   │   ├── reward-state.ts
│   │   └── sea-star.ts
│   ├── commands/
│   │   ├── acquisition/
│   │   │   ├── acquisition-conversion.ts
│   │   │   ├── acquisition-site.ts
│   │   │   ├── reward-source.ts
│   │   │   └── sea-star.ts
│   │   ├── occurrence/
│   │   │   ├── dispatch.ts
│   │   │   ├── encounter.ts
│   │   │   ├── fields.ts
│   │   │   ├── incoming-reward.ts
│   │   │   ├── leaf-value.ts
│   │   │   ├── local-reward.ts
│   │   │   ├── mutation.ts
│   │   │   ├── ship.ts
│   │   │   └── shop.ts
│   │   ├── topology/
│   │   │   ├── construction.ts
│   │   │   ├── dispatch.ts
│   │   │   ├── hub.ts
│   │   │   ├── local-visits.ts
│   │   │   ├── ordinary.ts
│   │   │   └── takeover.ts
│   │   ├── contract.ts
│   │   ├── dispatch.ts
│   │   ├── fields-spatial.ts
│   │   ├── figurine-arcana.ts
│   │   ├── judgment-arcana.ts
│   │   ├── keepsake.ts
│   │   ├── level-resolution.ts
│   │   ├── project-state.ts
│   │   ├── resources.ts
│   │   ├── room-actions.ts
│   │   ├── room-replacement.ts
│   │   ├── route-detours.ts
│   │   ├── selection-state.ts
│   │   ├── steady-growth.ts
│   │   ├── topology-reconciliation.ts
│   │   ├── trait-offer.ts
│   │   └── types.ts
│   ├── room-actions/
│   │   ├── defaults.ts
│   │   ├── domain.ts
│   │   ├── key.ts
│   │   ├── lifecycle-structure.ts
│   │   └── state.ts
│   ├── room-state/
│   │   ├── decoding/
│   │   │   ├── acquisition-site-codec.ts
│   │   │   ├── fields-spatial-codec.ts
│   │   │   ├── gorgon-outcome-codec.ts
│   │   │   ├── nemesis-outcome-codec.ts
│   │   │   ├── reward-acquisition-codec.ts
│   │   │   ├── room-action-codec.ts
│   │   │   ├── ship-ephyra-codec.ts
│   │   │   ├── shop-codec.ts
│   │   │   └── well-codec.ts
│   │   ├── all-together.ts
│   │   ├── codec.ts
│   │   ├── declaration.ts
│   │   ├── defaults.ts
│   │   ├── echo-last-run.ts
│   │   ├── encounter-envelope.ts
│   │   ├── encounter-reconciliation.ts
│   │   ├── encounter-trait-offers.ts
│   │   ├── encounters.ts
│   │   ├── level-effects.ts
│   │   └── replacement.ts
│   ├── topology/
│   │   ├── decoding/
│   │   │   ├── coordinator.ts
│   │   │   ├── decisions.ts
│   │   │   └── raw.ts
│   │   ├── codec.ts
│   │   ├── impact.ts
│   │   ├── occurrence-codec.ts
│   │   ├── query.ts
│   │   ├── room-ownership.ts
│   │   └── source-identity.ts
│   ├── traits/
│   │   ├── carrier-children.ts
│   │   ├── hex-tree.ts
│   │   └── state.ts
│   ├── addresses.ts
│   ├── batchState.ts
│   ├── biomeState.ts
│   ├── chaos-gate-reconciliation.ts
│   ├── codec.ts
│   ├── completion-boss.ts
│   ├── defaults.ts
│   ├── fields.ts
│   ├── fixed-room-links.ts
│   ├── fountain-rarity-codec.ts
│   ├── hermes-shrine-delivery.ts
│   ├── history.ts
│   ├── index.ts
│   ├── keepsake-equip-codec.ts
│   ├── loadout.ts
│   ├── model.ts
│   ├── shop.ts
│   └── validation.ts
├── catalog-schema/
│   ├── index.ts
│   └── traits.ts
├── execution-plan/
│   ├── assembly/
│   │   ├── diagnostics.ts
│   │   ├── doors.ts
│   │   ├── g-anomaly.ts
│   │   ├── hub.ts
│   │   ├── lifecycle.ts
│   │   ├── loadout.ts
│   │   ├── occurrence.ts
│   │   ├── overview.ts
│   │   ├── route.ts
│   │   ├── support.ts
│   │   ├── timeline-relations.ts
│   │   ├── timeline-transactions.ts
│   │   └── validation.ts
│   ├── codec/
│   │   ├── diagnostics.ts
│   │   ├── doors.ts
│   │   ├── loadout.ts
│   │   ├── occurrence.ts
│   │   ├── overview.ts
│   │   ├── primitives.ts
│   │   ├── references.ts
│   │   ├── resources.ts
│   │   ├── rewards.ts
│   │   ├── room.ts
│   │   └── timeline.ts
│   ├── assembler-errors.ts
│   ├── assembler.ts
│   ├── codec.ts
│   ├── compiler.ts
│   ├── graph-validation.ts
│   ├── index.ts
│   └── model.ts
├── normalized/
│   └── collection.ts
├── requirements/
│   ├── evaluator.ts
│   ├── index.ts
│   └── model.ts
├── reward-kernel/
│   ├── bag.ts
│   ├── bindings.ts
│   ├── history.ts
│   ├── index.ts
│   ├── level-effects.ts
│   ├── model.ts
│   ├── shop.ts
│   └── support.ts
└── simulation/
    ├── candidates/
    │   ├── trait-offer/
    │   │   └── echo-draft.ts
    │   ├── acquisition-conversion.ts
    │   ├── availability.ts
    │   ├── batch-reward-store.ts
    │   ├── contract.ts
    │   ├── evaluated-biome.ts
    │   ├── fields-cage-outcome.ts
    │   ├── fields-spatial.ts
    │   ├── figurine-arcana.ts
    │   ├── fountain-rarity.ts
    │   ├── hub.ts
    │   ├── index.ts
    │   ├── judgment-arcana.ts
    │   ├── keepsake-equip-result.ts
    │   ├── keepsake-selection.ts
    │   ├── reward-producer.ts
    │   ├── room-lifecycle.ts
    │   ├── room-target.ts
    │   ├── session.ts
    │   ├── ship-owner.ts
    │   ├── start-room.ts
    │   ├── steady-growth.ts
    │   ├── takeover-hub.ts
    │   ├── takeover-preboss.ts
    │   ├── trait-offer-availability.ts
    │   ├── trait-offer-capability.ts
    │   ├── trait-offer-selected-effects.ts
    │   ├── trait-offer.ts
    │   └── transcendent-embryo.ts
    ├── commerce/
    │   ├── hermes-shrine.ts
    │   ├── purging-pool.ts
    │   └── stygian-well.ts
    ├── encounters/
    │   ├── authoring-domain.ts
    │   ├── candidates.ts
    │   ├── fig-leaf.ts
    │   ├── index.ts
    │   ├── model.ts
    │   ├── preparation.ts
    │   ├── resolve.ts
    │   └── structural.ts
    ├── fields/
    │   ├── optional-count.ts
    │   └── spatial.ts
    ├── generation/
    │   ├── biome.ts
    │   ├── candidate-artifacts.ts
    │   ├── fields-cage.ts
    │   ├── first-target-takeover.ts
    │   ├── hub.ts
    │   ├── index.ts
    │   ├── model.ts
    │   └── normal-targets.ts
    ├── history/
    │   ├── compose.ts
    │   ├── composition.ts
    │   ├── facts.ts
    │   ├── fold.ts
    │   ├── index.ts
    │   ├── lifecycleInput.ts
    │   └── model.ts
    ├── keepsakes/
    │   ├── branch-transitions.ts
    │   ├── candidate-artifacts.ts
    │   ├── encounter-effects.ts
    │   ├── reward-effects.ts
    │   ├── state.ts
    │   └── trait-effects.ts
    ├── lifecycle/
    │   ├── execute.ts
    │   ├── index.ts
    │   └── model.ts
    ├── materialization/
    │   ├── batch.ts
    │   ├── biome.ts
    │   ├── decision-facts.ts
    │   ├── hub.ts
    │   ├── index.ts
    │   ├── model.ts
    │   └── rooms.ts
    ├── progressive/
    │   ├── biome.ts
    │   ├── clamp.ts
    │   ├── finding-location.ts
    │   ├── prefix.ts
    │   ├── products.ts
    │   └── selected-products.ts
    ├── rewards/
    │   ├── acquisition/
    │   │   ├── artifacts.ts
    │   │   ├── contracts.ts
    │   │   ├── conversions.ts
    │   │   ├── role-settlement.ts
    │   │   ├── site-settlement.ts
    │   │   └── source.ts
    │   ├── biome/
    │   │   ├── encounter-acquisition/
    │   │   │   ├── acquisition-point-reached.ts
    │   │   │   ├── encounter-settlement.ts
    │   │   │   ├── gorgon-started.ts
    │   │   │   └── well-purchase.ts
    │   │   ├── generation/
    │   │   │   ├── authored-site-settlement.ts
    │   │   │   ├── emissions.ts
    │   │   │   ├── hub-board.ts
    │   │   │   ├── incoming-generation.ts
    │   │   │   ├── local-generation.ts
    │   │   │   ├── outgoing-generation.ts
    │   │   │   ├── room-created-context.ts
    │   │   │   ├── room-created-prelude.ts
    │   │   │   ├── room-created.ts
    │   │   │   └── target-generation-completed.ts
    │   │   ├── lifecycle-transitions/
    │   │   │   ├── encounter-end-effects.ts
    │   │   │   ├── encounter-started.ts
    │   │   │   ├── fountain-used.ts
    │   │   │   ├── keepsake-rack-used.ts
    │   │   │   ├── room-entered.ts
    │   │   │   ├── room-exited.ts
    │   │   │   ├── room-prepared.ts
    │   │   │   └── types.ts
    │   │   ├── offer-lifecycle/
    │   │   │   ├── fields-optional-materialization.ts
    │   │   │   ├── offer-point-materialized.ts
    │   │   │   ├── reached-settlement.ts
    │   │   │   ├── reward-wheel-lifecycle.ts
    │   │   │   ├── reward-wheel-offer-point-materialized.ts
    │   │   │   └── shop-offer-point-materialized.ts
    │   │   ├── biome-contract.ts
    │   │   ├── chronology.ts
    │   │   ├── evaluation-contract.ts
    │   │   ├── finding-chronology.ts
    │   │   ├── index.ts
    │   │   ├── prepared-inputs.ts
    │   │   ├── publication.ts
    │   │   ├── reward-sources.ts
    │   │   ├── reward-store-support.ts
    │   │   ├── room-reward-bindings.ts
    │   │   └── selected-trait-products.ts
    │   ├── shop/
    │   │   ├── context.ts
    │   │   ├── derived-rewards.ts
    │   │   ├── inventory.ts
    │   │   └── settlement.ts
    │   ├── trait-settlement/
    │   │   ├── concave-stone-secondary.ts
    │   │   ├── encounter-child-settlement.ts
    │   │   ├── hex-settlement.ts
    │   │   └── selected-child-settlement.ts
    │   ├── anvil-settlement.ts
    │   ├── authoring-domain.ts
    │   ├── branch-lifecycle.ts
    │   ├── branch-primitives.ts
    │   ├── facts.ts
    │   ├── findings.ts
    │   ├── index.ts
    │   ├── level-resolution-settlement.ts
    │   ├── lifecycle-artifacts.ts
    │   ├── model.ts
    │   ├── offer-generation.ts
    │   ├── producer-frontiers.ts
    │   ├── run-state-conformance.ts
    │   ├── run-state.ts
    │   └── trait-settlement.ts
    ├── room-actions/
    │   ├── assemble.ts
    │   ├── index.ts
    │   ├── model.ts
    │   └── timeline.ts
    ├── traits/
    │   ├── authoring/
    │   │   ├── assessment.ts
    │   │   └── drafts.ts
    │   ├── history/
    │   │   ├── fold.ts
    │   │   ├── model.ts
    │   │   ├── transitions.ts
    │   │   └── upgrades.ts
    │   ├── index.ts
    │   ├── level-effects.ts
    │   ├── offer-domain.ts
    │   ├── offer-levels.ts
    │   ├── offers.ts
    │   └── rarity.ts
    ├── arcana-fear.ts
    ├── authoring-boundary.ts
    ├── authoring-readiness.ts
    ├── biome-evaluation.ts
    ├── candidate-artifacts.ts
    ├── completeness.ts
    ├── evaluation-products.ts
    ├── finding-regions.ts
    ├── hex-progress.ts
    ├── index.ts
    ├── model.ts
    ├── occurrence-outgoing.ts
    ├── project-evaluation-assembly.ts
    ├── project.ts
    ├── resources.ts
    └── timeline-facts.ts
```

## Decision rule

Group files by the product or transition they own, not filename suffix,
file size, or whichever consumer currently imports them. Keep layer separation:
authored state is not simulation; simulation facts are not execution assembly.
An adjacent pair does not automatically need another folder.

The final directory pass should finish the useful moves, then stop. Slices C/D
remain separate ownership extractions, not game-behavior changes.

## Whole-tree disposition

| Neighborhood                                          | Decision                                                      | Reason                                                                                                                                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog-schema/`                                     | Keep                                                          | Supported normalized contracts; splitting large declarations is not directory cleanup.                                                                                                          |
| `normalized/`                                         | Keep                                                          | Collection construction has a clear small owner. Do not bury it in generic utilities.                                                                                                           |
| `requirements/`                                       | Keep                                                          | Model, evaluator and supported surface form a complete domain.                                                                                                                                  |
| `reward-kernel/`                                      | Keep                                                          | Bag, binding, history and shop primitives are related kernel responsibilities, distinct from chronological settlement.                                                                          |
| `authored-project/` root                              | Keep remaining project-wide and small domain files            | Model, addresses, decoder, defaults, history, loadout and validation are genuine entry/contracts. Remaining route and feature helpers are not a miscellaneous folder waiting to happen.         |
| `authored-project/acquisition/`                       | Keep                                                          | Source/entry identity, dispositions and generated pickup structure now have one neighborhood. No simulation settlement belongs here.                                                            |
| `authored-project/traits/`                            | Keep                                                          | Persisted trait state, child editing and Hex structure belong together. The broad contents of state.ts are a separate ownership question, not justification for more moves now.                 |
| `authored-project/commands/`                          | Mostly keep; move Fields spatial handler                      | Shared command contract/dispatch/types and distinct command families can remain visible. Fields spatial edits belong beside occurrence Fields edits.                                            |
| `commands/acquisition/`                               | Keep                                                          | Complete acquisition command family, separate from authored data helpers.                                                                                                                       |
| `commands/occurrence/`                                | Keep, add fields-spatial                                      | Occurrence-local mutations and dispatch; no topology coordinator merger.                                                                                                                        |
| `commands/topology/`                                  | Keep                                                          | Ordinary, takeover, Hub and local-visit mutation are a coherent family.                                                                                                                         |
| `authored-project/room-actions/`                      | Keep                                                          | Authored active domains, defaults and action identities; not a simulation scheduler.                                                                                                            |
| `authored-project/room-state/`                        | Finish decoder grouping                                       | Defaults/declaration/reconciliation remain here. Four decoding modules still sit outside the decoding group.                                                                                    |
| `room-state/decoding/`                                | Keep and finish the group                                     | Local validation/decoding, with unchanged whole-occurrence closure in topology.                                                                                                                 |
| `authored-project/topology/` and `topology/decoding/` | Keep                                                          | Queries, identity, impact, structural decoding and attachment are distinct from room-local validation.                                                                                          |
| `simulation/` root                                    | Reduce through planned B moves; retain shared/domain products | Composition and progressive policy have real homes; root facts and single-domain owners do not all need folders.                                                                                |
| `simulation/candidates/`                              | Keep broad family directory; finish trait-offer subgroup      | The families answer different exact-context questions. A large directory is acceptable when filenames are explicit.                                                                             |
| `candidates/trait-offer/`                             | Consolidate existing siblings                                 | Current BBB-only nested file plus four outer siblings is an incomplete family grouping.                                                                                                         |
| `simulation/commerce/`                                | Keep                                                          | Shrine/Well/Pool assessments, not acquisition settlement or authored inventory.                                                                                                                 |
| `simulation/encounters/`                              | Keep                                                          | Structural selection, preparation, resolution and candidate products are coherent.                                                                                                              |
| `simulation/fields/`                                  | Keep                                                          | Spatial and optional-count policy have a clear shared subject.                                                                                                                                  |
| `simulation/generation/`                              | Keep directory; extract only in D                             | Shared target policy currently owned by normal-targets needs responsibility work, not another hierarchy.                                                                                        |
| `simulation/history/`                                 | Keep                                                          | Room history composition and folding share one neighborhood; do not mix with trait history.                                                                                                     |
| `simulation/keepsakes/`                               | Keep                                                          | State plus encounter/reward/trait effects and artifacts; do not split by each keepsake.                                                                                                         |
| `simulation/lifecycle/`                               | Keep                                                          | The large executor is an ordered simulation coordinator. Its size is not a reason for an event-handler directory.                                                                               |
| `simulation/materialization/`                         | Keep until C                                                  | Room leaf construction/common assembly will own their final room subgroup during extraction, not move first and move again.                                                                     |
| `simulation/progressive/`                             | Add boundary/readiness in B                                   | Coverage, retained prefixes, owner location and edit horizon are related products; no new blocker abstraction.                                                                                  |
| `simulation/rewards/`                                 | Move trait-settlement coordinator in B; keep other roots      | Branch state, facts, frontiers, level/Anvil settlement and publication are recognizable related authorities.                                                                                    |
| `rewards/acquisition/` and `rewards/shop/`            | Keep                                                          | Recently established complete settlement products; do not repeat their decomposition.                                                                                                           |
| `rewards/trait-settlement/`                           | Bring its coordinator inside                                  | Existing child/Hex/Stone helpers and outer trait-settlement.ts should form one neighborhood.                                                                                                    |
| `rewards/biome/`                                      | Keep                                                          | Chronology, prepared inputs and publication surround the existing transition families.                                                                                                          |
| `rewards/biome/generation/`                           | Keep                                                          | Reward branch generation, not topology room-target generation; the similar name reflects a genuinely different layer.                                                                           |
| `rewards/biome/encounter-acquisition/`                | Keep for this pass                                            | These are chronology handoffs, not the standalone acquisition algorithm. Well purchase placement is imperfect naming but moving it into Shop would confuse transition dispatch with settlement. |
| `rewards/biome/lifecycle-transitions/`                | Keep                                                          | Phase transitions belong together; preserve chronology and pending-state order.                                                                                                                 |
| `rewards/biome/offer-lifecycle/`                      | Keep                                                          | Materialization/reached-settlement contacts for offer carriers share a clear purpose.                                                                                                           |
| `simulation/room-actions/`                            | Keep                                                          | Derived roster/timeline products remain separate from authored action domains and lifecycle execution.                                                                                          |
| `simulation/traits/`, `authoring/`, `history/`        | Keep                                                          | Recent complete ownership boundaries; no second regrouping around individual traits.                                                                                                            |
| `execution-plan/`                                     | Keep                                                          | Assembler, data compiler, codec, model and shared graph validation have distinct responsibilities.                                                                                              |
| `execution-plan/assembly/`                            | Keep                                                          | Fact-family mapping is already decomposed. Do not regroup it by biome or duplicate simulation.                                                                                                  |
| `execution-plan/codec/`                               | Keep                                                          | Wire-family decoding is already coherent, independent of semantic assembly.                                                                                                                     |

## Final recommended mechanical move list

### Finish the authored grouping

These are newly identified omissions, not fixes to runtime behavior:

1. `authored-project/room-state/all-together.ts` →
   `room-state/decoding/all-together-codec.ts`.
2. `authored-project/room-state/echo-last-run.ts` →
   `room-state/decoding/echo-last-run-codec.ts`.
3. `authored-project/room-state/encounters.ts` →
   `room-state/decoding/encounter-state-codec.ts`.
4. `authored-project/room-state/encounter-trait-offers.ts` →
   `room-state/decoding/encounter-trait-offer-codec.ts`.
5. `authored-project/commands/fields-spatial.ts` →
   `commands/occurrence/fields-spatial.ts`.

The first three export structural decoders: decodeAllTogetherResult,
decodeEchoLastRunBoon and decodeRoomEncounterState. Fields spatial dispatch
edits the occurrence's spatial state and already uses occurrence/mutation.

Slice A's suffix-based selection missed these decoder files. Correcting their
placement is worthwhile before considering the directory pass finished.

`encounter-trait-offers.ts` also exports `legalTraitOfferEncounterKeys`, but its
only production consumer is the encounter-state decoder. It delegates to the
existing encounter binding authority, so moving this decoding family together
does not relocate general authoring policy. Keep `encounter-envelope.ts` where
it is: that is shared binding/selection policy, not a decoder.

### Complete the planned simulation grouping

| Current file(s), relative to simulation                                                                         | Final destination                          |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| project.ts, biome-evaluation.ts, project-evaluation-assembly.ts, evaluation-products.ts, candidate-artifacts.ts | evaluation/, retaining basenames           |
| authoring-boundary.ts, authoring-readiness.ts                                                                   | progressive/, retaining basenames          |
| candidates/trait-offer.ts                                                                                       | candidates/trait-offer/query.ts            |
| candidates/trait-offer-capability.ts                                                                            | candidates/trait-offer/capability.ts       |
| candidates/trait-offer-availability.ts                                                                          | candidates/trait-offer/availability.ts     |
| candidates/trait-offer-selected-effects.ts                                                                      | candidates/trait-offer/selected-effects.ts |
| rewards/trait-settlement.ts                                                                                     | rewards/trait-settlement/coordinator.ts    |

These are the existing B decisions, not a new pipeline.
Public exports remain unchanged; consumers import the final owners directly.

After these moves, the simulation root would be:

```text
simulation/
├── arcana-fear.ts
├── completeness.ts
├── finding-regions.ts
├── hex-progress.ts
├── index.ts
├── model.ts
├── occurrence-outgoing.ts
├── resources.ts
├── timeline-facts.ts
└── [existing domain directories plus evaluation/]
```

That is a sensible root. Completeness is consumed by materialization as well
as evaluation; finding regions and timeline facts cross several simulation
stages. They should not become children of composition just to empty the root.
Hex progress carries branch-level Hex state and transitions across acquisitions
and keepsakes; moving it into trait-offer authoring would be misleading.

## Placements that look odd but should remain

- Shared root `keepsake-equip-codec.ts` serves both loadout and occurrences.
  `fountain-rarity-codec.ts` is small and does not justify a fountain folder.
  Their existence does not require a generic root decoding catch-all.
- `commands/selection-state.ts`, `topology-reconciliation.ts`,
  `room-replacement.ts` and `route-detours.ts` span command families. Moving
  them beneath ordinary topology dispatch would imply narrower ownership.
- `simulation/candidates/` will still contain many files. Grouping every
  pair into Arcana/Fields/Keepsake folders would add navigation depth without
  consolidating competing policy owners.
- `run-state.ts` and `run-state-conformance.ts` already sit together.
  A two-file publication folder would not improve their ownership.
- Authored `history.ts`, simulation room history and simulation trait history
  are different products. Their repeated name is not duplication.
- Execution `graph-validation.ts` is correctly shared by assembly and codec;
  placing it under either consumer would weaken the ownership signal.

## Naming observations, not another rename campaign

The camelCase basenames `batchState.ts`, `biomeState.ts` and
`history/lifecycleInput.ts` are inconsistent with surrounding kebab-case.
`history/compose.ts` versus `composition.ts` is also less descriptive than
ideal: the former orchestrates biome traversal, the latter owns room/envelope
composition. Neither issue changes directory ownership. Leave these out of the
required move list; do not widen the pass to make every basename uniform.

Some retained files still combine policy and decoding. The important conclusion
is **not** that the tree should conceal this by choosing a convenient folder.
Keep the mixed owner visible; extraction requires an explicit responsibility
decision, tests and deletion of its prior path.

## Boundary before extraction work

Recommended remaining movement: the five authored follow-ups plus the twelve
already-planned simulation moves, with import consumers updated atomically.
No code has moved during this review. Amend the plan before implementing the
five additions; they should remain a mechanical review unit.

Then stop directory work. C and D address room materialization and generation
ownership only, preserving behavior. Do not reopen scheduler, history,
chronology, candidate policy, authored schemas or execution protocol semantics.
Delete this map with the temporary plan at closure; durable docs should retain
ownership rules, not a hand-maintained 321-file tree.
