# Mandatory Room Action Defaults Implementation

## Status

Locked focused implementation plan on clean base
`508fe5516363557b2a54f9bbbfa1a13e5dbcc0e0`.

A fresh read-only adversarial review challenged the action matrix, command
boundary, retained-invalid behavior, test ownership, and deletion scope. Its
accepted corrections are incorporated: malformed prerequisite omissions remain
repair state, Fields Passive owns its entry barrier, retained rows preserve
relative sequence rather than numeric rank, Fields peer reconciliation is
limited to structurally active occurrences, fixture order transforms cannot
remove required rows, and Ephyra timing is attributed to lifecycle authority.
The final review disposition is `READY`, with no remaining P1/P2 finding.

This is a temporary delivery authority. It is not linked from `README.md` or
from stable design documents. The final closure gate must absorb the completed
model into the smallest durable authorities, update the implementation record,
and delete this plan.

Owning evidence and stable authorities:

- [`ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md`](../audits/ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md)
- [`ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md`](../audits/ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md)
- [`ROOM_LIFECYCLE_MODEL.md`](../design/ROOM_LIFECYCLE_MODEL.md)
- [`AUTHORED_PROJECT_MODEL.md`](../design/AUTHORED_PROJECT_MODEL.md)
- [`EDITOR_MODEL.md`](../design/EDITOR_MODEL.md)
- [`STRUCTURED_EDITOR_WORKSPACE.md`](../design/STRUCTURED_EDITOR_WORKSPACE.md)

No new game-data audit is required. The existing audits establish mandatory
participation and the separation of optional object identity, participation,
and chronology. `ROOM_LIFECYCLE_MODEL.md` and its direct lifecycle fixtures own
the exact phase barriers and Ephyra Opening's pre-Start pickup. This delivery
changes the planner's default authoring policy to match those settled stable
authorities.

## Objective

Remove routine manual insertion of actions the player cannot omit.

When a supported Room Action becomes structurally active and the engine
classifies it as `required`, the same semantic command that activates it must
place its exact reference in the occurrence's sole `roomActions.order` at the
latest legal lifecycle position. The player may reorder it within the
engine-published legal range but cannot remove it while it remains active and
required.

The user-visible result is:

```text
room or required object becomes active
  -> its required action already appears at the latest legal point
  -> user moves it only when an earlier chronology is intended

optional object exists
  -> it remains absent until the user chooses participation
  -> its existing specialized or generic participation control remains

retained document is missing a required action
  -> it remains explicitly incomplete and repairable
  -> one engine-owned restore action places it at the canonical late point
```

Normal authoring must no longer produce an `unrankedRequired` row and ask the
user to choose an insertion position for a routine pickup, NPC interaction,
cage, wheel, or required generated object.

## Current Live Discrepancy and Baseline

The persisted schema already has the right single authority:
`RoomOccurrence.roomActions.order`. The engine also already publishes
`RoomActionContribution.participation` as the closed `required | optional`
classification, plus lifecycle windows, dependencies, rows, findings, and
proposals.

The default path contradicts that model:

- `createEmptyRoomActionState()` gives every new occurrence an empty order;
- creation, replacement, encounter, reward, phase-count, Gorgon, Echo, and
  Artificer commands can activate required contributions without inserting
  them;
- roster assembly reports each omission as `unrankedRequired` and publishes a
  full insertion-position menu;
- React renders that menu even though the game does not allow the action to be
  skipped; and
- `RemoveRoomAction` still accepts direct removal of an active required row,
  although the current UI does not offer it.

Tests compensate through `authorRequiredTestRoomActions`. That helper
materializes every configured biome, reconstructs contribution products from
the roster, repeatedly searches insertion proposals, rewrites the document,
and decodes it again. It appears in 26 TypeScript test/support files with 80
symbol occurrences. This is duplicate test-only default policy and a material
fixture-cost source; it must not survive as the normal way to produce a valid
project.

## Locked Modeling Decisions

### 1. `required` is the only default-participation predicate

