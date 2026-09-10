# Execution Correlation and Mismatch Policy Plan

**Status:** Locked; implementation has not started  
**Run Planner base:** `8ad4550f`  
**Plan Executor base:** `0970170`  
**Modpack parent base:** `5f60374`

When locked, this plan supersedes the remaining live-closure gate and the
callback-local mismatch allowance in
`ACQUISITION_STEERING_BOUNDARY_PLAN.md`. Its implemented Gates A-B remain useful
history, but that document is no longer an implementation authority and retires
with this plan at closure.

## Governing authorities

- `docs/design/GAME_INTEGRATION_BOUNDARY.md` owns the stable planner/executor
  dependency direction and checkpoint contract.
- `docs/audits/game-execution-contacts/EXECUTION_MISMATCH_POLICY.md` owns the
  evidence-backed mismatch inventory and disposition.
- `docs/audits/game-execution-contacts/NATIVE_CONFORMANCE_CONTACTS.md` owns the
  native read contacts used by standard checkpoints.
- `docs/audits/game-execution-contacts/ROOM_FEATURES_AND_ACTIONS.md` owns the
  separation between feature realization and later actions.

## Objective

First, make World Shop acquisitions bind to the exact authored shop offer that
created them. A normal and a boosted boon from the same god must remain distinct
regardless of purchase order, and an early purchase must be evaluated against
the dependency graph of that exact offer.

Then, reduce executor desynchronization to a small, explicit contract:

- standard admission, room, door, obligation, and room-exit checkpoints decide
  whether the realized run still supports the planner's next state;
- an irreversible action against an exact-bound transaction may desynchronize
  immediately when its published prerequisites are not complete;
- actuator-local steering failures are diagnostics unless a standard checkpoint
  later proves that the resulting state is unusable;
- internal executor defects and malformed native contacts are faults, not
  gameplay mismatches; and
- desynchronization stops further steering but never blocks the native game
  action that exposed it.

The result should be easier to reason about than the current callback-by-callback
mismatch surface. The executor steers authored outcomes, unlocks published DAG
dependencies at their declared terminal contacts, and lets checkpoints establish
durable conformance.

## Problem Statement

### World Shop correlation is incomplete

The planner already publishes two complementary facts:

- `occurrence.overview.shop.offers[]` identifies each inventory row with an
  `offerKey`, `optionKey`, and authored reward; and
- a participating row's action becomes a Timeline transaction with its own
  opaque, canonical `owner`.

The Lua inventory stamps the native store object with `offerKey`, but the
Overview row does not publish its exact transaction owner. The runtime can
therefore lose the join and fall back to provider/game-name order. Existing Lua
tests conceal the gap by manually adding an unsupported `offerKey` field to
transactions.

This is unsafe in I/Q World Shops where a normal and boosted boon can share a
provider while carrying different rarity expectations. It is also unsafe when
the published DAG orders otherwise similar offers. The executor must not decide
which same-provider transaction a store object represents by whichever one is
currently ready.

### Mismatch authority is too broad

Many peripheral adapters currently receive the whole runtime session and can
call `session.mismatch(...)`. This lets a native callback detail become a
blocking product decision even when:

- the action was unowned or merely observational;
- steering failed locally but the room can still end in the authored state;
- the planner already validated the semantic legality of the authored outcome;
- the player deliberately diverged but the next checkpoint can establish the
  durable state; or
- the failure is an executor invariant or host integration defect rather than a
  difference between plan and run.

The planner must remain the semantic authority. The executor must not rebuild
trait eligibility, replacement legality, purchase legality, or reward policy in
order to justify callback-local mismatches.

## Locked Contract

### 1. Exact World Shop transaction binding

`ExecutionOverview.shop.offers[]` gains an optional `transactionOwner`. It is
present exactly when interacting with that authored row publishes a Timeline
transaction, and it equals that transaction's canonical `owner`.

This is deliberately the transaction owner rather than the acquisition
`sourceOwner`:

- a direct boon or ordinary pickup normally has its Shop offer as the
  acquisition source;
- a purchased Mystery Boon is represented by its acquisition-entry source; and
- Anvil of Fates publishes a transformation rather than an acquisition.

