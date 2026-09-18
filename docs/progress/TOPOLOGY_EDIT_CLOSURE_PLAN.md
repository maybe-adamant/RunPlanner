# Topology Edit Closure

Status: Locked for implementation. Gates A/B accepted; Gate C is pending.
Source assessment base: planner `b3e81978`; locked-plan commit: `003d6b1b`.

Gate A verification: 48 focused topology/removal command tests, engine
typecheck, changed-file lint/format checks, and independent review passed.
The supplied real plan also passed all 25 outgoing-decision removals through
strict encode/decode and exact Undo/Redo. Full repository checks remain at
Gate C closure.

Gate B verification: 45 focused selection/detour command tests, engine
typecheck, changed-file lint/format checks, and independent review passed.
The checked-in full Underworld and Surface fixtures now exhaust every authored
exit choice and distinct pairwise choice transition through strict encode/decode,
exact Undo/Redo, requested selection, and retained parent offerings. These cover
326 command steps; the same probe on the supplied plan brings the total to 445,
all passing. Focused witnesses additionally check N Hub reanchoring and exact
Preboss/completion-state retention across physical exit-width changes. The
review's narrowing over-deletion finding and its regression-coverage follow-up
are resolved. Gate C owns application witnesses and the full repository check.

## Outcome and bounds

Selecting another door or removing outgoing topology produces one structurally
closed, undoable edit. Preserve compatible downstream authoring; remove only
the branch that the edit makes structurally incompatible. Ordinary exits,
Chaos, Zagreus, Hub takeover, and Preboss completion obey the same ownership
contract without pretending that their continuations have the same shape.

This is a correction to authored topology commands, not game eligibility,
simulation, editor readiness, or runtime navigation. No schema/protocol bump,
migration, catalog change, game-module work, new graph framework, general
repair sweep, or React workaround is expected. Do not relax strict decoding
or catch contract errors and publish partial state.

## Authorities and starting points

Read `docs/design/SIMULATION_AND_VALIDATION.md` in full before engine work.
The exact specialists are:

- `AUTHORED_PROJECT_MODEL.md`: Common Decision Model; Starts, Batches, Preboss,
  and Completion; N Hub Progression; Commands and Ordered reconciliation;
  Persistence and Validation; Undo and Redo.
- `GAME_GENERATION_RULES.md`: Preboss batches; Hub handoff and fixed completion
  links. Takeover replaces normal exits, not source-owned extra doors.
- `EDITOR_MODEL.md`: Bound Interactions; Findings and Navigation. Application
  publication and stale-focus reconciliation consume the engine result.

The evidence below is from the current planner, not a newly discovered native
game rule. Existing declaration-owned generation and eligibility stay unchanged.

| Starting code                         | Current responsibility / gap                                                                                                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `topology/impact.ts`                  | Collects descendant removal across ordinary, additional, Hub, local-visit and fixed-link ownership; application of the impact does not update additional references on surviving occurrences. |
| `commands/topology/ordinary.ts`       | `SetExitSelection` reanchors only an ordinary exit decision; skips Hub continuation, and rejects moving an ordinary continuation onto Preboss instead of handling the terminal switch.        |
| `commands/topology-reconciliation.ts` | Physical-exit capacity, selection and entry-state reconciliation; must remain consistent with branch removal.                                                                                 |
| `commands/topology/{hub,takeover}.ts` | Hub takeover/handoff and selected Preboss completion chains; reuse their declaration-owned semantics.                                                                                         |
| `commands/route-detours.ts`           | Dedicated Chaos/Zagreus removals currently clean both target and reference; generic and dedicated paths must agree without duplicate cleanup policy.                                          |
| `commands/dispatch.ts`                | Ordered command-local reconciliation followed by strict decode; retain this publication boundary.                                                                                             |

Paths above are relative to `packages/planner-engine/src/authored-project/`.

## Reproduced evidence

User witness: `run-plan.runplanner(50).json`, read from
`C:/Users/Mohammed Ayyat/Downloads/`. It passes initial strict decoding.
Diagnostic probes used in-memory copies; the original file was not changed.