The change applies exactly to an active engine contribution whose
`participation` is `required`. React does not infer mandatory behavior from a
reward type, row label, absence of a Remove proposal, room kind, or finding.

This change does not turn every game required object into a new authored Room
Action. Existing lifecycle-only barriers, notably N's Soul Pylon, remain fixed
lifecycle operations unless a separate source-backed feature deliberately adds
a player action later.

### 2. `roomActions.order` remains the sole chronology

Required references are persisted in the same occurrence-owned order as every
participating optional action. There is no derived mandatory sub-order, hidden
required set, UI-side insertion ledger, normalized mirror, or second Fields/O
chronology.

The engine may derive a default schedule, but the completed result is the
ordinary persisted order. Existing history, simulation, validation, Run State,
workspace, and React products consume that one order unchanged.

### 3. Structural activation is authored truth, not evaluation reach

An action is eligible for default insertion when its occurrence and exact
owner are active in the proposed authored structure:

- the route start;
- the selected ordinary or additional continuation occurrence;
- an N main occurrence in Hub visit order;
- an N side occurrence in its parent `LocalVisitDecision` order; or
- another occurrence explicitly activated by its existing topology contract.

Within that occurrence, the engine uses authored phase count, selected
encounter, Fields cage scope, incoming producer state, Gorgon condition, pickup
producer, acquisition disposition, and other existing structural facts.

An earlier invalid or incomplete evaluation does not prevent defaults for a
retained authored continuation. Conversely, an unselected peer, unopened Hub
slot, generated-but-unvisited side room, dormant O phase, dormant pickup, or
restored persistent Hub does not gain an active default merely because its
payload is retained.

### 4. One engine-owned action-domain product serves commands and simulation

Required/optional classification, stable action identity, active scope,
lifecycle window, dependencies, and default scheduling must have one planner-
engine authority. The current structural-reference and simulation-contribution
paths must be factored so semantic commands and roster/timeline materialization
consume the same complete product.

The command layer must not import or run full project simulation,
materialization, progressive evaluation, candidates, findings, or application
projection. Simulation must not keep a second required/optional classifier
after the shared product exists. Application and React receive only the
resulting authored order and supported projections.

The product is explicit and immutable. It is not a callback registry, sidecar
map keyed by a roster, module-initialization effect, or mutable service table.

### 5. Required closure is part of the activating semantic command

`applyProjectCommand` must publish one decoded next document containing both
the requested semantic edit and the required-action delta caused by that edit.
`ProjectHistory` therefore records one history entry, and Undo restores the
exact pre-edit document in one step.

The reconciliation compares the exact active required domains before and after
the proposed command:

- a newly active required key is inserted if absent;
- already ranked retained keys keep their exact relative sequence; their
  numeric ranks may shift when a new earlier-window action must be inserted;
- a required key that was already missing before an unrelated edit remains
  missing and repairable;
- a newly created occurrence seeds all of its active required keys; and
- a multi-occurrence topology or Fields command closes every newly activated
  owner atomically.

There is no second React dispatch and no post-render repair effect.

### 6. Default insertion is the latest legal extension

The default scheduler preserves every existing authored reference and its
relative order. It adds only newly active required references.

For one required reference, the default destination is the greatest position
that satisfies its exact lifecycle window, checkpoint constraints, and active
dependencies without introducing a new violation. An unrelated pre-existing
dependency, stale-row, or window finding must not make all default positions
unavailable.

For a cohort activated together, the engine produces one deterministic late
schedule:

1. retain the existing authored order verbatim;
2. establish the fixed lifecycle skeleton and dependency graph;
3. place prerequisites before dependents;
4. place each new action as late as its own constraints permit; and
5. use declaration/contribution order and stable semantic action key only as
   deterministic tie-breakers.

Taking the maximum of today's `structurallyAuthorable` insertion proposals is
not sufficient. Those proposals assess the whole order and become unavailable
under unrelated retained invalidity. Repeated greedy append is also
insufficient for simultaneously activated Fields cages, blocking contacts, or
Ship phase actions.