All three still have one exact Timeline transaction for the participating Shop
row. Simulation-neutral and unselected rows may have no transaction and omit the
field.

The two shop identities remain distinct:

- `offerKey` identifies the inventory slot and remains the inventory assembly
  key; and
- `transactionOwner`, when present, is the direct Overview-to-Timeline join used
  at the native action contact.

The planner constructs both identities. Lua treats both as opaque strings. Lua
must not parse a planner address, infer boost state from a native name, or derive
one identity from the other.

Inventory assembly marks every native object as World Shop material and carries
its `transactionOwner` when one was published. The mark and owner must survive
all native StoreOptions/button copies. At materialization, the adapter binds the
object directly through the existing Timeline owner index.

If the row has no `transactionOwner`, the object is unowned and the native action
continues. Its World Shop marker prevents later generic acquisition or
transformation claims from attaching it to another ready transaction. A
published owner missing from the occurrence is malformed cross-product data,
not an invitation to fall back.

This join is correlation only. It does not restore purchase transactions,
payment verification, affordability checks, or commerce-owned acquisition
settlement.

### 2. Published dependencies own action order

The executor consumes the planner's dependency graph without reconstructing why
an edge exists.

For an exact-bound irreversible native action:

- if the owner is ready, its adapter may begin steering normally;
- if its published prerequisites are incomplete, the runtime records the generic
  `transaction-prerequisite` mismatch, stops future steering, and still calls the
  native action; and
- if the exact source has no authored transaction, the action is unowned and
  proceeds natively.

The executor must not rebind an exact source to a different ready transaction.
It must not invent additional ordering between independent offers.

This gives the important World Shop cases their intended behavior:

- independent normal and boosted boons from one god may be bought in either
  order and receive their own authored payloads; and
- in a published `standard -> boosted -> standard` chain, attempting the boosted
  offer first reaches its own blocked owner and produces the one justified
  immediate mismatch.

### 3. Transaction completion is not semantic proof

An adapter completes a transaction when its owned native intervention reaches
the declared terminal contact. Completion means that its DAG dependants may now
run. It does not prove that the player selected the authored trait, paid the
expected price, or retained the expected state through room exit.

The cooperative contract remains:

- the planner validates authored legality;
- the executor installs or steers the authored outcome at the narrow native
  contact;
- the player is expected to select and perform the authored action; and
- durable consequences are checked by the existing standard conformance
  checkpoints.

No generic `IsTraitEligible` preflight is added. The executor does not reconstruct
duo requirements, replacement-count policy, rarity legality, or downstream
mutation rules.

### 4. The blocking mismatch surface is closed

Only these families may create the first gameplay mismatch:

1. start-of-run admission/loadout conformance;
2. postboss resynchronization admission;
3. room-entry room identity and declared structural-feature conformance;
4. door-open normal/additional-exit and reward conformance;
5. exact-bound irreversible action attempted before its published prerequisites;
6. required transaction obligations still incomplete when the room closes; and
7. named room-exit conformance facts required to continue simulation truthfully.

An addition to this list requires a concrete state-corruption witness and an
update to the durable mismatch-policy audit. Callback convenience is not enough.

### 5. Diagnostics and faults are non-mismatch products

Peripheral actuator failures report bounded diagnostic evidence and allow the
native action to continue. Examples include a preferred steering write not
sticking, a native option being absent, or an observation arriving without an
owned transaction.

Executor invariant failures and invalid host contracts are faults. Examples
include an impossible duplicate binding, an unknown handle created internally,
or a required native API being absent. They should fail loudly in development
and be logged as executor faults in the host; they must not masquerade as a
plan/run mismatch.

Diagnostics do not become another semantic ledger or event bus. They are bounded
evidence attached to the active occurrence and emitted in logs, especially next
to a later standard-checkpoint mismatch. They never unlock DAG dependencies and
never change synchronization state.

### 6. Native continuity is unconditional

Every hook that observes a mismatch must still call the native game function.
After the first mismatch, the executor becomes passive and the game owns the run.
No mismatch path may return early merely to preserve planner state.

## Ownership

### Planner Engine

`packages/planner-engine` owns:

- the canonical World Shop offer and participating-transaction identities;
- publication of the direct shop-row-to-Timeline-transaction join;
- the execution protocol and strict codec;
- graph dependencies and required obligations;
- the execution protocol version bump; and
- execution fixtures that prove the real byte product contains the join.

The authored-project schema does not change.

### Plan Executor

The external Plan Executor owns:

- decoding the declared join as an opaque value;
- stamping native World Shop inventory with that value;
- resolving the exact acquisition transaction at consumption;
- enforcing only published readiness for that exact owner;
- standard checkpoint mismatch production;
- non-blocking actuator diagnostics; and
- executor-fault reporting.

It does not own planner semantic validation, purchase legality, or trait
eligibility.

### Planner application and catalog

No application, React, Redux, catalog, authored schema, or simulator change is
expected. Publishing remains a translation of a validated planner product.

## Delivery Gates

### Gate A — Exact World Shop acquisition correlation

Implement the missing product join before changing mismatch policy.

Planner Engine work:

1. Add optional `transactionOwner` to `ExecutionOverview.shop.offers[]`, present
   exactly when the row's participating action publishes a transaction.
2. Join the row to that transaction through the canonical room-action owner
   already produced by the planner. Do not infer from reward type.
3. Extend strict TypeScript codecs and occurrence validation so each published
   owner is bounded, unique among Shop rows, and names exactly one transaction
   in the same occurrence. Neither decoder infers provenance from the string's
   contents.
4. Bump the execution protocol once from 35 to 36.
5. Regenerate execution fixtures from real authored plans; do not hand-author
   unsupported transaction fields.

Plan Executor work:

1. Decode the optional shop-row `transactionOwner` strictly.
2. Preserve a World Shop origin marker and the optional exact owner through
   StoreOptions, button-data, and native-object copies.
3. Resolve a published owner through the existing Timeline owner index; an
   unowned marked object remains ineligible for generic ready-claim fallback.
4. Remove World Shop reliance on synthetic acquisition `offerKey` fields and
   same-provider/readiness fallback matching.
5. Preserve native boost presentation and rarity override on the exact normal or
   boosted row.

Primary witnesses:

- one planner fixture contains same-provider normal and boosted World Shop boon
  offers and proves distinct `offerKey`, `transactionOwner`, and rarity payloads;
- the Lua strict decoder consumes that real fixture shape;
- buying the two independent offers in reverse order installs each exact payload
  without mismatch;
- an exact boosted offer attempted before its published prerequisite produces
  `transaction-prerequisite`, does not rebind, and still invokes native code; and
- an unplanned stamped offer cannot consume another ready same-provider
  transaction.

**Intended commit boundary:** coordinated planner protocol/fixture commit and
executor decoder/runtime commit, with the modpack parent updated only after both
heads pass their focused gates.

### Gate B — Core mismatch, diagnostic, and fault boundary

Centralize the closed mismatch surface in the route/room/Timeline coordinators.

1. Keep admission, room-entry, Doors, obligation, room-exit conformance, and
   exact-prerequisite mismatches at their current semantic owners.
2. Separate Timeline/room invariant failures from gameplay mismatches. Unknown
   internally created handles, duplicate bindings, invalid callback state, and
   missing required native APIs become executor faults.
3. Restrict mismatch authority to the route, room, and Timeline coordinators.
   Peripheral adapters receive a narrow diagnostic reporter and their existing
   Timeline operations; an adapter calling `begin` may still trigger the core
   exact-prerequisite check inside Timeline.
4. Ensure the first mismatch is logged with its checkpoint and nearby bounded
   diagnostic evidence.
5. Audit every mismatch path for unconditional native continuation.

Primary witnesses:

- malformed plan admission fails without manufacturing a run mismatch;
- an executor invariant is reported as a fault, not `firstMismatch`;
- unowned observational contacts pass through;
- exact-bound early action, required room obligation, structural mismatch, and
  room-exit conformance still produce the expected first mismatch; and
- each mismatch hook invokes the native function exactly once.

**Intended commit boundary:** one executor core-policy commit. No protocol bump.

### Gate C — Acquisition, inventory, and commerce actuator cleanup

Apply the Gate B boundary to the highest-contact action families first.

