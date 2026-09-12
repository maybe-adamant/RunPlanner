# Engine structure and sensitive boundaries

## Question, scope and confidence

At `85c7a875`, which remaining engine files should be grouped mechanically,
which boundaries justify decomposition, and which large coordinators should
remain intact?

This is a whole-source directory inventory plus bounded static inspection of
the sensitive producer/consumer seams. It is not an exhaustive game-rule audit
or a fresh correctness certification. No production code or tests changed,
and no tests were rerun. The base has a clean worktree and a recorded passing
full gate (2,999 correctness tests and performance comparisons).

The intended result is one cohesive cleanup plan, not another open-ended queue
of large-file refactors. Final destinations should be decided together, while
mechanical moves and product extractions remain separate review units.

Authorities: `docs/design/ARCHITECTURE.md` (ownership, construction and
reorganization), `AUTHORED_PROJECT_MODEL.md` (commands and topology),
`SIMULATION_AND_VALIDATION.md` (ordered state flow and lifecycle), and
`CANDIDATE_EVALUATION_MODEL.md` (exact candidate contexts).

## Overall shape

```text
catalog contracts / normalized collections / requirements / reward kernel
  -> authored document, codecs and atomic commands
  -> materialized rooms/decisions and action domains
  -> lifecycle events and chronological history
  -> generation and reward evaluation, captured candidate artifacts
  -> progressive coverage and project evaluation assembly
  -> application-facing queries / execution semantic product
  -> data-only execution compiler and protocol codec
```

This describes responsibility flow, not a demand to make all stages independent
passes. Generation and reward evaluation exchange exact checkpoints; candidates
use the matching evaluation's captured contexts. Splitting or reordering those
contacts merely to simplify this diagram would be wrong.

## Directory inventory and grouping disposition

Counts are direct source files, not recursive counts. Directory size alone is
not an acceptance criterion.

| Neighborhood                                                         | Current shape                                                                                            | Disposition                                                                                                                                                                                              |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `normalized`, `requirements`, `reward-kernel`                        | 1, 3, and 8 files; coherent small foundations                                                            | Keep. Do not add folders for each kernel operation.                                                                                                                                                      |
| `catalog-schema`                                                     | 2 files; large root contract plus traits                                                                 | Keep supported contract surface. Size alone does not justify a schema reorganization.                                                                                                                    |
| `authored-project`                                                   | 27 root files; project contracts mixed with acquisitions, trait payloads, feature codecs and route facts | Group selected domains, retain genuine project-wide entry/contracts.                                                                                                                                     |
| `authored-project/commands`                                          | 30 direct files plus 6 topology files                                                                    | Group occurrence commands and acquisition/reward commands; preserve one atomic dispatcher.                                                                                                               |
| `authored-project/room-state`                                        | 17 files covering state, reconciliation, specialized codecs and trait outcome decoding                   | A decoding subgroup is reasonable; do not mix runtime reconciliation into it.                                                                                                                            |
| `authored-project/topology`                                          | 9 files plus 3 structural decoding files                                                                 | Structural query/impact/identity are coherent. Several occurrence-local codecs are misplaced here.                                                                                                       |
| `simulation`                                                         | 16 root files; evaluation composition, readiness, finding ownership and domain modules                   | Group evaluation composition; place authoring-boundary/readiness with progressive policy if consumer inspection confirms one neighborhood. Keep unrelated domain files out of a generic services folder. |
| `simulation/candidates`                                              | 28 direct files, with only BBB drafts in `trait-offer/`                                                  | Consolidate existing trait-offer siblings into that neighborhood. Other family files already have explicit ownership; do not split merely to reduce count.                                               |
| `simulation/generation`                                              | 8 files; shared policy largely resides in `normal-targets.ts`                                            | Assess shared generation policy as a product boundary, not just a move.                                                                                                                                  |
| `simulation/materialization`                                         | 7 files; most room-template logic and common assembly in `rooms.ts`                                      | Best bounded extraction candidate; decide final room neighborhood during plan.                                                                                                                           |
| `simulation/history`, `lifecycle`, `room-actions`, `progressive`     | 7, 3, 4 and 6 files                                                                                      | Existing domains are coherent. Preserve chronological coordinators; inspect progressive ownership mapping separately from execution.                                                                     |
| `simulation/encounters`, `commerce`, `keepsakes`, `fields`, `traits` | Already grouped by domain                                                                                | Keep. The recent trait history/authoring structure should not move again.                                                                                                                                |
| `simulation/rewards`                                                 | 15 direct files plus acquisition, shop, biome and trait-settlement neighborhoods                         | Move trait settlement coordinator into its existing family; consider grouping run-state derivation/conformance together. Leave branch primitives and product contracts recognizable.                     |
| `simulation/rewards/biome`                                           | 11 direct files with generation, lifecycle transitions, offer lifecycle and encounter acquisition below  | Already substantially decomposed. Avoid a second hierarchy based only on event names.                                                                                                                    |
| `execution-plan`                                                     | 7 roots, 13 assembly and 11 codec files                                                                  | Mostly coherent. Keep compiler/assembler/codec distinctions; any timeline-family extraction must own a complete mapping.                                                                                 |