A pre-existing missing required prerequisite does not block a newly activated
dependent. The scheduler places the dependent at its canonical late window,
keeps the old prerequisite omission and its findings, and leaves a position at
which that prerequisite can later be restored. It neither repairs the old
omission nor rejects the otherwise structurally representable activating
command.

Only a contribution graph that is internally impossible from a clean closed
cohort is an invariant/command failure. Retained missing, stale, dependency, or
window errors are authored repair state, not grounds for rejecting an
unrelated structurally valid transition.

### 7. Fields defaults use the fixed cage skeleton

For a newly active Fields room, the default cage permutation uses declaration
order. Each `completeFieldsCage` occupies one atomic Start/End cage cycle.
Phase-produced blocking contacts are placed after their producing cage and
before the next cage. Required cage rewards and required descendants that do
not block a later cage are deferred to the final Cleanup when legal.

Fields `Passive` is entry evidence, not another cage cycle. A required Passive
NPC or Gorgon contact is available at Room Entered and must resolve before the
first cage; the scheduler must not invent Passive Start/End encounter
boundaries.

Existing authored cage permutations and interleavings are never normalized.
Changing the active cage scope inserts only newly active required actions.
Dormant retained actions keep their authored position and reappear there when
the same key becomes active again.

### 8. O defaults honor repeated phase barriers

Wheel 1 choice is placed at the Intro-to-Combat-1 start boundary. Its pickup
and required phase contacts are placed after Combat 1 and before
`nextPhaseUsable:wheel1`. When Combat 2 becomes active, Wheel 2 choice is placed
after that barrier and immediately before Combat 2; its pickup and required
contacts are placed after Combat 2 and before final Cleanup/outgoing.

Reducing encounter count retains now-dormant rows under the existing repair
contract. Restoring the phase reuses their retained ranks; it does not append
duplicates.

### 9. Lifecycle-profile timing overrides coarse reward aliases

Default placement follows the exact lifecycle profile, not a generic
`roomRewardPickup -> standard afterCombat` mapping.

In particular, `EphyraOpeningRoom` advances its incoming producer before its
delayed `OpeningGeneratedN` encounter. The required Opening pickup must
therefore appear before Start encounter. This source-backed correction is part
of the gate because a canonical latest scheduler cannot truthfully retain the
current coarse after-combat contribution.

Devotion chosen remains before combat and spurned remains after combat. N main
and side occurrences use their own local chronology; restoring a parent or Hub
does not replay or create another action schedule.

An encounterless occurrence, including the selected Natural Chaos occurrence,
uses its declaration-owned producer and return lifecycle. Its required incoming
reward is placed at the latest Cleanup/pre-return point; the scheduler must not
invent Start/End encounter boundaries merely to reuse a Standard-room window.

### 10. Optional participation remains explicit

Optional contributions are never inserted by this default scheduler.

- Base Shop offers remain controlled solely by Overview `Purchased`.
- Fields optional minor rewards remain independently optional.
- Narcissus pickups remain optional.
- Travel Deal refill, Gold duplicate, and the Infernal Contract pedestal keep
  their existing supplemental participation paths.
- An Artificer replacement inherits its source participation: a required
  source produces a required replacement; an optional source does not become
  mandatory merely because Artificer produced an object.

Once an optional action participates, its existing move/removal semantics
remain. Relocating every optional toggle into Overview is outside this plan.

### 11. Active required actions cannot be generically removed

`RemoveRoomAction` rejects removal when the exact current active contribution
is required. This invariant belongs to the engine command, not only to the
absence of a React button.

`InsertRoomAction` remains available for an explicitly retained malformed or
missing-required document. A stale row may still be removed. Optional rows
retain their current generic or specialized membership commands, including
`ReplaceShopPurchaseParticipation`.

### 12. Deactivation preserves retained authorship

This delivery does not silently delete or reorder a reference merely because
an upstream edit makes it inactive. The existing dormant/stale repair contract
continues:

- reactivation of the same key reuses its retained rank;
- a replacement that activates a different required key inserts the new key
  while the old incompatible key remains explicit repair state;
