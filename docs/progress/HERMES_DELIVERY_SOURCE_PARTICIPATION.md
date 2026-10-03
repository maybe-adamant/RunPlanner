# Generated pickup placement and required-obligation repair

Status: locked, 2026-10-02; supersedes the former structural-only Hermes plan.
Base: `26ff887b`, with the existing uncommitted
17-file structural Hermes implementation treated as input, not accepted delivery.
Boss-opening work remains paused. The owner authorized committing this plan and
starting implementation on 2026-10-02.

## Objective and scope

A retained generated pickup must not trap the user between an empty reward
editor and a required-action removal guard. Separate the source's obligation,
the saved placement, and the pickup's reward details. A proven invalid placement
has a usable repair; repairing it never cancels a still-live required delivery.

Deliver the complete cross-room Hermes contract, irrespective of payload type
(Boon, Hermes, Hammer, Pom, Blind Box or consumable). Include structural source
loss and reached timing/host/phase invalidity, loaded stale saves, delayed,
rushed and cross-biome contacts. Bring clocked trait pickups, including Supply
Chain, through the same placement-assessment boundary while preserving their
optional participation. Audit local generated required pickups (Artificer,
Sea Star and Eris gifts) against the boundary; retain their existing source-owned
repair if sufficient rather than giving them arbitrary relocation.

Exclude a generic relocation system, a new scheduler, new game rules, automatic
load-time cleanup, persisted validity flags, schema/protocol changes and blanket
removal of ordinary required actions. No catalog or game-module change is
expected. A discovered schema need requires owner approval before implementation.

## Evidence and governing authorities

The supplied `Charon Surface.json` retains two deliveries from an ungenerated
`N_Sub10` in `N_Combat12`. Evaluation emits `staleHermesShrineDelivery`, yet the
structural domain calls the entries required and `RemoveRoomAction` rejects them.
An absent reward capability alone is not equivalent evidence: evaluation may
not have reached the owner, or branch contexts may disagree.

This is a planner repair-model correction, not a new native behavior claim.
Existing source/due-contact authorities remain authoritative for game facts.
The required-versus-optional behavior of each producer stays unchanged.

Governing sections:

- `docs/design/SIMULATION_AND_VALIDATION.md`: Evaluation Pipeline, Authoring
  Readiness, First blocking region, Settlement Handoffs, Findings and Repair.
- `docs/design/AUTHORED_PROJECT_MODEL.md`: Commands, Ordered reconciliation,
  Persistence and Validation, Undo and Redo.
- `docs/design/REWARD_MODEL.md`: Shops (Shrine delivery contract), Offer and
  Acquisition, Validation Boundaries.
- `docs/design/CANDIDATE_EVALUATION_MODEL.md`: Candidate Session,
  First-blocking artifact horizon, Reward Producer Frontiers, Application and
  React Boundary.

## Chosen contracts

### Placement evidence

Keep structural action identity and required participation separate from a
non-persisted, semantic-owner-addressed placement assessment. Use a closed
product distinguishing valid placement, proven invalid placement and unassessed
placement; requiredness and payload completeness are independent fields/facts.
These are contract meanings, not mandatory type names.

Structural source absence/inactivity can prove invalidity without executing a
later room. Reached lifecycle settlement can prove a wrong due contact, host or
phase. Evidence names the source identity, exact retained action/entry and the
owning reason/contact. Reward-type mismatch is classified by the existing
source authority: do not erase a valid placement merely because its payload
needs replacement. Missing Boon/Hermes choices remain reward-detail repairs.

Missing evaluated coverage does not suppress a separately established structural
proof: a structurally obsolete retained placement remains identifiable behind an
earlier blocker, subject to existing authoring readiness for invoking its repair.
Only lifecycle-derived assessments are clamped to the evaluation horizon. When
there is no structural proof, unreached context and non-unified branches cannot
prove invalidity. A placement
is proven invalid across evaluated cohorts only when each relevant cohort
supports that conclusion; mixed evidence retains its disagreement/blocker.
Never derive status from missing candidates, a missing artifact, a finding string,
or a UI key prefix. Structural evidence does not fabricate reached history.

Publish reached evidence before child settlement and carry it explicitly in the
complete settlement result, through biome/project assembly and first-blocking
retention. Capture it in the normal evaluation; no second replay or sidecar
registry. The blocking placement retains its repair even with zero reward
candidates. Later evaluated claims remain withheld under existing coverage rules.

