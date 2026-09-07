# Chronological authoring readiness audit

## Scope and evidence

Current-code audit at `be777898` (2026-09-07). This examines the planner's
permission to author beyond incomplete input, not game execution ordering or a
new simulation model. No production behavior changes accompany this audit.

The user-selected disposition is chronological authoring: settle required
upstream input before authoring downstream input. Preserve retained invalid or
incomplete documents and their repair paths. An unassessed suffix is useful to
display, but unavailable assessment is not permission to author ahead.

This deliberately changes the permissive editor contract. It is not merely a
bug in how disabled controls are rendered.

## Current behavior: two competing policies

### Local setup prerequisites are enforced

`packages/planner-engine/src/authored-project/commands/topology.ts` rejects
`CreateTarget` until the ordinary batch reward store is selected, and until a
Fields batch has its cage outcome. The engine's
`authored-project/topology/query.ts` also exposes structural target eligibility.

The application further sequences missing physical doors in
`apps/planner/src/projections/structured-workspace/assembly/decision-assembly.ts`:
the first missing room can be created, while later missing rooms await that
room. `DecisionWorkbench.tsx` explains these prerequisites inline.

There is an important limit: this missing-target cascade checks whether the
earlier target exists, not whether its reward is fully authored. Therefore the
existing batch editor is a useful presentation precedent, but not a complete
implementation of batch → room → reward → next room/reward readiness.

### Unreached contexts remain authorable elsewhere

`docs/design/CONTEXTUAL_EDITOR_UX.md`, under Progressive Evaluation Foundation
and Ordinary/Diagnostic behavior, explicitly permits editing later biome pages
and stable declaration domains without evaluation coverage.
`docs/design/EDITOR_MODEL.md` also preserves editable unassessed controls.

This behavior is implemented, not just stale documentation:

- `interactions/topology-interaction-binding.ts` accepts an ordinary room
  candidate when its support is anything other than `impossible`, including
  unavailable context, provided structural prerequisites pass.
- Its test named “keeps a structurally valid unassessed ordinary Door 1
  authorable behind a retained prefix” builds an opening without settling its
  reward, authors subsequent batches, and expects a later room choice to be
  enabled and to produce `CreateTarget`.
- `interactions/room-feature-picker-model.ts` projects stable choices as
  `unassessed` with `disabled: false` when assessment is unavailable.
- Room-feature and encounter UI tests preserve unreached domains. Decision
  and Hub assembly tests also retain unassessed projections.

These paths explain the observed inconsistency: a missing batch selector
physically blocks authoring a room, while missing earlier acquisition input
can merely remove contextual assessment from a still-editable later control.

## What the engine already knows—and what it does not publish

The engine already separates several relevant concepts:

| Concept                                  | Existing evidence                                                                                    | Meaning for readiness                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Structural completeness                  | `simulation/completeness.ts`, including an incomplete frontier and findings                          | Identifies missing topology; does not alone cover every reward or effect outcome.         |
| Authoring and validity                   | `simulation/project.ts` separately examines `authoring` and `validity`                               | An authored value can be invalid; missing input is not the same condition.                |
| Assessment horizon                       | `simulation/progressive/products.ts` exposes materialized prefix, assessment prefix, and `blockedAt` | Retained structure is larger than the truthfully evaluated prefix.                        |
| Semantic chronology and repair ownership | `simulation/finding-regions.ts` and `progressive/finding-location.ts`                                | Existing addressed regions locate blockers and preserve pre-decision repair context.      |
| Candidate support                        | Contextual candidate products                                                                        | Determines legality only where the relevant context is available.                         |
| Missing acquisition authorship           | `simulation/model.ts` has `isAcquisitionAuthorshipMissingFinding`                                    | A narrow existing classification, not a general readiness policy for every editor action. |

`simulation/project.ts` already stops route evaluation at an incomplete or
invalid biome, records the blocked suffix, and refuses to seed continuation
from an incomplete biome. Progressive evaluation retains authored material
while clamping assessed products to the first blocking region.

The missing product is a coherent answer to “may this semantic authoring
operation proceed, and which prerequisite prevents it?” Existing structural
eligibility, findings, and unavailable candidate states answer parts of that
question, but consumers currently combine them with different policies.