- explicit topology deletion still deletes the occurrence and its owned order;
  and
- a specialized optional participation command continues removing only its
  exact optional reference.

This is intentionally asymmetric: activation guarantees mandatory membership;
deactivation does not erase retained-invalid evidence.

### 13. Missing-required documents remain structurally representable

Schema 48 and the strict codec remain unchanged. The codec continues to accept
an occurrence whose order omits an active required reference, and evaluation
continues to report that omission as incomplete.

Normal semantic commands must not create a new omission, but loading a saved,
minimized, or deliberately malformed document does not trigger silent
normalization. A subsequent unrelated command does not repair it. The explicit
repair path uses the same engine-owned canonical late placement.

### 14. Required repair is one action, not a position-authoring task

Normal required rows are already ranked and expose only valid movement.
They expose no generic Remove action and no Position selector.

For an explicitly missing required row, the engine publishes one canonical
restore proposal/intent for its late position. The application labels that as
required-action repair. It must not choose the last proposal locally or show a
menu asking the player to author a default the engine already owns.

Optional unranked rows may retain their existing participation controls. The
gate does not remove global drag, keyboard movement, semantic focus, findings,
or retained stale repair.

## Required and Optional Matrix

| Existing action family                      | Participation | Canonical latest default when active                                                                                                 |
| ------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Standard/N incoming reward role             | required      | exact profile-owned producer point; ordinarily after Encounter End and before outgoing, but Ephyra Opening is before Start encounter |
| Devotion chosen/spurned roles               | required      | chosen immediately before Start encounter; spurned after Encounter End and before outgoing                                           |
| Standard/O/cage encounter NPC trait contact | required      | after its exact Encounter End; before the next Fields cage/O phase barrier or final outgoing                                         |
| Fields Passive NPC/Gorgon contact           | required      | from Room Entered and before the first cage, with no invented Passive Start/End cycle                                                |
| Positive non-Passive Gorgon Athena contact  | required      | same phase-local barrier as its hosted encounter contact                                                                             |
| Fields cage completion                      | required      | its declaration-default or retained authored cage cycle                                                                              |
| Fields cage reward                          | required      | after its cage; final Cleanup unless a tighter dependency requires earlier placement                                                 |
| Fields optional minor                       | optional      | never defaulted                                                                                                                      |
| O wheel choice                              | required      | immediately before its matching combat starts                                                                                        |
| O wheel pickup                              | required      | after its matching Encounter End; before next-phase barrier or final Cleanup                                                         |
| Required producer pickup entry              | required      | after its source at the latest legal point in the exact acquisition-site window                                                      |
| Required Artificer replacement              | required      | after its source, inheriting source window and constraints                                                                           |
| Optional Artificer replacement              | optional      | never defaulted                                                                                                                      |
| Base Shop offer                             | optional      | Overview Purchased continues to append/remove it in the post-outgoing window                                                         |
| Narcissus/supplemental optional entry       | optional      | never defaulted; existing participation path remains                                                                                 |

The matrix is closed over the current `RoomActionReference` union. New Wells,
Hermes Shrine interactions, resources, or other future actions must declare
their participation and exact lifecycle window when implemented; this plan
does not anticipate them with generic placeholders.

## Activation Command Coverage

The shared reconciliation must cover the following existing semantic
transitions without adding command-specific participation policy:

- occurrence creation through `CreateStart`, `CreateTarget`,
  `InitializeExitDecision`, takeover creation/replacement/reconciliation,
  `OpenHubSlot`, `AddZagreusContract`, and `AddNaturalChaos`;
- topology selection and visit changes that make an existing occurrence
  structurally entered;
- `ReplaceOccurrenceRoom`, Anomaly switch/map/success/revert, and natural-Chaos
  map replacement;
- `ReplaceIncomingReward` when an acquisition role becomes active or its exact
  role/reference set changes;
- `ReplaceFieldsCageOutcome` for every affected structurally active/entered
  Fields occurrence, never an unselected peer;