1. Ordinary, Chaos, NPC, spell, level, and nested acquisition adapters steer and
   complete transactions without producing semantic result mismatches.
2. Inventory and refill adapters report steering/observation diagnostics rather
   than independently desynchronizing.
3. World Shop, Stygian Well, Hermes Shrine, and Pool adapters continue to own
   inventory realization only. Ordinary payment and purchase order are not
   compared.
4. Travel Deal keeps only its planner-published dependency and exact refill spot;
   there is no second commerce interpretation of the rule.
5. Remove obsolete callback-local mismatch branches and tests that merely encode
   historical mismatch strings.

Primary witnesses:

- a valid shop, pickup, Mystery Boon, level, and trait sequence closes through
  terminal contacts and passes room exit;
- a deliberately wrong selected durable outcome is detected by room-exit
  conformance rather than the selection callback;
- a local steering miss is diagnostic and does not desynchronize by itself; and
- Travel Deal remains blocked only by its published DAG edge and realizes at its
  exact refill source.

**Intended commit boundary:** one acquisition/inventory vertical-slice commit.

### Gate D — Remaining actuator families

Apply the same boundary to keepsakes, automatic outcomes, encounters,
transformations, and loadout-owned steering.

1. Preserve explicit transaction binding and lifecycle terminal contacts.
2. Preserve standard room-exit trait/arcana/keepsake/effect conformance.
3. Convert callback-local outcome comparisons into diagnostics unless they are
   one of the locked checkpoint families.
4. Keep native game clocks and deterministic side effects native; the executor
   steers only the authored random outcome.
5. Remove broad runtime-session injection from adapters after their last direct
   mismatch dependency is gone.

Primary witnesses:

- one representative each for a keepsake target, automatic target, encounter
  selection, and transformation reaches its terminal contact and is validated at
  the room checkpoint;
- a wrong durable result is caught at room exit; and
- a host/invariant failure is a fault while an unowned native event remains
  pass-through.

**Intended commit boundary:** one remaining-actuator vertical-slice commit.

### Gate E — Live closure and documentation

1. Exercise an I/Q World Shop with same-god normal and boosted boons in both
   legal purchase orders.
2. Exercise a published dependency violation and confirm one mismatch is logged,
   the native purchase still happens, and later steering stays passive.
3. Exercise representative valid Underworld and Surface rooms and confirm no
   callback-local mismatch remains where a checkpoint owns the truth.
4. Confirm intentional player divergence is caught no later than the checkpoint
   required to make the following room reliable.
5. Update the durable mismatch-policy and integration-boundary documents to the
   final implemented contact names.
6. Retire this plan and the superseded acquisition-steering progress plan after
   their remaining durable decisions are absorbed.

Run the complete planner repository gate once at phase closure. Run the external
executor's complete Lua/smoke gate and a local deployment smoke before live
closure. Do not rerun the complete gates after documentation-only retirement if
the tested production heads are unchanged.

## Explicit Non-Goals

- Revalidating planner trait, duo, replacement, rarity, reward, or shop legality
  in Lua.
- Tracking ordinary payment, affordability, purchase counts, or purchase order.
- Desynchronizing because the player selected a different offered trait before a
  standard checkpoint observes the durable result.
- Restoring semantic commerce transactions that were deliberately removed.
- Adding a global action cursor, authored-order fallback, event bus, or second
  semantic completion ledger.
- Parsing planner address strings in Lua.
- Adding broad new room-exit state comparisons solely to compensate for removed
  callback checks.
- Changing the planner UI, authored save schema, catalog declarations, or
  simulation rules.

## Audit-Against Checklist

Before closing each gate, review specifically for:

- exact transaction correlation accidentally falling back to provider or
  readiness;
- a new executor semantic rule not present in the published product;
- a peripheral adapter retaining direct mismatch authority without belonging to
  the closed list;
- a fault being mislabeled as plan/run divergence;
- mismatch paths suppressing native behavior;
- diagnostics becoming an unbounded state/event system;
- synthetic tests passing data that the strict production codec cannot emit;
- protocol duplication between `offerKey` and `transactionOwner`; and
- superseded acquisition-steering or mismatch paths left live in parallel.
