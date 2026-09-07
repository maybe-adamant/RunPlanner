# Chronological authoring readiness

Status: locked execution contract; Gate A authorized  
Base: `be777898` (`fix(planner): align finding repair targets`)  
Working-tree inputs: chronological readiness audit and its audit-index entry

## Objective

Make required incomplete input block downstream authoring consistently, using
engine-owned semantic chronology. Completing the prefix unlocks the retained
suffix even when their combination is invalid. Existing progressive candidate
validation assesses each edit at its pre-decision point; downstream invalidity
must not veto a locally legal prefix edit.

The user can inspect the entire retained document, navigate findings, and use
undo/redo. They cannot create, replace, delete, or reorder suffix authoring
behind missing prefix input. There are no suffix-repair exceptions.

Authority: [chronological readiness audit](../audits/editor/CHRONOLOGICAL_AUTHORING_READINESS_AUDIT.md),
`SIMULATION_AND_VALIDATION.md`, `CONTEXTUAL_EDITOR_UX.md`, `EDITOR_MODEL.md`,
`STRUCTURED_EDITOR_WORKSPACE.md`, and the existing biome/room-lifecycle rules.
The audit's selected disposition supersedes the existing documents' permissive
unassessed-editing policy only within this delivery's scope.

## Locked distinctions

- **Incomplete** is missing required active input. It creates the authoring
  horizon. Invalidity and unavailable assessment alone do not create that lock.
- **Invalid** authored selections stay visible. Candidate legality retains its
  current independent authority; this change does not make impossible values
  selectable or fabricate context beyond an invalid prefix.
- **The blocker and earlier points** remain editable, including replacing its
  containing reward/room/decision or withdrawing optional participation.
- **Optional absent/untaken** is complete. Authored participation activates its
  required outcomes; declared active offers require identities independently
  of whether their pickups are taken.
- **Semantic chronology**, not Overview/Timeline/Doors order or rail position,
  defines prerequisites. Generated offer sets and acquired outcomes differ.
- **Existing suffix data** is retained exactly unless an authorized earlier
  semantic command normally reconciles it. No extra pruning is introduced.
- Loading, restoring, and undoing an incomplete document remain supported.

## Pinpointed code and change ownership

Paths below are repository-relative; they identify current owning seams, not
a requirement to edit every named file.