- `ReplaceShipEncounterCount` when an O phase becomes active;
- `SelectEncounter`, `ResetEncounter`, and
  `ReplaceGorgonDeathDefianceCondition`;
- `ReplaceTraitOffer` and `ReplaceTraitSelection` when they activate or
  reactivate a required selected-pickup producer such as Echo Last Reward; and
- `ReplaceAcquisitionDisposition` when a required Artificer replacement
  becomes active.

Commands that edit only a payload without changing action identity or
participation must not churn the order. Shop participation remains owned by
its specialized command.

## Included Scope

- one pure engine-owned active action-domain/default-schedule product;
- atomic required closure for every current activation transition;
- exact latest-point scheduling across Standard, Fields, Ship, N occurrence,
  and post-outgoing windows;
- Ephyra Opening's already-documented pre-encounter reward timing correction;
- active-required removal rejection and canonical missing-required repair;
- application projection/binding and React presentation of the repaired
  contract;
- direct command/history, lifecycle, simulation, projection, UI, and
  representative product witnesses;
- removal of normal fixture dependence on
  `authorRequiredTestRoomActions`; and
- durable documentation/progress absorption and temporary-plan deletion at
  closure.

## Explicit Exclusions

- no persisted schema or codec-version change;
- no automatic normalization on load or decode;
- no second purchase/participation set;
- no change to Shop Purchased semantics;
- no relocation of all optional participation controls into Overview;
- no change to Travel Deal, Gold Gold Gold, Contract, Narcissus, or Fields
  optional eligibility/payload rules;
- no Well, Hermes Shrine, delayed-delivery, resource, or new Room Action
  implementation;
- no action for N Soul Pylon or another lifecycle-only barrier;
- no change to N Hub board generation, visit authority, or restoration;
- no flattening of O phase or H cage boundaries;
- no UI-side required classification or order calculation; and
- no broad test-suite consolidation beyond deletion of the superseded required-
  action completion path and directly stale witnesses.

## Gate A — Complete Mandatory-Default Vertical Slice

### Objective

Land one coherent behavior commit in which every production semantic command
that newly activates a required action also publishes its canonical late
placement, while optional participation and retained-invalid state remain
unchanged.

### Engine authority

1. Factor the current active-reference and contribution policy into one pure
   structural action-domain product usable by authored commands and
   materialization/roster assembly.
2. Add the deterministic late scheduler and a local-delta validity rule that
   does not require unrelated retained chronology to be valid.
3. Reconcile the before/proposed domains inside the top-level semantic-command
   transaction and decode only the complete result.
4. Reject direct removal of an active required row while preserving optional
   and stale removal.
5. Publish one canonical restore proposal for a pre-existing missing required
   row.
6. Correct Ephyra Opening contribution timing to the profile-owned
   pre-encounter point.
7. Delete the superseded duplicate required/optional classification or
   placement path in the same commit.

The implementation may use internal checkpoints while developing, but Gate A
is one commit because engine defaults, command atomicity, application
interaction, and tests are not independently correct products when split.

### Application and React

- Consume engine-published ranked rows, movement proposals, and canonical
  repair intent.
- Do not render Position for a normal required action.
- Render one direct restore control for a deliberately missing required row.
- Keep required rows move-only, optional participation controls unchanged, and
  stale repair exact.
- Preserve semantic markers, finding navigation, tabs, drag/keyboard ordering,
  and one-command Undo/Redo.

### Fixtures and test support

- Remove `authorRequiredTestRoomActions` and normal imports/calls after
  production commands own the default.
- Rewrite `replaceTestRoomActionOrder` as exact membership deltas plus
  `MoveRoomAction`; it must reject a requested order that omits an active
  required reference and must never clear the order through
  `RemoveRoomAction`. Keep that focused transform only where chronology itself
  is the behavior under test.
- Construct missing-required input explicitly in the narrow codec/command/UI
  repair owners; do not retain a broad automatic completion helper.
- Do not mass-normalize the 14 readable schema-48 JSON checkpoints. Their 443
  occurrences and 321 nonempty orders are authored fixture intent. Update a
  checkpoint and manifest hash only when its named scenario deliberately
  changes.
