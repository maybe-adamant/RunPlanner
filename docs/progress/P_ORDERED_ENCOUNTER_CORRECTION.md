# P Ordered Encounter Correction

## Status

Proposed replacement implementation plan, grounded on current code at
`a04d1fc4f3661338212109b2b77d639c37d8b952` and a direct reread of installed
Hades II Steam build `24556151`.

This plan supersedes and replaces the abandoned P composition plan. No code
from that attempted implementation remains in the worktree. This is a
temporary plan: Gate B must absorb the result into durable authorities and
delete this file.

Owning evidence and authorities:

- [`ENCOUNTER_SELECTION_AND_COMPOSITION_FINDINGS.md`](../audits/ENCOUNTER_SELECTION_AND_COMPOSITION_FINDINGS.md)
- [`KEEPSAKE_GAME_DATA_AUDIT.md`](../audits/KEEPSAKE_GAME_DATA_AUDIT.md)
- [`P_GAME_RULES.md`](../biomes/P_GAME_RULES.md)
- [`ROOM_LIFECYCLE_MODEL.md`](../design/ROOM_LIFECYCLE_MODEL.md)
- [`SIMULATION_AND_VALIDATION.md`](../design/SIMULATION_AND_VALIDATION.md)
- [`STRUCTURED_EDITOR_WORKSPACE.md`](../design/STRUCTURED_EDITOR_WORKSPACE.md)

## Objective

Correct P encounter timing by following the game's existing ordered-encounter
protocol instead of introducing a P-specific runtime composition model.

The delivered behavior is:

- normal P executes its selected precombat phase and selected terminal phase;
- Heracles uses the existing sequence-termination fact and executes alone;
- Fig Leaf skips enemy spawns across the already-prepared P sequence without
  deleting either phase or changing its lifecycle identity;
- encounter completion remains distinct from the later end-effects checkpoint;
- Chaos and Experimental Hammer advance only when end effects actually run;
- P exposes one atomic encounter editor even though its two exact source
  selections remain persisted; and
- the Room Timeline presents the selected phases clearly without inventing
  typed P-only lifecycle events or named presentation variants.

## Source model

The game uses one generic `MultipleEncountersData` protocol for O and P.
`SetupRoomMultipleEncountersData` selects and records positions in order. A
selected encounter with `BlockMultipleEncounters` stops construction. The room
runner later starts and completes every constructed encounter in order, then
sets `AllEncountersCompleted`; exits remain locked before that room-level seam.

P supplies two positions:

1. `PEncountersIntros` plus room-local precombat members;
2. `PEncountersDefault`.

`GeneratedP_PreCombat` is a real selected and completed encounter phase. It is
non-counting and declares `SkipEndEncounterEffects`, so it neither advances
encounter-use traits nor ends the room. `GeneratedP` becomes independently
unskippable when placed after another encounter through
`CanEncounterSkipIfNotFirst = false`.

`HeraclesCombatP` declares `BlockMultipleEncounters`; therefore the second
position is never constructed or recorded in that game room.

On a successful Fig Leaf roll at the precombat phase, the game marks every
constructed room encounter as spawn-skipped. Later members are marked as
multi-encounter propagation and do not consume another Fig Leaf use. Both
phases still start and complete. The precombat phase still suppresses end
effects; the terminal phase still runs them.

The corresponding observable matrix is:

| P result                          | Active sequence                     | Depth advances | End-effects checkpoints |
| --------------------------------- | ----------------------------------- | -------------: | ----------------------: |
| normal, Athena, Icarus, or Gorgon | precombat, terminal                 |              1 |          1, at terminal |
| Heracles                          | Heracles                            |              1 |                       1 |
| successful Fig Leaf               | skipped precombat, skipped terminal |              1 |          1, at terminal |

O is the control case. Its intro is also non-counting, but it does not suppress
end effects. Therefore O advances encounter-use traits at its intro and at
each later active combat. A correct implementation cannot equate end effects
with encounter depth or encounter kind.