Neither finding severity nor `unassessed` is a sufficient discriminator.
Missing and invalid input can both stop evaluation; a stable declaration-only
choice can also lack contextual assessment. An engine-owned distinction must
retain that evidence rather than having React infer it from error text.

## Disposition: completeness gates progression, not visibility

The intended policy is:

1. Required missing input blocks all suffix authoring beyond its semantic
   boundary, including edits and deletions of retained suffix values.
2. The incomplete owner and already-reached earlier owners remain editable.
3. Invalid selections remain visible and repairable with the existing
   progressive candidate rules. Invalid is not relabeled as incomplete.
4. When an earlier edit makes the suffix unreachable, preserve its authored
   values. Do not silently delete, default, or repair that suffix.
5. Navigation, inspection, findings, and undo/redo remain available. A visible
   downstream control may be disabled and identify the exact prerequisite.
6. An untaken optional action does not require an outcome. Once participation
   is authored, its required outcome must be settled before progression.
7. Absent optional features are not missing input. Declaring a feature or an
   offer count can activate required descriptive fields even when acquisition
   remains optional.

Complete the prefix to release this incompleteness lock. The completed prefix
may make retained suffix values invalid; that is a valid intermediate authored
document, not a reason to reject prefix completion or keep the incompleteness
lock. Invalidity remains subject to existing progressive candidate validation,
not a second completeness gate.

This is an authoring policy, not a requirement to evaluate the whole remaining
route before editing its beginning. Downstream missing structure must not
disable a covered earlier selector. Automatic boss/postboss creation may still
create structural occurrences without requiring their outcomes immediately.

The selected-value and control-existence invariants remain useful: keep the
control and its retained value. The “unavailable means editable” part changes.

## Generation completeness versus acquisition completeness

The save reported during the finding-ownership work declared three optional
rewards in `H_Combat05`, but the third reward value was null. Its `rewardMissing`
finding remains when the third pickup is removed from the action list in an
in-memory diagnostic copy. The missing fact is what was generated, not which
pickup action was taken.

That distinction generalizes:

- All active offers in a generated batch need their required reward identity,
  including unpicked offers that affect generation history or reward bags.
- Only selected/participating acquisitions need the trait, spell, level, or
  other outcome appropriate to that acquisition.
- A selected boon's missing trait screen must not prevent changing that boon
  to a different reward, changing the selected exit, or otherwise repairing
  the containing decision at its valid pre-decision point.
- A missing optional pickup outcome must not prevent withdrawing participation.
- A removed or dormant child must not remain the blocking prerequisite.

“Everything visible must be filled” would violate these distinctions.

## Cross-surface inventory

The following boundaries must retain their existing semantic ownership. The
table identifies readiness implications, not new biome mechanics.

| Surface                                 | Existing authority and shape                                                                                                   | Readiness implication                                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loadout and route start                 | `simulation/project.ts` records incomplete/invalid route-start blocks                                                          | Required equip/Hex outcomes precede room authoring; complete defaults do not require ceremonial confirmation.                                                                 |
| Opening and intro                       | Declaration-owned entry occurrence and reward surface                                                                          | Creating the start is not completing it. A no-reward intro must not acquire an artificial reward prerequisite.                                                                |
| Ordinary exits                          | Structural batch prerequisites, physical targets, then reward surfaces                                                         | Unify the existing partial cascade with reward completeness; retain replacement at the owner's pre-decision context.                                                          |
| H Fields                                | `docs/biomes/H_GAME_RULES.md`: cage offers belong to the outgoing offer surface; optional rewards remain entered-room controls | Settle batch cage outcome and active cage identities at generation; do not move them into the entered room's Timeline. Optional count activates local reward definitions.     |
| H Layout                                | Same authority: point assignments describe placement, not action order                                                         | Layout must not become an extra execution phase. Any required missing placement needs its own semantic prerequisite; valid declaration defaults need no user acknowledgement. |
| N Hub                                   | `docs/biomes/N_GAME_RULES.md`: persistent generated board, independent ordered visits, parent-owned side-room generation       | Do not equate board generation order with visit order. Generated sibling rewards and selected visit acquisitions have different completeness boundaries.                      |
| N side rooms                            | Same authority: generated side rewards form an unordered sibling batch, visits own their room timelines                        | A room's position on the rail is not prerequisite authority; use the local visit and generation ownership.                                                                    |
| O wheels                                | `docs/biomes/O_GAME_RULES.md`: each active wheel has store, count, offers, and selection; only selected offer acquires         | Settle each active wheel at its lifecycle point; dormant wheel two is not incomplete. Do not require unpicked offer trait outcomes.                                           |
| P encounters                            | `docs/biomes/P_GAME_RULES.md`: controlled ordered encounter composition                                                        | Missing follow-up must be addressed within the active composition; do not invent arbitrary encounter linking or flatten phases into one tab-wide step.                        |
| Boss/postboss and detours               | Existing occurrence topology and declaration-owned lifecycle                                                                   | Structural creation is distinct from reaching the occurrence for authoring. Use selected-path chronology, not creation order.                                                 |
| Shops and Shrines                       | Known inventories precede acquisitions; Shrine payload resolves at actual delivery                                             | Inventory authoring and purchase/delivery outcome readiness are different boundaries. Do not demand a delayed mystery god at purchase.                                        |
| Wells and Pools                         | `ROOM_FEATURES_GAME_DATA_AUDIT.md`: uninteracted inventory may remain dormant/runtime-random                                   | Do not turn dormant inventory into mandatory authoring. Interacting activates the applicable authored contract.                                                               |
| Automatic effects and generated pickups | Existing addressed outcome and acquisition chronology                                                                          | Required matured targets block continuation at their real owner; resolve through that owner's repair context, not an unrelated later control.                                 |
| Route-wide resources                    | One placement command can relocate an earlier choice                                                                           | Retroactive commands must remain usable at a reachable owner; readiness cannot depend solely on where a button is displayed.                                                  |