| Current seam                                                                                                                      | Relevant behavior                                                                        | Intended responsibility                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/planner-engine/src/simulation/completeness.ts`                                                                          | Structural frontier, incomplete topology findings                                        | Retain structural authority; combine with active leaf incompleteness rather than treating topology completion as sufficient.               |
| `simulation/model.ts`                                                                                                             | Narrow `isAcquisitionAuthorshipMissingFinding` classification                            | Do not stretch this into an app-owned string list; required missing outcomes must be explicitly distinguished at engine authority.         |
| `simulation/finding-regions.ts`, `progressive/finding-location.ts`                                                                | Addressed atomic regions, history and Hub chronology, containing repair owners           | Reuse the existing chronology and owner containment; extend only where a concrete readiness contact lacks a fact.                          |
| `simulation/progressive/biome.ts`, `progressive/products.ts`, `project.ts`, `evaluation-products.ts`                              | Progressive block, structural frontier, route start and blocked suffix                   | Publish missing-input readiness separately from validity/assessment; do not reuse `blockedAt` without classifying its cause.               |
| `simulation/project-evaluation-assembly.ts`                                                                                       | Explicit project/evaluation/artifact product and exact-source checks                     | Carry the complete readiness product with the current snapshot. No sole-carrier side map or new evaluation replay.                         |
| `simulation/candidates/availability.ts`, `candidates/session.ts`                                                                  | Missing prerequisite versus upstream invalid/incomplete and coverage-unavailable reasons | Preserve candidate meanings; expose/use the same readiness authority where authoring queries need it.                                      |
| `authored-project/commands/contract.ts`                                                                                           | Exhaustive command address mapping                                                       | Reuse addresses, but do not assume the error-reporting address always identifies an edit's pre-decision boundary.                          |
| `authored-project/commands/dispatch.ts` and history                                                                               | Structurally valid retained document mutations                                           | Keep low-level mutation independent of simulation; readiness is checked at the evaluated interactive boundary.                             |
| `apps/planner/src/state/projectWorkspaceSlice.ts`                                                                                 | All ordinary dispatched project commands, current assembly, atomic Shrine rescheduling   | Guard interactive commands with the engine answer before history changes. Internal reconciliation remains one atomic authorized operation. |
| `projections/structured-workspace/interactions/interaction-binding.ts` and its topology/batch/Hub/occurrence/reward-child binders | Bound owner intents and candidate loading                                                | Adapt engine readiness into controls and prerequisite navigation, without reconstructing chronology.                                       |
| `interactions/topology-interaction-binding.ts`, `room-feature-picker-model.ts`                                                    | Explicit enabled-unassessed paths                                                        | Remove permissive readiness bypasses, while retaining visible domains and existing candidate support.                                      |
| `assembly/decision-assembly.ts`, `ui/editor/biome/DecisionWorkbench.tsx`                                                          | Partial batch → target cascade and inline prerequisite text                              | Replace application-owned sequencing policy with engine answers, including reward completion between targets.                              |
| `ui/editor/biome/OccurrenceRoomActions.tsx`, ordering/inline editors, feature/Hub editors, loadout and reward dialogs             | Non-picker commands as well as selectors                                                 | Render readiness for checkboxes, text/numeric inputs, action buttons, deletes, reorders, and dialog saves—not just contextual pickers.     |

## Narrow engine product

Add a supported engine-owned authoring-readiness query near the simulation
authority. Inputs are the current exact evaluation assembly and the semantic
edit/command being assessed. Its result distinguishes ready from blocked by
required missing input and names the exact prerequisite semantic owner.
Naming and type details may follow nearby conventions; this is not a new
generic workflow framework.

The prepared product must contain the facts needed to answer without replaying
simulation per control. Address-only queries may serve controls where that
address unambiguously identifies the edit; mutation checks use the actual
command, particularly for containing replacements and reordering.

Inventory all `ProjectCommand` branches against existing command ownership.
Use exhaustive dispatch for this real closed boundary, not a second registry
of UI controls. Route/loadout edits are earlier points; automatic generated
commands are consequences of one authorized semantic operation. Import and
history restoration do not pretend to be new downstream authoring.

Do not classify all findings by severity or assume every missing field has a
`Missing` suffix. Reuse or add explicit missing-input facts at the owning
evaluation stage. If invalidity prevents reaching a future context, do not
invent missing runtime-dependent outcomes there. Known structural missing
input remains distinct from unassessed legality.

## Gate A — Engine horizon and ordinary-route vertical slice

Deliver the readiness authority with real application consumers, not an
interface-only gate:

1. Establish readiness facts from route start, structural generation and
   reached missing acquisition/effect outcomes, preserving semantic chronology.
2. Map interactive command boundaries, including blocker-containing repairs.
3. Guard `authoredProjectCommandDispatched` before mutation using the current
   assembly. A denied stale/direct dispatch leaves project and history intact;
   it must not throw a user-visible exception. Current controls show the reason.
4. Wire loadout/start, ordinary batches, rooms, rewards, and ordinary acquisition
   dialogs to the same readiness result. The opening reward can no longer be
   skipped to author later doors. Each door's required reward description is
   completed before the next target, using engine generation order.
5. Preserve automatic boss/postboss structural creation, existing command
   reconciliation, profile loading, and undo/redo.

Primary tests at the engine readiness owner:

- Missing opening reward blocks later batch/target edits; the opening reward
  and earlier loadout remain editable.
- Missing selected trait outcome blocks later authoring but allows replacing
  its reward family, changing selection, or completing that outcome.
- Completing a locally legal prefix can invalidate a retained suffix without
  being rejected; readiness is recomputed and the suffix is not erased.
- An invalid-only prefix is not classified as required missing input.
- Batch store → target → active reward description → next target, with
  declaration-owned zero-reward rooms completing without a fabricated choice.
- A later missing topology frontier does not block already-reached edits.

Application witnesses: one blocked direct dispatch with unchanged history;
one visible disabled ordinary control with exact prerequisite navigation;
one stale dialog save rechecked against current state; one undo/redo workflow.
Reuse existing progressive candidate witnesses for locally scoped validation.

Intended commit: `feat(engine): enforce chronological authoring readiness`

## Gate B — Complete semantic surfaces and remove bypasses

Finish consumer coverage and any concretely missing engine boundary facts.
Gate A's global command guard remains authoritative; this gate closes all
remaining presentation and special-chronology contacts before release.

| Contact                        | Required acceptance behavior                                                                                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H                              | Batch cage outcome and active cage identities precede progression. Three optional rewards require three identities; withdrawing pickup alone does not fill a missing identity. Layout uses engine-owned placement completeness, not tab ordering. |
| N                              | Board generation differs from visit acquisition. Generated side siblings settle as a batch; visited side-room timelines use actual local chronology. No rail-index ordering.                                                                      |
| O                              | Store/count/active offers/selection and selected acquisition follow each wheel's lifecycle. Dormant second wheel and unpicked trait screens do not block.                                                                                         |
| P                              | Active controlled encounter composition requires its applicable follow-up, without inventing arbitrary phases.                                                                                                                                    |
| Commerce                       | Dormant uninteracted Well/Pool inventory is not missing; authored Shop/Shrine inventory remains required under existing rules. Delayed mystery source/outcome belongs to delivery, not purchase.                                                  |
| Optional and automatic actions | Optional nonparticipation needs no result; selected and matured outcomes block at their own point. Removing participation or repairing the blocker is possible. Later deletion/reordering remains blocked.                                        |
| Route-wide controls            | NPC/resource/feature overview shortcuts use the underlying edit owner and chronology, never the location of the shortcut.                                                                                                                         |
| Detours and completion         | Chaos, Contract, Anomaly, boss/postboss and later biomes retain selected-path semantics and suffix visibility.                                                                                                                                    |

Owning engine tests carry the boundary matrix; application tests retain
representative contacts, not copies of every engine case. Extend existing
Hub/wheel/feature/room-action tests where possible. Test a non-picker input,
checkbox, delete, reorder and dialog save to cover the distinct binding paths.

Remove application-owned missing-target sequencing and enabled-unassessed
authoring exceptions displaced by the engine product. Keep candidate visuals,
selected-value retention and exact finding destinations. Do not remove an
unassessed state merely because it is no longer permission to mutate.

Intended commit: `feat(planner): apply readiness across authoring surfaces`

## Gate C — Combined closure

Perform final review across both implementation gates and the already-landed
finding navigation changes. Absorb the readiness/validity distinction and
repair/navigation invariants into the smallest owning design documents.

- Revise permissive unassessed-editing statements in contextual UX, editor,
  simulation and structured-workspace authorities where applicable; clarify
  README's retained-document wording without adding status or plan links.
- Complete the pending durable absorption from
  `FINDING_NAVIGATION_CONSISTENCY_PLAN.md`; its implementation is already on
  the base commit and must not be repeated.
- Update the audit disposition and `IMPLEMENTATION_PROGRESS.md` with truthful
  verification. Delete both temporary plans in this closure commit.
- Run one complete `npm run check` after narrow tests and review remediation.
  Run performance comparison against the pre-implementation base if new
  readiness preparation/query work affects rebuild or interaction cost; reuse
  existing instrumentation rather than introduce an extra benchmark system.

Intended commit: `docs(planner): close authoring readiness and navigation work`

## Delivery and adversarial review

Commit the audit and agreed plan before implementation. Each implementation
gate uses a fresh executor and independent read-only reviewer, followed by
main-session holistic review. Record exact base and validation at handoff.
Only one test lane runs at a time. Use focused owning tests while implementing;
do not rerun the full repository gate after every fix.

Review must challenge:

- conflating invalid/unavailable with incomplete;
- parent repair blocked by its own missing child;
- downstream findings vetoing a locally legal prefix completion;
- suffix delete/reorder exceptions or stale dialog bypasses;
- chronology inferred from projection order or persisted UI state;
- optional, dormant, unpicked and not-yet-delivered outcomes treated as missing;
- history/import paths forced through interactive readiness;
- per-control replay or copied candidate/chronology policy;
- new policy growth without a concrete contact in the acceptance rows.

Stop and report if the existing chronology cannot identify a required
boundary: add only the owning engine fact needed for that concrete case after
review. Do not compensate with a UI ordering table or broaden the game model.

## Exclusions

No schema change, migration, catalog game-rule change, executor/protocol work,
persisted authoring cursor, alternate simulation DAG, speculative downstream
state, automatic suffix pruning, or general UI redesign. Low-level authored
commands remain usable for structurally representable document construction;
all application interactive mutations receive the engine readiness guard.