| Case                                                                                                               | Current result                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| N Opening `256b5530-90c0-4d46-8591-e1a3ba51a32c`: change PreHub selection to Chaos                                 | Throws about fixed links without a selected Preboss. Hub remains attached to the now-unselected PreHub.         |
| Same change, with Hub source reanchored to Chaos in an in-memory witness                                           | Strict decode passes with board, visits and completion chain retained.                                          |
| P Midshop `5d6f54a3-7fda-4ae9-b2ee-461c49745fea`: remove outgoing decision                                         | Deletes contract room `663ce8f8-c01a-49e3-880e-adec47a96e58` but leaves the shop's additional reference.        |
| Remove one decision before that shop, or remove from `C_Boss01`                                                    | Passes: respectively the reference owner disappears, or its referenced room survives.                           |
| P Combat08 `8bca0b48-b36b-4978-8154-d14710169c34`: select Chaos / remove outgoing decision                         | Selection passes; removal fails with the same dangling-reference defect.                                        |
| Dedicated RemoveChaos / RemoveZagreusContract                                                                      | Passes for the corresponding hosts in this file.                                                                |
| P Combat11: switch away from the selected Zagreus shop to the ordinary peer                                        | Reanchors the normal batch, but strands the old shop's contract continuation and completion chain.              |
| Clear an earlier multi-door selection while a completed suffix exists                                              | Leaves unreachable fixed completion links; clearing the direct Preboss selection already handles its own chain. |
| P Preboss Shop → free reward, or Preboss → Chaos → Preboss before authoring Chaos's continuation                   | Passes. Preserve these working paths.                                                                           |
| Add Chaos beside P's Preboss batch, select it, author an onward Preboss takeover, then select the original Preboss | Throws `cannot rebase the prior selected continuation onto this target`.                                        |

The extra-door removal test in `test/authored-project/topology-impact.test.ts`
currently asserts remaining occurrence IDs without checking the surviving
additional reference or strict decoding. Ordinary/Chaos reanchoring tests do
not exercise a Hub continuation. Correct these coverage boundaries rather
than adding another test of the same partial products.

## Edit contract

### Ownership and atomic closure

- Normal targets belong to their outgoing decision; additional references
  belong to their source occurrence. The additional room and its descendants
  cannot outlive removal of their owning reference, and a retained reference
  cannot point at a removed room.
- Hub owns its open main rooms, visit order, local side-room ownership through
  those mains, and completed-Hub handoff. Preboss selection owns its fixed Boss
  and optional Postboss chain. Neither is an ordinary outgoing decision.
- Removing an outgoing decision keeps its source occurrence, but removes the
  outgoing normal and additional branches and clears the source's corresponding
  additional references. Removing only one extra door retains normal siblings
  and other extra doors, with declaration-correct selection afterward.
- Ownership is followed by semantic identity, never decision-array order.
  Strict decoding remains the final invariant check, not the repair algorithm.
- One command publishes one immutable result and history step. Undo restores
  the exact previous authored state; Redo restores the same closed result.
  Unchanged siblings and other biome plans retain their authorship, apart from
  existing source-dependent cleanup such as missing delivery placements.

### Selection-change disposition

Apply the selection to a working topology before evaluating structural
continuation compatibility. Do not test the new source against the old selected
spine. Compatibility is declaration/ownership policy, not simulated eligibility:
a context-invalid reward or encounter stays authored and repairable.

| Existing continuation / destination                                                              | Required disposition                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ordinary outgoing decision → compatible ordinary or detour room                                  | Reanchor that decision; retain matching physical target identities and compatible descendants. Reuse capacity, selection and entry-state reconciliation.                                                           |
| Hub continuation → another declaration-supported terminal Hub source, including N PreHub ↔ Chaos | Reanchor the same Hub decision. Preserve board, visits, main/side room identities, handoff and completion state.                                                                                                   |
| Selected host has source-owned extra doors and becomes an unselected leaf                        | Do not transplant those doors to the new host. Remove the old host's extra references and branches; preserve only the compatible ordinary continuation.                                                            |
| Ordinary/Hub continuation → structurally incompatible destination                                | Remove that continuation and its owned descendants. Leave the selected destination editable at its own frontier; do not invent replacement topology.                                                               |
| Any selected destination is Preboss                                                              | Never attach an ordinary or Hub continuation to it. Remove the incompatible old continuation and establish only that Preboss's fixed completion chain.                                                             |
| Previously selected destination is Preboss, new destination is not                               | Remove the old fixed completion chain. Continue through the new destination's supported topology, without moving Boss/Postboss state onto it.                                                                      |
| Selection becomes unresolved                                                                     | Keep the current decision's offered targets and extra siblings, but remove the prior selected target's downstream continuation and completion chain. No disconnected suffix or automatically selected replacement. |

The parent decision's own Chaos/Zagreus sibling remains offered when selection
switches between its normal and additional targets. This differs from extra
doors owned by a previously selected target that is now a dead leaf.

Preserving an ordinary continuation must also leave its selected descendant
reachable. If capacity or extra-door removal clears that descendant selection,
close the detached suffix in the same edit. A matching key alone is not proof
that the whole retained branch still has an owner.

