# Outgoing Batch Progressive Horizon Plan

## Status

Locked for implementation against base commit `e66e2b7b`.

The worktree also contains unrelated, preserved enemy-formation audit edits in
`docs/audits/`. They are not inputs to this plan and must not be modified,
absorbed, reverted, or committed as part of this delivery.

This is a temporary implementation plan. It is not linked from `README.md` or
from stable design authorities. After closure, its durable decisions move into
the owning design documents and this file is removed.

## Objective

Make progressive evaluation preserve one already-generated outgoing batch as
one coherent assessment horizon when a nested acquisition child in its picked
target is incomplete or invalid.

The user-visible result is that choosing a trait-bearing or level-bearing door
reward never makes the source door batch lose facts that the game has already
settled. In particular, the schema-71 reproduction that reaches H through an
Ixion-created Chaos room must continue to display Decision 2's prior Fields
maximum as `1 / 2` after its H miniboss reward is selected and while that
reward's trait offer is unresolved.

This is not a Fields-specific presentation patch. The same boundary must keep
the complete source batch repairable for Boon, Hermes, Spell, Pom, Devotion,
and later supported acquisition children without adding another child-kind
exception.

## Current Defect and Live Boundary

The base commit removes structural bounds from generated biome progression.
Generated outgoing decisions remain structurally authorable while evaluated
room candidates decide whether ordinary continuation or a declaration-owned
Preboss takeover is possible or forced. In particular, H completion is driven
by its qualifying-room record count, O and Q force their Preboss on entry at
biome depth seven, and Q's six stages constrain ordinary candidate pools rather
than independently terminating the biome.

This plan must preserve that boundary. Progressive retention may use chronology
and completed physical-generation markers, but it must not infer a terminal
frontier from authored batch count, staged-pool length, or a resurrected
generated-progression maximum. An empty generated decision remains assessable
so its room candidates can establish the legal next transition.

The attached reproduction establishes this exact transition:

```text
H Intro
  -> Ixion-created Chaos
  -> Chaos outgoing Decision 2 with Fields Max
  -> H_MiniBoss01 target
  -> before reward: prior maximum is 1 / 2
  -> choose Boon
  -> required incoming acquisition action is inserted
  -> unresolved trait offer becomes the first blocker
  -> prior maximum becomes unavailable
```

Before reward selection, selected generation publishes the Decision 2
`FieldsCageOutcomeSupportEntry`. After selection, progressive coverage still
reports the same source decision through `afterTargetGeneration`, but the
clamped generation result has dropped that support entry. The application then
truthfully renders an unavailable value because it reads no matching support.

The loss comes from the current progressive product composition:

1. `clampSelectedProducts` evaluates a short execution prefix for truthful
   history and lifecycle effects.
2. It separately evaluates an interaction prefix so the blocking reward child
   remains repairable.
3. `retainBlockedRegionProducts` carries selected reward and candidate products
   through the blocking child.
4. `retainBlockedGenerationValidation` starts from the shorter execution
   result and manually restores only generation findings and one selected
   target's force pressure.
5. Fields support, Anomaly support, and any future batch-generation product are
   outside that manual restoration unless individually added.

This is a whitelist-shaped retention seam. The existing selected-pressure
special case and the missing Fields entry are two outcomes of the same
ownership error.

## Owning Authorities

The correction follows the already-locked rules in:

- `ROOM_LIFECYCLE_MODEL.md`: outgoing generation creates every target and
  resolves every incoming offer before the selected target is entered; later
  acquisitions cannot retroactively change that batch;
- `SIMULATION_AND_VALIDATION.md`: a `CanonicalBatch` owns one physical exit
  decision and all targets created from it, while progressive products stop
  lifecycle truth at the first blocking region without erasing earlier facts;
  and
- `CANDIDATE_EVALUATION_MODEL.md`: earlier reached owners retain their exact
  capabilities, the blocking owner retains its repair capability, and later
  owners receive no fabricated contextual claim.

No game-data audit is required. This plan changes no Hades II rule; it makes
the progressive evaluator honor the existing lifecycle and generation model.

## Locked Semantic Model

