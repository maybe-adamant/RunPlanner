# Room Replacement State-Retention Audit

## Purpose and Status

This document records the room-replacement UX defect, locks the
replacement-state policy, and defines the implementation sequence that closes
it across the authored model, simulation, candidates, and editor.

`../design/AUTHORED_PROJECT_MODEL.md` remains the authority for Room Occurrence
identity, leaf ownership, semantic commands, and downstream retention.
`../design/EDITOR_MODEL.md` remains the authority for room replacement and
visible retained-invalid state. The three amendments below are complete; this
audit retains the cross-template compatibility evidence and delivery record.

The original four delivery slices are layered in the current worktree, but
review found that their fixed, shop, and terminal-free mappings describe
replacement pairs that do not exist in the production catalog. The amendment
below supersedes those mappings and the original delivery sequence. The useful
default-overlay command integration, counted reconciliation, H/O compound
reconciliation, and editor coverage remain the implementation base. Delivery
status and validation evidence belong in
`../progress/IMPLEMENTATION_PROGRESS.md`.

## Problem

Before the layered implementation, replacing a room such as `F_Combat02` with
`F_Combat06` preserved the authored Room Occurrence ID and downstream topology
but reset the occurrence's incoming reward to the replacement declaration's
default. The same mechanism reset other room-local authored values:

- H Fields cage rewards;
- O encounter count and reward wheels.

The prior command path constructed an entirely new room state through
`createDefaultRoomState(...)` before replacing the occurrence. Prior command
coverage explicitly expected an edited counted reward to become the
replacement room's default Boon.

The behavior is structurally safe but unnecessarily destructive. A room
replacement already preserves the stable Room Occurrence that owns incoming
and local semantic leaf addresses. Resetting compatible leaves makes a
declaration selection behave like occurrence deletion and recreation even
though topology, identity, focus, findings, and undo continue to address the
same occurrence.

## Ownership Decision

The replacement Room Declaration owns:

- the replacement room's game identity;
- the room-state family and semantic leaf shape it admits;
- required local group and slot keys;
- structural value domains and bounds;
- defaults for newly introduced or incompatible leaves.

The existing Room Occurrence owns:

- its stable occurrence ID;
- the current authored values of semantic leaves that the replacement
  declaration can still represent;
- context-invalid values that remain structurally admitted;
- downstream topology already attached to the occurrence.

The amended locked rule is:

> Room replacement installs the replacement declaration's state shape and
> defaults, then retains an old authored value when the active production
> replacement surface exposes the same semantic leaf and the replacement
> leaf contract admits that value.

This is not blanket state preservation. It is declaration-bounded
reconciliation, and it does not invent a replacement mapping merely because
two theoretical state variants could be compared.

### Authored Reward Contract

The scalable comparison unit is an authored reward leaf contract, not raw room
declaration equality and not whole encounter-profile equality.

The contract includes only facts that determine whether the authored value can
be represented:

- semantic leaf kind and relative address;
- declaration-owned child keys;
- admitted reward types and payload domains;
- authored store domains;
- authored counts, bounds, and picked-value validity.

It excludes:

- declaration defaults;
- room eligibility, force, caps, and current simulation support;
- exits and encounter mechanics unrelated to the authored reward leaf;
- labels, game names, and rendered position.

Therefore exact raw profile equality is not required. For example, two combat
rooms may differ in store availability or generation rules while the
replacement still admits the old offer. H and O compound state is compared
leaf by leaf so one changed descriptor does not reset compatible siblings.

The rule is production-bounded. A state family enters the retention policy only
when the current catalog and topology expose at least two distinct declarations
that can participate in that replacement. Future catalog expansion must add an
explicit production fixture before it expands this policy.

### Current Production Replacement Surface

| Authored state contract     | Current replacement surface                                                                  | Disposition                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Counted incoming reward     | F opening peers and biome-local counted Combat, Miniboss, Fountain, and Clockwork candidates | Retain the complete offer when the replacement binding admits it |
| Fields cage rewards         | Distinct `H_CombatXX` declarations                                                           | Reconcile independently by cage group and slot key               |
| Ship reward wheels          | Distinct `O_CombatXX` declarations                                                           | Reconcile independently by wheel and offer key                   |
| No authored leaves          | Staged `Q_CombatXX` rewardless peers                                                         | Return canonical replacement `none` state                        |
| Fixed incoming reward       | No distinct same-reward pair; O Story and Devotion have different fixed rewards              | Use replacement defaults                                         |
| Entered shop state          | One ordinary `X_Shop01` per applicable biome; preboss shops are separate terminal roles      | Use replacement defaults                                         |
| Forked terminal free reward | No distinct replaceable Room Declaration pair                                                | Use replacement defaults                                         |
| Ephyra combat state         | N fixed Hub slots expose no arbitrary room replacement                                       | Use replacement defaults                                         |