### Semantic unplacement

Introduce a bounded authored command for unplacing an exact generated delivery
whose family supports separate placement (Hermes initially; reuse the existing
clocked removal semantics rather than maintaining a parallel command path).
The handler validates structural family, owner, source identity and exact stored
placement. It does not consume simulation, a capability or a caller's stale flag.

Unplacement is structurally legal even for a currently live relocatable Hermes
delivery: it deliberately creates an incomplete plan, not a skipped obligation.
The editor offers it as placement repair when invalidity is proven; live rows
retain their normal required presentation. Ordinary `RemoveRoomAction` remains
protected for active required actions. Same-room rushed Shrine deliveries also do not gain this command: the codec
requires their delivery action with the rushed purchase, and the existing placement
command rejects same-room hosts. They retain purchase/source repair and required
pickup protection. Local mandatory pickups without separate placement likewise
do not gain this command. Rushed coverage tests this protected distinction; it
does not relax the codec or invent a relocation frontier.

Remove the exact host reference and its host-local payload/children atomically,
preserving the upstream purchase/effect and unrelated siblings or recurrences.
Source-edit retraction may retain dormant drafts under existing policy, but no
retained payload may recreate an unplaced action. Reconciliation must not
immediately reinsert an explicitly unplaced delivery. If still due, the existing
lifecycle authority publishes the missing placement and exact placement support;
execution stays blocked until satisfied. Restoring a source does not promise
automatic placement at a guessed host: reuse reached placement support.

### Editor and finding contract

Engine authoring products expose placement assessment and supported semantic
repair separately from reward candidates. Application projections bind that
repair to the placement owner; finding navigation and the row lead to the same
usable repair. React neither infers validity nor implements source policy.

Proven-invalid placements show a concise explanation and an unplace action,
not an empty reward dropdown. Valid placements with incomplete payload keep the
exact reward editor. Unassessed placements retain the existing earlier-blocker
or context-unavailable presentation without a stale label. Preserve accessible
interaction and one-sentence hover help where explanation is needed.

## Ownership and starting points

| Owner                     | Responsibility / starting neighborhood                                                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine authored project   | Source/placement identity, command union and handler, atomic cleanup/history; `hermes-shrine-delivery.ts`, `commands/room-actions.ts`, `commands/dispatch.ts`, `room-actions/state.ts`, `acquisition/pickup-producers.ts` |
| Engine structural domain  | Existing topology participation and ordinary required-action protection; `room-actions/defaults.ts`, `room-actions/domain.ts`                                                                                             |
| Engine lifecycle/rewards  | Due truth and reached placement evidence; `simulation/rewards/biome/lifecycle-transitions/hermes-shrine-delivery.ts`, `encounter-acquisition/acquisition-point-reached.ts`, acquisition contracts/artifacts               |
| Engine assembly/authoring | Complete evidence propagation, coverage, roster repair proposals and findings; `simulation/room-actions/`, `simulation/evaluation/`, `simulation/progressive/` and existing authoring-query surfaces                      |
| Planner application       | Projection, finding destination and bound command; `projections/structured-workspace/assembly/occurrence-action-row-projection.ts`, `occurrence-room-facts.ts` and their interaction bindings                             |
| React                     | Render the composed repair and reward controls; no validity policy                                                                                                                                                        |

Before introducing a new module, name its inputs, complete returned product,
consumers, primary tests and displaced code. Reuse the existing topology
participation authority without the current `defaults` ↔ Hermes helper import
cycle. Do not spread an optional Hermes-specific source set through unrelated
commands as the final cross-family contract. Missing assessment must be explicit,
not an omitted argument interpreted as valid.

## Delivery gates and intended commits

Each gate is a complete working slice with its own tests and consumers; no
interface-only or forwarding commits. Main session inventories the live diff
before delegating, preserves unrelated work, allows one writer, and uses a fresh
independent reviewer after each implementation stabilizes. One bounded remediation
pass follows; unresolved contract conflicts return to the main session.

### A — Hermes structural placement repair

