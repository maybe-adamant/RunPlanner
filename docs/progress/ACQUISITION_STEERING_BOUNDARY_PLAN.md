# Acquisition Steering Boundary Plan

## Status and bases

Status: **Gates A-B implemented; Gate C live closure remains**.

Planning bases:

- Run Planner: `c096664f`
- Plan Executor: `a2afe88`
- Modpack parent: `091643b`

The working trees also contain the bounded Postboss recovery remediation that
removes save-backed executor state and adopts the native restored Postboss
room. That work is independent of this plan and must retain its own commit
boundary.

## Objective

Make acquisition execution match the boundary the native game actually
exposes reliably:

1. the planner publishes an exact intended acquisition and its prerequisite
   edges;
2. the executor applies the published steering instruction at a verified
   native contact;
3. that successful intervention may release local DAG dependents; and
4. the room's existing named conformance products decide whether the durable
   modeled outcome is correct.

An acquisition handle is therefore a steering and ordering capability. It is
not an independent proof that the native object which started an acquisition
also survived every callback and finished the acquisition.

The motivating failure is a purchased Mystery Boon in `N_PreBoss01`. The
executor correctly forced its hidden Zeus provider and authored offer, but the
native threaded unwrap replaced the Shop box with another loot object. The
transaction remained incomplete and failed the room-exit obligation even
though the intended steering had succeeded. This plan removes that false
correctness boundary rather than adding another source-specific identity
handoff.

## Review of the current module

The current runtime has one overloaded owner-completion ledger:

```text
completedOwners
  -> releases prerequisite edges
  -> satisfies checkpoint obligations
  -> is treated by adapters as proof of the native semantic outcome
```

That overload appears in three bounded neighborhoods:

- `packages/planner-engine/src/execution-plan/assembly/timeline-relations.ts`
  publishes one checkpoint obligation for every transaction, including every
  acquisition;
- `src/mods/room/timeline/session.lua` uses the same completed-owner set for
  prerequisite readiness and obligation deadlines; and
- acquisition adapters under `src/mods/room/timeline/acquisitions/` often wait
  for a native terminal and compare the observed result before completing the
  owner.

The route cursor, room coordinator, Overview and feature realization,
navigation, structural conformance, encounter interactions, transformations,
item effects, Travel Deal refill realization, keepsake changes, and fountain
use do not depend on acquisition settlement being correctness proof. They stay
outside this redesign.

The current acquisition adapters fall into these contact families:

| Family                                                                                                 | Current terminal                                                    | Required boundary                                                                                                     |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Ordinary Boon, Hermes, and Hammer                                                                      | selected trait callback, including exact selected-row comparison    | install the authored offer; retain later contacts only for additional authored steering                               |
| Mystery Boon                                                                                           | box unwrap, provider binding, then ordinary selected-trait terminal | claim at unwrap, force the hidden provider, install the authored offer, then release at the final steering contact    |
| Chaos offer                                                                                            | selected curse callback                                             | install the complete authored Chaos screen and values; later selection is conformance evidence, not adapter proof     |
| Visible Pom                                                                                            | selected target callback                                            | install the authored target surface; retain a later contact only when another effect still requires steering          |
| Direct level effect                                                                                    | target-selection/mutation callback                                  | supply the authored target and amount to the native effect                                                            |
| Spell and Path                                                                                         | selected/closed screen callback                                     | release after the final authored Spell/Hex/Path steering operation                                                    |
| Direct consumable or resource                                                                          | return from accepted `UseConsumableItem`                            | keep only the accepted contact needed to release a real dependency; do not make it a checkpoint obligation            |
| Selected effects such as All Together, Natural Selection, Sea Star, Concave Stone, and targeted grants | completion waits for their nested native effect chain               | retain the handle through the last executor-owned nested intervention, without validating the resulting state locally |

This is a settlement-boundary correction, not a new scheduler, event bus,
transaction kind, or conformance framework.

## Locked decisions

### Acquisition transactions remain on the wire

`kind: "acquisition"` remains the source-independent execution instruction for
room rewards, generated pickups, World Shop outcomes, Shrine deliveries, and
other supported carriers. It continues to carry:

- the exact semantic owner;
- lifecycle window;
- prerequisite relations;
- native acquisition roles;
- selected trait, level, Spell, Path, or generated result; and
- source/materialization correlation when a producer already exposes it.

No `plannerOnly`, `steeringOnly`, settlement-policy, or acquisition-status flag
is added. The transaction kind and the existing separate obligation list are
already sufficient.

### Acquisition is not a checkpoint obligation

The planner engine continues to publish selected acquisition transactions and
their meaningful dependency edges. It omits acquisition owners from
`timeline.obligations`.

This changes neither the transaction union nor the obligation wire shape. It
changes which existing owners appear in the existing obligation list, so it
does not require an authored-project schema bump or an execution-protocol
version bump.

All published non-acquisition transactions retain their present obligation
policy in this plan. Any later attempt to relax encounters, automatics, item
effects, transformations, refills, keepsake changes, replays, or fountain use
requires its own evidence and decision.