### One outgoing-generation envelope

For an ordinary source occurrence, outgoing generation has this fixed order:

```text
source reaches preOutgoing
  -> establish decision-owned batch state
  -> for each physical target in order
       assess and create the room
       resolve its incoming reward offer
       record target-generation completion
  -> freeze the complete generated batch
  -> commit and leave the source
  -> prepare and enter only the picked target
  -> settle that target's acquisition children
```

The progressive evaluator must preserve the facts before the blocker, not the
facts that merely share its persisted occurrence owner.

### Three concrete blocking positions

The retained generation horizon is derived from existing chronology and
physical target order:

| Blocking position                                              | Generation truth that remains                                                                                                                                                                       |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before the source reaches outgoing generation                  | No batch assessment is published.                                                                                                                                                                   |
| During target room or incoming-offer generation                | The decision state, completed physical prefix, and blocking target's bounded repair assessment remain; the invalid target is not claimed as generated and later physical targets remain unassessed. |
| During the picked target's later acquisition or room lifecycle | The complete source batch remains; target acquisition effects, the target's own outgoing decision, and later chronology remain clamped.                                                             |

A missing or invalid trait offer, spell offer, targeted trait child, Pom level
resolution, or other nested acquisition result is in the third row. Its
semantic address may be nested under the target's incoming reward, but its
chronology is later than completion of the source batch.

The implementation must derive this position from evaluator-owned chronology,
canonical ancestry, and physical generation markers. It must not switch on
finding codes, reward names, trait providers, biome keys, or rendered UI
controls.

### Generation assessment grouped by its real owner

Ordinary generation validation will publish one decision-owned assessment per
reached ordinary batch rather than three unrelated flat ledgers:

```ts
interface OrdinaryBatchGenerationAssessment {
  readonly origin: ExitDecisionAddress;
  readonly fields?: FieldsCageOutcomeSupportEntry;
  readonly targets: readonly OrdinaryTargetGenerationAssessment[];
}

interface OrdinaryTargetGenerationAssessment {
  readonly origin: TargetAddress;
  readonly pressure: ForcePressureLedgerEntry;
  readonly anomaly?: AnomalyTakeoverCandidateSupport;
}
```

Exact production names may follow the existing generation vocabulary, but the
ownership is locked:

- Fields support is decision-owned;
- force pressure and Anomaly support are target-owned inside that decision;
- physical target order is retained; and
- the batch assessment is a pure derived product, never authored or persisted.

The existing flat `fieldsCageOutcomes`, `forcePressure`, and
`anomalyTakeovers` collections are replaced, not retained as compatibility
views. Consumers that need a target or decision locate it through the grouped
product. This grouping earns its keep by making progressive retention operate
on one batch product and by deleting the current selected-pressure patch.

This plan does not introduce a generic product ledger, arbitrary stage
registry, callback-bearing envelope, or catch-all artifact map.

### Separate execution truth from repair truth

The existing distinction remains:

- the execution prefix owns history, acquisitions, counters, and later-room
  effects that truly executed before the blocker;
- the retained outgoing-generation assessment owns the exact source batch
  that had already been generated; and
- the blocking interaction capability owns only the context required to repair
  that exact nested decision.

Preserving a generated batch does not equip an unresolved trait, consume a Pom,
enter an unpicked peer room, execute the picked target's later lifecycle, or
make a later outgoing decision assessable.

## Ownership by Lane

### Planner engine

The engine owns the complete correction:

- group ordinary generation validation by `ExitDecisionAddress` and ordered
  `TargetAddress`;
- derive the exact generated-batch horizon at the first blocking region from
  existing chronology and canonical ancestry;
- retain or truncate the grouped batch assessment according to that horizon;
- publish the correct progressive generation result without copying selected
  acquisition effects into the execution prefix;
- retain exact repair capabilities for the blocking child and no later child;
  and
- remove superseded special-case generation retention.

The selected complete-valid evaluator and progressive evaluator continue using
the same generation authority. There is no candidate-only simulator.

### Planner application

The application adapts the grouped engine product into the existing workspace:

- Fields presentation reads its decision-owned assessment;
- target and Anomaly presentation reads the matching target-owned assessment;
- candidate interactions remain bound to the project-scoped engine session;
  and
- React keeps rendering available, unavailable, and finding states without
  reconstructing the outgoing horizon.

The application must not substitute the authored Fields value, cache the old
`1 / 2`, infer that a trait blocker is harmless, or display a guessed fallback
when engine support is absent.

### Hades II catalog and authored project

No catalog declaration, catalog version, authored schema, codec, command,
semantic address, topology shape, or migration changes are included.

## Delivery Gates and Commit Boundaries

### Plan commit

Commit this plan alone before implementation. It changes no production
behavior. The unrelated audit work already present in the worktree remains
outside that commit.

### Gate A — Outgoing batch assessment vertical slice

Gate A is one implementation gate and one Conventional Commit. The following
passes are working order, not separately committable compatibility states.

#### Pass A1 — Group selected generation products

- introduce the decision-owned ordinary batch assessment and ordered target
  assessment;
- construct it directly in the existing room-generation walk while physical
  targets are processed;
- update selected validation, generation candidates, and direct consumers to
  use the grouped product;
- remove the three superseded flat collections; and
- preserve byte-equivalent findings, support sets, pressure evidence, Fields
  arithmetic, Anomaly evidence, and physical order.

This pass is behavior-preserving by itself. It must not change reward, room,
force, Fields, or Anomaly legality.

#### Pass A2 — Make clamping generation-horizon aware

- derive the generated target prefix reached before the first blocker using
  the selected history chronology and canonical target-generation markers;
- for a blocker after source-batch completion, retain the complete containing
  batch assessment;
- for a blocker during physical generation, retain only the reached decision
  and target prefix;
- keep earlier batch assessments and discard later batch assessments;
- continue using the short execution prefix for history and lifecycle effects;
- reuse the existing bounded clamp evaluations rather than adding a third
  biome replay; and
- keep the blocking reward/trait/level capability while withholding every
  later capability.

The retained product selector must be address- and chronology-driven. No
`traitOffer`, `Boon`, `Fields`, or H-specific branch is permitted in the clamp.

#### Pass A3 — Remove superseded retention and adapt the workspace

- delete `SelectedTargetGenerationAssessment` and the selected-target lookup
  in `clampSelectedProducts`;
- delete the force-pressure-only merge in
  `retainBlockedGenerationValidation`, replacing that function with the
  grouped batch-horizon selection or removing it entirely;
- update the structured workspace to read decision-owned Fields support and
  target-owned generation evidence;
- keep the existing UI language and control layout; and
- add one planner UI witness that the displayed prior maximum remains
  concrete while the trait editor is unresolved.

Gate A is incomplete if both the grouped product and any flat compatibility
view remain, or if Fields is repaired through an application fallback.

### Gate B — Closure absorption

After Gate A passes independent review and accepted findings are remediated:

- update `SIMULATION_AND_VALIDATION.md` with the decision-owned generation
  assessment and the acquisition-child retention rule;
- update `CANDIDATE_EVALUATION_MODEL.md` with the exact outgoing-batch repair
  horizon;
- update `ROOM_LIFECYCLE_MODEL.md` only as needed to make the existing frozen
  outgoing-batch rule explicitly govern progressive retention;
- record the completed correction and validation result in
  `IMPLEMENTATION_PROGRESS.md`;
- remove this temporary plan; and
- run the one complete repository closure gate.

Gate B is documentation absorption and verification, not another production
repair pass.

## Primary Tests and Concrete Witnesses

### Engine generation owner

- selected complete-valid F/G/H evaluations retain the same Fields, force, and
  Anomaly support after grouping;
- every batch assessment is keyed by its exact decision, every target
  assessment is keyed by its exact target, and target order matches physical
  exit order; and
- no target assessment is duplicated across batches or reconstructed by a
  consumer.

### Progressive clamp owner

1. **Exact H reproduction:** reduce the attached route to an H fixture with an
   Ixion-created Chaos room, a Max Fields Decision 2, and an H miniboss target.
   Assert `1 / 2` before reward selection and after selecting a Boon whose
   trait offer is unresolved.
