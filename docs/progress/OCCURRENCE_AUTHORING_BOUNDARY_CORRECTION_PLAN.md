# Occurrence Authoring Boundaries

Status: locked implementation contract; implementation not started  
Base: `7d39c264` (`fix(engine): preserve fixed boss authoring order`)

The worktree contains a narrow `targetIndex` symptom fix in
`simulation/progressive/finding-location.ts` and its test. Gate A replaces that
work; it is not independently deliverable.

## Objective

Keep exact progressive evaluation unchanged, but normalize the engine's
authoring horizon to one of two positions for each occurrence:

```text
Occurrence interior  ->  Outgoing decision
```

- If required input is missing inside an occurrence, that whole occurrence is
  editable and its outgoing decision is locked.
- If the occurrence is complete but its outgoing decision is incomplete, that
  whole decision is editable and the next occurrence is locked.
- Completing the decision advances the horizon to the selected occurrence.

Earlier occurrences and decisions remain editable. Later ones remain visible
but cannot mutate.

This is only an edit-permission change. Exact findings still point to exact
fields, and exact simulation and candidate evaluation still stop at the exact
missing input.

## Why

The supplied saves expose one overly precise locking policy in three forms:

1. Adding Chaos while an outgoing reward pool was incomplete made controls in
   that same decision unusable.
2. Selecting Chaos and leaving its trait unresolved disabled navigation from
   the already-authored prior decision.
3. A required Hermes delivery could not be placed because its future room
   action had no exact timeline index yet.

These are not three feature defects. Authoring readiness is using internal
target and timeline positions where it only needs the occurrence boundary.

## Locked Policy

Only incompleteness establishes this authoring horizon. Invalid findings keep
their existing validation meaning and do not lock a later authoring region.

### Route-start prefix

Loadout is the one pre-occurrence authoring region. Missing required loadout
input leaves loadout editable and locks creation or editing of the first
occurrence.

After loadout is complete, an Opening or Intro room is the first ordinary
occurrence interior. F's selectable Opening room, N's fixed Opening room, and
the fixed Intro rooms of later biomes all use the same boundary rule. Missing
input in that room leaves its complete interior editable and locks its outgoing
decision.

### Occurrence interior

Once its incoming decision is complete, Overview, encounters, acquisitions,
traits, spells, required placements, optional actions, repairs, and legal
timeline ordering in that occurrence are one editable region.

A later picker may still lack a truthful candidate state until an earlier
action is resolved. That picker remains unavailable for that reason, but the
room is not globally locked. Existing command validation and timeline
dependencies continue to reject illegal edits.

### Outgoing decision

The outgoing decision becomes editable after the occurrence interior is
complete. Its batch setup, rooms, rewards, additional exits, and selected exit
are one authoring region.

Existing candidate products retain their intrinsic order: for example, a
reward cannot be authored before its room exists. The global authoring horizon
does not separately lock target 1, target 2, or an additional exit.

Source-room feature controls such as adding Chaos belong to the occurrence
interior. Choosing an authored exit belongs to the outgoing decision.

### Navigation

Rail, tab, finding, and `Open next room` navigation are not authored mutations.
They remain usable whenever their destination exists.

### Special topology

N Hub and side-room visits, O multi-phase rooms, H Fields rooms, and fixed
Preboss/Boss/Postboss chains keep their existing occurrence identities and
chronology. They receive the same two-position boundary policy; this gate does
not redesign them.

## Engine Change

Adjust the existing `AuthoringHorizon` product so an incomplete horizon names
the normalized occurrence-interior or outgoing-decision boundary. Do not add a
second public cursor or make the application derive this boundary.

`authoringReadinessAt` compares the semantic owner being edited with that
normalized boundary. It no longer compares exact positions within the active
occurrence or decision.

Keep `roomTimelineIndex`, `targetIndex`, `additionalIndex`, and other exact
locations for the engine work that needs them:

- progressive simulation and prefix retention;
- finding order and exact repair destinations;
- candidate evaluation at an exact point; and
- command and lifecycle validation.

They do not participate in global authoring readiness. In particular, React
does not need a `targetIndex`; it continues asking the engine whether a
semantic owner is editable.

Route-start/loadout readiness remains as it is. The narrow worktree change that
fabricates or adjusts a `targetIndex` to fix one batch is removed.

## Application and React

The application continues to consume `authoringReadinessAt`; it does not gain
an occurrence comparator or new UI state.

React work is verification-first and expected to be zero or minimal. Existing
controls should inherit the corrected engine result. Only detach a navigation
control from an authoring-disabled container if it remains inert after the
engine correction.

Exact finding borders and focus destinations remain unchanged. Do not add
Hermes-, Chaos-, trait-, action-, or biome-specific readiness rules.

## Gate A — Boundary Correction

1. Normalize the existing engine authoring horizon to occurrence interior or
   outgoing decision.
2. Make `authoringReadinessAt` use only that coarse boundary.
3. Preserve exact progressive evaluation, findings, candidates, and command
   validation.
4. Remove the narrow `targetIndex` symptom fix and replace its test with the
   boundary witnesses below.
5. Apply only any proven minimal navigation adjustment in React.

Intended commit: `fix(planner): enforce occurrence authoring boundaries`

### Required witnesses

- Incomplete loadout leaves loadout editable and locks both creation and editing
  of the first occurrence.
- An incomplete F or N Opening room leaves that Opening occurrence editable and
  locks its outgoing decision.
- An incomplete fixed Intro room in a later biome behaves like any other entry
  occurrence and locks its outgoing decision, not its own interior.
- Missing input within a reached occurrence leaves all same-occurrence repairs
  and legal edits available, while its doors stay locked.
- The required Hermes delivery can be placed and reordered before a later
  unresolved room trait; the later trait publishes no false candidates.
- An incomplete outgoing batch leaves all controls in that decision available
  while the next occurrence stays locked.
- Existing room-before-reward and offer-before-selection products still govern
  their own candidates without authoring readiness using `targetIndex`.
- Selecting Chaos and leaving its trait unresolved keeps the Chaos occurrence
  editable, the prior decision editable, and `Open next room` usable.
- Earlier edits recompute the downstream boundary.
- Invalid authored values do not act like missing required input.
- Representative N Hub/side-room, O multi-phase, H Fields, and fixed
  Preboss/Boss/Postboss cases preserve their occurrence boundaries.
- Direct Redux dispatch cannot mutate a genuinely later region or add history.

Use focused engine readiness and progressive-candidate tests plus only the
smallest representative planner/UI witnesses. Do not reproduce the engine
matrix in React tests.

## Review Requirements

Reject the gate if it:

- weakens exact progressive evaluation;
- leaves exact target or timeline indexes in authoring-readiness policy;
- duplicates occurrence ordering in the application;
- treats candidate unavailability as a global authoring lock;
- disables navigation with authored controls;
- adds feature-specific readiness exceptions; or
- creates a second authoring cursor instead of simplifying the existing
  horizon.

## Gate B — Closure

After Gate A passes focused implementation and review:

1. Record the two-position authoring boundary in the smallest relevant design
   documents.
2. Update `IMPLEMENTATION_PROGRESS.md`.
3. Delete this temporary plan.
4. Run one complete `npm run check` for phase closure.

Intended commit: `docs(planner): close occurrence authoring boundaries`

## Exclusions

- No schema, migration, catalog, execution-plan, or game-executor change.
- No persisted cursor, wizard state, automatic repair, suffix pruning, or
  destructive cleanup.
- No redesign of topology, exact chronology, candidate legality, Hub behavior,
  or finding navigation.
- No broad React refactor or restyle.