### Completion means the executor finished its intervention

For an acquisition owner, runtime completion means only that the adapter
finished the last executor-owned steering operation needed by that owner. It
may release a dependent transaction in the same occurrence.

It does not assert that:

- the player made the authored choice;
- the native game produced the expected durable state;
- the same Lua table survived the complete acquisition chain;
- every native presentation or cleanup callback occurred; or
- the executor independently revalidated planner eligibility.

When an offer screen is modal, completing after the final steering operation
is sufficient for DAG readiness: another room action cannot occur until the
native interaction finishes. An acquisition with an authored nested effect
retains its owner until that nested effect's final steering contact because the
dependent intervention is part of the same owner.

### Mechanical failure only inside adapters

An acquisition adapter may report an immediate mismatch only after it has
positively claimed one ready directive and cannot apply that directive through
its declared native boundary. A native contact with no compatible ready
directive remains an unmodeled/pass-through contact; it is not a mismatch.

Strict decoding rejects a structurally invalid execution payload before a run
starts. Missing required host functions and exceptions raised by native game
code remain executor faults. The acquisition adapter's one runtime question is
therefore mechanical: did the claimed steering operation accept the published
input or not?

Adapters must not compare the later semantic result. They do not read back the
selected trait, level, rarity, element count, Hex state, or other inventory;
reconstruct eligibility; compare before/after state; or turn a player's
different selection into an adapter-local mismatch. Protected calls may still
restore a temporary forcing scope and rethrow a native error under the existing
host-fault policy.

If a ready acquisition contact never occurs, no adapter invents a missing
callback mismatch. Its unused handle is diagnostic and is not itself a
checkpoint mismatch.

### Named conformance remains the semantic authority

The existing room-exit conformance surface remains centralized and unchanged:

- `traitInventory` covers acquired, removed, replaced, leveled, rarified, and
  Hammer-rank results;
- `elementCounts` covers elemental pickups and grants;
- `pathOfStars` covers Spell, Hex-tree, Path-point, and closure state;
- `steadyGrowth`, `chaos`, `keepsakeEffects`, `rewardPriorities`, `forfeit`,
  and `stygianWell` cover their existing retained-state products.

The executor compares only facts selected by the planner's sparse
`roomExitConformance` product. Acquisition adapters neither invoke these
readers nor manufacture another action-specific comparison.

Direct health, Magick, healing, Armor, Gold, ordinary resources,
meta-progression currency, and the planner's approximated Last Stand inventory
remain intentionally outside blocking state conformance. Failing to observe
one of those simulation-neutral acquisitions does not stop later steering.

### Dependency edges remain exact and local

The planner remains the sole authority for why acquisition `B` depends on
acquisition `A`. The executor only asks whether `A` has completed its steering
contact before exposing `B`.

The runtime does not infer dependencies from trait identities, source objects,
callback order, or native state. Removing acquisition obligations must not
remove acquisition transactions, prerequisite edges, or `completedOwners` as
the DAG-readiness ledger.

### Mystery Boons remain producer-agnostic

Every supported Mystery Boon uses one acquisition adapter regardless of
whether its box came from a room pickup, Narcissus, World Shop, Hermes Shrine,
or another generated source:

```text
ready Mystery acquisition
  -> UnwrapRandomLoot claims it
  -> GiveLoot receives the published hidden provider
  -> the resulting provider receives the authored offer
  -> the final executor-owned steering contact completes the owner
```

The adapter does not prove purchase, carry pedestal provenance forward, or
require the box table to be the later provider or menu table. Multiple ready
Mystery acquisitions use published DAG readiness and stable transaction order;
if order changes eligibility, the planner must publish the dependency.

## Ownership

### Planner engine

The execution assembler owns which selected transactions become checkpoint
obligations. It must:

- retain every currently selected acquisition transaction;
- retain every meaningful local dependency whose endpoints remain published;
- omit acquisition owners from obligations;
- preserve all non-acquisition obligations; and
- validate that every obligation still names one published transaction.

The authored model, simulation chronology, candidate policy, and catalog do
not change. The compiler does not inspect encoded addresses or rediscover which
acquisitions are simulation-relevant.

### Plan Executor Timeline

The Timeline session continues to own handles, compatible ready claims,
prerequisite readiness, completion, and explicit obligation deadlines. It must
not add an implicit "all transactions complete" close rule or promote an
unclaimed acquisition back into an obligation.

An uncompleted acquisition is cleared when the room session closes after its
published obligations and named conformance pass. Diagnostic reporting may
record that the acquisition was never steered, but diagnostics cannot block.

### Acquisition adapters

Each adapter owns only:

1. recognizing its verified native carrier/contact;
2. claiming or retaining the exact ready acquisition owner;
3. applying the published steering payload; and
4. completing the owner at its last executor-owned intervention when DAG
   release is needed.

Adapters do not own semantic settlement proof. Producer modules may bind a
materialized native object when that is naturally available, but no adapter may
require source provenance solely to prove completion.

## Delivery gates

### Gate A — Obligation and Timeline boundary