### Concrete move-only candidates

These are candidate destinations to lock together, not authorization for moves.

1. `authored-project/commands/occurrence/`: the existing `occurrence.ts`
   dispatcher and `occurrence-*` handlers/mutation helpers. Keep room replacement
   and route detours visibly separate: they alter topology or reconcile domains,
   not just one leaf value.
2. `authored-project/acquisition/`: `acquisition-entry`, `acquisition-sources`,
   `reward-state`, `artificer`, `pickup-producers`, and `sea-star`. They represent
   authored reward-source/entry identity and generated acquisition structure.
   Do not pull reward simulation or commerce timing into this folder.
3. A matching command acquisition neighborhood for `acquisition-site`,
   `acquisition-conversion`, `reward-source`, and `sea-star`. Trait and level
   commands may join a separate outcome neighborhood only if this helps actual
   navigation; no mandatory one-file domain directories.
4. `authored-project/room-state/decoding/`: specialized state codecs plus
   occurrence-local `well-codec`, `acquisition-site-codec`, and room-action
   decoding currently under topology. Keep the topology attachment coordinator
   at the boundary until its whole-occurrence closure responsibility is resolved.
   Shared root keepsake/fountain codecs need explicit consumer mapping before
   relocation: loadout also consumes equip decoding.
5. `authored-project/traits/`: traits, carrier-child discovery and Hex authored
   structure are a possible coherent neighborhood. Preserve supported exports;
   do not combine their distinct persisted contracts.
6. `simulation/evaluation/`: project orchestration, biome evaluation,
   project-evaluation assembly and evaluation products. Candidate-artifact
   aggregation is a concrete collaborator, not a DI container. Keep the public
   simulation entry stable. Check `completeness` placement by its consumers,
   rather than automatically moving every root file.
7. `simulation/candidates/trait-offer/`: current query, capability, availability,
   selected-effects and BBB draft files. This consolidates an existing family
   without creating another candidate API.
8. `simulation/rewards/trait-settlement/coordinator.ts`: move the root
   coordinator beside its four existing owned products. `run-state.ts` and
   `run-state-conformance.ts` could form a two-file state-publication neighborhood;
   do not mix that with execution's wire-delta codec.

The root `addresses.ts`, `model.ts`, `index.ts`, project codec/defaults/history
and validation utilities can remain visible. A clean root need not be empty.
Likewise `arcana-fear`, `hex-progress`, and resources are not a reason to invent
a miscellaneous effects directory. The authored delivery and route-link files
need not be moved unless a concrete multi-file owner emerges.

## Sensitive boundary matrix

| Boundary                                                   | Evidence and product                                                                                                                                                                               | Risk to protect                                                                                                    | Disposition                                                                                                                                                              |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Command proposal → closed authored document                | `commands/dispatch.ts:applyProjectCommand` orders resource reconciliation, Shrine retraction, source actions, clocked pickup retraction, generated state, required actions, Chaos and final decode | Reordering changes generated action identity/placement; two required-action passes serve different inputs          | Keep atomic orchestration. Group handlers only. No generic reconciliation fixed point.                                                                                   |
| Structural topology decode → occurrence attachment         | `topology/decoding/coordinator.ts`, `decisions.ts`, `occurrence-codec.ts:decodeRoomOccurrence`                                                                                                     | Structural ownership, strict closure and room-local acquisition/action matching must remain distinct               | Keep recent structural decoder. Move local codec helpers; assess attachment extraction only with explicit inputs/result.                                                 |
| Replacement → topology/local state reconciliation          | `commands/room-replacement.ts`, `route-detours.ts`, `room-state/replacement.ts`                                                                                                                    | Retain valid conversions and descendants while removing stale room-local actions atomically                        | Keep existing policy owners. Do not unify detours and ordinary leaf edits into a generic mutation framework.                                                             |
| Room declaration/authored state → canonical occurrence     | `materialization/rooms.ts` template functions return `MaterializedRoomLeaf`; `materializeAuthoredRoom` adds common features/acquisitions, roster and timeline                                      | Active reward/encounter selection and required action scheduling must use the same resolved room                   | Extract template construction from common occurrence assembly using the existing leaf product. No one-file-per-simple-template mandate.                                  |
| Room roster → lifecycle events                             | `lifecycle/execute.ts` owns ranked action cursor, phase drains, required-action blocking and Shrine scheduling                                                                                     | Phase-local insertion order, automatic effects, required reward and delivery interleaving                          | Keep coordinator. Its cursor is simulation semantics, not the game executor's architecture. No callback registry.                                                        |
| Lifecycle events → route/room history                      | `history/compose.ts`, `fold.ts`, `facts.ts`                                                                                                                                                        | Paired events, occurrence identity, Hub restored visits and counters                                               | Keep recent complete-product decomposition; no common fold shared with trait history.                                                                                    |
| History/reward checkpoints → target generation             | `generation/normal-targets.ts` exports shared context/candidate helpers to `first-target-takeover.ts` and `biome.ts`; also owns Chaos/Contract placement                                           | First-target pressure, prior-peer exclusion, staged pools and precise reward history                               | Investigate one shared generation-policy owner and separate additional-exit assessment. Preserve batch/takeover coordinators and support evidence.                       |
| Chronological reward walk → branches/findings/artifacts    | `rewards/biome/chronology.ts:evaluateBiomeRewardChronology` owns local maps, event dispatch and final publication                                                                                  | Pending Hub generation, branch progression, candidate capture and first-blocking publication are ordered           | Keep core walk. No extraction that passes all mutable maps through a context object. Existing owned transitions remain the model.                                        |
| Acquisition/Shop/trait settlement → complete outcomes      | Existing acquisition, shop and trait-settlement families return branches/findings/frontiers/checkpoints                                                                                            | Conversion recursion, frozen Stone, Circe partial outcomes, source-time levels, pending refill state               | Keep recently reviewed products; move coordinator files only. Do not repeat the prior cleanup.                                                                           |
| Captured contexts → candidate queries                      | `trait-offer-capability.ts`, family artifacts and `candidates/session.ts`                                                                                                                          | Exact pre-offer branch, complete vs focused repair, no unioned cross-branch legality                               | Group files. Defer further capability extraction unless a complete context product is established. Size is insufficient.                                                 |
| Findings/coverage → editable boundary and published prefix | `progressive/finding-location.ts`, `authoring-boundary.ts`, readiness and clamp                                                                                                                    | Incomplete differs from invalid; owner identity differs from rendered target index; Hub spans multiple occurrences | Group authoring-frontier policy where appropriate. Keep owner-location comparison consistent; no generic address traversal replacement without a separate semantic case. |
| Exact project assembly → execution semantic product/wire   | `project-evaluation-assembly.ts`, execution assembler, timeline transaction mapping, compiler and codec                                                                                            | Matching project/artifacts, DAG obligations and source mapping; compiler must not re-simulate                      | Keep current layers. Large closed payload dispatch is not itself a defect. Only local family extraction with explicit complete return products.                          |