Overview → Timeline → Doors is a useful explanation of the ordinary workflow,
not sufficient engine ordering data. Special generation surfaces and repeated
encounter phases already provide the required finer-grained boundaries.

## Repair and mutation boundaries

The general policy is settled, but a cohesive implementation contract needs
to distinguish these operations rather than apply one blanket disabled flag:

- **Suffix authoring:** creation, replacement, deletion, and reordering are
  blocked behind required missing prefix input. There is no suffix-repair
  exception; completing the prefix is the way to unlock the suffix.
- **Repair at the blocker or its containing decision:** available, including
  changing the reward family, room, exit selection, or optional participation.
- **Earlier edits:** available; recompute readiness from the resulting snapshot.
- **Retained suffix inspection:** available without granting new authoring.
- **Timeline reordering:** evaluate at its owning chronology; moving/removing
  the action that caused the block remains a repair at the blocker, not an
  exemption for editing later actions.

Candidate validation must assess a proposed edit using the state up to that
edit's semantic pre-decision point. A locally legal prefix completion must not
be rejected merely because retained downstream authoring becomes invalid.
That would be a progressive-validation defect, not justification for permitting
suffix edits while the prefix is incomplete. Existing fixes in this area are
not evidence that every such defect has been eliminated; this remains a
focused regression risk for the future change.

Unavailable assessment alone cannot activate the incompleteness lock: the
engine must identify required missing prefix input, rather than treating an
invalid prefix or every other unavailable context as incomplete.

## Ownership and scope conclusion

Readiness belongs to the planner engine, derived from the authored snapshot,
catalog, and existing progressive products. The application should present
that result and navigate to its semantic prerequisite. It should not create a
parallel ordering model from tab indexes, rendered rows, or finding messages.

The current evidence supports reusing addressed chronology and pre-decision
contexts. It does not justify a persisted wizard cursor, a second execution
DAG, speculative future state, or additional simulation replay per control.

Stable documentation intentionally requiring permissive unassessed editing
must change with the behavior. Tests explicitly expecting enabled unreached
choices must be revised intentionally, not treated as incidental failures.
Retained-value visibility, exact finding navigation, and covered earlier
candidate assessment remain regression requirements.

The future change should cover semantic commands and bound interactions, not
only picker rendering: direct authoring paths currently bypass the proposed
policy. Loading a retained incomplete document is a separate operation and
must remain supported.

## Evidence limits

This is a source and existing-test audit, with the earlier Fields save probe
as a concrete reward-definition witness. No new full test run or interactive
cross-biome walkthrough was performed for this document. The cross-surface
inventory names required policy contacts; it does not claim every one is
currently broken in the same way.

Implementation and delivery gates are deliberately not specified here.
