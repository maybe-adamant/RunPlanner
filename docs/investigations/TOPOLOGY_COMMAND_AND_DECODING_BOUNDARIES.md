# Topology commands and decoding boundaries

## Question and disposition

At base `f50d0cf3`, can authored topology commands and decoding become easier to
maintain without changing representability, repair, or traversal semantics?

Yes: there are useful command-family and decoding-stage boundaries. This is a
behavior-preserving ownership cleanup, not a new graph model or a unified
command/validation service. Commands construct and repair proposals; decoding
validates complete persisted structure and derives occurrence ownership. They
must continue to have different responsibilities.

This is a static code investigation, not an implementation plan or a defect
report. No new correctness failure was reproduced. The base passed the full
repository gate during Shop closure; no tests were rerun for this document.

## Governing contracts

- `docs/design/AUTHORED_PROJECT_MODEL.md`: Common Decision Model; Starts,
  Batches, Preboss, and Completion; N Hub Progression; Occurrence State and
  Replacement; Commands; Persistence and Validation.
- `docs/design/GAME_GENERATION_RULES.md`: Ordinary batches; Preboss batches;
  Shared source support.
- `docs/design/ARCHITECTURE.md`: refactoring discipline and dependency rules.

The critical distinctions are structural versus contextual invalidity,
offered versus entered occurrence state, physical exit identity versus array
position, and explicit repair versus decoding. A generic graph cleanup must
not erase those distinctions.

## Current producer/consumer path

```text
applyProjectCommand
  -> semantic command handler constructs immutable proposal
  -> command-wide resource, delivery, action, generated-pickup and Chaos closure
  -> decodeProjectDocument
     -> decodeBiomeTopology
        -> decodeTopologyStructure
           -> raw records and decision forms
           -> relational checks and selected-spine validation
           -> occurrence ownership and entry-active facts
        -> decodeRoomOccurrence for each returned owned occurrence
```

`commands/dispatch.ts:applyProjectCommand` owns the ordered command-wide closure
and translates decoder failures into command errors. An unchanged proposal
returns immediately. Do not add a second decoder invocation inside extracted
handlers or move that closure into topology-specific modules.

`topology/codec.ts` is already a small, appropriate composition boundary.
`DecodedTopologyStructure` carries raw occurrence data, resolved owners,
decoded additional exits, decisions, and fixed links into leaf decoding.
`occurrence-codec.ts` consumes this product rather than recomputing topology.

## Responsibility inventory

All source paths below are relative to
`packages/planner-engine/src/authored-project/`.

| Current owner                         | Responsibilities                                                                                                        | Assessment                                                                               |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `commands/topology.ts`                | Starts, ordinary envelopes/targets, takeover batches, selection/rebase, fixed completion, Hub and local visits, removal | Several independently changing command families share one file                           |
| `commands/topology-reconciliation.ts` | Declared capacity, pruning, selection retention, entry-state reconciliation                                             | Existing shared atomic repair owner; retain                                              |
| `commands/selection-state.ts`         | Activating/deactivating normal Shop entry state                                                                         | Necessary command behavior, not codec repair                                             |
| `commands/route-detours.ts`           | Anomaly/Chaos/Contract operations using shared capacity and removal owners                                              | Neighboring consumer, not a second generic topology implementation                       |
| `topology/structure-codec.ts`         | Raw records, decision decoding, fixed-link validation, selected reachability, ownership, orphan/cycle checks            | Stage boundaries are obscured inside a large file                                        |
| `topology/occurrence-codec.ts`        | Owner-sensitive leaf decoding and action/source closure                                                                 | Preserve the structural-to-leaf handoff; not the first extraction target                 |
| `topology/query.ts`                   | Physical exits, ordinary authoring bounds, selected continuation, Hub handoff                                           | Already shared by commands, codec, candidates and materialization                        |
| `topology/impact.ts`                  | Removal closure and its immutable application                                                                           | Existing shared authority; do not reproduce walks in extracted handlers                  |
| `topology/room-ownership.ts`          | Legal declaration lookup for already-decoded occurrences, including closed detours                                      | Different input contract from untrusted decoding; not automatically duplicate validation |

## Invariants viewed from both boundaries

| Invariant                          | Command responsibility                                                                                             | Decoder responsibility                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Selection and downstream ownership | Rebase the old selected continuation, retain matching targets, reconcile capacity and entry state                  | Reject detached decisions, cycles, duplicate sources and multiply-owned/orphan occurrences |
| Narrower room replacement          | Preserve representable overflow until explicit repair; Anomaly has its declared atomic repair                      | Accept recognized retained keys, reject arbitrary keys; do not prune                       |
| Takeover Preboss                   | Create/reconcile the complete physical-key batch, preserve retained identities, create selected completion         | Validate whole-batch role/shape and exact selected fixed-link chain                        |
| Hub handoff                        | Replace/restore terminal envelope, manage open set and visits, retract descendants when handoff becomes incomplete | Validate declared Hub source, slot ownership, visits and completed-handoff predicate       |
| Local visits                       | Create declared side occurrences and edit generation/visit order                                                   | Validate declared group/slots and derive side entry-active ownership                       |
| Entry-owned Shop state             | Materialize or remove entry state when selection changes                                                           | Decode the correct leaf shape using derived role and entry-active facts                    |
| Cross-room-set detours             | Perform only the closed supported operations                                                                       | Validate provenance and attachment; no generic cross-biome escape                          |