Retain existing atomic takeover and physical-key rules. Apart from the existing
declaration-owned completion-chain creation, SetExitSelection must not invent
occurrences or construct a partial takeover to make an incompatible move succeed.
Where existing authored identities cannot form a
structurally supported continuation, remove that continuation rather than
inventing missing choices. Do not prune merely context-invalid authoring.

Preboss completion is derived from the resulting selected spine. If the same
Preboss occurrence remains selected after an upstream move, preserve its chain
and authored Boss/Postboss state. Switching to a different Preboss occurrence
keeps existing identity/default semantics; this plan does not transplant room
state between completion owners. Terminal I/Q cases have no Postboss. I's
`retainNormalPeers` Preboss remains distinct from takeover batches.

Actual cycles, duplicate owners and an already-owned destination remain
contract errors. Do not turn impossible structural inputs into cleanup requests.

## Delivery gates and commit boundaries

### A — Complete removal closure

Own `topology/impact.ts` and the affected ordinary, detour, Hub, takeover and
capacity-removal callers. Correct target/reference removal together. Reuse the
existing removal product and typed commands; extend it only if an explicit
surviving-owner edit cannot be expressed cleanly by its current authority.
Remove superseded caller cleanup when the shared authority takes ownership;
do not layer a second whole-document scrub over these commands.

Primary tests: `test/authored-project/topology-impact.test.ts` and focused
command tests under `test/authored-project/commands/`. Prove removal before,
at and after Chaos/Zagreus hosts, both selected and unselected extra doors,
with incomplete envelopes and complete descendant chains. Verify complete
resulting objects, public-command strict decoding, and exact Undo/Redo.
Retain representative Hub/main/side/handoff and fixed-chain removal coverage.

Review and commit this coherent removal correction before Gate B.

### B — Complete selection-change closure

Own `commands/topology/ordinary.ts`, its capacity/entry-state collaboration,
and the existing Hub/takeover seams. Implement the disposition matrix with
explicit typed cases in the owning neighborhood, not a second topology model.
Retire the exit-only reanchoring assumption and blanket rejection of a valid
selection merely because its old continuation cannot move onto Preboss.

Primary tests: command `topology.test.ts` and `route-detours.test.ts`, with
query/impact tests only for policy owned there. Cover both directions of
ordinary/Chaos/Zagreus switching; N Hub reanchoring; switching away from a
host with selected or unselected extra doors; declared width changes; unresolved
selection; and Preboss/extra-door transitions after downstream authoring exists.
Cover Shop/free Preboss choices, I ordinary-peer Preboss and terminal completion
without Postboss. Assert retained identities and room state, exact removed
branches, strict decode and history restoration. Keep impossible-input guards.

Review and commit the selection correction as its own slice.

### C — Application witnesses and closure

Use the supplied real plan to exercise both reported visible interactions and
the new Preboss witness through command dispatch, evaluation, workspace
projection and Undo/Redo. Inspect the actual resulting route, not only the
absence of an exception. Retained controls must remain usable and removed
owners must not leave stale rail, dialog, finding or Run State destinations.

Use one repository-owned authored fixture if needed; do not depend on the
user's absolute path in durable tests. Prefer the existing Surface fixture
builder with bounded extra-door edits where it reproduces the same ownership.
Do not duplicate the full engine matrix in React tests or regenerate execution
fixtures whose semantic product did not change.

Application changes are limited to a demonstrated consumer of the corrected
engine product. Do not add UI topology cleanup, special-case N/P buttons, change
readiness, or hide a repair control to avoid a command failure.

After focused tests and independent review stabilize, run one complete
`npm run check` closure gate. Record verification truthfully in the closure
commit. Update the existing authored-model continuation explanation, including
its Preboss rejection wording and stale additional-exit example; correct other
owning explanations only if needed. Delete this temporary plan at delivery;
do not append bug-history paragraphs or alter unrelated pending plans.

## Review and scope guard

Use the repository's focused executor/reviewer gate routine for implementation:
one write-capable executor, reusable for coherent remediation, then a fresh
independent reviewer per gate. Main session owns scope, Git and broad closure.
Packets name the starting files and acceptance cases above; no broad reread or
unrelated refactoring pass is required.

Audit against accidental deletion of compatible authoring, hidden automatic
selection, foreign-host extra-door transfer, dangling retained references,
detached Hub/completion branches, lost room-local state on preserved identities,
and tests that validate only removal counts. Small explicit ownership cases
are preferred over a generic graph editor or a new reconciliation registry.

This plan deliberately changes the response to a valid selection with an
incompatible old continuation: close that old branch atomically instead of
throwing. It does not authorize deleting arbitrary retained invalid state.
The approved plan is committed before implementing Gate A.