- Run `npm run test:fixtures:check`; do not reintroduce a command-replay fixture
  builder or generation lane.

### Primary acceptance witnesses

1. A newly created Standard selected room with a resolved required incoming
   reward already contains its pickup at the latest pre-outgoing point.
2. N Opening's pickup is before Start encounter; N PreHub/main/side timing
   remains occurrence-local, and Hub restoration creates no duplicate action.
3. Selecting/resetting a trait-producing encounter and toggling Gorgon adds
   only newly required contacts, atomically, with one Undo.
4. A new Fields room defaults to declaration cage order, places every cage
   completion, defers ordinary cage pickups to final Cleanup, and places a
   Passive blocker before the first cage and a cage-produced blocker before
   the next cage without inventing a Passive cycle. A retained authored
   permutation is unchanged, and an affected but unselected Fields peer gains
   no default rows.
5. Increasing O from two to three phases inserts Wheel 2 choice/pickup at exact
   phase boundaries without moving existing rows; Undo restores the two-phase
   document exactly. Reducing/restoring reuses retained ranks.
6. Activating a required Echo pickup or required Artificer replacement inserts
   it after its exact source; the optional equivalents remain absent.
7. Shop purchases, Fields optionals, Narcissus, Travel, Gold, and Contract
   optional participation are unchanged.
8. Direct `RemoveRoomAction` rejects an active required row, while a stale row
   and optional non-Shop row remain removable through their owning paths.
9. A decoded document already missing a required row stays incomplete after an
   unrelated edit and exposes exactly one canonical restore action; applying
   it and Undo each take one history step.
10. A newly activated required cohort is inserted even when another retained
    row has an unrelated dependency/window finding; that finding remains.
11. Activating a required dependent whose direct required prerequisite was
    already missing inserts only the dependent at its canonical late window,
    retains the prerequisite omission/finding, remains repairable, and does
    not reject the semantic command.
12. No structurally active occurrence in an ordinary command-created
    representative across F/G/H/I/N/O/P/Q contains `unrankedRequired`.
13. The normal UI workflow reaches Room Actions with required rows already
    ranked, exposes movement but no insertion/removal busywork, and performs no
    evaluation work merely to open the workbench.

### Primary test owners

- `packages/planner-engine/test/authored-project/commands/room-actions.test.ts`
  owns membership, active-required removal, atomic activation, repair, and
  history.
- Existing topology, incoming-reward, encounter, Ship, Fields, detour, trait,
  and acquisition-disposition command suites own their exact activation
  contact.
- `packages/planner-engine/test/simulation/room-action-timeline.test.ts` and
  `lifecycle.test.ts` own late placement and fixed boundary order.
- H materialization, O validation, Gorgon, Echo, Narcissus, and Artificer tests
  own their policy matrices; application tests do not copy them.
- Occurrence assembly and interaction binding own the projected canonical
  repair intent.
- `OccurrenceWorkbench.test.tsx` owns ranked/move-only presentation and the one
  malformed repair workflow.
- One product workflow owns representative creation/activation/Undo contact;
  product tests do not repeat the biome matrix.

### Deletion proof

Before Gate A freezes, verify:

- the `authorRequiredTestRoomActions` implementation and export are deleted,
  and no normal fixture/support consumer imports or invokes it;
- no production command or application component duplicates the
  required/optional matrix;
- no React effect or chained dispatch inserts a required action;
- no second authored or derived required-action order exists;
- no normal required row renders a Position selector or Remove action; and
- simulation consumes the same structural action-domain product as command
  reconciliation.

### Validation

During implementation use the smallest owning command, lifecycle, H/O,
projection, binding, and React lanes. Before freeze run:

- all workspace typechecks;
- `npm run test:engine`;
- `npm run test:planner`;
- `npm run test:contract`;
- `npm run test:product`;
- `npm run test:ui`;
- `npm run test:fixtures:check`;
- lint, format check, production build, and `git diff --check`.