Checking an invariant while constructing a command and checking it on external
input is not itself wasteful duplication. Share a pure fact when both need the
same fact; retain boundary-specific errors and repair policy.

## Concrete seams worth investigating in a plan

### 1. Command families

`commands/topology.ts:applyTopologyCommand` already has an exhaustive dispatcher.
Hub/local-visit operations are the clearest separable family. Ordinary
start/batch/target work and takeover/completion form the other larger clusters.
Keep selection rebase, capacity repair and leaf activation atomic: splitting
each step into a separately published edit would be a regression.

`defaultOccurrence` composes declaration-owned state, encounter defaults, room
actions and forced features. It is shared construction, not permission to move
those policies out of their existing owners. If moving it becomes necessary,
give it one concrete command-construction home, not a catch-all context object.

Fixed completion creation/removal is a candidate cohesive transition returning
the entire updated topology. Do not build a second completion model for the
decoder: both already use declaration data and fixed occurrence identities.

### 2. Structural decoding stages

The natural first seam is decision-form decoding (`decodeExitDecision`,
`decodeHubDecision`, `decodeLocalVisitDecision`) separated from whole-topology
relational validation and ownership assembly. Keep a deliberate decoding
coordinator. Source reachability, expected fixed completion, owner assignment
and orphan rejection are interdependent; they do not need one file per check.

Retain a complete returned product for the next stage. A delegate must not
receive the coordinator's mutable owners, selected-source set and decision
array merely to shorten the coordinator.

### 3. Small repeated facts, not a policy merger

Preboss role classification appears in `commands/topology.ts:expectedPrebossRole`,
`commands/selection-state.ts:entryRole`, and
`topology/structure-codec.ts:prebossRole`. Compare their exact admission and
error contracts before extracting a shared declaration-to-role fact. Their
boundary-specific failure reporting must remain intact.

The command's selected continuation and codec's selected-spine work already
use shared query primitives. Do not replace those with a second traversal
service just because the codec also has validation-specific walks.

## Hidden state and work preservation

There is no newly identified ambient semantic registry in this inspected path.
Structural decoding uses invocation-local maps/sets. Its lazy additional-exit
decoder memo is intentional: it decodes each requested occurrence attachment
once and preserves first-demand diagnostic paths/order. The result carries the
decoded arrays onward. Do not make this eager without checking diagnostic
behavior, or replace it with repeated decoding in each extracted validator.

Current selected reachability uses repeated scans until stable, alongside
dedicated cycle/stage checks and owner assignment. This investigation does not
establish a performance defect. Preserve the traversal/work shape initially;
indexing or algorithm replacement is separate work requiring evidence.

Size baseline (diagnostic only): topology commands 1,773 lines; structural
codec 1,788; occurrence codec 817; query 706; impact 390; capacity reconciliation
110; selection-state 85. There is no target file size or count.

## Tests and acceptance focus

Existing primary owners under `packages/planner-engine/test/authored-project/`:

- `commands/topology.test.ts`: empty/atomic envelopes, physical order, takeover,
  selected continuation preservation, capacity repair, fixed completion and N.
- `commands/route-detours.test.ts` and `commands/room-replacement.test.ts`:
  cross-command rebase/replacement contacts and preservation/pruning distinctions.
- `topology/structure-codec.test.ts`, `topology/relational-codec.test.ts`, and
  `topology/leaf-codec.test.ts`: malformed structure, semantic ownership,
  selected-spine rather than storage-order interpretation, exact error paths,
  and leaf contracts.
- `topology/query.test.ts`, `topology-impact.test.ts`, and
  `completion-boss.test.ts`: shared facts, removal closure and boss resolution.

Commands already pass through decoding, so their existing positive workflows
exercise that contact. Do not duplicate the complete command matrix as decoder
tests. Decoder negatives still matter because external files bypass handlers.
Move primary tests with responsibility only when it improves ownership; retain
representative cross-family witnesses. Add tests only for an identified gap.

Before locking implementation, inspect the exact attachment decode-count and
first-error coverage, and choose representative Hub/detour/completion workflows
for moved boundaries. Preserve encoded shape and no-op identity. No fixture or
schema changes should be necessary. Capture comparable work/performance evidence
against this base if the refactor touches decoding traversal.

## Recommended bounded follow-up

Plan a command-family cleanup followed by structural decoding decomposition,
reviewing their shared contracts as one unit. Place each extracted owner in its
final neighborhood immediately. Remove displaced local implementations in the
same slice; no forwarding scaffolding or compatibility exports.

Exclude simulation chronology, candidate algorithms, room replacement semantics,
leaf payload redesign, generic graph frameworks, broad query reorganization and
new validation policy. If a real behavior defect emerges, characterize it and
separate its correction from movement.

At closure, promote only lasting ownership guidance into the existing authored
model/architecture documents and delete this investigation and its future plan.