## Existing code to preserve

Current HEAD already owns the source-backed structure:

- P persists exact `Intro` and `Combat` selections in the ordinary
  `RoomEncounterState`.
- encounter preparation evaluates the positions sequentially and records the
  accepted prefix before assessing the next position;
- the normalized `sequenceEffect: terminateSuffix` is the planner's bounded
  representation of `BlockMultipleEncounters`;
- normalized `skipEndEncounterEffects` carries the exact P precombat fact;
- `runEncounterSequence` executes the prepared active prefix in order;
- Fig Leaf resolves one phase-local selection and cascades a successful P skip
  through that active prefix; and
- phase addresses already own Fig Leaf at `Intro` and terminal NPC/Gorgon
  children at `Combat`.

These paths are not compatibility debt and must not be replaced by a P
composition descriptor, P lifecycle roles, a profile/preset model, or a second
runtime sequence.

## Gate A — end-effects checkpoint

Add one generic lifecycle distinction after `encounterCompleted`:

```text
encounterCompleted
  -> encounterEndEffectsApplied, only when the resolved encounter permits it
```

The lifecycle executor derives this solely from the resolved encounter's
existing normalized facts. It emits no end-effects event for NonCombat or
`skipEndEncounterEffects` phases. Execution being skipped by Fig Leaf does not
by itself suppress the event.

Preserve these orderings:

- ordinary phase: start -> optional depth -> completion -> end effects;
- Boss: boss defeated/Judgment -> completion -> end effects;
- normal P: precombat completion, then terminal completion/end effects;
- Fig Leaf P: skipped precombat completion, then skipped terminal
  completion/end effects; and
- Heracles P: one completion/end-effects pair.

Move only game consumers that are sourced from `EndEncounterEffects` to the new
event. In this slice those are encounter-counted Chaos curse maturation and
Experimental Hammer duration. Encounter history, encounter-owned trait offers,
Gorgon, local rewards, and other completion-owned products remain on
`encounterCompleted`. Existing declaration-owned room participation guards,
including the N side-room exclusion represented by
`advancesExperimentalHammerUses`, remain in force; the event does not replace
those facts.

No consumer may switch on biome P, `Intro`, `Combat`, Fig Leaf, or phase index.
The resolved encounter declaration and emitted event are the full contract.

Intended commit:

```text
fix(lifecycle): distinguish encounter end effects
```

### Gate A acceptance

1. Normal P records, starts, and completes precombat plus terminal, advances
   encounter depth once, and emits end effects only for terminal.
2. Heracles terminates the suffix through existing preparation and emits one
   counting completion plus one end-effects event.
3. Successful Fig Leaf consumes one use, keeps both P completion identities,
   marks both executions skipped, and emits end effects only for terminal.
4. Normal and Fig Leaf P advance an encounter-counted Chaos curse once.
5. Normal and Fig Leaf P advance every active Experimental Hammer instance
   once.
6. O intro plus every active O combat each emit end effects, proving the rule
   is not derived from encounter depth.
7. Boss Judgment remains before end effects; a final-use Barren curse matures
   only at the later end-effects checkpoint.
8. Athena/Icarus/Gorgon and encounter-local reward settlement remain at their
   existing exact terminal completion owner.
9. An architecture assertion or bounded source scan proves Chaos and Hammer
   contain no P/phase/Fig-Leaf timing policy.

Primary owners are lifecycle execution/model tests, Chaos trait timing,
Experimental Hammer timing, Fig Leaf, and one O ordered-sequence control.

## Gate A.1 — one P encounter editor

Keep persistence and simulation phase-based. Add only a narrow engine-owned P
authoring domain that mirrors game setup order:

- legal first-position candidates at the pre-room frontier;
- for each non-terminating first choice, legal second-position candidates
  after recording that first choice; and
