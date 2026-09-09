# Occurrence Authoring Boundaries

Status: Gates A and B complete; Gate C not started
Base: `7d39c264` (`fix(engine): preserve fixed boss authoring order`)

The earlier narrow `targetIndex` symptom fix was discarded before delivery.
Gate A replaces it with the occurrence-boundary correction below.

## Objective

Keep exact progressive evaluation unchanged, but normalize the engine's
authoring horizon immediately after one of two repairable regions for each
occurrence:

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

The Hermes-delivery witness then exposed a separate lifecycle defect at the
same occurrence. A reached Steady Growth or Transcendent Embryo threshold is an
automatic encounter-end effect. A matured Hermes delivery or Supply Chain drop
may create a physical pickup during the same native end-effect function, but
the pickup cannot affect those automatic outcomes because the player cannot
acquire it until the encounter phase has finished. Adding an unresolved Shrine
also broadens one finding region enough to publish an orphaned Steady Growth
finding without its exact candidate product.

That defect is not authoring-readiness policy and must not be hidden by a
feature-specific readiness exception. This plan therefore has a second focused
engine gate after the occurrence-boundary correction.

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

Adjust the existing `AuthoringHorizon` product so an incomplete horizon states
that authoring is blocked _after_ the normalized occurrence-interior or
outgoing-decision region. It must not present the start of the repairable region
as the first locked point. Do not add a second public cursor or make the
application derive this boundary.

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

1. Normalize the existing engine authoring horizon to begin after the
   repairable occurrence interior or outgoing decision.
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

## Gate B — Encounter-End Effect and Pickup Handoff

The durable cross-family evidence and current implementation assessment are
recorded in
`../audits/rooms-and-routes/SCHEDULED_AND_AUTOMATIC_TIMELINE_OUTCOMES_AUDIT.md`.
This gate closes only the open encounter-end scheduler findings from that
audit. Already-closed passive counters, boss Arcana contacts, Gift Gift Gift
replay, and native executor adapters are not reopened.

### Authoritative lifecycle

The reached lifecycle remains:

```text
encounterCompleted
  -> encounterEndEffectsApplied
       -> deterministic encounter-use clocks and expirations
       -> deterministic room-upgrade clocks
       -> authored Steady Growth / Transcendent Embryo outcomes
  -> afterEncounterPhase
       -> expose and acquire matured Supply Chain pickups
       -> expose and acquire matured Hermes Shrine deliveries
       -> continue later authored room actions
```

`encounterEndEffectsApplied` owns the complete automatic post-encounter state.
`afterEncounterPhase` owns the acquisition surface for objects produced by
those effects. Moving an acquisition frontier later does not move its producer
clock or change when the game creates the physical object.

The currently modeled encounter-end families are:

- Experimental Hammer use decrement and expiry;
- encounter-counted Chaos curse decrement and blessing maturation;
- encounter-duration Stygian Well state;
- Supply Chain progress and maturity;
- Hermes Shrine delivery progress and maturity;
- Steady Growth progress and rarity result; and
- Transcendent Embryo progress and blessing replacement.

Judgment and Crystal Figurine remain earlier `bossDefeated` effects. Quick
Buck, Buried Treasure, Bridal Glow, and other immediate trait consequences
remain acquisition effects. Native combat, health, Magick, keepsake experience,
and presentation-only encounter-end behavior remain outside simulation.

### Guard ownership

The event is not one all-or-nothing counter. Its effect families retain the
native declaration-backed guards:

- `IgnoreEncounterUses` suppresses Experimental Hammer, encounter-counted
  Chaos curses, pending Shrine deliveries, and encounter-duration Well items;
- `SkipRoomsPerUpgrade` suppresses Supply Chain, Steady Growth, and
  Transcendent Embryo; and
- `SkipTimedDropResources` defers a reached Supply Chain drop without losing
  its accumulated progress.

A Fig Leaf-skipped phase still advances every effect whose resolved phase
reaches end effects. `execution: skippedByFigLeaf` is not itself a delivery
clock suppressor. Noncombat and declaration-owned `skipEndEncounterEffects`
phases continue to emit no `encounterEndEffectsApplied` event.

N side rooms are the representative guard witness. All fifteen inherit
`IgnoreEncounterUses` and `SkipRoomsPerUpgrade`; none may advance either guard
family. Correct the remaining `N_Sub10` through `N_Sub15` Experimental Hammer
declarations and give Chaos and Well encounter durations the same normalized
encounter-use guard already consumed by Hammer and Shrine delivery behavior.
Do not add N-name checks to the transition.

### Engine product correction

1. Apply every automatic effect to the branch before publishing any generated
   pickup's acquisition frontier.
2. Carry reached Supply Chain maturities and due Shrine deliveries across the
   internal encounter-end/after-phase seam without settling either pickup.
3. At `afterEncounterPhase`, publish those acquisition frontiers against the
   complete post-effect branch and let the existing authored room-action order
   settle them.
4. Keep Supply Chain pickups optional and Hermes deliveries required. Do not
   add an order edge between independent pickups beyond the order the author
   selected.
5. Give Shrine inventory, automatic outcomes, and generated pickup placement
   distinct exact finding regions. A broad occurrence region must not make a
   later automatic finding visible without its candidate context and child
   settlement.
6. Retain each reached Steady Growth and Embryo outcome, its timeline fact,
   candidate context, and finding as one complete product through progressive
   clamping.
7. Make scheduled-acquisition invalidation source-complete. Removing a Shrine
   feature retracts every active delivery action sourced by that occurrence,
   including later hosts. Removing or replacing the upstream Supply Chain
   acquisition retracts every later active `clockedTraitGenerated` entry and
   action owned by that acquisition identity. Retained payload may remain only
   as dormant repair detail.