## Hidden-state assessment

The inspected chronological maps are local builders; publication returns frozen
data and separately explicit candidate artifacts. They should not become shared
mutable services merely to permit extraction.

`ExactProjectEvaluationAssembly` owns its candidate artifacts in a private field;
its construction token/identity attestation and accessor do not replace the
explicit product. Removing this because it resembles a registry would discard
the exact project/evaluation pairing. Candidate factories similarly retain
copied maps in returned closures. No new hidden semantic sidecar was established
by this inspection; this is not proof that every engine module is free of one.

## Cohesive scope recommendation

The highest-value pass is:

- settle the final directory map for the mechanical candidates above;
- extract room templates/common assembly around `MaterializedRoomLeaf`;
- clarify shared room-generation policy versus ordinary/takeover/additional-exit
  orchestration;
- leave chronological coordinators, recently cleaned settlement/history,
  public addresses and closed contracts intact.

Progressive finding location and execution timeline mapping are review-against
boundaries, not automatic extraction deliverables. Occurrence decoder helper
movement should not expand into rewriting structural topology closure.

Do not make this one giant commit. A subsequent plan can have a small number of
complete reviewable slices while locking all destinations upfront. Never move a
file mechanically to an intermediate folder only to move it again during its
extraction. Do not add barrels, aliases, parameter bags or compatibility wrappers
to make the directory tree look uniform.

## Verification ownership and work baseline

Use existing authority tests: authored codec/command and replacement suites;
materialization/history/lifecycle suites; normal-target/takeover/Hub/Fields
generation suites; progressive repair and finding-owner suites; candidate
complete/focused tests; acquisition/Shop/trait settlement tests; execution
assembler/codec fixtures. Application product loops retain representative
cross-boundary repair and publish contacts, not another complete policy matrix.

Before locking each extraction, pin exact suite paths and exported consumers.
Move-only slices should preserve function bodies and test bodies; test-directory
grouping is optional and should follow genuine authority, not cause another
full relocation. Existing engine runtime-import and package-boundary tests,
explicit TypeScript, one-off body comparisons and public export checks protect
mechanical changes. No durable tests for historical filenames.

Use `85c7a875` as the whole-pass baseline unless intervening production work
requires an explicit reset. Capture each coordinator's current call/refold/query
shape before decomposition. Keep the established eight-operation performance
comparison and one complete final repository gate; do not invent new timing
budgets or regenerate unchanged execution fixtures.

## Remaining decisions before a plan

1. Confirm the proposed mechanical groups against complete import lists and
   shared loadout/occurrence codec consumers; the table is a recommended map,
   not a claim that all listed files can be moved blindly.
2. Pin the room leaf contract and complete generation-policy result consumed
   across normal, takeover and additional-exit assessment. No generic room
   service should be introduced to hide existing helper coupling.
3. Decide whether occurrence codec helper grouping is move-only or includes one
   complete local-feature decode product. Keep it out if it requires a broader
   semantic rewrite.

No runtime defect, new domain rule, protocol change, or required UI change was
established. This analysis intentionally limits further decomposition rather
than turning every large engine file into a backlog item.