All cross-family transitions use the replacement declaration's complete
defaults. The table describes authored-state reconciliation, not candidate
support: a room may remain selectable as retained-invalid without changing the
retention rule.

## Structural Compatibility Versus Contextual Support

Retention uses structural compatibility only.

A value is structurally compatible when:

- the replacement pair belongs to the active production replacement surface;
- the replacement declaration owns the same semantic leaf kind;
- the leaf address can still be formed from the same occurrence and semantic
  child keys;
- the value satisfies the replacement declaration's closed shape, payload
  domain, local keys, bounds, and declaration-level filters.

A structurally compatible value is retained even when current simulation finds
it impossible because of:

- the resolved reward store;
- counted-bag state;
- sibling duplication;
- Boon-source history;
- Devotion pairing or spacing;
- force, cap, or requirement history;
- a changed upstream context.

Those are semantic findings and candidate evidence, not permission for a
command handler to repair authored intent.

A value is not structurally compatible when the replacement declaration cannot
represent it at all. Examples include a reward type filtered out of the new
room binding, a wheel key absent from the new encounter profile, or a counted
incoming offer on a rewardless room. Only that incompatible leaf is replaced
by the new declaration-owned default.

The implementation must not use current candidate support as a retention
predicate. A forced or singleton candidate also does not authorize automatic
replacement.

## Replacement Algorithm

`ReplaceOccurrenceRoom` must execute one atomic authored command:

1. resolve the existing occurrence, its structural role, and whether it is
   currently entered;
2. resolve the replacement Room Declaration and the store context applicable
   to that replacement;
3. construct the replacement declaration's complete default room state;
4. reconcile the old state into that default through the closed compatibility
   policy below;
5. replace the occurrence while preserving its occurrence ID;
6. reconcile any outgoing continuation reward-store authority from the
   replacement source room through the existing continuation policy;
7. validate the complete unpublished project proposal;
8. publish one authored snapshot and one undo entry.

The reconciliation function must be pure and explicit. Do not implement
retention by mutating the old state, spreading arbitrary old records over new
defaults, catching decoder failures as control flow, or placing fallback logic
in React.

Defaults are the base of the replacement state. Retained compatible values are
the deliberate overlay.

## Closed State-Family Policy

### No Authored Leaves

`none -> none`

- retain no value because no authored semantic leaf exists;
- return the replacement declaration's canonical `none` state.

Any transition between `none` and another state family uses the replacement
defaults.

### Counted Incoming Reward

`counted -> counted`

- retain the complete `ResolvedRewardOffer` at the occurrence's incoming-reward
  address when its reward type and payload are admitted by the replacement
  room's counted binding;
- do not require the offer to be currently supported by its resolved store,
  bag, siblings, or source history;
- otherwise retain the replacement declaration's default offer.

Compatibility follows the semantic incoming-reward leaf, not equality of room
template keys. A compatible replacement between Standard Combat, Fountain,
Miniboss, Clockwork Combat, or another counted producer may retain the value.
Real-catalog coverage must name `Miniboss -> Miniboss` explicitly rather than
relying only on synthetic counted-room declarations.

`counted -> non-counted` and `non-counted -> counted` use the replacement
defaults because the semantic leaf kind changes.

### Fixed Incoming Reward

`fixed -> fixed`

- the current catalog exposes no two distinct same-reward fixed declarations
  in one production replacement surface;
- O exposes Story and Devotion as distinct fixed rewards, so replacement
  between them uses the replacement declaration's default;
- selecting the existing declaration again is a command no-op;
- the current reconciler must not implement or test a speculative same-reward
  fixed-retention mapping.

If a future biome adds two replaceable fixed declarations with the same reward
contract, that catalog change must define and fixture the new mapping.

### Fields Combat

`fieldsCombat -> fieldsCombat`

- match the declaration-owned local group by semantic group key;
- match cage leaves by semantic slot key;
- retain each complete cage offer independently when the replacement slot's
  binding structurally admits it;
- initialize a new or incompatible cage leaf from the replacement slot's
  default;
- remove old slot values whose keys do not exist in the replacement
  declaration.

Active versus dormant cage status is derived from the owning batch and
replacement room declaration. It is not a retention predicate. A dormant third
cage remains authored when the replacement still declares that slot.

### Ship Combat

`shipCombat -> shipCombat`