2. **Nested-child matrix:** exercise distinct semantic descendants rather than
   duplicating providers that share one trait-offer path: an unresolved Boon
   `traitOffer`, a completed targeted offer with a missing
   `traitAcquisitionTarget`, and an unresolved Pom `levelResolution`. Each
   retains its complete parent batch without applying its acquisition effect.
3. **Complete physical peers:** a blocker during the picked target's
   acquisition retains every already-generated peer target and its
   generation assessment.
4. **Generation-time block:** an invalid room or incoming reward on an earlier
   physical target still withholds unsupported later target-generation
   products. The new rule must not broaden repair coverage backward in time.
5. **No lifecycle leakage:** the unresolved child equips no trait, changes no
   level, commits no target room, publishes no target-owned outgoing decision,
   and does not make a later room candidate assessable.
6. **Repair capability horizon:** the blocking child remains editable while a
   later target lifecycle child remains unavailable.

The complete matrix belongs to the engine's progressive selected-product and
prefix-frontier tests. Focused biome suites retain only representative H and G
contact witnesses rather than duplicating it.

### Application contact

- decision assembly projects `priorMaxOutcomes: { fieldsMaxDoorsRolled: 1,
maxDoorCageCeiling: 2 }` after the H reward command creates an unresolved
  trait child;
- Decision Workbench renders `1 / 2`, not `Unavailable`, in that state;
- the trait launcher remains amber and navigable; and
- room/reward controls after the true progressive horizon remain unassessed.

### Work-count and determinism

- the progressive work-count witness proves the correction does not add a
  third bounded biome replay;
- equal normalized inputs produce deeply equal grouped assessments; and
- unrelated navigation or repeated candidate activation does not rebuild the
  evaluation assembly.

During implementation use the narrowest truthful engine and planner lanes.
At closure run typecheck, lint, format/diff checks, build, and exactly one
complete `npm run check`. Do not repeat the complete gate after unchanged
sequential suites already establish the result.

## Independent Review Audits Against

The Gate A reviewer receives base commit `e66e2b7b`, the complete gate diff,
this plan, the three owning design authorities, and exact validation results.
Review must specifically verify:

1. the fix is chronology-driven and contains no reward-, trait-, biome-, or UI-
   specific clamp policy;
2. the grouped assessment replaces rather than wraps the flat validation
   ledgers;
3. the full source batch is retained only when its generation preceded the
   blocker;
4. a generation-time failure still withholds unsupported later physical
   products;
5. no unresolved acquisition effect enters history or Run State;
6. later decisions and candidate capabilities remain beyond coverage;
7. the application consumes engine evidence and has no guessed fallback;
8. work count does not increase; and
9. tests establish the general invariant rather than only the attached H
   example; and
10. no grouped-product or clamp logic recreates a generated batch bound or
    treats Q's staged-pool length as terminal progression authority.

The main session owns final bird's-eye review, finding dispositions, closure
documentation, and Git operations.

## Explicit Non-Goals

- changing trait, rarity, level, reward-bag, room, Fields, force, or Anomaly
  game rules;
- changing when incoming rewards are offered or acquired;
- changing persisted authored state or migrating profiles;
- changing generated-room eligibility or reintroducing structural bounds for
  generated progression;
- automatically completing an unresolved trait, spell, or level editor;
- making later authored topology contextually valid;
- retaining every selected-simulation artifact after a block;
- introducing a generic event-sourced product registry, dependency container,
  or callback envelope;
- adding probability or RNG modeling; and
- redesigning Door, Trait, or Run State presentation.

## Completion Definition

The plan is complete when every ordinary outgoing batch is represented by one
decision-owned generation assessment, progressive clamping retains exactly the
portion generated before the first blocker, acquisition-child failures no
longer erase their complete parent batch, no acquisition or later-lifecycle
effect leaks past the blocker, the special selected-pressure retention path and
flat compatibility ledgers are deleted, the H `1 / 2` reproduction and the
cross-child regression matrix pass, the application renders the preserved
engine fact without fallback logic, durable authorities absorb the rule, this
temporary plan is removed, and the complete repository closure gate passes.
