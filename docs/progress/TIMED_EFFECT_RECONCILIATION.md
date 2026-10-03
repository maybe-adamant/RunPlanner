# Timed-effect reconciliation

Status: locked execution contract; implementation has not started.
Base: `3db3418f` (implementation baseline `8c9d12d8`; the later commit only
added the now-retired positioned-placement plan).

## Objective and scope

Required Hermes deliveries appear directly in the timeline when their exact
contact is established, with Move for ordering. Room and lifecycle edits preserve
timed-effect authorship only where effect-specific equivalence establishes safe
transfer. Otherwise timing wins over preservation of incompatible choices.

Includes Hermes deliveries, Supply Chain pickups, Steady Growth targets and
Transcendent Embryo outcomes; room replacement, changes to active encounter
phases and earlier edits that shift downstream clocks; atomic Undo/Redo.
Excludes other automatic effects, boss opening moves, native clock rule changes,
a generic scheduler, authored schema migration, and optional-pickup auto-acceptance.
No save-format change is authorized. If existing representation is insufficient,
stop and amend this plan rather than introduce a migration.

## Authorities and current evidence

Read `docs/design/SIMULATION_AND_VALIDATION.md` in full, especially Authored
State Is Not Evaluated Truth, Clocks and trait history, and Findings and Repair.
Specialists: `AUTHORED_PROJECT_MODEL.md` Occurrence State and Replacement,
Commands / Ordered reconciliation, and Undo and Redo;
`ROOM_LIFECYCLE_MODEL.md` Room Action roster boundary, automatic encounter-end
effects and Hermes delivery timing; `EDITOR_MODEL.md` Bound Interactions.

Current paths:

- `authored-project/commands/room-replacement.ts` retains occurrence identity,
  compatible room rewards and matching Artificer entries, but drops Hermes and
  clocked pickup entries before filtering their actions.
- `authored-project/room-state/encounter-reconciliation.ts` reconstructs encounter
  state without retaining Steady Growth or Embryo outcome fields.
- `simulation/rewards/biome/lifecycle-transitions/encounter-end-effects.ts`
  already owns the four clock transitions. Hermes uses room and encounter use
  predicates; Supply Chain additionally supports deferred maturity. Automatic
  Steady Growth and Embryo effects settle before generated pickup frontiers.
- `simulation/evaluation/project-evaluation-assembly.ts` exposes exact derived
  entries and purchase-reschedule placement. The latter is invoked only for
  `SetHermesShrinePurchase` in `apps/planner/src/state/projectWorkspaceSlice.ts`.
- `simulation/rewards/acquisition/generated-pickup-placement.ts` distinguishes
  proven invalid placement from unassessed placement. Preserve that distinction.

These are current code facts, not new native-game research. Existing source-backed
clock policies remain authoritative. Automatic required insertion and conservative
choice reset are chosen planner authoring policies.

## Locked behavioral direction

1. Establish equivalence separately for each effect, using its source identity,
   corresponding lifecycle contact and actual clock-relevant behavior. Same room
   template, occurrence, decision ordinal or phase name alone is insufficient.
2. For equivalent contacts, retain compatible authored outcomes and legal relative
   action order. Preserve unrelated authored state.
3. For proven incompatible contacts, reset only the affected authored details.
   Recalculate timing using existing simulation. Hermes receives a required action
   at the exact newly reached contact; Steady Growth and Embryo remain fixed
   automatic effects with unresolved choices when needed. Supply Chain becomes
   available but is not automatically accepted.
4. An unassessed suffix is not proven incompatible. Retention is limited to
   structurally representable leaves: vanished owners/phases may require narrow
   removal to satisfy the existing codec, recoverable through Undo. Earlier incompleteness must
   not cause speculative relocation or deletion. Later edits resume settlement
   when exact evidence becomes available. Never simulate past unresolved choices
   using invented outcomes.
5. Reconcile downstream affected contacts, not just the replaced room. Match a
   recurring drop to the corresponding source/maturity; do not reuse choices from
   a different cycle merely because the trait matches.
6. A valid required Hermes action cannot be deleted into a persistent missing
   placement state. Source-owned changes remove obligations; proven stale retained
   actions remain repairable. Move and reward editing remain available.
7. Every triggering edit and its reconciliation publish one authored history step.
   Undo restores discarded details; Redo restores the exact settled snapshot.

## Equivalence evidence and reset limits

Hermes correspondence uses source occurrence plus generation key, the purchased
obligation, and its reached due host/phase (including rushed/final-preboss policy).
Supply Chain uses acquired producer identity, corresponding maturity in that
producer's chronology, reward identity and due phase, including deferred drops.
Steady Growth uses the acquired source, corresponding upgrade threshold and
checkpoint. Embryo uses the active keepsake cycle and corresponding transformation
threshold/checkpoint, including equip/reset boundaries. Compare effect-owned
clock advancement and ordered active lifecycle contacts; never equate unrelated
cycles by global history sequence or a shared phase label.