Intended commit: `fix(engine): separate Hermes placement from required delivery`.
Adapt the useful structural detection and fixtures from the current diff.
Deliver the unplacement command, structural assessment, loaded-save repair and
application binding together. Hermes placement repair proposals bind the new
unplacement command; do not retain a second Hermes-specific ordinary-removal
repair path. Ordinary removal keeps its established participation rules, and
clocked pickups retain their existing removal semantics. Preserve ordinary required
protection and prove a still-due unplaced delivery blocks publication. Eliminate
the optional Hermes-context plumbing and circular dependency superseded by the
chosen product; do not simply layer another repair path on top.

Primary tests: authored command/history and room-action authoring suites.
Representative application witness: supplied-save-shaped stale delivery at a reached
host → finding navigation → usable unplacement → Undo. Structural assessment of
a retained host beyond evaluated coverage is completed in Gate B with its
coverage integration; Gate A must not fabricate an evaluated room to expose it. Use a minimal portable production-built
fixture, not a dependency on the owner's Downloads directory.

### B — Reached placement evidence and coverage

Intended commit: `fix(engine): retain generated pickup placement repair evidence`.
Extend the complete settlement product and consume it in roster/authoring
assembly and application repair. Cover active sources with obsolete contacts,
clocked pickups, payload-invalid live placements and unassessed contexts. Expose
independent structural assessment for retained hosts without an evaluated roster,
respecting readiness and without synthesizing reached chronology. Preserve
branch evidence, first-blocking ownership and existing exact placement queries.
Remove superseded finding-to-editor fallbacks that route a proven-invalid
placement into a reward picker. No new scheduler or contextual command validation.

Primary tests: owning lifecycle/acquisition/coverage and roster suites; command
tests retain structural legality only. Representative app witnesses cover an
obsolete required host and a valid delivery with unresolved Boon/Hermes details.

### C — Family closure and documentation

Intended commit: `fix(planner): complete generated pickup repair workflows`.
Audit local required generated pickups against the same distinctions. Fix any
confirmed dead-end through its existing source-owned repair, with a regression;
do not fabricate a removable placement for a family that cannot support one.
Prove finding routing, persistence, Undo and publication through representative
product workflows. Consolidate duplicate policy/tests and delete displaced paths.
Update the smallest owning design sections with the accepted contract. Delete
this plan and the cross-room investigation once their questions are resolved;
any concrete unresolved question must be explicitly bounded before closure.
Leave the unrelated paused boss investigation intact. No live acceptance is
claimed by automated planner checks.

## Acceptance matrix and test ownership

- Commands/history: deleted versus retained-inactive source; generation and
  visit-order changes; loaded obsolete placement; exact unplace, Undo/Redo and
  save/reload; siblings and recurring pickups preserved; children cleaned;
  no payload resurrection after an unrelated command or save/reload; live required
  unplace preserves obligation;
  ordinary combat/local required removal still rejected.
- Lifecycle/settlement: delayed, rushed, cross-biome and final-Preboss contacts;
  host/phase/delay/route changes that produce genuinely representable stale
  placements; required due delivery remains missing after unplace; no duplicate
  rewards or double settlement; placement validity independent of payload type.
- Coverage/artifacts: first blocked placement retains repair, earlier blocker
  leaves later timing-dependent placement unassessed while an independent structural
  proof remains available under existing readiness; branch disagreement is not source
  absence, live incomplete reward retains candidate support.
- Application/product: finding and row share repair destination; no empty picker
  as sole repair for proven-invalid placement; exact command binding, Undo and
  a live Boon/Hermes detail editor. Consumers keep representative witnesses,
  not copies of the engine policy matrix.

Use narrow owning lanes during implementation. Capture equivalence before engine
changes and run it after settlement/chronology changes; investigate differences
and update its baseline only for reviewed intended product changes. Do not
promise an unchanged baseline if the public evaluation product changes.
After review remediation, run one full `npm run test` and `npm run check` closure
gate. Record truthful verification in commit history; do not claim the existing
uncommitted implementation passed tests without running them.

## Review dispositions

Implementation review must challenge: unplacement versus cancellation; reconciliation
resurrection; optional-context defaults; lost evidence at settlement/coverage
handoffs; branch disagreement; structural facts mistaken for reached facts;
unsupported local relocation; and duplicated scheduling or family policies.
Execute under the repository gate routine; the main session owns any further
contract amendments.

Independent plan review resolved three ambiguities: rushed same-room deliveries
retain source repair; structural proof is independent of evaluated coverage; and
Hermes placement repair has one unplacement command path. These dispositions are
part of the locked contract and must be checked in implementation review.