- no active second position for a valid Heracles choice.

The product contains encounter identities and contextual support only. It does
not contain lifecycle variants, active phase presentation, labels, control
anchors, or UI grouping.

Add one atomic semantic command at P's existing `Intro` owner. A normal edit
replaces both exact persisted selections and initializes any newly activated
terminal child through existing encounter-default rules. A Heracles edit
changes the first selection and retains the dormant stored `Combat` value for
reversible planner authoring, while simulation continues to trim it through
the existing sequence rule. Context-invalid selections remain persisted and
repairable.

The application presents one encounter editor for P. It may show first and
terminal choices as two fields inside that one dialog, because the game makes
two sequential selections. Save dispatches one complete command and creates
one Undo unit. Other envelopes keep their existing phase-local controls.

The Room Timeline continues to consume the engine's active prepared phase
prefix. It may render catalog phase labels such as `Pre-combat`, `Combat`,
`Athena combat`, or `Heracles combat`, but it does not infer P variants or
rewrite lifecycle events. Fig Leaf retains both selected phases and their
skipped execution facts.

Intended commit:

```text
fix(editor): make P encounter editing atomic
```

### Gate A.1 acceptance

1. The domain follows sequential source preparation rather than assessing a
   flattened cross-product at one artificial frontier.
2. One dialog edits normal, Athena, Icarus, and Heracles outcomes.
3. Saving a two-position edit creates one history entry; Undo restores both
   selections and exact children.
4. Heracles publishes no active terminal choice while preserving dormant
   terminal state for a later edit.
5. A retained-invalid first or terminal selection remains visible with an
   exact repair path.
6. Fig Leaf, Gorgon, and terminal trait findings retain their existing semantic
   owners and navigation destinations.
7. O, Fields, single-encounter, and fixed encounters retain their current
   authoring products.

Primary owners are encounter command/history tests, the engine encounter
candidate domain, structured-workspace interaction binding, and one focused
`OccurrenceWorkbench` workflow.

## Gate B — durable absorption

After both code gates are stable:

- update the encounter-composition audit with the direct build-24556151
  confirmation;
- update P rules to distinguish phase completion, end effects, and whole-room
  completion;
- update Room Lifecycle and Simulation authorities with the generic
  end-effects checkpoint;
- correct Chaos, Experimental Hammer, Fig Leaf, and editor wording;
- record truthful validation in implementation progress; and
- delete this temporary plan.

Intended commit:

```text
docs(lifecycle): absorb ordered encounter effects
```

Run narrow owning tests during both code gates. Run broad precommit lanes once
after each intended code commit is frozen, and the complete repository closure
gate once after Gate B is stable.

## Explicit exclusions

- no project schema or catalog version bump;
- no checkpoint migration or fixture metadata refresh;
- no P composition descriptor, preset/profile payload, or variant enum;
- no `preCombatStarted` or `preCombatCompleted` lifecycle events;
- no deletion of the exact `skipEndEncounterEffects` source fact;
- no replacement of the generic ordered-encounter runner;
- no O, Fields, or single-encounter redesign;
- no combat-wave, probability, damage, or enemy-spawn simulation; and
- no Dream Dive, Shrine, Well, or unrelated Chaos feature work.

## Deletion and size guard

The abandoned implementation touched 78 files and added roughly 1,300 lines of
production churn. This replacement must stay centered on the existing
lifecycle event seam and the existing encounter editor/query neighborhoods.

Reject the gate if it introduces any of the following:

- parallel source and execution phase arrays;
- engine-owned presentation variants or control placement;
- consumer-side P timing branches;
- flattened candidate permutations stored as a new authored model;
- a generic encounter scripting DSL; or
- a schema bump for unchanged persisted data.

Success is measured by removal of the current P-specific Chaos clock exception,
one source-backed end-effects event, one bounded atomic editor path, and no
second lifecycle model.