- retain `encounterCount` when it remains within the replacement profile's
  declared domain; otherwise use the replacement default;
- match reward wheels by semantic wheel key;
- retain a wheel store when the replacement wheel admits that store;
- retain offer count when it remains within the replacement wheel's bounds;
- match and retain complete offers by semantic offer key when the replacement
  binding admits them;
- retain the picked offer only when it addresses the reconciled active offer
  count;
- default only incompatible fields, new wheel keys, and new offer keys;
- remove wheel and offer keys absent from the replacement profile.

The reconciler must produce one internally coherent wheel state. If a retained
offer count makes the old picked index invalid, the picked index uses the
replacement default rather than being clamped or guessed.

### Shop

`shop -> shop`

- each applicable biome has only one ordinary `X_Shop01` declaration;
- replacement is biome-local;
- preboss shops are topology-owned terminal rooms and do not replace or
  interact with the ordinary midshop;
- selecting the existing shop declaration again is a command no-op;
- the current reconciler therefore uses replacement defaults and must not
  carry synthetic same-profile or changed-profile shop fixtures.

Replaceable shop peers require a new catalog-backed policy and fixtures if they
are introduced later.

### Forked Terminal Free Reward

`freeReward -> freeReward`

- forked terminal roles are topology-owned;
- no two distinct production Room Declarations participate in a
  terminal-free-reward replacement;
- the current reconciler uses replacement defaults and must not expose a
  synthetic free-reward retention boundary.

Room replacement must not move an occurrence between terminal shop and
terminal free-reward roles.

### Ephyra Combat and Side Rooms

N's fixed Hub slots do not expose arbitrary `ReplaceOccurrenceRoom`.
`ephyraCombat` state and its parent-local side rooms are therefore outside the
active replacement surface.

If a future layout adds replaceable Ephyra-style rooms, it must define an
explicit compatibility policy for the incoming reward, fixed side-slot keys,
generation state, entry ordinals, and side rewards before enabling room
replacement. The current change must not add an unused generic Ephyra fallback.

### Incompatible Families

Every other state-family transition uses the replacement declaration's complete
defaults.

There is no cross-family harvesting of similarly shaped nested fields. For
example, a counted incoming reward does not become an H cage, an O wheel offer,
or a shop offer merely because each contains a `ResolvedRewardOffer`.

## Identity and History Contract

Room replacement continues to:

- preserve `occurrenceId`;
- preserve compatible downstream topology;
- preserve retained overflow targets until explicit reconciliation;
- re-anchor no continuation unless the existing topology command already owns
  that behavior;
- produce one authored snapshot and one undo entry;
- invalidate and rebuild derived simulation and workspace projections through
  the ordinary application lifecycle.

Undo restores the exact pre-replacement room name and room state. Redo restores
the exact reconciled replacement snapshot.

The app does not keep a hidden cache keyed by prior game room name. Switching
from room A to room B and later back to A retains only values that survived
both declaration-bounded transitions. It does not resurrect A's historical
state outside undo.

## Candidate and Finding Contract

Room candidate evaluation continues to answer whether the replacement room is
supported at the addressed generation frontier. It does not expand its horizon
to require all retained room-local leaves or downstream topology to remain
valid.

After the command:

- selected-plan simulation evaluates the reconciled room state;
- retained context-invalid leaves remain visible at their stable semantic
  addresses;
- ordinary reward, wheel, and local-child findings explain any resulting
  incompatibility;
- the workspace builds new immutable interaction descriptors for the new
  project identity;
- stale candidate results from the previous workspace cannot publish.

Do not make room candidates impossible merely because a retained reward or
downstream descendant needs separate repair.

## UI Contract

The existing grouped room picker remains the command surface. React does not
decide retention and does not dispatch follow-up reward-reset commands.

After a room selection:

- compatible incoming and local values remain visibly selected;
- newly introduced leaves show replacement declaration defaults;
- removed leaves disappear because the replacement declaration no longer owns
  them;
- retained-invalid leaves display their normal finding and candidate guidance;
- one room selection creates one undo entry;
- no confirmation dialog is required for ordinary declaration-bounded
  replacement.

The closed room summary and focused inspector must both consume the same
reconciled authored snapshot. They may not temporarily show defaults while the
project contains retained values.

## Non-Goals

This change does not:

- move reward or local-state ownership out of Room Occurrences;
- preserve arbitrary old room-state objects;
- cache state per previously selected game room name;
- retain declaration-impossible values by weakening project decoding;
- make candidate support a command-time mutation rule;
- change Room Occurrence identity or semantic addresses;
- change downstream topology-retention policy;
- add arbitrary room replacement to N;
- deep-compare raw room or encounter-profile objects as compatibility policy;
- add a persisted compatibility or reward-profile key;
- add a project schema field or require a schema-version bump;
- introduce migration or compatibility scaffolding;
- add a second undo entry for leaf reconciliation.