8. Preserve the canonical same-phase automatic order in every consumer:
   Steady Growth precedes Transcendent Embryo, matching simulation and the
   native deferred Embryo transformation. This remains fixed lifecycle order,
   not a movable Room Action or a speculative dependency edge.
9. Add one focused full-Surface execution-product fixture spanning N, O, P,
   and Q. Equip Transcendent Embryo at route start, acquire Epic Steady Growth
   from Demeter in N, acquire Supply Chain from Icarus in O, and schedule
   rushed and delayed deliveries from the forced N and O Postboss Shrines.
   Continue through P and Q so the fixture witnesses the later clocks,
   placements, selections, and route-tail state even though most positive
   outcomes originate in N and O. This is one product witness, not a family of
   miniature fixtures, and it must not add a protocol shape or executor-side
   scheduling policy.

This is an engine lifecycle and catalog-normalization correction. The
application consumes the corrected products and should need no Hermes-, Supply
Chain-, Steady Growth-, Embryo-, Fig Leaf-, or N-specific condition.

Intended commit: `fix(engine): preserve encounter-end effect ordering`

### Required witnesses

- A Steady Growth threshold and matured Hermes delivery in one phase expose the
  Steady Growth target before the delivery pickup, and the delivery acquisition
  observes the post-growth branch.
- The same ordering holds for a Transcendent Embryo transformation and a
  matured delivery.
- A Supply Chain threshold and Steady Growth threshold in one phase settle all
  automatic effects before either Pom Slice can be acquired.
- Adding or removing an unresolved Hermes Shrine in the room does not create,
  hide, or orphan an already-reached automatic outcome.
- A required delivery can be placed before a later unresolved incoming trait
  without consuming that incoming reward before its producer point.
- A Fig Leaf-skipped phase that reaches end effects advances a pending Shrine
  delivery; an end-effect-suppressed phase does not.
- Every N side room suppresses Experimental Hammer, encounter-counted Chaos,
  encounter-duration Well, Shrine delivery, Supply Chain, Steady Growth, and
  Embryo advancement while retaining ordinary encounter completion.
- Multi-phase O/P/H rooms apply the same contract independently at every phase
  that emits `encounterEndEffectsApplied`.
- Removing a Shrine source after placing one of its delayed deliveries removes
  the active later-host action in the same semantic edit. No unrelated Shrine
  delivery is moved or removed.
- Removing or replacing Supply Chain after accepting one of its matured Pom
  Slices removes that exact later entry and action. An unrelated clocked pickup
  remains intact, and a merely stale proposed command still fails exact
  attestation.
- The source-cleanup witnesses use normal authoring, simulation/candidate
  derivation, and the semantic placement command through a real qualifying
  lifecycle path; synthetic entry-key mutation may supplement but does not
  replace that coverage.
- A phase reaching both Steady Growth and Transcendent Embryo exposes and
  publishes them in that order. Neither appears in `roomActions.order`.
- The one checked-in N-through-Q lifecycle fixture contains reached Steady
  Growth and Embryo automatic transactions, an Icarus Supply Chain Pom Slice,
  and N/O Shrine delivery acquisitions. Encode/decode and fixture integrity
  preserve their exact owners and later P/Q hosts.
- The real `state3-schema79.json` Surface checkpoint loads through the complete
  application profile path without throwing. Its reached P `steadyGrowthOutcome`
  keeps an exact workspace destination even while the same occurrence contains
  unresolved Shrine/delivery authoring, and its contextual picker exposes the
  nine eligible traits carried by the engine capability and can settle one.
  Settling that outcome then permits the due delivery and producer-owned
  incoming reward in either authored order, and re-evaluates the complete
  project without a lifecycle insertion exception.
  This is an acceptance fixture, not only a transition-unit assertion.

Use focused lifecycle-transition, trait-level-effect, Hermes-delivery,
Experimental Hammer, Chaos, Well, Fig Leaf, and representative N/multi-phase
tests. Keep one policy owner per effect family; product-loop tests retain only
the supplied same-room workflow witness.

### Review requirements

Reject Gate B if it:

- moves the Supply Chain or Shrine delivery clock out of encounter-end effects;
- permits a generated pickup to mutate automatic effects from the checkpoint
  that created it;
- invents a special order edge between otherwise independent pickups;
- implements native effect scheduling a second time in the application;
- keys a counter guard on biome, room name, or presentation phase rather than a
  normalized source fact; or
- fixes an orphaned finding by fabricating UI candidate data;
- leaves a persisted scheduled acquisition active after its source disappears;
- repairs stale scheduler state in the execution-plan compiler or executor; or
- introduces a generic scheduler action shared by fixed automatic effects and
  concrete pickups.

## Gate C — Closure

After Gates A and B pass focused implementation and independent review:

1. Record the two-position authoring boundary in the smallest relevant design
   documents.
2. Update `IMPLEMENTATION_PROGRESS.md`.
3. Delete this temporary plan.
4. Run one complete `npm run check` for phase closure.

Intended commit: `docs(planner): close occurrence and encounter-end boundaries`

## Exclusions

- No authored persistence schema, migration, execution-plan, or game-executor
  change. Catalog contract edits are limited to correcting normalized source
  guards already established by the N side-room audit.
- No persisted cursor, wizard state, broad automatic repair, or suffix pruning.
  Gate B permits only exact source-owned retraction of scheduled acquisition
  actions whose authorizing Shrine or Supply Chain source was removed.
- No redesign of topology, exact chronology, candidate legality, Hub behavior,
  or finding navigation.
- No broad React refactor or restyle.