Coordinated planner-engine and Plan Executor deliverables:

1. Exclude acquisition transactions from assembled Timeline obligations while
   retaining their transactions and dependencies unchanged.
2. Keep every non-acquisition transaction obligated at its current checkpoint.
3. Update graph/codec tests only where fixture bytes or obligation assertions
   truthfully change; do not add another wire field or protocol bump.
4. Refresh mirrored execution fixtures once and preserve planner/executor byte
   identity.
5. Prove a completed acquisition still releases its exact dependents.
6. Prove an uncompleted acquisition does not fail `roomExit` or room close when
   named conformance passes.
7. Prove an uncompleted non-acquisition obligation still fails at its
   checkpoint.
8. Remove Timeline comments and test names that describe every acquisition as
   native settlement proof; do not add a transaction-status flag, action-family
   validator, or second completion ledger.

Primary acceptance:

- an occurrence containing both acquisition and non-acquisition transactions
  publishes both transactions but only the latter obligation;
- an acquisition-to-acquisition dependency remains present;
- every obligation names a published transaction; and
- the purchased `N_PreBoss01` Mystery Boon no longer creates a room-exit
  acquisition obligation.

Commit boundary: coordinated planner/executor commits named
`refactor(execution): separate acquisition steering from obligations`.

### Gate B — Acquisition adapter terminals

Adapt one family at a time without changing their wire payloads:

1. ordinary Boon/Hermes/Hammer and selected nested trait effects;
2. Mystery Boon from pickup, World Shop, and Shrine-delivery carriers;
3. Chaos offers;
4. visible and direct level effects;
5. Spell and Path acquisitions; and
6. direct consumable/resource contacts.

For each family:

- identify the last executor-owned intervention;
- complete there when needed for DAG release;
- delete later semantic-result comparisons and identity forwarding used only
  for settlement proof;
- retain exact binding only where a later steering operation genuinely needs
  it; and
- keep native code authoritative for application, cleanup, and presentation.

The Gate B review must specifically reject source-specific Mystery purchase
logic, a global pending-acquisition cursor, callback-name transaction maps,
native inventory comparison inside adapters, and retained dead bindings.

Commit boundary: `refactor(acquisitions): settle steering at native intervention`.

### Gate C — Durable authority and live closure

1. Amend the stable integration boundary and focused acquisition contact audits
   so acquisition completion is no longer described as semantic proof.
2. Amend or retire `OUTCOME_DRIVEN_STORE_EXECUTION_PLAN.md`; its outcome-driven
   publication remains valid, while its "missing purchase leaves an incomplete
   required owner" and native-terminal settlement claims are superseded.
3. Refresh the game-execution contact index without erasing native source
   evidence.
4. Live-test the existing Surface plan through the purchased `N_PreBoss01`
   Mystery Boon, `N_Boss`, and Postboss recovery attempt.
5. Confirm the authored Zeus offer is forced, no acquisition obligation
   desynchronizes `N_PreBoss01`, the Boss element is still forced, and the
   Postboss admission observes the expected element vector.
6. Run one complete planner repository gate, the complete Plan Executor suite,
   Luacheck, fixture-identity check, and parent smoke gate after focused tests
   and live evidence stabilize.
7. Record the durable result and delete this temporary plan.

Commit boundary: documentation closure plus the modpack-parent submodule
integration commit.

## Test ownership

### Planner engine

- `execution-plan/assembler.test.ts` owns transaction/dependency/obligation
  projection.
- codec and graph-validation suites retain only closed-wire and referential
  integrity coverage.
- shared fixtures provide representative byte-product evidence; they do not
  duplicate every acquisition family.

### Plan Executor

- Timeline session tests own readiness, dependency release, explicit
  obligations, and close behavior.
- acquisition adapter suites own only their mechanical native contacts and
  steering payloads.
- room conformance tests own semantic outcome comparison.
- one composed Mystery witness must use distinct box, provider, and menu tables
  so a same-object synthetic chain cannot conceal identity coupling.

## Expected deletions and simplifications

- Acquisition entries in execution `timeline.obligations`.
- Selected-row/result comparisons whose only purpose is to authorize
  acquisition completion.
- Mystery box-to-provider-to-button identity forwarding used only as settlement
  proof.
- Direct-pickup assertions that native return proves semantic correctness.
- Tests that require every published transaction to be an obligation.
- Stable documentation claiming an unobserved purchase is detected through an
  incomplete acquisition owner.

Exact bindings, selected-effect scopes, and native result reads remain only
when they are inputs to another concrete steering operation.

## Explicit non-goals

- No change to authored-project schema or authoring UX.
- No new execution transaction kind, status flag, event bus, global action
  cursor, or conformance fact.
- No change to room, navigation, feature inventory, commerce realization,
  encounter, transformation, automatic, keepsake, or Postboss recovery policy.
- No gold, health, Magick, Armor, complete Death Defiance, or
  meta-progression-state simulation.
- No adapter-local semantic validator and no full native inventory comparison.
- No support for recovering inside a partially completed room.