Record declared timeout failures separately from diagnostic headroom; do not
change test timeouts or worker counts as part of this behavior gate.

### Commit boundary

One coherent `feat:` commit after a fresh executor, independent adversarial
review, bounded remediation, and main-session holistic review.

## Gate B — Durable Closure

### Objective

Perform one fresh closure audit, absorb the landed invariant into durable
authorities, record exact validation and deletion results, and remove this
temporary plan.

### Durable documentation

Update only the owning passages in:

- `AUTHORED_PROJECT_MODEL.md` for command-created mandatory membership,
  retained missing-required state, and no schema bump;
- `ROOM_LIFECYCLE_MODEL.md` for the canonical late scheduler and exact Ephyra
  Opening placement;
- `EDITOR_MODEL.md` and `STRUCTURED_EDITOR_WORKSPACE.md` for move-only required
  rows and canonical malformed-state repair;
- `ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md` planner disposition without erasing
  source evidence; and
- `IMPLEMENTATION_PROGRESS.md` with commits, review findings, deletion/growth
  accounting, performance disposition, and truthful final validation.

Do not add this temporary plan to `README.md`. Delete it in the closure commit
after every durable owner is truthful.

### Closure audit

Confirm:

- catalog -> pure engine <- application/React direction;
- one persisted order and one structural action-domain/scheduler authority;
- no simulation/evaluation invocation from the command layer;
- no normalization on decode/load;
- no missing normal creation/activation transition;
- no hidden removal of dormant/stale authorship;
- optional participation and Shop Purchased are unchanged;
- required repair remains reachable for deliberately malformed input;
- test helpers no longer implement production default policy; and
- production/test growth is explained by deleted duplicate setup and policy.

### Final validation

After Gate A and bounded closure remediation are stable, run `npm run check`
exactly once. Record the truthful result in `IMPLEMENTATION_PROGRESS.md`,
including any fixture-duration failure and isolated diagnostic. Do not rerun
the complete gate merely to alter prose.

### Commit boundary

One coherent `docs:` closure commit, or `fix:` only if the fresh closure audit
finds a bounded product defect intentionally included after review.

## Adversarial Review Checklist Before Lock

The plan reviewer must answer with live evidence:

1. Do the existing audits establish mandatory participation, while
   `ROOM_LIFECYCLE_MODEL.md` and direct lifecycle fixtures establish every
   timing rule used here, including Ephyra Opening, without a new source audit?
2. Can one pure structural product serve both command reconciliation and
   simulation without a command -> simulation/materialization dependency?
3. Does authored traversal activation cover ordinary/additional selection,
   Hub visits, and local visits without relying on progressive reach?
4. Can the late scheduler preserve unrelated invalidity and the exact relative
   sequence of every retained row while adding a deterministic Fields/O cohort,
   allowing numeric ranks to shift only around inserted rows?
5. Does Fields default cage order remain only a tie-breaker while existing
   authored permutations remain authoritative?
6. Does every listed command actually change the active required domain, and
   is any activation command missing?
7. Does delta-only reconciliation avoid repairing pre-existing omissions on an
   unrelated edit?
8. Can direct removal reject active required rows while stale required repair
   and optional removal remain usable?
9. Are deactivation and reactivation semantics consistent with dormant Ship,
   Echo, Artificer, replacement, and retained-invalid contracts?
10. Does optional behavior remain unchanged for Shop, Fields minors,
    Narcissus, Travel, Gold, Contract, and optional Artificer sources?
11. Can the broad test helper be deleted without replacing it with another
    command replay, fixture normalizer, or hidden production policy?
12. Is schema 48 still truthful when commands guarantee new defaults but the
    codec accepts explicit incomplete state?
13. Do primary tests own the full matrix while app/product tests retain only
    representative contact?
14. Does the gate reduce real user and fixture busywork rather than merely
    hiding unranked rows in React?

Any material contradiction returns to the main session before the plan is
locked. The reviewer must not resolve an ambiguous activation or lifecycle
point by allowing the application to infer it.