Equivalent evidence must agree across reached cohorts. Mixed or missing evidence
is unknown, not a license to copy, erase or pick the first branch. Structural
correspondence may preserve representable data until exact assessment is reached;
it must not claim contextual validity. Restrict resets to effects displaced by
this edit's topology/timing change, not arbitrary invalid target/boon authorship.
Existing invalid choices remain repairable under ordinary validation.

## Ownership and construction

Catalog: existing normalized declarations are inputs, not a new policy owner.
Engine structural commands: retain structural validation and topology closure;
do not import evaluation or silently simulate inside `ReplaceOccurrenceRoom`.
Engine lifecycle/trait owners: own effect-specific correspondence and timing
facts, using current transitions rather than a parallel counter model.
Engine edit settlement: compose explicit before/proposed snapshots, exact
assemblies, reconciliation commands and final project/evaluation. It owns the
atomic authoring transition above structural commands and evaluation.
Application: invoke that supported operation and publish history/workspace;
remove purchase-specific semantic orchestration from Redux.
React/projections: render settled rows, Move and exact findings; no reconciliation
in selectors, effects or render. Game module: no new semantics or protocol.

Before adding a module, name its explicit input/output, consumers, tests and the
old path it replaces. Settlement must be deterministic and idempotent, advance
only through established contacts, and stop at genuine unresolved authorship.
Use explicit progress detection; never an unbounded simulate/repair loop or a
magic retry count. Imported incomplete projects must remain readable without
creating history edits merely by viewing them. Load and workspace preparation stay read-only. Legacy missing deliveries retain
one explicit Restore delivery repair intent at their exact timeline/finding owner;
it invokes engine edit settlement and creates one history step. This is a repair
for imported omissions, not routine Place participation. Do not normalize on load.

## Delivery gates and intended commits

### Gate 1 — Atomic timed-effect reconciliation (one implementation commit)

Inventory replacement, encounter-count/selection edits, source removal, phase
changes and downstream invalidation paths. Establish narrowly owned correspondence
for each of the four effects. Implement conservative preservation/reset with
primary tests beside the owning engine authority. Do not land interfaces without
consumers. Keep game clock transitions unchanged. If local structural evidence
cannot establish correspondence, use the settlement boundary below rather
than guessing from matching phase names.

Acceptance: equivalent P combat replacement; combat-to-story; changed active
phase count; skipped/deferred clocks; preserved relative order; incompatible
choices reset; unassessed suffix retained. Deliver the preservation rules together with settlement below; do not commit
a partial path that discards data before settlement can establish correspondence.

#### Settlement and automatic Hermes participation

Implement the engine-owned edit operation with its application consumer in one
vertical slice. Replace purchase-only rescheduling. Reconcile reached downstream
stale placements before allowing them to block discovery of the next valid contact,
but do not bypass unrelated reward/target blockers. Preserve safe choices and
prevent duplicate deliveries. Support subsequent edits revealing more contacts.

Acceptance: multiple deliveries; earlier clock shift; source removal/reactivation;
rushed same-room and final-preboss cases; unresolved predecessor; partial/mixed
branch evidence; no-op/idempotence; one Undo/Redo; no mutation during projection
or simulation. Include existing/imported missing placements in the explicit repair
workflow without silently rewriting files on load.

### Gate 2 — Timeline integration and closure

Remove routine Hermes Place presentation and superseded exact placement query
plumbing where unused. Render automatically inserted actions with Move and reward
controls. Preserve stale-action repair, optional Supply Chain participation and
precise finding navigation. Do not change unrelated Echo Gold placement.
Update durable owning contracts and delete this plan at delivery closure.

Acceptance: representative browser workflows for automatic Hermes, safe room
replacement, fallback choice repair, optional Supply Chain and Undo. Verify no
empty picker, duplicate row, navigation jump or required-delete/reinsert loop.

## Tests, review and retirement

Engine tests own the four-effect policy matrix; application tests own atomic
history/publication and read-only preparation; UI/product tests retain a few
representative workflows rather than duplicating every rule.
Run equivalence before and after chronology/settlement changes; classify intended
product differences before updating any baseline. Use focused engine/planner/UI
lanes during gates, and the complete `npm run test` plus `npm run check` once at
phase closure. Measure interaction performance against the base because repeated
evaluation is a material risk. Generated protocol fixtures, if affected, follow
repository generation/formatting discipline and require game-module tests.

Main session inventories the live base and sends self-contained gate packets.
Only one write-capable executor works at a time; independent review follows a
stable gate with one bounded remediation pass. Review ownership, false equivalence,
coverage, optional participation, destructive resets, evaluation work and removal
of superseded paths. Commit this reviewed plan before implementation.

Retire `HERMES_POSITIONED_PLACEMENT.md` now; its uncommitted implementation was
discarded. Retire purchase-only reschedule orchestration and routine Place UI in
their replacement slices. Preserve unrelated `BOSS_OPENING_MOVES.md`. At closure,
promote only durable contracts; pending live acceptance belongs in `docs/testing/`,
not in a completed plan. No README link to this temporary document.