## Amended Delivery Sequence

These corrective slices supersede the original four-commit sequence. They
preserve already-correct implementation rather than restarting the feature.
Each commit must independently pass its declared gate.

### Amendment 1 — Bound Authority to Production Leaf Contracts — Complete

Suggested commit:

```text
docs(model): bound room retention to production contracts
```

Deliver:

- this amendment and a current production replacement-surface inventory;
- the semantic-leaf contract definition in `AUTHORED_PROJECT_MODEL.md`;
- matching editor language in `EDITOR_MODEL.md`;
- removal of same-reward fixed, same-profile shop, and terminal-free retention
  claims from owning and referencing documents;
- an explicit statement that preboss shop roles do not interact with ordinary
  midshops;
- a progress entry that marks the layered implementation as under amendment,
  not closed.

Gate:

- every `AuthoredRoomState` family has either a catalog-backed mapping or an
  explicit replacement-default disposition;
- raw profile equality, structural admission, and contextual support are
  distinguished;
- no synthetic declaration is treated as production authority;
- documentation formatting passes.

### Amendment 2 — Refocus the Reconciler on Reachable Mappings — Complete

Suggested commit:

```text
refactor(model): bound room reward reconciliation
```

Deliver:

- retain the pure defaults-plus-overlay reconciler and its command integration;
- retain counted-offer admission, Fields cage reconciliation, and Ship wheel
  reconciliation;
- make `fixed`, `shop`, `freeReward`, and `ephyraCombat` use replacement
  defaults on the current production surface;
- remove fixed/shop/free compatibility helpers that no longer serve a reachable
  mapping;
- remove `F_Shop02`, alternate-profile shop, duplicate fixed-reward, and direct
  free-reward synthetic fixtures;
- add a real-catalog `Miniboss -> Miniboss` command fixture;
- retain real-catalog `Combat 02 -> Combat 06`, declaration-filtered fallback,
  and context-invalid counted-offer fixtures;
- preserve unchanged occurrence identity, topology, continuation-store
  reconciliation, and one-step command history.

Gate:

- Combat and Miniboss replacement retain admitted incoming rewards;
- a declaration-filtered reward receives the replacement default;
- no inactive state family gains behavior from a test-only declaration;
- H and O compound states still pass normal project contract validation;
- planner-engine type checking and focused authored-project tests pass.

### Amendment 3 — Close Cross-Layer Behavior — Complete

Suggested commit:

```text
test(editor): close production room retention
```

Deliver:

- selected-simulation coverage that a counted reward already context-invalid
  in the selected context remains authored after room replacement;
- proof that room candidate support remains scoped to the room-generation
  horizon rather than retained leaf validity;
- stable semantic-owner finding and navigation coverage for that retained
  invalid reward;
- workspace and React coverage for retained incoming, H cage, and O wheel
  values after immutable project replacement;
- the existing `Combat 02 -> Combat 06` interaction with unchanged reward,
  one-step undo, and redo;
- removal of any planned or existing shop replacement UI fixture;
- final authority reconciliation and a factual progress entry containing the
  current complete-gate count.

Gate:

- React dispatches only `ReplaceOccurrenceRoom`;
- no render-time candidate work or UI-side state copying is introduced;
- retained-invalid findings navigate to the exact stable leaf owner;
- edit, undo, and redo each publish the correct immutable workspace;
- `npm run test:engine`, `npm run test:planner`, and affected product-loop
  fixtures pass;
- the complete `npm run check` gate passes before closure is recorded.

## Closure Criteria

The issue is closed only when:

1. compatible Combat and Miniboss incoming rewards survive production room
   replacement;
2. compatible H cage and O wheel state also survive replacement;
3. incompatible or newly introduced leaves receive complete declaration-owned
   defaults;
4. context-invalid retained values remain authored and receive normal findings;
5. declaration-impossible values do not bypass structural contact validation;
6. replacement preserves occurrence identity, downstream topology, and one-step
   undo;
7. room candidates remain independent of retained leaf and downstream repair;
8. fixed, shop, terminal-free, and Ephyra state have no speculative retention
   mapping;
9. preboss shops remain topology-owned and independent from ordinary midshops;
10. N retains its fixed-slot no-replacement contract;
11. no hidden per-room state cache or project-schema addition is introduced;
12. authority documents, progress history, focused tests, product fixtures, and
    the complete repository gate agree.
